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
  note?: string;
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
