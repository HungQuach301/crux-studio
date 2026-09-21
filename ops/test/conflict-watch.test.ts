/**
 * `ops/scripts/conflict-watch.ts` — cơ chế của mục `platform/P-007`.
 *
 * Hai tầng, kiểm ở cả hai:
 *
 * - **Hàm thuần** (`conflictOrigin`, `hoursBetween`, `conflictRows`,
 *   `renderConflictRow`): kiểm bằng dữ liệu dựng tay.
 * - **Phần chạm git** (`branchConflicts`, `recentMainCommits`,
 *   `probeConflictOrigin`): kiểm bằng một kho git **thật** dựng trong thư
 *   mục tạm. Không giả lập `spawnSync` — điều mục này khẳng định là "mã
 *   thoát của `git merge-tree` nói đúng chuyện xung đột", và một bản giả
 *   lập chỉ khẳng định lại chính giả định đang cần kiểm.
 *
 * Bài **âm** quan trọng nhất ở đây: mọi commit trong cửa sổ dò đều xung đột
 * thì mốc phải ra `exact: false`. Trả một con số chắc nịch cho một cận dưới
 * là đúng nhóm Z (`ops/known-failures.md`) — bản tin in số giờ sai mà không
 * gì đỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  branchConflicts,
  conflictOrigin,
  conflictRows,
  hoursBetween,
  prHeadRef,
  probeConflictOrigin,
  recentMainCommits,
  renderConflictRow,
  type CommitProbe,
} from '../scripts/conflict-watch.ts';

const NOW = '2026-09-21T18:00:00.000Z';

function probe(sha: string, committedAt: string, conflicts: boolean): CommitProbe {
  return { sha, committedAt, conflicts };
}

// ── conflictOrigin ───────────────────────────────────────────────────────

test('nhánh không xung đột với đầu main thì không có mốc kẹt', () => {
  assert.equal(conflictOrigin([probe('aaa', '2026-09-21T17:00:00Z', false)]), null);
});

test('dãy gộp thử rỗng cũng là "không có mốc", không phải ném', () => {
  assert.equal(conflictOrigin([]), null);
});

test('mốc kẹt là commit CŨ NHẤT trong chuỗi xung đột liền nhau tính từ đầu dãy', () => {
  const origin = conflictOrigin([
    probe('d', '2026-09-21T17:00:00Z', true),
    probe('c', '2026-09-21T16:00:00Z', true),
    probe('b', '2026-09-21T15:44:08Z', true),
    probe('a', '2026-09-21T15:00:00Z', false),
  ]);
  assert.deepEqual(origin, { sha: 'b', committedAt: '2026-09-21T15:44:08Z', exact: true });
});

test('mọi commit trong cửa sổ dò đều xung đột → mốc chỉ là cận dưới, exact: false', () => {
  const origin = conflictOrigin([
    probe('c', '2026-09-21T17:00:00Z', true),
    probe('b', '2026-09-21T16:00:00Z', true),
    probe('a', '2026-09-21T15:00:00Z', true),
  ]);
  assert.deepEqual(origin, { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: false });
});

test('một lần kẹt CŨ đã được gỡ không kéo mốc của lần đang kẹt về sớm hơn', () => {
  // d,c đang xung đột · b sạch (đã gỡ) · a xung đột (lần kẹt trước, đã xong).
  const origin = conflictOrigin([
    probe('d', '2026-09-21T17:00:00Z', true),
    probe('c', '2026-09-21T16:00:00Z', true),
    probe('b', '2026-09-21T15:00:00Z', false),
    probe('a', '2026-09-21T14:00:00Z', true),
  ]);
  assert.equal(origin?.sha, 'c');
  assert.equal(origin?.exact, true);
});

// ── hoursBetween ─────────────────────────────────────────────────────────

test('số giờ kẹt tính đúng và làm tròn hai chữ số', () => {
  assert.equal(hoursBetween('2026-09-21T15:44:08Z', '2026-09-21T17:06:00Z'), 1.36);
});

test('mốc thời gian không đọc được thì NÉM, không trả NaN giờ lên bản tin', () => {
  assert.throws(() => hoursBetween('hôm qua', NOW), /không đọc được/);
});

// ── conflictRows ─────────────────────────────────────────────────────────

test('xếp kẹt lâu nhất trước — cùng thứ tự mà phụ lục P3 bước 0a đòi', () => {
  const rows = conflictRows(
    [
      { number: 56, title: 'B', labels: [], origin: { sha: 'b', committedAt: '2026-09-21T17:00:00Z', exact: true } },
      { number: 39, title: 'A', labels: [], origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true } },
    ],
    NOW,
  );
  assert.deepEqual(
    rows.map((r) => [r.number, r.hoursStuck]),
    [
      [39, 3],
      [56, 1],
    ],
  );
});

test('PR không dò được mốc xếp CUỐI nhưng không bị bỏ khỏi bảng', () => {
  const rows = conflictRows(
    [
      { number: 70, title: 'không dò được', labels: [], origin: null },
      { number: 39, title: 'A', labels: [], origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true } },
    ],
    NOW,
  );
  assert.deepEqual(
    rows.map((r) => r.number),
    [39, 70],
  );
  assert.equal(rows[1]!.hoursStuck, null);
});

test('PR mang nhãn tự merge mà đang xung đột thì đồng hồ chờ bị khai là ĐỨNG', () => {
  const rows = conflictRows(
    [
      {
        number: 56,
        title: 'P-021',
        labels: ['automerge-delayed', 'cross-lane'],
        origin: { sha: 'b', committedAt: '2026-09-21T15:44:08Z', exact: true },
      },
      {
        number: 62,
        title: 'P-014',
        labels: ['owner-merge'],
        origin: { sha: 'b', committedAt: '2026-09-21T15:44:08Z', exact: true },
      },
    ],
    NOW,
  );
  assert.equal(rows.find((r) => r.number === 56)!.clockFrozen, true);
  assert.equal(rows.find((r) => r.number === 62)!.clockFrozen, false);
});

test('dòng bản tin nói rõ "ít nhất" khi mốc chỉ là cận dưới', () => {
  const [exact] = conflictRows(
    [{ number: 1, title: 'x', labels: [], origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true } }],
    NOW,
  );
  const [lower] = conflictRows(
    [{ number: 2, title: 'y', labels: [], origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: false } }],
    NOW,
  );
  assert.match(renderConflictRow(exact!), /kẹt 3\.00 giờ/);
  assert.match(renderConflictRow(lower!), /kẹt ít nhất 3\.00 giờ/);
});

test('dòng bản tin của PR không dò được mốc nói thẳng là không dò được', () => {
  const [row] = conflictRows([{ number: 9, title: 'z', labels: [], origin: null }], NOW);
  assert.match(renderConflictRow(row!), /KHÔNG dò được mốc kẹt/);
});

// ── Phần chạm git, trên một kho thật ─────────────────────────────────────

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/**
 * Kho thử: `main` có bốn commit. Nhánh `feat` rẽ ra ở commit đầu và sửa
 * dòng 1 của `shared.txt`. Commit thứ ba của `main` sửa **cùng dòng đó**,
 * nên `feat` gộp sạch với hai commit đầu và xung đột từ commit thứ ba.
 */
function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-conflict-'));
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');

  writeFileSync(join(root, 'shared.txt'), 'dòng một\ndòng hai\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'c1');

  git(root, 'checkout', '--quiet', '-b', 'feat');
  writeFileSync(join(root, 'shared.txt'), 'dòng một của nhánh\ndòng hai\n');
  git(root, 'commit', '--quiet', '-am', 'feat sửa dòng 1');

  git(root, 'checkout', '--quiet', 'main');
  writeFileSync(join(root, 'khac.txt'), 'không liên quan\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'c2 — không đụng shared.txt');

  writeFileSync(join(root, 'shared.txt'), 'dòng một của main\ndòng hai\n');
  git(root, 'commit', '--quiet', '-am', 'c3 — đụng đúng dòng 1');

  writeFileSync(join(root, 'khac.txt'), 'không liên quan, lần hai\n');
  git(root, 'commit', '--quiet', '-am', 'c4 — không đụng shared.txt');

  return root;
}

test('branchConflicts đọc đúng mã thoát của git merge-tree', () => {
  const root = makeRepo();
  try {
    const commits = recentMainCommits(root, 'main');
    assert.equal(commits.length, 4);
    // c4 và c3 mang thay đổi đụng dòng 1 → xung đột; c2 và c1 thì không.
    assert.equal(branchConflicts(root, 'feat', commits[0]!.sha), true);
    assert.equal(branchConflicts(root, 'feat', commits[1]!.sha), true);
    assert.equal(branchConflicts(root, 'feat', commits[2]!.sha), false);
    assert.equal(branchConflicts(root, 'feat', commits[3]!.sha), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('branchConflicts NÉM khi ref không tồn tại — mã thoát 1 của git KHÔNG được đọc thành "xung đột"', () => {
  // Đo bằng chạy thật: `git merge-tree --write-tree main <ref không có>`
  // thoát **1**, đúng mã thoát của "có xung đột". Không có phép xác nhận
  // ref thì một PR chưa nạp về hiện lên bản tin như một chỗ kẹt không tồn
  // tại — nhóm Z. Cả hai vị trí tham số đều phải bị bắt.
  const root = makeRepo();
  try {
    assert.throws(() => branchConflicts(root, 'feat', 'khong-co-ref-nay'), /Ref không trỏ tới commit nào/);
    assert.throws(() => branchConflicts(root, 'khong-co-nhanh-nay', 'main'), /Ref không trỏ tới commit nào/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('probeConflictOrigin tìm đúng commit gây xung đột trên kho thật', () => {
  const root = makeRepo();
  try {
    const commits = recentMainCommits(root, 'main');
    const origin = probeConflictOrigin(root, 'feat', commits);
    assert.equal(origin?.sha, commits[1]!.sha, 'mốc phải là c3, commit đầu tiên đụng dòng 1');
    assert.equal(origin?.exact, true);
    assert.equal(origin?.committedAt, commits[1]!.committedAt);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('nhánh gộp sạch với đầu main thì probeConflictOrigin trả null sau ĐÚNG một lần gộp thử', () => {
  const root = makeRepo();
  try {
    git(root, 'checkout', '--quiet', '-b', 'sach', 'main');
    writeFileSync(join(root, 'them.txt'), 'thuần cộng thêm\n');
    git(root, 'add', '.');
    git(root, 'commit', '--quiet', '-m', 'thêm file mới');
    assert.equal(probeConflictOrigin(root, 'sach', recentMainCommits(root, 'main')), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cửa sổ dò quá ngắn để thấy commit sạch → exact: false, không khai chắc mốc', () => {
  const root = makeRepo();
  try {
    // Chỉ dò 2 commit gần nhất (c4, c3) — cả hai xung đột, chưa chạm c2 sạch.
    const origin = probeConflictOrigin(root, 'feat', recentMainCommits(root, 'main', 2));
    assert.equal(origin?.exact, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('recentMainCommits NÉM khi ref không có — mảng rỗng ở đây cho ra "0 PR kẹt"', () => {
  const root = makeRepo();
  try {
    assert.throws(() => recentMainCommits(root, 'khong-co-nhanh-nay'), /Không đọc được lịch sử/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ref cục bộ của một PR dựng từ số PR, không từ tên nhánh', () => {
  assert.equal(prHeadRef(56), 'refs/remotes/pr/56');
});
