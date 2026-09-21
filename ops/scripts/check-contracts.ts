#!/usr/bin/env node
/**
 * Tự kiểm bộ contract (CHARTER: contract-first — không stage nào được viết
 * trước khi contract của nó tồn tại và VALIDATE ĐƯỢC).
 *
 * Bảy việc:
 * 1. Mỗi xưởng có đúng một file payload v0.
 * 2. Không schema nào dùng từ khoá mà validator của kernel chưa hiểu — nếu
 *    không, một ràng buộc có thể im lặng không được kiểm.
 * 3. Phong bì giữ đủ các trường của CHARTER 5.2, không thừa không thiếu.
 * 4. Mọi fixture của xưởng và mọi snapshot tập vàng đều hợp contract.
 * 5. Fixture `input.json` nạp pack từ `packs/` và không mang bản sao cấu
 *    hình (`ops/scripts/check-fixtures.ts`, mục `integration/I-008` và `I-009`).
 * 6. `layouts.json` của mỗi genre pack đã có hợp `layouts.schema.json` (mục V-001).
 * 7. `visual-tokens.json` của mỗi channel pack hợp `visual-tokens.schema.json` (mục V-001).
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
  loadGenreLayouts,
  loadChannelVisualTokens,
  layoutsSchema,
  visualTokensSchema,
  type WorkshopName,
} from '@crux/kernel';
import { fixtureInputCount, fixtureInputProblems } from './check-fixtures.ts';

const root = process.cwd();
const problems: string[] = [];

// 2 · Từ khoá schema
for (const [name, schema] of [
  ['envelope', envelopeSchema] as const,
  ...WORKSHOPS.map((w) => [`${w}.payload.v0`, payloadSchemas[w]] as const),
  ['layouts.schema', layoutsSchema] as const,
  ['visual-tokens.schema', visualTokensSchema] as const,
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

// 6 · layouts.json của mỗi genre pack đã tồn tại (mục V-001). Genre nào
// chưa có layouts.json thì bỏ qua — chưa tới lượt genre đó, không phải lỗi.
let genresChecked = 0;
const genresDir = join(root, 'packs', 'genres');
if (existsSync(genresDir)) {
  for (const genre of readdirSync(genresDir)) {
    if (!existsSync(join(genresDir, genre, 'layouts.json'))) continue;
    genresChecked += 1;
    try {
      loadGenreLayouts(root, genre);
    } catch (error) {
      problems.push(`packs/genres/${genre}/layouts.json: ${(error as Error).message}`);
    }
  }
}

// 7 · visual-tokens.json của mỗi channel pack (mục V-001).
let channelsChecked = 0;
const channelsDir = join(root, 'packs', 'channels');
if (existsSync(channelsDir)) {
  for (const slug of readdirSync(channelsDir)) {
    if (!existsSync(join(channelsDir, slug, 'visual-tokens.json'))) continue;
    channelsChecked += 1;
    try {
      loadChannelVisualTokens(root, slug);
    } catch (error) {
      problems.push(`packs/channels/${slug}/visual-tokens.json: ${(error as Error).message}`);
    }
  }
}

if (problems.length > 0) {
  process.stderr.write(`Contract có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Contract ok: phong bì + ${WORKSHOPS.length} payload v0, ${checked} artifact hợp lệ, ` +
    `${fixtureInputCount(root)} fixture --input nạp pack từ packs/ và artifact đầu vào từ tập vàng, ` +
    `${genresChecked} layouts.json, ${channelsChecked} visual-tokens.json.\n`,
);
