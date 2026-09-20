import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflight, type PreflightInput } from '../src/preflight.ts';

function scene(over: Partial<PreflightInput['scenes'][number]> = {}) {
  return {
    id: 'S001',
    durationMs: 3000,
    shotSize: 'medium',
    kind: 'text-minimal',
    layoutId: 'L-1',
    variant: 'v1',
    claimIds: [],
    onScreenWordCount: 5,
    ...over,
  };
}

function input(over: Partial<PreflightInput> = {}): PreflightInput {
  const scenes = over.scenes ?? [
    scene({ id: 'S001', durationMs: 1500 }),
    scene({ id: 'S002', durationMs: 4500 }),
    scene({ id: 'S003', durationMs: 1500 }),
    scene({ id: 'S004', durationMs: 4500, layoutId: 'L-2' }),
  ];
  const totalMs = scenes.reduce((a, s) => a + s.durationMs, 0);
  return {
    scenes,
    declared: { sceneCount: scenes.length, totalMs },
    targetDurationMs: totalMs,
    script: { wordCount: 3400, devicesUsed: ['a', 'b', 'c', 'd', 'e'] },
    audio: { totalMs, captionDriftMaxMs: 0 },
    limits: {
      sceneCount: [1, 10],
      sceneMinDurationMs: 1200,
      sceneDurationStdDevMinRatio: 0.4,
      maxConsecutiveScenesUnder2s: 3,
      onScreenWordsMaxPerScene: 12,
      totalDurationTolerancePct: 5,
      maxLayoutRepeatsPerVariant: 3,
      scriptWordCount: [3200, 3600],
      devicesMin: 5,
      captionDriftMaxMs: 200,
    },
    shotSizeMix: { medium: 1, tolerance: 0.08 },
    impl: 'v1',
    ...over,
  };
}

const verdictOf = (id: string, r: { checks: { id: string; verdict: string }[] }) =>
  r.checks.find((c) => c.id === id)?.verdict;

test('storyboard đủ chuẩn thì Preflight xanh', () => {
  const report = preflight(input());
  assert.equal(report.verdict, 'pass', JSON.stringify(report.checks.filter((c) => c.verdict !== 'pass')));
});

test('nhịp đều đặn là nhịp chết — độ lệch chuẩn thấp thì chặn', () => {
  const scenes = Array.from({ length: 4 }, (_, i) => scene({ id: `S00${i}`, durationMs: 3000 }));
  const report = preflight(input({ scenes, declared: { sceneCount: 4, totalMs: 12000 }, targetDurationMs: 12000, audio: { totalMs: 12000, captionDriftMaxMs: 0 } }));
  assert.equal(verdictOf('scene-duration-stddev', report), 'fail');
  assert.equal(report.verdict, 'fail');
});

test('scene ngắn hơn ngưỡng thì chặn và chỉ đúng scene nào', () => {
  const scenes = [scene({ id: 'S001', durationMs: 800 }), scene({ id: 'S002', durationMs: 5000 })];
  const report = preflight(input({ scenes, declared: { sceneCount: 2, totalMs: 5800 }, targetDurationMs: 5800, audio: { totalMs: 5800, captionDriftMaxMs: 0 } }));
  const check = report.checks.find((c) => c.id === 'scene-min-duration');
  assert.equal(check?.verdict, 'fail');
  assert.deepEqual(check?.sceneIds, ['S001']);
});

test('bất biến I6: scene hiển thị số mà không có claimId thì chặn', () => {
  const scenes = [
    scene({ id: 'S001', durationMs: 1500, kind: 'chart' }),
    scene({ id: 'S002', durationMs: 4500 }),
  ];
  const report = preflight(input({ scenes, declared: { sceneCount: 2, totalMs: 6000 }, targetDurationMs: 6000, audio: { totalMs: 6000, captionDriftMaxMs: 0 } }));
  assert.equal(verdictOf('claim-coverage', report), 'fail');
});

test('tự khai lệch số tính được là lỗi nặng hơn một check fail thường', () => {
  const report = preflight(input({ declared: { sceneCount: 99, totalMs: 1 } }));
  assert.equal(report.selfCheckMismatch.length, 2);
  assert.equal(report.verdict, 'fail');
  assert.ok(report.checks.every((c) => c.verdict !== 'fail'));
});

test('ở impl=stub, kiểm khối lượng nội dung hạ xuống warn; kiểm cấu trúc vẫn chặn', () => {
  const stub = preflight(input({ impl: 'stub', script: { wordCount: 60, devicesUsed: [] } }));
  assert.equal(verdictOf('script-word-count', stub), 'warn');
  assert.equal(verdictOf('devices-used', stub), 'warn');
  assert.equal(stub.verdict, 'pass');

  const real = preflight(input({ impl: 'v1', script: { wordCount: 60, devicesUsed: [] } }));
  assert.equal(verdictOf('script-word-count', real), 'fail');
  assert.equal(real.verdict, 'fail');
});

test('mật độ chữ vượt trần thì chặn', () => {
  const scenes = [
    scene({ id: 'S001', durationMs: 1500, onScreenWordCount: 40 }),
    scene({ id: 'S002', durationMs: 4500 }),
  ];
  const report = preflight(input({ scenes, declared: { sceneCount: 2, totalMs: 6000 }, targetDurationMs: 6000, audio: { totalMs: 6000, captionDriftMaxMs: 0 } }));
  assert.equal(verdictOf('on-screen-word-density', report), 'fail');
});

test('tổng thời lượng lệch quá dung sai thì chặn', () => {
  const report = preflight(input({ targetDurationMs: 60000 }));
  assert.equal(verdictOf('total-duration', report), 'fail');
});
