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
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OPEN_BOX,
  HOLD_MARKERS,
  hasHoldMarker,
  normalizeForHold,
  hasRevertCommit,
  parseBacklog,
  hasCompletionCommit,
  classify,
  heldReason,
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
  const item = { id: 'D-003', title: 'Mục chưa merge', status: 'review', hasHoldMarker: false, holdField: null, statusLine: 2 };
  assert.equal(classify(item, false), 'unmerged');
});

test('classify: đã merge mà còn ô ⬜ thì held, không stale', () => {
  const item = { id: 'D-002', title: 'Mục còn treo một phần', status: 'review', hasHoldMarker: true, holdField: null, statusLine: 2 };
  assert.equal(classify(item, true), 'held');
});

test('classify: đã merge và thân mục sạch thì stale', () => {
  const item = { id: 'D-001', title: 'Mục đã xong hẳn', status: 'review', hasHoldMarker: false, holdField: null, statusLine: 2 };
  assert.equal(classify(item, true), 'stale');
});

test('classify: có trường `- hold:` thì held dù thân mục sạch trơn (I-020)', () => {
  // Chỗ mà lưới lời văn không với tới: thân mục KHÔNG có dấu treo nào, nhưng
  // mục khai `- hold:` → nguồn quyết định là trường, giữ `review`.
  const item = { id: 'D-010', title: 'Giữ bằng trường', status: 'review', hasHoldMarker: false, holdField: 'chờ chủ dự án bật ruleset', statusLine: 2 };
  assert.equal(classify(item, true), 'held');
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
    { lane: 'demo', id: 'D-002', verdict: 'held', heldBy: 'prose' },
    { lane: 'demo', id: 'D-003', verdict: 'unmerged' },
    { lane: 'demo', id: 'D-005', verdict: 'held', heldBy: 'prose' },
    { lane: 'demo', id: 'D-006', verdict: 'unmerged' },
  ]);
});

test('parseBacklog: đọc trường `- hold:` — hoa/thường/thụt lề lệch đều nhận, lý do bị cắt khoảng trắng', () => {
  const content = [
    '### F-001 · Giữ bằng trường thường',
    '- status: review',
    '- hold: chờ chủ dự án bật ruleset',
    '',
    '### F-002 · HOA và thụt lề lệch',
    '- status: review',
    '  - HOLD:   chờ tập thật đầu tiên   ',
    '',
    '### F-003 · Không khai trường',
    '- status: review',
    '- deps: —',
    '',
    '### F-004 · Trường trống thì không tính',
    '- status: review',
    '- hold:',
    '',
  ].join('\n');
  const items = parseBacklog(content);
  assert.equal(items[0]!.holdField, 'chờ chủ dự án bật ruleset');
  assert.equal(items[1]!.holdField, 'chờ tập thật đầu tiên');
  assert.equal(items[2]!.holdField, null);
  assert.equal(items[3]!.holdField, null); // `- hold:` trống là khai thiếu, không phải một lời giữ
});

test('heldReason: trường thắng lời văn; không có cả hai thì null', () => {
  // Trường có → 'field', kể cả khi thân cũng có lời văn.
  assert.equal(heldReason({ holdField: 'chờ owner', hasHoldMarker: true }), 'field');
  assert.equal(heldReason({ holdField: 'chờ owner', hasHoldMarker: false }), 'field');
  // Chỉ lời văn → 'prose' (lưới dự phòng, và là nợ).
  assert.equal(heldReason({ holdField: null, hasHoldMarker: true }), 'prose');
  // Trường rỗng coi như không khai → rơi về lời văn.
  assert.equal(heldReason({ holdField: '', hasHoldMarker: true }), 'prose');
  // Không gì cả → null.
  assert.equal(heldReason({ holdField: null, hasHoldMarker: false }), null);
});

test('reviewFindings: heldBy tách mục giữ-bằng-trường khỏi mục giữ-bằng-lời (nợ)', () => {
  const content = [
    '### G-001 · Giữ bằng trường, thân sạch',
    '- status: review',
    '- hold: chờ tập thật đầu tiên',
    '',
    '### G-002 · Giữ bằng lời văn',
    '- status: review',
    `- ${OPEN_BOX} **còn treo:** một nhánh chưa quan sát`,
    '',
  ].join('\n');
  const subjects = ['[demo] G-001 — xong (#1)', '[demo] G-002 — xong (#2)'];
  assert.deepEqual(reviewFindings('demo', content, subjects), [
    { lane: 'demo', id: 'G-001', verdict: 'held', heldBy: 'field' },
    { lane: 'demo', id: 'G-002', verdict: 'held', heldBy: 'prose' },
  ]);
});

test('applyFix: mục khai `- hold:` không bao giờ bị lật, dù thân mục sạch trơn', () => {
  // Mục đã merge, thân KHÔNG có dấu treo lời văn nào — trước `I-020` sẽ bị lật
  // sang `done`. Có trường `- hold:` thì classify ra `held`, không phải `stale`,
  // nên applyFix (chỉ chạm mục `stale`) không đụng tới.
  const content = [
    '### H-001 · Đã merge nhưng giữ bằng trường',
    '- status: review',
    '- hold: chờ chạy thật xác nhận',
    '- tiêu chí xong: xong hết rồi, không câu treo nào',
    '',
  ].join('\n');
  const subjects = ['[demo] H-001 — xong (#1)'];
  const stale = reviewFindings('demo', content, subjects).filter((f) => f.verdict === 'stale').map((f) => f.id);
  assert.deepEqual(stale, []); // không có gì để lật
  const { content: next, changed } = applyFix(content, ['H-001']);
  assert.deepEqual(changed, []);
  assert.equal(next, content);
});

test('HOLD_MARKERS: bắt các câu chặn bằng LỜI, không chỉ ô ⬜', () => {
  // Bốn ca thật trên `main` mà vòng soát chéo bắt được: P-011, P-013, P-016, I-002.
  assert.equal(hasHoldMarker('Mục này chỉ đóng khi có xác nhận đó, không đóng khi PR merge.'), true);
  assert.equal(hasHoldMarker('mục này chỉ chuyển `done` khi một lần chạy routine đi trọn một mục'), true);
  assert.equal(hasHoldMarker('**Còn treo, ngoài phạm vi cơ chế:** hiển thị PR xung đột'), true);
  assert.equal(hasHoldMarker('**Chưa kiểm bằng chạy thật:** routine chưa gọi tool này'), true);
  assert.equal(hasHoldMarker(`còn ô ${OPEN_BOX} thôi`), true);
});

test('HOLD_MARKERS: ba biến thể lời văn lọt lưới lần hai — E-001, P-010, P-007', () => {
  // Ba ca THẬT trên `main` ở 402444b. Lượt `crux-worker-1` ~21:48Z chạy
  // `--fix` và lật cả ba sang `done` trong khi thân mục cấm đúng việc đó;
  // vòng soát chéo bắt lại. Đây là LẦN THỨ HAI cùng một chữ ký lỗi (lần một:
  // P-011, P-013, P-016, I-002 ở test ngay trên), nên CLAUDE.md mục 13 đòi
  // sửa cơ chế chứ không sửa tay ba dòng `status`.
  //
  // Vì sao ba câu này lọt: danh sách cũ có `'chỉ chuyển \`done\`'` và
  // `'chỉ đóng khi'`, nhưng cả ba câu dưới đây nói cùng một ý bằng chữ khác.

  // `editorial/E-001` — và đây là ca ĐẮT nhất: nó là `deps` của E-003, E-004,
  // rồi E-005, nên lật nhầm nó mở khoá cả một nhánh việc chưa được phép chạy.
  assert.equal(
    hasHoldMarker('Đó là khác biệt so với bản ghi trước — nhưng mục này vẫn **không** tự chuyển `done`.'),
    true,
  );

  // `platform/P-010` — hẹn một bằng chứng chưa tồn tại (lần `ops/workflows/**`
  // đổi kế tiếp). Lật sang `done` là xoá luôn mốc hẹn, không ai quay lại.
  assert.equal(
    hasHoldMarker('**Lượt worker sau phải đọc đúng lần chạy thật đó trước khi coi mục này `done`**'),
    true,
  );
  // Chuỗi cho ca này cố ý BỎ hai chữ "trước khi" của câu gốc, nên biến thể sát
  // nghĩa dưới đây cũng bắt được. Vòng soát ngữ cảnh sạch nêu đúng chỗ này:
  // giữ nguyên cả câu là vá đúng một ca.
  assert.equal(hasHoldMarker('đừng coi mục này `done` khi PR merge'), true);

  // `platform/P-007` — nêu thẳng lý do giữ `review`, chỉ khác chữ: `done` thay
  // cho `đóng`.
  assert.equal(
    hasHoldMarker('vì sao `review` chứ không `done`: mục này chỉ `done` khi bản tin **thật** in ra mục xung đột'),
    true,
  );
});

test('HOLD_MARKERS: ba biến thể lần ba nay đã vào lưới dự phòng (I-020)', () => {
  // Trước `I-020` bài này ghim ba biến thể ở hướng ÂM (`false`) làm thước đo nợ
  // còn lại của cách dò chuỗi con. `I-020` trả hai thứ:
  //   1. Nguồn quyết định chuyển sang TRƯỜNG `- hold:` (xem các bài `heldReason`
  //      và `classify … trường` dưới đây) — nên `HOLD_MARKERS` không còn phải
  //      hội tụ, nó chỉ là lưới dự phòng.
  //   2. Vì đã là lưới dự phòng, ba biến thể ĐÃ BIẾT này được nới vào lưới ở
  //      hướng an toàn (giữ lại nhầm), nên ba `assert` đổi từ `false` sang
  //      `true` — tiêu chí xong đo được của mục.
  assert.equal(hasHoldMarker('trước khi coi mục này là `done`'), true);
  assert.equal(hasHoldMarker('mục này chỉ done khi có xác nhận'), true); // `done` viết trần
  assert.equal(hasHoldMarker('mục này chưa đóng, dù PR đã merge'), true);
});

test('normalizeForHold: dấu nhấn Markdown và ngắt dòng không còn che được câu treo', () => {
  // Ca `P-007` lọt lưới lần hai CHỈ vì hai dấu nháy ngược quanh `done`. Sau
  // chuẩn hoá, `` `done` `` và `done` là một chữ, nên cả một lớp biến thể tan
  // đi thay vì được vá từng chuỗi một.
  assert.equal(normalizeForHold('chỉ `done` khi'), 'chỉ done khi');
  assert.equal(normalizeForHold('**Còn   treo**'), 'còn treo');
  // Câu treo bị ngắt dòng giữa hai chữ — thân mục thật xuống dòng ở cột 100,
  // nên đây là ca thật, không phải ca dựng.
  assert.equal(hasHoldMarker('mục này chỉ đóng\nkhi có xác nhận'), true);
});

test('nợ lời văn của backlog THẬT phải ở 0 — máy canh, không chỉ in ra', () => {
  // Tiêu chí xong của `I-020` đòi con số `heldByProse` "nhìn thấy được thì mới
  // trả được". Chỉ IN ra là chưa đủ: gỡ hai dòng `- hold:` khỏi backlog thật
  // thì **0 bài test đỏ** — đúng nhóm Z (hỏng mà mọi chỉ báo đều xanh) mà
  // chính mục này sinh ra để giết.
  //
  // Nên bài này đọc backlog THẬT. Nó cố tình dễ vỡ theo đúng một hướng: thêm
  // một mục còn treo mà quên `- hold:` thì CI đỏ, KÈM TÊN MỤC. Cách chữa luôn
  // là khai trường, không phải nới bài kiểm.
  //
  // Chỉ soát mục ở `review` — cùng phạm vi `reviewFindings` — nên mục `ready`
  // hay `done` không kéo bài này đỏ.
  const lanesRoot = join(import.meta.dirname, '..', 'lanes');
  const proseOnly: string[] = [];
  for (const lane of readdirSync(lanesRoot)) {
    let content: string;
    try {
      content = readFileSync(join(lanesRoot, lane, 'backlog.md'), 'utf8');
    } catch {
      continue;
    }
    for (const item of parseBacklog(content)) {
      if (item.status !== 'review') continue;
      if (heldReason(item) === 'prose') proseOnly.push(`${lane}/${item.id}`);
    }
  }
  assert.deepEqual(
    proseOnly,
    [],
    `mục còn treo mà chưa khai \`- hold:\`: ${proseOnly.join(', ')} — khai trường cho chúng, đừng nới bài kiểm`,
  );
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
    classify({ id: 'D-009', title: 'Không có status', status: '', hasHoldMarker: false, holdField: null, statusLine: null }, true),
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
