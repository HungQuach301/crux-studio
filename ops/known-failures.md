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
- **Đã sửa ở đâu:** chưa. Mục `P-011` trong `ops/lanes/platform/backlog.md`.
- **Máy chặn từ nay:** chưa có. Tới khi `P-011` xong, đây là luật mềm ghi trong tài liệu.

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
