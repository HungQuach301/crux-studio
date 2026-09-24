import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * Mục `platform/P-034` — **luật mốc, canh bằng máy chứ không bằng chú thích.**
 *
 * Nhịp "@nhắc lại mỗi 4 giờ" đứng trên đúng một luật: mốc
 * `<!-- crux-escalate-* -->` chỉ được nằm trong thân TẠO issue và trong khối
 * @nhắc, **không** nằm trong comment tình trạng chạy mỗi giờ. Mốc lọt vào
 * comment đó thì `decideMention` thấy "vừa nhắc xong" ở mọi lượt, nhịp 4 giờ
 * không bao giờ tới hạn, và @nhắc chết hẳn — `pnpm check` vẫn xanh. Đúng
 * hình dạng nhóm **Z**.
 *
 * Trước bài kiểm này, luật đó chỉ được giữ bằng một dòng chú thích trong
 * YAML: ai sửa khối `BODY=` để thêm mốc vào là lặng lẽ gỡ cả cơ chế.
 *
 * Đọc thẳng file YAML, có tiền lệ ở `ops/test/smoke-workflows.test.ts`.
 */

const WORKFLOWS = join(import.meta.dirname, '..', 'workflows');

const read = (file: string): string => readFileSync(join(WORKFLOWS, file), 'utf8');

/**
 * Khối dựng biến `NAME=$(printf …)` trong một khối `run:` — từ dòng mở tới
 * dòng đóng `)` đầu tiên. Cắt bằng tay thay vì kéo một trình phân tích
 * bash: mặt bằng chỉ có hai file và một hình dạng, và một trình phân tích
 * đầy đủ ở đây là thêm một chỗ để bài kiểm này sai.
 */
function assignedBlock(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.trim().startsWith(`${name}=$(printf`));
  assert.notEqual(start, -1, `không tìm thấy khối \`${name}=$(printf\``);
  const end = lines.findIndex((line, index) => index >= start && line.trimEnd().endsWith(')'));
  assert.notEqual(end, -1, `khối \`${name}=\` không có dòng đóng`);
  return lines.slice(start, end + 1).join('\n');
}

/** Giá trị của một biến `env:` dạng `NAME: '<!-- … -->'`. */
function envMarker(source: string, name: string): string {
  const match = new RegExp(`^\\s*${name}: '([^']+)'`, 'm').exec(source);
  assert.ok(match, `không tìm thấy \`${name}:\` trong env của workflow`);
  return match[1]!;
}

test('hai cảnh báo dùng hai mốc KHÁC nhau', () => {
  // Chung mốc thì hai cảnh báo đếm nhịp 4 giờ của nhau: `main` đỏ vừa @nhắc
  // sẽ làm người canh im, và ngược lại.
  const mainCi = envMarker(read('main-ci.yml'), 'MARKER');
  const watchdog = envMarker(read('watchdog.yml'), 'MARKER_PREFIX');
  assert.notEqual(mainCi, watchdog);
  assert.ok(!mainCi.startsWith(watchdog), 'mốc của main-ci không được là biến thể của mốc watchdog');
  assert.ok(!watchdog.startsWith(mainCi), 'tiền tố của watchdog không được là biến thể của mốc main-ci');
});

test('main-ci: comment tình trạng chạy mỗi giờ KHÔNG mang mốc', () => {
  const source = read('main-ci.yml');
  const body = assignedBlock(source, 'BODY');
  assert.ok(!body.includes('$MARKER'), '`BODY` của main-ci không được nhắc `$MARKER`');
  assert.ok(!body.includes(envMarker(source, 'MARKER')), '`BODY` không được chứa chuỗi mốc viết thẳng');
});

test('main-ci: thân TẠO issue mang mốc — lần @nhắc đầu tiên nằm ở đó', () => {
  // Bỏ mốc khỏi thân thì lượt sau thấy "chưa @nhắc lần nào" và gọi chủ dự
  // án mỗi giờ, đúng cái spam vế 2 của câu trả lời muốn tránh.
  const createBody = assignedBlock(read('main-ci.yml'), 'CREATE_BODY');
  assert.ok(createBody.includes('$MARKER'));
  assert.ok(createBody.includes('@$OWNER'));
});

test('watchdog: comment tình trạng chạy mỗi giờ KHÔNG mang mốc', () => {
  const source = read('watchdog.yml');
  const body = assignedBlock(source, 'BODY');
  assert.ok(!body.includes('$MARKER'), '`BODY` của watchdog không được nhắc `$MARKER`');
  assert.ok(!body.includes('MARKER_PREFIX'), '`BODY` không được nhắc tiền tố mốc');
});

test('watchdog: khối @nhắc mang mốc và mang @nhắc', () => {
  const mention = assignedBlock(read('watchdog.yml'), 'MENTION');
  assert.ok(mention.includes('$MARKER'));
  assert.ok(mention.includes('@$OWNER'));
});

test('watchdog: mốc mang vân tay của TẬP DẤU HIỆU, không phải một chuỗi cố định', () => {
  // CHARTER 2.4 đếm "nhà máy im lặng" và "chi phí vượt 80% ngân sách" là hai
  // loại cảnh báo khẩn KHÁC nhau, mà workflow gộp chúng vào một issue. Không
  // có vân tay thì một dấu hiệu MỚI xuất hiện giữa khoảng lặng 4 giờ sẽ
  // không gọi ai — nó bị đối xử như lần nhắc lại của dấu hiệu cũ.
  const source = read('watchdog.yml');
  assert.match(source, /FINGERPRINT=\$\(printf '%s' "\$PROBLEMS" \| sha256sum/);
  assert.match(source, /MARKER="\$\{MARKER_PREFIX\}\$\{FINGERPRINT\} -->"/);
});

test('cả hai workflow chỉ đọc thân và comment của github-actions[bot] (I7)', () => {
  // Không lọc thì bất kỳ ai cũng đặt lại được đồng hồ 4 giờ bằng một comment
  // mang chuỗi mốc — nút "Quote reply" của GitHub chép cả HTML comment.
  for (const file of ['main-ci.yml', 'watchdog.yml']) {
    const source = read(file);
    const calls = source.split('\n').filter((line) => line.includes('alert-escalation.ts'));
    assert.ok(calls.length > 0, `${file} phải gọi alert-escalation.ts`);
    assert.ok(
      source.includes('select(.author.login == "github-actions[bot]")'),
      `${file} phải lọc tác giả trước khi đưa nội dung issue vào phần quyết định (I7)`,
    );
  }
});

test('cả hai workflow có hướng an toàn khi không đọc được lịch sử @nhắc', () => {
  // `gh` lỗi vặt dưới `set -euo pipefail` giết cả bước, mà comment tình
  // trạng thì đã đăng — @nhắc mất trong im lặng.
  for (const file of ['main-ci.yml', 'watchdog.yml']) {
    const source = read(file);
    assert.ok(source.includes('if ! DECISION=$('), `${file} phải bắt lỗi của lệnh dựng DECISION`);
    assert.match(source, /DECISION='\{"verdict":"mention"/);
  }
});
