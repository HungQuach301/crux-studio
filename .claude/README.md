# 🤖 `.claude/` — rào chắn của agent

**Vùng bảo vệ** (CHARTER mục 3). Chỉ vào `main` qua PR `owner-merge`.

| File | Việc |
|---|---|
| `settings.json` | Luật `deny` và `ask` cho công cụ, cộng hook `PreToolUse`. |
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

Bị hook chặn **không phải** một trở ngại cần lách. Đó là hệ thống đang chạy đúng. Nếu một luật chặn nhầm việc chính đáng, mở `🤖 [QĐ]` để sửa luật, đừng đi vòng.

## Thử hook

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"gh pr merge 1 --squash"}}' | node .claude/hooks/guard.mjs; echo "mã thoát: $?"
```

Kỳ vọng: in `CHẶN — …` và mã thoát `2`.
