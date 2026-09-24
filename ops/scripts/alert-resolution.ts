#!/usr/bin/env node
/**
 * Mục `platform/P-044` — **khi nào một cảnh báo `main` đỏ được đóng lại.**
 *
 * CHARTER 2.4 viết "nhắc lại mỗi 4 giờ tới khi `main` **xanh lại**". Vế
 * "xanh lại" trước mục này không có ai thực thi: không workflow nào trong
 * repo đóng một issue nhãn `alert`. Đo được `2026-09-24T09:38Z` — `#131`
 * (mở `2026-09-22T10:14Z`) còn mở trong khi `main-ci` xanh ba lượt liên
 * tiếp từ `04:41Z` cùng ngày.
 *
 * ## Vì sao một issue thừa lại là một cảnh báo khẩn bị nuốt
 *
 * `main-ci.yml` **dùng lại** issue cảnh báo: nó lấy issue `alert` đang mở
 * đầu tiên khớp `main đỏ in:title`, **không** so `sha`. Và `decideMention`
 * (`alert-escalation.ts`, mục `P-034`) đọc `createdAt` của mục mang mốc
 * **mới nhất** trên cả thân lẫn comment. Hai thứ đó cộng lại:
 *
 *     sự cố A đỏ 10:00 → @nhắc 10:00 → sửa xong, `main` xanh 10:30
 *     sự cố B đỏ 11:00 (commit KHÁC) → rơi vào đúng issue của A
 *       → mốc mới nhất là 10:00, mới 1 giờ → `quiet`
 *
 * `main` đỏ, chủ dự án không được gọi cho tới 14:00, và `pnpm check` xanh,
 * CI xanh, `watchdog` xanh suốt khoảng đó. Nhóm **Z** của
 * `ops/known-failures.md`. Đóng cảnh báo khi `main` xanh lại làm sự cố B
 * có issue MỚI, chưa mốc nào → `decideMention` ra `mention` ngay, đúng
 * luật 1 của CHARTER 2.4.
 *
 * ## Vì sao phần quyết định nằm ở TypeScript, không ở khối `run:`
 *
 * Cùng lý do `P-034` đã chốt: một phép so nằm trong bash chỉ kiểm được
 * bằng cách để `main` đỏ thật. Ở đây `pnpm test` dựng được đúng cảnh trên
 * mà không cần chờ một sự cố.
 *
 * ## Phạm vi: CHỈ cảnh báo `main` đỏ
 *
 * CHARTER 2.4 có bốn loại cảnh báo khẩn, và ba loại còn lại (watchdog im
 * lặng, chi phí vượt 80%, sự cố bảo mật) có điều kiện kết thúc khác hẳn —
 * `main-ci.yml` không đo được điều kiện của chúng. `decideClosure` vì vậy
 * trả `keep` cho mọi tiêu đề không khớp `main đỏ`, và đó là một luật chứ
 * không phải một thiếu sót.
 */

import { parseScope } from '../invariants.hotfix-lane.ts';

/**
 * Chuỗi mà tiêu đề cảnh báo `main` đỏ phải chứa. Cùng một chuỗi mà
 * `main-ci.yml` dựng tiêu đề (`[CẢNH BÁO] main đỏ tại <sha ngắn>`) và cùng
 * chuỗi nó tìm lại bằng `--search "main đỏ in:title"` — một chỗ giữ nó để
 * bên mở và bên đóng không bao giờ lệch nhau.
 */
export const MAIN_RED_TITLE_MARKER = 'main đỏ';

/** `[CẢNH BÁO] main đỏ tại a44d265` → `a44d265`. Bảy ký tự hex trở lên. */
const TITLE_SHA = /\bmain đỏ tại\s+([0-9a-f]{7,40})\b/;

export type ShaSource = 'scope-block' | 'title';

export interface IncidentSha {
  sha: string;
  source: ShaSource;
}

/**
 * `sha` của sự cố **mới nhất** ghi trên một cảnh báo, hoặc `null` nếu
 * không đọc được từ nguồn nào.
 *
 * Hai nguồn, theo đúng thứ tự này:
 *
 * 1. **Khối `<!-- crux-hotfix-scope -->`** (`D-C07`). `parseScope` lấy mốc
 *    CUỐI CÙNG, nên trên một issue đã bị dùng lại nó cho `sha` của sự cố
 *    mới nhất — đúng thứ cần. Đây là nguồn máy đọc, nên nó đi trước.
 * 2. **Tiêu đề** `[CẢNH BÁO] main đỏ tại <sha>`. Lưới dự phòng cho các
 *    cảnh báo mở TRƯỚC `D-C07` — `#131` là một, thân nó không có khối nào.
 *    Tiêu đề mang `sha` của sự cố ĐẦU TIÊN, không phải sự cố mới nhất; điều
 *    đó không hại ở đây vì bên gọi chỉ hỏi khi `main` đã xanh (xem
 *    `decideClosure`), và lúc đó mọi sự cố trên issue đều đã qua.
 *
 * ⚠️ **Bên gọi phải lọc tác giả TRƯỚC khi truyền `botText` vào** (bất biến
 * **I7**, `CLAUDE.md` mục 5) — cùng luật mà `parseScope` đã khai. Agent
 * comment được lên issue cảnh báo bằng danh tính chủ dự án, nên một comment
 * chứa khối `crux-hotfix-scope` sẽ tự chọn `sha` cho phép đóng. Chỉ nối
 * thân issue và comment của `github-actions[bot]`.
 */
export function incidentSha(title: string, botText: string): IncidentSha | null {
  const scope = parseScope(botText);
  if (scope !== null && /^[0-9a-f]{7,40}$/.test(scope.sha)) {
    return { sha: scope.sha, source: 'scope-block' };
  }

  const fromTitle = TITLE_SHA.exec(title);
  if (fromTitle !== null) return { sha: fromTitle[1]!, source: 'title' };

  return null;
}

/**
 * `main` xanh rồi, nhưng `sha` của sự cố có nằm trong lịch sử của commit
 * xanh đó không. Bash trả lời bằng `git merge-base --is-ancestor`; ba giá
 * trị vì "không biết" là một câu trả lời khác hẳn "không phải".
 */
export type Ancestry = 'ancestor' | 'not-ancestor' | 'unknown';

export type ClosureVerdict = 'close' | 'keep';

export interface ClosureDecision {
  verdict: ClosureVerdict;
  /** Vì sao, một câu, in ra được trong log của workflow. Cấm im lặng (rà soát Z2). */
  reason: string;
}

export interface ClosureInput {
  /** Tiêu đề issue cảnh báo, nguyên văn. */
  title: string;
  /** `sha` sự cố đọc được, hoặc `null`. Xem `incidentSha`. */
  incident: IncidentSha | null;
  /** `sha` sự cố có phải tổ tiên của commit xanh không. */
  ancestry: Ancestry;
}

/**
 * Đóng hay giữ một cảnh báo, khi `pnpm check` vừa XANH trên `main`.
 *
 * Bên gọi **chỉ** được hỏi hàm này sau một lượt `check` xanh — cả bốn luật
 * dưới đây đều dựa vào điều đó, và `main-ci.yml` bảo đảm nó bằng
 * `if: success()`.
 *
 * **Hướng an toàn là `keep`.** Hai chiều hỏng ở đây KHÔNG cân nhau, nên
 * chúng không được xử như nhau:
 *
 * - Giữ nhầm một cảnh báo đã xong: lặp lại đúng chỗ hỏng mục này chữa, và
 *   nó **chỉ** cắn khi có một sự cố mới trong vòng 4 giờ. Tốn một nhịp.
 * - Đóng nhầm một cảnh báo chưa xong: cảnh báo khẩn biến mất khỏi danh
 *   sách `--state open`, và lần đỏ sau mở issue mới nên **không ai thấy**
 *   nó đã bị đóng oan. Mất tiếng gọi, im lặng, không gì đỏ.
 *
 * Nên mọi ca không chắc đều ra `keep`, kèm một câu nói rõ vì sao.
 */
export function decideClosure(input: ClosureInput): ClosureDecision {
  if (!input.title.includes(MAIN_RED_TITLE_MARKER)) {
    return {
      verdict: 'keep',
      reason: `Tiêu đề không chứa \`${MAIN_RED_TITLE_MARKER}\` — một trong ba loại cảnh báo khẩn khác của CHARTER 2.4, điều kiện kết thúc không đo được ở đây.`,
    };
  }

  if (input.incident === null) {
    return {
      verdict: 'keep',
      reason:
        'Không đọc được `sha` sự cố từ khối `crux-hotfix-scope` lẫn từ tiêu đề — không có gì để đối chiếu với commit xanh, nên giữ lại.',
    };
  }

  if (input.ancestry === 'unknown') {
    return {
      verdict: 'keep',
      reason: `Không xác định được \`${input.incident.sha}\` có nằm trong lịch sử commit xanh không (object thiếu, hoặc \`git\` lỗi) — giữ lại.`,
    };
  }

  if (input.ancestry === 'not-ancestor') {
    return {
      verdict: 'keep',
      reason: `\`${input.incident.sha}\` KHÔNG nằm trong lịch sử của commit xanh — lượt xanh này không nói gì về sự cố đó, nên giữ lại.`,
    };
  }

  return {
    verdict: 'close',
    reason: `\`main\` xanh lại, và \`${input.incident.sha}\` (nguồn: ${input.incident.source}) nằm trong lịch sử commit xanh — CHARTER 2.4 "nhắc lại mỗi 4 giờ tới khi \`main\` xanh lại".`,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// Hai chế độ, vì giữa chúng bash phải hỏi `git` một câu:
//
//   sha:     node ops/scripts/alert-resolution.ts sha '<tiêu đề>' < bot-text.txt
//            → {"sha":"…","source":"…"} hoặc {"sha":null}
//   verdict: node ops/scripts/alert-resolution.ts verdict '<tiêu đề>' <sha|''> <source|''> <ancestry>
//            → {"verdict":"close|keep","reason":"…"}
//
// Bash đọc bằng `jq -r .verdict` — không phân tích văn xuôi tiếng Việt ở
// đâu cả.

const isMain = process.argv[1]?.endsWith('alert-resolution.ts') === true;

if (isMain) {
  const mode = process.argv[2];
  const title = process.argv[3] ?? '';

  if (mode === 'sha') {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const botText = Buffer.concat(chunks).toString('utf8');
    const found = incidentSha(title, botText);
    process.stdout.write(`${JSON.stringify(found ?? { sha: null })}\n`);
  } else if (mode === 'verdict') {
    const sha = process.argv[4] ?? '';
    const source = process.argv[5] ?? '';
    const ancestry = process.argv[6] ?? '';
    // Một `ancestry` lạ KHÔNG được coi là `ancestor`: hướng an toàn là
    // `unknown`, và `decideClosure` biến nó thành `keep`.
    const normalized: Ancestry =
      ancestry === 'ancestor' || ancestry === 'not-ancestor' ? ancestry : 'unknown';
    const incident: IncidentSha | null =
      sha === '' ? null : { sha, source: source === 'title' ? 'title' : 'scope-block' };
    process.stdout.write(`${JSON.stringify(decideClosure({ title, incident, ancestry: normalized }))}\n`);
  } else {
    process.stderr.write(
      "cách dùng: node ops/scripts/alert-resolution.ts sha '<tiêu đề>' < bot-text.txt\n" +
        "           node ops/scripts/alert-resolution.ts verdict '<tiêu đề>' <sha> <source> <ancestry>\n",
    );
    process.exit(2);
  }
}
