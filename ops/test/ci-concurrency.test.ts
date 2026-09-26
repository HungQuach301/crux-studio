/**
 * Mục `platform/P-047` · `ops/known-failures.md` **KF-031**.
 *
 * Ba tầng, cố ý tách rời:
 *
 * 1. **hàm thuần** — `concurrencyBlocks` đọc đúng YAML, `concurrencyProblems`
 *    đỏ đúng chỗ;
 * 2. **dữ liệu thật** — `ops/workflows/*.yml` trên đĩa phải sạch, không chỉ
 *    một nguồn dựng sẵn trong bài kiểm;
 * 3. **hợp đồng với bên gọi** — `check-workflows.ts` phải THẬT SỰ gọi luật
 *    này. Thiếu tầng 3 thì gỡ một dòng khỏi CLI làm 0 bài đỏ, đúng nhóm **Z**
 *    mà chính mục này sinh ra để giết.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  blockedRequiredChecks,
  concurrencyBlocks,
  concurrencyProblems,
  hasPullRequestTrigger,
  NON_VERDICT_CONCLUSIONS,
  parseCheckRuns,
  requiredChecksOnPr,
} from '../scripts/ci-concurrency.ts';
import { REQUIRED_CHECKS } from '../scripts/required-checks.ts';

const root = join(import.meta.dirname, '..', '..');
const workflow = (name: string): string => readFileSync(join(root, 'ops', 'workflows', name), 'utf8');

/** Khung tối thiểu: chạy trên `pull_request`, sinh đúng năm tên check bắt buộc. */
const requiredJobs = REQUIRED_CHECKS.map((name) => `  ${name}:\n    name: ${name}\n    runs-on: ubuntu-latest`).join(
  '\n',
);
const prHeader = ['name: ci', 'on:', '  pull_request:', '    branches: [main]'].join('\n');

const withConcurrency = (...body: string[]): string =>
  [prHeader, ...body, 'jobs:', requiredJobs].join('\n');

// ── Tầng 1 · hàm thuần ───────────────────────────────────────────────────

test('TÁI HIỆN LỖI · bản `ci.yml` TRƯỚC bản sửa phải ĐỎ', () => {
  // Nguyên văn khối của `ci.yml` trước mục `P-047`. Đây là cấu hình đã để
  // `#224` kẹt `blocked` 15 giờ với 8/8 job xanh, và làm `automerge.yml` trả
  // `HTTP 405` tám lượt liên tiếp ở `#226` (`KF-029`, `KF-031`).
  const problems = concurrencyProblems(
    withConcurrency(
      'concurrency:',
      '  group: ci-${{ github.event.pull_request.number || github.ref }}',
      '  cancel-in-progress: true',
    ),
  );
  assert.equal(problems.length, 1, 'bản cũ phải ra đúng một lời báo lỗi');
  assert.match(problems[0]!, /BỎ HẲN khối `concurrency`/u);
  // Lời báo lỗi phải NÓI RA tên các check bắt buộc đang bị vạ lây — người đọc
  // log CI không có docblock trước mặt.
  for (const name of REQUIRED_CHECKS) assert.ok(problems[0]!.includes(name), `thiếu tên check \`${name}\``);
});

test('`cancel-in-progress: false` VẪN đỏ — nó chỉ chi phối lượt đang CHẠY', () => {
  // Điểm N2 của vòng soát ngữ cảnh sạch. `concurrency` còn đường huỷ thứ hai:
  // một lượt đang XẾP HÀNG trong nhóm bị huỷ khi lượt sau tới. Bản sửa đầu
  // của mục này dừng ở `cancel-in-progress: false` và vì thế chưa đóng hết.
  assert.equal(
    concurrencyProblems(
      withConcurrency('concurrency:', '  group: ci-${{ github.event.pull_request.head.sha }}', '  cancel-in-progress: false'),
    ).length,
    1,
  );
});

test('KHÔNG có khối `concurrency` nào là lành', () => {
  assert.deepEqual(concurrencyProblems(withConcurrency()), []);
});

// Bốn dạng viết dưới đây đều BẬT huỷ thật, và bản đầu của luật này đọc SAI cả
// bốn — `pnpm lint:workflows` ra `EXIT=0` trong khi `ci.yml` vẫn huỷ lượt.
// Vòng soát ngữ cảnh sạch đo được từng dạng. Luật nay cấm cả KHỐI, nên không
// còn phải đọc đúng giá trị mới chặn được; bốn bài này khoá điều đó.
for (const [label, body] of [
  ['flow mapping một dòng', ['concurrency: {group: zz, cancel-in-progress: true}']],
  ['biểu thức `${{ true }}`', ['concurrency:', '  group: zz', '  cancel-in-progress: ${{ true }}']],
  ['`True` viết hoa', ['concurrency:', '  group: zz', '  cancel-in-progress: True']],
  ['giá trị ở DÒNG SAU', ['concurrency:', '  group: zz', '  cancel-in-progress:', '    true']],
] as const) {
  test(`LỖ ĐÃ BỊT · ${label} vẫn phải ĐỎ`, () => {
    assert.equal(concurrencyProblems(withConcurrency(...body)).length, 1);
  });
}

test('`concurrencyBlocks` đọc đúng bốn dạng đó, không chỉ chặn chúng', () => {
  // Phần phát hiện khối là phần luật dựa vào; phần đọc giá trị chỉ để lời báo
  // lỗi nói rõ hơn. Vẫn khoá nó, vì một trường khai sai là một trường mời
  // lượt sau tin nhầm.
  assert.equal(concurrencyBlocks('concurrency: {group: zz, cancel-in-progress: true}\n')[0]!.cancelInProgress, true);
  assert.equal(concurrencyBlocks('concurrency: {group: zz, cancel-in-progress: true}\n')[0]!.group, 'zz');
  assert.equal(concurrencyBlocks('concurrency:\n  cancel-in-progress: ${{ true }}\n')[0]!.cancelInProgress, true);
  assert.equal(concurrencyBlocks('concurrency:\n  cancel-in-progress: True\n')[0]!.cancelInProgress, true);
  assert.equal(concurrencyBlocks('concurrency:\n  cancel-in-progress:\n    true\n')[0]!.cancelInProgress, true);
  // Chỉ `false` chứng minh được mới ra `false` — hướng an toàn ngược với bản đầu.
  assert.equal(concurrencyBlocks('concurrency:\n  cancel-in-progress: false\n')[0]!.cancelInProgress, false);
  assert.equal(concurrencyBlocks("concurrency:\n  cancel-in-progress: 'False'\n")[0]!.cancelInProgress, false);
  assert.equal(concurrencyBlocks('concurrency:\n  group: zz\n')[0]!.cancelInProgress, false);
});

test('workflow KHÔNG sinh check bắt buộc thì có khối `concurrency` vẫn lành', () => {
  // Luật chỉ có lý do với workflow sinh ra check bắt buộc. Rộng hơn thế là
  // một luật rộng hơn lý do của nó — và `gpt-review.yml` thật sẽ đỏ oan.
  const source = [
    'name: gpt-review',
    'on:',
    '  pull_request:',
    'concurrency:',
    '  group: gpt-review',
    '  cancel-in-progress: true',
    'jobs:',
    '  gpt-review:',
    '    name: gpt-review',
    '    runs-on: ubuntu-latest',
  ].join('\n');
  assert.deepEqual(concurrencyProblems(source), []);
});

test('workflow sinh check bắt buộc nhưng KHÔNG chạy trên `pull_request` thì lành', () => {
  // Ca thật: `main-ci.yml` cũng có job tên `check`, nhưng chạy trên
  // `push`/`schedule`, nên check run của nó gắn vào SHA trên `main` chứ không
  // vào `head.sha` của PR nào. Cấm nó là một ràng buộc thừa sẽ chặn oan.
  const source = ['name: main-ci', 'on:', '  push:', '    branches: [main]', 'concurrency:', '  group: main-ci', '  cancel-in-progress: true', 'jobs:', '  check:', '    name: check', '    runs-on: ubuntu-latest'].join('\n');
  assert.deepEqual(requiredChecksOnPr(source), []);
  assert.deepEqual(concurrencyProblems(source), []);
});

test('workflow sinh MỘT trong năm check bắt buộc là đã đủ để bị soát', () => {
  const source = [prHeader, 'concurrency:', '  group: partial', '  cancel-in-progress: true', 'jobs:', '  check:', '    name: check', '    runs-on: ubuntu-latest'].join('\n');
  assert.equal(concurrencyProblems(source).length, 1);
});

test('`hasPullRequestTrigger` không nhầm chữ `pull_request` ngoài khối `on:`', () => {
  assert.equal(hasPullRequestTrigger('on:\n  pull_request:\n    branches: [main]\n'), true);
  assert.equal(hasPullRequestTrigger('on:\n  pull_request_target:\n'), true);
  assert.equal(hasPullRequestTrigger('on:\n  push:\n    branches: [main]\n'), false);
  // Chữ nằm trong chú thích, trong khối `run:`, hay thụt sâu hơn 2 dấu cách
  // đều KHÔNG phải một trigger.
  assert.equal(hasPullRequestTrigger('# pull_request:\non:\n  push:\njobs:\n  x:\n    steps:\n      - run: echo pull_request:\n'), false);
  assert.equal(hasPullRequestTrigger('on:\n  workflow_dispatch:\n    inputs:\n      pull_request:\n'), false);
});

test('`concurrencyBlocks` đọc cả khối mức JOB, không chỉ mức workflow', () => {
  // Một khối mức job huỷ đúng cái job sinh ra check bắt buộc thì hậu quả y
  // hệt. Luật chỉ soát nửa trên là luật mời người ta đi vòng qua nửa dưới.
  const source = [prHeader, 'jobs:', '  check:', '    name: check', '    runs-on: ubuntu-latest', '    concurrency:', '      group: ci-check', '      cancel-in-progress: true'].join('\n');
  const blocks = concurrencyBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.cancelInProgress, true);
  assert.equal(blocks[0]!.group, 'ci-check');
  assert.equal(concurrencyProblems(source).length, 1);
});

test('`concurrencyBlocks` đọc được nhiều khối trong một file, kèm số dòng đúng', () => {
  const source = ['concurrency:', '  group: a', '  cancel-in-progress: false', 'jobs:', '  x:', '    concurrency:', '      group: b', '      cancel-in-progress: true'].join('\n');
  assert.deepEqual(
    concurrencyBlocks(source).map((b) => [b.line, b.group, b.cancelInProgress]),
    [
      [1, 'a', false],
      [6, 'b', true],
    ],
  );
});

test('dạng rút gọn `concurrency: <chuỗi>` vẫn được ĐẾM là một khối', () => {
  // GitHub mặc định `cancel-in-progress: false` cho dạng này — nhưng đường
  // huỷ thứ hai (lượt xếp hàng) vẫn còn, nên luật vẫn phải chặn nó.
  const blocks = concurrencyBlocks('concurrency: ci-${{ github.ref }}\n');
  assert.deepEqual(blocks, [{ line: 1, group: 'ci-${{ github.ref }}', cancelInProgress: false }]);
  assert.equal(concurrencyProblems(withConcurrency('concurrency: ci-${{ github.ref }}')).length, 1);
});

test('khối `concurrency` có dòng trống và dòng chú thích xen giữa vẫn đọc hết', () => {
  const blocks = concurrencyBlocks('concurrency:\n  group: a\n\n  # chú thích\n  cancel-in-progress: true\n');
  assert.equal(blocks[0]!.cancelInProgress, true);
});

// ── Tầng 2 · dữ liệu thật trên đĩa ───────────────────────────────────────

test('trên `ops/workflows/` THẬT: không workflow nào vi phạm', () => {
  // Bài trên khoá *hàm*. Bài này khoá *dữ liệu* — thêm lại khối `concurrency`
  // vào `ci.yml` thì bài này đỏ ngay cả khi hàm vẫn đúng.
  const dir = join(root, 'ops', 'workflows');
  const offenders: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    for (const problem of concurrencyProblems(readFileSync(join(dir, file), 'utf8'))) {
      offenders.push(`${file} — ${problem.split('\n')[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'bỏ khối `concurrency` khỏi workflow đó, đừng nới luật (KF-031)');
});

test('`ci.yml` THẬT: không còn khối `concurrency`, và vẫn sinh đủ năm check bắt buộc', () => {
  // Ca âm bắt buộc ở vế sau: bản sửa của mục này không được vô tình đụng vào
  // job nào — đổi tên/gộp/xoá một trong năm job là `irreversible` nhóm 8
  // (CHARTER 2.3).
  assert.deepEqual(concurrencyBlocks(workflow('ci.yml')), []);
  assert.deepEqual(concurrencyProblems(workflow('ci.yml')), []);
  assert.deepEqual(requiredChecksOnPr(workflow('ci.yml')), [...REQUIRED_CHECKS]);
});

test('`gpt-review.yml` THẬT vẫn được `cancel-in-progress: true` — ca âm là ca thật', () => {
  assert.equal(concurrencyBlocks(workflow('gpt-review.yml'))[0]!.cancelInProgress, true);
  assert.deepEqual(concurrencyProblems(workflow('gpt-review.yml')), []);
});

// ── Tầng 3 · hợp đồng với bên gọi ────────────────────────────────────────

test('`check-workflows.ts` THẬT SỰ gọi `concurrencyProblems` — nếu không, luật là luật chết', () => {
  const source = readFileSync(join(root, 'ops', 'scripts', 'check-workflows.ts'), 'utf8');
  assert.match(source, /import \{ concurrencyProblems \} from '\.\/ci-concurrency\.ts';/u);
  assert.match(source, /concurrencyProblems\(source\)/u, 'phải gọi trên nguồn của TỪNG file trong vòng lặp CLI');
});

// ── Bộ dò PR đang kẹt ────────────────────────────────────────────────────

/**
 * Dữ liệu ĐO THẬT, không dựng: check run trên `head.sha` `871e1db` của PR
 * `#224` lúc `2026-09-24T20:4xZ` (`pull_request_read` phương thức
 * `get_check_runs`, 15 check run từ hai lượt `ci`). Lượt `35961048518`
 * (`05:41Z`) bị `concurrency` huỷ; lượt `35961061644` (`05:42Z`) xanh đủ.
 * PR đứng `mergeable_state: "blocked"` suốt 15 giờ sau đó.
 */
const PR224: readonly { name: string; conclusion: string | null }[] = [
  // lượt 35961061644 — xanh đủ bảy job
  { name: 'protected-area', conclusion: 'success' },
  { name: 'no-model-name', conclusion: 'success' },
  { name: 'secret-scan', conclusion: 'success' },
  { name: 'golden-solo', conclusion: 'success' },
  { name: 'trailer-warn', conclusion: 'success' },
  { name: 'fix-has-test', conclusion: 'success' },
  { name: 'check', conclusion: 'success' },
  // lượt 35961048518 — bị huỷ giữa chừng
  { name: 'no-model-name', conclusion: 'success' },
  { name: 'secret-scan', conclusion: 'cancelled' },
  { name: 'fix-has-test', conclusion: 'success' },
  { name: 'protected-area', conclusion: 'cancelled' },
  { name: 'trailer-warn', conclusion: 'cancelled' },
  { name: 'check', conclusion: 'cancelled' },
  { name: 'golden-solo', conclusion: 'cancelled' },
  { name: 'gpt-review', conclusion: 'success' },
];

test('bộ dò · dữ liệu THẬT của `#224`: bốn check bắt buộc bị giữ, cả bốn đều IM LẶNG', () => {
  const blocked = blockedRequiredChecks(PR224);
  assert.deepEqual(
    blocked.map((b) => b.name),
    ['check', 'secret-scan', 'protected-area', 'trailer-warn'],
  );
  // `silent` là phần đáng sợ: cùng tên đó CŨNG có một lượt `success`, nên PR
  // trông xanh đủ mọi chỗ mà vẫn kẹt — nhóm Z thuần.
  assert.ok(
    blocked.every((b) => b.silent),
    'cả bốn phải là ca im lặng',
  );
  // `fix-has-test` xanh ở CẢ HAI lượt (nó kịp xong trước khi bị huỷ), nên nó
  // không nằm trong danh sách — bộ dò đếm theo từng tên, không theo cả lượt.
  assert.ok(!blocked.some((b) => b.name === 'fix-has-test'));
  // `golden-solo` cũng `cancelled` nhưng KHÔNG phải check bắt buộc → ruleset
  // không đòi nó, nên nó không giữ PR lại.
  assert.ok(!blocked.some((b) => b.name === 'golden-solo'));
});

test('bộ dò · PR chỉ có lượt xanh (đối chứng `#229`) ra rỗng', () => {
  assert.deepEqual(blockedRequiredChecks(REQUIRED_CHECKS.map((name) => ({ name, conclusion: 'success' }))), []);
});

test('bộ dò · `failure` KHÔNG phải chữ ký này — đó là `ci-red`, ai nhìn cũng thấy', () => {
  assert.deepEqual(blockedRequiredChecks([{ name: 'check', conclusion: 'failure' }]), []);
  assert.ok(!NON_VERDICT_CONCLUSIONS.includes('failure'));
});

test('bộ dò · `skipped` KHÔNG tính — GitHub coi required check `skipped` là ĐÃ QUA', () => {
  // Điểm G4 của vòng soát ngữ cảnh sạch. `fix-has-test` và `protected-area`
  // mang `if: github.event_name == 'pull_request'` nên ra `skipped` ở mọi lượt
  // `workflow_dispatch`; để `skipped` trong danh sách là chuốc dương tính giả
  // cho một bộ dò mà cả giá trị lẫn lý do tồn tại đều nằm ở chỗ nó không kêu oan.
  assert.ok(!NON_VERDICT_CONCLUSIONS.includes('skipped'));
  assert.deepEqual(blockedRequiredChecks([{ name: 'protected-area', conclusion: 'skipped' }]), []);
});

test('bộ dò · lượt CHƯA XONG (`conclusion: null`) không phải một phán quyết', () => {
  assert.deepEqual(blockedRequiredChecks([{ name: 'check', conclusion: null }]), []);
});

test('bộ dò · chỉ có `cancelled` mà không có `success` thì `silent: false`', () => {
  assert.deepEqual(blockedRequiredChecks([{ name: 'check', conclusion: 'cancelled' }]), [
    { name: 'check', conclusions: ['cancelled'], silent: false },
  ]);
});

test('bộ dò · phủ đủ các kết luận không-phán-quyết, không chỉ `cancelled`', () => {
  for (const conclusion of NON_VERDICT_CONCLUSIONS) {
    assert.equal(blockedRequiredChecks([{ name: 'check', conclusion }]).length, 1, `\`${conclusion}\` phải được đếm`);
  }
});

test('`parseCheckRuns` nhận CẢ dạng `{"check_runs": […]}` mà API thật trả về', () => {
  // Bản đầu chỉ nhận mảng trần và vỡ bằng stack trace thô với đúng dạng mà
  // dòng hướng dẫn của chính CLI bảo đi lấy. Vòng soát ngữ cảnh sạch đo được.
  const runs = [{ name: 'check', conclusion: 'cancelled' }];
  assert.deepEqual(parseCheckRuns(JSON.stringify(runs)), runs);
  assert.deepEqual(parseCheckRuns(JSON.stringify({ total_count: 1, check_runs: runs })), runs);
  assert.throws(() => parseCheckRuns('{"nothing":1}'), /mảng check run/u);
  assert.throws(() => parseCheckRuns('không phải json'), SyntaxError);
});
