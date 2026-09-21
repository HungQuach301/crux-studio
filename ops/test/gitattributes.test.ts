/**
 * `.gitattributes` — luật `merge=union` cho file append-only (KF-005).
 *
 * Luật này là thứ dễ biến mất nhất trong repo: nó nằm ở một file không ai
 * mở, và khi nó biến mất thì **không gì đỏ** — chỉ là lần sau có người phải
 * giải tay một xung đột lẽ ra git tự giải. Đúng nhóm Z.
 *
 * Hai chiều đều phải khoá, và chiều thứ hai quan trọng hơn:
 *
 * 1. Mọi file append-only đang có phải được khai `merge=union`.
 * 2. **Không** file Markdown nào được khai `merge=union`. Union trên Markdown
 *    lồng hai mục vào nhau và sinh ra một mục vô nghĩa mà git vẫn coi là
 *    merge thành công — hỏng mà không gì đỏ, lần này do chính ta gây ra.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { listLogFiles } from '@crux/kernel';

interface Rule {
  pattern: string;
  attrs: string[];
}

function rules(): Rule[] {
  const source = readFileSync(join(process.cwd(), '.gitattributes'), 'utf8');
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const [pattern, ...attrs] = line.split(/\s+/);
      return { pattern: pattern!, attrs };
    });
}

/** Những file append-only mà mỗi dòng độc lập và thứ tự dòng không mang nghĩa. */
const APPEND_ONLY = ['ops/logs/*.jsonl', 'ops/logs/**/*.jsonl', 'docs/visual/calibration-log.jsonl'];

/**
 * Một đường dẫn có nằm dưới luật `merge=union` không — hỏi **chính git**.
 *
 * Bản trước tự viết một matcher glob ở đây. Nó sai theo chiều báo đỏ oan:
 * git cho `**` khớp cả 0 thư mục và cho mẫu không có `/` khớp ở mọi tầng,
 * nên một luật đúng vẫn có thể bị báo là "mất lớp tự giải". Một matcher
 * tự viết để kiểm luật của git thì tự nó là thứ cần được kiểm — hỏi thẳng
 * `git check-attr` rẻ hơn và không lệch được.
 */
function hasUnionMerge(path: string): boolean {
  const result = spawnSync('git', ['check-attr', 'merge', '--', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return result.stdout.includes('merge: union');
}

test('KF-005 · mọi file append-only đều được khai `merge=union`', () => {
  const declared = rules();
  for (const pattern of APPEND_ONLY) {
    const rule = declared.find((r) => r.pattern === pattern);
    assert.ok(rule, `\`.gitattributes\` thiếu luật cho \`${pattern}\``);
    assert.ok(
      rule.attrs.includes('merge=union'),
      `\`${pattern}\` có luật nhưng không phải \`merge=union\`: ${rule.attrs.join(' ')}`,
    );
  }
});

test('KF-005 · KHÔNG file Markdown nào được khai `merge=union`', () => {
  for (const rule of rules()) {
    if (!rule.attrs.includes('merge=union')) continue;
    assert.ok(
      !/\.mdx?$/.test(rule.pattern),
      `\`${rule.pattern}\` là Markdown mà lại khai \`merge=union\`. ` +
        'Union sẽ lồng hai mục vào nhau và vẫn merge thành công — hỏng mà không gì đỏ.',
    );
  }
});

test('KF-005 · mọi file log ĐANG CÓ TRÊN ĐĨA đều nằm dưới một luật union', () => {
  // Bắt trường hợp một làn mới ghi log vào chỗ mà luật không phủ. Từ
  // `D-C04`, log nằm ở `ops/logs/<lane>/<id>.jsonl` — mẫu một tầng
  // `ops/logs/*.jsonl` KHÔNG khớp file nào trong số đó, nên bài kiểm này
  // phải đi từ file thật chứ không từ danh sách mẫu.
  const root = process.cwd();
  const logsDir = join(root, 'ops', 'logs');
  assert.ok(existsSync(logsDir), 'thiếu ops/logs/');

  const files = listLogFiles(logsDir).map((path) => relative(root, path).split(sep).join('/'));
  assert.ok(files.length > 0, 'không thấy file log nào dưới ops/logs/ — bài kiểm này sẽ xanh giả');

  for (const file of files) {
    assert.ok(hasUnionMerge(file), `\`${file}\` không nằm dưới luật union nào — log đó mất lớp tự giải`);
  }

  // Và một file log CHƯA tồn tại của một mục sẽ ra đời ngày mai cũng phải
  // được phủ sẵn — luật phải theo hình dạng đường dẫn, không theo danh sách file.
  assert.ok(hasUnionMerge('ops/logs/topic/T-999.jsonl'));
  assert.ok(hasUnionMerge('ops/logs/platform.jsonl'), 'file phẳng còn sót vẫn phải được phủ');
  assert.ok(!hasUnionMerge('ops/known-failures.md'), 'Markdown KHÔNG được nhận union');
});


/**
 * `.gitignore` cho `ops/logs/` — lớp bảo vệ dễ tắt lặng lẽ nhất của
 * `D-C04`.
 *
 * Trước `D-C04`, luật là `ops/logs/*.jsonl` cộng một danh sách trắng từng
 * file làn. Khi log chuyển sang `ops/logs/<lane>/<id>.jsonl`, mẫu một tầng
 * **không còn khớp file nào** — dấu sao của gitignore không vượt qua dấu
 * gạch chéo. Lớp bảo vệ tắt, và **không gì đỏ**: chỉ là từ đó mỗi lần
 * `pnpm run:episode` chạy nháp cục bộ lại để lại một nắm file log sẵn sàng
 * bị commit nhầm. Đúng nhóm Z, và đúng thứ `D-C04` sinh ra để chống.
 *
 * Bài kiểm hỏi `git check-ignore` — sự thật gốc — chứ không đọc mẫu bằng mắt.
 */
function isIgnored(path: string): boolean {
  const result = spawnSync('git', ['check-ignore', '-q', path], { cwd: process.cwd() });
  return result.status === 0;
}

test('D-C04 · log của lần chạy tập bị ignore, log của mục backlog thì KHÔNG', () => {
  // `pnpm run:episode` chạy nháp: không được lọt vào commit.
  for (const path of [
    'ops/logs/topic/ep-0001-stub.jsonl',
    'ops/logs/integration/ep-0001-stub.jsonl',
    'ops/logs/assembly/ep-9999-thu.jsonl',
    'ops/logs/platform.jsonl', // hình dạng cũ, nếu còn sót
  ]) {
    assert.ok(isIgnored(path), `\`${path}\` là log chạy nháp mà KHÔNG bị ignore — sẽ bị commit nhầm`);
  }

  // Dòng log THẬT của một mục backlog (bất biến I8): phải commit được.
  for (const path of [
    'ops/logs/platform/P-018.jsonl',
    'ops/logs/integration/I-001.jsonl',
    'ops/logs/visual/V-003.jsonl',
    'ops/logs/verify/VF-G17.jsonl',
  ]) {
    assert.ok(
      !isIgnored(path),
      `\`${path}\` là dòng log của một mục mà lại bị ignore — bất biến I8 mất dòng log, và không gì đỏ`,
    );
  }
});
