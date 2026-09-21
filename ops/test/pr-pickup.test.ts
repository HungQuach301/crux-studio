/**
 * `ops/scripts/pr-pickup.ts` — cơ chế của mục `P-022`.
 *
 * Chỉ kiểm các hàm thuần. Lớp vỏ `main()` chỉ đọc một file log rồi in ra,
 * và `readStepZeroNotes` được kiểm riêng bằng một file tạm.
 *
 * Bài kiểm quan trọng nhất trong file này là bài **âm**
 * ("một PR aborted-ineligible bị bỏ qua thì phải đỏ"): P-022 sinh ra vì
 * trạng thái "cần người" không có ai sở hữu, nên thứ phải khoá lại chính là
 * việc một PR như thế KHÔNG được rơi khỏi danh sách phải nhận.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PICKUP_QUIET_HOURS,
  ESCALATE_AFTER_TURNS,
  STUCK_MARKER,
  ownerLaneOf,
  hoursStuck,
  needsPickup,
  selectPickup,
  assignPickup,
  formatStuckNote,
  parseStuckEntries,
  consecutiveAbortedTurns,
  nextTurnCount,
  selectEscalations,
  escalationLine,
  readStepZeroNotes,
  type StuckPrCandidate,
  type StuckEntry,
} from '../scripts/pr-pickup.ts';

const NOW = new Date('2026-09-21T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function pr(over: Partial<StuckPrCandidate> = {}): StuckPrCandidate {
  return {
    number: 39,
    headRefName: 'claude/visual/V-001',
    lastCommitAt: hoursAgo(5),
    conflictedSinceAt: hoursAgo(3),
    lastOutcome: 'aborted-ineligible',
    ...over,
  };
}

// --- Làn sở hữu ---

test('ownerLaneOf: suy làn từ tên nhánh claude/<lane>/<id>', () => {
  assert.equal(ownerLaneOf('claude/visual/V-001'), 'visual');
  assert.equal(ownerLaneOf('claude/platform/P-018'), 'platform');
  assert.equal(ownerLaneOf('claude/verify/VF-G11'), 'verify');
});

test('ownerLaneOf: nhánh ngoài quy ước thì null, không đoán', () => {
  assert.equal(ownerLaneOf('main'), null);
  assert.equal(ownerLaneOf('claude/blissful-maxwell-0532bs'), null);
  assert.equal(ownerLaneOf('claude/visual'), null);
});

// --- Bài kiểm ÂM: một PR aborted-ineligible không được rơi khỏi danh sách ---

test('ÂM · PR aborted-ineligible đủ im lặng mà bị bỏ qua thì bài kiểm đỏ', () => {
  const stuck = pr({ number: 26, lastCommitAt: hoursAgo(PICKUP_QUIET_HOURS + 0.5) });

  assert.equal(
    needsPickup(stuck, NOW),
    true,
    'PR aborted-ineligible không có commit mới trong 2 giờ LÀ việc phải nhận — ' +
      'đây đúng là khoảng trống mà P-022 sinh ra để bịt',
  );

  const selected = selectPickup([stuck], NOW);
  assert.equal(selected.length, 1, 'không được lọc PR này ra khỏi danh sách phải nhận');
  assert.equal(selected[0]?.number, 26);

  const assigned = assignPickup([stuck], NOW);
  assert.notEqual(assigned, null, 'lượt chạy phải nhận PR này, không được đi duyệt backlog');
  assert.equal(assigned?.pr.number, 26);
});

// --- Chọn PR phải nhận ---

test('needsPickup: chỉ aborted-ineligible mới là việc phải nhận', () => {
  const quiet = { lastCommitAt: hoursAgo(5) };
  assert.equal(needsPickup({ ...quiet, lastOutcome: 'aborted-ineligible' }, NOW), true);
  assert.equal(needsPickup({ ...quiet, lastOutcome: 'resolved' }, NOW), false);
  assert.equal(needsPickup({ ...quiet, lastOutcome: 'clean' }, NOW), false);
  // `aborted-error` là hỏng ở phía công cụ, và P3 bước 0 cấm thử lại trong
  // cùng lần chạy — không phải một PR đang chờ người.
  assert.equal(needsPickup({ ...quiet, lastOutcome: 'aborted-error' }, NOW), false);
});

test('needsPickup: còn worker khác đang xử lý thì không giẫm chân', () => {
  assert.equal(needsPickup(pr({ lastCommitAt: hoursAgo(0.5) }), NOW), false);
  assert.equal(needsPickup(pr({ lastCommitAt: hoursAgo(1.9) }), NOW), false);
  assert.equal(needsPickup(pr({ lastCommitAt: hoursAgo(2) }), NOW), true);
});

test('needsPickup: ngày giờ hỏng thì false — không đoán', () => {
  assert.equal(needsPickup(pr({ lastCommitAt: 'hôm qua' }), NOW), false);
});

test('needsPickup: dùng đúng ngưỡng của ca "CI đỏ", không có ngưỡng riêng', () => {
  assert.equal(PICKUP_QUIET_HOURS, 2);
});

test('selectPickup: PR kẹt lâu nhất đứng trước', () => {
  const list = [
    pr({ number: 39, conflictedSinceAt: hoursAgo(1) }),
    pr({ number: 26, conflictedSinceAt: hoursAgo(9) }),
    pr({ number: 31, conflictedSinceAt: hoursAgo(4) }),
  ];
  assert.deepEqual(
    selectPickup(list, NOW).map((p) => p.number),
    [26, 31, 39],
  );
});

test('selectPickup: kẹt bằng nhau thì thứ tự vẫn xác định, không phụ thuộc đầu vào', () => {
  const same = hoursAgo(3);
  const a = [pr({ number: 42, conflictedSinceAt: same }), pr({ number: 12, conflictedSinceAt: same })];
  const b = [...a].reverse();
  assert.deepEqual(
    selectPickup(a, NOW).map((p) => p.number),
    selectPickup(b, NOW).map((p) => p.number),
  );
  assert.equal(selectPickup(a, NOW)[0]?.number, 12);
});

test('assignPickup: nhận đúng MỘT PR, kèm làn sở hữu và số giờ kẹt', () => {
  const assigned = assignPickup(
    [
      pr({ number: 39, headRefName: 'claude/visual/V-001', conflictedSinceAt: hoursAgo(2.5) }),
      pr({ number: 26, headRefName: 'claude/platform/P-018', conflictedSinceAt: hoursAgo(7) }),
    ],
    NOW,
  );
  assert.equal(assigned?.pr.number, 26);
  assert.equal(assigned?.ownerLane, 'platform');
  assert.equal(assigned?.hoursStuck, 7);
});

test('assignPickup: không có PR nào phải nhận thì null — lượt chạy đi duyệt backlog', () => {
  assert.equal(assignPickup([], NOW), null);
  assert.equal(assignPickup([pr({ lastOutcome: 'clean' })], NOW), null);
  assert.equal(assignPickup([pr({ lastCommitAt: hoursAgo(0.2) })], NOW), null);
});

test('assignPickup: làn không suy được thì vẫn nhận, chỉ ghi lane null', () => {
  const assigned = assignPickup([pr({ headRefName: 'claude/keen-euler-ekeqos' })], NOW);
  assert.equal(assigned?.pr.number, 39);
  assert.equal(assigned?.ownerLane, null);
});

test('hoursStuck: đếm từ lúc PR bắt đầu xung đột', () => {
  assert.equal(hoursStuck(pr({ conflictedSinceAt: hoursAgo(6) }), NOW), 6);
  assert.equal(hoursStuck(pr({ conflictedSinceAt: 'không phải ngày' }), NOW), null);
});

// --- Khối máy đọc trong `note` ---

const entry = (over: Partial<StuckEntry> = {}): StuckEntry => ({
  pr: 39,
  branch: 'claude/visual/V-001',
  lane: 'visual',
  outcome: 'aborted-ineligible',
  turns: 1,
  hoursStuck: 0.6,
  ...over,
});

test('formatStuckNote/parseStuckEntries: đi vòng tròn, giữ nguyên bốn trường P-022 đòi', () => {
  const note = formatStuckNote('Bước 0: 0 giải, 1 bỏ lại.', [entry()]);
  assert.ok(note.includes(STUCK_MARKER));
  assert.ok(note.startsWith('Bước 0: 0 giải, 1 bỏ lại.'), 'văn xuôi cho người đọc vẫn đứng trước');
  const back = parseStuckEntries(note)[0];
  assert.equal(back?.pr, 39);
  assert.equal(back?.branch, 'claude/visual/V-001');
  assert.equal(back?.lane, 'visual');
  assert.equal(back?.turns, 1);
  assert.equal(back?.hoursStuck, 0.6);
});

test('parseStuckEntries: dòng log cũ hoặc khối hỏng ra [], không ném', () => {
  assert.deepEqual(parseStuckEntries(undefined), []);
  assert.deepEqual(parseStuckEntries('Bước 0 của P3: 1 PR xung đột, cần người.'), []);
  assert.deepEqual(parseStuckEntries(`văn xuôi ${STUCK_MARKER}{không phải json`), []);
  assert.deepEqual(parseStuckEntries(`văn xuôi ${STUCK_MARKER}{"pr":39}`), [], 'không phải mảng thì bỏ');
});

// --- Nhịp tim ---

test('consecutiveAbortedTurns: đếm đúng chuỗi lượt liên tiếp', () => {
  const notes = [
    formatStuckNote('lượt 1', [entry({ turns: 1 })]),
    formatStuckNote('lượt 2', [entry({ turns: 2 })]),
    formatStuckNote('lượt 3', [entry({ turns: 3 })]),
  ];
  assert.equal(consecutiveAbortedTurns(notes, 39), 3);
});

test('consecutiveAbortedTurns: lượt gỡ được xong phá chuỗi', () => {
  const notes = [
    formatStuckNote('lượt 1', [entry()]),
    formatStuckNote('lượt 2', [entry({ outcome: 'resolved' })]),
    formatStuckNote('lượt 3', [entry()]),
  ];
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
});

test('consecutiveAbortedTurns: lượt không nhắc tới PR cũng phá chuỗi', () => {
  const notes = [
    formatStuckNote('lượt 1', [entry()]),
    formatStuckNote('không có PR xung đột', []),
    formatStuckNote('lượt 3', [entry()]),
  ];
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
});

test('consecutiveAbortedTurns: dòng văn xuôi cũ phá chuỗi — sai an toàn về hướng đếm thiếu', () => {
  const notes = [
    'Bước 0 của P3 lượt 19:05 — #39 xung đột, cần người',
    formatStuckNote('lượt mới', [entry()]),
  ];
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
});

test('consecutiveAbortedTurns: PR khác không lẫn vào chuỗi của PR này', () => {
  const notes = [
    formatStuckNote('lượt 1', [entry({ pr: 26 })]),
    formatStuckNote('lượt 2', [entry({ pr: 26 }), entry({ pr: 39 })]),
  ];
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
  assert.equal(consecutiveAbortedTurns(notes, 26), 2);
});

test('nextTurnCount: cộng dồn số của lượt trước, không đếm lại từ đầu', () => {
  const notes = [
    'Bước 0 lượt 1 — văn xuôi thuần, chưa có khối máy đọc',
    'Bước 0 lượt 2 — văn xuôi thuần',
    formatStuckNote('lượt 3, số đếm tay', [entry({ turns: 3 })]),
  ];
  // Đếm lại từ đầu chỉ thấy 1 dòng có khối máy đọc...
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
  // ...nhưng số ghi cho lượt sau phải là 4, không phải 2.
  assert.equal(nextTurnCount(notes, 39), 4);
});

test('nextTurnCount: lượt trước gỡ được, hoặc không nhắc tới PR, thì đếm lại từ 1', () => {
  assert.equal(nextTurnCount([formatStuckNote('x', [entry({ outcome: 'resolved', turns: 9 })])], 39), 1);
  assert.equal(nextTurnCount([formatStuckNote('không có PR xung đột', [])], 39), 1);
  assert.equal(nextTurnCount([], 39), 1);
});

test('nextTurnCount: số hỏng ở dòng trước không lan ra thành NaN', () => {
  const broken = formatStuckNote('x', [entry({ turns: Number.NaN as unknown as number })]);
  assert.equal(nextTurnCount([broken], 39), 2);
});

test('selectEscalations: quá ngưỡng thì nổi lên bản tin, dưới ngưỡng thì không', () => {
  const list = [
    entry({ pr: 39, turns: ESCALATE_AFTER_TURNS }),
    entry({ pr: 26, turns: ESCALATE_AFTER_TURNS + 1 }),
    entry({ pr: 12, turns: ESCALATE_AFTER_TURNS - 1 }),
  ];
  assert.deepEqual(
    selectEscalations(list).map((e) => e.pr),
    [26, 39],
    'nhiều lượt nhất trước; PR dưới ngưỡng không làm phiền chủ dự án',
  );
});

test('selectEscalations: kết quả khác aborted-ineligible không bao giờ nổi lên', () => {
  assert.deepEqual(selectEscalations([entry({ outcome: 'resolved', turns: 9 })]), []);
});

test('escalationLine: một dòng, đủ PR, làn, giờ kẹt và link', () => {
  const line = escalationLine(entry({ turns: 4, hoursStuck: 5.8 }), 'https://github.com/o/r');
  assert.ok(line.includes('#39'));
  assert.ok(line.includes('visual'));
  assert.ok(line.includes('5 giờ'));
  assert.ok(line.includes('4 lượt'));
  assert.ok(line.includes('https://github.com/o/r/pull/39'));
});

test('escalationLine: nhánh ngoài quy ước vẫn ra một dòng đọc được', () => {
  assert.ok(escalationLine(entry({ lane: null }), 'https://github.com/o/r').includes('không rõ làn'));
});

// --- Đọc log bước 0 ---

test('readStepZeroNotes: sắp theo `at`, không tin thứ tự dòng trong file', () => {
  const root = mkdtempSync(join(tmpdir(), 'pr-pickup-'));
  mkdirSync(join(root, 'ops', 'logs', 'platform'), { recursive: true });
  const line = (at: string, note: string) =>
    JSON.stringify({
      at,
      lane: 'platform',
      kind: 'lane',
      ref: 'platform/P-016',
      status: 'ok',
      durationMs: 0,
      costUsd: 0,
      note,
    });
  writeFileSync(
    join(root, 'ops', 'logs', 'platform', 'P-016.jsonl'),
    // Cố tình ghi ngược thứ tự thời gian: `merge=union` không xếp theo `at`.
    [
      line('2026-09-21T12:06:20.000Z', formatStuckNote('lượt sau', [entry({ turns: 2 })])),
      line('2026-09-21T07:40:00.000Z', formatStuckNote('lượt trước', [entry({ turns: 1 })])),
    ].join('\n') + '\n',
    'utf8',
  );

  const notes = readStepZeroNotes(root);
  assert.equal(notes.length, 2);
  assert.ok(notes[0]?.startsWith('lượt trước'), 'dòng cũ nhất phải đứng đầu');
  assert.equal(consecutiveAbortedTurns(notes, 39), 2);
});

test('readStepZeroNotes: chưa có file log thì [] chứ không ném', () => {
  assert.deepEqual(readStepZeroNotes(mkdtempSync(join(tmpdir(), 'pr-pickup-empty-'))), []);
});
