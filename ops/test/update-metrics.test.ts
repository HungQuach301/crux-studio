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
  replaceOnlyRow,
  formatArchitectureRow,
  formatStabilityRow,
  updateArchitectureTable,
  updateStabilityTable,
  sumCostUsd,
  linesSince,
  budgetPercent,
  formatCostRow,
  updateCostTable,
  BUDGET_LOW_USD,
} from '../scripts/update-metrics.ts';
import type { RunLogLine } from '@crux/kernel';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

test('replaceOnlyRow: thay dòng đặt chỗ duy nhất', () => {
  const content = [
    '## Độ ổn định của `main`',
    '| Tuần | Lần merge | Lần revert | Tỷ lệ `main` xanh |',
    '|---|---|---|---|',
    '| — | — | — | — |',
  ].join('\n');

  const updated = replaceOnlyRow(content, '## Độ ổn định của `main`', [
    '2026-09-20 → 2026-09-21',
    '14',
    '0',
    '100% (không lần nào phải revert)',
  ]);
  const lines = updated.split('\n');

  assert.equal(lines.length, 4, 'vẫn đúng một dòng dữ liệu');
  assert.doesNotMatch(updated, /\| — \| — \| — \| — \|/);
  assert.match(updated, /\| 2026-09-20 → 2026-09-21 \| 14 \| 0 \| 100% \(không lần nào phải revert\) \|/);
});

test('replaceOnlyRow: KHÔNG phình khi nhãn cột đầu đổi mỗi lần gọi (bug đã sửa)', () => {
  // Đây chính là ca gây lỗi: bảng "Độ ổn định" là số cộng dồn từ khi bắt
  // đầu tới hôm nay, nên nhãn "startDate → today" đổi mỗi ngày dù số liệu
  // không đổi. `upsertTableRow` khớp theo nhãn đó sẽ không bao giờ trùng
  // khoá cũ và cứ thêm dòng mới mỗi ngày. `replaceOnlyRow` không khớp theo
  // khoá — nó luôn ghi đè đúng dòng duy nhất, bất kể nhãn đổi thế nào.
  const day1 = [
    '## Độ ổn định của `main`',
    '| Tuần | Lần merge | Lần revert | Tỷ lệ `main` xanh |',
    '|---|---|---|---|',
    '| — | — | — | — |',
  ].join('\n');

  const afterDay1 = replaceOnlyRow(day1, '## Độ ổn định của `main`', [
    '2026-09-01 → 2026-09-21',
    '14',
    '0',
    '100% (không lần nào phải revert)',
  ]);
  const afterDay2 = replaceOnlyRow(afterDay1, '## Độ ổn định của `main`', [
    '2026-09-01 → 2026-09-22',
    '15',
    '0',
    '100% (không lần nào phải revert)',
  ]);

  const dataLines = afterDay2.split('\n').filter((line) => line.trim().startsWith('| 2026'));
  assert.equal(dataLines.length, 1, 'hai lần gọi ở hai "ngày" khác nhau vẫn chỉ để lại một dòng');
  assert.match(afterDay2, /2026-09-01 → 2026-09-22/);
});

test('replaceOnlyRow: gộp về một dòng nếu bảng lỡ có nhiều hơn một dòng từ trước', () => {
  const content = [
    '## Độ ổn định của `main`',
    '| Tuần | Lần merge | Lần revert | Tỷ lệ `main` xanh |',
    '|---|---|---|---|',
    '| 2026-09-01 → 2026-09-20 | 13 | 0 | 100% |',
    '| 2026-09-01 → 2026-09-21 | 14 | 0 | 100% |',
  ].join('\n');

  const updated = replaceOnlyRow(content, '## Độ ổn định của `main`', ['2026-09-01 → 2026-09-22', '15', '0', '100%']);
  const dataLines = updated.split('\n').filter((line) => line.trim().startsWith('|') && !line.includes('Tuần') && !line.includes('---'));

  assert.equal(dataLines.length, 1);
  assert.match(updated, /2026-09-01 → 2026-09-22/);
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
  // Dòng đặt chỗ ("— | — | — | —") của bảng ổn định đã bị THAY, không còn (khác bảng kiến trúc — đó là nhật ký, cái này là trạng thái).
  assert.doesNotMatch(updated, /\| — \| — \| — \| — \|/);
  assert.match(updated, /## Phần khác$/);
});


// --- Bảng "Chi phí" — bất biến I8 sau quyết định `D-C04` ---

function logLine(at: string, costUsd: number, extra: Partial<RunLogLine> = {}): RunLogLine {
  return { at, lane: 'platform', kind: 'lane', ref: 'platform/P-018', status: 'ok', durationMs: 0, costUsd, ...extra };
}

test('sumCostUsd: cộng và làm tròn sai số dấu phẩy động', () => {
  assert.equal(sumCostUsd([]), 0);
  assert.equal(sumCostUsd([logLine('2026-09-21T00:00:00.000Z', 0.1), logLine('2026-09-21T01:00:00.000Z', 0.2)]), 0.3);
  assert.equal(sumCostUsd([logLine('2026-09-21T00:00:00.000Z', 12.5), logLine('2026-09-21T01:00:00.000Z', 7.25)]), 19.75);
});

test('linesSince: lấy từ mốc trở đi, KHÔNG cắt cận trên', () => {
  const lines = [
    logLine('2026-09-20T23:00:00.000Z', 1),
    logLine('2026-09-21T00:00:00.000Z', 2),
    logLine('2026-09-21T12:00:00.000Z', 4),
    // Dòng "ở tương lai" so với đồng hồ lúc chạy — vẫn phải được tính.
    logLine('2099-01-01T00:00:00.000Z', 8),
  ];
  const picked = linesSince(lines, '2026-09-21T00:00:00.000Z');
  assert.deepEqual(picked.map((l) => l.costUsd), [2, 4, 8]);
  assert.equal(sumCostUsd(picked), 14);
});

test('budgetPercent: lấy cận dưới của ngân sách học, ngân sách 0 thì không chia', () => {
  assert.equal(BUDGET_LOW_USD, 600);
  assert.equal(budgetPercent(0), 0);
  assert.equal(budgetPercent(300), 50);
  assert.equal(budgetPercent(480), 80);
  assert.equal(budgetPercent(10, 0), 0);
});

test('updateCostTable: mỗi ngày một dòng, chạy lại trong ngày thì ghi đè', () => {
  const content = [
    '## Chi phí',
    '',
    '| Ngày | Chi phí 24h | Tích luỹ | % ngân sách học |',
    '|---|---|---|---|',
    '| 2026-09-20 | 0 | 0 | 0% |',
    '',
  ].join('\n');

  const once = updateCostTable(content, '2026-09-21', 1.5, 1.5);
  assert.ok(once.includes('| 2026-09-21 | 1.5 | 1.5 | 0% |'));
  assert.ok(once.includes('| 2026-09-20 | 0 | 0 | 0% |'), 'dòng ngày cũ phải ở lại — bảng này là nhật ký');

  const twice = updateCostTable(once, '2026-09-21', 2, 2);
  assert.equal(twice.split('2026-09-21').length - 1, 1, 'chạy lại trong cùng ngày không được thêm dòng thứ hai');
  assert.ok(twice.includes('| 2026-09-21 | 2 | 2 | 0% |'));
});

test('formatCostRow: phần trăm ngân sách tính từ chi phí TÍCH LUỸ', () => {
  assert.deepEqual(formatCostRow('2026-09-21', 30, 300), ['2026-09-21', '30', '300', '50%']);
});


test('sumCostUsd: BỎ QUA dòng tổng hợp — một tập không được tính tiền hai lần', () => {
  // Đúng hình dạng `pnpm run:episode` ghi ra: sáu dòng `stage` cộng một
  // dòng `lane` mang tổng của chúng.
  const stages = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5].map((c, i) =>
    logLine(`2026-09-21T0${i}:00:00.000Z`, c, { kind: 'stage', ref: `ep-0001/w${i}` }),
  );
  const chain = logLine('2026-09-21T06:00:00.000Z', 3, { ref: 'ep-0001/full-chain', rollup: true });

  assert.equal(sumCostUsd([...stages, chain]), 3, 'tập tốn 3 USD phải ra 3, không phải 6');
  // Dòng làn của một mục backlog KHÔNG phải tổng hợp — vẫn phải cộng.
  assert.equal(sumCostUsd([...stages, chain, logLine('2026-09-21T07:00:00.000Z', 2)]), 5);
});

test('ngân sách: con số trong update-metrics và trong watchdog.yml phải bằng nhau', () => {
  // Hai nguồn sự thật cho một con số tiền. Không gộp được (workflow không
  // đọc TypeScript), nên khoá ở đây để lần lệch tiếp theo là ĐỎ, không im.
  const workflow = readFileSync(join(process.cwd(), 'ops', 'workflows', 'watchdog.yml'), 'utf8');
  const match = workflow.match(/^\s*BUDGET=(\d+)\s*$/m);
  assert.ok(match, 'không tìm thấy `BUDGET=` trong ops/workflows/watchdog.yml');
  assert.equal(
    Number(match![1]),
    BUDGET_LOW_USD,
    'ngân sách trong watchdog.yml lệch với BUDGET_LOW_USD — bản tin và cảnh báo sẽ nói hai điều khác nhau',
  );
});

test('budgetPercent: CẮT CỤT, khớp `awk printf "%d"` của watchdog', () => {
  // 479.9/600 = 79.98% — làm tròn ra 80 (bản tin báo chạm ngưỡng) trong
  // khi watchdog cắt cụt ra 79 (chưa báo động). Hai số cạnh nhau nói hai
  // điều khác nhau.
  assert.equal(budgetPercent(479.9), 79);
  assert.equal(budgetPercent(485.99), 80);
  assert.equal(budgetPercent(600), 100);
});

test('updateCostTable: không tìm thấy bảng thì NÉM, không im lặng trả về nguyên văn', () => {
  assert.throws(
    () => updateCostTable('## Mục khác\n\nkhông có bảng nào\n', '2026-09-21', 1, 1),
    /Không tìm thấy bảng/,
  );
});
