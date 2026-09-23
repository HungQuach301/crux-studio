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
  isProbeError,
  measureConflicts,
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

// ── Năm chỗ soát chéo (ngữ cảnh sạch) bắt được, mỗi chỗ một bài ──────────

test('clockFrozen so nhãn KHÔNG phân biệt hoa thường — cùng cách decideMerge chuẩn hoá', () => {
  // Nhãn GitHub giữ nguyên chữ hoa nhưng chỉ duy nhất theo kiểu không phân
  // biệt hoa thường. So thẳng thì một nhãn gõ `AutoMerge` làm mất đúng dòng
  // cảnh báo "đồng hồ chờ không chạy".
  const [row] = conflictRows(
    [
      {
        number: 1,
        title: 'x',
        labels: ['AutoMerge-Delayed'],
        origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true },
      },
    ],
    NOW,
  );
  assert.equal(row!.clockFrozen, true);
});

test('mốc kẹt ở TƯƠNG LAI: kẹp về 0 và BÁO cờ lệch đồng hồ, không in số giờ âm', () => {
  const [row] = conflictRows(
    [
      {
        number: 7,
        title: 'x',
        labels: [],
        origin: { sha: 'a', committedAt: '2026-09-22T04:00:00Z', exact: true },
      },
    ],
    NOW,
  );
  assert.equal(row!.hoursStuck, 0);
  assert.equal(row!.clockSkew, true);
  assert.doesNotMatch(renderConflictRow(row!), /-\d/);
  assert.match(renderConflictRow(row!), /TƯƠNG LAI/);
});

test('mốc kẹt bình thường thì KHÔNG bật cờ lệch đồng hồ', () => {
  const [row] = conflictRows(
    [{ number: 8, title: 'x', labels: [], origin: { sha: 'a', committedAt: '2026-09-21T15:00:00Z', exact: true } }],
    NOW,
  );
  assert.equal(row!.clockSkew, false);
  assert.doesNotMatch(renderConflictRow(row!), /TƯƠNG LAI/);
});

test('recentMainCommits NÉM khi git thoát 0 nhưng không cho commit nào', () => {
  // `git log main:shared.txt` (một blob) và `--max-count=0` đều thoát 0 và
  // in rỗng. Trả `[]` ở đây cho ra "0 PR xung đột" trên bản tin — nhóm Z.
  const root = makeRepo();
  try {
    assert.throws(() => recentMainCommits(root, 'main', 0), /không cho commit nào/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── measureConflicts qua remote thật (mục I-017, KF-015) ─────────────────────
//
// Hai bài dưới đây chạm cả `git fetch` lẫn `git clone`, nên chúng dựng một
// kho **upstream** thật trong thư mục tạm rồi clone ra — không giả lập
// remote. Điều I-017 khẳng định là "kho nông làm phép đo ra ngược", và một
// bản giả lập chỉ khẳng định lại chính giả định đang cần kiểm (cùng lý do
// makeRepo ở trên không giả lập `spawnSync`).

/**
 * Upstream có `main` (c1→c3) và hai `refs/pull/<n>/head`:
 *  - PR 1 (`feat`): rẽ ra ở c1, chỉ **thêm** file — gộp sạch với đầu `main`
 *    khi lịch sử ĐẦY ĐỦ; nhưng trên kho nông, tổ tiên chung c1 nằm ngoài
 *    phần đã tải nên `merge-tree` ra `refusing to merge unrelated histories`.
 *  - PR 2 (`orphan`): lịch sử gốc **riêng**, không có tổ tiên chung với
 *    `main` kể cả khi đầy đủ — `merge-tree` thoát 128 thật, dùng để kiểm một
 *    PR hỏng không làm tắt cả mẻ.
 */
function makeUpstream(): string {
  const up = mkdtempSync(join(tmpdir(), 'crux-upstream-'));
  git(up, 'init', '--quiet', '--initial-branch=main');
  git(up, 'config', 'user.email', 'test@example.com');
  git(up, 'config', 'user.name', 'Test');

  writeFileSync(join(up, 'shared.txt'), 'dòng một\ndòng hai\n');
  git(up, 'add', '.');
  git(up, 'commit', '--quiet', '-m', 'c1');

  git(up, 'checkout', '--quiet', '-b', 'feat');
  writeFileSync(join(up, 'them.txt'), 'thuần cộng thêm\n');
  git(up, 'add', '.');
  git(up, 'commit', '--quiet', '-m', 'feat: chỉ thêm file, gộp sạch');
  git(up, 'update-ref', 'refs/pull/1/head', 'refs/heads/feat');

  git(up, 'checkout', '--quiet', '--orphan', 'orphan');
  git(up, 'rm', '--quiet', '-rf', '.');
  writeFileSync(join(up, 'goc-rieng.txt'), 'lịch sử gốc riêng\n');
  git(up, 'add', '.');
  git(up, 'commit', '--quiet', '-m', 'orphan: gốc riêng, không tổ tiên chung');
  git(up, 'update-ref', 'refs/pull/2/head', 'refs/heads/orphan');

  git(up, 'checkout', '--quiet', 'main');
  writeFileSync(join(up, 'khac.txt'), 'không liên quan\n');
  git(up, 'add', '.');
  git(up, 'commit', '--quiet', '-m', 'c2');
  writeFileSync(join(up, 'shared.txt'), 'dòng một\ndòng hai\ndòng ba\n');
  git(up, 'commit', '--quiet', '-am', 'c3 — thêm dòng, không đụng phần feat/orphan');

  return up;
}

test('KF-015: kho nông báo "xung đột" cho nhánh gộp sạch — unshallow trước khi đo mới đúng', () => {
  // ĐỎ trên bản `main` cũ: `measureConflicts` ném `refusing to merge
  // unrelated histories` (128) trên kho nông. XANH sau bản sửa:
  // `fetchProbeRefs` unshallow trước, PR gộp sạch ra `null`.
  const up = makeUpstream();
  const clone = mkdtempSync(join(tmpdir(), 'crux-shallow-'));
  rmSync(clone, { recursive: true, force: true });
  try {
    execFileSync('git', ['clone', '--quiet', '--depth=1', `file://${up}`, clone]);
    assert.equal(
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: clone, encoding: 'utf8' }).trim(),
      'true',
      'điều kiện bài kiểm: clone phải nông',
    );

    const origins = measureConflicts(clone, [1], 'origin/main');
    assert.equal(origins.get(1), null, 'PR chỉ thêm file phải là gộp sạch, không phải "xung đột" của kho nông');
    assert.equal(
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: clone, encoding: 'utf8' }).trim(),
      'false',
      'đo xong thì kho không còn nông',
    );
  } finally {
    rmSync(up, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  }
});

test('I-017 · PR dò HỎNG in "CHƯA kết luận xung đột", KHÔNG khẳng định "xung đột" (chống báo động sai KF-015)', () => {
  const rows = conflictRows(
    [{ number: 7, title: 't', labels: [], origin: null, probeError: 'refusing to merge unrelated histories' }],
    NOW,
  );
  assert.equal(rows[0]!.probeError, 'refusing to merge unrelated histories');
  assert.equal(rows[0]!.hoursStuck, null);
  const line = renderConflictRow(rows[0]!);
  assert.match(line, /dò HỎNG, CHƯA kết luận xung đột/);
  assert.doesNotMatch(line, /(^|[^A-Za-zÀ-ỹ])xung đột,/, 'không được khẳng định "xung đột," cho một PR chỉ là dò hỏng');
});

test('origin null mà KHÔNG có probeError vẫn là "xung đột, KHÔNG dò được mốc" (ca cửa sổ dò rỗng)', () => {
  const rows = conflictRows([{ number: 8, title: 'y', labels: [], origin: null }], NOW);
  assert.equal(rows[0]!.probeError, null);
  assert.match(renderConflictRow(rows[0]!), /xung đột, KHÔNG dò được mốc kẹt/);
});

test('một PR hỏng (thoát 128) không làm tắt phép đo của PR còn lại', () => {
  // ĐỎ trên bản `main` cũ: lỗi 128 của PR orphan ném ra ngoài vòng lặp, cả
  // `measureConflicts` chết theo, PR 1 mất kết quả. XANH sau bản sửa: lỗi
  // bắt theo từng PR — PR 1 vẫn ra `null`, PR 2 ra `ConflictProbeError`.
  const up = makeUpstream();
  const clone = mkdtempSync(join(tmpdir(), 'crux-batch-'));
  rmSync(clone, { recursive: true, force: true });
  try {
    execFileSync('git', ['clone', '--quiet', `file://${up}`, clone]);

    const origins = measureConflicts(clone, [2, 1], 'origin/main');

    assert.equal(origins.get(1), null, 'PR gộp sạch vẫn được đo dù PR trước nó trong mẻ hỏng');
    const bad = origins.get(2);
    assert.ok(bad !== undefined && isProbeError(bad), 'PR orphan phải ra lỗi dò riêng, không phải null (gộp sạch)');
    assert.match((bad as { error: string }).error, /unrelated histories|thoát/);
  } finally {
    rmSync(up, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  }
});
