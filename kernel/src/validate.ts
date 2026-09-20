/**
 * Validator JSON Schema tối thiểu, không phụ thuộc gói ngoài.
 *
 * Vì sao tự viết: `kernel` phải chạy được ở mọi nơi, kể cả khi CI không cài
 * được phụ thuộc. Bộ từ khoá dưới đây là đúng những gì contract v0 dùng;
 * `pnpm contracts` chặn schema nào dùng từ khoá ngoài danh sách, nên không
 * có chuyện một schema âm thầm không được kiểm.
 */

export const SUPPORTED_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$ref',
  'title',
  'description',
  'definitions',
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'pattern',
  'format',
]);

export type JsonSchema = Record<string, unknown>;

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'object') return actual === 'object';
  return actual === expected;
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema {
  if (!ref.startsWith('#/')) {
    throw new Error(`Chỉ hỗ trợ $ref nội bộ dạng "#/definitions/x", gặp: ${ref}`);
  }
  let node: unknown = root;
  for (const segment of ref.slice(2).split('/')) {
    if (typeof node !== 'object' || node === null) {
      throw new Error(`$ref không giải được: ${ref}`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== 'object' || node === null) {
    throw new Error(`$ref không giải được: ${ref}`);
  }
  return node as JsonSchema;
}

function walk(
  value: unknown,
  schema: JsonSchema,
  root: JsonSchema,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof schema['$ref'] === 'string') {
    walk(value, resolveRef(schema['$ref'], root), root, path, errors);
    return;
  }

  const expectedType = schema['type'];
  if (typeof expectedType === 'string') {
    if (!matchesType(value, expectedType)) {
      errors.push({ path, message: `phải là ${expectedType}, nhận ${typeOf(value)}` });
      return;
    }
  } else if (Array.isArray(expectedType)) {
    if (!expectedType.some((t) => matchesType(value, String(t)))) {
      errors.push({
        path,
        message: `phải là một trong [${expectedType.join(', ')}], nhận ${typeOf(value)}`,
      });
      return;
    }
  }

  if ('const' in schema && JSON.stringify(value) !== JSON.stringify(schema['const'])) {
    errors.push({ path, message: `phải đúng bằng ${JSON.stringify(schema['const'])}` });
  }

  const enumValues = schema['enum'];
  if (Array.isArray(enumValues)) {
    const hit = enumValues.some((v) => JSON.stringify(v) === JSON.stringify(value));
    if (!hit) {
      errors.push({ path, message: `phải thuộc [${enumValues.map((v) => JSON.stringify(v)).join(', ')}]` });
    }
  }

  if (typeof value === 'number') {
    const min = schema['minimum'];
    const max = schema['maximum'];
    if (typeof min === 'number' && value < min) {
      errors.push({ path, message: `phải ≥ ${min}, nhận ${value}` });
    }
    if (typeof max === 'number' && value > max) {
      errors.push({ path, message: `phải ≤ ${max}, nhận ${value}` });
    }
  }

  if (typeof value === 'string') {
    const minLength = schema['minLength'];
    const maxLength = schema['maxLength'];
    if (typeof minLength === 'number' && value.length < minLength) {
      errors.push({ path, message: `phải dài ≥ ${minLength} ký tự, nhận ${value.length}` });
    }
    if (typeof maxLength === 'number' && value.length > maxLength) {
      errors.push({ path, message: `phải dài ≤ ${maxLength} ký tự, nhận ${value.length}` });
    }
    const pattern = schema['pattern'];
    if (typeof pattern === 'string' && !new RegExp(pattern).test(value)) {
      errors.push({ path, message: `không khớp mẫu ${pattern}` });
    }
    if (schema['format'] === 'date-time' && !DATE_TIME.test(value)) {
      errors.push({ path, message: 'phải là thời điểm ISO-8601 có múi giờ' });
    }
    if (schema['format'] === 'uri' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      errors.push({ path, message: 'phải là URI tuyệt đối' });
    }
  }

  if (Array.isArray(value)) {
    const minItems = schema['minItems'];
    const maxItems = schema['maxItems'];
    if (typeof minItems === 'number' && value.length < minItems) {
      errors.push({ path, message: `phải có ≥ ${minItems} phần tử, nhận ${value.length}` });
    }
    if (typeof maxItems === 'number' && value.length > maxItems) {
      errors.push({ path, message: `phải có ≤ ${maxItems} phần tử, nhận ${value.length}` });
    }
    const items = schema['items'];
    if (items && typeof items === 'object') {
      value.forEach((item, index) => {
        walk(item, items as JsonSchema, root, `${path}[${index}]`, errors);
      });
    }
  }

  if (typeOf(value) === 'object') {
    const object = value as Record<string, unknown>;
    const properties = (schema['properties'] ?? {}) as Record<string, JsonSchema>;

    const required = schema['required'];
    if (Array.isArray(required)) {
      for (const key of required) {
        if (!(String(key) in object)) {
          errors.push({ path: `${path}.${String(key)}`, message: 'thiếu trường bắt buộc' });
        }
      }
    }

    if (schema['additionalProperties'] === false) {
      for (const key of Object.keys(object)) {
        if (!(key in properties)) {
          errors.push({ path: `${path}.${key}`, message: 'trường không được khai trong contract' });
        }
      }
    }

    for (const [key, sub] of Object.entries(properties)) {
      if (key in object) {
        walk(object[key], sub, root, `${path}.${key}`, errors);
      }
    }
  }
}

/** Validate `value` theo `schema`. Không ném lỗi; trả về danh sách lỗi. */
export function validate(value: unknown, schema: JsonSchema): ValidationResult {
  const errors: ValidationError[] = [];
  walk(value, schema, schema, '$', errors);
  return { valid: errors.length === 0, errors };
}

/** Validate và ném lỗi kèm ngữ cảnh. Dùng ở ranh giới giữa các xưởng. */
export function assertValid(value: unknown, schema: JsonSchema, label: string): void {
  const result = validate(value, schema);
  if (!result.valid) {
    const lines = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n');
    throw new Error(`${label} không hợp lệ theo contract:\n${lines}`);
  }
}

/** Liệt kê các từ khoá schema dùng trong `schema` mà validator chưa hỗ trợ. */
export function unsupportedKeywords(schema: unknown, seen = new Set<string>()): string[] {
  if (Array.isArray(schema)) {
    for (const item of schema) unsupportedKeywords(item, seen);
    return [...seen];
  }
  if (typeof schema !== 'object' || schema === null) return [...seen];
  for (const [key, sub] of Object.entries(schema as Record<string, unknown>)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      seen.add(key);
      continue;
    }
    if (key === 'properties' || key === 'definitions') {
      for (const child of Object.values(sub as Record<string, unknown>)) {
        unsupportedKeywords(child, seen);
      }
    } else if (key === 'items' || key === 'additionalProperties') {
      unsupportedKeywords(sub, seen);
    }
  }
  return [...seen];
}
