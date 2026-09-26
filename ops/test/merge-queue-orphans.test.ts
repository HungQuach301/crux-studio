/**
 * Mục `platform/P-060` — `ops/known-failures.md` **KF-044**: một PR mở,
 * không nháp, CI xanh, **không mang nhãn cửa merge nào**, nên
 * `automerge.yml` (lọc hàng đợi theo nhãn) không bao giờ thấy nó.
 *
 * **Bài tái hiện lỗi** là bài đầu tiên dưới đây: nó dựng lại đúng ảnh chụp
 * bảy PR đang mở lúc `2026-09-26T08:30:00Z` và đòi hàm chỉ ra **#223**, kèm
 * số giờ kẹt. Chạy bài này trên luật cũ là không chạy được gì cả — luật cũ
 * là một ô ⬜ chưa tick trong mục `P-048`, đúng chỗ hỏng mà mục này gỡ.
 *
 * Mỗi ca cho qua đi kèm ca âm của nó (bài học `KF-003`): một luật không bao
 * giờ đỏ là một luật vô giá trị.
 *
 * Nhóm bài **"mốc ở TƯƠNG LAI"** dưới đây là phát hiện **CHẶN** của vòng
 * soát ngữ cảnh sạch (bước 6 phụ lục P1) trên bản đầu của mục này: bản đó
 * để `hoursSilent` âm, và một số âm nhỏ hơn mọi ngưỡng nên nó **tự tắt** báo
 * động với `problems` rỗng và CLI thoát **0** — đúng chữ ký `I-021`/`Z7` mà
 * ba tool anh em (`conflict-watch.ts`, `gate-flow.ts`, `lane-heartbeat.ts`)
 * đều đã canh.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LABEL_FOR_GATE } from '../invariants.merge-gate.ts';
import { FUTURE_TOLERANCE_HOURS } from '../scripts/lane-heartbeat.ts';
import {
  LABELLED_BASE_REF,
  MERGE_GATE_LABELS,
  ORPHAN_ALERT_HOURS,
  OWNER_QUEUE_LABEL,
  type QueueOrphanInput,
  queueOrphans,
  renderQueueOrphans,
} from '../scripts/merge-queue-orphans.ts';

/** Mốc phép đo của `KF-044` — bước 0 lượt `crux-worker-2` `2026-09-26`. */
const KF044_NOW = '2026-09-26T08:30:00Z';

const open = (
  number: number,
  title: string,
  labels: readonly string[],
  headCommittedAt: string,
  createdAt: string,
): QueueOrphanInput => ({
  number,
  title,
  isDraft: false,
  labels,
  baseRef: 'main',
  createdAt,
  closedAt: null,
  mergedAt: null,
  headCommittedAt,
});

/**
 * Bảy PR đang mở lúc `KF044_NOW`, nhãn và mốc lấy bằng `gh pr list` cộng
 * `git log -1 --format=%cI` trên từng đầu nhánh. Chỉ **một** PR có `labels`
 * rỗng, và đó là ca thật.
 */
const KF044_OPEN_PRS: QueueOrphanInput[] = [
  open(223, '[platform] P-014 — sóng 3 nhóm Z: cân đối log/merge theo làn (Z14)', [], '2026-09-25T05:28:04Z', '2026-09-24T04:38:39Z'),
  open(231, '[platform] P-044 — fix · cảnh báo `main` đỏ không bao giờ được đóng', ['fix', 'automerge-delayed'], '2026-09-26T01:42:56Z', '2026-09-24T09:44:16Z'),
  open(249, '[platform] P-047 — fix · lượt `ci.yml` bị huỷ để lại check `cancelled`', ['fix', 'automerge-delayed'], '2026-09-26T04:21:30Z', '2026-09-24T20:46:10Z'),
  open(260, '[platform] P-053 — bản tin thêm mục "Việc đang chờ anh" (C1 + C4)', ['automerge-delayed'], '2026-09-26T04:38:46Z', '2026-09-25T05:51:35Z'),
  open(261, '[platform] P-055 — fix · KF-026 cộng lần thứ ba', ['fix', 'automerge-delayed'], '2026-09-26T00:42:40Z', '2026-09-25T07:14:04Z'),
  open(274, '[platform] P-057 — bộ dò cross-lane đếm cả ops/logs/<làn>/', ['automerge-delayed'], '2026-09-26T01:42:52Z', '2026-09-26T01:43:52Z'),
  open(282, '[integration] bước 0 lượt crux-worker-2 07:25Z — 0 PR xung đột', ['automerge'], '2026-09-26T08:05:17Z', '2026-09-26T07:38:52Z'),
];

/** #223 một mình, để các ca biên không phải dựng lại cả bảy PR. */
const only223 = (patch: Partial<QueueOrphanInput> = {}): QueueOrphanInput[] => [
  { ...KF044_OPEN_PRS[0]!, ...patch },
];

// ── Bài tái hiện lỗi (I2) ──────────────────────────────────────────────────

test('KF-044: #223 không mang nhãn cửa merge nào → chỉ ra ĐÚNG nó, kèm giờ kẹt', () => {
  const report = queueOrphans(KF044_OPEN_PRS, KF044_NOW);

  assert.equal(report.checked, 7);
  assert.equal(report.drafts, 0);
  assert.equal(report.closed, 0);
  assert.equal(report.otherBase, 0);
  assert.deepEqual(
    report.orphans.map((row) => row.number),
    [223],
    'sáu PR kia đều mang một nhãn cửa merge, nên chỉ #223 được kể',
  );
  assert.deepEqual(report.overThreshold.map((row) => row.number), [223]);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.warnings, []);

  const row = report.orphans[0]!;
  // 2026-09-25T05:28:04Z → 2026-09-26T08:30:00Z = 27,03 giờ (đầu nhánh mới
  // hơn lúc mở PR, nên mốc đo là đầu nhánh).
  assert.equal(row.sinceAt, '2026-09-25T05:28:04Z');
  assert.ok(row.hoursSilent !== null);
  assert.ok(Math.abs(row.hoursSilent - 27.03) < 0.02, `giờ kẹt phải ~27,03 (đo thật), nhận ${row.hoursSilent}`);
  assert.equal(row.overThreshold, true);
  assert.equal(row.clockSkew, false);
  assert.deepEqual(row.labels, [], 'nhãn rỗng là chính chữ ký của ca này');
});

test('KF-044: báo cáo nói ra "KHÔNG BAO GIỜ", không nói "chậm"', () => {
  const render = renderQueueOrphans(queueOrphans(KF044_OPEN_PRS, KF044_NOW));
  assert.match(render, /#223/);
  assert.match(render, /27[.,]0/);
  assert.match(render, /KHÔNG BAO GIỜ/);
  assert.match(render, /QUÁ NGƯỠNG/);
});

// ── CHẶN của vòng soát: mốc ở TƯƠNG LAI không được tắt báo động ────────────

test('C1 · mốc đo ở TƯƠNG LAI → `clockSkew`, `hoursSilent` null, một dòng `problems` — KHÔNG phải "không kẹt"', () => {
  // Bản đầu trả `hoursSilent: -24`, `overThreshold: false`, `problems: []`
  // và CLI thoát 0: một PR kẹt thật biến thành hàng đợi sạch, im lặng.
  const report = queueOrphans(
    only223({ headCommittedAt: '2026-09-27T08:30:00Z', createdAt: '2026-09-27T08:30:00Z' }),
    KF044_NOW,
  );
  const row = report.orphans[0]!;
  assert.equal(row.clockSkew, true);
  assert.equal(row.hoursSilent, null, 'giờ ÂM nhỏ hơn mọi ngưỡng nên nó tự tắt báo động — không được giữ');
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /TƯƠNG LAI/);
  assert.deepEqual(report.orphans.map((r) => r.number), [223], 'PR vẫn KẸT, chỉ là không đo được bao lâu');
  assert.match(renderQueueOrphans(report), /mốc ở TƯƠNG LAI/);
});

test('C1 · lệch trong DUNG SAI (< 1 phút) thì kẹp về 0, không thành `problems`', () => {
  // Cùng dung sai `FUTURE_TOLERANCE_HOURS` của `lane-heartbeat.ts`: đồng hồ
  // hai máy lệch vài giây là bình thường, không phải một chỗ hỏng.
  const secondsInTolerance = (FUTURE_TOLERANCE_HOURS * 3600) / 2;
  const future = new Date(Date.parse(KF044_NOW) + secondsInTolerance * 1000).toISOString();
  const report = queueOrphans(only223({ headCommittedAt: future, createdAt: future }), KF044_NOW);
  assert.deepEqual(report.problems, []);
  assert.equal(report.orphans[0]!.clockSkew, false);
  assert.equal(report.orphans[0]!.hoursSilent, 0, 'kẹp về 0, không in số âm');
  assert.equal(report.orphans[0]!.overThreshold, false);
});

test('C1 · render KHÔNG BAO GIỜ in giờ âm', () => {
  const render = renderQueueOrphans(
    queueOrphans(only223({ headCommittedAt: '2026-09-30T00:00:00Z', createdAt: '2026-09-30T00:00:00Z' }), KF044_NOW),
  );
  assert.doesNotMatch(render, /kẹt -/);
});

// ── Mốc đo là `max(headCommittedAt, createdAt)` ───────────────────────────

test('N1 · nhánh cũ nhưng PR vừa mở → đo từ `createdAt`, KHÔNG báo động giả', () => {
  // Phiên cloud đẩy nhánh trước rồi mới mở PR, nên mốc đầu nhánh một mình
  // phóng đại tuổi: 27 giờ cho một PR mở một phút trước.
  const report = queueOrphans(
    only223({ headCommittedAt: '2026-09-25T05:28:04Z', createdAt: '2026-09-26T08:29:00Z' }),
    KF044_NOW,
  );
  const row = report.orphans[0]!;
  assert.equal(row.sinceAt, '2026-09-26T08:29:00Z');
  assert.ok(row.hoursSilent !== null && row.hoursSilent < 0.02);
  assert.equal(row.overThreshold, false, 'PR mở một phút trước chưa phải chỗ kẹt — CI chưa kịp gắn nhãn');
});

test('N1 · PR mở lâu nhưng vừa push → đo từ đầu nhánh (đồng hồ về 0)', () => {
  const report = queueOrphans(
    only223({ headCommittedAt: '2026-09-26T08:29:00Z', createdAt: '2026-09-24T04:38:39Z' }),
    KF044_NOW,
  );
  assert.equal(report.orphans[0]!.sinceAt, '2026-09-26T08:29:00Z');
  assert.equal(report.orphans[0]!.overThreshold, false);
});

// ── Ca âm: ba nhãn cửa merge đều làm PR biến khỏi danh sách ────────────────

test('nhãn `automerge` → KHÔNG phải chỗ kẹt của mục này', () => {
  const report = queueOrphans(only223({ labels: ['automerge'] }), KF044_NOW);
  assert.deepEqual(report.orphans, []);
  assert.deepEqual(report.problems, []);
  assert.match(renderQueueOrphans(report), /không PR nào nằm ngoài hàng đợi/);
});

test('nhãn `automerge-delayed` → KHÔNG phải chỗ kẹt của mục này', () => {
  assert.deepEqual(queueOrphans(only223({ labels: ['automerge-delayed'] }), KF044_NOW).orphans, []);
});

test('`owner-merge` không bị đếm: PR đó đang chờ người, bản tin đếm nó vào nút thắt chờ người', () => {
  assert.deepEqual(queueOrphans(only223({ labels: [OWNER_QUEUE_LABEL] }), KF044_NOW).orphans, []);
});

test('ca rỗng render MỘT DÒNG tường minh, không được im (Z7)', () => {
  const render = renderQueueOrphans(queueOrphans(only223({ labels: ['automerge'] }), KF044_NOW));
  assert.match(render, /Mọi PR đang mở đều mang một nhãn cửa merge/);
  assert.match(render, /đã xét 1 PR/);
});

test('so nhãn KHÔNG phân biệt chữ hoa chữ thường', () => {
  assert.deepEqual(queueOrphans(only223({ labels: ['Automerge-Delayed'] }), KF044_NOW).orphans, []);
});

test('nhãn khác cửa merge (`fix`, `cross-lane`) KHÔNG cứu được PR khỏi danh sách', () => {
  const report = queueOrphans(only223({ labels: ['fix', 'cross-lane', 'parked'] }), KF044_NOW);
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.deepEqual(
    report.orphans[0]!.labels,
    ['fix', 'cross-lane', 'parked'],
    'nhãn khác phải hiện ra để bên đọc không tưởng PR trống nhãn',
  );
});

// ── N3 · ba tên nhãn phải khớp nguồn sự thật, không chép tay ───────────────

test('N3 · `MERGE_GATE_LABELS` dẫn xuất từ `LABEL_FOR_GATE`, không lệch bản thứ tư', () => {
  for (const label of Object.values(LABEL_FOR_GATE)) {
    if (label === null) continue;
    assert.ok(MERGE_GATE_LABELS.includes(label), `nhãn cửa merge \`${label}\` phải có trong MERGE_GATE_LABELS`);
  }
  assert.ok(MERGE_GATE_LABELS.includes(OWNER_QUEUE_LABEL), 'cửa `owner-merge` là hàng đợi NGƯỜI, vẫn phải đếm');
  assert.equal(new Set(MERGE_GATE_LABELS).size, MERGE_GATE_LABELS.length, 'không tên nào trùng');
  assert.equal(MERGE_GATE_LABELS.length, 3, 'ba cửa, ba nhãn — thêm cửa thứ tư thì bài này phải đỏ');
});

test('N3 · cả ba nhãn có thật trong `ops/labels.json` — nguồn sự thật của hệ thống nhãn', () => {
  const declared = new Set(
    (JSON.parse(readFileSync('ops/labels.json', 'utf8')) as { labels: { name: string }[] }).labels.map(
      (label) => label.name,
    ),
  );
  for (const label of MERGE_GATE_LABELS) {
    assert.ok(declared.has(label), `nhãn \`${label}\` không có trong ops/labels.json — nhãn đó không tồn tại`);
  }
});

// ── PR nháp, PR đã đóng, PR base khác ─────────────────────────────────────

test('PR nháp KHÔNG đếm là kẹt, nhưng được ĐẾM RIÊNG chứ không lặng lẽ trừ đi', () => {
  const report = queueOrphans(only223({ isDraft: true, labels: [] }), KF044_NOW);
  assert.deepEqual(report.orphans, []);
  assert.equal(report.drafts, 1);
  assert.equal(report.checked, 1);
  assert.match(renderQueueOrphans(report), /1 nháp/);
});

test('N2 · PR đã ĐÓNG không nhãn → không phải chỗ kẹt (endpoint liệt kê trả `merged:false` cho cả PR đã merge)', () => {
  const closedOnly = queueOrphans(only223({ closedAt: '2026-09-26T06:57:11Z', mergedAt: null }), KF044_NOW);
  assert.deepEqual(closedOnly.orphans, [], 'PR đóng không merge (ca #224) không nằm trong hàng đợi nào');
  assert.equal(closedOnly.closed, 1);

  const merged = queueOrphans(
    only223({ closedAt: '2026-09-26T07:09:45Z', mergedAt: '2026-09-26T07:09:45Z' }),
    KF044_NOW,
  );
  assert.deepEqual(merged.orphans, []);
  assert.equal(merged.closed, 1);
  assert.match(renderQueueOrphans(merged), /1 đã đóng\/merge/);
});

test('N13 · PR nhắm base khác `main` → không đếm là kẹt, nhưng NÓI RA ở `warnings`', () => {
  // `ci.yml` khai `on: pull_request: branches: [main]`, nên PR base khác
  // không bao giờ được gắn nhãn — nhưng nó cũng không thuộc hàng đợi `main`.
  const report = queueOrphans(only223({ baseRef: 'claude/spike' }), KF044_NOW);
  assert.deepEqual(report.orphans, []);
  assert.equal(report.otherBase, 1);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0]!, /base `claude\/spike`/);
  assert.deepEqual(report.problems, [], 'ca này đo được, nên nó là `warnings` — không làm đỏ mã thoát');
  assert.equal(LABELLED_BASE_REF, 'main');
});

// ── Ngưỡng ────────────────────────────────────────────────────────────────

test(`PR vừa mở (dưới ${ORPHAN_ALERT_HOURS} giờ) → kể trong \`orphans\`, KHÔNG vào \`overThreshold\``, () => {
  const report = queueOrphans(
    only223({ headCommittedAt: '2026-09-26T08:00:00Z', createdAt: '2026-09-26T08:00:00Z' }),
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.deepEqual(report.overThreshold, [], 'ci.yml gắn nhãn trong một lượt CI — 0,5 giờ chưa phải chỗ kẹt');
});

test('đúng mốc ngưỡng là QUÁ ngưỡng (>=, không phải >)', () => {
  const report = queueOrphans(
    only223({ headCommittedAt: '2026-09-26T06:30:00Z', createdAt: '2026-09-26T06:30:00Z' }),
    KF044_NOW,
  );
  assert.equal(report.orphans[0]!.hoursSilent, ORPHAN_ALERT_HOURS);
  assert.equal(report.orphans[0]!.overThreshold, true);
});

// ── Thứ tự ────────────────────────────────────────────────────────────────

test('sắp theo giờ kẹt giảm dần — kẹt lâu nhất trước (luật bước 0a)', () => {
  const report = queueOrphans(
    [
      open(1, 'a', [], '2026-09-26T05:30:00Z', '2026-09-26T05:30:00Z'),
      open(2, 'b', [], '2026-09-24T05:30:00Z', '2026-09-24T05:30:00Z'),
      open(3, 'c', [], '2026-09-26T00:30:00Z', '2026-09-26T00:30:00Z'),
    ],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [2, 3, 1]);
});

test('N9 · PR không đo được tuổi xếp CUỐI nhưng vẫn CÓ MẶT', () => {
  const report = queueOrphans(
    [
      open(1, 'không đọc được mốc', [], 'hôm qua', 'hôm qua'),
      open(2, 'kẹt lâu', [], '2026-09-24T05:30:00Z', '2026-09-24T05:30:00Z'),
      open(3, 'kẹt ít', [], '2026-09-26T00:30:00Z', '2026-09-26T00:30:00Z'),
    ],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [2, 3, 1]);
  assert.equal(report.orphans.at(-1)!.hoursSilent, null);
});

// ── Không đo được KHÔNG BAO GIỜ đọc thành "không kẹt" ──────────────────────

test('mốc đầu nhánh không đọc được → PR VẪN kẹt, cộng một dòng `problems`', () => {
  const report = queueOrphans(only223({ headCommittedAt: 'hôm qua' }), KF044_NOW);
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.equal(report.orphans[0]!.hoursSilent, null);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /vẫn KẸT/);
  assert.match(report.problems[0]!, /headCommittedAt/);
  assert.match(renderQueueOrphans(report), /không đo được tuổi/);
});

test('`createdAt` không đọc được cũng vào `problems` — cả hai mốc đều là đầu vào của phép max', () => {
  const report = queueOrphans(only223({ createdAt: 'chiều qua' }), KF044_NOW);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /createdAt/);
  assert.equal(report.orphans[0]!.hoursSilent, null);
});

test('N12 · hai nhãn cửa merge cùng lúc → `warnings`, KHÔNG `problems` (cửa sổ đua vài giây của ci.yml)', () => {
  const report = queueOrphans(only223({ labels: ['automerge', 'owner-merge'] }), KF044_NOW);
  assert.deepEqual(report.orphans, [], 'PR đó vẫn ở trong một hàng đợi nào đó, nên không phải ca của mục này');
  assert.deepEqual(report.problems, [], 'đo được thì không phải `problems` — nó không được làm đỏ mã thoát');
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0]!, /2 nhãn cửa merge/);
});

test('`now` không đọc được → NÉM, không trả báo cáo rỗng', () => {
  assert.throws(() => queueOrphans(KF044_OPEN_PRS, 'chiều nay'), /now/);
});

for (const missing of ['number', 'title', 'isDraft', 'labels', 'baseRef', 'createdAt', 'closedAt', 'mergedAt', 'headCommittedAt'] as const) {
  test(`thiếu trường \`${missing}\` → NÉM (một ảnh chụp thiếu trường không phải "không PR nào kẹt")`, () => {
    const pr: Record<string, unknown> = { ...KF044_OPEN_PRS[0]! };
    delete pr[missing];
    assert.throws(() => queueOrphans([pr], KF044_NOW), TypeError);
  });
}

test('`labels` là mảng object (chưa phẳng từ `labels[].name`) → NÉM', () => {
  // Hình dạng thô của API GitHub. Nhận nó im lặng sẽ làm MỌI PR trông như
  // không nhãn — một báo động giả cho cả hàng đợi, đúng chiều đắt nhất.
  const pr = { ...KF044_OPEN_PRS[1]!, labels: [{ name: 'automerge-delayed' }] as unknown as string[] };
  assert.throws(() => queueOrphans([pr], KF044_NOW), /labels/);
});

test('N7 · ảnh chụp RỖNG → NÉM, không báo "hàng đợi sạch"', () => {
  // "Không PR nào đang mở" và "lệnh liệt kê hỏng" không được đọc như nhau.
  assert.throws(() => queueOrphans([], KF044_NOW), /rỗng/);
});

// ── CLI: mã thoát là thứ workflow đọc được ────────────────────────────────

/** Chạy CLI trên một file JSON tạm, trả `status` và `stdout`. */
function runCli(
  prs: unknown,
  extra: readonly string[] = ['--now', KF044_NOW],
): { status: number | null; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'queue-orphans-'));
  try {
    const file = join(dir, 'prs.json');
    writeFileSync(file, JSON.stringify(prs), 'utf8');
    const run = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        join(import.meta.dirname, '..', 'scripts', 'merge-queue-orphans.ts'),
        '--prs',
        file,
        ...extra,
      ],
      { encoding: 'utf8' },
    );
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI: ảnh chụp thật của `KF-044` → thoát 1 và in #223', () => {
  const run = runCli(KF044_OPEN_PRS);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /#223/);
});

test('CLI: hàng đợi sạch → thoát 0 và in dòng tường minh', () => {
  const run = runCli(KF044_OPEN_PRS.filter((pr) => pr.number !== 223));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /không PR nào nằm ngoài hàng đợi/);
});

test('CLI: chỉ có `problems` (không PR nào quá ngưỡng) VẪN thoát 1', () => {
  // Một phép đo không đo được không được phép báo xanh.
  const run = runCli(only223({ headCommittedAt: 'hôm qua' }));
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /⚠/);
});

test('C1 · CLI: mốc ở TƯƠNG LAI → thoát 1 (bản đầu thoát 0 — đúng chỗ CHẶN của vòng soát)', () => {
  const run = runCli(
    only223({ headCommittedAt: '2026-09-27T08:30:00Z', createdAt: '2026-09-27T08:30:00Z' }),
  );
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /TƯƠNG LAI/);
});

test('N12 · CLI: chỉ có `warnings` → thoát 0 (một cửa sổ đua vài giây không làm người canh đỏ)', () => {
  const run = runCli(only223({ labels: ['automerge', 'owner-merge'] }));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /2 nhãn cửa merge/);
});

test('CLI `--json`: có đủ khoá máy đọc, kể cả khi rỗng', () => {
  const run = runCli(KF044_OPEN_PRS.filter((pr) => pr.number !== 223), ['--now', KF044_NOW, '--json']);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout) as Record<string, unknown>;
  for (const key of ['checked', 'drafts', 'closed', 'otherBase', 'orphans', 'overThreshold', 'problems', 'warnings', 'alertHours', 'render']) {
    assert.ok(key in out, `khoá \`${key}\` VẮNG MẶT — đúng chỗ im lặng mục này cấm`);
  }
  assert.equal(out.alertHours, ORPHAN_ALERT_HOURS);
});

test('CLI: một object lẻ thay vì mảng → thoát khác 0, KHÔNG báo "sạch"', () => {
  const run = runCli({ number: 223 });
  assert.notEqual(run.status, 0);
});

test('CLI: thiếu `--prs` → thoát 2 kèm hướng dẫn', () => {
  const run = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(import.meta.dirname, '..', 'scripts', 'merge-queue-orphans.ts')],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Dùng:/);
});

test('N5 · CLI: `--now` không có giá trị → thoát 2, KHÔNG lặng lẽ rơi về đồng hồ hệ thống', () => {
  const run = runCli(KF044_OPEN_PRS, ['--now']);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /Dùng:/);
});
