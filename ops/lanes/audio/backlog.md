# 🤖 Backlog làn `audio` — Đợt 1

Xưởng Âm thanh (S11–S11b, phụ đề).

---

### AU-001 · Đánh giá nhà cung cấp giọng đọc và điều khoản thương mại
Kiểm **giả định G7**. Mục này chặn mọi thứ phía sau nó, nhưng kiểm rẻ và nhanh — đọc điều khoản, không phải chạy thử.

- deps: G7
- risk: high
- status: review
- hold: chờ `🤖 [QĐ]` chọn nhà cung cấp giọng đọc đóng — `voice.commercialLicenseVerified` còn `false`
- nguồn: CHARTER 11.2 (G7), mục 8; rủi ro A6
- tiêu chí xong:
  - ✅ Mỗi nhà cung cấp được xét có một dòng trong `ops/license-ledger.md`: nguồn, điều khoản, dùng thương mại được không, giao lại cho khách hàng B2B được không. — **ba nhà cung cấp TTS** (Amazon Polly, Google Cloud TTS, ElevenLabs) đã có dòng ở bảng đầu `ops/license-ledger.md`, mục backlog `AU-001`.
  - ✅ Trích dẫn điều khoản kèm ngày đọc, không tóm tắt bằng trí nhớ. — khảo sát `AU-001` (2026-09-22) trong `ops/license-ledger.md` trích **nguyên văn** từ văn bản điều khoản gốc (`curl` HTML gốc → tách text → trích), kèm URL và ngày đọc. **Câu 2 (B2B) khai thẳng là suy luận từ quyền sở hữu, không tường minh** — đúng khoảng cách A6.
  - ⬜ Chọn nhà cung cấp là quyết định `irreversible` (CHARTER 2.3): mở `🤖 [QĐ]`, không tự chọn. — đã mở `🤖 [QĐ]` (link trong PR); **chờ chủ dự án**.
  - ⬜ `voice.commercialLicenseVerified` chỉ được đặt `true` sau khi quyết định đó đóng. — giữ `false` (stub), chưa đụng.
- **Vì sao `review` chứ không `done`:** phần đọc-điều-khoản đã xong và trích dẫn nằm trong `ops/license-ledger.md`, nhưng hai tiêu chí cuối chờ **quyết định `irreversible`** của chủ dự án (chọn provider) — không chờ một lượt worker. Chỉ chuyển `done` khi issue `[QĐ]` đóng và `commercialLicenseVerified` được xử lý. `deps: G7` cũ đọc "TTS không đọc được từ phiên cloud" đã lỗi thời cho **phiên này**: mạng egress không đồng nhất giữa các phiên (cùng quan sát `topic/T-001`), phiên này đọc được — bằng chứng ở khảo sát `AU-001`.
- **cửa merge:** chạm `ops/license-ledger.md`, `ops/lanes/audio/**`, `ops/logs/**` — không chạm vùng `owner-merge`; chạy `node ops/invariants.protected-area.ts`, đừng đoán.

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
