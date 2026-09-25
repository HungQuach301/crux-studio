/**
 * Bài kiểm của mục `topic/T-014`. Tất cả chạy **ngoại tuyến**: nhà cung cấp
 * giả tất định, không một lời gọi mạng nào. Đó là điều kiện để `pnpm check`
 * ở Đợt 0 không bao giờ đi qua một API trả tiền (CLAUDE.md mục 1).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MIN_MARGIN,
  EMBEDDINGS_SECRET_NAME,
  checkEmbeddingsSecret,
  cheapestAdequateModel,
  cosineSimilarity,
  costUsdFor,
  measureSeparation,
  openAiEmbeddingProvider,
  readEmbeddingModelTable,
  redactSecret,
  type EmbeddingModel,
  type ProbePair,
} from '../src/embeddings.ts';

const MODEL: EmbeddingModel = { model: 'fake-small', usdPerMillionTokens: 0.02, dimensions: 3 };

/* ------------------------------ cosine ------------------------------ */

test('cosineSimilarity: vector trùng hướng cho 1, vuông góc cho 0, ngược hướng cho -1', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [2, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0, 0], [0, 3, 0]), 0);
  assert.equal(cosineSimilarity([1, 0, 0], [-1, 0, 0]), -1);
});

test('cosineSimilarity: vector 0 cho 0 chứ không NaN', () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});

test('cosineSimilarity: số chiều lệch thì NÉM, không cắt bớt rồi so', () => {
  assert.throws(() => cosineSimilarity([1, 0], [1, 0, 0]), /số chiều lệch/);
});

/* ------------------------------- giá -------------------------------- */

test('costUsdFor: tính từ số token, không làm tròn sớm', () => {
  assert.equal(costUsdFor(1_000_000, 0.02), 0.02);
  assert.equal(costUsdFor(500_000, 0.02), 0.01);
  assert.equal(costUsdFor(0, 0.13), 0);
});

test('bảng giá thật trong data/ hợp contract và có bản rẻ nhất', () => {
  const table = readEmbeddingModelTable();
  assert.equal(table.vendor, 'openai');
  // Giả định G20: số giá mới chỉ ở mức `vendor-docs`.
  assert.equal(table.source, 'vendor-docs');
  assert.ok(table.models.length >= 2, 'phép chọn cần ít nhất hai ứng viên để có nghĩa');
  const cheapest = [...table.models].sort((a, b) => a.usdPerMillionTokens - b.usdPerMillionTokens)[0];
  assert.equal(cheapest?.model, 'text-embedding-3-small');
});

test('readEmbeddingModelTable: file không hợp contract thì NÉM chứ không chạy tiếp', () => {
  assert.throws(() => readEmbeddingModelTable('novelty-probe.json'), /không hợp contract/);
});

/* ------------------------------ secret ------------------------------ */

test('checkEmbeddingsSecret: thiếu khoá thì DỪNG và gọi đúng tên secret', () => {
  const result = checkEmbeddingsSecret({});
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [EMBEDDINGS_SECRET_NAME]);
  assert.match(result.message, /EMBEDDINGS_API_KEY/);
});

test('checkEmbeddingsSecret: KHÔNG mượn OPENAI_API_KEY thay thế', () => {
  const result = checkEmbeddingsSecret({ OPENAI_API_KEY: 'sk-có-khoá-khác' });
  assert.equal(result.ok, false, 'hai khoá được chủ dự án cố ý tách ra để theo dõi chi phí riêng');
});

test('checkEmbeddingsSecret: khoá toàn khoảng trắng vẫn là thiếu', () => {
  assert.equal(checkEmbeddingsSecret({ [EMBEDDINGS_SECRET_NAME]: '   ' }).ok, false);
});

test('checkEmbeddingsSecret: có khoá thì ok', () => {
  assert.equal(checkEmbeddingsSecret({ [EMBEDDINGS_SECRET_NAME]: 'sk-x' }).ok, true);
});

/* --------------------------- nhà cung cấp --------------------------- */

function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}): typeof fetch {
  return (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response) as unknown as typeof fetch;
}

test('openAiEmbeddingProvider: costUsd tính từ usage THẬT của phản hồi, không ước lượng', async () => {
  const provider = openAiEmbeddingProvider({
    apiKey: 'sk-x',
    model: MODEL,
    fetchImpl: fakeFetch({
      data: [
        { index: 0, embedding: [1, 0, 0] },
        { index: 1, embedding: [0, 1, 0] },
      ],
      usage: { total_tokens: 2_000_000 },
    }),
  });
  const batch = await provider.embed(['a', 'b']);
  assert.equal(batch.usage.totalTokens, 2_000_000);
  assert.equal(batch.usage.costUsd, 0.04);
  assert.deepEqual(batch.vectors, [[1, 0, 0], [0, 1, 0]]);
});

test('openAiEmbeddingProvider: ghép vector theo `index`, KHÔNG theo thứ tự mảng', async () => {
  const provider = openAiEmbeddingProvider({
    apiKey: 'sk-x',
    model: MODEL,
    fetchImpl: fakeFetch({
      data: [
        { index: 1, embedding: [0, 1, 0] },
        { index: 0, embedding: [1, 0, 0] },
      ],
      usage: { total_tokens: 10 },
    }),
  });
  const batch = await provider.embed(['thứ-nhất', 'thứ-hai']);
  assert.deepEqual(batch.vectors[0], [1, 0, 0], 'vector của đoạn thứ nhất phải là index 0');
});

test('openAiEmbeddingProvider: thiếu vector thì NÉM, không trả mảng thủng', async () => {
  const provider = openAiEmbeddingProvider({
    apiKey: 'sk-x',
    model: MODEL,
    fetchImpl: fakeFetch({ data: [{ index: 0, embedding: [1, 0, 0] }], usage: { total_tokens: 5 } }),
  });
  await assert.rejects(() => provider.embed(['a', 'b']), /không ghép cặp được/);
});

test('openAiEmbeddingProvider: `usage` vắng mặt thì NÉM, không ghi $0 cho một lần gọi có hoá đơn', async () => {
  const provider = openAiEmbeddingProvider({
    apiKey: 'sk-x',
    model: MODEL,
    fetchImpl: fakeFetch({ data: [{ index: 0, embedding: [1, 0, 0] }] }),
  });
  await assert.rejects(() => provider.embed(['a']), /không có `usage.total_tokens`/);
});

test('redactSecret: che MỌI lần xuất hiện của khoá, và không phá thông điệp khi khoá rỗng', () => {
  assert.equal(redactSecret('lỗi cho sk-abc và sk-abc', 'sk-abc'), 'lỗi cho *** và ***');
  assert.equal(redactSecret('không có khoá', 'sk-abc'), 'không có khoá');
  assert.equal(redactSecret('abc', ''), 'abc');
});

test('openAiEmbeddingProvider: thân lỗi vọng lại khoá thì khoá KHÔNG lọt vào thông điệp', async () => {
  const leaking = (async () =>
    ({
      ok: false,
      status: 401,
      text: async () => 'Incorrect API key provided: sk-bí-mật-thật. You can find your key at ...',
    }) as unknown as Response) as unknown as typeof fetch;
  const provider = openAiEmbeddingProvider({ apiKey: 'sk-bí-mật-thật', model: MODEL, fetchImpl: leaking });
  // Khoá nằm ở ĐẦU thông điệp, nên `slice(0, 200)` một mình không che được gì.
  await assert.rejects(() => provider.embed(['a']), (error: Error) => {
    assert.doesNotMatch(error.message, /sk-bí-mật-thật/);
    assert.match(error.message, /HTTP 401/);
    assert.match(error.message, /\*\*\*/);
    return true;
  });
});

test('openAiEmbeddingProvider: HTTP lỗi thì NÉM kèm mã, và không gọi mạng khi mảng rỗng', async () => {
  let called = 0;
  const counting = (async () => {
    called += 1;
    return { ok: false, status: 500, text: async () => 'boom' } as unknown as Response;
  }) as unknown as typeof fetch;
  const provider = openAiEmbeddingProvider({ apiKey: 'sk-x', model: MODEL, fetchImpl: counting });

  const empty = await provider.embed([]);
  assert.equal(empty.usage.costUsd, 0);
  assert.equal(called, 0, 'mảng rỗng không được tốn một lời gọi nào');

  await assert.rejects(() => provider.embed(['a']), /HTTP 500/);
});

/* -------------------- "rẻ nhất đủ chất lượng" ----------------------- */

/** Tra điểm và NÉM khi thiếu — trong test cũng không im lặng thay bằng 0. */
function scoreOf(scores: Record<string, number>): (pair: ProbePair) => number {
  return (pair) => {
    const score = scores[pair.videoId];
    if (score === undefined) throw new Error(`bài kiểm thiếu điểm cho ${pair.videoId}`);
    return score;
  };
}

const PAIRS: ProbePair[] = [
  { thesisId: 't1', videoId: 'v1', sameTopic: true },
  { thesisId: 't1', videoId: 'v2', sameTopic: true },
  { thesisId: 't1', videoId: 'v3', sameTopic: false },
  { thesisId: 't1', videoId: 'v4', sameTopic: false },
];

test('measureSeparation: tách sạch hai nhóm thì đạt, biên là khoảng cách thật', () => {
  const scores: Record<string, number> = { v1: 0.8, v2: 0.7, v3: 0.2, v4: 0.1 };
  const result = measureSeparation('m', PAIRS, scoreOf(scores));
  assert.equal(result.minSame, 0.7);
  assert.equal(result.maxDifferent, 0.2);
  assert.ok(Math.abs(result.margin - 0.5) < 1e-9);
  assert.equal(result.adequate, true);
});

test('measureSeparation: hai nhóm chồng nhau thì TRƯỢT, dù đa số cặp vẫn đúng', () => {
  const scores: Record<string, number> = { v1: 0.8, v2: 0.3, v3: 0.35, v4: 0.1 };
  const result = measureSeparation('m', PAIRS, scoreOf(scores));
  assert.ok(result.margin < 0);
  assert.equal(result.adequate, false);
});

test('measureSeparation: tách được nhưng biên mỏng hơn ngưỡng thì vẫn TRƯỢT', () => {
  const scores: Record<string, number> = { v1: 0.8, v2: 0.51, v3: 0.5, v4: 0.1 };
  const result = measureSeparation('m', PAIRS, scoreOf(scores), DEFAULT_MIN_MARGIN);
  assert.ok(result.margin > 0 && result.margin < DEFAULT_MIN_MARGIN);
  assert.equal(result.adequate, false);
});

test('measureSeparation: một nhóm rỗng thì NÉM — "tách" một nhóm luôn đạt', () => {
  const onlySame = PAIRS.filter((p) => p.sameTopic);
  assert.throws(() => measureSeparation('m', onlySame, () => 0.9), /một nhóm rỗng/);
});

test('cheapestAdequateModel: lọc theo đạt TRƯỚC, rồi mới lấy giá thấp nhất', () => {
  const pick = cheapestAdequateModel([
    { model: { model: 'rẻ-mà-trượt', usdPerMillionTokens: 0.01, dimensions: 3 }, separation: { model: 'rẻ-mà-trượt', minSame: 0.3, maxDifferent: 0.4, margin: -0.1, adequate: false } },
    { model: { model: 'vừa-và-đạt', usdPerMillionTokens: 0.02, dimensions: 3 }, separation: { model: 'vừa-và-đạt', minSame: 0.8, maxDifferent: 0.2, margin: 0.6, adequate: true } },
    { model: { model: 'đắt-và-đạt', usdPerMillionTokens: 0.13, dimensions: 3 }, separation: { model: 'đắt-và-đạt', minSame: 0.9, maxDifferent: 0.1, margin: 0.8, adequate: true } },
  ]);
  assert.equal(pick?.model.model, 'vừa-và-đạt', 'model rẻ hơn nhưng trượt KHÔNG được chọn');
});

test('cheapestAdequateModel: không ai đạt thì trả null, không hạ tiêu chí để có câu trả lời', () => {
  const pick = cheapestAdequateModel([
    { model: MODEL, separation: { model: MODEL.model, minSame: 0.2, maxDifferent: 0.5, margin: -0.3, adequate: false } },
  ]);
  assert.equal(pick, null);
});
