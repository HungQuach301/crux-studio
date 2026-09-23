#!/usr/bin/env node
/**
 * Việc số 8 của `pnpm contracts` (mục `kernel/K-002`): mọi file mô hình định
 * lượng đã persist (`workshops/<tên>/data/models/M-*.json`) phải hợp
 * `kernel/contracts/model.schema.json`.
 *
 * Trước mục này, tám file của `topic/T-006` chỉ được kiểm bởi test đơn vị
 * của riêng xưởng `topic` (`models.test.ts`) — không có cổng dùng chung nào
 * canh việc này ở tầng `pnpm contracts`, đúng khoảng trống mà `kernel/K-002`
 * mở ra để lấp.
 *
 * Quét `workshops/*\/data/models/*.json` ở TẦNG ĐẦU — không hardcode tên
 * xưởng (thể loại/kênh nào cũng soát được), không đệ quy vào `cases/`
 * (bằng chứng kiểm cấp 1, không phải mô tả mô hình) hay các file `.md`.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validate, modelSchema } from '@crux/kernel';

/** Mọi file mô tả mô hình đã persist, đường dẫn tuyệt đối, đã sắp tên. */
export function modelDataFiles(root: string): string[] {
  const found: string[] = [];
  const workshopsDir = join(root, 'workshops');
  if (!existsSync(workshopsDir)) return found;
  for (const workshop of readdirSync(workshopsDir, { withFileTypes: true })) {
    if (!workshop.isDirectory()) continue;
    const modelsDir = join(workshopsDir, workshop.name, 'data', 'models');
    if (!existsSync(modelsDir)) continue;
    for (const entry of readdirSync(modelsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        found.push(join(modelsDir, entry.name));
      }
    }
  }
  return found.sort();
}

/** Vấn đề hợp contract của từng file mô hình — rỗng là mọi file đều hợp lệ. */
export function modelDataProblems(root: string): string[] {
  const problems: string[] = [];
  for (const path of modelDataFiles(root)) {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const result = validate(value, modelSchema);
    if (!result.valid) {
      problems.push(
        `${path.slice(root.length + 1)} không hợp kernel/contracts/model.schema.json:\n` +
          result.errors.map((e) => `    ${e.path}: ${e.message}`).join('\n'),
      );
    }
  }
  return problems;
}
