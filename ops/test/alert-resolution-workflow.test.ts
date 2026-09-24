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

test('job `resolve-alert` tồn tại và chỉ chạy khi `check` XANH', () => {
  assert.match(RESOLVE, /needs: check/);
  assert.match(RESOLVE, /if: success\(\)/);
  // Nó KHÔNG được mang `failure()` — đó là job `alert`, việc ngược lại.
  assert.doesNotMatch(RESOLVE, /if: failure\(\)/);
});

test('checkout lấy ĐỦ lịch sử — thiếu là mọi verdict ra `keep` mà job vẫn xanh', () => {
  // Khớp DÒNG YAML thật, không khớp chữ `fetch-depth: 0` nằm trong chú
  // thích ngay phía trên nó: bản đầu của bài này khớp cả hai, nên gỡ khoá
  // thật mà bài vẫn xanh — chính chỗ hỏng nó sinh ra để chặn.
  const yaml = RESOLVE.split('\n').filter((line) => !line.trimStart().startsWith('#'));
  assert.ok(
    yaml.some((line) => line === '          fetch-depth: 0'),
    '`resolve-alert` phải checkout với `fetch-depth: 0`',
  );
});

test('I7 · chỉ đọc thân issue và comment của `github-actions[bot]`', () => {
  const selects = RESOLVE.match(/select\(\.author\.login == "github-actions\[bot\]"\)/g) ?? [];
  // Hai chỗ: thân issue, và từng comment. Bỏ một trong hai là thủng một nửa.
  assert.equal(selects.length, 2, 'phải lọc tác giả ở CẢ thân issue lẫn comment');
});

test('phần quyết định gọi `alert-resolution.ts`, không tự so trong bash', () => {
  assert.match(RESOLVE, /node ops\/scripts\/alert-resolution\.ts sha /);
  assert.match(RESOLVE, /node ops\/scripts\/alert-resolution\.ts verdict /);
  // Không có phép so `ancestor` nào bằng tay ngoài ba chỗ gán biến.
  const assigns = RESOLVE.match(/ANCESTRY=(ancestor|not-ancestor|unknown)/g) ?? [];
  assert.equal(assigns.length, 3);
});

test('P-010 · `dry_run` chặn `gh issue close`, và nhánh chạy thử in ra thân THẬT', () => {
  const lines = RESOLVE.split('\n');
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
  assert.match(RESOLVE, /read -r -u 3/);
  assert.match(RESOLVE, /done 3<<< "\$OPEN"/);
});

test('bình luận đóng mở đầu bằng 🤖 (CLAUDE.md mục 5)', () => {
  assert.match(RESOLVE, /"🤖 \\`main\\` đã xanh lại/);
});
