/**
 * Bộ đọc **chỉ dẫn mới nhất** của chủ dự án — mục `platform/P-064`, chỉ dẫn 1
 * của `#292` (`2026-09-26T16:20:21Z`), lần gặp thứ 3 của `KF-035`.
 *
 * Chỗ hỏng đo được: bản tin `#292` in khối *"Điều tiết hạn mức — CHƯA có hiệu
 * lực (chỉ dẫn của anh trên #270)"*. Chỉ dẫn `#270` (`2026-09-25T14:21:07Z`)
 * đúng là có nói điều tiết — nhưng `#251` lúc `2026-09-26T00:31:15Z` đã nói
 * *"Hết điều tiết hạn mức, cả ba worker bật"*. Bản tin đọc chỉ dẫn vì nó
 * **tìm thấy** chỉ dẫn đó (trên issue bản tin hôm trước), không vì chỉ dẫn đó
 * **mới nhất**. Chỉ dẫn sống ở **hai** nơi (`#251` và issue `digest`), nên
 * mọi phép đọc chỉ nhìn một nơi, hay nhìn cả hai mà không sắp theo thời gian,
 * đều đọc đúng một chỉ dẫn đã bị thay.
 *
 * Ba luật, mỗi luật một bài kiểm ở `ops/test/owner-directives.test.ts`:
 *
 * 1. **Chỉ dẫn = comment của tài khoản chủ dự án KHÔNG mở đầu 🤖**
 *    (`CLAUDE.md` mục 5). Agent dùng chung danh tính GitHub đó, nên tác giả
 *    một mình không phân biệt được người với máy; comment của bot
 *    (`github-actions[bot]` — *"Bản tin sáng…"*, không mở đầu 🤖) khác tác
 *    giả nên tự rơi ra. Mốc ẩn HTML và dòng trích dẫn bị bỏ trước khi xét 🤖,
 *    cùng lẽ với `isOwnerDoneComment` của `decision-close.ts`.
 * 2. **Sắp theo `createdAt` trên HỢP mọi nguồn**, mới nhất trước. Thứ tự
 *    trong mảng đầu vào và nguồn nào đưa vào trước không mang nghĩa gì.
 * 3. **Không sắp được thì NÉM**, không rơi về comment đầu tiên gặp được:
 *    thiếu `createdAt`, `createdAt` không đọc được, hoặc hai chỉ dẫn cùng một
 *    mốc. Cùng luật `claimCheck` (`CLAUDE.md` mục 1): *"ném" không bao giờ
 *    được đọc thành "không có chỉ dẫn nào"* — hay thành một chỉ dẫn tuỳ ý.
 *
 * Cái hàm này KHÔNG làm: hiểu nội dung chỉ dẫn. "Chỉ dẫn mới nhất" trần là
 * comment gần nhất của anh, về bất cứ chuyện gì; muốn *"chỉ dẫn mới nhất về
 * điều tiết"* thì bên gọi truyền `matching`. Việc hiểu câu chữ vẫn là của
 * lượt chạy — hàm chỉ bảo đảm lượt chạy đọc đúng **bản** cần hiểu.
 *
 * Hàm thuần, không gọi API: bên gọi lấy comment (MCP `issue_read`
 * `get_comments`, hay `gh api`) rồi truyền vào. Hình dạng thô của GitHub
 * (`user.login`, `created_at`, `html_url`) đọc được thẳng qua
 * `normalizeComment`.
 */

import { readFileSync } from 'node:fs';
import { AGENT_PREFIX } from './agent-prefix.ts';

/** Một comment đã chuẩn hoá, kèm số issue nó nằm trên. */
export interface SourcedComment {
  /** Số issue chứa comment — `251`, hay số của issue bản tin. */
  issue: number;
  author: string;
  body: string;
  createdAt: string;
  url?: string;
}

/**
 * Chuẩn hoá một comment từ hình dạng thô của GitHub REST (`user.login`,
 * `created_at`, `html_url`) hoặc hình dạng `gh --json` (`author`,
 * `createdAt`). Trường thiếu để trống — `ownerDirectivesNewestFirst` mới là
 * chỗ ném, để lỗi nói đúng comment nào hỏng.
 */
export function normalizeComment(issue: number, raw: Record<string, unknown>): SourcedComment {
  const user = raw.user as { login?: unknown } | undefined;
  const authorField = raw.author as unknown;
  const author =
    typeof authorField === 'string'
      ? authorField
      : typeof (authorField as { login?: unknown } | undefined)?.login === 'string'
        ? ((authorField as { login: string }).login)
        : typeof user?.login === 'string'
          ? user.login
          : '';
  const createdAt =
    typeof raw.createdAt === 'string' ? raw.createdAt : typeof raw.created_at === 'string' ? raw.created_at : '';
  const url = typeof raw.url === 'string' ? raw.url : typeof raw.html_url === 'string' ? raw.html_url : undefined;
  return { issue, author, body: typeof raw.body === 'string' ? raw.body : '', createdAt, ...(url ? { url } : {}) };
}

/** Thân comment sau khi bỏ mốc ẩn HTML và dòng trích dẫn — phần anh tự viết. */
function ownText(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !/^\s*>/.test(line))
    .join('\n')
    .trim();
}

/** Comment này có phải chỉ dẫn của chủ dự án không (luật 1 ở đầu file)? */
export function isOwnerDirective(comment: Pick<SourcedComment, 'author' | 'body'>, owner: string): boolean {
  if (comment.author.toLowerCase() !== owner.toLowerCase()) return false;
  const text = ownText(comment.body);
  return text.length > 0 && !text.startsWith(AGENT_PREFIX);
}

export interface DirectiveQuery {
  /** Tài khoản chủ dự án — `HungQuach301`. */
  owner: string;
  /** Chỉ tính chỉ dẫn có `createdAt` ≤ mốc này (dựng lại đúng cái một lượt chạy cũ thấy được). */
  asOf?: string;
  /** Chỉ tính chỉ dẫn khớp mẫu này — ví dụ `/điều tiết|tạm dừng/i` cho *"chỉ dẫn mới nhất về điều tiết"*. */
  matching?: RegExp;
}

function parseInstant(comment: SourcedComment, field: string, value: string): number {
  const ms = Date.parse(value);
  if (value.length === 0 || Number.isNaN(ms)) {
    throw new Error(
      `Không sắp được chỉ dẫn theo thời gian: ${field} của comment trên #${comment.issue}` +
        `${comment.url ? ` (${comment.url})` : ''} là ${JSON.stringify(value)}. ` +
        'Ném thay vì đoán — "ném" không bao giờ được đọc thành "không có chỉ dẫn nào" (mục platform/P-064).',
    );
  }
  return ms;
}

/**
 * Mọi chỉ dẫn của chủ dự án trên hợp các nguồn, **mới nhất trước** (luật 2),
 * **ném** khi không sắp được (luật 3).
 */
export function ownerDirectivesNewestFirst(
  comments: readonly SourcedComment[],
  query: DirectiveQuery,
): SourcedComment[] {
  const cutoff = query.asOf === undefined ? Infinity : Date.parse(query.asOf);
  if (Number.isNaN(cutoff)) throw new Error(`asOf không đọc được: ${JSON.stringify(query.asOf)}`);

  const timed = comments
    .filter((comment) => isOwnerDirective(comment, query.owner))
    .map((comment) => ({ comment, ms: parseInstant(comment, 'createdAt', comment.createdAt) }))
    .filter(({ ms }) => ms <= cutoff)
    .filter(({ comment }) => {
      if (query.matching === undefined) return true;
      // Mẫu mang cờ `g`/`y` giữ `lastIndex` giữa hai lần `test` — đặt lại để
      // không comment nào bị bỏ qua vì vị trí của comment trước.
      query.matching.lastIndex = 0;
      return query.matching.test(ownText(comment.body));
    });

  // Cùng một comment đưa vào hai lần (hai lần liệt kê chồng nhau) không phải
  // mâu thuẫn — bỏ bản lặp. Hai comment KHÁC nhau cùng một mốc thì không ai
  // biết cái nào thay cái nào: ném — ở BẤT CỨ vị trí nào của danh sách, không
  // chỉ ở đầu, vì bên gọi dùng cả danh sách (`directives`) chứ không chỉ bản
  // mới nhất. Cố ý nghiêm: tiêu chí của mục khai "ném khi hai comment cùng mốc".
  const unique = new Map<string, { comment: SourcedComment; ms: number }>();
  for (const entry of timed) {
    const key = `${entry.comment.issue}\u0000${entry.ms}\u0000${entry.comment.body}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  const sorted = [...unique.values()].sort((a, b) => b.ms - a.ms);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.ms === sorted[i - 1]!.ms) {
      throw new Error(
        `Không sắp được chỉ dẫn theo thời gian: hai chỉ dẫn khác nhau cùng mốc ${sorted[i]!.comment.createdAt} ` +
          `(#${sorted[i - 1]!.comment.issue} và #${sorted[i]!.comment.issue}). Ném thay vì chọn một (mục platform/P-064).`,
      );
    }
  }
  return sorted.map(({ comment }) => comment);
}

/** Chỉ dẫn mới nhất, hoặc `null` khi thật sự không có chỉ dẫn nào khớp. */
export function latestOwnerDirective(
  comments: readonly SourcedComment[],
  query: DirectiveQuery,
): SourcedComment | null {
  return ownerDirectivesNewestFirst(comments, query)[0] ?? null;
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * `pnpm owner:directives -- <sources.json> [--as-of <ISO>] [--matching <regex>]`
 *
 * `sources.json`: `{"owner": "HungQuach301", "sources": [{"issue": 251, "comments": [...]}, ...]}`,
 * mỗi `comments` là mảng comment thô của GitHub. In JSON `{latest, directives}`,
 * `directives` mới nhất trước. Thoát 1 (và in lỗi) khi không sắp được.
 */
function main(argv: readonly string[]): number {
  const asOf = flagValue(argv, '--as-of');
  const matching = flagValue(argv, '--matching');
  const taken = new Set([asOf, matching].filter((value) => value !== undefined));
  const path = argv.find((arg) => !arg.startsWith('--') && !taken.has(arg));
  if (path === undefined) {
    process.stderr.write('Dùng: pnpm owner:directives -- <sources.json> [--as-of <ISO>] [--matching <regex>]\n');
    return 2;
  }
  const input = JSON.parse(readFileSync(path, 'utf8')) as {
    owner: string;
    sources: { issue: number; comments: Record<string, unknown>[] }[];
  };
  const comments = input.sources.flatMap((source) =>
    source.comments.map((raw) => normalizeComment(source.issue, raw)),
  );
  try {
    const directives = ownerDirectivesNewestFirst(comments, {
      owner: input.owner,
      ...(asOf !== undefined ? { asOf } : {}),
      ...(matching !== undefined ? { matching: new RegExp(matching, 'iu') } : {}),
    });
    process.stdout.write(`${JSON.stringify({ latest: directives[0] ?? null, directives }, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.filename === process.argv[1]) process.exit(main(process.argv.slice(2)));
