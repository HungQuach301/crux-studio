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
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';

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

async function produce(input: WorkshopInput, _ctx: RunContext): Promise<EditorialPayload> {
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
  };
}

export const definition: WorkshopDefinition<EditorialPayload> = {
  name: 'editorial',
  version: '0.0.0-stub',
  consumes: ['topic'],
  produce,
};
