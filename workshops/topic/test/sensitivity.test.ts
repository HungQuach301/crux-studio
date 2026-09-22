/**
 * Sensitivity Pass — mục `topic/T-007`.
 *
 * Ba bài đầu là acceptance test của WP-013 mục 6: (1) mô hình có điểm đảo
 * chiều đã biết thì tìm đúng điểm đó, (2) chạy hai lần ra cùng một JSON,
 * (3) tham số không tồn tại trong mô hình thì dừng và nêu đúng tên tham số.
 * Bài (1) và (2) chạy trên `M-002` thật (điểm hoà vốn mortgage points):
 * khi `rateWithPointsPct` bằng đúng `baseRatePct` (mặc định 5), hai
 * phương án trả y hệt nhau mỗi tháng nên `monthlySavingsUsd = 0` — điểm
 * đảo chiều đã biết trước bằng đại số, không phải do chạy rồi mới đoán.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runSensitivityPass,
  sensitivityProblems,
  MissingGeoVaryingParameterError,
  ScanRangeOutOfBoundsError,
  TooManyScanPointsError,
  UnknownConclusionOutputError,
  UnknownScanParameterError,
  type SensitivityResult,
} from '../src/sensitivity.ts';
import { loadModel, TOPIC_FORMULAS } from '../src/models.ts';
import type { FormulaRegistry, ModelDefinition } from '../src/model-runner.ts';

const RUN_AT = '2026-09-22T00:00:00Z';
const M002 = loadModel('M-002');

test('runSensitivityPass: tìm đúng điểm đảo chiều đã biết trước bằng đại số (acceptance 1)', () => {
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    // step = 0.3 cố ý không chia hết 5 (baseRatePct mặc định): không điểm lưới
    // nào rơi đúng vào 5.0, nên điểm đảo chiều được tìm bằng nhị phân giữa
    // hai điểm lưới khác dấu thật (4.8 dương, 5.1 âm) — bài kiểm cho ca
    // chung, không phải ca đặc biệt "giá trị lưới đúng bằng 0".
    parameters: [{ name: 'rateWithPointsPct', step: 0.3 }],
  });

  assert.equal(result.flipPoints.length, 1);
  const flip = result.flipPoints[0]!;
  assert.equal(flip.parameter, 'rateWithPointsPct');
  assert.ok(Math.abs(flip.value - 5) < 1e-6, `điểm đảo chiều phải ≈5 (baseRatePct mặc định), nhận ${flip.value}`);
  assert.equal(flip.unit, 'percent');
  assert.match(flip.conclusionBefore, /monthlySavingsUsd dương/);
  assert.match(flip.conclusionAfter, /monthlySavingsUsd âm/);
  assert.equal(result.parameters[0]!.classification, 'flips');
  assert.equal(result.stableConclusion, undefined);
});

test('runSensitivityPass: chạy hai lần ra cùng một JSON (acceptance 2 — xác định tuyệt đối)', () => {
  const options = {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'rateWithPointsPct', step: 0.25 }],
  };
  const first = runSensitivityPass(M002, TOPIC_FORMULAS, options);
  const second = runSensitivityPass(M002, TOPIC_FORMULAS, options);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('runSensitivityPass: tham số không tồn tại thì dừng, nêu đúng tên (acceptance 3 — kiểm âm)', () => {
  assert.throws(
    () =>
      runSensitivityPass(M002, TOPIC_FORMULAS, {
        conclusionOutput: 'monthlySavingsUsd',
        runAt: RUN_AT,
        parameters: [{ name: 'khongTonTai', step: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnknownScanParameterError);
      assert.equal(error.parameter, 'khongTonTai');
      return true;
    },
  );
});

test('runSensitivityPass: output không tồn tại thì dừng', () => {
  assert.throws(
    () =>
      runSensitivityPass(M002, TOPIC_FORMULAS, {
        conclusionOutput: 'khongTonTai',
        runAt: RUN_AT,
        parameters: [{ name: 'rateWithPointsPct', step: 1 }],
      }),
    UnknownConclusionOutputError,
  );
});

test('runSensitivityPass: stable — tham số không ảnh hưởng biến kết luận', () => {
  // pointsCostUsd = loanAmountUsd * pointsPct / 100, không phụ thuộc termMonths.
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'pointsCostUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'termMonths', step: 12 }],
  });
  assert.equal(result.parameters[0]!.classification, 'stable');
  assert.equal(result.flipPoints.length, 0);
  assert.equal(typeof result.stableConclusion, 'string');
  assert.match(result.stableConclusion!, /pointsCostUsd/);
});

test('runSensitivityPass: sensitive — giá trị đổi theo tham số nhưng không đổi dấu', () => {
  // rateWithPointsPct giữ mặc định 4.875 < baseRatePct 5 nên monthlySavingsUsd
  // luôn dương dù loanAmountUsd quét hết khoảng — không có điểm đảo chiều,
  // nhưng giá trị KHÔNG hằng định (tỷ lệ thuận với loanAmountUsd).
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'loanAmountUsd', step: 1_000_000, range: [1000, 5_000_000] }],
  });
  assert.equal(result.parameters[0]!.classification, 'sensitive');
  assert.equal(result.flipPoints.length, 0);
  assert.match(result.stableConclusion!, /dương/);
});

test('runSensitivityPass: điểm đảo chiều rơi đúng một điểm lưới chỉ được đếm MỘT lần (khử trùng lặp)', () => {
  // step = 5 trên khoảng mặc định [0, 25] cho lưới 0,5,10,15,20,25 — chạm
  // đúng baseRatePct = 5 chẵn, hai cặp kề nhau (0→5 và 5→10) đều đổi dấu
  // quanh cùng một điểm nếu không khử trùng lặp sẽ ra hai flip thay vì một.
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'rateWithPointsPct', step: 5 }],
  });
  assert.equal(result.flipPoints.length, 1);
  assert.equal(result.flipPoints[0]!.value, 5);
  assert.equal(result.parameters[0]!.classification, 'flips');
});

test('runSensitivityPass: điểm ĐẦU khoảng quét bằng 0 chẵn — không có "trước" nên không tính là flip (có chủ đích, xem chú thích trong sensitivity.ts)', () => {
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    // range bắt đầu đúng ở baseRatePct = 5 -> monthlySavingsUsd = 0 tại điểm đầu.
    parameters: [{ name: 'rateWithPointsPct', step: 1, range: [5, 25] }],
  });
  assert.equal(result.flipPoints.length, 0);
  assert.equal(result.parameters[0]!.classification, 'sensitive');
});

test('runSensitivityPass: bước quét không dương thì ném', () => {
  assert.throws(
    () =>
      runSensitivityPass(M002, TOPIC_FORMULAS, {
        conclusionOutput: 'monthlySavingsUsd',
        runAt: RUN_AT,
        parameters: [{ name: 'rateWithPointsPct', step: 0 }],
      }),
    RangeError,
  );
});

test('runSensitivityPass: geoVarying bắt buộc phải nằm trong danh sách quét', () => {
  const model: ModelDefinition = {
    schemaVersion: 0,
    modelId: 'data-explainer/M-901',
    version: '1.0',
    title: 'Mô hình thử geoVarying',
    question: 'Câu hỏi thử đủ dài để qua được contract của mô hình định lượng.',
    assumptions: ['Giả định thử.'],
    parameters: [
      { name: 'a', unit: 'usd', validRange: [0, 100], defaultValue: 10, source: 'assumption' },
      { name: 'propertyTaxPct', unit: 'percent', validRange: [0, 5], defaultValue: 1, source: 'assumption', geoVarying: true },
    ],
    formula: 'sum',
    outputs: [{ name: 'total', unit: 'usd', interpretation: 'Tổng.' }],
    verification: {
      status: 'pending',
      tiers: [{ method: 'hand-worked-case', required: true, pass: null, detail: 'Chưa chạy.' }],
    },
  };
  const registry: FormulaRegistry = { sum: (p) => ({ total: p['a']! + p['propertyTaxPct']! }) };

  assert.throws(
    () =>
      runSensitivityPass(model, registry, {
        conclusionOutput: 'total',
        runAt: RUN_AT,
        parameters: [{ name: 'a', step: 10 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof MissingGeoVaryingParameterError);
      assert.equal(error.parameter, 'propertyTaxPct');
      return true;
    },
  );

  // Có mặt trong danh sách quét thì chạy bình thường.
  const result = runSensitivityPass(model, registry, {
    conclusionOutput: 'total',
    runAt: RUN_AT,
    parameters: [
      { name: 'a', step: 10 },
      { name: 'propertyTaxPct', step: 1 },
    ],
  });
  assert.equal(result.parameters.length, 2);
  assert.equal(result.parameters[1]!.geoVarying, true);
});

test('runSensitivityPass: khoảng quét ngoài validRange bị chặn', () => {
  assert.throws(
    () =>
      runSensitivityPass(M002, TOPIC_FORMULAS, {
        conclusionOutput: 'monthlySavingsUsd',
        runAt: RUN_AT,
        parameters: [{ name: 'rateWithPointsPct', step: 1, range: [-10, 25] }],
      }),
    ScanRangeOutOfBoundsError,
  );
});

test('runSensitivityPass: quá 1 triệu điểm quét thì dừng, không tự giảm bước', () => {
  assert.throws(
    () =>
      runSensitivityPass(M002, TOPIC_FORMULAS, {
        conclusionOutput: 'monthlySavingsUsd',
        runAt: RUN_AT,
        // loanAmountUsd ∈ [1000, 50000000], step 1 → 49.999.001 điểm.
        parameters: [{ name: 'loanAmountUsd', step: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof TooManyScanPointsError);
      assert.equal(error.parameter, 'loanAmountUsd');
      assert.ok(error.points > 1_000_000);
      return true;
    },
  );
});

test('sensitivityProblems: kết quả hợp contract không có vấn đề', () => {
  const result: SensitivityResult = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'monthlySavingsUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'rateWithPointsPct', step: 0.25 }],
  });
  assert.deepEqual(sensitivityProblems(result), []);
});

test('sensitivityProblems: flipPoints rỗng mà thiếu stableConclusion thì bị bắt', () => {
  const result = runSensitivityPass(M002, TOPIC_FORMULAS, {
    conclusionOutput: 'pointsCostUsd',
    runAt: RUN_AT,
    parameters: [{ name: 'termMonths', step: 12 }],
  }) as unknown as Record<string, unknown>;
  delete result['stableConclusion'];
  const problems = sensitivityProblems(result);
  assert.ok(problems.some((p) => p.includes('stableConclusion')));
});
