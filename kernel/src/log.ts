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

import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LaneName } from './envelope.ts';

export interface RunLogLine {
  at: string;
  lane: LaneName;
  kind: 'stage' | 'lane';
  ref: string;
  status: 'ok' | 'failed' | 'skipped';
  durationMs: number;
  costUsd: number;
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
 * Dùng khi phải chuyển dòng log cũ sang cấu trúc mới, hoặc khi bên gọi chỉ
 * có `ref` trong tay. Bên gọi biết mã mục thì truyền thẳng cho
 * `runLogPath`, đừng đoán lại từ `ref`.
 */
export function logIdFromRef(ref: string, lane: LaneName): string {
  const parts = ref.split('/').filter((part) => part.length > 0);
  if (parts.length === 0) return 'unknown';
  const first = parts[0] === lane ? parts[1] : parts[0];
  const id = first ?? parts[0]!;
  return isSafeLogId(id) ? id : 'unknown';
}

/** Đường dẫn log của một mục: `<root>/ops/logs/<lane>/<id>.jsonl`. */
export function runLogPath(root: string, lane: LaneName, id: string): string {
  if (!isSafeLogId(id)) {
    throw new Error(`Mã mục không hợp lệ cho tên file log: ${JSON.stringify(id)}`);
  }
  return join(root, 'ops', 'logs', lane, `${id}.jsonl`);
}

export function appendRunLog(logPath: string, line: RunLogLine): void {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${formatLogLine(line)}\n`, 'utf8');
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
      lines.push(JSON.parse(text) as RunLogLine);
    }
  }
  return sortByAt(lines);
}

/** Mọi file `.jsonl` dưới một thư mục, kể cả trong thư mục con, đã sắp tên. */
export function listLogFiles(logsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(logsDir);
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries.sort()) {
    const full = join(logsDir, entry);
    if (statSync(full).isDirectory()) found.push(...listLogFiles(full));
    else if (entry.endsWith('.jsonl')) found.push(full);
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
