# 🤖 Backlog làn `editorial` — Đợt 1

Xưởng Biên tập (S04–S08). Đợt 1: **nâng cấp stub, chưa gọi API tốn kém** (CHARTER mục 10).

---

### E-001 · Chuyển prompt pack vào xưởng
`researcher`, `fact-checker`, `outliner`, `scriptwriter` đang nằm trong spec. Chuyển vào `workshops/editorial/` theo bảng chuyển đường dẫn.

- deps: —
- risk: low
- status: review
- nguồn: spec `engine/library/prompts/`
- tiêu chí xong:
  - Mỗi prompt có phiên bản, và phiên bản đó xuất hiện trong artifact (`generation.promptVersion`).
  - Prompt là file dữ liệu, không phải chuỗi ghép trong code.
- **Đã làm:**
  - `workshops/editorial/prompts/{researcher,fact-checker,outliner,scriptwriter}.md` — chép nguyên văn từ
    `docs/spec/CRUX-REFERENCE-SPEC.md` (khối `engine/library/prompts/`, không có dấu ⚠️ Crux nên còn hiệu
    lực), mỗi file thêm `$note` xuất xứ. `visual-director.md` của cùng thư mục spec **không** chép vào đây:
    theo bảng "Stage → xưởng" (CHARTER 5.1) nó thuộc S09a–S09b (xưởng `visual`), còn bốn nghề trên thuộc
    S04–S08 (xưởng `editorial`) — đúng phạm vi tiêu đề mục này liệt kê.
  - `workshops/editorial/prompts/README.md` — chép quy ước phiên bản/Tự kiểm từ `prompts/README.md` gốc,
    cộng một đoạn ghi rõ bộ nạp thật nằm ở đâu.
  - `workshops/editorial/src/prompts.ts`: `loadPromptVersions()` đọc bốn file trên, `parsePromptVersion()`
    tách số phiên bản từ dòng tiêu đề `# <Tên nghề> · v<N>` (không cần nằm ở dòng đầu file, vì có thể có
    ghi chú `$note` đứng trước — đã kiểm bằng test). Đây là dữ liệu/loader riêng của xưởng `editorial`,
    không đặt trong `kernel` (bất biến I3: kernel trung tính thể loại/kênh, không phải nơi chứa "nghề" của
    một xưởng cụ thể; không xưởng nào khác import file này).
  - `workshops/editorial/test/prompts.test.ts` — 6 test: đọc đúng bốn phiên bản từ prompt thật; tách được
    phiên bản dù có `$note` đứng trước; tách được số nhiều chữ số; **ném lỗi rõ ràng** (không trả rỗng hay
    `undefined` lặng lẽ) khi một prompt thiếu dòng tiêu đề phiên bản — cả ở tầng `parsePromptVersion` lẫn ở
    tầng `loadPromptVersions` (dựng thư mục fixture riêng bằng `mkdtempSync`, không đụng file thật); mỗi
    prompt thật có mục `## Tự kiểm` và không chứa hằng số nội dung (`data-explainer`, `us-personal-finance`)
    — đúng câu "Prompt không được chứa hằng số nội dung" trong chính `prompts/README.md`.
  - **Chưa nối vào `produce()` của `index.ts`, có chủ đích — đọc kỹ trước khi coi tiêu chí xong đã đủ:**
    nối `generation.promptVersion` vào payload thật sẽ đổi payload mà **mọi** tập đi qua xưởng này sinh ra,
    tức đổi `ops/golden/ep-0001-stub/snapshots/editorial.json`. Cập nhật snapshot tập vàng phải đi **PR
    riêng, không kèm thay đổi nào khác** (CHARTER 6.1, CLAUDE.md mục 1) — không được gộp vào PR đang thêm
    tính năng. Vế "phiên bản đó xuất hiện trong artifact" của tiêu chí xong vì vậy **chưa đạt bằng artifact
    thật**, chỉ đạt bằng chạy thẳng `loadPromptVersions()` (có test). Nối dây thật hợp lý nhất đi cùng
    `E-004` (mục kế tiếp chạm `produce()` của xưởng này, và **đã** phải cập nhật snapshot vì lý do khác —
    nâng khối lượng script/outline) hoặc `E-005` (`impl: v1`), để một PR chỉ cần một lần `pnpm replay --
    --update` thay vì hai. Ghi rõ ra đây thay vì âm thầm coi là xong — cùng tinh thần V-001 đã làm với
    Preflight check `layout-id-known` (mục `visual/V-001`, chưa nối vào pipeline thật vì lý do tương tự).

### E-002 · Fact & Risk Pass
Bất biến I6 được thực thi ở đây: mọi con số hiển thị đều có nguồn hoặc có mô hình.

- deps: E-001, T-003
- risk: high
- status: ready
- nguồn: CHARTER bất biến I6; spec KHỐI B
- tiêu chí xong:
  - Con số trong kịch bản không truy được về `claimId` thì chặn, không cảnh báo.
  - Phản biện tối thiểu theo genre pack (`counterClaimsMin`) được kiểm bằng máy.

### E-003 · Bộ eval cho prompt
PR đổi prompt không được auto-merge nếu eval không đạt ngưỡng khai trong cấu hình.

- deps: E-001
- risk: low
- status: ready
- nguồn: CHARTER 6.3
- tiêu chí xong:
  - Bộ mẫu chấm điểm chạy trong CI, ngưỡng nằm trong cấu hình.
  - Quy tắc ba tập của spec giữ nguyên: đổi prompt phải chứng minh trên ba tập, không phải một.

### E-004 · Nâng outline và kịch bản lên đúng khối lượng genre pack
Stub hiện sinh 69 từ so với ngưỡng 3200–3600, và Preflight đang ghi `warn`. Mục này làm cho `warn` đó biến mất một cách thật.

- deps: E-001, E-002
- risk: low
- status: ready
- nguồn: genre pack `limits.scriptWordCount`, `limits.devicesMin`
- tiêu chí xong:
  - `script-word-count` và `devices-used` chuyển từ `warn` sang `pass` ở `impl: v1`.
  - Số thiết bị và số mục từ điển đạt ngưỡng bằng nội dung thật, không bằng cách hạ ngưỡng.

### E-005 · Xưởng `editorial` lên `impl: v1`
- deps: E-003, E-004
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`.
