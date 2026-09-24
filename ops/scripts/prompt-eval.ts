/**
 * Bộ chấm điểm eval cho prompt của xưởng `editorial` (mục `editorial/E-003`,
 * CHARTER 6.3 mục 3).
 *
 * File này là LOGIC THUẦN, TRUNG TÍNH thể loại: nó chỉ biết CÁCH đo một
 * artifact `editorial` thành bộ chỉ số máy, và cách so bộ chỉ số đó với một
 * baseline theo dung sai. Nó KHÔNG chứa ngưỡng — ngưỡng nằm trong genre pack
 * (`limits.promptEval`, CHARTER "ngưỡng khai trong cấu hình"), và bên gọi
 * (`ops/scripts/check-prompt-eval.ts`) truyền vào. Cùng khuôn với
 * `ops/scripts/prompt` họ hàng `check-fact-risk.ts`: "file này chỉ biết cách
 * đo, ngưỡng nằm trong pack".
 *
 * Vì sao "so bằng chỉ số máy, không so văn bản" (spec tham chiếu §3): một
 * thay đổi prompt được coi là an toàn khi bộ chỉ số của output không tụt quá
 * dung sai khai trước trên **cả ba tập** (quy tắc ba tập, spec §2). Đợt 0
 * mọi xưởng ở `impl: stub` và không gọi API, nên output tất định theo brief —
 * baseline là chính output stub đã ghi lại, và eval bắt hồi quy chỉ số. Khi
 * `editorial` lên `v1` (mục `E-005`) và prompt thật lái output, đúng bộ máy
 * này thành cổng chặn thật cho PR đổi prompt.
 */

/** Hình dạng tối thiểu của payload `editorial` mà bộ đo cần đọc. */
export interface EditorialEvalPayload {
  outline: {
    beats: { claimIds: readonly string[] }[];
    adBreaks: readonly unknown[];
  };
  script: {
    wordCount: number;
    claimIds: readonly string[];
    devicesUsed: readonly string[];
  };
  selfCheck: { declaredBridgeCount: number };
}

/**
 * Bộ chỉ số máy (spec tham chiếu §3): số thiết bị nội dung · độ dài · tỷ lệ
 * claim có nguồn · phân bổ (số beat, số điểm chèn) · có điểm đảo chiều (số
 * cầu tò mò). Mọi chỉ số là SỐ để so được bằng dung sai, không so văn bản.
 */
export type MetricName =
  | 'wordCount'
  | 'beatCount'
  | 'deviceCount'
  | 'claimCount'
  | 'adBreakCount'
  | 'bridgeCount'
  | 'sourcedClaimRatio';

export const METRIC_NAMES: readonly MetricName[] = [
  'wordCount',
  'beatCount',
  'deviceCount',
  'claimCount',
  'adBreakCount',
  'bridgeCount',
  'sourcedClaimRatio',
];

/** So sánh số thực có sai số máy: hai chỉ số coi là bằng nhau trong khoảng này. */
const EPSILON = 1e-9;

/** Đo một artifact `editorial` thành bộ chỉ số. Thuần, tất định. */
export function editorialMetrics(payload: EditorialEvalPayload): Record<MetricName, number> {
  const beats = payload.outline.beats;
  const claimIds = payload.script.claimIds;
  const claimCount = claimIds.length;

  // Tỷ lệ claim CÓ NGUỒN = claim của kịch bản thật sự được gắn vào một beat.
  const claimsInBeats = new Set<string>();
  for (const beat of beats) {
    for (const id of beat.claimIds) claimsInBeats.add(id);
  }
  const sourced = claimIds.filter((id) => claimsInBeats.has(id)).length;

  return {
    wordCount: payload.script.wordCount,
    beatCount: beats.length,
    deviceCount: payload.script.devicesUsed.length,
    claimCount,
    adBreakCount: payload.outline.adBreaks.length,
    bridgeCount: payload.selfCheck.declaredBridgeCount,
    sourcedClaimRatio: claimCount === 0 ? 1 : Number((sourced / claimCount).toFixed(4)),
  };
}

/** Dung sai cho một chỉ số: tuyệt đối, phần trăm của baseline, hoặc cả hai (lấy giá trị lớn hơn). */
export interface MetricTolerance {
  toleranceAbs?: number;
  tolerancePct?: number;
}

/** Cấu hình eval, đọc từ genre pack `limits.promptEval`. */
export interface PromptEvalConfig {
  /** Số tập tối thiểu cần chạy — quy tắc ba tập (spec §2). Mặc định 3 nếu vắng. */
  minSampleSets: number;
  /** Dung sai theo từng chỉ số. Chỉ số không khai coi như dung sai 0 (khớp tuyệt đối). */
  tolerances: Partial<Record<MetricName, MetricTolerance>>;
}

/** Độ lệch cho phép của một chỉ số so với baseline của nó. */
export function allowedDrift(baseline: number, tol: MetricTolerance | undefined): number {
  const abs = tol?.toleranceAbs ?? 0;
  const pct = tol?.tolerancePct ?? 0;
  return Math.max(abs, (pct / 100) * Math.abs(baseline));
}

export interface MetricProblem {
  setId: string;
  metric: MetricName;
  baseline: number;
  actual: number;
  allowed: number;
}

/**
 * So bộ chỉ số của MỘT tập với baseline của nó. Chỉ số nào tụt/vọt quá dung
 * sai thì thành một `MetricProblem` (spec §3: "chỉ số nào tụt quá dung sai
 * thì PR bị chặn").
 *
 * Baseline chỉ liệt kê chỉ số nào thì so chỉ số đó — cho phép baseline cũ
 * thiếu một chỉ số mới mà không đỏ oan; nhưng chỉ số baseline có mà đo được
 * lại thiếu là một vấn đề (không tính được thì coi như lệch).
 */
export function metricProblems(
  setId: string,
  metrics: Record<MetricName, number>,
  baseline: Partial<Record<MetricName, number>>,
  config: PromptEvalConfig,
): MetricProblem[] {
  const problems: MetricProblem[] = [];
  for (const metric of METRIC_NAMES) {
    const base = baseline[metric];
    if (base === undefined) continue;
    const actual = metrics[metric];
    const allowed = allowedDrift(base, config.tolerances[metric]);
    if (Math.abs(actual - base) > allowed + EPSILON) {
      problems.push({ setId, metric, baseline: base, actual, allowed });
    }
  }
  return problems;
}

/**
 * Kiểm quy tắc ba tập ở mức số lượng tập (spec §2, "ít nhất ba tập"): đổi
 * prompt phải chứng minh trên `minSampleSets` tập, KHÔNG phải một. Trả một
 * câu lỗi nếu thiếu tập.
 */
export function sampleSetCountProblems(setIds: readonly string[], config: PromptEvalConfig): string[] {
  if (setIds.length < config.minSampleSets) {
    return [
      `Bộ eval cần ít nhất ${config.minSampleSets} tập (quy tắc ba tập, spec §2) ` +
        `nhưng chỉ có ${setIds.length}: ${setIds.join(', ') || '(không có tập nào)'}.`,
    ];
  }
  return [];
}

/** Diễn một `MetricProblem` thành một dòng đọc được (tiếng Việt, cho báo cáo/CI). */
export function formatMetricProblem(p: MetricProblem): string {
  return (
    `[${p.setId}] chỉ số ${p.metric}: baseline ${p.baseline}, đo được ${p.actual} ` +
    `(lệch ${Number(Math.abs(p.actual - p.baseline).toFixed(4))} > dung sai ${Number(p.allowed.toFixed(4))}).`
  );
}
