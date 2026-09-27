# 🤖 Phiếu chấm 30fps / 60fps — mục `assembly/A-007`

> Chỗ đậu câu trả lời: **issue `🤖 [QĐ]` [#317](https://github.com/HungQuach301/crux-studio/issues/317)**
> (nhãn `decision` + `reversible`). File này là bản trong repo của cùng một phiếu.
>
> File này **viết tay**, khác `docs/assembly/render-trial.md` (file đó do
> `ops/scripts/render-trial.ts --report` **sinh ra**, đừng sửa tay).

Mục này trả lời nửa câu hỏi mà `assembly/A-001` không tự trả lời được:
**"30fps có xem được không"**. `WP-003` mục 5 giao nửa đó cho mắt chủ dự án và
ghi thẳng *"Không kết luận thay chủ dự án về chỉ số 4–6"* — nên ở đây chỉ có
clip, số đo, và một bảng để điền. Không có kết luận.

---

## 1. Hai clip

**Tải về:** https://github.com/HungQuach301/crux-studio/actions/runs/36322330099/artifacts/10932817076

Một file zip **1,4 MB** (`1 399 433` byte) chứa cả hai clip cộng `measurements.json`
và `render-trial.md` của lượt đó.

| File | fps | Khung hình | Độ phân giải | Thời lượng | Dung lượng |
|---|---|---|---|---|---|
| `proof-30.mp4` | **30** | 900 | 960×540 | 30,0 s | 0,63 MB |
| `proof-60.mp4` | **60** | 1800 | 960×540 | 30,0 s | 0,73 MB |

**Cùng một nội dung**, sinh từ **cùng một clip nguồn** (20 s @ 60fps, `sceneFilter`
của `render-trial.ts`) trong **cùng một lượt runner** — nên chênh lệch duy nhất
giữa hai file là tần số khung.

Nội dung: nền chuyển sắc động · lưới mảnh 1px · tám cột đổi chiều cao liên tục ·
chữ cạnh sắc · và **máy quay trôi ngang chậm không nghỉ** (`crop` theo `t`, quy
tắc `D-04`). Đó đúng là dải tốc độ mà rủi ro **R5** lo: *"chuyển động bị giật ở
tần số khung đã chọn"*, và cạnh sắc cùng chữ là chỗ giật lộ rõ nhất.

### ⏳ Hạn sống của link

| | |
|---|---|
| Artifact tạo lúc | `2026-09-27T13:28:17Z` |
| **Link chết sau** | **`2026-10-04T13:28:16Z`** (`retention-days: 7`) |

Hết hạn thì **dựng lại**, đừng sửa bảng này bằng tay:

```
Actions → render-trial → Run workflow
  config = all · duration-ms = 30000 · upload-master = false
```

Lượt đã chạy: [run 36322330099](https://github.com/HungQuach301/crux-studio/actions/runs/36322330099)
(`workflow_dispatch` trên `main` `cd1ee5e`).

---

## 2. Phiếu chấm — điền trong khoảng 60 giây

Mở `proof-30.mp4` **trước**. Xem hết 30 giây. Nhìn vào **chữ** và **cạnh cột**
lúc máy quay đang trôi.

| # (WP-003) | Clip | Câu hỏi | Chọn một |
|---|---|---|---|
| **4** | `proof-30.mp4` | 30fps, **không** mờ chuyển động — clip xem được không? | ⬜ mượt · ⬜ hơi gợn, chấp nhận được · ⬜ giật rõ |
| **6** | `proof-60.mp4` | 60fps, không mờ chuyển động — clip xem được không? | ⬜ mượt · ⬜ hơi gợn, chấp nhận được · ⬜ giật rõ |
| — | cả hai | Chốt tần số khung nào? | ⬜ **A** 30fps · ⬜ **B** 60fps · ⬜ **C** chưa quyết được |

Không thấy gợn ở chỉ số 4 thì **không cần mở clip 60fps** — trả lời **A** là đủ.

**Cách trả lời:** một comment dạng `#317 A` (thay `A` bằng `B`/`C`), ở issue
`#317` **hoặc** ở issue bản tin sáng. Hai chỗ ngang giá trị (`D-C06`,
`CLAUDE.md` mục 5).

---

## 3. Chỉ số 5 chưa chấm được

`WP-003` mục 5 có **ba** chỉ số chờ mắt chủ dự án:

| # | Chỉ số | Clip |
|---|---|---|
| 4 | 30fps **không** mờ chuyển động | ✅ `proof-30.mp4` |
| 5 | 30fps **có** mờ chuyển động | ❌ **không có** |
| 6 | 60fps không mờ chuyển động | ✅ `proof-60.mp4` |

`ops/scripts/render-trial.ts` **không có đường sinh mờ chuyển động** — đo bằng
`grep -n 'motion.blur\|motionBlur\|tmix\|minterpolate'` trên file đó: **0 dòng**.
Sáu cấu hình của `CONFIGS` (`decode-30/60`, `master-30/60`, `proof-30/60`) khác
nhau ở fps, độ phân giải, `crf` và `preset` — không cái nào bật mờ chuyển động.

**Vì sao không thêm nó ở đây.** `render-trial.ts` là **bộ đo của `A-001`**, mà
`A-001` đang `review` chờ đúng chủ dự án chấm. Thêm một cấu hình thứ bảy làm
`--config all` đổi nghĩa, và số đo đã đăng trong `docs/assembly/render-trial.md`
không còn so thẳng được với lượt sau — tức là làm hỏng nửa bằng chứng đã có để
lấy nửa chưa có. Tách thành mục riêng **`assembly/A-008`**.

Chỉ số 5 chỉ đáng hỏi khi câu trả lời cho phiếu trên là **B**: nó hỏi *"mờ
chuyển động có cứu được 30fps không"*, và câu đó vô nghĩa nếu 30fps vốn đã xem
được.

---

## 4. Cái mục này KHÔNG làm

- **Không siết `fpsAllowed`.** Chốt fps là việc của `A-001` **sau khi** có phiếu
  chấm này. Siết trước là chốt bằng một nửa bằng chứng — đúng thứ `A-001` đã từ
  chối làm.
- **Không trả lời ô ⬜ "phút Actions thật" của `A-001`, và không đụng tới giả
  định G5.** Lượt runner này dựng **30 giây** (`duration-ms=30000`), không phải
  một tập đầy đủ 21 phút (`targetDurationMs` của genre pack `data-explainer`).
  Con số dưới đây là của một lượt 30 giây, **không** phải ngân sách G5:

  | | |
  |---|---|
  | Runner | `ubuntu-latest` (hệ số 1×) |
  | Cả job, tường | `2026-09-27T13:25:19Z` → `13:28:18Z` = **179 s** |
  | Riêng phần dựng sáu cấu hình | `13:25:48Z` → `13:28:16Z` = **148 s** |
  | Phút tính tiền, làm tròn lên | **3** |

  Ngoại suy tuyến tính từ 30 giây lên 21 phút là **sai** — phần cài phụ thuộc và
  sinh clip nguồn gần như cố định, còn phần mã hoá thì không tuyến tính. Ô ⬜ của
  `A-001` vẫn cần một lượt `duration-ms` đầy đủ, và G5 giữ nguyên trạng thái
  `đã kiểm một phần`.
- **Không công khai gì ra ngoài.** Clip nằm trong Actions artifact của chính kho
  này, chỉ người có quyền đọc kho mới tải được. Bất biến **I5** không liên quan
  ở đây, và không có đường nào từ mục này ra YouTube.
