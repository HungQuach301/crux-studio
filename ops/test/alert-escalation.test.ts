import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ESCALATE_INTERVAL_HOURS,
  decideMention,
  lastMentionAt,
  type AlertComment,
} from '../scripts/alert-escalation.ts';

const MARKER = '<!-- crux-escalate-main-do -->';
const NOW = '2026-09-23T12:00:00Z';

/** Một mục mang mốc, tạo cách `NOW` đúng `hours` giờ. */
const mention = (hours: number, body = `${MARKER}\n@HungQuach301 main đỏ.`): AlertComment => ({
  body,
  createdAt: new Date(Date.parse(NOW) - hours * 3_600_000).toISOString(),
});

const plain = (hours: number): AlertComment => ({
  body: '🤖 `main` đang đỏ. Nhật ký lần chạy: …',
  createdAt: new Date(Date.parse(NOW) - hours * 3_600_000).toISOString(),
});

test('ngưỡng là 4 giờ, đúng con số chủ dự án chốt kèm #169', () => {
  assert.equal(ESCALATE_INTERVAL_HOURS, 4);
});

test('chưa mục nào mang mốc → @nhắc ngay (vế 1: comment ĐẦU TIÊN)', () => {
  const decision = decideMention([plain(0)], MARKER, NOW);
  assert.equal(decision.verdict, 'mention');
  assert.equal(decision.lastMentionAt, null);
  assert.equal(decision.hoursSinceLastMention, null);
});

test('danh sách rỗng → @nhắc (issue chưa có gì, hướng an toàn là gọi)', () => {
  assert.equal(decideMention([], MARKER, NOW).verdict, 'mention');
});

test('đã @nhắc 3,9 giờ trước → KHÔNG nhắc lại', () => {
  const decision = decideMention([mention(3.9)], MARKER, NOW);
  assert.equal(decision.verdict, 'quiet');
  assert.ok(Math.abs((decision.hoursSinceLastMention ?? 0) - 3.9) < 1e-9);
});

test('đã @nhắc 4,1 giờ trước → nhắc lại', () => {
  const decision = decideMention([mention(4.1)], MARKER, NOW);
  assert.equal(decision.verdict, 'mention');
  assert.ok(Math.abs((decision.hoursSinceLastMention ?? 0) - 4.1) < 1e-9);
});

test('đúng 4,0 giờ → nhắc lại (mốc `≥`, không để bên gọi đoán)', () => {
  assert.equal(decideMention([mention(4)], MARKER, NOW).verdict, 'mention');
});

test('nhiều lần @nhắc → tính theo lần MỚI NHẤT, không phải lần đầu', () => {
  // Đếm số comment thay vì đọc mốc mới nhất là chỗ luật cũ hỏng: ba lần
  // @nhắc mà lần gần nhất mới 1 giờ thì vẫn phải im.
  const decision = decideMention([mention(13), mention(8), mention(1)], MARKER, NOW);
  assert.equal(decision.verdict, 'quiet');
  assert.ok(Math.abs((decision.hoursSinceLastMention ?? 0) - 1) < 1e-9);
});

test('thứ tự đầu vào không đổi kết quả', () => {
  const shuffled = decideMention([mention(1), mention(13), mention(8)], MARKER, NOW);
  assert.equal(shuffled.verdict, 'quiet');
  assert.ok(Math.abs((shuffled.hoursSinceLastMention ?? 0) - 1) < 1e-9);
});

test('thân issue mang mốc được tính như một lần @nhắc', () => {
  // Từ mục P-034 lần @nhắc đầu nằm trong THÂN ISSUE. Bên gọi truyền thân
  // issue vào cùng danh sách; bỏ nó ra thì mọi lượt sau đều thấy "chưa
  // @nhắc lần nào" và gọi chủ dự án mỗi giờ.
  const body = mention(2, `🤖 \`main\` đang đỏ.\n\n${MARKER}\n@HungQuach301`);
  assert.equal(decideMention([body, plain(1)], MARKER, NOW).verdict, 'quiet');
});

test('mốc của cảnh báo khác không đếm nhầm sang cảnh báo này', () => {
  const other: AlertComment = {
    body: '<!-- crux-escalate-watchdog -->\n@HungQuach301',
    createdAt: new Date(Date.parse(NOW) - 3_600_000).toISOString(),
  };
  assert.equal(decideMention([other], MARKER, NOW).verdict, 'mention');
});

test('`createdAt` không đọc được thì BỎ QUA và ĐẾM, không thành một lần @nhắc', () => {
  const broken: AlertComment = { body: MARKER, createdAt: 'hôm qua' };
  const decision = decideMention([broken], MARKER, NOW);
  assert.equal(decision.verdict, 'mention');
  assert.equal(decision.unreadableMarkerComments, 1);
  assert.equal(decision.lastMentionAt, null);
});

test('một mục hỏng không che mất mục đọc được', () => {
  const broken: AlertComment = { body: MARKER, createdAt: '' };
  const decision = decideMention([broken, mention(1)], MARKER, NOW);
  assert.equal(decision.verdict, 'quiet');
  assert.equal(decision.unreadableMarkerComments, 1);
});

test('`now` không parse được thì NÉM, không so bừa', () => {
  assert.throws(() => decideMention([mention(1)], MARKER, 'bây giờ'), /now/);
});

test('lastMentionAt trả mốc mới nhất kèm số mục hỏng', () => {
  const broken: AlertComment = { body: MARKER, createdAt: 'x' };
  const result = lastMentionAt([mention(5), broken, mention(2)], MARKER);
  assert.equal(result.unreadable, 1);
  assert.equal(result.at, new Date(Date.parse(NOW) - 2 * 3_600_000).toISOString());
});
