/**
 * So ngữ nghĩa cho kiểm mới lạ — mục backlog `topic/T-014`, phần vừa được
 * mở khoá của `T-011` mục 2 (chỉ dẫn của chủ dự án trên luồng `#251`,
 * `2026-09-25T01:28:33Z`: chọn OpenAI, secret `EMBEDDINGS_API_KEY` đã có,
 * đổi nhà cung cấp về sau là `reversible`).
 *
 * ## Vì sao mục này tồn tại
 *
 * `checkNovelty` đang so **từ vựng** (trùng token sau khi bỏ hư từ). Phép so
 * đó bỏ sót cách diễn đạt khác chữ — "pay down the card first" và "clear
 * revolving balances before you save" nói cùng một chuyện mà không chung
 * token nào đáng kể. Bỏ sót video nói cùng chuyện thì `similarCount` thấp
 * đi, nên kết luận **chệch về phía `novel-in-corpus`**: chệch đúng hướng
 * nguy hiểm, vì nó cho phép làm một video mà corpus đã đầy.
 *
 * ## Ranh giới của file này — vì sao `checkNovelty` vẫn thuần
 *
 * File này **không** được `novelty.ts` import, và đó là chủ đích. Lời gọi
 * mạng nằm ở đây; `checkNovelty` nhận vào một **bảng điểm đã tính sẵn**
 * (`SemanticSimilarity`) nên nó giữ nguyên tính thuần của CHARTER 6.1: cùng
 * đầu vào cho cùng đầu ra, không gọi mạng, không đọc đồng hồ. Hệ quả đo
 * được: `pnpm check` và tập vàng replay không bao giờ gọi API trả tiền —
 * không phải vì có ai nhớ tắt, mà vì đường dẫn gọi mạng không nằm trên lối
 * đi của chúng.
 *
 * ## Giả định G20 — giá không nằm trong code
 *
 * Bảng giá đọc từ `data/embeddings/*.json` (`source: "vendor-docs"`), đúng
 * khuôn mà `G19` đã dùng cho hạn mức quota: giả định sai thì sửa một số
 * trong dữ liệu, không sửa dòng code nào. Và `costUsd` **thật** của một lần
 * chạy không tính từ bảng đó mà từ `usage.total_tokens` do chính nhà cung
 * cấp trả về trong lời gọi — bảng giá chỉ để **chọn** model trước khi gọi và
 * để ước tính. Xem `docs/assumptions.md` mục **G20**.
 *
 * Bất biến I3: chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, type JsonSchema, type ValidationResult } from '@crux/kernel';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));
const DATA_DIR = fileURLToPath(new URL('../data/embeddings/', import.meta.url));

export const embeddingModelsSchema: JsonSchema = JSON.parse(
  readFileSync(`${CONTRACTS_DIR}embedding-models.v0.schema.json`, 'utf8'),
) as JsonSchema;

/** Tên secret duy nhất được phép dùng cho embeddings. Chủ dự án tách nó khỏi `OPENAI_API_KEY` để theo dõi chi phí riêng. */
export const EMBEDDINGS_SECRET_NAME = 'EMBEDDINGS_API_KEY';

export interface EmbeddingModel {
  model: string;
  /** Giả định **G20** — số của nhà cung cấp, `source` của bảng nói nó lấy từ đâu. */
  usdPerMillionTokens: number;
  dimensions: number;
  note?: string;
}

export interface EmbeddingModelTable {
  schemaVersion: number;
  vendor: string;
  source: 'vendor-docs' | 'invoice-measured';
  asOf: string;
  models: EmbeddingModel[];
}

export function validateEmbeddingModelTable(value: unknown): ValidationResult {
  return validate(value, embeddingModelsSchema);
}

/**
 * Nạp bảng giá và **validate** trước khi trả. Đọc một file không hợp contract
 * mà vẫn chạy tiếp là cách một số giá điền cho có đi thẳng vào phép chọn
 * model.
 */
export function readEmbeddingModelTable(fileName = 'openai-2026-09-25.json'): EmbeddingModelTable {
  const value = JSON.parse(readFileSync(`${DATA_DIR}${fileName}`, 'utf8')) as unknown;
  const result = validateEmbeddingModelTable(value);
  if (!result.valid) {
    const errors = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Bảng model embeddings \`${fileName}\` không hợp contract: ${errors}`);
  }
  return value as EmbeddingModelTable;
}

/* ------------------------------------------------------------------ *
 * Phép so
 * ------------------------------------------------------------------ */

/**
 * Cosine của hai vector. Ném lỗi khi độ dài lệch — hai model khác nhau cho
 * hai số chiều khác nhau, và so chúng với nhau bằng cách cắt bớt là một phép
 * đo sai mà không gì đỏ.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: số chiều lệch (${a.length} vs ${b.length}) — không so được.`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    // `!` đứng được vì độ dài hai mảng đã bằng nhau ở dòng trên.
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ------------------------------------------------------------------ *
 * Nhà cung cấp
 * ------------------------------------------------------------------ */

export interface EmbeddingUsage {
  /** Số token nhà cung cấp **tính tiền**, lấy từ phản hồi của chính lời gọi. */
  totalTokens: number;
  /** Tiền của đúng lời gọi này, tính từ `totalTokens` và bảng giá. */
  costUsd: number;
}

export interface EmbeddingBatch {
  model: string;
  vectors: number[][];
  usage: EmbeddingUsage;
}

/**
 * Giao diện **trung tính nhà cung cấp**. Đổi OpenAI sang bên khác là viết
 * một bản mới của đúng cái này — chủ dự án đã chốt đó là `reversible`, và
 * giao diện này là thứ làm cho câu đó đúng trong code chứ không chỉ trong
 * lời.
 */
export interface EmbeddingProvider {
  readonly vendor: string;
  readonly model: string;
  embed(texts: readonly string[]): Promise<EmbeddingBatch>;
}

/** Tiền của một lần gọi, từ số token nhà cung cấp trả về và giá của model. */
export function costUsdFor(totalTokens: number, usdPerMillionTokens: number): number {
  return (totalTokens / 1_000_000) * usdPerMillionTokens;
}

export interface OpenAiProviderOptions {
  apiKey: string;
  model: EmbeddingModel;
  endpoint?: string;
  /** Tiêm để test không cần mạng. Mặc định là `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Bản OpenAI. Không tự đọc `process.env` — bên gọi đưa khoá vào, nên đường
 * đi của secret nhìn thấy được ở chỗ gọi thay vì chôn trong một lớp sâu.
 */
export function openAiEmbeddingProvider(options: OpenAiProviderOptions): EmbeddingProvider {
  const endpoint = options.endpoint ?? 'https://api.openai.com/v1/embeddings';
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  return {
    vendor: 'openai',
    model: options.model.model,
    async embed(texts: readonly string[]): Promise<EmbeddingBatch> {
      if (texts.length === 0) {
        return { model: options.model.model, vectors: [], usage: { totalTokens: 0, costUsd: 0 } };
      }
      const response = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ model: options.model.model, input: texts }),
      });
      if (!response.ok) {
        // Thân lỗi có thể mang khoá bị vọng lại; chỉ lấy mã và một đoạn ngắn.
        const body = (await response.text()).slice(0, 200);
        throw new Error(
          `Gọi embeddings thất bại: HTTP ${response.status}. Đoạn đầu thân lỗi: ${body}`,
        );
      }
      const payload = (await response.json()) as {
        data?: { index: number; embedding: number[] }[];
        usage?: { total_tokens?: number };
      };
      const data = payload.data ?? [];
      if (data.length !== texts.length) {
        throw new Error(
          `Nhà cung cấp trả ${data.length} vector cho ${texts.length} đoạn văn bản — không ghép cặp được.`,
        );
      }
      // Thứ tự trong `data` không được coi là đã đúng: nhà cung cấp trả
      // `index`, nên dùng nó. Tin vào thứ tự là một phép ghép sai âm thầm.
      const vectors: number[][] = new Array(texts.length);
      for (const row of data) vectors[row.index] = row.embedding;
      for (let i = 0; i < vectors.length; i += 1) {
        if (!vectors[i]) throw new Error(`Thiếu vector cho đoạn số ${i} — phản hồi không đủ index.`);
      }
      const totalTokens = payload.usage?.total_tokens ?? 0;
      return {
        model: options.model.model,
        vectors,
        usage: { totalTokens, costUsd: costUsdFor(totalTokens, options.model.usdPerMillionTokens) },
      };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Thiếu secret thì DỪNG và báo tên — cùng luật với `T-003` và `T-011`
 * ------------------------------------------------------------------ */

export interface SecretCheck {
  ok: boolean;
  /** Tên secret còn thiếu. Rỗng khi `ok`. */
  missing: string[];
  message: string;
}

/**
 * Luật của `T-011` tiêu chí xong 1, áp nguyên cho mục này: **thiếu secret thì
 * dừng và báo tên secret thiếu, không tự tạo secret**. Trả về một kết quả
 * thay vì ném, để bên gọi in ra được một câu người đọc hiểu.
 */
export function checkEmbeddingsSecret(env: Record<string, string | undefined>): SecretCheck {
  const value = env[EMBEDDINGS_SECRET_NAME];
  if (value && value.trim().length > 0) {
    return { ok: true, missing: [], message: `Có \`${EMBEDDINGS_SECRET_NAME}\`.` };
  }
  return {
    ok: false,
    missing: [EMBEDDINGS_SECRET_NAME],
    message:
      `Thiếu secret \`${EMBEDDINGS_SECRET_NAME}\`. DỪNG, không tự tạo secret và không thay ` +
      `bằng \`OPENAI_API_KEY\` — chủ dự án cố ý tách hai khoá để theo dõi chi phí riêng ` +
      `(chỉ dẫn #251, 2026-09-25T01:28:33Z).`,
  };
}

/* ------------------------------------------------------------------ *
 * "Rẻ nhất đủ chất lượng" — tiêu chí đo được, không phải lời khen
 * ------------------------------------------------------------------ */

/**
 * Một cặp thăm dò có nhãn: thesis nào, video nào, và hai bên có **nói cùng
 * chuyện** hay không. Nhãn do người đặt, và đó là chỗ duy nhất trong phép đo
 * này có phán đoán của người — nên nó nằm trong dữ liệu, không nằm trong
 * code.
 */
export interface ProbePair {
  thesisId: string;
  videoId: string;
  sameTopic: boolean;
}

export interface SeparationResult {
  model: string;
  /** Điểm thấp nhất trong các cặp `sameTopic: true`. */
  minSame: number;
  /** Điểm cao nhất trong các cặp `sameTopic: false`. */
  maxDifferent: number;
  /** `minSame - maxDifferent`. Âm nghĩa là hai nhóm chồng lên nhau. */
  margin: number;
  /** Đạt khi `margin >= minMargin`: mọi cặp cùng chuyện xếp trên mọi cặp khác chuyện. */
  adequate: boolean;
}

/**
 * Biên tối thiểu để gọi là "đủ chất lượng". `0` nghĩa là chỉ cần tách được
 * hai nhóm; con số dương đòi thêm khoảng đệm. Để ở đây kèm lời khai, đúng
 * khuôn `DEFAULT_THRESHOLDS` của `novelty.ts`: nó CHƯA có dữ liệu đứng sau
 * và sẽ chuyển xuống pack khi `T-009` hiệu chuẩn bằng corpus thật.
 */
export const DEFAULT_MIN_MARGIN = 0.05;

/**
 * Đo một model tách được hai nhóm cặp hay không. Thuần: nhận điểm đã tính,
 * không gọi mạng.
 *
 * Ném lỗi khi một trong hai nhóm rỗng — một phép "tách" chỉ có một nhóm luôn
 * đạt, và đó là ca hỏng im lặng đúng nghĩa.
 */
export function measureSeparation(
  model: string,
  pairs: readonly ProbePair[],
  scoreOf: (pair: ProbePair) => number,
  minMargin = DEFAULT_MIN_MARGIN,
): SeparationResult {
  const same = pairs.filter((p) => p.sameTopic).map(scoreOf);
  const different = pairs.filter((p) => !p.sameTopic).map(scoreOf);
  if (same.length === 0 || different.length === 0) {
    throw new Error(
      `measureSeparation: cần cả hai nhóm cặp (cùng chuyện: ${same.length}, khác chuyện: ${different.length}) — một nhóm rỗng thì phép tách luôn "đạt".`,
    );
  }
  const minSame = Math.min(...same);
  const maxDifferent = Math.max(...different);
  const margin = minSame - maxDifferent;
  return { model, minSame, maxDifferent, margin, adequate: margin >= minMargin };
}

export interface ModelCandidate {
  model: EmbeddingModel;
  separation: SeparationResult;
}

/**
 * "Rẻ nhất **đủ chất lượng**" theo đúng thứ tự đó: lọc trước theo `adequate`,
 * rồi mới lấy giá thấp nhất. Trả `null` khi không ứng viên nào đạt — không
 * hạ tiêu chí để có câu trả lời, vì một model không tách được hai nhóm thì
 * điểm ngữ nghĩa của nó không mang tin gì và `checkNovelty` sẽ chạy trên số
 * ngẫu nhiên mà vẫn xanh.
 */
export function cheapestAdequateModel(candidates: readonly ModelCandidate[]): ModelCandidate | null {
  const adequate = candidates.filter((c) => c.separation.adequate);
  if (adequate.length === 0) return null;
  return adequate.reduce((best, c) =>
    c.model.usdPerMillionTokens < best.model.usdPerMillionTokens ? c : best,
  );
}
