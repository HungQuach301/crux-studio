#!/usr/bin/env node
/**
 * Z3 (`ops/known-failures.md` nhóm Z) — `.github/` lệch `ops/workflows/`.
 *
 * Workflow trong `ops/workflows/` chỉ có hiệu lực SAU KHI `sync-workflows.yml`
 * (do chủ dự án tạo một lần trong `.github/workflows/`, CHARTER 3.2) chép nó
 * sang `.github/workflows/`. Nếu sync ngừng chạy, hoặc chạy hỏng vì PAT
 * `WORKFLOW_SYNC_TOKEN` hết hạn: bản CŨ trong `.github/` vẫn chạy và vẫn
 * xanh. Mọi thứ trông bình thường — code mới trong `ops/workflows/` chưa bao
 * giờ có hiệu lực, và không có gì đỏ để báo điều đó.
 *
 * Cách bắt: so nội dung từng file, byte-với-byte. Không cần PAT, không cần
 * quyền gì thêm — chỉ cần đọc được cả hai thư mục.
 *
 * ## Vì sao KHÔNG chạy trong `pnpm lint:workflows` / `pnpm check`
 *
 * Một nhánh đang phát triển sửa `ops/workflows/**` MÀ CHƯA merge thì
 * `.github/workflows/` đương nhiên còn bản cũ — đó là trạng thái BÌNH
 * THƯỜNG của một PR đang mở, không phải lỗi. So hai thư mục ở đây sẽ đỏ
 * đúng lúc không nên đỏ, cho MỌI PR chạm `ops/workflows/**`.
 *
 * Script này vì thế CHỈ được gọi từ `ops/workflows/main-ci.yml`, và chỉ ở
 * job `check` khi sự kiện KHÔNG PHẢI `push` (tức ở lần chạy theo lịch hoặc
 * `workflow_dispatch`) — để tránh một cuộc đua vô hại nhưng ồn ào: `push`
 * vào `main` kích hoạt CẢ `main-ci` lẫn `sync-workflows.yml` cùng lúc, và
 * không có gì bảo đảm workflow nào xong trước. Lịch mỗi giờ của `main-ci`
 * (xem comment đầu file đó) đủ để bắt một lần sync hỏng thật trong vòng một
 * giờ, mà không báo động giả ngay sau một merge bình thường.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SyncProblem {
  file: string;
  reason: string;
}

/**
 * So nội dung `ops/workflows/*.yml` với file cùng tên trong `.github/workflows/`.
 *
 * `opsFiles`/`githubFiles` là bản đồ tên file → nội dung, để test truyền vào
 * trực tiếp mà không cần dựng thư mục thật. `sync-workflows.yml` không nằm
 * trong `ops/workflows/` (CHARTER 3.2: agent không được ghi đè cơ chế sync),
 * nên nó không có gì để so — bỏ qua đúng một tên đó ở phía `.github/`.
 */
export function unsyncedWorkflows(
  opsFiles: ReadonlyMap<string, string>,
  githubFiles: ReadonlyMap<string, string>,
): SyncProblem[] {
  const problems: SyncProblem[] = [];
  for (const [file, opsContent] of opsFiles) {
    const githubContent = githubFiles.get(file);
    if (githubContent === undefined) {
      problems.push({ file, reason: 'có trong ops/workflows/ nhưng chưa từng sync sang .github/workflows/' });
      continue;
    }
    if (githubContent !== opsContent) {
      problems.push({ file, reason: 'nội dung .github/workflows/ khác ops/workflows/ — sync đang hỏng hoặc đã dừng' });
    }
  }
  return problems;
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('check-workflows-synced.ts') === true;

if (isMain) {
  const opsDir = join(process.cwd(), 'ops', 'workflows');
  const githubDir = join(process.cwd(), '.github', 'workflows');

  if (!existsSync(githubDir)) {
    process.stderr.write('.github/workflows/ không tồn tại — không đối chiếu được.\n');
    process.exit(1);
  }

  const opsFiles = new Map<string, string>();
  for (const name of readdirSync(opsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    opsFiles.set(name, readFileSync(join(opsDir, name), 'utf8'));
  }

  const githubFiles = new Map<string, string>();
  for (const name of readdirSync(githubDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    githubFiles.set(name, readFileSync(join(githubDir, name), 'utf8'));
  }

  const problems = unsyncedWorkflows(opsFiles, githubFiles);
  if (problems.length > 0) {
    process.stderr.write(
      `sync-workflows lệch (Z3):\n${problems.map((p) => `  - ${p.file}: ${p.reason}`).join('\n')}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`sync-workflows ok: ${opsFiles.size} file khớp .github/workflows/.\n`);
}
