/**
 * Kho artifact văn bản: `episodes/<channel>/<id>/<workshop>/artifact.json`
 * (CHARTER 5.3). Mỗi xưởng CHỈ ghi vùng của mình. Trạng thái tổng của tập
 * được dẫn xuất từ các vùng đó, không ai ghi tay.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Envelope, WorkshopName } from './envelope.ts';
import { assertArtifact } from './contracts.ts';

export function artifactPath(
  root: string,
  channel: string,
  episodeId: string,
  workshop: WorkshopName,
): string {
  return join(root, 'episodes', channel, episodeId, workshop, 'artifact.json');
}

export function writeArtifact(root: string, artifact: Envelope): string {
  assertArtifact(artifact.producer.workshop, artifact);
  const path = artifactPath(root, artifact.channel, artifact.episodeId, artifact.producer.workshop);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return path;
}

export function readArtifact(
  root: string,
  channel: string,
  episodeId: string,
  workshop: WorkshopName,
): Envelope | undefined {
  const path = artifactPath(root, channel, episodeId, workshop);
  if (!existsSync(path)) return undefined;
  const artifact = JSON.parse(readFileSync(path, 'utf8')) as Envelope;
  assertArtifact(workshop, artifact);
  return artifact;
}

/** Trạng thái tổng của một tập, DẪN XUẤT từ vùng của từng xưởng. */
export function deriveEpisodeState(
  artifacts: Partial<Record<WorkshopName, Envelope>>,
  order: readonly WorkshopName[],
): { done: WorkshopName[]; next: WorkshopName | null; costUsd: number } {
  const done: WorkshopName[] = [];
  for (const workshop of order) {
    const artifact = artifacts[workshop];
    if (!artifact || artifact.status !== 'ok') break;
    done.push(workshop);
  }
  const costUsd = Number(
    order
      .map((w) => artifacts[w]?.costUsd ?? 0)
      .reduce((a, b) => a + b, 0)
      .toFixed(6),
  );
  return { done, next: order[done.length] ?? null, costUsd };
}
