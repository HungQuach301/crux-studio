/**
 * `ops/scripts/check-models.ts` — cơ chế của mục `kernel/K-002`, việc số 8
 * của `pnpm contracts`.
 *
 * Bài quan trọng nhất là bài **tái hiện lỗi**: trước mục này, một file mô
 * hình hỏng (`additionalProperties`, thiếu `verification`, …) chỉ bị bắt bởi
 * test đơn vị của riêng xưởng `topic` — không có cổng dùng chung nào ở tầng
 * `pnpm contracts`. Bài dưới dựng một gốc tạm KHÔNG chạm gì tới `topic` và
 * chứng minh cổng mới tự đứng, không dựa vào test của xưởng khác.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelDataFiles, modelDataProblems } from '../scripts/check-models.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const GOOD_MODEL = {
  schemaVersion: 0,
  modelId: 'data-explainer/M-999',
  version: '1.0',
  title: 'Mô hình kiểm thử',
  question: 'Câu hỏi đủ dài để qua minLength của contract này.',
  assumptions: ['Giả định A'],
  parameters: [
    { name: 'x', unit: 'USD', validRange: [0, 100], defaultValue: 10, source: 'assumption' },
  ],
  formula: 'test-formula-key',
  outputs: [{ name: 'y', unit: 'USD', interpretation: 'Kết quả kiểm thử' }],
  verification: {
    status: 'pending',
    tiers: [{ method: 'hand-worked-case', required: true, pass: null, detail: 'chưa chạy' }],
  },
};

const BAD_MODEL = { ...GOOD_MODEL, extraField: 'không khai trong contract' };

function makeRoot(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-check-models-'));
  for (const [relPath, content] of Object.entries(files)) {
    const path = join(root, relPath);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, JSON.stringify(content));
  }
  return root;
}

test('quét workshops/*/data/models/*.json ở tầng đầu, không hardcode tên xưởng', () => {
  const root = makeRoot({
    'workshops/topic/data/models/M-001.json': GOOD_MODEL,
    'workshops/some-other-workshop/data/models/M-002.json': GOOD_MODEL,
  });
  try {
    const files = modelDataFiles(root);
    assert.equal(files.length, 2, files.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bỏ qua cases/ và README.md — không phải mô tả mô hình', () => {
  const root = makeRoot({ 'workshops/topic/data/models/cases/M-001.cases.json': { params: {} } });
  try {
    mkdirSync(join(root, 'workshops/topic/data/models'), { recursive: true });
    writeFileSync(join(root, 'workshops/topic/data/models/README.md'), '# không phải json');
    assert.deepEqual(modelDataFiles(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('model hợp contract thì KHÔNG có vấn đề', () => {
  const root = makeRoot({ 'workshops/topic/data/models/M-001.json': GOOD_MODEL });
  try {
    assert.deepEqual(modelDataProblems(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('TÁI HIỆN LỖI: model có trường lạ (additionalProperties) thì ĐỎ, nêu đúng tên file', () => {
  const root = makeRoot({ 'workshops/topic/data/models/M-002.json': BAD_MODEL });
  try {
    const problems = modelDataProblems(root);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0]!, /workshops\/topic\/data\/models\/M-002\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gốc không có workshops/ nào là hợp lệ — tập rỗng, không vấn đề', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-check-models-'));
  try {
    assert.deepEqual(modelDataFiles(root), []);
    assert.deepEqual(modelDataProblems(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('nối thật vào 8 file thật của topic/T-006: pnpm contracts đọc được đúng số đếm', () => {
  const files = modelDataFiles(REPO_ROOT);
  assert.ok(files.length >= 8, `mong ≥8 file mô hình thật, có ${files.length}`);
  assert.deepEqual(modelDataProblems(REPO_ROOT), []);
});
