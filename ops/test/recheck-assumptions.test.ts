/**
 * `ops/scripts/recheck-assumptions.ts` — mục `I-003`.
 *
 * Bài kiểm của G17 chạy git thật trong thư mục tạm, không mô phỏng: cùng lý
 * do đã ghi ở `integrator-resolve.test.ts`, và lý do đó do chính G17 dạy ra.
 * Phần còn lại là hàm thuần, kiểm bằng dữ liệu dựng sẵn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AUTO_CHECKS,
  AUTO_CHECK_IDS,
  collectCommits,
  collectRoutineRuns,
  formatDecisionIssue,
  isToolCommit,
  judgeTrailerEvidence,
  judgeUnionRuns,
  judgeWorkerFleet,
  listRemoteClaudeBranches,
  parseLedger,
  readFleetLogs,
  runUnionExperiment,
  type CheckReport,
  type CommitTrailerInfo,
} from '../scripts/recheck-assumptions.ts';
import type { RunLogLine } from '@crux/kernel';

/** Không gọi `gh` thật trong test — mọi lời gọi `collectCommits` dưới đây tự khai nhánh nào đang có PR mở. */
function openBranches(...branches: string[]): () => Set<string> {
  return () => new Set(branches);
}

const LEDGER_MAU = `# Sổ

## G14 · Trailer

- **Nội dung:** commit mang trailer.
- **Độ tin cậy:** **\`đã kiểm một phần\`**
- **Phần phụ thuộc:** \`ops/workflows/ci.yml\` (job \`trailer-warn\`) · \`CLAUDE.md\` mục 6 · CHARTER 3.1
- **Kiểm tự động:** \`session-trailer-on-branch\` — quét lịch sử git.
- **Trạng thái:** giao làn verify.

## G99 · Không kiểm được bằng máy

- **Nội dung:** cần người đọc điều khoản.
- **Độ tin cậy:** \`suy luận\`
- **Phần phụ thuộc:** \`ops/license-ledger.md\`
- **Cách kiểm:** đọc điều khoản.
`;

test('parseLedger đọc được độ tin cậy, phần phụ thuộc và mã bài kiểm', () => {
  const entries = parseLedger(LEDGER_MAU);
  assert.equal(entries.length, 2);

  const g14 = entries[0]!;
  assert.equal(g14.code, 'G14');
  assert.equal(g14.confidence, 'đã kiểm một phần');
  assert.equal(g14.autoCheck, 'session-trailer-on-branch');
  // Nguyên văn, kể cả phần chú trong ngoặc — danh sách này đi thẳng vào issue.
  assert.deepEqual(g14.dependencies, [
    '`ops/workflows/ci.yml` (job `trailer-warn`)',
    '`CLAUDE.md` mục 6',
    'CHARTER 3.1',
  ]);
});

test('parseLedger để trống mã bài kiểm khi mục không khai — đó là câu trả lời đúng, không phải ô bỏ trống', () => {
  const g99 = parseLedger(LEDGER_MAU)[1]!;
  assert.equal(g99.code, 'G99');
  assert.equal(g99.autoCheck, undefined);
});

test('formatDecisionIssue có đủ năm phần của CLAUDE.md mục 14 và chép nguyên danh sách phần bị ảnh hưởng', () => {
  const entry = parseLedger(LEDGER_MAU)[0]!;
  const report: CheckReport = {
    code: 'G14',
    checkId: 'session-trailer-on-branch',
    verdict: 'sai',
    observed: '2/3 commit thiếu trailer.',
    evidence: ['`abc1234` một commit — thiếu trailer'],
  };

  const { title, body } = formatDecisionIssue(entry, report);

  assert.match(title, /^🤖 \[QĐ\] /, 'tiêu đề issue phải bắt đầu bằng 🤖 (CLAUDE.md mục 5)');
  assert.match(body, /^🤖 /, 'thân issue phải bắt đầu bằng 🤖');
  for (const part of ['## Bối cảnh', '## Phương án', '## Khuyến nghị', '## Nếu anh chưa trả lời', '## Cách trả lời']) {
    assert.ok(body.includes(part), `thiếu phần ${part}`);
  }
  for (const dep of entry.dependencies) {
    assert.ok(body.includes(`- ${dep}`), `thiếu phần bị ảnh hưởng: ${dep}`);
  }
  assert.ok(body.includes('`đã kiểm một phần`'), 'phải nói sổ đang ghi độ tin cậy nào');
  assert.ok(body.includes(report.evidence[0]!), 'phải chép bằng chứng vào issue');
});

const COMMIT_CO_TRAILER: CommitTrailerInfo = {
  sha: 'aaaaaaa',
  subject: 'topic: mục A',
  hasSessionTrailer: true,
};

test('isToolCommit chỉ nhận đúng message do máy sinh, không nhận commit việc thật', () => {
  assert.ok(isToolCommit('Gộp origin/main (integrator, không xung đột)'));
  assert.ok(isToolCommit('Gộp origin/main (integrator, union thuần cộng thêm: ops/logs/platform.jsonl)'));
  assert.ok(isToolCommit('Merge branch \'main\' into claude/topic/T-001'));
  assert.ok(!isToolCommit('topic: T-001 — bản đồ đề tài'));
  assert.ok(!isToolCommit('Gộp hai mô hình định lượng vào một bảng'), 'commit việc thật có chữ "Gộp" vẫn là của agent');
});

/**
 * TÁI HIỆN LỖI (bất biến I2) — mục `platform/P-042`, bộ đọc tiêu đề thứ tư.
 *
 * Mọi luật của `isToolCommit` neo `^`, mà `CLAUDE.md` mục 5 bắt buộc agent
 * mở đầu bằng 🤖. Message dưới đây có THẬT trong lịch sử repo. Chiều hỏng ở
 * đây là fail-**closed** (commit công cụ bị đếm thành commit agent, nên bài
 * kiểm G14 báo "sai" oan) — ồn chứ không im lặng, nhưng vẫn là cùng một chữ
 * ký lỗi mà `KF-027` tồn tại để không có lần thứ tư.
 */
test('P-042 · isToolCommit không mù trước tiền tố 🤖 của CLAUDE.md mục 5', () => {
  assert.ok(isToolCommit('🤖 Gộp origin/main vào nhánh #174 — gỡ chỗ đỏ kế thừa từ main'));
  assert.ok(isToolCommit('🤖 chore: sync workflows from ops/workflows [skip ci]'));
  assert.ok(isToolCommit("🤖 Merge branch 'main' into claude/topic/T-001"));
  assert.ok(isToolCommit('🤖 Gộp origin/main (integrator, không xung đột)'));
  // KHÔNG nới: danh sách trắng vẫn là danh sách trắng sau khi bỏ tiền tố.
  assert.ok(
    !isToolCommit('🤖 Gộp hai mô hình định lượng vào một bảng'),
    'bỏ tiền tố không được biến danh sách trắng thành danh sách đen trá hình',
  );
  assert.ok(!isToolCommit('🤖 [platform] P-042 — a'));
});

test('I-012 · isToolCommit nhận thêm commit sync-workflows và merge tay "Gộp main vào <nhánh>"', () => {
  // Quan sát thật, lượt crux-integrator 2026-09-22 02:05 (thân mục I-012).
  assert.ok(isToolCommit('chore: sync workflows from ops/workflows [skip ci]'));
  assert.ok(isToolCommit('Gộp main vào claude/integration/I-009'));
  assert.ok(isToolCommit('Gộp origin/main vào claude/verify/VF-G11'));
  assert.ok(isToolCommit('Gộp main (920146f) vào V-001 — không xung đột'), 'sha ngắn kèm sau "main" vẫn phải nhận');
  assert.ok(
    !isToolCommit('Gộp hai mô hình định lượng vào một bảng'),
    'mốc neo là "main"/"origin/main" ngay sau "Gộp", không phải chữ "Gộp … vào" nói chung',
  );
  assert.ok(
    !isToolCommit('chore: sync workflows nhưng viết tay, không phải Action'),
    'phải khớp đúng tiền tố sinh bởi Action, không khớp mọi câu có chữ "sync workflows"',
  );
});

test('G14 khớp khi mọi commit của agent đều mang trailer', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'bbbbbbb', subject: 'topic: mục B', hasSessionTrailer: true },
  ]);
  assert.equal(outcome.verdict, 'khớp');
  assert.notEqual(outcome.observedNothing, true, 'có commit để quan sát thì không phải "chưa quan sát được"');
});

test('G14 sai khi một commit của agent thiếu trailer, và nêu đích danh commit đó', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'ccccccc', subject: 'topic: mục C', hasSessionTrailer: false },
  ]);
  assert.equal(outcome.verdict, 'sai');
  assert.ok(outcome.evidence.some((line) => line.includes('ccccccc')), 'phải nêu sha của commit thiếu trailer');
  assert.ok(!outcome.evidence.some((line) => line.includes('aaaaaaa')), 'không kể tên commit không có vấn đề');
});

test('G14 KHÔNG tính merge commit của integrator — message của nó do máy sinh', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'ddddddd', subject: 'Gộp origin/main (integrator, không xung đột)', hasSessionTrailer: false },
  ]);
  assert.equal(outcome.verdict, 'khớp', 'merge commit của integrator không được làm G14 thành sai');
  assert.ok(
    outcome.evidence.some((line) => line.includes('công cụ')),
    'nhưng vẫn phải báo ra thành ghi chú, không im lặng bỏ qua',
  );
});

test('G14 SAI khi cả hai trailer cùng biến mất — đây là kịch bản hỏng thật của G14', () => {
  // Hôm nền tảng tắt `attribution`, commit của agent mất CẢ `Co-Authored-By`
  // LẪN `Claude-Session`. Bản đầu của bài kiểm suy ra "người soạn" từ
  // `Co-Authored-By`, nên nó xếp hết sang nhóm "công cụ" và kết luận `khớp` —
  // xanh đúng lúc phải đỏ. Test này giữ cho lỗi đó không quay lại.
  const outcome = judgeTrailerEvidence([
    { sha: 'e111111', subject: 'topic: T-001 — làm việc thật', hasSessionTrailer: false },
    { sha: 'e222222', subject: 'visual: V-002 — spike canvas', hasSessionTrailer: false },
  ]);
  assert.equal(outcome.verdict, 'sai');
  assert.equal(outcome.observedNothing, undefined, 'không được coi đây là "không có gì để quan sát"');
});

test('G14 phân biệt "không có gì để quan sát" với "đã quan sát và thấy đúng"', () => {
  const trong = judgeTrailerEvidence([]);
  assert.equal(trong.verdict, 'khớp');
  assert.equal(trong.observedNothing, true, 'cửa sổ quét rỗng phải mang dấu riêng, không in ra như một ✓');

  const chiCoCongCu = judgeTrailerEvidence([
    { sha: 'fff1111', subject: 'Gộp origin/main (integrator, không xung đột)', hasSessionTrailer: false },
  ]);
  assert.equal(chiCoCongCu.observedNothing, true);
});

test('G17 khớp khi luật tới cùng lần gộp thì xung đột, còn nhánh mang sẵn luật thì sạch', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'xung đột', ruleAlreadyOnBranch: 'sạch' });
  assert.equal(outcome.verdict, 'khớp');
});

test('G17 sai khi git bắt đầu áp luật cho chính lần gộp mang nó tới', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'sạch', ruleAlreadyOnBranch: 'sạch' });
  assert.equal(outcome.verdict, 'sai');
  assert.ok(outcome.evidence.some((line) => line.includes('Lần 1')));
});

test('G17 sai khi union hết cứu được cả lần nhánh đã mang sẵn luật', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'xung đột', ruleAlreadyOnBranch: 'xung đột' });
  assert.equal(outcome.verdict, 'sai');
  assert.match(outcome.observed, /union KHÔNG còn cứu được/);
});

test('thí nghiệm G17 chạy git thật: đổi đúng một điều kiện thì kết quả gộp đổi theo', () => {
  const runs = runUnionExperiment();
  assert.equal(
    runs.ruleArrivesWithMerge,
    'xung đột',
    'luật merge do main mang tới không áp cho chính lần gộp mang nó tới (bài học G17)',
  );
  assert.equal(runs.ruleAlreadyOnBranch, 'sạch', 'nhánh đã mang sẵn luật thì union giữ cả hai dòng');
});

test('mỗi bài kiểm có mã riêng, không trùng, và mã viết bằng tiếng Anh (CLAUDE.md mục 9)', () => {
  assert.equal(new Set(AUTO_CHECK_IDS).size, AUTO_CHECK_IDS.length);
  for (const check of AUTO_CHECKS) {
    assert.match(check.code, /^G\d+$/);
    assert.match(check.id, /^[a-z0-9-]+$/, 'định danh trong code viết bằng tiếng Anh, không dấu, nối bằng gạch');
  }
});

test('mọi mã bài kiểm mà sổ thật đang khai đều có bài kiểm thật', () => {
  const ledger = readFileSync(join(process.cwd(), 'docs', 'assumptions.md'), 'utf8');
  const declared = parseLedger(ledger)
    .map((entry) => entry.autoCheck)
    .filter((id): id is string => id !== undefined);

  assert.ok(declared.length > 0, 'sổ phải khai ít nhất một bài kiểm tự động, nếu không mục I-003 vô nghĩa');
  for (const id of declared) {
    assert.ok(AUTO_CHECK_IDS.includes(id), `sổ khai \`${id}\` nhưng không có bài kiểm nào tên thế`);
  }
});

/**
 * `collectCommits` là **chỗ đã có bug thật** trong chính PR này: bản đầu quét
 * cả `main`, gặp commit squash do GitHub tạo (giữ `Co-Authored-By`, mất
 * `Claude-Session` vì trailer bị đẩy vào giữa message ghép) và báo G14 `sai`
 * vì một lý do chẳng liên quan gì tới G14.
 *
 * Lỗi đó nằm ở **phạm vi quét**, nên test dựng repo git thật có đúng hình
 * dạng ấy — một commit squash kiểu GitHub trên `main`, một commit agent trên
 * nhánh — thay vì kiểm bằng dữ liệu dựng sẵn. Đúng bài học G17: bài thử phải
 * tái hiện điều kiện đầu vào của lần chạy thật.
 */
function initBare(path: string): void {
  const result = spawnSync('git', ['init', '-q', '--bare', '-b', 'main', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git init --bare: ${result.stderr || result.stdout}`);
}

function gitIn(dir: string) {
  return (args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr || result.stdout}`);
    return result.stdout;
  };
}

/**
 * Kho làm việc có **remote `origin` thật** (một kho bare cạnh bên), không
 * phải `update-ref` giả. Từ mục `I-005`, `collectCommits` tự
 * `git fetch origin '+refs/heads/claude/*:…'` trước khi quét, nên một repo
 * không có remote không còn tái hiện được lần chạy thật.
 */
function initRepoCoSquash(): { root: string; repo: string } {
  const root = mkdtempSync(join(tmpdir(), 'recheck-collect-'));
  const bare = join(root, 'origin.git');
  const repo = join(root, 'work');
  mkdirSync(repo, { recursive: true });

  initBare(bare);

  const git = gitIn(repo);
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['remote', 'add', 'origin', bare]);

  writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'goc']);

  // Commit squash kiểu GitHub: message ghép, nên `Claude-Session` nằm GIỮA
  // message và không còn được git đọc như một trailer.
  writeFileSync(join(repo, 'a.txt'), 'goc\nmain\n', 'utf8');
  git(['add', '.']);
  git([
    'commit',
    '-q',
    '-m',
    '[topic] T-001 — bản đồ đề tài (#42)\n\ntopic: bước một\n\nClaude-Session: https://claude.ai/code/session_cu\n\ntopic: bước hai\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
  ]);
  git(['push', '-q', '-u', 'origin', 'main']);

  // Commit agent trên nhánh PR, chưa vào `main`.
  git(['checkout', '-q', '-b', 'claude/topic/T-002']);
  writeFileSync(join(repo, 'a.txt'), 'goc\nmain\nnhanh\n', 'utf8');
  git(['add', '.']);
  git([
    'commit',
    '-q',
    '-m',
    'topic: T-002 — việc đang làm\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_moi',
  ]);
  git(['push', '-q', 'origin', 'claude/topic/T-002']);

  return { root, repo };
}

test('collectCommits chỉ nhặt commit nhánh PR, KHÔNG nhặt commit squash trên main', () => {
  const { root, repo } = initRepoCoSquash();
  try {
    const commits = collectCommits(repo, 14, openBranches('claude/topic/T-002'));
    assert.equal(commits.length, 1, 'chỉ commit chưa vào main mới được tính');
    assert.match(commits[0]!.subject, /T-002/);
    assert.equal(commits[0]!.hasSessionTrailer, true);
    assert.ok(
      !commits.some((c) => c.subject.includes('(#42)')),
      'commit squash trên main không được lọt vào — nó mất trailer vì squash, không vì G14 sai',
    );
    // Và kết luận cuối cùng phải là `khớp`, không phải `sai` như bản đầu.
    assert.equal(judgeTrailerEvidence(commits).verdict, 'khớp');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Mục `I-012`, hình dạng đã quan sát thật (lượt `crux-integrator`
 * 2026-09-22 02:05): `origin/claude/platform/P-009` còn ref trên remote dù
 * PR `#9` đã squash-merge từ lâu — nhánh mang cả ba commit gốc của CHÍNH
 * chủ dự án (trước cả CLAUDE.md), không có trailer và KHÔNG THỂ có trailer.
 * Trước bản sửa này, `collectCommits` cứ thấy ref là quét, nên G14 báo
 * `sai` mãi mãi cho một nhánh sẽ không bao giờ được sửa.
 *
 * Dựng đúng hình dạng đó: một nhánh KHÔNG có PR mở (mô phỏng bằng
 * `openBranches` không liệt kê nó) mang commit thiếu trailer, đứng cạnh một
 * nhánh CÓ PR mở mang toàn commit đủ trailer. `collectCommits` phải bỏ hẳn
 * nhánh đầu, và G14 phải ra `khớp` — không phải vì commit thiếu trailer
 * biến mất, mà vì nó chưa từng nằm trong phạm vi quét.
 */
function initRepoCoNhanhStale(): { root: string; repo: string } {
  const root = mkdtempSync(join(tmpdir(), 'recheck-stale-branch-'));
  const bare = join(root, 'origin.git');
  const repo = join(root, 'work');
  mkdirSync(repo, { recursive: true });
  initBare(bare);

  const git = gitIn(repo);
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'commit.gpgsign', 'false']);
  git(['remote', 'add', 'origin', bare]);

  writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'goc']);
  git(['push', '-q', '-u', 'origin', 'main']);

  // Nhánh stale: PR đã merge (squash) từ lâu, ref vẫn còn trên remote,
  // KHÔNG có PR mở. Commit của chính chủ dự án, qua giao diện web — không
  // trailer, và đúng như vậy theo thiết kế (CLAUDE.md mục 5 chỉ ràng buộc
  // commit của agent).
  git(['checkout', '-q', '-b', 'claude/platform/P-009']);
  writeFileSync(join(repo, 'p009.txt'), 'chu du an\n', 'utf8');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'Initial commit']);
  git(['push', '-q', 'origin', 'claude/platform/P-009']);

  // Nhánh sống: PR đang mở, commit của agent, đủ trailer.
  git(['checkout', '-q', 'main']);
  git(['checkout', '-q', '-b', 'claude/topic/T-005']);
  writeFileSync(join(repo, 't005.txt'), 'viec dang lam\n', 'utf8');
  git(['add', '.']);
  git([
    'commit',
    '-q',
    '-m',
    'topic: T-005 — việc đang làm\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_song',
  ]);
  git(['push', '-q', 'origin', 'claude/topic/T-005']);

  return { root, repo };
}

test('I-012 · nhánh đã squash-merge còn sót trên remote (không PR mở) bị loại khỏi phạm vi quét G14', () => {
  const { root, repo } = initRepoCoNhanhStale();
  try {
    // Chỉ claude/topic/T-005 còn PR mở — claude/platform/P-009 không được liệt kê.
    const commits = collectCommits(repo, 14, openBranches('claude/topic/T-005'));
    assert.equal(commits.length, 1, 'chỉ nhánh còn PR mở mới được quét');
    assert.match(commits[0]!.subject, /T-005/);
    assert.ok(
      !commits.some((c) => c.subject.includes('Initial commit')),
      'commit của nhánh stale (không PR mở) không được lọt vào, dù nó thiếu trailer thật',
    );
    assert.equal(
      judgeTrailerEvidence(commits).verdict,
      'khớp',
      'G14 không được kêu oan cho một nhánh đã xong việc và sẽ không bao giờ được sửa',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I-012 · phép lọc nhánh còn PR mở KHÔNG nuốt tín hiệu thật — commit thiếu trailer trên nhánh sống vẫn ra `sai`', () => {
  const root = mkdtempSync(join(tmpdir(), 'recheck-nhanh-song-thieu-trailer-'));
  const bare = join(root, 'origin.git');
  const repo = join(root, 'work');
  try {
    mkdirSync(repo, { recursive: true });
    initBare(bare);

    const git = gitIn(repo);
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.invalid']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['remote', 'add', 'origin', bare]);
    writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'goc']);
    git(['push', '-q', '-u', 'origin', 'main']);

    // Nhánh CÓ PR mở, đúng hình dạng `7fc292a` trong thân mục I-012: commit
    // của agent, thiếu trailer thật — tín hiệu G14 phải bắt được.
    git(['checkout', '-q', '-b', 'claude/integration/I-099']);
    writeFileSync(join(repo, 'b.txt'), 'viec that\n', 'utf8');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'integration: bước 0 của P3 — thiếu trailer thật']);
    git(['push', '-q', 'origin', 'claude/integration/I-099']);

    const commits = collectCommits(repo, 14, openBranches('claude/integration/I-099'));
    assert.equal(commits.length, 1);
    assert.equal(commits[0]!.hasSessionTrailer, false);
    assert.equal(
      judgeTrailerEvidence(commits).verdict,
      'sai',
      'nhánh còn PR mở không được phép trốn sau phép lọc mới',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I-012 · mọi nhánh khớp đều hết PR mở: collectCommits trả rỗng, KHÔNG ném', () => {
  const { root, repo } = initRepoCoNhanhStale();
  try {
    // Không nhánh nào còn PR mở — cả hai đã xong việc (merge hoặc đóng).
    const commits = collectCommits(repo, 14, openBranches());
    assert.deepEqual(commits, []);
    const outcome = judgeTrailerEvidence(commits);
    assert.equal(outcome.verdict, 'khớp');
    assert.equal(outcome.observedNothing, true, 'phải in ◦ chưa quan sát được, không phải ⚠ broken');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Test tái hiện lỗi của mục `I-005` (bất biến I2), rồi khoá bản sửa của mục
 * `I-007` đè lên trên.
 *
 * Trước bản sửa của `I-005`, `collectCommits` trả `[]` khi không có ref
 * `origin/claude/*` nào, và `judgeTrailerEvidence([])` in ra
 * `◦ chưa quan sát được` — giống hệt trường hợp "quét rồi không thấy gì".
 * `I-005` sửa bằng cách NÉM vô điều kiện — đúng cho ca "chưa quét được",
 * nhưng kịch bản dưới đây (remote thật, fetch chạy được, remote xác nhận
 * đúng là không có nhánh `claude/*` nào) lại là một quan sát **hợp lệ**, và
 * bản sửa của `I-005` biến nó thành `broken` giả — đúng nhóm lỗi Z, chỉ đổi
 * mặt từ "im lặng sai" sang "kêu oan". `I-007` sửa: `collectCommits` hỏi
 * thẳng remote bằng `listRemoteClaudeBranches` trước khi kết luận, và chỉ
 * ném khi remote KHÔNG xác nhận được là rỗng.
 */
test('I-007 · kho thật sự không có nhánh claude/* nào (remote xác nhận rỗng): collectCommits trả rỗng, KHÔNG ném', () => {
  const root = mkdtempSync(join(tmpdir(), 'recheck-khong-nhanh-'));
  const bare = join(root, 'origin.git');
  const repo = join(root, 'work');
  try {
    mkdirSync(repo, { recursive: true });
    initBare(bare);

    const git = gitIn(repo);
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.invalid']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['remote', 'add', 'origin', bare]);
    writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'goc']);
    git(['push', '-q', '-u', 'origin', 'main']);

    // Kho có remote thật, fetch chạy được, và `ls-remote` xác nhận đúng là
    // KHÔNG có nhánh claude/* nào — quan sát hợp lệ, không phải lỗi.
    const commits = collectCommits(repo);
    assert.deepEqual(commits, []);

    const outcome = judgeTrailerEvidence(commits);
    assert.equal(outcome.verdict, 'khớp');
    assert.equal(outcome.observedNothing, true, 'phải in ◦ chưa quan sát được, không phải ⚠ broken');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Ca thứ hai của mục `I-007`, kiểm trực tiếp `listRemoteClaudeBranches`
 * thay vì đi qua `collectCommits`: khi chính `ls-remote` lỗi (remote trỏ
 * tới đường dẫn không tồn tại), hàm phải NÉM — đây mới là "chưa quét được"
 * thật, không được nuốt thành quan sát hợp lệ (mảng rỗng).
 *
 * `collectCommits` đã có test riêng cho "fetch hỏng vì không có remote"
 * (`I-005` phía dưới); test này nhắm đúng vào hàm mới của `I-007`, không
 * lặp lại kịch bản đó.
 */
test('I-007 · listRemoteClaudeBranches ném khi ls-remote lỗi (remote không tồn tại)', () => {
  const root = mkdtempSync(join(tmpdir(), 'recheck-lsremote-hong-'));
  const repo = join(root, 'work');
  try {
    mkdirSync(repo, { recursive: true });
    const git = gitIn(repo);
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.invalid']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'goc']);
    // Remote trỏ tới một đường dẫn không tồn tại — cả fetch lẫn ls-remote đều lỗi.
    git(['remote', 'add', 'origin', join(root, 'khong-ton-tai.git')]);

    assert.throws(
      () => listRemoteClaudeBranches(repo),
      /ls-remote/,
      'remote hỏng thật sự phải ném, không được coi là quan sát hợp lệ',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Test tái hiện lỗi thứ hai của mục `I-005`, tìm ra trong vòng soát — và nó
 * tệ hơn lỗi đầu, vì nó cho ra **số sai** chứ không phải im lặng.
 *
 * Bản sửa đầu chỉ fetch `claude/*`. `refs/remotes/origin/main` của clone thì
 * đứng yên ở lúc clone, nên commit **squash** của `main` — đã bị bước 0 của
 * phụ lục P3 gộp vào nhánh PR — lọt qua phép loại `^origin/main`. Commit
 * squash của GitHub mất trailer `Claude-Session`, nên G14 ra `sai` GIẢ và
 * `main()` in sẵn thân issue `🤖 [QĐ]`: gọi chủ dự án vì một con số sai.
 *
 * Tái hiện đúng hình dạng đó: `origin/main` cục bộ **cũ**, nhánh `claude/*`
 * trên remote đã mang commit squash mới.
 */
test('I-005 · origin/main cục bộ cũ KHÔNG được làm commit squash lọt vào phạm vi quét', () => {
  const root = mkdtempSync(join(tmpdir(), 'recheck-main-cu-'));
  const bare = join(root, 'origin.git');
  const repo = join(root, 'work');
  try {
    mkdirSync(repo, { recursive: true });
    initBare(bare);

    const git = gitIn(repo);
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.invalid']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['remote', 'add', 'origin', bare]);

    writeFileSync(join(repo, 'a.txt'), 'goc\n', 'utf8');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'goc']);
    git(['push', '-q', '-u', 'origin', 'main']);
    const mainCu = git(['rev-parse', 'HEAD']).trim();

    // Commit của agent trên nhánh PR — có trailer, đúng như G14 đòi.
    git(['checkout', '-q', '-b', 'claude/topic/T-003']);
    writeFileSync(join(repo, 'b.txt'), 'nhanh\n', 'utf8');
    git(['add', '.']);
    git([
      'commit',
      '-q',
      '-m',
      'topic: T-003 — việc đang làm\n\nClaude-Session: https://claude.ai/code/session_moi',
    ]);

    // Commit squash kiểu GitHub vào `main`: KHÔNG có trailer ở khối cuối.
    git(['checkout', '-q', 'main']);
    writeFileSync(join(repo, 'c.txt'), 'squash\n', 'utf8');
    git(['add', '.']);
    git([
      'commit',
      '-q',
      '-m',
      '[verify] VF-G9 — một mục đã merge (#99)\n\nverify: bước một\n\nClaude-Session: https://claude.ai/code/session_cu\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    ]);
    git(['push', '-q', 'origin', 'main']);

    // Bước 0 của P3 gộp `main` mới vào nhánh PR rồi push — chuyện xảy ra hằng ngày.
    git(['checkout', '-q', 'claude/topic/T-003']);
    git(['merge', '-q', '--no-edit', 'main']);
    git(['push', '-q', 'origin', 'claude/topic/T-003']);

    // Clone của phiên cloud: `origin/main` đứng yên ở lúc clone, chưa có ref `claude/*` nào.
    git(['update-ref', 'refs/remotes/origin/main', mainCu]);
    for (const ref of git(['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/claude/'])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)) {
      git(['update-ref', '-d', ref]);
    }

    const commits = collectCommits(repo, 14, openBranches('claude/topic/T-003'));
    assert.ok(
      !commits.some((c) => c.subject.includes('(#99)')),
      'commit squash đã vào main không được lọt vào phạm vi quét chỉ vì origin/main cục bộ cũ',
    );
    assert.equal(
      judgeTrailerEvidence(commits).verdict,
      'khớp',
      'G14 phải ra khớp — một `sai` giả ở đây đẻ ra một issue [QĐ] giả gửi tới chủ dự án',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I-005 · fetch hỏng (không có remote origin) cũng NÉM, không quét tập rỗng', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-khong-remote-'));
  try {
    const git = gitIn(dir);
    git(['init', '-q', '-b', 'main']);
    assert.throws(() => collectCommits(dir), /git fetch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Chạy **lệnh thật** `pnpm recheck:assumptions` trong một cây không có ref
 * `origin/claude/*`, và đọc đúng thứ routine đọc: bản in.
 *
 * Đây là nửa còn lại của tiêu chí xong `I-005`. Hai test trên khoá hành vi
 * của `collectCommits`; test này khoá **đường đi của lỗi** — `main()` phải
 * xếp nó vào nhánh `broken` (`⚠ … KHÔNG CHẠY ĐƯỢC`) chứ không phải
 * `◦ chưa quan sát được`, và phải thoát khác 0. Hai dòng đó nằm cách nhau
 * một khối try/catch, nên chỉ kiểm hàm thì không chứng minh được gì.
 */
test('I-005 · lệnh thật in ⚠ KHÔNG CHẠY ĐƯỢC cho G14, không in ◦ chưa quan sát được', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-cli-'));
  try {
    const git = gitIn(dir);
    git(['init', '-q', '-b', 'main']);

    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'assumptions.md'),
      readFileSync(join(process.cwd(), 'docs', 'assumptions.md'), 'utf8'),
      'utf8',
    );

    // `process.execPath`, không phải `'node'` trên PATH: script là `.ts` chạy
    // trực tiếp nên đòi Node ≥ 22.18, và lệch phiên bản cho ra một lỗi đỏ
    // chẳng liên quan gì tới thứ đang kiểm. Cùng quy ước với các test khác.
    const run = spawnSync(process.execPath, [join(process.cwd(), 'ops', 'scripts', 'recheck-assumptions.ts')], {
      cwd: dir,
      encoding: 'utf8',
    });

    assert.match(run.stdout, /⚠ G14 · `session-trailer-on-branch` · KHÔNG CHẠY ĐƯỢC/);
    assert.doesNotMatch(run.stdout, /◦ G14/, 'không được in ra như "quét rồi không thấy gì"');
    assert.notEqual(run.status, 0, 'bài kiểm không chạy được phải thoát khác 0, không im lặng xanh');
    assert.match(run.stdout, /G17/, 'một bài kiểm hỏng không được nuốt các bài kiểm còn lại');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// ───────────────────────────────── G1 · đội worker đang chạy thật ──

/** Dòng log tối thiểu — chỉ `at` và `note` có nghĩa với bài kiểm G1. */
function logLine(at: string, note: string): RunLogLine {
  return { at, lane: 'platform', kind: 'lane', ref: 'platform/P-000', status: 'ok', durationMs: 0, costUsd: 0, note };
}

/** N lượt của một routine, cách nhau `gapHours`, bắt đầu từ `2026-09-21T00:00:00Z`. */
function runsOf(name: string, count: number, gapHours = 1): RunLogLine[] {
  const base = Date.parse('2026-09-21T00:00:00.000Z');
  return Array.from({ length: count }, (_, index) =>
    logLine(new Date(base + index * gapHours * 3600000).toISOString(), `Lượt ${name} nhận mục.`),
  );
}

test('G1 khớp khi quan sát được ba worker rời nhau — cấu hình 3 worker còn sống', () => {
  const outcome = judgeWorkerFleet(
    collectRoutineRuns([...runsOf('crux-worker-1', 3), ...runsOf('crux-worker-2', 3), ...runsOf('crux-worker-3', 3)]),
  );
  assert.equal(outcome.verdict, 'khớp');
  assert.ok(!outcome.observedNothing);
  assert.match(outcome.observed, /3 worker/);
});

test('G1 SAI khi đội tụt về hai worker — đó là kịch bản hỏng thật mà bài kiểm phải bắt', () => {
  const outcome = judgeWorkerFleet(collectRoutineRuns([...runsOf('crux-worker-1', 4), ...runsOf('crux-worker-2', 4)]));
  assert.equal(outcome.verdict, 'sai');
  assert.match(outcome.observed, /Plan B/);
});

test('G1 phân biệt "không có gì để quan sát" với "đã quan sát và thấy đúng"', () => {
  // Có dòng log, nhưng không dòng nào nhắc tên routine — ví dụ khi quy ước
  // ghi `note` đổi. Phải ra `◦`, KHÔNG được ra `khớp`: ra `khớp` thì một bài
  // kiểm không bao giờ quan sát được gì trông y hệt một bài kiểm luôn xanh.
  const outcome = judgeWorkerFleet(collectRoutineRuns([logLine('2026-09-21T00:00:00.000Z', 'Chạy tập ep-0001-stub.')]));
  assert.equal(outcome.observedNothing, true);
  assert.notEqual(outcome.verdict, 'sai');
});

test('G1 · `crux-integrator` KHÔNG được tính vào đội worker', () => {
  // Nếu tính nhầm thì hai worker cộng integrator ra 3, và bài kiểm bỏ lọt
  // đúng ca nó phải bắt.
  const outcome = judgeWorkerFleet(
    collectRoutineRuns([...runsOf('crux-worker-1', 3), ...runsOf('crux-worker-2', 3), ...runsOf('crux-integrator', 9)]),
  );
  assert.equal(outcome.verdict, 'sai');
  assert.ok(outcome.evidence.some((line) => line.includes('crux-integrator')), 'integrator vẫn phải hiện trong bằng chứng');
});

test('G1 gom nhiều dòng log của CÙNG một lượt thành một lượt', () => {
  // Một lượt worker ghi nhiều dòng (bước 0, rồi mục nhận được). Đếm từng
  // dòng thành một lượt sẽ thổi phồng số lượt và làm nhịp đo được vô nghĩa.
  const at = '2026-09-21T10:00:00.000Z';
  const later = '2026-09-21T10:20:00.000Z';
  const collected = collectRoutineRuns([
    logLine(at, 'Lượt crux-worker-2 bước 0.'),
    logLine(later, 'Lượt crux-worker-2 nhận mục.'),
  ]);
  assert.deepEqual(collected.runs.get('crux-worker-2')?.length, 1);
});

test('G1 · một dòng log tính cho ĐÚNG MỘT routine — dòng kể lại routine khác không thổi số', () => {
  // Lỗi thật, đo được ngay trên dòng log đầu tiên của chính mục VF-G1: báo
  // cáo của worker kể lại số lượt của cả bốn routine, nên bản đầu (đếm mọi
  // tên nhắc tới) tính dòng ấy thành một lượt cho TỪNG routine. Bước 0 của
  // phụ lục P3 luôn nhắc `crux-integrator`, nên lỗi này lặp lại mãi.
  const collected = collectRoutineRuns([
    logLine(
      '2026-09-21T21:00:00.000Z',
      'Lượt crux-worker-2: bước 0 gọi crux-integrator; đo được crux-worker-1 4 lượt, crux-worker-3 5 lượt.',
    ),
  ]);
  assert.deepEqual([...collected.runs.keys()], ['crux-worker-2'], 'chỉ routine viết dòng log mới được tính');
  assert.equal(collected.mentions, 1);
});

test('G1 · luật "tên đầu tiên" sai theo chiều AN TOÀN — không che được đội đã tụt về Plan B', () => {
  // Hai worker thật, nhưng mỗi dòng log đều kể thêm hai tên khác. Nếu đếm
  // mọi tên thì ra 4 worker và bài kiểm kết luận `khớp` — đúng ca hỏng mà
  // nó phải bắt. Với luật "tên đầu tiên" thì vẫn ra `sai`.
  const noisy = [
    ...runsOf('crux-worker-1', 4).map((line) => ({ ...line, note: `${line.note} So với crux-worker-3 và crux-integrator.` })),
    ...runsOf('crux-worker-2', 4).map((line) => ({ ...line, note: `${line.note} So với crux-worker-3 và crux-integrator.` })),
  ];
  assert.equal(judgeWorkerFleet(collectRoutineRuns(noisy)).verdict, 'sai');
});

test('G1 · dòng log có `at` không đọc được thì được ĐẾM và nói ra, không bỏ im lặng', () => {
  const collected = collectRoutineRuns([
    logLine('không-phải-ngày-tháng', 'Lượt crux-worker-1.'),
    ...runsOf('crux-worker-1', 1),
    ...runsOf('crux-worker-2', 1),
    ...runsOf('crux-worker-3', 1),
  ]);
  assert.equal(collected.unparsedAt, 1);
  const outcome = judgeWorkerFleet(collected);
  assert.ok(
    outcome.evidence.some((line) => line.includes('không đọc được')),
    'bỏ một phần trong im lặng là đúng nhóm lỗi Z: số lượt tụt mà không dòng nào nói vì sao',
  );
});

test('G1 · dòng log ngoài cửa sổ 7 ngày không được tính', () => {
  const collected = collectRoutineRuns([
    logLine('2026-09-01T00:00:00.000Z', 'Lượt crux-worker-1 cũ.'),
    logLine('2026-09-02T00:00:00.000Z', 'Lượt crux-worker-2 cũ.'),
    logLine('2026-09-21T00:00:00.000Z', 'Lượt crux-worker-3 mới.'),
  ]);
  assert.deepEqual([...collected.runs.keys()], ['crux-worker-3']);
});

test('G1 · cửa sổ neo vào dòng log MỚI NHẤT, không vào `now`', () => {
  // Quan sát cũ nhiều tháng vẫn phải cho đúng kết luận như lúc nó được ghi —
  // neo vào `now` thì mọi dòng rơi ra ngoài cửa sổ và bài kiểm ra "chưa quan
  // sát được" cho một bản clone hoàn toàn bình thường.
  //
  // `observedNothing` phải được khẳng định RIÊNG, không gộp vào phép so
  // `verdict`: cả hai ca đều trả `verdict: 'khớp'`, nên chỉ so `verdict` thì
  // bài kiểm này xanh cả khi cửa sổ neo sai — đúng nhóm lỗi Z mà chính mục
  // `G1` lên án, và bản đầu của test này đã dính (đo bằng phép phá thật).
  const old = ['crux-worker-1', 'crux-worker-2', 'crux-worker-3'].map((name, index) =>
    logLine(`2024-01-0${index + 1}T00:00:00.000Z`, `Lượt ${name}.`),
  );
  const outcome = judgeWorkerFleet(collectRoutineRuns(old));
  assert.ok(!outcome.observedNothing, 'phải quan sát được, không được rơi ra ngoài cửa sổ');
  assert.equal(outcome.verdict, 'khớp');
  assert.match(outcome.observed, /3 worker/);
});

test('G1 · thiếu hẳn ops/logs/ thì NÉM LỖI, không trả rỗng (mục I-005)', () => {
  // `listLogFiles` của kernel trả [] cho thư mục không tồn tại. Không chặn
  // thì "chưa quét được" in ra y hệt "quét rồi không thấy gì".
  const root = mkdtempSync(join(tmpdir(), 'crux-fleet-'));
  try {
    assert.throws(() => readFleetLogs(root), /không có thư mục/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('G1 · readFleetLogs đọc được khi ops/logs/ có thật', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-fleet-'));
  try {
    mkdirSync(join(root, 'ops', 'logs', 'platform'), { recursive: true });
    writeFileSync(
      join(root, 'ops', 'logs', 'platform', 'P-000.jsonl'),
      `${JSON.stringify(logLine('2026-09-21T00:00:00.000Z', 'Lượt crux-worker-1.'))}\n`,
    );
    assert.equal(readFleetLogs(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
