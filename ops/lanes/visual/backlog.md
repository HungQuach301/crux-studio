# 🤖 Backlog làn `visual` — Đợt 1

Xưởng Hình (S09a–S09b). Rủi ro **A2**: chất lượng hình ảnh kém là lỗi đã lặp lại ở các dự án trước. Làn này tồn tại để lỗi đó không lặp lần thứ ba.

---

### V-001 · Genre pack phần hình
Chuyển `layouts.json`, hệ thống thị giác và visual tokens từ spec vào `packs/`, để Preflight đối chiếu được `layoutId` thật thay vì chấp nhận mọi chuỗi.

- deps: —
- risk: low
- status: ready
- nguồn: spec phần Genre Pack; CHARTER 5.1
- tiêu chí xong:
  - `packs/genres/data-explainer/layouts.json` và `packs/channels/us-personal-finance/visual-tokens.json` tồn tại và validate được.
  - Preflight bổ sung một kiểm: `layoutId` nào không có trong `layouts.json` thì chặn.

### V-002 · Spike canvas liên tục — cổng chặn kiến trúc
Trả lời **bằng số đo thật**: canvas liên tục với máy quay di chuyển có khả thi trên runner Actions không, và ở cấu hình nào thì chuyển động chấp nhận được.

- deps: —
- risk: high
- status: ready
- nguồn: spec WP-003, quyết định D-04; giả định G5
- tiêu chí xong:
  - Có số đo thật: thời gian render mỗi khung, bộ nhớ, và chi phí phút Actions cho một đoạn mẫu.
  - Kết quả **DỪNG** cũng là kết quả hợp lệ, và phải mở `🤖 [QĐ]` ngay: khi đó `motion-grammar`, `visual-quality-bar`, `layouts.json` và prompt dựng cảnh phải viết lại.
  - Kết quả ghi vào `docs/assumptions.md` cho G5.

### V-003 · Phòng thí nghiệm layout
Chạy một layout ra ảnh mà không cần chạy cả tập, để vòng lặp thử layout tính bằng phút chứ không tính bằng giờ.

- deps: V-001, V-002
- risk: low
- status: ready
- nguồn: CHARTER mục 10 (Đợt 1)
- tiêu chí xong:
  - Một lệnh nhận `layoutId` + dữ liệu mẫu và cho ra ảnh.
  - Ảnh không commit vào repo (CHARTER 5.3).

### V-004 · Vòng hiệu chuẩn gu hình chạy thật
Bộ hiệu chuẩn đã dựng ở Đợt 0. Mục này chạy nó: sinh cặp, mở issue, thu lựa chọn, tính độ nhất quán.

- deps: V-003, `docs/visual/calibration.md`
- risk: low
- status: ready
- nguồn: CHARTER 6.8b, mặc định M2
- tiêu chí xong:
  - ≥20 cặp đã được chủ dự án chọn, kết quả lưu trong repo dưới dạng máy đọc được.
  - Báo cáo nêu được các trục mà lựa chọn nhất quán, và các trục còn lẫn lộn.

### V-005 · Bộ chấm hình tự động
Chỉ được dùng làm **cổng** khi nó trùng lựa chọn của chủ dự án ở mức ngưỡng khai trong cấu hình. Mặc định: ≥90% trên ≥20 cặp.

- deps: V-004
- risk: high
- status: ready
- nguồn: CHARTER 6.8c
- tiêu chí xong:
  - Độ trùng khớp được đo và ghi lại, không được ước lượng.
  - Chưa đạt ngưỡng thì bộ chấm chỉ **cảnh báo**, không chặn. Ngưỡng nằm trong cấu hình, không nằm trong code.

### V-006 · Xưởng `visual` lên `impl: v1`
- deps: V-005
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong:
  - Tập vàng chạy lại xanh với `impl: v1`.
  - Cổng gu hình: 5 layout đạt 8/8 tiêu chí (CHARTER mục 10, Đợt 2).
