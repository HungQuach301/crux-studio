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
  /** Thân mục còn ít nhất một dấu treo bằng LỜI VĂN — xem `HOLD_MARKERS`. Lưới dự phòng, không phải nguồn quyết định. */
  hasHoldMarker: boolean;
  /**
   * Lý do của trường `- hold:` nếu mục có khai, `null` nếu không. Đây là
   * **nguồn quyết định** cho việc giữ `review` (xem `HOLD_FIELD`, `heldReason`).
   */
  holdField: string | null;
  /** Dòng `- status: …`, hoặc `null` nếu mục không khai `status`. */
  statusLine: number | null;
}

const HEADING = /^###\s+(\S+)([^\n]*)$/;
const STATUS = /^-\s*status:\s*(\S+)\s*$/;

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

/** Tiêu đề commit trên `main`. Ưu tiên `origin/main`, lùi về `main` khi chạy ở kho không có remote. */
export function readMainSubjects(cwd: string = process.cwd()): string[] {
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

    if (!fix) continue;
    const stale = laneFindings.filter((f) => f.verdict === 'stale').map((f) => f.id);
    if (stale.length === 0) continue;
    const { content: next, changed } = applyFix(content, stale);
    if (changed.length === 0) continue;
    writeFileSync(file, next, 'utf8');
    written.push(lane);
  }

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
        fixed: fix ? by('stale') : [],
        backlogUpdated: written,
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
