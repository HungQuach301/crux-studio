#!/usr/bin/env node
/**
 * Mục `platform/P-045` — `KF-029`.
 *
 * ## Chỗ hỏng
 *
 * Bước "Xét từng PR rồi merge cái nào tới lượt" của `ops/workflows/automerge.yml`
 * duyệt CẢ hàng đợi trong một vòng `for`, dưới `set -euo pipefail`. Lời gọi
 * merge nằm trần:
 *
 *     gh api -X PUT "repos/$REPO/pulls/$NUM/merge" -f merge_method=squash -f sha="$HEAD"
 *
 * Một PR mà GitHub từ chối merge làm `gh` thoát khác 0, `set -e` giết cả
 * bước, và **mọi PR xếp sau trong hàng đợi không bao giờ được xét**. Đo được
 * trên lượt `automerge` số 737 (`2026-09-24T10:26Z`):
 *
 *     hàng đợi: 232 231 229 226 225 224 214 112 84 39
 *     #232 merge · #231 wait · #229 wait · #226 → 405 → BƯỚC CHẾT
 *     #225 #224 #214 #112 #84 #39 — KHÔNG lượt nào xét tới
 *
 * Tám lượt liên tiếp (730→737, `09:31Z`→`10:26Z`) chết ở đúng #226, trong
 * khi #84 (tới hạn ~`09:19Z`) và #39 (tới hạn ~`08:41Z`) đã quá khoảng chờ
 * 12 giờ mà nằm im.
 *
 * Hai hậu quả, cả hai đều thuộc nhóm **Z** (`ops/known-failures.md`) vì
 * `pnpm check` xanh, CI xanh trên mọi PR, `main` xanh, không cảnh báo nào mở:
 *
 * 1. **Đói hàng đợi.** Một PR không merge được khoá mọi PR đứng sau nó, vô
 *    thời hạn. Hàng đợi merge là tuần tự (CHARTER mục 7), nên đây là chỗ
 *    một lỗi đơn lẻ thành một chỗ tắc của cả dự án.
 * 2. **Merge xong mà không ai gọi các workflow sau merge.** Hai dòng
 *    `$GITHUB_OUTPUT` nằm SAU vòng lặp, nên bước chết cũng nuốt luôn chúng:
 *    `steps.merge.outputs.merged` rỗng → bước "Gọi tay các workflow lẽ ra
 *    chạy theo sự kiện push" bị bỏ. Đo được: lượt 737 merge `#232` thành
 *    `main` = `a92df04`, và tới `10:39Z` **không lần chạy `main-ci` nào tồn
 *    tại cho sha đó** — lần gần nhất vẫn ở `2329988`. Merge bằng
 *    `GITHUB_TOKEN` không tự sinh sự kiện (giả định **G2**, `KF-004`), nên
 *    lời gọi tay là đường DUY NHẤT.
 *
 * ## Đây là lần thứ hai của cùng một HÌNH DẠNG
 *
 * `KF-017` (mục `P-017`) là đúng hình dạng này với nguyên nhân khác: thiếu
 * scope `checks: read` → `403` ở PR đầu hàng đợi → `set -euo pipefail` giết
 * cả bước → 35 lượt đỏ liên tiếp, không PR nào phía sau được xét. Lần đó
 * chữa **nguyên nhân** (thêm một dòng quyền) và để nguyên **hình dạng**.
 *
 * `CLAUDE.md` mục 13: lỗi cùng loại lần thứ hai thì sửa cơ chế, không vá
 * sản phẩm. Cơ chế ở đây là: *một PR hỏng không được quyền quyết định số
 * phận của các PR khác*.
 *
 * ## Luật của file này
 *
 * Bên bash ghi MỘT dòng cho MỌI PR trong hàng đợi, rồi gọi file này ở bước
 * cuối. File này trả lời đúng hai câu, và cả hai đều là câu mà bash không
 * kiểm được nếu không để hỏng thật:
 *
 * - **Có PR nào thử merge mà hỏng không?** → lượt chạy phải ĐỎ. Đi tiếp
 *   không phải là tha thứ: nó chỉ có nghĩa là các PR khác vẫn được xét.
 * - **Có PR nào trong hàng đợi không hề có kết luận không?** (`uncovered`)
 *   → cũng ĐỎ. Đây là chữ ký của chính chỗ hỏng trên: đói hàng đợi trông
 *   giống hệt một lượt chạy bình thường nếu không ai đếm đầu vào so với
 *   đầu ra. Một con số so với một con số, không tự khai.
 *
 * Cấm im lặng (rà soát **Z2**): `render` in ra mọi PR của hàng đợi, kể cả
 * lượt xanh và kể cả kết luận "không làm gì".
 */

import { readFileSync } from 'node:fs';

/** Một PR đã được thử merge thật (bên bash đã gọi API). */
export interface MergeAttempt {
  number: number;
  /** `false` khi lời gọi merge trả lỗi — PR vẫn mở, hàng đợi vẫn phải đi tiếp. */
  ok: boolean;
  /** Lý do, một dòng. Với ca hỏng là thông điệp lỗi của API, đã ép về một dòng. */
  reason: string;
}

/** Một PR mà cổng merge cho qua (`wait`, `skip`, `recheck`, chạy thử…). */
export interface SkippedPr {
  number: number;
  /** `outcome` của `ops/invariants.merge-gate.ts`, hoặc `dry-run`. */
  outcome: string;
  reason: string;
}

export interface QueueReport {
  /** Mọi PR ứng viên ở ĐẦU lượt, đúng thứ tự bước "Lập danh sách PR ứng viên" dựng ra. */
  queue: number[];
  attempts: MergeAttempt[];
  skipped: SkippedPr[];
}

export interface QueueOutcome {
  merged: number[];
  failed: MergeAttempt[];
  /** PR trong `queue` mà lượt này KHÔNG có kết luận nào — chữ ký đói hàng đợi. */
  uncovered: number[];
  exitCode: 0 | 1;
  render: string;
}

/** Đầu vào hỏng thì NÉM, không đoán. "Không đọc được" khác "không có gì sai". */
export class QueueReportError extends Error {}

function assertReport(value: unknown): asserts value is QueueReport {
  if (value === null || typeof value !== 'object') {
    throw new QueueReportError('Báo cáo hàng đợi phải là một object.');
  }
  const report = value as Partial<QueueReport>;
  if (!Array.isArray(report.queue) || report.queue.some((n) => !Number.isInteger(n))) {
    throw new QueueReportError('Trường `queue` phải là mảng số hiệu PR.');
  }
  if (!Array.isArray(report.attempts) || !Array.isArray(report.skipped)) {
    throw new QueueReportError('Thiếu `attempts` hoặc `skipped`.');
  }
  for (const attempt of report.attempts) {
    if (
      !Number.isInteger(attempt?.number) ||
      typeof attempt?.ok !== 'boolean' ||
      typeof attempt?.reason !== 'string'
    ) {
      throw new QueueReportError(`Dòng \`attempts\` hỏng: ${JSON.stringify(attempt)}`);
    }
  }
  for (const skip of report.skipped) {
    if (
      !Number.isInteger(skip?.number) ||
      typeof skip?.outcome !== 'string' ||
      typeof skip?.reason !== 'string'
    ) {
      throw new QueueReportError(`Dòng \`skipped\` hỏng: ${JSON.stringify(skip)}`);
    }
  }
}

export function summarizeQueue(report: QueueReport): QueueOutcome {
  assertReport(report);

  const merged = report.attempts.filter((a) => a.ok).map((a) => a.number);
  const failed = report.attempts.filter((a) => !a.ok);

  const covered = new Set<number>([
    ...report.attempts.map((a) => a.number),
    ...report.skipped.map((s) => s.number),
  ]);
  const uncovered = report.queue.filter((n) => !covered.has(n));

  const lines: string[] = [];
  lines.push(
    `Hàng đợi ${report.queue.length} PR · merge ${merged.length} · bỏ qua ${report.skipped.length} · LỖI ${failed.length} · KHÔNG XÉT TỚI ${uncovered.length}`,
  );

  // Cấm im lặng (Z2): mọi PR của hàng đợi có đúng một dòng, kể cả lượt xanh.
  const byNumber = new Map<number, string>();
  for (const skip of report.skipped) byNumber.set(skip.number, `${skip.outcome} — ${skip.reason}`);
  for (const attempt of report.attempts) {
    byNumber.set(attempt.number, attempt.ok ? `đã merge — ${attempt.reason}` : `LỖI MERGE — ${attempt.reason}`);
  }
  for (const number of report.queue) {
    lines.push(`  #${number}: ${byNumber.get(number) ?? 'KHÔNG XÉT TỚI — lượt chạy kết thúc trước khi tới PR này'}`);
  }

  if (failed.length > 0) {
    lines.push('');
    lines.push('Lời gọi merge trả lỗi — PR vẫn mở, hàng đợi VẪN đi tiếp (KF-029):');
    for (const attempt of failed) lines.push(`  #${attempt.number}: ${attempt.reason}`);
  }
  if (uncovered.length > 0) {
    lines.push('');
    lines.push(
      `ĐÓI HÀNG ĐỢI — ${uncovered.length} PR không có kết luận nào: ${uncovered.map((n) => `#${n}`).join(' ')}. ` +
        'Đây là chữ ký của KF-029: một PR hỏng giết cả bước trước khi các PR sau được xét.',
    );
  }

  return {
    merged,
    failed,
    uncovered,
    exitCode: failed.length > 0 || uncovered.length > 0 ? 1 : 0,
    render: lines.join('\n'),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// `node ops/scripts/merge-queue.ts <report.json>` — in bảng rồi thoát 0/1.
// Chỉ chạy khi gọi trực tiếp, để test import được hàm thuần mà không bị
// `process.exit` giết giữa chừng.
const isMain = process.argv[1]?.endsWith('merge-queue.ts') === true;

if (isMain) {
  const path = process.argv[2];
  if (path === undefined) {
    console.error('Dùng: node ops/scripts/merge-queue.ts <report.json>');
    process.exit(2);
  }
  let outcome: QueueOutcome;
  try {
    outcome = summarizeQueue(JSON.parse(readFileSync(path, 'utf8')) as QueueReport);
  } catch (error) {
    // "Không đọc được báo cáo" KHÁC "hàng đợi không có vấn đề gì", và phải
    // khác cả ở mã thoát — 2, không phải 0 và cũng không phải 1.
    console.error(`⚠ KHÔNG TRẢ LỜI ĐƯỢC — ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  console.log(outcome.render);
  process.exit(outcome.exitCode);
}
