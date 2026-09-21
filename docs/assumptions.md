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
| G1 | Tài khoản có Claude Code Projects | `suy luận` | giao làn `verify` | `VF-G1` |
| G2 | `automerge.yml` merge được bằng `GITHUB_TOKEN` và gọi được `main-ci` | **`đã kiểm một phần`** | lõi DoD đã kiểm, `labels`/`sync-workflows` chưa | DoD Đợt 0, `VF-G2` |
| G3 | Trần số lần chạy routine mỗi ngày đủ cho 2–3 worker cộng 2 routine | `suy luận` | giao làn `verify` | `VF-G3` |
| G4 | Hạn mức gói Claude chịu được 3 worker song song | `suy luận` | giao làn `verify` | `VF-G4` |
| G5 | Quota phút Actions và dung lượng artifact đủ cho việc render | `suy luận` | giao làn `verify` | `VF-G5` |
| G6 | App YouTube API chưa qua kiểm tuân thủ thì video tải lên bị khoá riêng tư | `tài liệu nói vậy` | không cần đổi gì | `VF-G6` |
| G7 | Điều khoản TTS, stock, font, bản đồ cho phép dùng thương mại và B2B | **`đã kiểm một phần`** — xong cho giấy phép font `OFL-1.1`; TTS, stock, bản đồ **không đọc được từ phiên cloud** | `VF-G7` `parked` · **vẫn chặn** làn `audio` | `VF-G7`, `AU-001` |
| G8 | Có đường nhận tiền và nộp thuế cho người ở Việt Nam | `suy luận` | giao làn `verify` | `VF-G8` |
| G9 | Thuê được người soát bản địa và giao việc qua link | `suy luận` | giao làn `verify` | `VF-G9` |
| G10 | Phiên cloud **không** ghi được `.github/workflows` | `tài liệu nói vậy` | đang dựa vào, có sync | `VF-G10` |
| G11 | Hook và luật deny có hiệu lực trong routine và thread | **`đã kiểm`** phần routine; thread chưa | lớp thứ hai vẫn giữ | `VF-G11` |
| G12 | Ruleset bảo vệ nhánh trên repo private cần gói GitHub Pro | `tài liệu nói vậy` | dự phòng đã viết sẵn | `VF-G12` |
| G13 | GitHub Actions gọi được API trigger `/fire` của routine | `tài liệu nói vậy` | hoãn tới Đợt 1 | `VF-G13` |
| G14 | Commit của routine và thread có trailer `Claude-Session` | **`đã kiểm một phần`** | CI chỉ cảnh báo | `VF-G14` |
| G15 | Các mục 1–19 trong Phần L của spec tham chiếu | theo từng mục | `parked` | `VF-G15` |
| G16 | Phiên cloud và routine chạy trọn mà không cần người bấm cấp quyền | `suy luận` | dự phòng đã viết sẵn | `VF-G16` |
| G17 | `merge=union` làm xung đột file log biến mất trong vận hành thật | **`sai`** | **đã chuyển dự phòng** | `VF-G17` |
| G18 | `pnpm install --lockfile-only` giữ nguyên phép phân giải cũ của lockfile bản mồi | **`đã kiểm`** | đang dùng | `VF-G18` |

**Một giả định đang ở trạng thái `sai`: G17.** Đã chuyển sang dự phòng, chi tiết ở mục của nó. Ba giả định khác (`G2`, `G7`, `G14`) đã kiểm được một phần — cũng ở dưới; `G2` và `G14` ngay trong Đợt 0. `G7` là ca đáng chú ý nhất: phần chưa kiểm không phải vì chưa ai làm, mà vì **phiên cloud không ra được các trang điều khoản** (mục `VF-G7`). `G11` đã kiểm **xong** phần routine ngày 2026-09-21, mục `VF-G11`.

> Mã `G16` từng được **nhận trước** cho PR #11 trong lúc PR #15 viết `G17`, nên có một quãng bảng này nhảy từ G15 sang G17. Hai PR gộp vào nhau xong thì đủ cả hai, không ai mất số. Nhận mã trước khi viết là cách duy nhất để hai worker không cùng lấy một số (xem KF-005).

---

## G1 · Tài khoản có Claude Code Projects

- **Nội dung:** tài khoản của chủ dự án có tính năng Claude Code Projects, nên thread do Project khởi chạy được song song với routine.
- **Nguồn:** chưa có. Đây là suy luận từ mô tả sản phẩm.
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `CLAUDE.md` · `ops/lanes/verify/backlog.md` · CHARTER phụ lục P1 (số worker và nhịp chạy)
- **Cách kiểm:** mở `claude.ai/code`, xem có tạo được Project không. **Chỉ chủ dự án làm được** — agent không thấy trang cấu hình tài khoản.
- **Dự phòng:** Plan B — chỉ dùng routines. Nhịp chạy chuyển sang cấu hình mặc định của P1: 2 worker, preset hourly. Không mất gì về mặt kiến trúc, chỉ chậm hơn.
- **Trạng thái:** giao làn `verify`, mục `VF-G1`. Hỏi trong issue `🤖 [QĐ]` về các giả định cần chủ dự án.

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
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · CHARTER phụ lục P1 · mặc định M5
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
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `ops/lanes/visual/backlog.md` (V-002) · `ops/lanes/assembly/backlog.md` (A-001) · `ops/lanes/priority.md`
- **Cách kiểm:** spike canvas (`V-002`) và thử nghiệm engine dựng (`A-001`) đều **đo phút Actions thật** cho một đoạn mẫu, rồi ngoại suy. Không tốn tiền API, chỉ tốn phút Actions của chính lần đo.
- **Dự phòng:** đưa chi phí vào ngân sách học, hoặc chuyển sang runner khác. Nếu sai nặng, chốt 30fps thay vì 60fps ở `A-001`.
- **Trạng thái:** giao làn `verify`, mục `VF-G5`. **Đây là giả định đắt nhất nếu sai**, vì nó ràng buộc cả kiến trúc hình ảnh.

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
- **Độ tin cậy:** **`đã kiểm một phần`** (2026-09-21, mục `VF-G7`) — xem hai gạch đầu dòng bằng chứng bên dưới.
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
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · CHARTER mục 8
- **Cách kiểm:** tra điều kiện AdSense và nghĩa vụ thuế hiện hành. Miễn phí.
- **Dự phòng:** chưa có. Nếu sai thì mở `🤖 [QĐ]` — đây là một trong hai giả định chưa có dự phòng viết sẵn.
- **Trạng thái:** giao làn `verify`, mục `VF-G8`. Chưa chặn gì ở Đợt 0 và Đợt 1, vì doanh thu chưa tồn tại. Chặn ở Mốc 8.

## G9 · Thuê được người soát bản địa và giao việc qua link

- **Nội dung:** thuê được người bản địa Mỹ soát nội dung, và giao việc cho họ qua link mà không cần họ có tài khoản GitHub hay Claude.
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · quyết định D-17 · rủi ro A4
- **Cách kiểm:** tìm ít nhất hai kênh tuyển thực tế, và một cách giao việc không cần tài khoản. Miễn phí ở bước tìm.
- **Dự phòng:** chưa có. Nếu sai thì mở `🤖 [QĐ]` — giả định thứ hai chưa có dự phòng.
- **Trạng thái:** giao làn `verify`, mục `VF-G9`. Rủi ro A4: vai "người ngoài" nhận việc qua link, **có thời hạn phản hồi** — nếu không có thời hạn, họ thành nút cổ chai nằm ngoài mô hình tự trị.

## G10 · Phiên cloud không ghi được `.github/workflows`

- **Nội dung:** phiên cloud của Claude **không** có quyền push file trong `.github/workflows/`.
- **Nguồn:** có báo lỗi công khai. Đây cũng là một trong ba nhận định sai của bản C1 (điểm b) — bản C1 giả định ngược lại.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/workflows/README.md` · `ops/workflows/ci.yml` · `CLAUDE.md` · `.claude/hooks/guard.mjs`
- **Cách kiểm:** trong một nhánh vứt đi, thử ghi một file vào `.github/workflows/` và push. **Không merge.**
  > Lưu ý về cách kiểm: hook `guard.mjs` chặn chính agent ghi vào `.github/`, nên bài kiểm này **không thực hiện được từ một phiên agent bình thường** — và agent không được tự nới hook để kiểm. Bài kiểm cần chủ dự án chạy, hoặc cần một PR `owner-merge` mở một ngoại lệ hẹp cho đúng một file thử rồi đóng lại ngay.
- **Dự phòng nếu giả định đúng:** giữ nguyên cơ chế sync và PAT — đang dùng.
- **Nếu hoá ra ghi được ổn định:** có thể gỡ bỏ cơ chế sync và PAT, **thông qua một quyết định riêng**. Agent không tự gỡ: việc đó đổi cách toàn bộ workflow tới được GitHub.
- **Trạng thái:** đang dựa vào, giao làn `verify` mục `VF-G10`.

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
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/workflows/README.md` · `ops/lanes/platform/backlog.md` (P-006) · `ops/lanes/verify/backlog.md`
- **Cách kiểm:** thử bật ruleset trên chính repo này với 4 status check `check`, `secret-scan`, `fix-has-test`, `protected-area`, và xem GitHub đòi gì. Miễn phí. Chỉ chủ dự án làm được.
- **Dự phòng — đã viết sẵn:** không bật ruleset; dựa vào `automerge.yml` cộng hook. **Ruleset là lớp thứ hai của I2, không phải lớp duy nhất** — `automerge.yml` đã chỉ merge khi CI xanh, và nó chạy theo định nghĩa trên `main`.
- **Trạng thái:** giao làn `verify` mục `VF-G12`. Hỏi trong issue `🤖 [QĐ]`.

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

  **Chỗ vẫn chưa kiểm, và phải nói rõ:** bằng chứng trên **không** chứng minh được GitHub bỏ qua `.gitattributes` khi nó tự tính trạng thái `mergeable`. Trong tình huống của PR #11, git ở phía dưới cũng xung đột thật, nên GitHub báo xung đột là **đúng**. Câu hỏi "GitHub có dùng `.gitattributes` không" chỉ trả lời được bằng hai PR mà **cả hai đều đã mang sẵn** `.gitattributes` — chưa có cặp nào như thế. Giữ nó ở mục `VF-G17`.
- **Phần phụ thuộc:** `ops/known-failures.md` · `ops/lanes/platform/backlog.md` · `ops/lanes/verify/backlog.md` · `.gitattributes` · `ops/scripts/recheck-assumptions.ts`
- **Cách kiểm:** hai PR song song cùng làn, **cả hai** đã mang `.gitattributes`, cùng ghi vào **một** file append-only. Từ `D-C04`, log tách tới mức mục nên hai PR khác mục không còn dùng chung file — ca kiểm phải là hai lần chạy của **cùng một mục** (`ops/logs/<lane>/<id>.jsonl`), hoặc `docs/visual/calibration-log.jsonl`. Merge một PR, rồi đọc trạng thái `mergeable` của PR kia trên GitHub **và** chạy `git merge origin/main` ở phía worker. Hai câu trả lời có thể khác nhau, và phải ghi cả hai.
- **Kiểm tự động:** `union-merge-order` — dựng hai repo git thật trong thư mục tạm, khác nhau **đúng một điều kiện**: nhánh đã mang `.gitattributes` trước lần gộp hay chưa. Bài kiểm không đi tìm lại kết luận `sai` đã có, mà canh **hai điều kiện dự phòng đang đứng lên trên**: (1) luật do `main` mang tới vẫn KHÔNG áp cho chính lần gộp mang nó tới — nếu git đổi hành vi này thì G17 hết `sai`; (2) union VẪN cứu được lần gộp khi nhánh đã mang sẵn luật — nếu hỏng thì `.gitattributes` thành đồ trang trí và KF-005 phải viết lại. Phần *GitHub tự tính `mergeable`* thì **không** tự kiểm được ở đây: nó cần hai PR thật trên GitHub, vẫn nằm ở `VF-G17`.
- **Dự phòng — đã chuyển sang, không còn là ghi chú:** union giữ lại vì nó vẫn cứu được mọi lần gộp **sau khi** nhánh đã mang luật — không mất gì. Nhưng nó không còn được coi là cơ chế chính. Cơ chế chính chuyển sang mục `P-016`: routine integrator **tự gộp `main`** vào mọi PR đang mở bị xung đột mà nó giải được, chạy `pnpm check`, rồi push. Việc giải xung đột trở thành việc của máy, không phải việc của người.
- **Bài học chung, vượt ra ngoài mục này:** hai lần thử của `P-015` là chạy thật, và vẫn cho kết luận sai — vì cả hai đều dựng ở **trạng thái sau cùng**, không dựng ở trạng thái mà lỗi thật sẽ xảy ra. "Kiểm bằng chạy thật" (CHARTER 11.1 luật 3) chưa đủ. Bài thử phải tái hiện **đúng điều kiện đầu vào của lần chạy thật**, và điều kiện dễ bỏ sót nhất là *thứ tự thời gian*: ai có gì, vào lúc nào.
- **Trạng thái:** `sai`, đã chuyển dự phòng ngay trong cùng PR ghi nhận nó (quyết định `reversible` theo CLAUDE.md mục 7). Phần còn mở giao làn `verify` mục `VF-G17`.

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
