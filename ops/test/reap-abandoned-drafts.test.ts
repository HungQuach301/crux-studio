/**
 * `ops/scripts/reap-abandoned-drafts.ts` — cơ chế của mục `I-001`.
 *
 * Chỉ kiểm các hàm thuần (`selectAbandoned`, `parseLaneAndId`,
 * `revertClaimedToReady`, `planReap`). Lớp gọi `gh` trong `main()` không có
 * gì để kiểm bằng chạy thật ở đây — không có PR thật để đóng — nên nó cố
 * tình để mỏng và không test, đúng lý do ghi trong file nguồn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABANDON_THRESHOLD_HOURS,
  parseLaneAndId,
  isAbandoned,
  selectAbandoned,
  revertClaimedToReady,
  abandonNote,
  planReap,
  applyBacklogUpdates,
  type DraftPrCandidate,
} from '../scripts/reap-abandoned-drafts.ts';

const NOW = new Date('2026-09-21T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

test('parseLaneAndId: khớp đúng dạng claude/<lane>/<id>', () => {
  assert.deepEqual(parseLaneAndId('claude/integration/I-001'), { lane: 'integration', id: 'I-001' });
  assert.deepEqual(parseLaneAndId('claude/visual/V-004b'), { lane: 'visual', id: 'V-004b' });
  assert.deepEqual(parseLaneAndId('claude/verify/VF-G1'), { lane: 'verify', id: 'VF-G1' });
});

test('parseLaneAndId: nhánh không đúng dạng thì null, không đoán', () => {
  assert.equal(parseLaneAndId('claude/charter-operations-mode-xdbvt4'), null);
  assert.equal(parseLaneAndId('main'), null);
  assert.equal(parseLaneAndId('claude/integration'), null);
});

test('isAbandoned: nháp + quá ngưỡng mới tính là bỏ', () => {
  assert.equal(isAbandoned({ isDraft: true, lastCommitAt: hoursAgo(73) }, NOW), true);
  assert.equal(isAbandoned({ isDraft: true, lastCommitAt: hoursAgo(71) }, NOW), false);
  assert.equal(isAbandoned({ isDraft: false, lastCommitAt: hoursAgo(1000) }, NOW), false, 'không phải nháp thì bỏ qua dù cũ');
});

test('isAbandoned: ngày giờ hỏng thì không đoán là bỏ', () => {
  assert.equal(isAbandoned({ isDraft: true, lastCommitAt: 'not-a-date' }, NOW), false);
});

test('selectAbandoned: lọc đúng danh sách, ngưỡng khai được', () => {
  const prs: DraftPrCandidate[] = [
    { number: 1, headRefName: 'claude/topic/T-001', isDraft: true, lastCommitAt: hoursAgo(100) },
    { number: 2, headRefName: 'claude/topic/T-002', isDraft: true, lastCommitAt: hoursAgo(10) },
    { number: 3, headRefName: 'claude/topic/T-003', isDraft: false, lastCommitAt: hoursAgo(100) },
  ];
  assert.deepEqual(
    selectAbandoned(prs, NOW).map((p) => p.number),
    [1],
  );
  assert.equal(ABANDON_THRESHOLD_HOURS, 72);
  // Ngưỡng tuỳ chỉnh: hạ xuống 5 giờ thì PR #2 (10 giờ) cũng bị coi là bỏ.
  assert.deepEqual(
    selectAbandoned(prs, NOW, 5).map((p) => p.number),
    [1, 2],
  );
});

const SAMPLE_BACKLOG = [
  '# 🤖 Backlog làn `integration` — Đợt 1',
  '',
  '---',
  '',
  '### I-001 · Dọn PR nháp đã bỏ',
  '- deps: —',
  '- risk: low',
  '- status: claimed',
  '- tiêu chí xong: đóng PR nháp cũ.',
  '',
  '### I-002 · Khác',
  '- deps: —',
  '- risk: low',
  '- status: ready',
].join('\n');

test('revertClaimedToReady: đổi đúng mục, không đụng mục khác', () => {
  const result = revertClaimedToReady(SAMPLE_BACKLOG, 'I-001');
  assert.equal(result.changed, true);
  assert.match(result.content, /### I-001 · Dọn PR nháp đã bỏ\n- deps: —\n- risk: low\n- status: ready\n/);
  // Mục I-002 (đã là ready) không bị chạm.
  assert.match(result.content, /### I-002 · Khác\n- deps: —\n- risk: low\n- status: ready/);
});

test('revertClaimedToReady: mục đã ready thì không đổi gì (idempotent)', () => {
  const result = revertClaimedToReady(SAMPLE_BACKLOG, 'I-002');
  assert.equal(result.changed, false);
  assert.equal(result.content, SAMPLE_BACKLOG);
});

test('revertClaimedToReady: không thấy mục thì không đổi gì, không lỗi', () => {
  const result = revertClaimedToReady(SAMPLE_BACKLOG, 'I-999');
  assert.equal(result.changed, false);
  assert.equal(result.content, SAMPLE_BACKLOG);
});

test('abandonNote: bắt đầu bằng 🤖 (quy ước CLAUDE.md mục 5) và nêu tên mục', () => {
  const note = abandonNote('integration', 'I-001', 80);
  assert.ok(note.startsWith('🤖'));
  assert.match(note, /integration\/I-001/);
  assert.match(note, /80 giờ/);
});

test('planReap: đóng đúng PR bỏ, cập nhật đúng làn, bỏ qua nhánh không khớp', () => {
  const prs: DraftPrCandidate[] = [
    { number: 21, headRefName: 'claude/integration/I-001', isDraft: true, lastCommitAt: hoursAgo(100) },
    { number: 22, headRefName: 'claude/integration/I-002', isDraft: true, lastCommitAt: hoursAgo(1) },
    { number: 23, headRefName: 'claude/weird-branch-name', isDraft: true, lastCommitAt: hoursAgo(200) },
  ];
  const backlogByLane = new Map([['integration', SAMPLE_BACKLOG]]);
  const plan = planReap(prs, NOW, backlogByLane);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]!.pr.number, 21);
  assert.equal(plan.actions[0]!.lane, 'integration');
  assert.equal(plan.actions[0]!.id, 'I-001');
  assert.equal(plan.actions[0]!.backlogChanged, true);

  assert.equal(plan.unparsed.length, 1);
  assert.equal(plan.unparsed[0]!.number, 23);

  const updated = plan.updatedBacklogs.get('integration');
  assert.ok(updated);
  assert.match(updated!, /### I-001 · Dọn PR nháp đã bỏ\n- deps: —\n- risk: low\n- status: ready\n/);
});

test('planReap: không có backlog cho làn đó thì vẫn đóng PR, chỉ không đổi file', () => {
  const prs: DraftPrCandidate[] = [
    { number: 30, headRefName: 'claude/audio/AU-001', isDraft: true, lastCommitAt: hoursAgo(200) },
  ];
  const plan = planReap(prs, NOW, new Map());
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]!.backlogChanged, false);
  assert.equal(plan.updatedBacklogs.size, 0);
});

test('planReap: không có PR nào bỏ thì không có hành động, không lỗi', () => {
  const plan = planReap([], NOW, new Map());
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.updatedBacklogs.size, 0);
  assert.deepEqual(plan.unparsed, []);
});

// --- applyBacklogUpdates: sửa lỗi review PR I-001 ("một PR đóng thất bại
// không được kéo theo trạng thái ready giả cho mục của nó, và không được
// chặn việc ghi backlog của các PR đã đóng thành công trước đó"). ---

const TWO_ITEM_BACKLOG = [
  '# 🤖 Backlog làn `integration`',
  '',
  '### I-001 · Một',
  '- status: claimed',
  '',
  '### I-002 · Hai',
  '- status: claimed',
].join('\n');

test('applyBacklogUpdates: chỉ đổi đúng các action được truyền vào', () => {
  const backlogByLane = new Map([['integration', TWO_ITEM_BACKLOG]]);
  const updated = applyBacklogUpdates(backlogByLane, [{ lane: 'integration', id: 'I-001' }]);
  const content = updated.get('integration')!;
  assert.match(content, /### I-001 · Một\n- status: ready/);
  // I-002 KHÔNG được truyền vào (mô phỏng PR của nó đóng thất bại) — phải
  // còn nguyên `claimed`, không được "mượn" theo I-001.
  assert.match(content, /### I-002 · Hai\n- status: claimed/);
});

test('applyBacklogUpdates: action rỗng (mọi PR đóng đều thất bại) thì không đổi gì', () => {
  const backlogByLane = new Map([['integration', TWO_ITEM_BACKLOG]]);
  const updated = applyBacklogUpdates(backlogByLane, []);
  assert.equal(updated.size, 0);
});

test('applyBacklogUpdates: hai action cùng làn, cả hai đều áp được (không mất action đầu)', () => {
  const backlogByLane = new Map([['integration', TWO_ITEM_BACKLOG]]);
  const updated = applyBacklogUpdates(backlogByLane, [
    { lane: 'integration', id: 'I-001' },
    { lane: 'integration', id: 'I-002' },
  ]);
  const content = updated.get('integration')!;
  assert.match(content, /### I-001 · Một\n- status: ready/);
  assert.match(content, /### I-002 · Hai\n- status: ready/);
});

test('planReap: backlogChanged của mỗi action độc lập, không phụ thuộc action khác cùng làn', () => {
  const prs: DraftPrCandidate[] = [
    { number: 1, headRefName: 'claude/integration/I-001', isDraft: true, lastCommitAt: hoursAgo(100) },
    { number: 2, headRefName: 'claude/integration/I-002', isDraft: true, lastCommitAt: hoursAgo(100) },
  ];
  const backlogByLane = new Map([['integration', TWO_ITEM_BACKLOG]]);
  const plan = planReap(prs, NOW, backlogByLane);
  assert.equal(plan.actions.find((a) => a.id === 'I-001')!.backlogChanged, true);
  assert.equal(plan.actions.find((a) => a.id === 'I-002')!.backlogChanged, true);
});
