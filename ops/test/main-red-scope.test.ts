import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractCandidates, indexRepo, resolveScope, renderScopeBlock } from '../scripts/main-red-scope.ts';
import { SCOPE_MARKER, parseScope } from '../invariants.hotfix-lane.ts';

/**
 * Đầu ra THẬT của `pnpm check` trên `main` tại `00f2f84` ngày 2026-09-23 —
 * chép nguyên văn, không rút gọn, vì đây là hình dạng mà phép dò phải chịu.
 */
const REAL_OUTPUT = [
  'Workflow có vấn đề:',
  '  - spike-canvas.yml:47 — khối `run: |` thiếu `set -euo pipefail` ở dòng đầu (Z10).',
  '  - spike-canvas.yml:63 — `|| true` không có chú thích ngay trên (Z9).',
  'Test có trên đĩa nhưng ngoài glob của `pnpm test` (Z11):',
  '  - spike/canvas/test/camera.test.ts',
  'Trên đĩa: 53 file `*.test.ts`. Trong glob: 52.',
].join('\n');

test('dò được cả tên trần lẫn đường dẫn đầy đủ trong đầu ra thật của `pnpm check`', () => {
  const candidates = extractCandidates(REAL_OUTPUT);
  assert.ok(candidates.includes('spike-canvas.yml'), 'tên trần của check-workflows.ts');
  assert.ok(candidates.includes('spike/canvas/test/camera.test.ts'), 'đường dẫn đầy đủ của check-test-coverage.ts');
});

test('tên trần được nâng thành đường dẫn đầy đủ khi nó là duy nhất trong repo', () => {
  const index = indexRepo(process.cwd());
  const files = resolveScope(extractCandidates(REAL_OUTPUT), index);
  assert.deepEqual(files, ['ops/workflows/spike-canvas.yml', 'spike/canvas/test/camera.test.ts']);
});

test('bản chép trong `.github/` không làm tên trần thành "trùng" (chữ ký đã đo được)', () => {
  // `.github/workflows/spike-canvas.yml` là bản chép của
  // `ops/workflows/spike-canvas.yml`. Khi chỉ mục còn đếm bản chép, tên trần
  // `spike-canvas.yml` có hai chỗ ứng, luật "chỉ nâng khi duy nhất" bỏ nó, và
  // phạm vi thiếu ĐÚNG file cần sửa — phép dò trượt im lặng.
  const index = indexRepo(process.cwd());
  assert.equal(index.uniqueByName.get('spike-canvas.yml'), 'ops/workflows/spike-canvas.yml');
  assert.equal([...index.paths].some((path) => path.startsWith('.github/')), false);
});

test('ứng viên không ứng với file thật nào bị bỏ — phạm vi không bao giờ nêu file không tồn tại', () => {
  const index = indexRepo(process.cwd());
  assert.deepEqual(resolveScope(['khong/co/that.ts', 'cũng-không-có.yml'], index), []);
});

test('tên trần trùng ở hai chỗ bị bỏ, không đoán một trong hai', () => {
  const index = {
    paths: new Set(['a/backlog.md', 'b/backlog.md']),
    uniqueByName: new Map<string, string>(),
  };
  assert.deepEqual(resolveScope(['backlog.md'], index), []);
});

test('phạm vi rỗng khi đầu ra rỗng — hướng an toàn, và `parseScope` coi đó là không có lối nhanh', () => {
  const index = indexRepo(process.cwd());
  const files = resolveScope(extractCandidates(''), index);
  assert.deepEqual(files, []);
  assert.equal(parseScope(renderScopeBlock(SCOPE_MARKER, 'abc1234', files)), null);
});

test('hai lần dò cùng một sự cố cho cùng một khối JSON', () => {
  const index = indexRepo(process.cwd());
  const once = resolveScope(extractCandidates(REAL_OUTPUT), index);
  const twice = resolveScope(extractCandidates(`${REAL_OUTPUT}\n${REAL_OUTPUT}`), index);
  assert.deepEqual(once, twice);
});

test('dòng pnpm nhắc lại lệnh KHÔNG vào phạm vi (chữ ký đã đo được)', () => {
  // Đầu ra thật của `pnpm check`: hai dòng đầu mỗi cổng là pnpm nhắc lệnh, và
  // tên script nằm ngay trong đó. Không bỏ chúng thì phạm vi ra thêm ba file
  // thuộc tầng luật — nới đúng chỗ `D-C07` điều kiện 3 muốn chặn.
  const output = [
    '> crux-studio@0.0.0 lint:workflows /home/user/crux-studio',
    '> node ops/scripts/check-workflows.ts',
    '',
    'Workflow có vấn đề:',
    '  - spike-canvas.yml:47 — khối `run: |` thiếu `set -euo pipefail` (Z10).',
  ].join('\n');
  const candidates = extractCandidates(output);
  assert.equal(candidates.includes('ops/scripts/check-workflows.ts'), false);
  assert.deepEqual(resolveScope(candidates, indexRepo(process.cwd())), ['ops/workflows/spike-canvas.yml']);
});
