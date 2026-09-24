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
  NON_VERDICT_CONCLUSIONS,
} from '../scripts/ci-concurrency.ts';
import { REQUIRED_CHECKS } from '../scripts/required-checks.ts';

const root = join(import.meta.dirname, '..', '..');
const workflow = (name: string): string => readFileSync(join(root, 'ops', 'workflows', name), 'utf8');

/** Khung tối thiểu sinh ra đúng năm tên check bắt buộc. */
const requiredJobs = REQUIRED_CHECKS.map((name) => `  ${name}:\n    name: ${name}\n    runs-on: ubuntu-latest`).join(
  '\n',
);

const withConcurrency = (group: string, cancel: string): string =>
  ['name: ci', 'on:', '  pull_request:', 'concurrency:', `  group: ${group}`, `  cancel-in-progress: ${cancel}`, 'jobs:', requiredJobs].join(
    '\n',
  );

// ── Tầng 1 · hàm thuần ───────────────────────────────────────────────────

test('TÁI HIỆN LỖI · bản `ci.yml` TRƯỚC bản sửa phải ĐỎ', () => {
  // Nguyên văn khối của `ci.yml` trước mục `P-047`. Đây là cấu hình đã để
  // `#224` kẹt `blocked` 15 giờ với 8/8 job xanh, và làm `automerge.yml` trả
  // `HTTP 405` tám lượt liên tiếp ở `#226` (`KF-029`, `KF-031`).
  const problems = concurrencyProblems(
    withConcurrency('ci-${{ github.event.pull_request.number || github.ref }}', 'true'),
  );
  assert.equal(problems.length, 1, 'bản cũ phải ra đúng một lời báo lỗi');
  assert.match(problems[0]!, /cancel-in-progress: true/u);
  // Lời báo lỗi phải NÓI RA tên các check bắt buộc đang bị vạ lây — người đọc
  // log CI không có docblock trước mặt.
  for (const name of REQUIRED_CHECKS) assert.ok(problems[0]!.includes(name), `thiếu tên check \`${name}\``);
});

test('cái BẪY: nhóm mang `head.sha` mà vẫn `cancel-in-progress: true` thì VẪN đỏ', () => {
  // Đây là bản sửa nửa vời dễ nghĩ ra nhất, và nó không chữa gì: nhóm mang
  // `sha` thì hai lượt trên CÙNG một commit vẫn chung nhóm, nên vẫn huỷ đúng
  // lượt ấy. Docblock của `ci-concurrency.ts` viết ra điều này; bài này khoá
  // nó, để nó không chỉ là một lời khai.
  const problems = concurrencyProblems(
    withConcurrency('ci-${{ github.event.pull_request.head.sha || github.sha }}', 'true'),
  );
  assert.equal(problems.length, 1);
});

test('`cancel-in-progress: false` là lành, nhóm khoá theo gì cũng được', () => {
  assert.deepEqual(concurrencyProblems(withConcurrency('ci-${{ github.event.pull_request.number }}', 'false')), []);
  assert.deepEqual(
    concurrencyProblems(withConcurrency('ci-${{ github.event.pull_request.head.sha || github.sha }}', 'false')),
    [],
  );
});

test('workflow KHÔNG sinh check bắt buộc thì `cancel-in-progress: true` vẫn lành', () => {
  // Luật chỉ có lý do với workflow sinh ra check bắt buộc. Rộng hơn thế là
  // một luật rộng hơn lý do của nó — và `gpt-review.yml` thật sẽ đỏ oan.
  const source = ['name: gpt-review', 'on:', '  pull_request:', 'concurrency:', '  group: gpt-review', '  cancel-in-progress: true', 'jobs:', '  gpt-review:', '    name: gpt-review', '    runs-on: ubuntu-latest'].join('\n');
  assert.deepEqual(concurrencyProblems(source), []);
});

test('workflow sinh MỘT trong năm check bắt buộc là đã đủ để bị soát', () => {
  const source = ['name: partial', 'on:', '  pull_request:', 'concurrency:', '  group: partial', '  cancel-in-progress: true', 'jobs:', '  check:', '    name: check', '    runs-on: ubuntu-latest'].join('\n');
  assert.equal(concurrencyProblems(source).length, 1);
});

test('`concurrencyBlocks` đọc cả khối mức JOB, không chỉ mức workflow', () => {
  // Một khối mức job huỷ đúng cái job sinh ra check bắt buộc thì hậu quả y
  // hệt. Luật chỉ soát nửa trên là luật mời người ta đi vòng qua nửa dưới.
  const source = ['name: ci', 'on:', '  pull_request:', 'jobs:', '  check:', '    name: check', '    runs-on: ubuntu-latest', '    concurrency:', '      group: ci-check', '      cancel-in-progress: true'].join('\n');
  const blocks = concurrencyBlocks(source);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.cancelInProgress, true);
  assert.equal(blocks[0]!.group, 'ci-check');
  assert.equal(concurrencyProblems(source).length, 1);
});

test('`concurrencyBlocks` đọc được nhiều khối trong một file, kèm số dòng đúng', () => {
  const source = ['concurrency:', '  group: a', '  cancel-in-progress: false', 'jobs:', '  x:', '    concurrency:', '      group: b', '      cancel-in-progress: true'].join('\n');
  const blocks = concurrencyBlocks(source);
  assert.deepEqual(
    blocks.map((b) => [b.line, b.group, b.cancelInProgress]),
    [
      [1, 'a', false],
      [6, 'b', true],
    ],
  );
});

test('dạng rút gọn `concurrency: <chuỗi>` không bao giờ là `cancel-in-progress: true`', () => {
  // GitHub mặc định `false` cho dạng này, nên nó không vi phạm được luật.
  const blocks = concurrencyBlocks('concurrency: ci-${{ github.ref }}\n');
  assert.deepEqual(blocks, [{ line: 1, group: 'ci-${{ github.ref }}', cancelInProgress: false }]);
});

test('`cancel-in-progress` có nháy hoặc có chú thích phía sau vẫn đọc đúng', () => {
  assert.equal(concurrencyBlocks("concurrency:\n  group: a\n  cancel-in-progress: 'true'\n")[0]!.cancelInProgress, true);
  assert.equal(concurrencyBlocks('concurrency:\n  group: a\n  cancel-in-progress: true  # vì sao\n')[0]!.cancelInProgress, true);
  assert.equal(concurrencyBlocks('concurrency:\n  group: a\n  cancel-in-progress: false\n')[0]!.cancelInProgress, false);
});

test('khối `concurrency` có dòng trống và dòng chú thích xen giữa vẫn đọc hết', () => {
  const blocks = concurrencyBlocks('concurrency:\n  group: a\n\n  # chú thích\n  cancel-in-progress: true\n');
  assert.equal(blocks[0]!.cancelInProgress, true);
});

// ── Tầng 2 · dữ liệu thật trên đĩa ───────────────────────────────────────

test('trên `ops/workflows/` THẬT: không workflow nào sinh check bắt buộc mà `cancel-in-progress: true`', () => {
  // Bài trên khoá *hàm*. Bài này khoá *dữ liệu* — đổi `ci.yml` về bản cũ thì
  // bài này đỏ ngay cả khi hàm vẫn đúng.
  const dir = join(root, 'ops', 'workflows');
  const offenders: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    for (const problem of concurrencyProblems(readFileSync(join(dir, file), 'utf8'))) {
      offenders.push(`${file} — ${problem.split('\n')[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'sửa `cancel-in-progress` về `false`, đừng nới luật (KF-031)');
});

test('`ci.yml` THẬT vẫn sinh đủ năm tên check bắt buộc sau khi đổi `concurrency`', () => {
  // Ca âm bắt buộc: bản sửa của mục này không được vô tình đụng vào job nào —
  // đổi tên/gộp/xoá một trong năm job là `irreversible` nhóm 8 (CHARTER 2.3).
  assert.deepEqual(concurrencyProblems(workflow('ci.yml')), []);
  const blocks = concurrencyBlocks(workflow('ci.yml'));
  assert.equal(blocks.length, 1, '`ci.yml` phải có đúng một khối concurrency');
  assert.equal(blocks[0]!.cancelInProgress, false);
  assert.match(blocks[0]!.group!, /head\.sha/u, 'giữ `head.sha` trong nhóm — hai commit khác nhau chạy song song');
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
  const clean = REQUIRED_CHECKS.map((name) => ({ name, conclusion: 'success' }));
  assert.deepEqual(blockedRequiredChecks(clean), []);
});

test('bộ dò · `failure` KHÔNG phải chữ ký này — đó là `ci-red`, ai nhìn cũng thấy', () => {
  assert.deepEqual(blockedRequiredChecks([{ name: 'check', conclusion: 'failure' }]), []);
  assert.ok(!NON_VERDICT_CONCLUSIONS.includes('failure'));
});

test('bộ dò · lượt CHƯA XONG (`conclusion: null`) không phải một phán quyết', () => {
  assert.deepEqual(blockedRequiredChecks([{ name: 'check', conclusion: null }]), []);
});

test('bộ dò · chỉ có `cancelled` mà không có `success` thì `silent: false`', () => {
  const blocked = blockedRequiredChecks([{ name: 'check', conclusion: 'cancelled' }]);
  assert.deepEqual(blocked, [{ name: 'check', conclusions: ['cancelled'], silent: false }]);
});

test('bộ dò · phủ đủ bốn kết luận không-phán-quyết, không chỉ `cancelled`', () => {
  for (const conclusion of NON_VERDICT_CONCLUSIONS) {
    assert.equal(
      blockedRequiredChecks([{ name: 'check', conclusion }]).length,
      1,
      `\`${conclusion}\` phải được đếm`,
    );
  }
});
