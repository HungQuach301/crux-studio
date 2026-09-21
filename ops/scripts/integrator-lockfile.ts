/**
 * Tạo lại lockfile khi nó xung đột — cơ chế của mục `I-004`
 * (`ops/lanes/integration/backlog.md`).
 *
 * CHARTER mục 7 ("file nóng được phân vùng") ghi: **lockfile do làn
 * `integration` tạo lại khi có xung đột.** Đây là phần "tạo lại" đó. Nó
 * chạy bên trong `integrator-resolve.ts`, nên làn gây xung đột không phải
 * tự sửa lockfile — và cũng không được phép, vì không ai sửa tay một file
 * dẫn xuất.
 *
 * Vì sao lockfile không đi đường union như các file append-only:
 *
 * - `pnpm-lock.yaml` là **file dẫn xuất**, không phải nguồn. Nguồn của nó
 *   là các `package.json` cộng `pnpm-workspace.yaml`. Sau khi git đã tự gộp
 *   xong các manifest đó, lockfile đúng chỉ có một bản — bản mà `pnpm` sinh
 *   ra từ cây đã gộp. Giữ lại dòng của bên này hay bên kia đều là đoán.
 * - Union trên YAML **merge được mà vẫn hỏng** (nhóm lỗi Z): hai khối
 *   `importers` chồng lên nhau cho ra khoá lặp hoặc thụt lề sai, và không
 *   có gì đỏ cho tới khi `pnpm install --frozen-lockfile` chạy ở một máy
 *   khác. `.gitattributes` đã ghi rõ: không đặt `merge=union` cho file mà
 *   thứ tự và cấu trúc dòng mang ý nghĩa.
 * - Xung đột lockfile thật gần như luôn có **xoá/sửa dòng ở cả hai bên**
 *   (một phiên bản đổi chỗ). Luật "thuần cộng thêm" của
 *   `integrator-resolve.ts` vì thế luôn trả `aborted-ineligible` — tức là
 *   PR nằm chờ người. Tạo lại là cách duy nhất không cần người.
 *
 * Hai lớp chặn, cả hai đều là chạy thật chứ không phải đọc file:
 *
 * 1. Bản mồi lấy từ **`MERGE_HEAD`** (nhánh đang được gộp vào, thực tế là
 *    `origin/main`), không phải từ số không. `pnpm` giữ nguyên mọi phép
 *    phân giải còn thoả manifest và chỉ tính lại phần cần đổi, nên lockfile
 *    không trôi sang phiên bản mới của hàng trăm gói phụ thuộc gián tiếp.
 *    Đó là giả định **G18**, đã kiểm bằng chạy thật với gói từ registry:
 *    có bản mồi thì `semver@7.5.0` ở nguyên, không có thì nhảy lên
 *    `7.8.5` — cùng một manifest `^7.0.0`.
 *    Chọn `main` vì đó là thân chung: cái gì đã vào `main` thì các PR khác
 *    cũng đang đứng trên đó.
 * 2. Sau khi sinh, chạy lại `pnpm install --frozen-lockfile` — cùng cờ mà
 *    CI dùng ở bước cài đặt — trên chính cây vừa gộp. Đã kiểm bằng đột
 *    biến, và ghi đúng những gì nó bắt được chứ không hơn: bỏ một khối
 *    `importers` khỏi lockfile thì nó thoát mã 1 ("specifiers in the
 *    lockfile don't match specifiers in package.json"), nhưng đổi một
 *    `version: link:…` thành đường dẫn không tồn tại thì nó vẫn xanh. Tức
 *    là cổng này bắt **lệch specifier**, không bắt lệch phép phân giải.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const LOCKFILE_BASENAME = 'pnpm-lock.yaml';

/** Manifest — nguồn của lockfile. Xung đột ở đây thì không tạo lại được. */
const MANIFEST_BASENAMES = new Set(['package.json', 'pnpm-workspace.yaml']);

export function isLockfile(file: string): boolean {
  return basename(file) === LOCKFILE_BASENAME;
}

/**
 * Lockfile **ở gốc repo** — cái duy nhất tạo lại được.
 *
 * Một `pnpm-lock.yaml` nằm sâu trong cây là ca phải dừng lại, không phải ca
 * tạo lại, và lý do là một cái bẫy im lặng đã đo được: gọi
 * `pnpm install --lockfile-only` từ `packages/a` của một workspace thì pnpm
 * **thoát 0 và không ghi gì** vào `packages/a/pnpm-lock.yaml` — nó làm việc
 * với lockfile ở gốc workspace. Bản mồi vì thế vẫn nằm nguyên đó, không có
 * dấu xung đột, và cổng `--frozen-lockfile` (kiểm lockfile GỐC) vẫn xanh.
 * Kết quả: tool báo `ok`, rồi `git add` đúng bản của `MERGE_HEAD` và vứt
 * lặng lẽ phía bên kia. Đúng nhóm lỗi Z.
 */
export function isRootLockfile(file: string): boolean {
  return file === LOCKFILE_BASENAME;
}

export function isManifest(file: string): boolean {
  return MANIFEST_BASENAMES.has(basename(file));
}

export interface RegenerateOptions {
  /** Lệnh `pnpm`. Test bơm lệnh giả vào đây để dựng ca hỏng; mặc định là `pnpm` thật. */
  pnpmCommand?: string;
}

export interface RegenerateResult {
  ok: boolean;
  reason?: string;
  /** `true`: ca cần người, không phải lỗi kỹ thuật. Caller trả `aborted-ineligible`. */
  ineligible?: boolean;
}

/** Dấu xung đột của git ở đầu dòng. Không dùng `<<<` lỏng lẻo: YAML có thể chứa chuỗi đó. */
const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/m;

/**
 * Những câu `pnpm` nói khi nó **vứt bản mồi đi và sinh lại từ số không**.
 * Đã đo, cả hai đều kèm `exit 0`:
 *
 * - `Ignoring broken lockfile at …` — lockfile không phân giải được;
 * - `Merge conflict detected in pnpm-lock.yaml and successfully merged` —
 *   bản mồi còn dấu xung đột.
 *
 * Cả hai đều làm bốc hơi bảo đảm "không trôi phiên bản" mà không gì đỏ, nên
 * ở đây chúng là THẤT BẠI, không phải cảnh báo.
 */
const SEED_DISCARDED = /Ignoring broken lockfile|Merge conflict detected/i;

function tail(text: string, lines = 12): string {
  return text.trim().split('\n').slice(-lines).join(' / ');
}

/**
 * Cổng kiểm lockfile của mục `I-006`: **cài thật** bằng
 * `pnpm install --frozen-lockfile` trên cây vừa gộp — đúng lệnh CI chạy ở
 * bước cài đặt.
 *
 * Vì sao không dùng lại cổng `--lockfile-only --frozen-lockfile` ở cuối
 * `regenerateLockfile`: đã **đo**, hai cổng không bắt cùng một thứ. Trên
 * một lockfile gộp sạch mà mất một khối `packages:` (ca tái hiện của
 * `I-006`, xem `ops/test/integrator-clean-merge-lockfile.test.ts`):
 *
 * | Lệnh | Kết quả |
 * |---|---|
 * | `pnpm install --lockfile-only --frozen-lockfile` | **xanh**, mã 0 |
 * | `pnpm install --frozen-lockfile` | **đỏ**, `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` |
 *
 * `--lockfile-only` chỉ đối chiếu specifier của `importers` với các
 * manifest; nó không đi hỏi từng phép phân giải có thật sự nằm trong
 * `packages:` hay không. Đúng nhóm lỗi Z: cổng rẻ hơn thì xanh, và cái đỏ
 * chỉ lộ ra ở CI của người khác.
 *
 * Giới hạn ghi trước, không đoán giữa chừng: cổng này **cài thật**, nên một
 * lần chạy không ra được mạng (hoặc registry hỏng) cũng cho đỏ. Hướng sai
 * của nó là an toàn — bên gọi huỷ gộp và giao lại cho người, chứ không đẩy
 * một lockfile chưa kiểm được lên. Nguyên văn đầu ra của `pnpm` đi kèm
 * trong `reason` để người đọc phân biệt được hai ca.
 */
export function verifyLockfileInstall(cwd: string, options: RegenerateOptions = {}): RegenerateResult {
  const pnpm = options.pnpmCommand ?? 'pnpm';
  const verify = spawnSync(pnpm, ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd,
    encoding: 'utf8',
    // Cùng cái bẫy mà `GIT_MAX_BUFFER` của `integrator-resolve.ts` mô tả:
    // vượt trần 1 MiB mặc định thì Node giết tiến trình (`SIGTERM`,
    // `ENOBUFS`) và cổng này ra đỏ vì `maxBuffer`, không vì lockfile. Cổng
    // của `I-004` in ít nên chưa lộ; cổng này **cài thật**, và một repo có
    // phụ thuộc thật in vượt 1 MiB rất sớm.
    maxBuffer: 64 * 1024 * 1024,
  });
  if (verify.error) {
    return {
      ok: false,
      reason: `pnpm install --frozen-lockfile không chạy được: ${verify.error.message}`,
    };
  }
  if (verify.status !== 0) {
    return {
      ok: false,
      ineligible: true,
      reason: `pnpm install --frozen-lockfile đỏ trên cây vừa gộp (mã ${verify.status}): ${tail(
        `${verify.stdout ?? ''}\n${verify.stderr ?? ''}`,
      )}`,
    };
  }
  return { ok: true };
}

/**
 * Ghi đè `lockfilePath` (đường dẫn tương đối trong `cwd`) bằng bản `pnpm`
 * sinh ra từ các manifest ĐANG CÓ TRONG CÂY LÀM VIỆC.
 *
 * `seed` là nội dung bản mồi — nội dung lockfile ở `MERGE_HEAD`. `null`
 * nghĩa là sinh từ số không (không nên dùng ở đường chạy thường).
 *
 * Hàm không đụng tới git: caller quyết định `git add` hay `git merge
 * --abort`. Nhờ vậy nó kiểm được một mình, không cần dựng repo.
 */
export function regenerateLockfile(
  cwd: string,
  lockfilePath: string,
  seed: string | null,
  options: RegenerateOptions = {},
): RegenerateResult {
  const pnpm = options.pnpmCommand ?? 'pnpm';
  const absolute = join(cwd, lockfilePath);
  const root = dirname(absolute);

  // Bản mồi hỏng thì `pnpm` KHÔNG đỏ: nó chỉ nói một câu rồi sinh lại từ số
  // không, và lockfile ra vẫn hợp lệ. Ca dễ gặp nhất là `main` lỡ mang một
  // lockfile còn dấu xung đột (ai đó giải tay để sót). Bắt ở đây, trước khi
  // ghi, vì sau khi `pnpm` chạy xong thì không còn dấu vết nào để bắt.
  if (seed !== null && CONFLICT_MARKER.test(seed)) {
    return {
      ok: false,
      ineligible: true,
      reason: `${lockfilePath}: bản mồi ở MERGE_HEAD còn dấu xung đột — pnpm sẽ lặng lẽ bỏ nó và sinh lại từ số không, cần người`,
    };
  }

  if (seed === null) {
    rmSync(absolute, { force: true });
  } else {
    writeFileSync(absolute, seed, 'utf8');
  }

  // `--no-frozen-lockfile` là bắt buộc, không phải thừa: khi biến môi trường
  // `CI` được đặt (mọi lần chạy trong Actions), `pnpm` mặc định
  // `frozen-lockfile=true` và sẽ TỪ CHỐI cập nhật lockfile. Thiếu cờ này thì
  // bước tạo lại chỉ đỏ ở CI, còn ở máy thì xanh.
  const generate = spawnSync(
    pnpm,
    ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8' },
  );
  if (generate.status !== 0) {
    return {
      ok: false,
      reason: `${lockfilePath}: pnpm install --lockfile-only thất bại (mã ${generate.status ?? 'không chạy được'}): ${tail(
        `${generate.stdout ?? ''}\n${generate.stderr ?? ''}${generate.error ? `\n${generate.error.message}` : ''}`,
      )}`,
    };
  }

  const generateOutput = `${generate.stdout ?? ''}\n${generate.stderr ?? ''}`;
  if (SEED_DISCARDED.test(generateOutput)) {
    return {
      ok: false,
      reason: `${lockfilePath}: pnpm đã VỨT bản mồi và sinh lại từ số không — mọi phép phân giải cũ có thể đã trôi: ${tail(
        generateOutput,
      )}`,
    };
  }

  if (!existsSync(absolute)) {
    return { ok: false, reason: `${lockfilePath}: pnpm chạy xong nhưng không có lockfile nào được sinh ra` };
  }
  if (CONFLICT_MARKER.test(readFileSync(absolute, 'utf8'))) {
    return { ok: false, reason: `${lockfilePath}: lockfile vừa tạo lại VẪN còn dấu xung đột` };
  }

  const verify = spawnSync(
    pnpm,
    ['install', '--lockfile-only', '--frozen-lockfile', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8' },
  );
  if (verify.status !== 0) {
    return {
      ok: false,
      reason: `${lockfilePath}: lockfile vừa tạo lại không khớp manifest — pnpm install --frozen-lockfile đỏ: ${tail(
        `${verify.stdout ?? ''}\n${verify.stderr ?? ''}`,
      )}`,
    };
  }

  return { ok: true };
}
