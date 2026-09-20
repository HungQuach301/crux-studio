/**
 * Bất biến I8: mọi lần chạy stage và mọi lần chạy làn đều ghi MỘT dòng log
 * có `costUsd`. Log append-only, phân vùng theo làn: `ops/logs/<lane>.jsonl`.
 * Phân vùng là cái giữ cho hai làn chạy song song không đụng nhau (CHARTER 7).
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LaneName } from './envelope.ts';

export interface RunLogLine {
  at: string;
  lane: LaneName;
  kind: 'stage' | 'lane';
  ref: string;
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  costUsd: number;
  note?: string;
}

export function formatLogLine(line: RunLogLine): string {
  return JSON.stringify({
    at: line.at,
    lane: line.lane,
    kind: line.kind,
    ref: line.ref,
    status: line.status,
    durationMs: line.durationMs,
    costUsd: line.costUsd,
    ...(line.note === undefined ? {} : { note: line.note }),
  });
}

export function appendRunLog(logPath: string, line: RunLogLine): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${formatLogLine(line)}\n`, 'utf8');
}
