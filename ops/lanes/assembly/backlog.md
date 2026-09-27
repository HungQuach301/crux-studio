# 🤖 Backlog làn `assembly` — Đợt 1

Xưởng Dựng (S10, S12–S15, QA). Preflight đã đo thật từ Đợt 0; làn này mở rộng nó và dựng phần render.

---

### A-007 · Dựng và đăng hai clip 30fps / 60fps kèm phiếu chấm, để chủ dự án chấm được (chỉ dẫn 1 của #251)

Chủ dự án đo được và nói thẳng trên [`#251` `2026-09-27T01:48:14Z`](https://github.com/HungQuach301/crux-studio/issues/251#issuecomment-5851738849): *"Clip chưa từng được dựng; `A-001` và `V-002` bị giữ vì chờ tôi chấm."* Chỉ dẫn gốc nằm trên chính `#92` — *"dựng clip `V-002` ở 30fps và 60fps NGAY ở lượt tới, đăng link + phiếu chấm chỉ số 4–6 `WP-003` mục 5, đưa vào Việc đang chờ anh"* — và `decision-close` đã đóng `#92` trước khi ai làm nó (xem `platform/P-066`).

Vì sao tách khỏi `A-001`: `A-001` trả lời *"60fps đắt hơn bao nhiêu"* và đã đo xong. Mục này trả lời **nửa còn lại** — *"30fps có xem được không"* — và nửa đó charter giao cho **mắt chủ dự án** (`WP-003` mục 5 ghi rõ không kết luận thay anh). Hai phép đo, hai mục; gộp lại thì một mục không bao giờ `done` được.

- deps: —
  ⚠️ **Cố ý KHÔNG khai `deps: A-001`**, dù mục này dùng bộ đo của `A-001`: bộ đo đã nằm trên `main` và đã chạy thật, nên không có gì để chờ. Khai `A-001` thì mục này **không bao giờ** vào `readyNow` — `A-001` đang `review` với `- hold:` chờ chủ dự án chấm, mà anh chỉ chấm được sau khi mục này dựng clip. Đó là một vòng chờ thật mà `cycles` của `backlog-status.ts` **không** thấy (`A-001` không khai `deps: A-007`), tức đúng hình dạng nhóm **Z**.
- risk: medium — nhị phân **không commit** (`CLAUDE.md` mục 12), nên clip phải đi qua Actions artifact hoặc Releases, và link phải còn sống đủ lâu để chủ dự án xem. Hết hạn artifact là chỗ hỏng im lặng: link chết thì mục trông như đã làm mà anh vẫn không chấm được.
- status: review
- hold: chờ **chủ dự án chấm** hai clip 30fps/60fps trên `🤖 [QĐ]` `#317` (chỉ số 4 và 6 của `WP-003` mục 5). Clip đã dựng và đã đăng; ⏳ **link artifact chết `2026-10-04T13:55:02Z`** — sau mốc đó một lượt worker phải dựng lại (cách dựng ở `docs/assembly/fps-scorecard.md`). Không chấm thì `A-001` và `visual/V-002` đứng nguyên.
- nguồn: `#251` comment `2026-09-27T01:48:14Z` chỉ dẫn 1; issue `#92`; `🤖 [QĐ]` `#317`; `docs/assembly/fps-scorecard.md`; `docs/assembly/render-trial.md`; `WP-003` mục 5; `assembly/A-001`; `assembly/A-008`; `visual/V-002`; `platform/P-053` (mục "Việc đang chờ anh")
- tiêu chí xong:
  - ✅ **Hai clip thật, cùng một nội dung, 2026-09-27.** `proof-30.mp4` (30fps, 600 khung, 0,42 MB) và `proof-60.mp4` (60fps, 1200 khung, 0,49 MB), cùng 960×540 / **20,0 s**, sinh từ **cùng một clip nguồn trong cùng một lượt runner** — `ops/workflows/render-trial.yml` `workflow_dispatch` trên `main` `cd1ee5e`, `config=all · duration-ms=20000 · upload-master=false`, [run 36323906641](https://github.com/HungQuach301/crux-studio/actions/runs/36323906641) `conclusion: success`, `run_duration_ms: 158000`. Artifact `render-trial` 0,90 MB (`896 011` byte): https://github.com/HungQuach301/crux-studio/actions/runs/36323906641/artifacts/10933252529 — mọi số MB ở đây là **MB thập phân** (byte ÷ 10⁶).
  - ✅ **20 giây chứ không phải 30, và đó là một chỗ hỏng vòng soát bắt được.** Bản đầu dựng 30 s; clip nguồn dài 20 s nên `streamLoopFlag(30000, 20) = 1` làm ffmpeg phát lại và ở **giây thứ 20 cảnh nhảy ngược về đầu**. Đo bằng `scdet` (MAFD từng khung): bản 30 s có đỉnh **14,009** tại `t=20,067` trên nền trung vị **0,348** — **gấp 40×**, tức thứ giật nhất trong clip là **tạo tác của bộ đo**, nằm ngay giữa đoạn chủ dự án được yêu cầu chấm. Bản 20 s (`streamLoopFlag = 0`) có đỉnh **0,892** so với giá trị kế tiếp **0,877** — không còn điểm bất thường. Lượt 30 s cũ ([run 36322330099](https://github.com/HungQuach301/crux-studio/actions/runs/36322330099)) **đã bị thay thế và được đánh dấu đừng dùng** trong `fps-scorecard.md`, vì nó còn sống tới `2026-10-04`.
  - ✅ **Hạn sống của link đã ghi:** tạo `2026-09-27T13:55:03Z`, **chết `2026-10-04T13:55:02Z`** (`retention-days: 7`). Ghi ở cả trường `- hold:` trên, `docs/assembly/fps-scorecard.md` mục 1, và `#317`.
  - ✅ **Phiếu chấm** ở `docs/assembly/fps-scorecard.md` mục 2 và trong thân `#317`: một bảng ba dòng, mỗi dòng ba ô chọn sẵn, không câu hỏi mở. Chỉ số 4 xong thì được phép bỏ qua chỉ số 6.
    ⚠️ **Nhưng B11 chỉ đạt một nửa, khai chứ không giấu:** cái *bảng* điền trong 60 giây, còn *lấy clip* thì không — Actions artifact luôn là **zip**, GitHub Mobile không giải nén được, nên phải qua trình duyệt đã đăng nhập. `CLAUDE.md` mục 12 cho hai đường (*"Actions artifact **hoặc Releases**"*) và mục này chọn đường khó hơn cho người chấm, vì Release asset cần sửa `ops/workflows/render-trial.yml` mà workflow chỉ có hiệu lực **sau khi PR merge** + `sync-workflows` (CHARTER 3.2, **G10**) — tức không giao được clip trong chính lượt này.
  - ✅ **Mục này CÓ tới khối *"Việc đang chờ anh"* của bản tin — nhưng KHÔNG bằng dòng của chính nó.** Đo bằng chạy thật `ownerWaitingRows` + `renderOwnerWaitingLines` trên backlog thật, `readRunLogs('ops/logs')` thật và thân `#317` thật, chứ không đọc bằng mắt:
    - `ownerHoldWait(hold của A-007)` = `true`, và mục **có** trong danh sách 16 hàng.
    - Nhưng nó xếp **15/16**, còn `renderOwnerWaitingLines` cắt ở `MAX_ROWS = 8` (`ops/scripts/owner-waiting.ts:522,562`) → **dòng riêng của `A-007` KHÔNG được in.** Lý do nằm ở `compareRows` (`blockingGate` → `blocking` → `waitingDays`): mục này `chặn = 0` (chính nó cố ý không khai `deps`, và không mục nào khai `deps: A-007`), còn dòng log vừa ghi cho nó `waitingDays = 0` — tức **việc ghi log để đóng mục đã đẩy chính mục đó xuống dưới ngưỡng in**.
    - Đường tới chủ dự án đi bằng **hàng quyết định `#317`**, in ở **vị trí 3/8**, `chặn 8 mục`; cộng `assembly/A-001` ở vị trí 6 cũng dẫn `#317`. Nên chỉ dẫn 1 của `#251` vẫn đạt — bằng một cơ chế **khác** cơ chế mà ô này ban đầu khai. Bản khai cũ (*"đưa mục này vào khối"*) là **sai**, đã viết lại.
    - ⚠️ **Chỗ nhóm Z chưa có máy canh, khai chứ không giấu:** hàng `#317` in ra được là nhờ `decisionNeedsOwnerHand` khớp chuỗi `mắt anh` trong thân issue. `OWNER_HAND_SIGNALS` (`ops/scripts/owner-waiting.ts:191-196`) chỉ có `cần anh` · `chỉ anh` · `mắt anh` · `một câu của anh` — **không** có dấu hiệu nào cho *"chủ dự án"*. Đo được: thân `#317` → `true`; nhưng cùng ý đó viết là *"giao cho mắt chủ dự án"* → **`false`**. Một lần viết lại thân issue theo văn phong khác làm mục biến mất khỏi bản tin và **không gì đỏ**. Sửa đúng là ở `platform/P-053` (thêm dấu hiệu + bài kiểm), không phải ở mục này — nhưng tới khi có, đây là lời dặn: **đừng bỏ chữ `mắt anh` khỏi `#317`.**
  - ✅ **Chỗ đậu câu trả lời:** `🤖 [QĐ]` `#317` (`decision` + `reversible`), năm phần đúng `CHARTER` 2.3. Chọn **mở `[QĐ]` mới** thay vì mở lại `#92`, vì mở lại `#92` là việc của `platform/P-066` — làm ở đây là hai mục cùng sửa một thứ.
  - ⬜ **Chờ chủ dự án chấm.** Đây là ô duy nhất còn treo, và nó **không** đóng được bằng máy: `WP-003` mục 5 ghi *"Không kết luận thay chủ dự án về chỉ số 4–6"*.
  - **Khai rõ cái KHÔNG làm ở đây**, năm thứ:
    - **Không siết `fpsAllowed`.** Chốt fps là việc của `A-001` sau khi có phiếu chấm — siết trước là chốt bằng một nửa bằng chứng, đúng thứ `A-001` đã từ chối.
    - **Clip lệch `WP-003` §3b, và lệch ở đúng chỗ khó nhất.** Spec đòi clip thử *"3 phút gồm: trôi ngang chậm qua biểu đồ cột · **zoom vào một con số** · **morph giữa hai trạng thái của cùng dữ liệu** · quay lại một vùng đã xem"*. Clip ở đây dài **20 giây** và `sceneFilter` chỉ có trôi ngang cộng cột đổi chiều cao — **không zoom, không morph, không quay lại vùng cũ**. Zoom và morph là hai chuyển động **nhanh nhất** trong danh sách, tức đúng chỗ 30fps dễ giật nhất. Hệ quả phải đọc đúng: một câu trả lời **A** nghĩa là *"30fps xem được ở dải chuyển động chậm"*, **không** phải *"ở mọi chuyển động `D-04` cho phép"*. Phương án **C** của `#317` là chỗ đậu nếu chủ dự án muốn clip đủ bốn loại chuyển động trước khi chốt.
    - **Không có clip cho chỉ số 5** (30fps **có** mờ chuyển động): `render-trial.ts` không có đường sinh mờ chuyển động (`grep -nE 'motion.blur|motionBlur|tmix|minterpolate'` → **0 dòng**, thoát 1). Tách thành **`A-008`**, vì `render-trial.ts` là bộ đo của `A-001` và đổi nó lúc `A-001` còn `review` làm số đo đã đăng không so được nữa.
    - **Không trả lời ô ⬜ "phút Actions TÍNH TIỀN" của `A-001`, và không đụng giả định G5.** Lượt này dựng **20 giây**, không phải một tập đầy đủ 21 phút, và không ngoại suy tuyến tính lên được (phần cài phụ thuộc gần như cố định, phần mã hoá không tuyến tính). Thêm một chỗ hở **đo được**: `/actions/runs/36323906641/timing` trả `billable.UBUNTU.total_ms = 0`, `job_runs[0].duration_ms = 0` — **nguồn tính tiền máy đọc được đang trả 0**, nên con số "3 phút" chỉ là *giây tường làm tròn lên*, không phải phút hoá đơn (bất biến **I6**: số hiển thị phải có nguồn, và nguồn của nó là đồng hồ). G5 giữ nguyên `đã kiểm một phần`; `docs/assumptions.md` đã ghi cả hai điều này.
    - **Không công khai gì ra ngoài.** Clip nằm trong Actions artifact của chính kho này; bất biến **I5** không bị chạm.
  - ⚠️ **Hai chỗ nhóm Z mục này KHÔNG bịt được, đo thật chứ không lo xa** (chi tiết ở `fps-scorecard.md` mục 5): (a) `mv docs/assembly/fps-scorecard.md` đi rồi chạy trọn `pnpm check` → **EXIT=0, 1779/1779 pass** — toàn bộ sản phẩm của mục biến mất mà hai ô ✅ trên vẫn khẳng định nó tồn tại, không gì đỏ; (b) **hạn sống artifact không có máy nào canh** — sau `2026-10-04T13:55:02Z` link chết mà `status`, `- hold:` và mọi ✅ vẫn nguyên, `pnpm check` xanh, và không dấu hiệu nào trong 8 dấu hiệu của `watchdog.yml` nói về hạn artifact. Chính trường `risk:` của mục này đã viết ra đúng chỗ hỏng (b) rồi ship mà chưa bịt được — đáng một mục backlog cho làn `platform`.

### A-008 · Clip cho chỉ số 5 của WP-003 — 30fps CÓ mờ chuyển động

`WP-003` mục 5 đòi ba clip cho chỉ số 4–6. `A-007` dựng được hai (chỉ số 4 và 6); chỉ số **5** — *30fps **có** mờ chuyển động* — không có clip, vì `ops/scripts/render-trial.ts` không có đường sinh mờ chuyển động. Đo, không đoán: `grep -nE 'motion.blur|motionBlur|tmix|minterpolate' ops/scripts/render-trial.ts` → **0 dòng**, và sáu cấu hình của `CONFIGS` chỉ khác nhau ở fps / độ phân giải / `crf` / `preset`.

Vì sao tách khỏi `A-007`: `render-trial.ts` là **bộ đo của `A-001`**, mà `A-001` đang `status: review` chờ đúng chủ dự án chấm. Thêm một cấu hình thứ bảy làm `--config all` đổi nghĩa và làm số đo đã đăng ở `docs/assembly/render-trial.md` không so thẳng được với lượt sau — tức phá nửa bằng chứng đã có để lấy nửa chưa có.

- deps: A-007
  ⚠️ **Khai `deps: A-007` là CỐ Ý, và khác với ca của chính `A-007`.** `A-007` không khai `deps: A-001` vì nó *không* chờ `A-001` — bộ đo đã nằm trên `main` và đã chạy. Mục này thì **thật sự** chờ: chỉ số 5 chỉ đáng làm khi câu trả lời `#317` là **B**, và câu đó tới qua đúng `A-007`. Cơ chế đã kiểm bằng chạy thật: `isSatisfied` (`ops/scripts/backlog-status.ts:610`) chỉ coi một mục `review` là xong khi `classify(...) === 'stale'`, mà mục mang `- hold:` không bao giờ vào `stale` — nên `A-008` **đứng ngoài `readyNow` cho tới khi chủ dự án trả lời và ai đó gỡ `- hold:` của `A-007`**, chứ không phải chỉ tới khi PR của `A-007` merge.
  ⚠️ **Và một chỗ nhóm Z đo được trong lúc làm việc này:** `readyQueue` (`backlog-status.ts:791-829`) lọc **chỉ** theo `status` và `deps` — nó **không đọc trường `- hold:`**. Nên một mục `status: ready` mang `- hold:` vẫn nằm trong `readyNow`, và `- hold:` một mình **không** chặn được worker nhận việc. Đo thật: bản đầu của mục này khai `status: ready` + `- hold:` và vẫn hiện trong `readyNow`. Đó là lý do phải dùng `deps`, không phải `- hold:`. Trường `- hold:` ở dưới giữ lại vì nó làm việc khác: đưa mục vào khối *"Việc đang chờ anh"* và chặn `backlog:status --fix` lật trạng thái. Đáng một mục backlog cho làn `platform`.
- risk: medium — mờ chuyển động sinh bằng `tmix`/`minterpolate` của ffmpeg là **mô phỏng**, không phải mờ do bộ dựng sinh ra lúc render. Nếu đường ống thật về sau sinh mờ ở tầng canvas thì clip của mục này chấm đúng câu hỏi nhưng sai cơ chế — phải khai rõ điều đó trong phiếu chấm, đừng để nó thành một `✅` giả.
- status: ready
- hold: chờ câu trả lời **`#317` = B** (*"30fps giật, phải 60fps"*). Chỉ số 5 hỏi *"mờ chuyển động có cứu được 30fps không"* — câu đó vô nghĩa nếu anh trả lời **A** (30fps vốn đã xem được), và mục này khi đó **đóng luôn, không làm**. Trả lời **C** thì mục này xếp sau việc dựng lại clip. Không khai `- hold:` ở đây là để một mục có thể thừa nằm trong `readyNow` và một lượt worker đốt cả lượt cho nó.
- nguồn: `WP-003` mục 5 (chỉ số 5, bảng ba chỉ số); `assembly/A-007`; `assembly/A-001`; `🤖 [QĐ]` `#317`; rủi ro **R5**
- tiêu chí xong:
  - Một clip 30fps **có** mờ chuyển động, **cùng nội dung và cùng clip nguồn** với `proof-30.mp4`/`proof-60.mp4` của `A-007` — khác cái đó thì không so được, và cả ba chỉ số đều vô nghĩa.
  - Cấu hình mới **không** làm `--config all` của `A-001` đổi nghĩa: hoặc nằm ngoài `all`, hoặc `A-001` đã hết `review`. Khai rõ chọn đường nào và vì sao.
  - Phiếu chấm chỉ số 5 nối vào đúng chỗ đậu đang có (`#317`, hoặc `[QĐ]` kế thừa nó nếu `#317` đã đóng), **không** mở một hộp quyết định thứ hai cho cùng một câu hỏi.
  - Ghi **hạn sống của link** artifact, y như `A-007` — link chết là chỗ hỏng im lặng.
  - Khai rõ mờ chuyển động ở đây là mô phỏng ở tầng ffmpeg, không phải mờ sinh lúc render.

### A-001 · Thử nghiệm engine dựng, chốt 30fps hay 60fps
Quyết định này ràng buộc cả làn `visual` lẫn ngân sách phút Actions. Chốt bằng số đo, không bằng sở thích.

- deps: —
- risk: high
- status: review
- hold: chưa đo được phút Actions thật (cần một lượt `render-trial.yml` **đầy đủ 21 phút**; lượt 20 giây của `A-007` **không** thay được — xem `docs/assembly/fps-scorecard.md` mục 4); ba chỉ số 30/60fps chờ mắt chủ dự án (WP-003 mục 5) và visual/V-002. **Cập nhật 2026-09-27:** câu cũ ở đây ghi *"hai clip chưa từng được dựng"* theo `#251` `2026-09-27T01:48:14Z` — điều đó **đã hết đúng**: `assembly/A-007` đã dựng và đăng cả hai clip, phiếu chấm chỉ số 4 và 6 nằm ở `🤖 [QĐ]` `#317`. Chỉ số 5 vẫn chưa có clip (mục `assembly/A-008`).
- nguồn: CHARTER mục 10 (Đợt 1); giả định G5
- tiêu chí xong:
  - ✅ **Đo thật cả hai cấu hình, 2026-09-21** — một tập **đầy đủ** 21 phút (`targetDurationMs` của genre
    pack `data-explainer`) dựng ở cả 30fps lẫn 60fps, cộng bản proof của mỗi bên và hai lượt nền để trừ
    chi phí giải mã. Bộ đo: `ops/scripts/render-trial.ts`. Kết quả: `docs/assembly/render-trial.md`.
  - ⬜ **Phút Actions thật còn thiếu.** Số giây tường đo trên container phiên cloud (cùng 4 nhân / 16 GB
    với `ubuntu-latest`), nhưng con số hoá đơn phải do runner thật trả lời. `ops/workflows/render-trial.yml`
    làm đúng việc đó và **chỉ chạy được sau khi PR này merge** rồi `sync-workflows` chép sang `.github/`
    (CHARTER 3.2, giả định **G10**). Chạy nó là việc của lượt kế tiếp, không phải một mục mới.
  - ✅ **Đã mở `🤖 [QĐ]`** với hai phương án và số đo kèm theo: issue #92 (nhãn `decision` + `reversible`).
  - ⬜ **`fpsAllowed` giữ nguyên `[30, 60]`, cố ý.** Xem ghi chú dưới.

**Vì sao không tự chốt fps ở đây.** Quyết định fps đứng trên **hai** phép đo, và mục này chỉ có một:

| Nửa câu hỏi | Ai đo | Trạng thái |
|---|---|---|
| 60fps đắt hơn 30fps bao nhiêu | `A-001` (mục này) | ✅ đo xong |
| 30fps có giật không — clip có xem được không | `visual/V-002`, chỉ số 4–6 của WP-003 | ⬜ chưa, và WP-003 mục 5 ghi rõ **không kết luận thay chủ dự án** về ba chỉ số đó |

Siết `fpsAllowed` lúc này là chốt bằng một nửa bằng chứng, và nửa còn lại đã được charter giao cho mắt
chủ dự án chứ không cho bộ đo. Theo `D-C06` đây là quyết định `reversible`, nên việc phải làm **ngay** là
dán số và nói rõ còn thiếu gì — không phải đứng chờ, và cũng không phải đoán nốt nửa kia.

⚠️ **Nhưng "giữ cả hai" KHÔNG trung lập, và chỗ này phải nói thẳng** (vòng soát chéo bắt được):
`workshops/visual/src/index.ts` lấy `limits.fpsAllowed?.[0]` — **phần tử đầu mảng**. Nên đường ống
**đang chạy 30fps rồi**, chọn bằng thứ tự mảng chứ không bằng bằng chứng. Giữ `[30, 60]` nghĩa là
**giữ quyền đổi**, không phải "chưa chọn". Nếu `V-002` kết luận 30fps giật thì mọi thứ sinh ra trong
khoảng chờ đã ở 30fps — đó là lý do mục này dán số và mở `[QĐ]` ngay thay vì để câu hỏi treo im lặng.

**Số đo đáng chú ý:** gấp đôi số khung **không** làm gấp đôi chi phí dựng. Ở 30fps mỗi khung đắt hơn, vì
bỏ bớt khung làm chuyển động giữa hai khung liền nhau lớn hơn và bộ dự đoán chuyển động phải tìm xa hơn.
Hai hiệu ứng ngược chiều triệt tiêu một phần. Con số chính xác nằm trong `docs/assembly/render-trial.md`;
đừng chép nó vào đây, vì chép là tạo thêm một chỗ để lệch.

### A-002 · Preflight đủ 12 kiểm
Đợt 0 đã có 10 kiểm đo được từ storyboard. Ba kiểm còn lại cần Canvas Map và độ dẫn âm thanh.

- deps: V-001, AU-004
- risk: low
- status: ready
- nguồn: spec cơ chế 1
- tiêu chí xong:
  - Bổ sung kiểm 6 (phủ J-cut), 7 (vùng camera), 8 (nhất quán hướng).
  - Mỗi kiểm mới có test tái hiện một storyboard vi phạm.

### A-003 · Proof render lấy mẫu phân tầng
~460 khung trước khi cam kết ~36.000 khung. Đây là "kiểm ở chỗ rẻ nhất" ở tầng đắt nhất.

- deps: A-001
- risk: low
- status: ready
- nguồn: spec cơ chế 2
- tiêu chí xong:
  - Số ảnh tĩnh tối thiểu và loại lấy mẫu đọc từ genre pack, không ghi cứng.
  - Chi phí mỗi lần proof được ghi vào `ops/logs/assembly/<id>.jsonl` (bất biến I8 theo `D-C04`).

### A-004 · QA ba lớp ở S15
- deps: A-003
- risk: low
- status: ready
- nguồn: spec mục QA ba lớp
- tiêu chí xong: ba lớp chạy độc lập, mỗi lớp có ngưỡng riêng khai trong cấu hình.

### A-005 · Định tuyến nguyên nhân gốc
Một lỗi ở khâu dựng thường là triệu chứng của một quyết định sai ở khâu trước. Cơ chế này chỉ thẳng vào khâu đó.

- deps: A-002
- risk: low
- status: ready
- nguồn: spec cơ chế 3; CHARTER 6.6
- tiêu chí xong:
  - Mỗi finding của QA mang `rootCauseStage`.
  - Lỗi cùng loại lần thứ hai thì mở mục sửa **spec/contract/prompt**, không vá sản phẩm, và ghi vào `ops/known-failures.md`.

### A-006 · Xưởng `assembly` lên `impl: v1`
- deps: A-004, A-005
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`; các kiểm khối lượng nội dung chuyển từ `warn` sang chặn.
