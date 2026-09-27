#!/usr/bin/env node
/**
 * Kiểm `workshops/audio/pipeline.v0.json` khớp contract của xưởng Âm thanh
 * — mục `audio/AU-007`, kiến trúc (a).
 *
 * Thứ tự công đoạn nằm trong CONTRACT (máy đọc được), không chỉ trong tài
 * liệu: file dữ liệu phải hợp `workshops/audio/contracts/pipeline.v0.schema.json`
 * VÀ đúng thứ tự chuẩn dưới đây. Một tài liệu prose mô tả sai thứ tự thì
 * không gì đỏ; một file dữ liệu sai thứ tự thì việc này đỏ.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate, type JsonSchema } from '@crux/kernel';

/** Thứ tự chuẩn của công đoạn (kiến trúc (a) của `#193`). */
export const AUDIO_STAGE_ORDER = ['normalize', 'tts', 'verify', 'retry', 'timestamps'] as const;

const PIPELINE_DATA = join('workshops', 'audio', 'pipeline.v0.json');
const PIPELINE_SCHEMA = join('workshops', 'audio', 'contracts', 'pipeline.v0.schema.json');

interface Stage {
  id: string;
  usesProvider: boolean;
  retryParam?: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Vấn đề gặp khi soát pipeline của xưởng audio; rỗng là ok. */
export function audioPipelineProblems(root: string): string[] {
  const dataPath = join(root, PIPELINE_DATA);
  const schemaPath = join(root, PIPELINE_SCHEMA);
  const problems: string[] = [];

  if (!existsSync(dataPath)) return [`${PIPELINE_DATA}: thiếu file mô tả thứ tự công đoạn.`];
  if (!existsSync(schemaPath)) return [`${PIPELINE_SCHEMA}: thiếu contract của pipeline.`];

  let data: unknown;
  let schema: JsonSchema;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (error) {
    return [`${PIPELINE_DATA}: không đọc được JSON — ${describe(error)}`];
  }
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as JsonSchema;
  } catch (error) {
    return [`${PIPELINE_SCHEMA}: không đọc được JSON — ${describe(error)}`];
  }

  const result = validate(data, schema);
  if (!result.valid) {
    return [
      `${PIPELINE_DATA} không hợp pipeline.v0.schema.json:\n${result.errors
        .map((e) => `    ${e.path}: ${e.message}`)
        .join('\n')}`,
    ];
  }

  const value = data as { runsBefore: string; stages: Stage[] };
  const order = value.stages.map((s) => s.id);
  if (JSON.stringify(order) !== JSON.stringify([...AUDIO_STAGE_ORDER])) {
    problems.push(
      `${PIPELINE_DATA}: thứ tự công đoạn ${JSON.stringify(order)} khác thứ tự chuẩn ${JSON.stringify([
        ...AUDIO_STAGE_ORDER,
      ])}.`,
    );
  }
  if (value.runsBefore !== 'storyboard-preflight') {
    problems.push(`${PIPELINE_DATA}: runsBefore phải là "storyboard-preflight" (chạy trước cổng hình).`);
  }

  const normalize = value.stages.find((s) => s.id === 'normalize');
  if (normalize && normalize.usesProvider !== false) {
    problems.push(`${PIPELINE_DATA}: công đoạn "normalize" phải usesProvider=false (chạy được khi providers.tts null).`);
  }
  const retry = value.stages.find((s) => s.id === 'retry');
  if (retry && retry.retryParam !== 'R7d') {
    problems.push(`${PIPELINE_DATA}: công đoạn "retry" phải khai retryParam "R7d".`);
  }

  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const problems = audioPipelineProblems(root);
  if (problems.length > 0) {
    process.stderr.write(`Pipeline audio có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Pipeline audio ok: ${AUDIO_STAGE_ORDER.length} công đoạn đúng thứ tự.\n`);
}
