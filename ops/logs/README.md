# 🤖 `ops/logs` — nhật ký chạy

**Bất biến I8:** mọi lần chạy stage và mọi lần chạy làn đều ghi **một dòng** có `costUsd`.

- Một file JSONL cho mỗi làn: `ops/logs/<lane>.jsonl`. Phân vùng theo làn là thứ giữ cho hai **làn** chạy song song không đụng nhau (CHARTER mục 7). Nó **không** giữ được cho hai **mục trong cùng một làn** — xem KF-005.
- **`merge=union`** (`.gitattributes` ở gốc repo): hai PR cùng thêm một dòng thì git giữ cả hai thay vì báo xung đột.

  ⚠️ **Union không xếp theo thời gian.** Dòng của nhánh nằm trước dòng của `main`, bất kể `at`. **Mọi bên đọc phải tự sắp theo `at`** — bản tin ngày, `ops/metrics.md`, routine integrator. Tin vào thứ tự dòng trong file là sai.
- **Append-only.** Không sửa, không xoá dòng đã ghi. Sai thì ghi thêm một dòng đính chính.
- Một dòng gồm: `at`, `lane`, `kind` (`stage` | `lane`), `ref`, `status`, `durationMs`, `costUsd`, và `note` nếu cần.

`pnpm run:episode` tự ghi một dòng `stage` cho mỗi xưởng và một dòng `lane` cho cả chuỗi. Worker ghi một dòng `lane` cho mỗi mục backlog đã làm, trong cùng PR của mục đó.

Bản tin ngày và `ops/metrics.md` đọc từ đây để tính chi phí 24 giờ và chi phí tích luỹ so với ngân sách học (CHARTER mục 8).
