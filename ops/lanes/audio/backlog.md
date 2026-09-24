# 🤖 Backlog làn `audio` — Đợt 1

Xưởng Âm thanh (S11–S11b, phụ đề).

---

### AU-001 · Đánh giá nhà cung cấp giọng đọc và điều khoản thương mại
Kiểm **giả định G7**. Mục này chặn mọi thứ phía sau nó, nhưng kiểm rẻ và nhanh — đọc điều khoản, không phải chạy thử.

- deps: G7
- risk: high
- status: review
- hold: chờ quyết định irreversible chọn nhà cung cấp giọng đọc (🤖 [QĐ]); commercialLicenseVerified giữ false tới khi issue đóng
- nguồn: CHARTER 11.2 (G7), mục 8; rủi ro A6
- tiêu chí xong:
  - ✅ Mỗi nhà cung cấp được xét có một dòng trong `ops/license-ledger.md`: nguồn, điều khoản, dùng thương mại được không, giao lại cho khách hàng B2B được không. — **ba nhà cung cấp TTS** (Amazon Polly, Google Cloud TTS, ElevenLabs) đã có dòng ở bảng đầu `ops/license-ledger.md`, mục backlog `AU-001`.
  - ✅ Trích dẫn điều khoản kèm ngày đọc, không tóm tắt bằng trí nhớ. — khảo sát `AU-001` (2026-09-22) trong `ops/license-ledger.md` trích **nguyên văn** từ văn bản điều khoản gốc (`curl` HTML gốc → tách text → trích), kèm URL và ngày đọc. **Câu 2 (B2B) khai thẳng là suy luận từ quyền sở hữu, không tường minh** — đúng khoảng cách A6.
  - ⬜ Chọn nhà cung cấp là quyết định `irreversible` (CHARTER 2.3): mở `🤖 [QĐ]`, không tự chọn. — đã mở `🤖 [QĐ]` (link trong PR); **chờ chủ dự án**.
  - ⬜ `voice.commercialLicenseVerified` chỉ được đặt `true` sau khi quyết định đó đóng. — giữ `false` (stub), chưa đụng.
- **Vì sao `review` chứ không `done`:** phần đọc-điều-khoản đã xong và trích dẫn nằm trong `ops/license-ledger.md`, nhưng hai tiêu chí cuối chờ **quyết định `irreversible`** của chủ dự án (chọn provider) — không chờ một lượt worker. Chỉ chuyển `done` khi issue `[QĐ]` đóng và `commercialLicenseVerified` được xử lý. `deps: G7` cũ đọc "TTS không đọc được từ phiên cloud" đã lỗi thời cho **phiên này**: mạng egress không đồng nhất giữa các phiên (cùng quan sát `topic/T-001`), phiên này đọc được — bằng chứng ở khảo sát `AU-001`.
- **cửa merge:** chạm `ops/license-ledger.md`, `ops/lanes/audio/**`, `ops/logs/**` — không chạm vùng `owner-merge`; chạy `node ops/invariants.protected-area.ts`, đừng đoán.
- ⚠️ **Hai tiêu chí ⬜ ở trên đã hết hiệu lực, và dòng `hold` cũng vậy** (`AU-006`, 2026-09-24): chủ dự án đã trả lời `🤖 [QĐ]` [#158](https://github.com/HungQuach301/crux-studio/issues/158) trên issue bản tin #193 — *"#158: xem khối GIỌNG ĐỌC dưới đây, **không chốt theo 3 lựa chọn cũ**"*. Không còn việc "chọn một trong ba nhà" để chờ. Đường mới: spec giọng nằm ở `voiceSpec` của Channel Pack (`AU-006`), vòng thử 5 nhà ở `AU-008`, và **lựa chọn cuối cùng** vẫn là `[QĐ]` `irreversible` — chữ của chủ dự án. Khảo sát điều khoản ba nhà trong `ops/license-ledger.md` **giữ nguyên**: thứ bị thay là cách chọn. Mục này chỉ chuyển `done` khi #158 được đóng và `voice.commercialLicenseVerified` được xử lý theo giọng thật của `AU-008`.

### AU-002 · Phụ đề và đo trôi
- deps: AU-001
- risk: low
- status: ready
- nguồn: contract audio v0; genre pack `captionDriftMaxMs`
- tiêu chí xong: trôi lớn nhất được **đo** trên một tập thật và ghi vào artifact, không để mặc định 0.

### AU-003 · Chuẩn hoá loudness
- deps: AU-001
- risk: low
- status: ready
- nguồn: spec mục sound-design
- tiêu chí xong: loudness đo được nằm trong dung sai khai trong genre pack, trên toàn tập chứ không chỉ trên một đoạn.

### AU-004 · Độ dẫn âm thanh ở ranh giới beat (J-cut)
Cung cấp dữ liệu cho kiểm số 6 của Preflight.

- deps: AU-002
- risk: low
- status: ready
- nguồn: spec cơ chế 1 kiểm 6
- tiêu chí xong: artifact âm thanh mang được độ dẫn ở từng ranh giới beat, đủ để xưởng Dựng kiểm mà không phải đoán.

### AU-005 · Xưởng `audio` lên `impl: v1`
- deps: AU-003, AU-004
- risk: high
- status: ready
- nguồn: CHARTER 5.4
- tiêu chí xong: tập vàng chạy lại xanh với `impl: v1`, băng ghi chứa phản hồi TTS thật.

---

### AU-006 · Lưu spec giọng đọc của chủ dự án vào Channel Pack
Chỉ dẫn của chủ dự án, khối **GIỌNG ĐỌC** trong comment `2026-09-23T14:18:09Z` trên issue bản tin [#193](https://github.com/HungQuach301/crux-studio/issues/193): *"Thay cho bảng 3 nhà cung cấp: lưu spec sau vào Channel Pack us-personal-finance."* Comment không mở đầu bằng 🤖 trên issue nhãn `digest` → chỉ dẫn thật (`CLAUDE.md` mục 5).

Chỉ dẫn nằm đó **~21,6 giờ** mà không mục backlog nào giữ. Đo trên `ops/logs/integration/step0-*.jsonl`: bốn lượt worker đi tới `idle` trong khoảng đó (`07:23Z`, `09:27Z`, `10:21Z`, `11:22Z` — lượt `07:42Z` xen giữa KHÔNG idle, nó nhận `P-042`), và dòng log lượt `09:27Z` ghi thẳng ra rằng khối GIỌNG ĐỌC bị xếp vào "deferred". Đó là hình dạng nhóm **Z** của chính hàng đợi việc: việc có thật, đã được giao, và mọi chỉ báo xanh.

- deps: —
- risk: low — lưu spec không tốn tiền, không khoá dự án vào nhà cung cấp nào, và revert được bằng git.
- status: review
- nguồn: chỉ dẫn chủ dự án trên `#193`; `packs/channels/us-personal-finance/persona.md` ("Giọng đọc | Một giọng duy nhất, không đổi. Xem `channel.json`"); giả định **G7**
- tiêu chí xong:
  - ✅ Giá trị máy đọc: khoá `voiceSpec` trong `packs/channels/us-personal-finance/channel.json` — nhân vật, ba điều cấm, giọng vùng, tuổi cảm nhận, hai giới tính ứng viên, hai dải tốc độ, ba luật ngữ điệu, ưu tiên nguồn giọng, cờ `changeIsIrreversible`.
  - ✅ Bản người đọc kèm xuất xứ: `packs/channels/us-personal-finance/voice-spec.md`, dẫn đúng comment nguồn theo dấu thời gian.
  - ✅ Bài kiểm khoá spec: `ops/test/channel-voice-spec.test.ts`, 6 bài. **Phá thử thật bốn chỗ, số đỏ là số đo:** đổi dải tốc độ → 2 bài đỏ · bớt một điều cấm → 1 · điền `ttsVoiceId` → 1 · bỏ một mục giữ khỏi `voice-spec.md` → 1.
  - ✅ Khoá chiều ngược: `ttsVoiceId` và `providers.tts` vẫn `null`. Lưu spec **không** phải chọn giọng — chọn là `irreversible` (CHARTER 2.3 nhóm 3), phụ thuộc **G7**.
  - ✅ Phần còn lại của chỉ dẫn có người giữ: `AU-007`, `AU-008`, `topic/T-013`. Không phần nào rơi mất.
- **Vì sao `review` chứ không `done`:** phần lưu spec đã xong và có máy canh, nhưng chỉ dẫn gốc còn bốn việc nữa ở ba mục khác. Chuyển `done` khi PR merge — mục này không chờ chủ dự án việc gì.
- **cửa merge:** chạy `node ops/invariants.protected-area.ts`, đừng đoán.
- **mã mục:** dò `### AU-` trên `main` **và** trên đầu cả 12 PR đang mở — cao nhất là `AU-005`.

---

### AU-007 · Bước chuẩn hoá văn bản trước TTS, độc lập nhà cung cấp
Việc **(1)** của khối GIỌNG ĐỌC (`#193`). Chủ dự án nêu nguyên văn các ca phải đọc đúng: số, tiền, `%`, năm, khoảng, viết tắt — `401(k)` = *four-oh-one-K* · `S&P 500` = *S and P five hundred* · `APR`/`ETF`/`HSA`/`IRA` đọc từng chữ · `FICO` = *FYE-koh*.

Cộng phần **(a)** của khối kiến trúc: công đoạn mỗi tập của xưởng giọng = chuẩn hoá văn bản → TTS bằng giọng khoá trong Channel Pack → kiểm ASR/độ to/độ dài → làm lại tối đa theo tham số `R7d` → xuất timestamp từng từ; chạy **trước** cổng hình storyboard/Preflight.

- deps: AU-006
- risk: medium — bảng đọc là dữ liệu của **kênh** (`packs/channels/`), bộ chuẩn hoá là mã của **xưởng**; trộn hai thứ là cách hằng số nội dung lọt vào `kernel` (`CLAUDE.md` mục 11).
- status: review
- nguồn: chỉ dẫn chủ dự án trên `#193`, việc (1) và kiến trúc (a)
- tiêu chí xong:
  - ✅ Bảng đọc nằm trong Channel Pack, máy đọc được, mỗi dòng có ca kiểm. → `packs/channels/us-personal-finance/reading-table.json` (12 luật, gồm các ca chủ dự án nêu nguyên văn: `401(k)`, `S&P 500`, `APR`/`ETF`/`HSA`/`IRA`, `FICO`), contract `kernel/contracts/reading-table.schema.json`, loader `loadChannelReadingTable`/`readingRulesFor`, cổng `ops/scripts/check-reading-table.ts` (phần của `pnpm contracts`); mỗi luật mang trường `test` và xưởng chạy hết (`workshops/audio/test/normalize.test.ts`).
  - ✅ Bộ chuẩn hoá **không** gọi nhà cung cấp nào và chạy được khi `providers.tts` còn `null`. → `workshops/audio/src/normalize.ts` (`normalizeForSpeech`), thuần văn bản, chỉ import kiểu của kernel; test khẳng định `providers.tts` null vẫn chạy.
  - ✅ Bài kiểm đi từ văn bản thật của tập vàng, không từ ví dụ tự bịa. → test nạp `ops/golden/ep-0001-stub/snapshots/editorial.json` và chuẩn hoá lời thoại thật.
  - ✅ Thứ tự công đoạn (a) ghi vào contract của xưởng `audio`, không chỉ ghi trong tài liệu. → `workshops/audio/contracts/pipeline.v0.schema.json` + dữ liệu `workshops/audio/pipeline.v0.json`, cổng `ops/scripts/check-audio-pipeline.ts`.
- hold: còn treo — bộ chuẩn hoá CHƯA nối vào `produce()` của xưởng (làm vậy đổi tokens → đổi snapshot tập vàng, phải đi PR riêng theo CHARTER 6.1). Nối là việc của `AU` lên `impl: v1`, cùng lối `V-001`→`V-006` đã khai. Công đoạn `tts`/`retry` chờ nhà cung cấp (providers.tts null — G7, CHARTER 2.3 nhóm 3).

---

### AU-008 · Vòng thử 5 nhà cung cấp giọng và gói nghe mù
Các việc **(2) (3) (4)** của khối GIỌNG ĐỌC (`#193`), cộng phần **(b)** của khối kiến trúc: việc chọn giọng là **module kiểm định năng lực tái sử dụng**, không nằm trong quy trình từng tập.

Chủ dự án khai sẵn trần chi phí: **tối đa 30 USD**. R1 tracer dùng `gpt-4o-mini-tts` làm `v0-real`. Lựa chọn cuối là `🤖 [QĐ]` **irreversible**.

- deps: AU-007
- risk: high — đây là mục **đầu tiên của dự án tiêu tiền API thật**. CHARTER mục 8 và `CLAUDE.md` mục 15: điều tiết ở cửa vào.
- status: ready
- hold: — **không treo.** Trần **30 USD** đã được chủ dự án duyệt thẳng trong cùng chỉ dẫn (*"Chi phí thử tối đa 30 USD"*), nên CHARTER 2.3 nhóm 1 đã có câu trả lời và không cần `[QĐ]` để bật vòng thử. Phần còn `irreversible` là thứ anh tách sẵn: *"**Lựa chọn cuối** là [QĐ] irreversible"* — mở `[QĐ]` ở cuối vòng thử, không phải ở đầu. Lượt nhận mục ghi chi phí thật vào `ops/logs/audio/AU-008.jsonl` và không vượt trần.
- nguồn: chỉ dẫn chủ dự án trên `#193`, các việc (2) (3) (4) và kiến trúc (b)
- tiêu chí xong:
  - 5 nhà cung cấp × 2 giọng gần spec `voiceSpec` nhất: ElevenLabs v3 và Multilingual v2, Gemini 3.1 Flash TTS, Cartesia Sonic 3.6, Inworld TTS-2, OpenAI `gpt-4o-mini-tts`.
  - Kiểm tự động: ASR nghe lại đúng **100%** số và viết tắt · có timestamp từng từ · đọc liền **12 phút** không trôi âm sắc · điều khoản thương mại và B2B có dòng trong `ops/license-ledger.md`.
  - Gói nghe mù cho chủ dự án: tên file ngẫu nhiên, nghe được trên GitHub điện thoại, kèm phiếu chấm **đúng năm tiêu chí anh nêu**: đáng tin · rõ số · tự nhiên · nghe 12 phút không mệt · hợp kênh.
  - Chi phí thật của vòng thử ghi vào `ops/logs/audio/AU-008.jsonl` (`costUsd`, bất biến **I8**) và không vượt 30 USD.
  - **Trả lời một căng thẳng có thật, đừng lặng lẽ bỏ qua nó:** chủ dự án viết *"ưu tiên giọng thiết kế riêng, **không dùng giọng thư viện**"* (`voiceSpec.$ownerWords`), nhưng chính anh cũng chỉ định 5 nhà cung cấp × 2 giọng gần spec nhất — tức toàn giọng thư viện. Vòng thử phải nói rõ nó đang thử giọng thư viện để **định mốc**, và nêu đường đi tới giọng thiết kế riêng (nhà nào cho, giá bao nhiêu, điều khoản B2B ra sao), chứ không im lặng coi vế sau là không tồn tại.
