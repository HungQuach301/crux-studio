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

test('outline bám đúng bộ beat khai trong genre pack', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const genreBeats = (fixture.packs['genre'] as { beats: unknown[] }).beats;
  assert.equal(artifact.payload.outline.beats.length, genreBeats.length);
  assert.equal(validateArtifact('editorial', artifact).valid, true);
});

test('mọi ranh giới beat đều có cầu tò mò', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  for (const beat of artifact.payload.outline.beats) {
    assert.ok(beat.curiosityBridge.length >= 10, `beat ${beat.index} thiếu cầu tò mò`);
  }
  assert.equal(
    artifact.payload.selfCheck.declaredBridgeCount,
    artifact.payload.outline.beats.length,
  );
});

test('điểm chèn quảng cáo sinh TỪ ranh giới beat, không đặt tuỳ ý', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const beatIndexes = new Set(artifact.payload.outline.beats.map((b) => b.index));
  for (const adBreak of artifact.payload.outline.adBreaks) {
    assert.ok(beatIndexes.has(adBreak.derivedFromBeat));
  }
});

test('tự khai khớp số tính được — nếu không, Preflight sẽ bắt', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(artifact.payload.selfCheck.declaredBeatCount, artifact.payload.outline.beats.length);
  assert.equal(artifact.payload.selfCheck.declaredWordCount, artifact.payload.script.wordCount);
});

test('kịch bản luôn nêu phạm vi địa lý', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(artifact.payload.script.geoScopeStated, true);
});
