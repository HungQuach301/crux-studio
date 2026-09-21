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
    gọi `pnpm install --lockfile-only`, nên mọi phép phân giải còn thoả manifest được giữ nguyên. Có test
    đi qua đường thật, chụp nội dung lockfile **đúng lúc pnpm được gọi** và so với `git show MERGE_HEAD:`.
  - ✅ **Kiểm lại sau khi sinh:** `pnpm install --frozen-lockfile` — cùng cờ CI dùng ở bước cài đặt; đỏ thì
    `git merge --abort`, không push. Ghi đúng sức của nó, không hơn: đột biến cho thấy nó bắt **lệch
    specifier** (bỏ một khối `importers` thì đỏ), nhưng **không** bắt lệch phép phân giải.
  - ✅ **Bốn chỗ dừng lại thay vì đoán,** đều có test âm: manifest (`package.json`, `pnpm-workspace.yaml`)
    xung đột cùng lúc → `aborted-ineligible` (sinh lockfile từ JSON đã bị union làm hỏng là đóng băng cái
    hỏng vào một file không ai đọc bằng mắt); lockfile bị xoá ở một bên; lockfile **không ở gốc repo** (đã
    đo: `pnpm` chạy ở thư mục con thoát 0 mà **không ghi gì** — tool sẽ báo `ok` rồi vứt lặng lẽ một bên);
    bản mồi còn dấu xung đột (đã đo: `pnpm` chỉ nói một câu rồi sinh lại từ số không, vẫn thoát 0). Đầu ra
    của `pnpm` cũng bị soi tìm câu "đã vứt bản mồi" — thoát 0 không đủ để tin.
  - ✅ **Trần `maxBuffer` 1 MiB của `spawnSync`** nâng lên 64 MiB, và `error` nay là thất bại thật. Vượt trần
    thì Node giết tiến trình và trả stdout **cắt cụt** — với `git show <ref>:pnpm-lock.yaml` thì mọi repo có
    phụ thuộc thật vượt ngưỡng đó, nên cơ chế này sẽ chết đúng lúc cần sống. Có test dựng lockfile ~1,9 MiB.
  - ✅ `.gitattributes` ghi rõ vì sao union **không** áp cho lockfile; KF-005 ghi cùng lý do.
  - ✅ 15 test trong `ops/test/integrator-lockfile.test.ts`: git thật, workspace pnpm thật, `pnpm` thật, và
    fixture không gọi mạng (mọi phụ thuộc là `workspace:*`). Kiểm bằng đột biến, mỗi đột biến giết đúng
    test của nó: gỡ đường lockfile (4 đỏ), `MERGE_HEAD`→`HEAD`, bỏ bản mồi, nhận lockfile lồng, trả
    `maxBuffer` về mặc định.
  - ✅ **Giả định nền đã vào sổ và đã kiểm:** `G18` — "`pnpm install --lockfile-only` giữ nguyên phép phân
    giải cũ của bản mồi". Kiểm bằng chạy thật với gói từ registry, hai lần chạy khác nhau đúng một điều
    kiện: có bản mồi → giữ `semver@7.5.0`; sinh từ số không → `semver@7.8.5`, cùng manifest `^7.0.0`.
    Fixture của bộ test toàn `workspace:*` nên **không** quan sát được điều này — vì thế nó được đo riêng
    và ghi vào `docs/assumptions.md` cùng mục `VF-G18`, thay vì để trong đầu người viết.

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
- status: review
- nguồn: phụ lục P3 bước 4; CLAUDE.md mục 7 ("kiểm bằng chạy thật"); `ops/known-failures.md` nhóm Z
- tiêu chí xong:
  - Không có ref `origin/claude/*` nào thì bài kiểm ra nhánh **`broken`** (`⚠ … KHÔNG CHẠY ĐƯỢC`,
    cơ chế đã có sẵn), **không** ra `◦ chưa quan sát được`.
  - Bài kiểm tự `git fetch origin 'refs/heads/claude/*:refs/remotes/origin/claude/*'` trước khi quét,
    hoặc phụ lục P3 bước 4 ghi rõ phải fetch trước — chọn một, đừng để cả hai cùng không ai làm.
  - Test tái hiện lỗi (bắt buộc, bất biến I2): một repo git dựng thật, **không** có ref
    `origin/claude/*`, phải cho `broken` chứ không cho `observedNothing`.

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

### I-007 · Tách "kho thật sự không có nhánh `claude/*`" khỏi "chưa quét được"

Tìm ra trong vòng soát của `I-005`, chưa chặn gì hôm nay.

`collectCommits` ném khi sau fetch vẫn không có ref `origin/claude/*` nào, và `main()` xếp vào
`broken`. Đúng tiêu chí xong của `I-005`, và đúng ở chế độ chạy hiện tại. Nhưng rỗng ở đó có **hai**
nghĩa, và một trong hai là quan sát hợp lệ:

- **chưa quét được** — fetch hỏng, thiếu quyền đọc nhánh. Phải kêu.
- **kho thật sự không còn nhánh `claude/*`** — mọi PR đã merge và nhánh đã xoá. Không có gì để quan
  sát, nhưng cũng không có gì hỏng.

Repo hiện **không** xoá nhánh sau merge (`origin/claude/integration/I-001…` vẫn còn), nên vế thứ hai
chưa xảy ra. Bật xoá nhánh sau merge là nó thành một cảnh báo kêu mãi — và một cảnh báo kêu mọi lượt
là một cảnh báo không ai đọc.

- deps: `I-005`
- risk: low
- status: ready
- nguồn: vòng soát `I-005`; `ops/known-failures.md` nhóm Z (cách 3 — cấm im lặng)
- tiêu chí xong:
  - `git ls-remote --heads origin 'refs/heads/claude/*'` rỗng → `◦ chưa quan sát được` (quan sát hợp lệ);
    `ls-remote` hoặc `fetch` hỏng → `broken`.
  - Test cho cả hai nhánh, dựng kho bare thật.
  - Ghi lại trong `docs/assumptions.md` mục G14 và hàng Z15 của `ops/known-failures.md`.

### I-008 · Fixture của sáu xưởng còn nhúng bản sao Channel Pack của Đợt 0

Tìm ra trong vòng soát của `topic/T-002`, chưa chặn gì và chưa làm đỏ gì.

`workshops/<tên>/fixtures/input.json` của cả sáu xưởng nhúng một **bản sao** channel pack, và bản sao
đó là bản tối thiểu của Đợt 0: còn `pillars: ["thresholds","tradeoffs","timing"]`, còn câu `$note`
"bản đầy đủ … được làn `topic` chuyển vào đây ở Đợt 1" — câu đó nay đã sai, `T-002` đã chuyển xong.

Không có gì đỏ vì fixture chạy độc lập và tập vàng không nhúng pack (`inputsHashOf` chỉ băm con trỏ
artifact đầu vào, không băm pack). Đó đúng là lý do nó nguy hiểm về sau: bản sao lệch bản thật mà
mọi chỉ báo vẫn xanh — cùng họ với nhóm **Z** trong `ops/known-failures.md`.

Sửa ở làn `integration` chứ không ở `topic`: sáu file này thuộc sáu làn khác nhau, gom vào một mục
chéo làn rẻ hơn sáu PR.

- deps: —
- risk: low
- status: review
- nguồn: vòng soát `topic/T-002` (PR `#38`), phát hiện 4
- tiêu chí xong:
  - Quyết được một trong hai hướng, và ghi lý do: fixture **đọc** pack thật lúc dựng, hay fixture giữ
    bản sao nhưng có một kiểm so bản sao với `packs/channels/<slug>/channel.json`.
  - Kiểm đó nằm trong `pnpm check`, và đỏ thật khi cố tình làm lệch một trường.
  - Sáu fixture khớp pack thật, hoặc khai rõ trường nào cố ý khác và vì sao.
- **Đã làm** (PR `#40`): chọn hướng **đọc pack thật**. `readInputFile` của kernel nạp channel pack và
  genre pack từ `packs/` theo trường `channel`, và ném lỗi nếu file `--input` nhúng khoá `packs` hoặc
  khai `genre`/`locale` lệch channel pack; sáu fixture bỏ khối `packs`. Lý do chọn hướng này: một nguồn
  duy nhất thì không còn gì để lệch — kiểm so sánh chỉ báo *sau khi* đã lệch — và một pack đổi không
  còn phải sửa sáu file thuộc sáu làn, nên không sinh xung đột chéo làn (cùng lý do với `P-015`).
  Kiểm nằm trong `pnpm contracts` (`ops/scripts/check-fixtures.ts`), chín test trong đó bảy test âm;
  làm lệch `locale` thành `en-GB` thì `pnpm contracts` đỏ đúng một dòng. Bản sao genre cũng đã lệch
  thật — thiếu năm khoá `limits` — nên nó bị bỏ cùng bản sao channel. Hàng **Z16** vào
  `ops/known-failures.md`.
