/**
 * `ops/scripts/backlog-status.ts` — cơ chế của mục `I-010`.
 *
 * Chỉ kiểm các hàm thuần. Lớp `main()` đọc thư mục và gọi `git log`; phần
 * `git log` được kiểm riêng qua `readMainSubjects` trên chính kho này, vì
 * đó là thứ duy nhất trong file có thể im lặng trả về rỗng và làm cả tool
 * kết luận "chưa merge gì cả" mà không có gì đỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPEN_BOX,
  parseBacklog,
  hasCompletionCommit,
  classify,
  reviewFindings,
  applyFix,
  readMainSubjects,
} from '../scripts/backlog-status.ts';

const BACKLOG = [
  '# 🤖 Backlog làn `demo`',
  '',
  '### D-001 · Mục đã xong hẳn',
  '- deps: —',
  '- status: review',
  '- tiêu chí xong: xong rồi',
  '',
  '### D-002 · Mục còn treo một phần',
  '- deps: —',
  '- status: review',
  `- ✅ phần chính xong; ${OPEN_BOX} **còn treo:** một nhánh chưa quan sát được`,
  '',
  '### D-003 · Mục chưa merge',
  '- deps: —',
  '- status: review',
  '',
  '### D-004 · Mục còn trong hàng đợi',
  '- deps: —',
  '- status: ready',
  '',
].join('\n');

test('parseBacklog: tách đúng mã mục, status và ô còn treo', () => {
  const items = parseBacklog(BACKLOG);
  assert.deepEqual(
    items.map((i) => [i.id, i.status, i.hasOpenBox]),
    [
      ['D-001', 'review', false],
      ['D-002', 'review', true],
      ['D-003', 'review', false],
      ['D-004', 'ready', false],
    ],
  );
});

test('parseBacklog: mục không khai status thì statusLine là null, không đoán', () => {
  const items = parseBacklog('### D-009 · Không có status\n- deps: —\n');
  assert.equal(items.length, 1);
  assert.equal(items[0]!.statusLine, null);
  assert.equal(items[0]!.status, '');
});

test('hasCompletionCommit: khớp đúng dạng tiêu đề của phụ lục P1 bước 4', () => {
  const subjects = ['[integration] I-008 — fixture của sáu xưởng nạp pack thật, không chép (#40)'];
  assert.equal(hasCompletionCommit('integration', 'I-008', subjects), true);
});

test('hasCompletionCommit: mã mục phải đứng trọn — VF-G1 không ăn theo VF-G11', () => {
  const subjects = ['[verify] VF-G11 — Hook và luật deny có hiệu lực trong routine không (#33)'];
  assert.equal(hasCompletionCommit('verify', 'VF-G11', subjects), true);
  assert.equal(hasCompletionCommit('verify', 'VF-G1', subjects), false);
});

test('hasCompletionCommit: commit chỉ NHẮC mã mục trong ngoặc không tính là hoàn thành', () => {
  // Ca thật đang nằm trên `main`: PR của mục khác có chạm `P-015`.
  const subjects = [
    'platform: file log dùng chung không còn sinh xung đột mỗi PR (KF-005, P-015) (#13)',
    'platform: rà soát nhóm "hỏng mà mọi chỉ báo đều xanh" (P-014) (#12)',
  ];
  assert.equal(hasCompletionCommit('platform', 'P-015', subjects), false);
  assert.equal(hasCompletionCommit('platform', 'P-014', subjects), false);
});

test('hasCompletionCommit: sai làn thì không khớp', () => {
  const subjects = ['[topic] T-002 — chuyển Channel Pack từ spec vào packs/channels/ (#38)'];
  assert.equal(hasCompletionCommit('topic', 'T-002', subjects), true);
  assert.equal(hasCompletionCommit('editorial', 'T-002', subjects), false);
});

test('classify: chưa merge thì luôn unmerged, kể cả khi thân mục sạch', () => {
  assert.equal(classify({ id: 'D-003', status: 'review', hasOpenBox: false, statusLine: 2 }, false), 'unmerged');
});

test('classify: đã merge mà còn ô ⬜ thì held, không stale', () => {
  assert.equal(classify({ id: 'D-002', status: 'review', hasOpenBox: true, statusLine: 2 }, true), 'held');
});

test('classify: đã merge và thân mục sạch thì stale', () => {
  assert.equal(classify({ id: 'D-001', status: 'review', hasOpenBox: false, statusLine: 2 }, true), 'stale');
});

test('reviewFindings: chỉ soát mục đang review, và phân đúng ba nhóm', () => {
  const subjects = ['[demo] D-001 — xong (#1)', '[demo] D-002 — xong phần chính (#2)'];
  assert.deepEqual(reviewFindings('demo', BACKLOG, subjects), [
    { lane: 'demo', id: 'D-001', verdict: 'stale' },
    { lane: 'demo', id: 'D-002', verdict: 'held' },
    { lane: 'demo', id: 'D-003', verdict: 'unmerged' },
  ]);
});

test('applyFix: chỉ đổi dòng status của đúng mục được nêu', () => {
  const { content, changed } = applyFix(BACKLOG, ['D-001']);
  assert.deepEqual(changed, ['D-001']);
  assert.match(content, /### D-001 · Mục đã xong hẳn\n- deps: —\n- status: done\n/);
  // Các mục khác không bị chạm.
  assert.match(content, /### D-002 · Mục còn treo một phần\n- deps: —\n- status: review\n/);
  assert.match(content, /### D-003 · Mục chưa merge\n- deps: —\n- status: review\n/);
  assert.match(content, /### D-004 · Mục còn trong hàng đợi\n- deps: —\n- status: ready\n/);
});

test('applyFix: mục không còn ở review thì bỏ qua, không ghi đè', () => {
  const { content, changed } = applyFix(BACKLOG, ['D-004']);
  assert.deepEqual(changed, []);
  assert.equal(content, BACKLOG);
});

test('applyFix: mã mục không có trong file thì không đổi gì', () => {
  const { content, changed } = applyFix(BACKLOG, ['D-999']);
  assert.deepEqual(changed, []);
  assert.equal(content, BACKLOG);
});

test('readMainSubjects: đọc được lịch sử thật, không trả rỗng im lặng', () => {
  const subjects = readMainSubjects();
  assert.ok(subjects.length > 0, 'lịch sử main rỗng — tool sẽ kết luận sai là chưa merge gì');
  assert.ok(
    subjects.every((s) => s.length > 0),
    'có tiêu đề rỗng lọt vào danh sách',
  );
});
