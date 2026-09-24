/**
 * Mục `platform/P-042` — tiền tố 🤖 mà `CLAUDE.md` mục 5 **bắt buộc** làm mù
 * mọi bộ đọc tiêu đề neo vào đầu dòng.
 *
 * ## Chỗ hỏng
 *
 * `CLAUDE.md` mục 5: *"**Mọi** issue, mọi comment, mọi mô tả PR do agent viết
 * đều **bắt đầu bằng ký tự 🤖**. Không có ngoại lệ."* Tiền tố đó là **dấu vết
 * duy nhất** phân biệt người với máy khi agent dùng danh tính GitHub của chủ
 * dự án (CHARTER 3.1, mặc định M6), nên nó không phải thứ để bỏ đi.
 *
 * Nhưng phụ lục P1 bước 4 đòi tiêu đề PR dạng `[<lane>] <id> — …`, và các bộ
 * đọc tiêu đề đều neo `^\[`. Hai luật đúng riêng lẻ, cắn nhau khi gặp: PR
 * đặt tiêu đề `🤖 [platform] P-038 — …` (ca thật, `#212`) squash-merge vào
 * `main` giữ nguyên tiền tố, và bộ đọc trả `false`/`null` — mục **không bao
 * giờ** được nhận là đã xong.
 *
 * Đo trên `main` (`e4a5931`, 2026-09-24): **30 / 213** commit có tiền tố 🤖.
 *
 * Đúng **nhóm Z** (`ops/known-failures.md`): CI xanh, backlog đọc vẫn hợp lệ,
 * `git log` vẫn có commit — chỉ con số là sai, và không gì đỏ.
 *
 * ## Vì sao một chỗ dùng chung, không vá tại chỗ
 *
 * `CLAUDE.md` mục 13: *"Lỗi cùng loại xuất hiện lần thứ hai → sửa spec,
 * contract hoặc prompt, **không vá sản phẩm**."* Lỗ này đã gặp **ba** lần ở
 * ba bộ đọc khác nhau (`hasCompletionCommit`, `laneFromTitle`, và
 * `claimKeyFromTitle` của mục `P-041` — chỗ thứ ba tự bắt được và tự vá
 * riêng). Vá lần thứ tư tại chỗ là mời lần thứ năm.
 *
 * Nên luật nằm ở **đúng một** hàm, và mọi bộ đọc tiêu đề gọi nó.
 */

/**
 * Tiền tố agent của `CLAUDE.md` mục 5 — ký tự 🤖, U+1F916.
 *
 * Một ký tự **ngoài BMP**, nên nó dài **hai** đơn vị mã UTF-16: phép cắt bên
 * dưới phải dùng `AGENT_PREFIX.length` (= 2), không phải 1. Đó là lý do hằng
 * số này tồn tại thay vì viết thẳng ký tự vào mỗi chỗ dùng — và `agent-prefix.test.ts`
 * khoá cả `codePointAt(0) === 0x1f916` lẫn độ dài, để một lần "dọn" sau này
 * không âm thầm thay nó bằng một ký tự trông giống.
 */
export const AGENT_PREFIX = '🤖';

/**
 * Bỏ tiền tố 🤖 (cùng khoảng trắng theo sau) khỏi đầu một tiêu đề, và **chỉ**
 * thế. Tiêu đề không có tiền tố trả về nguyên vẹn.
 *
 * Ba chỗ cố ý chặt, mỗi chỗ là một cách fail-open đã cân nhắc:
 *
 * - **Chỉ bỏ ở ĐẦU chuỗi.** Một 🤖 nằm giữa câu là nội dung của tiêu đề, không
 *   phải dấu phân biệt người/máy.
 * - **Chỉ bỏ MỘT lần.** `🤖 🤖 [platform] P-001 — …` không phải tiêu đề đúng
 *   quy ước, và im lặng nhận nó là mở đường cho một tiêu đề rác khớp nhầm.
 * - **Không đụng `trim()` ở cuối.** Bên gọi neo `^`, nên chỉ phần đầu mới đổi
 *   ý nghĩa; cắt thêm ở đuôi là đổi dữ liệu mà bên gọi không xin.
 */
export function stripAgentPrefix(title: string): string {
  if (!title.startsWith(AGENT_PREFIX)) return title;
  return title.slice(AGENT_PREFIX.length).replace(/^\s+/, '');
}
