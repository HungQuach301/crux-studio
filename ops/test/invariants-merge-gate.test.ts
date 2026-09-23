/**
 * D-C06 — điểm quyết định duy nhất của việc tự merge.
 *
 * Bài kiểm quan trọng nhất ở đây là các test ÂM: cửa này chỉ có giá trị khi
 * nó ĐÓNG đúng lúc phải đóng. Một cửa mở nhầm nghĩa là một thay đổi chạm
 * vùng bảo vệ vào `main` mà không ai kịp nói gì.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideMerge,
  isStopComment,
  DEFAULT_DELAY_HOURS,
  LABEL_FOR_GATE,
  type MergeInput,
} from '../invariants.merge-gate.ts';

const GREEN = '2026-09-21T00:00:00.000Z';

function pr(patch: Partial<MergeInput> = {}): MergeInput {
  return {
    gate: 'automerge-delayed',
    labels: ['automerge-delayed'],
    draft: false,
    mergeable: true,
    mergeableState: 'clean',
    headSha: 'abc1234',
    ciSha: 'abc1234',
    ciConclusion: 'success',
    ciCompletedAt: GREEN,
    fixHasTestConclusion: 'success',
    comments: [],
    owner: 'HungQuach301',
    now: '2026-09-21T13:00:00.000Z',
    delayHours: DEFAULT_DELAY_HOURS,
    // Mặc định là "chưa xét lối nhanh" — cùng hướng an toàn như
    // `automerge.yml` khi nó không dựng được dữ liệu của `D-C07`.
    hotfix: null,
    ...patch,
  };
}

// ── Cửa `automerge-delayed` ──────────────────────────────────────────────

test('đủ điều kiện và đã qua 12 giờ thì merge', () => {
  assert.equal(decideMerge(pr()).outcome, 'merge');
});

test('chưa đủ 12 giờ thì chờ, và nói còn mấy giờ', () => {
  const decision = decideMerge(pr({ now: '2026-09-21T03:00:00.000Z' }));
  assert.equal(decision.outcome, 'wait');
  assert.equal(decision.hoursLeft, 9);
});

test('đúng 12 giờ là đủ — ngưỡng tính từ lúc CI xanh', () => {
  assert.equal(decideMerge(pr({ now: '2026-09-21T12:00:00.000Z' })).outcome, 'merge');
});

// ── Cửa `open` ───────────────────────────────────────────────────────────

test('PR thường có nhãn automerge thì merge ngay, không chờ', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge'], ciCompletedAt: null }));
  assert.equal(decision.outcome, 'merge');
});

test('mỗi cửa đòi đúng nhãn của nó — nhãn của cửa kia không dùng thay được', () => {
  assert.equal(decideMerge(pr({ gate: 'open', labels: ['automerge-delayed'] })).outcome, 'skip');
  assert.equal(decideMerge(pr({ gate: 'automerge-delayed', labels: ['automerge'] })).outcome, 'skip');
  assert.equal(LABEL_FOR_GATE['owner-merge'], null);
});

// ── Z8: cửa thắng nhãn ───────────────────────────────────────────────────

test('rà soát Z8 · cửa owner-merge chặn kể cả khi PR mang nhãn automerge', () => {
  // Đây chính là lỗ hổng mà cửa sinh ra để bịt: `ci.yml` chạy theo định
  // nghĩa trong NHÁNH PR, nên nhãn nó gắn không phải bằng chứng đáng tin.
  const decision = decideMerge(pr({ gate: 'owner-merge', labels: ['automerge'] }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /I4/);
});

test('nhãn owner-merge chặn dù cửa tính ra là open', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge', 'owner-merge'] }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /I4/);
});

// ── Test âm ──────────────────────────────────────────────────────────────

test('PR còn nháp thì không merge dù đã quá hạn', () => {
  assert.equal(decideMerge(pr({ draft: true })).outcome, 'skip');
});

test('CI đỏ thì không merge', () => {
  assert.equal(decideMerge(pr({ ciConclusion: 'failure' })).outcome, 'skip');
});

test('chưa có lần chạy CI nào thì không merge', () => {
  const decision = decideMerge(pr({ ciConclusion: null, ciSha: null }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /chưa có lần chạy nào/);
});

test('CI xanh trên commit CŨ thì không merge — push mới đặt lại đồng hồ', () => {
  const decision = decideMerge(pr({ headSha: 'def5678' }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /đầu nhánh/);
});

test('KF-002 · PR đang xung đột thì bỏ qua, không thử merge rồi để API báo lỗi', () => {
  assert.equal(decideMerge(pr({ mergeable: false, mergeableState: 'dirty' })).outcome, 'skip');
});

test('KF-002 · mergeable null là "chưa biết", không phải "merge được"', () => {
  assert.equal(decideMerge(pr({ mergeable: null })).outcome, 'recheck');
});

// ── Mục `P-009` — nhãn `fix` đòi job `fix-has-test` xanh trên đúng commit ──

test('P-009 · PR nhãn fix mà job fix-has-test `skipped` thì KHÔNG merge dù ciConclusion tổng vẫn success', () => {
  // Đúng ca lỗ hổng: bất biến I2 vế hai bị thủng vì workflow run tổng thể
  // vẫn `success` khi step bị `if:` bỏ qua — job không skip nữa, nhưng cửa
  // này vẫn phải tự đứng vững kể cả khi có nguồn khác báo `skipped`.
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge', 'fix'], fixHasTestConclusion: 'skipped' }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /fix-has-test/);
});

test('P-009 · PR nhãn fix mà không tìm thấy check run fix-has-test (null) thì không merge', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge', 'fix'], fixHasTestConclusion: null }));
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /không tìm thấy/);
});

test('P-009 · PR nhãn fix mà job fix-has-test failure thì không merge', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge', 'fix'], fixHasTestConclusion: 'failure' }));
  assert.equal(decision.outcome, 'skip');
});

test('P-009 · PR nhãn fix mà job fix-has-test success thì merge bình thường', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge', 'fix'], fixHasTestConclusion: 'success' }));
  assert.equal(decision.outcome, 'merge');
});

test('P-009 · PR không mang nhãn fix thì fixHasTestConclusion không cản gì, kể cả null', () => {
  const decision = decideMerge(pr({ gate: 'open', labels: ['automerge'], fixHasTestConclusion: null }));
  assert.equal(decision.outcome, 'merge');
});

// ── Lời `dừng` của chủ dự án ─────────────────────────────────────────────

test('một comment "dừng" của chủ dự án chặn merge', () => {
  const decision = decideMerge(
    pr({ comments: [{ author: 'HungQuach301', body: 'dừng, để anh xem đã', createdAt: GREEN }] }),
  );
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /dừng/);
});

test('"DỪNG" viết hoa cũng tính', () => {
  assert.equal(
    decideMerge(pr({ comments: [{ author: 'HungQuach301', body: 'DỪNG', createdAt: GREEN }] })).outcome,
    'skip',
  );
});

test('lời "dừng" chặn cả PR thường, không riêng PR có chờ', () => {
  const decision = decideMerge(
    pr({
      gate: 'open',
      labels: ['automerge'],
      comments: [{ author: 'HungQuach301', body: 'dừng', createdAt: GREEN }],
    }),
  );
  assert.equal(decision.outcome, 'skip');
});

test('comment của chính agent KHÔNG chặn được — nó bắt đầu bằng 🤖', () => {
  const agent = { author: 'HungQuach301', body: '🤖 Đã gộp main. Không cần dừng.', createdAt: GREEN };
  assert.equal(isStopComment(agent, 'HungQuach301'), false);
  assert.equal(decideMerge(pr({ comments: [agent] })).outcome, 'merge');
});

test('comment của người khác không chặn', () => {
  assert.equal(isStopComment({ author: 'github-actions', body: 'dừng', createdAt: GREEN }, 'HungQuach301'), false);
});

test('tên tác giả không phân biệt hoa thường', () => {
  assert.equal(isStopComment({ author: 'hungquach301', body: 'dừng', createdAt: GREEN }, 'HungQuach301'), true);
});

test('comment không chứa chữ "dừng" thì không phải lệnh dừng', () => {
  assert.equal(
    isStopComment({ author: 'HungQuach301', body: 'ok anh xem rồi', createdAt: GREEN }, 'HungQuach301'),
    false,
  );
});

// ── Mốc thời gian hỏng ───────────────────────────────────────────────────

test('không biết CI xanh lúc nào thì không merge ở cửa có chờ', () => {
  assert.equal(decideMerge(pr({ ciCompletedAt: null })).outcome, 'skip');
});

test('mốc thời gian không đọc được thì không merge', () => {
  assert.equal(decideMerge(pr({ ciCompletedAt: 'hôm qua' })).outcome, 'skip');
});

// ── Lối đi nhanh `hotfix` (D-C07) ────────────────────────────────────────

const NOW_1H = '2026-09-21T01:00:00.000Z';

test('lối nhanh bỏ được cửa 12 giờ: CI xanh 1 giờ mà vẫn merge', () => {
  const decision = decideMerge(
    pr({ now: NOW_1H, labels: ['automerge-delayed', 'hotfix'], hotfix: { lane: 'hotfix', reason: 'cảnh báo nêu đúng file này' } }),
  );
  assert.equal(decision.outcome, 'merge');
  assert.match(decision.reason, /D-C07/);
});

test('chưa xét lối nhanh (`null`) thì vẫn chờ đủ 12 giờ — thiếu dữ liệu không rút ngắn gì', () => {
  assert.equal(decideMerge(pr({ now: NOW_1H, hotfix: null })).outcome, 'wait');
});

test('`needs-decision` và `normal` KHÔNG rút ngắn khoảng chờ', () => {
  for (const lane of ['needs-decision', 'normal'] as const) {
    const decision = decideMerge(pr({ now: NOW_1H, hotfix: { lane, reason: 'chạm tầng luật' } }));
    assert.equal(decision.outcome, 'wait', lane);
  }
});

test('điều kiện 4 · lối nhanh KHÔNG bỏ qua CI: CI đỏ thì vẫn skip', () => {
  const decision = decideMerge(
    pr({ now: NOW_1H, ciConclusion: 'failure', hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' } }),
  );
  assert.equal(decision.outcome, 'skip');
});

test('điều kiện 4 · lối nhanh KHÔNG bỏ qua CI xanh trên đúng đầu nhánh', () => {
  const decision = decideMerge(
    pr({ now: NOW_1H, ciSha: 'cũ0000', hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' } }),
  );
  assert.equal(decision.outcome, 'skip');
});

test('lối nhanh KHÔNG thắng lời `dừng` của chủ dự án', () => {
  const decision = decideMerge(
    pr({
      now: NOW_1H,
      hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' },
      comments: [{ author: 'HungQuach301', body: 'dừng cái này lại đã', createdAt: GREEN }],
    }),
  );
  assert.equal(decision.outcome, 'skip');
  assert.match(decision.reason, /dừng/);
});

test('lối nhanh KHÔNG mở được cửa `owner-merge`', () => {
  const decision = decideMerge(
    pr({ gate: 'owner-merge', hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' } }),
  );
  assert.equal(decision.outcome, 'skip');
});

test('lối nhanh KHÔNG bỏ qua bất biến I2 vế hai (`fix-has-test`)', () => {
  const decision = decideMerge(
    pr({
      now: NOW_1H,
      labels: ['automerge-delayed', 'hotfix', 'fix'],
      fixHasTestConclusion: 'skipped',
      hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' },
    }),
  );
  assert.equal(decision.outcome, 'skip');
});

test('lối nhanh KHÔNG merge một PR đang xung đột với `main`', () => {
  const decision = decideMerge(
    pr({ now: NOW_1H, mergeable: false, hotfix: { lane: 'hotfix', reason: 'đủ điều kiện' } }),
  );
  assert.equal(decision.outcome, 'skip');
});
