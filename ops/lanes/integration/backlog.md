# 🤖 Backlog làn `integration` — Đợt 1

Làn nền, **ưu tiên số một** trong `priority.md`: `main` đỏ chặn mọi làn khác.

Phần lớn việc của làn này chạy bằng routine `crux-integrator` (phụ lục P3), không bằng mục backlog. Các mục dưới đây là công cụ mà routine đó cần.

---

### I-001 · Dọn PR nháp đã bỏ
- deps: —
- risk: low
- status: done
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
- status: done
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
- status: done
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
- status: done
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
- status: review
- nguồn: phát hiện khi làm `I-004`; CHARTER mục 7; KF-005
- tiêu chí xong:
  - ✅ **Kiểm trước, dựa vào sau (CHARTER 11.1):** ca hỏng **tái hiện được**, dựng bằng git thật và `pnpm` thật trước khi viết một dòng cơ chế nào. Hình dạng: một bên bỏ phụ thuộc cuối cùng còn dùng một gói (khối `packages:` biến mất), bên kia thêm phụ thuộc vào đúng gói đó ở một gói khác trong workspace (chỉ `importers` đổi). Hai vùng cách nhau xa hơn ba dòng ngữ cảnh của git ⇒ **gộp sạch**, không một dấu xung đột, mà `pnpm install --frozen-lockfile` đỏ với `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`.
  - ✅ Sau mỗi lần gộp có chạm `pnpm-lock.yaml`, integrator kiểm → tạo lại bằng `ops/scripts/integrator-lockfile.ts` → **kiểm lại**: `guardLockfileAfterMerge` trong `ops/scripts/integrator-resolve.ts`, chạy ở **cả** đường `clean` **lẫn** đường union (lockfile đổi được mà không hề nằm trong danh sách xung đột), và luôn chạy **trước** commit vì bản mồi nằm ở `MERGE_HEAD`. Còn đỏ sau khi tạo lại thì huỷ gộp, trả `aborted-ineligible`.
  - ✅ Test tái hiện đi kèm (bất biến I2): `ops/test/integrator-clean-merge-lockfile.test.ts`, 4 bài, không gọi mạng — phụ thuộc là tarball dựng tại chỗ tham chiếu bằng `file:`, nên nó có khối `packages:` thật mà `workspace:*` không có. Kiểm bằng đột biến: bỏ cổng thì 2 bài đỏ.
  - ⚠️ **Đo được và phải ghi lại, vì nó đổi cách sửa:** hai cổng KHÔNG bắt cùng một thứ. Trên đúng cây gộp hỏng đó, `pnpm install --lockfile-only --frozen-lockfile` **xanh** mã 0, chỉ `pnpm install --frozen-lockfile` mới đỏ. Cổng rẻ chỉ đối chiếu specifier của `importers`; nó không hỏi phép phân giải có thật trong `packages:` hay không. Cổng cuối của `regenerateLockfile` (`I-004`) chính là cổng rẻ đó — nên `I-006` không dùng lại nó mà thêm `verifyLockfileInstall` (cài thật). Giới hạn của cổng mới, ghi trước: nó **cài thật**, nên một lượt không ra được mạng cũng cho đỏ; hướng sai của nó là an toàn (huỷ gộp, giao người), và nguyên văn đầu ra của `pnpm` đi kèm trong `reason` để phân biệt hai ca.
  - ✅ **Vòng soát chéo (subagent, ngữ cảnh sạch) tìm ra một hồi quy thật, đã sửa trong cùng PR:** cổng cài thật, mà `pnpm install` không thấy lockfile thì **tự sinh** một bản mới rồi thoát 0 — nên lần gộp mà một bên vừa **xoá** `pnpm-lock.yaml` bị cổng hồi sinh đúng file đó và để lại cây bẩn, trái hợp đồng "không bao giờ sửa `cwd` khi huỷ" của `resolveAdditiveMerge`. Nay guard bỏ qua khi lockfile không còn trong cây đã gộp. Cùng vòng soát: `maxBuffer` 64 MiB cho lệnh cổng (trần 1 MiB mặc định làm cổng đỏ vì `ENOBUFS`, không vì lockfile), tách `aborted-error` khỏi `aborted-ineligible` khi cổng **không chạy được** thay vì **chạy xong và đỏ**, và một bài kiểm cho **đường union** — đột biến cho thấy nửa union của cổng trước đó không có bài nào phủ.
  - **Còn treo, có chủ đích:** một dạng lệch thứ hai đã đo được mà cổng này **không** bắt — gộp sạch để lại một khối `importers` cho một gói không còn là thành viên workspace (một bên thu hẹp `packages:` trong `pnpm-workspace.yaml`, bên kia thêm gói mới). `pnpm install --frozen-lockfile` xanh trên ca đó; `pnpm install --lockfile-only` dọn sạch nó. Không xây thêm cổng ở đây: chưa đo được hệ quả thật nào của nó, và `I-006` bắt kiểm trước rồi mới dựa vào. Ghi ở Z17 để lượt sau nhận.

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
- status: review
- nguồn: vòng soát `I-005`; `ops/known-failures.md` nhóm Z (cách 3 — cấm im lặng)
- tiêu chí xong:
  - `git ls-remote --heads origin 'refs/heads/claude/*'` rỗng → `◦ chưa quan sát được` (quan sát hợp lệ);
    `ls-remote` hoặc `fetch` hỏng → `broken`.
  - Test cho cả hai nhánh, dựng kho bare thật.
  - Ghi lại trong `docs/assumptions.md` mục G14 và hàng Z15 của `ops/known-failures.md`.
- **Đã làm** (PR `#53`): thêm `listRemoteClaudeBranches()` vào `ops/scripts/recheck-assumptions.ts`, hỏi
  thẳng remote bằng `git ls-remote --heads origin 'refs/heads/claude/*'` — không phụ thuộc kết quả fetch
  cục bộ. `collectCommits()` chỉ ném khi hàm này cũng không xác nhận được rỗng (remote lệch với fetch cục
  bộ, hoặc chính `ls-remote` lỗi); remote xác nhận rỗng thì trả `[]` như một quan sát hợp lệ, đi qua đúng
  nhánh `observedNothing` sẵn có của `judgeTrailerEvidence`. Test dựng hai kho bare thật trong
  `ops/test/recheck-assumptions.test.ts`: một remote thật rỗng (khẳng định KHÔNG ném, in `◦`), một remote
  hỏng (khẳng định `listRemoteClaudeBranches` vẫn ném). Test cũ của `I-005` dựng đúng kịch bản mục này
  sửa nên viết lại thành khẳng định hành vi mới thay vì xoá, giữ nguyên bằng chứng hồi quy của bug gốc.
  Cập nhật `docs/assumptions.md` mục G14 và hàng Z15 của `ops/known-failures.md`.

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
- status: done
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
  Kiểm nằm trong `pnpm contracts` (`ops/scripts/check-fixtures.ts`), mười bốn test trong đó mười hai
  test âm; làm lệch `locale` thành `en-GB` thì `pnpm contracts` đỏ đúng một dòng. Bản sao genre cũng
  đã lệch thật — thiếu năm khoá `limits` — nên nó bị bỏ cùng bản sao channel.
  Vòng soát ngữ cảnh sạch nêu một điểm **chặn** và năm điểm **nên sửa**, đã xử hết trong PR:
  luật khoá đổi từ "cấm đúng tên `packs`" sang **danh sách cho phép** (bản sao tên `channelPack` hay
  `limits` trước đó đi qua im lặng); tên xưởng lạ trong `upstream` và `upstream: null` nay đỏ; mỗi
  artifact đầu vào được validate theo contract — và nó bắt ngay một lỗi thật: `release` fixture thiếu
  trường bắt buộc `payload.preflight.antiSlide`; `readInputFile` chuyển sang `kernel/src/input.ts` vì
  nó không còn chỉ phục vụ CLI; bản sao pack thứ bảy trong `workshops/topic/test/stub.test.ts` cũng
  bỏ. Điểm **chặn**: hàng Z16 ban đầu khai "đã xong" trong khi bản sao artifact trong `upstream` vẫn
  trôi thật (`assembly←visual` 14 đường dẫn, `release←assembly` 28) — hàng Z16 hạ xuống **một phần**,
  hai bản sao đó làm mới từ snapshot, và mục **`I-009`** mở để quyết cơ chế nguồn cho chúng.

### I-009 · Artifact trong khối `upstream` của fixture là bản sao tập vàng, và đã trôi

Tìm ra trong vòng soát của `I-008`, đã đo bằng chạy thật.

`I-008` bỏ được bản sao **pack** trong fixture, nhưng khối `upstream` của fixture vẫn là **bản chép**
của `ops/golden/ep-0001-stub/snapshots/*.json`, và bản chép đó đã lệch:

- `workshops/assembly/fixtures/input.json` ← `visual`: **14** đường dẫn lệch (`hasMotion` của 14 scene).
- `workshops/release/fixtures/input.json` ← `assembly`: **28** đường dẫn lệch, cộng **thiếu hẳn** trường
  bắt buộc `payload.preflight.antiSlide` và hai check `motion-coverage`, `longest-static-run`.

`I-008` đã làm mới hai bản sao đó và thêm hai lớp bắt: `readInputFile` validate mỗi artifact đầu vào
theo contract (bắt được ca **thiếu trường** — chính ca `antiSlide` ở trên), và `pnpm contracts` so bốn
trường bối cảnh với channel pack. Nhưng **nội dung payload vẫn không bị buộc vào nguồn nào**: một
bản sao hợp contract mà lệch snapshot vẫn xanh, nên nó trôi lại được. Đúng hàng **Z16** của
`ops/known-failures.md`, phần chưa phủ.

Quyết định cần ra ở đây không nhỏ, nên nó là một mục riêng chứ không phải phần đuôi của `I-008`:
buộc fixture bằng snapshot thì mỗi lần `pnpm replay -- --update` phải sửa fixture trong cùng PR, mà
CHARTER 6.1 đòi PR cập nhật snapshot **không kèm thay đổi nào khác**. Hai luật đó phải được hoà giải
trước khi viết máy kiểm.

- deps: `I-008`
- risk: low
- status: review
- nguồn: vòng soát `I-008` (PR `#40`); `ops/known-failures.md` hàng Z16; CHARTER 6.1
- tiêu chí xong:
  - Chọn và ghi lý do một trong ba: (a) fixture **đọc** snapshot tập vàng lúc chạy, (b) fixture giữ bản
    sao cộng một kiểm so với snapshot, (c) fixture cố ý độc lập với tập vàng — và khi đó nêu rõ nguồn
    thật của nó là gì, vì "không có nguồn" là chỗ Z16 sống.
  - Nếu chọn (a) hoặc (b): hoà giải với CHARTER 6.1 — nói rõ một PR `pnpm replay -- --update` được
    phép chạm file nào, hoặc sửa 6.1 bằng PR `owner-merge` nếu cần.
  - Kiểm nằm trong `pnpm check`, và đỏ thật khi cố tình làm lệch một trường của một artifact đầu vào.
- quyết định: **phương án (a)** — fixture **đọc** snapshot tập vàng lúc chạy.

  Lý do chọn (a) chứ không (b) hay (c), theo đúng thứ tự cân nhắc:

  1. **(a) giữ đúng hình dạng đã dùng cho nửa trước của Z16.** `I-008` không thêm phép so bản sao pack
     với `packs/` — nó **bỏ** bản sao. Một phép so chỉ báo *sau khi* đã lệch; một nguồn duy nhất thì
     không có gì để lệch. Cùng lỗi, cùng cách chữa.
  2. **(a) là phương án duy nhất không đụng CHARTER 6.1.** Đây là chỗ khó mà thân mục nêu. Với (b),
     fixture giữ bản sao nên **mỗi** PR `pnpm replay -- --update` buộc phải sửa kèm sáu file fixture —
     đúng thứ CLAUDE.md mục 1 và CHARTER 6.1 cấm, và muốn hoà giải thì phải sửa 6.1 bằng PR
     `owner-merge`. Với (a), fixture tự đi theo snapshot, nên một PR `--update` **chỉ chạm
     `ops/golden/**`** và không file nào khác. Không cần sửa CHARTER, không cần nới luật.
  3. **(c) bị loại vì không có nguồn thật để nêu.** Sáu fixture này dựng ra để chạy thử đúng đường chạy
     của tập vàng; "độc lập" ở đây sẽ là độc lập trên giấy, và thân mục đã nói "không có nguồn" chính là
     chỗ Z16 sống.

  Hệ quả phụ, ghi để lượt sau khỏi đo lại: luật máy mà hàng **Z13** đề nghị (đỏ khi một PR vừa chạm
  `ops/golden/**` vừa chạm thứ khác) trước mục này **không dựng được** — nó sẽ đỏ với chính các PR nó
  phải cho qua. Nay dựng được.

  Khối `upstream` khai thẳng **vẫn giữ** trong kernel: chạy một xưởng độc lập với artifact viết tay là
  chế độ CHARTER 5.4 nói tới. Luật "fixture trong repo không được chép" nằm ở
  `ops/scripts/check-fixtures.ts`, nơi biết file nào là fixture của repo — kernel trung tính.
- đã làm:
  - `kernel/src/input.ts`: khoá `upstreamFrom` (`{ golden, workshops }`), `goldenSnapshotPath`, và luật
    **ném ở mọi cách khai sai**. Không nhánh nào trả `upstream` rỗng rồi chạy tiếp: "nạp được 0
    artifact" và "xưởng này không tiêu thụ gì" trông giống hệt nhau lúc chạy. Xưởng không tiêu thụ gì
    (`topic`) khai `upstream: {}`, không khai `upstreamFrom` với danh sách rỗng.
  - `ops/scripts/check-fixtures.ts`: `upstreamCopyProblems` — fixture trong repo khai thẳng `upstream`
    không rỗng là đỏ. Phép so bối cảnh chuyển sang đọc khối `upstream` **đã dựng xong**, không đọc thô
    từ file: với `upstreamFrom` thì file không còn gì để đọc thô, mà phép so vẫn cần chạy — nó là thứ
    bắt một snapshot khai bối cảnh lệch channel pack.
  - Sáu `workshops/<tên>/fixtures/input.json`: **3959 dòng bản chép đổi thành 6 con trỏ** (77 dòng tổng).
  - `kernel/test/input.test.ts` (mới, 13 test) và 6 test mới trong `ops/test/check-fixtures.test.ts`.
- còn treo:
  - Luật máy của hàng **Z13** vẫn chưa ai dựng — mục này chỉ gỡ thứ chặn nó, không dựng nó. Nếu dựng thì
    là một mục riêng, và nó nằm trong `ops/workflows/` chứ không phải `pnpm check`.
  - `upstreamFrom.workshops` khai tay, không suy từ `definition.consumes`. Cố ý ở PR này (`readInputFile`
    nhận một đường dẫn file chứ không nhận `definition`), nhưng **vòng soát chéo đã đo và nó nặng hơn
    câu trên**: đổi `consumes` của một xưởng rồi chạy `pnpm replay -- --update` thì `pnpm check` **xanh
    hoàn toàn** trong khi fixture vẫn trỏ tới bộ xưởng cũ. Đo thật: `workshops/release/src/index.ts` để
    `consumes: ['editorial','assembly']` còn fixture giữ `['topic','editorial','assembly']` → check xanh,
    chạy độc lập exit 0, artifact mang thừa một đầu vào. Tức nó **không** chỉ lộ ra qua `inputsHash` như
    ghi ban đầu — chỉ lộ tới lần `--update` hợp lệ kế tiếp, sau đó không gì thấy nữa. Thành mục `I-011`.
  - `goldenSnapshotPath` giải đường dẫn bằng `resolve`, nên `upstreamFrom.golden` khai `../..` trỏ được
    ra ngoài `ops/golden/`. Với fixture trong repo thì test `kernel/test/input.test.ts` #19 bắt được (nó
    so từng artifact với snapshot thật), nhưng kernel tự nó không chặn. Không siết ở PR này vì đó là đổi
    hành vi ngoài tiêu chí xong; ghi để lượt sau quyết.

### I-010 · Mục đã vào `main` mà vẫn nằm `status: review` — không có gì chuyển nó sang `done`

Tìm ra ở lượt `crux-worker-2` ngày 2026-09-21, khi duyệt làn theo `ops/lanes/priority.md` và **không**
nhận được mục nào: cả ba mục `ready` của làn `integration` (`I-006`, `I-007`, `I-009`) đều bị chặn bởi
`deps` là mục mà PR **đã merge vào `main`** rồi.

`ops/lanes/README.md` định nghĩa `deps` là "các mục phải `done` trước". Phụ lục P1 bước 7 đặt mục sang
`review` trong chính PR của nó. Nhưng **không bước nào** trong P1, P2 hay P3 đặt nó sang `done` sau khi
PR merge — phụ lục P3 bước 2 ("Dọn dẹp") chỉ đóng PR nháp bỏ quá 72 giờ và tạo lại lockfile.

Hệ quả đo được trên `main` ở `61fb084`: **15 mục** có PR đã merge mà vẫn `review`. Chỉ hai mục trong cả
repo ở `done`, và cả hai được sửa tay trong một PR khác (`P-008` ở `bc48f6e`, `VF-G18` trong PR của
`I-004`). Mọi mục có `deps` vì thế đứng chờ vĩnh viễn, và làn `integration` — **ưu tiên số một** —
là làn chết đói nặng nhất.

Đây đúng **nhóm lỗi Z** của `ops/known-failures.md`: hỏng mà mọi chỉ báo đều xanh. CI xanh, PR merge
đẹp, backlog đọc vẫn hợp lệ — chỉ có hàng đợi việc là cạn, và cách duy nhất nó lộ ra là một worker
đọc tay từng `deps`. Tỉ lệ tự phát hiện hiện tại: 0.

- deps: —
- risk: low
- status: review
- nguồn: `ops/lanes/README.md` (định nghĩa `deps`); CHARTER phụ lục P1 bước 7, P3 bước 2; `ops/known-failures.md` nhóm Z
- tiêu chí xong:
  - `ops/scripts/backlog-status.ts`: đối chiếu mọi mục `status: review` trong `ops/lanes/*/backlog.md`
    với commit trên `main`, và phân loại mỗi mục thành đúng một trong ba nhóm — `stale` (nên chuyển
    `done`), `held` (cố ý giữ `review`), `unmerged` (chưa thấy commit hoàn thành).
  - Luật phải **thận trọng theo hướng an toàn**: chỉ `stale` khi có commit `[<lane>] <id> — …` trên
    `main`, **không** có commit `Revert` nào của nó, **và** thân mục không còn dấu treo nào.
    Dấu treo gồm **cả ký hiệu lẫn lời văn** (`HOLD_MARKERS`): ô `⬜`, và các câu "không đóng khi PR
    merge", "chỉ chuyển `done` khi…", "chỉ đóng khi…", "Chưa kiểm bằng chạy thật", "Còn treo".
    Đoán sai theo hướng này chỉ để lại một mục chờ thêm một nhịp, và mục đó vẫn hiện ra ở nhóm
    `held`; đoán sai theo hướng kia mở khoá một `deps` chưa thật sự xong, và không gì bắt được.
  - Mục không đọc được `status` (thụt lề sai, tiêu đề trần) ra nhóm `unknown` — **không** bị lọc đi
    im lặng, vì một mục biến mất khỏi báo cáo đúng là nhóm lỗi Z mà mục này chữa.
  - Test, gồm test âm: mục chặn bằng lời không bị chuyển; mục còn `⬜` không bị chuyển; mục đã bị
    revert không bị chuyển; mục không có commit hoàn thành không bị chuyển; commit nhắc `id` trong
    ngoặc mà không đúng dạng tiêu đề (`… (KF-005, P-015)`) không tính là hoàn thành; "Chưa làm, cố ý"
    (`I-003`) **không** phải dấu treo — đó là loại trừ phạm vi có chủ ý.
  - `pnpm backlog:status` báo cáo, `--fix` ghi lại file. **Không** đưa vào `pnpm check`: ngay sau khi
    một PR merge, mục của nó còn `review` trong đúng một nhịp — cổng cứng ở đó sẽ làm `main` đỏ sau
    **mỗi** lần merge, tự tạo ra nhóm lỗi mới.
  - Chạy `--fix` một lần trong chính PR này, và gỡ dòng ghim `P-018` ở `ops/lanes/priority.md` đúng như
    file đó tự dặn ("Gỡ dòng này khi … chuyển `done`"). Dòng ghim `P-016` **giữ lại**: `P-016` chưa
    `done`, và PR #39 vẫn `aborted-ineligible` năm lượt liên tiếp.
  - Nối vào phụ lục P3 bước 2 là **việc của lượt sau**, cố ý tách ra: PR #43 đang mở và đang sửa
    CHARTER, nên chạm CHARTER ở đây là tự tạo xung đột cho hàng đợi tuần tự.

- vòng soát chéo (subagent, ngữ cảnh sạch) — điểm chặn đã sửa, ghi lại vì nó là bằng chứng cho chính
  luật của mục này:
  - **Bốn mục bị lật nhầm sang `done`** ở vòng đầu (`P-011`, `P-013`, `P-016`, `I-002`) vì luật lúc đó
    chỉ đọc ô `⬜`, trong khi thân bốn mục đó chặn bằng **lời**: "mục này chỉ đóng khi có xác nhận đó,
    không đóng khi PR merge". Ba trong bốn là **cổng** — `P-011` chặn DoD Đợt 0, `P-013` là cổng của
    `G16`, `P-016` là cổng của hàng đợi merge. Đã trả cả bốn về `review` và mở rộng luật sang lời văn.
  - Bằng chứng lịch sử cho cùng điểm đó: trên `main` có **hai** commit `[platform] P-018 — …` (#25 chỉ
    "nhận chỉ dẫn vào backlog", #26 mới thực hiện) — tiêu đề đúng dạng **không** đảm bảo mục đã xong.
  - Ca **revert** và ca **mục không đọc được `status`** cũng do vòng soát nêu; cả hai nay có luật và test.

- cặn còn lại, khai trước thay vì để tự phát hiện:
  - ⬜ **`platform/P-015`** đã vào `main` thật (PR `#13`), nhưng tiêu đề commit là
    `platform: file log dùng chung … (KF-005, P-015)` — không đúng dạng `[<lane>] <id> — …`, nên tool
    xếp nó vào `unmerged` và **không** đụng tới. Đây là lựa chọn có chủ ý: nới luật khớp để vớt ca này
    sẽ vớt luôn `P-014` (commit `platform: rà soát … (P-014)`), mà `P-014` **chưa** xong — nó vẫn
    `ready`. Chuyển `P-015` sang `done` là việc đọc tay một lần, không phải việc của máy.
  - ⬜ Nối `pnpm backlog:status --fix` vào phụ lục P3 bước 2 (xem trên). Tới khi đó, tool phải được
    gọi tay — nên mục này giữ `review`, không `done`, cho tới khi lượt sau nối xong.
  - ⬜ `I-001` ghi ngưỡng bỏ PR nháp là **72 giờ**, trong khi CHARTER phụ lục P1 bước 3 và CLAUDE.md
    mục 2 ghi **24 giờ**. Lệch này có từ trước mục `I-010`, không sửa ở đây để không trộn phạm vi.

### I-011 · `consumes` của một xưởng nay có ba bản chép tay, và lệch nhau thì không gì đỏ

Tìm ra trong vòng soát của `I-009`, đã đo bằng chạy thật.

`I-009` bỏ được bản chép **artifact** trong fixture, nhưng nó đẩy Z16 lên một tầng: danh sách xưởng
tiêu thụ nay viết tay ở **ba** chỗ, và không chỗ nào buộc vào chỗ nào —

1. `definition.consumes` trong `workshops/<tên>/src/index.ts` — nguồn thật, đường chạy tập dùng nó;
2. `upstreamFrom.workshops` trong `workshops/<tên>/fixtures/input.json`;
3. danh sách viết cứng trong `kernel/test/input.test.ts` (bài "sáu fixture … khớp ĐÚNG snapshot").

Đo được: đổi `consumes` của `release` thành `['editorial','assembly']` mà để fixture giữ
`['topic','editorial','assembly']` thì `pnpm check` **xanh hoàn toàn** và lệnh chạy độc lập exit 0 với
một artifact đầu vào thừa. `inputsHash` có đổi, nhưng điều đó chỉ lộ ra tới lần `pnpm replay -- --update`
hợp lệ kế tiếp — sau đó không chỉ báo nào còn thấy. Đúng nhóm **Z**: hỏng mà mọi chỉ báo đều xanh.

- deps: `I-009`
- risk: low
- status: ready
- nguồn: vòng soát `I-009` (PR `#54`); `ops/known-failures.md` hàng Z16
- tiêu chí xong:
  - Bỏ bản chép thay vì thêm phép so, nếu làm được: `upstreamFrom.workshops` suy từ `definition.consumes`
    (ví dụ `--input` không khai danh sách, CLI truyền `definition.consumes` xuống `readInputFile`). Không
    làm được thì phải nói rõ vì sao, rồi mới dựng phép so.
  - Danh sách viết cứng trong `kernel/test/input.test.ts` cũng phải hết — một bài kiểm chép lại đúng thứ
    nó đang kiểm thì không kiểm gì.
  - Kiểm nằm trong `pnpm check`, và **đỏ thật** khi đổi `consumes` của một xưởng mà không đổi fixture.

### I-012 · Bài kiểm G14 quét cả nhánh đã merge, nên nó kêu oan và sẽ kêu mãi mãi

Tìm ra ở lượt `crux-integrator` 2026-09-22 02:05 giờ VN — lần đầu phụ lục P3 bước 4 có cơ chế thật để
chạy (`pnpm recheck:assumptions`, mục `I-003`). Đã đo bằng chạy thật.

`collectCommits` quét `refs/remotes/origin/claude/*` trừ `^refs/remotes/origin/main`. Phép loại đó đúng
với ý định — chú thích của `judgeTrailerEvidence` nói rõ loại `main` ra vì **squash làm mất trailer, không
phải agent làm mất** — nhưng nó rò: GitHub merge kiểu **squash**, nên nhánh đã merge vẫn còn trên remote
với **toàn bộ** lịch sử không nằm trong `main`. Bài kiểm vì thế đếm lại đúng những commit mà nó định loại.

Đo được, lượt 2026-09-22: **14/131 commit "thiếu trailer"**, và phân loại từng commit thì

- **10** nằm trên đúng một nhánh stale, `origin/claude/platform/P-009` (PR `#9` đã merge, nhánh chưa xoá).
  Trong đó có `99d6bcf Initial commit`, `e01a667 Add files via upload`, `087246e Delete .github/...` —
  commit của **chính chủ dự án** qua giao diện web, không bao giờ có trailer và không nên có;
- **2** là `chore: sync workflows from ops/workflows [skip ci]`, do GitHub Action `sync-workflows` sinh;
- **2** là merge tay dạng `Gộp main vào <nhánh>` mà `isToolCommit` không khớp (nó chỉ nhận
  `Gộp … (integrator,` và `Merge branch …`);
- **1** là tín hiệu thật: `7fc292a` (`integration: bước 0 của P3 lượt 23:05`, trên
  `origin/claude/keen-mayer-nzkvdy`) — commit do agent soạn, thiếu trailer `Claude-Session`. Đây là đúng
  phần mà giả định **G14** còn để ngỏ, và là thứ duy nhất trong 14 dòng đáng gọi là quan sát.

Vì sao đáng một mục chứ không phải một dòng ghi chú: bài kiểm này **không bao giờ xanh được nữa**. Commit
của chủ dự án trên nhánh stale sẽ nằm đó mãi, nên mỗi thứ Hai nó lại in sẵn một thân issue `🤖 [QĐ]` cho
một giả định chẳng đổi trạng thái — đúng lý do mà chính script đã bỏ kết luận `nâng` ("một cảnh báo kêu
mọi lượt là một cảnh báo không ai đọc"), và đúng hình dạng `I-005`/`I-007` đã sửa một lần cho ca "kêu
oan". Lượt này phải điều tra tay 14 commit mới dám không mở issue; lượt sau sẽ không may như vậy.

- deps: —
- risk: medium
- status: review
- nguồn: lượt `crux-integrator` 2026-09-22 02:05 giờ VN, `ops/logs/integration/P3-daily-2026-09-22.jsonl`;
  `docs/assumptions.md` G14; mục `I-003`, `I-005`, `I-007`
- tiêu chí xong:
  - Phạm vi quét chỉ còn commit **của agent, trên nhánh còn sống**. Loại nhánh đã merge bằng câu hỏi trả
    lời được — ví dụ đối chiếu với danh sách PR đang mở, hoặc loại mọi commit có trước điểm rẽ của nhánh
    khỏi `main` — chứ không phải nới `isToolCommit` cho tới khi hết đỏ. Nới danh sách chữ ký là vá sản
    phẩm (CLAUDE.md mục 13).
  - `isToolCommit` nhận thêm hai dạng đã đo được: `chore: sync workflows…` (máy sinh) và merge tay dạng
    `Gộp <ref> vào <nhánh>`. Mỗi dạng một test âm.
  - Một test dựng kho bare thật có **đúng hình dạng đã gặp** — một nhánh đã squash-merge còn sót trên
    remote, mang commit không trailer — và bài kiểm G14 phải ra `khớp`, không `sai`. Cùng quy ước "không
    mô phỏng" với các test G14/G17 đang có trong `ops/test/recheck-assumptions.test.ts`.
  - `7fc292a` không được biến mất cùng với nhiễu: sau khi siết phạm vi, một commit agent thật sự thiếu
    trailer vẫn phải ra `sai`. Có test cho đúng điều đó.
- **Đã làm:**
  - `collectCommits` (`ops/scripts/recheck-assumptions.ts`) nay lọc `refs/remotes/origin/claude/*` còn
    đúng nhánh có **PR mở**, trước khi `git log` — trả lời "trả lời được" mà tiêu chí xong đòi, không đoán
    theo ngày hay theo lịch sử git (squash không giữ SHA cũ nên "điểm rẽ khỏi `main`" của một nhánh stale
    không nói lên gì). `fetchOpenPrBranches()` gọi `gh pr list --state open` — cùng quy ước gọi lệnh với
    `fetchMergedPrs()` của `ops/scripts/update-metrics.ts`, không phải cách mới. Nhánh hết PR mở (đã
    merge/đã đóng) loại thẳng khỏi phạm vi quét: `liveRefs.length === 0` trả `[]` như một quan sát hợp lệ
    (cùng nhánh `observedNothing` với ca "kho không còn nhánh nào" của `I-007`), không phải lỗi.
  - `isToolCommit` nhận thêm đúng hai dạng đã đo được, neo chặt để không rơi lại thành danh sách đen:
    `chore: sync workflows from ops/workflows` (tiền tố do Action `sync-workflows` sinh) và
    `Gộp (origin/)?main(...) vào ` (mốc neo là "main"/"origin/main" ngay sau "Gộp", không phải chữ
    "Gộp … vào" nói chung — giữ nguyên vẹn ca âm `"Gộp hai mô hình định lượng vào một bảng"` đã có).
  - Test mới trong `ops/test/recheck-assumptions.test.ts`: hai test cho `isToolCommit`, ba test cho
    `collectCommits` (nhánh stale bị loại dù thiếu trailer thật; nhánh sống vẫn ra `sai` khi thật sự thiếu
    trailer — phép lọc mới không được nuốt tín hiệu thật; mọi nhánh hết PR mở thì trả rỗng, không ném).
    Ba test `collectCommits` cũ (mục `I-005`, `I-007`) cập nhật để tự khai nhánh nào có PR mở, không gọi
    `gh` thật trong test.
  - `ops/known-failures.md` hàng **Z15**: thêm đoạn "Sửa tiếp ở mục `I-012`".

### I-013 · Contract của xưởng nằm ngoài tầm quét của `pnpm contracts`

Tìm ra trong vòng soát của `topic/T-008` (reviewer ngữ cảnh sạch, PR `#91`).

`ops/scripts/check-contracts.ts` chạy `unsupportedKeywords` trên phong bì cộng sáu payload v0 của
`kernel/contracts/`, và chỉ thế. Mục `T-008` thêm ba contract ở `workshops/topic/contracts/` — đúng luật
phân định của CLAUDE.md mục 12, vì corpus và kiểm mới lạ không trung tính với thể loại lẫn kênh, nên chúng
không thuộc `kernel/`. Nhưng thư mục đó **không ai quét**.

`T-008` tự bù bằng ba test gọi `unsupportedKeywords` cho ba schema của nó. Cơ chế bù đó là **opt-in**:
contract thứ tư thả vào `workshops/*/contracts/` mà tác giả quên viết test tương ứng thì nó dùng từ khoá
validator chưa hiểu, ràng buộc im lặng không được kiểm, và **không gì đỏ**. Đúng hình dạng nhóm **Z** —
và đúng cái mà chính `pnpm contracts` tồn tại để chặn ("một ràng buộc được viết ra nhưng không được kiểm
còn tệ hơn là không viết").

- deps: —
- risk: low
- status: review
- nguồn: vòng soát `topic/T-008` (PR `#91`); `ops/known-failures.md` nhóm Z
- tiêu chí xong:
  - ✅ `pnpm contracts` quét cả `workshops/*/contracts/*.schema.json`, không chỉ `kernel/contracts/` —
    việc số 6, `ops/scripts/check-workshop-contracts.ts`. Quét **đệ quy**, nên thư mục con không thoát.
  - ✅ Phép quét **đỏ thật** khi thả một schema dùng từ khoá ngoài `SUPPORTED_KEYWORDS` vào thư mục đó — có
    test tái hiện, không chỉ có lời. `ops/test/check-workshop-contracts.test.ts` bài cuối chạy chính
    `ops/scripts/check-contracts.ts` trên một gốc tạm và đọc mã thoát, kèm bài đối chứng với schema sạch.
    Đã kiểm rằng bài đó **đỏ** khi gỡ dòng nối ở `check-contracts.ts` — quét đúng mà không ai gọi vẫn là
    "không gì đỏ".
  - ✅ Ba test `unsupportedKeywords` viết tay trong `workshops/topic/test/` bỏ đi được, vì chúng trở thành
    bản chép của phép quét chung (cùng luật Z16 với `I-008`, `I-009`, `I-011`). Mỗi file giữ một ghi chú
    nói phép kiểm đó nay nằm ở đâu.
- PR: `#95`
