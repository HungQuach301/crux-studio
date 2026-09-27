# 🤖 Phiếu chấm 30fps / 60fps — mục `assembly/A-007`

> Chỗ đậu câu trả lời: **issue `🤖 [QĐ]` [#317](https://github.com/HungQuach301/crux-studio/issues/317)**
> (nhãn `decision` + `reversible`). File này là bản trong repo của cùng một phiếu.
>
> File này **viết tay**, khác `docs/assembly/render-trial.md` (file đó do
> `ops/scripts/render-trial.ts --report` **sinh ra**, đừng sửa tay).
>
> Giả định chịu tải liên quan: **G5** (`docs/assumptions.md`) — xem mục 4, mục
> này **không** đóng ô ⬜ nào của G5.

Mục này trả lời nửa câu hỏi mà `assembly/A-001` không tự trả lời được:
**"30fps có xem được không"**. `WP-003` mục 5 giao nửa đó cho mắt chủ dự án và
ghi thẳng *"Không kết luận thay chủ dự án về chỉ số 4–6"* — nên ở đây chỉ có
clip, số đo, và một bảng để điền. Không có kết luận.

---

## 1. Hai clip

**Tải về:** https://github.com/HungQuach301/crux-studio/actions/runs/36323906641/artifacts/10933252529

Một file zip **0,90 MB** (`896 011` byte) chứa cả hai clip cộng `measurements.json`
và `render-trial.md` của lượt đó.

| File | fps | Khung hình | Độ phân giải | Thời lượng | Dung lượng |
|---|---|---|---|---|---|
| `proof-30.mp4` | **30** | 600 | 960×540 | 20,0 s | 0,42 MB |
| `proof-60.mp4` | **60** | 1200 | 960×540 | 20,0 s | 0,49 MB |

Mọi số MB trong file này là **MB thập phân** (byte ÷ 10⁶).

**Cùng một nội dung**, sinh từ **cùng một clip nguồn** (20 s @ 60fps, `sceneFilter`
của `render-trial.ts`) trong **cùng một lượt runner** — nên chênh lệch duy nhất
giữa hai file là tần số khung.

Nội dung: nền chuyển sắc động · lưới mảnh 1px · tám cột đổi chiều cao liên tục ·
một con số đếm · chữ cạnh sắc · và **máy quay trôi ngang chậm không nghỉ**
(`crop` theo `t`, quy tắc `D-04`). Đó đúng là dải tốc độ mà rủi ro **R5** lo:
*"chuyển động bị giật ở tần số khung đã chọn"*, và cạnh sắc cùng chữ là chỗ
giật lộ rõ nhất.

### ⚠️ Vì sao 20 giây chứ không phải 30

Bản đầu của mục này dựng **30 giây** và vòng soát ngữ cảnh sạch bắt được một
chỗ hỏng thật: clip nguồn dài đúng 20 s, nên `streamLoopFlag(30000, 20) = 1`
(`render-trial.ts:158-161`) làm ffmpeg **phát lại clip nguồn** và ở giây thứ 20
cảnh **nhảy ngược về đầu**. Đo bằng `scdet` (MAFD giữa hai khung liền nhau):

| Clip | trung vị | ĐỈNH | tại | giá trị kế tiếp |
|---|---|---|---|---|
| 30 s, `proof-30` | 0,348 | **14,009** | t = 20,067 s | 0,892 |
| 30 s, `proof-60` | 0,173 | **13,991** | t = 20,000 s | 0,729 |
| **20 s, `proof-30`** | 0,292 | **0,892** | t = 4,3 s | 0,877 |
| **20 s, `proof-60`** | 0,146 | **0,729** | t = 2,03 s | 0,724 |

Ở bản 30 s, cú nhảy đó lớn gấp **40×** chuyển động thật — tức thứ giật nhất
trong cả clip là **tạo tác của bộ đo**, không phải của tần số khung, và nó nằm
ngay giữa đoạn anh được yêu cầu chấm. Ở bản 20 s (`streamLoopFlag = 0`, không
lặp) đỉnh bằng đúng giá trị kế tiếp — **không còn điểm bất thường nào**.

⛔ **Lượt 30 giây cũ ([run 36322330099](https://github.com/HungQuach301/crux-studio/actions/runs/36322330099))
đã bị thay thế, đừng dùng để chấm.** Nó còn sống tới `2026-10-04` nên phải nói
rõ ở đây, không chỉ xoá link đi.

### ⏳ Hạn sống của link

| | |
|---|---|
| Artifact tạo lúc | `2026-09-27T13:55:03Z` |
| **Link chết sau** | **`2026-10-04T13:55:02Z`** (`retention-days: 7`) |

Hết hạn thì **dựng lại**, đừng sửa bảng này bằng tay:

```
Actions → render-trial → Run workflow
  config = all · duration-ms = 20000 · upload-master = false
```

⚠️ **`duration-ms` phải là bội số của 20000** (`SOURCE_SECONDS = 20`), nếu không
mối nối vòng lặp quay lại — xem bảng MAFD ở trên.

Lượt đã dùng: [run 36323906641](https://github.com/HungQuach301/crux-studio/actions/runs/36323906641)
(`workflow_dispatch` trên `main` `cd1ee5e`).

---

## 2. Phiếu chấm

Mở `proof-30.mp4` **trước**. Xem hết 20 giây. Nhìn vào **chữ** và **cạnh cột**
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

### Rủi ro B11 — phần *xem* nằm trong 60 giây, phần *lấy clip* thì không

Cái bảng trên điền được trong khoảng 60 giây. Nhưng để tới được nó, anh phải:
mở link Actions → tải **zip** → giải nén → phát hai file mp4. Actions artifact
**luôn** là zip, và GitHub Mobile không giải nén được, nên bước này cần trình
duyệt đã đăng nhập chứ không làm gọn trên điện thoại được.

`CLAUDE.md` mục 12 cho **hai** đường — *"Actions artifact **hoặc Releases**"* —
và mục này chọn Actions artifact, tức đường **khó hơn** cho người chấm. Lý do:
một Release asset cho URL file trực tiếp (phát inline được trên điện thoại)
nhưng cần sửa `ops/workflows/render-trial.yml`, mà workflow chỉ có hiệu lực
**sau khi PR merge** rồi `sync-workflows` chép sang `.github/` (CHARTER 3.2,
giả định **G10**) — nên nó không giao được clip trong chính lượt này. Khai ra
thay vì để nó thành một `✅` giả; nếu anh thấy bước tải-giải nén là rào cản thật
thì đó là một mục backlog cho `A-008` hoặc cho làn `release`.

---

## 3. Chỉ số 5 chưa chấm được

`WP-003` mục 5 có **ba** chỉ số chờ mắt chủ dự án:

| # | Chỉ số | Clip |
|---|---|---|
| 4 | 30fps **không** mờ chuyển động | ✅ `proof-30.mp4` |
| 5 | 30fps **có** mờ chuyển động | ❌ **không có** |
| 6 | 60fps không mờ chuyển động | ✅ `proof-60.mp4` |

`ops/scripts/render-trial.ts` **không có đường sinh mờ chuyển động** — đo bằng
`grep -nE 'motion.blur|motionBlur|tmix|minterpolate'` trên file đó: **0 dòng**
(thoát 1). Sáu cấu hình của `CONFIGS` (`decode-30/60`, `master-30/60`,
`proof-30/60`) khác nhau ở fps, độ phân giải, `crf` và `preset` — không cái nào
bật mờ chuyển động.

**Vì sao không thêm nó ở đây.** `render-trial.ts` là **bộ đo của `A-001`**, mà
`A-001` đang `review` chờ đúng chủ dự án chấm. Thêm một cấu hình thứ bảy làm
`--config all` đổi nghĩa, và số đo đã đăng trong `docs/assembly/render-trial.md`
không còn so thẳng được với lượt sau — tức là làm hỏng nửa bằng chứng đã có để
lấy nửa chưa có. Tách thành mục riêng **`assembly/A-008`**.

Chỉ số 5 chỉ đáng hỏi khi câu trả lời cho phiếu trên là **B**: nó hỏi *"mờ
chuyển động có cứu được 30fps không"*, và câu đó vô nghĩa nếu 30fps vốn đã xem
được. Vì vậy `A-008` mang `- hold:` chờ `#317 = B`, không nằm sẵn trong
`readyNow`.

---

## 4. Cái mục này KHÔNG làm

- **Không siết `fpsAllowed`.** Chốt fps là việc của `A-001` **sau khi** có phiếu
  chấm này. Siết trước là chốt bằng một nửa bằng chứng — đúng thứ `A-001` đã từ
  chối làm.

- **Clip lệch `WP-003` §3b, và đây là chỗ phải đọc kỹ.** Spec đòi clip thử
  *"**3 phút** gồm: trôi ngang chậm qua biểu đồ cột · **zoom vào một con số** ·
  **morph giữa hai trạng thái của cùng dữ liệu** · quay lại một vùng đã xem"*.
  Clip ở đây dài **20 giây**, và `sceneFilter` chỉ có **trôi ngang** cộng cột
  đổi chiều cao — **không zoom, không morph, không quay lại vùng cũ**. Mà zoom
  và morph là hai chuyển động **nhanh nhất** trong danh sách, tức đúng chỗ 30fps
  dễ giật nhất. Nên một câu trả lời **A** ở phiếu trên nghĩa là *"30fps xem được
  ở dải chuyển động chậm"*, **không** phải *"30fps xem được ở mọi chuyển động
  `D-04` cho phép"*. Phương án **C** của `#317` là chỗ đậu nếu anh muốn một clip
  đủ bốn loại chuyển động trước khi chốt.

- **Không trả lời ô ⬜ "phút Actions tính tiền" của `A-001`, và không đụng giả
  định G5.** Lượt runner này dựng **20 giây**, không phải một tập đầy đủ 21 phút
  (`targetDurationMs` của genre pack `data-explainer`).

  | | |
  |---|---|
  | Runner | `ubuntu-latest` (hệ số 1×) |
  | `run_duration_ms` (API) | **158 000** (≈ 158 s) |
  | Phút **tường** làm tròn lên | **3** — đây là *ước tính hoá đơn*, không phải số hoá đơn |
  | `billable.UBUNTU.total_ms` (API) | **0** |

  ⚠️ **Nguồn tính tiền máy đọc được đang trả `0`.** Gọi
  `/actions/runs/36323906641/timing` cho `billable.UBUNTU.total_ms = 0`,
  `jobs: 1`, `job_runs[0].duration_ms = 0` — lượt 30 giây trước đó (run
  36322330099) cũng vậy. Nên con số **3** ở trên là **giây tường làm tròn lên**,
  không phải phút hoá đơn; bất biến **I6** đòi mỗi con số hiển thị có nguồn, và
  nguồn của nó là đồng hồ, không phải hoá đơn. Số hoá đơn thật phải lấy từ trang
  billing của tài khoản.

  Ngoại suy tuyến tính từ 20 giây lên 21 phút cũng **sai** — phần cài phụ thuộc
  và sinh clip nguồn gần như cố định, còn phần mã hoá thì không tuyến tính. Ô ⬜
  của `A-001` vẫn cần một lượt `duration-ms` đầy đủ, và G5 giữ nguyên trạng thái
  `đã kiểm một phần`.

- **Không công khai gì ra ngoài.** Clip nằm trong Actions artifact của chính kho
  này, chỉ người có quyền đọc kho mới tải được. Bất biến **I5** không liên quan
  ở đây, và không có đường nào từ mục này ra YouTube.

---

## 5. Hai chỗ nhóm Z mục này KHÔNG bịt được

Khai ra thay vì để chúng im (`ops/known-failures.md` nhóm **Z**: hỏng mà mọi chỉ
báo đều xanh). Cả hai đo được, không phải lo xa:

1. **Xoá hẳn file này thì `pnpm check` vẫn XANH.** Đo thật: `mv` file đi rồi
   chạy trọn `pnpm check` → EXIT=0, 1779/1779 pass, tập vàng khớp snapshot.
   Không file `.ts`/`.yml`/`.json` nào nhắc `fps-scorecard`; chỉ markdown nhắc
   markdown. Hai ô ✅ trong `ops/lanes/assembly/backlog.md` vẫn khẳng định nó
   tồn tại.
2. **Hạn sống của artifact không có máy nào canh.** Sau `2026-10-04T13:55:02Z`,
   link ở mục 1 chết, nhưng `- hold:` vẫn trỏ vào nó, `status: review` vẫn
   nguyên, mọi ✅ vẫn ✅, `pnpm check` vẫn xanh, và **không dấu hiệu nào trong 8
   dấu hiệu của `watchdog.yml`** nói về hạn artifact. Chính trường `risk:` của
   `A-007` đã viết ra đúng chỗ hỏng này (*"link chết thì mục trông như đã làm mà
   anh vẫn không chấm được"*) — và mục này ship mà chưa bịt được nó.

Cộng một chỗ thứ ba, ở phía bản tin: hàng `#317` chỉ vào được khối *"Việc đang
chờ anh"* nhờ `decisionNeedsOwnerHand` khớp chuỗi **`mắt anh`** trong thân
issue. Viết cùng ý đó thành *"mắt chủ dự án"* thì hàm trả `false` và mục biến
mất khỏi bản tin, không gì đỏ. Chi tiết và số đo nằm trong ô tương ứng của
`ops/lanes/assembly/backlog.md`.
