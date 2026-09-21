/**
 * `ops/scripts/render-trial.ts` — bộ đo của mục `assembly/A-001`.
 *
 * Chỉ kiểm phần thuần. Phần chạy thật gọi `ffmpeg` hàng chục phút cho một
 * tập đầy đủ; đặt nó vào `pnpm check` sẽ biến mỗi lượt CI thành một lượt
 * render, tức là đốt đúng thứ tài nguyên mà giả định **G5** đang lo.
 *
 * Bốn chỗ được khoá ở đây đều là chỗ hỏng **im lặng** — sai mà vẫn ra một
 * con số trông hợp lý:
 *
 * 1. `streamLoopFlag` lệch một đơn vị → ffmpeg dừng sớm, lượt đo ra một tập
 *    NGẮN hơn tập thật, và không có gì báo vì file .mp4 vẫn hợp lệ.
 * 2. `actionsMinutes` làm tròn xuống → ngân sách nhỏ hơn hoá đơn thật.
 * 3. `encodeOnlySeconds` trả 0 khi thiếu lượt nền → toàn bộ chi phí giải mã
 *    bị gán cho bộ mã hoá.
 * 4. `encodeArgs` ở cấu hình 30fps mà nhân đôi khung thay vì lấy mẫu thưa →
 *    60fps rẻ giả tạo, và cả quyết định 30/60 nghiêng theo.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIGS,
  SOURCE_SECONDS,
  actionsMinutes,
  configById,
  encodeArgs,
  encodeOnlySeconds,
  frameCount,
  mb,
  ratio,
  renderReport,
  scaleToEpisode,
  sceneFilter,
  sourceArgs,
  streamLoopFlag,
  type Measurement,
  type MeasurementFile,
} from '../scripts/render-trial.ts';

const EPISODE_MS = 1_260_000;

test('frameCount làm tròn lên — khung cuối vẫn phải dựng', () => {
  assert.equal(frameCount(1000, 30), 30);
  assert.equal(frameCount(EPISODE_MS, 30), 37_800);
  assert.equal(frameCount(EPISODE_MS, 60), 75_600);
  // 1,5 khung thì vẫn phải dựng 2.
  assert.equal(frameCount(50, 30), 2);
  assert.throws(() => frameCount(0, 30), /dương/);
  assert.throws(() => frameCount(1000, 0), /dương/);
});

test('streamLoopFlag trả giá trị cho cờ, không phải số lần phát', () => {
  // `-stream_loop N` phát N+1 lần. Một tập 21 phút, clip nguồn 20 giây:
  // cần 63 lần phát, tức là cờ 62.
  assert.equal(streamLoopFlag(EPISODE_MS, SOURCE_SECONDS), 62);
  // Vừa đúng một lần phát thì không cần lặp.
  assert.equal(streamLoopFlag(20_000, 20), 0);
  // Dư một phần lẻ vẫn phải thêm một lần phát, nếu không lượt đo dựng thiếu.
  assert.equal(streamLoopFlag(20_001, 20), 1);
  assert.equal(streamLoopFlag(40_000, 20), 1);
  assert.throws(() => streamLoopFlag(1000, 0), /dương/);
});

test('actionsMinutes làm tròn LÊN theo từng phút', () => {
  assert.equal(actionsMinutes(0), 0);
  assert.equal(actionsMinutes(1), 1);
  assert.equal(actionsMinutes(60), 1);
  assert.equal(actionsMinutes(61), 2);
  assert.equal(actionsMinutes(857), 15);
  assert.throws(() => actionsMinutes(-1), /không âm/);
});

test('encodeArgs: 30fps lấy mẫu thưa từ nguồn 60fps, không nhân đôi khung', () => {
  const args = encodeArgs(configById('master-30'), 'src.mp4', EPISODE_MS, 'out.mp4');
  // `-r 30` đặt trên ĐẦU VÀO đã giải mã, tức là bỏ bớt khung của nguồn 60fps.
  assert.equal(args[args.indexOf('-r') + 1], '30');
  // Không có bộ lọc nào nhân đôi hay nội suy khung.
  assert.ok(!args.some((a) => a.includes('fps=') || a.includes('minterpolate')));
  assert.equal(args[args.indexOf('-stream_loop') + 1], '62');
  assert.equal(args[args.indexOf('-crf') + 1], '18');
  assert.equal(args[args.indexOf('-preset') + 1], 'medium');
  assert.equal(args.at(-1), 'out.mp4');
});

test('encodeArgs: lượt nền không mã hoá, và không ghi file nào', () => {
  const args = encodeArgs(configById('decode-60'), 'src.mp4', EPISODE_MS, 'out.mp4');
  assert.deepEqual(args.slice(-3), ['-f', 'null', '-']);
  assert.ok(!args.includes('libx264'));
  assert.ok(!args.includes('out.mp4'));
});

test('encodeArgs: proof hạ độ phân giải, master thì không đụng tới', () => {
  const proof = encodeArgs(configById('proof-60'), 'src.mp4', 20_000, 'p.mp4');
  const scale = proof[proof.indexOf('-vf') + 1];
  assert.equal(scale, 'scale=960:540:flags=lanczos');
  const master = encodeArgs(configById('master-60'), 'src.mp4', 20_000, 'm.mp4');
  assert.ok(!master.includes('-vf'));
});

test('configById ném lỗi có gợi ý thay vì trả về undefined', () => {
  assert.throws(() => configById('master-24'), /master-30/);
  assert.equal(configById('proof-30').crf, 28);
});

test('sceneFilter giữ đủ bốn thứ làm số đo không rẻ giả tạo', () => {
  const filter = sceneFilter(60, 1920, 1080);
  assert.match(filter, /gradients=/); // nền chuyển sắc
  assert.match(filter, /drawgrid=/); // lưới mảnh
  assert.match(filter, /drawbox=.*sin\(t\/7/); // cột đổi liên tục
  assert.match(filter, /^.*crop=1920:1080:x='.*sin\(t\/11\)/m); // máy quay trôi
  // Máy quay phải trôi trên khung LÀM VIỆC lớn hơn khung ra, nếu không thì
  // `crop` không còn chỗ để trôi và mọi khung đứng yên.
  assert.match(filter, /gradients=s=2560x1440/);
});

test('sourceArgs sinh đúng clip nguồn 60fps, chất lượng cao', () => {
  const args = sourceArgs('src.mp4');
  assert.equal(args[args.indexOf('-t') + 1], String(SOURCE_SECONDS));
  assert.equal(args[args.indexOf('-crf') + 1], '12');
  assert.match(args[args.indexOf('-i') + 1] as string, /:r=60:/);
});

function sample(overrides: Partial<Measurement> & { config: string }): Measurement {
  return {
    kind: 'master',
    fps: 30,
    resolution: '1920x1080',
    frames: 100,
    durationMs: 20_000,
    wallSeconds: 10,
    peakRssMb: 500,
    bytes: 1_048_576,
    framesPerSecond: 10,
    realtimeFactor: 2,
    ...overrides,
  };
}

test('encodeOnlySeconds trừ đúng lượt nền CÙNG tần số khung', () => {
  const rows: Measurement[] = [
    sample({ config: 'decode-30', kind: 'decode', fps: 30, wallSeconds: 2 }),
    sample({ config: 'decode-60', kind: 'decode', fps: 60, wallSeconds: 4 }),
    sample({ config: 'master-30', fps: 30, wallSeconds: 10 }),
    sample({ config: 'master-60', fps: 60, wallSeconds: 14 }),
  ];
  assert.equal(encodeOnlySeconds(rows, 'master-30'), 8);
  assert.equal(encodeOnlySeconds(rows, 'master-60'), 10);
});

test('encodeOnlySeconds trả null khi thiếu lượt nền — không đoán bằng 0', () => {
  const rows: Measurement[] = [sample({ config: 'master-30', fps: 30, wallSeconds: 10 })];
  assert.equal(encodeOnlySeconds(rows, 'master-30'), null);
  assert.equal(encodeOnlySeconds(rows, 'master-60'), null);
});

test('scaleToEpisode quy số đo một phần về tập đầy đủ', () => {
  assert.equal(scaleToEpisode(10, 20_000, EPISODE_MS), 630);
  // Đo đủ tập thì không đổi gì.
  assert.equal(scaleToEpisode(857, EPISODE_MS, EPISODE_MS), 857);
  assert.throws(() => scaleToEpisode(1, 0, EPISODE_MS), /dương/);
});

test('ratio và mb', () => {
  assert.equal(ratio(14, 10), 1.4);
  assert.throws(() => ratio(1, 0), /chia cho 0/);
  assert.equal(mb(1_048_576), 1);
});

function fullFile(measuredMs: number): MeasurementFile {
  return {
    at: '2026-09-21T23:00:00.000Z',
    host: { cores: 4, ramMb: 16_096, node: 'v22.22.2', platform: 'linux-x64', ffmpeg: 'ffmpeg 6.1.1' },
    episodeDurationMs: EPISODE_MS,
    measuredDurationMs: measuredMs,
    source: { seconds: 20, fps: 60, bytes: 9_277_814, wallSeconds: 60 },
    measurements: [
      sample({ config: 'decode-30', kind: 'decode', fps: 30, wallSeconds: 2, bytes: 0 }),
      sample({ config: 'decode-60', kind: 'decode', fps: 60, wallSeconds: 4, bytes: 0 }),
      sample({ config: 'master-30', fps: 30, wallSeconds: 860, bytes: 320 * 1024 * 1024 }),
      sample({ config: 'master-60', fps: 60, wallSeconds: 1190, bytes: 400 * 1024 * 1024 }),
      sample({ config: 'proof-30', kind: 'proof', fps: 30, wallSeconds: 230, bytes: 26 * 1024 * 1024 }),
      sample({ config: 'proof-60', kind: 'proof', fps: 60, wallSeconds: 265, bytes: 32 * 1024 * 1024 }),
    ],
  };
}

test('renderReport nói rõ đã dựng tập đầy đủ hay chỉ một phần', () => {
  assert.match(renderReport(fullFile(EPISODE_MS)), /\*\*tập đầy đủ\*\*/);
  const partial = renderReport(fullFile(20_000));
  assert.match(partial, /⚠️ \*\*một phần\*\*/);
});

test('renderReport dán tỷ lệ 60/30 đo được, không dán 2×', () => {
  const report = renderReport(fullFile(EPISODE_MS));
  // 1190 / 860 = 1.38
  assert.match(report, /\*\*1\.38×\*\*/);
  // và nói rõ phần sinh khung MỚI là phần tuyến tính theo số khung.
  assert.match(report, /\*\*2,00×\*\*/);
  assert.match(report, /KHÔNG làm gấp đôi chi phí dựng/);
});

test('renderReport luôn mang cảnh báo phút Actions chưa đo được', () => {
  const report = renderReport(fullFile(EPISODE_MS));
  assert.match(report, /không phải runner Actions/);
  assert.match(report, /render-trial\.yml/);
  assert.match(report, /G10/);
});

test('renderReport không vỡ khi chỉ có một phần cấu hình', () => {
  const file = fullFile(EPISODE_MS);
  file.measurements = file.measurements.filter((m) => m.config.startsWith('decode'));
  const report = renderReport(file);
  assert.match(report, /## Số đo/);
  assert.ok(!report.includes('Ngân sách phút Actions'));
});

test('mọi cấu hình có mã duy nhất và lượt nền phủ đủ các tần số khung', () => {
  const ids = CONFIGS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const fpsNeeded = new Set(CONFIGS.filter((c) => c.kind !== 'decode').map((c) => c.fps));
  for (const fps of fpsNeeded) {
    assert.ok(
      CONFIGS.some((c) => c.kind === 'decode' && c.fps === fps),
      `thiếu lượt nền cho ${fps}fps — cột "mã hoá thuần" sẽ rỗng mà không gì đỏ`,
    );
  }
});
