/**
 * `ops/scripts/delayed-gate-flow.ts` — cơ chế đo của mục `platform/P-027`.
 *
 * Hai tầng, kiểm ở cả hai:
 *
 * - **Hàm thuần** (`stillGapsHours`, `clockResetsInWindow`,
 *   `delayedFlowRow(s)`, `summarizeDelayedFlow`, `renderDelayedFlowRow`):
 *   dữ liệu dựng tay, không đụng đĩa.
 * - **Phần chạm git** (`branchHeadCommits`): kho git **thật** trong thư mục
 *   tạm. Điều cần kiểm là "`git log --first-parent` đếm một commit gộp là
 *   MỘT lần đổi đầu nhánh", và một bản giả lập `spawnSync` chỉ khẳng định
 *   lại chính giả định đang cần kiểm.
 *
 * Ba bài **âm** là phần đáng giá nhất ở đây, vì cả ba đều là hình dạng
 * nhóm **Z** (`ops/known-failures.md`) — con số ra sai mà không gì đỏ:
 *
 * 1. Không có khoảng nào *trước* commit cũ nhất. Đếm thêm một khoảng vô hạn
 *    ở đó thì **mọi** PR trông như đã đạt ngưỡng, và phép đo tự phủ định
 *    chính kết luận nó sinh ra để chứng minh.
 * 2. Một PR đứng yên đủ 12 giờ **phải** ra `reachedThreshold: true` — nếu
 *    không, phép đo chỉ là một hàm luôn trả "hỏng", và nó sẽ tiếp tục kêu
 *    sau khi cửa đã được sửa.
 * 3. Nhánh không có commit nào ngoài `main` ra mảng rỗng, không ra `0` giờ
 *    đứng yên giả vờ như đã đo được.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DELAYED_LABEL,
  RESET_ALERT_THRESHOLD,
  branchHeadCommits,
  clockResetsInWindow,
  delayedFlowRow,
  delayedFlowRows,
  renderDelayedFlowRow,
  stillGapsHours,
  summarizeDelayedFlow,
  type DelayedPrInput,
  type HeadCommit,
} from '../scripts/delayed-gate-flow.ts';

const NOW = '2026-09-22T06:00:00.000Z';

function commit(sha: string, committedAt: string): HeadCommit {
  return { sha, committedAt };
}

/** PR mẫu: mang nhãn cửa delayed, nhánh suy được làn. */
function pr(number: number, commits: readonly HeadCommit[], labels: readonly string[] = [DELAYED_LABEL]): DelayedPrInput {
  return {
    number,
    title: `mục ${number}`,
    headRefName: `claude/platform/P-0${number}`,
    labels,
    commits,
  };
}

// --- `stillGapsHours` ---

test('stillGapsHours: khoảng đang chạy đứng đầu, rồi tới các khoảng giữa hai commit', () => {
  const gaps = stillGapsHours(
    [commit('c3', '2026-09-22T05:00:00.000Z'), commit('c2', '2026-09-22T02:00:00.000Z'), commit('c1', '2026-09-21T20:00:00.000Z')],
    NOW,
  );
  assert.deepEqual(gaps, [1, 3, 6]);
});

test('stillGapsHours: KHÔNG có khoảng nào trước commit cũ nhất', () => {
  // Một commit duy nhất, ra đời 30 giờ trước: đúng một khoảng (đang chạy).
  // Nếu có thêm khoảng "từ đầu thời gian tới commit đó" thì mọi PR đều đạt
  // ngưỡng và phép đo vô nghĩa.
  const gaps = stillGapsHours([commit('c1', '2026-09-21T00:00:00.000Z')], NOW);
  assert.deepEqual(gaps, [30]);
});

test('stillGapsHours: nhánh không có commit nào ngoài `main` ra mảng rỗng', () => {
  assert.deepEqual(stillGapsHours([], NOW), []);
});

// --- `clockResetsInWindow` ---

test('clockResetsInWindow: đếm commit trong cửa sổ, kể cả commit ngoài cửa sổ thì không', () => {
  const commits = [
    commit('c4', '2026-09-22T05:00:00.000Z'), // 1 giờ trước
    commit('c3', '2026-09-21T23:00:00.000Z'), // 7 giờ trước
    commit('c2', '2026-09-21T07:00:00.000Z'), // 23 giờ trước
    commit('c1', '2026-09-20T12:00:00.000Z'), // 42 giờ trước — ngoài cửa sổ
  ];
  assert.equal(clockResetsInWindow(commits, NOW), 3);
  assert.equal(clockResetsInWindow(commits, NOW, 8), 2);
});

// --- `delayedFlowRow` ---

test('delayedFlowRow: ca thật của #39 — đồng hồ đặt lại liên tục, chưa bao giờ đủ ngưỡng', () => {
  const row = delayedFlowRow(
    pr(39, [
      commit('c3', '2026-09-22T05:40:00.000Z'), // 0,33 giờ trước
      commit('c2', '2026-09-22T02:20:00.000Z'),
      commit('c1', '2026-09-21T23:00:00.000Z'),
    ]),
    NOW,
  );
  assert.equal(row.lane, 'platform');
  assert.equal(row.clockResets, 3);
  assert.equal(row.longestStillHours, 3.33);
  assert.equal(row.currentStillHours, 0.33);
  assert.equal(row.hoursShort, 11.67);
  assert.equal(row.reachedThreshold, false);
});

test('delayedFlowRow: bài âm — đứng yên đủ 12 giờ thì `reachedThreshold` phải TRUE và `hoursShort` về 0', () => {
  const row = delayedFlowRow(pr(42, [commit('c1', '2026-09-21T17:00:00.000Z')]), NOW);
  assert.equal(row.longestStillHours, 13);
  assert.equal(row.hoursShort, 0);
  assert.equal(row.reachedThreshold, true);
});

test('delayedFlowRow: ngưỡng đọc từ tham số, không hằng số chôn trong code', () => {
  const row = delayedFlowRow(pr(42, [commit('c1', '2026-09-22T00:00:00.000Z')]), NOW, { delayHours: 3 });
  assert.equal(row.reachedThreshold, true);
  assert.equal(row.hoursShort, 0);
});

test('delayedFlowRow: nhánh không theo dạng `claude/<lane>/<id>` ra lane `null`, không đoán', () => {
  const row = delayedFlowRow(
    { number: 109, title: 'x', headRefName: 'claude/hopeful-dirac-wa0k82', labels: [DELAYED_LABEL], commits: [] },
    NOW,
  );
  assert.equal(row.lane, null);
  assert.equal(row.longestStillHours, 0);
});

// --- `delayedFlowRows` ---

test('delayedFlowRows: chỉ PR mang nhãn `automerge-delayed`, gần tới hạn trước', () => {
  const rows = delayedFlowRows(
    [
      pr(3, [commit('a', '2026-09-22T05:00:00.000Z')]), // còn 11 giờ
      pr(1, [commit('b', '2026-09-21T20:00:00.000Z')]), // còn 2 giờ
      pr(2, [commit('c', '2026-09-22T02:00:00.000Z')], ['automerge']), // cửa khác — loại
      pr(4, [commit('d', '2026-09-21T15:00:00.000Z')]), // đủ giờ
    ],
    NOW,
  );
  assert.deepEqual(
    rows.map((row) => row.number),
    [4, 1, 3],
  );
});

test('delayedFlowRows: nhãn so sánh không phân biệt hoa thường', () => {
  const rows = delayedFlowRows([pr(7, [commit('a', NOW)], ['Automerge-Delayed'])], NOW);
  assert.equal(rows.length, 1);
});

test('summarizeDelayedFlow: đếm tách "từng đủ ngưỡng" khỏi "chắc chắn chưa"', () => {
  const rows = delayedFlowRows(
    [pr(1, [commit('a', '2026-09-21T15:00:00.000Z')]), pr(2, [commit('b', '2026-09-22T05:00:00.000Z')])],
    NOW,
  );
  assert.deepEqual(summarizeDelayedFlow(rows), { delayed: 2, reachedThreshold: 1, neverReached: 1 });
});

// --- `renderDelayedFlowRow` ---

test('renderDelayedFlowRow: nói "còn ít nhất", và nói ra khi đồng hồ bị đặt lại quá ngưỡng', () => {
  const commits = Array.from({ length: RESET_ALERT_THRESHOLD }, (_unused, index) =>
    commit(`c${index}`, `2026-09-22T0${index}:00:00.000Z`),
  );
  const line = renderDelayedFlowRow(delayedFlowRow(pr(39, commits), NOW));
  assert.match(line, /còn ít nhất/);
  assert.match(line, new RegExp(`đồng hồ đặt lại ${RESET_ALERT_THRESHOLD} lần`));
  assert.match(line, /CHƯA BAO GIỜ đủ ngưỡng/);
});

test('renderDelayedFlowRow: PR đã đủ giờ không mang chữ "CHƯA BAO GIỜ"', () => {
  const line = renderDelayedFlowRow(delayedFlowRow(pr(42, [commit('a', '2026-09-21T15:00:00.000Z')]), NOW));
  assert.match(line, /đủ giờ đứng yên/);
  assert.doesNotMatch(line, /CHƯA BAO GIỜ/);
  assert.doesNotMatch(line, /đồng hồ đặt lại/);
});

// --- Phần chạm git ---

test('branchHeadCommits: `--first-parent` đếm một commit gộp là MỘT lần đổi đầu nhánh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'delayed-gate-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git('add', '.');
    git('commit', '-q', '-m', 'nền');

    git('checkout', '-q', '-b', 'nhánh');
    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git('add', '.');
    git('commit', '-q', '-m', 'việc của PR');

    // Hai commit trên `main` trong lúc PR đang mở — đúng hình dạng mà bước
    // 0 của phụ lục P3 gộp vào.
    git('checkout', '-q', 'main');
    for (const name of ['c', 'd']) {
      writeFileSync(join(dir, `${name}.txt`), `${name}\n`);
      git('add', '.');
      git('commit', '-q', '-m', `main ${name}`);
    }

    git('checkout', '-q', 'nhánh');
    git('merge', '-q', '--no-ff', '-m', 'gộp main', 'main');

    const commits = branchHeadCommits(dir, 'nhánh', 'main');
    // Một commit việc + một commit gộp = 2. Không phải 4 (không kéo theo
    // hai commit của `main` vừa gộp vào).
    assert.equal(commits.length, 2);
    for (const item of commits) {
      assert.match(item.sha, /^[0-9a-f]{40}$/);
      // `%cI` luôn kèm offset múi giờ — ràng buộc mà `hoursBetween` đòi.
      assert.match(item.committedAt, /[+-]\d{2}:\d{2}$|Z$/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('branchHeadCommits: nhánh đã đứng sau `main` ra mảng rỗng, không ra một dòng trống', () => {
  const dir = mkdtempSync(join(tmpdir(), 'delayed-gate-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git('add', '.');
    git('commit', '-q', '-m', 'nền');
    git('branch', 'nhánh');

    assert.deepEqual(branchHeadCommits(dir, 'nhánh', 'main'), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
