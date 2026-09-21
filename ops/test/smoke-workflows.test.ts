/**
 * Mục `P-010` — cơ chế chạy thử workflow vừa đổi.
 *
 * Vì sao bộ test này quan trọng hơn vẻ ngoài: thứ nó canh là một cơ chế
 * **chạy trên `main`, sau khi merge**. Không có gì chạy nó trên PR (đó
 * chính là vấn đề mục này đi gỡ), nên nếu phần quyết định của nó không
 * được kiểm ở đây thì nó không được kiểm ở đâu cả.
 *
 * Ba nhóm, theo đúng thứ tự quan trọng:
 *   1. Hàng rào `automerge` — "không đụng tới ở chế độ thật trong bất kỳ
 *      hoàn cảnh nào" là tiêu chí xong viết bằng chữ tuyệt đối, nên nó được
 *      canh bằng nhiều bài, kể cả bài phá thử.
 *   2. Đọc khối `on:` — nền của mọi quyết định phía trên.
 *   3. Đối chiếu với CÂY THẬT — luật đúng trên chuỗi dựng sẵn mà sai trên
 *      file thật thì vô dụng.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  alertIssueBody,
  changedWorkflowFiles,
  dispatchInputs,
  externalSideEffects,
  hasDryRunInput,
  hasWorkflowDispatch,
  isRed,
  NEVER_REAL_DISPATCH,
  planSmokeRuns,
  realDispatchBan,
  SELF_FILE,
} from '../scripts/smoke-workflows.ts';

const WORKFLOW_DIR = join(process.cwd(), 'ops', 'workflows');
const read = (file: string) => readFileSync(join(WORKFLOW_DIR, file), 'utf8');

// ── 1 · Hàng rào automerge ───────────────────────────────────────────────

test('P-010 · automerge.yml không bao giờ được gọi ở chế độ thật', () => {
  const plan = planSmokeRuns([{ file: 'automerge.yml', source: read('automerge.yml') }]);
  const call = plan.dispatch.find((d) => d.file === 'automerge.yml');
  assert.ok(call, 'automerge.yml phải nằm trong kế hoạch gọi');
  assert.equal(call.dryRun, true, 'và phải ở chế độ chạy thử');
  assert.equal(plan.refused.length, 0);
});

test('P-010 · automerge.yml MẤT inputs.dry_run thì bị TỪ CHỐI gọi, không rơi về chế độ thật', () => {
  // Đây là bài phá thử: bỏ đúng khối `inputs:` khỏi `workflow_dispatch`.
  // Kết quả phải là `refused`, KHÔNG phải một lời gọi thật — rơi về chế độ
  // thật là đúng cái tiêu chí xong cấm tuyệt đối.
  const crippled = `name: automerge
on:
  schedule:
    - cron: '23 * * * *'
  workflow_dispatch:

jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - run: gh api -X PUT "repos/$REPO/pulls/$NUM/merge" -f merge_method=squash
`;
  const plan = planSmokeRuns([{ file: 'automerge.yml', source: crippled }]);
  assert.equal(plan.dispatch.length, 0, 'không được gọi lần nào');
  assert.equal(plan.refused.length, 1);
  assert.match(plan.refused[0]!.why, /NEVER_REAL_DISPATCH/);
});

test('P-010 · lớp thứ hai: workflow lạ có lệnh merge cũng bị từ chối, dù tên không nằm trong danh sách', () => {
  // `NEVER_REAL_DISPATCH` bắt theo TÊN, nên nó không phủ được một workflow
  // merge viết trong tương lai. `MERGE_PATTERNS` bắt theo NỘI DUNG và phủ
  // chỗ đó. Bỏ lớp nào cũng để hở một đường.
  const future = `name: merge-queue
on:
  workflow_dispatch:

jobs:
  go:
    runs-on: ubuntu-latest
    steps:
      - run: gh pr merge "$NUM" --squash
`;
  assert.ok(!NEVER_REAL_DISPATCH.includes('merge-queue.yml'), 'tiền đề của bài này');
  const plan = planSmokeRuns([{ file: 'merge-queue.yml', source: future }]);
  assert.equal(plan.dispatch.length, 0);
  assert.equal(plan.refused.length, 1);
  assert.match(plan.refused[0]!.why, /không hoàn tác được/);
});

test('P-010 · workflow merge CÓ dry_run thì gọi được, nhưng chỉ ở chế độ thử', () => {
  const guarded = `name: merge-queue
on:
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: false

jobs:
  go:
    runs-on: ubuntu-latest
    steps:
      - run: gh pr merge "$NUM" --squash
`;
  const plan = planSmokeRuns([{ file: 'merge-queue.yml', source: guarded }]);
  assert.deepEqual(plan.dispatch, [{ file: 'merge-queue.yml', dryRun: true }]);
  assert.equal(plan.refused.length, 0);
});

test('P-010 · realDispatchBan nói KHÔNG cho automerge và CÓ cho một workflow vô hại', () => {
  assert.notEqual(realDispatchBan('automerge.yml', 'name: x\n'), null, 'chặn theo tên, kể cả nội dung rỗng');
  assert.equal(realDispatchBan('labels.yml', read('labels.yml')), null);
});

// ── 2 · Đọc khối `on:` ───────────────────────────────────────────────────

test('P-010 · hasWorkflowDispatch nhận cả ba dạng khai `on:`', () => {
  assert.equal(hasWorkflowDispatch('on: workflow_dispatch\n'), true);
  assert.equal(hasWorkflowDispatch('on: [push, workflow_dispatch]\n'), true);
  assert.equal(hasWorkflowDispatch('on:\n  workflow_dispatch:\n'), true);
  assert.equal(hasWorkflowDispatch('on:\n  push:\n    branches: [main]\n'), false);
  assert.equal(hasWorkflowDispatch('jobs:\n  a:\n    runs-on: x\n'), false);
});

test('P-010 · dispatchInputs đọc đúng tên input, không lẫn khoá con của chúng', () => {
  const source = `name: watchdog
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      test_alert:
        description: 'x'
        type: boolean
        default: false
      dry_run:
        description: 'y'
        type: boolean
        default: false

permissions:
  contents: read
`;
  assert.deepEqual(dispatchInputs(source), ['test_alert', 'dry_run']);
  assert.equal(hasDryRunInput(source), true);
});

test('P-010 · dispatchInputs không nhầm `inputs:` của một sự kiện khác', () => {
  // `workflow_call` cũng có khối `inputs:`. Đọc nhầm nó thì một workflow
  // không chạy thử được sẽ bị coi là chạy thử được, và `smoke-workflows`
  // sẽ gọi nó kèm `-f dry_run=true` — lời gọi đó hỏng, và hỏng ở chỗ khó
  // đọc (trên `main`, sau merge).
  const source = `name: x
on:
  workflow_call:
    inputs:
      dry_run:
        type: boolean
  push:
    branches: [main]
`;
  assert.equal(hasWorkflowDispatch(source), false);
  assert.deepEqual(dispatchInputs(source), []);
});

test('P-010 · không có workflow_dispatch thì vào notDispatchable, không bị bỏ im lặng', () => {
  const source = 'name: x\non:\n  issues:\n    types: [opened]\n\njobs:\n  a:\n    runs-on: x\n';
  const plan = planSmokeRuns([{ file: 'x.yml', source }]);
  assert.equal(plan.dispatch.length, 0);
  assert.equal(plan.notDispatchable.length, 1);
  assert.match(plan.notDispatchable[0]!.why, /workflow_dispatch/);
});

test('P-010 · smoke-workflows.yml tự loại mình — nếu không nó kẹt ở concurrency của chính nó', () => {
  const plan = planSmokeRuns([{ file: SELF_FILE, source: read(SELF_FILE) }]);
  assert.equal(plan.dispatch.length, 0, 'không bao giờ tự gọi mình');
  assert.equal(plan.notDispatchable.length, 1);
  assert.match(plan.notDispatchable[0]!.why, /concurrency/);
});

test('P-010 · externalSideEffects phân biệt được workflow chỉ đọc', () => {
  assert.deepEqual(externalSideEffects('- run: gh pr list --json number\n'), []);
  assert.deepEqual(externalSideEffects('- run: pnpm check\n'), []);
  assert.ok(externalSideEffects('- run: gh issue create --title x\n').length > 0);
  assert.ok(externalSideEffects('- run: gh api -X POST /repos/x/y/issues\n').length > 0);
  assert.ok(externalSideEffects('- run: git push origin main\n').length > 0);
});

test('P-010 · changedWorkflowFiles chỉ lấy YAML ngay dưới ops/workflows/', () => {
  assert.deepEqual(
    changedWorkflowFiles([
      'ops/workflows/labels.yml',
      'ops/workflows/README.md',
      'ops/workflows/nested/deep.yml',
      '.github/workflows/ci.yml',
      'kernel/index.ts',
      '  ops/workflows/ci.yaml  ',
      '',
      'ops/workflows/labels.yml',
    ]),
    ['ci.yaml', 'labels.yml'],
  );
});

// ── 3 · Thân issue cảnh báo ──────────────────────────────────────────────

test('P-010 · MỘT issue cho cả lần push, có @nhắc, và có dòng lỗi đầu tiên', () => {
  const body = alertIssueBody({
    sha: 'abc1234',
    runUrl: 'https://example.invalid/run/1',
    owner: 'HungQuach301',
    results: [
      { file: 'labels.yml', dryRun: true, conclusion: 'failure', runUrl: 'https://example.invalid/run/2', firstError: 'Repository not found' },
      { file: 'watchdog.yml', dryRun: true, conclusion: 'success', runUrl: 'https://example.invalid/run/3', firstError: '' },
    ],
    notDispatchable: [{ file: 'notify.yml', why: 'không khai `workflow_dispatch`' }],
    refused: [{ file: 'automerge.yml', why: 'không có chế độ an toàn' }],
  });

  assert.match(body, /^@HungQuach301 /, '@nhắc phải ở NGAY dòng đầu thân issue (KF-004)');
  assert.match(body, /Đỏ: 1 workflow/);
  assert.match(body, /labels\.yml/);
  assert.match(body, /Repository not found/);
  assert.ok(!/- `watchdog\.yml` — `success`/.test(body), 'workflow xanh không nằm trong danh sách đỏ');
  assert.match(body, /automerge\.yml/, 'phần bị từ chối vẫn phải liệt kê');
  assert.match(body, /notify\.yml/, 'phần không tự thử được vẫn phải liệt kê');
});

test('P-010 · isRed coi mọi kết luận không phải success/skipped là đỏ', () => {
  assert.equal(isRed('success'), false);
  assert.equal(isRed('skipped'), false);
  assert.equal(isRed('failure'), true);
  assert.equal(isRed('cancelled'), true);
  assert.equal(isRed('timed_out'), true);
  assert.equal(isRed('không-thấy-lần-chạy'), true);
});

// ── 4 · Đối chiếu với cây thật ───────────────────────────────────────────

test('P-010 · bốn workflow có tác dụng phụ trong cây thật đều khai inputs.dry_run', () => {
  // Tiêu chí xong của `P-010` gọi tên đúng bốn file này. Bài này canh cho
  // chúng, chứ không canh cho luật chung — luật chung là bài dưới.
  for (const file of ['labels.yml', 'notify.yml', 'watchdog.yml', 'automerge.yml']) {
    const source = read(file);
    assert.equal(hasWorkflowDispatch(source), true, `${file} phải gọi tay được`);
    assert.equal(hasDryRunInput(source), true, `${file} phải có inputs.dry_run`);
  }
});

test('P-010 · mỗi dry_run trong cây thật thật sự chặn thao tác ghi, không chỉ là một input bỏ trống', () => {
  // Một `inputs.dry_run` mà thân job không bao giờ đọc là tệ hơn không có:
  // `smoke-workflows` sẽ tin là nó an toàn rồi gọi, và tác dụng phụ vẫn xảy
  // ra thật. Bài này đòi mỗi file vừa NHẬN cờ vào biến môi trường, vừa RẼ
  // nhánh theo nó.
  for (const file of ['labels.yml', 'notify.yml', 'watchdog.yml', 'automerge.yml', 'main-ci.yml']) {
    const source = read(file);
    assert.match(source, /DRY_RUN:\s*\$\{\{\s*inputs\.dry_run/, `${file} phải đưa cờ vào env`);
    assert.match(source, /\[\s*"\$DRY_RUN"\s*=\s*"true"\s*\]/, `${file} phải rẽ nhánh theo cờ`);
  }
});

test('P-010 · mọi workflow trong cây thật đều dựng được kế hoạch, không file nào rơi ra ngoài', () => {
  const files = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length >= 6, 'tiền đề: cây thật có đủ workflow để bài này có nghĩa');

  const plan = planSmokeRuns(files.map((file) => ({ file, source: read(file) })));
  const seen = [
    ...plan.dispatch.map((d) => d.file),
    ...plan.notDispatchable.map((s) => s.file),
    ...plan.refused.map((s) => s.file),
  ].sort();
  assert.deepEqual(seen, [...files].sort(), 'mỗi file phải rơi vào ĐÚNG một nhóm');

  // Và không file nào trong cây thật bị từ chối: bị từ chối nghĩa là nó sẽ
  // không bao giờ được chạy thử, và đó là điều phải biết ngay chứ không
  // phải phát hiện sau một lần `main` hỏng.
  assert.deepEqual(plan.refused, []);
});
