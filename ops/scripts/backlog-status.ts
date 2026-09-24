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

import { stripAgentPrefix } from './agent-prefix.ts';

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
 * **Lần thứ ba, và lần này đổi cơ chế chứ không thêm chuỗi.** Hai lần trên
 * đều chữa bằng cách **thêm chuỗi con**, và chuỗi con bắt cách viết: chèn đúng
 * một chữ vào giữa là trượt, một cặp dấu nháy ngược quanh `done` cũng trượt.
 * Ba biến thể đo được —
 *
 * | Câu | Chuỗi con trượt vì |
 * |---|---|
 * | "trước khi coi mục này **là** `done`" | `coi mục này done` đòi hai chữ liền nhau |
 * | "mục này chỉ done khi…" (`done` viết trần) | `chỉ \`done\` khi` đòi đúng hai dấu nháy ngược |
 * | "mục này **chưa đóng**, dù PR đã merge" | không chuỗi nào phủ |
 *
 * — nên lưới nay là **mẫu RegExp trên văn bản đã chuẩn hoá**
 * (`normalizeForHold`), có khe cho vài chữ chèn vào giữa. Ca thứ hai tan ngay
 * ở bước chuẩn hoá; hai ca còn lại cần khe chữ.
 *
 * **Vẫn khai thẳng: lưới này KHÔNG hội tụ.** Mẫu rộng hơn chuỗi con, nhưng nó
 * vẫn đoán ý qua cách viết, nên câu thứ tư viết bằng chữ khác nữa vẫn lọt. Đó
 * **không** phải chỗ để vá tiếp — đó là lý do trường `- hold:` tồn tại. Thấy
 * một ca lọt thì khai trường cho mục đó, đừng thêm mẫu.
 *
 * Cố ý KHÔNG nằm trong danh sách: "Chưa làm, cố ý" (`I-003`) — đó là loại
 * trừ phạm vi có chủ ý, không phải phần còn treo.
 */
export const HOLD_MARKERS: readonly RegExp[] = [
  // Ô "còn treo" — quy ước sẵn có của backlog.
  new RegExp(OPEN_BOX, 'u'),
  /còn treo/u,
  /chưa kiểm bằng chạy thật/u,
  // Mẫu ngay dưới bao trọn cả `không đóng khi pr merge` — ca gốc của lưới
  // lần đầu. Khai ở đây thay vì giữ một mẫu riêng: một mẫu không bài nào
  // ghim là chỗ lần sau có người sửa mà không biết mình sửa gì (`I-021`).
  // "chỉ đóng khi…" · "chưa đóng, dù PR đã merge" · "không đóng". Ca thứ hai
  // là biến thể lọt lưới mà `I-020` ghim: chỉ hai chữ, không có `done` nào để
  // neo vào.
  /(?:không|chưa|chỉ) đóng/u,
  // "chỉ chuyển `done`" · "vẫn không tự chuyển `done`" · "chỉ chuyển sang done".
  /(?:tự|chỉ|không) chuyển (?:\p{L}+ ){0,2}done/u,
  // "chỉ `done` khi…" · "chỉ done khi…" · "chỉ là done khi…".
  /chỉ (?:\p{L}+ ){0,2}done khi/u,
  // "coi mục này `done`" · "trước khi coi mục này là `done`" · "xem mục này như done".
  /(?:coi|xem) mục này (?:\p{L}+ ){0,2}done/u,
];

/**
 * Trường `- hold: <lý do>` — khai "còn treo" bằng một **trường** mà tool đọc
 * như đọc `- status:` và `- deps:`, thay vì bằng lời văn. Cơ chế của mục
 * `integration/I-020`.
 *
 * Vì sao cần: `HOLD_MARKERS` dò **chuỗi con** trong thân mục, nên nó bắt
 * *cách viết* chứ không bắt *ý*. Nó đã thủng **hai lần** (`I-010` bốn mục;
 * `KF-023` ba mục), và mỗi lần chỉ vá đúng câu vừa gặp — danh sách chuỗi con
 * KHÔNG hội tụ, câu thứ N viết bằng chữ khác nữa vẫn lọt, và vẫn **không gì
 * đỏ** (nhóm Z). Một mục lật nhầm sang `done` mở khoá một `deps` chưa thật sự
 * xong; `E-001` là ca đắt nhất vì nó là `deps` của cả một nhánh việc.
 *
 * Trường này là **nguồn quyết định** từ nay: có `- hold:` thì mục không bao
 * giờ bị lật, bất kể thân mục viết gì. `HOLD_MARKERS` tụt xuống thành **lưới
 * dự phòng** cho các mục chưa kịp khai trường (`heldReason` trả `'prose'`),
 * và `pnpm backlog:status` in riêng con số đó ra như **nợ phải trả dần**.
 *
 * Khoan dung như `- status:`: cho phép thụt lề, không phân biệt hoa thường,
 * ăn khoảng trắng thừa hai đầu lý do. Lý do **phải không rỗng** — một dòng
 * `- hold:` trống là khai thiếu, không tính là một lời giữ hợp lệ.
 */
const HOLD_FIELD = /^\s*-\s*hold:\s*(\S.*?)\s*$/i;

/**
 * Tập `status` hợp lệ của một mục backlog — `ops/lanes/README.md`, CHARTER
 * 2.1. Nguồn duy nhất, để phép kiểm ở đây không lệch khỏi tài liệu.
 *
 * Vì sao cần một tập **đóng** chứ không chỉ đọc chuỗi: `status` viết sai
 * không làm gì đỏ cả. `readyQueue` chỉ nhìn `status === 'ready'`, còn
 * `reviewFindings` chỉ nhìn `status === 'review'`, nên một mục ghi
 * `status: blocked` rơi qua **cả hai** phép lọc và biến mất khỏi mọi báo
 * cáo — không ở hàng đợi, không ở nhóm nào. Đo được trên `main` lúc nhận
 * mục `I-019`: **5** mục như vậy (`platform` 4, `topic` 1), im lặng từ lúc
 * chúng được viết. Đúng nhóm **Z**: mọi chỉ báo xanh, chỉ hàng đợi việc là
 * sai.
 *
 * Cùng một bài học với nhóm `unknown` của `I-010` ("mục thụt lề sai biến
 * mất khỏi báo cáo"), chỉ khác chỗ hỏng: ở đó dòng `status` không đọc
 * được, ở đây nó đọc được nhưng **giá trị** nằm ngoài tập hợp lệ.
 */
export const VALID_STATUSES: readonly string[] = ['ready', 'claimed', 'review', 'done', 'parked'];

/**
 * Chuỗi này có phải một `status` hợp lệ không.
 *
 * Chuỗi rỗng — mục không khai `status` — trả `false`, nhưng ca đó đã có
 * nhóm riêng (`unknown`, qua `statusLine === null`) nên `classify` xét nó
 * TRƯỚC. Hai nhóm tách nhau có chủ đích: "không khai" và "khai sai" cần hai
 * cách sửa khác nhau.
 */
export function isValidStatus(status: string): boolean {
  return VALID_STATUSES.includes(status);
}

export type ItemVerdict =
  /** Có commit hoàn thành trên `main`, thân mục không còn dấu treo → nên chuyển `done`. */
  | 'stale'
  /** Có commit hoàn thành nhưng thân mục còn dấu treo → cố ý giữ `review`. */
  | 'held'
  /** Chưa thấy commit hoàn thành, hoặc đã bị revert → `review` là đúng. */
  | 'unmerged'
  /** Mục không đọc được `status` — in ra chứ không bỏ qua im lặng. */
  | 'unknown'
  /**
   * Mục đọc được `status` nhưng giá trị nằm NGOÀI `VALID_STATUSES` — cũng
   * in ra, cùng luật cấm im lặng với `unknown` (mục `I-019`).
   */
  | 'invalid-status';

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
  /** Thân mục còn ít nhất một dấu treo bằng LỜI VĂN — xem `HOLD_MARKERS`. Lưới dự phòng, không phải nguồn quyết định. */
  hasHoldMarker: boolean;
  /**
   * Lý do của trường `- hold:` nếu mục có khai, `null` nếu không. Đây là
   * **nguồn quyết định** cho việc giữ `review` (xem `HOLD_FIELD`, `heldReason`).
   */
  holdField: string | null;
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

/**
 * Chuẩn hoá thân mục trước khi dò lưới dự phòng.
 *
 * Ba phép chuẩn hoá, mỗi phép trả lời một ca thật đã lọt:
 *
 * - **bỏ dấu nhấn Markdown** (`` ` ``, `*`, `_`): `` `done` ``, `**done**` và
 *   `done` là **một chữ**. Ca `P-007` lọt lưới chỉ vì hai dấu nháy ngược.
 * - **gộp khoảng trắng**: một câu treo bị ngắt dòng giữa hai chữ vẫn bắt được
 *   — thân mục thật xuống dòng ở cột 100.
 * - **hạ hoa thường**: đã có từ trước, giữ nguyên.
 */
export function normalizeForHold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Thân mục có dấu treo nào không — **lưới dự phòng**, không phải nguồn quyết
 * định. Nguồn quyết định là trường `- hold:` (xem `HOLD_FIELD`, `heldReason`).
 */
export function hasHoldMarker(body: string): boolean {
  const normalized = normalizeForHold(body);
  return HOLD_MARKERS.some((pattern) => pattern.test(normalized));
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

    // Trường `- hold:` — dòng đầu tiên khớp thắng, cùng cách `- status:` lấy
    // dòng đầu. Lý do đã được `HOLD_FIELD` cắt khoảng trắng hai đầu.
    let holdField: string | null = null;
    for (let i = 0; i < body.length; i++) {
      const m = HOLD_FIELD.exec(body[i]!);
      if (m) {
        holdField = m[1]!;
        break;
      }
    }

    return {
      id: start.id,
      title: start.title,
      status,
      hasHoldMarker: hasHoldMarker(body.join('\n')),
      holdField,
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
 *
 * ⚠️ **Tiền tố 🤖 được bỏ trước khi so** (mục `platform/P-042`). `CLAUDE.md`
 * mục 5 bắt buộc mọi thứ agent viết mở đầu bằng 🤖, nên tiêu đề PR đi vào
 * `main` qua squash-merge giữ nguyên tiền tố đó — và neo `^\[` không khớp.
 * Ca thật: `🤖 [platform] P-038 — …` (`#212`), mục không bao giờ được nhận là
 * đã xong, mà không gì đỏ. Luật bỏ tiền tố nằm ở `stripAgentPrefix`, một
 * chỗ, để lần sau không phải vá thêm một bộ đọc nữa.
 *
 * Hai chỗ chặt trên **không** bị nới theo: sau khi bỏ tiền tố, phần còn lại
 * vẫn phải khớp đúng dạng cũ từ ký tự đầu tiên.
 */
export function hasCompletionCommit(lane: string, id: string, subjects: readonly string[]): boolean {
  const pattern = new RegExp(`^\\[${escapeRegExp(lane)}\\]\\s+${escapeRegExp(id)}\\s+[—–-]\\s`);
  return subjects.some((subject) => pattern.test(stripAgentPrefix(subject)));
}

/**
 * Mục đã merge rồi bị revert vẫn còn tiêu đề commit gốc trong `git log`, nên
 * `hasCompletionCommit` một mình sẽ nói "đã xong". CLAUDE.md mục 13 ("`main`
 * đỏ thì revert ngay") làm ca này có thật, không phải giả định.
 *
 * ⚠️ Hàm này **cũng** cần `stripAgentPrefix` (mục `P-042`), và lý do đáng
 * đọc kỹ vì nó suýt bị bỏ sót: phép tìm **mã mục** dùng `includes` nên đúng
 * là miễn nhiễm với tiền tố, nhưng phép nhận diện **chữ `Revert`** lại neo ở
 * vị trí 0. Hai hình dạng revert có thật, và trước bản sửa chỉ một trong hai
 * được bắt:
 *
 * - `Revert "🤖 [platform] P-038 — …"` — GitHub bọc tiêu đề gốc, khớp.
 * - `🤖 Revert "[platform] P-038 — …"` — agent tự viết tiêu đề PR revert,
 *   mà `CLAUDE.md` mục 5 bắt buộc mở đầu bằng 🤖, nên **không** khớp.
 *
 * Bỏ sót ca thứ hai là fail-open **nguy hiểm hơn** chính lỗi mà `P-042` sửa:
 * `hasCompletionCommit` nay nhận tiêu đề có tiền tố, nên một mục đã bị revert
 * khỏi `main` sẽ được lật sang `done` và mở khoá mọi `deps` trỏ vào code
 * không còn tồn tại. Đúng chỗ hỏng mà khối chú thích trên vừa nói nó sinh ra
 * để chặn.
 *
 * Luật cố ý thô và lệch về hướng an toàn: thấy **bất cứ** commit `Revert`
 * nào nhắc tới tiêu đề của mục thì coi như chưa xong, không xét thứ tự thời
 * gian. Mục được revert rồi làm lại sẽ bị giữ thêm một nhịp và hiện ra ở
 * nhóm `unmerged` để người đọc gỡ tay — rẻ hơn nhiều so với mở khoá một
 * `deps` đã bị revert khỏi `main`.
 */
export function hasRevertCommit(lane: string, id: string, subjects: readonly string[]): boolean {
  const marker = `[${lane}] ${id} `;
  return subjects.some(
    (subject) => stripAgentPrefix(subject).startsWith('Revert ') && subject.includes(marker),
  );
}

/** Vì sao một mục đang được giữ `review`: bằng trường `- hold:` hay chỉ bằng lời văn. */
export type HeldBy =
  /** Có trường `- hold:` — nguồn quyết định, mục không bao giờ bị lật. */
  | 'field'
  /** Không có trường, chỉ dính `HOLD_MARKERS` — lưới dự phòng, và là **nợ** cần khai trường. */
  | 'prose';

/**
 * Mục có đang được giữ không, và nếu có thì bằng cách nào. Trường `- hold:`
 * (nguồn quyết định) thắng lời văn; không có cả hai thì trả `null`.
 *
 * Nhận `Pick` để test dựng object gọn được, và để `undefined`/`''` của trường
 * (mục cũ chưa khai) đều rơi về lưới lời văn thay vì kích hoạt nhầm.
 */
export function heldReason(item: Pick<BacklogItem, 'holdField' | 'hasHoldMarker'>): HeldBy | null {
  if (item.holdField != null && item.holdField !== '') return 'field';
  if (item.hasHoldMarker) return 'prose';
  return null;
}

export function classify(item: BacklogItem, merged: boolean): ItemVerdict {
  if (item.statusLine === null) return 'unknown';
  // Trước MỌI phép suy khác: một `status` ngoài tập hợp lệ thì ba nhóm
  // `stale`/`held`/`unmerged` đều không có nghĩa cho mục đó, và im lặng xếp
  // nó vào một trong ba sẽ giấu luôn chỗ viết sai (mục `I-019`).
  if (!isValidStatus(item.status)) return 'invalid-status';
  if (!merged) return 'unmerged';
  return heldReason(item) !== null ? 'held' : 'stale';
}

export interface StatusFinding {
  lane: string;
  id: string;
  verdict: ItemVerdict;
  /** Chỉ đặt khi `verdict === 'held'`: mục được giữ bằng trường hay bằng lời văn. */
  heldBy?: HeldBy;
}

/**
 * Soát một làn.
 *
 * Mục đang ở `review` là mục có gì để nói. Cộng thêm **hai** ca im lặng,
 * cả hai đều là nhóm Z:
 *
 * - mục **không đọc được `status`** → nhóm `unknown` (`I-010`): một mục
 *   thụt lề sai biến mất khỏi báo cáo;
 * - mục có `status` **ngoài `VALID_STATUSES`** → nhóm `invalid-status`
 *   (`I-019`): `readyQueue` lọc theo `'ready'` và hàm này lọc theo
 *   `'review'`, nên `status: blocked` rơi qua cả hai và không nhóm nào
 *   nhận. Không lọc nó đi ở đây nữa.
 */
export function reviewFindings(
  lane: string,
  content: string,
  subjects: readonly string[],
): StatusFinding[] {
  return parseBacklog(content)
    .filter(
      (item) => item.status === 'review' || item.statusLine === null || !isValidStatus(item.status),
    )
    .map((item) => {
      const verdict = classify(
        item,
        hasCompletionCommit(lane, item.id, subjects) && !hasRevertCommit(lane, item.id, subjects),
      );
      const finding: StatusFinding = { lane, id: item.id, verdict };
      if (verdict === 'held') finding.heldBy = heldReason(item) ?? undefined;
      return finding;
    });
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

/** Một mục trong đồ thị phụ thuộc — dựng chung cho `dependencyCycles` và `readyQueue`. */
interface IndexedItem {
  lane: string;
  id: string;
  satisfied: boolean;
  duplicate: boolean;
  /** Mã mục của từng phần phụ thuộc đọc được. `null` (đoạn không tra được) đã bị loại. */
  depIds: string[];
}

/**
 * Chỉ mục mã mục → mục, dùng chung cho mọi phép đọc `deps`.
 *
 * Tách ra khỏi `readyQueue` để `dependencyCycles` không phải dựng lại một
 * bản thứ hai: hai chỉ mục lệch nhau một luật (quy ước `VF-`, luật mã trùng)
 * là đúng cách hai câu trả lời cho cùng một backlog bắt đầu đá nhau.
 */
function indexItems(backlogs: readonly LaneBacklog[], subjects: readonly string[]): {
  index: Map<string, IndexedItem>;
  duplicateIds: string[];
} {
  const index = new Map<string, IndexedItem>();
  const duplicateIds: string[] = [];

  for (const { lane, content } of backlogs) {
    for (const item of parseBacklog(content)) {
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
        depIds: (item.deps ?? []).flatMap((dep) => (dep.id === null ? [] : [dep.id])),
      });
    }
  }

  return { index, duplicateIds };
}

/** `deps: G7` trỏ tới mục `verify/VF-G7` — quy ước đang dùng thật trong backlog. */
const resolve = (index: Map<string, IndexedItem>, id: string): IndexedItem | undefined =>
  index.get(id) ?? index.get(`VF-${id}`);

/** `lane/id` — mã mục THẬT, dạng người đọc tìm được mục mà không cần biết quy ước rút gọn. */
const itemKey = (item: IndexedItem): string => `${item.lane}/${item.id}`;

/**
 * Vòng phụ thuộc trong backlog — mục `I-019`.
 *
 * Vì sao cần: một vòng làm mọi mục trên vòng chờ nhau **vĩnh viễn**, và
 * `readyQueue` một mình không nói ra được. Nó xếp cả hai mục vào `blocked`
 * kèm đúng một dòng "đang chờ mục kia", giống hệt một mục đang chờ một
 * nền móng thật sắp xong — nên đọc báo cáo không phân biệt được "chờ một
 * nhịp" với "chờ mãi mãi". Ca thật nằm trên `main` lúc nhận mục này:
 * `release/R-002` ghi `deps: R-001, G6` còn `verify/VF-G6` ghi
 * `deps: R-002`. Nhóm **Z**.
 *
 * Trả về mỗi vòng một chuỗi đã đóng, dạng
 * `release/R-002 → verify/VF-G6 → release/R-002`: lặp lại mục đầu ở cuối để
 * đọc một dòng là thấy nó khép kín, không phải tự nối.
 *
 * Ba luật, cùng hướng thận trọng với phần còn lại của file:
 *
 * 1. **Mọi mục đều là đỉnh**, không chỉ mục `ready`. Một vòng đi qua một
 *    mục `parked` vẫn là một vòng, và nó sẽ chặn đúng lúc mục đó mở lại.
 * 2. **Mã trùng giữa hai làn bị loại khỏi cạnh.** `deps: <mã>` lúc đó không
 *    xác định trỏ mục nào, nên vẽ một cạnh là đoán — và một vòng báo sai là
 *    một phép kiểm bị tắt. Mã trùng đã có nhóm `duplicateIds` riêng.
 * 3. **Đoạn `deps` không tra được không sinh cạnh.** Nó đã hiện ra ở
 *    `blocked` kèm lý do; đoán một mục từ lời văn là đoán.
 *
 * ## Giới hạn đã khai, không giấu
 *
 * Phép duyệt là DFS ba màu, nên nó bắt **mọi mục nằm trên một vòng** nhưng
 * với hai vòng chồng nhau (chung cạnh) nó chỉ in ra vòng đi qua cạnh lùi
 * nó gặp, không liệt kê đủ mọi vòng con. Đủ cho việc mục này cần — chỉ ra
 * chỗ phải cắt — và cắt một vòng rồi chạy lại sẽ lộ vòng còn lại. Liệt kê
 * đủ mọi vòng là bài toán khác hẳn về giá, chưa ca nào đòi. Hai vòng **rời
 * nhau** thì ra đủ cả hai, và có bài khoá.
 *
 * Chỗ thứ hai, mạnh hơn luật 2 ở trên nên phải nói riêng: khi hai mục dùng
 * chung một mã, `indexItems` chỉ giữ mục **gặp trước** và đánh dấu nó
 * `duplicate`; mục **thứ hai không bao giờ vào chỉ mục**, nên `deps` của
 * chính nó không sinh cạnh nào cả — một vòng đi qua mục thứ hai sẽ im
 * lặng. Repo đang có đúng ca này (`platform/P-028`, hai mục khác nhau cùng
 * mã, có sẵn trên `main`). Chỗ chặn đúng là dẹp mã trùng — nó đã hiện ra ở
 * nhóm `duplicateIds` chứ không im lặng — chứ không phải nới luật ở đây:
 * đoán `deps: <mã>` trỏ mục nào là đoán, và một vòng báo sai làm người đọc
 * cắt nhầm.
 */
export function dependencyCycles(backlogs: readonly LaneBacklog[]): string[] {
  // `subjects` không ảnh hưởng tới cạnh của đồ thị (một `deps` đã xong vẫn
  // là một cạnh), nên truyền rỗng thay vì bắt bên gọi đọc lịch sử `main`.
  const { index } = indexItems(backlogs, []);

  const GREY = 1;
  const BLACK = 2;
  const state = new Map<string, number>();
  const stack: string[] = [];
  const seen = new Set<string>();
  const cycles: string[] = [];

  /** Xoay vòng cho mục nhỏ nhất đứng đầu, để cùng một vòng luôn ra cùng một chuỗi. */
  const record = (path: readonly string[]): void => {
    const keys = path.map((id) => itemKey(index.get(id)!));
    let pivot = 0;
    for (let i = 1; i < keys.length; i++) if (keys[i]! < keys[pivot]!) pivot = i;
    const rotated = [...keys.slice(pivot), ...keys.slice(0, pivot)];
    const rendered = [...rotated, rotated[0]!].join(' → ');
    if (seen.has(rendered)) return;
    seen.add(rendered);
    cycles.push(rendered);
  };

  const visit = (id: string): void => {
    state.set(id, GREY);
    stack.push(id);
    for (const depId of index.get(id)!.depIds) {
      const target = resolve(index, depId);
      if (target === undefined || target.duplicate) continue;
      const color = state.get(target.id);
      if (color === GREY) {
        record(stack.slice(stack.indexOf(target.id)));
      } else if (color !== BLACK) {
        visit(target.id);
      }
    }
    stack.pop();
    state.set(id, BLACK);
  };

  for (const [id, item] of index) {
    if (item.duplicate) continue;
    if (state.get(id) === undefined) visit(id);
  }

  return cycles;
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
): { readyNow: QueueEntry[]; blocked: QueueEntry[]; duplicateIds: string[]; cycles: string[] } {
  const { index, duplicateIds } = indexItems(backlogs, subjects);

  const readyNow: QueueEntry[] = [];
  const blocked: QueueEntry[] = [];

  for (const { lane, content } of backlogs) {
    for (const item of parseBacklog(content)) {
      if (item.status !== 'ready') continue;

      const waitingOn: string[] = [];
      if (item.deps === null) waitingOn.push('không khai `deps`');
      for (const dep of item.deps ?? []) {
        if (dep.id === null) {
          waitingOn.push(`${dep.raw} (không tra được)`);
          continue;
        }
        const target = resolve(index, dep.id);
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
        if (!target.satisfied) waitingOn.push(itemKey(target));
      }

      const entry: QueueEntry = { lane, id: item.id, title: item.title, waitingOn };
      (waitingOn.length === 0 ? readyNow : blocked).push(entry);
    }
  }

  // Vòng phụ thuộc đi cùng hàng đợi chứ không đứng riêng: mục trên một vòng
  // luôn nằm trong `blocked`, và bên đọc phải thấy ngay dòng `blocked` nào
  // là "chờ một nhịp" còn dòng nào là "chờ mãi mãi" (mục `I-019`).
  return { readyNow, blocked, duplicateIds, cycles: dependencyCycles(backlogs) };
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
    // Phòng thủ theo tầng (mục `I-020`): dù bên gọi có lỡ truyền vào một mục
    // đang được giữ, applyFix vẫn KHÔNG lật. Trường `- hold:` (nguồn quyết
    // định) và lưới lời văn đều chặn ở đây, không chỉ ở `classify`.
    if (heldReason(item) !== null) continue;
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
  const { readyNow, blocked, duplicateIds, cycles } = readyQueue(backlogs, subjects);

  const by = (verdict: ItemVerdict) =>
    findings.filter((f) => f.verdict === verdict).map((f) => `${f.lane}/${f.id}`);
  const heldByOutput = (heldBy: HeldBy) =>
    findings.filter((f) => f.verdict === 'held' && f.heldBy === heldBy).map((f) => `${f.lane}/${f.id}`);

  // `heldByField` là mục đã khai trường `- hold:`; `heldByProse` là mục còn
  // dựa vào lưới lời văn — con số thứ hai là **nợ**: mỗi mục ở đó là một chỗ
  // `HOLD_MARKERS` có thể thủng ở lần viết khác đi (mục `I-020`). Trả về 0 là
  // đã khai trường hết. `held` giữ lại làm tổng hai nhóm cho bên đọc cũ.
  process.stdout.write(
    `${JSON.stringify(
      {
        stale: by('stale'),
        held: by('held'),
        heldByField: heldByOutput('field'),
        heldByProse: heldByOutput('prose'),
        unmerged: by('unmerged'),
        unknown: by('unknown'),
        // `invalidStatus` và `cycles` là hai nhóm của mục `I-019`. Cả hai
        // in ra KỂ CẢ khi rỗng — một mảng rỗng là "đã quét, không thấy gì",
        // khác hẳn một khoá vắng mặt, và cấm im lặng là chính luật mà hai
        // nhóm này sinh ra để giữ.
        invalidStatus: by('invalid-status'),
        cycles,
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
