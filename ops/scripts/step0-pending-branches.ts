#!/usr/bin/env node
/**
 * Mục `platform/P-056` — `KF-048`. **Nhánh chờ `step0-pending` nào chưa ai
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
 * remote. Đo được ở `KF-048`: **bốn** nhánh chờ, nhánh cũ nhất kẹt **~34,9
 * giờ**, và `step0Streaks(readRunLogs("ops/logs"))` đếm `totalRuns: 114` —
 * thiếu đúng bốn. Bất biến **I8** thủng bốn lượt mà `pnpm check` xanh, CI
 * xanh, `main` xanh, `watchdog.yml` im: nhóm **Z** thuần.
 *
 * ## Vì sao file này là một hàm thuần, và chỗ nào gọi nó
 *
 * Phép đo cần hai thứ từ ngoài — danh sách nhánh trên remote và danh sách mã
 * log đã có trên nhánh chính. Cả hai là **đầu vào**, không phải việc của hàm:
 * nhờ vậy bốn nhánh quan sát được ở `KF-048` dựng lại được trong một bài
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

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DEFAULT_DELAY_HOURS } from '../invariants.merge-gate.ts';
import { parseStep0LogId } from '../../kernel/src/log.ts';
import {
  STEP0_PENDING_BRANCH_PREFIX,
  isStep0PendingBranch,
  step0LogIdFromPendingBranch,
} from './step0-pr-gate.ts';

/**
 * Khoảng trừ thêm trên khoảng chờ merge.
 *
 * **Con số này đo được, không chọn cho tròn.** Bản đầu để 6 giờ với lý do
 * "một lượt worker nhận nhánh chờ, cộng hàng đợi chạy trơn". Vòng soát
 * ngữ cảnh sạch của `P-056` bác nó bằng số của chính kho: CHARTER 3.3 ghi
 * phép đo ngày 2026-09-23 — *"hàng đợi merge đứng ~8,6 giờ, 9 PR xung
 * đột, 0 push (`KF-020`)"*. `12 + 6 = 18 < 12 + 8,6 = 20,6`, tức một hàng
 * đợi tắc đúng như đã từng xảy ra sẽ tự sinh cảnh báo dù không có gì
 * hỏng — đúng ca mà đoạn dưới nói ngưỡng phải tránh.
 *
 * Nên 12 giờ: phủ trọn 8,6 giờ tắc đã đo được, cộng chỗ cho một lượt
 * worker nhận nhánh chờ (nhịp thật 2–3 lượt mỗi giờ, `VF-G1`).
 */
export const STEP0_PENDING_MARGIN_HOURS = 12;

/**
 * Quá ngần này giờ mà dòng log của một nhánh chờ vẫn chưa có trên nhánh
 * chính thì `watchdog.yml` **dấu hiệu số 7** lên tiếng.
 *
 * Suy ra từ `DEFAULT_DELAY_HOURS`, **không** phải một số trần, và nó phải
 * nằm giữa hai mốc **đo được**:
 *
 * - **Trên** `DEFAULT_DELAY_HOURS` cộng khoảng tắc hàng đợi đã từng xảy ra
 *   (`12 + 8,6`, xem `STEP0_PENDING_MARGIN_HOURS`) — dưới mốc đó thì mọi PR
 *   `automerge-delayed` mang một nhánh chờ tự sinh một cảnh báo, tức gọi
 *   chủ dự án cho một hàng đợi đang chạy đúng (ngược CHARTER 1.3).
 * - **Dưới** 34,9 giờ đã đo được ở `KF-048` — trên mốc đó thì nó im ở đúng
 *   ca nó được viết ra để bắt.
 *
 * `12 + 12 = 24` nằm giữa `20,6` và `34,9`.
 *
 * ## Một cận trên KHÔNG tồn tại, khai ra thay vì giả vờ đã che
 *
 * Nhánh chờ được `cherry-pick` vào một PR `owner-merge` thì khoảng chờ là
 * **thời gian của chủ dự án**, không có trần nào — 24 giờ có thể ngắn hơn
 * nó. Ca đó cho một cảnh báo mà người nhận không làm gì sai, và không con
 * số nào ở đây chữa được: chữa nó là việc của bên chọn PR để `cherry-pick`
 * vào (phụ lục P1 bước 0f), không phải của một ngưỡng.
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
   * Không gộp vào `pending` và cũng không im lặng bỏ qua: `KF-048` là một
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

    // Phép ĐẢO của `step0PendingBranch`, không phải một `slice` tự cắt ở
    // đây: docblock của `parseStep0LogId` và tiêu chí xong thứ nhất của
    // `P-056` đều đòi "một chỗ sinh ra tên thì một chỗ đọc ngược lại", và
    // vòng soát bắt đúng chỗ lời nói lệch mã này.
    const logId = step0LogIdFromPendingBranch(branch);
    const parsed = logId === null ? null : parseStep0LogId(logId);
    if (logId === null || parsed === null) {
      problems.push(
        `Nhánh chờ \`${branch}\` mang mã log không đọc được (\`${logId ?? branch}\`) — không suy ra được ` +
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

/**
 * Hỏi remote danh sách nhánh chờ. Ném lỗi khi `git` thoát khác 0 — **không**
 * rơi về danh sách rỗng: một danh sách rỗng đi vào `step0PendingBranches`
 * cho ra đúng từng byte câu của ca lành ("không nhánh nào…"), tức một lần
 * `ls-remote` trượt sẽ KHẲNG ĐỊNH LÀ LÀNH. Đó là chỗ hỏng nhóm **Z** mà
 * vòng soát của `P-056` bắt được trong chính bản đầu của mục này, nên đây
 * là chỗ phải ồn ào chứ không phải chỗ nuốt.
 */
export function listPendingBranchesFromRemote(remote = 'origin'): string[] {
  const run = spawnSync(
    'git',
    ['ls-remote', '--heads', remote, `refs/heads/${STEP0_PENDING_BRANCH_PREFIX}/*`],
    { encoding: 'utf8' },
  );
  if (run.status !== 0) {
    throw new Error(
      `git ls-remote thoát ${run.status ?? 'không rõ'} — KHÔNG đo được nhánh chờ. ` +
        `Đây không phải "không có nhánh nào kẹt". ${(run.stderr ?? '').trim()}`,
    );
  }
  return (run.stdout ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^[0-9a-f]{7,40}\s+refs\/heads\//, ''))
    .filter((line) => line.length > 0);
}

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/step0-pending-branches.ts (--from-remote | --branches <file>) ' +
      '[--logs-dir ops/logs/integration] [--now <ISO>] [--json]\n' +
      '  --from-remote  tự hỏi `git ls-remote` danh sách nhánh chờ (đây là dạng `pnpm step0:pending`).\n' +
      '  --branches     file văn bản, mỗi dòng một tên nhánh remote (đã cắt `refs/heads/`).\n' +
      '                 Dòng trống bị bỏ; dòng dạng `<sha>\\trefs/heads/<nhánh>` được cắt sẵn.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let branchesFile: string | undefined;
  let fromRemote = false;
  let logsDir = 'ops/logs/integration';
  let now = new Date().toISOString();
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      asJson = true;
    } else if (arg === '--from-remote') {
      fromRemote = true;
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
  if (fromRemote === (branchesFile !== undefined)) usage();

  const branches = fromRemote
    ? listPendingBranchesFromRemote()
    : readFileSync(branchesFile!, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        // `git ls-remote` in ra `<sha>\trefs/heads/<nhánh>`; nhận cả dạng thô
        // để bên gọi không phải nhớ một lần `sed` nữa.
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
