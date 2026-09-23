import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cassette, UnrecordedCallError } from '../src/index.ts';

const REQUEST = { prompt: 'x' };

function recorded(costUsd: number) {
  return {
    key: Cassette.keyOf('openai', 'chat', REQUEST),
    provider: 'openai',
    operation: 'chat',
    requestHash: 'x',
    response: 'đã ghi',
    costUsd,
  };
}

test('băng chưa dùng có calls = 0', () => {
  assert.equal(new Cassette('replay').calls, 0);
});

test('mỗi lời gọi thật cộng một vào calls', async () => {
  const cassette = new Cassette('record');
  await cassette.call('openai', 'chat', REQUEST, async () => ({ response: 'a', costUsd: 1 }));
  await cassette.call('openai', 'chat', { prompt: 'y' }, async () => ({ response: 'b', costUsd: 2 }));
  assert.equal(cassette.calls, 2);
  assert.equal(cassette.costUsd, 3);
});

test('lời gọi lấy lại từ băng CŨNG cộng vào calls — replay vẫn là một lời gọi stage đó thực hiện', async () => {
  const cassette = new Cassette('replay', [recorded(0.5)]);
  const out = await cassette.call('openai', 'chat', REQUEST, async () => {
    throw new Error('không được gọi thật');
  });
  assert.equal(out, 'đã ghi');
  assert.equal(cassette.calls, 1);
});

test('calls là tín hiệu mà costUsd không thay được: một lời gọi 0 đồng vẫn là một lời gọi', async () => {
  const cassette = new Cassette('replay', [recorded(0)]);
  await cassette.call('openai', 'chat', REQUEST, async () => ({ response: 'x', costUsd: 0 }));
  assert.equal(cassette.costUsd, 0);
  assert.equal(cassette.calls, 1);
});

test('lời gọi chưa ghi ở chế độ replay ném lỗi và KHÔNG cộng vào calls', async () => {
  const cassette = new Cassette('replay');
  await assert.rejects(
    () => cassette.call('openai', 'chat', REQUEST, async () => ({ response: 'x', costUsd: 1 })),
    UnrecordedCallError,
  );
  assert.equal(cassette.calls, 0);
});
