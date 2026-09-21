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
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PICKUP_QUIET_HOURS,
  ESCALATE_AFTER_TURNS,
  ESCALATE_AFTER_HOURS,
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
  formatStuckDuration,
  isLeftBehind,
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

test('parseStuckEntries: số hỏng bị loại — bản tin không được in "NaN giờ"', () => {
  // Đã in ra thật trước khi sửa: 'kẹt xung đột NaN giờ … cần anh gỡ tay'.
  const bad = (over: Record<string, unknown>) =>
    parseStuckEntries(`x ${STUCK_MARKER}${JSON.stringify([{ ...entry(), ...over }])}`);
  assert.deepEqual(bad({ hoursStuck: 'b' }), []);
  assert.deepEqual(bad({ turns: null }), []);
  assert.deepEqual(bad({ hoursStuck: Number.NaN }), [], 'NaN không sống sót qua JSON, nhưng null thì có');
  assert.deepEqual(bad({ branch: 42 }), []);
  assert.equal(bad({ lane: null }).length, 1, 'lane null là hợp lệ — nhánh ngoài quy ước');
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
  // `parseStuckEntries` đã loại entry có `turns` không phải số hữu hạn, nên
  // dòng hỏng coi như không nhắc tới PR ⇒ đếm lại từ 1. Hướng sai an toàn:
  // đếm thiếu thì chậm một lượt, đếm thừa thì báo động giả.
  const broken = formatStuckNote('x', [{ ...entry(), turns: null as unknown as number }]);
  assert.equal(nextTurnCount([broken], 39), 1);
  // Số hợp lệ thì vẫn cộng dồn bình thường.
  assert.equal(nextTurnCount([formatStuckNote('x', [entry({ turns: 2 })])], 39), 3);
});

test('selectEscalations: quá CẢ HAI ngưỡng thì nổi lên bản tin', () => {
  const long = ESCALATE_AFTER_HOURS + 1;
  const list = [
    entry({ pr: 39, turns: ESCALATE_AFTER_TURNS, hoursStuck: long }),
    entry({ pr: 26, turns: ESCALATE_AFTER_TURNS + 1, hoursStuck: long }),
    entry({ pr: 12, turns: ESCALATE_AFTER_TURNS - 1, hoursStuck: long }),
  ];
  assert.deepEqual(
    selectEscalations(list).map((e) => e.pr),
    [26, 39],
    'nhiều lượt nhất trước; PR dưới ngưỡng lượt không làm phiền chủ dự án',
  );
});

test('selectEscalations: đủ lượt nhưng chưa đủ giờ thì IM — chặn báo động giả', () => {
  // Đúng ca đã đo thật trên #39: ba lượt bước 0 trong 32 phút, vì bước 0
  // chạy ở đầu mọi lượt worker và dự án chạy 2–3 worker song song. Ba lượt
  // ở đó không mang thông tin mới nào.
  const fast = entry({ turns: ESCALATE_AFTER_TURNS + 5, hoursStuck: 0.57 });
  assert.deepEqual(selectEscalations([fast]), []);
  assert.equal(selectEscalations([{ ...fast, hoursStuck: ESCALATE_AFTER_HOURS }]).length, 1);
});

test('selectEscalations: kết quả đã gỡ xong không bao giờ nổi lên', () => {
  const long = ESCALATE_AFTER_HOURS + 1;
  assert.deepEqual(selectEscalations([entry({ outcome: 'resolved', turns: 9, hoursStuck: long })]), []);
  assert.deepEqual(selectEscalations([entry({ outcome: 'clean', turns: 9, hoursStuck: long })]), []);
});

test('aborted-error: không ai nhận, nhưng KHÔNG được rơi khỏi nhịp tim', () => {
  const long = ESCALATE_AFTER_HOURS + 1;
  const err = entry({ outcome: 'aborted-error', turns: ESCALATE_AFTER_TURNS, hoursStuck: long });
  // Không phải việc worker nhận — P3 bước 0 cấm thử lại trong cùng lần chạy.
  assert.equal(needsPickup({ lastOutcome: 'aborted-error', lastCommitAt: hoursAgo(5) }, NOW), false);
  // Nhưng phải nổi lên bản tin, nếu không nó rơi khỏi CẢ HAI vế và dựng lại
  // đúng khoảng trống không-ai-sở-hữu mà P-022 sinh ra để đóng.
  assert.equal(selectEscalations([err]).length, 1);
  assert.equal(isLeftBehind('aborted-error'), true);
  assert.equal(isLeftBehind('aborted-ineligible'), true);
  assert.equal(isLeftBehind('resolved'), false);
  assert.equal(isLeftBehind('clean'), false);
});

test('aborted-error: vẫn cộng dồn số lượt như aborted-ineligible', () => {
  const notes = [formatStuckNote('x', [entry({ outcome: 'aborted-error', turns: 2 })])];
  assert.equal(nextTurnCount(notes, 39), 3);
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
});

test('formatStuckDuration: dưới một giờ ra phút, không ra "0 giờ"', () => {
  // Đã in ra thật trước khi sửa: "kẹt xung đột 0 giờ … cần anh gỡ tay".
  assert.equal(formatStuckDuration(0.57), '34 phút');
  assert.equal(formatStuckDuration(0.01), '1 phút', 'không bao giờ ra 0');
  assert.equal(formatStuckDuration(2.5), '2.5 giờ');
  assert.equal(formatStuckDuration(26), '26 giờ');
  assert.equal(formatStuckDuration(Number.NaN), 'không rõ bao lâu');
  assert.equal(formatStuckDuration(-1), 'không rõ bao lâu');
});

test('escalationLine: một dòng, đủ PR, làn, giờ kẹt và link', () => {
  const line = escalationLine(entry({ turns: 4, hoursStuck: 5.8 }), 'https://github.com/o/r');
  assert.ok(line.includes('#39'));
  assert.ok(line.includes('visual'));
  assert.ok(line.includes('5.8 giờ'), 'một chữ số thập phân, không làm tròn xuống thành 5');
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

test('readStepZeroNotes: một dòng rác KHÔNG được giết cả bước đọc log', () => {
  // File này append-only, gộp bằng `merge=union` (union không khử trùng lặp)
  // và mọi nhánh worker đều ghi vào nó — đúng loại file dễ sinh dòng rác.
  // Ném ở đây là giết bước bản tin mà phụ lục P2 bắt chạy.
  const root = mkdtempSync(join(tmpdir(), 'pr-pickup-rac-'));
  mkdirSync(join(root, 'ops', 'logs', 'platform'), { recursive: true });
  writeFileSync(
    join(root, 'ops', 'logs', 'platform', 'P-016.jsonl'),
    [
      'khong-phai-json',
      JSON.stringify({ at: '2026-09-21T12:00:00.000Z', note: formatStuckNote('ok', [entry()]) }),
      '{"at": nửa dòng',
    ].join('\n') + '\n',
    'utf8',
  );
  const notes = readStepZeroNotes(root);
  assert.equal(notes.length, 1, 'giữ dòng đọc được, bỏ dòng hỏng');
  assert.equal(consecutiveAbortedTurns(notes, 39), 1);
});

// --- Nhịp tim phải TỰ CANH chính nó (nhóm Z) ---

test('mọi dòng log bước 0 từ khi có cơ chế P-022 phải mang khối máy đọc', () => {
  // Không có bài kiểm này thì cơ chế tắt được KHÔNG TIẾNG ĐỘNG: một lượt
  // worker quên gọi `formatStuckNote` thì PR biến mất khỏi `stuck`, biến
  // mất khỏi `escalations`, và số lượt tụt về 1 ở lượt sau — tức dựng lại
  // đúng Z17 một nấc trên. Đây là vế "không chỉ là luật trên giấy" trong
  // tiêu chí xong của P-022: một thứ Ở NGOÀI đếm và so, không phải prompt
  // tự khai.
  //
  // Các dòng TRƯỚC mốc này viết bằng văn xuôi thuần và log là append-only,
  // nên không sửa lại được — mốc chính là ranh giới đó.
  const CUTOFF = Date.parse('2026-09-21T12:38:00.000Z');
  const path = join(process.cwd(), 'ops', 'logs', 'platform', 'P-016.jsonl');
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as { at: string; note?: string })
    .filter((line) => Date.parse(line.at) >= CUTOFF);

  assert.ok(lines.length >= 1, 'phải có ít nhất một dòng bước 0 theo cơ chế mới');
  for (const line of lines) {
    assert.ok(
      line.note !== undefined && line.note.includes(STUCK_MARKER),
      `dòng log bước 0 lúc ${line.at} thiếu khối \`${STUCK_MARKER}\` — ` +
        'bước 0 phải dựng note bằng formatStuckNote (CHARTER phụ lục P3 bước 0d)',
    );
    // Và khối đó phải đọc được thành entry hợp lệ, không chỉ có mặt.
    const entries = parseStuckEntries(line.note);
    for (const e of entries) {
      assert.equal(typeof e.branch, 'string');
      assert.ok(Number.isFinite(e.turns) && e.turns >= 1);
      assert.ok(Number.isFinite(e.hoursStuck) && e.hoursStuck >= 0);
    }
  }
});
