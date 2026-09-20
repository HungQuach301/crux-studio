# 🤖 `ops/logs` — nhật ký chạy

**Bất biến I8:** mọi lần chạy stage và mọi lần chạy làn đều ghi **một dòng** có `costUsd`.

- Một file JSONL cho mỗi làn: `ops/logs/<lane>.jsonl`. Phân vùng theo làn là thứ giữ cho hai làn chạy song song không đụng nhau (CHARTER mục 7).
- **Append-only.** Không sửa, không xoá dòng đã ghi. Sai thì ghi thêm một dòng đính chính.
- Một dòng gồm: `at`, `lane`, `kind` (`stage` | `lane`), `ref`, `status`, `durationMs`, `costUsd`, và `note` nếu cần.

`pnpm run:episode` tự ghi một dòng `stage` cho mỗi xưởng và một dòng `lane` cho cả chuỗi. Worker ghi một dòng `lane` cho mỗi mục backlog đã làm, trong cùng PR của mục đó.

Bản tin ngày và `ops/metrics.md` đọc từ đây để tính chi phí 24 giờ và chi phí tích luỹ so với ngân sách học (CHARTER mục 8).
