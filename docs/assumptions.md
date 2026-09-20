# 🤖 Sổ giả định

> **Đây không phải nguồn thẩm quyền** (CHARTER mục 0). Sổ này ghi lại những điều charter đang **giả định** về nền tảng và nhà cung cấp, cùng trạng thái đã kiểm hay chưa.

Charter được viết dựa trên hiểu biết về Claude, GitHub và YouTube tại thời điểm soạn. Một số hiểu biết trong đó **có thể sai**, hoặc sẽ sai khi nền tảng thay đổi. Bản C1 đã có ba nhận định sai và phải sửa trước khi triển khai. Sổ này tồn tại để lần sau không phải sửa cả charter mới tìm ra được cái gì bị ảnh hưởng.

## Bốn luật (CHARTER 11.1)

1. **Mọi giả định chịu tải đều có sổ**, và mỗi phần của code hay tài liệu dựa vào một giả định phải **ghi mã giả định đó ngay tại chỗ**. Cột *Phần phụ thuộc* dưới đây được `pnpm assumptions` kiểm: file nào được liệt kê mà không nhắc tới mã giả định thì CI đỏ.
2. **Kiểm trước, dựa vào sau.** Không mục backlog nào được xây trên một giả định có độ tin cậy `suy luận` khi chưa kiểm xong. Ngoại lệ duy nhất: phương án dự phòng đã được **viết sẵn**, không phải đã được nghĩ tới.
3. **Kiểm bằng chạy thật.** Đọc tài liệu chỉ cho trạng thái `tài liệu nói vậy` — và cả ba nhận định sai của bản C1 đều là loại đó.
4. **Khi một giả định hoá ra sai:** ghi trạng thái `sai` → có dự phòng thì chuyển ngay (quyết định `reversible`, ghi vào bản tin) → chưa có thì mở `🤖 [QĐ]` **kèm danh sách phần bị ảnh hưởng lấy từ cột dưới** → sửa CHARTER bằng PR `owner-merge` và ghi vào nhật ký thay đổi.

Routine `crux-integrator` chạy lại các kiểm tra tự động của sổ này **mỗi thứ Hai** (phụ lục P3). Lý do: nhiều tính năng đang ở giai đoạn research preview và có thể đổi bất cứ lúc nào (rủi ro B6).

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
| G2 | `automerge.yml` merge được bằng `GITHUB_TOKEN` và gọi được `main-ci` | `tài liệu nói vậy` | dự phòng đã viết sẵn | DoD Đợt 0 |
| G3 | Trần số lần chạy routine mỗi ngày đủ cho 2–3 worker cộng 2 routine | `suy luận` | giao làn `verify` | `VF-G3` |
| G4 | Hạn mức gói Claude chịu được 3 worker song song | `suy luận` | giao làn `verify` | `VF-G4` |
| G5 | Quota phút Actions và dung lượng artifact đủ cho việc render | `suy luận` | giao làn `verify` | `VF-G5` |
| G6 | App YouTube API chưa qua kiểm tuân thủ thì video tải lên bị khoá riêng tư | `tài liệu nói vậy` | không cần đổi gì | `VF-G6` |
| G7 | Điều khoản TTS, stock, font, bản đồ cho phép dùng thương mại và B2B | `suy luận` | giao làn `verify` · **đang chặn** | `VF-G7`, `AU-001` |
| G8 | Có đường nhận tiền và nộp thuế cho người ở Việt Nam | `suy luận` | giao làn `verify` | `VF-G8` |
| G9 | Thuê được người soát bản địa và giao việc qua link | `suy luận` | giao làn `verify` | `VF-G9` |
| G10 | Phiên cloud **không** ghi được `.github/workflows` | `tài liệu nói vậy` | đang dựa vào, có sync | `VF-G10` |
| G11 | Hook và luật deny có hiệu lực trong routine và thread | **`đã kiểm một phần`** | lớp thứ hai đã có | `VF-G11` |
| G12 | Ruleset bảo vệ nhánh trên repo private cần gói GitHub Pro | `tài liệu nói vậy` | dự phòng đã viết sẵn | `VF-G12` |
| G13 | GitHub Actions gọi được API trigger `/fire` của routine | `tài liệu nói vậy` | hoãn tới Đợt 1 | `VF-G13` |
| G14 | Commit của routine và thread có trailer `Claude-Session` | **`đã kiểm một phần`** | CI chỉ cảnh báo | `VF-G14` |
| G15 | Các mục 1–19 trong Phần L của spec tham chiếu | theo từng mục | `parked` | `VF-G15` |

**Không có giả định nào ở trạng thái `sai`.** Hai giả định đã kiểm được một phần ngay trong Đợt 0 — chi tiết ở dưới.

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

- **Nội dung:** một workflow dùng `GITHUB_TOKEN` gọi được API merge, và merge đó **không** tự kích hoạt workflow khác — nên phải gọi `main-ci` tường minh bằng `workflow_dispatch`.
- **Nguồn:** tài liệu GitHub Actions về `GITHUB_TOKEN` và về việc sự kiện do nó tạo ra không kích hoạt workflow mới.
- **Độ tin cậy:** `tài liệu nói vậy`
- **Phần phụ thuộc:** `ops/workflows/automerge.yml` · `ops/workflows/main-ci.yml`
- **Cách kiểm:** DoD Đợt 0 đòi `automerge` merge **thật** một PR low-risk mà không cần người. Đó là bài kiểm, và nó là chạy thật chứ không phải đọc tài liệu.
- **Dự phòng — đã viết sẵn:** `main-ci.yml` chạy thêm **theo lịch mỗi giờ** (`cron: '17 * * * *'`). Nếu lời gọi tường minh không chạy được, `main` vẫn được kiểm trong vòng một giờ. Không cần sửa gì khi phát hiện sai.
- **Trạng thái:** đang dựa vào, có dự phòng. Chuyển sang `đã kiểm` khi PR low-risk đầu tiên được automerge.

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
- **Độ tin cậy:** `suy luận`
- **Phần phụ thuộc:** `workshops/audio/src/index.ts` · `kernel/contracts/audio.payload.v0.schema.json` · `ops/license-ledger.md` · `ops/lanes/audio/backlog.md` (AU-001) · `ops/lanes/verify/backlog.md`
- **Cách kiểm:** đọc điều khoản từng nhà cung cấp, **trích dẫn kèm ngày đọc** vào `ops/license-ledger.md`. Không tóm tắt bằng trí nhớ. Miễn phí, chỉ tốn thời gian.
- **Dự phòng:** đổi nhà cung cấp. Contract không đổi — nó đã có sẵn trường `commercialLicenseVerified`.
- **Trạng thái:** giao làn `verify`, mục `VF-G7`. **Đang chặn:** stub khai `commercialLicenseVerified: false`, và đó là trạng thái đúng, không phải một ô bỏ trống. Quyền dùng thương mại **không** đồng nghĩa với quyền giao lại — rủi ro A6 nằm đúng ở khoảng cách giữa hai thứ đó.

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
- **Độ tin cậy:** **`đã kiểm một phần`**

  **Bằng chứng, 2026-09-20 (phiên cloud tương tác):** ngay sau khi `.claude/settings.json` và `hooks/guard.mjs` được ghi vào cây làm việc, hook chặn thật một lệnh Bash của chính agent trong cùng phiên đó — lệnh chứa nguyên văn chuỗi bị cấm khi agent đang **soạn file test** cho hook. Hook trả về mã 2 và agent nhận được lý do bằng tiếng Việt. Nghĩa là: (a) hook nạp mà không cần khởi động lại phiên, (b) nó soi nội dung lệnh chứ không chỉ tên công cụ, (c) nó chặn kể cả khi ý định của agent là vô hại.

  Điểm (c) là một phát hiện, không phải một trục trặc: hook chặn theo **hình dạng lệnh**, không theo ý định. Mặt trái là nó chặn cả việc chính đáng — file test vì thế ghép chuỗi lệnh từ mảnh và ghi rõ lý do ngay trong file. Mặt phải là không có cách "giải thích cho hook hiểu" để đi qua nó.

  **Chưa kiểm:** routine và thread. Đó mới là ngữ cảnh mà charter thực sự dựa vào, vì worker chạy không có người giám sát.
- **Phần phụ thuộc:** `.claude/README.md` · `ops/test/guard.test.ts` · `ops/workflows/README.md` · bất biến I4
- **Cách kiểm phần còn lại:** trong một lần chạy routine, cho agent thử một lệnh nằm trong danh sách chặn và xem nó có bị chặn không. Miễn phí.
- **Dự phòng — đã có sẵn:** mọi thứ hook chặn đều có **lớp thứ hai không phụ thuộc G11**, ghi trong bảng ở `.claude/README.md`: `automerge.yml` chạy theo định nghĩa trên `main` (nhánh PR không sửa được), `protected-area` gắn nhãn `owner-merge` từ phía CI, và proxy GitHub của Claude cho `.github/`.
- **Trạng thái:** giao làn `verify` mục `VF-G11` cho phần routine.

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

  **Chưa kiểm:** commit do routine và do thread tạo. Đó mới là ngữ cảnh charter dựa vào.
- **Phần phụ thuộc:** `ops/workflows/ci.yml` (job `trailer-warn`) · `CLAUDE.md` mục 6 · CHARTER 3.1
- **Cách kiểm phần còn lại:** đọc kết quả job `trailer-warn` trên các PR do routine mở, trong một tuần. Miễn phí, và tự động.
- **Dự phòng — đã viết sẵn:** dựa vào quy ước 🤖 và log làn. CI **chỉ cảnh báo**, cố ý không chặn (CHARTER mục 4): nếu nền tảng đổi cách ghi trailer thì một luật cứng ở đó sẽ chặn toàn bộ công việc.
- **Trạng thái:** giao làn `verify` mục `VF-G14` cho phần routine.

## G15 · Các mục 1–19 trong Phần L của spec tham chiếu

- **Nội dung:** các giả định nghiệp vụ trong Phần L của spec tham chiếu, mỗi mục một giả định riêng với độ tin cậy riêng.
- **Độ tin cậy:** theo từng mục.
- **Phần phụ thuộc:** `ops/lanes/verify/backlog.md` · `CLAUDE.md`
- **Cách kiểm:** chia nhỏ thành mục con **khi một làn cần tới một mục cụ thể**.
- **Trạng thái:** `parked`. Mở cả 19 mục bây giờ là mở rộng phạm vi không có người tiêu thụ — đúng thứ ngân sách độ phức tạp ở CHARTER mục 9 cấm.

---

## Cách thêm một giả định

1. Thêm một dòng vào **Bảng tổng** và một mục đầy đủ ở dưới, đủ bảy phần: nội dung, nguồn, độ tin cậy, phần phụ thuộc, cách kiểm, dự phòng, trạng thái.
2. **Ghi mã giả định vào từng file liệt kê ở cột *Phần phụ thuộc***, dưới dạng comment hoặc một dòng trong tài liệu. `pnpm assumptions` kiểm việc này và đỏ nếu thiếu.
3. Thêm một mục `VF-<mã>` vào `ops/lanes/verify/backlog.md`.
4. Nếu giả định chưa có dự phòng viết sẵn thì **không được xây gì lên trên nó** (luật 2).
