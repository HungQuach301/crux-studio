/**
 * Kiểm bốn cấp và trạng thái tổng hợp (mục backlog `topic/T-005`, spec
 * WP-012 mục 3b-3c).
 *
 * **Luật chịu tải nhất của file này, và tiêu chí xong thứ hai của `T-005`:**
 * KHÔNG hàm nào ở đây có kiểu trả về cho phép giá trị `'verified'`.
 * `PendingOrFailed` loại `'verified'` ra khỏi tập giá trị hợp lệ ngay ở tầng
 * kiểu — "agent không đặt được `verification.status = 'verified'` bằng
 * code" vì vậy là một bất biến kiểu mà `tsc --noEmit` giữ, không phải một
 * quy ước hy vọng người viết code nhớ theo. Trạng thái `verified` chỉ đến
 * từ việc GÕ TAY vào file mô hình, sau khi chủ dự án duyệt một issue
 * `irreversible` tóm tắt mô hình (D-C02 điểm c, CHARTER mục 12, mặc định
 * M7). `verifiedClaimProblems` bên dưới soát lại một claim `verified` đã có
 * sẵn trong file có đủ bằng chứng không — nó ĐỌC LẠI, không bao giờ ĐẶT.
 *
 * Vì sao cấp 3 (triển khai thứ hai) không chạy qua `runModel`: "gọi lại
 * cùng một hàm" không phải kiểm độc lập (WP-012 mục 2) — hàm xác định thì
 * lượt hai chắc chắn khớp lượt một. Cấp 3 vì vậy chỉ nhận bằng chứng đã
 * TÍNH SẴN bởi một triển khai khác (`SecondImplementationEvidence`), rồi so
 * với đúng bộ ca kiểm tay — không tự chạy `registry` cho cấp này.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import {
  runModel,
  type FormulaRegistry,
  type ModelDefinition,
  type VerificationMethod,
} from './model-runner.ts';

/** Một ca kiểm: đầu vào cụ thể, kết quả kỳ vọng, có nguồn (tay hoặc công cụ công khai). */
export interface EvidenceCase {
  caseId: string;
  params: Readonly<Record<string, number>>;
  expected: Readonly<Record<string, number>>;
  /** Ai/công cụ nào tính ra `expected` — bằng chứng ghi vào file mô hình, không do hàm này dùng. */
  computedBy: string;
}

export interface TierEvaluation {
  method: VerificationMethod;
  required: boolean;
  pass: boolean;
  detail: string;
}

function withinTolerance(actual: number, expected: number, tolerancePct: number): boolean {
  if (expected === 0) return Math.abs(actual) <= tolerancePct / 100;
  return (Math.abs(actual - expected) / Math.abs(expected)) * 100 <= tolerancePct;
}

/**
 * Cấp dùng chung cho cấp 1 (`hand-worked-case`, luôn bắt buộc) và cấp 2
 * (`published-benchmark`, bắt buộc khi `required` — tồn tại công cụ công
 * khai tương đương, một sự kiện bên ngoài mô hình nên do bên gọi khai, xem
 * `VerificationInput.benchmarkAvailable`). Cả hai chạy `runModel` thật và so
 * với `expected` trong dung sai — khác cấp 3, ở đây so hàm CỦA CHÍNH TA với
 * một nguồn độc lập bên ngoài (người tính tay, hoặc công cụ công khai) là
 * kiểm độc lập thật.
 */
export function evaluateCaseTier(
  method: 'hand-worked-case' | 'published-benchmark',
  required: boolean,
  cases: readonly EvidenceCase[],
  model: ModelDefinition,
  registry: FormulaRegistry,
  tolerancePct: number,
): TierEvaluation {
  if (!required) {
    return { method, required: false, pass: true, detail: 'Không bắt buộc ở mô hình này.' };
  }
  if (cases.length === 0) {
    return { method, required: true, pass: false, detail: 'Bắt buộc nhưng chưa có ca kiểm nào.' };
  }
  for (const c of cases) {
    const actual = runModel(model, registry, c.params);
    for (const [name, expected] of Object.entries(c.expected)) {
      const got = actual[name];
      if (got === undefined || !withinTolerance(got, expected, tolerancePct)) {
        return {
          method,
          required: true,
          pass: false,
          detail: `Ca '${c.caseId}': output '${name}' = ${got} lệch quá dung sai ${tolerancePct}% so với kỳ vọng ${expected}.`,
        };
      }
    }
  }
  return { method, required: true, pass: true, detail: `${cases.length} ca khớp trong dung sai ${tolerancePct}%.` };
}

/** Cấp 3 bắt buộc khi có tham số `geoVarying: true`, hoặc mô hình dùng ở hơn 3 tập (WP-012 mục 3b). */
export function requiresSecondImplementation(
  model: Pick<ModelDefinition, 'parameters' | 'usedByEpisodes'>,
): boolean {
  const geoVarying = model.parameters.some((p) => p.geoVarying === true);
  const usedByMoreThanThree = (model.usedByEpisodes?.length ?? 0) > 3;
  return geoVarying || usedByMoreThanThree;
}

export interface SecondImplementationEvidence {
  implementationHash: string;
  results: readonly { caseId: string; result: Readonly<Record<string, number>> }[];
}

export function evaluateSecondImplementation(
  required: boolean,
  handCases: readonly EvidenceCase[],
  evidence: SecondImplementationEvidence | undefined,
  tolerancePct: number,
): TierEvaluation {
  const method = 'second-implementation' as const;
  if (!required) {
    return { method, required: false, pass: true, detail: 'Không bắt buộc: không geoVarying, dùng ở ≤ 3 tập.' };
  }
  if (evidence === undefined) {
    return { method, required: true, pass: false, detail: 'Bắt buộc (geoVarying hoặc dùng > 3 tập) nhưng chưa có triển khai thứ hai.' };
  }
  if (handCases.length === 0) {
    return { method, required: true, pass: false, detail: 'Không có ca kiểm tay nào để đối chiếu triển khai thứ hai.' };
  }
  for (const handCase of handCases) {
    const match = evidence.results.find((r) => r.caseId === handCase.caseId);
    if (match === undefined) {
      return { method, required: true, pass: false, detail: `Triển khai thứ hai thiếu ca '${handCase.caseId}'.` };
    }
    for (const [name, expected] of Object.entries(handCase.expected)) {
      const got = match.result[name];
      if (got === undefined || !withinTolerance(got, expected, tolerancePct)) {
        return {
          method,
          required: true,
          pass: false,
          detail: `Triển khai thứ hai lệch ở ca '${handCase.caseId}', output '${name}': ${got} so với ${expected}.`,
        };
      }
    }
  }
  return {
    method,
    required: true,
    pass: true,
    detail: `Triển khai thứ hai (băm ${evidence.implementationHash}) khớp ${handCases.length} ca kiểm tay trong dung sai ${tolerancePct}%.`,
  };
}

/**
 * Bằng chứng cấp 4. `provider` phải khác nhà cung cấp với mô hình ngôn ngữ
 * chính (WP-012 mục 2: "phải là nhà cung cấp khác… không tạo độc lập về
 * suy luận nếu cùng một mô hình đứng sau") — hàm này không tự kiểm được
 * điều đó (không biết mô hình chính là gì), nên chỉ ghi nhận `provider` như
 * bằng chứng cho người đọc, không chặn.
 */
export interface AssumptionCheckEvidence {
  reviewedAt: string;
  provider: string;
  unflaggedAssumptions: readonly string[];
  unitIssues: readonly string[];
}

/** Cấp 4 không bao giờ kiểm số học (WP-012 mục 2) — chỉ kiểm giả định và đơn vị. */
export function evaluateLlmAssumptionCheck(evidence: AssumptionCheckEvidence | undefined): TierEvaluation {
  const method = 'llm-assumption-check' as const;
  if (evidence === undefined) {
    return { method, required: true, pass: false, detail: 'Chưa có báo cáo kiểm giả định và đơn vị.' };
  }
  const issues = evidence.unflaggedAssumptions.length + evidence.unitIssues.length;
  return {
    method,
    required: true,
    pass: issues === 0,
    detail:
      issues === 0
        ? `${evidence.provider} kiểm lúc ${evidence.reviewedAt}: không có giả định chưa khai hay lỗi đơn vị.`
        : `${evidence.provider} kiểm lúc ${evidence.reviewedAt}: ${evidence.unflaggedAssumptions.length} giả định chưa khai, ${evidence.unitIssues.length} lỗi đơn vị — cần xử lý trước khi verified.`,
  };
}

export interface VerificationInput {
  model: ModelDefinition;
  registry: FormulaRegistry;
  tolerancePct: number;
  handCases: readonly EvidenceCase[];
  /** Có tồn tại một công cụ công khai tương đương không — sự kiện bên ngoài, do bên gọi khai (WP-012 mục 3b). */
  benchmarkAvailable: boolean;
  benchmarkCases?: readonly EvidenceCase[];
  secondImplementation?: SecondImplementationEvidence;
  assumptionCheck?: AssumptionCheckEvidence;
}

/** `'pending'` hoặc `'failed'` — KHÔNG BAO GIỜ `'verified'`. Xem docstring đầu file. */
export type PendingOrFailed = 'pending' | 'failed';

export interface VerificationOutcome {
  status: PendingOrFailed;
  tiers: readonly TierEvaluation[];
}

/**
 * Trạng thái tổng hợp: `'failed'` nếu bất kỳ cấp BẮT BUỘC nào không đạt;
 * ngược lại `'pending'` — kể cả khi mọi cấp bắt buộc đều đạt. Bước cuối
 * chuyển sang `'verified'` là một hành động của con người, không phải một
 * giá trị hàm này sinh ra được (kiểu `PendingOrFailed` không có ca đó).
 */
export function computeVerification(input: VerificationInput): VerificationOutcome {
  const needsSecondImpl = requiresSecondImplementation(input.model);
  const tiers: TierEvaluation[] = [
    evaluateCaseTier('hand-worked-case', true, input.handCases, input.model, input.registry, input.tolerancePct),
    evaluateCaseTier(
      'published-benchmark',
      input.benchmarkAvailable,
      input.benchmarkCases ?? [],
      input.model,
      input.registry,
      input.tolerancePct,
    ),
    evaluateSecondImplementation(needsSecondImpl, input.handCases, input.secondImplementation, input.tolerancePct),
    evaluateLlmAssumptionCheck(input.assumptionCheck),
  ];
  const requiredFailed = tiers.some((t) => t.required && !t.pass);
  return { status: requiredFailed ? 'failed' : 'pending', tiers };
}

/**
 * Soát một claim `verification.status = 'verified'` ĐÃ CÓ SẴN trong file mô
 * hình (gõ tay). Không bao giờ đặt hay đổi trạng thái — chỉ đọc lại và báo
 * vấn đề nếu claim đó thiếu bằng chứng (D-C02 điểm c): thiếu
 * `approvedIssueUrl`, hoặc tính lại từ đầu vào cùng loại thì có cấp bắt
 * buộc nào đó không đạt.
 */
export function verifiedClaimProblems(input: VerificationInput): string[] {
  const problems: string[] = [];
  if (input.model.verification.status !== 'verified') return problems;
  if (!input.model.verification.approvedIssueUrl) {
    problems.push(
      `${input.model.modelId}: verification.status = 'verified' nhưng thiếu approvedIssueUrl ` +
        `(D-C02 điểm c đòi một issue irreversible đã được chủ dự án duyệt).`,
    );
  }
  const outcome = computeVerification(input);
  if (outcome.status === 'failed') {
    const failing = outcome.tiers.filter((t) => t.required && !t.pass).map((t) => t.method);
    problems.push(
      `${input.model.modelId}: verification.status = 'verified' nhưng cấp bắt buộc chưa đạt: ${failing.join(', ')}.`,
    );
  }
  return problems;
}
