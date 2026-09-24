/**
 * `ops/scripts/digest-approval.ts` — cơ chế của mục `platform/P-046`.
 *
 * Ba bài **âm** giữ đúng ba cách đọc sai mà mục này sinh ra để chặn (xem đầu
 * `digest-approval.ts`). Cả ba là hình dạng nhóm **Z**: câu trả lời bị hiểu
 * sai mà không gì đỏ.
 *
 * Thân issue dùng trong các bài dưới đây chép từ `#213` thật, không bịa hình
 * dạng — `parseDecisionBody` tồn tại để đọc thân issue do chính agent viết
 * theo `CLAUDE.md` mục 14, nên một fixture bịa sẽ khoá sai thứ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVE_WORD,
  DRAFT_HEADING,
  type ApprovalItem,
  needsAnswer,
  parseApprovalReply,
  parseDecisionBody,
  renderApprovalDraft,
} from '../scripts/digest-approval.ts';

/** Rút gọn từ thân thật của issue `#213`. */
const BODY_213 = [
  '🤖 **Bối cảnh**',
  '',
  'Anh dặn trên bản tin #193: lượt bước 0 không gỡ được PR nào thì **không mở PR log riêng**.',
  '',
  '**Phương án**',
  '',
  '- **A — giữ cả hai vế:** lượt log-only không mở PR, **trừ** khi nhịp tim trên `main` đã ≥ 150 phút.',
  '- **B — bỏ hẳn PR log, sửa `watchdog.yml`** để nó đọc nhịp tim cả từ nhánh chờ.',
  '- **C — không làm gì:** giữ nguyên PR log mỗi lượt.',
  '',
  '**Khuyến nghị: A.** Nó cắt ~80% chi phí mà không chạm lớp cảnh báo.',
  '',
  '**Nếu anh chưa trả lời**',
  '',
  'Phần cơ chế đã vào `main` nhưng **chưa có hiệu lực**. Mục `P-038` đứng ở `blocked`.',
  '',
  'Vì sao tôi không tự làm dù đây là `reversible`: lớp chặn tự động chặn thao tác ghi luật.',
  '',
  '**Cách trả lời**',
  '',
  'Một chữ cái: `A`, `B` hoặc `C`.',
].join('\n');

function item(overrides: Partial<ApprovalItem> & Pick<ApprovalItem, 'number'>): ApprovalItem {
  return {
    title: 'mục thử',
    kind: 'irreversible',
    recommendation: 'A',
    options: ['A', 'B'],
    ifNoAnswer: 'nhánh việc đứng im',
    ...overrides,
  };
}

// --- parseDecisionBody ---

test('parseDecisionBody đọc đúng ba trường của thân issue [QĐ] thật', () => {
  const parsed = parseDecisionBody(BODY_213);
  assert.deepEqual(parsed.options, ['A', 'B', 'C']);
  assert.equal(parsed.recommendation, 'A');
  assert.match(parsed.ifNoAnswer ?? '', /^Phần cơ chế đã vào `main`/);
  assert.doesNotMatch(parsed.ifNoAnswer ?? '', /lớp chặn/, 'chỉ lấy đoạn ĐẦU, không nuốt cả phần còn lại');
  assert.doesNotMatch(parsed.ifNoAnswer ?? '', /Cách trả lời/);
});

test('parseDecisionBody trả null/rỗng khi thiếu, KHÔNG đoán', () => {
  const parsed = parseDecisionBody('🤖 **Bối cảnh**\n\nMột dòng, không có phần nào khác.');
  assert.deepEqual(parsed.options, []);
  assert.equal(parsed.recommendation, null);
  assert.equal(parsed.ifNoAnswer, null);
});

test('parseDecisionBody không nhặt một chữ cái giữa câu thành phương án', () => {
  const parsed = parseDecisionBody('**Phương án**\n\nTôi nghĩ A là hợp lý nhất.\n\n- không phải gạch đầu dòng phương án\n');
  assert.deepEqual(parsed.options, []);
});

// --- renderApprovalDraft ---

test('renderApprovalDraft: irreversible liệt kê riêng KÈM hệ quả; reversible chỉ liệt kê', () => {
  const block = renderApprovalDraft([
    item({ number: 169, title: '🤖 [QĐ] lối đi nhanh hotfix', recommendation: 'A', ifNoAnswer: 'main đỏ chờ 12 giờ' }),
    item({ number: 107, kind: 'reversible', title: 'PR gộp sạch rồi đỏ' }),
  ]);

  assert.match(block, new RegExp(`^${DRAFT_HEADING}`));
  assert.match(block, /Cần anh quyết: 1 việc/);
  assert.match(block, /#169 · \[QĐ\] lối đi nhanh hotfix/, 'tiền tố 🤖 bị bỏ — P-042');
  assert.match(block, /khuyến nghị \*\*A\*\* \(có: A\/B\)/);
  assert.match(block, /chưa trả lời thì: main đỏ chờ 12 giờ/);

  assert.match(block, /Đã tự làm, chỉ liệt kê — 1 việc/);
  assert.match(block, /#107 · PR gộp sạch rồi đỏ · phủ quyết bằng `hoàn tác #107`/);
  assert.equal(/#107[^\n]*khuyến nghị/.test(block), false, 'reversible KHÔNG hỏi lại');
  assert.match(block, /Trả lời tất cả trong MỘT comment ngay dưới đây\.$/m);
});

test('renderApprovalDraft nói ra chỗ THIẾU thay vì bỏ qua', () => {
  const block = renderApprovalDraft([item({ number: 5, recommendation: null, options: [], ifNoAnswer: null })]);
  assert.match(block, /\*\*THIẾU KHUYẾN NGHỊ\*\*/);
  assert.match(block, /\*\*THIẾU\*\* phần "Nếu anh chưa trả lời"/);
});

test('renderApprovalDraft: không có việc nào cần quyết thì nói thẳng', () => {
  const block = renderApprovalDraft([item({ number: 1, kind: 'reversible' })]);
  assert.match(block, /Không có việc nào cần anh quyết/);
});

test('chưa phân loại vẫn cần trả lời — không được im như reversible', () => {
  assert.equal(needsAnswer({ kind: 'chưa phân loại' }), true);
  assert.equal(needsAnswer({ kind: 'irreversible' }), true);
  assert.equal(needsAnswer({ kind: 'reversible' }), false);
});

// --- parseApprovalReply: đường chính ---

test('`Duyệt` trần nhận khuyến nghị của MỌI mục cần trả lời', () => {
  const items = [item({ number: 19, recommendation: 'A' }), item({ number: 14, recommendation: 'B' }), item({ number: 7, kind: 'reversible' })];
  const reply = parseApprovalReply('Duyệt', items);

  assert.equal(reply.mode, 'approve-all');
  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }, { number: 14, option: 'B' }]);
  assert.deepEqual(reply.unresolved, []);
  assert.deepEqual(reply.problems, []);
});

test('`Duyệt, trừ #14 B` chốt phần còn lại theo khuyến nghị và riêng #14 lấy B', () => {
  const items = [item({ number: 19, recommendation: 'A' }), item({ number: 14, recommendation: 'A', options: ['A', 'B'] })];
  const reply = parseApprovalReply('Duyệt, trừ #14 B', items);

  assert.equal(reply.mode, 'approve-all');
  assert.deepEqual(reply.choices.sort((a, b) => a.number - b.number), [
    { number: 14, option: 'B' },
    { number: 19, option: 'A' },
  ]);
  assert.deepEqual(reply.unresolved, []);
  assert.deepEqual(reply.problems, []);
});

test('hình dạng cũ `#19 A, #14 B` vẫn đọc được (CLAUDE.md mục 5)', () => {
  const items = [item({ number: 19 }), item({ number: 14 })];
  const reply = parseApprovalReply('#19 A, #14 B', items);

  assert.equal(reply.mode, 'per-item');
  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }, { number: 14, option: 'B' }]);
  assert.deepEqual(reply.unresolved, []);
});

test('`#19 A` chốt một mục và mục còn lại ra unresolved, không tự nhận khuyến nghị', () => {
  const reply = parseApprovalReply('#19 A', [item({ number: 19 }), item({ number: 14, recommendation: 'B' })]);
  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }]);
  assert.deepEqual(reply.unresolved, [14]);
});

test('`hoàn tác #N` đọc được, và #N trong câu đó KHÔNG thành một lựa chọn', () => {
  const items = [item({ number: 20, kind: 'reversible' }), item({ number: 19 })];
  const reply = parseApprovalReply('Duyệt. hoàn tác #20', items);

  assert.deepEqual(reply.vetoes, [20]);
  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }]);
  assert.deepEqual(reply.problems, []);
});

test('comment của chủ dự án không mang tín hiệu nào thì ra unrecognized, không phải approve', () => {
  const reply = parseApprovalReply('Mai tôi xem lại nhé.', [item({ number: 19 })]);
  assert.equal(reply.mode, 'unrecognized');
  assert.deepEqual(reply.choices, []);
  assert.deepEqual(reply.unresolved, [19]);
});

// --- Ba bài ÂM: ba cách đọc sai ---

test('LUẬT 1 — `Duyệt` không chốt hộ một mục mà bản tin này không liệt kê', () => {
  const reply = parseApprovalReply('Duyệt, trừ #999 B', [item({ number: 19 })]);

  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }]);
  assert.deepEqual(reply.problems, [{ number: 999, reason: 'không có trong bản tin này' }]);
  assert.equal(reply.choices.some((choice) => choice.number === 999), false);
});

test('LUẬT 2 — `Duyệt, trừ #14` trần KHÔNG rơi về khuyến nghị của #14', () => {
  const items = [item({ number: 19, recommendation: 'A' }), item({ number: 14, recommendation: 'A' })];
  const reply = parseApprovalReply('Duyệt, trừ #14', items);

  assert.deepEqual(reply.choices, [{ number: 19, option: 'A' }]);
  assert.deepEqual(reply.unresolved, [14], 'mục bị trừ phải ỒN, không im');
  assert.deepEqual(reply.problems, [{ number: 14, reason: 'nêu mục nhưng không nêu phương án' }]);
});

test('LUẬT 3 — comment mở đầu bằng 🤖 không bao giờ là câu trả lời, kể cả khi có chữ Duyệt', () => {
  const reply = parseApprovalReply('🤖 Duyệt, trừ #14 B. hoàn tác #20', [item({ number: 14 }), item({ number: 20, kind: 'reversible' })]);

  assert.equal(reply.mode, 'not-an-answer');
  assert.deepEqual(reply.choices, []);
  assert.deepEqual(reply.vetoes, []);
  assert.deepEqual(reply.unresolved, []);
  assert.deepEqual(reply.problems, []);
});

// --- Các chỗ chặt khác ---

test('`#14 Bản tin` KHÔNG đọc thành phương án B — `\\b` của JS chỉ biết ASCII', () => {
  const reply = parseApprovalReply('Duyệt, trừ #14 Bản tin hôm nay sai số', [item({ number: 14 })]);
  assert.deepEqual(reply.choices, []);
  assert.deepEqual(reply.problems, [{ number: 14, reason: 'nêu mục nhưng không nêu phương án' }]);
});

test('phương án không có trong issue thì vào problems, không vào choices', () => {
  const reply = parseApprovalReply('Duyệt, trừ #14 Z', [item({ number: 14, options: ['A', 'B'] })]);
  assert.deepEqual(reply.choices, []);
  assert.deepEqual(reply.problems, [{ number: 14, reason: 'phương án `Z` không có trong issue' }]);
  assert.deepEqual(reply.unresolved, [14]);
});

test('`Duyệt` mà issue thiếu khuyến nghị thì ồn, không nhận bừa', () => {
  const reply = parseApprovalReply('Duyệt', [item({ number: 14, recommendation: null })]);
  assert.deepEqual(reply.choices, []);
  assert.deepEqual(reply.unresolved, [14]);
  assert.deepEqual(reply.problems, [{ number: 14, reason: '`Duyệt` nhưng issue không có khuyến nghị nào để nhận' }]);
});

test('`Duyệt` kèm #N mà KHÔNG có chữ `trừ` là câu mập mờ — không đoán hướng nào', () => {
  const reply = parseApprovalReply('Duyệt #14 B', [item({ number: 14, recommendation: 'A' })]);
  assert.equal(reply.choices.length, 1);
  assert.deepEqual(reply.choices, [{ number: 14, option: 'A' }], 'rơi về khuyến nghị, KHÔNG lấy B từ câu mập mờ');
  assert.equal(reply.problems.length, 1);
  assert.match(reply.problems[0]!.reason, /không có chữ `trừ`/);
});

test('chữ `duyệt` nằm trong một từ khác không kích hoạt approve-all', () => {
  const reply = parseApprovalReply('Chờ tôi duyệtlại đã', [item({ number: 14 })]);
  assert.notEqual(reply.mode, 'approve-all');
  assert.deepEqual(reply.choices, []);
});

test('chữ thường `duyệt` và viết hoa `DUYỆT` đều nhận', () => {
  for (const body of ['duyệt', 'DUYỆT', 'Duyệt.']) {
    assert.equal(parseApprovalReply(body, [item({ number: 14 })]).mode, 'approve-all', body);
  }
  assert.equal(APPROVE_WORD, 'duyệt');
});

test('`hoàn tác` cho mục không có trong bản tin thì ồn', () => {
  const reply = parseApprovalReply('hoàn tác #404', [item({ number: 14 })]);
  assert.deepEqual(reply.vetoes, [404]);
  assert.equal(reply.problems.length, 1);
  assert.match(reply.problems[0]!.reason, /không có trong bản tin này/);
});

test('đầu–cuối: dựng mục từ thân issue thật rồi đọc `Duyệt` trên chính nó', () => {
  const parsed = parseDecisionBody(BODY_213);
  const items = [{ number: 213, title: '🤖 [QĐ] Bỏ PR log của bước 0', kind: 'irreversible' as const, ...parsed }];

  assert.match(renderApprovalDraft(items), /#213 · \[QĐ\] Bỏ PR log của bước 0 · khuyến nghị \*\*A\*\* \(có: A\/B\/C\)/);
  assert.deepEqual(parseApprovalReply('Duyệt', items).choices, [{ number: 213, option: 'A' }]);
  assert.deepEqual(parseApprovalReply('Duyệt, trừ #213 C', items).choices, [{ number: 213, option: 'C' }]);
});
