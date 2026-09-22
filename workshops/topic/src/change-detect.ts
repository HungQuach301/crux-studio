/**
 * Phát hiện dữ liệu thay đổi và đính chính (mục backlog `topic/T-004`, spec
 * WP-011, sổ rủi ro R6 và R7).
 *
 * Khi một chuỗi đã dùng trong tập ĐÃ PHÁT HÀNH bị điều chỉnh sau công bố, phải
 * mở issue chỉ **đúng** tập nào, claim nào, con số nào — không chỉ "chuỗi X
 * đổi". Hai tiêu chí xong của T-004, cả hai nằm trong code có phép kiểm:
 *
 *   1. So được hai `asOfDate` của cùng một chuỗi và liệt kê ô nào đổi.
 *   2. Issue sinh ra dẫn ngược tới `claimId` và tập bị ảnh hưởng, không chỉ
 *      tới tên chuỗi.
 *
 * Ba loại thay đổi phải PHÂN BIỆT (WP-011 §3b) — nuốt loại đầu vào loại sau là
 * cách hỏng im lặng (nhóm Z), nên mỗi loại có lối ra riêng:
 *
 *   | Loại | Dấu hiệu | Hành động |
 *   |---|---|---|
 *   | `new-period`        | chỉ thêm kỳ mới, kỳ cũ không đổi | KHÔNG mở issue — dữ liệu chạy bình thường |
 *   | `revision`          | cùng `period`, giá trị khác quá ngưỡng | mở issue (R6) |
 *   | `definition-change` | `unit` hoặc `frequency` đổi | mở issue mức cao — MỌI claim dùng chuỗi phải xem lại, kể cả khi giá trị không đổi |
 *
 * Ngưỡng (WP-011 §3b): dùng `changeAlertThresholdAbs` KHI CÓ, `changeAlertThresholdPct`
 * khi không. Với chuỗi có giá trị gần 0, phần trăm là vô nghĩa (lãi suất 0,25%
 * lên 0,5% là +100%) — nên tuyệt đối thắng phần trăm khi cả hai được khai, và
 * đổi từ/đến một ô thiếu (`null`) luôn tính là đổi thật (không so số được).
 *
 * **Đây là công cụ, KHÔNG phải một stage.** Nó chỉ đọc kho ảnh chụp (mục
 * T-003) và một bảng ràng buộc claim↔ô (`../contracts/claim-source.v0.schema.json`),
 * rồi trả về nội dung issue như DỮ LIỆU. Nó **không** tự mở issue, không tự sửa
 * artifact tập nào — người quyết (WP-011 §5). Việc nối nó vào một workflow theo
 * lịch là của runtime; agent xây dựng không ghi `.github/` (CLAUDE.md mục 4),
 * và Đợt 0 không có lịch chạy nào gọi tới đây.
 *
 * Ngoài phạm vi tiêu chí xong T-004, ghi ra thay vì làm lấn: chuỗi `annual-reset`
 * kiểm cả **hạn** (WP-011 §5), và khử trùng issue qua nhiều lần chạy dựa trên
 * một kho issue thật — ở đây chỉ cung cấp KHOÁ khử trùng (`issueDedupKey`) và
 * một hàm gộp trong-bộ-nhớ (`dedupeIssues`); kho thật là việc của runtime.
 *
 * Bất biến I3: file này chỉ import `@crux/kernel` và các module cùng xưởng.
 */

import { validate } from '@crux/kernel';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { JsonSchema } from '@crux/kernel';
import type { Observation, Provider, SeriesSnapshot } from './snapshot.ts';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

export const claimSourceSchema: JsonSchema = JSON.parse(
  readFileSync(`${CONTRACTS_DIR}claim-source.v0.schema.json`, 'utf8'),
) as JsonSchema;

/** Một ràng buộc claim↔ô: một con số đã phát hành, ghim vào đúng ô dữ liệu. */
export interface ClaimBinding {
  episodeId: string;
  claimId: string;
  provider: Provider;
  seriesId: string;
  period: string;
  publishedValue: number | null;
}

/** Một ô đổi giữa hai phiên bản. `null` một bên nghĩa là ô xuất hiện/biến mất. */
export interface CellChange {
  period: string;
  previousValue: number | null;
  nextValue: number | null;
}

/** Kết quả so hai snapshot cùng chuỗi, tách theo loại thay đổi ô. */
export interface SnapshotDiff {
  provider: Provider;
  seriesId: string;
  previousAsOfDate: string;
  nextAsOfDate: string;
  /** Kỳ có ở cả hai, giá trị khác nhau. */
  revised: CellChange[];
  /** Kỳ chỉ có ở bản mới. */
  added: CellChange[];
  /** Kỳ chỉ có ở bản cũ. */
  removed: CellChange[];
  previousUnit: string;
  nextUnit: string;
  unitChanged: boolean;
  previousFrequency: SeriesSnapshot['frequency'];
  nextFrequency: SeriesSnapshot['frequency'];
  frequencyChanged: boolean;
}

export type ChangeType = 'none' | 'new-period' | 'revision' | 'definition-change';

/** Ngưỡng cảnh báo của một chuỗi. Cả hai để trống nghĩa là "mọi thay đổi là đáng kể". */
export interface SeriesThresholds {
  /** Chênh lệch tuyệt đối tối đa được bỏ qua. Thắng phần trăm khi cả hai có. */
  changeAlertThresholdAbs?: number;
  /** Chênh lệch phần trăm tối đa được bỏ qua, tính theo %. Chỉ dùng khi không có ngưỡng tuyệt đối. */
  changeAlertThresholdPct?: number;
}

/** Đánh giá một cặp snapshot: loại thay đổi, và những ô vượt ngưỡng. */
export interface ChangeAssessment {
  diff: SnapshotDiff;
  changeType: ChangeType;
  /** Chỉ những ô `revised` vượt ngưỡng — là các ô kéo theo claim bị ảnh hưởng. */
  materialRevisions: CellChange[];
  /** `true` khi `unit`/`frequency` đổi: mở issue mức cao, mọi claim phải xem lại. */
  high: boolean;
}

/** Lỗi contract: không tra ngược được từ `seriesId` ra `claimId` (WP-011 §5b). */
export class ClaimTraceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimTraceError';
  }
}

/** Lỗi khi hai snapshot đem so không phải cùng một chuỗi. */
export class SeriesMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeriesMismatchError';
  }
}

function toMap(observations: readonly Observation[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const o of observations) map.set(o.period, o.value);
  return map;
}

/**
 * So hai snapshot cùng `provider`+`seriesId` ở hai `asOfDate`. Ném nếu chúng
 * không cùng chuỗi — so hai chuỗi khác nhau là vô nghĩa và là lỗi gọi.
 *
 * `previous` phải là bản cũ hơn hoặc bằng theo `asOfDate`; không ép thứ tự
 * (bên gọi giữ), nhưng hai `asOfDate` phải khác nhau — so một phiên bản với
 * chính nó không sinh được "đính chính".
 */
export function diffSnapshots(previous: SeriesSnapshot, next: SeriesSnapshot): SnapshotDiff {
  if (previous.provider !== next.provider || previous.seriesId !== next.seriesId) {
    throw new SeriesMismatchError(
      `So hai chuỗi khác nhau: ${previous.provider}:${previous.seriesId} vs ` +
        `${next.provider}:${next.seriesId}. Chỉ so cùng một chuỗi qua hai asOfDate.`,
    );
  }
  if (previous.asOfDate === next.asOfDate) {
    throw new SeriesMismatchError(
      `Hai snapshot cùng asOfDate ${previous.asOfDate} — không có "phiên bản mới" để so.`,
    );
  }

  const prevMap = toMap(previous.observations);
  const nextMap = toMap(next.observations);

  const revised: CellChange[] = [];
  const added: CellChange[] = [];
  const removed: CellChange[] = [];

  for (const [period, nextValue] of nextMap) {
    if (!prevMap.has(period)) {
      added.push({ period, previousValue: null, nextValue });
      continue;
    }
    const previousValue = prevMap.get(period)!;
    if (previousValue !== nextValue) {
      revised.push({ period, previousValue, nextValue });
    }
  }
  for (const [period, previousValue] of prevMap) {
    if (!nextMap.has(period)) {
      removed.push({ period, previousValue, nextValue: null });
    }
  }

  const byPeriod = (a: CellChange, b: CellChange): number =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0;
  revised.sort(byPeriod);
  added.sort(byPeriod);
  removed.sort(byPeriod);

  return {
    provider: next.provider,
    seriesId: next.seriesId,
    previousAsOfDate: previous.asOfDate,
    nextAsOfDate: next.asOfDate,
    revised,
    added,
    removed,
    previousUnit: previous.unit,
    nextUnit: next.unit,
    unitChanged: previous.unit !== next.unit,
    previousFrequency: previous.frequency,
    nextFrequency: next.frequency,
    frequencyChanged: previous.frequency !== next.frequency,
  };
}

/**
 * Một ô `revised` có vượt ngưỡng không. Đổi từ/đến `null` (ô xuất hiện hay
 * biến mất so được) luôn là đổi thật. Ngưỡng tuyệt đối thắng phần trăm; gần 0
 * mà chỉ có ngưỡng phần trăm thì mọi thay đổi khác 0 là đáng kể.
 */
export function exceedsThreshold(change: CellChange, thresholds: SeriesThresholds = {}): boolean {
  const { previousValue, nextValue } = change;
  if (previousValue === null || nextValue === null) return previousValue !== nextValue;

  const abs = Math.abs(nextValue - previousValue);
  if (thresholds.changeAlertThresholdAbs !== undefined) {
    return abs > thresholds.changeAlertThresholdAbs;
  }
  if (thresholds.changeAlertThresholdPct !== undefined) {
    if (previousValue === 0) return abs > 0; // phần trăm vô nghĩa quanh 0
    return (abs / Math.abs(previousValue)) * 100 > thresholds.changeAlertThresholdPct;
  }
  return abs > 0;
}

/**
 * Phân loại một cặp snapshot. `definition-change` (đổi đơn vị/tần suất) thắng
 * mọi thứ: kể cả khi không ô nào đổi giá trị, mọi claim vẫn phải xem lại. Kế
 * đến là `revision` khi có ô vượt ngưỡng. Còn lại — chỉ thêm kỳ mới, hoặc thay
 * đổi dưới ngưỡng — là `new-period`/`none`, không mở issue.
 */
export function assessChange(
  previous: SeriesSnapshot,
  next: SeriesSnapshot,
  thresholds: SeriesThresholds = {},
): ChangeAssessment {
  const diff = diffSnapshots(previous, next);
  const materialRevisions = diff.revised.filter((c) => exceedsThreshold(c, thresholds));

  let changeType: ChangeType;
  let high = false;
  if (diff.unitChanged || diff.frequencyChanged) {
    changeType = 'definition-change';
    high = true;
  } else if (materialRevisions.length > 0) {
    changeType = 'revision';
  } else if (diff.added.length > 0 || diff.removed.length > 0) {
    changeType = 'new-period';
  } else {
    changeType = 'none';
  }

  return { diff, changeType, materialRevisions, high };
}

/** Một dòng tác động: một claim của một tập, con số cũ và mới của ô nó trích. */
export interface ImpactRow {
  episodeId: string;
  claimId: string;
  period: string;
  publishedValue: number | null;
  /** Giá trị mới của cùng `period` ở bản mới; `null` nếu ô đó bị gỡ, `undefined` nếu ô không đổi. */
  newValue: number | null | undefined;
}

/**
 * Kiểm mọi ràng buộc hợp contract TRƯỚC khi tra. Thiếu một trường là "không
 * tra ngược được" của WP-011 §5b — dừng và nêu tên trường, đây là lỗi contract
 * chứ không phải lỗi code. Ném `ClaimTraceError` thay vì trả bảng thiếu ô.
 */
export function assertBindings(bindings: readonly unknown[]): asserts bindings is ClaimBinding[] {
  bindings.forEach((binding, index) => {
    const result = validate(binding, claimSourceSchema);
    if (!result.valid) {
      const detail = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new ClaimTraceError(
        `Ràng buộc claim↔ô thứ ${index} không hợp contract — không tra ngược được ` +
          `seriesId ra claimId (WP-011 §5b, lỗi contract): ${detail}`,
      );
    }
  });
}

/**
 * Danh sách claim bị ảnh hưởng bởi một thay đổi. `definition-change` chạm MỌI
 * claim dùng chuỗi (kể cả giá trị không đổi); `revision` chỉ chạm các claim
 * ghim vào đúng những ô vượt ngưỡng. Chỉ xét ràng buộc cùng `provider`+`seriesId`
 * của thay đổi. Ném nếu một ràng buộc thiếu trường (không tra được — §5b).
 */
export function impactedClaims(
  assessment: ChangeAssessment,
  bindings: readonly unknown[],
): ImpactRow[] {
  assertBindings(bindings);
  const { diff } = assessment;

  const forSeries = bindings.filter(
    (b) => b.provider === diff.provider && b.seriesId === diff.seriesId,
  );

  const nextByPeriod = new Map<string, number | null>();
  for (const c of [...diff.revised, ...diff.removed]) nextByPeriod.set(c.period, c.nextValue);

  const affectedPeriods = new Set(assessment.materialRevisions.map((c) => c.period));

  const rows: ImpactRow[] = [];
  for (const b of forSeries) {
    const touched = assessment.high || affectedPeriods.has(b.period);
    if (!touched) continue;
    rows.push({
      episodeId: b.episodeId,
      claimId: b.claimId,
      period: b.period,
      publishedValue: b.publishedValue,
      newValue: nextByPeriod.has(b.period) ? nextByPeriod.get(b.period)! : undefined,
    });
  }

  const byEpisodeThenClaim = (a: ImpactRow, b: ImpactRow): number =>
    a.episodeId < b.episodeId ? -1
    : a.episodeId > b.episodeId ? 1
    : a.claimId < b.claimId ? -1
    : a.claimId > b.claimId ? 1
    : 0;
  return rows.sort(byEpisodeThenClaim);
}

/** Nội dung issue như dữ liệu — runtime mở, không phải hàm này. */
export interface ChangeIssue {
  /** Khử trùng: cùng chuỗi cùng phiên bản mới chỉ một issue (WP-011 §5). */
  dedupKey: string;
  title: string;
  body: string;
  high: boolean;
  impact: ImpactRow[];
}

/** `<provider>:<seriesId>:<nextAsOfDate>` — cùng chuỗi cùng vintage là một issue. */
export function issueDedupKey(diff: SnapshotDiff): string {
  return `${diff.provider}:${diff.seriesId}:${diff.nextAsOfDate}`;
}

function fmt(value: number | null | undefined): string {
  if (value === undefined) return '(không đổi)';
  if (value === null) return '(thiếu)';
  return String(value);
}

/**
 * Dựng nội dung issue tiếng Việt (mở đầu 🤖, quy ước mục 5 CLAUDE.md). Bắt buộc
 * mang: chuỗi nào, phiên bản cũ và mới, từng ô đổi, và — điểm mấu chốt của
 * tiêu chí xong — danh sách `episodeId` + `claimId` + con số đã phát hành và
 * con số mới, cùng một nút quyết định. Không có tác động thì không có issue.
 */
export function buildChangeIssue(assessment: ChangeAssessment, impact: ImpactRow[]): ChangeIssue {
  const { diff, high, changeType } = assessment;
  const kind = high ? 'đổi định nghĩa/đơn vị' : 'điều chỉnh sau công bố';
  const scope = `${diff.provider}:${diff.seriesId}`;

  const cellLines = high && diff.unitChanged
    ? [`- Đơn vị: \`${diff.previousUnit}\` → \`${diff.nextUnit}\``]
    : [];
  if (high && diff.frequencyChanged) {
    cellLines.push(`- Tần suất: \`${diff.previousFrequency}\` → \`${diff.nextFrequency}\``);
  }
  for (const c of assessment.materialRevisions) {
    cellLines.push(`- Kỳ \`${c.period}\`: ${fmt(c.previousValue)} → ${fmt(c.nextValue)}`);
  }

  const impactLines = impact.map(
    (r) =>
      `- Tập \`${r.episodeId}\`, claim \`${r.claimId}\`, kỳ \`${r.period}\`: ` +
      `đã phát hành ${fmt(r.publishedValue)} → nay ${fmt(r.newValue)}`,
  );

  const body = [
    `🤖 Chuỗi \`${scope}\` đã ${kind} giữa hai phiên bản dữ liệu.`,
    '',
    `**Phiên bản:** \`${diff.previousAsOfDate}\` → \`${diff.nextAsOfDate}\``,
    '',
    ...(high
      ? ['**Mức cao — mọi claim dùng chuỗi này phải xem lại, kể cả khi giá trị không đổi.**', '']
      : []),
    '**Ô đã đổi:**',
    ...(cellLines.length > 0 ? cellLines : ['- (không có ô giá trị nào vượt ngưỡng)']),
    '',
    '**Tập và claim bị ảnh hưởng:**',
    ...(impactLines.length > 0
      ? impactLines
      : ['- (không có ràng buộc claim↔ô nào trỏ tới chuỗi này)']),
    '',
    '**Cần quyết:** đính chính bằng bình luận ghim · sửa mô tả tập · hay gỡ tập.',
    '',
    `_changeType: ${changeType}_`,
  ]
    .filter((line, i, all) => !(line === '' && all[i - 1] === ''))
    .join('\n');

  const title = high
    ? `🤖 [dữ liệu đổi · CAO] ${scope} đổi định nghĩa (asOf ${diff.nextAsOfDate})`
    : `🤖 [dữ liệu đổi] ${scope} điều chỉnh ${assessment.materialRevisions.length} kỳ (asOf ${diff.nextAsOfDate})`;

  return { dedupKey: issueDedupKey(diff), title, body, high, impact };
}

/**
 * Đường trọn: so hai snapshot, phân loại, tra claim, dựng issue. Trả `null` khi
 * KHÔNG cần issue (`none`/`new-period`) — đúng luật "chỉ thêm kỳ mới thì không
 * làm gì". Loại `revision`/`definition-change` thì trả nội dung issue.
 */
export function detectAndReport(
  previous: SeriesSnapshot,
  next: SeriesSnapshot,
  bindings: readonly unknown[] = [],
  thresholds: SeriesThresholds = {},
): ChangeIssue | null {
  const assessment = assessChange(previous, next, thresholds);
  if (assessment.changeType === 'none' || assessment.changeType === 'new-period') return null;
  const impact = impactedClaims(assessment, bindings);
  return buildChangeIssue(assessment, impact);
}

/**
 * Gộp các issue trùng khoá khử trùng — chạy lại hai lần cho ra cùng khoá nên
 * không nhân đôi (WP-011 §6 kiểm âm 2). Kho issue thật của runtime dùng cùng
 * khoá này; đây là bản trong-bộ-nhớ cho một lượt quét.
 */
export function dedupeIssues(issues: readonly ChangeIssue[]): ChangeIssue[] {
  const byKey = new Map<string, ChangeIssue>();
  for (const issue of issues) {
    if (!byKey.has(issue.dedupKey)) byKey.set(issue.dedupKey, issue);
  }
  return [...byKey.values()];
}
