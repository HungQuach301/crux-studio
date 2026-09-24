# 🤖 Spec giọng đọc — `us-personal-finance`

> **Nguồn:** chỉ dẫn của chủ dự án, khối **GIỌNG ĐỌC** trong comment ngày `2026-09-23T14:18:09Z`
> trên issue bản tin [#193](https://github.com/HungQuach301/crux-studio/issues/193). Comment đó
> không mở đầu bằng 🤖 và nằm trên issue nhãn `digest`, nên nó là **câu trả lời của chủ dự án**
> theo `CLAUDE.md` mục 5 — chỉ dẫn, không phải dữ liệu.
>
> Mục backlog: `audio/AU-006`. Giá trị máy đọc nằm ở khoá `voiceSpec` của `channel.json`;
> file này là bản người đọc và phần *vì sao*.

## Spec đang khoá

| Thành phần | Giá trị | Khoá trong `channel.json` |
|---|---|---|
| Nhân vật | Calm, precise, warm analyst | `voiceSpec.character` |
| Cấm | no hype · no claim of certified expertise · no impersonation of a real person | `voiceSpec.mustNot` |
| Giọng vùng | General American | `voiceSpec.accent` |
| Tuổi cảm nhận | 30–45 | `voiceSpec.perceivedAgeRange` |
| Giới tính ứng viên | thử **cả** nam và nữ | `voiceSpec.genderCandidates` |
| Tốc độ | 150–160 từ/phút; **130–140** ở số liệu chính | `voiceSpec.paceWpm` |
| Ngữ điệu | hạ giọng cuối câu · nhấn số · ngừng trước con số tiết lộ | `voiceSpec.prosody` |
| Nguồn giọng | **ưu tiên** giọng thiết kế riêng, không dùng giọng thư viện | `voiceSpec.originPreference` |
| Đổi giọng | luôn là quyết định `irreversible` | `voiceSpec.changeIsIrreversible` |

## Ba chỗ dễ đọc sai, nói rõ ở đây

1. **Spec này thay bảng ba nhà cung cấp của `AU-001`.** Chữ của chủ dự án: *"Thay cho bảng 3 nhà
   cung cấp"*, *"không chốt theo 3 lựa chọn cũ"*. Khảo sát điều khoản của `AU-001` trong
   `ops/license-ledger.md` **vẫn đúng và vẫn giữ** — thứ bị thay là **cách chọn**, không phải các
   dòng đã đọc được.
2. **Lưu spec không phải chọn giọng.** `ttsVoiceId` và `providers.tts` vẫn `null`. Chọn nhà cung
   cấp và chọn giọng là `irreversible` (CHARTER 2.3 nhóm 3) và phụ thuộc **giả định G7** (điều
   khoản thương mại của giọng đọc). Mục này không đụng vào hai ô đó.
3. **`originPreference: "designed"` là ưu tiên, không phải lệnh cấm.** Chủ dự án viết "ưu tiên".
   Ghi thành lệnh cấm sẽ loại sẵn một nhà cung cấp mà anh chưa loại.

## Phần còn lại của chỉ dẫn — ai giữ

Khối GIỌNG ĐỌC còn bốn việc nữa; chúng **không** nằm trong mục này, và mỗi việc có một mục
backlog giữ để không rơi mất:

| Việc trong chỉ dẫn | Mục giữ |
|---|---|
| (1) Bước chuẩn hoá văn bản trước TTS, độc lập nhà cung cấp, kèm bảng đọc `401(k)`, `S&P 500`, `APR/ETF/HSA/IRA`, `FICO` | `audio/AU-007` |
| (2) Thử 5 nhà cung cấp × 2 giọng · (3) kiểm tự động ASR/timestamp/12 phút/điều khoản · (4) gói nghe mù, trần **30 USD** | `audio/AU-008` |
| Kiến trúc (a) công đoạn giọng mỗi tập · (b) chọn giọng là module kiểm định tái sử dụng | `audio/AU-007` (a) và `audio/AU-008` (b) |
| Thuế khấu trừ 30% doanh thu từ Mỹ — mọi ước tính doanh thu trong Channel Pack tính sau khấu trừ | `topic/T-013` |
