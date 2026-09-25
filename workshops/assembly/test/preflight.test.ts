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

test('không đưa validLayoutIds thì không chạy check layout-id-known (chưa nối pipeline thật, mục V-001)', () => {
  const report = preflight(input());
  assert.equal(verdictOf('layout-id-known', report), undefined);
});

test('layoutId ngoài layouts.json thì bị chặn khi có validLayoutIds', () => {
  const scenes = [
    scene({ id: 'S001', durationMs: 1500, layoutId: 'hero-number' }),
    scene({ id: 'S002', durationMs: 4500, layoutId: 'L-nope' }),
  ];
  const report = preflight(
    input({
      scenes,
      declared: { sceneCount: 2, totalMs: 6000 },
      targetDurationMs: 6000,
      audio: { totalMs: 6000, captionDriftMaxMs: 0 },
      validLayoutIds: ['hero-number', 'bar-compare'],
    }),
  );
  const check = report.checks.find((c) => c.id === 'layout-id-known');
  assert.equal(check?.verdict, 'fail');
  assert.deepEqual(check?.sceneIds, ['S002']);
  assert.equal(report.verdict, 'fail');
});

test('ở impl=stub, layoutId lạ hạ xuống warn thay vì chặn', () => {
  const scenes = [scene({ id: 'S001', durationMs: 1500, layoutId: 'L-nope' }), scene({ id: 'S002', durationMs: 4500, layoutId: 'L-nope' })];
  const report = preflight(
    input({
      scenes,
      declared: { sceneCount: 2, totalMs: 6000 },
      targetDurationMs: 6000,
      audio: { totalMs: 6000, captionDriftMaxMs: 0 },
      validLayoutIds: ['hero-number'],
      impl: 'stub',
    }),
  );
  assert.equal(verdictOf('layout-id-known', report), 'warn');
});

test('layoutId hợp lệ hết thì check layout-id-known xanh', () => {
  const scenes = [
    scene({ id: 'S001', durationMs: 1500, layoutId: 'hero-number' }),
    scene({ id: 'S002', durationMs: 4500, layoutId: 'bar-compare' }),
  ];
  const report = preflight(
    input({
      scenes,
      declared: { sceneCount: 2, totalMs: 6000 },
      targetDurationMs: 6000,
      audio: { totalMs: 6000, captionDriftMaxMs: 0 },
      validLayoutIds: ['hero-number', 'bar-compare'],
    }),
  );
  assert.equal(verdictOf('layout-id-known', report), 'pass');
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

// ── Chống "trông như slide" (CHARTER 6.8a) ───────────────────────────────

function slideScenes(over: { motion: boolean[]; durations: number[]; words?: number[] }) {
  return over.motion.map((hasMotion, i) =>
    scene({
      id: `S${String(i + 1).padStart(3, '0')}`,
      durationMs: over.durations[i]!,
      hasMotion,
      onScreenWordCount: over.words?.[i] ?? 5,
      layoutId: `L-${i % 4}`,
    }),
  );
}

function slideInput(scenes: PreflightInput['scenes']): PreflightInput {
  const totalMs = scenes.reduce((a, s) => a + s.durationMs, 0);
  return input({
    scenes,
    declared: { sceneCount: scenes.length, totalMs },
    targetDurationMs: totalMs,
    audio: { totalMs, captionDriftMaxMs: 0 },
    limits: {
      ...input().limits,
      motionCoverageMin: 0.7,
      longestStaticRunMsMax: 8000,
      textWordsPerSecondMax: 1.5,
      sceneMaxDurationMs: 12000,
    },
  });
}

test('chỉ số chống slide tính theo THỜI LƯỢNG, không theo số scene', () => {
  // Hai scene tĩnh nhưng rất ngắn, một scene động rất dài.
  // Đếm theo scene thì 2/3 là tĩnh; đếm theo thời lượng thì gần như toàn động.
  const report = preflight(
    slideInput(slideScenes({ motion: [false, false, true], durations: [200, 200, 9600] })),
  );
  assert.equal(report.antiSlide.staticSceneCount, 2);
  assert.ok(report.antiSlide.motionCoverage > 0.95, `nhận ${report.antiSlide.motionCoverage}`);
  assert.equal(verdictOf('motion-coverage', report), 'pass');
});

test('quãng tĩnh liên tục dài thì chặn, dù tỷ lệ tổng vẫn đẹp', () => {
  // 90% thời lượng có chuyển động, nhưng 9 giây tĩnh nằm liền nhau.
  const report = preflight(
    slideInput(
      slideScenes({
        motion: [true, false, false, false, true],
        durations: [40000, 3000, 3000, 3000, 41000],
      }),
    ),
  );
  assert.ok(report.antiSlide.motionCoverage > 0.89);
  assert.equal(report.antiSlide.longestStaticRunMs, 9000);
  assert.equal(verdictOf('longest-static-run', report), 'fail');
  assert.equal(report.verdict, 'fail');
});

test('một cảnh tĩnh bị cắt bởi một cảnh động thì quãng tĩnh được tính lại từ đầu', () => {
  const report = preflight(
    slideInput(
      slideScenes({
        motion: [false, true, false, true, false],
        durations: [5000, 5000, 5000, 5000, 5000],
      }),
    ),
  );
  assert.equal(report.antiSlide.longestStaticRunMs, 5000);
  assert.equal(verdictOf('longest-static-run', report), 'pass');
});

test('mọi scene dưới trần chữ mà cả tập vẫn dày đặc thì vẫn bị chặn', () => {
  // 10 từ mỗi scene — dưới trần 12. Nhưng scene chỉ dài 2 giây.
  const report = preflight(
    slideInput(
      slideScenes({
        motion: [true, true, true, true],
        durations: [2000, 6000, 2000, 6000],
        words: [10, 10, 10, 10],
      }),
    ),
  );
  assert.equal(verdictOf('on-screen-word-density', report), 'pass', 'mỗi scene vẫn dưới trần');
  assert.ok(report.antiSlide.textWordsPerSecond > 1.5);
  assert.equal(verdictOf('text-words-per-second', report), 'fail');
});

test('một cảnh đủ dài thì tự nó là một slide', () => {
  const report = preflight(
    slideInput(slideScenes({ motion: [true, true], durations: [4000, 16000] })),
  );
  assert.equal(report.antiSlide.longestSceneMs, 16000);
  const check = report.checks.find((c) => c.id === 'scene-max-duration');
  assert.equal(check?.verdict, 'fail');
  assert.deepEqual(check?.sceneIds, ['S002']);
});

test('chỉ số được ghi lại KỂ CẢ khi đạt ngưỡng — chất lượng hình trôi dần, không hỏng đột ngột', () => {
  const report = preflight(
    slideInput(
      slideScenes({ motion: [true, true, true, true], durations: [2000, 6000, 2000, 6000] }),
    ),
  );
  assert.equal(report.verdict, 'pass');
  for (const key of [
    'motionCoverage',
    'longestStaticRunMs',
    'textWordsPerSecond',
    'longestSceneMs',
  ] as const) {
    assert.equal(typeof report.antiSlide[key], 'number', `thiếu ${key} dù Preflight xanh`);
  }
});
