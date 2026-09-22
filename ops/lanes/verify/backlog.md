# 🤖 Backlog làn `verify` — Đợt 1

Làn nền. Kiểm các giả định chịu tải trong `docs/assumptions.md` (CHARTER mục 11).

**Luật của làn này:** kiểm bằng **chạy thật**, không bằng đọc tài liệu. Đọc tài liệu chỉ cho trạng thái "tài liệu nói vậy", và ba nhận định sai của bản C1 đều là loại đó.

Mã mục khớp mã giả định: `VF-<mã giả định>`.

---

### VF-G1 · Tài khoản có Claude Code Projects không
- deps: —
- risk: low
- status: review
- kiểm: mở `claude.ai/code`, xem có tạo được Project không.
- dự phòng nếu sai: Plan B — chỉ dùng routines.
- tiêu chí xong: trạng thái G1 trong sổ chuyển sang `đã kiểm`, kèm ngày và kết quả. Nếu không có Projects thì phụ lục P1 chuyển sang cấu hình 2 worker chạy mỗi giờ.
- ✅ **Kiểm bằng chạy thật, 2026-09-21** (lượt `crux-worker-2`) — **vế hệ quả vận hành đã chốt: cấu hình 3 worker đang chạy.** (Phạm vi: Plan B có hai vế, quan sát chỉ bác được vế "2 worker"; vế "chỉ dùng routines" vẫn tương thích. Và `Độ tin cậy` của `G1` **giữ nguyên `suy luận`** — chính mệnh đề chưa kiểm được, nâng nhãn là nới cổng CHARTER 11.1 luật 2 bằng bằng chứng không đỡ nổi.) Đo từ `ops/logs/**` (bất biến I8), không đọc tài liệu: `crux-worker-1` 4 lượt · `crux-worker-2` 8 lượt · `crux-worker-3` 5 lượt · `crux-integrator` 13 lượt nhịp trung vị 1,0 giờ (8/12 khoảng cách trong 0,9–1,1 giờ). Phụ lục P1 đã ghi con số này, và `docs/assumptions.md` mục `G1` tách giả định thành hai vế kèm bảng. Giới hạn khai trước: log **đếm thiếu** — lượt worker ra `idle` không commit gì (phụ lục P1 bước 3) — nên con số là **cận dưới**; chốt được "ít nhất ba worker", **không** chốt được nhịp chính xác của từng worker.
- ✅ **Có bài kiểm hồi quy:** `worker-fleet-cadence` trong `pnpm recheck:assumptions` (chạy lại mỗi thứ Hai, phụ lục P3 bước 4). Đội tụt về ≤ 2 worker → `sai` kèm thân issue `🤖 [QĐ]` in sẵn; không dòng log nào nhắc tên routine → `◦ chưa quan sát được`, **không** phải `khớp`; thiếu hẳn `ops/logs/` → `⚠ KHÔNG CHẠY ĐƯỢC` (mục `I-005`). Sáu chiều hỏng đều có test âm — cộng "một dòng log kể lại routine khác" và "dòng log có `at` không đọc được" (đếm và nói ra, không bỏ im lặng) — và **năm phép phá thật** đều đỏ đúng — bản đầu của test "cửa sổ neo vào dòng log mới nhất" **không** bắt được phép phá (nó gộp `observedNothing` vào phép so `verdict`, nên xanh cả khi cửa sổ neo sai). Chiều "kể lại routine khác" tìm ra bằng cách **đối chiếu lại con số đã viết vào tài liệu với con số máy in ra**: dòng log của chính mục này kể lại số lượt của cả bốn routine, nên bản đầu (đếm mọi tên nhắc trong `note`) thổi cả bốn con số lên — nay một dòng log chỉ tính cho routine viết nó.
- ⬜ **Còn treo, và KHÔNG tự kiểm được — mục này giữ `review`, không `done`:** vế "tài khoản **có** tính năng Claude Code Projects" nằm ở trang cấu hình tài khoản, agent không thấy. Ba routine hourly rời nhau cho đúng cùng một quan sát như Projects, nên số đo ở trên **không** phân biệt được hai cơ chế. Đã hỏi ở issue [#5](https://github.com/HungQuach301/crux-studio/issues/5) câu 1️⃣, mở từ 2026-09-20, chưa có câu trả lời. Chỉ chuyển `done` khi có câu trả lời của chủ dự án, không đóng khi PR merge.
- ⬜ **Phát hiện đi kèm, không sửa ở đây để khỏi trộn phạm vi:** `VF-G5` ghi `deps: —` nhưng dòng `kiểm` của nó lại đòi "dùng kết quả V-002 và A-001" — cùng cái bẫy mà mục `I-010` chữa cho `status`, lần này ở cột `deps`. Worker duyệt làn theo `deps` sẽ nhận `VF-G5` rồi mới phát hiện không chạy được.

### VF-G2 · `automerge` merge được bằng `GITHUB_TOKEN` và gọi được `main-ci`
- deps: —
- risk: low
- status: review
- kiểm: **DoD Đợt 0** — để `automerge` merge thật một PR low-risk mà không cần người, rồi xem `main-ci` có chạy ngay sau đó không.
- dự phòng: đã viết sẵn — `main-ci.yml` chạy thêm theo lịch mỗi giờ.
- tiêu chí xong: một PR low-risk đã được merge tự động, và lần chạy `main-ci` tương ứng có trong tab Actions. Ghi kết quả vào sổ.
- ✅ **Kiểm bằng chạy thật, 2026-09-21:** 11 lần `automerge.yml` merge PR bằng `GITHUB_TOKEN` (`merged_by: github-actions[bot]`), cả 11 đều được nối bằng một lần `main-ci` do `github-actions[bot]` tự gọi qua `workflow_dispatch` (không phải `push`) và xanh. Cặp khít nhất: PR #12 merge `2026-09-21T00:42:51Z` → `main-ci` run #5 khởi động `2026-09-21T00:42:53Z`. Đối chứng ngược chiều: PR #18 (`owner-merge`) do chủ dự án tự bấm merge, sinh `main-ci` bằng sự kiện `push` thật — không phải một ví dụ của G2. Danh sách đủ 11 cặp, và ghi chú về một lần soát bắt lỗi trích dẫn (bản đầu xếp nhầm PR #18 vào bảng, sai số run của PR #9 và PR #16 — đã sửa cùng PR này), ở `docs/assumptions.md` mục `G2`.
- ⬜ **Còn treo, ngoài phạm vi DoD Đợt 0:** chuỗi `automerge` → `labels.yml` và `automerge` → `sync-workflows.yml` (gọi tường minh sau khi PR đụng đúng loại file) chưa có lần nào quan sát được bằng chạy thật — 3 lần `labels` chạy tới nay đều do chủ dự án tự kích, không phải do `automerge`. Giữ mục này `review`, không `done`, cho tới khi có PR automerge thật chạm `ops/labels.json` hoặc `ops/workflows/**`.

### VF-G3 · Trần số lần chạy routine mỗi ngày
- deps: VF-G1
- risk: low
- status: ready
- kiểm: sau lượt chạy đầu tiên, mở `claude.ai/code/routines` và **đọc số lượt còn lại**.
- dự phòng nếu sai: giãn nhịp chạy hoặc giảm số worker.
- tiêu chí xong: con số thật được ghi vào sổ; số worker trong phụ lục P1 chỉnh theo con số đó.

### VF-G4 · Hạn mức gói Claude chịu được mấy worker song song
- deps: VF-G3
- risk: low
- status: ready
- kiểm: chạy 3 worker song song một ngày, đếm số lần chạm hạn mức.
- dự phòng nếu sai: giảm xuống 2 worker.

### VF-G5 · Quota phút Actions và dung lượng artifact
- deps: V-002, A-001
- ⬜ **`deps` viết ra ngày 2026-09-21 (lượt `crux-worker-2`), trước đó để `—`:** dòng `kiểm` dưới đây vốn đã đòi kết quả của `V-002` và `A-001`, nhưng `deps: —` khiến bước 3 của phụ lục P1 coi mục này là nhận được, rồi lượt nào cũng phải tự đọc dòng `kiểm` mà bỏ qua bằng phán đoán — đúng nhóm lỗi **Z**. Nay luật cơ học khớp với thực tế, không cần phán đoán nữa.
- risk: high
- status: ready
- kiểm: đo phút Actions của một lần render thử (dùng kết quả V-002 và A-001).
- dự phòng nếu sai: đưa vào ngân sách, hoặc dùng runner khác.

### VF-G6 · YouTube khoá video riêng tư khi app chưa qua kiểm tuân thủ
- deps: R-002
- risk: low
- status: ready
- kiểm: lần tải lên đầu tiên ở mục `R-002`. Tốn quota, không tốn tiền.
- dự phòng: **không đổi gì.** Giả định này đi cùng hướng với bất biến I5; contract đã khoá `visibility: "private"` bằng `const`, nên G6 sai cũng không nới được gì.
- tiêu chí xong: trạng thái thực tế của video sau lần tải lên đầu tiên được ghi vào sổ.

### VF-G7 · Điều khoản TTS, stock, font, bản đồ
- deps: —
- risk: high
- status: parked
- kiểm: đọc điều khoản từng nhà cung cấp, trích dẫn kèm ngày đọc.
- dự phòng nếu sai: đổi nhà cung cấp.
- ghi chú: cùng việc với AU-001 nhưng ở góc sổ giả định; kết quả ghi vào `ops/license-ledger.md`.
- ✅ **Nhóm font — xong cho giấy phép `OFL-1.1`, 2026-09-21:** đọc văn bản giấy phép **gốc** đi kèm gói font (`package/LICENSE` của `@fontsource/inter@5.3.0`, `registry.npmjs.org`). SIL OFL 1.1 điều 5: video đã dựng là "document created using the Font Software" nên không kéo theo nghĩa vụ nào — thương mại `được`, giao cho khách hàng B2B `được`. Giao **file font** là ca khác, có điều kiện. Bước đọc "video = document" là **suy luận** từ chính văn bản giấy phép; OFL FAQ (`scripts.sil.org`) — nguồn xác nhận chuẩn — nằm trong nhóm đích bị chặn. Phạm vi hẹp hơn chữ "font": **một** font, **một** giấy phép; điều khoản dịch vụ Google Fonts và font `Apache-2.0` chưa đọc được. Dòng sổ và trích nguyên văn ở `ops/license-ledger.md`.
- ⬜ **`parked` — ba nhóm còn lại không kiểm được từ phiên cloud.** Chính sách mạng của environment chặn **16 trên 18** đích đã đo — mọi trang điều khoản của TTS, ảnh/video stock và bản đồ trả `000`, công cụ đọc web trả `EGRESS_BLOCKED`. Hai đích mở (`registry.npmjs.org`, `cloud.google.com`) không đủ: phần điều khoản riêng cho Cloud Text-to-Speech không đọc trọn được. Bảng đo kèm giờ UTC ở `ops/license-ledger.md`.

  Đây **không** phải chữ ký lỗi lặp lần thứ ba (CLAUDE.md mục 13) mà là một chỗ chặn cứng ở lần thử đầu: không có cách nào bên trong repo đi vòng qua nó, và lách chính sách mạng là việc agent không được làm. Gỡ chặn cần chủ dự án — issue **#36** nêu ba phương án.

  **Không** hạ chuẩn bằng đoạn trích của máy tìm kiếm: đó là tóm tắt của bên thứ ba, đúng loại bằng chứng mà luật đầu file này loại bỏ.
- vì sao `parked` chứ không phải `review`: phần làm được đã xong và đã vào `main` qua PR của mục này, nhưng phần còn lại **không** chờ một lượt worker nào cả — nó chờ một việc ngoài repo mà chỉ chủ dự án làm được (#36). Để `review` thì lượt worker sau lại nhận mục này rồi lại dừng ở đúng chỗ cũ. Có câu trả lời cho #36 thì mở lại thành `ready`.
- hệ quả: `AU-001` của làn `audio` vẫn chặn, và `voice.commercialLicenseVerified` giữ `false`. Làn `audio` không đứng chờ được thì nhận mục khác — `irreversible` và chỗ chặn chỉ chặn nhánh việc của nó (CHARTER 2.3).

### VF-G8 · Đường nhận tiền và nộp thuế cho người ở Việt Nam
- deps: —
- risk: high
- status: review
- kiểm: tra điều kiện AdSense và nghĩa vụ thuế hiện hành.
- dự phòng nếu sai: mở `🤖 [QĐ]`.
- ✅ **Đọc nguồn chính thức 2026-09-21** (lượt `crux-worker-1`), G8 chuyển `suy luận` → **`tài liệu nói vậy`**. Không khai cao hơn: theo thang độ tin cậy ở đầu `docs/assumptions.md`, `đã kiểm một phần` đòi **chạy thật trong một ngữ cảnh**, mà chưa ngữ cảnh nào của đường tiền được chạy. Kết quả đầy đủ kèm URL nguồn và ngày truy cập ở `docs/assumptions.md` mục `G8`; ba điểm chính:
  - **Nhận tiền được.** Bảng phương thức thanh toán của chính AdSense xếp Việt Nam vào nhóm dùng **Check** và **Wire** (EFT và Hyperwallet **không** mở cho Việt Nam). Ngưỡng chi trả **100 USD**, phát hành giữa ngày 21 và 26 hằng tháng.
  - **⚠️ Mỹ giữ lại 30%, và không giảm được.** Người ngoài Mỹ khai đủ thông tin thuế mà không có quyền lợi hiệp định thì bị khấu trừ **30%** doanh thu từ người xem ở Mỹ. Hiệp định thuế Mỹ–Việt **đã ký 07/07/2015 nhưng chưa có hiệu lực** (kết luận suy ra từ hai nguồn, không nguồn nào nói thẳng câu đó) — IRS không liệt kê Việt Nam trong danh sách hiệp định đang hiệu lực, còn US Treasury đăng văn bản kèm đúng ghi chú "đăng khi ký, trước khi phê chuẩn và có hiệu lực". Kênh đầu tiên nhắm người xem Mỹ nên khoản này chạm gần như toàn bộ doanh thu — số cho CHARTER mục 8, đọc từ nguồn chứ không ước lượng.
  - **Nộp thuế ở Việt Nam có đường rõ ràng.** Cá nhân sáng tạo nội dung số: **GTGT 5% + TNCN 2%** trên doanh thu; ngưỡng không phải nộp thuế nay là **1 tỷ đồng/năm** (NĐ 141/2026/NĐ-CP), không còn là 100 triệu của Thông tư 40/2021. Dưới ngưỡng chỉ phải **thông báo doanh thu** chậm nhất 31/01 năm sau; trên ngưỡng thì khai và nộp từ quý vượt ngưỡng.
- ⬜ **Còn treo, không chặn Đợt 0/1 — chặn ở Mốc 8:** chưa đọc toàn văn NĐ 68/2026/NĐ-CP và NĐ 141/2026/NĐ-CP dù `vanban.chinhphu.vn` nối được; chưa chạy thật đầu cuối (mở tài khoản và nhận một lần chuyển tiền cần danh tính chủ dự án và cần đã có doanh thu); chưa kiểm ngân hàng Việt Nam nhận chuyển khoản USD cho cá nhân và thủ tục ngoại hối; **chưa kiểm 30% đã bị Mỹ giữ có được trừ vào thuế Việt Nam không** — không có hiệp định đang hiệu lực nên rủi ro đánh thuế hai lần là thật; chưa kiểm doanh thu AdSense trên website (khác YouTube) có cùng cách xử lý không.
- ghi chú về phương pháp: mục này **không** bị bức tường mạng của issue `#36` chặn nữa. Đo bằng chạy thật đầu lượt (`15:41Z`): `support.google.com` 200 · `adsense.google.com` 302 · `policies.google.com` 200 · `www.irs.gov` 200 · `luatvietnam.vn` 200. Mọi domain đã truy cập ghi ở `ops/network-domains.md` (chỉ dẫn 2 của chủ dự án trên issue bản tin #50).

### VF-G9 · Thuê người soát bản địa và giao việc qua link
- deps: —
- risk: high
- status: review
- kiểm: tìm ít nhất hai kênh tuyển thực tế và một cách giao việc không cần tài khoản.
- dự phòng nếu sai: mở `🤖 [QĐ]`. Rủi ro A4: vai "người ngoài" nhận việc qua link, có thời hạn phản hồi. Lượt kiểm 2026-09-21 **không** làm G9 sai, nên chưa phải mở.
- nguồn: `docs/assumptions.md` mục `G9`; `ops/network-domains.md`; rủi ro A4; CHARTER mục 8 (ngân sách)
- ✅ **Hai kênh tuyển, đọc trang gốc của chính hai tổ chức, 2026-09-21:** **EFA** (Editorial Freelancers Association, `www.the-efa.org/hiring/`) — *"There is no charge to use the Member Directory or Job List"*, non-member dùng được, đăng tin ở `/hiring/job-submission-form/`, tin lên trong ~48 giờ, và họ **từ chối tin trả thấp** (*"We do not post low-paying or nonpaying jobs…"*); **ACES** (The Society for Editing, `aceseditors.org/resources/job-board`) — *"a free service to the editing community"*, form ở `members.aceseditors.org/add-a-job-posting` có sẵn ô **Link to Apply** và **Email to Apply**, không đòi đăng nhập. Hai trang của chính ACES lệch nhau về hạn tin (60 ngày ở trang job-board, 30 ngày ở trang form) — ghi cả hai, không chọn hộ. Bảng giá EFA 2026 (khảo sát 11/2025–giữa 01/2026, >1.100 hội viên) ở `docs/assumptions.md` mục `G9`: copyediting 33,00–75,00 USD/giờ, proofreading 29,00–75,00 USD/giờ (hai dòng này là **min–max gộp qua 19 dòng con**, khai rõ tại chỗ), fact-checking 50,00–60,00 USD/giờ (đọc thẳng một dòng, không gộp).
- ✅ **Cách giao việc, đo bằng `curl` không xác thực trong chính lượt chạy:** link tới nội dung **công khai** (`raw.githubusercontent.com/github/gitignore/main/Node.gitignore`) trả **200** kèm 2.189 byte nội dung thật — người ngoài đọc được, không cần tài khoản. **Ngược chiều:** cả trang repo lẫn raw của `HungQuach301/crux-studio` trả **404** (repo private), kể cả khi ép rỗng header `Authorization`. Nên **"gửi link repo" KHÔNG phải một cách giao việc** — phải xuất bản riêng phần cần soát, mà xuất bản ra ngoài là CHARTER 2.3 nhóm 2, `irreversible`: agent không tự làm.
- ⬜ **Còn treo:** chưa đăng tin và chưa ai nhận việc (đăng tin là cam kết trả tiền cho người thật — `irreversible` nhóm 1), nên độ tin cậy dừng ở `đã kiểm một phần`; chưa dựng và chưa chạy thử biểu mẫu trả lời nào; `upwork.com`, `fiverr.com`, `proz.com`, `atanet.org`, `contentwriters.com` trả **403** với egress của sandbox — là chặn bot phía họ, **không** nói gì về trình duyệt của chủ dự án.
- ⬜ **Phát hiện đáng một mục `platform` sau này:** mọi đường trả lời không cần tài khoản đều đổ vào hộp thư hoặc biểu mẫu của chủ dự án; không có đường nào để agent đọc phản hồi mà không qua người. Đúng nút cổ chai **A4**, và đánh thẳng vào thước đo "thời gian của anh" (CHARTER 1.3, mặc định M8). Mục này chỉ ghi nhận.

### VF-G10 · Phiên cloud có ghi được `.github/workflows` không
- deps: —
- risk: low
- status: parked
- kiểm: trong một nhánh vứt đi, thử ghi một file vào `.github/workflows/` và push. **Không merge.**
- dự phòng nếu đúng như giả định: giữ nguyên cơ chế sync và PAT.
- nếu ghi được ổn định: có thể gỡ bỏ cơ chế sync và PAT, **thông qua một quyết định riêng** — không tự gỡ.
- ⬜ **`parked` — bài kiểm này agent không chạy được, và không phải vì thiếu thời gian.** Chính cách kiểm ("ghi một file vào `.github/workflows/`") là việc mà **hai** nguồn thẩm quyền cấm tuyệt đối: phụ lục P1 của CHARTER ("Tuyệt đối không: … sửa `.github/`") và `CLAUDE.md` mục 4. Lớp chặn máy cũng đang sống: đo lại trong chính lượt worker `crux-worker-2` 2026-09-21 ~22:25Z, một lệnh **đọc** vô hại (`cat .github/workflows/ci.yml | head -3`) đã bị `.claude/hooks/guard.mjs` chặn với đúng câu *"CHẶN — Agent không ghi vào .github/ (CHARTER 3.2, giả định G10)"*. Đi vòng qua hook bằng công cụ khác (API GitHub thay cho Bash) là **lách lớp chặn**, đúng thứ `CLAUDE.md` mục 3 gọi tên; không làm.
- ⬜ **Dữ liệu gián tiếp, đo kỹ rồi vẫn KHÔNG kết luận được.** `git log origin/main -- .github/` (tới `c7179c6`) trả **3** commit, không phải 2:
  | commit | ai | thật sự ghi `.github/`? |
  |---|---|---|
  | `9b97cea`, `9928c75` | `crux-sync` (workflow sync, PAT `WORKFLOW_SYNC_TOKEN`) | **có** |
  | `939ebb0` | committer `GitHub <noreply@github.com>` — commit **gốc** của lịch sử đang thấy, bản squash của PR #15 | **không**: nó không có cha, nên cả cây hiện ra dạng `A` (thêm mới), gồm 7 file `.github/workflows/*.yml` đã tồn tại từ trước |

  Kiểm chéo đầu nhánh thật của PR #15 (`git show --stat refs/pull/15/head`, `c5a164a`): diff của nó **không** chạm `.github/` — chỉ `.gitattributes`, `docs/`, `ops/`. Nên `939ebb0` là hiệu ứng của gốc lịch sử, không phải một lần ghi.

  **Cạm bẫy đo, ghi lại để lượt sau không vấp:** `git diff-tree -r --name-status <sha>` trả **rỗng** cho commit gốc; phải thêm `--root`, hoặc dùng `git log -- <đường dẫn>`. Bản đầu của chính mục này đếm hụt đúng vì chỗ đó.

  Kết luận đúng: dữ liệu này **không nói được gì** về việc phiên agent có quyền ghi `.github/` hay không — chưa phiên nào thử, vì hook chặn. Không dùng nó để đẩy G10 về `đúng` hay `sai`; G10 giữ độ tin cậy `tài liệu nói vậy`.
- vì sao `parked` chứ không phải `ready`: để `ready` thì mọi lượt worker đều nhận mục này ở bước 3 rồi dừng ở đúng chỗ cũ mà không ai thấy — đúng nhóm lỗi **Z** (hỏng mà không gì đỏ). Đây **không** phải chữ ký lỗi lặp lần thứ ba (`CLAUDE.md` mục 13) mà là một chỗ chặn cứng nhìn ra được ngay ở lần thử đầu.
- hệ quả: **không chặn làn nào.** Dự phòng "giữ nguyên cơ chế sync và PAT" đang chạy thật và không phụ thuộc câu trả lời; biết G10 đúng hay sai chỉ mở đường **gỡ** cơ chế đó, mà chính dòng trên đã ghi là "không tự gỡ". Giá trị của bài kiểm vì thế thấp, còn giá của nó là nới một lớp chặn (CHARTER 2.3 nhóm 5).
- mở lại thành `ready` khi: có câu trả lời cho issue **#88** (chủ dự án tự chạy bài kiểm, hoặc duyệt một ngoại lệ hẹp có thời hạn trong `guard.mjs` bằng PR `owner-merge`). Lời hứa "tôi sẽ đề xuất riêng" về G10 nằm ở issue #5 từ 2026-09-20 và chưa lượt nào thực hiện — issue #88 là việc đó.

### VF-G11 · Hook và luật deny có hiệu lực trong routine và thread không
- deps: —
- risk: high
- status: review
- kiểm: trong một lần chạy routine, cho agent thử một lệnh nằm trong danh sách chặn của `.claude/hooks/guard.mjs` và xem nó có bị chặn không.
- dự phòng nếu sai: bổ sung kiểm tra phía CI. Xem bảng hai lớp trong `.claude/README.md`. G11 ra **đúng**, nên dự phòng này chưa phải dùng tới — nhưng **lớp thứ hai vẫn giữ nguyên, không gỡ**: G11 nói về hành vi của nền tảng, mà nền tảng đổi thì không ai báo trước.
- ✅ **Kiểm bằng chạy thật TRONG routine, 2026-09-21** (lượt `crux-worker-2`): **cả hai lớp đều có hiệu lực**. 5 phép thử, mỗi phép chọn sao cho vô hại nếu không bị chặn. 2 phép bị `guard.mjs` chặn (trả về đúng câu tiếng Việt của hook, kèm đường dẫn file hook); 3 phép bị `permissions.deny` chặn (câu của lớp quyền, không nhắc hook). Phép tách hai lớp: `git push --force origin <nhánh của chính lượt chạy>` — nằm trong `permissions.deny` mà **không** có trong `guard.mjs`, và nhánh trùng khít `origin` nên chạy được thì cũng là lệnh rỗng. Đối chứng ngược: công cụ `Read` trên `.gitattributes` trong cùng lượt đọc được bình thường. Bảng đủ 5 phép, kèm lời báo lỗi của từng phép, ở `docs/assumptions.md` mục `G11`.
- ⬜ **Phát hiện phụ, đáng một mục riêng:** `guard.mjs` chặn cả lệnh **đọc** `.github/` (`cat`), trong khi `CLAUDE.md` mục 4 chỉ cấm tạo/sửa/xoá — hệ quả thật là agent không đọc được workflow đang chạy. `.claude/hooks/**` là vùng `owner-merge` nên PR này không đụng vào. Chi tiết ở `docs/assumptions.md` mục `G11`.
- ⬜ **Còn treo, khai trước thay vì để tự phát hiện:**
  - ngữ cảnh **thread** chưa kiểm — chưa chặn gì, chưa có làn nào dựa vào nó;
  - hai luật `deny` cho công cụ MCP (`merge_pull_request`, `enable_pr_auto_merge`) và luật cấm ghi `.github/` **cố ý không thử**: lớp chặn mà hỏng thì chính phép thử đã merge một PR hoặc đã ghi vào `.github/`. Chúng ở lại mức suy ra từ cùng một cơ chế đã quan sát được, không phải "đã kiểm".
- ghi chú: **không đưa được vào `pnpm recheck:assumptions`.** Bài kiểm tự động chạy được `guard.mjs` (đó là `ops/test/guard.test.ts`), nhưng điều G11 nói là *nền tảng có gọi hook hay không* — chỉ quan sát được từ bên trong một lượt agent thật. Phần chạy tự động được là hồi quy của lớp dưới: `ops/test/settings.test.ts` khoá đăng ký hook và 14 luật `deny`.

### VF-G12 · Ruleset bảo vệ nhánh trên repo private cần gói nào
- deps: —
- risk: low
- status: review
- kiểm: thử bật ruleset trên repo này và xem GitHub đòi gì.
- dự phòng nếu sai: không bật ruleset; dựa vào `automerge.yml` và hook.
- tiêu chí xong: trạng thái G12 trong sổ chuyển sang `đã kiểm`, kèm ngày và kết quả thật.
- ✅ **Chủ dự án đã bật, 2026-09-21 14:01Z** (issue bản tin `#50`): ruleset `protect-main`, năm check bắt buộc `check`, `secret-scan`, `fix-has-test`, `protected-area`, `trailer-warn`.
- ✅ **Đo lại từ phía agent, 2026-09-21 20:16Z:** `main` trả `protected: true` (mọi nhánh `claude/*` đều `false`, 52 nhánh tại thời điểm đo); mọi PR đang mở có đúng 5 check run mang đúng năm tên đó; và `automerge.yml` **vẫn merge được** bằng `GITHUB_TOKEN` sau khi ruleset bật — PR `#52` merge `14:44:01Z` với `merged_by: github-actions[bot]`, và từ mốc bật tới `20:15Z` có **17** PR vào `main`, không lần nào chủ dự án phải bấm.
- ✅ **Tách nguồn, không trộn (bất biến I6):** ba dòng trên là **phép đo**. Còn *tên* ruleset (`protect-main`) và *danh sách năm check* thì agent **không xác minh lại được** — trang Settings nằm ngoài tầm nhìn, và cờ `protected` bật cả với branch protection cổ điển. Hai điều đó là **lời chủ dự án, nguồn `#50`**. Đủ để hành động theo, nhưng ghi đúng là lời. Bảng đầy đủ ở `docs/assumptions.md` mục `G12`.
- ✅ **Nói đúng phạm vi:** vế "cần gói GitHub Pro" không đo được từ phía agent và **không còn chịu tải** — nó chỉ dùng để quyết định có dựa vào ruleset hay không, mà câu đó nay đã trả lời bằng chạy thật. Dự phòng giữ nguyên, không gỡ.
- ✅ **Máy canh cho thứ mới chịu tải:** năm *tên* check nay là hợp đồng giữa Settings của GitHub (ngoài repo) và `ops/workflows/ci.yml` (trong repo). `ops/scripts/required-checks.ts` giữ danh sách, `ops/test/required-checks.test.ts` đối chiếu. Đo bằng phá thật: đổi `name: protected-area` thành `name: protected` → **đúng một bài đỏ**; khôi phục → xanh. Kèm ba ca âm cho đổi tên, xoá job và gộp hai job.
- ✅ **Luật:** đổi danh sách đó là `irreversible` — CHARTER 2.3 **nhóm 8**, theo chỉ dẫn của chủ dự án. Ghi vào CHARTER (2.3, 11.2, mục 10, nhật ký C6) và `CLAUDE.md` mục 14.
- ✅ **Một mâu thuẫn đã sửa, không để lặng lẽ:** `ops/workflows/README.md` trước đó viết `trailer-warn` "cố ý **không** vào danh sách", trong khi chủ dự án đã bật nó. Đã sửa, kèm lý do vì sao việc đó không biến luật mềm thành luật cứng: bước chạy của job khai `continue-on-error: true` nên job luôn kết luận `success`.
- ghi chú: mục này mở khoá `platform/P-006` (deps `VF-G12`) — ghi danh sách check bắt buộc vào `docs/decisions/`. **Không** làm ở đây: một mục = một PR.

### VF-G13 · Actions gọi được API trigger `/fire` của routine không
- deps: VF-G1
- risk: low
- status: ready
- kiểm: gọi thử API trigger từ một workflow `workflow_dispatch`.
- dự phòng nếu sai: giữ độ trễ bằng một nhịp worker; hoãn `decision-relay.yml`.

### VF-G14 · Commit của routine và thread có trailer `Claude-Session` không
- deps: VF-G1
- risk: low
- status: ready
- kiểm: đọc job `trailer-warn` của CI trên các PR do routine mở, trong một tuần.
- dự phòng nếu sai: dựa vào quy ước 🤖 và log làn.

### VF-G15 · Các mục 1–19 trong Phần L của spec tham chiếu
- deps: —
- risk: high
- status: parked
- kiểm: theo từng mục; chia nhỏ thành mục con khi tới lượt.
- ghi chú: `parked` cho tới khi có một làn cần tới một mục cụ thể. Mở cả 19 mục bây giờ là mở rộng phạm vi không có người tiêu thụ.

### VF-G16 · Routine có chạy trọn một mục mà không cần người bấm cấp quyền không
- deps: VF-G1
- risk: medium
- status: ready
- kiểm: bật một routine worker và để nó nhận một mục backlog. Xem lần chạy đó có đi hết vòng — sửa file, `pnpm check`, commit, push, mở PR, gắn nhãn — hay dừng giữa chừng ở một lời hỏi cấp quyền. Bằng chứng: link lần chạy, cộng PR nó mở ra (hoặc chỗ nó dừng).
- dự phòng nếu sai: quay `permissions.defaultMode` về `acceptEdits` và nhận việc phải bấm tay ở đúng những chỗ lần chạy đã dừng.
### VF-G17 · GitHub có dùng `.gitattributes` khi tự tính `mergeable` không
> **Đã trả lời: KHÔNG.** Chốt ngày 2026-09-22 ở lượt `crux-worker-1`, sau khi đo lại độc lập lần thứ hai. Chi tiết ở phần cuối mục.

- deps: —
- risk: medium
- status: review
- **cửa merge: `open`** — mục này chỉ chạm tài liệu, sổ giả định, backlog và log. Chạy `node ops/invariants.protected-area.ts` để xác nhận, đừng đoán.
- kiểm: cần hai PR song song mà **cả hai đã mang sẵn** `.gitattributes`, cùng ghi vào **một** file append-only. Từ `D-C04` log tách tới mức mục, nên ca kiểm là hai lần chạy của cùng một mục (`ops/logs/<lane>/<id>.jsonl`) hoặc `docs/visual/calibration-log.jsonl`. Merge một PR, rồi đọc **hai** thứ: trạng thái `mergeable` của PR kia trên GitHub, và kết quả `git merge origin/main` ở phía worker. Hai câu trả lời có thể khác nhau — ghi cả hai.
- vì sao mục này treo lâu: lần quan sát ở PR #11 **không** kết luận được gì về GitHub, vì lúc đó git ở phía dưới cũng xung đột thật (nhánh chưa mang luật), nên GitHub báo xung đột là đúng. Phải chờ tới khi có một cặp PR mà **cả hai** đã mang sẵn luật. Xem G17.
- dự phòng nếu sai: đã có sẵn — mục `P-016`, integrator tự gộp `main` vào PR xung đột. Không phụ thuộc câu trả lời này.
- tiêu chí xong:
  - ✅ **Ca kiểm đã xảy ra thật, hai lần độc lập** — không phải một lần rồi suy rộng. Bảng dưới là cả hai, ghi đủ **hai** phép đo như dòng `kiểm` đòi.
  - ✅ Trạng thái trong sổ giả định kèm ngày và kết quả: `docs/assumptions.md` mục `G17` — phần "Câu hỏi còn mở nay đã trả lời". Trạng thái `sai` của `G17` **không đổi** (câu trả lời này siết thêm lý do dự phòng, không lật nó), nên không có bước "chuyển dự phòng" nào phải làm ở đây — `P-016` đã là cơ chế chính từ trước.
  - ✅ Ghi kết quả vào các phần phụ thuộc mà `G17` liệt kê, **và nói rõ chỗ cố ý để nguyên** — soát chéo bắt được chỗ này ở bản đầu, khi ba dòng dưới đây vẫn còn khai "chưa biết / còn mở" trong cùng file với `KF-009`:
    - `.gitattributes` — chú thích đầu file, chỗ trước đây ghi "chưa được chứng minh là có ảnh hưởng tới `mergeable`".
    - `ops/known-failures.md` — `KF-009` (bằng chứng), cộng **ba** chỗ cũ nay đã sửa: dòng "**Chưa kiểm**" của `KF-005`, điểm 2 phần `D-C04` của `KF-005`, và đoạn cuối phần `G17`. Để nguyên thì file tự mâu thuẫn với chính `KF-009` cách đó ~110 dòng.
    - `ops/lanes/verify/backlog.md` — mục này.
    - **Cố ý KHÔNG sửa, vì là bản ghi lịch sử chứ không phải phát biểu hiện tại:** `ops/lanes/platform/backlog.md` tiêu chí xong của `P-018` (đã `done` — ghi lại điều kiện *lúc đó*), `CHARTER.md` mục 14 nhật ký thay đổi (sửa còn đẩy cửa merge từ `open` sang `automerge-delayed`), và `docs/decisions/D-C04.md`. `ops/scripts/recheck-assumptions.ts` không phải sửa: bài kiểm `union-merge-order` chỉ nói về phía git, không khẳng định gì về `mergeable` của GitHub.
  - ✅ Không mở `🤖 [QĐ]`: CHARTER 11.1 chỉ đòi `[QĐ]` khi một giả định chuyển sang `sai` mà **chưa** có dự phòng. `G17` đã `sai` và đã có dự phòng đang chạy.

| Lần quan sát | PR | `mergeable_state` GitHub tự tính | `git merge-tree --write-tree` ở phía worker |
|---|---|---|---|
| `crux-integrator`, 2026-09-22 02:05 giờ VN | `#56`, `#65` | `dirty` | `EXIT=0`, gộp sạch |
| `crux-worker-1`, 2026-09-21 19:38Z | `#75` | `dirty` | `EXIT=0`, gộp sạch |

- **đo lại độc lập, 2026-09-21 19:38Z (lượt `crux-worker-1`) — cùng kết quả, và tách biến sạch hơn:** lần đầu (`#56`, `#65`) còn một chỗ hở cho người đọc hoài nghi — `main` vừa tiến ngay trước đó, nên `dirty` **có thể** là trạng thái cũ GitHub chưa tính lại. Lần này thì không: `base.sha` của `#75` **đúng bằng** `main` tại lúc đo (`296869b`), và file **duy nhất** mà nhánh với `main` cùng chạm là `ops/logs/platform/P-016.jsonl` — đúng một file, đã khai `merge=union`. Bật/tắt một biến trên cùng phép đo: union bật → `EXIT=0`; ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes` → `EXIT=1`, `CONFLICT (content) in ops/logs/platform/P-016.jsonl`; xoá dòng đó → `EXIT=0` trở lại. Đối chứng chặt hơn vì `-merge` là *unset* (git rơi về trình nhị phân, luôn xung đột): chạy lại với `merge=text` cũng `EXIT=1`, `CONFLICT (content)`, không cảnh báo nhị phân — chênh lệch đúng là do luật union. **Không gộp, không push gì lên `#75`** — nó là PR nháp của worker khác đang làm dở; phép đo chỉ đọc, `git merge-tree` không đụng cây làm việc.
- **hệ quả đã có chủ, không để treo ở mục này:** lớp tự merge (`automerge.yml`) nghe phía GitHub, nên một PR có thể "sạch" ở máy mà không bao giờ merge được. Cơ chế đỡ đã chạy — `P-016`, bước 0 của phụ lục P3, gộp `main` vào nhánh để GitHub tính lại. Phần *hiển thị* chỗ kẹt đó lên bản tin là `P-007` (đang mở ở `#75`). Mục này **không** mở rộng sang hai việc đó.
- **đã quan sát được, 2026-09-22 (lượt `crux-integrator` 02:05 giờ VN) — câu trả lời là KHÔNG:** đúng ca kiểm mà mục này mô tả đã xảy ra thật. `#56` và `#65` đều đã mang sẵn `.gitattributes`, cùng ghi vào một file append-only (`ops/logs/platform/P-016.jsonl`), và `#69` merge vào `main` cũng ghi vào file đó. **GitHub:** `mergeable_state: "dirty"` cho cả hai. **Phía worker:** `git merge-tree --write-tree origin/<nhánh> origin/main` trả `EXIT=0` "gộp sạch" cho cả hai, và `node ops/scripts/integrator-resolve.ts origin/main` trả `{"outcome":"clean","files":[]}`. Hai câu trả lời **khác nhau**, đúng như dòng `kiểm` dự liệu. Tách được biến: chạy lại phép đo sau khi tắt luật union (`ops/logs/**/*.jsonl -merge` trong `.git/info/attributes`, thắng `.gitattributes` trong cây) thì cả hai lập tức `EXIT=1`, `CONFLICT (content) in ops/logs/platform/P-016.jsonl`. Ghi đầy đủ ở `ops/known-failures.md` **KF-009**. Lượt đó giữ `status: ready` cho làn `verify` đọc lại và tự chốt — làn `integration` ghi quan sát, không tự chuyển trạng thái mục của làn khác. **Đã chốt ở lượt `crux-worker-1` 19:38Z**, sau khi đo lại độc lập (bullet trên).

### VF-G18 · `pnpm install --lockfile-only` có giữ phép phân giải cũ không
- deps: —
- risk: low
- status: done
- nguồn: `docs/assumptions.md` G18; mục `I-004` của làn `integration`
- tiêu chí xong:
  - ✅ **Đã kiểm bằng chạy thật, 2026-09-21** (trong PR của `I-004`): workspace tạm, phụ thuộc thật từ
    registry, hai lần chạy khác nhau đúng một điều kiện. Có bản mồi → giữ `semver@7.5.0`; xoá lockfile rồi
    sinh lại → `semver@7.8.5`. Cùng một manifest `^7.0.0`, nên chênh lệch đo được chính là tác dụng bản mồi.
  - Kiểm lại khi nâng `pnpm` qua một phiên bản chính. Không đưa vào `pnpm check`: cần mạng, và một bài kiểm
    im lặng bỏ qua khi không có mạng còn tệ hơn không có bài kiểm.

### VF-G19 · Hạn mức `search.list` của YouTube Data API là bao nhiêu
- deps: —
- risk: medium
- status: parked
- nguồn: `docs/assumptions.md` G19; mục `topic/T-008`; spec WP-014 mục 3b và mục 7
- kiểm: mở Google Cloud Console của project, đọc hạn mức thật của `search.list` (số lần gọi mỗi ngày và
  đơn vị mỗi lần gọi), so với con số 100 đang dùng. **Chỉ chủ dự án làm được** — cần tài khoản và một
  project đã bật API; phiên cloud không có project nào để mở.
- dự phòng nếu sai: đã viết sẵn — hạn mức là **tham số**, đọc từ `quota.limits` của mỗi ảnh chụp corpus
  chứ không viết cứng trong code. Sai thì sửa một số trong dữ liệu. Lớp hai: mỗi corpus ghi
  `quota.spent.searchCalls` đã tiêu thật, nên lần đầu nhà cung cấp trả 429 cũng là lần đọc được hạn mức
  thật từ chính số đã tiêu.
- tiêu chí xong: trạng thái G19 trong sổ chuyển sang `đã kiểm`, kèm ngày và con số đọc được. Hai dòng đầu
  bảng trong `packs/channels/us-personal-finance/quota-budget.md` thay bằng số thật, và
  `quota.limits.source` của corpus chuyển từ `vendor-docs` sang `console-measured` — đó là điều kiện còn
  thiếu duy nhất để `T-008` đạt tiêu chí "hạn mức được đo, không được đoán".
- ⬜ **`parked` — 2026-09-22, lượt `crux-worker-1`.** Bài kiểm nằm ngoài repo và chỉ chủ dự án chạy được;
  không có đường nào bên trong repo đi vòng qua nó. Issue **#101** nêu ba phương án. Có câu trả lời thì
  mở lại thành `ready`.
- vì sao `parked` chứ không phải `review`: không phần nào của mục này chờ một lượt worker — nó chờ hai
  con số đọc từ Cloud Console. Để `ready` thì mọi lượt worker sau lại nhận mục này (nó là mục `ready`
  đầu tiên đủ điều kiện của làn `verify` theo `ops/lanes/priority.md`) rồi lại dừng ở đúng chỗ cũ —
  đúng chỗ rò mà `VF-G7` và `VF-G10` đã vá bằng cách này.
- ✅ **Đã kiểm được phần kiểm được: phương án dự phòng đang chạy thật, không chỉ được hứa.** Đo trên
  `main` ở `f873967`, nên `parked` không để lại rủi ro nào đứng chờ:
  - **Hạn mức không xuất hiện dưới dạng hằng số ở đâu trong code.** `quotaGate` nhận
    `searchCallsPerDay` và `reserveFraction` làm **tham số** (`QuotaState`); thân hàm chỉ đọc `state.*`,
    không đọc hằng số nào. Chuỗi `100` có mặt trên **hai** dòng trong `workshops/topic/src/`, và không
    dòng nào là hạn mức: `corpus.ts:227` là một dòng **chú thích** của `quotaGate`, và `demand.ts:120`
    là `Math.round(median(rates) * 100) / 100` — **hệ số làm tròn**, không liên quan quota.
  - Giá trị thật nằm trong **dữ liệu**: `workshops/topic/data/corpus/us-personal-finance-2026-09-01.json`
    (`quota.limits.searchCallsPerDay: 100`, `source: "vendor-docs"`), và
    `workshops/topic/contracts/corpus.v0.schema.json` bắt buộc trường `source` với `enum`
    `["vendor-docs", "console-measured"]`. Nghĩa là G19 sai thì sửa một số trong một file dữ liệu.
  - Test `workshops/topic/test/corpus.test.ts:132` khẳng định `source === 'vendor-docs'` — bên tiêu thụ
    không thể lặng lẽ tin đây là số đã đo.
- ⚠️ **Một chỗ dễ sai lặng lẽ, đã ghi vào #101 và vào chính bảng quota:** bảng
  `quota-budget.md` có **hai** dòng số (số lần gọi mỗi ngày, và đơn vị mỗi lần gọi), nhưng code chỉ tiêu
  thụ **một** — `searchCallsPerDay`. Cửa dừng đếm **lần gọi**, không đếm **đơn vị**; không chỗ nào trong
  repo **tiêu thụ** "đơn vị mỗi lần gọi" — `unitsPerCall` không tồn tại trong code (`workshops/`,
  `kernel/`, `ops/scripts/`, `packs/*.json`); từ PR này trở đi nó chỉ có mặt trong văn xuôi tài
  liệu. Nếu Console hiển
  thị hạn mức theo đơn vị thì giữa số đọc được và số code dùng có một **phép chia**, và đó là chỗ một sai
  số đi vào mà không gì đỏ. Vì vậy #101 xin **hai số nguyên bản như Console hiển thị**, không xin số đã
  quy đổi.
- hệ quả: không làn nào chặn ở đây. `T-008` giữ nguyên phần đã làm (contract, kiểm mới lạ, ba đại lượng
  nhu cầu) — phần đó chạy trên corpus có sẵn và không gọi API, nên **không** đứng trên G19. Phần **xây**
  corpus (`T-011`) thì đứng trên G19, nhưng đang chặn ở chỗ nặng hơn: repo chưa có secret nào (#36).
