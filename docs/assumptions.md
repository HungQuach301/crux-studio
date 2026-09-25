# 🤖 Sổ giả định

> **Đây không phải nguồn thẩm quyền** (CHARTER mục 0). Sổ này ghi lại những điều charter đang **giả định** về nền tảng và nhà cung cấp, cùng trạng thái đã kiểm hay chưa.

Charter được viết dựa trên hiểu biết về Claude, GitHub và YouTube tại thời điểm soạn. Một số hiểu biết trong đó **có thể sai**, hoặc sẽ sai khi nền tảng thay đổi. Bản C1 đã có ba nhận định sai và phải sửa trước khi triển khai. Sổ này tồn tại để lần sau không phải sửa cả charter mới tìm ra được cái gì bị ảnh hưởng.

## Bốn luật (CHARTER 11.1)

1. **Mọi giả định chịu tải đều có sổ**, và mỗi phần của code hay tài liệu dựa vào một giả định phải **ghi mã giả định đó ngay tại chỗ**. Cột *Phần phụ thuộc* dưới đây được `pnpm assumptions` kiểm: file nào được liệt kê mà không nhắc tới mã giả định thì CI đỏ.
2. **Kiểm trước, dựa vào sau.** Không mục backlog nào được xây trên một giả định có độ tin cậy `suy luận` khi chưa kiểm xong. Ngoại lệ duy nhất: phương án dự phòng đã được **viết sẵn**, không phải đã được nghĩ tới.
3. **Kiểm bằng chạy thật.** Đọc tài liệu chỉ cho trạng thái `tài liệu nói vậy` — và cả ba nhận định sai của bản C1 đều là loại đó.
4. **Khi một giả định hoá ra sai:** ghi trạng thái `sai` → có dự phòng thì chuyển ngay (quyết định `reversible`, ghi vào bản tin) → chưa có thì mở `🤖 [QĐ]` **kèm danh sách phần bị ảnh hưởng lấy từ cột dưới** → sửa CHARTER bằng PR `owner-merge` và ghi vào nhật ký thay đổi.

Routine `crux-integrator` chạy lại các kiểm tra tự động của sổ này **mỗi thứ Hai** (phụ lục P3). Lý do: nhiều tính năng đang ở giai đoạn research preview và có thể đổi bất cứ lúc nào (rủi ro B6).

**Một lệnh duy nhất cho việc đó** (mục `I-003`):

```bash
pnpm recheck:assumptions
```

Lệnh này chạy lại **bài kiểm** của những giả định tự khai `**Kiểm tự động:**` ở mục của mình, và in ra hai loại kết luận: `khớp` (quan sát đúng như sổ ghi) và `sai` (quan sát ngược với sổ). Với mỗi giả định `sai` nó **in sẵn thân issue `🤖 [QĐ]` kèm danh sách phần bị ảnh hưởng**, lấy nguyên từ cột *Phần phụ thuộc* của chính giả định đó. Bài kiểm chạy được nhưng không có gì để quan sát thì mang dấu riêng `◦ chưa quan sát được`, không phải `✓` — hai thứ đó in giống nhau thì một bài kiểm không bao giờ chạy trông y hệt một bài kiểm luôn xanh. Bài kiểm **chưa chạy được** (thiếu đầu vào, ví dụ chưa có ref nào để quét) là loại thứ ba, và nó KHÔNG được mang dấu `◦`: nó ra `⚠ … KHÔNG CHẠY ĐƯỢC` và lệnh thoát khác 0 (mục `I-005`). Giả định nào không tự kiểm được thì được liệt kê thành "cần người", không im lặng bỏ qua.

Đừng nhầm với `pnpm assumptions`: lệnh kia kiểm **truy vết** (sổ có đủ mục không, file liệt kê có nhắc mã không) và chạy trong `pnpm check` ở mọi PR. Lệnh này kiểm **nội dung** — điều sổ đang khẳng định về nền tảng còn đúng không — nên nó **không** nằm trong `pnpm check`: một giả định hoá ra sai không được phép chặn mọi làn (CHARTER mục 4).

## Thang độ tin cậy

| Độ tin cậy | Nghĩa |
|---|---|
| `đã kiểm` | Đã chạy thật, có bằng chứng ghi kèm ngày |
| `đã kiểm một phần` | Chạy thật trong một ngữ cảnh, chưa chạy trong ngữ cảnh mà charter thực sự dựa vào |
| `tài liệu nói vậy` | Đọc tài liệu chính thức. **Chưa đủ để dựa vào** theo luật 3 |
| `suy luận` | Chưa có nguồn nào xác nhận. Không được xây gì lên trên khi chưa có dự phòng viết sẵn |
| `sai` | Đã kiểm và kết quả ngược với giả định. Chuyển sang dự phòng ngay |

---

## Bảng tổng

| Mã | Giả định | Độ tin cậy | Trạng thái | Mục kiểm |
|---|---|---|---|---|
| G1 | Tài khoản có Claude Code Projects | `suy luận` | mệnh đề CHƯA kiểm được; hệ quả vận hành đã đo và đã có bài kiểm canh | `VF-G1` |
| G2 | `automerge.yml` merge được bằng `GITHUB_TOKEN` và gọi được `main-ci` | **`đã kiểm một phần`** | lõi DoD đã kiểm, `labels`/`sync-workflows` chưa | DoD Đợt 0, `VF-G2` |
| G3 | Trần số lần chạy routine mỗi ngày đủ cho 2–3 worker cộng 2 routine | `suy luận` | giao làn `verify` | `VF-G3` |
| G4 | Hạn mức gói Claude chịu được 3 worker song song | `suy luận` | giao làn `verify` | `VF-G4` |
| G5 | Quota phút Actions và dung lượng artifact đủ cho việc render | **`đã kiểm một phần`** — nửa **dựng** (`A-001`) và nửa **sinh khung** (`V-002`) đều đã đo; phút Actions **tính tiền** thì chưa | số đo ở `docs/assembly/render-trial.md` và `spike/canvas/RESULT.md`; chờ chạy `render-trial.yml` và `spike-canvas.yml` sau merge | `VF-G5`, `A-001`, `V-002` |
| G6 | App YouTube API chưa qua kiểm tuân thủ thì video tải lên bị khoá riêng tư | `tài liệu nói vậy` | không cần đổi gì | `VF-G6` |
| G7 | Điều khoản TTS, stock, font, bản đồ cho phép dùng thương mại và B2B | **`đã kiểm một phần`** — xong cho giấy phép font `OFL-1.1`; TTS, stock, bản đồ **không đọc được từ phiên cloud** | `VF-G7` `parked` · **vẫn chặn** làn `audio` | `VF-G7`, `AU-001` |
| G8 | Có đường nhận tiền và nộp thuế cho người ở Việt Nam | **`tài liệu nói vậy`** — đọc trang của bên có thẩm quyền ở cả hai đầu; chưa chạy thật đường tiền nào | đường đi **có** trên giấy · còn treo 4 chỗ · chặn ở Mốc 8 · Mỹ giữ **30%** vì chưa có hiệp định **đang có hiệu lực** | `VF-G8` |
| G9 | Thuê được người soát bản địa và giao việc qua link | **`đã kiểm một phần`** — nửa "giao việc qua link" chạy thật; nửa "thuê được người" chưa | hai kênh tuyển có thật, **trang của chính họ ghi là miễn phí cho bên thuê** (EFA, ACES) · link tới repo private **không** dùng được · xuất bản ra ngoài là `irreversible` | `VF-G9` |
| G10 | Phiên cloud **không** ghi được `.github/workflows` | `tài liệu nói vậy` | đang dựa vào, có sync | `VF-G10` |
| G11 | Hook và luật deny có hiệu lực trong routine và thread | **`đã kiểm`** phần routine; thread chưa | lớp thứ hai vẫn giữ | `VF-G11` |
| G12 | Ruleset bảo vệ nhánh trên repo private cần gói GitHub Pro | **`đã kiểm`** — ruleset `protect-main` đang bật thật trên repo này | **dự phòng không cần dùng** · 5 tên check nay chịu tải | `VF-G12` |
| G13 | GitHub Actions gọi được API trigger `/fire` của routine | `tài liệu nói vậy` | hoãn tới Đợt 1 | `VF-G13` |
| G14 | Commit của routine và thread có trailer `Claude-Session` | **`đã kiểm một phần`** | CI chỉ cảnh báo | `VF-G14` |
| G15 | Các mục 1–19 trong Phần L của spec tham chiếu | theo từng mục | `parked` | `VF-G15` |
| G16 | Phiên cloud và routine chạy trọn mà không cần người bấm cấp quyền | `suy luận` | dự phòng đã viết sẵn | `VF-G16` |
| G17 | `merge=union` làm xung đột file log biến mất trong vận hành thật | **`sai`** | **đã chuyển dự phòng** | `VF-G17` |
| G18 | `pnpm install --lockfile-only` giữ nguyên phép phân giải cũ của lockfile bản mồi | **`đã kiểm`** | đang dùng | `VF-G18` |
| G19 | `search.list` của YouTube Data API cho 100 lần gọi mỗi ngày, bucket riêng với `videos.insert` | `tài liệu nói vậy` | dự phòng đã viết sẵn · chặn phần XÂY corpus, không chặn phần đã làm của `T-008` | `VF-G19` |
| G20 | Bảng giá `$/1M token` của API embeddings OpenAI, và `usage.total_tokens` trả về là số được tính tiền | `tài liệu nói vậy` | dự phòng đã viết sẵn · số nằm trong dữ liệu, `costUsd` thật đọc từ phản hồi | `VF-G20` |

**`G12` đã kiểm xong ngày 2026-09-21** (mục `VF-G12`): ruleset `protect-main` đang bật thật, `main` trả `protected: true`, và `automerge.yml` vẫn merge được bằng `GITHUB_TOKEN` sau khi bật. Dự phòng không phải dùng, nhưng **không gỡ**. Đổi lại, năm **tên** status check nay chịu tải — xem mục `G12`.

**Một giả định đang ở trạng thái `sai`: G17.** Đã chuyển sang dự phòng, chi tiết ở mục của nó. Ba giả định khác (`G2`, `G7`, `G14`) đã kiểm được một phần — cũng ở dưới; `G2` và `G14` ngay trong Đợt 0. `G7` là ca đáng chú ý nhất: phần chưa kiểm không phải vì chưa ai làm, mà vì **phiên cloud không ra được các trang điều khoản** (mục `VF-G7`). `G11` đã kiểm **xong** phần routine ngày 2026-09-21, mục `VF-G11`.

> Mã `G16` từng được **nhận trước** cho PR #11 trong lúc PR #15 viết `G17`, nên có một quãng bảng này nhảy từ G15 sang G17. Hai PR gộp vào nhau xong thì đủ cả hai, không ai mất số. Nhận mã trước khi viết là cách duy nhất để hai worker không cùng lấy một số (xem KF-005).

---

## G1 · Tài khoản có Claude Code Projects

- **Nội dung:** tài khoản của chủ dự án có tính năng Claude Code Projects, nên thread do Project khởi chạy được song song với routine.
- **Nguồn:** chưa có. Đây là suy luận từ mô tả sản phẩm.
- **Độ tin cậy:** `suy luận` — **không đổi**, và đây là chỗ dễ nhầm nhất của mục này.

  Lượt `VF-G1` ngày 2026-09-21 đo được nhiều thứ, nhưng **không phần nào của chính mệnh đề "tài khoản có Claude Code Projects" được kiểm**. Thứ đo được là một *hệ quả* mà phụ lục P1 treo lên G1, và hệ quả ấy **không phân biệt được** Projects với ba routine hourly rời nhau. Nâng lên `đã kiểm một phần` (bản đầu của lượt này đã làm, vòng soát chéo bắt lại) là nới một cổng thật: CHARTER 11.1 luật 2 cấm xây mục backlog trên giả định còn `suy luận`, nên đổi nhãn sẽ mở cổng đó ra bằng bằng chứng không đỡ nổi nó. Khác với `G2`, nơi phần lõi của **chính mệnh đề** đã chạy thật.
- **Phần phụ thuộc:** `CLAUDE.md` · `ops/lanes/verify/backlog.md` · `ops/scripts/recheck-assumptions.ts` · CHARTER phụ lục P1 (số worker và nhịp chạy)
- **Cách kiểm:** mở `claude.ai/code`, xem có tạo được Project không. **Chỉ chủ dự án làm được** — agent không thấy trang cấu hình tài khoản.
- **Dự phòng:** Plan B — chỉ dùng routines. Nhịp chạy chuyển sang cấu hình mặc định của P1: 2 worker, preset hourly. Không mất gì về mặt kiến trúc, chỉ chậm hơn.

**Giả định này có hai vế, và chỉ một vế kiểm được từ trong repo.** Tách ra vì gộp lại thì vế đo được bị vế không đo được giữ mãi ở `suy luận`:

| Vế | Kiểm được từ repo? | Trạng thái |
|---|---|---|
| (a) Tài khoản **có tính năng** Claude Code Projects | **không** — trang cấu hình tài khoản | vẫn `suy luận`, hỏi ở issue [#5](https://github.com/HungQuach301/crux-studio/issues/5) |
| (b) **Hệ quả vận hành** mà phụ lục P1 treo lên G1: chạy được cấu hình 3 worker hay phải lùi về Plan B 2 worker | **có** — `ops/logs/**` (bất biến I8) | **đã kiểm, 2026-09-21** |

- **Bằng chứng cho vế (b), 2026-09-21 (lượt `crux-worker-2`), đo từ `ops/logs/**`, không đọc tài liệu:** **ba** worker chạy thật trong cửa sổ quan sát — `crux-worker-1` (4 lượt), `crux-worker-2` (8 lượt), `crux-worker-3` (5 lượt) — cộng `crux-integrator` 13 lượt, nhịp **trung vị 1,0 giờ** (8 trên 12 khoảng cách nằm trong 0,9–1,1 giờ; bốn khoảng còn lại 1,9 / 2,9 / 1,1 / 1,0 — phần lệch là các lượt không để lại dòng log, xem giới hạn (1) ngay dưới). Tức là **cấu hình 3 worker đang chạy**.

  **Đọc đúng phạm vi của kết luận này — Plan B có hai vế:** "chỉ dùng routines" **và** "2 worker, preset hourly". Quan sát trên bác được **đúng vế sau** (không phải 2 worker). Vế "chỉ dùng routines" thì nó **không** bác được, và còn tương thích hoàn toàn với Plan B: thứ đo được là các routine tên `crux-worker-<N>` — đúng tên routine của phụ lục P1 — chạy ở độ phân giải giờ. Nói "Plan B chưa phải dùng tới" là vượt bằng chứng; nói đúng phải là **phần "2 worker" của Plan B không mô tả hiện trạng**.
- **Giới hạn của bằng chứng, khai trước:**
  1. Con số là **cận dưới, không phải số đúng**. Phụ lục P1 bước 3 bảo worker không nhận được mục nào thì in `idle` và kết thúc **không commit gì** — lượt đó không để lại dòng log. Khoảng cách 7,0 / 5,0 / 4,1 giờ giữa các lượt quan sát được gần như chắc chắn là các lượt `idle` không ghi gì, chứ không phải routine đứng im.
  2. Vì (1), **nhịp thật của từng worker không chốt được** từ log. Nhịp trung vị đo được của ba worker là 4,0 / 2,0 / 2,6 giờ, nhưng các khoảng 7,0 và 7,2 giờ xen giữa những khoảng 0,9 giờ cho thấy đó là khoảng cách giữa các lượt **có ghi log**, không phải nhịp chạy. Chốt được đúng một điều: có ít nhất ba worker, và chúng chạy ở độ phân giải giờ chứ không phải 3 giờ một lượt như phụ lục P1 mô tả cho cấu hình 3 worker.
  3. **Một dòng log tính cho đúng một routine — tên xuất hiện đầu tiên**, vì dòng log mở bằng chính routine viết nó. Bản đầu của bài kiểm đếm *mọi* tên nhắc trong `note` và sai ngay ở dòng log đầu tiên của chính mục này: dòng ấy **kể lại** số lượt của cả bốn routine nên tự tính thành một lượt cho từng routine. Báo cáo worker nhắc tên routine khác là chuyện thường (bước 0 của phụ lục P3 luôn nhắc `crux-integrator`), nên lỗi đó sẽ lặp mãi nếu không chặn. Luật "tên đầu tiên" sai theo chiều **an toàn**: nó chỉ làm phép đếm nhỏ đi, nên không bao giờ che được một đội đã tụt về Plan B.
  3. Quan sát này **không** chứng minh vế (a). Ba routine hourly rời nhau cho đúng cùng một quan sát. Nó chỉ nói cấu hình đang chạy là cấu hình nào, và đó đúng là thứ phụ lục P1 cần biết.
- **Kiểm tự động:** `worker-fleet-cadence` — **bài kiểm này canh vế dự phòng, không đi chứng minh mệnh đề**, đúng cùng kiểu với bài kiểm của `G17` ("không đi tìm lại kết luận đã có, mà canh các điều kiện dự phòng đang đứng lên trên"). Nó đọc `ops/logs/**` bằng `readRunLogs` của kernel (không tự `cat`: thứ tự dòng trong file không mang nghĩa), gom các dòng log nhắc tên routine thành từng **lượt** (hai dòng cách nhau quá 50 phút là hai lượt), rồi đếm số worker rời nhau trong cửa sổ 7 ngày tính lùi từ dòng log **mới nhất**.

  Cửa sổ neo vào dòng log mới nhất chứ không vào `now`: neo vào `now` thì một bản clone cũ, hoặc một tuần repo nằm yên, tự đẩy bài kiểm sang `sai` vì một lý do chẳng dính gì tới G1.

  Chiều kết luận hẹp có chủ đích, theo đúng giới hạn (1) ở trên: **≥ 3 worker → `khớp`** (cấu hình 3 worker còn sống); **1–2 worker mà cửa sổ vẫn có dòng nhắc routine → `sai`** (đội đã tụt về Plan B, phụ lục P1 và sổ đang ghi một cấu hình không còn tồn tại); **không dòng nào nhắc routine → `◦ chưa quan sát được`, không phải `khớp`** — tên routine nằm trong `note` dạng văn xuôi, nên đổi quy ước ghi `note` phải ra "chưa quan sát được", không được ra "vẫn ổn". Đây là cùng bài học fail-open của danh sách trắng `isToolCommit` ở mục `G14`.

  Thiếu hẳn thư mục `ops/logs/` thì bài kiểm **ném lỗi** và ra `⚠ … KHÔNG CHẠY ĐƯỢC` (mục `I-005`), không ra `◦`: `listLogFiles` của kernel trả mảng rỗng cho thư mục không tồn tại, nên nếu không chặn thì "chưa quét được" in ra y hệt "quét rồi không thấy gì".
- **Trạng thái:** vế (b) **đã kiểm** bằng chạy thật và nay có bài kiểm hồi quy chạy lại mỗi thứ Hai. Vế (a) vẫn giao làn `verify` mục `VF-G1` và vẫn chờ chủ dự án ở issue [#5](https://github.com/HungQuach301/crux-studio/issues/5) (mở từ 2026-09-20, chưa có câu trả lời).

## G2 · `automerge.yml` merge được bằng `GITHUB_TOKEN` và gọi được `main-ci`

- **Nội dung:** một workflow dùng `GITHUB_TOKEN` gọi được API merge, và merge đó **không** tự kích hoạt workflow khác — nên **mọi** workflow nghe `push` vào `main` phải được gọi tường minh bằng `workflow_dispatch`: `main-ci`, `labels`, và từ `D-C06` cả `sync-workflows`.
- **Nguồn:** tài liệu GitHub Actions về `GITHUB_TOKEN` và về việc sự kiện do nó tạo ra không kích hoạt workflow mới.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/workflows/automerge.yml` · `ops/workflows/main-ci.yml` · `ops/invariants.post-merge-dispatch.ts`
- **Cách kiểm:** DoD Đợt 0 đòi `automerge` merge **thật** một PR low-risk mà không cần người. Đó là bài kiểm, và nó là chạy thật chứ không phải đọc tài liệu.
- **Dự phòng — đã viết sẵn cho `main-ci`:** `main-ci.yml` chạy thêm **theo lịch mỗi giờ** (`cron: '17 * * * *'`). Nếu lời gọi tường minh không chạy được, `main` vẫn được kiểm trong vòng một giờ. Không cần sửa gì khi phát hiện sai.
- **Dự phòng cho `sync-workflows` — CHƯA có.** `D-C06` đưa `ops/workflows/**` vào diện máy tự merge được, nên nếu lời gọi tường minh hỏng thì workflow mới nằm trong `main` mà `.github/workflows/` vẫn giữ bản cũ — và **mọi thứ vẫn xanh** (rà soát **Z3** trong `ops/known-failures.md`). Dự phòng đúng cho chỗ này là phép so nội dung `ops/workflows/*` với `.github/workflows/*` trong `main-ci`, thuộc mục `P-014`, **chưa xây**. Tới khi nó xong, đây là chỗ hở lớn nhất mà `D-C06` tạo ra.
- **Độ tin cậy (cập nhật):** `đã kiểm một phần` (2026-09-21, mục `VF-G2`).
- **Bằng chứng, 2026-09-21:** DoD Đợt 0 chạy thật, không phải suy đoán — 11 lần `automerge.yml` merge PR bằng `GITHUB_TOKEN` (`merged_by: github-actions[bot]`) đều được nối tiếp bằng một lần chạy `main-ci` do chính `github-actions[bot]` gọi qua `workflow_dispatch` (không phải `push`), 11/11 kết luận `success`. Từng cặp đối chiếu trực tiếp `head_commit` của run với PR (không suy theo số thứ tự run, xem sửa lỗi bên dưới): PR #9→run [#2](https://github.com/HungQuach301/crux-studio/actions/runs/35546665857), PR #12→run [#5](https://github.com/HungQuach301/crux-studio/actions/runs/35548564831), PR #13→run [#6](https://github.com/HungQuach301/crux-studio/actions/runs/35549260675), PR #15→run [#8](https://github.com/HungQuach301/crux-studio/actions/runs/35551226238), PR #16→run [#10](https://github.com/HungQuach301/crux-studio/actions/runs/35552488882), PR #21→run [#12](https://github.com/HungQuach301/crux-studio/actions/runs/35562965729), PR #22→run [#16](https://github.com/HungQuach301/crux-studio/actions/runs/35567002846), PR #23→run [#15](https://github.com/HungQuach301/crux-studio/actions/runs/35566283545), PR #24→run [#17](https://github.com/HungQuach301/crux-studio/actions/runs/35568132566), PR #25→run [#18](https://github.com/HungQuach301/crux-studio/actions/runs/35568521900), PR #27→run [#19](https://github.com/HungQuach301/crux-studio/actions/runs/35572041259). Cặp khít nhất: PR #12 (`[platform] P-014`, nhãn `automerge`, không chạm vùng bảo vệ) merge lúc `2026-09-21T00:42:51Z`; run #5 khởi động `2026-09-21T00:42:53Z` — 2 giây sau.
  Sự kiện `workflow_dispatch` (không phải `push`) trên các run này cũng là bằng chứng cho vế thứ hai của giả định — merge bằng `GITHUB_TOKEN` **không** tự sinh sự kiện `push` kích hoạt `main-ci`, đúng như tài liệu nói, nên buộc phải gọi tường minh.
  **Đối chứng ngược chiều, cùng bằng chứng:** PR #18 (`owner-merge`, sửa `CHARTER.md`) do chính chủ dự án bấm merge trên GitHub (`merged_by: HungQuach301`), và merge đó sinh `main-ci` run [#11](https://github.com/HungQuach301/crux-studio/actions/runs/35559518205) bằng một sự kiện `push` **thật** (actor `HungQuach301`, không phải `github-actions[bot]`/`workflow_dispatch`). Đây đúng là cơ chế đối lập với G2, không phải một ví dụ của G2 — giữ lại ở đây làm đối chứng, vì bản đầu của mục này (trước khi reviewer ngữ cảnh sạch soát) đã xếp nhầm PR #18 vào bảng bằng chứng cùng với hai cặp sai số run (PR #9, PR #16); ba lỗi đó đã sửa trong cùng PR `VF-G2`, không đợi PR sau.
- **Còn thiếu, KHÔNG tính vào phần đã kiểm:** chuỗi `automerge` → gọi tường minh `labels.yml` sau khi PR đụng `ops/labels.json`, và `automerge` → `sync-workflows` sau khi PR đụng `ops/workflows/**`, đều **chưa quan sát được bằng chạy thật** — ba lần `labels` chạy tới nay đều do chủ dự án tự kích (`push`/`workflow_dispatch` bởi `HungQuach301`), chưa lần nào do `automerge` gọi. Giữ nguyên gạch đầu dòng "Dự phòng cho `sync-workflows` — CHƯA có" ở trên; chỗ hở đó không đổi.
- **Trạng thái:** `đã kiểm một phần` — phần lõi DoD Đợt 0 (automerge merge bằng `GITHUB_TOKEN`, không tự sinh `push`, gọi tường minh được `main-ci`) đã kiểm bằng chạy thật, 8/8 lần quan sát khớp. Phần `labels`/`sync-workflows` của cùng giả định vẫn `tài liệu nói vậy`, giao `VF-G2` theo dõi tiếp khi có PR automerge chạm đúng hai loại file đó.

## G3 · Trần số lần chạy routine mỗi ngày

- **Nội dung:** trần số lần chạy routine mỗi ngày đủ cho 2–3 worker theo phụ lục P1, cộng hai routine `crux-digest` và `crux-integrator`.
- **Nguồn:** chưa có con số.
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · `CLAUDE.md` mục 16 · CHARTER phụ lục P1 · mặc định M5
- **Cách kiểm:** sau lượt chạy đầu tiên, mở `claude.ai/code/routines` và **đọc số lượt còn lại trong ngày**. Chỉ chủ dự án làm được.
- **Dự phòng:** giãn nhịp chạy, hoặc giảm số worker. Backlog không đổi, chỉ chậm lại.
- **Trạng thái:** giao làn `verify`, mục `VF-G3`.

## G4 · Hạn mức gói Claude chịu được 3 worker song song

- **Nội dung:** gói subscription chịu được ba worker chạy song song mà không chạm hạn mức giữa chừng.
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · CHARTER mục 7 · mặc định M5
- **Cách kiểm:** chạy 3 worker song song một ngày, đếm số lần chạm hạn mức.
- **Dự phòng:** giảm xuống 2 worker. **Không cần sửa code**: CHARTER 2.2 đã cấm logic "dừng vì hạn mức" trong code, và mỗi đơn vị việc đủ nhỏ để xong trong một lần chạy. Chạm hạn mức chỉ có nghĩa lần chạy sau làm tiếp.
- **Trạng thái:** giao làn `verify`, mục `VF-G4`.

## G5 · Quota phút Actions và dung lượng artifact đủ cho việc render

- **Nội dung:** quota phút Actions và dung lượng lưu artifact của gói hiện tại đủ để render một tập ~36.000 khung, cộng proof render.
- **Độ tin cậy:** **`đã kiểm một phần`** — **cả hai** nửa đã chạy thật trên container phiên cloud: nửa **dựng** (2026-09-21, mục `A-001`) và nửa **sinh khung** (2026-09-21, mục `V-002`). Con số phút Actions **tính tiền** trên runner thật thì chưa.
- **Phần phụ thuộc:** `ops/lanes/visual/backlog.md` (V-002) · `ops/lanes/assembly/backlog.md` (A-001) · `ops/lanes/priority.md` · `spike/canvas/RESULT.md` · `ops/workflows/spike-canvas.yml` · `ops/scripts/render-trial.ts` · `ops/workflows/render-trial.yml` · `docs/assembly/render-trial.md`
- **Cách kiểm:** spike canvas (`V-002`, một đoạn mẫu rồi ngoại suy) và thử nghiệm engine dựng (`A-001`, một tập đầy đủ) đều **đo phút Actions thật**. Không tốn tiền API, chỉ tốn phút Actions của chính lần đo.
- **Dự phòng:** đưa chi phí vào ngân sách học, hoặc chuyển sang runner khác. Nếu sai nặng, chốt 30fps thay vì 60fps ở `A-001`.
- ✅ **Đã kiểm bằng chạy thật, 2026-09-21 (mục `V-002`) — phần hiệu năng và dung lượng.** 27.000 khung, bốn cấu hình, canvas 6000×3400, trên container 4 nhân / 16 GB (trùng cấu hình `ubuntu-latest` hiện hành về nhân và RAM). Bảng đầy đủ ở `spike/canvas/RESULT.md`, sinh từ `measurements.json` chứ không gõ tay.
  - **Thời gian:** 5.400 khung ở 30fps mất **6,4 phút** một worker, ngưỡng WP-003 là ≤25 phút. 60fps (10.800 khung) mất 12,2 phút. 30fps có mờ chuyển động 4 mẫu mất 8,9 phút.
  - **Bộ nhớ:** đỉnh RSS cả cây tiến trình trình duyệt **565 MB** trên 16 GB — không gần trần, ở mọi cấu hình.
  - **Dung lượng artifact:** đoạn 3 phút ở 30fps nặng **46,0 MB** (H.264 CRF 20), tức ~15,3 MB mỗi phút → **~307 MB cho một tập 20 phút**. Đây là con số cho vế "dung lượng artifact" của giả định này. Đối chứng: cùng số khung nhưng máy quay đứng yên chỉ cho 1,6 MB — chênh lệch đó là cái giá có thật của quy tắc "không khung nào đứng yên".
  - **Chi phí của kiến trúc `D-04` rất nhỏ:** vẽ một khung mất 3,2 ms, tức 4,4% thời gian mỗi khung; 67,8 ms còn lại là lấy khung ra khỏi trình duyệt. Nếu sau này đụng ngưỡng thì chỗ phải tối ưu là đường ống xuất khung, **không** phải ngữ pháp chuyển động.
- ⬜ **Chưa kiểm — phút Actions tính tiền.** Số trên đo ở container phiên cloud, không phải runner Actions. Hai workflow đo nó là `ops/workflows/spike-canvas.yml` (nửa sinh khung) và `ops/workflows/render-trial.yml` (nửa dựng), và theo CHARTER 3.2 mỗi cái chỉ chạy được **sau khi PR mang nó merge vào `main`** rồi `sync-workflows` chép sang `.github/workflows/`. Lượt worker sau chạy nó bằng `workflow_dispatch` và điền nốt. Cho tới lúc đó vế "quota phút Actions" của giả định này vẫn là `suy luận`.
- ⚠️ **Số đo là cận dưới, không phải số của thư viện dựng hình.** Spike đo canvas 2D trần, không thêm phụ thuộc nào: chọn thư viện dựng hình React mà spec WP-003 mục 5 nêu là **chọn nhà cung cấp** kèm điều khoản thương mại (`irreversible` nhóm 3, CHARTER 2.3), và mục 7c đòi ghi điều khoản giấy phép — thứ mà bức tường mạng (issue #36) không cho đọc. Một thư viện có vòng đời React mỗi khung sẽ cộng vào đúng cột đang chiếm 4,4%. Việc chốt thư viện thuộc `A-001`.
- **Trạng thái:** **Đây là giả định đắt nhất nếu sai**, vì nó ràng buộc cả kiến trúc hình ảnh — và phần đắt nhất của nó (kiến trúc canvas liên tục có khả thi không) nay đã có câu trả lời: **có**, còn rất xa ngưỡng. Ba mảnh, đo riêng:

  | Mảnh | Ai đo | Trạng thái |
  |---|---|---|
  | Chi phí **dựng** một tập đầy đủ (21 phút, cả hai fps) | `A-001` | ✅ đo xong 2026-09-21 — `docs/assembly/render-trial.md` |
  | Chi phí **sinh khung** (đoạn mẫu 27.000 khung, rồi ngoại suy) | `V-002` | ✅ đo xong 2026-09-21 — `spike/canvas/RESULT.md` |
  | **Phút Actions tính tiền** trên runner thật | `ops/workflows/render-trial.yml` · `ops/workflows/spike-canvas.yml` | ⬜ `spike-canvas.yml` **chạy được rồi** (PR của `V-002` đã merge, `sync-workflows` đã chép sang `.github/`); `render-trial.yml` chỉ chạy được sau khi PR này merge (G10) |

  **Số đã có, phần dựng, container 4 nhân / 16 GB cùng cấu hình `ubuntu-latest`:** một bản master cộng một bản proof mất **1.024 giây tường** ở 30fps và **1.440 giây** ở 60fps, tức **18** và **25** phút Actions sau khi làm tròn lên (đừng lẫn hai đơn vị — 18 và 25 là *phút hoá đơn*, không phải giây tường quy ra phút). Bản master nặng **311 MB** (30fps) và **393 MB** (60fps). Ở nhịp trần mà channel pack khai (`cadencePerMonth.phase2` = 10 tập/tháng): **180** so với **250** phút Actions mỗi tháng. Gấp đôi số khung chỉ làm chi phí dựng tăng **1,48×** (riêng phần master — hai con số 1.024 và 1.440 giây ở trên là master **cộng** proof, tỷ lệ 1,41×), không phải 2×.

  ⚠️ **Hai con số trên chưa cộng thẳng vào nhau được.** Số của `A-001` là một tập đầy đủ dựng từ clip có sẵn; số của `V-002` là một đoạn mẫu sinh khung rồi ngoại suy, và cảnh mẫu của cả hai đều là proxy — sáu xưởng còn `impl: stub`. Ngân sách G5 **tính tiền** chỉ chốt được sau khi hai workflow ở bảng trên chạy trên runner thật.

## G6 · YouTube khoá video riêng tư khi app chưa qua kiểm tuân thủ

- **Nội dung:** app YouTube API chưa qua kiểm tuân thủ thì mọi video tải lên bị khoá ở chế độ riêng tư, không đổi công khai được bằng API.
- **Nguồn:** spec tham chiếu.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/lanes/release/backlog.md` (R-002) · `kernel/contracts/release.payload.v0.schema.json`
- **Cách kiểm:** lần tải lên đầu tiên ở `R-002`. Tốn quota, không tốn tiền.
- **Dự phòng:** **không đổi gì.** Giả định này *trùng hướng* với bất biến I5 — nếu nó sai theo hướng "API công khai được", I5 vẫn cấm máy làm việc đó, và contract vẫn khoá `visibility: "private"` bằng `const`. Đây là giả định duy nhất mà sai cũng không gây hại.
- **Trạng thái:** không cần đổi gì.

## G7 · Điều khoản TTS, stock, font, bản đồ cho phép dùng thương mại và B2B

- **Nội dung:** điều khoản của các nhà cung cấp giọng đọc, ảnh stock, font và bản đồ cho phép **cả** dùng thương mại **lẫn** giao lại cho khách hàng B2B.
- **Độ tin cậy:** **`tài liệu nói vậy`** — đọc tài liệu chính thức của bên có thẩm quyền, chưa chạy thật. Theo đúng thang ở đầu file: chưa có ngữ cảnh nào của **đường tiền** được chạy thật, nên **không** được khai `đã kiểm một phần`. Đo egress trong lượt này là kiểm **mạng**, không phải kiểm G8. (2026-09-21, mục `VF-G7`) — xem hai gạch đầu dòng bằng chứng bên dưới.
- **Phần phụ thuộc:** `workshops/audio/src/index.ts` · `kernel/contracts/audio.payload.v0.schema.json` · `ops/license-ledger.md` · `ops/lanes/audio/backlog.md` (AU-001) · `ops/lanes/verify/backlog.md`
- **Cách kiểm:** đọc điều khoản từng nhà cung cấp, **trích dẫn kèm ngày đọc** vào `ops/license-ledger.md`. Không tóm tắt bằng trí nhớ. Miễn phí, chỉ tốn thời gian.
- **✅ Bằng chứng, nhóm font, 2026-09-21:** đọc **văn bản giấy phép gốc** đi kèm chính gói font — `package/LICENSE` của `@fontsource/inter@5.3.0` trên `registry.npmjs.org`, khai `"license": "OFL-1.1"` trong `package.json`. SIL Open Font License 1.1 điều 5 nói thẳng: `The requirement for fonts to remain under this license does not apply to any document created using the Font Software.` Video đã dựng đọc là "document" theo nghĩa đó — **bước đọc này là suy luận**, vì giấy phép không định nghĩa chữ "document" và nguồn xác nhận chuẩn (OFL FAQ ở `scripts.sil.org`) đúng là một trong các đích bị chặn. Theo cách đọc đó thì **cả hai** câu hỏi của G7 đều `được` cho ca dùng của dự án. Giao **file font** cho khách hàng là ca khác, có điều kiện (điều 1 và 2). Trích nguyên văn và ranh giới hai ca ở `ops/license-ledger.md`.

  **Phạm vi của "xong" ở đây hẹp hơn chữ "font":** đã đọc **một** font dưới **một** giấy phép. Điều khoản của chính dịch vụ Google Fonts (`fonts.google.com` → `000`) và các font `Apache-2.0` **chưa** đọc được.
- **⬜ KHÔNG kiểm được, và đây là phát hiện chính của lượt chạy:** ba nhóm còn lại — TTS, ảnh/video stock, bản đồ — **không đọc được từ phiên cloud**. Chính sách mạng của environment chặn **16 trên 18** đích đã đo (`elevenlabs.io`, `api.elevenlabs.io`, `play.ht`, `murf.ai`, `openai.com`, `aws.amazon.com`, `docs.aws.amazon.com`, `learn.microsoft.com`, `www.pexels.com`, `unsplash.com`, `pixabay.com`, `fonts.google.com`, `scripts.sil.org`, `openfontlicense.org`, `www.openstreetmap.org`, `www.naturalearthdata.com` — tất cả trả `000`; công cụ đọc web trả `EGRESS_BLOCKED`). Hai đích mở là `registry.npmjs.org` và `cloud.google.com`; `cloud.google.com` **không** cứu được nhóm TTS, vì trang `Service Specific Terms` đọc được không có phần riêng cho Cloud Text-to-Speech và mục `5.1` của `Cloud Terms of Service` trả về bản **bị cắt giữa chừng**. Bảng đo đầy đủ, kèm giờ UTC và lệnh dùng để đo, ở `ops/license-ledger.md`.

  Nhóm font đọc được **chỉ vì** giấy phép font đi kèm gói npm, mà `registry.npmjs.org` nằm trong danh sách thông. Đó là may, không phải cách làm nhân rộng được: điều khoản TTS và stock không đi kèm gói nào.

  **Không thay bằng đoạn trích của máy tìm kiếm.** Đoạn trích đó là bản tóm tắt của bên thứ ba — đúng loại bằng chứng mà luật của làn `verify` loại bỏ, và đúng cách ba nhận định sai của bản C1 đã lọt vào.
- **Dự phòng:** đổi nhà cung cấp. Contract không đổi — nó đã có sẵn trường `commercialLicenseVerified`. **Dự phòng cho chỗ bị chặn thì chưa có** — gỡ chặn cần chủ dự án, xem mục `VF-G7` và issue **#36**.
- **Trạng thái:** `đã kiểm một phần`; `VF-G7` chuyển **`parked`**. **Vẫn chặn:** stub khai `commercialLicenseVerified: false`, và đó là trạng thái đúng, không phải một ô bỏ trống. Quyền dùng thương mại **không** đồng nghĩa với quyền giao lại — rủi ro A6 nằm đúng ở khoảng cách giữa hai thứ đó, và nhóm font ở trên là ví dụ sống: cùng một giấy phép trả lời `được` cho video nhưng `được, kèm điều kiện` cho file font.

## G8 · Đường nhận tiền và nộp thuế cho người ở Việt Nam

- **Nội dung:** có đường hợp pháp để nhận doanh thu AdSense và nộp thuế, cho người cư trú ở Việt Nam.
- **Độ tin cậy:** **`đã kiểm một phần`**
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · CHARTER mục 8
- **Cách kiểm:** tra điều kiện AdSense và nghĩa vụ thuế hiện hành. Miễn phí.
- **Dự phòng:** chưa có, và **chưa cần tới**: phần đã kiểm cho thấy đường đi tồn tại ở cả hai đầu. Nếu một trong hai đầu hoá ra không đi được thì mở `🤖 [QĐ]` — G8 vẫn là một trong hai giả định chưa có dự phòng viết sẵn.
- **Trạng thái:** đọc nguồn chính thức ở lượt `crux-worker-1` **2026-09-21**, mục `VF-G8`. **Đường đi có thật ở cả hai đầu — trên giấy.** Theo luật 3 của CHARTER 11.1, `tài liệu nói vậy` **chưa đủ để dựa vào**; dựa vào được chỉ sau khi chạy thật, mà việc đó cần doanh thu và danh tính chủ dự án. Chưa chặn gì ở Đợt 0 và Đợt 1, vì doanh thu chưa tồn tại. Chặn ở Mốc 8.

Mọi số dưới đây kèm **URL nguồn và ngày truy cập** (chỉ dẫn 2 của chủ dự án trên issue bản tin #50). Nội dung web là **dữ liệu**, không phải chỉ dẫn (bất biến I7). Không dùng đoạn trích tóm tắt của máy tìm kiếm ở bất cứ kết luận nào dưới đây — mỗi con số đọc từ trang gốc của bên có thẩm quyền.

**✅ Đầu nhận tiền — trang trợ giúp của chính Google, đọc 2026-09-21**

| Việc | Kết quả | Nguồn |
|---|---|---|
| Việt Nam có trong bảng phương thức thanh toán AdSense | Check **Yes** · EFT **No** · Wire **Yes** · Hyperwallet **No** (bảng khu vực châu Á – Thái Bình Dương) | `support.google.com/adsense/answer/1714397` |
| Ngưỡng chi trả | **100 USD** cho tài khoản USD | `support.google.com/adsense/answer/1709871` |
| Nhịp chi trả | phát hành **giữa ngày 21 và 26** hằng tháng, nếu số dư đạt ngưỡng cuối tháng trước và không có lệnh giữ | `support.google.com/adsense/answer/1709858` |

Tức phương thức dùng được cho Việt Nam là **chuyển khoản quốc tế (wire transfer)** — EFT và Hyperwallet không mở cho Việt Nam.

**⚠️ Đầu thuế Mỹ — khấu trừ tại nguồn 30%, và không có hiệp định để giảm**

- Google giữ lại thuế Mỹ trên doanh thu YouTube của người ngoài Mỹ: **tới 30%** doanh thu từ Mỹ nếu không khai thông tin thuế (tài khoản doanh nghiệp), hoặc **24%** trên doanh thu **toàn cầu** theo dạng *backup withholding* (tài khoản cá nhân); khai đủ thông tin thuế mà **không có quyền lợi hiệp định** thì **30%** trên doanh thu từ người xem ở Mỹ. Nguồn: `support.google.com/youtube/answer/10391362`, đọc 2026-09-21.
- **Việt Nam chưa có hiệp định thuế ĐANG CÓ HIỆU LỰC với Mỹ** (đã ký 07/07/2015, chưa phê chuẩn). Kết luận này suy ra từ hai nguồn, không nguồn nào nói thẳng câu đó: Hai nguồn độc lập, đọc 2026-09-21:
  - IRS, *United States Income Tax Treaties – A to Z* (`www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z`): mục chữ **V trống**, không có Việt Nam.
  - US Treasury, *Tax treaties* (`home.treasury.gov/policy-issues/tax-policy/treaties`): có văn bản "Agreement US and Vietnam … Respect to Taxes on Income, **July 7 2015**", kèm đúng ghi chú của trang: văn bản được đăng **ngay khi ký, trước khi phê chuẩn và trước khi có hiệu lực**.
  - Đọc hai nguồn cùng chiều: hiệp định **đã ký 07/07/2015 nhưng chưa có hiệu lực**, nên không có mức giảm nào áp được. Giữ nguyên **30%**.
- **Hệ quả thẳng vào CHARTER mục 8:** kênh đầu tiên (`us-personal-finance`) nhắm người xem Mỹ, nên gần như **toàn bộ** doanh thu là doanh thu từ người xem ở Mỹ — tức ~30% doanh thu gộp bị giữ lại ở đầu Mỹ trước khi tiền rời Google. Đây là **số đọc từ nguồn**, không phải ước lượng.

**✅ Đầu thuế Việt Nam — có quy định riêng cho người sáng tạo nội dung số**

| Việc | Kết quả | Nguồn (đọc 2026-09-21) |
|---|---|---|
| Thuế suất | cá nhân sáng tạo nội dung số: **GTGT 5%** và **TNCN 2%** trên doanh thu | `baochinhphu.vn/sang-tao-noi-dung-so-doanh-thu-bao-nhieu-phai-nop-thue-102260716165956679.htm`, bài 17/07/2026 "Sáng tạo nội dung số, doanh thu bao nhiêu phải nộp thuế?" (Thuế cơ sở 3 tỉnh Phú Thọ trả lời), dẫn Thông tư 40/2021/TT-BTC · Luật Thuế GTGT 48/2024/QH15 · Luật Thuế TNCN 109/2025/QH15 |
| Ngưỡng không phải nộp thuế | tới 31/12/2025: **100 triệu đồng/năm** · từ 01/01/2026: **500 triệu** (NĐ 68/2026/NĐ-CP), rồi nâng lên **1 tỷ đồng/năm** (NĐ 141/2026/NĐ-CP ngày 29/4/2026, hiệu lực từ 01/01/2026) | như trên |
| Cách tính khi vượt ngưỡng | trước 2026 tính trên **toàn bộ** doanh thu; từ 2026 thuế TNCN tính trên **phần doanh thu vượt** ngưỡng (Luật TNCN 109/2025/QH15) | như trên |
| Thủ tục kê khai | ≤ 1 tỷ đồng/năm: chỉ **thông báo doanh thu thực tế** với cơ quan thuế, chậm nhất **31/01** năm dương lịch tiếp theo · > 1 tỷ: **khai và nộp thuế từ quý** phát sinh doanh thu vượt ngưỡng | `xaydungchinhsach.chinhphu.vn/lam-video-dang-tai-len-nen-tang-youtube-va-co-phat-sinh-doanh-thu-co-can-ke-khai-thue-119260723152359049.htm`, bài 23/07/2026 (Cục Thuế trả lời), căn cứ NĐ 68/2026/NĐ-CP sửa đổi bởi NĐ 141/2026/NĐ-CP |

**Một bài học về cách kiểm, không phải về thuế:** con số "100 triệu đồng/năm" là con số đúng của Thông tư 40/2021 và là con số mà một agent viết từ trí nhớ sẽ viết ra. Tính tới hôm nay nó **sai gấp mười lần** — ngưỡng hiện hành là 1 tỷ. Đúng loại lỗi mà luật "kiểm bằng chạy thật, không bằng trí nhớ" của làn `verify` sinh ra để chặn.

**Mô hình phần còn lại sau thuế (bất biến I6 — đây là *mô hình*, không phải số đo):** với doanh thu gộp `R` toàn bộ từ người xem Mỹ và doanh thu năm trên ngưỡng 1 tỷ, phần còn lại sau khi trừ khấu trừ Mỹ rồi trừ thuế Việt Nam ≈ `R × (1 − 0,30) × (1 − 0,05 − 0,02) ≈ 0,65 × R`. Hai đầu vào đều có nguồn ở trên; phép nhân là giả định đơn giản hoá — nó **giả định** thuế Việt Nam tính trên doanh thu đã bị khấu trừ, **không** có khoản trừ chéo nào, và cả 5% lẫn 2% tính trên **toàn bộ** doanh thu chứ không phải trên **phần vượt ngưỡng** như dòng ngay trên bảng đã ghi. Ba giả định đó đều nghiêng về phía thu ít hơn, nên **`0,65 × R` là cận dưới**, không phải số đo. Đúng chỗ đó thì chưa kiểm được (xem ⬜ dưới).

**⬜ Còn treo — khai trước, không để tự phát hiện**

- **Chưa chạy thật đầu cuối.** Chưa mở tài khoản AdSense, chưa nhận một lần chuyển tiền nào. Việc đó cần danh tính và tài khoản ngân hàng của chủ dự án, và chỉ làm được khi đã có doanh thu — tức ở Mốc 8. Vì vậy trạng thái là `đã kiểm một phần`, không phải `đã kiểm`: phần đọc được từ nguồn gốc đã đọc xong, phần chạy thật thì chưa tới lúc.
- **Chưa kiểm:** ngân hàng Việt Nam nhận chuyển khoản USD từ Google cho **cá nhân**, và thủ tục ngoại hối đi kèm.
- **Chưa kiểm, và là chỗ đắt nhất:** 30% đã bị Mỹ giữ có được trừ vào thuế phải nộp ở Việt Nam hay không. Không có hiệp định tránh đánh thuế hai lần đang có hiệu lực, nên **rủi ro đánh thuế hai lần là thật**; lượt này không đọc được nguồn chính thức nào trả lời thẳng câu đó. Nếu câu trả lời là "không được trừ" thì phần còn lại thấp hơn mô hình trên.
- **Chưa đọc toàn văn** NĐ 68/2026/NĐ-CP và NĐ 141/2026/NĐ-CP, dù `vanban.chinhphu.vn` và `quochoi.vn` đều nối được trong chính lượt đo. Hai kết luận phía Việt Nam đang dựa vào bài tường thuật câu trả lời của cơ quan thuế trên cổng thông tin Chính phủ — là nguồn có thẩm quyền, nhưng lùi một bậc so với văn bản gốc. Đúng loại khoảng cách mà bài học "100 triệu" ở trên cảnh báo.
- **Chưa kiểm:** doanh thu AdSense **trên website** (khác YouTube) có cùng cách phân loại và cùng cách khấu trừ ở đầu Mỹ hay không. Nguồn đọc được ở trên nói cho người sáng tạo nội dung số trên nền tảng.
- Bốn chỗ treo này **không chặn** Đợt 0 hay Đợt 1. Chúng chặn ở Mốc 8, và mục `VF-G8` ghi rõ để Mốc 8 không phải tìm lại từ đầu.

## G9 · Thuê được người soát bản địa và giao việc qua link

- **Nội dung:** thuê được người bản địa Mỹ soát nội dung, và giao việc cho họ qua link mà không cần họ có tài khoản GitHub hay Claude.
- **Độ tin cậy:** **`đã kiểm một phần`** — nửa "giao việc qua link" **chạy thật** (đo được cả chiều dương lẫn chiều âm); nửa "thuê được người" mới ở mức đọc trang của hai tổ chức, **chưa đăng tin, chưa ai nhận việc**.
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · `ops/network-domains.md` · quyết định D-17 · rủi ro A4
- **Cách kiểm:** tìm ít nhất hai kênh tuyển thực tế, và một cách giao việc không cần tài khoản. Miễn phí ở bước tìm.
- **Dự phòng:** chưa có. Nếu sai thì mở `🤖 [QĐ]` — giả định thứ hai chưa có dự phòng. Lượt kiểm 2026-09-21 **không** làm giả định này sai, nên chưa phải mở.
- **Trạng thái:** kiểm lần đầu 2026-09-21 (mục `VF-G9`, lượt `crux-worker-2`). Rủi ro A4: vai "người ngoài" nhận việc qua link, **có thời hạn phản hồi** — nếu không có thời hạn, họ thành nút cổ chai nằm ngoài mô hình tự trị. **Không kênh nào dưới đây áp hạn hộ** — hạn phải nằm trong chính bản brief.

**✅ Hai kênh tuyển thực tế — hội nghề nghiệp biên tập ở Mỹ, miễn phí cho bên thuê**

Chọn hội nghề nghiệp thay vì sàn freelance chung vì mục này cần đúng một thứ: người **bản địa Mỹ** soát nội dung tiếng Anh Mỹ.

| | **EFA** — Editorial Freelancers Association | **ACES** — The Society for Editing |
|---|---|---|
| Trang | `www.the-efa.org/hiring/` (đọc 2026-09-21) | `aceseditors.org/resources/job-board` (đọc 2026-09-21) |
| Chi phí cho bên thuê | *"There is no charge to use the Member Directory or Job List."* | *"ACES offers this job board as a free service to the editing community."* |
| Cần là hội viên không | **Không đòi** — trang không đặt điều kiện hội viên lên bên thuê. Nhưng trang cũng **không** có câu nào nói thẳng về non-member; kết luận này đọc từ *"There is no charge to use…"* cộng với việc không có rào đăng nhập nào | Trang form đăng tin không đòi đăng nhập |
| Cách đăng tin | `www.the-efa.org/hiring/job-submission-form/` — *"submitted jobs are typically posted within 48 hours"* | `members.aceseditors.org/add-a-job-posting` |
| Ô của form | (form dựng bằng JS, không đọc được thô) — trang ghi *"Publication may be delayed if we need to reach out to you for clarification about the rate you are offering"* | Job Title\* · Company\* · Job Location\* · **Link to Apply** · **Email to Apply** · Brief Job Description\* · First/Last Name\* · Email\* |
| Tin sống bao lâu | không ghi trên trang | **hai trang của chính họ lệch nhau:** trang job-board ghi *"Jobs will be expire after 60 days"*, trang form ghi *"Postings expire after 30 days"* |
| Người soát liên hệ lại kiểu gì | *"Qualified freelancers will then contact you directly."* | qua ô `Link to Apply` / `Email to Apply` do bên thuê tự điền |

- **EFA từ chối tin trả thấp:** *"We do not post low-paying or nonpaying jobs, jobs that pay by royalty or on spec, internships of any kind, or jobs we suspect may be fraudulent. The EFA reserves the right to reject or remove any job posting for any reason."* (`www.the-efa.org/hiring/`, đọc 2026-09-21). **Họ không nói ngưỡng "low-paying" là bao nhiêu**, và không buộc nó vào bảng giá — bảng giá dưới đây là chỗ duy nhất có số, nên dùng nó làm mốc tham chiếu, chứ EFA không khai đó là ngưỡng.
- **Xem danh sách tin của EFA là quyền lợi hội viên** (*"The EFA Job List is a paid benefit exclusive to EFA members"* — `www.the-efa.org/job-list/`, đọc 2026-09-21; câu này ở trang khác với trang `/hiring/` dẫn đầu bảng). Luồng vì thế là: bên thuê đăng miễn phí → hội viên đọc → hội viên chủ động liên hệ. Bên thuê không cần tài khoản ở bất kỳ bước nào.
- **ACES đang chuyển website** và trang job-board ghi tin đang để tạm trên một thư mục Google Drive — ghi lại để lượt sau không tưởng là mình đọc nhầm.

**Bảng giá EFA 2026 — số đọc từ nguồn, kèm một phép gộp được khai rõ (bất biến I6)**

Nguồn: `www.the-efa.org/rates/`, đọc 2026-09-21. Trang tự khai: *"The median rate ranges in the 2026 Rate Chart below are based on data from a survey administered to EFA members from November 2025 through mid-January 2026"*, hơn 1.100 hội viên trả lời về mức giá năm 2025. Trang cũng tự mô tả mình là công cụ *"helps you estimate the cost for your project"* — tức bảng **ước lượng chi phí**, không phải biểu giá bắt buộc.

**Mô hình, không phải một ô trong bảng gốc:** bảng `EDITING` của EFA chia Copyediting và Proofreading thành **19 dòng con mỗi nhóm** (Academic humanities/STEM, Fiction, Legal, Medical, Medicolegal, Technical…). Hai dòng đầu dưới đây là **min của cột thấp nhất và max của cột cao nhất qua cả 19 dòng con**, tính bằng máy từ HTML của chính trang, bỏ các ô `n/a` và các ô `$0.00–0.00` (cách trang ghi "không áp dụng"). Dòng Fact-checking thì **đọc thẳng** từ một dòng của bảng `PUBLISHING`, không gộp gì.

| Việc | Theo giờ | Theo từ | Theo trang (250 từ) |
|---|---|---|---|
| Copyediting (gộp 19 dòng con) | 33,00–75,00 USD | 2,0–5,5 ¢ | 5,00–13,75 USD |
| Proofreading (gộp 19 dòng con) | 29,00–75,00 USD | 1,0–4,5 ¢ | 2,50–11,25 USD |
| Fact-checking (một dòng, không gộp) | 50,00–60,00 USD | — | 60,00–72,50 USD |

Dòng Fact-checking còn có cột `PAGES/HR` = **25,0 trang/giờ**; đó là **số trang mỗi giờ, không phải tiền**. Căn cột đã kiểm bằng số học trên một dòng khác của cùng bảng: `Indexing → Book` ghi 2,0–2,5 ¢/từ và 5,00–6,25 USD/trang, đúng bằng 250 từ × giá mỗi từ.

**Hệ quả thẳng vào CHARTER mục 8:** ngân sách học tới cổng Mốc 3 (600–900 USD) là **chi phí API**, chưa có dòng nào cho người soát bản địa. Một lượt soát một kịch bản ~1.500 từ ở mức proofreading rẻ nhất (1,0 ¢/từ) là ~15 USD; ở mức fact-checking thì một giờ là 50,00–60,00 USD. Việc có đưa vào ngân sách hay không là quyết định, không phải phát hiện của mục này.

**✅ Cách giao việc không cần tài khoản — nửa đọc đã chạy thật**

Đo bằng `curl` trong chính lượt chạy, 2026-09-21, **không** gửi header xác thực nào:

| Phép đo | Kết quả thật | Nghĩa |
|---|---|---|
| `raw.githubusercontent.com/github/gitignore/main/Node.gitignore` | **HTTP 200**, 2.189 byte nội dung thật | người ngoài đọc được nội dung **công khai** qua một link, **không cần tài khoản nào** |
| `github.com/HungQuach301/crux-studio` | **HTTP 404** | |
| `raw.githubusercontent.com/HungQuach301/crux-studio/main/README.md` | **HTTP 404** | |
| như trên, ép rỗng header `Authorization` | **HTTP 404** | |

- **Kết luận ngược chiều, và là phần đáng giá nhất của lượt đo:** repo `crux-studio` là repo **private**, nên **"gửi link repo" KHÔNG phải một cách giao việc**. GitHub trả `404` (không phải `401`/`403`) cho người chưa xác thực, tức người ngoài không phân biệt được "không có quyền" với "không tồn tại". Muốn người ngoài soát được thì phải **xuất bản riêng** phần cần soát.
- **Nhưng xuất bản ra ngoài là `irreversible`** — CHARTER 2.3 nhóm 2 ("mọi thứ công khai ra ngoài"). Agent **không tự làm**. Cả gist công khai lẫn gist "secret" (ai có link đều đọc được) đều thuộc nhóm đó. Đây là chỗ mục này dừng lại và chờ một quyết định, không phải chỗ để tự mở.
- **Đường trả lời không cần tài khoản:** (a) **email trực tiếp** — không đòi tài khoản ở cả hai đầu, và đúng là cơ chế EFA mô tả (*"contact you directly"*) cùng ô `Email to Apply` của ACES; (b) một biểu mẫu ở chế độ "ai có link cũng trả lời được" — Google Forms tự khai *"Under 'General access,' you can give access to anyone with a link"* và chỉ bắt đăng nhập khi bật `Limit to 1 response` (`support.google.com/docs/answer/2839588`, đọc 2026-09-21). Đường (b) mới ở mức **`tài liệu nói vậy`**: lượt này không dựng form nào để chạy thật.

**⬜ Còn treo — khai trước, không để tự phát hiện**

- **Chưa đăng tin, chưa ai nhận việc.** Đây là chỗ giả định thật sự chịu tải và nó chưa được chạm: đăng tin là cam kết trả tiền cho người thật (CHARTER 2.3 nhóm 1, `irreversible`), nên agent không tự làm. Vì vậy độ tin cậy dừng ở `đã kiểm một phần`.
- **Chưa dựng và chưa chạy thử một biểu mẫu trả lời nào.** Đường (b) ở trên còn là giấy.
- **Phát hiện ngược hướng mô hình tự trị, đáng một mục backlog `platform`:** mọi đường trả lời không cần tài khoản đang có đều đổ vào **hộp thư hoặc biểu mẫu của chủ dự án**. Không có đường nào để agent đọc phản hồi của người soát mà không qua người. Đó đúng là nút cổ chai **A4**, và nó đánh thẳng vào thước đo "thời gian của anh" (CHARTER 1.3, mặc định **M8**). Mục này chỉ **ghi nhận**; dựng đường phản hồi máy đọc được là việc của làn `platform`.
- **Năm kênh không đo được từ phiên cloud này:** `www.upwork.com`, `www.fiverr.com`, `www.proz.com`, `www.atanet.org`, `contentwriters.com` đều trả **403** với egress của sandbox. `403` là **máy chủ có trả lời** — tức nối được, và đây là chặn bot phía họ. Nó **không** nói gì về việc chủ dự án mở bằng trình duyệt của mình. Không được đọc thành "không dùng được".
- Không chỗ treo nào ở trên chặn Đợt 0 hay Đợt 1. Chúng chặn ở lúc có kịch bản thật cần soát.

## G10 · Phiên cloud không ghi được `.github/workflows`

- **Nội dung:** phiên cloud của Claude **không** có quyền push file trong `.github/workflows/`.
- **Nguồn:** có báo lỗi công khai. Đây cũng là một trong ba nhận định sai của bản C1 (điểm b) — bản C1 giả định ngược lại.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/workflows/README.md` · `ops/workflows/ci.yml` · `ops/workflows/smoke-workflows.yml` · `CLAUDE.md` · `.claude/hooks/guard.mjs`
- **Cách kiểm:** trong một nhánh vứt đi, thử ghi một file vào `.github/workflows/` và push. **Không merge.**
  > Lưu ý về cách kiểm: hook `guard.mjs` chặn chính agent ghi vào `.github/`, nên bài kiểm này **không thực hiện được từ một phiên agent bình thường** — và agent không được tự nới hook để kiểm. Bài kiểm cần chủ dự án chạy, hoặc cần một PR `owner-merge` mở một ngoại lệ hẹp cho đúng một file thử rồi đóng lại ngay.
- **Dự phòng nếu giả định đúng:** giữ nguyên cơ chế sync và PAT — đang dùng.
- **Nếu hoá ra ghi được ổn định:** có thể gỡ bỏ cơ chế sync và PAT, **thông qua một quyết định riêng**. Agent không tự gỡ: việc đó đổi cách toàn bộ workflow tới được GitHub.
- **Trạng thái:** đang dựa vào, giao làn `verify` mục `VF-G10` — mục đó nay `parked` (2026-09-21, lượt `crux-worker-2`).
- ⬜ **Vì sao `parked`:** cách kiểm ở trên là đúng thứ phụ lục P1 của CHARTER và `CLAUDE.md` mục 4 cấm tuyệt đối, và lớp chặn máy vẫn sống — đo lại trong lượt worker 2026-09-21 ~22:25Z, `guard.mjs` chặn cả một lệnh **đọc** `.github/workflows/ci.yml`. Đi vòng qua hook bằng công cụ khác là lách lớp chặn, không làm. Bài kiểm cần chủ dự án chạy, hoặc cần một ngoại lệ hẹp có thời hạn trong `guard.mjs` qua PR `owner-merge` — nới lớp chặn là CHARTER 2.3 nhóm 5. Issue **#88** nêu ba phương án; lời hứa "đề xuất riêng" về G10 có từ issue #5 (2026-09-20) và tới nay mới thực hiện.
- ⬜ **Dữ liệu gián tiếp, đo kỹ rồi vẫn KHÔNG kết luận được:** `git log origin/main -- .github/` (tới `c7179c6`) trả **3** commit — `9b97cea` và `9928c75` của `crux-sync` (PAT `WORKFLOW_SYNC_TOKEN`) là ghi thật; `939ebb0` là commit **gốc** của lịch sử đang thấy (committer `GitHub <noreply@github.com>`, bản squash của PR #15), không có cha nên cả cây hiện ra dạng `A`, gồm 7 file `.github/workflows/*.yml` đã tồn tại từ trước — đầu nhánh thật của PR #15 (`c5a164a`) **không** chạm `.github/`. Cạm bẫy đo: `git diff-tree -r --name-status <sha>` trả rỗng cho commit gốc, phải có `--root`. Dữ liệu này không nói được gì về quyền của phiên agent — chưa phiên nào thử, vì hook chặn — nên độ tin cậy giữ nguyên `tài liệu nói vậy`.
- **Không chặn làn nào:** dự phòng "giữ nguyên cơ chế sync và PAT" đang chạy thật; câu trả lời chỉ mở đường **gỡ** cơ chế đó, mà việc gỡ vốn đã cần một quyết định riêng.

## G11 · Hook và luật deny có hiệu lực trong routine và thread

- **Nội dung:** hook `PreToolUse` và luật `deny` trong `.claude/settings.json` có hiệu lực **trong routine và trong thread**, không chỉ trong phiên tương tác.
- **Nguồn:** tài liệu Claude Code (khi dùng một repo).
- **Độ tin cậy:** **`đã kiểm`** cho phần **routine** — ngữ cảnh mà charter thật sự dựa vào.

  **Bằng chứng 1, 2026-09-20 (phiên cloud tương tác):** ngay sau khi `.claude/settings.json` và `hooks/guard.mjs` được ghi vào cây làm việc, hook chặn thật một lệnh Bash của chính agent trong cùng phiên đó — lệnh chứa nguyên văn chuỗi bị cấm khi agent đang **soạn file test** cho hook. Hook trả về mã 2 và agent nhận được lý do bằng tiếng Việt. Nghĩa là: (a) hook nạp mà không cần khởi động lại phiên, (b) nó soi nội dung lệnh chứ không chỉ tên công cụ, (c) nó chặn kể cả khi ý định của agent là vô hại.

  Điểm (c) là một phát hiện, không phải một trục trặc: hook chặn theo **hình dạng lệnh**, không theo ý định. Mặt trái là nó chặn cả việc chính đáng — file test vì thế ghép chuỗi lệnh từ mảnh và ghi rõ lý do ngay trong file. Mặt phải là không có cách "giải thích cho hook hiểu" để đi qua nó.

  **Bằng chứng 2, 2026-09-21 — chạy thật TRONG một lượt routine** (`crux-worker-2`, khoảng 15:20 giờ VN). Đây là ngữ cảnh còn thiếu: worker chạy không có người giám sát, nên routine là chỗ duy nhất mà bất biến I4 phải đứng một mình. Năm phép thử, và mỗi phép được chọn sao cho **vô hại nếu KHÔNG bị chặn** — điều kiện bắt buộc khi đi thử một lớp chặn, vì phép thử nào mà "hỏng" đồng nghĩa với "đã làm đúng việc bị cấm" thì không được phép chạy:

  | # | Phép thử | Kết quả | Lớp nào chặn |
  |---|---|---|---|
  | 1 | `cat .github/workflows/ci.yml \| head -3` — một lệnh **ĐỌC** | **CHẶN** — `PreToolUse:Bash hook error: [node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard.mjs"]: CHẶN — Agent không ghi vào .github/ (CHARTER 3.2, giả định G10). Workflow viết vào ops/workflows/.` | hook |
  | 2 | `git commit --no-verify -m …` — vô hại **chỉ khi index rỗng**; nhánh vừa tạo từ `origin/main`, chưa `git add` gì (xác minh bằng `git status -sb`) | **CHẶN** — `CHẶN — Không bỏ qua hook. Hook bị chặn là hệ thống đang chạy đúng, không phải một trở ngại cần lách.` | hook |
  | 3 | `git push --force origin claude/verify/VF-G11` — vô hại **chỉ khi** local không đứng sau remote; lúc chạy, cả hai cùng trỏ commit vừa push (xác minh bằng `git rev-parse HEAD` và `git rev-parse @{u}`), nên chạy được thì cũng là lệnh rỗng | **CHẶN** — `Permission to use Bash … has been denied.` | `permissions.deny` |
  | 4 | công cụ `Read` trên `./.env` | **CHẶN** — `File is in a directory that is denied by your permission settings.` | `permissions.deny` |
  | 5 | `ls -la .env` | **CHẶN** — `Permission to use Bash … has been denied.` | `permissions.deny` |

  **Hai lớp tách được ra bằng chính lời báo lỗi** — đây là chỗ đáng đọc nhất, vì "bị chặn" không tự nói cho biết *cái gì* chặn. Phép 1 và 2 trả về đúng câu tiếng Việt do `guard.mjs` tự in, kèm đường dẫn tới chính file hook: hook đã **chạy**. Phép 3, 4, 5 trả về câu của lớp quyền — **không** nhắc `guard.mjs`, **không** có chữ `CHẶN`. Phép 3 được chọn chính vì `git push` kèm cờ ép nằm trong `permissions.deny` mà **không** có trong `guard.mjs`: nó chứng minh lớp quyền tự nó có hiệu lực chứ không phải hook chặn hộ. Đối chứng ngược: công cụ `Read` trên `.gitattributes` trong cùng lượt chạy **đọc được bình thường**, nên lời từ chối ở phép 4 là luật theo đường dẫn, không phải công cụ `Read` hỏng.

  **Một quan sát đi kèm, rộng hơn luật đã viết:** phép 5 cho thấy luật `Read(./.env)` chặn cả một lệnh **Bash** chạm tới đường dẫn đó, không riêng công cụ `Read`. Phép 5 cần **đối chứng riêng** của nó, vì có một giả thuyết cạnh tranh: `defaultMode` là `dontAsk` và `ls` không nằm trong khối `allow`, nên lời từ chối có thể chỉ là "lệnh không có trong allow". Đối chứng đã chạy trong cùng lượt routine này: `ls -la .gitattributes` — **cùng một hình dạng lệnh, khác đúng đường dẫn** — **chạy bình thường**. Vậy thứ chặn là luật theo đường dẫn, không phải khối `allow`. Lớp quyền mạnh hơn cách đọc chữ trong `.claude/settings.json`. Ghi ra để không ai tưởng Bash là cửa sau — nhưng **không** dựa vào nó như một bảo đảm: đó là hành vi của nền tảng, không phải luật của repo.

  **Hook chặn rộng hơn luật đã viết, và chỗ này đáng mở thành một mục riêng.** Phép 1 là lệnh **đọc**, còn `CLAUDE.md` mục 4 chỉ cấm agent **tạo, sửa hay xoá** file trong `.github/`. Luật `/(^|\s)(rm|mv|cp|sed|tee|cat)\b[^\n]*\.github\//` của `guard.mjs` bắt cả `cat`, nên hệ quả thật là **agent không đọc được workflow đang chạy**. Đó là chặn thừa, không phải chặn sai — nhưng nó làm agent mù về đúng thứ nó phải đồng bộ qua `ops/workflows/`. `guard.mjs` nằm trong vùng `owner-merge`, nên PR này **không** đụng vào: ghi ra đây để mở một mục riêng, không sửa lén.

  **Một xác nhận thứ hai, không cố ý:** ngay trong lượt này hook còn chặn thêm một lệnh **hợp lệ** của chính agent — lệnh `python3` kèm heredoc để soạn đúng mục G11 này, vì nội dung văn bản có chứa nguyên văn chuỗi ở phép 2. Đó đúng là điểm (c) của bằng chứng 1, gặp lại trong routine: hook soi **hình dạng lệnh**, không soi ý định. Cách đi tiếp là cách `ops/test/guard.test.ts` đã dùng — ghép chuỗi từ mảnh, hoặc ghi file bằng công cụ ghi file thay vì bằng shell.

  **Cố ý KHÔNG thử, và lý do:** (a) `mcp__github__merge_pull_request` và `enable_pr_auto_merge` — `CLAUDE.md` mục 3 cấm **chính lời gọi**, không kèm điều kiện về tham số, nên không có biến thể nào "gọi thử cho an toàn" mà vẫn tuân luật: một lời gọi với số PR không tồn tại vẫn là một lời gọi. Và nếu lớp chặn hỏng thì phép thử đi thẳng vào thứ bất biến I4 cấm tuyệt đối; (b) ghi một file vào `.github/` — hỏng thì phép thử đã vi phạm `CLAUDE.md` mục 4. Hai chỗ đó ở lại mức "suy ra từ cùng một cơ chế đã quan sát được", **không** phải "đã kiểm". Một phép thử không được lấy chính cái nó bảo vệ ra làm giá.

  **Chưa kiểm:** ngữ cảnh **thread**. Chưa chặn gì, vì chưa có làn nào dựa vào thread.
- **Phần phụ thuộc:** `.claude/README.md` · `ops/test/guard.test.ts` · `ops/test/settings.test.ts` · `ops/workflows/README.md` · bất biến I4
- **Cách kiểm — và vì sao nó không tự động hoá được:** cách kiểm là cho agent thử, **trong chính một lượt routine**, một lệnh nằm trong danh sách chặn, và chọn lệnh sao cho vô hại nếu không bị chặn; rồi đọc lời báo lỗi để biết lớp nào đã chặn. Miễn phí, lặp lại được, và đó là cách bằng chứng 2 ở trên được tạo ra. Nó **không** vào được `pnpm recheck:assumptions`: `ops/test/guard.test.ts` chạy `guard.mjs` và kiểm nó **phân loại** đúng, nhưng không quan sát được điều G11 thật sự nói — **nền tảng có gọi hook hay không**. Câu đó chỉ trả lời được từ bên trong một lượt agent thật, nên nó không vào được `pnpm recheck:assumptions`. Cái chạy tự động được là hồi quy của lớp dưới: `ops/test/settings.test.ts` khoá đăng ký hook `PreToolUse` và cả 14 luật `deny`, gỡ một trong hai thì CI đỏ.
- **Dự phòng — vẫn giữ, không gỡ:** mọi thứ hook chặn đều có **lớp thứ hai không phụ thuộc G11**, ghi trong bảng ở `.claude/README.md`: `automerge.yml` chạy theo định nghĩa trên `main` (nhánh PR không sửa được), `protected-area` gắn nhãn `owner-merge` từ phía CI, và proxy GitHub của Claude cho `.github/`. G11 đúng **không** phải lý do bỏ lớp thứ hai: G11 nói về hành vi của nền tảng, mà nền tảng đổi thì không ai báo trước.
- **Trạng thái:** **đã kiểm** phần routine, 2026-09-21 (mục `VF-G11`). Phần `thread` để mở, chưa có ai dựa vào.

## G12 · Ruleset bảo vệ nhánh trên repo private cần gói GitHub Pro

- **Nội dung:** bật ruleset bảo vệ nhánh trên repo private cần gói trả phí.
- **Nguồn:** tài liệu GitHub về gói. Chính sách này đã thay đổi vài lần, nên **cần kiểm lại bằng chạy thật** chứ không đọc lại tài liệu.
- **Độ tin cậy:** **`đã kiểm`** (2026-09-21, mục `VF-G12`).
- **Phần phụ thuộc:** `ops/workflows/README.md` · `ops/lanes/platform/backlog.md` (P-006) · `ops/lanes/verify/backlog.md` · `ops/scripts/required-checks.ts` · `ops/test/required-checks.test.ts` · `ops/workflows/ci.yml`
- **Cách kiểm:** thử bật ruleset trên chính repo này với 4 status check `check`, `secret-scan`, `fix-has-test`, `protected-area`, và xem GitHub đòi gì. Miễn phí. Chỉ chủ dự án làm được. **Đã thực hiện** — chủ dự án bật và báo kết quả trên issue bản tin `#50` lúc `2026-09-21T14:01:21Z`.

  **Bằng chứng, 2026-09-21 20:16Z. Cột "nguồn" là phần quan trọng nhất của bảng này** — trang Settings → Rules nằm ngoài tầm nhìn của agent, nên không phải dòng nào ở đây cũng là phép đo, và trộn hai loại vào một nhãn "đo từ phía agent" là đúng thứ bất biến **I6** cấm:

  | Khẳng định | Nguồn | Kết quả |
  |---|---|---|
  | `main` được bảo vệ | **đo được** — liệt kê nhánh qua API GitHub, đọc cờ `protected` | `main` → **`protected: true`**; mọi nhánh `claude/*` → `false` (52 nhánh tại thời điểm đo) |
  | Ruleset tên **`protect-main`**, và nó đòi **đúng năm tên** `check`, `secret-scan`, `fix-has-test`, `protected-area`, `trailer-warn` | **lời chủ dự án, có nguồn** — issue bản tin `#50`, comment `2026-09-21T14:01:21Z`, mục 3 | Không xác minh lại được từ phía agent. Cờ `protected` bật cả với branch protection cổ điển, nên nó **không** chứng minh có một ruleset tên đó với đúng danh sách đó |
  | `ci.yml` **sinh ra** đủ năm job mang đúng năm tên đó | **đo được** — số check run trên head của mọi PR đang mở | **5/5**, đúng năm tên. Đây là bằng chứng về `ci.yml`, **không** phải bằng chứng về ruleset: hai mệnh đề độc lập nhau, và chỗ nối chúng là lời chủ dự án ở hàng trên |
  | `automerge.yml` còn merge được bằng `GITHUB_TOKEN` sau khi bật ruleset | **đo được** | **Có.** PR `#52` merge lúc `14:44:01Z` với `merged_by: github-actions[bot]` — sau mốc bật. Từ mốc đó tới `20:15Z` có **17** PR vào `main`, tất cả qua `automerge.yml`, không lần nào chủ dự án phải bấm |

- **Kết luận, tách làm hai vế đúng theo bảng trên:**
  - *`main` được bảo vệ, và lớp bảo vệ đó không cản `automerge.yml`* — **đo được**. Đây là điều mục `VF-G12` thật sự cần, và nó đủ để thôi dựa vào phương án dự phòng.
  - *Lớp bảo vệ đó là ruleset `protect-main` đòi đúng năm tên* — **lời chủ dự án, nguồn `#50`**. Đủ để hành động theo (chủ dự án là người duy nhất thấy trang đó), nhưng ghi đúng là lời chứ không phải phép đo.

  Vế "cần gói GitHub Pro" **không đo được từ phía agent** (trang thanh toán nằm ngoài tầm nhìn) và **không còn chịu tải**: nó chỉ dùng để quyết định có dựa vào ruleset hay không, mà câu đó nay đã trả lời được bằng vế thứ nhất.
- **Dự phòng — đã viết sẵn, nay không cần dùng:** không bật ruleset; dựa vào `automerge.yml` cộng hook. Giữ nguyên, không gỡ: **ruleset là lớp thứ hai của I2, không phải lớp duy nhất** — `automerge.yml` đã chỉ merge khi CI xanh, và nó chạy theo định nghĩa trên `main`. Ruleset tắt đi thì I2 vẫn còn lớp dưới.
- **Điều mới chịu tải kể từ khi ruleset bật — và nó nặng hơn chính giả định gốc:** năm **tên** status check nay là hợp đồng giữa một cấu hình **ngoài repo** (Settings → Rules) và `ops/workflows/ci.yml` **trong repo**. Đổi tên, gộp hay xoá một trong năm job đó là một thay đổi mà `pnpm check` vẫn xanh, CI của chính PR đó vẫn xanh, PR merge đẹp — rồi ruleset đứng chờ một tên không còn ai sinh ra, nên **mọi** PR sau đó kẹt ở `mergeable_state: "blocked"` và `automerge.yml` không merge được gì. Nhóm lỗi **Z**, và là ca nhóm Z khoá được cả nhà máy.

  Hai lớp giữ chỗ đó, theo đúng luật "kiểm ở chỗ rẻ nhất":

  1. **Máy chặn:** `ops/scripts/required-checks.ts` giữ danh sách năm tên, `ops/test/required-checks.test.ts` đối chiếu với tên job thật trong `ci.yml`. Đo bằng phá thật: đổi `name: protected-area` thành `name: protected` → **đúng một bài đỏ**, chỉ tên đó; khôi phục → xanh. Bài kiểm **không** sửa được ruleset, nó chỉ bảo đảm hỏng hóc lộ ra **trước** khi PR merge.
  2. **Luật:** đổi danh sách đó là quyết định **`irreversible`** — CHARTER 2.3 **nhóm 8**, theo chỉ dẫn của chủ dự án trên issue `#50`. Phải mở `🤖 [QĐ]` để chủ dự án cập nhật ruleset **trước**, vì chỉ chủ dự án vào được trang Settings.

  Một điểm dễ hiểu nhầm, đã kiểm: `trailer-warn` là **luật mềm** (CHARTER mục 4, `CLAUDE.md` mục 6) mà nay nằm trong danh sách check bắt buộc. Nó **không** vì thế thành luật cứng — bước chạy của job khai `continue-on-error: true` nên job luôn kết luận `success` dù có bao nhiêu commit thiếu trailer. Cái ruleset đòi là *job có chạy và có kết luận*, không phải *không có cảnh báo nào*. Nên mục 6 của `CLAUDE.md` vẫn đúng nguyên văn.
- **Trạng thái:** **đã kiểm**, mục `VF-G12` đóng. Không mở `🤖 [QĐ]` — không có gì để hỏi: câu hỏi đã có câu trả lời, và hệ quả của nó là `reversible` nên làm ngay theo CHARTER 2.3.

## G13 · Actions gọi được API trigger `/fire` của routine

- **Nội dung:** GitHub Actions gọi được API trigger của một routine Claude, để `decision-relay.yml` đánh thức routine `crux-decision` ngay khi chủ dự án trả lời.
- **Nguồn:** tài liệu — API đang ở giai đoạn beta.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/lanes/platform/backlog.md` (P-002) · `ops/lanes/verify/backlog.md` · CHARTER 2.3
- **Cách kiểm:** gọi thử API trigger từ một workflow `workflow_dispatch`. Cần G1 đã kiểm trước.
- **Dự phòng — đã viết sẵn:** giữ độ trễ bằng một nhịp worker. `decision-relay.yml` và routine `crux-decision` **đã được hoãn** sang Đợt 1 chính vì giả định này (CHARTER mục 9). Không có gì ở Đợt 0 dựa vào nó.
- **Trạng thái:** hoãn tới Đợt 1. Nếu sai, mục `P-002` chuyển `parked` và **không tìm cách khác** — độ trễ một nhịp worker là chấp nhận được.

## G14 · Commit của routine và thread có trailer `Claude-Session`

- **Nội dung:** commit do routine và thread tạo mang trailer `Claude-Session: <url>`, và mô tả PR có link phiên. Đây là **dấu vết duy nhất phân biệt người với máy** trong lúc chưa tách danh tính (mặc định M6).
- **Nguồn:** tài liệu Claude Code về `attribution.sessionUrl`.
- **Độ tin cậy:** **`đã kiểm một phần`**

  **Bằng chứng, 2026-09-20 (phiên cloud tương tác):** cả hai commit của Đợt 0 mang trailer `Claude-Session: https://claude.ai/code/session_…`, đọc được bằng `git log --format='%(trailers:key=Claude-Session,valueonly=true)'`. Commit `e01a667` do chủ dự án upload qua web thì **không** có trailer — nghĩa là trailer thật sự phân biệt được hai nguồn.

  **Bằng chứng, 2026-09-21 (lần quan sát tự động đầu tiên):** `pnpm recheck:assumptions` quét các commit trên `origin/claude/*` chưa vào `main` và thấy **mọi commit của agent ở đó đều mang trailer**, trong đó có `b244b1e` do routine `crux-integrator` tạo. Đây là bằng chứng đầu tiên từ ngữ cảnh **routine**, chứ không phải phiên tương tác. Nhưng nó **chưa đóng được** phần chưa kiểm: bài kiểm không phân biệt được routine với thread, và các commit còn lại trong lần quét là của chính phiên đang viết mục này — bằng chứng tự dẫn chính mình. Cái bài kiểm thật sự bảo đảm là **hồi quy**: hôm nào trailer thôi được ghi thì nó đỏ ngay. Phần phân biệt routine/thread vẫn ở `VF-G14`.

  **Một phát hiện đi kèm, và nó đổi cách đọc G14:** repo merge bằng **squash**, mà commit squash do GitHub tạo giữ lại `Co-Authored-By` nhưng **mất** `Claude-Session` — trailer bị đẩy vào giữa message ghép nên không còn nằm ở khối trailer cuối. Hệ quả: **trên `main` gần như không commit nào có trailer**, và điều đó không nói gì về G14. Muốn kiểm G14 thì phải đọc commit **trên nhánh PR**. Job `trailer-warn` đọc đúng khoảng `origin/<base>..HEAD` nên không dính lỗi này; bài kiểm tự động lần đầu viết ra thì có, và đã sửa.
- **Phần phụ thuộc:** `ops/workflows/ci.yml` (job `trailer-warn`) · `CLAUDE.md` mục 6 · `ops/scripts/recheck-assumptions.ts` · CHARTER 3.1
- **Cách kiểm phần còn lại:** đọc kết quả job `trailer-warn` trên các PR do routine mở, trong một tuần. Miễn phí, và tự động.
- **Kiểm tự động:** `session-trailer-on-branch` — quét 14 ngày commit trên các nhánh `origin/claude/*` **chưa vào `main`**, và đòi mọi commit ở đó mang `Claude-Session`. Commit do **công cụ** tạo (merge commit của `integrator-resolve.ts`, message mặc định của `git merge`) được loại bằng một **danh sách trắng hẹp theo subject**, không phải bằng "commit nào thiếu `Co-Authored-By` thì là của công cụ" — luật sau fail-open đúng vào kịch bản phải bắt, vì hôm nền tảng tắt `attribution` thì cả hai trailer biến mất cùng lúc và mọi commit của agent bị xếp nhầm sang nhóm công cụ.

  Bài kiểm **tự fetch cả hai đầu vào** của phép quét trước khi quét (mục `I-005`): `+refs/heads/claude/*:refs/remotes/origin/claude/*` (tập cần quét) và `+refs/heads/main:refs/remotes/origin/main` (phép loại `^main`). Thiếu vế đầu thì bài kiểm quét một tập rỗng và in `◦ chưa quan sát được` — im lặng bỏ qua ở **chế độ chạy mặc định** của cả ba routine. Thiếu vế sau thì tệ hơn, vì nó ra **số sai**: `origin/main` của clone đứng yên ở lúc clone, nên commit **squash** của `main` — vốn đã bị bước 0 của phụ lục P3 gộp vào nhánh PR — lọt qua phép loại, mà commit squash thì mất trailer, nên G14 ra `sai` giả và lệnh in sẵn một thân issue `🤖 [QĐ]` cho một giả định chẳng hề đổi trạng thái. Cả hai đều là nhóm lỗi Z, chỉ khác mặt.

  Bản sửa đầu của `I-005` ném **vô điều kiện** khi `for-each-ref` cục bộ (sau fetch) rỗng — đúng cho ca "chưa quét được", nhưng gộp nhầm với một ca khác: kho **thật sự** không còn nhánh `claude/*` nào (mọi PR đã merge, nhánh đã xoá). Đó vẫn là một quan sát hợp lệ, không phải lỗi, nhưng bản sửa đầu biến nó thành `broken` giả — cùng nhóm lỗi Z, chỉ đổi "im lặng sai" (bản gốc) sang "kêu oan" (bản sửa `I-005`). Mục `I-007` tách hai ca bằng cách hỏi thẳng remote (`listRemoteClaudeBranches`, `git ls-remote --heads origin 'refs/heads/claude/*'`), không phụ thuộc kết quả fetch cục bộ: remote xác nhận rỗng thì trả `[]` và in `◦ chưa quan sát được`; remote không xác nhận được rỗng, hoặc chính `ls-remote` lỗi, thì vẫn ném và ra `⚠ … KHÔNG CHẠY ĐƯỢC`. Test dựng kho bare thật cho cả hai nhánh (`ops/test/recheck-assumptions.test.ts`), cùng quy ước với các bài kiểm G14/G17 khác trong file — không mô phỏng.

  Hai giới hạn khai trước: (a) bài kiểm canh **hồi quy** "trailer còn được ghi không", nó **không** phân biệt được commit của routine với commit của thread — git không có trường nào cho việc đó, nên phần phân biệt ấy vẫn nằm ở `VF-G14`; (b) **trên `main` gần như không có trailer nào**, vì repo merge bằng squash và commit squash giữ `Co-Authored-By` nhưng mất `Claude-Session` — muốn kiểm G14 thì phải đọc commit trên nhánh PR, không đọc `main`.
- **Dự phòng — đã viết sẵn:** dựa vào quy ước 🤖 và log làn. CI **chỉ cảnh báo**, cố ý không chặn (CHARTER mục 4): nếu nền tảng đổi cách ghi trailer thì một luật cứng ở đó sẽ chặn toàn bộ công việc.
- **Trạng thái:** giao làn `verify` mục `VF-G14` cho phần routine.

## G15 · Các mục 1–19 trong Phần L của spec tham chiếu

- **Nội dung:** các giả định nghiệp vụ trong Phần L của spec tham chiếu, mỗi mục một giả định riêng với độ tin cậy riêng.
- **Độ tin cậy:** theo từng mục.
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · `CLAUDE.md`
- **Cách kiểm:** chia nhỏ thành mục con **khi một làn cần tới một mục cụ thể**.
- **Dự phòng:** không cần — `parked` nghĩa là chưa có gì xây lên trên G15, nên không có gì để dự phòng. Khi một làn tách ra một mục con, mục con đó mới phải có dự phòng riêng theo luật 2.
- **Trạng thái:** `parked`. Mở cả 19 mục bây giờ là mở rộng phạm vi không có người tiêu thụ — đúng thứ ngân sách độ phức tạp ở CHARTER mục 9 cấm.

## G16 · Phiên cloud và routine chạy trọn mà không cần người bấm cấp quyền

- **Nội dung:** sau khi bỏ hẳn khối `ask` và đặt `permissions.defaultMode` thành `dontAsk`, một phiên cloud hoặc một lần chạy routine đi hết một mục backlog — sửa file, chạy `pnpm check`, commit, push, mở PR, gắn nhãn — mà **không lần nào dừng lại chờ người bấm cấp quyền**.
- **Nguồn:** tài liệu Claude Code về `permissions.defaultMode` cho biết `dontAsk` thì không hỏi nữa. Nhưng việc một **routine chạy không có người** thật sự đi trọn một mục thì chưa có nguồn nào xác nhận: routine còn có thể dừng vì lý do khác — hết lượt, hết giờ, hoặc một công cụ không nằm trong `allow` mà cũng không nằm trong `deny`. Vì thế giả định này ở mức `suy luận`, không phải `tài liệu nói vậy`.
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `.claude/README.md` · `ops/lanes/verify/backlog.md`
- **Ghi chú truy vết:** file thật sự dựa vào G16 là `.claude/settings.json`. Nó là JSON nên không mang được comment, không ghi được mã giả định vào trong — vì thế mã nằm ở `.claude/README.md` ngay cạnh, và cột trên trỏ vào đó. Đây là ngoại lệ duy nhất của luật 1, và nó được ghi ra thay vì im lặng.
- **Cách kiểm:** **chạy thật một routine** và xem nó có đi hết một mục backlog không. Không đọc tài liệu — đây đúng loại giả định mà luật 3 nói tới. Bằng chứng cần thu: lần chạy đó có mở được PR và gắn được nhãn, hay dừng giữa chừng ở một lời hỏi. Chỉ chủ dự án bật được routine, nên mục này phụ thuộc G1.
- **Vì sao `dontAsk` chứ không phải `bypassPermissions`:** `bypassPermissions` là mức cao nhất trong thang, nhưng nó bỏ qua **toàn bộ** kiểm tra quyền, kể cả khối `deny`. Chọn nó là tự tay gỡ lớp thứ nhất của bất biến I4. `dontAsk` không hỏi gì nữa mà `deny` và hook `guard.mjs` vẫn có hiệu lực, nên nó là **mức cao nhất còn giữ được cả hai lớp chặn**.
- **Dự phòng — đã viết sẵn:** quay `defaultMode` về `acceptEdits` và chấp nhận phải bấm tay ở đúng những chỗ ghi trong nhật ký lần chạy hỏng. Không mất gì về kiến trúc, chỉ chậm hơn và cần người. Việc quay lại là một dòng trong `.claude/settings.json`, và PR đó là `owner-merge` như mọi PR chạm vùng bảo vệ.
- **Rủi ro còn lại:** giả định này **đánh đổi rào chắn lấy tốc độ**. Khối `ask` trước đây là lớp thứ ba cho vùng bảo vệ — một người đọc diff trước khi agent chạm `CHARTER.md`. Bỏ nó đi thì vùng bảo vệ còn hai lớp: nhãn `owner-merge` do workflow `protected-area` gắn từ phía CI, và hook `guard.mjs`. Cả hai đều **không** phụ thuộc vào việc agent tự giác, và đó là điều làm việc bỏ `ask` chấp nhận được. Ngược lại, giữ `ask` trong một routine không có người ngồi cạnh thì mỗi lời hỏi là một lần treo tới khi hết giờ — một lần chạy hỏng mà **không chỉ báo nào đỏ**, đúng nhóm lỗi đang được rà ở `ops/known-failures.md`.
- **Trạng thái:** đang dựa vào, có dự phòng. Giao làn `verify` mục `VF-G16`. Chuyển sang `đã kiểm` khi lần chạy routine đầu tiên đi trọn một mục backlog.

---

## G17 · `merge=union` làm xung đột file log biến mất trong vận hành thật

- **Nội dung:** đặt `merge=union` trong `.gitattributes` cho `ops/logs/*.jsonl` là đủ để hai PR song song trong cùng một làn **không còn** kẹt vì xung đột log. Đây là giả định mà `P-015` và KF-005 được xây lên trên.
- **Nguồn:** hai lần chạy thử trong `P-015` — cả hai đều cho union giữ cả hai dòng, 0 dấu xung đột.
- **Độ tin cậy:** **`sai`**

  **Bằng chứng, 2026-09-21 (vận hành thật):** `.gitattributes` đã nằm trên `main` từ khi PR #13 merge. Ngay sau đó, PR #11 **vẫn** báo xung đột ở `ops/logs/platform.jsonl`, và lệnh `git merge origin/main` trong phiên cũng **vẫn** sinh dấu xung đột ở đúng file đó. Union không cứu được lần nào.

  **Vì sao — đã tách ra bằng hai lần chạy thử có đối chứng**, chứ không suy luận:

  | Lần thử | Nhánh có `.gitattributes` lúc **bắt đầu** gộp? | Kết quả |
  |---|---|---|
  | 1 — tái hiện đúng PR #11: nhánh tách ra trước, `main` mang luật vào cùng lần gộp | **Không** | **CONFLICT**, 1 dấu xung đột |
  | 2 — cùng repo đó, chỉ khác: lấy `.gitattributes` vào nhánh trước rồi mới gộp | **Có** | Merge sạch, **0 dấu xung đột**, giữ cả hai dòng |

  Kết luận: **git đọc `.gitattributes` của nhánh đích ở trạng thái TRƯỚC lần gộp.** Một luật merge do `main` mang tới **không tự áp cho chính lần gộp mang nó tới**. Hai lần thử của `P-015` đều đặt luật sẵn ở commit gốc, nên cả hai đều bỏ sót đúng điều kiện đã làm hỏng việc thật.

  **Câu hỏi còn mở nay đã trả lời — 2026-09-22, và câu trả lời là KHÔNG.** Bằng chứng ở PR #11 phía trên **không** nói được gì về GitHub: lúc đó git ở phía dưới cũng xung đột thật, nên GitHub báo xung đột là **đúng**. Ca kiểm mà mục `VF-G17` mô tả — hai PR **đều đã mang sẵn** `.gitattributes`, cùng ghi vào **một** file append-only — từ đó đã xảy ra thật, và được đo **hai lần độc lập**:

  | Lần quan sát | PR | `mergeable_state` GitHub tự tính | `git merge-tree --write-tree` ở phía worker |
  |---|---|---|---|
  | lượt `crux-integrator`, 2026-09-22 02:05 giờ VN | `#56`, `#65` | `dirty` | `EXIT=0`, gộp sạch |
  | lượt `crux-worker-1`, 2026-09-21 19:38Z | `#75` | `dirty` | `EXIT=0`, gộp sạch |

  Lần quan sát thứ hai tách biến sạch hơn lần đầu, và đó là lý do nó đáng ghi riêng: `base.sha` của `#75` **đúng bằng** `main` tại lúc đo (`296869b`), nên `dirty` không thể là trạng thái cũ GitHub chưa tính lại; và file **duy nhất** mà nhánh với `main` cùng chạm là `ops/logs/platform/P-016.jsonl`, vốn đã khai `merge=union`. Bật/tắt đúng một biến trên cùng một phép đo: union bật → `EXIT=0`; ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes` (thắng `.gitattributes` trong cây) → `EXIT=1`, `CONFLICT (content) in ops/logs/platform/P-016.jsonl`; xoá dòng đó đi → `EXIT=0` trở lại. Và một **đối chứng chặt hơn**, vì `-merge` là *unset* nên git rơi về trình merge nhị phân và luôn báo xung đột (kèm `warning: Cannot merge binary files`, dù file là văn bản thuần): chạy lại với `merge=text` — trình văn bản thường — vẫn `EXIT=1`, `CONFLICT (content)`, **không** cảnh báo nhị phân. Chênh lệch giữa hai phía đúng là do luật union, không phải do cách tắt luật.

  **Hệ quả:** `.gitattributes` một mình không bao giờ đủ, vì lớp tự merge chỉ nghe **một** phía — phía GitHub, phía không áp luật. Ghi đầy đủ ở `ops/known-failures.md` **KF-009**. Kết luận này **không** làm đổi trạng thái giả định nào: G17 đã `sai` và đã chuyển dự phòng từ trước. Nó siết thêm lý do dự phòng (`P-016`, bước 0 của phụ lục P3) phải chạy ở đầu **mọi** lượt worker chứ không phải một lần mỗi ngày.
- **Phần phụ thuộc:** `ops/known-failures.md` · `ops/lanes/platform/backlog.md` · `ops/lanes/verify/backlog.md` · `.gitattributes` · `ops/scripts/recheck-assumptions.ts` · `kernel/src/log.ts` · `ops/test/step0-log-path.test.ts` (mục `P-023`: hình dạng "một lượt chạy, một file" cho dòng bước 0 được **thúc đẩy bởi** G17 — nếu G17 hết `sai`, hình dạng này vẫn đúng và vẫn nên giữ, nó chỉ bớt cấp bách)
- **Cách kiểm:** hai PR song song cùng làn, **cả hai** đã mang `.gitattributes`, cùng ghi vào **một** file append-only. Từ `D-C04`, log tách tới mức mục nên hai PR khác mục không còn dùng chung file — ca kiểm phải là hai lần chạy của **cùng một mục** (`ops/logs/<lane>/<id>.jsonl`), hoặc `docs/visual/calibration-log.jsonl`. Merge một PR, rồi đọc trạng thái `mergeable` của PR kia trên GitHub **và** chạy `git merge origin/main` ở phía worker. Hai câu trả lời có thể khác nhau, và phải ghi cả hai. **Đã thực hiện, hai lần độc lập** (2026-09-22 và 2026-09-21 19:38Z) — hai câu trả lời **đúng là khác nhau**, cả hai đã ghi ở phần độ tin cậy trên.
- **Kiểm tự động:** `union-merge-order` — dựng hai repo git thật trong thư mục tạm, khác nhau **đúng một điều kiện**: nhánh đã mang `.gitattributes` trước lần gộp hay chưa. Bài kiểm không đi tìm lại kết luận `sai` đã có, mà canh **hai điều kiện dự phòng đang đứng lên trên**: (1) luật do `main` mang tới vẫn KHÔNG áp cho chính lần gộp mang nó tới — nếu git đổi hành vi này thì G17 hết `sai`; (2) union VẪN cứu được lần gộp khi nhánh đã mang sẵn luật — nếu hỏng thì `.gitattributes` thành đồ trang trí và KF-005 phải viết lại. Phần *GitHub tự tính `mergeable`* thì **không** tự kiểm được ở đây: nó cần hai PR thật trên GitHub. Phần đó nay **đã trả lời bằng quan sát** (xem độ tin cậy ở trên và `KF-009`) chứ không bằng bài kiểm tự động — và nó vẫn sẽ không tự kiểm được, nên thứ canh nó là bước 0 của phụ lục P3 cộng dòng log bắt buộc, không phải `pnpm recheck:assumptions`.
- **Dự phòng — đã chuyển sang, không còn là ghi chú:** union giữ lại vì nó vẫn cứu được mọi lần gộp **sau khi** nhánh đã mang luật — không mất gì. Nhưng nó không còn được coi là cơ chế chính. Cơ chế chính chuyển sang mục `P-016`: routine integrator **tự gộp `main`** vào mọi PR đang mở bị xung đột mà nó giải được, chạy `pnpm check`, rồi push. Việc giải xung đột trở thành việc của máy, không phải việc của người.
- **Bài học chung, vượt ra ngoài mục này:** hai lần thử của `P-015` là chạy thật, và vẫn cho kết luận sai — vì cả hai đều dựng ở **trạng thái sau cùng**, không dựng ở trạng thái mà lỗi thật sẽ xảy ra. "Kiểm bằng chạy thật" (CHARTER 11.1 luật 3) chưa đủ. Bài thử phải tái hiện **đúng điều kiện đầu vào của lần chạy thật**, và điều kiện dễ bỏ sót nhất là *thứ tự thời gian*: ai có gì, vào lúc nào.
- **Trạng thái:** `sai`, đã chuyển dự phòng ngay trong cùng PR ghi nhận nó (quyết định `reversible` theo CLAUDE.md mục 7). **Phần còn mở đã đóng ngày 2026-09-22** (mục `VF-G17`, làn `verify`): GitHub **không** dùng `.gitattributes` khi tự tính `mergeable`. Không còn câu hỏi nào treo ở giả định này; trạng thái `sai` giữ nguyên, dự phòng giữ nguyên.

---

## Cách thêm một giả định

1. Thêm một dòng vào **Bảng tổng** và một mục đầy đủ ở dưới, đủ bảy phần: nội dung, nguồn, độ tin cậy, phần phụ thuộc, cách kiểm, dự phòng, trạng thái.
2. **Ghi mã giả định vào từng file liệt kê ở cột *Phần phụ thuộc***, dưới dạng comment hoặc một dòng trong tài liệu. `pnpm assumptions` kiểm việc này và đỏ nếu thiếu.
2b. Nếu giả định **kiểm được bằng máy**, thêm một phần `**Kiểm tự động:** \`<mã bài kiểm>\`` và đăng ký bài kiểm cùng mã đó trong `ops/scripts/recheck-assumptions.ts`. Khai một mã không có bài kiểm thì `pnpm assumptions` đỏ — sổ và code không trôi khỏi nhau được. Không kiểm được bằng máy thì **không** thêm phần này: khi đó `pnpm recheck:assumptions` liệt kê mục đó vào nhóm "cần người", và đó là câu trả lời đúng, không phải một ô bỏ trống.
3. Thêm một mục `VF-<mã>` vào `ops/lanes/verify/backlog.md`.
4. Nếu giả định chưa có dự phòng viết sẵn thì **không được xây gì lên trên nó** (luật 2).

## G18 · `pnpm install --lockfile-only` giữ nguyên phép phân giải cũ của lockfile bản mồi

- **Nội dung:** khi trong cây đã có sẵn một `pnpm-lock.yaml`, `pnpm install --lockfile-only` **giữ lại** mọi phiên bản đã phân giải còn thoả manifest, và chỉ tính lại phần buộc phải đổi. Nó không phân giải lại từ đầu.
- **Vì sao nó chịu tải:** toàn bộ cơ chế tạo lại lockfile của mục `I-004` đứng trên đây. Nếu sai, mỗi lần integrator giải một xung đột lockfile sẽ **âm thầm nâng phiên bản của hàng trăm gói phụ thuộc gián tiếp** — một thay đổi lớn không ai yêu cầu, đi kèm một PR nói rằng nó chỉ giải xung đột. Không gì đỏ; đúng nhóm lỗi Z.
- **Độ tin cậy:** **`đã kiểm`** — bằng chạy thật, không bằng đọc tài liệu.

  **Bằng chứng, 2026-09-21.** Một workspace tạm, phụ thuộc thật từ registry, hai lần chạy khác nhau **đúng một điều kiện** — có bản mồi hay không:

  | Điều kiện đầu vào | `pnpm install --lockfile-only` cho ra |
  |---|---|
  | lockfile cũ còn nguyên (đã phân giải `semver@7.5.0`), manifest nới thành `^7.0.0` | **giữ `semver@7.5.0`** |
  | xoá lockfile, sinh từ số không, cùng manifest `^7.0.0` | **`semver@7.8.5`** |

  Hai dòng này là cùng một manifest, nên chênh lệch đo được chính là tác dụng của bản mồi. `semver` được chọn vì nó có nhiều bản phát hành trong cùng một dải `^7`.
- **Phần phụ thuộc:** `ops/scripts/integrator-lockfile.ts` · `ops/lanes/integration/backlog.md` (I-004)
- **Cách kiểm lại:** lặp đúng hai dòng trong bảng trên. Cố ý **không** đăng ký vào `pnpm recheck:assumptions`: bài kiểm này cần gọi registry npm, mà các lệnh kiểm của repo phải chạy được khi không có mạng — một bài kiểm im lặng bỏ qua vì không ra được internet còn tệ hơn là không có bài kiểm nào. Mục `VF-G18` giữ phần kiểm định kỳ.
- **Dự phòng — chưa cần viết sẵn:** nếu giả định này hoá ra sai, cơ chế `I-004` không mất an toàn, nó chỉ mất tính "ít xáo trộn nhất": lockfile vẫn khớp manifest và CI vẫn gác. Khi đó `integrator-lockfile.ts` chuyển sang `aborted-ineligible` cho mọi xung đột lockfile và giao lại cho người — một dòng sửa, hành vi quay về đúng như trước mục `I-004`.
- **Trạng thái:** đã kiểm, đang được dùng. Kiểm lại khi nâng `pnpm` qua một phiên bản chính.

## G19 · Hạn mức `search.list` của YouTube Data API

- **Nội dung:** method `search.list` có bucket **riêng** 100 lần gọi mỗi ngày, mỗi lần 1 đơn vị, và mỗi trang kết quả tiếp theo tốn thêm một lần gọi. Bucket này không dùng chung với `videos.insert`, nên xây corpus không tranh quota với việc đăng video.
- **Vì sao nó chịu tải:** toàn bộ ngân sách quota của corpus đối thủ (`packs/channels/us-personal-finance/quota-budget.md`) và cửa dừng `quotaGate` đứng trên con số 100. Sai theo hướng **thấp hơn** thì một lần xây corpus tiêu hết quota của ngày mà cửa dừng không kịp đóng — và vì `search.list` không dùng chung bucket với việc đăng, hỏng đó **không** lan sang lịch phát hành, nhưng nó vẫn làm mọi việc tìm kiếm khác trong ngày chết lặng.
- **Nguồn:** tài liệu nhà cung cấp. **Chưa đọc Cloud Console** — WP-014 mục 7 đòi đúng việc đó, và phiên cloud không có project nào để mở.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `workshops/topic/src/corpus.ts` · `packs/channels/us-personal-finance/quota-budget.md` · `ops/lanes/topic/backlog.md` (T-008, T-011)
- **Cách kiểm:** mở Google Cloud Console của project, đọc hạn mức thật của `search.list`, so với 100. **Chỉ chủ dự án làm được** — cần tài khoản và một project có bật API. Cố ý **không** đăng ký vào `pnpm recheck:assumptions`: bài kiểm này cần gọi ra ngoài, mà các lệnh kiểm của repo phải chạy được khi không có mạng.
- **Dự phòng — lớp một đã viết sẵn, lớp hai CHƯA có code (khai rõ, không để câu khai đứng một mình):** con số **không nằm trong code**. `quotaGate` nhận `searchCallsPerDay` và `reserveFraction` làm tham số, và cả hai đọc từ trường `quota.limits` của chính ảnh chụp corpus. Giả định sai thì sửa đúng một số trong dữ liệu, không sửa dòng code nào — đây là **lớp một**, đã kiểm bằng chạy thật (xem dưới). **Lớp hai (đọc hạn mức thật ra từ `quota.spent.searchCalls` khi nhà cung cấp trả 429) HIỆN CHƯA TỒN TẠI:** đo 2026-09-22 (mục `topic/T-012`), `grep -rn "429" workshops/ kernel/ ops/scripts/` ra **0 kết quả**. Nó thuộc phần **xây** corpus (`T-011`), phần duy nhất gọi API và gặp được 429 — mà `T-011` đang chặn vì chưa có secret nào. Nên tới khi `T-011` chạy, dự phòng của G19 **chỉ có lớp một**; `CLAUDE.md` mục 7 cho phép xây trên giả định chưa kiểm chỉ khi dự phòng đã viết sẵn, và lớp một đã đủ cho phần đang chạy (không gọi API). Lớp hai là tiêu chí xong của `T-011`, không phải của mục này.

  **Đã kiểm bằng chạy thật, 2026-09-22 (lượt `crux-worker-1`, `main` ở `f873967`)** — câu "con số không nằm trong code" ở trên nay là số đo, không phải lời hứa: `quotaGate` nhận hạn mức qua tham số `QuotaState` và thân hàm chỉ đọc `state.*`, **không hằng số nào**. (Chuỗi `100` có mặt trên hai dòng trong `workshops/topic/src/`, không dòng nào là hạn mức: `corpus.ts:227` là chú thích của `quotaGate`, `demand.ts:120` là hệ số làm tròn `Math.round(… * 100) / 100`.) giá trị thật nằm ở `workshops/topic/data/corpus/us-personal-finance-2026-09-01.json` kèm `source: "vendor-docs"`, và `corpus.v0.schema.json` bắt trường đó bằng `enum`. Test `workshops/topic/test/corpus.test.ts:132` khẳng định `source === 'vendor-docs'`.

  **Chỗ dự phòng trước đây chưa phủ, nay đã phủ (mục `topic/T-012`):** bảng `quota-budget.md` có hai dòng số nhưng cửa dừng vẫn chỉ tiêu thụ `searchCallsPerDay` — nó đếm **lần gọi**, không đếm **đơn vị**. Trước `T-012`, `unitsPerCall` không tồn tại trong code, nên nếu Cloud Console hiển thị hạn mức theo đơn vị thì giữa số đọc được và số code dùng có một phép chia làm bằng tay — một chỗ sai số đi vào mà không gì đỏ. Từ `T-012`: `quota.limits` **có** `unitsPerCall` và `unitsPerDay` (hai số nguyên bản của #101 ghi thẳng vào dữ liệu); phép chia nằm ở đúng một chỗ có test (`deriveSearchCallsPerDay`, làm tròn xuống); và `corpusProblems` đỏ khi `searchCallsPerDay` lệch phép dẫn xuất, và khi hai dòng hạn mức của `quota-budget.md` (`parseQuotaBudget`) lệch `quota.limits` của corpus. Issue **#101** vẫn xin hai số nguyên bản như Console hiển thị, không xin số đã quy đổi.
- **Trạng thái:** `tài liệu nói vậy`, giao làn `verify`, mục `VF-G19` — **`parked` từ 2026-09-22**, vì bài kiểm nằm ngoài repo và chỉ chủ dự án chạy được (issue **#101** nêu ba phương án; có câu trả lời thì mục mở lại thành `ready`). Phần đã làm của `T-008` (contract, kiểm mới lạ, ba đại lượng nhu cầu) **không** đứng trên giả định này — nó chạy trên corpus có sẵn và không gọi API. Phần **xây** corpus (`T-011`) thì có, và đang chặn ở chỗ khác nặng hơn: chưa có secret nào.

## G20 · Giá API embeddings, và `usage.total_tokens` là số được tính tiền

- **Nội dung:** hai vế, và chúng chịu tải khác nhau.
  1. Giá công bố của ba model embeddings OpenAI — `text-embedding-3-small` $0,02, `text-embedding-3-large` $0,13, `text-embedding-ada-002` $0,10 cho mỗi triệu token.
  2. Trường `usage.total_tokens` trong phản hồi của `/v1/embeddings` là **số token được tính tiền** của đúng lời gọi đó, không phải một số xấp xỉ hay một số đã làm tròn theo lô.
- **Vì sao nó chịu tải:** chủ dự án đã chốt OpenAI cho embeddings và cấp secret riêng `EMBEDDINGS_API_KEY` **để theo dõi chi phí tách biệt** (chỉ dẫn `#251`, `2026-09-25T01:28:33Z`). Nếu vế 2 sai thì mọi `costUsd` mà mục `T-014` ghi vào `ops/logs/topic/T-014.jsonl` là số sai — và vì bất biến **I6** đòi mỗi con số hiển thị có nguồn, một con số sai ở đây đi thẳng vào bản tin chi phí mà không chỉ báo nào đỏ. Vế 1 chịu tải nhẹ hơn: nó chỉ quyết định model nào được **chọn**, và phép chọn "rẻ nhất đủ chất lượng" sai thì hậu quả là trả đắt hơn cần, không phải trả sai.
- **Nguồn:** trang giá chính thức của nhà cung cấp, đọc `2026-09-25`. **Chưa đối chiếu hoá đơn thật** — chưa có lời gọi nào được trả tiền.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `workshops/topic/src/embeddings.ts` · `workshops/topic/data/embeddings/openai-2026-09-25.json` · `ops/scripts/novelty-embeddings-trial.ts` · `ops/lanes/topic/backlog.md` (T-014)
- **Cách kiểm:** chạy `pnpm topic:novelty-trial` với secret thật (trong Actions, không trong phiên agent), rồi so tổng `costUsd` của các dòng `ops/logs/topic/T-014.jsonl` với **hoá đơn** của khoá `EMBEDDINGS_API_KEY` trong cùng kỳ. Lệch quá làm tròn là vế 1 hoặc vế 2 sai, và hai vế phân biệt được: số token khớp mà tiền lệch là giá sai (vế 1); số token không khớp số lần nhúng là vế 2 sai. Cố ý **không** đăng ký vào `pnpm recheck:assumptions`: bài kiểm này cần gọi ra ngoài và tốn tiền, mà các lệnh kiểm của repo phải chạy được khi không có mạng và không được tự tiêu tiền.
- **Dự phòng — đã viết sẵn, hai lớp:**
  - **Lớp một (vế 1):** giá **không nằm trong code**, đúng khuôn `G19`. Nó ở `workshops/topic/data/embeddings/*.json` kèm `source: "vendor-docs"`, contract `embedding-models.v0.schema.json` bắt trường đó bằng `enum` và có sẵn giá trị `invoice-measured` cho ngày đối chiếu được hoá đơn. Giả định sai thì sửa một số trong dữ liệu, không sửa dòng code nào — `readEmbeddingModelTable` validate rồi mới trả, nên một số điền cho có không lọt vào phép chọn.
  - **Lớp hai (vế 2):** `costUsd` của một lần chạy **không** ước lượng từ số ký tự hay số đoạn văn bản; nó tính từ `usage.total_tokens` do chính nhà cung cấp trả về (`costUsdFor`). Nếu vế 2 sai, chỗ phải sửa là đúng một hàm, và số token thô vẫn nằm trong dòng log nên tính lại được về sau mà không phải gọi lại API.
- **Trạng thái:** `tài liệu nói vậy`, giao làn `verify`, mục `VF-G20`. **Chưa có lời gọi trả tiền nào**, nên vế 2 chưa từng được quan sát — mục `T-014` khai đúng điều đó thay vì để câu "đã tính từ usage thật" đứng một mình.
