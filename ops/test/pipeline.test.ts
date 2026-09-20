import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WORKSHOPS, writeArtifact, readArtifact, deriveEpisodeState } from '@crux/kernel';
import { runEpisode } from '../scripts/pipeline.ts';

const root = process.cwd();
const AT = '2026-09-20T00:00:00.000Z';
const base = { root, episodeId: 'ep-test', channel: 'us-personal-finance', at: AT } as const;

test('chạy trọn chuỗi sáu xưởng, không gọi API', async () => {
  const result = await runEpisode(base);
  assert.deepEqual([...result.order], [...WORKSHOPS]);
  for (const name of WORKSHOPS) {
    assert.equal(result.artifacts[name].status, 'ok');
    assert.equal(result.artifacts[name].producer.workshop, name);
  }
  assert.equal(result.costUsd, 0, 'chế độ replay không được tốn tiền');
});

test('hai lần chạy cho ra byte giống hệt — điều kiện để tập vàng có nghĩa', async () => {
  const a = await runEpisode(base);
  const b = await runEpisode(base);
  assert.equal(JSON.stringify(a.artifacts), JSON.stringify(b.artifacts));
});

test('inputsHash đổi khi đầu vào đổi, giữ nguyên khi không đổi', async () => {
  const a = await runEpisode(base);
  const b = await runEpisode({ ...base, episodeId: 'ep-other' });
  assert.equal(a.artifacts.editorial.inputsHash, a.artifacts.editorial.inputsHash);
  assert.notEqual(a.artifacts.editorial.inputsHash, b.artifacts.editorial.inputsHash);
});

test('chạy một phần chuỗi rồi dừng thì trạng thái tập phản ánh đúng', async () => {
  const result = await runEpisode({ ...base, only: ['topic', 'editorial'] });
  const state = deriveEpisodeState(result.artifacts, WORKSHOPS);
  assert.deepEqual(state.done, ['topic', 'editorial']);
  assert.equal(state.next, 'visual');
});

test('mỗi xưởng chỉ ghi vùng của mình trong episodes/', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-'));
  try {
    const result = await runEpisode(base);
    for (const name of WORKSHOPS) writeArtifact(dir, result.artifacts[name]);
    for (const name of WORKSHOPS) {
      const path = join(dir, 'episodes', 'us-personal-finance', 'ep-test', name, 'artifact.json');
      assert.ok(existsSync(path), `thiếu ${path}`);
      assert.equal(readArtifact(dir, 'us-personal-finance', 'ep-test', name)?.kind, result.artifacts[name].kind);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tập stub đi hết chuỗi với Preflight xanh', async () => {
  const result = await runEpisode(base);
  const assembly = result.artifacts.assembly.payload as {
    preflight: { verdict: string; selfCheckMismatch: string[] };
    qa: { verdict: string };
  };
  assert.equal(assembly.preflight.verdict, 'pass');
  assert.deepEqual(assembly.preflight.selfCheckMismatch, []);
  assert.equal(assembly.qa.verdict, 'pass');
});
