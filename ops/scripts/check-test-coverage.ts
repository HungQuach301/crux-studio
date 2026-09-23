#!/usr/bin/env node
/**
 * Z11 (`ops/known-failures.md` nhóm Z) — test có trên đĩa nhưng không nằm
 * trong glob của `pnpm test`.
 *
 * `pnpm test` (xem `package.json`) chỉ nạp ba glob:
 *
 *     kernel/test/**\/*.test.ts
 *     workshops/**\/test/**\/*.test.ts
 *     ops/test/**\/*.test.ts
 *
 * Một file `*.test.ts` đặt sai chỗ — ngoài ba nhánh trên, hoặc sâu hơn một
 * cấp mà glob không quét tới — vẫn nằm yên trên đĩa, `git status` vẫn sạch,
 * nhưng `node --test` không bao giờ nạp nó. Bộ test báo xanh với ÍT test hơn
 * nó tưởng, và không ai đếm nên không ai biết (nhóm Z: một bước im lặng
 * không chạy, và không có gì đỏ).
 *
 * Cách bắt: SO HAI CON SỐ — đếm `*.test.ts` bằng cách quét toàn repo, so với
 * tập file khớp đúng ba glob ở trên. Lệch là đỏ, kèm tên từng file bị bỏ sót
 * (đếm không thôi thì biết có lệch mà không biết lệch ở đâu).
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const IGNORED_DIRS = new Set(['node_modules', '.git']);

/** Quét toàn bộ `root`, trả về đường dẫn tương đối (dùng `/`) của mọi file `*.test.ts`. */
export function findTestFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.test.ts')) {
        found.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Bốn glob y hệt `package.json` → `scripts.test`. Viết tay bốn luật thay vì
 * kéo một thư viện glob: mặt bằng chỉ có bốn hình dạng cố định, và viết tay
 * giữ luật này khớp glob thật — glob thật đổi mà quên sửa ở đây thì cũng là
 * một chỗ lệch mà không gì đỏ.
 *
 * ⚠️ Chỗ lệch đó đã xảy ra thật (`KF-018`, mục `platform/P-031`): mục
 * `visual/V-002` (PR #42) thêm glob thứ tư `spike/**\/test/**\/*.test.ts` vào
 * `package.json` mà quên luật tương ứng ở đây, nên `pnpm check` ĐỎ trên chính
 * `main` — đúng cảnh báo mà khối chú thích này viết ra trước đó. `pnpm test`
 * **có** chạy `spike/canvas/test/camera.test.ts` (8 bài); chính hàm này mới là
 * chỗ nói sai.
 */
export function matchesTestGlob(path: string): boolean {
  return (
    /^kernel\/test\/.*\.test\.ts$/.test(path) ||
    /^workshops\/[^/]+\/test\/.*\.test\.ts$/.test(path) ||
    /^ops\/test\/.*\.test\.ts$/.test(path) ||
    /^spike\/.*\/test\/.*\.test\.ts$/.test(path)
  );
}

/** File có trên đĩa mà không khớp glob nào — đây là danh sách bị `pnpm test` bỏ sót. */
export function testFilesMissedByGlob(diskFiles: readonly string[]): string[] {
  return diskFiles.filter((f) => !matchesTestGlob(f)).sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('check-test-coverage.ts') === true;

if (isMain) {
  const disk = findTestFiles(process.cwd());
  const missed = testFilesMissedByGlob(disk);

  if (missed.length > 0) {
    process.stderr.write(
      `Test có trên đĩa nhưng ngoài glob của \`pnpm test\` (Z11):\n` +
        missed.map((f) => `  - ${f}\n`).join('') +
        `Trên đĩa: ${disk.length} file \`*.test.ts\`. Trong glob: ${disk.length - missed.length}.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`Test coverage ok: ${disk.length} file \`*.test.ts\`, tất cả đều trong glob của pnpm test.\n`);
}
