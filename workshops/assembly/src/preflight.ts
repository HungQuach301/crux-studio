/**
 * Preflight — cơ chế 1 của spec tham chiếu: kiểm TĨNH trên storyboard trước
 * khi render, dưới 5 giây. Đây là "kiểm ở chỗ rẻ nhất": bắt lỗi bằng kiểm
 * tra tĩnh trước khi bắt bằng render nháp, bằng render nháp trước khi bắt
 * bằng render đầy đủ, bằng máy trước khi bắt bằng mắt người.
 *
 * Ngưỡng KHÔNG nằm trong file này. Ngưỡng nằm trong genre pack; file này chỉ
 * biết cách đo. Đó là lý do cùng một Preflight dùng được cho thể loại thứ hai.
 */

export type Verdict = 'pass' | 'fail' | 'warn';

export interface AntiSlide {
  motionCoverage: number;
  longestStaticRunMs: number;
  textWordsPerSecond: number;
  longestSceneMs: number;
  staticSceneCount: number;
}

export interface Check {
  id: string;
  verdict: Verdict;
  expected?: string | number;
  actual?: string | number;
  sceneIds?: string[];
  rootCauseStage?: string;
}

export interface PreflightLimits {
  sceneCount?: [number, number];
  sceneMinDurationMs?: number;
  sceneDurationStdDevMinRatio?: number;
  maxConsecutiveScenesUnder2s?: number;
  onScreenWordsMaxPerScene?: number;
  totalDurationTolerancePct?: number;
  maxLayoutRepeatsPerVariant?: number;
  motionCoverageMin?: number;
  longestStaticRunMsMax?: number;
  textWordsPerSecondMax?: number;
  sceneMaxDurationMs?: number;
  scriptWordCount?: [number, number];
  devicesMin?: number;
  captionDriftMaxMs?: number;
}

export interface ShotSizeMix {
  tolerance?: number;
  [size: string]: number | undefined;
}

export interface PreflightInput {
  scenes: {
    id: string;
    durationMs: number;
    shotSize: string;
    kind: string;
    layoutId: string;
    variant?: string;
    claimIds: string[];
    onScreenWordCount: number;
    hasMotion?: boolean;
  }[];
  declared: { sceneCount: number; totalMs: number };
  targetDurationMs: number;
  script: { wordCount: number; devicesUsed: string[] };
  audio: { totalMs: number; captionDriftMaxMs: number };
  limits: PreflightLimits;
  shotSizeMix: ShotSizeMix;
  /**
   * Ở `stub`, các kiểm về KHỐI LƯỢNG nội dung (số từ kịch bản, số thiết bị)
   * hạ xuống `warn`: stub không viết nội dung thật, và một cổng luôn đỏ là
   * một cổng bị bỏ qua. Các kiểm về CẤU TRÚC vẫn chặn như thường.
   */
  impl: 'stub' | 'v1';
}

const NUMERIC_KINDS = new Set(['chart', 'diagram', 'map']);

function stdDev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function verdictOf(ok: boolean, softFail: boolean): Verdict {
  return ok ? 'pass' : softFail ? 'warn' : 'fail';
}

/**
 * Đo các chỉ số chống "trông như slide" (CHARTER 6.8a).
 *
 * Bốn chỉ số, và ba trong số đó tính theo THỜI LƯỢNG chứ không theo số
 * scene. Lý do: người xem cảm nhận thời gian, không đếm scene. Mười scene
 * tĩnh dài bốn giây tệ hơn hai mươi scene tĩnh dài nửa giây, dù đếm theo
 * scene thì cái sau "tệ gấp đôi".
 *
 * Rủi ro A2 nói chất lượng hình ảnh kém là lỗi đã lặp lại ở các dự án
 * trước. Cách nó lặp lại không phải là một tập hỏng hẳn, mà là mỗi tập
 * tĩnh hơn tập trước một chút. Vì vậy các giá trị dưới đây được ghi vào
 * artifact KỂ CẢ KHI ĐẠT ngưỡng — chỉ có chuỗi số qua nhiều tập mới thấy
 * được nó đang trôi (rủi ro B8).
 */
export function measureAntiSlide(scenes: PreflightInput['scenes']): AntiSlide {
  const totalMs = scenes.reduce((a, s) => a + s.durationMs, 0);
  const motionMs = scenes.filter((s) => s.hasMotion === true).reduce((a, s) => a + s.durationMs, 0);

  let run = 0;
  let longestStaticRunMs = 0;
  for (const scene of scenes) {
    if (scene.hasMotion === true) {
      run = 0;
    } else {
      run += scene.durationMs;
      if (run > longestStaticRunMs) longestStaticRunMs = run;
    }
  }

  const words = scenes.reduce((a, s) => a + s.onScreenWordCount, 0);

  return {
    motionCoverage: totalMs === 0 ? 0 : Number((motionMs / totalMs).toFixed(4)),
    longestStaticRunMs,
    textWordsPerSecond: totalMs === 0 ? 0 : Number(((words * 1000) / totalMs).toFixed(4)),
    longestSceneMs: scenes.reduce((a, s) => Math.max(a, s.durationMs), 0),
    staticSceneCount: scenes.filter((s) => s.hasMotion !== true).length,
  };
}

export function preflight(input: PreflightInput): {
  verdict: 'pass' | 'fail';
  checks: Check[];
  selfCheckMismatch: string[];
  antiSlide: AntiSlide;
} {
  const { scenes, limits, shotSizeMix } = input;
  const checks: Check[] = [];
  const durations = scenes.map((s) => s.durationMs);
  const totalMs = durations.reduce((a, b) => a + b, 0);
  const soft = input.impl === 'stub';

  // 1 · Số scene
  const [minScenes, maxScenes] = limits.sceneCount ?? [1, Number.MAX_SAFE_INTEGER];
  checks.push({
    id: 'scene-count',
    verdict: verdictOf(scenes.length >= minScenes && scenes.length <= maxScenes, false),
    expected: `${minScenes}–${maxScenes}`,
    actual: scenes.length,
    rootCauseStage: 'visual',
  });

  // 2 · Thời lượng scene tối thiểu
  const minDuration = limits.sceneMinDurationMs ?? 0;
  const tooShort = scenes.filter((s) => s.durationMs < minDuration);
  checks.push({
    id: 'scene-min-duration',
    verdict: verdictOf(tooShort.length === 0, false),
    expected: `≥ ${minDuration}ms`,
    actual: Math.min(...durations, Number.POSITIVE_INFINITY),
    sceneIds: tooShort.slice(0, 10).map((s) => s.id),
    rootCauseStage: 'visual',
  });

  // 3 · Độ lệch chuẩn thời lượng — nhịp đều đặn là nhịp chết
  const mean = totalMs / Math.max(scenes.length, 1);
  const ratio = mean === 0 ? 0 : stdDev(durations) / mean;
  const minRatio = limits.sceneDurationStdDevMinRatio ?? 0;
  checks.push({
    id: 'scene-duration-stddev',
    verdict: verdictOf(ratio >= minRatio, false),
    expected: `≥ ${minRatio}`,
    actual: Number(ratio.toFixed(4)),
    rootCauseStage: 'visual',
  });

  // 4 · Chuỗi scene ngắn liên tiếp
  const maxRun = limits.maxConsecutiveScenesUnder2s ?? Number.MAX_SAFE_INTEGER;
  let run = 0;
  let worstRun = 0;
  const runScenes: string[] = [];
  for (const scene of scenes) {
    if (scene.durationMs < 2000) {
      run += 1;
      if (run > worstRun) {
        worstRun = run;
        runScenes.length = 0;
        runScenes.push(scene.id);
      }
    } else {
      run = 0;
    }
  }
  checks.push({
    id: 'consecutive-short-scenes',
    verdict: verdictOf(worstRun <= maxRun, false),
    expected: `≤ ${maxRun}`,
    actual: worstRun,
    sceneIds: runScenes,
    rootCauseStage: 'visual',
  });

  // 5 · Phân bổ cỡ cảnh
  const tolerance = shotSizeMix.tolerance ?? 1;
  const offenders: string[] = [];
  for (const [size, target] of Object.entries(shotSizeMix)) {
    if (size === 'tolerance' || typeof target !== 'number') continue;
    const actual = scenes.filter((s) => s.shotSize === size).length / Math.max(scenes.length, 1);
    if (Math.abs(actual - target) > tolerance) offenders.push(`${size}=${actual.toFixed(3)}`);
  }
  checks.push({
    id: 'shot-size-mix',
    verdict: verdictOf(offenders.length === 0, false),
    expected: `±${tolerance}`,
    actual: offenders.join(' ') || 'trong dung sai',
    rootCauseStage: 'visual',
  });

  // 9 · Lặp layout
  const layoutUse = new Map<string, number>();
  for (const scene of scenes) {
    const key = `${scene.layoutId}/${scene.variant ?? '-'}`;
    layoutUse.set(key, (layoutUse.get(key) ?? 0) + 1);
  }
  const maxRepeat = limits.maxLayoutRepeatsPerVariant ?? Math.ceil(scenes.length / 5);
  const overused = [...layoutUse.entries()].filter(([, n]) => n > maxRepeat);
  checks.push({
    id: 'layout-repetition',
    verdict: verdictOf(overused.length === 0, false),
    expected: `≤ ${maxRepeat} lần mỗi cặp layout+biến thể`,
    actual: overused.map(([k, n]) => `${k}×${n}`).join(' ') || 'trong ngưỡng',
    rootCauseStage: 'visual',
  });

  // 10 · Phủ claim — bất biến I6
  const uncovered = scenes.filter((s) => NUMERIC_KINDS.has(s.kind) && s.claimIds.length === 0);
  checks.push({
    id: 'claim-coverage',
    verdict: verdictOf(uncovered.length === 0, false),
    expected: 'mọi scene hiển thị số đều có claimId',
    actual: uncovered.length,
    sceneIds: uncovered.slice(0, 10).map((s) => s.id),
    rootCauseStage: 'visual',
  });

  // 11 · Mật độ chữ
  const maxWords = limits.onScreenWordsMaxPerScene ?? Number.MAX_SAFE_INTEGER;
  const wordy = scenes.filter((s) => s.onScreenWordCount > maxWords);
  checks.push({
    id: 'on-screen-word-density',
    verdict: verdictOf(wordy.length === 0, false),
    expected: `≤ ${maxWords} từ/scene`,
    actual: Math.max(...scenes.map((s) => s.onScreenWordCount), 0),
    sceneIds: wordy.slice(0, 10).map((s) => s.id),
    rootCauseStage: 'visual',
  });

  // 12 · Tổng thời lượng
  const tolPct = limits.totalDurationTolerancePct ?? 100;
  const driftPct = input.targetDurationMs === 0 ? 0 : Math.abs(totalMs - input.targetDurationMs) / input.targetDurationMs * 100;
  checks.push({
    id: 'total-duration',
    verdict: verdictOf(driftPct <= tolPct, false),
    expected: `±${tolPct}%`,
    actual: Number(driftPct.toFixed(3)),
    rootCauseStage: 'visual',
  });

  // Trôi phụ đề (nguồn: xưởng Âm thanh)
  const maxDrift = limits.captionDriftMaxMs ?? Number.MAX_SAFE_INTEGER;
  checks.push({
    id: 'caption-drift',
    verdict: verdictOf(input.audio.captionDriftMaxMs <= maxDrift, false),
    expected: `≤ ${maxDrift}ms`,
    actual: input.audio.captionDriftMaxMs,
    rootCauseStage: 'audio',
  });

  // Khối lượng nội dung — chỉ cảnh báo khi xưởng còn ở `stub`
  const [minWords, maxWordsScript] = limits.scriptWordCount ?? [0, Number.MAX_SAFE_INTEGER];
  checks.push({
    id: 'script-word-count',
    verdict: verdictOf(
      input.script.wordCount >= minWords && input.script.wordCount <= maxWordsScript,
      soft,
    ),
    expected: `${minWords}–${maxWordsScript}`,
    actual: input.script.wordCount,
    rootCauseStage: 'editorial',
  });

  const devicesMin = limits.devicesMin ?? 0;
  checks.push({
    id: 'devices-used',
    verdict: verdictOf(input.script.devicesUsed.length >= devicesMin, soft),
    expected: `≥ ${devicesMin}`,
    actual: input.script.devicesUsed.length,
    rootCauseStage: 'editorial',
  });

  // Chống "trông như slide" (CHARTER 6.8a). Ngưỡng nằm trong genre pack,
  // không nằm ở đây — thể loại thứ hai có nhịp khác và ngưỡng khác.
  const antiSlide = measureAntiSlide(scenes);

  const motionMin = limits.motionCoverageMin ?? 0;
  checks.push({
    id: 'motion-coverage',
    verdict: verdictOf(antiSlide.motionCoverage >= motionMin, false),
    expected: `≥ ${motionMin}`,
    actual: antiSlide.motionCoverage,
    rootCauseStage: 'visual',
  });

  const staticRunMax = limits.longestStaticRunMsMax ?? Number.MAX_SAFE_INTEGER;
  checks.push({
    id: 'longest-static-run',
    verdict: verdictOf(antiSlide.longestStaticRunMs <= staticRunMax, false),
    expected: `≤ ${staticRunMax}ms`,
    actual: antiSlide.longestStaticRunMs,
    rootCauseStage: 'visual',
  });

  const wpsMax = limits.textWordsPerSecondMax ?? Number.MAX_SAFE_INTEGER;
  checks.push({
    id: 'text-words-per-second',
    verdict: verdictOf(antiSlide.textWordsPerSecond <= wpsMax, false),
    expected: `≤ ${wpsMax}`,
    actual: antiSlide.textWordsPerSecond,
    rootCauseStage: 'visual',
  });

  const sceneMax = limits.sceneMaxDurationMs ?? Number.MAX_SAFE_INTEGER;
  const overlong = scenes.filter((s) => s.durationMs > sceneMax);
  checks.push({
    id: 'scene-max-duration',
    verdict: verdictOf(overlong.length === 0, false),
    expected: `≤ ${sceneMax}ms`,
    actual: antiSlide.longestSceneMs,
    sceneIds: overlong.slice(0, 10).map((s) => s.id),
    rootCauseStage: 'visual',
  });

  // Tự khai so với tính được. Lệch ở đây nghiêm trọng hơn một check fail
  // thường: nó nghĩa là xưởng trước đã báo cáo SAI về chính đầu ra của nó.
  const selfCheckMismatch: string[] = [];
  if (input.declared.sceneCount !== scenes.length) {
    selfCheckMismatch.push(
      `declaredSceneCount=${input.declared.sceneCount} nhưng đếm được ${scenes.length}`,
    );
  }
  if (input.declared.totalMs !== totalMs) {
    selfCheckMismatch.push(`declaredTotalMs=${input.declared.totalMs} nhưng tính được ${totalMs}`);
  }

  const verdict: 'pass' | 'fail' =
    checks.some((c) => c.verdict === 'fail') || selfCheckMismatch.length > 0 ? 'fail' : 'pass';

  return { verdict, checks, selfCheckMismatch, antiSlide };
}
