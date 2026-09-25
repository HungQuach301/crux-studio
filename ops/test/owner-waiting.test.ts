/**
 * `ops/scripts/owner-waiting.ts` — cơ chế của mục `platform/P-053` (chỉ dẫn
 * `C1` + `C4` của chủ dự án trên `#251`).
 *
 * Mọi fixture dưới đây là **trích nguyên văn** từ ca thật: 11 issue `[QĐ]
 * reversible` đang mở lúc `2026-09-25T05:4xZ` và các trường `- hold:` thật
 * trong `ops/lanes/*​/backlog.md`. Lý do không tự nghĩ câu: bộ dò này quyết
 * định một dòng có xuất hiện trước mắt chủ dự án hay không, và câu tự nghĩ
 * luôn dễ hơn câu thật — đúng chỗ `P-051` vừa trả giá.
 *
 * **Bài âm đi cùng bài dương ở từng luật con.** Chiều hỏng đắt nhất của mục
 * này là nêu oan: một `[QĐ]` mở bằng *"Không cần anh làm gì"* mà bị kéo vào
 * mục "Việc đang chờ anh" thì lần sau chủ dự án thôi đọc mục đó, và nhóm Z
 * quay lại nguyên vẹn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOCKING_SHOWN,
  GATE_LANE,
  WHAT_MAX,
  backlogGraph,
  blockedCounts,
  decisionNeedsOwnerHand,
  ownerHoldWait,
  ownerWaitingRows,
  renderOwnerWaitRow,
  renderOwnerWaitingLines,
  waitingDaysFrom,
} from '../scripts/owner-waiting.ts';
import { parseBacklog } from '../scripts/backlog-status.ts';
import { linkedPrNumbers } from '../scripts/digest-metrics.ts';

const NOW = new Date('2026-09-25T06:00:00.000Z');

// --- ownerHoldWait ---

/** Trích nguyên văn trường `- hold:` của bốn mục thật đang chờ chính chủ dự án. */
const OWNER_HOLDS: readonly [string, string][] = [
  [
    'platform/P-045',
    'chờ chủ dự án merge — `ops/workflows/automerge.yml` thuộc vùng `owner-merge`; và một phép đo sau khi sync: lượt `automerge` kế tiếp có xét tới `#84`/`#39` không',
  ],
  [
    'assembly/A-001',
    'chưa đo được phút Actions thật; ba chỉ số 30/60fps chờ mắt chủ dự án (WP-003 mục 5) và visual/V-002',
  ],
  [
    'audio/AU-001',
    'chờ quyết định irreversible chọn nhà cung cấp giọng đọc (🤖 [QĐ]); commercialLicenseVerified giữ false tới khi issue đóng',
  ],
  ['platform/P-043', 'còn treo — cần người/nền tảng đặt CLAUDE_SESSION_URL; chưa lượt routine thật nào đặt biến đó'],
];

/**
 * Trích nguyên văn trường `- hold:` của bốn mục thật **chờ máy**, không chờ
 * người — hình dạng `hold` phổ biến nhất trong repo.
 */
const MACHINE_HOLDS: readonly [string, string][] = [
  [
    'integration/I-008',
    'chưa kiểm bằng chạy thật — routine crux-integrator (P3 bước 3) chưa gọi update-metrics lần nào',
  ],
  ['kernel/K-001', 'còn treo có chủ đích — snapshot.schema.json và thesis.schema.json chưa mở'],
  ['platform/P-014', 'còn treo, ngoài phạm vi mục này (không tự mở rộng PR)'],
  [
    'integration/I-011',
    'còn treo — luật máy Z13 chưa dựng; upstreamFrom.workshops khai tay chưa suy từ consumes (thành I-011)',
  ],
];

test('ownerHoldWait: bốn lời giữ thật chờ chính chủ dự án đều được nêu', () => {
  for (const [key, hold] of OWNER_HOLDS) assert.equal(ownerHoldWait(hold), true, key);
});

test('ownerHoldWait: bốn lời giữ thật chờ MÁY đều KHÔNG được nêu', () => {
  for (const [key, hold] of MACHINE_HOLDS) assert.equal(ownerHoldWait(hold), false, key);
});

test('ownerHoldWait: mục không khai `- hold:` thì không có gì chờ', () => {
  assert.equal(ownerHoldWait(null), false);
  assert.equal(ownerHoldWait(undefined), false);
  assert.equal(ownerHoldWait(''), false);
  assert.equal(ownerHoldWait('   '), false);
});

test('ownerHoldWait: lời giữ khai thẳng "không treo" KHÔNG được nêu, dù có nhắc chủ dự án (ca thật audio/AU-008)', () => {
  const hold =
    '— **không treo.** Trần **30 USD** đã được chủ dự án duyệt thẳng trong cùng chỉ dẫn (*"Chi phí thử tối đa 30 USD"*), nên CHARTER 2.3 nhóm 1 đã có câu trả lời và không cần `[QĐ]` để bật vòng thử.';
  // Không có phép phủ định thì CẢ HAI dấu hiệu (`chủ dự án` và `[QĐ]`) đều khớp.
  assert.match(hold, /chủ\s+dự\s+án/u);
  assert.match(hold, /\[QĐ\]/u);
  assert.equal(ownerHoldWait(hold), false);
});

test('ownerHoldWait: dấu hiệu `[QĐ]` phải đi kèm chữ `chờ` — ca thật là lời giữ của chính P-053', () => {
  // Dương tính giả duy nhất mà bài kiểm tác động (`A3`) bắt được trên 46
  // trường `- hold:` thật: lời giữ của `P-053` NHẮC `[QĐ] reversible` khi kể
  // hai vế C2/C3 đã tách, trong khi thứ nó chờ là một lượt `crux-digest`.
  const p053 =
    'chưa **quan sát** bản tin thật in mục *"Việc đang chờ anh"* — routine `crux-digest` (20:30) chưa chạy; lượt kế tiếp là quan sát đầu tiên. Cộng hai vế ngoài phạm vi, đã tách: `C2` (@nhắc riêng khi quá 48 giờ) và `C3` (`[QĐ] reversible` cần đầu vào của anh thì hoặc chuyển mục này, hoặc máy tự quyết).';
  assert.match(p053, /\[QĐ\]/u, 'ca thật phải còn nhắc [QĐ], nếu không bài kiểm này rỗng');
  assert.equal(ownerHoldWait(p053), false);

  // Ba lời giữ thật CHỜ một `[QĐ]` vẫn phải được nêu.
  assert.equal(
    ownerHoldWait('chờ quyết định irreversible chọn nhà cung cấp giọng đọc (🤖 [QĐ]); commercialLicenseVerified giữ false'),
    true,
  );
  assert.equal(ownerHoldWait('còn treo — hai tiêu chí cuối (sửa cơ chế A/B + bằng chứng chạy thật) chờ 🤖 [QĐ] #116'), true);

  // `[^.;]` giữ phép khớp trong CÙNG một câu: một chữ `chờ` ở câu trước không
  // được kéo cả lời giữ vào đây.
  assert.equal(ownerHoldWait('chờ một lượt routine kế tiếp. Ngoài phạm vi: `[QĐ]` khác'), false);
  assert.equal(ownerHoldWait('chờ một lượt routine kế tiếp; ngoài phạm vi: `[QĐ]` khác'), false);
});

test('ownerHoldWait: luật "không treo" đúng trên DỮ LIỆU THẬT của repo — không dòng nào vừa khai không treo vừa bị nêu', () => {
  // Bài kiểm **tính chất**, không ghim con số: số mục và lời giữ đổi mỗi PR,
  // nhưng quan hệ "khai không treo ⇒ không nêu" thì không được đổi. Đây là
  // vế máy của bài kiểm tác động (`A3` của `#251`) cho phía backlog.
  const lanesDir = join(import.meta.dirname, '..', 'lanes');
  let checked = 0;
  for (const lane of ['assembly', 'audio', 'editorial', 'integration', 'kernel', 'platform', 'release', 'topic', 'verify', 'visual']) {
    const path = join(lanesDir, lane, 'backlog.md');
    if (!existsSync(path)) continue;
    for (const item of parseBacklog(readFileSync(path, 'utf8'))) {
      if (item.holdField == null || !/không\s+treo/iu.test(item.holdField)) continue;
      checked += 1;
      assert.equal(ownerHoldWait(item.holdField), false, `${lane}/${item.id}`);
    }
  }
  // Ca thật `audio/AU-008` phải còn đó — 0 dòng nghĩa là bài kiểm này đang
  // không kiểm gì, đúng hình dạng nhóm Z mà nó sinh ra để chặn.
  assert.ok(checked >= 1, 'không tìm được lời giữ "không treo" nào trong repo — bài kiểm rỗng');
});

// --- decisionNeedsOwnerHand ---

/** Trích nguyên văn từ bảy `[QĐ] reversible` thật mà máy KHÔNG tự làm được. */
const NEEDS_OWNER: readonly [string, string][] = [
  ['#5 (tiêu đề)', '🤖 [QĐ] Năm giả định chỉ anh kiểm được'],
  [
    '#5 (thân)',
    '**Năm mục dưới đây cần anh**, vì chúng nằm trong trang cấu hình tài khoản hoặc trong hoàn cảnh thật của anh — agent không thấy được.',
  ],
  [
    '#101',
    'Bài kiểm là mở Console của project rồi đọc. **Chỉ anh làm được** — phiên cloud không có project nào để mở.',
  ],
  [
    '#92',
    'chọn A hay B bây giờ là chọn bằng một nửa bằng chứng, và nửa thiếu lại chính là nửa mà charter giao cho mắt anh.',
  ],
  ['#213', 'Cần đúng một câu của anh để mở.'],
  [
    '#36',
    'Ở đây tôi không làm được — cả ba phương án đều nằm ngoài repo và cần anh. Nhãn vẫn đúng, nhưng thực chất đây là **một chỗ chặn cần anh**.',
  ],
  ['#67 (tiêu đề)', '🤖 [QĐ] PR #66 (P-003, soát chéo GPT) dùng secrets.OPENAI_API_KEY — cần anh tự merge'],
  [
    '#63 (tiêu đề)',
    '🤖 [QĐ] PR #62 (P-014 sóng 1) chạm automerge.yml — cần anh tự merge, cộng một lệch quy ước nhánh cần biết',
  ],
];

/** Trích nguyên văn từ bốn `[QĐ] reversible` thật mà máy tự làm được. */
const NO_OWNER_NEEDED: readonly [string, string][] = [
  ['#107', '🤖 Không cần anh làm gì. Quyết định `reversible`, ghi lại để có người sửa. Dòng log đo được: #106.'],
  [
    '#45',
    '🤖 Quyết định `reversible` (nằm trong git, revert được) nên theo CHARTER 2.3 tôi **đã làm ngay** trong PR #44 và ghi lại đây. Anh không cần làm gì; phủ quyết bằng `hoàn tác #N`.',
  ],
  ['#96', 'Nó sửa đúng chỗ sai (thứ tự thao tác của agent), không đụng vùng bảo vệ, và không đòi anh làm gì.'],
  [
    '#254',
    'Đây là quyết định `reversible` — nếu anh không nói khác, lượt sau làm theo **A**. Ràng buộc của anh: cách chặn không được nới chính luật đang bắt lỗi.',
  ],
];

test('decisionNeedsOwnerHand: bảy [QĐ] reversible thật cần chủ dự án đều được nêu', () => {
  for (const [key, text] of NEEDS_OWNER) assert.equal(decisionNeedsOwnerHand(text), true, key);
});

test('decisionNeedsOwnerHand: bốn [QĐ] reversible thật máy tự làm được đều KHÔNG được nêu', () => {
  for (const [key, text] of NO_OWNER_NEEDED) assert.equal(decisionNeedsOwnerHand(text), false, key);
});

test('decisionNeedsOwnerHand: câu phủ định "không cần anh" bị bóc TRƯỚC khi tìm dấu hiệu (ca thật #107)', () => {
  // Không bóc thì `#107` khớp dấu hiệu `cần anh` và bị nêu oan.
  assert.match('Không cần anh làm gì.', /cần\s+anh/u);
  assert.equal(decisionNeedsOwnerHand('Không cần anh làm gì.'), false);
  // Bóc phải chịu được nhiều khoảng trắng và một lần xuống dòng — thân issue
  // thật xuống dòng ở cột 100.
  assert.equal(decisionNeedsOwnerHand('Không  cần anh làm gì.'), false);
  assert.equal(decisionNeedsOwnerHand('không\ncần anh làm gì.'), false);
  // Và không được nuốt một câu dương nằm ở chỗ khác trong cùng thân.
  assert.equal(decisionNeedsOwnerHand('Không cần anh làm gì ở mục 1. Mục 2 thì cần anh mở Console.'), true);
});

test('decisionNeedsOwnerHand: KHÔNG có dấu hiệu nào cho "trả lời"/"comment" — mọi [QĐ] đều mời trả lời', () => {
  // Mục "Cách trả lời" có trong MỌI `[QĐ]` (CHARTER 2.3), nên một dấu hiệu
  // như vậy sẽ nêu cả 11 issue reversible và biến mục mới thành bản sao của
  // mục "Quyết định reversible đang mở" ngay trên nó.
  assert.equal(decisionNeedsOwnerHand('## 5. Cách trả lời\n\nComment `A`, `B` hoặc `C` ngay dưới đây.'), false);
  // `thời gian của anh` xuất hiện trong #45 và #107 — hai issue khai "anh
  // không cần làm gì". Dấu hiệu `của anh` trần sẽ nêu oan cả hai.
  assert.equal(decisionNeedsOwnerHand('nó đẩy thẳng vào "thời gian của anh" đúng loại việc mà mặc định M8 muốn xoá'), false);
});

// --- đồ thị deps và số mục bị chặn ---

const GRAPH_FILES = [
  {
    lane: GATE_LANE,
    content: [
      '### T-001 · gốc',
      '- status: ready',
      '- deps: —',
      '',
      '### T-002 · chờ T-001',
      '- status: blocked',
      '- deps: T-001',
      '',
      '### T-003 · chờ T-002',
      '- status: blocked',
      '- deps: T-002',
      '',
    ].join('\n'),
  },
  {
    lane: 'platform',
    content: [
      '### P-001 · chờ chủ dự án',
      '- status: review',
      '- deps: —',
      '- hold: chờ chủ dự án merge (🤖 [QĐ] #900)',
      '',
      '### P-002 · chờ P-001 và T-001',
      '- status: blocked',
      '- deps: P-001, T-001',
      '',
    ].join('\n'),
  },
];

test('blockedCounts: đếm BẮC CẦU, không chỉ một tầng', () => {
  const graph = backlogGraph(GRAPH_FILES);
  const blocked = blockedCounts(graph, ['T-001']);
  // Một tầng chỉ thấy T-002 và P-002; bắc cầu thấy cả T-003.
  assert.deepEqual(blocked.ids, ['P-002', 'T-002', 'T-003']);
  assert.deepEqual(blocked.gateIds, ['T-002', 'T-003']);
});

test('blockedCounts: không trả về chính mã gốc, và vòng trong deps không làm treo', () => {
  const graph = backlogGraph([
    { lane: 'platform', content: '### P-001 · a\n- deps: P-002\n\n### P-002 · b\n- deps: P-001\n' },
  ]);
  const blocked = blockedCounts(graph, ['P-001']);
  assert.deepEqual(blocked.ids, ['P-002']);
});

test('backlogGraph: mã trùng giữa hai làn thì mục ĐẦU thắng, không nhân đôi cạnh', () => {
  const graph = backlogGraph([
    { lane: 'platform', content: '### X-001 · a\n- deps: —\n' },
    { lane: 'topic', content: '### X-001 · b\n- deps: —\n' },
  ]);
  assert.equal(graph.byId.get('X-001')?.lane, 'platform');
  assert.equal(graph.byId.size, 1);
});

// --- ownerWaitingRows ---

const DECISIONS = [
  { number: 900, title: '🤖 [QĐ] chỉ anh mở được Console', body: 'Chỉ anh làm được.', ageDays: 3.2 },
  { number: 901, title: '🤖 [QĐ] máy tự làm rồi', body: 'Không cần anh làm gì.', ageDays: 9.9 },
];

test('ownerWaitingRows: nêu cả hai loại, và xếp làn giữ cổng Mốc 3 lên trước', () => {
  const rows = ownerWaitingRows({
    backlogs: GRAPH_FILES,
    decisions: DECISIONS,
    logs: [{ ref: 'platform/P-001', at: '2026-09-23T06:00:00.000Z' }],
    now: NOW,
    issueRefsOf: linkedPrNumbers,
  });
  // `#901` khai "không cần anh làm gì" nên nó KHÔNG có mặt.
  assert.deepEqual(
    rows.map((r) => r.key),
    ['#900', 'platform/P-001'],
  );
  // `#900` được `P-001` nhắc trong `- hold:`, nên nó chặn P-001 cộng P-002
  // (bắc cầu) — nhiều hơn P-001 tự chặn, nên nó đi trước.
  assert.deepEqual(rows[0]!.blocking, ['P-001', 'P-002']);
  assert.deepEqual(rows[1]!.blocking, ['P-002']);
  assert.equal(rows[0]!.waitingDays, 3.2);
  // "Đã chờ bao lâu" của một mục backlog lấy từ mốc `at` mới nhất của dòng log.
  assert.equal(rows[1]!.waitingDays, 2);
  assert.equal(rows[1]!.link, 'ops/lanes/platform/backlog.md · #900');
});

test('ownerWaitingRows: mục chưa có dòng log nào ra `null`, KHÔNG lặng lẽ thành 0', () => {
  const rows = ownerWaitingRows({
    backlogs: GRAPH_FILES,
    decisions: [],
    logs: [],
    now: NOW,
    issueRefsOf: linkedPrNumbers,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.waitingDays, null);
  assert.match(renderOwnerWaitRow(rows[0]!), /chưa đo được đã chờ bao lâu/);
});

test('ownerWaitingRows: `null` (không đo được) xếp CUỐI trong cùng mức chặn, không giả vờ là lớn', () => {
  const backlogs = [
    {
      lane: 'platform',
      content: [
        '### P-001 · a',
        '- deps: —',
        '- hold: chờ chủ dự án merge',
        '',
        '### P-002 · b',
        '- deps: —',
        '- hold: chờ chủ dự án merge',
        '',
      ].join('\n'),
    },
  ];
  const rows = ownerWaitingRows({
    backlogs,
    decisions: [],
    logs: [{ ref: 'platform/P-002', at: '2026-09-20T06:00:00.000Z' }],
    now: NOW,
    issueRefsOf: linkedPrNumbers,
  });
  assert.deepEqual(
    rows.map((r) => r.key),
    ['platform/P-002', 'platform/P-001'],
  );
});

test('ownerWaitingRows: `what` bị cắt theo WHAT_MAX và mang dấu …', () => {
  const long = `chờ chủ dự án ${'x'.repeat(400)}`;
  const rows = ownerWaitingRows({
    backlogs: [{ lane: 'platform', content: `### P-001 · a\n- deps: —\n- hold: ${long}\n` }],
    decisions: [],
    logs: [],
    now: NOW,
    issueRefsOf: linkedPrNumbers,
  });
  assert.equal(rows[0]!.what.length, WHAT_MAX);
  assert.ok(rows[0]!.what.endsWith('…'));
});

// --- render ---

test('renderOwnerWaitingLines: dòng đếm LUÔN có, kể cả khi rỗng', () => {
  const lines = renderOwnerWaitingLines([]);
  assert.equal(lines[0], 'Việc đang chờ anh: 0 việc');
  assert.match(lines[1]!, /không có việc nào đang chờ anh/);
});

test('renderOwnerWaitRow: một dòng mang đủ bốn thứ C1 đòi — việc · đã chờ · đang chặn · link', () => {
  const line = renderOwnerWaitRow({
    kind: 'decision',
    key: '#900',
    what: 'chỉ anh mở được Console',
    waitingDays: 3.2,
    blocking: ['T-001', 'T-002', 'T-003', 'T-004'],
    blockingGate: ['T-001', 'T-002'],
    link: '#900',
  });
  assert.match(line, /^- #900 · chỉ anh mở được Console · đã chờ 3\.2 ngày · /);
  assert.match(line, new RegExp(`chặn 4 mục \\(T-001, T-002, T-003, …\\+${4 - BLOCKING_SHOWN}\\)`));
  assert.match(line, new RegExp(`2 thuộc làn ${GATE_LANE} \\(cổng Mốc 3\\)`));
  assert.ok(line.endsWith('· #900'));
});

test('renderOwnerWaitRow: không dò được mục nào đứng sau thì nói ra, không in "chặn 0 mục"', () => {
  const line = renderOwnerWaitRow({
    kind: 'backlog',
    key: 'platform/P-001',
    what: 'chờ chủ dự án merge',
    waitingDays: null,
    blocking: [],
    blockingGate: [],
    link: 'ops/lanes/platform/backlog.md',
  });
  assert.match(line, /chưa dò được mục nào đứng sau/);
});

test('waitingDaysFrom: thiếu hoặc không đọc được mốc thì `null`', () => {
  assert.equal(waitingDaysFrom(undefined, NOW), null);
  assert.equal(waitingDaysFrom('không phải mốc', NOW), null);
  assert.equal(waitingDaysFrom('2026-09-22T06:00:00.000Z', NOW), 3);
});
