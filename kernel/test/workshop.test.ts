import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runWorkshop,
  Cassette,
  UnrecordedCallError,
  fixedClock,
  inputsHashOf,
  stableHash,
  deriveEpisodeState,
  formatLogLine,
  type Envelope,
  type WorkshopDefinition,
} from '../src/index.ts';

const AT = '2026-09-20T00:00:00.000Z';

const topicStub: WorkshopDefinition<Record<string, unknown>> = {
  name: 'topic',
  version: 'test',
  consumes: [],
  produce: async () => ({
    selected: { id: 'T-1', question: 'Where does the usual answer stop working?', pillar: 'thresholds' },
    candidates: [{ id: 'T-1', question: 'Where does the usual answer stop working?', totalScore: 80 }],
    claims: [{ id: 'C1', statement: 'x', evidence: { kind: 'model', ref: 'M-1' } }],
    targetDurationMs: 600000,
  }),
};

function ctx(cassette = new Cassette('replay')) {
  return {
    episodeId: 'ep-test',
    channel: 'us-personal-finance',
    genre: 'data-explainer',
    locale: 'en-US',
    clock: fixedClock(AT),
    cassette,
    impl: 'stub' as const,
  };
}

test('runWorkshop đóng phong bì đầy đủ và validate đầu ra', async () => {
  const artifact = await runWorkshop(topicStub, { upstream: {}, packs: {} }, ctx());
  assert.equal(artifact.kind, 'topic.brief');
  assert.equal(artifact.producer.impl, 'stub');
  assert.equal(artifact.createdAt, AT);
  assert.equal(artifact.costUsd, 0);
  assert.match(artifact.inputsHash, /^[0-9a-f]{64}$/);
});

test('runWorkshop từ chối khi thiếu artifact của xưởng trước', async () => {
  const downstream: WorkshopDefinition<Record<string, unknown>> = {
    ...topicStub,
    name: 'editorial',
    consumes: ['topic'],
  };
  await assert.rejects(
    () => runWorkshop(downstream, { upstream: {}, packs: {} }, ctx()),
    /cần artifact của xưởng topic/,
  );
});

test('runWorkshop từ chối schemaVersion ngoài khoảng N và N-1', async () => {
  const upstream = {
    topic: { schemaVersion: '9', status: 'ok', payload: {} } as unknown as Envelope,
  };
  const downstream: WorkshopDefinition<Record<string, unknown>> = {
    ...topicStub,
    name: 'editorial',
    consumes: ['topic'],
  };
  await assert.rejects(
    () => runWorkshop(downstream, { upstream, packs: {} }, ctx()),
    /schemaVersion 9/,
  );
});

test('đầu ra không hợp contract thì ném lỗi ngay tại ranh giới', async () => {
  const broken: WorkshopDefinition<Record<string, unknown>> = {
    ...topicStub,
    produce: async () => ({ selected: { id: 'T-1' } }),
  };
  await assert.rejects(() => runWorkshop(broken, { upstream: {}, packs: {} }, ctx()), /không hợp lệ/);
});

test('chế độ replay ném lỗi ở mọi lời gọi chưa có trong băng', async () => {
  const cassette = new Cassette('replay');
  await assert.rejects(
    () => cassette.call('openai', 'chat', { p: 1 }, async () => ({ response: 'x', costUsd: 1 })),
    UnrecordedCallError,
  );
});

test('băng ghi lại cả phản hồi lẫn chi phí, và dùng lại ở lần sau', async () => {
  const cassette = new Cassette('record');
  let calls = 0;
  const perform = async () => {
    calls += 1;
    return { response: 'hello', costUsd: 0.25 };
  };
  assert.equal(await cassette.call('tts', 'speak', { text: 'a' }, perform), 'hello');
  assert.equal(await cassette.call('tts', 'speak', { text: 'a' }, perform), 'hello');
  assert.equal(calls, 1);
  assert.equal(cassette.costUsd, 0.5);
  assert.equal(cassette.newEntries.length, 1);
});

test('inputsHash không đổi theo thứ tự đầu vào', () => {
  const a = { kind: 'k1', path: 'p1', hash: 'a'.repeat(64) };
  const b = { kind: 'k2', path: 'p2', hash: 'b'.repeat(64) };
  assert.equal(inputsHashOf([a, b]), inputsHashOf([b, a]));
});

test('stableHash không đổi theo thứ tự khoá', () => {
  assert.equal(stableHash({ a: 1, b: 2 }), stableHash({ b: 2, a: 1 }));
  assert.notEqual(stableHash({ a: 1 }), stableHash({ a: 2 }));
});

test('trạng thái tập được DẪN XUẤT từ vùng của từng xưởng', () => {
  const ok = (w: string, cost: number) =>
    ({ status: 'ok', costUsd: cost, producer: { workshop: w } }) as unknown as Envelope;
  const state = deriveEpisodeState(
    { topic: ok('topic', 1), editorial: ok('editorial', 2) },
    ['topic', 'editorial', 'visual'],
  );
  assert.deepEqual(state.done, ['topic', 'editorial']);
  assert.equal(state.next, 'visual');
  assert.equal(state.costUsd, 3);
});

test('bất biến I8: dòng log luôn có costUsd', () => {
  const line = JSON.parse(
    formatLogLine({
      at: AT,
      lane: 'kernel',
      kind: 'stage',
      ref: 'ep/topic',
      status: 'ok',
      durationMs: 5,
      costUsd: 0,
    }),
  ) as Record<string, unknown>;
  assert.ok('costUsd' in line);
  assert.equal(line['lane'], 'kernel');
});
