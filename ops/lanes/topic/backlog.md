# 🤖 Backlog làn `topic` — Đợt 1

Xưởng Đề tài (S01–S03). **Ưu tiên số một của Đợt 1** (CHARTER mục 10): cổng Mốc 3 nằm trọn trong làn này, và trượt cổng đó thì dự án dừng.

Plug-in đầu tiên: `quant` — dữ liệu, mô hình, Thesis Engine.

---

### T-001 · Bản đồ đề tài × nguồn dữ liệu
Trước khi xây kho dữ liệu, chứng minh **bằng bảng** rằng mỗi đề tài khởi đầu có đủ nguồn hợp lệ cho mọi tham số nó cần. Đề tài thiếu nguồn thì thay ngay, không phải phát hiện sau khi đã xây xong kho.

- deps: —
- risk: low
- status: review
- nguồn: spec WP-009
- tiêu chí xong:
  - ✅ `packs/channels/us-personal-finance/topic-source-map.md` liệt kê mọi tham số của mỗi đề tài khởi đầu, kèm nguồn cụ thể (nhà công bố, mã chuỗi/tài liệu, tần suất, độ trễ công bố) — mọi chuỗi/tài liệu đã xác nhận tồn tại thật bằng `WebSearch`/`WebFetch`, không viết từ trí nhớ.
  - ✅ Tham số nào không có nguồn công khai thì ghi rõ, và đề tài đó bị đánh dấu không khả thi: đề tài 1 (biểu phí PMI), 2 (đường cong mất giá xe theo dòng), 6 (ngưỡng xét duyệt điểm tín dụng), 8 (tỷ lệ chi phí quỹ) — đúng bốn đề tài `data-sources.md` nhóm 3 đã biết trước, không thêm đề tài nào mới.
  - ✅ Không đề tài nào còn ô trống — 12/12 đề tài có kết luận khả thi hoặc không khả thi kèm lý do.
- **Kết quả Mốc 3:** 4/12 đề tài không khả thi, **không vượt** ngưỡng dừng "quá 4 trong 12" (spec dòng ~1808) — dự án đi tiếp. Ba đề tài (5, 9, 10) dùng một tham số là **đại lượng thay thế**, ghi rõ trong bảng, không trình bày như phép đo thật.
- ⚠️ **Chặn từ phiên cloud, đo ngày 2026-09-21** (lượt trước): `curl` một lần mỗi đích: `fred.stlouisfed.org`, `api.stlouisfed.org`, `www.bls.gov`, `api.census.gov`, `www.census.gov`, `www.federalreserve.gov`, `www.huduser.gov` — tất cả `000`; `registry.npmjs.org` trả `200`. Cùng bức tường mạng của issue `#36`.
- ✅ **Đo lại bằng chạy thật, cùng ngày 2026-09-21 (lượt `crux-worker-3` kế tiếp, phiên khác):** mạng **KHÔNG** còn chặn ở phiên này. `curl` tới `fred.stlouisfed.org` (200), `api.stlouisfed.org` (301), `www.federalreserve.gov` (200), `www.census.gov` (200), `www.huduser.gov` (202), `api.census.gov` (302) — tất cả nối được. `WebFetch` đọc được nội dung thật của `fred.stlouisfed.org/series/UNRATE` (số liệu, định nghĩa, tần suất — không phải trang chặn). Chỉ `www.bls.gov` trả `403`, nhiều khả năng BLS tự chặn bot ở phía họ (không phải egress phía sandbox — các đích liên bang khác đều qua). Kết luận: bức tường mạng **không đồng nhất giữa các phiên cloud** — không suy ra "còn chặn" từ một lần đo cũ, đo lại mỗi lượt trước khi coi mục này là `parked`. Đã ghi vào issue #36. Mục này đi tiếp được **ngay bây giờ**, không cần chờ #36.

### T-002 · Chuyển Channel Pack từ spec vào `packs/channels/`
Channel pack đầy đủ đang nằm trong spec tham chiếu. Chuyển sang `packs/` theo bảng chuyển đường dẫn để code đọc được, giữ nguyên nội dung nghiệp vụ.

- deps: —
- risk: low
- status: done
- nguồn: spec phần Channel Pack; CHARTER 5.1
- tiêu chí xong:
  - `channel-bible`, `persona`, `lexicon`, `data-sources`, `topic-map`, `thesis-bank` nằm trong `packs/channels/us-personal-finance/`.
  - `channel.json` mở rộng từ bản tối thiểu của Đợt 0, và `pnpm check` vẫn xanh.
  - Không copy phần nào có dấu **⚠️ Crux**.
- ✅ **Xong, 2026-09-21** (PR `#38`): sáu file nội dung cộng `channel.json` mở rộng nằm trong `packs/channels/us-personal-finance/`. Không khối nào của spec phần I mang dấu ⚠️ Crux nên không phải bỏ phần nào. `channel.json` giữ khoá `locale` của Đợt 0 thay vì đổi sang `language` như spec, vì `kernel/src/packs.ts` đọc đúng tên đó; `pillars` đổi từ bộ tạm `[thresholds, tradeoffs, timing]` sang năm trụ nội dung của spec (không code nào đọc trường này — xưởng `topic` stub giữ hằng số `PILLARS` riêng của nó). Giá trị chưa điền để `null`: `displayName`, `googleAccount` cần chủ dự án; `ttsVoiceId` và `providers.*` bị chặn bởi G7 (`#36`) và bởi CHARTER 2.3 nhóm 3. `title-formulas`, `thumbnail-spec`, `distribution`, `monetization` để lại cho `R-001`; `visual-tokens.json` để lại cho `V-001`. `pnpm check` xanh 286/286, `pnpm replay` khớp snapshot 6/6.

### T-003 · Kho ảnh chụp dữ liệu có phiên bản
Dựng kho dữ liệu cho 3–4 chuỗi cụ thể sẽ dùng ở những tập đầu, cùng adapter cho ba nhà cung cấp. **Không xây adapter tổng quát** — đó là tối ưu hoá sớm.

- deps: T-001
- risk: high
- status: ready
- nguồn: spec WP-010, mục Lõi định lượng 1
- tiêu chí xong:
  - Adapter `fred`, `bls`, `census` chuẩn hoá về một contract snapshot chung.
  - Mỗi ảnh chụp có `asOfDate` và băm nội dung; chạy lại cùng `asOfDate` cho ra cùng dữ liệu.
  - Thiếu secret nguồn dữ liệu thì **DỪNG và báo tên secret thiếu**, không tự tạo secret.

### T-004 · Phát hiện dữ liệu thay đổi và đính chính
Khi một chuỗi đã dùng trong tập đã phát hành bị điều chỉnh sau công bố, tự mở issue chỉ đúng tập nào, claim nào, con số nào.

- deps: T-003
- risk: low
- status: ready
- nguồn: spec WP-011, sổ rủi ro R6 và R7
- tiêu chí xong:
  - So được hai `asOfDate` của cùng một chuỗi và liệt kê ô nào đổi.
  - Issue sinh ra dẫn ngược tới `claimId` và tập bị ảnh hưởng, không chỉ tới tên chuỗi.

### T-005 · Thư viện mô hình và kiểm bốn cấp
Runner xác định chạy mô hình từ contract, cộng cơ chế kiểm bốn cấp. WP này xây **công cụ**; nội dung tám mô hình do T-006 tạo.

- deps: T-003
- risk: high
- status: ready
- nguồn: spec WP-012, mục Lõi định lượng 2
- tiêu chí xong:
  - Cùng đầu vào cho ra cùng kết quả, không phụ thuộc thứ tự chạy.
  - Agent **không** đặt được `verification.status = "verified"` bằng code — trạng thái đó chỉ đến từ một issue `irreversible` đã được duyệt (D-C02, mặc định M7).

### T-006 · Tám mô hình định lượng đầu tiên
Cổng Mốc 3 đòi tám mô hình đã qua kiểm. Đây là chỗ chúng ra đời.

- deps: T-005
- risk: high
- status: ready
- nguồn: spec WP-008; CHARTER mặc định M7 (D-C02 điều chỉnh D-18)
- tiêu chí xong:
  - Mỗi mô hình có ca kiểm cấp 1 lấy từ **nguồn độc lập bên ngoài** (ví dụ công cụ tính công khai của một tổ chức uy tín), có ghi nguồn. **Không bao giờ để máy tự sinh ca kiểm.**
  - Công thức do agent soạn, có trích nguồn, và được một mô hình **khác họ, không phải Claude** tính lại độc lập. Lệch nhau thì mở `🤖 [QĐ]`.
  - Mô hình không tìm được ca kiểm độc lập thì mở `🤖 [QĐ]` với hai lựa chọn: thuê chuyên gia viết, hoặc bỏ mô hình đó.
  - Mỗi mô hình có một issue `irreversible` tóm tắt (giả định, công thức, nguồn, kết quả đối chiếu) đọc được trong vài phút.

### T-007 · Sensitivity Pass
Cho một mô hình và một tập tham số, quét **toàn bộ** khoảng giá trị hợp lệ và tìm mọi điểm đảo chiều. Đây là chữ ký khác biệt của kênh, và là cách bù cho việc chủ dự án không sống ở thị trường Mỹ: không đoán tham số vùng miền, quét hết khoảng của nó.

- deps: T-006
- risk: high
- status: ready
- nguồn: spec WP-013, mục Lõi định lượng 3
- tiêu chí xong:
  - Nhận `modelId`, trả về danh sách điểm đảo chiều kèm khoảng tham số.
  - Không có điểm đảo chiều cũng là một kết quả hợp lệ, và phải được ghi thành `stableConclusion` có bằng chứng.

### T-008 · Corpus đối thủ, kiểm mới lạ, đại lượng nhu cầu
Ba đại lượng thay thế cho trục nhu cầu của Topic Scoring, với **giới hạn của từng thứ khai rõ trong chính dữ liệu**, không nằm trong ghi chú.

- deps: T-002
- risk: high
- status: review
- nguồn: spec WP-014
- tiêu chí xong:
  - ⬜ **Corpus xây trong hạn mức quota, và hạn mức được đo, không được đoán.** Nửa "trong hạn mức" đã
    xong và chạy được: `quotaGate` dừng ở mốc 20% dự trữ của WP-014 mục 5, trả lý do thay vì ném lỗi để
    bản xây ghi được corpus một phần (mục 5b), và `corpusProblems` đỏ khi `quota.spent.searchCalls` lệch
    tổng `pagesFetched` — số tiêu không khai tay được. Nửa "hạn mức được đo" thì **chưa**, và nó cần
    người: đọc Google Cloud Console (giả định **G19**, mục `verify/VF-G19`). Tới lúc đó, con số trung
    thực nằm trong chính dữ liệu — `quota.limits.source` khoá ở `vendor-docs`, không phải một dòng ghi
    chú trong tài liệu. Phần **gọi API để xây** corpus tách sang `T-011`, đang chặn vì chưa có secret.
  - ✅ **Kiểm mới lạ chạy tự động cho một thesis và trả về lý do, không chỉ trả về điểm.** `checkNovelty`
    thuần, không gọi mạng, không đọc đồng hồ; `reasons` là trường bắt buộc có ít nhất một phần tử trong
    contract, và mỗi lối ra nạp lý do trước khi chốt `verdict`. Bốn kiểm âm của WP-014 mục 6 có test
    thật: `contradictingCount = 0` với `similarCount` cao ra `crowded-in-corpus` chứ không ra mới lạ;
    corpus dưới ngưỡng ra `insufficient-corpus`; bình luận thô và tên người dùng bị `forbiddenKeyPaths`
    chặn; hết bucket thì cửa quota đóng sạch.
- ✅ **Đã làm, 2026-09-21** (lượt `crux-worker-2`): ba contract v0 trong `workshops/topic/contracts/`
  (`corpus`, `novelty-check`, `demand-signal`), ba module trong `workshops/topic/src/`
  (`corpus.ts`, `novelty.ts`, `demand.ts`), một corpus mẫu 36 video trong `workshops/topic/data/corpus/`,
  bảng ngân sách quota ở `packs/channels/us-personal-finance/quota-budget.md`, và 30 test mới. Ba giới hạn
  của WP-014 mục 3c được mã hoá thành **trường bắt buộc**, không thành ghi chú: `coverage.contentLevel`
  khoá `metadata-only`; `verdict` không có giá trị `novel` và `limitation` bắt buộc dài ≥ 40 ký tự;
  ba đại lượng nhu cầu bắt buộc mang `asOf`, `region`, `language`, `knownBias`.
- ⬜ **Còn treo, cần người:** G19 (`VF-G19`) và secret nền tảng (`T-011`). Giữ `review`, không `done`.

### T-011 · Xây corpus bằng API nền tảng — đang chặn vì chưa có secret
Phần **gọi API** của WP-014, tách khỏi `T-008` vì nó chặn ở chỗ khác hẳn: không phải thiếu cơ chế, mà
thiếu quyền. `T-008` đã để sẵn mọi thứ nó cần — contract `corpus.v0`, `quotaGate`, `corpusProblems` — nên
mục này là phần nối dây, không phải phần thiết kế lại.

Hai thứ còn thiếu, và không thứ nào agent tự lấy được:

1. **Khoá API nền tảng** cho `search.list`. Chọn nhà cung cấp và ký điều khoản là `irreversible`
   (CHARTER 2.3 nhóm 3); bật billing là nhóm 1.
2. **`EMBEDDINGS_API_KEY`** cho phép so ngữ nghĩa. Thiếu nó, `checkNovelty` chạy bằng so **từ vựng** —
   bỏ sót cách diễn đạt khác chữ, nên nó chệch về phía kết luận `novel-in-corpus`. Chệch đúng hướng nguy
   hiểm, và câu đó đã nằm trong `limitation` của mọi kết quả.

Giả định **G19** (hạn mức `search.list`) đứng dưới mục này ở mức `tài liệu nói vậy`; dự phòng đã viết sẵn
nên nó không chặn, chỉ làm số tiêu cần đối chiếu lại sau lần chạy thật đầu tiên.

- deps: T-008, G19
- risk: high
- status: blocked
- nguồn: spec WP-014 mục 2b, 3, 5b; `docs/assumptions.md` G19; CHARTER 2.3 nhóm 1 và 3
- tiêu chí xong:
  - Thiếu secret thì **DỪNG và báo tên secret thiếu**, không tự tạo secret (cùng luật với `T-003`).
  - Corpus xây ra đi qua `corpusProblems` sạch, và `quota.spent.searchCalls` là số đếm thật của lần chạy.
  - Hết bucket giữa chừng thì ghi corpus một phần với `coverage.partial = true` và `partialReason` có
    chữ — không hạ chất lượng truy vấn để lấp cho đủ số video (WP-014 mục 5b).

### T-009 · Thesis Engine
Sinh thesis đạt chuẩn từ dữ liệu, đủ duy trì bank ≥15 mục khả dụng ở nhịp mục tiêu. Điều kiện tiên quyết của D-08 và là cổng chặn Mốc 3.

- deps: T-004, T-007, T-008
- risk: high
- status: ready
- nguồn: spec WP-015, mục Lõi định lượng 4
- tiêu chí xong:
  - Năm nguồn sinh thesis là năm module riêng biệt, thay được từng cái.
  - Bank giữ được ≥15 mục khả dụng qua một vòng chạy thật.

### T-010 · Xưởng `topic` lên `impl: v1`
Thay stub bằng bản thật, qua tập vàng.

- deps: T-009
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong:
  - Tập vàng chạy lại xanh với `impl: v1`, băng ghi có phản hồi thật đã ghi lại.
  - Cổng chất lượng đầu ra riêng của xưởng có ngưỡng khai trong cấu hình, không nằm trong code.
