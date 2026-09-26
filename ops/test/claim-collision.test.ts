/**
 * `ops/scripts/claim-collision.ts` — cơ chế của mục `platform/P-041`,
 * chữ ký `KF-025`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABANDONED_DRAFT_HOURS,
  ClaimInputError,
  RECENT_MERGE_MINUTES,
  aliasesFromChangedFiles,
  assertSnapshots,
  claimCheck,
  claimKeyFromText,
  claimKeyFromTitle,
  duplicateClaims,
  renderDuplicateClaims,
  unreadableTitles,
  type ClaimTree,
  type PrSnapshot,
} from '../scripts/claim-collision.ts';

function pr(overrides: Partial<PrSnapshot> & { number: number; title: string }): PrSnapshot {
  return {
    createdAt: '2026-09-24T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    isDraft: false,
    ...overrides,
  };
}

/** Cây sạch: mỗi mã đúng một lần, không mã nào trùng. */
function tree(...ids: string[]): ClaimTree {
  return { ids, duplicateIds: [] };
}

// ── Ca TÁI HIỆN LỖI 1: #221 và #222 (2026-09-24), cách nhau 89 giây ─────

const I020_COLLISION: PrSnapshot[] = [
  pr({
    number: 221,
    title: '[integration] I-020 — "dấu treo" là một trường `- hold:`, không còn dò chuỗi con',
    createdAt: '2026-09-24T03:40:00Z',
    closedAt: '2026-09-24T03:44:45Z',
    mergedAt: '2026-09-24T03:44:45Z',
  }),
  pr({
    number: 222,
    title: '[integration] I-020 — "còn treo" là một trường, không phải một câu văn',
    createdAt: '2026-09-24T03:41:29Z',
  }),
];

test('tái hiện lỗi: hai PR cùng mục I-020 sống chồng nhau thì bị bắt', () => {
  const found = duplicateClaims(I020_COLLISION);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], {
    claim: 'integration/I-020',
    first: 221,
    second: 222,
    // Hai tiêu đề mang CÙNG một mã, nên không luật nào phải quy chúng về
    // nhau — `via` là `null` (mục `platform/P-058` tiêu chí 6).
    via: null,
    minutesApart: 1.48,
    firstMerged: true,
  });
});

test('tái hiện lỗi: lượt worker thứ hai hỏi claimCheck lúc 03:41 thì thấy #221 đang mở', () => {
  const atPushTime = [pr({ ...I020_COLLISION[0]!, closedAt: null, mergedAt: null })];
  assert.deepEqual(claimCheck(atPushTime, 'integration', 'I-020', '2026-09-24T03:41:29Z'), {
    claim: 'integration/I-020',
    verdict: 'open-pr',
    prs: [221],
    unreadable: [],
  });
});

test('tái hiện lỗi: sau khi #221 merge, mục vẫn không "free" trong cửa sổ ân hạn', () => {
  const merged = [I020_COLLISION[0]!];
  assert.deepEqual(claimCheck(merged, 'integration', 'I-020', '2026-09-24T03:50:00Z'), {
    claim: 'integration/I-020',
    verdict: 'recently-merged',
    prs: [221],
    unreadable: [],
  });
});

// ── Ca TÁI HIỆN LỖI 2: #224 và #225 — chính lượt viết ra mục này ────────

test('tái hiện lỗi lần hai: #224 và #225 cùng nhận mã P-040, cách nhau 9,75 phút', () => {
  const p040 = [
    pr({
      number: 224,
      title: '[platform] P-040 — bộ dò cross-lane đếm cả ops/logs//, tách luật khỏi YAML',
      createdAt: '2026-09-24T05:41:17Z',
    }),
    pr({
      number: 225,
      title: '[platform] P-040 — hai worker nhận cùng một mục, bộ dò va chạm đọc từ tiêu đề PR',
      createdAt: '2026-09-24T05:51:02Z',
    }),
  ];
  assert.deepEqual(duplicateClaims(p040), [
    { claim: 'platform/P-040', first: 224, second: 225, via: null, minutesApart: 9.75, firstMerged: false },
  ]);
  // Và phép hỏi ở bước 4, chạy LẠI trước khi push, đáng lẽ đã chặn nó.
  assert.deepEqual(claimCheck([p040[0]!], 'platform', 'P-040', '2026-09-24T05:51:02Z'), {
    claim: 'platform/P-040',
    verdict: 'open-pr',
    prs: [224],
    unreadable: [],
  });
});

// ── Tiền tố 🤖 của CLAUDE.md mục 5 ──────────────────────────────────────

test('tái hiện lỗi: tiêu đề mang tiền tố 🤖 vẫn phải đọc ra mã mục', () => {
  // Tiêu đề thật của #212, đã vào `main` nguyên tiền tố.
  const title = '🤖 [platform] P-038 — cổng quyết định: lượt bước 0 không gỡ được gì thì không tốn một lần CI';
  assert.deepEqual(claimKeyFromTitle(title), { lane: 'platform', id: 'P-038' });
  const open = [pr({ number: 212, title })];
  assert.deepEqual(claimCheck(open, 'platform', 'P-038', '2026-09-24T06:00:00Z'), {
    claim: 'platform/P-038',
    verdict: 'open-pr',
    prs: [212],
    unreadable: [],
  });
});

// ── Sóng nối tiếp KHÔNG phải va chạm ────────────────────────────────────

test('sóng nối tiếp của P-014 không bị báo: PR sau ra đời khi PR trước đã đóng', () => {
  const waves = [
    pr({
      number: 196,
      title: '[platform] P-014 — sóng 3 nhóm Z: nhịp tim theo từng làn (Z7)',
      createdAt: '2026-09-23T14:00:00Z',
      closedAt: '2026-09-24T03:41:38Z',
      mergedAt: '2026-09-24T03:41:38Z',
    }),
    pr({
      number: 223,
      title: '[platform] P-014 — sóng 3 nhóm Z: cân đối log/merge theo làn (Z14)',
      createdAt: '2026-09-24T04:38:39Z',
    }),
  ];
  assert.deepEqual(duplicateClaims(waves), []);
});

test('cửa sổ ân hạn đo bằng RECENT_MERGE_MINUTES, không phải một số viết cứng', () => {
  const at = '2026-09-24T03:00:00Z';
  const merged = [pr({ number: 9, title: '[kernel] K-009 — x', closedAt: at, mergedAt: at })];
  const edge = new Date(Date.parse(at) + RECENT_MERGE_MINUTES * 60_000).toISOString();
  assert.equal(claimCheck(merged, 'kernel', 'K-009', edge).verdict, 'recently-merged');
  const past = new Date(Date.parse(edge) + 60_000).toISOString();
  // `free` nay đòi cây làm chứng (tiêu chí 5 của `platform/P-058`): không
  // có cây thì phán quyết là `stale-id`, không phải `free`.
  assert.equal(claimCheck(merged, 'kernel', 'K-009', past).verdict, 'stale-id');
  assert.equal(claimCheck(merged, 'kernel', 'K-009', past, tree('kernel/K-009')).verdict, 'free');
});

test('PR ĐÓNG mà KHÔNG merge không phải "recently-merged" — mục rảnh trở lại', () => {
  const closed = [
    pr({ number: 9, title: '[kernel] K-009 — x', closedAt: '2026-09-24T03:00:00Z', mergedAt: null }),
  ];
  assert.deepEqual(claimCheck(closed, 'kernel', 'K-009', '2026-09-24T03:01:00Z', tree('kernel/K-009')), {
    claim: 'kernel/K-009',
    verdict: 'free',
    prs: [],
    unreadable: [],
  });
});

test('"đã merge" suy từ mergedAt, không từ một cờ boolean của endpoint liệt kê', () => {
  // `list_pull_requests` trả `merged:false` cho cả PR đã merge; chỉ `merged_at` đúng.
  const found = duplicateClaims(I020_COLLISION);
  assert.equal(found[0]!.firstMerged, true);
  const noMergedAt = [pr({ ...I020_COLLISION[0]!, mergedAt: null }), I020_COLLISION[1]!];
  assert.equal(duplicateClaims(noMergedAt)[0]!.firstMerged, false);
});

// ── PR nháp bỏ quá 24 giờ (CLAUDE.md mục 2) ─────────────────────────────

test('PR nháp bỏ quá ABANDONED_DRAFT_HOURS thì mục nhận lại được', () => {
  const now = '2026-09-24T06:00:00Z';
  const stale = new Date(Date.parse(now) - (ABANDONED_DRAFT_HOURS + 1) * 3_600_000).toISOString();
  const drafts = [pr({ number: 30, title: '[topic] T-009 — Thesis Engine', isDraft: true, updatedAt: stale })];
  assert.deepEqual(claimCheck(drafts, 'topic', 'T-009', now), {
    claim: 'topic/T-009',
    verdict: 'abandoned-draft',
    prs: [30],
    unreadable: [],
  });
});

test('PR nháp còn mới, hoặc PR thường dù cũ, vẫn giữ mục', () => {
  const now = '2026-09-24T06:00:00Z';
  const fresh = new Date(Date.parse(now) - (ABANDONED_DRAFT_HOURS - 1) * 3_600_000).toISOString();
  const old = '2026-09-01T00:00:00Z';
  assert.equal(
    claimCheck([pr({ number: 30, title: '[topic] T-009 — x', isDraft: true, updatedAt: fresh })], 'topic', 'T-009', now)
      .verdict,
    'open-pr',
  );
  assert.equal(
    claimCheck([pr({ number: 31, title: '[topic] T-009 — x', isDraft: false, updatedAt: old })], 'topic', 'T-009', now)
      .verdict,
    'open-pr',
  );
});

test('một PR sống cộng một PR nháp chết vẫn là "có người giữ"', () => {
  const now = '2026-09-24T06:00:00Z';
  const stale = '2026-09-20T00:00:00Z';
  const prs = [
    pr({ number: 30, title: '[topic] T-009 — x', isDraft: true, updatedAt: stale }),
    pr({ number: 31, title: '[topic] T-009 — y', isDraft: false, updatedAt: now }),
  ];
  assert.deepEqual(claimCheck(prs, 'topic', 'T-009', now).prs, [31]);
  assert.equal(claimCheck(prs, 'topic', 'T-009', now).verdict, 'open-pr');
});

// ── Chữ ký lấy từ tiêu đề, không lấy từ tên nhánh ───────────────────────

test('claimKeyFromTitle: đọc được tiêu đề đúng quy ước, mọi kiểu gạch ngang', () => {
  assert.deepEqual(claimKeyFromTitle('[visual] V-001 — Genre pack phần hình'), {
    lane: 'visual',
    id: 'V-001',
  });
  assert.deepEqual(claimKeyFromTitle('[verify] VF-G12 – Ruleset'), { lane: 'verify', id: 'VF-G12' });
  assert.deepEqual(claimKeyFromTitle('  [release] R-001 - Chuyển phần phát hành  '), {
    lane: 'release',
    id: 'R-001',
  });
});

test('claimKeyFromTitle: làn lạ, thiếu dấu gạch, hay không có ngoặc vuông thì trả null', () => {
  assert.equal(claimKeyFromTitle('[platfrom] P-001 — sai chính tả tên làn'), null);
  assert.equal(claimKeyFromTitle('[platform] P-001 sửa gì đó'), null);
  assert.equal(claimKeyFromTitle('chore: sync workflows from ops/workflows'), null);
  assert.equal(claimKeyFromTitle(''), null);
});

test('mã mục phải đứng trọn: P-01 không khớp tiêu đề của P-014', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-014 — sóng 3', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 2, title: '[platform] P-01 — mục khác', createdAt: '2026-09-24T01:01:00Z' }),
  ];
  assert.deepEqual(duplicateClaims(prs), []);
});

test('cùng mã mục ở HAI làn khác nhau không phải va chạm', () => {
  const prs = [
    pr({ number: 1, title: '[kernel] K-002 — a', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 2, title: '[topic] K-002 — b', createdAt: '2026-09-24T01:01:00Z' }),
  ];
  assert.deepEqual(duplicateClaims(prs), []);
});

// ── Cấm im lặng: đầu vào hỏng thì NÉM, không trả `free` ─────────────────

test('tên làn không thuộc LANES thì ném, không trả free', () => {
  assert.throws(() => claimCheck([], 'platfrom', 'P-999', '2026-09-24T06:00:00Z'), ClaimInputError);
});

test('mốc `now` không đọc được thì ném, không trả free', () => {
  const merged = [
    pr({ number: 9, title: '[platform] P-009 — x', closedAt: '2026-09-24T05:59:00Z', mergedAt: '2026-09-24T05:59:00Z' }),
  ];
  assert.throws(() => claimCheck(merged, 'platform', 'P-009', 'hôm nay'), ClaimInputError);
  // Cùng dữ liệu đó với `now` đọc được thì KHÔNG phải free — đối chứng cho
  // thấy ca ném ở trên đang che một câu trả lời thật.
  assert.equal(claimCheck(merged, 'platform', 'P-009', '2026-09-24T06:00:00Z').verdict, 'recently-merged');
});

test('PrSnapshot thiếu trường thì ném, kèm số PR và tên trường', () => {
  const missing = [{ number: 7, title: '[platform] P-009 — x', createdAt: '2026-09-24T00:00:00Z' }];
  assert.throws(
    () => assertSnapshots(missing as unknown as PrSnapshot[]),
    (error: unknown) => {
      assert.ok(error instanceof ClaimInputError);
      assert.match(error.message, /#7/);
      assert.match(error.message, /closedAt/);
      assert.match(error.message, /isDraft/);
      return true;
    },
  );
  // Và một PR mở thiếu `closedAt` KHÔNG được lọt thành "đã đóng ⇒ free".
  assert.throws(
    () => claimCheck(missing as unknown as PrSnapshot[], 'platform', 'P-009', '2026-09-24T06:00:00Z'),
    ClaimInputError,
  );
});

test('mốc trong PrSnapshot không đọc được thì ném', () => {
  const broken = [pr({ number: 7, title: '[platform] P-009 — x', createdAt: 'hôm qua' })];
  assert.throws(() => assertSnapshots(broken), /createdAt không đọc được/);
});

test('tiêu đề không đọc được thì được ĐẾM và in ra, ở CẢ HAI cửa', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-014 — sóng 3' }),
    pr({ number: 7, title: 'chore: sync workflows' }),
    pr({ number: 9, title: 'Mốc ân hạn của no-model-name dời sang lúc luật lên main' }),
  ];
  assert.deepEqual(unreadableTitles(prs), [9, 7]);
  assert.match(renderDuplicateClaims([], unreadableTitles(prs)), /#9 #7/);
  // Cửa thứ hai: `claimCheck` cũng phải mang con số đó, nếu không một `free`
  // dựng trên ảnh chụp có PR vô hình trông y hệt một `free` chắc chắn.
  assert.deepEqual(claimCheck(prs, 'kernel', 'K-002', '2026-09-24T06:00:00Z', tree('kernel/K-002')), {
    claim: 'kernel/K-002',
    verdict: 'free',
    prs: [],
    unreadable: [9, 7],
  });
  // Và ở phán quyết `stale-id` con số đó cũng phải còn — hai cửa, không cửa nào im.
  assert.deepEqual(claimCheck(prs, 'kernel', 'K-002', '2026-09-24T06:00:00Z').unreadable, [9, 7]);
});

test('mốc `closedAt` không đọc được thì duplicateClaims thiên về BÁO', () => {
  const prs = [
    pr({ number: 1, title: '[audio] AU-002 — a', createdAt: '2026-09-24T01:00:00Z', closedAt: 'hỏng', mergedAt: null }),
    pr({ number: 2, title: '[audio] AU-002 — b', createdAt: '2026-09-24T09:00:00Z' }),
  ];
  assert.equal(duplicateClaims(prs).length, 1);
});

test('createdAt không đo được thì minutesApart là null, bản in KHÔNG in NaN', () => {
  const prs = [
    pr({ number: 1, title: '[audio] AU-002 — a', createdAt: 'hỏng', closedAt: null }),
    pr({ number: 2, title: '[audio] AU-002 — b', createdAt: '2026-09-24T09:00:00Z' }),
  ];
  const found = duplicateClaims(prs);
  assert.equal(found[0]!.minutesApart, null);
  const text = renderDuplicateClaims(found);
  assert.doesNotMatch(text, /NaN/);
  assert.match(text, /không đo được khoảng cách/);
});

test('renderDuplicateClaims in cả khi 0 va chạm', () => {
  assert.match(renderDuplicateClaims([]), /Va chạm nhận mục: 0/);
});

test('renderDuplicateClaims nói rõ khi PR trước đã merge — đó là ca kẹt vĩnh viễn', () => {
  const text = renderDuplicateClaims(duplicateClaims(I020_COLLISION));
  assert.match(text, /integration\/I-020/);
  assert.match(text, /#221 ĐÃ MERGE/);
  assert.match(text, /#222/);
});

// ── Đầu vào rỗng, ca ba PR, và thứ tự ỔN ĐỊNH ───────────────────────────

test('đầu vào rỗng trả mảng rỗng, không ném', () => {
  assert.deepEqual(duplicateClaims([]), []);
  assert.deepEqual(unreadableTitles([]), []);
  assert.deepEqual(claimCheck([], 'topic', 'T-009', '2026-09-24T00:00:00Z', tree('topic/T-009')), {
    claim: 'topic/T-009',
    verdict: 'free',
    prs: [],
    unreadable: [],
  });
});

test('ba PR cùng mục cùng sống chồng nhau cho ba cặp', () => {
  const prs = [
    pr({ number: 5, title: '[editorial] E-003 — a', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 6, title: '[editorial] E-003 — b', createdAt: '2026-09-24T01:05:00Z' }),
    pr({ number: 7, title: '[editorial] E-003 — c', createdAt: '2026-09-24T01:10:00Z' }),
  ];
  assert.deepEqual(
    duplicateClaims(prs).map((d) => [d.first, d.second]),
    [
      [5, 6],
      [5, 7],
      [6, 7],
    ],
  );
});

test('hai thứ tự đầu vào cho CÙNG một kết quả, kể cả khi createdAt bằng nhau', () => {
  const at = '2026-09-24T01:00:00Z';
  const a = pr({ number: 309, title: '[audio] AU-002 — a', createdAt: at });
  const b = pr({ number: 310, title: '[audio] AU-002 — b', createdAt: at });
  const v = pr({ number: 41, title: '[visual] V-003 — a', createdAt: at });
  const w = pr({ number: 42, title: '[visual] V-003 — b', createdAt: at });
  const forward = duplicateClaims([a, b, v, w]);
  const backward = duplicateClaims([w, v, b, a]);
  assert.deepEqual(forward, backward);
  // Và "PR ra đời trước" phải là số nhỏ hơn khi hai mốc bằng nhau, ở cả hai chiều.
  assert.deepEqual(
    forward.map((d) => [d.claim, d.first, d.second]),
    [
      ['audio/AU-002', 309, 310],
      ['visual/V-003', 41, 42],
    ],
  );
});

test('claimCheck: PR đang mở thắng PR vừa merge — không nhận là không nhận', () => {
  const at = '2026-09-24T03:00:00Z';
  const prs = [
    pr({ number: 5, title: '[editorial] E-003 — a', closedAt: at, mergedAt: at }),
    pr({ number: 6, title: '[editorial] E-003 — b' }),
  ];
  assert.deepEqual(claimCheck(prs, 'editorial', 'E-003', '2026-09-24T03:10:00Z'), {
    claim: 'editorial/E-003',
    verdict: 'open-pr',
    prs: [6],
    unreadable: [],
  });
});

// ── Mục `platform/P-058` · tiêu chí 5 — phán quyết thứ năm `stale-id` ────
//
// Ca TÁI HIỆN LỖI: `2026-09-26T02:2xZ`, `pnpm claims` trả `free` cho
// `platform/P-028` trong khi `#224` và `#274` cùng mở và cùng làm đúng việc
// của mục đó, dưới hai mã khác (`P-040`, `P-057`). Ảnh chụp dựng lại từ
// fixture, không neo vào cây: cặp `### P-028` thật đã hết khi `#274` merge.

const P028_SNAPSHOT: PrSnapshot[] = [
  pr({
    number: 224,
    title: '[platform] P-040 — bộ dò cross-lane đếm cả ops/logs//, tách luật khỏi YAML',
    createdAt: '2026-09-24T05:41:17Z',
    updatedAt: '2026-09-26T01:00:00Z',
  }),
  pr({
    number: 274,
    title: '[platform] P-057 — bộ dò cross-lane đếm cả ops/logs//, tách luật khỏi YAML',
    createdAt: '2026-09-26T01:43:52Z',
    updatedAt: '2026-09-26T02:00:00Z',
  }),
];

/** Cây `main` lúc đó: `### P-028` xuất hiện HAI lần — `duplicateIds` thấy nó. */
const P028_TREE: ClaimTree = {
  ids: ['platform/P-028', 'platform/P-014', 'platform/P-058'],
  duplicateIds: ['platform/P-028 ↔ platform/P-028'],
};

test('P-058 tái hiện lỗi: `platform/P-028` ra `stale-id`, KHÔNG còn ra `free`', () => {
  const at = '2026-09-26T02:22:36Z';

  // Đây là câu trả lời CŨ, và nó là chỗ hỏng: không tiêu đề PR mở nào mang
  // `P-028`, nên phép đếm theo tiêu đề một mình kết luận "rảnh".
  assert.deepEqual(
    P028_SNAPSHOT.filter((p) => claimKeyFromTitle(p.title)?.id === 'P-028'),
    [],
    'tiền đề của ca: không PR nào mang mã P-028 trong tiêu đề',
  );

  const check = claimCheck(P028_SNAPSHOT, 'platform', 'P-028', at, P028_TREE);
  assert.equal(check.verdict, 'stale-id');
  assert.equal(check.staleReason, 'duplicate-id');
  assert.deepEqual(check.prs, []);
});

test('P-058: KHÔNG có cây thì không bao giờ ra `free` — `free` đòi nhân chứng thứ hai', () => {
  const check = claimCheck([], 'platform', 'P-058', '2026-09-26T14:00:00Z');
  assert.equal(check.verdict, 'stale-id');
  assert.equal(check.staleReason, 'no-tree');
});

test('P-058: mã cây KHÔNG có ra `absent-from-tree`, không phải `free`', () => {
  const check = claimCheck([], 'platform', 'P-999', '2026-09-26T14:00:00Z', tree('platform/P-058'));
  assert.equal(check.verdict, 'stale-id');
  assert.equal(check.staleReason, 'absent-from-tree');
});

test('P-058: cây sạch cộng không PR nào giữ → vẫn là `free`, làn không bị chặn oan', () => {
  const check = claimCheck(P028_SNAPSHOT, 'platform', 'P-058', '2026-09-26T14:00:00Z', P028_TREE);
  assert.deepEqual(check, {
    claim: 'platform/P-058',
    verdict: 'free',
    prs: [],
    unreadable: [],
  });
  assert.equal('staleReason' in check, false, '`staleReason` chỉ có mặt khi `stale-id`');
});

test('P-058: phán quyết dựa trên PR THẮNG phán quyết dựa trên cây', () => {
  // Một PR mở mang đúng mã là bằng chứng chắc hơn mọi phép đọc cây, nên
  // `open-pr` phải thắng kể cả khi cây có mã trùng.
  const open = [pr({ number: 300, title: '[platform] P-028 — x', createdAt: '2026-09-26T02:00:00Z' })];
  assert.equal(claimCheck(open, 'platform', 'P-028', '2026-09-26T02:30:00Z', P028_TREE).verdict, 'open-pr');

  const merged = [
    pr({
      number: 301,
      title: '[platform] P-028 — x',
      closedAt: '2026-09-26T02:20:00Z',
      mergedAt: '2026-09-26T02:20:00Z',
    }),
  ];
  assert.equal(
    claimCheck(merged, 'platform', 'P-028', '2026-09-26T02:30:00Z', P028_TREE).verdict,
    'recently-merged',
  );
});

test('P-058: `duplicateIds` tách theo ↔, KHÔNG khớp chuỗi con', () => {
  // `includes` cả chuỗi sẽ khớp `platform/P-02` với
  // `platform/P-028 ↔ platform/P-028` — tức báo nhầm cho một mã khác.
  const near: ClaimTree = { ids: ['platform/P-02'], duplicateIds: ['platform/P-028 ↔ platform/P-028'] };
  assert.equal(claimCheck([], 'platform', 'P-02', '2026-09-26T14:00:00Z', near).verdict, 'free');
});

test('P-058: `tree` hỏng thì NÉM, không nuốt thành `free`', () => {
  const broken = { ids: 'platform/P-058', duplicateIds: [] } as unknown as ClaimTree;
  assert.throws(() => claimCheck([], 'platform', 'P-058', '2026-09-26T14:00:00Z', broken), ClaimInputError);
});

test('claimKeyFromText đọc `<lane>/<id>` và từ chối tên làn không có thật', () => {
  assert.deepEqual(claimKeyFromText('platform/P-058'), { lane: 'platform', id: 'P-058' });
  for (const bad of ['platfrom/P-058', 'P-058', 'platform/', 'platform/P/058', '']) {
    assert.equal(claimKeyFromText(bad), null, `"${bad}" không được đọc thành một mã`);
  }
});

// ── Mục `platform/P-058` · tiêu chí 6 — va chạm ĐANG SỐNG, khác mã ───────

/** Ba file nội dung mà cả `#224` lẫn `#274` cùng đổi. */
const CROSS_LANE_FILES = ['ops/scripts/cross-lane.ts', 'ops/test/cross-lane.test.ts', 'ops/workflows/ci.yml'];
/** File mà MỌI PR đều chạm — không nói được gì về việc hai PR có cùng mục. */
const EVERYONE = ['ops/known-failures.md', 'ops/lanes/platform/backlog.md'];

test('P-058 tiêu chí 6: `#224 ↔ #274` — hai mã khác nhau, cùng sống, cùng ba file → BẮT ĐƯỢC', () => {
  const noise = [
    pr({ number: 101, title: '[topic] T-013 — x', createdAt: '2026-09-24T12:36:34Z' }),
    pr({ number: 102, title: '[audio] AU-006 — x', createdAt: '2026-09-24T11:51:20Z' }),
  ];
  const prs = [...P028_SNAPSHOT, ...noise];
  const changed = [
    { number: 224, files: [...CROSS_LANE_FILES, ...EVERYONE] },
    { number: 274, files: [...CROSS_LANE_FILES, ...EVERYONE] },
    { number: 101, files: EVERYONE },
    { number: 102, files: EVERYONE },
  ];

  // Phép đếm CŨ — nhóm theo mã trong tiêu đề — không thấy gì. Đó là chỗ hỏng.
  assert.deepEqual(duplicateClaims(prs), [], 'phép đếm theo tiêu đề một mình báo 0 va chạm đang sống');

  const aliases = aliasesFromChangedFiles(prs, changed);
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0]!.claim, 'platform/P-040', 'mã quy chuẩn là mã của PR ra đời TRƯỚC');
  assert.deepEqual(aliases[0]!.prs, [224, 274]);
  assert.match(aliases[0]!.because, /cross-lane\.ts/, '`because` phải nói ra quy bằng gì');

  const found = duplicateClaims(prs, aliases);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.first, 224);
  assert.equal(found[0]!.second, 274);
  assert.equal(found[0]!.firstMerged, false, 'cả hai còn mở — đây là va chạm ĐANG SỐNG');
  assert.notEqual(found[0]!.via, null, 'quy về một mục bằng một luật thì bảng phải nói ra luật đó');
  assert.match(renderDuplicateClaims(found), /quy về cùng một mục vì:/);
});

test('P-058 tiêu chí 6 · CA ÂM: sóng nối tiếp `P-014` không phải va chạm, dù chung file', () => {
  // Luật 3 của `P-041` không bị nới: `#62` → `#196` → `#223`, mỗi sóng ĐÓNG
  // trước khi sóng sau mở, nên điều kiện sống chồng nhau loại cả ba cặp.
  const waves = [
    pr({
      number: 62,
      title: '[platform] P-014 — sóng 1',
      createdAt: '2026-09-22T10:00:00Z',
      closedAt: '2026-09-23T14:00:00Z',
      mergedAt: '2026-09-23T14:00:00Z',
    }),
    pr({
      number: 196,
      title: '[platform] P-014 — sóng 3: nhịp tim theo từng làn (Z7)',
      createdAt: '2026-09-23T14:48:17Z',
      closedAt: '2026-09-24T03:41:39Z',
      mergedAt: '2026-09-24T03:41:39Z',
    }),
    pr({
      number: 223,
      title: '[platform] P-014 — sóng 3 nhóm Z: cân đối log/merge theo làn (Z14)',
      createdAt: '2026-09-24T04:38:39Z',
    }),
  ];
  const changed = waves.map((p) => ({ number: p.number, files: [...CROSS_LANE_FILES] }));

  assert.deepEqual(duplicateClaims(waves), [], 'cùng mã nhưng không sóng nào sống chồng sóng khác');
  assert.deepEqual(aliasesFromChangedFiles(waves, changed), [], 'không nhóm bí danh nào — cùng mã, không chồng');
  assert.deepEqual(duplicateClaims(waves, aliasesFromChangedFiles(waves, changed)), []);
});

test('P-058 tiêu chí 6 · CA ÂM: chỉ chung file mà MỌI PR đều chạm thì không quy', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-040 — a', createdAt: '2026-09-24T05:41:17Z' }),
    pr({ number: 2, title: '[platform] P-057 — b', createdAt: '2026-09-26T01:43:52Z' }),
    pr({ number: 3, title: '[topic] T-013 — c', createdAt: '2026-09-24T12:36:34Z' }),
    pr({ number: 4, title: '[audio] AU-006 — d', createdAt: '2026-09-24T11:51:20Z' }),
  ];
  const changed = prs.map((p) => ({ number: p.number, files: EVERYONE }));
  // Bốn PR cùng chạm hai file đó > `sharedFileMaxPrs` = 3, nên cả hai rơi ra
  // và không còn file nội dung chung nào.
  assert.deepEqual(aliasesFromChangedFiles(prs, changed), []);
});

test('P-058 tiêu chí 6 · CA ÂM: chung ĐÚNG MỘT file nội dung thì chưa đủ', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-040 — a', createdAt: '2026-09-24T05:41:17Z' }),
    pr({ number: 2, title: '[platform] P-057 — b', createdAt: '2026-09-26T01:43:52Z' }),
  ];
  const changed = [
    { number: 1, files: ['ops/scripts/cross-lane.ts', 'ops/scripts/chỉ-mình-tôi.ts'] },
    { number: 2, files: ['ops/scripts/cross-lane.ts', 'ops/scripts/của-riêng-nó.ts'] },
  ];
  assert.deepEqual(aliasesFromChangedFiles(prs, changed), [], 'mặc định minShared = 2');
  assert.equal(aliasesFromChangedFiles(prs, changed, { minShared: 1 }).length, 1, 'hạ ngưỡng thì bắt');
});

test('P-058 tiêu chí 6: nhóm bí danh hỏng thì NÉM, không bỏ qua im lặng', () => {
  const prs = [pr({ number: 1, title: '[platform] P-040 — a' }), pr({ number: 2, title: '[platform] P-057 — b' })];
  const bad = [
    { claim: 'platfrom/P-040', prs: [1, 2], because: 'tên làn sai' },
    { claim: 'platform/P-040', prs: [1, 2], because: '   ' },
    { claim: 'platform/P-040', prs: [1], because: 'một PR không thành nhóm' },
  ];
  for (const alias of bad) {
    assert.throws(() => duplicateClaims(prs, [alias]), ClaimInputError, `phải ném cho ${JSON.stringify(alias)}`);
  }
  // Một PR nằm trong hai nhóm cũng ném.
  assert.throws(
    () =>
      duplicateClaims(prs, [
        { claim: 'platform/P-040', prs: [1, 2], because: 'x' },
        { claim: 'platform/P-057', prs: [2, 3], because: 'y' },
      ]),
    ClaimInputError,
  );
});

test('P-058 tiêu chí 6: `aliasesFromChangedFiles` từ chối ngưỡng vô nghĩa', () => {
  const prs = [pr({ number: 1, title: '[platform] P-040 — a' })];
  for (const options of [{ minShared: 0 }, { minShared: 1.5 }, { sharedFileMaxPrs: 0 }]) {
    assert.throws(() => aliasesFromChangedFiles(prs, [{ number: 1, files: [] }], options), ClaimInputError);
  }
});

test('P-058 tiêu chí 6: thứ tự đầu vào KHÔNG đổi kết quả', () => {
  const prs = [...P028_SNAPSHOT];
  const changed = [
    { number: 224, files: [...CROSS_LANE_FILES] },
    { number: 274, files: [...CROSS_LANE_FILES] },
  ];
  const forward = aliasesFromChangedFiles(prs, changed);
  const backward = aliasesFromChangedFiles([...prs].reverse(), [...changed].reverse());
  assert.deepEqual(forward, backward);
  assert.deepEqual(duplicateClaims(prs, forward), duplicateClaims([...prs].reverse(), backward));
});

test('P-058 tiêu chí 6 · CA ÂM: hai mã khác nhau, chung đủ file, nhưng KHÔNG sống chồng nhau', () => {
  // Đây là ca giữ luật 3 của `P-041` ở đúng chỗ `aliasesFromChangedFiles`
  // quyết định. Ca `P-014` ở trên KHÔNG che được nó: ở đó hai PR mang CÙNG
  // một mã, nên phép lọc "khác mã" đã loại chúng trước khi điều kiện sống
  // chồng nhau được hỏi tới. Bỏ điều kiện đó đi thì ca này — và chỉ ca này
  // — đỏ.
  const sequential = [
    pr({
      number: 1,
      title: '[platform] P-040 — sóng trước',
      createdAt: '2026-09-24T05:41:17Z',
      closedAt: '2026-09-25T00:00:00Z',
      mergedAt: '2026-09-25T00:00:00Z',
    }),
    pr({
      number: 2,
      title: '[platform] P-057 — việc sau, mở SAU khi sóng trước đã đóng',
      createdAt: '2026-09-26T01:43:52Z',
    }),
  ];
  const changed = sequential.map((p) => ({ number: p.number, files: [...CROSS_LANE_FILES] }));

  assert.deepEqual(
    aliasesFromChangedFiles(sequential, changed),
    [],
    'nối tiếp nhau thì không phải va chạm, dù chung cả ba file và khác mã',
  );
  assert.deepEqual(duplicateClaims(sequential, aliasesFromChangedFiles(sequential, changed)), []);
});
