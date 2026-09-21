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
 */

import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isLockfile, isManifest, regenerateLockfile } from './integrator-lockfile.ts';
import type { RegenerateOptions } from './integrator-lockfile.ts';

export type ResolveOutcome = 'clean' | 'resolved' | 'aborted-ineligible' | 'aborted-error';

export interface ResolveResult {
  outcome: ResolveOutcome;
  files: string[];
  reason?: string;
}

function git(cwd: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function gitOrThrow(cwd: string, args: string[]): string {
  const result = git(cwd, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
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

/** Nội dung của `file` tại `ref`, hoặc `''` nếu file không tồn tại ở đó (trường hợp add/add). */
function showOrEmpty(cwd: string, ref: string, file: string): string {
  const result = git(cwd, ['show', `${ref}:${file}`]);
  return result.status === 0 ? result.stdout : '';
}

/** File có tồn tại ở `ref` không. */
function existsAt(cwd: string, ref: string, file: string): boolean {
  return git(cwd, ['cat-file', '-e', `${ref}:${file}`]).status === 0;
}

/**
 * Gộp `ontoRef` vào HEAD của cây làm việc tại `cwd`. `cwd` phải là một
 * checkout sạch, đã đứng đúng nhánh cần gộp; `ontoRef` phải đã fetch sẵn
 * (ví dụ `origin/main`). Không bao giờ sửa `cwd` khi trả về
 * `aborted-ineligible` hoặc `aborted-error` — merge luôn được `--abort`
 * trước khi hàm trả về, nên cây làm việc quay lại đúng trạng thái ban đầu.
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

function resolveAfterMergeAttempt(
  cwd: string,
  ontoRef: string,
  merge: SpawnSyncReturns<string>,
  options: RegenerateOptions,
): ResolveResult {
  if (merge.status === 0) {
    const staged = gitOrThrow(cwd, ['diff', '--cached', '--name-only']).trim();
    if (staged !== '') {
      gitOrThrow(cwd, ['commit', '--no-edit', '-m', `Gộp ${ontoRef} (integrator, không xung đột)`]);
      // outcome 'clean' + có commit mới: HEAD vừa đổi, caller nên chạy
      // pnpm check rồi push.
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
      return { outcome: 'aborted-error', files: conflicted, reason: regenerated.reason };
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

  const how = [
    additive.length > 0 ? `union thuần cộng thêm: ${additive.join(', ')}` : '',
    lockfiles.length > 0 ? `lockfile tạo lại: ${lockfiles.join(', ')}` : '',
  ]
    .filter((part) => part !== '')
    .join('; ');
  gitOrThrow(cwd, ['commit', '--no-edit', '-m', `Gộp ${ontoRef} (integrator, ${how})`]);
  return { outcome: 'resolved', files: conflicted };
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
