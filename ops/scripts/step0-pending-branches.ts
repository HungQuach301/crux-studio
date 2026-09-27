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
 * ## Nhánh chờ đã nằm trong PR đang mở của lượt khác (mục `integration/I-023`)
 *
 * Đối chiếu với nhánh chính thôi thì chưa đủ để **chọn** nhánh `cherry-pick`:
 * `KF-050` đo được hai PR bước 0 (`#309`, `#310`) mở cách nhau 37 giây cùng
 * gộp một bộ nhánh chờ, và lần tránh duy nhất trước đó là con mắt của lượt
 * chạy. Nên dạng `--from-remote` — dạng bước 0f dùng — **bắt buộc** nhận thêm
 * danh sách PR đang mở (`--open-prs`), trả `inOtherPr` cho từng nhánh và tập
 * `toCherryPick` đã trừ đi. Chưa đo thì `toCherryPick` là `null`, không phải
 * "cherry-pick hết". Mục này **không** chặn hai worker cùng mở PR bước 0 — cần
 * trạng thái dùng chung, xem docblock của `step0-pr-gate.ts` — nó chỉ chặn
 * **hậu quả**: cùng một dòng log vào hai PR.
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
  /**
   * `mergedLogIds` đọc từ ĐÂU — một câu người đọc được, in nguyên vào báo cáo
   * (mục `P-062`). Phép đo này chỉ đúng khi nguồn là nhánh chính; đọc từ cây
   * làm việc của một nhánh lượt chạy vừa `cherry-pick` dòng log vào thì mọi
   * nhánh chờ trông như đã gộp. Nên báo cáo phải NÓI nó đang đo cây nào.
   */
  mergedSource?: string;
  /**
   * Mã log có trong **cây làm việc** (không phải nhánh chính). Tuỳ chọn: chỉ để
   * đánh dấu nhánh chờ nào lượt này đã `cherry-pick` nhưng chưa tới `main`,
   * không bao giờ dùng để rút một nhánh khỏi `pending`.
   */
  treeLogIds?: readonly string[];
  /**
   * PR **đang mở** cùng danh sách file của mỗi PR so với nhánh chính (mục
   * `integration/I-023`, `KF-050`). Bỏ trống = **chưa đo**, và khi đó
   * `toCherryPick` là `null` chứ không phải "mọi nhánh pending": một báo cáo
   * chưa đối chiếu với PR của người khác không được dùng để chọn nhánh
   * `cherry-pick`. Mảng rỗng là một phép đo thật — "0 PR đang mở".
   *
   * Liệt kê mọi PR đang mở **trừ** PR của chính lượt này: dòng đã
   * `cherry-pick` vào cây của lượt này thì `inTree` nói rồi.
   */
  openPrs?: readonly OpenPrFiles[];
}

/** Một PR đang mở và các file nó đổi so với nhánh chính (`git diff --name-only <main>...<đầu PR>`). */
export interface OpenPrFiles {
  number: number;
  changed: readonly string[];
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
  /**
   * `true` khi dòng log đã có trong cây làm việc nhưng CHƯA có trên nhánh
   * chính — tức đã `cherry-pick` vào PR của lượt này, còn chờ PR đó merge.
   * Vẫn là `pending`: tới `main` mới là tới (`KF-041`).
   */
  inTree: boolean;
  /**
   * Số các PR **đang mở khác** đã mang sẵn dòng log của nhánh này (mục
   * `I-023`). Khác rỗng thì bước 0f **không** `cherry-pick` nhánh đó: hai PR
   * cùng mang một dòng là đúng ca `#309`/`#310` của `KF-050`, và union
   * **không** khử trùng lặp khi hai dòng lệch nhau. `null` = chưa đo.
   */
  inOtherPr: number[] | null;
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
  /**
   * Nguồn của `mergedLogIds`, chép từ đầu vào — `null` khi bên gọi không khai.
   * Tuỳ chọn ở kiểu để bên dựng báo cáo bằng tay (bài kiểm của `render`) không
   * phải khai; CLI luôn khai.
   */
  mergedSource?: string | null;
  /**
   * Phần của `pending` mà bước 0f được phép `cherry-pick`: chưa có trong cây
   * làm việc, và không PR đang mở nào khác mang nó (mục `I-023`). `null` khi
   * chưa đối chiếu với PR đang mở — **không** phải "cherry-pick hết".
   * Tuỳ chọn ở kiểu vì cùng lý do `mergedSource`.
   */
  toCherryPick?: Step0PendingBranchRow[] | null;
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
  const mergedSource = input.mergedSource ?? null;
  if (Number.isNaN(nowMs)) {
    return {
      pending: [],
      stale: [],
      mergedSource,
      problems: [
        `Mốc \`now\` không đọc được: ${JSON.stringify(input.now)}. Không đo được tuổi nhánh nào.`,
      ],
    };
  }

  const merged = new Set(input.mergedLogIds);
  const inTree = new Set(input.treeLogIds ?? []);
  const inOpenPr = input.openPrs === undefined ? null : openPrsByLogId(input.openPrs);
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
      inTree: inTree.has(logId),
      inOtherPr: inOpenPr === null ? null : (inOpenPr.get(logId) ?? []),
    });
  }

  pending.sort((a, b) => b.ageHours - a.ageHours || a.branch.localeCompare(b.branch));
  const toCherryPick =
    inOpenPr === null ? null : pending.filter((row) => !row.inTree && row.inOtherPr!.length === 0);
  return { pending, stale: pending.filter((row) => row.stale), problems, mergedSource, toCherryPick };
}

/**
 * Mã log bước 0 nằm trong một danh sách file đổi — đúng file
 * `ops/logs/integration/<mã>.jsonl` mà `step0LogPath` sinh ra, không gì khác.
 */
export function step0LogIdsInChanged(changed: readonly string[]): string[] {
  const prefix = `${STEP0_LOG_DIR}/`;
  return changed
    .filter((path) => path.startsWith(prefix) && path.endsWith('.jsonl'))
    .map((path) => path.slice(prefix.length, -'.jsonl'.length))
    .filter((id) => !id.includes('/') && parseStep0LogId(id) !== null);
}

/** Mã log → các số PR đang mở mang nó, sắp tăng dần. */
function openPrsByLogId(openPrs: readonly OpenPrFiles[]): Map<string, number[]> {
  const byLogId = new Map<string, number[]>();
  for (const pr of openPrs) {
    for (const logId of step0LogIdsInChanged(pr.changed)) {
      const list = byLogId.get(logId) ?? [];
      if (!list.includes(pr.number)) list.push(pr.number);
      byLogId.set(logId, list);
    }
  }
  for (const list of byLogId.values()) list.sort((a, b) => a - b);
  return byLogId;
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
        `  ${row.stale ? '⚠' : ' '} ${row.branch} — kẹt ${row.ageHours.toFixed(1)} giờ (mốc ${row.at})` +
          (row.inTree ? ' · đã có trong cây làm việc, chờ PR của lượt này tới nhánh chính' : '') +
          (row.inOtherPr !== undefined && row.inOtherPr !== null && row.inOtherPr.length > 0
            ? ` · đã nằm trong PR đang mở ${row.inOtherPr.map((n) => `#${n}`).join(', ')} — KHÔNG cherry-pick`
            : ''),
      );
    }
    if (report.toCherryPick === null) {
      lines.push(
        '  ⚠ CHƯA đối chiếu với PR đang mở — báo cáo này KHÔNG được dùng để chọn nhánh cherry-pick ' +
          '(mục I-023). Gọi lại với `--open-prs <file>`.',
      );
    } else if (report.toCherryPick !== undefined) {
      lines.push(
        report.toCherryPick.length === 0
          ? '  Cherry-pick được: 0 nhánh.'
          : `  Cherry-pick được: ${report.toCherryPick.length} nhánh — ` +
              report.toCherryPick.map((row) => row.branch).join(', '),
      );
    }
  }
  if (report.mergedSource != null) lines.push(`  (đối chiếu với: ${report.mergedSource})`);
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

/** Thư mục log bước 0, tương đối gốc repo — cùng chỗ `step0LogPath` ghi vào. */
export const STEP0_LOG_DIR = 'ops/logs/integration';

/**
 * Mã log bước 0 có trên một **ref git** — mặc định của `pnpm step0:pending`
 * là `origin/main` (mục `P-062`).
 *
 * Vì sao không đọc cây làm việc: bước 0f `cherry-pick` dòng log của nhánh chờ
 * vào nhánh lượt chạy, rồi lượt đó (hay một lần chạy lại) đo lại trên chính
 * cây ấy — và nhận *"không nhánh nào còn dòng log chưa vào nhánh chính"* trong
 * khi `origin/main` vẫn thiếu đủ cả bảy (đo được lượt `crux-worker-2`
 * `2026-09-26T22:3xZ`). Đúng câu mà `P-056` dựng ra để không bao giờ nói sai.
 *
 * Ném khi ref không tồn tại hoặc `git` thoát khác 0 — **không** trả rỗng:
 * danh sách rỗng ở đây nghĩa là "chưa dòng nào tới nhánh chính", tức mọi
 * nhánh chờ đều `pending` (hướng ồn, không phải hướng im) — nhưng một ref gõ
 * sai vẫn phải là một lỗi cách dùng, không phải một phép đo.
 */
export function mergedStep0LogIdsFromRef(ref: string, dir = STEP0_LOG_DIR): string[] {
  const verify = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    encoding: 'utf8',
  });
  if (verify.status !== 0) {
    throw new Error(
      `Không xác định được nhánh chính: ref \`${ref}\` không tồn tại trong kho này. ` +
        `Chạy \`git fetch origin main\` rồi gọi lại. KHÔNG đo trên cây làm việc thay thế — ` +
        'cây của một nhánh lượt chạy có thể đã mang sẵn dòng log vừa cherry-pick (mục P-062).',
    );
  }
  // `--full-tree`: không có nó, `ls-tree` hiểu đường dẫn theo thư mục đang
  // đứng — gọi từ `ops/` là rỗng với mã 0 (vòng soát bước 6 của P-062).
  const run = spawnSync('git', ['ls-tree', '--full-tree', '--name-only', ref, '--', `${dir}/`], {
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    throw new Error(
      `git ls-tree ${ref} thoát ${run.status ?? 'không rõ'} — KHÔNG đọc được mã log trên nhánh chính. ` +
        (run.stderr ?? '').trim(),
    );
  }
  const ids = (run.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.jsonl'))
    .map((line) => line.slice(line.lastIndexOf('/') + 1, -'.jsonl'.length));
  // Nhánh chính luôn có dòng log bước 0 từ `P-023`; rỗng nghĩa là thư mục sai
  // hoặc ref sai, không phải "chưa dòng nào tới". Ném, đừng đo tiếp.
  if (ids.length === 0) {
    throw new Error(
      `Ref \`${ref}\` không có file \`.jsonl\` nào dưới \`${dir}/\` — thư mục hoặc ref sai. ` +
        'KHÔNG đo được mã log trên nhánh chính (mục P-062).',
    );
  }
  return ids;
}

/** Mã sha ngắn của một ref, để báo cáo nói đúng nó đã đo ở đâu. */
function shortSha(ref: string): string {
  const run = spawnSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' });
  return run.status === 0 ? (run.stdout ?? '').trim() : '?';
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

/**
 * Đọc file `--open-prs` (mục `I-023`): mảng JSON, mỗi phần tử
 * `{number, changed: string[]}` hoặc `{number, head: "<sha|ref>"}`. Dạng
 * `head` tự chạy `git diff --name-only <mainRef>...<head>` — đúng phép bước 0a
 * đã chạy cho mỗi PR, nên không thêm lần gọi API nào.
 *
 * **Ném** ở mọi chỗ không đọc được — file thiếu, JSON hỏng, phần tử sai dạng,
 * `git diff` thoát khác 0 — chứ không rơi về danh sách rỗng: rỗng nghĩa là
 * "0 PR đang mở", tức mọi nhánh pending thành cherry-pick được, và đó đúng là
 * ca `KF-050` mà phép đối chiếu này sinh ra để chặn.
 */
export function readOpenPrs(file: string, mainRef: string | undefined): OpenPrFiles[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Không đọc được danh sách PR đang mở \`${file}\`: ${(error as Error).message}. ` +
        'KHÔNG đo được nhánh chờ nào đã nằm trong PR khác — đây không phải "0 PR đang mở" (mục I-023).',
    );
  }
  if (!Array.isArray(raw)) {
    throw new Error(`\`${file}\` phải là một mảng JSON các PR đang mở (mảng rỗng = 0 PR đang mở).`);
  }
  return raw.map((entry: unknown, index): OpenPrFiles => {
    const e = entry as { number?: unknown; changed?: unknown; head?: unknown };
    const where = `\`${file}\` phần tử ${index}`;
    if (typeof e !== 'object' || e === null || !Number.isInteger(e.number) || (e.number as number) <= 0) {
      throw new Error(`${where}: thiếu \`number\` là số PR nguyên dương.`);
    }
    const hasChanged = Array.isArray(e.changed) && e.changed.every((path) => typeof path === 'string');
    const hasHead = typeof e.head === 'string' && e.head.length > 0;
    if (hasChanged === hasHead) {
      throw new Error(`${where}: cần ĐÚNG MỘT trong hai trường \`changed\` (mảng chuỗi) hoặc \`head\` (sha/ref).`);
    }
    if (hasChanged) return { number: e.number as number, changed: e.changed as string[] };
    if (mainRef === undefined) {
      throw new Error(`${where}: dạng \`head\` cần \`--main-ref\` để biết so với nhánh nào.`);
    }
    const run = spawnSync('git', ['diff', '--name-only', `${mainRef}...${e.head as string}`], { encoding: 'utf8' });
    if (run.status !== 0) {
      throw new Error(
        `${where}: \`git diff --name-only ${mainRef}...${e.head as string}\` thoát ${run.status ?? 'không rõ'} — ` +
          `chưa fetch đầu nhánh của PR #${e.number as number}? (\`git fetch origin pull/${e.number as number}/head\`) ` +
          (run.stderr ?? '').trim(),
      );
    }
    return {
      number: e.number as number,
      changed: (run.stdout ?? '').split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    };
  });
}

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/step0-pending-branches.ts (--from-remote | --branches <file>) ' +
      '[--main-ref <ref> | --logs-dir <thư mục>] [--open-prs <file>] [--now <ISO>] [--json]\n' +
      '  --from-remote  tự hỏi `git ls-remote` danh sách nhánh chờ (đây là dạng `pnpm step0:pending`).\n' +
      '                 Mặc định đối chiếu với `--main-ref origin/main`, KHÔNG với cây làm việc (P-062).\n' +
      '                 BẮT BUỘC đi kèm `--open-prs` (mục I-023): dạng này là dạng bước 0f dùng để chọn\n' +
      '                 nhánh cherry-pick, nên nó không được chạy mà chưa đối chiếu với PR đang mở.\n' +
      '  --open-prs     file JSON: mảng PR đang mở TRỪ PR của lượt này, mỗi phần tử\n' +
      '                 `{"number":311,"head":"<sha đầu nhánh>"}` hoặc `{"number":311,"changed":[…]}`.\n' +
      '                 `[]` = 0 PR đang mở. File hỏng thì NÉM, không coi là rỗng.\n' +
      '  --main-ref     đọc mã log đã gộp từ ref git này (`git ls-tree`). Ném khi ref không tồn tại.\n' +
      '  --logs-dir     đọc mã log đã gộp từ thư mục trên đĩa — chỉ đúng khi cây đang checkout LÀ\n' +
      '                 nhánh chính (ca `watchdog.yml`). Mặc định của `--branches`.\n' +
      '  --branches     file văn bản, mỗi dòng một tên nhánh remote (đã cắt `refs/heads/`).\n' +
      '                 Dòng trống bị bỏ; dòng dạng `<sha>\\trefs/heads/<nhánh>` được cắt sẵn.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let branchesFile: string | undefined;
  let fromRemote = false;
  let logsDir: string | undefined;
  let mainRef: string | undefined;
  let openPrsFile: string | undefined;
  let now = new Date().toISOString();
  let asJson = false;

  // Một cờ thiếu giá trị là lỗi cách dùng, không lặng lẽ rơi về mặc định —
  // cùng chữ ký "gọi sai mà trả ca lành" của mục P-062.
  const valueOf = (index: number): string => {
    const value = argv[index];
    if (value === undefined || value.startsWith('--')) usage();
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      asJson = true;
    } else if (arg === '--from-remote') {
      fromRemote = true;
    } else if (arg === '--branches') {
      branchesFile = valueOf((index += 1));
    } else if (arg === '--logs-dir') {
      logsDir = valueOf((index += 1));
    } else if (arg === '--main-ref') {
      mainRef = valueOf((index += 1));
    } else if (arg === '--open-prs') {
      openPrsFile = valueOf((index += 1));
    } else if (arg === '--now') {
      now = valueOf((index += 1));
    } else {
      usage();
    }
  }
  if (fromRemote === (branchesFile !== undefined)) usage();
  if (logsDir !== undefined && mainRef !== undefined) usage();
  if (fromRemote && openPrsFile === undefined) {
    process.stderr.write(
      '⚠ `--from-remote` cần `--open-prs <file>` (mục I-023, KF-050): không đối chiếu với PR đang mở thì\n' +
        '  hai lượt cherry-pick cùng một nhánh chờ vào hai PR. Không có PR nào đang mở thì truyền file `[]`.\n',
    );
    usage();
  }
  // `--from-remote` là dạng một lượt worker gõ trên nhánh CỦA NÓ, nên mặc định
  // đối chiếu với `origin/main`. `--branches` là dạng `watchdog.yml` gọi trên
  // bản checkout của `main`, nên giữ cây làm việc — và báo cáo nói ra điều đó.
  if (logsDir === undefined && mainRef === undefined) {
    if (fromRemote) mainRef = 'origin/main';
    else logsDir = STEP0_LOG_DIR;
  }

  const branches = fromRemote
    ? listPendingBranchesFromRemote()
    : readFileSync(branchesFile!, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        // `git ls-remote` in ra `<sha>\trefs/heads/<nhánh>`; nhận cả dạng thô
        // để bên gọi không phải nhớ một lần `sed` nữa.
        .map((line) => line.replace(/^[0-9a-f]{7,40}\s+refs\/heads\//, ''))
        .filter((line) => line.length > 0);

  const measured =
    mainRef !== undefined
      ? {
          mergedLogIds: mergedStep0LogIdsFromRef(mainRef),
          mergedSource: `ref \`${mainRef}\` (${shortSha(mainRef)}), thư mục \`${STEP0_LOG_DIR}/\``,
        }
      : {
          mergedLogIds: mergedStep0LogIds(logsDir!),
          mergedSource:
            `CÂY LÀM VIỆC \`${logsDir}\` (HEAD ${shortSha('HEAD')}) — chỉ đúng khi cây này là nhánh chính`,
        };
  // Đánh dấu nhánh đã cherry-pick vào cây này — chỉ để người đọc biết lượt
  // này đã làm phần của nó; không rút nhánh nào khỏi `pending`. Thư mục không
  // đọc được thì bỏ phần đánh dấu, không bỏ phép đo.
  let treeLogIds: string[] = [];
  if (mainRef !== undefined) {
    try {
      treeLogIds = mergedStep0LogIds(STEP0_LOG_DIR);
    } catch {
      treeLogIds = [];
    }
  }

  const openPrs = openPrsFile === undefined ? undefined : readOpenPrs(openPrsFile, mainRef);

  const report = step0PendingBranches({
    branches,
    now,
    treeLogIds,
    ...measured,
    ...(openPrs === undefined ? {} : { openPrs }),
  });
  process.stdout.write(
    asJson
      ? `${JSON.stringify({ ...report, render: renderStep0PendingReport(report) })}\n`
      : `${renderStep0PendingReport(report)}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
