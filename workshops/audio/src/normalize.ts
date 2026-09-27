/**
 * Bộ chuẩn hoá văn bản cho giọng đọc — công đoạn ĐẦU của xưởng Âm thanh
 * (mục `audio/AU-007`, kiến trúc (a): chuẩn hoá văn bản → TTS → kiểm → làm
 * lại → xuất mốc thời gian từng từ).
 *
 * Đây là MÃ của xưởng; NỘI DUNG (các luật đọc) nằm trong Channel Pack
 * (`packs/channels/<slug>/reading-table.json`), nạp bằng `readingRulesFor`
 * của kernel. Tách vậy để hằng số nội dung không lọt vào `kernel` hay vào
 * mã xưởng (rủi ro `CLAUDE.md` mục 11).
 *
 * KHÔNG gọi nhà cung cấp nào: bộ này chạy được khi `providers.tts` còn
 * `null` (Đợt 0). Nó chỉ biến đổi văn bản, không sinh âm thanh.
 *
 * Bất biến I3: file này chỉ import `@crux/kernel`.
 */

import type { ReadingRule } from '@crux/kernel';

/**
 * Áp các luật đọc theo ĐÚNG thứ tự khai. Mỗi luật là một phép
 * `String.prototype.replace` toàn cục (cờ mặc định `'g'`), nên `replacement`
 * dùng được `$1..$9`. Thứ tự có nghĩa: luật trước thấy văn bản gốc, luật sau
 * thấy kết quả của luật trước.
 */
export function normalizeForSpeech(text: string, rules: readonly ReadingRule[]): string {
  return rules.reduce((acc, rule) => {
    const flags = rule.flags && rule.flags.length > 0 ? rule.flags : 'g';
    return acc.replace(new RegExp(rule.pattern, flags), rule.replacement);
  }, text);
}
