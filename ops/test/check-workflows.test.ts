/**
 * Luật quyền của `pnpm lint:workflows` (KF-003).
 *
 * Test âm là phần quan trọng nhất ở đây: một luật chỉ có giá trị khi nó
 * **đỏ** đúng lúc phải đỏ. Hai trong số đó tái hiện đúng hai workflow đã sai
 * thật, bằng đúng nội dung đã làm chúng sai.
 *
 * Phần dương cũng không thừa: một luật đỏ nhầm sẽ ép workflow khai THỪA
 * quyền, và đó là cái bẫy đã sập một lần ở `ci.yml` (KF-003).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  joinContinuations,
  missingPermissions,
  brokenEventChains,
  subscribedEvents,
  missingDryRun,
  runBlocks,
  blocksMissingPipefail,
  secretsUsedWithoutEmptyCheck,
  undocumentedSwallows,
  EXTERNAL_CONSUMERS,
} from '../scripts/check-workflows.ts';

// ── Test âm ──────────────────────────────────────────────────────────────

test('KF-003 · checkout mà thiếu contents: read thì đỏ', () => {
  const broken = `name: labels
on:
  workflow_dispatch:

permissions:
  issues: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /contents: read/);
  assert.match(missing[0]!, /Repository not found/);
});

test('KF-003 · `gh label create` mà không có quyền ghi nào thì đỏ', () => {
  const broken = `name: x
on: [workflow_dispatch]

permissions:
  contents: read

jobs:
  j:
    steps:
      - run: gh label create owner-merge --color B60205
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /issues: write.*hoặc.*pull-requests: write/);
});

test('nhãn của repo nằm dưới CẢ HAI scope — mỗi quyền một mình đều đủ', () => {
  // Đã kiểm bằng chạy thật: ci run #1 tạo được nhãn `automerge` và
  // `cross-lane` chỉ với `pull-requests: write`, không có quyền `issues`.
  // Ép chọn một scope sẽ buộc ci.yml khai thừa quyền.
  const viaPulls = `name: x
on: [workflow_dispatch]
permissions:
  contents: read
  pull-requests: write
jobs:
  j:
    steps:
      - run: gh label create a
`;
  const viaIssues = `name: x
on: [workflow_dispatch]
permissions:
  contents: read
  issues: write
jobs:
  j:
    steps:
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(viaPulls), []);
  assert.deepEqual(missingPermissions(viaIssues), []);
});

test('KF-003 · `gh pr list` mà thiếu pull-requests: read thì đỏ', () => {
  const broken = `name: watchdog
on:
  schedule:
    - cron: '0 */6 * * *'

permissions:
  contents: read
  issues: write
  actions: read

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - run: gh pr list --state merged --limit 1
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /pull-requests: read/);
});

test('bắt được nhiều quyền thiếu cùng lúc, không dừng ở cái đầu tiên', () => {
  const broken = `name: x
on: [workflow_dispatch]
permissions:
  actions: read
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: |
          gh issue create --title x
          gh pr edit 1 --add-label y
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 3, JSON.stringify(missing));
  assert.ok(missing.some((m) => m.includes('contents: read')));
  assert.ok(missing.some((m) => m.includes('issues: write')));
  assert.ok(missing.some((m) => m.includes('pull-requests: write')));
  // `gh issue create` chỉ nhận issues: write — phần "thiếu …" không có lựa
  // chọn thay thế. (Không dùng `!m.includes('hoặc')` để kiểm điều này: chữ
  // "hoặc" còn xuất hiện trong phần lý do của luật khác.)
  assert.ok(missing.some((m) => m.startsWith('thiếu `issues: write` (')));
});

test('`none` tường minh cũng là thiếu, không phải là đã khai', () => {
  const broken = `name: x
on: [workflow_dispatch]
permissions:
  contents: none
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
`;
  assert.match(missingPermissions(broken)[0]!, /contents: read/);
});

// ── Test dương: không được đỏ nhầm ───────────────────────────────────────

test('write bao hàm read — khai contents: write là đủ cho checkout', () => {
  const ok = `name: x
on: [workflow_dispatch]
permissions:
  contents: write
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
`;
  assert.deepEqual(missingPermissions(ok), []);
});

test('không khai permissions thì luật này im lặng — đó là lựa chọn khác, không phải lỗi', () => {
  const noBlock = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(noBlock), []);
});

test('ci.yml thật không khai `issues` — pull-requests: write đã đủ để tạo nhãn', () => {
  const ci = readFileSync(join(process.cwd(), 'ops', 'workflows', 'ci.yml'), 'utf8');
  const block = /^permissions:\n((?:[ \t#].*\n|\n)*)/m.exec(ci)?.[1] ?? '';
  const declared = block
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'))
    .map((l) => l.trim());
  assert.ok(
    !declared.some((l) => l.startsWith('issues:')),
    `ci.yml khai thừa quyền: ${declared.join(' · ')}`,
  );
  assert.deepEqual(missingPermissions(ci), []);
});

test('write-all phủ mọi luật', () => {
  const all = `name: x
on: [workflow_dispatch]
permissions: write-all
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(all), []);
});

test('comment trong khối permissions không làm hỏng việc đọc khối', () => {
  const commented = `name: x
on: [workflow_dispatch]
permissions:
  # contents: read LÀ BẮT BUỘC vì job này dùng actions/checkout
  contents: read

  # issues: write cho gh label create
  issues: write
jobs:
  j:
    steps:
      - uses: actions/checkout@v7
      - run: gh label create a
`;
  assert.deepEqual(missingPermissions(commented), []);
});

test('`gh pr list` không bị nhầm thành cần pull-requests: write', () => {
  const readOnly = `name: x
on: [workflow_dispatch]
permissions:
  pull-requests: read
jobs:
  j:
    steps:
      - run: gh pr list --state merged
`;
  assert.deepEqual(missingPermissions(readOnly), []);
});

// ── KF-017 · Checks API là scope riêng ───────────────────────────────────

test('KF-017 · `gh api .../check-runs` mà thiếu `checks: read` thì đỏ', () => {
  // Đúng hình dạng đã làm hỏng `automerge.yml` từ 14:45Z ngày 2026-09-22:
  // ba quyền khai ra trông rất đủ, và không quyền nào trong ba bao được
  // scope `checks`. GitHub trả 403, `set -euo pipefail` giết cả bước, hàng
  // đợi merge đứng im ~5,9 giờ mà không gì đỏ ngoài chính lượt automerge.
  const broken = `name: automerge
on: [workflow_dispatch]

permissions:
  contents: write
  pull-requests: write
  actions: write

jobs:
  merge:
    steps:
      - run: |
          FIX_HAS_TEST=$(gh api "repos/$REPO/commits/$HEAD/check-runs?per_page=100" \\
            --jq '[.check_runs[] | select(.name == "fix-has-test")][0].conclusion // null')
`;
  const missing = missingPermissions(broken);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0]!, /checks: read/);
  assert.match(missing[0]!, /403/);
});

test('KF-017 · khai `checks: read` thì hết đỏ, và `checks: write` cũng đủ', () => {
  const body = `jobs:
  merge:
    steps:
      - run: gh api "repos/$REPO/commits/$HEAD/check-runs?per_page=100"
`;
  const withRead = `name: x\non: [workflow_dispatch]\n\npermissions:\n  checks: read\n\n${body}`;
  const withWrite = `name: x\non: [workflow_dispatch]\n\npermissions:\n  checks: write\n\n${body}`;
  assert.deepEqual(missingPermissions(withRead), []);
  assert.deepEqual(missingPermissions(withWrite), []);
});

test('KF-017 · `check-suites` cùng scope, và `gh pr checks` KHÔNG bị luật này bắt', () => {
  const suites = `name: x
on: [workflow_dispatch]

permissions:
  contents: read

jobs:
  j:
    steps:
      - run: gh api "repos/$REPO/commits/$SHA/check-suites"
`;
  assert.match(missingPermissions(suites).join(' · '), /checks: read/);

  // `gh pr checks` đi qua scope `pull-requests` — luật cũ đã phủ, không
  // được kéo nó sang `checks` và bắt workflow khai thừa quyền.
  const prChecks = `name: x
on: [workflow_dispatch]

permissions:
  pull-requests: read

jobs:
  j:
    steps:
      - run: gh pr checks 12 --repo "$REPO"
`;
  assert.deepEqual(missingPermissions(prChecks), []);
});

test('KF-017 · lệnh trải nhiều dòng bằng `\\` vẫn bị bắt — vòng soát P-029', () => {
  // Vòng soát đo 14 ca và tìm ra đúng lỗ này: mọi luật khớp trong phạm vi
  // MỘT dòng, còn bash cho trải lệnh ra nhiều dòng. `automerge.yml` đang
  // dùng đúng dấu `\` đó và chỉ tình cờ để URL ở dòng đầu — một lần rewrap
  // cho dễ đọc là luật tắt tiếng và KF-017 quay lại mà không gì đỏ.
  const head = `name: x
on: [workflow_dispatch]

permissions:
  contents: read

jobs:
  j:
    steps:
      - run: |
`;

  const urlOnNextLine = `${head}          FIX=$(gh api \\
            "repos/$REPO/commits/$HEAD/check-runs?per_page=100")
`;
  assert.match(missingPermissions(urlOnNextLine).join(' · '), /checks: read/);

  // Lối viết `gh` thông dụng: cờ `-H` chen vào giữa, URL xuống tận dòng thứ ba.
  const headerThenUrl = `${head}          gh api \\
            -H "Accept: application/vnd.github+json" \\
            "repos/$REPO/commits/$HEAD/check-runs"
`;
  assert.match(missingPermissions(headerThenUrl).join(' · '), /checks: read/);
});

test('joinContinuations nối đúng một dòng logic, và không đụng dòng thường', () => {
  assert.equal(joinContinuations('a \\\n   b\n'), 'a b\n');
  assert.equal(joinContinuations('a\nb\n'), 'a\nb\n');
  // Nối rồi thì `permissions:` vẫn phải đọc được từ nguồn GỐC — đó là lý do
  // `declaredPermissions` KHÔNG dùng bản đã nối (nó đọc theo thụt lề).
  const src = `permissions:
  checks: read

jobs:
  j:
    steps:
      - run: gh api \\
          "repos/$R/commits/$S/check-runs"
`;
  assert.deepEqual(missingPermissions(src), []);
});

test('KF-017 · `automerge.yml` trên cây khai được `checks`', () => {
  // Bài hồi quy neo thẳng vào file thật: luật trên có thể đúng mà file vẫn
  // thiếu quyền, và đó chính là ca đã xảy ra.
  const source = readFileSync(join(process.cwd(), 'ops', 'workflows', 'automerge.yml'), 'utf8');
  assert.match(source, /\/check-runs/, 'automerge.yml không còn gọi Checks API — xem lại bài này');
  assert.deepEqual(missingPermissions(source), []);
});

// ── Cây hiện tại phải sạch ───────────────────────────────────────────────

test('cả sáu workflow trong ops/workflows/ khai đủ quyền chúng cần', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  assert.ok(files.length >= 6, `mới có ${files.length} workflow`);
  for (const file of files) {
    const missing = missingPermissions(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual(missing, [], `${file}: ${missing.join(' · ')}`);
  }
});

test('không workflow nào còn dùng action chạy Node 20', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const stale of ['actions/checkout@v4', 'actions/setup-node@v4', 'pnpm/action-setup@v4']) {
      assert.ok(!source.includes(stale), `${file} còn dùng ${stale} (Node 20, đã bị khai tử)`);
    }
  }
});

// ── KF-004 · chuỗi sự kiện đứt vì GITHUB_TOKEN ───────────────────────────

const PRODUCER = 'gh' + ' issue create --title x --label alert';

function consumers(pairs: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(pairs));
}

test('KF-004 · mở issue bằng GITHUB_TOKEN khi có workflow nghe `issues` thì đỏ', () => {
  const producer = `name: watchdog
on:
  schedule:
    - cron: '0 */6 * * *'
permissions:
  issues: write
jobs:
  watch:
    steps:
      - run: ${PRODUCER}
`;
  const found = brokenEventChains(producer, consumers({ issues: ['notify.yml'] }));
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0]?.event, 'issues');
  assert.deepEqual(found[0]?.consumers, ['notify.yml']);
});

test('KF-004 · khai báo có lý do thì hết đỏ', () => {
  const declared = `name: watchdog
on:
  schedule:
    - cron: '0 */6 * * *'

# KF-004 issues: @nhắc nằm ngay trong thân issue, không chờ notify.yml.
permissions:
  issues: write
jobs:
  watch:
    steps:
      - run: ${PRODUCER}
`;
  assert.deepEqual(brokenEventChains(declared, consumers({ issues: ['notify.yml'] })), []);
});

test('KF-004 · khai báo RỖNG không tính — phải có lý do viết ra', () => {
  const empty = `name: watchdog
on: [schedule]
# KF-004 issues:
jobs:
  watch:
    steps:
      - run: ${PRODUCER}
`;
  assert.equal(brokenEventChains(empty, consumers({ issues: ['notify.yml'] })).length, 1);
});

test('KF-004 · không ai nghe sự kiện đó thì không đỏ', () => {
  const noConsumer = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: ${PRODUCER}
`;
  assert.deepEqual(brokenEventChains(noConsumer, consumers({ push: ['main-ci.yml'] })), []);
});

test('KF-004 · workflow tự kích hoạt lại chính mình cũng là chuỗi đứt', () => {
  const selfLoop = `name: ci
on:
  pull_request:
    types: [opened, labeled]
jobs:
  j:
    steps:
      - run: gh pr edit 1 --add-label owner-merge
`;
  const found = brokenEventChains(selfLoop, consumers({ pull_request: ['ci.yml'] }));
  assert.equal(found.length, 1);
  assert.deepEqual(found[0]?.consumers, ['ci.yml']);
});

test('KF-004 · merge bằng gh api sinh sự kiện push', () => {
  const merger = `name: automerge
on: [workflow_run]
jobs:
  j:
    steps:
      - run: gh api -X PUT "repos/$REPO/pulls/$PR/merge" -f merge_method=squash
`;
  const found = brokenEventChains(merger, consumers({ push: ['main-ci.yml', 'labels.yml'] }));
  assert.equal(found[0]?.event, 'push');
  assert.deepEqual(found[0]?.consumers, ['main-ci.yml', 'labels.yml']);
});

test('đọc đúng khối `on:` ở cả ba cách viết', () => {
  assert.deepEqual(subscribedEvents('on: push\njobs:\n'), ['push']);
  assert.deepEqual(subscribedEvents('on: [push, pull_request]\njobs:\n'), ['push', 'pull_request']);
  assert.deepEqual(
    subscribedEvents('on:\n  pull_request:\n    branches: [main]\n  workflow_dispatch:\njobs:\n'),
    ['pull_request', 'workflow_dispatch'],
  );
});

// ── Cây hiện tại: mọi chuỗi phải được khai báo ───────────────────────────

test('watchdog và main-ci đặt @nhắc NGAY TRONG thân issue, không chờ notify', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of ['watchdog.yml', 'main-ci.yml']) {
    const source = readFileSync(join(dir, file), 'utf8');
    assert.match(source, /OWNER: HungQuach301/, `${file} không khai OWNER`);
    assert.match(source, /"@\$OWNER /, `${file} không đặt @nhắc trong thân issue`);
    assert.match(source, /#\s*KF-004\s+issues\s*:\s*\S/, `${file} thiếu khai báo KF-004`);
  }
});

test('không workflow nào còn chuỗi sự kiện đứt chưa khai báo', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  const map = new Map<string, string[]>();
  for (const [event, consumers] of EXTERNAL_CONSUMERS) map.set(event, [...consumers]);
  for (const file of files) {
    for (const event of subscribedEvents(readFileSync(join(dir, file), 'utf8'))) {
      map.set(event, [...(map.get(event) ?? []), file]);
    }
  }
  for (const file of files) {
    const found = brokenEventChains(readFileSync(join(dir, file), 'utf8'), map);
    assert.deepEqual(found, [], `${file}: ${found.map((f) => f.event).join(', ')}`);
  }
});

// ── Bên nghe nằm ngoài ops/workflows/ (D-C06) ────────────────────────────

test('KF-004 · sync-workflows.yml được khai là bên nghe `push`, dù nó nằm trong .github/', () => {
  // Linter chỉ đọc `ops/workflows/`, nên nếu không khai tường minh thì
  // `sync-workflows.yml` vô hình với nó. Trước D-C06 chỗ đó an toàn nhờ
  // phạm vi vùng bảo vệ; sau D-C06 máy tự đưa `ops/workflows/**` vào `main`
  // được, nên nó phải nằm trong bản đồ như mọi bên nghe khác.
  assert.deepEqual(EXTERNAL_CONSUMERS.get('push'), ['.github/workflows/sync-workflows.yml']);
});

test('KF-004 · workflow sinh sự kiện `push` mà không khai báo thì đỏ, dù ops/workflows/ không ai nghe push', () => {
  const broken = [
    'name: x',
    'on: [workflow_dispatch]',
    '',
    'permissions:',
    '  contents: write',
    '',
    'jobs:',
    '  j:',
    '    steps:',
    '      - run: gh api -X PUT "repos/$REPO/pulls/$NUM/merge" -f merge_method=squash',
    '',
  ].join('\n');
  const found = brokenEventChains(broken, EXTERNAL_CONSUMERS);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0]!.event, 'push');
  assert.deepEqual(found[0]!.consumers, ['.github/workflows/sync-workflows.yml']);
});

// ── Luật MỀM: thiếu inputs.dry_run (mục P-010) ───────────────────────────

test('P-010 · workflow có tác dụng phụ mà thiếu dry_run thì CẢNH BÁO', () => {
  const source = [
    'name: x',
    'on:',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  issues: write',
    '',
    'jobs:',
    '  j:',
    '    steps:',
    '      - run: gh issue create --title x --body y',
    '',
  ].join('\n');
  const warning = missingDryRun('x.yml', source);
  assert.notEqual(warning, null);
  assert.match(warning!, /inputs\.dry_run/);
});

test('P-010 · có dry_run thì im', () => {
  const source = [
    'name: x',
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      dry_run:',
    '        type: boolean',
    '        default: false',
    '',
    'jobs:',
    '  j:',
    '    steps:',
    '      - run: gh issue create --title x --body y',
    '',
  ].join('\n');
  assert.equal(missingDryRun('x.yml', source), null);
});

test('P-010 · workflow chỉ ĐỌC thì không bị cảnh báo — luật đỏ nhầm ép khai cờ vô nghĩa', () => {
  const source = 'name: x\non:\n  workflow_dispatch:\n\njobs:\n  j:\n    steps:\n      - run: gh pr list --json number\n';
  assert.equal(missingDryRun('x.yml', source), null);
});

test('P-010 · thiếu cả workflow_dispatch thì cảnh báo nói đúng chỗ đó', () => {
  const source = 'name: x\non:\n  issues:\n    types: [opened]\n\njobs:\n  j:\n    steps:\n      - run: gh issue comment 1 --body y\n';
  const warning = missingDryRun('x.yml', source);
  assert.notEqual(warning, null);
  assert.match(warning!, /KHÔNG có `workflow_dispatch`/);
});

test('P-010 · miễn trừ phải KÈM LÝ DO — một khai báo rỗng không đủ', () => {
  // Cùng khuôn với `# KF-004 <sự kiện>: …`: bắt gõ ra lý do là chủ ý. Một
  // khai báo cụt sẽ khớp ký tự đầu của DÒNG SAU nếu regex dùng `\s`, nên
  // bài này canh đúng chỗ đó.
  const body = [
    'jobs:',
    '  j:',
    '    steps:',
    '      - run: gh issue create --title x --body y',
    '',
  ].join('\n');
  const head = 'name: x\non:\n  workflow_dispatch:\n\n';

  assert.notEqual(missingDryRun('x.yml', `${head}# P-010 dry-run:\n${body}`), null, 'khai rỗng KHÔNG được chấp nhận');
  assert.equal(
    missingDryRun('x.yml', `${head}# P-010 dry-run: job ghi khoá sau if: github.event_name == 'pull_request'\n${body}`),
    null,
    'khai kèm lý do thì im',
  );
});

test('P-010 · cây thật không còn cảnh báo nào — cảnh báo thường trực là cảnh báo bị bỏ qua', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  const left: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const warning = missingDryRun(file, readFileSync(join(dir, file), 'utf8'));
    if (warning !== null) left.push(`${file} — ${warning}`);
  }
  assert.deepEqual(left, []);
});

// ── Z10 · thiếu `set -euo pipefail` ──────────────────────────────────────

test('Z10 · khối run: | thiếu set -euo pipefail thì đỏ', () => {
  const bad = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          echo hi
          exit 1
`;
  const bad2 = `name: y
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          echo hi
`;
  assert.deepEqual(blocksMissingPipefail(runBlocks(bad, 'bad.yml')), [6]);
  assert.deepEqual(blocksMissingPipefail(runBlocks(bad2, 'bad2.yml')), [6]);
});

test('Z10 · khối run: | có set -euo pipefail ở dòng đầu thì sạch', () => {
  const ok = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          echo hi
`;
  assert.deepEqual(blocksMissingPipefail(runBlocks(ok, 'ok.yml')), []);
});

test('Z10 · dòng trống ở đầu khối trước set -euo pipefail không tính là thiếu — không lệnh nào chạy trước nó', () => {
  const ok = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |

          set -euo pipefail
          echo hi
`;
  assert.deepEqual(blocksMissingPipefail(runBlocks(ok, 'ok.yml')), []);
});

test('Z10 · một lệnh thật chạy TRƯỚC set -euo pipefail thì đỏ — đúng lỗ hổng luật này chặn', () => {
  const bad = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          echo "chạy trước khi có lưới an toàn"
          set -euo pipefail
`;
  assert.deepEqual(blocksMissingPipefail(runBlocks(bad, 'bad.yml')), [6]);
});

test('Z10 · run: một dòng (không phải khối |) không thuộc phạm vi luật này', () => {
  const single = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: pnpm check
`;
  assert.deepEqual(blocksMissingPipefail(runBlocks(single, 'single.yml')), []);
});

test('Z10 · cả sáu workflow thật trong ops/workflows/ đều mở khối run: | bằng set -euo pipefail', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    const bad = blocksMissingPipefail(runBlocks(source, file));
    assert.deepEqual(bad, [], `${file}: dòng ${bad.join(', ')}`);
  }
});

// ── Z5 · secret dùng mà không khẳng định không rỗng ──────────────────────

test('Z5 · dùng secrets.X mà không có phép kiểm rỗng trước đó thì đỏ', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: echo "${'$'}{{ secrets.PUBLISH_REPO_TOKEN }}"
`;
  assert.deepEqual(secretsUsedWithoutEmptyCheck(source), ['PUBLISH_REPO_TOKEN']);
});

test('Z5 · có dòng khẳng định X không rỗng TRƯỚC lần dùng đầu thì sạch', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          [ -n "${'$'}{{ secrets.PUBLISH_REPO_TOKEN }}" ] || { echo "thiếu PUBLISH_REPO_TOKEN"; exit 1; }
          echo "${'$'}{{ secrets.PUBLISH_REPO_TOKEN }}"
`;
  assert.deepEqual(secretsUsedWithoutEmptyCheck(source), []);
});

test('Z5 · phép kiểm rỗng nằm SAU lần dùng đầu không tính — phải kiểm TRƯỚC', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          echo "${'$'}{{ secrets.PUBLISH_REPO_TOKEN }}"
          [ -n "${'$'}{{ secrets.PUBLISH_REPO_TOKEN }}" ] || exit 1
`;
  assert.deepEqual(secretsUsedWithoutEmptyCheck(source), ['PUBLISH_REPO_TOKEN']);
});

test('Z5 · nhiều secret khác tên đều được kiểm riêng', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          [ -n "${'$'}{{ secrets.A }}" ] || exit 1
          echo "${'$'}{{ secrets.A }}"
          echo "${'$'}{{ secrets.B }}"
`;
  assert.deepEqual(secretsUsedWithoutEmptyCheck(source), ['B']);
});

test('Z5 · không nhắc secrets.* nào thì im lặng', () => {
  assert.deepEqual(secretsUsedWithoutEmptyCheck('name: x\non: [workflow_dispatch]\njobs:\n  j:\n    steps:\n      - run: echo hi\n'), []);
});

test('Z5 · cả sáu workflow thật hiện không dùng secrets.* nào (D-C01: hai PAT còn lại đều ngoài ops/workflows/)', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const missing = secretsUsedWithoutEmptyCheck(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual(missing, [], `${file}: ${missing.join(', ')}`);
  }
});

// ── Z9 · `|| true` / `continue-on-error: true` không có lý do ────────────

test('Z9 · || true không có chú thích ngay trên hay cùng dòng thì đỏ', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          rm -f maybe-missing.txt || true
`;
  assert.deepEqual(undocumentedSwallows(source), [8]);
});

test('Z9 · continue-on-error: true không có chú thích thì đỏ', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - name: bước mềm
        continue-on-error: true
        run: exit 1
`;
  assert.deepEqual(undocumentedSwallows(source), [7]);
});

test('Z9 · chú thích NGAY TRÊN thì sạch', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          # chủ ý: file có thể chưa tồn tại, không phải lỗi
          rm -f maybe-missing.txt || true
`;
  assert.deepEqual(undocumentedSwallows(source), []);
});

test('Z9 · chú thích CÙNG DÒNG thì sạch', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          rm -f maybe-missing.txt || true  # chủ ý: file có thể chưa tồn tại
`;
  assert.deepEqual(undocumentedSwallows(source), []);
});

test('Z9 · lệnh nối nhiều dòng bằng `\\` chỉ cần MỘT chú thích ở đầu khối', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          # chủ ý: lỗi vặt của API không được giết cả job
          SYNC=$(gh run list --limit 1 \\
            --json conclusion \\
            --jq '.[0].conclusion' || true)
`;
  assert.deepEqual(undocumentedSwallows(source), []);
});

test('Z9 · comment cách xa hơn một dòng (không nối bằng `\\`) không tính', () => {
  const source = `name: x
on: [workflow_dispatch]
jobs:
  j:
    steps:
      - run: |
          set -euo pipefail
          # chú thích cho lệnh khác, không phải lệnh dưới
          echo "không liên quan"
          rm -f maybe-missing.txt || true
`;
  const found = undocumentedSwallows(source);
  assert.equal(found.length, 1, JSON.stringify(found));
});

test('Z9 · cả sáu workflow thật trong ops/workflows/ đều đã giải thích mọi || true / continue-on-error', () => {
  const dir = join(process.cwd(), 'ops', 'workflows');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const found = undocumentedSwallows(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual(found, [], `${file}: dòng ${found.join(', ')}`);
  }
});
