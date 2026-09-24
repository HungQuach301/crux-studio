import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadChannelPack, loadChannelTitleFormulas, titleFormulaIdsFor } from '../src/index.ts';

function withTmpRoot(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'crux-packs-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('loadChannelPack đọc đúng channel.json thật của repo', () => {
  const pack = loadChannelPack(process.cwd(), 'us-personal-finance');
  assert.equal(pack.slug, 'us-personal-finance');
  assert.equal(pack.genre, 'data-explainer');
});

test('loadChannelTitleFormulas đọc đúng title-formulas.json thật của repo', () => {
  const pack = loadChannelTitleFormulas(process.cwd(), 'us-personal-finance');
  assert.equal(pack.channel, 'us-personal-finance');
  assert.equal(pack.formulas.length, 5);
  assert.deepEqual(
    [...titleFormulaIdsFor(pack)].sort(),
    ['hidden-cost', 'narrow-question', 'numeric-comparison', 'reversal', 'threshold'],
  );
});

test('loadChannelTitleFormulas NÉM lỗi khi channel khai trong file không khớp tên thư mục', () => {
  withTmpRoot((root) => {
    const dir = join(root, 'packs', 'channels', 'some-slug');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'title-formulas.json'),
      JSON.stringify({ channel: 'other-slug', formulas: [{ id: 'x', name: 'X' }] }),
    );
    assert.throws(
      () => loadChannelTitleFormulas(root, 'some-slug'),
      /some-slug/,
    );
  });
});

test('titleFormulaIdsFor trả về một Set, không phải mảng — tra cứu là O(1)', () => {
  const ids = titleFormulaIdsFor({ channel: 'x', formulas: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] });
  assert.ok(ids instanceof Set);
  assert.equal(ids.size, 2);
  assert.ok(ids.has('a'));
  assert.ok(!ids.has('c'));
});
