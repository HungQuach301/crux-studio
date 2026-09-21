#!/usr/bin/env node
/**
 * `pnpm run:episode -- --episode <id>` — chạy trọn một tập qua sáu xưởng,
 * ghi artifact vào `episodes/<channel>/<id>/<workshop>/artifact.json` và ghi
 * một dòng log có `costUsd` vào `ops/logs/<lane>/<id>.jsonl` (bất biến I8,
 * quyết định `D-C04`). Đơn vị phân vùng là **mục**: ở đây mã tập đóng vai
 * mã mục, nên hai tập chạy song song không chạm cùng một file.
 */

import { writeArtifact, appendRunLog, runLogPath, deriveEpisodeState, systemClock } from '@crux/kernel';
import { runEpisode } from './pipeline.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const root = arg('root', process.cwd())!;
const episodeId = arg('episode');
const channel = arg('channel', 'us-personal-finance')!;
const at = arg('at');

if (!episodeId) {
  process.stderr.write('Cần --episode <id>.\n');
  process.exit(2);
}

const result = await runEpisode({ root, episodeId, channel, ...(at ? { at } : {}) });

for (const name of result.order) {
  const artifact = result.artifacts[name];
  const path = writeArtifact(root, artifact);
  appendRunLog(runLogPath(root, name, episodeId), {
    at: artifact.createdAt,
    lane: name,
    kind: 'stage',
    ref: `${episodeId}/${name}`,
    status: artifact.status,
    durationMs: 0,
    costUsd: artifact.costUsd,
  });
  process.stdout.write(`${name.padEnd(10)} → ${path}\n`);
}

const state = deriveEpisodeState(result.artifacts, result.order);
appendRunLog(runLogPath(root, 'integration', episodeId), {
  at: at ?? systemClock.now(),
  lane: 'integration',
  kind: 'lane',
  ref: `${episodeId}/full-chain`,
  status: state.next === null ? 'ok' : 'failed',
  durationMs: result.durationMs,
  costUsd: state.costUsd,
  note: `xong ${state.done.length}/${result.order.length} xưởng`,
});

process.stdout.write(
  `\nXong ${state.done.length}/${result.order.length} xưởng · costUsd ${state.costUsd} · ${result.durationMs}ms\n`,
);
if (state.next !== null) {
  process.stderr.write(`Chuỗi dừng trước xưởng ${state.next}.\n`);
  process.exit(1);
}
