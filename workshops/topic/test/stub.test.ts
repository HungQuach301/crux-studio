import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkshop, Cassette, fixedClock, validateArtifact } from '@crux/kernel';
import { definition } from '../src/index.ts';

const packs = { genre: { limits: { targetDurationMs: 1_260_000 } } };
const ctx = {
  episodeId: 'ep-test',
  channel: 'us-personal-finance',
  genre: 'data-explainer',
  locale: 'en-US',
  clock: fixedClock('2026-09-20T00:00:00.000Z'),
  cassette: new Cassette('replay'),
  impl: 'stub' as const,
};

test('xưởng Đề tài sinh artifact hợp contract v0', async () => {
  const artifact = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  assert.equal(validateArtifact('topic', artifact).valid, true);
  assert.equal(artifact.payload.targetDurationMs, 1_260_000);
});

test('bất biến I6: mỗi claim có nguồn HOẶC có mô hình, không có lựa chọn thứ ba', async () => {
  const artifact = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  for (const claim of artifact.payload.claims) {
    assert.ok(['source', 'model'].includes(claim.evidence.kind));
    assert.ok(claim.evidence.ref.length > 0);
  }
});

test('stub chạy lại cho kết quả giống hệt — điều kiện để tập vàng có nghĩa', async () => {
  const a = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  const b = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('tập khác nhau cho đề tài khác nhau', async () => {
  const a = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  const b = await runWorkshop(definition, { upstream: {}, packs }, { ...ctx, episodeId: 'ep-other' });
  assert.notEqual(a.payload.selected.id, b.payload.selected.id);
});
