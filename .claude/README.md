# 🤖 `.claude/` — rào chắn của agent

**Vùng bảo vệ** (CHARTER mục 3). Chỉ vào `main` qua PR `owner-merge`.

| File | Việc |
|---|---|
| `settings.json` | Luật `deny` cho công cụ, danh sách `allow` tường minh, `defaultMode`, cộng hook `PreToolUse`. |
| `hooks/guard.mjs` | Hook chặn thật: merge, ghi `.github/`, push vào `main`, tắt trailer `Claude-Session`, `--no-verify`. Thoát mã 2 là chặn. |

Hai lớp, cố ý trùng nhau một phần:

- **`deny`** chặn theo tên công cụ và mẫu lệnh. Nhanh, nhưng chỉ bắt được đúng những mẫu đã liệt kê.
- **`hooks/guard.mjs`** chặn theo **nội dung** lệnh, nên bắt được cả những biến thể chưa liệt kê (`gh api .../pulls/12/merge`, `git push origin HEAD:main`).

Giả định **G11**: hook và luật deny có hiệu lực trong routine và trong thread, không chỉ trong phiên tương tác. Tài liệu nói vậy khi dùng một repo, nhưng **chưa kiểm bằng chạy thật**. Vì thế mọi thứ hook chặn đều còn một lớp thứ hai ở phía CI hoặc ở workflow chạy từ `main`:

| Luật | Lớp 1 (hook) | Lớp 2 (không phụ thuộc G11) |
|---|---|---|
| Agent không merge | `guard.mjs` | `automerge.yml` chạy theo định nghĩa trên `main`, bỏ qua PR chạm vùng bảo vệ |
| Không ghi `.github/` | `guard.mjs` | Proxy GitHub của Claude; và `sync-workflows.yml` là nguồn duy nhất ghi vào đó |
| Không vào `main` ngoài PR | `deny` + `guard.mjs` | I2: `automerge.yml` chỉ merge khi CI xanh |

## Vì sao không còn khối `ask` — giả định G16

Trước đây `settings.json` có một khối `ask` bắt agent xin phép khi chạm `CHARTER.md`, `CLAUDE.md`, `kernel/contracts/`, `.claude/` và `docs/decisions/`. Khối đó đã được **bỏ hẳn**: chủ dự án cấp phép toàn bộ cho mọi phiên và routine, và chỉ nhận kết quả. Một routine chạy không có người ngồi cạnh thì mỗi lời hỏi là một lần treo cho tới khi hết giờ — nghĩa là một lần chạy hỏng mà **không có chỉ báo nào đỏ**, đúng nhóm lỗi ở `ops/known-failures.md`.

| | Trước | Sau |
|---|---|---|
| `defaultMode` | không khai (`default`) | `dontAsk` |
| `ask` | 11 luật | bỏ hẳn |
| `allow` | không có | tường minh cho `git`, `pnpm`, `node`, `npx`, `gh pr`/`gh issue` (đọc và ghi, trừ phần `deny`) |
| `deny` | 14 luật | **y nguyên 14 luật** |
| `hooks/guard.mjs` | có | **y nguyên** |

Vì sao `dontAsk` chứ không phải `bypassPermissions`, dù `bypassPermissions` mới là mức cao nhất trong thang: `bypassPermissions` bỏ qua **toàn bộ** kiểm tra quyền, kể cả khối `deny`. Chọn nó là tự tay gỡ bất biến I4 — cái mà chủ dự án đã nói rõ là giữ. `dontAsk` không hỏi gì nữa nhưng `deny` và hook vẫn có hiệu lực, nên nó là **mức cao nhất còn giữ được hai lớp chặn**. Đây là lý do có mặt trong tài liệu chứ không nằm trong đầu ai: nếu sau này có người thấy `dontAsk` mà nghĩ là quên nâng, dòng này trả lời.

Giả định **G16**: phiên cloud và routine chạy trọn mà không cần người bấm cấp quyền. Cách kiểm là **chạy thật một routine** và xem nó có đi hết một mục backlog không — xem `docs/assumptions.md`. Nếu sai, dự phòng là quay lại `acceptEdits` và nhận việc phải bấm tay ở đúng chỗ đã ghi.

Bị hook chặn **không phải** một trở ngại cần lách. Đó là hệ thống đang chạy đúng. Nếu một luật chặn nhầm việc chính đáng, mở `🤖 [QĐ]` để sửa luật, đừng đi vòng.

## Thử hook

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"gh pr merge 1 --squash"}}' | node .claude/hooks/guard.mjs; echo "mã thoát: $?"
```

Kỳ vọng: in `CHẶN — …` và mã thoát `2`.
