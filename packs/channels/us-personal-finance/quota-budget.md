# 🤖 Ngân sách quota — corpus đối thủ

> Mục backlog `topic/T-008`, spec WP-014 mục 3b. Giả định **G19** (`docs/assumptions.md`).

WP-014 đòi bảng này **lập trước khi viết code xây corpus**, và đòi số trong đó là số **đọc từ Cloud
Console**, không phải số chép từ tài liệu (WP-014 mục 7). Bảng này lập rồi; **số thì chưa đọc được**, và
chỗ khai điều đó không phải dòng này — mà là trường `quota.limits.source` trong chính mỗi ảnh chụp
corpus, khoá ở `vendor-docs` cho tới khi có người mở Console. Ai đọc corpus cũng thấy, kể cả khi chưa
từng mở file này (WP-014 mục 3c: giới hạn nằm trong dữ liệu, không nằm trong ghi chú).

## Bảng hạn mức

| Đại lượng | Giá trị đang dùng | Nguồn | Đã đọc Console chưa |
|---|---|---|---|
| `search.list` — số lần gọi mỗi ngày | 100 | tài liệu nhà cung cấp | ❌ chưa |
| Đơn vị mỗi lần gọi `search.list` | 1 | tài liệu nhà cung cấp | ❌ chưa |
| Phần dự trữ không được đụng (`reserveFraction`) | 0.2 | WP-014 mục 5 (luật của dự án, không phải hạn mức của nhà cung cấp) | — |
| Số lần gọi dùng được mỗi ngày | 80 | dẫn xuất: `100 − ceil(100 × 0,2)` | — |

Bucket của `search.list` **riêng** với bucket của `videos.insert`, nên việc xây corpus không tranh quota
với việc đăng video. Điều đó nghĩa là một corpus chạy quá tay không làm hỏng lịch phát hành — nhưng nó
vẫn tiêu hết phần tìm kiếm của ngày hôm đó.

## Một lần xây corpus tiêu bao nhiêu

Nút thắt là **số lần gọi**, không phải số video: mỗi trang kết quả tiếp theo tốn thêm một lần gọi. Corpus
mẫu `us-personal-finance-2026-09-01` là số đo thật của cơ chế, không phải số ước:

| Đại lượng | Số đo |
|---|---|
| Truy vấn | 5 |
| Trang đã lấy (= số lần gọi) | 10 |
| Video giữ lại | 38 |
| Phần bucket dùng được đã tiêu | 10 / 80 = **12,5 %** |
| Nếu chạy mỗi ngày, một tuần | 70 / 560 = **12,5 %** |

**Corpus mẫu dựng bằng tay, chưa gọi API lần nào** (`provenance: "hand-built"`, xem mục `T-011`). Nên
12,5 % ở trên là số của **cơ chế đếm**, không phải mức tiêu của một lần xây thật. Nó trả lời được câu
"cơ chế có đếm đúng không", không trả lời được câu "một lần xây thật tốn bao nhiêu".

Con số 10 không phải viết tay vào bảng này: `corpusProblems` trong `workshops/topic/src/corpus.ts` đỏ khi
`quota.spent.searchCalls` lệch tổng `pagesFetched`. Bảng và dữ liệu không trôi khỏi nhau được.

## Điều kiện dừng

`quotaGate` (`workshops/topic/src/corpus.ts`) đóng cửa khi phần đã tiêu chạm mốc 80 lần gọi, và trả lý do
thay vì ném lỗi — bản xây corpus phải dừng **sạch** và ghi corpus một phần với `coverage.partial = true`
cộng `partialReason` có chữ (WP-014 mục 5b). Hạ chất lượng truy vấn để lấp cho đủ số video là điều bị
cấm, không phải điều được cân nhắc.

## Còn thiếu gì để bảng này đạt Definition of Done

Đúng một việc, và nó cần người: **mở Google Cloud Console, đọc hạn mức thật của project, rồi thay hai
dòng đầu bảng trên cộng `quota.limits.source` thành `console-measured`.** Hạn mức đã đổi vài lần và tài
liệu bên thứ ba thường lỗi thời, nên tới lúc đó bảng này chỉ là "tài liệu nói vậy". Mục `verify/VF-G19`
giữ phần việc đó.
