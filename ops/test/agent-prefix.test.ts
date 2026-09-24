/**
 * `ops/scripts/agent-prefix.ts` — mục `platform/P-042`.
 *
 * Luật bỏ tiền tố 🤖 nằm ở đúng một hàm, nên bộ bài của nó phải khoá cả hai
 * chiều: bỏ đúng chỗ cần bỏ, và **không** bỏ ở mọi chỗ khác. Chiều thứ hai
 * mới là chiều dễ hỏng — một hàm bỏ tiền tố quá tay làm mọi bộ đọc gọi nó
 * fail-open, tức đổi một lỗi đếm thiếu thành một lỗi khớp nhầm.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_PREFIX, stripAgentPrefix } from '../scripts/agent-prefix.ts';

test('AGENT_PREFIX đúng là ký tự 🤖 của CLAUDE.md mục 5', () => {
  assert.equal(AGENT_PREFIX, '🤖');
  assert.equal(AGENT_PREFIX.codePointAt(0), 0x1f916);
});

test('bỏ tiền tố 🤖 cùng khoảng trắng theo sau', () => {
  assert.equal(stripAgentPrefix('🤖 [platform] P-038 — a'), '[platform] P-038 — a');
  // Khoảng trắng kiểu gì cũng bỏ, kể cả nhiều dấu cách hay tab.
  assert.equal(stripAgentPrefix('🤖   [visual] V-001 — a'), '[visual] V-001 — a');
  assert.equal(stripAgentPrefix('🤖\t[visual] V-001 — a'), '[visual] V-001 — a');
  // Không có khoảng trắng cũng bỏ — tiêu đề viết sát vẫn là tiêu đề.
  assert.equal(stripAgentPrefix('🤖[visual] V-001 — a'), '[visual] V-001 — a');
});

test('tiêu đề không có tiền tố trả về NGUYÊN VẸN', () => {
  assert.equal(stripAgentPrefix('[platform] P-038 — a'), '[platform] P-038 — a');
  assert.equal(stripAgentPrefix(''), '');
  // Không `trim()` hộ bên gọi: bên gọi neo `^`, đuôi không đổi ý nghĩa gì.
  assert.equal(stripAgentPrefix('  [platform] P-038 — a  '), '  [platform] P-038 — a  ');
});

test('chỉ bỏ ở ĐẦU chuỗi — 🤖 giữa câu là nội dung, không phải dấu phân biệt', () => {
  assert.equal(stripAgentPrefix('[platform] P-038 — quy ước 🤖 của mục 5'), '[platform] P-038 — quy ước 🤖 của mục 5');
  assert.equal(stripAgentPrefix('Revert "🤖 [platform] P-038 — a"'), 'Revert "🤖 [platform] P-038 — a"');
});

test('chỉ bỏ MỘT lần — hai tiền tố không phải tiêu đề đúng quy ước', () => {
  assert.equal(stripAgentPrefix('🤖 🤖 [platform] P-001 — a'), '🤖 [platform] P-001 — a');
});
