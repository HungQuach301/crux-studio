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
- nguồn: CHARTER bất biến I5; giả định G6; giả định **G21** (đường xác thực và hạn mức tải lên)
- **ĐÃ CÓ CÂU TRẢ LỜI cho `🤖 [QĐ]` #248** — comment của chủ dự án `2026-09-24T23:50:04Z`, không mở đầu
  bằng 🤖 trên issue nhãn `decision`, tức là **chỉ dẫn** theo `CLAUDE.md` mục 5. Nguyên văn: *"#248 A, với
  ba điều kiện: (1) tôi tạo kênh YouTube trước, và anh viết hướng dẫn tạo OAuth client (scope
  youtube.upload) cùng refresh token vào issue này; (2) app phải ở chế độ In production, vì Testing làm
  refresh token hết hạn sau 7 ngày; (3) đo quota thật, vì Console ngày 24/09 ghi riêng "Video Uploads per
  day 100", khác với ước tính 6 video/ngày."*

  Ba điều kiện đó chia làm **hai phần có chủ khác nhau**, và trộn chúng là cách mục này kẹt tiếp:

  | Điều kiện | Ai làm | Trạng thái |
  |---|---|---|
  | (1) hướng dẫn tạo OAuth client + refresh token, viết vào `#248` | **agent** | ✅ đã viết, comment trên `#248` |
  | (1) tạo kênh YouTube, chạy hướng dẫn, đặt secret | **chủ dự án** | ⬜ chưa |
  | (2) app ở chế độ **In production** | **chủ dự án** | ⬜ chưa — đã ghi thành một bước bắt buộc trong hướng dẫn, kèm lý do 7 ngày |
  | (3) đo quota thật | **agent**, nhưng **chỉ sau** khi có secret | ⬜ chưa đo được — không có đường gọi API |

  Vì vậy `#248` **giữ mở**: câu trả lời có rồi nhưng điều kiện chưa xong, và đóng nó bây giờ là giấu ba
  ô ⬜ ở trên khỏi bản tin (bản tin chỉ đọc issue đang mở — xem `KF` của `P-050`).
- **con số hạn mức: trần thật là 100 video/ngày; ước tính "~6 video/ngày" của `#248` là SAI** (giả định
  `G21`, có trích nguyên văn và ngày đọc). Tài liệu nhà cung cấp, đọc `2026-09-25`: cấp mặc định gồm
  **100 lần `search.list`**, **100 lần `videos.insert`**, và **10.000 đơn vị/ngày cho *các endpoint còn
  lại*** — `videos.insert` **không** tiêu vào bể 10.000 đó, nó tốn **1 đơn vị trong bucket
  `Video Uploads`**. Nên trần tải lên là **100/ngày**, trùng đúng con số Console mà chủ dự án đọc.
  Ước tính ~6/ngày suy từ `10.000 ÷ ~1.600`, tức áp mô hình quota của endpoint khác cho `videos.insert` —
  phép chia đó không có cơ sở.
- **⚠️ một lượt agent đã khai ngược lại chỗ này, ghi ra để không lặp.** Lượt `crux-worker-1` ~08:5xZ
  `2026-09-25` viết trên `#248` rằng hai con số "không mâu thuẫn nhau, là hai bucket khác nhau" và rằng
  chủ dự án chỉ cần đo để biết "con số nào có hiệu lực". **Sai, và chủ dự án đúng.** Chuỗi nhân quả:
  lượt đó khai (chưa đo) rằng phiên cloud không đọc được tài liệu Google → thay một lần đọc 30 giây bằng
  một suy luận → trình bày suy luận như sự thật → dùng nó để bác lời chủ dự án. Vòng soát ngữ cảnh sạch
  của bước 6 bắt được, và bản đính chính đã đăng trên `#248`. Bài học thuộc về luật 3 của
  `docs/assumptions.md`: đọc tài liệu trước, đừng suy.
- **điều kiện (3) vẫn còn nguyên giá trị sau khi con số đã đúng:** tài liệu và Console mới chỉ nói về
  **cấp mặc định**; phép đo thật xác nhận project này đúng là đang ở cấp đó. Không lượt nào được ghi các
  số này thành hằng số trong code — chúng là **dữ liệu** kèm `source`, theo đúng khuôn `G19`/`G20`.
- **khi ba điều kiện của `#248` xong thì còn một bước cuối** (`CLAUDE.md` mục 14): ghi quyết định lâu dài
  vào `docs/decisions/D-C09.md` (mã trống kế tiếp — `main` đang có `D-C04`, `D-C06`, `D-C07`, `D-C08`)
  rồi mới đóng `#248`. Ghi ở đây để lượt đó không phải tra lại.
- **mục này làm theo sóng, và `status` giữ `ready` cho tới sóng cuối** (cùng lối `platform/P-014`): tiêu
  chí 2 không phụ thuộc quyết định nào nên làm xong trước; tiêu chí 1 chờ đường xác thực, là nhóm
  `irreversible` số 3 của CHARTER 2.3.
- tiêu chí xong:
  - ⬜ Quota đơn vị mỗi lần tải được **đo** và ghi vào artifact, không ước lượng. `🤖 [QĐ]` #248 **đã
    được trả lời** (A, ba điều kiện), nhưng tiêu chí này vẫn ⬜: nó chờ **secret**, không chờ quyết định.
    Không đo được quota thật khi chưa có đường gọi API, và không ước lượng thay vì chính tiêu chí này cấm.
    Cách đo đã chốt ở `VF-G21`: hiệu số đơn vị trước/sau đúng **một** lần `videos.insert`, không suy từ
    con số cả ngày.
  - ✅ Không có đường nào trong code đặt `visibility` khác `private`. Contract đã khoá; test phải chứng
    minh code cũng không thử. → cổng `pnpm check:visibility` (`ops/scripts/check-visibility.ts`), nối vào
    `pnpm check`; 25 bài ở `ops/test/check-visibility.test.ts`. Cổng soát **hai** chiều mà contract một
    mình không soát được: khoá `privacyStatus` của YouTube API (contract không nhìn thấy khoá này), và
    chính chỗ khoá của contract bị nới. Đo được lỗ cũ: nới thành `enum: ["private","unlisted"]` thì
    **11/11 bài trước mục này vẫn xanh** trong khi I5 đã mất.
  - ✅ Nới I5 cần đủ ba điều kiện ở CHARTER mục 3 **và** một quyết định `irreversible`. Không nằm trong
    phạm vi mục này. → cổng trên in thẳng câu đó vào thông báo khi phát hiện chỗ khoá bị nới, nên lượt
    sau không phải tra lại luật mới biết mình đang chạm vào cái gì.

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
