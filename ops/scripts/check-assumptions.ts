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
 * Năm việc:
 * 1. Mỗi mã trong bảng tổng có một mục đầy đủ ở dưới, và ngược lại.
 * 2. Mỗi mục có đủ bảy phần bắt buộc.
 * 3. Mọi file trong "Phần phụ thuộc" tồn tại, VÀ thật sự nhắc tới mã đó.
 * 4. Mỗi giả định có một mục `VF-<mã>` trong backlog làn verify.
 * 5. Mục nào khai `**Kiểm tự động:**` thì mã bài kiểm đó phải có thật trong
 *    `ops/scripts/recheck-assumptions.ts` (mục `I-003`). Không có luật này
 *    thì sổ khai một bài kiểm đã bị đổi tên hay xoá mà vẫn xanh — hỏng mà
 *    mọi chỉ báo đều xanh, đúng nhóm Z trong `ops/known-failures.md`.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sliceLedgerSections } from './ledger-sections.ts';
import { AUTO_CHECKS, AUTO_CHECK_IDS } from './recheck-assumptions.ts';

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

// Ranh giới mục do `ledger-sections.ts` sinh ra, không cắt tại chỗ: cắt mục
// cuối tới hết file làm chữ của phần "Cách thêm một giả định" trôi vào thân
// mục và mang theo chữ khoá của nó (rà soát **Z12**, `ops/known-failures.md`).
const sections = new Map<string, string>(
  sliceLedgerSections(ledger).map((section) => [section.code, section.body]),
);

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
/** Mã bài kiểm → giả định đã khai nó. Dùng để bắt chiều ngược ở cuối. */
const declaredChecks = new Map<string, string>();

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

  // 5 · Bài kiểm tự động được khai phải tồn tại, VÀ phải là bài kiểm của
  // đúng giả định này. `recheck-assumptions.ts` tìm bài kiểm theo `id`, nên
  // khai nhầm mã sang giả định khác thì nó chạy bài kiểm của G khác dưới tên
  // G này, và issue `[QĐ]` liệt kê phần phụ thuộc của nhầm giả định.
  const autoCheck = /\*\*Kiểm tự động:\*\*\s*`([^`]+)`/.exec(body)?.[1]?.trim();
  if (autoCheck) {
    declaredChecks.set(autoCheck, code);
    const check = AUTO_CHECKS.find((candidate) => candidate.id === autoCheck);
    if (!check) {
      problems.push(
        `${code}: khai bài kiểm tự động \`${autoCheck}\` nhưng ops/scripts/recheck-assumptions.ts không đăng ký mã đó. ` +
          `Các mã đang có: ${AUTO_CHECK_IDS.join(', ')}.`,
      );
    } else if (check.code !== code) {
      problems.push(
        `${code}: khai bài kiểm \`${autoCheck}\`, nhưng bài kiểm đó là của ${check.code}, không phải của ${code}.`,
      );
    }
  }
}

// 5b · Chiều ngược: một bài kiểm đăng ký mà không mục nào khai thì nó KHÔNG
// BAO GIỜ chạy, và không ai báo. Đúng dạng "sổ và code trôi khỏi nhau" mà
// luật 5 sinh ra để ngăn — chặn cả hai chiều thì mới kín.
for (const check of AUTO_CHECKS) {
  if (!declaredChecks.has(check.id)) {
    problems.push(
      `Bài kiểm \`${check.id}\` (${check.code}) có trong ops/scripts/recheck-assumptions.ts nhưng không mục nào ` +
        'trong sổ khai nó, nên nó không bao giờ chạy. Thêm `**Kiểm tự động:**` vào mục tương ứng, hoặc bỏ bài kiểm.',
    );
  }
}

if (problems.length > 0) {
  process.stderr.write(`Sổ giả định có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Sổ giả định ok: ${sections.size} giả định, ${dependencyCount} liên kết phần phụ thuộc đã truy vết được.\n`,
);
