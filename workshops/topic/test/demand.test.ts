import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unsupportedKeywords } from '@crux/kernel';
import { corpusProblems, type Corpus } from '../src/corpus.ts';
import {
  autocompleteSuggestions,
  demandSignalSchema,
  median,
  sameTopicCount12m,
  validateDemandSignal,
  viewsPerDayOfAge,
  KNOWN_BIAS,
  type DemandProxy,
  type MeasureContext,
} from '../src/demand.ts';

const CORPUS_PATH = fileURLToPath(
  new URL('../data/corpus/us-personal-finance-2026-09-01.json', import.meta.url),
);

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
}

const TOPIC = 'The crossover point where paying down credit card debt beats topping up an emergency fund.';
const CTX: MeasureContext = { asOf: '2026-09-10T00:00:00.000Z', region: 'US', language: 'en' };

const PROXIES: DemandProxy[] = [
  'views-per-day-of-age',
  'same-topic-count-12m',
  'autocomplete-suggestions',
];

test('contract đại lượng nhu cầu chỉ dùng từ khoá mà validator của kernel hiểu', () => {
  assert.deepEqual(unsupportedKeywords(demandSignalSchema), []);
});

test('đúng ba đại lượng của WP-014, không nhiều hơn, không ít hơn', () => {
  const allowed = (demandSignalSchema['properties'] as Record<string, { enum?: string[] }>)['proxy']!
    .enum;
  assert.deepEqual(allowed, PROXIES);
});

test('cả ba đại lượng sinh tín hiệu hợp contract', () => {
  const corpus = loadCorpus();
  const signals = [
    viewsPerDayOfAge(corpus, TOPIC, CTX),
    sameTopicCount12m(corpus, TOPIC, CTX),
    autocompleteSuggestions('emergency fund vs credit card debt', ['a', 'b', 'c'], CTX),
  ];
  assert.deepEqual(
    signals.map((s) => s.proxy),
    PROXIES,
  );
  for (const signal of signals) {
    const result = validateDemandSignal(signal);
    assert.equal(result.valid, true, `${signal.proxy}: ${JSON.stringify(result.errors)}`);
  }
});

test('WP-014 mục 3c.3: mỗi lần dùng lưu ngày, vùng, ngôn ngữ và thiên lệch đã biết', () => {
  const signal = viewsPerDayOfAge(loadCorpus(), TOPIC, CTX);
  assert.equal(signal.asOf, CTX.asOf);
  assert.equal(signal.region, CTX.region);
  assert.equal(signal.language, CTX.language);
  assert.ok(signal.knownBias.length >= 40);

  // Bốn trường này là BẮT BUỘC, không phải nên có: bỏ trường nào cũng đỏ.
  for (const field of ['asOf', 'region', 'language', 'knownBias'] as const) {
    const stripped: Record<string, unknown> = { ...signal };
    delete stripped[field];
    assert.equal(validateDemandSignal(stripped).valid, false, `bỏ ${field} mà vẫn hợp lệ`);
  }
});

test('knownBias nói HƯỚNG lệch, không chỉ nói là có lệch', () => {
  // Một cảnh báo không cho biết lệch về phía nào thì không trừ hao được.
  for (const proxy of PROXIES) {
    const text = KNOWN_BIAS[proxy];
    assert.ok(text.length >= 40, `${proxy}: thiên lệch quá ngắn để nói được gì`);
    assert.ok(/lệch|Lệch|không đếm nhu cầu|đã qua lọc/.test(text), `${proxy}: không nói hướng lệch`);
  }
  // Điền cho có thì contract chặn.
  const signal = { ...viewsPerDayOfAge(loadCorpus(), TOPIC, CTX), knownBias: 'không có' };
  assert.equal(validateDemandSignal(signal).valid, false);
});

test('lượt xem mỗi ngày tuổi dùng trung vị — một video viral không kéo được số đi', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([1, 2, 1_000_000]), 2);

  const signal = viewsPerDayOfAge(loadCorpus(), TOPIC, CTX);
  assert.equal(signal.basis.sampleSize, 3, 'corpus mẫu có đúng 3 video cùng đề tài');
  assert.ok(signal.value > 0);
});

test('số video cùng đề tài trong 12 tháng đếm ít hơn hoặc bằng số video đã xét', () => {
  const signal = sameTopicCount12m(loadCorpus(), TOPIC, CTX);
  assert.ok(signal.value <= signal.basis.sampleSize);
  // Corpus mẫu: 3 video cùng đề tài, một trong đó đăng 2025-11-04 — vẫn nằm
  // trong 12 tháng tính tới 2026-09-10, nên cả ba đều đếm.
  assert.equal(signal.basis.sampleSize, 3);
  assert.equal(signal.value, 3);

  // Đẩy mốc đo đi hai năm: cùng corpus, không video nào còn trong cửa sổ.
  const later = sameTopicCount12m(loadCorpus(), TOPIC, { ...CTX, asOf: '2028-09-10T00:00:00.000Z' });
  assert.equal(later.value, 0);
  assert.equal(later.basis.sampleSize, 3, 'sampleSize là số đã xét, không phải số đã đếm');
});

test('đề tài không có trong corpus cho mẫu rỗng, không cho số bịa', () => {
  const signal = viewsPerDayOfAge(loadCorpus(), 'sourdough starter hydration ratios', CTX);
  assert.equal(signal.basis.sampleSize, 0);
  assert.equal(signal.value, 0);
  assert.equal(validateDemandSignal(signal).valid, true);
});

test('gợi ý tự động đếm đúng danh sách được truyền vào, và khai nguồn là autocomplete', () => {
  const signal = autocompleteSuggestions('emergency fund', ['x', 'y'], CTX);
  assert.equal(signal.value, 2);
  assert.equal(signal.basis.kind, 'autocomplete');
  assert.equal(signal.basis.ref, 'emergency fund');
});

test('video có tuổi âm thì ném lỗi, không kẹp về 1 ngày', () => {
  // Kẹp về 1 ngày làm mẫu số nhỏ đi và thổi lượt xem mỗi ngày tuổi lên, mà
  // không chỉ báo nào đỏ. Đo bằng chạy thật: đẩy một video đang khớp đề tài
  // sang tương lai thì bản kẹp cho 2231,88 thay vì 1331,18.
  const corpus = loadCorpus();
  const future = structuredClone(corpus);
  future.videos[0]!.publishedAt = '2027-01-01T00:00:00.000Z';

  assert.throws(() => viewsPerDayOfAge(future, TOPIC, CTX), /tuổi âm/);
  // Và corpus đó lẽ ra không bao giờ tới được đây: phép soát bắt trước.
  assert.ok(corpusProblems(future).length > 0);
});

test('video đăng đúng mốc đo có tuổi 0 — sàn 1 ngày chỉ để không chia cho 0', () => {
  // Đo đúng vào ngày đăng của video khớp đề tài MỚI NHẤT: video đó có tuổi 0,
  // hai video còn lại vẫn có tuổi dương, nên ca này tách riêng được sàn 1 ngày
  // khỏi ca tuổi âm ở bài kiểm trên.
  const corpus = loadCorpus();
  const newest = corpus.videos[2]!;
  const signal = viewsPerDayOfAge(corpus, TOPIC, { ...CTX, asOf: newest.publishedAt });
  assert.equal(signal.basis.sampleSize, 3);
  assert.ok(Number.isFinite(signal.value));
  assert.ok(signal.value > 0);
});

test('đo lại cho ra đúng số cũ — cùng corpus, cùng mốc, cùng kết quả', () => {
  const corpus = loadCorpus();
  assert.deepEqual(viewsPerDayOfAge(corpus, TOPIC, CTX), viewsPerDayOfAge(corpus, TOPIC, CTX));
  assert.deepEqual(sameTopicCount12m(corpus, TOPIC, CTX), sameTopicCount12m(corpus, TOPIC, CTX));
});
