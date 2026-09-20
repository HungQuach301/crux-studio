import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORKSHOPS,
  ENVELOPE_FIELDS,
  envelopeSchema,
  artifactSchemas,
  validateArtifact,
  isSupportedSchemaVersion,
  ARTIFACT_KIND,
} from '../src/index.ts';

function goldenArtifact(workshop: (typeof WORKSHOPS)[number]): Record<string, unknown> {
  const url = new URL(`../../ops/golden/ep-0001-stub/snapshots/${workshop}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
}

test('phong bì khai đúng các trường của CHARTER 5.2', () => {
  assert.deepEqual(
    Object.keys(envelopeSchema['properties'] as object).sort(),
    [...ENVELOPE_FIELDS].sort(),
  );
  assert.equal(envelopeSchema['additionalProperties'], false);
});

test('mỗi xưởng có một schema artifact khoá đúng kind của nó', () => {
  for (const workshop of WORKSHOPS) {
    const props = artifactSchemas[workshop]['properties'] as Record<string, { const?: string }>;
    assert.equal(props['kind']?.const, ARTIFACT_KIND[workshop]);
    assert.equal(props['producer']?.const, undefined);
  }
});

test('snapshot tập vàng hợp contract của xưởng sinh ra nó', () => {
  for (const workshop of WORKSHOPS) {
    const result = validateArtifact(workshop, goldenArtifact(workshop));
    assert.equal(result.valid, true, `${workshop}: ${JSON.stringify(result.errors)}`);
  }
});

test('artifact của xưởng này không lọt qua contract của xưởng khác', () => {
  const result = validateArtifact('release', goldenArtifact('topic'));
  assert.equal(result.valid, false);
});

test('bất biến I5: contract release không chấp nhận visibility khác private', () => {
  const artifact = goldenArtifact('release') as { payload: { publication: { visibility: string } } };
  artifact.payload.publication.visibility = 'public';
  const result = validateArtifact('release', artifact);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.path.endsWith('publication.visibility')));
});

test('bên tiêu thụ hỗ trợ N và N-1, không hơn', () => {
  assert.equal(isSupportedSchemaVersion('0'), true);
  assert.equal(isSupportedSchemaVersion('1'), false);
  assert.equal(isSupportedSchemaVersion('x'), false);
});
