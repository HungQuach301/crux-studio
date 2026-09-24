# 🤖 Khuôn tiêu đề — `us-personal-finance`

> Chuyển từ `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `channels/us-personal-finance/title-formulas.md`
> (mục `release/R-001`). Nội dung nghiệp vụ giữ nguyên văn. Bảng dưới đây chỉ có tên khuôn bằng
> tiếng Việt — không phải khoá dữ liệu. Năm `id` tiếng Anh dùng cho validator (kernel đối chiếu
> `titles[].formula`) nằm ở file `title-formulas.json` cạnh đây, **không có trong spec gốc**.

Mỗi tập sinh 5 tiêu đề theo **5 khuôn khác nhau**. Không hai tiêu đề cùng khuôn.

| # | Khuôn | Hình thức | Khi nào hợp |
|---|---|---|---|
| 1 | Ngưỡng | Nêu con số ngưỡng ngay trong tiêu đề | Tập có một ngưỡng rõ ràng |
| 2 | Đảo chiều | Nêu điều kiện làm kết luận thông thường sai | Tập có điểm đảo chiều mạnh |
| 3 | Câu hỏi hẹp | Đúng câu hỏi người xem gõ vào ô tìm kiếm | Đề tài có lượng tìm kiếm rõ |
| 4 | Chi phí ẩn | Nêu con số chi phí mà người ta không tính đến | Tập thuộc archetype chi phí ẩn |
| 5 | So sánh có số | Hai lựa chọn kèm chênh lệch định lượng | Tập so hai phương án |

## Ràng buộc kỹ thuật

- Dưới 60 ký tự để không bị cắt trên thiết bị di động.
- Con số đặt trong 30 ký tự đầu.
- Không viết hoa toàn bộ từ.
- Không dấu chấm than.
- Không hứa điều tập không giao được.

## Chống lặp

Chỉ số biến thiên đo độ tương tự khuôn tiêu đề trên cửa sổ 10 tập. Cùng một khuôn được chọn
quá nhiều lần liên tiếp sẽ đẩy chỉ số về ngưỡng chặn.
