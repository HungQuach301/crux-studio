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

/**
 * Lời giữ khai thẳng là **không treo** — không phải một lời giữ hợp lệ, dù
 * trường `- hold:` có mặt.
 *
 * Ca thật: `audio/AU-008` viết `- hold: — **không treo.** Trần 30 USD đã được
 * chủ dự án duyệt thẳng …`. Nó **nhắc** chủ dự án nên mọi dấu hiệu dưới đây
 * khớp, mà mục lại đang nói ngược: nó không chờ ai. Thiếu phép phủ định này
 * thì dòng đầu tiên của mục mới đã là một dòng sai — và một mục "Việc đang
 * chờ anh" nói sai ngay ca đầu là thứ chủ dự án thôi đọc.
 */
const HOLD_NOT_HELD = /không\s+treo/iu;

/**
 * Dấu hiệu "lời giữ này chờ chính chủ dự án". **Cố ý hẹp**, mỗi dấu hiệu có
 * ca thật trong `ops/lanes/*​/backlog.md` đỡ (luật `A10` của `#251`: chỉ thêm
 * luật khi có một lỗi đã thật sự xảy ra):
 *
 * - `chủ dự án` — `platform/P-045` (*"chờ chủ dự án merge"*), `assembly/A-001`
 *   (*"chờ mắt chủ dự án"*), `platform/P-033` (*"nhịp mỗi giờ cần chủ dự án
 *   đổi lịch"*).
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
 * lượt `crux-digest` — tức chờ **máy**. `[^.;]{0,80}` giữ phép khớp trong cùng
 * một câu, nên một chữ `chờ` ở câu trước không kéo cả lời giữ vào đây.
 * Không có dấu hiệu `chặn … [QĐ]`: chưa lời giữ thật nào viết thế (luật `A10`).
 *
 * KHÔNG có dấu hiệu nào cho *"chưa kiểm bằng chạy thật"* — đó là chờ **máy**
 * (một lượt routine kế tiếp), không phải chờ người, và nó là hình dạng `hold`
 * phổ biến nhất trong repo (34 trên 46 trường thật). Gộp nó vào đây sẽ nhét
 * hơn ba chục dòng máy-tự-lo vào đúng mục dành riêng cho việc của chủ dự án,
 * tức chữa nhóm Z bằng cách dựng một nhóm Z khác.
 */
const OWNER_HOLD_SIGNALS: readonly RegExp[] = [/chủ\s+dự\s+án/iu, /chờ[^.;]{0,80}\[QĐ\]/iu, /cần\s+người/iu];

/**
 * Trường `- hold:` này có phải một việc đang chờ **chủ dự án** không.
 *
 * `null` hay chuỗi rỗng → `false`: mục không khai `- hold:` thì không có gì
 * để chờ (`heldReason` của `backlog-status.ts` đã dùng đúng luật đó).
 */
export function ownerHoldWait(hold: string | null | undefined): boolean {
  if (hold == null || hold.trim() === '') return false;
  if (HOLD_NOT_HELD.test(hold)) return false;
  return OWNER_HOLD_SIGNALS.some((re) => re.test(hold));
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
 * `cần` có thể là nhiều khoảng trắng hoặc một lần xuống dòng (thân issue thật
 * xuống dòng ở cột 100), mà lookbehind độ rộng thay đổi thì khó đọc hơn và
 * dễ viết sai một lần nữa.
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
 * thân, sau khi bóc các câu phủ định.
 *
 * Bên gọi chỉ đưa vào issue `reversible`: `irreversible` đã nằm ở dòng đầu
 * bản tin (*"Cần anh quyết"*), và in lại nó ở đây là bắt chủ dự án đọc cùng
 * một việc hai lần trong một bản tin dài.
 */
export function decisionNeedsOwnerHand(text: string): boolean {
  let stripped = text;
  for (const re of OWNER_HAND_NEGATIONS) stripped = stripped.replace(re, ' ');
  return OWNER_HAND_SIGNALS.some((re) => re.test(stripped));
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
  /** Mã trần → mục và làn của nó. Mã trùng giữa hai làn thì mục ĐẦU thắng. */
  byId: ReadonlyMap<string, LaneItem>;
  /** Mã trần → những mã khai nó trong `- deps:` (cạnh ngược). */
  dependants: ReadonlyMap<string, readonly string[]>;
}

/** Dựng đồ thị từ nội dung các file backlog. Một định nghĩa "mục backlog" cho cả repo: `parseBacklog`. */
export function backlogGraph(files: readonly { lane: string; content: string }[]): BacklogGraph {
  const byId = new Map<string, LaneItem>();
  const dependants = new Map<string, string[]>();

  for (const file of files) {
    for (const item of parseBacklog(file.content)) {
      if (!byId.has(item.id)) byId.set(item.id, { lane: file.lane, item });
    }
  }
  for (const { item } of byId.values()) {
    for (const dep of item.deps ?? []) {
      if (dep.id == null) continue;
      const list = dependants.get(dep.id);
      if (list === undefined) dependants.set(dep.id, [item.id]);
      else if (!list.includes(item.id)) list.push(item.id);
    }
  }
  return { byId, dependants };
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
  /** **Đã chờ bao lâu**, tính bằng ngày (1 số lẻ). `null` khi không đo được — in ra chứ không đoán. */
  waitingDays: number | null;
  /** **Đang chặn gì** — mã mục bị chặn, bắc cầu, tăng dần. */
  blocking: readonly string[];
  /** Trong `blocking`, những mã thuộc làn giữ cổng Mốc 3 (`GATE_LANE`). */
  blockingGate: readonly string[];
  /** **Link** — `#N` (GitHub tự nối) hoặc đường dẫn file backlog. */
  link: string;
}

/**
 * Trần độ dài của trường `what`. Lời `- hold:` thật dài tới hơn 400 ký tự
 * (`audio/AU-008`), và C1 đòi *"mỗi mục một dòng"* đọc được trên màn hình
 * điện thoại (rủi ro B11). Cắt kèm `…` để chủ dự án thấy là còn nữa; bản đầy
 * đủ nằm ở `link`.
 */
export const WHAT_MAX = 140;

function clamp(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= WHAT_MAX ? flat : `${flat.slice(0, WHAT_MAX - 1).trimEnd()}…`;
}

/** Số ngày (1 số lẻ) từ `from` tới `now`; `null` khi thiếu hoặc không đọc được `from`. */
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
   * Dòng log đọc được (`readRunLogs`), dùng để trả lời *"đã chờ bao lâu"* cho
   * một mục backlog: mốc `at` **mới nhất** của `ref` `<lane>/<id>`.
   *
   * Vì sao không có nguồn nào khác: file backlog là markdown, trường
   * `- hold:` không mang mốc thời gian, và `git log` trên một dòng markdown
   * cho mốc **lần sửa cuối**, đổi mỗi lần ai đó sửa một chữ trong mục. Dòng
   * log là mốc *"lượt chạy gần nhất chạm mục này"* — đúng thứ chủ dự án cần
   * để biết một việc đã nằm im bao lâu. Mục chưa có dòng log nào ra `null`,
   * và `null` được in ra chứ không lặng lẽ thành 0 (cùng luật ba trạng thái
   * mà `heartbeat-source.ts` đặt).
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
 * 3. đã chờ lâu hơn đi trước — `null` (không đo được) xếp **cuối**, vì một
 *    con số không có thì không được giả vờ là lớn;
 * 4. `key` tăng dần, để hai lượt chạy trên cùng dữ liệu cho cùng một thứ tự.
 */
function compareRows(a: OwnerWaitRow, b: OwnerWaitRow): number {
  if (a.blockingGate.length !== b.blockingGate.length) return b.blockingGate.length - a.blockingGate.length;
  if (a.blocking.length !== b.blocking.length) return b.blocking.length - a.blocking.length;
  const aDays = a.waitingDays ?? -1;
  const bDays = b.waitingDays ?? -1;
  if (aDays !== bDays) return bDays - aDays;
  return a.key.localeCompare(b.key);
}

/** Mốc `at` mới nhất của một mục trong tập dòng log; `undefined` khi mục chưa có dòng nào. */
function newestLogAt(logs: OwnerWaitingInput['logs'], lane: string, id: string): string | undefined {
  const ref = `${lane}/${id}`;
  let newest: string | undefined;
  for (const line of logs) {
    if (line.ref !== ref) continue;
    if (newest === undefined || Date.parse(line.at) > Date.parse(newest)) newest = line.at;
  }
  return newest;
}

/** Mọi việc đang chờ chủ dự án, đã xếp theo `compareRows`. */
export function ownerWaitingRows(input: OwnerWaitingInput): OwnerWaitRow[] {
  const graph = backlogGraph(input.backlogs);
  const rows: OwnerWaitRow[] = [];

  // (a) mục backlog có `- hold:` chờ chính chủ dự án.
  for (const [id, { lane, item }] of graph.byId) {
    if (!ownerHoldWait(item.holdField)) continue;
    const blocked = blockedCounts(graph, [id]);
    const refs = input.issueRefsOf(item.holdField ?? '');
    const issues = refs.map((n) => `#${n}`).join(', ');
    rows.push({
      kind: 'backlog',
      key: `${lane}/${id}`,
      what: clamp(item.holdField ?? ''),
      waitingDays: waitingDaysFrom(newestLogAt(input.logs, lane, id), input.now),
      blocking: blocked.ids,
      blockingGate: blocked.gateIds,
      link: issues === '' ? `ops/lanes/${lane}/backlog.md` : `ops/lanes/${lane}/backlog.md · ${issues}`,
    });
  }

  // (b) `[QĐ] reversible` mà máy không tự làm được. Nó chặn những mục có
  // `- hold:` nhắc chính số issue đó, cộng mọi mục bắc cầu sau chúng.
  for (const decision of input.decisions) {
    const text = `${decision.title}\n${decision.body ?? ''}`;
    if (!decisionNeedsOwnerHand(text)) continue;
    const roots = [...graph.byId]
      .filter(([, { item }]) => input.issueRefsOf(item.holdField ?? '').includes(decision.number))
      .map(([id]) => id);
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

/** Tối đa bao nhiêu mã bị chặn được in ra trước khi gộp thành `…+K`. */
export const BLOCKING_SHOWN = 3;

function renderBlocking(row: OwnerWaitRow): string {
  if (row.blocking.length === 0) return 'chưa dò được mục nào đứng sau';
  const shown = row.blocking.slice(0, BLOCKING_SHOWN).join(', ');
  const rest = row.blocking.length - BLOCKING_SHOWN;
  const tail = rest > 0 ? `, …+${rest}` : '';
  const gate = row.blockingGate.length > 0 ? ` · ${row.blockingGate.length} thuộc làn ${GATE_LANE} (cổng Mốc 3)` : '';
  return `chặn ${row.blocking.length} mục (${shown}${tail})${gate}`;
}

/** Một dòng bản tin cho một hàng. */
export function renderOwnerWaitRow(row: OwnerWaitRow): string {
  const waited = row.waitingDays == null ? 'chưa đo được đã chờ bao lâu' : `đã chờ ${row.waitingDays} ngày`;
  return `- ${row.key} · ${row.what} · ${waited} · ${renderBlocking(row)} · ${row.link}`;
}

/**
 * Khối *"Việc đang chờ anh"* của bản tin, **luôn** gồm dòng đếm — kể cả khi
 * `rows` rỗng. Cùng luật với dòng `Cần anh quyết: N việc` (mục `P-005`): một
 * khối biến mất khi rỗng là một khối mà chủ dự án phải đọc kỹ mới biết nó có
 * hay không, và "không có việc nào chờ anh" là tin đáng nói.
 */
export function renderOwnerWaitingLines(rows: readonly OwnerWaitRow[]): string[] {
  const out = [`Việc đang chờ anh: ${rows.length} việc`];
  for (const row of rows) out.push(renderOwnerWaitRow(row));
  if (rows.length === 0) out.push('- không có việc nào đang chờ anh (không mục backlog nào giữ chỗ vì anh, không `[QĐ] reversible` nào máy không tự làm được)');
  return out;
}
