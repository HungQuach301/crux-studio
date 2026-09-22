/**
 * Sensitivity Pass (mục backlog `topic/T-007`, spec WP-013, `14-quantitative-core.md`
 * mục 3): cho một mô hình đã có trong `data/models/`, quét toàn bộ khoảng
 * giá trị hợp lệ của một hoặc nhiều tham số — giữ các tham số còn lại ở
 * giá trị nền (`overrides`, mặc định `defaultValue`) — và tìm điểm đảo
 * chiều của một "biến kết luận" (`conclusionOutput`): dấu của output đó
 * đổi từ dương sang âm hay ngược lại.
 *
 * **Tính toán thuần** (WP-013 mục 5): không đọc đồng hồ hệ thống, không
 * random, không gọi mạng. `runAt` do bên gọi truyền vào — cùng lý do
 * `runModel` của `model-runner.ts` không tự đọc đồng hồ: hai lần chạy cùng
 * đầu vào phải ra cùng một JSON (tiêu chí xong thứ hai, WP-013 mục 6).
 *
 * **Quét từng tham số một, không quét lưới N chiều.** Giữ các tham số khác
 * ở giá trị nền khi quét một tham số — đúng hình dạng của
 * `sensitivity.v0.schema.json` (`parameters` là một mảng phẳng, mỗi phần
 * tử một tham số, không phải một lưới tổ hợp). "Số tổ hợp vượt 1 triệu"
 * (WP-013 mục 5b) vì vậy được đọc là số điểm quét của MỘT tham số, không
 * phải tích của nhiều tham số.
 *
 * Nhận thẳng `ModelDefinition` đã nạp, không tự `loadModel` — cùng hình
 * dạng với `runModel` của `model-runner.ts` (nhận model, không nhận id).
 * Bên gọi thật (CLI `run-sensitivity`, hay chính `models.ts`) tự
 * `loadModel(modelId)` trước khi gọi vào đây; cách này cũng cho phép test
 * bằng model tổng hợp mà không cần một file `data/models/*.json` thật.
 *
 * Bất biến I3: file này chỉ import trong xưởng (`model-runner.ts`) và
 * `@crux/kernel`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate, type JsonSchema, type ValidationResult } from '@crux/kernel';
import {
  resolveParams,
  NonFiniteOutputError,
  UnknownFormulaError,
  type FormulaRegistry,
  type ModelDefinition,
  type ModelParameter,
} from './model-runner.ts';

const CONTRACTS_DIR = fileURLToPath(new URL('../contracts/', import.meta.url));

function load(name: string): JsonSchema {
  return JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as JsonSchema;
}

export const sensitivitySchema: JsonSchema = load('sensitivity.v0.schema.json');

export const SENSITIVITY_SCHEMA_VERSION = 0;

/** Số điểm quét tối đa cho MỘT tham số (WP-013 mục 5b). Vượt ngưỡng thì dừng, không tự "giảm bước quét" (bước nhỏ hơn làm số điểm TĂNG). */
export const MAX_SCAN_POINTS = 1_000_000;

export interface ScanRequest {
  name: string;
  /** Bước quét. Bắt buộc — WP-013 mục 5b tính "số tổ hợp" trên chính bước này, nên không có mặc định ngầm. */
  step: number;
  /** Khoảng quét, mặc định là `validRange` của chính tham số trong model. Truyền vào thì phải nằm trong `validRange` — không được quét ra ngoài khoảng hợp lệ của mô hình. */
  range?: readonly [number, number];
}

export interface SensitivityPassOptions {
  /** Tên output của mô hình dùng làm "biến kết luận" — dấu của nó là thứ Sensitivity Pass theo dõi điểm đảo chiều. */
  conclusionOutput: string;
  /** Tham số cần quét, kèm khoảng và bước (S05b: "Input: modelId, tham số cần quét kèm khoảng và bước, biến kết luận"). */
  parameters: readonly ScanRequest[];
  /** Caller truyền vào — không đọc đồng hồ hệ thống bên trong engine. */
  runAt: string;
  /** Giá trị nền cho các tham số KHÔNG nằm trong `parameters`. Mặc định `defaultValue` của từng tham số. */
  overrides?: Readonly<Record<string, number>>;
}

export interface SensitivityFlipPoint {
  parameter: string;
  value: number;
  unit?: string;
  conclusionBefore: string;
  conclusionAfter: string;
}

export interface SensitivityParameterResult {
  name: string;
  scannedRange: readonly [number, number];
  step: number;
  classification: 'stable' | 'sensitive' | 'flips';
  geoVarying?: boolean;
}

export interface SensitivityResult {
  schemaVersion: number;
  modelId: string;
  modelVersion: string;
  runAt: string;
  conclusionOutput: string;
  parameters: SensitivityParameterResult[];
  flipPoints: SensitivityFlipPoint[];
  stableConclusion?: string;
}

export class UnknownScanParameterError extends Error {
  readonly parameter: string;
  constructor(name: string) {
    super(`Mô hình không khai tham số '${name}' — không có validRange nào để quét (WP-013 mục 6, kiểm âm 3).`);
    this.name = 'UnknownScanParameterError';
    this.parameter = name;
  }
}

export class MissingGeoVaryingParameterError extends Error {
  readonly parameter: string;
  constructor(name: string) {
    super(`Tham số '${name}' khai geoVarying: true, nhưng không nằm trong danh sách quét — WP-013 mục 5 bắt buộc quét mọi tham số geoVarying.`);
    this.name = 'MissingGeoVaryingParameterError';
    this.parameter = name;
  }
}

export class ScanRangeOutOfBoundsError extends Error {
  readonly parameter: string;
  readonly range: readonly [number, number];
  readonly validRange: readonly [number, number];
  constructor(name: string, range: readonly [number, number], validRange: readonly [number, number]) {
    super(
      `Khoảng quét [${range[0]}, ${range[1]}] của '${name}' nằm ngoài validRange [${validRange[0]}, ${validRange[1]}] của mô hình.`,
    );
    this.name = 'ScanRangeOutOfBoundsError';
    this.parameter = name;
    this.range = range;
    this.validRange = validRange;
  }
}

export class TooManyScanPointsError extends Error {
  readonly parameter: string;
  readonly points: number;
  constructor(name: string, points: number) {
    super(
      `Tham số '${name}' quét ra ${points} điểm, vượt trần ${MAX_SCAN_POINTS} (WP-013 mục 5b). ` +
        `Tăng 'step' để giảm số điểm, hoặc quét thích nghi làm mịn quanh điểm đổi dấu — không giảm bước quét.`,
    );
    this.name = 'TooManyScanPointsError';
    this.parameter = name;
    this.points = points;
  }
}

export class UnknownConclusionOutputError extends Error {
  readonly output: string;
  constructor(name: string) {
    super(`Mô hình không khai output '${name}' — không dùng được làm biến kết luận.`);
    this.name = 'UnknownConclusionOutputError';
    this.output = name;
  }
}

function findParameter(model: ModelDefinition, name: string): ModelParameter {
  const param = model.parameters.find((p) => p.name === name);
  if (param === undefined) throw new UnknownScanParameterError(name);
  return param;
}

/**
 * Số điểm quét THẬT từ `min` tới `max` (đóng cả hai đầu) bằng bước `step`,
 * kể cả điểm `max` được chèn thêm khi `step` không chia hết khoảng — MỘT
 * nguồn duy nhất cho cả cổng chặn `TooManyScanPointsError` lẫn `scanPoints`,
 * để cổng chặn không bao giờ đếm thiếu so với mảng thật sự được dựng.
 */
function actualPointCount(min: number, max: number, step: number): number {
  const n = Math.floor((max - min) / step) + 1;
  const last = min + (n - 1) * step;
  return last === max ? n : n + 1;
}

/** Danh sách giá trị quét từ `min` tới `max`, bước `step`, LUÔN kết ở đúng `max` dù `step` không chia hết khoảng. */
function scanPoints(min: number, max: number, step: number): number[] {
  const n = actualPointCount(min, max, step);
  const points: number[] = [];
  for (let i = 0; i < n; i++) points.push(i === n - 1 ? max : min + i * step);
  return points;
}

function signOf(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

/** `0` KHÔNG phải "dương" — dùng nguyên văn ba trạng thái, không suy tròn `>= 0` thành "dương". */
function describeSign(value: number): 'dương' | 'âm' | 'bằng 0' {
  const sign = signOf(value);
  if (sign > 0) return 'dương';
  if (sign < 0) return 'âm';
  return 'bằng 0';
}

/**
 * Nhị phân tìm điểm `conclusionOutput` đổi dấu giữa `(pa, va)` và `(pb, vb)`
 * (`va`, `vb` đã biết KHÁC dấu). 80 vòng lặp: nhiều hơn hẳn 52 bit định trị
 * của số double, nên hội tụ hết độ chính xác biểu diễn được thay vì dừng ở
 * một ngưỡng tuyệt đối — khoảng tham số ở đây trải từ dưới 1 tới 5×10^7
 * (`loanAmountUsd`), một epsilon tuyệt đối cố định sẽ sai lệch quá nhiều bậc
 * giữa hai đầu đó.
 */
function bisectFlip(
  evaluate: (paramValue: number) => number,
  pa: number,
  va: number,
  pb: number,
  vb: number,
): number {
  let lo = pa;
  let hi = pb;
  let loVal = va;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    const midVal = evaluate(mid);
    if (midVal === 0) return mid;
    if (signOf(midVal) === signOf(loVal)) {
      lo = mid;
      loVal = midVal;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function runSensitivityPass(
  model: ModelDefinition,
  registry: FormulaRegistry,
  options: SensitivityPassOptions,
): SensitivityResult {
  if (!model.outputs.some((o) => o.name === options.conclusionOutput)) {
    throw new UnknownConclusionOutputError(options.conclusionOutput);
  }
  const fn = registry[model.formula];
  if (fn === undefined) throw new UnknownFormulaError(model.formula);

  const geoVaryingNames = model.parameters.filter((p) => p.geoVarying === true).map((p) => p.name);
  const requestedNames = new Set(options.parameters.map((p) => p.name));
  for (const geoName of geoVaryingNames) {
    if (!requestedNames.has(geoName)) throw new MissingGeoVaryingParameterError(geoName);
  }

  const baseline = resolveParams(model, options.overrides ?? {});

  const parameterResults: SensitivityParameterResult[] = [];
  const flipPoints: SensitivityFlipPoint[] = [];
  /** Dấu của `conclusionOutput` tại điểm đầu khoảng quét của mỗi tham số — dùng để dựng `stableConclusion` khi không có điểm đảo chiều nào, không cần chạy lại mô hình lần thứ hai. */
  const firstPointSigns: Array<-1 | 0 | 1> = [];

  for (const request of options.parameters) {
    const param = findParameter(model, request.name);
    if (request.step <= 0) {
      throw new RangeError(`Bước quét của '${request.name}' phải dương, nhận được ${request.step}.`);
    }
    const range = request.range ?? param.validRange;
    if (range[0] < param.validRange[0] || range[1] > param.validRange[1] || range[0] >= range[1]) {
      throw new ScanRangeOutOfBoundsError(request.name, range, param.validRange);
    }

    const points = actualPointCount(range[0], range[1], request.step);
    if (points > MAX_SCAN_POINTS) throw new TooManyScanPointsError(request.name, points);

    // Cố ý KHÔNG gọi `runModel`: nó đòi MỌI output khai trong contract đều
    // hữu hạn, nhưng một output KHÁC `conclusionOutput` (ví dụ tỷ số chia
    // cho một đại lượng vừa quét qua 0) có thể hợp lệ là vô định đúng tại
    // điểm đảo chiều mà Sensitivity Pass đang tìm — `breakEvenMonths` của
    // M-002 là ví dụ thật: nó là `pointsCostUsd / monthlySavingsUsd`, và nổ
    // thành `Infinity` đúng tại điểm `monthlySavingsUsd = 0`. Chỉ tính và
    // kiểm hữu hạn `conclusionOutput`, không kiểm các output còn lại.
    const evaluate = (value: number): number => {
      const params = resolveParams(model, { ...baseline, [request.name]: value });
      const outputs = fn(params);
      const conclusionValue = outputs[options.conclusionOutput];
      if (typeof conclusionValue !== 'number' || !Number.isFinite(conclusionValue)) {
        throw new NonFiniteOutputError(options.conclusionOutput, conclusionValue);
      }
      return conclusionValue;
    };

    const sweep = scanPoints(range[0], range[1], request.step);
    const values = sweep.map(evaluate);

    let classification: 'stable' | 'sensitive' | 'flips' = 'stable';
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== values[0]) {
        classification = 'sensitive';
        break;
      }
    }

    for (let i = 0; i + 1 < sweep.length; i++) {
      const pa = sweep[i]!;
      const va = values[i]!;
      const pb = sweep[i + 1]!;
      const vb = values[i + 1]!;
      // `va === 0` ở i > 0 nghĩa là cặp TRƯỚC đó (kết thúc đúng ở điểm này)
      // đã ghi nhận flip rồi — bỏ qua để không đếm hai lần cùng một điểm đảo
      // chiều khi nó rơi đúng vào một điểm lưới (ví dụ M-002 tại
      // rateWithPointsPct = baseRatePct, monthlySavingsUsd = 0 chẵn).
      //
      // Ở i === 0 (điểm ĐẦU khoảng quét bằng 0 chẵn), không có cặp trước để
      // đã ghi nhận — nhánh này bỏ qua nó có chủ đích, không phải sót: biên
      // dưới của khoảng quét không có "trước" trong miền đang quét để so, nên
      // không tính là một điểm đảo chiều. Tham số đó vẫn được phân loại đúng
      // ('sensitive' nếu vb khác 0, xem cụm gán `classification` phía trên).
      // Xem test "điểm đầu khoảng quét bằng 0 chẵn" trong sensitivity.test.ts.
      if (va === 0) continue;
      if (signOf(va) === signOf(vb)) continue;

      classification = 'flips';
      const flipValue = vb === 0 ? pb : bisectFlip(evaluate, pa, va, pb, vb);
      flipPoints.push({
        parameter: request.name,
        value: flipValue,
        unit: param.unit,
        conclusionBefore: `${options.conclusionOutput} ${describeSign(va)} (${formatNumber(va)} tại ${request.name}=${formatNumber(pa)})`,
        conclusionAfter: `${options.conclusionOutput} ${describeSign(vb)} (${formatNumber(vb)} tại ${request.name}=${formatNumber(pb)})`,
      });
    }

    parameterResults.push({
      name: request.name,
      scannedRange: [range[0], range[1]],
      step: request.step,
      classification,
      ...(param.geoVarying === true ? { geoVarying: true } : {}),
    });
    firstPointSigns.push(signOf(values[0]!));
  }

  const result: SensitivityResult = {
    schemaVersion: SENSITIVITY_SCHEMA_VERSION,
    modelId: model.modelId,
    modelVersion: model.version,
    runAt: options.runAt,
    conclusionOutput: options.conclusionOutput,
    parameters: parameterResults,
    flipPoints,
  };

  if (flipPoints.length === 0) {
    const signs = new Set(firstPointSigns);
    const sign = signs.size === 1 ? [...signs][0]! : undefined;
    result.stableConclusion =
      sign === undefined
        ? `Không tìm thấy điểm đảo chiều nào trên các tham số đã quét (${parameterResults.map((p) => p.name).join(', ')}), nhưng dấu của '${options.conclusionOutput}' không đồng nhất giữa các tham số — xem từng mục 'parameters' để biết chi tiết.`
        : `'${options.conclusionOutput}' giữ nguyên dấu (${sign > 0 ? 'dương' : sign < 0 ? 'âm' : 'bằng 0'}) trên toàn bộ khoảng đã quét của: ${parameterResults.map((p) => `${p.name} ∈ [${formatNumber(p.scannedRange[0])}, ${formatNumber(p.scannedRange[1])}]`).join('; ')}.`;
  }

  return result;
}

export function validateSensitivity(value: unknown): ValidationResult {
  return validate(value, sensitivitySchema);
}

/** Danh sách vấn đề theo contract, cộng luật flipPoints rỗng thì stableConclusion bắt buộc (không kiểm được ở tầng schema — if/then). */
export function sensitivityProblems(value: unknown): string[] {
  const problems = validateSensitivity(value).errors.map((e) => `${e.path}: ${e.message}`);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const flipPoints = record['flipPoints'];
    if (Array.isArray(flipPoints) && flipPoints.length === 0 && typeof record['stableConclusion'] !== 'string') {
      problems.push('stableConclusion: bắt buộc khi flipPoints rỗng (WP-013: "không có điểm đảo chiều cũng là một kết quả hợp lệ").');
    }
  }
  return problems;
}
