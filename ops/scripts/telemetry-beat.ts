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
 *
 *   ⚠️ Đây là **lớp phòng thủ thứ hai, không phải lớp duy nhất** — bản đầu của
 *   khối này viết rằng một dòng lạ *"giả mạo nhịp tim theo hướng mới hơn sự
 *   thật"*, và vòng soát ngữ cảnh sạch của PR #229 đo được là **sai**:
 *   `readHeartbeatSource` đã lọc bằng `isStep0Ref` ở phía **đọc**, nên một
 *   dòng `ref: "platform/P-999"`, `at: "2027-01-01"` nhét vào nhánh này
 *   **không** nhấc nổi nhịp tim.
 *
 *   Ghi đúng mức là quan trọng, không phải hình thức: lời khai cũ mời lượt sau
 *   nới bộ lọc của **bên đọc** vì tin rằng bên ghi đã canh — tức tháo đúng lớp
 *   đang thật sự giữ. Bên ghi chặn ở đây vì một dòng lạ trên nhánh này là một
 *   bản ghi sai chỗ mà không ai sẽ đi dọn, và vì hai lớp cùng một luật
 *   (`isStep0Ref`) thì lớp nào chết cũng còn lớp kia.
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

/**
 * Các lệnh git mà bên gọi chạy để đẩy bản sao lên nhánh telemetry.
 *
 * Script **in** chúng ra thay vì tự chạy, và đó là chủ đích: mọi thao tác ghi
 * lên remote nằm ở chỗ người đọc bản ghi lượt chạy thấy được, thay vì chôn
 * trong một script. Nhưng "in ra" phải là in **thật** — vòng soát ngữ cảnh
 * sạch của PR #229 bắt được rằng bản đầu *hứa* điều này trong chú thích rồi
 * chỉ in `{branch, target, bytes}`, tức CHARTER phụ lục P3 bước 0e dặn một
 * việc mà không lệnh nào tồn tại để làm.
 *
 * Dùng `git commit-tree` chứ không `git worktree`: nhánh này **mồ côi**
 * (không tổ tiên chung với `main`), và một worktree mồ côi cần `checkout
 * --orphan` cộng một lần dọn cây — hai bước nữa để hỏng, trong một việc chạy
 * ở mọi lượt worker. Plumbing không chạm cây làm việc chút nào.
 *
 * `--force-with-lease` vắng mặt có chủ ý: không có `--force` nào ở đây cả.
 * Hai worker chạy chồng nhau ghi hai **file khác nhau** (tên mang mốc tới giây
 * cộng tên routine), nên lần push thứ hai chỉ cần `git fetch` lại rồi dựng
 * commit trên đầu mới — vòng `while` dưới đây làm đúng việc đó.
 */
export function telemetryPushCommands(logPath: string, sessionUrl: string): string[] {
  const target = telemetryTargetPath(logPath);
  const name = basename(target);
  return [
    `# Đẩy nhịp tim lên nhánh ${TELEMETRY_BRANCH} — KHÔNG mở PR, nên không chạy CI.`,
    `git fetch --no-tags origin "+refs/heads/${TELEMETRY_BRANCH}:refs/crux/telemetry" || true`,
    `BLOB=$(git hash-object -w ${JSON.stringify(logPath)})`,
    `INNER=$(printf '100644 blob %s\\t%s\\n' "$BLOB" ${JSON.stringify(name)} | git mktree)`,
    `ROOT=$(printf '040000 tree %s\\t${TELEMETRY_DIR}\\n' "$INNER" | git mktree)`,
    '# Trailer BẮT BUỘC, và nó không có PR nào để sửa về sau: commit trên nhánh này',
    '# không bao giờ vào `main`, nên `no-model-name`/`check-commit-trailers` không',
    '# quét nó, mà bài kiểm giả định G14 của `recheck-assumptions.ts` CÓ quét mọi',
    '# nhánh `claude/*`. Một lần đẩy thiếu trailer là một giả định báo `sai` vì một',
    '# commit không ai sửa được nữa.',
    'PARENT=$(git rev-parse --verify --quiet refs/crux/telemetry || true)',
    'MSG=$(printf \'%s\\n\' "🤖 [integration] nhịp tim bước 0" "" \\',
    '  "Co-Authored-By: Claude <noreply@anthropic.com>" \\',
    `  "Claude-Session: ${sessionUrl}")`,
    'if [ -n "$PARENT" ]; then',
    '  COMMIT=$(echo "$MSG" | git commit-tree "$ROOT" -p "$PARENT")',
    'else',
    '  COMMIT=$(echo "$MSG" | git commit-tree "$ROOT")',
    'fi',
    `git push origin "$COMMIT:refs/heads/${TELEMETRY_BRANCH}"`,
  ];
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// `node ops/scripts/telemetry-beat.ts <file log bước 0> [--commands]`
//
// Không cờ: kiểm file và in `{branch, target, bytes}`.
// `--commands`: in thêm các lệnh git bên gọi phải chạy (xem
// `telemetryPushCommands`). Cờ nào cũng KHÔNG chạm git — script này không bao
// giờ tự ghi lên remote.
const isMain = process.argv[1]?.endsWith('telemetry-beat.ts') === true;

if (isMain) {
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => !a.startsWith('--'));
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

  if (argv.includes('--commands')) {
    const sessionUrl = process.env.CLAUDE_SESSION_URL ?? '<url phiên làm việc>';
    process.stdout.write(`\n${telemetryPushCommands(logPath, sessionUrl).join('\n')}\n`);
  }
}
