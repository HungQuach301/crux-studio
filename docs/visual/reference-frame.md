# 🤖 Khung tham chiếu gu hình

Mục đích: cho chủ dự án và máy **cùng một bộ từ vựng** để nói về hình ảnh, trước khi có bất kỳ ảnh nào để nhìn.

Không có khung này thì vòng hiệu chuẩn (CHARTER 6.8b) chỉ thu được "tôi thích A hơn" — một dữ liệu không dạy được máy điều gì. Có khung này, mỗi lựa chọn A/B nói được **lựa chọn đó thuộc trục nào**, và nhiều lựa chọn trên cùng một trục gộp lại thành một ngưỡng.

## Luật bản quyền của tài liệu này

Khung này **mô tả và phân tích**. Nó không chứa, không chép, không dẫn lại tài sản có bản quyền:

- **Không** nhúng khung hình, ảnh chụp màn hình, hay đoạn video của kênh nào khác.
- **Không** chép bảng màu, font, hay hệ thống layout của một thương hiệu cụ thể.
- **Không** đặt tên kênh hay tên studio làm nhãn của một trục ("kiểu kênh X"). Một nhãn như vậy biến khung phân tích thành bản mô tả cách sao chép ai đó.
- **Có** mô tả các thuộc tính hình ảnh ở mức có thể **đo được** — tỷ lệ thời lượng có chuyển động, số từ trên giây, cỡ cảnh. Các thuộc tính đó là sự thật về vật lý của khung hình, không phải tài sản của ai.

Corpus đối thủ (mục `T-008`) phục vụ việc **kiểm mới lạ của luận điểm**, không phải việc học phong cách hình. Hai thứ đó không được trộn vào nhau. Rủi ro **A3** — chính sách "inauthentic content" và việc nhiều kênh bị nhận diện là giống nhau — nằm đúng ở chỗ trộn.

## Tám trục

Mỗi trục có một đầu **đo được bằng máy** và một đầu **chỉ người chấm được**. Vòng hiệu chuẩn tồn tại để tìm ngưỡng cho đầu thứ nhất, bằng dữ liệu từ đầu thứ hai.

### Trục 1 · Nhịp — `pacing`

| | |
|---|---|
| **Câu hỏi** | Khung hình đổi nhanh hay chậm, và đổi đều hay so le? |
| **Máy đo** | Thời lượng trung vị mỗi scene · độ lệch chuẩn / trung bình · quãng liên tục dài nhất của scene ngắn |
| **Người chấm** | Cảm giác hối thúc so với cảm giác lê thê |
| **Đã có ngưỡng** | `sceneMinDurationMs`, `sceneDurationStdDevMinRatio`, `maxConsecutiveScenesUnder2s`, `sceneMaxDurationMs` |

Nhịp đều đặn là nhịp chết. Đây là trục duy nhất đã có ngưỡng đầy đủ trước khi hiệu chuẩn, vì nó đo được trực tiếp và spec tham chiếu đã chốt con số.

### Trục 2 · Chuyển động — `motion`

| | |
|---|---|
| **Câu hỏi** | Khung hình sống hay đứng? Máy quay di chuyển có lý do hay di chuyển cho có? |
| **Máy đo** | `motionCoverage` (tỷ lệ **thời lượng** có chuyển động) · `longestStaticRunMs` · `staticSceneCount` |
| **Người chấm** | Chuyển động phục vụ nội dung, hay chỉ để lấp chỗ trống |
| **Đã có ngưỡng** | `motionCoverageMin`, `longestStaticRunMsMax` — **tạm tính, chờ hiệu chuẩn** |

Ngưỡng hiện tại đặt theo suy luận, không theo dữ liệu. Vòng hiệu chuẩn phải trả lời: người xem chịu được quãng tĩnh dài bao nhiêu trước khi nó thành slide.

### Trục 3 · Mật độ chữ — `text-density`

| | |
|---|---|
| **Câu hỏi** | Bao nhiêu chữ trên màn hình là đủ, và bao nhiêu là bắt người xem đọc thay vì xem? |
| **Máy đo** | `onScreenWordsMaxPerScene` · `textWordsPerSecond` trên cả tập |
| **Người chấm** | Chữ dẫn mắt, hay chữ cạnh tranh với hình |
| **Đã có ngưỡng** | `onScreenWordsMaxPerScene: 12`, `textWordsPerSecondMax` — **tạm tính** |

Hai chỉ số bắt hai lỗi khác nhau: trần mỗi scene bắt một khung quá tải; chỉ số trên giây bắt trường hợp **mọi scene đều dưới trần** nhưng cả tập vẫn dày đặc chữ.

### Trục 4 · Cỡ cảnh và khoảng cách — `shot-size`

| | |
|---|---|
| **Câu hỏi** | Bao nhiêu phần là toàn cảnh, bao nhiêu phần là cận? |
| **Máy đo** | Phân bổ `wide` / `medium` / `close` / `detail` so với `shotSizeMix` của genre pack |
| **Người chấm** | Cảm giác có chiều sâu, so với cảm giác phẳng |
| **Đã có ngưỡng** | `shotSizeMix` với `tolerance: 0.08` |

### Trục 5 · Thứ bậc thị giác — `hierarchy`

| | |
|---|---|
| **Câu hỏi** | Mắt biết nhìn đâu trước không? |
| **Máy đo** | Chưa đo được. Ứng viên: số phần tử ngang hàng trong một khung, tỷ lệ diện tích của phần tử chính |
| **Người chấm** | **Đây là trục chính người chấm** — máy chưa thay được |
| **Đã có ngưỡng** | chưa |

### Trục 6 · Tương phản và màu — `contrast`

| | |
|---|---|
| **Câu hỏi** | Chữ đọc được trên điện thoại không? Màu có ý nghĩa hay chỉ để trang trí? |
| **Máy đo** | Tỷ số tương phản (WCAG) · số màu trong một khung · màu có nằm trong `visual-tokens.json` của kênh không |
| **Người chấm** | Bảng màu có bản sắc, hay là bảng màu mặc định của công cụ |
| **Đã có ngưỡng** | chưa — chờ `visual-tokens.json` ở mục `V-001` |

Phần tương phản đo được bằng máy **không chờ hiệu chuẩn**: chữ không đọc được trên điện thoại là lỗi, không phải sở thích.

### Trục 7 · Tỷ lệ dữ-liệu-trên-mực — `data-ink`

| | |
|---|---|
| **Câu hỏi** | Bao nhiêu phần của khung hình đang chở thông tin, bao nhiêu phần là trang trí? |
| **Máy đo** | Chưa đo được. Ứng viên: tỷ lệ pixel thuộc phần tử mang dữ liệu |
| **Người chấm** | Biểu đồ nói được điều nó cần nói mà không cần chú thích dài |
| **Đã có ngưỡng** | chưa |

Trục đặc thù của thể loại `data-explainer`. Với thể loại khác nó có thể không tồn tại.

### Trục 8 · Nhận diện riêng — `identity`

| | |
|---|---|
| **Câu hỏi** | Nhìn một khung hình có biết đây là kênh nào không? |
| **Máy đo** | Chỉ số biến thiên giữa các tập, **và giữa các kênh** |
| **Người chấm** | Có bản sắc, hay trông như mọi kênh khác |
| **Đã có ngưỡng** | chưa |

Trục này phục vụ rủi ro **A3** trực tiếp. Chỉ số biến thiên phải đo **cả giữa các kênh**, không chỉ giữa các tập của một kênh — nếu không, hai kênh có thể cùng nhất quán nội bộ mà vẫn giống hệt nhau.

## Bảng tổng

| # | Trục | Máy đo được | Có ngưỡng | Nguồn ngưỡng |
|---|---|---|---|---|
| 1 | `pacing` | đầy đủ | ✅ | spec tham chiếu |
| 2 | `motion` | đầy đủ | ⚠️ tạm tính | **cần hiệu chuẩn** |
| 3 | `text-density` | đầy đủ | ⚠️ tạm tính | **cần hiệu chuẩn** |
| 4 | `shot-size` | đầy đủ | ✅ | spec tham chiếu |
| 5 | `hierarchy` | chưa | ❌ | **cần hiệu chuẩn** |
| 6 | `contrast` | một phần | ❌ | WCAG + `V-001` |
| 7 | `data-ink` | chưa | ❌ | **cần hiệu chuẩn** |
| 8 | `identity` | một phần | ❌ | **cần hiệu chuẩn** |

Năm trục cần hiệu chuẩn. Quy trình ở `docs/visual/calibration.md`.

## Vì sao khung này có tám trục chứ không phải một điểm số

Một điểm "đẹp 7/10" không sửa được gì. Một kết quả "trục `motion` dưới ngưỡng ở beat 4–6" chỉ thẳng vào việc phải làm.

Đó cũng là lý do Preflight ghi **giá trị đo được** vào artifact kể cả khi đạt ngưỡng: chất lượng hình không hỏng đột ngột, nó trôi dần (rủi ro **B8**). Chỉ có chuỗi số qua nhiều tập mới thấy được nó trôi.
