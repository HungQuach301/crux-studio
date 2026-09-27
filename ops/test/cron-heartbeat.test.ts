// Mục `platform/P-014` sóng 5 — Z6, nhịp tim của cron. Mỗi luật có bài âm:
// một luật chỉ có giá trị khi nó đỏ đúng lúc phải đỏ (bài học KF-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CRON_MEASURED_MAX_GAP_MINUTES,
  cronExpressions,
  cronHeartbeatProblems,
  cronHeartbeats,
  cronPeriodMinutes,
  renderCronHeartbeats,
  scheduledWorkflows,
  staleThresholdMinutes,
  type CronSnapshot,
  type ScheduledWorkflow,
} from '../scripts/cron-heartbeat.ts';

const ROOT = new URL('../..', import.meta.url).pathname;
const WORKFLOWS = join(ROOT, 'ops/workflows');
const CLI = join(ROOT, 'ops/scripts/cron-heartbeat.ts');

const HOURLY: ScheduledWorkflow = { file: 'watchdog.yml', crons: ['0 * * * *'] };
const NOW = '2026-09-27T21:45:00Z';
const minutesBefore = (min: number): string => new Date(Date.parse(NOW) - min * 60000).toISOString();
const snap = (w: Partial<CronSnapshot['workflows'][number]>): CronSnapshot => ({
  now: NOW,
  workflows: [{ path: '.github/workflows/watchdog.yml', state: 'active', lastScheduleRunAt: minutesBefore(60), ...w }],
});
const verdictOf = (s: CronSnapshot, w: ScheduledWorkflow = HOURLY): string => cronHeartbeats([w], s)[0]!.verdict;

// ── Chu kỳ ───────────────────────────────────────────────────────────────

test('cronPeriodMinutes: mỗi giờ, mỗi ngày, mỗi tuần', () => {
  assert.equal(cronPeriodMinutes('17 * * * *'), 60);
  assert.equal(cronPeriodMinutes('0 20 * * *'), 1440);
  assert.equal(cronPeriodMinutes('0 3 * * 1'), 10080);
});

test('cronPeriodMinutes: biểu thức ngoài tập con trả null, không đoán', () => {
  for (const e of ['*/5 * * * *', '0,30 * * * *', '0 1-5 * * *', '0 0 1 * *', '0 0 * 1 *', '0 * * * 1', '60 * * * *', '0 24 * * *', '0 * * *', 'x * * * *']) {
    assert.equal(cronPeriodMinutes(e), null, e);
  }
});

// ── Ngưỡng, so với số đo thật ─────────────────────────────────────────────

test('ngưỡng nằm trên MỌI khoảng hở lớn nhất đã đo (không báo nhầm hệ đang khoẻ)', () => {
  const tree = new Map(scheduledWorkflows(WORKFLOWS).map((w) => [w.file, w]));
  for (const [file, gap] of Object.entries(CRON_MEASURED_MAX_GAP_MINUTES)) {
    const w = tree.get(file);
    assert.ok(w, `${file} có trong bảng số đo mà không còn lịch trong cây`);
    const period = Math.min(...w.crons.map((c) => cronPeriodMinutes(c)!));
    assert.ok(staleThresholdMinutes(period) > gap, `${file}: ngưỡng ${staleThresholdMinutes(period)} ≤ khoảng hở đo được ${gap}`);
  }
});

test('ngưỡng vẫn bắt được ca NGỪNG hẳn: cron mỗi giờ im 1 ngày là stale', () => {
  assert.ok(staleThresholdMinutes(60) < 24 * 60);
  assert.equal(verdictOf(snap({ lastScheduleRunAt: minutesBefore(24 * 60) })), 'stale');
});

test('mép ngưỡng: đúng bằng ngưỡng còn fresh, vượt một phút là stale', () => {
  const t = staleThresholdMinutes(60);
  assert.equal(verdictOf(snap({ lastScheduleRunAt: minutesBefore(t) })), 'fresh');
  assert.equal(verdictOf(snap({ lastScheduleRunAt: minutesBefore(t + 1) })), 'stale');
});

test('nhiều biểu thức trong một file: lấy chu kỳ NGẮN nhất', () => {
  const w: ScheduledWorkflow = { file: 'watchdog.yml', crons: ['0 20 * * *', '0 * * * *'] };
  assert.equal(cronHeartbeats([w], snap({}))[0]!.periodMinutes, 60);
});

// ── Phán quyết ───────────────────────────────────────────────────────────

test('state khác active là disabled — kể cả giá trị lạ, và đi TRƯỚC stale', () => {
  for (const state of ['disabled_inactivity', 'disabled_manually', 'deleted', 'something_new', '']) {
    assert.equal(verdictOf(snap({ state })), 'disabled', state);
  }
  assert.equal(verdictOf(snap({ state: 'disabled_inactivity', lastScheduleRunAt: minutesBefore(99999) })), 'disabled');
});

test('mốc ở tương lai là future, không phải fresh (bài học Z7)', () => {
  assert.equal(verdictOf(snap({ lastScheduleRunAt: minutesBefore(-60) })), 'future');
  assert.equal(verdictOf(snap({ lastScheduleRunAt: minutesBefore(-2) })), 'fresh', 'trong dung sai đồng hồ');
});

test('chưa có lượt nào: never, trừ khi workflow mới tạo trong ngưỡng', () => {
  assert.equal(verdictOf(snap({ lastScheduleRunAt: null })), 'never');
  assert.equal(verdictOf(snap({ lastScheduleRunAt: null, createdAt: minutesBefore(30) })), 'pending-first');
  assert.equal(verdictOf(snap({ lastScheduleRunAt: null, createdAt: minutesBefore(3 * 24 * 60) })), 'never');
});

test('biểu thức không đọc được là unsupported-cron, không phải fresh', () => {
  assert.equal(verdictOf(snap({}), { file: 'watchdog.yml', crons: ['*/5 * * * *'] }), 'unsupported-cron');
});

test('cây có lịch mà ảnh chụp thiếu workflow: missing và đỏ', () => {
  const rows = cronHeartbeats([HOURLY, { file: 'main-ci.yml', crons: ['17 * * * *'] }], snap({}));
  assert.deepEqual(rows.map((r) => [r.file, r.verdict]), [['watchdog.yml', 'fresh'], ['main-ci.yml', 'missing']]);
  assert.deepEqual(cronHeartbeatProblems(rows).map((r) => r.file), ['main-ci.yml']);
});

test('ảnh chụp rỗng, cây rỗng, mốc hỏng: NÉM chứ không ra 0 vấn đề (Z15)', () => {
  assert.throws(() => cronHeartbeats([HOURLY], { now: NOW, workflows: [] }), /chưa đo/);
  assert.throws(() => cronHeartbeats([], snap({})), /phép quét cây hỏng/);
  assert.throws(() => cronHeartbeats([HOURLY], { ...snap({}), now: 'hôm qua' }), /không đọc được/);
  assert.throws(() => cronHeartbeats([HOURLY], snap({ lastScheduleRunAt: 'NaN' })), /không đọc được/);
});

test('chỉ fresh và pending-first là khoẻ; sáu phán quyết còn lại đều là vấn đề', () => {
  const cases: [Partial<CronSnapshot['workflows'][number]>, ScheduledWorkflow][] = [
    [{ lastScheduleRunAt: minutesBefore(99999) }, HOURLY],
    [{ state: 'disabled_inactivity' }, HOURLY],
    [{ lastScheduleRunAt: null }, HOURLY],
    [{ lastScheduleRunAt: minutesBefore(-600) }, HOURLY],
    [{}, { file: 'watchdog.yml', crons: ['*/5 * * * *'] }],
  ];
  for (const [s, w] of cases) assert.equal(cronHeartbeatProblems(cronHeartbeats([w], snap(s))).length, 1, JSON.stringify(s));
  const missing = cronHeartbeats([{ file: 'other.yml', crons: ['0 * * * *'] }], snap({}));
  assert.equal(cronHeartbeatProblems(missing).length, 1);
});

// ── Đọc lịch từ cây ──────────────────────────────────────────────────────

test('cronExpressions: đọc khối schedule, bỏ chú thích, dừng ở khoá anh em', () => {
  const yaml = [
    'on:',
    '  schedule:',
    '    # 20:00 UTC, ngay trước bản tin',
    "    - cron: '0 20 * * *'",
    '    - cron: "17 * * * *"  # dự phòng',
    '  workflow_dispatch:',
    'jobs:',
    '  x:',
    '    steps:',
    '      - run: |',
    "          echo \"- cron: '1 1 * * *'\"",
    '      - run: |',
    '          cat <<YAML',
    "          - cron: '2 2 * * *'",
    '          YAML',
  ].join('\n');
  assert.deepEqual(cronExpressions(yaml), ['0 20 * * *', '17 * * * *']);
  assert.deepEqual(cronExpressions('on:\n  push:\n    branches: [main]\n'), []);
});

test('cây thật: số file có lịch khớp một phép đếm ĐỘC LẬP (bộ đọc không xanh vì mù)', () => {
  const independent = readdirSync(WORKFLOWS)
    .filter((f) => f.endsWith('.yml'))
    .filter((f) => /^\s*-\s*cron:/m.test(readFileSync(join(WORKFLOWS, f), 'utf8')))
    .sort();
  const read = scheduledWorkflows(WORKFLOWS);
  assert.deepEqual(read.map((w) => w.file), independent);
  assert.ok(read.length >= 4, `chỉ đọc được ${read.length} workflow theo lịch`);
  for (const w of read) for (const c of w.crons) assert.notEqual(cronPeriodMinutes(c), null, `${w.file}: '${c}' ngoài tập con đọc được`);
});

// ── Bản in ───────────────────────────────────────────────────────────────

test('bản in luôn có dòng kết luận, kể cả khi 0 vấn đề (Z2/Z7)', () => {
  assert.match(renderCronHeartbeats(cronHeartbeats([HOURLY], snap({}))), /^Nhịp tim cron \(Z6\): 1 workflow theo lịch, 0 vấn đề\./);
  assert.match(
    renderCronHeartbeats(cronHeartbeats([HOURLY], snap({ state: 'disabled_inactivity' }))),
    /CÓ VẤN ĐỀ: watchdog\.yml \(disabled\)/,
  );
});

// ── CLI: ba mã thoát tách nhau ───────────────────────────────────────────

function runCli(snapshot: unknown, dirYaml: Record<string, string> | null = { 'watchdog.yml': "on:\n  schedule:\n    - cron: '0 * * * *'\n" }) {
  const tmp = mkdtempSync(join(tmpdir(), 'cron-hb-'));
  const file = join(tmp, 'snap.json');
  writeFileSync(file, typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot));
  const dir = join(tmp, 'wf');
  mkdirSync(dir);
  for (const [name, body] of Object.entries(dirYaml ?? {})) writeFileSync(join(dir, name), body);
  return spawnSync(process.execPath, [CLI, file, '--dir', dir], { encoding: 'utf8' });
}

test('CLI: 0 khi khoẻ · 1 khi có vấn đề · 2 khi không đo được', () => {
  assert.equal(runCli(snap({})).status, 0);
  assert.equal(runCli(snap({ lastScheduleRunAt: minutesBefore(99999) })).status, 1);
  assert.equal(runCli({ now: NOW, workflows: [] }).status, 2);
  assert.equal(runCli('{không phải json').status, 2);
  assert.equal(runCli({ workflows: [] }).status, 2);
  assert.equal(runCli(snap({}), {}).status, 2, 'cây không có lịch nào');
});
