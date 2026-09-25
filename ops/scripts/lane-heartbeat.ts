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
 *
 *    ⚠️ Ranh giới của luật này, khai ra vì nó hẹp hơn người đọc tưởng: ca
 *    *"đọc được dòng, nhưng không dòng nào không-phải-bước-0"* **không**
 *    ném — nó trả mười ô `never`, và đó là kết luận ĐÚNG: phép đọc đã chạy
 *    và câu trả lời thật là "chưa làn nào làm việc gì". Luật 3 nói về
 *    *chưa nhìn*, không nói về *nhìn rồi không thấy*.
 *
 * 4. **Mốc ở TƯƠNG LAI là một verdict riêng, không phải `fresh`.** Một
 *    dòng log ghi nhầm năm, hay một đồng hồ lệch, cho `hoursSinceLastBeat`
 *    ÂM — và một số âm thì luôn nhỏ hơn mọi ngưỡng, nên làn đó `fresh`
 *    vĩnh viễn và không gì đỏ. Đúng hình dạng Z mà chính file này sinh ra
 *    để giết. Vòng soát ngữ cảnh sạch của PR này tìm ra nó bằng chạy thật,
 *    trên chính dòng log của PR: `platform … -0.14h … fresh`.
 */

import { LANES, type LaneName } from '../../kernel/src/envelope.ts';
import { readRunLogs, type RunLogLine } from '../../kernel/src/log.ts';

// ── Dòng bước 0: năm hình dạng `ref`, không phải ba ───────────────────────

/**
 * Biểu thức nhận ra `ref` của một dòng **bước 0**. Đây là **chỗ duy nhất**
 * giữ luật đó; mọi bên đọc gọi `isStep0Ref` ngay dưới.
 *
 * Vì sao là một hằng chuỗi chứ không phải nhiều bản chép: bước 0 đã đổi chỗ
 * ghi **ba** lần và log là append-only, nên dòng cũ ở lại nguyên chỗ
 * (`P-023`). Danh sách hình dạng vì thế chỉ dài ra, không ngắn đi, và một
 * bản chép lệch đi là một nguồn nhịp tim biến mất mà không gì đỏ.
 *
 * ## Lịch sử của chính chỗ này, giữ lại vì nó là bằng chứng
 *
 * Trước mục `platform/P-043`, luật này tồn tại ở **hai** chỗ viết bằng hai
 * ngôn ngữ: hằng dưới đây, và một biểu thức `test()` của `jq` chép tay trong
 * `ops/workflows/watchdog.yml`. Bản chép **đã lệch thật**: nó mang
 * `(^|/)(step0|P3-run)-` và thiếu hai hình dạng mà `ops/logs` thật đang có —
 * `platform/P1-step0-…` (chuỗi `step0-` đứng sau `P1-`, không sau `/`, nên
 * không khớp) và `P3-daily-…`. Lúc đó `ops/test/lane-heartbeat.test.ts` đọc
 * thẳng YAML và **so chuỗi** để giữ hai bản giống nhau.
 *
 * `P-043` bỏ hẳn bản chép: dấu hiệu số 5 của `watchdog.yml` nay gọi
 * `ops/scripts/heartbeat-source.ts`, và script đó gọi `isStep0Ref`. Bài kiểm
 * vì thế đổi việc — nó **cấm** một dòng thực thi của YAML chép lại hằng này,
 * thay vì đòi hai bản trùng nhau. Đừng đi tìm bản `jq` nữa: nó không còn.
 */
export const STEP0_REF_PATTERN = '(^|/)(step0|P1-step0|P3-run|P3-daily)-';

/**
 * File dùng chung cũ nhất của bước 0, trước khi nó có tiền tố riêng (`P-023`).
 *
 * ⚠️ **Đánh đổi đã đo, khai ra chứ không giấu:** cụm dòng mang `ref` này
 * TRỘN hai loại dòng — đo được lúc viết: 60 dòng, trong đó **52** là dòng
 * bước 0 và **8** là dòng việc thật của chính mục `P-016` (ghim
 * `priority.md`, viết `integrator-resolve.ts`, các dòng đính chính). Cả 60
 * mang cùng một `ref`, nên không có cách nào tách chúng bằng `ref`, và luật
 * này loại cả 8 dòng việc thật khỏi nhịp tim của làn `platform`.
 *
 * Chọn hướng lệch **an toàn**: làn trông **cũ hơn** sự thật, tức luật có thể
 * báo thừa, không bao giờ báo thiếu. Hướng ngược lại — giữ cả 60 dòng — là
 * hướng im lặng, và im lặng là thứ nhóm Z cấm.
 */
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
 * `fresh`  — có dòng mới trong ngưỡng.
 * `stale`  — có dòng, nhưng dòng mới nhất đã quá ngưỡng.
 * `never`  — làn chưa có dòng nào, kể từ đầu.
 * `future` — dòng mới nhất mang mốc Ở TƯƠNG LAI (xem luật thiết kế 4).
 */
export type LaneVerdict = 'fresh' | 'stale' | 'never' | 'future';

/**
 * Dung sai cho `future`, tính bằng giờ. Không phải 0: đồng hồ của máy chạy
 * routine và đồng hồ của máy ghi dòng log là hai đồng hồ khác nhau, lệch
 * vài giây là bình thường và không đáng báo. Lệch tới hàng phút thì không
 * còn là trôi đồng hồ nữa — đó là một mốc ghi sai.
 */
export const FUTURE_TOLERANCE_HOURS = 1 / 60;

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
    // Một ngưỡng thiếu cho `hoursSinceLastBeat > undefined` = false, tức
    // làn đó `fresh` vĩnh viễn — cùng chiều fail-open với `future` dưới
    // đây. `tsc` che được ca bảng thiếu khoá, nhưng bên gọi JavaScript
    // hoặc một `LANES` vừa dài ra thì không, nên chặn cứng ở đây.
    if (typeof thresholdHours !== 'number' || !Number.isFinite(thresholdHours)) {
      throw new Error(`Thiếu ngưỡng cho làn ${JSON.stringify(lane)} — không đoán một ngưỡng thay cho nó.`);
    }
    const lastBeatAt = newest.get(lane) ?? null;
    if (lastBeatAt === null) {
      return { lane, lastBeatAt: null, hoursSinceLastBeat: null, thresholdHours, verdict: 'never' as const };
    }
    const hoursSinceLastBeat = hoursBetween(lastBeatAt, nowMs);
    const verdict: LaneVerdict =
      hoursSinceLastBeat < -FUTURE_TOLERANCE_HOURS
        ? 'future'
        : hoursSinceLastBeat > thresholdHours
          ? 'stale'
          : 'fresh';
    return { lane, lastBeatAt, hoursSinceLastBeat, thresholdHours, verdict };
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
  const future = beats.filter((b) => b.verdict === 'future');
  if (future.length > 0) {
    problems.push(
      `${future.length} làn có dòng log mang mốc Ở TƯƠNG LAI: ` +
        future.map((b) => `\`${b.lane}\` ${b.lastBeatAt}`).join(' · ') +
        ' — đồng hồ lệch hoặc `at` ghi sai. Chừng nào chưa sửa, làn đó KHÔNG BAO GIỜ `stale` được (bất biến I8: `at` phải là giờ thật của lượt chạy).',
    );
  }
  return problems;
}

/** Bảng người đọc, in ra log của lượt chạy kể cả khi mọi làn đều `fresh`. */
export function renderLaneHeartbeats(beats: readonly LaneHeartbeat[]): string {
  const mark = { fresh: '✓', stale: '✗', never: '·', future: '⏱' } as const;
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
    // "Chưa quét được" ra stderr và mã thoát 2, không lẫn vào đầu ra bình
    // thường. Giới hạn đã khai: ở `watchdog.yml` dấu hiệu số 6 bắt mã thoát
    // này và chỉ in một dòng, KHÔNG gọi `add` — nên nó không tự mở issue.
    // Chỗ đó không im lặng vì dấu hiệu số 5 đọc cùng `ops/logs` và CÓ gọi
    // `add` khi không đọc được dòng bước 0 nào.
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
