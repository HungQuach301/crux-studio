/**
 * `kernel` — nền dùng chung, TRUNG TÍNH với thể loại và kênh (CHARTER 5.1).
 *
 * Luật phân định: một file chỉ thuộc kernel KHI nó đúng với mọi thể loại và
 * mọi kênh. Nghi ngờ thì đẩy xuống genre pack; nghi ngờ tiếp thì đẩy xuống
 * channel pack. Hằng số nội dung lọt vào đây là một cảnh báo (CHARTER mục 4).
 *
 * Bất biến I3: xưởng không import code của xưởng khác, chỉ import kernel.
 */

export * from './envelope.ts';
export * from './validate.ts';
export * from './contracts.ts';
export * from './hash.ts';
export * from './cassette.ts';
export * from './clock.ts';
export * from './log.ts';
export * from './workshop.ts';
export * from './artifact-store.ts';
export * from './packs.ts';
export * from './cli.ts';
