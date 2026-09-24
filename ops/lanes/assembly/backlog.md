# 🤖 Backlog làn `assembly` — Đợt 1

Xưởng Dựng (S10, S12–S15, QA). Preflight đã đo thật từ Đợt 0; làn này mở rộng nó và dựng phần render.

---

### A-001 · Thử nghiệm engine dựng, chốt 30fps hay 60fps
Quyết định này ràng buộc cả làn `visual` lẫn ngân sách phút Actions. Chốt bằng số đo, không bằng sở thích.

- deps: —
- risk: high
- status: review
- hold: chưa đo được phút Actions thật; ba chỉ số 30/60fps chờ mắt chủ dự án (WP-003 mục 5) và visual/V-002
- nguồn: CHARTER mục 10 (Đợt 1); giả định G5
- tiêu chí xong:
  - ✅ **Đo thật cả hai cấu hình, 2026-09-21** — một tập **đầy đủ** 21 phút (`targetDurationMs` của genre
    pack `data-explainer`) dựng ở cả 30fps lẫn 60fps, cộng bản proof của mỗi bên và hai lượt nền để trừ
    chi phí giải mã. Bộ đo: `ops/scripts/render-trial.ts`. Kết quả: `docs/assembly/render-trial.md`.
  - ⬜ **Phút Actions thật còn thiếu.** Số giây tường đo trên container phiên cloud (cùng 4 nhân / 16 GB
    với `ubuntu-latest`), nhưng con số hoá đơn phải do runner thật trả lời. `ops/workflows/render-trial.yml`
    làm đúng việc đó và **chỉ chạy được sau khi PR này merge** rồi `sync-workflows` chép sang `.github/`
    (CHARTER 3.2, giả định **G10**). Chạy nó là việc của lượt kế tiếp, không phải một mục mới.
  - ✅ **Đã mở `🤖 [QĐ]`** với hai phương án và số đo kèm theo: issue #92 (nhãn `decision` + `reversible`).
  - ⬜ **`fpsAllowed` giữ nguyên `[30, 60]`, cố ý.** Xem ghi chú dưới.

**Vì sao không tự chốt fps ở đây.** Quyết định fps đứng trên **hai** phép đo, và mục này chỉ có một:

| Nửa câu hỏi | Ai đo | Trạng thái |
|---|---|---|
| 60fps đắt hơn 30fps bao nhiêu | `A-001` (mục này) | ✅ đo xong |
| 30fps có giật không — clip có xem được không | `visual/V-002`, chỉ số 4–6 của WP-003 | ⬜ chưa, và WP-003 mục 5 ghi rõ **không kết luận thay chủ dự án** về ba chỉ số đó |

Siết `fpsAllowed` lúc này là chốt bằng một nửa bằng chứng, và nửa còn lại đã được charter giao cho mắt
chủ dự án chứ không cho bộ đo. Theo `D-C06` đây là quyết định `reversible`, nên việc phải làm **ngay** là
dán số và nói rõ còn thiếu gì — không phải đứng chờ, và cũng không phải đoán nốt nửa kia.

⚠️ **Nhưng "giữ cả hai" KHÔNG trung lập, và chỗ này phải nói thẳng** (vòng soát chéo bắt được):
`workshops/visual/src/index.ts` lấy `limits.fpsAllowed?.[0]` — **phần tử đầu mảng**. Nên đường ống
**đang chạy 30fps rồi**, chọn bằng thứ tự mảng chứ không bằng bằng chứng. Giữ `[30, 60]` nghĩa là
**giữ quyền đổi**, không phải "chưa chọn". Nếu `V-002` kết luận 30fps giật thì mọi thứ sinh ra trong
khoảng chờ đã ở 30fps — đó là lý do mục này dán số và mở `[QĐ]` ngay thay vì để câu hỏi treo im lặng.

**Số đo đáng chú ý:** gấp đôi số khung **không** làm gấp đôi chi phí dựng. Ở 30fps mỗi khung đắt hơn, vì
bỏ bớt khung làm chuyển động giữa hai khung liền nhau lớn hơn và bộ dự đoán chuyển động phải tìm xa hơn.
Hai hiệu ứng ngược chiều triệt tiêu một phần. Con số chính xác nằm trong `docs/assembly/render-trial.md`;
đừng chép nó vào đây, vì chép là tạo thêm một chỗ để lệch.

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
  - Chi phí mỗi lần proof được ghi vào `ops/logs/assembly/<id>.jsonl` (bất biến I8 theo `D-C04`).

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
