#!/usr/bin/env node
/**
 * "Cần người" là một trạng thái CÓ CHỦ — cơ chế của mục `P-022`
 * (`ops/lanes/platform/backlog.md`).
 *
 * Bước 0 của phụ lục P3 (chạy ở đầu **mọi** lượt worker) gọi
 * `ops/scripts/integrator-resolve.ts`. Khi tool trả `aborted-ineligible`,
 * nó đã làm đúng: có xoá/sửa dòng ở ít nhất một bên thì nó không tự giải,
 * và P3 bước 0b cấm thử `--ours`/`--theirs`/rebase/sửa tay. Nhưng **sau đó
 * không ai nhận việc**: bước 0 chỉ ghi "1 bỏ lại, cần người" rồi worker đi
 * duyệt backlog như thường.
 *
 * Đo được trên PR #26: bốn lượt `aborted-ineligible` liên tiếp, cùng một
 * `reason`. Trên PR #39: ba lượt liên tiếp trong một giờ. Hàng đợi merge là
 * tuần tự (CHARTER mục 7) nên một PR kẹt chặn cả hàng đợi.
 *
 * File này biến luật đó thành thứ máy tính được, gồm ba việc:
 *
 * 1. **Chọn PR phải nhận** (`selectPickup`, `assignPickup`) — cùng điều
 *    kiện chống giẫm chân đang dùng cho CI đỏ: không có commit mới trong
 *    `PICKUP_QUIET_HOURS` giờ. PR kẹt lâu nhất đứng trước.
 * 2. **Suy làn sở hữu** từ tên nhánh (`ownerLaneOf`) — giải xung đột cần
 *    biết PR đó định làm gì, nên việc thuộc làn sở hữu trước tiên.
 * 3. **Đếm nhịp tim** (`consecutiveAbortedTurns`, `selectEscalations`) —
 *    một luật mà không có ai đếm thì nó im lặng đúng lúc cần kêu, và lần
 *    trước nó đã im lặng bốn lượt (nhóm Z trong `ops/known-failures.md`).
 *
 * Mọi quyết định nằm ở hàm thuần, kiểm bằng dữ liệu giả lập, không gọi
 * mạng — cùng triết lý với `integrator-resolve.ts` và
 * `reap-abandoned-drafts.ts`. Lớp vỏ ở `main()` chỉ đọc file và in ra.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseLaneAndId } from './reap-abandoned-drafts.ts';

/**
 * Không có commit mới trong ngần này giờ thì coi như không worker nào đang
 * xử lý PR đó. Bằng đúng ngưỡng mà phụ lục P1 bước 2 đang dùng cho ca
 * "CI đỏ" — ca mới đứng ngang giá với ca cũ, nên không được có ngưỡng riêng.
 */
export const PICKUP_QUIET_HOURS = 2;

/**
 * Quá ngần này lượt `aborted-ineligible` liên tiếp thì PR phải nổi lên bản
 * tin ngày (CHARTER phụ lục P2). Ba, vì đó là ngưỡng "cùng một chữ ký lỗi
 * lần thứ ba" của CLAUDE.md mục 13 — cùng một con số cho cùng một ý, không
 * đặt thêm một ngưỡng thứ hai để phải nhớ.
 */
export const ESCALATE_AFTER_TURNS = 3;

/** Bốn kết quả của `integrator-resolve.ts`. */
export type ResolveOutcome = 'resolved' | 'clean' | 'aborted-ineligible' | 'aborted-error';

export interface StuckPrCandidate {
  number: number;
  headRefName: string;
  /** ISO 8601 — commit cuối cùng trên nhánh PR. */
  lastCommitAt: string;
  /**
   * ISO 8601 — lúc PR bắt đầu xung đột, tức lúc commit làm nó `dirty` vào
   * `main`. Dùng để xếp "PR kẹt lâu nhất trước" (P3 bước 0a).
   */
  conflictedSinceAt: string;
  /** Kết quả lượt bước 0 gần nhất trên chính PR này. */
  lastOutcome: ResolveOutcome;
}

function hoursSince(iso: string, now: Date): number | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / (1000 * 60 * 60);
}

/** `claude/<lane>/<id>` → `<lane>`. Nhánh không khớp thì `null` — không đoán. */
export function ownerLaneOf(branch: string): string | null {
  return parseLaneAndId(branch)?.lane ?? null;
}

/** Số giờ PR đã kẹt ở trạng thái xung đột. Ngày giờ hỏng thì `null`. */
export function hoursStuck(
  pr: Pick<StuckPrCandidate, 'conflictedSinceAt'>,
  now: Date,
): number | null {
  return hoursSince(pr.conflictedSinceAt, now);
}

/**
 * PR này có phải việc phải nhận ngay không.
 *
 * Hai điều kiện, và **chỉ** hai: lượt bước 0 gần nhất trả
 * `aborted-ineligible`, và không có commit mới trong `quietHours` giờ.
 *
 * `aborted-error` KHÔNG vào đây: P3 bước 0 nói rõ đó là lỗi ngoài dự tính
 * (cây bẩn, v.v.) và "không thử lại trong cùng lần chạy" — nó là hỏng ở
 * phía công cụ, không phải một PR đang chờ người. `resolved`/`clean` thì
 * tool đã lo xong.
 *
 * Ngày giờ commit hỏng ⇒ `false`: không đoán, và đoán sai ở hướng này là
 * hai worker cùng giẫm lên một PR.
 */
export function needsPickup(
  pr: Pick<StuckPrCandidate, 'lastOutcome' | 'lastCommitAt'>,
  now: Date,
  quietHours: number = PICKUP_QUIET_HOURS,
): boolean {
  if (pr.lastOutcome !== 'aborted-ineligible') return false;
  const quiet = hoursSince(pr.lastCommitAt, now);
  if (quiet === null) return false;
  return quiet >= quietHours;
}

/**
 * Mọi PR phải nhận, PR **kẹt lâu nhất đứng trước** (P3 bước 0a). Kẹt bằng
 * nhau thì số PR nhỏ hơn trước, để hai lượt chạy khác nhau trên cùng dữ
 * liệu luôn chọn cùng một PR.
 */
export function selectPickup(
  prs: StuckPrCandidate[],
  now: Date,
  quietHours: number = PICKUP_QUIET_HOURS,
): StuckPrCandidate[] {
  return prs
    .filter((pr) => needsPickup(pr, now, quietHours))
    .sort((a, b) => {
      const ha = hoursStuck(a, now) ?? Number.NEGATIVE_INFINITY;
      const hb = hoursStuck(b, now) ?? Number.NEGATIVE_INFINITY;
      if (ha !== hb) return hb - ha;
      return a.number - b.number;
    });
}

export interface PickupAssignment {
  pr: StuckPrCandidate;
  /** Làn sở hữu PR, suy từ tên nhánh. `null` khi nhánh không theo quy ước. */
  ownerLane: string | null;
  hoursStuck: number | null;
}

/**
 * Đúng **một** PR để lượt chạy này nhận, hoặc `null`. Một, vì phụ lục P1
 * bước 2 nói "xử lý đúng một PR đó rồi kết thúc": một PR kẹt chặn hàng đợi
 * tuần tự, nên nhận hai PR cùng lúc chỉ làm chậm cả hai.
 *
 * Hàm này KHÔNG lọc theo làn. Luật là: việc thuộc làn sở hữu PR, nhưng
 * "làn đó không có worker rảnh ở lượt kế tiếp" thì worker gặp nó vẫn phải
 * nhận — thà một worker khác làn giải còn hơn PR nằm chờ. Dự án không gán
 * worker theo làn (worker duyệt `ops/lanes/priority.md`), nên vế sau là vế
 * thường gặp, và `ownerLane` ở đây là thứ phải **ghi vào log**, không phải
 * thứ để loại PR ra.
 */
export function assignPickup(
  prs: StuckPrCandidate[],
  now: Date,
  quietHours: number = PICKUP_QUIET_HOURS,
): PickupAssignment | null {
  const pr = selectPickup(prs, now, quietHours)[0];
  if (pr === undefined) return null;
  return { pr, ownerLane: ownerLaneOf(pr.headRefName), hoursStuck: hoursStuck(pr, now) };
}

// --- Nhịp tim: đếm số lượt `aborted-ineligible` liên tiếp ---

/**
 * Một PR bỏ lại, ghi trong `note` của dòng log bước 0. Bốn trường này là
 * đúng những gì P-022 đòi bước 0 phải ghi cho mỗi PR bỏ lại: nhánh, làn sở
 * hữu, số lượt liên tiếp, số giờ kẹt.
 */
export interface StuckEntry {
  pr: number;
  branch: string;
  lane: string | null;
  outcome: ResolveOutcome;
  turns: number;
  hoursStuck: number;
}

/**
 * Dấu mở đầu khối máy đọc trong `note`. `note` vẫn là văn xuôi tiếng Việt
 * cho người đọc; khối này đi sau để lượt sau **đếm** được thay vì phải đọc
 * hiểu. Không có khối này thì không đếm được — xem `consecutiveAbortedTurns`.
 */
export const STUCK_MARKER = 'stuck=';

export function formatStuckNote(prose: string, entries: StuckEntry[]): string {
  const head = prose.trim();
  return `${head}${head === '' ? '' : ' '}${STUCK_MARKER}${JSON.stringify(entries)}`;
}

/**
 * Đọc khối máy đọc ra khỏi một `note`. Không có khối, hoặc khối hỏng, thì
 * `[]` — **không** ném. Dòng log là thứ đã ghi rồi, không sửa được (log
 * append-only), nên một dòng cũ viết bằng văn xuôi thuần không được phép
 * làm đỏ lượt chạy sau.
 */
export function parseStuckEntries(note: string | undefined): StuckEntry[] {
  if (note === undefined) return [];
  const at = note.lastIndexOf(STUCK_MARKER);
  if (at === -1) return [];
  try {
    const parsed: unknown = JSON.parse(note.slice(at + STUCK_MARKER.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is StuckEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as StuckEntry).pr === 'number' &&
        typeof (entry as StuckEntry).outcome === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Số lượt bước 0 **liên tiếp gần đây nhất** mà PR này ra
 * `aborted-ineligible`, tính CẢ lượt đang chạy nếu nó đã nằm trong
 * `notes`. `notes` xếp cũ → mới.
 *
 * Một lượt phá chuỗi khi nó nhắc tới PR với kết quả khác, **và cũng khi nó
 * không nhắc tới PR** — lượt đó PR không xung đột, nên chuỗi đứt thật.
 *
 * Dòng log cũ không mang khối `stuck=` ra `[]`, tức là phá chuỗi. Đó là
 * hướng sai an toàn: đếm thiếu thì cùng lắm chậm một lượt mới báo động,
 * còn đếm thừa thì gửi báo động giả tới chủ dự án (rủi ro B11).
 */
export function consecutiveAbortedTurns(notes: Array<string | undefined>, prNumber: number): number {
  let turns = 0;
  for (let i = notes.length - 1; i >= 0; i--) {
    const entry = parseStuckEntries(notes[i]).find((e) => e.pr === prNumber);
    if (entry?.outcome !== 'aborted-ineligible') break;
    turns += 1;
  }
  return turns;
}

/**
 * `turns` để GHI cho lượt đang chạy: lấy số của lượt ngay trước **cộng
 * một**, chứ không đếm lại từ đầu.
 *
 * Vì sao không dùng thẳng `consecutiveAbortedTurns`: nó chỉ đếm được những
 * lượt đã có khối `stuck=`. Dòng log là append-only nên các lượt trước khi
 * có cơ chế này mãi mãi là văn xuôi thuần, và đếm lại từ đầu ở mỗi lượt sẽ
 * **vĩnh viễn** bỏ chúng — một PR đã kẹt bốn lượt tụt về 1 rồi bò lên lại,
 * và ngưỡng báo động không bao giờ tới. Cộng dồn thì một số đếm tay ghi vào
 * `turns` một lần được mang tiếp mãi.
 *
 * `consecutiveAbortedTurns` vẫn có việc của nó: đối chứng độc lập, đếm bằng
 * chính các dòng log thay vì tin con số dòng trước khai.
 */
export function nextTurnCount(notes: Array<string | undefined>, prNumber: number): number {
  const previous = parseStuckEntries(notes[notes.length - 1]).find((e) => e.pr === prNumber);
  if (previous?.outcome !== 'aborted-ineligible') return 1;
  const carried = previous.turns;
  return (Number.isFinite(carried) && carried > 0 ? Math.floor(carried) : 1) + 1;
}

/**
 * PR nào đã quá ngưỡng và phải nổi lên bản tin ngày. Trả về danh sách đã
 * xếp: nhiều lượt nhất trước.
 */
export function selectEscalations(
  entries: StuckEntry[],
  threshold: number = ESCALATE_AFTER_TURNS,
): StuckEntry[] {
  return entries
    .filter((entry) => entry.outcome === 'aborted-ineligible' && entry.turns >= threshold)
    .sort((a, b) => (b.turns !== a.turns ? b.turns - a.turns : a.pr - b.pr));
}

/** Một dòng tiếng Việt cho bản tin ngày, mục "Cần anh quyết". */
export function escalationLine(entry: StuckEntry, repoUrl: string): string {
  const lane = entry.lane ?? 'không rõ làn';
  return (
    `PR #${entry.pr} (${lane}, \`${entry.branch}\`) kẹt xung đột ` +
    `${Math.floor(entry.hoursStuck)} giờ, ${entry.turns} lượt liên tiếp không tự giải được ` +
    `— cần anh gỡ tay: ${repoUrl}/pull/${entry.pr}`
  );
}

// --- Lớp vỏ: đọc log bước 0 và in ra. Không gọi mạng. ---

const P016_LOG = join('ops', 'logs', 'platform', 'P-016.jsonl');

/**
 * `note` của mọi dòng log bước 0, xếp cũ → mới **theo `at`**. Thứ tự dòng
 * trong file không mang nghĩa (`merge=union` không xếp theo thời gian), nên
 * quên sắp là đếm sai mà không gì đỏ — cùng cái bẫy mà `readRunLogs` sinh
 * ra để chặn (CLAUDE.md mục 15).
 */
export function readStepZeroNotes(root: string = process.cwd()): Array<string | undefined> {
  const path = join(root, P016_LOG);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as { at: string; note?: string });
  return lines
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((line) => line.note);
}

function main(): void {
  const notes = readStepZeroNotes();
  const latest = parseStuckEntries(notes[notes.length - 1]);
  const escalations = selectEscalations(latest);
  process.stdout.write(
    `${JSON.stringify(
      {
        quietHours: PICKUP_QUIET_HOURS,
        escalateAfterTurns: ESCALATE_AFTER_TURNS,
        stuck: latest,
        escalations,
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
