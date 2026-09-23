/**
 * Sổ đăng ký contract v0 của sáu xưởng.
 *
 * Phong bì (`envelope.schema.json`) là ranh giới bất biến và được viết MỘT
 * lần. Mỗi xưởng chỉ đóng góp phần `payload`. Schema đầy đủ của một artifact
 * được GHÉP lúc nạp, nên phong bì không bị chép lại sáu lần và không thể trôi.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORKSHOPS, ENVELOPE_SCHEMA_VERSION, type WorkshopName } from './envelope.ts';
import { assertValid, validate, type JsonSchema, type ValidationResult } from './validate.ts';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

function load(name: string): JsonSchema {
  return JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as JsonSchema;
}

export const envelopeSchema: JsonSchema = load('envelope.schema.json');

/**
 * Contract của một mô hình định lượng tái dùng (mục `kernel/K-002`, nguồn
 * `topic/T-005`/`T-006`). Đứng ở `kernel` vì cấu trúc của một "mô hình" —
 * assumptions/parameters/formula/verification bốn cấp — trung tính với thể
 * loại; chỉ `modelId` mang tiền tố genre. Không phải payload envelope, nên
 * không nằm trong `payloadSchemas`/`artifactSchemas` ở dưới.
 */
export const modelSchema: JsonSchema = load('model.schema.json');

/** `kind` chuẩn của artifact mà mỗi xưởng sinh ra ở v0. */
export const ARTIFACT_KIND: Readonly<Record<WorkshopName, string>> = {
  topic: 'topic.brief',
  editorial: 'editorial.script',
  visual: 'visual.storyboard',
  audio: 'audio.timing',
  assembly: 'assembly.render',
  release: 'release.package',
};

export const payloadSchemas: Readonly<Record<WorkshopName, JsonSchema>> = Object.freeze(
  Object.fromEntries(
    WORKSHOPS.map((w) => [w, load(`${w}.payload.v0.schema.json`)]),
  ) as Record<WorkshopName, JsonSchema>,
);

function compose(workshop: WorkshopName): JsonSchema {
  const properties = { ...(envelopeSchema['properties'] as Record<string, JsonSchema>) };
  properties['payload'] = payloadSchemas[workshop];
  properties['kind'] = { type: 'string', const: ARTIFACT_KIND[workshop] };
  properties['producer'] = {
    ...(properties['producer'] as JsonSchema),
    properties: {
      ...((properties['producer'] as JsonSchema)['properties'] as Record<string, JsonSchema>),
      workshop: { type: 'string', const: workshop },
    },
  };
  return { ...envelopeSchema, $id: `crux://contracts/${workshop}.artifact.v0`, properties };
}

/** Schema đầy đủ (phong bì + payload) của artifact do một xưởng sinh ra. */
export const artifactSchemas: Readonly<Record<WorkshopName, JsonSchema>> = Object.freeze(
  Object.fromEntries(WORKSHOPS.map((w) => [w, compose(w)])) as Record<WorkshopName, JsonSchema>,
);

export function artifactSchemaFor(workshop: WorkshopName): JsonSchema {
  return artifactSchemas[workshop];
}

/** Validate một artifact theo contract của xưởng sinh ra nó. */
export function validateArtifact(workshop: WorkshopName, artifact: unknown): ValidationResult {
  return validate(artifact, artifactSchemas[workshop]);
}

/** Như trên nhưng ném lỗi. Dùng ở ranh giới vào và ra của mỗi xưởng. */
export function assertArtifact(workshop: WorkshopName, artifact: unknown): void {
  assertValid(artifact, artifactSchemas[workshop], `Artifact của xưởng ${workshop}`);
}

/**
 * Bên tiêu thụ phải hỗ trợ đồng thời phiên bản N và N-1 (CHARTER 5.2).
 * Ở Đợt 0 mới có N = 0, nên N-1 chưa tồn tại và hàm này chỉ chấp nhận N.
 */
export function isSupportedSchemaVersion(version: string): boolean {
  const current = Number(ENVELOPE_SCHEMA_VERSION);
  const seen = Number(version);
  return Number.isInteger(seen) && seen <= current && seen >= current - 1;
}
