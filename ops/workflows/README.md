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
| `smoke-workflows.yml` | push `ops/workflows/**` · `automerge` gọi | Chạy thử đúng những workflow vừa đổi, **sau** khi sync chép xong | — (lấp khoảng trống của G10) |

## Tên status check để bật ruleset

Tên **job**, không phải tên file:

```
check
secret-scan
fix-has-test
protected-area
```

Nếu GitHub đòi gói trả phí mới bật được ruleset trên repo private (**giả định G12**): không bật, và ghi lại điều đó. `automerge.yml` cộng hook đã là lớp chặn chính; ruleset là lớp thứ hai.

`trailer-warn` cố ý **không** vào danh sách: nó là luật mềm (CHARTER mục 4). Nếu nền tảng đổi cách ghi trailer `Claude-Session` thì một luật cứng ở đó sẽ chặn toàn bộ công việc.

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

Gộp bằng `GITHUB_TOKEN` **không** sinh sự kiện `push` cho workflow nào (giả định G2, KF-004). Danh sách phải gọi do `ops/invariants.post-merge-dispatch.ts` trả về — `main-ci.yml` luôn luôn, `labels.yml` khi `ops/labels.json` đổi, rồi `sync-workflows.yml` và **sau đó** `smoke-workflows.yml` khi `ops/workflows/**` đổi.

Danh sách đó **không** được viết cứng trong bash: viết cứng nghĩa là thêm một workflow nghe `push` mà quên sửa bash thì không có gì báo, và đó đúng là cách KF-004 xảy ra lần đầu.

## Chạy thử sau khi merge (mục `P-010`)

Workflow ở đây **chưa bao giờ chạy** trước khi merge — đó là hệ quả trực tiếp của giả định **G10**. `pnpm lint:workflows` bắt được cú pháp và khối `permissions`; nó **không** bắt được quyền thật, secret thiếu, hay một lệnh `gh` gọi sai. Hai lỗi loại đó đã xảy ra thật (KF-003).

`smoke-workflows.yml` lấp đúng khoảng đó: sau mỗi lần `ops/workflows/**` đổi trên `main`, nó gọi **đúng những workflow vừa đổi**, không chạy lại cả bộ.

| Workflow được gọi | Chế độ |
|---|---|
| có `inputs.dry_run` | gọi kèm `-f dry_run=true` |
| không có `dry_run`, không có lệnh merge | gọi thường |
| có lệnh merge, hoặc tên nằm trong `NEVER_REAL_DISPATCH` | **không gọi** — liệt kê trong issue |
| không có `workflow_dispatch` | **không gọi được** — liệt kê trong issue |
| chính `smoke-workflows.yml` | tự loại mình, nếu không nó kẹt ở `concurrency` của chính nó |

`automerge.yml` **không bao giờ** được gọi ở chế độ thật. Hàng rào có hai lớp độc lập trong `ops/scripts/smoke-workflows.ts` — `NEVER_REAL_DISPATCH` bắt theo tên file, `MERGE_PATTERNS` bắt theo nội dung — và có test riêng cho đúng điều đó.

**Chế độ chạy thử phải CÓ GIÁ TRỊ.** Mỗi `dry_run` chạy hết phần đọc và in ra việc nó **định** làm; chỉ đúng thao tác ghi ra ngoài bị chặn. Một chế độ thử chỉ in "ok" thì không kiểm được gì ngoài việc runner khởi động.

**Thứ tự so với sync là nội dung, không phải hình thức.** Chạy thử trước khi `.github/workflows/` có bản mới là chạy thử **bản cũ**, và nó sẽ xanh. `smoke-workflows.yml` vì thế đối chiếu **nội dung** hai thư mục và không gọi gì cho tới khi chúng khớp — không dựa vào thứ tự sự kiện, thứ chưa ai kiểm bằng chạy thật ở repo này.

Workflow đỏ thì **một** issue `alert` cho cả lần push, không phải một issue mỗi workflow: mỗi issue là một lần gọi chủ dự án (CHARTER 2.4).
