#!/usr/bin/env node
/**
 * Mục `platform/P-041` — hai worker nhận **cùng một mục backlog**, và không
 * gì đỏ. Nhóm **Z** (`ops/known-failures.md`), chữ ký `KF-025`.
 *
 * ## Chỗ hỏng, đo được chứ không suy
 *
 * Ngày 2026-09-24, mục `integration/I-020`, hai lượt worker cách nhau
 * **89 giây**:
 *
 * | PR | Routine | Tạo lúc | Kết cục |
 * |---|---|---|---|
 * | `#221` | `crux-worker-2` | 03:40:00Z | merge 03:44:45Z |
 * | `#222` | `crux-worker-1` | 03:41:29Z | còn mở, **xung đột vĩnh viễn** với `main` |
 *
 * Cả hai làm đúng luật như nó được viết: phụ lục P1 bước 3 đòi mục `ready`,
 * `deps` đã xong, *"chưa có nhánh `claude/<lane>/<id>` và chưa có PR mở"*.
 * Lượt sau đọc danh sách PR lúc ~03:38Z, khi `#221` chưa tồn tại, rồi làm
 * việc một giờ và push. Không cổng nào hỏi lại. Hai PR xanh, CI xanh,
 * `pnpm check` xanh — đúng hình dạng nhóm Z.
 *
 * **Và nó xảy ra lần thứ hai ngay trong chính lượt viết ra mục này**: mã
 * `P-040` bị `#224` (05:41:17Z) và `#225` (05:51:02Z) cùng nhận, cách nhau
 * 9,75 phút. Lần này chính bộ dò dưới đây bắt được, nên mục đổi sang
 * `P-041`. Đó là lý do luật ở bước 4 đòi hỏi **lại** trước khi push, chứ
 * không chỉ lúc chọn mục.
 *
 * ## Bốn luật thiết kế, cả bốn đều là chỗ dễ làm sai
 *
 * 1. **Chữ ký lấy từ TIÊU ĐỀ PR, không lấy từ tên nhánh.** Phiên cloud được
 *    nền tảng gán nhánh ngẫu nhiên (`claude/dreamy-ride-oh9k8r`), nên
 *    `laneFromBranch` trả `null` cho phần lớn PR — đo lúc viết mục này:
 *    **5 trên 7** PR đang mở có nhánh không theo quy ước. Một bộ dò neo vào
 *    tên nhánh sẽ im lặng đúng ở những PR nó cần bắt nhất.
 *
 *    Tiền tố `🤖` của `CLAUDE.md` mục 5 **phải** được bỏ qua: 29 commit trên
 *    `main` mang nó, trong đó `🤖 [platform] P-038 — …` là một PR nhận mục
 *    thật. Neo cứng vào `[` làm `claimCheck` trả `free` cho một mục đang có
 *    người giữ — fail-open ở đúng chỗ mục này sinh ra để chặn.
 *
 * 2. **PR đã merge cũng tính, không chỉ PR đang mở.** Ca `#221`/`#222` là
 *    bằng chứng: PR thứ nhất merge lúc 03:44, PR thứ hai còn mở tới giờ.
 *    Một phép dò chỉ nhìn PR *đang mở* sẽ tắt tiếng đúng vào lúc chỗ hỏng
 *    trở thành vĩnh viễn. Và "đã merge" suy từ **`mergedAt`**, không nhận
 *    một cờ boolean: endpoint liệt kê PR của GitHub trả `merged: false` cho
 *    cả PR đã merge, chỉ `merged_at` là đúng ở cả hai endpoint.
 *
 * 3. **Sóng nối tiếp KHÔNG phải va chạm.** `platform/P-014` cố ý làm theo
 *    sóng, mỗi sóng một PR (`#62`, `#196`, `#223`) — và đó là việc đúng,
 *    không phải lỗi. Phân biệt bằng **thời gian sống chồng nhau**: chỉ báo
 *    khi PR sau ra đời lúc PR trước còn mở. Đếm theo mã mục thôi sẽ biến
 *    mọi mục làm nhiều đợt thành báo động giả, và một bộ dò kêu sai vài lần
 *    là một bộ dò bị tắt.
 *
 * 4. **Đầu vào thiếu hay hỏng thì NÉM, không trả `free`.** Đây là chỗ dễ
 *    sai nhất, vì `free` trông y hệt một câu trả lời. Một `now` không parse
 *    được, một tên làn viết sai, một `PrSnapshot` thiếu `closedAt` — cả ba
 *    đều cho "không ai giữ mục này" nếu hàm dễ dãi, và cả ba đều dẫn thẳng
 *    tới đúng va chạm mục này chữa. Luật: **cấm im lặng** (`Z15`), hướng
 *    lệch duy nhất được phép là *báo nhầm*, không bao giờ là *bỏ sót*.
 *
 * ## Hai vế cố ý KHÔNG nằm ở đây — mục `platform/P-058`, tiêu chí 7 và 9
 *
 * Khai ra thay vì để trống, vì một chỗ trống trông y hệt một chỗ đã phủ, và
 * lượt sau sẽ tiện tay thêm chúng vào đây rồi trả một cái giá không ai đo.
 *
 * **(a) So mã giữa ĐẦU NHÁNH và `main`** (tiêu chí 7). Phép quy mạnh nhất
 * cho `aliasesFromChangedFiles` là *"mã mục mà diff của PR đổi tên trong
 * backlog"* — nó nối `#224` với `#274` mà không cần đoán gì từ tập file.
 * Cái giá: CI phải `git fetch` **mọi** nhánh remote ở **mọi** PR, tức trả
 * tiền ở chỗ đắt nhất để canh một thứ mà `KF-036` đã có đường khác — dò lại
 * mã trống **ngay trước khi commit**. Nếu vẫn cần máy canh thì chỗ rẻ là
 * `watchdog.yml` (chạy theo giờ, một lần cho cả kho), đúng lập luận `P-056`
 * dùng cho `pnpm step0:pending`. Không phải chỗ này.
 *
 * **(b) `ops/logs/<làn>/<mã>.jsonl` bị mục khác chiếm** (tiêu chí 9). Đây là
 * vế **thứ ba** của `KF-042`, và nó không phải một mã trùng trong Markdown:
 * `ops/logs/platform/P-028.jsonl` đã tồn tại (2177 byte, thuộc một mục
 * `done`), nên một mục mới mang mã `P-028` đụng `D-C04` — *một file cho mỗi
 * mục*. Đó là **lý do thứ hai** `#274` phải đổi mã, và cổng dò tiêu đề
 * Markdown (`ops/scripts/duplicate-headings.ts`) **không** thấy nó: nó soát
 * tiêu đề, không soát tên file. Đáng một mục riêng; trỏ sang đây khi tạo.
 */

import { LANES, type LaneName } from '@crux/kernel';

/**
 * Cửa sổ ân hạn sau khi một PR merge: mục vừa vào `main` xong mà lượt sau
 * vẫn nhận lại thì gần như chắc chắn nó đọc backlog **trước** lúc merge.
 * Không chặn (sóng nối tiếp là việc đúng), chỉ nhắc đọc lại backlog.
 */
export const RECENT_MERGE_MINUTES = 30;

/**
 * `CLAUDE.md` mục 2 và CHARTER phụ lục P1 bước 3: *"PR nháp không có commit
 * mới quá 24 giờ thì coi như bỏ"*. Không có luật này thì một PR nháp chết
 * khoá mục của nó **vĩnh viễn** — luật mới sẽ nói ngược luật cũ đứng ngay
 * trên nó.
 */
export const ABANDONED_DRAFT_HOURS = 24;

/**
 * Ảnh chụp một PR. **Mọi trường đều bắt buộc**, kể cả `isDraft` và
 * `updatedAt`: cả sáu tới từ đúng một lần liệt kê PR, nên đòi đủ không tốn
 * thêm gì, còn nhận thiếu rồi mặc định `false` là đoán — và mọi cú đoán ở
 * đây lệch về phía "mục đang rảnh" (luật thiết kế 4).
 */
export interface PrSnapshot {
  number: number;
  title: string;
  createdAt: string;
  /** `null` khi PR còn mở. */
  closedAt: string | null;
  /** `null` khi PR chưa merge. Suy `merged` từ trường này, xem luật 2. */
  mergedAt: string | null;
  isDraft: boolean;
  updatedAt: string;
}

/** Mục backlog mà một PR khai trong tiêu đề của nó. */
export interface ClaimKey {
  lane: LaneName;
  id: string;
}

/** Đầu vào không đủ để trả lời — không bao giờ nuốt thành một phán quyết. */
export class ClaimInputError extends Error {}

/**
 * Cùng hình dạng tiêu đề mà `hasCompletionCommit` đọc: `[<lane>] <id> — …`,
 * cộng tiền tố `🤖` tuỳ chọn của `CLAUDE.md` mục 5 (xem luật 1). Tên làn
 * phải khớp đúng một tên trong `LANES` — không suy luận gần đúng, để bên
 * gọi không gán nhầm việc cho một làn không tồn tại.
 */
const TITLE = /^(?:🤖\s*)?\[([a-z]+)\]\s+([A-Za-z0-9][A-Za-z0-9._-]*)\s+[—–-]\s/;

export function claimKeyFromTitle(title: string): ClaimKey | null {
  const match = TITLE.exec(title.trim());
  if (match === null) return null;
  const lane = match[1]!;
  if (!(LANES as readonly string[]).includes(lane)) return null;
  return { lane: lane as LaneName, id: match[2]! };
}

export const claimKeyText = (key: ClaimKey): string => `${key.lane}/${key.id}`;

const isMerged = (pr: PrSnapshot): boolean => pr.mergedAt !== null;

const parsedOrNull = (value: string | null): number | null => {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Mọi `PrSnapshot` phải đủ trường và `at` phải đọc được. Ném kèm **tên PR
 * và tên trường** chứ không chỉ "đầu vào sai": lượt sau phải sửa được chỗ
 * dựng ảnh chụp, không phải đoán.
 */
export function assertSnapshots(prs: readonly PrSnapshot[]): void {
  const problems: string[] = [];
  for (const pr of prs) {
    const label = `#${pr.number ?? '?'}`;
    if (typeof pr.title !== 'string') problems.push(`${label}: thiếu title`);
    if (typeof pr.isDraft !== 'boolean') problems.push(`${label}: thiếu isDraft`);
    if (pr.closedAt === undefined) problems.push(`${label}: thiếu closedAt (null nếu PR còn mở)`);
    if (pr.mergedAt === undefined) problems.push(`${label}: thiếu mergedAt (null nếu chưa merge)`);
    for (const field of ['createdAt', 'updatedAt'] as const) {
      if (typeof pr[field] !== 'string' || !Number.isFinite(Date.parse(pr[field]))) {
        problems.push(`${label}: ${field} không đọc được (${String(pr[field])})`);
      }
    }
    for (const field of ['closedAt', 'mergedAt'] as const) {
      const value = pr[field];
      if (typeof value === 'string' && !Number.isFinite(Date.parse(value))) {
        problems.push(`${label}: ${field} không đọc được (${value})`);
      }
    }
  }
  if (problems.length > 0) {
    throw new ClaimInputError(`Ảnh chụp PR không đủ để trả lời:\n  - ${problems.join('\n  - ')}`);
  }
}

/** Một cặp PR cùng mục có thời gian sống chồng nhau. */
export interface DuplicateClaim {
  claim: string;
  /** PR ra đời trước. */
  first: number;
  /** PR ra đời sau, trong lúc `first` còn mở. */
  second: number;
  /**
   * **Quy về cùng một mục bằng gì** — `null` khi hai tiêu đề PR mang đúng
   * cùng một mã, hoặc câu `because` của nhóm bí danh khi hai tiêu đề mang
   * **hai mã khác nhau** (mục `P-058` tiêu chí 6).
   *
   * Không tuỳ chọn, và không bao giờ là một chuỗi rỗng: một cặp được quy về
   * nhau bằng một luật mà bảng **không nói ra** là một con số không có nguồn
   * (bất biến **I6**), và người đọc không cãi lại được nó.
   */
  via: string | null;
  /**
   * Số phút giữa hai lần tạo — số nhỏ nghĩa là hai lượt worker chạy chồng
   * nhau. `null` khi không đo được; bản in nói "không đo được", không in
   * `NaN` (bất biến **I6**: mọi con số hiển thị phải có nguồn).
   */
  minutesApart: number | null;
  /** `first` đã merge chưa — merge rồi thì `second` kẹt xung đột. */
  firstMerged: boolean;
}

/**
 * Hai PR **cùng một mục** mà tiêu đề mang **hai mã khác nhau** — mục
 * `platform/P-058` tiêu chí 6.
 *
 * ## Vì sao cần nó, đo được chứ không suy
 *
 * `#224` (`[platform] P-040 …`) và `#274` (`[platform] P-057 …`) là **cùng
 * một việc** — cùng tiêu đề nghiệp vụ, cùng ba file — và cùng mở. Phép đếm
 * cũ nhóm theo **mã trong tiêu đề**, nên nó thấy hai mục khác nhau và trả
 * **0 va chạm đang sống**: trên ảnh chụp 232 PR nó ra 5 cặp, **cả 5 đều
 * `firstMerged`**. Tức bộ đo mà bản tin và integrator đọc báo *"không có gì"*
 * cho đúng ca đang hỏng. Nguyên nhân kích là mã trùng buộc `#274` đổi mã
 * giữa đường (`KF-042`).
 *
 * ## Luật: quy về một mục thì phải KHAI quy bằng gì
 *
 * `because` **không được rỗng** và nó đi thẳng vào cột `via` của bảng. Một
 * nhóm bí danh là một phép nối do bên gọi áp đặt; nếu bảng không nói ra
 * phép nối đó thì người đọc thấy một va chạm mà không cãi lại được — đúng
 * thứ bất biến **I6** cấm.
 *
 * Luật 3 của `P-041` (*"sóng nối tiếp KHÔNG phải va chạm"*) **không** bị nới
 * ở đây: điều kiện sống chồng nhau vẫn áp sau khi quy, nên ca `P-014`
 * (`#62` → `#196` → `#223`, mỗi sóng đóng trước khi sóng sau mở) vẫn là ca
 * âm dù có bí danh hay không.
 */
export interface ClaimAlias {
  /** Mã mục quy chuẩn của cả nhóm, dạng `<lane>/<id>`. */
  claim: string;
  /** Các PR trong nhóm — ít nhất hai. */
  prs: readonly number[];
  /** Vì sao nhóm này là CÙNG một mục. Rỗng thì NÉM. */
  because: string;
}

/** Đọc `<lane>/<id>` — cùng bộ luật tên làn như `claimKeyFromTitle`. */
export function claimKeyFromText(text: string): ClaimKey | null {
  const parts = text.split('/');
  if (parts.length !== 2) return null;
  const [lane, id] = parts as [string, string];
  if (!(LANES as readonly string[]).includes(lane) || id.length === 0) return null;
  return { lane: lane as LaneName, id };
}

/**
 * Kiểm nhóm bí danh và trả bảng tra `số PR → nhóm`. **Ném** chứ không bỏ
 * qua: một nhóm hỏng làm phép đếm nói sai về phía *"không có va chạm"*,
 * đúng hướng lệch mà `P-041` luật 4 cấm.
 */
function assertAliases(aliases: readonly ClaimAlias[]): Map<number, ClaimAlias> {
  const byPr = new Map<number, ClaimAlias>();
  const problems: string[] = [];
  for (const alias of aliases) {
    const label = `bí danh "${alias.claim ?? '?'}"`;
    if (typeof alias.claim !== 'string' || claimKeyFromText(alias.claim) === null) {
      problems.push(`${label}: \`claim\` không đọc được thành <lane>/<id>`);
    }
    if (typeof alias.because !== 'string' || alias.because.trim().length === 0) {
      problems.push(`${label}: thiếu \`because\` — quy về một mục thì phải khai quy bằng gì`);
    }
    if (!Array.isArray(alias.prs) || alias.prs.length < 2) {
      problems.push(`${label}: \`prs\` phải có ít nhất hai PR`);
      continue;
    }
    for (const number of alias.prs) {
      if (!Number.isInteger(number)) {
        problems.push(`${label}: số PR không hợp lệ (${String(number)})`);
        continue;
      }
      const taken = byPr.get(number);
      if (taken !== undefined && taken !== alias) {
        problems.push(`#${number} nằm trong hai nhóm bí danh ("${taken.claim}" và "${alias.claim}")`);
        continue;
      }
      byPr.set(number, alias);
    }
  }
  if (problems.length > 0) {
    throw new ClaimInputError(`Nhóm bí danh không dùng được:\n  - ${problems.join('\n  - ')}`);
  }
  return byPr;
}

/** Tập file mà một PR đổi — đầu vào của `aliasesFromChangedFiles`. */
export interface PrChangedFiles {
  number: number;
  files: readonly string[];
}

export interface AliasFromFilesOptions {
  /**
   * File mà **quá nhiều** PR cùng chạm thì không nói được gì về việc hai PR
   * có cùng một mục hay không. Ngưỡng **suy từ chính ảnh chụp**, không phải
   * một danh sách cứng: `ops/logs/**`, `ops/known-failures.md` và
   * `ops/lanes/<làn>/backlog.md` tự rơi ra vì mọi PR đều chạm chúng, và một
   * file chung MỚI cũng tự rơi ra mà không ai phải nhớ thêm nó vào đâu.
   */
  sharedFileMaxPrs?: number;
  /** Số file nội dung chung tối thiểu để quy hai PR về cùng một mục. */
  minShared?: number;
}

export const DEFAULT_SHARED_FILE_MAX_PRS = 3;
export const DEFAULT_MIN_SHARED_FILES = 2;

/**
 * Suy nhóm bí danh từ **tập file nội dung chồng nhau** — một cách quy đã
 * khai, không phải cách duy nhất. Bên gọi dựng `ClaimAlias` bằng tay cũng
 * được, miễn là nó nói ra `because`.
 *
 * Ba điều kiện, và cả ba đều cần: (1) hai PR **sống chồng nhau**, (2) tiêu
 * đề mang **hai mã khác nhau** (cùng mã thì phép đếm cũ đã thấy), (3) chung
 * ít nhất `minShared` file **sau khi** bỏ các file mà hơn `sharedFileMaxPrs`
 * PR cùng chạm.
 *
 * Mã quy chuẩn là mã của PR **ra đời trước** — nó nhận mục trước, và đổi mã
 * là việc PR sau phải làm (`KF-042`).
 *
 * ⚠️ **Chỗ cố ý KHÔNG làm, khai ra thay vì để lượt sau tiện tay thêm:** phép
 * quy *"mã mục mà diff của PR đổi tên trong backlog"* mạnh hơn phép này,
 * nhưng nó cần đọc diff của **mọi** PR đang mở ở **mọi** lần chạy — trả tiền
 * ở chỗ đắt nhất. Xem tiêu chí 7 của mục `platform/P-058`.
 */
export function aliasesFromChangedFiles(
  prs: readonly PrSnapshot[],
  changed: readonly PrChangedFiles[],
  options: AliasFromFilesOptions = {},
): ClaimAlias[] {
  const maxPrs = options.sharedFileMaxPrs ?? DEFAULT_SHARED_FILE_MAX_PRS;
  const minShared = options.minShared ?? DEFAULT_MIN_SHARED_FILES;
  if (!Number.isInteger(maxPrs) || maxPrs < 1) {
    throw new ClaimInputError(`sharedFileMaxPrs phải là số nguyên ≥ 1, nhận: ${String(maxPrs)}`);
  }
  if (!Number.isInteger(minShared) || minShared < 1) {
    throw new ClaimInputError(`minShared phải là số nguyên ≥ 1, nhận: ${String(minShared)}`);
  }
  assertSnapshots(prs);

  const byNumber = new Map(prs.map((pr) => [pr.number, pr]));
  const touches = new Map<string, number>();
  for (const entry of changed) {
    if (!Number.isInteger(entry.number) || !Array.isArray(entry.files)) {
      throw new ClaimInputError(`Tập file đổi không đọc được cho #${String(entry.number)}`);
    }
    for (const file of new Set(entry.files)) touches.set(file, (touches.get(file) ?? 0) + 1);
  }
  const contentFiles = (entry: PrChangedFiles): Set<string> =>
    new Set([...new Set(entry.files)].filter((file) => (touches.get(file) ?? 0) <= maxPrs));

  const sorted = [...changed]
    .filter((entry) => byNumber.has(entry.number))
    .sort((a, b) => {
      const left = byNumber.get(a.number)!;
      const right = byNumber.get(b.number)!;
      return (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0) || a.number - b.number;
    });

  // Union-find: một PR chỉ được nằm trong MỘT nhóm, nếu không `assertAliases` ném.
  const parent = new Map<number, number>(sorted.map((entry) => [entry.number, entry.number]));
  const find = (n: number): number => {
    let root = n;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const reasons = new Map<number, string[]>();

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const first = byNumber.get(sorted[i]!.number)!;
      const second = byNumber.get(sorted[j]!.number)!;
      const closed = parsedOrNull(first.closedAt);
      const born = parsedOrNull(second.createdAt);
      if (!(closed === null || born === null || born < closed)) continue;

      const a = claimKeyFromTitle(first.title);
      const b = claimKeyFromTitle(second.title);
      if (a === null || b === null || claimKeyText(a) === claimKeyText(b)) continue;

      const left = contentFiles(sorted[i]!);
      const shared = [...contentFiles(sorted[j]!)].filter((file) => left.has(file)).sort();
      if (shared.length < minShared) continue;

      const rootA = find(first.number);
      const rootB = find(second.number);
      if (rootA !== rootB) parent.set(rootB, rootA);
      const note =
        `#${first.number} (\`${claimKeyText(a)}\`) và #${second.number} (\`${claimKeyText(b)}\`) ` +
        `chung ${shared.length} file nội dung (${shared.join(', ')}) và sống chồng nhau`;
      reasons.set(find(first.number), [...(reasons.get(find(first.number)) ?? []), note]);
    }
  }

  const groups = new Map<number, number[]>();
  for (const entry of sorted) {
    const root = find(entry.number);
    groups.set(root, [...(groups.get(root) ?? []), entry.number]);
  }

  return [...groups]
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => {
      const oldest = members
        .map((n) => byNumber.get(n)!)
        .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.number - b.number)[0]!;
      return {
        claim: claimKeyText(claimKeyFromTitle(oldest.title)!),
        prs: members.slice().sort((a, b) => a - b),
        because: (reasons.get(root) ?? []).join(' · '),
      };
    })
    .sort((a, b) => a.claim.localeCompare(b.claim));
}

const minutesBetween = (from: string, to: string): number | null => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(((b - a) / 60_000) * 100) / 100;
};

/**
 * Các PR có tiêu đề **không** đọc được thành mã mục. In ra chứ không bỏ qua
 * im lặng: một tiêu đề lệch quy ước làm PR đó vô hình với mọi phép đếm ở
 * đây, và im lặng biến một phép đo hỏng thành một kết luận trông chắc nịch
 * (bài học `Z15`).
 */
export function unreadableTitles(prs: readonly PrSnapshot[]): number[] {
  return prs
    .filter((pr) => claimKeyFromTitle(pr.title) === null)
    .map((pr) => pr.number)
    .sort((a, b) => b - a);
}

/**
 * Mọi cặp PR cùng một mục mà thời gian sống chồng nhau.
 *
 * "Chồng nhau" = PR sau được tạo khi PR trước **chưa đóng**. PR trước còn
 * mở (`closedAt === null`) thì mọi PR sau của cùng mục đều chồng. Mốc không
 * đọc được thì cặp đó **được coi là chồng** — thiên lệch về phía báo, vì
 * một cặp bỏ sót là đúng chỗ hỏng mà mục này sinh ra để bắt.
 *
 * Thứ tự kết quả **ổn định**: nhóm sắp theo `createdAt` rồi tới số PR, kết
 * quả cuối sắp theo mã mục rồi hai số PR. Hai thứ tự đầu vào khác nhau phải
 * cho **cùng một** kết quả, nếu không hai lượt đọc cùng dữ liệu sẽ ghi hai
 * câu khác nhau — đúng hình dạng `KF-021`.
 */
export function duplicateClaims(
  prs: readonly PrSnapshot[],
  aliases: readonly ClaimAlias[] = [],
): DuplicateClaim[] {
  const override = assertAliases(aliases);
  const byClaim = new Map<string, PrSnapshot[]>();
  for (const pr of prs) {
    const alias = override.get(pr.number);
    const key = alias === undefined ? claimKeyFromTitle(pr.title) : claimKeyFromText(alias.claim);
    if (key === null) continue;
    const text = claimKeyText(key);
    byClaim.set(text, [...(byClaim.get(text) ?? []), pr]);
  }

  const found: DuplicateClaim[] = [];
  for (const [claim, group] of byClaim) {
    const sorted = [...group].sort(
      (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.number - b.number,
    );
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const first = sorted[i]!;
        const second = sorted[j]!;
        const closed = parsedOrNull(first.closedAt);
        const born = parsedOrNull(second.createdAt);
        const overlaps = closed === null || born === null || born < closed;
        if (!overlaps) continue;
        // `via` nói ra luật đã quy hai PR về một mục. Hai tiêu đề mang cùng
        // một mã thì không cần luật nào — `null`. Khác mã thì phải có một
        // nhóm bí danh, và câu `because` của nó đi thẳng vào bảng.
        const sameTitleClaim =
          claimKeyFromTitle(first.title)?.id === claimKeyFromTitle(second.title)?.id &&
          claimKeyFromTitle(first.title) !== null;
        const alias = override.get(first.number) ?? override.get(second.number);
        found.push({
          claim,
          first: first.number,
          second: second.number,
          via: sameTitleClaim ? null : (alias?.because ?? null),
          minutesApart: minutesBetween(first.createdAt, second.createdAt),
          firstMerged: isMerged(first),
        });
      }
    }
  }
  return found.sort((a, b) => a.claim.localeCompare(b.claim) || a.first - b.first || a.second - b.second);
}

/** Vì sao một mục không nhận được ngay bây giờ. */
export type ClaimVerdict =
  /** Có PR đang mở cho mục này — KHÔNG nhận (`CLAUDE.md` mục 2). */
  | 'open-pr'
  /** Chỉ còn PR nháp bỏ quá `ABANDONED_DRAFT_HOURS` — coi như bỏ, nhận được. */
  | 'abandoned-draft'
  /** PR của mục này vừa merge trong `RECENT_MERGE_MINUTES` — đọc lại backlog trước khi nhận. */
  | 'recently-merged'
  /**
   * **Không kết luận được** — không tiêu đề PR mở nào mang mã này, mà cây
   * thì không làm chứng được cho nó. `stale-id` **không bao giờ** được đọc
   * thành `free`: xem `StaleReason`.
   */
  | 'stale-id'
  /** Không PR nào đang giữ mục này, VÀ cây làm chứng đúng một mục cho mã này. */
  | 'free';

/**
 * Vì sao một mã không kết luận được — mục `platform/P-058` tiêu chí 5.
 *
 * ## Chỗ hỏng, đo được chứ không suy
 *
 * `pnpm claims` trả `{"verdict":"free","prs":[]}` cho `platform/P-028` lúc
 * `2026-09-26T02:2xZ` trong khi `#224` và `#274` **cùng mở** và cùng làm
 * đúng việc của mục đó — dưới hai mã khác (`P-040`, `P-057`). `claimCheck`
 * đọc mã từ **tiêu đề PR** (luật 1 của `P-041`, vẫn đúng), `readyNow` đọc
 * mã từ **cây**; một lần đổi mã đang bay làm hai chuỗi lệch, và phép hỏi
 * *"đã có ai nhận chưa"* trả `free` cho một mục đang có người giữ.
 *
 * ## Vì sao ba lý do này, và vì sao KHÔNG rộng hơn
 *
 * `free` là một câu nói về **thực tế** (*"không ai giữ mục này"*), mà
 * `claimCheck` chỉ đọc được **tiêu đề PR**. Tiêu đề một mình không bao giờ
 * chứng minh được câu đó; nó chỉ chứng minh *"không tiêu đề PR mở nào mang
 * mã này"*. Nên `free` đòi thêm một nhân chứng thứ hai — **cây** — và ba ca
 * dưới đây là ba cách nhân chứng đó **không** làm chứng được:
 *
 * | Lý do | Nghĩa | Vì sao không phải `free` |
 * |---|---|---|
 * | `no-tree` | bên gọi không đưa ảnh chụp cây | `free` chưa từng được kiểm — đúng phép đo đã sinh ra `KF-042` |
 * | `duplicate-id` | mã nằm trong `duplicateIds` | cây nói mã này **hai lần**, nên *"backlog có nó"* không chỉ ra MỘT mục |
 * | `absent-from-tree` | cây không có mã này | mã tới từ chỗ khác (một `readyNow` cũ, một mã gõ tay) — `free` cho nó là một câu về một mục không tồn tại ở đây |
 *
 * **Một lý do cố ý KHÔNG có ở đây:** *"có một PR mở mang mã mà cây không
 * có"*. Nó bắt đúng ca `#224`/`#274`, nhưng nó cũng nổ ở **mọi** lượt bình
 * thường — đo được ngay trên ảnh chụp `2026-09-26T14:2xZ`: `#260` mang
 * `platform/P-053`, mã đó **chỉ** sống trên nhánh của nó. Một bộ dò kêu ở
 * mọi lượt là một bộ dò bị tắt, và tắt nó sẽ đắt hơn ca nó bắt được. Phần
 * còn lại của ca đó là việc của `duplicateClaims` + `aliasesFromChangedFiles`
 * (tiêu chí 6), chỗ có tập file để nối hai PR lại với nhau.
 */
export type StaleReason = 'no-tree' | 'duplicate-id' | 'absent-from-tree';

/**
 * Cây nói gì về mã mục — nhân chứng thứ hai của `claimCheck`.
 *
 * Cả hai trường lấy thẳng từ `ops/scripts/backlog-status.ts`, **không cần
 * mạng**: `ids` là mọi `<lane>/<id>` mà `parseBacklog` đọc được, `duplicateIds`
 * là chính trường cùng tên của `readyQueue` (dạng `<a> ↔ <b>`).
 */
export interface ClaimTree {
  ids: readonly string[];
  duplicateIds: readonly string[];
}

export interface ClaimCheck {
  claim: string;
  verdict: ClaimVerdict;
  /** Số PR đứng sau phán quyết, mới nhất trước. Rỗng khi `free`. */
  prs: number[];
  /**
   * PR có tiêu đề không đọc được thành mã mục, trong đúng ảnh chụp này.
   * **Không tuỳ chọn:** một `free` dựng trên ảnh chụp có PR vô hình là một
   * `free` chưa chắc, và bên gọi phải thấy điều đó chứ không chỉ `duplicateClaims`
   * mới được thấy — hai cửa, không cửa nào im.
   */
  unreadable: number[];
  /**
   * Chỉ có mặt khi `verdict === 'stale-id'`. Vắng mặt ở mọi phán quyết khác
   * — để một `deepEqual` của bên gọi không phải mang một khoá `undefined`.
   */
  staleReason?: StaleReason;
}

/**
 * Phép hỏi của phụ lục P1 bước 3 và bước 4: mục `<lane>/<id>` có ai giữ
 * không, **tính ở đúng mốc `now`**.
 *
 * Bên gọi chạy lại phép này **ngay trước khi push commit đầu tiên**, không
 * chỉ lúc bắt đầu duyệt backlog: khoảng trống giữa hai mốc đó chính là
 * 89 giây đã sinh ra `#221`/`#222`, và 9,75 phút đã sinh ra `#224`/`#225`.
 *
 * Ném `ClaimInputError` khi không đủ dữ kiện để trả lời — xem luật 4.
 */
export function claimCheck(
  prs: readonly PrSnapshot[],
  lane: string,
  id: string,
  now: string,
  tree?: ClaimTree,
): ClaimCheck {
  if (!(LANES as readonly string[]).includes(lane)) {
    throw new ClaimInputError(`Tên làn không thuộc LANES: ${lane}`);
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new ClaimInputError(`Mốc "now" không đọc được: ${now}`);
  assertSnapshots(prs);

  const claim = claimKeyText({ lane: lane as LaneName, id });
  const unreadable = unreadableTitles(prs);
  const mine = prs.filter((pr) => {
    const key = claimKeyFromTitle(pr.title);
    return key !== null && claimKeyText(key) === claim;
  });
  const numbers = (list: readonly PrSnapshot[]): number[] =>
    list.map((pr) => pr.number).sort((a, b) => b - a);

  const open = mine.filter((pr) => pr.closedAt === null);
  if (open.length > 0) {
    const alive = open.filter(
      (pr) => !pr.isDraft || nowMs - Date.parse(pr.updatedAt) < ABANDONED_DRAFT_HOURS * 3_600_000,
    );
    // Chỉ khi MỌI PR đang mở đều là nháp đã bỏ thì mục mới nhận lại được:
    // một PR sống cộng một PR nháp chết vẫn là "có người giữ".
    return alive.length > 0
      ? { claim, verdict: 'open-pr', prs: numbers(alive), unreadable }
      : { claim, verdict: 'abandoned-draft', prs: numbers(open), unreadable };
  }

  const cutoff = nowMs - RECENT_MERGE_MINUTES * 60_000;
  const recent = mine.filter((pr) => isMerged(pr) && Date.parse(pr.mergedAt!) >= cutoff);
  if (recent.length > 0) {
    return { claim, verdict: 'recently-merged', prs: numbers(recent), unreadable };
  }

  // ── Từ đây trở xuống, tiêu đề PR đã hết chuyện để nói. `free` cần nhân
  //    chứng thứ hai; không có nó thì phán quyết là `stale-id`, không phải
  //    `free` (mục `platform/P-058` tiêu chí 5, `KF-042`).
  const stale = (staleReason: StaleReason): ClaimCheck => ({
    claim,
    verdict: 'stale-id',
    prs: [],
    unreadable,
    staleReason,
  });
  if (tree === undefined) return stale('no-tree');
  if (!Array.isArray(tree.ids) || !Array.isArray(tree.duplicateIds)) {
    throw new ClaimInputError('`tree` phải có `ids` và `duplicateIds` là mảng — thiếu thì NÉM, không trả `free`.');
  }
  if (tree.duplicateIds.some((entry) => splitDuplicateId(entry).includes(claim))) {
    return stale('duplicate-id');
  }
  if (!tree.ids.includes(claim)) return stale('absent-from-tree');

  return { claim, verdict: 'free', prs: [], unreadable };
}

/**
 * `duplicateIds` của `backlog-status.ts` mang dạng `<a> ↔ <b>`. Tách ra chứ
 * không `includes` cả chuỗi: `includes` sẽ khớp `platform/P-02` với
 * `platform/P-028 ↔ platform/P-028`, tức báo nhầm cho một mã khác.
 */
function splitDuplicateId(entry: string): string[] {
  return String(entry)
    .split('↔')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Bảng người đọc. **In cả khi không có va chạm nào** — im lặng ở đây đúng
 * là thứ nhóm Z cấm (bài học `Z7`/`Z15`).
 */
export function renderDuplicateClaims(
  duplicates: readonly DuplicateClaim[],
  unreadable: readonly number[] = [],
): string {
  const head =
    duplicates.length === 0
      ? 'Va chạm nhận mục: 0 — không mục nào có hai PR sống chồng nhau.'
      : `Va chạm nhận mục: ${duplicates.length} cặp PR cùng một mục, thời gian sống chồng nhau:`;
  const rows = duplicates.map(
    (d) =>
      `  ✗ ${d.claim}: #${d.first} và #${d.second}, ` +
      (d.minutesApart === null ? 'không đo được khoảng cách' : `cách nhau ${d.minutesApart} phút`) +
      (d.firstMerged ? ` — #${d.first} ĐÃ MERGE, nên #${d.second} kẹt xung đột` : '') +
      // Quy về một mục bằng một luật thì bảng phải nói ra luật đó (I6).
      (d.via === null ? '' : `\n      quy về cùng một mục vì: ${d.via}`),
  );
  const tail =
    unreadable.length === 0
      ? ''
      : `\n  · ${unreadable.length} PR có tiêu đề không đọc được thành mã mục (vô hình với phép đếm này): ` +
        unreadable.map((n) => `#${n}`).join(' ');
  return [head, ...rows].join('\n') + tail;
}

// ── CLI ──────────────────────────────────────────────────────────────────
interface CliInput {
  /** Ảnh chụp PR — mở lẫn đã đóng; càng đủ thì phép đếm càng đúng. */
  prs?: readonly PrSnapshot[];
  /** Có thì tool trả thêm `claimCheck` cho đúng mục đó. */
  lane?: string;
  id?: string;
  now?: string;
  /**
   * Nhân chứng thứ hai của `claimCheck`. **Bỏ trống thì CLI tự dựng** từ
   * `ops/lanes/<làn>/backlog.md` của cây đang chạy — không gọi mạng. Khai
   * tay chỉ để dựng lại một ảnh chụp cũ trong bài kiểm.
   */
  tree?: ClaimTree;
  /** Tập file mà từng PR đổi — có thì CLI suy nhóm bí danh (tiêu chí 6). */
  changedFiles?: readonly PrChangedFiles[];
}

/**
 * Dựng `ClaimTree` từ chính cây đang chạy. Nằm ở tầng CLI chứ không trong
 * `claimCheck`: hàm kia phải **thuần** để bài kiểm dựng lại được ảnh chụp
 * `2026-09-26T02:2xZ`, còn đọc đĩa là việc của bên gọi.
 */
export async function readClaimTree(root: string): Promise<ClaimTree> {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { parseBacklog } = await import('./backlog-status.ts');

  const lanesDir = join(root, 'ops', 'lanes');
  const ids: string[] = [];
  const seen = new Map<string, number>();
  for (const entry of readdirSync(lanesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const lane = entry.name;
    for (const item of parseBacklog(readFileSync(join(lanesDir, lane, 'backlog.md'), 'utf8'))) {
      const claim = `${lane}/${item.id}`;
      ids.push(claim);
      seen.set(claim, (seen.get(claim) ?? 0) + 1);
    }
  }
  const duplicateIds = [...seen]
    .filter(([, count]) => count > 1)
    .map(([claim]) => `${claim} ↔ ${claim}`)
    .sort();
  return { ids: [...new Set(ids)].sort(), duplicateIds };
}

const isMain = process.argv[1]?.endsWith('claim-collision.ts') === true;

if (isMain) {
  const { readFileSync } = await import('node:fs');
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write(
      'Thiếu đường dẫn file JSON: {prs:[{number,title,createdAt,closedAt,mergedAt,isDraft,updatedAt}], lane?, id?, now?}\n',
    );
    process.exit(2);
  }

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as CliInput;
    const prs = raw.prs ?? [];
    assertSnapshots(prs);
    const aliases =
      raw.changedFiles === undefined ? [] : aliasesFromChangedFiles(prs, raw.changedFiles);
    const duplicates = duplicateClaims(prs, aliases);
    const unreadable = unreadableTitles(prs);
    // Hỏi mục nào thì phải trả lời được mục đó: khai `lane`/`id` mà thiếu
    // một nửa là đầu vào hỏng, không phải lời mời bỏ qua phần `check`.
    if ((raw.lane === undefined) !== (raw.id === undefined)) {
      throw new ClaimInputError('Khai `lane` thì phải khai `id`, và ngược lại.');
    }
    // Cây: khai tay thì dùng bản khai, không thì ĐỌC cây đang chạy. Không
    // bao giờ để trống rồi đi tiếp — một `free` không có nhân chứng thứ hai
    // chính là chỗ hỏng mục `platform/P-058` chữa, nên tool không được phép
    // tự rơi vào ca `no-tree` chỉ vì bên gọi không biết phải khai gì.
    const { fileURLToPath } = await import('node:url');
    const tree = raw.tree ?? (await readClaimTree(fileURLToPath(new URL('../..', import.meta.url))));
    const check =
      raw.lane === undefined
        ? null
        : claimCheck(prs, raw.lane, raw.id!, raw.now ?? new Date().toISOString(), tree);

    if (process.argv.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ duplicates, unreadable, aliases, check })}\n`);
    } else {
      process.stdout.write(`${renderDuplicateClaims(duplicates, unreadable)}\n`);
      if (check !== null) process.stdout.write(`${JSON.stringify(check)}\n`);
    }
    // Thoát 0 kể cả khi CÓ va chạm: đây là phép ĐO cho bên gọi (worker, bản
    // tin), không phải một cổng chặn — cổng chặn duy nhất là người nhận việc
    // đọc `verdict` rồi đi mục khác.
  } catch (error) {
    // "Không trả lời được" KHÁC "không ai giữ mục này", và phải khác cả ở
    // mã thoát: một `free` giả đi thẳng vào đúng va chạm mục này chữa.
    process.stderr.write(`⚠ KHÔNG TRẢ LỜI ĐƯỢC — ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}
