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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  parseLedger,
  runUnionExperiment,
  type CheckReport,
  type CommitTrailerInfo,
} from '../scripts/recheck-assumptions.ts';

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
function initRepoCoSquash(): string {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-collect-'));
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr || result.stdout}`);
    return result.stdout;
  };

  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'Test']);
  git(['config', 'commit.gpgsign', 'false']);

  writeFileSync(join(dir, 'a.txt'), 'goc\n', 'utf8');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'goc']);

  // Commit squash kiểu GitHub: message ghép, nên `Claude-Session` nằm GIỮA
  // message và không còn được git đọc như một trailer.
  writeFileSync(join(dir, 'a.txt'), 'goc\nmain\n', 'utf8');
  git(['add', '.']);
  git([
    'commit',
    '-q',
    '-m',
    '[topic] T-001 — bản đồ đề tài (#42)\n\ntopic: bước một\n\nClaude-Session: https://claude.ai/code/session_cu\n\ntopic: bước hai\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
  ]);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);

  // Commit agent trên nhánh PR, chưa vào `main`.
  git(['checkout', '-q', '-b', 'nhanh']);
  writeFileSync(join(dir, 'a.txt'), 'goc\nmain\nnhanh\n', 'utf8');
  git(['add', '.']);
  git([
    'commit',
    '-q',
    '-m',
    'topic: T-002 — việc đang làm\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_moi',
  ]);
  git(['update-ref', 'refs/remotes/origin/claude/topic/T-002', 'HEAD']);

  return dir;
}

test('collectCommits chỉ nhặt commit nhánh PR, KHÔNG nhặt commit squash trên main', () => {
  const dir = initRepoCoSquash();
  try {
    const commits = collectCommits(dir);
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
    rmSync(dir, { recursive: true, force: true });
  }
});

test('collectCommits trả về rỗng khi repo chưa có nhánh claude/ nào, không ném lỗi', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-collect-trong-'));
  try {
    spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    assert.deepEqual(collectCommits(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
