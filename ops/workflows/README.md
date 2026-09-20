# 🤖 `ops/workflows` — nơi agent viết workflow

**Vùng bảo vệ** (CHARTER mục 3). Chỉ vào `main` qua PR `owner-merge`.

## Vì sao workflow không nằm thẳng trong `.github/workflows/`

Phiên cloud của Claude có thể không có quyền push file trong `.github/workflows/` (**giả định G10**, có báo lỗi công khai). Vì vậy:

1. Agent viết workflow vào **`ops/workflows/*.yml`**.
2. Chủ dự án tạo **một lần** `.github/workflows/sync-workflows.yml`, dùng secret `WORKFLOW_SYNC_TOKEN` — một fine-grained PAT chỉ cho repo này, quyền Contents và Workflows ở mức read/write (**D-C01**).
3. Khi `main` đổi trong `ops/workflows/**`, workflow sync chép các file sang `.github/workflows/`.

**Hệ quả phải nhớ:** workflow ở đây **chỉ có hiệu lực sau khi PR merge vào `main`** và sync chạy xong. Nó không chạy trên nhánh PR. Đừng chờ nó.

**Hệ quả thứ hai:** một lỗi cú pháp ở đây không hiện ra trên PR — nó hiện ra trên `main`. Đó là lý do `pnpm lint:workflows` tồn tại và nằm trong `pnpm check`.

PAT có hạn dùng. Khi nó hết hạn, sync **im lặng** dừng: không có gì đỏ, chỉ là không có gì xảy ra. `watchdog.yml` canh riêng trường hợp này (rủi ro B13).

## Các workflow

| File | Kích hoạt | Việc | Bất biến |
|---|---|---|---|
| `ci.yml` | `pull_request` → `main` | `check` · `secret-scan` · `fix-has-test` · `protected-area` · `trailer-warn` | I1, I2, I3, I4 |
| `automerge.yml` | `workflow_run` sau `ci` | Merge squash khi thoả **đủ bốn** điều kiện, rồi gọi `main-ci` | I2, I4 |
| `main-ci.yml` | `automerge` gọi · push `main` · mỗi giờ | `pnpm check` trên `main`; đỏ thì mở issue `alert` | — |
| `notify.yml` | issue `opened`/`labeled` | Nhắc `@HungQuach301` trên issue `decision`/`digest`/`alert` | — |
| `watchdog.yml` | cron 6 giờ một lần · dispatch | Canh ba dấu hiệu im lặng, kể cả `sync-workflows` hỏng | — |
| `labels.yml` | push `ops/labels.json` · dispatch | Đồng bộ nhãn từ `ops/labels.json` | I2, I4 (nhãn là đầu vào của chúng) |

## Tên status check để bật ruleset

Tên **job**, không phải tên file:

```
check
secret-scan
fix-has-test
protected-area
```

`trailer-warn` cố ý **không** vào danh sách: nó là luật mềm (CHARTER mục 4). Nếu nền tảng đổi cách ghi trailer `Claude-Session` thì một luật cứng ở đó sẽ chặn toàn bộ công việc.

## Hai chỗ workflow chạy theo định nghĩa trên `main`, không theo nhánh PR

`automerge.yml` dùng `workflow_run`, và `main-ci.yml` chạy trên `main`. Đó là chủ ý: một nhánh PR **không sửa được** luật merge của chính nó. Đây là phần duy nhất của I2 và I4 không phụ thuộc vào việc hook của agent có hoạt động hay không (giả định G11).

## `automerge` gộp PR khi và chỉ khi

1. CI xanh.
2. PR có nhãn `automerge`.
3. PR **không** có nhãn `owner-merge` (CI tự gắn nhãn đó cho PR chạm vùng bảo vệ).
4. PR không ở trạng thái nháp.

Cộng một điều kiện thứ năm không có trong CHARTER nhưng suy ra từ nó: **chỉ gộp đúng commit mà CI đã chạy**. Nếu nhánh có commit mới sau lần CI đó, gộp bây giờ là gộp một thứ chưa được kiểm — workflow dừng và chờ lần CI kế tiếp.
