/**
 * `ops/scripts/prompt-eval.ts` + `ops/scripts/check-prompt-eval.ts` — bộ eval
 * chấm điểm cho prompt của xưởng `editorial` (mục `editorial/E-003`,
 * CHARTER 6.3 mục 3).
 *
 * Hai bài quan trọng nhất bám đúng hai tiêu chí xong:
 *   - **Quy tắc ba tập** (spec §2): `sampleSetCountProblems` phải ĐỎ khi có
 *     ít hơn `minSampleSets` tập — "đổi prompt phải chứng minh trên ba tập,
 *     không phải một".
 *   - **Ngưỡng nằm trong cấu hình** (spec §3): một chỉ số tụt/vọt quá dung
 *     sai khai trong genre pack thì `metricProblems` phải bắt được — "chỉ số
 *     nào tụt quá dung sai thì PR bị chặn".
 *
 * Bài khoá đầu-cuối: chỉ số ĐO THẬT của mỗi tập mẫu phải khớp baseline đã
 * ghi (`expected-metrics.json`). Nếu output `editorial` trôi mà baseline
 * không được cập nhật có chủ đích, bài này đỏ cùng lúc với `pnpm eval:prompt`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  editorialMetrics,
  metricProblems,
  sampleSetCountProblems,
  allowedDrift,
  METRIC_NAMES,
  type EditorialEvalPayload,
  type PromptEvalConfig,
} from '../scripts/prompt-eval.ts';
import {
  promptEvalConfig,
  loadSampleSets,
  metricsForBrief,
} from '../scripts/check-prompt-eval.ts';
import { loadChannelPack, loadGenrePack } from '@crux/kernel';

const CONFIG: PromptEvalConfig = {
  minSampleSets: 3,
  tolerances: {
    wordCount: { tolerancePct: 10 },
    deviceCount: { toleranceAbs: 0 },
  },
};

function samplePayload(over: Partial<EditorialEvalPayload> = {}): EditorialEvalPayload {
  return {
    outline: {
      beats: [
        { claimIds: ['C1'] },
        { claimIds: ['C2'] },
        { claimIds: [] },
      ],
      adBreaks: [{}, {}],
    },
    script: { wordCount: 76, claimIds: ['C1', 'C2', 'C3'], devicesUsed: ['d1', 'd2'] },
    selfCheck: { declaredBridgeCount: 7 },
    ...over,
  };
}

test('editorialMetrics đo đúng bộ chỉ số; sourcedClaimRatio là tỷ lệ claim thật sự gắn vào beat', () => {
  const m = editorialMetrics(samplePayload());
  assert.equal(m.wordCount, 76);
  assert.equal(m.beatCount, 3);
  assert.equal(m.deviceCount, 2);
  assert.equal(m.claimCount, 3);
  assert.equal(m.adBreakCount, 2);
  assert.equal(m.bridgeCount, 7);
  // C3 không nằm trong beat nào → 2/3.
  assert.equal(m.sourcedClaimRatio, Number((2 / 3).toFixed(4)));
});

test('editorialMetrics: không có claim thì sourcedClaimRatio = 1 (không chia cho 0)', () => {
  const m = editorialMetrics(
    samplePayload({ script: { wordCount: 10, claimIds: [], devicesUsed: [] } }),
  );
  assert.equal(m.claimCount, 0);
  assert.equal(m.sourcedClaimRatio, 1);
});

test('allowedDrift lấy giá trị lớn hơn giữa tuyệt đối và phần trăm', () => {
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
  assert.ok(near(allowedDrift(76, { tolerancePct: 10 }), 7.6));
  assert.equal(allowedDrift(76, { toleranceAbs: 10 }), 10);
  assert.ok(near(allowedDrift(76, { toleranceAbs: 3, tolerancePct: 10 }), 7.6));
  assert.equal(allowedDrift(76, undefined), 0);
});

test('chỉ số tụt quá dung sai thì CHẶN (spec §3)', () => {
  const baseline = { wordCount: 76 };
  // Dung sai 10% của 76 = 7,6. Lệch 14 > 7,6 → một vấn đề.
  const bad = metricProblems('set-x', editorialMetrics(samplePayload({ script: { wordCount: 90, claimIds: ['C1', 'C2', 'C3'], devicesUsed: ['d1', 'd2'] } })), baseline, CONFIG);
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.metric, 'wordCount');
  assert.equal(bad[0]!.baseline, 76);
  assert.equal(bad[0]!.actual, 90);
});

test('chỉ số trong dung sai thì KHÔNG chặn', () => {
  const baseline = { wordCount: 76 };
  // Lệch 4 < 7,6 → không vấn đề.
  const ok = metricProblems('set-x', editorialMetrics(samplePayload({ script: { wordCount: 80, claimIds: ['C1', 'C2', 'C3'], devicesUsed: ['d1', 'd2'] } })), baseline, CONFIG);
  assert.deepEqual(ok, []);
});

test('dung sai tuyệt đối 0: chỉ số cấu trúc lệch một đơn vị là chặn', () => {
  const baseline = { deviceCount: 2 };
  const bad = metricProblems('set-x', editorialMetrics(samplePayload({ script: { wordCount: 76, claimIds: ['C1'], devicesUsed: ['d1', 'd2', 'd3'] } })), baseline, CONFIG);
  assert.equal(bad.length, 1);
  assert.equal(bad[0]!.metric, 'deviceCount');
  assert.equal(bad[0]!.allowed, 0);
});

test('baseline thiếu một chỉ số thì không so chỉ số đó (không đỏ oan)', () => {
  const baseline = {}; // không khai gì
  assert.deepEqual(metricProblems('set-x', editorialMetrics(samplePayload()), baseline, CONFIG), []);
});

test('baseline CÓ chỉ số mà đo được lại thiếu (undefined) thì CHẶN, không nuốt', () => {
  const baseline = { wordCount: 76 };
  // Đo được thiếu wordCount (undefined) — NaN > x là false, phải bắt tường minh.
  const broken = { ...editorialMetrics(samplePayload()), wordCount: undefined } as unknown as Record<
    (typeof METRIC_NAMES)[number],
    number
  >;
  const problems = metricProblems('set-x', broken, baseline, CONFIG);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]!.metric, 'wordCount');
});

test('quy tắc ba tập: dưới ngưỡng thì ĐỎ, đủ ngưỡng thì xanh (spec §2)', () => {
  assert.equal(sampleSetCountProblems(['a', 'b'], CONFIG).length, 1);
  assert.equal(sampleSetCountProblems([], CONFIG).length, 1);
  assert.deepEqual(sampleSetCountProblems(['a', 'b', 'c'], CONFIG), []);
  assert.deepEqual(sampleSetCountProblems(['a', 'b', 'c', 'd'], CONFIG), []);
});

test('promptEvalConfig đọc ngưỡng từ genre pack thật; mặc định ba tập khi vắng', () => {
  const genre = loadGenrePack(process.cwd(), loadChannelPack(process.cwd(), 'us-personal-finance').genre);
  const cfg = promptEvalConfig(genre.limits);
  assert.equal(cfg.minSampleSets, 3);
  assert.ok(cfg.tolerances.wordCount, 'genre pack phải khai dung sai wordCount');
  // Vắng promptEval → mặc định 3, tolerances rỗng.
  assert.deepEqual(promptEvalConfig({}), { minSampleSets: 3, tolerances: {} });
});

test('có đủ ba tập mẫu trên đĩa, mỗi tập có baseline', () => {
  const sets = loadSampleSets(process.cwd());
  assert.ok(sets.length >= 3, `cần ≥ 3 tập mẫu, có ${sets.length}`);
  for (const s of sets) {
    assert.ok(s.baseline, `tập ${s.id} phải có expected-metrics.json`);
  }
});

test('khoá đầu-cuối: chỉ số đo thật của mỗi tập khớp baseline đã ghi', async () => {
  const root = process.cwd();
  const sets = loadSampleSets(root);
  for (const s of sets) {
    const metrics = await metricsForBrief(root, s.brief);
    for (const m of METRIC_NAMES) {
      assert.equal(
        metrics[m],
        s.baseline![m],
        `tập ${s.id} chỉ số ${m}: đo ${metrics[m]} ≠ baseline ${s.baseline![m]}`,
      );
    }
  }
});
