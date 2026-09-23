/**
 * `KF-021` / mục `platform/P-033` — bài kiểm TÁI HIỆN lỗi.
 *
 * Lỗi: ba số bắt buộc của phụ lục P3 bước 0b (giờ kẹt · làn · chuỗi liên
 * tiếp) chỉ nằm trong `note` của dòng log bước 0, tức **văn xuôi**. Không
 * máy nào đọc lại được, nên mỗi lượt worker đếm chuỗi bằng mắt từ những
 * lượt nó tình cờ nhìn thấy — và khi hàng đợi merge đứng, các dòng bước 0
 * gần nhất nằm trong PR **chưa merge**, không thấy được từ `main`.
 *
 * Số thật đo ngày 2026-09-23 trên PR `#120`: bảy lượt bước 0 liên tiếp
 * (`23:33Z` → `02:46Z`) đều ra `aborted-ineligible` cùng một chữ ký, nhưng
 * ba lượt ghi ra ba con số khác nhau — `2`, rồi `1`, rồi `2`. Ngưỡng
 * `ABORTED_INELIGIBLE_ALERT_THRESHOLD = 3` bị vượt từ lượt `01:20Z` mà
 * không lượt nào nói ra, và không có gì đỏ (nhóm **Z**).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  formatLogLine,
  step0LogRef,
  step0Streaks,
  type RunLogLine,
  type Step0Stuck,
} from '../src/log.ts';

/** Chữ ký thật của `#120` ở cả bảy lượt: hai file mà `integrator-resolve.ts` trả về. */
const SIG_120 = 'ops/scripts/digest-metrics.ts,ops/test/digest-metrics.test.ts';

const stuck = (pr: number, signature: string, over: Partial<Step0Stuck> = {}): Step0Stuck => ({
  pr,
  outcome: 'aborted-ineligible',
  signature,
  hoursStuck: 1,
  lane: null,
  ...over,
});

const step0Line = (at: string, runner: string, entries?: readonly Step0Stuck[]): RunLogLine => ({
  at,
  lane: 'integration',
  kind: 'lane',
  ref: step0LogRef(at, runner),
  status: 'ok',
  durationMs: 0,
  costUsd: 0,
  ...(entries === undefined ? {} : { step0: entries }),
});

/** Bảy lượt thật của ngày 2026-09-23, theo đúng thứ tự và đúng tập PR đã đo. */
const SEVEN_RUNS: RunLogLine[] = [
  step0Line('2026-09-22T23:33:25Z', 'crux-worker-2', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c')]),
  step0Line('2026-09-22T23:38:41Z', 'crux-worker-1', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c')]),
  step0Line('2026-09-23T00:46:00Z', 'crux-worker-1', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c'), stuck(160, 'd'), stuck(112, 'e')]),
  step0Line('2026-09-23T01:20:08Z', 'crux-worker-2', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c'), stuck(160, 'd'), stuck(112, 'e')]),
  step0Line('2026-09-23T01:39:00Z', 'crux-worker-1', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c'), stuck(160, 'd'), stuck(112, 'e')]),
  step0Line('2026-09-23T02:24:19Z', 'crux-worker-2', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c'), stuck(160, 'd'), stuck(112, 'e')]),
  step0Line('2026-09-23T02:46:00Z', 'crux-worker-1', [stuck(120, SIG_120), stuck(39, 'a'), stuck(84, 'b'), stuck(89, 'c'), stuck(160, 'd'), stuck(112, 'e'), stuck(79, 'f'), stuck(142, 'g'), stuck(171, 'h')]),
];

test('tái hiện KF-021: bảy lượt cùng chữ ký ra chuỗi 7, không phải 1 hay 2', () => {
  const report = step0Streaks(SEVEN_RUNS);

  assert.equal(report.streaks.get(120)?.abortedIneligible, 7);
  assert.equal(report.streaks.get(39)?.abortedIneligible, 7);
  assert.equal(report.streaks.get(84)?.abortedIneligible, 7);
  assert.equal(report.streaks.get(89)?.abortedIneligible, 7);
  // Hai PR vào hàng đợi muộn hơn, từ lượt 00:46Z.
  assert.equal(report.streaks.get(160)?.abortedIneligible, 5);
  assert.equal(report.streaks.get(112)?.abortedIneligible, 5);
  // Ba PR mới ở lượt cuối.
  assert.equal(report.streaks.get(79)?.abortedIneligible, 1);
  assert.equal(report.streaks.get(142)?.abortedIneligible, 1);
  assert.equal(report.streaks.get(171)?.abortedIneligible, 1);

  assert.equal(report.totalRuns, 7);
  assert.equal(report.proseOnlyRuns, 0);
  assert.equal(report.readableRunsFromNewest, 7);
});

test('phép đếm cũ — chỉ nhìn lượt mới nhất — ra 1, tức đúng con số đã bị ghi sai', () => {
  const onlyNewest = step0Streaks(SEVEN_RUNS.slice(-1));
  assert.equal(onlyNewest.streaks.get(120)?.abortedIneligible, 1);
  assert.notEqual(onlyNewest.streaks.get(120)?.abortedIneligible, 7);
});

test('thứ tự dòng trong file không mang nghĩa: đảo dòng vẫn ra cùng chuỗi', () => {
  const shuffled = [SEVEN_RUNS[3]!, SEVEN_RUNS[6]!, SEVEN_RUNS[0]!, SEVEN_RUNS[5]!, SEVEN_RUNS[1]!, SEVEN_RUNS[4]!, SEVEN_RUNS[2]!];
  assert.equal(step0Streaks(shuffled).streaks.get(120)?.abortedIneligible, 7);
});

test('chuỗi về 0 khi PR vắng mặt ở lượt mới nhất', () => {
  const runs = [...SEVEN_RUNS.slice(0, 6), step0Line('2026-09-23T02:46:00Z', 'crux-worker-1', [stuck(39, 'a')])];
  const report = step0Streaks(runs);
  assert.equal(report.streaks.has(120), false);
  assert.equal(report.streaks.get(39)?.abortedIneligible, 7);
});

test('đổi chữ ký thì chuỗi bắt đầu lại từ 1, không nối vào chuỗi cũ', () => {
  const runs = [...SEVEN_RUNS.slice(0, 6), step0Line('2026-09-23T02:46:00Z', 'crux-worker-1', [stuck(120, 'CHARTER.md')])];
  assert.equal(step0Streaks(runs).streaks.get(120)?.abortedIneligible, 1);
});

test('một lượt bỏ sót ở giữa cắt chuỗi, không được nối hai bên lại', () => {
  const runs = [
    ...SEVEN_RUNS.slice(0, 3),
    step0Line('2026-09-23T01:00:00Z', 'crux-worker-3', [stuck(39, 'a')]), // #120 vắng mặt
    ...SEVEN_RUNS.slice(3),
  ];
  assert.equal(step0Streaks(runs).streaks.get(120)?.abortedIneligible, 4);
});

test('dòng chỉ có văn xuôi KHÔNG bị đọc thành "không kẹt" — phép đếm dừng và khai ra', () => {
  const runs = [
    ...SEVEN_RUNS.slice(0, 3),
    step0Line('2026-09-23T01:00:00Z', 'crux-worker-3'), // dòng cũ, chỉ có note
    ...SEVEN_RUNS.slice(3),
  ];
  const report = step0Streaks(runs);

  assert.equal(report.totalRuns, 8);
  assert.equal(report.proseOnlyRuns, 1);
  // Đếm được 4 lượt mới nhất rồi dừng — chuỗi là CẬN DƯỚI, và bên gọi biết vì sao.
  assert.equal(report.readableRunsFromNewest, 4);
  assert.equal(report.streaks.get(120)?.abortedIneligible, 4);
  assert.ok(report.readableRunsFromNewest < report.totalRuns);
});

test('hai chữ ký đếm riêng: red-after-merge không cộng vào aborted-ineligible', () => {
  const runs = [
    step0Line('2026-09-23T01:00:00Z', 'crux-worker-1', [stuck(89, 'lint:workflows', { outcome: 'red-after-merge' })]),
    step0Line('2026-09-23T02:00:00Z', 'crux-worker-2', [stuck(89, 'lint:workflows', { outcome: 'red-after-merge' })]),
  ];
  const report = step0Streaks(runs);
  assert.equal(report.streaks.get(89)?.redAfterMerge, 2);
  assert.equal(report.streaks.get(89)?.abortedIneligible, 0);
});

test('dòng không phải bước 0 bị bỏ qua, kể cả khi nó mang trường step0', () => {
  const foreign: RunLogLine = {
    at: '2026-09-23T02:50:00Z',
    lane: 'platform',
    kind: 'lane',
    ref: 'platform/P-033',
    status: 'ok',
    durationMs: 0,
    costUsd: 0,
    step0: [stuck(120, SIG_120)],
  };
  const report = step0Streaks([...SEVEN_RUNS, foreign]);
  assert.equal(report.totalRuns, 7);
  assert.equal(report.streaks.get(120)?.abortedIneligible, 7);
});

test('formatLogLine giữ nguyên trường step0, và bỏ nó khi không có', () => {
  const withStep0 = JSON.parse(formatLogLine(SEVEN_RUNS[6]!)) as { step0?: unknown[] };
  assert.equal(withStep0.step0?.length, 9);

  const without = JSON.parse(formatLogLine(step0Line('2026-09-23T02:50:00Z', 'crux-worker-1'))) as Record<string, unknown>;
  assert.equal('step0' in without, false);
});

test('không có lượt nào thì trả bản báo rỗng, không ném', () => {
  const report = step0Streaks([]);
  assert.equal(report.streaks.size, 0);
  assert.equal(report.totalRuns, 0);
  assert.equal(report.readableRunsFromNewest, 0);
});
