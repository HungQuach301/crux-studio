#!/usr/bin/env node
/**
 * Mục `platform/P-043` — **nhịp tim của routine phải đọc được mà không cần
 * một PR nào merge.**
 *
 * ## Vì sao mục này tồn tại
 *
 * `watchdog.yml` dấu hiệu số 5 (CHARTER 2.4, ngưỡng 3 giờ) biết nhà máy còn
 * sống bằng cách quét `ops/logs` của **bản đã checkout**, tức bản trên
 * `main`. Nên nhịp tim chỉ đập khi một PR vào `main`. Trong một khoảng yên —
 * không PR nào xung đột, mọi mục `ready` đều đã có PR — không gì vào `main`,
 * và người canh gọi chủ dự án vì một nhà máy đang chạy đúng.
 *
 * Đó là chỗ hai luật cắn nhau mà `🤖 [QĐ]` **#213** mở ra. Chủ dự án trả lời
 * lúc `2026-09-24T06:10:33Z`, nguyên văn:
 *
 * > Đồng ý bỏ PR log của bước 0, với điều kiện: chuyển nguồn nhịp tim của
 * > watchdog sang nơi khác (nhánh claude/telemetry của R2 hoặc tương đương)
 * > TRƯỚC khi bỏ, và chứng minh bằng một lần chạy thật watchdog đọc được
 * > nhịp tim từ nguồn mới. Không có khoảng thời gian nào watchdog mất tín
 * > hiệu. Nếu đã bỏ rồi thì hoàn tác cho tới khi đủ điều kiện trên.
 *
 * Đây là comment của chủ dự án trên một issue nhãn `decision`, tức một
 * trong ba chỗ mà `CLAUDE.md` mục 5 coi là **lệnh** chứ không phải dữ liệu.
 * File này là vế "chuyển nguồn ... TRƯỚC khi bỏ". Phần bỏ PR log
 * (`platform/P-038`) **không** đi cùng PR này — nó chờ lần chạy thật.
 *
 * ## "Không có khoảng thời gian nào watchdog mất tín hiệu" là một phép `max`
 *
 * Hướng dễ sai là **thay** nguồn: trỏ dấu hiệu số 5 sang nhánh telemetry
 * rồi bỏ `main` ra. Lúc đó có đúng một khoảng — từ khi workflow mới lên
 * `main` tới lượt routine đầu tiên ghi vào nhánh mới — mà nguồn mới còn
 * rỗng và nguồn cũ đã bị bỏ, tức người canh câm. Không gì đỏ trong khoảng
 * đó: `watchdog.yml` xanh, `pnpm check` xanh, chỉ là một dấu hiệu đã tắt.
 * Nhóm **Z** thuần.
 *
 * Nên hàm này **cộng** nguồn chứ không thay: nhịp tim là `max` trên tất cả
 * các nguồn, và mỗi nguồn được khai riêng trong `readings` để bên gọi nói
 * được nguồn nào đã trả lời. Bỏ một nguồn khỏi danh sách chỉ làm nhịp tim
 * **cũ hơn** sự thật, không bao giờ mới hơn — hướng lệch an toàn, cùng
 * hướng mà `lane-heartbeat.ts` đã chọn cho `STEP0_LEGACY_REF`.
 *
 * ## Cấm im lặng: ba trạng thái của một nguồn, không phải hai
 *
 * `null` gộp hai chuyện khác nhau, và gộp chúng là cách dấu hiệu này hỏng
 * lặng lẽ:
 *
 * - **`missing`** — thư mục nguồn không tồn tại. Nhánh telemetry chưa được
 *   tạo, hoặc bước fetch của workflow đã thất bại. Đây là "chưa biết".
 * - **nguồn rỗng** — thư mục có, không dòng bước 0 nào. Đây là "đã đo, và
 *   câu trả lời là không có gì".
 *
 * Một nguồn `missing` mà bị đọc thành "rỗng" nghĩa là: fetch hỏng, nhịp tim
 * rơi về đúng nguồn cũ, và không ai biết nguồn mới đã chết. Vì vậy
 * `heartbeatProblems` báo ra `missing` **kể cả khi** nhịp tim tổng vẫn còn
 * mới.
 *
 * ## Bộ lọc dòng bước 0 chỉ còn MỘT bản
 *
 * Trước mục này, biểu thức lọc `ref` của dòng bước 0 nằm ở **hai** chỗ viết
 * bằng **hai** ngôn ngữ: hằng `STEP0_REF_PATTERN` của
 * `ops/scripts/lane-heartbeat.ts`, và một biểu thức `jq` chép tay trong
 * `watchdog.yml`. Bản chép đã lệch thật một lần (thiếu hai hình dạng
 * `P1-step0-` và `P3-daily-`), và `ops/test/lane-heartbeat.test.ts` phải
 * dựng một bài đọc thẳng YAML rồi so chuỗi để canh nó.
 *
 * Nay `watchdog.yml` gọi **file này**, và file này gọi `isStep0Ref`. Một
 * chỗ giữ luật, nên không còn hai bản để lệch — bài kiểm YAML đổi việc:
 * thay vì so nguyên văn hằng, nó khẳng định YAML **không** còn chép hằng
 * nữa và **có** gọi script này.
 */

import { existsSync, statSync } from 'node:fs';
import { readRunLogs } from '../../kernel/src/log.ts';
import { isStep0Ref } from './lane-heartbeat.ts';

/** Một nguồn nhịp tim: tên để báo cáo, và thư mục chứa các file `.jsonl`. */
export interface HeartbeatSource {
  name: string;
  dir: string;
}

/** Kết quả đo **một** nguồn. Ba trạng thái, không phải hai — xem khối đầu file. */
export interface HeartbeatReading {
  name: string;
  dir: string;
  /** `at` mới nhất trong các dòng bước 0 của nguồn này; `null` khi không có dòng nào. */
  at: string | null;
  /** Thư mục nguồn không tồn tại (khác hẳn "có thư mục nhưng rỗng"). */
  missing: boolean;
  /** Tổng số dòng log đọc được ở nguồn này (mọi loại, không riêng bước 0). */
  lines: number;
  /** Số dòng bước 0 ở nguồn này. */
  step0Lines: number;
  /** Lý do không đọc được nguồn, khi `readRunLogs` ném. `null` khi đọc được. */
  error: string | null;
}

/** Nhịp tim tổng, cộng phần khai giới hạn của chính phép đo. */
export interface HeartbeatReport {
  /** `max` của `at` trên mọi nguồn; `null` khi không nguồn nào trả lời được. */
  at: string | null;
  /** Tên nguồn đã thắng phép `max`; `null` khi `at` là `null`. */
  winner: string | null;
  readings: readonly HeartbeatReading[];
  /** Những chuyện phải nói ra kể cả khi nhịp tim còn mới (cấm im lặng). */
  problems: readonly string[];
}

/**
 * Đo một nguồn. Không ném: một nguồn hỏng phải thành **một dòng báo cáo**,
 * không phải một ngoại lệ giết cả phép đo — dấu hiệu số 5 là một trong sáu
 * dấu hiệu của người canh, và làm cả job đỏ là nuốt luôn năm dấu hiệu kia
 * (đúng luật Z9 mà `watchdog.yml` đã ghi cho từng chỗ nuốt lỗi của nó).
 */
export function readHeartbeatSource(source: HeartbeatSource): HeartbeatReading {
  const base: HeartbeatReading = {
    name: source.name,
    dir: source.dir,
    at: null,
    missing: false,
    lines: 0,
    step0Lines: 0,
    error: null,
  };

  if (!existsSync(source.dir) || !statSync(source.dir).isDirectory()) {
    return { ...base, missing: true };
  }

  let lines;
  try {
    lines = readRunLogs(source.dir);
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }

  const beats = lines.filter((line) => isStep0Ref(line.ref));
  // Sắp bằng `max` trên chuỗi đã chuẩn hoá của `readRunLogs`, không tin thứ
  // tự dòng trong file: `merge=union` không xếp theo thời gian (`D-C04`).
  let at: string | null = null;
  for (const beat of beats) {
    if (!Number.isFinite(Date.parse(beat.at))) continue;
    if (at === null || Date.parse(beat.at) > Date.parse(at)) at = beat.at;
  }

  return { ...base, at, lines: lines.length, step0Lines: beats.length };
}

/**
 * Nhịp tim trên **nhiều** nguồn cùng lúc.
 *
 * Thứ tự trong `sources` không ảnh hưởng kết quả `at` (phép `max` giao
 * hoán); nó chỉ quyết định thứ tự in ra và, khi hai nguồn mang **cùng** mốc,
 * nguồn nào được ghi là `winner`. Bên gọi nào dựa vào `winner` để kết luận
 * "nguồn mới đã sống" phải đọc thêm `step0Lines` của chính nguồn đó — hai
 * nguồn mang cùng một dòng (nhánh telemetry là bản mirror của `ops/logs`)
 * là ca thường, không phải ca lạ.
 */
export function heartbeat(sources: readonly HeartbeatSource[]): HeartbeatReport {
  const readings = sources.map(readHeartbeatSource);

  let at: string | null = null;
  let winner: string | null = null;
  for (const reading of readings) {
    if (reading.at === null) continue;
    if (at === null || Date.parse(reading.at) > Date.parse(at)) {
      at = reading.at;
      winner = reading.name;
    }
  }

  return { at, winner, readings, problems: heartbeatProblems(readings) };
}

/**
 * Những chuyện một nguồn phải nói ra **dù** nhịp tim tổng còn mới.
 *
 * Đây là phần "cấm im lặng" của mục này, và nó cố ý KHÔNG nhìn vào `at`
 * tổng: một nguồn chết trong lúc nguồn kia còn thở là đúng ca mà phép `max`
 * che đi. Che nó là quay lại đúng nhóm Z mà cả mục này sinh ra để chữa.
 */
export function heartbeatProblems(readings: readonly HeartbeatReading[]): string[] {
  const problems: string[] = [];

  if (readings.length === 0) {
    problems.push('Không nguồn nhịp tim nào được khai — dấu hiệu số 5 không có gì để đọc.');
    return problems;
  }

  for (const reading of readings) {
    if (reading.error !== null) {
      problems.push(`Nguồn nhịp tim \`${reading.name}\` (${reading.dir}) không đọc được: ${reading.error}`);
    } else if (reading.missing) {
      problems.push(
        `Nguồn nhịp tim \`${reading.name}\` KHÔNG TỒN TẠI (${reading.dir}) — hoặc chưa được tạo, ` +
          'hoặc bước lấy nguồn về đã thất bại. Đây là "chưa biết", không phải "đã đo và rỗng".',
      );
    } else if (reading.step0Lines === 0) {
      problems.push(
        `Nguồn nhịp tim \`${reading.name}\` (${reading.dir}) có ${reading.lines} dòng log nhưng ` +
          'KHÔNG dòng nào là dòng bước 0. Hoặc chưa lượt nào ghi vào nguồn này, hoặc hình dạng `ref` đã đổi.',
      );
    }
  }

  return problems;
}

/**
 * Bảng cho người đọc. `watchdog.yml` in nó vào log của lượt chạy, nên nó
 * phải trả lời được câu "nguồn nào đang giữ nhịp tim" bằng một dòng.
 */
export function renderHeartbeat(report: HeartbeatReport): string {
  const rows = report.readings.map((r) => {
    const state = r.error !== null ? `lỗi: ${r.error}` : r.missing ? 'KHÔNG TỒN TẠI' : (r.at ?? 'không có dòng bước 0');
    const counts = r.missing || r.error !== null ? '' : `  (${r.step0Lines}/${r.lines} dòng bước 0)`;
    return `  ${r.name === report.winner ? '→' : ' '} ${r.name.padEnd(12)} ${state}${counts}`;
  });
  const head =
    report.at === null
      ? 'Nhịp tim routine: KHÔNG đọc được từ nguồn nào.'
      : `Nhịp tim routine: ${report.at} (nguồn \`${report.winner}\`).`;
  return [head, ...rows].join('\n');
}

/**
 * Đọc `--source <tên>=<thư mục>` từ dòng lệnh. Ném khi một đối số không
 * theo dạng đó: một nguồn bị bỏ qua vì viết sai tên cờ là một nguồn biến
 * mất mà không gì đỏ.
 */
export function parseSourceArgs(argv: readonly string[]): HeartbeatSource[] {
  const sources: HeartbeatSource[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--source') continue;
    const raw = argv[i + 1];
    if (raw === undefined) throw new Error('`--source` thiếu giá trị; cần dạng `--source <tên>=<thư mục>`.');
    const eq = raw.indexOf('=');
    if (eq <= 0 || eq === raw.length - 1) {
      throw new Error(`\`--source\` phải có dạng \`<tên>=<thư mục>\`, nhận ${JSON.stringify(raw)}.`);
    }
    sources.push({ name: raw.slice(0, eq), dir: raw.slice(eq + 1) });
    i += 1;
  }
  return sources;
}

// ── CLI ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('heartbeat-source.ts') === true;

if (isMain) {
  const argv = process.argv.slice(2);
  let sources: HeartbeatSource[];
  try {
    sources = parseSourceArgs(argv);
  } catch (error) {
    process.stderr.write(`⚠ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  if (sources.length === 0) {
    // Mặc định KHÔNG phải một danh sách nguồn "hợp lý": bên gọi quên khai
    // nguồn là một lỗi cấu hình, và đoán hộ nó là cách nguồn mới bị bỏ ra
    // mà không ai thấy.
    process.stderr.write('⚠ Chưa khai nguồn nào. Dùng `--source <tên>=<thư mục>`, lặp lại được nhiều lần.\n');
    process.exit(2);
  }

  const report = heartbeat(sources);
  if (argv.includes('--json')) {
    // `render` đi KÈM trong JSON chứ không để bên gọi tự dựng lại.
    //
    // Vòng soát ngữ cảnh sạch của PR #229 đo được: bản đầu để `watchdog.yml`
    // lấy `--json` rồi tự render ba trạng thái (`missing` / rỗng / lỗi) bằng
    // một biểu thức `jq`. Đó là **bản chép thứ hai** của đúng cái luật mà mục
    // này vừa bỏ bản chép — chỉ cho một luật khác, và lần này không bài kiểm
    // nào so hai bản. Phá thử: bỏ nhánh `.missing` khỏi `jq` thì 35/35 vẫn
    // xanh.
    //
    // Nên luật render cũng chỉ còn một chỗ: `renderHeartbeat`, đã có test.
    process.stdout.write(`${JSON.stringify({ ...report, render: renderHeartbeat(report) }, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderHeartbeat(report)}\n`);
    for (const problem of report.problems) process.stdout.write(`- ${problem}\n`);
  }
  // Thoát 0 kể cả khi có nguồn chết: đây là phép ĐO cho `watchdog.yml`, không
  // phải một cổng chặn. Chỉ ca "đối số sai" mới khác 0, vì lúc đó phép đo
  // chưa hề chạy.
}
