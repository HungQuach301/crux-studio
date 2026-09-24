# 🤖 `ops/lanes` — hàng đợi việc

Mỗi làn một thư mục, mỗi làn một `backlog.md`. **Phân vùng theo làn là thứ giữ cho các worker chạy song song không đụng nhau** (CHARTER mục 7, rủi ro B3).

## Một mục backlog gồm

| Trường | Nghĩa |
|---|---|
| `id` | Mã mục, dùng làm tên nhánh `claude/<lane>/<id>` |
| mô tả | Một câu: làm gì, và vì sao bây giờ |
| `deps` | Các mục phải `done` trước. `—` là không phụ thuộc gì |
| `risk` | `low` hoặc `high`. `high` = chạm kiến trúc, chạm tiền, hoặc chưa biết cách làm |
| `status` | `ready` · `claimed` · `review` · `done` · `parked` |
| `hold` | *(tuỳ chọn)* Một dòng `- hold: <lý do>` giữ mục ở `review`, không cho `pnpm backlog:status` lật sang `done` dù PR đã merge. Đây là **nguồn quyết định** cho "còn treo" — khai bằng trường, không bằng câu văn (mục `I-020`, `KF-023`). Lưới lời văn `HOLD_MARKERS` chỉ là dự phòng cho mục chưa kịp khai trường |
| tiêu chí xong | Danh sách kiểm được bằng máy hoặc bằng một câu trả lời dứt khoát |
| nguồn | WP hoặc mục CHARTER mà mục này sinh ra từ đó |

## Luật

- **Một mục = một nhánh = một PR.** Không gộp.
- Worker nhận mục đầu tiên có `status: ready`, mọi `deps` đã `done`, chưa có nhánh và chưa có PR mở. Nhận xong đổi thành `claimed` ngay trong PR nháp.
  - **"Chưa có PR mở" hỏi bằng máy, không bằng mắt:** `claimCheck` của `ops/scripts/claim-collision.ts` (`pnpm claims`), đọc chữ ký từ **tiêu đề PR** chứ không từ tên nhánh — nền tảng gán nhánh ngẫu nhiên nên tên nhánh không nói được gì. Hỏi lại lần nữa ngay trước khi push commit đầu tiên (`KF-025`, mục `platform/P-041`).
  - ⚠️ **Dòng `claimed` ở trên chưa lượt nào thi hành**, và CHARTER phụ lục P1 bước 4 không nhắc tới nó — hai nguồn đang nói hai chuyện. Chỗ hở này ghi trong tiêu chí còn lại của `P-041`; tới khi nó được chốt, `claimCheck` là tín hiệu duy nhất chạy thật.
- Mục nào phụ thuộc một **giả định** chưa kiểm thì `deps` ghi mã giả định (ví dụ `G7`). Không xây trên giả định "suy luận" chưa kiểm, trừ khi phương án dự phòng đã viết sẵn (CHARTER 11.1 luật 2).
- Cùng một chữ ký lỗi ba lần trên một mục → `parked` + issue `🤖 [QĐ]` + chuyển sang mục khác. Làn không dừng.
- Backlog **do agent tự sinh và chia nhỏ** từ CHARTER và spec. Chủ dự án chỉnh được bất cứ lúc nào bằng cách sửa file.

Thứ tự ưu tiên **giữa** các làn: `ops/lanes/priority.md`.
