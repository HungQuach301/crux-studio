/**
 * `ops/scripts/gate-flow.ts` — cơ chế "đo trước, sửa sau" của mục
 * `platform/P-027` (`ops/known-failures.md` KF-011).
 *
 * Hai tầng, kiểm ở cả hai:
 *
 * - **Hàm thuần** (`gateFlowRow`, `gateFlowRows`, `gateFlowVerdict`,
 *   `renderGateFlowRow`, `renderGateFlowVerdict`): kiểm bằng mốc thời gian
 *   dựng tay.
 * - **Phần chạm git** (`prHeadChanges`): kiểm bằng một kho git **thật** —
 *   bài quan trọng nhất là một commit **gộp `main`** chỉ tính **một** lần
 *   đổi đầu nhánh (`--first-parent`), không kéo theo cả lịch sử `main`.
 *   Đúng ca mà bước 0 tạo ra ở mỗi lượt và là gốc của KF-011.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DELAYED_LABEL,
  gateFlowRow,
  gateFlowRows,
  gateFlowVerdict,
  prHeadChanges,
  renderGateFlowRow,
  renderGateFlowVerdict,
  type GateFlowInput,
} from '../scripts/gate-flow.ts';

const NOW = '2026-09-22T02:00:00.000Z';
const DELAY = 12;

function input(overrides: Partial<GateFlowInput> & { number: number }): GateFlowInput {
  return {
    title: `PR #${overrides.number}`,
    labels: [DELAYED_LABEL],
    headChangesNewestFirst: [],
    ...overrides,
  };
}

// ── gateFlowRow ──

test('gateFlowRow: không có commit nào đọc được → mọi số là null, không ném', () => {
  const row = gateFlowRow(input({ number: 1, headChangesNewestFirst: [] }), NOW, DELAY);
  assert.equal(row.headChanges, 0);
  assert.equal(row.clockResets, 0);
  assert.equal(row.longestStableHours, null);
  assert.equal(row.currentStableHours, null);
  assert.equal(row.hoursShort, null);
  assert.equal(row.everReachedThreshold, false);
});

test('gateFlowRow: một commit, chưa đủ ngưỡng → clockResets 0, còn thiếu đúng số giờ', () => {
  // commit lúc 00:00, now 02:00 → đứng yên 2 giờ, còn thiếu 10.
  const row = gateFlowRow(
    input({ number: 2, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] }),
    NOW,
    DELAY,
  );
  assert.equal(row.headChanges, 1);
  assert.equal(row.clockResets, 0);
  assert.equal(row.currentStableHours, 2);
  assert.equal(row.longestStableHours, 2);
  assert.equal(row.hoursShort, 10);
  assert.equal(row.everReachedThreshold, false);
});

test('gateFlowRow: nhiều commit → clockResets = số commit trừ 1, và trống dài nhất là cửa sổ lớn nhất', () => {
  // 10:00 → 20:00 (10h) → 00:00 (4h) → now 02:00 (2h). Lớn nhất 10h < 12.
  const row = gateFlowRow(
    input({
      number: 3,
      headChangesNewestFirst: ['2026-09-22T00:00:00.000Z', '2026-09-21T20:00:00.000Z', '2026-09-21T10:00:00.000Z'],
    }),
    NOW,
    DELAY,
  );
  assert.equal(row.headChanges, 3);
  assert.equal(row.clockResets, 2);
  assert.equal(row.currentStableHours, 2);
  assert.equal(row.longestStableHours, 10);
  assert.equal(row.everReachedThreshold, false, '10 giờ chưa đủ ngưỡng 12');
});

test('gateFlowRow: một cửa sổ CŨ từng ≥ ngưỡng → everReachedThreshold true, dù hiện tại chưa', () => {
  // 10:00 → 00:00 là 14h (đạt ngưỡng), rồi now 02:00 mới 2h.
  const row = gateFlowRow(
    input({
      number: 4,
      headChangesNewestFirst: ['2026-09-22T00:00:00.000Z', '2026-09-21T10:00:00.000Z'],
    }),
    NOW,
    DELAY,
  );
  assert.equal(row.longestStableHours, 14);
  assert.equal(row.everReachedThreshold, true);
  assert.equal(row.currentStableHours, 2);
  assert.equal(row.hoursShort, 10, 'ngưỡng tính theo cửa sổ HIỆN TẠI, không phải cửa sổ dài nhất');
});

test('gateFlowRow: cửa sổ hiện tại đã ≥ ngưỡng → hoursShort 0, đây là PR đáng lẽ merge được', () => {
  // commit 12:00 hôm trước, now 02:00 → 14h.
  const row = gateFlowRow(
    input({ number: 5, headChangesNewestFirst: ['2026-09-21T12:00:00.000Z'] }),
    NOW,
    DELAY,
  );
  assert.equal(row.currentStableHours, 14);
  assert.equal(row.hoursShort, 0);
  assert.equal(row.everReachedThreshold, true);
});

test('gateFlowRow: commit gần nhất ở TƯƠNG LAI → kẹp về 0 và bật clockSkew, không số âm', () => {
  const row = gateFlowRow(
    input({ number: 6, headChangesNewestFirst: ['2026-09-22T05:00:00.000Z'] }),
    NOW,
    DELAY,
  );
  assert.equal(row.clockSkew, true);
  assert.equal(row.currentStableHours, 0);
  assert.equal(row.hoursShort, 12);
});

test('gateFlowRow: nhận nhãn automerge-delayed KHÔNG phân biệt hoa thường', () => {
  assert.equal(gateFlowRow(input({ number: 7, labels: ['Automerge-Delayed'] }), NOW, DELAY).isDelayed, true);
  assert.equal(gateFlowRow(input({ number: 8, labels: ['automerge'] }), NOW, DELAY).isDelayed, false);
  assert.equal(gateFlowRow(input({ number: 9, labels: [] }), NOW, DELAY).isDelayed, false);
});

// ── gateFlowRows: thứ tự ──

test('gateFlowRows: PR delayed gần ngưỡng nhất đứng trước, PR không mang nhãn xếp sau', () => {
  const rows = gateFlowRows(
    [
      input({ number: 10, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] }), // thiếu 10
      input({ number: 11, headChangesNewestFirst: ['2026-09-21T18:00:00.000Z'] }), // 8h, thiếu 4
      input({ number: 12, labels: ['automerge'], headChangesNewestFirst: ['2026-09-21T12:00:00.000Z'] }), // không delayed
    ],
    NOW,
    DELAY,
  );
  assert.deepEqual(rows.map((r) => r.number), [11, 10, 12]);
});

test('gateFlowRows: PR không đo được (hoursShort null) xếp cuối, không bị bỏ', () => {
  const rows = gateFlowRows(
    [
      input({ number: 20, headChangesNewestFirst: [] }),
      input({ number: 21, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] }),
    ],
    NOW,
    DELAY,
  );
  assert.deepEqual(rows.map((r) => r.number), [21, 20]);
});

// ── gateFlowVerdict ──

test('gateFlowVerdict: không PR delayed nào đạt ngưỡng → reachedThresholdCount 0, đúng chữ ký KF-011', () => {
  const rows = gateFlowRows(
    [
      input({ number: 30, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] }),
      input({ number: 31, headChangesNewestFirst: ['2026-09-21T20:00:00.000Z', '2026-09-21T18:00:00.000Z'] }),
    ],
    NOW,
    DELAY,
  );
  const verdict = gateFlowVerdict(rows);
  assert.equal(verdict.delayedCount, 2);
  assert.equal(verdict.reachedThresholdCount, 0);
  assert.equal(verdict.atThresholdNow, 0);
  assert.equal(verdict.totalResets, 1);
});

test('gateFlowVerdict: PR đạt cửa sổ CŨ ≥ ngưỡng vẫn được đếm dù hiện tại chưa ở ngưỡng (ca #42)', () => {
  // Cửa sổ cũ 10:00→00:00 là 14h (đạt ngưỡng), nhưng now 02:00 mới 2h.
  // reachedThresholdCount đếm nó, atThresholdNow thì không — hai số khác nhau.
  const rows = gateFlowRows(
    [input({ number: 40, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z', '2026-09-21T10:00:00.000Z'] })],
    NOW,
    DELAY,
  );
  const verdict = gateFlowVerdict(rows);
  assert.equal(verdict.reachedThresholdCount, 1);
  assert.equal(verdict.atThresholdNow, 0);
});

test('gateFlowVerdict: có PR đang ở ngưỡng → đếm cả reachedThresholdCount lẫn atThresholdNow', () => {
  const rows = gateFlowRows(
    [input({ number: 41, headChangesNewestFirst: ['2026-09-21T12:00:00.000Z'] })],
    NOW,
    DELAY,
  );
  const verdict = gateFlowVerdict(rows);
  assert.equal(verdict.reachedThresholdCount, 1);
  assert.equal(verdict.atThresholdNow, 1);
});

test('gateFlowVerdict: đầu vào không có PR delayed nào', () => {
  const rows = gateFlowRows([input({ number: 50, labels: ['automerge'] })], NOW, DELAY);
  const verdict = gateFlowVerdict(rows);
  assert.equal(verdict.delayedCount, 0);
  assert.equal(verdict.reachedThresholdCount, 0);
});

// ── render ──

test('renderGateFlowRow: nói rõ CHƯA BAO GIỜ đạt ngưỡng khi cửa sổ dài nhất còn thiếu', () => {
  const row = gateFlowRow(input({ number: 60, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] }), NOW, DELAY);
  const line = renderGateFlowRow(row, DELAY);
  assert.match(line, /#60/);
  assert.match(line, /đặt lại đồng hồ 0/);
  assert.match(line, /CHƯA BAO GIỜ đạt ngưỡng/);
});

test('renderGateFlowRow: PR không đo được nói thẳng, không bịa số', () => {
  const row = gateFlowRow(input({ number: 61, headChangesNewestFirst: [] }), NOW, DELAY);
  assert.match(renderGateFlowRow(row, DELAY), /không đọc được lần đổi đầu nhánh nào/);
});

test('renderGateFlowVerdict: nói KHÔNG PR nào có cửa sổ đủ ngưỡng khi reachedThresholdCount 0', () => {
  const rows = gateFlowRows([input({ number: 70, headChangesNewestFirst: ['2026-09-22T00:00:00.000Z'] })], NOW, DELAY);
  assert.match(renderGateFlowVerdict(gateFlowVerdict(rows), DELAY), /KHÔNG PR nào từng có cửa sổ đứng yên đủ 12 giờ \(KF-011\)/);
});

// ── Phần chạm git, trên một kho thật ─────────────────────────────────────

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function commitAt(root: string, file: string, body: string, message: string, isoDate: string): void {
  writeFileSync(join(root, file), body);
  git(root, 'add', '.');
  git(
    root,
    '-c',
    `user.name=Test`,
    '-c',
    `user.email=test@example.com`,
    'commit',
    '--quiet',
    '--date',
    isoDate,
    '-m',
    message,
  );
}

/**
 * Kho thử: nhánh `feat` có hai commit riêng, rồi **gộp `main`** vào. Một
 * commit gộp phải tính đúng MỘT lần đổi đầu nhánh — `--first-parent` không
 * đi vào nhánh `main` vừa gộp. `refs/remotes/pr/7` trỏ vào `feat` để
 * `prHeadChanges` (dùng `prHeadRef`) đọc được.
 */
function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-gate-flow-'));
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  process.env.GIT_COMMITTER_NAME ??= 'Test';
  process.env.GIT_COMMITTER_EMAIL ??= 'test@example.com';

  commitAt(root, 'base.txt', 'base\n', 'c1 main', '2026-09-21T09:00:00');
  git(root, 'checkout', '--quiet', '-b', 'feat');
  commitAt(root, 'feat.txt', 'a\n', 'feat A', '2026-09-21T10:00:00');
  commitAt(root, 'feat.txt', 'b\n', 'feat B', '2026-09-21T14:00:00');

  git(root, 'checkout', '--quiet', 'main');
  commitAt(root, 'main2.txt', 'm2\n', 'c2 main — nhánh khác', '2026-09-21T15:00:00');

  git(root, 'checkout', '--quiet', 'feat');
  // Gộp main vào feat: một commit gộp, đầu nhánh feat đổi đúng một lần.
  git(
    root,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'merge',
    '--quiet',
    '--no-ff',
    '-m',
    'gộp main vào feat (bước 0)',
    'main',
  );

  git(root, 'update-ref', 'refs/remotes/pr/7', 'feat');
  return root;
}

test('prHeadChanges: đọc --first-parent, mới trước cũ sau, và commit gộp main chỉ là MỘT lần đổi đầu nhánh', () => {
  const root = makeRepo();
  try {
    const commits = prHeadChanges(root, 7);
    // Dòng first-parent của feat: commit gộp, B, A, c1 (base) → 4. Commit
    // `c2 main` KHÔNG được đếm (nó là cha THỨ HAI của commit gộp). Không có
    // `--first-parent` thì là 5 — nên con số 4 chính là bằng chứng lịch sử
    // main vừa gộp không bị kéo vào đếm.
    assert.equal(commits.length, 4, 'commit gộp main không kéo theo lịch sử main (c2 bị loại)');
    // Mới trước cũ sau: commit đầu tiên (gộp) mới hơn commit cuối (A).
    assert.ok(Date.parse(commits[0]!) >= Date.parse(commits[commits.length - 1]!));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('prHeadChanges: ref không có commit nào thì NÉM, không trả mảng rỗng (nhóm Z)', () => {
  const root = makeRepo();
  try {
    assert.throws(() => prHeadChanges(root, 999), /Không đọc được lịch sử|không cho commit nào/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
