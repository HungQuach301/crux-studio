/**
 * `ops/scripts/backlog-status.ts` — cơ chế của mục `I-010`.
 *
 * Chỉ kiểm các hàm thuần, cộng `readMainSubjects` — thứ duy nhất trong file
 * có thể im lặng trả về rỗng và làm cả tool kết luận "chưa merge gì cả" mà
 * không có gì đỏ.
 *
 * `readMainSubjects` được kiểm trên **kho git tạm dựng riêng cho phép thử**,
 * không phải trên chính kho này. Lý do đã đo bằng chạy thật: CI checkout ở
 * trạng thái detached và **không có** ref `origin/main` lẫn `main`, nên một
 * phép thử dựa vào kho hiện tại xanh ở máy và đỏ ở CI — đúng loại phép thử
 * đo môi trường thay vì đo hành vi. Kho tạm cho cả hai chiều: có `main` thì
 * đọc đúng, không có ref nào thì **ném lỗi** chứ không trả rỗng.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/** Kho git tạm, tối thiểu, không đụng tới kho đang làm việc. */
function tempRepo(commitSubjects: readonly string[], branch: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'backlog-status-'));
  const git = (...args: string[]) => {
    const r = spawnSync(
      'git',
      ['-c', 'user.email=test@example.com', '-c', 'user.name=test', ...args],
      { cwd: dir, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  git('init', '--quiet', '--initial-branch', 'work');
  for (const subject of commitSubjects) {
    git('commit', '--quiet', '--allow-empty', '-m', subject);
  }
  if (branch !== null) git('branch', branch);
  return dir;
}

test('readMainSubjects: đọc đúng tiêu đề commit của main, không trả rỗng im lặng', () => {
  const dir = tempRepo(['[demo] D-001 — xong', '[demo] D-002 — xong phần chính'], 'main');
  try {
    const subjects = readMainSubjects(dir);
    // Mới nhất trước, đúng thứ tự `git log`.
    assert.deepEqual(subjects, ['[demo] D-002 — xong phần chính', '[demo] D-001 — xong']);
    assert.ok(
      subjects.every((s) => s.length > 0),
      'có tiêu đề rỗng lọt vào danh sách',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readMainSubjects: không có ref main thì NÉM LỖI, không trả rỗng', () => {
  // Ca thật: CI checkout detached, không có origin/main lẫn main. Trả rỗng ở
  // đây sẽ làm tool kết luận "chưa mục nào merge" và im lặng bỏ sót tất cả.
  const dir = tempRepo(['[demo] D-001 — xong'], null);
  try {
    assert.throws(() => readMainSubjects(dir), /không đọc được lịch sử/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
