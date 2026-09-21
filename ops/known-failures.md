# 🤖 Sổ lỗi đã gặp

**Luật (CHARTER 6.6):** lỗi cùng loại xuất hiện **lần thứ hai** thì sửa **spec, contract hoặc prompt** — không vá sản phẩm. Vá sản phẩm lần thứ hai nghĩa là lần thứ ba đang tới.

Mỗi mục ghi: chữ ký lỗi, đã gặp mấy lần, nguyên nhân gốc, chỗ đã sửa, và cách máy chặn nó từ nay.

---

## KF-001 · Heredoc đóng ở cột 0 làm vỡ khối YAML của workflow

- **Lần gặp:** 2 (`main-ci.yml`, rồi `notify.yml` và `watchdog.yml`)
- **Chữ ký:** `yaml.scanner.ScannerError: while scanning a simple key` hoặc `found character '@' that cannot start any token`, trỏ vào một dòng nằm trong khối `run: |`.
- **Nguyên nhân gốc:** trong khối YAML literal, mọi dòng phải thụt sâu hơn khoá `run:`. Một heredoc bash (`BODY=$(cat <<EOF … EOF`) kết thúc ở cột 0, nên nó cắt đứt khối YAML ở giữa. Thông báo lỗi của GitHub không chỉ tới chỗ này.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** workflow trong `ops/workflows/` chỉ có hiệu lực **sau khi** PR merge vào `main` và `sync-workflows` chép sang `.github/workflows/`. Một lỗi cú pháp vì thế không hiện ra trên PR — nó hiện ra trên `main`.
- **Đã sửa ở đâu:** thay mọi heredoc trong workflow bằng `printf '%s\n' …`.
- **Máy chặn từ nay:** `pnpm lint:workflows` (`ops/scripts/check-workflows.ts`) bắt dòng ở cột 0 trong khối `run:`, và chạy `bash -n` trên từng khối. Nằm trong `pnpm check`, nên CI chặn trước khi merge.

---

## KF-002 · PR xếp chồng cộng merge squash sinh xung đột ở mọi file hai PR cùng chạm

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì nó sẽ lặp lại ở **mọi** đợt có nhiều PR nền tảng, và vì nó chặn cả hàng đợi merge chứ không chỉ một PR.
- **Chữ ký:** `CONFLICT (add/add): Merge conflict in <file>` ngay sau khi gộp `main` vào một nhánh, trong khi diff cho thấy **không bên nào xoá gì của bên kia**.
- **Nguyên nhân gốc:** merge **squash** tạo một commit mới trên `main` không chung tổ tiên với nhánh đang mở. Với một nhánh xếp chồng trên nhánh vừa được squash, git mất hết ngữ cảnh ba chiều: mọi file mà hai PR cùng chạm trở thành `add/add`, kể cả khi thay đổi là thuần cộng thêm.

  Cần cả **hai** điều kiện: PR xếp chồng **và** merge squash. Thiếu một trong hai thì không có lỗi này. CHARTER 3.3 chốt squash (`automerge.yml` merge bằng squash), nên điều kiện thứ hai là cố định — chỉ còn cách bỏ điều kiện thứ nhất.
- **Đã xảy ra ở đâu:** Đợt 0. Bốn PR xếp chồng `#1 → #2 → #4 → #6`. Sau khi `#1` được squash, `#2` xung đột ở `CLAUDE.md` và `package.json`.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** hàng đợi merge là **tuần tự** (CHARTER mục 7). Một PR xung đột nằm giữa hàng đợi chặn tất cả PR sau nó, và `automerge.yml` hiện **không biết** phân biệt "CI xanh nhưng đang xung đột" với "CI xanh và merge được".

### Cách làm từ nay

1. **Mặc định: mỗi worker chỉ mở PR dựa trên `main`.** Không xếp chồng. Một mục backlog là một đơn vị độc lập, và `deps` trong backlog đã là cơ chế để diễn đạt thứ tự — thứ tự công việc không cần diễn đạt thêm bằng base của PR.
2. **Nếu buộc phải xếp chồng** (PR sau đọc file PR trước tạo ra, và tách thì CI đỏ): **gộp lại ngay sau mỗi lần PR dưới được merge**, không đợi tới lúc chuẩn bị merge PR trên. Gộp ngay thì xung đột nhỏ và còn nhớ vì sao mỗi bên viết thế; gộp muộn thì không.
3. **Gộp, không rebase.** Nhánh có thể đã có người khác đọc, và CHARTER cấm force-push lên nhánh của người khác. Một commit merge giữ mọi checkout đang có còn dùng được.
4. **Giải quyết xung đột `add/add` bằng đối chiếu, không bằng `--ours`/`--theirs`.** Chạy `git diff origin/main:<file> <nhánh>:<file>` và đếm dòng bị xoá trước khi quyết. Không có dòng nào bị xoá thì giữ bản dài hơn là an toàn — và lúc đó ta **biết** nó an toàn thay vì hy vọng thế.

- **Máy chặn từ nay:** mục `P-007` trong `ops/lanes/platform/backlog.md` — `automerge.yml` bỏ qua PR đang xung đột thay vì thử merge, và routine integrator liệt kê PR xung đột vào bản tin ngày để chúng không nằm im. Tới khi `P-007` xong, đây mới là luật mềm: nó nằm trong tài liệu, chưa nằm trong máy.

---

## KF-003 · Khối `permissions` thiếu một quyền, và lỗi hiện ra dưới dạng 404 "repo không tồn tại"

- **Lần gặp:** 1 lỗi thật đã chạy, cộng **1 chỗ nữa cùng loại** tìm ra khi rà cả bộ. Ghi ngay từ lần đầu vì chữ ký lỗi của nó **nói dối**: nó trông như lỗi cấu hình repo, không giống lỗi quyền.
- **Chữ ký:**
  ```
  remote: Repository not found.
  fatal: repository 'https://github.com/<owner>/<repo>/' not found
  The process '/usr/bin/git' failed with exit code 128
  ```
  ở bước `actions/checkout`, **mặc dù** log ngay phía trên đó cho thấy auth đã được cài (`git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***`).
- **Nguyên nhân gốc:** khi một workflow khai khối `permissions`, mọi quyền **không** được liệt kê bị đặt thành `none` — kể cả `contents`. `labels.yml` chỉ khai `issues: write`, nên `GITHUB_TOKEN` của nó có `contents: none`. Với repo **private**, GitHub trả **404** thay vì 403 cho một token không có quyền đọc, để không lộ việc repo có tồn tại hay không. Vì vậy thông báo lỗi chỉ sai hướng: nó nói "không tìm thấy repo", còn sự thật là "không được phép đọc repo".

  Trên repo **public** lỗi này không xảy ra, nên nó không lộ ra ở bất kỳ ví dụ nào chép từ mạng.
- **Bằng chứng:** `labels` run #1, commit `32ba4cd`, ngày 2026-09-20. Ba lần thử lại của `actions/checkout` đều cho cùng một kết quả — không phải trục trặc mạng.
- **Đã khép vòng:** sau khi PR #7 merge, `labels` **run #2** trên commit `218fe70` kết thúc `success` — chính bài kiểm mà run #1 đã trượt. Đó là bằng chứng chạy thật; `pnpm lint:workflows` chỉ là bằng chứng ở chỗ rẻ.
- **Đã sửa ở đâu:** hai workflow. Rà cả bộ tìm ra một chỗ nữa **chưa từng chạy** nên chưa lộ:

  | Workflow | Thiếu | Thao tác cần nó |
  |---|---|---|
  | `labels.yml` | `contents: read` | `actions/checkout` |
  | `watchdog.yml` | `pull-requests: read` | `gh pr list` ở dấu hiệu "48 giờ không merge" |

  Chỗ thứ hai đáng chú ý vì nó **không** phải lỗi checkout: **đọc pull request cần `pull-requests: read`**, và quyền đó **không** nằm trong `contents: read`. Nếu không sửa, người canh sẽ im lặng không bao giờ báo được dấu hiệu thứ hai — đúng kiểu hỏng mà rủi ro **B7** nói tới.

### Một nghi ngờ thứ ba, đã bị chính lần chạy thật bác bỏ

Khi rà, tôi kết luận `ci.yml` cũng thiếu `issues: write` cho bước `gh label create`, với lý do "nhãn của repo nằm dưới quyền Issues, còn `pull-requests: write` chỉ đủ để gắn nhãn đã có lên PR". **Lý do đó sai.**

Bằng chứng, `ci` run #1 trên PR #7, ngày 2026-09-20: job `protected-area` chạy với đúng `contents: read` + `pull-requests: write`, **không có quyền `issues` nào**, và bước "Bảo đảm nhãn CI dùng đã tồn tại" kết thúc `success`. Hai nhãn `automerge` và `cross-lane` trước đó **chưa tồn tại** và sau lần chạy đó đã có mặt, đúng màu và đúng mô tả trong `ops/labels.json` — nghĩa là chúng được **tạo mới**, không phải được cập nhật.

Kết luận đúng: **endpoint nhãn của repo nằm dưới CẢ HAI scope** `issues` và `pull-requests`. Thêm `issues: write` vào `ci.yml` là khai thừa quyền, nên thay đổi đó đã được hoàn tác, và luật trong linter nhận **một trong hai** thay vì ép một scope.

Đây đúng là lý do CHARTER 11.1 luật 3 tồn tại: *kiểm bằng chạy thật, không bằng đọc tài liệu*. Suy luận nghe hợp lý, khớp với cách GitHub đặt tên scope, và vẫn sai.
- **Máy chặn từ nay:** `pnpm lint:workflows` có thêm bảng **thao tác → quyền tối thiểu** (`PERMISSION_RULES` trong `ops/scripts/check-workflows.ts`). Workflow nào khai `permissions` mà thiếu quyền cho một thao tác nó thật sự dùng thì linter đỏ, kèm lý do. `write` bao hàm `read`; workflow **không** khai `permissions` thì luật im lặng, vì đó là một lựa chọn khác chứ không phải lỗi.

  Một luật có thể nhận **nhiều quyền thay thế**: thoả một trong số đó là đủ. Nếu không, luật sẽ ép workflow khai thừa — đúng cái bẫy đã sập ở đoạn trên.

  Test ở `ops/test/check-workflows.test.ts` — 14 test: bốn **âm** (hai trong số đó tái hiện đúng hai workflow đã sai, bằng đúng nội dung đã làm chúng sai), và phần còn lại chống đỏ nhầm, trong đó có một test khoá `ci.yml` lại ở trạng thái **không** khai `issues`.

### Vì sao lỗi này đặc biệt đắt ở dự án này

Ba lớp cộng lại làm nó khó thấy:

1. Workflow trong `ops/workflows/` **chỉ chạy sau khi merge vào `main`** và `sync-workflows` chép sang `.github/workflows/`. Không có cách nào thử nó trên nhánh PR.
2. Chữ ký lỗi chỉ sai hướng — người đọc đi kiểm tên repo, quyền của PAT, và cấu hình sync, đều không phải nguyên nhân.
3. Chỗ sai thứ hai nằm trong workflow **chưa từng chạy lần nào**, nên nó sẽ chỉ lộ ra đúng vào lúc cần nó nhất: lúc người canh phải báo động.

Và một điều nữa lộ ra khi PR #7 chạy CI: **workflow chạy trên một PR là bản trong `.github/workflows/` của nhánh PR**, mà nhánh PR thừa hưởng bản đó từ `main` — agent không ghi được `.github/` nên nó không bao giờ là bản mới. Bằng chứng: `ci` run #1 của PR #7 hiển thị `Run actions/checkout@v4`, trong khi nhánh đó đã đổi `ops/workflows/ci.yml` sang `@v7`. Hệ quả: **thay đổi trong `ops/workflows/` không tự kiểm được bằng CI của chính PR đó** — chỉ `pnpm lint:workflows` kiểm được trước merge, và chỉ lần chạy sau khi merge mới là bằng chứng thật.

### Luật rút ra

**Mỗi workflow chỉ khai đúng quyền nó cần — nhưng "đúng" có hai phía.** Khai thừa thì mở rộng bề mặt tấn công; khai thiếu thì hỏng im lặng, và trên repo private nó hỏng kèm một thông báo lỗi dẫn sai hướng. Từ nay phía "thiếu" do máy chặn; phía "thừa" do người soát diff bắt.

---

## KF-004 · Issue do workflow mở KHÔNG kích hoạt workflow khác, nên chuỗi báo động đứt giữa chừng

- **Lần gặp:** 1 — ghi ngay, vì nó làm hỏng đúng cơ chế tồn tại để báo khi mọi thứ khác hỏng.
- **Chữ ký:** **không có chữ ký.** Không job nào đỏ, không lỗi nào được in ra. `watchdog` kết thúc `success`, issue được mở đúng nhãn đúng nội dung — và điện thoại im lặng. Đây là loại hỏng tệ nhất: hỏng mà mọi chỉ báo đều xanh.
- **Bằng chứng, 2026-09-20:** `watchdog` run #1 (`test_alert = true`) kết thúc `success` lúc 23:53:31 và mở issue **#8** `[CẢNH BÁO] Nhà máy im lặng`, tác giả `github-actions`, nhãn `alert`, lúc 23:53:40. Issue #8 có **0 comment**. Trong toàn bộ 12 lần chạy của repo tới thời điểm đó, **không có lần chạy `notify` nào**.
- **Nguyên nhân gốc:** GitHub cố ý **không kích hoạt workflow** từ sự kiện do `GITHUB_TOKEN` tạo ra, để tránh vòng lặp vô hạn. `watchdog` mở issue bằng `GITHUB_TOKEN`, nên sự kiện `issues.opened` và `issues.labeled` của issue #8 **không tồn tại** đối với `notify.yml`.

  Đây **đúng cùng một cơ chế** mà giả định **G2** đã ghi, và cũng là lý do `automerge.yml` phải gọi `main-ci` tường minh bằng `workflow_dispatch`. Cơ chế đó đã được nhận ra ở một chỗ, rồi bị bỏ sót ở chỗ thứ hai.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** `notify.yml` tồn tại vì GitHub không báo cho chính người thực hiện hành động, còn agent thì hành động bằng danh tính chủ dự án (CHARTER 2.4). Nhưng nó chỉ chạy được cho issue do **agent** mở — không chạy cho issue do **workflow** mở. Mà đúng những issue quan trọng nhất lại do workflow mở: cảnh báo của `watchdog` (nhà máy đứng im, rủi ro **B7**) và cảnh báo `main` đỏ của `main-ci`.

  Nói cách khác: chuỗi báo động hoạt động cho mọi thứ **trừ** hai trường hợp nó được dựng ra để phục vụ.
- **Đã sửa ở đâu:** `watchdog.yml` và `main-ci.yml` đặt `@HungQuach301` **ngay trong thân issue** chúng mở. Một `@nhắc` trong thân issue sinh thông báo của chính GitHub, không cần mắt xích thứ hai. `notify.yml` giữ nguyên và được ghi rõ phạm vi: nó chỉ phủ issue do **người hoặc agent** mở.
- **Máy chặn từ nay:** `pnpm lint:workflows` có luật `brokenEventChains`. Nó dựng bản đồ *sự kiện → workflow đang nghe* từ tất cả workflow, rồi đối chiếu với các thao tác sinh sự kiện bằng `GITHUB_TOKEN` (`gh issue create`, `gh pr edit --add-label`, `gh api -X PUT …/merge`, …). Cặp nào chưa được khai báo thì CI đỏ.

  Luật **không** tự đoán cách xử lý, vì có hai cách hợp lệ và chúng khác nhau về bản chất: gọi thẳng workflow kia bằng `gh workflow run`, hoặc thôi không dựa vào nó nữa. Vì vậy luật đòi một dòng khai báo **có lý do viết ra**, trên cùng một dòng:

  ```
  # KF-004 <tên sự kiện>: <vì sao chuỗi này không đứt>
  ```

  Bắt gõ ra lý do là chủ ý: một cờ `true` thì ai cũng bật được mà không nghĩ; một câu lý do thì không.

### Luật mới tìm thêm hai chỗ nữa, một trong đó là lỗ hổng thật

Lần chạy đầu tiên của luật này báo hai cặp mà tôi **chưa** nghĩ tới khi rà bằng mắt:

| Workflow | Sinh sự kiện | Ai đang nghe | Tình trạng |
|---|---|---|---|
| `automerge.yml` | `push` (merge) | `main-ci.yml`, **`labels.yml`** | `main-ci` đã được gọi tường minh; **`labels` thì chưa** |
| `ci.yml` | `pull_request` (gắn nhãn) | `ci.yml` (chính nó) | chưa đứt hôm nay, sẽ đứt khi `P-009` thêm `labeled` |

**`labels.yml` là lỗ hổng thật, đang sống.** Nó nghe `push` vào `main` với `paths: ops/labels.json`. Một PR đổi `ops/labels.json` mà được `automerge` merge sẽ **không** đồng bộ nhãn — và `ops/labels.json` **không** nằm trong vùng bảo vệ, nên đường đó mở. Đã sửa: `automerge.yml` gọi `labels.yml` sau khi merge, nhưng chỉ khi PR vừa merge có đụng `ops/labels.json`.

Còn một workflow thứ ba nghe `push` vào `main`: `.github/workflows/sync-workflows.yml`. Nó cũng không chạy sau automerge. Hiện vô hại **vì** nó chỉ quan tâm `ops/workflows/**`, mà thư mục đó nằm trong vùng bảo vệ nên `automerge` không bao giờ merge PR chạm tới nó. Chỗ đó an toàn **nhờ phạm vi vùng bảo vệ, không nhờ thiết kế** — rút `ops/workflows/**` khỏi vùng bảo vệ sẽ làm nó đứt im lặng. Đã ghi ngay trong `automerge.yml`.

Đây là điều đáng chú ý nhất của mục này: rà bằng mắt tìm ra **2** chỗ, luật tìm ra **3**, và chỗ thứ ba là chỗ đang mở.

### Luật rút ra

**Mỗi khi một workflow tạo ra thứ mà một workflow khác phải phản ứng, phải hỏi: sự kiện này có tồn tại không?** Với `GITHUB_TOKEN` thì câu trả lời là **không**. Hai cách đi tiếp, và phải chọn tường minh:

1. **Gọi thẳng** bằng `workflow_dispatch` — cách `automerge` gọi `main-ci`.
2. **Không dựa vào sự kiện** — làm luôn việc đó trong chính workflow đã tạo ra thứ kia.

Cách 2 hợp với báo động hơn: một cái `@nhắc` nằm ngay trong thân issue không phụ thuộc vào bất kỳ workflow thứ hai nào chạy được hay không. Càng ít mắt xích, càng ít chỗ đứt.

---

## Nhóm Z · Hỏng mà mọi chỉ báo đều xanh — rà soát có hệ thống

**KF-001, KF-002 và KF-004 đều thuộc một nhóm**, và nhóm đó nguy hiểm hơn tổng ba mục cộng lại. Đặc điểm chung: **một bước im lặng không chạy, và không có gì đỏ.** Không phải "chạy rồi sai" — mà "không chạy, và chỗ đáng lẽ phải đỏ thì lại xanh vì không có gì để đỏ".

Ba mục trên chỉ là ba lần nhóm này lộ ra. Bảng dưới là rà soát **tất cả** những chỗ còn lại trong repo nơi cùng chuyện đó xảy ra được. Nó được viết ra để đọc một lần rồi dựng máy kiểm, không phải để nhớ.

### Vì sao nhóm này khác mọi nhóm khác

Một bài kiểm bình thường trả lời câu "nó chạy có đúng không". Nhóm Z hỏi câu **trước đó**: "nó có chạy không". Không bài kiểm nào tự trả lời được câu đó về chính mình — một bộ kiểm không chạy thì cũng không báo là nó không chạy. Nên mọi cách phát hiện ở cột bên phải đều có chung một hình dạng: **một thứ ở ngoài đếm và so**, chứ không phải một thứ ở trong tự khai.

Ba cách duy nhất có tác dụng, xếp theo thứ tự nên chọn:

1. **So hai con số phải bằng nhau.** Số file test trên đĩa so với số file test thật sự chạy. Nội dung `ops/workflows/` so với nội dung `.github/workflows/`. Số PR đã merge so với số dòng log có `costUsd`.
2. **Nhịp tim.** Một thứ phải xuất hiện đều đặn; vắng quá lâu là đỏ. Dùng khi không so được hai con số.
3. **Cấm im lặng.** Mọi bước có điều kiện phải **in ra kết luận của nó** — "có nhãn fix, đã kiểm" hoặc "không có nhãn fix, bỏ qua" — và không bao giờ được `skipped` không lời.

### Bảng rà soát

| # | Chỗ | Thứ im lặng không chạy | Vì sao không gì đỏ | Cách phát hiện chủ động |
|---|---|---|---|---|
| **Z1** | Sự kiện do `GITHUB_TOKEN` sinh ra | Workflow nghe `issues`, `issue_comment`, `pull_request`, `push` sau một hành động của workflow khác | Sự kiện **không tồn tại**. Bên sinh ra `success`, bên tiêu thụ không có lần chạy nào để mà đỏ | ✅ **Đã có** — luật `brokenEventChains` trong `pnpm lint:workflows` (P-011). Ghép bên sinh với bên nghe, đỏ khi có cặp chưa khai |
| **Z2** | `if:` của một bước hoặc một job | Bước kiểm bị `skipped`, job vẫn `success` | `skipped` **không phải** `failure`. Nhìn từ ngoài giống hệt đã kiểm và qua | P-009. Luật: bước có điều kiện phải **in ra kết luận**; thêm một luật linter đỏ khi một bước trong job kiểm bắt buộc có `if:` mà không có bước in kết luận đi kèm |
| **Z3** | `.github/` lệch `ops/workflows/` | `sync-workflows.yml` không chạy, hoặc chạy hỏng vì PAT hết hạn | Bản **cũ** trong `.github/` vẫn chạy và vẫn xanh. Mọi thứ trông bình thường, chỉ là code mới chưa bao giờ có hiệu lực | **So hash.** `main-ci` chạy trên `main` đọc được cả hai thư mục: so nội dung từng file `ops/workflows/*.yml` với file cùng tên trong `.github/workflows/`. Lệch là đỏ. Không cần PAT, không cần quyền gì thêm |
| **Z4** | PAT `WORKFLOW_SYNC_TOKEN` hết hạn | `sync-workflows.yml` | Trùng với Z3 về hệ quả, nhưng lộ sớm hơn nếu bắt riêng | Bước đầu của workflow dùng PAT **khẳng định secret không rỗng** và gọi một API rẻ để xác nhận token còn sống. Rỗng hoặc 401 là đỏ **và mở issue**, không phải bỏ qua |
| **Z5** | Secret thiếu nói chung | Bất kỳ bước nào dùng `${{ secrets.X }}` | Biến nở thành chuỗi rỗng. Lệnh vẫn chạy, có khi vẫn exit 0 | Luật linter: workflow nhắc tới `secrets.X` thì phải có một bước khẳng định `X` không rỗng **trước** lần dùng đầu tiên |
| **Z6** | `cron` không chạy | `main-ci.yml` (`17 * * * *` — dự phòng của G2), `watchdog.yml` | GitHub tạm ngưng workflow theo lịch khi repo im lặng lâu, và `cron` vốn là nỗ lực tốt nhất chứ không bảo đảm. Không chạy thì không có gì đỏ | **Nhịp tim.** `main-ci` ghi thời điểm chạy vào một file trong repo. Routine `crux-integrator` mỗi thứ Hai đọc file đó; cũ quá ngưỡng là mở issue `alert`. Hai cơ chế **khác họ** nhau nên không cùng chết |
| **Z7** | Routine bị tắt, hết lượt, hoặc không nhận được việc | Cả một làn | Không có lần chạy nào để mà đỏ. Backlog đứng im trông giống backlog đã xong | `watchdog` hiện đếm PR merged. Bổ sung: đọc `ops/logs/<lane>.jsonl`, làn nào không có dòng mới quá ngưỡng thì liệt kê tên làn đó trong cảnh báo. Ngưỡng theo làn, vì các làn chạy nhịp khác nhau |
| **Z8** | Nhãn `owner-merge` do `protected-area` gắn | Job gắn nhãn | Không gắn được nhãn thì `automerge` **không thấy** `owner-merge` và merge một PR chạm vùng bảo vệ. Bất biến I4 thủng, không gì đỏ | `automerge.yml` **từ chối merge** khi job `protected-area` chưa xanh **trên đúng SHA sắp merge**. Không đủ nếu chỉ kiểm "CI xanh" ở mức run |
| **Z9** | `\|\| true` và `continue-on-error: true` | Một lệnh bất kỳ trong khối `run:` | Lỗi bị nuốt ngay tại chỗ, theo đúng thiết kế — vấn đề là nó ở chỗ không ai định | Luật linter: liệt kê **mọi** chỗ có `\|\| true` hoặc `continue-on-error` trong `ops/workflows/`, và đòi một comment ngay trên đó giải thích. Không giải thích là đỏ |
| **Z10** | Thiếu `set -euo pipefail` | Mọi lệnh sau lệnh hỏng đầu tiên | Bash mặc định chạy tiếp và trả mã thoát của **lệnh cuối**. Script hỏng giữa chừng vẫn exit 0 | Luật linter: mọi khối `run: \|` nhiều dòng phải mở đầu bằng `set -euo pipefail`. Rẻ, máy kiểm được ngay, và bắt được một họ lỗi rộng |
| **Z11** | Test có trên đĩa nhưng không nằm trong glob của `pnpm test` | Chính bài test | Bộ test xanh với ít test hơn nó tưởng. Không ai đếm nên không ai biết | **So hai con số.** Đếm file `*.test.ts` bằng `find`, so với số file `node --test` thật sự nạp. Lệch là đỏ |
| **Z12** | Bộ kiểm sổ giả định đọc mục **cuối** tới hết file | Phần kiểm "có nói về dự phòng không", cho mục cuối | Nội dung cuối file (phần "Cách thêm một giả định") trôi vào thân mục cuối và mang theo chữ khoá, làm mục đó xanh sai. **Đã xảy ra thật với G15** — chỉ lộ ra khi thêm G16 đẩy nó khỏi vị trí cuối | Cắt mục ở dấu `---` thay vì ở hết file, kèm một test âm: một sổ có mục cuối **thiếu** dự phòng phải đỏ |
| **Z13** | `pnpm replay` so snapshot | Chính phép so, nếu snapshot được cập nhật trong cùng PR | Snapshot mới khớp output mới, đương nhiên xanh. Phép so mất hết giá trị mà không báo gì | CHARTER 6.1 đã đòi `--update` đi trong **PR riêng**. Chưa có máy nào ép: thêm một job đỏ khi một PR vừa chạm `ops/golden/**` vừa chạm thứ khác |
| **Z14** | Dòng log `costUsd` (bất biến I8) | Bước ghi log, khi lần chạy chết trước đó | Thiếu một dòng log không làm gì đỏ. Chi phí thật cao hơn chi phí thấy được, và ngân sách học trôi | So số PR đã merge theo làn với số dòng trong `ops/logs/<lane>.jsonl` cùng khoảng thời gian. Lệch quá ngưỡng thì báo trong bản tin ngày |

### Cái giá của việc không làm

Ba mục đã lộ ra (KF-001, KF-002, KF-004) đều **chỉ lộ ra vì có người bấm tay** — không mục nào được máy tìm thấy. Đó là con số đáng lo nhất trong sổ này: tỉ lệ tự phát hiện của nhóm Z hiện là **0/3**.

Rà soát này thành mục `P-014` trong `ops/lanes/platform/backlog.md`. Thứ tự làm theo giá trên mỗi đồng: **Z10 → Z11 → Z3 → Z5 → Z9** trước (đều là luật máy kiểm rẻ, viết một lần chạy mãi), rồi tới Z2, Z8, Z13 (gắn vào CI), cuối cùng Z6, Z7, Z14 (cần nhịp tim và ngưỡng, phải chỉnh dần).

---

## KF-005 · File log dùng chung trong một làn vẫn xung đột khi nhiều PR chạy song song

- **Lần gặp:** 2 trong cùng một ngày (PR #10 và PR #11, cả hai với `ops/logs/platform.jsonl`, sau khi PR #12 được squash vào `main`).
- **Chữ ký:** `CONFLICT (content): Merge conflict in ops/logs/platform.jsonl`, với hai bên là **hai dòng khác nhau cùng được thêm vào cuối file**. Không bên nào sửa hay xoá gì của bên kia.
- **Nguyên nhân gốc:** CHARTER 2.1 và bất biến **I8** phân vùng log **tới mức làn**: `ops/logs/<lane>.jsonl`. Phân vùng đó giải quyết đúng bài toán nó được đặt ra để giải — hai **làn** chạy song song không đụng nhau. Nhưng nó **không** giải bài toán hai **mục** trong *cùng một làn* chạy song song, mà đó lại là chế độ chạy bình thường: phụ lục P1 đặt mặc định 2–3 worker, và `platform` là làn nhận nhiều mục nhất.

  Đơn vị tranh chấp là **dòng cuối file**, và mọi PR trong làn đều ghi vào đúng đó.

### Nó khác KF-002 ở chỗ nào

Hai mục trông giống nhau ở triệu chứng và **khác hẳn ở nguyên nhân**. Nhầm hai cái này thì sẽ chữa nhầm.

| | KF-002 | KF-005 |
|---|---|---|
| **Nguyên nhân** | Merge **squash** cắt tổ tiên chung của một nhánh **xếp chồng** | **Nhiều PR cùng ghi vào một file dùng chung**, dù tất cả đều base `main` |
| **Điều kiện cần** | PR xếp chồng **và** squash — thiếu một là không xảy ra | Chỉ cần hai PR song song trong cùng một làn. **Không** cần xếp chồng |
| **File bị ảnh hưởng** | *Mọi* file hai PR cùng chạm, kể cả file không liên quan gì tới nhau | Đúng những file được thiết kế để nhiều PR cùng ghi: log, backlog, sổ |
| **Cách chữa của KF-002 có cứu được không** | — | **Không.** PR #10 và #11 đều base `main`, đúng luật số 1 của KF-002, và vẫn xung đột |
| **Đơn vị tranh chấp** | Nội dung file, ngữ cảnh ba chiều bị mất | Dòng cuối file |

Nói gọn: KF-002 là lỗi của **hình dạng nhánh**, KF-005 là lỗi của **hình dạng file**. Squash chỉ làm KF-005 nặng thêm chứ không tạo ra nó.

- **Đã sửa ở đâu:** `.gitattributes` ở gốc repo đặt `merge=union` cho `ops/logs/*.jsonl` và `docs/visual/calibration-log.jsonl`. `union` là trình merge **có sẵn của git**: hai bên cùng thêm dòng thì nó giữ cả hai, không báo xung đột. `.gitattributes` nằm trong repo nên không cần cấu hình gì ở máy người dùng.

  **Bằng chứng chạy thật, 2026-09-21** — dựng hai repo thử trong scratchpad:

  | Kịch bản | Kết quả |
  |---|---|
  | Hai nhánh cùng thêm một dòng vào cuối, merge thường | Giữ cả hai dòng, **0 dấu xung đột** |
  | Đúng hình dạng đã sinh lỗi: `pr1` squash vào `main`, rồi gộp `main` vào `pr2` | Giữ cả hai dòng, **0 dấu xung đột** |

  Hai giới hạn, **đã đo chứ không phải đoán**, vì chúng quyết định ai được dựa vào cái gì:

  1. **Union không xếp theo thời gian.** Trong cả hai lần thử, dòng `at:03` của nhánh nằm **trước** dòng `at:02` của `main`. Vậy nên **mọi bên đọc log phải tự sắp theo `at`** — bản tin ngày, `ops/metrics.md`, và routine integrator. Tin vào thứ tự dòng là sai.
  2. **Union không khử trùng lặp.** Hai nhánh ghi y hệt một dòng thì file có hai dòng giống nhau. Với log append-only mang `at` và `ref` riêng thì điều này không xảy ra trong thực tế, nhưng nó là lý do **không** được dùng union cho file mà dòng có thể trùng.

  **Chưa kiểm:** GitHub có áp dụng `.gitattributes` khi nó tự tính "nhánh này có xung đột không" trên trang PR hay không. Nếu không, biểu ngữ xung đột vẫn hiện, nhưng lệnh `git merge` ở phía worker vẫn tự giải được — mà đó mới là chỗ tốn công. Kiểm bằng chạy thật ở lần PR song song kế tiếp.

- **Máy chặn từ nay:** `ops/test/gitattributes.test.ts` khoá luật union cho từng file append-only đang có, và khoá luôn chiều ngược lại — **không** file Markdown nào được nhận `merge=union`. Union trên Markdown sẽ trộn hai mục thành một mục hỏng mà vẫn merge được: đó là nhóm Z, hỏng mà không gì đỏ.

### Rà nốt: còn file dùng chung nào khác

Union chỉ cứu được file mà **thứ tự dòng không mang nghĩa**. Với Markdown thì không — nên phần còn lại phải chữa bằng cách khác.

| File | Xung đột khi nào | Union có cứu được không | Cách tránh |
|---|---|---|---|
| `ops/logs/<lane>.jsonl` | Hai PR cùng làn cùng thêm một dòng cuối. **Chế độ chạy bình thường** | ✅ Có — đã đặt | Đã xong. Bên đọc phải tự sắp theo `at` |
| `docs/visual/calibration-log.jsonl` | Hai lần hiệu chuẩn song song | ✅ Có — đã đặt | Đã xong |
| `ops/lanes/<lane>/backlog.md` | **Hai chỗ**: (a) hai PR cùng thêm mục mới ở đầu file — đã xảy ra ở PR #11; (b) hai PR cùng đổi `status` của hai mục nằm sát nhau | ❌ **Không.** Union sẽ lồng hai mục vào nhau, sinh một mục vô nghĩa mà git vẫn coi là merge thành công | Thêm mục mới ở **cuối file**, mỗi mục là một khối tự đủ cách nhau một dòng trống. Việc này không làm xung đột biến mất, nó làm xung đột **an toàn**: hai khối ở cuối, giải bằng cách giữ cả hai, không bao giờ mất chữ của ai. Số mục **nhận trước** ở dòng log để hai worker không cùng lấy một số |
| `ops/known-failures.md` | Hai PR cùng thêm một mục `KF-00N` ngay trước phần "Cách thêm một mục" | ❌ Không | Chuyển phần "Cách thêm một mục" lên **đầu file**, để mục mới luôn nối vào cuối. Vẫn có thể xung đột, nhưng luôn là "hai khối ở cuối", giải được trong một phút |
| `docs/assumptions.md` | **Hai chỗ cho mỗi lần thêm**: một dòng trong bảng tổng ở đầu, một mục đầy đủ ở dưới. Hai PR cùng thêm giả định là xung đột ở cả hai | ❌ Không | Mã `G<N>` **nhận trước** trong backlog làn `verify` trước khi viết, để hai worker không cùng lấy một mã. Mục đầy đủ luôn nối vào cuối, trước dấu `---` cuối. `pnpm assumptions` đã bắt được trường hợp bảng và mục lệch nhau, nên một lần giải sai sẽ đỏ chứ không im lặng |
| `ops/metrics.md` | Hai làn cùng cập nhật số tổng | ❌ Không | **Đừng viết tay.** File này là số **dẫn xuất** từ `ops/logs/**`; mục `P-005` sinh nó bằng script. Số dẫn xuất mà chép tay thì ngoài xung đột còn sai lặng lẽ |
| `pnpm-lock.yaml` | Hai PR cùng đổi phụ thuộc | ❌ Không | CHARTER mục 7 đã chốt: làn `integration` tạo lại lockfile. Không giải tay |
| `ops/labels.json` | Hai PR cùng thêm nhãn | ❌ Không (JSON, không phải một-dòng-một-bản-ghi) | Hiếm, và diff nhỏ. Giải tay, giữ cả hai nhãn |

**Điểm chung của cột phải:** không chỗ nào chữa được bằng "cẩn thận hơn". Hoặc đổi hình dạng file cho git tự giải được, hoặc **nhận trước một định danh** để hai worker không nhắm vào cùng một dòng. Cẩn thận không phải là một cơ chế.

### Còn một tầng nữa, và nó cần chủ dự án

Union làm xung đột log biến mất, nhưng nó không đổi **hình dạng** file: vẫn là một file cho cả làn, vẫn là mọi PR ghi vào cùng một chỗ. Cách sửa tận gốc là **một file cho mỗi mục** — `ops/logs/<lane>/<id>.jsonl` — lúc đó hai PR không bao giờ chạm cùng một file, không cần union, không cần luật nào.

Cách đó **chạm vùng bảo vệ**: bất biến I8 trong CHARTER mục 3 viết thẳng đường dẫn `ops/logs/<lane>.jsonl`, và CHARTER mục 7 viết "backlog và log tách theo làn". Sửa CHARTER luôn là quyết định `irreversible` (CLAUDE.md mục 14), nên nó đi bằng một issue `🤖 [QĐ]` chứ không đi kèm mục này.

Điểm đáng lưu ý về thời điểm: `kernel/src/log.ts` nhận đường dẫn làm tham số, và bên đọc **chưa tồn tại** (`P-005` còn `ready`). Nghĩa là đổi bây giờ gần như miễn phí, và mỗi tuần chờ thì đắt thêm.

### Cập nhật 2026-09-21 · `merge=union` KHÔNG cứu được lần vận hành thật đầu tiên — giả định G17 `sai`

⚠️ **Union chỉ cứu lúc gộp bằng `git` trong phiên, và chỉ khi nhánh đã mang sẵn luật. Nó không cứu trạng thái `mergeable` mà GitHub tính.** Đừng coi `.gitattributes` là thứ làm xung đột log biến mất.

**Chuyện đã xảy ra:** `.gitattributes` lên `main` khi PR #13 merge. Ngay sau đó PR #11 **vẫn** báo xung đột ở `ops/logs/platform.jsonl` trên trang PR, và `git merge origin/main` trong phiên cũng **vẫn** sinh dấu xung đột ở đúng file đó.

**Nguyên nhân, tách ra bằng hai lần thử có đối chứng:**

| Lần thử | Nhánh có `.gitattributes` lúc **bắt đầu** gộp? | Kết quả |
|---|---|---|
| 1 — tái hiện đúng PR #11: nhánh tách ra trước, `main` mang luật vào cùng lần gộp | **Không** | **CONFLICT** |
| 2 — cùng repo, chỉ khác: lấy `.gitattributes` vào nhánh trước rồi mới gộp | **Có** | Merge sạch, giữ cả hai dòng |

**Git đọc `.gitattributes` của nhánh đích ở trạng thái TRƯỚC lần gộp.** Một luật merge do `main` mang tới **không tự áp cho chính lần gộp mang nó tới**. Mọi nhánh mở ra trước PR #13 vì thế phải chịu đúng một lần giải tay; từ lần gộp sau thì luật mới có tác dụng.

**Một chỗ phải nói cho đúng:** quan sát ở PR #11 **không** chứng minh được GitHub bỏ qua `.gitattributes`. Ở tình huống đó git phía dưới cũng xung đột thật, nên GitHub báo xung đột là **đúng**. Câu hỏi về GitHub vẫn mở, và chỉ trả lời được bằng hai PR mà **cả hai đã mang sẵn** luật — xem `VF-G17`.

**Vì sao hai lần thử của `P-015` bỏ sót:** cả hai đều dựng ở **trạng thái sau cùng**, nơi luật đã nằm sẵn ở commit gốc. Không lần nào dựng ở trạng thái mà lỗi thật sẽ xảy ra. Đây là bài học vượt ra ngoài mục này: *"kiểm bằng chạy thật" chưa đủ — bài thử phải tái hiện đúng **điều kiện đầu vào**, và điều kiện dễ bỏ sót nhất là thứ tự thời gian: ai có gì, vào lúc nào.*

**Dự phòng đã chuyển sang, không còn là ghi chú:** union giữ lại vì nó vẫn cứu được các lần gộp sau — không mất gì. Nhưng cơ chế chính chuyển sang mục **`P-016`**: routine integrator tự gộp `main` vào mọi PR đang mở bị xung đột mà nó giải được, chạy `pnpm check`, rồi push. Giải xung đột thành việc của máy.

**Cập nhật 2026-09-21 (tiếp) · Cơ chế của `P-016` đã có, dạng tool chứ không phải lời:** `ops/scripts/integrator-resolve.ts` đối chiếu bằng `git diff --numstat` với tổ tiên chung ở cả hai bên trước khi quyết — đúng "đối chiếu, không đoán" của KF-002 — rồi giải bằng `git merge-file --union` cho MỌI file đủ điều kiện, không chỉ file đã khai `merge=union`. Nhờ vậy lỗ hổng của G17 (attribute không tự áp cho chính lần gộp mang nó tới) không còn quan trọng: tool không phụ thuộc `.gitattributes` để quyết định giải hay không. Còn treo: nhịp chạy mỗi giờ của routine `crux-integrator` cần chủ dự án tự đổi lịch ở `claude.ai/code/routines` (agent không đổi được lịch một routine đã tạo).

**Cập nhật 2026-09-21 (mục `I-004`) · Một loại file mà union là SAI, và vì sao:** `pnpm-lock.yaml`. Union chỉ đúng khi mỗi dòng độc lập và thứ tự dòng không mang ý nghĩa — lockfile không thoả cả hai: nó là YAML có cấu trúc, và là **file dẫn xuất** của các `package.json`. Ghép dòng của hai bên cho ra file *merge được mà vẫn hỏng* (nhóm lỗi Z): khoá lặp hoặc thụt lề sai, không gì đỏ cho tới khi `pnpm install --frozen-lockfile` chạy ở một máy khác. Thêm vào đó, xung đột lockfile thật gần như luôn có **sửa dòng ở cả hai bên** (một phiên bản đổi chỗ), nên luật "thuần cộng thêm" của `integrator-resolve.ts` luôn trả `aborted-ineligible` — PR nằm chờ người, đúng thứ `P-016` sinh ra để xoá. Cách đúng là **tạo lại** từ manifest của cây vừa gộp: `ops/scripts/integrator-lockfile.ts` (CHARTER mục 7 — lockfile do làn `integration` tạo lại).

---

## KF-006 · Mô tả nhãn dài quá 100 ký tự làm đỏ **bước đầu tiên** của job gắn nhãn `owner-merge`

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì hệ quả của nó không tỉ lệ với nguyên nhân: một ký tự thừa trong một file JSON làm thủng đường thực thi bất biến **I4**.
- **Chữ ký:**
  ```
  HTTP 422: Validation Failed (https://api.github.com/repos/<owner>/<repo>/labels)
  description is too long (maximum is 100 characters)
  Label.name already exists
  ```
  ở bước "Bảo đảm nhãn CI dùng đã tồn tại" của job `protected-area`.
- **Bằng chứng:** `ci` run trên PR #20, 2026-09-21. Job `protected-area` đỏ sau **5 giây**, trước khi chạm tới dòng nào của PR.
- **Nguyên nhân gốc:** GitHub giới hạn mô tả nhãn ở **100 ký tự**. `D-C06` viết lại mô tả của bảy nhãn cho khớp luật mới, và sáu trong số đó vượt giới hạn — dài nhất là `owner-merge` với 193 ký tự. Giới hạn này không có ở đâu trong repo, nên không có gì để mà đối chiếu.

  Dòng thứ hai của thông báo lỗi (`Label.name already exists`) là **nhiễu**: `--force` xử lý được trường hợp đó. Chỉ dòng thứ nhất là lỗi thật. Đọc nhầm dòng thứ hai sẽ dẫn tới sửa nhầm chỗ.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** tạo nhãn là bước **đầu tiên** của `protected-area`, và `protected-area` là job gắn nhãn `owner-merge`. Job đỏ ở dòng đầu nghĩa là **PR chạm vùng bảo vệ không được gắn nhãn** — đúng lỗ hổng mà rà soát **Z8** mô tả. Ở đây nó lộ ra vì job đỏ; nếu bước tạo nhãn từng được viết với `|| true` thì nó đã im lặng.

  Giới hạn đếm **ký tự**, không phải byte: mô tả tiếng Việt có dấu tốn nhiều byte hơn ký tự, và nhãn `parked` (86 ký tự, hơn 100 byte) đã sync thành công ở `labels` run #2. Nhầm chỗ này sẽ sinh ra một luật chặt quá mức và ép viết mô tả cụt.
- **Đã sửa ở đâu:** `ops/labels.json` — bảy mô tả viết lại, dài nhất còn 91 ký tự.
- **Máy chặn từ nay:** `ops/test/labels.test.ts`, nằm trong `pnpm test` nên `pnpm check` chặn trước khi PR tới GitHub. Năm bài kiểm: độ dài ≤ 100, `name` và `color` hợp lệ, không trùng tên, đủ năm nhãn mà `ci.yml` tự tạo, và `ci.yml` tạo đúng những nhãn nó gắn — bài cuối bắt trường hợp thêm một nhãn mới vào `ci.yml` mà quên thêm vào vòng lặp tạo nhãn.

---

## Cách thêm một mục

```markdown
## KF-00N · <chữ ký lỗi, một dòng>

- **Lần gặp:** N
- **Chữ ký:** <chuỗi đủ đặc trưng để nhận ra lần sau>
- **Nguyên nhân gốc:** <vì sao nó xảy ra, không phải nó xảy ra ở đâu>
- **Đã sửa ở đâu:** <spec / contract / prompt — không phải sản phẩm>
- **Máy chặn từ nay:** <tên kiểm tra cụ thể, chạy ở đâu>
```

Không có dòng **Máy chặn từ nay** thì mục đó chưa xong.
