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
| `hold` | **Có dòng này thì mục không bao giờ tự chuyển `done`**, bất kể thân mục viết gì. Giá trị là lý do, một dòng. Không khai thì bỏ dòng — đừng viết `- hold:` trần |
| tiêu chí xong | Danh sách kiểm được bằng máy hoặc bằng một câu trả lời dứt khoát |
| nguồn | WP hoặc mục CHARTER mà mục này sinh ra từ đó |

## Luật

- **Một mục = một nhánh = một PR.** Không gộp.
- Worker nhận mục đầu tiên có `status: ready`, mọi `deps` đã `done`, chưa có nhánh và chưa có PR mở. Nhận xong đổi thành `claimed` ngay trong PR nháp.
- Mục nào phụ thuộc một **giả định** chưa kiểm thì `deps` ghi mã giả định (ví dụ `G7`). Không xây trên giả định "suy luận" chưa kiểm, trừ khi phương án dự phòng đã viết sẵn (CHARTER 11.1 luật 2).
- **Mục còn phần chưa xong thì khai `- hold: <lý do>`, đừng chỉ viết bằng lời.** `ops/scripts/backlog-status.ts` quyết định "còn treo" bằng **trường** này (mục `integration/I-020`). Nó vẫn dò lời văn như một **lưới dự phòng** cho các mục chưa kịp khai trường, nhưng lưới đó bắt *cách viết* chứ không bắt *ý* — nó đã thủng hai lần (`ops/known-failures.md` `KF-023`), và nó không hội tụ được. `pnpm backlog:status` in `heldByProseOnly`: đó là số mục còn dựa vào lưới, tức phần nợ phải trả dần.
- Cùng một chữ ký lỗi ba lần trên một mục → `parked` + issue `🤖 [QĐ]` + chuyển sang mục khác. Làn không dừng.
- Backlog **do agent tự sinh và chia nhỏ** từ CHARTER và spec. Chủ dự án chỉnh được bất cứ lúc nào bằng cách sửa file.

Thứ tự ưu tiên **giữa** các làn: `ops/lanes/priority.md`.
