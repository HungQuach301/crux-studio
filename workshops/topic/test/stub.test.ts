import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readInputFile, runWorkshop, Cassette, fixedClock, validateArtifact } from '@crux/kernel';
import { definition } from '../src/index.ts';

// Pack tới từ `packs/`, không từ một bản sao rút gọn viết trong test này
// (mục integration/I-008). Ngưỡng đem ra so cũng đọc từ pack, nên một pack
// đổi làm test này đỏ chứ không làm nó xanh sai.
const { episode, input: fixture } = readInputFile(
  fileURLToPath(new URL('../../../', import.meta.url)),
  fileURLToPath(new URL('../fixtures/input.json', import.meta.url)),
);
const packs = fixture.packs;
const targetDurationMs = (packs['genre'] as { limits: { targetDurationMs: number } }).limits
  .targetDurationMs;

// `episodeId` KHÔNG phải của fixture: bài kiểm cuối file đo rằng hai tập khác
// nhau cho đề tài khác nhau, nên tập ở đây phải là một tập khác.
const ctx = {
  ...episode,
  episodeId: 'ep-test',
  clock: fixedClock('2026-09-20T00:00:00.000Z'),
  cassette: new Cassette('replay'),
  impl: 'stub' as const,
};

test('xưởng Đề tài sinh artifact hợp contract v0', async () => {
  const artifact = await runWorkshop(definition, { upstream: {}, packs }, ctx);
  assert.equal(validateArtifact('topic', artifact).valid, true);
  assert.equal(artifact.payload.targetDurationMs, targetDurationMs);
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
