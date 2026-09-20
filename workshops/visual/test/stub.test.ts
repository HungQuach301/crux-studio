import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runWorkshop, Cassette, fixedClock, validateArtifact, type Envelope } from '@crux/kernel';
import { definition } from '../src/index.ts';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/input.json', import.meta.url), 'utf8'),
) as { upstream: Record<string, Envelope>; packs: Record<string, unknown> };

const limits = (fixture.packs['genre'] as { limits: { sceneCount: [number, number] } }).limits;
const mix = (fixture.packs['genre'] as { shotSizeMix: Record<string, number> }).shotSizeMix;

const ctx = {
  episodeId: 'ep-0001-stub',
  channel: 'us-personal-finance',
  genre: 'data-explainer',
  locale: 'en-US',
  clock: fixedClock('2026-09-20T00:00:00.000Z'),
  cassette: new Cassette('replay'),
  impl: 'stub' as const,
};

test('storyboard nằm trong khoảng số scene của genre pack', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.ok(artifact.payload.scenes.length >= limits.sceneCount[0]);
  assert.ok(artifact.payload.scenes.length <= limits.sceneCount[1]);
  assert.equal(validateArtifact('visual', artifact).valid, true);
});

test('cỡ cảnh trộn theo đúng tỷ lệ khai trong genre pack', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const scenes = artifact.payload.scenes;
  for (const size of ['wide', 'medium', 'close', 'detail'] as const) {
    const actual = scenes.filter((s) => s.shotSize === size).length / scenes.length;
    assert.ok(
      Math.abs(actual - (mix[size] ?? 0)) <= (mix['tolerance'] ?? 0),
      `${size}: ${actual} lệch quá dung sai so với ${mix[size]}`,
    );
  }
});

test('nhịp không đều — độ lệch chuẩn vượt ngưỡng', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const d = artifact.payload.scenes.map((s) => s.durationMs);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
  assert.ok(sd / mean >= 0.4, `tỷ lệ độ lệch chuẩn ${(sd / mean).toFixed(3)} dưới ngưỡng 0.4`);
});

test('scene hiển thị số luôn mang claimId (I6)', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  for (const scene of artifact.payload.scenes) {
    if (['chart', 'diagram', 'map'].includes(scene.kind)) {
      assert.ok(scene.claimIds.length > 0, `${scene.id} hiển thị số mà không có claimId`);
    }
  }
});

test('tổng thời lượng hình bám thời lượng outline', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const target = (fixture.upstream['editorial'] as Envelope<{ outline: { beats: { estimatedMs: number }[] } }>)
    .payload.outline.beats.reduce((a, b) => a + b.estimatedMs, 0);
  const total = artifact.payload.scenes.reduce((a, s) => a + s.durationMs, 0);
  assert.ok(Math.abs(total - target) / target <= 0.05);
});
