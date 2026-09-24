# 🤖 Backlog làn `release` — Đợt 1

Xưởng Phát hành và đo lường (S15b–S19). Đợt 1: **nâng cấp stub, chưa gọi API tốn kém**.

---

### R-001 · Chuyển phần phát hành của Channel Pack
`title-formulas`, `thumbnail-spec`, `distribution`, `monetization` từ spec vào `packs/channels/`.

- deps: T-002
- risk: low
- status: review
- nguồn: spec phần Channel Pack
- tiêu chí xong: ✅ validator đối chiếu được `titles[].formula` với danh sách khuôn tiêu đề thật, thay vì chấp nhận mọi chuỗi.
- **Đã làm:**
  - `packs/channels/us-personal-finance/{title-formulas,thumbnail-spec,monetization,distribution}.md` — chép
    nguyên văn từ `docs/spec/CRUX-REFERENCE-SPEC.md` (khối `channels/us-personal-finance/…`, không có dấu
    ⚠️ Crux nên còn hiệu lực), mỗi file thêm header 🤖 xuất xứ cùng khuôn với `persona.md`/`lexicon.md` đã có.
  - `packs/channels/us-personal-finance/title-formulas.json` (**mới, không có trong spec gốc**) — gán mỗi
    khuôn trong bảng của `title-formulas.md` một `id` tiếng Anh (`threshold`, `reversal`,
    `narrow-question`, `hidden-cost`, `numeric-comparison`), ghi rõ trong `$note` rằng đây là phần thêm,
    cùng cách V-001 đã làm với `$schemaRef` của `visual-tokens.json`.
  - `kernel/contracts/title-formulas.schema.json` — schema cho file trên (đóng, `additionalProperties:
    false`, trừ `$note`).
  - `kernel/src/packs.ts`: `loadChannelTitleFormulas`, `titleFormulaIdsFor`. `kernel/src/contracts.ts`:
    export `titleFormulasSchema`.
  - `ops/scripts/check-title-formulas.ts` (mới) — `allTitleFormulasPackProblems` (quét
    `packs/channels/*/title-formulas.json`, kênh nào cũng soát, không hardcode tên; hợp contract, id không
    trùng) và `releaseFormulaProblems` (đối chiếu `titles[].formula` của một artifact `release` với danh
    sách thật của đúng kênh nó khai). Nối vào `ops/scripts/check-contracts.ts`, phần của `pnpm contracts`.

  **Vì sao chưa nối chặt (hard-fail) cho artifact hiện có:** xưởng `release` đang `impl: stub`
  (`workshops/release/src/index.ts` sinh `formula: 'question' | 'flip-point' | 'method'`, không khớp năm
  `id` thật) — đúng hình dạng `layout-id-known` mà `visual/V-001` đã gặp với `layoutId`. Nối chặt ngay bây
  giờ sẽ đổi `ops/golden/ep-0001-stub/snapshots/release.json`, mà cập nhật snapshot tập vàng phải đi **PR
  riêng, không kèm thay đổi nào khác** (CHARTER 6.1). Nên `releaseFormulaProblems` chỉ **chặn**
  (`pnpm contracts` đỏ) khi `producer.impl !== 'stub'`; ở `impl: stub` nó chỉ **ghi nhận** ra stdout (xem
  dòng "Ghi nhận, không chặn" khi chạy `pnpm contracts`). Nối chặt là việc tự nhiên của `release/R-005`
  (`impl: v1`), đúng cùng lý do V-001 đã ghi cho `V-006`.

### R-002 · Tải lên YouTube ở chế độ riêng tư
**Bất biến I5.** Máy tải lên riêng tư; chủ dự án tự bấm công khai trong YouTube Studio.

- deps: R-001
- risk: high
- status: ready
- **vì sao `deps` KHÔNG còn `G6`** (mục `I-019`): `G6` trỏ tới `verify/VF-G6`, mà `VF-G6` ghi `deps: R-002`
  — hai mục chờ nhau vĩnh viễn, một vòng phụ thuộc thật nằm trên `main`. Chiều đúng là chiều `VF-G6` đang
  ghi: thân `VF-G6` nói rõ *"kiểm: lần tải lên đầu tiên ở mục `R-002`"*, tức giả định G6 được kiểm **bằng**
  mục này, không phải là nền móng của nó. Nên cắt ở đây. Quan hệ vẫn còn nguyên ở dòng `nguồn` ngay dưới,
  chỗ nó thuộc về.
- **mục này nay nằm trong `readyNow`, và lượt nhận nó phải biết trước** (vòng soát ngữ cảnh sạch của
  `I-019`): cắt vòng làm `R-002` thôi bị khoá oan — `R-001` đã vào `main` thật — nhưng nó vẫn cần một
  đường xác thực YouTube mà **repo chưa ghi ở đâu cả**: không `docs/assumptions.md`, không backlog, không
  workflow nào nhắc tới một secret hay app OAuth cho việc tải lên. Nên đây **không** phải ca `parked` như
  `topic/T-011` (mục đó nêu đích danh secret còn thiếu); chỗ thiếu ở đây là chính **mảnh tài liệu** đó.
  Việc đầu tiên của lượt nhận `R-002` là chốt đường xác thực rồi ghi nó vào sổ giả định — chọn nhà cung
  cấp và ký điều khoản là nhóm `irreversible` số 3 của CHARTER 2.3, nên nếu nó cần một tài khoản hay một
  điều khoản mới thì mở `🤖 [QĐ]` trước, đừng tự chọn.
- nguồn: CHARTER bất biến I5; giả định G6
- tiêu chí xong:
  - Quota đơn vị mỗi lần tải được **đo** và ghi vào artifact, không ước lượng.
  - Không có đường nào trong code đặt `visibility` khác `private`. Contract đã khoá; test phải chứng minh code cũng không thử.
  - Nới I5 cần đủ ba điều kiện ở CHARTER mục 3 **và** một quyết định `irreversible`. Không nằm trong phạm vi mục này.

### R-003 · Thu chỉ số 48h / 7d / 28d
- deps: R-002
- risk: low
- status: ready
- nguồn: contract release v0 `metricsPlan`; spec `metrics.schema.json`
- tiêu chí xong:
  - Lưu **đường cong giữ chân**, không chỉ chỉ số tổng hợp — chỉ số tổng hợp không đối chiếu được retention với vị trí beat.
  - Giờ xem tích luỹ của kênh được theo dõi (mặc định M1: YPP đòi 1.000 sub + 8.000 giờ trong 365 ngày từ 1/2/2027).

### R-004 · Công bố mô hình sang repo công khai `crux-models`
- deps: T-006, R-002
- risk: high
- status: ready
- nguồn: quyết định D-16, D-C01
- tiêu chí xong:
  - PAT `PUBLISH_REPO_TOKEN` chỉ tạo khi tới mục này, phạm vi một repo, quyền tối thiểu (D-C01).
  - Mọi thứ hiển thị ra công chúng là quyết định `irreversible`: mở `🤖 [QĐ]` trước lần công bố đầu tiên.
  - `modelSheetUrl` trong artifact trỏ tới bảng tính đã công bố thật, không phải URL dự kiến.

### R-005 · Xưởng `release` lên `impl: v1`
- deps: R-003
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`; `publication.visibility` vẫn là `private`.
