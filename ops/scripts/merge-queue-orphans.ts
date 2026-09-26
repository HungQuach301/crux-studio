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
 * (phụ lục P2) đếm nó vào nút thắt "chờ người". Đếm nó vào đây sẽ gọi chủ
 * dự án cho một PR vốn đã nằm trong hộp của anh — ngược thước đo CHARTER 1.3.
 *
 * ⚠️ **Giới hạn đã khai, không giấu** (vòng soát bước 6 của `P-060` nêu):
 * một PR mang nhãn `owner-merge` **cũ** — đầu nhánh trước từng chạm vùng
 * bảo vệ, sau đó bỏ file đó ra, và không sự kiện nào gắn lại nhãn — rơi vào
 * **đúng nguyên nhân gốc** của `KF-044` mà tool này cố ý **không** thấy: nó
 * ngồi trong hàng đợi người vĩnh viễn trong khi máy đã được phép merge. Che
 * ca đó cần đúng phép tính lại cửa mà đoạn trên từ chối, nên chỗ chặn của
 * nó là một mục khác, không phải một nhánh `if` thêm ở đây.
 *
 * ## Ranh giới: tool này ĐO, không gắn nhãn
 *
 * Gắn `automerge` cho một PR cửa `open` đã xanh là **merge nó gần như tức
 * thì**, mà `CLAUDE.md` mục 13 đòi một vòng soát ngữ cảnh sạch trước khi
 * gắn nhãn merge. Nên bản gỡ một PR cụ thể là việc của một lượt nhận đúng
 * PR đó; việc của file này là làm nó **thấy được** thay vì im lặng.
 */

import { readFileSync } from 'node:fs';
import { LABEL_FOR_GATE } from '../invariants.merge-gate.ts';
import { FUTURE_TOLERANCE_HOURS } from './lane-heartbeat.ts';

/**
 * Nhãn giữ một PR trong hàng đợi **người** — cửa `owner-merge`.
 *
 * Tách riêng vì `LABEL_FOR_GATE['owner-merge']` là `null` một cách **cố
 * ý**: cổng merge không đòi nhãn nào cho cửa đó (máy không bao giờ merge nó
 * nên nó không cần nhãn để được merge). Nhưng `ci.yml` **có** gắn nhãn đó,
 * và với câu hỏi của file này — *"PR này còn nằm trong hàng đợi nào không"* —
 * `owner-merge` là một câu trả lời "có".
 */
export const OWNER_QUEUE_LABEL = 'owner-merge';

/**
 * Ba nhãn cửa merge. **Dẫn xuất** từ `LABEL_FOR_GATE` (`ops/invariants.merge-gate.ts`)
 * chứ không chép tay ba chuỗi: đó là bản thứ tư của cùng ba cái tên trong
 * kho, và một bản chép tay lệch khỏi ba bản kia mà không gì đỏ (vòng soát
 * bước 6 của `P-060` nêu; `ops/test/merge-queue-orphans.test.ts` có bài đối
 * chiếu với cả `LABEL_FOR_GATE` lẫn `ops/labels.json`).
 *
 * So bằng chữ thường hai bên, cùng luật `gate-flow.ts` dùng cho
 * `automerge-delayed`.
 */
export const MERGE_GATE_LABELS: readonly string[] = [
  ...new Set([
    ...Object.values(LABEL_FOR_GATE).filter((label): label is string => label !== null),
    OWNER_QUEUE_LABEL,
  ]),
];

/**
 * Base branch duy nhất mà `ci.yml` kích hoạt (`on: pull_request: branches: [main]`).
 * PR nhắm base khác **không bao giờ** được gắn nhãn, nhưng nó cũng không
 * thuộc hàng đợi `main` nên không phải chỗ kẹt mục này đếm — xem `warnings`.
 */
export const LABELLED_BASE_REF = 'main';

/**
 * Quá ngần này giờ mà một PR mở, không nháp vẫn không mang nhãn cửa merge
 * nào thì đó là một chỗ kẹt, không phải một khoảng trễ.
 *
 * **Suy ra từ một mốc đo được, không chọn cho tròn:** job `protected-area`
 * của `ci.yml` gắn nhãn trong **một** lượt CI — đo trên #282
 * (`2026-09-26T08:05:42Z` → `08:05:54Z`) là **12 giây**. Phần còn lại của
 * ngưỡng là dự phòng cho một lượt CI phải **nằm chờ runner**, thứ không đo
 * được từ trong kho; một giờ là thừa sức cho nó, làm tròn lên **2 giờ**.
 *
 * Bản đầu của hằng này cộng thêm "một giờ vì cron `23 * * * *` của
 * `automerge.yml`" — vòng soát bước 6 bác đúng: cron đó quyết định khi nào
 * một PR **đã có nhãn** được chấm để merge, nó không dính gì tới việc PR
 * **có nhãn hay không**. Trị số giữ nguyên, lý lẽ thì bỏ vế sai.
 *
 * Ngưỡng nằm **rất xa** dưới ca thật cần bắt (#223 ở **27 giờ**), nên nó
 * không có nguy cơ im ở đúng ca nó sinh ra để bắt.
 */
export const ORPHAN_ALERT_HOURS = 2;

/**
 * Một PR trong ảnh chụp, đúng hình dạng một lần
 * `gh pr list --json number,title,isDraft,labels,baseRefName,createdAt,closedAt,mergedAt`
 * trả về, cộng **một** mốc lấy từ `git`.
 */
export interface QueueOrphanInput {
  number: number;
  title: string;
  /** PR nháp cố ý nằm ngoài hàng đợi (`ops/invariants.merge-gate.ts` bỏ qua nó). */
  isDraft: boolean;
  /** Tên nhãn, đã phẳng thành chuỗi (`labels[].name`). */
  labels: readonly string[];
  /** Base branch của PR (`baseRefName`). Chỉ base `main` được `ci.yml` gắn nhãn. */
  baseRef: string;
  /** Mốc mở PR (`createdAt`) — một sự kiện `opened` CÓ thể gắn nhãn, nên nó đếm. */
  createdAt: string;
  /** `closedAt` của PR, `null` khi còn mở. Bắt buộc có mặt, xem `assertShape`. */
  closedAt: string | null;
  /** `mergedAt` của PR, `null` khi chưa merge. Bắt buộc có mặt, xem `assertShape`. */
  mergedAt: string | null;
  /**
   * Mốc **đổi đầu nhánh gần nhất**, ISO 8601 — `git log -1 --format=%cI`
   * trên đầu PR, hoặc `prHeadChanges(...)[0]` của `ops/scripts/gate-flow.ts`.
   *
   * **Cố ý KHÔNG nhận `updatedAt`** làm mốc này: `updatedAt` nhích theo mỗi
   * comment, nên một PR kẹt mà có người bình luận sẽ trông như vừa hoạt
   * động — đúng chiều hỏng im lặng mà mục này đi bắt.
   *
   * Nhưng mốc đầu nhánh **một mình** cũng sai, theo chiều ngược lại: phiên
   * cloud đẩy nhánh rồi mới mở PR, nên một PR mở một phút trước có thể mang
   * đầu nhánh của hôm qua và bị đếm là kẹt hàng chục giờ (vòng soát bước 6
   * nêu). Phép đo thật là *"bao lâu rồi không có sự kiện `pull_request` nào
   * có thể gắn nhãn"*, nên mốc dùng là `max(headCommittedAt, createdAt)`.
   */
  headCommittedAt: string;
}

export interface QueueOrphanRow {
  number: number;
  title: string;
  /** Nhãn PR đang mang (có thể rỗng) — để bên đọc thấy nó *có* nhãn khác, ví dụ `fix`. */
  labels: string[];
  /** Mốc đã dùng để đo: `max(headCommittedAt, createdAt)`. */
  sinceAt: string;
  /**
   * Giờ kể từ `sinceAt` tới `now`. `null` khi **không đo được** — mốc không
   * parse được, hoặc mốc nằm ở tương lai quá dung sai (`clockSkew`). Không
   * bao giờ âm: một số âm nhỏ hơn mọi ngưỡng nên nó **tắt** báo động thay vì
   * bật, đúng nhóm Z (`I-021`, `Z7` của `lane-heartbeat.ts`).
   */
  hoursSilent: number | null;
  /** Mốc đo nằm ở **tương lai** so với `now`, quá dung sai — đồng hồ lệch. */
  clockSkew: boolean;
  /** `true` khi `hoursSilent` tới hoặc quá `ORPHAN_ALERT_HOURS`. */
  overThreshold: boolean;
}

export interface QueueOrphanReport {
  /** Số PR đã xét — để một báo cáo rỗng phân biệt được với "không có đầu vào". */
  checked: number;
  /** Số PR nháp bỏ qua, nói ra chứ không lặng lẽ trừ đi. */
  drafts: number;
  /** Số PR đã đóng/đã merge trong ảnh chụp — không thuộc hàng đợi nào nữa. */
  closed: number;
  /** Số PR nhắm base khác `main` — `ci.yml` không kích trên chúng (xem `warnings`). */
  otherBase: number;
  /** PR mở, không nháp, không mang nhãn cửa merge nào — kẹt lâu nhất trước. */
  orphans: QueueOrphanRow[];
  /** Phần của `orphans` đã quá `ORPHAN_ALERT_HOURS` — đúng tập đáng lên tiếng. */
  overThreshold: QueueOrphanRow[];
  /**
   * Mọi thứ **không đo được**, khai riêng từng câu — cùng hình dạng
   * `problems` của `ops/scripts/heartbeat-source.ts` và
   * `ops/scripts/step0-pending-branches.ts`. Một mốc thời gian không đọc
   * được **không** được phép biến thành "PR này không kẹt", nên `problems`
   * khác rỗng làm CLI thoát khác 0.
   */
  problems: string[];
  /**
   * Chỗ **đo được** nhưng không phải chỗ kẹt của mục này — tách khỏi
   * `problems` để một trạng thái thoáng qua không làm một người canh chạy
   * mỗi giờ đỏ (vòng soát bước 6 nêu ca `ci.yml` gắn nhãn mới rồi gỡ nhãn
   * cũ: giữa hai lệnh đó PR mang hai nhãn cửa merge trong vài giây).
   * `warnings` **không** đổi mã thoát.
   */
  warnings: string[];
}

/** Nhãn cửa merge mà PR đang mang, so bằng chữ thường. */
function gateLabelsOf(labels: readonly string[]): string[] {
  const wanted = new Set(MERGE_GATE_LABELS.map((label) => label.toLowerCase()));
  return labels.filter((label) => wanted.has(label.toLowerCase()));
}

/**
 * Kiểm hình dạng đầu vào và **NÉM** khi thiếu, không trả báo cáo rỗng.
 *
 * Cùng luật `claimCheck` (`ops/scripts/claim-collision.ts`) đã chốt: đầu vào
 * tới từ **một** lần liệt kê PR, nên thiếu một trường nghĩa là bên gọi hỏi
 * sai câu — và một phép đếm dựng trên ảnh chụp thiếu trường trả lời sai mà
 * không gì đỏ. "Ném" không bao giờ được đọc thành "không PR nào kẹt".
 *
 * `closedAt`/`mergedAt` bắt buộc có mặt vì endpoint **liệt kê** PR trả
 * `merged: false` cho cả PR đã merge (`CLAUDE.md` mục 1, `KF-025`): thiếu
 * hai trường đó thì một PR đã đóng, không nhãn thành một báo động giả vĩnh
 * viễn.
 */
function assertShape(pr: unknown, index: number): QueueOrphanInput {
  const at = `PR thứ ${index + 1} trong đầu vào`;
  if (typeof pr !== 'object' || pr === null) throw new TypeError(`${at}: không phải một object.`);
  const record = pr as Record<string, unknown>;
  if (typeof record.number !== 'number') throw new TypeError(`${at}: thiếu trường \`number\`.`);
  const who = `${at} (#${record.number})`;
  if (typeof record.title !== 'string') throw new TypeError(`${who}: thiếu trường \`title\`.`);
  if (typeof record.isDraft !== 'boolean') {
    throw new TypeError(
      `${who}: thiếu trường \`isDraft\`. Không suy nó thành \`false\`: một PR nháp bị đếm thành ` +
        'kẹt sẽ gọi người cho một PR cố ý nằm ngoài hàng đợi.',
    );
  }
  if (!Array.isArray(record.labels) || record.labels.some((label) => typeof label !== 'string')) {
    throw new TypeError(
      `${who}: \`labels\` phải là mảng chuỗi (\`labels[].name\`, đã phẳng). ` +
        'Thiếu nó thì MỌI PR trông như không nhãn — một báo động giả cho cả hàng đợi.',
    );
  }
  if (typeof record.baseRef !== 'string') {
    throw new TypeError(
      `${who}: thiếu trường \`baseRef\`. \`ci.yml\` chỉ kích trên \`branches: [${LABELLED_BASE_REF}]\`, ` +
        'nên base là một phần của câu trả lời, không phải chi tiết bỏ được.',
    );
  }
  if (typeof record.createdAt !== 'string') {
    throw new TypeError(
      `${who}: thiếu trường \`createdAt\`. Sự kiện \`opened\` CÓ thể gắn nhãn, nên bỏ nó ra sẽ ` +
        'đếm một PR vừa mở trên nhánh cũ thành kẹt hàng chục giờ.',
    );
  }
  for (const field of ['closedAt', 'mergedAt'] as const) {
    const value = record[field];
    if (value !== null && typeof value !== 'string') {
      throw new TypeError(
        `${who}: thiếu trường \`${field}\` (phải là chuỗi hoặc \`null\`). Endpoint liệt kê PR trả ` +
          '`merged: false` cho cả PR đã merge, nên thiếu trường này là một báo động giả vĩnh viễn.',
      );
    }
  }
  if (typeof record.headCommittedAt !== 'string') {
    throw new TypeError(
      `${who}: thiếu trường \`headCommittedAt\` (mốc đổi đầu nhánh gần nhất). ` +
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
 *
 * **Mảng rỗng thì NÉM**, không trả "không PR nào kẹt": một lần liệt kê PR
 * trả rỗng có thể là "không PR nào đang mở" hoặc là "lệnh liệt kê hỏng", và
 * hai thứ đó không được đọc như nhau (cùng luật `step0-pending-branches.ts`).
 */
export function queueOrphans(prs: readonly unknown[], now: string): QueueOrphanReport {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new TypeError(`Mốc \`now\` không đọc được: ${JSON.stringify(now)}.`);
  }
  if (prs.length === 0) {
    throw new TypeError(
      'Ảnh chụp PR rỗng. Không phân biệt được "không PR nào đang mở" với "lệnh liệt kê hỏng", ' +
        'nên tool ném thay vì báo hàng đợi sạch.',
    );
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  const orphans: QueueOrphanRow[] = [];
  let drafts = 0;
  let closed = 0;
  let otherBase = 0;

  prs.forEach((raw, index) => {
    const pr = assertShape(raw, index);
    if (pr.closedAt !== null || pr.mergedAt !== null) {
      closed += 1;
      return;
    }
    if (pr.isDraft) {
      drafts += 1;
      return;
    }

    const gateLabels = gateLabelsOf(pr.labels);
    if (gateLabels.length > 1) {
      warnings.push(
        `#${pr.number} mang ${gateLabels.length} nhãn cửa merge cùng lúc (${gateLabels.join(', ')}) — ` +
          'ba cửa là loại trừ nhau. `ci.yml` gắn nhãn mới TRƯỚC khi gỡ nhãn cũ nên đây có thể là một ' +
          'cửa sổ vài giây; nói ra mà không làm đỏ mã thoát.',
      );
    }
    if (gateLabels.length > 0) return;

    if (pr.baseRef !== LABELLED_BASE_REF) {
      otherBase += 1;
      warnings.push(
        `#${pr.number} nhắm base \`${pr.baseRef}\` (không phải \`${LABELLED_BASE_REF}\`) và không mang ` +
          'nhãn cửa merge nào — `ci.yml` không kích trên base đó nên nó sẽ KHÔNG BAO GIỜ được gắn nhãn, ' +
          'nhưng nó cũng không thuộc hàng đợi `main` nên không đếm vào chỗ kẹt của mục này. Cần người xem.',
      );
      return;
    }

    // Mốc đo: lần cuối một sự kiện `pull_request` CÓ THỂ đã gắn nhãn.
    const headMs = Date.parse(pr.headCommittedAt);
    const createdMs = Date.parse(pr.createdAt);
    const unreadable: string[] = [];
    if (Number.isNaN(headMs)) unreadable.push(`\`headCommittedAt\` (${JSON.stringify(pr.headCommittedAt)})`);
    if (Number.isNaN(createdMs)) unreadable.push(`\`createdAt\` (${JSON.stringify(pr.createdAt)})`);

    const base: QueueOrphanRow = {
      number: pr.number,
      title: pr.title,
      labels: [...pr.labels],
      sinceAt: pr.headCommittedAt,
      hoursSilent: null,
      clockSkew: false,
      overThreshold: false,
    };

    if (unreadable.length > 0) {
      problems.push(
        `#${pr.number} không mang nhãn cửa merge nào, và ${unreadable.join(' và ')} không đọc được — ` +
          'nó vẫn KẸT, chỉ là không đo được kẹt bao lâu.',
      );
      orphans.push(base);
      return;
    }

    const sinceMs = Math.max(headMs, createdMs);
    const sinceAt = sinceMs === headMs ? pr.headCommittedAt : pr.createdAt;
    const hoursRaw = (nowMs - sinceMs) / 3_600_000;

    // Mốc ở TƯƠNG LAI: số âm nhỏ hơn mọi ngưỡng, nên để nguyên là tự TẮT báo
    // động — đúng chữ ký `I-021` mà bài `Z7` của `lane-heartbeat.ts` dựng ra
    // để bắt, và cùng dung sai với nó. Không in giờ âm, không coi là "không
    // kẹt": PR vẫn ở trong `orphans`, cộng một dòng `problems`.
    if (hoursRaw < -FUTURE_TOLERANCE_HOURS) {
      problems.push(
        `#${pr.number} không mang nhãn cửa merge nào, và mốc đo (\`${sinceAt}\`) nằm ở TƯƠNG LAI so với ` +
          `\`now\` (${now}) — đồng hồ lệch. Nó vẫn KẸT; không đo được kẹt bao lâu, và một số giờ ÂM sẽ ` +
          'tự tắt báo động nên tool không in nó.',
      );
      orphans.push({ ...base, sinceAt, clockSkew: true });
      return;
    }

    const hoursSilent = Math.max(0, hoursRaw);
    orphans.push({
      ...base,
      sinceAt,
      hoursSilent,
      overThreshold: hoursSilent >= ORPHAN_ALERT_HOURS,
    });
  });

  orphans.sort((a, b) => (b.hoursSilent ?? -Infinity) - (a.hoursSilent ?? -Infinity));

  return {
    checked: prs.length,
    drafts,
    closed,
    otherBase,
    orphans,
    overThreshold: orphans.filter((row) => row.overThreshold),
    problems,
    warnings,
  };
}

/**
 * Báo cáo tiếng Việt, dạng hợp mục "Đang chờ merge" của phụ lục P2.
 *
 * Ca rỗng in **một dòng tường minh** chứ không in gì cả: im lặng ở đây đúng
 * thứ `Z7` cấm — bên đọc không phân biệt được "đã đo, không PR nào kẹt" với
 * "chưa đo".
 */
export function renderQueueOrphans(report: QueueOrphanReport): string {
  const lines: string[] = [];
  const scope =
    `đã xét ${report.checked} PR; ${report.drafts} nháp, ${report.closed} đã đóng/merge, ` +
    `${report.otherBase} base khác \`${LABELLED_BASE_REF}\``;
  const hours = (row: QueueOrphanRow): string =>
    row.hoursSilent === null
      ? row.clockSkew
        ? 'không đo được tuổi (mốc ở TƯƠNG LAI)'
        : 'không đo được tuổi'
      : `kẹt ${row.hoursSilent.toFixed(1)} giờ`;

  if (report.orphans.length === 0) {
    lines.push(`Mọi PR đang mở đều mang một nhãn cửa merge (${scope}) — không PR nào nằm ngoài hàng đợi.`);
  } else {
    lines.push(
      `PR KHÔNG mang nhãn cửa merge nào: ${report.orphans.length} ` +
        `(quá ngưỡng ${ORPHAN_ALERT_HOURS} giờ: ${report.overThreshold.length}; ${scope}). ` +
        '`automerge.yml` lọc hàng đợi theo nhãn, nên PR ở đây không chậm — nó KHÔNG BAO GIỜ vào hàng đợi.',
    );
    for (const row of report.orphans) {
      const others = row.labels.length === 0 ? 'nhãn rỗng' : `nhãn khác: ${row.labels.join(', ')}`;
      lines.push(
        `    #${row.number} — ${hours(row)} · ${others}${row.overThreshold ? ' · QUÁ NGƯỠNG' : ''} · ${row.title}`,
      );
    }
  }

  for (const problem of report.problems) lines.push(`⚠ ${problem}`);
  for (const warning of report.warnings) lines.push(`· ${warning}`);
  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/merge-queue-orphans.ts --prs <file.json> [--now <ISO>] [--json]\n' +
      '  <file.json>: [{ "number", "title", "isDraft", "labels": ["automerge", …], "baseRef",\n' +
      '                  "createdAt", "closedAt", "mergedAt", "headCommittedAt" }]\n' +
      '  `labels` đã phẳng từ `labels[].name`; `headCommittedAt` là `git log -1 --format=%cI` trên đầu PR.\n' +
      '  Thoát 1 khi có PR quá ngưỡng HOẶC có `problems` — một phép đo không đo được thì không được báo xanh.\n' +
      '  `warnings` KHÔNG đổi mã thoát.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let prsFile: string | undefined;
  let now: string | undefined;
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') {
      asJson = true;
    } else if (arg === '--prs' || arg === '--now') {
      const value = argv[index + 1];
      // Cờ ở cuối dòng lệnh mà không có giá trị: KHÔNG được lặng lẽ rơi về
      // đồng hồ hệ thống — `--now` là thứ làm phép đo tái lập được.
      if (value === undefined || value.startsWith('--')) usage();
      index += 1;
      if (arg === '--prs') prsFile = value;
      else now = value;
    } else {
      usage();
    }
  }
  if (prsFile === undefined) usage();

  const prs = JSON.parse(readFileSync(prsFile, 'utf8')) as unknown[];
  if (!Array.isArray(prs)) {
    throw new TypeError('File đầu vào phải là một MẢNG PR. Một object lẻ không phải "không PR nào kẹt".');
  }
  const report = queueOrphans(prs, now ?? new Date().toISOString());
  const render = renderQueueOrphans(report);
  process.stdout.write(
    asJson
      ? `${JSON.stringify({ now: now ?? null, alertHours: ORPHAN_ALERT_HOURS, ...report, render })}\n`
      : `${render}\n`,
  );

  // Thoát khác 0 để một bước workflow có thể `if !` nó (cùng hình dạng
  // `watchdog.yml` dùng cho dấu hiệu số 6 và 7). `problems` cũng làm đỏ:
  // một phép đo không đo được phải nói ra, không được báo xanh. `warnings`
  // thì KHÔNG — xem docstring của trường đó.
  if (report.overThreshold.length > 0 || report.problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
