#!/usr/bin/env node
/**
 * BẤT BIẾN I4 — điểm quyết định DUY NHẤT của việc tự merge (D-C06).
 *
 * `ops/invariants.protected-area.ts` trả lời "PR này thuộc cửa nào".
 * File này trả lời "có merge bây giờ không", cho cả ba cửa:
 *
 * | Cửa | Nhãn cần có | Khoảng chờ |
 * |---|---|---|
 * | `owner-merge` | — | máy KHÔNG BAO GIỜ merge |
 * | `automerge-delayed` | `automerge-delayed` | 12 giờ kể từ lúc CI xanh |
 * | `open` | `automerge` | không chờ |
 *
 * **Vì sao lấy CỬA chứ không lấy NHÃN làm gốc (rà soát Z8):** nhãn do
 * `ci.yml` gắn, mà `ci.yml` chạy theo định nghĩa trong NHÁNH PR. Một PR sửa
 * `ci.yml` để thôi gắn `owner-merge` sẽ không bị nhãn nào chặn. Cửa thì
 * được `automerge.yml` tính lại theo bản `ops/invariants.protected-area.ts`
 * trên `main`, và `automerge.yml` chạy bằng `workflow_run` nên cũng theo
 * bản trên `main`. Nhãn là để người đọc; cửa là thứ máy tin.
 *
 * **Đồng hồ chờ bắt đầu từ lúc CI XANH TRÊN ĐÚNG COMMIT ĐẦU NHÁNH**, không
 * phải từ lúc mở PR. Một lần push mới vì thế đặt lại đồng hồ: khoảng chờ
 * luôn áp lên đúng nội dung sắp vào `main`.
 *
 * File này nằm dưới `ops/invariants.*` nên chính nó là `owner-merge`.
 */

import { readFileSync } from 'node:fs';
import type { Gate } from './invariants.protected-area.ts';

export interface Comment {
  author: string;
  body: string;
  createdAt: string;
}

export interface MergeInput {
  /** Cửa do `invariants.protected-area.ts` (bản trên `main`) tính ra. */
  gate: Gate;
  labels: readonly string[];
  draft: boolean;
  /** `mergeable` của GitHub: `null` nghĩa là GitHub chưa tính xong (KF-002, mục P-007). */
  mergeable: boolean | null;
  mergeableState: string | null;
  headSha: string;
  /** Commit mà lần chạy `ci` gần nhất đã chạy trên. */
  ciSha: string | null;
  ciConclusion: string | null;
  /** Thời điểm lần chạy `ci` đó kết thúc, ISO 8601. */
  ciCompletedAt: string | null;
  comments: readonly Comment[];
  owner: string;
  now: string;
  delayHours: number;
}

export type Outcome = 'merge' | 'skip' | 'wait' | 'recheck';

export interface Decision {
  outcome: Outcome;
  reason: string;
  /** Số giờ còn phải chờ, làm tròn lên. Chỉ có ở `wait`. */
  hoursLeft?: number;
}

/** Khoảng chờ của cửa `automerge-delayed` (D-C06 điểm 2). */
export const DEFAULT_DELAY_HOURS = 12;

/** Nhãn mà mỗi cửa đòi phải có trước khi máy được phép merge. */
export const LABEL_FOR_GATE: Readonly<Record<Gate, string | null>> = {
  'owner-merge': null,
  'automerge-delayed': 'automerge-delayed',
  open: 'automerge',
};

/**
 * Một comment có phải lời `dừng` của chủ dự án không?
 *
 * Agent dùng chính danh tính GitHub của chủ dự án (CHARTER 3.1), nên tác
 * giả một mình không phân biệt được người với máy. Quy ước 🤖 là dấu vết
 * duy nhất: comment của agent LUÔN bắt đầu bằng 🤖, nên comment cùng tác
 * giả mà KHÔNG có 🤖 là của người.
 */
export function isStopComment(comment: Comment, owner: string): boolean {
  if (comment.author.toLowerCase() !== owner.toLowerCase()) return false;
  const body = comment.body.trim();
  if (body.startsWith('🤖')) return false;
  return /dừng/i.test(body);
}

export function decideMerge(input: MergeInput): Decision {
  const labels = input.labels.map((label) => label.toLowerCase());

  if (input.gate === 'owner-merge') {
    return {
      outcome: 'skip',
      reason: 'PR chạm vùng chỉ chủ dự án merge — máy không bao giờ merge (bất biến I4).',
    };
  }
  if (labels.includes('owner-merge')) {
    return { outcome: 'skip', reason: 'PR mang nhãn `owner-merge` — chỉ chủ dự án merge (bất biến I4).' };
  }

  const needed = LABEL_FOR_GATE[input.gate];
  if (needed === null || !labels.includes(needed)) {
    return { outcome: 'skip', reason: `Cửa \`${input.gate}\` đòi nhãn \`${needed ?? '—'}\`, PR không có.` };
  }

  if (input.draft) {
    return { outcome: 'skip', reason: 'PR còn ở trạng thái nháp.' };
  }
  if (input.ciConclusion !== 'success') {
    return { outcome: 'skip', reason: `CI chưa xanh (\`${input.ciConclusion ?? 'chưa có lần chạy nào'}\`).` };
  }
  if (input.ciSha !== input.headSha) {
    return {
      outcome: 'skip',
      reason: `CI xanh trên \`${(input.ciSha ?? '').slice(0, 7)}\` chứ không phải đầu nhánh \`${input.headSha.slice(0, 7)}\`. Chờ lần CI kế tiếp.`,
    };
  }
  // KF-002: một PR xung đột với `main` không được thử merge. Thử rồi để API
  // báo lỗi thì job đỏ, và một job đỏ vì lý do đó trông giống hệt một job đỏ
  // vì lỗi thật.
  if (input.mergeable === null) {
    return { outcome: 'recheck', reason: 'GitHub chưa tính xong `mergeable`. Hỏi lại, không coi `null` là merge được.' };
  }
  if (input.mergeable === false || input.mergeableState === 'dirty') {
    return { outcome: 'skip', reason: 'PR đang xung đột với `main`. Integrator gộp trước (CHARTER phụ lục P3 bước 0).' };
  }

  // Lời `dừng` chặn CẢ hai cửa, không riêng cửa có chờ. Chủ dự án nói dừng
  // thì máy dừng, kể cả với một PR thường.
  const stop = input.comments.find((comment) => isStopComment(comment, input.owner));
  if (stop !== undefined) {
    return { outcome: 'skip', reason: `Chủ dự án đã nói \`dừng\` lúc ${stop.createdAt}.` };
  }

  if (input.gate === 'open') {
    return { outcome: 'merge', reason: 'PR không chạm vùng bảo vệ, CI xanh trên đầu nhánh.' };
  }

  if (input.ciCompletedAt === null) {
    return { outcome: 'skip', reason: 'Không biết CI xanh lúc nào, nên không tính được khoảng chờ.' };
  }
  const green = Date.parse(input.ciCompletedAt);
  const now = Date.parse(input.now);
  if (Number.isNaN(green) || Number.isNaN(now)) {
    return { outcome: 'skip', reason: 'Mốc thời gian không đọc được.' };
  }
  const elapsedHours = (now - green) / 3_600_000;
  if (elapsedHours < input.delayHours) {
    return {
      outcome: 'wait',
      reason: `CI xanh được ${elapsedHours.toFixed(1)} giờ, ngưỡng ${input.delayHours} giờ.`,
      hoursLeft: Math.ceil(input.delayHours - elapsedHours),
    };
  }

  return {
    outcome: 'merge',
    reason: `CI xanh trên đầu nhánh được ${elapsedHours.toFixed(1)} giờ (≥ ${input.delayHours}), không có lời \`dừng\` nào.`,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/invariants.merge-gate.ts <file JSON>
//
// File JSON đúng hình dạng `MergeInput`. In ra JSON `{outcome, reason}`.
// Mã thoát luôn là 0: "chưa tới lúc merge" không phải lỗi.

const isMain = process.argv[1]?.endsWith('invariants.merge-gate.ts') === true;

if (isMain) {
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write('Thiếu đường dẫn file JSON mô tả PR.\n');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<MergeInput>;
  const decision = decideMerge({
    gate: raw.gate ?? 'owner-merge',
    labels: raw.labels ?? [],
    draft: raw.draft ?? false,
    mergeable: raw.mergeable ?? null,
    mergeableState: raw.mergeableState ?? null,
    headSha: raw.headSha ?? '',
    ciSha: raw.ciSha ?? null,
    ciConclusion: raw.ciConclusion ?? null,
    ciCompletedAt: raw.ciCompletedAt ?? null,
    comments: raw.comments ?? [],
    owner: raw.owner ?? '',
    now: raw.now ?? new Date().toISOString(),
    delayHours: raw.delayHours ?? DEFAULT_DELAY_HOURS,
  });
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}
