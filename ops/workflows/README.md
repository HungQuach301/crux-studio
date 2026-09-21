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

## Tên status check mà ruleset `protect-main` đòi

**Đã bật thật ngày 2026-09-21** (giả định **G12**, mục `VF-G12`) — đây không còn là danh sách đề xuất. Tên **job**, không phải tên file:

```
check
secret-scan
fix-has-test
protected-area
trailer-warn
```

Bản có thẩm quyền của danh sách này nằm ở `ops/scripts/required-checks.ts`, và `ops/test/required-checks.test.ts` đối chiếu nó với tên job thật trong `ci.yml`. **Đổi tên, gộp hay xoá một trong năm job đó là quyết định `irreversible`** (CHARTER 2.3 nhóm 8): ruleset nằm ở Settings của GitHub, ngoài repo, chỉ chủ dự án sửa được — và ruleset chờ một tên không còn ai sinh ra thì mọi PR kẹt ở `blocked`, kể cả PR revert.

`trailer-warn` **có** trong danh sách, và điều đó **không** biến luật mềm thành luật cứng: bước chạy của job khai `continue-on-error: true` nên job luôn kết luận `success` dù có bao nhiêu commit thiếu trailer. Cái ruleset đòi là *job có chạy và có kết luận*, không phải *không có cảnh báo nào*. Luật mềm của CHARTER mục 4 vì vậy giữ nguyên — nhưng tên job thì nay chịu tải.

Ruleset là **lớp thứ hai** của I2, không phải lớp duy nhất: `automerge.yml` cộng hook vẫn là lớp chặn chính, và đã đo được rằng ruleset không cản `automerge.yml` merge bằng `GITHUB_TOKEN`.

## Hai chỗ workflow chạy theo định nghĩa trên `main`, không theo nhánh PR

`automerge.yml` dùng `workflow_run`, và `main-ci.yml` chạy trên `main`. Đó là chủ ý: một nhánh PR **không sửa được** luật merge của chính nó. Đây là phần duy nhất của I2 và I4 không phụ thuộc vào việc hook của agent có hoạt động hay không (giả định G11).

## `automerge` gộp PR khi và chỉ khi

Từ quyết định **D-C06**, quyết định nằm ở `ops/invariants.merge-gate.ts` chứ không nằm trong bash, và nó xét **ba cửa**:

| Cửa | Nhãn cần có | Khoảng chờ |
|---|---|---|
| `owner-merge` | — | máy không bao giờ gộp |
| `automerge-delayed` | `automerge-delayed` | 12 giờ kể từ lúc CI xanh |
| `open` | `automerge` | không chờ |

Điều kiện chung cho hai cửa máy gộp được:

1. CI xanh **trên đúng commit đầu nhánh**. Nhánh có commit mới sau lần CI đó thì gộp bây giờ là gộp một thứ chưa được kiểm — workflow dừng và chờ lần CI kế tiếp.
2. PR không ở trạng thái nháp.
3. PR không đang xung đột với `main`, và `mergeable: null` không được coi là gộp được (KF-002).
4. Không có comment `dừng` của chủ dự án — comment không bắt đầu bằng 🤖, có chứa chữ `dừng`.

**Cửa được tính lại ở đây, không lấy từ nhãn.** `ci.yml` chạy theo định nghĩa trong nhánh PR, nên nhãn nó gắn không phải bằng chứng đáng tin: một PR sửa `ci.yml` sẽ không bị nhãn nào chặn. `automerge.yml` chạy `ops/invariants.protected-area.ts` **bản trên `main`** trước mỗi lần gộp. Nhãn là để người đọc; cửa là thứ máy tin (rà soát Z8).

## Sau khi gộp, gọi tay các workflow nghe `push`

Gộp bằng `GITHUB_TOKEN` **không** sinh sự kiện `push` cho workflow nào (giả định G2, KF-004). Danh sách phải gọi do `ops/invariants.post-merge-dispatch.ts` trả về — `main-ci.yml` luôn luôn, `labels.yml` khi `ops/labels.json` đổi, `sync-workflows.yml` khi `ops/workflows/**` đổi.

Danh sách đó **không** được viết cứng trong bash: viết cứng nghĩa là thêm một workflow nghe `push` mà quên sửa bash thì không có gì báo, và đó đúng là cách KF-004 xảy ra lần đầu.
