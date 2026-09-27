#!/usr/bin/env node
/**
 * Tự kiểm bộ contract (CHARTER: contract-first — không stage nào được viết
 * trước khi contract của nó tồn tại và VALIDATE ĐƯỢC).
 *
 * Mười ba việc:
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
 * 7. MỌI `*.schema.json` dưới `workshops/` và `packs/` chịu phép kiểm từ
 *    khoá, dù nằm ở thư mục nào — mục `integration/I-014`. Việc số 6 dừng ở
 *    quy ước thư mục `contracts/`; một schema đặt ngoài đó (ở `src/`, ở
 *    `packs/**`) vẫn thoát. Việc này quét phần còn lại để phạm vi kiểm buộc
 *    bằng một phép kiểm, không bằng chỗ đặt file.
 * 8. Mọi file mô hình định lượng đã persist (`workshops/*\/data/models/*.json`)
 *    hợp `kernel/contracts/model.schema.json` — mục `kernel/K-002`. Trước
 *    mục đó, tám file của `topic/T-006` chỉ được test đơn vị của riêng
 *    xưởng `topic` canh, không có cổng dùng chung nào ở tầng `pnpm contracts`.
 * 9. `layouts.json` của mỗi genre pack đã có hợp `layouts.schema.json` (mục V-001).
 * 10. `visual-tokens.json` của mỗi channel pack hợp `visual-tokens.schema.json` (mục V-001).
 * 11. Mỗi `title-formulas.json` dưới `packs/channels/` hợp contract và không
 *    có `id` trùng; `titles[].formula` của artifact `release` đối chiếu
 *    được với danh sách thật của đúng kênh nó khai — mục `release/R-001`.
 * 12. Fact & Risk Pass trên tập vàng (mục `editorial/E-002`, bất biến I6).
 * 13. Channel Pack khai đủ `revenueWithholding` (mục `topic/T-013`, bất biến I6).
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
import { scanWorkshopContracts } from './check-workshop-contracts.ts';
import { scanSchemaScope } from './check-schema-scope.ts';
import { modelDataFiles, modelDataProblems } from './check-models.ts';
import {
  allTitleFormulasPackProblems,
  releaseFormulaProblems,
  type ReleaseArtifactForFormulaCheck,
} from './check-title-formulas.ts';
import { scanGoldenFactRisk } from './check-fact-risk.ts';
import { revenueWithholdingProblems, channelPackFiles } from './check-revenue-withholding.ts';
import { readingTableProblems, readingTablePackFiles } from './check-reading-table.ts';
import { audioPipelineProblems, AUDIO_STAGE_ORDER } from './check-audio-pipeline.ts';

const root = process.cwd();
const problems: string[] = [];
/** Ghi nhận không chặn (chỉ ở `impl: stub`) — in ra cuối, tách khỏi `problems`. */
const notes: string[] = [];

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
const releaseFormulaNotes: string[] = [];
function checkArtifactFile(workshop: WorkshopName, label: string, path: string): void {
  checked += 1;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const result = validateArtifact(workshop, value);
  if (!result.valid) {
    problems.push(
      `${label} không hợp contract:\n${result.errors.map((e) => `    ${e.path}: ${e.message}`).join('\n')}`,
    );
    return;
  }
  if (workshop === 'release') {
    const { problems: formulaProblems, notes } = releaseFormulaProblems(
      root,
      label,
      value as ReleaseArtifactForFormulaCheck,
    );
    problems.push(...formulaProblems);
    releaseFormulaNotes.push(...notes);
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

// 7 · Mọi schema dưới workshops/ và packs/ ngoài tầm việc số 6 vẫn phải qua
// phép kiểm từ khoá — phạm vi buộc bằng phép kiểm, không bằng chỗ đặt file.
const schemaScope = scanSchemaScope(root);
problems.push(...schemaScope.problems);

// 8 · File mô hình định lượng đã persist hợp kernel/contracts/model.schema.json
const modelFiles = modelDataFiles(root);
problems.push(...modelDataProblems(root));

// 9 · layouts.json của mỗi genre pack đã tồn tại (mục V-001). Genre nào
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

// 10 · visual-tokens.json của mỗi channel pack (mục V-001).
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

// 11 · title-formulas.json của mỗi kênh (mục release/R-001) — kênh nào cũng soát, không hardcode tên
const titleFormulas = allTitleFormulasPackProblems(root);
problems.push(...titleFormulas.problems);

// 12 · Fact & Risk Pass (editorial/E-002, bất biến I6): mọi con số trong lời
// thoại truy được về claimId, và số phản biện đạt ngưỡng genre pack. Chặn thật
// khi artifact do lượt chạy `impl != stub` sinh ra; ở stub chỉ GHI NHẬN, để
// tập vàng stub giữ nguyên (CHARTER 6.1). Khâu định tuyến chặn/ghi-nhận nằm
// trong `scanGoldenFactRisk` để có test đứng độc lập.
const factRisk = scanGoldenFactRisk(root);
problems.push(...factRisk.blocking);
notes.push(...factRisk.notes);

// 13 · Khấu trừ doanh thu (topic/T-013, bất biến I6): mỗi Channel Pack khai
// `revenueWithholding` đủ và đúng, và không chỗ code nào ước tính doanh thu mà
// bỏ qua hệ số. Logic thuần ở check-revenue-withholding.ts để có test độc lập.
problems.push(...revenueWithholdingProblems(root));

// 11 · Bảng đọc của kênh (audio/AU-007, bất biến I6 — cách đọc số/viết tắt là
// dữ liệu của kênh): mỗi reading-table.json hợp contract, channel khớp thư mục,
// id không trùng, pattern biên dịch được. Logic thuần ở check-reading-table.ts
// để có test độc lập; ca kiểm HÀNH VI từng luật nằm trong test của xưởng audio.
problems.push(...readingTableProblems(root));

// 12 · Thứ tự công đoạn của xưởng audio (audio/AU-007, kiến trúc (a)):
// workshops/audio/pipeline.v0.json hợp contract của nó VÀ đúng thứ tự chuẩn.
problems.push(...audioPipelineProblems(root));

if (problems.length > 0) {
  process.stderr.write(`Contract có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}

if (releaseFormulaNotes.length > 0) {
  process.stdout.write(
    `Ghi nhận, không chặn (impl: stub — nối chặt là việc của release/R-005):\n` +
      `${releaseFormulaNotes.map((m) => `  - ${m}`).join('\n')}\n`,
  );
}

process.stdout.write(
  `Contract ok: phong bì + ${WORKSHOPS.length} payload v0, ${workshopContracts.files.length} contract xưởng, ` +
    `${schemaScope.files.length} schema ngoài contracts/ (workshops+packs) qua phép kiểm từ khoá, ` +
    `${checked} artifact hợp lệ, ` +
    `${titleFormulas.checked} title-formulas.json, ` +
    `${fixtureInputCount(root)} fixture --input nạp pack từ packs/ và artifact đầu vào từ tập vàng, ` +
    `${modelFiles.length} file mô hình định lượng hợp model.schema.json, ` +
    `${genresChecked} layouts.json, ${channelsChecked} visual-tokens.json, ` +
    `Fact & Risk Pass qua ${factRisk.episodes} tập vàng, ` +
    `khấu trừ doanh thu khai đủ trên ${channelPackFiles(root).length} channel pack (topic/T-013), ` +
    `${readingTablePackFiles(root).length} reading-table.json (audio/AU-007), ` +
    `pipeline audio ${AUDIO_STAGE_ORDER.length} công đoạn đúng thứ tự.\n`,
);

if (notes.length > 0) {
  process.stdout.write(`${notes.join('\n')}\n`);
}
