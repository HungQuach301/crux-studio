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
  - **Đã nối vào `produce()` của `index.ts` — nhưng vế "xuất hiện trong artifact" VẪN CHƯA ĐẠT bằng
    artifact thật. Đọc kỹ trước khi coi tiêu chí xong đã đủ.**

    Bản ghi trước cho rằng nối dây *bắt buộc* phải đổi `ops/golden/ep-0001-stub/snapshots/editorial.json`,
    nên phải hoãn sang `E-004`/`E-005`. Điều đó chỉ đúng nếu `generation` được ghi ở **mọi** lượt chạy.
    `kernel/contracts/editorial.payload.v0.schema.json` nay khai `generation` (không bắt buộc, bên trong
    bắt buộc `promptVersion`), và `generationOf` trong `index.ts` ghi nó **khi và chỉ khi** lượt chạy đó
    thật sự có một lời gọi mô hình đi qua băng — đo bằng `Cassette.calls` (`kernel/src/cassette.ts`), là
    tín hiệu ngữ nghĩa chứ không phải cờ `impl`.

    Gác bằng cờ `impl` thì **không** trung thực: hôm nay `impl: v1` cũng chưa gọi mô hình nào (`produce`
    dùng đúng một logic cho cả hai giá trị), nên artifact sẽ khai "bốn prompt này sinh ra payload này"
    trong khi không prompt nào chạy — vẫn là khai sai, chỉ dời sang giá trị cờ kia. `Cassette.calls` đúng
    ở mọi `impl`, và `costUsd` không thay thế được nó: một lời gọi đã ghi có thể tốn 0 đồng.

    **Trạng thái thật hôm nay:** Đợt 0 không lượt chạy nào gọi mô hình (CHARTER mục 10), nên **không
    artifact nào mang `generation`**, kể cả tập vàng — snapshot vì thế không đổi và mục này không chạy
    `pnpm replay -- --update`, không vướng CHARTER 6.1. Vế "xuất hiện trong artifact" được chứng minh
    bằng test ở tầng hàm (`generationOf` với một băng có lời gọi thật và một băng replay-hit 0 đồng),
    **chưa** bằng một artifact trong repo.

    **Việc còn lại của `E-005`** (`impl: v1`) chỉ là gọi prompt thật; `generation.promptVersion` tự xuất
    hiện, không ai phải nhớ quay lại nối dây. Đó là khác biệt so với bản ghi trước — nhưng mục này vẫn
    **không** tự chuyển `done`.

### E-002 · Fact & Risk Pass
Bất biến I6 được thực thi ở đây: mọi con số hiển thị đều có nguồn hoặc có mô hình.

- deps: E-001, T-003
- risk: high
- status: review
- nguồn: CHARTER bất biến I6; spec KHỐI B
- tiêu chí xong:
  - ✅ Con số trong kịch bản không truy được về `claimId` thì chặn, không cảnh báo — `factRiskProblems` (`ops/scripts/check-fact-risk.ts`) so mọi token số của `script.text` với các token số trong `statement` của claim mà kịch bản trích (`script.claimIds`); số lạc ra mã `untraceable-number`. `check-contracts.ts` (việc số 9, phần của `pnpm contracts`) **chặn** khi `producer.impl !== 'stub'`, **ghi nhận** ở stub — cùng khuôn stub-aware để tập vàng không đổi (CHARTER 6.1). Nghiệm thu S05 "gieo 3 con số sai bắt cả 3" có test.
  - ✅ Phản biện tối thiểu theo genre pack (`counterClaimsMin`) được kiểm bằng máy — đếm `topic.payload.counterClaims`, so với `limits.counterClaimsMin` của genre pack, mã `counterclaims-short`.
- ✅ **Xong (review), 2026-09-23** (lượt `crux-worker-2`): `ops/scripts/check-fact-risk.ts` (logic thuần `factRiskProblems`/`scanGoldenFactRisk`, trung tính thể loại) + `ops/test/check-fact-risk.test.ts` (14 bài, gồm bài tái hiện lỗi I2, nghiệm thu S05, và bài canh khâu định tuyến chặn/ghi-nhận) + việc số 9 của `check-contracts.ts`. Tập vàng stub hiện ghi nhận `counterclaims-short` (0 < 2) và **không** con số lạc nào — không đụng snapshot. Chặn thật tự bật khi xưởng biên tập lên `v1`.
- ⚠️ **Việc cho E-004/E-005 khi xưởng lên `v1`** (vòng soát chéo nêu, ghi ra để không rơi): phép truy số hiện là **so token số thuần**, nên ở chế độ chặn (`impl != stub`) mọi số tu từ / số thứ tự trong lời thoại (`option 1`, năm, số đếm) sẽ báo sai làm đứng pipeline — ngược thiên lệch của chính cổng. Trước khi bật chặn thật cần siết: chỉ soi số trong beat có `claimId`, và chuẩn hoá đơn vị (`4.3 nghìn` ↔ `4300`, `12%` ↔ `12`). Ngoài ra `topic.payload.counterClaims` hiện **chưa** có trong contract nào (payload v0 để lỏng cho qua) — siết cùng lúc contract topic được siết.

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
