# 🤖 Kiếm tiền — `us-personal-finance`

> Chuyển từ `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `channels/us-personal-finance/monetization.md`
> (mục `release/R-001`). Nội dung nghiệp vụ giữ nguyên văn.

## Hàm mục tiêu

```
Doanh thu nền tảng trong kỳ = (lượt xem đủ điều kiện ghi nhận trong kỳ ÷ 1.000) × RPM hiệu dụng
Lợi nhuận đóng góp        = doanh thu nền tảng + doanh thu khác thực nhận − chi phí biến đổi
Lợi nhuận đầy đủ          = lợi nhuận đóng góp − chi phí cố định − giá trị thời gian người
```

**Số điểm chèn quảng cáo không phải một hệ số nhân.** RPM đã là doanh thu trên mỗi nghìn lượt
xem sau chia sẻ; nhân thêm số điểm chèn là đếm ảnh hưởng quảng cáo hai lần. Điểm chèn ảnh
hưởng RPM một cách gián tiếp, qua số quảng cáo thực sự được phục vụ, và mức ảnh hưởng đó phải
đo chứ không giả định.

Ba biến thật sự điều khiển được: **số tập** (bị chặn bởi tốc độ Thesis Engine), **lượt xem mỗi
tập**, và **RPM theo trụ nội dung**. Chúng không cùng có hiệu lực ở mọi giai đoạn.

## Cổng nền tảng — điều phải hiểu trước mọi thứ khác

Trước khi vào chương trình đối tác của nền tảng, doanh thu quảng cáo bằng **không**, bất kể
video hay đến đâu.

Ngưỡng với người nộp đơn mới từ tháng 2/2027: **1.000 người đăng ký cộng 8.000 giờ xem trong
365 ngày** — gấp đôi mức trước đó.

```
8.000 giờ = 480.000 phút
Ở thời lượng xem trung bình 6 phút → khoảng 80.000 lượt xem tích luỹ
```

Tức là cần một khối lượng lưu lượng tương đương cả tháng vận hành ở điểm hoà vốn, tích luỹ
trong giai đoạn kênh yếu nhất.

## Thứ tự ưu tiên doanh thu — đảo theo pha

| Pha | Thứ tự | Lý do |
|---|---|---|
| Trước cổng nền tảng | **Liên kết → Email → Quảng cáo** | Quảng cáo chưa tồn tại. Hai nguồn còn lại là nguồn duy nhất |
| Sau cổng nền tảng | **Quảng cáo → Liên kết → Email** | Quảng cáo scale theo sản lượng |

Đây là sửa chữa quan trọng: xếp quảng cáo lên đầu ngay từ pha một là tối ưu cho một biến chưa
tồn tại, trong suốt giai đoạn dài nhất và tốn kém nhất.

## Đơn vị kinh tế cấp tập

Con số phải theo dõi, quan trọng hơn hoà vốn theo tháng:

```
Hoà vốn một tập  = chi phí biến đổi ÷ doanh thu mỗi 1.000 lượt × 1.000
Hoà vốn một tháng = (chi phí biến đổi × số tập + chi phí cố định) ÷ RPM × 1.000
```

**Không điền một con số RPM giả định vào đây.** Một RPM không có nguồn là đúng thứ tài liệu
này cấm ở nguyên tắc số 6. Hai kịch bản RPM có nguồn được điền ở `12-success-criteria.md`
Tầng 5 sau khi đo thật ở Mốc 7.

Điểm phải nhớ khi điền: công thức theo tháng **bắt buộc cộng chi phí cố định**. Bỏ nó ra thì
con số hoà vốn trông nhỏ hơn thực tế nhiều lần. Và nếu lượt xem trung bình mỗi tập ổn định ở
mức làm hoà vốn tháng không đạt được ở nhịp bền vững, nhà máy chạy hoàn hảo vẫn lỗ vĩnh viễn.

## Bốn biến — làm gì với từng biến

**1 · Số tập.** Bị chặn bởi tốc độ Thesis Engine. Không ép.

**2 · Lượt xem mỗi tập.** Đòn bẩy chính ở giai đoạn đầu, và nó phụ thuộc việc chọn đề tài
hẹp — xem `topic-map.md`.

**3 · Số điểm chèn quảng cáo.** Sinh tự động từ vị trí cầu tò mò. Nhưng **đặt lên nền tảng là
thao tác tay** — không có API cho việc này với kênh thường. Nằm ở bước vận hành sau đăng,
khoảng 3–5 phút mỗi tập.

**4 · Doanh thu mỗi 1.000 lượt.** Phụ thuộc trụ nội dung. Trục này đã được đưa vào chấm điểm
đề tài với trọng số 30%.

## Thuế và danh tính

Nhận doanh thu đòi hỏi danh tính pháp lý thật, địa chỉ và mã số thuế. Người không cư trú tại
Mỹ phải nộp mẫu khai thuế phù hợp, nếu không sẽ bị khấu trừ ở mức cao nhất. Thu nhập từ nước
ngoài còn có nghĩa vụ thuế tại nơi cư trú — cần xử lý riêng, không thuộc phạm vi repo này.
