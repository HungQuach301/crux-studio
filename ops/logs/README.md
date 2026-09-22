# 🤖 `ops/logs` — nhật ký chạy

**Bất biến I8:** mọi lần chạy stage và mọi lần chạy làn đều ghi **một dòng** có `costUsd`.

- **Một file JSONL cho mỗi mục:** `ops/logs/<lane>/<id>.jsonl` (quyết định `D-C04`, mục `P-018`). `<id>` là mã mục backlog (`P-018`, `I-002`) hoặc mã tập (`ep-0001-stub`) khi là lần chạy tập.

  Phân vùng tới mức **làn** — hình dạng cũ, `ops/logs/<lane>.jsonl` — chỉ giữ cho hai **làn** chạy song song không đụng nhau (CHARTER mục 7). Nó không giữ được cho hai **mục trong cùng một làn**, mà đó là chế độ chạy bình thường: mặc định 2–3 worker (Phụ lục P1). Xem `KF-005`.
- **Một file JSONL cho mỗi LƯỢT CHẠY bước 0:** `ops/logs/integration/step0-<YYYY-MM-DDTHHMMSSZ>-<routine>.jsonl` (quyết định của mục `P-023`). Ví dụ: `ops/logs/integration/step0-2026-09-21T213922Z-crux-worker-1.jsonl`.

  Vì sao bước 0 không đi theo luật trên: nó **không phải một mục**, nó là **một lượt chạy** của mọi routine (phụ lục P3 bước 0, chạy ở đầu mỗi lượt worker và một lần mỗi lượt integrator). Trước `P-023` mọi lượt dồn vào mã mục `P-016`, tức cùng một file — và theo `KF-009`, một dòng vào `main` là mọi PR đang mở có dòng riêng trong file ấy **xung đột ngay** phía GitHub, còn `automerge.yml` thì nghe phía GitHub. Đã đo: một dòng khoá 7 PR lúc 04:05 giờ VN 2026-09-22, rồi 8 PR ở lượt kế tiếp. Vòng tự lặp mỗi lượt.

  Một lượt một file thì hai lượt không bao giờ chạm cùng một file — cùng lập luận `D-C04` đã dùng cho mục, áp cho lượt chạy.

  **Làn là `integration`** với mọi routine, kể cả khi lượt đó là một worker: hàng đợi merge là việc của làn `integration` (CHARTER mục 7). Dòng mang `lane: "integration"` và `ref: "integration/<mã>"` để `misfiledLogLines` khớp.

  Dòng **cũ** trong `ops/logs/platform/P-016.jsonl` **không chuyển đi và không xoá** — log append-only. Bên đọc phải hiểu cả hai chỗ cho tới khi các dòng cũ rơi khỏi mọi cửa sổ thời gian đang dùng; `readRunLogs` gom theo thư mục nên nó tự thấy cả hai.
- **Bên ghi** gọi `runLogPath(root, lane, id)` rồi `appendRunLog` (`kernel/src/log.ts`). Đừng tự ghép đường dẫn: mã mục đi thẳng vào tên file nên phải qua `isSafeLogId`.

  Với dòng bước 0, gọi `step0LogPath(root, at, runner)` và `step0LogRef(at, runner)` — **một chỗ sinh ra tên file**, không routine nào tự ghép. Trước `P-023` đã có ba hình dạng nằm cạnh nhau (`integration/P3-run-<ngày>T<giờ>`, `integration/P3-daily-<ngày>`, `platform/P1-step0-<ngày>T<giờ>h<phút>`): ba tiền tố, hai làn, hai độ mịn thời gian — và hình dạng theo **giờ** vẫn để hai lượt trong cùng một giờ đụng nhau. Các file cũ đó ở lại, nhưng không sinh thêm.
- **Bên đọc** gọi `readRunLogs('ops/logs')`. Nó gom mọi file — kể cả file phẳng cũ nếu còn sót — và **sắp theo `at`**.

  ⚠️ **Đừng tự `cat` rồi tự sắp.** Thứ tự dòng trong file không mang nghĩa: `merge=union` giữ cả hai bên nhưng không xếp theo thời gian. Quên sắp theo `at` là số tiền ra sai mà không gì đỏ — đúng nhóm lỗi Z.

  Trong shell cũng vậy: `find ops/logs -name '*.jsonl' -exec cat {} +`, không phải `cat ops/logs/*.jsonl` — glob một tầng không khớp file nào nữa.
- **`merge=union`** (`.gitattributes` ở gốc repo) vẫn còn, làm **lớp phòng thủ thứ hai**: nó cứu trường hợp hai lần chạy cùng ghi vào một mục. Giới hạn đã đo của nó ở `KF-005`.
- **Không file `.jsonl` phẳng nào ở tầng này.** `ops/logs/<lane>.jsonl` là hình dạng **trước** `D-C04`. Nó quay lại được mà không gì đỏ: `readRunLogs` vẫn đọc, nên một làn mới ghi nhầm vào đó — hoặc một file phẳng sinh ra trên `main` **sau** khi nhánh rẽ ra, thứ git gộp vào êm ru vì nhánh chưa từng thấy nó — sẽ đi thẳng vào `main` với CI xanh. Đã xảy ra thật với `ops/logs/verify.jsonl` lúc giải xung đột PR #26.

  `ops/test/logs-layout.test.ts` khoá luật này (kèm test âm), dựa trên `flatLogFiles` của kernel. Gặp nó đỏ thì mang từng dòng sang `ops/logs/<lane>/<id>.jsonl` theo trường `ref` — dùng `logIdFromRef` rồi `runLogPath`, đừng tự ghép đường dẫn — rồi xoá file phẳng.
- **Mỗi dòng nằm đúng file của nó.** `ops/logs/<lane>/<id>.jsonl` chỉ chứa dòng có `lane` khớp thư mục và `logIdFromRef(ref)` khớp tên file. Hình dạng đúng **chưa đủ**: một dòng vẫn có thể nằm trong file lồng thư mục, đúng hai tầng, mà sai file — và lúc đó chi phí của mục này bị tính cho mục kia.

  Đã xảy ra thật ở lần gộp thứ hai của PR #26, **không một dấu xung đột nào**: nhánh xoá `ops/logs/verify.jsonl` rồi tạo `ops/logs/verify/VF-G2.jsonl` với đúng nội dung đó, nên git **nhận ra một lần đổi tên**; `main` thêm một dòng `ref: "verify/VF-G11"` vào file phẳng cũ, git áp lên đường dẫn đã đổi tên, `merge=union` gộp êm. `misfiledLogLines` của kernel cộng `ops/test/logs-layout.test.ts` khoá luật này, kèm test âm.
- **Append-only.** Không sửa, không xoá dòng đã ghi. Sai thì ghi thêm một dòng đính chính.
- Một dòng gồm: `at`, `lane`, `kind` (`stage` | `lane`), `ref`, `status`, `durationMs`, `costUsd`, và `note` nếu cần.
- **`rollup: true`** đánh dấu dòng **tổng hợp**: `costUsd` của nó đã được đếm ở những dòng khác. Một lần `pnpm run:episode` ghi sáu dòng `stage` cộng một dòng `lane` mang đúng tổng của sáu dòng đó, nên cộng hết thì mỗi tập bị tính tiền **hai lần**. `sumCostUsd` bỏ qua dòng có cờ này; dòng vẫn được ghi, vì bất biến I8 đòi mọi lần chạy làn có một dòng.
- **`at` luôn là UTC.** `appendRunLog` chuẩn hoá lúc ghi và `parseRunLogs` chuẩn hoá lúc đọc. Mọi phép so sánh thời gian ở đây là so **chuỗi**, nên một dòng ghi `+07:00` sẽ xếp sai chỗ và rơi khỏi cửa sổ 24 giờ dù nó nằm trong đó.

`pnpm run:episode` tự ghi một dòng `stage` cho mỗi xưởng và một dòng `lane` cho cả chuỗi, tất cả dưới mã tập. Worker ghi một dòng `lane` cho mỗi mục backlog đã làm, trong cùng PR của mục đó.

Bản tin ngày và `ops/metrics.md` đọc từ đây để tính chi phí 24 giờ và chi phí tích luỹ so với ngân sách học (CHARTER mục 8).
