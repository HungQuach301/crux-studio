#!/usr/bin/env node
/**
 * Mục `platform/P-041` — hai worker nhận **cùng một mục backlog**, và không
 * gì đỏ. Nhóm **Z** (`ops/known-failures.md`), chữ ký `KF-025`.
 *
 * ## Chỗ hỏng, đo được chứ không suy
 *
 * Ngày 2026-09-24, mục `integration/I-020`, hai lượt worker cách nhau
 * **89 giây**:
 *
 * | PR | Routine | Tạo lúc | Kết cục |
 * |---|---|---|---|
 * | `#221` | `crux-worker-2` | 03:40:00Z | merge 03:44:45Z |
 * | `#222` | `crux-worker-1` | 03:41:29Z | còn mở, **xung đột vĩnh viễn** với `main` |
 *
 * Cả hai làm đúng luật như nó được viết: phụ lục P1 bước 3 đòi mục `ready`,
 * `deps` đã xong, *"chưa có nhánh `claude/<lane>/<id>` và chưa có PR mở"*.
 * Lượt sau đọc danh sách PR lúc ~03:38Z, khi `#221` chưa tồn tại, rồi làm
 * việc một giờ và push. Không cổng nào hỏi lại. Hai PR xanh, CI xanh,
 * `pnpm check` xanh — đúng hình dạng nhóm Z.
 *
 * **Và nó xảy ra lần thứ hai ngay trong chính lượt viết ra mục này**: mã
 * `P-040` bị `#224` (05:41:17Z) và `#225` (05:51:02Z) cùng nhận, cách nhau
 * 9,75 phút. Lần này chính bộ dò dưới đây bắt được, nên mục đổi sang
 * `P-041`. Đó là lý do luật ở bước 4 đòi hỏi **lại** trước khi push, chứ
 * không chỉ lúc chọn mục.
 *
 * ## Bốn luật thiết kế, cả bốn đều là chỗ dễ làm sai
 *
 * 1. **Chữ ký lấy từ TIÊU ĐỀ PR, không lấy từ tên nhánh.** Phiên cloud được
 *    nền tảng gán nhánh ngẫu nhiên (`claude/dreamy-ride-oh9k8r`), nên
 *    `laneFromBranch` trả `null` cho phần lớn PR — đo lúc viết mục này:
 *    **5 trên 7** PR đang mở có nhánh không theo quy ước. Một bộ dò neo vào
 *    tên nhánh sẽ im lặng đúng ở những PR nó cần bắt nhất.
 *
 *    Tiền tố `🤖` của `CLAUDE.md` mục 5 **phải** được bỏ qua: 29 commit trên
 *    `main` mang nó, trong đó `🤖 [platform] P-038 — …` là một PR nhận mục
 *    thật. Neo cứng vào `[` làm `claimCheck` trả `free` cho một mục đang có
 *    người giữ — fail-open ở đúng chỗ mục này sinh ra để chặn.
 *
 * 2. **PR đã merge cũng tính, không chỉ PR đang mở.** Ca `#221`/`#222` là
 *    bằng chứng: PR thứ nhất merge lúc 03:44, PR thứ hai còn mở tới giờ.
 *    Một phép dò chỉ nhìn PR *đang mở* sẽ tắt tiếng đúng vào lúc chỗ hỏng
 *    trở thành vĩnh viễn. Và "đã merge" suy từ **`mergedAt`**, không nhận
 *    một cờ boolean: endpoint liệt kê PR của GitHub trả `merged: false` cho
 *    cả PR đã merge, chỉ `merged_at` là đúng ở cả hai endpoint.
 *
 * 3. **Sóng nối tiếp KHÔNG phải va chạm.** `platform/P-014` cố ý làm theo
 *    sóng, mỗi sóng một PR (`#62`, `#196`, `#223`) — và đó là việc đúng,
 *    không phải lỗi. Phân biệt bằng **thời gian sống chồng nhau**: chỉ báo
 *    khi PR sau ra đời lúc PR trước còn mở. Đếm theo mã mục thôi sẽ biến
 *    mọi mục làm nhiều đợt thành báo động giả, và một bộ dò kêu sai vài lần
 *    là một bộ dò bị tắt.
 *
 * 4. **Đầu vào thiếu hay hỏng thì NÉM, không trả `free`.** Đây là chỗ dễ
 *    sai nhất, vì `free` trông y hệt một câu trả lời. Một `now` không parse
 *    được, một tên làn viết sai, một `PrSnapshot` thiếu `closedAt` — cả ba
 *    đều cho "không ai giữ mục này" nếu hàm dễ dãi, và cả ba đều dẫn thẳng
 *    tới đúng va chạm mục này chữa. Luật: **cấm im lặng** (`Z15`), hướng
 *    lệch duy nhất được phép là *báo nhầm*, không bao giờ là *bỏ sót*.
 */

import { LANES, type LaneName } from '@crux/kernel';

/**
 * Cửa sổ ân hạn sau khi một PR merge: mục vừa vào `main` xong mà lượt sau
 * vẫn nhận lại thì gần như chắc chắn nó đọc backlog **trước** lúc merge.
 * Không chặn (sóng nối tiếp là việc đúng), chỉ nhắc đọc lại backlog.
 */
export const RECENT_MERGE_MINUTES = 30;

/**
 * `CLAUDE.md` mục 2 và CHARTER phụ lục P1 bước 3: *"PR nháp không có commit
 * mới quá 24 giờ thì coi như bỏ"*. Không có luật này thì một PR nháp chết
 * khoá mục của nó **vĩnh viễn** — luật mới sẽ nói ngược luật cũ đứng ngay
 * trên nó.
 */
export const ABANDONED_DRAFT_HOURS = 24;

/**
 * Ảnh chụp một PR. **Mọi trường đều bắt buộc**, kể cả `isDraft` và
 * `updatedAt`: cả sáu tới từ đúng một lần liệt kê PR, nên đòi đủ không tốn
 * thêm gì, còn nhận thiếu rồi mặc định `false` là đoán — và mọi cú đoán ở
 * đây lệch về phía "mục đang rảnh" (luật thiết kế 4).
 */
export interface PrSnapshot {
  number: number;
  title: string;
  createdAt: string;
  /** `null` khi PR còn mở. */
  closedAt: string | null;
  /** `null` khi PR chưa merge. Suy `merged` từ trường này, xem luật 2. */
  mergedAt: string | null;
  isDraft: boolean;
  updatedAt: string;
}

/** Mục backlog mà một PR khai trong tiêu đề của nó. */
export interface ClaimKey {
  lane: LaneName;
  id: string;
}

/** Đầu vào không đủ để trả lời — không bao giờ nuốt thành một phán quyết. */
export class ClaimInputError extends Error {}

/**
 * Cùng hình dạng tiêu đề mà `hasCompletionCommit` đọc: `[<lane>] <id> — …`,
 * cộng tiền tố `🤖` tuỳ chọn của `CLAUDE.md` mục 5 (xem luật 1). Tên làn
 * phải khớp đúng một tên trong `LANES` — không suy luận gần đúng, để bên
 * gọi không gán nhầm việc cho một làn không tồn tại.
 */
const TITLE = /^(?:🤖\s*)?\[([a-z]+)\]\s+([A-Za-z0-9][A-Za-z0-9._-]*)\s+[—–-]\s/;

export function claimKeyFromTitle(title: string): ClaimKey | null {
  const match = TITLE.exec(title.trim());
  if (match === null) return null;
  const lane = match[1]!;
  if (!(LANES as readonly string[]).includes(lane)) return null;
  return { lane: lane as LaneName, id: match[2]! };
}

export const claimKeyText = (key: ClaimKey): string => `${key.lane}/${key.id}`;

const isMerged = (pr: PrSnapshot): boolean => pr.mergedAt !== null;

const parsedOrNull = (value: string | null): number | null => {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Mọi `PrSnapshot` phải đủ trường và `at` phải đọc được. Ném kèm **tên PR
 * và tên trường** chứ không chỉ "đầu vào sai": lượt sau phải sửa được chỗ
 * dựng ảnh chụp, không phải đoán.
 */
export function assertSnapshots(prs: readonly PrSnapshot[]): void {
  const problems: string[] = [];
  for (const pr of prs) {
    const label = `#${pr.number ?? '?'}`;
    if (typeof pr.title !== 'string') problems.push(`${label}: thiếu title`);
    if (typeof pr.isDraft !== 'boolean') problems.push(`${label}: thiếu isDraft`);
    if (pr.closedAt === undefined) problems.push(`${label}: thiếu closedAt (null nếu PR còn mở)`);
    if (pr.mergedAt === undefined) problems.push(`${label}: thiếu mergedAt (null nếu chưa merge)`);
    for (const field of ['createdAt', 'updatedAt'] as const) {
      if (typeof pr[field] !== 'string' || !Number.isFinite(Date.parse(pr[field]))) {
        problems.push(`${label}: ${field} không đọc được (${String(pr[field])})`);
      }
    }
    for (const field of ['closedAt', 'mergedAt'] as const) {
      const value = pr[field];
      if (typeof value === 'string' && !Number.isFinite(Date.parse(value))) {
        problems.push(`${label}: ${field} không đọc được (${value})`);
      }
    }
  }
  if (problems.length > 0) {
    throw new ClaimInputError(`Ảnh chụp PR không đủ để trả lời:\n  - ${problems.join('\n  - ')}`);
  }
}

/** Một cặp PR cùng mục có thời gian sống chồng nhau. */
export interface DuplicateClaim {
  claim: string;
  /** PR ra đời trước. */
  first: number;
  /** PR ra đời sau, trong lúc `first` còn mở. */
  second: number;
  /**
   * Số phút giữa hai lần tạo — số nhỏ nghĩa là hai lượt worker chạy chồng
   * nhau. `null` khi không đo được; bản in nói "không đo được", không in
   * `NaN` (bất biến **I6**: mọi con số hiển thị phải có nguồn).
   */
  minutesApart: number | null;
  /** `first` đã merge chưa — merge rồi thì `second` kẹt xung đột. */
  firstMerged: boolean;
}

const minutesBetween = (from: string, to: string): number | null => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(((b - a) / 60_000) * 100) / 100;
};

/**
 * Các PR có tiêu đề **không** đọc được thành mã mục. In ra chứ không bỏ qua
 * im lặng: một tiêu đề lệch quy ước làm PR đó vô hình với mọi phép đếm ở
 * đây, và im lặng biến một phép đo hỏng thành một kết luận trông chắc nịch
 * (bài học `Z15`).
 */
export function unreadableTitles(prs: readonly PrSnapshot[]): number[] {
  return prs
    .filter((pr) => claimKeyFromTitle(pr.title) === null)
    .map((pr) => pr.number)
    .sort((a, b) => b - a);
}

/**
 * Mọi cặp PR cùng một mục mà thời gian sống chồng nhau.
 *
 * "Chồng nhau" = PR sau được tạo khi PR trước **chưa đóng**. PR trước còn
 * mở (`closedAt === null`) thì mọi PR sau của cùng mục đều chồng. Mốc không
 * đọc được thì cặp đó **được coi là chồng** — thiên lệch về phía báo, vì
 * một cặp bỏ sót là đúng chỗ hỏng mà mục này sinh ra để bắt.
 *
 * Thứ tự kết quả **ổn định**: nhóm sắp theo `createdAt` rồi tới số PR, kết
 * quả cuối sắp theo mã mục rồi hai số PR. Hai thứ tự đầu vào khác nhau phải
 * cho **cùng một** kết quả, nếu không hai lượt đọc cùng dữ liệu sẽ ghi hai
 * câu khác nhau — đúng hình dạng `KF-021`.
 */
export function duplicateClaims(prs: readonly PrSnapshot[]): DuplicateClaim[] {
  const byClaim = new Map<string, PrSnapshot[]>();
  for (const pr of prs) {
    const key = claimKeyFromTitle(pr.title);
    if (key === null) continue;
    const text = claimKeyText(key);
    byClaim.set(text, [...(byClaim.get(text) ?? []), pr]);
  }

  const found: DuplicateClaim[] = [];
  for (const [claim, group] of byClaim) {
    const sorted = [...group].sort(
      (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.number - b.number,
    );
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i]!;
        const second = sorted[j]!;
        const closed = parsedOrNull(first.closedAt);
        const born = parsedOrNull(second.createdAt);
        const overlaps = closed === null || born === null || born < closed;
        if (!overlaps) continue;
        found.push({
          claim,
          first: first.number,
          second: second.number,
          minutesApart: minutesBetween(first.createdAt, second.createdAt),
          firstMerged: isMerged(first),
        });
      }
    }
  }
  return found.sort((a, b) => a.claim.localeCompare(b.claim) || a.first - b.first || a.second - b.second);
}

/** Vì sao một mục không nhận được ngay bây giờ. */
export type ClaimVerdict =
  /** Có PR đang mở cho mục này — KHÔNG nhận (`CLAUDE.md` mục 2). */
  | 'open-pr'
  /** Chỉ còn PR nháp bỏ quá `ABANDONED_DRAFT_HOURS` — coi như bỏ, nhận được. */
  | 'abandoned-draft'
  /** PR của mục này vừa merge trong `RECENT_MERGE_MINUTES` — đọc lại backlog trước khi nhận. */
  | 'recently-merged'
  /** Không PR nào đang giữ mục này. */
  | 'free';

export interface ClaimCheck {
  claim: string;
  verdict: ClaimVerdict;
  /** Số PR đứng sau phán quyết, mới nhất trước. Rỗng khi `free`. */
  prs: number[];
  /**
   * PR có tiêu đề không đọc được thành mã mục, trong đúng ảnh chụp này.
   * **Không tuỳ chọn:** một `free` dựng trên ảnh chụp có PR vô hình là một
   * `free` chưa chắc, và bên gọi phải thấy điều đó chứ không chỉ `duplicateClaims`
   * mới được thấy — hai cửa, không cửa nào im.
   */
  unreadable: number[];
}

/**
 * Phép hỏi của phụ lục P1 bước 3 và bước 4: mục `<lane>/<id>` có ai giữ
 * không, **tính ở đúng mốc `now`**.
 *
 * Bên gọi chạy lại phép này **ngay trước khi push commit đầu tiên**, không
 * chỉ lúc bắt đầu duyệt backlog: khoảng trống giữa hai mốc đó chính là
 * 89 giây đã sinh ra `#221`/`#222`, và 9,75 phút đã sinh ra `#224`/`#225`.
 *
 * Ném `ClaimInputError` khi không đủ dữ kiện để trả lời — xem luật 4.
 */
export function claimCheck(
  prs: readonly PrSnapshot[],
  lane: string,
  id: string,
  now: string,
): ClaimCheck {
  if (!(LANES as readonly string[]).includes(lane)) {
    throw new ClaimInputError(`Tên làn không thuộc LANES: ${lane}`);
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new ClaimInputError(`Mốc "now" không đọc được: ${now}`);
  assertSnapshots(prs);

  const claim = claimKeyText({ lane: lane as LaneName, id });
  const unreadable = unreadableTitles(prs);
  const mine = prs.filter((pr) => {
    const key = claimKeyFromTitle(pr.title);
    return key !== null && claimKeyText(key) === claim;
  });
  const numbers = (list: readonly PrSnapshot[]): number[] =>
    list.map((pr) => pr.number).sort((a, b) => b - a);

  const open = mine.filter((pr) => pr.closedAt === null);
  if (open.length > 0) {
    const alive = open.filter(
      (pr) => !pr.isDraft || nowMs - Date.parse(pr.updatedAt) < ABANDONED_DRAFT_HOURS * 3_600_000,
    );
    // Chỉ khi MỌI PR đang mở đều là nháp đã bỏ thì mục mới nhận lại được:
    // một PR sống cộng một PR nháp chết vẫn là "có người giữ".
    return alive.length > 0
      ? { claim, verdict: 'open-pr', prs: numbers(alive), unreadable }
      : { claim, verdict: 'abandoned-draft', prs: numbers(open), unreadable };
  }

  const cutoff = nowMs - RECENT_MERGE_MINUTES * 60_000;
  const recent = mine.filter((pr) => isMerged(pr) && Date.parse(pr.mergedAt!) >= cutoff);
  if (recent.length > 0) {
    return { claim, verdict: 'recently-merged', prs: numbers(recent), unreadable };
  }

  return { claim, verdict: 'free', prs: [], unreadable };
}

/**
 * Bảng người đọc. **In cả khi không có va chạm nào** — im lặng ở đây đúng
 * là thứ nhóm Z cấm (bài học `Z7`/`Z15`).
 */
export function renderDuplicateClaims(
  duplicates: readonly DuplicateClaim[],
  unreadable: readonly number[] = [],
): string {
  const head =
    duplicates.length === 0
      ? 'Va chạm nhận mục: 0 — không mục nào có hai PR sống chồng nhau.'
      : `Va chạm nhận mục: ${duplicates.length} cặp PR cùng một mục, thời gian sống chồng nhau:`;
  const rows = duplicates.map(
    (d) =>
      `  ✗ ${d.claim}: #${d.first} và #${d.second}, ` +
      (d.minutesApart === null ? 'không đo được khoảng cách' : `cách nhau ${d.minutesApart} phút`) +
      (d.firstMerged ? ` — #${d.first} ĐÃ MERGE, nên #${d.second} kẹt xung đột` : ''),
  );
  const tail =
    unreadable.length === 0
      ? ''
      : `\n  · ${unreadable.length} PR có tiêu đề không đọc được thành mã mục (vô hình với phép đếm này): ` +
        unreadable.map((n) => `#${n}`).join(' ');
  return [head, ...rows].join('\n') + tail;
}

// ── CLI ──────────────────────────────────────────────────────────────────
interface CliInput {
  /** Ảnh chụp PR — mở lẫn đã đóng; càng đủ thì phép đếm càng đúng. */
  prs?: readonly PrSnapshot[];
  /** Có thì tool trả thêm `claimCheck` cho đúng mục đó. */
  lane?: string;
  id?: string;
  now?: string;
}

const isMain = process.argv[1]?.endsWith('claim-collision.ts') === true;

if (isMain) {
  const { readFileSync } = await import('node:fs');
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write(
      'Thiếu đường dẫn file JSON: {prs:[{number,title,createdAt,closedAt,mergedAt,isDraft,updatedAt}], lane?, id?, now?}\n',
    );
    process.exit(2);
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as CliInput;
    const prs = raw.prs ?? [];
    assertSnapshots(prs);
    const duplicates = duplicateClaims(prs);
    const unreadable = unreadableTitles(prs);
    // Hỏi mục nào thì phải trả lời được mục đó: khai `lane`/`id` mà thiếu
    // một nửa là đầu vào hỏng, không phải lời mời bỏ qua phần `check`.
    if ((raw.lane === undefined) !== (raw.id === undefined)) {
      throw new ClaimInputError('Khai `lane` thì phải khai `id`, và ngược lại.');
    }
    const check =
      raw.lane === undefined
        ? null
        : claimCheck(prs, raw.lane, raw.id!, raw.now ?? new Date().toISOString());

    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ duplicates, unreadable, check })}\n`);
    } else {
      process.stdout.write(`${renderDuplicateClaims(duplicates, unreadable)}\n`);
      if (check !== null) process.stdout.write(`${JSON.stringify(check)}\n`);
    }
    // Thoát 0 kể cả khi CÓ va chạm: đây là phép ĐO cho bên gọi (worker, bản
    // tin), không phải một cổng chặn — cổng chặn duy nhất là người nhận việc
    // đọc `verdict` rồi đi mục khác.
  } catch (error) {
    // "Không trả lời được" KHÁC "không ai giữ mục này", và phải khác cả ở
    // mã thoát: một `free` giả đi thẳng vào đúng va chạm mục này chữa.
    process.stderr.write(`⚠ KHÔNG TRẢ LỜI ĐƯỢC — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}
