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
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/**
 * Chạy tầng CLI **thật** trên một cây dựng tạm. Không có nó thì bốn phép
 * phá thử sống sót được — đổi `exit(1)` thành `exit(0)`, đổi `exit(2)`
 * thành `exit(0)`, bỏ `backlog.md` khỏi `targets`, soát backlog sai cấp —
 * và cổng lặng lẽ thôi đỏ mà không chỉ báo nào thấy. Đúng nhóm **Z** mà
 * chính mục `platform/P-058` sinh ra để chặn; vòng soát ngữ cảnh sạch
 * (bước 6) bắt được.
 *
 * CLI suy gốc kho từ `import.meta.url`, nên cây tạm phải có một bản sao của
 * script ở đúng chỗ tương đối (`<gốc>/ops/scripts/`).
 */
function runCli(root: string): { status: number; stdout: string; stderr: string } {
  const script = join(root, 'ops', 'scripts', 'duplicate-headings.ts');
  mkdirSync(join(root, 'ops', 'scripts'), { recursive: true });
  writeFileSync(script, readFileSync(new URL('../scripts/duplicate-headings.ts', import.meta.url), 'utf8'));
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  return { status: run.status ?? -1, stdout: run.stdout, stderr: run.stderr };
}

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

test('ca âm · khối ``` chỉ đóng bằng CÙNG loại dấu — ~~~ không khép được nó', () => {
  // Fixture phải có HAI tiêu đề cùng mã nằm SAU dòng `~~~` và TRƯỚC dấu
  // ``` đóng. Bản đầu chỉ có một tiêu đề lọt ra ngoài, nên cả luật đúng lẫn
  // luật "đóng bằng dấu bất kỳ" đều ra `[]` và phép phá thử sống sót — vòng
  // soát ngữ cảnh sạch bắt được. Nay bản đột biến ra hai dòng, bài này đỏ.
  const content = [
    '```',
    '## KF-042 · trong khối',
    '~~~',
    '## KF-042 · vẫn trong khối — `~~~` không khép được một khối mở bằng ```',
    '## KF-042 · và dòng này nữa',
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

// ── Vòng soát ngữ cảnh sạch (bước 6) · CHẶN-1 — báo nhầm trên tiêu đề Việt

test('CHẶN-1 · tiêu đề KHÔNG mang mã thì không đếm — tiếng Việt không bị cắt thành "mã"', () => {
  // Bản đầu cắt ở khoảng trắng bằng `[A-Za-z0-9._-]*`, và lớp ký tự đó dừng
  // ở chữ có dấu. Hai tiêu đề khác hẳn nhau ra CÙNG một "mã":
  //   '## Cách thêm một mục' + '## Cấu trúc một khối' → [{ id: 'C',  … }]
  //   '## Nhóm Z · …'        + '## Nhóm Y · …'        → [{ id: 'Nh', … }]
  assert.deepEqual(duplicateHeadings('## Cách thêm một mục\n## Cấu trúc một khối', 2), []);
  assert.deepEqual(duplicateHeadings('## Nhóm Z · a\n## Nhóm Y · b', 2), []);
  assert.deepEqual(duplicateHeadings('## Nhóm Z · a\n## Nhóm Z · b', 2), [], 'trùng NGUYÊN VĂN cũng không phải mã');
  assert.deepEqual(duplicateHeadings('### Bối cảnh\n### Bản sửa\n### Bản đầu', 3), []);
});

test('CHẶN-1 · ca thật trên `ops/known-failures.md`: thêm một mục "## Nhóm Y" KHÔNG làm cổng đỏ', () => {
  // `## Nhóm Z ·` và `## Cách thêm một mục` đã nằm sẵn trong file thật, nên
  // luật cũ biến một mục hợp lệ mới thành một cổng đỏ chặn MỌI PR của MỌI làn.
  const real = read('ops/known-failures.md');
  assert.match(real, /^## Nhóm Z /mu, 'tiền đề của ca: file thật CÓ tiêu đề đó');
  assert.deepEqual(duplicateHeadings(`${real}\n\n## Nhóm Y · một chỗ hỏng mới, tên bằng tiếng Việt\n`, 2), []);
});

test('CHẶN-1 · MỌI hình dạng mã đang dùng trong kho vẫn bắt được', () => {
  for (const id of ['KF-047', 'P-058', 'I-018', 'VF-G1', 'VF-G13', 'V-004', 'V-004b', 'T-006b', 'AU-007', 'R-002', 'K-002']) {
    assert.deepEqual(
      duplicateHeadings(`## ${id} · một\n## ${id} · hai`, 2),
      [{ id, lines: [1, 2] }],
      `hình dạng "${id}" phải còn bắt được`,
    );
  }
});

// ── Vòng soát ngữ cảnh sạch · tầng CLI — bốn phép phá thử từng SỐNG SÓT ──

test('CLI: cây bẩn → thoát 1, và báo cáo ra stderr', () => {
  const dirty = join(tmpdir(), `crux-dup-${process.pid}-ban`);
  mkdirSync(join(dirty, 'ops', 'lanes', 'platform'), { recursive: true });
  writeFileSync(join(dirty, 'ops', 'known-failures.md'), '## KF-001 · a\n## KF-001 · b\n');
  writeFileSync(join(dirty, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · a\n');
  const run = runCli(dirty);
  assert.equal(run.status, 1, 'mã trùng thì cổng phải ĐỎ');
  assert.match(run.stderr, /KF-001/);
  assert.match(run.stderr, /dòng 1, 2/);
  rmSync(dirty, { recursive: true, force: true });
});

test('CLI: cây sạch → thoát 0, và VẪN in ra (im lặng là thứ `Z15` cấm)', () => {
  const clean = join(tmpdir(), `crux-dup-${process.pid}-sach`);
  mkdirSync(join(clean, 'ops', 'lanes', 'platform'), { recursive: true });
  writeFileSync(join(clean, 'ops', 'known-failures.md'), '## KF-001 · a\n## KF-002 · b\n');
  writeFileSync(join(clean, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · a\n');
  const run = runCli(clean);
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Mã trùng: 0/);
  assert.match(run.stdout, /đã soát 2 file/, 'số file soát phải tới từ `targets` thật, không phải một số chép tay');
  rmSync(clean, { recursive: true, force: true });
});

test('CLI: một file trong danh sách KHÔNG đọc được → thoát 2, KHÁC hẳn "sạch"', () => {
  // Một làn có thư mục mà không có `backlog.md`. "Không đọc được" phải khác
  // "sạch" ở cả mã thoát — nếu không, một file biến mất làm cổng im lặng.
  const missing = join(tmpdir(), `crux-dup-${process.pid}-thieu`);
  mkdirSync(join(missing, 'ops', 'lanes', 'platform'), { recursive: true });
  mkdirSync(join(missing, 'ops', 'lanes', 'topic'), { recursive: true });
  writeFileSync(join(missing, 'ops', 'known-failures.md'), '## KF-001 · a\n');
  writeFileSync(join(missing, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · a\n');
  const run = runCli(missing);
  assert.equal(run.status, 2, 'không đọc được thì thoát 2, không phải 0 và cũng không phải 1');
  assert.match(run.stderr, /KHÔNG SOÁT ĐƯỢC/);
  assert.match(run.stderr, /topic/);
  rmSync(missing, { recursive: true, force: true });
});

test('CLI: backlog soát ở CẤP 3, sổ chỗ hỏng ở CẤP 2 — không lẫn cấp', () => {
  // Soát backlog ở cấp 2 thì `### P-001` × 2 lọt, và `## Nhóm …` lại bị ngó tới.
  const mixed = join(tmpdir(), `crux-dup-${process.pid}-cap`);
  mkdirSync(join(mixed, 'ops', 'lanes', 'platform'), { recursive: true });
  writeFileSync(join(mixed, 'ops', 'known-failures.md'), '## KF-001 · a\n');
  writeFileSync(join(mixed, 'ops', 'lanes', 'platform', 'backlog.md'), '## P-002 · cấp hai\n### P-001 · a\n### P-001 · b\n');
  const run = runCli(mixed);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /P-001/);
  assert.match(run.stderr, /tiêu đề cấp 3/);
  assert.doesNotMatch(run.stderr, /P-002/, 'cấp 2 trong backlog không thuộc phạm vi cổng này');
  rmSync(mixed, { recursive: true, force: true });
});
