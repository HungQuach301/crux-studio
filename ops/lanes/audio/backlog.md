# 🤖 Backlog làn `audio` — Đợt 1

Xưởng Âm thanh (S11–S11b, phụ đề).

---

### AU-001 · Đánh giá nhà cung cấp giọng đọc và điều khoản thương mại
Kiểm **giả định G7**. Mục này chặn mọi thứ phía sau nó, nhưng kiểm rẻ và nhanh — đọc điều khoản, không phải chạy thử.

- deps: G7
- risk: high
- status: ready
- nguồn: CHARTER 11.2 (G7), mục 8; rủi ro A6
- tiêu chí xong:
  - Mỗi nhà cung cấp được xét có một dòng trong `ops/license-ledger.md`: nguồn, điều khoản, dùng thương mại được không, giao lại cho khách hàng B2B được không.
  - Trích dẫn điều khoản kèm ngày đọc, không tóm tắt bằng trí nhớ.
  - Chọn nhà cung cấp là quyết định `irreversible` (CHARTER 2.3): mở `🤖 [QĐ]`, không tự chọn.
  - `voice.commercialLicenseVerified` chỉ được đặt `true` sau khi quyết định đó đóng.

### AU-002 · Phụ đề và đo trôi
- deps: AU-001
- risk: low
- status: ready
- nguồn: contract audio v0; genre pack `captionDriftMaxMs`
- tiêu chí xong: trôi lớn nhất được **đo** trên một tập thật và ghi vào artifact, không để mặc định 0.

### AU-003 · Chuẩn hoá loudness
- deps: AU-001
- risk: low
- status: ready
- nguồn: spec mục sound-design
- tiêu chí xong: loudness đo được nằm trong dung sai khai trong genre pack, trên toàn tập chứ không chỉ trên một đoạn.

### AU-004 · Độ dẫn âm thanh ở ranh giới beat (J-cut)
Cung cấp dữ liệu cho kiểm số 6 của Preflight.

- deps: AU-002
- risk: low
- status: ready
- nguồn: spec cơ chế 1 kiểm 6
- tiêu chí xong: artifact âm thanh mang được độ dẫn ở từng ranh giới beat, đủ để xưởng Dựng kiểm mà không phải đoán.

### AU-005 · Xưởng `audio` lên `impl: v1`
- deps: AU-003, AU-004
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`, băng ghi chứa phản hồi TTS thật.
