# 🤖 Backlog làn `platform` — Đợt 1

Làn nền. Hạ tầng đã đủ dùng sau Đợt 0; phần còn lại là tăng tốc, không phải mở đường.

---

### P-052 · Bản tin phát hiện `[QĐ]` có điều kiện đã đủ nhưng vẫn mở, và KF cho ca `#127` (D6)

Chỉ dẫn **D6** của chủ dự án trên [`#251`](https://github.com/HungQuach301/crux-studio/issues/251) (nguồn `#131` lúc `2026-09-24T23:54:32Z`): *"Ghi KF: `#127` nằm 3 ngày vì agent tin là chưa có `OPENAI_API_KEY` trong khi key đã có và `#66` đã chạy. Bản tin phải phát hiện được `[QĐ]` có điều kiện đã đủ nhưng vẫn mở."*

Ca thật, đo bằng API chứ không đọc bằng mắt: `#127` là `[QĐ]` (nhãn `decision` + `irreversible`) mở `2026-09-22T09:16Z`, phương án A nêu điều kiện *"Cấp `OPENAI_API_KEY` rồi **merge PR #66**"*. **`#66` đã merge `2026-09-24T04:31:51Z`** — điều kiện dạng-PR đã đủ — nhưng `#127` **vẫn mở** tới giờ. Không chỉ báo nào đỏ; nó chỉ nằm trong danh sách *"Cần anh quyết"* của bản tin như thể còn chờ người. Đúng nhóm **Z**, và cùng họ với `platform/P-050` (`decision-close.ts`, `#256`) đang chờ merge — chỉ ngược dấu: `P-050` **đóng** `[QĐ]` đã có bằng chứng mạnh; mục này **nêu lên** `[QĐ]` mà điều kiện dạng-PR đã đủ để chủ dự án soát và hành động, chứ không tự đóng (một `[QĐ]` `irreversible` như `#127` vẫn cần người quyết dù `#66` đã merge).

- deps: —
- risk: low — chỉ **thêm** một mục vào bản tin (`renderDigestMetrics`) và các hàm thuần đọc-thêm; không đổi số đếm *"Cần anh quyết"* đang có, không tự đóng issue nào, không chạm vùng bảo vệ. Hướng lệch an toàn: bản tin là mặt người đọc, nên nêu thừa một dòng thấy ngay và bỏ qua được; nuốt mất một `[QĐ]` đã đủ điều kiện mới là chiều đắt.
- status: review
- hold: chưa **quan sát** bản tin thật nêu `#127` — bộ dò đã có mã và test khoá, nhưng routine `crux-digest` (20:30, phụ lục P2) chưa chạy sau khi mục này vào `main`; lượt `crux-digest` kế tiếp là quan sát đầu tiên (cùng hình dạng hold của D5/`P-051`). Mục **không** tự chuyển `done` tới khi có quan sát đó.
- nguồn: `#251` D6 · `#127` (thân + trạng thái) · `#66` `merged_at 2026-09-24T04:31:51Z` · `ops/known-failures.md`
- tiêu chí xong:
  - ✅ `ops/known-failures.md`: mục **KF-035** cho ca `#127` — `[QĐ]` có điều kiện đã đủ (PR gate `#66` đã merge) nhưng vẫn mở, agent tin sai là còn bị chặn, nằm 3 ngày, mọi chỉ báo xanh (nhóm Z), kèm chữ ký.
  - ✅ `ops/scripts/digest-metrics.ts`: hàm thuần `linkedPrNumbers` (đọc `#N` từ tiêu đề + thân), `decisionDeclaresBlocked` (ba dấu hiệu "chặn"/"chưa có"/"đang chờ" lấy nguyên văn từ `#127` — vòng soát bước 6 bỏ một `/chờ\s/` trần vì nó rộng hơn ca thật), `decisionAgeDays`, và `conditionMetButOpen` (mở + khai chặn + có PR gate đã merge). `DecisionRow` mang thêm `conditionMetPrs`/`ageDays` **chỉ khi** bên gọi xin (giữ hình dạng cũ cho `decisionRows(issues)`). Không đổi `needOwnerCount`.
  - ✅ `renderDigestMetrics`: mục mới *"Quyết định điều kiện đã đủ nhưng còn mở"* liệt kê từng `[QĐ]` kèm PR gate đã merge và số ngày đã mở. Dòng đầu bản tin vẫn là *"Cần anh quyết: N việc"*.
  - ✅ `collectMetrics`/`fetchSnapshot`: lấy thêm `body,createdAt` của issue `decision`, dựng tập số PR đã merge, truyền vào `decisionRows`.
  - ✅ `ops/test/digest-metrics.test.ts`: 6 bài mới, gồm fixture hình dạng `#127` (khai chặn + `#66` merged → nêu) và ca âm (PR gate chưa merge → không nêu; không khai chặn → không nêu; không nêu PR → không nêu; `decisionRows(issues)` không opts giữ nguyên hình dạng).
  - ✅ `pnpm check` EXIT=0 · 1283 test/1283 pass · `pnpm replay` khớp tập vàng 6/6.
  - ⬜ Cập nhật trạng thái D6 trên `#251` (làm khi chuyển PR khỏi nháp) và **quan sát bản tin thật** (xem `- hold:`).

---

### P-045 · fix · Một PR không merge được **giết cả hàng đợi**, nên mọi PR xếp sau không bao giờ được xét

`ops/workflows/automerge.yml` duyệt cả hàng đợi trong một vòng `for` dưới `set -euo pipefail`, và lời gọi merge nằm **trần**. Một PR mà GitHub từ chối merge làm `gh` thoát khác 0, `set -e` giết cả bước, và mọi PR xếp sau **không có một dòng log nào**.

Đo bằng chạy thật, lượt `automerge` `737` (`2026-09-24T10:26Z`): hàng đợi `232 231 229 226 225 224 214 112 84 39` · `#232` merge · `#231`/`#229` chờ · `#226` trả `HTTP 405` · rồi hết. `#225 #224 #214 #112 #84 #39` không được xét — trong đó `#84` (tới hạn ~`09:19Z`) và `#39` (tới hạn ~`08:41Z`) đã quá khoảng chờ 12 giờ. Tám lượt liên tiếp (`730`→`737`) chết ở đúng chỗ ấy.

Hậu quả thứ hai: hai dòng `$GITHUB_OUTPUT` nằm **sau** vòng lặp, nên `steps.merge.outputs.merged` rỗng và bước "Gọi tay các workflow lẽ ra chạy theo sự kiện push" bị bỏ. Merge bằng `GITHUB_TOKEN` không tự sinh sự kiện (**G2**, `KF-004`), nên đo được: `main` = `a92df04` (merge `#232` lúc `10:26:29Z`) tới `10:39Z` **không có lần chạy `main-ci` nào**.

Nhóm **Z**: `pnpm check` xanh, CI xanh trên mọi PR, `main` xanh, không cảnh báo nào mở. Và là **lần thứ hai** của đúng hình dạng `KF-017` (lần đó `403`), nên `CLAUDE.md` mục 13 đòi sửa cơ chế chứ không vá nguyên nhân.

- deps: —
- risk: medium — chạm `ops/workflows/automerge.yml`, tức chính workflow tự merge. Bản sửa **không** nới cổng nào: `invariants.merge-gate.ts` và `invariants.protected-area.ts` giữ nguyên, chỉ đổi cách xử lý một lời gọi merge **thất bại**. Chiều nguy hiểm (nuốt lỗi thành xanh) có bài khoá riêng.
- status: review
- hold: chờ chủ dự án merge — `ops/workflows/automerge.yml` thuộc vùng `owner-merge`; và một phép đo sau khi sync: lượt `automerge` kế tiếp có xét tới `#84`/`#39` không
- nguồn: log lượt [`35987203354`](https://github.com/HungQuach301/crux-studio/actions/runs/35987203354) và [`35981770847`](https://github.com/HungQuach301/crux-studio/actions/runs/35981770847); `actions/workflows/main-ci.yml/runs`; `ops/known-failures.md` `KF-029`, `KF-017`, `KF-024`
- tiêu chí xong:
  - ✅ Phần xét tách khỏi YAML: `ops/scripts/merge-queue.ts`, hàm thuần `summarizeQueue(report)`. Bash chỉ **ghi sổ**.
  - ✅ Lời gọi merge bọc trong `if MERGE_OUT=$( … )`; lỗi được ghi, in ra, rồi `continue`. Không `|| true`.
  - ✅ Sổ giữ cả đầu vào (`queue`) lẫn đầu ra (`attempts` + `skipped`). **Bộ dò đói hàng đợi có hai lớp, và lớp chính không phải `uncovered`** (vòng soát chỉ ra chỗ mô tả ngược): lớp chính là *`report.json` chỉ được dựng sau khi vòng lặp chạy tới cùng* — bước chết giữa chừng ⇒ không có sổ ⇒ `exit 1`; `uncovered` là lớp **bảo hiểm** cho người sửa sau thêm một nhánh `continue` quên ghi sổ.
  - ✅ Bước "Kết luận hàng đợi merge" là bước **cuối**, đứng **sau** bước dispatch, `if: !cancelled()`. Sổ thiếu cũng đỏ (`⚠ KHÔNG TRẢ LỜI ĐƯỢC`, thoát 2 ở CLI).
  - ✅ **Bài tái hiện lỗi** (bất biến **I2**, nhãn `fix`): `ops/test/merge-queue.test.ts` (13 bài) bài đầu dựng lại nguyên hàng đợi và kết cục lượt `737`.
  - ✅ Tầng hợp đồng bash↔TS: chạy thật hai khối `bash` dưới `set -euo pipefail` chứng minh dạng cũ giết vòng lặp còn dạng mới thì không. Hai tầng đầu **không** phủ được chỗ này — ngữ nghĩa `set -e` chính là chỗ hỏng.
  - ✅ Phá thử **thật**, số đỏ là số đo: tháo bọc lời gọi merge → 1 · xoá bước kết luận → 1 · dời bước kết luận lên trước dispatch → 1 · `uncovered` luôn rỗng → 2 · `exitCode` luôn 0 → 3 · lỗi merge thôi làm đỏ → 1 · nhánh lỗi ghi `ok: true` → 1 · `!cancelled()` → `success()` → 1 · sổ thiếu mà `exit 0` → 1 · CLI luôn `process.exit(0)` → 1 · `assertReport` no-op → 1. Khôi phục → 13/13 xanh.
  - ⬜ **Chờ chủ dự án merge:** vùng `owner-merge` (CHARTER mục 3), nên cơ chế chỉ có hiệu lực sau khi anh merge và `sync-workflows` chép sang `.github/` (`CLAUDE.md` mục 4). Tới lúc đó hàng đợi **vẫn** đói ở mỗi lượt.
  - ⬜ Một phép đo sau khi áp: lượt `automerge` kế tiếp có in dòng kết luận cho **cả 10** PR của hàng đợi không, và `#84`/`#39` có được xét không.
- **vòng soát ngữ cảnh sạch (phụ lục P1 bước 6) — 3 CHẶN, 4 nên sửa, xử lý hết:**
  - **CHẶN 1 · PR thiếu nhãn `fix`.** Job `fix-has-test` đọc nhãn qua API rồi `exit 0` im lặng khi không có nhãn — tức **I2 không hề được kiểm mà check vẫn XANH**. Nhóm Z, đúng trên một PR mà tiêu đề, commit và mục này đều ghi `fix`. Đã gắn.
  - **CHẶN 2 · thiếu issue `🤖 [QĐ]`.** Cửa là `owner-merge`, mà `CLAUDE.md` mục 2 đòi kèm issue; không có thì PR không vào hộp quyết định duy nhất (mục 14) và nằm im vô hạn — **chính hình dạng mục này đang chữa**. Đã mở.
  - **CHẶN 3 · lời khai phá thử SAI.** Ghi "nhánh `skip` thôi ghi sổ → 1 đỏ", đo lại **0 đỏ**. Nguyên nhân là một **mẫu chết**; đã siết bài kiểm rồi đo lại, nay 1 đỏ. Chi tiết trong `KF-029`.
  - Ba lỗ phá thử nữa cho **0 đỏ** — `--arg queue ""`, xoá dòng dựng `report.json`, bỏ `2>&1` — nay có bài khoá, mỗi phép **1 đỏ**. Cộng `assertReport` thôi kiểm `reason`: trước 0 đỏ, nay 1 đỏ.
  - **Reviewer xác nhận, tự đo chứ không tin lời khai:** `pnpm check` EXIT=0 1105/1105 · replay 6/6 · cửa `owner-merge` · `if MERGE_OUT=$( … )` thật sự không kích hoạt `set -e` (chạy thật) · `--slurpfile` trên file rỗng trả `[]` · `tr '\n\t' '  ' | tr -s ' '` đúng · `set -u` không cắn `MERGE_OUT`/`MERGE_REASON` ở vòng sau · `bash -n` sạch cả 5 khối · `!cancelled()` hợp lệ và đúng hơn `always()` · **không tìm thấy đường nào biến một lỗi merge thành xanh** (thử 5 đường, `|| true` và `continue-on-error` đều bị luật **Z9** chặn) · hành vi cũ (`dry_run`, `hotfix`, `@nhắc`, dispatch, `concurrency`) không hỏng chỗ nào · I1–I8 đạt · `.github/` 0 dòng · trailer sạch tên model · `KF-029` ở dòng 9, **không** lọt vào khối ```` ```markdown ```` (lỗi đã xảy ra ở `#226`).
- **ngoài phạm vi, tách mục — không tự nống PR:**
  - **Hình dạng `KF-017` còn sống ở 9 lệnh khác** trong cùng vòng lặp (`gh api`, `git fetch`, `git archive | tar`, ba lời gọi `node`, và chính các lệnh `jq` ghi sổ). Với các ca đó hậu quả thứ hai **vẫn nguyên**, vì bước dispatch có `if: steps.merge.outputs.merged != ''` — biểu thức không chứa status function nên GitHub ngầm AND `success()`. Bản sửa gọn đã biết: ghi số PR vừa merge vào một **file** ngay sau mỗi lần merge, rồi đổi bước dispatch sang `if: ${{ !cancelled() }}`. Tách vì nó đổi ngữ nghĩa bước dispatch.
  - Bài `HIỆN TRƯỜNG · dưới set -euo pipefail…` là **tài liệu chạy được, không phải cổng**: reviewer đo 21 phép phá, **không phép nào làm nó đỏ**. Muốn có răng phải rút chính khối `if MERGE_OUT=$( … )` ra từ YAML rồi chạy với một `gh` giả qua PATH shim.
  - Nguyên nhân của `405` ở `#226` nằm phía GitHub. Giả thuyết có số đỡ (`KF-029`): một lượt `ci.yml` bị `concurrency` huỷ để lại **check run `cancelled`** mang đúng tên các check bắt buộc, và ruleset `protect-main` đọc chúng thành "chưa báo cáo" — khớp con số *"5 of 5"* trong thông điệp lỗi; đối chứng `#229` (chỉ `success`) là `clean`, `#226` là `blocked`. Cùng gốc với `KF-024` nhưng nhìn từ phía GitHub, nên `P-039` không chữa được. **Chưa** xác nhận bằng cấu hình ruleset (agent không đọc được).
  - Không ai canh khi `automerge` đỏ (rủi ro **B7**). Mục này làm nó đỏ **đúng lúc phải đỏ**, nhưng chưa nối vào một trong bốn loại cảnh báo khẩn của CHARTER 2.4. Đáng một mục riêng, và nó chạm `watchdog.yml` đang bị `#229` sửa.

---

### P-039 · Cổng merge đọc lần chạy `ci.yml` **đã bị huỷ** thành phán quyết, nên PR xanh kẹt vĩnh viễn — **ưu tiên CAO NHẤT**
`ops/workflows/automerge.yml` hỏi `actions/workflows/ci.yml/runs?head_sha=$HEAD&status=completed&per_page=1` rồi lấy `.workflow_runs[0]`. Danh sách ấy xếp theo `created_at` giảm dần — không theo "lần chạy nào có thẩm quyền". `ci.yml` có `concurrency` huỷ lần chạy cũ, nên một SHA có nhiều lần chạy `completed`, và hai lần chạy có thể **trùng `created_at` tới từng giây**; khi đó phần tử đầu có thể là lần `cancelled`.

Đo bằng chạy thật (lượt `automerge` `35943304619`, 2026-09-24 01:31Z): PR `#194` và `#208` đều mang nhãn `automerge`, cửa tính lại ra `open`, **12/12 check run xanh** trên đúng đầu nhánh — và cổng in `skip — CI chưa xanh (cancelled)` cho cả hai. `#194` kẹt ~11 giờ, `#208` ~3 giờ. Ba lần chạy thật trên `head_sha` `ed56e10f` của `#194`: `609` `cancelled` (`14:40:17Z`) · `610` `cancelled` (`14:40:41Z`) · `611` `success` (`14:40:41Z`) — `per_page=1` trả `610`.

`created_at` không bao giờ đổi, nên đây **không** phải chậm một nhịp: PR kẹt như vậy chỉ thoát khi có commit mới lên nhánh, mà một PR đã xong thì không có lý do gì để push thêm.

Nhóm **Z**, và là ca nhóm Z khoá hàng đợi: lần chạy `610` bị huỷ 7 giây sau khi tạo, trước khi có job nào, nên nó **không sinh check run nào**. Checks API — nguồn của mắt người, của giao diện PR và của job `fix-has-test` — không thấy nó. Cổng đọc Runs API. Hai lớp nhìn hai nguồn, không bên nào sai theo nguồn của mình, và không gì đỏ.

- deps: —
- risk: low — bản sửa chỉ bỏ các kết luận **không mang phán quyết** (`cancelled`, `skipped`, `stale`) rồi lấy lần mới nhất theo `run_number`. Chiều nguy hiểm (nuốt một lần `failure`) có bài khoá riêng.
- status: review
- hold: chờ chủ dự án merge automerge.yml (owner-merge) rồi sync-workflows; và phép đo #194/#208 có merge được ở lượt kế không
- nguồn: log lượt `automerge` [`35943304619`](https://github.com/HungQuach301/crux-studio/actions/runs/35943304619) và [`35938855691`](https://github.com/HungQuach301/crux-studio/actions/runs/35938855691); `actions/workflows/ci.yml/runs` của nhánh `claude/dreamy-ride-t9gnbd`; `ops/known-failures.md` `KF-024`
- tiêu chí xong:
  - ✅ Luật chọn tách khỏi YAML: `ops/scripts/pick-ci-run.ts`, hàm thuần `pickCiRun(runs, headSha?)`.
  - ✅ Bài tái hiện lỗi (**I2**): `ops/test/pick-ci-run.test.ts`, 12 bài, bài đầu dựng lại **nguyên** ba lần chạy thật của `#194`.
  - ✅ Khoá chiều lệch YAML ↔ TS: một bài đọc chính `ops/workflows/automerge.yml`, đỏ nếu chỗ gọi quay về `per_page=1` hoặc thôi gọi `pick-ci-run.ts`.
  - ✅ Khoá chiều ngược — không nuốt đỏ: một lần `failure` mới hơn một lần `success` vẫn thắng.
  - ✅ Phá thử **thật** bốn chỗ, số đỏ là số đo: bỏ luật bỏ-kết-luận-không-phán-quyết → 2 bài đỏ · luôn ưu tiên `success` → 1 · `per_page=1` trở lại → 1 · sắp theo `created_at` thay `run_number` → 1. Lần phá cuối lúc đầu ra **0 bài đỏ** (luật `run_number` chưa ai canh, vì mức dự phòng `updated_at` cứu bàn thua) — đã thêm bài thứ 12 bịt đúng chỗ đó rồi phá lại, đỏ.
  - ✅ Ca "mọi lần chạy đều bị huỷ" giữ nguyên hành vi hôm nay (`skip`), nên bản sửa không mở thêm cửa nào.
  - ⬜ **Chờ chủ dự án merge:** `ops/workflows/automerge.yml` thuộc vùng `owner-merge` (CHARTER mục 3), nên cơ chế chỉ có hiệu lực sau khi anh merge và `sync-workflows` chép xong. Tới lúc đó `#194` và `#208` vẫn kẹt. PR [#216](https://github.com/HungQuach301/crux-studio/pull/216), issue `🤖 [QĐ]` [#217](https://github.com/HungQuach301/crux-studio/issues/217).
  - ⬜ Một phép đo sau khi áp: `#194` và `#208` có được merge ở lượt `automerge` kế tiếp không — nếu không thì chữ ký còn chỗ khác.
- **vòng soát ngữ cảnh sạch (phụ lục P1 bước 6) — 1 phát hiện chặn, đã sửa trong cùng PR:**
  - **Chặn.** Lời gọi mới nằm ở **vị trí tham số** của `jq -n`, mà `set -euo pipefail` không bắt mã lỗi pipeline ở vị trí đó (đo: `true "$(exit 9)"` → thoát `0`; `X=$(exit 9)` → thoát `9`). Cộng với việc script lúc đầu hoá stdin rỗng thành `{}`, một lần `gh` chết sẽ thành `skip` im lặng với bước **vẫn xanh** — trước bản sửa ca đó làm `jq` chết và bước ĐỎ. Bản sửa suýt đổi một cổng từ ồn ào sang im lặng, đúng nhóm **Z** mà chính mục này chặn. Nay: phép gán `CI_RUN=$( … )`, và stdin rỗng → thoát `2` kèm stderr. Hai bài mới khoá cả hai vế, đã phá thật, cả hai đỏ.
  - **Ngoài phạm vi, đã hoàn nguyên.** Dòng `MAIN_CI_RUN` (`automerge.yml:143`) bị đổi `per_page=1`→`per_page=100` **ngoài ý định**, lọt vào lúc khôi phục một phép phá thử (`s.replace` khớp cả dòng khác). Nó không đổi hành vi (`.workflow_runs[0]` giữ nguyên) nhưng là phạm vi ngoài khai của mục — đã trả lại `per_page=1`.
  - **Bài khoá YAML ↔ TS xanh nhờ may.** `yaml.includes('…pick-ci-run.ts')` xét **cả file**, nên một dòng comment nhắc tên file là đủ để nó bỏ sót việc chỗ gọi mất lời gọi thật. Nay bài xét đúng dòng hỏi cộng hai dòng kế, và đòi thêm hình dạng phép gán. Đã phá thật: đỏ.
  - **Tên bài nói quá.** Bài "hoà `created_at`" xanh nhờ mức dự phòng `updated_at`, không nhờ `run_number`; đã đổi tên và ghi rõ tầng `run_number` do bài cuối file khoá.
  - **Đã nói nhẹ lại** câu "cây mã không đổi giữa hai lần chạy cùng SHA": `ci.yml` kích bằng `pull_request` nên chạy trên commit **gộp với `main`**, mà `main` di chuyển.
  - **Còn để ngỏ có chủ ý:** `per_page=100` không phân trang. Trang 1 là 100 lần **mới nhất**, nên lần có thẩm quyền vẫn nằm trong đó; mất mát duy nhất là một lần `success` rất cũ khi cả 100 lần mới đều không mang phán quyết — rơi về `skip`, chiều an toàn.
- **mã mục nhận lúc 2026-09-24 ~01:5x giờ UTC** (`ops/logs/README.md`, `KF-005`): dò `### P-` trên `main` **và trên đầu cả 12 PR đang mở** — cao nhất là `P-038`, nên `P-039` không đụng ai.

---

### P-029 · `automerge` 403 vì thiếu `checks: read` — hàng đợi merge đứng ~5,9 giờ — **ưu tiên CAO NHẤT**
Mục `P-009` thêm lời gọi Checks API vào `ops/workflows/automerge.yml` mà không mở scope `checks`. Từ lúc `sync-workflows` chép bản mới sang `.github/` (`14:45:09Z` ngày 2026-09-22), **mọi** lượt `automerge` chết ở PR đầu hàng đợi với `403 Resource not accessible by integration`, và vì bước chạy dưới `set -euo pipefail` trong một vòng lặp duyệt cả hàng đợi nên **không PR nào phía sau được xét**.

Đo bằng chạy thật, không suy: lượt xanh cuối là run `#463` (`14:44:30Z`); từ `#464` là **35 lượt đỏ liên tiếp**; PR cuối do máy merge là `#147` (`14:45:13Z`); tới `20:38Z` có **27 PR mở** và **0 PR máy merge**. `#71` merge lúc `16:46Z` là **chủ dự án tự bấm** (`merged_by`, cửa `owner-merge`), không phải đối chứng ngược.

Vì sao nó thuộc nhóm **Z**: `pnpm lint:workflows` xanh, `pnpm check` xanh, CI của từng PR xanh, nhãn đúng, cửa đúng. Chỉ log của `automerge` đỏ — mà "lượt này không merge gì" cũng là kết quả bình thường, nên không ai mở ra xem. `missingPermissions` đã có luật quyền từ `KF-003`, nhưng luật ấy chỉ biết các lệnh `gh <lệnh con>`; `gh api` gọi thẳng endpoint là cửa hậu đi vòng qua tất cả.

- deps: —
- risk: high
- status: review
- hold: còn treo, ngoài phạm vi mục này (không tự mở rộng PR)
- nguồn: log job `merge` run `35777803363`; `ops/known-failures.md` **KF-017** và nhóm **Z18**; mục `P-009` (PR #70)
- **cửa merge: `owner-merge`** — mục này sửa `ops/workflows/automerge.yml`, tức chính workflow tự merge (CHARTER mục 3, bất biến I4). Chạy `node ops/invariants.protected-area.ts` để xác nhận, đừng đoán.
- tiêu chí xong:
  - ✅ `ops/workflows/automerge.yml` khai `checks: read`, kèm chú thích tại chỗ nói vì sao ba quyền cũ không bao được scope này.
  - ✅ **Không vá bằng `|| true`:** nuốt lỗi biến `fixHasTestConclusion` thành `null` vĩnh viễn, mà `invariants.merge-gate.ts` đọc `null` là "chưa kiểm" — hàng đợi vẫn đứng, chỉ là đứng im lặng hơn (CLAUDE.md mục 13: sửa cơ chế, không vá sản phẩm).
  - ✅ **Test tái hiện lỗi** (bất biến I2, nhãn `fix`): luật mới trong `missingPermissions` — `gh api` chạm `/check-runs` hoặc `/check-suites` phải khai `checks: read`. Sáu bài ở `ops/test/check-workflows.test.ts`, gồm một bài neo thẳng vào `ops/workflows/automerge.yml` trên cây.
  - ✅ **Luật không được câm khi lệnh trải nhiều dòng** — vòng soát đo 14 ca và tìm ra: `gh api \` rồi URL ở dòng sau lọt hết, mà `automerge.yml` đang dùng đúng dấu `\` đó. `joinContinuations` nối thành một dòng logic trước khi khớp. Không sửa chỗ này thì một lần rewrap lệnh cho dễ đọc là lỗi quay lại mà không gì đỏ — đúng nhóm Z mà mục này sinh ra để chặn. Phá thử: xoá dòng `checks: read` khỏi file thật → **2 bài đỏ**; khôi phục → xanh.
  - ✅ `ops/known-failures.md`: `KF-017` đủ năm phần, cộng một dòng `Z18` trong bảng rà soát nhóm Z.
  - **Còn treo, ngoài phạm vi mục này** (không tự mở rộng PR):
    - Một 403 ở PR đầu tiên không được phép giết cả hàng đợi. Vòng lặp nên cô lập lỗi theo từng PR và đi tiếp, rồi đỏ ở cuối với danh sách PR hỏng. Đáng một mục `platform` riêng — nó sửa **cùng một file `owner-merge`**, nên gộp vào đây sẽ làm PR khẩn này to ra và chậm lại đúng lúc hàng đợi đang đứng.
    - Luật quyền hiện vẫn chỉ phủ `check-runs`/`check-suites`. Các scope khác gọi qua `gh api` (`statuses`, `deployments`, `packages`, …) chưa có luật nào. Chỉ khai những gì đo được, không thêm luật đoán trước — nhưng ghi lại để lần sau không phải phát hiện lại bằng một lần nhà máy dừng.
    - **Hình dạng gọi** chưa phủ, không chỉ scope: `gh api graphql` và `curl` tới `api.github.com` đi vòng qua mọi luật hiện có. Vòng soát đo được và khai ra ở đây thay vì để im.
    - `declaredPermissions` chỉ đọc khối `permissions:` ở mức **gốc**, bỏ qua khối cấp job — có sẵn từ trước mục này, và nếp dự án là tránh khối cấp job (`ops/workflows/ci.yml`). Ghi lại để không ai tưởng đã phủ.
    - Luật bắt cả khi `gh api … /check-runs` chỉ nằm trong **chú thích** hoặc trong chuỗi `echo`. Hướng bắt nhầm này **an toàn** (cùng lắm ép khai thừa một quyền `read`), nên không chữa vội.
    - Hàng đợi merge đứng nhiều giờ mà không gì báo: đó là việc của `P-020` (watchdog, ngưỡng "không PR nào merge quá 6 giờ"). Mục này **không** làm thay.

### P-018 · `D-C04` — log tách tới mức mục, sửa bất biến I8 — **ưu tiên CAO NHẤT** (chủ dự án chỉ định)
Chủ dự án đã trả lời issue #14: chọn **B**, và trên issue bản tin #17 ghi "Ưu tiên cao nhất: thực hiện D-C04". Quyết định `irreversible` này **đã có câu trả lời**, nên nhánh việc của nó hết chờ.

Bất biến **I8** hiện cho mỗi **làn** một file log, nhưng hai **mục trong cùng một làn** chạy song song là chế độ chạy bình thường. Đổi sang `ops/logs/<lane>/<id>.jsonl` thì hai PR không bao giờ chạm cùng một file, và xung đột log biến mất thay vì được vá.

- deps: —
- risk: medium
- status: done
- nguồn: issue #14 (câu trả lời của chủ dự án, 2026-09-21); issue bản tin #17; CHARTER mục 3 (I8) và mục 7
- **cửa merge: `owner-merge`** — sửa CHARTER mục 3 là nhóm `irreversible` thứ 4 (CLAUDE.md mục 14). Chạy `node ops/invariants.protected-area.ts` để xác nhận, đừng đoán.
- tiêu chí xong:
  - Đổi I8 sang `ops/logs/<lane>/<id>.jsonl`, một file cho mỗi mục.
  - **Sửa CHARTER mục 3 (dòng I8) và mục 7 trong cùng PR** — điều kiện 1 chủ dự án nêu: charter và code không được lệch nhau. Ghi `docs/decisions/D-C04.md` và vào nhật ký thay đổi của CHARTER (mục 14).
  - Cập nhật `CLAUDE.md`, `ops/logs/README.md`, `kernel/src/log.ts`, và chuyển các dòng log đang có sang cấu trúc mới.
  - **Giữ `.gitattributes merge=union` làm lớp phòng thủ thứ hai** — điều kiện 2. Ghi rõ vào `ops/known-failures.md` KF-005 giới hạn đã đo được: union chỉ có tác dụng khi nhánh đã mang sẵn luật **trước** lần gộp, và câu hỏi GitHub có dùng nó để tính `mergeable` hay không vẫn đang mở (`VF-G17`).
  - Bên đọc log (`ops/scripts/update-metrics.ts` và mọi nơi khác) gom nhiều file và **sắp theo `at`**, không tin thứ tự dòng.
  - Đóng issue #14 sau khi PR merge.

### P-022 · `aborted-ineligible` là việc của làn sở hữu PR, ở lượt chạy kế tiếp — **ưu tiên cao**
Khi `ops/scripts/integrator-resolve.ts` trả `aborted-ineligible`, tool đã làm đúng: có xoá dòng ở một bên thì nó không tự giải, và phụ lục P3 bước 0b cấm thử `--ours`/`--theirs`/sửa tay. Nhưng **sau đó không ai nhận việc**. Bước 0 chạy ở đầu mọi lượt worker chỉ *ghi nhận* "1 bỏ lại, cần người", rồi worker đi duyệt backlog như thường.

Kết quả đã đo được trên PR #26: **bốn lượt** `aborted-ineligible` liên tiếp (07:14, 07:23, 08:08, 08:11Z), cùng một `reason`, PR kẹt hơn một giờ, và nó là mục **ghim ưu tiên cao nhất**. Hàng đợi merge là tuần tự (CHARTER mục 7), nên một PR kẹt chặn cả hàng đợi — đúng cái giá mà ngoại lệ "CI đỏ" ở phụ lục P1 bước 2 sinh ra để tránh.

Lỗ hổng nằm ở chỗ **"cần người" không phải một trạng thái ai sở hữu**. CI đỏ có: bước 2 giao nó cho worker kế tiếp. `aborted-ineligible` thì không, nên nó rơi vào khoảng trống giữa integrator (đã làm xong phần của mình) và worker (chưa thấy đó là việc của mình).

- deps: —
- risk: low
- status: done
- nguồn: PR #26 (bốn lượt `aborted-ineligible`, 2026-09-21); CHARTER phụ lục P1 bước 2 và phụ lục P3 bước 0; CHARTER mục 7 (hàng đợi merge tuần tự)
- **cửa merge:** chạy `node ops/invariants.protected-area.ts` — mục này sửa CHARTER phụ lục P1/P3 (mục khác mục 1 và 3) nên nhiều khả năng là `automerge-delayed`. Đừng đoán, chạy.
- tiêu chí xong:
  - **Phụ lục P1 bước 2** nhận thêm một ca, ngang giá với CI đỏ: PR đang mở mà lượt bước 0 gần nhất trả `aborted-ineligible` **là việc phải nhận ngay**, trước khi duyệt backlog. Cùng điều kiện chống giẫm chân đang dùng cho CI đỏ (không có commit mới trong 2 giờ).
  - **Ai nhận:** worker của **làn sở hữu PR** — suy từ tên nhánh `claude/<lane>/<id>`. Không phải integrator: integrator đã làm đúng phần của mình và P3 bước 0b cấm nó giải tay. Không phải "worker bất kỳ": giải xung đột cần biết PR đó định làm gì.
  - **Làn đó không có worker rảnh ở lượt kế tiếp** thì worker gặp nó **vẫn phải nhận** — thà một worker khác làn giải còn hơn PR nằm chờ. Ghi rõ thứ tự ấy, đừng để nó thành khoảng trống thứ hai.
  - **`ops/lanes/priority.md`**, mục "Ngoại lệ đứng trên bảng này": thêm ca này cạnh hai ca đang có, để hai nguồn không lệch nhau.
  - **Bước 0 của P3 (phụ lục P3)** ghi kèm, cho mỗi PR bỏ lại: tên nhánh, **làn sở hữu**, số lượt `aborted-ineligible` liên tiếp, và số giờ kẹt. Không có mấy số đó thì lượt sau không biết việc này đã bỏ lại mấy lần.
  - **Nhịp tim, không chỉ là luật trên giấy** (nhóm Z trong `ops/known-failures.md`): một PR `aborted-ineligible` quá **N** lượt liên tiếp phải nổi lên bản tin ngày ở mục "Cần anh quyết" hoặc trong cảnh báo của `watchdog`. Luật mà không có ai đếm thì nó im lặng đúng lúc cần kêu — và lần này đã im lặng bốn lượt.
  - Test khoá phần suy ra làn từ tên nhánh và phần chọn PR phải nhận, **kèm test âm**: một PR `aborted-ineligible` mà bị bỏ qua thì bài kiểm phải đỏ.
- **Đã làm:** `ops/scripts/pr-triage.ts` — `laneFromBranch` (suy làn từ `claude/<lane>/<id>`, `null` cho
  dạng khác, kể cả nhánh log-only `claude/<tên-ngẫu-nhiên>` của integrator) và `pickPrToHandle` (chọn đúng
  một PR theo ba lý do CI đỏ / comment chưa xử lý / `aborted-ineligible`, xếp theo đúng thứ tự đó, cùng
  điều kiện chống giẫm chân `ANTI_COLLISION_HOURS = 2` cho cả ba); 16 test, `ops/test/pr-triage.test.ts`,
  kèm test âm (chống giẫm chân chặn cả ca mới; PR không đủ điều kiện ra `null`; đoạn nhánh không khớp tên
  làn thật thì không suy đại). Phụ lục P1 bước 2, phụ lục P3 bước 0b/0d, phụ lục P2 bước 2 và mục "Đang
  chờ merge" của CHARTER.md, cộng `ops/lanes/priority.md` mục "Ngoại lệ đứng trên bảng này" đã cập nhật
  theo đúng cơ chế trên.

  **Một lựa chọn khác tiêu chí xong viết chữ nữa, có lý do (soát chéo ngữ cảnh sạch nêu ra, đã bổ sung
  ngay trong PR):** bullet "Ai nhận" gốc muốn worker của **làn sở hữu PR** đi trước, chỉ rơi xuống "worker
  bất kỳ" khi làn đó không có worker rảnh ở lượt kế tiếp. `pickPrToHandle` KHÔNG làm hai tầng đó — mọi
  worker đủ điều kiện nhận PR ngay, làn chỉ để ghi log. Lý do: hệ thống này không có worker gắn với một
  làn cụ thể (phụ lục P1 mở bằng "Bạn là worker `<N>`", mọi worker duyệt mọi làn qua cùng
  `ops/lanes/priority.md`), nên không có cách nào để biết "làn X có worker rảnh ở lượt kế tiếp không" mà
  nhường. Phần việc bullet đó THẬT SỰ cần — không giải mù, phải đọc PR để biết nó định làm gì — vẫn giữ
  nguyên trong phụ lục P1 bước 2.

  **Một lựa chọn khác tiêu chí xong viết chữ, có lý do:** nhịp tim đặt trong mục **"Đang chờ merge"**
  của bản tin (không phải "Cần anh quyết") — mục đó dành cho quyết định `irreversible` cần chủ dự án trả
  lời trong một issue `[QĐ]` (CHARTER 2.5); một PR kẹt xung đột không phải một quyết định, chỉ là một
  trạng thái cần thấy được, và PR `automerge-delayed` vốn đã có dòng riêng ở đúng mục đó. PR `owner-merge`
  vướng cùng ca thì thêm dòng cùng dạng, ghi rõ nhãn để phân biệt — không đợi cổng merge nào để đáng
  được thấy. Không dựng `watchdog` riêng cho việc này: mục `P-020` đã mở để làm watchdog, gộp vào đây là
  lấn phạm vi một mục khác.

  **Việc PR #39 cần được nhận theo đúng luật vừa viết** để lại cho lượt chạy sau: luật mới này chỉ có
  hiệu lực sau khi PR này merge (`automerge-delayed`, 12 giờ CI xanh) — áp dụng nó ngay trong PR đang viết
  ra nó sẽ là "làm theo luật chưa tồn tại", ngược với cách CHARTER vẫn vận hành (quyết định có hiệu lực từ
  lúc merge, không hồi tố).

### P-019 · Bản tin thêm mục "Tiến độ", và đếm lượt chạy routine
Chỉ dẫn 3 của chủ dự án trên issue bản tin #17 (2026-09-21).

- deps: P-005
- risk: low
- status: done
- nguồn: issue #17, chỉ dẫn 3; CHARTER phụ lục P2
- tiêu chí xong:
  - Bản tin có mục **Tiến độ**: số mục `done` trong 24 giờ · số mục còn lại theo từng đợt · thông lượng trung bình 3 ngày · ngày dự kiến xong từng đợt · **nút thắt hiện tại là máy hay người**.
  - Thêm **số lượt chạy routine đã dùng trong 24 giờ** — cũng là số liệu để kiểm giả định `G3`.
  - Sửa phụ lục P2 của CHARTER cho khớp (cửa `automerge-delayed`, không phải `owner-merge` — CHARTER mục khác mục 1 và 3).

### P-020 · Watchdog: rút ngưỡng "không có PR nào merge" xuống 6 giờ, và canh routine hỏng
Chỉ dẫn 4 của chủ dự án trên issue bản tin #17 (2026-09-21).

- deps: —
- risk: low
- status: review
- hold: còn treo, khai trước — dấu hiệu số 5 chưa phân biệt 'routine lỗi từ đầu' với 'routine không được lên lịch'
- nguồn: issue #17, chỉ dẫn 4
- **cửa merge: `automerge-delayed`** — chạm `CHARTER.md` mục 2 (ngoài mục 1 và 3) và `ops/workflows/watchdog.yml` (không dùng secret, không phát hành). Xác nhận bằng `node ops/invariants.protected-area.ts`, không đoán.
- tiêu chí xong:
  - Ngưỡng "không có PR nào merge" rút từ **48 giờ xuống 6 giờ**.
  - Cảnh báo khi một routine **có lượt chạy lỗi**, hoặc **không chạy quá 3 giờ**.
  - Cảnh báo đi theo chuỗi báo động đã có ở `P-011` (tới thẳng điện thoại), không phụ thuộc workflow thứ hai — KF-004.
- **Đã làm:**
  - `ops/workflows/watchdog.yml`: ngưỡng dấu hiệu số 2 rút 48→6 giờ. Dấu hiệu số 5 mới — không routine `crux-worker-*`/`crux-integrator` nào ghi nhịp tim quá 3 giờ. Nhịp tim = dòng `at` mới nhất trong **các dòng log bước 0**, vì bước 0 của phụ lục P1/P3 ghi một dòng ở **mọi** lượt worker/integrator, kể cả lượt không có gì để giải (P3 bước 0d) — không cần một cơ chế heartbeat riêng. Từ mục `P-023` mỗi lượt ghi một file riêng, nên watchdog quét cả `ops/logs` (như dấu hiệu số 4) rồi lọc theo trường `ref`. Ba hình dạng, vì bước 0 đã đổi chỗ ghi hai lần: `<làn>/step0-…` (hiện tại), `<làn>/P3-run-…` (trước đó) và `platform/P-016` (file dùng chung cũ nhất). Neo vào một tên file là cách dấu hiệu này hỏng im lặng ngay lượt đầu tiên tên file đổi; bỏ sót một hình dạng cũ là cách nó mất một nguồn nhịp tim mà cũng không gì đỏ. Giới hạn đã biết, ghi thẳng trong comment: cách này bắt "im hẳn", không bắt "lỗi giữa chừng nhưng vẫn kịp ghi xong bước 0". `crux-digest` không ghi dòng bước 0 nhưng đã có dấu hiệu số 1 (26 giờ không bản tin) canh riêng.
  - Cron của `watchdog.yml` rút từ mỗi 6 giờ xuống **mỗi giờ** — nếu không, ngưỡng 3 giờ mới của dấu hiệu số 5 có thể bị phát hiện muộn tới 6 giờ, tức bản thân dấu hiệu vô nghĩa. Không nằm trong tiêu chí xong viết chữ nhưng cần thiết để tiêu chí đó có tác dụng thật.
  - Sửa `CHARTER.md` mục 2.4 cho khớp danh sách 5 dấu hiệu mới (điều kiện 1 của D-C04/thói quen dự án: charter và code không được lệch nhau).
  - Không đụng `ops/known-failures.md` (KF-003 dòng "48 giờ không merge"): dòng đó tường thuật một sự cố **đã xảy ra** lúc ngưỡng còn là 48 giờ, sửa số ở đó là viết lại lịch sử.
  - `pnpm check`: **xanh** — `contracts` ok (6 payload v0, 6 artifact); `lint:deps` ok; `lint:workflows` ok (6 file, 12 khối run qua `bash -n`); sổ giả định ok (18 giả định, 46 liên kết); `tsc --noEmit` sạch; **318 test / 0 fail**.
  - `pnpm replay`: tập vàng khớp snapshot, 6/6 xưởng — mục này không chạm đường chạy tập.
  - `node ops/invariants.protected-area.ts --changed … --base-charter …`: `{"gate":"automerge-delayed","delayed":["CHARTER.md mục 2 — ngoài mục 1 và 3","ops/workflows/watchdog.yml — workflow không dùng secret, không phát hành"]}`.
- **Còn treo, khai trước:** dấu hiệu số 5 không phân biệt được "routine lỗi ngay từ đầu, trước khi kịp ghi bước 0" với "routine không được lên lịch chạy" — cả hai đều là im lặng ở nhịp tim, và người canh không đọc được lịch routine trên `claude.ai/code/routines` (nằm ngoài repo). Không phải Z7 của `P-014` (Z7 canh **theo làn**, dùng `ops/logs/<lane>/**`; dấu hiệu này canh **routine**, dùng một file duy nhất) — hai cơ chế bổ sung nhau, không thay nhau.

### P-021 · Luật: routine và phiên không tự đặt vòng chờ
Chỉ dẫn 5 của chủ dự án trên issue bản tin #17 (2026-09-21).

- deps: —
- risk: low
- status: review
- nguồn: issue #17, chỉ dẫn 5
- **cửa merge: `automerge-delayed`** — sửa `CLAUDE.md`. Chạy `node ops/invariants.protected-area.ts` để xác nhận.
- tiêu chí xong:
  - Thêm luật vào `CLAUDE.md`: routine và phiên **không tự đặt vòng chờ** (`/loop`, hẹn giờ đánh thức). Việc chưa xong thì **kết thúc lượt**, để lượt chạy theo lịch kế tiếp làm tiếp.
  - Nói rõ vì sao: một lượt chạy nằm chờ vẫn tiêu lượt chạy trong ngày (`G3`) mà không làm gì, và nó giấu việc chưa xong khỏi bản tin.
- **Đã làm** (PR `#56`): `CLAUDE.md` mục **16 · Vòng chờ — routine và phiên không tự đặt**. Thêm mục mới ở cuối
  thay vì chèn giữa, để không đánh số lại 16 mục đang có — mọi chỗ trong repo trỏ tới "CLAUDE.md mục N" vẫn đúng.
  Luật cấm cả ba dạng đã thấy (`/loop`, hẹn giờ đánh thức, `sleep` đợi CI/reviewer/`automerge.yml`/chủ dự án),
  và nêu đủ hai lý do của tiêu chí xong: tiêu một lượt chạy trong ngày (`G3`) mà không làm gì, và giấu việc chưa
  xong khỏi bản tin — lượt chưa kết thúc thì chưa có báo cáo, chưa có PR khỏi nháp, chưa có gì cho bản tin đọc.
  Vạch ranh giới cho chỗ dễ đọc nhầm: chờ **bên trong một lệnh đang làm việc thật** (`pnpm check`, `git push`
  thử lại khi lỗi mạng) không phải vòng chờ.
- **Truy vết giả định:** `docs/assumptions.md` mục `G3` nay liệt kê `CLAUDE.md` mục 16 ở cột *Phần phụ thuộc*.
  Không phải trang trí: `pnpm assumptions` kiểm đúng chiều đó, nên nếu `VF-G3` đo ra G3 **sai** thì mục 16
  hiện ngay trong danh sách phần bị ảnh hưởng (CHARTER 11.1 luật 1) thay vì phải tìm bằng mắt.


### P-017 · Chế độ vận hành 1–2 lần mỗi ngày — quyết định `D-C06`
Chủ dự án chỉ xuất hiện tối đa **hai lần mỗi ngày, tổng không quá 15 phút**, và mọi việc cần anh nằm trong **một** chỗ: bản tin sáng. Bản C3.1 không đạt được điều đó vì ba thứ cộng lại: vùng bảo vệ quá rộng, danh sách `irreversible` quá dài, và mỗi quyết định là một cuộc gọi riêng. Cả ba đều là **cách thực thi** bất biến, không phải bất biến.

- deps: —
- risk: medium
- status: review
- hold: chưa kiểm bằng chạy thật — chỉ done khi một PR automerge-delayed thật tự vào main sau 12 giờ và sync-workflows chạy; và rà soát Z3 (thuộc P-014)
- nguồn: chỉ dẫn của chủ dự án trong phiên 2026-09-21; `docs/decisions/D-C06.md`
- tiêu chí xong:
  - ✅ `docs/decisions/D-C06.md` ghi đủ bảy nhóm `irreversible`, ba nhóm `owner-merge`, và cách đảo ngược.
  - ✅ CHARTER mục 1.3, 2.3, 2.4, 2.5, 3, 3.3, 12 (M8), 14 (C4), phụ lục P1–P3 sửa theo. `CLAUDE.md` mục 0, 1, 2, 3, 5, 10, 13, 14 sửa theo.
  - ✅ Ba luật tách thành `ops/invariants.*` — nên chính chúng là `owner-merge`, một PR không tự nới được lớp chặn của mình. 57 test.
  - ✅ `automerge.yml` tính lại **cửa** bằng bản trên `main` thay vì tin nhãn do `ci.yml` gắn. Đây là rà soát **Z8**, nay có máy chặn.
  - ✅ **KF-004:** `automerge.yml` gọi `sync-workflows` bằng `workflow_dispatch` khi PR chạm `ops/workflows/`. Danh sách do `ops/invariants.post-merge-dispatch.ts` quyết định, không viết cứng trong bash. 12 test riêng, gồm ba test đọc lại chính `automerge.yml`.
  - ✅ `notify.yml` bỏ nhãn `decision`; `main-ci.yml` @nhắc muộn 2 giờ; `watchdog.yml` thêm dấu hiệu chi phí ≥ 80% ngân sách.
  - ✅ Không cơ chế nào đòi chủ dự án sửa lịch routine. Bước 0 của integrator chuyển sang chạy ở **đầu mỗi lượt worker** (phụ lục P1), và đề nghị đổi lịch của `P-016` đã được rút.
  - ⬜ **Chưa xong, thuộc `P-014`:** rà soát **Z3** — `main-ci` so nội dung `ops/workflows/*` với `.github/workflows/*`, lệch là đỏ. Tới khi có nó, lời gọi `sync-workflows` **chưa có dự phòng**, và đó là chỗ hở lớn nhất mà `D-C06` tạo ra (ghi ở `docs/assumptions.md` mục G2).
  - ⬜ **Kiểm bằng chạy thật:** mục này chỉ chuyển `done` khi một PR `automerge-delayed` thật sự tự vào `main` sau 12 giờ, **và** `sync-workflows` chạy sau đó. Merge PR này chưa phải bằng chứng.

### P-013 · Bỏ khối `ask` để routine chạy trọn không cần người bấm — giả định G16 — **ưu tiên cao**
Chủ dự án cấp phép toàn bộ cho mọi phiên và routine, và chỉ nhận kết quả. Khối `ask` trong `.claude/settings.json` đi ngược lại điều đó: trong một lần chạy routine không có người ngồi cạnh, mỗi lời hỏi là một lần **treo tới khi hết giờ** — và không chỉ báo nào đỏ. Đây là mục **chặn** việc bật routine.

- deps: —
- risk: medium
- status: review
- hold: kiểm bằng chạy thật — chỉ done khi một lượt routine đi trọn một mục (mở PR + gắn nhãn), không đóng khi PR merge
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
- hold: chưa kiểm bằng chạy thật — routine chưa chạy lại theo bản mới; nhịp mỗi giờ cần chủ dự án đổi lịch; owner-merge + [QĐ] irreversible
- nguồn: giả định **G17** (`sai`); `ops/known-failures.md` KF-002 và KF-005; CHARTER mục 7
- tiêu chí xong:
  - ✅ Cơ chế đối chiếu-và-giải viết thành tool chạy được, không phải chỉ dẫn bằng lời: `ops/scripts/integrator-resolve.ts`. Gộp `ontoRef` vào HEAD; xung đột thì đối chiếu bằng `git diff --numstat` với tổ tiên chung ở CẢ hai bên trước khi quyết, đúng luật KF-002 "đối chiếu, không đoán".
  - ✅ **Giới hạn tự giải, khai trước chứ không đoán giữa chừng:** chỉ tự giải khi không bên nào xoá hay sửa dòng (numstat deletions = 0 ở cả hai bên) — tức thuần cộng thêm. Có một file không đạt thì `git merge --abort` TOÀN BỘ, không giải một phần. Test âm: `ops/test/integrator-resolve.test.ts` — một bên sửa một dòng gốc thì `outcome: "aborted-ineligible"`, HEAD và working tree không đổi.
  - ✅ Giải bằng `git merge-file --union` (đúng thuật toán `.gitattributes merge=union` đã kiểm ở KF-005) cho MỌI file xung đột đủ điều kiện, không chỉ file có khai attribute — vá đúng lỗ hổng G17 tìm ra (attribute không tự áp cho chính lần gộp mang nó tới). Test dương xác nhận cả hai dòng thêm còn nguyên, không sót dấu `<<<<<<<`.
  - ✅ **Không bao giờ** `--ours`, `--theirs`, rebase hay force-push — tool chỉ có hai đường: merge commit thường, hoặc `--abort`. Không có nhánh code nào gọi ba lệnh trên.
  - ✅ Routine `crux-integrator` (Phụ lục P3 trong CHARTER.md) cập nhật: liệt kê PR `mergeable_state` xung đột theo giờ kẹt giảm dần, gọi tool trên cho từng PR, chạy `pnpm check` + `pnpm replay` sau khi tool báo đã gộp, chỉ push khi xanh, không đụng PR `owner-merge` trừ bước gộp, không tự merge PR nào, ghi một dòng log kèm số đã giải/bỏ lại và giờ kẹt.
  - **Còn treo, ngoài phạm vi cơ chế:** hiển thị "PR xung đột, giờ kẹt giảm dần" thành một mục riêng trong bản tin ngày là việc của `P-005`/`P-007` (chưa `done`) — tới lúc đó, số giờ kẹt chỉ nằm trong `note` của **dòng log bước 0**, đọc được nhưng chưa được trình bày. Từ mục `P-023`, các dòng đó nằm ở `ops/logs/integration/step0-*.jsonl` — một file cho mỗi lượt chạy — cộng các dòng cũ còn lại ở `ops/logs/platform/P-016.jsonl`. **Đọc bằng `readRunLogs` trên cả `ops/logs`, đừng neo vào một tên file.**
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
  - **Đợt 3 — nhịp tim và ngưỡng:** Z6 (`main-ci` ghi thời điểm chạy; `crux-integrator` mỗi thứ Hai đọc và cảnh báo khi cũ quá ngưỡng) · Z7 (`watchdog` đọc `ops/logs/<lane>/**` qua `readRunLogs`, liệt kê làn không có dòng mới quá ngưỡng) · Z14 (so số PR merged theo làn với số dòng log cùng khoảng, báo trong bản tin ngày).
  - **Z12 sửa ngay, không chờ đợt:** `ops/scripts/check-assumptions.ts` cắt mục ở dấu `---` thay vì đọc mục cuối tới hết file. Kèm **test âm**: một sổ có mục cuối thiếu dòng dự phòng phải đỏ. Lỗi này đã xảy ra thật với G15 và chỉ lộ ra khi G16 đẩy nó khỏi vị trí cuối.
  - **Mỗi luật mới phải có test âm.** Một luật chỉ có giá trị khi nó đỏ đúng lúc phải đỏ — đó là bài học của KF-003, nơi một luật đỏ nhầm đã suýt ép `ci.yml` khai thừa quyền.
  - Z1 **không** nằm trong mục này: đã xong ở P-011.
  - Mục này không đóng một lần. Mỗi đợt xong thì ghi vào bảng nhóm Z ở `ops/known-failures.md` — đổi cột phải từ cách làm sang ✅ kèm tên bài kiểm.
- **Đợt 1 — xong.** Năm luật, mỗi luật kèm test âm (`ops/test/check-workflows.test.ts`, `ops/test/check-test-coverage.test.ts`, `ops/test/check-workflows-synced.test.ts`): `blocksMissingPipefail` (Z10), `testFilesMissedByGlob` qua script mới `pnpm check:tests` (Z11), `unsyncedWorkflows` qua script mới gọi riêng từ `main-ci.yml` — KHÔNG trong `pnpm check`, xem lý do trong chú thích đầu `ops/scripts/check-workflows-synced.ts` (Z3), `secretsUsedWithoutEmptyCheck` (Z5), `undocumentedSwallows` (Z9, kèm sửa 5 chỗ trong cây hiện tại để qua được chính luật mới). Chi tiết đầy đủ ở từng dòng bảng nhóm Z. Còn treo: Đợt 2 (Z2, Z8, Z13) và Đợt 3 (Z6, Z7, Z14).
- **Đợt 2 — xong một phần: Z12 và Z13** (lượt `crux-worker-1`, 2026-09-22).
  - **Z12** ("sửa ngay, không chờ đợt"): `ops/scripts/ledger-sections.ts` giữ **một** phép cắt sổ giả định, dùng
    chung cho `check-assumptions.ts` và `recheck-assumptions.ts`. Hai bên trước đây mang **hai bản chép** của cùng
    phép cắt, và cả hai cùng cắt mục cuối tới hết file — sửa một bên là hình dạng Z16 chờ sẵn, nên gộp về một chỗ.
    Mục nay kết thúc ở ranh giới đầu tiên sau nó (một heading `## ` bất kỳ, hoặc một dòng `---`). Năm bài ở
    `ops/test/ledger-sections.test.ts`, một trong đó đọc chính `docs/assumptions.md`: đo được lúc sửa, `G17` đang
    nuốt trọn phần "Cách thêm một giả định" (nó nằm **giữa** `G17` và `G18`, nên ca này tái hiện mà không cần dựng
    sổ giả). Kiểm bằng **phép phá**: dựng lại phép cắt cũ thì 3/5 bài đỏ đúng chỗ, khôi phục thì 5/5 xanh.
  - **Z13**: `goldenOnlyProblems` trong `ops/scripts/check-golden-pr.ts`, chạy ở job `golden-solo` của
    `ops/workflows/ci.yml`. Ngoại lệ đúng hai thư mục — `ops/logs/**` (bất biến I8) và `ops/lanes/**` (CLAUDE.md
    mục 2) — và đó là **tính chất kiểm được**, không phải châm chước: `replay.ts` đọc `ops/golden/**` rồi chạy các
    xưởng, không đọc dòng log nào và không đọc backlog nào. Đọc "không kèm thay đổi nào khác" theo mặt chữ thì
    không PR nào hợp lệ được, và một luật không ai qua được là một luật sẽ bị tắt ở lần đầu nó chạy. Mười bài ở
    `ops/test/check-golden-pr.test.ts`: năm bài dựng ca luật **phải đỏ** (kể cả ca đường dẫn bị `git`
    bọc ngoặc kép vì `core.quotePath` — chiều fail-open duy nhất của luật), năm bài canh chiều không được đỏ
    nhầm. Đầu vào rỗng thì ĐỎ chứ không xanh im lặng (bài học Z15).
  - **Cố ý để lại, nói rõ chứ không im lặng.** **Z2**: phần *cơ chế* đã xong ở `P-009` (đã vào `main`); phần còn
    lại là một luật linter, mà **7 trong 10** chỗ `if:` của `ops/workflows/**` tại nhánh này là `if:` **mức job** chứ không
    phải mức step (trên `main` là 6/9; chính PR này thêm một job-level nữa), trong khi câu luật ở bảng nhóm Z chỉ mô tả ca mức step — hình dạng luật cho ca mức job là một
    câu hỏi thiết kế riêng. **Z8**: sửa nó là sửa `ops/workflows/automerge.yml`, vùng `owner-merge`; gộp vào cùng
    PR thì hai luật máy kiểm rẻ ở trên phải nằm chờ chủ dự án. Cả hai đáng một PR riêng.
  - `status` giữ **`ready`**, không chuyển `review`: mục này cố ý không đóng một lần, và phần còn lại của sóng 2
    cùng trọn sóng 3 vẫn đang chờ — đúng cách sóng 1 đã làm.
- **Sóng 3 — xong một phần: Z7** (lượt `crux-worker-1`, 2026-09-23).
  - **Z7** (nhịp tim theo từng làn): `ops/scripts/lane-heartbeat.ts` (`laneHeartbeats`, `laneHeartbeatProblems`),
    script `pnpm lanes:heartbeat`, **21** bài ở `ops/test/lane-heartbeat.test.ts`. Chỗ Z7 khác dấu hiệu số 5 của
    `watchdog` nằm gọn trong một câu: dấu hiệu số 5 lấy `max` trên **mọi** dòng bước 0, mà bước 0 ghi một dòng ở
    **mọi** lượt worker (phụ lục P3 bước 0d) — nên chừng nào còn một worker thở thì nhịp tim còn mới, bất kể chín
    làn kia đã im mấy ngày. **Đo được, không suy** (2026-09-23T14:50Z, `readRunLogs` trên 227 dòng): làn
    `integration` có nhịp tim **2,2 giờ** khi tính cả dòng bước 0 và **23,4 giờ** khi trừ chúng ra; sáu làn quá
    ngưỡng (`editorial` 35,6h · `visual` 37,6h · `verify` 36,8h · `kernel` 29,0h · `integration` 23,4h ·
    `platform` 9,9h) và hai làn (`assembly`, `release`) **chưa có dòng log nào**. Có **phép phá** cho tính chất
    quan trọng nhất: bài kiểm dựng đúng ca "làn chỉ còn dòng bước 0 là mới" rồi khẳng định bỏ luật loại dòng bước
    0 thì nó ra `fresh` — tức luật không bao giờ đỏ được.
  - **Phép so chống trôi, và nó bắt được lỗi ngay lần đầu chạy:** bài kiểm đọc thẳng `ops/workflows/watchdog.yml`
    và đòi **đúng dòng `jq` thực thi** mang **nguyên văn** hằng `STEP0_REF_PATTERN`. Bản đầu đỏ đúng chỗ phải đỏ
    — dấu hiệu số 5 đang lọc bằng `(^|/)(step0|P3-run)-`, **thiếu hai hình dạng** `ref` mà `P-023` đã liệt kê:
    `P1-step0-` (chuỗi `step0-` đứng sau `P1-`, không sau `/`, nên không khớp; `ops/logs/platform/` có đúng một
    dòng như vậy) và `P3-daily-`. Đã sửa `watchdog.yml` trong cùng PR.
  - **Vòng soát ngữ cảnh sạch (phụ lục P1 bước 6) tìm ra bốn chỗ, đã sửa trước khi rời nháp.** Ba trong bốn là
    chỗ luật mới **không đỏ khi phải đỏ** — tức đúng hình dạng mà chính mục này tồn tại để giết:
    - **Mốc ở TƯƠNG LAI ⇒ `fresh` vĩnh viễn.** Đo trên chính dòng log của PR: `at` bản đầu ghi
      `2026-09-23T15:05:00Z` trong khi đồng hồ lúc ghi là ~14:54Z, và tool in ra `platform  -0.14h  fresh`. Một
      số âm nhỏ hơn **mọi** ngưỡng, nên một dòng ghi nhầm năm làm làn đó không bao giờ `stale` được. Thêm verdict
      `future`, dung sai `FUTURE_TOLERANCE_HOURS` = 1 phút, một dòng cảnh báo riêng, 3 bài kiểm; `at` của dòng log
      đã sửa về giờ thật (I8).
    - **Phép so chống trôi quá rộng.** Bản đầu so `STEP0_REF_PATTERN` trên **cả file**, nên một dòng chú thích
      chép nguyên văn hằng cũng giữ bài kiểm xanh trong khi `jq` thật lọc bằng `"KHONG-KHOP-GI-CA"` — vòng soát
      dựng đúng ca đó và 17/17 vẫn xanh. Nay chỉ đọc dòng `jq` thực thi; phá y hệt ca đó ra `not ok 9`.
    - **Thiếu ngưỡng của một làn ⇒ `> undefined` = false ⇒ `fresh` vĩnh viễn.** Chặn cứng bằng một phép ném.
    - **Hình dạng nuốt lỗi vô hình.** `|| VAR=…` nuốt lỗi y hệt `|| true` mà luật Z9 (`undocumentedSwallows`)
      **không thấy** — phá thử `X=$(false) || X="…"` không chú thích thì `pnpm lint:workflows` vẫn `EXIT 0`. PR
      này **không** đưa hình dạng đó vào cây (dùng `if ! VAR=$(…); then`), và ghi giới hạn vào ô Z9 của
      `ops/known-failures.md` thay vì để ô đó khai "✅ Đã có" trần. Nới `undocumentedSwallows` là đổi một luật
      đang chạy, có thể đỏ chỗ khác — một PR riêng.
  - **Cố ý để lại, nói rõ chứ không im lặng.** Dấu hiệu số 6 **không tự mở issue**, nó chỉ nối bảng nhịp tim vào
    thân cảnh báo khi đã có dấu hiệu khác nổ. Lý do: một làn im là chỗ nghẽn của **máy**, không phải việc chủ dự
    án bấm được (CHARTER 1.3), mà `watchdog` bình luận **lại mỗi giờ** chừng nào dấu hiệu còn — một dấu hiệu kéo
    dài nhiều ngày sẽ thành nhiều chục lần @nhắc, và đúng sáu làn đang quá ngưỡng ngay hôm nay. Nhịp cảnh báo là
    phạm vi mục `P-034`. Đường phát hiện **độc lập** của Z7 đi qua bản tin ngày: CHARTER phụ lục P2 mục "Tiến độ"
    nay gọi `pnpm lanes:heartbeat` — một lần mỗi ngày, 0 lần thao tác thêm của chủ dự án.
  - **Z6 và Z14 chưa làm.** Z6 (nhịp tim của `cron`) đòi `main-ci` ghi một file vào repo, tức một đường ghi vào
    `main` không qua PR — câu hỏi thiết kế riêng, không nhét chung được. Z14 (so số PR merged theo làn với số
    dòng log cùng khoảng) sống trong `ops/scripts/digest-metrics.ts`, mà PR `#194` đang mở và đang sửa đúng file
    đó; gộp vào đây là tự tạo một xung đột cho hàng đợi merge. Cả hai đáng một PR riêng.
  - `status` giữ **`ready`**: Z2, Z6, Z8 và Z14 vẫn đang chờ.

### P-028 · Bộ dò `cross-lane` không thấy `ops/logs/<làn>/`, nên luật mềm im lặng ở đúng ca hay gặp nhất
Tìm ra trong vòng soát ngữ cảnh sạch của `P-014` sóng 2, đo được chứ không suy.

`ops/workflows/ci.yml` gắn nhãn `cross-lane` bằng `grep -Eo '^(workshops|ops/lanes)/[a-z]+'` trên danh sách file
đã đổi. Hai tiền tố đó **không phủ `ops/logs/<làn>/`** — mà từ `D-C04` thì mỗi mục có một file log riêng dưới
đúng tên làn của nó, và bước 0 của phụ lục P3 ghi vào `ops/logs/integration/` ở **mọi** lượt worker, kể cả lượt
nhận một mục của làn khác. Nên ca "một PR chạm hai làn" phổ biến nhất hiện nay lại đúng là ca bộ dò không thấy.

Luật mềm (CHARTER mục 4) không chặn gì, nên hỏng ở đây **không làm gì đỏ** — nhóm **Z**, cùng hình dạng với
phần còn lại của `P-014`.

- deps: —
- risk: low
- status: ready
- nguồn: vòng soát của `P-014` sóng 2; CHARTER mục 4; `D-C04`
- tiêu chí xong:
  - Bộ dò đếm cả `ops/logs/<làn>/`, và **không** đếm trùng khi một PR chạm cả `ops/lanes/x/` lẫn `ops/logs/x/`
    (cùng một làn `x`, không phải hai làn).
  - Có test âm: một tập file đã đổi chạm `ops/lanes/platform/` và `ops/logs/integration/` phải ra **2** làn;
    chạm `ops/lanes/platform/` và `ops/logs/platform/` phải ra **1**.
  - Luật tách khỏi YAML sang một script có test, cùng lý do đã ghi ở `check-golden-pr.ts`: `ci.yml` chạy theo
    định nghĩa trong nhánh PR, nên một luật viết thẳng vào workflow không phải chỗ đặt được test.

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
- status: review
- nguồn: CHARTER 6.4 (từ Đợt 1)
- tiêu chí xong:
  - Cần secret `OPENAI_API_KEY`; thiếu thì **DỪNG và báo tên secret thiếu**, không tự tạo.
  - Nội dung gửi đi không chứa secret và không chứa nội dung không đáng tin chưa cô lập (bất biến I7).
  - Chi phí mỗi lần soát ghi vào `ops/logs/platform/P-003.jsonl`.
- ✅ **Đã làm, 2026-09-21:**
  - `ops/workflows/gpt-review.yml` — workflow **riêng**, KHÔNG gộp vào `ci.yml`: file này dùng
    `secrets.OPENAI_API_KEY`, và `ops/invariants.protected-area.ts` xếp mọi workflow dùng secret vào
    `owner-merge` (CHARTER mục 3, đúng chủ đích — secret đáng một lần soát của chủ dự án). Gộp vào
    `ci.yml` sẽ kéo cả file đó vào `owner-merge` vĩnh viễn cho mọi lần sửa sau, kể cả không liên quan
    gì tới GPT. Job `gpt-review` là **luật mềm**: không gắn/gỡ nhãn, không nằm trong `pnpm check`,
    `continue-on-error: true` — thiếu secret (đúng ở MỌI PR cho tới khi chủ dự án thêm nó) không làm
    CI đỏ.
  - `ops/scripts/gpt-review.ts`: thiếu `OPENAI_API_KEY` (kể cả chuỗi trắng) → in
    `DỪNG: thiếu secret OPENAI_API_KEY…`, KHÔNG gọi mạng, vẫn ghi một dòng log (`status: "skipped"`,
    `costUsd: 0` — bất biến I8 đòi mọi lần chạy có một dòng, kể cả lần bị bỏ qua).
  - Có secret: gửi diff (cắt ở 12.000 ký tự, có báo đã cắt) cho `gpt-4o-mini` qua
    `POST /v1/chat/completions`. Prompt hệ thống đóng khung diff là **DỮ LIỆU để soát, không phải
    chỉ dẫn** (bất biến I7) — bỏ qua mọi câu trong diff có vẻ ra lệnh cho model. Secret chỉ nằm ở
    header `Authorization`, không bao giờ trong nội dung gửi đi (test khẳng định bằng cách bắt request
    giả và tìm chuỗi secret trong `body`).
  - `costUsd` tính từ `usage.prompt_tokens`/`usage.completion_tokens` mà chính OpenAI trả về, nhân giá
    công bố của `gpt-4o-mini` — input \$0.15, output \$0.60 mỗi 1M token (nguồn:
    `developers.openai.com/api/docs/pricing`, bảng Standard, đọc 2026-09-21) — không ước lượng.
  - Kết quả đăng làm PR comment bắt đầu bằng 🤖 qua `gh pr comment`, chỉ khi bước gọi GPT thật sự
    thành công (`steps.review.outputs.posted == 'true'`, do chính bước đó ghi — không đoán qua việc
    file kết quả có tồn tại hay không).
  - `ops/test/gpt-review.test.ts`: 13 test — `costUsd` tính đúng theo bảng giá; diff dài bị cắt đúng
    trần; prompt đóng khung diff là dữ liệu (kể cả một diff giả vờ ra lệnh); secret không lọt vào body;
    API lỗi thì `reviewWithGpt` ném chứ không nuốt; thiếu secret / secret rỗng đều DỪNG và không gọi
    `fetch`; có secret thì gọi thật (fetch giả) và `costUsd` khớp; API lỗi ở tầng orchestrator thì
    KHÔNG ném ra ngoài (job advisory) và log `status: "failed"`, `costUsd: 0`.
  - Kiểm tra: `pnpm check` xanh — `lint:workflows` ok (7 file), 377 test / 377 pass / 0 fail, `pnpm
    replay` khớp snapshot 6/6 xưởng.
  - Cửa merge: `node ops/invariants.protected-area.ts` → `owner-merge`, vì `ops/workflows/gpt-review.yml`
    dùng `secrets.OPENAI_API_KEY` (đúng luật, không phải lỗi cần sửa).

### P-004 · Workflow `workshop-<name>.yml` cho sáu xưởng
Mỗi xưởng gọi được độc lập bằng `workflow_dispatch` (CHARTER 5.4, D-12: nối bằng dispatch, không nối bằng sự kiện push).

- deps: —
- risk: low
- status: review
- hold: chưa kiểm bằng chạy thật trên GitHub — workflow chỉ có hiệu lực sau khi merge vào main và sync chạy
- nguồn: CHARTER 5.4; quyết định D-12
- tiêu chí xong:
  - ✅ Sáu file trong `ops/workflows/`, mỗi file nhận `episode` và `impl` — `workshop-topic.yml`,
    `workshop-editorial.yml`, `workshop-visual.yml`, `workshop-audio.yml`, `workshop-assembly.yml`,
    `workshop-release.yml`.
  - ✅ Mỗi lần chạy ghi một dòng có `costUsd` (bất biến I8). Đường dẫn là
    `ops/logs/<xưởng>/<episode>.jsonl`, **không** phải `ops/logs/<xưởng>.jsonl` như dòng tiêu chí
    viết ra trước đó: từ `D-C04` (mục `P-018`) log tách tới mức mục, và sáu xưởng đều là tên làn.
    Dòng được ghi kể cả khi lần chạy hỏng — I8 nói "mọi lần chạy", không nói "mọi lần chạy thành công".
    Có **máy kiểm**, không chỉ có lời hứa: bốn bài trong `ops/test/run-workshop.test.ts` gọi script như
    Actions gọi nó (tiến trình con, `--root` riêng) rồi ĐẾM dòng trong file log. Đo bằng chạy thật: tắt
    lời gọi `appendRunLog` thì ba bài đỏ; đưa phần nạp pack ra ngoài `try` thì một bài đỏ. Khoảng trống
    này do vòng soát chéo của chính mục tìm ra — trước đó tắt hẳn việc ghi log mà `pnpm check` vẫn xanh.
  - ✅ Chỗ nối còn thiếu: `ops/scripts/run-workshop.ts` (`pnpm run:workshop`). `runWorkshopCli` của
    kernel chạy xưởng rồi in ra, nó **không** ghi artifact và **không** ghi dòng log nào — một workflow
    gọi thẳng nó sẽ xanh mà không để lại `costUsd` ở đâu cả.
  - **Còn treo, không thuộc mục này:** dòng log chỉ sống trong lần chạy. Không commit ngược vào `main`
    (CLAUDE.md mục 2), nên nó được dán vào tóm tắt lần chạy. Giữ lâu dài bằng Actions artifact hoặc
    Releases là mục `kernel/K-004`.
  - **Chưa kiểm bằng chạy thật trên GitHub:** workflow chỉ có hiệu lực sau khi merge vào `main` và
    `sync-workflows.yml` chép sang `.github/workflows/` (giả định **G10**). Đã kiểm ở chỗ rẻ hơn:
    `pnpm lint:workflows` (cú pháp YAML và `bash -n`), `ops/test/run-workshop.test.ts` (sáu file có
    đúng tham số, gọi đúng xưởng của mình, không nội suy `${{ inputs… }}` vào bash), và chạy thật
    trọn chuỗi sáu xưởng bằng `pnpm run:workshop` ở máy.

### P-005 · Script gom số liệu cho bản tin ngày
Routine `crux-digest` không nên tự tính số — nó nên đọc số đã tính.

- deps: —
- risk: low
- status: review
- hold: còn treo cố ý tách — nối lệnh vào phụ lục P2 là việc P-019; nhánh gọi gh thật chưa chạy xanh ở môi trường có gh
- nguồn: CHARTER 2.5, phụ lục P2
- tiêu chí xong:
  - ✅ Một lệnh in ra: PR merged 24h theo làn, PR đang mở và trạng thái CI, mục `parked`, issue `[QĐ]` đang mở tách theo `reversible`/`irreversible`, chi phí 24h và tích luỹ so với ngân sách. — `pnpm digest:metrics` (`ops/scripts/digest-metrics.ts`), 18 test ở `ops/test/digest-metrics.test.ts` cộng 1 test `title` ở `ops/test/backlog-status.test.ts`.
  - ✅ Dòng đầu luôn là `Cần anh quyết: N việc`. Có test cho cả ca `N = 0`.
- cơ chế, để lượt sau khỏi đọc lại code:
  - Mọi phép tính là hàm thuần; `main()` chỉ đọc backlog, đọc log qua `readRunLogs`, gọi `gh` rồi in. Tiền dùng lại `sumCostUsd`/`budgetPercent`/`BUDGET_LOW_USD` của `update-metrics.ts`, làn suy bằng `laneFromBranch` của `pr-triage.ts`, mục backlog tách bằng `parseBacklog` của `I-010` — không chép lại phép nào.
  - **Hai đường nạp dữ liệu GitHub, một dạng dữ liệu duy nhất.** Không cờ thì gọi `gh`; `--github <file.json>` nhận đúng dạng `gh … --json` trả về, cho lượt agent không có `gh` trong `PATH` (đã đo: phiên routine hiện tại không có `gh`). Thêm `--json` nếu bên gọi muốn số thô.
  - Ba chỗ cố ý **không** im lặng, mỗi chỗ một test âm: PR không suy được làn ra nhóm riêng (8/20 PR merged 24 giờ qua rơi vào đây — nhánh `claude/<tên-ngẫu-nhiên>` nền tảng gán); PR chưa có lần chạy CI nào ra `chưa có` chứ không gộp vào `xanh` (hình dạng `KF-002`); issue `decision` thiếu nhãn phân loại vẫn được đếm vào "Cần anh quyết".
  - Thiếu `gh`, hay `--github` trỏ file thiếu khoá, đều **ném** — một bản tin "0 việc cần anh quyết" vì thiếu công cụ trông giống hệt một ngày yên ả.
  - Thứ tự đọc **ổn định** ở cả hai chỗ: nhóm PR merged xếp theo `LANES`, và mục `parked` cũng vậy (`readdirSync` không bảo đảm thứ tự). Mốc 24 giờ so bằng **thời gian**, không so chuỗi — `gh` trả `mergedAt` ở mức giây còn `since` có mili giây, mà so chuỗi thì `'Z' > '.'`. Cả hai có test phá-thì-đỏ.
- vòng soát chéo (subagent, ngữ cảnh sạch) — tự chạy lại `pnpm check`, `pnpm replay`, cửa merge và **8 bài phá thử**, cả 8 đều đỏ đúng chỗ. Ba điểm nó nêu đã sửa ngay trong PR: thứ tự mục `parked` không ổn định, mốc 24 giờ so bằng chuỗi, và số test khai sai địa chỉ. Hai nhận xét còn lại không chặn, ghi lại để không rơi mất: `main()` lấy gốc repo bằng `process.cwd()` nên lệnh chỉ đúng khi chạy từ gốc (`pnpm digest:metrics` luôn vậy); và nhánh của PR này mang thêm một commit ghi dòng log bước 0 phụ lục P3 vào `ops/logs/platform/P-016.jsonl` — không phải việc của `P-005`, nhưng là hình dạng bắt buộc của mọi lượt worker.
- ⬜ **còn treo, cố ý tách:** nối lệnh này vào phụ lục P2 của CHARTER là việc của `P-019` — mục đó `deps: P-005` và tiêu chí xong của nó đã ghi rõ "Sửa phụ lục P2 của CHARTER cho khớp". Chạm CHARTER ở đây là trộn phạm vi hai mục. Tới khi đó, routine `crux-digest` gọi lệnh bằng tay.
- ⬜ **chưa đo được ở lượt này:** nhánh gọi `gh` thật. Phiên routine không có `gh`, nên nhánh đó mới kiểm được bằng phép thử thiếu-`gh` (ném đúng câu) chứ chưa từng chạy xanh. Lần chạy đầu ở một môi trường có `gh` là lần đầu quan sát được nó.

### P-009 · `fix-has-test` không được bỏ qua chỉ vì nhãn gắn muộn — **ưu tiên cao**
Bất biến **I2 vế hai** ("PR có nhãn `fix` phải kèm test tái hiện lỗi") hiện **thủng**. Bằng chứng: `ci` run #1 và #2 trên PR #7 — một PR mang nhãn `fix` — đều cho job `fix-has-test` kết quả `success` với bước kiểm ở trạng thái `skipped`.

Nguyên nhân: sự kiện `pull_request` chụp `github.event.pull_request.labels` **tại thời điểm run bắt đầu**. Nhãn `fix` gắn sau đó không có trong ảnh chụp, nên điều kiện `contains(...)` sai và bước kiểm bị bỏ qua. Job vẫn xanh, nên nhìn từ ngoài không có gì khác một PR đã qua kiểm.

Đây là lỗ hổng nguy hiểm hơn vẻ ngoài: nó không làm CI đỏ, nó làm CI **xanh sai**. Và nó xảy ra ở đúng trường hợp phổ biến nhất — agent mở PR rồi mới gắn nhãn.

- deps: —
- risk: low
- status: done
- nguồn: bất biến I2; `ci` run #1 và #2 của PR #7
- tiêu chí xong:
  - ✅ `ci.yml` thêm `labeled` và `unlabeled` vào `on.pull_request.types`, cạnh bộ mặc định `opened, synchronize, reopened`. Gắn hay gỡ nhãn `fix` đều chạy lại CI.
  - ✅ Job `fix-has-test` **tự đọc nhãn hiện tại qua API** thay vì tin vào ảnh chụp trong `github.event` — ảnh chụp luôn có thể cũ, kể cả sau khi thêm `labeled`.
  - ✅ Bước kiểm **không bao giờ `skipped` một cách im lặng**: PR không có nhãn `fix` thì in rõ "không có nhãn fix, bỏ qua" và kết thúc `success`; có nhãn thì phải chạy và phải kết luận. Bước không còn `if:` cấp step — luôn chạy.
  - ✅ `automerge.yml` **từ chối merge** PR mang nhãn `fix` khi job `fix-has-test` chưa xanh **trên đúng commit sắp merge**. Không đủ nếu chỉ kiểm "CI xanh" ở mức run: `ops/invariants.merge-gate.ts` nay đọc riêng `fixHasTestConclusion` (kết luận của check run `fix-has-test` trên `headSha`, `automerge.yml` truyền vào), không tin `ciConclusion` tổng — một run cũ từ trước lúc gắn nhãn, hoặc job `skipped`, không còn qua được.
  - ✅ **Test âm bắt buộc, ở tầng quyết định (`ops/invariants.merge-gate.ts`):** nhãn `fix` + `fixHasTestConclusion` khác `success` (`skipped`, `failure`, hoặc `null` — không tìm thấy check run) → `outcome: 'skip'`. Test dương: `fixHasTestConclusion: 'success'` → `merge` bình thường; PR không mang nhãn `fix` thì trường này không cản gì kể cả `null`. Phần bash quyết định "diff có chạm file test hay không" giữ nguyên logic đã có từ trước (không đổi), chỉ đổi chỗ nó luôn chạy thay vì có thể bị `if:` bỏ qua — kiểm bằng `bash -n` (`pnpm lint:workflows`), chưa có hạ tầng chạy thật bash trong YAML như test của `.ts`; ca chạy thật đầu tiên là PR `fix` kế tiếp sau khi mục này merge.
  - ✅ Thêm một dòng vào `ops/known-failures.md` (KF-008) khi mục này xong, vì đây là lỗi "CI xanh sai" — loại tệ nhất.

### P-010 · Sau mỗi merge chạm `ops/workflows/`, tự chạy thử workflow vừa đổi — **ưu tiên cao**
KF-003 đã ghi: workflow chạy trên một PR là bản trong `.github/workflows/` của **nhánh PR**, mà nhánh PR thừa hưởng bản đó từ `main`. Agent không ghi được `.github/`, nên bản mới **không bao giờ** được chạy trước khi merge. `pnpm lint:workflows` chỉ bắt được cú pháp, không bắt được quyền thiếu, secret thiếu, hay một lệnh `gh` gọi sai.

Hệ quả đã xảy ra thật hai lần: `labels` run #1 hỏng vì thiếu `contents: read`, và hai workflow nữa mang lỗi cùng loại nằm im vì **chưa từng chạy**. Cả hai lần đều chỉ lộ ra khi có người bấm tay.

- deps: —
- risk: low
- status: review
- hold: lượt worker sau phải đọc đúng lần chạy thật (workflow vừa đổi) trước khi coi mục này done
- nguồn: `ops/known-failures.md` KF-003; CHARTER 3.2 (giả định G10); rủi ro B7
- tiêu chí xong:
  - Một workflow mới, `smoke-workflows.yml`, chạy khi `main` đổi trong `ops/workflows/**` — **sau** khi `sync-workflows` chép xong, không chạy song song với nó.
  - Nó xác định **đúng những workflow vừa đổi** trong lần push đó, không chạy lại cả bộ.
  - Với mỗi workflow vừa đổi: gọi bằng chế độ chạy thử nếu workflow đó có (`inputs.dry_run`), nếu không thì gọi bằng `workflow_dispatch` thường. Workflow nào **không** có `workflow_dispatch` thì ghi rõ là không tự thử được, và liệt kê nó trong issue để người biết.
  - Thêm `inputs.dry_run` vào các workflow có tác dụng phụ ra bên ngoài — `labels` (không ghi nhãn), `notify` (không comment), `watchdog` (không mở issue), `automerge` (**không merge, tuyệt đối**). Chế độ đó phải in ra **việc nó ĐỊNH làm**, để lần chạy thử vẫn có giá trị.
  - Workflow nào đỏ thì mở **một** issue nhãn `alert` liệt kê đủ: tên workflow, link lần chạy, và dòng lỗi đầu tiên. Một issue cho cả lần push, không phải một issue mỗi workflow.
  - Chạy thử **không được** đụng tới `automerge` ở chế độ thật trong bất kỳ hoàn cảnh nào. Có test cho riêng điều này.
  - `pnpm lint:workflows` thêm một luật: workflow trong `ops/workflows/` có tác dụng phụ ra ngoài mà **không** có `inputs.dry_run` thì cảnh báo (chưa chặn, vì `sync-workflows.yml` nằm ngoài tầm agent).

**Đã làm — đối chiếu từng tiêu chí:**

| Tiêu chí | Ở đâu |
|---|---|
| `smoke-workflows.yml`, chạy khi `main` đổi trong `ops/workflows/**`, sau sync | `ops/workflows/smoke-workflows.yml` · `ops/invariants.post-merge-dispatch.ts` |
| xác định **đúng** workflow vừa đổi | `git diff --name-only <sha>^ <sha> -- ops/workflows/` → `changedWorkflowFiles` |
| gọi `dry_run` nếu có, gọi thường nếu không | `planSmokeRuns` |
| không có `workflow_dispatch` → ghi rõ, liệt kê trong issue | `planSmokeRuns` nhánh `notDispatchable` |
| `inputs.dry_run` cho `labels`, `notify`, `watchdog`, `automerge` | bốn file đó, cộng `main-ci.yml` |
| chế độ thử in ra việc nó **định** làm | mỗi file, nhánh `[ "$DRY_RUN" = "true" ]`; có test khoá lại |
| **một** issue `alert` cho cả lần push, kèm tên + link + dòng lỗi đầu | `alertIssueBody` |
| không đụng `automerge` ở chế độ thật, có test riêng | `NEVER_REAL_DISPATCH` + `MERGE_PATTERNS`, 5 test |
| luật cảnh báo trong `pnpm lint:workflows` | `missingDryRun` |

**Hai chỗ làm khác tiêu chí, có lý do, không làm lặng lẽ:**

1. **Không dùng `workflow_run` trên `sync-workflows`** để khai thứ tự. Chưa ai trong repo kiểm bằng chạy thật rằng một lần chạy `sync-workflows` do `GITHUB_TOKEN` gọi có sinh ra `workflow_run` hay không — và cả nhóm **KF-004** sinh ra từ đúng loại giả định đó (CHARTER 11.1 luật 3). Thứ tự được bảo đảm bằng thứ **kiểm được**: bước "Chờ sync" đối chiếu nội dung `.github/workflows/` với `ops/workflows/` và không gọi gì cho tới khi hai bên khớp. Hai đường vào (`push` cho người merge, gọi tường minh từ `automerge` cho máy merge) phủ cả hai cách `ops/workflows/**` tới được `main`.
2. **Miễn trừ luật cảnh báo phải viết lý do ra** (`# P-010 dry-run: …`) thay vì chỉ có danh sách cứng. Cùng khuôn với `# KF-004 <sự kiện>: …` đã có, và cùng lý do: một cờ thì ai cũng bật được mà không nghĩ. `ci.yml` là ca đầu tiên dùng nó — mọi job có tác dụng phụ của nó đều khoá sau `if: github.event_name == 'pull_request'`, nên một lần gọi tay không chạm tới được.

**Chưa kiểm được ở đây, và đó là bản chất của mục này.** Nói chính xác hơn bản viết đầu (soát chéo sửa lại): `smoke-workflows.yml` **không** chạy ở lần merge của chính PR này. Workflow chạy theo sự kiện `push` là bản nằm trong `.github/workflows/` **tại commit đó**, mà file này còn mới — nó chỉ được `sync-workflows` chép vào rồi chạy ở lần `ops/workflows/**` đổi **kế tiếp**. Mọi bằng chứng ở đây là bằng chứng ở chỗ rẻ hơn: 19 test cho phần quyết định, 6 bài phá thử đo được là **đỏ đúng lúc phải đỏ**, và phần bash chọn commit đã chạy thật trên một repo git dựng riêng cho ba ca (commit sync, một lượt merge nhiều PR, phần lệch theo nội dung).

**Lượt worker sau phải đọc đúng lần chạy thật đó trước khi coi mục này `done`** — và đó cũng là lúc biết `automerge.yml` gọi một workflow vừa được THÊM có 404 hay không (đã xử lý bằng cảnh báo có lý do, chưa kiểm thật).

**Một chỗ để lại cho mục sau, không tự mở rộng PR này:** `automerge.yml` gọi `smoke-workflows.yml` **một lần cho cả lượt** và không truyền `-f sha=`. PR này đã bịt hai lối "xanh sai" nguy hiểm nhất từ phía `smoke-workflows.yml` (lùi qua commit sync bằng `git log --no-walk`; hợp với phần lệch nội dung so với `.github/workflows/`), nhưng cách sạch là `automerge.yml` truyền sha của **từng** commit merge. Đáng một mục `platform` riêng.

### P-011 · Chuỗi báo động phải tới được điện thoại, không phụ thuộc workflow thứ hai — **ưu tiên cao**
DoD Đợt 0 đòi "một cảnh báo thử của watchdog tới được điện thoại". Nó **chưa tới**. `watchdog` run #1 xanh, issue #8 mở đúng nhãn — nhưng `notify.yml` chưa từng chạy lần nào, vì GitHub không kích hoạt workflow từ sự kiện do `GITHUB_TOKEN` tạo ra. Xem **KF-004**.

Đây là mục **chặn DoD Đợt 0**, và nó chặn đúng cơ chế tồn tại để báo khi mọi thứ khác hỏng (rủi ro **B7**).

- deps: —
- risk: low
- status: review
- hold: kiểm bằng chạy thật — chỉ đóng khi xác nhận watchdog test_alert tới điện thoại, không đóng khi PR merge
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
- status: review
- hold: chỉ done khi bản tin thật in ra mục xung đột trong một lượt crux-digest chạy thật
- nguồn: `ops/known-failures.md` KF-002; CHARTER 3.3, mục 7, 2.5
- tiêu chí xong:
  - ✅ **Đã có từ trước lượt này** — `automerge.yml` đọc `mergeable` và `mergeable_state` của PR trước khi thử merge. Đang xung đột thì bỏ qua và in lý do ra log của lần chạy (`decideMerge` trả `skip`, bước "Xét từng PR" in mọi kết luận kể cả "không làm gì" — rà soát Z2), không thử merge rồi để API báo lỗi.
  - ✅ **Đã có từ trước lượt này** — `null` được hỏi lại ba lần, giãn 5 giây, trong bước "Xét từng PR" của `automerge.yml`; hết ba lần mà vẫn `null` thì `decideMerge` trả `recheck` và PR bị bỏ qua. `null` không bao giờ được đọc thành "merge được".
  - ✅ **Lượt `crux-worker-2` 2026-09-21 19:15Z** — `ops/scripts/digest-metrics.ts` thêm mục **PR đang xung đột với `main`**, kèm số giờ đã xung đột, xếp kẹt lâu nhất trước. Số giờ **đo lại bằng gộp thử** (`ops/scripts/conflict-watch.ts`, `git merge-tree --write-tree` với từng commit gần đây của `main` để tìm commit gây xung đột), không đọc ra từ văn xuôi trong trường `note` của `ops/logs/platform/P-016.jsonl`. Chưa dò được thì mục đó in `CHƯA DÒ`, **không** in `0`.
  - ✅ **Phần integrator tự giải: đã có ở mục `P-016`** (`ops/scripts/integrator-resolve.ts`) — gộp `main` vào PR xung đột khi cả hai bên thuần cộng thêm, huỷ merge khi không đủ điều kiện.
  - ⚠️ **Phần "gắn `parked` cộng mở `🤖 [QĐ]`" đã bị thay** bởi quyết định của mục `P-022`: một PR mà integrator bó tay là việc của **lượt worker kế tiếp** (phụ lục P1 bước 2 ca thứ ba), không phải một chỗ `parked` chờ chủ dự án. Dòng tiêu chí gốc viết trước `P-022`; giữ nguyên chữ ở đây thì hai nguồn lệch nhau. Không tự làm theo bản cũ.
  - ✅ **Đã có từ trước lượt này** — `ops/test/invariants-merge-gate.test.ts` có đủ ba ca: `mergeable: false`/`mergeableState: 'dirty'` → `skip`; `mergeable: null` → `recheck`; đủ điều kiện → `merge`.
- vì sao `review` chứ không `done`: mục này chỉ `done` khi bản tin **thật** in ra mục xung đột trong một lượt `crux-digest` chạy thật. Lượt worker này chạy được script bằng ảnh chụp `--github` (10 PR, 0 xung đột, trùng khít bước 0 đo độc lập) và dò lại được mốc kẹt cũ của PR #56 ra đúng `039b7f4` / `15:44:08Z` — cùng con số ba lượt trước đo bằng tay — nhưng lượt `crux-digest` đầu tiên sau khi merge mới là bằng chứng của chính bản tin.

### P-006 · Bảo vệ nhánh bằng ruleset
- deps: VF-G12
- risk: low
- status: review
- nguồn: CHARTER mục 10 (việc của chủ dự án); giả định G12
- tiêu chí xong:
  - ✅ Danh sách status check bắt buộc được ghi vào `docs/decisions/` sau khi chủ dự án bật — `docs/decisions/D-C08.md`, năm check `check`, `secret-scan`, `fix-has-test`, `protected-area`, `trailer-warn` của ruleset `protect-main`; nguồn máy đọc là `ops/scripts/required-checks.ts`.
  - ✅ Không bật được (gói không cho) thì ghi rõ và dựa vào `automerge.yml` cộng hook — ca này **không** xảy ra: `VF-G12` đã đo được ruleset bật thật, nên `D-C08` ghi phương án chính (đã bật) và giữ nguyên dự phòng, không gỡ.

### P-023 · Dòng log bước 0 tự khoá hàng đợi: tách khỏi file dùng chung `ops/logs/platform/P-016.jsonl`
Mỗi lượt integrator và mỗi lượt worker ghi một dòng bước 0 vào **cùng một** file `ops/logs/platform/P-016.jsonl`. Dòng đó vào `main` là mọi PR đang mở có dòng riêng trong file ấy **xung đột ngay** phía GitHub — vì GitHub không áp `merge=union` khi tự tính `mergeable` (**KF-009**), còn `automerge.yml` thì nghe phía GitHub.

Đã đo, không suy: lượt integrator 04:05 giờ VN 2026-09-22 thấy **7 PR** cùng đứng lại một lúc, cả 7 ở đúng file này, nguyên nhân là **một dòng duy nhất** mà `bfccc8c` (merge PR #80) mang tới. Giải xong 7 PR thì chính PR ghi log của lượt giải lại khoá **8 PR** cho lượt sau. Vòng này tự lặp mỗi lượt, và nó nuốt đúng thứ `P-016` sinh ra để xoá.

`D-C04` đã tách log tới mức **mục**, nhưng bước 0 không phải một mục — nó là **một lượt chạy** của mọi routine, nên mọi lượt dồn vào mã mục `P-016`. Lớp phòng thủ `merge=union` vẫn giữ đủ dữ liệu ở phía `git`, nhưng `KF-009` cho thấy nó **không bao giờ** một mình đủ để một PR merge được.

- deps: —
- risk: medium
- status: review
- hold: còn treo — file log hình dạng cũ chưa có gì chặn routine ghi lại theo hình dạng cũ; đáng mục platform riêng
- nguồn: `ops/known-failures.md` KF-009 và KF-005; `ops/logs/platform/P-016.jsonl` (dòng 20:12Z đề nghị việc này lần đầu, dòng 21:10Z đo được quy mô); quyết định `D-C04`; CHARTER mục 7
- tiêu chí xong:
  - ✅ Dòng bước 0 ghi vào file **theo lượt chạy**, không theo mã mục — hình dạng đã dùng thật ở `ops/logs/integration/P3-run-<ngày>T<giờ>.jsonl`, nên cơ chế gần như có sẵn. Chốt một tên file và **một** chỗ sinh ra nó (hàm của kernel hoặc `ops/scripts/`), đừng để mỗi routine tự ghép.
  - ✅ `ops/logs/README.md` và phụ lục **P3 bước 0d** của `CHARTER.md` nói cùng một đường dẫn. Lệch nhau thì lượt sau lại ghi vào file cũ.
  - ⚠️ Bên đọc không hỏng: `readRunLogs` gom theo thư mục nên tự thấy, nhưng `ops/scripts/digest-metrics.ts` và `ops/scripts/conflict-watch.ts` đang đọc **đích danh** `ops/logs/platform/P-016.jsonl` để lấy số giờ kẹt và chuỗi `aborted-ineligible` (phụ lục P2). Sửa cả hai trong cùng PR, **có test**.
  - ✅ Dòng cũ trong `P-016.jsonl` **không chuyển đi và không xoá** — log append-only (`ops/logs/README.md`). Bên đọc phải hiểu cả hai chỗ cho tới khi các dòng cũ rơi khỏi mọi cửa sổ thời gian đang dùng.
  - ✅ **Bằng chứng bằng chạy thật, không bằng lập luận:** dựng lại đúng hình dạng trên — hai nhánh cùng mang một dòng bước 0, một bên vào `main` trước — rồi đo `git merge-tree --write-tree` ở chế độ **tắt** `merge=union` (ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes`, cách mô phỏng GitHub mà KF-009 dùng). Trước khi sửa: `EXIT=1`. Sau khi sửa: `EXIT=0`.
  - ✅ Ghi kết quả vào `ops/known-failures.md` KF-009 — đó là chỗ đang giữ câu chuyện này.
- **Đã làm (lượt `crux-worker-1`, 2026-09-21 21:39Z → 22:0xZ):**
  - `kernel/src/log.ts` — `step0LogId` / `step0LogPath` / `step0LogRef` / `isStep0LogId`, cộng `STEP0_LOG_LANE` và `STEP0_LOG_PREFIX`. Một lượt chạy, một file: `ops/logs/integration/step0-<YYYY-MM-DDTHHMMSSZ>-<routine>.jsonl`. Mốc tới **giây** cộng tên routine, nên hai lượt đụng nhau chỉ khi cùng một routine chạy hai lần trong cùng một giây. Mili giây bị bỏ **có chủ đích**: hai lần ghi trong cùng một giây của *cùng* một lượt phải nối vào cùng file, không tách ra hai. Đầu vào bậy bị **ném**, không làm tròn thành mã gần đúng.
  - `ops/test/step0-log-path.test.ts` — bằng chứng chạy thật (bảng số ở KF-009), cộng lớp chặn "không file code nào neo vào đường dẫn log bước 0 cố định".
  - `kernel/test/log.test.ts` — 5 bài cho cơ chế mới, gồm ca hai múi giờ cùng mốc phải ra cùng mã và ca `misfiledLogLines` phải im (luật đường dẫn và luật `ref` phải là MỘT).
  - `CHARTER.md` phụ lục **P3 bước 0d** (chỗ ghi) và **P2 bước 2 + bước 3** (hai chỗ đọc), `ops/logs/README.md`, `ops/known-failures.md` KF-009, `ops/scripts/conflict-watch.ts` (chú thích).
  - **Dùng thật ngay trong PR này:** dòng bước 0 của chính lượt này nằm ở `ops/logs/integration/step0-2026-09-21T213922Z-crux-worker-1.jsonl`, **không** ở `P-016.jsonl`. Ghi vào file cũ sẽ khoá lại đúng 8 PR mà bước 0 của lượt này vừa giải — vòng lặp mà mục này sinh ra để cắt.
- ⚠️ **Đính chính một câu trong tiêu chí xong ở trên, đo chứ không suy:** `digest-metrics.ts` và `conflict-watch.ts` **không** đọc đích danh `ops/logs/platform/P-016.jsonl`. `digest-metrics.ts` gọi `readRunLogs(ops/logs)` trên cả thư mục — nó tự thấy file mới. `conflict-watch.ts` không đọc log bước 0 chút nào: nó **đo lại** mốc kẹt bằng cách gộp thử nhánh với từng commit của `main` (`PROBE_DEPTH`), đúng vì "đọc số ra khỏi văn xuôi là thứ hỏng im lặng". Chỗ duy nhất neo vào tên file cũ là **văn xuôi**: một chú thích trong `conflict-watch.ts` và hai chỗ trong `CHARTER.md` phụ lục P2 — đã sửa cả ba. Không có bản sửa code bên đọc nào để làm, và bịa ra một bản sửa cho khớp mô tả thì tệ hơn là nói ra chỗ mô tả sai. Thay vào đó, luật đáng khoá đã được khoá bằng máy (lớp chặn ở trên).
- **Vòng soát chéo (subagent, ngữ cảnh sạch) — 5 điểm, cả 5 đã sửa trong PR này.** Nó tự chạy lại `pnpm check`, `pnpm replay`, công cụ cửa merge, và tự **phá thật 5 kiểu** để kiểm bài kiểm có fail-open không (cả 5 đỏ đúng bài). Không có phát hiện nào chặn merge. Năm điểm:
  1. **Lớp chặn hẹp hơn lời nó tự khai.** Bản đầu quét không đệ quy, bỏ sót `ops/*.ts` và `ops/workflows/*.yml`, và regex chỉ khớp tên file **cũ** — nên chiều hỏng mà mục này lo nhất (ai đó neo vào tên file **mới**) chưa được khoá. Đã nới cả ba, loại `node_modules` và `ops/test/` khỏi phạm vi quét, và **phá thật cả bốn ca**: thư mục con, `ops/*.ts`, workflow `.yml`, và neo vào tên file mới — cả bốn đỏ đúng bài, khôi phục thì xanh.
  2. **`at` thiếu ký hiệu múi giờ cho mã phụ thuộc TZ của máy.** Đo thật: cùng chuỗi `2026-09-21T21:39:22` cho `…T213922Z…` với `TZ=UTC` và `…T143922Z…` với `TZ=Asia/Ho_Chi_Minh` — đúng múi giờ vận hành của dự án. Tên file ở đây **là danh tính của lượt chạy**, nên lệch 7 tiếng là hai lượt trùng tên. `appendRunLog` chuẩn hoá `at` nên dòng bên trong vẫn đúng và **không gì đỏ** — nhóm Z. Nay `at` phải khai `Z` hoặc `±HH:MM` và năm bốn chữ số, nếu không thì **ném**. Bộ test chạy lại dưới `TZ=Asia/Ho_Chi_Minh` cho cùng kết quả.
  3. **Không máy nào kiểm mốc trong tên file khớp `at` của dòng.** `misfiledLogLines` chỉ so `lane` và `ref` — mà `ref` khớp tên file là chuyện dễ, bên ghi ghép cả hai từ một chuỗi. Đáng lo hơn bình thường vì **chưa routine nào gọi `step0LogPath` từ trong code**: dòng bước 0 do routine viết theo văn xuôi CHARTER. `ops/test/logs-layout.test.ts` nay dựng lại mã từ `at` của từng dòng và so với tên file; phá thật bằng cách lệch `at` đi 7 tiếng → đúng bài đó đỏ. Đây cũng là chỗ dùng thật đầu tiên của `isStep0LogId`.
  4. **Một chỗ văn xuôi sót**, thân mục `P-016` còn dặn đọc `ops/logs/platform/P-016.jsonl` — đúng kiểu neo mà mục này sinh ra để xoá. Đã sửa.
  5. **Thiếu mã giả định `G17` tại chỗ** (CLAUDE.md mục 7). Đã ghi `G17` vào khối doc của `kernel/src/log.ts` và thêm hai file vào cột *Phần phụ thuộc* của `G17` trong `docs/assumptions.md`, kèm một câu nói rõ quan hệ là **được thúc đẩy bởi** chứ không phải **phụ thuộc vào**: G17 có hết `sai` thì hình dạng này vẫn đúng, chỉ bớt cấp bách.
- **Vòng soát chéo nêu thêm một rủi ro vận hành, đáng một mục riêng:** `ops/logs/integration/` sẽ **phình theo tốc độ sinh** — mỗi lượt worker và mỗi lượt integrator đẻ một file, và `readRunLogs` đọc **mọi** file mỗi lần bản tin hay metrics chạy. Với 2 worker mỗi giờ cộng integrator, đó là hàng chục file mỗi ngày. Mục này cố ý không giải: gom (rollup) và giữ (retention) là một thiết kế riêng, và đánh đổi sai ở đó sẽ làm mất dữ liệu chi phí. Bullet dưới đây nói về **hình dạng cũ**; cái này nói về **tốc độ sinh** — hai việc khác nhau.
- **Còn treo, không làm ở đây để khỏi trộn phạm vi:** các file hình dạng cũ (`integration/P3-run-*`, `integration/P3-daily-*`, `platform/P1-step0-*`) ở lại nguyên — append-only. Chúng không sinh thêm, nhưng cũng chưa có gì **chặn** một routine ghi lại theo hình dạng cũ: `misfiledLogLines` chỉ hỏi `lane` và `ref` có khớp tên file không, không hỏi tên file có đúng hình dạng lượt chạy không. Đáng một mục `platform` riêng khi các dòng cũ đã rơi khỏi mọi cửa sổ thời gian đang dùng.
- **mã mục nhận trước lúc 2026-09-22 04:1x giờ VN** (`ops/logs/README.md`, KF-005): `P-022` là mã cao nhất trên `main` **và** trên cả 11 nhánh PR đang mở tại lúc nhận, nên `P-023` không đụng ai.

### P-024 · Commit gộp của `integrator-resolve.ts` không mang trailer, và bước bù bằng tay đã hụt một lượt
Bước 0 tạo commit gộp bằng `git merge` bên trong `ops/scripts/integrator-resolve.ts`, nên commit ra đời với đúng một dòng thân: `Gộp origin/main (integrator, không xung đột)` — **không** `Claude-Session`, **không** `Co-Authored-By`. Các lượt trước bù bằng tay (`git commit --amend` trước khi push) và ba dòng log bước 0 đều ghi lại việc bù đó.

Đã đo, không suy: lượt worker `crux-worker-1` 2026-09-22 06:39 giờ VN bỏ bước bù, và **cả 9** commit gộp vừa push ra `Claude-Session=0 Co-Authored-By=0` — `51e3637`, `406f6f8`, `0f8f301`, `b186895`, `fef1a7f`, `7aa5cc7`, `9e4742f`, `4fe91f1`, `37cb1e0`. Không sửa lại được: tám trong chín nhánh là nhánh của PR người khác, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác.

Một bước đúng-đắn-bắt-buộc mà chỗ thực thi duy nhất là trí nhớ của routine thì nó sẽ hụt, và đây là lần hụt đầu tiên đo được. `trailer-warn` có `continue-on-error: true` (CHARTER mục 4, cố ý) nên không gì đỏ — đúng nhóm **Z**.

- deps: —
- risk: medium
- status: review
- hold: còn treo — cần người/nền tảng đặt CLAUDE_SESSION_URL; chưa lượt routine thật nào đặt biến đó
- nguồn: vòng soát ngữ cảnh sạch của PR `#93`; `ops/known-failures.md` KF-010; `CLAUDE.md` mục 6; giả định `G14`
- tiêu chí xong:
  - ✅ `integrator-resolve.ts` tự ghi trailer vào commit gộp nó tạo, ở **một** chỗ (`trailerMessageArg`, gọi ở cả đường `clean` lẫn `resolved`), không để routine bù tay. Mã phiên đọc từ môi trường `CLAUDE_SESSION_URL`; không có thì commit vẫn mang `Co-Authored-By`, và thiếu mã phiên trả `sessionTrailerMissing: true` trong `ResolveResult` — bên gọi (bước 0 phụ lục P1/P3) nói ra trong ghi chú, không nuốt im.
  - ✅ Tên hay mã model **không** lọt vào trailer: hằng `CO_AUTHOR_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>'` khoá cứng, không nội suy tên model từ đâu. Tool KHÔNG dùng `CLAUDE_CODE_SESSION_ID` (là UUID, không phải id của URL `.../session_…`) để tránh ghi một URL sai.
  - ✅ Có test: ba test mới ở `ops/test/integrator-resolve.test.ts` gọi tool trên cây dựng sẵn, đọc `git log -1 --format=%B` (và `%(trailers:key=Claude-Session)`) của commit gộp, khẳng định đủ hai trailer khi có URL, chỉ `Co-Authored-By` khi thiếu URL, và **không** có tên model. Đo được đỏ thật khi gỡ phần ghi trailer: 11 pass → 8 pass / 3 fail.
  - ✅ `ops/known-failures.md` KF-010 cập nhật dòng **Máy chặn từ nay** bằng tên ba test đó.
  - ⬜ **Còn treo, cần người/nền tảng đặt `CLAUDE_SESSION_URL`:** tool nay ghi `Claude-Session` khi biến môi trường có mặt, nhưng chưa lượt routine thật nào đặt biến đó, nên `Claude-Session` của commit gộp vẫn có thể vắng (khi đó `sessionTrailerMissing` báo ra). Đặt biến ở đầu lượt worker/integrator là việc nối dây tiếp theo; `Co-Authored-By` thì đã luôn có từ commit này.
- **ảnh hưởng tới `VF-G14`:** phép kiểm của `G14` là "đọc job `trailer-warn` trên các PR do routine mở, trong một tuần". Chín commit thiếu trailer này nằm trong cửa sổ đó và **không phải** tín hiệu nền tảng ghi hỏng trailer — chúng là bước bị bỏ. `VF-G14` phải loại chín mã băm trên ra khỏi mẫu, nếu không nó kết luận sai về `G14`.
- **mã mục nhận lúc 2026-09-22 06:5x giờ VN** (`ops/logs/README.md`, KF-005): `P-023` là mã cao nhất trên `main` **và** trên cả 16 nhánh PR đang mở tại lúc nhận, nên `P-024` không đụng ai.

### P-025 · `pickPrToHandle` không đếm ca "gộp sạch rồi đỏ", nên PR kẹt kiểu đó không có chủ
Quyết định `reversible` ở issue `#107`, phương án **A**. Một PR xung đột với `main` có **hai** cách kẹt, máy chỉ nhìn thấy **một**: công cụ tự gộp bó tay (`aborted-ineligible`, có đếm, có ngưỡng, nổi lên bản tin) và công cụ gộp **sạch** nhưng chạy thử sau khi gộp thì **đỏ** (không đếm, không ngưỡng, không nổi lên đâu cả). PR `#81` kẹt theo cách thứ hai **ba lượt liên tiếp** (09:04, 09:3x, 10:0x giờ VN ngày 2026-09-22) và không lượt worker nào nhận nó — đo được: cả ba lý do của `pickPrToHandle` đều sai với nó (CI trên nhánh xanh 5/5 vì nó chỉ đỏ *sau khi gộp*, hai comment đều do máy viết, chuỗi `aborted-ineligible` bằng 0 vì tool chưa lần nào bó tay). Đúng nhóm **Z**: hỏng mà mọi chỉ báo đều xanh.

- deps: —
- risk: low
- status: done
- nguồn: issue `#107` phương án A; dòng log bước 0 ở `#106`; mục `P-022`; `ops/known-failures.md` nhóm Z
- **cửa merge: `automerge-delayed`** — sửa Phụ lục P1/P2 của `CHARTER.md` (mục khác mục 1 và mục 3). Issue `#107` đoán là "không chạm vùng bảo vệ"; đoán đó **sai**, và ghi ra đây thay vì im: bảng lý do nằm trong Phụ lục P1 nên thêm một hàng vào code mà không sửa Phụ lục là để CHARTER nói "ba lý do" trong khi máy có bốn. Chạy `node ops/invariants.protected-area.ts` để xác nhận cửa.
- tiêu chí xong:
  - `TriageReason` có lý do thứ tư `red-after-merge`, và `TriageCandidate` có `redAfterMergeStreak` — cùng hình dạng với `abortedIneligibleStreak`, đọc từ cùng một dòng log bước 0, không phải đo thêm.
  - Thứ tự trong `pickPrToHandle`: `ci-red` → `unhandled-comment` → `red-after-merge` → `aborted-ineligible`. Giữ nguyên thứ tự ba lý do cũ (CHARTER Phụ lục P1 bước 2 chốt thứ tự đó), và đặt lý do mới trước `aborted-ineligible` như `#107` đòi.
  - Điều kiện chống giẫm chân (`ANTI_COLLISION_HOURS`) áp cho lý do mới **y như** ba lý do cũ, không có luật riêng.
  - `shouldAlertStreak` đếm được cả chuỗi mới: một hàm `stuckStreak` trả chuỗi kẹt của PR để bản tin (Phụ lục P2) gọi một chỗ duy nhất, không phải nhớ hai trường.
  - Phụ lục P1 bước 2 và Phụ lục P2 của `CHARTER.md`, cộng `ops/lanes/priority.md`, nói đúng **bốn** lý do.
  - Có test cho từng điều trên ở `ops/test/pr-triage.test.ts`. Đo được đỏ thật: reviewer ngữ cảnh sạch phá code ở bản copy 7 kiểu (đổi khe thứ tự, đổi `max` thành tổng, gỡ hẳn hàng mới, `>= 0` thay `> 0`, chống giẫm chân `>` thay `>=`) — **cả 7 đều bị bắt**.
  - `redAfterMergeStreak` có **luật trở về 0** ghi ra rõ: `0` khi PR có commit mới sau dòng log ghi chuỗi đó. Không có luật này thì PR đã chữa xong vẫn bị `pickPrToHandle` chọn lại mỗi lượt, làn đứng đói việc, và không gì đỏ (nhóm **Z**). Luật của `abortedIneligibleStreak` ("0 khi PR không còn xung đột") KHÔNG áp được ở đây, vì PR kẹt kiểu này vốn đã gộp sạch và bước 0a chỉ liệt kê PR đang xung đột.
  - Phụ lục P2 lọc theo "PR đang **kẹt ở hàng đợi merge**", không theo chữ "đang xung đột" — PR `red-after-merge` gộp SẠCH, nên lọc theo chữ cũ thì nó vẫn không có dòng nào trong bản tin, đúng chỗ PR #81 đã rơi.
  - `ops/known-failures.md` có mục cho lỗi lặp mà chính PR này mắc: trailer `Co-Authored-By` mang tên model (21/51 commit trên `main`), squash merge đưa vào lịch sử không revert lại được.
- **vòng soát ngữ cảnh sạch** (2026-09-22 ~10:5x giờ VN) chặn merge đúng một lý do — trailer mang tên model — và nêu bốn điểm tài liệu lệch code. Đã sửa cả năm trong PR này; hai commit của nhánh được amend về `Co-Authored-By: Claude <noreply@anthropic.com>` rồi force-push (nhánh của chính mình, không phải nhánh người khác).
- **vòng soát ngữ cảnh sạch thứ hai** (lượt `crux-worker-1`, 2026-09-22 ~11:0xZ, sau khi lượt này nhận PR ở bước 2 của phụ lục P1 và gộp `main`) chặn merge vì **cùng một lý do tái diễn**: ba commit mới của lượt đó lại mang tên model ở phần tên của `Co-Authored-By`, thay vì chữ `Claude` trần. Đã dựng lại ba commit với trailer trung tính model rồi force-push. Vòng soát này cũng bắt một lỗi thật khác: mục mới thêm vào `ops/known-failures.md` mang mã **trùng** `KF-011` với một mục đã có trên `main`, và thiếu dấu `---` phân cách — nay đổi thành **`KF-014`** (mã cao nhất trên `main` là `KF-013`) và đặt lại đúng thứ tự. Không kiểm tra nào trong `pnpm check` bắt được mã KF trùng, nên nó đi qua CI xanh trơn — đúng nhóm **Z** mà chính mục này đang chữa.
- **một lệch có sẵn trên `main`, KHÔNG sửa ở PR này vì khác mục:** lệnh mẫu ở `CLAUDE.md` mục 1 và ở Phụ lục P1 bước 7 thiếu `--base-charter`, nên `node ops/invariants.protected-area.ts --changed … --head .` trả `owner-merge` cho **mọi** PR chạm `CHARTER.md` ("không đọc được diff, nên coi như chạm mục 1 hoặc 3" — fail-closed, đúng thiết kế). Đo thật ở PR này: thiếu tham số → `owner-merge`; thêm `--base-charter <CHARTER.md của origin/main>` → `automerge-delayed`. Hệ quả: lượt sau dễ gắn `owner-merge` oan và đẩy việc sang chủ dự án. Cần một mục backlog riêng.
- **mã mục nhận lúc 2026-09-22 10:4x giờ VN** (`ops/logs/README.md`, KF-005): `P-024` là mã cao nhất trên `main` **và** trên cả 15 nhánh PR đang mở tại lúc nhận (đo bằng `git show refs/remotes/pr/<n>:ops/lanes/platform/backlog.md`), nên `P-025` không đụng ai.

### P-026 · Bước 0 chạy `integrator-resolve.ts` của **nhánh PR**, nên bản vá `P-024` không tới được nhánh nào
`P-024` chuyển việc ghi trailer **vào trong** `ops/scripts/integrator-resolve.ts` để bỏ hẳn bước bù bằng tay. Nhưng bước 0 `checkout` nhánh PR **rồi mới** gọi `node ops/scripts/integrator-resolve.ts`, nên **bản thật sự chạy là bản nằm trên nhánh đó**, không phải bản trên `main`. Nhánh nào mở ra trước khi `P-024` vào `main` thì vẫn chạy bản cũ, và bản cũ không ghi trailer.

Đo chứ không suy (lượt `crux-integrator` 2026-09-22 11:0x giờ VN): `git show <head>:ops/scripts/integrator-resolve.ts | grep -c CLAUDE_SESSION_URL` trả `3` trên `origin/main` (`09c91bb`) và `0` trên **cả 11** đầu nhánh PR đang mở **trước lần gộp của lượt đó** (`#39 #49 #56 #62 #65 #70 #71 #79 #81 #84 #89`).

Ca tệ nhất là im lặng: bản cũ **không có** trường `sessionTrailerMissing`, nên nó trả `{"outcome":"clean","files":[]}` mà không dấu hiệu nào báo trailer đã hụt. Ba test của `P-024` không bắt được vì chúng chạy bản trên cây làm việc, tức bản mới. Commit gộp `c2388bf` của `#39` đã push trước khi phát hiện và **không sửa lại được** (`CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác).

Đây là **lần gặp thứ hai** của cùng một chữ ký (KF-010), nên theo `CLAUDE.md` mục 13 phải sửa ở spec/prompt/cơ chế, **không** vá từng lượt chạy bằng trí nhớ routine — đúng cái nguyên nhân gốc mà lần gặp thứ nhất đã chẩn đoán. Nếu xảy ra **lần thứ ba** thì mục này gắn `parked` và mở `🤖 [QĐ]`.

Cùng hình dạng với **G17** ở một chỗ khác: *một luật nằm trong repo không tự áp cho chính lần gộp mang nó tới.*

- deps: P-024
- risk: medium
- status: ready
- nguồn: `ops/known-failures.md` KF-010 (lần gặp 2); vòng soát ngữ cảnh sạch của PR `#110`; `ops/logs/platform/P-016.jsonl` dòng lượt 11:0x giờ VN; `CLAUDE.md` mục 6 và mục 13; giả định `G14`
- tiêu chí xong:
  - Bước 0 gọi **bản `integrator-resolve.ts` của `main`**, không phải bản trên nhánh PR — ví dụ trích `git show origin/main:ops/scripts/integrator-resolve.ts` ra file tạm rồi chạy, hoặc một `ops/scripts/` bọc ngoài làm đúng việc đó ở **một** chỗ. Chốt một cách, đừng để mỗi routine tự nghĩ.
  - **Cổng độc lập với phiên bản script**, vì tiêu chí trên không cứu được các nhánh đang mở hôm nay: trước khi push, đọc lại commit gộp (`git log -1 --format='%(trailers:key=Claude-Session)'`), và trống thì **tự `git commit --amend` thêm trailer**, không phải chặn. Cổng này nằm trong code chạy từ `main`, không nằm trong văn bản prompt.
  - **Cổng đó KHÔNG được là luật cứng chặn push** — thứ tự và hành vi khi thiếu phải ghi rõ, nếu không nó làm kẹt cả hàng đợi: `CLAUDE_SESSION_URL` chưa đặt (tiêu chí dưới, vốn là tiêu chí `⬜` còn treo của `P-024`) thì `Claude-Session` rỗng ở **mọi** commit gộp, và một cổng "trống thì từ chối push" sẽ chặn **mọi** PR của bước 0 — hàng đợi KF-009 đứng im, đồng hồ 12 giờ của `automerge-delayed` không bao giờ tới hạn (CHARTER 3.3). Đúng hình dạng mà **CHARTER mục 4** đã cân nhắc và từ chối cho trailer (lý do `trailer-warn` để `continue-on-error: true`). Nên: amend rồi **đi tiếp**; chỉ từ chối push khi `Co-Authored-By` **cũng** vắng sau khi amend, tức tool hỏng thật chứ không phải thiếu biến môi trường. Thiếu riêng `Claude-Session` thì ghi `sessionTrailerMissing` vào ghi chú lượt và chạy tiếp.
  - **Thứ tự bắt buộc:** tiêu chí `CLAUDE_SESSION_URL` (dưới) phải xong **trước** cổng trên. Danh sách này phẳng nên nói rõ ở đây, đừng để ai đọc thành song song.
  - **Một tín hiệu quan sát được từ ngoài**, vì hai tiêu chí đầu vẫn do văn bản phụ lục P3/P1 gọi — tức vẫn là trí nhớ routine, và bỏ qua bước 0 thì không gì đỏ. Bước 0 ghi một trường **có cấu trúc** vào dòng log (ví dụ `resolverSource: "main" | "branch"` và `trailerAmended: true|false`), để lượt sau và `VF-G14` đọc được bằng máy mà không phải tin văn xuôi trong `note`. Đây là lỗ duy nhất còn hở của ca đã xảy ra.
  - Phụ lục **P3 bước 0b** và **P1 bước 0** của `CHARTER.md` nói cùng một cách gọi. Lệch nhau thì lượt sau lại chạy bản cũ. Cửa merge của phần sửa CHARTER: chạy `node ops/invariants.protected-area.ts`, **đừng đoán** (`CHARTER.md` các mục ngoài 1 và 3 là `automerge-delayed`).
  - Đặt `CLAUDE_SESSION_URL` ở đầu lượt worker/integrator — đây chính là tiêu chí `⬜` còn treo của `P-024`, và nó là **nhánh nguyên nhân thứ hai** của cùng triệu chứng: biến vắng thì `Claude-Session` vắng dù script đã mới. Hai nhánh nguyên nhân phải được nói rõ, kẻo `VF-G14` quy nhầm.
  - **Bằng chứng bằng chạy thật, không bằng lập luận:** dựng một nhánh mang bản `integrator-resolve.ts` **cũ** (không có `CLAUDE_SESSION_URL`), chạy bước 0 lên nó. Trước khi sửa: commit gộp ra đời không trailer và không gì đỏ. Sau khi sửa: cổng chặn push, hoặc commit gộp mang đủ hai trailer.
  - Ghi kết quả vào `ops/known-failures.md` KF-010, dòng **Máy chặn từ nay**.
- **ảnh hưởng tới `VF-G14`:** `c2388bf` phải bị loại khỏi mẫu, cùng lý do với chín mã băm mà `P-024` đã liệt kê — nó là ca này, không phải tín hiệu nền tảng ghi hỏng trailer. `trailer-warn` trả `success` trên `#39` dù commit không có trailer nào (job đặt `continue-on-error: true`, CHARTER mục 4), nên **không** dùng kết luận của job đó làm bằng chứng cho `G14` mà không đọc commit.
- **mã mục nhận lúc 2026-09-22 11:3x giờ VN** (`ops/logs/README.md`, KF-005): `P-025` là mã cao nhất trên `main` **và** trên cả 16 nhánh PR đang mở tại lúc nhận (đo từng nhánh, `#109` giữ `P-025`), nên `P-026` không đụng ai.

### P-027 · Cửa `automerge-delayed` chưa bao giờ merge được một PR nào — đồng hồ 12 giờ bị chính bước 0 đặt lại
Bất biến **I4** hứa: PR `automerge-delayed` vào `main` sau **12 giờ** CI xanh. Đo trên dữ liệu thật thì lời hứa đó **chưa một lần** được giữ. Cửa `open` (nhãn `automerge`) chảy bình thường; cửa `automerge-delayed` là một chỗ giữ **vĩnh viễn**.

Không có gì đỏ ở bất cứ đâu: CI xanh trên cả 13 PR, `mergeable_state: clean`, nhãn đúng, `automerge.yml` chạy đúng luật và trả `wait` đúng luật. Đúng nhóm **Z** — hỏng mà mọi chỉ báo đều xanh. Và không thành phần nào hỏng: docblock của chính `merge-gate.ts` nói việc đặt lại đồng hồ là **cố ý**. Lỗi nằm ở **vòng phản hồi** giữa nó và bước 0, nên đọc từng file riêng sẽ không bao giờ thấy.

**Cơ chế, ba câu:** `ops/invariants.merge-gate.ts` đo 12 giờ từ `ciCompletedAt`, cộng một cổng `if (input.ciSha !== input.headSha) return {outcome:'skip'}` buộc lần CI đó phải thuộc **đầu nhánh hiện tại**. Bước 0 (phụ lục P3, chạy ở đầu **mọi** lượt worker theo phụ lục P1) gộp `main` vào PR và push một commit mới. Commit mới là đầu nhánh mới là lần CI mới là đồng hồ **về 0** — và bước 0 chạy dày hơn 12 giờ rất nhiều.

**Đo, không suy (2026-09-22 05:4xZ, lượt `crux-worker-1`):**

| Phép đo | Kết quả |
|---|---|
| PR đang mở mang nhãn `automerge-delayed`, **đo lúc `2026-09-22T05:47Z`** | **13** (`#39 #42 #49 #56 #65 #79 #81 #83 #84 #85 #89 #109 #112`) — con số này trôi theo thời gian, luôn đọc kèm mốc đo |
| PR mang nhãn `automerge-delayed` do **máy** merge, tính trên **toàn bộ** 79 PR đã đóng | **0** |
| PR mang nhãn `automerge-delayed` từng vào `main` bằng bất cứ đường nào | **1** — `#43`, và đó là chủ dự án merge **tay** |
| PR có khoảng trống đầu-nhánh-không-đổi ≥ 12 giờ trong 24 giờ qua | **1 / 13** (chỉ `#42`) |
| `#39` — mở từ `2026-09-21T11:43Z`, tức **18 giờ** | 29 lần đổi đầu nhánh / 24 giờ · trống lớn nhất **3h19m** |
| `ops/invariants.merge-gate.ts` chạy thật trên trạng thái thật của `#39` | `{"outcome":"wait","reason":"CI xanh được 0.3 giờ, ngưỡng 12 giờ.","hoursLeft":12}` |

Số lần đổi đầu nhánh trong 24 giờ và khoảng trống lớn nhất, cả 13 PR: `#109` 50 lần/1h26m · `#112` 52/1h26m · `#89` 47/1h39m · `#79` 46/1h39m · `#65` 42/1h39m · `#84` 42/2h28m · `#81` 41/2h48m · `#56` 38/2h11m · `#83` 36/8h09m · `#85` 35/7h38m · `#39` 29/3h19m · `#49` 29/5h59m · `#42` 16/**12h02m**.

**Ca `#43` — đối chứng bắt buộc, và nó KHÔNG phủ định kết luận trên.** `#43` mang nhãn `automerge-delayed` và **đã vào `main`**, nên câu "cửa này chưa bao giờ cho PR nào qua" viết trần sẽ **sai**. Đọc kỹ thì nó củng cố kết luận: `#43` mở `2026-09-21T12:41:51Z`, merge `13:16:39Z` — **35 phút**, tức **trước** ngưỡng 12 giờ rất xa, nên `automerge.yml` ở mốc đó chắc chắn trả `wait` và không thể là thủ phạm. Trường `merged_by` chốt lại: `#43` ghi `HungQuach301` (người), trong khi PR do máy merge ghi `github-actions[bot]` — đối chứng `#113`, `merged_by: github-actions[bot]`. Vậy `#43` là **chủ dự án merge tay**, đúng loại thao tác mà thước đo "thời gian của anh" (CHARTER 1.3) đếm. PR delayed duy nhất còn lại đã đóng là `#44`, và nó đóng **không** merge.

**Phát biểu đúng, sau khi đã loại `#43`:** *máy* chưa bao giờ merge một PR `automerge-delayed` nào. Cửa delayed chưa một lần tự chảy; lần duy nhất một PR delayed vào được `main` là nhờ có người bấm.

**`#42` là ca đáng đọc kỹ nhất, vì nó cho thấy ngưỡng gần như không với tới được ngay cả khi không ai đụng vào PR.** Đầu nhánh đứng yên từ `2026-09-21T13:11:32Z` tới `2026-09-22T01:14:17Z` — 12h02m45s. CI xanh xong khoảng `13:12Z`, nên ngưỡng 12 giờ đạt khoảng `01:12Z`. `automerge.yml` chạy theo lịch **`cron: '23 * * * *'`**: lượt `00:23` còn sớm, lượt `01:23` thì đầu nhánh đã đổi hai lần. Cửa sổ sống của PR này rộng **khoảng 2 phút** và rơi đúng vào giữa hai lượt. Trượt.

**Phản biện đã loại trừ — "repo còn non nên chưa PR nào kịp tới hạn":** không đúng. Cửa `automerge-delayed` ra đời cùng `D-C06`, vào `main` lúc `2026-09-21T08:30:56Z` (`git log -1 -- docs/decisions/D-C06.md`), tức đã **21 giờ** tại lúc đo. PR delayed cũ nhất (`#39`) đã mở **18 giờ**. Cả hai đều vượt xa ngưỡng 12 giờ, và **5/13** PR (`#39` 18,2h · `#42` 17,6h · `#49` 16,3h · `#56` 14,6h · `#65` 12,6h) đã mở hơn 12 giờ. Nếu cửa chảy thì ít nhất vài PR phải đã vào `main` **bằng máy**.

**Vì sao chưa ai bắt được:** hệ quả "đồng hồ đặt lại" **đã** được ghi — mô tả `#85` và `#39` đều nói ra, phụ lục P3 bước 0c dặn phải ghi vào ghi chú, P-026 nhắc tới nó trong một tiêu chí. Nhưng mọi chỗ đó ghi nó cho **một lượt**, như một khoản phí phải trả. Không chỗ nào cộng lại theo thời gian để hỏi câu duy nhất quan trọng: *ngưỡng có bao giờ tới không.* Số đo một lượt thì vô hại; số đo tích luỹ nói rằng cửa này đóng.

**Quan hệ với `P-023` (PR `#85`) — đây là chỗ vòng lặp tự khoá:**

1. `KF-009`: GitHub không áp `merge=union`, nên một dòng bước 0 vào `main` làm mọi PR đang mở `dirty` phía GitHub.
2. `automerge.yml` nghe phía GitHub, nên PR `dirty` không merge được cho tới khi có commit gộp `main`.
3. Bước 0 gộp → hết `dirty`, nhưng đồng hồ 12 giờ về 0.
4. `P-023` cắt đúng nguyên nhân ở (1): dòng bước 0 xuống file riêng từng lượt. Nó **đã xong và đang nằm trong PR `#85`**.
5. `#85` mang nhãn `automerge-delayed`. Nên bản sửa cắt vòng lặp **bị chính vòng lặp đó giữ lại**.

Hai lớp phòng thủ chống nhau: không gộp thì GitHub báo `dirty` và `automerge` bỏ qua; gộp thì đồng hồ về 0 và `automerge` trả `wait`. Không đường nào ra bằng máy.

- deps: —
- risk: **high** — chặn mọi làn. Mục `ready` nào cũng nằm sau một PR không merge được; bước 3 của phụ lục P1 ra `idle` ở lượt này đúng vì lý do đó.
- status: review
- hold: còn treo — hai tiêu chí cuối (sửa cơ chế A/B + bằng chứng chạy thật) chờ 🤖 [QĐ] #116; không tự chọn A/B
- nguồn: đo ở lượt `crux-worker-1` 2026-09-22 12:4x giờ VN; `ops/known-failures.md` **KF-011** và KF-009; `ops/invariants.merge-gate.ts`; `ops/workflows/automerge.yml`; CHARTER mục 3 (bất biến I4) và 3.3; phụ lục P1 bước 0, P3 bước 0b–0c
- **cần chủ dự án trước khi làm:** gỡ kẹt ngay là một lần merge tay (đề xuất `#85`, vì nó cắt nguyên nhân gốc), và bản sửa lâu dài chạm `ops/invariants.*` (cửa `owner-merge`) hoặc CHARTER mục 3 (`irreversible`, CLAUDE.md mục 14). Issue `🤖 [QĐ]` **#116** kèm theo mục này.
- tiêu chí xong:
  - ✅ **Đo trước, sửa sau — ĐÃ LÀM (lượt `crux-worker-3` 2026-09-22):** lệnh `node ops/scripts/gate-flow.ts --prs <file.json>` trả lời "cửa `automerge-delayed` có chảy không" bằng số — với mỗi PR mang nhãn đó: khoảng trống đầu-nhánh-không-đổi dài nhất (`longestStableHours`), số lần đặt lại đồng hồ (`clockResets`), và số giờ còn thiếu so với ngưỡng (`hoursShort`). Nguồn là `git log --first-parent` trên `refs/pull/<n>/head` cộng nhãn từ đầu vào, **không** đọc văn xuôi trong `note` của log. Đo thật lúc làm: **14 PR delayed · 0 đang ở/quá ngưỡng · 1/14 (`#42`) từng có cửa sổ ≥ 12 giờ · tổng 154 lần đặt lại đồng hồ** — chữ ký KF-011 xác nhận bằng số. Đếm phạm vi `origin/main..refs/pull/<n>/head` (chỉ commit riêng của PR, không kể tổ tiên chung với `main`). Kiểm ở `ops/test/gate-flow.test.ts` (18 test).
  - Bản tin ngày (phụ lục P2, mục "Đang chờ merge") nói **số giờ còn lại thật**, tính theo đồng hồ đã bị đặt lại — chứ không phải giờ kể từ lúc gắn nhãn. Dòng nào đã bị đặt lại quá N lần thì nói ra. Hiện bản tin không phân biệt hai thứ đó, nên một PR kẹt vĩnh viễn trông giống một PR sắp tới hạn.
  - **Bản sửa cơ chế — hai phương án, chọn bằng `[QĐ]`, đừng tự chọn:**
    - **(A) Bước 0 không gộp PR mà `git` nói là gộp sạch.** Đo lại bằng `git merge-tree --write-tree` (đã có sẵn: `branchConflicts` trong `ops/scripts/conflict-watch.ts`) trước khi tin `mergeable_state`. Đúng phạm vi mà phụ lục P3 bước 0a đã khai ("PR có `mergeable_state` là xung đột"), và cắt phần lớn các lần đặt lại vô ích. **Không đủ một mình:** với PR mà GitHub báo `dirty` thật theo `KF-009`, bỏ gộp nghĩa là `automerge` bỏ qua mãi mãi. Nên (A) phải đi cùng `P-023`.
    - **(B) Đồng hồ 12 giờ không tính lại vì một commit gộp của bước 0.** Đo từ lần CI xanh trên commit **có nội dung** gần nhất, bỏ qua commit gộp do bước 0 tạo (nhận ra bằng chữ ký commit, không bằng văn xuôi). Chạm `ops/invariants.merge-gate.ts` → cửa `owner-merge`; và nếu đọc thành "sửa ý nghĩa bất biến I4" thì là `irreversible`. **Đánh đổi phải nói thẳng:** 12 giờ là khoảng để chủ dự án kịp nói `dừng`; một commit gộp không đổi ý định của PR, nhưng nó **có** đổi thứ sẽ vào `main`, nên (B) rút ngắn thời gian soát thật.
  - **Bằng chứng bằng chạy thật, không bằng lập luận:** dựng lại đúng hình dạng — một PR `automerge-delayed` CI xanh, rồi một commit gộp bước 0 — và chạy `ops/invariants.merge-gate.ts`. Trước khi sửa: `outcome: "wait"`, `hoursLeft` quay về 12. Sau khi sửa: `merge`. Kèm **ca âm**: một commit có nội dung thật thì đồng hồ **phải** tính lại, nếu không (B) biến thành "merge bất chấp mọi thay đổi".
  - Ghi kết quả vào `ops/known-failures.md` **KF-011**.
  - ✅ **Bản tin nói số giờ thật — ĐÃ LÀM (lượt `crux-worker-1` 2026-09-22, PR `#120`):** `digest-metrics.ts` in mục **"Đang chờ merge"** từ chính `gate-flow.ts`, tức theo **đồng hồ đã bị đặt lại**, không phải giờ kể từ lúc gắn nhãn. Ba luật của dòng đó, mỗi luật một test: (a) không đo được thì in `CHƯA ĐO`, **không** in `0` — cùng luật `P-007`, và PR mang nhãn mà thiếu trong map đo vẫn hiện ra ở hàng "không đọc được lần đổi đầu nhánh nào" thay vì âm thầm rơi khỏi con số; (b) PR đang **xung đột** thì **thay** số giờ bằng lời nói về xung đột, vì đồng hồ không chạy khi đang xung đột (CHARTER 3.3) và mục "PR đang xung đột" ngay trên đã có số giờ kẹt — in cả hai là để bản tin tự mâu thuẫn trong một mục; (c) khi **không PR nào** từng đạt ngưỡng thì dòng dặn nói thẳng `⚠️ Cửa delayed hiện CHƯA CHẢY … gỡ kẹt cần một lần merge tay`, chứ **không** khuyên "không làm gì thì nó tự vào `main`" ngay dưới 13 dòng nói ngược lại. Phụ lục **P2** sửa theo.
  - ⬜ **Việc nhỏ còn nợ, vòng soát ngữ cảnh sạch của `#120` nêu, không chặn tiêu chí nào:** dòng "Đang chờ merge" chưa có phần "chạm gì trong vùng bảo vệ", chưa có "· N lượt liên tiếp không tự giải được", chưa có các dòng `owner-merge` mà phụ lục P2 đòi trong cùng mục; 14 dòng delayed làm bản tin vượt mức ~25 dòng của P2 (nên cắt còn 5 dòng gần tới hạn nhất cộng "và N PR khác"); `probeOrigins` và `probeDelayedHeadChanges` mỗi lượt `git fetch` hai lần cho tập ref chồng nhau.
  - ⬜ **Ngoài mục này, cần một mục riêng:** lệnh trong `CLAUDE.md` mục 1 và phụ lục P1 bước 7 thiếu `--base-charter`, nên mọi PR chạm `CHARTER.md` chạy đúng như tài liệu viết sẽ ra `owner-merge` (lớp chặn ngả về phía người khi không đọc được diff) thay vì cửa thật. Lỗi tài liệu có sẵn trên `main`.
- ⬜ **CÒN TREO — hai tiêu chí cuối (bản sửa cơ chế A/B và bằng chứng chạy thật của nó) CHỜ `🤖 [QĐ] #116`.** Lượt `crux-worker-3` chỉ làm phần **đo** (tiêu chí "đo trước, sửa sau" ở trên) — nó là cửa `open`, đảo ngược được, không chạm `ops/invariants.*` nên không đứng sau quyết định nào. Bản sửa cơ chế chạm `ops/invariants.merge-gate.ts` (cửa `owner-merge`) và có thể là `irreversible` (đổi ý nghĩa I4), nên KHÔNG được tự chọn A hay B: chờ câu trả lời của chủ dự án ở `#116` (đọc cả issue `#116` lẫn issue bản tin, dạng `#116 A`). Có câu trả lời thì lượt sau mở lại mục này thành `ready` để làm nốt — cùng nếp `VF-G7`/`VF-G19`. Dòng bản tin (tiêu chí 2) **đã xong ở `#120`**, không phải chờ lượt đó. Mục này KHÔNG được tự chuyển `done` khi PR đo merge — ô ⬜ này giữ nó lại (`ops/scripts/backlog-status.ts`, `HOLD_MARKERS`).
- **mã mục nhận lúc 2026-09-22 12:4x giờ VN** (`ops/logs/README.md`, KF-005): `P-026` là mã cao nhất trên `main` **và** trên cả 18 nhánh PR đang mở tại lúc nhận (đo từng nhánh), nên `P-027` không đụng ai.

### P-028 · fix · Hai khoá `env:` làm `smoke-workflows.yml` thành YAML không hợp lệ; linter workflow dựng thêm luật khoá trùng
`smoke-workflows.yml` có hai khoá `env:` liền nhau trong step `Xác định commit và workflow vừa đổi`. Một mapping YAML không được có hai khoá cùng tên: GitHub từ chối cả workflow ở mức khởi động (`startup_failure`, 0 job), nên nó đỏ ở **mọi** lần push. Sáu PR đang mở (`#65`, `#154`, `#155`, `#156`, `#157`, `#159`) mang check đỏ vì nó, trong đó bốn PR chỉ là dòng-log không đụng workflow nào. `pnpm lint:workflows` không bắt vì nó không dựng cây YAML (nhóm Z: xanh ở chỗ rẻ, đỏ ở chỗ đắt). Chi tiết: `ops/known-failures.md` `KF-016`.

- deps: —
- risk: medium — không chặn cửa merge (`ops/invariants.merge-gate.ts` chỉ đọc `ci.yml`), nhưng vô hiệu hoá chính lưới an toàn `smoke-workflows` và làm mọi PR trông đỏ.
- status: review
- nguồn: lượt `crux-worker-2` 2026-09-22 ~19:18Z; `ops/known-failures.md` `KF-016`; 8 lần chạy `smoke-workflows.yml` (#1–#8) đều `startup_failure`.
- **mã mục nhận lúc 2026-09-22 ~19:18Z:** `P-027` là mã cao nhất trên `main`; `P-028` không đụng ai.
- tiêu chí xong:
  - Gộp hai khoá `env:` thành một trong `ops/workflows/smoke-workflows.yml` (sửa cấu hình, không vá sản phẩm). ✅
  - Test tái hiện lỗi (bất biến I2, CI chặn): `duplicateMappingKeys` mới trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Ca âm hai `env:` trong một step **đỏ**, ca âm hai `on:` gốc **đỏ**; ca dương (hai `- name:` liền nhau, nội dung `run: |`, cả cây `ops/workflows/` thật) **sạch**. Đo được đỏ thật trên bản `smoke-workflows.yml` trước khi sửa. ✅
  - `ops/known-failures.md` `KF-016` điền dòng *Đã sửa ở đâu* và *Máy chặn từ nay*. ✅

---

### P-030 · Một lớp chặn mới sẽ làm đỏ 13/29 PR đang mở, và cách sửa duy nhất trong nhánh thì máy cấm agent làm
PR `#142` (mục `KF-014`) thêm job **chặn** `no-model-name`, quét `origin/main..HEAD` để bắt tên model trong khối trailer. Luật nó thực thi là đúng (`CLAUDE.md` mục 6), phạm vi nó quét cũng đúng (`automerge.yml` merge bằng squash, nên thân mọi commit của nhánh **có** tới `main`). Nhưng nó được viết ra **sau** khi các commit vi phạm đã nằm sẵn trong lịch sử của các nhánh đang mở.

Đo trên toàn bộ PR đang mở (~21:45Z, `origin/main = 5ded395`, chạy bản checker của nhánh `#142`): **30 commit vi phạm trải trên 13 / 29 PR** — `#39` `#42` `#49` `#56` `#65` `#79` `#81` `#84` `#89` `#112` `#153` `#157` `#164`. Nặng nhất `#42` (9/10 commit). Ba PR log của làn `integration` — `#153` `#157` `#164` — dính **1/1**, tức commit vi phạm là commit **duy nhất** của PR, nên không có gì để giữ lại khi dựng lại nhánh. Sạch: `#66` `#109` `#117` `#120` `#129` `#142` `#149` `#150` `#151` `#154` `#155` `#156` `#159` `#160` `#161` `#162`.

`#142` mang nhãn `automerge-delayed`, tức **máy tự merge** sau 12 giờ CI xanh. Không ai phải bấm gì để 13 PR kia đứng lại, trên một hàng đợi vốn tuần tự và vốn đã đứng vì `automerge` 403 (issue `#152`).

Cách sửa duy nhất nằm trong nhánh — viết lại thông điệp commit rồi **force-push** — bị `.claude/settings.json` chặn ở `deny` (`Bash(git push --force:*)`, `Bash(git push -f:*)`). Theo `CLAUDE.md` mục 3, bị chặn không phải lỗi cần lách. Nên mục này **không** tự chọn đường: xem `🤖 [QĐ] #165`.

- deps: —
- risk: high
- status: parked
- **vì sao `parked`, không phải `blocked`** (mục `I-019`): `blocked` không thuộc tập hợp lệ
  `ready · claimed · review · done · parked` (`ops/lanes/README.md`), nên mục này rơi qua cả hai phép lọc
  của `pnpm backlog:status` và im lặng từ lúc được viết. Giá trị đúng là `parked`: `CLAUDE.md` mục 13 định
  nghĩa đúng hình dạng này — chặn ở một quyết định của chủ dự án, đã mở `🤖 [QĐ]`, làn chuyển sang mục
  khác. Nội dung mục không đổi chữ nào.
- nguồn: `ops/known-failures.md` KF-018; comment 15:55Z và 17:45Z trên PR `#65`; điểm 6 của vòng soát trên PR `#112` (18:53Z); `.claude/settings.json` phần `deny`; `CLAUDE.md` mục 6 và mục 13
- tiêu chí xong:
  - Chốt một trong ba đường ở `🤖 [QĐ] #165`: (a) chủ dự án force-push 13 nhánh; (b) `#142` thêm mốc ân hạn, chỉ quét commit tạo **sau** khi luật bật; (c) `automerge.yml` truyền `commit_message` tường minh lúc squash — lưu ý file đó là vùng `owner-merge`.
  - Làm theo đường đã chốt, **trước khi** `#142` vào `main`. Vào sau là đo lại 13 PR rồi gỡ từng cái, đắt hơn nhiều.
  - **Bằng chứng bằng chạy thật:** chạy checker của `#142` trên **mọi** nhánh PR đang mở, trước và sau. Trước: 13 PR đỏ. Sau: 0 PR đỏ — hoặc, nếu chọn (a), danh sách PR còn đỏ đúng bằng danh sách nhánh chưa được dựng lại, không PR nào ngoài danh sách đó.
  - Luật chung ghi vào `ops/known-failures.md` KF-018: **lớp chặn mới quét `origin/main..HEAD` phải được chạy thử trên mọi nhánh PR đang mở trước khi bật.** Đó là phần tái dùng được của mục này; ba đường ở trên chỉ gỡ lần này.
  - ⚠️ Không thêm lớp chặn mới nào cho chính vấn đề này trước khi `#165` có câu trả lời — nhân đôi đúng cái bẫy mà mục này mô tả.
- **mã mục nhận lúc 2026-09-22 ~22:1x giờ VN** (`ops/logs/README.md`, KF-005): dò `P-` trên `main` **và trên mọi nhánh PR đang mở** (không chỉ vài nhánh nhớ được — xem cảnh báo ở đầu `KF-018`): cao nhất là `P-029` (`#162`), nên `P-030` không đụng ai.

 claude/hopeful-dirac-hk8edy
---

### P-032 · Đường về xanh của `main` bị khoá sau cửa 12 giờ — hai câu trong CHARTER nói ngược nhau
`CLAUDE.md` mục 13 và CHARTER phụ lục P3 bước 1 đòi sửa một `main` đỏ **ngay**. Luật vùng bảo vệ (CHARTER mục 3, `D-C06`) phủ `ops/workflows/**` ở mức `automerge-delayed`, tức **12 giờ CI xanh**. Khi `main` đỏ **vì một workflow**, mọi bản sửa — sửa tại chỗ hay revert — chạm đúng thư mục ấy, nên cửa 12 giờ áp cho chính thứ đáng lẽ đi nhanh nhất.

Đo `2026-09-23 ~00:40Z`, `origin/main = ecd0085`, đỏ từ `23:05:06Z` (`7dfdfeb`, PR `#42`): ba cổng đỏ trên cây sạch (`lint:workflows` EXIT=1 bốn dòng `spike-canvas.yml`; `check:tests` EXIT=1; `pnpm test` 790 pass / **3 fail**). Bản sửa `#167` **CI xanh 5/5 từ `00:03Z`**, nhưng `node ops/invariants.protected-area.ts` trên diff của nó ra `{"gate":"automerge-delayed"}` vì `ops/workflows/spike-canvas.yml` — nên `main` còn đỏ cho tới khi `#167` tự merge — **dự kiến** ~`12:03Z` (đồng hồ 12 giờ chạy từ lúc CI xanh trên đầu nhánh, `00:03Z`, không phải từ lúc `main` đỏ — CHARTER 3.3). Đây là chiếu, không phải số đo: nó đổi nếu `#167` bị push mới, bị comment `dừng`, hoặc CI đổi màu.

Giá phải trả, đo ở bước 0 cùng lượt: **6 / 16 PR đang mở** xung đột, `integrator-resolve.ts` trả `aborted-ineligible` cho **cả 6**, 0 giải, 0 push. Và vì CI dựng `refs/pull/N/merge` (**đo được** trên chính PR của mục này — xem `KF-020`), **mọi** PR đang mở đỏ ở lượt CI kế tiếp. Chính xác hơn về thời điểm: `ci.yml` chỉ chạy trên `pull_request` với `[opened, synchronize, reopened, labeled, unlabeled]`, nên "lượt kế tiếp" tới khi PR có sự kiện mới, không phải ngay lập tức. Không gì đỏ ngoài `main` — nhóm Z: mỗi luật đều đúng, chỗ thủng ở chỗ hai luật gặp nhau.

- deps: —
- risk: **high** — mỗi lần `main` đỏ vì workflow là ~12 giờ toàn bộ hàng đợi merge đứng, không ai phải bấm sai gì cả.
- status: done
- nguồn: `🤖 [QĐ] #169` (**đã trả lời: A**, `01:19:54Z` ngày 2026-09-23, kèm sáu điều kiện) → `docs/decisions/D-C07.md`; `🤖 [QĐ] #175` (PR `#168` ra cửa `owner-merge`, cần chủ dự án merge); `ops/known-failures.md` **KF-020**; dòng log bước 0 `ops/logs/integration/step0-2026-09-23T004600Z-crux-worker-1.jsonl`; `CLAUDE.md` mục 13; CHARTER mục 3 + phụ lục P3 bước 1; `D-C06`
- tiêu chí xong:
  - ✅ **`🤖 [QĐ] #169` đã có câu trả lời: A**, kèm sáu điều kiện, chốt lâu dài ở `docs/decisions/D-C07.md`. Sáu điều kiện là phép kiểm máy ở `ops/invariants.hotfix-lane.ts`, không phải lời dặn — đó là chỗ câu trả lời đòi khắt khe nhất.
  - ✅ **Chứng minh bằng chạy thật** (`origin/main = 00f2f84`, 2026-09-23 ~04:0xZ, đầu ra THẬT của `pnpm check` EXIT=1):
    - `node ops/scripts/main-red-scope.ts` trên đầu ra đó → `{"sha":"00f2f84","files":["ops/workflows/spike-canvas.yml"]}` — đúng một file, đúng chỗ hỏng thật.
    - `node ops/invariants.protected-area.ts` trên diff "chỉ sửa `spike-canvas.yml`" → `{"gate":"automerge-delayed"}`. Cửa **không** đổi, và đó là chủ đích: lối nhanh không nới vùng bảo vệ, nó chỉ bỏ khoảng chờ.
    - `node ops/invariants.hotfix-lane.ts` trên cùng diff đó, với thân cảnh báo thật của `#131` cộng khối phạm vi ở trên → `{"lane":"hotfix"}`.
    - Bốn ca âm, chạy thật cùng lượt: chạm `watchdog.yml` (ngoài phạm vi) → `normal`; chạm thêm `ops/scripts/check-test-coverage.ts` (tầng luật, đúng hình dạng `#167`) → `needs-decision`; chạm `automerge.yml` → `needs-decision`; không có nhãn `hotfix` → `normal`.
  - ✅ **Bài tái hiện (bất biến I2)** trong `node --test`: `ops/test/invariants-hotfix-lane.test.ts` 14 bài (gồm ca "phân biệt hai ca" mà câu trả lời đòi), `ops/test/main-red-scope.test.ts` 8 bài, và 9 test âm mới ở `ops/test/invariants-merge-gate.test.ts` — lối nhanh không bỏ CI đỏ, không bỏ `fix-has-test`, không thắng lời `dừng`, không mở được cửa `owner-merge`. Nới đúng một ca, không nới cả thư mục: có test riêng cho "cùng thư mục vẫn là ngoài phạm vi".
  - ✅ **Chỗ lệch hai câu đã sửa**, đúng chỗ chủ dự án chỉ ra: CHARTER phụ lục P3 bước 1 và thân issue cảnh báo do `main-ci.yml` sinh ra thôi ghi cứng nhãn `automerge` — nhãn nay là trường `gate` do tool tính, cộng `hotfix` khi đủ điều kiện. Cùng câu đó sửa ở `CLAUDE.md` mục 13 và mục 2, CHARTER 3.3 và nhật ký thay đổi **C8**.
  - ⚠️ **Chỗ chưa che, khai ra:** bản sửa vừa sửa chỗ hỏng vừa siết thêm luật ra `needs-decision`, tức vẫn chờ 12 giờ (`#167` là ví dụ thật). Cách đi: tách hai PR. Ghi ở `D-C07` và `KF-020`.
  - ⚠️ **Hai vế còn lại của câu trả lời KHÔNG nằm trong mục này**, để mỗi PR một phạm vi: `P-034` (@nhắc mỗi 4 giờ cho cảnh báo khẩn) và `P-035` (bản tin có mục riêng cho lần merge lối nhanh).
- **mã mục nhận lúc 2026-09-23 ~00:4x giờ UTC** (`ops/logs/README.md`, `KF-005`): dò `### P-` trên `main` **và trên mọi nhánh PR đang mở** (không chỉ vài nhánh nhớ được — cảnh báo ở đầu `KF-018`): cao nhất là `P-031` (`#167`), nên `P-032` không đụng ai.

---

### P-034 · Cảnh báo khẩn phải @nhắc ngay ở comment đầu tiên, và nhắc lại mỗi 4 giờ
Chủ dự án dặn kèm câu trả lời `#169`: **mọi** cảnh báo khẩn của CHARTER 2.4 phải `@nhắc` ngay trong comment **đầu tiên**, và nhắc lại **mỗi 4 giờ** khi chưa có phản hồi. Số đo của anh: cảnh báo `#131` mở lúc `2026-09-22T10:14Z` và **13 giờ** sau mới @nhắc.

Luật hiện hành đi ngược lại có chủ đích: `main-ci.yml` cố ý **không** @nhắc ở lần đỏ đầu (`D-C06`, "gọi người ở phút đầu là gọi người cho một việc mà máy sắp tự làm xong"), và chỉ @nhắc **đúng một lần** sau 2 giờ, canh bằng mốc `<!-- crux-escalate-main-do -->`. Nên mục này là **sửa luật**, không phải sửa lỗi: nó đổi cả hai vế (độ trễ và số lần), và nó đổi ở hai chỗ — `main-ci.yml` và `watchdog.yml`.

- deps: —
- risk: medium — @nhắc quá dày làm loãng chính cảnh báo; quá thưa thì lặp lại đúng chỗ `#131` đã trượt. Chủ dự án đã chốt con số, nên rủi ro còn lại chỉ là chỗ thực thi.
- status: review
- hold: nhịp @nhắc 4 giờ chưa quan sát được bằng chạy thật — chỉ chạy khi `main` đỏ hoặc người canh có dấu hiệu
- nguồn: comment của chủ dự án trên `🤖 [QĐ] #169` (`2026-09-23T01:19:54Z`); CHARTER 2.4; `D-C06`; `docs/decisions/D-C07.md` mục "Việc còn lại"
- tiêu chí xong:
  - ✅ `main-ci.yml`: @nhắc nằm trong thân issue **ngay lần đỏ đầu**, và một comment nhắc lại khi lần @nhắc gần nhất đã quá **4 giờ**. Mốc `<!-- crux-escalate-main-do -->` không còn là "đã nhắc thì thôi" mà là "đã nhắc lúc nào" — đọc `createdAt` của comment mang mốc đó, đừng đếm số comment.
  - ✅ `watchdog.yml`: cùng luật 4 giờ cho ba loại cảnh báo còn lại của CHARTER 2.4. Mốc riêng `<!-- crux-escalate-watchdog -->`, để hai cảnh báo không đếm nhầm nhịp của nhau.
  - ✅ Test: một issue đã @nhắc 3,9 giờ trước thì **không** nhắc lại; 4,1 giờ trước thì nhắc lại. Hàm quyết định tách khỏi bash (`ops/scripts/alert-escalation.ts`), 14 bài kiểm ở `ops/test/alert-escalation.test.ts`, chạy được không cần Actions.
  - ✅ CHARTER 2.4 sửa theo, kèm một dòng nhật ký thay đổi (**C9**): câu "không @nhắc ở lần đầu" của `D-C06` bị thay, và nói rõ là bị thay.
- ✅ **Làm ở PR #198** (nhánh `claude/platform/P-034`, lượt `crux-worker-1` 2026-09-23). Ba chỗ phải đọc đúng, vì cả ba đều là chỗ luật này hỏng im lặng:
  - **Comment cập nhật KHÔNG mang mốc.** Cả hai workflow đăng một comment tình trạng ở mỗi lượt (lịch mỗi giờ). Mốc lọt vào comment đó thì "lần @nhắc gần nhất" bị đẩy về hiện tại ở mọi lượt và nhịp 4 giờ **không bao giờ** tới hạn — @nhắc chết hẳn mà không gì đỏ.
  - **Thân issue là một mục trong danh sách.** Lần @nhắc đầu tiên nằm ở thân chứ không ở comment, nên `gh issue view` phải lấy `body` + `createdAt` rồi nối trước `comments`. Bỏ thân ra thì lượt nào cũng thấy "chưa nhắc lần nào" và gọi chủ dự án mỗi giờ — đúng cái spam vế 2 muốn tránh.
  - **`createdAt` không đọc được thì BỎ QUA và ĐẾM**, không tính thành một lần @nhắc: hướng an toàn của một cảnh báo khẩn là gọi thừa, không phải im. Số mục bị bỏ qua đi ra ngoài qua `unreadableMarkerComments` và bash in nó ra, nên phép đo không im lặng thành cận dưới.
  - ⬜ **Chưa quan sát được bằng chạy thật** — nhịp 4 giờ chỉ chạy thật khi `main` đỏ hoặc người canh có dấu hiệu, và cả hai đang không xảy ra. Giữ `review`, không tự chuyển `done`: bài kiểm phủ phần quyết định, không phủ hai khối bash gọi nó.
- **mã mục nhận lúc 2026-09-23 ~04:0x giờ UTC** (`ops/logs/README.md`, `KF-005`): dò `### P-` trên `main` **và trên mọi nhánh PR đang mở** (`refs/pull/N/head` của cả 21 PR, không chỉ vài nhánh nhớ được): cao nhất là `P-033` (`#173`), nên `P-034` không đụng ai.

---

### P-037 · CHARTER mục 3 còn dẫn về ngưỡng @nhắc 2 giờ đã bị thay
Mục 3, dòng về `main` đỏ, vẫn viết: *"Chủ dự án chỉ được gọi khi `main` còn đỏ sau 2 giờ (2.4)."* Câu đó dẫn về đúng luật mà `P-034` đã thay ở mục 2.4 (@nhắc ngay ở comment đầu, nhắc lại mỗi 4 giờ) — tài liệu nói một đằng, `main-ci.yml` làm một nẻo. Routine integrator đọc chính dòng này khi xử lý `main` đỏ.

Tách khỏi `P-034` vì **cửa merge khác**, không phải vì phạm vi khác: đo bằng `node ops/invariants.protected-area.ts --base-charter` thì `P-034` (mục 2 và 14) ra `automerge-delayed`, còn sửa thêm dòng này kéo cả PR sang `owner-merge` vì luật cắt CHARTER **theo mục** và đây là mục 3. Gộp vào sẽ bắt chủ dự án merge tay một PR vốn máy tự merge được — ngược thước đo mục 1.3.

- deps: P-034
- risk: low — một câu tài liệu, không chạm code
- status: ready
- ghi chú: `P-034` (PR `#198`) phải vào `main` trước, để hai bản CHARTER không đá nhau.
- **vì sao `ready`, không phải `blocked`** (mục `I-019`): `blocked` ngoài tập hợp lệ nên mục này biến mất
  khỏi mọi báo cáo. Chỗ chặn ở đây là một **`deps`**, nên để `readyQueue` giữ và thả: nó xếp mục vào
  `blocked` kèm lý do `platform/P-034` chừng nào `P-034` chưa vào `main`, và tự thả ra đúng lúc nó vào.
  Một trạng thái viết tay chỉ nhân đôi cùng một sự thật, và bản viết tay là bản không ai nhớ cập nhật.
- **vì sao lý do chuyển xuống dòng `ghi chú`** (vòng soát ngữ cảnh sạch của `I-019`): dòng `deps` cũ viết
  `` `P-034` (PR `#198`) vào `main` trước, để hai bản CHARTER không đá nhau ``. `parseDeps` cắt theo **dấu
  phẩy** (luật của `I-015`), nên vế hai thành một phần phụ thuộc **không tra được** và mục kẹt ở `blocked`
  **vĩnh viễn** — kể cả sau khi `P-034` merge. Đo bằng chạy thật với `P-034` đặt `done`: `readyNow` rỗng,
  `waitingOn: ["để hai bản CHARTER không đá nhau (không tra được)"]`. Đúng nhóm **Z** mà `I-019` sinh ra
  để diệt, chỉ đổi chỗ từ "biến mất khỏi mọi nhóm" sang "nằm mãi ở `blocked`". Lời giải thích thuộc về một
  dòng khác; dòng `deps` chỉ chứa mã mục.
- nguồn: vòng soát ngữ cảnh sạch của PR `#198`; CHARTER 2.4 nhật ký **C9**
- tiêu chí xong:
  - ⬜ CHARTER mục 3 sửa câu đó thành "@nhắc ngay từ lần đỏ đầu, nhắc lại mỗi 4 giờ (2.4)".
  - ⬜ Nhãn cửa merge lấy bằng tool (sẽ ra `owner-merge`), kèm issue `🤖 [QĐ]` tóm tắt cần duyệt gì.
  - ⬜ Quét lại cả repo xem còn chỗ nào dẫn về ngưỡng 2 giờ: `grep -rn "2 giờ" CHARTER.md docs/ CLAUDE.md ops/`.
- **mã mục nhận lúc 2026-09-23 ~15:5x giờ UTC** (`ops/logs/README.md`, `KF-005`): dò `### P-` trên `main` **và trên mọi nhánh PR đang mở** (`refs/pull/N/head` của cả 13 PR): cao nhất là `P-036` (nhánh `claude/dreamy-ride-t9gnbd`, PR `#194`), nên `P-037` không đụng ai.

---

### P-035 · Bản tin có một mục riêng cho mỗi PR merge qua lối đi nhanh `hotfix`
Điều kiện 6 của `D-C07` có hai vế, và chỉ vế thứ nhất đã xong: `automerge.yml` @nhắc chủ dự án ngay lúc merge một PR `hotfix`. Vế còn lại — *"một mục riêng trong bản tin kế tiếp để tôi soát lại"* — chưa có chỗ nào thực hiện.

Vì sao tách khỏi `P-032`: nó chạm `ops/scripts/digest-metrics.ts`, mà PR `#120` (`platform/P-027`) đang mở trên **đúng** file đó và đang xung đột với `main` bốn lượt liên tiếp. Thêm một PR nữa vào cùng file là thêm một xung đột biết trước (CHARTER mục 4: hai làn cùng sửa một file).

- deps: `P-027` (PR `#120`) vào `main` trước
- risk: low — thiếu nó thì lần merge lối nhanh vẫn có @nhắc tức thời, chỉ mất chỗ soát lại vào sáng hôm sau.
- status: ready
- **vì sao `ready`, không phải `blocked`** (mục `I-019`): cùng lý do với `P-037` ngay trên — chỗ chặn là
  một `deps` đã ghi đúng ở dòng trên, để `readyQueue` giữ và thả, không để một chuỗi viết tay ngoài tập
  hợp lệ làm mục biến mất khỏi báo cáo.
- nguồn: comment của chủ dự án trên `🤖 [QĐ] #169`, điều kiện 6; `docs/decisions/D-C07.md`
- tiêu chí xong:
  - ⬜ Bản tin (phụ lục P2) có mục **"Đã merge qua lối nhanh `hotfix`"**, mỗi dòng: số PR · sự cố nào · file nào đã chạm · giờ merge. Rỗng thì in một dòng "không có", không bỏ mục (cấm im lặng, rà soát Z2).
  - ⬜ Nguồn của mục đó là dữ liệu máy đọc, không phải văn xuôi: nhãn `hotfix` trên PR đã merge trong 24 giờ qua, cộng khối `crux-hotfix-scope` của cảnh báo tương ứng.
  - ⬜ Test cho hàm dựng mục đó, gồm ca rỗng.
- **mã mục nhận lúc 2026-09-23 ~04:0x giờ UTC** (`ops/logs/README.md`, `KF-005`): cùng phép dò như `P-034` — cao nhất lúc nhận là `P-034` của chính lượt này.

### P-038 · Lượt bước 0 không gỡ được gì vẫn tốn một lần CI đầy đủ
Khi hàng đợi xung đột trống **và** mọi mục `ready` đã có PR mở, một lượt worker không có việc gì để làm ngoài ghi dòng log bước 0 của chính nó — nhưng nó vẫn mở một PR, và PR đó vẫn chạy **6 job `ci.yml`** cộng một lượt `main-ci` sau khi merge.

Đo được ngày 2026-09-23: bốn lượt liên tiếp (`22:43Z` `#209`, `23:25Z` `#210`, `23:42Z` `#211`, cộng lượt `20:38Z`) đều là PR log thuần một dòng. Nhịp worker thật là 2–3 lượt mỗi giờ (`VF-G1`), nên ở trạng thái yên thì đây là chi phí thường trực, không phải ngoại lệ.

**Chỗ hai luật cắn nhau, và là lý do mục này cần chủ dự án duyệt chứ không tự làm:** bỏ hẳn PR log thì trong một khoảng yên **không gì vào `main` cả**, mà `watchdog.yml` đọc nhịp tim routine bằng cách quét `ops/logs` của bản trên **`main`** (CHARTER 2.4 dấu hiệu số 5, ngưỡng 3 giờ). Hệ quả: watchdog `@nhắc` chủ dự án vì một nhà máy đang chạy đúng — tiết kiệm tiền CI bằng cách tiêu thời gian của anh, ngược thước đo CHARTER 1.3.

- deps: —
- risk: medium — hai vế ngược nhau. Nghiêng về tiết kiệm CI quá tay thì watchdog gọi người sai; nghiêng về nhịp tim quá tay thì mục này không đổi gì.
- status: parked
- **vì sao `parked`, không phải `blocked`** (mục `I-019`): cùng lý do với `P-030` — `blocked` ngoài tập
  hợp lệ nên mục im lặng. Dòng `**chặn ở:**` ngay dưới đã nói đúng hình dạng `parked` của `CLAUDE.md` mục
  13: chờ quyết định của chủ dự án trên `🤖 [QĐ] #213`.
- nguồn: comment của chủ dự án trên issue bản tin [#193](https://github.com/HungQuach301/crux-studio/issues/193) (`2026-09-23T14:18:09Z`, khối `CHI PHÍ GITHUB ACTIONS`); `🤖 [QĐ]` [#213](https://github.com/HungQuach301/crux-studio/issues/213); CHARTER 2.4 dấu hiệu số 5; `ops/workflows/watchdog.yml` biến `LAST_BEAT`; `ops/workflows/ci.yml` (chỉ kích bằng `pull_request`, nên push vào nhánh không có PR **không** chạy CI)
- **chặn ở:** ⚠️ **Câu trả lời đã tới, và nó KHÔNG phải một chữ cái.** Chủ dự án trả lời `🤖 [QĐ]` [#213](https://github.com/HungQuach301/crux-studio/issues/213) lúc `2026-09-24T06:10:33Z`: đồng ý bỏ PR log, **với điều kiện** chuyển nguồn nhịp tim của `watchdog.yml` ra khỏi `main` **TRƯỚC**, chứng minh bằng **một lần chạy thật**, và không có khoảng nào watchdog mất tín hiệu — *"Nếu đã bỏ rồi thì hoàn tác cho tới khi đủ điều kiện trên"* (đã kiểm: **chưa bị bỏ**, phụ lục P1/P3 chưa gọi `step0PrGate`, nên không có gì phải hoàn tác). Nên mục này nay chặn ở **mục `P-043`**, không còn chặn ở chủ dự án: vế "chuyển nguồn" đã làm xong ở đó, còn lại đúng một ô ⬜ — một lần chạy `watchdog.yml` thật đọc nhịp tim từ nguồn mới, chỉ chạy được sau khi `P-043` merge và `sync-workflows` chép sang (`CLAUDE.md` mục 4).
  - Ghi chú cũ, giữ lại vì nó vẫn đúng cho **phần** sửa luật: phần cơ chế đã có sẵn và có test (xem dưới), nhưng nó chỉ có hiệu lực khi phụ lục P1/P3 của CHARTER gọi tới. `P-043` sửa luật theo hướng **cộng thêm** một bước (đẩy bản sao nhịp tim), không nới lớp chặn nào và không bỏ dấu hiệu nào — khác hẳn việc bỏ PR log, thứ vẫn phải chờ ô ⬜ ở trên.
- tiêu chí xong:
  - ✅ Cơ chế quyết định tách khỏi văn xuôi: `ops/scripts/step0-pr-gate.ts` hàm `step0PrGate` trả `openPr` cộng một lý do đọc được. PR bỏ lại vì `aborted-ineligible` **không** tính là việc thật (bỏ lại không tạo commit nào).
  - ✅ Test `ops/test/step0-pr-gate.test.ts` khoá **cả hai** chiều hỏng: lượt log-only vẫn mở PR (chiều tốn tiền), và lượt log-only không mở PR trong lúc nhịp tim sắp quá hạn (chiều gọi người — nhóm **Z**, không gì đỏ). 18 bài; đã **phá thật** sáu chỗ, cả sáu đỏ đúng bài, khôi phục thì xanh lại.
  - ⬜ Phụ lục P1 bước 0 và P3 bước 0d của CHARTER gọi tới `step0PrGate` và nói rõ lượt `openPr: false` làm gì. **Chờ quyết định.**
  - ⬜ Dòng log của lượt `openPr: false` không bị mất (bất biến **I8**): commit và `git push` lên nhánh chờ `claude/integration/step0-pending/<mã log>`, không mở PR. Lượt nào mở PR thì `cherry-pick` các nhánh chờ vào PR của nó rồi **xoá** nhánh đã gộp.
  - ⬜ Chỗ gọi phải lấy `lastHeartbeatOnMainAt` bằng **đúng bộ lọc** mà `watchdog.yml` dùng (`ref` khớp `(^|/)(step0|P3-run)-` hoặc `== "platform/P-016"`), và bộ lọc đó phải là **một** chỗ dùng chung — tốt nhất export từ `kernel/src/log.ts`, nơi đã giữ `STEP0_LOG_PREFIX`. Hai bộ lọc khác nhau thì cổng và watchdog nói hai chuyện mà không gì đỏ.
  - ⬜ Một phép đo sau khi áp: số PR log mỗi 24 giờ trước và sau, để biết mục này có thật sự cắt được chi phí hay chỉ dịch nó đi.
- **vòng soát ngữ cảnh sạch của PR #212 — 0 phát hiện chặn**, và hai phát hiện đã sửa ngay trong PR đó:
  - Kẹp `Math.max(0, …)` cho mốc `at` ở tương lai **không** chữa được chỗ hỏng nó tự nhận là đã chặn: `0 >= 150` cũng `false`, nên cổng vẫn nói "nhịp tim còn mới" và vẫn không mở PR, mà `watchdog.yml` cũng không nổ (`AGE_MIN` âm, `-gt 180` false). Không lớp nào bắt được — nhóm **Z** thuần. Nay tương lai quá `HEARTBEAT_FUTURE_TOLERANCE_MINUTES` (5 phút) trả `null` → nhánh `heartbeat-unreadable` → **mở PR**.
  - Bài khoá ngưỡng 180 là một phép so **hằng-với-hằng**, vẫn xanh nếu ai đổi `watchdog.yml` thành `-gt 240`. Nay bài đọc chính `ops/workflows/watchdog.yml` và bắt lấy ngưỡng thật; đã phá thật **cả hai chiều** (đổi hằng số TS, và đổi ngưỡng YAML), cả hai đỏ.
  - Còn để ngỏ có chủ đích: hai worker chồng nhau có thể cùng mở một PR log (mất một phần khoản tiết kiệm, không sai đúng-sai) — đã khai trong tài liệu hàm, không dựng khoá chống đua vì khoá đó cần trạng thái dùng chung, đúng thứ `D-C04` tránh.
- **mã mục nhận lúc 2026-09-23 ~23:5x giờ UTC** (`ops/logs/README.md`, `KF-005`): dò `### P-` trên `main` **và trên `refs/pull/N/head` của cả 12 PR đang mở** — cao nhất là `P-036` (`#194`) và `P-037` (`#198`), nên `P-038` không đụng ai.

### P-033 · Chuỗi kẹt của bước 0 đếm bằng mắt từ văn xuôi, nên ngưỡng cảnh báo im lặng
Phụ lục P3 bước 0b đòi ba số cho mỗi PR bị bỏ lại — giờ kẹt · làn sở hữu · **số lượt liên tiếp cùng chữ ký** — và nói thẳng lý do: *"thiếu chúng thì `pickPrToHandle` ở phụ lục P1 bước 2 không có nguồn để đếm"*. Nhưng nó không nói **ghi vào đâu**, nên mọi lượt ghi cả ba vào `note`, tức văn xuôi. Nguồn để đếm vì thế chưa bao giờ tồn tại ở dạng máy đọc được.

Đo trên PR `#120` (2026-09-23, chữ ký `ops/scripts/digest-metrics.ts` + `ops/test/digest-metrics.test.ts` không đổi suốt bảy lượt): chuỗi thật tăng đều `1 → 7`, nhưng các lượt **ghi ra** `1 · 1 · 2 · 1 · 3 · 2 · 7` — không đơn điệu tăng, và hai worker ghi hai số khác nhau cho cùng một PR ở hai lượt cách nhau 19 phút (`01:20Z` ghi 1, `01:39Z` ghi 3). `ABORTED_INELIGIBLE_ALERT_THRESHOLD` là 3 và `shouldAlertStreak` là phép so `>=`, nên theo chuỗi thật ngưỡng chạm từ lượt **`00:46Z`**; trong năm lượt từ đó trở đi chỉ **một** lượt (`01:39Z`) nói ra rằng bản tin phải mang dòng cảnh báo, và nó bật ở con số 3 trong khi chuỗi thật lúc ấy là 5. Sáu PR (`#39` `#84` `#89` `#112` `#120` `#160`) đều mang nhãn `automerge-delayed`, tức đúng ca mà phụ lục P3 bắt bản tin phải nói ra ngay trong dòng "Đang chờ merge" — cùng hình dạng nhóm **Z** đã xảy ra với `#81`. Dòng log `01:39Z` còn **tự khai chỗ lệch** (*"lượt 01:20Z … đếm 1 vì nó chỉ thấy phần streak sau 21:38Z"*) rồi đi tiếp: lỗi đã được quan sát tại chỗ mà không có chỗ nào để sửa ở mức cơ chế.

Hàng đợi merge đứng (`main` đỏ, `KF-020`) chỉ **làm lộ** lỗi này: các dòng bước 0 gần nhất nằm trong PR chưa merge nên không thấy được từ `main`. Kể cả khi hàng đợi chạy bình thường, hai worker song song vẫn đếm lệch nhau, vì cả hai đọc văn xuôi.

- deps: —
- risk: medium
- status: review
- hold: còn lại, tách phạm vi — lớp máy bắt dòng bước 0 thiếu trường step0; stuckStreak gọi thẳng step0Streaks; sửa lời P3 0b (cửa automerge-delayed)
- nguồn: `ops/known-failures.md` KF-021; CHARTER phụ lục P3 bước 0b; `ops/scripts/pr-triage.ts` (`pickPrToHandle`, `stuckStreak`, `shouldAlertStreak`); dòng log bước 0 của bảy lượt `23:33Z` → `02:51Z` ngày 2026-09-23
- tiêu chí xong:
  - ✅ `RunLogLine` có trường tuỳ chọn `step0` — mỗi PR bị bỏ lại là **một bản ghi có cấu trúc** (`pr`, `outcome`, `signature`, `hoursStuck`, `lane`), không còn chỉ là một câu trong `note`. `formatLogLine` ghi nó ra.
  - ✅ `step0Streaks(lines)` ở `kernel/src/log.ts` đếm chuỗi đang chạy từ những bản ghi đó, tự lọc dòng bước 0 và tự sắp theo `at` (thứ tự dòng trong file không mang nghĩa — `merge=union`).
  - ✅ Phép đếm **dừng** ở dòng đầu tiên không có `step0` thay vì đọc nó thành "không kẹt"; `readableRunsFromNewest` và `proseOnlyRuns` khai ra khi con số là **cận dưới**.
  - ✅ **Hai chữ ký, hai luật trở về 0**, theo đúng CHARTER phụ lục P3 bước 0b: `aborted-ineligible` về 0 khi PR vắng mặt (0a đo lại nó mỗi lượt); `red-after-merge` **không** về 0 khi vắng mặt (0a không bao giờ đo lại nó) — hàm trả `redAfterMergeLastSeenAt` để bên gọi áp luật "PR có commit mới sau dòng log đó". Trộn hai luật làm ca `P-025` biến mất sau đúng một lượt.
  - ✅ Một lượt đếm một lần cho mỗi chữ ký (`merge=union` không khử trùng lặp).
  - ✅ Bài kiểm tái hiện: `kernel/test/step0-streak.test.ts`, **16 bài**, dựng lại đúng bảy lượt thật của `#120` và đòi ra **7**; một bài đối chứng cho thấy phép đếm cũ ra **1**. Phá thử ba lần: `aborted-ineligible` chỉ đọc lượt mới nhất → 7 bài đỏ; áp luật vắng-mặt cho `red-after-merge` → 1 bài đỏ; bỏ khử trùng lặp → 4 bài đỏ.
  - ✅ Dòng log bước 0 của chính lượt này là dữ liệu thật đầu tiên ở dạng mới.
  - ⬜ **Còn lại, không làm ở PR này để khỏi trộn phạm vi:** (a) một lớp máy bắt dòng bước 0 báo có PR bỏ lại mà **quên** trường `step0`; (b) bản tin (phụ lục P2) và `stuckStreak` gọi thẳng `step0Streaks` thay vì nhận số truyền tay; (c) sửa lời phụ lục P3 bước 0b để nó nói rõ ghi ba số **vào trường `step0`** — đó là sửa CHARTER ngoài mục 1 và mục 3, tức cửa `automerge-delayed`, nên đi ở PR riêng.
- **mã mục nhận lúc 2026-09-23 ~02:5x Z** (`KF-005`): dò `### P-` trên `main` **và mọi** nhánh PR đang mở, cao nhất là `P-032` (`#168`), nên `P-033` không đụng ai.
 main
### P-031 · `main` đỏ: `spike-canvas.yml` vào `main` với 4 vi phạm Z9/Z10 mà `node --test` không soi

`origin/main` tại `cf5c7f9` **đỏ** ở `pnpm lint:workflows` — đo `2026-09-22 23:38Z` trên cây sạch, `EXIT=1`, bốn dòng: `spike-canvas.yml:47/69/84` thiếu `set -euo pipefail` (Z10) và `:63` nuốt lỗi không chú thích (Z9). File vào `main` lúc `23:05:06Z` cùng `7dfdfeb` (mục `visual/V-002`, PR #42).

Hệ quả đo được, không phải suy đoán: **17 PR đang mở, CI xanh cả 17**, vì lần chạy CI gần nhất của mọi PR đều **trước** `23:05:06Z`. PR nào gộp `main` từ giờ cũng kế thừa đúng bốn dòng đó và đỏ mà không ai đụng vào nó — đã gặp ngay trong lượt này ở #120 (bước 2 gỡ xung đột xong, `pnpm check` đỏ đúng bốn dòng ấy, nên **không push**, đúng luật "đỏ sau khi gộp là tín hiệu thật" của phụ lục P3 bước 0b).

**Nguyên nhân gốc không phải luật thiếu.** Z9 và Z10 có trong `ops/scripts/check-workflows.ts` từ mục `P-011`, và `pnpm lint:workflows` bắt đúng cả bốn chỗ. Chỗ thủng là **thời điểm**: `node --test` — thứ chạy trong mọi lần CI — không có bài nào soi cây thật bằng Z9/Z10; hai bài "cây hiện tại phải sạch" chỉ soi quyền và action Node 20. Đây là `KF-013` ở hình dạng mới: bất biến có sẵn, vi phạm mới, không lần chạy nào đặt hai thứ cạnh nhau **trước** lúc merge.

- deps: —
- risk: **high** — `main` đỏ chặn mọi làn; mọi PR đang mở đỏ ngay khi gộp `main`.
- status: review
- hold: câu hỏi còn mở ngoài phạm vi — vì sao CI #42 xanh khi lint:workflows bắt 4 chỗ (giả thuyết KF-002); đáng mục verify riêng
- nguồn: đo ở lượt `crux-worker-1` 2026-09-22 23:3x–23:5xZ; `ops/known-failures.md` **KF-019** (và KF-013, KF-002); CLAUDE.md mục 13 (`main` đỏ thì sửa ngay), CHARTER phụ lục P3 bước 1
- tiêu chí xong:
  - ✅ `ops/workflows/spike-canvas.yml` hết bốn vi phạm: `set -euo pipefail` vào ba khối `run: |`, một chú thích tại chỗ cho `"$found" --version || true`. **Không** nới luật, **không** thêm ngoại lệ — luật đúng, file sai.
  - ✅ Bài tái hiện lỗi (bất biến I2) ở `ops/test/check-workflows.test.ts`: `blocksMissingPipefail(runBlocks(...))` và `undocumentedSwallows(...)` chạy trên **mọi** `ops/workflows/*.yml` của cây thật, trong `node --test`. Phá thử: bỏ bản sửa ra khỏi cây thì đỏ với đúng bốn chuỗi, khôi phục thì 57/57 xanh.
  - ✅ Ghi `ops/known-failures.md` **KF-019**.
  - ⬜ **Câu hỏi còn mở, không thuộc phạm vi PR này:** vì sao CI của #42 xanh trong khi `lint:workflows` bắt được bốn chỗ này? Giả thuyết là `KF-002` (GitHub không dựng lần chạy cho commit cuối của PR, nên nhãn xanh là của một commit cũ hơn). Chưa đo, nên chưa viết vào KF-019 như một khẳng định. Nếu đúng thì lỗ hổng lớn hơn một file: **mọi** PR đều có thể merge với một commit chưa bao giờ chạy CI. Đáng một mục riêng của làn `verify`.
- **mã mục nhận lúc 2026-09-22 23:4x giờ UTC**: `P-030` là mã cao nhất trên `main` **và** trên cả 17 nhánh PR đang mở tại lúc nhận (đo từng nhánh), nên `P-031` không đụng ai.

### P-036 · `digest-metrics.ts` đếm 0 lượt routine sau P-023 vì `isStep0Line` chỉ khớp file phẳng cũ

Bản tin `#193` (2026-09-23) in **`Lượt chạy routine 24h: 0`** rồi tự khai ⚠️ ngay bên cạnh: `digest-metrics.ts` in ra 0 vì `isStep0Line` chưa mở cho `ref` mới. Đo được, không suy: `routineRuns24h` lọc dòng bước 0 bằng `isStep0Line`, mà hàm đó chỉ khớp `ref === 'platform/P-016'` — hình dạng **file phẳng cũ**. Từ khi `platform/P-023` vào `main`, mọi dòng bước 0 mang `ref` do `step0LogRef` sinh (`integration/step0-<mốc>-<routine>`), nên **không dòng nào** khớp và số lượt tụt về 0. Đúng nhóm **Z**: chính comment doc của `isStep0Line` đã khai trước "khi P-023 vào `main`, mở rộng cho khớp — nếu không số lượt tụt về 0 một cách im lặng", nhưng việc mở rộng chưa ai làm, và không gì đỏ.

Con số này là số để kiểm giả định `G3` (trần lượt chạy routine mỗi ngày). Sai thành 0 làm mục "Tiến độ" của bản tin (và số liệu `#131`) mất một nguồn mà không cảnh báo.

- deps: —
- risk: low — số hiển thị sai, không chặn merge; nhưng giấu một tín hiệu `G3`.
- status: review
- nguồn: bản tin `#193` (câu trả lời chủ dự án 2026-09-23T14:18Z); comment doc `isStep0Line` (`platform/P-023`); `ops/known-failures.md` KF-022; `kernel/src/log.ts` (`step0LogRef`, `isStep0LogId`, `logIdFromRef`)
- tiêu chí xong:
  - ✅ `isStep0Line` nhận **cả hai** hình dạng `ref`: file phẳng cũ (`platform/P-016`) và hình dạng P-023 mà phần mã là một `step0LogId` (`isStep0LogId(logIdFromRef(ref))`). Lọc theo phần mã, không neo vào một `ref` cứng.
  - ✅ Bài tái hiện lỗi (bất biến I2) ở `ops/test/digest-metrics.test.ts`: dựng dòng bước 0 bằng chính `step0LogRef` và đòi `routineRuns24h` đếm cả chúng. Phá thử: khôi phục `isStep0Line` cũ → bài đỏ (đếm 1 thay vì 3); bản vá → 32/32 xanh.
  - ✅ Comment doc của `isStep0Line` cập nhật: hết "khi P-023 vào `main` thì mở rộng", nay nói thẳng đã nhận cả hai hình dạng.
  - ✅ Ghi `ops/known-failures.md` KF-022.
- **mã mục nhận lúc 2026-09-23 ~14:3x giờ UTC** (`KF-005`): dò `### P-` trên `main` và mọi nhánh PR đang mở, cao nhất là `P-035`, nên `P-036` không đụng ai.

### P-041 · Hai worker nhận cùng một mục trong cùng một phút, và không gì đỏ — đã gặp hai lần
Phụ lục P1 bước 3 đòi mục `ready`, `deps` đã xong, *"chưa có nhánh `claude/<lane>/<id>` và chưa có PR mở"*. Phép hỏi đó chạy **một lần**, lúc lượt chạy bắt đầu duyệt backlog — rồi lượt chạy làm việc cả giờ đồng hồ và push. Khoảng trống giữa hai mốc ấy không có cổng nào.

Đo được ngày 2026-09-24, mục `integration/I-020`:

| PR | Routine | Tạo lúc | Kết cục |
|---|---|---|---|
| [#221](https://github.com/HungQuach301/crux-studio/pull/221) | `crux-worker-2` | 03:40:00Z | merge 03:44:45Z |
| [#222](https://github.com/HungQuach301/crux-studio/pull/222) | `crux-worker-1` | 03:41:29Z | còn mở, xung đột với `main` ở `ops/known-failures.md` |

Cách nhau **89 giây**. Cả hai lượt làm đúng luật như nó được viết. Cái giá: trọn một lượt worker (giả định **G3** — trần số lần chạy routine mỗi ngày) cộng một PR mà bước 0 trả `aborted-ineligible` ở mọi lượt kể từ đó, vì mục của nó đã nằm trên `main` rồi. Mọi chỉ báo đều xanh — nhóm **Z**.

Hai tín hiệu nhận việc đang có đều không bắt được ca này. Tên nhánh thì đã chết: phiên cloud được nền tảng gán nhánh ngẫu nhiên (`claude/dreamy-ride-oh9k8r`), nên `laneFromBranch` trả `null` cho **5 trên 7** PR đang mở lúc viết mục này. Trạng thái `claimed` thì có trong bảng của `ops/lanes/README.md` và dòng *"Nhận xong đổi thành `claimed` ngay trong PR nháp"* — nhưng CHARTER phụ lục P1 bước 4 không nhắc tới nó, chưa lượt nào ghi nó, và không phép kiểm nào đọc nó. Một trạng thái không ai ghi và không ai đọc là một luật không tồn tại.

- deps: —
- risk: medium
- status: review
- hold: còn lại, tách phạm vi — hai mục `⬜` chưa làm ở PR này: đưa `duplicateClaims` vào bản tin ngày (chờ `#223` thôi chạm `digest-metrics.ts`), và chốt một đường cho trạng thái `claimed` giữa `ops/lanes/README.md` và phụ lục P1 bước 4; cả hai là việc của lượt sau, không chặn phần lõi đã xong
- nguồn: `ops/known-failures.md` KF-025; CHARTER phụ lục P1 bước 3 và bước 4; `ops/lanes/README.md`; PR [#221](https://github.com/HungQuach301/crux-studio/pull/221) và [#222](https://github.com/HungQuach301/crux-studio/pull/222)
- tiêu chí xong:
  - ✅ Chữ ký nhận việc đọc từ **tiêu đề PR** (`[<lane>] <id> — …`), không đọc từ tên nhánh — `claimKeyFromTitle` của `ops/scripts/claim-collision.ts`, cùng hình dạng mà `hasCompletionCommit` đã đọc.
  - ✅ `claimCheck(prs, lane, id, now)` trả `open-pr` · `recently-merged` · `free`. Phụ lục P1 bước 3 và bước 4 gọi nó, và gọi **lại** ngay trước khi push commit đầu tiên — khoảng trống giữa hai mốc đó chính là 89 giây đã sinh ra `#222`.
  - ✅ `duplicateClaims(prs)` bắt mọi cặp PR cùng mục có **thời gian sống chồng nhau**, tính cả PR đã merge: ca `#221`/`#222` là bằng chứng rằng một phép dò chỉ nhìn PR đang mở sẽ tắt tiếng đúng vào lúc chỗ hỏng thành vĩnh viễn.
  - ✅ Sóng nối tiếp **không** bị báo: `platform/P-014` cố ý làm theo sóng (`#62`, `#196`, `#223`), và một bộ dò kêu sai vài lần là một bộ dò bị tắt. Phép phân biệt là thời gian sống, không phải mã mục.
  - ✅ PR có tiêu đề không đọc được thành mã mục được **đếm và in ra**, không biến mất khỏi phép đo (bài học `Z15`).
  - ✅ `pnpm claims <file.json>` in bảng người đọc; `--json` cho máy. Thoát 0 kể cả khi có va chạm — đây là phép **đo**, cổng chặn duy nhất là người nhận việc đọc `verdict` rồi đi mục khác.
  - ✅ `ops/test/claim-collision.test.ts` — **29 bài**, mở đầu bằng bốn bài tái hiện lỗi dựng lại đúng mốc thật của `#221`/`#222` **và** `#224`/`#225` (bất biến I2).
  - ✅ Chạy thật trên ảnh chụp PR thật: **đúng 2 va chạm**, cả hai là va chạm thật — `integration/I-020` (`#221`/`#222`, 1,48 phút) và `platform/P-040` (`#224`/`#225`, 9,75 phút) — và **0 báo giả** trên hai sóng của `P-014` (`#196` đóng 03:41:39Z, `#223` tạo 04:38:39Z).
  - ✅ Tiền tố `🤖` của `CLAUDE.md` mục 5 được bỏ qua khi đọc tiêu đề: 29 commit trên `main` mang nó, trong đó `🤖 [platform] P-038 — …` (#212) là một PR nhận mục **thật**. Neo cứng vào `[` làm `claimCheck` trả `free` cho một mục đang có người giữ — fail-open ở đúng chỗ mục này chữa.
  - ✅ **Đầu vào thiếu hay hỏng thì NÉM, không trả `free`**: tên làn ngoài `LANES`, mốc `now` không đọc được, `PrSnapshot` thiếu `closedAt`/`isDraft`/`updatedAt` — cả ba trước đây cho `free` im lặng và exit 0. CLI in `⚠ KHÔNG TRẢ LỜI ĐƯỢC` và thoát 2. "Không trả lời được" khác "không ai giữ mục này", và phải khác cả ở mã thoát.
  - ✅ Ngoại lệ **PR nháp bỏ quá 24 giờ** (`CLAUDE.md` mục 2) không bị luật mới nuốt: verdict `abandoned-draft`, ngưỡng `ABANDONED_DRAFT_HOURS`. Thiếu nó thì `integration/I-020` bị `#222` khoá **vĩnh viễn**. Một PR sống cộng một PR nháp chết vẫn là "có người giữ".
  - ✅ "Đã merge" suy từ `mergedAt`, không nhận cờ boolean: endpoint **liệt kê** PR của GitHub trả `merged:false` cho cả PR đã merge, nên một cờ boolean làm nhánh `recently-merged` thành mã chết.
  - ✅ Thứ tự kết quả **ổn định**, có bài kiểm chạy hai chiều đầu vào với `createdAt` bằng nhau: hai lượt đọc cùng dữ liệu không được ghi hai câu khác nhau (`KF-021`).
  - ⬜ **Còn lại, tách phạm vi:** đưa `duplicateClaims` vào bản tin ngày (`ops/scripts/digest-metrics.ts`) để va chạm nổi lên hộp quyết định duy nhất. Không làm ở PR này vì `digest-metrics.ts` đang bị `#223` sửa — hai PR cùng chạm một file là đúng thứ luật mềm CHARTER mục 4 bảo tránh.
  - ⬜ **Còn lại:** trạng thái `claimed` của `ops/lanes/README.md` vẫn chưa ai ghi. Hoặc phụ lục P1 bước 4 ghi nó, hoặc bảng trong README bỏ nó đi — hai nguồn nói hai chuyện là chỗ sinh ra lỗi tiếp theo.
- **mã mục nhận lúc 2026-09-24 ~05:5x giờ UTC** (`KF-005`): dò `### P-` trên `main` **và trên nhánh của cả 7 PR đang mở**, cao nhất là `P-039`, nên `P-041` không đụng ai. Mã `KF-025` dò cùng cách, cao nhất là `KF-024`.
### P-042 · fix · tiền tố 🤖 bắt buộc của `CLAUDE.md` mục 5 làm mù mọi bộ đọc tiêu đề neo `^`

Hai luật của repo đều đúng, và chúng cắn nhau ở đúng ký tự đầu tiên. `CLAUDE.md` mục 5 bắt buộc **mọi** thứ agent viết mở đầu bằng 🤖 — dấu vết duy nhất phân biệt người với máy khi agent dùng danh tính chủ dự án (CHARTER 3.1, mặc định M6). Phụ lục P1 bước 4 đòi tiêu đề PR dạng `[<lane>] <id> — …`, và mọi bộ đọc tiêu đề neo `^\[`. Squash-merge giữ nguyên tiêu đề, nên tiền tố đi thẳng vào commit subject trên `main`: **30 / 213** commit subject trên `e4a5931` mang tiền tố đó.

Hệ quả, đo được chứ không suy:

- `hasCompletionCommit('platform','P-038',…)` trả **`false`** cho commit thật `🤖 [platform] P-038 — … (#212)` → mục không bao giờ được nhận là đã xong, nên mọi `deps` trỏ vào nó chặn oan. Đúng chỗ hỏng mà `integration/I-015` sinh ra để chữa, quay lại bằng một cửa khác.
- `laneFromTitle` trả **`null`** cho cùng hình dạng → PR không được tính vào "số mục done 24 giờ", nên mục **Tiến độ** của bản tin (`platform/P-019`) báo thông lượng thấp hơn thật và ngày dự kiến xong muộn hơn thật. Đây là một **con số sai gửi thẳng tới chủ dự án**, đúng thứ bất biến **I6** tồn tại để chặn.

Nhóm **Z**: `pnpm check` xanh, CI xanh, `git log` vẫn có commit, backlog vẫn hợp lệ — chỉ kết luận là sai.

**Lần thứ ba, nên sửa cơ chế chứ không vá sản phẩm** (`CLAUDE.md` mục 13). Lần một: `claimKeyFromTitle` của `P-041`, vòng soát `#225` bắt được và vá tại chỗ. Lần hai: `hasCompletionCommit`, cùng vòng soát đó khai "đáng một mục backlog riêng" rồi **không ai nhận**. Lần ba: `laneFromTitle`, lượt này. Vá tại chỗ lần thứ ba là mời lần thứ tư.

- deps: —
- risk: medium — không chặn merge, nhưng giấu hai thứ: một hàng đợi việc cạn giả, và một con số sai trong hộp quyết định duy nhất.
- status: review
- hold: còn lại, tách phạm vi — `claimKeyFromTitle` của `P-041` (`#225`, đang mở) còn mang bản vá tại chỗ riêng; gộp về `stripAgentPrefix` sau khi `#225` merge
- nguồn: vòng soát ngữ cảnh sạch của PR [#225](https://github.com/HungQuach301/crux-studio/pull/225) (điểm C2 và mục "Giới hạn đã khai" (c)); `CLAUDE.md` mục 5 và mục 13; CHARTER phụ lục P1 bước 4; `ops/known-failures.md` **KF-027**; đo trên `main` `e4a5931` (30/213 commit subject mang tiền tố)
- tiêu chí xong:
  - ✅ `ops/scripts/agent-prefix.ts` (mới): `AGENT_PREFIX` và `stripAgentPrefix` — **một** chỗ giữ luật bỏ tiền tố. Chặt theo đúng ba hướng, mỗi hướng là một cách fail-open đã cân nhắc: chỉ bỏ ở **đầu** chuỗi, chỉ bỏ **một** lần, không `trim()` hộ bên gọi.
  - ✅ **Bốn** bộ đọc tiêu đề gọi `stripAgentPrefix`: `hasCompletionCommit` và `hasRevertCommit` (`ops/scripts/backlog-status.ts`), `laneFromTitle` (`ops/scripts/digest-metrics.ts`), `isToolCommit` (`ops/scripts/recheck-assumptions.ts`). Hai luật chặt cũ **không** bị nới: sau khi bỏ tiền tố, phần còn lại vẫn phải khớp đúng dạng cũ từ ký tự đầu tiên — và nay **có bài khoá neo `^`** ở cả hai bộ đọc, thứ trước đó chỉ là lời khai.
  - ✅ Bài **tái hiện lỗi** (bất biến I2) dựng trên tiêu đề PR **thật** đã merge: `ops/test/backlog-status.test.ts` (`#212`) và `ops/test/digest-metrics.test.ts` (`#212`, `#227`, cộng một phép đếm đầu-cuối cho mục "Tiến độ").
  - ✅ `ops/test/agent-prefix.test.ts` khoá **chiều ngược lại** — bỏ tiền tố quá tay cũng phải đỏ — cộng `AGENT_PREFIX.length === 2` (ký tự ngoài BMP, phép `slice` dựa vào con số đó).
  - ✅ Bài "đầu–cuối" gọi **thật** `computeProgress`, không chép lại phép lọc bằng tay. Vòng soát chỉ ra bản đầu chép luật nên vẫn xanh khi `computeProgress` tự neo `^` lần nữa — nay phép phá đó đỏ.
  - ✅ **Phá thử, mỗi phép đỏ đúng chỗ rồi khôi phục** (số trên bốn file test liên quan, 119 bài): gỡ `stripAgentPrefix` khỏi hai bộ đọc → 4 đỏ · bỏ 🤖 ở mọi chỗ trong chuỗi → 3 đỏ · bỏ lặp lại → 1 đỏ · thêm `trim()` → 1 đỏ · gỡ bản sửa `hasRevertCommit` → 1 đỏ · gỡ bản sửa `isToolCommit` → 1 đỏ · bỏ neo `^` ở cả hai bộ đọc → 2 đỏ · `computeProgress` tự neo `^` lại → 1 đỏ. Bốn phép cuối là bốn lỗ mà vòng soát ngữ cảnh sạch đo được là **0 bài đỏ** ở bản đầu.
  - ✅ **`hasRevertCommit` CÓ đổi** — bản đầu của PR này khai ngược, và vòng soát ngữ cảnh sạch bắt được. Phép tìm **mã mục** dùng `includes` nên đúng là miễn nhiễm, nhưng phép nhận diện chữ **`Revert`** lại neo vị trí 0: `🤖 Revert "[platform] P-038 — …"` (agent tự viết tiêu đề PR revert, mà mục 5 bắt buộc mở đầu bằng 🤖) trả `false`. Đây là lỗ **nguy hiểm hơn lỗi gốc** và do chính PR này mở ra: `hasCompletionCommit` nay nhận tiêu đề có tiền tố, nên một mục đã bị revert khỏi `main` sẽ được lật sang `done` và mở khoá mọi `deps` trỏ vào code không còn tồn tại. Đã sửa, kèm bài tái hiện lỗi cho **cả hai** hình dạng revert.
  - ✅ `isToolCommit` (`ops/scripts/recheck-assumptions.ts`) — bộ đọc thứ tư, vòng soát tìm ra. Ca thật trong lịch sử repo: `🤖 Gộp origin/main vào nhánh #174 — …`. Chiều hỏng là fail-**closed** (commit công cụ bị đếm thành commit agent → bài kiểm `G14` báo "sai" oan), ồn chứ không im lặng — vẫn sửa, vì `KF-027` tồn tại để KHÔNG có lần thứ tư.
  - ✅ Ghi `ops/known-failures.md` **KF-027**.
  - ⬜ **Còn lại, tách phạm vi:** `claimKeyFromTitle` của `P-041` (`#225`, đang mở) vẫn mang bản vá tại chỗ của riêng nó. Không gộp ở đây vì file đó chưa trên `main` và sửa nó sẽ chồng lên một PR đang mở (`CLAUDE.md` mục 11: hai làn cùng sửa một file). Việc của lượt sau `#225` merge.
- **mã mục nhận lúc 2026-09-24 ~07:4x giờ UTC** (`KF-005`): dò `### P-` trên `main` **và** trên `refs/pull/N/head` của cả 9 PR đang mở, cao nhất là `P-041` (`#225`), nên `P-042` không đụng ai. Mã `KF-027` nhận cùng cách, cao nhất là `KF-026` (`#226`).

### P-043 · Nhịp tim của routine chỉ đập khi một PR vào `main`, nên người canh gọi chủ dự án cho một nhà máy đang chạy đúng

`watchdog.yml` dấu hiệu số 5 (CHARTER 2.4, ngưỡng 3 giờ) quét `ops/logs` của **bản đã checkout**, tức bản trên `main`. Nên nhịp tim chỉ đập khi một PR merge. Trong một khoảng yên — không PR nào xung đột, mọi mục `ready` đều đã có PR — **không gì vào `main`**, và người canh `@nhắc` chủ dự án cho một nhà máy đang chạy đúng.

Đó là chỗ hai luật cắn nhau mà `🤖 [QĐ]` [#213](https://github.com/HungQuach301/crux-studio/issues/213) mở ra: muốn bỏ PR log của bước 0 để cắt chi phí Actions (chỉ dẫn của chủ dự án trên bản tin `#193`) thì phải trả bằng đúng dấu hiệu này. Chủ dự án trả lời lúc `2026-09-24T06:10:33Z`, nguyên văn:

> Đồng ý bỏ PR log của bước 0, với điều kiện: chuyển nguồn nhịp tim của watchdog sang nơi khác (nhánh claude/telemetry của R2 hoặc tương đương) TRƯỚC khi bỏ, và chứng minh bằng một lần chạy thật watchdog đọc được nhịp tim từ nguồn mới. Không có khoảng thời gian nào watchdog mất tín hiệu. Nếu đã bỏ rồi thì hoàn tác cho tới khi đủ điều kiện trên.

**Đã kiểm "nếu đã bỏ rồi" trước khi làm gì khác: chưa bị bỏ, nên không có gì phải hoàn tác.** Cơ chế `ops/scripts/step0-pr-gate.ts` có trên `main` nhưng CHARTER phụ lục P1 bước 0 và P3 bước 0d **chưa gọi tới**, và PR `#227` (lượt `crux-worker-2` `07:23Z` cùng ngày) vẫn là một PR log. Mục này là vế *"chuyển nguồn ... TRƯỚC khi bỏ"*; vế bỏ PR log là `P-038` và nó **không** đi cùng PR này.

**Chiều hỏng đắt nhất không phải chiều đang xảy ra.** Hướng dễ sai là **thay** nguồn: trỏ dấu hiệu số 5 sang nhánh telemetry rồi bỏ `main` ra. Lúc đó có đúng một khoảng — từ khi workflow mới lên `main` tới lượt routine đầu tiên ghi vào nhánh mới — mà nguồn mới còn rỗng và nguồn cũ đã bỏ, tức người canh **câm**. Không gì đỏ trong khoảng đó: `watchdog.yml` xanh, `pnpm check` xanh, chỉ là một dấu hiệu đã tắt. Nhóm **Z** thuần, và đúng thứ câu *"Không có khoảng thời gian nào watchdog mất tín hiệu"* cấm. Nên nguồn được **cộng**, không **thay**: nhịp tim là `max` trên cả hai.

- deps: —
- risk: medium — chạm đúng workflow cảnh báo. Sai ở đây là mất luôn cái báo động, nên mọi chiều hỏng đều nghiêng về "báo thừa" chứ không "báo thiếu".
- status: review
- hold: còn lại — một lần chạy thật `watchdog.yml` (dispatch `dry_run`) đọc nhịp tim từ nguồn mới; workflow chỉ có hiệu lực sau khi PR này merge và `sync-workflows` chạy (`CLAUDE.md` mục 4)
- nguồn: `🤖 [QĐ]` [#213](https://github.com/HungQuach301/crux-studio/issues/213) và câu trả lời của chủ dự án trên đó (`2026-09-24T06:10:33Z`, comment KHÔNG mở đầu 🤖 trên issue nhãn `decision` — `CLAUDE.md` mục 5); comment của chủ dự án trên bản tin [#193](https://github.com/HungQuach301/crux-studio/issues/193) khối `CHI PHÍ GITHUB ACTIONS`; CHARTER 2.4 dấu hiệu số 5; `ops/workflows/watchdog.yml` biến `LAST_BEAT`; mục `platform/P-038`
- tiêu chí xong:
  - ✅ `ops/scripts/heartbeat-source.ts` — nhịp tim là `max` trên **nhiều** nguồn, mỗi nguồn khai riêng trong `readings` để bên gọi nói được nguồn nào đã trả lời. Thứ tự nguồn không đổi `at` (phép `max` giao hoán), có bài kiểm hai chiều.
  - ✅ **Ba trạng thái của một nguồn, không phải hai:** `missing` (thư mục không tồn tại — fetch hỏng, hoặc nhánh chưa được tạo) **khác** nguồn rỗng (đã đo, không có dòng bước 0) **khác** nguồn lỗi. Gộp chúng vào `null` là để một nguồn chết mà không ai biết. Bài kiểm đòi hai câu báo cáo **khác nhau**.
  - ✅ `ops/scripts/telemetry-beat.ts` — vế ghi: nhánh `claude/telemetry`, thư mục `heartbeat/`, một file cho mỗi lượt (tên lấy nguyên từ `step0LogPath` của kernel, nên hai worker chồng nhau không chạm cùng file). Chỉ dòng bước 0 được vào — **lớp phòng thủ thứ hai**, cùng luật `isStep0Ref` với bên đọc. ⚠️ **Đính chính sau vòng soát:** bản đầu khai một dòng lạ sẽ "giả mạo nhịp tim mới hơn sự thật", và reviewer đo được là **sai** — `readHeartbeatSource` đã lọc ở phía đọc, nên một dòng `at: "2027-01-01"` nhét vào nhánh này không nhấc nổi nhịp tim. Lời khai cũ mời lượt sau nới bộ lọc của **bên đọc** vì tin bên ghi đã canh, tức tháo đúng lớp đang thật sự giữ.
  - ✅ `ops/workflows/watchdog.yml` dấu hiệu số 5 đọc **hai** nguồn và in báo cáo theo từng nguồn vào log lượt chạy cộng thân cảnh báo (cùng cách dấu hiệu số 6 làm với `LANE_REPORT`). Nó **không** tự `add` khi một nguồn chết: chừng nào `main` còn là nguồn thì một nguồn chết không làm người canh mù, và gọi chủ dự án cho chuyện máy tự lo là ngược thước đo CHARTER 1.3.
  - ✅ **Bộ lọc `ref` của dòng bước 0 chỉ còn MỘT bản.** Trước mục này nó nằm ở hai chỗ, hai ngôn ngữ: hằng `STEP0_REF_PATTERN` (TypeScript) và một biểu thức `jq` chép tay trong YAML — bản chép đã lệch thật một lần (thiếu `P1-step0-` và `P3-daily-`). Bản `jq` bị **bỏ hẳn**; `ops/test/lane-heartbeat.test.ts` đổi việc từ *"hai bản phải giống nhau"* sang *"chỉ được có một bản"*. ⚠️ **Khai đúng mức, sau vòng soát:** bài mới chặt hơn ở chiều *cấm bản chép tồn tại*, nhưng **lỏng hơn** bài cũ ở chiều *một biểu thức `jq` viết lại tương đương* — bài cũ đòi dòng `jq` mang nguyên văn hằng nên nó đỏ khi dòng đó bị viết lại, bài mới chỉ cấm bản chép nguyên văn. Lỗ đó được bịt bằng **hai bài mới** ở ô dưới, không bằng lời khẳng định "chặt hơn".
  - ✅ **Hai chiều lệch TS ↔ YAML có máy canh:** tên nhánh trong `env:` phải khớp hằng `TELEMETRY_BRANCH`, và YAML phải khai **đủ hai** `--source`. Bài thứ hai là chỗ duy nhất giữ đúng chữ của chủ dự án — bỏ `--source "main=…"` ra là tạo lại đúng khoảng câm mà `#213` cấm, và không bài kiểm nào khác thấy được.
  - ✅ **Chạy thật, đúng khối bash của `watchdog.yml`** (`08:5xZ` 2026-09-24), trên nhánh `claude/telemetry` thật và `ops/logs` của `origin/main` thật:
    ```
    Nhịp tim routine: 2026-09-24T08:39:16.000Z — nguồn `telemetry`.
      - `main` (…/mainco/ops/logs): 2026-09-24T07:42:45.000Z  (170/292 dòng bước 0)
      - `telemetry` (…/crux-telemetry/heartbeat): 2026-09-24T08:39:16.000Z  (1/1 dòng bước 0)
    LAST_BEAT=2026-09-24T08:39:16.000Z  AGE_MIN=16  (ngưỡng 180)
    ```
    Nguồn mới **thắng** phép `max` (mới hơn `main` 56 phút), và nguồn cũ vẫn trả lời — đúng hình dạng "cộng nguồn, không thay nguồn".
  - ✅ CHARTER phụ lục P3 **bước 0e** (mới) và P1 bước 0 nói rõ việc đẩy bản sao; `CLAUDE.md` mục 1 in sẵn hai lệnh.
  - ✅ **Hai bài mới sau vòng soát ngữ cảnh sạch, bịt ba lỗ reviewer đo được là 35/35 vẫn xanh:** (a) `LAST_BEAT` phải lấy `.at` **từ output của script**, không được quét lại `ops/logs` bằng `jq` chép tay (chiều quay về một nguồn, đúng hành vi trước `P-043`) và không được chọn **một** nguồn trong `readings` (bỏ phép `max`); (b) `BEAT_REPORT` phải lấy `.render` của script — luật render ba trạng thái **cũng** chỉ còn một chỗ — và phải **có mặt** trong `BODY` của cảnh báo. Phá lại cả bốn cách: 3b → 1 đỏ · 3c → 1 đỏ · tự render bằng `jq` → 1 đỏ · bỏ `$BEAT_REPORT` khỏi `BODY` → 1 đỏ.
  - ✅ **CHẶN của vòng soát đã sửa:** `git archive … | tar -x` không có lưới làm **cả job `watchdog` đỏ** dưới `set -euo pipefail` (đo được EXIT=2 — nuốt trọn sáu dấu hiệu, trong đúng workflow mà `smoke-workflows.yml` đã khai là không ai canh khi nó đỏ, rủi ro **B7**). Nay `|| rm -rf "$TELEMETRY_CHECKOUT"`: một archive giải **dở** phải về `missing` ("chưa biết") chứ không về "đã đo và rỗng", nếu không thì chính luật ba trạng thái của mục này bị xoá.
  - ✅ **`|| echo` sau `jq` là mã chết, đã bỏ:** `echo "" | jq -r '.at // empty'` thoát **0**, nên khi `node` hỏng thì `BEAT_REPORT` thành chuỗi rỗng và câu cảnh báo không bao giờ in. Nay `[ -z "$BEAT" ]` được kiểm **tường minh** trước khi gọi `jq`.
  - ✅ **Các lệnh git nay được IN RA thật** (`telemetry-beat.ts --commands`, hàm `telemetryPushCommands`). Bản đầu *hứa* điều này trong docblock rồi chỉ in `{branch, target, bytes}` — tức CHARTER bước 0e dặn một việc không lệnh nào tồn tại để làm; cờ `--check` cũng là cờ chết (bị `filter` loại rồi không bao giờ đọc). Bài kiểm chạy `bash -n` trên các lệnh in ra, đòi chúng mang đủ hai trailer, cấm tên/mã model (`KF-014`) và cấm mọi `--force`.
  - ✅ Docblock của `STEP0_REF_PATTERN` (`ops/scripts/lane-heartbeat.ts`) viết lại: ba câu của nó trỏ sang một bản `jq` **không còn tồn tại** sau chính PR này. Lịch sử giữ lại vì nó là bằng chứng, nhưng khai rõ là lịch sử.
  - ⬜ **Còn lại, và nó là phần chủ dự án đòi:** một lần chạy **`watchdog.yml` thật** (dispatch `dry_run`) đọc nhịp tim từ nguồn mới. Không làm được trong lượt này vì workflow chỉ có hiệu lực sau khi PR merge và `.github/workflows/sync-workflows.yml` chép sang (`CLAUDE.md` mục 4). Khối bash đã chạy thật ở trên là bằng chứng về **logic**, không phải về **workflow** — khai đúng mức, không gộp hai thứ.
  - ⬜ **Còn lại, tách phạm vi:** `P-038` (bỏ PR log của bước 0) chỉ được mở sau khi ô ⬜ trên xong. Đó là toàn bộ điều kiện của `#213`, nên gộp vào đây là tự cho mình cái phép mà chủ dự án chưa cho.
  - ⬜ **Điều kiện THÊM cho `P-038`, vòng soát ngữ cảnh sạch tìm ra:** nhánh `claude/telemetry` là một đường ghi vào repo **không đi qua cổng nào** — `ci.yml` chỉ kích bằng `pull_request: branches:[main]` và `workflow_dispatch`, nên push vào nhánh này không qua gitleaks (**I1**), không qua `no-model-name`, không qua `protected-area`. Hôm nay rủi ro thấp vì **cùng nội dung** cũng đi qua PR log của lượt chạy và được quét ở đó. Nó thành chỗ chịu tải đúng lúc `P-038` bỏ PR log, khi nhánh telemetry là đích **duy nhất**. Trường `note` của dòng log là văn xuôi tự do do agent viết và đi lên nguyên văn, nên đây không phải lo xa. Ghi thành điều kiện của `P-038`, không phải việc của PR này.
- **mã mục nhận lúc 2026-09-24 ~08:4x giờ UTC** (`KF-005`): dò `### P-` trên `main` **và** trên `refs/pull/N/head` của cả 9 PR đang mở — cao nhất là `P-042` (`main`), `P-041` (`#225`) và `P-040` (`#224`), nên `P-043` không đụng ai.

---

### P-049 · fix · Báo động giả trong cửa sổ chờ `sync-workflows` sau PR sửa `ops/workflows/**`

Chỉ dẫn **D2** của chủ dự án trên [`#251`](https://github.com/HungQuach301/crux-studio/issues/251). Một PR sửa `ops/workflows/**` vào `main` mở một cửa sổ vài chục giây mà bản workflow đang chạy (`.github/`) lệch bản nguồn (`ops/workflows/`) cho tới khi `sync-workflows` chép sang. Trong cửa sổ đó tầng cảnh báo `@nhắc` chủ dự án dù `main` đang xanh — báo động giả (ngược nhóm Z). Đo được `2026-09-24T22:26Z` (`#229`/`a642919` → `843bbd4` sau 33 giây). Chi tiết: `ops/known-failures.md` `KF-033`.

- deps: —
- risk: medium — bản sửa chạm tầng cảnh báo (`ops/workflows/watchdog.yml` hoặc `main-ci.yml`), và ràng buộc của chủ dự án là **không nới** dấu hiệu bắt `sync-workflows` chạy hỏng thật (dấu hiệu 3). Vì thế phương án nằm ở `🤖 [QĐ]` `#254`, chưa tự làm.
- status: parked
- hold: chờ chủ dự án chốt phương án ở `🤖 [QĐ]` `#254` (A/B/C). Đây là `reversible`; nếu không có câu trả lời khác, lượt sau làm theo khuyến nghị **A** — bộ phân loại "đang chờ sync" hạ cấp @nhắc, giữ nguyên dấu hiệu 3.
- nguồn: chỉ dẫn D2 `#251`; sự cố `#229`/`a642919`→`843bbd4`; `ops/known-failures.md` `KF-033`; `KF-028` (lỗi "60 giờ" riêng, do `#231`/`P-044` chữa)
- tiêu chí xong:
  - ✅ **Ghi KF** — `ops/known-failures.md` `KF-033` (chữ ký, nguyên nhân gốc, và lưới đỡ tạm cho lượt sau).
  - ✅ **Mở `🤖 [QĐ]`** — `#254`, năm phần theo `CLAUDE.md` mục 14, ba phương án kèm hệ quả, khuyến nghị A.
  - ⬜ **Bản sửa** — chờ `#254`. Bộ phân loại "đang chờ sync" tách khỏi YAML, có bài khoá **hai chiều** (một red thật vẫn @nhắc; một cửa sổ sync không @nhắc); dấu hiệu 3 (`sync` chạy hỏng) giữ nguyên, có bài âm. Bài tái hiện lỗi bắt buộc (**I2**) khi lên bản sửa mang nhãn `fix`.

### P-051 · fix · Soát chéo GPT ra bản tóm tắt PR thay vì danh sách phát hiện có mức

Chỉ dẫn **D5** của chủ dự án trên [`#251`](https://github.com/HungQuach301/crux-studio/issues/251). `ops/scripts/gpt-review.ts` (`buildReviewPrompt`) dặn model *"nêu tối đa 5 phát hiện đáng chú ý"*, nên mọi comment `gpt-review` là **tóm tắt lại nội dung PR** — năm gạch đầu dòng mô tả PR làm gì — với **0 phát hiện có mức**. Vô dụng cho người soát và cho worker sở hữu PR: không phân biệt được "phải sửa trước khi merge" với "nên sửa". Đo được: 5 comment `gpt-review` trên `#249`, cùng dạng trên `#242`/`#223`/`#238`/`#231`, đều là tóm tắt.

- deps: —
- risk: low — chỉ đổi prompt hệ thống và bài kiểm; không đụng đường gọi API, không đụng secret (vẫn ở header `Authorization`), giữ nguyên khung I7 (đóng khung DIFF là DỮ LIỆU, bỏ qua chỉ dẫn nằm trong nội dung soát).
- status: review
- nguồn: chỉ dẫn D5 `#251`; `ops/scripts/gpt-review.ts` `buildReviewPrompt`; mục gốc `platform/P-003`
- tiêu chí xong:
  - ✅ Prompt đòi đầu ra là **DANH SÁCH PHÁT HIỆN** có nhãn mức `[CHẶN]` / `[NÊN SỬA]`; không có phát hiện thì đúng một dòng `"không phát hiện"`.
  - ✅ Prompt **CẤM** tóm tắt lại nội dung PR, mô tả PR làm gì, liệt kê thay đổi hay khen ngợi.
  - ✅ Bài **tái hiện lỗi** (**I2**) trong `ops/test/gpt-review.test.ts`: khẳng định prompt mang `[CHẶN]`/`[NÊN SỬA]`/`"không phát hiện"`/`CẤM tóm tắt` và KHÔNG còn `"đáng chú ý"`. Chứng minh bằng chạy thật: đỏ (`not ok`, fail 1) trên prompt cũ, xanh (14/14) trên prompt mới.
- giới hạn và việc kế tiếp, khai trước (mục KHÔNG bị treo — bản sửa đã xong, sẵn sàng merge):
  - Hiệu lực runtime (comment thành danh sách phát hiện) chỉ quan sát được ở **lần chạy `gpt-review` kế tiếp SAU khi PR merge** và `sync-workflows` chép `ops/workflows/` sang `.github/` (`CLAUDE.md` mục 4) — bản thân nhánh này không chạy được lần gọi GPT có tính phí.
  - **B14b** (worker sở hữu PR phải ĐỌC comment `gpt-review` và ghi xử lý từng điểm) là một mục **tách riêng**, ngoài phạm vi PR này — một mục = một PR.
