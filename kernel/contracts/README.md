# 🤖 `kernel/contracts` — phong bì và contract v0

**Vùng bảo vệ** (CHARTER mục 3). Thay đổi ở đây chỉ vào `main` qua PR `owner-merge`. Đổi phong bì hoặc đổi ranh giới giữa các xưởng là quyết định `irreversible` (CHARTER 2.3).

## Ba lớp

| File | Là gì |
|---|---|
| `envelope.schema.json` | **Phong bì** — 13 trường của CHARTER 5.2. Đóng (`additionalProperties: false`). Viết MỘT lần, dùng cho cả sáu xưởng. |
| `<xưởng>.payload.v0.schema.json` | **Payload v0** của một xưởng. Để **lỏng**: chỉ trường bắt buộc tối thiểu, cho phép thêm trường. |
| `layouts.schema.json`, `visual-tokens.schema.json` (mục `V-001`) | Cấu trúc file cấu hình trong `packs/` — **không** phải payload artifact. Genre/channel-trung tính (đúng với mọi genre/channel), nên vẫn thuộc kernel dù nội dung chúng validate (`packs/genres/*/layouts.json`, `packs/channels/*/visual-tokens.json`) là hằng số nội dung. Đóng (`additionalProperties: false`), cộng trường `$note` cho ghi chú xuất xứ của agent — spec gốc không khai `$note`, đây là chỗ lệch có chủ ý so với spec (xem `kernel/src/packs.ts`). |

Schema đầy đủ của một artifact được **ghép lúc nạp** (`kernel/src/contracts.ts`), không chép tay sáu lần. Nhờ vậy phong bì không thể trôi giữa các xưởng.

`layouts.json`/`visual-tokens.json` nạp và validate qua `loadGenreLayouts`/`loadChannelVisualTokens` (`kernel/src/packs.ts`), khác với `loadGenrePack`/`loadChannelPack` (đọc `format-spec.json`/`channel.json`) — hai hàm đó **chưa** validate theo schema đầy đủ, chỉ đối chiếu `genre`/`slug` với tên thư mục. Đây là một khoảng trống có từ trước `V-001`, ngoài phạm vi mục này.

## Phiên bản

- `schemaVersion` hiện tại: **`0`**.
- Siết payload lại **sau tập thật đầu tiên**, bằng cách tăng `schemaVersion` — không phải bằng cách sửa v0 tại chỗ.
- Bên tiêu thụ phải hỗ trợ đồng thời phiên bản **N và N-1** (`isSupportedSchemaVersion`).

## Bất biến được thực thi ngay trong contract

| Bất biến | Ở đâu |
|---|---|
| **I5** — máy không công khai video | `release`: `publication.visibility` khoá `const: "private"` |
| **I6** — mọi con số có nguồn hoặc có mô hình | `topic`: `claims[].evidence.kind` chỉ nhận `source` hoặc `model`; `visual`: `claimIds` trên scene hiển thị số |
| **I8** — mọi lần chạy ghi `costUsd` | Phong bì: `costUsd` bắt buộc |
| Gắn nhãn nội dung tổng hợp (A3) | `release`: `disclosure` khoá `const: true` |

## Nguồn gợi ý payload

Lấy từ `docs/spec/CRUX-REFERENCE-SPEC.md` (phần `engine/contracts/`), theo bảng chuyển đường dẫn ở đầu spec:

| Xưởng | Schema nguồn trong spec |
|---|---|
| `topic` | `topics`, `sources`, `brief` |
| `editorial` | `outline`, `script` |
| `visual` | `storyboard`, `canvas-map` |
| `audio` | `timing` |
| `assembly` | `preflight`, `render-manifest`, `qa-report` |
| `release` | `package`, `publication`, `metrics` |

Ngưỡng **không** nằm trong contract. Ngưỡng nằm trong `packs/genres/<genre>/format-spec.json`, để cùng một contract dùng được cho thể loại thứ hai.

## Kiểm

```bash
pnpm contracts   # tự kiểm bộ schema + validate mọi fixture và snapshot tập vàng
```

`pnpm contracts` chặn schema nào dùng từ khoá mà validator của kernel chưa hiểu. Lý do: một ràng buộc được viết ra nhưng không được kiểm còn tệ hơn là không viết.

Từ `V-001`, `pnpm contracts` cũng validate mọi `layouts.json` và `visual-tokens.json` đã tồn tại trong `packs/` — genre/channel nào chưa có file đó thì bỏ qua, không phải lỗi.
