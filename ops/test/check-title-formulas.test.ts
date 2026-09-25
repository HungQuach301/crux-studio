/**
 * `ops/scripts/check-title-formulas.ts` — cơ chế của mục `release/R-001`.
 *
 * Test âm quan trọng nhất: `titles[].formula` là một chuỗi tự do trong
 * contract v0 (payload để lỏng, CHARTER 5.2) — trước mục này, MỌI chuỗi đều
 * qua được `pnpm contracts`. Bài kiểm dưới đây tái hiện đúng câu đó rồi xác
 * nhận việc chặn hoạt động, đúng tinh thần "viết test tái hiện lỗi trước".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allTitleFormulasPackProblems,
  releaseFormulaProblems,
  titleFormulasPackProblems,
  type ReleaseArtifactForFormulaCheck,
} from '../scripts/check-title-formulas.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SLUG = 'us-personal-finance';

function makeRoot(titleFormulas: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-title-formulas-'));
  mkdirSync(join(root, 'packs', 'channels', SLUG), { recursive: true });
  writeFileSync(join(root, 'packs', 'channels', SLUG, 'title-formulas.json'), JSON.stringify(titleFormulas));
  return root;
}

function artifact(formula: string, impl: 'stub' | 'v1' = 'stub'): ReleaseArtifactForFormulaCheck {
  return {
    channel: SLUG,
    producer: { impl },
    payload: { package: { titles: [{ formula }] } },
  };
}

test('title-formulas.json thật của repo hợp contract, không id trùng', () => {
  const value = JSON.parse(readFileSync(join(REPO_ROOT, 'packs', 'channels', SLUG, 'title-formulas.json'), 'utf8'));
  assert.deepEqual(titleFormulasPackProblems(SLUG, value), []);
});

test('allTitleFormulasPackProblems quét được title-formulas.json thật của repo, đúng 1 kênh', () => {
  const result = allTitleFormulasPackProblems(REPO_ROOT);
  assert.deepEqual(result.problems, []);
  assert.equal(result.checked, 1);
});

test('titleFormulasPackProblems đỏ khi id trùng nhau', () => {
  const problems = titleFormulasPackProblems(SLUG, {
    channel: SLUG,
    formulas: [
      { id: 'threshold', name: 'Ngưỡng' },
      { id: 'threshold', name: 'Ngưỡng 2' },
    ],
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /id trùng.*threshold/);
});

test('titleFormulasPackProblems đỏ khi thiếu trường bắt buộc (đúng contract, không đoán)', () => {
  const problems = titleFormulasPackProblems(SLUG, { channel: SLUG });
  assert.ok(problems.length > 0);
});

test(
  'releaseFormulaProblems: TÁI HIỆN LỖI — trước mục này, formula tự do vẫn qua được vì payload để lỏng',
  () => {
    // Đây chính là hình dạng lỗi: một formula không có trong danh sách thật nào cả.
    const bogus = artifact('this-is-not-a-real-formula', 'v1');
    const root = makeRoot({
      channel: SLUG,
      formulas: [{ id: 'threshold', name: 'Ngưỡng' }],
    });
    try {
      const { problems, notes } = releaseFormulaProblems(root, 'test', bogus);
      assert.equal(notes.length, 0);
      assert.equal(problems.length, 1);
      assert.match(problems[0]!, /this-is-not-a-real-formula/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test('releaseFormulaProblems: formula hợp lệ thì không có gì để báo', () => {
  const root = makeRoot({ channel: SLUG, formulas: [{ id: 'threshold', name: 'Ngưỡng' }] });
  try {
    const { problems, notes } = releaseFormulaProblems(root, 'test', artifact('threshold', 'v1'));
    assert.deepEqual(problems, []);
    assert.deepEqual(notes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('releaseFormulaProblems: impl "stub" chỉ ghi nhận, KHÔNG chặn (đợi release/R-005 nối chặt)', () => {
  const root = makeRoot({ channel: SLUG, formulas: [{ id: 'threshold', name: 'Ngưỡng' }] });
  try {
    const { problems, notes } = releaseFormulaProblems(root, 'test', artifact('flip-point', 'stub'));
    assert.deepEqual(problems, []);
    assert.equal(notes.length, 1);
    assert.match(notes[0]!, /flip-point/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('releaseFormulaProblems: artifact release thật của tập vàng (impl: stub) chỉ ghi nhận, không chặn', () => {
  const golden = JSON.parse(
    readFileSync(join(REPO_ROOT, 'ops', 'golden', 'ep-0001-stub', 'snapshots', 'release.json'), 'utf8'),
  ) as ReleaseArtifactForFormulaCheck;
  const { problems, notes } = releaseFormulaProblems(REPO_ROOT, 'golden/release', golden);
  assert.deepEqual(problems, []);
  // Stub hiện dùng 'question'/'flip-point'/'method' — không khớp danh sách thật, đúng như tài liệu đã ghi.
  assert.equal(notes.length, 1);
});

test('releaseFormulaProblems: không có title-formulas.json cho kênh thì báo lỗi rõ ràng, không ném ra ngoài', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-title-formulas-empty-'));
  try {
    const { problems, notes } = releaseFormulaProblems(root, 'test', artifact('threshold', 'v1'));
    assert.equal(notes.length, 0);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /không đọc được title-formulas\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('releaseFormulaProblems: không có titles thì không có gì để soát', () => {
  const empty: ReleaseArtifactForFormulaCheck = {
    channel: SLUG,
    producer: { impl: 'v1' },
    payload: { package: { titles: [] } },
  };
  const { problems, notes } = releaseFormulaProblems(REPO_ROOT, 'test', empty);
  assert.deepEqual(problems, []);
  assert.deepEqual(notes, []);
});
