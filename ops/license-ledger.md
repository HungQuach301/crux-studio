# 🤖 Sổ giấy phép asset

Bắt đầu từ **asset đầu tiên** (CHARTER mục 8). Rủi ro **A6**: giấy phép không dùng được cho B2B chỉ lộ ra khi đã muộn — lúc có khách hàng, không phải lúc chọn asset.

Mỗi dòng ghi đủ bốn điều, và điều thứ tư là điều hay bị bỏ qua:

1. **Nguồn** — nhà cung cấp, và định danh cụ thể của asset.
2. **Điều khoản** — trích dẫn, kèm **ngày đọc**. Không tóm tắt bằng trí nhớ.
3. **Dùng thương mại được không.**
4. **Giao lại cho khách hàng B2B được không** — quyền dùng thương mại **không** đồng nghĩa với quyền giao lại.

| Asset | Loại | Nguồn | Điều khoản (ngày đọc) | Thương mại | B2B / giao lại | Mục backlog |
|---|---|---|---|---|---|---|
| Font `Inter` — **khảo sát, chưa chọn, chưa dùng** | font | Gói `@fontsource/inter@5.3.0` trên `registry.npmjs.org`, file `package/LICENSE` trong chính gói | SIL Open Font License 1.1 (2007-02-26), đọc **2026-09-21** — trích nguyên văn ở mục khảo sát bên dưới | **Được** | **Được** với video đã dựng; giao **file font** thì phải kèm giấy phép và không bán font riêng | `VF-G7` |
| Giọng đọc `Amazon Polly` — **khảo sát, chưa chọn, chưa dùng** | TTS | AWS Service Terms §50 (Polly là "AI Service") + AWS Customer Agreement | đọc **2026-09-22** — trích nguyên văn ở khảo sát `AU-001` bên dưới | **Được** (output là "Your Content", bạn sở hữu) | **Được — suy từ quyền sở hữu**, không có điều khoản giao-lại tường minh | `AU-001` |
| Giọng đọc `Google Cloud TTS` — **khảo sát, chưa chọn, chưa dùng** | TTS | Google Cloud Service Specific Terms §20 + Cloud Platform Agreement | đọc **2026-09-22** — trích nguyên văn ở khảo sát `AU-001` bên dưới | **Được** ("Generated Output is Customer Data") | **Được — suy từ quyền sở hữu**; ⚠️ §17(a) cấm dùng output làm sản phẩm/dịch vụ **cạnh tranh** | `AU-001` |
| Giọng đọc `ElevenLabs` — **khảo sát, chưa chọn, chưa dùng** | TTS | ElevenLabs Terms of Use + Use Policy | đọc **2026-09-22** — trích nguyên văn ở khảo sát `AU-001` bên dưới | **Được, chỉ gói trả phí** (Free = phi thương mại) | **Suy được, nhiều ràng buộc hơn** — cấm bán lại *Services*; output *Sound Effects* cấm standalone (không phải giọng TTS); theo Prohibited Use Policy | `AU-001` |

Chưa có asset thật nào được dùng: Đợt 0 mới có stub. Giọng đọc stub là `provider: "stub"`, và `commercialLicenseVerified: false` — đó là trạng thái đúng, không phải một ô bỏ trống. Dòng font ở trên là kết quả **khảo sát** `VF-G7`, ghi trước khi có asset đầu tiên để lúc cần thì đã có sẵn câu trả lời. Nó **không** phải một lựa chọn: chọn asset là quyết định `irreversible` của chủ dự án (mục "Luật" dưới đây), và nó nói về **một** font dưới **một** giấy phép, không suy rộng ra họ font nào.

## Luật

- Asset chưa có dòng trong sổ này thì **không được dùng trong tập thật**. Stub thì được, và phải khai `false`.
- Chọn giọng đọc hoặc asset có điều khoản thương mại là quyết định **`irreversible`** (CHARTER 2.3): mở `🤖 [QĐ]`, không tự chọn.
- Điều khoản đổi thì thêm một dòng mới với ngày đọc mới, **không sửa dòng cũ**. Lịch sử là thứ cần khi có tranh chấp.
- Font, bản đồ, ảnh stock, nhạc nền, và mô hình TTS đều là asset. Giả định **G7** phủ cả bốn.

---

## Khảo sát `VF-G7` — điều khoản nhà cung cấp, 2026-09-21

Mục `VF-G7` của làn `verify` kiểm giả định **G7** cho bốn loại asset: giọng đọc (TTS), ảnh/video stock, font, bản đồ.

**Cách làm đã dùng:** đọc **văn bản giấy phép gốc** của nhà cung cấp và trích nguyên văn đoạn trả lời hai câu hỏi dưới đây, kèm ngày đọc và nguồn chính xác. Không tóm tắt bằng trí nhớ, không lấy từ trang giới thiệu sản phẩm, **không lấy từ đoạn trích của máy tìm kiếm** — đoạn trích đó là bản tóm tắt của bên thứ ba, đúng loại bằng chứng mà luật của làn `verify` loại bỏ.

Hai câu hỏi, và câu thứ hai mới là chỗ rủi ro **A6** nằm:

1. Dùng **thương mại** được không (kênh YouTube có doanh thu)?
2. **Giao lại cho khách hàng B2B** được không?

Khảo sát này **không chọn** nhà cung cấp nào. Chọn là quyết định `irreversible` (CHARTER 2.3), và `voice.commercialLicenseVerified` giữ nguyên `false`.

### Kết quả: một trong bốn nhóm đọc được

| Nhóm asset | Trạng thái | Vì sao |
|---|---|---|
| **Font** | ✅ đọc được văn bản giấy phép gốc | Giấy phép đi **kèm chính gói font**, lấy qua `registry.npmjs.org` — không cần vào trang web nhà cung cấp |
| **Giọng đọc (TTS)** | ⬜ **không đọc được** | Mọi trang điều khoản bị chặn ở tầng mạng của phiên cloud (bảng đo bên dưới) |
| **Ảnh/video stock** | ⬜ **không đọc được** | Như trên |
| **Bản đồ** | ⬜ **không đọc được** | Như trên |

### Nhóm font — trích dẫn đầy đủ

Dòng sổ nằm ở bảng đầu file. Bằng chứng của nó:

**Trích nguyên văn** (từ `package/LICENSE` của gói nêu trên, đọc 2026-09-21):

> `PERMISSION & CONDITIONS`
> `Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:`
>
> `1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.`
>
> `2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. […]`
>
> `[… điều 3 và điều 4 …]`
>
> `5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.`

**Đọc ra hai câu trả lời, và ranh giới giữa hai ca dùng:**

- **Video đã dựng đọc là "document created using the Font Software"** (điều 5, câu cuối). Chữ đã render trong video **không** kéo theo **nghĩa vụ giữ nguyên giấy phép** của OFL — điều 5 miễn đúng nghĩa vụ đó, không miễn mọi thứ. Nên: phát hành thương mại **được**, giao video cho khách hàng B2B **được**, không cần kèm giấy phép font.

  ⚠️ **Bước này là suy luận, khai thẳng ra:** OFL 1.1 **không định nghĩa** chữ "document". Cách đọc trên trùng với PREAMBLE của chính file giấy phép ("The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives"), nhưng nguồn xác nhận chuẩn là **OFL FAQ ở `scripts.sil.org`** — đúng một trong các đích trả `000` ở bảng đo dưới. Đọc được FAQ thì thay gạch đầu dòng này bằng trích dẫn.
- **Giao file font** cho khách hàng (dự án nguồn, gói thương hiệu, template) là ca **khác**: lúc đó điều 1 và điều 2 có hiệu lực — mỗi bản sao phải kèm **nguyên văn giấy phép và dòng bản quyền**, và **không được bán riêng font**. Bán kèm phần mềm hoặc sản phẩm thì được.
- Điều 3 (Reserved Font Name) chỉ chạm tới ta nếu **sửa** font rồi giữ tên gốc — và với **chính** font này thì không áp dụng ở ca nào: dòng bản quyền trong `package/LICENSE` của Inter **không khai** Reserved Font Name nào, mà giấy phép định nghĩa RFN là `any names specified as such after the copyright statement(s)`. Font khác thì phải đọc lại dòng bản quyền của font đó.

⚠️ Dòng này nói về **giấy phép `OFL-1.1`**, không phải về mọi font trên Google Fonts. Google Fonts còn có font `Apache-2.0` và vài giấy phép khác. Mỗi font đem dùng thật phải có **dòng riêng** trong sổ này, đọc từ file giấy phép đi kèm chính font đó.

### Ba nhóm còn lại: chặn ở tầng mạng, không phải chưa làm

Phiên cloud của routine **không ra được** các trang điều khoản: **16 trên 18** đích đo được không nối nổi. Đo lúc **2026-09-21T10:44:16Z**, mỗi đích một lần `curl -s -o /dev/null -w "%{http_code}" -m 10 https://<đích>/`:

| Đích | Mã trả về |
|---|---|
| `elevenlabs.io`, `api.elevenlabs.io`, `play.ht`, `murf.ai`, `openai.com` | `000` (không nối được) |
| `www.pexels.com`, `unsplash.com`, `pixabay.com` | `000` |
| `fonts.google.com`, `scripts.sil.org`, `openfontlicense.org` | `000` |
| `www.openstreetmap.org`, `www.naturalearthdata.com` | `000` |
| `aws.amazon.com`, `docs.aws.amazon.com`, `learn.microsoft.com` | `000` |
| `cloud.google.com` | `200` |
| `registry.npmjs.org` | `200` |

Công cụ đọc web của agent trả về nguyên văn `EGRESS_BLOCKED` cho `elevenlabs.io`, `aws.amazon.com` và `www.pexels.com`. Đây là **chính sách mạng của environment**, không phải lỗi cần sửa trong repo — và cũng không phải thứ agent được phép lách (CLAUDE.md mục 5).

`cloud.google.com` mở, nhưng phần trả lời đúng câu hỏi của ta — điều khoản riêng cho Cloud Text-to-Speech — **không nằm** trong trang `Service Specific Terms` đọc được, và mục `5.1` của `Cloud Terms of Service` trả về **bản bị cắt giữa chừng**. Trích một đoạn bị cắt rồi gọi là "đã đọc điều khoản" đúng là cái bẫy mà luật của làn này dựng ra để tránh, nên nhóm TTS **để trống**, không đoán.

**Hệ quả:** `VF-G7` chuyển `parked`, và `AU-001` của làn `audio` vẫn chặn. Đề nghị gỡ chặn nằm ở issue **#36** (`🤖 [QĐ]`, `reversible`, ba phương án).

---

## Khảo sát `AU-001` — điều khoản TTS (giọng đọc), 2026-09-22

Mục `AU-001` (làn `audio`) kiểm phần **giọng đọc (TTS)** của giả định **G7** — đúng phần mà khảo sát `VF-G7` ngày 2026-09-21 để **trống** vì mạng chặn.

**Điều đã đổi so với 2026-09-21 — mạng, không phải điều khoản.** Bức tường egress **không đồng nhất giữa các phiên cloud** (cùng quan sát của mục `topic/T-001`). Ở phiên này các đích điều khoản TTS **nối được** — đo `curl -s -o /dev/null -w "%{http_code}"`, 2026-09-22 ~18:2xZ:

| Đích | Mã |
|---|---|
| `aws.amazon.com/service-terms/`, `aws.amazon.com/polly/faqs/`, `aws.amazon.com/agreement/` | `200` |
| `cloud.google.com/terms/service-terms`, `cloud.google.com/terms/`, `cloud.google.com/terms/aup` | `200` |
| `elevenlabs.io/terms-of-use`, `elevenlabs.io/use-policy` | `200` |
| `openai.com/policies/terms-of-use/` | `403` (nhà cung cấp tự chặn bot phía họ, không phải egress) |

Vì đọc được **văn bản điều khoản gốc** (không phải trang giới thiệu, không phải đoạn trích của máy tìm — đúng chuẩn bằng chứng của làn `verify`), khảo sát đi tiếp được cho **ba** nhà cung cấp. Cách làm: `curl` lấy HTML gốc, tách text, trích **nguyên văn** đoạn trả lời hai câu hỏi. **Không chọn** nhà cung cấp — chọn là quyết định `irreversible` (CHARTER 2.3), mở ở issue `🤖 [QĐ]` riêng. `voice.commercialLicenseVerified` giữ nguyên `false`.

Hai câu hỏi, câu 2 là chỗ rủi ro **A6** nằm: (1) dùng **thương mại** được không? (2) **giao lại cho khách B2B** được không?

### (A) Amazon Polly

Nguồn thẩm quyền: **AWS Service Terms** (Polly là "AI Service", §50) và **AWS Customer Agreement**.

- **(1) Thương mại — Được.** AWS Service Terms §50.2 (`https://aws.amazon.com/service-terms/`, đọc 2026-09-22): trích nguyên văn — *"The output that you generate using AI Services is Your Content."* §50.1 liệt kê *"Amazon Polly"* trong danh sách "AI Services". AWS Customer Agreement (`https://aws.amazon.com/agreement/`, đọc 2026-09-22): *"you or your licensors own all right, title, and interest in and to Your Content and Suggestions"*. Bạn **sở hữu** output ⇒ dùng thương mại được.
- **(2) B2B — Được, suy từ quyền sở hữu.** Không có điều khoản riêng cho phép **hay** cấm giao lại output cho bên thứ ba trong phần đọc được. Vì output là "Your Content" bạn sở hữu toàn bộ, giao lại B2B là hệ quả của quyền sở hữu. ⚠️ **Đây là suy luận từ quyền sở hữu, không phải câu cho phép giao-lại tường minh** — khai thẳng, đúng chuẩn làn `verify`.
- **Caveat cần biết (§50.3):** với Amazon Polly, AWS "may use and store AI Content ... to develop and improve the applicable AI Service" **trừ khi** opt-out bằng "AI services opt-out policy using AWS Organizations". Đây là về **input/AI Content**, không phải về quyền dùng output — nhưng là chỗ phải bật opt-out khi vào thật.

### (B) Google Cloud Text-to-Speech

Nguồn thẩm quyền: **Google Cloud Service Specific Terms** (§20 Generative AI Services) và **Google Cloud Platform Agreement**.

- **(1) Thương mại — Được.** SSST §20.a (`https://cloud.google.com/terms/service-terms`, đọc 2026-09-22), trích nguyên văn — *"Generated Output" means the data or content generated by a Generative AI Service prompted by Customer Data. Generated Output is Customer Data. As between Customer and Google, Google does not assert any ownership rights in any new intellectual property created in the Generated Output.* Cloud ToS §5.1 (`https://cloud.google.com/terms/`, đọc 2026-09-22): *"As between the parties, Customer retains all Intellectual Property Rights in Customer Data and Customer Applications, and Google retains all Intellectual Property Rights in the Services and Software."* ⇒ dùng thương mại được.
- **Ràng buộc §17(a) Competitive Use** (`service-terms`, đọc 2026-09-22): *"Customer will not, and will not allow End Users to use an AI/ML Service or Generated Output to develop a similar or competing product or service."* Không chặn video tài chính, **nhưng** chặn dùng output để dựng một dịch vụ TTS/AI cạnh tranh — cần nhớ khi khách B2B định dùng lại.
- **(2) B2B — Được, suy từ quyền sở hữu.** Không có điều khoản riêng về giao lại **output**. Điều khoản cấm bán lại chỉ nói về **Services**: Cloud ToS §3.3(c) (đọc 2026-09-22): *"(c) sell, resell, sublicense, transfer, or distribute any or all of the Services"* — là *the Services*, không phải output. AUP (`https://cloud.google.com/terms/aup`) là quy tắc dùng chung, không nói riêng về giao output. Vì "Generated Output is Customer Data" và Customer giữ IP ⇒ giao lại B2B suy được. ⚠️ Suy từ sở hữu, không tường minh; và ràng buộc §17(a) đi kèm.

### (C) ElevenLabs

Nguồn thẩm quyền: **Terms of Use** và **Use Policy** (Prohibited Use).

- **(1) Thương mại — Được, CHỈ gói trả phí.** ToU (`https://elevenlabs.io/terms-of-use`, đọc 2026-09-22), trích nguyên văn — *(i) if you access or use our Services free of charge (such a user, a "Free User"), you may only use the Services for non-commercial purposes; (ii) if you access or use our Services through a paid subscription plan (such a user, a "Paid User"), you may use the Services for commercial purposes, but in either case, your access and use of the Services and any Output must still comply with the Prohibited Use Policy.* Free = phi thương mại; **Paid** = thương mại được.
- **Sở hữu output.** ToU §4(c) (đọc 2026-09-22): *"Except as expressly set forth herein, as between you and ElevenLabs, you retain all rights in and to your Output."* Dùng output ngoài dịch vụ: *"you are permitted to use such Output outside of the Services but always subject to these Terms and our Prohibited Use Policy."*
- **(2) B2B — Suy được, nhiều ràng buộc hơn hai nhà kia.** Use Policy §9 (`https://elevenlabs.io/use-policy`, đọc 2026-09-22) cấm: (b) *"Selling, reselling, renting, leasing, loaning, assigning, licensing, or sub-licensing our Services..."* — cấm bán lại **Services**; và (c) cấm *"...distributing, performing, licensing, sublicensing or commercially using or exploiting any Output (or any portion thereof) generated using our Sound Effects product on a standalone basis..."* — chỉ với output của **Sound Effects** và chỉ ở dạng **standalone**. Giọng đọc TTS nhúng trong video giao cho khách B2B **không** rơi vào §9(c) (đó là Sound Effects, không phải giọng TTS; và không standalone). Nhưng **không có câu cho phép giao-lại TTS tường minh**; điều chi phối là "you retain all rights in and to your Output" cộng Prohibited Use Policy. ⚠️ Ràng buộc chặt hơn — mỗi ca giao lại phải đọc lại Prohibited Use Policy.

### Đọc ra cho G7 và cho quyết định

- **Câu 1 (thương mại):** cả ba **được** — trích dẫn tường minh. ElevenLabs kèm điều kiện gói trả phí.
- **Câu 2 (B2B/giao lại):** **không nhà nào nói tường minh "được giao lại output cho khách B2B"**. Với Polly và Google, suy được từ quyền sở hữu output (Customer sở hữu / Google không giữ IP). Với ElevenLabs, suy được nhưng vướng nhiều ràng buộc hơn và một Prohibited Use Policy riêng. **Đây đúng là khoảng cách A6** — quyền dùng thương mại không đồng nghĩa quyền giao lại — và nó được ghi ra, không bị làm mờ.
- **Provider chưa chọn.** Chọn giọng đọc là `irreversible` (CHARTER 2.3, nhóm 3): mở `🤖 [QĐ]`. Khảo sát này chỉ trả lời phần **điều khoản**; giá tiền và chất lượng giọng là trục riêng của một mục sau. Issue `#36` (mở đường mạng để đọc điều khoản) nay có phần được vượt qua: phiên này **đọc được** điều khoản mà không cần mở gì — bức tường không đồng nhất giữa các phiên.
