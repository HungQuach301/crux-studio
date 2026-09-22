#!/usr/bin/env node
/**
 * Cơ chế **đo** của mục `platform/P-027` (`ops/lanes/platform/backlog.md`),
 * tiêu chí xong thứ nhất: *đo trước, sửa sau*.
 *
 * Câu hỏi mà file này trả lời bằng số, không bằng văn xuôi: **cửa
 * `automerge-delayed` có chảy không?** Bất biến I4 hứa một PR mang nhãn đó
 * vào `main` sau 12 giờ CI xanh. `ops/invariants.merge-gate.ts` đo 12 giờ
 * từ lần CI xanh **trên đúng đầu nhánh hiện tại**, nên mỗi commit mới đặt
 * đồng hồ về 0 — và bước 0 của phụ lục P3 (chạy ở đầu **mọi** lượt worker)
 * đẻ một commit gộp mỗi lượt. Không thành phần nào hỏng; chỗ hỏng là vòng
 * phản hồi giữa hai cơ chế đều đúng, nên đọc từng file riêng sẽ không thấy.
 * Đúng nhóm **Z** (`ops/known-failures.md` **KF-011**).
 *
 * **Phát biểu chính xác mà phép đo này cho phép** — và chỉ phát biểu đó,
 * không hơn: đồng hồ 12 giờ chỉ chạy trong lúc **đầu nhánh không đổi**, nên
 * *khoảng đứng yên dài nhất* của một PR là **cận trên** của số giờ đồng hồ
 * từng chạy liên tục. Khoảng đó ngắn hơn ngưỡng ⇒ cửa **chắc chắn** chưa
 * từng mở được cho PR đó. Dài hơn ngưỡng thì mới *có thể* mở — CI còn phải
 * xanh xong trước đã, và `automerge.yml` chạy theo `cron` nên còn phải rơi
 * trúng một lượt. Vì vậy `hoursShort` ở đây là **số giờ còn thiếu ít nhất**,
 * không phải số giờ còn lại đúng bằng đồng hồ thật.
 *
 * **Hai giả định ngầm, khai ra chứ không để ngầm** — cả hai đều làm kết
 * luận "chắc chắn" ở trên yếu đi nếu vỡ:
 *
 * 1. **Lịch sử nhánh không bị viết lại.** `rebase`, `amend` hay force-push
 *    đặt `%cI` về hiện tại, nên khoảng đứng yên đo được **co lại** và một
 *    PR từng đủ ngưỡng có thể bị kết luận nhầm là chưa. `CLAUDE.md` mục 2
 *    cấm force-push lên nhánh của người khác, nên ca này hiếm — nhưng hiếm
 *    không phải là không.
 * 2. **`headCommitsInWindow` đếm COMMIT, không đếm lần push.** Ba commit
 *    push chung một lần chỉ đổi đầu nhánh **một** lần, tức đồng hồ chỉ về 0
 *    một lần. Nên con số này là **cận trên** của số lần đặt lại, và nó chỉ
 *    dùng để nói "PR này bị đụng dày tới mức nào", không dùng làm số lần
 *    đặt lại chính xác.
 *
 * **Nguồn dữ liệu là `git log --first-parent` cộng nhãn PR**, đúng như tiêu
 * chí xong đòi — **không** đọc văn xuôi trong trường `note` của
 * `ops/logs/**`. Lý do: `note` do agent viết tay mỗi lượt; tin nó thì phép
 * đo chỉ tốt bằng trí nhớ của lượt chạy đã viết ra nó, và ca này lộ ra
 * chính vì mọi lượt đều đã ghi đúng "đồng hồ đặt lại" mà không ai cộng lại.
 *
 * Cùng triết lý tách lớp với `conflict-watch.ts` và `digest-metrics.ts`:
 * mọi phép tính là **hàm thuần** kiểm được bằng dữ liệu giả lập; phần gọi
 * `git` gom vào cuối file; `main()` chỉ là lớp vỏ mỏng.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { LaneName } from '@crux/kernel';
import { DEFAULT_DELAY_HOURS } from '../invariants.merge-gate.ts';
import { fetchProbeRefs, hoursBetween, prHeadRef } from './conflict-watch.ts';
import { laneFromBranch } from './pr-triage.ts';

/** Nhãn của cửa đang đo (D-C06 điểm 2, `LABEL_FOR_GATE` trong `invariants.merge-gate.ts`). */
export const DELAYED_LABEL = 'automerge-delayed';

/**
 * Cửa sổ đếm số lần đặt lại đồng hồ. 24 giờ vì nó là nhịp của bản tin
 * (phụ lục P2) — cùng khoảng với "PR merged 24 giờ qua" và "chi phí 24
 * giờ", nên hai con số cạnh nhau trên bản tin nói về cùng một quãng.
 */
export const DEFAULT_WINDOW_HOURS = 24;

/**
 * Từ lần đặt lại thứ ba trở đi, dòng bản tin phải **nói ra**. Cùng ngưỡng
 * với `ABORTED_INELIGIBLE_ALERT_THRESHOLD` (`pr-triage.ts`) và với luật
 * "cùng một chữ ký lỗi ba lần" của `CLAUDE.md` mục 13 — một ngưỡng cho một
 * ý nghĩa, để hai chỗ không trôi khỏi nhau.
 */
export const RESET_ALERT_THRESHOLD = 3;

/** Một commit ở đầu nhánh PR, chưa có trên `main`. */
export interface HeadCommit {
  sha: string;
  /** ISO 8601 **có offset múi giờ** — `hoursBetween` ném nếu thiếu. */
  committedAt: string;
}

export interface DelayedPrInput {
  number: number;
  title: string;
  headRefName: string;
  labels: readonly string[];
  /**
   * Commit của nhánh chưa có trên `main`, **mới nhất trước** (đúng thứ tự
   * `git log --first-parent origin/main..<đầu nhánh>` in ra).
   */
  commits: readonly HeadCommit[];
}

export interface DelayedFlowRow {
  number: number;
  title: string;
  /** `null` khi tên nhánh không theo dạng `claude/<lane>/<id>` — không đoán. */
  lane: LaneName | null;
  /** Ngưỡng đã dùng để tính hàng này. Đi theo hàng để lớp render không tự đoán lại. */
  delayHours: number;
  /** Cửa sổ đã dùng cho `headCommitsInWindow`, cùng lý do. */
  windowHours: number;
  /**
   * **Đo được hay không.** `false` nghĩa là nhánh không có commit nào ngoài
   * `main` để mà đo — khi đó bốn trường dưới là `null`, và hàng này **không**
   * được đếm vào `neverReached`. "Không đo được" và "chắc chắn chưa đủ" là
   * hai chuyện khác nhau; gộp chúng là đúng nhóm Z, và là cùng luật mà
   * `P-007` đã đặt cho `CHƯA DÒ`.
   */
  measured: boolean;
  /** Số **commit** mới trong cửa sổ — **cận trên** của số lần đồng hồ về 0 (xem ghi chú 2 đầu file). */
  headCommitsInWindow: number;
  /** Khoảng dài nhất đầu nhánh **không** đổi, tính bằng giờ. Cận trên của đồng hồ. */
  longestStillHours: number | null;
  /** Đầu nhánh hiện tại đã đứng yên bao lâu. */
  currentStillHours: number | null;
  /** Còn thiếu **ít nhất** mấy giờ so với ngưỡng. `0` nghĩa là đã đủ khoảng đứng yên. */
  hoursShort: number | null;
  /**
   * Đã từng có một khoảng đứng yên đạt ngưỡng chưa — tức cửa có bao giờ
   * **có thể** mở cho PR này không. `false` là câu trả lời chắc chắn
   * "chưa"; `true` mới chỉ là "không loại trừ được"; `null` là chưa đo được.
   */
  reachedThreshold: boolean | null;
  /**
   * Mốc commit mới nhất nằm ở **tương lai** so với `now` — đồng hồ máy lệch.
   * Cùng luật với `clockSkew` của `conflict-watch.ts`: kẹp về 0 và nói ra,
   * chứ không in một số giờ âm lên bản tin.
   */
  clockSkew: boolean;
  /**
   * PR đang xung đột với `main`. Phụ lục P2 dặn: khi đó đồng hồ 12 giờ
   * **không chạy** (CHARTER 3.3), nên dòng bản tin phải **thay** "còn mấy
   * giờ" bằng lời nói về xung đột — in cả hai là tự mâu thuẫn trong một mục.
   */
  conflicting: boolean;
}

export interface DelayedFlowSummary {
  /** Số PR mang nhãn `automerge-delayed` trong ảnh chụp. */
  delayed: number;
  /** Bao nhiêu trong số đó từng có một khoảng đứng yên đạt ngưỡng. */
  reachedThreshold: number;
  /** Bao nhiêu PR **chắc chắn** chưa từng đủ điều kiện về thời gian. */
  neverReached: number;
  /** Bao nhiêu PR **không đo được** — không nằm trong hai ô trên. */
  notMeasured: number;
}

export interface DelayedFlowOptions {
  delayHours?: number;
  windowHours?: number;
  /** Số hiệu các PR đang xung đột với `main` (mục `P-007`). */
  conflicting?: ReadonlySet<number>;
}

/**
 * Các khoảng đầu-nhánh-không-đổi của một PR, tính bằng giờ.
 *
 * `commits` mới nhất trước. Khoảng đầu tiên là từ commit mới nhất tới
 * `now` — khoảng đang chạy. Các khoảng sau là giữa hai commit liên tiếp.
 *
 * **Không** có khoảng nào *trước* commit cũ nhất: commit đó là lúc nhánh ra
 * đời, trước nó chưa có PR nào để mà chờ. Đếm thêm một khoảng vô hạn ở đó
 * là cách chắc chắn để mọi PR trông như đã đạt ngưỡng.
 *
 * Nhánh chưa có commit nào ngoài `main` trả mảng rỗng: không đo được, và
 * mảng rỗng nói đúng điều đó. Bên gọi phải phân biệt nó với "đo được và ra
 * 0 giờ" — xem `measured` trong `DelayedFlowRow`.
 *
 * **Tự sắp giảm dần theo `committedAt` trước khi tính.** Đường đang dùng
 * (`git log`) vốn đã mới-trước, nhưng một map dựng tay hoặc một cờ `git`
 * đổi đi sẽ cho khoảng âm và `Math.max` lấy nhầm — im lặng, đúng nhóm Z.
 * Sắp lại là một dòng, và sau đó khoảng âm **chỉ** còn có thể đến từ một
 * commit mốc tương lai, tức đúng một nguyên nhân để bên gọi xử lý.
 */
export function stillGapsHours(commits: readonly HeadCommit[], now: string): number[] {
  if (commits.length === 0) return [];
  const sorted = [...commits].sort((a, b) => Date.parse(b.committedAt) - Date.parse(a.committedAt));
  const gaps = [hoursBetween(sorted[0]!.committedAt, now)];
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    gaps.push(hoursBetween(sorted[i + 1]!.committedAt, sorted[i]!.committedAt));
  }
  return gaps;
}

/**
 * Số **commit** mới trong `windowHours` giờ gần nhất — **cận trên** của số
 * lần đồng hồ về 0.
 *
 * Mỗi lần đầu nhánh đổi là một lần đồng hồ về 0 (`ciSha !== headSha` trong
 * `invariants.merge-gate.ts`). Nhưng một lần push mang nhiều commit chỉ đổi
 * đầu nhánh **một** lần, còn ở đây đếm được **nhiều**. Không có cách nào
 * suy ra ranh giới push từ `git log` một mình, nên hàm này khai thẳng chiều
 * sai của nó — thổi phồng, không bỏ sót — thay vì hứa một con số nó không
 * đo được. Tên hàm nói đúng thứ nó đếm.
 */
export function headCommitsInWindow(
  commits: readonly HeadCommit[],
  now: string,
  windowHours: number = DEFAULT_WINDOW_HOURS,
): number {
  return commits.filter((commit) => hoursBetween(commit.committedAt, now) <= windowHours).length;
}

/** Một dòng đo cho một PR. Bên gọi đã lọc nhãn; hàm này không lọc lại. */
export function delayedFlowRow(pr: DelayedPrInput, now: string, options: DelayedFlowOptions = {}): DelayedFlowRow {
  const delayHours = options.delayHours ?? DEFAULT_DELAY_HOURS;
  const windowHours = options.windowHours ?? DEFAULT_WINDOW_HOURS;
  const gaps = stillGapsHours(pr.commits, now);
  const base = {
    number: pr.number,
    title: pr.title,
    lane: laneFromBranch(pr.headRefName),
    delayHours,
    windowHours,
    headCommitsInWindow: headCommitsInWindow(pr.commits, now, windowHours),
    conflicting: options.conflicting?.has(pr.number) === true,
  };

  // Không có commit nào để đo. KHÔNG rơi về 0: một hàng `0 giờ` kèm
  // `reachedThreshold: false` là một khẳng định chắc rút ra từ chỗ trống, và
  // nó sẽ được cộng thẳng vào con số "chắc chắn chưa từng đủ ngưỡng".
  if (gaps.length === 0) {
    return {
      ...base,
      measured: false,
      longestStillHours: null,
      currentStillHours: null,
      hoursShort: null,
      reachedThreshold: null,
      clockSkew: false,
    };
  }

  // Sau khi `stillGapsHours` đã sắp lại, khoảng âm chỉ còn có thể là commit
  // mốc tương lai. Cùng luật với `conflictRows`: kẹp về 0 và nói ra, chứ
  // không in `-4 giờ` lên bản tin.
  const clockSkew = gaps[0]! < 0;
  const currentStillHours = Math.max(gaps[0]!, 0);
  const longestStillHours = Math.max(...gaps.map((gap) => Math.max(gap, 0)));
  return {
    ...base,
    measured: true,
    longestStillHours,
    currentStillHours,
    hoursShort: Math.max(0, Math.round((delayHours - currentStillHours) * 100) / 100),
    reachedThreshold: longestStillHours >= delayHours,
    clockSkew,
  };
}

/**
 * Bảng đo cho mọi PR mang nhãn `automerge-delayed`, **gần tới hạn trước**.
 *
 * Xếp theo `hoursShort` tăng dần, hoà thì theo số PR tăng dần: bản tin đọc
 * từ trên xuống, nên dòng sắp vào `main` phải nằm trên. Thứ tự cố định
 * theo dữ liệu chứ không theo thứ tự `snapshot` truyền vào — bản tin đọc
 * mỗi sáng, và thứ tự nhảy là thứ làm người đọc mất mốc.
 */
export function delayedFlowRows(
  prs: readonly DelayedPrInput[],
  now: string,
  options: DelayedFlowOptions = {},
): DelayedFlowRow[] {
  return prs
    .filter((pr) => pr.labels.some((label) => label.toLowerCase() === DELAYED_LABEL))
    .map((pr) => delayedFlowRow(pr, now, options))
    .sort((a, b) => {
      // Hàng không đo được xếp **cuối** chứ không bị bỏ — cùng luật với
      // `conflictRows`: "không đo được" là một trạng thái phải hiện ra.
      if (a.hoursShort === null && b.hoursShort === null) return a.number - b.number;
      if (a.hoursShort === null) return 1;
      if (b.hoursShort === null) return -1;
      return a.hoursShort - b.hoursShort || a.number - b.number;
    });
}

export function summarizeDelayedFlow(rows: readonly DelayedFlowRow[]): DelayedFlowSummary {
  const measured = rows.filter((row) => row.measured);
  const reached = measured.filter((row) => row.reachedThreshold === true).length;
  return {
    delayed: rows.length,
    reachedThreshold: reached,
    neverReached: measured.length - reached,
    notMeasured: rows.length - measured.length,
  };
}

/**
 * Một dòng cho mục **"Đang chờ merge"** của bản tin (phụ lục P2).
 *
 * Tiêu chí xong thứ hai của `P-027`: số giờ phải tính theo **đồng hồ đã bị
 * đặt lại**, không phải giờ kể từ lúc gắn nhãn — nếu không, một PR kẹt vĩnh
 * viễn trông giống hệt một PR sắp tới hạn. Chữ "ít nhất" không phải câu chữ
 * làm mềm: xem ghi chú đầu file, đây là cận dưới.
 */
export function renderDelayedFlowRow(row: DelayedFlowRow): string {
  const parts = [`#${row.number}`, row.lane ?? 'không suy được làn'];

  if (!row.measured) {
    // Không đo được thì KHÔNG nói gì về giờ, và tuyệt đối không nói "chưa
    // bao giờ đủ ngưỡng" — đó là một khẳng định chắc rút ra từ chỗ trống.
    parts.push('CHƯA ĐO ĐƯỢC ĐẦU NHÁNH');
  } else if (row.conflicting) {
    // Phụ lục P2: PR đang xung đột thì **thay** "còn mấy giờ" bằng lời nói
    // về xung đột — đồng hồ 12 giờ không chạy khi đang xung đột (CHARTER
    // 3.3). In cả hai là để bản tin tự mâu thuẫn trong một mục.
    parts.push('xung đột — đồng hồ 12 giờ KHÔNG chạy, xem mục "PR đang xung đột"');
  } else {
    parts.push(row.hoursShort === 0 ? 'đủ giờ đứng yên' : `còn ít nhất ${row.hoursShort} giờ`);
  }

  if (row.measured) {
    parts.push(`đứng yên lâu nhất ${row.longestStillHours} giờ / ngưỡng ${row.delayHours}`);
  }
  if (row.headCommitsInWindow >= RESET_ALERT_THRESHOLD) {
    parts.push(`${row.headCommitsInWindow} commit mới/${row.windowHours} giờ (cận trên của số lần đặt lại)`);
  }
  if (row.clockSkew) parts.push('⚠️ mốc commit nằm ở TƯƠNG LAI — đồng hồ lệch, số giờ kẹp về 0');
  if (row.reachedThreshold === false) parts.push('CHƯA BAO GIỜ đủ ngưỡng');
  parts.push(row.title);
  return parts.join(' · ');
}

// --- Lớp vỏ đọc `git` / đọc đĩa ---

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`\`git ${args.join(' ')}\` thất bại: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout;
}

/**
 * Commit của một nhánh chưa có trên `main`, mới nhất trước.
 *
 * `--first-parent` để một commit gộp `main` vào nhánh đếm là **một** lần
 * đổi đầu nhánh, chứ không kéo theo cả nhánh `main` vừa gộp vào.
 */
export function branchHeadCommits(cwd: string, ref: string, baseRef = 'origin/main'): HeadCommit[] {
  const out = git(cwd, ['log', '--first-parent', '--format=%H %cI', `${baseRef}..${ref}`]);
  return out
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [sha, committedAt] = line.trim().split(' ');
      return { sha: sha!, committedAt: committedAt! };
    });
}

/** Dạng dữ liệu PR mà `gh pr list --json number,title,headRefName,labels` trả về. */
interface RawPr {
  number: number;
  title: string;
  headRefName: string;
  labels?: readonly { name: string }[];
}

function readOpenPrs(path: string): RawPr[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { openPrs?: unknown };
  if (!Array.isArray(parsed.openPrs)) {
    throw new Error(`File --github thiếu mảng \`openPrs\`: ${path}`);
  }
  return parsed.openPrs as RawPr[];
}

function main(): void {
  const argv = process.argv.slice(2);
  const githubIndex = argv.indexOf('--github');
  const path = githubIndex === -1 ? undefined : argv[githubIndex + 1];
  if (path === undefined || path.startsWith('--')) {
    throw new Error(
      'Cần `--github <file.json>` chứa `openPrs` đúng dạng `gh pr list --json number,title,headRefName,labels`.',
    );
  }

  const root = process.cwd();
  const raw = readOpenPrs(path).filter((pr) =>
    (pr.labels ?? []).some((label) => label.name.toLowerCase() === DELAYED_LABEL),
  );
  fetchProbeRefs(
    root,
    raw.map((pr) => pr.number),
  );

  const now = new Date().toISOString();
  const rows = delayedFlowRows(
    raw.map((pr) => ({
      number: pr.number,
      title: pr.title,
      headRefName: pr.headRefName,
      labels: (pr.labels ?? []).map((label) => label.name),
      commits: branchHeadCommits(root, prHeadRef(pr.number)),
    })),
    now,
  );
  const summary = summarizeDelayedFlow(rows);

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ measuredAt: now, summary, rows }, null, 2)}\n`);
    return;
  }
  const out = [
    `Cửa \`${DELAYED_LABEL}\`, đo lúc ${now}: ${summary.delayed} PR · ${summary.neverReached} PR chắc chắn chưa từng đủ ngưỡng · ${summary.notMeasured} PR không đo được`,
  ];
  for (const row of rows) out.push(`- ${renderDelayedFlowRow(row)}`);
  process.stdout.write(`${out.join('\n')}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
