# 🤖 `ops/lanes` — hàng đợi việc

Mỗi làn một thư mục, mỗi làn một `backlog.md`. **Phân vùng theo làn là thứ giữ cho các worker chạy song song không đụng nhau** (CHARTER mục 7, rủi ro B3).

## Một mục backlog gồm

| Trường | Nghĩa |
|---|---|
| `id` | Mã mục, dùng làm tên nhánh `claude/<lane>/<id>` |
| mô tả | Một câu: làm gì, và vì sao bây giờ |
| `deps` | Các mục phải `done` trước. `—` là không phụ thuộc gì. Nhiều mục thì **cắt bằng dấu phẩy** — dấu `·` trong dòng này là lời giải thích, không phải dấu ngăn (mục `I-015`) |
| `risk` | `low` hoặc `high`. `high` = chạm kiến trúc, chạm tiền, hoặc chưa biết cách làm |
| `status` | `ready` · `claimed` · `review` · `done` · `parked` |
| `hold` | *(tuỳ chọn)* Một dòng `- hold: <lý do>` giữ mục ở `review`, không cho `pnpm backlog:status` lật sang `done` dù PR đã merge. **Một dòng là hình dạng khuyến nghị** — dòng này đi thẳng vào khối "Việc đang chờ anh" của bản tin, mà bản tin phải đọc được trong khoảng 60 giây trên điện thoại (`CLAUDE.md` mục 9). Lý do có xuống dòng thì `joinHoldLines` vẫn đọc **đủ** (mã `KF-041`: trước bản sửa đó, bên đọc lặng lẽ cắt giữa câu ở 2 mục thật, mất 142 và 243 ký tự, mà không gì đỏ). Đây là **nguồn quyết định** cho "còn treo" — khai bằng trường, không bằng câu văn (mục `I-020`, `KF-023`). Lưới lời văn `HOLD_MARKERS` chỉ là dự phòng cho mục chưa kịp khai trường |
| tiêu chí xong | Danh sách kiểm được bằng máy hoặc bằng một câu trả lời dứt khoát |
| nguồn | WP hoặc mục CHARTER mà mục này sinh ra từ đó |

## Luật

- **Một mục = một nhánh = một PR.** Không gộp.
- Worker nhận mục đầu tiên có `status: ready`, mọi `deps` đã xong, chưa có nhánh và chưa có PR mở. Nhận xong đổi thành `claimed` ngay trong PR nháp.
- **Đừng đối chiếu `deps` bằng mắt** — chạy `pnpm backlog:status` và lấy trường `readyNow` (mục `I-015`, CHARTER phụ lục P1 bước 3). "Đã xong" ở dòng trên nghĩa là `status: done`, **hoặc** còn `review` mà PR của mục đó đã vào `main` thật: lệnh trên tính cả ca thứ hai, và `pnpm backlog:status --fix` ở bước dọn dẹp của integrator chuyển nó sang `done`.
- Mục nào phụ thuộc một **giả định** chưa kiểm thì `deps` ghi mã giả định (ví dụ `G7`). Không xây trên giả định "suy luận" chưa kiểm, trừ khi phương án dự phòng đã viết sẵn (CHARTER 11.1 luật 2).
- Cùng một chữ ký lỗi ba lần trên một mục → `parked` + issue `🤖 [QĐ]` + chuyển sang mục khác. Làn không dừng.
- Backlog **do agent tự sinh và chia nhỏ** từ CHARTER và spec. Chủ dự án chỉnh được bất cứ lúc nào bằng cách sửa file.

Thứ tự ưu tiên **giữa** các làn: `ops/lanes/priority.md`.
