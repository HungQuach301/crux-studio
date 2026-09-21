# 🤖 Backlog làn `integration` — Đợt 1

Làn nền, **ưu tiên số một** trong `priority.md`: `main` đỏ chặn mọi làn khác.

Phần lớn việc của làn này chạy bằng routine `crux-integrator` (phụ lục P3), không bằng mục backlog. Các mục dưới đây là công cụ mà routine đó cần.

---

### I-001 · Dọn PR nháp đã bỏ
- deps: —
- risk: low
- status: review
- nguồn: phụ lục P3 bước 2
- tiêu chí xong:
  - Đóng PR nháp không có commit mới quá 72 giờ, **kèm ghi chú** nói rõ mục đó quay lại hàng đợi.
  - Mục tương ứng trong backlog chuyển từ `claimed` về `ready`.

### I-002 · `ops/metrics.md` tự cập nhật
Tín hiệu của rủi ro R12 (độ phức tạp tự phình to): số file code so với số mục đã xong.

- deps: —
- risk: low
- status: review
- nguồn: CHARTER 6.7; phụ lục P3 bước 3
- tiêu chí xong:
  - ✅ Một lệnh tính: số file code / số mục `done`, số lần revert, tỷ lệ `main` xanh — `ops/scripts/update-metrics.ts`.
  - ✅ Số liệu ghi vào `ops/metrics.md`, không chỉ in ra màn hình.
  - Logic đếm và chỉnh bảng markdown là hàm thuần, kiểm bằng `ops/test/update-metrics.test.ts`; lớp gọi `gh pr list` trong `main()` không kiểm đơn vị (không có lịch sử merge thật để dựa vào ở đây, cùng lý do với `I-001`).
  - **Chưa kiểm bằng chạy thật:** routine `crux-integrator` (Phụ lục P3 bước 3) chưa gọi tool này — lần tới bước 3 chạy thật (thứ Hai kế tiếp hoặc lần chạy `main` ≥ 02:00 giờ Việt Nam kế tiếp) sẽ là lần đầu.

### I-003 · Chạy lại kiểm tra tự động của sổ giả định mỗi thứ Hai
Nhiều tính năng đang ở giai đoạn research preview và có thể đổi bất cứ lúc nào (rủi ro B6).

- deps: `docs/assumptions.md`
- risk: low
- status: review
- nguồn: CHARTER 11.1; phụ lục P3 bước 4
- tiêu chí xong:
  - ✅ Giả định nào có cách kiểm tự động thì chạy được bằng một lệnh — `pnpm recheck:assumptions`
    (`ops/scripts/recheck-assumptions.ts`). Mục nào tự khai `**Kiểm tự động:**` trong sổ mới được chạy;
    mục cần người được liệt kê ra thành "cần người", không im lặng bỏ qua.
  - ✅ Giả định đổi trạng thái thì lệnh **in sẵn thân issue `🤖 [QĐ]`** đủ năm phần của CLAUDE.md mục 14,
    kèm danh sách phần bị ảnh hưởng lấy nguyên từ cột *Phần phụ thuộc* của chính giả định đó. Lệnh
    **không** tự mở issue và **không** tự sửa sổ — mở issue là việc của routine (CHARTER 11.1).
  - ✅ Hai bài kiểm thật đang chạy: `session-trailer-on-branch` (G14) và `union-merge-order` (G17), cả hai
    đều dựng git thật chứ không mô phỏng. 17 test trong `ops/test/recheck-assumptions.test.ts`.
  - ✅ `pnpm assumptions` đỏ cả hai chiều: sổ khai mã không tồn tại, khai nhầm mã của giả định khác, hoặc
    có bài kiểm đăng ký mà không mục nào khai (bài kiểm đó sẽ không bao giờ chạy).
  - ✅ Một bài kiểm ném lỗi không nuốt cả báo cáo: lỗi thành một dòng `⚠ … KHÔNG CHẠY ĐƯỢC` và các bài
    kiểm còn lại vẫn chạy. Cửa sổ quét rỗng mang dấu riêng `◦`, không in ra như một `✓`.
  - **Chưa làm, cố ý:** lệnh không nằm trong `pnpm check`. Đỏ ở đây nghĩa là thế giới đã đổi, không phải PR
    đó sai; một giả định hoá ra sai không được chặn mọi làn (CHARTER mục 4). Phụ lục P3 bước 4 gọi nó.

### I-004 · Tạo lại lockfile khi xung đột
- deps: —
- risk: low
- status: ready
- nguồn: CHARTER mục 7 (file nóng được phân vùng)
- tiêu chí xong: lockfile do làn này tạo lại, không phải do làn gây xung đột tự sửa.

### I-005 · `recheck:assumptions` phải phân biệt "chưa quét được" với "quét rồi không thấy gì"
Lỗi nhóm Z (số sai mà không gì đỏ), tìm ra bằng chạy thật ở lượt `crux-integrator` ngày 2026-09-21.

`collectCommits` trong `ops/scripts/recheck-assumptions.ts` trả `[]` khi
`for-each-ref refs/remotes/origin/claude/` rỗng, và `judgeTrailerEvidence([])` in ra
`◦ chưa quan sát được — không có commit nào trên nhánh claude/* chưa vào main`. Hai tình huống
khác hẳn nhau lại in ra y hệt:

- **quét rồi không thấy gì** — bình thường, đúng như chú thích của bài kiểm;
- **chưa quét được** — clone của phiên cloud mới `git fetch origin main`, chưa có ref nào của
  `origin/claude/*`. Đây là chế độ chạy **mặc định** của cả ba routine, nên bài kiểm G14 của
  bước 4 (thứ Hai) sẽ im lặng không kiểm gì trong hầu hết các lượt.

Cùng lượt đó, chạy lại sau khi `git fetch origin` cho **G14 khớp, 24/24 commit có trailer** —
tức bài kiểm chạy được, chỉ là nó đã bỏ qua một cách lặng lẽ.

- deps: `I-003`
- risk: low
- status: ready
- nguồn: phụ lục P3 bước 4; CLAUDE.md mục 7 ("kiểm bằng chạy thật"); `ops/known-failures.md` nhóm Z
- tiêu chí xong:
  - Không có ref `origin/claude/*` nào thì bài kiểm ra nhánh **`broken`** (`⚠ … KHÔNG CHẠY ĐƯỢC`,
    cơ chế đã có sẵn), **không** ra `◦ chưa quan sát được`.
  - Bài kiểm tự `git fetch origin 'refs/heads/claude/*:refs/remotes/origin/claude/*'` trước khi quét,
    hoặc phụ lục P3 bước 4 ghi rõ phải fetch trước — chọn một, đừng để cả hai cùng không ai làm.
  - Test tái hiện lỗi (bắt buộc, bất biến I2): một repo git dựng thật, **không** có ref
    `origin/claude/*`, phải cho `broken` chứ không cho `observedNothing`.
