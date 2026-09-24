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
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OPEN_BOX,
  HOLD_MARKERS,
  hasHoldMarker,
  parseHoldField,
  normalizeForHold,
  heldBy,
  hasRevertCommit,
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
  const item = { id: 'D-003', title: 'Mục chưa merge', status: 'review', hold: null, hasHoldMarker: false, statusLine: 2 };
  assert.equal(classify(item, false), 'unmerged');
});

test('classify: đã merge mà còn ô ⬜ thì held, không stale', () => {
  const item = { id: 'D-002', title: 'Mục còn treo một phần', status: 'review', hold: null, hasHoldMarker: true, statusLine: 2 };
  assert.equal(classify(item, true), 'held');
});

test('classify: đã merge và thân mục sạch thì stale', () => {
  const item = { id: 'D-001', title: 'Mục đã xong hẳn', status: 'review', hold: null, hasHoldMarker: false, statusLine: 2 };
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
    // `heldBy` nói rõ cái gì đang giữ mục lại (mục `I-020`). Cả hai mục này
    // giữ bằng LỜI VĂN — chúng là fixture viết trước khi có trường `- hold:`.
    { lane: 'demo', id: 'D-002', verdict: 'held', heldBy: 'prose' },
    { lane: 'demo', id: 'D-003', verdict: 'unmerged' },
    { lane: 'demo', id: 'D-005', verdict: 'held', heldBy: 'prose' },
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

test('HOLD_MARKERS: ba biến thể từng lọt lưới nay bị bắt — mục I-020 đã xong', () => {
  // Ba `assert` này ĐÃ TỪNG là `false`, và chúng là thước đo của mục
  // `integration/I-020`: chừng nào lưới còn dò **chuỗi con**, chèn đúng một
  // chữ vào giữa là trượt. Nay lưới dò **mẫu trên văn bản đã chuẩn hoá**, nên
  // cả ba bị bắt.
  //
  // ⚠️ Bắt được ba câu này KHÔNG có nghĩa lưới đã hội tụ — câu thứ tư viết
  // bằng chữ khác nữa vẫn lọt, và đó là lý do nguồn quyết định nay là TRƯỜNG
  // `- hold:` (xem bộ test ngay dưới), không phải lưới này.

  // "là" chèn vào giữa: chuỗi con `coi mục này done` đòi hai chữ liền nhau.
  assert.equal(hasHoldMarker('trước khi coi mục này là `done`'), true);
  // `done` viết trần: chuỗi con `chỉ \`done\` khi` đòi đúng hai dấu nháy ngược.
  assert.equal(hasHoldMarker('mục này chỉ done khi có xác nhận'), true);
  // "chưa đóng": không có `done` nào để neo vào, không chuỗi con nào phủ.
  assert.equal(hasHoldMarker('mục này chưa đóng, dù PR đã merge'), true);
});

test('normalizeForHold: dấu nhấn Markdown và ngắt dòng không còn che được câu treo', () => {
  // Ca `P-007` lọt lưới lần hai chỉ vì hai dấu nháy ngược quanh `done`.
  assert.equal(normalizeForHold('chỉ `done` khi'), 'chỉ done khi');
  assert.equal(normalizeForHold('**Còn   treo**'), 'còn treo');
  // Câu treo bị ngắt dòng giữa hai chữ — thân mục thật xuống dòng ở cột 100.
  assert.equal(hasHoldMarker('mục này chỉ đóng\nkhi có xác nhận'), true);
});

test('parseHoldField: trường `- hold:` đọc được như `- status:`, kể cả viết lệch', () => {
  assert.equal(parseHoldField('- hold: chờ một lần chạy thật'), 'chờ một lần chạy thật');
  // Thụt lề lệch, `*` thay `-`, viết hoa — cả ba vẫn nhận. Một mục bị giữ lại
  // vì viết `- Hold:` là đúng thứ hỏng im lặng mà mục này sinh ra để giết.
  assert.equal(parseHoldField('   - Hold:   chờ xác nhận  '), 'chờ xác nhận');
  assert.equal(parseHoldField('* HOLD: chờ G3'), 'chờ G3');
  // Không khai thì `null`, không đoán.
  assert.equal(parseHoldField('- deps: —\n- status: review'), null);
  // `- hold:` TRẦN không tính là khai: nó không nói được vì sao mục còn treo.
  assert.equal(parseHoldField('- hold:'), null);
  assert.equal(parseHoldField('- hold:    '), null);
  // Không ăn theo một chữ dài hơn.
  assert.equal(parseHoldField('- holding: x'), null);
  // Dòng `hold` ĐẦU TIÊN thắng — cùng luật với `- status:`.
  assert.equal(parseHoldField('- hold: lý do một\n- hold: lý do hai'), 'lý do một');
});

test('parseBacklog: mục khai `- hold:` thì `hold` mang lý do, không chỉ một cờ', () => {
  const items = parseBacklog(
    '### D-010 · Mục khai trường\n- deps: —\n- status: review\n- hold: chờ một lần chạy thật của routine\n',
  );
  assert.equal(items[0]!.hold, 'chờ một lần chạy thật của routine');
  // Lý do phải đọc được bằng máy, vì bản tin và người soát đều cần biết
  // mục đang chờ CÁI GÌ, không chỉ biết là nó đang chờ.
  assert.equal(items[0]!.hasHoldMarker, false);
});

test('heldBy: trường thắng lời văn, và mục sạch cả hai đường thì không bị giữ', () => {
  assert.equal(heldBy({ hold: 'chờ xác nhận', hasHoldMarker: false }), 'field');
  // Cả hai cùng có → `field`. Mục đã khai trường không còn là "nợ lời văn".
  assert.equal(heldBy({ hold: 'chờ xác nhận', hasHoldMarker: true }), 'field');
  assert.equal(heldBy({ hold: null, hasHoldMarker: true }), 'prose');
  assert.equal(heldBy({ hold: null, hasHoldMarker: false }), null);
});

test('classify: trường `- hold:` giữ mục lại dù thân mục sạch trơn', () => {
  const withField = {
    id: 'D-010',
    title: 'Mục khai trường',
    status: 'review',
    hold: 'chờ một lần chạy thật',
    hasHoldMarker: false,
    statusLine: 2,
  };
  assert.equal(classify(withField, true), 'held');

  // Test ÂM: lớp thứ hai còn sống — không khai trường mà thân mục mang một câu
  // treo thì vẫn không bị lật. Gỡ lưới đi là mở lại đúng lỗ vừa bịt.
  const proseOnly = { ...withField, id: 'D-011', hold: null, hasHoldMarker: true };
  assert.equal(classify(proseOnly, true), 'held');

  // Sạch cả hai đường thì lật bình thường — mục này không được làm mọi thứ
  // đứng lại.
  const clean = { ...withField, id: 'D-012', hold: null, hasHoldMarker: false };
  assert.equal(classify(clean, true), 'stale');
});

test('reviewFindings: nhóm held tách được "giữ bởi trường" và "chỉ giữ bởi lời văn"', () => {
  // Con số thứ hai là NỢ phải trả dần, và nó phải nhìn thấy được thì mới trả
  // được — đúng tiêu chí xong của `I-020`.
  const backlog = [
    '### D-020 · Khai bằng trường',
    '- status: review',
    '- hold: chờ một lần chạy thật',
    '',
    '### D-021 · Chỉ có lời văn',
    '- status: review',
    '- Mục này chỉ đóng khi có xác nhận.',
    '',
    '### D-022 · Sạch',
    '- status: review',
    '',
  ].join('\n');
  const subjects = ['[demo] D-020 — xong (#1)', '[demo] D-021 — xong (#2)', '[demo] D-022 — xong (#3)'];
  assert.deepEqual(reviewFindings('demo', backlog, subjects), [
    { lane: 'demo', id: 'D-020', verdict: 'held', heldBy: 'field' },
    { lane: 'demo', id: 'D-021', verdict: 'held', heldBy: 'prose' },
    { lane: 'demo', id: 'D-022', verdict: 'stale' },
  ]);
});

test('applyFix: mục bị giữ không bị lật, kể cả khi bên gọi nêu tên nó', () => {
  // Luật "mục bị giữ thì không bao giờ bị lật" chỉ đúng khi nó cũng đúng ở chỗ
  // THẬT SỰ ghi file, không chỉ ở `classify`.
  const byField = '### D-030 · Khai trường\n- status: review\n- hold: chờ xác nhận\n';
  assert.deepEqual(applyFix(byField, ['D-030']), { content: byField, changed: [] });

  // Ca LỜI VĂN, và đây là ca đáng hơn: `classify` đã loại nó khỏi `stale` nên
  // `main()` hôm nay không truyền nó vào — nhưng cổng ghi file không được dựa
  // vào chuyện đó. Vòng soát ngữ cảnh sạch đo được bản đầu vẫn lật mục này.
  const byProse = '### D-031 · Chỉ có lời văn\n- status: review\n- Mục này chỉ đóng khi có xác nhận.\n';
  assert.deepEqual(applyFix(byProse, ['D-031']), { content: byProse, changed: [] });

  // Chiều ngược: mục sạch cả hai đường vẫn lật, nếu không thì `--fix` thành
  // lệnh rỗng và mục `I-010` mất tác dụng.
  const clean = '### D-032 · Sạch\n- status: review\n';
  assert.deepEqual(applyFix(clean, ['D-032']).changed, ['D-032']);
});

test('nợ lời văn của backlog THẬT phải ở 0 — máy canh, không chỉ in ra', () => {
  // Tiêu chí xong của `I-020` đòi con số `heldByProseOnly` "nhìn thấy được thì
  // mới trả được". Nhưng chỉ IN ra là chưa đủ: vòng soát ngữ cảnh sạch của PR
  // này gỡ hai dòng `- hold:` khỏi backlog thật và **0 bài test đỏ** — đúng
  // nhóm Z (hỏng mà mọi chỉ báo đều xanh) mà chính mục này sinh ra để giết.
  //
  // Nên bài này đọc backlog THẬT. Nó cố tình dễ vỡ theo đúng một hướng: thêm
  // một mục còn treo mà quên `- hold:` thì CI đỏ, kèm tên mục. Cách chữa luôn
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
      if (heldBy(item) === 'prose') proseOnly.push(`${lane}/${item.id}`);
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
  // Lưới nay là MẪU, không phải chuỗi con — ghim đúng hình dạng đó, vì một lần
  // đổi ngược về chuỗi con là mở lại lỗ mà `I-020` vừa bịt.
  assert.ok(HOLD_MARKERS.every((pattern) => pattern instanceof RegExp));
});

test('hasRevertCommit: mục bị revert thì không còn tính là đã xong', () => {
  const subjects = ['Revert "[demo] D-006 — xong (#6)"', '[demo] D-006 — xong (#6)'];
  assert.equal(hasRevertCommit('demo', 'D-006', subjects), true);
  assert.equal(hasRevertCommit('demo', 'D-001', subjects), false);
});

test('classify: mục không đọc được status ra unknown, không bị lọc đi im lặng', () => {
  assert.equal(
    classify({ id: 'D-009', title: 'Không có status', status: '', hold: null, hasHoldMarker: false, statusLine: null }, true),
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
