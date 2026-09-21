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
  decisionRows,
  mergedByLane,
  needOwnerCount,
  openPrRows,
  parkedItems,
  renderDigestMetrics,
  rollupState,
  type GhPr,
} from '../scripts/digest-metrics.ts';

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
    parked: [],
    decisions: [],
    cost: { cost24h: 0, total: 0, budget: 600, percent: 0 },
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
