/**
 * `ops/scripts/pr-triage.ts` — cơ chế của mục `P-022`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABORTED_INELIGIBLE_ALERT_THRESHOLD,
  ANTI_COLLISION_HOURS,
  laneFromBranch,
  pickPrToHandle,
  shouldAlertStreak,
  type TriageCandidate,
} from '../scripts/pr-triage.ts';

function candidate(overrides: Partial<TriageCandidate> & { number: number; branch: string }): TriageCandidate {
  return {
    ciRed: false,
    hasUnhandledComment: false,
    abortedIneligibleStreak: 0,
    hoursSinceLastCommit: ANTI_COLLISION_HOURS,
    ...overrides,
  };
}

// laneFromBranch

test('laneFromBranch: nhánh mục backlog đúng quy ước ra đúng làn', () => {
  assert.equal(laneFromBranch('claude/visual/V-001'), 'visual');
  assert.equal(laneFromBranch('claude/platform/P-022-impl'), 'platform');
  assert.equal(laneFromBranch('claude/integration/I-004'), 'integration');
});

test('laneFromBranch: nhánh log-only của integrator (không có làn) ra null', () => {
  // Dạng `claude/sharp-einstein-1yj4sm` dùng cho các PR chỉ ghi log (PR #37, #41).
  assert.equal(laneFromBranch('claude/sharp-einstein-1yj4sm'), null);
});

test('laneFromBranch: đoạn thứ hai không phải tên làn thật ra null, không đoán gần đúng', () => {
  assert.equal(laneFromBranch('claude/not-a-lane/X-001'), null);
});

test('laneFromBranch: nhánh không theo quy ước claude/ ra null', () => {
  assert.equal(laneFromBranch('main'), null);
  assert.equal(laneFromBranch('visual/V-001'), null);
});

// pickPrToHandle

test('pickPrToHandle: danh sách rỗng ra null', () => {
  assert.equal(pickPrToHandle([]), null);
});

test('pickPrToHandle: không PR nào đủ điều kiện (không đỏ, không comment, không xung đột) ra null', () => {
  const result = pickPrToHandle([candidate({ number: 1, branch: 'claude/topic/T-001' })]);
  assert.equal(result, null);
});

test('pickPrToHandle: PR CI đỏ được chọn, đúng lý do', () => {
  const c = candidate({ number: 1, branch: 'claude/topic/T-001', ciRed: true });
  const result = pickPrToHandle([c]);
  assert.deepEqual(result, { candidate: c, reason: 'ci-red', lane: 'topic' });
});

test('pickPrToHandle: PR comment chưa xử lý được chọn, đúng lý do', () => {
  const c = candidate({ number: 2, branch: 'claude/editorial/E-001', hasUnhandledComment: true });
  const result = pickPrToHandle([c]);
  assert.deepEqual(result, { candidate: c, reason: 'unhandled-comment', lane: 'editorial' });
});

test('pickPrToHandle: PR aborted-ineligible (ca mới của P-022) được chọn, đúng lý do và đúng làn suy từ nhánh', () => {
  const c = candidate({ number: 39, branch: 'claude/visual/V-001', abortedIneligibleStreak: 3 });
  const result = pickPrToHandle([c]);
  assert.deepEqual(result, { candidate: c, reason: 'aborted-ineligible', lane: 'visual' });
});

test('pickPrToHandle: chống giẫm chân — commit mới dưới ANTI_COLLISION_HOURS thì KHÔNG được chọn dù CI đỏ', () => {
  const c = candidate({
    number: 1,
    branch: 'claude/topic/T-001',
    ciRed: true,
    hoursSinceLastCommit: ANTI_COLLISION_HOURS - 0.1,
  });
  assert.equal(pickPrToHandle([c]), null);
});

test('pickPrToHandle: chống giẫm chân áp dụng như nhau cho ca aborted-ineligible', () => {
  const c = candidate({
    number: 39,
    branch: 'claude/visual/V-001',
    abortedIneligibleStreak: 5,
    hoursSinceLastCommit: 0.5,
  });
  assert.equal(pickPrToHandle([c]), null);
});

test('pickPrToHandle: chống giẫm chân áp dụng cho ca comment chưa xử lý', () => {
  const c = candidate({
    number: 2,
    branch: 'claude/editorial/E-001',
    hasUnhandledComment: true,
    hoursSinceLastCommit: 1,
  });
  assert.equal(pickPrToHandle([c]), null);
});

test('pickPrToHandle: một PR vừa CI đỏ vừa comment chưa xử lý vẫn ra đúng lý do ưu tiên cao nhất (CI đỏ)', () => {
  const c = candidate({
    number: 1,
    branch: 'claude/topic/T-001',
    ciRed: true,
    hasUnhandledComment: true,
    abortedIneligibleStreak: 2,
  });
  const result = pickPrToHandle([c]);
  assert.equal(result?.reason, 'ci-red');
});

test('pickPrToHandle: nhiều PR đủ điều kiện — CI đỏ thắng comment và thắng aborted-ineligible', () => {
  const redPr = candidate({ number: 1, branch: 'claude/topic/T-001', ciRed: true });
  const commentPr = candidate({ number: 2, branch: 'claude/editorial/E-001', hasUnhandledComment: true });
  const conflictPr = candidate({ number: 39, branch: 'claude/visual/V-001', abortedIneligibleStreak: 4 });
  const result = pickPrToHandle([conflictPr, commentPr, redPr]);
  assert.equal(result?.candidate.number, 1);
  assert.equal(result?.reason, 'ci-red');
});

test('pickPrToHandle: comment thắng aborted-ineligible khi không có PR CI đỏ', () => {
  const commentPr = candidate({ number: 2, branch: 'claude/editorial/E-001', hasUnhandledComment: true });
  const conflictPr = candidate({ number: 39, branch: 'claude/visual/V-001', abortedIneligibleStreak: 4 });
  const result = pickPrToHandle([conflictPr, commentPr]);
  assert.equal(result?.candidate.number, 2);
  assert.equal(result?.reason, 'unhandled-comment');
});

test('pickPrToHandle: nhánh không suy được làn vẫn được chọn, `lane` là null', () => {
  const c = candidate({ number: 41, branch: 'claude/sharp-einstein-abc123', abortedIneligibleStreak: 1 });
  const result = pickPrToHandle([c]);
  assert.equal(result?.lane, null);
  assert.equal(result?.reason, 'aborted-ineligible');
});

// shouldAlertStreak

test('shouldAlertStreak: dưới ngưỡng thì không báo động', () => {
  assert.equal(shouldAlertStreak(ABORTED_INELIGIBLE_ALERT_THRESHOLD - 1), false);
  assert.equal(shouldAlertStreak(0), false);
});

test('shouldAlertStreak: đúng ngưỡng và trên ngưỡng thì báo động', () => {
  assert.equal(shouldAlertStreak(ABORTED_INELIGIBLE_ALERT_THRESHOLD), true);
  assert.equal(shouldAlertStreak(ABORTED_INELIGIBLE_ALERT_THRESHOLD + 5), true);
});
