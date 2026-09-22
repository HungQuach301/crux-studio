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
| **Z3** | `.github/` lệch `ops/workflows/` | `sync-workflows.yml` không chạy, hoặc chạy hỏng vì PAT hết hạn | Bản **cũ** trong `.github/` vẫn chạy và vẫn xanh. Mọi thứ trông bình thường, chỉ là code mới chưa bao giờ có hiệu lực | ✅ **Đã có** (mục `P-014`, sóng 1) — `ops/scripts/check-workflows-synced.ts` (`unsyncedWorkflows`), gọi từ một bước riêng trong job `check` của `ops/workflows/main-ci.yml`, chỉ chạy khi `github.event_name != 'push'` để tránh cuộc đua vô hại với `sync-workflows.yml` ngay sau một merge. **Không** nằm trong `pnpm lint:workflows`/`pnpm check`: một nhánh PR đang sửa `ops/workflows/**` khiến hai thư mục lệch một cách BÌNH THƯỜNG, so ở đó sẽ đỏ nhầm cho mọi PR như vậy |
| **Z4** | PAT `WORKFLOW_SYNC_TOKEN` hết hạn | `sync-workflows.yml` | Trùng với Z3 về hệ quả, nhưng lộ sớm hơn nếu bắt riêng | Bước đầu của workflow dùng PAT **khẳng định secret không rỗng** và gọi một API rẻ để xác nhận token còn sống. Rỗng hoặc 401 là đỏ **và mở issue**, không phải bỏ qua |
| **Z5** | Secret thiếu nói chung | Bất kỳ bước nào dùng `${{ secrets.X }}` | Biến nở thành chuỗi rỗng. Lệnh vẫn chạy, có khi vẫn exit 0 | ✅ **Đã có** (mục `P-014`, sóng 1) — `secretsUsedWithoutEmptyCheck` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Kiểm CHỮ (dòng chứa `secrets.X` phải có `-z`/`-n` cùng dòng hoặc ở một dòng trước đó), không theo dõi biến `env:` trung gian — giới hạn ghi rõ trong doc comment. Hiện không workflow nào trong `ops/workflows/` dùng `secrets.*`, nên luật này là hàng rào cho lần đầu tiên, chưa chữa ca đã có |
| **Z6** | `cron` không chạy | `main-ci.yml` (`17 * * * *` — dự phòng của G2), `watchdog.yml` | GitHub tạm ngưng workflow theo lịch khi repo im lặng lâu, và `cron` vốn là nỗ lực tốt nhất chứ không bảo đảm. Không chạy thì không có gì đỏ | **Nhịp tim.** `main-ci` ghi thời điểm chạy vào một file trong repo. Routine `crux-integrator` mỗi thứ Hai đọc file đó; cũ quá ngưỡng là mở issue `alert`. Hai cơ chế **khác họ** nhau nên không cùng chết |
| **Z7** | Routine bị tắt, hết lượt, hoặc không nhận được việc | Cả một làn | Không có lần chạy nào để mà đỏ. Backlog đứng im trông giống backlog đã xong | `watchdog` hiện đếm PR merged. Bổ sung: đọc `ops/logs/<lane>/**` (qua `readRunLogs`), làn nào không có dòng mới quá ngưỡng thì liệt kê tên làn đó trong cảnh báo. Ngưỡng theo làn, vì các làn chạy nhịp khác nhau |
| **Z8** | Nhãn `owner-merge` do `protected-area` gắn | Job gắn nhãn | Không gắn được nhãn thì `automerge` **không thấy** `owner-merge` và merge một PR chạm vùng bảo vệ. Bất biến I4 thủng, không gì đỏ | `automerge.yml` **từ chối merge** khi job `protected-area` chưa xanh **trên đúng SHA sắp merge**. Không đủ nếu chỉ kiểm "CI xanh" ở mức run |
| **Z9** | `\|\| true` và `continue-on-error: true` | Một lệnh bất kỳ trong khối `run:` | Lỗi bị nuốt ngay tại chỗ, theo đúng thiết kế — vấn đề là nó ở chỗ không ai định | ✅ **Đã có** (mục `P-014`, sóng 1) — `undocumentedSwallows` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Đòi chú thích ngay trên (đi ngược qua các dòng nối bằng `\` để một lệnh nhiều dòng chỉ cần một chú thích ở đầu khối) hoặc cùng dòng. Sửa luôn năm chỗ trong cây hiện tại lúc thêm luật: `automerge.yml`, `ci.yml` (gộp sáu lần gỡ nhãn lặp lại qua một hàm `rm_label`, chỉ cần một chỗ giải thích), `watchdog.yml` |
| **Z10** | Thiếu `set -euo pipefail` | Mọi lệnh sau lệnh hỏng đầu tiên | Bash mặc định chạy tiếp và trả mã thoát của **lệnh cuối**. Script hỏng giữa chừng vẫn exit 0 | ✅ **Đã có** (mục `P-014`, sóng 1) — `blocksMissingPipefail` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Đòi dòng THẬT đầu tiên của khối (bỏ qua dòng trống) là `set -euo pipefail`; cả 12 khối `run: \|` hiện có trong `ops/workflows/` đã đúng từ trước |
| **Z11** | Test có trên đĩa nhưng không nằm trong glob của `pnpm test` | Chính bài test | Bộ test xanh với ít test hơn nó tưởng. Không ai đếm nên không ai biết | ✅ **Đã có** (mục `P-014`, sóng 1) — `ops/scripts/check-test-coverage.ts`, script mới `pnpm check:tests`, trong `pnpm check`. So tập file `*.test.ts` quét toàn repo với ba glob y hệt `scripts.test` của `package.json`; lệch thì in tên từng file bị bỏ sót, không chỉ đếm |
| **Z12** | Bộ kiểm sổ giả định đọc mục **cuối** tới hết file | Phần kiểm "có nói về dự phòng không", cho mục cuối | Nội dung cuối file (phần "Cách thêm một giả định") trôi vào thân mục cuối và mang theo chữ khoá, làm mục đó xanh sai. **Đã xảy ra thật với G15** — chỉ lộ ra khi thêm G16 đẩy nó khỏi vị trí cuối | Cắt mục ở dấu `---` thay vì ở hết file, kèm một test âm: một sổ có mục cuối **thiếu** dự phòng phải đỏ |
| **Z13** | `pnpm replay` so snapshot | Chính phép so, nếu snapshot được cập nhật trong cùng PR | Snapshot mới khớp output mới, đương nhiên xanh. Phép so mất hết giá trị mà không báo gì | CHARTER 6.1 đã đòi `--update` đi trong **PR riêng**. Chưa có máy nào ép: thêm một job đỏ khi một PR vừa chạm `ops/golden/**` vừa chạm thứ khác. **Từ `I-009` luật đó khả thi:** trước đó fixture mang bản chép snapshot, nên mọi PR `--update` **buộc** phải sửa kèm sáu file fixture và job ấy sẽ đỏ với chính các PR nó phải cho qua. Nay fixture trỏ tập vàng bằng `upstreamFrom` và tự đi theo snapshot, nên một PR `--update` đúng luật chỉ chạm `ops/golden/**` |
| **Z14** | Dòng log `costUsd` (bất biến I8) | Bước ghi log, khi lần chạy chết trước đó | Thiếu một dòng log không làm gì đỏ. Chi phí thật cao hơn chi phí thấy được, và ngân sách học trôi | So số PR đã merge theo làn với số dòng trong `ops/logs/<lane>/**` cùng khoảng thời gian. Lệch quá ngưỡng thì báo trong bản tin ngày |
| **Z15** | Bài kiểm tự động của sổ giả định (`pnpm recheck:assumptions`) | Bài kiểm G14, khi clone chưa có ref `origin/claude/*` nào để quét | "Quét rồi không thấy gì" và "chưa quét được gì" in ra **cùng một dòng** `◦ chưa quan sát được`, và lệnh vẫn exit 0. Clone của phiên cloud chỉ fetch `main`, nên đó là chế độ chạy **mặc định** của cả ba routine: bài kiểm của thứ Hai im lặng ở hầu hết các lượt | ✅ **Đã có** — mục `I-005`: bài kiểm **tự fetch cả hai đầu vào** của mình (`claude/*` **và** `main`), và ném khi vẫn không có ref nào. Thiếu đầu vào ra `⚠ … KHÔNG CHẠY ĐƯỢC` cộng exit khác 0, không bao giờ ra `◦`. Hình dạng chung: **cấm im lặng** (cách 3) — một bài kiểm không được tự khai "không có gì để xem" khi nó chưa nhìn. ⚠️ **Bản sửa đầu chỉ fetch `claude/*`, và thế là đổi im lặng lấy số sai:** `origin/main` cũ làm commit squash lọt vào phạm vi quét ⇒ G14 `sai` giả ⇒ một issue `[QĐ]` giả gửi tới chủ dự án. Vòng soát bắt được bằng chạy thật trên một clone `--single-branch`. Bài học: khi chữa một bước im lặng, hỏi ngay "nó có đủ đầu vào để trả lời đúng chưa" — không thì chỉ đổi mặt của nhóm Z. ✅ **Sửa tiếp ở mục `I-007`:** ném vô điều kiện khi rỗng cũng là một chiều hỏng của nhóm Z — nó gộp "chưa quét được" với "kho thật sự không còn nhánh `claude/*` nào" (mọi PR đã merge, nhánh đã xoá) làm một, và ca sau vẫn là quan sát hợp lệ. `listRemoteClaudeBranches` hỏi thẳng remote bằng `ls-remote`, không qua fetch cục bộ: remote xác nhận rỗng thì trả `[]` (in `◦`, đúng nghĩa); remote không xác nhận được hoặc chính `ls-remote` lỗi thì mới ném (`⚠ … KHÔNG CHẠY ĐƯỢC`). Bài học thêm: "ném vô điều kiện khi rỗng" và "im lặng vô điều kiện khi rỗng" là hai cực của cùng một lỗi — cả hai đều đoán thay vì hỏi thẳng nguồn sự thật. ✅ **Sửa tiếp ở mục `I-012`:** một ref `refs/remotes/origin/claude/*` tồn tại cũng không có nghĩa nhánh đó còn sống — GitHub merge kiểu squash để lại nguyên xi lịch sử của nhánh đã merge đứng mãi mãi ngoài `main`. Đo được lúc phát hiện: 10/14 commit "thiếu trailer" nằm trên đúng một nhánh vậy, `claude/platform/P-009` (PR `#9` đã merge, nhánh chưa xoá) — kể cả ba commit của chính chủ dự án từ trước khi CLAUDE.md tồn tại, và bài kiểm này sẽ kêu `sai` mãi mãi vì chúng không bao giờ được sửa. `collectCommits` nay lọc còn đúng nhánh có PR **mở** (`fetchOpenPrBranches`, cùng quy ước gọi `gh` với `update-metrics.ts`); nhánh hết PR mở (đã merge/đã đóng) loại khỏi phạm vi quét, không phải nới `isToolCommit` cho tới khi hết đỏ. Bài học thêm: "còn ref trên remote" và "còn sống" là hai câu hỏi khác nhau khi merge là squash — chỉ câu hỏi thứ hai mới trả lời được đúng phạm vi |
| **Z16** | Bản sao cấu hình trong fixture của xưởng | Không có bước nào im lặng — **phép so** mới là thứ vắng mặt: `workshops/<tên>/fixtures/input.json` của cả sáu xưởng nhúng một bản sao channel pack và genre pack, và bản sao đứng yên khi bản thật đổi | Fixture chạy **độc lập** nên không có gì so nó với `packs/`, và tập vàng không băm pack (`inputsHashOf` chỉ băm con trỏ artifact đầu vào). Sáu file cùng xanh với cấu hình cũ, trong khi tập thật chạy với cấu hình mới. Đo được lúc phát hiện: bản sao channel còn `pillars` bản Đợt 0, bản sao genre thiếu **năm** khoá `limits` | ⚠️ **Một phần** — mục `I-008`. **Bản sao pack: đã bỏ hẳn.** `readInputFile` của kernel nạp pack từ `packs/` theo trường `channel`, và khoá cấp một của file `--input` là một **danh sách cho phép** (`$note`, `episodeId`, `channel`, `genre`, `locale`, `upstream`, `upstreamFrom`) — chặn đúng tên `packs` thì một bản sao đặt tên `channelPack` hay `limits` đi qua im lặng. `pnpm contracts` chạy thật `readInputFile` trên **mọi** file `--input`, validate từng artifact đầu vào theo contract, và so bốn trường bối cảnh của nó với channel pack. Hình dạng chung: **bỏ bản sao thì không cần so** — một kiểm so sánh chỉ báo sau khi đã lệch, còn một nguồn duy nhất thì không có gì để lệch; thêm nữa một pack đổi không còn phải sửa sáu file thuộc sáu làn (`P-015`). **Bản sao artifact trong khối `upstream`: đã bỏ hẳn** — mục `I-009`. Chúng là bản chép của `ops/golden/<ep>/snapshots/*.json` và đã trôi thật — đo lúc phát hiện: `assembly←visual` lệch **14** đường dẫn (`hasMotion`), `release←assembly` lệch **28** và **thiếu hẳn** trường bắt buộc `payload.preflight.antiSlide` cùng hai check `motion-coverage`, `longest-static-run`. `I-008` làm mới hai bản sao đó và bắt được ca **thiếu trường** (validate theo contract) và ca **lệch bối cảnh**, nhưng nội dung payload vẫn không bị buộc vào nguồn nào, nên một bản chép **hợp contract mà lệch snapshot** vẫn xanh. `I-009` giữ đúng hình dạng của `I-008` — **bỏ bản sao thì không cần so**: file `--input` khai `upstreamFrom` (`{ golden }`) và artifact tới từ snapshot lúc chạy (`readInputFile` của kernel), nên không còn bản chép nào để trôi. 3959 dòng bản chép trong sáu fixture đổi thành 6 con trỏ. **Danh sách xưởng cần nạp: đã bỏ khỏi fixture** — mục `I-011`. `I-009` để `upstreamFrom.workshops` khai tay, một bản chép **thứ hai** của `definition.consumes`; đo được: đổi `consumes` của một xưởng mà để fixture giữ danh sách cũ thì lần chạy độc lập vẫn xanh với một artifact thừa. Cùng hình dạng: bỏ bản chép — `readInputFile(root, path, consumes)` nhận danh sách từ bên gọi (`definition.consumes`), fixture chỉ còn `{ golden }`, và một `upstreamFrom.workshops` sót lại nay đỏ ở `pnpm contracts` (`upstreamFromWorkshopsProblems`). `ops/scripts/check-fixtures.ts` (`upstreamCopyProblems`, trong `pnpm contracts`) chặn việc chép lại: fixture **trong repo** khai thẳng `upstream` không rỗng là đỏ. Kernel **không** cấm khối `upstream` khai thẳng — chạy một xưởng độc lập với artifact viết tay là chế độ CHARTER 5.4 nói tới, và luật chặt hơn chỉ đúng cho fixture của repo. Đo bằng chạy thật: chép lại một artifact **hợp contract, khớp bối cảnh, lệch đúng một trường payload** thì `pnpm contracts` đỏ, khôi phục thì xanh. Vòng soát đo thêm một tính chất **mạnh hơn** câu trên: một bản chép **y nguyên, chưa lệch gì** cũng đỏ — luật cấm *chép*, không phải cấm *đã lệch*, nên nó chặn ngay lúc bản sao ra đời chứ không đợi tới lúc nó trôi |
| **Z17** | Lockfile sau một lần gộp **sạch** | Không có bước nào im lặng — thứ vắng mặt là **phép kiểm**: `integrator-resolve.ts` chỉ kiểm lockfile khi chính nó xung đột, còn gộp sạch thì commit thẳng | `git` ghép lockfile theo dòng, gộp sạch vẫn ra file lệch manifest; và `pnpm check` ở máy KHÔNG chạy `pnpm install --frozen-lockfile` (chỉ CI chạy). Integrator báo "xanh, đã push" rồi CI mới đỏ. Đo thêm: cổng rẻ `--lockfile-only --frozen-lockfile` cũng **xanh** trên đúng cây hỏng đó | ✅ **Đã có** — mục `I-006`, KF-007. `guardLockfileAfterMerge` chạy ở mọi đường gộp có chạm lockfile: kiểm bằng **cài thật** → tạo lại → kiểm lại → còn đỏ thì huỷ gộp. Hình dạng chung: **cổng phải là đúng lệnh mà CI chạy**, cổng rẻ hơn chỉ cho biết cổng rẻ hơn nói gì |

### Cái giá của việc không làm

Ba mục đã lộ ra (KF-001, KF-002, KF-004) đều **chỉ lộ ra vì có người bấm tay** — không mục nào được máy tìm thấy. Đó là con số đáng lo nhất trong sổ này: tỉ lệ tự phát hiện của nhóm Z hiện là **0/3**.

Rà soát này thành mục `P-014` trong `ops/lanes/platform/backlog.md`. Thứ tự làm theo giá trên mỗi đồng: **Z10 → Z11 → Z3 → Z5 → Z9** trước (đều là luật máy kiểm rẻ, viết một lần chạy mãi), rồi tới Z2, Z8, Z13 (gắn vào CI), cuối cùng Z6, Z7, Z14 (cần nhịp tim và ngưỡng, phải chỉnh dần). **Sóng 1 (Z10, Z11, Z3, Z5, Z9) đã xong** — năm luật máy kiểm, mỗi luật có test âm, chi tiết ở từng dòng bảng trên. `P-014` vẫn ở `status: ready` trong backlog: mục này cố ý không đóng một lần (sóng 2 và 3 còn lại). **Z15 đã xong** ở mục `I-005`, và nó vào bảng này theo đường khác hẳn: không ai rà ra nó, nó lộ ra vì một lượt `crux-integrator` chạy thật rồi có người đọc bản in. Đáng ghi lại vì nó đúng chỗ nhóm Z đau nhất — bài kiểm **của chính sổ giả định** cũng nằm trong nhóm Z, và nó không tự nói được là nó chưa chạy. **Z16 lần thứ tư, và lần này không phải bản sao dữ liệu mà là bản sao PHÉP KIỂM** — mục `I-013`: `topic/T-008` thêm ba contract ở `workshops/topic/contracts/`, nơi `pnpm contracts` không quét, rồi bù bằng ba test `unsupportedKeywords` viết tay. Cơ chế bù đó là **opt-in**: contract thứ tư thả vào đó mà tác giả quên viết test thì ràng buộc im lặng không được kiểm, và không gì đỏ. Cùng hình dạng chung của Z16 — *bỏ bản chép thì không cần so* — chỉ khác ở chỗ thứ bị chép là một phép kiểm chứ không phải một khối dữ liệu. `ops/scripts/check-workshop-contracts.ts` (việc số 6 của `pnpm contracts`) quét cả thư mục, ba test viết tay bỏ đi. Đáng ghi vì nó cho thấy luật "bù bằng tay ⇒ opt-in ⇒ Z" không giới hạn ở fixture. **Z16 xong hẳn** qua hai mục — bản sao pack bỏ ở `I-008`, bản sao artifact trong `upstream` bỏ ở `I-009` — và không phần nào do máy tìm ra: nó lộ ra trong vòng soát của `topic/T-002`, và phần `upstream` lộ ra trong vòng soát của chính `I-008`. **Z17 xong** ở mục `I-006`, và nó là lần đầu tiên nhóm này lộ ra theo một đường khác: không ai gặp nó trên `main`: một mục backlog viết sẵn nghi ngờ ("về lý thuyết git ghép ra một lockfile lệch") bắt phải **dựng lại bằng chạy thật trước khi xây gì**, và ca hỏng dựng được thật. Tỉ lệ tự phát hiện của nhóm Z vì vậy vẫn là **0** — sáu lần lộ ra đều nhờ người đọc hoặc người nghi — nhưng `I-006` cho thấy một đường rẻ hơn đường chờ sự cố: viết nghi ngờ thành mục backlog kèm luật "không tái hiện được thì đóng mục".

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

  **Đã kiểm, 2026-09-22 — câu trả lời là KHÔNG** (mục `VF-G17`, chi tiết ở **KF-009** dưới): GitHub **không** áp dụng `.gitattributes` khi nó tự tính "nhánh này có xung đột không" trên trang PR. Đúng như dòng này dự liệu, biểu ngữ xung đột vẫn hiện trong khi `git` ở phía worker gộp sạch — nhưng hệ quả **nặng hơn** dự liệu: `automerge.yml` nghe phía GitHub, nên một PR như vậy không tự merge được cho tới khi có một commit gộp `main` (bước 0 của phụ lục P3).

- **Đã sửa tận gốc, 2026-09-21 (quyết định `D-C04`, mục `P-018`):** log phân vùng **tới mức mục** — `ops/logs/<lane>/<id>.jsonl`. Hai PR trong cùng một làn không còn chạm cùng một file, nên nguyên nhân gốc ở trên — "đơn vị tranh chấp là dòng cuối file, và mọi PR trong làn đều ghi vào đúng đó" — không còn đúng. Union không bị gỡ: nó xuống làm **lớp phòng thủ thứ hai**, cho trường hợp còn lại là hai lần chạy cùng ghi vào **một** mục.

  **Giới hạn đã đo của lớp phòng thủ thứ hai** — phải đọc kèm, vì nó quyết định ai được dựa vào cái gì:

  1. **Luật chỉ có tác dụng khi nhánh đã mang sẵn nó TRƯỚC lần gộp.** Git đọc `.gitattributes` ở trạng thái trước khi gộp, nên luật do `main` mang tới không áp cho chính lần gộp mang nó tới (G17, đã kiểm bằng chạy thật và ghi trạng thái `sai`).
  2. **GitHub KHÔNG dùng `.gitattributes` khi tự tính `mergeable` trên trang PR** — đo được 2026-09-22, mục `VF-G17` đã chốt, chi tiết ở **KF-009** dưới. `D-C04` làm nó **bớt quan trọng** (log không còn là chỗ sinh xung đột) chứ không trả lời nó; câu trả lời tới từ chỗ khác, và nó nói rằng lớp phòng thủ thứ hai này **không bao giờ** một mình đủ để một PR merge được.
  3. Union **không** xếp theo thời gian và **không** khử trùng lặp — hai giới hạn đã đo ở trên, vẫn đúng. Vì vậy `readRunLogs` của kernel sắp theo `at` cho mọi bên đọc.

- **Máy chặn từ nay:** `ops/test/gitattributes.test.ts` khoá luật union cho từng file append-only đang có, và khoá luôn chiều ngược lại — **không** file Markdown nào được nhận `merge=union`. Union trên Markdown sẽ trộn hai mục thành một mục hỏng mà vẫn merge được: đó là nhóm Z, hỏng mà không gì đỏ.

  Cộng thêm `ops/test/logs-layout.test.ts`: **không còn file `.jsonl` phẳng nào trong `ops/logs/`**. Xoá hết file phẳng trong một PR chưa khoá được `D-C04` — hình dạng cũ quay lại được mà không gì đỏ, và đã quay lại thật một lần (`ops/logs/verify.jsonl`, PR #29 → lần gộp cuối của PR #26). Chi tiết ở `docs/decisions/D-C04.md`.

  Cùng file test còn khoá một bẫy tinh vi hơn một bậc: **dòng log nằm sai file**. Git **nhận ra đổi tên** `ops/logs/verify.jsonl` → `ops/logs/verify/VF-G2.jsonl` (cùng nội dung), nên một dòng `ref: verify/VF-G11` mà `main` thêm vào file phẳng cũ được áp thẳng lên đường dẫn mới và `merge=union` gộp êm — **không một dấu xung đột nào**, không dòng nào mất, chỉ là chi phí của `VF-G11` từ nay tính cho `VF-G2`. Luật `misfiledLogLines` đối chiếu `lane` và `logIdFromRef(ref)` của từng dòng với đường dẫn chứa nó.

### Rà nốt: còn file dùng chung nào khác

Union chỉ cứu được file mà **thứ tự dòng không mang nghĩa**. Với Markdown thì không — nên phần còn lại phải chữa bằng cách khác.

| File | Xung đột khi nào | Union có cứu được không | Cách tránh |
|---|---|---|---|
| `ops/logs/<lane>/<id>.jsonl` | ~~Hai PR cùng làn cùng thêm một dòng cuối~~ — hết, từ `D-C04`: mỗi mục một file. Còn lại: hai lần chạy cùng ghi vào **một** mục | ✅ Có — union vẫn đặt, làm lớp thứ hai | Đã xong. Bên đọc gọi `readRunLogs`, nó sắp theo `at` sẵn |
| `docs/visual/calibration-log.jsonl` | Hai lần hiệu chuẩn song song | ✅ Có — đã đặt | Đã xong |
| `ops/lanes/<lane>/backlog.md` | **Hai chỗ**: (a) hai PR cùng thêm mục mới ở đầu file — đã xảy ra ở PR #11; (b) hai PR cùng đổi `status` của hai mục nằm sát nhau | ❌ **Không.** Union sẽ lồng hai mục vào nhau, sinh một mục vô nghĩa mà git vẫn coi là merge thành công | Thêm mục mới ở **cuối file**, mỗi mục là một khối tự đủ cách nhau một dòng trống. Việc này không làm xung đột biến mất, nó làm xung đột **an toàn**: hai khối ở cuối, giải bằng cách giữ cả hai, không bao giờ mất chữ của ai. Số mục **nhận trước** ở dòng log để hai worker không cùng lấy một số |
| `ops/known-failures.md` | Hai PR cùng thêm một mục `KF-00N` ngay trước phần "Cách thêm một mục" | ❌ Không | Chuyển phần "Cách thêm một mục" lên **đầu file**, để mục mới luôn nối vào cuối. Vẫn có thể xung đột, nhưng luôn là "hai khối ở cuối", giải được trong một phút |
| `docs/assumptions.md` | **Hai chỗ cho mỗi lần thêm**: một dòng trong bảng tổng ở đầu, một mục đầy đủ ở dưới. Hai PR cùng thêm giả định là xung đột ở cả hai | ❌ Không | Mã `G<N>` **nhận trước** trong backlog làn `verify` trước khi viết, để hai worker không cùng lấy một mã. Mục đầy đủ luôn nối vào cuối, trước dấu `---` cuối. `pnpm assumptions` đã bắt được trường hợp bảng và mục lệch nhau, nên một lần giải sai sẽ đỏ chứ không im lặng |
| `ops/metrics.md` | Hai làn cùng cập nhật số tổng | ❌ Không | **Đừng viết tay.** File này là số **dẫn xuất** từ `ops/logs/**`; `ops/scripts/update-metrics.ts` (mục `I-002`) sinh nó bằng lệnh, kể cả bảng chi phí từ `D-C04`. Số dẫn xuất mà chép tay thì ngoài xung đột còn sai lặng lẽ |
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

**Một chỗ phải nói cho đúng:** quan sát ở PR #11 **không** chứng minh được GitHub bỏ qua `.gitattributes`. Ở tình huống đó git phía dưới cũng xung đột thật, nên GitHub báo xung đột là **đúng**. Câu hỏi về GitHub chỉ trả lời được bằng hai PR mà **cả hai đã mang sẵn** luật — và cặp đó **đã xuất hiện** ngày 2026-09-22: câu trả lời là **không**, ghi ở **KF-009** dưới, mục `VF-G17` đã chốt.

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

## KF-007 · `git` gộp `pnpm-lock.yaml` **sạch**, và bản gộp sạch đó vẫn hỏng

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì nó chưa từng xảy ra trên `main` mà đã **dựng lại được bằng chạy thật**, và chữ ký của nó là chữ ký mà chính `pnpm` đoán sai nguyên nhân (xem dưới).
- **Chữ ký:**
  ```
  ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  Broken lockfile: no entry for '<gói>@<phiên bản>' in pnpm-lock.yaml
  This issue is probably caused by a badly resolved merge conflict.
  ```
  ở bước cài đặt của CI, trên một PR mà integrator vừa báo "gộp sạch, `pnpm check` xanh, đã push".
- **Bằng chứng:** `ops/test/integrator-clean-merge-lockfile.test.ts`, bài kiểm đầu tiên — dựng git repo thật, gọi `pnpm` thật, không gọi mạng. Một bên bỏ phụ thuộc cuối cùng còn dùng một gói (khối `packages:` của gói đó biến mất), bên kia thêm phụ thuộc vào đúng gói đó ở một gói khác trong workspace (chỉ khối `importers` đổi). Hai vùng cách nhau xa hơn ba dòng ngữ cảnh của git, nên git áp cả hai hunk và **gộp sạch**.
- **Nguyên nhân gốc:** `git` ghép lockfile **theo dòng** và không hiểu YAML, còn `pnpm-lock.yaml` là file **dẫn xuất** có ràng buộc giữa các vùng cách xa nhau: `importers` trỏ tới phép phân giải nằm trong `packages:`. "Không xung đột" chỉ nói hai hunk không chồng lên nhau, nó không nói kết quả còn đúng. `I-004` đã chặn ca lockfile **xung đột**; ca này là ca **không** xung đột, nên nó đi thẳng qua.

  Thứ làm nó thành nhóm Z: `pnpm check` ở máy **không** chạy `pnpm install --frozen-lockfile` — chỉ CI chạy. Integrator vì thế báo xanh thật lòng rồi push một PR chắc chắn đỏ.

  Câu `This issue is probably caused by a badly resolved merge conflict` của pnpm cũng đánh lạc hướng: **không có** xung đột nào để mà giải sai. Đọc theo nghĩa đen sẽ đi tìm dấu `<<<<<<<` không tồn tại.
- **Đo được thêm, và nó đổi cách sửa:** hai cổng KHÔNG bắt cùng một thứ. Trên đúng cây gộp đó, `pnpm install --lockfile-only --frozen-lockfile` **xanh**, mã 0; `pnpm install --frozen-lockfile` **đỏ**. Cổng rẻ chỉ đối chiếu specifier của `importers` với manifest, không đi hỏi từng phép phân giải có thật trong `packages:` hay không. Cổng cuối của `regenerateLockfile` (`I-004`) là cổng rẻ đó, nên một mình nó không đủ cho ca này.
- **Đã sửa ở đâu:** `ops/scripts/integrator-resolve.ts` — hàm `guardLockfileAfterMerge`, chạy ở **mọi** đường gộp có chạm lockfile (cả `clean` lẫn union), **trước** khi commit vì bản mồi để tạo lại nằm ở `MERGE_HEAD`. Ba bước: kiểm → tạo lại bằng `ops/scripts/integrator-lockfile.ts` → kiểm lại. Còn đỏ sau khi tạo lại thì huỷ gộp và trả `aborted-ineligible` — không bao giờ push một lockfile chưa qua cổng.
- **Máy chặn từ nay:** `ops/test/integrator-clean-merge-lockfile.test.ts`, nằm trong `pnpm test` nên `pnpm check` chặn trước khi PR tới GitHub. Sáu bài kiểm: ca hỏng tái hiện được (đỏ nếu ngày nào git hoặc pnpm đổi hành vi tới mức không tái hiện được nữa — lúc đó cơ chế nên được gỡ, không giữ vì quán tính); gộp sạch có chạm lockfile thì tạo lại, kiểm lại rồi mới commit; cổng vẫn đỏ sau khi tạo lại thì huỷ gộp và không commit gì; cổng cũng chạy ở **đường union** khi lockfile gộp sạch mà một file khác vướng; lần gộp **xoá** lockfile thì không cài thật; và gộp **không** chạm lockfile thì không gọi `pnpm` lần nào — cổng là một lần cài thật, không được trả giá đó ở mọi lần gộp. Đã kiểm bằng đột biến, từng bài một: bỏ `guardLockfileAfterMerge` thì hai bài đỏ, bỏ lời gọi ở đường union thì bài union đỏ, bỏ phép kiểm "lockfile còn tồn tại" thì bài xoá đỏ.
- **Một cái bẫy con, tìm ra ở vòng soát chéo và đáng ghi riêng:** cổng là **cài thật**, mà `pnpm install` **không thấy lockfile** thì tự sinh một bản mới rồi thoát 0. Chạy cổng ở lần gộp mà một bên vừa xoá `pnpm-lock.yaml` vì thế **hồi sinh đúng file vừa bị xoá** và để lại cây bẩn — và lượt gộp kế tiếp ra `aborted-error` "cây làm việc không sạch". Hình dạng chung: **một cổng "chỉ đọc" hoá ra có ghi**; trước khi đặt một lệnh cài đặt vào vai trò kiểm tra, hỏi nó làm gì khi đầu vào vắng mặt.

---

## KF-009 · GitHub báo PR `dirty` trong khi `git` ở phía dưới gộp **sạch** — `merge=union` không áp ở phía GitHub

> Số **KF-009** chứ không phải KF-008: PR `#70` đang mở đã nhận **KF-008**. Nhận mã trước khi viết là cách hai worker không cùng lấy một số (cùng quy ước với các mã `G` trong `docs/assumptions.md`).

- **Lần gặp:** nhiều — mọi lần `mergeable_state: dirty` mà integrator đo lại thấy `EXIT=0` đều là ca này. Lần đo tách bạch được nguyên nhân: lượt `crux-integrator` 2026-09-22 02:05 giờ VN, PR `#56` và `#65`.
- **Chữ ký:** GitHub API trả `mergeable_state: "dirty"` cho một PR, `automerge.yml` vì thế không merge được nó, mà `git merge-tree --write-tree origin/<nhánh> origin/main` ở máy trả `EXIT=0` "gộp sạch" — và file duy nhất mà hai bên cùng chạm là một file `.jsonl` đã khai `merge=union` trong `.gitattributes`.
- **Nguyên nhân gốc:** `.gitattributes` khai `ops/logs/**/*.jsonl merge=union` (KF-005). `git` ở máy đọc luật đó và ghép cả hai bên; **phép tính `mergeable` của GitHub thì không**. Hai bên cùng thêm dòng vào cuối `ops/logs/platform/P-016.jsonl` vì thế là "sạch" ở một phía và "xung đột" ở phía kia. Không có gì hỏng trong nội dung PR — cái hỏng là **hai phép đo khác nhau trên cùng một câu hỏi**, và lớp tự merge chỉ nghe một phía.
- **Đo được, không suy luận** (2026-09-22, lượt integrator): `#56` và `#65` đều `dirty` trên GitHub và đều `EXIT=0` ở máy. Chạy lại đúng phép đo đó sau khi **tắt** luật union — ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes`, vốn thắng `.gitattributes` trong cây — thì cả hai lập tức `EXIT=1` với `CONFLICT (content) in ops/logs/platform/P-016.jsonl`. Bật/tắt đúng một biến, kết quả lật đúng theo nó.
- **Đo lại độc lập lần thứ hai** (2026-09-21 19:38Z, lượt `crux-worker-1`, mục `VF-G17`): `#75` (`claude/platform/P-007`) ra `mergeable_state: "dirty"` trong khi `git merge-tree --write-tree` ở máy trả `EXIT=0`, và bật/tắt union lật kết quả y như trên. Lần này bịt nốt chỗ hở duy nhất của lần đầu: `base.sha` của `#75` **đúng bằng** `main` tại lúc đo (`296869b`), nên `dirty` không thể là trạng thái cũ GitHub chưa tính lại; và nhánh với `main` cùng chạm **đúng một** file — `ops/logs/platform/P-016.jsonl` — nên không còn biến nào khác giải thích được chênh lệch. Phép đo chỉ đọc: không gộp, không push gì lên `#75`.
- **Đối chứng chặt hơn, để không ai mở lại câu hỏi vì một dòng cảnh báo:** nhánh đối chứng ở trên dùng `-merge`, vốn là *unset* — git rơi về trình merge nhị phân và **luôn** báo xung đột, kèm `warning: Cannot merge binary files`, dù file này là văn bản thuần (0 byte NUL). Nên phép đo được chạy lại với `ops/logs/**/*.jsonl merge=text`, tức trình merge văn bản thường: **`EXIT=1`, `CONFLICT (content)`, không cảnh báo nhị phân**. Kết luận không đổi — chênh lệch giữa hai phía đúng là do luật `merge=union`, không phải do cách tắt luật.
- **Đây là câu trả lời của `VF-G17`** (`ops/lanes/verify/backlog.md`), câu hỏi "GitHub có dùng `.gitattributes` khi tự tính `mergeable` không": **không**. Mục đó đã **chốt** ngày 2026-09-22 sau lần đo thứ hai, và `docs/assumptions.md` mục `G17` không còn câu hỏi nào treo. Ghi chú trong chính `.gitattributes` ("chưa được chứng minh là có ảnh hưởng tới trạng thái `mergeable` GitHub tự tính") nay có bằng chứng, và nó ngả về phía xấu. Sổ giả định `G17` đã ở trạng thái **`sai`** và đã chuyển dự phòng, nên kết luận này **không** làm đổi trạng thái giả định nào — nó siết chặt thêm lý do dự phòng phải tồn tại.
- **Đã sửa ở đâu:** không phải sửa — dự phòng đã có sẵn và đang chạy đúng: mục `P-016`, bước 0 của phụ lục P3. Integrator gộp `main` vào nhánh PR, `git` áp union ở phía có áp union, commit gộp mới làm GitHub tính lại và PR hết `dirty`. Điều KF này thêm là **vì sao** bước đó không bao giờ thừa: `.gitattributes` một mình không đủ, và sẽ không bao giờ đủ.
- **Máy chặn từ nay:** không chặn được ở phía ta — hành vi nằm ở phía GitHub. Thứ canh nó là bước 0 của P3, chạy ở đầu **mọi** lượt worker và một lần mỗi lượt integrator, cộng dòng log bắt buộc ở `ops/logs/platform/P-016.jsonl` (bất biến I8). Hệ quả phải nhớ khi đọc bản tin: một PR `automerge-delayed` bị ca này chạm sẽ **đặt lại đồng hồ 12 giờ** mỗi lần integrator gộp cho nó (CHARTER 3.3) — chậm là giá của việc merge được, không phải dấu hiệu hỏng.

---

## KF-010 · Commit gộp của bước 0 ra đời không có trailer, và bước bù bằng tay đã hụt

- **Lần gặp:** 2 (lần 1: lượt worker `crux-worker-1`, 2026-09-22 06:39 giờ VN — cả 9 commit gộp cùng lượt. Lần 2: lượt `crux-integrator` 2026-09-22 11:0x giờ VN, PR `#39`, commit gộp `c2388bf` — lần đầu **sau khi** `P-024` đã vào `main`)
- **Chữ ký:** một commit trên nhánh `claude/` có thân đúng một dòng `Gộp origin/main (integrator, không xung đột)`; `git log -1 --format=%B <sha> | grep -c 'Claude-Session'` trả `0`. Đo nhanh cả loạt: `for b in <nhánh>; do git log -1 --format=%B origin/$b | grep -c 'Claude-Session'; done`.
- **Nguyên nhân gốc:** `ops/scripts/integrator-resolve.ts` tạo commit gộp bằng `git merge` bên trong tool, nên commit sinh ra với thông điệp mặc định của tool — không trailer. Việc thêm trailer nằm **ngoài** tool, ở trí nhớ của routine đang chạy bước 0. Một bước bắt buộc mà chỗ thực thi duy nhất là trí nhớ thì sẽ hụt; đây là lần hụt đầu tiên đo được. Không phải lỗi nền tảng ghi hỏng trailer — chính lượt đó, commit **do worker tự tạo** (`0c78618`) vẫn có đủ hai trailer.
- **Vì sao không gì đỏ:** job `trailer-warn` đặt `continue-on-error: true` — cố ý, theo CHARTER mục 4 (luật cứng về trailer sẽ chặn toàn bộ công việc nếu nền tảng đổi cách ghi). Nên chín commit thiếu trailer đi qua CI xanh trơn. Đúng nhóm **Z**: hỏng mà mọi chỉ báo đều xanh.
- **Thiệt hại thật, không giả định:** phép kiểm của `VF-G14` là đọc job `trailer-warn` trên các PR do routine mở trong một tuần. Chín commit này nằm trong cửa sổ mẫu và trông y như tín hiệu "nền tảng không ghi trailer", trong khi nguyên nhân khác hẳn. Không loại chúng ra thì `G14` bị kết luận sai.
- **Không sửa lại được:** tám trong chín nhánh thuộc PR của worker khác, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác. Amend lẻ nhánh còn lại chỉ làm mẫu thêm lệch. Dòng đính chính trong `ops/logs/platform/P-016.jsonl` là bản ghi duy nhất.
- **Hai nhánh nguyên nhân, đừng quy nhầm một:** (a) bản script chạy là bản trên nhánh PR, chưa mang `P-024` — nhánh trên; (b) biến môi trường `CLAUDE_SESSION_URL` chưa được đặt ở đầu lượt routine, đây là tiêu chí `⬜` còn treo của `P-024` (`ops/lanes/platform/backlog.md`). Kể cả khi nhánh đã mang script mới, (b) một mình vẫn làm `Claude-Session` vắng — khác (a) ở chỗ (b) **có** báo ra bằng `sessionTrailerMissing`. `VF-G14` phải phân biệt hai nhánh này, nếu không nó quy một triệu chứng cho sai nguyên nhân.
- **Đã sửa ở đâu:** mục `P-024` (`ops/lanes/platform/backlog.md`) — chuyển việc ghi trailer **vào trong** `integrator-resolve.ts`, bỏ hẳn bước bù tay. Sửa chỗ sinh ra commit, không vá từng lượt chạy.
- **Lần gặp thứ hai cho thấy `P-024` chưa bịt hết, và bịt hụt ở chỗ không ai nhìn:** `P-024` sửa đúng chỗ sinh ra commit, nhưng **bản `integrator-resolve.ts` thật sự chạy ở bước 0 là bản nằm trên nhánh PR**, không phải bản trên `main` — routine `checkout` nhánh PR rồi mới `node ops/scripts/integrator-resolve.ts`. Nhánh nào mở ra trước khi `P-024` vào `main` thì vẫn chạy bản cũ, và bản cũ không ghi trailer. Đo chứ không suy: `git show <head>:ops/scripts/integrator-resolve.ts | grep -c CLAUDE_SESSION_URL` trả `3` trên `origin/main` (09c91bb) và `0` trên **cả 11** đầu nhánh PR đang mở **tại thời điểm đo, tức TRƯỚC lần gộp của lượt đó** — đo lại sau khi gộp thì cả 11 ra `3`, vì chính lần gộp mang `P-024` sang nhánh; con số `0` chỉ đúng với mốc thời gian đó (`#39 #49 #56 #62 #65 #70 #71 #79 #81 #84 #89`). Đây đúng hình dạng **G17** ở một chỗ khác: *một luật nằm trong repo không tự áp cho chính lần gộp mang nó tới*. Hệ quả tệ nhất là im lặng: bản cũ không có trường `sessionTrailerMissing`, nên kết quả trả về là `{"outcome":"clean","files":[]}` — **không có dấu hiệu nào** báo trailer đã hụt. Ba test của `P-024` không bắt được vì chúng chạy bản trên cây làm việc, tức bản mới.
- **Cầu tạm, cho tới khi mọi nhánh đang mở đã gộp `main` ít nhất một lần:** bước 0 **đọc lại** commit gộp ngay sau khi tool trả về (`git log -1 --format='%(trailers:key=Claude-Session)'`) và `git commit --amend` thêm đủ hai trailer **trước khi push** nếu trống. Không tin kết quả của tool, vì bản cũ không biết mình thiếu. Lượt 11:0x giờ VN làm đúng vậy cho 10 PR còn lại và đo lại trên đầu nhánh thật sau khi push: 2/2 dòng trailer ở cả mười. Cầu tạm tự hết vai khi nhánh đã mang `P-024`.
- **Không sửa lại được, lần hai cũng vậy:** `c2388bf` của `#39` đã push trước khi phát hiện. `#39` là nhánh của làn `visual`, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác, nên commit đó ở lại thiếu trailer và `trailer-warn` sẽ cảnh báo đúng. Cũng như lần một, mẫu của `VF-G14` phải loại `c2388bf` ra: nó là ca này, không phải tín hiệu "nền tảng không ghi trailer".
- **Máy chặn từ nay:** `ops/test/integrator-resolve.test.ts` — ba test của mục `P-024` gọi `resolveAdditiveMerge` trên cây git dựng sẵn rồi đọc `git log -1 --format=%B` của commit gộp: "commit gộp SẠCH mang Co-Authored-By trung tính model, và Claude-Session khi có URL phiên", "commit gộp UNION (resolved) cũng mang đủ hai trailer", "thiếu URL phiên: commit vẫn mang Co-Authored-By, và kết quả NÓI RA chỗ thiếu". Đo được là đỏ thật khi gỡ phần ghi trailer (11 pass → 8 pass, 3 fail). Việc ghi trailer nay nằm TRONG `ops/scripts/integrator-resolve.ts` (`trailerMessageArg`, hằng `CO_AUTHOR_TRAILER` trung tính model, đọc URL phiên từ biến môi trường `CLAUDE_SESSION_URL`), không còn ở bước bù bằng tay của routine. **Nhưng ba test đó KHÔNG phủ được lần gặp thứ hai**: chúng chạy bản trên cây làm việc, tức bản mới, trong khi ca hỏng là bước 0 chạy bản CŨ trên nhánh PR. Cổng thật sự cho ca đó là mục **`P-026`** — chạy bản của `main`, cộng một cổng đọc lại trailer và **từ chối push** khi trống, nằm trong code chứ không trong văn bản prompt. Tới khi `P-026` xong, KF này vẫn mở.

---

## KF-011 · Cửa `automerge-delayed` không bao giờ tới hạn — đồng hồ 12 giờ bị chính bước 0 đặt lại

- **Lần gặp:** 1 (đo ở lượt `crux-worker-1`, 2026-09-22 12:4x giờ VN)
- **Đối chứng phải kiểm trước khi kết luận:** câu "cửa delayed chưa bao giờ cho PR nào qua" viết trần là **sai** — `#43` đã qua. Phát biểu đúng là *máy* chưa bao giờ merge một PR delayed nào; `#43` qua được vì có người bấm, ở mốc 35 phút mà cổng 12 giờ chắc chắn còn trả `wait`. Phân biệt người với máy bằng `merged_by` (`HungQuach301` với `github-actions[bot]`), đừng bằng nhãn.
- **Chữ ký:** một PR mang nhãn `automerge-delayed`, CI xanh, `mergeable_state: clean`, mở đã nhiều hơn 12 giờ, mà `ops/invariants.merge-gate.ts` vẫn trả `{"outcome":"wait","hoursLeft":12}`. Đo nhanh cả hàng đợi: `git log --first-parent --format=%ct refs/probe/pr-<N>` rồi tìm khoảng trống lớn nhất giữa hai lần đầu nhánh đổi — dưới 12 giờ nghĩa là đồng hồ chưa từng chạy hết.
- **Nguyên nhân gốc:** `merge-gate.ts` đo 12 giờ từ `ciCompletedAt`, và có cổng `if (input.ciSha !== input.headSha) return {outcome:'skip'}` buộc lần CI đó phải thuộc **đầu nhánh hiện tại**. Bước 0 (phụ lục P3, và từ D-C06 chạy ở đầu **mọi** lượt worker theo phụ lục P1) gộp `main` vào PR rồi push. Commit mới → đầu nhánh mới → lần CI mới → đồng hồ về 0. Bước 0 chạy dày hơn 12 giờ nhiều lần, nên ngưỡng không bao giờ tới. **Không thành phần nào hỏng:** docblock của chính `merge-gate.ts` nói việc đặt lại đồng hồ là **cố ý** ("Một lần push mới vì thế đặt lại đồng hồ"). Lỗi nằm ở **vòng phản hồi** giữa nó và bước 0, không ở một file nào — nên đọc từng file riêng sẽ không bao giờ thấy.
- **Vì sao không gì đỏ:** mọi thành phần chạy **đúng luật của nó**. CI xanh, nhãn đúng, `automerge.yml` gọi `merge-gate.ts` đúng, `merge-gate.ts` trả `wait` đúng, bước 0 gộp đúng phạm vi nó được giao. Không có lỗi ở bất cứ đâu để mà đỏ — chỉ có một vòng phản hồi giữa hai cơ chế đều đúng. Đúng nhóm **Z**.
- **Thiệt hại thật, không giả định, đo 2026-09-22 05:4xZ:** 13 PR đang mở mang nhãn `automerge-delayed`. Quét **toàn bộ** 79 PR đã đóng: **0** PR delayed nào do *máy* merge. Đúng một PR delayed từng vào `main` — `#43`, mở `12:41:51Z` merge `13:16:39Z`, tức **35 phút**, xa dưới ngưỡng 12 giờ, và `merged_by: HungQuach301` (người) chứ không phải `github-actions[bot]` như PR do máy merge (đối chứng `#113`). Tức chủ dự án merge tay. PR delayed còn lại đã đóng, `#44`, đóng mà không merge. `#39` mở từ `2026-09-21T11:43Z` (18 giờ), CI xanh, 29 lần đổi đầu nhánh trong 24 giờ, khoảng trống lớn nhất **3h19m**. Chạy `ops/invariants.merge-gate.ts` trên trạng thái thật của `#39`: `{"outcome":"wait","reason":"CI xanh được 0.3 giờ, ngưỡng 12 giờ.","hoursLeft":12}`. Chỉ **1/13** PR từng có khoảng trống ≥ 12 giờ.
- **Ca `#42` — ngưỡng gần như không với tới được ngay cả khi không ai đụng vào PR:** đầu nhánh đứng yên `2026-09-21T13:11:32Z` → `2026-09-22T01:14:17Z`, tức 12h02m45s. CI xanh khoảng `13:12Z` nên ngưỡng đạt khoảng `01:12Z`; `automerge.yml` chạy `cron: '23 * * * *'`, lượt `00:23` còn sớm và tới lượt `01:23` thì đầu nhánh đã đổi hai lần. Cửa sổ sống rộng **khoảng 2 phút**, rơi đúng giữa hai lượt. Bài học: khi đồng hồ bị đặt lại liên tục, một lịch chạy **thưa** biến "hiếm khi tới hạn" thành "không bao giờ tới hạn".
- **Phản biện đã loại trừ:** "repo còn non nên chưa PR nào kịp tới hạn" — không đúng. Cửa `automerge-delayed` ra đời cùng `D-C06`, vào `main` lúc `2026-09-21T08:30:56Z`, tức **21 giờ** tại lúc đo; PR delayed cũ nhất đã mở **18 giờ**; 5/13 PR đã mở hơn 12 giờ (`#39` 18,2h · `#42` 17,6h · `#49` 16,3h · `#56` 14,6h · `#65` 12,6h). Thời gian không phải lời giải thích.
- **Vì sao đã ghi mà vẫn sót:** hệ quả "đồng hồ đặt lại" **đã** được ghi nhiều lần — mô tả PR `#85` và `#39` nói ra, phụ lục P3 bước 0c dặn phải ghi vào ghi chú, `P-026` nhắc tới trong một tiêu chí. Nhưng mọi chỗ đó ghi nó cho **một lượt**, như một khoản phí. Không chỗ nào cộng lại theo thời gian để hỏi *ngưỡng có bao giờ tới không*. Số đo một lượt vô hại; số đo tích luỹ nói rằng cửa đã đóng. **Bài học vượt ra ngoài mục này: một hệ quả được ghi đều đặn ở mức từng lượt có thể là một lỗi chưa ai nhìn thấy ở mức tổng — luôn hỏi thêm "cộng lại trong 24 giờ thì thành cái gì".**
- **Vòng tự khoá, đây là chỗ khó nhất:** `KF-009` làm GitHub báo `dirty` → `automerge` bỏ qua → bước 0 phải gộp để gỡ `dirty` → gộp làm đồng hồ về 0 → `automerge` trả `wait`. Hai lớp phòng thủ chống nhau: **không gộp thì `dirty` chặn, gộp thì đồng hồ chặn.** Bản sửa cắt vòng này là `P-023` (dòng bước 0 xuống file riêng từng lượt, hết nguyên nhân ở `KF-009`) — nó **đã xong và đang nằm trong PR `#85`**, mà `#85` mang nhãn `automerge-delayed`. Bản sửa bị chính thứ nó sửa giữ lại. Không đường nào ra bằng máy; gỡ kẹt cần một lần merge tay.
- **Đã sửa ở đâu:** mục `P-027` (`ops/lanes/platform/backlog.md`) — kèm issue `🤖 [QĐ]` **#116**, vì cả hai phương án sửa đều chạm vùng bảo vệ: (A) bước 0 đo lại bằng `git merge-tree` trước khi tin `mergeable_state` và không gộp PR mà `git` nói là sạch — phải đi cùng `P-023`, một mình không đủ; (B) đồng hồ không tính lại vì commit gộp của bước 0 — chạm `ops/invariants.merge-gate.ts`, cửa `owner-merge`, và có thể đọc thành sửa ý nghĩa bất biến I4, tức `irreversible`.
- **Phép đo đã có (lượt `crux-worker-3` 2026-09-22):** `node ops/scripts/gate-flow.ts --prs <file.json>` trả lời "cửa `automerge-delayed` có chảy không" bằng số — `longestStableHours` (khoảng trống đầu-nhánh-không-đổi dài nhất), `clockResets` (số lần đặt lại đồng hồ), `hoursShort` (số giờ còn thiếu) cho mỗi PR mang nhãn, đọc từ `git log --first-parent` trên `refs/pull/<n>/head` cộng nhãn từ đầu vào — KHÔNG đọc văn xuôi `note`. Kiểm ở `ops/test/gate-flow.test.ts`. Verdict gộp `everFlowed`/`reachedThresholdCount` cho câu trả lời một dòng. Chạy thật 2026-09-22 trên 15 PR đang mở: **14 delayed · 0 đang ở/quá ngưỡng · 1/14 (`#42`) từng có cửa sổ ≥ 12 giờ · tổng 154 lần đặt lại đồng hồ** — số tích luỹ xác nhận chữ ký. Đếm phạm vi `origin/main..refs/pull/<n>/head` (chỉ commit riêng của PR). Lưu ý phép đo: `longestStableHours` là **cận trên** (đo phần đầu-nhánh-không-đổi từ `git log`, không trừ thời gian CI), và "từng có cửa sổ ≥ ngưỡng" là điều kiện **cần chứ không đủ** để merge (`#42` đạt cửa sổ rồi vẫn trượt vì cron).
- **Máy chặn từ nay:** **chưa đủ — phép đo có rồi, bản sửa cơ chế thì chưa.** Bản sửa (phương án A hoặc B của `P-027`) chờ `🤖 [QĐ] #116` vì chạm vùng bảo vệ. Tới khi có bản sửa và một bài kiểm dựng lại đúng hình dạng (PR `automerge-delayed` CI xanh + một commit gộp bước 0 → `merge-gate.ts` phải trả `merge`, kèm **ca âm** là commit có nội dung thật thì đồng hồ **phải** tính lại), KF này vẫn mở.

---

## KF-012 · Nguồn công bố tự mâu thuẫn với chính nó, và cách đọc theo mặt chữ ra số khác cách đọc theo ví dụ

- **Lần gặp:** 2 — cả hai trong một lượt của `topic/T-006`, trên hai cơ quan khác nhau.
- **Chữ ký:** một văn bản công bố chứa **cả** một câu quy tắc **lẫn** một ví dụ tính sẵn, và áp quy tắc theo đúng mặt chữ vào chính dữ liệu của ví dụ thì ra một con số **khác** con số ví dụ in ra.
- **Hai lần đã gặp:**
  - **TreasuryDirect**, trang *I bonds interest rates*: câu mở đầu ghi lãi suất tổng hợp đợt tháng 11-2025 là **4,03%**, còn khối "An example" ngay dưới lấy 0,90% và 1,67% rồi tự tính từng bước ra **4,26%**.
  - **IRS Pub 590-A**, Worksheet 1-2: câu hướng dẫn dòng 4 nói làm tròn lên tới bội số $10, còn ví dụ điền sẵn của cùng tài liệu in **$6.825** — không phải bội số của $10. Theo mặt chữ thì ô đó phải là $6.830, và khấu trừ cuối đổi theo.
- **Nguyên nhân gốc:** giả định ngầm rằng "một nguồn uy tín là **một** sự thật". Không phải: một trang hay một tài liệu là **nhiều** khẳng định được cập nhật ở **nhiều** thời điểm khác nhau. Câu tóm tắt ở đầu trang và khối ví dụ ở giữa trang có vòng đời riêng, và không ai kiểm chéo chúng với nhau. Bất biến I6 ("mọi con số hiển thị có nguồn hoặc có mô hình") nói con số phải **có** nguồn, nhưng không nói gì về việc nguồn đó có tự nhất quán không.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** đây là **nhóm Z** — hỏng mà mọi chỉ báo đều xanh. Ca kiểm vẫn khớp, `pnpm check` vẫn xanh, `claimId` vẫn trỏ đúng một URL có thật. Chỉ con số lên video là sai, và nó sai theo cách một người xem đọc kỹ sẽ bắt được còn CI thì không bao giờ. Bằng chứng công sức của kênh nằm đúng ở chỗ này.
- **Đã sửa ở đâu — không vá sản phẩm:** luật đọc nguồn, ghi thành ba câu và áp từ `T-006` trở đi:
  1. **Ưu tiên ví dụ tính sẵn hơn câu quy tắc.** Ví dụ tính sẵn là thứ kiểm được từng bước; câu quy tắc là thứ diễn giải được nhiều cách. Khi hai thứ lệch nhau, ca kiểm cấp 1 bám ví dụ.
  2. **Mâu thuẫn được ghi vào `assumptions` của chính file mô hình**, bằng lời, kèm cả hai con số và biên độ chênh lệch — không ghi vào chỗ khác, vì Fact & Risk Pass đọc `assumptions`.
  3. **Một con số nằm trong vùng mâu thuẫn thì không được lên video** cho tới khi có nguồn thứ hai xác nhận. Mô hình vẫn dùng được cho mọi vùng khác.
- **Máy chặn từ nay:** chưa có máy chặn, và **không thể có** bằng kiểm tra tĩnh — muốn tự phát hiện thì phải đọc hiểu văn bản nguồn, tức là chính cấp kiểm 4 (`llm-assumption-check`) vốn đang chờ `platform/P-003`. Tới lúc đó, lớp chặn là con người: Fact & Risk Pass đọc `assumptions` trước khi phát hành, và mục `editorial/E-002` là chỗ luật này phải trở thành một bước có tên.

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
