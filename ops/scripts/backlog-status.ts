/**
 * Đối chiếu `status:` trong backlog với những gì đã thật sự vào `main` —
 * cơ chế của mục `I-010` (`ops/lanes/integration/backlog.md`).
 *
 * Vì sao mục này tồn tại:
 *
 * `ops/lanes/README.md` định nghĩa `deps` là "các mục phải `done` trước".
 * Phụ lục P1 bước 7 đặt mục sang `review` trong chính PR của nó. Nhưng
 * **không bước nào** trong P1, P2 hay P3 đặt nó sang `done` sau khi PR
 * merge. Kết quả đo trên `main` ở `61fb084`: **15** mục đã merge còn nằm
 * `review`, và mọi mục có `deps` đứng chờ vĩnh viễn — kể cả ba mục `ready`
 * của làn `integration`, làn ưu tiên số một.
 *
 * Đó là **nhóm lỗi Z** (`ops/known-failures.md`): hỏng mà mọi chỉ báo đều
 * xanh. CI xanh, PR merge đẹp, backlog đọc vẫn hợp lệ — chỉ hàng đợi việc
 * là cạn, và nó chỉ lộ ra khi một người đọc tay từng `deps`.
 *
 * Hai luật thiết kế, cả hai đều là chỗ dễ làm sai:
 *
 * 1. **Thận trọng theo đúng một hướng.** Chỉ coi một mục là `stale` (nên
 *    chuyển `done`) khi có commit tiêu đề `[<lane>] <id> — …` trên `main`,
 *    KHÔNG có commit `Revert` nào của nó, VÀ thân mục không còn dấu treo nào
 *    (`HOLD_MARKERS` — cả ký hiệu `⬜` lẫn lời văn). Đoán sai theo hướng giữ
 *    lại chỉ tốn thêm một nhịp và vẫn in ra ở nhóm `held`; đoán sai theo
 *    hướng kia mở khoá một `deps` chưa thật sự xong, và cái đó không có gì
 *    bắt được.
 *
 * 2. **Không phải cổng của `pnpm check`.** Ngay sau khi một PR merge, mục
 *    của nó còn `review` trong đúng một nhịp — đó là trạng thái ĐÚNG, không
 *    phải lỗi. Đặt cổng cứng ở đây sẽ làm `main` đỏ sau **mỗi** lần merge,
 *    tức là tự tạo ra một nhóm lỗi mới để chữa một nhóm lỗi cũ. Việc này
 *    thuộc bước "Dọn dẹp" của integrator (phụ lục P3 bước 2), cạnh
 *    `reap-abandoned-drafts.ts` — cùng hình dạng, cùng nhịp.
 *
 * Vì sao đối chiếu bằng **tiêu đề commit** chứ không bằng API GitHub: tool
 * này chạy được trong `pnpm check` local và trong một lượt worker không có
 * mạng, và tiêu đề commit là thứ `automerge.yml` sinh ra từ chính tiêu đề
 * PR, tức là cùng một quy ước tên mà phụ lục P1 bước 4 bắt buộc. Commit
 * chỉ *nhắc* mã mục trong ngoặc (`… (KF-005, P-015)`) **không** tính là
 * hoàn thành — đó là PR của mục khác có chạm tới, và `P-015` là ca thật
 * đang nằm trên `main`.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ô "còn treo" — quy ước sẵn có của backlog cho phần chưa xong. */
export const OPEN_BOX = '⬜';

/**
 * Dấu hiệu "mục này CHƯA được đóng, kể cả khi PR đã merge".
 *
 * Ô `⬜` **không** phải quy ước duy nhất, và tin rằng nó là duy nhất đã suýt
 * làm hỏng đúng cái mà tool này sinh ra để bảo vệ: vòng soát chéo bắt được
 * bốn mục (`P-011`, `P-013`, `P-016`, `I-002`) bị lật sang `done` trong khi
 * chính thân mục ghi thẳng bằng lời — "mục này chỉ đóng khi có xác nhận đó,
 * **không đóng khi PR merge**". Ba trong bốn mục đó là **cổng**: `P-011`
 * chặn DoD Đợt 0, `P-013` là cổng của giả định `G16`, `P-016` là cổng của
 * hàng đợi merge. Lật chúng thành `done` là mở khoá một `deps` chưa thật sự
 * xong — đúng hướng sai mà không có gì bắt được.
 *
 * Vì vậy luật đọc **cả lời lẫn ký hiệu**. Thà giữ lại nhầm một mục đã xong
 * (tốn một nhịp, và `held` được in ra để người đọc thấy) còn hơn mở khoá
 * nhầm một mục chưa xong.
 *
 * **Lần thứ hai, cùng một chữ ký lỗi.** Lượt `crux-worker-1` ~21:48Z
 * 2026-09-23 chạy `--fix` trên `main` ở `402444b` và lật ba mục nữa mà thân
 * mục cấm đúng việc đó — `E-001`, `P-010`, `P-007`. Cả ba nói cùng một ý như
 * bốn ca trên, chỉ khác chữ:
 *
 * | Mục | Câu trong thân mục | Vì sao lọt |
 * |---|---|---|
 * | `E-001` | "mục này vẫn **không** tự chuyển `done`" | có `chỉ chuyển \`done\``, không có `tự chuyển \`done\`` |
 * | `P-010` | "phải đọc đúng lần chạy thật đó **trước khi coi mục này `done`**" | không chuỗi nào phủ |
 * | `P-007` | "mục này **chỉ `done` khi** bản tin thật in ra…" | có `chỉ đóng khi`, không có `chỉ \`done\` khi` |
 *
 * `E-001` là ca đắt nhất: nó là `deps` của `E-003`, `E-004`, rồi `E-005`, nên
 * lật nhầm nó mở khoá cả một nhánh việc chưa được phép chạy — đúng hướng sai
 * mà khối trên đã cảnh báo, lặp lại nguyên si.
 *
 * CLAUDE.md mục 13 ("lỗi cùng loại lần thứ hai → sửa cơ chế, không vá sản
 * phẩm") nên ba chuỗi dưới đây được thêm vào danh sách, chứ không sửa tay ba
 * dòng `status`. Ba ca thật ở trên là ba bài kiểm, nằm ở
 * `ops/test/backlog-status.test.ts`.
 *
 * Cố ý KHÔNG nằm trong danh sách: "Chưa làm, cố ý" (`I-003`) — đó là loại
 * trừ phạm vi có chủ ý, không phải phần còn treo.
 */
export const HOLD_MARKERS: readonly string[] = [
  OPEN_BOX,
  'không đóng khi pr merge',
  'chỉ chuyển `done`',
  'chỉ đóng khi',
  'chưa kiểm bằng chạy thật',
  'còn treo',
  // Ba chuỗi dưới đây đo từ ba ca thật `E-001`, `P-010`, `P-007` — xem bảng
  // trong khối chú thích ngay trên. Chuỗi thứ ba cố ý BỎ hai chữ "trước khi"
  // của câu gốc: phần mang nghĩa nằm ở đoạn sau, và giữ nguyên cả câu là vá
  // đúng MỘT ca — nó trượt ngay ở "đừng coi mục này `done`". Nới về hướng
  // giữ lại là hướng an toàn (xem khối chú thích trên).
  'tự chuyển `done`',
  'chỉ `done` khi',
  'coi mục này `done`',
];

export type ItemVerdict =
  /** Có commit hoàn thành trên `main`, thân mục không còn dấu treo → nên chuyển `done`. */
  | 'stale'
  /** Có commit hoàn thành nhưng thân mục còn dấu treo → cố ý giữ `review`. */
  | 'held'
  /** Chưa thấy commit hoàn thành, hoặc đã bị revert → `review` là đúng. */
  | 'unmerged'
  /** Mục không đọc được `status` — in ra chứ không bỏ qua im lặng. */
  | 'unknown';

export interface BacklogItem {
  id: string;
  status: string;
  /**
   * Tên mục — phần còn lại của dòng `### <id> · <tên>`, đã bỏ dấu `·` và
   * khoảng trắng hai đầu. Chuỗi rỗng nếu tiêu đề chỉ có mã mục.
   *
   * Thêm cho mục `platform/P-005` (bản tin ngày cần một dòng đọc được cho
   * mỗi mục `parked`), đặt ở đây thay vì tách lại tiêu đề ở bên gọi: một
   * định nghĩa "mục backlog" cho cả repo.
   */
  title: string;
  /** Thân mục còn ít nhất một dấu treo — xem `HOLD_MARKERS`. */
  hasHoldMarker: boolean;
  /** Dòng `- status: …`, hoặc `null` nếu mục không khai `status`. */
  statusLine: number | null;
  /**
   * Dòng `- deps: …` đã tách thành từng phần phụ thuộc. Mảng rỗng nghĩa là
   * `- deps: —`, tức không chờ ai.
   *
   * `null` nghĩa là mục **không khai** `deps` — ca khác hẳn, và cố ý không
   * gộp vào mảng rỗng. `DEPS` neo ở cột 0, nên một dòng `deps` thụt lề sai
   * sẽ biến mất; gộp hai ca lại thì mục đó **tự mở khoá im lặng**, đúng
   * nhóm lỗi Z mà `I-015` chữa. Đối xứng với `statusLine: null`.
   */
  deps: DepRef[] | null;
}

/** Một phần phụ thuộc trong dòng `- deps:`. */
export interface DepRef {
  /** Đoạn nguyên văn — giữ lại để báo cáo đúng chỗ không tra được. */
  raw: string;
  /** Mã mục tra ra từ đoạn đó, hoặc `null` khi đoạn không chứa mã nào. */
  id: string | null;
}

const HEADING = /^###\s+(\S+)([^\n]*)$/;
const STATUS = /^-\s*status:\s*(\S+)\s*$/;
const DEPS = /^-\s*deps:\s*(.*)$/;

/**
 * Mã mục như backlog đang viết thật: `T-001`, `V-004b`, `AU-004`, `VF-G17`,
 * và mã giả định trần `G7` (dạng `audio/AU-001` đang dùng).
 *
 * Cố ý KHÔNG khớp `D-C06` (mã quyết định) hay ngày `2026-09-21`: cả hai đều
 * xuất hiện trong thân mục, và khớp nhầm một trong hai sẽ sinh ra một phần
 * phụ thuộc không bao giờ tra được, tức một mục không bao giờ nhận được.
 */
const ITEM_CODE = /\b(?:[A-Z]{1,3}-G\d+|[A-Z]{1,3}-\d+[a-z]?|G\d+)\b/g;

/** Thân mục có dấu treo nào không. So không phân biệt hoa thường. */
export function hasHoldMarker(body: string): boolean {
  const lowered = body.toLowerCase();
  return HOLD_MARKERS.some((marker) => lowered.includes(marker));
}

/**
 * Tách giá trị của dòng `- deps:` thành từng phần phụ thuộc.
 *
 * Hai luật, cả hai đều rút ra từ cách backlog đang viết thật chứ không từ
 * một quy ước lý tưởng:
 *
 * 1. **Chỉ cắt ở dấu phẩy.** `visual/V-004` ghi
 *    `- deps: V-003 · bộ công cụ đã có ở …` — dấu `·` ở đó ngăn mã mục với
 *    lời giải thích, không ngăn hai phần phụ thuộc. Cắt ở `·` sẽ sinh ra một
 *    đoạn toàn lời văn, không tra được, và `V-004` sẽ chờ vĩnh viễn.
 * 2. **Mỗi đoạn lấy MỌI mã trong đoạn**, không phải mã đầu tiên. Một đoạn
 *    viết `I-013 và I-014` phải ra hai phần phụ thuộc: chỉ lấy mã đầu là
 *    lệch về hướng nguy hiểm — mở khoá một mục trong khi một nền móng khác
 *    của nó chưa xong. Đoạn chỉ có một mã kèm lời giải thích vẫn ra đúng
 *    một phần, nên lời giải thích không ảnh hưởng gì.
 *
 * Đoạn không chứa mã nào giữ `id: null` — bên gọi coi đó là **chưa xong**
 * chứ không bỏ qua, xem `readyQueue`.
 */
export function parseDeps(value: string): DepRef[] {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /^[—–-]$/.test(trimmed)) return [];

  return trimmed
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap((segment): DepRef[] => {
      const codes = [...segment.matchAll(ITEM_CODE)].map((m) => m[0]);
      // Đoạn không có mã nào vẫn ra MỘT phần phụ thuộc, `id: null` — bên
      // gọi coi là chưa xong và in lý do ra. Đoạn có nhiều mã ra NHIỀU
      // phần: lấy mỗi mã đầu tiên là lệch về hướng nguy hiểm (mở khoá một
      // mục trong khi một nền móng khác của nó chưa xong).
      if (codes.length === 0) return [{ raw: segment, id: null }];
      return codes.map((id) => ({ raw: segment, id }));
    });
}

/**
 * Tách `ops/lanes/<lane>/backlog.md` thành các mục.
 *
 * Mục bắt đầu ở `### <id> ` và kết thúc ngay trước `###` kế tiếp. Không
 * đoán gì thêm: mục không có dòng `status` thì `statusLine` là `null` và
 * `status` là chuỗi rỗng, để bên gọi thấy chứ không im lặng bỏ qua.
 */
export function parseBacklog(content: string): BacklogItem[] {
  const lines = content.split('\n');
  const starts: Array<{ id: string; title: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]!);
    if (m) starts.push({ id: m[1]!, title: m[2]!.replace(/^\s*[·•]?\s*/, '').trim(), line: i });
  }

  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1]!.line : lines.length;
    const body = lines.slice(start.line, end);

    let statusLine: number | null = null;
    let status = '';
    for (let i = 0; i < body.length; i++) {
      const m = STATUS.exec(body[i]!);
      if (m) {
        statusLine = start.line + i;
        status = m[1]!;
        break;
      }
    }

    let deps: DepRef[] | null = null;
    for (const line of body) {
      const m = DEPS.exec(line);
      if (m) {
        deps = parseDeps(m[1]!);
        break;
      }
    }

    return {
      id: start.id,
      title: start.title,
      status,
      hasHoldMarker: hasHoldMarker(body.join('\n')),
      statusLine,
      deps,
    };
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Commit tiêu đề `[<lane>] <id> — …` trên `main` là dấu hiệu mục đã hoàn
 * thành. Hai chỗ chặt có lý do:
 *
 * - **Mã mục phải đứng trọn.** `VF-G1` không được khớp tiêu đề của
 *   `VF-G11`, nên sau mã mục bắt buộc có khoảng trắng.
 * - **Phải đúng dạng tiêu đề**, tức `[<lane>] <id>` ở ĐẦU dòng rồi tới dấu
 *   gạch. Commit nhắc mã mục ở giữa câu hay trong ngoặc là PR của mục khác.
 */
export function hasCompletionCommit(lane: string, id: string, subjects: readonly string[]): boolean {
  const pattern = new RegExp(`^\\[${escapeRegExp(lane)}\\]\\s+${escapeRegExp(id)}\\s+[—–-]\\s`);
  return subjects.some((subject) => pattern.test(subject));
}

/**
 * Mục đã merge rồi bị revert vẫn còn tiêu đề commit gốc trong `git log`, nên
 * `hasCompletionCommit` một mình sẽ nói "đã xong". CLAUDE.md mục 13 ("`main`
 * đỏ thì revert ngay") làm ca này có thật, không phải giả định.
 *
 * Luật cố ý thô và lệch về hướng an toàn: thấy **bất cứ** commit `Revert`
 * nào nhắc tới tiêu đề của mục thì coi như chưa xong, không xét thứ tự thời
 * gian. Mục được revert rồi làm lại sẽ bị giữ thêm một nhịp và hiện ra ở
 * nhóm `unmerged` để người đọc gỡ tay — rẻ hơn nhiều so với mở khoá một
 * `deps` đã bị revert khỏi `main`.
 */
export function hasRevertCommit(lane: string, id: string, subjects: readonly string[]): boolean {
  const marker = `[${lane}] ${id} `;
  return subjects.some((subject) => subject.startsWith('Revert ') && subject.includes(marker));
}

export function classify(item: BacklogItem, merged: boolean): ItemVerdict {
  if (item.statusLine === null) return 'unknown';
  if (!merged) return 'unmerged';
  return item.hasHoldMarker ? 'held' : 'stale';
}

export interface StatusFinding {
  lane: string;
  id: string;
  verdict: ItemVerdict;
}

/**
 * Soát một làn.
 *
 * Mục đang ở `review` là mục có gì để nói. Cộng thêm mục **không đọc được
 * `status`** — nó ra nhóm `unknown` chứ không bị lọc đi im lặng, vì một mục
 * thụt lề sai biến mất khỏi báo cáo là đúng nhóm lỗi Z mà tool này chữa.
 */
export function reviewFindings(
  lane: string,
  content: string,
  subjects: readonly string[],
): StatusFinding[] {
  return parseBacklog(content)
    .filter((item) => item.status === 'review' || item.statusLine === null)
    .map((item) => ({
      lane,
      id: item.id,
      verdict: classify(
        item,
        hasCompletionCommit(lane, item.id, subjects) && !hasRevertCommit(lane, item.id, subjects),
      ),
    }));
}

/** Một làn cộng nội dung backlog của nó — đầu vào của `readyQueue`. */
export interface LaneBacklog {
  lane: string;
  content: string;
}

/** Một mục `ready` cộng danh sách nó còn đang chờ. */
export interface QueueEntry {
  lane: string;
  id: string;
  title: string;
  /** Phần phụ thuộc chưa xong, đã viết thành chuỗi đọc được. Rỗng = nhận được ngay. */
  waitingOn: string[];
}

/**
 * Mục này đã xong **thật** chưa, theo nghĩa một `deps` trỏ vào nó được mở
 * khoá?
 *
 * Hai ca tính là xong:
 *
 * - `status: done` — không phải bàn.
 * - `status: review` mà `classify` xếp vào `stale` — tức có commit hoàn
 *   thành trên `main`, không bị revert, và thân mục không còn dấu treo. Mục
 *   đó đã vào `main` thật; giữ nó chặn `deps` chỉ vì chưa ai chạy
 *   `--fix` chính là nhóm lỗi Z mà `I-010` và `I-015` chữa.
 *
 * Mọi ca khác — `ready`, `parked`, `review` còn `held`, mục không đọc được
 * `status` — đều là **chưa xong**. Lệch về hướng này có giá một nhịp chờ;
 * lệch về hướng kia nhận một mục mà nền móng của nó chưa có.
 */
function isSatisfied(item: BacklogItem, lane: string, subjects: readonly string[]): boolean {
  if (item.status === 'done') return true;
  if (item.status !== 'review') return false;
  const merged =
    hasCompletionCommit(lane, item.id, subjects) && !hasRevertCommit(lane, item.id, subjects);
  return classify(item, merged) === 'stale';
}

/**
 * Trả lời đúng câu hỏi bước 3 của phụ lục P1 hỏi: **mục nào nhận được ngay**.
 *
 * Vì sao cần một lệnh cho việc này, chứ không để worker đọc tay: `I-010`
 * dựng được phép đo "mục nào nên chuyển `done`" nhưng dừng ở đó, nên worker
 * vẫn phải tự đối chiếu từng dòng `deps` bằng mắt. Lượt `crux-worker-1`
 * ngày 2026-09-22 suýt in `idle` trong khi `topic/T-003` và `editorial/E-003`
 * đều đã nhận được — `deps` của chúng (`T-001`, `E-001`) đã vào `main` mà
 * backlog còn đọc là `review`. Hàng đợi **cạn giả**, và mọi chỉ báo vẫn xanh.
 *
 * Kết quả KHÔNG xếp theo `ops/lanes/priority.md`: thứ tự giữa các làn là
 * việc chủ dự án chỉnh bằng tay trong file đó, và đọc nó ở đây sẽ biến một
 * bảng người-sửa thành một phép phân tích cú pháp dễ vỡ. Lệnh này trả lời
 * phần máy trả lời được (`deps` đã xong chưa); worker vẫn duyệt theo thứ tự
 * của `priority.md` và vẫn tự kiểm "đã có nhánh hay PR mở chưa" — câu đó
 * cần mạng, không nằm trong kho.
 */
export function readyQueue(
  backlogs: readonly LaneBacklog[],
  subjects: readonly string[],
): { readyNow: QueueEntry[]; blocked: QueueEntry[]; duplicateIds: string[] } {
  const parsed = backlogs.map((backlog) => ({
    lane: backlog.lane,
    items: parseBacklog(backlog.content),
  }));

  const index = new Map<string, { lane: string; id: string; satisfied: boolean; duplicate: boolean }>();
  const duplicateIds: string[] = [];
  for (const { lane, items } of parsed) {
    for (const item of items) {
      const seen = index.get(item.id);
      if (seen !== undefined) {
        // `deps` không phân giải theo làn, nên hai làn dùng chung một mã là
        // ca mở khoá nhầm mà không gì đỏ. In ra để nó không im lặng — VÀ
        // đánh dấu mã đó là trùng.
        //
        // Vì sao đánh dấu chứ không chỉ in: `deps: <mã>` lúc này không xác
        // định trỏ mục nào, nên lấy mục gặp trước mà mở khoá là đoán, và
        // đoán theo đúng hướng nguy hiểm — mục gặp trước `done` thì mục phụ
        // thuộc vào `readyNow` trong khi mục cùng mã ở làn kia còn `ready`.
        // Cùng luật thận trọng một hướng với mọi nhánh khác của hàm này:
        // chưa chắc thì coi là CHƯA xong. Đoán sai theo hướng này tốn một
        // nhịp; đoán sai theo hướng kia nhận một mục mà nền móng chưa có.
        duplicateIds.push(`${seen.lane}/${item.id} ↔ ${lane}/${item.id}`);
        seen.duplicate = true;
        continue;
      }
      index.set(item.id, {
        lane,
        id: item.id,
        satisfied: isSatisfied(item, lane, subjects),
        duplicate: false,
      });
    }
  }

  /** `deps: G7` trỏ tới mục `verify/VF-G7` — quy ước đang dùng thật trong backlog. */
  const lookup = (id: string) => index.get(id) ?? index.get(`VF-${id}`);

  const readyNow: QueueEntry[] = [];
  const blocked: QueueEntry[] = [];

  for (const { lane, items } of parsed) {
    for (const item of items) {
      if (item.status !== 'ready') continue;

      const waitingOn: string[] = [];
      if (item.deps === null) waitingOn.push('không khai `deps`');
      for (const dep of item.deps ?? []) {
        if (dep.id === null) {
          waitingOn.push(`${dep.raw} (không tra được)`);
          continue;
        }
        const target = lookup(dep.id);
        if (target === undefined) {
          waitingOn.push(`${dep.id} (không có mục này)`);
          continue;
        }
        if (target.duplicate) {
          waitingOn.push(`${dep.id} (mã trùng giữa hai làn)`);
          continue;
        }
        // In mã mục THẬT (`verify/VF-G7`), không in mã như `deps` viết
        // (`G7`): người đọc phải tìm được mục đang chặn mà không cần biết
        // quy ước rút gọn.
        if (!target.satisfied) waitingOn.push(`${target.lane}/${target.id}`);
      }

      const entry: QueueEntry = { lane, id: item.id, title: item.title, waitingOn };
      (waitingOn.length === 0 ? readyNow : blocked).push(entry);
    }
  }

  return { readyNow, blocked, duplicateIds };
}

/**
 * Đổi `- status: review` thành `- status: done` cho đúng danh sách `ids`.
 *
 * Chỉ chạm dòng `status` của mục, và chỉ khi nó đang là `review` — mục đã
 * bị ai đó đổi trong lúc chạy thì bỏ qua, không ghi đè.
 */
export function applyFix(
  content: string,
  ids: readonly string[],
): { content: string; changed: string[] } {
  const wanted = new Set(ids);
  const lines = content.split('\n');
  const changed: string[] = [];

  for (const item of parseBacklog(content)) {
    if (!wanted.has(item.id)) continue;
    if (item.status !== 'review' || item.statusLine === null) continue;
    lines[item.statusLine] = '- status: done';
    changed.push(item.id);
  }

  return { content: lines.join('\n'), changed };
}

/**
 * Tiêu đề commit trên `main`. Ưu tiên `origin/main`, lùi về `main` khi chạy
 * ở kho không có remote.
 *
 * **Kho nông (`--depth`) thì NÉM, không trả danh sách cụt.** Đo được trên
 * chính kho này ngày 2026-09-22: phiên cloud clone nông, `git log` chỉ đọc
 * được 50 tiêu đề, và **6** mục đã `done` không thấy commit hoàn thành của
 * mình. Hôm đó vô hại vì cả 6 đều đã `done`; một mục còn `review` mà commit
 * merge của nó rơi ngoài biên nông sẽ bị xếp `unmerged` **im lặng**, và mọi
 * mục phụ thuộc nó biến mất khỏi `readyNow` — đúng "hàng đợi cạn giả" mà
 * `I-015` sinh ra để chữa. Cùng bài học với `I-005`/`I-007`: cấm im lặng
 * lẫn lộn "chưa quét được" với "quét rồi không thấy gì".
 */
export function readMainSubjects(cwd: string = process.cwd()): string[] {
  const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd,
    encoding: 'utf8',
  });
  if (shallow.status === 0 && shallow.stdout.trim() === 'true') {
    throw new Error(
      'kho đang ở dạng nông (shallow): lịch sử `main` không đủ để kết luận mục nào đã merge. ' +
        'Chạy `git fetch --unshallow origin main` rồi gọi lại.',
    );
  }

  for (const ref of ['origin/main', 'main']) {
    const result = spawnSync('git', ['log', '--format=%s', ref], { cwd, encoding: 'utf8' });
    if (result.status === 0) {
      return result.stdout.split('\n').filter((line) => line.length > 0);
    }
  }
  throw new Error('không đọc được lịch sử của origin/main hay main');
}

function laneDirs(lanesRoot: string): string[] {
  return readdirSync(lanesRoot)
    .filter((name) => statSync(join(lanesRoot, name)).isDirectory())
    .sort();
}

function main(): void {
  const fix = process.argv.includes('--fix');
  const cwd = process.cwd();
  const lanesRoot = join(cwd, 'ops', 'lanes');
  const subjects = readMainSubjects(cwd);

  const findings: StatusFinding[] = [];
  const written: string[] = [];
  const backlogs: LaneBacklog[] = [];

  for (const lane of laneDirs(lanesRoot)) {
    const file = join(lanesRoot, lane, 'backlog.md');
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const laneFindings = reviewFindings(lane, content, subjects);
    findings.push(...laneFindings);
    backlogs.push({ lane, content });

    if (!fix) continue;
    const stale = laneFindings.filter((f) => f.verdict === 'stale').map((f) => f.id);
    if (stale.length === 0) continue;
    const { content: next, changed } = applyFix(content, stale);
    if (changed.length === 0) continue;
    writeFileSync(file, next, 'utf8');
    written.push(lane);
  }

  // Đọc hàng đợi trên nội dung TRƯỚC `--fix`: `readyQueue` đã tự coi mục
  // `stale` là xong, nên hai đường cho cùng một câu trả lời — và báo cáo
  // không phụ thuộc vào việc lượt này có chạy `--fix` hay không.
  const { readyNow, blocked, duplicateIds } = readyQueue(backlogs, subjects);

  const by = (verdict: ItemVerdict) =>
    findings.filter((f) => f.verdict === verdict).map((f) => `${f.lane}/${f.id}`);

  process.stdout.write(
    `${JSON.stringify(
      {
        stale: by('stale'),
        held: by('held'),
        unmerged: by('unmerged'),
        unknown: by('unknown'),
        fixed: fix ? by('stale') : [],
        backlogUpdated: written,
        // Kèm tên mục: phụ lục P1 bước 3 đòi dán `readyNow` vào báo cáo khi
        // in `idle`, và một danh sách mã trần không đọc được.
        readyNow: readyNow.map((entry) => `${entry.lane}/${entry.id} — ${entry.title}`),
        duplicateIds,
        blocked: blocked.map((entry) => ({
          item: `${entry.lane}/${entry.id}`,
          waitingOn: entry.waitingOn,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
