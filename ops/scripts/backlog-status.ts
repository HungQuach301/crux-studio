/**
 * Đối chiếu `status:` trong backlog với những gì đã thật sự vào `main` —
 * cơ chế của mục `I-010` (`ops/lanes/integration/backlog.md`).
 *
 * Vì sao mục này tồn tại:
 *
 * `ops/lanes/README.md` định nghĩa `deps` là "các mục phải `done` trước".
 * Phụ lục P1 bước 7 đặt mục sang `review` trong chính PR của nó. Nhưng
 * **không bước nào** trong P1, P2 hay P3 đặt nó sang `done` sau khi PR
 * merge. Kết quả đo trên `main` ở `61fb084`: 13 mục đã merge còn nằm
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
 *    chuyển `done`) khi có commit tiêu đề `[<lane>] <id> — …` trên `main`
 *    VÀ thân mục không còn ô `⬜` nào. Ô `⬜` là quy ước sẵn có của repo cho
 *    "còn treo": `VF-G2` ghi thẳng "giữ mục này `review`, không `done`, cho
 *    tới khi…", `VF-G7`, `VF-G11`, `P-017` cùng dạng. Đoán sai theo hướng
 *    giữ lại chỉ tốn thêm một nhịp; đoán sai theo hướng kia mở khoá một
 *    `deps` chưa thật sự xong, và cái đó không có gì bắt được.
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

export type ItemVerdict =
  /** Có commit hoàn thành trên `main`, không còn ô `⬜` → nên chuyển `done`. */
  | 'stale'
  /** Có commit hoàn thành nhưng còn ô `⬜` → cố ý giữ `review`. */
  | 'held'
  /** Chưa thấy commit hoàn thành → PR chưa merge, `review` là đúng. */
  | 'unmerged';

export interface BacklogItem {
  id: string;
  status: string;
  /** Thân mục còn ít nhất một ô `⬜`. */
  hasOpenBox: boolean;
  /** Dòng `- status: …`, hoặc `null` nếu mục không khai `status`. */
  statusLine: number | null;
}

const HEADING = /^###\s+(\S+)\s/;
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
  const starts: Array<{ id: string; line: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]!);
    if (m) starts.push({ id: m[1]!, line: i });
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

    return {
      id: start.id,
      status,
      hasOpenBox: body.some((line) => line.includes(OPEN_BOX)),
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

export function classify(item: BacklogItem, merged: boolean): ItemVerdict {
  if (!merged) return 'unmerged';
  return item.hasOpenBox ? 'held' : 'stale';
}

export interface StatusFinding {
  lane: string;
  id: string;
  verdict: ItemVerdict;
}

/** Soát một làn: chỉ các mục đang ở `review` mới có gì để nói. */
export function reviewFindings(
  lane: string,
  content: string,
  subjects: readonly string[],
): StatusFinding[] {
  return parseBacklog(content)
    .filter((item) => item.status === 'review')
    .map((item) => ({
      lane,
      id: item.id,
      verdict: classify(item, hasCompletionCommit(lane, item.id, subjects)),
    }));
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

  process.stdout.write(
    `${JSON.stringify(
      {
        stale: by('stale'),
        held: by('held'),
        unmerged: by('unmerged'),
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
