/**
 * Băng ghi — cái làm cho tập vàng chạy lại được (CHARTER 6.1).
 *
 * Mọi lời gọi ra ngoài (LLM, TTS, sinh ảnh, tải dữ liệu) phải đi qua
 * `Cassette.call`. Ở chế độ `replay`, phản hồi lấy từ băng đã ghi và MỌI lời
 * gọi chưa có trong băng đều ném lỗi — nhờ vậy CI không bao giờ vô tình gọi
 * API trả tiền. Ở Đợt 0 các xưởng đều là stub nên băng rỗng; cái được chốt
 * ở đây là RANH GIỚI, để xưởng chuyển sang `v1` không phải sửa lại khung.
 */

import { stableHash } from './hash.ts';

export type CassetteMode = 'replay' | 'record' | 'live';

export interface CassetteEntry {
  key: string;
  provider: string;
  operation: string;
  requestHash: string;
  response: unknown;
  costUsd: number;
}

export class UnrecordedCallError extends Error {
  constructor(provider: string, operation: string, key: string) {
    super(
      `Lời gọi chưa được ghi trong băng: ${provider}/${operation} (key ${key}). ` +
        'Ở chế độ replay, CI không được gọi API ra ngoài. Ghi lại tập vàng bằng một PR riêng.',
    );
    this.name = 'UnrecordedCallError';
  }
}

export class Cassette {
  readonly mode: CassetteMode;
  private readonly entries: Map<string, CassetteEntry>;
  private readonly recorded: CassetteEntry[] = [];
  private spentUsd = 0;
  private callCount = 0;

  constructor(mode: CassetteMode, entries: readonly CassetteEntry[] = []) {
    this.mode = mode;
    this.entries = new Map(entries.map((e) => [e.key, e]));
  }

  static keyOf(provider: string, operation: string, request: unknown): string {
    return `${provider}:${operation}:${stableHash(request).slice(0, 16)}`;
  }

  /** Chi phí tích luỹ của các lời gọi đã đi qua băng này (bất biến I8). */
  get costUsd(): number {
    return Number(this.spentUsd.toFixed(6));
  }

  get newEntries(): readonly CassetteEntry[] {
    return this.recorded;
  }

  /**
   * Số lời gọi ra ngoài ĐÃ ĐI QUA băng này — tính cả lần lấy lại từ băng, vì
   * một lần replay vẫn là một lời gọi mà stage đó thật sự thực hiện.
   *
   * Đây là tín hiệu để một xưởng biết nó CÓ gọi mô hình hay không, thay vì
   * suy từ cờ `impl`. `costUsd` không thay được: một lời gọi đã ghi có thể
   * có `costUsd` bằng 0, nên 0 đồng không có nghĩa là không gọi.
   */
  get calls(): number {
    return this.callCount;
  }

  async call<T>(
    provider: string,
    operation: string,
    request: unknown,
    perform: () => Promise<{ response: T; costUsd: number }>,
  ): Promise<T> {
    const key = Cassette.keyOf(provider, operation, request);
    const hit = this.entries.get(key);
    if (hit) {
      this.spentUsd += hit.costUsd;
      this.callCount += 1;
      return hit.response as T;
    }
    if (this.mode === 'replay') {
      throw new UnrecordedCallError(provider, operation, key);
    }
    const { response, costUsd } = await perform();
    const entry: CassetteEntry = {
      key,
      provider,
      operation,
      requestHash: stableHash(request),
      response,
      costUsd,
    };
    this.entries.set(key, entry);
    this.recorded.push(entry);
    this.spentUsd += costUsd;
    this.callCount += 1;
    return response;
  }
}
