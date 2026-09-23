#!/usr/bin/env node
/**
 * Nhịp tim **theo từng làn** — chỗ `Z7` của nhóm Z (`ops/known-failures.md`),
 * sóng 3 của mục `platform/P-014`.
 *
 * Chỗ hỏng mà Z7 gọi tên: một routine bị tắt, hết lượt, hoặc đơn giản là
 * không bao giờ nhận được việc của một làn. Khi đó **cả một làn** đứng im,
 * và không có lần chạy nào để mà đỏ — backlog đứng yên trông y hệt backlog
 * đã xong. Không một chỉ báo nào hiện có nói ra điều đó.
 *
 * ## Vì sao `watchdog` dấu hiệu số 5 KHÔNG phủ được chỗ này
 *
 * Dấu hiệu số 5 (`ops/workflows/watchdog.yml`, mục `P-020`) lấy `max` của
 * `at` trên **mọi** dòng bước 0 và gọi đó là nhịp tim. Nhịp tim ấy đúng cho
 * câu hỏi *"routine worker/integrator còn chạy không"* và sai cho câu hỏi
 * *"làn nào đang đứng im"*, vì bước 0 ghi một dòng ở **mọi** lượt worker
 * (phụ lục P3 bước 0d) — nên chừng nào còn một worker thở, `max` còn mới,
 * bất kể chín làn kia đã im mấy ngày.
 *
 * Đo được lúc viết mục này (2026-09-23T14:50Z, `readRunLogs` trên
 * `ops/logs`, 227 dòng):
 *
 * | Làn | Dòng mới nhất, TÍNH cả bước 0 | Dòng mới nhất, TRỪ bước 0 |
 * |---|---|---|
 * | `integration` | **2,2 giờ** | **23,4 giờ** |
 * | `platform` | 9,9 giờ | 9,9 giờ |
 * | `audio` | 20,3 giờ | 20,3 giờ |
 * | `topic` | 25,8 giờ | 25,8 giờ |
 * | `kernel` | 29,0 giờ | 29,0 giờ |
 * | `editorial` | 35,6 giờ | 35,6 giờ |
 * | `verify` | 36,8 giờ | 36,8 giờ |
 * | `visual` | 37,6 giờ | 37,6 giờ |
 * | `assembly` | — chưa có dòng nào — | — |
 * | `release` | — chưa có dòng nào — | — |
 *
 * Cột giữa và cột phải của hàng `integration` lệch nhau **hơn 21 giờ**: làn
 * `integration` trông như vừa chạy xong, trong khi việc thật của nó im từ
 * hôm trước. Đó chính là hình dạng Z, đo được chứ không phải suy.
 *
 * ## Ba luật thiết kế, cả ba đều là chỗ dễ làm sai
 *
 * 1. **Dòng bước 0 bị loại khỏi phép đo của MỌI làn**, không riêng
 *    `integration`. Bảng trên là lý do: để chúng lại thì ô của làn không
 *    bao giờ cũ được, và một luật không bao giờ đỏ là một luật không có
 *    giá trị. Không mất gì cả — dấu hiệu số 5 đã đọc đúng những dòng đó
 *    cho đúng câu hỏi của nó.
 *
 * 2. **`chưa có dòng nào` KHÁC `có dòng nhưng đã cũ`.** Hai trạng thái, hai
 *    nguyên nhân, hai việc phải làm — gộp lại là đúng bài học `Z15`. Nên
 *    `verdict` có ba giá trị, không phải hai.
 *
 * 3. **Không dòng log nào đọc được thì NÉM, không trả mười ô `never`.**
 *    Bất biến I8 đòi mọi lần chạy ghi một dòng, nên một `ops/logs` rỗng
 *    nghĩa là *chưa quét được*, không phải *quét rồi không thấy gì*. Trả
 *    mười ô `never` trong ca đó là biến một phép đo hỏng thành mười kết
 *    luận trông chắc nịch — lại đúng `Z15`.
 */

import { LANES, type LaneName } from '../../kernel/src/envelope.ts';
import { readRunLogs, type RunLogLine } from '../../kernel/src/log.ts';

// ── Dòng bước 0: năm hình dạng `ref`, không phải ba ───────────────────────

/**
 * Biểu thức nhận ra `ref` của một dòng **bước 0**, dạng chuỗi để cả `RegExp`
 * của TypeScript lẫn `test()` của `jq` trong `ops/workflows/watchdog.yml`
 * dùng **cùng một** văn bản.
 *
 * Vì sao là một hằng chuỗi chứ không phải hai bản chép: bước 0 đã đổi chỗ
 * ghi **ba** lần và log là append-only, nên dòng cũ ở lại nguyên chỗ
 * (`P-023`). Danh sách hình dạng vì thế chỉ dài ra, không ngắn đi, và hai
 * bên đọc nó bằng hai ngôn ngữ khác nhau. Một bản chép lệch đi là một nguồn
 * nhịp tim biến mất mà không gì đỏ — nên `ops/test/lane-heartbeat.test.ts`
 * đọc thẳng `watchdog.yml` và so với hằng này.
 *
 * ⚠️ **Đo được lúc viết: bản trong `watchdog.yml` đang thiếu hai hình dạng.**
 * Nó mang `(^|/)(step0|P3-run)-`, trong khi `ops/logs` thật có cả
 * `platform/P1-step0-<ngày>T<giờ>h<phút>` — chuỗi `step0-` ở đó đứng sau
 * `P1-`, không đứng sau `/`, nên không khớp. Hình dạng `P3-daily-<ngày>`
 * cũng được chính `P-023` liệt kê là một trong ba hình dạng cũ. PR này sửa
 * `watchdog.yml` cho khớp.
 */
export const STEP0_REF_PATTERN = '(^|/)(step0|P1-step0|P3-run|P3-daily)-';

/** File dùng chung cũ nhất của bước 0, trước khi nó có tiền tố riêng (`P-023`). */
export const STEP0_LEGACY_REF = 'platform/P-016';

/**
 * `true` khi `ref` là của một dòng bước 0.
 *
 * Hỏi bằng `ref` chứ không bằng đường dẫn file: `P-023` đã đổi tên file một
 * lần và sẽ đổi nữa, còn `ref` là thứ chính bên ghi sinh ra (`step0LogRef`).
 */
export function isStep0Ref(ref: string): boolean {
  return new RegExp(STEP0_REF_PATTERN).test(ref) || ref === STEP0_LEGACY_REF;
}

// ── Ngưỡng theo làn ──────────────────────────────────────────────────────

/**
 * Ngưỡng im lặng, tính bằng giờ, cho từng làn — Z7 đòi ngưỡng **theo làn**
 * vì các làn chạy nhịp khác nhau.
 *
 * Hai con số, và cả hai **mượn từ chính `watchdog.yml`** thay vì bịa mới:
 *
 * - `6` giờ cho `platform` và `integration` — hai làn mà mọi lượt worker
 *   đều đi qua (hàng đợi merge, hạ tầng). Đây là ngưỡng của dấu hiệu số 2
 *   ("không PR nào merge trong 6 giờ"), do chủ dự án chốt trên issue bản
 *   tin `#17`.
 * - `26` giờ cho các làn còn lại — một nhịp ngày cộng lề, đúng ngưỡng của
 *   dấu hiệu số 1 ("quá 26 giờ không có bản tin mới"). Các làn xưởng chạy
 *   theo nhịp ngày, không theo nhịp giờ.
 *
 * Mượn số đã có, không phát minh số mới: mười con số bịa ra là mười chỗ
 * phải cãi nhau và không chỗ nào có nguồn. Chỉnh lại khi các làn thật sự
 * chạy đều và có nhịp đo được — lúc đó con số mới có nguồn.
 */
export const LANE_THRESHOLD_HOURS: Readonly<Record<LaneName, number>> = Object.freeze({
  topic: 26,
  editorial: 26,
  visual: 26,
  audio: 26,
  assembly: 26,
  release: 26,
  kernel: 26,
  verify: 26,
  platform: 6,
  integration: 6,
});

// ── Phần thuần ───────────────────────────────────────────────────────────

/**
 * `fresh` — có dòng mới trong ngưỡng.
 * `stale` — có dòng, nhưng dòng mới nhất đã quá ngưỡng.
 * `never` — làn chưa có dòng nào, kể từ đầu.
 */
export type LaneVerdict = 'fresh' | 'stale' | 'never';

export interface LaneHeartbeat {
  lane: LaneName;
  /** `at` của dòng **không phải bước 0** mới nhất của làn; `null` khi làn chưa có dòng nào. */
  lastBeatAt: string | null;
  /** Số giờ từ `lastBeatAt` tới `now`; `null` khi `verdict` là `never`. */
  hoursSinceLastBeat: number | null;
  thresholdHours: number;
  verdict: LaneVerdict;
}

/**
 * Ném khi không có dòng log nào đọc được — xem luật thiết kế 3 ở đầu file.
 * Lớp riêng để bên gọi phân biệt được "chưa quét được" với một lỗi khác.
 */
export class LaneHeartbeatUnreadable extends Error {}

function hoursBetween(fromIso: string, nowMs: number): number {
  return Math.round(((nowMs - Date.parse(fromIso)) / 3_600_000) * 100) / 100;
}

/**
 * Nhịp tim của **mọi** làn trong `LANES`, kể cả làn chưa có dòng nào — một
 * làn vắng mặt khỏi kết quả là một làn không ai nhìn.
 *
 * `now` do bên gọi truyền vào để hàm thuần và test không phụ thuộc đồng hồ.
 */
export function laneHeartbeats(
  lines: readonly RunLogLine[],
  now: string,
  thresholds: Readonly<Record<LaneName, number>> = LANE_THRESHOLD_HOURS,
): LaneHeartbeat[] {
  if (lines.length === 0) {
    throw new LaneHeartbeatUnreadable(
      'Không đọc được dòng log nào — KHÔNG QUÉT ĐƯỢC nhịp tim của làn nào. ' +
        'Bất biến I8 đòi mọi lần chạy ghi một dòng, nên `ops/logs` rỗng nghĩa là phép đọc hỏng, ' +
        'không phải mười làn cùng chưa chạy (bài học Z15).',
    );
  }
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) throw new Error(`\`now\` không đọc được: ${JSON.stringify(now)}`);

  const newest = new Map<LaneName, string>();
  for (const line of lines) {
    if (isStep0Ref(line.ref)) continue; // luật thiết kế 1
    const seen = newest.get(line.lane);
    if (seen === undefined || Date.parse(line.at) > Date.parse(seen)) newest.set(line.lane, line.at);
  }

  return LANES.map((lane) => {
    const thresholdHours = thresholds[lane];
    const lastBeatAt = newest.get(lane) ?? null;
    if (lastBeatAt === null) {
      return { lane, lastBeatAt: null, hoursSinceLastBeat: null, thresholdHours, verdict: 'never' as const };
    }
    const hoursSinceLastBeat = hoursBetween(lastBeatAt, nowMs);
    return {
      lane,
      lastBeatAt,
      hoursSinceLastBeat,
      thresholdHours,
      verdict: hoursSinceLastBeat > thresholdHours ? ('stale' as const) : ('fresh' as const),
    };
  });
}

/**
 * Các dòng gạch đầu dòng cho thân cảnh báo của `watchdog` — một dòng cho
 * `stale`, một dòng gom cho `never`, và rỗng khi mọi làn đều `fresh`.
 *
 * Tách `never` ra một dòng riêng chứ không trộn vào danh sách `stale`: hai
 * trạng thái đó đòi hai việc khác nhau (một làn cũ cần biết *vì sao nó
 * dừng*; một làn chưa chạy lần nào cần biết *đã có ai nhận việc của nó
 * chưa*), và gộp lại là đúng chỗ `Z15` đã dạy.
 */
export function laneHeartbeatProblems(beats: readonly LaneHeartbeat[]): string[] {
  const problems: string[] = [];
  const stale = beats.filter((b) => b.verdict === 'stale');
  if (stale.length > 0) {
    problems.push(
      `${stale.length} làn không có dòng log mới quá ngưỡng (Z7): ` +
        stale.map((b) => `\`${b.lane}\` ${b.hoursSinceLastBeat}h/${b.thresholdHours}h`).join(' · '),
    );
  }
  const never = beats.filter((b) => b.verdict === 'never');
  if (never.length > 0) {
    problems.push(
      `${never.length} làn chưa có dòng log nào: ` +
        never.map((b) => `\`${b.lane}\``).join(' · ') +
        ' — khác với "đã chạy rồi im", chỗ cần xem là backlog của làn đã có ai nhận chưa.',
    );
  }
  return problems;
}

/** Bảng người đọc, in ra log của lượt chạy kể cả khi mọi làn đều `fresh`. */
export function renderLaneHeartbeats(beats: readonly LaneHeartbeat[]): string {
  const mark = { fresh: '✓', stale: '✗', never: '·' } as const;
  const rows = beats.map(
    (b) =>
      `  ${mark[b.verdict]} ${b.lane.padEnd(12)}` +
      (b.lastBeatAt === null
        ? 'chưa có dòng log nào'
        : `${String(b.hoursSinceLastBeat).padStart(7)}h  (ngưỡng ${b.thresholdHours}h)  ${b.lastBeatAt}`),
  );
  return `Nhịp tim theo làn — dòng log KHÔNG phải bước 0, mới nhất của mỗi làn:\n${rows.join('\n')}`;
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('lane-heartbeat.ts') === true;

if (isMain) {
  const asJson = process.argv.includes('--json');
  let beats: LaneHeartbeat[];
  try {
    beats = laneHeartbeats(readRunLogs('ops/logs'), new Date().toISOString());
  } catch (error) {
    // Không nuốt: "chưa quét được" phải to hơn "quét rồi không thấy gì".
    process.stderr.write(`⚠ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  const problems = laneHeartbeatProblems(beats);
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ beats, problems }, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderLaneHeartbeats(beats)}\n`);
    process.stdout.write(
      problems.length === 0 ? 'Mọi làn đều có dòng log trong ngưỡng.\n' : `${problems.map((p) => `- ${p}\n`).join('')}`,
    );
  }
  // Thoát 0 kể cả khi có làn im: đây là phép ĐO cho bên gọi (watchdog, bản
  // tin), không phải một cổng chặn. Chỉ ca "không quét được" mới khác 0.
}
