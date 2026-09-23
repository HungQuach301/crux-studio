/**
 * Runner xác định cho mô hình định lượng (mục backlog `topic/T-005`, spec
 * WP-012 mục 1-2). WP này xây **công cụ**; nội dung tám mô hình đầu tiên do
 * `topic/T-006` tạo — file này không đăng ký công thức thật nào.
 *
 * `formula` trong `model.schema.json` là một KHOÁ tra vào registry hàm đã
 * đăng ký ở bên gọi (`FormulaRegistry`), KHÔNG phải một biểu thức được
 * `eval`: cho agent ghi một chuỗi biểu thức tuỳ ý rồi thực thi nó là một bề
 * mặt chạy mã không kiểm soát được, và runner phải xác định tuyệt đối — một
 * `eval` phụ thuộc cách trình duyệt/engine JS diễn giải dấu phẩy động không
 * bảo đảm điều đó qua các phiên bản Node.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`. Contract của mô hình
 * (mục `kernel/K-002`) sống ở `kernel/contracts/model.schema.json`, không
 * còn một bản riêng dưới `workshops/topic/contracts/` — một nguồn duy nhất,
 * không hai file trôi khỏi nhau.
 */

import { modelSchema, validate, type ValidationResult } from '@crux/kernel';

export { modelSchema };

export const MODEL_SCHEMA_VERSION = 0;

export type VerificationMethod =
  | 'hand-worked-case'
  | 'published-benchmark'
  | 'second-implementation'
  | 'llm-assumption-check';

export interface ModelParameter {
  name: string;
  unit: string;
  validRange: readonly [number, number];
  defaultValue: number;
  source: string;
  geoVarying?: boolean;
}

export interface ModelOutput {
  name: string;
  unit: string;
  interpretation: string;
}

export interface ModelVerificationTier {
  method: VerificationMethod;
  required: boolean;
  pass: boolean | null;
  detail: string;
  tolerancePct?: number;
  evidenceRef?: string;
  checkedAt?: string;
  benchmarkUrl?: string;
}

/**
 * `status` khai đủ ba giá trị của contract (kể cả `'verified'`, vì đây là dữ
 * liệu đọc từ file, có thể đã mang giá trị đó). Điều D-C02 điểm (c) khoá
 * KHÔNG nằm ở kiểu này — nó nằm ở kiểu trả về của `computeVerification`
 * trong `model-verify.ts`, hàm DUY NHẤT tính trạng thái từ bằng chứng.
 */
export interface ModelVerification {
  status: 'pending' | 'verified' | 'failed';
  verifiedAt?: string;
  approvedIssueUrl?: string;
  tiers: ModelVerificationTier[];
}

export interface ModelDefinition {
  schemaVersion: number;
  modelId: string;
  version: string;
  title: string;
  question: string;
  assumptions: string[];
  parameters: ModelParameter[];
  formula: string;
  outputs: ModelOutput[];
  verification: ModelVerification;
  publishedSheetUrl?: string;
  usedByEpisodes?: string[];
}

export function validateModel(value: unknown): ValidationResult {
  return validate(value, modelSchema);
}

/** Danh sách vấn đề của một model theo contract, rỗng là ok. */
export function modelProblems(value: unknown): string[] {
  return validateModel(value).errors.map((e) => `${e.path}: ${e.message}`);
}

/** Một công thức đã đăng ký: nhận tham số đã giải, trả các output bằng tên. */
export type FormulaFn = (params: Readonly<Record<string, number>>) => Record<string, number>;

/** Registry tra `formula` -> hàm. T-005 không đăng ký công thức nội dung nào — đó là việc của T-006. */
export type FormulaRegistry = Readonly<Record<string, FormulaFn>>;

export class UnknownFormulaError extends Error {
  readonly formula: string;
  constructor(formula: string) {
    super(`Không tìm thấy công thức đã đăng ký cho khoá '${formula}'.`);
    this.name = 'UnknownFormulaError';
    this.formula = formula;
  }
}

export class MissingParamError extends Error {
  readonly param: string;
  constructor(name: string) {
    super(`Thiếu tham số '${name}' và không đọc được số hữu hạn từ override hay defaultValue.`);
    this.name = 'MissingParamError';
    this.param = name;
  }
}

export class ParamOutOfRangeError extends Error {
  readonly param: string;
  readonly value: number;
  readonly validRange: readonly [number, number];
  constructor(name: string, value: number, validRange: readonly [number, number]) {
    super(
      `Tham số '${name}' = ${value} ngoài khoảng hợp lệ [${validRange[0]}, ${validRange[1]}] — ` +
        `không kẹp về biên (WP-012 mục 5, kiểm âm 1).`,
    );
    this.name = 'ParamOutOfRangeError';
    this.param = name;
    this.value = value;
    this.validRange = validRange;
  }
}

export class NonFiniteOutputError extends Error {
  readonly output: string;
  constructor(name: string, value: unknown) {
    super(`Output '${name}' không phải số hữu hạn (NaN/Infinity đều là lỗi tường minh, không phải kết quả): ${JSON.stringify(value)}.`);
    this.name = 'NonFiniteOutputError';
    this.output = name;
  }
}

/**
 * Giải tham số đầu vào: `overrides[name]` nếu có, không thì `defaultValue`.
 * Ném nếu giá trị không phải số hữu hạn, ném nếu ngoài `validRange` — KHÔNG
 * BAO GIỜ kẹp về biên (mục 5, kiểm âm 1 của WP-012).
 */
export function resolveParams(
  model: Pick<ModelDefinition, 'parameters'>,
  overrides: Readonly<Record<string, number>> = {},
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const param of model.parameters) {
    const raw = Object.prototype.hasOwnProperty.call(overrides, param.name)
      ? overrides[param.name]
      : param.defaultValue;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      throw new MissingParamError(param.name);
    }
    const [min, max] = param.validRange;
    if (raw < min || raw > max) {
      throw new ParamOutOfRangeError(param.name, raw, param.validRange);
    }
    resolved[param.name] = raw;
  }
  return resolved;
}

/**
 * Chạy một mô hình: giải tham số, tra công thức trong `registry`, gọi, rồi
 * kiểm MỌI output khai trong contract có mặt và là số hữu hạn.
 *
 * Xác định tuyệt đối theo đúng nghĩa tiêu chí xong thứ nhất của `T-005`:
 * không đọc đồng hồ hệ thống, không random, không gọi mạng ở tầng runner —
 * việc đó phụ thuộc `fn` được tiêm vào có giữ đúng tính chất này không, và
 * `fn` là nội dung của T-006, không phải của file này.
 */
export function runModel(
  model: ModelDefinition,
  registry: FormulaRegistry,
  overrides: Readonly<Record<string, number>> = {},
): Record<string, number> {
  const params = resolveParams(model, overrides);
  const fn = registry[model.formula];
  if (fn === undefined) throw new UnknownFormulaError(model.formula);
  const result = fn(params);
  for (const output of model.outputs) {
    const value = result[output.name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new NonFiniteOutputError(output.name, value);
    }
  }
  return result;
}
