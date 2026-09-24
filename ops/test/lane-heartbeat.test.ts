/**
 * Rà soát **Z7** — `ops/known-failures.md`, nhóm Z. Mục `platform/P-014`, sóng 3.
 *
 * Luật chỉ có giá trị khi nó **đỏ đúng lúc phải đỏ** (bài học KF-003), nên
 * mỗi ca cho qua ở đây đi kèm một ca âm tương ứng. Bài quan trọng nhất là
 * *"dòng bước 0 KHÔNG được giữ một làn xanh"*: đó là chỗ duy nhất Z7 khác
 * dấu hiệu số 5 của `watchdog`, và nếu nó hỏng thì ô của làn không bao giờ
 * đỏ được — một luật không bao giờ đỏ là một luật vô giá trị.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { RunLogLine } from '../../kernel/src/log.ts';
import { readRunLogs } from '../../kernel/src/log.ts';
import { LANES } from '../../kernel/src/envelope.ts';
import {
  LANE_THRESHOLD_HOURS,
  LaneHeartbeatUnreadable,
  STEP0_LEGACY_REF,
  STEP0_REF_PATTERN,
  isStep0Ref,
  laneHeartbeatProblems,
  laneHeartbeats,
  renderLaneHeartbeats,
} from '../scripts/lane-heartbeat.ts';

const NOW = '2026-09-23T12:00:00.000Z';

function line(at: string, lane: RunLogLine['lane'], ref: string): RunLogLine {
  return { at, lane, kind: 'lane', ref, status: 'ok', durationMs: 0, costUsd: 0 };
}

function beatOf(beats: ReturnType<typeof laneHeartbeats>, lane: string) {
  const found = beats.find((b) => b.lane === lane);
  assert.ok(found !== undefined, `thiếu ô của làn ${lane}`);
  return found;
}

// ── Ba trạng thái, và chúng phải PHÂN BIỆT được với nhau ──────────────────

test('Z7 · làn có dòng mới trong ngưỡng thì `fresh`', () => {
  const beats = laneHeartbeats([line('2026-09-23T11:00:00.000Z', 'visual', 'visual/V-003')], NOW);
  assert.equal(beatOf(beats, 'visual').verdict, 'fresh');
  assert.equal(beatOf(beats, 'visual').hoursSinceLastBeat, 1);
});

test('Z7 · làn có dòng nhưng đã quá ngưỡng thì `stale`', () => {
  // 30 giờ, ngưỡng của `visual` là 26.
  const beats = laneHeartbeats([line('2026-09-22T06:00:00.000Z', 'visual', 'visual/V-003')], NOW);
  assert.equal(beatOf(beats, 'visual').verdict, 'stale');
  assert.equal(beatOf(beats, 'visual').hoursSinceLastBeat, 30);
});

test('Z7 · làn chưa có dòng nào là `never`, KHÔNG phải `stale` — hai nguyên nhân, hai việc phải làm', () => {
  const beats = laneHeartbeats([line(NOW, 'platform', 'platform/P-014')], NOW);
  const release = beatOf(beats, 'release');
  assert.equal(release.verdict, 'never');
  assert.equal(release.lastBeatAt, null);
  assert.equal(release.hoursSinceLastBeat, null);
});

test('Z7 · MỌI làn đều có một ô — làn vắng mặt là làn không ai nhìn', () => {
  const beats = laneHeartbeats([line(NOW, 'platform', 'platform/P-014')], NOW);
  assert.deepEqual(
    beats.map((b) => b.lane),
    [...LANES],
  );
});

// ── Ca âm quan trọng nhất: dòng bước 0 không được giữ một làn xanh ────────

test('Z7 · dòng bước 0 KHÔNG giữ làn `integration` xanh — và đó là cả điểm khác biệt với dấu hiệu số 5', () => {
  const lines = [
    line('2026-09-22T06:00:00.000Z', 'integration', 'integration/I-017'), // việc thật, 30 giờ trước
    line('2026-09-23T11:50:00.000Z', 'integration', 'integration/step0-2026-09-23T115000Z-crux-worker-1'),
    line('2026-09-23T11:55:00.000Z', 'integration', 'integration/step0-2026-09-23T115500Z-crux-worker-2'),
  ];
  const beat = beatOf(laneHeartbeats(lines, NOW), 'integration');
  assert.equal(beat.verdict, 'stale');
  assert.equal(beat.lastBeatAt, '2026-09-22T06:00:00.000Z');

  // PHÉP PHÁ: bỏ luật loại dòng bước 0 thì đúng ca này ra `fresh` — tức là
  // ô của làn không bao giờ đỏ được, vì bước 0 ghi ở MỌI lượt worker.
  const newestIncludingStep0 = lines.map((l) => l.at).sort().at(-1);
  assert.equal(newestIncludingStep0, '2026-09-23T11:55:00.000Z');
  const hoursIfStep0Counted = (Date.parse(NOW) - Date.parse(newestIncludingStep0!)) / 3_600_000;
  assert.ok(hoursIfStep0Counted < LANE_THRESHOLD_HOURS.integration);
});

test('Z7 · dòng bước 0 cũng bị loại ở làn `platform` — file dùng chung cũ nằm ở đó', () => {
  const lines = [
    line('2026-09-21T00:00:00.000Z', 'platform', 'platform/P-016'),
    line('2026-09-23T11:00:00.000Z', 'platform', 'platform/P-016'),
  ];
  assert.equal(beatOf(laneHeartbeats(lines, NOW), 'platform').verdict, 'never');
});

// ── Năm hình dạng `ref` của bước 0 ────────────────────────────────────────

test('Z7 · `isStep0Ref` nhận đủ năm hình dạng đã từng được ghi', () => {
  for (const ref of [
    'integration/step0-2026-09-23T144500Z-crux-worker-1',
    'platform/P1-step0-2026-09-21T15h15',
    'integration/P3-run-2026-09-22T04h05',
    'integration/P3-daily-2026-09-21',
    STEP0_LEGACY_REF,
  ]) {
    assert.equal(isStep0Ref(ref), true, ref);
  }
});

test('Z7 · `isStep0Ref` KHÔNG nhận nhầm `ref` nào NGOÀI file dùng chung cũ', () => {
  for (const ref of [
    'integration/I-018',
    'platform/P-014',
    'platform/P-0161', // không phải file dùng chung cũ, chỉ trông giống
    'verify/VF-G12',
    'topic/step0notes', // thiếu gạch nối — không phải tiền tố bước 0
  ]) {
    assert.equal(isStep0Ref(ref), false, ref);
  }
  // Đánh đổi đã khai ở docblock của `STEP0_LEGACY_REF`: file dùng chung cũ
  // TRỘN dòng bước 0 với 8 dòng việc thật của mục `P-016`, và cả 60 dòng
  // mang cùng một `ref` nên không tách được. Luật loại cả cụm — hướng lệch
  // an toàn (làn trông cũ hơn thật), và bài kiểm này nói thẳng ra thay vì
  // để tiêu đề ở trên nghe như luật không bỏ sót gì.
  assert.equal(isStep0Ref(STEP0_LEGACY_REF), true);
});

test('Z7 · `watchdog.yml` KHÔNG còn bản chép thứ hai của bộ lọc bước 0 — nó gọi TypeScript', () => {
  // ## Bài này đã đổi việc, và vì sao đổi là phần đáng đọc
  //
  // Bản trước khẳng định điều yếu hơn: *đúng một dòng `jq` của `watchdog.yml`
  // phải chép NGUYÊN VĂN hằng `STEP0_REF_PATTERN`*. Nó canh được một bản chép
  // lệch, và nó đã bắt thật hai hình dạng bị thiếu (`P1-step0-`, `P3-daily-`).
  // Nhưng nó cũng **hợp pháp hoá** chính bản chép đó: luật lọc tồn tại ở hai
  // chỗ, viết bằng hai ngôn ngữ, và bài kiểm chỉ giữ cho chúng giống nhau.
  //
  // Mục `platform/P-043` bỏ bản chép: dấu hiệu số 5 của `watchdog.yml` nay gọi
  // `ops/scripts/heartbeat-source.ts`, và script đó gọi `isStep0Ref` ngay dưới
  // đây. Một chỗ giữ luật thì không còn hai bản để lệch — nên bài kiểm đổi từ
  // *"hai bản phải giống nhau"* sang *"chỉ được có một bản"*.
  //
  // ⚠️ **Không phải "chặt hơn" trên mọi chiều, và bản đầu của chú thích này khai
  // quá lời.** Vòng soát ngữ cảnh sạch của PR #229 đo được: bài CŨ đòi dòng `jq`
  // mang **nguyên văn** hằng, nên nó đỏ cả khi dòng đó bị **viết lại** bằng một
  // biểu thức tương đương; bài này chỉ cấm bản chép nguyên văn, nên một biểu
  // thức viết lại đi qua tự do. Lỗ đó được bịt ở `ops/test/heartbeat-source.test.ts`
  // (bài `LAST_BEAT` PHẢI đến từ output của script), không bằng lời khẳng định ở
  // đây.
  const yml = readFileSync('ops/workflows/watchdog.yml', 'utf8');
  const execLines = yml.split('\n').filter((raw) => !raw.trimStart().startsWith('#'));

  // Ca âm quan trọng nhất: một lượt sau tiện tay chép biểu thức trở lại vào
  // `jq` (ví dụ để "khỏi phải gọi node"), và từ đó hai bản lại lệch được.
  const copies = execLines.filter((raw) => raw.includes(STEP0_REF_PATTERN) || raw.includes(STEP0_LEGACY_REF));
  assert.deepEqual(
    copies,
    [],
    'Một dòng THỰC THI của `watchdog.yml` đang chép lại bộ lọc dòng bước 0. ' +
      'Luật đó chỉ được tồn tại ở `isStep0Ref`; hai bản là hai chỗ để lệch nhau im lặng (Z7).',
  );

  // Và chiều ngược lại: bỏ bản chép mà cũng không gọi script thì dấu hiệu số
  // 5 đã biến mất hẳn — im lặng, không gì đỏ.
  const calls = execLines.filter((raw) => raw.includes('heartbeat-source.ts'));
  assert.ok(
    calls.length > 0,
    '`watchdog.yml` không gọi `ops/scripts/heartbeat-source.ts` — dấu hiệu số 5 không còn nguồn nhịp tim nào.',
  );
});

// ── Ngưỡng theo làn ──────────────────────────────────────────────────────

test('Z7 · ngưỡng theo làn: cùng một khoảng 10 giờ, `platform` đỏ mà `visual` xanh', () => {
  const at = '2026-09-23T02:00:00.000Z';
  const beats = laneHeartbeats([line(at, 'platform', 'platform/P-014'), line(at, 'visual', 'visual/V-003')], NOW);
  assert.equal(beatOf(beats, 'platform').verdict, 'stale');
  assert.equal(beatOf(beats, 'visual').verdict, 'fresh');
});

test('Z7 · mốc Ở TƯƠNG LAI ra `future`, KHÔNG ra `fresh` — số âm nhỏ hơn mọi ngưỡng', () => {
  // Ca thật, không dựng: dòng log của chính PR này mang `at` sớm hơn đồng
  // hồ ~10 phút và làn `platform` hiện ra `-0,14h … fresh`. Một dòng ghi
  // nhầm năm thì làn đó KHÔNG BAO GIỜ `stale` được, và không gì đỏ.
  const beats = laneHeartbeats([line('2026-09-24T12:00:00.000Z', 'visual', 'visual/V-003')], NOW);
  const visual = beatOf(beats, 'visual');
  assert.equal(visual.verdict, 'future');
  assert.equal(visual.hoursSinceLastBeat, -24);
  assert.notEqual(visual.verdict, 'fresh');
});

test('Z7 · lệch đồng hồ vài giây vẫn là `fresh` — dung sai, không phải báo động', () => {
  const beats = laneHeartbeats([line('2026-09-23T12:00:10.000Z', 'visual', 'visual/V-003')], NOW);
  assert.equal(beatOf(beats, 'visual').verdict, 'fresh');
});

test('Z7 · `future` ra dòng cảnh báo riêng, nói rõ làn đó không bao giờ `stale` được', () => {
  const problems = laneHeartbeatProblems(
    laneHeartbeats([line('2026-09-24T12:00:00.000Z', 'visual', 'visual/V-003')], NOW),
  );
  const futureLine = problems.find((p) => p.includes('TƯƠNG LAI'));
  assert.ok(futureLine !== undefined, `không có dòng cho ca future: ${JSON.stringify(problems)}`);
  assert.match(futureLine, /`visual`/);
  assert.match(futureLine, /KHÔNG BAO GIỜ/);
});

test('Z7 · thiếu ngưỡng của một làn thì NÉM — không để `> undefined` biến nó thành `fresh` vĩnh viễn', () => {
  const broken = { ...LANE_THRESHOLD_HOURS } as Record<string, number>;
  delete broken.visual;
  assert.throws(
    () =>
      laneHeartbeats(
        [line('2026-09-01T00:00:00.000Z', 'visual', 'visual/V-003')],
        NOW,
        broken as typeof LANE_THRESHOLD_HOURS,
      ),
    /visual/,
  );
});

test('Z7 · bên gọi thay được bảng ngưỡng', () => {
  const thresholds = { ...LANE_THRESHOLD_HOURS, visual: 1 };
  const beats = laneHeartbeats([line('2026-09-23T09:00:00.000Z', 'visual', 'visual/V-003')], NOW, thresholds);
  assert.equal(beatOf(beats, 'visual').verdict, 'stale');
});

// ── Không quét được thì NÉM, không trả mười kết luận ──────────────────────

test('Z7 · `ops/logs` không có dòng nào thì NÉM — không trả mười ô `never` (bài học Z15)', () => {
  assert.throws(() => laneHeartbeats([], NOW), LaneHeartbeatUnreadable);
});

test('Z7 · `now` không đọc được thì ném, không lặng lẽ ra NaN giờ', () => {
  assert.throws(() => laneHeartbeats([line(NOW, 'platform', 'platform/P-014')], 'hôm qua'), /now/);
});

// ── Thân cảnh báo ────────────────────────────────────────────────────────

test('Z7 · mọi làn `fresh` thì không có dòng cảnh báo nào', () => {
  const beats = LANES.map((lane) => ({
    lane,
    lastBeatAt: NOW,
    hoursSinceLastBeat: 0,
    thresholdHours: LANE_THRESHOLD_HOURS[lane],
    verdict: 'fresh' as const,
  }));
  assert.deepEqual(laneHeartbeatProblems(beats), []);
});

test('Z7 · `stale` và `never` ra HAI dòng riêng, không trộn', () => {
  const beats = laneHeartbeats(
    [line('2026-09-22T06:00:00.000Z', 'visual', 'visual/V-003'), line(NOW, 'platform', 'platform/P-014')],
    NOW,
  );
  const problems = laneHeartbeatProblems(beats);
  assert.equal(problems.length, 2);
  assert.match(problems[0]!, /quá ngưỡng \(Z7\)/);
  assert.match(problems[0]!, /`visual` 30h\/26h/);
  assert.doesNotMatch(problems[0]!, /chưa có dòng log nào/);
  assert.match(problems[1]!, /chưa có dòng log nào/);
  assert.match(problems[1]!, /`release`/);
});

test('Z7 · bảng người đọc in đủ mười làn, kể cả làn xanh', () => {
  const rendered = renderLaneHeartbeats(laneHeartbeats([line(NOW, 'platform', 'platform/P-014')], NOW));
  for (const lane of LANES) assert.ok(rendered.includes(lane), `bảng thiếu làn ${lane}`);
});

// ── Chạy trên log THẬT của repo ──────────────────────────────────────────

test('Z7 · trên `ops/logs` thật: đủ mười làn, và không ô nào lấy mốc từ một dòng bước 0', () => {
  const lines = readRunLogs('ops/logs');
  assert.ok(lines.length > 0, 'ops/logs không đọc được dòng nào');
  const beats = laneHeartbeats(lines, new Date().toISOString());
  assert.equal(beats.length, LANES.length);

  for (const beat of beats) {
    if (beat.lastBeatAt === null) continue;
    const source = lines.filter((l) => l.lane === beat.lane && l.at === beat.lastBeatAt);
    assert.ok(source.length > 0, `không tìm lại được dòng nguồn của làn ${beat.lane}`);
    assert.ok(
      source.some((l) => !isStep0Ref(l.ref)),
      `mốc của làn ${beat.lane} tới từ một dòng bước 0 — luật loại dòng bước 0 đã hỏng`,
    );
  }
});
