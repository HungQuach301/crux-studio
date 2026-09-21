/**
 * Nạp cấu hình theo thể loại và theo kênh (CHARTER 5.1).
 *
 * kernel chỉ biết CÁCH nạp, không biết nội dung. Mọi hằng số nội dung —
 * ngưỡng, layout, từ điển, giọng đọc — nằm trong `packs/`, không nằm ở đây.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
