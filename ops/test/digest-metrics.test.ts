/**
 * `ops/scripts/digest-metrics.ts` — cơ chế của mục `platform/P-005`.
 *
 * Chỉ kiểm các hàm thuần và `collectMetrics` (chạy trên một kho tạm dựng
 * riêng cho phép thử, không phải trên chính kho này — cùng lý do với
 * `backlog-status.test.ts`: một phép thử dựa vào dữ liệu thật của repo đo
 * môi trường chứ không đo hành vi, và nó đổi màu mỗi lần có PR mới merge).
 *
 * Ba bài **âm** giữ đúng ba chỗ mà mục này cố ý không im lặng — xem đầu
 * `digest-metrics.ts`: PR không suy được làn, PR chưa có CI, issue
 * `decision` thiếu nhãn phân loại. Cả ba là hình dạng nhóm Z: số ra sai mà
 * không gì đỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  UNKNOWN_LANE,
  classifyDecision,
  collectMetrics,
  computeProgress,
  decisionRows,
  laneFromTitle,
  mergedByLane,
  needOwnerCount,
  openPrRows,
  parkedItems,
  probeDelayedHeadChanges,
  probeOrigins,
  renderDigestMetrics,
  rollupState,
  type GhPr,
} from '../scripts/digest-metrics.ts';
import type { BacklogItem } from '../scripts/backlog-status.ts';
import { step0LogRef, type LaneName, type RunLogLine } from '@crux/kernel';
import { conflictRows } from '../scripts/conflict-watch.ts';

const NOW = new Date('2026-09-21T18:00:00.000Z');
const SINCE = '2026-09-20T18:00:00.000Z';

function pr(number: number, headRefName: string, extra: Partial<GhPr> = {}): GhPr {
  return { number, title: `PR ${number}`, headRefName, ...extra };
}

// --- mergedByLane ---

test('mergedByLane: gom theo làn suy từ tên nhánh, theo thứ tự LANES cố định', () => {
  const groups = mergedByLane(
    [
      pr(1, 'claude/visual/V-001', { mergedAt: '2026-09-21T10:00:00Z' }),
      pr(2, 'claude/platform/P-004', { mergedAt: '2026-09-21T11:00:00Z' }),
      pr(3, 'claude/platform/P-021', { mergedAt: '2026-09-21T12:00:00Z' }),
    ],
    SINCE,
  );
  // Thứ tự nhóm theo `LANES` của kernel — sáu xưởng trước, rồi `kernel`,
  // `platform`, `verify`, `integration`. Nên `visual` đứng trước `platform`.
  assert.deepEqual(
    groups.map((g) => [g.lane, g.prs.map((p) => p.number)]),
    [
      ['visual', [1]],
      ['platform', [2, 3]],
    ],
  );
});

test('mergedByLane: PR merged trước mốc 24 giờ bị loại, PR chưa merge cũng vậy', () => {
  const groups = mergedByLane(
    [
      pr(1, 'claude/visual/V-001', { mergedAt: '2026-09-19T10:00:00Z' }),
      pr(2, 'claude/visual/V-002', { mergedAt: null }),
      pr(3, 'claude/visual/V-003', { mergedAt: '2026-09-21T10:00:00Z' }),
    ],
    SINCE,
  );
  assert.deepEqual(groups, [{ lane: 'visual', prs: [{ number: 3, title: 'PR 3', headRefName: 'claude/visual/V-003' }] }]);
});

test('mergedByLane: so bằng mốc thời gian, không so chuỗi — `gh` trả mức giây, `since` có mili giây', () => {
  // `since` thật LUÔN có mili giây (`new Date(...).toISOString()`), còn `gh`
  // trả `mergedAt` ở mức giây. So chuỗi thì `'Z' > '.'`, nên
  // `'…T18:00:00Z' > '…T18:00:00.293Z'` — một PR merged 293ms TRƯỚC mốc cắt
  // bị tính nhầm là trong 24 giờ. Ca này phải đỏ nếu ai đó đổi lại thành so chuỗi.
  const sinceWithMs = '2026-09-20T18:00:00.293Z';
  assert.ok('2026-09-20T18:00:00Z' > sinceWithMs, 'tiền đề của bài kiểm: so chuỗi cho kết quả ngược');

  assert.deepEqual(mergedByLane([pr(1, 'claude/visual/V-001', { mergedAt: '2026-09-20T18:00:00Z' })], sinceWithMs), []);
  assert.equal(
    mergedByLane([pr(2, 'claude/visual/V-001', { mergedAt: '2026-09-20T18:00:01Z' })], sinceWithMs).length,
    1,
  );
});

test('mergedByLane: `mergedAt` không đọc được thì GIỮ, không lặng lẽ coi là ngoài 24 giờ', () => {
  const groups = mergedByLane([pr(3, 'claude/visual/V-001', { mergedAt: 'hôm qua' })], SINCE);
  assert.deepEqual(
    groups.map((g) => [g.lane, g.prs.map((p) => p.number)]),
    [['visual', [3]]],
  );
});

test('ÂM — mergedByLane: nhánh không suy được làn ra nhóm riêng, KHÔNG biến mất', () => {
  // Ca thật: nền tảng gán nhánh `claude/<tên-ngẫu-nhiên>` cho một số lượt
  // routine (PR #62, #66). Bỏ chúng đi thì bảng "PR merged 24 giờ" thiếu
  // việc đã làm mà không gì đỏ.
  const groups = mergedByLane(
    [
      pr(62, 'claude/modest-dijkstra-mh59k5', { mergedAt: '2026-09-21T10:00:00Z' }),
      pr(39, 'claude/visual/V-001', { mergedAt: '2026-09-21T11:00:00Z' }),
    ],
    SINCE,
  );
  assert.deepEqual(
    groups.map((g) => [g.lane, g.prs.map((p) => p.number)]),
    [
      ['visual', [39]],
      [UNKNOWN_LANE, [62]],
    ],
  );
});

// --- rollupState ---

test('rollupState: mọi check xong và thành công thì xanh', () => {
  assert.equal(
    rollupState([
      { name: 'check', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'secret-scan', status: 'completed', conclusion: 'skipped' },
    ]),
    'xanh',
  );
});

test('rollupState: một check đỏ giữa các check xanh vẫn là đỏ', () => {
  assert.equal(
    rollupState([
      { name: 'check', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'protected-area', status: 'COMPLETED', conclusion: 'FAILURE' },
      { name: 'trailer-warn', status: 'IN_PROGRESS', conclusion: null },
    ]),
    'đỏ',
  );
});

test('rollupState: còn check chưa xong thì `đang chạy`, không đoán là xanh', () => {
  assert.equal(
    rollupState([
      { name: 'check', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { name: 'replay', status: 'QUEUED', conclusion: null },
    ]),
    'đang chạy',
  );
  // Status context (họ thứ hai trong cùng mảng) dùng `state`, không `status`.
  assert.equal(rollupState([{ context: 'ci/legacy', state: 'PENDING' }]), 'đang chạy');
  assert.equal(rollupState([{ context: 'ci/legacy', state: 'SUCCESS' }]), 'xanh');
  assert.equal(rollupState([{ context: 'ci/legacy', state: 'ERROR' }]), 'đỏ');
});

test('ÂM — rollupState: PR chưa có lần chạy CI nào KHÔNG được gộp vào `xanh`', () => {
  // Đây đúng là `KF-002`: `automerge.yml` bỏ qua PR không có CI xanh, nên
  // một PR như vậy đứng im mãi. Gọi nó là `xanh` trên bản tin thì không ai
  // đi tìm nó nữa.
  assert.equal(rollupState([]), 'chưa có');
  assert.equal(rollupState(null), 'chưa có');
  assert.equal(rollupState(undefined), 'chưa có');
});

// --- openPrRows ---

test('openPrRows: giữ nhãn, cờ nháp, làn và trạng thái CI', () => {
  const rows = openPrRows([
    pr(42, 'claude/visual/V-002', {
      isDraft: true,
      labels: [{ name: 'automerge-delayed' }],
      statusCheckRollup: [{ name: 'check', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    }),
    pr(66, 'claude/modest-dijkstra-r8p0o2', { labels: [{ name: 'owner-merge' }] }),
  ]);
  assert.deepEqual(rows, [
    { number: 42, title: 'PR 42', lane: 'visual', labels: ['automerge-delayed'], isDraft: true, ci: 'xanh' },
    { number: 66, title: 'PR 66', lane: UNKNOWN_LANE, labels: ['owner-merge'], isDraft: false, ci: 'chưa có' },
  ]);
});

// --- parkedItems ---

test('parkedItems: chỉ lấy mục `parked`, kèm tên mục', () => {
  const content = [
    '### VF-G7 · Điều khoản TTS, stock, font, bản đồ',
    '- status: parked',
    '',
    '### VF-G9 · Thuê người soát bản địa',
    '- status: review',
    '',
    '### VF-G15 · Phần L của spec tham chiếu',
    '- status: parked',
    '',
  ].join('\n');
  assert.deepEqual(parkedItems('verify', content), [
    { lane: 'verify', id: 'VF-G7', title: 'Điều khoản TTS, stock, font, bản đồ' },
    { lane: 'verify', id: 'VF-G15', title: 'Phần L của spec tham chiếu' },
  ]);
});

// --- Quyết định ---

test('classifyDecision: nhãn irreversible thắng, thiếu cả hai thì `chưa phân loại`', () => {
  assert.equal(classifyDecision(['decision', 'irreversible']), 'irreversible');
  assert.equal(classifyDecision(['decision', 'reversible']), 'reversible');
  assert.equal(classifyDecision(['decision']), 'chưa phân loại');
});

test('decisionRows: bỏ qua issue không mang nhãn `decision`', () => {
  const rows = decisionRows([
    { number: 19, title: '🤖 [QĐ] A', labels: [{ name: 'decision' }, { name: 'irreversible' }] },
    { number: 20, title: '🤖 [Bản tin] 2026-09-21', labels: [{ name: 'digest' }] },
  ]);
  assert.deepEqual(rows, [{ number: 19, title: '🤖 [QĐ] A', kind: 'irreversible' }]);
});

test('needOwnerCount: reversible KHÔNG tính vào "Cần anh quyết" (D-C06)', () => {
  const rows = decisionRows([
    { number: 1, title: 'a', labels: [{ name: 'decision' }, { name: 'irreversible' }] },
    { number: 2, title: 'b', labels: [{ name: 'decision' }, { name: 'reversible' }] },
  ]);
  assert.equal(needOwnerCount(rows), 1);
});

test('ÂM — needOwnerCount: issue `decision` thiếu nhãn phân loại VẪN được đếm', () => {
  // Thận trọng theo hướng an toàn: thừa một dòng tốn vài giây của chủ dự
  // án; thiếu một dòng thì một nhánh việc nằm chờ vô hạn.
  const rows = decisionRows([{ number: 3, title: 'c', labels: [{ name: 'decision' }] }]);
  assert.equal(needOwnerCount(rows), 1);
  assert.match(renderDigestMetrics(baseMetrics({ decisions: rows })), /#3 · c \(chưa phân loại/);
});

// --- renderDigestMetrics ---

function baseMetrics(over: Partial<Parameters<typeof renderDigestMetrics>[0]> = {}) {
  return {
    since: SINCE,
    merged: [],
    openPrs: [],
    conflicts: [],
    delayed: [],
    parked: [],
    decisions: [],
    cost: { cost24h: 0, total: 0, budget: 600, percent: 0 },
    progress: {
      doneLast24h: 0,
      done3d: 0,
      throughputPerDay: 0,
      byBatch: [],
      bottleneck: 'không tắc' as const,
      routineRuns24h: 0,
    },
    ...over,
  };
}

test('renderDigestMetrics: dòng đầu LUÔN là `Cần anh quyết: N việc`, kể cả khi N = 0', () => {
  assert.equal(renderDigestMetrics(baseMetrics()).split('\n')[0], 'Cần anh quyết: 0 việc');
  const rows = decisionRows([
    { number: 19, title: 'A', labels: [{ name: 'decision' }, { name: 'irreversible' }] },
    { number: 14, title: 'B', labels: [{ name: 'decision' }, { name: 'irreversible' }] },
  ]);
  assert.equal(renderDigestMetrics(baseMetrics({ decisions: rows })).split('\n')[0], 'Cần anh quyết: 2 việc');
});

test('renderDigestMetrics: đủ năm nhóm số liệu mà tiêu chí xong đòi', () => {
  const text = renderDigestMetrics(
    baseMetrics({
      merged: mergedByLane([pr(65, 'claude/platform/P-004', { mergedAt: '2026-09-21T10:00:00Z' })], SINCE),
      openPrs: openPrRows([pr(39, 'claude/visual/V-001', { labels: [{ name: 'automerge-delayed' }] })]),
      parked: [{ lane: 'verify', id: 'VF-G7', title: 'Điều khoản TTS' }],
      decisions: decisionRows([{ number: 5, title: 'C', labels: [{ name: 'decision' }, { name: 'reversible' }] }]),
      cost: { cost24h: 1.5, total: 12.25, budget: 600, percent: 2 },
    }),
  );
  assert.match(text, /^Cần anh quyết: 0 việc$/m);
  assert.match(text, /^Quyết định reversible đang mở: 1$/m);
  assert.match(text, /^PR merged từ 2026-09-20T18:00:00\.000Z: 1$/m);
  assert.match(text, /^- platform: #65$/m);
  assert.match(text, /^PR đang mở: 1$/m);
  assert.match(text, /^- #39 · CI chưa có · automerge-delayed · PR 39$/m);
  assert.match(text, /^PR đang xung đột với `main`: 0$/m);
  assert.match(text, /^Mục parked: 1$/m);
  assert.match(text, /^- verify\/VF-G7 · Điều khoản TTS$/m);
  assert.match(text, /^Chi phí: 24 giờ 1\.5 USD · tích luỹ 12\.25 USD · 2% ngân sách học \(600 USD, CHARTER mục 8\)$/m);
});

// --- collectMetrics: lớp đọc đĩa, trên kho tạm ---

test('collectMetrics: đọc backlog và log thật, cộng tiền theo bất biến I8', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-'));
  try {
    mkdirSync(join(root, 'ops', 'lanes', 'audio'), { recursive: true });
    mkdirSync(join(root, 'ops', 'lanes', 'verify'), { recursive: true });
    mkdirSync(join(root, 'ops', 'lanes', 'topic'), { recursive: true });
    mkdirSync(join(root, 'ops', 'logs', 'platform'), { recursive: true });
    writeFileSync(join(root, 'ops', 'lanes', 'audio', 'backlog.md'), '### AU-001 · Giọng đọc\n- status: parked\n');
    writeFileSync(join(root, 'ops', 'lanes', 'verify', 'backlog.md'), '### VF-G7 · Điều khoản\n- status: parked\n');
    writeFileSync(join(root, 'ops', 'lanes', 'topic', 'backlog.md'), '### T-001 · Bản đồ đề tài\n- status: parked\n');

    // Một dòng trong 24 giờ, một dòng cũ hơn, và một dòng `rollup` trùng
    // tiền với dòng stage — `sumCostUsd` phải bỏ dòng rollup, nếu không
    // mỗi tập bị tính hai lần.
    writeFileSync(
      join(root, 'ops', 'logs', 'platform', 'P-001.jsonl'),
      [
        '{"at":"2026-09-21T10:00:00.000Z","lane":"platform","kind":"stage","ref":"platform/P-001","status":"ok","durationMs":1,"costUsd":2}',
        '{"at":"2026-09-21T10:00:01.000Z","lane":"platform","kind":"lane","ref":"platform/P-001","status":"ok","durationMs":1,"costUsd":2,"rollup":true}',
        '{"at":"2026-09-01T10:00:00.000Z","lane":"platform","kind":"stage","ref":"platform/P-001","status":"ok","durationMs":1,"costUsd":10}',
        '',
      ].join('\n'),
    );

    const metrics = collectMetrics(
      root,
      {
        mergedPrs: [pr(1, 'claude/platform/P-001', { mergedAt: '2026-09-21T10:00:00Z' })],
        openPrs: [pr(2, 'claude/audio/AU-002')],
        decisionIssues: [{ number: 9, title: 'D', labels: [{ name: 'decision' }, { name: 'irreversible' }] }],
      },
      NOW,
    );

    assert.equal(metrics.since, SINCE);
    // Thứ tự mục `parked` theo `LANES` (topic → audio → verify), KHÔNG theo
    // thứ tự `readdirSync` trả về — bản tin đọc mỗi sáng thì thứ tự phải ổn định.
    assert.deepEqual(metrics.parked, [
      { lane: 'topic', id: 'T-001', title: 'Bản đồ đề tài' },
      { lane: 'audio', id: 'AU-001', title: 'Giọng đọc' },
      { lane: 'verify', id: 'VF-G7', title: 'Điều khoản' },
    ]);
    assert.deepEqual(
      metrics.merged.map((g) => [g.lane, g.prs.map((p) => p.number)]),
      [['platform', [1]]],
    );
    assert.equal(metrics.openPrs[0]!.ci, 'chưa có');
    assert.equal(metrics.cost.cost24h, 2);
    assert.equal(metrics.cost.total, 12);
    assert.equal(metrics.cost.budget, 600);
    assert.equal(metrics.cost.percent, 2);
    assert.equal(needOwnerCount(metrics.decisions), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- Mục `P-007`: PR đang xung đột với `main` ---

test('P-007 · chưa dò thì bản tin nói CHƯA DÒ, không nói 0', () => {
  // `0` và `chưa dò` là hai chuyện khác nhau. Một bản tin nói "0 PR xung
  // đột" trong khi hàng đợi merge đang tắc là đúng rủi ro B7 mà mục này
  // sinh ra để bịt — và là nhóm Z: sai mà không gì đỏ.
  const text = renderDigestMetrics(baseMetrics({ conflicts: null }));
  assert.match(text, /^PR đang xung đột với `main`: CHƯA DÒ/m);
  assert.doesNotMatch(text, /^PR đang xung đột với `main`: 0$/m);
});

test('P-007 · mỗi PR xung đột một dòng, kẹt lâu nhất trước, kèm số giờ', () => {
  const text = renderDigestMetrics(
    baseMetrics({
      conflicts: conflictRows(
        [
          {
            number: 56,
            title: 'P-021',
            labels: ['automerge-delayed'],
            origin: { sha: 'b', committedAt: '2026-09-21T17:00:00Z', exact: true },
          },
          {
            number: 39,
            title: 'V-001',
            labels: ['automerge-delayed'],
            origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true },
          },
        ],
        NOW.toISOString(),
      ),
    }),
  );
  assert.match(text, /^PR đang xung đột với `main`: 2$/m);
  const lines = text.split('\n');
  const first = lines.findIndex((line) => line.startsWith('- #39'));
  const second = lines.findIndex((line) => line.startsWith('- #56'));
  assert.ok(first !== -1 && second !== -1 && first < second, 'kẹt lâu nhất (#39, 3 giờ) phải đứng trước');
  assert.match(lines[first]!, /kẹt 3\.00 giờ/);
  assert.match(lines[first]!, /đồng hồ chờ KHÔNG chạy/);
});

test('P-007 · collectMetrics chỉ đưa vào mục xung đột những PR ĐÃ dò ra mốc', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-conflict-'));
  try {
    mkdirSync(join(root, 'ops', 'lanes', 'platform'), { recursive: true });
    writeFileSync(join(root, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · x\n- status: ready\n');

    const openPrs = [
      pr(39, 'claude/visual/V-001', { labels: [{ name: 'automerge-delayed' }] }),
      pr(42, 'claude/visual/V-002'),
      pr(70, 'claude/modest-dijkstra-0gfgc6'),
    ];
    const metrics = collectMetrics(
      root,
      { mergedPrs: [], openPrs, decisionIssues: [] },
      NOW,
      new Map([
        // #39 xung đột · #42 sạch · #70 không có khoá = chưa dò.
        [39, { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true }],
        [42, null],
      ]),
    );

    assert.deepEqual(metrics.conflicts?.map((row) => row.number), [39]);
    assert.equal(metrics.conflicts?.[0]!.hoursStuck, 3);
    assert.equal(metrics.openPrs.length, 3, 'PR chưa dò vẫn nằm trong mục "PR đang mở"');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I-017 · PR dò HỎNG hiện ra mục xung đột với "KHÔNG dò được mốc", không biến mất như PR sạch', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-probeerr-'));
  try {
    mkdirSync(join(root, 'ops', 'lanes', 'platform'), { recursive: true });
    writeFileSync(join(root, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · x\n- status: ready\n');

    const openPrs = [pr(65, 'claude/platform/P-004'), pr(66, 'claude/platform/P-003')];
    const metrics = collectMetrics(
      root,
      { mergedPrs: [], openPrs, decisionIssues: [] },
      NOW,
      new Map([
        // #65 sạch (biến mất khỏi mục); #66 dò hỏng → PHẢI hiện ra, hoursStuck null.
        [65, null],
        [66, { error: 'git merge-tree thoát 128: refusing to merge unrelated histories' }],
      ]),
    );

    assert.deepEqual(metrics.conflicts?.map((row) => row.number), [66]);
    assert.equal(metrics.conflicts?.[0]!.hoursStuck, null, 'PR hỏng không có mốc kẹt → hoursStuck null');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-007 · không truyền kết quả gộp thử thì conflicts là null, KHÔNG phải mảng rỗng', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-conflict-'));
  try {
    mkdirSync(join(root, 'ops', 'lanes', 'platform'), { recursive: true });
    writeFileSync(join(root, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · x\n- status: ready\n');
    const metrics = collectMetrics(root, { mergedPrs: [], openPrs: [], decisionIssues: [] }, NOW);
    assert.equal(metrics.conflicts, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-007 · dò xung đột hỏng thì bản tin rơi về CHƯA DÒ, KHÔNG chết cả bản tin', () => {
  // `measureConflicts` ném khi `git fetch` hụt. Để nó ném ra khỏi `main()`
  // thì bản tin mất luôn "Cần anh quyết", chi phí, `parked` — một tính năng
  // mới hạ một tính năng đang chạy (`CLAUDE.md` mục 14, "Một hộp duy nhất").
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-noremote-'));
  try {
    const snapshot = { mergedPrs: [], openPrs: [pr(1, 'claude/platform/P-001')], decisionIssues: [] };
    // `root` không phải kho git và không có remote `origin` → `git fetch` hỏng.
    assert.equal(probeOrigins(root, snapshot, []), null);
    // `--no-conflicts` cũng ra `null`, nhưng không đi qua git lần nào.
    assert.equal(probeOrigins(root, snapshot, ['--no-conflicts']), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- Mục `P-027`: "Đang chờ merge" nói số giờ theo đồng hồ đã bị đặt lại ---

/** Kho tạm tối thiểu mà `collectMetrics` cần: một backlog và một thư mục log. */
function ROOT_WITH_BACKLOG(): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-delayed-'));
  mkdirSync(join(root, 'ops', 'lanes', 'platform'), { recursive: true });
  writeFileSync(join(root, 'ops', 'lanes', 'platform', 'backlog.md'), '### P-001 · x\n- status: ready\n');
  return root;
}

test('P-027 · chưa đo thì bản tin nói CHƯA ĐO, không nói 0', () => {
  // Cùng lý do với `CHƯA DÒ` của P-007: "0 PR đang chờ" trong khi 14 PR
  // nằm kẹt là nhóm Z — sai mà không gì đỏ.
  const text = renderDigestMetrics(baseMetrics({ delayed: null }));
  assert.match(text, /^Đang chờ merge: CHƯA ĐO/m);
  assert.doesNotMatch(text, /^Đang chờ merge: 0$/m);
});

test('P-027 · mỗi PR delayed một dòng, gần tới hạn trước, kèm số giờ còn thiếu thật', () => {
  const root = ROOT_WITH_BACKLOG();
  try {
  const metrics = collectMetrics(
    root,
    {
      mergedPrs: [],
      openPrs: [
        pr(39, 'claude/visual/V-001', { labels: [{ name: 'automerge-delayed' }] }),
        pr(42, 'claude/visual/V-002', { labels: [{ name: 'automerge-delayed' }] }),
      ],
      decisionIssues: [],
    },
    NOW,
    null,
    new Map([
      // #39: đầu nhánh vừa đổi 20 phút trước — đồng hồ về 0.
      [39, ['2026-09-21T17:40:00Z']],
      // #42: đứng yên 14 giờ — đã qua ngưỡng, nên dòng dặn là câu bình thường.
      [42, ['2026-09-21T04:00:00Z']],
    ]),
  );

  assert.deepEqual(metrics.delayed?.map((row) => row.number), [42, 39]);
  assert.equal(metrics.delayed?.[1]!.hoursShort, 11.67);
  assert.equal(metrics.delayed?.[1]!.everReachedThreshold, false);

  const text = renderDigestMetrics(metrics);
  assert.match(text, /^Đang chờ merge: 2$/m);
  assert.match(text, /#39 · .*còn thiếu 11\.67/m);
  // #42 đã từng đạt ngưỡng, nên dòng dặn là câu bình thường.
  assert.match(text, /comment `dừng` ngay trên PR đó/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-027 · không truyền kết quả đo thì delayed là null, KHÔNG phải mảng rỗng', () => {
  const root = ROOT_WITH_BACKLOG();
  try {
    const metrics = collectMetrics(root, { mergedPrs: [], openPrs: [], decisionIssues: [] }, NOW);
    assert.equal(metrics.delayed, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-027 · hàng đợi delayed RỖNG ra map rỗng, không ra null — hai chuyện khác nhau', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-digest-delayed-'));
  try {
    // Không PR nào mang nhãn: trả lời thật, và không đi qua git lần nào
    // (thư mục này không phải kho git, nên một lần `git fetch` sẽ ném).
    const empty = probeDelayedHeadChanges(root, { mergedPrs: [], openPrs: [pr(1, 'claude/platform/P-001')], decisionIssues: [] }, []);
    assert.deepEqual(empty, new Map());

    // Có PR delayed nhưng git hỏng → `null`, và bản tin in CHƯA ĐO thay vì
    // kéo cả lượt chạy xuống theo.
    const broken = probeDelayedHeadChanges(
      root,
      { mergedPrs: [], openPrs: [pr(2, 'claude/platform/P-002', { labels: [{ name: 'automerge-delayed' }] })], decisionIssues: [] },
      [],
    );
    assert.equal(broken, null);
    assert.equal(probeDelayedHeadChanges(root, { mergedPrs: [], openPrs: [], decisionIssues: [] }, ['--no-delayed']), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-027 · bản tin KHÔNG khuyên "không làm gì thì nó tự vào main" khi không PR nào đủ ngưỡng', () => {
  // Đây là chỗ câu chữ sai gây thiệt hại trực tiếp nhất: chủ dự án đọc bản
  // tin đúng để quyết định *không làm gì*, và KF-011 nói máy chưa một lần
  // merge được PR delayed nào.
  const root = ROOT_WITH_BACKLOG();
  try {
    const metrics = collectMetrics(
      root,
      {
        mergedPrs: [],
        openPrs: [pr(39, 'claude/visual/V-001', { labels: [{ name: 'automerge-delayed' }] })],
        decisionIssues: [],
      },
      NOW,
      null,
      new Map([[39, ['2026-09-21T17:40:00Z']]]),
    );
    const text = renderDigestMetrics(metrics);
    assert.match(text, /Cửa delayed hiện CHƯA CHẢY/);
    assert.doesNotMatch(text, /Không làm gì thì PR đủ giờ tự vào/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-027 · PR đang xung đột KHÔNG hiện hai câu trái nhau trong bản tin', () => {
  // Phụ lục P2: đồng hồ 12 giờ không chạy khi đang xung đột, nên dòng
  // "Đang chờ merge" phải THAY số giờ, không in song song với mục P-007.
  const root = ROOT_WITH_BACKLOG();
  try {
    const metrics = collectMetrics(
      root,
      {
        mergedPrs: [],
        openPrs: [pr(109, 'claude/platform/P-025', { labels: [{ name: 'automerge-delayed' }] })],
        decisionIssues: [],
      },
      NOW,
      new Map([[109, { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true }]]),
      new Map([[109, ['2026-09-21T17:40:00Z']]]),
    );
    const text = renderDigestMetrics(metrics);
    assert.match(text, /^- #109 · xung đột — đồng hồ 12 giờ KHÔNG chạy/m);
    // Dòng "Đang chờ merge" của PR đó KHÔNG được kèm số giờ song song với
    // mục "PR đang xung đột" ngay trên.
    assert.doesNotMatch(text, /^- #109 · đổi đầu nhánh/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('P-027 · PR mang nhãn mà thiếu trong map đo hiện ra CHƯA ĐO, không biến mất khỏi đếm', () => {
  const root = ROOT_WITH_BACKLOG();
  try {
    const metrics = collectMetrics(
      root,
      {
        mergedPrs: [],
        openPrs: [
          pr(39, 'claude/visual/V-001', { labels: [{ name: 'automerge-delayed' }] }),
          pr(42, 'claude/visual/V-002', { labels: [{ name: 'automerge-delayed' }] }),
        ],
        decisionIssues: [],
      },
      NOW,
      null,
      // #42 thiếu hẳn khoá.
      new Map([[39, ['2026-09-21T17:40:00Z']]]),
    );
    assert.equal(metrics.delayed?.length, 2, 'PR thiếu trong map đo vẫn phải được đếm');
    const missing = metrics.delayed!.find((row) => row.number === 42)!;
    assert.equal(missing.headChanges, 0);
    assert.equal(missing.hoursShort, null);
    assert.match(renderDigestMetrics(metrics), /#42 · không đọc được lần đổi đầu nhánh nào/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- Tiến độ (mục `platform/P-019`) ---

function item(id: string, status: string): BacklogItem {
  // `deps: null` = mục không khai dòng `- deps:`, đúng hình dạng của fixture
  // tối giản ở đây. `computeProgress` không đọc trường này; nó có mặt vì
  // `BacklogItem` (mục `integration/I-015`) đòi khai đủ, không mặc định.
  return { id, status, title: id, hasHoldMarker: status === 'parked', statusLine: 1, deps: null };
}

function step0Line(at: string): RunLogLine {
  return { at, lane: 'platform', kind: 'lane', ref: 'platform/P-016', status: 'ok', durationMs: 0, costUsd: 0 };
}

test('laneFromTitle: lấy làn từ tiêu đề `[lane] id`, null khi không theo mẫu hoặc làn lạ', () => {
  assert.equal(laneFromTitle('[platform] P-024 — abc'), 'platform');
  assert.equal(laneFromTitle('[visual] V-001 — x'), 'visual');
  assert.equal(laneFromTitle('Gộp origin/main (integrator, không xung đột)'), null);
  assert.equal(laneFromTitle('[bogus] X-1 — y'), null);
});

test('computeProgress: đếm mục done 24h/3d và thông lượng, chỉ tính PR mang mã mục', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const merged: GhPr[] = [
    { number: 1, title: '[platform] P-001 — a', headRefName: 'x', mergedAt: '2026-09-22T06:00:00Z' }, // 24h
    { number: 2, title: '[visual] V-001 — b', headRefName: 'x', mergedAt: '2026-09-20T13:00:00Z' }, // 3d, ngoài 24h
    { number: 3, title: 'Gộp origin/main', headRefName: 'x', mergedAt: '2026-09-22T06:00:00Z' }, // không mã mục
    { number: 4, title: '[platform] P-002 — c', headRefName: 'x', mergedAt: '2026-09-10T06:00:00Z' }, // ngoài 3d
  ];
  const p = computeProgress(new Map(), merged, [], 0, 0, now);
  assert.equal(p.doneLast24h, 1);
  assert.equal(p.done3d, 2);
  assert.equal(p.throughputPerDay, 0.67);
});

test('computeProgress: mục còn lại và parked gom theo đợt (suy từ làn), done không tính', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const itemsByLane = new Map<LaneName, BacklogItem[]>([
    ['platform', [item('P-1', 'ready'), item('P-2', 'review'), item('P-3', 'done'), item('P-4', 'parked')]],
    ['visual', [item('V-1', 'ready'), item('V-2', 'done')]],
  ]);
  const p = computeProgress(itemsByLane, [], [], 0, 0, now);
  const d0 = p.byBatch.find((b) => b.batch === 'Đợt 0')!;
  const d1 = p.byBatch.find((b) => b.batch === 'Đợt 1')!;
  assert.equal(d0.remaining, 2);
  assert.equal(d0.parked, 1);
  assert.equal(d1.remaining, 1);
  assert.equal(d1.parked, 0);
});

test('computeProgress: chiếu ngày xong theo thông lượng của đợt; null khi 3 ngày không mục nào done', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const merged: GhPr[] = [
    { number: 1, title: '[visual] V-1 — a', headRefName: 'x', mergedAt: '2026-09-21T00:00:00Z' },
    { number: 2, title: '[visual] V-2 — a', headRefName: 'x', mergedAt: '2026-09-21T00:00:00Z' },
    { number: 3, title: '[audio] AU-1 — a', headRefName: 'x', mergedAt: '2026-09-21T00:00:00Z' },
  ];
  const itemsByLane = new Map<LaneName, BacklogItem[]>([
    ['visual', [item('V-3', 'ready'), item('V-4', 'ready'), item('V-5', 'ready'), item('V-6', 'ready')]],
    ['platform', [item('P-1', 'ready')]],
  ]);
  const p = computeProgress(itemsByLane, merged, [], 0, 0, now);
  const d1 = p.byBatch.find((b) => b.batch === 'Đợt 1')!;
  const d0 = p.byBatch.find((b) => b.batch === 'Đợt 0')!;
  assert.equal(d1.done3d, 3);
  assert.equal(d1.projectedDone, '2026-09-26'); // now + ceil(4 / 1) = 4 ngày
  assert.equal(d0.projectedDone, null); // còn việc mà 3 ngày không mục nào done
});

test('computeProgress: đợt hết việc thì dự kiến xong là hôm nay', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const itemsByLane = new Map<LaneName, BacklogItem[]>([['platform', [item('P-1', 'done')]]]);
  const d0 = computeProgress(itemsByLane, [], [], 0, 0, now).byBatch.find((b) => b.batch === 'Đợt 0')!;
  assert.equal(d0.remaining, 0);
  assert.equal(d0.projectedDone, '2026-09-22');
});

test('computeProgress: nút thắt người đứng trước máy; đếm đúng lượt bước 0 trong 24 giờ', () => {
  const now = new Date('2026-09-22T12:00:00.000Z');
  const logs: RunLogLine[] = [
    step0Line('2026-09-22T06:00:00.000Z'), // trong 24h
    step0Line('2026-09-22T00:30:00.000Z'), // trong 24h
    step0Line('2026-09-20T06:00:00.000Z'), // ngoài 24h
    { at: '2026-09-22T06:00:00.000Z', lane: 'platform', kind: 'stage', ref: 'platform/P-016', status: 'ok', durationMs: 0, costUsd: 0 }, // kind stage
    { at: '2026-09-22T06:00:00.000Z', lane: 'visual', kind: 'lane', ref: 'visual/V-001', status: 'ok', durationMs: 0, costUsd: 0 }, // ref khác
  ];
  assert.equal(computeProgress(new Map(), [], logs, 0, 0, now).routineRuns24h, 2);
  assert.equal(computeProgress(new Map(), [], [], 2, 5, now).bottleneck, 'người'); // người thắng máy
  assert.equal(computeProgress(new Map(), [], [], 0, 3, now).bottleneck, 'máy');
  assert.equal(computeProgress(new Map(), [], [], 0, 0, now).bottleneck, 'không tắc');
});

test('P-036 · đếm cả dòng bước 0 hình dạng P-023 (`integration/step0-…`), không chỉ file phẳng cũ', () => {
  // Tái hiện lỗi nhóm Z ở bản tin #193: sau khi P-023 vào `main`, mọi dòng
  // bước 0 mang `ref` do `step0LogRef` sinh (`integration/step0-…`). `isStep0Line`
  // cũ chỉ khớp `platform/P-016`, nên số lượt routine tụt về 0 im lặng. Trước
  // bản vá dòng này ra 0; sau bản vá ra 3 (không đếm dòng `kind: stage` và dòng
  // mục thường trùng cửa sổ thời gian).
  const now = new Date('2026-09-23T14:00:00.000Z');
  const logs: RunLogLine[] = [
    { at: '2026-09-23T12:26:03.000Z', lane: 'integration', kind: 'lane', ref: step0LogRef('2026-09-23T12:26:03.000Z', 'crux-worker-2'), status: 'ok', durationMs: 0, costUsd: 0 },
    { at: '2026-09-23T12:38:30.000Z', lane: 'integration', kind: 'lane', ref: step0LogRef('2026-09-23T12:38:30.000Z', 'crux-worker-1'), status: 'ok', durationMs: 0, costUsd: 0 },
    step0Line('2026-09-23T06:00:00.000Z'), // hình dạng cũ `platform/P-016`, vẫn phải đếm
    { at: '2026-09-21T06:00:00.000Z', lane: 'integration', kind: 'lane', ref: step0LogRef('2026-09-21T06:00:00.000Z', 'crux-worker-3'), status: 'ok', durationMs: 0, costUsd: 0 }, // ngoài 24h
    { at: '2026-09-23T12:00:00.000Z', lane: 'integration', kind: 'stage', ref: step0LogRef('2026-09-23T12:00:00.000Z', 'crux-worker-1'), status: 'ok', durationMs: 0, costUsd: 0 }, // kind stage → không tính
    { at: '2026-09-23T12:00:00.000Z', lane: 'platform', kind: 'lane', ref: 'platform/P-019', status: 'ok', durationMs: 0, costUsd: 0 }, // dòng mục thường → không tính
  ];
  assert.equal(computeProgress(new Map(), [], logs, 0, 0, now).routineRuns24h, 3);
});

test('renderDigestMetrics: mục Tiến độ hiện đủ dòng theo tiêu chí xong của P-019', () => {
  const text = renderDigestMetrics(
    baseMetrics({
      progress: {
        doneLast24h: 3,
        done3d: 6,
        throughputPerDay: 2,
        byBatch: [
          { batch: 'Đợt 0', remaining: 5, parked: 1, done3d: 2, projectedDone: '2026-09-25' },
          { batch: 'Đợt 1', remaining: 8, parked: 0, done3d: 4, projectedDone: null },
        ],
        bottleneck: 'người',
        routineRuns24h: 12,
      },
    }),
  );
  assert.match(text, /^Tiến độ$/m);
  assert.match(text, /^- Mục done 24 giờ: 3 · thông lượng 3 ngày: 2 mục\/ngày$/m);
  assert.match(text, /^- Đợt 0: 5 mục còn lại \(1 parked\) · dự kiến xong: 2026-09-25$/m);
  assert.match(text, /^- Đợt 1: 8 mục còn lại · dự kiến xong: chưa đủ dữ liệu để chiếu$/m);
  assert.match(text, /^- Nút thắt hiện tại: người$/m);
  assert.match(text, /^- Lượt chạy routine 24 giờ: 12 \(số để kiểm giả định G3\)$/m);
});
