#!/usr/bin/env node
/**
 * Cơ chế của mục `platform/P-027` (`ops/known-failures.md` **KF-011**),
 * tiêu chí "**đo trước, sửa sau**": cửa `automerge-delayed` **có chảy
 * không** — trả lời bằng SỐ cho mỗi PR mang nhãn đó, không bằng văn xuôi.
 *
 * ## Vì sao cần đo tách khỏi việc sửa
 *
 * Hệ quả "đồng hồ 12 giờ bị bước 0 đặt lại" **đã** được ghi nhiều lần —
 * mô tả `#85`, `#39`, phụ lục P3 bước 0c, một tiêu chí của `P-026`. Nhưng
 * mọi chỗ đó ghi nó cho **một lượt**, như một khoản phí phải trả. Không
 * chỗ nào cộng lại theo thời gian để hỏi câu duy nhất quan trọng: *ngưỡng
 * 12 giờ có bao giờ tới không.* Số đo một lượt thì vô hại; số đo tích luỹ
 * nói rằng cửa này đóng. Tool này là chỗ cộng lại đó.
 *
 * Ba số cho mỗi PR `automerge-delayed`, đúng tiêu chí xong của `P-027`:
 *
 * - **khoảng trống đầu-nhánh-không-đổi dài nhất** (`longestStableHours`) —
 *   cửa sổ dài nhất mà đầu nhánh đứng yên, tức khoảng dài nhất đồng hồ 12
 *   giờ **có thể** đã chạy. Đây là cận **trên** của thời gian chờ thật:
 *   đồng hồ merge-gate bắt đầu từ lúc **CI xanh** trên đầu nhánh, muộn hơn
 *   mốc commit vài phút, nên tool này đo phần đầu-nhánh-không-đổi (đọc
 *   được từ `git log`) chứ không trừ thời gian CI. Khai thẳng ở đây để số
 *   không bị đọc chặt hơn mức nó chịu được.
 * - **số lần đặt lại đồng hồ** (`clockResets`) — mỗi lần đổi đầu nhánh sau
 *   lần đầu là một lần đồng hồ về 0 (CHARTER 3.3). `headChanges - 1`.
 * - **số giờ còn thiếu so với ngưỡng** (`hoursShort`) — `delayHours` trừ
 *   khoảng đầu-nhánh-không-đổi **hiện tại** (`currentStableHours`), kẹp về
 *   0 khi đã đạt ngưỡng.
 *
 * ## Nguồn: `git log --first-parent` cộng nhãn — KHÔNG đọc văn xuôi log
 *
 * Tiêu chí xong của `P-027` chốt nguồn: mốc mỗi lần đổi đầu nhánh lấy từ
 * `git log --first-parent --format=%cI` trên `refs/pull/<n>/head`, còn nhãn
 * do bên gọi đưa vào (từ API GitHub). KHÔNG đọc số giờ ra khỏi trường
 * `note` tiếng Việt của các dòng log bước 0 — đó đúng là thứ
 * hỏng im lặng ngay lần đầu ai viết khác đi một chữ, cùng lỗi mà
 * `conflict-watch.ts` (mục `P-007`) đã tránh khi đo mốc kẹt. (Không nhắc
 * đích danh một tên file log bước 0 ở đây là có chủ đích: bất biến của
 * `P-023` cấm mọi file code neo vào một đường dẫn log bước 0 cố định —
 * xem `ops/test/step0-log-path.test.ts` và `KF-013`.)
 *
 * `refs/pull/<n>/head` chứ không phải tên nhánh: một số PR routine mang tên
 * nhánh do nền tảng gán (`claude/<tên ngẫu nhiên>`, PR #62/#66/#70 là ca
 * thật) và nhánh có thể đã bị xoá, còn `refs/pull` thì GitHub luôn giữ
 * chừng nào PR còn mở.
 *
 * ## Ranh giới: tool này KHÔNG sửa cơ chế
 *
 * Bản sửa cơ chế (phương án A hoặc B của `P-027`) chạm `ops/invariants.*`
 * (cửa `owner-merge`) hoặc đổi ý nghĩa bất biến I4 (`irreversible`), nên nó
 * chờ câu trả lời của chủ dự án ở issue `🤖 [QĐ] #116`. Tool này chỉ **đo**
 * — cửa `open`, đảo ngược được, không đứng sau quyết định nào.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { hoursBetween, prHeadRef, fetchProbeRefs } from './conflict-watch.ts';
import { DEFAULT_DELAY_HOURS } from '../invariants.merge-gate.ts';

/** Nhãn cửa `automerge-delayed` — cùng chuỗi mà `merge-gate.ts` đòi. */
export const DELAYED_LABEL = 'automerge-delayed';

/**
 * Số lần đổi đầu nhánh đọc lại tối đa cho mỗi PR. Đo thật (`P-027`): PR
 * đổi đầu nhánh nhiều nhất trong 24 giờ là ~52 lần (`#112`), nên 200 phủ
 * trọn nhiều ngày. Cùng lý do `GIT_MAX_BUFFER` của `conflict-watch.ts`,
 * cửa sổ có đáy để một PR cực dài không kéo dài vô hạn một lượt đo.
 */
export const HEAD_LOG_DEPTH = 200;

/**
 * `maxBuffer` mặc định 1 MiB bị vượt thì `spawnSync` cắt cụt stdout mà vẫn
 * có thể `status === 0` — hình dạng nhóm Z. Cùng phòng thủ với
 * `conflict-watch.ts`.
 */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: readonly string[]) {
  return spawnSync('git', [...args], { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

// ── Phần thuần ───────────────────────────────────────────────────────────

export interface GateFlowInput {
  number: number;
  title: string;
  labels: readonly string[];
  /**
   * Mốc mỗi lần đổi đầu nhánh (mỗi commit `--first-parent`), ISO 8601,
   * **MỚI TRƯỚC CŨ SAU** — đúng thứ tự `git log` trả về.
   */
  headChangesNewestFirst: readonly string[];
}

export interface GateFlowRow {
  number: number;
  title: string;
  /** PR có mang nhãn `automerge-delayed` không. */
  isDelayed: boolean;
  /** Số lần đổi đầu nhánh quan sát được (số commit `--first-parent`). */
  headChanges: number;
  /** Số lần đồng hồ 12 giờ về 0 = `headChanges - 1`, không âm. */
  clockResets: number;
  /**
   * Khoảng đầu-nhánh-không-đổi **dài nhất** (giờ), kể cả khoảng hiện tại
   * tới `now`. `null` khi không có commit nào đọc được.
   */
  longestStableHours: number | null;
  /** Khoảng đầu-nhánh-không-đổi **hiện tại**: giờ kể từ lần đổi gần nhất. */
  currentStableHours: number | null;
  /** `delayHours` trừ `currentStableHours`, kẹp về 0. `null` khi không đo được. */
  hoursShort: number | null;
  /** Đã từng có một cửa sổ đứng yên `≥ delayHours` chưa. */
  everReachedThreshold: boolean;
  /**
   * Commit gần nhất nằm ở **tương lai** so với `now` — đồng hồ runner lệch.
   * Số giờ được kẹp về 0 chứ không in âm, nhưng cờ này phải nổi lên: cùng
   * lý do `clockSkew` của `conflict-watch.ts`.
   */
  clockSkew: boolean;
}

/**
 * Một hàng đo cho một PR. Hàm thuần: mọi mốc thời gian và nhãn là đầu vào,
 * không chạm git, không chạm đồng hồ hệ thống ngoài `now` được truyền vào.
 */
export function gateFlowRow(input: GateFlowInput, now: string, delayHours: number): GateFlowRow {
  const isDelayed = input.labels.some((label) => label.toLowerCase() === DELAYED_LABEL);
  const commits = input.headChangesNewestFirst;
  const headChanges = commits.length;
  const clockResets = Math.max(0, headChanges - 1);

  if (headChanges === 0) {
    return {
      number: input.number,
      title: input.title,
      isDelayed,
      headChanges: 0,
      clockResets: 0,
      longestStableHours: null,
      currentStableHours: null,
      hoursShort: null,
      everReachedThreshold: false,
      clockSkew: false,
    };
  }

  // Khoảng hiện tại: từ lần đổi đầu nhánh gần nhất (commits[0]) tới `now`.
  const currentRaw = hoursBetween(commits[0]!, now);
  const clockSkew = currentRaw < 0;
  const currentStableHours = Math.max(currentRaw, 0);

  // Mọi cửa sổ đứng yên: khoảng hiện tại, cộng khoảng giữa từng cặp commit
  // liền nhau (cũ → mới, nên dương). commits[i] cũ hơn commits[i-1].
  const windows = [currentStableHours];
  for (let i = 1; i < commits.length; i += 1) {
    windows.push(Math.max(hoursBetween(commits[i]!, commits[i - 1]!), 0));
  }
  const longestStableHours = windows.reduce((max, value) => (value > max ? value : max), 0);

  return {
    number: input.number,
    title: input.title,
    isDelayed,
    headChanges,
    clockResets,
    longestStableHours,
    currentStableHours,
    hoursShort: Math.max(0, Math.round((delayHours - currentStableHours) * 100) / 100),
    everReachedThreshold: longestStableHours >= delayHours,
    clockSkew,
  };
}

/**
 * Hàng đo cho mọi PR đầu vào, **PR `automerge-delayed` gần ngưỡng nhất
 * trước** (nhỏ `hoursShort` trước) để bản tin đọc "PR nào sắp tới hạn" ở
 * đầu bảng. PR không mang nhãn xếp sau các PR mang nhãn, và PR không đo
 * được (`hoursShort: null`) xếp cuối — "không đo được" là trạng thái phải
 * hiện ra, không phải lý do để biến mất.
 */
export function gateFlowRows(inputs: readonly GateFlowInput[], now: string, delayHours: number): GateFlowRow[] {
  const rows = inputs.map((input) => gateFlowRow(input, now, delayHours));
  return rows.sort((a, b) => {
    if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1;
    if (a.hoursShort === null && b.hoursShort === null) return a.number - b.number;
    if (a.hoursShort === null) return 1;
    if (b.hoursShort === null) return -1;
    if (a.hoursShort !== b.hoursShort) return a.hoursShort - b.hoursShort;
    return a.number - b.number;
  });
}

export interface GateFlowVerdict {
  /** Số PR mang nhãn `automerge-delayed` trong đầu vào. */
  delayedCount: number;
  /**
   * Số PR `automerge-delayed` từng có một cửa sổ đầu-nhánh-không-đổi
   * `≥ delayHours`. Đây là điều kiện **cần** để đồng hồ chạy hết, KHÔNG
   * phải điều kiện đủ để merge — một PR có thể đạt cửa sổ đó rồi vẫn trượt
   * vì `automerge.yml` chạy theo cron và lần chạy rơi ngoài cửa sổ (ca `#42`
   * của `P-027`), hoặc vì `KF-009` báo `dirty`. `0` với `delayedCount > 0`
   * là chữ ký nặng nhất của KF-011: không PR nào có nổi cửa sổ đủ dài.
   */
  reachedThresholdCount: number;
  /** Số PR `automerge-delayed` **hiện đang** ở/quá ngưỡng (`hoursShort === 0`). */
  atThresholdNow: number;
  /** Tổng số lần đặt lại đồng hồ trên các PR `automerge-delayed`. */
  totalResets: number;
}

/**
 * Câu trả lời gộp cho "cửa `automerge-delayed` có chảy không", bằng số
 * thuần — tool này KHÔNG đọc được PR nào đã merge (đó là việc quét PR đã
 * đóng, tiêu chí khác của `P-027`), nên nó không tuyên bố "đã merge". Nó
 * chỉ đo thứ đọc được từ `git log`: có PR nào có nổi một cửa sổ đủ dài để
 * đồng hồ 12 giờ chạy hết không.
 */
export function gateFlowVerdict(rows: readonly GateFlowRow[]): GateFlowVerdict {
  const delayed = rows.filter((row) => row.isDelayed);
  return {
    delayedCount: delayed.length,
    reachedThresholdCount: delayed.filter((row) => row.everReachedThreshold).length,
    atThresholdNow: delayed.filter((row) => row.hoursShort === 0).length,
    totalResets: delayed.reduce((sum, row) => sum + row.clockResets, 0),
  };
}

/** Một dòng tiếng Việt cho một PR. Dạng hợp phụ lục P2 mục "Đang chờ merge". */
export function renderGateFlowRow(row: GateFlowRow, delayHours: number): string {
  const parts = [`#${row.number}`];
  if (!row.isDelayed) parts.push('KHÔNG mang nhãn automerge-delayed');
  if (row.headChanges === 0) {
    parts.push('không đọc được lần đổi đầu nhánh nào');
  } else {
    parts.push(`đổi đầu nhánh ${row.headChanges} lần (đặt lại đồng hồ ${row.clockResets})`);
    parts.push(`trống dài nhất ${row.longestStableHours!.toFixed(2)} giờ`);
    parts.push(`hiện ${row.currentStableHours!.toFixed(2)}/${delayHours} giờ, còn thiếu ${row.hoursShort!.toFixed(2)}`);
    parts.push(row.everReachedThreshold ? 'ĐÃ TỪNG đạt ngưỡng' : 'CHƯA BAO GIỜ đạt ngưỡng');
  }
  if (row.clockSkew) parts.push('⚠️ commit gần nhất ở TƯƠNG LAI — đồng hồ lệch, số giờ kẹp về 0');
  parts.push(row.title);
  return parts.join(' · ');
}

/** Câu kết luận tiếng Việt cho verdict gộp. */
export function renderGateFlowVerdict(verdict: GateFlowVerdict, delayHours: number): string {
  if (verdict.delayedCount === 0) return 'Không có PR `automerge-delayed` nào để đo.';
  const signal =
    verdict.reachedThresholdCount === 0
      ? `KHÔNG PR nào từng có cửa sổ đứng yên đủ ${delayHours} giờ (KF-011)`
      : `${verdict.reachedThresholdCount}/${verdict.delayedCount} PR từng có cửa sổ ≥ ${delayHours} giờ`;
  return (
    `${verdict.delayedCount} PR automerge-delayed · ${verdict.atThresholdNow} đang ở/quá ngưỡng ${delayHours} giờ · ` +
    `${signal} · tổng ${verdict.totalResets} lần đặt lại đồng hồ.`
  );
}

// ── Phần chạm git ────────────────────────────────────────────────────────

/**
 * Mốc mỗi lần đổi đầu nhánh **của riêng PR**, MỚI TRƯỚC CŨ SAU, đọc bằng
 * `git log --first-parent --format=%cI <mainRef>..<refs/pull/<n>/head>`.
 *
 * Hai luật thiết kế, cả hai đều là chỗ dễ làm sai:
 *
 * 1. **`--first-parent`** để một commit gộp `main` của bước 0 tính đúng
 *    **một** lần đổi đầu nhánh, không kéo theo cả lịch sử `main` vừa gộp.
 * 2. **`<mainRef>..`** để chỉ đếm commit **thuộc riêng PR**, cắt bỏ tổ tiên
 *    chung với `main`. Bỏ khoảng này thì `--first-parent` đi tiếp qua điểm
 *    rẽ nhánh vào lịch sử của `main` (tới đáy `depth`), nên `clockResets`
 *    đếm cả commit nền/`main` vốn chưa bao giờ là một lần push lên PR, và
 *    một khoảng trống dài trong lịch sử `main` có thể làm `everReachedThreshold`
 *    đúng sai — che tín hiệu KF-011 ở đúng nhịp thưa 1–2 lần/ngày (D-C06).
 *
 * Ném khi git hỏng hoặc PR không có commit nào ngoài `main`: một mảng rỗng
 * ở đây cho ra "PR không đổi đầu nhánh lần nào", tức đánh giá sai là PR đã
 * đứng yên — đúng nhóm Z.
 */
export function prHeadChanges(cwd: string, number: number, mainRef = 'origin/main', depth = HEAD_LOG_DEPTH): string[] {
  const ref = prHeadRef(number);
  const result = git(cwd, ['log', '--first-parent', `--max-count=${depth}`, '--format=%cI', `${mainRef}..${ref}`]);
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`Không đọc được lịch sử đầu nhánh của PR #${number} (${mainRef}..${ref}): ${result.error?.message ?? result.stderr}`);
  }
  const commits = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (commits.length === 0) {
    throw new Error(`\`git log ${mainRef}..${ref}\` không cho commit nào — PR #${number} không có commit nào ngoài \`${mainRef}\`, không đo được đầu nhánh.`);
  }
  return commits;
}

export interface PrLabelInput {
  number: number;
  title: string;
  labels: readonly string[];
}

/**
 * Đo cửa `automerge-delayed` cho một danh sách PR. Nạp `refs/pull/<n>/head`
 * về trong một `git fetch` (dùng lại `fetchProbeRefs` của
 * `conflict-watch.ts`), rồi đọc lần đổi đầu nhánh của từng PR bằng
 * `git log --first-parent`.
 */
export function measureGateFlow(
  cwd: string,
  prs: readonly PrLabelInput[],
  now: string,
  delayHours: number,
  mainRef = 'origin/main',
): { rows: GateFlowRow[]; verdict: GateFlowVerdict } {
  fetchProbeRefs(cwd, prs.map((pr) => pr.number));
  const inputs: GateFlowInput[] = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    labels: pr.labels,
    headChangesNewestFirst: prHeadChanges(cwd, pr.number, mainRef),
  }));
  const rows = gateFlowRows(inputs, now, delayHours);
  return { rows, verdict: gateFlowVerdict(rows) };
}

// ── CLI ──────────────────────────────────────────────────────────────────

/**
 * `node ops/scripts/gate-flow.ts --prs <file.json>` — `<file.json>` là
 * `[{ "number", "title", "labels" }]` lấy từ API GitHub (đây là chỗ "nhãn"
 * đi vào; `git log` lo phần còn lại). In JSON gồm `verdict`, `rows` và các
 * dòng tiếng Việt đã render.
 */
function main(): void {
  const flag = process.argv.indexOf('--prs');
  if (flag === -1 || process.argv[flag + 1] === undefined) {
    process.stderr.write('Dùng: node ops/scripts/gate-flow.ts --prs <file.json>\n');
    process.exit(2);
  }
  const prs = JSON.parse(readFileSync(process.argv[flag + 1]!, 'utf8')) as PrLabelInput[];
  const now = new Date().toISOString();
  const delayHours = DEFAULT_DELAY_HOURS;
  const { rows, verdict } = measureGateFlow(process.cwd(), prs, now, delayHours);
  process.stdout.write(
    `${JSON.stringify(
      {
        now,
        delayHours,
        verdict,
        verdictLine: renderGateFlowVerdict(verdict, delayHours),
        rows,
        lines: rows.map((row) => renderGateFlowRow(row, delayHours)),
      },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
