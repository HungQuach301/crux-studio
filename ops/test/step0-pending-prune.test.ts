/**
 * Mục `integration/I-022` — dọn nhánh `step0-pending` mà dòng log đã có trên
 * `main`, bằng workflow thay cho `git push --delete` bị HTTP 403 ở phiên agent.
 *
 * Mỗi ca cho qua đi kèm ca âm của nó (bài học `KF-003`). Ba nhóm theo đúng tiêu
 * chí xong: ca dương (đã trên `main` → xoá), ca âm (chưa trên `main` → KHÔNG
 * xoá, và nói ra), ca không đo được (thoát khác 0, không in danh sách nào).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { step0LogId } from '../../kernel/src/log.ts';
import { step0PendingBranch } from '../scripts/step0-pr-gate.ts';
import {
  confirmPruneContent,
  planStep0PendingPrune,
  renderStep0PrunePlan,
} from '../scripts/step0-pending-prune.ts';

const ON_MAIN = step0LogId('2026-09-27T08:38:49Z', 'crux-worker-1');
const NOT_ON_MAIN = step0LogId('2026-09-27T11:39:25Z', 'crux-worker-1');
const OTHER_ON_MAIN = step0LogId('2026-09-25T04:21:06Z', 'crux-worker-2');

// ── Hàm thuần ──────────────────────────────────────────────────────────────

test('ca dương: mã log đã trên nhánh chính → nhánh vào `prune`', () => {
  const plan = planStep0PendingPrune({
    branches: [step0PendingBranch(ON_MAIN)],
    mergedLogIds: [ON_MAIN, OTHER_ON_MAIN],
  });
  assert.deepEqual(plan.prune, [step0PendingBranch(ON_MAIN)]);
  assert.deepEqual(plan.keep, []);
  assert.deepEqual(plan.problems, []);
});

test('ca âm: mã log CHƯA trên nhánh chính → KHÔNG xoá, và nói ra trong `keep`', () => {
  const plan = planStep0PendingPrune({
    branches: [step0PendingBranch(ON_MAIN), step0PendingBranch(NOT_ON_MAIN)],
    mergedLogIds: [ON_MAIN],
  });
  assert.deepEqual(plan.prune, [step0PendingBranch(ON_MAIN)]);
  assert.equal(plan.keep.length, 1);
  assert.equal(plan.keep[0]!.logId, NOT_ON_MAIN);
  assert.match(plan.keep[0]!.why, /CHƯA/);
  assert.match(renderStep0PrunePlan(plan, 'x'), /⏸ .*11:39|⏸ .*113925Z/);
});

test('không xoá theo tuổi: nhánh RẤT cũ mà dòng log chưa tới main vẫn ở lại', () => {
  const ancient = step0LogId('2026-01-01T00:00:00Z', 'crux-worker-3');
  const plan = planStep0PendingPrune({
    branches: [step0PendingBranch(ancient)],
    mergedLogIds: [ON_MAIN],
  });
  assert.deepEqual(plan.prune, []);
  assert.equal(plan.keep.length, 1);
});

test('nhánh tên lạ → `problems`, không bao giờ vào `prune`', () => {
  const plan = planStep0PendingPrune({
    branches: [
      'claude/integration/I-022',
      'claude/integration/step0-pending/khong-phai-ma-log',
      // Tiền tố gần đúng — không được xoá nhánh của người khác chỉ vì mã log khớp.
      `claude/integration/step0-pendingx/${ON_MAIN}`,
    ],
    mergedLogIds: [ON_MAIN],
  });
  assert.deepEqual(plan.prune, []);
  assert.equal(plan.problems.length, 3);
});

test('mã log trên main RỖNG là phép đo hỏng → không xoá gì, có problem', () => {
  const plan = planStep0PendingPrune({ branches: [step0PendingBranch(ON_MAIN)], mergedLogIds: [] });
  assert.deepEqual(plan.prune, []);
  assert.equal(plan.problems.length, 1);
  assert.match(plan.problems[0]!, /KHÔNG xoá/);
});

test('nhánh trùng tên chỉ xoá một lần, và danh sách sắp theo tên', () => {
  const plan = planStep0PendingPrune({
    branches: [step0PendingBranch(ON_MAIN), step0PendingBranch(OTHER_ON_MAIN), step0PendingBranch(ON_MAIN)],
    mergedLogIds: [ON_MAIN, OTHER_ON_MAIN],
  });
  assert.deepEqual(plan.prune, [step0PendingBranch(OTHER_ON_MAIN), step0PendingBranch(ON_MAIN)]);
});

test('lớp kiểm nội dung: nhánh bị `check` bác → sang `problems`, KHÔNG xoá', () => {
  const plan = planStep0PendingPrune({
    branches: [step0PendingBranch(ON_MAIN), step0PendingBranch(OTHER_ON_MAIN)],
    mergedLogIds: [ON_MAIN, OTHER_ON_MAIN],
  });
  const seen: string[] = [];
  const confirmed = confirmPruneContent(plan, (branch, logId) => {
    seen.push(logId);
    return logId === ON_MAIN ? 'nội dung lệch' : null;
  });
  assert.deepEqual(seen.sort(), [ON_MAIN, OTHER_ON_MAIN].sort(), 'mọi nhánh trong prune đều phải qua check');
  assert.deepEqual(confirmed.prune, [step0PendingBranch(OTHER_ON_MAIN)]);
  assert.equal(confirmed.problems.length, 1);
  assert.match(confirmed.problems[0]!, /KHÔNG xoá: nội dung lệch/);
});

// ── CLI trên kho git thật ──────────────────────────────────────────────────

const SCRIPT = join(process.cwd(), 'ops/scripts/step0-pending-prune.ts');

/**
 * Kho tạm có `origin` trỏ về chính nó: `main` mang dòng log `ON_MAIN`, và hai
 * nhánh chờ — một cho `ON_MAIN` (xoá được), một cho `NOT_ON_MAIN` (phải ở lại).
 */
function withRepo(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'crux-step0-prune-'));
  try {
    const git = (...args: string[]): string => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    const logDir = join(dir, 'ops/logs/integration');
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, `${ON_MAIN}.jsonl`), '{}\n');
    git('add', '.');
    git('commit', '-q', '-m', 'nền');
    git('branch', step0PendingBranch(ON_MAIN));
    git('checkout', '-q', '-b', step0PendingBranch(NOT_ON_MAIN));
    writeFileSync(join(logDir, `${NOT_ON_MAIN}.jsonl`), '{}\n');
    git('add', '.');
    git('commit', '-q', '-m', 'dòng log lượt log-only');
    git('checkout', '-q', 'main');
    git('remote', 'add', 'origin', dir);
    git('fetch', '-q', 'origin');
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('CLI --from-remote: stdout là ĐÚNG nhánh xoá được, nhánh chưa gộp ở lại', () => {
  withRepo((dir) => {
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${step0PendingBranch(ON_MAIN)}\n`);
    assert.match(result.stderr, /1 xoá được · 1 ở lại · 0 không hiểu được/);
    assert.match(result.stderr, /origin\/main/);
  });
});

test('CLI --json: prune/keep/problems/source', () => {
  withRepo((dir) => {
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.deepEqual(plan.prune, [step0PendingBranch(ON_MAIN)]);
    assert.deepEqual(plan.keep.map((row: { logId: string }) => row.logId), [NOT_ON_MAIN]);
    assert.match(plan.source, /origin\/main/);
  });
});

/** Đẩy thêm một commit lên nhánh chờ `ON_MAIN` của kho tạm rồi fetch lại. */
function mutateOnMainBranch(dir: string, change: (logDir: string) => void): void {
  const git = (...args: string[]): string => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  git('checkout', '-q', step0PendingBranch(ON_MAIN));
  change(join(dir, 'ops/logs/integration'));
  git('add', '.');
  git('commit', '-q', '-m', 'thêm sau khi dòng log đã tới main');
  git('checkout', '-q', 'main');
  git('fetch', '-q', 'origin');
}

test('CLI: nhánh có dòng NỐI THÊM sau khi file đã tới main → KHÔNG xoá (dữ liệu không bản sao)', () => {
  withRepo((dir) => {
    mutateOnMainBranch(dir, (logDir) => writeFileSync(join(logDir, `${ON_MAIN}.jsonl`), '{}\n{"x":1}\n'));
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /KHÔNG xoá: nội dung/);
  });
});

test('CLI: nhánh mang thêm một file ngoài dòng log → KHÔNG xoá', () => {
  withRepo((dir) => {
    mutateOnMainBranch(dir, (logDir) => writeFileSync(join(logDir, 'khac.txt'), 'x\n'));
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /mang thêm file ngoài dòng log: ops\/logs\/integration\/khac\.txt/);
  });
});

test('CLI: nhánh chưa fetch về ref theo dõi → KHÔNG xoá mù', () => {
  withRepo((dir) => {
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote', '--branch-ref-prefix', 'refs/khong-co/'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /chưa fetch nhánh/);
  });
});

test('KHÔNG ĐO ĐƯỢC: ref nhánh chính không tồn tại → thoát 2, stdout RỖNG', () => {
  withRepo((dir) => {
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote', '--main-ref', 'origin/khong-co'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '', 'không đo được thì không được in nhánh nào để xoá');
    assert.match(result.stderr, /KHÔNG ĐO ĐƯỢC/);
  });
});

test('KHÔNG ĐO ĐƯỢC: `git ls-remote` hỏng → thoát 2, stdout RỖNG', () => {
  withRepo((dir) => {
    execFileSync('git', ['-C', dir, 'remote', 'set-url', 'origin', join(dir, 'khong-co-kho-nay')]);
    const result = spawnSync(process.execPath, [SCRIPT, '--from-remote'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  });
});

test('CLI gọi sai (thiếu nguồn nhánh, hay cả hai nguồn) → thoát 2', () => {
  for (const args of [[], ['--from-remote', '--branches', 'x'], ['--from-remote', '--main-ref']]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, `args ${JSON.stringify(args)}`);
    assert.equal(result.stdout, '');
  }
});

// ── Workflow gọi đúng luật ─────────────────────────────────────────────────

test('workflow: đo trên origin/main, xoá đúng danh sách của script, không ép ghi đè', () => {
  const run = workflowRun();
  assert.match(run, /node ops\/scripts\/step0-pending-prune\.ts --from-remote --main-ref origin\/main > "\$LIST"/);
  assert.match(run, /xargs -n 50 git push origin --delete < "\$LIST"/);
  assert.doesNotMatch(run, /--force|\s-f\s/);
  assert.match(run, /set -euo pipefail/);
  // Chỉ GITHUB_TOKEN — không secret nào khác (D-C01).
  assert.doesNotMatch(run, /secrets\./);
  // Lớp kiểm nội dung cần nhánh chờ đã fetch về đúng ref theo dõi mặc định.
  assert.match(run, /refs\/heads\/claude\/integration\/step0-pending\/\*:refs\/remotes\/origin\/claude\/integration\/step0-pending\/\*/);
});

/** Khối `run` của workflow, bỏ dòng chú thích. */
function workflowRun(): string {
  return readFileSync(join(process.cwd(), 'ops/workflows/step0-pending-prune.yml'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

test('workflow: đo hỏng thì DỪNG ĐỎ trước lệnh xoá — không nuốt mã thoát', () => {
  const run = workflowRun();
  const measure = run.indexOf('MEASURE=$?');
  const bail = run.search(/if \[ "\$MEASURE" -ne 0 \]; then\n[^\n]*\n\s*exit "\$MEASURE"/);
  const del = run.indexOf('git push origin --delete');
  assert.ok(measure > 0 && bail > measure && del > bail, 'thứ tự phải là: đo → thoát khi đo hỏng → xoá');
  assert.doesNotMatch(run, /step0-pending-prune\.ts[^\n]*\|\|/);
});

test('workflow: dry_run đọc từ input và THOÁT trước lệnh xoá', () => {
  const run = workflowRun();
  assert.match(run, /dry_run:/);
  assert.match(run, /DRY_RUN: \$\{\{ inputs\.dry_run \|\| 'false' \}\}/);
  const dry = run.search(/if \[ "\$DRY_RUN" = "true" \]; then(\n(?!\s*fi\b)[^\n]*)*\n\s*exit 0\n\s*fi/);
  const del = run.indexOf('git push origin --delete');
  assert.ok(dry > 0 && del > dry, 'khối dry_run phải có `exit 0` và đứng TRƯỚC lệnh xoá');
});

test('workflow: problems và báo cáo đi vào step summary, và problems làm bước đỏ', () => {
  const run = workflowRun();
  assert.match(run, /cat "\$REPORT"\n[^]*>> "\$GITHUB_STEP_SUMMARY"/);
  assert.match(run, /if \[ "\$PROBLEMS" -gt 0 \]; then\n[^\n]*\n\s*exit 1/);
});

test('CLI --branches nhận cả dạng thô `<sha>\\trefs/heads/<nhánh>` của `git ls-remote`', () => {
  withRepo((dir) => {
    const list = join(dir, 'branches.txt');
    writeFileSync(list, `${'a'.repeat(40)}\trefs/heads/${step0PendingBranch(ON_MAIN)}\n\n`);
    const result = spawnSync(process.execPath, [SCRIPT, '--branches', list], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${step0PendingBranch(ON_MAIN)}\n`);
  });
});
