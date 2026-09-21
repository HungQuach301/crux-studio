/**
 * Xưởng Hình (S09a–S09b) — bản STUB của Đợt 0.
 *
 * Sinh storyboard từ outline, ở đúng quy mô mà genre pack đòi (180–220
 * scene), vì nếu stub chạy ở quy mô đồ chơi thì Preflight không kiểm được
 * gì thật.
 *
 * Hai điều stub cố ý làm đúng ngay từ đầu, vì chúng là lỗi đã lặp lại ở các
 * dự án trước (rủi ro A2):
 * - Nhịp KHÔNG đều: thời lượng scene so le, nên độ lệch chuẩn vượt ngưỡng.
 *   Nhịp đều đặn là nhịp chết.
 * - Cỡ cảnh trộn theo đúng tỷ lệ khai trong genre pack, không phải toàn cảnh rộng.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';

export type SceneKind = 'chart' | 'diagram' | 'map' | 'footage' | 'image' | 'text-minimal';
export type ShotSize = 'wide' | 'medium' | 'close' | 'detail';

export interface VisualPayload {
  orientation: 'landscape';
  canvasMapRef: string;
  fps: number;
  scenes: {
    id: string;
    beatIndex: number;
    regionId: string;
    durationMs: number;
    layoutId: string;
    variant: string;
    shotSize: ShotSize;
    kind: SceneKind;
    claimIds: string[];
    onScreenWordCount: number;
    hasMotion: boolean;
  }[];
  selfCheck: {
    declaredSceneCount: number;
    declaredTotalMs: number;
    declaredShotSizeMix: Record<string, number>;
  };
}

/**
 * Chu kỳ 10 scene cho ra đúng tỷ lệ cỡ cảnh của genre pack `data-explainer`:
 * wide 0.2 · medium 0.4 · close 0.3 · detail 0.1.
 */
const SHOT_CYCLE: readonly ShotSize[] = [
  'wide', 'wide', 'medium', 'medium', 'medium', 'medium', 'close', 'close', 'close', 'detail',
];

/** Scene mang con số thì phải là loại hiển thị số, và phải có claimId (I6). */
const NUMERIC_KINDS: readonly SceneKind[] = ['chart', 'diagram', 'map'];
const NARRATIVE_KINDS: readonly SceneKind[] = ['text-minimal', 'image', 'footage'];

interface EditorialShape {
  outline: { beats: { index: number; name: string; estimatedMs: number; claimIds: string[] }[] };
}

interface GenreLimits {
  sceneCount?: [number, number];
  fpsAllowed?: number[];
  sceneMinDurationMs?: number;
  onScreenWordsMaxPerScene?: number;
}

/**
 * Trọng số so le trong một beat: scene chẵn ngắn, scene lẻ dài, cộng một
 * lượng nhiễu nhỏ. Chuẩn hoá về tổng = số scene, nên tổng thời lượng của
 * beat không đổi dù trọng số thế nào.
 */
function weights(count: number): number[] {
  const raw = Array.from({ length: count }, (_, n) => (n % 2 === 0 ? 0.45 : 1.55) + ((n * 7) % 5) * 0.05);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => (w * count) / sum);
}

async function produce(input: WorkshopInput, _ctx: RunContext): Promise<VisualPayload> {
  const editorial = (input.upstream.editorial as Envelope<EditorialShape>).payload;
  const limits = (input.packs['genre'] as { limits?: GenreLimits } | undefined)?.limits ?? {};
  const fps = limits.fpsAllowed?.[0] ?? 30;
  const [minScenes, maxScenes] = limits.sceneCount ?? [180, 220];
  const totalScenes = Math.round((minScenes + maxScenes) / 2);
  const maxWords = limits.onScreenWordsMaxPerScene ?? 12;

  const beats = editorial.outline.beats;
  const totalMs = beats.reduce((a, b) => a + b.estimatedMs, 0);

  const scenes: VisualPayload['scenes'] = [];
  let allocated = 0;
  beats.forEach((beat, beatOrdinal) => {
    const isLast = beatOrdinal === beats.length - 1;
    const share = beat.estimatedMs / totalMs;
    const count = isLast ? totalScenes - allocated : Math.round(totalScenes * share);
    allocated += count;

    const w = weights(count);
    const base = beat.estimatedMs / count;
    for (let n = 0; n < count; n += 1) {
      const ordinal = scenes.length;
      const numeric = beat.claimIds.length > 0 && n % 3 === 0;
      // Scene tĩnh CHỈ được rơi vào nhóm ngắn. Một scene tĩnh đủ dài thì tự
      // nó là một slide, bất kể phần còn lại nhịp thế nào — Preflight đo
      // điều đó bằng `longestStaticRunMs` (CHARTER 6.8a).
      const isShort = n % 2 === 0;
      scenes.push({
        id: `S${String(ordinal + 1).padStart(3, '0')}`,
        beatIndex: beat.index,
        regionId: `R${(beatOrdinal % 7) + 1}`,
        durationMs: Math.round(base * (w[n] ?? 1)),
        layoutId: `L-${(ordinal % 5) + 1}`,
        variant: `v${(ordinal % 3) + 1}`,
        shotSize: SHOT_CYCLE[ordinal % SHOT_CYCLE.length]!,
        kind: numeric
          ? NUMERIC_KINDS[ordinal % NUMERIC_KINDS.length]!
          : NARRATIVE_KINDS[ordinal % NARRATIVE_KINDS.length]!,
        claimIds: numeric ? beat.claimIds : [],
        onScreenWordCount: Math.min(maxWords, 4 + (ordinal % 6)),
        // Khung tĩnh chỉ xuất hiện rải rác, và chỉ trên scene ngắn:
        // "trông như slide" là lỗi đã lặp lại ở các dự án trước (rủi ro A2).
        hasMotion: !(isShort && ordinal % 7 === 0),
      });
    }
  });

  const mix: Record<string, number> = {};
  for (const size of ['wide', 'medium', 'close', 'detail'] as const) {
    mix[size] = Number((scenes.filter((s) => s.shotSize === size).length / scenes.length).toFixed(4));
  }

  return {
    orientation: 'landscape',
    canvasMapRef: `canvas/${beats.length}-beat/v0`,
    fps,
    scenes,
    selfCheck: {
      declaredSceneCount: scenes.length,
      declaredTotalMs: scenes.reduce((a, s) => a + s.durationMs, 0),
      declaredShotSizeMix: mix,
    },
  };
}

export const definition: WorkshopDefinition<VisualPayload> = {
  name: 'visual',
  version: '0.0.0-stub',
  consumes: ['editorial'],
  produce,
};
