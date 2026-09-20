import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runWorkshop, Cassette, fixedClock, validateArtifact, type Envelope } from '@crux/kernel';
import { definition } from '../src/index.ts';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/input.json', import.meta.url), 'utf8'),
) as { upstream: Record<string, Envelope>; packs: Record<string, unknown> };

const ctx = {
  episodeId: 'ep-0001-stub',
  channel: 'us-personal-finance',
  genre: 'data-explainer',
  locale: 'en-US',
  clock: fixedClock('2026-09-20T00:00:00.000Z'),
  cassette: new Cassette('replay'),
  impl: 'stub' as const,
};

test('mốc thời gian từng từ tăng dần và không chồng nhau', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(validateArtifact('audio', artifact).valid, true);
  let previousEnd = -1;
  for (const word of artifact.payload.words) {
    assert.ok(word.startMs > previousEnd, `từ "${word.text}" bắt đầu trước khi từ trước kết thúc`);
    assert.ok(word.endMs > word.startMs);
    previousEnd = word.endMs;
  }
});

test('file nhị phân không nằm trong repo — chỉ con trỏ', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.match(artifact.payload.audioRef, /^artifact:\/\//);
  assert.match(artifact.payload.captionsRef, /^artifact:\/\//);
});

test('giả định G7 chưa kiểm thì commercialLicenseVerified phải là false', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(
    artifact.payload.voice.commercialLicenseVerified,
    false,
    'stub không được tự khai là đã kiểm điều khoản thương mại',
  );
});
