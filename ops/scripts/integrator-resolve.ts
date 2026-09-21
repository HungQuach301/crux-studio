#!/usr/bin/env node
/**
 * Giải xung đột "thuần cộng thêm" khi gộp một ref vào nhánh hiện tại — phần
 * cơ chế của mục `P-016` (`ops/lanes/platform/backlog.md`). Routine
 * `crux-integrator` gọi tool này cho từng PR đang xung đột, thay vì tự đoán
 * cách giải bằng lời — quyết định "giải được hay không" nằm ở đây, đối
 * chiếu bằng số, không suy luận (CHARTER 11.1).
 *
 * Giới hạn khai trước, không đoán giữa chừng (đúng tiêu chí xong của
 * `P-016`): chỉ tự giải khi, so với tổ tiên chung của hai nhánh, KHÔNG bên
 * nào xoá hay sửa một dòng của file xung đột — tức là cả hai bên thuần
 * cộng thêm. Sửa một dòng cũng tính là "xoá" ở đây, vì diff biểu diễn sửa
 * thành xoá+thêm. Hễ một file xung đột có xoá/sửa ở một trong hai bên,
 * TOÀN BỘ lần gộp bị huỷ (`git merge --abort`) — không giải một phần.
 *
 * Không bao giờ `--ours`, `--theirs`, rebase hay force-push. `--ours` và
 * `--theirs` không phải "giữ cả hai bên", chúng xoá hẳn một bên — đúng thứ
 * KF-002 cấm. Cách giải ở đây là `git merge-file --union`, cùng thuật toán
 * mà `.gitattributes` dùng cho `merge=union` (KF-005) — áp dụng cho MỌI
 * file xung đột đủ điều kiện, không chỉ file đã khai attribute, vì G17 cho
 * thấy attribute không tự áp cho chính lần gộp mang nó tới.
 *
 * **Một ngoại lệ, có tên: lockfile** (mục `I-004`, CHARTER mục 7). Luật
 * "thuần cộng thêm" ở trên KHÔNG áp cho `pnpm-lock.yaml`, và union cũng
 * không: lockfile là file dẫn xuất, nên nó được **tạo lại** từ các manifest
 * của cây vừa gộp — xem `ops/scripts/integrator-lockfile.ts`. Đây là lý do
 * làn gây xung đột không phải tự sửa lockfile: làn `integration` tạo lại.
 *
 * **Và gộp SẠCH cũng phải qua cổng lockfile** (mục `I-006`). `I-004` chỉ
 * phủ ca lockfile *xung đột*; ca lockfile gộp sạch mà vẫn lệch manifest đã
 * tái hiện được bằng chạy thật, và `pnpm check` ở máy không bắt được vì nó
 * không chạy `pnpm install --frozen-lockfile`. Cổng nằm ở
 * `guardLockfileAfterMerge` dưới đây và chạy ở mọi đường gộp có chạm
 * lockfile, trước khi commit.
 */

import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isLockfile,
  isManifest,
  isRootLockfile,
  regenerateLockfile,
  verifyLockfileInstall,
} from './integrator-lockfile.ts';
import type { RegenerateOptions } from './integrator-lockfile.ts';

export type ResolveOutcome = 'clean' | 'resolved' | 'aborted-ineligible' | 'aborted-error';

export interface ResolveResult {
  outcome: ResolveOutcome;
  files: string[];
  reason?: string;
  /**
   * Lockfile đã phải **tạo lại** sau khi gộp vì cổng `--frozen-lockfile` đỏ
   * (mục `I-006`). Vắng mặt nghĩa là không phải tạo lại. Ghi chú của lượt
   * chạy cần số này: một lần gộp `clean` mà vẫn phải sửa lockfile là tín
   * hiệu đáng đọc, không phải chi tiết thừa.
   */
  lockfileRegenerated?: string[];
}

/**
 * `maxBuffer` mặc định của Node là 1 MiB, và vượt ngưỡng thì `spawnSync`
 * KHÔNG báo lỗi theo cách dễ thấy: nó giết tiến trình (`signal: SIGTERM`,
 * `error.code: ENOBUFS`) và trả về stdout **đã bị cắt cụt**. Với
 * `git show <ref>:pnpm-lock.yaml` thì 1 MiB là ngưỡng một repo có phụ
 * thuộc thật vượt qua rất sớm — repo này mới 2,4 KB nên chưa lộ. Cũng vậy
 * với `ops/logs/*.jsonl`: file append-only chỉ dài thêm theo thời gian.
 * Nâng trần lên 64 MiB, và ở `gitOrThrow` coi `error` là thất bại thật —
 * một stdout cắt cụt mà vẫn `status === 0` là đúng hình dạng nhóm lỗi Z.
 */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

/** Cắt ngắn một thông điệp lỗi: `reason` đi thẳng vào log routine và bản tin. */
function briefly(text: string, max = 600): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}… (cắt bớt)`;
}

function gitOrThrow(cwd: string, args: string[]): string {
  const result = git(cwd, args);
  if (result.error) {
    throw new Error(`git ${args.join(' ')} không chạy trọn: ${briefly(result.error.message)}`);
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${briefly(result.stderr || result.stdout)}`);
  }
  return result.stdout;
}

interface Numstat {
  added: number;
  deleted: number;
  binary: boolean;
}

/** Số dòng thêm/xoá của `file` giữa `base` và `side`. Rỗng nghĩa là file không đổi. */
function numstat(cwd: string, base: string, side: string, file: string): Numstat {
  const out = gitOrThrow(cwd, ['diff', '--numstat', base, side, '--', file]).trim();
  if (out === '') return { added: 0, deleted: 0, binary: false };
  const [addedRaw, deletedRaw] = out.split('\t');
  if (addedRaw === '-' || deletedRaw === undefined || deletedRaw === '-') {
    return { added: 0, deleted: 0, binary: true };
  }
  return { added: Number(addedRaw), deleted: Number(deletedRaw), binary: false };
}

/** File có tồn tại ở `ref` không. */
function existsAt(cwd: string, ref: string, file: string): boolean {
  return git(cwd, ['cat-file', '-e', `${ref}:${file}`]).status === 0;
}

/**
 * Nội dung của `file` tại `ref`, hoặc `''` nếu file không tồn tại ở đó
 * (trường hợp add/add).
 *
 * Hỏi `existsAt` TRƯỚC rồi mới `show`, thay vì coi mọi lỗi của `show` là
 * "không có file": một lỗi khác — mất quyền đọc, hay ENOBUFS trước khi
 * trần được nâng — từng biến thành base RỖNG, và base rỗng làm
 * `merge-file --union` nhân đôi toàn bộ file mà không gì đỏ.
 */
function showOrEmpty(cwd: string, ref: string, file: string): string {
  if (!existsAt(cwd, ref, file)) return '';
  return gitOrThrow(cwd, ['show', `${ref}:${file}`]);
}

/**
 * Gộp `ontoRef` vào HEAD của cây làm việc tại `cwd`. `cwd` phải là một
 * checkout sạch, đã đứng đúng nhánh cần gộp; `ontoRef` phải đã fetch sẵn
 * (ví dụ `origin/main`). Không bao giờ sửa `cwd` khi trả về
 * `aborted-ineligible` hoặc `aborted-error` — merge luôn được `--abort`
 * trước khi hàm trả về, nên cây làm việc quay lại đúng trạng thái ban đầu.
 *
 * Một ngoại lệ đã đo, ghi ra để bên gọi không bất ngờ: cổng lockfile của
 * mục `I-006` **cài thật**, nên nó ghi vào `node_modules/` theo cây vừa
 * gộp — kể cả ở những lượt kết thúc bằng `--abort`, khi cây đó không còn
 * tồn tại nữa. `node_modules/` nằm trong `.gitignore` nên `git status` vẫn
 * sạch và không có gì lọt vào commit, nhưng `pnpm check` chạy ngay sau một
 * lượt huỷ sẽ đứng trên `node_modules` của cây đã huỷ; chạy
 * `pnpm install --frozen-lockfile` trước nếu điều đó quan trọng.
 */
export function resolveAdditiveMerge(
  cwd: string,
  ontoRef: string,
  options: RegenerateOptions = {},
): ResolveResult {
  const dirty = gitOrThrow(cwd, ['status', '--porcelain']).trim();
  if (dirty !== '') {
    return { outcome: 'aborted-error', files: [], reason: 'cây làm việc không sạch, không thử gộp' };
  }

  const merge = git(cwd, ['merge', '--no-commit', '--no-ff', ontoRef]);
  try {
    return resolveAfterMergeAttempt(cwd, ontoRef, merge, options);
  } catch (error) {
    // Lưới an toàn cuối cùng: bất kỳ lỗi nào chưa lường trước ở dưới đây
    // (một `gitOrThrow` ném ra, một trường hợp git chưa nghĩ tới) đều KHÔNG
    // được để cây làm việc dở dang giữa chừng — huỷ trước, báo lỗi sau.
    // Không có nhánh nào trong `resolveAfterMergeAttempt` được phép ném lỗi
    // ra ngoài mà không đi qua đây trước.
    git(cwd, ['merge', '--abort']);
    return {
      outcome: 'aborted-error',
      files: [],
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Kết quả của cổng lockfile sau khi gộp (mục `I-006`): hoặc merge đã bị
 * huỷ và có sẵn `ResolveResult` để trả thẳng, hoặc gộp đi tiếp được, kèm
 * danh sách lockfile đã phải tạo lại (rỗng là trường hợp thường).
 */
interface LockfileGuard {
  aborted?: ResolveResult;
  repaired: string[];
}

/**
 * Mục `I-006` — **gộp được không có nghĩa là đúng.**
 *
 * `git merge` ghép `pnpm-lock.yaml` theo dòng, không hiểu YAML. Khi hai
 * nhánh sửa hai vùng cách xa nhau trong lockfile, git gộp **sạch** — không
 * một dấu xung đột nào — mà kết quả vẫn lệch với manifest sau khi gộp. Ca
 * đã tái hiện bằng chạy thật (`ops/test/integrator-clean-merge-lockfile.test.ts`):
 * một bên bỏ phụ thuộc cuối cùng còn dùng một gói, bên kia thêm phụ thuộc
 * vào đúng gói đó ở một gói khác trong workspace. Gộp xong: `importers` trỏ
 * tới một phép phân giải mà khối `packages:` không còn — `pnpm install
 * --frozen-lockfile` đỏ với `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`, chính
 * pnpm cũng nói "probably caused by a badly resolved merge conflict".
 *
 * Trước mục này, đường `clean` của tool commit thẳng rồi để bên gọi chạy
 * `pnpm check` — mà `pnpm check` **không** chạy `--frozen-lockfile` (chỉ CI
 * chạy). Nghĩa là integrator báo "xanh, đã push" rồi CI mới đỏ: đúng nhóm
 * lỗi Z (`ops/known-failures.md`).
 *
 * Cổng chạy ở **mọi** đường gộp có chạm lockfile — cả `clean` lẫn union —
 * và luôn chạy TRƯỚC khi commit, vì bản mồi để tạo lại nằm ở `MERGE_HEAD`
 * và `MERGE_HEAD` biến mất ngay sau commit.
 *
 * Ba bước, đúng thứ tự tiêu chí xong của `I-006`: kiểm → tạo lại → kiểm
 * lại. Còn đỏ sau khi tạo lại thì huỷ gộp và giao cho người
 * (`aborted-ineligible`), không bao giờ push một lockfile chưa qua cổng.
 */
function guardLockfileAfterMerge(cwd: string, options: RegenerateOptions): LockfileGuard {
  const changed = gitOrThrow(cwd, ['diff', '--cached', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const lockfiles = changed.filter(isLockfile);
  if (lockfiles.length === 0) return { repaired: [] };

  // Cùng lý do với đường union: một lockfile không ở gốc repo thì `pnpm`
  // chạy ở thư mục con sẽ không sinh lại nó — dừng, đừng "sửa" bằng một
  // lệnh thoát 0 mà chẳng ghi gì.
  const nested = lockfiles.find((file) => !isRootLockfile(file));
  if (nested !== undefined) {
    git(cwd, ['merge', '--abort']);
    return {
      repaired: [],
      aborted: {
        outcome: 'aborted-ineligible',
        files: lockfiles,
        reason: `${nested}: lockfile không nằm ở gốc repo — không kiểm và không sinh lại được sau khi gộp, cần người`,
      },
    };
  }

  // Lần gộp XOÁ lockfile (một bên bỏ pnpm, đổi vị trí workspace) thì không
  // có gì để kiểm — và cổng này **cài thật**, mà `pnpm install` không thấy
  // lockfile sẽ thoát 0 sau khi TỰ SINH một bản mới. Đã đo: chạy cổng ở ca
  // này để lại một `pnpm-lock.yaml` untracked, tức hồi sinh đúng file mà
  // một bên vừa cố ý xoá, và làm bẩn cây làm việc — trái hợp đồng ghi
  // trong docstring của `resolveAdditiveMerge` và làm lượt gộp kế tiếp ra
  // `aborted-error` "cây làm việc không sạch". Đi tiếp như trước mục
  // `I-006`: không lockfile thì không có lockfile nào lệch manifest.
  const present = lockfiles.filter((lock) => existsSync(join(cwd, lock)));
  if (present.length === 0) return { repaired: [] };

  const first = verifyLockfileInstall(cwd, options);
  if (first.ok) return { repaired: [] };

  const repaired: string[] = [];
  for (const lock of present) {
    const seed = gitOrThrow(cwd, ['show', `MERGE_HEAD:${lock}`]);
    const regenerated = regenerateLockfile(cwd, lock, seed, options);
    if (!regenerated.ok) {
      git(cwd, ['merge', '--abort']);
      return {
        repaired: [],
        aborted: {
          outcome: regenerated.ineligible === true ? 'aborted-ineligible' : 'aborted-error',
          files: lockfiles,
          reason: `${first.reason}; tạo lại cũng không xong: ${regenerated.reason}`,
        },
      };
    }
    gitOrThrow(cwd, ['add', '--', lock]);
    repaired.push(lock);
  }

  const second = verifyLockfileInstall(cwd, options);
  if (!second.ok) {
    git(cwd, ['merge', '--abort']);
    // `ineligible` phân biệt hai ca mà bản tin đọc khác nhau: cổng CHẠY
    // xong và nói lockfile còn lệch (`aborted-ineligible`, cần người) so
    // với cổng KHÔNG chạy được (`aborted-error`, lỗi kỹ thuật). Gộp hai ca
    // vào một câu là nói sai nguyên nhân cho người đọc.
    return {
      repaired: [],
      aborted: {
        outcome: second.ineligible === true ? 'aborted-ineligible' : 'aborted-error',
        files: lockfiles,
        reason:
          second.ineligible === true
            ? `lockfile vẫn lệch manifest SAU KHI đã tạo lại: ${second.reason}`
            : `không kiểm lại được lockfile sau khi tạo lại: ${second.reason}`,
      },
    };
  }

  return { repaired };
}

function resolveAfterMergeAttempt(
  cwd: string,
  ontoRef: string,
  merge: SpawnSyncReturns<string>,
  options: RegenerateOptions,
): ResolveResult {
  if (merge.status === 0) {
    const staged = gitOrThrow(cwd, ['diff', '--cached', '--name-only']).trim();
    if (staged !== '') {
      // Mục `I-006`: gộp sạch KHÔNG có nghĩa là lockfile đúng. Cổng chạy
      // trước commit, vì bản mồi để tạo lại nằm ở `MERGE_HEAD`.
      const guard = guardLockfileAfterMerge(cwd, options);
      if (guard.aborted !== undefined) return guard.aborted;
      const repaired =
        guard.repaired.length > 0 ? `, lockfile tạo lại: ${guard.repaired.join(', ')}` : '';
      gitOrThrow(cwd, [
        'commit',
        '--no-edit',
        '-m',
        `Gộp ${ontoRef} (integrator, không xung đột${repaired})`,
      ]);
      // outcome 'clean' + có commit mới: HEAD vừa đổi, caller nên chạy
      // pnpm check rồi push.
      return {
        outcome: 'clean',
        files: [],
        ...(guard.repaired.length > 0 ? { lockfileRegenerated: guard.repaired } : {}),
      };
    } else {
      // `ontoRef` đã là tổ tiên của HEAD ("Already up to date") — không có
      // gì để gộp. `--no-ff` vẫn để lại một merge dở dang trống, huỷ nó.
      // outcome 'clean' ở nhánh này KHÔNG có commit mới; caller không cần
      // push, vì HEAD không đổi.
      git(cwd, ['merge', '--abort']);
    }
    return { outcome: 'clean', files: [] };
  }

  const conflicted = gitOrThrow(cwd, ['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (conflicted.length === 0) {
    // Merge thất bại nhưng không có file nào ở trạng thái "unmerged" — một
    // dạng lỗi khác (vd. cây bẩn theo cách git merge tự phát hiện). Không
    // đoán, huỷ và báo nguyên văn.
    git(cwd, ['merge', '--abort']);
    return { outcome: 'aborted-error', files: [], reason: (merge.stderr || merge.stdout).trim() };
  }

  const base = gitOrThrow(cwd, ['merge-base', 'HEAD', 'MERGE_HEAD']).trim();

  // Lockfile đi đường riêng: nó là file dẫn xuất, được TẠO LẠI chứ không
  // union và không phải qua luật "thuần cộng thêm" (mục `I-004`, CHARTER
  // mục 7). Mọi file còn lại vẫn theo luật cũ, không đổi một chữ.
  const lockfiles = conflicted.filter(isLockfile);
  const additive = conflicted.filter((file) => !isLockfile(file));

  if (lockfiles.length > 0) {
    // Chỉ lockfile ở GỐC repo mới tạo lại được — xem `isRootLockfile`. Một
    // lockfile lồng sâu phải dừng ở đây, không được rơi xuống đường union
    // (nó vẫn là file dẫn xuất) và càng không được "tạo lại" bằng một lệnh
    // pnpm thoát 0 mà chẳng ghi gì.
    const nested = lockfiles.find((file) => !isRootLockfile(file));
    if (nested !== undefined) {
      git(cwd, ['merge', '--abort']);
      return {
        outcome: 'aborted-ineligible',
        files: conflicted,
        reason: `${nested}: lockfile không nằm ở gốc repo — pnpm chạy ở thư mục con sẽ không sinh lại nó, cần người`,
      };
    }

    // Tạo lại lockfile nghĩa là sinh nó TỪ manifest của cây vừa gộp. Nếu
    // chính manifest còn đang xung đột thì cái "nguồn" đó chưa tồn tại —
    // union một `package.json` cho ra JSON hỏng, và sinh lockfile từ JSON
    // hỏng là đóng băng cái hỏng đó vào một file không ai đọc bằng mắt.
    // Dừng ở đây, để người quyết. Nhóm lỗi Z nếu đi tiếp.
    const manifest = additive.find(isManifest);
    if (manifest !== undefined) {
      git(cwd, ['merge', '--abort']);
      return {
        outcome: 'aborted-ineligible',
        files: conflicted,
        reason: `${manifest}: manifest xung đột cùng lúc với lockfile — không sinh lockfile từ manifest chưa giải, cần người`,
      };
    }

    for (const lock of lockfiles) {
      const oursExists = existsAt(cwd, 'HEAD', lock);
      const theirsExists = existsAt(cwd, 'MERGE_HEAD', lock);
      if (!oursExists || !theirsExists) {
        // Một bên XOÁ lockfile là một quyết định về kiến trúc (bỏ pnpm, đổi
        // vị trí workspace), không phải xung đột nội dung. Tạo lại ở đây sẽ
        // hồi sinh file mà một bên vừa cố tình bỏ đi.
        git(cwd, ['merge', '--abort']);
        return {
          outcome: 'aborted-ineligible',
          files: conflicted,
          reason: `${lock}: bị xoá ở một bên (ours tồn tại=${oursExists}, theirs tồn tại=${theirsExists}) — không tự tạo lại, cần người`,
        };
      }
    }
  }

  for (const file of additive) {
    // Kiểm tồn tại TRƯỚC, tách khỏi numstat: một file bị XOÁ hẳn ở một bên
    // trong khi bản base đã RỖNG cho ra `numstat` "0 0" — trông như không
    // đổi gì, dù thực ra là xung đột xoá/sửa. numstat một mình không bắt
    // được ca này; đây là ca đã tìm ra khi soát lại tool (phản hồi review).
    const oursExists = existsAt(cwd, 'HEAD', file);
    const theirsExists = existsAt(cwd, 'MERGE_HEAD', file);
    if (!oursExists || !theirsExists) {
      git(cwd, ['merge', '--abort']);
      return {
        outcome: 'aborted-ineligible',
        files: conflicted,
        reason: `${file}: bị xoá ở một bên (ours tồn tại=${oursExists}, theirs tồn tại=${theirsExists}) — không tự giải, cần người`,
      };
    }

    const ours = numstat(cwd, base, 'HEAD', file);
    const theirs = numstat(cwd, base, 'MERGE_HEAD', file);
    if (ours.binary || theirs.binary || ours.deleted > 0 || theirs.deleted > 0) {
      git(cwd, ['merge', '--abort']);
      return {
        outcome: 'aborted-ineligible',
        files: conflicted,
        reason:
          `${file}: có xoá/sửa dòng ở ít nhất một bên (ours -${ours.deleted}, theirs -${theirs.deleted})` +
          `${ours.binary || theirs.binary ? ' hoặc là file nhị phân' : ''} — không tự giải, cần người`,
      };
    }
  }

  // Mọi file xung đột (trừ lockfile) đều thuần cộng thêm ở cả hai bên. Giải
  // bằng cùng thuật toán union mà `.gitattributes` dùng cho log append-only
  // (KF-005), áp cho từng file này dù nó chưa khai attribute.
  const tmp = mkdtempSync(join(tmpdir(), 'integrator-resolve-'));
  try {
    for (const file of additive) {
      const baseFile = join(tmp, 'base');
      const oursFile = join(tmp, 'ours');
      const theirsFile = join(tmp, 'theirs');
      writeFileSync(baseFile, showOrEmpty(cwd, base, file), 'utf8');
      writeFileSync(oursFile, gitOrThrow(cwd, ['show', `HEAD:${file}`]), 'utf8');
      writeFileSync(theirsFile, gitOrThrow(cwd, ['show', `MERGE_HEAD:${file}`]), 'utf8');

      const merged = spawnSync('git', ['merge-file', '--union', '-p', oursFile, baseFile, theirsFile], {
        cwd,
        encoding: 'utf8',
      });
      if (merged.status === null) {
        git(cwd, ['merge', '--abort']);
        return {
          outcome: 'aborted-error',
          files: conflicted,
          reason: `git merge-file không chạy được trên ${file}: ${merged.error?.message ?? 'không rõ lỗi'}`,
        };
      }
      writeFileSync(join(cwd, file), merged.stdout, 'utf8');
      gitOrThrow(cwd, ['add', '--', file]);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // Lockfile: tạo lại từ manifest của cây vừa gộp, bản mồi lấy từ
  // `MERGE_HEAD` (nhánh thân chung). Chạy SAU union, vì union có thể vừa
  // đụng tới một manifest không xung đột nhưng nằm trong danh sách — thứ tự
  // này bảo đảm `pnpm` đọc cây ở trạng thái cuối cùng.
  for (const lock of lockfiles) {
    const seed = gitOrThrow(cwd, ['show', `MERGE_HEAD:${lock}`]);
    const regenerated = regenerateLockfile(cwd, lock, seed, options);
    if (!regenerated.ok) {
      git(cwd, ['merge', '--abort']);
      return {
        outcome: regenerated.ineligible === true ? 'aborted-ineligible' : 'aborted-error',
        files: conflicted,
        reason: regenerated.reason,
      };
    }
    gitOrThrow(cwd, ['add', '--', lock]);
  }

  const stillConflicted = gitOrThrow(cwd, ['diff', '--name-only', '--diff-filter=U']).trim();
  if (stillConflicted !== '') {
    // `--union` không bao giờ để lại dấu xung đột theo thiết kế của git; nếu
    // vẫn còn thì có gì đó ta chưa hiểu — huỷ, không đoán tiếp.
    git(cwd, ['merge', '--abort']);
    return {
      outcome: 'aborted-error',
      files: conflicted,
      reason: `vẫn còn xung đột sau union, không rõ vì sao: ${stillConflicted}`,
    };
  }

  // Mục `I-006`, áp cho CẢ đường union: lockfile có thể đổi vì gộp mà
  // KHÔNG hề nằm trong danh sách xung đột — git ghép nó sạch trong khi một
  // file khác vướng. Đường union cũ chỉ kiểm lockfile khi chính nó xung
  // đột, nên đúng ca đó lọt qua. Cổng này cũng là bước "kiểm lại" thật sau
  // khi `regenerateLockfile` vừa chạy ở trên: cổng rẻ bên trong hàm đó
  // (`--lockfile-only --frozen-lockfile`) đã đo được là KHÔNG bắt một khối
  // `packages:` thiếu.
  const guard = guardLockfileAfterMerge(cwd, options);
  if (guard.aborted !== undefined) return guard.aborted;

  const regeneratedLocks = [...new Set([...lockfiles, ...guard.repaired])];
  const how = [
    additive.length > 0 ? `union thuần cộng thêm: ${additive.join(', ')}` : '',
    regeneratedLocks.length > 0 ? `lockfile tạo lại: ${regeneratedLocks.join(', ')}` : '',
  ]
    .filter((part) => part !== '')
    .join('; ');
  gitOrThrow(cwd, ['commit', '--no-edit', '-m', `Gộp ${ontoRef} (integrator, ${how})`]);
  return {
    outcome: 'resolved',
    files: conflicted,
    ...(regeneratedLocks.length > 0 ? { lockfileRegenerated: regeneratedLocks } : {}),
  };
}

function main(): void {
  const [, , ontoRef, cwdArg] = process.argv;
  if (!ontoRef) {
    process.stderr.write('cách dùng: node ops/scripts/integrator-resolve.ts <ontoRef> [cwd]\n');
    process.exit(1);
  }
  const cwd = cwdArg ?? process.cwd();
  const result = resolveAdditiveMerge(cwd, ontoRef);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  // 0: gộp xong (sạch hoặc union), sẵn sàng cho pnpm check rồi push.
  // 2: không tự giải được — kỳ vọng, không phải lỗi; đưa vào bản tin.
  // 1: lỗi thật, cây có thể ở trạng thái bất thường (báo ngay, không đoán).
  if (result.outcome === 'clean' || result.outcome === 'resolved') process.exit(0);
  else if (result.outcome === 'aborted-ineligible') process.exit(2);
  else process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
