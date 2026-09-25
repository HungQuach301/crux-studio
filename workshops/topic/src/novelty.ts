/**
 * Kiểm mới lạ cho một thesis (mục backlog `T-008`, spec WP-014).
 *
 * Tiêu chí xong của `T-008`: kiểm chạy **tự động** cho một thesis và trả về
 * **lý do**, không chỉ trả về điểm. Vì vậy `reasons` là trường bắt buộc có ít
 * nhất một phần tử, và mỗi lối ra của hàm dưới đây đều nạp lý do trước khi
 * chốt `verdict`.
 *
 * Ba chỗ dễ sai mà WP-014 mục 3c.2 gọi tên, và cách file này chặn:
 *
 * 1. `contradictingCount = 0` KHÔNG chứng minh mới lạ. Một corpus rỗng cũng
 *    cho `0`. Nên ngưỡng corpus tối thiểu được xét TRƯỚC mọi thứ khác, và
 *    `similarCount` cao vẫn hạ `verdict` xuống `crowded-in-corpus` dù không
 *    có video nào nói ngược.
 * 2. Không có giá trị `novel` — chỉ `novel-in-corpus`. Kết luận nói về corpus
 *    đã kiểm, không nói về thế giới.
 * 3. `limitation` bắt buộc có chữ, và `assertNoUniversalClaim` chặn đúng các
 *    lối nói mà WP-014 mục 5 cấm ("chưa ai công bố", "nobody has").
 *
 * **Giới hạn của chính phép so ở đây**, khai ra thay vì giấu: mặc định là so
 * **từ vựng** (trùng token sau khi bỏ hư từ), không phải so ngữ nghĩa. Phép
 * so từ vựng bỏ sót cách diễn đạt khác chữ, nên nó **thiên về** kết luận
 * `novel-in-corpus` — chệch đúng theo hướng nguy hiểm. Câu đó nằm trong
 * `limitation` của MỌI kết quả, không nằm trong ghi chú này.
 *
 * Từ mục `topic/T-014`, `checkNovelty` nhận thêm một tham số tuỳ chọn:
 * bảng điểm **ngữ nghĩa** đã tính sẵn (`SemanticSimilarity`). Chủ dự án đã
 * chốt OpenAI cho embeddings và cấp `EMBEDDINGS_API_KEY` (chỉ dẫn `#251`,
 * `2026-09-25T01:28:33Z`), và ghi rõ đổi nhà cung cấp về sau là
 * `reversible`. Lời gọi mạng KHÔNG nằm trong file này — nó ở
 * `embeddings.ts` — nên hàm dưới đây giữ nguyên tính thuần của CHARTER 6.1
 * và `pnpm check` không bao giờ đi qua một API trả tiền.
 *
 * Bất biến I3: chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, type JsonSchema, type ValidationResult } from '@crux/kernel';
import {
  MIN_CORPUS_VIDEOS,
  CORPUS_STALE_DAYS,
  type Corpus,
  type CorpusVideo,
  type Scope,
} from './corpus.ts';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

export const noveltyCheckSchema: JsonSchema = JSON.parse(
  readFileSync(`${CONTRACTS_DIR}novelty-check.v0.schema.json`, 'utf8'),
) as JsonSchema;

export type NoveltyVerdict =
  | 'novel-in-corpus'
  | 'contested-in-corpus'
  | 'crowded-in-corpus'
  | 'insufficient-corpus';

export interface NoveltyReason {
  code:
    | 'corpus-below-minimum'
    | 'corpus-partial'
    | 'corpus-stale'
    | 'similar-above-threshold'
    | 'similar-below-threshold'
    | 'contradicting-found'
    | 'contradicting-none'
    | 'scope-narrow';
  detail: string;
}

export interface NoveltyCheck {
  schemaVersion: number;
  thesisId: string;
  checkedAt: string;
  corpusRef: { corpusId: string; builtAt: string; videoCount: number };
  scope: Scope;
  verdict: NoveltyVerdict;
  reasons: NoveltyReason[];
  similarCount: number;
  contradictingCount: number;
  matches?: { videoId: string; overlap: number; stance: 'similar' | 'contradicting' }[];
  limitation: string;
}

export interface Thesis {
  id: string;
  statement: string;
}

/**
 * Bảng điểm ngữ nghĩa **đã tính sẵn** cho một thesis: `videoId` → cosine
 * giữa vector của thesis và vector của video (mục `topic/T-014`).
 *
 * Vì sao truyền bảng điểm vào thay vì truyền một client: `checkNovelty` phải
 * chạy lại được y nguyên từ artifact (CHARTER 6.1). Một client thì cùng đầu
 * vào cho hai đầu ra khác nhau vào hai ngày khác nhau; một bảng điểm thì
 * không. Bên tính bảng này là `embeddings.ts`, và chính nó ghi `costUsd`.
 */
export interface SemanticSimilarity {
  /** Model đã tính ra bảng điểm — đi vào `limitation` để người đọc biết số này của ai. */
  model: string;
  /** `videoId` → cosine, trong khoảng [-1, 1]. */
  scores: Readonly<Record<string, number>>;
  /** Từ điểm này trở lên thì video được tính là "nói cùng chuyện". */
  threshold: number;
}

export interface NoveltyThresholds {
  /** Phần token của thesis phải trùng để một video được tính là "nói cùng chuyện". */
  similarOverlap: number;
  /** Từ ngần này video cùng chuyện trở lên, đề tài coi như đã đông — dù không ai nói ngược. */
  crowdedAt: number;
}

/**
 * Ngưỡng tạm tính, khai ở đây để đổi được một chỗ. Chúng CHƯA có dữ liệu
 * đứng sau — chốt bằng số đo là việc của `T-009`, khi đã có corpus thật để
 * hiệu chuẩn. Tới lúc đó thì chuyển xuống pack theo luật "ngưỡng không nằm
 * trong code" (`kernel/contracts/README.md`).
 */
export const DEFAULT_THRESHOLDS: NoveltyThresholds = { similarOverlap: 0.5, crowdedAt: 8 };

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for', 'from', 'how',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
]);

/**
 * Dấu hiệu một video đang nói NGƯỢC chứ không nói cùng. Cố ý hẹp: thà sót
 * còn hơn gán oan, vì `contested-in-corpus` thắng mọi nhánh khác nên một
 * marker rộng nuốt cả `crowded-in-corpus` lẫn `novel-in-corpus`.
 *
 * `stop` từng nằm trong danh sách và đã bị bỏ: "Stop doing X" là khuôn tiêu
 * đề rất phổ biến của tài chính cá nhân Mỹ, dùng cho cả video nói xuôi.
 * Đừng thêm lại mà không có ca đo.
 */
const CONTRADICTION_MARKERS = [
  'myth', 'myths', 'debunk', 'debunked', 'debunking', 'wrong', 'mistake', 'mistakes',
  'misleading', 'overrated', 'scam', 'lie', 'lies', 'busted',
];

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Phần token của `thesis` xuất hiện trong `text`. 0 khi thesis không còn token nào sau khi bỏ hư từ. */
export function overlapRatio(thesisTokens: readonly string[], text: string): number {
  if (thesisTokens.length === 0) return 0;
  const unique = new Set(thesisTokens);
  const haystack = new Set(tokenize(text));
  let hit = 0;
  for (const token of unique) if (haystack.has(token)) hit += 1;
  return hit / unique.size;
}

function videoText(video: CorpusVideo): string {
  return `${video.title} ${video.description ?? ''}`;
}

function looksContradicting(video: CorpusVideo): boolean {
  const tokens = new Set(tokenize(videoText(video)));
  return CONTRADICTION_MARKERS.some((marker) => tokens.has(marker));
}

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000;
}

/**
 * Những lối nói mà WP-014 mục 5 cấm ở MỌI chỗ trong output: tuyên bố về thế
 * giới thay vì về corpus đã kiểm.
 */
const UNIVERSAL_CLAIM_PATTERNS = [
  /\bno\s?one\s+has\b/i,
  /\bnobody\s+has\b/i,
  /\bfirst\s+ever\b/i,
  /\bnever\s+been\s+(said|published|covered)\b/i,
  /chưa\s+ai\s+(công\s+bố|nói|làm)/i,
  /đầu\s+tiên\s+trên\s+thế\s+giới/i,
];

/**
 * Ném lỗi khi `text` tuyên bố "chưa ai công bố". Gọi ở cuối `checkNovelty`,
 * nên một lần sửa câu `limitation` thành lời quảng cáo sẽ đỏ ngay trong test,
 * không đợi tới lúc câu đó lên màn hình.
 */
export function assertNoUniversalClaim(text: string, where: string): void {
  for (const pattern of UNIVERSAL_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `${where}: tuyên bố "chưa ai công bố" bị cấm (WP-014 mục 5). Chỉ được nói ` +
          `"không thấy trong corpus đã kiểm, phạm vi X, ngày Y". Câu vi phạm: ${text}`,
      );
    }
  }
}

function limitationFor(
  corpus: Corpus,
  checkedAt: string,
  similarity: SemanticSimilarity | undefined,
): string {
  const scope = corpus.scope;
  // Câu cuối nói về PHÉP SO đã dùng thật, không về phép so mà file này mặc
  // định. Hai nhánh cho hai phép so khác nhau: một câu chung cho cả hai sẽ
  // sai ở đúng một nửa số lần chạy.
  const method = similarity
    ? `Phép so là so ngữ nghĩa bằng embeddings (\`${similarity.model}\`), ngưỡng ${similarity.threshold}. ` +
      `Nó bắt được cách diễn đạt khác chữ mà so từ vựng bỏ sót, nhưng nó vẫn chỉ đọc metadata, ` +
      `và điểm cosine là phép đo gần đúng của "nói cùng chuyện" chứ không phải bằng chứng.`
    : `Phép so là so từ vựng, không phải so ngữ nghĩa, nên cách diễn đạt khác chữ bị bỏ sót ` +
      `và kết quả chệch về phía "mới lạ".`;
  return (
    `Kết quả chỉ nói về corpus \`${corpus.corpusId}\`: ${corpus.coverage.videoCount} video, ` +
    `vùng ${scope.regions.join('/')}, ngôn ngữ ${scope.languages.join('/')}, ` +
    `cửa sổ ${scope.windowDays} ngày tính tới ${scope.asOf}, kiểm ngày ${checkedAt}. ` +
    `Corpus là metadata (tiêu đề, mô tả), không phải nội dung video — một video nói đúng ` +
    `chuyện này trong phút thứ tám mà không nhắc ở tiêu đề thì không đếm được. ` +
    method
  );
}

/**
 * Điểm ngữ nghĩa của một video, và **ném lỗi** khi bảng điểm không có video
 * đó.
 *
 * Vì sao ném chứ không coi là 0: thiếu một điểm nghĩa là lần nhúng đã bỏ sót
 * một video — có thể vì hết quota giữa chừng, có thể vì ghép cặp sai index.
 * Coi nó là 0 thì video đó biến mất khỏi `similarCount`, kết luận chệch về
 * phía `novel-in-corpus`, và **không gì đỏ**: đúng hình dạng nhóm Z, và đúng
 * cái hướng chệch nguy hiểm mà cả mục này sinh ra để chữa.
 */
function semanticScoreOf(similarity: SemanticSimilarity, videoId: string): number {
  const score = similarity.scores[videoId];
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new Error(
      `Bảng điểm ngữ nghĩa (\`${similarity.model}\`) thiếu điểm cho video \`${videoId}\`. ` +
        `Nhúng thiếu một video thì kết luận chệch về phía "mới lạ" mà không chỉ báo nào đỏ — ` +
        `nên đây là lỗi, không phải điểm 0.`,
    );
  }
  return score;
}

/**
 * Kiểm mới lạ cho một thesis trong một corpus. Thuần: cùng đầu vào cho cùng
 * đầu ra, không gọi mạng, không đọc đồng hồ (`checkedAt` do bên gọi truyền
 * vào, lấy từ `ctx.clock` — luật chạy lại được của CHARTER 6.1).
 */
export function checkNovelty(
  thesis: Thesis,
  corpus: Corpus,
  checkedAt: string,
  thresholds: NoveltyThresholds = DEFAULT_THRESHOLDS,
  similarity?: SemanticSimilarity,
): NoveltyCheck {
  const reasons: NoveltyReason[] = [];
  const thesisTokens = tokenize(thesis.statement);

  // Một ngưỡng cho một phép so. Dùng `thresholds.similarOverlap` (hiệu chuẩn
  // cho phần token trùng) làm ngưỡng cosine sẽ là hai đại lượng khác nhau đội
  // chung một con số.
  const cutoff = similarity ? similarity.threshold : thresholds.similarOverlap;
  const scoreOf = similarity
    ? (video: CorpusVideo): number => semanticScoreOf(similarity, video.videoId)
    : (video: CorpusVideo): number => overlapRatio(thesisTokens, videoText(video));

  const matches = corpus.videos
    .map((video) => ({
      videoId: video.videoId,
      overlap: scoreOf(video),
      stance: looksContradicting(video) ? ('contradicting' as const) : ('similar' as const),
    }))
    .filter((match) => match.overlap >= cutoff);

  const contradicting = matches.filter((m) => m.stance === 'contradicting');
  const similar = matches.filter((m) => m.stance === 'similar');

  if (corpus.coverage.partial) {
    reasons.push({
      code: 'corpus-partial',
      detail: `Corpus chỉ chụp được một phần: ${corpus.coverage.partialReason ?? 'không ghi lý do'}.`,
    });
  }
  const ageDays = daysBetween(corpus.builtAt, checkedAt);
  if (ageDays > CORPUS_STALE_DAYS) {
    reasons.push({
      code: 'corpus-stale',
      detail: `Corpus dựng ${Math.floor(ageDays)} ngày trước, quá ngưỡng ${CORPUS_STALE_DAYS} ngày — video mới hơn thế không có trong đây.`,
    });
  }
  if (corpus.scope.regions.length === 1 && corpus.scope.languages.length === 1) {
    reasons.push({
      code: 'scope-narrow',
      detail: `Chỉ một vùng (${corpus.scope.regions[0]}) và một ngôn ngữ (${corpus.scope.languages[0]}) — không nói gì về phần còn lại.`,
    });
  }

  let verdict: NoveltyVerdict;
  if (corpus.coverage.videoCount < MIN_CORPUS_VIDEOS) {
    // Xét TRƯỚC mọi thứ khác: dưới ngưỡng thì hai số đếm dưới đây không mang
    // tin gì, kể cả khi chúng bằng 0 (WP-014 kiểm âm 4).
    verdict = 'insufficient-corpus';
    reasons.push({
      code: 'corpus-below-minimum',
      detail: `Corpus có ${corpus.coverage.videoCount} video, dưới ngưỡng tối thiểu ${MIN_CORPUS_VIDEOS}. Không kết luận được gì về mới lạ — kể cả khi không có video nào nói ngược.`,
    });
  } else if (contradicting.length > 0) {
    verdict = 'contested-in-corpus';
    reasons.push({
      code: 'contradicting-found',
      detail: `${contradicting.length} video trong corpus nói ngược thesis này (${contradicting.map((m) => m.videoId).join(', ')}).`,
    });
  } else if (similar.length >= thresholds.crowdedAt) {
    // WP-014 kiểm âm 3: không có ai nói ngược KHÔNG đủ để gọi là mới lạ khi
    // đã có đông người nói cùng chuyện.
    verdict = 'crowded-in-corpus';
    reasons.push({ code: 'contradicting-none', detail: 'Không video nào trong corpus nói ngược thesis này.' });
    reasons.push({
      code: 'similar-above-threshold',
      detail: `Nhưng có ${similar.length} video nói cùng chuyện, từ ngưỡng ${thresholds.crowdedAt} trở lên. Đề tài đã đông, không phải chưa ai chạm tới.`,
    });
  } else {
    verdict = 'novel-in-corpus';
    reasons.push({ code: 'contradicting-none', detail: 'Không video nào trong corpus nói ngược thesis này.' });
    reasons.push({
      code: 'similar-below-threshold',
      detail: `${similar.length} video nói cùng chuyện, dưới ngưỡng đông ${thresholds.crowdedAt}.`,
    });
  }

  const limitation = limitationFor(corpus, checkedAt, similarity);
  assertNoUniversalClaim(limitation, 'limitation');
  for (const reason of reasons) assertNoUniversalClaim(reason.detail, `reasons[${reason.code}]`);

  return {
    schemaVersion: 0,
    thesisId: thesis.id,
    checkedAt,
    corpusRef: {
      corpusId: corpus.corpusId,
      builtAt: corpus.builtAt,
      videoCount: corpus.coverage.videoCount,
    },
    scope: corpus.scope,
    verdict,
    reasons,
    similarCount: similar.length,
    contradictingCount: contradicting.length,
    matches,
    limitation,
  };
}

export function validateNoveltyCheck(value: unknown): ValidationResult {
  return validate(value, noveltyCheckSchema);
}
