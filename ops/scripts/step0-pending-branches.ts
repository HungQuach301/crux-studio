#!/usr/bin/env node
/**
 * Mục `platform/P-056` — `KF-041`. **Nhánh chờ `step0-pending` nào chưa ai
 * gộp vào nhánh chính, và đã kẹt bao lâu.**
 *
 * ## Chỗ hỏng mục này canh
 *
 * `P-038` cho lượt bước 0 không gỡ được PR nào quyền **không mở PR**: dòng
 * log vẫn được ghi, commit và đẩy lên nhánh chờ
 * `claude/integration/step0-pending/<mã log>`. Luật có hai vế, và vế hai là
 * *"lượt nào mở PR thì `cherry-pick` các nhánh chờ vào PR của nó rồi xoá
 * nhánh đã gộp"*.
 *
 * Vế một nằm trong đúng lượt viết ra nó, nên nó chạy. Vế hai nằm ở một lượt
 * **khác**, và không gì nhắc nó: phụ lục P1 bước 0 không nói tới nhánh chờ,
 * `CLAUDE.md` mục 1 không có lệnh nào liệt kê chúng, `pnpm check` không đọc
 * remote. Đo được ở `KF-041`: **bốn** nhánh chờ, nhánh cũ nhất kẹt **~34,9
 * giờ**, và `step0Streaks(readRunLogs("ops/logs"))` đếm `totalRuns: 114` —
 * thiếu đúng bốn. Bất biến **I8** thủng bốn lượt mà `pnpm check` xanh, CI
 * xanh, `main` xanh, `watchdog.yml` im: nhóm **Z** thuần.
 *
 * ## Vì sao file này là một hàm thuần, và chỗ nào gọi nó
 *
 * Phép đo cần hai thứ từ ngoài — danh sách nhánh trên remote và danh sách mã
 * log đã có trên nhánh chính. Cả hai là **đầu vào**, không phải việc của hàm:
 * nhờ vậy bốn nhánh quan sát được ở `KF-041` dựng lại được trong một bài
 * kiểm, không cần mạng.
 *
 * Nơi chạy định kỳ là `ops/workflows/watchdog.yml`, dấu hiệu số **7**. Đó là
 * chỗ **rẻ nhất**: nó đã `git fetch` nhánh `claude/telemetry` mỗi lượt
 * (`P-043`), nên thêm một `git ls-remote --heads` không thêm job nào, và nó
 * chạy mỗi giờ độc lập với Claude — đúng thứ cần cho một chỗ hỏng mà mọi
 * chỉ báo bên trong đều xanh.
 *
 * **`pnpm check` KHÔNG phải chỗ đặt**, khai ra để lượt sau không "tiện tay"
 * thêm vào: cổng đó chạy trên **mọi** PR và không có remote trong CI nếu
 * không thêm một lần fetch cho mỗi lượt chạy — tức trả tiền ở chỗ đắt nhất
 * để canh một thứ đổi vài giờ một lần.
 */

import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { DEFAULT_DELAY_HOURS } from '../invariants.merge-gate.ts';
import { parseStep0LogId } from '../../kernel/src/log.ts';
import { STEP0_PENDING_BRANCH_PREFIX, isStep0PendingBranch } from './step0-pr-gate.ts';

/**
 * Khoảng trừ thêm trên khoảng chờ merge. Một nhánh chờ chỉ tới nhánh chính
 * qua PR của một lượt sau, và PR đó có thể mang `automerge-delayed` — tức
 * còn phải đợi `DEFAULT_DELAY_HOURS` giờ CI xanh nữa. Sáu giờ là chỗ đứng
 * cho phần đó: một lượt worker để nhận nhánh chờ (nhịp thật 2–3 lượt mỗi
 * giờ, `VF-G1`), cộng hàng đợi merge tuần tự (CHARTER mục 7).
 */
export const STEP0_PENDING_MARGIN_HOURS = 6;

/**
 * Quá ngần này giờ mà dòng log của một nhánh chờ vẫn chưa có trên nhánh
 * chính thì `watchdog.yml` lên tiếng.
 *
 * Suy ra từ `DEFAULT_DELAY_HOURS`, **không** phải một số trần: ngưỡng này
 * phải nằm **trên** khoảng chờ merge dài nhất mà luật cho phép, nếu không
 * mọi PR `automerge-delayed` mang một nhánh chờ sẽ tự sinh một cảnh báo —
 * gọi chủ dự án cho một hàng đợi đang chạy đúng, ngược thước đo CHARTER 1.3.
 * Và nó phải nằm **dưới** 34,9 giờ đã đo được ở `KF-041`, nếu không nó im
 * ở đúng ca nó được viết ra để bắt. `12 + 6 = 18` nằm giữa hai mốc đó.
 */
export const STEP0_PENDING_STALE_HOURS = DEFAULT_DELAY_HOURS + STEP0_PENDING_MARGIN_HOURS;

/**
 * Mốc `at` của một nhánh chờ được phép ở **tương lai** bao nhiêu phút mà vẫn
 * coi là lệch đồng hồ bình thường. Cùng con số và cùng lý do như
 * `HEARTBEAT_FUTURE_TOLERANCE_MINUTES` của `step0-pr-gate.ts`: lệch vài giây
 * giữa hai máy là chuyện thường, lệch nhiều là một mốc **không đọc được** —
 * và một mốc ở tương lai cho tuổi âm, tức một nhánh kẹt vĩnh viễn trông như
 * một nhánh vừa mới đẩy lên.
 */
export const STEP0_PENDING_FUTURE_TOLERANCE_MINUTES = 5;

export interface Step0PendingInput {
  /**
   * Tên nhánh trên remote, đã cắt `refs/heads/` — đúng thứ
   * `git ls-remote --heads origin 'refs/heads/<tiền tố>/*'` trả về sau một
   * lần `sed`.
   */
  branches: readonly string[];
  /**
   * Mã log bước 0 **đã có** trên nhánh chính, suy từ tên file trong
   * `ops/logs/integration/` (bỏ đuôi `.jsonl`). Không phải nội dung file:
   * phép đối chiếu ở đây là *"dòng của lượt ấy đã tới nhánh chính chưa"*, và
   * tên file chính là danh tính của lượt chạy (`P-023`).
   */
  mergedLogIds: readonly string[];
  /** Mốc bây giờ, ISO 8601 có múi giờ. */
  now: string;
}

export interface Step0PendingBranchRow {
  branch: string;
  logId: string;
  /** `at` đọc ngược từ mã log — mốc lượt chạy đã ghi dòng đó. */
  at: string;
  /** Tuổi tính từ `at` tới `now`, theo giờ. */
  ageHours: number;
  /** `true` khi `ageHours` tới hoặc quá `STEP0_PENDING_STALE_HOURS`. */
  stale: boolean;
}

export interface Step0PendingReport {
  /** Nhánh chờ có mã log **chưa** thấy trên nhánh chính, kẹt lâu nhất trước. */
  pending: Step0PendingBranchRow[];
  /** Phần của `pending` đã quá ngưỡng — đúng tập `watchdog.yml` lên tiếng vì. */
  stale: Step0PendingBranchRow[];
  /**
   * Mọi thứ **không đo được**, khai riêng từng câu.
   *
   * Không gộp vào `pending` và cũng không im lặng bỏ qua: `KF-041` là một
   * chỗ hỏng im lặng, nên một nhánh có tên lạ phải nói ra chứ không biến
   * thành "không có nhánh nào kẹt". Cùng hình dạng `problems` của
   * `ops/scripts/heartbeat-source.ts`.
   */
  problems: string[];
}

/**
 * Nhánh chờ nào chưa gộp, và nhánh nào đã quá ngưỡng.
 *
 * Hàm thuần, không đụng mạng và không đọc file — hai danh sách đầu vào là
 * tất cả những gì nó cần. Sắp theo tuổi giảm dần vì bên đọc luôn cần nhánh
 * kẹt lâu nhất trước (cùng luật bước 0a của phụ lục P3).
 */
export function step0PendingBranches(input: Step0PendingInput): Step0PendingReport {
  const problems: string[] = [];
  const nowMs = Date.parse(input.now);
  if (Number.isNaN(nowMs)) {
    return {
      pending: [],
      stale: [],
      problems: [
        `Mốc \`now\` không đọc được: ${JSON.stringify(input.now)}. Không đo được tuổi nhánh nào.`,
      ],
    };
  }

  const merged = new Set(input.mergedLogIds);
  const pending: Step0PendingBranchRow[] = [];

  for (const branch of input.branches) {
    if (!isStep0PendingBranch(branch)) {
      problems.push(
        `Nhánh \`${branch}\` không phải nhánh chờ (tiền tố phải là ` +
          `\`${STEP0_PENDING_BRANCH_PREFIX}/\`) — bỏ qua, nhưng nói ra vì nó nghĩa là ` +
          'phép liệt kê của bên gọi đang quét rộng hơn chỗ cần quét.',
      );
      continue;
    }

    const logId = branch.slice(`${STEP0_PENDING_BRANCH_PREFIX}/`.length);
    const parsed = parseStep0LogId(logId);
    if (parsed === null) {
      problems.push(
        `Nhánh chờ \`${branch}\` mang mã log không đọc được (\`${logId}\`) — không suy ra được ` +
          'mốc lượt chạy nên không đo được tuổi. Nhánh này vẫn có thể đang giữ một dòng log chưa ' +
          'gộp; phải xem bằng tay.',
      );
      continue;
    }

    if (merged.has(logId)) continue;

    const ageHours = (nowMs - Date.parse(parsed.at)) / 3_600_000;
    if (ageHours < -STEP0_PENDING_FUTURE_TOLERANCE_MINUTES / 60) {
      problems.push(
        `Nhánh chờ \`${branch}\` có mốc \`${parsed.at}\` nằm ở TƯƠNG LAI so với \`${input.now}\` ` +
          `quá ${STEP0_PENDING_FUTURE_TOLERANCE_MINUTES} phút — tuổi không đo được, nên nhánh này ` +
          'KHÔNG được tính là "còn mới". Hoặc đồng hồ một máy lệch, hoặc mã log khai sai giờ.',
      );
      continue;
    }

    const age = Math.max(0, ageHours);
    pending.push({
      branch,
      logId,
      at: parsed.at,
      ageHours: age,
      stale: age >= STEP0_PENDING_STALE_HOURS,
    });
  }

  pending.sort((a, b) => b.ageHours - a.ageHours || a.branch.localeCompare(b.branch));
  return { pending, stale: pending.filter((row) => row.stale), problems };
}

/** Báo cáo một dòng tiêu đề cộng một dòng cho mỗi nhánh — để dán vào thân cảnh báo. */
export function renderStep0PendingReport(report: Step0PendingReport): string {
  const lines: string[] = [];
  if (report.pending.length === 0) {
    lines.push('Nhánh chờ `step0-pending`: không nhánh nào còn dòng log chưa vào nhánh chính.');
  } else {
    lines.push(
      `Nhánh chờ \`step0-pending\` chưa gộp: ${report.pending.length} ` +
        `(quá ngưỡng ${STEP0_PENDING_STALE_HOURS} giờ: ${report.stale.length}).`,
    );
    for (const row of report.pending) {
      lines.push(
        `  ${row.stale ? '⚠' : ' '} ${row.branch} — kẹt ${row.ageHours.toFixed(1)} giờ (mốc ${row.at})`,
      );
    }
  }
  for (const problem of report.problems) lines.push(`  ⚠ ${problem}`);
  return lines.join('\n');
}

/**
 * Mã log bước 0 đã có trong một thư mục log — tên file bỏ đuôi `.jsonl`.
 *
 * Tách khỏi hàm thuần ở trên vì nó đọc file: bên gọi nào có sẵn danh sách
 * (một bài kiểm, hay một lượt đã `git ls-tree`) không phải đi qua đĩa.
 */
export function mergedStep0LogIds(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => name.slice(0, -'.jsonl'.length));
}

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/step0-pending-branches.ts --branches <file> ' +
      '[--logs-dir ops/logs/integration] [--now <ISO>] [--json]\n' +
      '  --branches  file văn bản, mỗi dòng một tên nhánh remote (đã cắt `refs/heads/`).\n' +
      '              Dòng trống bị bỏ; dòng dạng `<sha>\\trefs/heads/<nhánh>` được cắt sẵn.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let branchesFile: string | undefined;
  let logsDir = 'ops/logs/integration';
  let now = new Date().toISOString();
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      asJson = true;
    } else if (arg === '--branches') {
      branchesFile = argv[(index += 1)];
    } else if (arg === '--logs-dir') {
      logsDir = argv[(index += 1)] ?? logsDir;
    } else if (arg === '--now') {
      now = argv[(index += 1)] ?? now;
    } else {
      usage();
    }
  }
  if (branchesFile === undefined) usage();

  const branches = readFileSync(branchesFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    // `git ls-remote` in ra `<sha>\trefs/heads/<nhánh>`; nhận cả dạng thô để
    // bên gọi không phải nhớ một lần `sed` nữa.
    .map((line) => line.replace(/^[0-9a-f]{7,40}\s+refs\/heads\//, ''))
    .filter((line) => line.length > 0);

  const report = step0PendingBranches({ branches, mergedLogIds: mergedStep0LogIds(logsDir), now });
  process.stdout.write(
    asJson
      ? `${JSON.stringify({ ...report, render: renderStep0PendingReport(report) })}\n`
      : `${renderStep0PendingReport(report)}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
