# 🤖 Sổ giấy phép asset

Bắt đầu từ **asset đầu tiên** (CHARTER mục 8). Rủi ro **A6**: giấy phép không dùng được cho B2B chỉ lộ ra khi đã muộn — lúc có khách hàng, không phải lúc chọn asset.

Mỗi dòng ghi đủ bốn điều, và điều thứ tư là điều hay bị bỏ qua:

1. **Nguồn** — nhà cung cấp, và định danh cụ thể của asset.
2. **Điều khoản** — trích dẫn, kèm **ngày đọc**. Không tóm tắt bằng trí nhớ.
3. **Dùng thương mại được không.**
4. **Giao lại cho khách hàng B2B được không** — quyền dùng thương mại **không** đồng nghĩa với quyền giao lại.

| Asset | Loại | Nguồn | Điều khoản (ngày đọc) | Thương mại | B2B / giao lại | Mục backlog |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

Chưa có dòng nào: Đợt 0 chưa dùng asset thật nào. Giọng đọc stub là `provider: "stub"`, và `commercialLicenseVerified: false` — đó là trạng thái đúng, không phải một ô bỏ trống.

## Luật

- Asset chưa có dòng trong sổ này thì **không được dùng trong tập thật**. Stub thì được, và phải khai `false`.
- Chọn giọng đọc hoặc asset có điều khoản thương mại là quyết định **`irreversible`** (CHARTER 2.3): mở `🤖 [QĐ]`, không tự chọn.
- Điều khoản đổi thì thêm một dòng mới với ngày đọc mới, **không sửa dòng cũ**. Lịch sử là thứ cần khi có tranh chấp.
- Font, bản đồ, ảnh stock, nhạc nền, và mô hình TTS đều là asset. Giả định **G7** phủ cả bốn.

---

## Khảo sát `VF-G7` — điều khoản nhà cung cấp, trước khi có asset đầu tiên

> 🤖 **Đang chạy.** Mục `VF-G7` của làn `verify` kiểm giả định **G7**. Phạm vi: bốn loại asset mà G7 phủ — giọng đọc (TTS), ảnh/video stock, font, bản đồ.
>
> **Cách làm:** với mỗi nhà cung cấp, đọc trang điều khoản chính thức và trích dẫn **nguyên văn** đoạn trả lời đúng hai câu hỏi, kèm **ngày đọc** và link. Không tóm tắt bằng trí nhớ, không suy từ trang giới thiệu sản phẩm.
>
> **Hai câu hỏi, và câu thứ hai mới là câu khó:**
> 1. Dùng **thương mại** được không (kênh YouTube có doanh thu)?
> 2. **Giao lại cho khách hàng B2B** được không (sublicense / redistribution trong sản phẩm giao cho bên thứ ba)?
>
> Khảo sát này **không chọn** nhà cung cấp nào. Chọn là quyết định `irreversible` (CHARTER 2.3) — chủ dự án duyệt trên một issue riêng.
