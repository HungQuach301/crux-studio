#!/usr/bin/env node
/**
 * Mục `platform/P-060` — `ops/known-failures.md` **KF-044**. **PR nào KHÔNG
 * mang nhãn cửa merge nào, nên `automerge.yml` không bao giờ thấy nó.**
 *
 * ## Chỗ hỏng mục này canh
 *
 * `ops/workflows/automerge.yml` lọc hàng đợi merge bằng **nhãn**:
 *
 * ```
 * select(.labels | map(.name) | (index("automerge") != null or index("automerge-delayed") != null))
 * ```
 *
 * Nhãn đó do job `protected-area` của `ops/workflows/ci.yml` gắn, và
 * `ci.yml` chỉ gắn trong một lượt `pull_request` (`opened`, `synchronize`,
 * `reopened`, `labeled`, `unlabeled`) — `workflow_dispatch` chạy đúng
 * `check` và `secret-scan`, không chạy khối gắn nhãn. **Không routine nào,
 * không cron nào gắn lại nhãn cho một PR đang mở.**
 *
 * Hệ quả: một PR đã xanh **trước** khi luật gắn nhãn đổi (mục `P-048`,
 * `KF-032`, vào `main` `2026-09-25T18:46:27Z`) đứng lại **không nhãn nào**
 * và không sự kiện nào tới để gắn — nó không chậm, nó **không bao giờ**
 * vào hàng đợi. Đo được ở lượt `crux-worker-2` `2026-09-26T08:2xZ`: **#223**,
 * không nháp, CI **8/8 xanh** từ `2026-09-25T05:30:40Z`, cửa `open`, nhãn
 * **rỗng**, đầu nhánh đứng yên **~27 giờ** — trong đó **~13,7 giờ** là sau
 * khi bản sửa `P-048` đã nằm trên `main`.
 *
 * Nhóm **Z** thuần: `pnpm check` xanh, CI 8/8 xanh, `main` xanh, không PR
 * nào xung đột nên bước 0a không nhìn tới nó, `pickPrToHandle` (phụ lục P1
 * bước 2) không có lý do nào khớp, và `gate-flow.ts` chỉ đếm PR **đã** mang
 * nhãn `automerge-delayed` nên PR không nhãn rơi ra ngoài mọi phép đếm. Ô
 * ⬜ cuối của `P-048` đã **khai** đúng chỗ này bằng lời (*"#223 không tự
 * thoát nhờ PR này"*) — nhưng một ô chưa tick không phải một chỉ báo, và
 * không gì đặt hạn cho nó. File này là chỗ đặt hạn đó.
 *
 * ## Vì sao phép hỏi chỉ cần NHÃN, không cần tính lại cửa merge
 *
 * Ba cửa của `ops/invariants.protected-area.ts` (`open`, `automerge-delayed`,
 * `owner-merge`) ánh xạ **một-một** sang ba nhãn, và từ `P-048` cả ba nhánh
 * `case "$GATE"` của `ci.yml` đều `--add-label` nhãn của mình (máy canh:
 * `mergeGateLabelProblems` trong `pnpm lint:workflows`). Nên *"PR mở, không
 * nháp, mang **không** nhãn nào trong ba nhãn đó"* là câu hỏi **đủ**: dù cửa
 * thật của nó là cửa nào, PR ấy vẫn đang ở ngoài cả hàng đợi máy
 * (`automerge`/`automerge-delayed`) lẫn hàng đợi người (`owner-merge`).
 *
 * Đó cũng là lý do tool này **không** gọi `protected-area`: tính lại cửa
 * cần diff của từng PR, tức một lần `git fetch` cho mỗi PR, để trả lời một
 * câu hỏi mà ba cái tên nhãn đã trả lời xong. Rẻ hơn thì canh được dày hơn.
 *
 * `owner-merge` **không** phải chỗ kẹt: PR đó đang chờ người, và bản tin
 * (phụ lục P2) có dòng riêng cho nó. Đếm nó vào đây sẽ gọi chủ dự án cho
 * một PR vốn đã nằm trong hộp của anh — ngược thước đo CHARTER 1.3.
 *
 * ## Ranh giới: tool này ĐO, không gắn nhãn
 *
 * Gắn `automerge` cho một PR cửa `open` đã xanh là **merge nó gần như tức
 * thì**, mà `CLAUDE.md` mục 13 đòi một vòng soát ngữ cảnh sạch trước khi
 * gắn nhãn merge. Nên bản gỡ một PR cụ thể là việc của một lượt nhận đúng
 * PR đó; việc của file này là làm nó **thấy được** thay vì im lặng.
 */

import { readFileSync } from 'node:fs';

/**
 * Ba nhãn cửa merge, đúng ba giá trị `Gate` của
 * `ops/invariants.protected-area.ts`. So bằng chữ thường hai bên, cùng luật
 * `gate-flow.ts` dùng cho `automerge-delayed`.
 */
export const MERGE_GATE_LABELS = ['automerge', 'automerge-delayed', 'owner-merge'] as const;

/**
 * Quá ngần này giờ mà một PR mở, không nháp vẫn không mang nhãn cửa merge
 * nào thì đó là một chỗ kẹt, không phải một khoảng trễ.
 *
 * **Suy ra từ hai mốc đo được, không chọn cho tròn:**
 *
 * - `ops/workflows/automerge.yml` chạy cron `23 * * * *`, tức **một giờ**
 *   một lượt. Dưới một giờ thì mọi PR vừa mở đều "kẹt" theo phép đo này,
 *   trong khi hàng đợi chưa tới lượt chấm lần nào.
 * - Job `protected-area` của `ci.yml` gắn nhãn trong **một** lượt CI: đo
 *   trên #282 (`2026-09-26T08:05:42Z` → `08:05:54Z`) là **12 giây**. Cộng
 *   một giờ dự phòng cho một lượt CI phải nằm chờ runner.
 *
 * `1 + 1 = 2` giờ, và nó nằm **rất xa** dưới ca thật cần bắt (#223 ở **27
 * giờ**), nên ngưỡng này không có nguy cơ im ở đúng ca nó sinh ra để bắt.
 */
export const ORPHAN_ALERT_HOURS = 2;

/**
 * Một PR đang mở, đúng hình dạng một lần `gh pr list --json
 * number,title,isDraft,labels` trả về, cộng **một** mốc thời gian.
 */
export interface QueueOrphanInput {
  number: number;
  title: string;
  /** PR nháp cố ý nằm ngoài hàng đợi (`ops/invariants.merge-gate.ts` bỏ qua nó). */
  isDraft: boolean;
  /** Tên nhãn, đã phẳng thành chuỗi (`labels[].name`). */
  labels: readonly string[];
  /**
   * Mốc **đổi đầu nhánh gần nhất**, ISO 8601 — `git log -1 --format=%cI`
   * trên đầu PR, hoặc `prHeadChanges(...)[0]` của `ops/scripts/gate-flow.ts`.
   *
   * **Cố ý KHÔNG nhận `updatedAt` của PR:** mốc đó nhích theo mỗi comment,
   * nên một PR kẹt mà có người bình luận sẽ trông như vừa hoạt động — đúng
   * chiều hỏng im lặng mà mục này đi bắt. Mốc đổi đầu nhánh là mốc duy nhất
   * mà "kẹt" nói đúng nghĩa: từ đó tới giờ, không sự kiện nào có thể đã gắn
   * nhãn cho nó.
   */
  headCommittedAt: string;
}

export interface QueueOrphanRow {
  number: number;
  title: string;
  /** Nhãn PR đang mang (có thể rỗng) — để bên đọc thấy nó *có* nhãn khác, ví dụ `fix`. */
  labels: string[];
  /** Giờ kể từ `headCommittedAt` tới `now`. `null` khi mốc không đọc được. */
  hoursSilent: number | null;
  /** `true` khi `hoursSilent` tới hoặc quá `ORPHAN_ALERT_HOURS`. */
  overThreshold: boolean;
}

export interface QueueOrphanReport {
  /** Số PR đã xét (kể cả nháp) — để một báo cáo rỗng phân biệt được với "không có đầu vào". */
  checked: number;
  /** Số PR nháp bỏ qua, nói ra chứ không lặng lẽ trừ đi. */
  drafts: number;
  /** PR mở, không nháp, không mang nhãn cửa merge nào — kẹt lâu nhất trước. */
  orphans: QueueOrphanRow[];
  /** Phần của `orphans` đã quá `ORPHAN_ALERT_HOURS` — đúng tập đáng lên tiếng. */
  overThreshold: QueueOrphanRow[];
  /**
   * Mọi thứ **không đo được**, khai riêng từng câu — cùng hình dạng
   * `problems` của `ops/scripts/heartbeat-source.ts` và
   * `ops/scripts/step0-pending-branches.ts`. Một mốc thời gian không đọc
   * được **không** được phép biến thành "PR này không kẹt".
   */
  problems: string[];
}

/** Nhãn cửa merge mà PR đang mang, so bằng chữ thường. */
function gateLabelsOf(labels: readonly string[]): string[] {
  const wanted = new Set<string>(MERGE_GATE_LABELS);
  return labels.filter((label) => wanted.has(label.toLowerCase()));
}

/**
 * Kiểm hình dạng đầu vào và **NÉM** khi thiếu, không trả báo cáo rỗng.
 *
 * Cùng luật `claimCheck` (`ops/scripts/claim-collision.ts`) đã chốt: đầu vào
 * tới từ **một** lần liệt kê PR, nên thiếu một trường nghĩa là bên gọi hỏi
 * sai câu — và một phép đếm dựng trên ảnh chụp thiếu trường trả lời sai mà
 * không gì đỏ. "Ném" không bao giờ được đọc thành "không PR nào kẹt".
 */
function assertShape(pr: unknown, index: number): QueueOrphanInput {
  const at = `PR thứ ${index + 1} trong đầu vào`;
  if (typeof pr !== 'object' || pr === null) throw new TypeError(`${at}: không phải một object.`);
  const record = pr as Record<string, unknown>;
  if (typeof record.number !== 'number') throw new TypeError(`${at}: thiếu trường \`number\`.`);
  if (typeof record.title !== 'string') throw new TypeError(`${at} (#${record.number}): thiếu trường \`title\`.`);
  if (typeof record.isDraft !== 'boolean') {
    throw new TypeError(
      `${at} (#${record.number}): thiếu trường \`isDraft\`. Không suy nó thành \`false\`: ` +
        'một PR nháp bị đếm thành kẹt sẽ gọi người cho một PR cố ý nằm ngoài hàng đợi.',
    );
  }
  if (!Array.isArray(record.labels) || record.labels.some((label) => typeof label !== 'string')) {
    throw new TypeError(
      `${at} (#${record.number}): \`labels\` phải là mảng chuỗi (\`labels[].name\`, đã phẳng). ` +
        'Thiếu nó thì MỌI PR trông như không nhãn — một báo động giả cho cả hàng đợi.',
    );
  }
  if (typeof record.headCommittedAt !== 'string') {
    throw new TypeError(
      `${at} (#${record.number}): thiếu trường \`headCommittedAt\` (mốc đổi đầu nhánh gần nhất). ` +
        'Đừng thay bằng `updatedAt`: mốc đó nhích theo comment nên nó che đúng chỗ hỏng này.',
    );
  }
  return record as unknown as QueueOrphanInput;
}

/**
 * PR nào đang ở ngoài cả hai hàng đợi merge, và PR nào đã quá ngưỡng.
 *
 * Hàm thuần: không mạng, không đọc file, không đọc đồng hồ hệ thống — `now`
 * là đầu vào, nên ca thật của `KF-044` dựng lại được trong một bài kiểm.
 * Sắp theo `hoursSilent` giảm dần (kẹt lâu nhất trước), cùng luật bước 0a
 * của phụ lục P3; PR không đo được tuổi xếp cuối nhưng **vẫn** có mặt.
 */
export function queueOrphans(prs: readonly unknown[], now: string): QueueOrphanReport {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new TypeError(`Mốc \`now\` không đọc được: ${JSON.stringify(now)}.`);
  }

  const problems: string[] = [];
  const orphans: QueueOrphanRow[] = [];
  let drafts = 0;

  prs.forEach((raw, index) => {
    const pr = assertShape(raw, index);
    if (pr.isDraft) {
      drafts += 1;
      return;
    }
    const gateLabels = gateLabelsOf(pr.labels);
    if (gateLabels.length > 1) {
      problems.push(
        `#${pr.number} mang ${gateLabels.length} nhãn cửa merge cùng lúc (${gateLabels.join(', ')}) — ` +
          'ba cửa là loại trừ nhau, nên đây là một chỗ lệch khác, không phải chỗ kẹt của mục này.',
      );
    }
    if (gateLabels.length > 0) return;

    const atMs = Date.parse(pr.headCommittedAt);
    if (Number.isNaN(atMs)) {
      problems.push(
        `#${pr.number} không mang nhãn cửa merge nào, và mốc \`headCommittedAt\` ` +
          `(${JSON.stringify(pr.headCommittedAt)}) không đọc được — nó vẫn KẸT, chỉ là không đo được ` +
          'kẹt bao lâu.',
      );
      orphans.push({
        number: pr.number,
        title: pr.title,
        labels: [...pr.labels],
        hoursSilent: null,
        overThreshold: false,
      });
      return;
    }

    const hoursSilent = (nowMs - atMs) / 3_600_000;
    orphans.push({
      number: pr.number,
      title: pr.title,
      labels: [...pr.labels],
      hoursSilent,
      overThreshold: hoursSilent >= ORPHAN_ALERT_HOURS,
    });
  });

  orphans.sort((a, b) => (b.hoursSilent ?? -Infinity) - (a.hoursSilent ?? -Infinity));

  return {
    checked: prs.length,
    drafts,
    orphans,
    overThreshold: orphans.filter((row) => row.overThreshold),
    problems,
  };
}

/**
 * Báo cáo tiếng Việt, dạng hợp mục "Đang chờ merge" của phụ lục P2.
 *
 * Ca rỗng in **một dòng tường minh** chứ không in gì cả: im lặng ở đây đúng
 * thứ `Z7` cấm — bên đọc không phân biệt được "đã đo, không PR nào kẹt" với
 * "chưa đo".
 */
export function renderQueueOrphans(report: QueueOrphanReport, alertHours = ORPHAN_ALERT_HOURS): string {
  const lines: string[] = [];
  const hours = (row: QueueOrphanRow): string =>
    row.hoursSilent === null ? 'không đo được tuổi' : `kẹt ${row.hoursSilent.toFixed(1)} giờ`;

  if (report.orphans.length === 0) {
    lines.push(
      `Mọi PR đang mở đều mang một nhãn cửa merge (đã xét ${report.checked} PR, ` +
        `${report.drafts} nháp bỏ qua) — không PR nào nằm ngoài hàng đợi.`,
    );
  } else {
    lines.push(
      `PR KHÔNG mang nhãn cửa merge nào: ${report.orphans.length} ` +
        `(quá ngưỡng ${alertHours} giờ: ${report.overThreshold.length}; đã xét ${report.checked} PR, ` +
        `${report.drafts} nháp bỏ qua). \`automerge.yml\` lọc hàng đợi theo nhãn, nên PR ở đây ` +
        'không chậm — nó KHÔNG BAO GIỜ vào hàng đợi.',
    );
    for (const row of report.orphans) {
      const others = row.labels.length === 0 ? 'nhãn rỗng' : `nhãn khác: ${row.labels.join(', ')}`;
      lines.push(
        `    #${row.number} — ${hours(row)} · ${others}${row.overThreshold ? ' · QUÁ NGƯỠNG' : ''} · ${row.title}`,
      );
    }
  }

  for (const problem of report.problems) lines.push(`⚠ ${problem}`);
  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/merge-queue-orphans.ts --prs <file.json> [--now <ISO>] [--json]\n' +
      '  <file.json>: [{ "number", "title", "isDraft", "labels": ["automerge", …], "headCommittedAt" }]\n' +
      '  `labels` đã phẳng từ `labels[].name`; `headCommittedAt` là `git log -1 --format=%cI` trên đầu PR.\n' +
      '  Thoát 1 khi có PR quá ngưỡng HOẶC có `problems` — một phép đo không đo được thì không được báo xanh.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let prsFile: string | undefined;
  let now = new Date().toISOString();
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') asJson = true;
    else if (arg === '--prs') prsFile = argv[(index += 1)];
    else if (arg === '--now') now = argv[(index += 1)] ?? now;
    else usage();
  }
  if (prsFile === undefined) usage();

  const prs = JSON.parse(readFileSync(prsFile, 'utf8')) as unknown[];
  if (!Array.isArray(prs)) {
    throw new TypeError('File đầu vào phải là một MẢNG PR. Một object lẻ không phải "không PR nào kẹt".');
  }
  const report = queueOrphans(prs, now);
  const render = renderQueueOrphans(report);
  process.stdout.write(
    asJson ? `${JSON.stringify({ now, alertHours: ORPHAN_ALERT_HOURS, ...report, render })}\n` : `${render}\n`,
  );

  // Thoát khác 0 để một bước workflow có thể `if !` nó (cùng hình dạng
  // `watchdog.yml` dùng cho dấu hiệu số 6 và 7). `problems` cũng làm đỏ:
  // một phép đo không đo được phải nói ra, không được báo xanh.
  if (report.overThreshold.length > 0 || report.problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
