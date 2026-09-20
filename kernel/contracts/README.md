# 🤖 `kernel/contracts` — phong bì và contract v0

**Vùng bảo vệ** (CHARTER mục 3). Thay đổi ở đây chỉ vào `main` qua PR `owner-merge`. Đổi phong bì hoặc đổi ranh giới giữa các xưởng là quyết định `irreversible` (CHARTER 2.3).

## Hai lớp

| File | Là gì |
|---|---|
| `envelope.schema.json` | **Phong bì** — 13 trường của CHARTER 5.2. Đóng (`additionalProperties: false`). Viết MỘT lần, dùng cho cả sáu xưởng. |
| `<xưởng>.payload.v0.schema.json` | **Payload v0** của một xưởng. Để **lỏng**: chỉ trường bắt buộc tối thiểu, cho phép thêm trường. |

Schema đầy đủ của một artifact được **ghép lúc nạp** (`kernel/src/contracts.ts`), không chép tay sáu lần. Nhờ vậy phong bì không thể trôi giữa các xưởng.

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
