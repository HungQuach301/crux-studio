/**
 * Tám mô hình định lượng đầu tiên — mục `topic/T-006`.
 *
 * Bộ test này là **chỗ bằng chứng cấp 1 chịu lực**, không phải chỗ khoe
 * công thức. Mỗi ca kiểm trong `data/models/cases/` mang một con số do một
 * cơ quan nhà nước Mỹ công bố, và cụm test đầu tiên chạy công thức của ta
 * rồi so với đúng con số đó. Công thức sai thì đỏ ở đây, không đỏ ở lúc một
 * tập đã phát hành.
 *
 * Cụm thứ hai là các **kiểm đột biến viết sẵn**: mỗi bài mô phỏng đúng một
 * cách hiểu sai dễ mắc (trừ phí vào lãi suất thay vì vào số dư, bỏ số hạng
 * tích của I bond, bỏ sàn $200 của Pub 590-A…) và khẳng định cách hiểu đó
 * KHÔNG tái hiện được con số đã công bố. Không có cụm này thì cụm một chỉ
 * chứng minh "có một công thức khớp", chứ không chứng minh "công thức này
 * khớp còn cách hiểu kia thì không".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelProblems, runModel, NonFiniteOutputError, type ModelDefinition } from '../src/model-runner.ts';
import { evaluateCaseTier, verifiedClaimProblems, type EvidenceCase } from '../src/model-verify.ts';
import {
  MODEL_IDS,
  TOPIC_FORMULAS,
  ceilToStep,
  iraPhaseoutRounding,
  levelPayment,
  loadHandCases,
  loadModel,
  roundToDigits,
  type ModelShortId,
} from '../src/models.ts';

/** Dung sai cấp 1 lấy từ chính file mô hình, không gõ lại trong test — một nguồn, không hai. */
function handWorkedTolerance(model: ModelDefinition): number {
  const tier = model.verification.tiers.find((t) => t.method === 'hand-worked-case');
  assert.ok(tier, `${model.modelId}: thiếu cấp kiểm hand-worked-case`);
  assert.equal(typeof tier.tolerancePct, 'number', `${model.modelId}: cấp 1 phải khai tolerancePct`);
  return tier.tolerancePct!;
}

function loadPair(shortId: ModelShortId): { model: ModelDefinition; cases: EvidenceCase[] } {
  return { model: loadModel(shortId), cases: loadHandCases(shortId) };
}

/* ------------------------------------------------------------------ */
/* 1. Hình dạng: contract, registry, quy ước đặt tên                    */
/* ------------------------------------------------------------------ */

test('T-006 tạo đúng tám mô hình', () => {
  assert.equal(MODEL_IDS.length, 8);
  assert.equal(new Set(MODEL_IDS).size, 8);
});

for (const shortId of MODEL_IDS) {
  test(`${shortId}: hợp contract model.v0`, () => {
    assert.deepEqual(modelProblems(loadModel(shortId)), []);
  });

  test(`${shortId}: modelId khớp tên file và thuộc genre data-explainer`, () => {
    assert.equal(loadModel(shortId).modelId, `data-explainer/${shortId}`);
  });

  test(`${shortId}: khoá formula có trong registry`, () => {
    const model = loadModel(shortId);
    assert.ok(
      Object.prototype.hasOwnProperty.call(TOPIC_FORMULAS, model.formula),
      `${shortId}: registry không có khoá '${model.formula}'`,
    );
  });

  test(`${shortId}: mọi output kỳ vọng của ca kiểm đều là output đã khai`, () => {
    const { model, cases } = loadPair(shortId);
    const declared = new Set(model.outputs.map((o) => o.name));
    for (const evidenceCase of cases) {
      for (const name of Object.keys(evidenceCase.expected)) {
        assert.ok(declared.has(name), `${shortId}/${evidenceCase.caseId}: '${name}' không phải output đã khai`);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2. Cấp 1: công thức của ta so với con số cơ quan nhà nước công bố    */
/* ------------------------------------------------------------------ */

for (const shortId of MODEL_IDS) {
  test(`${shortId}: cấp 1 đạt — khớp mọi ca kiểm từ nguồn công bố`, () => {
    const { model, cases } = loadPair(shortId);
    assert.ok(cases.length > 0, `${shortId}: không có ca kiểm nào`);
    const tier = evaluateCaseTier('hand-worked-case', true, cases, model, TOPIC_FORMULAS, handWorkedTolerance(model));
    assert.equal(tier.pass, true, `${shortId}: ${tier.detail}`);
  });
}

test('mọi ca kiểm ghi nguồn ngoài, không phải vòng tự kiểm (D-C02 điểm a)', () => {
  for (const shortId of MODEL_IDS) {
    for (const evidenceCase of loadHandCases(shortId)) {
      const by = evidenceCase.computedBy;
      assert.ok(by.length >= 30, `${shortId}/${evidenceCase.caseId}: computedBy quá ngắn để là một trích dẫn`);
      assert.doesNotMatch(
        by,
        /claude|agent|tự sinh|generated/i,
        `${shortId}/${evidenceCase.caseId}: computedBy trỏ vào chính máy — ca kiểm phải đến từ nguồn ngoài`,
      );
    }
  }
});

/* ------------------------------------------------------------------ */
/* 3. D-C02 điểm c: không mô hình nào được khai `verified`              */
/* ------------------------------------------------------------------ */

for (const shortId of MODEL_IDS) {
  test(`${shortId}: chưa khai verified, và claim verified (nếu có) đủ bằng chứng`, () => {
    const { model, cases } = loadPair(shortId);
    assert.notEqual(
      model.verification.status,
      'verified',
      `${shortId}: chỉ chủ dự án mới đặt được verified, sau một issue irreversible (D-C02 điểm c)`,
    );
    assert.deepEqual(
      verifiedClaimProblems({
        model,
        registry: TOPIC_FORMULAS,
        tolerancePct: handWorkedTolerance(model),
        handCases: cases,
        benchmarkAvailable: false,
      }),
      [],
    );
  });
}

/* ------------------------------------------------------------------ */
/* 4. Xác định: cùng đầu vào, cùng kết quả, không phụ thuộc thứ tự      */
/* ------------------------------------------------------------------ */

test('chạy lại và chạy xen kẽ cho kết quả giống từng chữ số', () => {
  const pairs = MODEL_IDS.map((id) => loadPair(id));
  const first = pairs.map(({ model, cases }) => cases.map((c) => JSON.stringify(runModel(model, TOPIC_FORMULAS, c.params))));

  for (let round = 0; round < 3; round += 1) {
    for (const [index, { model, cases }] of [...pairs].reverse().entries()) {
      const target = pairs.length - 1 - index;
      const again = cases.map((c) => JSON.stringify(runModel(model, TOPIC_FORMULAS, c.params)));
      assert.deepEqual(again, first[target]);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 5. Kiểm đột biến: cách hiểu sai phải KHÔNG khớp nguồn                */
/* ------------------------------------------------------------------ */

test('M-001: trừ phí vào lãi suất thay vì vào số dư thì không khớp SEC', () => {
  // Cách sai: (1 + r − f)^n. Với phí 1% nó cho ~$180.611, còn SEC in $179.000.
  const wrong = 100000 * Math.pow(1 + 0.04 - 0.01, 20);
  assert.ok(Math.abs(wrong - 179000) / 179000 > 0.005, `cách trừ vào lãi suất cho ${wrong} — lẽ ra phải lệch quá dung sai`);

  const right = runModel(loadModel('M-001'), TOPIC_FORMULAS, {
    initialBalanceUsd: 100000,
    grossAnnualReturnPct: 4,
    expenseRatioPct: 1,
    years: 20,
  });
  assert.ok(Math.abs(right['endingBalanceUsd']! - 179000) / 179000 <= 0.005);
});

test('M-001: phí bằng 0 thì hai nhánh trùng nhau và không có hao hụt', () => {
  const out = runModel(loadModel('M-001'), TOPIC_FORMULAS, {
    initialBalanceUsd: 100000,
    grossAnnualReturnPct: 4,
    expenseRatioPct: 0,
    years: 20,
  });
  assert.equal(out['endingBalanceUsd'], out['endingBalanceNoFeeUsd']);
  assert.equal(out['totalFeeDragUsd'], 0);
});

test('M-002: lãi suất không đổi thì breakEvenMonths không hữu hạn, và đó là lỗi tường minh', () => {
  assert.throws(
    () =>
      runModel(loadModel('M-002'), TOPIC_FORMULAS, {
        loanAmountUsd: 180000,
        baseRatePct: 5,
        rateWithPointsPct: 5,
        pointsPct: 0,
        termMonths: 360,
      }),
    NonFiniteOutputError,
  );
});

test('M-002: lender credit cho breakEvenMonths dương, gần bằng ca mua điểm', () => {
  const model = loadModel('M-002');
  const buy = runModel(model, TOPIC_FORMULAS, {
    loanAmountUsd: 180000,
    baseRatePct: 5,
    rateWithPointsPct: 4.875,
    pointsPct: 0.375,
    termMonths: 360,
  });
  const credit = runModel(model, TOPIC_FORMULAS, {
    loanAmountUsd: 180000,
    baseRatePct: 5,
    rateWithPointsPct: 5.125,
    pointsPct: -0.375,
    termMonths: 360,
  });
  assert.ok(credit['monthlySavingsUsd']! < 0 && credit['pointsCostUsd']! < 0);
  assert.ok(credit['breakEvenMonths']! > 0);
  assert.ok(Math.abs(credit['breakEvenMonths']! - buy['breakEvenMonths']!) < 2);
});

test('levelPayment: lãi suất 0 không chia cho 0', () => {
  assert.equal(levelPayment(36000, 0, 36), 1000);
});

test('M-003: 365 ở tử số là hằng số của quy định, không phải số ngày của kỳ', () => {
  const model = loadModel('M-003');
  // Ca hai năm của Phụ lục A: nếu quy đổi bằng (730/730) thì APY ra đúng lợi
  // suất cả kỳ (13,313%), khác hẳn con số 6,45% quy định in ra.
  const out = runModel(model, TOPIC_FORMULAS, { interestEarnedUsd: 133.13, principalUsd: 1000, termDays: 730 });
  assert.ok(Math.abs(out['apyPct']! - 6.45) / 6.45 <= 0.0015);
  assert.ok(Math.abs(out['periodYieldPct']! - 13.313) < 0.001);
});

test('ceilToStep: làm tròn lên, nhưng không đẩy một bội số đúng lên bậc nữa', () => {
  assert.equal(roundToDigits(ceilToStep(228.7833, 0.1), 2), 228.8);
  assert.equal(roundToDigits(ceilToStep(80.2, 0.1), 2), 80.2);
  assert.equal(ceilToStep(6820, 10), 6820);
  assert.equal(ceilToStep(6820.01, 10), 6830);
});

/**
 * Bài này KHÔNG kiểm code — nó ghim một mâu thuẫn trong chính tài liệu IRS
 * để lượt sau không ai "sửa lại cho đúng mặt chữ" rồi làm ca kiểm cấp 1 đỏ
 * mà không hiểu vì sao.
 */
test('M-008: câu hướng dẫn và ví dụ điền sẵn của IRS không cùng thoả một cách đọc', () => {
  // Theo đúng mặt chữ ("isn't a multiple of $10 → next highest multiple"),
  // 6.825 phải thành 6.830. Worksheet 1-2 Example 1 của IRS in 6.825.
  assert.equal(ceilToStep(6825, 10), 6830);
  assert.equal(iraPhaseoutRounding(6825), 6825);

  // Quy tắc đang dùng vẫn phải tái hiện đúng ví dụ của chính câu hướng dẫn.
  assert.equal(iraPhaseoutRounding(611.4), 620);
  // ...và ví dụ điền sẵn thứ hai, vốn đã là bội số của 10.
  assert.equal(iraPhaseoutRounding(5250), 5250);
});

test('M-004: bỏ bậc thứ hai thì ví dụ 44 tháng của điều luật không còn khớp', () => {
  const model = loadModel('M-004');
  const out = runModel(model, TOPIC_FORMULAS, {
    primaryInsuranceAmountUsd: 980.5,
    monthsBeforeFullRetirementAge: 44,
    firstTierNumerator: 5,
    firstTierDenominator: 9,
    secondTierNumerator: 5,
    secondTierDenominator: 12,
  });
  assert.equal(out['reductionUsd'], 228.8);

  // Cách sai: áp 5/9 cho cả 44 tháng.
  const wrong = 980.5 * 44 * (5 / 9) * 0.01;
  assert.ok(Math.abs(wrong - 228.78) > 1, `áp một bậc cho cả 44 tháng ra ${wrong}`);
});

test('M-004: nhận đúng tuổi hưu đầy đủ thì không giảm trừ', () => {
  const out = runModel(loadModel('M-004'), TOPIC_FORMULAS, {
    primaryInsuranceAmountUsd: 980.5,
    monthsBeforeFullRetirementAge: 0,
    firstTierNumerator: 5,
    firstTierDenominator: 9,
    secondTierNumerator: 5,
    secondTierDenominator: 12,
  });
  assert.equal(out['reductionUsd'], 0);
  assert.equal(out['monthlyBenefitUsd'], 980.5);
});

test('M-006: bỏ số hạng tích thì ví dụ của TreasuryDirect không còn khớp', () => {
  const out = runModel(loadModel('M-006'), TOPIC_FORMULAS, { fixedRatePct: 0.9, semiannualInflationRatePct: 1.67 });
  assert.equal(out['compositeRatePct'], 4.26);

  // Cách sai: cố định + 2 × lạm phát, bỏ (cố định × lạm phát).
  const wrong = roundToDigits((0.009 + 2 * 0.0167) * 100, 2);
  assert.equal(wrong, 4.24);
  assert.notEqual(wrong, 4.26);
});

test('M-006: giảm phát sâu bị chặn ở 0, không ra số âm', () => {
  const out = runModel(loadModel('M-006'), TOPIC_FORMULAS, { fixedRatePct: 0.9, semiannualInflationRatePct: -5 });
  assert.equal(out['compositeRatePct'], 0);
  assert.equal(out['compositeRateUnroundedPct'], 0);
});

test('M-007: dưới ngưỡng cơ bản thì không đồng nào chịu thuế', () => {
  const out = runModel(loadModel('M-007'), TOPIC_FORMULAS, {
    netBenefitsUsd: 5980,
    otherIncomeUsd: 17000,
    taxExemptInterestUsd: 0,
    exclusionsUsd: 0,
    adjustmentsUsd: 0,
    baseAmountUsd: 25000,
    secondThresholdAdderUsd: 9000,
  });
  assert.equal(out['taxableBenefitsUsd'], 0);
  assert.equal(out['provisionalIncomeUsd'], 19990);
});

test('M-007: trần cứng 85% không bao giờ bị vượt, dù thu nhập khác rất lớn', () => {
  const out = runModel(loadModel('M-007'), TOPIC_FORMULAS, {
    netBenefitsUsd: 5980,
    otherIncomeUsd: 500000,
    taxExemptInterestUsd: 0,
    exclusionsUsd: 0,
    adjustmentsUsd: 0,
    baseAmountUsd: 25000,
    secondThresholdAdderUsd: 9000,
  });
  assert.equal(roundToDigits(out['taxableBenefitsUsd']!, 2), roundToDigits(0.85 * 5980, 2));
});

test('M-007: lãi miễn thuế vẫn đẩy thu nhập tạm tính lên (dòng 4)', () => {
  const base = {
    netBenefitsUsd: 5980,
    otherIncomeUsd: 28990,
    exclusionsUsd: 0,
    adjustmentsUsd: 0,
    baseAmountUsd: 25000,
    secondThresholdAdderUsd: 9000,
  };
  const without = runModel(loadModel('M-007'), TOPIC_FORMULAS, { ...base, taxExemptInterestUsd: 0 });
  const with5k = runModel(loadModel('M-007'), TOPIC_FORMULAS, { ...base, taxExemptInterestUsd: 5000 });
  assert.equal(with5k['provisionalIncomeUsd']! - without['provisionalIncomeUsd']!, 5000);
  assert.ok(with5k['taxableBenefitsUsd']! > without['taxableBenefitsUsd']!);
});

test('M-008: MAGI dưới đáy khoảng thì khấu trừ đủ, không bị cắt', () => {
  const out = runModel(loadModel('M-008'), TOPIC_FORMULAS, {
    phaseoutTopUsd: 146000,
    phaseoutWidthUsd: 20000,
    modifiedAgiUsd: 120000,
    phaseoutPct: 35,
    compensationUsd: 66000,
    contributionUsd: 7000,
  });
  assert.equal(out['iraDeductionUsd'], 7000);
  assert.equal(out['nondeductibleContributionUsd'], 0);
});

test('M-008: MAGI từ mép trên trở lên thì mất sạch khấu trừ', () => {
  const out = runModel(loadModel('M-008'), TOPIC_FORMULAS, {
    phaseoutTopUsd: 146000,
    phaseoutWidthUsd: 20000,
    modifiedAgiUsd: 146000,
    phaseoutPct: 35,
    compensationUsd: 66000,
    contributionUsd: 7000,
  });
  assert.equal(out['iraDeductionUsd'], 0);
  assert.equal(out['nondeductibleContributionUsd'], 7000);
});

test('M-008: sát mép trên vẫn được sàn $200, không bị cắt xuống thấp hơn', () => {
  const out = runModel(loadModel('M-008'), TOPIC_FORMULAS, {
    phaseoutTopUsd: 146000,
    phaseoutWidthUsd: 20000,
    modifiedAgiUsd: 145900,
    phaseoutPct: 35,
    compensationUsd: 66000,
    contributionUsd: 7000,
  });
  // 100 × 35% = $35, nhỏ hơn sàn — worksheet buộc lấy $200.
  assert.equal(out['phaseoutAllowanceUsd'], 200);
  assert.equal(out['iraDeductionUsd'], 200);
});

test('M-008: phaseoutPct là tham số, không suy được từ độ rộng khoảng', () => {
  const model = loadModel('M-008');
  const covered = runModel(model, TOPIC_FORMULAS, {
    phaseoutTopUsd: 246000,
    phaseoutWidthUsd: 10000,
    modifiedAgiUsd: 238500,
    phaseoutPct: 35,
    compensationUsd: 38500,
    contributionUsd: 7000,
  });
  const notCovered = runModel(model, TOPIC_FORMULAS, {
    phaseoutTopUsd: 246000,
    phaseoutWidthUsd: 10000,
    modifiedAgiUsd: 238500,
    phaseoutPct: 70,
    compensationUsd: 38500,
    contributionUsd: 7000,
  });
  // IRS Example 2 là ca 70%: $5.250. Dùng nhầm 35% cho ra $2.625 — sai gần
  // một nửa, và không có gì trong dữ liệu đầu vào báo cho biết đã dùng nhầm.
  assert.equal(notCovered['iraDeductionUsd'], 5250);
  assert.equal(covered['iraDeductionUsd'], 2625);
});
