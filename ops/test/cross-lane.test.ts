/**
 * Bộ dò `cross-lane` — mục `platform/P-040` (đổi mã từ `P-028` trùng).
 *
 * Luật chỉ có giá trị khi nó **đỏ đúng lúc phải đỏ** (bài học KF-003), nên
 * mỗi ca "1 làn" đi kèm ca "2 làn" đối chứng. Hai bài quan trọng nhất là
 * hai bài tiêu chí xong đòi thẳng: `ops/lanes/platform/` + `ops/logs/integration/`
 * ra **2**, còn `ops/lanes/platform/` + `ops/logs/platform/` ra **1**.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isCrossLane, laneOfPath, lanesTouched } from '../scripts/cross-lane.ts';

test('P-040 · TIÊU CHÍ · ops/lanes/platform + ops/logs/integration = 2 làn (cross-lane)', () => {
  const changed = ['ops/lanes/platform/backlog.md', 'ops/logs/integration/step0-x.jsonl'];
  assert.equal(lanesTouched(changed).size, 2);
  assert.equal(isCrossLane(changed), true);
});

test('P-040 · TIÊU CHÍ · ops/lanes/platform + ops/logs/platform = 1 làn (không cross-lane)', () => {
  const changed = ['ops/lanes/platform/backlog.md', 'ops/logs/platform/P-040.jsonl'];
  assert.deepEqual([...lanesTouched(changed)], ['platform']);
  assert.equal(isCrossLane(changed), false);
});

test('P-040 · lỗ cũ · dòng bước 0 của integrator được đếm — trước đây bộ dò không thấy ops/logs/', () => {
  // Đây đúng ca hay gặp nhất: việc làn platform + dòng bước 0 của integration.
  const changed = [
    'ops/scripts/cross-lane.ts',
    'ops/lanes/platform/backlog.md',
    'ops/logs/platform/P-040.jsonl',
    'ops/logs/integration/step0-2026-09-24T051611Z-crux-worker-2.jsonl',
  ];
  assert.deepEqual([...lanesTouched(changed)].sort(), ['integration', 'platform']);
  assert.equal(isCrossLane(changed), true);
});

test('P-040 · khử trùng · workshops/topic + ops/lanes/topic + ops/logs/topic = 1 làn', () => {
  const changed = [
    'workshops/topic/src/index.ts',
    'ops/lanes/topic/backlog.md',
    'ops/logs/topic/T-001.jsonl',
  ];
  assert.deepEqual([...lanesTouched(changed)], ['topic']);
  assert.equal(isCrossLane(changed), false);
});

test('P-040 · laneOfPath suy đúng tên làn ở cả ba gốc', () => {
  assert.equal(laneOfPath('workshops/editorial/src/index.ts'), 'editorial');
  assert.equal(laneOfPath('ops/lanes/verify/backlog.md'), 'verify');
  assert.equal(laneOfPath('ops/logs/kernel/K-002.jsonl'), 'kernel');
});

test('P-040 · không suy gần đúng · đoạn sau gốc không phải tên làn thì null', () => {
  // Cùng luật laneFromBranch: một thư mục lạ không bị đếm thành làn.
  assert.equal(laneOfPath('workshops/README.md'), null);
  assert.equal(laneOfPath('ops/logs/tmp/x.jsonl'), null);
  assert.equal(laneOfPath('ops/lanes/README.md'), null);
});

test('P-040 · file ngoài ba gốc không thuộc làn nào — CHARTER, docs, kernel, packs', () => {
  for (const path of [
    'CHARTER.md',
    'CLAUDE.md',
    'docs/assumptions.md',
    'kernel/src/log.ts',
    'packs/genres/data-explainer/layouts.json',
    'ops/scripts/pr-triage.ts',
    'ops/test/cross-lane.test.ts',
    '.github/workflows/ci.yml',
  ]) {
    assert.equal(laneOfPath(path), null, path);
  }
  assert.equal(lanesTouched(['CHARTER.md', 'docs/x.md', 'kernel/src/log.ts']).size, 0);
});

test('P-040 · PR một làn thuần không cross-lane', () => {
  const changed = ['ops/lanes/visual/backlog.md', 'ops/logs/visual/V-003.jsonl'];
  assert.equal(isCrossLane(changed), false);
});

test('P-040 · đường dẫn có dấu bị git bọc ngoặc kép vẫn suy đúng làn (core.quotePath)', () => {
  // `git diff --name-only` in `"ops/logs/topic/tập.jsonl"` khi tên có ký tự
  // ngoài ASCII. Bỏ ngoặc trước khi so, nếu không luật fail-open lệch.
  assert.equal(laneOfPath('"ops/logs/topic/tập.jsonl"'), 'topic');
});

test('P-040 · ba gốc gộp thành nhiều làn thì cross-lane', () => {
  const changed = [
    'workshops/audio/src/index.ts', // audio
    'ops/lanes/release/backlog.md', // release
    'ops/logs/assembly/A-001.jsonl', // assembly
  ];
  assert.deepEqual([...lanesTouched(changed)].sort(), ['assembly', 'audio', 'release']);
  assert.equal(isCrossLane(changed), true);
});
