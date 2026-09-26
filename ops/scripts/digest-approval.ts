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
 * đọc sai ở đây chốt hoặc bỏ sót một việc mà không chỉ báo nào đỏ — nhóm **Z**
 * của `ops/known-failures.md`.
 *
 * ## Sáu luật đọc, mỗi luật một bài kiểm âm
 *
 * Ba luật đầu có từ bản đầu; ba luật sau do **vòng soát ngữ cảnh sạch của
 * chính PR này** tìm ra, cả ba đều tái hiện được bằng chạy thật:
 *
 * 1. `Duyệt` không chốt hộ một mục mà chính bản tin đó không liệt kê.
 * 2. `Duyệt, trừ #N` (không nêu phương án) **không** rơi về khuyến nghị của
 *    `#N` — chữ "trừ" nói ngược lại. Mục đó ra `unresolved`.
 * 3. Comment mở đầu bằng 🤖 **không bao giờ** là câu trả lời, kể cả khi nó
 *    chứa chữ `Duyệt` (`CLAUDE.md` mục 5, bất biến **I7**).
 * 4. **Phủ định.** `Không duyệt` / `Chưa duyệt nhé` từng ra `approve-all` với
 *    `problems: []` — chốt trọn gói mọi `irreversible` trong khi chủ dự án vừa
 *    nói ngược lại. Nay một chữ phủ định trong cùng câu làm câu đó thành
 *    `unrecognized`, **không bao giờ** thành `approve-all`.
 * 5. **Trích dẫn.** Chủ dự án bấm "Quote reply" thì chính khối do agent in ra
 *    quay lại thành câu trả lời: thân comment mang lại `#19 A, #14 B` và
 *    `hoàn tác #7` của khối gốc. Đo được: câu trả lời thật *"Tôi chưa quyết,
 *    để mai."* cho ra `vetoes: [7]` — một hành động có hậu quả
 *    (`CLAUDE.md` mục 14) từ một câu nói là chưa quyết. Đây đúng là nội dung do
 *    agent viết quay lại điều khiển agent, thứ bất biến **I7** tồn tại để chặn.
 *    Nay mọi dòng trích dẫn bị bỏ **trước** khi phân tích, và chốt 🤖 kiểm
 *    **sau** khi bóc trích dẫn.
 * 6. **Hai lựa chọn ngược nhau.** `#19 A, #19 B` từng ra `choices` có cả hai —
 *    mà `CLAUDE.md` mục 5 dặn agent "làm theo `choices`". Nay vào `problems`
 *    và `unresolved`.
 *
 * Mọi chỗ không chắc đều ngả về **ồn**, không ngả về im.
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

/**
 * Phủ định — luật 4. Một chữ trong danh sách này đứng **trước** chữ `duyệt`
 * trong cùng một câu là đủ để câu đó KHÔNG còn là lời duyệt.
 *
 * Cố ý bắt rộng theo câu chứ không chỉ bắt từ đứng liền trước: `không có gì
 * để duyệt` cũng phải trượt. Trượt về `unrecognized` là ồn — chủ dự án bị hỏi
 * lại một lần. Trượt về `approve-all` là chốt nhầm mọi `irreversible`.
 */
export const NEGATION_WORDS = ['không', 'ko', 'chưa', 'đừng', 'chớ', 'khoan', 'hoãn'] as const;

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
 * Năm phần của `CLAUDE.md` mục 14. Một dòng khớp đây **mở** một phần mới, nên
 * phần trước dừng tại đó — nhờ vậy `parseOptions` không nhặt một gạch đầu dòng
 * ngoài phần "Phương án" (ví dụ danh sách "Phần bị ảnh hưởng" của
 * `formatDecisionIssue`) thành một phương án bịa.
 */
const SECTION_HEADING = /^[ \t]*(?:#{1,6}[ \t]*)?\*{0,2}(?:Bối cảnh|Phương án|Khuyến nghị|Nếu anh chưa trả lời|Cách trả lời)/;

/**
 * Lấy `options`, `recommendation` và `ifNoAnswer` ra khỏi thân một issue
 * `[QĐ]`. Hình dạng năm phần do `CLAUDE.md` mục 14 chốt:
 *
 * > Bối cảnh (≤5 dòng) · Phương án A/B(/C) kèm hệ quả · Khuyến nghị · Nếu anh
 * > chưa trả lời thì điều gì xảy ra · Cách trả lời
 *
 * Đọc được **cả hai** hình dạng đang có thật trong kho, và đó là điều kiện để
 * tính năng này dùng được chứ không chỉ chạy được:
 *
 * - **viết tay** (`#213`): `**Phương án**` · `- **A — …**` · `**Khuyến nghị: A.**`
 * - **máy sinh** (`formatDecisionIssue`, `ops/scripts/recheck-assumptions.ts`):
 *   `## Phương án` · `- **A.** …` · `## Khuyến nghị` rồi `**A.** …` ở dòng sau
 *
 * Không đoán khi thiếu: mỗi trường không đọc được trả `null` / mảng rỗng, và
 * `renderApprovalDraft` in ra chỗ thiếu thay vì bỏ qua.
 */
export function parseDecisionBody(body: string): Pick<ApprovalItem, 'recommendation' | 'options' | 'ifNoAnswer'> {
  return {
    options: parseOptions(body),
    recommendation: parseRecommendation(body),
    ifNoAnswer: parseIfNoAnswer(body),
  };
}

/**
 * Phần mang tên `name`, tính cả dòng tiêu đề, dừng ở tiêu đề phần **khác**.
 *
 * Chỗ chặt: dòng dừng phải là một tên phần KHÁC. Thân do máy sinh mở phần
 * bằng `## Khuyến nghị` rồi lặp lại chữ đó ở dòng nội dung
 * (`**Khuyến nghị:** Phương án A`), nên một phép dừng "hễ khớp tiêu đề là
 * dừng" cắt mất đúng dòng mang câu trả lời — phần rỗng, và `renderApprovalDraft`
 * báo THIẾU KHUYẾN NGHỊ cho một issue có khuyến nghị hẳn hoi.
 */
function sectionOf(body: string, name: RegExp): string[] | null {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => SECTION_HEADING.test(line) && name.test(line));
  if (start === -1) return null;
  const out = [lines[start]!];
  for (const line of lines.slice(start + 1)) {
    if (SECTION_HEADING.test(line) && !name.test(line)) break;
    out.push(line);
  }
  return out;
}

/**
 * Các phương án, đọc từ gạch đầu dòng **bên trong phần "Phương án"**. Neo vào
 * gạch đầu dòng, không vào mọi chữ cái đứng một mình: một chữ `A` giữa câu văn
 * không phải một phương án.
 */
function parseOptions(body: string): string[] {
  const section = sectionOf(body, /Phương án/);
  if (section === null) return [];
  const seen: string[] = [];
  for (const line of section) {
    const match = /^[ \t]*[-*][ \t]*\*{0,2}([A-Z])[ \t]*(?:—|-|–|:|\.|\*)/.exec(line);
    if (match && !seen.includes(match[1]!)) seen.push(match[1]!);
  }
  return seen;
}

/**
 * `**Khuyến nghị: A.**` (viết tay) hoặc `## Khuyến nghị` rồi `**A.** …`
 * (máy sinh). `Phương án A` cũng nhận — `**Khuyến nghị:** Phương án A, vì rẻ.`
 * là cách viết tự nhiên và trả `null` ở đó là báo THIẾU sai.
 */
function parseRecommendation(body: string): string | null {
  const section = sectionOf(body, /Khuyến nghị/);
  if (section === null) return null;
  const text = section.join('\n');

  const inline = /Khuyến nghị\s*\*{0,2}\s*:\s*\*{0,2}\s*(?:Phương án\s+)?([A-Z])(?![\p{L}\p{N}])/u.exec(text);
  if (inline) return inline[1]!;

  for (const line of section.slice(1)) {
    const match = /^[ \t]*\*{0,2}(?:Phương án\s+)?([A-Z])(?![\p{L}\p{N}])/u.exec(line);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * Đoạn văn đầu tiên dưới tiêu đề "Nếu anh chưa trả lời", gộp về **một dòng**
 * — khối "Sẵn sàng duyệt" phải đọc được trong ~60 giây trên màn hình điện
 * thoại (rủi ro B11, `CLAUDE.md` mục 9).
 */
function parseIfNoAnswer(body: string): string | null {
  const section = sectionOf(body, /Nếu anh chưa trả lời/);
  if (section === null) return null;
  const paragraph: string[] = [];
  for (const line of section.slice(1)) {
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
 *
 * Phần hướng dẫn dùng `#N`/`#M` chứ **không** dùng số issue thật: đó là lớp
 * phòng thủ thứ hai cho luật 5 (lớp thứ nhất là bóc trích dẫn ở nửa đọc).
 */
export function renderApprovalDraft(items: readonly ApprovalItem[]): string {
  const needing = items.filter(needsAnswer);
  const done = items.filter((item) => !needsAnswer(item));
  const out: string[] = [DRAFT_HEADING, ''];

  if (needing.length === 0) {
    out.push('Không có việc nào cần anh quyết. Không phải trả lời gì.');
  } else {
    out.push('Khuyến nghị cho từng việc ở mục "Cần anh quyết" trên. Trả lời **một** trong ba dạng:');
    out.push('- `Duyệt` — chấp nhận toàn bộ khuyến nghị dưới đây.');
    out.push('- `Duyệt, trừ #N B` — chấp nhận tất cả, riêng `#N` lấy phương án `B`.');
    out.push('- `#N A, #M B` — chốt từng mục.');
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
  /** Có chữ `Duyệt`, không phủ định. */
  | 'approve-all'
  /** Không có chữ `Duyệt`, nhưng có ít nhất một `#N X` hoặc `hoàn tác #N`. */
  | 'per-item'
  /** Của chủ dự án, nhưng không mang tín hiệu nào đọc được — hoặc mập mờ. */
  | 'unrecognized';

export interface ApprovalChoice {
  number: number;
  option: string;
}

export interface ApprovalProblem {
  /** `null` khi chỗ vướng không gắn với một mục nào (ví dụ câu phủ định). */
  number: number | null;
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
 * vào `problems`, không vào `choices` — luật 1.
 */
export function parseApprovalReply(body: string, items: readonly ApprovalItem[]): ApprovalReply {
  const needingNumbers = items.filter(needsAnswer).map((item) => item.number);

  // Luật 5: bóc trích dẫn TRƯỚC, rồi mới kiểm 🤖 — một comment "Quote reply"
  // mở đầu bằng `> 🤖 …` thì phần của chủ dự án nằm sau khối trích dẫn.
  const text = body.normalize('NFC').split('\n').filter((line) => !/^[ \t]*>/.test(line)).join('\n');

  if (text.trimStart().startsWith('🤖')) {
    // Luật 3. `unresolved` vẫn liệt kê đủ: bên gọi chỉ đọc comment mới nhất
    // không được hiểu nhầm "không còn gì chờ".
    return { mode: 'not-an-answer', choices: [], vetoes: [], unresolved: [...needingNumbers], problems: [] };
  }

  const reply: ApprovalReply = { mode: 'unrecognized', choices: [], vetoes: [], unresolved: [], problems: [] };

  // Lớp phòng thủ thứ ba cho luật 5: khối được dán vào mà KHÔNG có dấu `>`.
  if (text.includes(DRAFT_HEADING)) {
    reply.problems.push({ number: null, reason: `comment chứa nguyên khối "${DRAFT_HEADING}" — không phân tích, hỏi lại` });
    reply.unresolved = [...needingNumbers];
    return reply;
  }

  const { vetoes, rest } = takeVetoes(text);
  reply.vetoes = vetoes;

  const approval = readApproval(rest);
  if (approval === 'negated') {
    // Luật 4: KHÔNG bao giờ thành approve-all.
    reply.problems.push({ number: null, reason: `có chữ \`${APPROVE_WORD}\` nhưng kèm phủ định — không đoán` });
    reply.unresolved = [...needingNumbers];
    return reply;
  }

  const approving = approval === 'yes';
  const { overrides } = approving ? parseExceptClause(rest) : parsePairs(rest);

  const byNumber = new Map(items.map((item) => [item.number, item]));
  const decided = new Set<number>();
  const picked = new Map<number, Set<string>>();

  for (const pair of overrides) {
    const item = byNumber.get(pair.number);
    if (item === undefined) {
      reply.problems.push({ number: pair.number, reason: 'không có trong bản tin này' });
      continue;
    }
    decided.add(pair.number);
    if (pair.reason !== undefined) {
      reply.problems.push({ number: pair.number, reason: pair.reason });
      continue;
    }
    if (pair.option === null) {
      // Luật 2: `trừ #N` trần KHÔNG rơi về khuyến nghị — "trừ" nói ngược lại.
      reply.problems.push({ number: pair.number, reason: 'nêu mục nhưng không nêu phương án' });
      continue;
    }
    if (item.options.length > 0 && !item.options.includes(pair.option)) {
      reply.problems.push({ number: pair.number, reason: `phương án \`${pair.option}\` không có trong issue` });
      continue;
    }
    addPick(picked, pair.number, pair.option);
  }

  if (approving) {
    for (const item of items) {
      if (!needsAnswer(item) || decided.has(item.number)) continue;
      if (item.recommendation === null) {
        reply.problems.push({ number: item.number, reason: '`Duyệt` nhưng issue không có khuyến nghị nào để nhận' });
        continue;
      }
      addPick(picked, item.number, item.recommendation);
    }
  }

  for (const [number, options] of picked) {
    if (options.size > 1) {
      // Luật 6: hai phương án ngược nhau cho cùng một mục.
      reply.problems.push({ number, reason: `nêu hai phương án ngược nhau (${[...options].sort().join(', ')})` });
      continue;
    }
    reply.choices.push({ number, option: [...options][0]! });
  }
  reply.choices.sort((a, b) => a.number - b.number);

  const chosen = new Set(reply.choices.map((choice) => choice.number));
  reply.unresolved = needingNumbers.filter((number) => !chosen.has(number));

  for (const number of vetoes) {
    if (!byNumber.has(number)) reply.problems.push({ number, reason: `\`${VETO_WORD}\` cho mục không có trong bản tin này` });
  }

  reply.mode = approving ? 'approve-all' : reply.choices.length > 0 || vetoes.length > 0 || reply.problems.length > 0 ? 'per-item' : 'unrecognized';
  return reply;
}

function addPick(picked: Map<number, Set<string>>, number: number, option: string): void {
  const set = picked.get(number) ?? new Set<string>();
  set.add(option);
  picked.set(number, set);
}

/**
 * Cắt mọi `hoàn tác #N` ra **trước**, và trả về phần còn lại đã bỏ chúng đi:
 * nếu không, `#N` trong một câu phủ quyết lại bị đọc thành một lựa chọn.
 *
 * Nhận cả `hoàn tác #20 và #21` / `hoàn tác #20, #21` — một câu phủ quyết hai
 * mục là cách viết tự nhiên, và bỏ sót `#21` ở đây là bỏ sót một hành động
 * chủ dự án đã yêu cầu.
 */
function takeVetoes(body: string): { vetoes: number[]; rest: string } {
  const vetoes: number[] = [];
  const rest = body.replace(/hoàn\s*tác\s*((?:#\d+(?:[ \t]*(?:,|và|&|\+)[ \t]*)?)+)/giu, (_match, run: string) => {
    for (const found of run.matchAll(/#(\d+)/g)) {
      const number = Number(found[1]);
      if (!vetoes.includes(number)) vetoes.push(number);
    }
    return ' ';
  });
  return { vetoes, rest };
}

/**
 * Luật 4. Trả `yes` khi có chữ `duyệt` đứng riêng và **không** câu nào chứa
 * phủ định trước nó, `negated` khi có nhưng kèm phủ định, `no` khi không có.
 *
 * Xét theo **câu** chứ theo từ đứng liền trước: `không có gì để duyệt` cũng
 * phải trượt. Một lần trượt là một lần hỏi lại; một lần chốt nhầm là mọi
 * `irreversible` bị nhận trọn gói.
 */
function readApproval(text: string): 'yes' | 'negated' | 'no' {
  let found = false;
  for (const sentence of text.split(/[.!?\n;]+/)) {
    const match = wordIndex(sentence, APPROVE_WORD);
    if (match === -1) continue;
    found = true;
    const before = sentence.slice(0, match);
    if (NEGATION_WORDS.some((word) => wordIndex(before, word) !== -1)) return 'negated';
  }
  return found ? 'yes' : 'no';
}

/** Vị trí của một chữ đứng riêng, không phân biệt hoa thường; `-1` nếu không có. */
function wordIndex(text: string, word: string): number {
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'iu').exec(text);
  return match === null ? -1 : match.index;
}

interface RawPair {
  number: number;
  /** `null` khi `#N` không đi kèm mã phương án nào. */
  option: string | null;
  /** Lý do riêng, ghi đè lý do mặc định của `option === null`. */
  reason?: string;
}

/**
 * Trong `Duyệt, trừ #N B`, chỉ phần **sau** chữ `trừ` mới là ngoại lệ.
 *
 * Không có chữ `trừ` mà vẫn có `#N` sau chữ `Duyệt` là một câu mập mờ: chữ
 * `B` chủ dự án gõ nói một đằng, chữ `Duyệt` nói một nẻo. Ca đó ra
 * `unresolved` — luật 2 của chính file này nói "không đoán", nên rơi về
 * khuyến nghị ở đây là tự mâu thuẫn.
 */
function parseExceptClause(text: string): { overrides: RawPair[] } {
  const index = wordIndex(text, EXCEPT_WORD);
  if (index === -1) {
    const stray = parsePairs(text);
    return {
      overrides: stray.overrides.map((pair) => ({
        ...pair,
        reason: `nêu sau chữ \`${APPROVE_WORD}\` mà không có chữ \`${EXCEPT_WORD}\` — không đoán`,
      })),
    };
  }
  return parsePairs(text.slice(index + EXCEPT_WORD.length));
}

/**
 * `#14 B` → `{14, 'B'}`; `#14` trần → `{14, null}`.
 *
 * Mã phương án phải là **một** chữ cái đứng riêng. `(?![\p{L}\p{N}])` là chỗ
 * chịu tải: thiếu nó thì `#14 Bản tin` đọc thành phương án `B`, vì `\b` của
 * JavaScript chỉ biết ký tự ASCII và coi ranh giới `B|ả` là một ranh giới từ.
 */
function parsePairs(text: string): { overrides: RawPair[] } {
  const overrides: RawPair[] = [];
  const pattern = /#(\d+)(?:[ \t]+([A-Za-z])(?![\p{L}\p{N}]))?/gu;
  for (const match of text.matchAll(pattern)) {
    overrides.push({ number: Number(match[1]), option: match[2] === undefined ? null : match[2].toUpperCase() });
  }
  return { overrides };
}

// --- CLI ---

/** Hình dạng tối thiểu của một issue `[QĐ]` lấy từ API GitHub. */
interface DecisionIssue {
  number: number;
  title: string;
  body: string;
  labels: readonly string[];
}

/**
 * Dựng `ApprovalItem[]` thẳng từ issue `[QĐ]`, để CHARTER phụ lục P2 nói
 * "không chép tay" là một câu đúng chứ không phải một lời dặn suông.
 */
export function itemsFromIssues(issues: readonly DecisionIssue[]): ApprovalItem[] {
  return issues
    .filter((issue) => issue.labels.includes('decision'))
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      kind: issue.labels.includes('irreversible')
        ? ('irreversible' as const)
        : issue.labels.includes('reversible')
          ? ('reversible' as const)
          : ('chưa phân loại' as const),
      ...parseDecisionBody(issue.body),
    }));
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * `pnpm digest:approval -- <items.json>` — in khối "Sẵn sàng duyệt".
 * `--from-issues <issues.json>` dựng mục thẳng từ issue `[QĐ]` thay cho `items.json`.
 * `--reply <comment.txt>` đọc thử một câu trả lời và in ra JSON kết quả.
 */
function main(argv: readonly string[]): number {
  const fromIssues = flagValue(argv, '--from-issues');
  const replyPath = flagValue(argv, '--reply');
  const taken = new Set([fromIssues, replyPath].filter((value) => value !== undefined));
  const itemsPath = argv.find((arg) => !arg.startsWith('--') && !taken.has(arg));

  let items: ApprovalItem[];
  if (fromIssues !== undefined) {
    items = itemsFromIssues(JSON.parse(readFileSync(fromIssues, 'utf8')) as DecisionIssue[]);
  } else if (itemsPath !== undefined) {
    items = JSON.parse(readFileSync(itemsPath, 'utf8')) as ApprovalItem[];
  } else {
    process.stderr.write('Dùng: pnpm digest:approval -- (<items.json> | --from-issues <issues.json>) [--reply <comment.txt>]\n');
    return 2;
  }

  if (replyPath !== undefined) {
    process.stdout.write(`${JSON.stringify(parseApprovalReply(readFileSync(replyPath, 'utf8'), items), null, 2)}\n`);
    return 0;
  }
  process.stdout.write(renderApprovalDraft(items));
  return 0;
}

if (import.meta.filename === process.argv[1]) process.exit(main(process.argv.slice(2)));
