#!/usr/bin/env node
/**
 * Mục **"Việc đang chờ anh"** của bản tin ngày — chỉ dẫn **C1** của chủ dự án
 * trên [`#251`](https://github.com/HungQuach301/crux-studio/issues/251), nguồn
 * `#131` lúc `2026-09-24T16:15:26Z`. Mục `platform/P-053`.
 *
 * ## Chỗ hỏng mục này chữa
 *
 * Bản tin chỉ đưa quyết định `irreversible` lên đầu (`needOwnerCount` cố ý
 * không đếm `reversible`, đúng `D-C06`). Vì vậy **hai** loại việc chờ chủ dự
 * án rơi mất hẳn:
 *
 * 1. mục backlog có trường `- hold:` mà lời giữ **nhắc chính chủ dự án**
 *    ("chờ chủ dự án merge", "chờ mắt chủ dự án", "cần người/nền tảng đặt …");
 * 2. `[QĐ] reversible` mà **máy không tự làm được** — nhãn đúng (không rơi
 *    vào tám nhóm `irreversible`) nhưng cả ba phương án đều nằm ngoài repo.
 *    `#36` tự khai đúng câu đó: *"thực chất đây là một chỗ chặn cần anh,
 *    không phải một quyết định tôi đã tự làm rồi báo lại"*.
 *
 * Chủ dự án dẫn bốn ca nằm im 2–3 ngày: `#101` · `#92` cộng `V-002`/`A-001` ·
 * `#5` · khoá YouTube Data API cho `T-011`/`T-008`. Nhóm **Z** đúng định
 * nghĩa: `pnpm check` xanh, CI xanh, bản tin xanh, mà nút thắt **người** bị
 * đếm thiếu — nên thước đo *"thời gian của anh"* (CHARTER 1.3) và dòng *"nút
 * thắt hiện tại là máy hay người"* đều nói sai. Xem `ops/known-failures.md`
 * `KF-037` (vế **C4** của cùng chỉ dẫn).
 *
 * ## Hướng lệch đã chọn, vì nó không đối xứng
 *
 * **Nêu thừa** một dòng thì chủ dự án thấy ngay và bỏ qua trong một giây.
 * **Nuốt mất** một việc đang chờ anh là đúng cái nhóm Z mục này chữa, và nó
 * im lặng nhiều ngày. Nên mọi luật ở đây chọn phía *nêu lên*, và khối luôn
 * được in kể cả khi rỗng — y như dòng `Cần anh quyết: N việc` (mục `P-005`).
 *
 * ## Vì sao hàm thuần, không phải một khối `run:` trong YAML
 *
 * Cùng lý do `decision-close.ts` và `gate-flow.ts` tồn tại: luật phải là
 * **bài kiểm máy khoá được, không phải lời dặn** (chuẩn của chủ dự án ở
 * [`#169`](https://github.com/HungQuach301/crux-studio/issues/169#issuecomment-5787322649)).
 * Module này không đọc đĩa và không gọi `gh` — `digest-metrics.ts` đưa dữ
 * liệu vào, nên mỗi luật con có một bài kiểm hai chiều.
 */

import { parseBacklog } from './backlog-status.ts';
import type { BacklogItem } from './backlog-status.ts';

/**
 * Làn giữ **cổng Mốc 3**, theo `ops/lanes/priority.md` vị trí 3: *"Cổng Mốc 3
 * là cổng quan trọng nhất, và nó nằm trọn trong làn này"*. Chỉ dẫn C1 đòi
 * *"xếp theo mức chặn đường tới cổng Mốc 3"*, và đây là chỗ duy nhất trong
 * repo nói cổng đó thuộc làn nào — nên khoá sắp xếp đọc từ đó chứ không từ
 * một phán đoán.
 */
export const GATE_LANE = 'topic';

/** Ký tự nhấn của Markdown — cùng tập mà `normalizeForHold` của `backlog-status.ts` bóc. */
const EMPHASIS = /[`*_]/g;

/**
 * Chuẩn hoá một đoạn **trước khi** dò dấu hiệu. Hai phép, mỗi phép trả lời
 * một ca đo được trong vòng soát ngữ cảnh sạch của chính mục này:
 *
 * - **NFC.** Bàn phím tiếng Việt trên macOS/iOS gõ ra **NFD**, và thân `[QĐ]`
 *   là do chủ dự án gõ. Đo được: `ownerHoldWait('chờ chủ dự án merge')` trả
 *   `true`, nhưng cùng chuỗi ở dạng NFD trả `false` — 11 hàng thật tụt về 0.
 * - **Bóc dấu nhấn Markdown.** Repo bôi đậm cụm lẻ ở khắp nơi, nên
 *   `Không **cần anh** làm gì` lách qua phép bóc câu phủ định (`\s+` không
 *   khớp `**`) và một `[QĐ]` khai *"không cần anh làm gì"* bị **nêu oan** —
 *   đúng chiều hỏng đắt nhất mà mục này tự khai. Cùng chữ ký `C1b` của `#256`.
 *
 * **Vì sao không gọi thẳng `normalizeForHold`** của `backlog-status.ts` dù nó
 * bóc đúng tập ký tự đó: hàm kia còn gộp `\s+` thành một dấu cách, tức **xoá
 * ranh giới dòng** — mà luật `chờ … [QĐ]` dưới đây sống bằng đúng ranh giới
 * câu, kể cả một lần xuống dòng. Hai phép chuẩn hoá cho hai mục đích khác
 * nhau; ghi ra đây để lần sau không ai "gộp cho gọn".
 */
function forSignals(text: string): string {
  return text.normalize('NFC').replace(EMPHASIS, '');
}

/**
 * Lời giữ khai thẳng là **không treo** — không phải một lời giữ hợp lệ, dù
 * trường `- hold:` có mặt.
 *
 * Ca thật: `audio/AU-008` viết `- hold: — **không treo.** Trần 30 USD đã được
 * chủ dự án duyệt thẳng …`. Nó **nhắc** chủ dự án nên mọi dấu hiệu dưới đây
 * khớp, mà mục lại đang nói ngược: nó không chờ ai.
 *
 * **Neo ở ĐẦU chuỗi**, không quét cả chuỗi. Vòng soát đo được cả hai chiều
 * hỏng của bản quét-cả-chuỗi: `chờ chủ dự án merge …; vế B không treo vì đã
 * duyệt` bị **nuốt** (một việc chờ anh biến mất — đúng nhóm Z mục này chữa),
 * còn `— **không** treo.` thì **lọt** (dấu nhấn chen giữa hai chữ). Neo ở đầu
 * cộng `forSignals` chặn cả hai: `audio/AU-008` mở đầu bằng đúng cụm đó, và
 * một câu "không treo" nằm giữa thân không còn phủ quyết được cả lời giữ.
 */
const HOLD_NOT_HELD = /^\s*[—–-]?\s*không\s+treo/iu;

/**
 * Dấu hiệu "lời giữ này chờ chính chủ dự án". **Cố ý hẹp**, mỗi dấu hiệu có
 * ca thật trong `ops/lanes/*​/backlog.md` đỡ (luật `A10` của `#251`: chỉ thêm
 * luật khi có một lỗi đã thật sự xảy ra):
 *
 * - `chủ dự án` — `platform/P-045` (*"chờ chủ dự án merge"*), `assembly/A-001`
 *   (*"chờ mắt chủ dự án"*), `visual/V-002` (*"chỉ số 4–6 chờ mắt chủ dự án"*).
 * - `chờ … [QĐ]` — `audio/AU-001` (*"chờ quyết định irreversible chọn nhà cung
 *   cấp giọng đọc (🤖 [QĐ])"*), `platform/P-027` (*"chờ 🤖 [QĐ] #116"*),
 *   `platform/P-049` (*"chờ chủ dự án chốt phương án ở 🤖 [QĐ] #254"*). Một
 *   `[QĐ]` đang mở là một câu hỏi trong hộp quyết định của chủ dự án, nên
 *   **chờ** nó là chờ anh.
 * - `cần người` — `platform/P-024` (*"cần người/nền tảng đặt
 *   CLAUDE_SESSION_URL"*), `topic/T-008` (*"cần người — G19 (VF-G19) và secret
 *   nền tảng"*).
 *
 * ⚠️ **Dấu hiệu `[QĐ]` phải đi kèm chữ `chờ`, không được để trần** — bài kiểm
 * tác động (`A3` của `#251`) chạy trên 46 trường `- hold:` thật bắt được đúng
 * một dương tính giả, và nó là lời giữ của **chính mục `P-053`**: nó *nhắc*
 * `[QĐ] reversible` khi kể hai vế C2/C3 đã tách, trong khi thứ nó chờ là một
 * lượt `crux-digest` — tức chờ **máy**.
 *
 * ⚠️ **Lớp ngăn câu là `[^.;:,\n]`, không phải `[^.;]`.** Bản đầu của chính
 * luật này khai *"giữ phép khớp trong cùng một câu"* mà lại cho qua **dấu
 * phẩy, hai chấm và cả xuống dòng** — vòng soát ngữ cảnh sạch dựng được ba
 * chuỗi lọt. Lời khai rộng hơn mã là một lỗi riêng, không chỉ là một lỗ:
 * lượt sau đọc comment rồi tin là chỗ đó đã kín.
 *
 * KHÔNG có dấu hiệu nào cho *"chưa kiểm bằng chạy thật"* — đó là chờ **máy**
 * (một lượt routine kế tiếp), không phải chờ người, và nó là hình dạng `hold`
 * phổ biến nhất trong repo (35 trên 46 trường thật trên đầu nhánh này). Gộp
 * nó vào đây sẽ nhét hơn ba chục dòng máy-tự-lo vào đúng mục dành riêng cho
 * việc của chủ dự án, tức chữa nhóm Z bằng cách dựng một nhóm Z khác.
 */
const OWNER_HOLD_SIGNALS: readonly RegExp[] = [
  /chủ\s+dự\s+án/iu,
  /chờ[^.;:,\n]{0,80}\[QĐ\]/iu,
  /cần\s+người/iu,
];

/**
 * Trường `- hold:` này có phải một việc đang chờ **chủ dự án** không.
 *
 * `null` hay chuỗi rỗng → `false`: mục không khai `- hold:` thì không có gì
 * để chờ (`heldReason` của `backlog-status.ts` đã dùng đúng luật đó).
 */
export function ownerHoldWait(hold: string | null | undefined): boolean {
  if (hold == null || hold.trim() === '') return false;
  const text = forSignals(hold);
  if (HOLD_NOT_HELD.test(text)) return false;
  return OWNER_HOLD_SIGNALS.some((re) => re.test(text));
}

/**
 * Câu phủ định phải **bóc trước** khi tìm dấu hiệu, không thử chặn bằng
 * lookbehind.
 *
 * Ca thật `#107` mở bằng *"Không cần anh làm gì"* — nó chứa nguyên cụm
 * `cần anh` của dấu hiệu 1. Một `[QĐ]` bị nêu oan ở đây tệ hơn một dòng rác:
 * nó nói với chủ dự án rằng anh còn nợ một việc mà chính issue đó đã khai là
 * anh không phải làm gì, nên lần sau anh không tin mục này nữa.
 *
 * Bóc bằng `replace` thay vì `(?<!không\s)` có lý do đo được: giữa `không` và
 * `cần` có thể là nhiều khoảng trắng, một lần xuống dòng, hoặc **dấu nhấn
 * Markdown** (`forSignals` đã bóc dấu nhấn trước khi tới đây).
 *
 * **Còn hở, khai trước:** `chẳng cần anh` và `không còn cần anh` vẫn lọt.
 * Chưa thân `[QĐ]` thật nào viết hai dạng đó, nên theo luật `A10` của `#251`
 * chúng **không** được thêm trước khi có một ca thật — thêm luật bằng cách
 * đoán là đúng thứ `A10` cấm.
 */
const OWNER_HAND_NEGATIONS: readonly RegExp[] = [/không\s+cần\s+anh/giu];

/**
 * Dấu hiệu "`[QĐ]` này máy không tự làm được". **Cố ý hẹp**, mỗi dấu hiệu
 * dẫn ca thật (luật `A10`):
 *
 * - `cần anh` — `#5` (*"Năm mục dưới đây **cần anh**"*), `#36` (*"cả ba phương
 *   án đều nằm ngoài repo và cần anh"*), `#67`/`#63` (tiêu đề *"cần anh tự
 *   merge"*).
 * - `chỉ anh` — `#101` (*"**Chỉ anh làm được** — phiên cloud không có project
 *   nào để mở"*), `#5` (tiêu đề *"Năm giả định chỉ anh kiểm được"*).
 * - `mắt anh` — `#92` (*"nửa mà charter giao cho mắt anh"*), cùng chữ với
 *   `assembly/A-001` (*"chờ mắt chủ dự án"*).
 * - `một câu của anh` — `#213` (*"Cần đúng một câu của anh để mở"*). Hẹp đến
 *   mức gần như một chuỗi cố định, và có lý do: `/của\s+anh/` trần khớp
 *   *"thời gian của anh"* — cụm xuất hiện trong `#45` và `#107`, đúng hai
 *   issue khai *"anh không cần làm gì"*.
 *
 * Không có dấu hiệu nào cho *"trả lời"* hay *"comment"*: **mọi** `[QĐ]` đều
 * có mục *"Cách trả lời"* mời chủ dự án trả lời, nên một dấu hiệu như thế sẽ
 * khớp cả 11 issue `reversible` đang mở và biến mục mới thành bản sao của mục
 * *"Quyết định reversible đang mở"* ngay trên nó.
 */
const OWNER_HAND_SIGNALS: readonly RegExp[] = [
  /cần\s+anh/iu,
  /chỉ\s+anh/iu,
  /mắt\s+anh/iu,
  /một\s+câu\s+của\s+anh/iu,
];

/**
 * `[QĐ]` này có phải một chỗ chặn **cần chủ dự án** không — đọc tiêu đề cộng
 * thân, sau khi chuẩn hoá và bóc các câu phủ định.
 *
 * Bên gọi chỉ đưa vào issue `reversible`: `irreversible` đã nằm ở dòng đầu
 * bản tin (*"Cần anh quyết"*), và in lại nó ở đây là bắt chủ dự án đọc cùng
 * một việc hai lần trong một bản tin dài.
 */
export function decisionNeedsOwnerHand(text: string): boolean {
  let stripped = forSignals(text);
  for (const re of OWNER_HAND_NEGATIONS) stripped = stripped.replace(re, ' ');
  return OWNER_HAND_SIGNALS.some((re) => re.test(stripped));
}

/**
 * Số `[QĐ]` mà một lời giữ **thật sự chờ** — chỉ lấy `#N` nằm trong đoạn câu
 * có nhắc `[QĐ]`.
 *
 * Vì sao không lấy mọi `#N` trong lời giữ: đo trên dữ liệu thật, `platform/P-045`
 * nhắc `#84`/`#39` và `platform/P-039` nhắc `#194`/`#208` như **phép đo sau
 * này**, không phải chỗ chủ dự án bấm vào. Và cùng tập số đó còn quyết định
 * một `[QĐ]` đang chặn mục nào ở nhánh (b) của `ownerWaitingRows`, nên nhiễu
 * này không dừng ở phần hiển thị.
 */
export function decisionRefsInHold(hold: string, issueRefsOf: (text: string) => number[]): number[] {
  const refs = new Set<number>();
  for (const segment of forSignals(hold).split(/[.;\n]/)) {
    if (!/\[QĐ\]/u.test(segment)) continue;
    for (const n of issueRefsOf(segment)) refs.add(n);
  }
  return [...refs].sort((a, b) => a - b);
}

/** Một mục backlog kèm làn của nó — khoá là `<lane>/<id>`, `deps` là mã trần. */
interface LaneItem {
  lane: string;
  item: BacklogItem;
}

/**
 * Đồ thị `deps` của toàn bộ backlog, khoá bằng **mã trần** (`P-016`, `V-003`)
 * vì đó là cách `- deps:` viết thật — `parseDeps` trả mã trần, không trả
 * `<lane>/<id>`.
 */
export interface BacklogGraph {
  /**
   * **Mọi** mục đọc được, theo thứ tự file rồi thứ tự trong file — kể cả mục
   * mang mã **trùng** một mục trước đó.
   *
   * Vì sao cần riêng trường này bên cạnh `byId`: mã trùng **đang có thật**
   * (`ops/lanes/platform/backlog.md` có hai mục `### P-028`), và một `byId`
   * "mục đầu thắng" sẽ bỏ **im lặng** trường `- hold:` của mục thứ hai. Đó
   * đúng là hình dạng mà `duplicateIds` của `backlog-status.ts` sinh ra để
   * không im lặng, nên đồ thị này không được đi ngược nó.
   */
  items: readonly LaneItem[];
  /** Mã trần → mục và làn của nó. Mã trùng thì mục ĐẦU thắng — chỉ dùng cho cạnh `deps`. */
  byId: ReadonlyMap<string, LaneItem>;
  /** Mã trần → những mã khai nó trong `- deps:` (cạnh ngược). */
  dependants: ReadonlyMap<string, readonly string[]>;
}

/** Dựng đồ thị từ nội dung các file backlog. Một định nghĩa "mục backlog" cho cả repo: `parseBacklog`. */
export function backlogGraph(files: readonly { lane: string; content: string }[]): BacklogGraph {
  const items: LaneItem[] = [];
  const byId = new Map<string, LaneItem>();
  const dependants = new Map<string, string[]>();

  for (const file of files) {
    for (const item of parseBacklog(file.content)) {
      const entry = { lane: file.lane, item };
      items.push(entry);
      if (!byId.has(item.id)) byId.set(item.id, entry);
    }
  }
  for (const { item } of items) {
    for (const dep of item.deps ?? []) {
      if (dep.id == null) continue;
      const list = dependants.get(dep.id);
      if (list === undefined) dependants.set(dep.id, [item.id]);
      else if (!list.includes(item.id)) list.push(item.id);
    }
  }
  return { items, byId, dependants };
}

/** Bao nhiêu mục bị chặn bởi một tập mã, và bao nhiêu trong số đó thuộc làn giữ cổng Mốc 3. */
export interface BlockedCounts {
  /** Mã mục bị chặn, **bắc cầu**, tăng dần. Không chứa chính các mã gốc. */
  ids: string[];
  /** Trong `ids`, những mã thuộc `GATE_LANE`. */
  gateIds: string[];
}

/**
 * Mọi mục bị chặn bởi `roots`, đi **bắc cầu** theo cạnh ngược của `deps`.
 *
 * Bắc cầu chứ không chỉ một tầng: `V-002` chờ mắt chủ dự án thì `V-003` chờ
 * `V-002`, và `V-004` chờ `V-003` — đếm một tầng sẽ báo "chặn 1 mục" cho một
 * chỗ đang chặn cả một làn, tức đúng con số làm khoá sắp xếp của C1 sai.
 *
 * Vòng trong `deps` không làm hàm này treo: `seen` chặn đi lại (`cycles` là
 * ca `backlog-status.ts` đã biết và báo riêng).
 */
export function blockedCounts(graph: BacklogGraph, roots: readonly string[]): BlockedCounts {
  const seen = new Set<string>(roots);
  const queue = [...roots];
  const out = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.dependants.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      out.add(next);
      queue.push(next);
    }
  }
  const ids = [...out].sort();
  return { ids, gateIds: ids.filter((id) => graph.byId.get(id)?.lane === GATE_LANE) };
}

/** Một dòng của mục "Việc đang chờ anh". */
export interface OwnerWaitRow {
  kind: 'backlog' | 'decision';
  /** Khoá ổn định: `<lane>/<id>` hoặc `#<số issue>`. Cũng là khoá sắp xếp cuối cùng. */
  key: string;
  /** **Việc cụ thể** — lời `- hold:` hoặc tiêu đề `[QĐ]`, đã cắt theo `WHAT_MAX`. */
  what: string;
  /**
   * **Đã chờ bao lâu**, tính bằng ngày (1 số lẻ). `null` khi không đo được —
   * in ra chứ không đoán. Số **âm** nghĩa là mốc nằm ở tương lai (lệch đồng
   * hồ, chữ ký `I-021`); nó cũng được in ra chứ không kẹp về 0.
   *
   * ⚠️ Hai `kind` đo **hai đại lượng khác nhau**, và dòng in ra phải nói
   * đúng cái nào: hàng `decision` đo *"issue đã mở bao lâu"* (`createdAt`),
   * hàng `backlog` đo *"lượt chạy gần nhất chạm mục cách đây bao lâu"* (mốc
   * `at` của dòng log). Gọi cả hai là "đã chờ" là nói sai bất biến **I6**:
   * bất cứ lượt agent nào chạm mục cũng đặt lại đồng hồ của hàng `backlog`,
   * nên nó KHÔNG trả lời được "chủ dự án đã giữ chỗ này bao lâu".
   */
  waitingDays: number | null;
  /** **Đang chặn gì** — mã mục bị chặn, bắc cầu, tăng dần. */
  blocking: readonly string[];
  /** Trong `blocking`, những mã thuộc làn giữ cổng Mốc 3 (`GATE_LANE`). */
  blockingGate: readonly string[];
  /** **Link** — `#N` (GitHub tự nối) hoặc đường dẫn file backlog. */
  link: string;
}

/**
 * Trần độ dài của trường `what`, đếm bằng **điểm mã** chứ không bằng đơn vị
 * UTF-16. Lời `- hold:` thật dài tới hơn 400 ký tự (`audio/AU-008`), và C1
 * đòi *"mỗi mục một dòng"* đọc được trên màn hình điện thoại (rủi ro B11).
 */
export const WHAT_MAX = 110;

/**
 * Cắt an toàn cho một dòng bản tin. Ba phép, mỗi phép trả lời một ca vòng
 * soát đo được:
 *
 * - **bóc dấu nhấn Markdown** — cắt giữa một cặp `` ` `` hay `**` để lại
 *   markdown lệch, và GitHub render phần còn lại của dòng sai. Đo được: 2
 *   trên 11 hàng thật bị cắt giữa cặp.
 * - **cắt theo điểm mã** (`[...flat]`) — `slice` theo UTF-16 cắt **giữa cặp
 *   thay thế**. Đo được: một lời giữ dài 138 ký tự rồi tới `🤖` cho ra một
 *   nửa cặp ở đuôi, `isWellFormed()` là `false`, GitHub in ra `�`. Lời giữ
 *   thật **có** `🤖` (`platform/P-049`).
 * - **gộp khoảng trắng** — lời giữ thật xuống dòng ở cột 100.
 */
function clamp(text: string): string {
  const flat = forSignals(text).replace(/\s+/g, ' ').trim();
  const chars = [...flat];
  if (chars.length <= WHAT_MAX) return flat;
  return `${chars.slice(0, WHAT_MAX - 1).join('').trimEnd()}…`;
}

/**
 * Số ngày (1 số lẻ) từ `from` tới `now`; `null` khi thiếu hoặc không đọc được
 * `from`. Số **âm** khi `from` nằm ở tương lai — trả ra chứ không kẹp, để
 * dòng bản tin nói được "mốc ở tương lai" thay vì in một con số vô nghĩa.
 */
export function waitingDaysFrom(from: string | undefined, now: Date): number | null {
  if (from === undefined) return null;
  const at = Date.parse(from);
  if (Number.isNaN(at)) return null;
  return Math.round(((now.getTime() - at) / 86_400_000) * 10) / 10;
}

/** Issue `[QĐ]` `reversible` đang mở, ở dạng module này cần — cùng hình dạng `DecisionRow` của bản tin. */
export interface OwnerWaitDecision {
  number: number;
  title: string;
  body?: string;
  /** Số ngày issue đã mở, do bên gọi tính (`decisionAgeDays`). */
  ageDays?: number | null;
}

export interface OwnerWaitingInput {
  /** Nội dung từng file `ops/lanes/<lane>/backlog.md`. */
  backlogs: readonly { lane: string; content: string }[];
  /** Issue `[QĐ]` **`reversible` đang mở**. `irreversible` đã ở dòng đầu bản tin, đừng đưa vào đây. */
  decisions: readonly OwnerWaitDecision[];
  /**
   * Dòng log đọc được (`readRunLogs`), dùng để trả lời *"lượt chạy gần nhất
   * chạm mục cách đây bao lâu"* cho một mục backlog: mốc `at` **mới nhất** của
   * `ref` `<lane>/<id>`.
   *
   * Vì sao không có nguồn nào khác: file backlog là markdown, trường
   * `- hold:` không mang mốc thời gian, và `git log` trên một dòng markdown
   * cho mốc **lần sửa cuối**, đổi mỗi lần ai đó sửa một chữ trong mục. Mục
   * chưa có dòng log nào ra `null`, và `null` được in ra chứ không lặng lẽ
   * thành 0 (cùng luật ba trạng thái mà `heartbeat-source.ts` đặt).
   */
  logs: readonly { ref: string; at: string }[];
  now: Date;
  /** `#N` trong một đoạn — bên gọi đưa vào (`linkedPrNumbers` của `digest-metrics.ts`), để luật đọc `#N` chỉ có MỘT bản trong repo. */
  issueRefsOf: (text: string) => number[];
}

/**
 * Xếp theo **mức chặn đường tới cổng Mốc 3**, đúng chữ C1. Cổng Mốc 3 không
 * phải một đỉnh trong đồ thị `deps`, nên nó được xấp xỉ bằng hai con số đo
 * được, khai thẳng ra thay vì gọi là "mức chặn":
 *
 * 1. số mục bị chặn **thuộc làn `topic`** (làn giữ cổng, `ops/lanes/priority.md`), giảm dần;
 * 2. tổng số mục bị chặn, giảm dần;
 * 3. chờ lâu hơn đi trước — `null` (không đo được) xếp **cuối** bằng
 *    `-Infinity`, chứ không bằng `-1`: `waitingDays` có thể âm thật khi mốc
 *    nằm ở tương lai, và `-1` sẽ trộn một hàng đo được với một hàng không đo
 *    được;
 * 4. `key` tăng dần, để hai lượt chạy trên cùng dữ liệu cho cùng một thứ tự.
 */
function compareRows(a: OwnerWaitRow, b: OwnerWaitRow): number {
  if (a.blockingGate.length !== b.blockingGate.length) return b.blockingGate.length - a.blockingGate.length;
  if (a.blocking.length !== b.blocking.length) return b.blocking.length - a.blocking.length;
  const aDays = a.waitingDays ?? Number.NEGATIVE_INFINITY;
  const bDays = b.waitingDays ?? Number.NEGATIVE_INFINITY;
  if (aDays !== bDays) return bDays - aDays;
  return a.key.localeCompare(b.key);
}

/**
 * Mốc `at` mới nhất của một mục trong tập dòng log; `undefined` khi mục chưa
 * có dòng nào **đọc được**.
 *
 * Dòng có `at` không parse được bị **bỏ qua**, không làm mù cả `ref`: log là
 * file append-only nhiều lượt ghi, nên một dòng hỏng sẽ nuốt luôn con số của
 * mục nếu nó được nhận làm `newest` rồi mọi so sánh sau thành `x > NaN`.
 */
function newestLogAt(logs: OwnerWaitingInput['logs'], lane: string, id: string): string | undefined {
  const ref = `${lane}/${id}`;
  let newest: string | undefined;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const line of logs) {
    if (line.ref !== ref) continue;
    const ms = Date.parse(line.at);
    if (Number.isNaN(ms) || ms <= newestMs) continue;
    newestMs = ms;
    newest = line.at;
  }
  return newest;
}

/** Mọi việc đang chờ chủ dự án, đã xếp theo `compareRows`. */
export function ownerWaitingRows(input: OwnerWaitingInput): OwnerWaitRow[] {
  const graph = backlogGraph(input.backlogs);
  const rows: OwnerWaitRow[] = [];

  // (a) mục backlog có `- hold:` chờ chính chủ dự án. Duyệt `graph.items`, KHÔNG
  // duyệt `graph.byId`: mã trùng đang có thật, và bỏ mục thứ hai là bỏ im lặng
  // đúng thứ `duplicateIds` sinh ra để không im lặng.
  for (const { lane, item } of graph.items) {
    if (!ownerHoldWait(item.holdField)) continue;
    const blocked = blockedCounts(graph, [item.id]);
    const refs = decisionRefsInHold(item.holdField ?? '', input.issueRefsOf);
    const issues = refs.map((n) => `#${n}`).join(', ');
    rows.push({
      kind: 'backlog',
      key: `${lane}/${item.id}`,
      what: clamp(item.holdField ?? ''),
      waitingDays: waitingDaysFrom(newestLogAt(input.logs, lane, item.id), input.now),
      blocking: blocked.ids,
      blockingGate: blocked.gateIds,
      link: issues === '' ? `ops/lanes/${lane}/backlog.md` : `ops/lanes/${lane}/backlog.md · ${issues}`,
    });
  }

  // (b) `[QĐ] reversible` mà máy không tự làm được. Nó chặn những mục có
  // `- hold:` **chờ** chính số issue đó, cộng mọi mục bắc cầu sau chúng.
  for (const decision of input.decisions) {
    const text = `${decision.title}\n${decision.body ?? ''}`;
    if (!decisionNeedsOwnerHand(text)) continue;
    const roots = graph.items
      .filter(({ item }) => decisionRefsInHold(item.holdField ?? '', input.issueRefsOf).includes(decision.number))
      .map(({ item }) => item.id);
    const blocked = blockedCounts(graph, roots);
    const ids = [...new Set([...roots, ...blocked.ids])].sort();
    const gateIds = ids.filter((id) => graph.byId.get(id)?.lane === GATE_LANE);
    rows.push({
      kind: 'decision',
      key: `#${decision.number}`,
      what: clamp(decision.title),
      waitingDays: decision.ageDays ?? null,
      blocking: ids,
      blockingGate: gateIds,
      link: `#${decision.number}`,
    });
  }

  return rows.sort(compareRows);
}

/** Tối đa bao nhiêu mã bị chặn được in ra trong một hàng trước khi gộp thành `…+K`. */
export const BLOCKING_SHOWN = 3;

/**
 * Tối đa bao nhiêu **hàng** được in ra. Bản tin có trần *"khoảng 25 dòng"*
 * (CHARTER 2.5) và rủi ro `B11` đòi đọc xong trong 60 giây trên màn hình điện
 * thoại; đo trên dữ liệu thật khối này ra **12 hàng**. `BLOCKING_SHOWN` kẹp số
 * mã **trong** một hàng, trần này kẹp **số hàng** — thiếu nó thì một ngày xấu
 * đẩy bản tin dài gấp đôi. Phần dư không biến mất: một dòng cuối nói còn bao
 * nhiêu và xem ở đâu.
 */
export const MAX_ROWS = 8;

function renderBlocking(row: OwnerWaitRow): string {
  if (row.blocking.length === 0) return 'chưa dò được mục nào đứng sau';
  const shown = row.blocking.slice(0, BLOCKING_SHOWN).join(', ');
  const rest = row.blocking.length - BLOCKING_SHOWN;
  const tail = rest > 0 ? `, …+${rest}` : '';
  const gate = row.blockingGate.length > 0 ? ` · ${row.blockingGate.length} thuộc làn ${GATE_LANE} (cổng Mốc 3)` : '';
  return `chặn ${row.blocking.length} mục (${shown}${tail})${gate}`;
}

/**
 * Cột thời gian, nói đúng đại lượng nó đo (bất biến **I6**). Hàng `decision`
 * đo tuổi issue; hàng `backlog` đo khoảng cách tới lượt chạy gần nhất chạm
 * mục — hai thứ khác nhau, và gọi cả hai là "đã chờ" là nói sai.
 */
function renderWaited(row: OwnerWaitRow): string {
  if (row.waitingDays == null) return 'chưa đo được mốc thời gian';
  if (row.waitingDays < 0) return `mốc ở TƯƠNG LAI ${-row.waitingDays} ngày — lệch đồng hồ (I-021)`;
  return row.kind === 'decision'
    ? `đã mở ${row.waitingDays} ngày`
    : `lượt gần nhất chạm mục: ${row.waitingDays} ngày trước`;
}

/** Một dòng bản tin cho một hàng. */
export function renderOwnerWaitRow(row: OwnerWaitRow): string {
  return `- ${row.key} · ${row.what} · ${renderWaited(row)} · ${renderBlocking(row)} · ${row.link}`;
}

/**
 * Khối *"Việc đang chờ anh"* của bản tin, **luôn** gồm dòng đếm — kể cả khi
 * `rows` rỗng. Cùng luật với dòng `Cần anh quyết: N việc` (mục `P-005`): một
 * khối biến mất khi rỗng là một khối mà chủ dự án phải đọc kỹ mới biết nó có
 * hay không, và "không có việc nào chờ anh" là tin đáng nói.
 *
 * Dòng đếm luôn nói **tổng thật**, kể cả khi `MAX_ROWS` cắt bớt phần in ra —
 * một con số nhỏ đi vì trần hiển thị là đúng nhóm Z.
 */
export function renderOwnerWaitingLines(rows: readonly OwnerWaitRow[]): string[] {
  const out = [`Việc đang chờ anh: ${rows.length} việc`];
  for (const row of rows.slice(0, MAX_ROWS)) out.push(renderOwnerWaitRow(row));
  if (rows.length > MAX_ROWS) {
    out.push(
      `- …còn ${rows.length - MAX_ROWS} việc nữa, xếp sau theo mức chặn — xem \`pnpm digest:metrics\` hoặc trường \`- hold:\` trong \`ops/lanes/*/backlog.md\``,
    );
  }
  if (rows.length === 0) {
    out.push(
      '- không có việc nào đang chờ anh (không mục backlog nào giữ chỗ vì anh, không `[QĐ] reversible` nào máy không tự làm được)',
    );
  }
  return out;
}
