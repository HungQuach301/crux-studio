/**
 * `ops/scripts/check-audio-pipeline.ts` — cơ chế của mục `audio/AU-007`.
 *
 * Thứ tự công đoạn nằm trong CONTRACT, không chỉ trong tài liệu. Test âm
 * chứng minh: đổi thứ tự, đổi `runsBefore`, hay để `normalize` cần nhà cung
 * cấp thì việc này ĐỎ — không im lặng.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioPipelineProblems, AUDIO_STAGE_ORDER } from '../scripts/check-audio-pipeline.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REAL_DATA = join(REPO_ROOT, 'workshops', 'audio', 'pipeline.v0.json');
const REAL_SCHEMA = join(REPO_ROOT, 'workshops', 'audio', 'contracts', 'pipeline.v0.schema.json');

/** Dựng gốc tạm mang schema thật, và file dữ liệu do test biến đổi. */
function rootWith(data: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-audiopipe-'));
  mkdirSync(join(root, 'workshops', 'audio', 'contracts'), { recursive: true });
  cpSync(REAL_SCHEMA, join(root, 'workshops', 'audio', 'contracts', 'pipeline.v0.schema.json'));
  writeFileSync(
    join(root, 'workshops', 'audio', 'pipeline.v0.json'),
    typeof data === 'string' ? data : JSON.stringify(data),
  );
  return root;
}

function realData(): { runsBefore: string; stages: { id: string; usesProvider: boolean; retryParam?: string }[] } {
  return JSON.parse(readFileSync(REAL_DATA, 'utf8'));
}

test('repo thật: pipeline audio sạch', () => {
  assert.deepEqual(audioPipelineProblems(REPO_ROOT), []);
});

test('thứ tự chuẩn đúng năm công đoạn', () => {
  assert.deepEqual([...AUDIO_STAGE_ORDER], ['normalize', 'tts', 'verify', 'retry', 'timestamps']);
});

test('đảo thứ tự công đoạn → đỏ', () => {
  const d = realData();
  [d.stages[0], d.stages[1]] = [d.stages[1]!, d.stages[0]!];
  const problems = audioPipelineProblems(rootWith(d));
  assert.ok(problems.some((p) => /thứ tự công đoạn/.test(p)), problems.join('\n'));
});

test('runsBefore sai → đỏ (hợp schema const)', () => {
  const d = realData();
  const problems = audioPipelineProblems(rootWith({ ...d, runsBefore: 'after-preflight' }));
  // schema đã khoá const nên đây là lỗi schema; điều cần là ĐỎ, không im.
  assert.ok(problems.length >= 1, problems.join('\n'));
});

test('normalize cần nhà cung cấp → đỏ', () => {
  const d = realData();
  d.stages.find((s) => s.id === 'normalize')!.usesProvider = true;
  const problems = audioPipelineProblems(rootWith(d));
  assert.ok(problems.some((p) => /normalize.*usesProvider=false/.test(p)), problems.join('\n'));
});

test('retry thiếu R7d → đỏ', () => {
  const d = realData();
  delete d.stages.find((s) => s.id === 'retry')!.retryParam;
  const problems = audioPipelineProblems(rootWith(d));
  assert.ok(problems.some((p) => /retry.*R7d/.test(p)), problems.join('\n'));
});

test('thiếu file dữ liệu → đỏ, không ném', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-audiopipe-empty-'));
  const problems = audioPipelineProblems(root);
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /thiếu file mô tả/);
});
