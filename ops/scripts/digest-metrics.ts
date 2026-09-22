#!/usr/bin/env node
/**
 * Gom số liệu cho bản tin ngày — cơ chế của mục `platform/P-005`
 * (`ops/lanes/platform/backlog.md`), dùng bởi routine `crux-digest`
 * (CHARTER Phụ lục P2 bước 2).
 *
 * Vì sao mục này tồn tại: phụ lục P2 bảo routine tự đi thu thập rồi tự
 * tính — PR merged 24 giờ theo làn, PR đang mở và trạng thái CI, mục
 * `parked`, issue `[QĐ]` đang mở tách theo `reversible`/`irreversible`,
 * chi phí 24 giờ và tích luỹ so với ngân sách. Tính tay mỗi sáng là chỗ
 * một con số sai lặng lẽ đi thẳng vào thứ duy nhất chủ dự án đọc. Mục này
 * biến việc đó thành một lệnh có test.
 *
 * Cùng triết lý tách lớp với `update-metrics.ts` và `integrator-resolve.ts`:
 * mọi phép tính là **hàm thuần**, kiểm bằng dữ liệu giả lập, không gọi
 * mạng và không đụng đĩa. `main()` chỉ là lớp vỏ mỏng: đọc backlog và log
 * thật, gọi `gh` (hoặc đọc file `--github`), in ra.
 *
 * **Hai đường nạp dữ liệu GitHub, một dạng dữ liệu duy nhất.** Routine
 * `crux-digest` là một lượt agent: nó có công cụ GitHub của nền tảng chứ
 * không chắc có `gh` trong `PATH`. Nên script nhận dữ liệu theo đúng dạng
 * `gh … --json` trả về, và `--github <file>` cho phép agent tự nạp vào.
 * Một dạng dữ liệu cho cả hai đường: thêm đường thứ hai mà đổi luôn hình
 * dạng dữ liệu là cách chắc chắn để hai đường trôi khỏi nhau.
 *
 * Ba chỗ **cố ý không im lặng**, vì im lặng ở đây đúng nhóm lỗi Z
 * (`ops/known-failures.md`) — số ra sai mà không gì đỏ:
 *
 * 1. PR không suy được làn từ tên nhánh (nhánh `claude/<tên-ngẫu-nhiên>`
 *    mà nền tảng gán cho một số lượt routine — PR #62, #66 là ca thật) ra
 *    nhóm riêng `không suy được làn`, **không** bị bỏ khỏi bảng.
 * 2. PR **chưa có lần chạy CI nào** ra trạng thái riêng `chưa có`, không
 *    gộp vào `xanh`. Đó đúng là hình dạng `KF-002`: `automerge.yml` bỏ qua
 *    PR không có CI xanh, nên một PR như vậy đứng im mãi mà không ai đỏ.
 * 3. Issue mang nhãn `decision` mà **thiếu** cả `reversible` lẫn
 *    `irreversible` được đếm vào "Cần anh quyết" kèm chữ `chưa phân loại`.
 *    Thận trọng theo hướng an toàn: thừa một dòng trên bản tin chỉ tốn vài
 *    giây của chủ dự án, thiếu một dòng thì một nhánh việc nằm chờ vô hạn.
 * 4. **PR đang xung đột với `main`** (mục `P-007`) có mục riêng, kèm số giờ
 *    đã xung đột. Không dò được thì mục đó nói `CHƯA DÒ`, không nói `0` —
 *    một bản tin báo "không PR nào xung đột" trong khi hàng đợi đang tắc là
 *    đúng rủi ro **B7** mà `P-007` sinh ra để bịt.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readRunLogs, LANES, type LaneName, type RunLogLine } from '@crux/kernel';
import { parseBacklog, type BacklogItem } from './backlog-status.ts';
import { laneFromBranch } from './pr-triage.ts';
import { BUDGET_LOW_USD, budgetPercent, linesSince, sumCostUsd } from './update-metrics.ts';
import {
  conflictRows,
  measureConflicts,
  renderConflictRow,
  type ConflictOrigin,
  type ConflictRow,
} from './conflict-watch.ts';

// --- Dạng dữ liệu GitHub (đúng dạng `gh … --json` trả về) ---

export interface GhLabel {
  name: string;
}

/**
 * Một phần tử của `statusCheckRollup`. `gh` trả về **hai họ** trong cùng một
 * mảng: check run (có `status`/`conclusion`) và status context (có `state`).
 */
export interface GhCheck {
  name?: string;
  context?: string;
  status?: string;
  conclusion?: string | null;
  state?: string;
}

export interface GhPr {
  number: number;
  title: string;
  headRefName: string;
  labels?: GhLabel[];
  isDraft?: boolean;
  mergedAt?: string | null;
  statusCheckRollup?: GhCheck[] | null;
}

export interface GhIssue {
  number: number;
  title: string;
  labels?: GhLabel[];
}

export interface GithubSnapshot {
  mergedPrs: GhPr[];
  openPrs: GhPr[];
  decisionIssues: GhIssue[];
}

export function labelNames(labels: readonly GhLabel[] | undefined): string[] {
  return (labels ?? []).map((label) => label.name);
}

// --- PR merged trong 24 giờ, gom theo làn ---

/** Nhóm của một PR không suy được làn từ tên nhánh. Không phải tên làn thật, nên không trùng `LaneName`. */
export const UNKNOWN_LANE = 'không suy được làn';

export interface MergedGroup {
  lane: LaneName | typeof UNKNOWN_LANE;
  prs: Array<{ number: number; title: string; headRefName: string }>;
}

/**
 * PR merged từ `since` trở đi, gom theo làn suy từ tên nhánh.
 *
 * Thứ tự nhóm cố định theo `LANES` rồi tới nhóm `không suy được làn` —
 * bản tin đọc mỗi sáng, nên thứ tự đổi theo dữ liệu là thứ làm người đọc
 * mất mốc. Nhóm rỗng bị bỏ, nhóm `không suy được làn` thì không.
 */
export function mergedByLane(prs: readonly GhPr[], since: string): MergedGroup[] {
  const sinceMs = Date.parse(since);
  const buckets = new Map<string, MergedGroup['prs']>();
  for (const pr of prs) {
    if (typeof pr.mergedAt !== 'string') continue;
    // So bằng **mốc thời gian**, không so chuỗi: `gh` trả `mergedAt` ở mức
    // giây (`…T15:44:08Z`) còn `since` có mili giây (`…T15:44:08.293Z`), và
    // so chuỗi thì `'Z' > '.'` — một PR merged trong cùng giây với mốc cắt
    // bị tính nhầm là trong 24 giờ.
    const mergedMs = Date.parse(pr.mergedAt);
    // `mergedAt` không đọc được là dữ liệu hỏng, không phải "ngoài 24 giờ".
    // Giữ lại để nó hiện ra trên bản tin thay vì biến mất — cùng hướng thận
    // trọng với ba chỗ ở đầu file.
    if (Number.isFinite(mergedMs) && mergedMs < sinceMs) continue;
    const lane = laneFromBranch(pr.headRefName) ?? UNKNOWN_LANE;
    const bucket = buckets.get(lane) ?? [];
    bucket.push({ number: pr.number, title: pr.title, headRefName: pr.headRefName });
    buckets.set(lane, bucket);
  }

  const order: Array<LaneName | typeof UNKNOWN_LANE> = [...LANES, UNKNOWN_LANE];
  return order
    .filter((lane) => buckets.has(lane))
    .map((lane) => ({ lane, prs: buckets.get(lane)! }));
}

// --- Trạng thái CI của PR đang mở ---

export type CiState = 'xanh' | 'đỏ' | 'đang chạy' | 'chưa có';

const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale']);
const FAILED_STATES = new Set(['failure', 'error']);

/**
 * Gộp `statusCheckRollup` về một trạng thái.
 *
 * Thứ tự xét là **đỏ trước**: một job đỏ giữa năm job xanh vẫn là PR đỏ.
 * `chưa có` tách khỏi `xanh` — xem ghi chú 2 ở đầu file.
 */
export function rollupState(checks: readonly GhCheck[] | null | undefined): CiState {
  if (checks === null || checks === undefined || checks.length === 0) return 'chưa có';

  let running = false;
  for (const check of checks) {
    const conclusion = (check.conclusion ?? '').toLowerCase();
    const state = (check.state ?? '').toLowerCase();
    if (FAILED_CONCLUSIONS.has(conclusion) || FAILED_STATES.has(state)) return 'đỏ';

    const status = (check.status ?? '').toLowerCase();
    // Check run chưa xong: `status` khác `completed`. Status context chưa
    // xong: `state` là `pending`. Một phần tử không khai gì cả cũng tính là
    // chưa xong — không đoán nó đã xanh.
    const done = status === 'completed' || (state !== '' && state !== 'pending');
    if (!done) running = true;
  }
  return running ? 'đang chạy' : 'xanh';
}

export interface OpenPrRow {
  number: number;
  title: string;
  lane: LaneName | typeof UNKNOWN_LANE;
  labels: string[];
  isDraft: boolean;
  ci: CiState;
}

export function openPrRows(prs: readonly GhPr[]): OpenPrRow[] {
  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    lane: laneFromBranch(pr.headRefName) ?? UNKNOWN_LANE,
    labels: labelNames(pr.labels),
    isDraft: pr.isDraft === true,
    ci: rollupState(pr.statusCheckRollup),
  }));
}

// --- Mục `parked` ---

export interface ParkedItem {
  lane: string;
  id: string;
  title: string;
}

/**
 * Mọi mục `status: parked` trong một file backlog. Dùng `parseBacklog` của
 * `I-010` chứ không tự tách lại — một định nghĩa "mục backlog" cho cả repo.
 */
export function parkedItems(lane: string, content: string): ParkedItem[] {
  return parseBacklog(content)
    .filter((item) => item.status === 'parked')
    .map((item) => ({ lane, id: item.id, title: item.title }));
}

// --- Issue quyết định ---

export type DecisionKind = 'irreversible' | 'reversible' | 'chưa phân loại';

export interface DecisionRow {
  number: number;
  title: string;
  kind: DecisionKind;
}

export function classifyDecision(labels: readonly string[]): DecisionKind {
  if (labels.includes('irreversible')) return 'irreversible';
  if (labels.includes('reversible')) return 'reversible';
  return 'chưa phân loại';
}

/**
 * Tách issue `[QĐ]` đang mở theo nhãn.
 *
 * Chỉ xét issue có nhãn `decision` — bên gọi có thể đưa vào cả issue khác
 * (bản tin, cảnh báo) mà không làm hỏng số đếm.
 */
export function decisionRows(issues: readonly GhIssue[]): DecisionRow[] {
  return issues
    .filter((issue) => labelNames(issue.labels).includes('decision'))
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      kind: classifyDecision(labelNames(issue.labels)),
    }));
}

/**
 * Số việc chủ dự án phải quyết: `irreversible` cộng `chưa phân loại`.
 * `reversible` KHÔNG tính — theo `D-C06` agent làm ngay theo khuyến nghị,
 * chúng thuộc mục "Đã tự làm" của bản tin, không phải mục "Cần anh quyết".
 */
export function needOwnerCount(rows: readonly DecisionRow[]): number {
  return rows.filter((row) => row.kind !== 'reversible').length;
}

// --- Chi phí ---

export interface CostSummary {
  cost24h: number;
  total: number;
  budget: number;
  percent: number;
}

// --- Tiến độ (mục `platform/P-019`) ---

/**
 * Đợt của kế hoạch (CHARTER mục 10). Chỉ hai đợt có mục backlog sống ở
 * giai đoạn hiện tại: **Đợt 0** (khung, contract, hạ tầng vận hành) và
 * **Đợt 1** (các làn song song). Đợt 2–4 là cổng quyết định và vận hành,
 * chưa sinh mục theo làn — thêm vào `LANE_BATCH` khi tới lúc.
 */
export type Batch = 'Đợt 0' | 'Đợt 1';

/**
 * Mô hình khai báo (bất biến I6: mọi con số hiển thị có nguồn hoặc có mô
 * hình). Backlog **không** gắn thẻ đợt cho từng mục, nên đợt của một mục
 * suy từ **làn** của nó theo CHARTER mục 10: Đợt 0 là "khung, contract,
 * hạ tầng vận hành" (`kernel`, `platform`, `integration`), Đợt 1 là "các
 * làn song song" (sáu xưởng cộng `verify`). Đây là dữ liệu sẵn có, không
 * phải suy đoán từng mục — đổi kế hoạch thì đổi đúng một bảng này.
 */
export const LANE_BATCH: Record<LaneName, Batch> = {
  topic: 'Đợt 1',
  editorial: 'Đợt 1',
  visual: 'Đợt 1',
  audio: 'Đợt 1',
  assembly: 'Đợt 1',
  release: 'Đợt 1',
  verify: 'Đợt 1',
  kernel: 'Đợt 0',
  platform: 'Đợt 0',
  integration: 'Đợt 0',
};

/** Thứ tự hiển thị đợt trên bản tin — cố định, không đổi theo dữ liệu (cùng lý do `mergedByLane`). */
export const BATCH_ORDER: readonly Batch[] = ['Đợt 0', 'Đợt 1'];

/**
 * Ref của dòng log **bước 0** trên `main` hiện tại. Mỗi lượt worker và mỗi
 * lượt integrator chạy bước 0 đúng một lần và ghi đúng một dòng này (phụ
 * lục P1 bước 0, P3 bước 0, bất biến I8), nên đếm số dòng này trong 24 giờ
 * = số lượt chạy routine **có làm việc thật** — chính là số để kiểm giả
 * định `G3`. Lượt `crux-digest` không chạy bước 0 nên không tính ở đây;
 * đó là một lượt mỗi ngày, chủ dự án cộng tay nếu cần trần tuyệt đối.
 *
 * ⚠️ Mục `platform/P-023` chuyển dòng bước 0 sang file-mỗi-lượt
 * (`ops/logs/integration/step0-…`, `ref` mang lane `integration`). Khi
 * P-023 vào `main`, mở rộng `isStep0Line` cho khớp — nếu không số lượt tụt
 * về 0 một cách im lặng (đúng nhóm lỗi Z).
 */
export const STEP0_LOG_REF = 'platform/P-016';

function isStep0Line(line: Pick<RunLogLine, 'kind' | 'ref'>): boolean {
  return line.kind === 'lane' && line.ref === STEP0_LOG_REF;
}

/**
 * Làn của một PR mục việc, suy từ **tiêu đề** `[<lane>] <id> …` (P1 bước 4
 * bắt buộc mẫu này). Suy từ tiêu đề chứ không từ tên nhánh vì nhánh
 * log-only của routine (`claude/<tên-ngẫu-nhiên>`) không mang làn. `null`
 * nếu tiêu đề không theo mẫu hoặc làn lạ — khi đó PR không được tính là
 * một mục `done`.
 */
export function laneFromTitle(title: string): LaneName | null {
  const m = /^\[([a-z]+)\]\s+\S/.exec(title);
  if (m === null) return null;
  const lane = m[1]!;
  return (LANES as readonly string[]).includes(lane) ? (lane as LaneName) : null;
}

export interface BatchProgress {
  batch: Batch;
  /** Mục chưa `done` và không `parked`. */
  remaining: number;
  /** Mục `parked` — nằm ngoài dòng chảy, nên tách khỏi `remaining`. */
  parked: number;
  /** Số mục `done` của đợt này trong 3 ngày qua (đếm từ PR merged). */
  done3d: number;
  /**
   * Ngày dự kiến xong (chỉ phần ngày, `YYYY-MM-DD`), chiếu thẳng
   * `remaining / (done3d / 3)`. `null` khi chưa đủ dữ liệu để chiếu:
   * đợt không có mục nào `done` trong 3 ngày mà vẫn còn việc. Ngày hôm nay
   * nếu đợt đã hết `remaining`.
   */
  projectedDone: string | null;
}

export interface ProgressMetrics {
  doneLast24h: number;
  done3d: number;
  /** Thông lượng trung bình 3 ngày: `done3d / 3`, làm tròn hai chữ số. */
  throughputPerDay: number;
  byBatch: BatchProgress[];
  /**
   * Nút thắt hiện tại (mô hình, bất biến I6):
   * - `người` — có PR `owner-merge` đang mở **hoặc** quyết định
   *   `irreversible`/chưa phân loại đang chờ: chỉ chủ dự án gỡ được.
   * - `máy` — không vướng người nhưng có PR đang xung đột với `main`
   *   **hoặc** CI đỏ: xử lý tự động đang kẹt.
   * - `không tắc` — cả hai đều bằng 0.
   *
   * Người đứng trước máy: một việc chờ người thì máy chạy nhanh cỡ nào cũng
   * không tới `main` được.
   */
  bottleneck: 'người' | 'máy' | 'không tắc';
  /** Số lượt chạy routine (bước 0) trong 24 giờ — số liệu để kiểm `G3`. */
  routineRuns24h: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Phép tính thuần cho mục "Tiến độ" của bản tin. Không đọc đĩa, không gọi
 * mạng — bên gọi (`collectMetrics`) đưa vào backlog đã parse, PR merged,
 * dòng log, và hai số đếm nút thắt lấy từ snapshot GitHub.
 */
export function computeProgress(
  itemsByLane: ReadonlyMap<LaneName, readonly BacklogItem[]>,
  mergedPrs: readonly GhPr[],
  logLines: readonly RunLogLine[],
  humanWaiting: number,
  machineWaiting: number,
  now: Date,
): ProgressMetrics {
  const ms24 = now.getTime() - 24 * 60 * 60 * 1000;
  const ms3d = now.getTime() - 3 * 24 * 60 * 60 * 1000;

  let doneLast24h = 0;
  let done3d = 0;
  const done3dByBatch = new Map<Batch, number>();
  for (const pr of mergedPrs) {
    if (typeof pr.mergedAt !== 'string') continue;
    const t = Date.parse(pr.mergedAt);
    if (!Number.isFinite(t)) continue;
    const lane = laneFromTitle(pr.title);
    if (lane === null) continue; // PR không mang mã mục (gộp, revert…) — không phải một mục done.
    if (t >= ms24) doneLast24h++;
    if (t >= ms3d) {
      done3d++;
      const b = LANE_BATCH[lane];
      done3dByBatch.set(b, (done3dByBatch.get(b) ?? 0) + 1);
    }
  }

  const remainingByBatch = new Map<Batch, number>();
  const parkedByBatch = new Map<Batch, number>();
  for (const [lane, items] of itemsByLane) {
    const b = LANE_BATCH[lane];
    for (const item of items) {
      if (item.status === 'done') continue;
      const target = item.status === 'parked' ? parkedByBatch : remainingByBatch;
      target.set(b, (target.get(b) ?? 0) + 1);
    }
  }

  const byBatch: BatchProgress[] = BATCH_ORDER.map((batch) => {
    const remaining = remainingByBatch.get(batch) ?? 0;
    const parked = parkedByBatch.get(batch) ?? 0;
    const d3 = done3dByBatch.get(batch) ?? 0;
    const ratePerDay = d3 / 3;
    let projectedDone: string | null;
    if (remaining === 0) projectedDone = isoDate(now);
    else if (ratePerDay > 0)
      projectedDone = isoDate(new Date(now.getTime() + Math.ceil(remaining / ratePerDay) * 24 * 60 * 60 * 1000));
    else projectedDone = null;
    return { batch, remaining, parked, done3d: d3, projectedDone };
  });

  const routineRuns24h = logLines.filter(
    (l) => isStep0Line(l) && Number.isFinite(Date.parse(l.at)) && Date.parse(l.at) >= ms24,
  ).length;

  const bottleneck = humanWaiting > 0 ? 'người' : machineWaiting > 0 ? 'máy' : 'không tắc';

  return { doneLast24h, done3d, throughputPerDay: round2(done3d / 3), byBatch, bottleneck, routineRuns24h };
}

// --- Kết xuất ---

export interface DigestMetrics {
  since: string;
  merged: MergedGroup[];
  openPrs: OpenPrRow[];
  /**
   * PR đang xung đột với `main`, kẹt lâu nhất trước (mục `P-007`).
   * `null` — **không phải mảng rỗng** — khi lượt chạy không dò được (không
   * có git, hoặc bên gọi không truyền kết quả gộp thử vào). Xem ghi chú 4 ở
   * đầu file: `0` và `chưa dò` là hai chuyện khác nhau.
   */
  conflicts: ConflictRow[] | null;
  parked: ParkedItem[];
  decisions: DecisionRow[];
  cost: CostSummary;
  /** Mục "Tiến độ" (mục `platform/P-019`). */
  progress: ProgressMetrics;
}

function prLabel(row: OpenPrRow): string {
  const parts = [`#${row.number}`, `CI ${row.ci}`];
  if (row.isDraft) parts.push('nháp');
  if (row.labels.length > 0) parts.push(row.labels.join(', '));
  parts.push(row.title);
  return parts.join(' · ');
}

/**
 * Báo cáo tiếng Việt cho routine `crux-digest`.
 *
 * **Dòng đầu luôn là `Cần anh quyết: N việc`** — tiêu chí xong của `P-005`
 * và cũng là dòng đầu của bản tin (phụ lục P2). Không có ngoại lệ, kể cả
 * khi `N = 0`: một bản tin thiếu dòng đó là một bản tin mà chủ dự án phải
 * đọc kỹ mới biết có gì cần mình hay không.
 */
export function renderDigestMetrics(metrics: DigestMetrics): string {
  const out: string[] = [];
  const decisions = metrics.decisions;

  out.push(`Cần anh quyết: ${needOwnerCount(decisions)} việc`);
  for (const row of decisions.filter((r) => r.kind !== 'reversible')) {
    const suffix = row.kind === 'chưa phân loại' ? ' (chưa phân loại — thiếu nhãn reversible/irreversible)' : '';
    out.push(`- #${row.number} · ${row.title}${suffix}`);
  }

  const reversible = decisions.filter((r) => r.kind === 'reversible');
  out.push('', `Quyết định reversible đang mở: ${reversible.length}`);
  for (const row of reversible) out.push(`- #${row.number} · ${row.title}`);

  const mergedCount = metrics.merged.reduce((sum, group) => sum + group.prs.length, 0);
  out.push('', `PR merged từ ${metrics.since}: ${mergedCount}`);
  for (const group of metrics.merged) {
    out.push(`- ${group.lane}: ${group.prs.map((pr) => `#${pr.number}`).join(', ')}`);
  }

  out.push('', `PR đang mở: ${metrics.openPrs.length}`);
  for (const row of metrics.openPrs) out.push(`- ${prLabel(row)}`);

  // Mục `P-007`. Đặt ngay dưới "PR đang mở" vì nó là cách đọc thứ hai của
  // cùng hàng đợi đó: PR nào trong hàng đợi đang không nhúc nhích được.
  if (metrics.conflicts === null) {
    out.push('', 'PR đang xung đột với `main`: CHƯA DÒ — lượt chạy không có kết quả gộp thử');
  } else {
    out.push('', `PR đang xung đột với \`main\`: ${metrics.conflicts.length}`);
    for (const row of metrics.conflicts) out.push(`- ${renderConflictRow(row)}`);
  }

  out.push('', `Mục parked: ${metrics.parked.length}`);
  for (const item of metrics.parked) out.push(`- ${item.lane}/${item.id} · ${item.title}`);

  const { cost24h, total, budget, percent } = metrics.cost;
  out.push(
    '',
    `Chi phí: 24 giờ ${cost24h} USD · tích luỹ ${total} USD · ${percent}% ngân sách học (${budget} USD, CHARTER mục 8)`,
  );

  // Mục "Tiến độ" (mục `platform/P-019`, chỉ dẫn 3 của chủ dự án ở issue #17).
  const p = metrics.progress;
  out.push(
    '',
    'Tiến độ',
    `- Mục done 24 giờ: ${p.doneLast24h} · thông lượng 3 ngày: ${p.throughputPerDay} mục/ngày`,
  );
  for (const b of p.byBatch) {
    const parkedSuffix = b.parked > 0 ? ` (${b.parked} parked)` : '';
    const eta = b.projectedDone === null ? 'chưa đủ dữ liệu để chiếu' : b.projectedDone;
    out.push(`- ${b.batch}: ${b.remaining} mục còn lại${parkedSuffix} · dự kiến xong: ${eta}`);
  }
  out.push(
    `- Nút thắt hiện tại: ${p.bottleneck}`,
    `- Lượt chạy routine 24 giờ: ${p.routineRuns24h} (số để kiểm giả định G3)`,
  );

  return `${out.join('\n')}\n`;
}

// --- Lớp vỏ đọc đĩa / gọi `gh` ---

/**
 * Kết quả gộp thử của mục `P-007`: mốc kẹt của từng PR đang mở, khoá là số
 * PR. `null` cho một PR nghĩa là PR đó **không** xung đột. Bên gọi truyền
 * `null` cho cả tham số nghĩa là lượt chạy chưa dò gì cả.
 */
export type ConflictOrigins = ReadonlyMap<number, ConflictOrigin | null>;

export function collectMetrics(
  root: string,
  snapshot: GithubSnapshot,
  now: Date,
  origins: ConflictOrigins | null = null,
): DigestMetrics {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const lanesDir = join(root, 'ops', 'lanes');
  const parked: ParkedItem[] = [];
  // Cùng lý do với `mergedByLane`: bản tin đọc mỗi sáng, nên thứ tự đổi
  // theo dữ liệu là thứ làm người đọc mất mốc. `readdirSync` KHÔNG bảo đảm
  // thứ tự, nên xếp theo `LANES`; thư mục lạ (không phải tên làn) vẫn được
  // giữ, xếp cuối theo bảng chữ cái — bỏ nó đi là bỏ im lặng.
  const known = LANES as readonly string[];
  const laneDirs = readdirSync(lanesDir).sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia === -1 && ib === -1) return a < b ? -1 : a > b ? 1 : 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  // Mục `platform/P-019`: cùng vòng đọc backlog dùng cho "Tiến độ", gom
  // mục theo làn. Chỉ làn hợp lệ (`LANES`) mới vào bảng đợt — thư mục lạ
  // không suy được đợt, nhưng mục `parked` của nó vẫn được giữ.
  const itemsByLane = new Map<LaneName, readonly BacklogItem[]>();
  const knownLane = new Set<string>(LANES as readonly string[]);
  for (const lane of laneDirs) {
    const path = join(lanesDir, lane, 'backlog.md');
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    parked.push(...parkedItems(lane, content));
    if (knownLane.has(lane)) itemsByLane.set(lane as LaneName, parseBacklog(content));
  }

  // Bất biến I8: tiền đọc từ log qua `readRunLogs` — nó gom nhiều file và
  // sắp theo `at`, thứ mà `merge=union` không làm (CLAUDE.md mục 15).
  const logLines = readRunLogs(join(root, 'ops', 'logs'));
  const total = sumCostUsd(logLines);
  const cost24h = sumCostUsd(linesSince(logLines, since));

  // Mục `P-007`. Chỉ PR **đã dò ra mốc** mới vào mục xung đột. Hai ca rơi
  // ra ngoài và cả hai đều đúng: khoá có mà giá trị `null` là PR gộp sạch;
  // khoá vắng hẳn là PR chưa dò. Ca thứ hai không xảy ra ở đường đang
  // dùng — `measureConflicts` đặt khoá cho MỌI số PR — nhưng bên gọi có
  // thể đưa vào một map dựng tay, nên bộ lọc phải chịu được cả hai. Số PR
  // ở mục "PR đang mở" ngay trên vẫn đủ để thấy chênh lệch.
  const conflicts =
    origins === null
      ? null
      : conflictRows(
          snapshot.openPrs
            .filter((pr) => origins.get(pr.number) != null)
            .map((pr) => ({
              number: pr.number,
              title: pr.title,
              labels: labelNames(pr.labels),
              origin: origins.get(pr.number)!,
            })),
          now.toISOString(),
        );

  const openPrs = openPrRows(snapshot.openPrs);
  const decisions = decisionRows(snapshot.decisionIssues);

  // Nút thắt (mục `platform/P-019`). Người: PR `owner-merge` đang mở, cộng
  // quyết định đang chờ chủ dự án. Máy: PR đang xung đột (đã dò), cộng PR
  // CI đỏ. `conflicts === null` (chưa dò) đóng góp 0 — không đoán là có tắc.
  const humanWaiting = openPrs.filter((row) => row.labels.includes('owner-merge')).length + needOwnerCount(decisions);
  const machineWaiting = (conflicts?.length ?? 0) + openPrs.filter((row) => row.ci === 'đỏ').length;
  const progress = computeProgress(itemsByLane, snapshot.mergedPrs, logLines, humanWaiting, machineWaiting, now);

  return {
    since,
    merged: mergedByLane(snapshot.mergedPrs, since),
    openPrs,
    conflicts,
    parked,
    decisions,
    cost: { cost24h, total, budget: BUDGET_LOW_USD, percent: budgetPercent(total) },
    progress,
  };
}

const PR_FIELDS = 'number,title,headRefName,labels,isDraft,mergedAt';

function gh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  // `error` là ca `gh` không có trong PATH. Ném chứ không trả mảng rỗng:
  // một bản tin nói "0 PR đang mở, 0 việc cần anh quyết" vì thiếu công cụ
  // trông giống hệt một ngày yên ả.
  if (result.error !== undefined) {
    throw new Error(
      `Không gọi được \`gh\` (${result.error.message}). Dùng \`--github <file.json>\` nếu lượt chạy không có gh.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`\`gh ${args.join(' ')}\` thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export function fetchSnapshot(): GithubSnapshot {
  return {
    mergedPrs: JSON.parse(gh(['pr', 'list', '--state', 'merged', '--json', PR_FIELDS, '--limit', '200'])) as GhPr[],
    openPrs: JSON.parse(
      gh(['pr', 'list', '--state', 'open', '--json', `${PR_FIELDS},statusCheckRollup`, '--limit', '200']),
    ) as GhPr[],
    decisionIssues: JSON.parse(
      gh(['issue', 'list', '--state', 'open', '--label', 'decision', '--json', 'number,title,labels', '--limit', '200']),
    ) as GhIssue[],
  };
}

function readSnapshotFile(path: string): GithubSnapshot {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<GithubSnapshot>;
  // Thiếu khoá nào thì ném, không mặc định thành mảng rỗng: một khoá viết
  // sai tên sẽ lặng lẽ biến thành "không có việc nào".
  for (const key of ['mergedPrs', 'openPrs', 'decisionIssues'] as const) {
    if (!Array.isArray(parsed[key])) {
      throw new Error(`File --github thiếu mảng \`${key}\`: ${path}`);
    }
  }
  return parsed as GithubSnapshot;
}

/**
 * Mốc kẹt của mục `P-007`, đo bằng gộp thử — và **không bao giờ kéo cả bản
 * tin xuống theo nếu hỏng**.
 *
 * `measureConflicts` ném khi `git fetch` hụt (mất mạng, một PR từ fork, một
 * `refs/pull/<n>/head` không nạp được). Để nó ném ra khỏi `main()` thì bản
 * tin **không in được dòng nào** — mất luôn "Cần anh quyết", chi phí, mục
 * `parked`. Một tính năng mới hạ được một tính năng đang chạy là cái giá
 * không đáng, và nó đánh thẳng vào "Một hộp duy nhất" (`CLAUDE.md` mục 14).
 *
 * Nên hỏng thì rơi về `null`, tức bản tin in `CHƯA DÒ` — đường mà chính
 * mục này thiết kế ra, và trước đây chỉ tới được khi **người** gõ
 * `--no-conflicts`. Lý do hỏng đi ra `stderr`: rơi về `CHƯA DÒ` mà không
 * nói vì sao thì lượt sau không biết phải sửa gì.
 */
export function probeOrigins(root: string, snapshot: GithubSnapshot, argv: readonly string[]): ConflictOrigins | null {
  if (argv.includes('--no-conflicts')) return null;
  try {
    return measureConflicts(
      root,
      snapshot.openPrs.map((pr) => pr.number),
    );
  } catch (error) {
    process.stderr.write(
      `Không dò được PR xung đột, bản tin sẽ in CHƯA DÒ: ${(error as Error).message}\n`,
    );
    return null;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const githubIndex = argv.indexOf('--github');

  let snapshot: GithubSnapshot;
  if (githubIndex === -1) {
    snapshot = fetchSnapshot();
  } else {
    const path = argv[githubIndex + 1];
    // `--github` không kèm đường dẫn (hoặc theo sau là một cờ khác) phải
    // ném ngay, không rơi vào `readFileSync('')` rồi ra một lỗi ENOENT
    // không nói được người gọi thiếu gì.
    if (path === undefined || path.startsWith('--')) {
      throw new Error('`--github` cần một đường dẫn file JSON đi kèm.');
    }
    snapshot = readSnapshotFile(path);
  }

  // Mục `P-007`: mốc kẹt đo bằng gộp thử, không đọc ra từ văn xuôi trong
  // `note` của log. `--no-conflicts` cho lượt chạy không có kho git đầy đủ
  // — và khi đó bản tin in `CHƯA DÒ`, không in `0`.
  const root = process.cwd();
  const metrics = collectMetrics(root, snapshot, new Date(), probeOrigins(root, snapshot, argv));

  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(metrics, null, 2)}\n` : renderDigestMetrics(metrics));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
