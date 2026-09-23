# 🤖 Thứ tự ưu tiên giữa các làn

Worker duyệt các làn theo đúng thứ tự dưới đây, và nhận mục `ready` đầu tiên gặp được (CHARTER 2.1, phụ lục P1). Chủ dự án chỉnh file này bất cứ lúc nào; agent làm theo ngay ở lần chạy kế tiếp.

| # | Làn | Vì sao ở vị trí này |
|---|---|---|
| **0** | **`platform` · chỉ mục `P-016`** | **Ghim tạm thời.** Hàng đợi merge tuần tự đang phải giải tay ở mọi PR, nên nó chặn mọi làn khác — không làn nào tới được `main` mà không đi qua đó. Gỡ dòng này khi `P-016` chuyển `done`; phần còn lại của làn `platform` vẫn ở vị trí 7. |
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

> **Dòng ghim `P-018` đã được gỡ ngày 2026-09-21** (mục `I-010`): `P-018` đã `done` — PR #26 merge thật, tiêu chí xong đạt — và chính dòng đó dặn "gỡ dòng này khi `P-018` chuyển `done`".
>
> Dòng ghim `P-016` **vẫn còn**, và hai dòng ghim cũ `0a`/`0b` gộp lại thành một dòng `0`. Lý do giữ: `P-016` **chưa** `done`. Thân mục ghi rõ "chưa kiểm bằng chạy thật … không tự chuyển `done` ở đây", và lý do ghim vẫn đúng theo số đo — `ops/logs/platform/P-016.jsonl` ghi PR #39 ra `aborted-ineligible` **năm lượt liên tiếp**. Gỡ ghim lúc này là gỡ tín hiệu trong khi tắc nghẽn còn nguyên.

Theo phụ lục P1, worker xử lý những việc sau **trước** khi duyệt bảng:

0. **Bước 0 của phụ lục P3** — giải xung đột merge cho hàng đợi. Chạy ở đầu **mọi** lượt worker, trước cả hai mục dưới đây.


1. PR đang mở có CI đỏ, và chưa có worker nào đang xử lý (không có commit mới trong 2 giờ).
2. PR đang mở có comment chưa xử lý, cùng điều kiện trên.
3. PR mà lượt bước 0 gần nhất của phụ lục P3 gộp **sạch** rồi chạy thử thì **đỏ**, cùng điều kiện trên
   (mục `P-025`). Nhánh không xung đột, CI trên nhánh vẫn xanh (nó chỉ đỏ *sau khi gộp*), nên ba lý do kia
   đều sai với nó và trước `P-025` thì không lượt nào nhận — PR #81 kẹt như vậy ba lượt liên tiếp. Việc cần
   làm ở đây là đọc chỗ đỏ rồi **sửa code thật** trên nhánh đó, không phải giải xung đột.
4. PR mà lượt bước 0 gần nhất của phụ lục P3 trả `aborted-ineligible`, cùng điều kiện trên (mục `P-022`).
   Integrator đã làm hết phần của nó và bị cấm giải tay (phụ lục P3 bước 0b); "cần người" phải có người
   nhận, không rơi vào khoảng trống giữa integrator và worker. Worker nhận không cần cùng làn với PR — chỉ
   cần đọc PR để biết nó định làm gì rồi giải xung đột bằng phán đoán, khác bước 0 mang tính cơ học.

Bốn lý do trên xếp theo đúng thứ tự liệt kê khi nhiều PR cùng đủ điều kiện (CI đỏ thắng, vì đã có tiêu chí
xong và nhãn `fix` gắn sẵn; và `red-after-merge` xếp sau comment của chủ dự án, không trước — thời gian của
anh đắt hơn thời gian của máy). `ops/scripts/pr-triage.ts` (hàm `pickPrToHandle`) là cơ chế quyết định, đừng
tự suy bằng lời. Xử lý **đúng một** PR như vậy rồi kết thúc lần chạy. Lý do: một PR kẹt nằm đó chặn hàng
đợi merge, và hàng đợi merge là tuần tự.

## Điều tiết

Khi chi phí tích luỹ sắp chạm ngân sách học (CHARTER mục 8), điều tiết xảy ra ở **cửa vào**: không mở mục mới, không mở tập mới. Việc đang chạy **không** bị cắt ngang (CHARTER 2.2). Code không chứa logic dừng vì chi phí.
