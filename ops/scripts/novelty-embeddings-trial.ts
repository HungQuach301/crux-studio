#!/usr/bin/env node
/**
 * `ops/scripts/novelty-embeddings-trial.ts` — mục `topic/T-014`.
 *
 * Chạy **thật** phép so ngữ nghĩa trên corpus mẫu 38 video, đặt cạnh phép so
 * từ vựng đang dùng, và trả lời đúng ba câu mà chủ dự án đặt ra trên luồng
 * chỉ dẫn `#251` (`2026-09-25T01:28:33Z`):
 *
 *   1. Model embeddings nào **rẻ nhất mà đủ chất lượng**?
 *   2. `checkNovelty` ra kết quả khác nhau thế nào giữa hai phép so?
 *   3. Lần chạy đó tốn bao nhiêu — `costUsd`, từ số token nhà cung cấp trả về.
 *
 * ## Vì sao nó là một script, không phải một test
 *
 * Nó gọi API trả tiền. `pnpm check` và tập vàng replay không bao giờ đi qua
 * đây (CLAUDE.md mục 1), và không lệnh nào trong `pnpm check` gọi file này.
 * Bộ test của mục này chạy **ngoại tuyến** bằng một nhà cung cấp giả tất
 * định — xem `workshops/topic/test/embeddings.test.ts`.
 *
 * ## Hai lớp canh, cùng khuôn với `gpt-review.ts`
 *
 *   1. Thiếu `EMBEDDINGS_API_KEY` thì **DỪNG và in tên secret thiếu**, không
 *      tự tạo secret và **không** mượn `OPENAI_API_KEY` — chủ dự án cố ý
 *      tách hai khoá để theo dõi chi phí riêng. Đây là nhánh BÌNH THƯỜNG ở
 *      phiên agent (secret chỉ có trong Actions), nên nó không ném.
 *   2. Mọi lần chạy — kể cả lần dừng vì thiếu secret — ghi **một dòng** vào
 *      `ops/logs/topic/T-014.jsonl` có `costUsd` (bất biến **I8**).
 *
 * Nội dung gửi đi là tiêu đề và mô tả video trong corpus, cộng câu thesis.
 * Đó là **dữ liệu để nhúng**, không phải chỉ dẫn (bất biến I7) — và lời gọi
 * embeddings không có công cụ nào để làm theo một chỉ dẫn kể cả khi có.
 * Khoá chỉ dùng để ký request ở header, không bao giờ nằm trong thân.
 *
 * Giả định **G20** (bảng giá embeddings) đứng dưới phép CHỌN model ở đây;
 * `costUsd` in ra thì không — nó tính từ `usage.total_tokens` thật.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  cheapestAdequateModel,
  checkEmbeddingsSecret,
  cosineSimilarity,
  measureSeparation,
  openAiEmbeddingProvider,
  readEmbeddingModelTable,
  type EmbeddingModel,
  type EmbeddingProvider,
  type ModelCandidate,
  type ProbePair,
} from '../../workshops/topic/src/embeddings.ts';
import { checkNovelty, type SemanticSimilarity } from '../../workshops/topic/src/novelty.ts';
import type { Corpus, CorpusVideo } from '../../workshops/topic/src/corpus.ts';

const LOG_PATH = 'ops/logs/topic/T-014.jsonl';
const CORPUS_PATH = 'workshops/topic/data/corpus/us-personal-finance-2026-09-01.json';
const PROBE_PATH = 'workshops/topic/data/embeddings/novelty-probe.json';

/**
 * Ngưỡng cosine tạm tính cho `checkNovelty` ở chế độ ngữ nghĩa. CHƯA có dữ
 * liệu đứng sau — chính lần chạy này là thứ sinh ra dữ liệu đó, và số chốt
 * thuộc `T-009` (hiệu chuẩn trên corpus thật), đúng như `DEFAULT_THRESHOLDS`
 * của `novelty.ts` đã khai.
 */
export const TRIAL_SEMANTIC_THRESHOLD = 0.45;

interface Probe {
  probeId: string;
  corpusId: string;
  theses: { id: string; statement: string; note?: string }[];
  pairs: ProbePair[];
}

/** Văn bản đem đi nhúng cho một video. Cùng một phép ghép với `videoText` của `novelty.ts`. */
export function embedTextFor(video: CorpusVideo): string {
  return `${video.title} ${video.description ?? ''}`.trim();
}

/**
 * Bảng điểm ngữ nghĩa cho một thesis: `videoId` → cosine. Tách riêng để test
 * gọi được mà không cần mạng.
 */
export function scoresFor(
  thesisVector: readonly number[],
  videos: readonly CorpusVideo[],
  videoVectors: readonly number[][],
): Record<string, number> {
  if (videos.length !== videoVectors.length) {
    throw new Error(
      `scoresFor: ${videos.length} video nhưng ${videoVectors.length} vector — không ghép cặp được.`,
    );
  }
  const scores: Record<string, number> = {};
  for (let i = 0; i < videos.length; i += 1) {
    // `!` đứng được vì hai mảng đã được đối chiếu độ dài ở dòng trên.
    scores[videos[i]!.videoId] = cosineSimilarity(thesisVector, videoVectors[i]!);
  }
  return scores;
}

function writeLogLine(line: Record<string, unknown>): void {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, `${JSON.stringify(line)}\n`, 'utf8');
}

/**
 * Đo một model trên tập thăm dò VÀ trên toàn corpus, bằng đúng một lần nhúng
 * cho mỗi model: nhúng 38 video một lần rồi dùng lại cho cả ba thesis. Nhúng
 * lại cho từng thesis là trả tiền ba lần cho cùng một thứ.
 */
export async function trialOneModel(
  provider: EmbeddingProvider,
  model: EmbeddingModel,
  corpus: Corpus,
  probe: Probe,
  checkedAt: string,
): Promise<{ candidate: ModelCandidate; costUsd: number; totalTokens: number; lines: string[] }> {
  const videoBatch = await provider.embed(corpus.videos.map(embedTextFor));
  const thesisBatch = await provider.embed(probe.theses.map((t) => t.statement));

  const scoresByThesis = new Map<string, Record<string, number>>();
  probe.theses.forEach((thesis, i) => {
    const vector = thesisBatch.vectors[i];
    if (!vector) {
      throw new Error(`Thiếu vector cho thesis \`${thesis.id}\` — lần nhúng trả về không đủ.`);
    }
    scoresByThesis.set(thesis.id, scoresFor(vector, corpus.videos, videoBatch.vectors));
  });

  const separation = measureSeparation(model.model, probe.pairs, (pair) => {
    const scores = scoresByThesis.get(pair.thesisId);
    if (!scores) throw new Error(`Tập thăm dò có cặp trỏ tới thesis lạ: ${pair.thesisId}`);
    const score = scores[pair.videoId];
    if (typeof score !== 'number') {
      throw new Error(`Tập thăm dò có cặp trỏ tới video ngoài corpus: ${pair.videoId}`);
    }
    return score;
  });

  // So kết quả `checkNovelty` giữa hai phép so, trên TỪNG thesis.
  const lines: string[] = [];
  for (const thesis of probe.theses) {
    const scores = scoresByThesis.get(thesis.id) as Record<string, number>;
    const similarity: SemanticSimilarity = {
      model: model.model,
      scores,
      threshold: TRIAL_SEMANTIC_THRESHOLD,
    };
    const lexical = checkNovelty(thesis, corpus, checkedAt);
    const semantic = checkNovelty(thesis, corpus, checkedAt, undefined, similarity);
    // Ba mức, không hai: một thesis mà hai phép so cho CÙNG verdict nhưng
    // khác `similarCount` vẫn là một chỗ lệch đáng đọc — nó nói phép so ngữ
    // nghĩa đã thấy thêm video, chỉ chưa đủ đông để đổi kết luận. Gộp nó vào
    // mức "giống nhau" là giấu đúng thứ lần chạy này sinh ra để đo.
    const marker =
      lexical.verdict !== semantic.verdict
        ? '≠'
        : lexical.similarCount !== semantic.similarCount
          ? '±'
          : ' ';
    lines.push(
      `  ${marker} ${thesis.id.padEnd(22)} từ vựng ${lexical.verdict.padEnd(20)} similar=${String(lexical.similarCount).padStart(2)}` +
        `  │  ngữ nghĩa ${semantic.verdict.padEnd(20)} similar=${String(semantic.similarCount).padStart(2)}`,
    );
  }

  const totalTokens = videoBatch.usage.totalTokens + thesisBatch.usage.totalTokens;
  const costUsd = videoBatch.usage.costUsd + thesisBatch.usage.costUsd;
  return { candidate: { model, separation }, costUsd, totalTokens, lines };
}

async function main(): Promise<void> {
  const at = new Date().toISOString();
  const secret = checkEmbeddingsSecret(process.env);
  if (!secret.ok) {
    // Bất biến I8: lần chạy bị bỏ qua VẪN có một dòng log.
    writeLogLine({
      at,
      lane: 'topic',
      kind: 'lane',
      ref: 'topic/T-014',
      status: 'skipped',
      durationMs: 0,
      costUsd: 0,
      note: `Bỏ qua phép đo embeddings: ${secret.message} Không gọi API, không tốn tiền.`,
    });
    console.error(secret.message);
    console.error(
      'Lần chạy thật cần secret đó, nên nó chạy trong GitHub Actions chứ không trong phiên agent.',
    );
    process.exitCode = 2;
    return;
  }

  const started = Date.now();
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
  const probe = JSON.parse(readFileSync(PROBE_PATH, 'utf8')) as Probe;
  if (probe.corpusId !== corpus.corpusId) {
    throw new Error(
      `Tập thăm dò gắn nhãn cho corpus \`${probe.corpusId}\` nhưng đang chạy trên \`${corpus.corpusId}\` — nhãn nói về một tập video khác.`,
    );
  }
  const table = readEmbeddingModelTable();
  const apiKey = process.env.EMBEDDINGS_API_KEY as string;
  const checkedAt = at;

  const candidates: ModelCandidate[] = [];
  let costUsd = 0;
  let totalTokens = 0;

  console.log(`Corpus \`${corpus.corpusId}\`: ${corpus.videos.length} video · tập thăm dò \`${probe.probeId}\`: ${probe.pairs.length} cặp có nhãn`);
  console.log(`Bảng giá: ${table.vendor}, \`${table.source}\`, ${table.asOf} (giả định G20)\n`);

  for (const model of table.models) {
    const provider = openAiEmbeddingProvider({ apiKey, model });
    const result = await trialOneModel(provider, model, corpus, probe, checkedAt);
    candidates.push(result.candidate);
    costUsd += result.costUsd;
    totalTokens += result.totalTokens;
    const sep = result.candidate.separation;
    console.log(
      `${model.model}  $${model.usdPerMillionTokens}/1M · ${sep.adequate ? 'ĐỦ CHẤT LƯỢNG' : 'TRƯỢT'} ` +
        `(minSame=${sep.minSame.toFixed(3)} maxDifferent=${sep.maxDifferent.toFixed(3)} margin=${sep.margin.toFixed(3)}) ` +
        `· ${result.totalTokens} token · $${result.costUsd.toFixed(6)}`,
    );
    for (const line of result.lines) console.log(line);
    console.log('    (≠ hai phép so cho verdict khác nhau · ± cùng verdict nhưng khác số video cùng chuyện)');
    console.log('');
  }

  const winner = cheapestAdequateModel(candidates);
  const verdictLine = winner
    ? `Rẻ nhất đủ chất lượng: \`${winner.model.model}\` ($${winner.model.usdPerMillionTokens}/1M token, margin ${winner.separation.margin.toFixed(3)}).`
    : 'KHÔNG model nào trong bảng tách được hai nhóm cặp. Không chọn bừa: điểm ngữ nghĩa của một model không tách được thì không mang tin gì.';
  console.log(verdictLine);
  console.log(`Tổng lần chạy này: ${totalTokens} token · costUsd $${costUsd.toFixed(6)}`);

  writeLogLine({
    at,
    lane: 'topic',
    kind: 'lane',
    ref: 'topic/T-014',
    status: winner ? 'ok' : 'failed',
    durationMs: Date.now() - started,
    costUsd,
    note:
      `Phép đo embeddings trên corpus \`${corpus.corpusId}\` (${corpus.videos.length} video) và tập thăm dò ` +
      `\`${probe.probeId}\` (${probe.pairs.length} cặp có nhãn), ${table.models.length} model ứng viên, ` +
      `${totalTokens} token. ${verdictLine}`,
  });

  if (!winner) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
