# 🤖 Thử nghiệm engine dựng — mục `assembly/A-001`

> File này được **sinh ra**, đừng sửa tay — phần nhận định nằm trong
> `ops/scripts/render-trial.ts`, không nằm ở đây. Dựng lại bằng:
>
> ```bash
> node ops/scripts/render-trial.ts --report \
>   --from docs/assembly/render-trial.measurements.json \
>   --to docs/assembly/render-trial.md
> ```
>
> Đo lại từ đầu (hàng chục phút): `node ops/scripts/render-trial.ts --out <thư mục>`.

Trả lời câu hỏi của `A-001`: **30fps hay 60fps**, và một tập đầy đủ tốn bao nhiêu
thời gian dựng, dung lượng, phút Actions. Số đo cho giả định **G5**
(`docs/assumptions.md`).

## Máy đo

| Hạng mục | Giá trị |
|---|---|
| Nhân | 4 |
| RAM | 16096 MB |
| Node | v22.22.2 |
| Nền | linux-x64 |
| ffmpeg | ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers |
| Đo lúc | 2026-09-21T23:40:00.335Z |
| Thời lượng tập (genre pack `data-explainer`) | 1.260.000 ms = 21 phút |
| Thời lượng đã dựng mỗi lượt | 21.0 phút — **tập đầy đủ** |

⚠️ Đây là **container của phiên cloud**, không phải runner Actions. Nó trùng cấu hình
`ubuntu-latest` hiện hành về số nhân và RAM, nên số giây tường dưới đây là cơ sở hợp lý —
nhưng **phút Actions tính tiền** thì chỉ runner thật mới trả lời được.
`ops/workflows/render-trial.yml` làm đúng việc đó, và nó chỉ chạy được **sau khi** PR này
merge vào `main` rồi `sync-workflows` chép sang `.github/workflows/` (CHARTER 3.2, **G10**).

## Số đo

| Cấu hình | Độ phân giải | fps | Khung | Tường | Mã hoá thuần | Khung/s | So thời gian thực | Dung lượng | Đỉnh RSS |
|---|---|---|---|---|---|---|---|---|---|
| `decode-30` | 1920x1080 | 30 | 37.800 | 1.7 phút | — | 373.69 | 12.46× | — | 118 MB |
| `decode-60` | 1920x1080 | 60 | 75.600 | 1.8 phút | — | 705.87 | 11.76× | — | 121 MB |
| `master-30` | 1920x1080 | 30 | 37.800 | 13.1 phút | 11.4 phút | 48.23 | 1.61× | 311 MB | 618 MB |
| `master-60` | 1920x1080 | 60 | 75.600 | 19.3 phút | 17.5 phút | 65.38 | 1.09× | 393 MB | 624 MB |
| `proof-30` | 960x540 | 30 | 37.800 | 4.0 phút | 2.3 phút | 157.39 | 5.25× | 25 MB | 198 MB |
| `proof-60` | 960x540 | 60 | 75.600 | 4.7 phút | 2.9 phút | 266.27 | 4.44× | 29 MB | 204 MB |

Cột **mã hoá thuần** là giây tường trừ đi lượt `decode-*` cùng tần số khung. Bộ đo lặp một
clip nguồn 20 giây cho đủ thời lượng, nên mỗi lượt phải giải mã lại clip đó; cột này tách
phần giải mã ra thay vì để nó nằm lẫn trong tổng.

## 60fps đắt hơn 30fps bao nhiêu — con số mà quyết định nằm trên

| Phép so | 30fps | 60fps | Tỷ lệ |
|---|---|---|---|
| Giây tường | 13.1 phút | 19.3 phút | **1.48×** |
| Mã hoá thuần | 11.4 phút | 17.5 phút | **1.54×** |
| Dung lượng bản master | 311 MB | 393 MB | **1.26×** |
| Số khung phải sinh (việc của xưởng `visual`) | 37.800 | 75.600 | **2,00×** |

**Gấp đôi số khung KHÔNG làm gấp đôi chi phí dựng: tỷ lệ đo được là 1.48×.**
Lý do nằm trong chính số đo: ở 30fps mỗi khung đắt hơn (48.23 khung/s so với 65.38 khung/s), vì bỏ bớt khung làm chuyển động giữa hai khung liền nhau lớn hơn, và bộ dự đoán
chuyển động phải tìm xa hơn. Hai hiệu ứng ngược chiều nhau và triệt tiêu một phần.

⚠️ **Tỷ lệ này chỉ nói về phần dựng.** Phần **sinh khung** — việc của xưởng `visual`,
đo ở mục `V-002` — đúng là tuyến tính theo số khung, tức là **2,00×**. Tổng chi phí một
tập là tổng hai phần, nên đừng lấy một mình tỷ lệ ở đây làm tỷ lệ của cả tập.

## Ngân sách phút Actions cho phần dựng

Một tập giao gồm **một** bản master cộng **một** bản proof. Actions làm tròn **lên**
theo từng phút cho mỗi job, và `ubuntu-latest` có hệ số 1×.

| | 30fps | 60fps |
|---|---|---|
| Giây tường, master + proof | 1024 s | 1440 s |
| Phút Actions mỗi tập | **18** | **25** |
| Phút Actions cho 4 tập mỗi tháng | 72 | 100 |
| Dung lượng master mỗi tập | 311 MB | 393 MB |

Chỉ là **phần dựng**. Phần **sinh khung** của xưởng `visual` (đo ở mục `V-002`) cộng
thêm vào, và theo hình dạng đường ống thì đó mới là phần lớn — nhưng con số của nó
thuộc `V-002`, không thuộc bộ đo này, nên ở đây không chép lại. Ngân sách **G5** phải
cộng cả hai phần; lấy một mình bảng trên làm ngân sách là tính thiếu.

## Điều số đo này không nói

- **Không phải khung thật.** Xưởng `visual` còn ở `impl: stub`, nên clip nguồn là một
  cảnh mô phỏng: nền chuyển sắc động, lưới mảnh, biểu đồ cột đổi liên tục, chữ cạnh sắc,
  máy quay trôi chậm không khung nào đứng yên. Nó dựng đúng **hình dạng đắt** của thể loại
  `data-explainer`, nhưng bitrate của tập thật sẽ khác. Vì vậy báo cáo ghi cả **tốc độ**
  (khung/s, MB) chứ không chỉ tổng: chạy lại bộ đo với khung thật là ra số mới.
- **Clip nguồn được lặp.** Nội dung lặp lại mỗi 20 giây. Bộ mã hoá không tham chiếu xa
  tới thế nên chi phí mỗi GOP vẫn đúng, nhưng một tập thật không lặp — con số dung lượng
  là cận dưới lỏng, không phải cận trên.
- **Không đo chất lượng nhìn được.** `A-001` hỏi chi phí; câu hỏi "30fps có giật không"
  thuộc mục `visual/V-002` (chỉ số 4–6 của WP-003), và nó là việc của mắt người, không
  phải của bộ đo. **Quyết định fps phải đọc cả hai**: bảng ở đây nói 60fps đắt bao nhiêu,
  `V-002` nói 30fps có giật hay không. Chọn theo một mình bảng này là chọn thiếu một nửa.
- **Chưa có phút Actions thật.** Xem cảnh báo ở đầu file.

