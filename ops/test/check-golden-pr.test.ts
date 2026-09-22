/**
 * Rà soát **Z13** — `ops/known-failures.md`, nhóm Z.
 *
 * Luật chỉ có giá trị khi nó **đỏ đúng lúc phải đỏ** (bài học KF-003), nên
 * mỗi ca cho qua ở đây đi kèm một ca âm tương ứng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { goldenOnlyProblems, isGoldenFile } from '../scripts/check-golden-pr.ts';

test('Z13 · PR không chạm tập vàng thì luật không nói gì', () => {
  assert.deepEqual(
    goldenOnlyProblems(['kernel/src/log.ts', 'ops/workflows/ci.yml', 'docs/assumptions.md']),
    [],
  );
});

test('Z13 · PR chỉ chạm tập vàng thì qua', () => {
  assert.deepEqual(
    goldenOnlyProblems([
      'ops/golden/ep-0001-stub/snapshots/topic.json',
      'ops/golden/ep-0001-stub/snapshots/visual.json',
    ]),
    [],
  );
});

test('Z13 · dòng log I8 và backlog được đi cùng — không thì không PR nào hợp lệ được', () => {
  assert.deepEqual(
    goldenOnlyProblems([
      'ops/golden/ep-0001-stub/snapshots/topic.json',
      'ops/logs/integration/I-020.jsonl',
      'ops/lanes/integration/backlog.md',
    ]),
    [],
  );
});

test('Z13 · TEST ÂM: snapshot đi kèm một thay đổi code thì đỏ, và nêu đích danh file', () => {
  const problems = goldenOnlyProblems([
    'ops/golden/ep-0001-stub/snapshots/topic.json',
    'workshops/topic/src/stub.ts',
  ]);
  assert.deepEqual(problems, ['workshops/topic/src/stub.ts']);
});

test('Z13 · TEST ÂM: tài liệu cũng không được đi kèm — "PR riêng" không có cửa hé', () => {
  // `docs/**` không đổi được output của replay, nhưng lý do snapshot đổi
  // thuộc về MÔ TẢ PR. Một ngoại lệ rộng là chỗ luật bắt đầu rò.
  assert.deepEqual(
    goldenOnlyProblems(['ops/golden/ep-0001-stub/snapshots/topic.json', 'docs/spec/note.md']),
    ['docs/spec/note.md'],
  );
});

test('Z13 · TEST ÂM: nhiều file lạ thì liệt kê đủ, xếp theo thứ tự ổn định', () => {
  const problems = goldenOnlyProblems([
    'workshops/visual/src/stub.ts',
    'ops/golden/ep-0001-stub/snapshots/visual.json',
    'kernel/src/envelope.ts',
  ]);
  assert.deepEqual(problems, ['kernel/src/envelope.ts', 'workshops/visual/src/stub.ts']);
});

test('Z13 · TEST ÂM: tên thư mục chỉ TRÔNG giống tập vàng thì không được tính là tập vàng', () => {
  // `ops/golden-notes/` không phải `ops/golden/`. Nếu nó được tính là tập
  // vàng thì một PR bình thường tự nhiên bị luật này soi, và tệ hơn: một PR
  // `--update` thật có thể núp sau nó.
  assert.equal(isGoldenFile('ops/golden-notes/readme.md'), false);
  assert.deepEqual(goldenOnlyProblems(['ops/golden-notes/readme.md', 'kernel/src/log.ts']), []);
});

test('Z13 · dòng rỗng và khoảng trắng thừa của `git diff --name-only` không thành file lạ', () => {
  assert.deepEqual(
    goldenOnlyProblems(['ops/golden/ep-0001-stub/snapshots/topic.json', '', '   ']),
    [],
  );
});
