# 🤖 Backlog làn `integration` — Đợt 1

Làn nền, **ưu tiên số một** trong `priority.md`: `main` đỏ chặn mọi làn khác.

Phần lớn việc của làn này chạy bằng routine `crux-integrator` (phụ lục P3), không bằng mục backlog. Các mục dưới đây là công cụ mà routine đó cần.

---

### I-001 · Dọn PR nháp đã bỏ
- deps: —
- risk: low
- status: review
- nguồn: phụ lục P3 bước 2
- tiêu chí xong:
  - Đóng PR nháp không có commit mới quá 72 giờ, **kèm ghi chú** nói rõ mục đó quay lại hàng đợi.
  - Mục tương ứng trong backlog chuyển từ `claimed` về `ready`.

### I-002 · `ops/metrics.md` tự cập nhật
Tín hiệu của rủi ro R12 (độ phức tạp tự phình to): số file code so với số mục đã xong.

- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 6.7; phụ lục P3 bước 3
- tiêu chí xong:
  - Một lệnh tính: số file code / số mục `done`, số lần revert, tỷ lệ `main` xanh.
  - Số liệu ghi vào `ops/metrics.md`, không chỉ in ra màn hình.

### I-003 · Chạy lại kiểm tra tự động của sổ giả định mỗi thứ Hai
Nhiều tính năng đang ở giai đoạn research preview và có thể đổi bất cứ lúc nào (rủi ro B6).

- deps: `docs/assumptions.md`
- risk: low
- status: ready
- nguồn: CHARTER 11.1; phụ lục P3 bước 4
- tiêu chí xong:
  - Giả định nào có cách kiểm tự động thì chạy được bằng một lệnh.
  - Giả định đổi trạng thái thì mở `🤖 [QĐ]` **kèm danh sách phần bị ảnh hưởng**, lấy từ các mã giả định.

### I-004 · Tạo lại lockfile khi xung đột
- deps: —
- risk: low
- status: ready
- nguồn: CHARTER mục 7 (file nóng được phân vùng)
- tiêu chí xong: lockfile do làn này tạo lại, không phải do làn gây xung đột tự sửa.
