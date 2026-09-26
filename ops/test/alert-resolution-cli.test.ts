import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { MAIN_RED_TITLE_MARKER, incidentSha } from '../scripts/alert-resolution.ts';

/**
 * Mục `platform/P-044` — **hợp đồng giữa bash và TypeScript, canh bằng máy.**
 *
 * `ops/test/alert-resolution.test.ts` kiểm các hàm thuần;
 * `ops/test/alert-resolution-workflow.test.ts` kiểm hình dạng YAML. Giữa hai
 * bài đó còn ba thứ mà **không bài nào chạm tới**, và vòng soát ngữ cảnh
 * sạch (bước 6 phụ lục P1) tái hiện được cả ba bằng cách phá mà mọi bài vẫn
 * xanh:
 *
 * 1. **Tầng CLI** của `alert-resolution.ts` — chính chỗ biến một `ancestry`
 *    lạ thành `unknown`. Sửa một dòng ở đó thành `'ancestor'` thì CLI đóng
 *    nhầm cảnh báo, mà 20/20 bài vẫn xanh.
 * 2. **Tên trường JSON** mà bash đọc bằng `jq -r '.sha'` / `.source` /
 *    `.verdict`, và **vị trí argv**. Đổi một tên trường là một chỗ hỏng im
 *    lặng: `jq` trả rỗng, verdict thành `keep`, job xanh, không đóng gì.
 * 3. **Ngữ nghĩa `git merge-base --is-ancestor`** và thứ tự hai tham số của
 *    nó trong YAML. Đảo thứ tự thì mọi cảnh báo ra `keep` mãi mãi.
 *
 * Ba thứ đó đều chỉ hỏng theo một chiều: **job vẫn chạy, vẫn xanh, và không
 * đóng gì** — hoặc tệ hơn, đóng nhầm. Nhóm **Z**, nên chúng phải có bài.
 */

const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'alert-resolution.ts');
const MAIN_CI = readFileSync(join(import.meta.dirname, '..', 'workflows', 'main-ci.yml'), 'utf8');

/** Gọi CLI đúng cách `main-ci.yml` gọi nó, và trả về JSON đã parse. */
function cli(args: readonly string[], stdin = ''): Record<string, unknown> {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { input: stdin, encoding: 'utf8' });
  assert.equal(run.status, 0, `CLI thoát ${run.status}: ${run.stderr}`);
  return JSON.parse(run.stdout) as Record<string, unknown>;
}

// ── 1 · tầng CLI, đúng chiều nguy hiểm ───────────────────────────────────

test('CLI · `ancestry` lạ KHÔNG được thành `ancestor` — hướng an toàn là `keep`', () => {
  for (const junk of ['', 'garbage', 'ANCESTOR', 'true', 'yes']) {
    const out = cli(['verdict', '[CẢNH BÁO] main đỏ tại a44d265', 'a44d265', 'title', junk]);
    assert.equal(out['verdict'], 'keep', `ancestry=${JSON.stringify(junk)} phải ra keep`);
  }
});

test('CLI · chỉ đúng chữ `ancestor` mới ra `close`', () => {
  const out = cli(['verdict', '[CẢNH BÁO] main đỏ tại a44d265', 'a44d265', 'title', 'ancestor']);
  assert.equal(out['verdict'], 'close');
});

test('CLI · `sha` rỗng → `keep`, đúng cách bash truyền khi `jq` không thấy trường', () => {
  const out = cli(['verdict', '[CẢNH BÁO] main đỏ tại a44d265', '', '', 'ancestor']);
  assert.equal(out['verdict'], 'keep');
});

// ── 2 · tên trường và vị trí argv, đúng thứ bash đọc ─────────────────────

test('CLI mode `sha` · trả ĐÚNG hai trường `sha` và `source` mà `jq` trong YAML đọc', () => {
  const body = '🤖\n<!-- crux-hotfix-scope -->\n```json\n{"sha":"abcdef1","files":["a.ts"]}\n```';
  const out = cli(['sha', '[CẢNH BÁO] main đỏ tại zzzzzzz'], body);
  assert.deepEqual(out, { sha: 'abcdef1', source: 'scope-block' });

  const none = cli(['sha', '[CẢNH BÁO] Nhà máy im lặng'], 'không có gì');
  assert.deepEqual(none, { sha: null }, '`jq -r ".sha // \\"\\""` phải ra rỗng, không ra `null` chữ');
});

test('CLI mode `verdict` · trả trường `verdict` và `reason`', () => {
  const out = cli(['verdict', '[CẢNH BÁO] main đỏ tại a44d265', 'a44d265', 'title', 'ancestor']);
  assert.ok('verdict' in out && 'reason' in out);
  assert.equal(typeof out['reason'], 'string');
});

test('YAML đọc đúng những tên trường CLI thật sự in ra', () => {
  for (const expr of [`jq -r '.sha // ""'`, `jq -r '.source // ""'`, `jq -r '.verdict'`]) {
    assert.ok(MAIN_CI.includes(expr), `main-ci.yml phải đọc bằng \`${expr}\``);
  }
  // Vị trí argv của mode `verdict`: <title> <sha> <source> <ancestry>.
  assert.match(
    MAIN_CI,
    /node ops\/scripts\/alert-resolution\.ts verdict "\$TITLE" "\$SHA_I" "\$SRC" "\$ANCESTRY"/,
  );
});

// ── 3 · ngữ nghĩa và thứ tự của `merge-base --is-ancestor` ───────────────

test('`git merge-base --is-ancestor <tổ tiên> <hậu duệ>` — ngữ nghĩa, đo bằng git THẬT', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-ancestor-'));
  try {
    const git = (...args: string[]): string =>
      execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    git('commit', '-q', '--allow-empty', '-m', 'một');
    const older = git('rev-parse', 'HEAD').trim();
    git('commit', '-q', '--allow-empty', '-m', 'hai');
    const newer = git('rev-parse', 'HEAD').trim();

    const isAncestor = (a: string, b: string): boolean =>
      spawnSync('git', ['-C', dir, 'merge-base', '--is-ancestor', a, b]).status === 0;

    assert.equal(isAncestor(older, newer), true, 'tổ tiên trước, hậu duệ sau → đúng');
    assert.equal(isAncestor(newer, older), false, 'đảo lại → SAI, và đó là chỗ hỏng cần canh');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('YAML dùng đúng thứ tự đó — `$SHA_I` trước, `$GREEN_SHA` sau', () => {
  assert.match(MAIN_CI, /git merge-base --is-ancestor "\$SHA_I" "\$GREEN_SHA"/);
  // Và KHÔNG có bản đảo ở đâu cả.
  assert.doesNotMatch(MAIN_CI, /git merge-base --is-ancestor "\$GREEN_SHA" "\$SHA_I"/);
});

// ── 4 · hợp đồng ĐỊNH DẠNG TIÊU ĐỀ, năm bản sao phải khớp nhau ──────────

/**
 * `main-ci.yml` dựng tiêu đề ở một chỗ và tìm lại nó ở hai chỗ khác, còn
 * `alert-resolution.ts` phân tích nó ở chỗ thứ tư. Trước bài này, đổi dòng
 * `TITLE=` làm nhánh `source: 'title'` chết mà **776 bài vẫn xanh** — và
 * nhánh đó là đường DUY NHẤT dùng được cho `#131`, đúng cảnh báo là lý do
 * mở mục này (thân nó không có khối `crux-hotfix-scope` vì mở trước `D-C07`).
 */
test('tiêu đề THẬT mà `main-ci.yml` dựng đi lọt qua `incidentSha`', () => {
  const line = MAIN_CI.split('\n').find((l) => l.trim().startsWith('TITLE='));
  assert.ok(line !== undefined, 'không tìm thấy dòng `TITLE=` trong main-ci.yml');

  // `TITLE="[CẢNH BÁO] main đỏ tại ${SHA:0:7}"` → thay biến bằng sha thật.
  const template = line.trim().replace(/^TITLE="/, '').replace(/"$/, '');
  const title = template.replace('${SHA:0:7}', 'a44d265');
  assert.doesNotMatch(title, /\$\{/, 'mẫu tiêu đề còn biến chưa thay — bài này cần sửa theo');

  assert.deepEqual(incidentSha(title, 'thân không có khối máy đọc nào'), {
    sha: 'a44d265',
    source: 'title',
  });
});

test('cả hai lệnh `--search` tìm đúng chuỗi mà tiêu đề mang', () => {
  const searches = MAIN_CI.match(/--search "([^"]*)"/g) ?? [];
  assert.ok(searches.length >= 2, 'phải có ít nhất hai chỗ tìm issue cảnh báo');
  for (const search of searches) {
    assert.ok(
      search.includes(MAIN_RED_TITLE_MARKER),
      `\`${search}\` không chứa \`${MAIN_RED_TITLE_MARKER}\` — bên mở và bên đóng đã lệch nhau`,
    );
  }
  const line = MAIN_CI.split('\n').find((l) => l.trim().startsWith('TITLE='))!;
  assert.ok(line.includes(MAIN_RED_TITLE_MARKER), 'tiêu đề không còn chứa chuỗi hai bên cùng tìm');
});
