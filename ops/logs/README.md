# 🤖 `ops/logs` — nhật ký chạy

**Bất biến I8:** mọi lần chạy stage và mọi lần chạy làn đều ghi **một dòng** có `costUsd`.

- **Một file JSONL cho mỗi mục:** `ops/logs/<lane>/<id>.jsonl` (quyết định `D-C04`, mục `P-018`). `<id>` là mã mục backlog (`P-018`, `I-002`) hoặc mã tập (`ep-0001-stub`) khi là lần chạy tập.

  Phân vùng tới mức **làn** — hình dạng cũ, `ops/logs/<lane>.jsonl` — chỉ giữ cho hai **làn** chạy song song không đụng nhau (CHARTER mục 7). Nó không giữ được cho hai **mục trong cùng một làn**, mà đó là chế độ chạy bình thường: mặc định 2–3 worker (Phụ lục P1). Xem `KF-005`.
- **Bên ghi** gọi `runLogPath(root, lane, id)` rồi `appendRunLog` (`kernel/src/log.ts`). Đừng tự ghép đường dẫn: mã mục đi thẳng vào tên file nên phải qua `isSafeLogId`.
- **Bên đọc** gọi `readRunLogs('ops/logs')`. Nó gom mọi file — kể cả file phẳng cũ nếu còn sót — và **sắp theo `at`**.

  ⚠️ **Đừng tự `cat` rồi tự sắp.** Thứ tự dòng trong file không mang nghĩa: `merge=union` giữ cả hai bên nhưng không xếp theo thời gian. Quên sắp theo `at` là số tiền ra sai mà không gì đỏ — đúng nhóm lỗi Z.

  Trong shell cũng vậy: `find ops/logs -name '*.jsonl' -exec cat {} +`, không phải `cat ops/logs/*.jsonl` — glob một tầng không khớp file nào nữa.
- **`merge=union`** (`.gitattributes` ở gốc repo) vẫn còn, làm **lớp phòng thủ thứ hai**: nó cứu trường hợp hai lần chạy cùng ghi vào một mục. Giới hạn đã đo của nó ở `KF-005`.
- **Append-only.** Không sửa, không xoá dòng đã ghi. Sai thì ghi thêm một dòng đính chính.
- Một dòng gồm: `at`, `lane`, `kind` (`stage` | `lane`), `ref`, `status`, `durationMs`, `costUsd`, và `note` nếu cần.

`pnpm run:episode` tự ghi một dòng `stage` cho mỗi xưởng và một dòng `lane` cho cả chuỗi, tất cả dưới mã tập. Worker ghi một dòng `lane` cho mỗi mục backlog đã làm, trong cùng PR của mục đó.

Bản tin ngày và `ops/metrics.md` đọc từ đây để tính chi phí 24 giờ và chi phí tích luỹ so với ngân sách học (CHARTER mục 8).
