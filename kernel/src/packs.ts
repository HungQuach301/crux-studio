/**
 * Nạp cấu hình theo thể loại và theo kênh (CHARTER 5.1).
 *
 * kernel chỉ biết CÁCH nạp, không biết nội dung. Mọi hằng số nội dung —
 * ngưỡng, layout, từ điển, giọng đọc — nằm trong `packs/`, không nằm ở đây.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readingTableSchema } from './contracts.ts';
import { assertValid } from './validate.ts';

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
