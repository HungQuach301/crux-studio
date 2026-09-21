# 🤖 Thứ tự ưu tiên giữa các làn

Worker duyệt các làn theo đúng thứ tự dưới đây, và nhận mục `ready` đầu tiên gặp được (CHARTER 2.1, phụ lục P1). Chủ dự án chỉnh file này bất cứ lúc nào; agent làm theo ngay ở lần chạy kế tiếp.

| # | Làn | Vì sao ở vị trí này |
|---|---|---|
| **0a** | **`platform` · chỉ mục `P-018`** | **Ghim, chủ dự án chỉ định.** Trên issue bản tin #17 (2026-09-21) anh viết "Ưu tiên cao nhất: thực hiện D-C04", và đã trả lời **B** cho issue #14. Từ nay có 3 worker song song nên xung đột ở file log sẽ tăng nếu chưa làm. PR này là `owner-merge` — chỉ chủ dự án merge. Gỡ dòng này khi `P-018` chuyển `done`. |
| **0b** | **`platform` · chỉ mục `P-016`** | **Ghim tạm thời.** Hàng đợi merge tuần tự đang phải giải tay ở mọi PR, nên nó chặn mọi làn khác — không làn nào tới được `main` mà không đi qua đó. Gỡ dòng này khi `P-016` chuyển `done`; phần còn lại của làn `platform` vẫn ở vị trí 7. |
| 1 | `integration` | `main` đỏ chặn mọi làn khác. Revert trước, làm việc mới sau. |
| 2 | `verify` | Kiểm trước, dựa vào sau (CHARTER 11.1 luật 2). Một giả định sai được phát hiện muộn đắt hơn mọi thứ trong bảng này. |
| 3 | `topic` | Ưu tiên số một của Đợt 1 theo CHARTER mục 10. Cổng Mốc 3 là cổng quan trọng nhất, và nó nằm trọn trong làn này. Trượt cổng đó thì dự án dừng. |
| 4 | `visual` | Rủi ro A2: chất lượng hình ảnh kém là lỗi đã lặp lại ở các dự án trước. Spike canvas (WP-003) là cổng chặn kiến trúc — biết sớm hay biết muộn quyết định phải viết lại bao nhiêu. |
| 5 | `assembly` | Chốt 30fps hay 60fps ràng buộc cả làn `visual` lẫn ngân sách phút Actions (giả định G5). |
| 6 | `audio` | Giả định G7 (điều khoản thương mại của giọng đọc) chặn mọi thứ phía sau nó, nhưng kiểm rẻ và nhanh. |
| 7 | `platform` | Hạ tầng đã đủ dùng sau Đợt 0. Phần còn lại là tăng tốc, không phải mở đường. |
| 8 | `kernel` | Contract v0 cố ý để lỏng. Siết lại **sau** tập thật đầu tiên, không phải trước. |
| 9 | `editorial` | Nâng cấp stub, chưa gọi API tốn kém (CHARTER mục 10, Đợt 1). |
| 10 | `release` | Chưa có gì để phát hành cho tới khi năm làn trên chạy được một tập thật. |

## Ngoại lệ đứng trên bảng này

Theo phụ lục P1, worker xử lý những việc sau **trước** khi duyệt bảng:

0. **Bước 0 của phụ lục P3** — giải xung đột merge cho hàng đợi. Chạy ở đầu **mọi** lượt worker, trước cả hai mục dưới đây.


1. PR đang mở có CI đỏ, và chưa có worker nào đang xử lý (không có commit mới trong 2 giờ).
2. PR đang mở có comment chưa xử lý, cùng điều kiện trên.
3. PR đang mở mà lượt bước 0 gần nhất trả `aborted-ineligible`, cùng điều kiện trên (mục `P-022`). **Ngang giá với ca 1 và ca 2**, không phải ca hạng hai: tool đã làm đúng phần của nó và dừng, nên nếu không ai nhận thì PR nằm đó qua hết lượt này tới lượt khác — đã đo #26 bốn lượt, #39 ba lượt. Việc thuộc **làn sở hữu PR** (suy từ tên nhánh `claude/<lane>/<id>`); làn đó không có worker rảnh ở lượt này thì **worker gặp nó vẫn phải nhận**. Ca này **được giải tay**, khác bước 0 — xem phụ lục P1 bước 2c của CHARTER.

Xử lý **đúng một** PR như vậy rồi kết thúc lần chạy. Kẹt lâu nhất đi trước. Lý do: một PR đỏ hoặc kẹt nằm đó chặn hàng đợi merge, và hàng đợi merge là tuần tự.

Ca 3 đọc bằng máy, không bằng mắt: `node ops/scripts/pr-pickup.ts --prs <file.json>` in ra trường `pickup` — PR phải nhận, làn sở hữu, số giờ kẹt. Không có `--prs` thì tool nói thẳng là nó chưa trả lời được; trường `stuck` khi đó chỉ là bản ghi của lượt bước 0 gần nhất, **chưa** lọc qua ngưỡng 2 giờ, đừng đọc nó như danh sách phải nhận.

## Điều tiết

Khi chi phí tích luỹ sắp chạm ngân sách học (CHARTER mục 8), điều tiết xảy ra ở **cửa vào**: không mở mục mới, không mở tập mới. Việc đang chạy **không** bị cắt ngang (CHARTER 2.2). Code không chứa logic dừng vì chi phí.
