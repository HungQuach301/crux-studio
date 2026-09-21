# 🤖 Hiệu chuẩn gu hình bằng so sánh cặp

Quy trình biến "anh thích cái nào hơn" thành **ngưỡng khai được trong cấu hình** (CHARTER 6.8b, mặc định M2).

## Vì sao là so sánh cặp, không phải chấm điểm

Chấm điểm một ảnh 1–10 cho dữ liệu kém: thang điểm trôi theo tâm trạng, theo ảnh vừa xem trước đó, và theo việc hôm nay là ảnh thứ mấy. So sánh **hai** ảnh cạnh nhau thì chỉ cần một phán đoán duy nhất, và phán đoán đó ổn định.

Thêm hai điều quan trọng hơn:

1. **Mỗi cặp chỉ đổi MỘT trục.** Hai ảnh giống hệt nhau trừ mật độ chữ. Nhờ vậy lựa chọn "A" nói được điều gì đó về **mật độ chữ**, chứ không phải về ảnh nói chung.
2. **Quyết định xử lý được trong khoảng 60 giây** (rủi ro B11). Một issue, hai ảnh, một chữ cái.

## Vòng lặp

```
1. Máy sinh một cặp A/B khác nhau đúng một trục
        ↓
2. Máy mở issue "🤖 [Gu hình] <trục> · cặp <id>", nhãn decision + reversible
        ↓
3. notify.yml nhắc @HungQuach301 → thông báo về điện thoại
        ↓
4. Chủ dự án comment: A hoặc B  (hoặc "=" nếu không thấy khác nhau)
        ↓
5. Worker kế tiếp đọc câu trả lời, ghi một dòng vào calibration-log.jsonl
        ↓
6. Đủ ≥20 cặp trên một trục → tính ngưỡng, ghi vào genre pack bằng PR riêng
```

Bước 6 là chỗ vòng lặp này khác một cuộc khảo sát: kết quả **đi thẳng vào cấu hình máy đọc được**, không dừng ở một bản tóm tắt.

## Mở một cặp

```bash
node ops/scripts/calibration.ts --pair docs/visual/pairs/motion-01.json
```

In ra thân issue. Worker dán vào issue mới, gắn nhãn `decision` + `reversible`.

Nhãn `reversible` là đúng: nếu chủ dự án đổi ý, sửa một dòng trong log rồi tính lại ngưỡng. Không có gì không hoàn tác được.

## Ghi một câu trả lời

```bash
node ops/scripts/calibration.ts --record --pair motion-01 --choice A --issue 42
```

Ghi một dòng vào `docs/visual/calibration-log.jsonl`. File **append-only**, giống `ops/logs/`. Chọn nhầm thì ghi thêm một dòng đính chính, không sửa dòng cũ — lịch sử lựa chọn là dữ liệu, và nó cho biết gu của chủ dự án có đang trôi hay không.

## Tính kết quả

```bash
node ops/scripts/calibration.ts --tally
```

In ba thứ cho mỗi trục:

| Số | Nghĩa |
|---|---|
| **Số cặp đã chọn** | Chưa đủ 20 thì chưa kết luận gì |
| **Độ nhất quán** | Tỷ lệ lựa chọn cùng nghiêng về một phía của trục. Gần 1.0 = gu rõ; gần 0.5 = trục này chủ dự án không quan tâm, hoặc cặp chưa cô lập đúng một biến |
| **Độ trùng của bộ chấm tự động** | Tỷ lệ bộ chấm chọn giống chủ dự án |

Độ nhất quán **gần 0.5 là một kết quả**, không phải một thất bại: nó nói rằng trục đó không đáng làm cổng, và nên bỏ khỏi khung tham chiếu thay vì ép ra một ngưỡng.

## Cổng của bộ chấm tự động

Theo CHARTER 6.8c, bộ chấm hình tự động **chỉ được dùng làm cổng** khi nó trùng lựa chọn của chủ dự án ở mức ngưỡng khai trong cấu hình. Mặc định: **≥90% trên ≥20 cặp**.

Chưa đạt thì bộ chấm chỉ **cảnh báo**, không chặn. Ngưỡng nằm trong cấu hình, không nằm trong code — vì nó sẽ phải chỉnh, và chỉnh một dòng cấu hình khác hẳn với chỉnh một dòng code.

## Định dạng một cặp

`docs/visual/pairs/<trục>-<NN>.json`:

```json
{
  "id": "motion-01",
  "axis": "motion",
  "question": "Câu hỏi một dòng, tiếng Việt, không thuật ngữ chưa giải thích",
  "variantA": { "label": "…", "params": { "motionCoverage": 0.95 } },
  "variantB": { "label": "…", "params": { "motionCoverage": 0.55 } },
  "renderRef": null,
  "note": "Điều duy nhất khác nhau giữa A và B"
}
```

`params` là **tham số máy đọc được**, không phải lời mô tả. Đó là thứ nối lựa chọn của người với ngưỡng trong genre pack: chọn A ở cặp này nghĩa là `motionCoverage` 0.95 hơn 0.55, và hai mươi lựa chọn như thế cho ra một ngưỡng.

`renderRef` là `null` cho tới khi có phòng thí nghiệm layout (mục `V-003`). Ở Đợt 0, cặp mô tả bằng tham số và nhãn; từ `V-003` trở đi mỗi cặp kèm hai ảnh thật.

## Trạng thái Đợt 0 — nói thẳng

Đợt 0 giao **bộ công cụ**, không giao kết quả hiệu chuẩn:

| Có | Chưa có |
|---|---|
| Khung tham chiếu tám trục | Ảnh thật để so sánh (chờ `V-003`) |
| Định dạng cặp, máy đọc được | Lựa chọn nào của chủ dự án |
| Script sinh issue, ghi, và tính | Ngưỡng rút ra từ dữ liệu |
| 8 cặp mẫu trên 5 trục cần hiệu chuẩn | Bộ chấm tự động (mục `V-005`) |
| 4 chỉ số chống slide, **đã đo thật** | Ngưỡng của chúng vẫn là **tạm tính** |

Ngưỡng `motionCoverageMin`, `longestStaticRunMsMax`, `textWordsPerSecondMax` hiện đặt theo **suy luận**, và được đánh dấu "tạm tính" ở `reference-frame.md`. Vòng hiệu chuẩn tồn tại để thay chúng bằng số có dữ liệu đằng sau. Chúng đang chặn thật, nên nếu một ngưỡng tạm tính chặn nhầm việc chính đáng thì mở `🤖 [QĐ]` để chỉnh — đừng đi vòng.

Mục `V-004` trong backlog làn `visual` là mục chạy vòng lặp này.

## Một điều bộ công cụ này cố ý không làm

Nó **không** học phong cách từ kênh khác. Corpus đối thủ (mục `T-008`) dùng cho kiểm mới lạ của **luận điểm**, không dùng cho gu hình. Trộn hai thứ đó lại chính là đường dẫn tới rủi ro **A3**: nhiều kênh bị nhận diện là giống nhau.

Gu hình của kênh này được hiệu chuẩn từ **một nguồn duy nhất**: lựa chọn của chủ dự án.
