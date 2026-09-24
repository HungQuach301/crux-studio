#!/usr/bin/env node
/**
 * Mục `platform/P-040` — hai worker nhận **cùng một mục backlog**, và không
 * gì đỏ. Nhóm **Z** (`ops/known-failures.md`), chữ ký `KF-025`.
 *
 * ## Chỗ hỏng, đo được chứ không suy
 *
 * Ngày 2026-09-24, hai lượt worker nhận mục `integration/I-020` cách nhau
 * **89 giây**:
 *
 * | PR | Routine | Tạo lúc | Kết cục |
 * |---|---|---|---|
 * | `#221` | `crux-worker-2` | 03:40:00Z | merge 03:44:45Z |
 * | `#222` | `crux-worker-1` | 03:41:29Z | còn mở, **xung đột vĩnh viễn** với `main` |
 *
 * Cả hai làm đúng luật như nó được viết: phụ lục P1 bước 3 đòi mục
 * `ready`, `deps` đã xong, *"chưa có nhánh `claude/<lane>/<id>` và chưa có
 * PR mở"*. Lượt sau đọc danh sách PR lúc ~03:38Z, khi `#221` chưa tồn tại,
 * rồi làm việc một giờ và push. Không cổng nào hỏi lại. Hai PR xanh, CI
 * xanh, `pnpm check` xanh — đúng hình dạng nhóm Z, và cái giá là trọn một
 * lượt worker cộng một PR không bao giờ merge được.
 *
 * ## Ba luật thiết kế, cả ba đều là chỗ dễ làm sai
 *
 * 1. **Chữ ký lấy từ TIÊU ĐỀ PR, không lấy từ tên nhánh.** Phiên cloud được
 *    nền tảng gán nhánh ngẫu nhiên (`claude/dreamy-ride-oh9k8r`), nên
 *    `laneFromBranch` trả `null` cho phần lớn PR — đo lúc viết mục này:
 *    **5 trên 7** PR đang mở có nhánh không theo quy ước. Một bộ dò neo vào
 *    tên nhánh sẽ im lặng đúng ở những PR nó cần bắt nhất. Tiêu đề thì có
 *    máy canh: `hasCompletionCommit` (`ops/scripts/backlog-status.ts`) đã
 *    đọc đúng cùng một hình dạng `[<lane>] <id> — …`.
 *
 * 2. **PR đã merge cũng tính, không chỉ PR đang mở.** Ca `#221`/`#222` là
 *    bằng chứng: PR thứ nhất merge lúc 03:44, PR thứ hai còn mở tới giờ.
 *    Một phép dò chỉ nhìn PR *đang mở* sẽ tắt tiếng đúng vào lúc chỗ hỏng
 *    trở thành vĩnh viễn.
 *
 * 3. **Sóng nối tiếp KHÔNG phải va chạm.** `platform/P-014` cố ý làm theo
 *    sóng, mỗi sóng một PR (`#62`, `#196`, `#223`) — và đó là việc đúng,
 *    không phải lỗi. Phân biệt bằng **thời gian sống chồng nhau**: chỉ báo
 *    khi PR sau ra đời lúc PR trước còn mở. Đếm theo mã mục thôi sẽ biến
 *    mọi mục làm nhiều đợt thành báo động giả, và một bộ dò kêu sai vài lần
 *    là một bộ dò bị tắt.
 */

import { LANES, type LaneName } from '@crux/kernel';

/**
 * Cửa sổ ân hạn sau khi một PR merge: mục vừa vào `main` xong mà lượt sau
 * vẫn nhận lại thì gần như chắc chắn nó đọc backlog **trước** lúc merge.
 * Không chặn (sóng nối tiếp là việc đúng), chỉ nhắc đọc lại backlog.
 */
export const RECENT_MERGE_MINUTES = 30;

/** Ảnh chụp một PR, đúng những trường bên gọi lấy được từ một lần liệt kê. */
export interface PrSnapshot {
  number: number;
  title: string;
  /** `null` khi PR còn mở. */
  closedAt: string | null;
  merged: boolean;
  createdAt: string;
}

/** Mục backlog mà một PR khai trong tiêu đề của nó. */
export interface ClaimKey {
  lane: LaneName;
  id: string;
}

/**
 * Cùng hình dạng tiêu đề mà `hasCompletionCommit` đọc: `[<lane>] <id> — …`.
 * Tên làn phải khớp đúng một tên trong `LANES` — không suy luận gần đúng,
 * để bên gọi không gán nhầm việc cho một làn không tồn tại.
 */
const TITLE = /^\[([a-z]+)\]\s+([A-Za-z0-9][A-Za-z0-9._-]*)\s+[—–-]\s/;

export function claimKeyFromTitle(title: string): ClaimKey | null {
  const match = TITLE.exec(title.trim());
  if (match === null) return null;
  const lane = match[1]!;
  if (!(LANES as readonly string[]).includes(lane)) return null;
  return { lane: lane as LaneName, id: match[2]! };
}

export const claimKeyText = (key: ClaimKey): string => `${key.lane}/${key.id}`;

/** Một cặp PR cùng mục có thời gian sống chồng nhau. */
export interface DuplicateClaim {
  claim: string;
  /** PR ra đời trước. */
  first: number;
  /** PR ra đời sau, trong lúc `first` còn mở. */
  second: number;
  /** Số phút giữa hai lần tạo — số nhỏ nghĩa là hai lượt worker chạy chồng nhau. */
  minutesApart: number;
  /** `first` đã merge chưa tính tới lúc chụp ảnh — merge rồi thì `second` kẹt xung đột. */
  firstMerged: boolean;
}

const minutesBetween = (from: string, to: string): number =>
  Math.round(((Date.parse(to) - Date.parse(from)) / 60_000) * 100) / 100;

/**
 * Các PR có tiêu đề **không** đọc được thành mã mục. In ra chứ không bỏ qua
 * im lặng: một tiêu đề lệch quy ước làm PR đó vô hình với mọi phép đếm ở
 * đây, và im lặng biến một phép đo hỏng thành một kết luận trông chắc nịch
 * (bài học `Z15`).
 */
export function unreadableTitles(prs: readonly PrSnapshot[]): number[] {
  return prs.filter((pr) => claimKeyFromTitle(pr.title) === null).map((pr) => pr.number);
}

/**
 * Mọi cặp PR cùng một mục mà thời gian sống chồng nhau.
 *
 * "Chồng nhau" = PR sau được tạo khi PR trước **chưa đóng**. PR trước còn
 * mở (`closedAt === null`) thì mọi PR sau của cùng mục đều chồng.
 * Mốc `at` không đọc được thì cặp đó được coi là chồng — thiên lệch về phía
 * báo, vì một cặp bỏ sót là đúng chỗ hỏng mà mục này sinh ra để bắt.
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
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.number - b.number,
    );
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i]!;
        const second = sorted[j]!;
        const closed = first.closedAt === null ? null : Date.parse(first.closedAt);
        const born = Date.parse(second.createdAt);
        const overlaps = closed === null || !Number.isFinite(closed) || !Number.isFinite(born) || born < closed;
        if (!overlaps) continue;
        found.push({
          claim,
          first: first.number,
          second: second.number,
          minutesApart: minutesBetween(first.createdAt, second.createdAt),
          firstMerged: first.merged,
        });
      }
    }
  }
  return found.sort((a, b) => a.claim.localeCompare(b.claim) || a.first - b.first || a.second - b.second);
}

/** Vì sao một mục không nhận được ngay bây giờ. */
export type ClaimVerdict =
  /** Có PR đang mở cho mục này — KHÔNG nhận (CLAUDE.md mục 2). */
  | 'open-pr'
  /** PR của mục này vừa merge trong `RECENT_MERGE_MINUTES` — đọc lại backlog trước khi nhận. */
  | 'recently-merged'
  /** Không PR nào đang giữ mục này. */
  | 'free';

export interface ClaimCheck {
  claim: string;
  verdict: ClaimVerdict;
  /** Số PR đứng sau phán quyết, mới nhất trước. Rỗng khi `free`. */
  prs: number[];
}

/**
 * Phép hỏi của phụ lục P1 bước 3 và bước 4: mục `<lane>/<id>` có ai giữ
 * không, **tính ở đúng mốc `now`**.
 *
 * Bên gọi chạy lại phép này **ngay trước khi push commit đầu tiên**, không
 * chỉ lúc bắt đầu duyệt backlog: khoảng trống giữa hai mốc đó chính là
 * 89 giây đã sinh ra `#221`/`#222`.
 */
export function claimCheck(
  prs: readonly PrSnapshot[],
  lane: LaneName,
  id: string,
  now: string,
): ClaimCheck {
  const claim = claimKeyText({ lane, id });
  const mine = prs.filter((pr) => {
    const key = claimKeyFromTitle(pr.title);
    return key !== null && claimKeyText(key) === claim;
  });

  const open = mine.filter((pr) => pr.closedAt === null);
  if (open.length > 0) {
    return { claim, verdict: 'open-pr', prs: open.map((pr) => pr.number).sort((a, b) => b - a) };
  }

  const cutoff = Date.parse(now) - RECENT_MERGE_MINUTES * 60_000;
  const recent = mine.filter(
    (pr) => pr.merged && pr.closedAt !== null && Date.parse(pr.closedAt) >= cutoff,
  );
  if (recent.length > 0) {
    return { claim, verdict: 'recently-merged', prs: recent.map((pr) => pr.number).sort((a, b) => b - a) };
  }

  return { claim, verdict: 'free', prs: [] };
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
      `  ✗ ${d.claim}: #${d.first} và #${d.second}, cách nhau ${d.minutesApart} phút` +
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
    process.stderr.write('Thiếu đường dẫn file JSON: {prs, lane?, id?, now?}\n');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CliInput;
  const prs = raw.prs ?? [];
  const duplicates = duplicateClaims(prs);
  const unreadable = unreadableTitles(prs);
  const check =
    raw.lane !== undefined && raw.id !== undefined && (LANES as readonly string[]).includes(raw.lane)
      ? claimCheck(prs, raw.lane as LaneName, raw.id, raw.now ?? new Date().toISOString())
      : null;

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ duplicates, unreadable, check })}\n`);
  } else {
    process.stdout.write(`${renderDuplicateClaims(duplicates, unreadable)}\n`);
    if (check !== null) process.stdout.write(`${JSON.stringify(check)}\n`);
  }
  // Thoát 0 kể cả khi có va chạm: đây là phép ĐO cho bên gọi (worker, bản
  // tin), không phải một cổng chặn — cổng chặn duy nhất là người nhận việc
  // đọc `verdict` rồi đi mục khác.
}
