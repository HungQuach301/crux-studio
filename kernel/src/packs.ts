/**
 * Nạp cấu hình theo thể loại và theo kênh (CHARTER 5.1).
 *
 * kernel chỉ biết CÁCH nạp, không biết nội dung. Mọi hằng số nội dung —
 * ngưỡng, layout, từ điển, giọng đọc — nằm trong `packs/`, không nằm ở đây.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
