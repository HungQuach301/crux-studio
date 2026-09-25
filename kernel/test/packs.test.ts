import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadGenreLayouts,
  loadChannelVisualTokens,
  layoutIdsFor,
  type GenreLayouts,
} from '../src/packs.ts';
import { loadChannelPack, loadChannelTitleFormulas, titleFormulaIdsFor } from '../src/index.ts';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'crux-packs-test-'));
}

const VALID_LAYOUTS = {
  $schemaRef: 'layouts.schema.json',
  genre: 'data-explainer',
  version: '1.1',
  orientation: {
    landscape: { width: 1920, height: 1080 },
    vertical: { width: 1080, height: 1920 },
  },
  landscapeLayouts: [{ id: 'hero-number', wave: 4, maxPerEpisode: 16, variants: ['plain'] }],
  verticalLayouts: [{ id: 'v-hero-number', wave: 4, variants: ['plain'] }],
};

const VALID_TOKENS = {
  $schemaRef: 'visual-tokens.schema.json',
  channel: 'us-personal-finance',
  version: '1.0',
  colors: {
    bg: '#000', surface: '#000', ink: '#000', 'ink-muted': '#000', accent: '#000',
    warn: '#000', positive: '#000', negative: '#000', grid: '#000',
  },
  typography: { family: 'Inter' },
  grid: { columns: 12 },
  motion: {},
};

function writePack(root: string, dir: string, file: string, data: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify(data, null, 2));
}

test('loadGenreLayouts nạp và validate layouts.json thật', () => {
  const root = tempRoot();
  try {
    writePack(root, join(root, 'packs', 'genres', 'data-explainer'), 'layouts.json', VALID_LAYOUTS);
    const layouts = loadGenreLayouts(root, 'data-explainer');
    assert.equal(layouts.genre, 'data-explainer');
    assert.deepEqual(layoutIdsFor(layouts, 'landscape'), ['hero-number']);
    assert.deepEqual(layoutIdsFor(layouts, 'vertical'), ['v-hero-number']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadGenreLayouts ném lỗi khi genre trong file lệch thư mục chứa nó', () => {
  const root = tempRoot();
  try {
    writePack(root, join(root, 'packs', 'genres', 'other-genre'), 'layouts.json', VALID_LAYOUTS);
    assert.throws(() => loadGenreLayouts(root, 'other-genre'), /khai genre "data-explainer" nhưng nằm ở thư mục "other-genre"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadGenreLayouts ném lỗi khi layouts.json không hợp contract', () => {
  const root = tempRoot();
  try {
    const broken: Record<string, unknown> = { ...VALID_LAYOUTS };
    delete broken['verticalLayouts'];
    writePack(root, join(root, 'packs', 'genres', 'data-explainer'), 'layouts.json', broken);
    assert.throws(() => loadGenreLayouts(root, 'data-explainer'), /không hợp lệ theo contract/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadChannelVisualTokens nạp và validate visual-tokens.json thật', () => {
  const root = tempRoot();
  try {
    writePack(root, join(root, 'packs', 'channels', 'us-personal-finance'), 'visual-tokens.json', VALID_TOKENS);
    const tokens = loadChannelVisualTokens(root, 'us-personal-finance');
    assert.equal(tokens.channel, 'us-personal-finance');
    assert.equal(tokens.colors['accent'], '#000');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadChannelVisualTokens ném lỗi khi thiếu một vai trò màu bắt buộc', () => {
  const root = tempRoot();
  try {
    const broken = { ...VALID_TOKENS, colors: { ...VALID_TOKENS.colors } } as Record<string, unknown>;
    delete (broken['colors'] as Record<string, unknown>)['grid'];
    writePack(root, join(root, 'packs', 'channels', 'us-personal-finance'), 'visual-tokens.json', broken);
    assert.throws(() => loadChannelVisualTokens(root, 'us-personal-finance'), /không hợp lệ theo contract/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('layoutIdsFor không lẫn layout ngang với layout dọc', () => {
  const layouts: GenreLayouts = {
    genre: 'data-explainer',
    version: '1.1',
    orientation: { landscape: { width: 1, height: 1 }, vertical: { width: 1, height: 1 } },
    landscapeLayouts: [{ id: 'a', wave: 1, variants: ['x'] }, { id: 'b', wave: 1, variants: ['x'] }],
    verticalLayouts: [{ id: 'v-a', wave: 1, variants: ['x'] }],
  };
  assert.deepEqual(layoutIdsFor(layouts, 'landscape'), ['a', 'b']);
  assert.deepEqual(layoutIdsFor(layouts, 'vertical'), ['v-a']);
});

test('kho thật của repo: packs/genres/data-explainer/layouts.json và packs/channels/us-personal-finance/visual-tokens.json nạp được', () => {
  const repoRoot = new URL('../..', import.meta.url).pathname;
  const layouts = loadGenreLayouts(repoRoot, 'data-explainer');
  assert.ok(layoutIdsFor(layouts, 'landscape').length > 0);
  assert.ok(layoutIdsFor(layouts, 'vertical').length > 0);
  const tokens = loadChannelVisualTokens(repoRoot, 'us-personal-finance');
  assert.equal(tokens.channel, 'us-personal-finance');
});

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
