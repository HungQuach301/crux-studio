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
 * File này cho phụ lục P1 bước 2 một ca thứ ba, ngang giá với "CI đỏ" và
 * "comment chưa xử lý": PR mà lượt bước 0 gần nhất trả `aborted-ineligible`
 * là việc phải nhận ngay, trước khi duyệt backlog theo `ops/lanes/priority.md`.
 * Cùng điều kiện chống giẫm chân đang dùng cho hai ca kia (không có commit
 * mới trong 2 giờ).
 */

import { LANES, type LaneName } from '@crux/kernel';

/** Ngưỡng "chữ ký lỗi lặp lại" dùng chung với CHARTER mục 13 (ba lần thì báo động). */
export const ABORTED_INELIGIBLE_ALERT_THRESHOLD = 3;

/** Chống giẫm chân: không nhận một PR mà commit mới nhất của nó cách đây dưới ngần này giờ. */
export const ANTI_COLLISION_HOURS = 2;

export type TriageReason = 'ci-red' | 'unhandled-comment' | 'aborted-ineligible';

export interface TriageCandidate {
  number: number;
  branch: string;
  ciRed: boolean;
  hasUnhandledComment: boolean;
  /** Số lượt `aborted-ineligible` LIÊN TIẾP với cùng chữ ký, tính từ bước 0 gần nhất trở về trước. 0 nếu PR không xung đột hoặc integrator vừa giải được. */
  abortedIneligibleStreak: number;
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
 * trong CHARTER (CI đỏ trước, rồi comment chưa xử lý, rồi
 * `aborted-ineligible` — ca mới của `P-022`): một PR vừa CI đỏ vừa xung đột
 * thì lý do CI đỏ thắng, vì đó là ca đã có sẵn từ trước và có tiêu chí xong
 * gắn với nó (nhãn `fix`).
 *
 * Điều kiện chống giẫm chân áp dụng cho CẢ BA lý do như nhau: không có
 * worker nào đang xử lý PR đó (không có commit mới trong
 * `ANTI_COLLISION_HOURS` giờ) — cùng luật, không phải luật riêng cho ca
 * mới, để hai nguồn (CHARTER và `ops/lanes/priority.md`) không lệch nhau.
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
    byReason('aborted-ineligible', (c) => c.abortedIneligibleStreak > 0)
  );
}

/** Quá ngưỡng thì phải nổi lên bản tin (phụ lục P2 bước 2) — không chỉ nằm im trong log. */
export function shouldAlertStreak(streak: number): boolean {
  return streak >= ABORTED_INELIGIBLE_ALERT_THRESHOLD;
}
