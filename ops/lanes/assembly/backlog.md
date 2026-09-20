# 🤖 Backlog làn `assembly` — Đợt 1

Xưởng Dựng (S10, S12–S15, QA). Preflight đã đo thật từ Đợt 0; làn này mở rộng nó và dựng phần render.

---

### A-001 · Thử nghiệm engine dựng, chốt 30fps hay 60fps
Quyết định này ràng buộc cả làn `visual` lẫn ngân sách phút Actions. Chốt bằng số đo, không bằng sở thích.

- deps: —
- risk: high
- status: ready
- nguồn: CHARTER mục 10 (Đợt 1); giả định G5
- tiêu chí xong:
  - Đo thật cả hai cấu hình: thời gian render, dung lượng output, phút Actions cho một tập đầy đủ.
  - Mở `🤖 [QĐ]` với hai phương án và số đo kèm theo. Đây là quyết định `irreversible` nếu nó đổi `fpsAllowed` của genre pack.

### A-002 · Preflight đủ 12 kiểm
Đợt 0 đã có 10 kiểm đo được từ storyboard. Ba kiểm còn lại cần Canvas Map và độ dẫn âm thanh.

- deps: V-001, AU-004
- risk: low
- status: ready
- nguồn: spec cơ chế 1
- tiêu chí xong:
  - Bổ sung kiểm 6 (phủ J-cut), 7 (vùng camera), 8 (nhất quán hướng).
  - Mỗi kiểm mới có test tái hiện một storyboard vi phạm.

### A-003 · Proof render lấy mẫu phân tầng
~460 khung trước khi cam kết ~36.000 khung. Đây là "kiểm ở chỗ rẻ nhất" ở tầng đắt nhất.

- deps: A-001
- risk: low
- status: ready
- nguồn: spec cơ chế 2
- tiêu chí xong:
  - Số ảnh tĩnh tối thiểu và loại lấy mẫu đọc từ genre pack, không ghi cứng.
  - Chi phí mỗi lần proof được ghi vào `ops/logs/assembly.jsonl`.

### A-004 · QA ba lớp ở S15
- deps: A-003
- risk: low
- status: ready
- nguồn: spec mục QA ba lớp
- tiêu chí xong: ba lớp chạy độc lập, mỗi lớp có ngưỡng riêng khai trong cấu hình.

### A-005 · Định tuyến nguyên nhân gốc
Một lỗi ở khâu dựng thường là triệu chứng của một quyết định sai ở khâu trước. Cơ chế này chỉ thẳng vào khâu đó.

- deps: A-002
- risk: low
- status: ready
- nguồn: spec cơ chế 3; CHARTER 6.6
- tiêu chí xong:
  - Mỗi finding của QA mang `rootCauseStage`.
  - Lỗi cùng loại lần thứ hai thì mở mục sửa **spec/contract/prompt**, không vá sản phẩm, và ghi vào `ops/known-failures.md`.

### A-006 · Xưởng `assembly` lên `impl: v1`
- deps: A-004, A-005
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`; các kiểm khối lượng nội dung chuyển từ `warn` sang chặn.
