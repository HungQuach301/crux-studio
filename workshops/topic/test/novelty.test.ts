import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unsupportedKeywords } from '@crux/kernel';
import { MIN_CORPUS_VIDEOS, type Corpus, type CorpusVideo } from '../src/corpus.ts';
import {
  checkNovelty,
  noveltyCheckSchema,
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

test('contract kiểm mới lạ chỉ dùng từ khoá mà validator của kernel hiểu', () => {
  assert.deepEqual(unsupportedKeywords(noveltyCheckSchema), []);
});

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
  const corpus = loadCorpus();
  const crowded = withVideos(corpus, [
    ...corpus.videos,
    ...Array.from({ length: DEFAULT_THRESHOLDS.crowdedAt }, (_, i) => similarVideo(i)),
  ]);
  const check = checkNovelty(THESIS, crowded, CHECKED_AT);

  assert.equal(check.contradictingCount, 0);
  assert.ok(check.similarCount >= DEFAULT_THRESHOLDS.crowdedAt);
  assert.equal(check.verdict, 'crowded-in-corpus');
  assert.ok(check.reasons.some((r) => r.code === 'similar-above-threshold'));
  assert.equal(validateNoveltyCheck(check).valid, true);
});

test('WP-014 kiểm âm 2: corpus dưới ngưỡng tối thiểu trả insufficient-corpus', () => {
  const corpus = loadCorpus();
  const thin = withVideos(corpus, corpus.videos.slice(0, MIN_CORPUS_VIDEOS - 1));
  const check = checkNovelty(THESIS, thin, CHECKED_AT);

  assert.equal(check.verdict, 'insufficient-corpus');
  assert.ok(check.reasons.some((r) => r.code === 'corpus-below-minimum'));
  assert.equal(validateNoveltyCheck(check).valid, true);
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
