/**
 * Rà soát **Z12** — `ops/known-failures.md`, nhóm Z.
 *
 * Mỗi bài dưới đây là một **test âm**: nó phải ĐỎ trên bản cắt mục cũ (mục
 * cuối kéo tới hết file) và xanh trên bản có ranh giới. Một luật chỉ có giá
 * trị khi nó đỏ đúng lúc phải đỏ — bài học của KF-003.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sliceLedgerSections } from '../scripts/ledger-sections.ts';
import { parseLedger } from '../scripts/recheck-assumptions.ts';

const root = join(import.meta.dirname, '..', '..');

test('Z12 · phần chữ sau một heading `##` khác KHÔNG trôi vào thân mục trước nó', () => {
  const ledger = [
    '## G1 · Mục có dự phòng',
    '- **Dự phòng:** có sẵn.',
    '',
    '## G2 · Mục KHÔNG nói gì về dự phòng',
    '- **Nội dung:** một câu.',
    '',
    '## Cách thêm một giả định',
    '',
    '4. Nếu giả định chưa có dự phòng viết sẵn thì không được xây gì lên trên nó.',
    '',
  ].join('\n');

  const sections = sliceLedgerSections(ledger);
  const g2 = sections.find((section) => section.code === 'G2');

  assert.ok(g2, 'G2 phải được tách ra thành một mục');
  // Đây là chính chỗ hỏng: bản cũ cắt G2 tới HẾT FILE, nên chữ "dự phòng"
  // của phần hướng dẫn trôi vào thân G2 và làm `pnpm assumptions` xanh sai.
  assert.ok(
    !/dự phòng/i.test(g2.body),
    'thân G2 không được chứa chữ "dự phòng" của phần hướng dẫn nằm sau nó',
  );
  assert.ok(/\*\*Dự phòng:\*\*/.test(sections.find((s) => s.code === 'G1')!.body));
});

test('Z12 · một dấu `---` cũng kết thúc mục', () => {
  const ledger = [
    '## G9 · Mục thiếu dự phòng',
    '- **Nội dung:** một câu.',
    '',
    '---',
    '',
    'Văn bản chung của cả sổ, có nhắc dự phòng nhưng không thuộc mục nào.',
    '',
  ].join('\n');

  const g9 = sliceLedgerSections(ledger).find((section) => section.code === 'G9')!;
  assert.ok(!/dự phòng/i.test(g9.body), 'thân mục phải dừng ở dấu `---`');
});

test('Z12 · mục cuối cùng không còn ranh giới nào thì vẫn lấy tới hết file', () => {
  const ledger = ['## G3 · Mục cuối', '- **Dự phòng:** có sẵn.', 'dòng chót.'].join('\n');
  const g3 = sliceLedgerSections(ledger).find((section) => section.code === 'G3')!;
  assert.match(g3.body, /dòng chót\./);
});

test('Z12 · ca đã xảy ra thật: G17 của sổ hiện tại không nuốt phần "Cách thêm một giả định"', () => {
  // Không dựng ca giả — đọc chính `docs/assumptions.md`. Trên bản cắt cũ,
  // phần hướng dẫn nằm giữa G17 và G18 trôi trọn vào thân G17.
  const ledger = readFileSync(join(root, 'docs', 'assumptions.md'), 'utf8');
  const g17 = sliceLedgerSections(ledger).find((section) => section.code === 'G17');

  assert.ok(g17, 'sổ phải có mục G17');
  assert.ok(
    !g17.body.includes('Cách thêm một giả định'),
    'thân G17 không được chứa phần hướng dẫn cuối nhóm',
  );
});

test('Z16 · hai bên đọc sổ dùng CHUNG một phép cắt, không mỗi bên một bản chép', () => {
  const ledger = readFileSync(join(root, 'docs', 'assumptions.md'), 'utf8');
  const fromSlicer = sliceLedgerSections(ledger).map((section) => section.code);
  const fromRecheck = parseLedger(ledger).map((entry) => entry.code);

  assert.deepEqual(fromRecheck, fromSlicer);
  assert.ok(fromSlicer.length > 0, 'sổ phải có ít nhất một mục');
});
