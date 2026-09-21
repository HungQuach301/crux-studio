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
 * Một đường dẫn (tương đối gốc repo) có khớp một mẫu `.gitattributes` không.
 * Chỉ hiểu đúng hai hình dạng repo đang dùng: mẫu một tầng (một dấu sao
 * trước phần mở rộng) và mẫu mọi tầng con (hai dấu sao rồi một dấu sao),
 * cộng đường dẫn nguyên văn. Cố ý hẹp: một matcher glob đầy đủ ở đây sẽ
 * tự nó thành thứ cần kiểm.
 */
function matches(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  const deep = pattern.match(/^(.*)\/\*\*\/\*(\.[A-Za-z0-9]+)$/);
  if (deep) {
    const [, dir, ext] = deep;
    return path.startsWith(`${dir}/`) && path.endsWith(ext!) && path.slice(dir!.length + 1).includes('/');
  }
  const flat = pattern.match(/^(.*)\/\*(\.[A-Za-z0-9]+)$/);
  if (flat) {
    const [, dir, ext] = flat;
    const rest = path.startsWith(`${dir}/`) ? path.slice(dir!.length + 1) : null;
    return rest !== null && rest.endsWith(ext!) && !rest.includes('/');
  }
  return false;
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

  const unionPatterns = rules()
    .filter((r) => r.attrs.includes('merge=union'))
    .map((r) => r.pattern);

  const files = listLogFiles(logsDir).map((path) => relative(root, path).split(sep).join('/'));
  assert.ok(files.length > 0, 'không thấy file log nào dưới ops/logs/ — bài kiểm này sẽ xanh giả');

  for (const file of files) {
    assert.ok(
      unionPatterns.some((pattern) => matches(pattern, file)),
      `\`${file}\` không nằm dưới luật union nào — log đó mất lớp tự giải`,
    );
  }
});
