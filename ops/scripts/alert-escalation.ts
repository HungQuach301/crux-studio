#!/usr/bin/env node
/**
 * Mục `platform/P-034` — **khi nào một cảnh báo khẩn được @nhắc lại.**
 *
 * Chủ dự án chốt hai vế cùng lúc, kèm câu trả lời `#169`:
 *
 * 1. `@nhắc` nằm ngay trong comment **đầu tiên** của mọi cảnh báo khẩn
 *    (CHARTER 2.4) — không có độ trễ nào nữa;
 * 2. nhắc **lại** mỗi **4 giờ** chừng nào chưa có phản hồi.
 *
 * Số đo của anh: cảnh báo `#131` mở lúc `2026-09-22T10:14Z` và **13 giờ**
 * sau mới @nhắc. Luật cũ của `D-C06` (`main-ci.yml` không @nhắc ở lần đỏ
 * đầu, rồi @nhắc **đúng một lần** sau 2 giờ) là chỗ sinh ra con số đó, nên
 * mục này **thay luật**, không vá lỗi.
 *
 * ## Vì sao là một file TypeScript chứ không phải thêm vài dòng bash
 *
 * Tiêu chí xong của mục đòi một bài kiểm cho đúng hai mốc 3,9 giờ và 4,1
 * giờ. Một phép so ngày tháng nằm trong khối `run:` của workflow chỉ chạy
 * được ở Actions, tức là chỉ kiểm được bằng cách để `main` đỏ thật. Tách
 * phần quyết định ra đây thì `pnpm test` kiểm được nó ở chỗ rẻ nhất, còn
 * bash chỉ còn việc gom dữ liệu và đăng comment.
 *
 * ## Mốc là "đã nhắc LÚC NÀO", không còn là "đã nhắc thì thôi"
 *
 * Luật cũ đọc mốc `<!-- crux-escalate-main-do -->` theo kiểu có/không: thấy
 * mốc là thôi, không nhắc nữa. Luật mới đọc `createdAt` của **comment mang
 * mốc mới nhất**. Đếm số comment thì sai ngay lần đầu ai đó sửa thân
 * comment; đọc mốc của comment mới nhất thì không.
 *
 * Thân **issue** cũng là một "comment" theo nghĩa này, và bên gọi phải
 * truyền nó vào cùng danh sách: từ mục này, lần @nhắc đầu tiên nằm trong
 * thân issue chứ không phải trong một comment. Bỏ nó ra thì mọi lượt sau
 * đều thấy "chưa @nhắc lần nào" và nhắc lại mỗi giờ — đúng cái spam mà vế 2
 * của câu trả lời muốn tránh.
 */

/** Khoảng cách tối thiểu giữa hai lần @nhắc cùng một cảnh báo, theo giờ. */
export const ESCALATE_INTERVAL_HOURS = 4;

/**
 * Một thân issue hoặc một comment, đúng hình dạng `gh issue view --json`
 * trả về. Chỉ hai trường, vì chỉ hai trường được dùng.
 */
export interface AlertComment {
  body: string;
  createdAt: string;
}

export type MentionVerdict = 'mention' | 'quiet';

export interface MentionDecision {
  verdict: MentionVerdict;
  /** `createdAt` của lần @nhắc gần nhất đọc được; `null` khi chưa có lần nào. */
  lastMentionAt: string | null;
  /** Giờ kể từ lần @nhắc gần nhất; `null` khi chưa có lần nào. */
  hoursSinceLastMention: number | null;
  /**
   * Số mục mang mốc nhưng `createdAt` không parse được — **khai ra, không
   * nuốt**. Xem `lastMentionAt`: những mục này bị bỏ qua khi tính mốc, nên
   * một con số khác 0 nghĩa là phép đo ở trên là **cận dưới** của số lần đã
   * @nhắc, và bên gọi phải in nó ra.
   */
  unreadableMarkerComments: number;
}

export interface LastMentionResult {
  at: string | null;
  unreadable: number;
}

/**
 * `createdAt` của mục mang mốc **mới nhất**, cộng số mục mang mốc mà
 * `createdAt` không đọc được.
 *
 * Hướng an toàn khi không đọc được: **bỏ qua mục đó, và khai nó ra** qua
 * `unreadable` — không bao giờ coi nó là một lần @nhắc mới. Hệ quả tuỳ ca,
 * và phải nói đúng cả hai: không còn mục nào đọc được thì kết quả là
 * `mention` (nghiêng về gọi thừa, hướng đúng cho một cảnh báo khẩn); còn
 * một mục đọc được gần đây thì kết quả vẫn là `quiet`, và lúc đó
 * `unreadable` là thứ duy nhất nói cho bên gọi biết phép đo là **cận
 * dưới**. Không có gì biến mất trong im lặng.
 */
export function lastMentionAt(
  comments: readonly AlertComment[],
  marker: string,
): LastMentionResult {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  let unreadable = 0;

  for (const comment of comments) {
    if (!comment.body.includes(marker)) continue;
    const ms = Date.parse(comment.createdAt);
    if (Number.isNaN(ms)) {
      unreadable += 1;
      continue;
    }
    if (ms > newestMs) {
      newestMs = ms;
      newest = comment.createdAt;
    }
  }

  return { at: newest, unreadable };
}

/**
 * Có @nhắc ở lượt này không.
 *
 * - Chưa mục nào mang mốc → `mention`. Đây là vế 1 của câu trả lời: lần đầu
 *   là @nhắc ngay, không còn ngưỡng 2 giờ nào.
 * - Lần @nhắc gần nhất cách đây **≥ 4 giờ** → `mention`.
 * - Còn lại → `quiet`.
 *
 * Mốc `≥` chứ không `>`: đúng 4,0 giờ là đã tới hạn. Tiêu chí xong của mục
 * chốt hai mốc 3,9 (không nhắc) và 4,1 (nhắc); 4,0 nằm giữa và luật phải
 * nói ra chứ không để bên gọi đoán.
 *
 * `now` ném nếu không parse được: khác hẳn một `createdAt` hỏng của một
 * comment lẻ, `now` hỏng làm **mọi** phép so sai, và bên gọi truyền nó vào
 * (`date -u +%FT%TZ`) nên một giá trị lạ là lỗi lập trình, không phải dữ
 * liệu bẩn từ GitHub.
 */
export function decideMention(
  comments: readonly AlertComment[],
  marker: string,
  now: string,
): MentionDecision {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new Error(`\`now\` không parse được: ${JSON.stringify(now)}`);
  }

  const { at, unreadable } = lastMentionAt(comments, marker);
  if (at === null) {
    return {
      verdict: 'mention',
      lastMentionAt: null,
      hoursSinceLastMention: null,
      unreadableMarkerComments: unreadable,
    };
  }

  const hours = (nowMs - Date.parse(at)) / 3_600_000;
  return {
    verdict: hours >= ESCALATE_INTERVAL_HOURS ? 'mention' : 'quiet',
    lastMentionAt: at,
    hoursSinceLastMention: hours,
    unreadableMarkerComments: unreadable,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   gh issue view N --json body,createdAt,comments \
//     --jq '[{body,createdAt}] + [.comments[] | {body,createdAt}]' \
//     | node ops/scripts/alert-escalation.ts '<!-- mốc -->' [now]
//
// In ra `MentionDecision` dạng JSON trên một dòng. Bash đọc `verdict` bằng
// `jq -r .verdict` — không phân tích văn xuôi tiếng Việt ở đâu cả.

const isMain = process.argv[1]?.endsWith('alert-escalation.ts') === true;

if (isMain) {
  const marker = process.argv[2];
  if (marker === undefined || marker === '') {
    process.stderr.write(
      "cách dùng: node ops/scripts/alert-escalation.ts '<!-- mốc -->' [now] < comments.json\n",
    );
    process.exit(2);
  }
  const now = process.argv[3] ?? new Date().toISOString();

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8').trim();

  // Đầu vào rỗng = issue chưa có gì đọc được, KHÔNG phải lỗi: hướng an toàn
  // là coi như chưa @nhắc lần nào, tức là @nhắc. Ném ở đây sẽ làm bước bash
  // đỏ và cảnh báo khẩn mất luôn tiếng gọi — đúng chỗ hỏng mục này chữa.
  const comments: AlertComment[] = raw === '' ? [] : (JSON.parse(raw) as AlertComment[]);
  process.stdout.write(`${JSON.stringify(decideMention(comments, marker, now))}\n`);
}
