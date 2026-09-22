# 🤖 Backlog làn `platform` — Đợt 1

Làn nền. Hạ tầng đã đủ dùng sau Đợt 0; phần còn lại là tăng tốc, không phải mở đường.

---

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
- status: ready
- nguồn: issue #17, chỉ dẫn 3; CHARTER phụ lục P2
- tiêu chí xong:
  - Bản tin có mục **Tiến độ**: số mục `done` trong 24 giờ · số mục còn lại theo từng đợt · thông lượng trung bình 3 ngày · ngày dự kiến xong từng đợt · **nút thắt hiện tại là máy hay người**.
  - Thêm **số lượt chạy routine đã dùng trong 24 giờ** — cũng là số liệu để kiểm giả định `G3`.
  - Sửa phụ lục P2 của CHARTER cho khớp (cửa `automerge-delayed`, không phải `owner-merge` — CHARTER mục khác mục 1 và 3).

### P-020 · Watchdog: rút ngưỡng "không có PR nào merge" xuống 6 giờ, và canh routine hỏng
Chỉ dẫn 4 của chủ dự án trên issue bản tin #17 (2026-09-21).

- deps: —
- risk: low
- status: ready
- nguồn: issue #17, chỉ dẫn 4
- tiêu chí xong:
  - Ngưỡng "không có PR nào merge" rút từ **48 giờ xuống 6 giờ**.
  - Cảnh báo khi một routine **có lượt chạy lỗi**, hoặc **không chạy quá 3 giờ**.
  - Cảnh báo đi theo chuỗi báo động đã có ở `P-011` (tới thẳng điện thoại), không phụ thuộc workflow thứ hai — KF-004.

### P-021 · Luật: routine và phiên không tự đặt vòng chờ
Chỉ dẫn 5 của chủ dự án trên issue bản tin #17 (2026-09-21).

- deps: —
- risk: low
- status: ready
- nguồn: issue #17, chỉ dẫn 5
- **cửa merge: `automerge-delayed`** — sửa `CLAUDE.md`. Chạy `node ops/invariants.protected-area.ts` để xác nhận.
- tiêu chí xong:
  - Thêm luật vào `CLAUDE.md`: routine và phiên **không tự đặt vòng chờ** (`/loop`, hẹn giờ đánh thức). Việc chưa xong thì **kết thúc lượt**, để lượt chạy theo lịch kế tiếp làm tiếp.
  - Nói rõ vì sao: một lượt chạy nằm chờ vẫn tiêu lượt chạy trong ngày (`G3`) mà không làm gì, và nó giấu việc chưa xong khỏi bản tin.


### P-017 · Chế độ vận hành 1–2 lần mỗi ngày — quyết định `D-C06`
Chủ dự án chỉ xuất hiện tối đa **hai lần mỗi ngày, tổng không quá 15 phút**, và mọi việc cần anh nằm trong **một** chỗ: bản tin sáng. Bản C3.1 không đạt được điều đó vì ba thứ cộng lại: vùng bảo vệ quá rộng, danh sách `irreversible` quá dài, và mỗi quyết định là một cuộc gọi riêng. Cả ba đều là **cách thực thi** bất biến, không phải bất biến.

- deps: —
- risk: medium
- status: review
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
  - **Còn treo, ngoài phạm vi cơ chế:** hiển thị "PR xung đột, giờ kẹt giảm dần" thành một mục riêng trong bản tin ngày là việc của `P-005`/`P-007` (chưa `done`) — tới lúc đó, số giờ kẹt chỉ nằm trong `note` của dòng log `ops/logs/platform/P-016.jsonl` (đường dẫn theo `D-C04`), đọc được nhưng chưa được trình bày.
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
  - Chi phí mỗi lần soát ghi vào `ops/logs/platform/P-003.jsonl`.

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
- status: review
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
- status: review
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
- status: ready
- nguồn: CHARTER mục 10 (việc của chủ dự án); giả định G12
- tiêu chí xong:
  - Danh sách status check bắt buộc được ghi vào `docs/decisions/` sau khi chủ dự án bật.
  - Không bật được (gói không cho) thì ghi rõ và dựa vào `automerge.yml` cộng hook.

### P-023 · Dòng log bước 0 tự khoá hàng đợi: tách khỏi file dùng chung `ops/logs/platform/P-016.jsonl`
Mỗi lượt integrator và mỗi lượt worker ghi một dòng bước 0 vào **cùng một** file `ops/logs/platform/P-016.jsonl`. Dòng đó vào `main` là mọi PR đang mở có dòng riêng trong file ấy **xung đột ngay** phía GitHub — vì GitHub không áp `merge=union` khi tự tính `mergeable` (**KF-009**), còn `automerge.yml` thì nghe phía GitHub.

Đã đo, không suy: lượt integrator 04:05 giờ VN 2026-09-22 thấy **7 PR** cùng đứng lại một lúc, cả 7 ở đúng file này, nguyên nhân là **một dòng duy nhất** mà `bfccc8c` (merge PR #80) mang tới. Giải xong 7 PR thì chính PR ghi log của lượt giải lại khoá **8 PR** cho lượt sau. Vòng này tự lặp mỗi lượt, và nó nuốt đúng thứ `P-016` sinh ra để xoá.

`D-C04` đã tách log tới mức **mục**, nhưng bước 0 không phải một mục — nó là **một lượt chạy** của mọi routine, nên mọi lượt dồn vào mã mục `P-016`. Lớp phòng thủ `merge=union` vẫn giữ đủ dữ liệu ở phía `git`, nhưng `KF-009` cho thấy nó **không bao giờ** một mình đủ để một PR merge được.

- deps: —
- risk: medium
- status: ready
- nguồn: `ops/known-failures.md` KF-009 và KF-005; `ops/logs/platform/P-016.jsonl` (dòng 20:12Z đề nghị việc này lần đầu, dòng 21:10Z đo được quy mô); quyết định `D-C04`; CHARTER mục 7
- tiêu chí xong:
  - Dòng bước 0 ghi vào file **theo lượt chạy**, không theo mã mục — hình dạng đã dùng thật ở `ops/logs/integration/P3-run-<ngày>T<giờ>.jsonl`, nên cơ chế gần như có sẵn. Chốt một tên file và **một** chỗ sinh ra nó (hàm của kernel hoặc `ops/scripts/`), đừng để mỗi routine tự ghép.
  - `ops/logs/README.md` và phụ lục **P3 bước 0d** của `CHARTER.md` nói cùng một đường dẫn. Lệch nhau thì lượt sau lại ghi vào file cũ.
  - Bên đọc không hỏng: `readRunLogs` gom theo thư mục nên tự thấy, nhưng `ops/scripts/digest-metrics.ts` và `ops/scripts/conflict-watch.ts` đang đọc **đích danh** `ops/logs/platform/P-016.jsonl` để lấy số giờ kẹt và chuỗi `aborted-ineligible` (phụ lục P2). Sửa cả hai trong cùng PR, **có test**.
  - Dòng cũ trong `P-016.jsonl` **không chuyển đi và không xoá** — log append-only (`ops/logs/README.md`). Bên đọc phải hiểu cả hai chỗ cho tới khi các dòng cũ rơi khỏi mọi cửa sổ thời gian đang dùng.
  - **Bằng chứng bằng chạy thật, không bằng lập luận:** dựng lại đúng hình dạng trên — hai nhánh cùng mang một dòng bước 0, một bên vào `main` trước — rồi đo `git merge-tree --write-tree` ở chế độ **tắt** `merge=union` (ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes`, cách mô phỏng GitHub mà KF-009 dùng). Trước khi sửa: `EXIT=1`. Sau khi sửa: `EXIT=0`.
  - Ghi kết quả vào `ops/known-failures.md` KF-009 — đó là chỗ đang giữ câu chuyện này.
- **mã mục nhận trước lúc 2026-09-22 04:1x giờ VN** (`ops/logs/README.md`, KF-005): `P-022` là mã cao nhất trên `main` **và** trên cả 11 nhánh PR đang mở tại lúc nhận, nên `P-023` không đụng ai.

### P-024 · Commit gộp của `integrator-resolve.ts` không mang trailer, và bước bù bằng tay đã hụt một lượt
Bước 0 tạo commit gộp bằng `git merge` bên trong `ops/scripts/integrator-resolve.ts`, nên commit ra đời với đúng một dòng thân: `Gộp origin/main (integrator, không xung đột)` — **không** `Claude-Session`, **không** `Co-Authored-By`. Các lượt trước bù bằng tay (`git commit --amend` trước khi push) và ba dòng log bước 0 đều ghi lại việc bù đó.

Đã đo, không suy: lượt worker `crux-worker-1` 2026-09-22 06:39 giờ VN bỏ bước bù, và **cả 9** commit gộp vừa push ra `Claude-Session=0 Co-Authored-By=0` — `51e3637`, `406f6f8`, `0f8f301`, `b186895`, `fef1a7f`, `7aa5cc7`, `9e4742f`, `4fe91f1`, `37cb1e0`. Không sửa lại được: tám trong chín nhánh là nhánh của PR người khác, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác.

Một bước đúng-đắn-bắt-buộc mà chỗ thực thi duy nhất là trí nhớ của routine thì nó sẽ hụt, và đây là lần hụt đầu tiên đo được. `trailer-warn` có `continue-on-error: true` (CHARTER mục 4, cố ý) nên không gì đỏ — đúng nhóm **Z**.

- deps: —
- risk: medium
- status: review
- nguồn: vòng soát ngữ cảnh sạch của PR `#93`; `ops/known-failures.md` KF-010; `CLAUDE.md` mục 6; giả định `G14`
- tiêu chí xong:
  - ✅ `integrator-resolve.ts` tự ghi trailer vào commit gộp nó tạo, ở **một** chỗ (`trailerMessageArg`, gọi ở cả đường `clean` lẫn `resolved`), không để routine bù tay. Mã phiên đọc từ môi trường `CLAUDE_SESSION_URL`; không có thì commit vẫn mang `Co-Authored-By`, và thiếu mã phiên trả `sessionTrailerMissing: true` trong `ResolveResult` — bên gọi (bước 0 phụ lục P1/P3) nói ra trong ghi chú, không nuốt im.
  - ✅ Tên hay mã model **không** lọt vào trailer: hằng `CO_AUTHOR_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>'` khoá cứng, không nội suy tên model từ đâu. Tool KHÔNG dùng `CLAUDE_CODE_SESSION_ID` (là UUID, không phải id của URL `.../session_…`) để tránh ghi một URL sai.
  - ✅ Có test: ba test mới ở `ops/test/integrator-resolve.test.ts` gọi tool trên cây dựng sẵn, đọc `git log -1 --format=%B` (và `%(trailers:key=Claude-Session)`) của commit gộp, khẳng định đủ hai trailer khi có URL, chỉ `Co-Authored-By` khi thiếu URL, và **không** có tên model. Đo được đỏ thật khi gỡ phần ghi trailer: 11 pass → 8 pass / 3 fail.
  - ✅ `ops/known-failures.md` KF-010 cập nhật dòng **Máy chặn từ nay** bằng tên ba test đó.
  - ⬜ **Còn treo, cần người/nền tảng đặt `CLAUDE_SESSION_URL`:** tool nay ghi `Claude-Session` khi biến môi trường có mặt, nhưng chưa lượt routine thật nào đặt biến đó, nên `Claude-Session` của commit gộp vẫn có thể vắng (khi đó `sessionTrailerMissing` báo ra). Đặt biến ở đầu lượt worker/integrator là việc nối dây tiếp theo; `Co-Authored-By` thì đã luôn có từ commit này.
- **ảnh hưởng tới `VF-G14`:** phép kiểm của `G14` là "đọc job `trailer-warn` trên các PR do routine mở, trong một tuần". Chín commit thiếu trailer này nằm trong cửa sổ đó và **không phải** tín hiệu nền tảng ghi hỏng trailer — chúng là bước bị bỏ. `VF-G14` phải loại chín mã băm trên ra khỏi mẫu, nếu không nó kết luận sai về `G14`.
- **mã mục nhận lúc 2026-09-22 06:5x giờ VN** (`ops/logs/README.md`, KF-005): `P-023` là mã cao nhất trên `main` **và** trên cả 16 nhánh PR đang mở tại lúc nhận, nên `P-024` không đụng ai.

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
