#!/usr/bin/env node
/**
 * Cơ chế của mục `platform/P-007`: **một PR xung đột với `main` phải nhìn
 * thấy được**, và số giờ nó đã xung đột phải là số **đo được**, không phải
 * số đoán.
 *
 * Vì sao mục này tồn tại: hàng đợi merge là tuần tự (CHARTER mục 7). Một PR
 * xung đột nằm giữa hàng đợi không có gì báo — CI vẫn xanh, nhãn tự merge
 * vẫn còn, `ops/invariants.merge-gate.ts` lặng lẽ trả `skip`, và PR chỉ đơn
 * giản là không bao giờ được merge. Rủi ro **B7** ở quy mô một PR.
 *
 * Bốn tiêu chí xong khác của `P-007` đã có chỗ ở: `automerge.yml` hỏi lại
 * `mergeable` khi GitHub trả `null` rồi mới quyết, `decideMerge` biến ba ca
 * `null`/`false`/`dirty` thành `recheck`/`skip` có test, và
 * `ops/scripts/integrator-resolve.ts` (mục `P-016`) gộp `main` vào những PR
 * nó tự giải được. Chỗ còn thủng là **bản tin ngày**: `digest-metrics.ts`
 * (mục `P-005`) chưa có mục nào cho PR đang xung đột, nên một PR kẹt vẫn
 * nằm im được nhiều ngày mà chủ dự án không thấy.
 *
 * ## Không tin `mergeable` của API — đo lại bằng chạy thật
 *
 * GitHub tính `mergeable` bất đồng bộ; ba lượt worker gần đây đều gặp ca
 * API trả `dirty`/`unknown` cho một nhánh gộp sạch, vì trạng thái còn tính
 * theo bản `main` cũ. Nên ở đây API **không** được dùng làm nguồn: mọi PR
 * đang mở đều bị gộp thử bằng `git merge-tree --write-tree`, đúng cách
 * phụ lục P3 bước 0 đang làm bằng tay mỗi lượt.
 *
 * ## Mốc kẹt: nhị phân hoá theo lịch sử `main`, không đọc từ ghi chú log
 *
 * Số giờ kẹt nằm rải trong trường `note` (văn xuôi tiếng Việt) của
 * `ops/logs/platform/P-016.jsonl`. Đọc số ra khỏi văn xuôi là thứ hỏng im
 * lặng ngay lần đầu ai đó viết khác đi một chữ. Thay vào đó, mốc kẹt được
 * **đo lại**: gộp thử nhánh lần lượt với từng commit gần đây của `main` và
 * tìm commit ĐẦU TIÊN làm nó xung đột. Đúng phép đo mà lượt integrator
 * `17:06Z` đã làm bằng tay cho PR #56 và ra `15:44:08Z`.
 *
 * Cửa sổ dò có đáy (`PROBE_DEPTH`). Mọi commit trong cửa sổ đều xung đột
 * thì mốc chỉ là "ít nhất từ đây" — `exact: false`. Khai ra thay vì trả một
 * con số chắc nịch nhưng sai cận dưới.
 */

import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';

/** Số commit gần nhất của `main` được gộp thử để tìm mốc kẹt. */
export const PROBE_DEPTH = 25;

/**
 * Cùng lý do với `integrator-resolve.ts`: `maxBuffer` mặc định 1 MiB bị
 * vượt thì `spawnSync` cắt cụt stdout mà vẫn có thể `status === 0` — hình
 * dạng nhóm Z. `git merge-tree --write-tree` in ra cả cây khi xung đột.
 */
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync('git', [...args], { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

// ── Phần thuần ───────────────────────────────────────────────────────────

/** Một lần gộp thử nhánh với một commit của `main`. */
export interface CommitProbe {
  sha: string;
  /** Mốc commit, ISO 8601. */
  committedAt: string;
  /** Gộp thử có xung đột không. */
  conflicts: boolean;
}

export interface ConflictOrigin {
  /** Commit của `main` làm nhánh bắt đầu xung đột. */
  sha: string;
  committedAt: string;
  /**
   * `true`: tìm được đúng commit gây xung đột — có một commit **sạch** ngay
   * trước nó trong cửa sổ dò. `false`: mọi commit trong cửa sổ đều xung
   * đột, nên mốc này chỉ là cận dưới ("kẹt ít nhất từ đây").
   */
  exact: boolean;
}

/**
 * Commit của `main` đã làm nhánh xung đột, từ một dãy gộp thử xếp **mới
 * trước, cũ sau** (đúng thứ tự `git log` trả về).
 *
 * `null` khi nhánh không xung đột với đầu `main` hiện tại — mục này chỉ nói
 * về PR đang xung đột, một PR đã được gỡ không còn là việc của bản tin.
 *
 * Chỉ xét **chuỗi xung đột liền nhau tính từ đầu dãy**. Một lần xung đột cũ
 * đã được gỡ rồi tái phát là hai lần kẹt khác nhau, và số giờ đáng đọc là
 * của lần đang diễn ra.
 */
export function conflictOrigin(probes: readonly CommitProbe[]): ConflictOrigin | null {
  if (probes.length === 0 || probes[0]!.conflicts === false) return null;

  let index = 0;
  while (index + 1 < probes.length && probes[index + 1]!.conflicts) index += 1;

  const origin = probes[index]!;
  return { sha: origin.sha, committedAt: origin.committedAt, exact: index + 1 < probes.length };
}

/**
 * Số giờ giữa hai mốc ISO, làm tròn hai chữ số. Ném khi một mốc không đọc
 * được: bản tin là nơi con số đi thẳng tới chủ dự án, và `NaN` giờ ở đó
 * trông y hệt một PR vừa mới kẹt.
 *
 * **Cả hai mốc phải mang offset múi giờ.** `Date.parse` đọc một chuỗi
 * không có offset (`2026-09-21T15:00:00`) là **giờ địa phương**, nên cùng
 * một đầu vào ra hai con số khác nhau tuỳ `TZ` của runner. Đường đang dùng
 * an toàn — `git log --format=%cI` luôn kèm offset — nhưng đó là ràng buộc
 * ngầm, nên khai ra ở đây.
 */
export function hoursBetween(from: string, to: string): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error(`Mốc thời gian không đọc được: ${JSON.stringify([from, to])}`);
  }
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

/** Nhãn nào khiến đồng hồ chờ của một PR **đứng lại** khi PR đang xung đột (CHARTER 3.3). */
export const AUTO_MERGE_LABELS = ['automerge', 'automerge-delayed'] as const;

export interface ConflictInput {
  number: number;
  title: string;
  labels: readonly string[];
  origin: ConflictOrigin | null;
}

export interface ConflictRow {
  number: number;
  title: string;
  labels: string[];
  /**
   * Số giờ đã xung đột. `null` khi bên gọi không đưa được mốc nào
   * (`origin: null`) — cửa sổ dò rỗng chẳng hạn. Cửa sổ dò **hết** mà vẫn
   * toàn xung đột thì vẫn ra số, kèm `exact: false`.
   */
  hoursStuck: number | null;
  /** `false` khi `hoursStuck` chỉ là cận dưới — xem `ConflictOrigin.exact`. */
  exact: boolean;
  /**
   * Mốc kẹt nằm ở **tương lai** so với `now`: đồng hồ của runner lệch so
   * với mốc commit. Số giờ được kẹp về 0 chứ **không** in số âm, nhưng cờ
   * này phải nổi lên — "kẹt -10 giờ" trên bản tin thì người đọc mất niềm
   * tin vào cả mục, còn kẹp im lặng thì che mất một cái đồng hồ đang sai.
   */
  clockSkew: boolean;
  /**
   * PR mang nhãn tự merge mà đang xung đột: đồng hồ 12 giờ của nó **không
   * chạy**, nên nó không bao giờ tự tới hạn. Đây là đúng hình dạng B7 —
   * mọi chỉ báo xanh, PR đứng im vô hạn.
   */
  clockFrozen: boolean;
}

/**
 * Dòng bản tin cho các PR đang xung đột, **kẹt lâu nhất trước** — cùng thứ
 * tự mà phụ lục P3 bước 0a đòi khi xử lý hàng đợi, để bản tin và integrator
 * đọc hàng đợi theo cùng một trật tự.
 *
 * PR không dò được mốc (`origin: null` vì cửa sổ dò rỗng) xếp **cuối** chứ
 * không bị bỏ: "không đo được" là một trạng thái phải hiện ra, không phải
 * một lý do để biến mất.
 */
export function conflictRows(inputs: readonly ConflictInput[], now: string): ConflictRow[] {
  const rows = inputs.map((input) => {
    const labels = [...input.labels];
    const raw = input.origin === null ? null : hoursBetween(input.origin.committedAt, now);
    return {
      number: input.number,
      title: input.title,
      labels,
      hoursStuck: raw === null ? null : Math.max(raw, 0),
      exact: input.origin?.exact ?? false,
      clockSkew: raw !== null && raw < 0,
      // So không phân biệt hoa thường, cùng cách `decideMerge` chuẩn hoá
      // `input.labels`. Nhãn GitHub giữ nguyên chữ hoa nhưng chỉ duy nhất
      // theo kiểu không phân biệt hoa thường, nên một nhãn gõ `AutoMerge`
      // mà so thẳng sẽ làm mất đúng dòng cảnh báo này.
      clockFrozen: labels.some((label) =>
        (AUTO_MERGE_LABELS as readonly string[]).includes(label.toLowerCase()),
      ),
    };
  });

  return rows.sort((a, b) => {
    if (a.hoursStuck === null && b.hoursStuck === null) return a.number - b.number;
    if (a.hoursStuck === null) return 1;
    if (b.hoursStuck === null) return -1;
    if (a.hoursStuck !== b.hoursStuck) return b.hoursStuck - a.hoursStuck;
    return a.number - b.number;
  });
}

/** Một dòng bản tin, tiếng Việt. Dạng khớp phụ lục P2 mục "Đang chờ merge". */
export function renderConflictRow(row: ConflictRow): string {
  const parts = [`#${row.number}`];
  if (row.hoursStuck === null) {
    parts.push('xung đột, KHÔNG dò được mốc kẹt');
  } else {
    parts.push(`xung đột, kẹt ${row.exact ? '' : 'ít nhất '}${row.hoursStuck.toFixed(2)} giờ`);
  }
  if (row.clockSkew) parts.push('⚠️ mốc kẹt nằm ở TƯƠNG LAI — đồng hồ lệch, số giờ kẹp về 0');
  if (row.clockFrozen) parts.push('đồng hồ chờ KHÔNG chạy khi đang xung đột (CHARTER 3.3)');
  if (row.labels.length > 0) parts.push(row.labels.join(', '));
  parts.push(row.title);
  return parts.join(' · ');
}

// ── Phần chạm git ────────────────────────────────────────────────────────

export interface MainCommit {
  sha: string;
  committedAt: string;
}

/**
 * `PROBE_DEPTH` commit gần nhất của một ref, mới trước cũ sau. Ném khi git
 * hỏng: một danh sách rỗng ở đây cho ra "0 PR xung đột" trên bản tin, mà
 * bản tin nói không có gì kẹt trong khi hàng đợi đang tắc là đúng nhóm Z.
 */
export function recentMainCommits(cwd: string, ref = 'origin/main', depth = PROBE_DEPTH): MainCommit[] {
  const result = git(cwd, ['log', `--max-count=${depth}`, '--format=%H%x09%cI', ref]);
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`Không đọc được lịch sử \`${ref}\`: ${result.error?.message ?? result.stderr}`);
  }
  const commits = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha, committedAt] = line.split('\t');
      return { sha: sha!, committedAt: committedAt! };
    });

  // `git log` thoát 0 và in RỖNG cho một ref trỏ vào thứ không phải commit
  // (`main:file.txt`), và cho `depth = 0`. Trả `[]` ở đây thì mọi PR ra
  // `origin: null` và bản tin in "0 PR xung đột" — đúng nhóm Z mà chú thích
  // ngay trên đang cảnh báo, nên chặn tại chỗ.
  if (commits.length === 0) {
    throw new Error(`\`${ref}\` không cho commit nào (depth=${depth}) — không dò được mốc kẹt.`);
  }
  return commits;
}

/**
 * Ref phải trỏ tới một commit có thật, nếu không thì **ném**.
 *
 * Bước này không thừa: đo bằng chạy thật cho thấy `git merge-tree
 * --write-tree <ref có thật> <ref không có>` thoát **1** — **đúng mã thoát
 * của "có xung đột"**, chỉ khác ở một dòng `stderr`. Tin mã thoát một mình
 * thì một ref chưa nạp về (PR mới mở, `fetch` hụt) biến thành một PR
 * "đang xung đột" trên bản tin, và chủ dự án đi gỡ một chỗ kẹt không tồn
 * tại. Đúng nhóm Z của `ops/known-failures.md`.
 */
function resolveCommit(cwd: string, ref: string): void {
  const result = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (result.error !== undefined || result.status !== 0 || result.stdout.trim().length === 0) {
    throw new Error(`Ref không trỏ tới commit nào: ${JSON.stringify(ref)} (${cwd})`);
  }
}

/**
 * Nhánh có xung đột với một commit không, đo bằng gộp thử trong bộ nhớ —
 * `git merge-tree --write-tree` không đụng cây làm việc, nên gọi nó vài
 * chục lần là an toàn kể cả khi một lượt worker khác đang chạy.
 *
 * Mã thoát: `0` gộp sạch, `1` xung đột — nhưng chỉ sau khi cả hai ref đã
 * được xác nhận trỏ tới commit thật (xem `resolveCommit`). Mọi mã khác là
 * hỏng thật và được **ném**: coi nó là "xung đột" thì bản tin báo động giả,
 * coi là "sạch" thì bản tin nuốt một PR đang kẹt.
 */
export function branchConflicts(cwd: string, branchRef: string, mainRef: string): boolean {
  resolveCommit(cwd, branchRef);
  resolveCommit(cwd, mainRef);

  const result = git(cwd, ['merge-tree', '--write-tree', branchRef, mainRef]);
  if (result.error !== undefined) {
    throw new Error(`Không gộp thử được \`${branchRef}\` với \`${mainRef}\`: ${result.error.message}`);
  }
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  throw new Error(
    `\`git merge-tree ${branchRef} ${mainRef}\` thoát ${result.status ?? '?'}: ${result.stderr.trim() || result.stdout.trim()}`,
  );
}

/**
 * Dò mốc kẹt của một nhánh: gộp thử lần lượt với từng commit của `main`,
 * mới trước cũ sau, và **dừng ngay** ở commit sạch đầu tiên. Không dò hết
 * cửa sổ khi đã có câu trả lời — một PR vừa kẹt chỉ tốn hai lần gộp thử.
 */
export function probeConflictOrigin(cwd: string, branchRef: string, commits: readonly MainCommit[]): ConflictOrigin | null {
  const probes: CommitProbe[] = [];
  for (const commit of commits) {
    const conflicts = branchConflicts(cwd, branchRef, commit.sha);
    probes.push({ ...commit, conflicts });
    if (!conflicts) break;
  }
  return conflictOrigin(probes);
}

/**
 * Ref cục bộ cho đầu một PR. Dùng `refs/pull/<n>/head` chứ không dùng tên
 * nhánh: tên nhánh của một số lượt routine do nền tảng gán (`claude/<tên
 * ngẫu nhiên>`, PR #62/#66/#70 là ca thật) và nhánh có thể đã bị xoá, còn
 * `refs/pull` thì GitHub luôn giữ chừng nào PR còn đó.
 */
export function prHeadRef(number: number): string {
  return `refs/remotes/pr/${number}`;
}

/**
 * Nạp `main` **và** đầu của các PR về kho cục bộ, trong **một** lần
 * `git fetch`.
 *
 * `main` đi cùng chuyến chứ không để bên gọi tự lo: dò mốc kẹt trên một
 * `origin/main` cũ cho ra một con số trông hợp lý và sai — PR đã được gỡ
 * xung đột vẫn hiện trên bản tin, PR vừa kẹt thì chưa. Đúng nhóm Z.
 */
export function fetchProbeRefs(cwd: string, numbers: readonly number[], remote = 'origin'): void {
  const specs = [
    '+refs/heads/main:refs/remotes/origin/main',
    ...numbers.map((n) => `+refs/pull/${n}/head:${prHeadRef(n)}`),
  ];
  const result = git(cwd, ['fetch', '--no-tags', '--quiet', remote, ...specs]);
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`Không nạp được \`main\` và đầu các PR (${numbers.join(', ')}): ${result.error?.message ?? result.stderr}`);
  }
}

/**
 * Mốc kẹt của **mọi** PR trong danh sách — khoá là số PR, giá trị `null`
 * nghĩa là PR đó không xung đột với đầu `main`.
 *
 * Dò tất cả chứ không chỉ những PR mà API gọi là `CONFLICTING`: xem ghi chú
 * "Không tin `mergeable` của API" ở đầu file.
 *
 * Nạp `main` và đầu các PR về trước khi dò. Bỏ bước đó thì `git merge-tree` báo
 * "not a valid object name" cho mọi PR mở sau lần clone gần nhất, tức là
 * đúng những PR mới nhất — và mục này im lặng ở chỗ nó phải lên tiếng.
 */
export function measureConflicts(
  cwd: string,
  numbers: readonly number[],
  mainRef = 'origin/main',
): Map<number, ConflictOrigin | null> {
  fetchProbeRefs(cwd, numbers);
  const commits = recentMainCommits(cwd, mainRef);
  const origins = new Map<number, ConflictOrigin | null>();
  for (const number of numbers) {
    origins.set(number, probeConflictOrigin(cwd, prHeadRef(number), commits));
  }
  return origins;
}
