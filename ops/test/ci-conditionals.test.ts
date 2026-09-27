/**
 * Mục `platform/P-014` · rà soát **Z2** (`ops/known-failures.md`, nhóm Z).
 *
 * Ba tầng, cùng khuôn `ci-concurrency.test.ts`:
 *
 * 1. **hàm thuần** — `jobConditions` đọc đúng YAML, `requiredCheckConditionProblems`
 *    đỏ đúng chỗ và không đỏ nhầm;
 * 2. **dữ liệu thật** — `ops/workflows/*.yml` trên đĩa phải sạch, và bộ đọc
 *    phải THẤY đủ mọi `if:` có trong đó (một bộ đọc mù thì luật xanh vì
 *    không đọc được gì, đúng nhóm Z);
 * 3. **hợp đồng với bên gọi** — chạy thật `check-workflows.ts` trên một cây
 *    tạm mang đúng hình dạng `KF-008`, và nó phải thoát 1.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  hasPlainPullRequestTrigger,
  jobConditions,
  normalizeExpression,
  PR_EVENT_GATE,
  requiredCheckConditionProblems,
  STATUS_ONLY_STEP_CONDITIONS,
} from '../scripts/ci-conditionals.ts';

const root = join(import.meta.dirname, '..', '..');

const prHeader = ['name: ci', 'on:', '  pull_request:', '  workflow_dispatch:', 'jobs:'].join('\n');

/** Một job `fix-has-test` (check bắt buộc) với phần thân tuỳ ý. */
const fixHasTest = (...body: string[]): string =>
  [prHeader, '  fix-has-test:', '    name: fix-has-test', '    runs-on: ubuntu-latest', ...body, ''].join('\n');

const step = (...keys: string[]): string[] => [
  '      - name: Kiểm',
  ...keys.map((k) => `        ${k}`),
  '        run: |',
  '          set -euo pipefail',
  '          echo ok',
];

// ── Tầng 1: hàm thuần ────────────────────────────────────────────────────

test('KF-008 nguyên dạng: bước kiểm của job bắt buộc có `if:` đọc nhãn → ĐỎ', () => {
  // Đúng dòng đã làm I2 vế hai thủng trên hai lượt CI xanh của PR #7.
  const source = fixHasTest('    steps:', ...step("if: contains(github.event.pull_request.labels.*.name, 'fix')"));
  const problems = requiredCheckConditionProblems(source);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /fix-has-test/u);
  assert.match(problems[0]!, /Z2/u);
  assert.match(problems[0]!, /KF-008/u);
});

test('`if:` mức step dạng `${{ }}`, có nháy, hoặc nằm trên dòng `-` đều bị đọc và ĐỎ', () => {
  const shapes = [
    step("if: ${{ steps.labels.outputs.has_fix == 'true' }}"),
    step('if: "steps.labels.outputs.has_fix == \'true\'"'),
    ['      - if: steps.labels.outputs.has_fix', '        run: echo ok'],
  ];
  for (const shape of shapes) {
    assert.equal(requiredCheckConditionProblems(fixHasTest('    steps:', ...shape)).length, 1, shape.join('\n'));
  }
});

test('`if:` dạng khối nhiều dòng (`>-`) vẫn bị đọc — không lọt luật vì xuống dòng', () => {
  const source = fixHasTest('    if: >-', "      github.event_name == 'pull_request' &&", '      github.actor != \'x\'', '    steps:', ...step());
  const problems = requiredCheckConditionProblems(source);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /github\.event_name == 'pull_request' && github\.actor != 'x'/u);
});

test('Hàm trạng thái ở mức step KHÔNG đỏ — chúng không bỏ qua bước khi job đang xanh', () => {
  for (const condition of STATUS_ONLY_STEP_CONDITIONS) {
    for (const written of [condition, `\${{ ${condition} }}`]) {
      const source = fixHasTest('    steps:', ...step(`if: ${written}`));
      assert.deepEqual(requiredCheckConditionProblems(source), [], written);
    }
  }
});

test('Hàm trạng thái ghép với điều kiện khác thì ĐỎ — `always() && x` vẫn bỏ qua được khi x sai', () => {
  const source = fixHasTest('    steps:', ...step("if: always() && steps.labels.outputs.has_fix == 'true'"));
  assert.equal(requiredCheckConditionProblems(source).length, 1);
});

test('Cổng sự kiện PR ở mức job KHÔNG đỏ — trên một PR nó luôn đúng', () => {
  for (const written of [PR_EVENT_GATE, `\${{ ${PR_EVENT_GATE} }}`, 'github.event_name == "pull_request"']) {
    const source = fixHasTest(`    if: ${written}`, '    steps:', ...step());
    assert.deepEqual(requiredCheckConditionProblems(source), [], written);
  }
});

test('Mọi `if:` mức job khác trên job bắt buộc → ĐỎ (nhãn, actor, nhánh, đảo cổng)', () => {
  for (const condition of [
    "contains(github.event.pull_request.labels.*.name, 'fix')",
    "github.actor != 'dependabot[bot]'",
    "github.event_name != 'pull_request'",
    "github.event_name == 'pull_request' && !github.event.pull_request.draft",
  ]) {
    const source = fixHasTest(`    if: ${condition}`, '    steps:', ...step());
    const problems = requiredCheckConditionProblems(source);
    assert.equal(problems.length, 1, condition);
    assert.match(problems[0]!, /mức job/u);
  }
});

test('Cổng sự kiện PR trong workflow chỉ nghe `pull_request_target` → ĐỎ: ở đó nó bỏ qua MỌI PR', () => {
  const source = fixHasTest(`    if: ${PR_EVENT_GATE}`, '    steps:', ...step()).replace(
    '  pull_request:',
    '  pull_request_target:',
  );
  assert.equal(hasPlainPullRequestTrigger(source), false);
  assert.equal(requiredCheckConditionProblems(source).length, 1);
});

test('Job KHÔNG bắt buộc được dùng `if:` tuỳ ý — luật chỉ áp cho check bắt buộc', () => {
  const source = [
    prHeader,
    '  golden-solo:',
    '    runs-on: ubuntu-latest',
    "    if: contains(github.event.pull_request.labels.*.name, 'x')",
    '    steps:',
    ...step("if: steps.a.outputs.b == 'true'"),
    '',
  ].join('\n');
  assert.deepEqual(requiredCheckConditionProblems(source), []);
});

test('Tên check lấy từ `name:` chứ không phải khoá job — job khoá lạ mang tên bắt buộc vẫn bị áp', () => {
  const source = [
    prHeader,
    '  something-else:',
    "    name: 'protected-area'",
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...step('if: env.X'),
    '',
  ].join('\n');
  const [job] = jobConditions(source);
  assert.equal(job!.checkName, 'protected-area');
  assert.equal(requiredCheckConditionProblems(source).length, 1);
});

test('Workflow không nghe PR thì luật không áp — không có check bắt buộc nào của PR ở đó', () => {
  const source = fixHasTest('    if: failure()', '    steps:', ...step('if: env.X')).replace(
    'on:\n  pull_request:\n  workflow_dispatch:',
    'on:\n  push:',
  );
  assert.deepEqual(requiredCheckConditionProblems(source), []);
});

test('Chữ `if:` bên trong khối `run: |` không bị đọc nhầm thành điều kiện của bước', () => {
  const source = fixHasTest(
    '    steps:',
    '      - name: Kiểm',
    '        run: |',
    '          set -euo pipefail',
    '          if: not-yaml-just-text',
    '            if: deeper',
  );
  assert.deepEqual(jobConditions(source)[0]!.stepIfs, []);
});

test('normalizeExpression: bỏ `${{ }}`, gộp khoảng trắng, đồng nhất nháy', () => {
  assert.equal(normalizeExpression('${{  github.event_name ==   "pull_request" }}'), PR_EVENT_GATE);
});

// ── Tầng 2: dữ liệu thật ────────────────────────────────────────────────

const workflowFiles = readdirSync(join(root, 'ops', 'workflows')).filter((f) => f.endsWith('.yml'));
const readWorkflow = (f: string): string => readFileSync(join(root, 'ops', 'workflows', f), 'utf8');

test('Mọi `ops/workflows/*.yml` trên đĩa qua luật Z2', () => {
  for (const file of workflowFiles) {
    assert.deepEqual(requiredCheckConditionProblems(readWorkflow(file)), [], file);
  }
});

test('Bộ đọc THẤY đủ mọi `if:` trong `ops/workflows/` — đếm độc lập bằng grep theo độ thụt', () => {
  // Đếm độc lập: `if:` thụt đúng 4 là mức job; `if:` là khoá của một bước
  // (thụt 8, hoặc ngay sau `- ` thụt 6) là mức step. Bộ đọc đếm thiếu thì
  // luật xanh vì mù — đúng chỗ nhóm Z không bao giờ tự báo.
  let jobIfs = 0;
  let stepIfs = 0;
  let seenJobs = 0;
  let seenSteps = 0;
  for (const file of workflowFiles) {
    const source = readWorkflow(file);
    for (const line of source.split('\n')) {
      if (/^ {4}if:/.test(line)) jobIfs += 1;
      if (/^ {8}if:/.test(line) || /^ {6}- if:/.test(line)) stepIfs += 1;
    }
    for (const job of jobConditions(source)) {
      if (job.jobIf !== null) seenJobs += 1;
      seenSteps += job.stepIfs.length;
    }
  }
  assert.ok(jobIfs > 0 && stepIfs > 0, 'cây phải có cả hai loại `if:` thì phép đếm mới có nghĩa');
  assert.equal(seenJobs, jobIfs);
  assert.equal(seenSteps, stepIfs);
});

test('`ci.yml`: mọi job bắt buộc có `if:` mức job đều dùng ĐÚNG cổng sự kiện PR', () => {
  const gated = jobConditions(readWorkflow('ci.yml')).filter((j) => j.jobIf !== null);
  assert.ok(gated.length > 0);
  for (const job of gated) assert.equal(job.jobIf!.expression, PR_EVENT_GATE, job.id);
});

test('Phép phá: đưa lại `if:` của KF-008 vào `ci.yml` thật thì luật ĐỎ đúng job', () => {
  const source = readWorkflow('ci.yml');
  const anchor = '      - name: PR fix phải có test\n';
  assert.ok(source.includes(anchor), 'mốc phá thử phải còn trong `ci.yml`');
  const broken = source.replace(anchor, `${anchor}        if: steps.labels.outputs.has_fix == 'true'\n`);
  const problems = requiredCheckConditionProblems(broken);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /`fix-has-test`/u);
});

// ── Tầng 3: hợp đồng với bên gọi ────────────────────────────────────────

test('`pnpm lint:workflows` THẬT SỰ gọi luật Z2 — chạy CLI trên một cây tạm mang KF-008', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'crux-z2-'));
  try {
    mkdirSync(join(scratch, 'ops', 'workflows'), { recursive: true });
    const source = [
      'name: ci',
      'on:',
      '  pull_request:',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  fix-has-test:',
      '    name: fix-has-test',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: PR fix phải có test',
      "        if: contains(github.event.pull_request.labels.*.name, 'fix')",
      '        run: |',
      '          set -euo pipefail',
      '          echo ok',
      '',
    ].join('\n');
    writeFileSync(join(scratch, 'ops', 'workflows', 'ci.yml'), source);
    const result = spawnSync(process.execPath, [join(root, 'ops', 'scripts', 'check-workflows.ts')], {
      cwd: scratch,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Z2/u);
    assert.match(result.stderr, /fix-has-test/u);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
