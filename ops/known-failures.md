# 🤖 Sổ lỗi đã gặp

**Luật (CHARTER 6.6):** lỗi cùng loại xuất hiện **lần thứ hai** thì sửa **spec, contract hoặc prompt** — không vá sản phẩm. Vá sản phẩm lần thứ hai nghĩa là lần thứ ba đang tới.

Mỗi mục ghi: chữ ký lỗi, đã gặp mấy lần, nguyên nhân gốc, chỗ đã sửa, và cách máy chặn nó từ nay.

---

## KF-001 · Heredoc đóng ở cột 0 làm vỡ khối YAML của workflow

- **Lần gặp:** 2 (`main-ci.yml`, rồi `notify.yml` và `watchdog.yml`)
- **Chữ ký:** `yaml.scanner.ScannerError: while scanning a simple key` hoặc `found character '@' that cannot start any token`, trỏ vào một dòng nằm trong khối `run: |`.
- **Nguyên nhân gốc:** trong khối YAML literal, mọi dòng phải thụt sâu hơn khoá `run:`. Một heredoc bash (`BODY=$(cat <<EOF … EOF`) kết thúc ở cột 0, nên nó cắt đứt khối YAML ở giữa. Thông báo lỗi của GitHub không chỉ tới chỗ này.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** workflow trong `ops/workflows/` chỉ có hiệu lực **sau khi** PR merge vào `main` và `sync-workflows` chép sang `.github/workflows/`. Một lỗi cú pháp vì thế không hiện ra trên PR — nó hiện ra trên `main`.
- **Đã sửa ở đâu:** thay mọi heredoc trong workflow bằng `printf '%s\n' …`.
- **Máy chặn từ nay:** `pnpm lint:workflows` (`ops/scripts/check-workflows.ts`) bắt dòng ở cột 0 trong khối `run:`, và chạy `bash -n` trên từng khối. Nằm trong `pnpm check`, nên CI chặn trước khi merge.

---

## KF-002 · PR xếp chồng cộng merge squash sinh xung đột ở mọi file hai PR cùng chạm

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì nó sẽ lặp lại ở **mọi** đợt có nhiều PR nền tảng, và vì nó chặn cả hàng đợi merge chứ không chỉ một PR.
- **Chữ ký:** `CONFLICT (add/add): Merge conflict in <file>` ngay sau khi gộp `main` vào một nhánh, trong khi diff cho thấy **không bên nào xoá gì của bên kia**.
- **Nguyên nhân gốc:** merge **squash** tạo một commit mới trên `main` không chung tổ tiên với nhánh đang mở. Với một nhánh xếp chồng trên nhánh vừa được squash, git mất hết ngữ cảnh ba chiều: mọi file mà hai PR cùng chạm trở thành `add/add`, kể cả khi thay đổi là thuần cộng thêm.

  Cần cả **hai** điều kiện: PR xếp chồng **và** merge squash. Thiếu một trong hai thì không có lỗi này. CHARTER 3.3 chốt squash (`automerge.yml` merge bằng squash), nên điều kiện thứ hai là cố định — chỉ còn cách bỏ điều kiện thứ nhất.
- **Đã xảy ra ở đâu:** Đợt 0. Bốn PR xếp chồng `#1 → #2 → #4 → #6`. Sau khi `#1` được squash, `#2` xung đột ở `CLAUDE.md` và `package.json`.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** hàng đợi merge là **tuần tự** (CHARTER mục 7). Một PR xung đột nằm giữa hàng đợi chặn tất cả PR sau nó, và `automerge.yml` hiện **không biết** phân biệt "CI xanh nhưng đang xung đột" với "CI xanh và merge được".

### Cách làm từ nay

1. **Mặc định: mỗi worker chỉ mở PR dựa trên `main`.** Không xếp chồng. Một mục backlog là một đơn vị độc lập, và `deps` trong backlog đã là cơ chế để diễn đạt thứ tự — thứ tự công việc không cần diễn đạt thêm bằng base của PR.
2. **Nếu buộc phải xếp chồng** (PR sau đọc file PR trước tạo ra, và tách thì CI đỏ): **gộp lại ngay sau mỗi lần PR dưới được merge**, không đợi tới lúc chuẩn bị merge PR trên. Gộp ngay thì xung đột nhỏ và còn nhớ vì sao mỗi bên viết thế; gộp muộn thì không.
3. **Gộp, không rebase.** Nhánh có thể đã có người khác đọc, và CHARTER cấm force-push lên nhánh của người khác. Một commit merge giữ mọi checkout đang có còn dùng được.
4. **Giải quyết xung đột `add/add` bằng đối chiếu, không bằng `--ours`/`--theirs`.** Chạy `git diff origin/main:<file> <nhánh>:<file>` và đếm dòng bị xoá trước khi quyết. Không có dòng nào bị xoá thì giữ bản dài hơn là an toàn — và lúc đó ta **biết** nó an toàn thay vì hy vọng thế.

- **Máy chặn từ nay:** mục `P-007` trong `ops/lanes/platform/backlog.md` — `automerge.yml` bỏ qua PR đang xung đột thay vì thử merge, và routine integrator liệt kê PR xung đột vào bản tin ngày để chúng không nằm im. Tới khi `P-007` xong, đây mới là luật mềm: nó nằm trong tài liệu, chưa nằm trong máy.

---

## Cách thêm một mục

```markdown
## KF-00N · <chữ ký lỗi, một dòng>

- **Lần gặp:** N
- **Chữ ký:** <chuỗi đủ đặc trưng để nhận ra lần sau>
- **Nguyên nhân gốc:** <vì sao nó xảy ra, không phải nó xảy ra ở đâu>
- **Đã sửa ở đâu:** <spec / contract / prompt — không phải sản phẩm>
- **Máy chặn từ nay:** <tên kiểm tra cụ thể, chạy ở đâu>
```

Không có dòng **Máy chặn từ nay** thì mục đó chưa xong.
