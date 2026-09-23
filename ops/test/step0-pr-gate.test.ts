/**
 * Mục `platform/P-038` — bài kiểm cho cổng "lượt bước 0 này có được mở PR
 * riêng không".
 *
 * Hai chiều hỏng phải khoá, và chúng ngược nhau — đó chính là lý do mục này
 * cần test chứ không chỉ cần một câu trong CHARTER:
 *
 * - **Hỏng chiều tốn tiền:** cổng trả `openPr: true` cho một lượt log-only
 *   trong lúc nhịp tim còn mới. Đó là hành vi TRƯỚC mục này, và nó tiêu 6
 *   job `ci.yml` cộng một lượt `main-ci` cho một dòng văn bản, 2–3 lần mỗi
 *   giờ.
 * - **Hỏng chiều gọi người:** cổng trả `openPr: false` trong lúc nhịp tim
 *   trên `main` sắp quá ngưỡng 3 giờ của CHARTER 2.4. Chiều này im lặng hơn
 *   hẳn chiều kia — không gì đỏ, chỉ có `watchdog.yml` gọi chủ dự án vì một
 *   nhà máy đang chạy đúng. Nhóm **Z**.
 *
 * Mỗi ca dưới đây có một ca âm đi kèm ở ngay cạnh nó: nếu bỏ một nhánh của
 * `step0PrGate` thì phải có đúng một bài đỏ, không phải "bộ test vẫn xanh
 * với ít nhánh hơn".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HEARTBEAT_OPEN_AT_MINUTES,
  HEARTBEAT_SAFETY_MARGIN_MINUTES,
  HEARTBEAT_STALE_MINUTES,
  STEP0_PENDING_BRANCH_PREFIX,
  heartbeatAgeMinutes,
  isStep0PendingBranch,
  step0PendingBranch,
  step0PrGate,
  type Step0PrGateInput,
} from '../scripts/step0-pr-gate.ts';

const NOW = '2026-09-24T00:00:00.000Z';

/** Lượt log-only thuần: không push PR nào, không đổi gì ngoài dòng log. */
function input(overrides: Partial<Step0PrGateInput> = {}): Step0PrGateInput {
  return {
    pushedPrs: 0,
    changedBeyondOwnLogLine: false,
    lastHeartbeatOnMainAt: '2026-09-23T23:45:00.000Z', // 15 phút trước NOW
    now: NOW,
    ...overrides,
  };
}

/** `NOW` trừ đi `minutes` phút, dạng ISO. */
function minutesAgo(minutes: number): string {
  return new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
}

// ── Hằng số: ngưỡng phải khớp CHARTER 2.4, và khoảng an toàn phải thật sự trừ ──

test('ngưỡng nhịp tim là 180 phút — cùng con số CHARTER 2.4 giao cho watchdog.yml', () => {
  assert.equal(HEARTBEAT_STALE_MINUTES, 180);
});

test('mốc mở PR nằm TRƯỚC ngưỡng watchdog, không phải trùng ngưỡng', () => {
  // Ca âm của chính khoảng an toàn: đặt margin = 0 thì bài này đỏ. Mở PR
  // đúng lúc watchdog nổ là mở PR muộn — CI còn phải chạy xong rồi mới merge.
  assert.equal(HEARTBEAT_OPEN_AT_MINUTES, HEARTBEAT_STALE_MINUTES - HEARTBEAT_SAFETY_MARGIN_MINUTES);
  assert.ok(
    HEARTBEAT_OPEN_AT_MINUTES < HEARTBEAT_STALE_MINUTES,
    'mốc mở PR phải nhỏ hơn ngưỡng watchdog',
  );
  assert.ok(HEARTBEAT_SAFETY_MARGIN_MINUTES > 0, 'khoảng an toàn phải lớn hơn 0');
});

// ── heartbeatAgeMinutes ──

test('heartbeatAgeMinutes: đo đúng khoảng cách theo phút', () => {
  assert.equal(heartbeatAgeMinutes(minutesAgo(42), NOW), 42);
});

test('heartbeatAgeMinutes: null khi không có mốc, và null khi mốc không đọc được', () => {
  assert.equal(heartbeatAgeMinutes(null, NOW), null);
  assert.equal(heartbeatAgeMinutes('không phải ngày', NOW), null);
  assert.equal(heartbeatAgeMinutes(minutesAgo(10), 'không phải ngày'), null);
});

test('heartbeatAgeMinutes: mốc ở TƯƠNG LAI kẹp về 0, không trả số âm', () => {
  // Đã xảy ra thật: dòng log của PR #89 ghi `at` lệch về tương lai. Số âm ở
  // đây sẽ lặng lẽ thành "nhịp tim còn mới" mãi mãi — nhóm Z.
  assert.equal(heartbeatAgeMinutes(minutesAgo(-120), NOW), 0);
});

// ── Chiều tốn tiền: lượt log-only, nhịp tim còn mới → KHÔNG mở PR ──

test('log-only + nhịp tim còn mới → KHÔNG mở PR (chỉ dẫn chủ dự án trên #193)', () => {
  const decision = step0PrGate(input());
  assert.equal(decision.openPr, false);
  assert.equal(decision.reason, 'log-only-run');
  assert.equal(decision.heartbeatAgeMinutes, 15);
  assert.match(decision.note, /KHÔNG mở PR/);
});

test('log-only: sát dưới mốc vẫn KHÔNG mở PR — ranh giới đúng phía', () => {
  const decision = step0PrGate(input({ lastHeartbeatOnMainAt: minutesAgo(HEARTBEAT_OPEN_AT_MINUTES - 1) }));
  assert.equal(decision.openPr, false);
  assert.equal(decision.reason, 'log-only-run');
});

// ── Chiều gọi người: nhịp tim sắp quá hạn → PHẢI mở PR ──

test('log-only nhưng nhịp tim ĐÚNG mốc → mở PR, lý do heartbeat-due', () => {
  const decision = step0PrGate(input({ lastHeartbeatOnMainAt: minutesAgo(HEARTBEAT_OPEN_AT_MINUTES) }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'heartbeat-due');
  assert.equal(decision.heartbeatAgeMinutes, HEARTBEAT_OPEN_AT_MINUTES);
});

test('log-only nhưng nhịp tim đã quá ngưỡng watchdog → vẫn mở PR', () => {
  const decision = step0PrGate(input({ lastHeartbeatOnMainAt: minutesAgo(HEARTBEAT_STALE_MINUTES + 60) }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'heartbeat-due');
});

test('log-only + KHÔNG đọc được dòng bước 0 nào trên main → mở PR (hướng an toàn)', () => {
  const decision = step0PrGate(input({ lastHeartbeatOnMainAt: null }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'no-heartbeat-on-main');
  assert.equal(decision.heartbeatAgeMinutes, null);
});

test('log-only + mốc nhịp tim hỏng → mở PR, và KHÔNG giả vờ đo được tuổi', () => {
  const decision = step0PrGate(input({ lastHeartbeatOnMainAt: 'hôm qua' }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'heartbeat-unreadable');
  assert.equal(decision.heartbeatAgeMinutes, null);
});

// ── Lượt có việc thật: luật không áp, và không phụ thuộc phép đo nhịp tim ──

test('bước 0 đã push PR → mở PR, lý do work-done', () => {
  const decision = step0PrGate(input({ pushedPrs: 2 }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'work-done');
  assert.match(decision.note, /2 PR/);
});

test('bước 2 hoặc bước 3 làm việc thật → mở PR, lý do work-done', () => {
  const decision = step0PrGate(input({ changedBeyondOwnLogLine: true }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'work-done');
});

test('lượt có việc thật KHÔNG bị chặn bởi một phép đo nhịp tim hỏng', () => {
  // Ca âm quan trọng: nếu ai đó xếp phép đo nhịp tim lên TRƯỚC nhánh
  // work-done, một mốc hỏng sẽ đổi `reason` của lượt có việc thật, và ghi
  // chú lượt chạy sẽ kể sai lượt đó đã làm gì.
  const decision = step0PrGate(input({ changedBeyondOwnLogLine: true, lastHeartbeatOnMainAt: null }));
  assert.equal(decision.openPr, true);
  assert.equal(decision.reason, 'work-done');
});

test('PR bỏ lại vì aborted-ineligible KHÔNG phải việc thật — pushedPrs mới tính', () => {
  // Bỏ lại không tạo commit nào, nên PR vẫn là PR log. Nếu chỗ gọi truyền số
  // PR *xung đột* vào `pushedPrs` thì luật của chủ dự án bị vô hiệu đúng ở
  // những lượt tốn kém nhất.
  const decision = step0PrGate(input({ pushedPrs: 0 }));
  assert.equal(decision.openPr, false);
});

// ── Mọi quyết định đều phải nói ra lý do bằng tiếng Việt (cấm im lặng) ──

test('mọi nhánh quyết định đều mang note không rỗng', () => {
  const cases: Step0PrGateInput[] = [
    input(),
    input({ pushedPrs: 1 }),
    input({ changedBeyondOwnLogLine: true }),
    input({ lastHeartbeatOnMainAt: null }),
    input({ lastHeartbeatOnMainAt: 'hỏng' }),
    input({ lastHeartbeatOnMainAt: minutesAgo(HEARTBEAT_OPEN_AT_MINUTES) }),
  ];
  const reasons = new Set<string>();
  for (const one of cases) {
    const decision = step0PrGate(one);
    assert.ok(decision.note.trim().length > 0, `note rỗng cho ${JSON.stringify(one)}`);
    reasons.add(decision.reason);
  }
  // Cả năm lý do đều đạt tới được — một lý do không ca nào chạm tới là một
  // nhánh chết, và nhánh chết là chỗ luật lặng lẽ không áp.
  assert.deepEqual(
    [...reasons].sort(),
    ['heartbeat-due', 'heartbeat-unreadable', 'log-only-run', 'no-heartbeat-on-main', 'work-done'],
  );
});

// ── Nhánh chờ ──

test('step0PendingBranch: dùng lại mã log của kernel, một chỗ sinh cả hai tên', () => {
  const id = 'step0-2026-09-23T234252Z-crux-worker-1';
  assert.equal(step0PendingBranch(id), `${STEP0_PENDING_BRANCH_PREFIX}/${id}`);
  assert.ok(isStep0PendingBranch(step0PendingBranch(id)));
});

test('isStep0PendingBranch: không nhận nhầm nhánh làn integration bình thường', () => {
  assert.equal(isStep0PendingBranch('claude/integration/I-018'), false);
  assert.equal(isStep0PendingBranch('claude/visual/V-001'), false);
  // Tiền tố trần, không có dấu `/` sau, KHÔNG phải nhánh chờ — nếu nhận nhầm
  // thì lượt sau sẽ cherry-pick một nhánh việc thật vào PR của nó.
  assert.equal(isStep0PendingBranch(STEP0_PENDING_BRANCH_PREFIX), false);
  assert.equal(isStep0PendingBranch(`${STEP0_PENDING_BRANCH_PREFIX}-khac/x`), false);
});
