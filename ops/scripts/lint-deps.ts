#!/usr/bin/env node
/**
 * BẤT BIẾN I3 — máy chặn.
 *
 * Xưởng không import code của xưởng khác, chỉ import `kernel/`. Ranh giới
 * giữa sáu xưởng là thứ cho phép chúng được xây song song và tách ra thành
 * repo riêng sau này (CHARTER 5.5); một lần import chéo là đủ để mất cả hai.
 *
 * Ngoại lệ DUY NHẤT: `ops/scripts/pipeline.ts` — lớp điều phối, nơi thứ tự
 * chạy được quyết định. Ngoại lệ này được khai ở đây, không phải ở chỗ khác.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const WORKSHOPS = ['topic', 'editorial', 'visual', 'audio', 'assembly', 'release'];
const ORCHESTRATOR = join('ops', 'scripts', 'pipeline.ts');

const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]/g;

interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

function specifiersOf(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec) found.push(spec);
  }
  return found;
}

const violations: Violation[] = [];

for (const workshop of WORKSHOPS) {
  const dir = join(root, 'workshops', workshop);
  for (const file of walk(dir)) {
    const rel = relative(root, file);
    for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
      const other = WORKSHOPS.find(
        (w) => w !== workshop && (spec === `@crux/workshop-${w}` || spec.includes(`workshops/${w}/`)),
      );
      if (other) {
        violations.push({
          file: rel,
          specifier: spec,
          reason: `xưởng ${workshop} import xưởng ${other}`,
        });
      }
      if (spec.startsWith('@crux/') && spec !== '@crux/kernel' && !spec.startsWith('@crux/workshop-')) {
        violations.push({ file: rel, specifier: spec, reason: 'xưởng chỉ được import @crux/kernel' });
      }
      if (spec.includes('../../kernel/') || spec.includes('/kernel/src/')) {
        violations.push({
          file: rel,
          specifier: spec,
          reason: 'import kernel qua đường dẫn tương đối; dùng @crux/kernel',
        });
      }
    }
  }
}

// Lớp điều phối được phép import nhiều xưởng — nhưng chỉ đúng một file.
for (const file of walk(join(root, 'ops'))) {
  const rel = relative(root, file);
  if (rel === ORCHESTRATOR) continue;
  const imported = specifiersOf(readFileSync(file, 'utf8')).filter((s) =>
    s.startsWith('@crux/workshop-'),
  );
  if (imported.length > 1) {
    violations.push({
      file: rel,
      specifier: imported.join(', '),
      reason: `chỉ ${ORCHESTRATOR} được import nhiều xưởng`,
    });
  }
}

if (violations.length > 0) {
  process.stderr.write('Vi phạm bất biến I3 (ranh giới xưởng):\n');
  for (const v of violations) {
    process.stderr.write(`  ${v.file}: "${v.specifier}" — ${v.reason}\n`);
  }
  process.exit(1);
}

process.stdout.write('I3 ok: không có import chéo giữa các xưởng.\n');
