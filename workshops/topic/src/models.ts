/**
 * Tám mô hình định lượng đầu tiên (mục backlog `topic/T-006`, spec WP-008,
 * CHARTER mặc định **M7** = `D-C02`, điều chỉnh `D-18`).
 *
 * `T-005` xây **công cụ**: `model-runner.ts` chạy một mô hình từ contract,
 * `model-verify.ts` chấm bốn cấp kiểm. File này là **nội dung**: nó đăng ký
 * tám công thức thật vào registry, và tám file `data/models/M-00N.json` mô
 * tả chúng theo `contracts/model.v0.schema.json`.
 *
 * **Luật chịu tải nhất của mục này** (`D-C02` điểm a): ca kiểm cấp 1 lấy từ
 * **nguồn độc lập bên ngoài** — ví dụ mẫu tính đã công bố của một cơ quan
 * nhà nước Mỹ — và **không bao giờ để máy tự sinh**. Mỗi ca trong
 * `data/models/cases/M-00N.cases.json` ghi `computedBy` trỏ thẳng tới văn
 * bản công bố con số đó. Một mô hình ngôn ngữ tự nghĩ ra ca kiểm rồi tự
 * khớp với chính nó không chứng minh gì (`D-18` bối cảnh) — nên ở đây
 * **không có** con số kỳ vọng nào do agent nghĩ ra.
 *
 * Tám nguồn, mỗi mô hình một nguồn:
 *
 * | Mô hình | Nguồn ca kiểm cấp 1 |
 * |---|---|
 * | `M-001` tỷ lệ chi phí quỹ | SEC, *How Fees and Expenses Affect Your Investment Portfolio* |
 * | `M-002` mortgage points | CFPB, Ask CFPB #136 (bảng ví dụ khoản vay $180.000) |
 * | `M-003` APY tiền gửi | 12 CFR phần 1030 (Reg DD), Phụ lục A |
 * | `M-004` giảm trừ nhận hưu sớm | 20 CFR 404.410, ba ví dụ trong chính điều luật |
 * | `M-005` RMD | IRS Pub 590-B, ví dụ Table III |
 * | `M-006` lãi suất tổng hợp I bond | TreasuryDirect, khối "An example" |
 * | `M-007` phần trợ cấp an sinh chịu thuế | IRS Pub 915, Worksheet 1 điền sẵn |
 * | `M-008` khấu trừ IRA bị giảm | IRS Pub 590-A, Worksheet 1-2 điền sẵn |
 *
 * `D-18` điểm 3 chỉ đích danh hai mô hình đầu tiên phải là **tỷ lệ chi phí
 * quỹ** và **mortgage points**, chọn theo tiêu chí dễ kiểm nhất chứ không
 * theo tiềm năng lượt xem — đó là `M-001` và `M-002`.
 *
 * **Còn thiếu, có chủ đích và đã ghi thành số:** `D-C02` điểm b đòi một mô
 * hình **khác họ, không phải Claude** tính lại độc lập, và cấp kiểm 4
 * (`llm-assumption-check`) đòi bằng chứng từ một nhà cung cấp khác. Cơ chế
 * cho việc đó là mục `platform/P-003`, mục này cần secret `OPENAI_API_KEY`
 * và **chưa** có trên repo. Vì vậy mọi mô hình ở đây mang
 * `verification.status = "pending"` và cấp 4 ghi `pass: false` kèm lý do —
 * không mô hình nào được khai `verified` (`D-C02` điểm c, khoá ở tầng kiểu
 * trong `model-verify.ts`).
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EvidenceCase } from './model-verify.ts';
import type { FormulaFn, FormulaRegistry, ModelDefinition } from './model-runner.ts';

const MODELS_DIR = fileURLToPath(new URL('../data/models/', import.meta.url));

/** Tám mô hình của `T-006`, theo đúng thứ tự `D-18` điểm 3 đặt ra cho hai mô hình đầu. */
export const MODEL_IDS = ['M-001', 'M-002', 'M-003', 'M-004', 'M-005', 'M-006', 'M-007', 'M-008'] as const;

export type ModelShortId = (typeof MODEL_IDS)[number];

export function loadModel(shortId: ModelShortId): ModelDefinition {
  return JSON.parse(readFileSync(`${MODELS_DIR}${shortId}.json`, 'utf8')) as ModelDefinition;
}

/**
 * Ca kiểm cấp 1 của một mô hình. Mỗi ca mang `computedBy` là **nguồn công
 * bố** con số kỳ vọng, không phải tên của hàm tính ra nó — đó là điều
 * `D-C02` điểm a đòi, và là thứ phân biệt một ca kiểm thật với một vòng tự
 * kiểm.
 */
export function loadHandCases(shortId: ModelShortId): EvidenceCase[] {
  return JSON.parse(readFileSync(`${MODELS_DIR}cases/${shortId}.cases.json`, 'utf8')) as EvidenceCase[];
}

/* ------------------------------------------------------------------ */
/* Tiện ích số học dùng chung                                          */
/* ------------------------------------------------------------------ */

/**
 * Làm tròn LÊN tới bội số `step` gần nhất. Dùng cho hai luật làm tròn viết
 * thẳng trong văn bản pháp quy: 20 CFR 404.410 ("the next higher multiple
 * of 10 cents") và IRS Pub 590-A Worksheet 1-2 ("round it to the next
 * highest multiple of $10").
 *
 * `toFixed(9)` trước khi `ceil` là có chủ đích, không phải thừa: 228.78 chia
 * cho 0.1 trong dấu phẩy động ra 2287.8000000000002, và `Math.ceil` của số
 * đó là 2288 — đúng. Nhưng một giá trị đã **đúng bội số** như 80.20 có thể
 * ra 802.0000000000001, và `ceil` sẽ đẩy nó lên 803, tức sai một bậc làm
 * tròn. Cắt ở chữ số thứ chín xoá đúng loại nhiễu đó mà không đụng tới chữ
 * số có nghĩa của tiền.
 */
export function ceilToStep(value: number, step: number): number {
  const units = Number((value / step).toFixed(9));
  return Math.ceil(units) * step;
}

/** Làm tròn tới `digits` chữ số thập phân, cùng lý do `toFixed` như trên. */
export function roundToDigits(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

/**
 * Làm tròn dòng 4 của Worksheet 1-2 (IRS Pub 590-A).
 *
 * **Ba con số IRS in ra không cùng thoả một cách đọc nào của câu hướng
 * dẫn.** Câu hướng dẫn: *"If the result isn't a multiple of $10, round it to
 * the next highest multiple of $10. (For example, $611.40 is rounded to
 * $620.)"* Nhưng Worksheet 1-2 Example 1 điền sẵn của chính tài liệu đó ghi
 * dòng 4 là **$6.825** — mà 6.825 không phải bội số của 10. Đọc câu hướng
 * dẫn theo đúng mặt chữ thì ô đó phải là $6.830, và khấu trừ cuối cùng đổi
 * từ $6.825 thành $6.830.
 *
 * Quy tắc cài ở đây là quy tắc DUY NHẤT tái hiện được **cả ba** con số đã
 * công bố ($611,40 → $620 · $6.825 → $6.825 · $5.250 → $5.250): làm tròn
 * lên tới bội số $10 **chỉ khi** kết quả còn phần lẻ dưới một đô la. Đây là
 * một suy luận từ bằng chứng, không phải điều tài liệu nói thẳng ra.
 *
 * **Rủi ro còn lại, đã ghi thành lời:** hai cách đọc chỉ khác nhau khi tích
 * ra một số nguyên đô la không chia hết cho 10, và chênh lệch tối đa là $5
 * của trần khấu trừ. Nó chỉ đổi kết quả cuối khi trần đó đang là ràng buộc
 * chặt. Trước khi bất cứ tập nào phát ngôn một con số của `M-008` sát mép
 * $10, mâu thuẫn này phải được xác nhận bằng một nguồn thứ hai (Form 8606,
 * hoặc Interactive Tax Assistant của IRS). Ghi ở đây và trong `assumptions`
 * của `M-008.json` để khi nguồn đổi thì tìm ra ngay chỗ phải sửa.
 */
export function iraPhaseoutRounding(value: number): number {
  const wholeDollars = Number(value.toFixed(9));
  if (Number.isInteger(wholeDollars)) return wholeDollars;
  return ceilToStep(wholeDollars, 10);
}

/**
 * Tiền trả hằng tháng của một khoản vay trả góp đều (annuity). Đây cũng là
 * công thức `pvaf`/`pmt01` mà 12 CFR phần 1026 Phụ lục M2 viết bằng SAS cho
 * ước tính trả hết trong 36 tháng.
 *
 * Lãi suất 0 không phải ca hiếm cần bỏ qua: chương trình vay 0% có thật, và
 * công thức chung chia cho 0 ở đó.
 */
export function levelPayment(principal: number, annualRatePct: number, months: number): number {
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

/* ------------------------------------------------------------------ */
/* M-001 · Tỷ lệ chi phí quỹ ăn mòn danh mục                           */
/* ------------------------------------------------------------------ */

/**
 * Cách SEC tính, không phải cách trực giác hay tính: phí **không** bị trừ
 * thẳng vào lãi suất (`r − f`) mà nhân vào số dư **sau khi** danh mục đã
 * tăng trưởng trong năm — `balance × (1 + r) × (1 − f)`.
 *
 * Phân biệt hai cách này không phải chẻ sợi tóc: với ví dụ của SEC ($100.000,
 * 4%, 20 năm), cách trừ vào lãi suất cho $180.611 ở mức phí 1%, còn bản tin
 * công bố **$179.000**. Chỉ cách nhân mới tái hiện được cả ba con số SEC in
 * ra (xem `data/models/cases/M-001.cases.json`).
 */
const expenseRatioDrag: FormulaFn = (p) => {
  const initial = p['initialBalanceUsd']!;
  const grossRate = p['grossAnnualReturnPct']! / 100;
  const fee = p['expenseRatioPct']! / 100;
  const years = p['years']!;

  const endingBalanceUsd = initial * Math.pow((1 + grossRate) * (1 - fee), years);
  const endingBalanceNoFeeUsd = initial * Math.pow(1 + grossRate, years);

  return {
    endingBalanceUsd,
    endingBalanceNoFeeUsd,
    totalFeeDragUsd: endingBalanceNoFeeUsd - endingBalanceUsd,
  };
};

/* ------------------------------------------------------------------ */
/* M-002 · Điểm hoà vốn của mortgage discount points                   */
/* ------------------------------------------------------------------ */

/**
 * `pointsPct` **âm** là lender credit ("negative points" theo chính chữ của
 * CFPB): người vay nhận tiền ở khâu chốt và trả lãi suất cao hơn. Khi đó
 * `pointsCostUsd` và `monthlySavingsUsd` cùng đổi dấu, nên `breakEvenMonths`
 * vẫn dương và vẫn đọc đúng nghĩa "bao nhiêu tháng thì hai bên bằng nhau".
 *
 * Không có giá trị canh gác khi `monthlySavingsUsd = 0`: phép chia ra `NaN`
 * hoặc `Infinity`, và `runModel` ném `NonFiniteOutputError`. Đó là luật của
 * WP-012 mục 5 — số không hữu hạn là lỗi tường minh, không phải một kết quả
 * được phép lọt vào kịch bản.
 */
const mortgagePointsBreakEven: FormulaFn = (p) => {
  const loan = p['loanAmountUsd']!;
  const termMonths = p['termMonths']!;

  const monthlyPaymentBaseUsd = levelPayment(loan, p['baseRatePct']!, termMonths);
  const monthlyPaymentWithPointsUsd = levelPayment(loan, p['rateWithPointsPct']!, termMonths);
  const monthlySavingsUsd = monthlyPaymentBaseUsd - monthlyPaymentWithPointsUsd;
  const pointsCostUsd = (loan * p['pointsPct']!) / 100;

  return {
    monthlyPaymentBaseUsd,
    monthlyPaymentWithPointsUsd,
    monthlySavingsUsd,
    pointsCostUsd,
    breakEvenMonths: pointsCostUsd / monthlySavingsUsd,
  };
};

/* ------------------------------------------------------------------ */
/* M-003 · APY của một khoản tiền gửi                                   */
/* ------------------------------------------------------------------ */

/**
 * Công thức tổng quát của 12 CFR phần 1030 Phụ lục A:
 * `APY = 100[(1 + lãi/gốc)^(365/số ngày) − 1]`.
 *
 * Quy định cố định **365** ở tử số, kể cả năm nhuận — nên hằng số này không
 * phải tham số và không được "sửa cho đúng lịch".
 */
const depositApy: FormulaFn = (p) => {
  const ratio = p['interestEarnedUsd']! / p['principalUsd']!;
  const apyPct = 100 * (Math.pow(1 + ratio, 365 / p['termDays']!) - 1);
  return { apyPct, periodYieldPct: 100 * ratio };
};

/* ------------------------------------------------------------------ */
/* M-004 · Giảm trừ khi nhận trợ cấp hưu trước tuổi đầy đủ              */
/* ------------------------------------------------------------------ */

/**
 * 20 CFR 404.410 chia giảm trừ làm hai bậc, và **tử số/mẫu số khác nhau
 * theo loại trợ cấp**: bản thân người lao động là `5/9` của 1% cho 36 tháng
 * đầu, vợ/chồng là `25/36` của 1%; cả hai đều `5/12` của 1% cho các tháng
 * vượt 36. Vì vậy bốn số đó là **tham số**, không phải hằng số chôn trong
 * code — cùng một công thức chạy được cả ba ví dụ của điều luật.
 *
 * Làm tròn lên tới 10 xu là một bước của chính điều luật, không phải cách
 * trình bày: $228,78 thành $228,80 rồi mới trừ vào PIA.
 */
const socialSecurityEarlyReduction: FormulaFn = (p) => {
  const pia = p['primaryInsuranceAmountUsd']!;
  const months = p['monthsBeforeFullRetirementAge']!;

  const firstTierMonths = Math.min(months, 36);
  const secondTierMonths = Math.max(0, months - 36);
  const firstTierRate = p['firstTierNumerator']! / p['firstTierDenominator']!;
  const secondTierRate = p['secondTierNumerator']! / p['secondTierDenominator']!;

  const rawReduction = pia * firstTierMonths * firstTierRate * 0.01 + pia * secondTierMonths * secondTierRate * 0.01;
  const reductionUsd = ceilToStep(rawReduction, 0.1);
  const monthlyBenefitUsd = roundToDigits(pia - reductionUsd, 2);

  return {
    reductionUsd,
    monthlyBenefitUsd,
    reductionPct: (reductionUsd / pia) * 100,
  };
};

/* ------------------------------------------------------------------ */
/* M-005 · Khoản rút tối thiểu bắt buộc (RMD)                           */
/* ------------------------------------------------------------------ */

/**
 * `applicableDenominator` đến từ Table III (Uniform Lifetime) ở Phụ lục B
 * của IRS Pub 590-B, tra theo tuổi. Bảng đó **không** nằm trong code: nó
 * đổi khi IRS ban hành bảng mới (lần gần nhất áp dụng từ 2022), nên để nó
 * thành tham số có `source` thì khi bảng đổi chỉ phải sửa dữ liệu, không
 * phải sửa công thức.
 */
const rmdUniformLifetime: FormulaFn = (p) => {
  const balance = p['priorYearEndBalanceUsd']!;
  const rmdUsd = balance / p['applicableDenominator']!;
  return { rmdUsd, rmdPctOfBalance: balance === 0 ? 0 : (rmdUsd / balance) * 100 };
};

/* ------------------------------------------------------------------ */
/* M-006 · Lãi suất tổng hợp của I bond                                 */
/* ------------------------------------------------------------------ */

/**
 * `[cố định + (2 × lạm phát nửa năm) + (cố định × lạm phát nửa năm)]`, đúng
 * chữ của TreasuryDirect. Số hạng thứ ba là số hạng người ta hay quên, và
 * nó là lý do lãi suất tổng hợp không phải phép cộng đơn thuần.
 *
 * Chặn dưới ở 0 cũng là luật của TreasuryDirect, không phải phòng thủ do ta
 * nghĩ thêm: giảm phát đủ sâu sẽ kéo tổng xuống âm, và "we don't let that
 * happen. We stop at zero."
 */
const iBondCompositeRate: FormulaFn = (p) => {
  const fixed = p['fixedRatePct']! / 100;
  const semiannual = p['semiannualInflationRatePct']! / 100;

  const raw = fixed + 2 * semiannual + fixed * semiannual;
  const floored = Math.max(0, raw);

  return {
    // Làm tròn ở dạng phần trăm với hai chữ số là tương đương với "bốn chữ
    // số ở dạng thập phân" của TreasuryDirect, nhưng không phải nhân một số
    // vừa làm tròn với 100 — phép nhân đó tự thêm nhiễu dấu phẩy động vào
    // đúng chữ số cuối mà ta vừa chốt.
    compositeRatePct: roundToDigits(floored * 100, 2),
    compositeRateUnroundedPct: floored * 100,
  };
};

/* ------------------------------------------------------------------ */
/* M-007 · Phần trợ cấp an sinh xã hội phải chịu thuế                   */
/* ------------------------------------------------------------------ */

/**
 * Worksheet 1 của IRS Pub 915, giữ nguyên số dòng của bản gốc để ai mở tờ
 * khai ra đối chiếu cũng lần được.
 *
 * Đây là mô hình có **ma trận ngưỡng** rõ nhất trong tám mô hình: không có
 * gì chịu thuế dưới `baseAmountUsd`, tối đa 50% ở khoảng giữa, tối đa 85%
 * phía trên — và trần cứng `0,85 × trợ cấp` ở dòng 18 cắt mọi trường hợp.
 */
const taxableSocialSecurityBenefits: FormulaFn = (p) => {
  const netBenefits = p['netBenefitsUsd']!;

  const line2 = 0.5 * netBenefits;
  const line6 = line2 + p['otherIncomeUsd']! + p['taxExemptInterestUsd']! + p['exclusionsUsd']!;
  const line7 = p['adjustmentsUsd']!;
  const provisionalIncomeUsd = Math.max(0, line6 - line7);

  const line9 = p['baseAmountUsd']!;
  if (line7 >= line6 || provisionalIncomeUsd <= line9) {
    return { taxableBenefitsUsd: 0, provisionalIncomeUsd };
  }

  const line10 = provisionalIncomeUsd - line9;
  const line11 = p['secondThresholdAdderUsd']!;
  const line12 = Math.max(0, line10 - line11);
  const line13 = Math.min(line10, line11);
  const line15 = Math.min(line2, 0.5 * line13);
  const line16 = 0.85 * line12;
  const line17 = line15 + line16;
  const line18 = 0.85 * netBenefits;

  return { taxableBenefitsUsd: Math.min(line17, line18), provisionalIncomeUsd };
};

/* ------------------------------------------------------------------ */
/* M-008 · Khấu trừ IRA truyền thống bị giảm theo thu nhập              */
/* ------------------------------------------------------------------ */

/**
 * Worksheet 1-2 của IRS Pub 590-A, cũng giữ số dòng bản gốc.
 *
 * Ba chỗ dễ đọc lướt qua mà sai:
 *
 * 1. `phaseoutPct` **không** suy được từ độ rộng khoảng: nó là 35% (40% nếu
 *    từ 50 tuổi) khi khai chung VÀ chính mình có kế hoạch hưu ở nơi làm, và
 *    70% (80%) cho mọi trường hợp còn lại. Ví dụ 1 và ví dụ 2 của IRS khác
 *    nhau đúng ở ô này, nên nó là tham số.
 * 2. Sàn $200: khi phần tính ra nhỏ hơn $200 thì lấy $200, không lấy số nhỏ
 *    hơn. Bỏ sàn này là làm mất khấu trừ của đúng nhóm sát mép trên.
 * 3. `line3 >= phaseoutWidthUsd` nghĩa là **chưa** bị giảm chút nào, không
 *    phải bị giảm hết — hướng bất đẳng thức ngược với trực giác.
 */
const reducedIraDeduction: FormulaFn = (p) => {
  const compensation = p['compensationUsd']!;
  const contribution = p['contributionUsd']!;
  const contributionCap = Math.min(compensation, contribution);

  const line3 = p['phaseoutTopUsd']! - p['modifiedAgiUsd']!;
  if (line3 <= 0) {
    return { iraDeductionUsd: 0, nondeductibleContributionUsd: contributionCap, phaseoutAllowanceUsd: 0 };
  }
  if (line3 >= p['phaseoutWidthUsd']!) {
    return {
      iraDeductionUsd: contributionCap,
      nondeductibleContributionUsd: 0,
      phaseoutAllowanceUsd: contributionCap,
    };
  }

  const scaled = (line3 * p['phaseoutPct']!) / 100;
  const phaseoutAllowanceUsd = Math.max(200, iraPhaseoutRounding(scaled));
  const iraDeductionUsd = Math.min(phaseoutAllowanceUsd, contributionCap);

  return {
    iraDeductionUsd,
    nondeductibleContributionUsd: contributionCap - iraDeductionUsd,
    phaseoutAllowanceUsd,
  };
};

/* ------------------------------------------------------------------ */

/**
 * Registry công thức của `T-006`. Khoá ở đây phải khớp đúng trường `formula`
 * của file mô hình tương ứng — `model-runner.ts` tra bằng khoá và ném
 * `UnknownFormulaError` nếu lệch, nên sai chính tả không âm thầm trôi qua.
 */
export const TOPIC_FORMULAS: FormulaRegistry = {
  'expense-ratio-drag': expenseRatioDrag,
  'mortgage-points-break-even': mortgagePointsBreakEven,
  'deposit-apy': depositApy,
  'social-security-early-reduction': socialSecurityEarlyReduction,
  'rmd-uniform-lifetime': rmdUniformLifetime,
  'i-bond-composite-rate': iBondCompositeRate,
  'taxable-social-security-benefits': taxableSocialSecurityBenefits,
  'reduced-ira-deduction': reducedIraDeduction,
};
