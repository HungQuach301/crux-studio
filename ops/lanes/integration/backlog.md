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
- hold: chưa kiểm bằng chạy thật — routine crux-integrator (P3 bước 3) chưa gọi update-metrics lần nào
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
- hold: còn treo có chủ đích — dạng lệch importers thứ hai chưa đo được hệ quả thật (Z17); kiểm trước rồi mới dựng cổng
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
- status: done
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
- hold: còn treo — luật máy Z13 chưa dựng; upstreamFrom.workshops khai tay chưa suy từ consumes (thành I-011)
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
- hold: còn treo — nối `pnpm backlog:status --fix` vào phụ lục P3 bước 2 (đang ở PR #112) và vài mục con ⬜ khác chưa vào main
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
  - ✅ **Đã nối ở mục `I-015`** (lượt `crux-worker-1`, 2026-09-22): `pnpm backlog:status --fix` nay nằm
    trong phụ lục P3 bước 2, và phụ lục P1 bước 3 đọc `readyNow` thay vì đối chiếu `deps` bằng mắt. Mục
    này vẫn `review` vì hai ô `⬜` còn lại bên dưới chưa xong.
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
- status: done
- nguồn: vòng soát `I-009` (PR `#54`); `ops/known-failures.md` hàng Z16
- tiêu chí xong:
  - Bỏ bản chép thay vì thêm phép so, nếu làm được: `upstreamFrom.workshops` suy từ `definition.consumes`
    (ví dụ `--input` không khai danh sách, CLI truyền `definition.consumes` xuống `readInputFile`). Không
    làm được thì phải nói rõ vì sao, rồi mới dựng phép so.
  - Danh sách viết cứng trong `kernel/test/input.test.ts` cũng phải hết — một bài kiểm chép lại đúng thứ
    nó đang kiểm thì không kiểm gì.
  - Kiểm nằm trong `pnpm check`, và **đỏ thật** khi đổi `consumes` của một xưởng mà không đổi fixture.
- **Đã làm:**
  - Chọn phương án **bỏ bản chép**, đúng khuyến nghị "nếu làm được". `UpstreamFrom` bỏ trường `workshops`;
    fixture chỉ khai `{ "golden": "<tập>" }`. `readInputFile(root, path, consumes)` nhận danh sách xưởng
    cần nạp từ bên gọi: CLI truyền `definition.consumes` (`kernel/src/cli.ts`), năm fixture `upstreamFrom`
    bỏ mảng `workshops`, năm stub test truyền `definition.consumes`. Một nguồn duy nhất
    (`definition.consumes` ở `workshops/<tên>/src/index.ts`), không còn bản chép thứ hai để trôi.
  - `check-fixtures.ts` lấy `consumes` từ `DEFINITIONS` của `pipeline.ts` (nơi DUY NHẤT được import nhiều
    xưởng, bất biến I3) — không tự chép lại danh sách. `pipeline.ts` export `DEFINITIONS` cho việc này.
  - Danh sách viết cứng trong `kernel/test/input.test.ts` (bài "sáu fixture … khớp ĐÚNG snapshot") đã hết:
    chuyển sang `ops/test/check-fixtures.test.ts`, lấy `consumes` từ `DEFINITIONS`, không khai tay.
  - Kiểm đỏ thật, đo bằng chạy thật: (a) đổi `consumes` của một xưởng thì `inputs`/`inputsHash` của output
    đổi theo, tập vàng replay đỏ ngay (`pnpm check`) — đo với `release` bỏ `topic`: snapshot `release` lệch
    ở `inputsHash`. (b) `upstreamFrom.workshops` sót lại trong fixture nay **đỏ** ở `pnpm contracts`
    (`upstreamFromWorkshopsProblems`), không còn bị bỏ qua im lặng như trước.
  - `ops/known-failures.md` hàng **Z16**: ghi phần `upstreamFrom.workshops` đã bỏ ở `I-011`.

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
- status: done
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

### I-014 · Phạm vi quét contract vẫn buộc bằng quy ước thư mục, không bằng phép kiểm

Tìm ra trong vòng soát của `I-013` (reviewer ngữ cảnh sạch, PR `#95`).

`I-013` đưa `workshops/<tên>/contracts/**/*.schema.json` vào `pnpm contracts`. Phạm vi đó dừng ở **quy ước
thư mục**: một `*.schema.json` đặt ở `workshops/<tên>/src/`, ở `packs/**`, hay bất cứ đâu khác vẫn ngoài
tầm quét, và **không gì buộc** "file mà `src/*.ts` nạp" phải nằm trong tập được quét. Hôm nay hai bên trùng
nhau vì quy ước, không vì một phép kiểm — đúng hình dạng nhóm **Z** một tầng nữa: đổi chỗ một file là phép
kiểm biến mất mà mọi chỉ báo vẫn xanh.

- deps: `I-013`
- risk: low
- status: done
- nguồn: vòng soát `I-013` (PR `#95`); `ops/known-failures.md` nhóm Z
- PR: `#99`
- tiêu chí xong:
  - ✅ Mọi `*.schema.json` dưới `workshops/` và `packs/` đều chịu phép kiểm từ khoá, dù nằm ở thư mục nào —
    việc số 7, `ops/scripts/check-schema-scope.ts`. Không dựa vào vị trí: chọn cách "kiểm mọi nơi" chứ
    không "đòi nằm trong `contracts/`", vì `packs/` là chỗ hợp lệ cho schema của pack mà không có phép quét
    `contracts/` riêng. Schema đã nằm trong `workshops/<tên>/contracts/` do việc số 6 lo, việc số 7 bỏ qua
    để không kiểm hai lần.
  - ✅ Có test tái hiện: thả một schema dùng `oneOf` (ngoài `SUPPORTED_KEYWORDS`) ở `workshops/topic/src/`
    thì `pnpm contracts` đỏ. `ops/test/check-schema-scope.test.ts` bài *nối thật* chạy chính
    `ops/scripts/check-contracts.ts` trên một gốc tạm và đọc mã thoát; đã kiểm đột biến: gỡ dòng nối ở
    `check-contracts.ts` thì bài đó **đỏ** (`not ok`). Cùng bài đối chứng với schema sạch. Thêm bài cho
    `packs/`, symlink trá hình, quét đệ quy, và ca "đã trong contracts/ thì không kiểm hai lần".

### I-015 · `deps` bị chặn bởi mục đã merge, và không lệnh nào trả lời "mục nào nhận được ngay"

Tìm ra ở lượt `crux-worker-1` ngày 2026-09-22, khi duyệt cả mười làn theo `ops/lanes/priority.md` và
**không** nhận được mục nào — đúng hình dạng mà `I-010` đã mô tả, một tầng nữa.

`I-010` đã dựng `ops/scripts/backlog-status.ts` để phân biệt mục "đã vào `main` mà còn `review`" (`stale`)
với mục cố ý giữ `review` (`held`). Nhưng nó để hở hai đầu, và chính `I-010` khai trước cả hai:

1. **Không ai gọi `--fix`.** Mục đó ghi rõ "Nối `pnpm backlog:status --fix` vào phụ lục P3 bước 2 là việc
   của lượt sau". Tới lượt này vẫn chưa nối, nên tám mục (`editorial/E-001`, `integration/I-007`, `I-011`,
   `I-013`, `I-014`, `platform/P-007`, `topic/T-001`, `verify/VF-G17`) nằm `stale` mà không gì chuyển chúng.
2. **Worker vẫn phải đọc tay từng `deps`.** Báo cáo của tool trả lời "mục nào nên chuyển `done`", không
   trả lời câu hỏi bước 3 của phụ lục P1 thật sự hỏi: *mục nào nhận được ngay*. Worker vì thế đối chiếu
   `deps` bằng mắt, đúng cái mà `I-010` gọi là "tỉ lệ tự phát hiện: 0".

Hệ quả đo được ở lượt này: `topic/T-003` (`deps: T-001`) đáng lẽ nhận được — `T-001` đã merge vào `main` —
nhưng backlog vẫn đọc `T-001` là `review`, nên cả làn `topic` (ưu tiên 3) trông như cạn việc. Cùng dạng với
`editorial/E-003` (`deps: E-001`). Lượt chạy suýt in `idle` trong khi hàng đợi **không** cạn.

Đây vẫn là nhóm lỗi **Z** (`ops/known-failures.md`): mọi chỉ báo xanh, chỉ hàng đợi việc là cạn giả.

- deps: —
- risk: low
- nguồn: `I-010` (hai phần chưa đánh dấu xong của nó); CHARTER phụ lục P1 bước 3, P3 bước 2; `ops/known-failures.md` nhóm Z
- status: review
- **cửa merge: `automerge-delayed`** — chạm `CHARTER.md` (mục phụ lục) và `CLAUDE.md`, không chạm mục 1 hay mục 3.
  Đo bằng `node ops/invariants.protected-area.ts --changed … --base-charter …`, đừng đoán.
- tiêu chí xong:
  - `ops/scripts/backlog-status.ts` đọc được `deps` của mỗi mục và trả thêm hai nhóm: `readyNow`
    (mục `status: ready` mà **mọi** `deps` đã xong) và `blocked` (mục `ready` còn chờ, kèm danh sách
    đang chờ ai). "Đã xong" tính cả mục `review` đang ở nhóm `stale` — nó đã vào `main` thật.
  - Thận trọng theo đúng hướng của `I-010`: một `deps` **không tra được** thì mục bị coi là còn chờ và
    hiện ra ở `blocked` kèm tên đoạn không tra được, **không** bị bỏ qua im lặng. Đoán sai theo hướng này
    chỉ tốn một nhịp; đoán sai theo hướng kia nhận một mục mà nền móng của nó chưa có.
  - Mã giả định dạng `G<số>` trong `deps` (ví dụ `audio/AU-001` ghi `deps: G7`) tra về mục `VF-G<số>` của
    làn `verify` — đó là quy ước đang dùng thật trong backlog, viết ra thay vì để mỗi lượt tự suy.
  - Test, gồm test âm: `deps` chưa xong thì mục **không** vào `readyNow`; `deps` là mục `stale` thì
    **có**; `deps` là mục `held` thì **không**; `deps` không tra được thì **không**; mục `parked` hay
    `review` không bao giờ vào `readyNow`.
  - CHARTER phụ lục **P3 bước 2** gọi `pnpm backlog:status --fix` — chỗ `I-010` đã chỉ định.
  - CHARTER phụ lục **P1 bước 3** đọc `readyNow` của lệnh đó thay vì đối chiếu `deps` bằng mắt, và
    **không được in `idle`** khi `readyNow` còn mục chưa có nhánh, chưa có PR.
  - **Không** đưa vào `pnpm check`: cùng lý do `I-010` đã viết — mục vừa merge còn `review` đúng một nhịp.
  - `readMainSubjects` **ném** khi kho đang ở dạng nông thay vì trả một danh sách cụt: cùng bài học
    "cấm im lặng" của `I-005`/`I-007`. Đo được ngày nhận mục — phiên cloud clone nông, `git log` đọc
    được 50 trên 86 tiêu đề, 6 mục đã `done` không thấy commit hoàn thành của mình. Hôm đó vô hại vì
    cả 6 đều `done`; một mục còn `review` rơi ngoài biên nông sẽ kéo cả nhánh phụ thuộc của nó ra khỏi
    `readyNow` mà không gì đỏ.
  - **Cùng phạm vi, khai ra chứ không để lẫn:** lệnh đo cửa merge chép trong `CLAUDE.md` mục 1 và
    CHARTER phụ lục P1 bước 7 thiếu `--base-charter`, nên nó trả `owner-merge` cho **mọi** thay đổi
    `CHARTER.md`. Cùng một hình dạng lỗi với phần trên — một chỉ dẫn "đừng đoán, chạy lệnh" mà lệnh
    được chép lại cho câu trả lời sai — nên sửa ở đây thay vì mở mục riêng. `ci.yml` và `automerge.yml`
    đều truyền tham số này.

### I-016 · `main` đỏ: hai PR xanh riêng lẻ, gộp vào nhau thì bất biến mới gặp vi phạm cũ (KF-013)

`fix`. Tìm ra ở bước 0/bước 2 của một lượt worker (`crux-worker-2`, 2026-09-22 ~10:20Z): `main` đỏ ngay
sau khi PR `#85` (`P-023`) merge lúc 10:12Z. `P-023` thêm bất biến "không file code nào neo vào một đường
dẫn log bước 0 cố định" (`ops/test/step0-log-path.test.ts`), còn `P-027` (đã merge trước đó) thêm
`ops/scripts/gate-flow.ts` với một chú thích nhắc đích danh `ops/logs/platform/P-016.jsonl`. Mỗi nhánh chỉ
mang **một** trong hai file nên CI từng PR xanh; chỉ khi cả hai vào `main` bất biến mới gặp vi phạm. Nhóm
**Z**, cùng họ với `KF-009` nhưng ở tầng nội dung thay vì `mergeable`.

- risk: low
- status: review
- hold: chặn thật lỗ hổng gốc (bất biến ở nhánh A, vi phạm ở nhánh B) còn để ngỏ — cần chạy pnpm check trên gộp thử từng cặp PR
- nguồn: lượt `crux-worker-2` 2026-09-22; `ops/known-failures.md` `KF-013`
- PR: nhánh `claude/dreamy-ride-kvztso`
- **Số hiệu I-016, không phải I-015:** `I-015` đã bị PR `#112` (`integration/readyNow`) nhận và PR đó còn mở.
- tiêu chí xong:
  - ✅ `main` xanh lại: `ops/scripts/gate-flow.ts` đổi chú thích từ tên file đích danh sang lời chung
    ("các dòng log bước 0"). Không đụng cơ chế — `gate-flow.ts` vốn KHÔNG đọc file đó, chỉ chú thích nhắc
    tên. Forward-fix một dòng, không revert `P-023`/`P-027` (cả hai đều đúng, revert làm mất cơ chế thật).
  - ✅ Có test tái hiện (bất biến I2): `ops/test/step0-log-path.test.ts` — ca âm **đích danh** `gate-flow.ts`
    thêm cạnh bất biến quét-cả-kho có sẵn của `P-023`. Đã kiểm đột biến: trả `gate-flow.ts` về bản `main`
    thì cả hai bài **đỏ** (`not ok 4`, `not ok 5`); bản sửa thì xanh. `pnpm check` 684 pass / 0 fail; tập
    vàng khớp snapshot.
  - ⬜ Chặn thật lỗ hổng gốc — "bất biến ở nhánh A, vi phạm ở nhánh B, không phép đo per-PR nào thấy trước
    merge" — vẫn để ngỏ: cần chạy `pnpm check` trên kết quả gộp thử của từng cặp PR đang mở, việc lớn hơn
    một mục fix. Ghi ở `KF-013` dòng *Máy chặn từ nay*.

### I-017 · Phép đo xung đột của bước 0 chạy trên kho **nông** nên kết luận sai (KF-015)

`fix`. `ops/scripts/conflict-watch.ts` mở đầu bằng đúng nguyên tắc cần thiết — "không tin `mergeable` của
API, đo lại bằng chạy thật". Nhưng phép đo thật đó chạy trên bất cứ kho nào bên gọi đưa cho nó, và phiên
cloud clone kho ở dạng **nông**: `git rev-parse --is-shallow-repository` trả `true`. Trên kho nông,
`git merge-tree --write-tree` không tìm được tổ tiên chung vì tổ tiên đó nằm ngoài phần lịch sử đã tải, và
`git rev-list --max-parents=0` trả commit **biên bị ghép (grafted)** chứ không phải root thật — nên cả phép
đo lẫn phép kiểm chéo đều ra kết luận ngược.

`fetchProbeRefs()` nạp `main` và đầu các PR trong một lần `git fetch`, nhưng **không** unshallow. Nó đã
nhận trách nhiệm "`main` đi cùng chuyến chứ không để bên gọi tự lo" vì đúng lý do này (một `origin/main` cũ
cho ra số trông hợp lý và sai) — độ sâu lịch sử là cùng một loại phụ thuộc, chỉ chưa được nhận.

Hai lần gặp thật, chi tiết ở `ops/known-failures.md` `KF-015`. Lần đầu nó sinh một comment báo động **sai**
trên PR `#42` yêu cầu chủ dự án force-push dựng lại nhánh hoặc đóng PR mở lại — đúng thứ CHARTER mục 1.2
muốn tránh. Lần hai (PR `#66`, lượt `13:27Z`) nó đi vào dòng log bước 0 và vào cả tiêu đề một commit trên
`main`.

- deps: —
- risk: medium
- status: done
- nguồn: lượt `crux-worker-1` 2026-09-22 ~13:40Z; `ops/known-failures.md` `KF-015`; comment `09:46:12Z` trên PR `#42` (đã nêu đúng phần còn thiếu nhưng chưa ai nhận)
- **Số hiệu I-017:** `I-015` đã bị PR `#112` nhận, `I-016` đã có mục riêng.
- tiêu chí xong:
  - `fetchProbeRefs()` tự kiểm `git rev-parse --is-shallow-repository` và unshallow **trước khi** đo. Ném
    lỗi nói rõ nếu không unshallow được, chứ không đo tiếp trên lịch sử thiếu — một phép đo sai ở đây đi
    thẳng vào bản tin và vào comment gửi chủ dự án.
  - Test tái hiện lỗi (bất biến I2, CI chặn): dựng một kho **nông** trong thư mục tạm với một nhánh gộp
    sạch, gọi `measureConflicts`. Bài kiểm phải **đỏ** trên bản `main` hiện tại (ra "xung đột" hoặc ném
    `refusing to merge unrelated histories`) và **xanh** sau bản sửa.
  - `measureConflicts()` không để một PR làm hỏng cả mẻ: hiện tại mã thoát ngoài `0`/`1` của một PR ném lỗi
    ra ngoài vòng lặp, nên một PR hỏng làm tắt phép đo của 18 PR còn lại. Trả lỗi **theo từng PR** để bên
    gọi vẫn thấy phần còn lại. Không nuốt lỗi — ca hỏng phải đọc được ở đầu ra.
  - `ops/known-failures.md` `KF-015` điền dòng *Đã sửa ở đâu* và *Máy chặn từ nay*.

### I-018 · `integrator-resolve.ts` gọi một cây hỏng cú pháp là `resolved` (KF-016)

`fix`. Điều kiện đủ để bước 0 trả `outcome: "resolved"` và push hiện chỉ là **không bên nào xoá dòng**
(đếm dòng xoá ở mỗi bên so với tổ tiên chung). Phép đếm đó đúng với ý định của nó — "gộp thuần cộng thêm
thì an toàn" — nhưng nó đo **dòng**, còn thứ phải còn nguyên là **cú pháp**.

Ca đã xảy ra thật, PR `#71` ngày 2026-09-22: hai phía cùng kết thúc một khối bằng dòng `});` giống hệt
nhau, `main` viết thêm test **sau** dòng đó. `merge=union` giữ dòng chung một lần và đặt phần thêm của
`main` vào **trước** nó, nên `});` đóng test cuối của nhánh biến mất. Không bên nào xoá dòng nào — phép
đếm không thấy gì — và tool in `{"outcome":"resolved","files":["ops/test/check-workflows.test.ts"]}`, thoát
`0`. `tsc` mới bắt được: `ops/test/check-workflows.test.ts(747,1): error TS1005: '}' expected`.

Hai lượt bước 0 trước đó gộp **cùng** cây này mà không thấy, vì `pnpm check` đỏ sớm hơn ở `lint:workflows`
nên chưa chạy tới `typecheck`. Tức lớp chặn duy nhất đang đứng giữa cây hỏng và `main` là **thứ tự các
bước trong `pnpm check`**, không phải một phép kiểm có chủ đích.

Vì sao nó đáng sửa ở cơ chế chứ không vá từng lượt: union được bật cho `ops/logs/**/*.jsonl`, nơi nó an
toàn vì JSONL không có cú pháp lồng nhau. Nhưng `integrator-resolve.ts` áp cùng phép đếm cho **mọi** file
nó gộp được, kể cả `.ts`, `.json` và `.yml` — những định dạng mà "không ai xoá dòng" không kéo theo "kết
quả còn đọc được". Chi tiết ở `ops/known-failures.md` `KF-016`.

- deps: —
- risk: medium
- status: done
- nguồn: lượt `crux-worker-1` 2026-09-22 ~16:45Z; `ops/known-failures.md` `KF-016`; `ops/logs/platform/P-010.jsonl`
- **Số hiệu I-018:** `I-015` do PR `#112` giữ, `I-016` đã merge, `I-017` do PR `#150` giữ.
- tiêu chí xong:
  - `integrator-resolve.ts` kiểm **cây gộp còn đọc được** trước khi trả `resolved`, cho những định dạng có
    cú pháp: ít nhất `.ts`/`.js` (parse), `.json` và `.yml`/`.yaml` (nạp). Không đọc được thì trả
    `aborted-ineligible` kèm `reason` nói rõ file nào và lỗi gì — **không** trả `resolved` rồi để `pnpm
    check` ở phía sau bắt, vì `check` có thể dừng ở một lỗi khác trước khi tới đó.
  - Chỉ kiểm những file **tool vừa gộp** (`files` trong kết quả), không quét cả cây: bước 0 chạy ở đầu mọi
    lượt worker, thêm một lượt quét toàn kho vào đó là thêm chi phí cho mọi lượt.
  - Test tái hiện lỗi (bất biến I2, CI chặn): dựng hai nhánh mà union sinh ra đúng hình dạng trên (cùng một
    dòng đóng khối ở cuối, một bên viết thêm sau nó), gọi tool. Bài kiểm phải **đỏ** trên bản `main` hiện
    tại (tool trả `resolved`) và **xanh** sau bản sửa (`aborted-ineligible`).
  - Phụ lục **P3 bước 0b** của `CHARTER.md` nói rõ: một cây `resolved` mà đỏ ở **lỗi cú pháp** là ca
    `aborted-ineligible`, không phải "PR đỏ" — hai ca này đi hai đường khác nhau ở lượt sau (phụ lục P1
    bước 2). Cửa merge của phần sửa CHARTER: chạy `node ops/invariants.protected-area.ts`, đừng đoán.
  - `ops/known-failures.md` `KF-016` điền dòng *Đã sửa ở đâu* và *Máy chặn từ nay*.

### I-019 · Backlog có lỗi **dữ liệu** mà không phép kiểm nào đỏ: vòng phụ thuộc, và `status` ngoài tập hợp lệ

Tìm ra trong vòng soát chéo của `I-015` (reviewer ngữ cảnh sạch, PR `#112`). `I-015` chữa chỗ worker đọc
`deps` **sai**; hai chỗ dưới đây là `deps` và `status` **viết sai trong chính backlog**, và cả hai im lặng:

1. **Vòng phụ thuộc có thật đang nằm trên `main`:** `release/R-002` ghi `deps: R-001, G6`, còn
   `verify/VF-G6` ghi `deps: R-002`. Hai mục chờ nhau vĩnh viễn. `readyQueue` xếp cả hai vào `blocked`
   và không nói gì thêm — đọc báo cáo không thấy đó là một vòng.
2. **`status` ngoài tập hợp lệ:** làn `topic` có mục ghi `status: blocked`, không thuộc
   `ready · claimed · review · done · parked` (`ops/lanes/README.md`, CHARTER 2.1). `readyQueue` xử lý
   an toàn (coi là chưa xong) nhưng `reviewFindings` cũng không in nó ra, nên mục đó biến mất khỏi mọi
   báo cáo.

Cả hai đều là nhóm **Z**: mọi chỉ báo xanh, chỉ có hàng đợi việc là sai.

- deps: I-015
- risk: low
- status: ready
- nguồn: vòng soát `I-015` (PR `#112`); `ops/lanes/README.md`; `ops/known-failures.md` nhóm Z
- **Số hiệu I-019:** mục này mở ra trong PR `#112` với số `I-016`, rồi lùi sang `I-017` (lúc `11:32Z`,
  khi `I-016` vào `main` qua PR `#132`) và sang `I-018` (lúc `14:45Z`, khi `I-017` vào `main` qua PR
  `#145`). Lần gộp `main` này mang thêm một mục `I-018` **khác** vào `main` (KF-016, cổng cú pháp của
  `integrator-resolve.ts`) — mục trên `main` đã chính danh nên giữ nguyên, mục này lùi tiếp sang
  `I-019`. Giữ nguyên nội dung và `deps`.
- tiêu chí xong:
  - `readyQueue` (hoặc một phép kiểm cạnh nó) phát hiện vòng phụ thuộc và in ra thành một nhóm riêng,
    kèm đường đi của vòng. Test dựng một vòng hai mục và một vòng ba mục.
  - Mục có `status` ngoài tập hợp lệ ra một nhóm riêng trong báo cáo, **không** bị lọc đi im lặng —
    cùng luật với nhóm `unknown` của `I-010`. Test âm: `status: blocked` phải hiện ra.
  - Hai ca dữ liệu thật ở trên được sửa trong chính PR của mục này, hoặc khai rõ vì sao giữ nguyên.

### I-020 · Dấu treo phải là một **trường**, không phải một câu văn — `HOLD_MARKERS` đã thủng hai lần

Nối tiếp `I-010`. `ops/scripts/backlog-status.ts` quyết định một mục có được lật sang `done` hay không
bằng cách dò **chuỗi con** trong thân mục (`HOLD_MARKERS`). Cách đó bắt *cách viết*, không bắt *ý*, nên
nó thủng ở đúng câu chưa ai nghĩ tới — và đã thủng **hai lần**:

- lần một, vòng soát của `I-010`: bốn mục `P-011`, `P-013`, `P-016`, `I-002`;
- lần hai, lượt `crux-worker-1` ~21:48Z 2026-09-23 (`KF-023`): ba mục `E-001`, `P-010`, `P-007`.

Cả hai lần đều chữa bằng cách **thêm chuỗi**, và cả hai lần đều chỉ vá lỗ vừa gặp. Danh sách chuỗi con
không hội tụ: câu thứ tư, viết bằng chữ khác nữa, vẫn lọt, và vẫn **không gì đỏ** — nhóm **Z**. Lần hai
đắt hơn lần một vì `E-001` là `deps` của `E-003`, `E-004`, `E-005`, nên một lần lật nhầm mở khoá cả một
nhánh việc.

- deps: —
- risk: medium
- status: review
- **Số hiệu I-020:** `I-019` do PR `#112` giữ (nhánh `claude/hopeful-dirac-ekbass`); dò trên `main` **và mọi** nhánh PR đang mở trước khi nhận mã (`KF-005`).
- nguồn: `ops/known-failures.md` `KF-023`; mục `integration/I-010`; `ops/lanes/README.md` (định nghĩa `deps`)
- tiêu chí xong:
  - ✅ Thân mục khai dấu treo bằng một **trường** mà tool đọc như đọc `- status:` và `- deps:` —
    `- hold: <lý do, một dòng>` (`HOLD_FIELD`, `holdField`). Có trường đó thì mục không bao giờ bị lật,
    bất kể thân mục viết gì — `classify` và `applyFix` (phòng thủ theo tầng) đều chặn.
  - ✅ `HOLD_MARKERS` **giữ lại** làm lớp thứ hai cho các mục chưa kịp khai trường, không gỡ. Từ nay nó là
    lưới **dự phòng**, không phải nguồn quyết định (`heldReason`: trường thắng lời văn).
  - ✅ `pnpm backlog:status` in `heldByField` và `heldByProse` — con số thứ hai là nợ phải trả dần, nay
    nhìn thấy được. Sau mục này `heldByProse` = 0 (đã khai trường cho cả nhóm).
  - ✅ Chuyển nhóm `held` sang khai bằng trường, mỗi mục một dòng `- hold:` lấy nguyên lý do đã viết trong
    thân — **35** mục (số trôi từ 33 ở `402444b`), đọc tay một lần.
  - ✅ Bài `HOLD_MARKERS: giới hạn còn lại` (nay đổi tên `… ba biến thể lần ba nay đã vào lưới dự phòng`)
    có ba `assert` **âm** đã đổi thành `true` — tiêu chí xong đo được.
  - ✅ Test, gồm test âm: mục có `- hold:` không bị lật dù thân mục sạch trơn; mục chỉ giữ bằng lời văn
    vẫn không bị lật (lớp thứ hai còn sống); mục sạch cả hai đường vẫn lật bình thường; `- hold:` viết
    hoa/thường/thụt lề lệch vẫn nhận.
  - ✅ `ops/known-failures.md` `KF-023` điền dòng *Máy chặn từ nay* bằng cơ chế mới, và gỡ phần "còn thiếu".
- **Đã làm:** `ops/scripts/backlog-status.ts` (`HOLD_FIELD`, `holdField`, `heldReason`, `classify`/`applyFix`
  phòng thủ theo tầng, output `heldByField`/`heldByProse`); `ops/test/backlog-status.test.ts` (+7 bài, ba
  `assert` âm lật thành dương); `ops/lanes/README.md` (bảng trường thêm `hold`); `KF-023` cập nhật; 35 mục
  `held` khai `- hold:`. Chính tiêu đề mục này đổi sang dùng "dấu treo" để mục — vốn nói VỀ khái niệm đó —
  không tự sa vào lưới lời văn mà nó vừa hạ xuống hàng dự phòng.
- **Bổ sung sau `#221`, lượt `crux-worker-1` 2026-09-24 (PR `#222`).** Hai worker nhận cùng mục này cách
  nhau 89 giây (`KF-025`): `#221` merge trước, `#222` kẹt xung đột. Bước 2 của phụ lục P1 nhận `#222` ở ca
  `aborted-ineligible`, gộp `main` vào và giải theo phán đoán — bản của `#221` là bản chính danh cho phần
  trùng, còn hai thứ `#222` có thêm thì giữ lại, vì cả hai đều là thứ `main` chưa có:
  - **Lưới dự phòng đổi hình dạng, không thêm chuỗi.** `HOLD_MARKERS` nay là **mẫu RegExp trên văn bản đã
    chuẩn hoá** (`normalizeForHold`: bỏ dấu nhấn Markdown, gộp khoảng trắng, hạ hoa thường) thay vì danh
    sách chuỗi con. `#221` chữa lần thứ ba bằng cách **thêm ba chuỗi** — đúng cách vá mà `CLAUDE.md` mục 13
    cấm ở lần gặp thứ hai. Chuẩn hoá làm tan cả một LỚP biến thể: `done` viết trần và `done` bọc dấu nháy
    ngược là một chữ (ca `P-007` lọt lưới chỉ vì hai dấu nháy ngược), và một câu treo bị ngắt dòng giữa hai
    chữ vẫn bắt được.
  - **Máy canh phần nợ, không chỉ in ra.** Bài `nợ lời văn của backlog THẬT phải ở 0` đọc
    `ops/lanes/**/backlog.md` thật (chỉ mục ở `review`) và đỏ **kèm tên mục** khi có mục đang bị giữ mà
    chưa khai trường. Trước bài này, gỡ một dòng khai trường khỏi backlog thật thì **0 bài đỏ** — đúng nhóm **Z** mà
    chính mục này sinh ra để giết.
  - **Bài đó bắt được một ca thật ngay lần chạy đầu:** `platform/P-034` (merge `#198`, SAU `#221`) ở `review`
    và chỉ được giữ bởi lời văn. Chữa theo đúng luật của mục này — **khai trường cho nó**, không nới bài
    kiểm — nên `heldByProse` về **0**.
  - **Phép đo hồi quy:** lưới rộng hơn **không lật thêm gì** trên dữ liệu thật. So với `main`: `held` 36/36
    giống hệt, `stale` 6/6 giống hệt, `unmerged` 2/2, `unknown` 0/0; đổi duy nhất là `P-034` chuyển từ
    `heldByProse` sang `heldByField`, tức nợ đi từ 1 về 0. Phá thử hai chỗ: gỡ bước bỏ dấu nhấn Markdown
    khỏi `normalizeForHold` → 4 bài đỏ; gỡ một dòng khai trường khỏi backlog thật → bài máy canh đỏ kèm
    đúng tên mục. Khôi phục → 30/30 xanh.

---

### I-021 · fix · Ghi `KF-026` và dọn sáu chỗ sót của vòng soát `I-020` — phần luật tách PR riêng
Vòng soát ngữ cảnh sạch (bước 6) của PR `#222` chạy **sau khi** PR đó đã merge: nhãn `automerge` gắn từ vòng
soát trước — cho một bản 16 file — sống sót qua một lần push đổi nội dung thực chất, và `automerge.yml` merge
76 giây sau push. Toàn bộ lần giải xung đột 14 file vào `main` mà **không vòng soát nào nhìn thấy nó**. Chi
tiết và mốc thời gian ở `ops/known-failures.md` `KF-026`.

Mục này gom hai phần: phần **luật** (nhãn hết hiệu lực khi `head.sha` đổi) và sáu chỗ sót mà vòng soát đó nêu
nhưng không còn PR nào để sửa vào.

- deps: —
- risk: medium — phần luật chạm `ops/workflows/automerge.yml`, vùng `owner-merge`, nên nó phải tách PR riêng
  mà chủ dự án merge. Phần dọn dẹp thì rẻ và đã làm xong trong PR của mục này.
- status: review
- hold: phần luật (`automerge.yml` so `head.sha`) chưa làm — nó chạm vùng `owner-merge` nên phải đi bằng một PR riêng
- nguồn: `KF-026`; vòng soát bước 6 của PR `#222`; CHARTER 6.4 và 3.3; `CLAUDE.md` mục 13
- tiêu chí xong:
  - ⬜ `automerge.yml` so `head.sha` lúc merge với `head.sha` tại thời điểm nhãn tự merge được gắn (đọc từ
    timeline của label event). Lệch thì **gỡ nhãn** và đòi soát lại, không merge. Áp cho **cả** `automerge`
    lẫn `automerge-delayed` — cửa `open` là cửa thiếu cơ chế này, nhưng viết một luật cho cả hai thì không
    có cửa nào tụt lại.
  - ⬜ Test cho hàm quyết định đó, tách khỏi YAML như `ops/scripts/alert-escalation.ts` đã làm.
  - ⬜ CHARTER 6.4 nói rõ vòng soát gắn với **một phiên bản**, không với một PR.
  - ⬜ `ops/workflows/watchdog.yml` dấu hiệu 5 **kẹp sàn `AGE_MIN`**. Hiện nó tính
    `AGE_MIN=$(( (NOW - LAST_BEAT) / 60 ))` rồi hỏi `-gt 180`, **không kẹp sàn** — nên một mốc bước 0 ở
    tương lai cho `AGE_MIN` âm, phép so sai, và dấu hiệu 5 của CHARTER 2.4 **im vĩnh viễn**. Cùng hình dạng
    Z với `S2`, ở nhánh sát bên. Tách khỏi PR này vì `ops/workflows/**` kéo cửa sang `automerge-delayed`,
    trong khi phần còn lại của mục ở cửa `open`; bài kiểm phía TS đã phủ dữ liệu (xem `S2`), còn đây là
    phần bash.
  - ✅ **Máy canh mốc `at` ở tương lai trên log THẬT** (`S2`) — phủ **cả** dòng thường **và** dòng bước 0. Bài `Z7 · trên ops/logs thật: KHÔNG làn nào ra
    future`. Đo được chỗ thủng: lượt `crux-worker-1` ghi tay `at: 07:05:00.000Z` vào commit tạo lúc `06:51:27Z`,
    nên trong ~14 phút làn `integration` ra `{"verdict":"future","hoursSinceLastBeat":-0.1}` — số âm nhỏ hơn
    mọi ngưỡng, tức làn đó **không bao giờ `stale` được**, mà `pnpm check` vẫn xanh (nhóm **Z**). Bài cũ chỉ
    khoá *hàm* trên log dựng; bài mới khoá *dữ liệu thật*. Phá thử: đặt một mốc tương lai vào log thật →
    `not ok 22`; khôi phục → 22/22 xanh.
    **Phạm vi đã sửa sau vòng soát:** bản đầu chỉ khẳng định trên `laneHeartbeats`, mà hàm đó cố ý **loại**
    dòng bước 0 (luật thiết kế 1) — nên tiêu chí này lúc đầu khai phạm vi **rộng hơn phạm vi thật**, đúng lỗi
    `S6` mà chính mục này đang sửa ở chỗ khác. Đo được: đặt mốc tương lai vào dòng bước 0 → **22/22 vẫn
    xanh**. Nay bài có thêm một phép khẳng định chạy thẳng trên các dòng bước 0, dùng
    `FUTURE_TOLERANCE_HOURS` làm dung sai; phá thử lại → `not ok 22`.
    **Đường thoát khi một mốc tương lai ĐÃ vào `main`** (khai vì nó cắn `D-C04`): thêm một dòng đính chính
    **không** chữa được — `laneHeartbeats` lấy `max` theo làn, nên `pnpm check` (cổng cứng) đỏ cho **mọi** PR
    tới khi thời gian thật vượt qua mốc đó. Cách chữa duy nhất là sửa hoặc xoá dòng, tức phá append-only. Nên
    luật thật của chỗ này là **ghi `at` bằng đồng hồ thật ngay từ đầu**; dung sai một phút là ngân sách lệch
    đồng hồ **giữa hai máy** (phiên agent ghi, runner GitHub khẳng định), không phải chỗ để nới.
  - ✅ **Gỡ mẫu chết** (`S4`): `/không đóng khi pr merge/u` bị `/(?:không|chưa|chỉ) đóng/u` bao trọn
    (`.test('không đóng khi pr merge')` → `true`), và gỡ nó làm **0** bài đỏ — không bài nào ghim nó. Lưới đi
    từ 8 mẫu xuống **7**, ca gốc vẫn bắt được. Một mẫu không ai canh là chỗ lần sau có người sửa mà không
    biết mình sửa gì. Vòng soát đo thêm một bậc và kết quả mạnh hơn mức mục dám khai: gỡ **từng** mẫu một
    trong tám mẫu cũ thì mẫu bị gỡ ở đây là mẫu **DUY NHẤT** không bài nào ghim (7 mẫu kia đều làm ít nhất
    một bài đỏ). Sau khi gỡ, **cả 7 mẫu còn lại đều có bài ghim** — tức "không mẫu chết" nay là một tính
    chất đo được của cả lưới, không chỉ một nhận xét về một mẫu.
  - ✅ **`KF-023` không còn nói sai hiện trạng** (`S5`): dòng mô tả lưới của `#221` ghi rõ nó là mô tả **đã bị
    `#222` thay**, thay vì để hai mô tả trái nhau cùng ở thể hiện tại cạnh nhau.
  - ✅ **Chú thích bài máy canh khai đúng phạm vi của chính nó** (`S6`): nó viết "cùng phạm vi
    `reviewFindings`", thực ra không — `reviewFindings` lọc `status === 'review' || statusLine === null`, bài
    test bỏ vế thứ hai. Hiện vô hại (`classify` trả `unknown` cho `statusLine === null` nên mục đó không vào
    nhóm `held`, và `applyFix` cũng đòi `statusLine !== null`), nhưng trong một mục có luận điểm là "khai ra
    phạm vi thật" thì câu sai đó đáng một dòng sửa.
  - ✅ **Hai dòng log đính chính** (`S1`, `S3`), append chứ không sửa dòng cũ (`D-C04`): số file của `#222` là
    **8** chứ không phải 7 (dòng cũ ghi 7 vì cửa merge được đo **trước khi** hai dòng log của chính lượt đó
    được ghi; kết luận cửa **không đổi** — chạy lại với đủ 8 đường dẫn vẫn `{"gate":"open"}`), và `costUsd`
    của hai dòng mới là **ước lượng**, không phải số đo — ba dòng trước trong cùng file ghi `0` kèm lý do
    "phiên routine không đọc được chi phí thật của chính nó", và hai dòng mới đã đổi ngầm quy ước đó mà không
    nói ra.
- **vì sao còn `review`:** ba tiêu chí ⬜ đầu là phần luật, chạm `ops/workflows/automerge.yml` — vùng
  `owner-merge`. Gộp chúng vào PR này sẽ kéo cả PR sang cửa `owner-merge` và bắt chủ dự án merge tay một PR
  mà phần lớn nội dung máy tự merge được — ngược thước đo CHARTER 1.3. Tách đúng như `P-034`/`P-037` đã tách.
- **mã mục nhận lúc 2026-09-24 ~07:1x giờ UTC** (`KF-005`): dò `### I-` trên `main` **và trên đầu cả 8 PR
  đang mở** (`refs/pull/N/head`), không chỉ vài nhánh nhớ được. Cao nhất trên `main` là `I-020`; `I-019` do PR
  `#112` giữ — nên `I-021` không đụng ai.
