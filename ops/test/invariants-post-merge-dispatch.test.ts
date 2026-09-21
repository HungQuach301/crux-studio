/**
 * KF-004 — chỗ đứt mà D-C06 vừa mở ra.
 *
 * Trước D-C06, `ops/workflows/**` nằm trong vùng `owner-merge`, nên
 * `automerge` không bao giờ merge PR chạm tới nó và `sync-workflows` luôn
 * được kích hoạt bởi một lần merge của NGƯỜI. D-C06 chuyển thư mục đó sang
 * `automerge-delayed`, nghĩa là máy merge được — và merge bằng
 * `GITHUB_TOKEN` KHÔNG sinh sự kiện `push` cho workflow nào.
 *
 * Nếu chỗ này hỏng thì không có gì đỏ: workflow mới nằm trong `main` mà
 * không bao giờ được chép sang `.github/workflows/`, và bản CŨ vẫn chạy,
 * vẫn xanh (rà soát Z3 trong `ops/known-failures.md`). Đó là lý do bài kiểm
 * này tồn tại, và là lý do nó kiểm CẢ hai phía: hàm quyết định, VÀ việc
 * `automerge.yml` thật sự gọi hàm đó rồi chạy đủ những gì nó trả về.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workflowsToDispatch } from '../invariants.post-merge-dispatch.ts';

const names = (changed: string[]): string[] => workflowsToDispatch(changed).map((d) => d.workflow);

test('KF-004 · PR chạm ops/workflows/ thì PHẢI gọi sync-workflows', () => {
  assert.deepEqual(names(['ops/workflows/ci.yml']), ['main-ci.yml', 'sync-workflows.yml']);
});

test('KF-004 · xoá một workflow cũng là chạm ops/workflows/', () => {
  assert.ok(names(['ops/workflows/labels.yml', 'README.md']).includes('sync-workflows.yml'));
});

test('KF-004 · PR không chạm ops/workflows/ thì KHÔNG gọi sync-workflows', () => {
  assert.deepEqual(names(['kernel/src/index.ts', 'ops/lanes/topic/backlog.md']), ['main-ci.yml']);
});

test('tên thư mục chỉ TRÙNG TIỀN TỐ không tính là chạm ops/workflows/', () => {
  assert.deepEqual(names(['ops/workflows-notes.md']), ['main-ci.yml']);
});

test('ops/labels.json đổi thì gọi labels, không đổi thì thôi', () => {
  assert.deepEqual(names(['ops/labels.json']), ['main-ci.yml', 'labels.yml']);
  assert.deepEqual(names(['ops/labels.md']), ['main-ci.yml']);
});

test('một PR chạm cả hai thì gọi cả ba, main-ci đứng đầu', () => {
  assert.deepEqual(names(['ops/labels.json', 'ops/workflows/notify.yml']), [
    'main-ci.yml',
    'labels.yml',
    'sync-workflows.yml',
  ]);
});

test('main-ci LUÔN có mặt — đầu ra rỗng là dấu hiệu chính script này hỏng', () => {
  assert.deepEqual(names([]), ['main-ci.yml']);
  assert.deepEqual(names(['', '   ']), ['main-ci.yml']);
});

test('mỗi workflow được gọi kèm một lý do viết ra, không phải một cờ true', () => {
  for (const dispatch of workflowsToDispatch(['ops/labels.json', 'ops/workflows/ci.yml'])) {
    assert.ok(dispatch.why.length > 20, `${dispatch.workflow} thiếu lý do`);
  }
});

// ── Phía workflow: hàm đúng mà không ai gọi thì vẫn đứt ───────────────────

const automerge = readFileSync('ops/workflows/automerge.yml', 'utf8');

test('automerge.yml thật sự gọi ops/invariants.post-merge-dispatch.ts', () => {
  assert.match(automerge, /node ops\/invariants\.post-merge-dispatch\.ts/);
});

test('automerge.yml chạy MỌI workflow mà script trả về, không chỉ một cái cố định', () => {
  // Đọc từng dòng đầu ra rồi `gh workflow run` từng cái. Một danh sách cứng
  // trong bash sẽ lặp lại đúng lỗi KF-004: thêm một workflow nghe `push` mà
  // quên sửa bash thì không có gì báo.
  assert.match(automerge, /while\s+IFS=|while\s+read/);
  assert.match(automerge, /gh workflow run "\$WF"|gh workflow run "\$\{WF\}"/);
});

test('automerge.yml khai báo KF-004 cho sự kiện push, kèm lý do', () => {
  assert.match(automerge, /#\s*KF-004[^\S\n]+push[^\S\n]*:[^\S\n]*\S/);
});
