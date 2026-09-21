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
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readRunLogs, LANES, type LaneName } from '@crux/kernel';
import { parseBacklog } from './backlog-status.ts';
import { laneFromBranch } from './pr-triage.ts';
import { BUDGET_LOW_USD, budgetPercent, linesSince, sumCostUsd } from './update-metrics.ts';

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

// --- Kết xuất ---

export interface DigestMetrics {
  since: string;
  merged: MergedGroup[];
  openPrs: OpenPrRow[];
  parked: ParkedItem[];
  decisions: DecisionRow[];
  cost: CostSummary;
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

  out.push('', `Mục parked: ${metrics.parked.length}`);
  for (const item of metrics.parked) out.push(`- ${item.lane}/${item.id} · ${item.title}`);

  const { cost24h, total, budget, percent } = metrics.cost;
  out.push(
    '',
    `Chi phí: 24 giờ ${cost24h} USD · tích luỹ ${total} USD · ${percent}% ngân sách học (${budget} USD, CHARTER mục 8)`,
  );

  return `${out.join('\n')}\n`;
}

// --- Lớp vỏ đọc đĩa / gọi `gh` ---

export function collectMetrics(root: string, snapshot: GithubSnapshot, now: Date): DigestMetrics {
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
  for (const lane of laneDirs) {
    const path = join(lanesDir, lane, 'backlog.md');
    if (!existsSync(path)) continue;
    parked.push(...parkedItems(lane, readFileSync(path, 'utf8')));
  }

  // Bất biến I8: tiền đọc từ log qua `readRunLogs` — nó gom nhiều file và
  // sắp theo `at`, thứ mà `merge=union` không làm (CLAUDE.md mục 15).
  const logLines = readRunLogs(join(root, 'ops', 'logs'));
  const total = sumCostUsd(logLines);
  const cost24h = sumCostUsd(linesSince(logLines, since));

  return {
    since,
    merged: mergedByLane(snapshot.mergedPrs, since),
    openPrs: openPrRows(snapshot.openPrs),
    parked,
    decisions: decisionRows(snapshot.decisionIssues),
    cost: { cost24h, total, budget: BUDGET_LOW_USD, percent: budgetPercent(total) },
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

  const metrics = collectMetrics(process.cwd(), snapshot, new Date());

  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(metrics, null, 2)}\n` : renderDigestMetrics(metrics));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
