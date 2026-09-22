/**
 * Kiểm bốn cấp và trạng thái tổng hợp — mục `topic/T-005`.
 *
 * Tiêu chí xong thứ hai: "Agent không đặt được `verification.status =
 * 'verified'` bằng code." `tsc --noEmit` (phần của `pnpm check`) giữ vế
 * kiểu — `computeVerification` khai kiểu trả về `PendingOrFailed`, không
 * thể gán `'verified'`. Cụm test dưới đây giữ vế RUNTIME: mọi tổ hợp bằng
 * chứng, kể cả tổ hợp "mọi cấp bắt buộc đều đạt", vẫn không bao giờ ra
 * `'verified'`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ModelDefinition, FormulaRegistry } from '../src/model-runner.ts';
import {
  evaluateCaseTier,
  requiresSecondImplementation,
  evaluateSecondImplementation,
  evaluateLlmAssumptionCheck,
  computeVerification,
  verifiedClaimProblems,
  type EvidenceCase,
  type VerificationInput,
} from '../src/model-verify.ts';

function baseModel(overrides: Partial<ModelDefinition> = {}): ModelDefinition {
  return {
    schemaVersion: 0,
    modelId: 'data-explainer/M-001',
    version: '1.0',
    title: 'Mô hình thử',
    question: 'Đây là câu hỏi thử dài hơn hai mươi ký tự để qua được contract.',
    assumptions: ['Lãi suất không đổi trong kỳ.'],
    parameters: [
      { name: 'a', unit: 'usd', validRange: [0, 100], defaultValue: 10, source: 'assumption' },
      { name: 'b', unit: 'usd', validRange: [1, 100], defaultValue: 5, source: 'assumption' },
    ],
    formula: 'sum',
    outputs: [{ name: 'total', unit: 'usd', interpretation: 'Tổng hai tham số.' }],
    verification: { status: 'pending', tiers: [] },
    ...overrides,
  };
}

const REGISTRY: FormulaRegistry = { sum: (p) => ({ total: p['a']! + p['b']! }) };

const HAND_CASE: EvidenceCase = {
  caseId: 'C1',
  params: { a: 1, b: 2 },
  expected: { total: 3 },
  computedBy: 'người, tính tay',
};

function baseInput(overrides: Partial<VerificationInput> = {}): VerificationInput {
  return {
    model: baseModel(),
    registry: REGISTRY,
    tolerancePct: 0.01,
    handCases: [HAND_CASE],
    benchmarkAvailable: false,
    assumptionCheck: { reviewedAt: '2026-09-22T00:00:00Z', provider: 'gpt', unflaggedAssumptions: [], unitIssues: [] },
    ...overrides,
  };
}

// ── evaluateCaseTier (dùng chung cấp 1 và cấp 2) ───────────────────────────

test('evaluateCaseTier: không bắt buộc thì pass trivially, không chạy ca nào', () => {
  const result = evaluateCaseTier('published-benchmark', false, [], baseModel(), REGISTRY, 0.01);
  assert.equal(result.required, false);
  assert.equal(result.pass, true);
});

test('evaluateCaseTier: bắt buộc mà không có ca nào thì fail', () => {
  const result = evaluateCaseTier('hand-worked-case', true, [], baseModel(), REGISTRY, 0.01);
  assert.equal(result.pass, false);
});

test('evaluateCaseTier: ca khớp trong dung sai thì pass', () => {
  const result = evaluateCaseTier('hand-worked-case', true, [HAND_CASE], baseModel(), REGISTRY, 0.01);
  assert.equal(result.pass, true);
});

test('evaluateCaseTier: ca lệch quá dung sai thì fail', () => {
  const badCase: EvidenceCase = { ...HAND_CASE, expected: { total: 999 } };
  const result = evaluateCaseTier('hand-worked-case', true, [badCase], baseModel(), REGISTRY, 0.01);
  assert.equal(result.pass, false);
  assert.match(result.detail, /lệch quá dung sai/);
});

// ── requiresSecondImplementation / cấp 3 ──────────────────────────────────

test('requiresSecondImplementation: geoVarying true thì bắt buộc', () => {
  const model = baseModel({
    parameters: [{ name: 'a', unit: 'usd', validRange: [0, 1], defaultValue: 0, source: 'assumption', geoVarying: true }],
  });
  assert.equal(requiresSecondImplementation(model), true);
});

test('requiresSecondImplementation: dùng ở hơn 3 tập thì bắt buộc', () => {
  const model = baseModel({ usedByEpisodes: ['e1', 'e2', 'e3', 'e4'] });
  assert.equal(requiresSecondImplementation(model), true);
});

test('requiresSecondImplementation: mặc định không bắt buộc', () => {
  assert.equal(requiresSecondImplementation(baseModel()), false);
});

test('evaluateSecondImplementation: không bắt buộc thì pass trivially', () => {
  const result = evaluateSecondImplementation(false, [HAND_CASE], undefined, 0.01);
  assert.equal(result.pass, true);
  assert.equal(result.required, false);
});

test('evaluateSecondImplementation: bắt buộc mà chưa có bằng chứng thì fail', () => {
  const result = evaluateSecondImplementation(true, [HAND_CASE], undefined, 0.01);
  assert.equal(result.pass, false);
});

test('evaluateSecondImplementation: khớp bộ ca kiểm tay thì pass', () => {
  const result = evaluateSecondImplementation(
    true,
    [HAND_CASE],
    { implementationHash: 'abc123', results: [{ caseId: 'C1', result: { total: 3 } }] },
    0.01,
  );
  assert.equal(result.pass, true);
});

test('evaluateSecondImplementation: thiếu đúng ca kiểm tay thì fail', () => {
  const result = evaluateSecondImplementation(
    true,
    [HAND_CASE],
    { implementationHash: 'abc123', results: [{ caseId: 'khac', result: { total: 3 } }] },
    0.01,
  );
  assert.equal(result.pass, false);
});

test('evaluateSecondImplementation: lệch kết quả thì fail', () => {
  const result = evaluateSecondImplementation(
    true,
    [HAND_CASE],
    { implementationHash: 'abc123', results: [{ caseId: 'C1', result: { total: 999 } }] },
    0.01,
  );
  assert.equal(result.pass, false);
});

// ── cấp 4 ───────────────────────────────────────────────────────────────

test('evaluateLlmAssumptionCheck: chưa có báo cáo thì fail', () => {
  assert.equal(evaluateLlmAssumptionCheck(undefined).pass, false);
});

test('evaluateLlmAssumptionCheck: có báo cáo, không vấn đề thì pass', () => {
  const result = evaluateLlmAssumptionCheck({
    reviewedAt: '2026-09-22T00:00:00Z',
    provider: 'gpt',
    unflaggedAssumptions: [],
    unitIssues: [],
  });
  assert.equal(result.pass, true);
});

test('evaluateLlmAssumptionCheck: có vấn đề thì fail, không kiểm số học', () => {
  const result = evaluateLlmAssumptionCheck({
    reviewedAt: '2026-09-22T00:00:00Z',
    provider: 'gpt',
    unflaggedAssumptions: ['giả định X chưa khai'],
    unitIssues: [],
  });
  assert.equal(result.pass, false);
});

// ── computeVerification — không bao giờ 'verified' ────────────────────────

test('computeVerification: mọi cấp bắt buộc đạt thì status là pending, KHÔNG BAO GIỜ verified', () => {
  const outcome = computeVerification(baseInput());
  assert.notEqual(outcome.status, 'verified');
  assert.equal(outcome.status, 'pending');
});

test('computeVerification: thiếu ca kiểm tay (cấp 1, bắt buộc) thì status failed', () => {
  const outcome = computeVerification(baseInput({ handCases: [] }));
  assert.equal(outcome.status, 'failed');
});

test('computeVerification: cấp 3 bắt buộc (geoVarying) mà thiếu bằng chứng thì failed', () => {
  const model = baseModel({
    parameters: [{ name: 'a', unit: 'usd', validRange: [0, 1], defaultValue: 0, source: 'assumption', geoVarying: true }],
    formula: 'sum2',
  });
  const outcome = computeVerification(
    baseInput({
      model,
      registry: { sum2: (p) => ({ total: p['a']! }) },
      handCases: [{ caseId: 'C1', params: { a: 0.5 }, expected: { total: 0.5 }, computedBy: 'tay' }],
    }),
  );
  assert.equal(outcome.status, 'failed');
  const tier3 = outcome.tiers.find((t) => t.method === 'second-implementation');
  assert.equal(tier3?.required, true);
  assert.equal(tier3?.pass, false);
});

test('computeVerification: cấp 4 có vấn đề thì failed dù cấp 1 đạt', () => {
  const outcome = computeVerification(
    baseInput({
      assumptionCheck: { reviewedAt: '2026-09-22T00:00:00Z', provider: 'gpt', unflaggedAssumptions: ['x'], unitIssues: [] },
    }),
  );
  assert.equal(outcome.status, 'failed');
});

test('computeVerification: cấp 2 không bắt buộc khi benchmarkAvailable=false, dù không có ca', () => {
  const outcome = computeVerification(baseInput({ benchmarkAvailable: false, benchmarkCases: [] }));
  const tier2 = outcome.tiers.find((t) => t.method === 'published-benchmark');
  assert.equal(tier2?.required, false);
  assert.equal(tier2?.pass, true);
});

test('computeVerification: cấp 2 bắt buộc khi benchmarkAvailable=true, thiếu ca thì failed', () => {
  const outcome = computeVerification(baseInput({ benchmarkAvailable: true }));
  assert.equal(outcome.status, 'failed');
  const tier2 = outcome.tiers.find((t) => t.method === 'published-benchmark');
  assert.equal(tier2?.pass, false);
});

// ── verifiedClaimProblems — chỉ ĐỌC LẠI một claim đã có sẵn, không bao giờ ĐẶT ──

test('verifiedClaimProblems: model không claim verified thì không có vấn đề gì, dù thiếu bằng chứng', () => {
  const input = baseInput({ handCases: [] });
  assert.deepEqual(verifiedClaimProblems(input), []);
});

test('verifiedClaimProblems: claim verified mà thiếu approvedIssueUrl thì báo vấn đề', () => {
  const input = baseInput({
    model: baseModel({ verification: { status: 'verified', tiers: [] } }),
  });
  const problems = verifiedClaimProblems(input);
  assert.ok(problems.some((p) => p.includes('approvedIssueUrl')));
});

test('verifiedClaimProblems: claim verified, đủ approvedIssueUrl, mọi cấp bắt buộc đạt thì không có vấn đề', () => {
  const input = baseInput({
    model: baseModel({
      verification: { status: 'verified', approvedIssueUrl: 'https://github.com/x/y/issues/1', tiers: [] },
    }),
  });
  assert.deepEqual(verifiedClaimProblems(input), []);
});

test('verifiedClaimProblems: claim verified nhưng cấp bắt buộc chưa đạt thì báo vấn đề, nêu đúng cấp', () => {
  const input = baseInput({
    model: baseModel({
      verification: { status: 'verified', approvedIssueUrl: 'https://github.com/x/y/issues/1', tiers: [] },
    }),
    handCases: [],
  });
  const problems = verifiedClaimProblems(input);
  assert.ok(problems.some((p) => p.includes('hand-worked-case')));
});
