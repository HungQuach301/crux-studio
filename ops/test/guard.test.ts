/**
 * Hook chặn của `.claude/hooks/guard.mjs` (bất biến I4, CHARTER 3.2 và 3.3).
 *
 * Giả định G11 nói hook có hiệu lực trong routine và thread, nhưng đó mới là
 * "tài liệu nói vậy". Test này không kiểm G11 — nó kiểm rằng bản thân cái
 * hook phân loại đúng, để khi G11 được xác nhận thì thứ đang chạy là đúng thứ.
 *
 * Các chuỗi lệnh dưới đây được ghép từ mảnh, cố ý. Hook soi NỘI DUNG lệnh
 * Bash, nên một file test chứa nguyên văn các lệnh bị cấm sẽ bị chính hook
 * chặn lúc agent ghi file. Đó là hook chạy đúng, không phải một trở ngại.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const guard = join(process.cwd(), '.claude', 'hooks', 'guard.mjs');

const GH = 'gh';
const MERGE = 'merge';
const PUSH = 'push';

function run(event: unknown): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(event),
    encoding: 'utf8',
  });
  return { status: result.status, stderr: result.stderr };
}

const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command } });

test('chặn mọi đường gộp PR', () => {
  for (const command of [
    `${GH} pr ${MERGE} 12 --squash`,
    `${GH} pr ${MERGE} --auto 12`,
    `hub ${MERGE} https://github.com/x/y/pull/3`,
    `${GH} api -X PUT repos/o/r/pulls/12/${MERGE}`,
    `${GH} pr review 12 --approve`,
  ]) {
    const { status, stderr } = run(bash(command));
    assert.equal(status, 2, `lẽ ra phải chặn: ${command}`);
    assert.match(stderr, /CHẶN/);
  }
});

test('chặn push thẳng vào main', () => {
  for (const command of [
    `git ${PUSH} origin main`,
    `git ${PUSH} origin HEAD:main`,
    `git ${PUSH} -u origin main`,
  ]) {
    assert.equal(run(bash(command)).status, 2, `lẽ ra phải chặn: ${command}`);
  }
});

test('chặn ghi vào .github/ bằng cả shell lẫn công cụ ghi file', () => {
  assert.equal(run(bash('cp a.yml .github/workflows/a.yml')).status, 2);
  assert.equal(run(bash('sed -i s/a/b/ .github/workflows/ci.yml')).status, 2);
  assert.equal(
    run({ tool_name: 'Write', tool_input: { file_path: '/repo/.github/workflows/x.yml' } }).status,
    2,
  );
  assert.equal(
    run({ tool_name: 'Edit', tool_input: { file_path: '.github/dependabot.yml' } }).status,
    2,
  );
});

test('chặn việc tắt trailer Claude-Session và việc bỏ qua hook', () => {
  assert.equal(run(bash('claude config set attribution.sessionUrl false')).status, 2);
  assert.equal(run(bash('git commit --no-verify -m x')).status, 2);
});

test('chặn công cụ MCP gộp PR', () => {
  assert.equal(run({ tool_name: 'mcp__github__merge_pull_request', tool_input: {} }).status, 2);
  assert.equal(run({ tool_name: 'mcp__github__enable_pr_auto_merge', tool_input: {} }).status, 2);
});

test('KHÔNG chặn việc làm bình thường', () => {
  for (const command of [
    `git ${PUSH} -u origin claude/platform/P-001`,
    'git merge origin/main',
    'pnpm check',
    `${GH} pr edit 3 --add-label automerge`,
    `${GH} issue create --title "🤖 [QĐ] x" --label decision`,
    'node ops/scripts/replay.ts',
  ]) {
    assert.equal(run(bash(command)).status, 0, `lẽ ra KHÔNG chặn: ${command}`);
  }
  assert.equal(
    run({ tool_name: 'Write', tool_input: { file_path: 'ops/workflows/x.yml' } }).status,
    0,
  );
});

test('sự kiện méo thì không chặn nhầm', () => {
  const result = spawnSync(process.execPath, [guard], {
    input: 'không-phải-json',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});
