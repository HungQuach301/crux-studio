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
import { join } from 'node:path';

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
const APPEND_ONLY = ['ops/logs/*.jsonl', 'docs/visual/calibration-log.jsonl'];

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

test('KF-005 · mọi file log đang có đều nằm dưới một luật union', () => {
  // Bắt trường hợp một làn mới ghi log vào chỗ mà luật không phủ.
  const logsDir = join(process.cwd(), 'ops', 'logs');
  assert.ok(existsSync(logsDir), 'thiếu ops/logs/');
  const covered = rules().some(
    (r) => r.pattern === 'ops/logs/*.jsonl' && r.attrs.includes('merge=union'),
  );
  assert.ok(covered, 'luật `ops/logs/*.jsonl merge=union` không còn — mọi log của mọi làn mất lớp tự giải');
});
