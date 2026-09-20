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

test('BẤT BIẾN I5: máy không công khai video', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(artifact.payload.publication.visibility, 'private');
  assert.equal(validateArtifact('release', artifact).valid, true);
});

test('contract chặn ngay cả khi code xưởng cố đặt public', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  const tampered = JSON.parse(JSON.stringify(artifact)) as typeof artifact;
  tampered.payload.publication.visibility = 'public' as 'private';
  assert.equal(validateArtifact('release', tampered).valid, false);
});

test('rủi ro A3: nội dung tổng hợp luôn được gắn nhãn', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.equal(artifact.payload.disclosure, true);
  assert.match(artifact.payload.package.description, /AI assistance/);
});

test('bảng tính mô hình công bố công khai là bắt buộc (I6, D-16)', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  assert.match(artifact.payload.package.modelSheetUrl, /^https:\/\//);
  assert.ok(artifact.payload.package.sourceList.length > 0);
});

test('mọi tiêu đề nằm trong giới hạn 100 ký tự của YouTube', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx);
  for (const title of artifact.payload.package.titles) {
    assert.ok(title.text.length <= 100);
  }
});
