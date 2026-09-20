/**
 * Xưởng Dựng (S10, S12–S15, QA) — bản STUB của Đợt 0.
 *
 * Phần Preflight ở đây KHÔNG phải stub: nó đo thật trên storyboard, theo
 * ngưỡng của genre pack (xem `preflight.ts`). Chỉ phần render là stub —
 * nó sinh manifest và con trỏ output, không sinh khung hình.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';
import {
  preflight,
  type AntiSlide,
  type Check,
  type PreflightLimits,
  type ShotSizeMix,
} from './preflight.ts';

export interface AssemblyPayload {
  preflight: {
    verdict: 'pass' | 'fail';
    checks: Check[];
    selfCheckMismatch: string[];
    antiSlide: AntiSlide;
  };
  render: {
    fps: number;
    resolution: string;
    durationMs: number;
    outputs: { kind: 'master' | 'proof' | 'still' | 'shorts'; ref: string }[];
  };
  qa: {
    verdict: 'pass' | 'fail';
    findings: { id: string; severity: 'info' | 'warn' | 'block'; message: string; rootCauseStage?: string }[];
  };
}

interface VisualShape {
  fps: number;
  scenes: {
    id: string;
    durationMs: number;
    shotSize: string;
    kind: string;
    layoutId: string;
    variant?: string;
    claimIds: string[];
    onScreenWordCount: number;
    hasMotion: boolean;
  }[];
  selfCheck: { declaredSceneCount: number; declaredTotalMs: number };
}

interface EditorialShape {
  outline: { beats: { estimatedMs: number }[] };
  script: { wordCount: number; devicesUsed: string[] };
}

interface AudioShape {
  totalMs: number;
  captionDriftMaxMs: number;
}

async function produce(input: WorkshopInput, ctx: RunContext): Promise<AssemblyPayload> {
  const visual = (input.upstream.visual as Envelope<VisualShape>).payload;
  const editorial = (input.upstream.editorial as Envelope<EditorialShape>).payload;
  const audio = (input.upstream.audio as Envelope<AudioShape>).payload;
  const genre = input.packs['genre'] as
    | { limits?: PreflightLimits; shotSizeMix?: ShotSizeMix }
    | undefined;

  const targetDurationMs = editorial.outline.beats.reduce((a, b) => a + b.estimatedMs, 0);

  const report = preflight({
    scenes: visual.scenes,
    declared: {
      sceneCount: visual.selfCheck.declaredSceneCount,
      totalMs: visual.selfCheck.declaredTotalMs,
    },
    targetDurationMs,
    script: editorial.script,
    audio,
    limits: genre?.limits ?? {},
    shotSizeMix: genre?.shotSizeMix ?? {},
    impl: ctx.impl,
  });

  const durationMs = visual.scenes.reduce((a, s) => a + s.durationMs, 0);

  // Render chỉ chạy khi Preflight xanh — kiểm ở chỗ rẻ nhất.
  const outputs: AssemblyPayload['render']['outputs'] =
    report.verdict === 'pass'
      ? [
          { kind: 'proof', ref: `artifact://${ctx.channel}/${ctx.episodeId}/assembly/proof.mp4` },
          { kind: 'master', ref: `artifact://${ctx.channel}/${ctx.episodeId}/assembly/master.mp4` },
        ]
      : [{ kind: 'proof', ref: `artifact://${ctx.channel}/${ctx.episodeId}/assembly/proof.mp4` }];

  const findings: AssemblyPayload['qa']['findings'] = report.checks
    .filter((c) => c.verdict !== 'pass')
    .map((c) => ({
      id: c.id,
      severity: c.verdict === 'fail' ? ('block' as const) : ('warn' as const),
      message: `Preflight ${c.id}: mong đợi ${String(c.expected)}, nhận ${String(c.actual)}.`,
      ...(c.rootCauseStage === undefined ? {} : { rootCauseStage: c.rootCauseStage }),
    }));

  for (const mismatch of report.selfCheckMismatch) {
    findings.push({
      id: 'self-check-mismatch',
      severity: 'block',
      message: `Xưởng trước báo cáo sai về chính đầu ra của nó: ${mismatch}`,
      rootCauseStage: 'visual',
    });
  }

  // Lệch giữa thời lượng lời đọc và thời lượng hình là tín hiệu thật, nhưng ở
  // Đợt 0 nó chỉ nói rằng stub chưa viết đủ lời — ghi `info`, không chặn.
  if (Math.abs(audio.totalMs - durationMs) > durationMs * 0.05) {
    findings.push({
      id: 'audio-video-duration-delta',
      severity: 'info',
      message: `Lời đọc ${audio.totalMs}ms so với hình ${durationMs}ms. Ở impl=stub, đây là hệ quả của kịch bản stub, không phải lỗi dựng.`,
      rootCauseStage: 'editorial',
    });
  }

  return {
    preflight: report,
    render: {
      fps: visual.fps,
      resolution: '1920x1080',
      durationMs,
      outputs,
    },
    qa: {
      verdict: findings.some((f) => f.severity === 'block') ? 'fail' : 'pass',
      findings,
    },
  };
}

export const definition: WorkshopDefinition<AssemblyPayload> = {
  name: 'assembly',
  version: '0.0.0-stub',
  consumes: ['editorial', 'visual', 'audio'],
  produce,
};
