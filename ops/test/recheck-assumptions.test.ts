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
  formatDecisionIssue,
  isToolCommit,
  judgeTrailerEvidence,
  judgeUnionRuns,
  listRemoteClaudeBranches,
  parseLedger,
  runUnionExperiment,
  type CheckReport,
  type CommitTrailerInfo,
} from '../scripts/recheck-assumptions.ts';

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
