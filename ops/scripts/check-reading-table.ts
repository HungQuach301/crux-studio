#!/usr/bin/env node
/**
 * Kiểm mọi `reading-table.json` dưới `packs/channels/` — mục `audio/AU-007`.
 *
 * Quét theo thư mục (kênh nào cũng soát, không hardcode tên), và với mỗi
 * bảng đọc:
 *  - hợp `kernel/contracts/reading-table.schema.json`;
 *  - `channel` khớp tên thư mục;
 *  - `id` của các luật không trùng nhau;
 *  - `pattern` biên dịch được thành RegExp với `flags` khai (một pattern
 *    hỏng làm bộ chuẩn hoá của xưởng ném lúc chạy — bắt ở đây, sớm hơn).
 *
 * KHÔNG chạy hành vi `pattern`→`replacement` ở đây (ca kiểm từng luật chạy
 * trong test của xưởng, `workshops/audio/test/normalize.test.ts`, nơi có bộ
 * chuẩn hoá): tầng `pnpm contracts` chỉ dựa vào `@crux/kernel`, không nhập
 * mã của xưởng. Việc này kiểm CẤU TRÚC; xưởng kiểm HÀNH VI.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readingTableSchema, validate } from '@crux/kernel';

/** Đường dẫn tương đối gốc repo của các `reading-table.json` đã thấy. */
export function readingTablePackFiles(root: string): string[] {
  const channelsDir = join(root, 'packs', 'channels');
  if (!existsSync(channelsDir)) return [];
  const files: string[] = [];
  for (const slug of readdirSync(channelsDir).sort()) {
    const path = join(channelsDir, slug, 'reading-table.json');
    if (existsSync(path)) files.push(join('packs', 'channels', slug, 'reading-table.json'));
  }
  return files;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Vấn đề gặp khi soát bảng đọc; rỗng là ok. */
export function readingTableProblems(root: string): string[] {
  const channelsDir = join(root, 'packs', 'channels');
  if (!existsSync(channelsDir)) return [];
  const problems: string[] = [];

  for (const slug of readdirSync(channelsDir).sort()) {
    const path = join(channelsDir, slug, 'reading-table.json');
    if (!existsSync(path)) continue;
    const label = join('packs', 'channels', slug, 'reading-table.json');

    let table: unknown;
    try {
      table = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push(`${label}: không đọc được JSON — ${describe(error)}`);
      continue;
    }

    const result = validate(table, readingTableSchema);
    if (!result.valid) {
      problems.push(
        `${label} không hợp reading-table.schema.json:\n${result.errors
          .map((e) => `    ${e.path}: ${e.message}`)
          .join('\n')}`,
      );
      continue;
    }

    const value = table as { channel: string; rules: { id: string; pattern: string; flags?: string }[] };
    if (value.channel !== slug) {
      problems.push(`${label}: khai channel "${value.channel}" nhưng nằm ở thư mục "${slug}".`);
    }

    const seen = new Set<string>();
    for (const rule of value.rules) {
      if (seen.has(rule.id)) {
        problems.push(`${label}: id luật "${rule.id}" bị trùng.`);
      }
      seen.add(rule.id);
      try {
        // eslint-disable-next-line no-new
        new RegExp(rule.pattern, rule.flags && rule.flags.length > 0 ? rule.flags : 'g');
      } catch (error) {
        problems.push(`${label}: luật "${rule.id}" có pattern không biên dịch được — ${describe(error)}`);
      }
    }
  }

  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const problems = readingTableProblems(root);
  if (problems.length > 0) {
    process.stderr.write(`Bảng đọc có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Bảng đọc ok: ${readingTablePackFiles(root).length} reading-table.json.\n`);
}
