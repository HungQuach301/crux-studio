# 🤖 Backlog làn `platform` — Đợt 1

Làn nền. Hạ tầng đã đủ dùng sau Đợt 0; phần còn lại là tăng tốc, không phải mở đường.

---

### P-013 · Bỏ khối `ask` để routine chạy trọn không cần người bấm — giả định G16 — **ưu tiên cao**
Chủ dự án cấp phép toàn bộ cho mọi phiên và routine, và chỉ nhận kết quả. Khối `ask` trong `.claude/settings.json` đi ngược lại điều đó: trong một lần chạy routine không có người ngồi cạnh, mỗi lời hỏi là một lần **treo tới khi hết giờ** — và không chỉ báo nào đỏ. Đây là mục **chặn** việc bật routine.

- deps: —
- risk: medium
- status: review
- nguồn: chỉ dẫn của chủ dự án trong phiên 2026-09-21; giả định **G16**
- tiêu chí xong:
  - Bỏ hẳn khối `ask` khỏi `.claude/settings.json`.
  - **Giữ nguyên** cả 14 luật `deny` và hook `PreToolUse` gọi `guard.mjs`.
  - Thêm `allow` tường minh cho `git`, `pnpm`, `node`, `npx`, `gh pr create/edit/comment/view`, `gh issue create/comment/edit/view`.
  - `permissions.defaultMode` đặt ở mức cao nhất **còn giữ được `deny` và hook** — tức `dontAsk`, không phải `bypassPermissions`.
  - Một test khoá cả bốn điều trên, để file không trôi khỏi ý định mà không ai thấy.
  - Ghi **G16** vào `docs/assumptions.md` cộng `VF-G16` ở backlog làn `verify`.
  - **Kiểm bằng chạy thật:** mục này chỉ chuyển `done` khi một lần chạy routine đi trọn một mục backlog — mở được PR và gắn được nhãn — chứ không đóng khi PR merge.
### P-016 · Integrator tự gộp `main` vào PR xung đột — **ưu tiên CAO NHẤT của làn**
> Mục này đứng **trên** P-009, P-010, P-014. Lý do: cả ba mục kia làm nhà máy **đúng hơn**, mục này làm nhà máy **chạy được**. Một hàng đợi merge bị kẹt thì ba mục kia cũng không tới đích.

Giả định **G17** đã `sai` bằng chạy thật: `.gitattributes` với `merge=union` **không** làm xung đột biến mất. Nó chỉ cứu các lần gộp sau khi nhánh đã mang sẵn luật, và nó không nói gì về trạng thái `mergeable` GitHub tính. Trong một ngày, ba PR (#10, #11, #13) đều phải giải tay — PR #11 phải giải **hai lần**.

Dự phòng của KF-005 hiện đang ở dạng ghi chú ("giữ cả hai bên"). Mục này biến nó thành cơ chế chạy thật.

**Vì sao đây là vấn đề cấu trúc, không phải xui:** hàng đợi merge là **tuần tự** (CHARTER mục 7). **Mỗi lần merge vào `main` làm mọi PR đang mở chạm file dùng chung trở thành xung đột.** Với N PR mở, một lần merge sinh tới N−1 xung đột. Đây là bậc hai theo số PR, nên nó **xấu đi đúng lúc nhà máy chạy nhanh lên** — ngược hẳn với thứ ta muốn.

- deps: —
- risk: medium
- status: review
- nguồn: giả định **G17** (`sai`); `ops/known-failures.md` KF-002 và KF-005; CHARTER mục 7
- tiêu chí xong:
  - ✅ Cơ chế đối chiếu-và-giải viết thành tool chạy được, không phải chỉ dẫn bằng lời: `ops/scripts/integrator-resolve.ts`. Gộp `ontoRef` vào HEAD; xung đột thì đối chiếu bằng `git diff --numstat` với tổ tiên chung ở CẢ hai bên trước khi quyết, đúng luật KF-002 "đối chiếu, không đoán".
  - ✅ **Giới hạn tự giải, khai trước chứ không đoán giữa chừng:** chỉ tự giải khi không bên nào xoá hay sửa dòng (numstat deletions = 0 ở cả hai bên) — tức thuần cộng thêm. Có một file không đạt thì `git merge --abort` TOÀN BỘ, không giải một phần. Test âm: `ops/test/integrator-resolve.test.ts` — một bên sửa một dòng gốc thì `outcome: "aborted-ineligible"`, HEAD và working tree không đổi.
  - ✅ Giải bằng `git merge-file --union` (đúng thuật toán `.gitattributes merge=union` đã kiểm ở KF-005) cho MỌI file xung đột đủ điều kiện, không chỉ file có khai attribute — vá đúng lỗ hổng G17 tìm ra (attribute không tự áp cho chính lần gộp mang nó tới). Test dương xác nhận cả hai dòng thêm còn nguyên, không sót dấu `<<<<<<<`.
  - ✅ **Không bao giờ** `--ours`, `--theirs`, rebase hay force-push — tool chỉ có hai đường: merge commit thường, hoặc `--abort`. Không có nhánh code nào gọi ba lệnh trên.
  - ✅ Routine `crux-integrator` (Phụ lục P3 trong CHARTER.md) cập nhật: liệt kê PR `mergeable_state` xung đột theo giờ kẹt giảm dần, gọi tool trên cho từng PR, chạy `pnpm check` + `pnpm replay` sau khi tool báo đã gộp, chỉ push khi xanh, không đụng PR `owner-merge` trừ bước gộp, không tự merge PR nào, ghi một dòng log kèm số đã giải/bỏ lại và giờ kẹt.
  - **Còn treo, ngoài phạm vi cơ chế:** hiển thị "PR xung đột, giờ kẹt giảm dần" thành một mục riêng trong bản tin ngày là việc của `P-005`/`P-007` (chưa `done`) — tới lúc đó, số giờ kẹt chỉ nằm trong `note` của dòng log `ops/logs/platform.jsonl`, đọc được nhưng chưa được trình bày.
  - **Chưa kiểm bằng chạy thật:** mục này đổi *chỉ dẫn* của routine (CHARTER.md, vùng bảo vệ) — bản thân routine chưa chạy lại theo bản mới, và **nhịp mỗi giờ cần chủ dự án tự đổi lịch** ở `claude.ai/code/routines` (agent không đổi được). Đây là lý do PR mang nhãn `owner-merge` cộng issue `🤖 [QĐ]` (irreversible, CHARTER 2.3 — "sửa charter" luôn irreversible), không tự chuyển `done` ở đây.

#### Nhịp chạy: **mỗi giờ**, không phải mỗi ngày

Một ngày một lần là **quá chậm**, và lý do là số học chứ không phải cảm tính:

| | Một ngày một lần | Mỗi giờ |
|---|---|---|
| Thời gian một PR nằm kẹt | Tới 24 giờ | Tới 1 giờ |
| Số lần merge xảy ra trong lúc kẹt | Với 2–3 worker, nhiều lần — mỗi lần lại sinh thêm một lớp xung đột chồng lên | Thường 0–1 |
| Xung đột phải giải | Nhiều lớp dồn lại, khó và dễ sai | Một lớp, thuần cộng thêm, máy giải được |
| Hệ quả | Hàng đợi tuần tự đứng im gần trọn một ngày | Hàng đợi chảy |

Điểm quyết định nằm ở dòng thứ ba: **xung đột dồn lại thì đắt hơn tổng các xung đột lẻ**, đúng như bài học số 2 của KF-002 ("gộp ngay sau mỗi lần PR dưới merge, không đợi"). Gộp muộn thì không còn nhớ vì sao mỗi bên viết thế, và phần "máy tự giải được" co lại đúng lúc cần nó nhất.

**Nhịp đúng về mặt nguyên lý là theo sự kiện — chạy ngay sau mỗi lần merge vào `main`**, vì merge chính là thứ sinh ra xung đột. Nhưng cái đó cần API trigger của routine, tức giả định **G13**, đang `tài liệu nói vậy` và đã hoãn sang Đợt 1 (mục `P-002`). Mỗi giờ là xấp xỉ rẻ nhất của "theo sự kiện" mà **không** phải chờ G13.

- ghi chú kỹ thuật, phải xử trước khi viết code:
  - **Ai push quyết định CI có chạy lại không.** Push bằng `GITHUB_TOKEN` **không** kích hoạt workflow (giả định G2, KF-004). Nếu một workflow đứng ra gộp và push, `ci` sẽ không chạy lại trên SHA mới, `automerge` sẽ không thấy CI xanh trên đúng SHA sắp merge, và PR kẹt theo một kiểu khác — lần này **không có gì đỏ**, đúng nhóm Z. Vì vậy mục này giao cho **routine integrator** (một phiên agent, dùng danh tính chủ dự án) chứ không cho một workflow. D-C01 chỉ cho hai PAT, nên không được tạo PAT thứ ba để lách.
  - Nếu sau này vẫn muốn làm bằng workflow: phải giải xong bài toán CI chạy lại trước, và **viết ra cách giải**, không để ngỏ.

### P-015 · File dùng chung trong một làn không được sinh xung đột ở mỗi PR — **ưu tiên cao**
`ops/logs/platform.jsonl` xung đột **hai lần trong một ngày** (PR #10 và #11). Cả hai PR đều base `main` — tức là đã làm đúng luật của KF-002 — và vẫn xung đột, vì nguyên nhân khác hẳn: nhiều PR cùng ghi vào **một file dùng chung**. Xem **KF-005**.

Xung đột log không khó giải, nhưng nó chặn **hàng đợi merge tuần tự** (CHARTER mục 7) và tốn một lượt worker mỗi lần.

- deps: —
- risk: low
- status: review
- nguồn: `ops/known-failures.md` KF-005; CHARTER mục 7, bất biến I8
- tiêu chí xong:
  - `.gitattributes` đặt `merge=union` cho `ops/logs/*.jsonl` và `docs/visual/calibration-log.jsonl`. ✅
  - Kiểm bằng **chạy thật**, gồm đúng hình dạng squash-rồi-gộp đã sinh lỗi. ✅ (bằng chứng trong KF-005)
  - `ops/test/gitattributes.test.ts` khoá cả hai chiều: file append-only **phải** có union, file Markdown **không được** có. ✅
  - `ops/logs/README.md` ghi rõ union **không** xếp theo thời gian, nên bên đọc phải tự sắp theo `at`. ✅
  - KF-005 nêu rõ nó khác KF-002 ở nguyên nhân, cộng bảng rà nốt các file dùng chung còn lại. ✅
  - **Còn lại, chưa làm trong mục này:** chuyển phần "Cách thêm một mục" của `ops/known-failures.md` lên đầu file; đổi quy ước thêm mục backlog sang **nối vào cuối**; `ops/metrics.md` chuyển sang sinh bằng script (thuộc `P-005`).
  - **Chưa kiểm:** GitHub có áp dụng `.gitattributes` khi tự tính xung đột trên trang PR không. Đọc ở lần hai PR song song kế tiếp.

### P-014 · Rà soát nhóm "hỏng mà mọi chỉ báo đều xanh" và dựng máy kiểm cho từng chỗ — **ưu tiên cao**
KF-001, KF-002 và KF-004 **đều thuộc một nhóm**: một bước im lặng không chạy, và không có gì đỏ. Cả ba đều chỉ lộ ra vì **có người bấm tay**. Tỉ lệ tự phát hiện của nhóm này hiện là **0/3** — đó là con số quyết định độ ưu tiên của mục này.

Rà soát đầy đủ 14 chỗ (**Z1–Z14**) nằm ở `ops/known-failures.md`, mục "Nhóm Z". Mục backlog này là phần dựng máy kiểm cho những chỗ đó.

Ba cách phát hiện có tác dụng, xếp theo thứ tự nên chọn: **so hai con số phải bằng nhau** → **nhịp tim** → **cấm im lặng**. Một bộ kiểm không chạy thì cũng không báo là nó không chạy, nên mọi cách đều phải là **một thứ ở ngoài đếm và so**, không phải một thứ ở trong tự khai.

- deps: —
- risk: medium
- status: ready
- nguồn: `ops/known-failures.md` nhóm Z; KF-001, KF-002, KF-004; rủi ro B7
- tiêu chí xong:
  - **Đợt 1 — luật linter rẻ, làm trước:** Z10 (`set -euo pipefail` bắt buộc ở mọi khối `run: |` nhiều dòng) · Z11 (đếm file `*.test.ts` trên đĩa so với số file `node --test` thật sự nạp) · Z3 (so nội dung từng file `ops/workflows/*.yml` với file cùng tên trong `.github/workflows/`, chạy trong `main-ci`) · Z5 (workflow nhắc `secrets.X` phải khẳng định `X` không rỗng trước lần dùng đầu) · Z9 (mọi `|| true` và `continue-on-error` phải có comment giải thích ngay trên).
  - **Đợt 2 — gắn vào CI:** Z2 (bước có điều kiện phải in kết luận, không `skipped` không lời — trùng phạm vi P-009, làm cùng) · Z8 (`automerge` từ chối merge khi `protected-area` chưa xanh trên đúng SHA) · Z13 (PR vừa chạm `ops/golden/**` vừa chạm thứ khác thì đỏ).
  - **Đợt 3 — nhịp tim và ngưỡng:** Z6 (`main-ci` ghi thời điểm chạy; `crux-integrator` mỗi thứ Hai đọc và cảnh báo khi cũ quá ngưỡng) · Z7 (`watchdog` đọc `ops/logs/<lane>.jsonl`, liệt kê làn không có dòng mới quá ngưỡng) · Z14 (so số PR merged theo làn với số dòng log cùng khoảng, báo trong bản tin ngày).
  - **Z12 sửa ngay, không chờ đợt:** `ops/scripts/check-assumptions.ts` cắt mục ở dấu `---` thay vì đọc mục cuối tới hết file. Kèm **test âm**: một sổ có mục cuối thiếu dòng dự phòng phải đỏ. Lỗi này đã xảy ra thật với G15 và chỉ lộ ra khi G16 đẩy nó khỏi vị trí cuối.
  - **Mỗi luật mới phải có test âm.** Một luật chỉ có giá trị khi nó đỏ đúng lúc phải đỏ — đó là bài học của KF-003, nơi một luật đỏ nhầm đã suýt ép `ci.yml` khai thừa quyền.
  - Z1 **không** nằm trong mục này: đã xong ở P-011.
  - Mục này không đóng một lần. Mỗi đợt xong thì ghi vào bảng nhóm Z ở `ops/known-failures.md` — đổi cột phải từ cách làm sang ✅ kèm tên bài kiểm.

### P-002 · `decision-relay.yml` và routine `crux-decision`
Rút độ trễ trả lời quyết định từ một nhịp worker xuống vài phút.

- deps: VF-G13
- risk: low
- status: ready
- nguồn: CHARTER 2.3, mục 9 (hoãn tới Đợt 1); giả định G13
- tiêu chí xong:
  - Workflow chỉ kích hoạt khi comment **không** bắt đầu bằng 🤖 trên issue có nhãn `decision` — comment của agent không được tự gọi lại chính agent.
  - G13 sai thì mục này `parked`, không tìm cách khác.

### P-003 · Soát chéo bằng GPT trong CI
- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 6.4 (từ Đợt 1)
- tiêu chí xong:
  - Cần secret `OPENAI_API_KEY`; thiếu thì **DỪNG và báo tên secret thiếu**, không tự tạo.
  - Nội dung gửi đi không chứa secret và không chứa nội dung không đáng tin chưa cô lập (bất biến I7).
  - Chi phí mỗi lần soát ghi vào `ops/logs/platform.jsonl`.

### P-004 · Workflow `workshop-<name>.yml` cho sáu xưởng
Mỗi xưởng gọi được độc lập bằng `workflow_dispatch` (CHARTER 5.4, D-12: nối bằng dispatch, không nối bằng sự kiện push).

- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 5.4; quyết định D-12
- tiêu chí xong:
  - Sáu file trong `ops/workflows/`, mỗi file nhận `episode` và `impl`.
  - Mỗi lần chạy ghi một dòng vào `ops/logs/<xưởng>.jsonl` có `costUsd` (bất biến I8).

### P-005 · Script gom số liệu cho bản tin ngày
Routine `crux-digest` không nên tự tính số — nó nên đọc số đã tính.

- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 2.5, phụ lục P2
- tiêu chí xong:
  - Một lệnh in ra: PR merged 24h theo làn, PR đang mở và trạng thái CI, mục `parked`, issue `[QĐ]` đang mở tách theo `reversible`/`irreversible`, chi phí 24h và tích luỹ so với ngân sách.
  - Dòng đầu luôn là `Cần anh quyết: N việc`.

### P-009 · `fix-has-test` không được bỏ qua chỉ vì nhãn gắn muộn — **ưu tiên cao**
Bất biến **I2 vế hai** ("PR có nhãn `fix` phải kèm test tái hiện lỗi") hiện **thủng**. Bằng chứng: `ci` run #1 và #2 trên PR #7 — một PR mang nhãn `fix` — đều cho job `fix-has-test` kết quả `success` với bước kiểm ở trạng thái `skipped`.

Nguyên nhân: sự kiện `pull_request` chụp `github.event.pull_request.labels` **tại thời điểm run bắt đầu**. Nhãn `fix` gắn sau đó không có trong ảnh chụp, nên điều kiện `contains(...)` sai và bước kiểm bị bỏ qua. Job vẫn xanh, nên nhìn từ ngoài không có gì khác một PR đã qua kiểm.

Đây là lỗ hổng nguy hiểm hơn vẻ ngoài: nó không làm CI đỏ, nó làm CI **xanh sai**. Và nó xảy ra ở đúng trường hợp phổ biến nhất — agent mở PR rồi mới gắn nhãn.

- deps: —
- risk: low
- status: ready
- nguồn: bất biến I2; `ci` run #1 và #2 của PR #7
- tiêu chí xong:
  - `ci.yml` thêm `labeled` và `unlabeled` vào `on.pull_request.types`, cạnh bộ mặc định `opened, synchronize, reopened`. Gắn hay gỡ nhãn `fix` đều chạy lại CI.
  - Job `fix-has-test` **tự đọc nhãn hiện tại qua API** thay vì tin vào ảnh chụp trong `github.event` — ảnh chụp luôn có thể cũ, kể cả sau khi thêm `labeled`.
  - Bước kiểm **không bao giờ `skipped` một cách im lặng**: PR không có nhãn `fix` thì in rõ "không có nhãn fix, bỏ qua" và kết thúc `success`; có nhãn thì phải chạy và phải kết luận.
  - `automerge.yml` **từ chối merge** PR mang nhãn `fix` khi job `fix-has-test` chưa xanh **trên đúng commit sắp merge**. Không đủ nếu chỉ kiểm "CI xanh" ở mức run — một run cũ từ trước lúc gắn nhãn vẫn xanh.
  - **Test âm bắt buộc:** một PR có nhãn `fix` mà diff không chạm file test nào thì `fix-has-test` phải **đỏ**, và `automerge` phải từ chối. Test dương: cùng PR đó thêm một file test thì cả hai qua.
  - Thêm một dòng vào `ops/known-failures.md` khi mục này xong, vì đây là lỗi "CI xanh sai" — loại tệ nhất.

### P-010 · Sau mỗi merge chạm `ops/workflows/`, tự chạy thử workflow vừa đổi — **ưu tiên cao**
KF-003 đã ghi: workflow chạy trên một PR là bản trong `.github/workflows/` của **nhánh PR**, mà nhánh PR thừa hưởng bản đó từ `main`. Agent không ghi được `.github/`, nên bản mới **không bao giờ** được chạy trước khi merge. `pnpm lint:workflows` chỉ bắt được cú pháp, không bắt được quyền thiếu, secret thiếu, hay một lệnh `gh` gọi sai.

Hệ quả đã xảy ra thật hai lần: `labels` run #1 hỏng vì thiếu `contents: read`, và hai workflow nữa mang lỗi cùng loại nằm im vì **chưa từng chạy**. Cả hai lần đều chỉ lộ ra khi có người bấm tay.

- deps: —
- risk: low
- status: ready
- nguồn: `ops/known-failures.md` KF-003; CHARTER 3.2 (giả định G10); rủi ro B7
- tiêu chí xong:
  - Một workflow mới, `smoke-workflows.yml`, chạy khi `main` đổi trong `ops/workflows/**` — **sau** khi `sync-workflows` chép xong, không chạy song song với nó.
  - Nó xác định **đúng những workflow vừa đổi** trong lần push đó, không chạy lại cả bộ.
  - Với mỗi workflow vừa đổi: gọi bằng chế độ chạy thử nếu workflow đó có (`inputs.dry_run`), nếu không thì gọi bằng `workflow_dispatch` thường. Workflow nào **không** có `workflow_dispatch` thì ghi rõ là không tự thử được, và liệt kê nó trong issue để người biết.
  - Thêm `inputs.dry_run` vào các workflow có tác dụng phụ ra bên ngoài — `labels` (không ghi nhãn), `notify` (không comment), `watchdog` (không mở issue), `automerge` (**không merge, tuyệt đối**). Chế độ đó phải in ra **việc nó ĐỊNH làm**, để lần chạy thử vẫn có giá trị.
  - Workflow nào đỏ thì mở **một** issue nhãn `alert` liệt kê đủ: tên workflow, link lần chạy, và dòng lỗi đầu tiên. Một issue cho cả lần push, không phải một issue mỗi workflow.
  - Chạy thử **không được** đụng tới `automerge` ở chế độ thật trong bất kỳ hoàn cảnh nào. Có test cho riêng điều này.
  - `pnpm lint:workflows` thêm một luật: workflow trong `ops/workflows/` có tác dụng phụ ra ngoài mà **không** có `inputs.dry_run` thì cảnh báo (chưa chặn, vì `sync-workflows.yml` nằm ngoài tầm agent).

### P-011 · Chuỗi báo động phải tới được điện thoại, không phụ thuộc workflow thứ hai — **ưu tiên cao**
DoD Đợt 0 đòi "một cảnh báo thử của watchdog tới được điện thoại". Nó **chưa tới**. `watchdog` run #1 xanh, issue #8 mở đúng nhãn — nhưng `notify.yml` chưa từng chạy lần nào, vì GitHub không kích hoạt workflow từ sự kiện do `GITHUB_TOKEN` tạo ra. Xem **KF-004**.

Đây là mục **chặn DoD Đợt 0**, và nó chặn đúng cơ chế tồn tại để báo khi mọi thứ khác hỏng (rủi ro **B7**).

- deps: —
- risk: low
- status: review
- nguồn: `ops/known-failures.md` KF-004; CHARTER 2.4; giả định G2
- tiêu chí xong:
  - `watchdog.yml` và `main-ci.yml` đặt `@HungQuach301` **ngay trong thân issue** chúng mở, không chờ `notify.yml`. Một `@nhắc` trong thân issue sinh thông báo của chính GitHub, không cần workflow thứ hai nào chạy.
  - `notify.yml` **giữ lại** — nó vẫn là đường duy nhất cho issue do **agent** mở bằng danh tính chủ dự án, và đường đó chưa được kiểm lần nào. Bổ sung một dòng trong file nói rõ nó **không** phủ issue do workflow mở.
  - `notify.yml` không được comment trùng khi issue đã có `@nhắc` sẵn trong thân — giữ nguyên cơ chế `MARKER` đang có.
  - **Kiểm bằng chạy thật:** bấm `watchdog` với `test_alert = true` một lần nữa và xác nhận thông báo **tới điện thoại**. Mục này chỉ đóng khi có xác nhận đó, không đóng khi PR merge.
  - Đóng issue #8 sau khi xác nhận.
  - Ghi kết quả vào KF-004 ở dòng "Đã sửa ở đâu".

### P-008 · Sửa quyền thiếu trong workflow, và đưa luật quyền vào linter
Workflow `labels` chạy tay thất bại ở bước checkout với `Repository not found` (run #1, commit `32ba4cd`). Nguyên nhân là khối `permissions` thiếu `contents: read`. Rà cả bộ tìm ra một chỗ nữa cùng loại (`watchdog.yml`), và một nghi ngờ thứ ba đã bị chính lần chạy CI bác bỏ — xem KF-003.

- deps: —
- risk: low
- status: done
- nguồn: `ops/known-failures.md` KF-003; CHARTER 3.2, bất biến I4
- tiêu chí xong:
  - ✅ `labels.yml` thêm `contents: read`; `watchdog.yml` thêm `pull-requests: read`. `ci.yml` **không** đổi: `ci` run #1 chứng minh `pull-requests: write` đã đủ để tạo nhãn.
  - ✅ `pnpm lint:workflows` có bảng thao tác → quyền tối thiểu, một luật nhận được nhiều quyền thay thế, kèm test âm tái hiện đúng các lỗi thật.
  - ✅ Nâng action lên bản chạy Node 24: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`. Phiên bản kiểm bằng `git ls-remote` cộng đọc `runs.using` trong `action.yml`, không lấy từ trí nhớ.
  - ✅ **Bằng chứng chạy thật:** sau khi PR #7 merge, `labels` run #2 trên commit `218fe70` kết thúc `success` — chính bài kiểm mà run #1 đã trượt. `main-ci` run #1 và `sync-workflows` run #2 cũng xanh.
- đóng: 2026-09-21, sau `labels` run #2.

### P-007 · Xung đột merge phải nhìn thấy được, và không được chặn hàng đợi
Hàng đợi merge là tuần tự (CHARTER mục 7). Một PR xung đột với `main` nằm giữa hàng đợi chặn mọi PR sau nó, và hiện **không có gì báo** — CI vẫn xanh, nhãn `automerge` vẫn còn, PR chỉ đơn giản là không bao giờ được merge. Đây là rủi ro **B7** ở quy mô một PR.

- deps: —
- risk: low
- status: ready
- nguồn: `ops/known-failures.md` KF-002; CHARTER 3.3, mục 7, 2.5
- tiêu chí xong:
  - `automerge.yml` đọc `mergeable` và `mergeable_state` của PR trước khi thử merge. Đang xung đột thì **bỏ qua và ghi lý do vào log của lần chạy**, không thử merge rồi để API báo lỗi — một job đỏ vì lý do đó trông giống hệt một job đỏ vì lỗi thật.
  - GitHub tính `mergeable` bất đồng bộ và trả `null` khi chưa tính xong. Workflow phải xử lý `null` bằng cách **chờ rồi hỏi lại** (vài lần, có giới hạn), không coi `null` là "merge được".
  - Script gom số liệu bản tin (`P-005`) thêm một mục: **PR đang xung đột với `main`**, kèm số giờ đã xung đột. Bản tin có mục này thì một PR bị kẹt không thể nằm im quá một ngày.
  - Routine `crux-integrator` gộp `main` vào các PR xung đột mà nó tự giải quyết được, và gắn `parked` cộng mở `🤖 [QĐ]` cho những PR cần người quyết (hai bên cùng sửa một logic).
  - Có test cho phần quyết định của `automerge.yml`: `mergeable: false` → bỏ qua; `mergeable: null` → hỏi lại; `mergeable: true` cộng đủ bốn điều kiện → merge.

### P-006 · Bảo vệ nhánh bằng ruleset
- deps: VF-G12
- risk: low
- status: ready
- nguồn: CHARTER mục 10 (việc của chủ dự án); giả định G12
- tiêu chí xong:
  - Danh sách status check bắt buộc được ghi vào `docs/decisions/` sau khi chủ dự án bật.
  - Không bật được (gói không cho) thì ghi rõ và dựa vào `automerge.yml` cộng hook.
