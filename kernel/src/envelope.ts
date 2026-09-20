/**
 * Phong bì artifact — ranh giới bất biến, chốt ở Đợt 0 (CHARTER 5.2).
 * Đổi file này là quyết định `irreversible` (CHARTER 2.3).
 *
 * Phần `payload` do contract v0 của từng xưởng định nghĩa và để LỎNG:
 * chỉ trường bắt buộc tối thiểu, cho phép thêm trường. Siết lại sau tập
 * thật đầu tiên bằng cách tăng `schemaVersion`.
 */

/** Sáu xưởng của nhà máy (CHARTER 5.1). Thứ tự ở đây là thứ tự chạy một tập. */
export const WORKSHOPS = [
  'topic',
  'editorial',
  'visual',
  'audio',
  'assembly',
  'release',
] as const;

export type WorkshopName = (typeof WORKSHOPS)[number];

/** Mười làn: sáu xưởng cộng bốn làn nền (CHARTER mục 7). */
export const LANES = [
  ...WORKSHOPS,
  'kernel',
  'platform',
  'verify',
  'integration',
] as const;

export type LaneName = (typeof LANES)[number];

/** Cờ `impl` của từng xưởng (CHARTER 5.4). */
export type Impl = 'stub' | 'v1';

export type ArtifactStatus = 'ok' | 'failed' | 'skipped';

/** Con trỏ tới một artifact đầu vào. `hash` cho phép dựng lại `inputsHash`. */
export interface ArtifactRef {
  kind: string;
  path: string;
  hash: string;
}

export interface Producer {
  workshop: WorkshopName;
  version: string;
  impl: Impl;
}

/**
 * Phong bì. Mọi artifact văn bản của nhà máy mang đúng các trường này.
 * `inputsHash` cho phép chạy lại một xưởng độc lập: đầu vào không đổi thì
 * xưởng dùng lại kết quả cũ (CHARTER 5.2).
 */
export interface Envelope<P = unknown> {
  schemaVersion: string;
  kind: string;
  producer: Producer;
  episodeId: string;
  channel: string;
  genre: string;
  locale: string;
  inputsHash: string;
  inputs: ArtifactRef[];
  createdAt: string;
  costUsd: number;
  status: ArtifactStatus;
  payload: P;
}

/** Phiên bản phong bì hiện hành. Bên tiêu thụ phải hỗ trợ N và N-1. */
export const ENVELOPE_SCHEMA_VERSION = '0';

/** Danh sách trường của phong bì, dùng cho kiểm tra và cho validator. */
export const ENVELOPE_FIELDS = [
  'schemaVersion',
  'kind',
  'producer',
  'episodeId',
  'channel',
  'genre',
  'locale',
  'inputsHash',
  'inputs',
  'createdAt',
  'costUsd',
  'status',
  'payload',
] as const;
