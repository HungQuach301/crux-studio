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
 *    Chọn `main` vì đó là thân chung: cái gì đã vào `main` thì các PR khác
 *    cũng đang đứng trên đó.
 * 2. Sau khi sinh, chạy lại **đúng cổng mà CI dùng** —
 *    `pnpm install --frozen-lockfile` — trên chính cây vừa gộp. Cổng này đỏ
 *    khi lockfile lệch manifest, nên nó bắt được cả trường hợp `pnpm` chạy
 *    nhầm thư mục. Đã kiểm bằng đột biến: bỏ một khối `importers` khỏi
 *    lockfile thì cổng này thoát mã 1 với "specifiers in the lockfile don't
 *    match specifiers in package.json".
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
}

/** Dấu xung đột của git ở đầu dòng. Không dùng `<<<` lỏng lẻo: YAML có thể chứa chuỗi đó. */
const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/m;

function tail(text: string, lines = 12): string {
  return text.trim().split('\n').slice(-lines).join(' / ');
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
