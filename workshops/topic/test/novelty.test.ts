/**
 * Phép kiểm từ khoá schema KHÔNG còn ở đây: `pnpm contracts` việc số 6 quét
 * mọi `workshops/<tên>/contracts/*.schema.json` (mục `integration/I-013`,
 * `ops/scripts/check-workshop-contracts.ts`). Một bản chép tay ở đây chỉ
 * phủ đúng contract mà tác giả nhớ viết test — cùng luật Z16 với `I-008`,
 * `I-009`, `I-011`: bỏ bản chép, giữ một nguồn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIN_CORPUS_VIDEOS, type Corpus, type CorpusVideo } from '../src/corpus.ts';
import {
  checkNovelty,
  validateNoveltyCheck,
  assertNoUniversalClaim,
  DEFAULT_THRESHOLDS,
  type Thesis,
} from '../src/novelty.ts';

const CORPUS_PATH = fileURLToPath(
  new URL('../data/corpus/us-personal-finance-2026-09-01.json', import.meta.url),
);

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
}

const THESIS: Thesis = {
  id: 'TH-001',
  statement:
    'The crossover point where paying down credit card debt beats topping up an emergency fund.',
};

const CHECKED_AT = '2026-09-10T00:00:00.000Z';

/** Dựng lại `coverage.videoCount` cho đúng số đếm — mọi biến thể đi qua đây. */
function withVideos(corpus: Corpus, videos: CorpusVideo[]): Corpus {
  return { ...corpus, videos, coverage: { ...corpus.coverage, videoCount: videos.length } };
}

function similarVideo(n: number): CorpusVideo {
  return {
    videoId: `yt-sim-${n}`,
    title: 'Emergency fund or credit card debt first?',
    description: 'The crossover point for paying down a card balance instead of topping up savings.',
    publishedAt: '2026-03-01T12:00:00.000Z',
    durationMs: 600000,
    viewCount: 50000 + n * 1000,
    channelId: `ch-sim-${n}`,
  };
}

test('WP-014 kiểm 2: kiểm mới lạ cho một thesis trả kết quả hợp contract, có limitation', () => {
  const check = checkNovelty(THESIS, loadCorpus(), CHECKED_AT);
  const result = validateNoveltyCheck(check);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(check.verdict, 'novel-in-corpus');
  assert.ok(check.limitation.length >= 40);
  assert.ok(check.limitation.includes('US'), 'limitation phải nói phạm vi');
  assert.ok(check.limitation.includes(CHECKED_AT), 'limitation phải nói ngày');
});

test('tiêu chí xong T-008: kiểm trả về LÝ DO, không chỉ trả về điểm', () => {
  const check = checkNovelty(THESIS, loadCorpus(), CHECKED_AT);
  assert.ok(check.reasons.length >= 1);
  for (const reason of check.reasons) {
    assert.ok(reason.detail.trim().length > 0, `lý do ${reason.code} không có nội dung`);
  }
  // Lý do phải giải thích được cả hai nửa của kết luận, không chỉ nửa dễ.
  const codes = check.reasons.map((r) => r.code);
  assert.ok(codes.includes('contradicting-none'));
  assert.ok(codes.includes('similar-below-threshold'));
});

test('WP-014 kiểm âm 1: contradictingCount = 0 KHÔNG tự thành novel-in-corpus khi similarCount cao', () => {
  // Biên ghim bằng SỐ CỤ THỂ, không bằng chính hằng số đang kiểm. Bản đầu
  // dùng `DEFAULT_THRESHOLDS.crowdedAt` ở cả hai vế, nên đặt ngưỡng thành
  // 100 — tức giết hẳn cơ chế — mà test vẫn xanh (reviewer ngữ cảnh sạch đo
  // được). Corpus mẫu có sẵn 3 video cùng chuyện.
  const corpus = loadCorpus();
  const withExtra = (extra: number) =>
    checkNovelty(
      THESIS,
      withVideos(corpus, [...corpus.videos, ...Array.from({ length: extra }, (_, i) => similarVideo(i))]),
      CHECKED_AT,
    );

  const seven = withExtra(4);
  assert.equal(seven.similarCount, 7);
  assert.equal(seven.contradictingCount, 0);
  assert.equal(seven.verdict, 'novel-in-corpus', '7 video cùng chuyện: chưa đông');

  const eight = withExtra(5);
  assert.equal(eight.similarCount, 8);
  assert.equal(eight.contradictingCount, 0);
  assert.equal(eight.verdict, 'crowded-in-corpus', '8 video cùng chuyện: đã đông, dù không ai nói ngược');
  assert.ok(eight.reasons.some((r) => r.code === 'similar-above-threshold'));
  assert.equal(validateNoveltyCheck(eight).valid, true);

  // Ngưỡng đang dùng phải đúng bằng biên vừa ghim — nếu ai đổi hằng số mà
  // quên đổi hai ca trên, dòng này chỉ thẳng vào chỗ lệch.
  assert.equal(DEFAULT_THRESHOLDS.crowdedAt, 8);
});

test('WP-014 kiểm âm 2: corpus dưới ngưỡng tối thiểu trả insufficient-corpus', () => {
  // Cùng lý do: ghim 29 và 30 bằng số, không bằng `MIN_CORPUS_VIDEOS − 1`.
  const corpus = loadCorpus();
  const sliced = (n: number) => checkNovelty(THESIS, withVideos(corpus, corpus.videos.slice(0, n)), CHECKED_AT);

  const thin = sliced(29);
  assert.equal(thin.verdict, 'insufficient-corpus');
  assert.ok(thin.reasons.some((r) => r.code === 'corpus-below-minimum'));
  assert.equal(validateNoveltyCheck(thin).valid, true);

  const atMinimum = sliced(30);
  assert.notEqual(atMinimum.verdict, 'insufficient-corpus', '30 video: đủ ngưỡng, phải kết luận được');
  assert.ok(!atMinimum.reasons.some((r) => r.code === 'corpus-below-minimum'));

  assert.equal(MIN_CORPUS_VIDEOS, 30);
});

test('corpus rỗng: không có ai nói ngược vẫn KHÔNG phải mới lạ', () => {
  const check = checkNovelty(THESIS, withVideos(loadCorpus(), []), CHECKED_AT);
  assert.equal(check.contradictingCount, 0);
  assert.equal(check.similarCount, 0);
  assert.equal(check.verdict, 'insufficient-corpus');
});

test('một video nói ngược là đủ để hạ kết luận xuống contested-in-corpus', () => {
  const corpus = loadCorpus();
  const contested = withVideos(corpus, [
    ...corpus.videos,
    {
      ...similarVideo(99),
      videoId: 'yt-against-1',
      title: 'The emergency fund myth: paying down credit card debt first is wrong',
      description: 'Why the usual crossover point for topping up savings is misleading.',
    },
  ]);
  const check = checkNovelty(THESIS, contested, CHECKED_AT);

  assert.equal(check.verdict, 'contested-in-corpus');
  assert.equal(check.contradictingCount, 1);
  assert.ok(check.reasons.some((r) => r.code === 'contradicting-found'));
});

test('nhánh contested chạm được bằng chính dữ liệu corpus mẫu, không cần video tự dựng', () => {
  // Corpus mẫu mang sẵn hai video nói ngược trên đề tài khác. Không có chúng,
  // nhánh `contested-in-corpus` chỉ sống trong test — cơ chế có bài kiểm
  // nhưng dữ liệu mẫu không bao giờ chịu lực (reviewer ngữ cảnh sạch nêu).
  const check = checkNovelty(
    {
      id: 'TH-002',
      statement: 'Chasing high yield savings rate moves between banks is a mistake for most households.',
    },
    loadCorpus(),
    CHECKED_AT,
  );
  assert.equal(check.verdict, 'contested-in-corpus');
  assert.equal(check.contradictingCount, 1);
  assert.ok(check.matches?.some((m) => m.videoId === 'yt-0037'));
});

test('corpus một phần và phạm vi hẹp được nói ra bằng lý do, không im lặng', () => {
  const corpus = loadCorpus();
  const partial: Corpus = {
    ...corpus,
    coverage: { ...corpus.coverage, partial: true, partialReason: 'hết bucket tìm kiếm trong ngày' },
  };
  const check = checkNovelty(THESIS, partial, CHECKED_AT);
  assert.ok(check.reasons.some((r) => r.code === 'corpus-partial'));
  // Corpus mẫu có đúng một vùng và một ngôn ngữ.
  assert.ok(check.reasons.some((r) => r.code === 'scope-narrow'));
});

test('corpus quá tuổi được nói ra, không âm thầm dùng tiếp', () => {
  const check = checkNovelty(THESIS, loadCorpus(), '2026-12-01T00:00:00.000Z');
  assert.ok(check.reasons.some((r) => r.code === 'corpus-stale'));
});

test('WP-014 mục 5: cấm tuyên bố "chưa ai công bố" ở mọi chỗ trong output', () => {
  for (const banned of [
    'No one has published this before.',
    'Nobody has covered this crossover point.',
    'Đây là phân tích chưa ai công bố.',
    'This is the first ever look at the number.',
  ]) {
    assert.throws(() => assertNoUniversalClaim(banned, 'test'), /WP-014/);
  }
  // Cách nói đúng thì không bị chặn.
  assertNoUniversalClaim('Không thấy trong corpus đã kiểm, phạm vi US/en, ngày 2026-09-10.', 'test');
});

test('kiểm mới lạ chạy lại cho ra đúng kết quả cũ — không đọc đồng hồ, không gọi mạng', () => {
  const a = checkNovelty(THESIS, loadCorpus(), CHECKED_AT);
  const b = checkNovelty(THESIS, loadCorpus(), CHECKED_AT);
  assert.deepEqual(a, b);
});

/* ==================================================================== *
 * Mục `topic/T-014` — nhánh so NGỮ NGHĨA
 *
 * Mọi bài dưới đây dựng bảng điểm bằng tay. Đó là chủ đích: bảng điểm là
 * một tham số, nên `checkNovelty` vẫn thuần và bộ test không cần mạng.
 * ==================================================================== */

/** Bảng điểm cho toàn corpus: mặc định `base`, và ghi đè cho những video kể tên. */
function scoreTable(corpus: Corpus, base: number, overrides: Record<string, number> = {}): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const video of corpus.videos) scores[video.videoId] = overrides[video.videoId] ?? base;
  return scores;
}

test('T-014: so ngữ nghĩa bắt được video nói cùng chuyện mà so từ vựng bỏ sót', () => {
  const corpus = loadCorpus();
  // Câu này nói đúng chuyện của yt-0001..yt-0003 nhưng KHÔNG chung từ khoá:
  // không `credit card`, không `emergency fund`, không `debt`.
  const paraphrase: Thesis = {
    id: 'TH-PARA',
    statement: 'Clearing revolving balances should wait until a household has one month of expenses set aside.',
  };

  const lexical = checkNovelty(paraphrase, corpus, CHECKED_AT);
  assert.equal(lexical.similarCount, 0, 'so từ vựng không thấy gì — đúng chỗ hỏng mà T-014 chữa');
  assert.equal(lexical.verdict, 'novel-in-corpus');

  const semantic = checkNovelty(paraphrase, corpus, CHECKED_AT, undefined, {
    model: 'fake-small',
    threshold: 0.45,
    scores: scoreTable(corpus, 0.1, { 'yt-0001': 0.82, 'yt-0002': 0.79, 'yt-0003': 0.77 }),
  });
  assert.equal(semantic.similarCount, 3);
  assert.deepEqual(
    semantic.matches?.map((m) => m.videoId),
    ['yt-0001', 'yt-0002', 'yt-0003'],
  );
});

test('T-014: đủ đông theo ngữ nghĩa thì hạ verdict xuống `crowded-in-corpus`', () => {
  const corpus = loadCorpus();
  const overrides: Record<string, number> = {};
  for (let i = 1; i <= DEFAULT_THRESHOLDS.crowdedAt; i += 1) {
    overrides[`yt-${String(i).padStart(4, '0')}`] = 0.9;
  }
  const semantic = checkNovelty(THESIS, corpus, CHECKED_AT, undefined, {
    model: 'fake-small',
    threshold: 0.45,
    scores: scoreTable(corpus, 0.1, overrides),
  });
  assert.equal(semantic.similarCount, DEFAULT_THRESHOLDS.crowdedAt);
  assert.equal(semantic.verdict, 'crowded-in-corpus');
});

test('T-014: ngưỡng cosine dùng `similarity.threshold`, KHÔNG dùng `thresholds.similarOverlap`', () => {
  const corpus = loadCorpus();
  const scores = scoreTable(corpus, 0.1, { 'yt-0001': 0.48 });
  // 0.48 nằm GIỮA hai ngưỡng: dưới `similarOverlap` (0.5), trên `threshold` (0.45).
  assert.ok(0.48 < DEFAULT_THRESHOLDS.similarOverlap && 0.48 > 0.45);
  const semantic = checkNovelty(THESIS, corpus, CHECKED_AT, undefined, {
    model: 'fake-small',
    threshold: 0.45,
    scores,
  });
  assert.equal(semantic.similarCount, 1, 'ngưỡng của phép so từ vựng không được đội lên phép so cosine');
});

test('T-014: thiếu điểm của một video thì NÉM — không im lặng coi là 0', () => {
  const corpus = loadCorpus();
  const scores = scoreTable(corpus, 0.1);
  delete scores['yt-0020'];
  assert.throws(
    () =>
      checkNovelty(THESIS, corpus, CHECKED_AT, undefined, {
        model: 'fake-small',
        threshold: 0.45,
        scores,
      }),
    /thiếu điểm cho video `yt-0020`/,
  );
});

test('T-014: `limitation` nói đúng phép so ĐÃ dùng và gọi tên model', () => {
  const corpus = loadCorpus();
  const lexical = checkNovelty(THESIS, corpus, CHECKED_AT);
  assert.match(lexical.limitation, /so từ vựng/);
  assert.doesNotMatch(lexical.limitation, /embeddings/);

  const semantic = checkNovelty(THESIS, corpus, CHECKED_AT, undefined, {
    model: 'text-embedding-3-small',
    threshold: 0.45,
    scores: scoreTable(corpus, 0.1),
  });
  assert.match(semantic.limitation, /so ngữ nghĩa bằng embeddings/);
  assert.match(semantic.limitation, /text-embedding-3-small/);
  // Hướng chệch KHÔNG được biến mất ở nhánh ngữ nghĩa: embeddings chữa phần
  // "khác chữ", không chữa phần "không có trong metadata".
  assert.match(semantic.limitation, /chệch về phía "mới lạ"/);
  assert.match(semantic.limitation, /nhẹ hơn so từ vựng, không phải hết/);
  // Trường máy đọc (I6), không phải văn xuôi.
  assert.equal(lexical.method, 'lexical');
  assert.equal(lexical.similarityModel, undefined);
  assert.equal(semantic.method, 'semantic');
  assert.equal(semantic.similarityModel, 'text-embedding-3-small');
  // Câu cấm của WP-014 mục 5 vẫn đứng ở nhánh mới.
  assert.doesNotThrow(() => assertNoUniversalClaim(semantic.limitation, 'limitation'));
  assert.equal(validateNoveltyCheck(semantic).valid, true);
});

test('T-014: nhánh `insufficient-corpus` thắng cả điểm ngữ nghĩa cao', () => {
  const corpus = loadCorpus();
  const few = withVideos(corpus, corpus.videos.slice(0, MIN_CORPUS_VIDEOS - 1));
  const semantic = checkNovelty(THESIS, few, CHECKED_AT, undefined, {
    model: 'fake-small',
    threshold: 0.45,
    scores: scoreTable(few, 0.99),
  });
  assert.equal(semantic.verdict, 'insufficient-corpus');
});

test('T-014: cosine ÂM vẫn hợp contract — nhánh ngữ nghĩa không tự phạm contract của chính nó', () => {
  const corpus = loadCorpus();
  const semantic = checkNovelty(THESIS, corpus, CHECKED_AT, undefined, {
    model: 'fake-small',
    // Ngưỡng âm là ca reviewer nêu: `overlap` của contract từng khoá [0, 1]
    // trong khi cosine nằm trong [-1, 1], nên một điểm âm lọt vào `matches` là
    // artifact tự phạm contract của chính nó.
    threshold: -0.5,
    scores: scoreTable(corpus, -0.3, { 'yt-0001': 0.9 }),
  });
  const result = validateNoveltyCheck(semantic);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(semantic.matches?.some((m) => m.overlap < 0), 'ca này phải thật sự có điểm âm');
});
