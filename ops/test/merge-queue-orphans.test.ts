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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MERGE_GATE_LABELS,
  ORPHAN_ALERT_HOURS,
  type QueueOrphanInput,
  queueOrphans,
  renderQueueOrphans,
} from '../scripts/merge-queue-orphans.ts';

/** Mốc phép đo của `KF-044` — bước 0 lượt `crux-worker-2` `2026-09-26`. */
const KF044_NOW = '2026-09-26T08:30:00Z';

/**
 * Bảy PR đang mở lúc `KF044_NOW`, nhãn và mốc đổi đầu nhánh lấy bằng
 * `gh pr list` cộng `git log -1 --format=%cI` trên từng đầu nhánh. Chỉ **một**
 * PR có `labels` rỗng, và đó là ca thật.
 */
const KF044_OPEN_PRS: QueueOrphanInput[] = [
  {
    number: 223,
    title: '[platform] P-014 — sóng 3 nhóm Z: cân đối log/merge theo làn (Z14)',
    isDraft: false,
    labels: [],
    headCommittedAt: '2026-09-25T05:28:04Z',
  },
  {
    number: 231,
    title: '[platform] P-044 — fix · cảnh báo `main` đỏ không bao giờ được đóng',
    isDraft: false,
    labels: ['fix', 'automerge-delayed'],
    headCommittedAt: '2026-09-26T01:42:56Z',
  },
  {
    number: 249,
    title: '[platform] P-047 — fix · lượt `ci.yml` bị huỷ để lại check `cancelled`',
    isDraft: false,
    labels: ['fix', 'automerge-delayed'],
    headCommittedAt: '2026-09-26T04:21:30Z',
  },
  {
    number: 260,
    title: '[platform] P-053 — bản tin thêm mục "Việc đang chờ anh" (C1 + C4)',
    isDraft: false,
    labels: ['automerge-delayed'],
    headCommittedAt: '2026-09-26T04:38:46Z',
  },
  {
    number: 261,
    title: '[platform] P-055 — fix · KF-026 cộng lần thứ ba',
    isDraft: false,
    labels: ['fix', 'automerge-delayed'],
    headCommittedAt: '2026-09-26T00:42:40Z',
  },
  {
    number: 274,
    title: '[platform] P-057 — bộ dò cross-lane đếm cả ops/logs/<làn>/',
    isDraft: false,
    labels: ['automerge-delayed'],
    headCommittedAt: '2026-09-26T01:42:52Z',
  },
  {
    number: 282,
    title: '[integration] bước 0 lượt crux-worker-2 07:25Z — 0 PR xung đột',
    isDraft: false,
    labels: ['automerge'],
    headCommittedAt: '2026-09-26T08:05:17Z',
  },
];

// ── Bài tái hiện lỗi (I2) ──────────────────────────────────────────────────

test('KF-044: #223 không mang nhãn cửa merge nào → chỉ ra ĐÚNG nó, kèm giờ kẹt', () => {
  const report = queueOrphans(KF044_OPEN_PRS, KF044_NOW);

  assert.equal(report.checked, 7);
  assert.equal(report.drafts, 0);
  assert.deepEqual(
    report.orphans.map((row) => row.number),
    [223],
    'sáu PR kia đều mang một nhãn cửa merge, nên chỉ #223 được kể',
  );
  assert.deepEqual(report.overThreshold.map((row) => row.number), [223]);
  assert.deepEqual(report.problems, []);

  const row = report.orphans[0]!;
  // 2026-09-25T05:28:04Z → 2026-09-26T08:30:00Z = 27,03 giờ.
  assert.ok(row.hoursSilent !== null);
  assert.ok(
    Math.abs(row.hoursSilent - 27.03) < 0.02,
    `giờ kẹt phải ~27,03 (đo thật), nhận ${row.hoursSilent}`,
  );
  assert.ok(row.overThreshold);
  assert.deepEqual(row.labels, [], 'nhãn rỗng là chính chữ ký của ca này');
});

test('KF-044: báo cáo nói ra "KHÔNG BAO GIỜ", không nói "chậm"', () => {
  const render = renderQueueOrphans(queueOrphans(KF044_OPEN_PRS, KF044_NOW));
  assert.match(render, /#223/);
  assert.match(render, /27[.,]0/);
  assert.match(render, /KHÔNG BAO GIỜ/);
  assert.match(render, /QUÁ NGƯỠNG/);
});

// ── Ca âm: ba nhãn cửa merge đều làm PR biến khỏi danh sách ────────────────

for (const label of MERGE_GATE_LABELS) {
  test(`nhãn \`${label}\` → KHÔNG phải chỗ kẹt của mục này`, () => {
    const report = queueOrphans(
      [{ ...KF044_OPEN_PRS[0]!, labels: [label] }],
      KF044_NOW,
    );
    assert.deepEqual(report.orphans, []);
    assert.deepEqual(report.problems, []);
    assert.match(
      renderQueueOrphans(report),
      /không PR nào nằm ngoài hàng đợi/,
      'ca rỗng phải in MỘT DÒNG tường minh, không được im (Z7)',
    );
  });
}

test('`owner-merge` không bị đếm: PR đó đang chờ người, bản tin có dòng riêng', () => {
  const report = queueOrphans([{ ...KF044_OPEN_PRS[0]!, labels: ['owner-merge'] }], KF044_NOW);
  assert.deepEqual(report.orphans, []);
});

test('so nhãn KHÔNG phân biệt chữ hoa chữ thường', () => {
  const report = queueOrphans([{ ...KF044_OPEN_PRS[0]!, labels: ['Automerge-Delayed'] }], KF044_NOW);
  assert.deepEqual(report.orphans, []);
});

test('nhãn khác cửa merge (`fix`, `cross-lane`) KHÔNG cứu được PR khỏi danh sách', () => {
  const report = queueOrphans(
    [{ ...KF044_OPEN_PRS[0]!, labels: ['fix', 'cross-lane', 'parked'] }],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.deepEqual(report.orphans[0]!.labels, ['fix', 'cross-lane', 'parked'], 'nhãn khác phải hiện ra để bên đọc không tưởng PR trống nhãn');
});

test('PR nháp KHÔNG đếm là kẹt, nhưng được ĐẾM RIÊNG chứ không lặng lẽ trừ đi', () => {
  const report = queueOrphans([{ ...KF044_OPEN_PRS[0]!, isDraft: true, labels: [] }], KF044_NOW);
  assert.deepEqual(report.orphans, []);
  assert.equal(report.drafts, 1);
  assert.equal(report.checked, 1);
  assert.match(renderQueueOrphans(report), /1 nháp bỏ qua/);
});

// ── Ngưỡng: dưới ngưỡng vẫn kể, nhưng KHÔNG báo động ───────────────────────

test(`PR vừa mở (dưới ${ORPHAN_ALERT_HOURS} giờ) → kể trong \`orphans\`, KHÔNG vào \`overThreshold\``, () => {
  const report = queueOrphans(
    [{ ...KF044_OPEN_PRS[0]!, headCommittedAt: '2026-09-26T08:00:00Z' }],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.deepEqual(report.overThreshold, [], 'ci.yml gắn nhãn trong một lượt CI — 0,5 giờ chưa phải chỗ kẹt');
  assert.equal(report.orphans[0]!.overThreshold, false);
});

test('đúng mốc ngưỡng là QUÁ ngưỡng (>=, không phải >)', () => {
  const report = queueOrphans(
    [{ ...KF044_OPEN_PRS[0]!, headCommittedAt: '2026-09-26T06:30:00Z' }],
    KF044_NOW,
  );
  assert.equal(report.orphans[0]!.hoursSilent, ORPHAN_ALERT_HOURS);
  assert.equal(report.orphans[0]!.overThreshold, true);
});

test('sắp theo giờ kẹt giảm dần — kẹt lâu nhất trước (luật bước 0a)', () => {
  const report = queueOrphans(
    [
      { ...KF044_OPEN_PRS[0]!, number: 1, headCommittedAt: '2026-09-26T05:30:00Z' },
      { ...KF044_OPEN_PRS[0]!, number: 2, headCommittedAt: '2026-09-24T05:30:00Z' },
      { ...KF044_OPEN_PRS[0]!, number: 3, headCommittedAt: '2026-09-26T00:30:00Z' },
    ],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans.map((row) => row.number), [2, 3, 1]);
});

// ── Không đo được KHÔNG BAO GIỜ đọc thành "không kẹt" ──────────────────────

test('mốc đầu nhánh không đọc được → PR VẪN kẹt, cộng một dòng `problems`', () => {
  const report = queueOrphans([{ ...KF044_OPEN_PRS[0]!, headCommittedAt: 'hôm qua' }], KF044_NOW);
  assert.deepEqual(report.orphans.map((row) => row.number), [223]);
  assert.equal(report.orphans[0]!.hoursSilent, null);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /vẫn KẸT/);
  assert.match(renderQueueOrphans(report), /không đo được tuổi/);
});

test('hai nhãn cửa merge cùng lúc → nói ra ở `problems`, không nuốt', () => {
  const report = queueOrphans(
    [{ ...KF044_OPEN_PRS[0]!, labels: ['automerge', 'owner-merge'] }],
    KF044_NOW,
  );
  assert.deepEqual(report.orphans, [], 'PR đó vẫn ở trong một hàng đợi nào đó, nên không phải ca của mục này');
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /2 nhãn cửa merge/);
});

test('`now` không đọc được → NÉM, không trả báo cáo rỗng', () => {
  assert.throws(() => queueOrphans(KF044_OPEN_PRS, 'chiều nay'), /now/);
});

for (const missing of ['number', 'title', 'isDraft', 'labels', 'headCommittedAt'] as const) {
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

test('đầu vào rỗng: báo cáo rỗng ĐỌC ĐƯỢC, và render nói rõ đã xét 0 PR', () => {
  const report = queueOrphans([], KF044_NOW);
  assert.deepEqual(report.orphans, []);
  assert.equal(report.checked, 0);
  assert.match(renderQueueOrphans(report), /đã xét 0 PR/);
});

// ── CLI: mã thoát là thứ workflow đọc được ────────────────────────────────

/** Chạy CLI trên một file JSON tạm, trả `status` và `stdout`. */
function runCli(prs: unknown, extra: readonly string[] = []): { status: number | null; stdout: string; stderr: string } {
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
        '--now',
        KF044_NOW,
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
  const run = runCli([{ ...KF044_OPEN_PRS[0]!, headCommittedAt: 'hôm qua' }]);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /⚠/);
});

test('CLI `--json`: có đủ khoá máy đọc, kể cả khi rỗng', () => {
  const run = runCli(KF044_OPEN_PRS.filter((pr) => pr.number !== 223), ['--json']);
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout) as Record<string, unknown>;
  for (const key of ['checked', 'drafts', 'orphans', 'overThreshold', 'problems', 'alertHours', 'render']) {
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
