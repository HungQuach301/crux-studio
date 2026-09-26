/**
 * Mục `platform/P-062`, vế hai — script **chỉ đọc stdin** ném khi nhận một
 * đối số nó không hiểu.
 *
 * **Bài tái hiện lỗi** (bất biến **I2**) là nhóm `spawnSync` dưới đây: chạy
 * CLI THẬT với đúng lần gọi sai đã quan sát
 * (`node ops/scripts/cross-lane.ts --changed /tmp/changed.txt`) và đòi mã
 * thoát khác 0. Trên `main` trước mục này, lần gọi đó in `0` với mã thoát 0.
 *
 * Mỗi ca dương đi kèm ca âm của nó (`KF-003`): lần gọi ĐÚNG vẫn chạy như cũ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { unexpectedArgs } from '../scripts/stdin-only-args.ts';

const run = (script: string, args: string[], input: string) =>
  spawnSync(process.execPath, [`ops/scripts/${script}`, ...args], { input, encoding: 'utf8' });

// ── Hàm thuần ────────────────────────────────────────────────────────────

test('unexpectedArgs: không đối số → rỗng', () => {
  assert.deepEqual(unexpectedArgs([]), []);
});

test('unexpectedArgs: mọi cờ đều bị từ chối, kể cả giá trị theo sau nó', () => {
  assert.deepEqual(unexpectedArgs(['--changed', '/tmp/changed.txt']), ['--changed', '/tmp/changed.txt']);
  assert.deepEqual(unexpectedArgs(['-h']), ['-h']);
});

test('unexpectedArgs: đối số vị trí trong hạn thì nhận, vượt hạn thì từ chối', () => {
  assert.deepEqual(unexpectedArgs(['abc123'], 1), []);
  assert.deepEqual(unexpectedArgs(['abc123', 'thừa'], 1), ['thừa']);
  assert.deepEqual(unexpectedArgs(['abc123'], 0), ['abc123']);
});

test('unexpectedArgs: cờ bị từ chối cả khi còn chỗ cho đối số vị trí', () => {
  assert.deepEqual(unexpectedArgs(['--head', 'abc'], 1), ['--head']);
});

// ── cross-lane.ts — đúng lần gọi sai của mục ─────────────────────────────

test('TÁI HIỆN P-062: `cross-lane.ts --changed <file>` thoát khác 0, không in "0"', () => {
  const result = run('cross-lane.ts', ['--changed', '/tmp/changed.txt'], '');
  assert.notEqual(result.status, 0, 'lần gọi sai phải đỏ');
  assert.equal(result.stdout, '', 'không được in một con số làn nào ra stdout');
  assert.match(result.stderr, /--changed/);
});

test('TÁI HIỆN P-062: cờ lạ bị từ chối CẢ khi stdin có dữ liệu thật', () => {
  const result = run('cross-lane.ts', ['--json'], 'ops/lanes/topic/backlog.md\nops/logs/integration/x.jsonl\n');
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});

test('ca âm: `cross-lane.ts < changed.txt` vẫn đếm đúng như cũ', () => {
  const result = run('cross-lane.ts', [], 'ops/lanes/topic/backlog.md\nops/logs/integration/x.jsonl\n');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '2\n');
});

// ── check-golden-pr.ts ───────────────────────────────────────────────────

test('check-golden-pr.ts: cờ lạ thoát khác 0 dù stdin hợp lệ', () => {
  const result = run('check-golden-pr.ts', ['--base', 'main'], 'kernel/src/log.ts\n');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--base/);
});

test('ca âm: check-golden-pr.ts không đối số vẫn qua như cũ', () => {
  const result = run('check-golden-pr.ts', [], 'kernel/src/log.ts\n');
  assert.equal(result.status, 0);
});

// ── pick-ci-run.ts — `headSha` là đối số vị trí duy nhất ────────────────

const RUNS = JSON.stringify([
  { id: 1, head_sha: 'abc', status: 'completed', conclusion: 'success', created_at: '2026-01-01T00:00:00Z' },
]);

test('TÁI HIỆN P-062: `pick-ci-run.ts --head abc` thoát khác 0 thay vì in `{}`', () => {
  // Trước mục này, `--head` rơi vào `headSha`, lọc mất mọi lần chạy và in
  // `{}` với mã 0 — `automerge.yml` đọc nó là "CI chưa xanh".
  const result = run('pick-ci-run.ts', ['--head', 'abc'], RUNS);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});

test('ca âm: `pick-ci-run.ts abc` vẫn chọn đúng lần chạy', () => {
  const result = run('pick-ci-run.ts', ['abc'], RUNS);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).id, 1);
});

test('ca âm: `pick-ci-run.ts` không đối số vẫn chạy', () => {
  const result = run('pick-ci-run.ts', [], RUNS);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).id, 1);
});
