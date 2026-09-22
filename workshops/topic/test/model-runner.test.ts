/**
 * Runner mô hình định lượng — mục `topic/T-005`.
 *
 * Tiêu chí xong thứ nhất: "Cùng đầu vào cho ra cùng kết quả, không phụ
 * thuộc thứ tự chạy." Cụm test cuối kiểm đúng câu đó bằng cách chạy lại
 * nhiều lần và so từng chữ số (`JSON.stringify`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  modelProblems,
  resolveParams,
  runModel,
  UnknownFormulaError,
  MissingParamError,
  ParamOutOfRangeError,
  NonFiniteOutputError,
  type ModelDefinition,
  type FormulaRegistry,
} from '../src/model-runner.ts';

function baseModel(overrides: Partial<ModelDefinition> = {}): ModelDefinition {
  return {
    schemaVersion: 0,
    modelId: 'data-explainer/M-001',
    version: '1.0',
    title: 'Mô hình thử',
    question: 'Đây là câu hỏi thử dài hơn hai mươi ký tự để qua được contract.',
    assumptions: ['Lãi suất không đổi trong kỳ.'],
    parameters: [
      { name: 'a', unit: 'usd', validRange: [0, 100], defaultValue: 10, source: 'assumption' },
      { name: 'b', unit: 'usd', validRange: [1, 100], defaultValue: 5, source: 'assumption' },
    ],
    formula: 'sum',
    outputs: [{ name: 'total', unit: 'usd', interpretation: 'Tổng hai tham số.' }],
    verification: {
      status: 'pending',
      tiers: [{ method: 'hand-worked-case', required: true, pass: null, detail: 'Chưa chạy.' }],
    },
    ...overrides,
  };
}

const REGISTRY: FormulaRegistry = {
  sum: (p) => ({ total: p['a']! + p['b']! }),
  divide: (p) => ({ ratio: p['a']! / p['b']! }),
  nonFinite: () => ({ total: Number.NaN }),
};

test('modelProblems: model hợp contract không có vấn đề', () => {
  assert.deepEqual(modelProblems(baseModel()), []);
});

test('modelProblems: thiếu trường bắt buộc bị bắt', () => {
  const model = baseModel() as unknown as Record<string, unknown>;
  delete model['formula'];
  const problems = modelProblems(model);
  assert.ok(problems.some((p) => p.includes('formula')));
});

test('resolveParams: dùng defaultValue khi không override', () => {
  const params = resolveParams(baseModel());
  assert.deepEqual(params, { a: 10, b: 5 });
});

test('resolveParams: override thắng defaultValue', () => {
  const params = resolveParams(baseModel(), { a: 20 });
  assert.deepEqual(params, { a: 20, b: 5 });
});

test('resolveParams: ngoài validRange thì ném, KHÔNG kẹp về biên (kiểm âm 1)', () => {
  assert.throws(() => resolveParams(baseModel(), { a: 1000 }), ParamOutOfRangeError);
  try {
    resolveParams(baseModel(), { a: 1000 });
    assert.fail('phải ném');
  } catch (error) {
    assert.ok(error instanceof ParamOutOfRangeError);
    assert.equal(error.param, 'a');
    assert.equal(error.value, 1000);
  }
});

test('resolveParams: NaN hay không phải số thì ném MissingParamError', () => {
  assert.throws(() => resolveParams(baseModel(), { a: Number.NaN }), MissingParamError);
  assert.throws(
    () => resolveParams(baseModel(), { a: 'oops' as unknown as number }),
    MissingParamError,
  );
});

test('runModel: tra công thức trong registry và trả output đúng', () => {
  const result = runModel(baseModel(), REGISTRY);
  assert.deepEqual(result, { total: 15 });
});

test('runModel: công thức không có trong registry thì ném UnknownFormulaError', () => {
  assert.throws(() => runModel(baseModel({ formula: 'khong-ton-tai' }), REGISTRY), UnknownFormulaError);
});

test('runModel: chia cho 0 ra Infinity là lỗi tường minh, không phải kết quả', () => {
  const model = baseModel({
    formula: 'divide',
    parameters: [
      { name: 'a', unit: 'usd', validRange: [0, 100], defaultValue: 10, source: 'assumption' },
      { name: 'b', unit: 'usd', validRange: [0, 100], defaultValue: 0, source: 'assumption' },
    ],
    outputs: [{ name: 'ratio', unit: 'usd', interpretation: 'Tỉ lệ.' }],
  });
  assert.throws(() => runModel(model, REGISTRY), NonFiniteOutputError);
});

test('runModel: NaN cũng là lỗi tường minh', () => {
  const model = baseModel({ formula: 'nonFinite' });
  assert.throws(() => runModel(model, REGISTRY), NonFiniteOutputError);
});

test('runModel: xác định — chạy nhiều lần, cùng đầu vào ra cùng kết quả từng chữ số', () => {
  const model = baseModel();
  const first = JSON.stringify(runModel(model, REGISTRY, { a: 33, b: 7 }));
  for (let i = 0; i < 20; i += 1) {
    assert.equal(JSON.stringify(runModel(model, REGISTRY, { a: 33, b: 7 })), first);
  }
});

test('runModel: không phụ thuộc thứ tự chạy — xen kẽ hai bộ tham số vẫn cho đúng kết quả', () => {
  const model = baseModel();
  const seqA = [
    runModel(model, REGISTRY, { a: 1, b: 2 }),
    runModel(model, REGISTRY, { a: 9, b: 4 }),
    runModel(model, REGISTRY, { a: 1, b: 2 }),
  ];
  assert.deepEqual(seqA[0], seqA[2]);
  assert.deepEqual(seqA[0], { total: 3 });
  assert.deepEqual(seqA[1], { total: 13 });
});
