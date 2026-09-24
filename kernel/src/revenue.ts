/**
 * Khấu trừ doanh thu theo hệ số khai trong Channel Pack (mục `topic/T-013`).
 *
 * kernel chỉ biết CÁCH áp hệ số, KHÔNG biết hệ số là bao nhiêu. Con số 30%
 * và lý do (Mỹ–Việt Nam chưa có hiệp định thuế có hiệu lực) là **dữ liệu của
 * kênh**, nằm ở `revenueWithholding` trong `packs/channels/<slug>/channel.json`
 * — kênh khác thị trường khác có hệ số khác. Ở đây chỉ có logic trung tính:
 * đọc khối đó ra kiểu dữ liệu, và áp nó lên một con số gộp.
 *
 * Vì sao helper này ở kernel chứ ở ops/: bất biến **I3** cấm xưởng import
 * `ops/`; mọi chỗ ước tính doanh thu (nay chưa có, mai sẽ có ở xưởng hoặc
 * script) phải đọc được hệ số từ cùng một chỗ. kernel là lớp duy nhất cả
 * xưởng lẫn ops đều import được, nên helper đọc/áp nằm ở đây; còn phần **canh**
 * (validate khối trong pack + dò chỗ ước tính bỏ qua hệ số) nằm ở
 * `ops/scripts/check-revenue-withholding.ts`, đúng khuôn các cổng `pnpm check`.
 *
 * Bất biến **I6**: mọi con số hiển thị có nguồn hoặc có mô hình. Một con số
 * doanh thu là số **sau** một mô hình khấu trừ; `applyRevenueWithholding` trả
 * về CẢ HAI đầu (gộp và ròng) kèm hệ số, nên không bên tiêu thụ nào có thể
 * hiển thị một con số mà không nói rõ nó là trước hay sau khấu trừ.
 */

import type { ChannelPack } from './packs.ts';

/**
 * Khối `revenueWithholding` đã đọc ra kiểu dữ liệu. Các khoá `$` là chú thích
 * người đọc (lý do, ngày, nguồn) — bắt buộc có mặt, và
 * `ops/scripts/check-revenue-withholding.ts` canh việc đó, nhưng logic áp hệ
 * số chỉ cần `rate` và `market`.
 */
export interface RevenueWithholding {
  /** Hệ số khấu trừ, trong khoảng (0, 1). 0,30 nghĩa là giữ lại 70%. */
  rate: number;
  /** Thị trường mà hệ số này áp cho, ví dụ `"US"`. */
  market: string;
}

/** Một con số doanh thu đã áp khấu trừ — luôn mang CẢ hai đầu để không ai đoán. */
export interface WithheldRevenue {
  /** Con số **trước** khấu trừ (gộp). */
  grossUsd: number;
  /** Hệ số đã áp. */
  withholdingRate: number;
  /** Con số **sau** khấu trừ (ròng) — thứ mọi ước tính của kênh phải hiển thị. */
  netUsd: number;
  /** Thị trường của hệ số, dẫn lại từ pack. */
  market: string;
}

/**
 * Đọc khối `revenueWithholding` của một Channel Pack ra kiểu dữ liệu, hoặc ném
 * lỗi nếu thiếu/sai hình dạng phần logic (`rate` trong (0,1), `market` là chuỗi
 * không rỗng). Phần chú thích người đọc (`$reason`/`$asOf`/`$source`) KHÔNG
 * kiểm ở đây — đó là việc của cổng `pnpm check`, không phải của đường chạy;
 * một con số sai ở đường chạy phải dừng ngay, còn thiếu một dòng nguồn thì để
 * cổng bắt để không có hai chỗ định nghĩa cùng một luật.
 */
export function readRevenueWithholding(pack: ChannelPack): RevenueWithholding {
  const raw = pack['revenueWithholding'];
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    throw new Error(
      `channel.json (slug "${pack.slug}") thiếu khối \`revenueWithholding\` (mục topic/T-013).`,
    );
  }
  const block = raw as Record<string, unknown>;
  const rate = block['usSourcedRate'];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate >= 1) {
    throw new Error(
      `channel.json (slug "${pack.slug}"): \`revenueWithholding.usSourcedRate\` phải là số trong khoảng (0, 1), gặp ${JSON.stringify(rate)}.`,
    );
  }
  const market = block['market'];
  if (typeof market !== 'string' || market.trim() === '') {
    throw new Error(
      `channel.json (slug "${pack.slug}"): \`revenueWithholding.market\` phải là chuỗi không rỗng.`,
    );
  }
  return { rate, market };
}

/**
 * Áp hệ số khấu trừ lên một con số gộp và trả về CẢ hai đầu. Đây là **đường
 * duy nhất được phép** biến một con số doanh thu gộp có nguồn từ thị trường của
 * kênh thành một ước tính hiển thị được; `ops/scripts/check-revenue-withholding.ts`
 * đỏ khi có chỗ ước tính doanh thu nào bỏ qua đường này (tiêu chí xong của
 * `topic/T-013`).
 *
 * `grossUsd` phải là số hữu hạn không âm (doanh thu âm là vô nghĩa). Hàm KHÔNG
 * tự làm tròn — làm tròn là quyết định hiển thị của bên tiêu thụ, không phải
 * của mô hình khấu trừ.
 */
export function applyRevenueWithholding(
  grossUsd: number,
  withholding: RevenueWithholding,
): WithheldRevenue {
  if (!Number.isFinite(grossUsd) || grossUsd < 0) {
    throw new Error(`grossUsd phải là số hữu hạn không âm, gặp ${JSON.stringify(grossUsd)}.`);
  }
  return {
    grossUsd,
    withholdingRate: withholding.rate,
    netUsd: grossUsd * (1 - withholding.rate),
    market: withholding.market,
  };
}
