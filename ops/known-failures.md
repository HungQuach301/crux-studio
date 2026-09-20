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
