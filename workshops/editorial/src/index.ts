/**
 * Xưởng Biên tập (S04–S08) — bản STUB của Đợt 0.
 *
 * Dựng outline theo đúng bộ beat khai trong genre pack (7 beat của
 * `data-explainer`, mỗi beat một tỷ lệ thời lượng), rồi sinh lời thoại từ
 * các claim của xưởng Đề tài.
 *
 * Stub cố ý KHÔNG đạt ngưỡng số từ của genre pack. Đó là sự thật về một
 * stub, và Preflight ở xưởng Dựng ghi nó thành `warn` kèm `rootCauseStage`,
 * chứ không giả vờ đạt. Khi xưởng lên `v1`, chính kiểm đó thành chặn.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel` và các module của
 * chính xưởng này — không xưởng nào khác.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';
import { formatPromptVersion, loadPromptVersions } from './prompts.ts';

/** Prompt pack của xưởng, đọc MỘT lần lúc nạp module (mục `E-001`). */
const PROMPT_VERSION = formatPromptVersion(loadPromptVersions());

export interface EditorialPayload {
  outline: {
    beats: {
      index: number;
      name: string;
      purpose: string;
      estimatedMs: number;
      claimIds: string[];
      curiosityBridge: string;
    }[];
    adBreaks: { atMs: number; derivedFromBeat: number }[];
  };
  script: {
    wordCount: number;
    claimIds: string[];
    geoScopeStated: true;
    localeReviewDone: boolean;
    text: string;
    devicesUsed: string[];
  };
  selfCheck: { declaredBeatCount: number; declaredWordCount: number; declaredBridgeCount: number };
  /** Vắng mặt khi lượt chạy không gọi mô hình nào — xem `generationOf`. */
  generation?: { promptVersion: string; costUsd: number };
}

interface TopicShape {
  selected: { question: string };
  claims: { id: string; statement: string }[];
  targetDurationMs: number;
}

interface GenreBeat {
  index: number;
  name: string;
  purpose: string;
  shareOfDuration: number;
}

const FALLBACK_BEATS: GenreBeat[] = [
  { index: 1, name: 'cold-open', purpose: 'Open on the question.', shareOfDuration: 0.2 },
  { index: 2, name: 'the-model', purpose: 'Show the model.', shareOfDuration: 0.5 },
  { index: 3, name: 'what-to-do', purpose: 'Let the viewer locate themselves.', shareOfDuration: 0.3 },
];

/** Beat nào mang con số thì mang claim. Beat dẫn dắt không gắn claim. */
const CLAIM_BEARING = new Set(['the-model', 'threshold-matrix', 'sensitivity']);

/**
 * `generation` chỉ có khi một lời gọi mô hình THẬT SỰ đi qua băng trong lượt
 * chạy này. Gác bằng tín hiệu ngữ nghĩa (`ctx.cassette.calls`), KHÔNG bằng cờ
 * `ctx.impl`.
 *
 * Lý do: hôm nay `impl: v1` cũng chưa gọi mô hình nào — `produce` dưới đây
 * dùng đúng một logic cho cả hai giá trị `impl` (Đợt 0, CHARTER mục 10). Gác
 * bằng `impl` sẽ khiến artifact khai "bốn prompt này sinh ra payload này"
 * trong khi không prompt nào chạy: vẫn là khai sai, chỉ dời sang giá trị cờ
 * kia. Gác bằng số lời gọi thì đúng ở mọi `impl`, và tự đúng khi `E-005` nối
 * prompt vào thật — không ai phải nhớ quay lại sửa chỗ này.
 *
 * Hệ quả hôm nay: stub không gọi gì nên `generation` vắng mặt, artifact tập
 * vàng không đổi, và mục này không phải chạy `pnpm replay -- --update`
 * (CHARTER 6.1).
 */
export function generationOf(ctx: RunContext, callsBefore: number, costBefore: number): EditorialPayload['generation'] {
  if (ctx.cassette.calls === callsBefore) return undefined;
  return {
    promptVersion: PROMPT_VERSION,
    costUsd: Number((ctx.cassette.costUsd - costBefore).toFixed(6)),
  };
}

async function produce(input: WorkshopInput, ctx: RunContext): Promise<EditorialPayload> {
  const callsBefore = ctx.cassette.calls;
  const costBefore = ctx.cassette.costUsd;
  const topic = (input.upstream.topic as Envelope<TopicShape>).payload;
  const genre = input.packs['genre'] as { beats?: GenreBeat[]; devices?: { id: string }[] } | undefined;
  const genreBeats = genre?.beats?.length ? genre.beats : FALLBACK_BEATS;
  const claimIds = topic.claims.map((c) => c.id);

  const claimBearing = genreBeats.filter((b) => CLAIM_BEARING.has(b.name));
  const beats = genreBeats.map((beat) => {
    const slot = claimBearing.indexOf(beat);
    const assigned =
      slot === -1
        ? []
        : claimIds.filter((_, i) => i % Math.max(claimBearing.length, 1) === slot);
    return {
      index: beat.index,
      name: beat.name,
      purpose: beat.purpose,
      estimatedMs: Math.round(topic.targetDurationMs * beat.shareOfDuration),
      claimIds: assigned,
      curiosityBridge: `That number holds — until the next parameter moves, and beat ${beat.index + 1} is where it flips.`,
    };
  });

  // Điểm chèn quảng cáo SINH TỪ vị trí cầu tò mò, không đặt tuỳ ý.
  let elapsed = 0;
  const boundaries = beats.map((b) => {
    elapsed += b.estimatedMs;
    return { atMs: elapsed, derivedFromBeat: b.index };
  });
  const adBreaks = boundaries.filter((_, i) => i === 2 || i === 4);

  const text = [
    `In the United States, ${topic.selected.question}`,
    ...topic.claims.map((c) => c.statement),
    'This conclusion is scoped to US federal filers; state rules move the crossover point.',
  ].join(' ');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const generation = generationOf(ctx, callsBefore, costBefore);

  return {
    outline: { beats, adBreaks },
    script: {
      wordCount,
      claimIds,
      geoScopeStated: true,
      localeReviewDone: false,
      text,
      devicesUsed: (genre?.devices ?? []).slice(0, 2).map((d) => d.id),
    },
    selfCheck: {
      declaredBeatCount: beats.length,
      declaredWordCount: wordCount,
      declaredBridgeCount: beats.filter((b) => b.curiosityBridge.length >= 10).length,
    },
    ...(generation ? { generation } : {}),
  };
}

export const definition: WorkshopDefinition<EditorialPayload> = {
  name: 'editorial',
  version: '0.0.0-stub',
  consumes: ['topic'],
  produce,
};
