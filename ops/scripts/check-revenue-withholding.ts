#!/usr/bin/env node
/**
 * Cổng của mục `topic/T-013`: mọi ước tính doanh thu trong Channel Pack tính
 * theo số **sau** khấu trừ 30%, và hệ số khấu trừ là **dữ liệu** khai trong
 * pack chứ không phải hằng số rải trong code.
 *
 * Hai việc, cả hai là logic thuần để có test đứng độc lập; `check-contracts.ts`
 * nạp rồi gọi xuống đây (đúng khuôn `check-models.ts`, `check-fact-risk.ts`):
 *
 *  1. **`channelWithholdingProblems`** — mỗi Channel Pack phải khai
 *     `revenueWithholding` đủ và đúng hình dạng: `usSourcedRate` trong (0,1),
 *     `market` không rỗng, và ba chú thích người đọc `$reason`/`$asOf`/`$source`
 *     có mặt (`$asOf` là ngày ISO `YYYY-MM-DD`). Ghi lý do NGAY tại chỗ khai
 *     hệ số, kèm ngày và nguồn, là một tiêu chí xong của T-013 — thiếu một
 *     dòng nguồn thì lúc hiệp định thuế đổi không ai tìm ra chỗ phải sửa.
 *
 *  2. **`scanRevenueSites`** — dò mọi chỗ trong code TS *ước tính doanh thu*
 *     (một định danh khớp `…revenue…Usd`) mà **không** đi qua hệ số. Một file
 *     có chỗ ước tính doanh thu là hợp lệ chỉ khi nó cũng nhắc tới đường duy
 *     nhất được phép — `revenueWithholding` (đọc hệ số từ pack) hoặc
 *     `applyRevenueWithholding` (áp hệ số, `kernel/src/revenue.ts`). Đây là
 *     "một bài kiểm đỏ khi có chỗ ước tính doanh thu nào bỏ qua hệ số".
 *
 * Vì sao dò bằng định danh chứ không bằng phân tích luồng: nay CHƯA có chỗ nào
 * ước tính doanh thu (con số doanh thu của kênh chưa tồn tại), nên cổng này là
 * một cái bẫy đặt trước — ngày ai đó viết `const monthlyRevenueUsd = rpm * views`
 * mà quên hệ số, cổng đỏ. Heuristic có thể sai theo hai chiều; cả hai chiều đều
 * sửa được (đổi tên biến, hoặc thêm chú thích), và đó là đánh đổi có chủ đích
 * so với một cổng phức tạp không ai đọc nổi. Quy ước đặt tên: một con số doanh
 * thu hiển thị mang hậu tố `NetUsd`/`GrossUsd` (xem `WithheldRevenue`), nên tên
 * `…revenue…Usd` là đúng bề mặt cần canh.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Một định danh "ước tính doanh thu": có chữ `revenue` và hậu tố tiền `Usd`. */
const REVENUE_SITE = /\b[A-Za-z0-9_]*revenue[A-Za-z0-9_]*Usd\b/gi;

/**
 * Đường được phép: nhắc tới hệ số khai trong pack (`revenueWithholding`) hoặc
 * helper áp hệ số (`applyRevenueWithholding`/`readRevenueWithholding`, đều chứa
 * chuỗi `RevenueWithholding`). Một file ước tính doanh thu mà có một trong hai
 * chuỗi này coi như đã đi qua hệ số.
 */
const GUARD_MARKER = /revenueWithholding|RevenueWithholding/;

/** Thư mục có thể chứa chỗ ước tính doanh thu — không đệ quy vào test hay pack. */
const SCAN_ROOTS = [
  join('kernel', 'src'),
  join('workshops'),
  join('ops', 'scripts'),
];

/** File tự định nghĩa hệ số/cổng — không phải chỗ ước tính, bỏ qua khi dò cây. */
const SELF_FILES = new Set([
  join('kernel', 'src', 'revenue.ts'),
  join('ops', 'scripts', 'check-revenue-withholding.ts'),
]);

export interface ScanFile {
  /** Đường dẫn tương đối gốc repo, để in ra khi báo vi phạm. */
  path: string;
  content: string;
}

/**
 * Logic thuần: nhận danh sách file (đã lọc test/pack ở bên gọi), trả về danh
 * sách vi phạm — mỗi vi phạm là một chỗ ước tính doanh thu trong file không đi
 * qua hệ số. Rỗng nghĩa là mọi chỗ ước tính đều qua hệ số (hoặc chưa có chỗ nào).
 */
export function scanRevenueSites(files: readonly ScanFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    if (GUARD_MARKER.test(file.content)) continue; // file đã đi qua hệ số
    const lines = file.content.split('\n');
    lines.forEach((line, i) => {
      const matches = line.match(REVENUE_SITE);
      if (matches) {
        for (const id of matches) {
          problems.push(
            `${file.path}:${i + 1}: \`${id}\` ước tính doanh thu mà không đi qua ` +
              `\`revenueWithholding\`/\`applyRevenueWithholding\` (topic/T-013).`,
          );
        }
      }
    });
  }
  return problems;
}

/** Mọi file `.ts` dưới `SCAN_ROOTS`, trừ file test và file tự định nghĩa hệ số. */
function scanFiles(root: string): ScanFile[] {
  const found: ScanFile[] = [];
  const walk = (absDir: string): void => {
    if (!existsSync(absDir)) return;
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const abs = join(absDir, entry.name);
      const rel = abs.slice(root.length + 1);
      if (entry.isDirectory()) {
        if (entry.name === 'test' || entry.name === 'node_modules') continue;
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        if (SELF_FILES.has(rel)) continue;
        found.push({ path: rel, content: readFileSync(abs, 'utf8') });
      }
    }
  };
  for (const dir of SCAN_ROOTS) walk(join(root, dir));
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** Chỗ ước tính doanh thu bỏ qua hệ số, dò trên cây thật. */
export function unguardedRevenueSites(root: string): string[] {
  return scanRevenueSites(scanFiles(root));
}

/** Mọi Channel Pack đã persist — đường dẫn `channel.json` tuyệt đối, đã sắp. */
export function channelPackFiles(root: string): string[] {
  const dir = join(root, 'packs', 'channels');
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name, 'channel.json');
    if (existsSync(path)) found.push(path);
  }
  return found.sort();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Vấn đề của khối `revenueWithholding` trong MỘT pack đã đọc ra JSON. */
export function withholdingBlockProblems(label: string, pack: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const raw = pack['revenueWithholding'];
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return [`${label}: thiếu khối \`revenueWithholding\` (mọi kênh phải khai hệ số khấu trừ — topic/T-013).`];
  }
  const block = raw as Record<string, unknown>;
  const rate = block['usSourcedRate'];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate >= 1) {
    problems.push(`${label}: \`usSourcedRate\` phải là số trong (0,1), gặp ${JSON.stringify(rate)}.`);
  }
  const market = block['market'];
  if (typeof market !== 'string' || market.trim() === '') {
    problems.push(`${label}: \`market\` phải là chuỗi không rỗng.`);
  }
  for (const key of ['$reason', '$asOf', '$source'] as const) {
    const value = block[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${label}: thiếu chú thích người đọc \`${key}\` (ghi lý do/ngày/nguồn tại chỗ khai hệ số).`);
    }
  }
  if (typeof block['$asOf'] === 'string' && !ISO_DATE.test(block['$asOf'] as string)) {
    problems.push(`${label}: \`$asOf\` phải là ngày ISO \`YYYY-MM-DD\`, gặp ${JSON.stringify(block['$asOf'])}.`);
  }
  return problems;
}

/** Vấn đề khối `revenueWithholding` trên MỌI channel pack. */
export function channelWithholdingProblems(root: string): string[] {
  const problems: string[] = [];
  for (const path of channelPackFiles(root)) {
    const pack = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    problems.push(...withholdingBlockProblems(path.slice(root.length + 1), pack));
  }
  return problems;
}

/** Toàn bộ vấn đề của mục T-013 — bên gọi (`check-contracts.ts`) gộp vào `problems`. */
export function revenueWithholdingProblems(root: string): string[] {
  return [...channelWithholdingProblems(root), ...unguardedRevenueSites(root)];
}
