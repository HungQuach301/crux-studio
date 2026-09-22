# 🤖 Kết quả spike canvas liên tục — mục `visual/V-002`

> File này do `spike/canvas/report.ts` sinh ra từ `measurements.json`. Đừng sửa tay —
> sửa rồi chạy lại bộ đo là mất. Phần nhận định nằm trong chính script đó.

Trả lời câu hỏi của WP-003 và quyết định `D-04`: canvas liên tục 6000×3400 với máy quay
di chuyển có chạy nổi trên runner tiêu chuẩn không, và ở cấu hình nào thì chuyển động
chấp nhận được. Số đo cho giả định **G5** (`docs/assumptions.md`).

## Máy đo

| Hạng mục | Giá trị |
|---|---|
| Nhân | 4 |
| RAM | 16096 MB |
| Node | v22.22.2 |
| Nền | linux-x64 |
| Đo lúc | 2026-09-21T12:31:04.547Z |

⚠️ Đây là **container của phiên cloud**, không phải runner Actions. Nó trùng cấu hình với
`ubuntu-latest` hiện hành về số nhân và RAM, nên số đo dưới đây là cơ sở hợp lý để so với
ngưỡng — nhưng **số phút Actions tính tiền** thì chỉ runner thật mới trả lời được. Workflow
`ops/workflows/spike-canvas.yml` làm đúng việc đó, và nó chỉ chạy được **sau khi PR này
merge vào `main`** rồi `sync-workflows` chép sang `.github/workflows/` (CHARTER 3.2).

## Sáu chỉ số của WP-003

| # | Chỉ số | Ngưỡng | Đo được | Kết |
|---|---|---|---|---|
| 1 | Bộ nhớ đỉnh khi render canvas 6000×3400 | không hết bộ nhớ | **565 MB** đỉnh RSS cả cây tiến trình, trên 16096 MB | ✅ đạt |
| 2 | Thời gian render 5.400 khung ở 1 worker | ≤ 25 phút | **6.4 phút** | ✅ đạt |
| 3 | Chậm hơn render tĩnh cùng số khung | ≤ 3× | **0.94×** tính cả đường ống (71.2 so với 75.6 ms/khung) · **1.25×** tính riêng phần vẽ (3.2 so với 2.5 ms/khung) | ✅ đạt |
| 4 | Chuyển động 30fps **không** mờ | clip xem được | `base-30-noblur.mp4`, 6.4 phút render | ⬜ chờ chủ dự án xem clip |
| 5 | Chuyển động 30fps **có** mờ | clip xem được | `blur-30.mp4`, 8.9 phút render, 4 mẫu/khung | ⬜ chờ chủ dự án xem clip |
| 6 | Chuyển động 60fps **không** mờ | clip xem được | `hi-60-noblur.mp4`, 12.2 phút render | ⬜ chờ chủ dự án xem clip |

**Máy kiểm phép cộng mẫu mờ chuyển động:** độ sáng trung bình của clip có mờ là
**52.62** so với **53.56** của clip không mờ —
lệch -1.8%, ngưỡng ±3% → ✅ đúng là phép trung bình.
Mờ chuyển động là phép trung bình các mẫu phụ nên nó gần như không được đổi độ sáng trung
bình của cảnh. Phép kiểm này có vì bản đầu của spike đã sai đúng chỗ đó — xem phần cuối.

**Chỉ số 4–6 cố ý để trống kết.** WP-003 mục 5 ghi rõ: không kết luận thay chủ dự án về
ba chỉ số này, chỉ xuất clip và số đo. Clip là nhị phân nên không commit (CHARTER 5.3);
chúng đi ra qua artifact `spike-canvas` của workflow.

## Số đo từng cấu hình

| Cấu hình | Khung | fps | Mẫu/khung | Tổng | ms/khung | — cảnh | — chụp | Đỉnh RSS | Clip | Y trung bình |
|---|---|---|---|---|---|---|---|---|---|---|
| `base-30-noblur` | 5400 | 30 | 1 | 6.4 phút | 71.2 | 3.2 | 67.8 | 555 MB | 46.0 MB | 53.56 |
| `static-30` | 5400 | 30 | 1 | 6.8 phút | 75.6 | 2.5 | 72.8 | 551 MB | 1.6 MB | 49.83 |
| `hi-60-noblur` | 10800 | 60 | 1 | 12.2 phút | 67.9 | 2.8 | 64.9 | 565 MB | 51.7 MB | 53.57 |
| `blur-30` | 5400 | 30 | 4 | 8.9 phút | 99.1 | 26.9 | 71.9 | 558 MB | 45.7 MB | 52.62 |

Hai cột `— cảnh` và `— chụp` tách tổng thời gian mỗi khung làm hai phần: thời gian nằm
trong `renderFrame` của cảnh (vẽ thật), và thời gian nằm trong `Page.captureScreenshot`
(lấy khung hình ra khỏi trình duyệt).

## Điều số đo này nói, và điều nó không nói

**Kiến trúc của D-04 không phải chỗ tốn kém.** Vẽ một khung của canvas liên tục mất
3.2 ms, tức 4.4% tổng thời gian mỗi khung.
Phần còn lại, 67.8 ms, là lấy khung hình ra khỏi trình duyệt —
chi phí của **đường ống**, không phải của ngữ pháp chuyển động. Đó là câu trả lời quan trọng
nhất của spike này: nếu số đo có đụng ngưỡng thì chỗ phải tối ưu là cách xuất khung, không
phải "cắt cảnh rời thay vì máy quay di chuyển" — tức là **không** phải viết lại
`motion-grammar`, `visual-quality-bar`, `layouts.json` và prompt dựng cảnh.

**Máy quay di chuyển đắt hơn máy quay đứng yên 1.25× ở phần vẽ**, và
0.94× nếu tính cả đường ống — cả hai đều dưới ngưỡng 3×.

**Tỷ số tổng nhỏ hơn 1, và đó không phải là "máy quay di chuyển rẻ hơn đứng yên".** Nó là
dấu hiệu tỷ số tổng đo sai thứ cần đo: thời gian chụp khung chiếm phần lớn mỗi khung, nó
không dính gì tới máy quay, và nó dao động vài phần trăm giữa hai lần chạy — lớn hơn hẳn
chênh lệch do máy quay gây ra. Con số đáng tin cho chỉ số 3 là tỷ số **riêng phần vẽ**
(1.25×), và kết luận không đổi: còn rất xa ngưỡng 3×.

**Điều số đo này KHÔNG nói.** Ba chỗ, khai trước thay vì để tự phát hiện:

1. **Phút Actions chưa có.** Bảng trên đo trên container phiên cloud. Cần một lần chạy
   `spike-canvas.yml` sau khi PR merge để có số phút tính tiền cho `G5`.
2. **Không phải số đo của thư viện dựng hình.** Spec WP-003 mục 5 chốt một thư viện dựng
   hình React. Chọn nó là chọn nhà cung cấp kèm điều khoản thương mại — nhóm `irreversible`
   số 3 của CHARTER 2.3 — và mục 7c còn đòi ghi lại điều khoản giấy phép, thứ mà bức tường
   mạng (issue #36) không cho đọc. Spike này vì vậy đo canvas 2D trần, **không thêm phụ
   thuộc nào**: kết quả là **cận dưới** cho mọi thư viện dựng trên cùng nền trình duyệt.
   Một thư viện có vòng đời React mỗi khung sẽ cộng thêm vào cột `— cảnh`, và cột đó hiện
   chỉ chiếm 4.4% — còn rất nhiều chỗ trước khi chạm ngưỡng. Việc chốt
   thư viện thuộc mục `A-001`.
3. **Nội dung thật nặng hơn cảnh thử.** Cảnh thử có biểu đồ cột, chữ, lưới và một đoạn
   morph. Một tập thật có nhiều lớp hơn. Ngoại suy theo số khung thì được, theo độ phức
   tạp cảnh thì không.

## Dung lượng artifact — nửa còn lại của G5

Đoạn mẫu 3 phút ở 30fps không mờ nặng **46.0 MB**, tức
khoảng **15.3 MB mỗi phút** ở H.264 CRF 20. Ngoại suy tuyến tính:

| Độ dài | Ước dung lượng |
|---|---|
| 10 phút | ~153 MB |
| 20 phút | ~307 MB |

Đối chứng: cấu hình đứng yên cho clip chỉ 1.6 MB với CÙNG
số khung — chênh lệch đó chính là cái giá của quy tắc "không khung nào đứng yên". Nó là chi
phí lưu trữ có thật, không phải nhiễu đo, và nó thuộc về `G5` cùng với số phút Actions.

## Kịch bản nào đã xảy ra (WP-003 mục 7)

Cả ba chỉ số hiệu năng **đạt**. Theo bảng kịch bản của WP-003, hai nhánh còn mở phụ thuộc
hoàn toàn vào chỉ số 4–6, tức là vào mắt chủ dự án:

- 30fps không mờ chấp nhận được → tiếp Mốc 4 nguyên trạng, **chốt 30fps**;
- 30fps giật nhưng có mờ thì ổn → **chốt 30fps + mờ chuyển động**, nâng mờ chuyển động lên
  ưu tiên 1 trong `cinematography.md` và hạ ngưỡng bật để phủ cả chuyển động trôi chậm;
- chỉ 60fps chấp nhận được → **chốt 60fps**, và cập nhật lại ngân sách render vì số khung
  gấp đôi (đo được: 12.2 phút so với 6.4 phút).

**Kịch bản DỪNG không xảy ra.** Không phải viết lại ngữ pháp chuyển động.

## Một lỗi nhóm Z mà spike này tự đâm phải

Bản đầu cộng các mẫu mờ chuyển động bằng `globalAlpha = 1 / blurSamples` cố định. Nghe
đúng, nhưng `source-over` không cho trung bình cộng: mẫu vẽ sau đè mẫu vẽ trước, nên với
4 mẫu trọng số ra 0.105 / 0.141 / 0.188 / 0.250 thay vì đều nhau, và `(1 - 1/4)^4 = 31.6%`
phần nền tối vẫn lọt qua. Kết quả: clip "có mờ chuyển động" thật ra là clip **tối đi**,
không phải mờ đi — đo được là lệch 15.8% độ sáng.

Đáng chú ý không phải lỗi, mà là **cách nó suýt lọt**: clip vẫn dựng xong, vẫn đủ 5.400
khung, vẫn 180.000 giây, mọi số đo thời gian và bộ nhớ vẫn ra bình thường, `pnpm check`
vẫn xanh. Chỉ số 5 lẽ ra được chấm trên một clip sai. Đúng nhóm **Z** trong
`ops/known-failures.md`: hỏng mà mọi chỉ báo đều xanh.

Đã sửa bằng trung bình chạy (`globalAlpha = 1 / (k + 1)`, trọng số đều nhau, cộng lại bằng
1), và **cột `Y trung bình` cùng phép kiểm ở trên là máy canh chỗ đó từ nay** — không dựa
vào việc lần sau lại có người nhìn kỹ hai khung hình cạnh nhau.

## Chạy lại

```bash
node spike/canvas/run.ts --out spike-out          # cả bốn cấu hình
node spike/canvas/run.ts --out spike-out --config base-30-noblur --frames 60   # đo thử rẻ
node spike/canvas/report.ts --in spike-out        # sinh lại file này
```

Clip không commit vào repo (CHARTER 5.3). Trên Actions chúng nằm trong artifact `spike-canvas`.
