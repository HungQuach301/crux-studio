#!/usr/bin/env node
/**
 * Cơ chế của mục `P-022`: "cần người" chưa phải một trạng thái có ai sở
 * hữu. Trước mục này, khi `ops/scripts/integrator-resolve.ts` trả
 * `aborted-ineligible`, phụ lục P3 bước 0 chỉ *ghi nhận* rồi worker đi
 * duyệt backlog như thường — PR đó rơi vào khoảng trống giữa integrator
 * (đã làm xong phần của mình, và bị cấm giải tay) và worker (chưa thấy đó
 * là việc của mình). PR #26 từng kẹt bốn lượt liên tiếp vì đúng khoảng
 * trống này.
 *
 * File này cho phụ lục P1 bước 2 ca `aborted-ineligible`, ngang giá với "CI
 * đỏ" và "comment chưa xử lý" (khi `P-022` viết, đó là ca **thứ ba**; từ
 * `P-025` dưới đây nó là ca thứ **tư** — số thứ tự đổi, nội dung không):
 * PR mà lượt bước 0 gần nhất trả `aborted-ineligible`
 * là việc phải nhận ngay, trước khi duyệt backlog theo `ops/lanes/priority.md`.
 * Cùng điều kiện chống giẫm chân đang dùng cho hai ca kia (không có commit
 * mới trong 2 giờ).
 *
 * ## Mục `P-025` — chỗ đứt thứ hai: "gộp sạch rồi đỏ"
 *
 * Quyết định `reversible` ở issue `#107`, phương án A. Một PR xung đột với
 * `main` có **hai** cách kẹt, và bảng lý do trên đây chỉ đếm **một**:
 *
 * - **Cách A** — công cụ tự gộp bó tay (`aborted-ineligible`). Có đếm, có
 *   ngưỡng, nổi lên bản tin.
 * - **Cách B** — công cụ gộp **sạch**, nhưng `pnpm check`/`pnpm replay` sau
 *   khi gộp thì **đỏ**. Phụ lục P3 bước 0b bắt `git reset --hard` và KHÔNG
 *   push (đỏ sau khi gộp là tín hiệu thật, không được nuốt) — nên nhánh PR
 *   không đổi, CI trên nhánh vẫn xanh, và `abortedIneligibleStreak` vẫn 0.
 *
 * PR `#81` kẹt theo cách B **ba lượt liên tiếp** (09:04, 09:3x, 10:0x giờ VN
 * ngày 2026-09-22) và không lượt worker nào nhận nó: đã đo, cả ba lý do cũ
 * đều sai với nó — CI trên nhánh xanh 5/5, hai comment trên PR đều do máy
 * viết, chuỗi `aborted-ineligible` bằng 0. Đúng nhóm **Z**: hỏng mà mọi chỉ
 * báo đều xanh.
 *
 * Nên có lý do thứ tư, `red-after-merge`, đọc từ **cùng một** dòng log bước 0
 * như `aborted-ineligible` — không phải đo thêm gì.
 */

import { LANES, type LaneName } from '@crux/kernel';

/** Ngưỡng "chữ ký lỗi lặp lại" dùng chung với CHARTER mục 13 (ba lần thì báo động). */
export const ABORTED_INELIGIBLE_ALERT_THRESHOLD = 3;

/** Chống giẫm chân: không nhận một PR mà commit mới nhất của nó cách đây dưới ngần này giờ. */
export const ANTI_COLLISION_HOURS = 2;

/**
 * Thứ tự khai ở đây KHÔNG phải thứ tự ưu tiên — `pickPrToHandle` là nơi chốt
 * thứ tự đó, và nó đọc được thành một câu ở đúng một chỗ.
 */
export type TriageReason = 'ci-red' | 'unhandled-comment' | 'red-after-merge' | 'aborted-ineligible';

export interface TriageCandidate {
  number: number;
  branch: string;
  ciRed: boolean;
  hasUnhandledComment: boolean;
  /** Số lượt `aborted-ineligible` LIÊN TIẾP với cùng chữ ký, tính từ bước 0 gần nhất trở về trước. 0 nếu PR không xung đột hoặc integrator vừa giải được. */
  abortedIneligibleStreak: number;
  /**
   * Số lượt "gộp sạch rồi đỏ" LIÊN TIẾP, cùng cách đếm và cùng nguồn (dòng
   * log bước 0) như `abortedIneligibleStreak` — mục `P-025`, issue `#107`.
   *
   * Tách thành trường riêng chứ không gộp vào trường trên: hai chữ ký lỗi
   * khác nhau, và việc worker phải làm cũng khác (cách A là giải xung đột
   * bằng phán đoán; cách B là đọc chỗ đỏ rồi sửa). Gộp một trường sẽ làm
   * ghi chú của lượt sau không nói được nó đang nợ việc gì.
   *
   * **Luật trở về 0, không tuỳ chọn:** `0` khi PR có **commit mới sau** dòng
   * log ghi chuỗi đó. Trường trên trở về 0 theo điều kiện "PR không còn xung
   * đột", nhưng điều kiện đó KHÔNG áp được ở đây — PR kẹt kiểu này vốn đã
   * gộp sạch. Và phụ lục P3 bước 0a chỉ liệt kê PR **đang xung đột**, nên
   * một PR gộp sạch không bao giờ được bước 0 đo lại. Thiếu luật này thì sau
   * khi worker chữa cái đỏ và push, `pickPrToHandle` vẫn chọn lại đúng PR đó
   * ở mọi lượt (chỉ bị `ANTI_COLLISION_HOURS` chặn 2 giờ), làn đứng đói việc,
   * và không gì đỏ — nhóm **Z**. "Commit mới" là phép đo có sẵn: chính worker
   * chữa cái đỏ là người push commit đó, và `hoursSinceLastCommit` dưới đây
   * đã đọc cùng một thứ.
   */
  redAfterMergeStreak: number;
  hoursSinceLastCommit: number;
}

export interface TriagePick {
  candidate: TriageCandidate;
  reason: TriageReason;
  /** Làn suy ra từ tên nhánh — `null` nếu nhánh không theo dạng `claude/<lane>/<id>`. */
  lane: LaneName | null;
}

/**
 * Suy làn từ tên nhánh dạng `claude/<lane>/<id>`. Trả `null` cho mọi dạng
 * khác — kể cả nhánh log-only của integrator (`claude/<tên-ngẫu-nhiên>`,
 * không có đoạn làn hợp lệ) và nhánh không thuộc quy ước `claude/`.
 *
 * Không suy luận gần đúng: một đoạn thứ hai không khớp đúng tên trong
 * `LANES` thì coi như không suy được, để bên gọi không gán nhầm việc cho
 * một làn không tồn tại.
 */
export function laneFromBranch(branch: string): LaneName | null {
  const parts = branch.split('/').filter((part) => part.length > 0);
  if (parts.length < 3 || parts[0] !== 'claude') return null;
  const candidate = parts[1];
  return (LANES as readonly string[]).includes(candidate!) ? (candidate as LaneName) : null;
}

/**
 * Chọn đúng một PR để worker nhận ở bước 2 của phụ lục P1, hoặc `null` nếu
 * không PR nào đang cần. Thứ tự ưu tiên giữa các lý do đúng thứ tự liệt kê
 * trong CHARTER (CI đỏ trước, rồi comment chưa xử lý, rồi `red-after-merge`
 * — ca mới của `P-025` —, rồi `aborted-ineligible` — ca của `P-022`): một PR
 * vừa CI đỏ vừa xung đột thì lý do CI đỏ thắng, vì đó là ca đã có sẵn từ
 * trước và có tiêu chí xong gắn với nó (nhãn `fix`).
 *
 * **Vì sao `red-after-merge` chen vào đúng khe thứ ba, không phải thứ hai:**
 * issue `#107` chỉ đòi nó xếp *sau* `ci-red` và *trước* `aborted-ineligible`,
 * mà giữa hai chỗ đó còn `unhandled-comment`. Đặt lý do mới trước
 * `unhandled-comment` sẽ **đảo thứ tự ba lý do cũ**, thứ mà CHARTER phụ lục
 * P1 bước 2 chốt bằng lời, và sẽ đẩy một chỗ kẹt của máy lên trước một
 * comment của chủ dự án — tức tiêu thời gian của anh để tiết kiệm thời gian
 * của máy, ngược thước đo CHARTER 1.3. Nên khe thứ ba.
 *
 * Điều kiện chống giẫm chân áp dụng cho CẢ BỐN lý do như nhau: không có
 * worker nào đang xử lý PR đó (không có commit mới trong
 * `ANTI_COLLISION_HOURS` giờ) — cùng luật, không phải luật riêng cho ca
 * mới, để hai nguồn (CHARTER và `ops/lanes/priority.md`) không lệch nhau.
 *
 * Khi HAI PR trở lên cùng đủ điều kiện với CÙNG một lý do: thắng theo thứ
 * tự xuất hiện trong `candidates` (không sắp lại theo giờ kẹt hay số PR).
 * Bên gọi truyền mảng theo thứ tự nào thì đó là thứ tự ưu tiên trong nhóm
 * đó — CHARTER chưa nói thêm gì về thứ tự này, nên đây là chỗ để ngỏ có
 * chủ đích, không phải thiếu sót.
 */
export function pickPrToHandle(candidates: readonly TriageCandidate[]): TriagePick | null {
  const eligible = candidates.filter((c) => c.hoursSinceLastCommit >= ANTI_COLLISION_HOURS);

  const byReason = (reason: TriageReason, test: (c: TriageCandidate) => boolean): TriagePick | null => {
    const found = eligible.find(test);
    return found === undefined ? null : { candidate: found, reason, lane: laneFromBranch(found.branch) };
  };

  return (
    byReason('ci-red', (c) => c.ciRed) ??
    byReason('unhandled-comment', (c) => c.hasUnhandledComment) ??
    byReason('red-after-merge', (c) => c.redAfterMergeStreak > 0) ??
    byReason('aborted-ineligible', (c) => c.abortedIneligibleStreak > 0)
  );
}

/**
 * Chuỗi kẹt của một PR ở hàng đợi xung đột — **một** con số cho bản tin
 * (phụ lục P2) gọi, thay vì bắt nó nhớ hai trường.
 *
 * Lấy `max` chứ không lấy tổng: ngưỡng của CHARTER mục 13 là ngưỡng của
 * **một chữ ký lỗi** ("cùng một chữ ký lỗi ba lần"), và hai trường ở đây là
 * hai chữ ký khác nhau. Cộng lại sẽ báo động ở lượt thứ ba của một PR đã
 * đổi chữ ký giữa đường, tức là báo động cho một chữ ký mới chỉ gặp một lần.
 *
 * ⚠️ Chỗ **chưa đo được**, khai ra thay vì giả vờ đã che: một PR đổi qua đổi
 * lại giữa hai cách kẹt (cách A một lượt, cách B lượt sau) thì không chuỗi
 * nào chạm ngưỡng, dù PR đó kẹt liên tục. Đó là hình dạng thứ ba, và chưa
 * lượt nào đo được nó thật — thấy lần đầu thì mở mục backlog, đừng đoán
 * trước ở đây.
 */
export function stuckStreak(candidate: Pick<TriageCandidate, 'abortedIneligibleStreak' | 'redAfterMergeStreak'>): number {
  return Math.max(candidate.abortedIneligibleStreak, candidate.redAfterMergeStreak);
}

/**
 * Quá ngưỡng thì phải nổi lên bản tin (phụ lục P2 bước 2) — không chỉ nằm im
 * trong log. Nhận một con số, nên nó dùng chung cho **cả hai** chữ ký kẹt;
 * bên gọi lấy con số đó từ `stuckStreak`.
 */
export function shouldAlertStreak(streak: number): boolean {
  return streak >= ABORTED_INELIGIBLE_ALERT_THRESHOLD;
}
