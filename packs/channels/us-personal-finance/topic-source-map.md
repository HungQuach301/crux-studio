# 🤖 Bản đồ đề tài × nguồn dữ liệu — `us-personal-finance`

> Mục `topic/T-001`. Ghép từng tham số của 12 đề tài khởi đầu (`topic-map.md`) với một nguồn
> **cụ thể** trong danh sách trắng (`data-sources.md`) — nhà công bố, chuỗi/tài liệu cụ thể,
> tần suất, độ trễ công bố. Tham số không có nguồn công khai trong danh sách trắng thì ghi rõ
> "không khả thi", không ước lượng, không thay bằng nguồn ngoài danh sách trắng.
>
> **Cách đọc bảng dưới:**
> - Cột **Tham số** chỉ liệt kê tham số cần một **con số/lịch biểu có thật** làm đầu vào cố
>   định. Biến mà chính câu hỏi đang **giải** (ví dụ "ở mức nào thì...") là biến quét/biến
>   nghiệm — không cần nguồn, vì giá trị của nó là **kết quả** phép tính, không phải đầu vào.
>   Mỗi đề tài ghi rõ biến nào là biến quét ngay dưới tên đề tài, để không ai đọc nhầm bảng là
>   "mọi cụm danh từ trong cột Tham số quét chính của `topic-map.md` đều cần một nguồn riêng".
> - Cột **Nhóm** là nhóm trong `data-sources.md` (1 = Fed/BLS/Census có API; 2 = IRS/CFPB/thuế
>   bang, không API, đi qua ảnh chụp biên tập; 3 = đã biết trước là thiếu, không có trong danh
>   sách trắng).
> - Độ trễ công bố là độ trễ giữa **kỳ dữ liệu** và **ngày công bố**, không phải độ trễ giữa
>   hai lần công bố liên tiếp (tần suất đã nói điều đó).
> - Mọi con số tần suất/độ trễ dưới đây lấy từ trang metadata thật của chính nguồn (đọc bằng
>   `WebFetch`/`WebSearch` ngày 2026-09-21, xem mục "Cách kiểm" cuối file), không phải suy đoán
>   từ trí nhớ mô hình — đúng loại bằng chứng mà `data-sources.md` và bài học bản C1 đòi hỏi.

## Tổng kết — điều kiện dừng Mốc 3

| Đề tài | Khả thi? | Lý do |
|---|---|---|
| 1 | ❌ Không khả thi | Biểu phí bảo hiểm khoản vay (PMI) theo LTV — nhóm 3, đã biết trước (`data-sources.md`) |
| 2 | ❌ Không khả thi | Đường cong mất giá xe theo dòng xe cụ thể — nhóm 3, đã biết trước |
| 3 | ✅ Khả thi | |
| 4 | ✅ Khả thi | |
| 5 | ✅ Khả thi | |
| 6 | ❌ Không khả thi | Ngưỡng xét duyệt theo điểm tín dụng, theo loại khoản vay — nhóm 3, đã biết trước |
| 7 | ✅ Khả thi | |
| 8 | ❌ Không khả thi | Tỷ lệ chi phí quỹ đầu tư theo từng quỹ cụ thể — nhóm 3, đã biết trước |
| 9 | ✅ Khả thi | |
| 10 | ✅ Khả thi (đại lượng thay thế) | Xác suất mất thu nhập không có nguồn cấp cá nhân — dùng tỷ lệ sa thải toàn quốc làm đại lượng thay thế, ghi rõ trong bảng |
| 11 | ✅ Khả thi | |
| 12 | ✅ Khả thi | |

**4/12 đề tài không khả thi (1, 2, 6, 8)** — đúng bằng bốn đề tài `data-sources.md` nhóm 3 đã
biết trước, không thêm đề tài nào mới rơi vào nhóm này. Điều kiện dừng của Mốc 3 là "**quá** 4
trong 12" (xem bảng điều kiện dừng, spec dòng ~1808) — 4 vẫn **ở đúng ngưỡng**, không vượt, nên
dự án **đi tiếp**, không dừng ở đây. Ghi chú của `topic-map.md`: bảng đã "sát ngưỡng dừng ngay
từ đầu, chưa trừ hao gì" — lượt kiểm này xác nhận đúng nhận định đó, không phát hiện gì xấu hơn.

---

## Đề tài 1 · Ở mức trả trước nào thì chi phí bảo hiểm khoản vay vượt phần tiết kiệm được từ lãi suất?

**Biến quét:** tỷ lệ trả trước.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Biểu phí bảo hiểm khoản vay (PMI) theo tỷ lệ LTV/điểm tín dụng | 3 | **Không có trong danh sách trắng.** PMI do từng công ty bảo hiểm tư nhân (MGIC, Radian, Essent…) định giá theo bảng phí riêng, không công bố công khai dạng chuỗi máy đọc được, và không nằm trong Fed/BLS/Census/IRS/CFPB/thuế bang. | — | — | Đã biết trước ở `data-sources.md` nhóm 3. Không tìm nguồn thay thế trong danh sách trắng ở lượt kiểm này. |
| Thuế bất động sản theo bang | 1 | Cục Điều tra Dân số — *State & Local Government Finance*, mục thuế tài sản (property tax) theo bang | Hàng năm | Nhiều tháng (dữ liệu tài khoá công thường công bố ~12–18 tháng sau năm tài khoá) | Khả thi **riêng tham số này**, nhưng đề tài vẫn không khả thi vì thiếu biểu phí PMI (tham số bắt buộc còn lại). |

**Kết luận: không khả thi** — thiếu nguồn cho biểu phí PMI, đúng như `data-sources.md` đã ghi trước.

---

## Đề tài 2 · Khoản vay xe 84 tháng: bao nhiêu tháng thì giá trị xe thấp hơn dư nợ?

**Biến quét:** số tháng.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Tốc độ mất giá xe theo **dòng xe cụ thể** | 3 | **Không có trong danh sách trắng.** Đường cong mất giá theo model (Kelley Blue Book, Black Book, Edmunds…) là dữ liệu thương mại có bản quyền, không phải Fed/BLS/Census/IRS/CFPB/thuế bang. | — | — | Đã biết trước ở `data-sources.md` nhóm 3. |
| Lãi suất vay xe 84 tháng | 1 | FRED — Board of Governors, G.19 Consumer Credit, *Finance Rate on Consumer Installment Loans at Commercial Banks, New Autos* (chuỗi 60-tháng: `RIFLPBCIANM60NM`; không có chuỗi 84-tháng riêng trong G.19) | Hàng tháng | ~2 tháng (kiểm `WebFetch` 2026-09-21: kỳ dữ liệu gần nhất tháng 5/2026, công bố 8/7/2026) | Khả thi **riêng tham số này**. G.19 không có kỳ hạn 84 tháng — phải dùng 60/72 tháng làm gần đúng, tự nó là một giới hạn cần ghi trong video nếu đề tài từng khả thi. |

**Kết luận: không khả thi** — thiếu nguồn cho đường cong mất giá theo dòng xe cụ thể, đúng như `data-sources.md` đã ghi trước.

---

## Đề tài 3 · Trả sớm khoản vay xe lãi 5,2% hay đầu tư: ở lợi suất kỳ vọng nào thì đảo chiều?

**Biến quét:** lợi suất kỳ vọng của khoản đầu tư thay thế (đây chính là "mức" mà câu hỏi giải — không cần nguồn, vì nó là kết quả của phép so sánh sau thuế, không phải một con số tra cứu).

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Lãi suất khoản vay xe hiện hành (để chọn ví dụ 5,2% có thật, không bịa) | 1 | FRED — Bankrate Monitor, *Auto Loan Rate – 60 Month New Car* (`BRMALR0102`; đã kiểm lại bằng `WebFetch` 2026-09-21 — **không phải** `BRMALR0101`, mã đó là *48 Month Used Car*, dễ nhầm vì cùng họ series), hoặc G.19 `RIFLPBCIANM60NM` | Bankrate: hàng tuần, kết vào thứ Năm · G.19: hàng tháng | Bankrate: ~theo tuần, gần như tức thời (kiểm 2026-09-21: kỳ 16/9/2026 công bố 17/9/2026) · G.19: ~2 tháng | Hai chuỗi cùng đo một thứ, khác nhà cung cấp gốc (Bankrate khảo sát tuần vs. Fed G.19 khảo sát ngân hàng thương mại) — chọn một, ghi rõ chuỗi đã dùng khi sản xuất thật (việc của `T-003`). |
| Thuế suất biên (để tính lợi suất sau thuế của khoản đầu tư thay thế) | 2 | Sở Thuế vụ liên bang (IRS) — *Revenue Procedure* công bố bậc thuế thu nhập hàng năm (ví dụ Rev. Proc. 2025-32 cho năm thuế 2026), trang `irs.gov/newsroom` | Hàng năm (annual-reset) | Thường công bố vào mùa thu năm trước (ví dụ bậc thuế 2026 công bố tháng 10/2025) | Nhóm 2 — không có API, đi qua ảnh chụp biên tập (hai lượt trích xuất độc lập) theo quy trình ở `data-sources.md`. Chuỗi `annual-reset`, áp luật lô. |

**Kết luận: khả thi.**

---

## Đề tài 4 · Ở mức thu nhập nào thì tài khoản hưu trí trả thuế trước thắng trả thuế sau?

**Biến quét:** mức thu nhập (qua đó suy ra thuế suất biên tại thời điểm đóng góp).

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Thuế suất biên liên bang hiện tại theo mức thu nhập | 2 | IRS — *Revenue Procedure* bậc thuế hàng năm (như đề tài 3) | Hàng năm (annual-reset) | ~1 quý trước năm thuế | — |
| Thuế suất biên tại thời điểm rút tiền hưu trí (giả định) | — | **Không phải tham số cần nguồn** — đây là một giả định kịch bản (thuế suất tương lai chưa ai công bố được), phải nêu rõ trong video là giả định, không phải số đo. | — | — | Loại khỏi yêu cầu "mọi ô phải có nguồn": bản chất là biến giả định, không phải sự kiện đã xảy ra để có nguồn. |
| Thuế thu nhập bang (nếu kênh chọn ví dụ theo bang) | 2 | Cơ quan thuế của từng bang (ví dụ California FTB, New York DTF…) — theo danh sách trắng nhóm 2 | Hàng năm (annual-reset), khác nhau theo bang | Khác nhau theo bang | Không có một nguồn liên bang duy nhất; mỗi bang một cơ quan, đúng như `data-sources.md` đã khai. Chỉ cần **một** bang cụ thể mỗi tập, không cần phủ cả 50 bang cho tập đầu. |

**Kết luận: khả thi** (giới hạn ở liên bang + một bang cụ thể mỗi tập; giả định thuế suất tương lai phải nêu rõ là giả định).

---

## Đề tài 5 · Chi phí đi lại ở mức nào thì xoá sạch phần tăng lương 10.000 đô?

**Biến quét:** quãng đường đi lại (hoặc chi phí thời gian, tuỳ khung dựng).

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Chi phí vận hành xe mỗi dặm | 2 | IRS — *Standard Mileage Rate* (mức phí dặm chuẩn cho mục đích kinh doanh), trang `irs.gov/tax-professionals/standard-mileage-rates` | Hàng năm, có thể điều chỉnh giữa năm (đã xảy ra thật năm 2026: 72,5¢/dặm từ 1/1, tăng lên 76¢/dặm từ 1/7 vì giá nhiên liệu) | Công bố cuối năm trước cho năm sau; lần điều chỉnh giữa năm công bố ngay trong năm | Chuỗi `annual-reset`, **có thể đổi giữa chu kỳ** — rủi ro thật cho "luật lô" của `data-sources.md`, không chỉ lý thuyết. |
| Giá trị thời gian (đại lượng thay thế) | 1 | BLS — *Occupational Employment and Wage Statistics* (OEWS), lương giờ trung vị toàn quốc hoặc theo nghề | Hàng năm, mốc tham chiếu tháng 5 | Khoảng 10–12 tháng (ước tính từ lịch phát hành quan sát được; chưa đo chính xác ngày công bố đầu tiên của một kỳ, chỉ đo được ngày cập nhật gần nhất) | **Đại lượng thay thế**, không phải "giá trị thời gian" thật — phải ghi rõ trong video, cùng tinh thần với nhóm 4 của `data-sources.md` (đại lượng thay thế cho nhu cầu tìm kiếm). |

**Kết luận: khả thi**, với một tham số là đại lượng thay thế cần ghi rõ.

---

## Đề tài 6 · Điểm tín dụng chỉ quan trọng ở năm ngưỡng — chúng là những ngưỡng nào?

**Biến quét:** không có — đề tài hỏi thẳng danh sách ngưỡng, bản thân danh sách đó là thứ cần một nguồn công khai, không phải biến quét ra từ mô hình.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Ngưỡng xét duyệt điểm tín dụng theo loại khoản vay (ví dụ mốc lãi suất ưu đãi đổi bậc ở FICO bao nhiêu) | 3 | **Không có trong danh sách trắng.** Ngưỡng cắt cụ thể là chính sách bảo lãnh nội bộ của từng người cho vay/nhà đầu tư thứ cấp (Fannie Mae, Freddie Mac loại LLPA theo dải điểm là dữ liệu gần nhất có công bố, nhưng Fannie Mae/Freddie Mac **không** nằm trong Fed/BLS/Census/IRS/CFPB/thuế bang của danh sách trắng). CFPB công bố **phân phối** điểm tín dụng của người vay được duyệt (qua *Consumer Credit Trends*), nhưng đó là số liệu mô tả ai đã vay được, không phải bảng ngưỡng quyết định lãi suất — không đúng loại dữ liệu đề tài cần. | — | — | Đã biết trước ở `data-sources.md` nhóm 3. Không tìm nguồn thay thế trong danh sách trắng ở lượt kiểm này; CFPB Consumer Credit Trends được cân nhắc và loại vì sai loại số (phân phối, không phải ngưỡng bảo lãnh). |

**Kết luận: không khả thi** — thiếu nguồn công khai cho chính ngưỡng bảo lãnh, đúng như `data-sources.md` đã ghi trước.

---

## Đề tài 7 · Ở mức chênh lãi suất nào thì tái cấp vốn hoàn lại được chi phí đóng hồ sơ?

**Biến quét:** chênh lệch lãi suất giữa khoản vay cũ và khoản vay mới.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Lãi suất vay mua nhà 30 năm cố định hiện hành | 1 | FRED — Freddie Mac, *Primary Mortgage Market Survey*, *30-Year Fixed Rate Mortgage Average* (`MORTGAGE30US`) | Hàng tuần, kết vào thứ Năm | Gần như tức thời (kiểm `WebFetch` 2026-09-21: kỳ 17/9/2026 công bố cùng ngày) | — |
| Chi phí đóng hồ sơ tái cấp vốn | 2 | CFPB — *HMDA* (Home Mortgage Disclosure Act), dữ liệu cấp khoản vay công khai qua `ffiec.cfpb.gov`, trường "Total Loan Costs"/"Origination Charges" | Hàng năm (dữ liệu cấp khoản vay của năm trước) | Dữ liệu quốc gia năm N công bố giữa năm N+1 (ví dụ dữ liệu 2025 công bố 23/6/2026 theo quan sát lúc kiểm) | Là dữ liệu **vi mô cấp khoản vay** (loan-level), không phải chuỗi thời gian gộp sẵn — cần tổng hợp trung vị/trung bình khi dựng kho thật (việc của `T-003`), nhưng nguồn tồn tại và công khai. |
| Thời gian giữ nhà (để tính điểm hoà vốn) | — | Không phải tham số cần nguồn — biến giả định của kịch bản (kênh nêu vài mốc thời gian giữ nhà điển hình, không phải số đo có nguồn). | — | — | — |

**Kết luận: khả thi.**

---

## Đề tài 8 · Chênh lệch tỷ lệ chi phí quỹ bao nhiêu thì cần thêm bao nhiêu lợi suất để hoà trong 20 năm?

**Biến quét:** lợi suất bù trừ cần thiết (kết quả của phép tính, đã có chênh lệch chi phí quỹ làm đầu vào).

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Tỷ lệ chi phí (expense ratio) của các quỹ cụ thể để dựng ví dụ chênh lệch có thật | 3 | **Không có trong danh sách trắng.** Tỷ lệ chi phí quỹ nằm trong bản cáo bạch (prospectus) do SEC lưu trữ (EDGAR) hoặc trang của chính công ty quỹ (Vanguard, Fidelity…) — không phải Fed/BLS/Census/IRS/CFPB/thuế bang. SEC EDGAR có thể coi là nguồn liên bang, nhưng **không nằm trong danh sách trắng đã duyệt** của `data-sources.md`; thêm SEC vào danh sách trắng là quyết định ngoài phạm vi mục này (đổi danh sách trắng là việc của `data-sources.md`, không phải `T-001`). | — | — | Đã biết trước ở `data-sources.md` nhóm 3. Ghi nhận SEC EDGAR như một hướng mở rộng danh sách trắng khả dĩ cho lượt sau, không tự thêm ở đây. |
| Thời gian nắm giữ 20 năm | — | Không phải tham số cần nguồn — cố định bởi chính câu hỏi (20 năm), không phải một số đo cần trích dẫn. | — | — | — |

**Kết luận: không khả thi** — thiếu nguồn công khai trong danh sách trắng cho tỷ lệ chi phí quỹ theo từng quỹ cụ thể, đúng như `data-sources.md` đã ghi trước.

---

## Đề tài 9 · Ở thuế suất biên nào thì tài khoản y tế có ưu đãi thuế thắng tài khoản hưu trí?

**Biến quét:** thuế suất biên.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Hạn mức đóng góp HSA và 401(k)/IRA hàng năm | 2 | IRS — thông báo hạn mức đóng góp hàng năm (ví dụ `irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500`, và thông báo HSA riêng theo Rev. Proc.) | Hàng năm (annual-reset) | Thường công bố cuối năm trước (401k/IRA) hoặc giữa năm trước (HSA, theo luật riêng của mục 223) | Hai loại hạn mức có **lịch công bố khác nhau** trong năm — cần ghi rõ khi dựng kho, không gộp chung một ngày hiệu lực. |
| Phần đóng góp của chủ lao động (tỷ lệ match 401(k)/HSA) | 1 | BLS — *National Compensation Survey / Employee Benefits in the United States* (`bls.gov/ebs/`), số liệu tỷ lệ tiếp cận và điều khoản match | Hàng năm, mốc tham chiếu tháng 3 | Chưa đo được số ngày chính xác ở lượt kiểm này — chỉ xác nhận được tần suất hàng năm và mốc tham chiếu tháng 3 qua trang tổng quan, chưa mở được trang lịch phát hành chi tiết | Dữ liệu ở mức **tỷ lệ tiếp cận/điều khoản phổ biến toàn quốc**, không phải "công ty X match Y%" — đủ cho câu hỏi dạng ngưỡng, không đủ cho một công ty cụ thể. |

**Kết luận: khả thi.**

---

## Đề tài 10 · Bao nhiêu tháng quỹ dự phòng thì đồng tiết kiệm tiếp theo thua đồng trả nợ?

**Biến quét:** số tháng quỹ dự phòng.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Lãi suất nợ (thẻ tín dụng/vay tiêu dùng) | 1 | FRED — G.19 Consumer Credit, *Commercial Bank Interest Rate on Credit Card Plans, All Accounts* (`TERMCBCCALLNS`) | Hàng tháng | ~2–3 tháng (kiểm `WebFetch` 2026-09-21: kỳ 5/2026 công bố 8/7/2026) | — |
| Xác suất mất thu nhập | 1 (đại lượng thay thế) | BLS — *JOLTS*, tỷ lệ sa thải và cho thôi việc (*Layoffs and Discharges Rate*), Bảng 5 của bản tin JOLTS | Hàng tháng | ~1–2 tháng (kiểm `WebFetch` 2026-09-21: kỳ tháng 7/2026 công bố 1/9/2026) | **Đại lượng thay thế** — tỷ lệ sa thải **toàn quốc, mọi ngành** không phải xác suất mất thu nhập của một cá nhân cụ thể. Phải ghi rõ trong video, cùng tinh thần đại lượng thay thế ở `data-sources.md` nhóm 4 — khác chỗ: nhóm 4 của `data-sources.md` nói về đại lượng thay thế cho **nhu cầu tìm kiếm** (Topic Scoring); đây là đại lượng thay thế cho một **tham số trong chính nội dung thesis**, không phải điểm số chọn đề tài. Không lẫn hai việc. |

**Kết luận: khả thi**, với một tham số là đại lượng thay thế cần ghi rõ trong video (không trình bày như xác suất cá nhân thật).

---

## Đề tài 11 · Mua điểm lãi suất khi vay mua nhà: giữ nhà bao lâu thì hoà vốn?

**Biến quét:** thời gian giữ nhà.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Giá điểm lãi suất (USD mỗi điểm) và mức giảm lãi suất tương ứng | 2 | CFPB — *HMDA*, trường "Discount Points" cấp khoản vay, đối chiếu với trường lãi suất của cùng khoản vay để suy ra tỷ lệ giảm lãi/điểm theo kinh nghiệm | Hàng năm (dữ liệu cấp khoản vay của năm trước) | Như đề tài 7 — dữ liệu quốc gia năm N công bố giữa năm N+1 | Cùng nguồn với chi phí đóng hồ sơ ở đề tài 7. Suy ra tỷ lệ giảm lãi/điểm là dữ liệu **thực nghiệm** (trung vị quan sát được), không phải một biểu giá công bố sẵn — phải nêu rõ đây là ước lượng từ dữ liệu lịch sử, không phải giá niêm yết của một khoản vay cụ thể. |

**Kết luận: khả thi.**

---

## Đề tài 12 · Ở mức chênh lãi suất nào thì trả nợ theo lãi cao thắng trả nợ theo dư nợ nhỏ quá một kỳ trả?

**Biến quét:** chênh lệch lãi suất giữa các khoản nợ.

| Tham số | Nhóm | Nguồn cụ thể | Tần suất | Độ trễ | Ghi chú |
|---|---|---|---|---|---|
| Lãi suất các loại nợ tiêu dùng phổ biến (thẻ tín dụng, vay cá nhân, vay xe) | 1 | FRED — G.19 Consumer Credit: thẻ tín dụng `TERMCBCCALLNS`, vay xe `RIFLPBCIANM60NM`/`RIFLPBCIANM72NM` | Hàng tháng | ~2–3 tháng | Đủ để dựng ví dụ "chênh lãi giữa các khoản" bằng số thật thay vì bịa; số khoản nợ cụ thể và dư nợ từng khoản là biến kịch bản, không cần nguồn. |

**Kết luận: khả thi.**

---

## Cách kiểm (CHARTER 11.1 — chạy thật, không đọc tài liệu cũ)

Mọi chuỗi/tài liệu ở trên được xác nhận **tồn tại thật** bằng `WebSearch` và/hoặc `WebFetch`
thật trong lượt làm mục này (2026-09-21), sau khi đo lại thấy bức tường mạng của issue #36
**không** chặn ở phiên này (xem `ops/lanes/topic/backlog.md` mục `T-001`, và issue #36). Không
mã chuỗi nào trong bảng trên được viết từ trí nhớ mà không kiểm — đây chính là loại bằng chứng
mà `data-sources.md` cấm ("Không tìm được số thì bỏ claim") và là loại lỗi làm bản C1 sai ba
chỗ trước đây.

**Giới hạn của lượt kiểm này, ghi rõ chứ không giấu:**
- Đã xác nhận **chuỗi/tài liệu tồn tại và đọc được** (trang thật, có dữ liệu thật, có metadata
  tần suất). **Chưa** gọi API thật để tải toàn bộ lịch sử — việc đó thuộc `topic/T-003` (kho
  ảnh chụp có phiên bản).
- Độ trễ công bố của BLS OEWS (đề tài 5, 9) chỉ ước lượng từ lịch phát hành quan sát được,
  chưa đo được ngày công bố đầu tiên chính xác của một kỳ cụ thể — ghi rõ trong ô tương ứng,
  không làm tròn thành một con số chắc chắn.
- Nguồn nhóm 2 (IRS, CFPB, thuế bang) không có API — khi `T-003` dựng kho ảnh chụp thật, phải
  đi qua đúng quy trình "hai lượt trích xuất độc lập, hai nhà cung cấp mô hình khác nhau" ở
  `data-sources.md`, không phải chép thẳng số trong bảng này (bảng này chỉ xác nhận **có
  nguồn**, không phải bản thân ảnh chụp).
- Đề tài 1, 2, 6, 8 không khả thi vì thiếu đúng loại dữ liệu `data-sources.md` đã nêu trước;
  lượt kiểm này không tìm thêm được nguồn thay thế nào trong danh sách trắng cho bốn đề tài đó,
  và cũng **không mở rộng danh sách trắng** để lách — đúng luật "nguồn ngoài bảng thì bỏ claim,
  không thay bằng nguồn tương tự".
