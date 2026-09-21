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

| Cấu hình | Độ phân giải | fps | Khung | Tường | Trừ nền giải mã | Khung/s | So thời gian thực | Dung lượng | Đỉnh RSS |
|---|---|---|---|---|---|---|---|---|---|
| `decode-30` | 1920x1080 | 30 | 37.800 | 1.7 phút | — | 373.69 | 12.46× | — | 118 MB |
| `decode-60` | 1920x1080 | 60 | 75.600 | 1.8 phút | — | 705.87 | 11.76× | — | 121 MB |
| `master-30` | 1920x1080 | 30 | 37.800 | 13.1 phút | 11.4 phút | 48.23 | 1.61× | 311 MB | 618 MB |
| `master-60` | 1920x1080 | 60 | 75.600 | 19.3 phút | 17.5 phút | 65.38 | 1.09× | 393 MB | 624 MB |
| `proof-30` | 960x540 | 30 | 37.800 | 4.0 phút | 2.3 phút | 157.39 | 5.25× | 25 MB | 198 MB |
| `proof-60` | 960x540 | 60 | 75.600 | 4.7 phút | 2.9 phút | 266.27 | 4.44× | 29 MB | 204 MB |

Cột **trừ nền giải mã** là giây tường trừ đi lượt `decode-*` cùng tần số khung. Bộ đo lặp
một clip nguồn 20 giây cho đủ thời lượng, nên mỗi lượt phải giải mã lại clip đó; cột này
tách phần giải mã ra thay vì để nó nằm lẫn trong tổng.

⚠️ Ở hai hàng `proof-*` phần còn lại **không** phải mã hoá thuần: bản proof còn hạ độ phân
giải bằng `scale=…:flags=lanczos`, mà lượt nền chạy ở `1920x1080` không có bước đó. Với hai
hàng `master-*` — hai hàng mà quyết định 30/60 đứng trên — độ phân giải trùng đúng lượt nền,
nên ở đó phép trừ cho ra chi phí mã hoá thật.

## 60fps đắt hơn 30fps bao nhiêu — con số mà quyết định nằm trên

| Phép so | 30fps | 60fps | Tỷ lệ |
|---|---|---|---|
| Giây tường | 13.1 phút | 19.3 phút | **1.48×** |
| Trừ nền giải mã | 11.4 phút | 17.5 phút | **1.54×** |
| Dung lượng bản master | 311 MB | 393 MB | **1.26×** |
| Số khung phải sinh (việc của xưởng `visual`) | 37.800 | 75.600 | **2.00×** |

**Gấp đôi số khung KHÔNG làm gấp đôi chi phí dựng: tỷ lệ đo được là 1.48×.**
Lý do nằm trong chính số đo: ở 30fps mỗi khung đắt hơn (48.23 khung/s so với 65.38 khung/s), vì bỏ bớt khung làm chuyển động giữa hai khung liền nhau lớn hơn, và bộ dự đoán
chuyển động phải tìm xa hơn. Hai hiệu ứng ngược chiều nhau và triệt tiêu một phần.

⚠️ **Tỷ lệ này chỉ nói về phần dựng.** Phần **sinh khung** — việc của xưởng `visual`,
đo ở mục `V-002` — theo **mô hình** thì tuyến tính theo số khung, tức là bằng đúng tỷ lệ
số khung ở hàng cuối bảng trên. Đó là mô hình, **chưa đo** (bất biến I6: con số hiển thị
có nguồn **hoặc** có mô hình — đây là vế sau). Tổng chi phí một tập là tổng hai phần, nên
đừng lấy một mình tỷ lệ ở đây làm tỷ lệ của cả tập.

## Ngân sách phút Actions cho phần dựng

Một tập giao gồm **một** bản master cộng **một** bản proof. Actions làm tròn **lên** theo
từng phút **cho mỗi job**, và `ubuntu-latest` có hệ số 1×. Bảng dưới giả định cả hai bản
dựng trong **một** job (đúng như `ops/workflows/render-trial.yml` đang làm), nên làm tròn
một lần trên tổng. Tách thành hai job thì hoá đơn cao hơn — hàng thứ ba cho số đó.

| | 30fps | 60fps |
|---|---|---|
| Giây tường, master + proof | 1023.9 s | 1440.2 s |
| Phút Actions mỗi tập, **một** job | **18** | **25** |
| — nếu tách hai job | 19 | 25 |
| Dung lượng master mỗi tập | 311 MB | 393 MB |
| Phút Actions cho **10** tập mỗi tháng | 180 | 250 |
| Dung lượng master mỗi tháng | 3.0 GB | 3.8 GB |

Nhịp ra tập đọc từ `packs/channels/us-personal-finance/channel.json`, khoá `cadencePerMonth.phase2`
= **10** tập/tháng. Lấy **trần** mà pack khai, không lấy pha hiện tại: ngân sách
tính theo pha thấp thì xanh cho tới đúng lúc hết quota. Pha nào khai bằng chữ thay vì bằng số
thì bị bỏ qua — đoán một con số cho nó là bịa.

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
- **Một mẫu cho mỗi cấu hình, không có độ lệch.** Mỗi cấu hình chạy đúng **một** lượt trên
  một container dùng chung, nên mọi tỷ lệ ở trên đứng trên hai số đơn lẻ và
  `measurements.json` không nói nhiễu là bao nhiêu. Đủ để phân biệt 1,5× với 2×; **không**
  đủ để phân biệt 1,48× với 1,55×. Muốn chặt hơn thì chạy lại vài lượt rồi so.
- **Chưa có phút Actions thật.** Xem cảnh báo ở đầu file.

## ⚠️ `fpsAllowed` là `[30, 60]` — nhưng đường ống chạy 30fps

`workshops/visual/src/index.ts` lấy `limits.fpsAllowed?.[0]`, tức là **phần tử đầu mảng**.
Nên giữ `[30, 60]` **không** có nghĩa là "chưa chọn": mặc định đang chạy là **30fps**, chọn
bằng thứ tự mảng chứ không bằng bằng chứng. Giữ cả hai nghĩa là **giữ quyền đổi**.

Hệ quả phải biết: nếu `V-002` kết luận 30fps giật, thì mọi thứ sinh ra trong lúc chờ đã ở
30fps. Đó là lý do `A-001` dán số rồi mở `🤖 [QĐ]` ngay, thay vì để câu hỏi treo im lặng.

