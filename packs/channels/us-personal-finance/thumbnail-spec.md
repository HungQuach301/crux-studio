# 🤖 Đặc tả thumbnail — `us-personal-finance`

> Chuyển từ `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `channels/us-personal-finance/thumbnail-spec.md`
> (mục `release/R-001`). Nội dung nghiệp vụ giữ nguyên văn.

## Bốn ô cố định

| Ô | Nội dung | Chiếm chỗ |
|---|---|---|
| 1 | Con số lớn nhất của tập | ~45% |
| 2 | Từ nhấn, tối đa 3 từ | ~20% |
| 3 | Hình minh hoạ đơn giản, không chữ | ~25% |
| 4 | Khoảng trống | ~10% |

## Không dùng linh vật, không dùng mặt người

Lý do: linh vật và mặt người là tín hiệu "kênh giải trí". Kênh này bán độ tin cậy của phân
tích. Một con số lớn và rõ làm việc đó tốt hơn.

Lý do thứ hai: linh vật nhất quán qua hàng trăm tập là một dạng khuôn mẫu, và khuôn mẫu là
đúng thứ cần tránh.

## Bài kiểm bắt buộc

Thu nhỏ về kích thước hiển thị nhỏ nhất trên danh sách đề xuất di động. Nếu không đọc được
con số ở kích thước đó, thumbnail chưa đạt — bất kể nó đẹp thế nào ở kích thước đầy đủ.

## Ba biến thể

Mỗi tập sinh 3 biến thể, khác nhau ở **từ nhấn** và ở **loại hình minh hoạ**, không chỉ khác
màu. Nạp cả ba vào thử nghiệm của nền tảng — thao tác tay ở bước vận hành sau đăng.
