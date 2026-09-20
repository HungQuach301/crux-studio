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
