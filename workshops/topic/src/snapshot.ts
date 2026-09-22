/**
 * Kho ảnh chụp dữ liệu có phiên bản (mục backlog `topic/T-003`, spec WP-010,
 * Lõi định lượng 1).
 *
 * Ba adapter — `fred`, `bls`, `census` — chuẩn hoá dữ liệu của ba nhà cung
 * cấp nhóm 1 (`packs/channels/us-personal-finance/data-sources.md`) về **một**
 * contract snapshot chung (`../contracts/snapshot.v0.schema.json`). KHÔNG xây
 * adapter tổng quát: đó là tối ưu hoá sớm, và ba nhà này đã đủ cho những tập
 * đầu.
 *
 * Ba luật chịu tải của mục, cả ba nằm trong code có phép kiểm chứ không trong
 * ghi chú:
 *
 * 1. **`asOfDate` là mốc phiên bản, và là khoá tất định.** Chạy lại một
 *    adapter với cùng `asOfDate` trên cùng dữ liệu gốc phải cho ra cùng
 *    `observations` và cùng `contentHash`. `contentHash` băm nội dung dữ liệu
 *    (`provider`, `seriesId`, `asOfDate`, `unit`, `frequency`, `observations`)
 *    và **không** gồm `fetchedAt`, nên hai lần chụp cùng phiên bản ở hai thời
 *    điểm khác nhau vẫn trùng băm.
 *
 * 2. **Thiếu secret thì DỪNG và báo tên secret thiếu.** `requireSecret` ném
 *    `MissingSecretError` mang đúng tên biến môi trường còn thiếu, và nó chạy
 *    TRƯỚC mọi lần chạm mạng. Adapter KHÔNG tự tạo secret, không đoán khoá,
 *    không đọc khoá từ file trong repo (bất biến I1).
 *
 * 3. **Phần gọi API thật không nối ở đây.** Giống corpus (mục `T-011`): Đợt 0
 *    không có lệnh gọi API trả tiền (CHARTER mục 9). `fetchSnapshot` nhận một
 *    `transport` tiêm vào; `transport` mặc định ném `LiveFetchNotWiredError`.
 *    Phần chạy được mà không cần khoá — chuẩn hoá, băm, cổng secret, phép
 *    soát contract — là phần nằm ở file này và có test.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stableHash, validate, type JsonSchema, type ValidationResult } from '@crux/kernel';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

function load(name: string): JsonSchema {
  return JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as JsonSchema;
}

export const snapshotSchema: JsonSchema = load('snapshot.v0.schema.json');

export const SNAPSHOT_SCHEMA_VERSION = 0;

export type Provider = 'fred' | 'bls' | 'census';

export const PROVIDERS: readonly Provider[] = ['fred', 'bls', 'census'];

/**
 * Tên biến môi trường mang khoá của mỗi nhà cung cấp. Đây là DANH SÁCH duy
 * nhất để một bên khác (bản tin, watchdog) biết secret nào chưa có, nên nó là
 * dữ liệu có tên chứ không phải chuỗi rải trong code.
 */
export const SECRET_ENV: Readonly<Record<Provider, string>> = {
  fred: 'FRED_API_KEY',
  bls: 'BLS_API_KEY',
  census: 'CENSUS_API_KEY',
};

export interface Observation {
  /** Kỳ dữ liệu đã chuẩn hoá về ISO date (đầu kỳ). */
  period: string;
  /** Giá trị đã ép về số, hoặc `null` khi nhà cung cấp báo thiếu. */
  value: number | null;
}

export interface SnapshotSource {
  publisher: string;
  datasetRef: string;
  url?: string;
}

export interface SeriesSnapshot {
  schemaVersion: number;
  snapshotId: string;
  provider: Provider;
  seriesId: string;
  asOfDate: string;
  fetchedAt: string;
  provenance: 'api' | 'hand-built';
  source: SnapshotSource;
  unit: string;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'other';
  observations: Observation[];
  contentHash: string;
}

/** Phần chuẩn hoá mà một adapter rút ra từ dữ liệu gốc của nhà cung cấp. */
export interface Normalized {
  unit: string;
  frequency: SeriesSnapshot['frequency'];
  observations: Observation[];
}

/**
 * Thiếu secret của một nhà cung cấp. Mang đúng TÊN biến môi trường còn thiếu
 * để bên gọi in ra thẳng, không phải tra bảng — đó là "báo tên secret thiếu"
 * của tiêu chí xong.
 */
export class MissingSecretError extends Error {
  readonly provider: Provider;
  readonly secretName: string;
  constructor(provider: Provider) {
    const secretName = SECRET_ENV[provider];
    super(
      `Thiếu secret cho nhà cung cấp '${provider}': đặt biến môi trường ${secretName}. ` +
        `Adapter DỪNG ở đây, không tự tạo secret (tiêu chí xong T-003, bất biến I1).`,
    );
    this.name = 'MissingSecretError';
    this.provider = provider;
    this.secretName = secretName;
  }
}

/**
 * Phần gọi API thật chưa được nối (Đợt 0 không gọi API trả tiền, CHARTER mục
 * 9). Tách khỏi `MissingSecretError` để một lần chạy phân biệt được "chưa có
 * khoá" với "có khoá nhưng chưa cắm đường mạng".
 */
export class LiveFetchNotWiredError extends Error {
  constructor(provider: Provider) {
    super(
      `Chưa nối đường gọi API thật cho '${provider}' (Đợt 0 không gọi API trả tiền). ` +
        `Tiêm 'transport' để chạy, hoặc dùng normalize* trên dữ liệu gốc có sẵn.`,
    );
    this.name = 'LiveFetchNotWiredError';
  }
}

/** Dữ liệu bất thường khi chuẩn hoá — ném để lộ ra, không nuốt bằng cách trả `null`. */
export class NormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizeError';
  }
}

/**
 * Trả khoá của nhà cung cấp, hoặc ném `MissingSecretError`. Chạy TRƯỚC mọi
 * lần chạm mạng. Khoảng trắng đầu/cuối bị cắt; chuỗi rỗng coi như thiếu.
 */
export function requireSecret(provider: Provider, env: NodeJS.ProcessEnv = process.env): string {
  const key = env[SECRET_ENV[provider]]?.trim();
  if (key === undefined || key.length === 0) throw new MissingSecretError(provider);
  return key;
}

/** Nhà cung cấp nào đang thiếu khoá — cho bản tin/watchdog liệt kê một lần. */
export function missingSecrets(env: NodeJS.ProcessEnv = process.env): Provider[] {
  return PROVIDERS.filter((p) => (env[SECRET_ENV[p]]?.trim() ?? '').length === 0);
}

// ── Ép giá trị và kỳ ─────────────────────────────────────────────────────

/** Các chuỗi mà một nhà cung cấp dùng để báo "ô này thiếu số". */
const MISSING_TOKENS = new Set(['', '.', 'na', 'n/a', 'null', '(na)', '-']);

/**
 * Ép một giá trị thô về `number | null`. Chuỗi thiếu đã biết -> `null`; số
 * đọc được -> số; còn lại (chuỗi lạ không phải số, không phải token thiếu) ->
 * ném, vì nuốt nó thành `null` là đúng nhóm Z (mất một ô mà không gì đỏ).
 */
export function coerceValue(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') {
    throw new NormalizeError(`Giá trị không phải chuỗi hay số: ${JSON.stringify(raw)}`);
  }
  const trimmed = raw.trim();
  if (MISSING_TOKENS.has(trimmed.toLowerCase())) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) throw new NormalizeError(`Giá trị không đọc được thành số: ${JSON.stringify(raw)}`);
  return n;
}

const MONTH_ISO = (year: string, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}-01`;

/** Kỳ của BLS (`M01`..`M12`, `Q01`..`Q04`, `A01`, `M13` bình quân năm) -> ISO date đầu kỳ. */
export function blsPeriodToIso(year: string, period: string): string {
  if (!/^\d{4}$/.test(year)) throw new NormalizeError(`Năm BLS không hợp lệ: ${JSON.stringify(year)}`);
  const m = /^M(\d{2})$/.exec(period);
  if (m) {
    const month = Number(m[1]);
    if (month >= 1 && month <= 12) return MONTH_ISO(year, month);
    if (month === 13) return MONTH_ISO(year, 1); // M13 = bình quân năm -> đầu năm
    throw new NormalizeError(`Kỳ tháng BLS lạ: ${JSON.stringify(period)}`);
  }
  const q = /^Q(\d{2})$/.exec(period);
  if (q) {
    const quarter = Number(q[1]);
    if (quarter >= 1 && quarter <= 4) return MONTH_ISO(year, (quarter - 1) * 3 + 1);
    if (quarter === 5) return MONTH_ISO(year, 1); // Q05 = bình quân năm
    throw new NormalizeError(`Kỳ quý BLS lạ: ${JSON.stringify(period)}`);
  }
  if (/^A\d{2}$/.test(period)) return MONTH_ISO(year, 1); // A01 = năm
  throw new NormalizeError(`Kỳ BLS không nhận dạng được: ${JSON.stringify(period)}`);
}

/** Chuỗi `time` của Census (`2026`, `2026-05`, `2026-Q3`, hay đã là ISO date) -> ISO date đầu kỳ. */
export function censusTimeToIso(time: string): string {
  const t = time.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  const ym = /^(\d{4})-(\d{2})$/.exec(t);
  if (ym) return MONTH_ISO(ym[1]!, Number(ym[2]));
  const yq = /^(\d{4})-Q([1-4])$/.exec(t);
  if (yq) return MONTH_ISO(yq[1]!, (Number(yq[2]) - 1) * 3 + 1);
  throw new NormalizeError(`Mốc thời gian Census không nhận dạng được: ${JSON.stringify(time)}`);
}

/**
 * Xếp observations theo `period` tăng dần (BLS trả mới trước) VÀ chặn hai
 * observation cùng `period`.
 *
 * Chặn trùng period là điều kiện đủ để tất định: khi mọi period là duy nhất,
 * xếp theo period là một thứ tự TOÀN PHẦN, nên contentHash không phụ thuộc
 * thứ tự dòng mà nhà cung cấp trả. Trùng period lại là một nhập nhằng nghĩa
 * thật — BLS `annualaverage=true` trả M13 (bình quân năm) đụng M01, và một
 * truy vấn Census nhiều vùng địa lý cho nhiều dòng cùng `time` — nên nuốt nó
 * (gộp hay giữ thứ tự API) là đúng nhóm Z. Ném để lộ ra: một snapshot là MỘT
 * chuỗi, mỗi kỳ đúng một giá trị.
 */
function orderedUniqueObservations(observations: Observation[]): Observation[] {
  const ordered = [...observations].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0,
  );
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i]!.period === ordered[i - 1]!.period) {
      throw new NormalizeError(
        `Hai observation cùng period ${JSON.stringify(ordered[i]!.period)} — một chuỗi ` +
          `không được có hai giá trị cho một kỳ (BLS bình quân năm M13/Q05 đụng M01/Q01, ` +
          `hay truy vấn Census nhiều vùng). Chụp mỗi chuỗi/vùng riêng, hoặc bỏ dòng bình quân năm.`,
      );
    }
  }
  return ordered;
}

// ── Ba adapter ─────────────────────────────────────────────────────────────

/** Dạng thô của FRED `/fred/series/observations`. */
export interface FredRaw {
  observations: { date: string; value: string }[];
}

export function normalizeFred(
  raw: FredRaw,
  meta: { unit: string; frequency: SeriesSnapshot['frequency'] },
): Normalized {
  if (!raw || !Array.isArray(raw.observations)) {
    throw new NormalizeError('FRED: thiếu mảng `observations`.');
  }
  const observations = raw.observations.map((o) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) {
      throw new NormalizeError(`FRED: 'date' không phải ISO date: ${JSON.stringify(o.date)}`);
    }
    return { period: o.date, value: coerceValue(o.value) };
  });
  return { unit: meta.unit, frequency: meta.frequency, observations: orderedUniqueObservations(observations) };
}

/** Dạng thô của BLS `/publicAPI/v2/timeseries/data/`. */
export interface BlsRaw {
  Results: { series: { seriesID: string; data: { year: string; period: string; value: string }[] }[] };
}

export function normalizeBls(
  raw: BlsRaw,
  meta: { unit: string; frequency: SeriesSnapshot['frequency']; seriesId?: string },
): Normalized {
  const series = raw?.Results?.series;
  if (!Array.isArray(series) || series.length === 0) {
    throw new NormalizeError('BLS: thiếu `Results.series`.');
  }
  const chosen =
    meta.seriesId === undefined ? series[0]! : series.find((s) => s.seriesID === meta.seriesId);
  if (chosen === undefined) {
    throw new NormalizeError(`BLS: không thấy chuỗi ${JSON.stringify(meta.seriesId)} trong kết quả.`);
  }
  const observations = chosen.data.map((d) => ({
    period: blsPeriodToIso(d.year, d.period),
    value: coerceValue(d.value),
  }));
  return { unit: meta.unit, frequency: meta.frequency, observations: orderedUniqueObservations(observations) };
}

/**
 * Dạng thô của Census timeseries API: mảng-của-mảng, hàng đầu là tên cột.
 * Cần một cột `time`; cột giá trị mặc định là cột đầu (quy ước Census đặt biến
 * được hỏi ở đầu), đổi được bằng `meta.valueColumn`.
 */
export type CensusRaw = string[][];

export function normalizeCensus(
  raw: CensusRaw,
  meta: { unit: string; frequency: SeriesSnapshot['frequency']; valueColumn?: string },
): Normalized {
  if (!Array.isArray(raw) || raw.length < 1 || !Array.isArray(raw[0])) {
    throw new NormalizeError('Census: cần mảng-của-mảng với hàng tiêu đề.');
  }
  const header = raw[0]!;
  const timeIdx = header.indexOf('time');
  if (timeIdx < 0) {
    throw new NormalizeError('Census: thiếu cột `time` — không dựng được chuỗi thời gian.');
  }
  const valueColumn = meta.valueColumn ?? header[0]!;
  const valueIdx = header.indexOf(valueColumn);
  if (valueIdx < 0) {
    throw new NormalizeError(`Census: thiếu cột giá trị ${JSON.stringify(valueColumn)}.`);
  }
  const observations = raw.slice(1).map((row, i) => {
    const time = row[timeIdx];
    if (typeof time !== 'string') {
      throw new NormalizeError(`Census: dòng ${i + 1} thiếu ô 'time' — dòng ngắn hơn tiêu đề?`);
    }
    return { period: censusTimeToIso(time), value: coerceValue(row[valueIdx]) };
  });
  return { unit: meta.unit, frequency: meta.frequency, observations: orderedUniqueObservations(observations) };
}

// ── Dựng snapshot ────────────────────────────────────────────────────────

/** `<provider>:<seriesId>:<asOfDate>` — định danh ổn định, dẫn xuất không nhập tay. */
export function snapshotIdOf(provider: Provider, seriesId: string, asOfDate: string): string {
  return `${provider}:${seriesId}:${asOfDate}`;
}

/**
 * Băm nội dung dữ liệu. KHÔNG gồm `fetchedAt` (mốc chạy) và `snapshotId` (dẫn
 * xuất): hai lần chụp cùng phiên bản trên cùng dữ liệu phải trùng băm bất kể
 * chạy lúc nào. Dùng `stableHash` của kernel (khoá được sắp nên thứ tự không
 * đổi kết quả).
 */
export function snapshotContentHash(input: {
  provider: Provider;
  seriesId: string;
  asOfDate: string;
  unit: string;
  frequency: SeriesSnapshot['frequency'];
  observations: Observation[];
}): string {
  return stableHash({
    provider: input.provider,
    seriesId: input.seriesId,
    asOfDate: input.asOfDate,
    unit: input.unit,
    frequency: input.frequency,
    observations: input.observations,
  });
}

export interface BuildSnapshotInput {
  provider: Provider;
  seriesId: string;
  asOfDate: string;
  fetchedAt: string;
  provenance: 'api' | 'hand-built';
  source: SnapshotSource;
  unit: string;
  frequency: SeriesSnapshot['frequency'];
  observations: Observation[];
}

/**
 * Dựng một snapshot hợp contract từ phần đã chuẩn hoá. Băm nội dung, dẫn xuất
 * `snapshotId`, rồi VALIDATE lại toàn bộ với schema và ném nếu sai — không đẩy
 * một object lệch contract ra cho bên đọc.
 */
export function buildSnapshot(input: BuildSnapshotInput): SeriesSnapshot {
  const contentHash = snapshotContentHash(input);
  const snapshot: SeriesSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshotId: snapshotIdOf(input.provider, input.seriesId, input.asOfDate),
    provider: input.provider,
    seriesId: input.seriesId,
    asOfDate: input.asOfDate,
    fetchedAt: input.fetchedAt,
    provenance: input.provenance,
    source: input.source,
    unit: input.unit,
    frequency: input.frequency,
    observations: input.observations,
    contentHash,
  };
  const problems = snapshotProblems(snapshot);
  if (problems.length > 0) {
    throw new NormalizeError(`Snapshot dựng ra không hợp contract:\n${problems.join('\n')}`);
  }
  return snapshot;
}

export function validateSnapshot(value: unknown): ValidationResult {
  return validate(value, snapshotSchema);
}

/** Danh sách vấn đề của một snapshot, rỗng là ok. Gồm cả kiểm băm khớp nội dung. */
export function snapshotProblems(value: unknown): string[] {
  const result = validateSnapshot(value);
  const problems = result.errors.map((e) => `${e.path}: ${e.message}`);
  if (!result.valid) return problems;

  const snapshot = value as SeriesSnapshot;
  const expected = snapshotContentHash(snapshot);
  if (snapshot.contentHash !== expected) {
    problems.push(
      `contentHash không khớp nội dung: có ${snapshot.contentHash}, tính lại ra ${expected}.`,
    );
  }
  const expectedId = snapshotIdOf(snapshot.provider, snapshot.seriesId, snapshot.asOfDate);
  if (snapshot.snapshotId !== expectedId) {
    problems.push(`snapshotId không khớp: có ${snapshot.snapshotId}, dẫn xuất ra ${expectedId}.`);
  }
  return problems;
}

/**
 * Hai snapshot cùng phiên bản có cùng dữ liệu không — phép kiểm "chạy lại cùng
 * asOfDate cho ra cùng dữ liệu". So bằng `contentHash`, nên khác `fetchedAt`
 * không tính là khác dữ liệu.
 */
export function sameData(a: SeriesSnapshot, b: SeriesSnapshot): boolean {
  return a.contentHash === b.contentHash;
}

// ── Điều phối gọi (secret gate + transport tiêm vào) ───────────────────────

/** Một lần gọi API của nhà cung cấp: nhận khoá đã có, trả dữ liệu thô. */
export type Transport = (args: {
  provider: Provider;
  seriesId: string;
  asOfDate: string;
  apiKey: string;
}) => Promise<unknown> | unknown;

const notWiredTransport: Transport = ({ provider }) => {
  throw new LiveFetchNotWiredError(provider);
};

export interface FetchSnapshotParams {
  seriesId: string;
  asOfDate: string;
  source: SnapshotSource;
  meta: {
    unit: string;
    frequency: SeriesSnapshot['frequency'];
    seriesId?: string;
    valueColumn?: string;
  };
  env?: NodeJS.ProcessEnv;
  transport?: Transport;
  /** Mốc `fetchedAt`; tiêm vào để test tất định. Mặc định lấy đồng hồ hệ thống. */
  now?: () => string;
}

function normalizeByProvider(provider: Provider, raw: unknown, meta: FetchSnapshotParams['meta']): Normalized {
  switch (provider) {
    case 'fred':
      return normalizeFred(raw as FredRaw, meta);
    case 'bls':
      return normalizeBls(raw as BlsRaw, meta);
    case 'census':
      return normalizeCensus(raw as CensusRaw, meta);
  }
}

/**
 * Điều phối một lần chụp: **cổng secret trước tiên** (`requireSecret` ném nếu
 * thiếu), rồi gọi `transport`, chuẩn hoá, dựng snapshot. `transport` mặc định
 * ném `LiveFetchNotWiredError` (Đợt 0). `provenance` là `'api'` vì đường này
 * chỉ chạy khi đã có khoá và transport thật.
 */
export async function fetchSnapshot(
  provider: Provider,
  params: FetchSnapshotParams,
): Promise<SeriesSnapshot> {
  const apiKey = requireSecret(provider, params.env);
  const transport = params.transport ?? notWiredTransport;
  const raw = await transport({ provider, seriesId: params.seriesId, asOfDate: params.asOfDate, apiKey });
  const normalized = normalizeByProvider(provider, raw, params.meta);
  const now = params.now ?? (() => new Date().toISOString());
  return buildSnapshot({
    provider,
    seriesId: params.seriesId,
    asOfDate: params.asOfDate,
    fetchedAt: now(),
    provenance: 'api',
    source: params.source,
    unit: normalized.unit,
    frequency: normalized.frequency,
    observations: normalized.observations,
  });
}
