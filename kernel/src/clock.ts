/**
 * Đồng hồ tiêm được. Tập vàng phải cho ra byte giống hệt nhau giữa các lần
 * chạy, nên `createdAt` không được lấy từ đồng hồ hệ thống khi đang replay.
 */
export interface Clock {
  now(): string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export function fixedClock(iso: string): Clock {
  return { now: () => iso };
}
