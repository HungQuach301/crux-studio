# 🤖 Backlog làn `release` — Đợt 1

Xưởng Phát hành và đo lường (S15b–S19). Đợt 1: **nâng cấp stub, chưa gọi API tốn kém**.

---

### R-001 · Chuyển phần phát hành của Channel Pack
`title-formulas`, `thumbnail-spec`, `distribution`, `monetization` từ spec vào `packs/channels/`.

- deps: T-002
- risk: low
- status: ready
- nguồn: spec phần Channel Pack
- tiêu chí xong: validator đối chiếu được `titles[].formula` với danh sách khuôn tiêu đề thật, thay vì chấp nhận mọi chuỗi.

### R-002 · Tải lên YouTube ở chế độ riêng tư
**Bất biến I5.** Máy tải lên riêng tư; chủ dự án tự bấm công khai trong YouTube Studio.

- deps: R-001, G6
- risk: high
- status: ready
- nguồn: CHARTER bất biến I5; giả định G6
- tiêu chí xong:
  - Quota đơn vị mỗi lần tải được **đo** và ghi vào artifact, không ước lượng.
  - Không có đường nào trong code đặt `visibility` khác `private`. Contract đã khoá; test phải chứng minh code cũng không thử.
  - Nới I5 cần đủ ba điều kiện ở CHARTER mục 3 **và** một quyết định `irreversible`. Không nằm trong phạm vi mục này.

### R-003 · Thu chỉ số 48h / 7d / 28d
- deps: R-002
- risk: low
- status: ready
- nguồn: contract release v0 `metricsPlan`; spec `metrics.schema.json`
- tiêu chí xong:
  - Lưu **đường cong giữ chân**, không chỉ chỉ số tổng hợp — chỉ số tổng hợp không đối chiếu được retention với vị trí beat.
  - Giờ xem tích luỹ của kênh được theo dõi (mặc định M1: YPP đòi 1.000 sub + 8.000 giờ trong 365 ngày từ 1/2/2027).

### R-004 · Công bố mô hình sang repo công khai `crux-models`
- deps: T-006, R-002
- risk: high
- status: ready
- nguồn: quyết định D-16, D-C01
- tiêu chí xong:
  - PAT `PUBLISH_REPO_TOKEN` chỉ tạo khi tới mục này, phạm vi một repo, quyền tối thiểu (D-C01).
  - Mọi thứ hiển thị ra công chúng là quyết định `irreversible`: mở `🤖 [QĐ]` trước lần công bố đầu tiên.
  - `modelSheetUrl` trong artifact trỏ tới bảng tính đã công bố thật, không phải URL dự kiến.

### R-005 · Xưởng `release` lên `impl: v1`
- deps: R-003
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`; `publication.visibility` vẫn là `private`.
