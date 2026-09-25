/**
 * `ops/scripts/check-reading-table.ts` — cơ chế của mục `audio/AU-007`.
 *
 * Test âm là phần quan trọng: một bảng đọc sai cấu trúc, trùng id, hay
 * pattern hỏng mà **không gì đỏ** đúng là thứ việc này tồn tại để chặn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readingTableProblems, readingTablePackFiles } from '../scripts/check-reading-table.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Một bảng đọc hợp lệ tối thiểu để đục từng chỗ một. */
function goodTable(): Record<string, unknown> {
  return {
    channel: 'demo',
    rules: [
      { id: 'percent', pattern: '([0-9]+)%', flags: 'g', replacement: '$1 percent', test: { input: '5%', expected: '5 percent' } },
    ],
  };
}

function rootWith(slug: string, table: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-reading-'));
  const dir = join(root, 'packs', 'channels', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'reading-table.json'), typeof table === 'string' ? table : JSON.stringify(table));
  return root;
}

test('repo thật: bảng đọc sạch và us-personal-finance nằm trong tầm quét', () => {
  assert.deepEqual(readingTableProblems(REPO_ROOT), []);
  assert.ok(
    readingTablePackFiles(REPO_ROOT).includes(join('packs', 'channels', 'us-personal-finance', 'reading-table.json')),
  );
});

test('sạch thì KHÔNG đỏ — kiểm đỏ nhầm cũng vô dụng', () => {
  assert.deepEqual(readingTableProblems(rootWith('demo', goodTable())), []);
});

test('thiếu trường bắt buộc của một luật → đỏ (hợp schema)', () => {
  const t = goodTable();
  delete (t.rules as { test?: unknown }[])[0]!.test;
  const problems = readingTableProblems(rootWith('demo', t));
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /không hợp reading-table\.schema\.json/);
});

test('channel không khớp thư mục → đỏ', () => {
  const problems = readingTableProblems(rootWith('demo', { ...goodTable(), channel: 'other' }));
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /channel "other".*thư mục "demo"/);
});

test('id luật trùng nhau → đỏ', () => {
  const t = goodTable();
  (t.rules as unknown[]).push({
    id: 'percent',
    pattern: 'x',
    replacement: 'y',
    test: { input: 'x', expected: 'y' },
  });
  const problems = readingTableProblems(rootWith('demo', t));
  assert.ok(problems.some((p) => /id luật "percent" bị trùng/.test(p)), problems.join('\n'));
});

test('pattern không biên dịch được → đỏ', () => {
  const t = goodTable();
  (t.rules as { pattern: string }[])[0]!.pattern = '([unclosed';
  const problems = readingTableProblems(rootWith('demo', t));
  assert.ok(problems.some((p) => /không biên dịch được/.test(p)), problems.join('\n'));
});

test('JSON hỏng → đỏ, không ném', () => {
  const problems = readingTableProblems(rootWith('demo', '{ not json'));
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /không đọc được JSON/);
});
