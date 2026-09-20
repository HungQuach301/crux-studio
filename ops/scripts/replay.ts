#!/usr/bin/env node
/**
 * Tập vàng chạy lại (CHARTER 6.1).
 *
 * Chạy trọn chuỗi ở chế độ replay — không gọi API — và so output của TỪNG
 * xưởng với snapshot. Mốc thời gian lấy từ `manifest.json` nên hai lần chạy
 * phải cho ra byte giống hệt nhau; lệch một byte là lệch.
 *
 * `--update` ghi lại snapshot. Chỉ được dùng trong một PR RIÊNG, có giải
 * thích vì sao output đổi. Đây là cổng chống trôi chất lượng, không phải
 * một bước dọn dẹp.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { WORKSHOPS, Cassette, type CassetteEntry, type WorkshopName } from '@crux/kernel';
import { runEpisode } from './pipeline.ts';

interface GoldenManifest {
  episodeId: string;
  channel: string;
  at: string;
  impl: 'stub' | 'v1';
  note?: string;
}

const root = process.cwd();
const goldenRoot = join(root, 'ops', 'golden');
const update = process.argv.includes('--update');

const episodes = existsSync(goldenRoot)
  ? readdirSync(goldenRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

if (episodes.length === 0) {
  process.stderr.write('Không có tập vàng nào trong ops/golden/.\n');
  process.exit(1);
}

let failed = 0;

for (const dir of episodes) {
  const base = join(goldenRoot, dir);
  const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8')) as GoldenManifest;
  const cassettePath = join(base, 'cassette.json');
  const entries: CassetteEntry[] = existsSync(cassettePath)
    ? (JSON.parse(readFileSync(cassettePath, 'utf8')) as CassetteEntry[])
    : [];

  const result = await runEpisode({
    root,
    episodeId: manifest.episodeId,
    channel: manifest.channel,
    at: manifest.at,
    impl: manifest.impl,
    cassette: new Cassette('replay', entries),
  });

  for (const name of WORKSHOPS as readonly WorkshopName[]) {
    const snapshotPath = join(base, 'snapshots', `${name}.json`);
    const actual = `${JSON.stringify(result.artifacts[name], null, 2)}\n`;

    if (update) {
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, actual, 'utf8');
      continue;
    }

    if (!existsSync(snapshotPath)) {
      process.stderr.write(`✗ ${dir}/${name}: thiếu snapshot. Chạy \`pnpm replay -- --update\`.\n`);
      failed += 1;
      continue;
    }

    const expected = readFileSync(snapshotPath, 'utf8');
    if (expected === actual) {
      process.stdout.write(`✓ ${dir}/${name}\n`);
    } else {
      failed += 1;
      process.stderr.write(`✗ ${dir}/${name}: output lệch snapshot.\n${firstDiff(expected, actual)}\n`);
    }
  }
}

function firstDiff(expected: string, actual: string): string {
  const a = expected.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      return `  dòng ${i + 1}\n  snapshot: ${a[i] ?? '<hết file>'}\n  hiện tại: ${b[i] ?? '<hết file>'}`;
    }
  }
  return '  (khác ở phần cuối file)';
}

if (update) {
  process.stdout.write('Đã ghi lại snapshot tập vàng. Nhớ giải thích trong PR vì sao output đổi.\n');
  process.exit(0);
}

process.stdout.write(failed === 0 ? '\nTập vàng khớp snapshot.\n' : `\n${failed} snapshot lệch.\n`);
process.exit(failed === 0 ? 0 : 1);
