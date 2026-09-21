# 🤖 Backlog làn `verify` — Đợt 1

Làn nền. Kiểm các giả định chịu tải trong `docs/assumptions.md` (CHARTER mục 11).

**Luật của làn này:** kiểm bằng **chạy thật**, không bằng đọc tài liệu. Đọc tài liệu chỉ cho trạng thái "tài liệu nói vậy", và ba nhận định sai của bản C1 đều là loại đó.

Mã mục khớp mã giả định: `VF-<mã giả định>`.

---

### VF-G1 · Tài khoản có Claude Code Projects không
- deps: —
- risk: low
- status: ready
- kiểm: mở `claude.ai/code`, xem có tạo được Project không.
- dự phòng nếu sai: Plan B — chỉ dùng routines.
- tiêu chí xong: trạng thái G1 trong sổ chuyển sang `đã kiểm`, kèm ngày và kết quả. Nếu không có Projects thì phụ lục P1 chuyển sang cấu hình 2 worker chạy mỗi giờ.

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
- deps: —
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
- status: ready
- kiểm: tra điều kiện AdSense và nghĩa vụ thuế hiện hành.
- dự phòng nếu sai: mở `🤖 [QĐ]`.

### VF-G9 · Thuê người soát bản địa và giao việc qua link
- deps: —
- risk: high
- status: ready
- kiểm: tìm ít nhất hai kênh tuyển thực tế và một cách giao việc không cần tài khoản.
- dự phòng nếu sai: mở `🤖 [QĐ]`. Rủi ro A4: vai "người ngoài" nhận việc qua link, có thời hạn phản hồi.

### VF-G10 · Phiên cloud có ghi được `.github/workflows` không
- deps: —
- risk: low
- status: ready
- kiểm: trong một nhánh vứt đi, thử ghi một file vào `.github/workflows/` và push. **Không merge.**
- dự phòng nếu đúng như giả định: giữ nguyên cơ chế sync và PAT.
- nếu ghi được ổn định: có thể gỡ bỏ cơ chế sync và PAT, **thông qua một quyết định riêng** — không tự gỡ.

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
- status: ready
- kiểm: thử bật ruleset trên repo này và xem GitHub đòi gì.
- dự phòng nếu sai: không bật ruleset; dựa vào `automerge.yml` và hook.

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
- deps: —
- risk: medium
- status: ready
- kiểm: cần hai PR song song mà **cả hai đã mang sẵn** `.gitattributes`, cùng ghi vào **một** file append-only. Từ `D-C04` log tách tới mức mục, nên ca kiểm là hai lần chạy của cùng một mục (`ops/logs/<lane>/<id>.jsonl`) hoặc `docs/visual/calibration-log.jsonl`. Merge một PR, rồi đọc **hai** thứ: trạng thái `mergeable` của PR kia trên GitHub, và kết quả `git merge origin/main` ở phía worker. Hai câu trả lời có thể khác nhau — ghi cả hai.
- vì sao chưa trả lời được: lần quan sát ở PR #11 **không** kết luận được gì về GitHub, vì lúc đó git ở phía dưới cũng xung đột thật (nhánh chưa mang luật), nên GitHub báo xung đột là đúng. Xem G17.
- dự phòng nếu sai: đã có sẵn — mục `P-016`, integrator tự gộp `main` vào PR xung đột. Không phụ thuộc câu trả lời này.

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
