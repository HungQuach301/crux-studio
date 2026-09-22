/**
 * Corpus đối thủ — contract, phép soát, và cửa quota (mục backlog `T-008`,
 * spec WP-014).
 *
 * Luật cầm trịch của WP-014 mục 3c: **giới hạn của từng thứ nằm trong chính
 * dữ liệu, không nằm trong ghi chú.** Một ghi chú trong tài liệu không đi
 * theo file JSON khi file đó được đọc ở chỗ khác; một trường bắt buộc thì
 * có. Vì vậy mọi giới hạn ở đây là trường của contract, và mỗi trường có
 * một phép soát làm nó đỏ thật khi bị điền cho có.
 *
 * Phần **xây** corpus (gọi API nền tảng) KHÔNG nằm ở đây — xem mục `T-011`
 * và `docs/decisions/` cho chỗ nó bị chặn. File này là phần chạy được mà
 * không cần secret nào: contract, phép soát, và cửa quota mà bản xây sẽ gọi.
 *
 * Bất biến I3: chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, type JsonSchema, type ValidationResult } from '@crux/kernel';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

function load(name: string): JsonSchema {
  return JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as JsonSchema;
}

export const corpusSchema: JsonSchema = load('corpus.v0.schema.json');

/** Phạm vi một phép đo có hiệu lực. Dùng chung cho corpus, kiểm mới lạ và đại lượng nhu cầu. */
export interface Scope {
  regions: string[];
  languages: string[];
  windowDays: number;
  asOf: string;
}

export interface CorpusVideo {
  videoId: string;
  title: string;
  description?: string;
  publishedAt: string;
  durationMs: number;
  viewCount: number;
  channelId: string;
  channelTitle?: string;
}

export interface Corpus {
  schemaVersion: number;
  corpusId: string;
  builtAt: string;
  /** Thu từ API nền tảng, hay dựng tay để có dữ liệu chạy khi chưa có khoá. */
  provenance: 'hand-built' | 'api';
  scope: Scope;
  queries: { text: string; pagesFetched: number; resultsKept: number }[];
  coverage: {
    contentLevel: 'metadata-only';
    videoCount: number;
    partial: boolean;
    partialReason: string | null;
  };
  quota: {
    limits: {
      searchCallsPerDay: number;
      reserveFraction: number;
      source: 'vendor-docs' | 'console-measured';
      checkedAt: string;
    };
    spent: { searchCalls: number };
  };
  videos: CorpusVideo[];
}

/**
 * Số video tối thiểu để một lần kiểm mới lạ có nghĩa. Dưới ngưỡng này,
 * `checkNovelty` trả `insufficient-corpus` — không trả `novel-in-corpus` với
 * lý do "không thấy ai nói ngược", vì một corpus rỗng cũng không thấy ai nói
 * ngược (WP-014 kiểm âm 4).
 */
export const MIN_CORPUS_VIDEOS = 30;

/**
 * Corpus quá tuổi thì kết luận mới lạ cũng quá tuổi. Không chặn, nhưng
 * `checkNovelty` phải nói ra bằng một `reason` chứ không im lặng.
 */
export const CORPUS_STALE_DAYS = 30;

/**
 * Những trường mà WP-014 mục 5 CẤM đưa vào repo: bình luận thô và tên người
 * dùng. Danh sách này là khoá, không phải chuỗi con — `authorName` bị chặn,
 * `channelTitle` (tên kênh, là metadata công khai của video) thì không.
 *
 * Vì sao cần dù contract đã `additionalProperties: false`: schema chỉ gác
 * đúng những chỗ nó phủ, và một corpus bị sửa tay có thể mang trường thừa ở
 * tầng sâu hơn. Phép soát này quét cả cây, nên nó là lưới thứ hai chứ không
 * phải bản chép của lưới thứ nhất.
 */
export const FORBIDDEN_KEYS = [
  'comment',
  'comments',
  'commentText',
  'topLevelComment',
  'authorName',
  'authorDisplayName',
  'authorChannelId',
  'userName',
] as const;

/** Trả về đường dẫn của mọi khoá bị cấm tìm thấy trong `value`. */
export function forbiddenKeyPaths(value: unknown, path = '$'): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...forbiddenKeyPaths(item, `${path}[${index}]`)));
    return found;
  }
  if (typeof value !== 'object' || value === null) return found;
  for (const [key, sub] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      found.push(`${path}.${key}`);
    }
    found.push(...forbiddenKeyPaths(sub, `${path}.${key}`));
  }
  return found;
}

export function validateCorpus(value: unknown): ValidationResult {
  return validate(value, corpusSchema);
}

/**
 * Soát một corpus theo contract CỘNG bốn luật mà schema không diễn đạt được.
 * Trả danh sách vấn đề bằng tiếng Việt; rỗng nghĩa là sạch.
 */
export function corpusProblems(value: unknown): string[] {
  const problems: string[] = [];
  const result = validateCorpus(value);
  if (!result.valid) {
    problems.push(...result.errors.map((e) => `${e.path}: ${e.message}`));
    return problems;
  }
  const corpus = value as Corpus;

  // 1 · `partial` phải đi kèm lý do thật (WP-014 mục 5b: ghi corpus một phần
  //     với `coverage` TRUNG THỰC).
  if (corpus.coverage.partial && (corpus.coverage.partialReason ?? '').trim().length === 0) {
    problems.push(
      'coverage.partial = true nhưng partialReason rỗng. Một corpus một phần mà không nói vì sao ' +
        'thì bên đọc không phân biệt được "hết quota" với "đề tài này thật sự ít video".',
    );
  }
  if (!corpus.coverage.partial && (corpus.coverage.partialReason ?? '').trim().length > 0) {
    problems.push('coverage.partial = false nhưng partialReason có chữ — hai trường này mâu thuẫn.');
  }

  // 2 · `videoCount` là số đếm, không phải số khai.
  if (corpus.coverage.videoCount !== corpus.videos.length) {
    problems.push(
      `coverage.videoCount = ${corpus.coverage.videoCount} nhưng videos có ${corpus.videos.length} phần tử. ` +
        'Số đếm phải đo từ chính mảng, không khai tay.',
    );
  }

  // 3 · Không bình luận thô, không tên người dùng (WP-014 mục 5).
  for (const path of forbiddenKeyPaths(corpus)) {
    problems.push(`${path}: trường bị cấm trong repo — bình luận thô và tên người dùng không được lưu.`);
  }

  // 4 · Số lần gọi tìm kiếm phải khớp số trang đã lấy. Mỗi trang tiếp theo là
  //     một lần gọi nữa (WP-014 mục 3b), nên đây là phép cộng, không phải ước.
  const pages = corpus.queries.reduce((total, q) => total + q.pagesFetched, 0);
  if (corpus.quota.spent.searchCalls !== pages) {
    problems.push(
      `quota.spent.searchCalls = ${corpus.quota.spent.searchCalls} nhưng tổng pagesFetched là ${pages}. ` +
        'Mỗi trang kết quả tốn đúng một lần gọi — lệch nghĩa là một trong hai số bị khai tay.',
    );
  }

  // 5 · Mốc thời gian phải đứng vững: không video nào đăng SAU ngày dựng
  //     corpus, và không video nào nằm ngoài cửa sổ đã khai.
  //
  //     Vì sao đáng một luật riêng: một ngày đăng ở tương lai hợp
  //     `format: date-time` nên schema không bắt được, nhưng nó đi thẳng vào
  //     mẫu số của `viewsPerDayOfAge` và thổi đại lượng nhu cầu lên — hỏng mà
  //     mọi chỉ báo đều xanh, đúng nhóm Z của `ops/known-failures.md`.
  const builtMs = Date.parse(corpus.builtAt);
  const windowStartMs = Date.parse(corpus.scope.asOf) - corpus.scope.windowDays * 86_400_000;
  for (const video of corpus.videos) {
    const publishedMs = Date.parse(video.publishedAt);
    if (publishedMs > builtMs) {
      problems.push(
        `${video.videoId}: publishedAt ${video.publishedAt} nằm SAU builtAt ${corpus.builtAt}. ` +
          'Corpus không chụp được video chưa đăng.',
      );
    }
    if (publishedMs < windowStartMs) {
      problems.push(
        `${video.videoId}: publishedAt ${video.publishedAt} nằm ngoài cửa sổ ${corpus.scope.windowDays} ngày ` +
          `tính từ ${corpus.scope.asOf}. Cửa sổ đã khai phải đúng với dữ liệu trong file.`,
      );
    }
  }

  return problems;
}

export interface QuotaState {
  searchCallsPerDay: number;
  reserveFraction: number;
  spent: number;
}

export interface QuotaDecision {
  allowed: boolean;
  remaining: number;
  reserved: number;
  reason: string;
}

/**
 * Cửa quota của WP-014 mục 5: **dừng khi còn 20% bucket tìm kiếm trong
 * ngày**, để dành cho việc khác.
 *
 * Trả quyết định kèm lý do thay vì ném lỗi: bản xây corpus phải dừng *sạch*
 * và ghi corpus một phần (mục 5b), chứ không phải chết giữa chừng.
 *
 * Giả định **G19** (100 lần gọi `search.list` mỗi ngày) đứng dưới số này, và
 * mới ở mức `tài liệu nói vậy`. Dự phòng nằm ngay trong chữ ký hàm: hạn mức
 * là THAM SỐ, đọc từ `quota.limits` của chính ảnh chụp corpus. G19 sai thì
 * sửa một số trong dữ liệu, không sửa dòng code nào ở đây.
 */
export function quotaGate(state: QuotaState): QuotaDecision {
  const reserved = Math.ceil(state.searchCallsPerDay * state.reserveFraction);
  const usable = state.searchCallsPerDay - reserved;
  const remaining = usable - state.spent;
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: Math.max(0, remaining),
      reserved,
      reason:
        `Đã dùng ${state.spent}/${usable} lần gọi tìm kiếm được phép hôm nay ` +
        `(giữ lại ${reserved} lần cho việc khác). Dừng và ghi corpus một phần.`,
    };
  }
  return {
    allowed: true,
    remaining,
    reserved,
    reason: `Còn ${remaining} lần gọi tìm kiếm trước khi chạm phần dự trữ ${reserved} lần.`,
  };
}
