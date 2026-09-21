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
- status: ready
- kiểm: đọc điều khoản từng nhà cung cấp, trích dẫn kèm ngày đọc.
- dự phòng nếu sai: đổi nhà cung cấp.
- ghi chú: cùng việc với AU-001 nhưng ở góc sổ giả định; kết quả ghi vào `ops/license-ledger.md`.

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
- status: ready
- kiểm: trong một lần chạy routine, cho agent thử một lệnh nằm trong danh sách chặn của `.claude/hooks/guard.mjs` và xem nó có bị chặn không.
- dự phòng nếu sai: bổ sung kiểm tra phía CI. Xem bảng hai lớp trong `.claude/README.md`.

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
- kiểm: cần hai PR song song cùng làn mà **cả hai đã mang sẵn** `.gitattributes`, cùng ghi vào `ops/logs/<lane>.jsonl`. Merge một PR, rồi đọc **hai** thứ: trạng thái `mergeable` của PR kia trên GitHub, và kết quả `git merge origin/main` ở phía worker. Hai câu trả lời có thể khác nhau — ghi cả hai.
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
