/**
 * `ops/scripts/update-metrics.ts` — cơ chế của mục `I-002`.
 *
 * Chỉ kiểm các hàm thuần (đếm và chỉnh bảng markdown). Lớp gọi `gh` trong
 * `main()` không kiểm ở đây — cùng lý do với `reap-abandoned-drafts.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCodeFile,
  countCodeFiles,
  countDoneItems,
  totalDoneItems,
  architectureRatio,
  greenRatioPercent,
  upsertTableRow,
  formatArchitectureRow,
  formatStabilityRow,
  updateArchitectureTable,
  updateStabilityTable,
} from '../scripts/update-metrics.ts';

test('isCodeFile: .ts tính, .test.ts không tính', () => {
  assert.equal(isCodeFile('ops/scripts/update-metrics.ts'), true);
  assert.equal(isCodeFile('ops/test/update-metrics.test.ts'), false);
  assert.equal(isCodeFile('kernel/contracts/envelope.schema.json'), false);
  assert.equal(isCodeFile('README.md'), false);
});

test('countCodeFiles: đếm đúng, bỏ qua file test và file không phải .ts', () => {
  const paths = [
    'ops/scripts/a.ts',
    'ops/scripts/a.test.ts',
    'ops/scripts/b.ts',
    'docs/spec/x.md',
    'kernel/contracts/y.schema.json',
  ];
  assert.equal(countCodeFiles(paths), 2);
});

test('countDoneItems: chỉ đếm dòng "- status: done" nguyên văn', () => {
  const content = [
    '### A-001',
    '- status: done',
    '### A-002',
    '- status: ready',
    '### A-003',
    '- status: done',
    '### A-004',
    '- status: review',
  ].join('\n');
  assert.equal(countDoneItems(content), 2);
});

test('countDoneItems: không khớp "status: done" nằm trong văn xuôi', () => {
  const content = 'Mục này rồi sẽ chuyển sang - status: done khi xong, nhưng chưa.';
  assert.equal(countDoneItems(content), 0);
});

test('totalDoneItems: cộng dồn nhiều file backlog', () => {
  const files = ['- status: done\n', '- status: ready\n- status: done\n- status: done\n', ''];
  assert.equal(totalDoneItems(files), 3);
});

test('architectureRatio: chia tròn, doneItems = 0 trả null', () => {
  assert.equal(architectureRatio(35, 1), 35);
  assert.equal(architectureRatio(10, 3), 3);
  assert.equal(architectureRatio(26, 0), null);
});

test('greenRatioPercent: (merged - revert) / merged, merged = 0 trả null', () => {
  assert.equal(greenRatioPercent(14, 0), 100);
  assert.equal(greenRatioPercent(10, 1), 90);
  assert.equal(greenRatioPercent(0, 0), null);
});

test('upsertTableRow: thêm dòng mới khi chưa có key trùng', () => {
  const content = [
    '## Sức khoẻ kiến trúc',
    '',
    '| Ngày | File code | Mục `done` | File / mục | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-09-20 | 26 | 0 | — | Đợt 0 |',
    '',
    'Đoạn văn sau bảng.',
  ].join('\n');

  const updated = upsertTableRow(content, '## Sức khoẻ kiến trúc', 0, '2026-09-21', [
    '2026-09-21',
    '35',
    '1',
    '35',
    'ghi chú mới',
  ]);
  const lines = updated.split('\n');

  assert.equal(lines.length, 8, 'thêm đúng một dòng');
  assert.match(updated, /\| 2026-09-20 \| 26 \| 0 \| — \| Đợt 0 \|/, 'dòng cũ còn nguyên');
  assert.match(updated, /\| 2026-09-21 \| 35 \| 1 \| 35 \| ghi chú mới \|/, 'dòng mới đã thêm');
  assert.match(updated, /Đoạn văn sau bảng\.$/, 'nội dung sau bảng còn nguyên, không bị đè');
});

test('upsertTableRow: thay dòng cũ khi key đã trùng, không nhân đôi', () => {
  const content = [
    '## Sức khoẻ kiến trúc',
    '| Ngày | File code | Mục `done` | File / mục | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-09-20 | 26 | 0 | — | Đợt 0 |',
    '| 2026-09-21 | 35 | 1 | 35 | lần chạy trước |',
  ].join('\n');

  const updated = upsertTableRow(content, '## Sức khoẻ kiến trúc', 0, '2026-09-21', [
    '2026-09-21',
    '36',
    '1',
    '36',
    'lần chạy sau',
  ]);
  const lines = updated.split('\n');

  assert.equal(lines.length, 5, 'không thêm dòng, chỉ thay');
  assert.match(updated, /\| 2026-09-21 \| 36 \| 1 \| 36 \| lần chạy sau \|/);
  assert.doesNotMatch(updated, /lần chạy trước/);
});

test('upsertTableRow: không thấy heading thì trả nguyên văn, không đoán', () => {
  const content = '## Một mục khác\n\nkhông có bảng nào ở đây.';
  const updated = upsertTableRow(content, '## Không tồn tại', 0, 'x', ['x']);
  assert.equal(updated, content);
});

test('formatArchitectureRow: cột tỷ lệ là "—" khi chưa có mục done', () => {
  assert.deepEqual(formatArchitectureRow('2026-09-20', 26, 0, 'ghi chú'), [
    '2026-09-20',
    '26',
    '0',
    '—',
    'ghi chú',
  ]);
});

test('formatStabilityRow: có % khi merged > 0', () => {
  const row = formatStabilityRow('2026-09-20 → 2026-09-21', 14, 0, 'không lần nào phải revert');
  assert.deepEqual(row, ['2026-09-20 → 2026-09-21', '14', '0', '100% (không lần nào phải revert)']);
});

test('updateArchitectureTable + updateStabilityTable: cùng hoạt động trên nội dung thật của ops/metrics.md', () => {
  const content = [
    '# 🤖 Thước đo nhà máy',
    '',
    '## Sức khoẻ kiến trúc',
    '',
    '| Ngày | File code | Mục `done` | File / mục | Ghi chú |',
    '|---|---|---|---|---|',
    '| 2026-09-20 | 26 | 0 | — | Đợt 0, T1 và T2. |',
    '',
    'Ghi chú giữa hai bảng.',
    '',
    '## Độ ổn định của `main`',
    '',
    '| Tuần | Lần merge | Lần revert | Tỷ lệ `main` xanh |',
    '|---|---|---|---|',
    '| — | — | — | — |',
    '',
    '## Phần khác',
  ].join('\n');

  let updated = updateArchitectureTable(content, '2026-09-21', 35, 1, 'ghi chú kiến trúc');
  updated = updateStabilityTable(updated, '2026-09-20 → 2026-09-21', 14, 0, 'không lần nào phải revert');

  assert.match(updated, /\| 2026-09-21 \| 35 \| 1 \| 35 \| ghi chú kiến trúc \|/);
  assert.match(updated, /\| 2026-09-20 → 2026-09-21 \| 14 \| 0 \| 100% \(không lần nào phải revert\) \|/);
  // Dòng đặt ("— | — | — | —") của bảng ổn định vẫn còn, vì key của nó ("—") khác key mới.
  assert.match(updated, /\| — \| — \| — \| — \|/);
  assert.match(updated, /## Phần khác$/);
});
