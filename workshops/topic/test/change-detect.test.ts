/**
 * Phát hiện dữ liệu thay đổi và đính chính — mục `topic/T-004` (spec WP-011).
 *
 * Hai tiêu chí xong, mỗi tiêu chí có test:
 *  - So được hai `asOfDate` của cùng một chuỗi và liệt kê ô nào đổi.
 *  - Issue sinh ra dẫn ngược tới `claimId` và tập bị ảnh hưởng, không chỉ tên chuỗi.
 *
 * Cộng năm acceptance test của WP-011 §6 (kể cả hai kiểm âm) và điều kiện dừng
 * §5b. Không gọi API (Đợt 0): mọi snapshot dựng bằng `buildSnapshot` từ dữ liệu
 * cố định.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, type BuildSnapshotInput, type Observation, type SeriesSnapshot } from '../src/snapshot.ts';
import {
  diffSnapshots,
  exceedsThreshold,
  assessChange,
  impactedClaims,
  assertBindings,
  detectAndReport,
  buildChangeIssue,
  issueDedupKey,
  dedupeIssues,
  ClaimTraceError,
  SeriesMismatchError,
  type ClaimBinding,
} from '../src/change-detect.ts';

// ── Dựng snapshot cho test ─────────────────────────────────────────────────

function mkSnapshot(
  asOfDate: string,
  observations: Observation[],
  opts: Partial<Pick<BuildSnapshotInput, 'unit' | 'frequency' | 'provider' | 'seriesId'>> = {},
): SeriesSnapshot {
  return buildSnapshot({
    provider: opts.provider ?? 'fred',
    seriesId: opts.seriesId ?? 'UNRATE',
    asOfDate,
    fetchedAt: `${asOfDate}T00:00:00.000Z`,
    provenance: 'hand-built',
    source: { publisher: 'Test', datasetRef: 'test' },
    unit: opts.unit ?? 'percent',
    frequency: opts.frequency ?? 'monthly',
    observations,
  });
}

const V1: Observation[] = [
  { period: '2026-03-01', value: 3.9 },
  { period: '2026-04-01', value: 4.0 },
  { period: '2026-05-01', value: 4.1 },
];

// ── diffSnapshots: liệt kê ô nào đổi (tiêu chí xong 1) ──────────────────────

test('diffSnapshots tách revised, added, removed và giữ thứ tự theo period', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 }, // không đổi
    { period: '2026-04-01', value: 4.2 }, // revised 4.0 -> 4.2
    // 2026-05-01 bị gỡ
    { period: '2026-06-01', value: 4.3 }, // added
  ]);
  const diff = diffSnapshots(prev, next);

  assert.deepEqual(diff.revised, [{ period: '2026-04-01', previousValue: 4.0, nextValue: 4.2 }]);
  assert.deepEqual(diff.added, [{ period: '2026-06-01', previousValue: null, nextValue: 4.3 }]);
  assert.deepEqual(diff.removed, [{ period: '2026-05-01', previousValue: 4.1, nextValue: null }]);
  assert.equal(diff.previousAsOfDate, '2026-06-01');
  assert.equal(diff.nextAsOfDate, '2026-07-01');
});

test('diffSnapshots coi đổi từ/đến null (ô thiếu) là revised, không phải add/remove', () => {
  const prev = mkSnapshot('2026-06-01', [{ period: '2026-03-01', value: null }]);
  const next = mkSnapshot('2026-07-01', [{ period: '2026-03-01', value: 3.9 }]);
  const diff = diffSnapshots(prev, next);
  assert.deepEqual(diff.revised, [{ period: '2026-03-01', previousValue: null, nextValue: 3.9 }]);
  assert.equal(diff.added.length, 0);
});

test('diffSnapshots ném khi so hai chuỗi khác nhau hoặc cùng asOfDate', () => {
  const a = mkSnapshot('2026-06-01', V1);
  const b = mkSnapshot('2026-07-01', V1, { seriesId: 'PAYEMS' });
  assert.throws(() => diffSnapshots(a, b), SeriesMismatchError);

  const c = mkSnapshot('2026-06-01', V1);
  const d = mkSnapshot('2026-06-01', V1);
  assert.throws(() => diffSnapshots(c, d), SeriesMismatchError);
});

// ── Ngưỡng: tuyệt đối thắng phần trăm, gần 0 ────────────────────────────────

test('exceedsThreshold: tuyệt đối thắng phần trăm khi cả hai được khai', () => {
  const change = { period: '2026-05-01', previousValue: 0.25, nextValue: 0.5 };
  // +0.25 tuyệt đối < 1.0, dù +100% phần trăm > 50%
  assert.equal(exceedsThreshold(change, { changeAlertThresholdAbs: 1.0, changeAlertThresholdPct: 50 }), false);
  // chỉ phần trăm: +100% > 50%
  assert.equal(exceedsThreshold(change, { changeAlertThresholdPct: 50 }), true);
  // không ngưỡng: mọi thay đổi khác 0 là đáng kể
  assert.equal(exceedsThreshold(change, {}), true);
});

test('exceedsThreshold: quanh 0 chỉ có ngưỡng phần trăm thì mọi thay đổi là đáng kể', () => {
  const change = { period: '2026-05-01', previousValue: 0, nextValue: 0.3 };
  assert.equal(exceedsThreshold(change, { changeAlertThresholdPct: 50 }), true);
});

// ── WP-011 §6 acceptance 1: một kỳ đổi quá ngưỡng -> đúng một issue, đúng tập ─

test('acceptance 1 · một kỳ đổi quá ngưỡng -> mở issue, liệt kê đúng tập/claim', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 },
    { period: '2026-04-01', value: 4.0 },
    { period: '2026-05-01', value: 4.8 }, // revised 4.1 -> 4.8 (+0.7)
  ]);
  const bindings: ClaimBinding[] = [
    { episodeId: 'us-personal-finance/ep-0002', claimId: 'C1', provider: 'fred', seriesId: 'UNRATE', period: '2026-05-01', publishedValue: 4.1 },
    // claim trỏ tới kỳ KHÔNG đổi -> không bị ảnh hưởng
    { episodeId: 'us-personal-finance/ep-0001', claimId: 'C2', provider: 'fred', seriesId: 'UNRATE', period: '2026-03-01', publishedValue: 3.9 },
    // claim của chuỗi khác -> bỏ qua
    { episodeId: 'us-personal-finance/ep-0003', claimId: 'C1', provider: 'bls', seriesId: 'LNS14000000', period: '2026-05-01', publishedValue: 4.1 },
  ];
  const issue = detectAndReport(prev, next, bindings, { changeAlertThresholdAbs: 0.5 });
  assert.ok(issue, 'phải mở issue');
  assert.equal(issue!.high, false);
  assert.equal(issue!.impact.length, 1);
  assert.deepEqual(issue!.impact[0], {
    episodeId: 'us-personal-finance/ep-0002',
    claimId: 'C1',
    period: '2026-05-01',
    publishedValue: 4.1,
    newValue: 4.8,
  });
});

// ── acceptance 2: chỉ thêm kỳ mới -> KHÔNG mở issue ─────────────────────────

test('acceptance 2 · chỉ thêm kỳ mới -> không mở issue', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [...V1, { period: '2026-06-01', value: 4.2 }]);
  const issue = detectAndReport(prev, next, [], {});
  assert.equal(issue, null);
  assert.equal(assessChange(prev, next).changeType, 'new-period');
});

// ── acceptance 3: đổi đơn vị mà giá trị không đổi -> issue mức cao ───────────

test('acceptance 3 · đổi đơn vị, giá trị không đổi -> issue mức cao, mọi claim bị chạm', () => {
  const prev = mkSnapshot('2026-06-01', V1, { unit: 'percent' });
  const next = mkSnapshot('2026-07-01', V1, { unit: 'index' });
  const bindings: ClaimBinding[] = [
    { episodeId: 'us-personal-finance/ep-0001', claimId: 'C1', provider: 'fred', seriesId: 'UNRATE', period: '2026-03-01', publishedValue: 3.9 },
    { episodeId: 'us-personal-finance/ep-0002', claimId: 'C2', provider: 'fred', seriesId: 'UNRATE', period: '2026-05-01', publishedValue: 4.1 },
  ];
  const issue = detectAndReport(prev, next, bindings, {});
  assert.ok(issue);
  assert.equal(issue!.high, true);
  // mọi claim của chuỗi bị chạm, kể cả khi giá trị của kỳ đó không đổi
  assert.equal(issue!.impact.length, 2);
  assert.deepEqual(issue!.impact.map((r) => r.newValue), [undefined, undefined]);
  assert.match(issue!.title, /CAO/);
});

// ── acceptance 4 (kiểm âm 1): dưới ngưỡng tuyệt đối -> KHÔNG mở issue ────────

test('acceptance 4 · 0.25 -> 0.5, ngưỡng tuyệt đối 1.0 -> không mở issue', () => {
  const prev = mkSnapshot('2026-06-01', [{ period: '2026-05-01', value: 0.25 }]);
  const next = mkSnapshot('2026-07-01', [{ period: '2026-05-01', value: 0.5 }]);
  const issue = detectAndReport(prev, next, [], { changeAlertThresholdAbs: 1.0, changeAlertThresholdPct: 50 });
  assert.equal(issue, null);
});

// ── acceptance 5 (kiểm âm 2): chạy lại hai lần -> vẫn một issue ──────────────

test('acceptance 5 · chạy lại hai lần -> cùng dedupKey, gộp còn một issue', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 },
    { period: '2026-04-01', value: 4.0 },
    { period: '2026-05-01', value: 4.8 },
  ]);
  const a = detectAndReport(prev, next, [], { changeAlertThresholdAbs: 0.5 })!;
  const b = detectAndReport(prev, next, [], { changeAlertThresholdAbs: 0.5 })!;
  assert.equal(a.dedupKey, b.dedupKey);
  assert.equal(a.dedupKey, 'fred:UNRATE:2026-07-01');
  assert.equal(dedupeIssues([a, b]).length, 1);
});

// ── Tiêu chí xong 2: issue dẫn về claimId + episodeId, không chỉ tên chuỗi ───

test('tiêu chí xong 2 · thân issue dẫn về claimId và episodeId cụ thể', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 },
    { period: '2026-04-01', value: 4.0 },
    { period: '2026-05-01', value: 4.8 },
  ]);
  const bindings: ClaimBinding[] = [
    { episodeId: 'us-personal-finance/ep-0002', claimId: 'C1', provider: 'fred', seriesId: 'UNRATE', period: '2026-05-01', publishedValue: 4.1 },
  ];
  const issue = detectAndReport(prev, next, bindings, { changeAlertThresholdAbs: 0.5 })!;
  assert.match(issue.body, /ep-0002/);
  assert.match(issue.body, /C1/);
  assert.match(issue.body, /4\.1/); // con số đã phát hành
  assert.match(issue.body, /4\.8/); // con số mới
  assert.match(issue.body, /đính chính/); // nút quyết định
});

// ── WP-011 §5b: không tra ngược được -> dừng, nêu trường thiếu ───────────────

test('§5b · ràng buộc thiếu trường -> ClaimTraceError nêu tên trường', () => {
  const bad = [{ episodeId: 'ep', claimId: 'C1', provider: 'fred', seriesId: 'UNRATE', period: '2026-05-01' }]; // thiếu publishedValue
  assert.throws(
    () => assertBindings(bad),
    (err: unknown) => err instanceof ClaimTraceError && /publishedValue/.test(err.message),
  );
});

test('§5b · claimId sai mẫu -> ClaimTraceError (không tra được về claims[].id)', () => {
  const bad = [{ episodeId: 'ep', claimId: 'X1', provider: 'fred', seriesId: 'UNRATE', period: '2026-05-01', publishedValue: 4.1 }];
  assert.throws(() => assertBindings(bad), ClaimTraceError);
});

test('impactedClaims ném khi một ràng buộc của chuỗi khác cũng thiếu trường', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 },
    { period: '2026-04-01', value: 4.0 },
    { period: '2026-05-01', value: 4.8 },
  ]);
  const assessment = assessChange(prev, next, { changeAlertThresholdAbs: 0.5 });
  const bindings = [{ episodeId: 'ep', claimId: 'C1', provider: 'fred', seriesId: 'UNRATE' }]; // thiếu period, publishedValue
  assert.throws(() => impactedClaims(assessment, bindings), ClaimTraceError);
});

// ── buildChangeIssue/issueDedupKey trực tiếp ────────────────────────────────

test('issueDedupKey theo provider:seriesId:nextAsOfDate', () => {
  const prev = mkSnapshot('2026-06-01', V1);
  const next = mkSnapshot('2026-07-01', [
    { period: '2026-03-01', value: 3.9 },
    { period: '2026-04-01', value: 4.0 },
    { period: '2026-05-01', value: 4.8 },
  ]);
  const assessment = assessChange(prev, next, { changeAlertThresholdAbs: 0.5 });
  assert.equal(issueDedupKey(assessment.diff), 'fred:UNRATE:2026-07-01');
  const issue = buildChangeIssue(assessment, []);
  assert.match(issue.body, /không có ràng buộc claim/); // không có binding thì nói rõ
});
