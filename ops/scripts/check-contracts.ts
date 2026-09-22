#!/usr/bin/env node
/**
 * Tự kiểm bộ contract (CHARTER: contract-first — không stage nào được viết
 * trước khi contract của nó tồn tại và VALIDATE ĐƯỢC).
 *
 * Sáu việc:
 * 1. Mỗi xưởng có đúng một file payload v0.
 * 2. Không schema nào dùng từ khoá mà validator của kernel chưa hiểu — nếu
 *    không, một ràng buộc có thể im lặng không được kiểm.
 * 3. Phong bì giữ đủ các trường của CHARTER 5.2, không thừa không thiếu.
 * 4. Mọi fixture của xưởng và mọi snapshot tập vàng đều hợp contract.
 * 5. Fixture `input.json` nạp pack từ `packs/` và không mang bản sao cấu
 *    hình (`ops/scripts/check-fixtures.ts`, mục `integration/I-008` và `I-009`).
 * 6. Contract của xưởng (`workshops/<tên>/contracts/`) chịu cùng phép kiểm
 *    từ khoá như contract của kernel — mục `integration/I-013`. Trước mục
 *    đó, việc số 2 chỉ nhìn `kernel/contracts/`, nên một contract xưởng
 *    dùng từ khoá validator chưa hiểu không làm gì đỏ.
 * 7. Không `*.schema.json` nào trốn ngoài `contracts/` — mục
 *    `integration/I-014`. Việc 6 vẫn buộc phạm vi bằng quy ước thư mục: một
 *    schema thả ở `workshops/<tên>/src/` hay `packs/**` thoát cả việc 2 lẫn
 *    việc 6. Việc này buộc nó phải nằm trong `contracts/`, bằng phép kiểm.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  WORKSHOPS,
  ENVELOPE_FIELDS,
  envelopeSchema,
  payloadSchemas,
  artifactSchemas,
  validateArtifact,
  unsupportedKeywords,
  type WorkshopName,
} from '@crux/kernel';
import { fixtureInputCount, fixtureInputProblems } from './check-fixtures.ts';
import { scanWorkshopContracts, scanStraySchemas } from './check-workshop-contracts.ts';

const root = process.cwd();
const problems: string[] = [];

// 2 · Từ khoá schema
for (const [name, schema] of [
  ['envelope', envelopeSchema] as const,
  ...WORKSHOPS.map((w) => [`${w}.payload.v0`, payloadSchemas[w]] as const),
]) {
  const unknown = unsupportedKeywords(schema);
  if (unknown.length > 0) {
    problems.push(`${name}: dùng từ khoá validator chưa hỗ trợ: ${unknown.join(', ')}`);
  }
}

// 3 · Phong bì
const envelopeProps = Object.keys((envelopeSchema['properties'] ?? {}) as object).sort();
const expected = [...ENVELOPE_FIELDS].sort();
if (JSON.stringify(envelopeProps) !== JSON.stringify(expected)) {
  problems.push(
    `Phong bì lệch CHARTER 5.2.\n  schema:  ${envelopeProps.join(', ')}\n  mong đợi: ${expected.join(', ')}`,
  );
}
if (envelopeSchema['additionalProperties'] !== false) {
  problems.push('Phong bì phải đóng (additionalProperties: false) — đây là ranh giới bất biến.');
}

// 1 + payload để lỏng
for (const workshop of WORKSHOPS) {
  const schema = payloadSchemas[workshop];
  if (!schema) {
    problems.push(`Thiếu contract v0 của xưởng ${workshop}.`);
    continue;
  }
  if (schema['additionalProperties'] === false) {
    problems.push(
      `payload của xưởng ${workshop} bị đóng. Contract v0 phải LỎNG: cho phép thêm trường (CHARTER 5.2).`,
    );
  }
  if (!Array.isArray(schema['required']) || (schema['required'] as unknown[]).length === 0) {
    problems.push(`payload của xưởng ${workshop} không khai trường bắt buộc nào.`);
  }
  const kindSchema = (artifactSchemas[workshop]['properties'] as Record<string, { const?: string }>)['kind'];
  if (typeof kindSchema?.const !== 'string') {
    problems.push(`Artifact của xưởng ${workshop} không khoá được trường kind.`);
  }
}

// 4 · Fixture và snapshot tập vàng
let checked = 0;
function checkArtifactFile(workshop: WorkshopName, label: string, path: string): void {
  checked += 1;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const result = validateArtifact(workshop, value);
  if (!result.valid) {
    problems.push(
      `${label} không hợp contract:\n${result.errors.map((e) => `    ${e.path}: ${e.message}`).join('\n')}`,
    );
  }
}

for (const workshop of WORKSHOPS as readonly WorkshopName[]) {
  const dir = join(root, 'workshops', workshop, 'fixtures');
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.artifact.json')) continue;
    checkArtifactFile(workshop, `Fixture ${workshop}/${file}`, join(dir, file));
  }
}

const goldenRoot = join(root, 'ops', 'golden');
if (existsSync(goldenRoot)) {
  for (const episode of readdirSync(goldenRoot)) {
    const snapshots = join(goldenRoot, episode, 'snapshots');
    if (!existsSync(snapshots)) continue;
    for (const workshop of WORKSHOPS as readonly WorkshopName[]) {
      const path = join(snapshots, `${workshop}.json`);
      if (!existsSync(path)) continue;
      checkArtifactFile(workshop, `Snapshot ${episode}/${workshop}`, path);
    }
  }
}

// 5 · Fixture input.json không mang bản sao cấu hình
problems.push(...fixtureInputProblems(root));

// 6 · Contract của xưởng — một lượt quét cho cả số đếm lẫn danh sách vấn đề
const workshopContracts = scanWorkshopContracts(root);
problems.push(...workshopContracts.problems);

// 7 · Schema lạc chỗ ngoài contracts/ (mục integration/I-014)
problems.push(...scanStraySchemas(root));

if (problems.length > 0) {
  process.stderr.write(`Contract có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Contract ok: phong bì + ${WORKSHOPS.length} payload v0, ${workshopContracts.files.length} contract xưởng, ` +
    `${checked} artifact hợp lệ, ` +
    `${fixtureInputCount(root)} fixture --input nạp pack từ packs/ và artifact đầu vào từ tập vàng.\n`,
);
