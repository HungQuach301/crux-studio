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
- status: review
- nguồn: CHARTER mục 7 (file nóng được phân vùng)
- tiêu chí xong: lockfile do làn này tạo lại, không phải do làn gây xung đột tự sửa.
  - ✅ Cơ chế là tool chạy được, không phải chỉ dẫn bằng lời: `ops/scripts/integrator-lockfile.ts`, gọi từ
    `integrator-resolve.ts` — tức là từ bước 0 của routine integrator VÀ từ đầu mỗi lượt worker (phụ lục P1).
    Làn gây xung đột không phải chạm vào lockfile, và cũng không được: nó là file dẫn xuất.
  - ✅ Lockfile **tách khỏi** luật "thuần cộng thêm" của `P-016`. Xung đột lockfile thật gần như luôn có sửa
    dòng ở cả hai bên, nên luật cũ luôn trả `aborted-ineligible`; union thì merge được mà vẫn hỏng (nhóm lỗi
    Z — KF-005 đã ghi). Tạo lại từ manifest của cây vừa gộp là cách duy nhất không cần người.
  - ✅ **Không trôi phiên bản:** bản mồi lấy từ `MERGE_HEAD` (thân chung, thực tế là `origin/main`) rồi mới
    gọi `pnpm install --lockfile-only`, nên mọi phép phân giải còn thoả manifest được giữ nguyên.
  - ✅ **Kiểm lại bằng đúng cổng CI dùng:** `pnpm install --frozen-lockfile` chạy ngay sau khi sinh; đỏ thì
    `git merge --abort`, không push. Đã kiểm bằng đột biến rằng cổng này đỏ thật khi lockfile lệch manifest.
  - ✅ **Hai chỗ dừng lại thay vì đoán,** cả hai có test âm: manifest (`package.json`, `pnpm-workspace.yaml`)
    xung đột cùng lúc → `aborted-ineligible` (sinh lockfile từ JSON đã bị union làm hỏng là đóng băng cái
    hỏng vào một file không ai đọc bằng mắt); lockfile bị xoá ở một bên → `aborted-ineligible`.
  - ✅ `.gitattributes` ghi rõ vì sao union **không** áp cho lockfile; KF-005 ghi cùng lý do.
  - ✅ 10 test trong `ops/test/integrator-lockfile.test.ts`: git thật, workspace pnpm thật, `pnpm` thật, và
    fixture không gọi mạng (mọi phụ thuộc là `workspace:*`). Kiểm bằng đột biến: gỡ đường lockfile ra thì
    4 test đỏ.

### I-006 · Lockfile gộp **sạch** mà vẫn lệch manifest
Tìm ra khi làm `I-004`, và cố ý **không** gộp vào đó: `I-004` chỉ phủ ca lockfile **xung đột**. Khi git gộp lockfile sạch, integrator không đụng tới nó — nhưng "merge được" không đồng nghĩa "đúng": git ghép hunk theo dòng, không hiểu YAML, nên về lý thuyết nó ghép ra một lockfile lệch với manifest sau khi gộp. Local `pnpm check` **không** bắt được: nó không chạy `pnpm install --frozen-lockfile` (CI mới chạy). Nghĩa là integrator báo "xanh, đã push" rồi CI mới đỏ — đúng nhóm lỗi Z.

- deps: I-004
- risk: low
- status: ready
- nguồn: phát hiện khi làm `I-004`; CHARTER mục 7; KF-005
- tiêu chí xong:
  - **Kiểm trước, dựa vào sau (CHARTER 11.1):** trước khi viết gì, dựng bằng chạy thật một ca git gộp lockfile **sạch** mà kết quả lệch manifest. Không dựng được thì ghi lại là không tái hiện được và đóng mục — không xây cơ chế cho một lỗi chưa ai thấy.
  - Nếu tái hiện được: sau mỗi lần gộp có chạm `pnpm-lock.yaml`, integrator chạy `pnpm install --frozen-lockfile`; đỏ thì tạo lại lockfile bằng `ops/scripts/integrator-lockfile.ts` (đã có sẵn) rồi kiểm lại, thay vì push một PR chắc chắn đỏ ở CI.
  - Test tái hiện đi kèm, theo luật `fix` của bất biến I2.
