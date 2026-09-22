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
  HOLD_MARKERS,
  hasHoldMarker,
  hasRevertCommit,
  parseBacklog,
  hasCompletionCommit,
  classify,
  reviewFindings,
  applyFix,
  readMainSubjects,
  parseDeps,
  readyQueue,
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
  '### D-005 · Mục chặn bằng LỜI, không bằng ký hiệu',
  '- deps: —',
  '- status: review',
  '- tiêu chí xong:',
  '  - **Kiểm bằng chạy thật:** xác nhận thông báo tới điện thoại. Mục này chỉ đóng khi có',
  '    xác nhận đó, không đóng khi PR merge.',
  '',
  '### D-006 · Mục đã merge rồi bị revert',
  '- deps: —',
  '- status: review',
  '',
].join('\n');

test('parseBacklog: tách đúng mã mục, status và ô còn treo', () => {
  const items = parseBacklog(BACKLOG);
  assert.deepEqual(
    items.map((i) => [i.id, i.status, i.hasHoldMarker]),
    [
      ['D-001', 'review', false],
      ['D-002', 'review', true],
      ['D-003', 'review', false],
      ['D-004', 'ready', false],
      ['D-005', 'review', true],
      ['D-006', 'review', false],
    ],
  );
});

test('parseBacklog: tên mục lấy từ tiêu đề, bỏ dấu `·` — bản tin ngày cần nó (P-005)', () => {
  const items = parseBacklog(BACKLOG);
  assert.equal(items[0]!.title, 'Mục đã xong hẳn');
  assert.equal(items[4]!.title, 'Mục chặn bằng LỜI, không bằng ký hiệu');
  // Tiêu đề chỉ có mã mục: chuỗi rỗng, không phải `undefined` — bên gọi in
  // ra một dòng cụt còn hơn một dòng `undefined`.
  assert.equal(parseBacklog('### D-100\n- status: ready\n')[0]!.title, '');
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
  const item = { id: 'D-003', title: 'Mục chưa merge', status: 'review', hasHoldMarker: false, statusLine: 2, deps: [] };
  assert.equal(classify(item, false), 'unmerged');
});

test('classify: đã merge mà còn ô ⬜ thì held, không stale', () => {
  const item = { id: 'D-002', title: 'Mục còn treo một phần', status: 'review', hasHoldMarker: true, statusLine: 2, deps: [] };
  assert.equal(classify(item, true), 'held');
});

test('classify: đã merge và thân mục sạch thì stale', () => {
  const item = { id: 'D-001', title: 'Mục đã xong hẳn', status: 'review', hasHoldMarker: false, statusLine: 2, deps: [] };
  assert.equal(classify(item, true), 'stale');
});

test('reviewFindings: chỉ soát mục đang review, và phân đúng các nhóm', () => {
  const subjects = [
    'Revert "[demo] D-006 — xong (#6)"',
    '[demo] D-006 — xong (#6)',
    '[demo] D-005 — xong (#5)',
    '[demo] D-001 — xong (#1)',
    '[demo] D-002 — xong phần chính (#2)',
  ];
  assert.deepEqual(reviewFindings('demo', BACKLOG, subjects), [
    { lane: 'demo', id: 'D-001', verdict: 'stale' },
    { lane: 'demo', id: 'D-002', verdict: 'held' },
    { lane: 'demo', id: 'D-003', verdict: 'unmerged' },
    { lane: 'demo', id: 'D-005', verdict: 'held' },
    { lane: 'demo', id: 'D-006', verdict: 'unmerged' },
  ]);
});

test('HOLD_MARKERS: bắt các câu chặn bằng LỜI, không chỉ ô ⬜', () => {
  // Bốn ca thật trên `main` mà vòng soát chéo bắt được: P-011, P-013, P-016, I-002.
  assert.equal(hasHoldMarker('Mục này chỉ đóng khi có xác nhận đó, không đóng khi PR merge.'), true);
  assert.equal(hasHoldMarker('mục này chỉ chuyển `done` khi một lần chạy routine đi trọn một mục'), true);
  assert.equal(hasHoldMarker('**Còn treo, ngoài phạm vi cơ chế:** hiển thị PR xung đột'), true);
  assert.equal(hasHoldMarker('**Chưa kiểm bằng chạy thật:** routine chưa gọi tool này'), true);
  assert.equal(hasHoldMarker(`còn ô ${OPEN_BOX} thôi`), true);
});

test('HOLD_MARKERS: "Chưa làm, cố ý" KHÔNG phải dấu treo — đó là loại trừ phạm vi', () => {
  // Ca thật: `I-003` đóng được dù có câu này.
  assert.equal(hasHoldMarker('**Chưa làm, cố ý:** lệnh không nằm trong `pnpm check`.'), false);
});

test('HOLD_MARKERS: mục bình thường không dính dấu treo nào', () => {
  assert.equal(hasHoldMarker('- deps: —\n- status: review\n- tiêu chí xong: có test và CI xanh'), false);
  assert.ok(HOLD_MARKERS.length >= 5);
});

test('hasRevertCommit: mục bị revert thì không còn tính là đã xong', () => {
  const subjects = ['Revert "[demo] D-006 — xong (#6)"', '[demo] D-006 — xong (#6)'];
  assert.equal(hasRevertCommit('demo', 'D-006', subjects), true);
  assert.equal(hasRevertCommit('demo', 'D-001', subjects), false);
});

test('classify: mục không đọc được status ra unknown, không bị lọc đi im lặng', () => {
  assert.equal(
    classify({ id: 'D-009', title: 'Không có status', status: '', hasHoldMarker: false, statusLine: null, deps: [] }, true),
    'unknown',
  );
  const findings = reviewFindings('demo', '### D-009 · Không có status\n- deps: —\n', []);
  assert.deepEqual(findings, [{ lane: 'demo', id: 'D-009', verdict: 'unknown' }]);
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

// ---------------------------------------------------------------------------
// `deps` và hàng đợi nhận được ngay — mục `I-015`.
// ---------------------------------------------------------------------------

test('parseDeps: `—` và dòng trống nghĩa là không chờ ai', () => {
  assert.deepEqual(parseDeps('—'), []);
  assert.deepEqual(parseDeps('-'), []);
  assert.deepEqual(parseDeps('   '), []);
});

test('parseDeps: cắt ở dấu phẩy, giữ nguyên văn từng đoạn', () => {
  assert.deepEqual(parseDeps('V-001, AU-004'), [
    { raw: 'V-001', id: 'V-001' },
    { raw: 'AU-004', id: 'AU-004' },
  ]);
});

test('parseDeps: KHÔNG cắt ở dấu `·` — đó là lời giải thích, không phải phần phụ thuộc', () => {
  // Ca thật: `visual/V-004` ghi `- deps: V-003 · bộ công cụ đã có ở …`.
  // Cắt ở `·` sinh ra một đoạn toàn lời văn, và `V-004` chờ vĩnh viễn.
  const deps = parseDeps('V-003 · bộ công cụ đã có ở `docs/visual/calibration.md`');
  assert.equal(deps.length, 1);
  assert.equal(deps[0]!.id, 'V-003');
});

test('parseDeps: đọc được các dạng mã đang dùng thật, kể cả trong dấu nháy ngược', () => {
  assert.equal(parseDeps('`I-013`')[0]!.id, 'I-013');
  assert.equal(parseDeps('VF-G13')[0]!.id, 'VF-G13');
  assert.equal(parseDeps('V-004b')[0]!.id, 'V-004b');
  assert.equal(parseDeps('G7')[0]!.id, 'G7');
});

test('parseDeps: đoạn không chứa mã nào thì id là null, KHÔNG bị bỏ qua im lặng', () => {
  const deps = parseDeps('xong phần nền đã');
  assert.equal(deps.length, 1);
  assert.equal(deps[0]!.id, null);
  assert.equal(deps[0]!.raw, 'xong phần nền đã');
});

test('parseBacklog: `deps` đi kèm mục', () => {
  const items = parseBacklog('### D-020 · Có deps\n- deps: D-001, D-002\n- status: ready\n');
  assert.deepEqual(
    items[0]!.deps?.map((d) => d.id),
    ['D-001', 'D-002'],
  );
});

const QUEUE_DEMO = [
  '### D-001 · Nền móng đã done',
  '- deps: —',
  '- status: done',
  '',
  '### D-002 · Nền móng đã vào main mà còn review',
  '- deps: —',
  '- status: review',
  '',
  '### D-003 · Nền móng đã vào main nhưng còn treo',
  '- deps: —',
  '- status: review',
  `- ${OPEN_BOX} **còn treo:** một nhánh chưa quan sát được`,
  '',
  '### D-004 · Nền móng chưa vào main',
  '- deps: —',
  '- status: review',
  '',
  '### D-010 · Chờ mục done',
  '- deps: D-001',
  '- status: ready',
  '',
  '### D-011 · Chờ mục stale',
  '- deps: D-002',
  '- status: ready',
  '',
  '### D-012 · Chờ mục held',
  '- deps: D-003',
  '- status: ready',
  '',
  '### D-013 · Chờ mục chưa merge',
  '- deps: D-004',
  '- status: ready',
  '',
  '### D-014 · Chờ một đoạn không tra được',
  '- deps: xong phần nền đã',
  '- status: ready',
  '',
  '### D-015 · Chờ một mã không có mục nào',
  '- deps: D-999',
  '- status: ready',
  '',
  '### D-016 · Không chờ ai',
  '- deps: —',
  '- status: ready',
  '',
  '### D-017 · Đã parked',
  '- deps: —',
  '- status: parked',
  '',
  '### D-018 · Chờ một giả định viết dạng trần',
  '- deps: G7',
  '- status: ready',
  '',
].join('\n');

const QUEUE_VERIFY = ['### VF-G7 · Giả định còn parked', '- deps: —', '- status: parked', ''].join(
  '\n',
);

/** `D-002` và `D-003` đã vào `main`; `D-004` thì chưa. */
const QUEUE_SUBJECTS = ['[demo] D-002 — xong', '[demo] D-003 — xong phần chính'];

function demoQueue() {
  return readyQueue(
    [
      { lane: 'demo', content: QUEUE_DEMO },
      { lane: 'verify', content: QUEUE_VERIFY },
    ],
    QUEUE_SUBJECTS,
  );
}

test('readyQueue: mục `ready` có deps đã xong thì nhận được ngay', () => {
  const ids = demoQueue().readyNow.map((e) => `${e.lane}/${e.id}`);
  // `D-011` là điểm của cả mục `I-015`: deps của nó còn `review` trong file,
  // nhưng đã vào `main` thật (`stale`), nên nó KHÔNG được chặn.
  assert.deepEqual(ids, ['demo/D-010', 'demo/D-011', 'demo/D-016']);
});

test('readyQueue: deps còn treo (`held`) thì KHÔNG mở khoá', () => {
  // Hướng lệch an toàn của `I-010`: mục đã merge nhưng thân còn dấu treo là
  // mục chưa xong. Ba trong bốn ca `held` lịch sử đều là cổng.
  const blocked = demoQueue().blocked.find((e) => e.id === 'D-012');
  assert.deepEqual(blocked?.waitingOn, ['demo/D-003']);
});

test('readyQueue: deps chưa vào main thì KHÔNG mở khoá', () => {
  assert.deepEqual(
    demoQueue().blocked.find((e) => e.id === 'D-013')?.waitingOn,
    ['demo/D-004'],
  );
});

test('readyQueue: deps không tra được thì mục bị chặn VÀ hiện ra kèm lý do', () => {
  const queue = demoQueue();
  assert.equal(
    queue.readyNow.some((e) => e.id === 'D-014' || e.id === 'D-015'),
    false,
  );
  assert.deepEqual(queue.blocked.find((e) => e.id === 'D-014')?.waitingOn, [
    'xong phần nền đã (không tra được)',
  ]);
  assert.deepEqual(queue.blocked.find((e) => e.id === 'D-015')?.waitingOn, [
    'D-999 (không có mục này)',
  ]);
});

test('readyQueue: `deps: G7` tra về `verify/VF-G7`, và in ra mã mục THẬT', () => {
  // Quy ước đang dùng thật: `audio/AU-001` ghi `deps: G7`.
  assert.deepEqual(demoQueue().blocked.find((e) => e.id === 'D-018')?.waitingOn, ['verify/VF-G7']);
});

test('readyQueue: mục không ở `ready` không bao giờ vào hàng đợi', () => {
  const queue = demoQueue();
  const seen = [...queue.readyNow, ...queue.blocked].map((e) => e.id);
  for (const id of ['D-001', 'D-002', 'D-003', 'D-004', 'D-017']) {
    assert.equal(seen.includes(id), false, `${id} không được xuất hiện trong hàng đợi`);
  }
});

test('readyQueue: dựng lại cặp `T-001`/`T-003` đã suýt làm worker in `idle`', () => {
  // Lượt `crux-worker-1` ngày 2026-09-22 suýt in `idle` vì `T-001` đã merge
  // mà backlog còn đọc là `review`. Phép thử này dựng lại đúng cặp đó.
  const topic = [
    '### T-001 · Nền móng đã vào main',
    '- deps: —',
    '- status: review',
    '',
    '### T-003 · Kho ảnh chụp dữ liệu có phiên bản',
    '- deps: T-001',
    '- status: ready',
    '',
  ].join('\n');
  const queue = readyQueue([{ lane: 'topic', content: topic }], ['[topic] T-001 — nền móng (#57)']);
  assert.deepEqual(
    queue.readyNow.map((e) => e.id),
    ['T-003'],
  );
});

test('parseDeps: một đoạn chứa NHIỀU mã thì lấy tất cả, không lấy mỗi mã đầu', () => {
  // Lấy mã đầu là lệch về hướng nguy hiểm: mở khoá một mục trong khi một
  // nền móng khác của nó chưa xong. `ops/lanes/README.md` cho phép viết lời
  // giải thích sau dấu `·`, nên đoạn hai mã là ca sẽ tới.
  assert.deepEqual(
    parseDeps('V-003 · cùng với V-002').map((d) => d.id),
    ['V-003', 'V-002'],
  );
});

test('parseBacklog: KHÔNG khai `deps` khác hẳn `deps: —`', () => {
  assert.deepEqual(parseBacklog('### D-022 · Có dòng deps\n- deps: —\n- status: ready\n')[0]!.deps, []);
  assert.equal(parseBacklog('### D-023 · Không có dòng deps\n- status: ready\n')[0]!.deps, null);
  // Thụt lề sai là ca thật làm dòng `deps` biến mất — `DEPS` neo ở cột 0.
  assert.equal(parseBacklog('### D-024 · Deps thụt lề\n  - deps: D-001\n- status: ready\n')[0]!.deps, null);
});

test('readyQueue: mục không khai `deps` bị CHẶN và nói rõ lý do, không tự mở khoá', () => {
  const queue = readyQueue(
    [{ lane: 'demo', content: '### D-030 · Quên khai deps\n- status: ready\n' }],
    [],
  );
  assert.deepEqual(queue.readyNow, []);
  assert.deepEqual(queue.blocked[0]?.waitingOn, ['không khai `deps`']);
});

test('readyQueue: hai làn dùng chung một mã thì in ra, không im lặng', () => {
  const queue = readyQueue(
    [
      { lane: 'alpha', content: '### D-040 · Mục của alpha\n- deps: —\n- status: ready\n' },
      { lane: 'beta', content: '### D-040 · Mục trùng mã ở beta\n- deps: —\n- status: ready\n' },
    ],
    [],
  );
  assert.deepEqual(queue.duplicateIds, ['alpha/D-040 ↔ beta/D-040']);
});

test('readyQueue: mã trùng giữa hai làn KHÔNG mở khoá mục phụ thuộc', () => {
  // Ca tái hiện lỗi do vòng soát ngữ cảnh sạch của PR #112 tìm ra.
  //
  // `deps` không phân giải theo làn. Trước bản sửa, mục gặp TRƯỚC thắng chỗ
  // trong index và mục cùng mã ở làn sau bị `continue` bỏ qua — nên
  // `beta/D-052` (deps: D-051) được mở khoá nhờ `alpha/D-051` đã vào `main`,
  // trong khi `beta/D-051` — nền móng thật của nó — còn `ready`.
  //
  // Đó là đúng hướng lệch nguy hiểm mà chính file này dựng lên để tránh:
  // nhận một mục mà nền móng của nó chưa có. Chưa chắc thì coi là CHƯA xong.
  const queue = readyQueue(
    [
      { lane: 'alpha', content: '### D-051 · Mục của alpha\n- deps: —\n- status: review\n' },
      {
        lane: 'beta',
        content: [
          '### D-051 · Mục trùng mã ở beta, CHƯA xong',
          '- deps: —',
          '- status: ready',
          '',
          '### D-052 · Mục phụ thuộc D-051',
          '- deps: D-051',
          '- status: ready',
          '',
        ].join('\n'),
      },
    ],
    ['[alpha] D-051 — xong (#1)'],
  );

  assert.deepEqual(queue.duplicateIds, ['alpha/D-051 ↔ beta/D-051']);
  assert.deepEqual(
    queue.readyNow.map((e) => `${e.lane}/${e.id}`),
    ['beta/D-051'],
    '`beta/D-052` KHÔNG được vào readyNow khi mã `D-051` còn trùng giữa hai làn',
  );
  const blocked = queue.blocked.find((e) => e.id === 'D-052');
  assert.deepEqual(blocked?.waitingOn, ['D-051 (mã trùng giữa hai làn)']);
});

test('parseDeps: một đoạn có NHIỀU mã ra đủ từng phần, không chỉ mã đầu', () => {
  // Chốt điều mà chú thích của `parseDeps` khai: lấy MỌI mã trong đoạn.
  // Chỉ lấy mã đầu sẽ bỏ quên `I-014` và mở khoá sớm một nhịp.
  assert.deepEqual(
    parseDeps('I-013 và I-014').map((d) => d.id),
    ['I-013', 'I-014'],
  );
});

test('readMainSubjects: kho NÔNG thì ném, không trả danh sách cụt', () => {
  // Ca thật đã đo ngày 2026-09-22: phiên cloud clone nông, `git log` đọc
  // được 50 trên 86 tiêu đề, và 6 mục đã `done` không thấy commit của mình.
  // Trả danh sách cụt ở đây làm mọi mục phụ thuộc chúng biến mất khỏi
  // `readyNow` mà không gì đỏ.
  const origin = tempRepo(['[demo] D-001 — xong', '[demo] D-002 — xong'], 'main');
  const dir = mkdtempSync(join(tmpdir(), 'backlog-shallow-'));
  try {
    const clone = spawnSync('git', ['clone', '--depth', '1', `file://${origin}`, dir], {
      encoding: 'utf8',
    });
    assert.equal(clone.status, 0, clone.stderr);
    assert.throws(() => readMainSubjects(dir), /nông \(shallow\)/);
  } finally {
    rmSync(origin, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});
