/**
 * Mục `platform/P-046` — khối **"Sẵn sàng duyệt"** ở cuối bản tin, và bộ đọc
 * câu trả lời `Duyệt` của chủ dự án.
 *
 * ## Chỉ dẫn gốc
 *
 * Issue bản tin `#193`, comment `2026-09-23T14:18:09Z`, khối
 * **TỰ ĐỘNG HOÁ VÒNG DUYỆT BUỔI TỐI** mục (1), mở đầu bằng *"Làm ngay"*:
 *
 * > cuối bản tin có bản nháp comment tổng hợp mọi khuyến nghị. Tôi trả lời
 * > "Duyệt" = chấp nhận toàn bộ khuyến nghị; "Duyệt, trừ #N B" = chấp nhận trừ
 * > mục nêu. Mục reversible đã tự làm chỉ liệt kê, không hỏi lại. Mục
 * > irreversible vẫn liệt kê riêng, ghi rõ hệ quả nếu tôi không trả lời.
 *
 * ## Vì sao nửa ĐỌC mới là phần chịu tải
 *
 * `Duyệt` là hình dạng câu trả lời **thứ ba**, sau `#19 A, #14 B` và
 * `hoàn tác #N` (`CLAUDE.md` mục 5 và mục 14). Trước mục này, cả ba hình dạng
 * **không có bộ đọc bằng máy nào** — `grep` trên `ops/scripts/` chỉ thấy chúng
 * trong văn xuôi. Agent đọc bằng mắt ở mỗi lượt.
 *
 * Bản tin là **hộp quyết định duy nhất** (CHARTER 2.5), nên một câu trả lời bị
 * đọc sót ở đây chặn một nhánh việc mà không chỉ báo nào đỏ — đúng nhóm **Z**
 * của `ops/known-failures.md`. Ba cách đọc sai dưới đây mỗi cách có một bài
 * kiểm, và mọi chỗ không chắc đều ngả về **ồn**, không ngả về im:
 *
 * 1. `Duyệt` không chốt hộ một mục mà chính bản tin đó không liệt kê.
 * 2. `Duyệt, trừ #N` (không nêu phương án) **không** rơi về khuyến nghị của
 *    `#N` — chữ "trừ" nói ngược lại. Mục đó ra `unresolved`.
 * 3. Comment mở đầu bằng 🤖 **không bao giờ** là câu trả lời, kể cả khi nó
 *    chứa chữ `Duyệt` — agent dùng danh tính chủ dự án, nên tiền tố là dấu vết
 *    duy nhất phân biệt (`CLAUDE.md` mục 5, bất biến **I7**).
 *
 * ## Vì sao tách khỏi `ops/scripts/digest-metrics.ts`
 *
 * CHARTER mục 4 (luật mềm): hai việc cùng sửa một file. `digest-metrics.ts`
 * đang bị `#223` và `#112` sửa lúc mục này nhận việc, nên thêm một PR nữa vào
 * đó là thêm một xung đột biết trước. Bản tin gọi `pnpm digest:approval` như
 * một lệnh riêng.
 */

import { readFileSync } from 'node:fs';
import { stripAgentPrefix } from './agent-prefix.ts';

/** Chữ duyệt toàn bộ. So khớp không phân biệt hoa thường, nhưng **có** dấu. */
export const APPROVE_WORD = 'duyệt';

/** Chữ mở mệnh đề loại trừ trong `Duyệt, trừ #N B`. */
export const EXCEPT_WORD = 'trừ';

/** Chữ phủ quyết một `reversible` đã tự làm (`CLAUDE.md` mục 14). */
export const VETO_WORD = 'hoàn tác';

export type ApprovalKind = 'irreversible' | 'reversible' | 'chưa phân loại';

/**
 * Một mục trong khối "Sẵn sàng duyệt".
 *
 * `kind` giữ đúng ba giá trị của `classifyDecision` (`digest-metrics.ts`) để
 * hai bên không lệch nhau; mục này **không** import từ đó, xem ghi chú đầu file.
 */
export interface ApprovalItem {
  /** Số issue `[QĐ]`. */
  number: number;
  title: string;
  kind: ApprovalKind;
  /** Mã phương án được khuyến nghị, ví dụ `A`. `null` khi thân issue không nói. */
  recommendation: string | null;
  /** Các mã phương án có thật trong thân issue, ví dụ `['A','B','C']`. */
  options: readonly string[];
  /** Hệ quả nếu chủ dự án không trả lời — bắt buộc với `irreversible`. */
  ifNoAnswer: string | null;
}

/**
 * Mục nào cần một câu trả lời. Giống `needOwnerCount`: `reversible` đã làm
 * theo khuyến nghị rồi (`D-C06`), chỉ liệt kê, không hỏi lại.
 */
export function needsAnswer(item: Pick<ApprovalItem, 'kind'>): boolean {
  return item.kind !== 'reversible';
}

// --- Nửa ĐỌC thân issue [QĐ] ---

/**
 * Lấy `options`, `recommendation` và `ifNoAnswer` ra khỏi thân một issue
 * `[QĐ]`. Hình dạng năm phần do `CLAUDE.md` mục 14 chốt:
 *
 * > Bối cảnh (≤5 dòng) · Phương án A/B(/C) kèm hệ quả · Khuyến nghị · Nếu anh
 * > chưa trả lời thì điều gì xảy ra · Cách trả lời
 *
 * Không đoán khi thiếu: mỗi trường không đọc được trả `null` / mảng rỗng, và
 * `renderApprovalDraft` in ra chỗ thiếu thay vì bỏ qua. Một bản nháp im lặng
 * bỏ sót một phương án là đúng thứ nhóm **Z** mà mục này sinh ra để chặn.
 */
export function parseDecisionBody(body: string): Pick<ApprovalItem, 'recommendation' | 'options' | 'ifNoAnswer'> {
  return {
    options: parseOptions(body),
    recommendation: parseRecommendation(body),
    ifNoAnswer: parseIfNoAnswer(body),
  };
}

/**
 * Các phương án, đọc từ gạch đầu dòng dạng `- **A — …**` trong phần
 * "Phương án". Neo vào **gạch đầu dòng**, không vào mọi chữ cái đứng một mình:
 * một chữ `A` giữa câu văn không phải một phương án.
 */
function parseOptions(body: string): string[] {
  const seen: string[] = [];
  for (const line of body.split('\n')) {
    const match = /^\s*[-*]\s*\*{0,2}([A-Z])\s*(?:—|-|–|:|\*)/.exec(line);
    if (match && !seen.includes(match[1]!)) seen.push(match[1]!);
  }
  return seen;
}

/** `**Khuyến nghị: A.**` — lấy đúng một chữ cái đứng sau dấu hai chấm. */
function parseRecommendation(body: string): string | null {
  const match = /Khuyến nghị\s*\*{0,2}\s*:\s*\*{0,2}\s*([A-Z])(?![\p{L}\p{N}])/u.exec(body);
  return match ? match[1]! : null;
}

/**
 * Đoạn văn đầu tiên dưới tiêu đề "Nếu anh chưa trả lời", gộp về **một dòng**
 * — khối "Sẵn sàng duyệt" phải đọc được trong ~60 giây trên màn hình điện
 * thoại (rủi ro B11, `CLAUDE.md` mục 9).
 */
function parseIfNoAnswer(body: string): string | null {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^\s*\*{0,2}Nếu anh chưa trả lời/.test(line));
  if (start === -1) return null;
  const paragraph: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*\*{0,2}Cách trả lời/.test(line)) break;
    if (line.trim() === '') {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

// --- Nửa VIẾT: khối "Sẵn sàng duyệt" ---

export const DRAFT_HEADING = 'Sẵn sàng duyệt';

/**
 * Dựng khối cuối bản tin. Ba luật đến thẳng từ chỉ dẫn gốc:
 *
 * - `irreversible` (và `chưa phân loại`, vì chưa phân loại thì chưa được coi
 *   là `reversible`) **liệt kê riêng**, mỗi mục kèm hệ quả nếu không trả lời.
 * - `reversible` đã tự làm **chỉ liệt kê**, không hỏi lại — kèm lối phủ quyết.
 * - Khối nói rõ ba hình dạng trả lời, để chủ dự án không phải nhớ.
 */
export function renderApprovalDraft(items: readonly ApprovalItem[]): string {
  const needing = items.filter(needsAnswer);
  const done = items.filter((item) => !needsAnswer(item));
  const out: string[] = [DRAFT_HEADING, ''];

  if (needing.length === 0) {
    out.push('Không có việc nào cần anh quyết. Không phải trả lời gì.');
  } else {
    out.push(`Cần anh quyết: ${needing.length} việc. Trả lời **một** trong ba dạng:`);
    out.push('- `Duyệt` — chấp nhận toàn bộ khuyến nghị dưới đây.');
    out.push('- `Duyệt, trừ #N B` — chấp nhận tất cả, riêng `#N` lấy phương án `B`.');
    out.push('- `#19 A, #14 B` — chốt từng mục.');
    out.push('');
    for (const item of needing) out.push(renderNeedingLine(item));
  }

  if (done.length > 0) {
    out.push('', `Đã tự làm, chỉ liệt kê — ${done.length} việc \`reversible\` (\`D-C06\`):`);
    for (const item of done) {
      out.push(`- #${item.number} · ${stripAgentPrefix(item.title)} · phủ quyết bằng \`${VETO_WORD} #${item.number}\` trong 24 giờ`);
    }
  }

  out.push('', 'Trả lời tất cả trong MỘT comment ngay dưới đây.');
  return `${out.join('\n')}\n`;
}

function renderNeedingLine(item: ApprovalItem): string {
  const parts = [`- #${item.number} · ${stripAgentPrefix(item.title)}`];
  parts.push(
    item.recommendation === null
      ? '**THIẾU KHUYẾN NGHỊ** — thân issue không có dòng `Khuyến nghị: X`'
      : `khuyến nghị **${item.recommendation}**${item.options.length > 0 ? ` (có: ${item.options.join('/')})` : ''}`,
  );
  parts.push(
    item.ifNoAnswer === null
      ? '**THIẾU** phần "Nếu anh chưa trả lời"'
      : `chưa trả lời thì: ${item.ifNoAnswer}`,
  );
  return parts.join(' · ');
}

// --- Nửa ĐỌC câu trả lời ---

export type ApprovalMode =
  /** Comment mở đầu bằng 🤖 — của agent, không phải câu trả lời (`CLAUDE.md` mục 5). */
  | 'not-an-answer'
  /** Có chữ `Duyệt`. */
  | 'approve-all'
  /** Không có chữ `Duyệt`, nhưng có ít nhất một `#N X` hoặc `hoàn tác #N`. */
  | 'per-item'
  /** Của chủ dự án, nhưng không mang tín hiệu nào đọc được. */
  | 'unrecognized';

export interface ApprovalChoice {
  number: number;
  option: string;
}

export interface ApprovalProblem {
  number: number;
  reason: string;
}

export interface ApprovalReply {
  mode: ApprovalMode;
  /** Mục đã chốt được phương án. */
  choices: ApprovalChoice[];
  /** `hoàn tác #N` — phủ quyết một `reversible` đã tự làm. */
  vetoes: number[];
  /** Mục cần trả lời mà câu trả lời này KHÔNG chốt. Phải ồn, không được im. */
  unresolved: number[];
  /** Tham chiếu hỏng: mục không có trong bản tin, phương án không tồn tại, v.v. */
  problems: ApprovalProblem[];
}

/**
 * Đọc một comment của chủ dự án trên issue bản tin thành tập quyết định.
 *
 * `items` là **chính** các mục mà bản tin đó liệt kê. Mọi `#N` ngoài tập này
 * vào `problems`, không vào `choices` — luật 1 ở đầu file.
 */
export function parseApprovalReply(body: string, items: readonly ApprovalItem[]): ApprovalReply {
  const empty: ApprovalReply = { mode: 'not-an-answer', choices: [], vetoes: [], unresolved: [], problems: [] };
  if (body.trimStart().startsWith('🤖')) return empty;

  const { vetoes, rest } = takeVetoes(body);
  const approving = hasWord(rest, APPROVE_WORD);
  const { overrides, problems } = approving ? parseExceptClause(rest) : parsePairs(rest);

  const reply: ApprovalReply = {
    mode: approving ? 'approve-all' : overrides.length > 0 || vetoes.length > 0 ? 'per-item' : 'unrecognized',
    choices: [],
    vetoes,
    unresolved: [],
    problems: [...problems],
  };

  const byNumber = new Map(items.map((item) => [item.number, item]));
  const decided = new Set<number>();

  for (const pair of overrides) {
    const item = byNumber.get(pair.number);
    if (item === undefined) {
      reply.problems.push({ number: pair.number, reason: 'không có trong bản tin này' });
      continue;
    }
    decided.add(pair.number);
    if (pair.option === null) {
      // Luật 2: `trừ #N` trần KHÔNG rơi về khuyến nghị — "trừ" nói ngược lại.
      reply.problems.push({ number: pair.number, reason: 'nêu mục nhưng không nêu phương án' });
      continue;
    }
    if (item.options.length > 0 && !item.options.includes(pair.option)) {
      reply.problems.push({ number: pair.number, reason: `phương án \`${pair.option}\` không có trong issue` });
      continue;
    }
    reply.choices.push({ number: pair.number, option: pair.option });
  }

  if (approving) {
    for (const item of items) {
      if (!needsAnswer(item) || decided.has(item.number)) continue;
      if (item.recommendation === null) {
        reply.problems.push({ number: item.number, reason: '`Duyệt` nhưng issue không có khuyến nghị nào để nhận' });
        continue;
      }
      reply.choices.push({ number: item.number, option: item.recommendation });
    }
  }

  const chosen = new Set(reply.choices.map((choice) => choice.number));
  reply.unresolved = items.filter((item) => needsAnswer(item) && !chosen.has(item.number)).map((item) => item.number);

  for (const number of vetoes) {
    if (!byNumber.has(number)) reply.problems.push({ number, reason: `\`${VETO_WORD}\` cho mục không có trong bản tin này` });
  }
  return reply;
}

/**
 * Cắt mọi `hoàn tác #N` ra **trước**, và trả về phần còn lại đã bỏ chúng đi:
 * nếu không, `#N` trong một câu phủ quyết lại bị đọc thành một lựa chọn.
 */
function takeVetoes(body: string): { vetoes: number[]; rest: string } {
  const vetoes: number[] = [];
  const rest = body.replace(/hoàn\s*tác\s*#(\d+)/giu, (_match, digits: string) => {
    const number = Number(digits);
    if (!vetoes.includes(number)) vetoes.push(number);
    return ' ';
  });
  return { vetoes, rest };
}

/** Chữ đứng riêng, không phân biệt hoa thường, không khớp khi nằm trong từ khác. */
function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

interface RawPair {
  number: number;
  /** `null` khi `#N` không đi kèm mã phương án nào. */
  option: string | null;
}

/**
 * Trong `Duyệt, trừ #N B`, chỉ phần **sau** chữ `trừ` mới là ngoại lệ. Không có
 * chữ `trừ` mà vẫn có `#N` sau chữ `Duyệt` là một câu mập mờ, nên nó vào
 * `problems` chứ không được đoán theo hướng nào.
 */
function parseExceptClause(text: string): { overrides: RawPair[]; problems: ApprovalProblem[] } {
  const marker = new RegExp(`(?<![\\p{L}\\p{N}])${EXCEPT_WORD}(?![\\p{L}\\p{N}])`, 'iu').exec(text);
  if (marker === null) {
    const stray = parsePairs(text);
    return {
      overrides: [],
      problems: stray.overrides.map((pair) => ({
        number: pair.number,
        reason: `nêu sau chữ \`${APPROVE_WORD}\` mà không có chữ \`${EXCEPT_WORD}\` — không đoán`,
      })),
    };
  }
  return parsePairs(text.slice(marker.index + marker[0]!.length));
}

/**
 * `#14 B` → `{14, 'B'}`; `#14` trần → `{14, null}`.
 *
 * Mã phương án phải là **một** chữ cái đứng riêng. `(?![\p{L}\p{N}])` là chỗ
 * chịu tải: thiếu nó thì `#14 Bản tin` đọc thành phương án `B`, vì `\b` của
 * JavaScript chỉ biết ký tự ASCII và coi ranh giới `B|ả` là một ranh giới từ.
 */
function parsePairs(text: string): { overrides: RawPair[]; problems: ApprovalProblem[] } {
  const overrides: RawPair[] = [];
  const pattern = /#(\d+)(?:[ \t]+([A-Za-z])(?![\p{L}\p{N}]))?/gu;
  for (const match of text.matchAll(pattern)) {
    overrides.push({ number: Number(match[1]), option: match[2] === undefined ? null : match[2].toUpperCase() });
  }
  return { overrides, problems: [] };
}

// --- CLI ---

/**
 * `pnpm digest:approval -- <items.json>` — in khối "Sẵn sàng duyệt".
 * Thêm `--reply <file>` để đọc thử một câu trả lời và in ra JSON kết quả.
 */
function main(argv: readonly string[]): number {
  const itemsPath = argv.find((arg) => !arg.startsWith('--'));
  if (itemsPath === undefined) {
    process.stderr.write('Dùng: pnpm digest:approval -- <items.json> [--reply <comment.txt>]\n');
    return 2;
  }
  const items = JSON.parse(readFileSync(itemsPath, 'utf8')) as ApprovalItem[];
  const replyFlag = argv.indexOf('--reply');
  if (replyFlag !== -1 && argv[replyFlag + 1] !== undefined) {
    const reply = parseApprovalReply(readFileSync(argv[replyFlag + 1]!, 'utf8'), items);
    process.stdout.write(`${JSON.stringify(reply, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(renderApprovalDraft(items));
  return 0;
}

if (import.meta.filename === process.argv[1]) process.exit(main(process.argv.slice(2)));
