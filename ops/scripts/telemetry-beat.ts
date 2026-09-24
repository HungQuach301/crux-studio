#!/usr/bin/env node
/**
 * Mục `platform/P-043`, vế **ghi** — bản sao nhịp tim đi lên một nhánh
 * riêng, không đi qua `main`.
 *
 * Đọc khối đầu của `ops/scripts/heartbeat-source.ts` trước: ở đó là lý do
 * mục này tồn tại và nguyên văn câu trả lời của chủ dự án trên `🤖 [QĐ]`
 * **#213**. File này là phần trả lời cho chữ *"nhánh claude/telemetry của R2
 * hoặc tương đương"*.
 *
 * ## Một nhánh, append-only, không bao giờ có PR
 *
 * Nhánh `claude/telemetry` chỉ chứa **bản sao** của các dòng log bước 0.
 * Nguồn thật vẫn là file mà `step0LogPath()` của kernel sinh ra, nằm trong PR
 * của lượt chạy (bất biến **I8** không đổi chỗ). File này **không** viết đường
 * dẫn đó ra, kể cả trong chú thích: `ops/test/step0-log-path.test.ts` (mục
 * `P-023`) đỏ khi một file code neo vào một đường dẫn log bước 0 cố định, và
 * nó đỏ đúng chỗ — neo vào tên file là cách bên đọc hỏng im lặng ở lượt đầu
 * tiên tên file đổi. Nhánh này là nơi `watchdog.yml` đọc
 * được nhịp tim **trước** khi PR đó merge — và kể cả khi nó không bao giờ
 * merge.
 *
 * Ba tính chất, mỗi cái đổi lấy một chỗ hỏng đã biết:
 *
 * - **Không PR, nên không CI.** `ops/workflows/ci.yml` chỉ kích bằng
 *   `pull_request` và `workflow_dispatch`, nên push vào một nhánh không có
 *   PR không tốn job nào. Đó là toàn bộ khoản tiết kiệm mà `#213` nhắm tới,
 *   giữ được mà không phải tắt dấu hiệu nào.
 * - **Một file cho mỗi lượt chạy**, tên lấy nguyên từ file log gốc
 *   (`step0LogPath` của kernel sinh ra nó). Hai worker chạy chồng nhau
 *   (CHARTER 2.1) không bao giờ chạm cùng một file, nên không có gì để
 *   xung đột — cùng lập luận `D-C04`, áp cho một nhánh dùng chung.
 * - **Chỉ dòng bước 0 được vào.** `beatFileProblems` chặn mọi dòng khác.
 *   Lý do không phải sạch sẽ: `watchdog.yml` lấy `max` trên nhánh này, nên
 *   một dòng KHÔNG phải bước 0 lọt vào sẽ giả mạo nhịp tim của routine bằng
 *   nhịp của một việc khác — và nó giả mạo theo hướng **mới hơn sự thật**,
 *   tức hướng làm người canh câm. Đúng hướng lệch mà cả mục này tránh.
 *
 * ## Vì sao không dùng `ops/logs/` làm tên thư mục trên nhánh đó
 *
 * Thư mục là `heartbeat/`, không phải `ops/logs/`. Nếu trùng đường dẫn thì
 * một lần `git merge` hay `cherry-pick` nhầm giữa nhánh telemetry và một
 * nhánh việc sẽ trộn hai cây log vào nhau, và `misfiledLogLines` của kernel
 * không bắt được (đường dẫn vẫn đúng hình dạng). Tên khác làm phép trộn đó
 * lộ ra ngay.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { isStep0Ref } from './lane-heartbeat.ts';

/** Nhánh giữ bản sao nhịp tim. Không bao giờ mở PR cho nhánh này. */
export const TELEMETRY_BRANCH = 'claude/telemetry';

/** Thư mục trên nhánh đó — xem khối đầu file về việc vì sao KHÔNG phải `ops/logs`. */
export const TELEMETRY_DIR = 'heartbeat';

/**
 * Đường dẫn đích trên nhánh telemetry của một file log bước 0.
 *
 * Chỉ lấy **tên file**, không giữ cây thư mục nguồn: tên file do
 * `step0LogId` của kernel sinh ra và đã mang cả mốc thời gian tới giây lẫn
 * tên routine, nên nó đã là danh tính đầy đủ của lượt chạy. Giữ thêm cây thư
 * mục nguồn chỉ là dựng lại đúng đường dẫn mà khối đầu file nói là phải
 * tránh.
 */
export function telemetryTargetPath(logPath: string): string {
  const name = basename(logPath);
  if (!name.endsWith('.jsonl') || name.length <= '.jsonl'.length) {
    throw new Error(`File log bước 0 phải là một file \`.jsonl\`, nhận ${JSON.stringify(logPath)}.`);
  }
  return `${TELEMETRY_DIR}/${name}`;
}

/**
 * Những gì sai trong một file định đẩy lên nhánh telemetry. Mảng rỗng =
 * hợp lệ.
 *
 * Trả về danh sách chứ không ném ở dòng đầu tiên: bên gọi cần thấy **mọi**
 * dòng sai trong một lần, không phải sửa một dòng rồi chạy lại để biết dòng
 * sau cũng sai.
 */
export function beatFileProblems(content: string): string[] {
  const problems: string[] = [];
  const rows = content.split('\n').filter((row) => row.trim().length > 0);

  if (rows.length === 0) {
    problems.push('File rỗng — không có dòng nhịp tim nào để đẩy lên.');
    return problems;
  }

  rows.forEach((row, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row);
    } catch {
      problems.push(`dòng ${index + 1}: không parse được JSON.`);
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      problems.push(`dòng ${index + 1}: không phải một đối tượng JSON.`);
      return;
    }
    const line = parsed as Record<string, unknown>;
    if (typeof line.ref !== 'string') {
      problems.push(`dòng ${index + 1}: thiếu trường \`ref\`.`);
      return;
    }
    if (!isStep0Ref(line.ref)) {
      problems.push(
        `dòng ${index + 1}: \`ref\` = ${JSON.stringify(line.ref)} KHÔNG phải dòng bước 0. ` +
          'Nhánh telemetry chỉ giữ nhịp tim; một dòng khác lọt vào là nhịp tim giả, mới hơn sự thật.',
      );
    }
    if (typeof line.at !== 'string' || !Number.isFinite(Date.parse(line.at))) {
      problems.push(`dòng ${index + 1}: \`at\` = ${JSON.stringify(line.at)} không đọc được thành một mốc thời gian.`);
    }
  });

  return problems;
}

/**
 * Nội dung sẽ nằm trên nhánh telemetry cho một file log bước 0 — **nguyên
 * văn** file gốc, chuẩn hoá đúng một dấu xuống dòng cuối.
 *
 * Không lọc bớt trường, không rút gọn: một bản sao khác bản gốc là một bản
 * sao phải bảo trì riêng, và phép so hai bản để phát hiện lệch sẽ mất chỗ
 * neo. `watchdog.yml` chỉ đọc `at` và `ref`, nhưng bên đọc sau này thì chưa
 * biết là ai.
 */
export function beatContent(raw: string): string {
  return `${raw.replace(/\n+$/, '')}\n`;
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// `node ops/scripts/telemetry-beat.ts <file log bước 0> [--check]`
//
// `--check` chỉ kiểm và in đường dẫn đích, không chạm git. Bên gọi thật
// (phụ lục P1 bước 0) chạy không có cờ đó và tự làm phần git bằng các lệnh
// script in ra — giữ mọi thao tác ghi lên remote nằm ở chỗ người đọc thấy
// được, thay vì chôn trong một script.
const isMain = process.argv[1]?.endsWith('telemetry-beat.ts') === true;

if (isMain) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const logPath = args[0];
  if (logPath === undefined) {
    process.stderr.write('⚠ Thiếu đường dẫn file log bước 0.\nDùng: node ops/scripts/telemetry-beat.ts <file.jsonl>\n');
    process.exit(2);
  }

  let raw: string;
  try {
    raw = readFileSync(logPath, 'utf8');
  } catch (error) {
    process.stderr.write(`⚠ Không đọc được ${logPath}: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  const problems = beatFileProblems(raw);
  if (problems.length > 0) {
    process.stderr.write(`⚠ ${logPath} không đủ điều kiện lên nhánh ${TELEMETRY_BRANCH}:\n`);
    for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
    process.exit(1);
  }

  const target = telemetryTargetPath(logPath);
  process.stdout.write(
    `${JSON.stringify({ branch: TELEMETRY_BRANCH, target, bytes: beatContent(raw).length }, null, 2)}\n`,
  );
}
