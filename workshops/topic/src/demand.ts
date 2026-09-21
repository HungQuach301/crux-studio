/**
 * Ba đại lượng thay thế cho trục nhu cầu của Topic Scoring (mục backlog
 * `T-008`, spec WP-014 mục 3c.3).
 *
 * Chúng là **proxy**, không phải nhu cầu. Không đại lượng nào đo được "bao
 * nhiêu người muốn xem chuyện này"; cả ba đo dấu vết của những người đã xem
 * thứ na ná. Vì vậy contract `demand-signal.v0` bắt buộc bốn trường — `asOf`,
 * `region`, `language`, `knownBias` — và `knownBias` phải dài tối thiểu 40 ký
 * tự để không điền được "không có" cho xong. Thiên lệch đi THEO số đo, không
 * nằm trong tài liệu mà bên đọc số có thể chưa từng mở.
 *
 * Bất biến I3: chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, type JsonSchema, type ValidationResult } from '@crux/kernel';
import { type Corpus, type CorpusVideo } from './corpus.ts';
import { overlapRatio, tokenize, DEFAULT_THRESHOLDS } from './novelty.ts';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

export const demandSignalSchema: JsonSchema = JSON.parse(
  readFileSync(`${CONTRACTS_DIR}demand-signal.v0.schema.json`, 'utf8'),
) as JsonSchema;

export type DemandProxy = 'views-per-day-of-age' | 'same-topic-count-12m' | 'autocomplete-suggestions';

export interface DemandSignal {
  schemaVersion: number;
  proxy: DemandProxy;
  value: number;
  unit: 'views-per-day' | 'videos' | 'suggestions';
  basis: { kind: 'corpus' | 'autocomplete'; ref: string; sampleSize: number };
  asOf: string;
  region: string;
  language: string;
  knownBias: string;
}

/**
 * Thiên lệch đã biết của từng đại lượng, viết một lần ở đây để ba chỗ gọi
 * không trôi khỏi nhau. Mỗi câu nói **hướng** lệch, không chỉ nói "có lệch" —
 * một cảnh báo không cho biết lệch về phía nào thì không dùng được để trừ hao.
 */
export const KNOWN_BIAS: Readonly<Record<DemandProxy, string>> = {
  'views-per-day-of-age':
    'Lệch về phía video CŨ: lượt xem tích luỹ mãi còn tuổi thì chia đều, nên một video hai năm ' +
    'tuổi vẫn được cộng lượt xem hôm nay. Cũng lệch về phía video đã được thuật toán đẩy — ' +
    'corpus chỉ thấy thứ tìm kiếm trả về, không thấy thứ không ai bấm vào.',
  'same-topic-count-12m':
    'Đếm nguồn CUNG, không đếm nhu cầu. Nhiều video cùng đề tài đọc được theo hai nghĩa ngược ' +
    'nhau: đề tài có người xem, hoặc đề tài đã bão hoà. Số này chỉ có nghĩa khi đọc cùng ' +
    'lượt xem mỗi ngày tuổi, không đọc một mình.',
  'autocomplete-suggestions':
    'Gợi ý tự động là sản phẩm đã qua lọc của nền tảng, không phải truy vấn thô của người dùng: ' +
    'nó bỏ gợi ý nhạy cảm, ưu ái truy vấn gần đây, và đổi theo vùng lẫn lịch sử phiên. Hai lần ' +
    'đo cách nhau vài ngày cho hai danh sách khác nhau mà không có gì báo.',
};

export interface MeasureContext {
  asOf: string;
  region: string;
  language: string;
}

function ageDays(video: CorpusVideo, asOf: string): number {
  return Math.max(1, (Date.parse(asOf) - Date.parse(video.publishedAt)) / 86_400_000);
}

/** Trung vị, không trung bình: một video viral kéo trung bình đi rất xa. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function matchingVideos(corpus: Corpus, topic: string, minOverlap: number): CorpusVideo[] {
  const tokens = tokenize(topic);
  return corpus.videos.filter(
    (video) => overlapRatio(tokens, `${video.title} ${video.description ?? ''}`) >= minOverlap,
  );
}

/**
 * Đại lượng 1 · Lượt xem trung vị mỗi ngày tuổi, trên các video cùng đề tài.
 */
export function viewsPerDayOfAge(
  corpus: Corpus,
  topic: string,
  ctx: MeasureContext,
  minOverlap: number = DEFAULT_THRESHOLDS.similarOverlap,
): DemandSignal {
  const videos = matchingVideos(corpus, topic, minOverlap);
  const rates = videos.map((video) => video.viewCount / ageDays(video, ctx.asOf));
  return {
    schemaVersion: 0,
    proxy: 'views-per-day-of-age',
    value: Math.round(median(rates) * 100) / 100,
    unit: 'views-per-day',
    basis: { kind: 'corpus', ref: corpus.corpusId, sampleSize: videos.length },
    asOf: ctx.asOf,
    region: ctx.region,
    language: ctx.language,
    knownBias: KNOWN_BIAS['views-per-day-of-age'],
  };
}

/** Cửa sổ của đại lượng 2, theo đúng tên của nó trong WP-014. */
export const SAME_TOPIC_WINDOW_DAYS = 365;

/**
 * Đại lượng 2 · Số video cùng đề tài đăng trong 12 tháng gần nhất.
 */
export function sameTopicCount12m(
  corpus: Corpus,
  topic: string,
  ctx: MeasureContext,
  minOverlap: number = DEFAULT_THRESHOLDS.similarOverlap,
): DemandSignal {
  const videos = matchingVideos(corpus, topic, minOverlap);
  const recent = videos.filter((video) => ageDays(video, ctx.asOf) <= SAME_TOPIC_WINDOW_DAYS);
  return {
    schemaVersion: 0,
    proxy: 'same-topic-count-12m',
    value: recent.length,
    unit: 'videos',
    // `sampleSize` là số video ĐÃ XÉT, không phải số đã đếm — hai số khác
    // nhau, và bên đọc cần cả hai để biết `value` nhỏ vì đề tài vắng hay vì
    // corpus vắng.
    basis: { kind: 'corpus', ref: corpus.corpusId, sampleSize: videos.length },
    asOf: ctx.asOf,
    region: ctx.region,
    language: ctx.language,
    knownBias: KNOWN_BIAS['same-topic-count-12m'],
  };
}

/**
 * Đại lượng 3 · Số gợi ý tự động cho một cụm tìm kiếm.
 *
 * Danh sách gợi ý do bên gọi truyền vào chứ không lấy về ở đây: lấy về là
 * việc của bản xây corpus (`T-011`), đang bị chặn bởi secret chưa có. Hàm
 * này vẫn là chỗ duy nhất đóng gói phép đo, nên khi đường lấy về thông thì
 * không ai phải viết lại phần khai thiên lệch.
 */
export function autocompleteSuggestions(
  seed: string,
  suggestions: readonly string[],
  ctx: MeasureContext,
): DemandSignal {
  return {
    schemaVersion: 0,
    proxy: 'autocomplete-suggestions',
    value: suggestions.length,
    unit: 'suggestions',
    basis: { kind: 'autocomplete', ref: seed, sampleSize: suggestions.length },
    asOf: ctx.asOf,
    region: ctx.region,
    language: ctx.language,
    knownBias: KNOWN_BIAS['autocomplete-suggestions'],
  };
}

export function validateDemandSignal(value: unknown): ValidationResult {
  return validate(value, demandSignalSchema);
}
