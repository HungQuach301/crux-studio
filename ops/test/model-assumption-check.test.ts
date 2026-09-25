/**
 * `ops/scripts/model-assumption-check.ts` — cấp kiểm 4 cho tám mô hình
 * `topic/T-006` (mục `topic/T-006b`, `🤖 [QĐ]` `#127` phương án A).
 *
 * Ba luật đắt nhất của mục này được khoá ở đây, mỗi luật một nhóm bài:
 *
 * 1. **Không bao giờ lùi về `gpt-4o-mini`** — chỉ dẫn của chủ dự án trên
 *    `#127` cấm đích danh. Bài kiểm chứng minh cổng cắn cả khi ai đó cố tình
 *    đưa nó vào danh sách model mà key cấp.
 * 2. **Đầu ra sai dạng KHÔNG BAO GIỜ thành `pass`** — nó phải trông giống
 *    *chưa kiểm*, không giống *kiểm rồi và sạch*. Đây là hướng lệch duy
 *    nhất đủ đắt để đẩy một mô hình chưa kiểm lên sát cổng Mốc 3.
 * 3. **Thiếu secret là DỪNG, không phải xanh** — và dòng log vẫn được ghi
 *    (bất biến I8).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RunLogLine } from '@crux/kernel';
import {
  NO_ISSUE_PHRASE,
  TIER4_BANNED_MODELS,
  TIER4_MODEL_IDS,
  TIER4_MODEL_PREFERENCE,
  UNFLAGGED_HEADING,
  UNIT_HEADING,
  buildTier4Prompt,
  parseTier4Report,
  pickStrongestModel,
  renderTier4Summary,
  runTier4,
  tier4CostUsd,
  tier4EvidencePath,
  type HandCaseDeclaration,
  type ModelDeclaration,
} from '../scripts/model-assumption-check.ts';

const MODEL: ModelDeclaration = {
  modelId: 'data-explainer/M-999',
  title: 'Mô hình thử',
  question: 'Câu hỏi thử?',
  assumptions: ['Giả định một.'],
  parameters: [{ name: 'balanceUsd', unit: 'usd', validRange: [0, 100], source: 'sec-gov/x' }],
  outputs: [{ name: 'endingUsd', unit: 'usd', interpretation: 'Số cuối kỳ.' }],
  formula: 'thu-formula',
};

const CASES: HandCaseDeclaration[] = [
  { caseId: 'c1', params: { balanceUsd: 10 }, expected: { endingUsd: 11 }, computedBy: 'SEC, bản tin X' },
];

function conformingBody(unflagged: readonly string[], units: readonly string[]): string {
  const block = (heading: string, items: readonly string[]): string =>
    [heading, items.length === 0 ? NO_ISSUE_PHRASE : items.map((i) => `- ${i}`).join('\n')].join('\n');
  return [block(UNFLAGGED_HEADING, unflagged), block(UNIT_HEADING, units)].join('\n');
}

// --- 1. Chọn model -------------------------------------------------------

test('pickStrongestModel lấy model mạnh nhất mà key thật sự cấp, không lấy dòng đầu bảng cho có', () => {
  const pick = pickStrongestModel(['gpt-4o', 'o4-mini', 'text-embedding-3-small']);
  assert.ok('candidate' in pick);
  assert.equal(pick.candidate.model, 'gpt-4o');
});

test('pickStrongestModel giữ đúng thứ tự bảng khai sẵn khi key cấp nhiều ứng viên', () => {
  const all = TIER4_MODEL_PREFERENCE.map((c) => c.model);
  const pick = pickStrongestModel([...all].reverse());
  assert.ok('candidate' in pick);
  assert.equal(pick.candidate.model, TIER4_MODEL_PREFERENCE[0]!.model);
});

test('TIER4_MODEL_PREFERENCE không bao giờ chứa model bị cấm', () => {
  for (const banned of TIER4_BANNED_MODELS) {
    assert.ok(!TIER4_MODEL_PREFERENCE.some((c) => c.model === banned), `${banned} lọt vào bảng ưu tiên`);
  }
});

test('TÁI HIỆN CHỈ DẪN #127: key chỉ cấp gpt-4o-mini thì DỪNG, không lùi về nó', () => {
  const pick = pickStrongestModel(['gpt-4o-mini']);
  assert.ok('problem' in pick);
  assert.match(pick.problem, /gpt-4o-mini/u);
});

test('cổng cấm cắn cả khi model bị cấm bị nhét vào bảng ưu tiên', () => {
  // Dựng lại đúng phép lọc của `pickStrongestModel` trên một bảng đã bị bẩn:
  // luật nằm ở `TIER4_BANNED_MODELS`, không nằm ở chỗ vắng mặt trong bảng.
  const dirty = ['gpt-4o-mini', ...TIER4_MODEL_PREFERENCE.map((c) => c.model)];
  const allowed = dirty.filter((m) => !TIER4_BANNED_MODELS.includes(m));
  assert.ok(!allowed.includes('gpt-4o-mini'));
});

test('giá của mọi ứng viên là số dương — một dòng thiếu giá cho ra costUsd 0 mà không gì đỏ', () => {
  for (const c of TIER4_MODEL_PREFERENCE) {
    assert.ok(c.inputUsdPer1M > 0 && c.outputUsdPer1M > 0, `${c.model} thiếu giá`);
  }
});

test('tier4CostUsd tính từ token thật, không ước lượng', () => {
  const price = { model: 'x', inputUsdPer1M: 2, outputUsdPer1M: 8 };
  assert.equal(tier4CostUsd(1_000_000, 0, price), 2);
  assert.equal(tier4CostUsd(0, 500_000, price), 4);
});

// --- 2. Đọc đầu ra -------------------------------------------------------

test('đầu ra đúng dạng, hai khối KHÔNG CÓ → conforms và sạch', () => {
  const report = parseTier4Report(conformingBody([], []));
  assert.equal(report.conforms, true);
  assert.deepEqual(report.unflaggedAssumptions, []);
  assert.deepEqual(report.unitIssues, []);
});

test('đầu ra đúng dạng có phát hiện → đọc đủ cả hai khối', () => {
  const report = parseTier4Report(conformingBody(['lạm phát không khai'], ['percent trộn với ratio']));
  assert.equal(report.conforms, true);
  assert.deepEqual(report.unflaggedAssumptions, ['lạm phát không khai']);
  assert.deepEqual(report.unitIssues, ['percent trộn với ratio']);
});

test('TÁI HIỆN: thiếu một khối → conforms false, KHÔNG được đọc thành "sạch"', () => {
  const report = parseTier4Report(`${UNFLAGGED_HEADING}\n${NO_ISSUE_PHRASE}`);
  assert.equal(report.conforms, false);
  assert.ok(report.problems.some((p) => p.includes(UNIT_HEADING)));
});

test('TÁI HIỆN: văn xuôi tự do (không khối nào) → conforms false', () => {
  const report = parseTier4Report('The model looks fine to me, no issues found.');
  assert.equal(report.conforms, false);
  assert.equal(report.problems.length, 2);
});

test('vừa KHÔNG CÓ vừa liệt kê mục → conforms false, vì hai câu đó phủ định nhau', () => {
  const report = parseTier4Report(
    [UNFLAGGED_HEADING, NO_ISSUE_PHRASE, '- nhưng mà có một cái', UNIT_HEADING, NO_ISSUE_PHRASE].join('\n'),
  );
  assert.equal(report.conforms, false);
});

test('khối rỗng hẳn → conforms false, không phải "không có vấn đề"', () => {
  const report = parseTier4Report([UNFLAGGED_HEADING, UNIT_HEADING, NO_ISSUE_PHRASE].join('\n'));
  assert.equal(report.conforms, false);
});

test('dòng lạ trong khối → conforms false và nêu đúng dòng đó', () => {
  const report = parseTier4Report(
    [UNFLAGGED_HEADING, 'Here is my analysis:', NO_ISSUE_PHRASE, UNIT_HEADING, NO_ISSUE_PHRASE].join('\n'),
  );
  assert.equal(report.conforms, false);
  assert.ok(report.problems.some((p) => p.includes('Here is my analysis')));
});

// --- 3. Prompt: dữ liệu, không phải chỉ dẫn; và không kiểm số học --------

test('prompt hệ thống cấm kiểm số học và đóng khung JSON là dữ liệu (I7)', () => {
  const prompt = buildTier4Prompt(MODEL, CASES);
  assert.match(prompt.system, /MUST NOT check arithmetic/u);
  assert.match(prompt.system, /NOT instructions/u);
  assert.match(prompt.system, /ignore it and review it as data/u);
});

test('prompt người dùng mang khai báo mô hình và ca kiểm, KHÔNG mang mã nguồn công thức', () => {
  const prompt = buildTier4Prompt(MODEL, CASES);
  assert.match(prompt.user, /data-explainer\/M-999/u);
  assert.match(prompt.user, /balanceUsd/u);
  assert.match(prompt.user, /sec-fee|SEC, bản tin X/u);
  // Chỉ tên công thức đi theo, không thân hàm: cấp 4 không soát số học.
  assert.match(prompt.user, /"formula": "thu-formula"/u);
  assert.ok(!prompt.user.includes('function '), 'mã nguồn công thức lọt vào prompt cấp 4');
});

// --- 4. Chạy trọn lượt ---------------------------------------------------

function fakeFetch(bodyByModel: (modelId: string) => string, tokens = { prompt: 100, completion: 20 }): typeof fetch {
  let call = 0;
  return (async (url: string | URL | Request) => {
    const href = String(url);
    if (href.endsWith('/v1/models')) {
      return { ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }) } as unknown as Response;
    }
    const modelId = TIER4_MODEL_IDS[call % TIER4_MODEL_IDS.length]!;
    call += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: bodyByModel(modelId) } }],
        usage: { prompt_tokens: tokens.prompt, completion_tokens: tokens.completion },
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function deps(fetchImpl: typeof fetch, env: Record<string, string | undefined>, logs: RunLogLine[]) {
  return {
    env,
    fetchImpl,
    readModel: () => MODEL,
    readHandCases: () => CASES,
    appendLog: (line: RunLogLine) => logs.push(line),
    now: () => '2026-09-25T10:00:00.000Z',
    modelIds: ['M-001', 'M-002'] as const,
  };
}

test('TÁI HIỆN: thiếu OPENAI_API_KEY → skipped, vẫn ghi một dòng log (I8), và nói rõ CHƯA CHẠY', async () => {
  const logs: RunLogLine[] = [];
  const outcome = await runTier4(deps(fakeFetch(() => ''), {}, logs));
  assert.equal(outcome.status, 'skipped');
  assert.equal(logs.length, 1);
  assert.equal(logs[0]!.costUsd, 0);
  assert.match(outcome.note, /CHƯA CHẠY/u);
  assert.equal(outcome.results.length, 0);
});

test('lượt sạch: mỗi mô hình một bằng chứng, costUsd cộng dồn từ token thật', async () => {
  const logs: RunLogLine[] = [];
  const outcome = await runTier4(deps(fakeFetch(() => conformingBody([], [])), { OPENAI_API_KEY: 'k' }, logs));
  assert.equal(outcome.status, 'ok');
  assert.equal(outcome.providerModel, 'gpt-4o');
  assert.equal(outcome.results.length, 2);
  assert.ok(outcome.results.every((r) => r.matched && r.evidence !== undefined));
  assert.equal(outcome.results[0]!.evidence!.provider, 'openai/gpt-4o');
  assert.ok(outcome.totalCostUsd > 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]!.costUsd, outcome.totalCostUsd);
  assert.equal(logs[0]!.ref, 'topic/T-006b');
});

test('TÁI HIỆN, luật đắt nhất: đầu ra sai dạng KHÔNG sinh bằng chứng và KHÔNG được tính là khớp', async () => {
  const logs: RunLogLine[] = [];
  const outcome = await runTier4(deps(fakeFetch(() => 'Looks good, nothing to report.'), { OPENAI_API_KEY: 'k' }, logs));
  assert.equal(outcome.status, 'failed');
  assert.ok(outcome.results.every((r) => r.evidence === undefined));
  assert.ok(outcome.results.every((r) => !r.matched));
});

test('có phát hiện → vẫn sinh bằng chứng, nhưng không khớp (cấp 4 sẽ pass:false)', async () => {
  const logs: RunLogLine[] = [];
  const outcome = await runTier4(
    deps(fakeFetch(() => conformingBody(['thiếu giả định lạm phát'], [])), { OPENAI_API_KEY: 'k' }, logs),
  );
  assert.equal(outcome.status, 'ok');
  assert.ok(outcome.results.every((r) => r.evidence !== undefined && !r.matched));
  assert.deepEqual(outcome.results[0]!.evidence!.unflaggedAssumptions, ['thiếu giả định lạm phát']);
});

test('lỗi gọi API ở một mô hình không nuốt phép đo của mô hình còn lại', async () => {
  const logs: RunLogLine[] = [];
  let call = 0;
  const flaky = (async (url: string | URL | Request) => {
    if (String(url).endsWith('/v1/models')) {
      return { ok: true, json: async () => ({ data: [{ id: 'gpt-4o' }] }) } as unknown as Response;
    }
    call += 1;
    if (call === 1) return { ok: false, status: 500, text: async () => 'boom' } as unknown as Response;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: conformingBody([], []) } }],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  const outcome = await runTier4(deps(flaky, { OPENAI_API_KEY: 'k' }, logs));
  assert.equal(outcome.results.length, 2);
  assert.ok(outcome.results[0]!.problems.some((p) => p.includes('500')));
  assert.equal(outcome.results[1]!.matched, true);
});

// --- 5. Bảng tóm tắt và chỗ đặt bằng chứng -------------------------------

test('bảng tóm tắt in "khớp/không khớp kèm số" cho MỌI mô hình — đúng chữ chủ dự án dặn', () => {
  const summary = renderTier4Summary(
    [
      { modelId: 'M-001', matched: true, evidence: { reviewedAt: 'x', provider: 'openai/gpt-4o', unflaggedAssumptions: [], unitIssues: [] }, unflaggedCount: 0, unitIssueCount: 0, promptTokens: 10, completionTokens: 2, costUsd: 0.001, problems: [] },
      { modelId: 'M-002', matched: false, evidence: { reviewedAt: 'x', provider: 'openai/gpt-4o', unflaggedAssumptions: ['a'], unitIssues: [] }, unflaggedCount: 1, unitIssueCount: 0, promptTokens: 10, completionTokens: 2, costUsd: 0.001, problems: [] },
      { modelId: 'M-003', matched: false, unflaggedCount: 0, unitIssueCount: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, problems: ['sai dạng'] },
    ],
    'gpt-4o',
    0.002,
  );
  assert.match(summary, /\| `M-001` \| ✅ khớp \| 0 \| 0 \|/u);
  assert.match(summary, /\| `M-002` \| ❌ không khớp \| 1 \| 0 \|/u);
  assert.match(summary, /M-003.*KHÔNG tính là đã kiểm/u);
  assert.match(summary, /tổng `costUsd` \*\*0\.0020\*\*/u);
  assert.match(summary, /gpt-4o-mini` bị cấm/u);
});

test('bằng chứng nằm dưới tier4/, KHÔNG nằm cạnh file mô hình', () => {
  // `ops/scripts/check-models.ts` quét `workshops/*/data/models/*.json` ở TẦNG
  // ĐẦU và validate theo `model.schema.json`. Một file bằng chứng đặt cạnh
  // M-00N.json sẽ làm `pnpm contracts` đỏ ngay — đúng lý do nó ở thư mục con,
  // cùng lối `cases/`.
  const path = tier4EvidencePath('/repo', 'M-001');
  assert.equal(path, '/repo/workshops/topic/data/models/tier4/M-001.tier4.json');
});

test('TIER4_MODEL_IDS đúng tám mô hình của T-006', () => {
  assert.equal(TIER4_MODEL_IDS.length, 8);
  assert.deepEqual([...TIER4_MODEL_IDS], ['M-001', 'M-002', 'M-003', 'M-004', 'M-005', 'M-006', 'M-007', 'M-008']);
});
