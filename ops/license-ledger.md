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
