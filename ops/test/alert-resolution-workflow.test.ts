import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * Mục `platform/P-044` — **hình dạng của job đóng cảnh báo, canh bằng máy.**
 *
 * `ops/test/alert-resolution.test.ts` kiểm phần QUYẾT ĐỊNH (TypeScript
 * thuần). Bài này kiểm phần NỐI DÂY trong YAML, vì mọi chỗ hỏng ở đây đều
 * cùng một hình dạng: job vẫn chạy, vẫn XANH, và không đóng gì cả.
 *
 * Bốn chỗ có thể gỡ cơ chế trong im lặng, mỗi chỗ một bài:
 *
 * 1. `if: success()` đổi thành thứ khác → job chạy cả trên `main` đỏ.
 * 2. `fetch-depth: 0` mất → `merge-base --is-ancestor` không có lịch sử,
 *    mọi `sha` ra `unknown`, mọi verdict ra `keep`, job xanh.
 * 3. Bộ lọc `github-actions[bot]` mất → bất biến **I7** thủng: agent tự
 *    chọn được `sha` cho phép đóng bằng một comment.
 * 4. `dry_run` không còn chặn `gh issue close` (`P-010`).
 *
 * Đọc thẳng file YAML, có tiền lệ ở `ops/test/alert-escalation-workflows.test.ts`.
 */

const MAIN_CI = readFileSync(
  join(import.meta.dirname, '..', 'workflows', 'main-ci.yml'),
  'utf8',
);

/** Thân job `<name>` — từ dòng khai job tới job cấp một kế tiếp, hoặc hết file. */
function job(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `không tìm thấy job \`${name}\``);
  const after = lines.findIndex(
    (line, index) => index > start && /^ {2}[A-Za-z][\w-]*:$/.test(line),
  );
  return lines.slice(start, after === -1 ? lines.length : after).join('\n');
}

const RESOLVE = job(MAIN_CI, 'resolve-alert');

/**
 * Cùng thân job nhưng **bỏ mọi dòng chú thích**.
 *
 * Mọi khẳng định về CẤU TRÚC phải đọc bản này. Chú thích trong job mô tả cả
 * những thứ job KHÔNG làm (`if: failure()` là của job `alert`, và `fetch-depth:
 * 0` được giải thích ngay phía trên dòng thật) — bản đầu của bài này khớp cả
 * chú thích, nên gỡ khoá thật mà bài vẫn xanh. Đúng hai lần liên tiếp, nên
 * luật thành một biến chứ không còn là một lời dặn.
 */
const RESOLVE_YAML = RESOLVE.split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

test('job `resolve-alert` tồn tại và chỉ chạy khi `check` XANH, trên `main`', () => {
  assert.match(RESOLVE_YAML, /needs: check/);
  assert.match(RESOLVE_YAML, /if: success\(\)/);
  // Nó KHÔNG được mang `failure()` — đó là job `alert`, việc ngược lại.
  assert.doesNotMatch(RESOLVE_YAML, /if: failure\(\)/);
  // `workflow_dispatch` ở đầu file không giới hạn nhánh, nên thiếu chốt này
  // là một lần gọi tay trên nhánh làm việc ĐÓNG được cảnh báo `main` đỏ kèm
  // câu "`main` đã xanh lại" trong khi `main` còn đỏ.
  assert.match(RESOLVE_YAML, /github\.ref == 'refs\/heads\/main'/);
});

test('checkout lấy ĐỦ lịch sử — thiếu là mọi verdict ra `keep` mà job vẫn xanh', () => {
  assert.ok(
    RESOLVE_YAML.split('\n').some((line) => line === '          fetch-depth: 0'),
    '`resolve-alert` phải checkout với `fetch-depth: 0`',
  );
});

test('I7 · chỉ đọc thân issue và comment của `github-actions[bot]`', () => {
  const selects = RESOLVE_YAML.match(/select\(\.author\.login == "github-actions\[bot\]"\)/g) ?? [];
  // Hai chỗ: thân issue, và từng comment. Bỏ một trong hai là thủng một nửa.
  assert.equal(selects.length, 2, 'phải lọc tác giả ở CẢ thân issue lẫn comment');
});

test('phần quyết định gọi `alert-resolution.ts`, không tự so trong bash', () => {
  assert.match(RESOLVE_YAML, /node ops\/scripts\/alert-resolution\.ts sha /);
  assert.match(RESOLVE_YAML, /node ops\/scripts\/alert-resolution\.ts verdict /);
  // Không có phép so `ancestor` nào bằng tay ngoài ba chỗ gán biến.
  const assigns = RESOLVE_YAML.match(/ANCESTRY=(ancestor|not-ancestor|unknown)/g) ?? [];
  assert.equal(assigns.length, 3);
});

test('P-010 · `dry_run` chặn `gh issue close`, và nhánh chạy thử in ra thân THẬT', () => {
  const lines = RESOLVE_YAML.split('\n');
  const guard = lines.findIndex((line) => line.includes('"$DRY_RUN" = "true"'));
  const close = lines.findIndex((line) => line.includes('gh issue close'));
  assert.notEqual(guard, -1, 'thiếu cổng dry_run');
  assert.notEqual(close, -1, 'thiếu lệnh đóng');
  assert.ok(guard < close, '`gh issue close` phải nằm SAU cổng dry_run');
  // Cổng phải `continue` (bỏ qua issue này) chứ không `exit 0` — `exit 0` ở
  // giữa vòng lặp sẽ bỏ luôn các issue còn lại, nên chạy thử không in đủ.
  assert.match(lines.slice(guard, close).join('\n'), /continue/);
});

test('đọc danh sách qua fd 3 — `gh`/`node` trong thân vòng lặp không nuốt được nó', () => {
  assert.match(RESOLVE_YAML, /read -r -u 3/);
  assert.match(RESOLVE_YAML, /done 3<<< "\$OPEN"/);
});

test('bình luận đóng mở đầu bằng 🤖 (CLAUDE.md mục 5)', () => {
  assert.match(RESOLVE_YAML, /"🤖 \\`main\\` đã xanh lại/);
});

test('MỌI lệnh `gh` trong job đều được bọc — một lỗi vặt không được làm `main-ci` ĐỎ', () => {
  // Chỗ hỏng thật, vòng soát ngữ cảnh sạch tái hiện được: `gh issue close`
  // trần dưới `set -euo pipefail` giết cả bước khi `gh` lỗi. Hậu quả KHÔNG
  // phải "một issue chưa đóng" — lượt `main-ci` này thành ĐỎ trong khi
  // `pnpm check` XANH, và job `alert` (`needs: check` + `if: failure()`)
  // không chạy vì `check` xanh. Tức một lần chạy đỏ mà KHÔNG có cảnh báo
  // nào, cộng một `mainCiRed` giả cho điều kiện 1 của `D-C07`.
  const bare = RESOLVE_YAML.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('gh ') && !line.startsWith('gh issue close'));
  assert.deepEqual(bare, [], `lệnh gh chưa bọc: ${bare.join(' | ')}`);

  const close = RESOLVE_YAML.split('\n').find((line) => line.includes('gh issue close'));
  assert.ok(close !== undefined, 'thiếu lệnh đóng');
  assert.match(close, /^\s*if ! gh issue close /, '`gh issue close` phải nằm trong `if !`');
});
