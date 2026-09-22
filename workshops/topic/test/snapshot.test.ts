/**
 * Kho ảnh chụp dữ liệu có phiên bản — mục `topic/T-003`.
 *
 * Ba tiêu chí xong, mỗi tiêu chí một cụm test:
 *  - Ba adapter chuẩn hoá về cùng contract snapshot.
 *  - `asOfDate` + băm nội dung: chạy lại cùng phiên bản cho ra cùng dữ liệu.
 *  - Thiếu secret thì DỪNG và báo đúng tên secret thiếu.
 *
 * Không gọi API thật (Đợt 0, CHARTER mục 9): đường `fetchSnapshot` được test
 * bằng một `transport` giả trả dữ liệu gốc cố định.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SECRET_ENV,
  PROVIDERS,
  MissingSecretError,
  LiveFetchNotWiredError,
  NormalizeError,
  requireSecret,
  missingSecrets,
  coerceValue,
  blsPeriodToIso,
  censusTimeToIso,
  normalizeFred,
  normalizeBls,
  normalizeCensus,
  buildSnapshot,
  snapshotContentHash,
  snapshotProblems,
  snapshotIdOf,
  sameData,
  fetchSnapshot,
  validateSnapshot,
  type FredRaw,
  type BlsRaw,
  type CensusRaw,
  type BuildSnapshotInput,
} from '../src/snapshot.ts';

// ── Dữ liệu gốc cố định cho ba nhà cung cấp ────────────────────────────────

const FRED_RAW: FredRaw = {
  observations: [
    { date: '2026-03-01', value: '3.8' },
    { date: '2026-04-01', value: '3.9' },
    { date: '2026-05-01', value: '.' }, // FRED báo thiếu bằng '.'
  ],
};

const BLS_RAW: BlsRaw = {
  Results: {
    series: [
      {
        seriesID: 'LNS14000000',
        data: [
          // BLS trả mới trước; adapter phải xếp lại theo period.
          { year: '2026', period: 'M05', value: '4.1' },
          { year: '2026', period: 'M04', value: '' }, // BLS báo thiếu bằng rỗng
          { year: '2026', period: 'M03', value: '4.0' },
        ],
      },
    ],
  },
};

const CENSUS_RAW: CensusRaw = [
  ['B25077_001E', 'time'],
  ['250000', '2024'],
  ['255000', '2025'],
];

const SRC = { publisher: 'Test Publisher', datasetRef: 'Test dataset' };
const MK = (over: Partial<BuildSnapshotInput> = {}): BuildSnapshotInput => ({
  provider: 'fred',
  seriesId: 'UNRATE',
  asOfDate: '2026-06-01',
  fetchedAt: '2026-06-15T10:00:00.000Z',
  provenance: 'hand-built',
  source: SRC,
  unit: 'Percent',
  frequency: 'monthly',
  observations: [
    { period: '2026-04-01', value: 3.9 },
    { period: '2026-05-01', value: null },
  ],
  ...over,
});

// ── 1. Ba adapter chuẩn hoá về cùng contract ───────────────────────────────

test('normalizeFred: ISO date giữ nguyên, "." thành null, xếp theo period', () => {
  const n = normalizeFred(FRED_RAW, { unit: 'Percent', frequency: 'monthly' });
  assert.deepEqual(n.observations, [
    { period: '2026-03-01', value: 3.8 },
    { period: '2026-04-01', value: 3.9 },
    { period: '2026-05-01', value: null },
  ]);
  assert.equal(n.unit, 'Percent');
});

test('normalizeBls: M05/M04 thành đầu tháng, rỗng thành null, xếp cũ trước', () => {
  const n = normalizeBls(BLS_RAW, { unit: 'Percent', frequency: 'monthly' });
  assert.deepEqual(n.observations, [
    { period: '2026-03-01', value: 4.0 },
    { period: '2026-04-01', value: null },
    { period: '2026-05-01', value: 4.1 },
  ]);
});

test('normalizeCensus: cột time thành ISO đầu năm, cột đầu là giá trị', () => {
  const n = normalizeCensus(CENSUS_RAW, { unit: 'Dollars', frequency: 'annual' });
  assert.deepEqual(n.observations, [
    { period: '2024-01-01', value: 250000 },
    { period: '2025-01-01', value: 255000 },
  ]);
});

test('ba adapter cho ra observations cùng hình dạng {period, value}', () => {
  const shapes = [
    normalizeFred(FRED_RAW, { unit: 'Percent', frequency: 'monthly' }),
    normalizeBls(BLS_RAW, { unit: 'Percent', frequency: 'monthly' }),
    normalizeCensus(CENSUS_RAW, { unit: 'Dollars', frequency: 'annual' }),
  ];
  for (const s of shapes) {
    for (const o of s.observations) {
      assert.deepEqual(Object.keys(o).sort(), ['period', 'value']);
      assert.match(o.period, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(o.value === null || typeof o.value === 'number');
    }
  }
});

test('normalize ném khi dữ liệu gốc sai hình dạng', () => {
  assert.throws(() => normalizeFred({} as FredRaw, { unit: 'x', frequency: 'other' }), NormalizeError);
  assert.throws(() => normalizeBls({ Results: { series: [] } } as BlsRaw, { unit: 'x', frequency: 'other' }), NormalizeError);
  assert.throws(() => normalizeCensus([['B25077_001E', 'state']], { unit: 'x', frequency: 'other' }), NormalizeError);
});

// ── phép ép giá trị và kỳ ──────────────────────────────────────────────────

test('coerceValue: token thiếu thành null, số ra số, chuỗi lạ thì ném', () => {
  for (const t of ['', '.', 'NA', 'n/a', 'null', '-']) assert.equal(coerceValue(t), null);
  assert.equal(coerceValue('3.9'), 3.9);
  assert.equal(coerceValue('  12 '), 12);
  assert.equal(coerceValue(7), 7);
  assert.equal(coerceValue(null), null);
  assert.throws(() => coerceValue('abc'), NormalizeError);
});

test('blsPeriodToIso và censusTimeToIso', () => {
  assert.equal(blsPeriodToIso('2026', 'M05'), '2026-05-01');
  assert.equal(blsPeriodToIso('2026', 'Q02'), '2026-04-01');
  assert.equal(blsPeriodToIso('2026', 'M13'), '2026-01-01');
  assert.throws(() => blsPeriodToIso('2026', 'X99'), NormalizeError);
  assert.equal(censusTimeToIso('2026'), '2026-01-01');
  assert.equal(censusTimeToIso('2026-05'), '2026-05-01');
  assert.equal(censusTimeToIso('2026-Q3'), '2026-07-01');
  assert.equal(censusTimeToIso('2026-05-01'), '2026-05-01');
  assert.throws(() => censusTimeToIso('mùa xuân'), NormalizeError);
});

// ── 2. asOfDate + băm nội dung: tất định ───────────────────────────────────

test('buildSnapshot: hợp contract, snapshotId và contentHash dẫn xuất đúng', () => {
  const s = buildSnapshot(MK());
  assert.deepEqual(snapshotProblems(s), []);
  assert.equal(s.snapshotId, snapshotIdOf('fred', 'UNRATE', '2026-06-01'));
  assert.match(s.contentHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(validateSnapshot(s).errors, []);
});

test('chạy lại cùng asOfDate + cùng dữ liệu -> cùng contentHash (khác fetchedAt vẫn trùng)', () => {
  const a = buildSnapshot(MK({ fetchedAt: '2026-06-15T10:00:00.000Z' }));
  const b = buildSnapshot(MK({ fetchedAt: '2026-06-20T23:59:00.000Z' }));
  assert.equal(a.contentHash, b.contentHash);
  assert.ok(sameData(a, b));
});

test('đổi một giá trị -> contentHash đổi', () => {
  const base = buildSnapshot(MK());
  const changed = buildSnapshot(
    MK({ observations: [{ period: '2026-04-01', value: 4.0 }, { period: '2026-05-01', value: null }] }),
  );
  assert.notEqual(base.contentHash, changed.contentHash);
  assert.ok(!sameData(base, changed));
});

test('đổi asOfDate -> contentHash và snapshotId đổi', () => {
  const base = buildSnapshot(MK());
  const other = buildSnapshot(MK({ asOfDate: '2026-07-01' }));
  assert.notEqual(base.contentHash, other.contentHash);
  assert.notEqual(base.snapshotId, other.snapshotId);
});

test('snapshotProblems bắt contentHash bị sửa tay và snapshotId lệch', () => {
  const s = buildSnapshot(MK());
  assert.ok(snapshotProblems({ ...s, contentHash: 'f'.repeat(64) }).some((p) => p.includes('contentHash')));
  assert.ok(snapshotProblems({ ...s, snapshotId: 'fred:WRONG:2026-06-01' }).some((p) => p.includes('snapshotId')));
});

test('buildSnapshot ném khi phần chuẩn hoá lệch contract (period không phải ISO)', () => {
  assert.throws(
    () => buildSnapshot(MK({ observations: [{ period: 'tháng năm', value: 1 }] })),
    NormalizeError,
  );
});

// ── 3. Thiếu secret thì DỪNG và báo tên secret ─────────────────────────────

test('requireSecret: thiếu -> MissingSecretError mang đúng tên biến; có -> trả khoá', () => {
  for (const p of PROVIDERS) {
    assert.throws(
      () => requireSecret(p, {}),
      (err: unknown) => err instanceof MissingSecretError && err.secretName === SECRET_ENV[p] && err.provider === p,
    );
    // Chuỗi chỉ có khoảng trắng coi như thiếu.
    assert.throws(() => requireSecret(p, { [SECRET_ENV[p]]: '   ' }), MissingSecretError);
    assert.equal(requireSecret(p, { [SECRET_ENV[p]]: 'k-123' }), 'k-123');
  }
});

test('missingSecrets liệt kê đúng nhà cung cấp còn thiếu', () => {
  assert.deepEqual(missingSecrets({}), ['fred', 'bls', 'census']);
  assert.deepEqual(missingSecrets({ FRED_API_KEY: 'x', BLS_API_KEY: 'y', CENSUS_API_KEY: 'z' }), []);
  assert.deepEqual(missingSecrets({ FRED_API_KEY: 'x' }), ['bls', 'census']);
});

test('fetchSnapshot: thiếu secret -> DỪNG với MissingSecretError, transport KHÔNG được gọi', async () => {
  let called = false;
  const transport = () => {
    called = true;
    return FRED_RAW;
  };
  await assert.rejects(
    fetchSnapshot('fred', {
      seriesId: 'UNRATE',
      asOfDate: '2026-06-01',
      source: SRC,
      meta: { unit: 'Percent', frequency: 'monthly' },
      env: {},
      transport,
    }),
    (err: unknown) => err instanceof MissingSecretError && err.secretName === 'FRED_API_KEY',
  );
  assert.equal(called, false, 'cổng secret phải chặn trước khi chạm transport');
});

test('fetchSnapshot: có khoá + transport giả -> snapshot hợp contract, provenance api', async () => {
  const snap = await fetchSnapshot('bls', {
    seriesId: 'LNS14000000',
    asOfDate: '2026-06-01',
    source: { publisher: 'U.S. Bureau of Labor Statistics', datasetRef: 'CPS, LNS14000000' },
    meta: { unit: 'Percent', frequency: 'monthly' },
    env: { BLS_API_KEY: 'k' },
    transport: () => BLS_RAW,
    now: () => '2026-06-15T10:00:00.000Z',
  });
  assert.deepEqual(snapshotProblems(snap), []);
  assert.equal(snap.provenance, 'api');
  assert.equal(snap.provider, 'bls');
  assert.equal(snap.observations.length, 3);
});

test('fetchSnapshot: có khoá nhưng transport mặc định -> LiveFetchNotWiredError (không MissingSecret)', async () => {
  await assert.rejects(
    fetchSnapshot('census', {
      seriesId: 'B25077_001E',
      asOfDate: '2026-06-01',
      source: SRC,
      meta: { unit: 'Dollars', frequency: 'annual' },
      env: { CENSUS_API_KEY: 'k' },
    }),
    LiveFetchNotWiredError,
  );
});

// ── F1/F2/F4: ràng buộc bổ sung sau vòng soát ──────────────────────────────

test('F1: asOfDate rác bị chặn — buildSnapshot ném, snapshotProblems báo asOfDate', () => {
  assert.throws(() => buildSnapshot(MK({ asOfDate: 'NOT-A-DATE' })), NormalizeError);
  assert.throws(() => buildSnapshot(MK({ asOfDate: '' })), NormalizeError);
  const s = buildSnapshot(MK());
  assert.ok(snapshotProblems({ ...s, asOfDate: 'NOT-A-DATE' }).some((p) => p.includes('asOfDate')));
});

test('F2: BLS bình quân năm M13 đụng M01 -> ném NormalizeError (không nuốt)', () => {
  const raw: BlsRaw = {
    Results: {
      series: [
        {
          seriesID: 'X',
          data: [
            { year: '2026', period: 'M13', value: '4.0' }, // bình quân năm -> 2026-01-01
            { year: '2026', period: 'M01', value: '3.7' }, // -> 2026-01-01, đụng
          ],
        },
      ],
    },
  };
  assert.throws(() => normalizeBls(raw, { unit: 'Percent', frequency: 'monthly' }), NormalizeError);
});

test('F2: Census nhiều vùng cùng time -> đụng period -> ném', () => {
  const raw: CensusRaw = [
    ['B25077_001E', 'time'],
    ['250000', '2024'],
    ['300000', '2024'], // cùng time, vùng khác -> đụng period
  ];
  assert.throws(() => normalizeCensus(raw, { unit: 'Dollars', frequency: 'annual' }), NormalizeError);
});

test('F2: tất định bất kể thứ tự dòng API — đảo thứ tự cho ra cùng contentHash', () => {
  const asc: FredRaw = { observations: [
    { date: '2026-03-01', value: '1' },
    { date: '2026-04-01', value: '2' },
    { date: '2026-05-01', value: '3' },
  ] };
  const desc: FredRaw = { observations: [...asc.observations].reverse() };
  const build = (raw: FredRaw) =>
    buildSnapshot({
      provider: 'fred', seriesId: 'UNRATE', asOfDate: '2026-06-01',
      fetchedAt: '2026-06-15T10:00:00.000Z', provenance: 'hand-built', source: SRC,
      ...normalizeFred(raw, { unit: 'Percent', frequency: 'monthly' }),
    });
  assert.equal(build(asc).contentHash, build(desc).contentHash);
});

test('F4: dòng Census ngắn hơn tiêu đề -> NormalizeError, không TypeError thô', () => {
  const raw = [['B25077_001E', 'time'], ['250000']] as CensusRaw; // thiếu ô time
  assert.throws(() => normalizeCensus(raw, { unit: 'Dollars', frequency: 'annual' }), NormalizeError);
});

test('fetchSnapshot tất định: hai lần với transport giả cùng dữ liệu -> cùng contentHash', async () => {
  const call = (now: string) =>
    fetchSnapshot('fred', {
      seriesId: 'UNRATE',
      asOfDate: '2026-06-01',
      source: SRC,
      meta: { unit: 'Percent', frequency: 'monthly' },
      env: { FRED_API_KEY: 'k' },
      transport: () => FRED_RAW,
      now: () => now,
    });
  const a = await call('2026-06-15T10:00:00.000Z');
  const b = await call('2026-07-01T00:00:00.000Z');
  assert.ok(sameData(a, b));
});
