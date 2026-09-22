/**
 * Z3 — `.github/workflows/` lệch `ops/workflows/`, cả hai trường hợp: file
 * chưa từng sync (thiếu hẳn ở phía `.github/`) và file đã sync một lần
 * nhưng nội dung đã trôi kể từ đó (sync hỏng hoặc đã dừng).
 *
 * Test âm là phần quan trọng nhất: một luật chỉ có giá trị khi nó đỏ đúng
 * lúc phải đỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsyncedWorkflows } from '../scripts/check-workflows-synced.ts';

function m(pairs: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(pairs));
}

test('nội dung khớp nhau — không có gì để báo', () => {
  const found = unsyncedWorkflows(m({ 'ci.yml': 'name: ci\n' }), m({ 'ci.yml': 'name: ci\n' }));
  assert.deepEqual(found, []);
});

test('Z3 · file có trong ops/workflows nhưng chưa từng sync sang .github/', () => {
  const found = unsyncedWorkflows(m({ 'watchdog.yml': 'name: watchdog\n' }), m({}));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0]?.file, 'watchdog.yml');
  assert.match(found[0]!.reason, /chưa từng sync/);
});

test('Z3 · nội dung .github/ lệch ops/workflows/ — sync đang hỏng hoặc đã dừng', () => {
  const found = unsyncedWorkflows(
    m({ 'main-ci.yml': 'name: main-ci\n# bản mới\n' }),
    m({ 'main-ci.yml': 'name: main-ci\n# bản cũ\n' }),
  );
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0]?.file, 'main-ci.yml');
  assert.match(found[0]!.reason, /hỏng hoặc đã dừng/);
});

test('sync-workflows.yml không nằm trong ops/workflows — không có gì để so ở tên đó', () => {
  // opsFiles không bao giờ có key này (CHARTER 3.2), nên vòng lặp không
  // bao giờ xét tới nó — không cần loại trừ tường minh trong hàm.
  const found = unsyncedWorkflows(m({ 'ci.yml': 'a' }), m({ 'ci.yml': 'a', 'sync-workflows.yml': 'b' }));
  assert.deepEqual(found, []);
});

test('nhiều file lệch cùng lúc — báo hết, không dừng ở cái đầu tiên', () => {
  const found = unsyncedWorkflows(
    m({ 'a.yml': '1', 'b.yml': '2', 'c.yml': '3' }),
    m({ 'a.yml': '1', 'b.yml': 'X' }),
  );
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.deepEqual(
    found.map((f) => f.file).sort(),
    ['b.yml', 'c.yml'],
  );
});

// Không có bài kiểm "cây hiện tại phải khớp" ở đây, khác các file
// `check-*.test.ts` khác trong thư mục này — CÓ CHỦ Ý. Một nhánh đang sửa
// `ops/workflows/**` (như chính PR này) khiến `.github/workflows/` lệch
// MỘT CÁCH BÌNH THƯỜNG cho tới khi merge và `sync-workflows.yml` chạy; một
// assertion "hai thư mục phải khớp" ở đây sẽ đỏ đúng lúc không nên đỏ, cho
// mọi PR chạm `ops/workflows/**`. Đây chính là lý do `unsyncedWorkflows`
// chỉ được gọi từ `main-ci.yml`, không phải từ `pnpm test` — xem chú thích
// đầu `check-workflows-synced.ts`.
