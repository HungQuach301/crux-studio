/**
 * Xưởng Đề tài (S01–S03) — bản STUB của Đợt 0.
 *
 * Stub không gọi API và không có tri thức nghiệp vụ. Việc của nó là chứng
 * minh ranh giới chạy được: sinh một payload hợp contract, dẫn xuất hoàn
 * toàn từ đầu vào nên chạy lại cho ra byte giống hệt.
 *
 * Bản thật là plug-in theo thể loại (plug-in đầu tiên: quant — dữ liệu, mô
 * hình, Thesis Engine). Xem backlog làn `topic`.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext } from '@crux/kernel';
import { stableHash } from '@crux/kernel';

export interface TopicPayload {
  selected: { id: string; question: string; pillar: string; matrixFeasible: boolean };
  candidates: { id: string; question: string; totalScore: number }[];
  claims: {
    id: string;
    statement: string;
    evidence: { kind: 'source' | 'model'; ref: string; publisher?: string };
  }[];
  targetDurationMs: number;
  modelRefs: string[];
}

const PILLARS = ['thresholds', 'tradeoffs', 'timing'] as const;

function seedOf(episodeId: string): number {
  return parseInt(stableHash(episodeId).slice(0, 8), 16);
}

async function produce(input: WorkshopInput, ctx: RunContext): Promise<TopicPayload> {
  const seed = seedOf(ctx.episodeId);
  const pillar = PILLARS[seed % PILLARS.length] ?? 'thresholds';
  const targetDurationMs =
    Number((input.packs['genre'] as { limits?: { targetDurationMs?: number } } | undefined)?.limits
      ?.targetDurationMs) || 720_000;

  const candidates = [0, 1, 2].map((n) => ({
    id: `T-${String(seed % 997).padStart(3, '0')}-${n}`,
    question: `At what point does option ${n + 1} stop being the better answer for a US household?`,
    totalScore: 80 - n * 7,
  }));

  const selectedCandidate = candidates[0]!;

  return {
    selected: {
      id: selectedCandidate.id,
      question: selectedCandidate.question,
      pillar,
      matrixFeasible: true,
    },
    candidates,
    // Bất biến I6: mỗi claim có nguồn HOẶC có mô hình. Stub dùng `model` để
    // không giả vờ có một nguồn ngoài mà nó chưa hề gọi tới.
    claims: [1, 2, 3].map((n) => ({
      id: `C${n}`,
      statement: `Stub claim ${n} for ${ctx.episodeId}: the crossover point moves with parameter ${n}.`,
      evidence: { kind: 'model' as const, ref: `M-STUB-${n}` },
    })),
    targetDurationMs,
    modelRefs: ['M-STUB-1', 'M-STUB-2', 'M-STUB-3'],
  };
}

export const definition: WorkshopDefinition<TopicPayload> = {
  name: 'topic',
  version: '0.0.0-stub',
  consumes: [],
  produce,
};
