# 🤖 Thước đo nhà máy

Cập nhật bởi routine `crux-integrator` mỗi ngày (phụ lục P3 bước 3). Các con số dưới đây là **tín hiệu**, không phải mục tiêu — tối ưu thẳng vào một con số ở đây là cách nhanh nhất làm nó mất nghĩa.

## Sức khoẻ kiến trúc

Tín hiệu của rủi ro **R12** (độ phức tạp tự phình to) và **B1**.

| Ngày | File code | Mục `done` | File / mục | Ghi chú |
|---|---|---|---|---|
| 2026-09-20 | 26 | 0 | — | Đợt 0, T1 và T2. Chưa có mục backlog nào `done`. |
| 2026-09-21 | 46 | 10 | 5 | Đếm tự động bằng `ops/scripts/update-metrics.ts` (mục `I-002`). |

Tỷ lệ này tăng dần đều là bình thường. Tăng đột ngột nghĩa là một mục đã đẻ ra nhiều code hơn giá trị nó mang lại — đó là lúc gọi routine integrator dọn dẹp.

## Độ ổn định của `main`

| Tuần | Lần merge | Lần revert | Tỷ lệ `main` xanh |
|---|---|---|---|
| 2026-09-20 → 2026-09-21 | 49 | 0 | 100% (không lần nào phải revert) |

## Thước đo quá trình xây (CHARTER 1.3)

| Thước đo | Hiện tại | Mục tiêu |
|---|---|---|
| Số lần chủ dự án phải **gỡ kẹt** (tách riêng với số quyết định) | 0 | 0 |
| Quãng đường tới tập stub chạy trọn chuỗi | ✅ đạt ở Đợt 0 | — |
| Quãng đường tới tập thật đầu tiên | chưa | Đợt 3 |
| FPY theo xưởng | chưa có runtime | — |
| Chi phí tích luỹ | 0 USD | ≤ 600–900 USD tới cổng Mốc 3 |

"Gỡ kẹt" khác "quyết định". Quyết định là việc của chủ dự án theo thiết kế. Gỡ kẹt là nhà máy đã hỏng theo cách nó lẽ ra tự xử lý được — mục tiêu là **không có lần nào**.

## Chi phí

Đọc từ `ops/logs/<lane>/<id>.jsonl` (bất biến I8, quyết định `D-C04`). Sinh bằng `ops/scripts/update-metrics.ts`, gom mọi file log và sắp theo `at` — đừng viết tay.

| Ngày | Chi phí 24h | Tích luỹ | % ngân sách học |
|---|---|---|---|
| 2026-09-20 | 0 | 0 | 0% |
| 2026-09-21 | 0 | 0 | 0% |
