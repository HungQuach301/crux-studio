/**
 * Luật quyền của `pnpm lint:workflows` (KF-003).
 *
 * Test âm là phần quan trọng nhất ở đây: một luật chỉ có giá trị khi nó
 * **đỏ** đúng lúc phải đỏ. Hai trong số đó tái hiện đúng hai workflow đã sai
 * thật, bằng đúng nội dung đã làm chúng sai.
 *
 * Phần dương cũng không thừa: một luật đỏ nhầm sẽ ép workflow khai THỪA
 * quyền, và đó là cái bẫy đã sập một lần ở `ci.yml` (KF-003).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { missingPermissions } from '../scripts/check-workflows.ts';

// ── Test âm ──────────────────────────────────────────────────────────────

test('KF-003 · checkout mà thiếu contents: read thì đỏ', () => {
  const broken = `name: labels
on:
  workflow_dispatch:

permissions:
  issues: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /contents: read/);
  assert.match(missing[0]!, /Repository not found/);
});

test('KF-003 · `gh label create` mà không có quyền ghi nào thì đỏ', () => {
  const broken = `name: x
on: [workflow_dispatch]

permissions:
  contents: read

jobs:
  j:
    steps:
      - run: gh label create owner-merge --color B60205
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /issues: write.*hoặc.*pull-requests: write/);
});

test('nhãn của repo nằm dưới CẢ HAI scope — mỗi quyền một mình đều đủ', () => {
  // Đã kiểm bằng chạy thật: ci run #1 tạo được nhãn `automerge` và
  // `cross-lane` chỉ với `pull-requests: write`, không có quyền `issues`.
  // Ép chọn một scope sẽ buộc ci.yml khai thừa quyền.
  const viaPulls = `name: x
on: [workflow_dispatch]
permissions:
  contents: read
  pull-requests: write
jobs:
  j:
    steps:
      - run: gh label create a
`;
  const viaIssues = `name: x
on: [workflow_dispatch]
permissions:
  contents: read
  issues: write
jobs:
  j:
    steps:
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(viaPulls), []);
  assert.deepEqual(missingPermissions(viaIssues), []);
});

test('KF-003 · `gh pr list` mà thiếu pull-requests: read thì đỏ', () => {
  const broken = `name: watchdog
on:
  schedule:
    - cron: '0 */6 * * *'

permissions:
  contents: read
  issues: write
  actions: read

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - run: gh pr list --state merged --limit 1
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /pull-requests: read/);
});

test('bắt được nhiều quyền thiếu cùng lúc, không dừng ở cái đầu tiên', () => {
  const broken = `name: x
on: [workflow_dispatch]
permissions:
  actions: read
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: |
          gh issue create --title x
          gh pr edit 1 --add-label y
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 3, JSON.stringify(missing));
  assert.ok(missing.some((m) => m.includes('contents: read')));
  assert.ok(missing.some((m) => m.includes('issues: write')));
  assert.ok(missing.some((m) => m.includes('pull-requests: write')));
  // `gh issue create` chỉ nhận issues: write — phần "thiếu …" không có lựa
  // chọn thay thế. (Không dùng `!m.includes('hoặc')` để kiểm điều này: chữ
  // "hoặc" còn xuất hiện trong phần lý do của luật khác.)
  assert.ok(missing.some((m) => m.startsWith('thiếu `issues: write` (')));
});

test('`none` tường minh cũng là thiếu, không phải là đã khai', () => {
  const broken = `name: x
on: [workflow_dispatch]
permissions:
  contents: none
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
`;
  assert.match(missingPermissions(broken)[0]!, /contents: read/);
});

// ── Test dương: không được đỏ nhầm ───────────────────────────────────────

test('write bao hàm read — khai contents: write là đủ cho checkout', () => {
  const ok = `name: x
on: [workflow_dispatch]
permissions:
  contents: write
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
`;
  assert.deepEqual(missingPermissions(ok), []);
});

test('không khai permissions thì luật này im lặng — đó là lựa chọn khác, không phải lỗi', () => {
  const noBlock = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(noBlock), []);
});

test('ci.yml thật không khai `issues` — pull-requests: write đã đủ để tạo nhãn', () => {
  const ci = readFileSync(join(process.cwd(), 'ops', 'workflows', 'ci.yml'), 'utf8');
  const block = /^permissions:\n((?:[ \t#].*\n|\n)*)/m.exec(ci)?.[1] ?? '';
  const declared = block
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'))
    .map((l) => l.trim());
  assert.ok(
    !declared.some((l) => l.startsWith('issues:')),
    `ci.yml khai thừa quyền: ${declared.join(' · ')}`,
  );
  assert.deepEqual(missingPermissions(ci), []);
});

test('write-all phủ mọi luật', () => {
  const all = `name: x
on: [workflow_dispatch]
permissions: write-all
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(all), []);
});

test('comment trong khối permissions không làm hỏng việc đọc khối', () => {
  const commented = `name: x
on: [workflow_dispatch]
permissions:
  # contents: read LÀ BẮT BUỘC vì job này dùng actions/checkout
  contents: read

  # issues: write cho gh label create
  issues: write
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(commented), []);
});

test('`gh pr list` không bị nhầm thành cần pull-requests: write', () => {
  const readOnly = `name: x
on: [workflow_dispatch]
permissions:
  pull-requests: read
jobs:
  j:
    steps:
      - run: gh pr list --state merged
`;
  assert.deepEqual(missingPermissions(readOnly), []);
});

// ── Cây hiện tại phải sạch ───────────────────────────────────────────────

test('cả sáu workflow trong ops/workflows/ khai đủ quyền chúng cần', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length >= 6, `mới có ${files.length} workflow`);
  for (const file of files) {
    const missing = missingPermissions(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual(missing, [], `${file}: ${missing.join(' · ')}`);
  }
});

test('không workflow nào còn dùng action chạy Node 20', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const stale of ['actions/checkout@v4', 'actions/setup-node@v4', 'pnpm/action-setup@v4']) {
      assert.ok(!source.includes(stale), `${file} còn dùng ${stale} (Node 20, đã bị khai tử)`);
    }
  }
});
