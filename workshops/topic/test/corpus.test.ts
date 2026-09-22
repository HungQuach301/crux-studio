import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unsupportedKeywords } from '@crux/kernel';
import {
  corpusSchema,
  corpusProblems,
  forbiddenKeyPaths,
  quotaGate,
  validateCorpus,
  MIN_CORPUS_VIDEOS,
  type Corpus,
} from '../src/corpus.ts';

const CORPUS_PATH = fileURLToPath(
  new URL('../data/corpus/us-personal-finance-2026-09-01.json', import.meta.url),
);

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
}

test('contract corpus chỉ dùng từ khoá mà validator của kernel hiểu', () => {
  // Cùng lý do với `pnpm contracts` việc số 2: một ràng buộc được viết ra
  // nhưng không được kiểm còn tệ hơn là không viết.
  assert.deepEqual(unsupportedKeywords(corpusSchema), []);
});

test('WP-014 kiểm 1: corpus mẫu hợp contract và sạch mọi phép soát', () => {
  const corpus = loadCorpus();
  assert.equal(validateCorpus(corpus).valid, true);
  assert.deepEqual(corpusProblems(corpus), []);
  assert.equal(corpus.coverage.videoCount, 38);
  assert.ok(38 >= MIN_CORPUS_VIDEOS, 'corpus mẫu phải vượt ngưỡng tối thiểu để kiểm mới lạ chạy được');
});

test('nguồn gốc corpus nằm trong DỮ LIỆU: corpus mẫu tự khai là dựng tay', () => {
  // Cùng luật với `quota.limits.source`. Ai đọc file cũng thấy, kể cả khi
  // chưa từng mở README của thư mục.
  const corpus = loadCorpus();
  assert.equal(corpus.provenance, 'hand-built');

  const stripped: Record<string, unknown> = { ...corpus };
  delete stripped['provenance'];
  assert.equal(validateCorpus(stripped).valid, false, 'provenance phải là trường BẮT BUỘC');

  const invented = { ...corpus, provenance: 'scraped' };
  assert.equal(validateCorpus(invented).valid, false);
});

test('mốc thời gian đứng vững: không video nào đăng sau ngày dựng corpus', () => {
  const corpus = loadCorpus();
  for (const video of corpus.videos) {
    assert.ok(
      Date.parse(video.publishedAt) <= Date.parse(corpus.builtAt),
      `${video.videoId} đăng sau builtAt`,
    );
  }

  // Một ngày đăng ở tương lai không làm schema đỏ — nó hợp `format: date-time`.
  // Phép soát thứ 5 là thứ duy nhất bắt được, và nó phải bắt được.
  const future = structuredClone(corpus);
  future.videos[0]!.publishedAt = '2027-01-01T00:00:00.000Z';
  assert.equal(validateCorpus(future).valid, true, 'schema KHÔNG bắt được ca này — đó là lý do có luật 5');
  assert.ok(corpusProblems(future).some((p) => p.includes('nằm SAU builtAt')));
});

test('cửa sổ đã khai phải đúng với dữ liệu: video quá cũ bị bắt', () => {
  const corpus = loadCorpus();
  const tooOld = structuredClone(corpus);
  // `scope.asOf` là 2026-09-01 và `windowDays` là 730, nên 2020 nằm ngoài hẳn.
  tooOld.videos[1]!.publishedAt = '2020-01-01T00:00:00.000Z';
  assert.ok(corpusProblems(tooOld).some((p) => p.includes('nằm ngoài cửa sổ')));
});

test('coverage.contentLevel bị khoá: corpus không bao giờ mang nội dung video', () => {
  const corpus = loadCorpus();
  assert.equal(corpus.coverage.contentLevel, 'metadata-only');
  const tampered = { ...corpus, coverage: { ...corpus.coverage, contentLevel: 'with-captions' } };
  assert.equal(validateCorpus(tampered).valid, false);
});

test('WP-014 kiểm âm 3: bình luận thô và tên người dùng bị chặn, kể cả ở tầng sâu', () => {
  const corpus = loadCorpus();
  const withComment = structuredClone(corpus) as unknown as Record<string, unknown>;
  (withComment['videos'] as Record<string, unknown>[])[0]!['comments'] = [
    { authorName: 'someone', commentText: 'bình luận thô' },
  ];
  const paths = forbiddenKeyPaths(withComment);
  assert.ok(paths.includes('$.videos[0].comments'));
  assert.ok(paths.some((p) => p.endsWith('.authorName')));
  assert.ok(corpusProblems(withComment).length > 0);
});

test('channelTitle KHÔNG bị chặn — tên kênh là metadata công khai, không phải tên người dùng', () => {
  assert.deepEqual(forbiddenKeyPaths({ channelTitle: 'Một kênh nào đó' }), []);
});

test('partial = true mà không có lý do thì đỏ; partial = false mà có lý do cũng đỏ', () => {
  const corpus = loadCorpus();
  const noReason = { ...corpus, coverage: { ...corpus.coverage, partial: true, partialReason: '  ' } };
  assert.ok(corpusProblems(noReason).some((p) => p.includes('partialReason rỗng')));

  const contradictory = {
    ...corpus,
    coverage: { ...corpus.coverage, partial: false, partialReason: 'hết bucket' },
  };
  assert.ok(corpusProblems(contradictory).some((p) => p.includes('mâu thuẫn')));
});

test('videoCount là số đếm, không phải số khai', () => {
  const corpus = loadCorpus();
  const lying = { ...corpus, coverage: { ...corpus.coverage, videoCount: 999 } };
  assert.ok(corpusProblems(lying).some((p) => p.includes('videoCount')));
});

test('searchCalls phải bằng tổng pagesFetched — mỗi trang là một lần gọi', () => {
  const corpus = loadCorpus();
  const pages = corpus.queries.reduce((total, q) => total + q.pagesFetched, 0);
  assert.equal(corpus.quota.spent.searchCalls, pages);

  const lying = { ...corpus, quota: { ...corpus.quota, spent: { searchCalls: pages + 5 } } };
  assert.ok(corpusProblems(lying).some((p) => p.includes('pagesFetched')));
});

test('hạn mức khai rõ nguồn: corpus mẫu nói thẳng số CHƯA đọc từ Cloud Console', () => {
  // WP-014 mục 7 đòi số đọc từ Console. Tới khi có người đọc, giá trị trung
  // thực là `vendor-docs` — và nó nằm trong DỮ LIỆU, nên mọi bên tiêu thụ
  // thấy, không chỉ người mở tài liệu.
  const corpus = loadCorpus();
  assert.equal(corpus.quota.limits.source, 'vendor-docs');
  const invented = {
    ...corpus,
    quota: { ...corpus.quota, limits: { ...corpus.quota.limits, source: 'đoán' } },
  };
  assert.equal(validateCorpus(invented).valid, false);
});

test('WP-014 kiểm âm 4: hết bucket tìm kiếm thì cửa quota đóng, có lý do, không ném lỗi', () => {
  const limits = { searchCallsPerDay: 100, reserveFraction: 0.2 };
  const open = quotaGate({ ...limits, spent: 10 });
  assert.equal(open.allowed, true);
  assert.equal(open.reserved, 20);
  assert.equal(open.remaining, 70);

  // Biên ghim bằng SỐ, không bằng chính hằng số đang kiểm: 79 lần gọi thì
  // còn mở, 80 thì đóng. Đổi luật dự trữ mà quên đổi test là đỏ ngay.
  const justBefore = quotaGate({ ...limits, spent: 79 });
  assert.equal(justBefore.allowed, true);
  assert.equal(justBefore.remaining, 1);

  const atReserve = quotaGate({ ...limits, spent: 80 });
  assert.equal(atReserve.allowed, false);
  assert.equal(atReserve.remaining, 0);
  assert.ok(atReserve.reason.includes('corpus một phần'));

  const past = quotaGate({ ...limits, spent: 95 });
  assert.equal(past.allowed, false);
  assert.equal(past.remaining, 0);
});

test('phần dự trữ làm tròn LÊN — nghi ngờ thì giữ lại nhiều hơn, không ít hơn', () => {
  // 100 × 0,2 = 20 chẵn, nên ca đó không phân biệt được `ceil` với `floor`.
  // Hai ca lẻ dưới đây ghim hướng làm tròn.
  assert.equal(quotaGate({ searchCallsPerDay: 100, reserveFraction: 0.15, spent: 0 }).reserved, 15);
  assert.equal(quotaGate({ searchCallsPerDay: 100, reserveFraction: 0.155, spent: 0 }).reserved, 16);
  assert.equal(quotaGate({ searchCallsPerDay: 33, reserveFraction: 0.2, spent: 0 }).reserved, 7);
});
