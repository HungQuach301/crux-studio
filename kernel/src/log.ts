/**
 * Bất biến I8: mọi lần chạy stage và mọi lần chạy làn đều ghi MỘT dòng log
 * có `costUsd`. Log append-only, phân vùng **tới mức mục**:
 * `ops/logs/<lane>/<id>.jsonl` (quyết định `D-C04`, mục `P-018`).
 *
 * Vì sao tới mức mục chứ không dừng ở mức làn: phân vùng theo làn giữ cho
 * hai **làn** chạy song song không đụng nhau (CHARTER mục 7), nhưng hai
 * **mục trong cùng một làn** chạy song song là chế độ chạy bình thường —
 * mặc định 2–3 worker (Phụ lục P1). Mỗi mục một file thì hai PR không bao
 * giờ chạm cùng một file, nên xung đột log biến mất thay vì được vá
 * (`KF-005` trong `ops/known-failures.md`).
 *
 * `merge=union` trong `.gitattributes` vẫn ở lại làm **lớp phòng thủ thứ
 * hai** — nó cứu trường hợp hai lần chạy ghi vào cùng một mục. Nó không
 * xếp lại dòng theo thời gian, nên bên đọc vẫn phải sắp theo `at`; đó là
 * việc của `readRunLogs` dưới đây, không phải việc mỗi bên đọc phải nhớ.
 */

import { appendFileSync, mkdirSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { LANES, type LaneName } from './envelope.ts';

export interface RunLogLine {
  at: string;
  lane: LaneName;
  kind: 'stage' | 'lane';
  ref: string;
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  costUsd: number;
  /**
   * Dòng **tổng hợp**: `costUsd` của nó đã được đếm ở những dòng khác.
   * Bên tính tiền phải bỏ qua nó, nếu không một lần chạy tập bị tính hai
   * lần — sáu dòng `stage` cộng một dòng `lane` mang đúng tổng của sáu
   * dòng đó (`deriveEpisodeState`). Dòng vẫn được ghi, vì bất biến I8 đòi
   * mọi lần chạy làn có một dòng; chỉ phép cộng tiền là bỏ qua nó.
   */
  rollup?: boolean;
  /**
   * Chỉ dòng **bước 0** mang trường này (mục `P-033`): danh sách PR bị bỏ
   * lại ở lượt đó, ghi **có cấu trúc** để lượt sau ĐẾM được bằng máy.
   *
   * Phụ lục P3 bước 0b đòi ba số cho mỗi PR bỏ lại (giờ kẹt · làn sở hữu ·
   * số lượt liên tiếp cùng chữ ký) với đúng một lý do: *"thiếu chúng thì
   * `pickPrToHandle` ở phụ lục P1 bước 2 không có nguồn để đếm"*. Trước
   * `P-033` ba số đó chỉ nằm trong `note` — **văn xuôi**, nên nguồn để đếm
   * vẫn không tồn tại và mỗi lượt phải đếm lại bằng mắt. Xem `KF-021`.
   */
  step0?: readonly Step0Stuck[];
  note?: string;
}

/**
 * Một PR bị bước 0 bỏ lại, ở dạng máy đọc được.
 *
 * `signature` là thứ quyết định chuỗi có **tiếp tục** hay không, nên nó
 * phải là cái mà lượt sau tính ra được y hệt: với `aborted-ineligible` là
 * danh sách file vướng (trường `files` của `integrator-resolve.ts`, sắp
 * tăng dần, nối bằng `,`); với `red-after-merge` là cổng `pnpm check` đã
 * đỏ. Đổi chữ ký là một chỗ kẹt **khác**, nên chuỗi bắt đầu lại từ 1 —
 * cùng luật mà CHARTER mục 13 dùng cho "một chữ ký lỗi ba lần".
 */
export interface Step0Stuck {
  pr: number;
  outcome: 'aborted-ineligible' | 'red-after-merge';
  signature: string;
  hoursStuck: number;
  /** `laneFromBranch` của nhánh PR — `null` khi nhánh không theo dạng `claude/<lane>/<id>`. */
  lane: LaneName | null;
}

export function formatLogLine(line: RunLogLine): string {
  return JSON.stringify({
    at: line.at,
    lane: line.lane,
    kind: line.kind,
    ref: line.ref,
    status: line.status,
    durationMs: line.durationMs,
    costUsd: line.costUsd,
    ...(line.rollup === true ? { rollup: true } : {}),
    ...(line.step0 === undefined ? {} : { step0: line.step0 }),
    ...(line.note === undefined ? {} : { note: line.note }),
  });
}

/**
 * Mã mục hợp lệ cho tên file log: chữ, số, `-`, `_`, `.` — không có dấu
 * gạch chéo và không có `..`. Mã mục đi thẳng vào đường dẫn file, nên đây
 * là chỗ phải chặn: một `ref` dạng `../../etc/x` mà lọt qua sẽ ghi ra ngoài
 * `ops/logs/`.
 */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isSafeLogId(id: string): boolean {
  return SAFE_ID.test(id) && !id.includes('..');
}

/**
 * Mã mục suy ra từ `ref`. `ref` có hai dạng đang dùng:
 * `<lane>/<id>` (một mục backlog) và `<episodeId>/<workshop>` hoặc
 * `<episodeId>/full-chain` (một lần chạy tập). Ở cả hai dạng, **đoạn đầu
 * tiên không phải tên làn** là đơn vị công việc — với mục backlog thì đó
 * là đoạn sau, với lần chạy tập thì đó là đoạn trước.
 *
 * Đoạn đầu được so với **mọi** tên làn, không riêng `lane` truyền vào:
 * một dòng `ref: "platform/P-018"` mà bên gọi đưa `lane: "integration"`
 * (integrator ghi hộ) vẫn phải ra `P-018`. So với mỗi `lane` thôi thì nó
 * ra `platform`, và mọi mục của làn đó dồn vào **một** file
 * `ops/logs/integration/platform.jsonl` — đúng thứ xung đột mà `D-C04`
 * sinh ra để xoá.
 *
 * Dùng khi phải chuyển dòng log cũ sang cấu trúc mới, hoặc khi bên gọi chỉ
 * có `ref` trong tay. Bên gọi biết mã mục thì truyền thẳng cho
 * `runLogPath`, đừng đoán lại từ `ref`.
 */
export function logIdFromRef(ref: string, _lane?: LaneName): string {
  const parts = ref.split('/').filter((part) => part.length > 0);
  if (parts.length === 0) return 'unknown';
  const isLane = (LANES as readonly string[]).includes(parts[0]!);
  const id = isLane ? parts[1] : parts[0];
  return id !== undefined && isSafeLogId(id) ? id : 'unknown';
}

/** Đường dẫn log của một mục: `<root>/ops/logs/<lane>/<id>.jsonl`. */
export function runLogPath(root: string, lane: LaneName, id: string): string {
  if (!isSafeLogId(id)) {
    throw new Error(`Mã mục không hợp lệ cho tên file log: ${JSON.stringify(id)}`);
  }
  return join(root, 'ops', 'logs', lane, `${id}.jsonl`);
}

/**
 * ## Dòng log của **bước 0** — mục `P-023`
 *
 * Bước 0 của phụ lục P3 (giải xung đột hàng đợi) chạy ở đầu **mọi** lượt
 * worker và một lần mỗi lượt integrator. Nó không phải một **mục** backlog,
 * nó là **một lượt chạy** — nên `D-C04` không phủ nó: mọi lượt của mọi
 * routine cùng dồn vào một mã mục (`P-016`), tức là cùng **một file**.
 *
 * Hậu quả đã đo, không suy (giả định **G17**, trạng thái `sai`; `KF-009`):
 * `merge=union` trong `.gitattributes` KHÔNG làm xung đột file log biến mất
 * trong vận hành thật, vì GitHub không áp luật đó khi tự tính `mergeable`.
 * Một dòng bước 0 vào `main` vì thế là mọi PR
 * đang mở có dòng riêng trong file ấy **xung đột ngay** phía GitHub — và
 * `automerge.yml` nghe đúng phía đó. Lượt integrator 04:05 giờ VN 2026-09-22 thấy 7 PR
 * cùng đứng lại vì **một** dòng; lượt `crux-worker-1` 21:39Z sau đó thấy 8.
 * Vòng này tự lặp mỗi lượt và nó nuốt đúng thứ `P-016` sinh ra để xoá.
 *
 * Cách ra khỏi vòng: **một lượt chạy, một file**. Hai lượt không bao giờ
 * chạm cùng một file, nên không còn gì để xung đột — cùng lập luận mà
 * `D-C04` đã dùng cho mục, áp cho lượt chạy.
 *
 * ### Một chỗ sinh ra tên file, không phải mỗi routine tự ghép
 *
 * Trước `P-023` đã có ba hình dạng khác nhau nằm cạnh nhau trong `ops/logs/`
 * — `integration/P3-run-<ngày>T<giờ>`, `integration/P3-daily-<ngày>`,
 * `platform/P1-step0-<ngày>T<giờ>h<phút>` — ba tiền tố, hai làn, hai độ mịn
 * thời gian. Hai lượt trong cùng một giờ vẫn đụng nhau ở hình dạng thứ
 * nhất. Vì vậy tên file do **đúng hàm này** sinh ra và không nơi nào khác
 * ghép tay.
 */

/** Làn giữ mọi dòng bước 0, bất kể routine nào chạy nó (CHARTER mục 7: hàng đợi merge là việc của làn `integration`). */
export const STEP0_LOG_LANE: LaneName = 'integration';

/** Tiền tố của mọi mã log bước 0. Một tiền tố, để bên đọc lọc được bằng một phép so. */
export const STEP0_LOG_PREFIX = 'step0';

/** Tên routine chỉ được chứa ký tự an toàn cho tên file, và không chứa `-` phân đoạn nhầm chỗ nào ngoài chính nó. */
const SAFE_RUNNER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * `at` phải khai múi giờ tường minh: `Z` hoặc `±HH:MM`.
 *
 * `Date.parse('2026-09-21T21:39:22')` — không có ký hiệu múi giờ — được đọc
 * theo **giờ địa phương của máy đang chạy**. Đo thật: cùng chuỗi đó cho
 * `step0-2026-09-21T213922Z-…` với `TZ=UTC` và
 * `step0-2026-09-21T143922Z-…` với `TZ=Asia/Ho_Chi_Minh`, tức đúng múi giờ
 * vận hành của dự án. Ở đây tên file **chính là danh tính của lượt chạy**,
 * nên lệch 7 tiếng không phải sai sót thẩm mỹ: hai lượt khác nhau có thể
 * mang tên trùng, và một lượt mang tên khai sai giờ.
 *
 * `appendRunLog` chuẩn hoá `at` nên dòng bên trong vẫn đúng — chỉ tên file
 * sai. Đúng nhóm Z: không gì đỏ. Vì vậy chặn ở đây, không chuẩn hoá ngầm.
 * Năm phải đúng bốn chữ số, vì mọi phép cắt chuỗi dưới đây neo vào độ rộng
 * đó (`toISOString` cho `±YYYYYY` với năm ngoài khoảng đó).
 */
const AT_WITH_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Mã log của **một lượt** bước 0: `step0-<YYYY-MM-DDTHHMMSSZ>-<routine>`.
 *
 * Mốc thời gian tới **giây** cộng tên routine: hai lượt đụng nhau chỉ khi
 * cùng một routine chạy hai lần trong cùng một giây, điều không xảy ra.
 * Dấu `:` của ISO bị bỏ vì `isSafeLogId` (và nhiều hệ file) không nhận nó —
 * đó là lý do mã này không phải chuỗi ISO nguyên bản.
 *
 * Ném lỗi thay vì trả một mã gần đúng: một mã sai lặng lẽ đẩy dòng log vào
 * file của lượt khác, và `misfiledLogLines` chỉ bắt được khi `lane` hoặc
 * `ref` lệch — không bắt được hai lượt trộn vào một file.
 */
export function step0LogId(at: string, runner: string): string {
  if (!SAFE_RUNNER.test(runner) || runner.includes('..')) {
    throw new Error(`Tên routine không hợp lệ cho tên file log: ${JSON.stringify(runner)}`);
  }
  if (!AT_WITH_ZONE.test(at)) {
    throw new Error(
      `\`at\` của dòng bước 0 phải khai múi giờ tường minh (Z hoặc ±HH:MM) và năm bốn chữ số: ${JSON.stringify(at)}. ` +
        'Thiếu múi giờ thì tên file đi theo giờ địa phương của máy đang chạy.',
    );
  }
  // `normalizeAt` cho `YYYY-MM-DDTHH:MM:SS.sssZ`; bỏ `:` (tên file không
  // nhận) và phần mili giây, còn `YYYYMMDDTHHMMSSZ`. Rồi chèn lại hai gạch
  // nối của phần ngày, vì đó là phần người đọc bằng mắt nhiều nhất.
  const stamp = normalizeAt(at).replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const id = `${STEP0_LOG_PREFIX}-${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6)}-${runner}`;
  if (!isSafeLogId(id)) {
    throw new Error(`Mã log bước 0 không hợp lệ: ${JSON.stringify(id)}`);
  }
  return id;
}

/** `true` nếu `id` là mã log của một lượt bước 0 — dùng để lọc, không để tin. */
export function isStep0LogId(id: string): boolean {
  return id.startsWith(`${STEP0_LOG_PREFIX}-`) && isSafeLogId(id);
}

/**
 * Đường dẫn log của một lượt bước 0:
 * `<root>/ops/logs/integration/step0-<mốc>-<routine>.jsonl`.
 *
 * Dòng ghi vào đây phải mang `lane: STEP0_LOG_LANE` và
 * `ref: "<STEP0_LOG_LANE>/<mã>"`, nếu không `misfiledLogLines` sẽ đỏ — đó
 * là chủ đích: hai luật phải khớp nhau chứ không mỗi bên một đằng.
 */
export function step0LogPath(root: string, at: string, runner: string): string {
  return runLogPath(root, STEP0_LOG_LANE, step0LogId(at, runner));
}

/** `ref` đi kèm cho dòng bước 0 — ghép ở một chỗ, để bên ghi không tự đoán. */
export function step0LogRef(at: string, runner: string): string {
  return `${STEP0_LOG_LANE}/${step0LogId(at, runner)}`;
}

/** Chuỗi kẹt đang chạy của một PR, tách theo hai chữ ký như `TriageCandidate`. */
export interface Step0Streak {
  abortedIneligible: number;
  redAfterMerge: number;
}

/**
 * Kết quả của `step0Streaks` — chuỗi **cộng với** phần khai giới hạn của
 * chính phép đo. Hai số sau không phải trang trí: một dòng bước 0 không có
 * trường `step0` là dòng **không đọc được bằng máy**, và im lặng đếm nó
 * thành "PR này không kẹt" chính là lỗi mà `KF-021` ghi lại.
 */
export interface Step0StreakReport {
  /** Chuỗi đang chạy, khoá là số PR. Chỉ PR có mặt ở lượt MỚI NHẤT mới có mặt ở đây. */
  streaks: Map<number, Step0Streak>;
  /** Tổng số lượt bước 0 đọc vào. */
  totalRuns: number;
  /** Số lượt không có trường `step0` (chỉ có văn xuôi) trong toàn bộ đầu vào. */
  proseOnlyRuns: number;
  /**
   * Số lượt liên tiếp **tính ngược từ lượt mới nhất** mà máy đọc được.
   * Phép đếm dừng ở đó, nên khi nó nhỏ hơn `totalRuns` thì mọi chuỗi ở trên
   * là **cận dưới** — bên gọi phải nói ra điều đó, không được làm tròn lên.
   */
  readableRunsFromNewest: number;
}

const stuckKey = (entry: Step0Stuck): string =>
  `${entry.pr}\u0000${entry.outcome}\u0000${entry.signature}`;

/**
 * Chuỗi kẹt đang chạy của từng PR, đếm từ **dòng log bước 0** thay vì đếm
 * bằng mắt — mục `P-033`, `KF-021`.
 *
 * Vì sao cần: phụ lục P1 bước 2 lấy `abortedIneligibleStreak` và
 * `redAfterMergeStreak` làm đầu vào của `pickPrToHandle`, và
 * `shouldAlertStreak` quyết định bản tin có phải lên tiếng không. Cả hai
 * trước đây do người viết prompt tự đếm từ `note` của các lượt trước —
 * **văn xuôi**, và chỉ những lượt đã vào `main`. Hàng đợi merge đứng thì
 * dòng bước 0 của các lượt gần nhất nằm trong PR **chưa merge**, nên mỗi
 * lượt đếm lại từ đầu và ra số nhỏ hơn thật. Đo được 2026-09-23: cùng PR
 * `#120`, lượt `00:46Z` ghi chuỗi `2`, lượt `01:20Z` ghi `1`, lượt `02:24Z`
 * ghi `2`, trong khi chuỗi thật (đếm đủ bảy lượt) là `7`. Ngưỡng cảnh báo
 * `3` bị vượt từ `01:20Z` mà không lượt nào nói ra, và **không gì đỏ** —
 * nhóm Z.
 *
 * Cách đếm, cố ý bảo thủ ở cả ba chỗ:
 *
 * 1. **Chỉ PR có mặt ở lượt mới nhất** mới có chuỗi đang chạy. Một PR vắng
 *    mặt ở lượt mới nhất nghĩa là nó không còn kẹt kiểu đó, chuỗi kết thúc.
 * 2. **Chữ ký phải khớp** qua từng lượt. Đổi file vướng là một chỗ kẹt
 *    khác, đếm lại từ 1.
 * 3. **Dừng ở lượt đầu tiên không đọc được.** Không suy ra gì từ một dòng
 *    chỉ có văn xuôi; `readableRunsFromNewest` nói thẳng phép đếm đi được
 *    bao xa.
 *
 * Bên gọi truyền vào **mọi** dòng log đọc được (`readRunLogs`); hàm tự lọc
 * lấy dòng bước 0 và tự sắp theo `at` — thứ tự dòng trong file không mang
 * nghĩa vì `merge=union` không xếp theo thời gian.
 */
export function step0Streaks(lines: readonly RunLogLine[]): Step0StreakReport {
  const runs = lines
    .filter((line) => isStep0LogId(logIdFromRef(line.ref)))
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const report: Step0StreakReport = {
    streaks: new Map(),
    totalRuns: runs.length,
    proseOnlyRuns: runs.filter((run) => run.step0 === undefined).length,
    readableRunsFromNewest: 0,
  };

  const running = new Map<string, { entry: Step0Stuck; count: number }>();
  const ended = new Set<string>();

  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index]!;
    if (run.step0 === undefined) break;
    report.readableRunsFromNewest += 1;

    const keysThisRun = new Set(run.step0.map(stuckKey));
    for (const key of running.keys()) {
      if (!keysThisRun.has(key)) ended.add(key);
    }

    const isNewest = index === runs.length - 1;
    for (const entry of run.step0) {
      const key = stuckKey(entry);
      if (ended.has(key)) continue;
      const current = running.get(key);
      if (current === undefined) {
        // Xuất hiện lần đầu ở một lượt CŨ hơn lượt mới nhất: không nối vào
        // chuỗi đang chạy, vì nó đã đứt ở đâu đó giữa chừng.
        if (!isNewest) {
          ended.add(key);
          continue;
        }
        running.set(key, { entry, count: 1 });
      } else {
        current.count += 1;
      }
    }
  }

  for (const { entry, count } of running.values()) {
    const streak = report.streaks.get(entry.pr) ?? { abortedIneligible: 0, redAfterMerge: 0 };
    if (entry.outcome === 'aborted-ineligible') {
      streak.abortedIneligible = Math.max(streak.abortedIneligible, count);
    } else {
      streak.redAfterMerge = Math.max(streak.redAfterMerge, count);
    }
    report.streaks.set(entry.pr, streak);
  }

  return report;
}

/**
 * Ghi một dòng. `at` được chuẩn hoá về UTC ngay lúc ghi, để bên đọc không
 * phải gặp hai dạng mốc thời gian trong cùng một cột.
 */
export function appendRunLog(logPath: string, line: RunLogLine): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${formatLogLine({ ...line, at: normalizeAt(line.at) })}\n`, 'utf8');
}

/**
 * Sắp theo `at` tăng dần. Khoá phụ là thứ tự đọc vào, nên hai dòng cùng
 * `at` giữ nguyên thứ tự tương đối — `Array.prototype.sort` của V8 ổn định.
 */
export function sortByAt(lines: readonly RunLogLine[]): RunLogLine[] {
  return [...lines].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * Đọc nội dung nhiều file JSONL thành các dòng log, đã sắp theo `at`.
 * Hàm thuần: nhận nội dung, không đụng đĩa — phần đọc đĩa ở `readRunLogs`.
 *
 * Dòng rỗng bị bỏ qua. Dòng hỏng (không phải JSON) làm hàm ném lỗi: log là
 * nguồn tính tiền, nuốt một dòng hỏng ở đây là đúng nhóm lỗi Z — số ra sai
 * mà không gì đỏ.
 */
export function parseRunLogs(contents: readonly string[]): RunLogLine[] {
  const lines: RunLogLine[] = [];
  for (const content of contents) {
    for (const raw of content.split('\n')) {
      const text = raw.trim();
      if (text.length === 0) continue;
      const line = JSON.parse(text) as RunLogLine;

      // `costUsd` phải là SỐ. Một dòng chép tay mang `"costUsd": "0.12"`
      // biến phép cộng tiền thành nối chuỗi, và ô "Tích luỹ" trong
      // `ops/metrics.md` thành rác mà không gì đỏ.
      if (typeof line.costUsd !== 'number' || !Number.isFinite(line.costUsd)) {
        throw new Error(`Dòng log có \`costUsd\` không phải số: ${text.slice(0, 120)}`);
      }

      // `at` được chuẩn hoá về UTC. Mọi phép so sánh thời gian ở đây là so
      // CHUỖI, nên một dòng ghi `2026-09-21T17:00:00+07:00` sẽ xếp sai chỗ
      // và rơi khỏi cửa sổ 24 giờ dù nó nằm trong đó.
      line.at = normalizeAt(line.at);

      lines.push(line);
    }
  }
  return sortByAt(lines);
}

/**
 * Đưa `at` về đúng một dạng so sánh được: ISO 8601, UTC, có mili giây.
 * Không đọc được thì **ném** — một mốc thời gian vô nghĩa trong nguồn tính
 * tiền phải dừng phép tính, không được lặng lẽ trôi xuống cuối bảng.
 */
export function normalizeAt(at: string): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) {
    throw new Error(`Dòng log có \`at\` không đọc được: ${JSON.stringify(at)}`);
  }
  return new Date(ms).toISOString();
}

/**
 * Mọi file `.jsonl` dưới một thư mục, kể cả trong thư mục con, đã sắp tên.
 *
 * Thư mục **chưa tồn tại** thì trả mảng rỗng — đó là trạng thái hợp lệ của
 * một repo chưa có log. Mọi lỗi khác (gõ nhầm đường dẫn thành một file,
 * mất quyền đọc) thì **ném**: nuốt chúng cho ra `[]`, và `[]` cho ra chi
 * phí 0 USD ghi thẳng vào `ops/metrics.md` mà không gì đỏ — nhóm Z.
 *
 * `withFileTypes` thay cho `statSync` từng mục: một symlink gãy, hoặc một
 * file bị xoá giữa lúc đọc thư mục (worker khác đang ghi log song song là
 * chế độ chạy bình thường), sẽ làm `statSync` ném và giết cả phép đọc.
 */
export function listLogFiles(logsDir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(logsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const found: string[] = [];
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const full = join(logsDir, entry.name);
    if (entry.isDirectory()) found.push(...listLogFiles(full));
    else if (entry.name.endsWith('.jsonl')) found.push(full);
  }
  return found;
}

/**
 * Gom **mọi** file log dưới `ops/logs/` — cả `<lane>/<id>.jsonl` lẫn file
 * phẳng `<lane>.jsonl` còn sót lại — và trả về các dòng đã sắp theo `at`.
 *
 * Mọi bên đọc log (bản tin ngày, `ops/metrics.md`, routine integrator) gọi
 * hàm này thay vì tự `cat` rồi tự sắp. Thứ tự dòng trong file không mang
 * nghĩa, và đó là loại luật mà ai quên thì số ra sai lặng lẽ.
 */
export function readRunLogs(logsDir: string): RunLogLine[] {
  return parseRunLogs(listLogFiles(logsDir).map((path) => readFileSync(path, 'utf8')));
}

/**
 * Những file log **phẳng** còn sót dưới `ops/logs/` — hình dạng trước
 * `D-C04`, tức `.jsonl` nằm ngay tầng đầu (`ops/logs/<lane>.jsonl`) thay
 * vì trong thư mục của làn (`ops/logs/<lane>/<id>.jsonl`).
 *
 * Vì sao phải hỏi bằng một hàm chứ không nhìn bằng mắt: một file phẳng
 * **mới** sinh ra trên `main` sau khi một nhánh rẽ ra sẽ được git gộp vào
 * êm ru — nhánh chưa từng thấy file đó nên không có gì để xung đột. Kết
 * quả là PR xanh, merge được, mà hình dạng cũ vẫn nằm đó sau `D-C04`.
 * Đúng nhóm Z: hỏng mà mọi chỉ báo đều xanh. Đã xảy ra thật với
 * `ops/logs/verify.jsonl` lúc giải xung đột PR #26.
 *
 * `readRunLogs` vẫn đọc cả file phẳng, nên dòng log không mất — cái mất là
 * chính lý do `D-C04` tồn tại: hai PR trong cùng một làn lại chạm cùng một
 * file (`KF-005`).
 */
export function flatLogFiles(logsDir: string): string[] {
  // So bằng `relative` chứ không bằng `dirname(path) === logsDir`: bên gọi
  // đưa `ops/logs/` có dấu gạch chéo cuối là so chuỗi lệch ngay, và lúc đó
  // hàm trả rỗng — tức là báo "sạch" cho một thư mục nó chưa thật sự xét.
  return listLogFiles(logsDir).filter((path) => !relative(logsDir, path).includes(sep));
}

/**
 * Một dòng log **nằm sai file**: `ops/logs/<lane>/<id>.jsonl` mà `lane` hoặc
 * `logIdFromRef(ref)` của dòng đó không khớp với đường dẫn chứa nó.
 *
 * Đây là nhóm Z tinh vi hơn `flatLogFiles` một bậc, và nó đã xảy ra **thật**
 * ở lần gộp thứ hai của PR #26 — **không một dấu xung đột nào**:
 *
 * Nhánh xoá `ops/logs/verify.jsonl` và tạo `ops/logs/verify/VF-G2.jsonl` với
 * đúng nội dung đó. Git **nhận ra đó là một lần đổi tên**. Khi `main` thêm một
 * dòng `ref: "verify/VF-G11"` vào file phẳng cũ, git áp thay đổi ấy lên *đường
 * dẫn đã đổi tên*, và `merge=union` gộp êm — dòng `VF-G11` nằm gọn trong
 * `VF-G2.jsonl`. Không dòng nào mất, không gì đỏ, CI xanh; chỉ là chi phí của
 * `VF-G11` từ nay bị tính cho `VF-G2`.
 *
 * `flatLogFiles` **không** bắt được ca này: file vẫn lồng thư mục và vẫn đúng
 * hai tầng. Phải hỏi bằng chính `ref` của từng dòng.
 */
export function misfiledLogLines(logsDir: string): Array<{ file: string; ref: string; expected: string }> {
  const found: Array<{ file: string; ref: string; expected: string }> = [];
  for (const file of listLogFiles(logsDir)) {
    const parts = relative(logsDir, file).split(sep);
    if (parts.length !== 2) continue; // hình dạng sai là việc của `flatLogFiles`
    const [lane, base] = parts as [string, string];
    const id = base.replace(/\.jsonl$/, '');
    for (const line of parseRunLogs([readFileSync(file, 'utf8')])) {
      const wantId = logIdFromRef(line.ref, line.lane);
      if (line.lane === lane && wantId === id) continue;
      found.push({ file, ref: line.ref, expected: join(logsDir, line.lane, `${wantId}.jsonl`) });
    }
  }
  return found;
}
