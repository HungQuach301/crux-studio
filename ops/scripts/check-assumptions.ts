#!/usr/bin/env node
/**
 * Kiểm sổ giả định (CHARTER 11.1 luật 1).
 *
 * Luật nói: "mỗi phần của charter hoặc code dựa vào một giả định phải ghi mã
 * giả định đó. Nhờ vậy, khi một giả định sai, tìm ra ngay những gì bị ảnh
 * hưởng." Một luật như thế chỉ có giá trị khi nó được kiểm — nếu không, cột
 * "phần phụ thuộc" sẽ trôi khỏi thực tế đúng vào lúc cần nó nhất: lúc một
 * giả định vừa hoá ra sai và phải liệt kê ngay cái gì bị ảnh hưởng.
 *
 * Bốn việc:
 * 1. Mỗi mã trong bảng tổng có một mục đầy đủ ở dưới, và ngược lại.
 * 2. Mỗi mục có đủ bảy phần bắt buộc.
 * 3. Mọi file trong "Phần phụ thuộc" tồn tại, VÀ thật sự nhắc tới mã đó.
 * 4. Mỗi giả định có một mục `VF-<mã>` trong backlog làn verify.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const ledgerPath = join(root, 'docs', 'assumptions.md');
const verifyBacklogPath = join(root, 'ops', 'lanes', 'verify', 'backlog.md');
const problems: string[] = [];

if (!existsSync(ledgerPath)) {
  process.stderr.write('Thiếu docs/assumptions.md (CHARTER mục 11).\n');
  process.exit(1);
}

const ledger = readFileSync(ledgerPath, 'utf8');
const verifyBacklog = existsSync(verifyBacklogPath) ? readFileSync(verifyBacklogPath, 'utf8') : '';

// 1 · Bảng tổng so với các mục chi tiết
const inTable = new Set<string>();
for (const match of ledger.matchAll(/^\| (G\d+) \| /gm)) inTable.add(match[1]!);

const sections = new Map<string, string>();
const headings = [...ledger.matchAll(/^## (G\d+) · (.+)$/gm)];
headings.forEach((heading, index) => {
  const start = heading.index! + heading[0].length;
  const end = index + 1 < headings.length ? headings[index + 1]!.index! : ledger.length;
  sections.set(heading[1]!, ledger.slice(start, end));
});

for (const code of inTable) {
  if (!sections.has(code)) problems.push(`${code} có trong bảng tổng nhưng không có mục chi tiết.`);
}
for (const code of sections.keys()) {
  if (!inTable.has(code)) problems.push(`${code} có mục chi tiết nhưng thiếu dòng trong bảng tổng.`);
}
if (inTable.size === 0) problems.push('Bảng tổng không có giả định nào.');

const REQUIRED_PARTS = [
  '**Nội dung:**',
  '**Độ tin cậy:**',
  '**Phần phụ thuộc:**',
  '**Cách kiểm',
  '**Trạng thái:**',
];

const CONFIDENCE = ['đã kiểm', 'đã kiểm một phần', 'tài liệu nói vậy', 'suy luận', 'sai'];

let dependencyCount = 0;

for (const [code, body] of sections) {
  for (const part of REQUIRED_PARTS) {
    if (!body.includes(part)) problems.push(`${code}: thiếu phần ${part}`);
  }

  // Dự phòng: hoặc có, hoặc nói rõ là chưa có. Im lặng không được chấp nhận —
  // luật 2 cấm xây trên một giả định chưa kiểm mà không có dự phòng viết sẵn.
  if (!/\*\*Dự phòng/.test(body) && !/dự phòng/i.test(body)) {
    problems.push(`${code}: không nói gì về phương án dự phòng.`);
  }

  const confidence = /\*\*Độ tin cậy:\*\*\s*\*?\*?`?([^`*\n]+)`?/.exec(body)?.[1]?.trim();
  if (confidence && !CONFIDENCE.some((c) => confidence.includes(c)) && !confidence.includes('theo từng mục')) {
    problems.push(`${code}: độ tin cậy "${confidence}" không thuộc thang đã khai.`);
  }

  // 3 · Truy vết: file được liệt kê phải tồn tại và phải nhắc tới mã.
  const depLine = /\*\*Phần phụ thuộc:\*\*(.+)/.exec(body)?.[1] ?? '';
  for (const match of depLine.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1]!;
    if (!/[/.]/.test(candidate) || candidate.startsWith('http')) continue; // "mục 7", "I4" …
    dependencyCount += 1;
    const path = join(root, candidate);
    if (!existsSync(path)) {
      problems.push(`${code}: phần phụ thuộc "${candidate}" không tồn tại.`);
      continue;
    }
    const content = readFileSync(path, 'utf8');
    if (!new RegExp(`\\b${code}\\b`).test(content)) {
      problems.push(
        `${code}: "${candidate}" được liệt kê là phần phụ thuộc nhưng KHÔNG nhắc tới ${code}. ` +
          'Ghi mã giả định ngay trong file đó, để khi giả định sai thì tìm ra ngay cái gì bị ảnh hưởng (CHARTER 11.1 luật 1).',
      );
    }
  }

  // 4 · Có mục kiểm trong backlog làn verify.
  if (!verifyBacklog.includes(`VF-${code}`)) {
    problems.push(`${code}: thiếu mục \`VF-${code}\` trong ops/lanes/verify/backlog.md.`);
  }
}

if (problems.length > 0) {
  process.stderr.write(`Sổ giả định có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Sổ giả định ok: ${sections.size} giả định, ${dependencyCount} liên kết phần phụ thuộc đã truy vết được.\n`,
);
