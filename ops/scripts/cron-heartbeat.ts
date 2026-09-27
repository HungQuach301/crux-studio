#!/usr/bin/env node
/**
 * Nhịp tim của **`cron`** — chỗ `Z6` của nhóm Z (`ops/known-failures.md`),
 * sóng 5 của mục `platform/P-014`.
 *
 * Chỗ hỏng mà Z6 gọi tên: GitHub tạm ngưng workflow theo lịch khi repo im
 * lặng lâu, và `schedule` vốn là nỗ lực tốt nhất chứ không bảo đảm. Workflow
 * theo lịch không chạy thì **không có lượt nào để mà đỏ**. Bốn workflow của
 * dự án sống nhờ `schedule`, và ba trong bốn chính là người canh:
 * `watchdog.yml` (CHARTER 2.4), `main-ci.yml` (dự phòng của `G2`),
 * `automerge.yml` (vòng quét hàng đợi merge), `decision-close.yml`.
 * Người canh chết thì không ai canh người canh.
 *
 * ## Vì sao KHÔNG làm đúng như ô Z6 viết ("`main-ci` ghi thời điểm chạy vào
 * một file trong repo")
 *
 * Ô Z6 viết trước khi dự án có luật `D-C06` và `P-038`, và làm theo mặt chữ
 * thì đụng hai luật cứng:
 *
 * 1. **Ghi vào `main` không qua PR là cấm** (bất biến I2 và `CLAUDE.md` mục 2).
 *    Một workflow `push` thẳng vào `main` mỗi giờ là một cửa sau của I2.
 * 2. **Đi qua PR thì mỗi giờ một PR**, tức 6 job `ci.yml` cộng một lượt
 *    `main-ci` mỗi giờ để giữ một dòng văn bản — đúng thứ tiền CI mà chủ dự
 *    án đã cấm tiêu trên issue bản tin `#193` (xem `step0-pr-gate.ts`).
 *
 * Và file đó **thừa**: GitHub đã tự ghi nhịp tim — mỗi lượt `schedule` là một
 * bản ghi `workflow_run` có `created_at` và `event: "schedule"`, đọc được qua
 * API Actions, không tốn một dòng nào trong repo. Nên file này đọc thẳng bản
 * ghi đó. Tính chất mà ô Z6 thật sự đòi vẫn giữ nguyên: **hai cơ chế khác họ**
 * — bên bị canh là bộ lập lịch của Actions, bên canh là một routine Claude
 * (phụ lục P3), nên không cùng chết.
 *
 * ## Đầu vào: một ảnh chụp, không phải lời gọi mạng
 *
 * Phiên routine đọc API Actions bằng công cụ GitHub MCP, không bằng `gh` hay
 * token (`CLAUDE.md` mục 4). Nên script không tự gọi mạng: lượt chạy dựng
 * một file JSON từ hai phép liệt kê (`list_workflows` và, với từng workflow
 * có `schedule`, `list_workflow_runs` lọc `event: schedule`, lấy lượt mới
 * nhất) rồi đưa cho CLI. Hàm thuần nên có bài kiểm; lời gọi mạng thì không.
 *
 * **Danh sách workflow phải canh đọc từ cây, không từ ảnh chụp.** CLI tự quét
 * `ops/workflows/*.yml` tìm khối `schedule:`. Workflow có lịch mà ảnh chụp
 * thiếu thì ra `missing` và ĐỎ — một ảnh chụp cụt không được đọc thành "mọi
 * cron đều khoẻ" (bài học `Z15`).
 *
 * ## Bảy phán quyết, sáu trong đó là vấn đề
 *
 * `fresh` là phán quyết DUY NHẤT không đỏ, cộng `pending-first` cho workflow
 * vừa tạo chưa tới giờ chạy đầu. Mọi ca "không đo được" đều là một phán quyết
 * riêng, không bao giờ rơi về `fresh`:
 *
 * - `stale` — lượt `schedule` mới nhất cũ hơn ngưỡng.
 * - `disabled` — `state` khác `active`. Tài liệu GitHub liệt kê
 *   `disabled_inactivity` (tự ngưng vì repo im lâu — chính ca Z6),
 *   `disabled_manually`, `disabled_fork`, `deleted`. **Đọc tài liệu chỉ cho
 *   trạng thái "tài liệu nói vậy"** (`CLAUDE.md` mục 7): chưa ai đo một workflow
 *   bị ngưng thật. Nên luật so với `active` chứ không liệt kê giá trị xấu —
 *   một giá trị lạ cũng đỏ.
 * - `never` — chưa có lượt `schedule` nào và không biết workflow tạo lúc nào.
 * - `future` — mốc ở tương lai (bài học Z7: số âm nhỏ hơn mọi ngưỡng).
 * - `unsupported-cron` — biểu thức ngoài tập con đọc được, nên không tính
 *   được chu kỳ. Đỏ thay vì đoán.
 * - `missing` — cây có lịch mà ảnh chụp không có workflow đó.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Chu kỳ của một biểu thức cron ────────────────────────────────────────

/**
 * Chu kỳ **danh nghĩa**, tính bằng phút, của một biểu thức cron năm trường.
 *
 * Chỉ đọc đúng ba hình dạng mà cây đang dùng, cộng hình dạng theo tuần:
 * `M * * * *` (mỗi giờ) · `M H * * *` (mỗi ngày) · `M H * * D` (mỗi tuần),
 * với `M`, `H`, `D` là MỘT số nguyên. Mọi thứ khác (`*∕5`, danh sách, khoảng,
 * ngày trong tháng…) trả `null`, và bên gọi biến nó thành `unsupported-cron`.
 * Tính sai chu kỳ của một biểu thức lạ là đặt ngưỡng sai mà không gì đỏ; từ
 * chối thì người thêm biểu thức lạ phải mở rộng hàm này, có bài kiểm.
 */
export function cronPeriodMinutes(expr: string): number | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string];
  const isInt = (s: string, max: number): boolean => /^\d+$/.test(s) && Number(s) <= max;
  if (!isInt(minute, 59) || dom !== '*' || month !== '*') return null;
  if (hour === '*') return dow === '*' ? 60 : null;
  if (!isInt(hour, 23)) return null;
  if (dow === '*') return 24 * 60;
  return isInt(dow, 7) ? 7 * 24 * 60 : null;
}

// ── Ngưỡng ───────────────────────────────────────────────────────────────

/**
 * Khoảng hở **đo được** giữa hai lượt `event: schedule` liên tiếp, tính bằng
 * phút, trên dữ liệu thật của repo (`list_workflow_runs`, 2026-09-21 →
 * 2026-09-27T21:4xZ, mọi lượt `schedule` của từng workflow):
 *
 * | Workflow | Cron | Số lượt | Trung vị | Lớn nhất |
 * |---|---|---|---|---|
 * | `main-ci.yml` | `17 * * * *` | 36 | 287,6 | 405,9 |
 * | `watchdog.yml` | `0 * * * *` | 32 | 299,9 | **670,6** |
 * | `automerge.yml` | `23 * * * *` | 34 | 280,2 | 408,2 |
 * | `decision-close.yml` | `0 20 * * *` | 2 | 1397,3 | 1397,3 |
 *
 * Đọc cho đúng: cron "mỗi giờ" trên repo này **thật ra chạy khoảng 5 giờ một
 * lần**, và có lúc 11 giờ. Đó là hành vi của bộ lập lịch Actions khi đang
 * khoẻ, không phải sự cố — nên ngưỡng đặt theo chu kỳ danh nghĩa (3 × 60
 * phút) sẽ đỏ gần như mỗi lượt đo. Bài kiểm `cron-heartbeat.test.ts` giữ
 * nguyên bảng này và đòi MỌI khoảng hở đã đo nằm dưới ngưỡng.
 */
export const CRON_MEASURED_MAX_GAP_MINUTES = {
  'main-ci.yml': 405.9,
  'watchdog.yml': 670.6,
  'automerge.yml': 408.2,
  'decision-close.yml': 1397.3,
} as const;

/** Số chu kỳ danh nghĩa được phép lỡ — chỉ cắn với cron mỗi tuần trở lên. */
export const STALE_PERIODS = 3;

/**
 * Sàn cộng thêm, tính bằng phút: **12 giờ**. Với cron mỗi giờ, ngưỡng thành
 * 13 giờ = 780 phút, trên khoảng hở lớn nhất đã đo (670,6) một khoảng 16%.
 * Chọn sàn cộng thêm thay vì nhân chu kỳ vì khoảng hở đo được không tỉ lệ với
 * chu kỳ: nó là độ trễ của hàng đợi Actions, gần như hằng số theo giờ.
 */
export const STALE_FLOOR_MINUTES = 12 * 60;

/**
 * Ngưỡng `stale`, tính bằng phút, cho một chu kỳ danh nghĩa.
 *
 * `max(chu kỳ × STALE_PERIODS, chu kỳ + STALE_FLOOR_MINUTES)`: cron mỗi giờ
 * → 13 giờ · mỗi ngày → 72 giờ · mỗi tuần → 21 ngày. Hướng lệch đã chọn là
 * **báo muộn chứ không báo thừa**: Z6 là ca workflow NGỪNG hẳn (tự ngưng vì
 * im lâu, hoặc bị tắt), không phải ca trễ vài giờ — trễ vài giờ là hành vi
 * bình thường của `schedule` trên Actions (bảng trên). Một ngưỡng báo mỗi
 * ngày sẽ bị học cách lờ đi, và luật bị lờ là luật đã chết.
 */
export function staleThresholdMinutes(periodMinutes: number): number {
  return Math.max(periodMinutes * STALE_PERIODS, periodMinutes + STALE_FLOOR_MINUTES);
}

/** Dung sai đồng hồ trước khi một mốc bị gọi là `future` (bài học Z7). */
export const FUTURE_TOLERANCE_MINUTES = 5;

// ── Đọc lịch từ cây ──────────────────────────────────────────────────────

export interface ScheduledWorkflow {
  /** Tên file, ví dụ `main-ci.yml` — khoá ghép với ảnh chụp. */
  file: string;
  crons: string[];
}

/**
 * Các biểu thức `cron` trong khối `schedule:` của một file workflow.
 *
 * Đọc theo dòng, không cần trình đọc YAML đầy đủ: khối `on.schedule` là một
 * danh sách `- cron: '…'`. Dòng chú thích và thân khối `run:` không mang
 * `- cron:` ở đầu dòng, nên không lẫn. Không tìm được khối nào thì trả rỗng —
 * workflow đó không sống nhờ lịch.
 */
export function cronExpressions(yaml: string): string[] {
  const out: string[] = [];
  let inSchedule = false;
  let scheduleIndent = -1;
  for (const raw of yaml.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (/^\s*schedule:\s*$/.test(line)) {
      inSchedule = true;
      scheduleIndent = indent;
      continue;
    }
    if (inSchedule && indent <= scheduleIndent) inSchedule = false;
    if (!inSchedule) continue;
    const m = /^\s*-\s*cron:\s*(['"]?)([^'"]+)\1\s*$/.exec(line);
    if (m) out.push(m[2]!.trim());
  }
  return out;
}

/** Mọi workflow trong `dir` có ít nhất một biểu thức cron, xếp theo tên file. */
export function scheduledWorkflows(dir: string): ScheduledWorkflow[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort()
    .map((file) => ({ file, crons: cronExpressions(readFileSync(join(dir, file), 'utf8')) }))
    .filter((w) => w.crons.length > 0);
}

// ── Phán quyết ───────────────────────────────────────────────────────────

/** Một workflow trong ảnh chụp API Actions. */
export interface WorkflowSnapshot {
  /** `path` của API, ví dụ `.github/workflows/main-ci.yml`. Ghép theo tên file. */
  path: string;
  /** `state` của API — chỉ `active` là khoẻ. */
  state: string;
  /** `created_at` của lượt `event: schedule` mới nhất; `null` khi chưa có lượt nào. */
  lastScheduleRunAt: string | null;
  /** `created_at` của chính workflow, để phân biệt "mới tạo" với "chưa từng chạy". */
  createdAt?: string;
}

export interface CronSnapshot {
  /** Mốc đo, ISO. Đưa vào tường minh để phép đo tái lập được. */
  now: string;
  workflows: WorkflowSnapshot[];
}

export type CronVerdict =
  | 'fresh'
  | 'pending-first'
  | 'stale'
  | 'disabled'
  | 'never'
  | 'future'
  | 'unsupported-cron'
  | 'missing';

export interface CronHeartbeat {
  file: string;
  crons: string[];
  /** Chu kỳ ngắn nhất trong các biểu thức của file; `null` khi có biểu thức không đọc được. */
  periodMinutes: number | null;
  thresholdMinutes: number | null;
  state: string | null;
  lastScheduleRunAt: string | null;
  /** Tuổi lượt `schedule` mới nhất, phút; `null` khi không có lượt nào. */
  ageMinutes: number | null;
  verdict: CronVerdict;
}

function parseTime(label: string, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`cron-heartbeat: mốc ${label} không đọc được: ${JSON.stringify(iso)}`);
  return t;
}

const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

/**
 * Phán quyết cho từng workflow có lịch trong cây.
 *
 * **Ném** khi ảnh chụp rỗng hẳn: danh sách workflow của một repo có workflow
 * theo lịch không bao giờ rỗng thật, nên rỗng nghĩa là *chưa nhìn*, không phải
 * *nhìn rồi không thấy* (bài học `Z15`, cùng luật với `lane-heartbeat.ts`).
 * Cũng ném khi cây không có workflow theo lịch nào: phép quét cây hỏng thì
 * không được ra "0 vấn đề".
 */
export function cronHeartbeats(scheduled: readonly ScheduledWorkflow[], snapshot: CronSnapshot): CronHeartbeat[] {
  if (scheduled.length === 0) throw new Error('cron-heartbeat: cây không có workflow theo lịch nào — phép quét cây hỏng, không kết luận được');
  if (snapshot.workflows.length === 0) throw new Error('cron-heartbeat: ảnh chụp không có workflow nào — chưa đo, không kết luận được');
  const now = parseTime('now', snapshot.now);
  const byFile = new Map<string, WorkflowSnapshot>();
  for (const w of snapshot.workflows) byFile.set(baseName(w.path), w);

  return scheduled.map(({ file, crons }) => {
    const periods = crons.map(cronPeriodMinutes);
    const periodMinutes = periods.some((p) => p === null) ? null : Math.min(...(periods as number[]));
    const thresholdMinutes = periodMinutes === null ? null : staleThresholdMinutes(periodMinutes);
    const snap = byFile.get(file);
    const base = { file, crons, periodMinutes, thresholdMinutes };
    if (snap === undefined) {
      return { ...base, state: null, lastScheduleRunAt: null, ageMinutes: null, verdict: 'missing' as const };
    }
    const last = snap.lastScheduleRunAt;
    const ageMinutes = last === null ? null : (now - parseTime(`lastScheduleRunAt của ${file}`, last)) / 60000;
    const row = { ...base, state: snap.state, lastScheduleRunAt: last, ageMinutes };
    const verdict = ((): CronVerdict => {
      // Thứ tự có chủ đích: `disabled` đi TRƯỚC `stale` — một workflow bị
      // ngưng thì lượt cuối của nó sớm muộn cũng cũ, và nguyên nhân mới là
      // thứ người đọc cần để chữa.
      if (snap.state !== 'active') return 'disabled';
      if (thresholdMinutes === null) return 'unsupported-cron';
      if (ageMinutes === null) {
        if (snap.createdAt === undefined) return 'never';
        const sinceCreated = (now - parseTime(`createdAt của ${file}`, snap.createdAt)) / 60000;
        return sinceCreated <= thresholdMinutes ? 'pending-first' : 'never';
      }
      if (ageMinutes < -FUTURE_TOLERANCE_MINUTES) return 'future';
      return ageMinutes > thresholdMinutes ? 'stale' : 'fresh';
    })();
    return { ...row, verdict };
  });
}

/** Phán quyết nào KHÔNG phải vấn đề. Mọi thứ khác đỏ. */
export const HEALTHY_VERDICTS: ReadonlySet<CronVerdict> = new Set(['fresh', 'pending-first']);

export function cronHeartbeatProblems(rows: readonly CronHeartbeat[]): CronHeartbeat[] {
  return rows.filter((r) => !HEALTHY_VERDICTS.has(r.verdict));
}

const fmtHours = (min: number | null): string => (min === null ? '—' : `${(min / 60).toFixed(1)}h`);

/**
 * Bảng in ra cho người đọc. In **mọi** dòng, kể cả khi 0 vấn đề, và dòng kết
 * luận luôn có mặt — bài học Z2/Z7: một khối biến mất khi rỗng là một khối
 * người đọc phải đọc kỹ mới biết nó có hay không.
 */
export function renderCronHeartbeats(rows: readonly CronHeartbeat[]): string {
  const lines = rows.map(
    (r) =>
      `  ${r.file.padEnd(22)} ${r.verdict.padEnd(16)} tuổi ${fmtHours(r.ageMinutes).padStart(6)} · ngưỡng ${fmtHours(r.thresholdMinutes).padStart(6)} · state ${r.state ?? '—'} · cron ${r.crons.join(' | ')}`,
  );
  const problems = cronHeartbeatProblems(rows);
  const head =
    problems.length === 0
      ? `Nhịp tim cron (Z6): ${rows.length} workflow theo lịch, 0 vấn đề.`
      : `Nhịp tim cron (Z6): ${problems.length}/${rows.length} workflow theo lịch CÓ VẤN ĐỀ: ${problems.map((p) => `${p.file} (${p.verdict})`).join(', ')}.`;
  return [head, ...lines].join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────
//
//   node ops/scripts/cron-heartbeat.ts <snapshot.json> [--json] [--dir ops/workflows]
//
// Thoát 0 khi 0 vấn đề · 1 khi CÓ vấn đề · 2 khi KHÔNG ĐO ĐƯỢC (đầu vào hỏng,
// ảnh chụp rỗng, cây không có lịch). Ba mã tách nhau để "không đo được" không
// bao giờ đọc thành "khoẻ" — cùng quy ước với `pnpm telemetry:gaps`.

const isMain = process.argv[1]?.endsWith('cron-heartbeat.ts') === true;

if (isMain) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const dirAt = argv.indexOf('--dir');
  const dir = dirAt >= 0 ? argv[dirAt + 1] : 'ops/workflows';
  const file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir');
  if (file === undefined || dir === undefined) {
    console.error('Cách dùng: node ops/scripts/cron-heartbeat.ts <snapshot.json> [--json] [--dir ops/workflows]');
    process.exit(2);
  }
  let rows: CronHeartbeat[];
  try {
    const snapshot = JSON.parse(readFileSync(file, 'utf8')) as CronSnapshot;
    if (typeof snapshot.now !== 'string' || !Array.isArray(snapshot.workflows)) {
      throw new Error('ảnh chụp thiếu `now` (chuỗi ISO) hoặc `workflows` (mảng)');
    }
    rows = cronHeartbeats(scheduledWorkflows(dir), snapshot);
  } catch (err) {
    console.error(`⚠ KHÔNG ĐO ĐƯỢC nhịp tim cron: ${(err as Error).message}`);
    process.exit(2);
  }
  console.log(asJson ? JSON.stringify({ rows, problems: cronHeartbeatProblems(rows).map((p) => p.file) }, null, 2) : renderCronHeartbeats(rows));
  process.exit(cronHeartbeatProblems(rows).length === 0 ? 0 : 1);
}
