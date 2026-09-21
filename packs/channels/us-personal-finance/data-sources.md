# 🤖 Nguồn dữ liệu — `us-personal-finance`

> Chuyển từ `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `channels/us-personal-finance/data-sources.md`
> (mục `T-002`). Nội dung nghiệp vụ giữ nguyên văn; chỉ tham chiếu được chuyển sang tên thật
> trong repo Crux:
>
> | Trong spec | Ở đây |
> |---|---|
> | `WP-009` | mục backlog `topic/T-001` |
> | `WP-014` | mục backlog `topic/T-008` |
> | `data-series.json` | `packs/channels/us-personal-finance/data-series.json` — **chưa có**, do mục `topic/T-003` tạo |
>
> **Một điều bảng dưới KHÔNG nói** (ghi chú của Crux, không có trong spec): đây là danh sách
> trắng theo **nhà cung cấp**, không phải bằng chứng rằng từng chuỗi cụ thể tồn tại và lấy
> được. Việc ghép từng tham số của từng đề tài với một mã chuỗi cụ thể là mục `topic/T-001`.

## Danh sách trắng

Chỉ dùng nguồn trong bảng này. Nguồn ngoài bảng thì bỏ claim, không thay bằng nguồn tương tự.

### Nhóm 1 — Nguồn có API, dùng được ngay

| Nhà cung cấp | Dùng cho | Biến động | Cần khoá |
|---|---|---|---|
| Cục Dự trữ Liên bang, dữ liệu chuỗi thời gian | Lãi suất, giá nhà, tiết kiệm hộ gia đình | fast / slow | Có |
| Cục Dự trữ Liên bang, kho dữ liệu theo vintage | **Phát hiện chuỗi bị điều chỉnh sau công bố** — công cụ đúng cho R6 | — | Có |
| Cục Thống kê Lao động | Lương, việc làm, chỉ số giá | slow | Có |
| Cục Điều tra Dân số | Thu nhập, nhà ở, dữ liệu theo bang | slow | Có |

### Nhóm 2 — Nguồn không có API, đi qua ảnh chụp biên tập

Xem mục "Ảnh chụp biên tập" dưới đây. Không được để mô hình ngôn ngữ tự đọc trang rồi ghi
thẳng vào kho.

| Nhà cung cấp | Dùng cho | Biến động |
|---|---|---|
| Cơ quan Thuế vụ liên bang | Bậc thuế, giới hạn đóng góp hưu trí | annual-reset |
| Cơ quan Bảo vệ Tài chính Người tiêu dùng | Chi phí vay, khiếu nại | slow |
| Cơ quan thuế của từng bang | **Thuế thu nhập bang — nguyên liệu của Sensitivity Pass toàn bang** | annual-reset |

### Nhóm 3 — Nguồn cần mở rộng, quyết định ở `T-001`

Bốn trong mười hai đề tài khởi đầu cần dữ liệu không có ở nhóm 1 và 2. `T-001` lập bảng và
chủ dự án quyết định: thêm nguồn, hay thay đề tài. **Không đề tài nào được sản xuất khi tham
số của nó chưa có nguồn trong bảng này.**

| Loại dữ liệu còn thiếu | Đề tài bị ảnh hưởng |
|---|---|
| Biểu phí bảo hiểm khoản vay mua nhà | Đề tài 1 |
| Đường cong mất giá xe theo dòng | Đề tài 2 |
| Tỷ lệ chi phí quỹ đầu tư | Đề tài 8 |
| Ngưỡng xét duyệt theo điểm tín dụng | Đề tài 6 |

### Nhóm 4 — Nguồn nhu cầu tìm kiếm

Trục "nhu cầu" chiếm 30/100 điểm trong Topic Scoring, và ở pha 0 tìm kiếm là nguồn người xem
**duy nhất**. Không nhà cung cấp nào ở nhóm 1 và 2 đo được lượng tìm kiếm — nếu bỏ trống, điểm
nhu cầu sẽ phải do mô hình ngôn ngữ ước lượng, vi phạm nguyên tắc "không ước lượng".

Cho tới khi có nguồn thật, Topic Scoring **phải** dùng đại lượng thay thế đo được từ corpus
đối thủ và ghi rõ đây là đại lượng thay thế:

| Đại lượng thay thế | Cách đo |
|---|---|
| Lượt xem trung bình mỗi ngày tuổi của video cùng đề tài | Corpus đối thủ, `T-008` |
| Số video cùng đề tài đăng trong 12 tháng gần nhất | Corpus đối thủ |
| Gợi ý tự động của ô tìm kiếm cho câu hỏi hẹp | Thu thập qua trình duyệt agent, lưu thành ảnh chụp |

Cả ba là **đại lượng thay thế**, không phải phép đo nhu cầu. Mỗi lần dùng phải lưu kèm: ngày
thu thập, vùng và ngôn ngữ, truy vấn đã dùng, và điều đã biết là gây thiên lệch (độ lớn kênh,
tuổi video, quảng bá). Không được trình bày chúng như lượng tìm kiếm.

**Giới hạn phải biết trước khi thiết kế corpus đối thủ:** API của nền tảng **không** cho tải
phụ đề của video người khác — `captions.download` đòi quyền sửa video đó. Corpus vì vậy chỉ có
metadata (tiêu đề, mô tả, thời lượng, lượt xem, ngày đăng), không có nội dung đầy đủ. Kiểm mới
lạ dựa trên metadata là một phép kiểm yếu, và phải được trình bày đúng như vậy.

## Ảnh chụp biên tập — ngoại lệ có kiểm soát

Nguồn nhóm 2 không có API. Quy trình bắt buộc:

1. **Hai lượt trích xuất độc lập** từ cùng tài liệu gốc, dùng **hai nhà cung cấp mô hình khác
   nhau**, không lượt nào thấy kết quả của lượt kia.
2. Khớp trong dung sai → tự động chấp nhận, `enteredBy: machine-dual`.
3. Lệch → mở issue, người quyết định, `enteredBy: human`.
4. Mọi ảnh chụp biên tập lưu `sourceUrl` và `sourceDocumentDate` để đối chiếu lại.

Đây là ngoại lệ có chủ đích của D-08 ("người không tạo nội dung"): người chỉ tham gia khi hai
lượt máy bất đồng.

## Quy tắc

1. **Đọc từ kho ảnh chụp trước.** Chỉ gọi API khi chuỗi cần thiết chưa có ảnh chụp.
2. **Không tìm được số thì bỏ claim.** Không ước lượng, không nội suy.
3. **Ghi rõ cấp địa lý** của mọi claim. Số toàn quốc không được dùng để kết luận cho một bang.
4. **Chuỗi `annual-reset` phải kiểm hạn.** Bậc thuế và giới hạn đóng góp đổi mỗi năm.
   **Luật lô:** một tập dùng chuỗi `annual-reset` phải được phát hành **trong cùng chu kỳ dữ
   liệu** với lúc sản xuất. Lô 10 tập ở Mốc 7 nằm kho qua một mốc đổi năm thuế sẽ kích hoạt
   cảnh báo thay đổi cho cả lô **trước khi** tập nào được đăng — nghĩa là phát hành một danh
   mục sai ngay từ ngày đầu, hoặc làm lại toàn bộ phần định lượng. Cách tránh: đề tài phụ
   thuộc `annual-reset` không được xếp vào lô sản xuất trước, hoặc lô phải phát hành trước
   mốc đổi.
5. **Phân biệt đã điều chỉnh mùa vụ và chưa.** Trộn hai loại là lỗi phổ biến nhất khi dùng
   dữ liệu lao động và giá.
6. **Mã địa lý dùng một quy ước duy nhất** trong toàn hệ thống, khai trong `data-series.json`.

## Cấu hình chuỗi

Danh sách mã chuỗi cụ thể mà adapter được phép lấy nằm ở `data-series.json` trong cùng thư
mục. Adapter **không** được lấy chuỗi ngoài danh sách đó.
