/**
 * Nạp cấu hình theo thể loại và theo kênh (CHARTER 5.1).
 *
 * kernel chỉ biết CÁCH nạp, không biết nội dung. Mọi hằng số nội dung —
 * ngưỡng, layout, từ điển, giọng đọc — nằm trong `packs/`, không nằm ở đây.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readingTableSchema } from './contracts.ts';
import { assertValid, type JsonSchema } from './validate.ts';

export interface ChannelPack {
  slug: string;
  genre: string;
  locale: string;
  [key: string]: unknown;
}

export interface GenrePack {
  genre: string;
  limits: Record<string, unknown>;
  [key: string]: unknown;
}

export function loadChannelPack(root: string, slug: string): ChannelPack {
  const path = join(root, 'packs', 'channels', slug, 'channel.json');
  const pack = JSON.parse(readFileSync(path, 'utf8')) as ChannelPack;
  if (pack.slug !== slug) {
    throw new Error(`channel.json khai slug "${pack.slug}" nhưng nằm ở thư mục "${slug}".`);
  }
  return pack;
}

export function loadGenrePack(root: string, genre: string): GenrePack {
  const path = join(root, 'packs', 'genres', genre, 'format-spec.json');
  const pack = JSON.parse(readFileSync(path, 'utf8')) as GenrePack;
  if (pack.genre !== genre) {
    throw new Error(`format-spec.json khai genre "${pack.genre}" nhưng nằm ở thư mục "${genre}".`);
  }
  return pack;
}

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

function loadSchema(name: string): JsonSchema {
  return JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as JsonSchema;
}

export const layoutsSchema: JsonSchema = loadSchema('layouts.schema.json');
export const visualTokensSchema: JsonSchema = loadSchema('visual-tokens.schema.json');

export interface GenreLayoutEntry {
  id: string;
  wave: number;
  maxPerEpisode?: number;
  variants: string[];
  propsSchema?: Record<string, unknown>;
}

export interface GenreLayouts {
  genre: string;
  version: string;
  orientation: {
    landscape: { width: number; height: number };
    vertical: { width: number; height: number };
  };
  landscapeLayouts: GenreLayoutEntry[];
  verticalLayouts: GenreLayoutEntry[];
  countingRule?: string;
  [key: string]: unknown;
}

export interface ChannelVisualTokens {
  channel: string;
  version: string;
  colors: Record<string, string>;
  typography: Record<string, unknown>;
  grid: Record<string, unknown>;
  motion: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Nạp `layouts.json` của một genre pack (mục `V-001`). Danh sách layout hợp
 * lệ mà Preflight đối chiếu `layoutId` — xem `layoutIdsFor` và
 * `workshops/assembly/src/preflight.ts` (check `layout-id-known`).
 */
export function loadGenreLayouts(root: string, genre: string): GenreLayouts {
  const path = join(root, 'packs', 'genres', genre, 'layouts.json');
  const layouts = JSON.parse(readFileSync(path, 'utf8')) as GenreLayouts;
  assertValid(layouts, layoutsSchema, `layouts.json của genre "${genre}"`);
  if (layouts.genre !== genre) {
    throw new Error(`layouts.json khai genre "${layouts.genre}" nhưng nằm ở thư mục "${genre}".`);
  }
  return layouts;
}

/** Nạp `visual-tokens.json` của một channel pack (mục `V-001`). */
export function loadChannelVisualTokens(root: string, slug: string): ChannelVisualTokens {
  const path = join(root, 'packs', 'channels', slug, 'visual-tokens.json');
  const tokens = JSON.parse(readFileSync(path, 'utf8')) as ChannelVisualTokens;
  assertValid(tokens, visualTokensSchema, `visual-tokens.json của kênh "${slug}"`);
  if (tokens.channel !== slug) {
    throw new Error(`visual-tokens.json khai channel "${tokens.channel}" nhưng nằm ở thư mục "${slug}".`);
  }
  return tokens;
}

/** ID layout hợp lệ của một hướng khung hình, dùng để đối chiếu `layoutId` ở Preflight. */
export function layoutIdsFor(layouts: GenreLayouts, orientation: 'landscape' | 'vertical'): string[] {
  const list = orientation === 'landscape' ? layouts.landscapeLayouts : layouts.verticalLayouts;
  return list.map((l) => l.id);
}

/**
 * Danh sách khuôn tiêu đề của một kênh (mục `release/R-001`). File này KHÔNG
 * có trong spec gốc — thêm để `titles[].formula` của xưởng `release` đối
 * chiếu được với một danh sách thật, thay vì chấp nhận mọi chuỗi.
 */
export interface TitleFormulasPack {
  channel: string;
  formulas: { id: string; name: string }[];
}

export function loadChannelTitleFormulas(root: string, slug: string): TitleFormulasPack {
  const path = join(root, 'packs', 'channels', slug, 'title-formulas.json');
  const pack = JSON.parse(readFileSync(path, 'utf8')) as TitleFormulasPack;
  if (pack.channel !== slug) {
    throw new Error(`title-formulas.json khai channel "${pack.channel}" nhưng nằm ở thư mục "${slug}".`);
  }
  return pack;
}

export function titleFormulaIdsFor(pack: TitleFormulasPack): Set<string> {
  return new Set(pack.formulas.map((f) => f.id));
}

/** Một luật đọc: cặp `pattern`→`replacement` kèm một ca kiểm (mục `audio/AU-007`). */
export interface ReadingRule {
  id: string;
  description?: string;
  pattern: string;
  /** Cờ RegExp; bộ chuẩn hoá tự dùng `'g'` khi bỏ trống. */
  flags?: string;
  replacement: string;
  test: { input: string; expected: string };
}

/** Bảng đọc của một kênh — dữ liệu, cấu trúc trung tính (mục `audio/AU-007`). */
export interface ChannelReadingTable {
  channel: string;
  rules: ReadingRule[];
  [key: string]: unknown;
}

/**
 * Nạp bảng đọc của một kênh và VALIDATE ngay theo
 * `kernel/contracts/reading-table.schema.json` — khác `loadChannelPack`
 * (chỉ đối chiếu slug), vì một bảng đọc sai cấu trúc sẽ làm bộ chuẩn hoá
 * hỏng âm thầm. Không gọi nhà cung cấp nào; đọc thuần file (mục `audio/AU-007`).
 */
export function loadChannelReadingTable(root: string, slug: string): ChannelReadingTable {
  const path = join(root, 'packs', 'channels', slug, 'reading-table.json');
  const table = JSON.parse(readFileSync(path, 'utf8')) as ChannelReadingTable;
  assertValid(table, readingTableSchema, `reading-table.json của kênh ${slug}`);
  if (table.channel !== slug) {
    throw new Error(`reading-table.json khai channel "${table.channel}" nhưng nằm ở thư mục "${slug}".`);
  }
  return table;
}

/** Chỉ danh sách luật đọc của một kênh — lối tắt cho bộ chuẩn hoá của xưởng. */
export function readingRulesFor(root: string, slug: string): ReadingRule[] {
  return loadChannelReadingTable(root, slug).rules;
}
