import { createHash } from 'node:crypto';

/** Băm ổn định một giá trị JSON: khoá được sắp xếp nên thứ tự không đổi kết quả. */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/**
 * `inputsHash` của phong bì. Đây là thứ cho phép chạy lại một xưởng độc lập:
 * đầu vào không đổi thì xưởng dùng lại kết quả cũ (CHARTER 5.2).
 */
export function inputsHashOf(inputs: readonly { kind: string; path: string; hash: string }[]): string {
  return stableHash(
    [...inputs]
      .map((i) => ({ kind: i.kind, path: i.path, hash: i.hash }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  );
}
