/**
 * Cổng mã trùng — mục `platform/P-058`, vế **nguyên nhân kích** của `KF-042`.
 *
 * Hai nhóm bài, và chúng canh hai hướng ngược nhau:
 *
 * - **bài tái hiện lỗi** (bất biến **I2**): hình dạng đã đo được trên `main`
 *   `3ecec2d` — hai `## KF-016`, hai `## KF-041`, hai `### P-028` — phải làm
 *   cổng **đỏ**;
 * - **ca âm**: mọi cách mà một mã được nhắc lại mà **không** phải một mục
 *   thứ hai. Nhóm này quan trọng hơn, vì cổng này chặn merge trên một file
 *   mà mọi làn đều ghi vào: một luật quá rộng chặn oan mọi PR.
 *
 * Ca `### P-028` dựng từ **fixture**, không neo vào cây: cặp thật đã hết khi
 * `#274` merge (`2026-09-26T13:48:25Z`), nên một bài neo vào cây sẽ tự tắt
 * tiếng đúng lúc nó vừa xanh — và một bài kiểm tự tắt tiếng là một bài kiểm
 * không còn canh gì.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DuplicateHeadingInputError,
  duplicateHeadings,
  renderHeadingScans,
  type HeadingScan,
} from '../scripts/duplicate-headings.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel: string): string => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

// ── Bài tái hiện lỗi — ba hình dạng thật đã đo được ──────────────────────

test('KF-047 (trước là KF-016): hai khối `## <mã>` trong cùng file → ĐỎ, kèm số dòng của từng lần', () => {
  // Hình dạng thật trên `main` `3ecec2d`: dòng 1301 và 1408.
  const content = [
    '# Sổ chỗ hỏng',
    '',
    '## KF-016 · `integrator-resolve.ts` trả `resolved` cho một cây không parse được',
    '',
    'thân khối một',
    '',
    '## KF-016 · Hai khoá `env:` trong một step làm cả workflow thành YAML không hợp lệ',
    '',
    'thân khối hai',
  ].join('\n');

  assert.deepEqual(duplicateHeadings(content, 2), [{ id: 'KF-016', lines: [3, 7] }]);
});

test('KF-048 (trước là KF-041): cặp thứ hai cũng bắt được, và HAI cặp trong một file ra HAI hàng', () => {
  const content = [
    '## KF-041 · Trường `- hold:` bị đọc cắt giữa câu',
    '## KF-016 · union nuốt dòng đóng khối',
    '## KF-042 · claimCheck fail-open',
    '## KF-016 · hai khoá `env:`',
    '## KF-041 · nhánh chờ step0-pending',
  ].join('\n');

  assert.deepEqual(duplicateHeadings(content, 2), [
    { id: 'KF-016', lines: [2, 4] },
    { id: 'KF-041', lines: [1, 5] },
  ]);
});

test('`### P-028` × 2 — ca của `duplicateIds`, dựng từ FIXTURE chứ không neo vào cây', () => {
  // Cặp thật đã hết khi `#274` merge. Bài này giữ ca sống sau đó.
  const content = [
    '# Backlog làn platform',
    '',
    '### P-028 · smoke-workflows.yml hỏng YAML',
    '- status: done',
    '',
    '### P-057 · bộ dò cross-lane',
    '- status: review',
    '',
    '### P-028 · một mục khác lại lấy cùng mã',
    '- status: ready',
  ].join('\n');

  assert.deepEqual(duplicateHeadings(content, 3), [{ id: 'P-028', lines: [3, 9] }]);
});

// ── Ca âm — mọi cách một mã được NHẮC LẠI mà không phải một mục thứ hai ──

test('ca âm · cây đã dọn thì sạch', () => {
  const content = ['## KF-047 · a', '## KF-048 · b', '## KF-016 · c'].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

test('ca âm · hai mã hơn nhau ĐÚNG một chữ là hai mã khác nhau', () => {
  const content = [
    '### V-004 · spike canvas',
    '### V-004b · spike canvas, sóng hai',
    '### P-006 · ruleset',
    '### P-0061 · không phải P-006',
  ].join('\n');
  assert.deepEqual(duplicateHeadings(content, 3), []);
});

test('ca âm · mã nhắc trong CÂU VĂN không phải một tiêu đề', () => {
  // Chính `KF-042` và mục `P-058` kể lại các cặp trùng bằng tên. Một phép
  // `grep` cả file sẽ làm đỏ đúng hai chỗ viết ra cổng này.
  const content = [
    '## KF-042 · claimCheck fail-open',
    '',
    'Cùng cây còn **hai** `## KF-016` và **hai** `## KF-041` — xem mục `platform/P-058`.',
    'Một dòng nữa nhắc KF-016 và KF-016 lần thứ ba, vẫn chỉ là câu văn.',
    '',
    '## KF-043 · nhịp tim',
  ].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

test('ca âm · mã nằm trong khối ``` không phải một tiêu đề — kể cả khi trông y hệt', () => {
  const content = [
    '## KF-042 · claimCheck fail-open',
    '',
    'Bản vá dán vào đây:',
    '',
    '```markdown',
    '## KF-042 · một tiêu đề GIẢ nằm trong khối lệnh',
    '## KF-042 · và một cái nữa',
    '```',
    '',
    '## KF-043 · nhịp tim',
  ].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

test('ca âm · khối ``` chỉ đóng bằng CÙNG loại dấu — ~~~ không đóng ```', () => {
  const content = [
    '```',
    '## KF-042 · trong khối',
    '~~~',
    '## KF-042 · vẫn trong khối, vì ~~~ không đóng ```',
    '```',
    '## KF-042 · ra ngoài rồi — đây là lần đầu tiên được đếm',
  ].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

test('ca âm · dòng TRÍCH LẠI `> ## …` không phải tiêu đề', () => {
  const content = [
    '## KF-042 · claimCheck fail-open',
    '> ## KF-042 · trích lại nguyên văn tiêu đề của chính nó',
    '> ## KF-042 · và một lần nữa',
  ].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

test('ca âm · cấp tiêu đề KHÁC không lẫn vào nhau — `##` không khớp `###`', () => {
  const content = [
    '## KF-100 · cấp hai',
    '### KF-100 · cấp ba, cùng mã',
    '### KF-100 · cấp ba lần nữa',
  ].join('\n');
  // Hỏi cấp 2 → chỉ thấy một khối cấp 2 → sạch.
  assert.deepEqual(duplicateHeadings(content, 2), []);
  // Hỏi cấp 3 → thấy hai khối cấp 3 → đỏ, và KHÔNG đếm dòng cấp 2 vào.
  assert.deepEqual(duplicateHeadings(content, 3), [{ id: 'KF-100', lines: [2, 3] }]);
});

test('ca âm · `#` không có khoảng trắng phía sau không phải tiêu đề', () => {
  const content = ['##KF-042 · dính liền', '##KF-042 · dính liền lần hai', '## KF-042 · thật'].join('\n');
  assert.deepEqual(duplicateHeadings(content, 2), []);
});

// ── Đầu vào hỏng thì NÉM, không nuốt thành "sạch" ────────────────────────

test('cấp tiêu đề ngoài 1..6 thì NÉM — "không trả lời được" khác "sạch"', () => {
  for (const level of [0, 7, -1, 2.5, Number.NaN]) {
    assert.throws(() => duplicateHeadings('## KF-001 · a\n## KF-001 · b', level), DuplicateHeadingInputError);
  }
});

// ── Cây THẬT — cổng phải xanh sau bản dọn của mục này ────────────────────

test('trên cây THẬT: `ops/known-failures.md` và mọi backlog đều không còn mã trùng', () => {
  const scans: HeadingScan[] = [
    { file: 'ops/known-failures.md', level: 2, duplicates: duplicateHeadings(read('ops/known-failures.md'), 2) },
  ];
  for (const lane of ['assembly', 'audio', 'editorial', 'integration', 'kernel', 'platform', 'release', 'topic', 'verify', 'visual']) {
    const rel = `ops/lanes/${lane}/backlog.md`;
    scans.push({ file: rel, level: 3, duplicates: duplicateHeadings(read(rel), 3) });
  }
  const bad = scans.filter((scan) => scan.duplicates.length > 0);
  assert.deepEqual(bad, [], `còn mã trùng:\n${renderHeadingScans(scans)}`);
  assert.equal(scans.length, 11, 'phải soát đúng 11 file — 10 làn cộng sổ chỗ hỏng');
});

test('cây THẬT giữ đúng hai khối đã đổi số, và KHÔNG còn khối mang số cũ ở cấp tiêu đề', () => {
  const lines = read('ops/known-failures.md').split('\n');
  const heads = (id: string): number => lines.filter((line) => line.startsWith(`## ${id} `)).length;
  assert.equal(heads('KF-047'), 1, '`KF-047` (hai khoá `env:`) phải có đúng một khối');
  assert.equal(heads('KF-048'), 1, '`KF-048` (nhánh chờ `step0-pending`) phải có đúng một khối');
  assert.equal(heads('KF-016'), 1, '`KF-016` còn lại đúng khối union-cú-pháp');
  assert.equal(heads('KF-041'), 1, '`KF-041` còn lại đúng khối `- hold:`');
});

// ── Bản in ───────────────────────────────────────────────────────────────

test('renderHeadingScans in CẢ khi sạch, và nêu số dòng khi bẩn', () => {
  const clean = renderHeadingScans([{ file: 'a.md', level: 2, duplicates: [] }]);
  assert.match(clean, /Mã trùng: 0/, 'sạch cũng phải in ra — im lặng ở đây là thứ `Z15` cấm');

  const dirty = renderHeadingScans([
    { file: 'ops/known-failures.md', level: 2, duplicates: [{ id: 'KF-016', lines: [1301, 1408] }] },
  ]);
  assert.match(dirty, /KF-016/);
  assert.match(dirty, /1301, 1408/, 'số dòng là phần bắt buộc: thiếu nó thì không biết đổi cái nào');
  assert.match(dirty, /ops\/known-failures\.md/);
});

test('phép đọc cây thật trỏ đúng gốc kho — nếu không thì mọi bài "cây THẬT" ở trên là giả', () => {
  // Không có lưới này thì một `read()` trỏ sai chỗ sẽ NÉM, nhưng một `read()`
  // trỏ vào một cây khác lại lặng lẽ xanh — đúng hình dạng nhóm Z.
  assert.match(read('package.json'), /"name": "crux-studio"/);
  assert.equal(root.endsWith('/'), true, '`root` phải là một thư mục');
});
