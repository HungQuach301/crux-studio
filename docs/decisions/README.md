# 🤖 Quyết định `D-Cxx`

Thư mục này là **nguồn thẩm quyền số hai** (CHARTER mục 0): dưới `CHARTER.md`, trên spec tham chiếu. Mục sau thay mục trước khi mâu thuẫn.

| Mã | Nội dung | Ở đâu |
|---|---|---|
| `D-C01` | Chỉ hai PAT được phép, mỗi PAT một repo, quyền tối thiểu | CHARTER 3.2 |
| `D-C02` | Điều chỉnh D-18: ca kiểm mô hình lấy từ nguồn độc lập | CHARTER 12, mặc định M7 |
| `D-C03` | chưa dùng | — |
| `D-C04` | Log tách tới mức mục: `ops/logs/<lane>/<id>.jsonl`, sửa bất biến I8 | [`D-C04.md`](D-C04.md) |
| `D-C05` | chưa dùng | — |
| `D-C06` | Chế độ vận hành 1–2 lần mỗi ngày: phân loại lại quyết định, thu hẹp `owner-merge`, một hộp quyết định duy nhất | [`D-C06.md`](D-C06.md) |

`D-C01` và `D-C02` được ghi thẳng trong `CHARTER.md` từ trước khi có thư mục này. Chúng **không** được chép lại ở đây: một nội dung hai chỗ là một nội dung sẽ lệch. Từ `D-C06` trở đi, mỗi quyết định là một file — `D-C04` mang số nhỏ hơn nhưng được chốt sau `D-C06`, nên nó cũng có file riêng.

Thư mục này nằm trong vùng bảo vệ. Từ `D-C06`, PR chạm nó mang nhãn `automerge-delayed` chứ không còn là `owner-merge`.
