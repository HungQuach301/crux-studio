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
 *    KHÔNG có commit `Revert` nào của nó, VÀ mục không bị giữ lại — không khai
 *    trường `- hold:` (nguồn quyết định, mục `integration/I-020`) và thân mục
 *    cũng không dính lưới dự phòng `HOLD_MARKERS`. Đoán sai theo hướng giữ
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
 * **Nguồn quyết định "còn treo": trường `- hold:`** (mục `integration/I-020`).
 *
 * Trường này được đọc y như `- status:` và `- deps:`: một dòng, một chỗ, máy
 * đọc được. Có nó thì mục **không bao giờ** bị lật sang `done`, bất kể thân
 * mục viết gì. Đó là điều mà lớp dò chuỗi con dưới đây không bao giờ làm được,
 * vì nó bắt **cách viết** chứ không bắt **ý**.
 *
 * Vì sao phải đổi nguồn quyết định: lớp chuỗi con đã thủng **hai lần** cùng
 * một chữ ký, và cả hai lần đều chữa bằng cách thêm chuỗi —
 *
 * - lần một (vòng soát của `I-010`): `P-011`, `P-013`, `P-016`, `I-002`;
 * - lần hai (`KF-023`, lượt ~21:48Z 2026-09-23): `E-001`, `P-010`, `P-007`.
 *
 * `E-001` là ca đắt nhất: nó là `deps` của `E-003`, `E-004`, `E-005`, nên một
 * lần lật nhầm mở khoá cả một nhánh việc. CLAUDE.md mục 13 ("lỗi cùng loại
 * lần thứ hai → sửa cơ chế, không vá sản phẩm") nên lần này đổi **cơ chế**.
 *
 * Trường chấp nhận thụt lề lệch, `-` hoặc `*`, và viết hoa thường tuỳ ý — một
 * mục bị giữ lại vì viết `- Hold:` thay vì `- hold:` là đúng thứ hỏng im lặng
 * mà mục này sinh ra để giết. Lý do **bắt buộc không rỗng**: `- hold:` trần
 * không nói được vì sao mục còn treo, nên nó không tính là khai (và mục đó rơi
 * về lưới dự phòng, hướng an toàn).
 */
const HOLD_FIELD = /^[ \t]*[-*][ \t]*hold[ \t]*:[ \t]*(\S.*?)[ \t]*$/i;

/**
 * Lý do của trường `- hold:` trong thân mục, hoặc `null` khi mục không khai.
 *
 * Lấy dòng `hold` **đầu tiên**, cùng luật "dòng đầu thắng" mà `parseBacklog`
 * đã dùng cho `- status:` — hai trường đọc giống nhau thì người viết backlog
 * không phải nhớ hai luật.
 */
export function parseHoldField(body: string): string | null {
  for (const line of body.split('\n')) {
    const m = HOLD_FIELD.exec(line);
    if (m) return m[1]!;
  }
  return null;
}

/**
 * Chuẩn hoá thân mục trước khi dò lưới dự phòng.
 *
 * Ba phép chuẩn hoá, mỗi phép trả lời một ca thật đã lọt:
 *
 * - **bỏ dấu nhấn Markdown** (`` ` ``, `*`, `_`): `` `done` ``, `**done**` và
 *   `done` là **một chữ**. Ca `P-007` lọt lưới chỉ vì hai dấu nháy ngược.
 * - **gộp khoảng trắng**: một câu treo bị ngắt dòng giữa hai chữ vẫn bắt được.
 * - **hạ hoa thường**: đã có từ trước, giữ nguyên.
 */
export function normalizeForHold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Lưới **dự phòng** cho các mục chưa kịp khai trường `- hold:`.
 *
 * ## Vì sao giữ lại, và vì sao nó không còn là nguồn quyết định
 *
 * Gỡ lưới này đi là mở lại đúng lỗ vừa bịt: 35 mục đang nằm ở nhóm `held` và
 * mọi mục viết trong tương lai mà tác giả quên trường sẽ lật ngay ở nhịp sau.
 * Nên nó ở lại — nhưng chỉ như **lưới**, không như nguồn: `pnpm backlog:status`
 * in riêng số mục đang được giữ bởi **trường** và số mục chỉ được giữ bởi
 * **lời văn**, và con số thứ hai là nợ phải trả dần.
 *
 * ## Vì sao là mẫu, không phải chuỗi con
 *
 * Hai lần vá trước đều thêm **chuỗi con**, và chuỗi con bắt cách viết: chèn
 * đúng một chữ vào giữa là trượt. Ba biến thể đo được —
 *
 * | Câu | Chuỗi con trượt vì |
 * |---|---|
 * | "trước khi coi mục này **là** `done`" | `coi mục này done` đòi hai chữ liền nhau |
 * | "mục này chỉ done khi…" (`done` viết trần) | `chỉ done khi` đòi đúng hai dấu nháy ngược |
 * | "mục này **chưa đóng**, dù PR đã merge" | không chuỗi nào phủ |
 *
 * — nên lưới nay là **mẫu trên văn bản đã chuẩn hoá**, có khe cho vài chữ chèn
 * vào giữa. Ca thứ hai tan ngay ở bước chuẩn hoá; hai ca còn lại cần khe chữ
 * và một mẫu mới.
 *
 * ## Vẫn khai thẳng: lưới này KHÔNG hội tụ
 *
 * Mẫu rộng hơn chuỗi con, nhưng nó vẫn đoán ý qua cách viết, nên câu thứ tư
 * viết bằng chữ khác nữa vẫn lọt. Đó **không** phải chỗ để vá tiếp — đó là
 * lý do trường `- hold:` tồn tại. Thấy một ca lọt thì khai trường cho mục đó,
 * đừng thêm mẫu.
 *
 * Hướng lệch cố ý là **giữ lại**: đoán sai theo hướng giữ chỉ tốn một nhịp và
 * vẫn in ra ở nhóm `held`; đoán sai theo hướng kia mở khoá một `deps` chưa
 * thật sự xong, và cái đó không có gì bắt được.
 *
 * Cố ý KHÔNG nằm trong lưới: "Chưa làm, cố ý" (`I-003`) — đó là loại trừ phạm
 * vi có chủ ý, không phải phần còn treo.
 */
export const HOLD_MARKERS: readonly RegExp[] = [
  // Ô "còn treo" — quy ước sẵn có của backlog.
  new RegExp(OPEN_BOX, 'u'),
  /còn treo/u,
  /chưa kiểm bằng chạy thật/u,
  // "không đóng khi PR merge" · "chỉ đóng khi…" · "chưa đóng, dù PR đã merge".
  // Ca thứ ba là biến thể lọt lưới mà `I-020` ghim: chỉ hai chữ, không có
  // "done" nào để neo vào.
  /(?:không|chưa|chỉ) đóng/u,
  // "chỉ chuyển `done`" · "vẫn không tự chuyển `done`" · "chỉ chuyển sang done".
  /(?:tự|chỉ|không) chuyển (?:\p{L}+ ){0,2}done/u,
  // "chỉ `done` khi…" · "chỉ done khi…" · "chỉ là done khi…".
  /chỉ (?:\p{L}+ ){0,2}done khi/u,
  // "coi mục này `done`" · "trước khi coi mục này là `done`" · "xem mục này như done".
  /(?:coi|xem) mục này (?:\p{L}+ ){0,2}done/u,
];

/**
 * Thân mục có câu treo nào không — **lưới dự phòng**, không phải nguồn quyết
 * định. Nguồn quyết định là `parseHoldField`; xem `HOLD_MARKERS`.
 */
export function hasHoldMarker(body: string): boolean {
  const normalized = normalizeForHold(body);
  return HOLD_MARKERS.some((pattern) => pattern.test(normalized));
}

/** Mục đang bị giữ lại bởi cái gì — `null` khi không bị giữ. */
export type HeldBy = 'field' | 'prose';

/**
 * Trường thắng lời văn khi cả hai cùng có: đó là điểm của mục `I-020`, và nó
 * làm con số "nợ lời văn" ở `pnpm backlog:status` đọc được đúng nghĩa — mục đã
 * khai trường thì không còn là nợ, dù thân mục vẫn còn câu cũ.
 */
export function heldBy(item: Pick<BacklogItem, 'hold' | 'hasHoldMarker'>): HeldBy | null {
  if (item.hold !== null) return 'field';
  return item.hasHoldMarker ? 'prose' : null;
}

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
  /**
   * Lý do của trường `- hold: <lý do>`, hoặc `null` khi mục không khai.
   *
   * **Nguồn quyết định** của "còn treo" (mục `integration/I-020`). Khác
   * `hasHoldMarker` ngay ở chỗ đó: trường là khai báo, lời văn là suy đoán.
   */
  hold: string | null;
  /**
   * Thân mục còn ít nhất một câu treo — **lưới dự phòng**, không phải nguồn
   * quyết định. Xem `HOLD_MARKERS`.
   */
  hasHoldMarker: boolean;
  /** Dòng `- status: …`, hoặc `null` nếu mục không khai `status`. */
  statusLine: number | null;
}

const HEADING = /^###\s+(\S+)([^\n]*)$/;
const STATUS = /^-\s*status:\s*(\S+)\s*$/;

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

    const text = body.join('\n');
    return {
      id: start.id,
      title: start.title,
      status,
      hold: parseHoldField(text),
      hasHoldMarker: hasHoldMarker(text),
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

/**
 * Trường `- hold:` **hoặc** lưới lời văn đều giữ mục lại. Trường đứng trước
 * trong phép thử không vì thứ tự nào quan trọng — cả hai cùng ra `held` — mà
 * để `heldBy` của cùng một mục đọc cùng một luật ở hai chỗ.
 */
export function classify(item: BacklogItem, merged: boolean): ItemVerdict {
  if (item.statusLine === null) return 'unknown';
  if (!merged) return 'unmerged';
  return heldBy(item) === null ? 'stale' : 'held';
}

export interface StatusFinding {
  lane: string;
  id: string;
  verdict: ItemVerdict;
  /**
   * Mục `held` đang được giữ bởi **trường** hay chỉ bởi **lời văn**. Vắng mặt
   * ở mọi verdict khác.
   *
   * Tiêu chí xong của `I-020`: con số "chỉ giữ bởi lời văn" là **nợ phải trả
   * dần**, và nó phải nhìn thấy được thì mới trả được.
   */
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
      const by = heldBy(item);
      return verdict === 'held' && by !== null
        ? { lane, id: item.id, verdict, heldBy: by }
        : { lane, id: item.id, verdict };
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
    // Chặn ở ĐÂY nữa, không chỉ ở `classify` (mục `I-020`). Một bên gọi truyền
    // sai danh sách `ids` là chuyện đã xảy ra — và luật "mục bị giữ thì không
    // bao giờ bị lật" chỉ đúng khi nó cũng đúng ở chỗ thật sự ghi file.
    //
    // Hỏi `heldBy`, KHÔNG chỉ hỏi `item.hold`: lưới lời văn là lớp thứ hai mà
    // mục này khẳng định "còn sống", và bỏ nó ra khỏi cổng ghi file là để đúng
    // hình dạng sự cố `KF-023` (`--fix` viết `status: done` lên một mục mà thân
    // mục cấm) đi lại được qua chỗ nguy hiểm nhất. Vòng soát ngữ cảnh sạch của
    // PR này đo được: bản đầu chỉ hỏi `item.hold` thì `applyFix` vẫn lật một
    // mục chỉ được giữ bởi lời văn khi bên gọi nêu tên nó.
    if (heldBy(item) !== null) continue;
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
  /**
   * Tách nhóm `held` theo cái đang giữ nó (mục `I-020`): `heldByField` là mục
   * đã khai `- hold:`, `heldByProseOnly` là mục còn dựa vào lưới dự phòng —
   * tức phần **nợ** còn lại. Nhóm `held` giữ nguyên để bên đọc cũ không hỏng.
   */
  const heldBySource = (source: HeldBy) =>
    findings.filter((f) => f.verdict === 'held' && f.heldBy === source).map((f) => `${f.lane}/${f.id}`);

  process.stdout.write(
    `${JSON.stringify(
      {
        stale: by('stale'),
        held: by('held'),
        heldByField: heldBySource('field'),
        heldByProseOnly: heldBySource('prose'),
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
