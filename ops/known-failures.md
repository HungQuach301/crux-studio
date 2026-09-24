# 🤖 Sổ lỗi đã gặp

**Luật (CHARTER 6.6):** lỗi cùng loại xuất hiện **lần thứ hai** thì sửa **spec, contract hoặc prompt** — không vá sản phẩm. Vá sản phẩm lần thứ hai nghĩa là lần thứ ba đang tới.

Mỗi mục ghi: chữ ký lỗi, đã gặp mấy lần, nguyên nhân gốc, chỗ đã sửa, và cách máy chặn nó từ nay.

---

## KF-025 · Hai worker nhận cùng một mục backlog trong 89 giây, và không chỉ báo nào đỏ

> Số **KF-025**: dò `## KF-` trên `main` **và trên đầu cả 7 PR đang mở** trước khi viết (`KF-005`). Cao nhất là `KF-024`, nên `KF-025` không đụng ai.

**Chữ ký lỗi:** hai PR mang cùng một mã mục trong tiêu đề, sống chồng nhau; PR ra đời trước merge, PR ra đời sau kẹt xung đột vĩnh viễn với `main` vì mục của nó đã nằm trên `main` rồi.

**Đã gặp:** **2 lần**, cả hai đo được, cả hai trong ngày 2026-09-24.

| Lần | Mục | PR | Tạo lúc | Cách nhau | Kết cục |
|---|---|---|---|---|---|
| 1 | `integration/I-020` | [#221](https://github.com/HungQuach301/crux-studio/pull/221) `crux-worker-2` | 03:40:00Z | — | merge 03:44:45Z |
| 1 | `integration/I-020` | [#222](https://github.com/HungQuach301/crux-studio/pull/222) `crux-worker-1` | 03:41:29Z | **1,48 phút** | còn mở, `aborted-ineligible` ở mọi lượt bước 0 kể từ đó |
| 2 | `platform/P-040` | [#224](https://github.com/HungQuach301/crux-studio/pull/224) | 05:41:17Z | — | còn mở |
| 2 | `platform/P-040` | [#225](https://github.com/HungQuach301/crux-studio/pull/225) | 05:51:02Z | **9,75 phút** | đổi mã sang `P-041` trước khi bỏ nháp |

Lần thứ hai là **chính lượt viết ra mục sửa lỗi này**: phép dò mã mục chạy lúc 05:40Z, `#224` ra đời 05:41:17Z — **77 giây sau**. Hai PR gộp **sạch** vào nhau, nên nếu cả hai vào `main` thì `main` mang hai mục `### P-040` cộng một file log trộn hai việc (`ops/logs/**/*.jsonl` khai `merge=union`), mà không gì đỏ.

Lần thứ hai cũng là lần đầu tiên một chỗ hỏng nhóm Z của repo này **tự bắt được chính nó**: bộ dò dưới đây, chạy ở vòng soát ngữ cảnh sạch (phụ lục P1 bước 6), nêu ra va chạm trước khi PR bỏ nháp. Sổ nhóm Z tới trước hôm nay ghi tỉ lệ tự phát hiện **0/3**; đây là ca đầu khác 0. Nó cũng là bằng chứng chạy thật rằng phép hỏi **lại** ở bước 4 — chứ không chỉ ở bước 3 — là phần bắt buộc.

**Nguyên nhân gốc.** Phụ lục P1 bước 3 hỏi *"chưa có nhánh `claude/<lane>/<id>` và chưa có PR mở"* **đúng một lần**, lúc lượt chạy bắt đầu duyệt backlog. Giữa mốc đó và lúc push commit đầu tiên là cả một giờ làm việc, và không cổng nào hỏi lại. Hai worker chạy chồng nhau (cấu hình 3 worker, `VF-G1`) thì cửa sổ ấy đủ rộng.

Hai tín hiệu nhận việc đang có đều không bắt được:

- **Tên nhánh đã chết.** Phiên cloud được nền tảng gán nhánh ngẫu nhiên (`claude/dreamy-ride-oh9k8r`), nên `laneFromBranch` trả `null` cho **5 trên 7** PR đang mở lúc ghi mục này. Một bộ dò neo vào tên nhánh im lặng đúng ở những PR nó cần bắt nhất.
- **Trạng thái `claimed` chưa bao giờ tồn tại thật.** `ops/lanes/README.md` có nó trong bảng và dặn *"Nhận xong đổi thành `claimed` ngay trong PR nháp"*, nhưng CHARTER phụ lục P1 bước 4 không nhắc tới, chưa lượt nào ghi, và không phép kiểm nào đọc. Một trạng thái không ai ghi và không ai đọc là một luật không tồn tại.

**Vì sao nó là nhóm Z.** Cả hai PR đều xanh: CI xanh, `pnpm check` xanh, nhãn đúng, `pickPrToHandle` không thấy gì bất thường. Chỗ hỏng chỉ lộ ra ở chỗ không ai nhìn — một lượt worker (giả định **G3**, trần số lần chạy mỗi ngày) đã tiêu, và hàng đợi merge nhận thêm một PR không bao giờ gỡ được. Đúng công thức: **một thứ ở ngoài đếm và so**, không phải một thứ ở trong tự khai.

**Máy chặn từ nay** (mục `platform/P-041`):

- `ops/scripts/claim-collision.ts` đọc chữ ký nhận việc từ **tiêu đề PR** (`[<lane>] <id> — …`), cùng hình dạng mà `hasCompletionCommit` đã đọc — không đọc tên nhánh.
- `claimCheck(prs, lane, id, now)` trả `open-pr` · `recently-merged` · `free`. Phụ lục P1 bước 3 và bước 4 gọi nó, và gọi **lại ngay trước khi push commit đầu tiên**: khoảng trống giữa hai mốc đó chính là 89 giây trên.
- `duplicateClaims(prs)` bắt mọi cặp PR cùng mục có **thời gian sống chồng nhau**, tính cả PR đã merge — ca `#221`/`#222` cho thấy phép dò chỉ nhìn PR đang mở sẽ tắt tiếng đúng vào lúc chỗ hỏng thành vĩnh viễn.
- Phân biệt với **sóng nối tiếp** (`P-014`: `#62`, `#196`, `#223`) bằng thời gian sống, không bằng mã mục. Một bộ dò kêu sai vài lần là một bộ dò bị tắt.
- **Tiền tố `🤖`** của `CLAUDE.md` mục 5 được bỏ qua khi đọc tiêu đề. 29 commit trên `main` mang nó, trong đó `🤖 [platform] P-038 — …` (#212) là một PR nhận mục **thật**: neo cứng vào `[` làm `claimCheck` trả `free` cho một mục đang có người giữ, tức fail-open ở đúng chỗ luật này chữa.
- **Đầu vào thiếu hay hỏng thì ném, không trả `free`** — tên làn ngoài `LANES`, `now` không đọc được, `PrSnapshot` thiếu `closedAt`/`isDraft`/`updatedAt`. Cả ba trước đây cho `free` im lặng và exit 0; nay CLI in `⚠ KHÔNG TRẢ LỜI ĐƯỢC` và thoát 2. "Không trả lời được" khác "không ai giữ mục này", và phải khác cả ở mã thoát (`Z15`).
- **Ngoại lệ PR nháp bỏ quá 24 giờ** (`CLAUDE.md` mục 2) không bị luật mới nuốt: verdict `abandoned-draft`. Thiếu nó thì `#222` khoá `integration/I-020` vĩnh viễn, và luật mới nói ngược luật cũ đứng ngay trên nó.
- `ops/test/claim-collision.test.ts`, **29 bài**, mở đầu bằng bốn bài tái hiện đúng mốc thật của `#221`/`#222` và `#224`/`#225` (bất biến I2). Chạy thật trên ảnh chụp PR thật: đúng **2** va chạm, cả hai thật, **0** báo giả trên hai sóng của `platform/P-014`.

**Còn thiếu, khai ra:** va chạm chưa nổi lên bản tin ngày (`digest-metrics.ts` đang bị `#223` sửa, để PR sau nối), và mâu thuẫn `claimed` giữa `ops/lanes/README.md` và phụ lục P1 bước 4 vẫn còn nguyên.

---

## KF-024 · Cổng merge đọc một lần chạy `ci.yml` **đã bị huỷ** thành phán quyết của cây mã, nên PR xanh nằm im vĩnh viễn

> Số **KF-024**: dò `## KF-` trên `main` **và trên đầu cả 12 PR đang mở** trước khi viết (`KF-005`). Cao nhất là `KF-023`, nên `KF-024` không đụng ai.

- **Lần gặp:** 1 — bản ghi đầu tiên. Phát hiện ở lượt `crux-worker-1` ~01:4xZ ngày 2026-09-24, khi soát vì sao hai PR mang nhãn `automerge` với CI xanh vẫn không được merge.
- **Chữ ký:** `automerge.yml` in `skip — CI chưa xanh (\`cancelled\`)` cho một PR mà **mọi** check run trên đúng đầu nhánh ấy đều `success`. Không gì đỏ: CI của PR xanh, `main` xanh, job `automerge` xanh, nhãn đúng, không ai comment `dừng`. Nhóm **Z** thuần, và nó khoá hàng đợi merge chứ không chỉ làm chậm.
- **Đo được (2026-09-24 01:31Z, lượt automerge `35943304619`):**

  | PR | nhãn | cửa tính lại | check run trên đầu nhánh | kết luận của cổng | kẹt |
  |---|---|---|---|---|---|
  | `#194` | `automerge` | `open` | 12/12 `success` | `skip — CI chưa xanh (cancelled)` | ~11 giờ |
  | `#208` | `automerge` | `open` | 12/12 `success` | `skip — CI chưa xanh (cancelled)` | ~3 giờ |

- **Nguyên nhân gốc:** câu hỏi API của cổng là
  `actions/workflows/ci.yml/runs?head_sha=$HEAD&status=completed&per_page=1` rồi lấy `.workflow_runs[0]`. Danh sách ấy xếp theo `created_at` **giảm dần**, không theo "lần chạy nào có thẩm quyền". `ci.yml` có `concurrency` huỷ lần chạy cũ, nên một SHA có nhiều lần chạy `completed`, và **hai lần chạy trùng `created_at` tới từng giây**. Ba lần chạy thật trên `head_sha` `ed56e10f` của `#194`:

  | run | `created_at` | `run_number` | kết luận |
  |---|---|---|---|
  | `35875888124` | `14:40:17Z` | 609 | `cancelled` |
  | `35875939060` | `14:40:41Z` | 610 | `cancelled` |
  | `35875939096` | `14:40:41Z` | 611 | `success` |

  `per_page=1` trả `35875939060`. `created_at` không bao giờ đổi, nên chỗ kẹt là **vĩnh viễn**, không phải chậm một nhịp — chỉ một commit mới lên nhánh mới gỡ được, mà không có lý do gì để ai push thêm vào một PR đã xong.

- **Vì sao không lớp nào bắt được:** lần chạy `35875939060` bị huỷ 7 giây sau khi tạo, **trước khi có job nào**, nên nó không sinh check run. Checks API — thứ mà mắt người, giao diện PR và job `fix-has-test` đọc — không thấy nó. Cổng đọc Runs API. Hai lớp nhìn hai nguồn khác nhau và không bên nào sai theo nguồn của mình.
- **Đã sửa ở:** `ops/scripts/pick-ci-run.ts` (`pickCiRun`) giữ luật chọn ở một chỗ thuần và có test; `ops/workflows/automerge.yml` hỏi `per_page=100` rồi đi qua hàm đó.
- **Vòng soát ngữ cảnh sạch tìm ra một chỗ bản sửa tự mở, đã sửa trong cùng PR:** lời gọi mới đặt ở **vị trí tham số** của `jq -n` (`--argjson ci "$( … )"`), mà `set -euo pipefail` **không** thấy mã lỗi của một pipeline ở vị trí đó — đo được: `( set -euo pipefail; true "$(exit 9)"; echo SAU )` in `SAU` và thoát `0`, còn phép gán `X=$(exit 9)` thoát `9`. Cộng với việc `pick-ci-run.ts` lúc đầu chuẩn hoá stdin rỗng thành `{}`, một lần `gh` chết ở đây sẽ thành `skip — CI chưa xanh (chưa có lần chạy nào)` với bước **vẫn xanh**. Trước bản sửa, ca ấy làm `jq` chết và bước ĐỎ (chữ ký `KF-017`). Tức bản sửa suýt đổi một cổng từ ồn ào sang im lặng — đúng nhóm **Z** mà chính nó tồn tại để chặn. Nay lời gọi là phép gán `CI_RUN=$( … )`, và stdin rỗng làm script thoát `2` kèm stderr.
- **Máy chặn từ nay:** `ops/test/pick-ci-run.test.ts` — 12 bài. Bài đầu dựng lại **nguyên** ba lần chạy thật của `#194` và đòi chọn lần `success`; một bài đối chứng khoá rằng dữ liệu ấy thật sự bẫy được cách đọc cũ; một bài đọc chính `ops/workflows/automerge.yml` và bắt lỗi nếu chỗ gọi quay về `per_page=1` hoặc thôi gọi `pick-ci-run.ts` (khoá chiều lệch YAML ↔ TS, cùng cách `ops/test/required-checks.test.ts` làm với ruleset); và một bài khoá chiều ngược — một lần `failure` mới hơn một lần `success` vẫn thắng, nên bản sửa **không** nuốt đỏ.

---

## KF-020 · Bản sửa một `main` đỏ **tự nó** nằm trong vùng bảo vệ, nên `main` không thể xanh lại dưới 12 giờ

> Số **KF-020**: dò `## KF-` trên `main` **và trên mọi nhánh PR đang mở** trước khi viết, đúng cách `KF-018` chỉ (`KF-005`). Trên `main` cao nhất là `KF-018` (`#166`, đã merge ở `fc24f75`; `KF-017` của `#162` cũng đã vào `main` ở `d36d424`). Còn mở chỉ có `KF-019`, thuộc PR `#167`.
>
> ⚠️ Bản đầu của dòng này viết *"`KF-018` thuộc `#166`, `KF-017` thuộc `#162` — cả ba đang mở"*, chép nguyên khung câu của `KF-018` mà **không đo lại**: hai PR ấy đã merge từ trước lúc viết. Đúng chữ ký mà `KF-005` cảnh báo, và lần này nó trúng ngay mục đang cảnh báo về nó. Việc cấp mã `KF-020` không sai, chỉ phần diễn giải sai.

- **Lần gặp:** 2 — lượt `crux-worker-1` ~23:38Z (PR `#120`) rồi lượt `crux-worker-1` ~00:40Z ngày 2026-09-23, khi **cùng một chữ ký** chặn **cả 6** PR xung đột của bước 0.

  > ⚠️ **Lần gặp thứ nhất là suy lại từ hoàn cảnh, không phải từ một bản ghi.** `KF-019` (trên nhánh của `#167`) ghi một **chữ ký khác** — workflow vào `main` mà `node --test` không soi — và **không một chữ nào** về cửa merge hay vùng bảo vệ. Nói ra để lượt sau không tưởng có hai bản ghi cùng chữ ký này; mục này là bản ghi **đầu tiên** của nó. Điều đó không làm sai hành động: chữ ký đã chặn việc hai lượt liên tiếp, nên CHARTER 6.6 (sửa cơ chế ở lần thứ hai) vẫn áp đúng. Lần thứ hai là lúc luật `CHARTER 6.6` đòi sửa **cơ chế**, không vá sản phẩm — nên mục này ghi cái mà `KF-019` không ghi: không phải `spike-canvas.yml` sai, mà **đường về xanh bị khoá sau một cửa 12 giờ**.
- **Chữ ký:** một worker gỡ xong xung đột của một PR, `tsc --noEmit` sạch và test của chính PR đó xanh, nhưng `pnpm check` vẫn `EXIT=1` ở những cổng mà **cây sạch của `origin/main` cũng đỏ y hệt**. Theo phụ lục P3 bước 0b, worker phải `git merge --abort` và **không push** — đúng luật, và không tiến được bước nào. Lặp lại ở mọi PR, mọi lượt, cho tới khi `main` xanh.
- **Đo, không suy (2026-09-23 ~00:40Z, `origin/main = ecd0085`):**

  | Cổng | Kết quả trên cây sạch `origin/main` |
  |---|---|
  | `pnpm lint:workflows` | **EXIT=1** — `spike-canvas.yml:47/:69/:84` thiếu `set -euo pipefail` (Z10), `:63` nuốt lỗi không chú thích (Z9) |
  | `pnpm check:tests` | **EXIT=1** — `spike/canvas/test/camera.test.ts` ngoài glob (Z11); 53 file trên đĩa / 52 trong glob |
  | `pnpm test` | **790 pass / 3 fail** — bài 135, 183, 196 |

  Cả ba do `7dfdfeb` (PR `#42`, mục `visual/V-002`) vào `main` lúc `23:05:06Z`. Hệ quả đo được ở bước 0 cùng lượt: **6 / 16 PR đang mở** xung đột (`#120` `#39` `#84` `#89` `#160` `#112`), `integrator-resolve.ts` trả `aborted-ineligible` cho **cả 6**, **0 giải, 0 push**.

- **Nguyên nhân gốc — và đây mới là phần tái dùng được:** bản sửa duy nhất, PR `#167`, **CI xanh 5/5 từ `00:03Z`**, nhưng cửa merge của nó không phải `open`. Chạy chứ đừng đọc bảng bằng mắt:

  ```
  $ node ops/invariants.protected-area.ts --changed /tmp/changed167.txt --head .
  {"gate":"automerge-delayed","owner":[],
   "delayed":["`ops/workflows/spike-canvas.yml` — workflow không dùng secret, không phát hành"]}
  ```

  Vùng bảo vệ mức `automerge-delayed` (CHARTER mục 3, `D-C06`) phủ **`ops/workflows/**`**. Mà một `main` đỏ vì một workflow thì **mọi** bản sửa của nó — sửa tại chỗ như `#167`, hay revert `#42` — đều chạm đúng thư mục ấy. Vậy cửa 12 giờ áp cho chính thứ đáng lẽ phải đi nhanh nhất.

- **Vì sao nó đắt hơn vẻ ngoài — và chỗ mâu thuẫn cụ thể nhất không phải chữ "ngay":** `CLAUDE.md` mục 13 viết *"`main` đỏ thì revert ngay"*, và CHARTER **6.5** (`CHARTER.md:369`) viết *"Main đỏ được revert ngay"*. Nhưng bằng chứng sắc hơn nằm ở phụ lục **P3 bước 1** (`CHARTER.md:825–827`), chỗ CHARTER **ghi cứng cái nhãn**:

  > *mở PR revert (**nhãn automerge**, nhánh `claude/integration/revert-<sha>`)*

  Tức CHARTER bảo dán `automerge` lên đúng loại PR mà `ops/invariants.protected-area.ts` tính ra `automerge-delayed` — đã đo: chạy tool trên danh sách file của `7dfdfeb` (một bản revert `#42`) cũng ra `automerge-delayed`. Không phải hai cách diễn đạt lệch nhau, mà là **hai luật cho ra hai nhãn khác nhau trên cùng một PR**. Và cho tới khi `#167` merge thì: không PR xung đột nào gỡ được, và **mọi** PR đang mở đỏ ở lượt CI kế tiếp vì CI dựng `refs/pull/N/merge`. 16 PR đứng vì một cửa thiết kế cho chuyện khác. (**Dự kiến, không phải số đo:** đồng hồ 12 giờ chạy từ lúc **CI xanh trên đầu nhánh**, không phải từ lúc `main` đỏ — CHARTER 3.3, `CHARTER.md:263`. `#167` xanh lúc `00:03Z` nên mốc tự merge là ~`12:03Z`, với điều kiện nó giữ CI xanh, không ai comment `dừng`, và không có push mới đặt lại đồng hồ.) Không gì đỏ **lúc này** ngoài `main` — đúng nhóm **Z**: mỗi luật riêng lẻ đều đúng, chỗ thủng nằm ở chỗ hai luật gặp nhau.

  **Đo trên chính PR ghi mục này (`#168`), nên phần "mọi PR đang mở sẽ đỏ" không còn là suy luận.** `#168` chỉ thêm tài liệu và hai file log — không chạm một dòng code nào. CI của nó vẫn **đỏ**:

  ```
  HEAD is now at 10ff9d0 Merge 5152ceb… into ecd0085…
  > pnpm contracts   → Contract ok
  > pnpm lint:deps   → I3 ok
  > pnpm lint:workflows
  Workflow có vấn đề:
    - spike-canvas.yml:47/:69/:84 … (Z10)
    - spike-canvas.yml:63 … (Z9)
  ##[error]Process completed with exit code 1
  ```

  Hai điều dòng log này chốt lại: (1) `actions/checkout@v7` trong `ops/workflows/ci.yml` **dựng `refs/pull/<N>/merge`**, tức mọi PR chạy `pnpm check` trên cây *đã gộp `main`*, nên `main` đỏ là **mọi** PR đỏ — trước đây chỉ suy từ tài liệu, nay có dòng `Merge … into ecd0085` làm bằng; (2) bốn dòng làm `#168` đỏ **không có dòng nào** thuộc diff của `#168`. Bốn check còn lại (`protected-area`, `fix-has-test`, `secret-scan`, `trailer-warn`) đều **success**.
- **Vì sao lượt này không tự sửa:** nới cửa merge cho một loại PR là **đổi CHARTER mục 3** — `irreversible` nhóm 4 của CHARTER 2.3. Agent không tự làm, kể cả khi khuyến nghị rõ ràng. Đã mở `🤖 [QĐ] #169`; mục `platform/P-032` nhận việc và đứng `blocked` tới khi có câu trả lời.
- **Đã sửa ở đâu:** *chưa sửa cơ chế.* `#167` gỡ **lần này** (đúng và cần), nhưng không đụng tới cái làm lần sau lặp lại.
- **Đã sửa cơ chế ngày 2026-09-23** (`D-C07`, câu trả lời `#169 A` lúc `01:19:54Z`): cửa `automerge-delayed` có **lối đi nhanh `hotfix`**, bỏ khoảng chờ 12 giờ cho đúng ca này. Sáu điều kiện là phép kiểm máy ở `ops/invariants.hotfix-lane.ts`, không phải lời dặn; phạm vi sự cố do `ops/scripts/main-red-scope.ts` dựng ở dạng máy đọc trong thân issue cảnh báo.
- **Máy chặn từ nay:** `ops/test/invariants-hotfix-lane.test.ts` (14 bài) và 9 test âm ở `ops/test/invariants-merge-gate.test.ts` — lối nhanh KHÔNG bỏ CI đỏ, không bỏ `fix-has-test`, không thắng lời `dừng`, không mở được cửa `owner-merge`, và không áp cho `automerge.yml`/`ops/invariants.*`/`.github/**`. Cộng thêm dòng luật cũ vẫn giữ nguyên giá trị: **một PR mà tiêu chí xong của nó là "đưa `main` từ đỏ về xanh" phải được kiểm cửa merge ngay lúc nhận việc, không phải lúc gắn nhãn** — nay câu trả lời của phép kiểm đó nói thêm được một chuyện: PR này đi lối nhanh được hay không.
- **⚠️ Chỗ chưa che:** bản sửa vừa sửa chỗ hỏng vừa SIẾT thêm luật (đúng hình dạng `#167`) ra `needs-decision`, tức vẫn chờ 12 giờ. Cách đi đúng: tách hai PR. Xem `docs/decisions/D-C07.md`.

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

## KF-003 · Khối `permissions` thiếu một quyền, và lỗi hiện ra dưới dạng 404 "repo không tồn tại"

- **Lần gặp:** 1 lỗi thật đã chạy, cộng **1 chỗ nữa cùng loại** tìm ra khi rà cả bộ. Ghi ngay từ lần đầu vì chữ ký lỗi của nó **nói dối**: nó trông như lỗi cấu hình repo, không giống lỗi quyền.
- **Chữ ký:**
  ```
  remote: Repository not found.
  fatal: repository 'https://github.com/<owner>/<repo>/' not found
  The process '/usr/bin/git' failed with exit code 128
  ```
  ở bước `actions/checkout`, **mặc dù** log ngay phía trên đó cho thấy auth đã được cài (`git config --local http.https://github.com/.extraheader AUTHORIZATION: basic ***`).
- **Nguyên nhân gốc:** khi một workflow khai khối `permissions`, mọi quyền **không** được liệt kê bị đặt thành `none` — kể cả `contents`. `labels.yml` chỉ khai `issues: write`, nên `GITHUB_TOKEN` của nó có `contents: none`. Với repo **private**, GitHub trả **404** thay vì 403 cho một token không có quyền đọc, để không lộ việc repo có tồn tại hay không. Vì vậy thông báo lỗi chỉ sai hướng: nó nói "không tìm thấy repo", còn sự thật là "không được phép đọc repo".

  Trên repo **public** lỗi này không xảy ra, nên nó không lộ ra ở bất kỳ ví dụ nào chép từ mạng.
- **Bằng chứng:** `labels` run #1, commit `32ba4cd`, ngày 2026-09-20. Ba lần thử lại của `actions/checkout` đều cho cùng một kết quả — không phải trục trặc mạng.
- **Đã khép vòng:** sau khi PR #7 merge, `labels` **run #2** trên commit `218fe70` kết thúc `success` — chính bài kiểm mà run #1 đã trượt. Đó là bằng chứng chạy thật; `pnpm lint:workflows` chỉ là bằng chứng ở chỗ rẻ.
- **Đã sửa ở đâu:** hai workflow. Rà cả bộ tìm ra một chỗ nữa **chưa từng chạy** nên chưa lộ:

  | Workflow | Thiếu | Thao tác cần nó |
  |---|---|---|
  | `labels.yml` | `contents: read` | `actions/checkout` |
  | `watchdog.yml` | `pull-requests: read` | `gh pr list` ở dấu hiệu "48 giờ không merge" |

  Chỗ thứ hai đáng chú ý vì nó **không** phải lỗi checkout: **đọc pull request cần `pull-requests: read`**, và quyền đó **không** nằm trong `contents: read`. Nếu không sửa, người canh sẽ im lặng không bao giờ báo được dấu hiệu thứ hai — đúng kiểu hỏng mà rủi ro **B7** nói tới.

### Một nghi ngờ thứ ba, đã bị chính lần chạy thật bác bỏ

Khi rà, tôi kết luận `ci.yml` cũng thiếu `issues: write` cho bước `gh label create`, với lý do "nhãn của repo nằm dưới quyền Issues, còn `pull-requests: write` chỉ đủ để gắn nhãn đã có lên PR". **Lý do đó sai.**

Bằng chứng, `ci` run #1 trên PR #7, ngày 2026-09-20: job `protected-area` chạy với đúng `contents: read` + `pull-requests: write`, **không có quyền `issues` nào**, và bước "Bảo đảm nhãn CI dùng đã tồn tại" kết thúc `success`. Hai nhãn `automerge` và `cross-lane` trước đó **chưa tồn tại** và sau lần chạy đó đã có mặt, đúng màu và đúng mô tả trong `ops/labels.json` — nghĩa là chúng được **tạo mới**, không phải được cập nhật.

Kết luận đúng: **endpoint nhãn của repo nằm dưới CẢ HAI scope** `issues` và `pull-requests`. Thêm `issues: write` vào `ci.yml` là khai thừa quyền, nên thay đổi đó đã được hoàn tác, và luật trong linter nhận **một trong hai** thay vì ép một scope.

Đây đúng là lý do CHARTER 11.1 luật 3 tồn tại: *kiểm bằng chạy thật, không bằng đọc tài liệu*. Suy luận nghe hợp lý, khớp với cách GitHub đặt tên scope, và vẫn sai.
- **Máy chặn từ nay:** `pnpm lint:workflows` có thêm bảng **thao tác → quyền tối thiểu** (`PERMISSION_RULES` trong `ops/scripts/check-workflows.ts`). Workflow nào khai `permissions` mà thiếu quyền cho một thao tác nó thật sự dùng thì linter đỏ, kèm lý do. `write` bao hàm `read`; workflow **không** khai `permissions` thì luật im lặng, vì đó là một lựa chọn khác chứ không phải lỗi.

  Một luật có thể nhận **nhiều quyền thay thế**: thoả một trong số đó là đủ. Nếu không, luật sẽ ép workflow khai thừa — đúng cái bẫy đã sập ở đoạn trên.

  Test ở `ops/test/check-workflows.test.ts` — 14 test: bốn **âm** (hai trong số đó tái hiện đúng hai workflow đã sai, bằng đúng nội dung đã làm chúng sai), và phần còn lại chống đỏ nhầm, trong đó có một test khoá `ci.yml` lại ở trạng thái **không** khai `issues`.

### Vì sao lỗi này đặc biệt đắt ở dự án này

Ba lớp cộng lại làm nó khó thấy:

1. Workflow trong `ops/workflows/` **chỉ chạy sau khi merge vào `main`** và `sync-workflows` chép sang `.github/workflows/`. Không có cách nào thử nó trên nhánh PR.
2. Chữ ký lỗi chỉ sai hướng — người đọc đi kiểm tên repo, quyền của PAT, và cấu hình sync, đều không phải nguyên nhân.
3. Chỗ sai thứ hai nằm trong workflow **chưa từng chạy lần nào**, nên nó sẽ chỉ lộ ra đúng vào lúc cần nó nhất: lúc người canh phải báo động.

Và một điều nữa lộ ra khi PR #7 chạy CI: **workflow chạy trên một PR là bản trong `.github/workflows/` của nhánh PR**, mà nhánh PR thừa hưởng bản đó từ `main` — agent không ghi được `.github/` nên nó không bao giờ là bản mới. Bằng chứng: `ci` run #1 của PR #7 hiển thị `Run actions/checkout@v4`, trong khi nhánh đó đã đổi `ops/workflows/ci.yml` sang `@v7`. Hệ quả: **thay đổi trong `ops/workflows/` không tự kiểm được bằng CI của chính PR đó** — chỉ `pnpm lint:workflows` kiểm được trước merge, và chỉ lần chạy sau khi merge mới là bằng chứng thật.


- **Máy lấp khoảng đó từ nay (mục `P-010`):** `ops/workflows/smoke-workflows.yml` chạy sau mỗi lần `ops/workflows/**` đổi trên `main` và gọi **đúng những workflow vừa đổi** — kèm `-f dry_run=true` với workflow nào khai `inputs.dry_run`. Nó đối chiếu **nội dung** `.github/workflows/` với `ops/workflows/` trước khi gọi, để không bao giờ chạy thử bản cũ rồi báo xanh. Workflow đỏ thì **một** issue `alert` cho cả lần push.

  Điều này **không** biến "sau khi merge" thành "trước khi merge" — không gì làm được thế chừng nào G10 còn đúng. Nó rút khoảng chờ từ *"tới lần ai đó bấm tay"* xuống *"vài phút sau merge"*, và đó là toàn bộ điều hứa hẹn.

  `automerge.yml` **không bao giờ** được gọi ở chế độ thật: hai lớp chặn độc lập trong `ops/scripts/smoke-workflows.ts`, có test âm riêng. Luật mềm đi kèm trong `pnpm lint:workflows`: workflow có tác dụng phụ ra ngoài mà không khai `dry_run` thì **cảnh báo** — miễn trừ phải viết lý do ra (`# P-010 dry-run: …`), không phải một cờ bật được mà không nghĩ.

### Luật rút ra

**Mỗi workflow chỉ khai đúng quyền nó cần — nhưng "đúng" có hai phía.** Khai thừa thì mở rộng bề mặt tấn công; khai thiếu thì hỏng im lặng, và trên repo private nó hỏng kèm một thông báo lỗi dẫn sai hướng. Từ nay phía "thiếu" do máy chặn; phía "thừa" do người soát diff bắt.

---

## KF-004 · Issue do workflow mở KHÔNG kích hoạt workflow khác, nên chuỗi báo động đứt giữa chừng

- **Lần gặp:** 1 — ghi ngay, vì nó làm hỏng đúng cơ chế tồn tại để báo khi mọi thứ khác hỏng.
- **Chữ ký:** **không có chữ ký.** Không job nào đỏ, không lỗi nào được in ra. `watchdog` kết thúc `success`, issue được mở đúng nhãn đúng nội dung — và điện thoại im lặng. Đây là loại hỏng tệ nhất: hỏng mà mọi chỉ báo đều xanh.
- **Bằng chứng, 2026-09-20:** `watchdog` run #1 (`test_alert = true`) kết thúc `success` lúc 23:53:31 và mở issue **#8** `[CẢNH BÁO] Nhà máy im lặng`, tác giả `github-actions`, nhãn `alert`, lúc 23:53:40. Issue #8 có **0 comment**. Trong toàn bộ 12 lần chạy của repo tới thời điểm đó, **không có lần chạy `notify` nào**.
- **Nguyên nhân gốc:** GitHub cố ý **không kích hoạt workflow** từ sự kiện do `GITHUB_TOKEN` tạo ra, để tránh vòng lặp vô hạn. `watchdog` mở issue bằng `GITHUB_TOKEN`, nên sự kiện `issues.opened` và `issues.labeled` của issue #8 **không tồn tại** đối với `notify.yml`.

  Đây **đúng cùng một cơ chế** mà giả định **G2** đã ghi, và cũng là lý do `automerge.yml` phải gọi `main-ci` tường minh bằng `workflow_dispatch`. Cơ chế đó đã được nhận ra ở một chỗ, rồi bị bỏ sót ở chỗ thứ hai.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** `notify.yml` tồn tại vì GitHub không báo cho chính người thực hiện hành động, còn agent thì hành động bằng danh tính chủ dự án (CHARTER 2.4). Nhưng nó chỉ chạy được cho issue do **agent** mở — không chạy cho issue do **workflow** mở. Mà đúng những issue quan trọng nhất lại do workflow mở: cảnh báo của `watchdog` (nhà máy đứng im, rủi ro **B7**) và cảnh báo `main` đỏ của `main-ci`.

  Nói cách khác: chuỗi báo động hoạt động cho mọi thứ **trừ** hai trường hợp nó được dựng ra để phục vụ.
- **Đã sửa ở đâu:** `watchdog.yml` và `main-ci.yml` đặt `@HungQuach301` **ngay trong thân issue** chúng mở. Một `@nhắc` trong thân issue sinh thông báo của chính GitHub, không cần mắt xích thứ hai. `notify.yml` giữ nguyên và được ghi rõ phạm vi: nó chỉ phủ issue do **người hoặc agent** mở.
- **Máy chặn từ nay:** `pnpm lint:workflows` có luật `brokenEventChains`. Nó dựng bản đồ *sự kiện → workflow đang nghe* từ tất cả workflow, rồi đối chiếu với các thao tác sinh sự kiện bằng `GITHUB_TOKEN` (`gh issue create`, `gh pr edit --add-label`, `gh api -X PUT …/merge`, …). Cặp nào chưa được khai báo thì CI đỏ.

  Luật **không** tự đoán cách xử lý, vì có hai cách hợp lệ và chúng khác nhau về bản chất: gọi thẳng workflow kia bằng `gh workflow run`, hoặc thôi không dựa vào nó nữa. Vì vậy luật đòi một dòng khai báo **có lý do viết ra**, trên cùng một dòng:

  ```
  # KF-004 <tên sự kiện>: <vì sao chuỗi này không đứt>
  ```

  Bắt gõ ra lý do là chủ ý: một cờ `true` thì ai cũng bật được mà không nghĩ; một câu lý do thì không.

### Luật mới tìm thêm hai chỗ nữa, một trong đó là lỗ hổng thật

Lần chạy đầu tiên của luật này báo hai cặp mà tôi **chưa** nghĩ tới khi rà bằng mắt:

| Workflow | Sinh sự kiện | Ai đang nghe | Tình trạng |
|---|---|---|---|
| `automerge.yml` | `push` (merge) | `main-ci.yml`, **`labels.yml`** | `main-ci` đã được gọi tường minh; **`labels` thì chưa** |
| `ci.yml` | `pull_request` (gắn nhãn) | `ci.yml` (chính nó) | chưa đứt hôm nay, sẽ đứt khi `P-009` thêm `labeled` |

**`labels.yml` là lỗ hổng thật, đang sống.** Nó nghe `push` vào `main` với `paths: ops/labels.json`. Một PR đổi `ops/labels.json` mà được `automerge` merge sẽ **không** đồng bộ nhãn — và `ops/labels.json` **không** nằm trong vùng bảo vệ, nên đường đó mở. Đã sửa: `automerge.yml` gọi `labels.yml` sau khi merge, nhưng chỉ khi PR vừa merge có đụng `ops/labels.json`.

Còn một workflow thứ ba nghe `push` vào `main`: `.github/workflows/sync-workflows.yml`. Nó cũng không chạy sau automerge. Hiện vô hại **vì** nó chỉ quan tâm `ops/workflows/**`, mà thư mục đó nằm trong vùng bảo vệ nên `automerge` không bao giờ merge PR chạm tới nó. Chỗ đó an toàn **nhờ phạm vi vùng bảo vệ, không nhờ thiết kế** — rút `ops/workflows/**` khỏi vùng bảo vệ sẽ làm nó đứt im lặng. Đã ghi ngay trong `automerge.yml`.

Đây là điều đáng chú ý nhất của mục này: rà bằng mắt tìm ra **2** chỗ, luật tìm ra **3**, và chỗ thứ ba là chỗ đang mở.

### Luật rút ra

**Mỗi khi một workflow tạo ra thứ mà một workflow khác phải phản ứng, phải hỏi: sự kiện này có tồn tại không?** Với `GITHUB_TOKEN` thì câu trả lời là **không**. Hai cách đi tiếp, và phải chọn tường minh:

1. **Gọi thẳng** bằng `workflow_dispatch` — cách `automerge` gọi `main-ci`.
2. **Không dựa vào sự kiện** — làm luôn việc đó trong chính workflow đã tạo ra thứ kia.

Cách 2 hợp với báo động hơn: một cái `@nhắc` nằm ngay trong thân issue không phụ thuộc vào bất kỳ workflow thứ hai nào chạy được hay không. Càng ít mắt xích, càng ít chỗ đứt.

---

## Nhóm Z · Hỏng mà mọi chỉ báo đều xanh — rà soát có hệ thống

**KF-001, KF-002 và KF-004 đều thuộc một nhóm**, và nhóm đó nguy hiểm hơn tổng ba mục cộng lại. Đặc điểm chung: **một bước im lặng không chạy, và không có gì đỏ.** Không phải "chạy rồi sai" — mà "không chạy, và chỗ đáng lẽ phải đỏ thì lại xanh vì không có gì để đỏ".

Ba mục trên chỉ là ba lần nhóm này lộ ra. Bảng dưới là rà soát **tất cả** những chỗ còn lại trong repo nơi cùng chuyện đó xảy ra được. Nó được viết ra để đọc một lần rồi dựng máy kiểm, không phải để nhớ.

### Vì sao nhóm này khác mọi nhóm khác

Một bài kiểm bình thường trả lời câu "nó chạy có đúng không". Nhóm Z hỏi câu **trước đó**: "nó có chạy không". Không bài kiểm nào tự trả lời được câu đó về chính mình — một bộ kiểm không chạy thì cũng không báo là nó không chạy. Nên mọi cách phát hiện ở cột bên phải đều có chung một hình dạng: **một thứ ở ngoài đếm và so**, chứ không phải một thứ ở trong tự khai.

Ba cách duy nhất có tác dụng, xếp theo thứ tự nên chọn:

1. **So hai con số phải bằng nhau.** Số file test trên đĩa so với số file test thật sự chạy. Nội dung `ops/workflows/` so với nội dung `.github/workflows/`. Số PR đã merge so với số dòng log có `costUsd`.
2. **Nhịp tim.** Một thứ phải xuất hiện đều đặn; vắng quá lâu là đỏ. Dùng khi không so được hai con số.
3. **Cấm im lặng.** Mọi bước có điều kiện phải **in ra kết luận của nó** — "có nhãn fix, đã kiểm" hoặc "không có nhãn fix, bỏ qua" — và không bao giờ được `skipped` không lời.

### Bảng rà soát

| # | Chỗ | Thứ im lặng không chạy | Vì sao không gì đỏ | Cách phát hiện chủ động |
|---|---|---|---|---|
| **Z1** | Sự kiện do `GITHUB_TOKEN` sinh ra | Workflow nghe `issues`, `issue_comment`, `pull_request`, `push` sau một hành động của workflow khác | Sự kiện **không tồn tại**. Bên sinh ra `success`, bên tiêu thụ không có lần chạy nào để mà đỏ | ✅ **Đã có** — luật `brokenEventChains` trong `pnpm lint:workflows` (P-011). Ghép bên sinh với bên nghe, đỏ khi có cặp chưa khai |
| **Z2** | `if:` của một bước hoặc một job | Bước kiểm bị `skipped`, job vẫn `success` | `skipped` **không phải** `failure`. Nhìn từ ngoài giống hệt đã kiểm và qua | P-009. Luật: bước có điều kiện phải **in ra kết luận**; thêm một luật linter đỏ khi một bước trong job kiểm bắt buộc có `if:` mà không có bước in kết luận đi kèm |
| **Z3** | `.github/` lệch `ops/workflows/` | `sync-workflows.yml` không chạy, hoặc chạy hỏng vì PAT hết hạn | Bản **cũ** trong `.github/` vẫn chạy và vẫn xanh. Mọi thứ trông bình thường, chỉ là code mới chưa bao giờ có hiệu lực | ✅ **Đã có** (mục `P-014`, sóng 1) — `ops/scripts/check-workflows-synced.ts` (`unsyncedWorkflows`), gọi từ một bước riêng trong job `check` của `ops/workflows/main-ci.yml`, chỉ chạy khi `github.event_name != 'push'` để tránh cuộc đua vô hại với `sync-workflows.yml` ngay sau một merge. **Không** nằm trong `pnpm lint:workflows`/`pnpm check`: một nhánh PR đang sửa `ops/workflows/**` khiến hai thư mục lệch một cách BÌNH THƯỜNG, so ở đó sẽ đỏ nhầm cho mọi PR như vậy |
| **Z4** | PAT `WORKFLOW_SYNC_TOKEN` hết hạn | `sync-workflows.yml` | Trùng với Z3 về hệ quả, nhưng lộ sớm hơn nếu bắt riêng | Bước đầu của workflow dùng PAT **khẳng định secret không rỗng** và gọi một API rẻ để xác nhận token còn sống. Rỗng hoặc 401 là đỏ **và mở issue**, không phải bỏ qua |
| **Z5** | Secret thiếu nói chung | Bất kỳ bước nào dùng `${{ secrets.X }}` | Biến nở thành chuỗi rỗng. Lệnh vẫn chạy, có khi vẫn exit 0 | ✅ **Đã có** (mục `P-014`, sóng 1) — `secretsUsedWithoutEmptyCheck` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Kiểm CHỮ (dòng chứa `secrets.X` phải có `-z`/`-n` cùng dòng hoặc ở một dòng trước đó), không theo dõi biến `env:` trung gian — giới hạn ghi rõ trong doc comment. Hiện không workflow nào trong `ops/workflows/` dùng `secrets.*`, nên luật này là hàng rào cho lần đầu tiên, chưa chữa ca đã có |
| **Z6** | `cron` không chạy | `main-ci.yml` (`17 * * * *` — dự phòng của G2), `watchdog.yml` | GitHub tạm ngưng workflow theo lịch khi repo im lặng lâu, và `cron` vốn là nỗ lực tốt nhất chứ không bảo đảm. Không chạy thì không có gì đỏ | **Nhịp tim.** `main-ci` ghi thời điểm chạy vào một file trong repo. Routine `crux-integrator` mỗi thứ Hai đọc file đó; cũ quá ngưỡng là mở issue `alert`. Hai cơ chế **khác họ** nhau nên không cùng chết |
| **Z7** | Routine bị tắt, hết lượt, hoặc không nhận được việc | Cả một làn | Không có lần chạy nào để mà đỏ. Backlog đứng im trông giống backlog đã xong | ⚠️ **Một phần** (mục `P-014`, sóng 3) — `ops/scripts/lane-heartbeat.ts` (`laneHeartbeats`), script `pnpm lanes:heartbeat`, **21** bài ở `ops/test/lane-heartbeat.test.ts`. Bốn tính chất, cả bốn là chỗ dễ làm sai: **(1) dòng bước 0 bị loại khỏi phép đo của mọi làn** — bước 0 ghi một dòng ở MỌI lượt worker (phụ lục P3 bước 0d) nên để chúng lại thì ô của làn không bao giờ cũ được, tức một luật không bao giờ đỏ; đo được lúc viết: làn `integration` nhịp tim **2,2 giờ** khi tính cả dòng bước 0 và **23,4 giờ** khi trừ ra, lệch hơn 21 giờ. Có **phép phá**: bài kiểm dựng đúng ca đó rồi khẳng định bỏ luật này thì nó ra `fresh`. **(2) `never` tách khỏi `stale`** — "chưa chạy lần nào" và "chạy rồi im" là hai nguyên nhân, hai việc phải làm; gộp lại là đúng bài học `Z15`. Đo được: `assembly` và `release` chưa có dòng log nào, trong khi tám làn kia có. **(3) không dòng nào đọc được thì NÉM** (`LaneHeartbeatUnreadable`), không trả mười ô `never` — bất biến I8 đòi mọi lần chạy ghi một dòng, nên `ops/logs` rỗng nghĩa là phép đọc hỏng; ranh giới đã khai: ca *"đọc được dòng nhưng không dòng nào không-phải-bước-0"* **không** ném, vì đó là kết luận đúng chứ không phải phép đo hỏng. **(4) mốc ở TƯƠNG LAI ra verdict `future`, KHÔNG ra `fresh`** — vòng soát ngữ cảnh sạch tìm ra chỗ này bằng chạy thật, trên chính dòng log của PR: `at` sớm hơn đồng hồ ~10 phút cho `platform … -0.14h … fresh`, và một số âm thì nhỏ hơn MỌI ngưỡng, nên một dòng ghi nhầm năm làm làn đó không bao giờ `stale` được. Dung sai `FUTURE_TOLERANCE_HOURS` = 1 phút cho trôi đồng hồ giữa hai máy. Cùng vòng soát đó chặn thêm ca **thiếu ngưỡng của một làn** (`> undefined` = false ⇒ `fresh` vĩnh viễn) bằng một phép ném. Ngưỡng theo làn **mượn hai số đã có trong chính `watchdog.yml`** thay vì bịa mười số mới: 6 giờ cho `platform`/`integration` (ngưỡng dấu hiệu số 2), 26 giờ cho các làn còn lại (ngưỡng dấu hiệu số 1). Phép so chống trôi: bài kiểm đọc thẳng `ops/workflows/watchdog.yml` và đòi **đúng dòng `jq` thực thi** mang **nguyên văn** hằng `STEP0_REF_PATTERN` — chính phép so đó tìm ra dấu hiệu số 5 đang **thiếu hai hình dạng** `ref` (`P1-step0-`, `P3-daily-`), đã sửa cùng PR này. Bản đầu của chính bài kiểm ấy so trên **cả file**, và đó là một chiều fail-open đo được: vòng soát dựng ca "hằng nằm trong một dòng chú thích, `jq` thật lọc bằng một biểu thức không khớp gì" thì 17/17 vẫn xanh. Nay phá y hệt ca đó ra `not ok`. Đánh đổi còn lại, khai chứ không giấu: `ops/logs/platform/P-016.jsonl` **trộn** 52 dòng bước 0 với **8** dòng việc thật của mục `P-016` dưới cùng một `ref`, nên luật loại cả cụm — hướng lệch **an toàn** (làn trông cũ hơn thật, luật báo thừa chứ không báo thiếu). **Còn treo, nói rõ chứ không im lặng:** dấu hiệu số 6 của `watchdog` chỉ **nối vào** thân cảnh báo khi đã có dấu hiệu khác nổ, nó KHÔNG tự mở issue — một làn im là chỗ nghẽn của **máy**, không phải việc chủ dự án bấm được (CHARTER 1.3), mà `watchdog` bình luận lại **mỗi giờ** chừng nào dấu hiệu còn, nên một dấu hiệu kéo dài nhiều ngày sẽ thành nhiều chục lần @nhắc. Nhịp cảnh báo là phạm vi mục `P-034`. Đường phát hiện độc lập đi qua **bản tin ngày** (CHARTER phụ lục P2, mục "Tiến độ" gọi `pnpm lanes:heartbeat`) — một lần mỗi ngày, 0 lần thao tác thêm của chủ dự án |
| **Z8** | Nhãn `owner-merge` do `protected-area` gắn | Job gắn nhãn | Không gắn được nhãn thì `automerge` **không thấy** `owner-merge` và merge một PR chạm vùng bảo vệ. Bất biến I4 thủng, không gì đỏ | `automerge.yml` **từ chối merge** khi job `protected-area` chưa xanh **trên đúng SHA sắp merge**. Không đủ nếu chỉ kiểm "CI xanh" ở mức run |
| **Z9** | `\|\| true` và `continue-on-error: true` | Một lệnh bất kỳ trong khối `run:` | Lỗi bị nuốt ngay tại chỗ, theo đúng thiết kế — vấn đề là nó ở chỗ không ai định | ✅ **Đã có** (mục `P-014`, sóng 1) — `undocumentedSwallows` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Đòi chú thích ngay trên (đi ngược qua các dòng nối bằng `\` để một lệnh nhiều dòng chỉ cần một chú thích ở đầu khối) hoặc cùng dòng. Sửa luôn năm chỗ trong cây hiện tại lúc thêm luật: `automerge.yml`, `ci.yml` (gộp sáu lần gỡ nhãn lặp lại qua một hàm `rm_label`, chỉ cần một chỗ giải thích), `watchdog.yml`. ⚠️ **Giới hạn đã đo, khai ra để ô này đừng khai "đã có" trần** (mục `P-014` sóng 3): luật chỉ nhìn thấy **hai** hình dạng — `\|\| true` và `continue-on-error: true`. Hình dạng `\|\| VAR=…` nuốt lỗi y hệt mà luật **không thấy**; phá thử bằng cách chèn `X=$(false) \|\| X="nuot loi khong chu thich"` (không chú thích) vào `watchdog.yml` thì `pnpm lint:workflows` vẫn `EXIT 0`. Sóng 3 chọn **không** đưa hình dạng đó vào cây (dùng `if ! VAR=$(…); then` tường minh) thay vì nới luật ngay tại đây: mở rộng `undocumentedSwallows` là đổi một luật đang chạy và có thể đỏ chỗ khác, đáng một PR riêng |
| **Z10** | Thiếu `set -euo pipefail` | Mọi lệnh sau lệnh hỏng đầu tiên | Bash mặc định chạy tiếp và trả mã thoát của **lệnh cuối**. Script hỏng giữa chừng vẫn exit 0 | ✅ **Đã có** (mục `P-014`, sóng 1) — `blocksMissingPipefail` trong `ops/scripts/check-workflows.ts`, chạy trong `pnpm lint:workflows`. Đòi dòng THẬT đầu tiên của khối (bỏ qua dòng trống) là `set -euo pipefail`; cả 12 khối `run: \|` hiện có trong `ops/workflows/` đã đúng từ trước |
| **Z11** | Test có trên đĩa nhưng không nằm trong glob của `pnpm test` | Chính bài test | Bộ test xanh với ít test hơn nó tưởng. Không ai đếm nên không ai biết | ✅ **Đã có** (mục `P-014`, sóng 1) — `ops/scripts/check-test-coverage.ts`, script mới `pnpm check:tests`, trong `pnpm check`. So tập file `*.test.ts` quét toàn repo với ba glob y hệt `scripts.test` của `package.json`; lệch thì in tên từng file bị bỏ sót, không chỉ đếm |
| **Z12** | Bộ kiểm sổ giả định đọc mục **cuối** tới hết file | Phần kiểm "có nói về dự phòng không", cho mục cuối | Nội dung cuối file (phần "Cách thêm một giả định") trôi vào thân mục cuối và mang theo chữ khoá, làm mục đó xanh sai. **Đã xảy ra thật với G15** — chỉ lộ ra khi thêm G16 đẩy nó khỏi vị trí cuối | ✅ **Đã có** (mục `P-014`, sóng 2) — `ops/scripts/ledger-sections.ts` (`sliceLedgerSections`), dùng chung cho `check-assumptions.ts` và `recheck-assumptions.ts`. Mục kết thúc ở **ranh giới đầu tiên sau nó**: một heading `## ` bất kỳ, hoặc một dòng `---`; tới hết file chỉ khi không còn ranh giới nào. Gộp về một chỗ chứ không sửa hai chỗ: hai bên đọc sổ mang **hai bản chép** của cùng phép cắt, sửa một bên là hình dạng Z16 chờ sẵn. **Năm** bài ở `ops/test/ledger-sections.test.ts`, trong đó **một bài đọc chính `docs/assumptions.md`** — đo được lúc sửa: `G17` đang nuốt trọn phần "Cách thêm một giả định" (nó nằm **giữa** `G17` và `G18`, không phải cuối file, nên ca này tái hiện mà không cần dựng sổ giả). Kiểm bằng **phép phá**: dựng lại phép cắt cũ thì 3/5 bài đỏ, khôi phục thì 5/5 xanh |
| **Z13** | `pnpm replay` so snapshot | Chính phép so, nếu snapshot được cập nhật trong cùng PR | Snapshot mới khớp output mới, đương nhiên xanh. Phép so mất hết giá trị mà không báo gì | CHARTER 6.1 đã đòi `--update` đi trong **PR riêng**. Chưa có máy nào ép: thêm một job đỏ khi một PR vừa chạm `ops/golden/**` vừa chạm thứ khác. **Từ `I-009` luật đó khả thi:** trước đó fixture mang bản chép snapshot, nên mọi PR `--update` **buộc** phải sửa kèm sáu file fixture và job ấy sẽ đỏ với chính các PR nó phải cho qua. Nay fixture trỏ tập vàng bằng `upstreamFrom` và tự đi theo snapshot, nên một PR `--update` đúng luật chỉ chạm `ops/golden/**`. ✅ **Đã có** (mục `P-014`, sóng 2) — `goldenOnlyProblems` trong `ops/scripts/check-golden-pr.ts`, chạy ở job **`golden-solo`** của `ops/workflows/ci.yml`. Luật nằm trong script chứ không trong YAML, vì `ci.yml` chạy theo định nghĩa **trong nhánh PR** nên một luật viết thẳng vào workflow tự nó không chặn được gì — và vì chỗ đặt luật phải là chỗ test đọc được. **Ngoại lệ đúng hai thư mục**, không phải châm chước mà là tính chất kiểm được: `ops/logs/**` (bất biến I8 đòi mọi lần chạy ghi một dòng) và `ops/lanes/**` (CLAUDE.md mục 2 đòi cập nhật backlog trong cùng PR) — `replay.ts` đọc `ops/golden/**` rồi chạy các xưởng, không đọc dòng log nào và không đọc backlog nào. Đọc theo mặt chữ ("không kèm thay đổi nào khác") thì **không PR nào hợp lệ được**, và một luật không ai qua được là một luật sẽ bị tắt. `docs/**` cố ý **không** được miễn: lý do snapshot đổi thuộc về mô tả PR. **Mười** bài ở `ops/test/check-golden-pr.test.ts`, chia đôi có chủ đích: **năm** bài dựng ca luật **phải đỏ** (kể cả ca đường dẫn bị `git` bọc ngoặc kép vì `core.quotePath` — chiều **fail-open** duy nhất của luật, và là chiều im lặng), **năm** bài canh chiều ngược lại, không được đỏ nhầm (trong đó `ops/golden-notes/` chỉ **trông giống** tập vàng). Đầu vào **rỗng** thì script ĐỎ chứ không xanh im lặng: một PR luôn có ít nhất một file đổi, nên rỗng nghĩa là phạm vi so sai — đúng bài học Z15 |
| **Z14** | Dòng log `costUsd` (bất biến I8) | Bước ghi log, khi lần chạy chết trước đó | Thiếu một dòng log không làm gì đỏ. Chi phí thật cao hơn chi phí thấy được, và ngân sách học trôi | So số PR đã merge theo làn với số dòng trong `ops/logs/<lane>/**` cùng khoảng thời gian. Lệch quá ngưỡng thì báo trong bản tin ngày |
| **Z15** | Bài kiểm tự động của sổ giả định (`pnpm recheck:assumptions`) | Bài kiểm G14, khi clone chưa có ref `origin/claude/*` nào để quét | "Quét rồi không thấy gì" và "chưa quét được gì" in ra **cùng một dòng** `◦ chưa quan sát được`, và lệnh vẫn exit 0. Clone của phiên cloud chỉ fetch `main`, nên đó là chế độ chạy **mặc định** của cả ba routine: bài kiểm của thứ Hai im lặng ở hầu hết các lượt | ✅ **Đã có** — mục `I-005`: bài kiểm **tự fetch cả hai đầu vào** của mình (`claude/*` **và** `main`), và ném khi vẫn không có ref nào. Thiếu đầu vào ra `⚠ … KHÔNG CHẠY ĐƯỢC` cộng exit khác 0, không bao giờ ra `◦`. Hình dạng chung: **cấm im lặng** (cách 3) — một bài kiểm không được tự khai "không có gì để xem" khi nó chưa nhìn. ⚠️ **Bản sửa đầu chỉ fetch `claude/*`, và thế là đổi im lặng lấy số sai:** `origin/main` cũ làm commit squash lọt vào phạm vi quét ⇒ G14 `sai` giả ⇒ một issue `[QĐ]` giả gửi tới chủ dự án. Vòng soát bắt được bằng chạy thật trên một clone `--single-branch`. Bài học: khi chữa một bước im lặng, hỏi ngay "nó có đủ đầu vào để trả lời đúng chưa" — không thì chỉ đổi mặt của nhóm Z. ✅ **Sửa tiếp ở mục `I-007`:** ném vô điều kiện khi rỗng cũng là một chiều hỏng của nhóm Z — nó gộp "chưa quét được" với "kho thật sự không còn nhánh `claude/*` nào" (mọi PR đã merge, nhánh đã xoá) làm một, và ca sau vẫn là quan sát hợp lệ. `listRemoteClaudeBranches` hỏi thẳng remote bằng `ls-remote`, không qua fetch cục bộ: remote xác nhận rỗng thì trả `[]` (in `◦`, đúng nghĩa); remote không xác nhận được hoặc chính `ls-remote` lỗi thì mới ném (`⚠ … KHÔNG CHẠY ĐƯỢC`). Bài học thêm: "ném vô điều kiện khi rỗng" và "im lặng vô điều kiện khi rỗng" là hai cực của cùng một lỗi — cả hai đều đoán thay vì hỏi thẳng nguồn sự thật. ✅ **Sửa tiếp ở mục `I-012`:** một ref `refs/remotes/origin/claude/*` tồn tại cũng không có nghĩa nhánh đó còn sống — GitHub merge kiểu squash để lại nguyên xi lịch sử của nhánh đã merge đứng mãi mãi ngoài `main`. Đo được lúc phát hiện: 10/14 commit "thiếu trailer" nằm trên đúng một nhánh vậy, `claude/platform/P-009` (PR `#9` đã merge, nhánh chưa xoá) — kể cả ba commit của chính chủ dự án từ trước khi CLAUDE.md tồn tại, và bài kiểm này sẽ kêu `sai` mãi mãi vì chúng không bao giờ được sửa. `collectCommits` nay lọc còn đúng nhánh có PR **mở** (`fetchOpenPrBranches`, cùng quy ước gọi `gh` với `update-metrics.ts`); nhánh hết PR mở (đã merge/đã đóng) loại khỏi phạm vi quét, không phải nới `isToolCommit` cho tới khi hết đỏ. Bài học thêm: "còn ref trên remote" và "còn sống" là hai câu hỏi khác nhau khi merge là squash — chỉ câu hỏi thứ hai mới trả lời được đúng phạm vi |
| **Z16** | Bản sao cấu hình trong fixture của xưởng | Không có bước nào im lặng — **phép so** mới là thứ vắng mặt: `workshops/<tên>/fixtures/input.json` của cả sáu xưởng nhúng một bản sao channel pack và genre pack, và bản sao đứng yên khi bản thật đổi | Fixture chạy **độc lập** nên không có gì so nó với `packs/`, và tập vàng không băm pack (`inputsHashOf` chỉ băm con trỏ artifact đầu vào). Sáu file cùng xanh với cấu hình cũ, trong khi tập thật chạy với cấu hình mới. Đo được lúc phát hiện: bản sao channel còn `pillars` bản Đợt 0, bản sao genre thiếu **năm** khoá `limits` | ⚠️ **Một phần** — mục `I-008`. **Bản sao pack: đã bỏ hẳn.** `readInputFile` của kernel nạp pack từ `packs/` theo trường `channel`, và khoá cấp một của file `--input` là một **danh sách cho phép** (`$note`, `episodeId`, `channel`, `genre`, `locale`, `upstream`, `upstreamFrom`) — chặn đúng tên `packs` thì một bản sao đặt tên `channelPack` hay `limits` đi qua im lặng. `pnpm contracts` chạy thật `readInputFile` trên **mọi** file `--input`, validate từng artifact đầu vào theo contract, và so bốn trường bối cảnh của nó với channel pack. Hình dạng chung: **bỏ bản sao thì không cần so** — một kiểm so sánh chỉ báo sau khi đã lệch, còn một nguồn duy nhất thì không có gì để lệch; thêm nữa một pack đổi không còn phải sửa sáu file thuộc sáu làn (`P-015`). **Bản sao artifact trong khối `upstream`: đã bỏ hẳn** — mục `I-009`. Chúng là bản chép của `ops/golden/<ep>/snapshots/*.json` và đã trôi thật — đo lúc phát hiện: `assembly←visual` lệch **14** đường dẫn (`hasMotion`), `release←assembly` lệch **28** và **thiếu hẳn** trường bắt buộc `payload.preflight.antiSlide` cùng hai check `motion-coverage`, `longest-static-run`. `I-008` làm mới hai bản sao đó và bắt được ca **thiếu trường** (validate theo contract) và ca **lệch bối cảnh**, nhưng nội dung payload vẫn không bị buộc vào nguồn nào, nên một bản chép **hợp contract mà lệch snapshot** vẫn xanh. `I-009` giữ đúng hình dạng của `I-008` — **bỏ bản sao thì không cần so**: file `--input` khai `upstreamFrom` (`{ golden }`) và artifact tới từ snapshot lúc chạy (`readInputFile` của kernel), nên không còn bản chép nào để trôi. 3959 dòng bản chép trong sáu fixture đổi thành 6 con trỏ. **Danh sách xưởng cần nạp: đã bỏ khỏi fixture** — mục `I-011`. `I-009` để `upstreamFrom.workshops` khai tay, một bản chép **thứ hai** của `definition.consumes`; đo được: đổi `consumes` của một xưởng mà để fixture giữ danh sách cũ thì lần chạy độc lập vẫn xanh với một artifact thừa. Cùng hình dạng: bỏ bản chép — `readInputFile(root, path, consumes)` nhận danh sách từ bên gọi (`definition.consumes`), fixture chỉ còn `{ golden }`, và một `upstreamFrom.workshops` sót lại nay đỏ ở `pnpm contracts` (`upstreamFromWorkshopsProblems`). `ops/scripts/check-fixtures.ts` (`upstreamCopyProblems`, trong `pnpm contracts`) chặn việc chép lại: fixture **trong repo** khai thẳng `upstream` không rỗng là đỏ. Kernel **không** cấm khối `upstream` khai thẳng — chạy một xưởng độc lập với artifact viết tay là chế độ CHARTER 5.4 nói tới, và luật chặt hơn chỉ đúng cho fixture của repo. Đo bằng chạy thật: chép lại một artifact **hợp contract, khớp bối cảnh, lệch đúng một trường payload** thì `pnpm contracts` đỏ, khôi phục thì xanh. Vòng soát đo thêm một tính chất **mạnh hơn** câu trên: một bản chép **y nguyên, chưa lệch gì** cũng đỏ — luật cấm *chép*, không phải cấm *đã lệch*, nên nó chặn ngay lúc bản sao ra đời chứ không đợi tới lúc nó trôi |
| **Z17** | Lockfile sau một lần gộp **sạch** | Không có bước nào im lặng — thứ vắng mặt là **phép kiểm**: `integrator-resolve.ts` chỉ kiểm lockfile khi chính nó xung đột, còn gộp sạch thì commit thẳng | `git` ghép lockfile theo dòng, gộp sạch vẫn ra file lệch manifest; và `pnpm check` ở máy KHÔNG chạy `pnpm install --frozen-lockfile` (chỉ CI chạy). Integrator báo "xanh, đã push" rồi CI mới đỏ. Đo thêm: cổng rẻ `--lockfile-only --frozen-lockfile` cũng **xanh** trên đúng cây hỏng đó | ✅ **Đã có** — mục `I-006`, KF-007. `guardLockfileAfterMerge` chạy ở mọi đường gộp có chạm lockfile: kiểm bằng **cài thật** → tạo lại → kiểm lại → còn đỏ thì huỷ gộp. Hình dạng chung: **cổng phải là đúng lệnh mà CI chạy**, cổng rẻ hơn chỉ cho biết cổng rẻ hơn nói gì |
| **Z18** | Khối `permissions:` của workflow, so với endpoint gọi **thẳng** qua `gh api` | Không bước nào im lặng — thứ vắng mặt là **phép so**: `missingPermissions` của `pnpm lint:workflows` chỉ biết các lệnh `gh <lệnh con>` (`gh pr view`, `gh issue create`, …). Một endpoint gọi thẳng bằng `gh api "repos/…/commits/$SHA/check-runs"` không khớp luật nào, nên nó đi qua mà **không ai hỏi nó cần scope gì** | Linter xanh, `pnpm check` xanh, CI của PR xanh, nhãn đúng, cửa merge đúng. Lỗi chỉ hiện ra trong log của `automerge` — workflow mà **không ai mở ra xem khi nó không merge gì**, vì "không merge gì lượt này" cũng là kết quả bình thường. Nặng thêm vì `set -euo pipefail` trong một vòng lặp duyệt CẢ hàng đợi: 403 ở PR **đầu tiên** giết luôn 26 PR phía sau | ✅ **Đã có** — `KF-017`. Luật mới trong `missingPermissions`: `gh api` chạm `/check-runs` hoặc `/check-suites` phải khai `checks: read`. Hình dạng chung: **luật lint phải bắt theo thứ thật sự gọi API, không theo cú pháp tiện tay** — `gh api` là cửa hậu đi vòng qua mọi luật viết theo tên lệnh con. Nhịp tim cho phần còn lại: `automerge` đỏ N lượt liên tiếp phải nổi lên bản tin (mục `P-020`, ngưỡng "không PR nào merge quá 6 giờ") |

### Cái giá của việc không làm

Ba mục đã lộ ra (KF-001, KF-002, KF-004) đều **chỉ lộ ra vì có người bấm tay** — không mục nào được máy tìm thấy. Đó là con số đáng lo nhất trong sổ này: tỉ lệ tự phát hiện của nhóm Z hiện là **0/3**.

Rà soát này thành mục `P-014` trong `ops/lanes/platform/backlog.md`. Thứ tự làm theo giá trên mỗi đồng: **Z10 → Z11 → Z3 → Z5 → Z9** trước (đều là luật máy kiểm rẻ, viết một lần chạy mãi), rồi tới Z2, Z8, Z13 (gắn vào CI), cuối cùng Z6, Z7, Z14 (cần nhịp tim và ngưỡng, phải chỉnh dần). **Sóng 1 (Z10, Z11, Z3, Z5, Z9) đã xong** — năm luật máy kiểm, mỗi luật có test âm, chi tiết ở từng dòng bảng trên. **Sóng 2 xong một phần: Z12 và Z13** (cùng mục `P-014`) — chi tiết ở hai dòng bảng trên. Còn lại của sóng 2: **Z2** (phần *cơ chế* đã xong ở `P-009`; phần còn lại là một luật linter, và **7 trong 10** chỗ `if:` của `ops/workflows/**` tại nhánh này là `if:` **mức job** chứ không phải mức step (trên `main` là 6/9 — chính PR này thêm một job-level nữa), trong khi câu luật ở bảng trên chỉ mô tả ca mức step — hình dạng luật cho ca mức job là một câu hỏi thiết kế riêng, không phải một heuristic bấm thêm) và **Z8** (sửa nó là sửa `ops/workflows/automerge.yml`, nằm trong vùng `owner-merge`, nên nó phải đi PR riêng: gộp chung thì các luật máy kiểm rẻ phải nằm chờ chủ dự án). `P-014` vẫn ở `status: ready` trong backlog: mục này cố ý không đóng một lần (phần còn lại của sóng 2, và trọn sóng 3). **Z15 đã xong** ở mục `I-005`, và nó vào bảng này theo đường khác hẳn: không ai rà ra nó, nó lộ ra vì một lượt `crux-integrator` chạy thật rồi có người đọc bản in. Đáng ghi lại vì nó đúng chỗ nhóm Z đau nhất — bài kiểm **của chính sổ giả định** cũng nằm trong nhóm Z, và nó không tự nói được là nó chưa chạy. **Z16 lần thứ tư, và lần này không phải bản sao dữ liệu mà là bản sao PHÉP KIỂM** — mục `I-013`: `topic/T-008` thêm ba contract ở `workshops/topic/contracts/`, nơi `pnpm contracts` không quét, rồi bù bằng ba test `unsupportedKeywords` viết tay. Cơ chế bù đó là **opt-in**: contract thứ tư thả vào đó mà tác giả quên viết test thì ràng buộc im lặng không được kiểm, và không gì đỏ. Cùng hình dạng chung của Z16 — *bỏ bản chép thì không cần so* — chỉ khác ở chỗ thứ bị chép là một phép kiểm chứ không phải một khối dữ liệu. `ops/scripts/check-workshop-contracts.ts` (việc số 6 của `pnpm contracts`) quét cả thư mục, ba test viết tay bỏ đi. Đáng ghi vì nó cho thấy luật "bù bằng tay ⇒ opt-in ⇒ Z" không giới hạn ở fixture. **Z16 xong hẳn** qua hai mục — bản sao pack bỏ ở `I-008`, bản sao artifact trong `upstream` bỏ ở `I-009` — và không phần nào do máy tìm ra: nó lộ ra trong vòng soát của `topic/T-002`, và phần `upstream` lộ ra trong vòng soát của chính `I-008`. **Z17 xong** ở mục `I-006`, và nó là lần đầu tiên nhóm này lộ ra theo một đường khác: không ai gặp nó trên `main`: một mục backlog viết sẵn nghi ngờ ("về lý thuyết git ghép ra một lockfile lệch") bắt phải **dựng lại bằng chạy thật trước khi xây gì**, và ca hỏng dựng được thật. Tỉ lệ tự phát hiện của nhóm Z vì vậy vẫn là **0** — sáu lần lộ ra đều nhờ người đọc hoặc người nghi — nhưng `I-006` cho thấy một đường rẻ hơn đường chờ sự cố: viết nghi ngờ thành mục backlog kèm luật "không tái hiện được thì đóng mục".

---

## KF-005 · File log dùng chung trong một làn vẫn xung đột khi nhiều PR chạy song song

- **Lần gặp:** 2 trong cùng một ngày (PR #10 và PR #11, cả hai với `ops/logs/platform.jsonl`, sau khi PR #12 được squash vào `main`).
- **Chữ ký:** `CONFLICT (content): Merge conflict in ops/logs/platform.jsonl`, với hai bên là **hai dòng khác nhau cùng được thêm vào cuối file**. Không bên nào sửa hay xoá gì của bên kia.
- **Nguyên nhân gốc:** CHARTER 2.1 và bất biến **I8** phân vùng log **tới mức làn**: `ops/logs/<lane>.jsonl`. Phân vùng đó giải quyết đúng bài toán nó được đặt ra để giải — hai **làn** chạy song song không đụng nhau. Nhưng nó **không** giải bài toán hai **mục** trong *cùng một làn* chạy song song, mà đó lại là chế độ chạy bình thường: phụ lục P1 đặt mặc định 2–3 worker, và `platform` là làn nhận nhiều mục nhất.

  Đơn vị tranh chấp là **dòng cuối file**, và mọi PR trong làn đều ghi vào đúng đó.

### Nó khác KF-002 ở chỗ nào

Hai mục trông giống nhau ở triệu chứng và **khác hẳn ở nguyên nhân**. Nhầm hai cái này thì sẽ chữa nhầm.

| | KF-002 | KF-005 |
|---|---|---|
| **Nguyên nhân** | Merge **squash** cắt tổ tiên chung của một nhánh **xếp chồng** | **Nhiều PR cùng ghi vào một file dùng chung**, dù tất cả đều base `main` |
| **Điều kiện cần** | PR xếp chồng **và** squash — thiếu một là không xảy ra | Chỉ cần hai PR song song trong cùng một làn. **Không** cần xếp chồng |
| **File bị ảnh hưởng** | *Mọi* file hai PR cùng chạm, kể cả file không liên quan gì tới nhau | Đúng những file được thiết kế để nhiều PR cùng ghi: log, backlog, sổ |
| **Cách chữa của KF-002 có cứu được không** | — | **Không.** PR #10 và #11 đều base `main`, đúng luật số 1 của KF-002, và vẫn xung đột |
| **Đơn vị tranh chấp** | Nội dung file, ngữ cảnh ba chiều bị mất | Dòng cuối file |

Nói gọn: KF-002 là lỗi của **hình dạng nhánh**, KF-005 là lỗi của **hình dạng file**. Squash chỉ làm KF-005 nặng thêm chứ không tạo ra nó.

- **Đã sửa ở đâu:** `.gitattributes` ở gốc repo đặt `merge=union` cho `ops/logs/*.jsonl` và `docs/visual/calibration-log.jsonl`. `union` là trình merge **có sẵn của git**: hai bên cùng thêm dòng thì nó giữ cả hai, không báo xung đột. `.gitattributes` nằm trong repo nên không cần cấu hình gì ở máy người dùng.

  **Bằng chứng chạy thật, 2026-09-21** — dựng hai repo thử trong scratchpad:

  | Kịch bản | Kết quả |
  |---|---|
  | Hai nhánh cùng thêm một dòng vào cuối, merge thường | Giữ cả hai dòng, **0 dấu xung đột** |
  | Đúng hình dạng đã sinh lỗi: `pr1` squash vào `main`, rồi gộp `main` vào `pr2` | Giữ cả hai dòng, **0 dấu xung đột** |

  Hai giới hạn, **đã đo chứ không phải đoán**, vì chúng quyết định ai được dựa vào cái gì:

  1. **Union không xếp theo thời gian.** Trong cả hai lần thử, dòng `at:03` của nhánh nằm **trước** dòng `at:02` của `main`. Vậy nên **mọi bên đọc log phải tự sắp theo `at`** — bản tin ngày, `ops/metrics.md`, và routine integrator. Tin vào thứ tự dòng là sai.
  2. **Union không khử trùng lặp.** Hai nhánh ghi y hệt một dòng thì file có hai dòng giống nhau. Với log append-only mang `at` và `ref` riêng thì điều này không xảy ra trong thực tế, nhưng nó là lý do **không** được dùng union cho file mà dòng có thể trùng.

  **Đã kiểm, 2026-09-22 — câu trả lời là KHÔNG** (mục `VF-G17`, chi tiết ở **KF-009** dưới): GitHub **không** áp dụng `.gitattributes` khi nó tự tính "nhánh này có xung đột không" trên trang PR. Đúng như dòng này dự liệu, biểu ngữ xung đột vẫn hiện trong khi `git` ở phía worker gộp sạch — nhưng hệ quả **nặng hơn** dự liệu: `automerge.yml` nghe phía GitHub, nên một PR như vậy không tự merge được cho tới khi có một commit gộp `main` (bước 0 của phụ lục P3).

- **Đã sửa tận gốc, 2026-09-21 (quyết định `D-C04`, mục `P-018`):** log phân vùng **tới mức mục** — `ops/logs/<lane>/<id>.jsonl`. Hai PR trong cùng một làn không còn chạm cùng một file, nên nguyên nhân gốc ở trên — "đơn vị tranh chấp là dòng cuối file, và mọi PR trong làn đều ghi vào đúng đó" — không còn đúng. Union không bị gỡ: nó xuống làm **lớp phòng thủ thứ hai**, cho trường hợp còn lại là hai lần chạy cùng ghi vào **một** mục.

  **Giới hạn đã đo của lớp phòng thủ thứ hai** — phải đọc kèm, vì nó quyết định ai được dựa vào cái gì:

  1. **Luật chỉ có tác dụng khi nhánh đã mang sẵn nó TRƯỚC lần gộp.** Git đọc `.gitattributes` ở trạng thái trước khi gộp, nên luật do `main` mang tới không áp cho chính lần gộp mang nó tới (G17, đã kiểm bằng chạy thật và ghi trạng thái `sai`).
  2. **GitHub KHÔNG dùng `.gitattributes` khi tự tính `mergeable` trên trang PR** — đo được 2026-09-22, mục `VF-G17` đã chốt, chi tiết ở **KF-009** dưới. `D-C04` làm nó **bớt quan trọng** (log không còn là chỗ sinh xung đột) chứ không trả lời nó; câu trả lời tới từ chỗ khác, và nó nói rằng lớp phòng thủ thứ hai này **không bao giờ** một mình đủ để một PR merge được.
  3. Union **không** xếp theo thời gian và **không** khử trùng lặp — hai giới hạn đã đo ở trên, vẫn đúng. Vì vậy `readRunLogs` của kernel sắp theo `at` cho mọi bên đọc.

- **Máy chặn từ nay:** `ops/test/gitattributes.test.ts` khoá luật union cho từng file append-only đang có, và khoá luôn chiều ngược lại — **không** file Markdown nào được nhận `merge=union`. Union trên Markdown sẽ trộn hai mục thành một mục hỏng mà vẫn merge được: đó là nhóm Z, hỏng mà không gì đỏ.

  Cộng thêm `ops/test/logs-layout.test.ts`: **không còn file `.jsonl` phẳng nào trong `ops/logs/`**. Xoá hết file phẳng trong một PR chưa khoá được `D-C04` — hình dạng cũ quay lại được mà không gì đỏ, và đã quay lại thật một lần (`ops/logs/verify.jsonl`, PR #29 → lần gộp cuối của PR #26). Chi tiết ở `docs/decisions/D-C04.md`.

  Cùng file test còn khoá một bẫy tinh vi hơn một bậc: **dòng log nằm sai file**. Git **nhận ra đổi tên** `ops/logs/verify.jsonl` → `ops/logs/verify/VF-G2.jsonl` (cùng nội dung), nên một dòng `ref: verify/VF-G11` mà `main` thêm vào file phẳng cũ được áp thẳng lên đường dẫn mới và `merge=union` gộp êm — **không một dấu xung đột nào**, không dòng nào mất, chỉ là chi phí của `VF-G11` từ nay tính cho `VF-G2`. Luật `misfiledLogLines` đối chiếu `lane` và `logIdFromRef(ref)` của từng dòng với đường dẫn chứa nó.

### Rà nốt: còn file dùng chung nào khác

Union chỉ cứu được file mà **thứ tự dòng không mang nghĩa**. Với Markdown thì không — nên phần còn lại phải chữa bằng cách khác.

| File | Xung đột khi nào | Union có cứu được không | Cách tránh |
|---|---|---|---|
| `ops/logs/<lane>/<id>.jsonl` | ~~Hai PR cùng làn cùng thêm một dòng cuối~~ — hết, từ `D-C04`: mỗi mục một file. Còn lại: hai lần chạy cùng ghi vào **một** mục | ✅ Có — union vẫn đặt, làm lớp thứ hai | Đã xong. Bên đọc gọi `readRunLogs`, nó sắp theo `at` sẵn |
| `docs/visual/calibration-log.jsonl` | Hai lần hiệu chuẩn song song | ✅ Có — đã đặt | Đã xong |
| `ops/lanes/<lane>/backlog.md` | **Hai chỗ**: (a) hai PR cùng thêm mục mới ở đầu file — đã xảy ra ở PR #11; (b) hai PR cùng đổi `status` của hai mục nằm sát nhau | ❌ **Không.** Union sẽ lồng hai mục vào nhau, sinh một mục vô nghĩa mà git vẫn coi là merge thành công | Thêm mục mới ở **cuối file**, mỗi mục là một khối tự đủ cách nhau một dòng trống. Việc này không làm xung đột biến mất, nó làm xung đột **an toàn**: hai khối ở cuối, giải bằng cách giữ cả hai, không bao giờ mất chữ của ai. Số mục **nhận trước** ở dòng log để hai worker không cùng lấy một số |
| `ops/known-failures.md` | Hai PR cùng thêm một mục `KF-00N` ngay trước phần "Cách thêm một mục" | ❌ Không | Chuyển phần "Cách thêm một mục" lên **đầu file**, để mục mới luôn nối vào cuối. Vẫn có thể xung đột, nhưng luôn là "hai khối ở cuối", giải được trong một phút |
| `docs/assumptions.md` | **Hai chỗ cho mỗi lần thêm**: một dòng trong bảng tổng ở đầu, một mục đầy đủ ở dưới. Hai PR cùng thêm giả định là xung đột ở cả hai | ❌ Không | Mã `G<N>` **nhận trước** trong backlog làn `verify` trước khi viết, để hai worker không cùng lấy một mã. Mục đầy đủ luôn nối vào cuối, trước dấu `---` cuối. `pnpm assumptions` đã bắt được trường hợp bảng và mục lệch nhau, nên một lần giải sai sẽ đỏ chứ không im lặng |
| `ops/metrics.md` | Hai làn cùng cập nhật số tổng | ❌ Không | **Đừng viết tay.** File này là số **dẫn xuất** từ `ops/logs/**`; `ops/scripts/update-metrics.ts` (mục `I-002`) sinh nó bằng lệnh, kể cả bảng chi phí từ `D-C04`. Số dẫn xuất mà chép tay thì ngoài xung đột còn sai lặng lẽ |
| `pnpm-lock.yaml` | Hai PR cùng đổi phụ thuộc | ❌ Không | CHARTER mục 7 đã chốt: làn `integration` tạo lại lockfile. Không giải tay |
| `ops/labels.json` | Hai PR cùng thêm nhãn | ❌ Không (JSON, không phải một-dòng-một-bản-ghi) | Hiếm, và diff nhỏ. Giải tay, giữ cả hai nhãn |

**Điểm chung của cột phải:** không chỗ nào chữa được bằng "cẩn thận hơn". Hoặc đổi hình dạng file cho git tự giải được, hoặc **nhận trước một định danh** để hai worker không nhắm vào cùng một dòng. Cẩn thận không phải là một cơ chế.

### Còn một tầng nữa, và nó cần chủ dự án

Union làm xung đột log biến mất, nhưng nó không đổi **hình dạng** file: vẫn là một file cho cả làn, vẫn là mọi PR ghi vào cùng một chỗ. Cách sửa tận gốc là **một file cho mỗi mục** — `ops/logs/<lane>/<id>.jsonl` — lúc đó hai PR không bao giờ chạm cùng một file, không cần union, không cần luật nào.

Cách đó **chạm vùng bảo vệ**: bất biến I8 trong CHARTER mục 3 viết thẳng đường dẫn `ops/logs/<lane>.jsonl`, và CHARTER mục 7 viết "backlog và log tách theo làn". Sửa CHARTER luôn là quyết định `irreversible` (CLAUDE.md mục 14), nên nó đi bằng một issue `🤖 [QĐ]` chứ không đi kèm mục này.

Điểm đáng lưu ý về thời điểm: `kernel/src/log.ts` nhận đường dẫn làm tham số, và bên đọc **chưa tồn tại** (`P-005` còn `ready`). Nghĩa là đổi bây giờ gần như miễn phí, và mỗi tuần chờ thì đắt thêm.

### Cập nhật 2026-09-21 · `merge=union` KHÔNG cứu được lần vận hành thật đầu tiên — giả định G17 `sai`

⚠️ **Union chỉ cứu lúc gộp bằng `git` trong phiên, và chỉ khi nhánh đã mang sẵn luật. Nó không cứu trạng thái `mergeable` mà GitHub tính.** Đừng coi `.gitattributes` là thứ làm xung đột log biến mất.

**Chuyện đã xảy ra:** `.gitattributes` lên `main` khi PR #13 merge. Ngay sau đó PR #11 **vẫn** báo xung đột ở `ops/logs/platform.jsonl` trên trang PR, và `git merge origin/main` trong phiên cũng **vẫn** sinh dấu xung đột ở đúng file đó.

**Nguyên nhân, tách ra bằng hai lần thử có đối chứng:**

| Lần thử | Nhánh có `.gitattributes` lúc **bắt đầu** gộp? | Kết quả |
|---|---|---|
| 1 — tái hiện đúng PR #11: nhánh tách ra trước, `main` mang luật vào cùng lần gộp | **Không** | **CONFLICT** |
| 2 — cùng repo, chỉ khác: lấy `.gitattributes` vào nhánh trước rồi mới gộp | **Có** | Merge sạch, giữ cả hai dòng |

**Git đọc `.gitattributes` của nhánh đích ở trạng thái TRƯỚC lần gộp.** Một luật merge do `main` mang tới **không tự áp cho chính lần gộp mang nó tới**. Mọi nhánh mở ra trước PR #13 vì thế phải chịu đúng một lần giải tay; từ lần gộp sau thì luật mới có tác dụng.

**Một chỗ phải nói cho đúng:** quan sát ở PR #11 **không** chứng minh được GitHub bỏ qua `.gitattributes`. Ở tình huống đó git phía dưới cũng xung đột thật, nên GitHub báo xung đột là **đúng**. Câu hỏi về GitHub chỉ trả lời được bằng hai PR mà **cả hai đã mang sẵn** luật — và cặp đó **đã xuất hiện** ngày 2026-09-22: câu trả lời là **không**, ghi ở **KF-009** dưới, mục `VF-G17` đã chốt.

**Vì sao hai lần thử của `P-015` bỏ sót:** cả hai đều dựng ở **trạng thái sau cùng**, nơi luật đã nằm sẵn ở commit gốc. Không lần nào dựng ở trạng thái mà lỗi thật sẽ xảy ra. Đây là bài học vượt ra ngoài mục này: *"kiểm bằng chạy thật" chưa đủ — bài thử phải tái hiện đúng **điều kiện đầu vào**, và điều kiện dễ bỏ sót nhất là thứ tự thời gian: ai có gì, vào lúc nào.*

**Dự phòng đã chuyển sang, không còn là ghi chú:** union giữ lại vì nó vẫn cứu được các lần gộp sau — không mất gì. Nhưng cơ chế chính chuyển sang mục **`P-016`**: routine integrator tự gộp `main` vào mọi PR đang mở bị xung đột mà nó giải được, chạy `pnpm check`, rồi push. Giải xung đột thành việc của máy.

**Cập nhật 2026-09-21 (tiếp) · Cơ chế của `P-016` đã có, dạng tool chứ không phải lời:** `ops/scripts/integrator-resolve.ts` đối chiếu bằng `git diff --numstat` với tổ tiên chung ở cả hai bên trước khi quyết — đúng "đối chiếu, không đoán" của KF-002 — rồi giải bằng `git merge-file --union` cho MỌI file đủ điều kiện, không chỉ file đã khai `merge=union`. Nhờ vậy lỗ hổng của G17 (attribute không tự áp cho chính lần gộp mang nó tới) không còn quan trọng: tool không phụ thuộc `.gitattributes` để quyết định giải hay không. Còn treo: nhịp chạy mỗi giờ của routine `crux-integrator` cần chủ dự án tự đổi lịch ở `claude.ai/code/routines` (agent không đổi được lịch một routine đã tạo).

**Cập nhật 2026-09-21 (mục `I-004`) · Một loại file mà union là SAI, và vì sao:** `pnpm-lock.yaml`. Union chỉ đúng khi mỗi dòng độc lập và thứ tự dòng không mang ý nghĩa — lockfile không thoả cả hai: nó là YAML có cấu trúc, và là **file dẫn xuất** của các `package.json`. Ghép dòng của hai bên cho ra file *merge được mà vẫn hỏng* (nhóm lỗi Z): khoá lặp hoặc thụt lề sai, không gì đỏ cho tới khi `pnpm install --frozen-lockfile` chạy ở một máy khác. Thêm vào đó, xung đột lockfile thật gần như luôn có **sửa dòng ở cả hai bên** (một phiên bản đổi chỗ), nên luật "thuần cộng thêm" của `integrator-resolve.ts` luôn trả `aborted-ineligible` — PR nằm chờ người, đúng thứ `P-016` sinh ra để xoá. Cách đúng là **tạo lại** từ manifest của cây vừa gộp: `ops/scripts/integrator-lockfile.ts` (CHARTER mục 7 — lockfile do làn `integration` tạo lại).

---

## KF-006 · Mô tả nhãn dài quá 100 ký tự làm đỏ **bước đầu tiên** của job gắn nhãn `owner-merge`

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì hệ quả của nó không tỉ lệ với nguyên nhân: một ký tự thừa trong một file JSON làm thủng đường thực thi bất biến **I4**.
- **Chữ ký:**
  ```
  HTTP 422: Validation Failed (https://api.github.com/repos/<owner>/<repo>/labels)
  description is too long (maximum is 100 characters)
  Label.name already exists
  ```
  ở bước "Bảo đảm nhãn CI dùng đã tồn tại" của job `protected-area`.
- **Bằng chứng:** `ci` run trên PR #20, 2026-09-21. Job `protected-area` đỏ sau **5 giây**, trước khi chạm tới dòng nào của PR.
- **Nguyên nhân gốc:** GitHub giới hạn mô tả nhãn ở **100 ký tự**. `D-C06` viết lại mô tả của bảy nhãn cho khớp luật mới, và sáu trong số đó vượt giới hạn — dài nhất là `owner-merge` với 193 ký tự. Giới hạn này không có ở đâu trong repo, nên không có gì để mà đối chiếu.

  Dòng thứ hai của thông báo lỗi (`Label.name already exists`) là **nhiễu**: `--force` xử lý được trường hợp đó. Chỉ dòng thứ nhất là lỗi thật. Đọc nhầm dòng thứ hai sẽ dẫn tới sửa nhầm chỗ.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** tạo nhãn là bước **đầu tiên** của `protected-area`, và `protected-area` là job gắn nhãn `owner-merge`. Job đỏ ở dòng đầu nghĩa là **PR chạm vùng bảo vệ không được gắn nhãn** — đúng lỗ hổng mà rà soát **Z8** mô tả. Ở đây nó lộ ra vì job đỏ; nếu bước tạo nhãn từng được viết với `|| true` thì nó đã im lặng.

  Giới hạn đếm **ký tự**, không phải byte: mô tả tiếng Việt có dấu tốn nhiều byte hơn ký tự, và nhãn `parked` (86 ký tự, hơn 100 byte) đã sync thành công ở `labels` run #2. Nhầm chỗ này sẽ sinh ra một luật chặt quá mức và ép viết mô tả cụt.
- **Đã sửa ở đâu:** `ops/labels.json` — bảy mô tả viết lại, dài nhất còn 91 ký tự.
- **Máy chặn từ nay:** `ops/test/labels.test.ts`, nằm trong `pnpm test` nên `pnpm check` chặn trước khi PR tới GitHub. Năm bài kiểm: độ dài ≤ 100, `name` và `color` hợp lệ, không trùng tên, đủ năm nhãn mà `ci.yml` tự tạo, và `ci.yml` tạo đúng những nhãn nó gắn — bài cuối bắt trường hợp thêm một nhãn mới vào `ci.yml` mà quên thêm vào vòng lặp tạo nhãn.

---

## KF-007 · `git` gộp `pnpm-lock.yaml` **sạch**, và bản gộp sạch đó vẫn hỏng

- **Lần gặp:** 1 — ghi ngay từ lần đầu, vì nó chưa từng xảy ra trên `main` mà đã **dựng lại được bằng chạy thật**, và chữ ký của nó là chữ ký mà chính `pnpm` đoán sai nguyên nhân (xem dưới).
- **Chữ ký:**
  ```
  ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  Broken lockfile: no entry for '<gói>@<phiên bản>' in pnpm-lock.yaml
  This issue is probably caused by a badly resolved merge conflict.
  ```
  ở bước cài đặt của CI, trên một PR mà integrator vừa báo "gộp sạch, `pnpm check` xanh, đã push".
- **Bằng chứng:** `ops/test/integrator-clean-merge-lockfile.test.ts`, bài kiểm đầu tiên — dựng git repo thật, gọi `pnpm` thật, không gọi mạng. Một bên bỏ phụ thuộc cuối cùng còn dùng một gói (khối `packages:` của gói đó biến mất), bên kia thêm phụ thuộc vào đúng gói đó ở một gói khác trong workspace (chỉ khối `importers` đổi). Hai vùng cách nhau xa hơn ba dòng ngữ cảnh của git, nên git áp cả hai hunk và **gộp sạch**.
- **Nguyên nhân gốc:** `git` ghép lockfile **theo dòng** và không hiểu YAML, còn `pnpm-lock.yaml` là file **dẫn xuất** có ràng buộc giữa các vùng cách xa nhau: `importers` trỏ tới phép phân giải nằm trong `packages:`. "Không xung đột" chỉ nói hai hunk không chồng lên nhau, nó không nói kết quả còn đúng. `I-004` đã chặn ca lockfile **xung đột**; ca này là ca **không** xung đột, nên nó đi thẳng qua.

  Thứ làm nó thành nhóm Z: `pnpm check` ở máy **không** chạy `pnpm install --frozen-lockfile` — chỉ CI chạy. Integrator vì thế báo xanh thật lòng rồi push một PR chắc chắn đỏ.

  Câu `This issue is probably caused by a badly resolved merge conflict` của pnpm cũng đánh lạc hướng: **không có** xung đột nào để mà giải sai. Đọc theo nghĩa đen sẽ đi tìm dấu `<<<<<<<` không tồn tại.
- **Đo được thêm, và nó đổi cách sửa:** hai cổng KHÔNG bắt cùng một thứ. Trên đúng cây gộp đó, `pnpm install --lockfile-only --frozen-lockfile` **xanh**, mã 0; `pnpm install --frozen-lockfile` **đỏ**. Cổng rẻ chỉ đối chiếu specifier của `importers` với manifest, không đi hỏi từng phép phân giải có thật trong `packages:` hay không. Cổng cuối của `regenerateLockfile` (`I-004`) là cổng rẻ đó, nên một mình nó không đủ cho ca này.
- **Đã sửa ở đâu:** `ops/scripts/integrator-resolve.ts` — hàm `guardLockfileAfterMerge`, chạy ở **mọi** đường gộp có chạm lockfile (cả `clean` lẫn union), **trước** khi commit vì bản mồi để tạo lại nằm ở `MERGE_HEAD`. Ba bước: kiểm → tạo lại bằng `ops/scripts/integrator-lockfile.ts` → kiểm lại. Còn đỏ sau khi tạo lại thì huỷ gộp và trả `aborted-ineligible` — không bao giờ push một lockfile chưa qua cổng.
- **Máy chặn từ nay:** `ops/test/integrator-clean-merge-lockfile.test.ts`, nằm trong `pnpm test` nên `pnpm check` chặn trước khi PR tới GitHub. Sáu bài kiểm: ca hỏng tái hiện được (đỏ nếu ngày nào git hoặc pnpm đổi hành vi tới mức không tái hiện được nữa — lúc đó cơ chế nên được gỡ, không giữ vì quán tính); gộp sạch có chạm lockfile thì tạo lại, kiểm lại rồi mới commit; cổng vẫn đỏ sau khi tạo lại thì huỷ gộp và không commit gì; cổng cũng chạy ở **đường union** khi lockfile gộp sạch mà một file khác vướng; lần gộp **xoá** lockfile thì không cài thật; và gộp **không** chạm lockfile thì không gọi `pnpm` lần nào — cổng là một lần cài thật, không được trả giá đó ở mọi lần gộp. Đã kiểm bằng đột biến, từng bài một: bỏ `guardLockfileAfterMerge` thì hai bài đỏ, bỏ lời gọi ở đường union thì bài union đỏ, bỏ phép kiểm "lockfile còn tồn tại" thì bài xoá đỏ.
- **Một cái bẫy con, tìm ra ở vòng soát chéo và đáng ghi riêng:** cổng là **cài thật**, mà `pnpm install` **không thấy lockfile** thì tự sinh một bản mới rồi thoát 0. Chạy cổng ở lần gộp mà một bên vừa xoá `pnpm-lock.yaml` vì thế **hồi sinh đúng file vừa bị xoá** và để lại cây bẩn — và lượt gộp kế tiếp ra `aborted-error` "cây làm việc không sạch". Hình dạng chung: **một cổng "chỉ đọc" hoá ra có ghi**; trước khi đặt một lệnh cài đặt vào vai trò kiểm tra, hỏi nó làm gì khi đầu vào vắng mặt.

## KF-008 · `if:` bỏ qua một step biến "CI xanh" thành "CI xanh SAI"

- **Lần gặp:** 1 — bằng chứng trực tiếp: `ci` run #1 và #2 trên PR #7 (một PR mang nhãn `fix`) cho job `fix-has-test` kết luận `success` với bước kiểm thật ở trạng thái `skipped`.
- **Chữ ký:** một step mang `if: contains(github.event.pull_request.labels.*.name, '<nhãn>')` mà điều kiện không khớp tại lúc `github.event` được chụp — job vẫn `success`, không job nào đỏ, không dòng lỗi nào được in. Đây là loại hỏng KHÔNG CÓ CHỮ KÝ: nhìn từ ngoài một PR đã "qua kiểm" giống hệt một PR chưa từng được kiểm.
- **Nguyên nhân gốc:** hai lỗi cộng dồn. (1) `github.event.pull_request.labels` là ảnh chụp tại thời điểm workflow run BẮT ĐẦU — nhãn gắn sau đó (thứ tự phổ biến nhất: agent mở PR nháp rồi mới gắn `fix`) không có trong ảnh chụp, dù nhãn đã thật sự tồn tại trên PR khi job chạy. (2) `on.pull_request.types` mặc định (`opened, synchronize, reopened`) không có `labeled`/`unlabeled`, nên việc gắn nhãn muộn còn không kích hoạt lại CI để có cơ hội đọc lại — job cũ với ảnh chụp cũ vẫn đứng nguyên là lần kiểm cuối cùng. Gốc sâu hơn: dùng `if:` cấp step để BỎ QUA việc kiểm thay vì để step luôn chạy và tự quyết định, nên "chưa đủ điều kiện kiểm" và "đã kiểm và qua" cùng cho ra một kết luận `success`/`skipped` — hai trạng thái khác nhau bị nén vào chung một tín hiệu.
- **Đã sửa ở đâu:** `ops/workflows/ci.yml` (mục `P-009`) — thêm `labeled`, `unlabeled` vào `on.pull_request.types`; job `fix-has-test` đọc nhãn hiện tại qua `gh api` thay vì `github.event`, và step kiểm test không còn `if:` cấp step — nó LUÔN chạy, tự in "không có nhãn fix, bỏ qua" rồi thoát 0 khi không cần kiểm, thay vì để GitHub hiển thị `skipped`. `ops/invariants.merge-gate.ts` cũng không còn tin `ciConclusion` tổng của cả run: nó đọc riêng kết luận của check run `fix-has-test` trên đúng `headSha` (`ops/workflows/automerge.yml` truyền vào qua `fixHasTestConclusion`), và PR mang nhãn `fix` mà giá trị đó khác `success` (kể cả `skipped` hay không tìm thấy) thì bị chặn merge.
- **Máy chặn từ nay:** `ops/test/invariants-merge-gate.test.ts` — bốn bài kiểm mục `P-009`: nhãn `fix` + `fixHasTestConclusion: 'skipped'` → `skip`; `null` (không tìm thấy check run) → `skip`; `'failure'` → `skip`; `'success'` → `merge`. Cộng một bài dương xác nhận PR không mang nhãn `fix` thì trường này không cản gì kể cả khi `null`. Hình dạng chung đáng nhớ cho lần sau: **một step dùng `if:` để bỏ qua việc kiểm là một chỗ khả nghi** — hỏi trước "bỏ qua ở đây trông có giống với `success` không, và có cách nào phân biệt hai ca đó bằng máy không".
- **Hai cái bẫy con, tìm ra ở vòng soát chéo của chính PR sửa mục này — không lọt vào `main`, nhưng đáng ghi vì cả hai đều là loại "im lặng" giống hệt lỗi đang sửa:**
  1. **Bản nháp đầu tiên thêm một khối `permissions:` RIÊNG cho job `fix-has-test`** (`contents`, `pull-requests`) tưởng là "khai rõ ràng hơn", nhưng một khối `permissions:` cấp JOB **thay thế toàn bộ** khối cấp workflow cho đúng job đó, không cộng thêm (đúng luật KF-003) — bản nháp quên `contents: read` nên `actions/checkout` lẽ ra sẽ hỏng với đúng lỗi 404 gây hiểu lầm mà KF-003 đã tả, trên **mọi** PR chứ không riêng PR `fix`. `pnpm lint:workflows` KHÔNG bắt được: `declaredPermissions()` trong `ops/scripts/check-workflows.ts` chỉ đọc khối `permissions:` ở **cột 0** (cấp workflow), chưa đọc khối lồng trong một job — đúng lỗ hổng mà chính luật này sinh ra để bịt lại chưa phủ hết. Sửa bằng cách đơn giản nhất: **bỏ hẳn** khối `permissions:` cấp job đó — khối cấp workflow đã sẵn `contents: read` + `pull-requests: write` (thoả cả `pull-requests: read`), không cần khai gì thêm. Không mở rộng `check-workflows.ts` để bắt lớp này (đáng một mục backlog riêng của làn `platform`, không phải việc của `P-009`) — chọn không tạo ra cái bẫy thay vì xây thêm máy bắt bẫy.
  2. **`ops/workflows/automerge.yml` gán thẳng kết quả `gh api --jq` (chuỗi thô, không có ngoặc kép) vào `--argjson`** — `--argjson` đòi JSON hợp lệ, mà `success`/`failure`/`skipped` là từ trần trụi, không phải JSON. Dưới `set -euo pipefail`, `jq -n --argjson x success ...` thoát mã khác 0 ngay khi job đó thật sự đã chạy xong (tức gần như mọi lần) — vỡ **toàn bộ** vòng lặp xét PR của `automerge.yml`, không riêng PR mang nhãn `fix`. Sửa: dùng `--arg` (nhận chuỗi thô) rồi tự chuyển chữ `"null"` thành `null` bằng một biểu thức `if` trong chính bộ lọc `jq`, đúng quy ước `--arg gate "$GATE"` mà file này đã dùng ở mọi chỗ khác — không có tiền lệ dùng `--argjson` cho một giá trị đọc trực tiếp từ `gh api --jq` (giá trị đó luôn là chuỗi thô, không phải JSON).

  Bài học chung của cả hai: sửa một cổng đã có (`decideMerge`, `automerge.yml`) tưởng là an toàn hơn viết mới, nhưng thêm dữ liệu vào một đường ống có sẵn vẫn phải soát lại đúng quy ước của đường ống đó (khối `permissions` cộng dồn theo cấp nào; `--arg` hay `--argjson` cho từng loại giá trị) — quen tay với "trông giống code xung quanh" không thay được việc đọc ngữ nghĩa thật.

---

## KF-009 · GitHub báo PR `dirty` trong khi `git` ở phía dưới gộp **sạch** — `merge=union` không áp ở phía GitHub

> Số **KF-009** chứ không phải KF-008: PR `#70` đang mở đã nhận **KF-008**. Nhận mã trước khi viết là cách hai worker không cùng lấy một số (cùng quy ước với các mã `G` trong `docs/assumptions.md`).

- **Lần gặp:** nhiều — mọi lần `mergeable_state: dirty` mà integrator đo lại thấy `EXIT=0` đều là ca này. Lần đo tách bạch được nguyên nhân: lượt `crux-integrator` 2026-09-22 02:05 giờ VN, PR `#56` và `#65`.
- **Chữ ký:** GitHub API trả `mergeable_state: "dirty"` cho một PR, `automerge.yml` vì thế không merge được nó, mà `git merge-tree --write-tree origin/<nhánh> origin/main` ở máy trả `EXIT=0` "gộp sạch" — và file duy nhất mà hai bên cùng chạm là một file `.jsonl` đã khai `merge=union` trong `.gitattributes`.
- **Nguyên nhân gốc:** `.gitattributes` khai `ops/logs/**/*.jsonl merge=union` (KF-005). `git` ở máy đọc luật đó và ghép cả hai bên; **phép tính `mergeable` của GitHub thì không**. Hai bên cùng thêm dòng vào cuối `ops/logs/platform/P-016.jsonl` vì thế là "sạch" ở một phía và "xung đột" ở phía kia. Không có gì hỏng trong nội dung PR — cái hỏng là **hai phép đo khác nhau trên cùng một câu hỏi**, và lớp tự merge chỉ nghe một phía.
- **Đo được, không suy luận** (2026-09-22, lượt integrator): `#56` và `#65` đều `dirty` trên GitHub và đều `EXIT=0` ở máy. Chạy lại đúng phép đo đó sau khi **tắt** luật union — ghi `ops/logs/**/*.jsonl -merge` vào `.git/info/attributes`, vốn thắng `.gitattributes` trong cây — thì cả hai lập tức `EXIT=1` với `CONFLICT (content) in ops/logs/platform/P-016.jsonl`. Bật/tắt đúng một biến, kết quả lật đúng theo nó.
- **Đo lại độc lập lần thứ hai** (2026-09-21 19:38Z, lượt `crux-worker-1`, mục `VF-G17`): `#75` (`claude/platform/P-007`) ra `mergeable_state: "dirty"` trong khi `git merge-tree --write-tree` ở máy trả `EXIT=0`, và bật/tắt union lật kết quả y như trên. Lần này bịt nốt chỗ hở duy nhất của lần đầu: `base.sha` của `#75` **đúng bằng** `main` tại lúc đo (`296869b`), nên `dirty` không thể là trạng thái cũ GitHub chưa tính lại; và nhánh với `main` cùng chạm **đúng một** file — `ops/logs/platform/P-016.jsonl` — nên không còn biến nào khác giải thích được chênh lệch. Phép đo chỉ đọc: không gộp, không push gì lên `#75`.
- **Đối chứng chặt hơn, để không ai mở lại câu hỏi vì một dòng cảnh báo:** nhánh đối chứng ở trên dùng `-merge`, vốn là *unset* — git rơi về trình merge nhị phân và **luôn** báo xung đột, kèm `warning: Cannot merge binary files`, dù file này là văn bản thuần (0 byte NUL). Nên phép đo được chạy lại với `ops/logs/**/*.jsonl merge=text`, tức trình merge văn bản thường: **`EXIT=1`, `CONFLICT (content)`, không cảnh báo nhị phân**. Kết luận không đổi — chênh lệch giữa hai phía đúng là do luật `merge=union`, không phải do cách tắt luật.
- **Đây là câu trả lời của `VF-G17`** (`ops/lanes/verify/backlog.md`), câu hỏi "GitHub có dùng `.gitattributes` khi tự tính `mergeable` không": **không**. Mục đó đã **chốt** ngày 2026-09-22 sau lần đo thứ hai, và `docs/assumptions.md` mục `G17` không còn câu hỏi nào treo. Ghi chú trong chính `.gitattributes` ("chưa được chứng minh là có ảnh hưởng tới trạng thái `mergeable` GitHub tự tính") nay có bằng chứng, và nó ngả về phía xấu. Sổ giả định `G17` đã ở trạng thái **`sai`** và đã chuyển dự phòng, nên kết luận này **không** làm đổi trạng thái giả định nào — nó siết chặt thêm lý do dự phòng phải tồn tại.
- **Đã sửa ở đâu:** không phải sửa — dự phòng đã có sẵn và đang chạy đúng: mục `P-016`, bước 0 của phụ lục P3. Integrator gộp `main` vào nhánh PR, `git` áp union ở phía có áp union, commit gộp mới làm GitHub tính lại và PR hết `dirty`. Điều KF này thêm là **vì sao** bước đó không bao giờ thừa: `.gitattributes` một mình không đủ, và sẽ không bao giờ đủ.
- **Máy chặn từ nay:** không chặn được ở phía ta — hành vi nằm ở phía GitHub. Thứ canh nó là bước 0 của P3, chạy ở đầu **mọi** lượt worker và một lần mỗi lượt integrator, cộng dòng log bắt buộc (bất biến I8). Hệ quả phải nhớ khi đọc bản tin: một PR `automerge-delayed` bị ca này chạm sẽ **đặt lại đồng hồ 12 giờ** mỗi lần integrator gộp cho nó (CHARTER 3.3) — chậm là giá của việc merge được, không phải dấu hiệu hỏng.

**Cập nhật 2026-09-21 21:39Z (lượt `crux-worker-1`, mục `P-023`) · chính DÒNG LOG của bước 0 là thứ sinh ra vòng lặp, và nó đã được cắt.**

Điều bản ghi trên chưa nói ra: dòng log mà bước 0 bắt buộc phải ghi đi vào `ops/logs/platform/P-016.jsonl` — **một file dùng chung cho mọi lượt của mọi routine**. Ghép với hành vi GitHub ở trên, nó thành một vòng tự nuôi:

1. Một lượt bước 0 giải xong N PR và ghi một dòng vào file dùng chung.
2. PR mang dòng đó vào `main`.
3. Mọi PR đang mở có dòng riêng trong file ấy lập tức `dirty` phía GitHub.
4. Lượt sau lại giải, lại ghi một dòng, lại khoá.

**Đo được, không suy:** lượt `crux-integrator` 04:05 giờ VN 2026-09-22 thấy **7 PR** cùng đứng lại một lúc, cả 7 ở đúng file này, nguyên nhân là **một dòng duy nhất** mà `bfccc8c` mang tới. Lượt `crux-worker-1` 21:39Z ngay sau đó — sau khi PR ghi log của lượt giải trước vào `main` — thấy **8 PR** (#39, #49, #56, #65, #70, #71, #79, #81), tất cả xung đột ở đúng một file, tất cả `EXIT=0` ở phép đo có union và `EXIT=1` ở phép đo tắt union. Quy mô **tăng** sau mỗi lượt giải, vì mỗi lượt giải đẻ thêm một dòng.

**Nguyên nhân gốc thật sự, tách khỏi hành vi GitHub:** `D-C04` tách log tới mức **mục**, nhưng bước 0 không phải một mục — nó là **một lượt chạy**, nên mọi lượt dồn vào mã mục `P-016`. Tức là bước 0 chưa từng nằm trong phạm vi mà `D-C04` đã sửa.

**Đã sửa:** một lượt chạy, một file — `ops/logs/integration/step0-<YYYY-MM-DDTHHMMSSZ>-<routine>.jsonl`, sinh ra bởi đúng một hàm của kernel (`step0LogPath` / `step0LogRef`), không routine nào tự ghép. Hai lượt không bao giờ chạm cùng một file, nên không còn gì để xung đột — cùng lập luận `D-C04` dùng cho mục, áp cho lượt chạy. Dòng cũ trong `P-016.jsonl` ở lại nguyên (append-only); `readRunLogs` gom theo thư mục nên bên đọc tự thấy cả hai chỗ.

**Bằng chứng bằng chạy thật, không bằng lập luận** (`ops/test/step0-log-path.test.ts`): dựng repo git thật mang sẵn `.gitattributes` union, hai nhánh cùng mang một dòng bước 0, một bên vào `main` trước, rồi đo `git merge-tree --write-tree` ở **cả hai** chế độ.

| Hình dạng | union BẬT (git ở máy) | union TẮT (mô phỏng GitHub) |
|---|---|---|
| **Trước** — file dùng chung mang mã mục | `EXIT=0` | **`EXIT=1`**, `CONFLICT (content) in ops/logs/platform/P-016.jsonl` |
| **Sau** — một file cho mỗi lượt | `EXIT=0` | **`EXIT=0`** |

Ca "trước" là **ca âm bắt buộc**, không phải phần thừa: bỏ nó đi thì bài kiểm chỉ còn nói "hai file khác nhau thì không xung đột" — đúng nhưng rỗng, và nó xanh cả khi ai đó lặng lẽ đưa dòng bước 0 quay về file dùng chung. Đã phá thật để kiểm: đổi hình dạng "sau" về file dùng chung → **đúng bài đó đỏ**.

**Một lớp chặn nữa, cho chiều hỏng còn lại:** một bên đọc neo vào tên file cố định sẽ hỏng im lặng ở lượt đầu tiên tên file đổi. `ops/test/step0-log-path.test.ts` quét `ops/scripts/**` và `kernel/src/**` và đỏ nếu file code nào nhắc tới một đường dẫn log bước 0 cố định.

---

## KF-010 · Commit gộp của bước 0 ra đời không có trailer, và bước bù bằng tay đã hụt

- **Lần gặp:** 2 (lần 1: lượt worker `crux-worker-1`, 2026-09-22 06:39 giờ VN — cả 9 commit gộp cùng lượt. Lần 2: lượt `crux-integrator` 2026-09-22 11:0x giờ VN, PR `#39`, commit gộp `c2388bf` — lần đầu **sau khi** `P-024` đã vào `main`)
- **Chữ ký:** một commit trên nhánh `claude/` có thân đúng một dòng `Gộp origin/main (integrator, không xung đột)`; `git log -1 --format=%B <sha> | grep -c 'Claude-Session'` trả `0`. Đo nhanh cả loạt: `for b in <nhánh>; do git log -1 --format=%B origin/$b | grep -c 'Claude-Session'; done`.
- **Nguyên nhân gốc:** `ops/scripts/integrator-resolve.ts` tạo commit gộp bằng `git merge` bên trong tool, nên commit sinh ra với thông điệp mặc định của tool — không trailer. Việc thêm trailer nằm **ngoài** tool, ở trí nhớ của routine đang chạy bước 0. Một bước bắt buộc mà chỗ thực thi duy nhất là trí nhớ thì sẽ hụt; đây là lần hụt đầu tiên đo được. Không phải lỗi nền tảng ghi hỏng trailer — chính lượt đó, commit **do worker tự tạo** (`0c78618`) vẫn có đủ hai trailer.
- **Vì sao không gì đỏ:** job `trailer-warn` đặt `continue-on-error: true` — cố ý, theo CHARTER mục 4 (luật cứng về trailer sẽ chặn toàn bộ công việc nếu nền tảng đổi cách ghi). Nên chín commit thiếu trailer đi qua CI xanh trơn. Đúng nhóm **Z**: hỏng mà mọi chỉ báo đều xanh.
- **Thiệt hại thật, không giả định:** phép kiểm của `VF-G14` là đọc job `trailer-warn` trên các PR do routine mở trong một tuần. Chín commit này nằm trong cửa sổ mẫu và trông y như tín hiệu "nền tảng không ghi trailer", trong khi nguyên nhân khác hẳn. Không loại chúng ra thì `G14` bị kết luận sai.
- **Không sửa lại được:** tám trong chín nhánh thuộc PR của worker khác, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác. Amend lẻ nhánh còn lại chỉ làm mẫu thêm lệch. Dòng đính chính trong `ops/logs/platform/P-016.jsonl` là bản ghi duy nhất.
- **Hai nhánh nguyên nhân, đừng quy nhầm một:** (a) bản script chạy là bản trên nhánh PR, chưa mang `P-024` — nhánh trên; (b) biến môi trường `CLAUDE_SESSION_URL` chưa được đặt ở đầu lượt routine, đây là tiêu chí `⬜` còn treo của `P-024` (`ops/lanes/platform/backlog.md`). Kể cả khi nhánh đã mang script mới, (b) một mình vẫn làm `Claude-Session` vắng — khác (a) ở chỗ (b) **có** báo ra bằng `sessionTrailerMissing`. `VF-G14` phải phân biệt hai nhánh này, nếu không nó quy một triệu chứng cho sai nguyên nhân.
- **Đã sửa ở đâu:** mục `P-024` (`ops/lanes/platform/backlog.md`) — chuyển việc ghi trailer **vào trong** `integrator-resolve.ts`, bỏ hẳn bước bù tay. Sửa chỗ sinh ra commit, không vá từng lượt chạy.
- **Lần gặp thứ hai cho thấy `P-024` chưa bịt hết, và bịt hụt ở chỗ không ai nhìn:** `P-024` sửa đúng chỗ sinh ra commit, nhưng **bản `integrator-resolve.ts` thật sự chạy ở bước 0 là bản nằm trên nhánh PR**, không phải bản trên `main` — routine `checkout` nhánh PR rồi mới `node ops/scripts/integrator-resolve.ts`. Nhánh nào mở ra trước khi `P-024` vào `main` thì vẫn chạy bản cũ, và bản cũ không ghi trailer. Đo chứ không suy: `git show <head>:ops/scripts/integrator-resolve.ts | grep -c CLAUDE_SESSION_URL` trả `3` trên `origin/main` (09c91bb) và `0` trên **cả 11** đầu nhánh PR đang mở **tại thời điểm đo, tức TRƯỚC lần gộp của lượt đó** — đo lại sau khi gộp thì cả 11 ra `3`, vì chính lần gộp mang `P-024` sang nhánh; con số `0` chỉ đúng với mốc thời gian đó (`#39 #49 #56 #62 #65 #70 #71 #79 #81 #84 #89`). Đây đúng hình dạng **G17** ở một chỗ khác: *một luật nằm trong repo không tự áp cho chính lần gộp mang nó tới*. Hệ quả tệ nhất là im lặng: bản cũ không có trường `sessionTrailerMissing`, nên kết quả trả về là `{"outcome":"clean","files":[]}` — **không có dấu hiệu nào** báo trailer đã hụt. Ba test của `P-024` không bắt được vì chúng chạy bản trên cây làm việc, tức bản mới.
- **Cầu tạm, cho tới khi mọi nhánh đang mở đã gộp `main` ít nhất một lần:** bước 0 **đọc lại** commit gộp ngay sau khi tool trả về (`git log -1 --format='%(trailers:key=Claude-Session)'`) và `git commit --amend` thêm đủ hai trailer **trước khi push** nếu trống. Không tin kết quả của tool, vì bản cũ không biết mình thiếu. Lượt 11:0x giờ VN làm đúng vậy cho 10 PR còn lại và đo lại trên đầu nhánh thật sau khi push: 2/2 dòng trailer ở cả mười. Cầu tạm tự hết vai khi nhánh đã mang `P-024`.
- **Không sửa lại được, lần hai cũng vậy:** `c2388bf` của `#39` đã push trước khi phát hiện. `#39` là nhánh của làn `visual`, mà `CLAUDE.md` mục 2 cấm force-push lên nhánh của người khác, nên commit đó ở lại thiếu trailer và `trailer-warn` sẽ cảnh báo đúng. Cũng như lần một, mẫu của `VF-G14` phải loại `c2388bf` ra: nó là ca này, không phải tín hiệu "nền tảng không ghi trailer".
- **Máy chặn từ nay:** `ops/test/integrator-resolve.test.ts` — ba test của mục `P-024` gọi `resolveAdditiveMerge` trên cây git dựng sẵn rồi đọc `git log -1 --format=%B` của commit gộp: "commit gộp SẠCH mang Co-Authored-By trung tính model, và Claude-Session khi có URL phiên", "commit gộp UNION (resolved) cũng mang đủ hai trailer", "thiếu URL phiên: commit vẫn mang Co-Authored-By, và kết quả NÓI RA chỗ thiếu". Đo được là đỏ thật khi gỡ phần ghi trailer (11 pass → 8 pass, 3 fail). Việc ghi trailer nay nằm TRONG `ops/scripts/integrator-resolve.ts` (`trailerMessageArg`, hằng `CO_AUTHOR_TRAILER` trung tính model, đọc URL phiên từ biến môi trường `CLAUDE_SESSION_URL`), không còn ở bước bù bằng tay của routine. **Nhưng ba test đó KHÔNG phủ được lần gặp thứ hai**: chúng chạy bản trên cây làm việc, tức bản mới, trong khi ca hỏng là bước 0 chạy bản CŨ trên nhánh PR. Cổng thật sự cho ca đó là mục **`P-026`** — chạy bản của `main`, cộng một cổng đọc lại trailer và **từ chối push** khi trống, nằm trong code chứ không trong văn bản prompt. Tới khi `P-026` xong, KF này vẫn mở.

## KF-011 · Cửa `automerge-delayed` không bao giờ tới hạn — đồng hồ 12 giờ bị chính bước 0 đặt lại

- **Lần gặp:** 1 (đo ở lượt `crux-worker-1`, 2026-09-22 12:4x giờ VN)
- **Đối chứng phải kiểm trước khi kết luận:** câu "cửa delayed chưa bao giờ cho PR nào qua" viết trần là **sai** — `#43` đã qua. Phát biểu đúng là *máy* chưa bao giờ merge một PR delayed nào; `#43` qua được vì có người bấm, ở mốc 35 phút mà cổng 12 giờ chắc chắn còn trả `wait`. Phân biệt người với máy bằng `merged_by` (`HungQuach301` với `github-actions[bot]`), đừng bằng nhãn.
- **Chữ ký:** một PR mang nhãn `automerge-delayed`, CI xanh, `mergeable_state: clean`, mở đã nhiều hơn 12 giờ, mà `ops/invariants.merge-gate.ts` vẫn trả `{"outcome":"wait","hoursLeft":12}`. Đo nhanh cả hàng đợi: `git log --first-parent --format=%ct refs/probe/pr-<N>` rồi tìm khoảng trống lớn nhất giữa hai lần đầu nhánh đổi — dưới 12 giờ nghĩa là đồng hồ chưa từng chạy hết.
- **Nguyên nhân gốc:** `merge-gate.ts` đo 12 giờ từ `ciCompletedAt`, và có cổng `if (input.ciSha !== input.headSha) return {outcome:'skip'}` buộc lần CI đó phải thuộc **đầu nhánh hiện tại**. Bước 0 (phụ lục P3, và từ D-C06 chạy ở đầu **mọi** lượt worker theo phụ lục P1) gộp `main` vào PR rồi push. Commit mới → đầu nhánh mới → lần CI mới → đồng hồ về 0. Bước 0 chạy dày hơn 12 giờ nhiều lần, nên ngưỡng không bao giờ tới. **Không thành phần nào hỏng:** docblock của chính `merge-gate.ts` nói việc đặt lại đồng hồ là **cố ý** ("Một lần push mới vì thế đặt lại đồng hồ"). Lỗi nằm ở **vòng phản hồi** giữa nó và bước 0, không ở một file nào — nên đọc từng file riêng sẽ không bao giờ thấy.
- **Vì sao không gì đỏ:** mọi thành phần chạy **đúng luật của nó**. CI xanh, nhãn đúng, `automerge.yml` gọi `merge-gate.ts` đúng, `merge-gate.ts` trả `wait` đúng, bước 0 gộp đúng phạm vi nó được giao. Không có lỗi ở bất cứ đâu để mà đỏ — chỉ có một vòng phản hồi giữa hai cơ chế đều đúng. Đúng nhóm **Z**.
- **Thiệt hại thật, không giả định, đo 2026-09-22 05:4xZ:** 13 PR đang mở mang nhãn `automerge-delayed`. Quét **toàn bộ** 79 PR đã đóng: **0** PR delayed nào do *máy* merge. Đúng một PR delayed từng vào `main` — `#43`, mở `12:41:51Z` merge `13:16:39Z`, tức **35 phút**, xa dưới ngưỡng 12 giờ, và `merged_by: HungQuach301` (người) chứ không phải `github-actions[bot]` như PR do máy merge (đối chứng `#113`). Tức chủ dự án merge tay. PR delayed còn lại đã đóng, `#44`, đóng mà không merge. `#39` mở từ `2026-09-21T11:43Z` (18 giờ), CI xanh, 29 lần đổi đầu nhánh trong 24 giờ, khoảng trống lớn nhất **3h19m**. Chạy `ops/invariants.merge-gate.ts` trên trạng thái thật của `#39`: `{"outcome":"wait","reason":"CI xanh được 0.3 giờ, ngưỡng 12 giờ.","hoursLeft":12}`. Chỉ **1/13** PR từng có khoảng trống ≥ 12 giờ.
- **Ca `#42` — ngưỡng gần như không với tới được ngay cả khi không ai đụng vào PR:** đầu nhánh đứng yên `2026-09-21T13:11:32Z` → `2026-09-22T01:14:17Z`, tức 12h02m45s. CI xanh khoảng `13:12Z` nên ngưỡng đạt khoảng `01:12Z`; `automerge.yml` chạy `cron: '23 * * * *'`, lượt `00:23` còn sớm và tới lượt `01:23` thì đầu nhánh đã đổi hai lần. Cửa sổ sống rộng **khoảng 2 phút**, rơi đúng giữa hai lượt. Bài học: khi đồng hồ bị đặt lại liên tục, một lịch chạy **thưa** biến "hiếm khi tới hạn" thành "không bao giờ tới hạn".
- **Phản biện đã loại trừ:** "repo còn non nên chưa PR nào kịp tới hạn" — không đúng. Cửa `automerge-delayed` ra đời cùng `D-C06`, vào `main` lúc `2026-09-21T08:30:56Z`, tức **21 giờ** tại lúc đo; PR delayed cũ nhất đã mở **18 giờ**; 5/13 PR đã mở hơn 12 giờ (`#39` 18,2h · `#42` 17,6h · `#49` 16,3h · `#56` 14,6h · `#65` 12,6h). Thời gian không phải lời giải thích.
- **Vì sao đã ghi mà vẫn sót:** hệ quả "đồng hồ đặt lại" **đã** được ghi nhiều lần — mô tả PR `#85` và `#39` nói ra, phụ lục P3 bước 0c dặn phải ghi vào ghi chú, `P-026` nhắc tới trong một tiêu chí. Nhưng mọi chỗ đó ghi nó cho **một lượt**, như một khoản phí. Không chỗ nào cộng lại theo thời gian để hỏi *ngưỡng có bao giờ tới không*. Số đo một lượt vô hại; số đo tích luỹ nói rằng cửa đã đóng. **Bài học vượt ra ngoài mục này: một hệ quả được ghi đều đặn ở mức từng lượt có thể là một lỗi chưa ai nhìn thấy ở mức tổng — luôn hỏi thêm "cộng lại trong 24 giờ thì thành cái gì".**
- **Vòng tự khoá, đây là chỗ khó nhất:** `KF-009` làm GitHub báo `dirty` → `automerge` bỏ qua → bước 0 phải gộp để gỡ `dirty` → gộp làm đồng hồ về 0 → `automerge` trả `wait`. Hai lớp phòng thủ chống nhau: **không gộp thì `dirty` chặn, gộp thì đồng hồ chặn.** Bản sửa cắt vòng này là `P-023` (dòng bước 0 xuống file riêng từng lượt, hết nguyên nhân ở `KF-009`) — nó **đã xong và đang nằm trong PR `#85`**, mà `#85` mang nhãn `automerge-delayed`. Bản sửa bị chính thứ nó sửa giữ lại. Không đường nào ra bằng máy; gỡ kẹt cần một lần merge tay.
- **Đã sửa ở đâu:** mục `P-027` (`ops/lanes/platform/backlog.md`) — kèm issue `🤖 [QĐ]` **#116**, vì cả hai phương án sửa đều chạm vùng bảo vệ: (A) bước 0 đo lại bằng `git merge-tree` trước khi tin `mergeable_state` và không gộp PR mà `git` nói là sạch — phải đi cùng `P-023`, một mình không đủ; (B) đồng hồ không tính lại vì commit gộp của bước 0 — chạm `ops/invariants.merge-gate.ts`, cửa `owner-merge`, và có thể đọc thành sửa ý nghĩa bất biến I4, tức `irreversible`.
- **Phép đo đã có (lượt `crux-worker-3` 2026-09-22):** `node ops/scripts/gate-flow.ts --prs <file.json>` trả lời "cửa `automerge-delayed` có chảy không" bằng số — `longestStableHours` (khoảng trống đầu-nhánh-không-đổi dài nhất), `clockResets` (số lần đặt lại đồng hồ), `hoursShort` (số giờ còn thiếu) cho mỗi PR mang nhãn, đọc từ `git log --first-parent` trên `refs/pull/<n>/head` cộng nhãn từ đầu vào — KHÔNG đọc văn xuôi `note`. Kiểm ở `ops/test/gate-flow.test.ts`. Verdict gộp `everFlowed`/`reachedThresholdCount` cho câu trả lời một dòng. Chạy thật 2026-09-22 trên 15 PR đang mở: **14 delayed · 0 đang ở/quá ngưỡng · 1/14 (`#42`) từng có cửa sổ ≥ 12 giờ · tổng 154 lần đặt lại đồng hồ** — số tích luỹ xác nhận chữ ký. Đếm phạm vi `origin/main..refs/pull/<n>/head` (chỉ commit riêng của PR). Lưu ý phép đo: `longestStableHours` là **cận trên** (đo phần đầu-nhánh-không-đổi từ `git log`, không trừ thời gian CI), và "từng có cửa sổ ≥ ngưỡng" là điều kiện **cần chứ không đủ** để merge (`#42` đạt cửa sổ rồi vẫn trượt vì cron).
- **Bản tin nay nói đúng số giờ (mục `P-027`, tiêu chí 2 — PR `#120`):** mục "Đang chờ merge" của `digest-metrics.ts` lấy số từ `gate-flow.ts`, tức theo **đồng hồ đã bị đặt lại**. Ba chỗ dễ nói sai đã có test chặn: không đo được in `CHƯA ĐO` chứ không in `0`; PR đang xung đột **thay** số giờ bằng lời nói về xung đột (đồng hồ không chạy, CHARTER 3.3); và khi không PR nào từng đạt ngưỡng thì dòng dặn nói `⚠️ Cửa delayed hiện CHƯA CHẢY`, **không** khuyên "không làm gì thì nó tự vào `main`". Chỗ cuối là chỗ câu chữ sai gây thiệt hại trực tiếp nhất — chủ dự án đọc bản tin đúng để quyết định *không làm gì*.
- **Máy chặn từ nay:** **chưa đủ — phép đo có rồi, bản sửa cơ chế thì chưa.** Bản sửa (phương án A hoặc B của `P-027`) chờ `🤖 [QĐ] #116` vì chạm vùng bảo vệ. Tới khi có bản sửa và một bài kiểm dựng lại đúng hình dạng (PR `automerge-delayed` CI xanh + một commit gộp bước 0 → `merge-gate.ts` phải trả `merge`, kèm **ca âm** là commit có nội dung thật thì đồng hồ **phải** tính lại), KF này vẫn mở.

---

## KF-012 · Nguồn công bố tự mâu thuẫn với chính nó, và cách đọc theo mặt chữ ra số khác cách đọc theo ví dụ

- **Lần gặp:** 2 — cả hai trong một lượt của `topic/T-006`, trên hai cơ quan khác nhau.
- **Chữ ký:** một văn bản công bố chứa **cả** một câu quy tắc **lẫn** một ví dụ tính sẵn, và áp quy tắc theo đúng mặt chữ vào chính dữ liệu của ví dụ thì ra một con số **khác** con số ví dụ in ra.
- **Hai lần đã gặp:**
  - **TreasuryDirect**, trang *I bonds interest rates*: câu mở đầu ghi lãi suất tổng hợp đợt tháng 11-2025 là **4,03%**, còn khối "An example" ngay dưới lấy 0,90% và 1,67% rồi tự tính từng bước ra **4,26%**.
  - **IRS Pub 590-A**, Worksheet 1-2: câu hướng dẫn dòng 4 nói làm tròn lên tới bội số $10, còn ví dụ điền sẵn của cùng tài liệu in **$6.825** — không phải bội số của $10. Theo mặt chữ thì ô đó phải là $6.830, và khấu trừ cuối đổi theo.
- **Nguyên nhân gốc:** giả định ngầm rằng "một nguồn uy tín là **một** sự thật". Không phải: một trang hay một tài liệu là **nhiều** khẳng định được cập nhật ở **nhiều** thời điểm khác nhau. Câu tóm tắt ở đầu trang và khối ví dụ ở giữa trang có vòng đời riêng, và không ai kiểm chéo chúng với nhau. Bất biến I6 ("mọi con số hiển thị có nguồn hoặc có mô hình") nói con số phải **có** nguồn, nhưng không nói gì về việc nguồn đó có tự nhất quán không.
- **Vì sao nó đặc biệt nguy hiểm ở dự án này:** đây là **nhóm Z** — hỏng mà mọi chỉ báo đều xanh. Ca kiểm vẫn khớp, `pnpm check` vẫn xanh, `claimId` vẫn trỏ đúng một URL có thật. Chỉ con số lên video là sai, và nó sai theo cách một người xem đọc kỹ sẽ bắt được còn CI thì không bao giờ. Bằng chứng công sức của kênh nằm đúng ở chỗ này.
- **Đã sửa ở đâu — không vá sản phẩm:** luật đọc nguồn, ghi thành ba câu và áp từ `T-006` trở đi:
  1. **Ưu tiên ví dụ tính sẵn hơn câu quy tắc.** Ví dụ tính sẵn là thứ kiểm được từng bước; câu quy tắc là thứ diễn giải được nhiều cách. Khi hai thứ lệch nhau, ca kiểm cấp 1 bám ví dụ.
  2. **Mâu thuẫn được ghi vào `assumptions` của chính file mô hình**, bằng lời, kèm cả hai con số và biên độ chênh lệch — không ghi vào chỗ khác, vì Fact & Risk Pass đọc `assumptions`.
  3. **Một con số nằm trong vùng mâu thuẫn thì không được lên video** cho tới khi có nguồn thứ hai xác nhận. Mô hình vẫn dùng được cho mọi vùng khác.
- **Máy chặn từ nay:** chưa có máy chặn, và **không thể có** bằng kiểm tra tĩnh — muốn tự phát hiện thì phải đọc hiểu văn bản nguồn, tức là chính cấp kiểm 4 (`llm-assumption-check`) vốn đang chờ `platform/P-003`. Tới lúc đó, lớp chặn là con người: Fact & Risk Pass đọc `assumptions` trước khi phát hành, và mục `editorial/E-002` là chỗ luật này phải trở thành một bước có tên.

---

## KF-013 · Hai PR xanh riêng lẻ, gộp vào `main` thì đỏ vì một bất biến mới gặp một vi phạm cũ

- **Lần gặp:** 1 — `main` đỏ lúc 2026-09-22T10:12Z, ngay sau khi PR `#85` (`P-023`) merge.
- **Chữ ký:** một PR thêm một **bất biến quét cả kho** (`P-023` thêm `ops/test/step0-log-path.test.ts`: không file code nào được neo vào một đường dẫn log bước 0 cố định), một PR **khác** thêm một file vi phạm bất biến đó (`P-027` thêm `ops/scripts/gate-flow.ts`, chú thích nhắc đích danh `ops/logs/platform/P-016.jsonl`). Mỗi nhánh chỉ mang **một** trong hai file, nên CI của từng PR **xanh**. Chỉ khi cả hai cùng vào `main` thì bất biến mới gặp file vi phạm → `pnpm check` đỏ ở `main`.
- **Nguyên nhân gốc:** CI đo mỗi PR **so với `main` tại lúc PR đó chạy**, không so với `main` **sau** khi các PR đang mở khác đã merge. Một bất biến "quét cả kho" và một file mới nằm ở hai nhánh khác nhau là hai nửa của một mâu thuẫn ngữ nghĩa mà không phép đo per-PR nào thấy được — cùng hình dạng KF-009, nhưng ở tầng **nội dung** thay vì tầng `mergeable`. Nhóm **Z**: hỏng mà mọi chỉ báo per-PR đều xanh.
- **Đã sửa ở đâu:** `ops/scripts/gate-flow.ts` — chú thích đổi từ tên file đích danh sang lời chung ("các dòng log bước 0"). Không đụng cơ chế của `gate-flow.ts` (nó vốn đã KHÔNG đọc file đó — chỉ chú thích nhắc tên); không revert `P-023` hay `P-027` (cả hai đều đúng, revert làm mất cơ chế thật). Forward-fix một dòng để `main` xanh ngay, đúng tinh thần "main đỏ thì sửa ngay" (CLAUDE.md 13).
- **Máy chặn từ nay:** `ops/test/step0-log-path.test.ts` — bất biến quét-cả-kho của `P-023` (đã có) cộng một ca âm **đích danh** `gate-flow.ts` mới thêm ở bản sửa này, để lần sau ai đưa lại tên file vào đó thì đỏ với thông điệp trỏ thẳng KF-013. Chạy trong `pnpm test` (job `check` của CI). Lỗ hổng còn lại — không phép đo per-PR nào thấy mâu thuẫn "bất biến ở nhánh A, vi phạm ở nhánh B" **trước** merge — vẫn mở; chặn thật cần chạy `pnpm check` trên kết quả gộp thử của từng cặp PR đang mở, là việc lớn hơn một mục fix.

---

## KF-014 · Tên model lọt vào repo qua trailer `Co-Authored-By`, và squash merge đưa nó vào lịch sử `main` không lấy lại được

> **Gộp hai bản của cùng một mục** (lượt `crux-worker-1` 2026-09-23 ~13:4xZ, bước 2 phụ lục P1). `main` và nhánh PR `#142` cùng viết một mục mang số `KF-014` cho **cùng một chữ ký lỗi** — không phải hai lỗi khác nhau tranh một số, nên cách giải không phải đẩy một bên sang `KF-01x` khác mà là **gộp làm một**. Giữ cả hai phép đo kèm phương pháp của từng phép (chúng đếm hai thứ khác nhau, xem *Lần gặp*), và phần `Máy chặn từ nay` của bản trên nhánh chính là thứ bản trên `main` ghi là ⬜ **CHƯA CÓ**.
>
> **Một chỗ bản gộp ĐẢO khuyến nghị của bản trên `main`, khai ra thay vì để lẫn vào phần gộp:** bản `main` không chỉ ghi "chưa có máy chặn", nó còn kê sẵn **mức** — *"một job CI đọc thân mọi commit của nhánh PR và **cảnh báo** (luật mềm, CHARTER mục 4 — không chặn, cùng lý do `trailer-warn` không chặn)"*. Bản gộp giữ job **CHẶN** của nhánh, tức chọn ngược mức đó. Lý lẽ nằm ngay trong phần `Máy chặn từ nay` dưới đây (`trailer-warn` mềm vì nó kiểm một giả định về **nền tảng** — `G14`; luật này không phụ thuộc nền tảng nên chặn được), nhưng việc đảo mức là một quyết định, không phải một phép gộp, nên nó phải đọc được từ đây.
>
> Còn treo cho chủ dự án, **không chặn mục này**: CHARTER mục 3 mở đầu bằng *"chỉ có tám luật sau được thực thi cứng"*, và `no-model-name` chặn một luật ngoài `I1`–`I8`. Tiền lệ đã có sẵn trên `main` — job `golden-solo` mà chính `main` vừa thêm cũng chặn một luật ngoài `I1`–`I8` (CHARTER 6.1). Đáng một lần quyết chung cho **cả hai** job (mở rộng bảng `I`, hay hạ cả hai xuống mức cảnh báo), không phải quyết riêng cho mục này.

- **Lần gặp:** nhiều, và **hai phép đo dưới đây đếm hai thứ khác nhau — đừng đọc chúng như một con số mâu thuẫn**:
  - **21 / 51 commit** của `main` (đo 2026-09-22, `git log origin/main --format='%H' | while read h; do git log -1 --format='%B' $h | grep -qE 'Claude (Opus|Sonnet|Haiku) [0-9.]+' && echo $h; done | wc -l`) — phép này quét **cả thân commit**. Phân bố tên theo số lần xuất hiện, kể cả nhiều dòng trong một thân commit squash: `Claude Opus 5` 49 lần, `Claude Sonnet 5` 9, `Claude Opus 4.8` 7.
  - **12 / 53 commit** của `main` (đo 2026-09-22 bằng `ops/scripts/check-commit-trailers.ts`) — phép này chỉ quét **dòng trailer**, đúng phạm vi mà máy chặn dưới đây thực thi. Lần gần nhất: `024c29d`, lượt `crux-worker-1` 2026-09-22T12:59Z; sớm nhất đo được: `c4e6eb2`, 2026-09-21T19:54Z. Rải trên nhiều lượt routine khác nhau, không phải một phiên lạc.

  Chênh lệch không phải sai số: phép thứ nhất bắt cả tên model nằm trong **văn xuôi** thân commit, phép thứ hai cố ý không (xem quyết định thiết kế 1 ở *Máy chặn từ nay*). Hai mẫu số lệch nhau vì đo ở hai mốc `main` khác nhau.
  Cộng thêm một lần tái diễn **trên chính nhánh của mục này** — xem *Đã sửa ở đâu*.
- **Chữ ký:** một dòng trailer `Co-Authored-By` (hoặc `Co-authored-by`) mang thêm tên model — `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Bắt bằng `git log -1 --format='%B' <sha> | grep -E 'Claude (Opus|Sonnet|Haiku) [0-9.]+'`. Trái `CLAUDE.md` mục 6: *"Không ghi tên hay mã model vào commit message, mô tả PR, comment code hay bất cứ thứ gì đẩy lên repo."*
- **Nguyên nhân gốc:** nền tảng Claude Code phát cho mỗi phiên một hướng dẫn attribution mặc định **ngoài repo**, và hướng dẫn đó chèn tên model vào đúng dòng `Co-Authored-By`. Luật của repo thắng hướng dẫn đó, nhưng nguồn ngoài repo là nguồn agent đọc **trước** khi viết commit, còn chỗ thực thi luật thì chỉ là trí nhớ của agent đang chạy — nên nó hụt. Cùng hình dạng với `KF-010`: một bước bắt buộc mà không có máy nào chặn thì sẽ hụt. Lớp chặn duy nhất từng có — hằng `CO_AUTHOR_TRAILER` trong `ops/scripts/integrator-resolve.ts` cộng ba test của `P-024` ở `ops/test/integrator-resolve.test.ts` — chỉ phủ commit do **tool** sinh ra; commit viết tay không đi qua tool đó.
- **Vì sao không gì đỏ:** không kiểm tra nào trong `pnpm check` hay CI đọc thân commit của nhánh để tìm tên model. Job `trailer-warn` của `ops/workflows/ci.yml` chỉ đếm commit **thiếu** `Claude-Session`, không đọc **nội dung** trailer. Đúng nhóm **Z** — và nó lặp hàng chục lần trước khi ai đo.
- **Vì sao nó nặng hơn phần lớn lỗi khác:** `automerge.yml` merge bằng **squash**, nên thân commit của nhánh đi vào lịch sử `main`. Một PR revert **không** lấy lại được dòng đó — khác mọi thay đổi khác trong repo, vốn "nằm trong git nên revert được" (CHARTER 2.3). **21 commit** đã vào rồi thì ở lại.
- **Đã sửa ở đâu:** không vá lịch sử `main` — sửa những commit đã vào đòi rewrite `main`, cái giá cao hơn cái lợi, và `CLAUDE.md` mục 2 cấm force-push lên nhánh người khác. Chỗ sửa là **máy chặn**: `CLAUDE.md` mục 6 đã nói đúng điều cần nói, phần thiếu chưa bao giờ là câu luật. Mục 6 được thêm một dòng trỏ tới `KF-014` để người đọc luật thấy luôn chỗ nó từng bị vi phạm.

  **Hai lần tái diễn trên nhánh của chính các mục viết ra nó**, ghi lại vì đó là bằng chứng mạnh nhất cho dòng *Máy chặn từ nay*: mục `P-025` sửa hai commit của nhánh nó về `Co-Authored-By: Claude <noreply@anthropic.com>` (amend + force-push nhánh của **chính mình**) trước khi rời nháp; rồi lượt `crux-worker-1` (2026-09-22 ~10:4x–11:0xZ) nhận lại PR đó ở bước 2 phụ lục P1 và đẩy **ba** commit mang tên model, vòng soát ngữ cảnh sạch bắt, ba commit được dựng lại với trailer trung tính rồi force-push. Mục đã được viết ra, đã được sửa một lần, **và vẫn tái diễn ở lượt kế tiếp** — vì tới lúc đó chỗ thực thi vẫn là trí nhớ của agent.
- **Máy chặn từ nay:** `ops/scripts/check-commit-trailers.ts` (`modelNameInTrailers`, `isInScanScope`, `scanRange`) cộng job **`no-model-name`** trong `ops/workflows/ci.yml` — job **CHẶN**, chạy `node ops/scripts/check-commit-trailers.ts "origin/$BASE_REF..HEAD"` trên mọi PR. Bài kiểm: `ops/test/check-commit-trailers.test.ts`, 17 ca, chạy trong `pnpm test` (job `check`).

  Job này **chặn** trong khi `trailer-warn` ngay cạnh nó chỉ **cảnh báo**, và hai mức khác nhau là có chủ đích: `trailer-warn` kiểm một giả định về **nền tảng** (`G14` — nền tảng có ghi trailer hay không), nền tảng đổi cách ghi thì một luật cứng ở đó sẽ chặn toàn bộ công việc; còn luật ở đây không phụ thuộc nền tảng, và bên viết commit luôn sửa được.

  Ba quyết định thiết kế đều có ca kiểm khoá:
  1. **Quét theo khoá trailer, không quét cả thân commit.** Quét cả thân sẽ đỏ ngay ở chính bản vá này (mục này phải trích dòng sai làm chữ ký). Danh sách khoá đóng — mở sang "mọi dòng dạng `Khoá: giá trị`" sẽ bắt nhầm văn xuôi tiếng Việt (`Chữ ký:`, `Còn treo:`).
  2. **Không lọc theo vị trí trong thân.** Bản đầu chỉ đọc "khối trailer" theo nghĩa git (đoạn cuối cùng toàn dòng trailer) và **để lọt đúng ca sai thật** `024c29d`: GitHub squash nối thêm một `Co-authored-by` của chính nó ở đoạn cuối, nên dòng sai nằm ở một đoạn **giữa**, cách bởi một dòng `---------`. Phép đo hẹp ra `EXIT=0` trên đúng commit nó phải bắt. Ca hồi quy dán nguyên hình dạng đó.
  3. **Mốc ân hạn: chỉ quét commit tạo từ `GRACE_CUTOFF` (`2026-09-24T02:02:41Z`) trở đi** — quyết định `🤖 [QĐ] #165`, phương án **B**, làm theo khuyến nghị ở lượt `crux-worker-1` ~22:40Z vì `reversible` thì làm ngay, không đứng chờ (CHARTER 2.3). Lý do đo được: luật viết ra **sau** các commit vi phạm đang nằm trong nhánh, nên bật nó không ân hạn là làm đỏ **30 commit trên 13 / 29 PR đang mở** cùng lúc, vì lỗi của lượt khác — và không lượt agent nào gỡ được, vì cách sửa duy nhất là `git push --force`, bị `.claude/settings.json` chặn ở `deny`. Commit chỉ được ân hạn khi **CẢ HAI** mốc — giờ committer (`%cI`) và giờ author (`%aI`) — đều trước `cutoff`. Mỗi mốc một mình đều có đường lách, cả hai đo được bằng chạy thật: chỉ `%aI` thì giờ author giữ nguyên qua amend/rebase nên ân hạn theo được **vô hạn**; chỉ `%cI` thì `GIT_COMMITTER_DATE='2026-09-22T21:00:00Z' git commit` tạo một commit **mới tinh** mà phép quét bỏ qua hoàn toàn — một job CHẶN bị lách bằng một biến môi trường (`git rebase --committer-date-is-author-date` cho cùng kết quả). Lỗ này do **vòng soát ngữ cảnh sạch** của lượt `~22:40Z` tìm ra, sau khi bản đầu chỉ xét `%cI`; đã vá trong cùng PR. Xét cả hai mốc **không** làm đỏ lại 30 commit cũ — `%aI` của chúng cũng nằm trước mốc, đo lại trên cả 29 nhánh PR: 0 PR đỏ. Năm ca khoá: (a) mốc phải là hằng số trong **quá khứ** — đỏ ngay nếu ai đổi nó thành `new Date()`; (b) **hai chiều** trên lịch sử git thật — commit cũ không đỏ, commit mới **vẫn** đỏ; (c) amend đổi `%cI` thì commit mất ân hạn; (d) commit mới backdate `GIT_COMMITTER_DATE` **vẫn** bị bắt qua `%aI`; (e) ca âm — cả hai mốc trước `cutoff` thì vẫn ân hạn.

  Số commit được ân hạn **luôn** in ra ở đầu ra của job, kể cả khi sạch — để một phép quét rỗng không trông giống một phép quét sạch.

  **Mốc đã phải dời một lần, và lý do đáng đọc** (`🤖 [QĐ] #219`, phương án **A**, lượt `crux-worker-1` ~02:41Z 2026-09-24). Bản đầu đặt mốc ở `2026-09-22T22:00:00Z` — thời điểm ai đó **đo** danh sách 30 commit vi phạm. Nhưng job `no-model-name` chỉ vào `main` lúc `2026-09-24T02:02:41Z` (`dca3564`, PR `#142`), **~28 giờ sau**. Trong khoảng hở đó các lượt chạy vẫn sinh thêm commit mang tên model — nguyên nhân gốc ở trên chưa đổi, và chưa có gì đỏ để bắt. Đo bằng chạy thật ngày 2026-09-24 trên 8 PR đang mở: **6 commit** nữa rơi vào khoảng hở, trải trên **4 PR** (`#112` 1 — `fe6f57d`, `#198` 3, `#84` 1, `#66` 1); `#215`, `#214`, `#196`, `#39` sạch. Chúng cũng không sửa được từ phía agent, nên bốn PR đó đỏ ở một job mà **không lượt nào vá nổi** — đúng chữ ký mà chính mục này cảnh báo hai lần. Mốc nay là **lúc luật lên `main`**: luật không cắn được trước khi nó ở trên `main`, nên đó mới là ranh giới "vi phạm mới". Ca khoá thêm: bài `🤖 [QĐ] #219 · TÁI HIỆN LỖI` (đỏ trên mốc cũ, xanh trên mốc mới — kiểm hai chiều bằng chạy thật) và một `assert` đòi `GRACE_CUTOFF >= RULE_LANDED_ON_MAIN`, để mốc không bị đẩy ngược về trước nữa.

  **Bài học cho lần sau, không riêng mục này:** mốc ân hạn của một luật mới phải lấy từ **lúc luật bắt đầu chạy**, không phải lúc đo. Ở repo này hai thời điểm đó luôn cách nhau ít nhất một vòng `ops/workflows/**` → merge → `sync-workflows` (`CLAUDE.md` mục 4), và mọi lượt chạy trong khoảng đó vẫn sinh vi phạm.
- **Còn hở:** job chỉ quét `base..HEAD` của PR, nên các commit cũ đã vào `main` vẫn còn tên model — nợ đã khai, không phải chỗ hở mới. Theo đúng phạm vi mà phép quét này phủ (dòng trailer) thì con số là **12 commit**; phép quét rộng hơn ở *Lần gặp* đếm 21. Mốc ân hạn thêm một nợ cùng loại: **30 commit** trong 13 nhánh đang mở, **cộng 6 commit** nữa trong khoảng hở 28 giờ đã nói ở trên (4 PR), vẫn mang tên model và sẽ vào `main` qua squash. Đó là cái giá đã khai của phương án B ở `#165`; đường gốc rễ hơn là phương án **C** (`automerge.yml` truyền `commit_message` tường minh lúc squash, nên thân commit nhánh không tới `main`) — nên làm **sau**, khi hàng đợi merge đã chạy lại, vì nó chạm `ops/workflows/automerge.yml` tức vùng `owner-merge`. Và phép quét chỉ phủ **commit message**; tên model trong mô tả PR, comment hay code chưa có máy chặn nào (mục 6 cấm cả những chỗ đó). Chặn nốt đáng một mục `platform` riêng.
- **Ân hạn là trạng thái DỄ VỠ, không phải miễn trừ bền:** nó bám vào mốc của commit, nên một lần **rebase thường** làm `%cI` **và** `%aI` nhảy sang hiện tại và PR đó đỏ trở lại (đo bằng chạy thật: sau `git rebase`, cùng commit ra `EXIT=1`, "1 commit quét, 0 ân hạn"). Cập nhật nhánh bằng **merge** thì ân hạn giữ nguyên; bấm "Update branch **with rebase**" trên GitHub thì không. Nếu chuyện đó xảy ra, agent **không gỡ được** (`git push --force` chặn ở `deny`) — cách gỡ là chủ dự án merge tay PR đó, hoặc làm phương án **C** của `#165`.
- **Chưa kiểm trong CI thật:** con số "0 / 29 PR đỏ" là đo bằng chạy script **cục bộ** trên từng nhánh. Job `no-model-name` chưa có trên `main` lẫn `.github/workflows/`, nên lần đầu nó chạy trong CI thật là **sau** khi PR này merge và `sync-workflows` chạy xong (`CLAUDE.md` mục 4). Điểm đã kiểm và yên tâm được: `ops/workflows/automerge.yml` đọc `conclusion` của cả workflow run `ci.yml` chứ không đọc một danh sách check cứng, nên `no-model-name` đỏ là chặn được automerge thật.

---

## KF-015 · Kho phiên bị **shallow**, nên phép đo xung đột của bước 0 báo "unrelated histories" cho một nhánh hoàn toàn bình thường

> Số **KF-015** chứ không phải KF-014: PR `#142` đang mở đã nhận **KF-014**. Nhận mã trước khi viết là cách hai worker không cùng lấy một số.

- **Lần gặp:** 2 — PR `#42` lúc 2026-09-22T08:16:45Z (đã đính chính lúc 09:46:12Z), rồi PR `#66` lúc 13:27Z. Phát hiện lại ở lượt `crux-worker-1` ~13:40Z.
- **Chữ ký:** `git merge-tree --write-tree refs/pr/<n> origin/main` thoát **128** với `fatal: refusing to merge unrelated histories`, trong khi PR đó không có gì bất thường. Kèm theo: `git rev-list --max-parents=0` cho `main` và cho nhánh ra **hai** root khác nhau.
- **Nguyên nhân gốc:** phiên cloud clone kho ở dạng **nông** (`git rev-parse --is-shallow-repository` = `true`). Trên kho nông, `git rev-list --max-parents=0` trả về commit **biên bị ghép (grafted)** — commit cũ nhất bản clone có, đã bị cắt mất cha — chứ không phải root thật. Hai bản clone nông ở hai độ sâu khác nhau cho hai "root" khác nhau cho cùng một cây, và `merge-tree` không tìm được tổ tiên chung vì tổ tiên đó nằm ngoài phần lịch sử đã tải. Đây **không** phải lỗi của nhánh, và cũng không phải lỗi của `merge-tree`: phép đo chạy trên một lịch sử không đầy đủ.
  Đo lại sau `git fetch --unshallow origin` cho PR `#66`: root của `main` và root của `refs/pr/66` **trùng nhau** (`99d6bcf`), `git merge-base origin/main refs/pr/66` = `a1abee9`, `measureConflicts` ra **không xung đột**.
- **Vì sao nó đắt:** lần đầu nó sinh một comment báo động sai trên PR `#42` yêu cầu **chủ dự án** force-push dựng lại nhánh hoặc đóng PR mở lại — đúng thứ CHARTER mục 1.2 muốn tránh. Lần hai nó làm một PR `owner-merge` bị ghi nhầm là hỏng cấu trúc trong dòng log bước 0 và trong tiêu đề commit vào `main`.
- **Đã sửa ở đâu:** `ops/scripts/conflict-watch.ts` — mục `integration/I-017`. `fetchProbeRefs()` nay gọi `ensureComplete()` **trước** lần `git fetch`: kiểm `git rev-parse --is-shallow-repository`, và nếu nông thì `git fetch --unshallow` rồi kiểm lại đã hết nông chưa. Không unshallow được thì **ném** — không đo tiếp trên lịch sử thiếu, vì một phép đo sai ở đây đi thẳng vào bản tin và comment gửi chủ dự án. Mọi bên gọi (`measureConflicts`, `gate-flow.ts`) thừa hưởng bản sửa vì đều đi qua `fetchProbeRefs`. Kèm theo: `measureConflicts()` bắt lỗi **theo từng PR** (`ConflictProbeError`) nên một PR ném 128 không còn làm tắt phép đo của các PR còn lại.
- **Máy chặn từ nay:** `ops/test/conflict-watch.test.ts` — hai bài chạm remote thật (bất biến I2, job `check` của CI): `KF-015: kho nông báo "xung đột" cho nhánh gộp sạch …` dựng một kho **nông** trong thư mục tạm và đòi `measureConflicts` trả `null` (gộp sạch) cho một nhánh chỉ-thêm-file — đỏ trên bản cũ vì nó ném `refusing to merge unrelated histories`; và `một PR hỏng (thoát 128) không làm tắt phép đo của PR còn lại` canh phần bắt lỗi theo từng PR.

---

## KF-017 · Workflow gọi `gh api` tới một scope chưa khai, và **một** lỗi 403 làm đứng cả hàng đợi merge

- **Lần gặp:** 1
- **Chữ ký:** trong log job `merge` của `automerge`: một dòng `cửa=<…>` của PR đầu hàng đợi, rồi ngay sau đó `gh: Resource not accessible by integration (HTTP 403)` và `Process completed with exit code 1`. Không PR nào phía sau được in ra.
- **Nguyên nhân gốc:** mục `P-009` thêm lời gọi `gh api "repos/$REPO/commits/$HEAD/check-runs"` vào `ops/workflows/automerge.yml` để đọc kết luận của check run `fix-has-test`, nhưng khối `permissions:` vẫn chỉ khai `contents: write`, `pull-requests: write`, `actions: write`. **`checks` là một scope RIÊNG** — không quyền nào trong ba bao nó, và khai `permissions:` tường minh đặt mọi scope còn lại về `none`. Hai chỗ khuếch đại nó từ "một lời gọi hỏng" thành "nhà máy dừng":
  1. Lời gọi nằm **trong vòng lặp duyệt cả hàng đợi**, và bước chạy dưới `set -euo pipefail`. PR đầu tiên 403 thì 26 PR còn lại không bao giờ được xét.
  2. `automerge` không merge gì cũng là một kết quả **bình thường** (mọi PR đang chờ đủ 12 giờ), nên không ai mở log ra xem.
- **Đo được, 2026-09-22:** lượt `automerge` xanh cuối cùng là run `#463`, `14:44:30Z`, trên `main` tại `e31a1da`. `P-009` merge lúc `14:44:59Z` và `sync-workflows` chép sang `.github/` lúc `14:45:09Z`. Từ run `#464` trở đi: **35 lượt đỏ liên tiếp**, cùng một chữ ký. PR cuối cùng do máy merge là `#147` (`14:45:13Z`, lượt đã khởi động trước khi bản mới có hiệu lực). Tới `20:38Z` — **~5,9 giờ, 0 PR máy merge, 27 PR mở dồn lại**. `#71` merge lúc `16:46Z` **không** phải đối chứng ngược: `merged_by` là chủ dự án, cửa `owner-merge`.
- **Đã sửa ở đâu:** `ops/workflows/automerge.yml` khai thêm `checks: read`, kèm chú thích tại chỗ nói vì sao. **Không** vá bằng `|| true` quanh lời gọi: nuốt lỗi ở đây biến `fixHasTestConclusion` thành `null` vĩnh viễn, mà `invariants.merge-gate.ts` đọc `null` là "chưa kiểm" — hàng đợi vẫn đứng, chỉ là đứng im lặng hơn. Đó là vá sản phẩm (CLAUDE.md mục 13).
- **Máy chặn từ nay:** luật mới trong `missingPermissions` (`ops/scripts/check-workflows.ts`, chạy ở `pnpm lint:workflows` trong `pnpm check`): `gh api` chạm `/check-runs` hoặc `/check-suites` phải khai `checks: read` (hoặc `write`). Bốn bài kiểm ở `ops/test/check-workflows.test.ts`: một bài âm dựng lại đúng khối `permissions:` đã hỏng, một bài xác nhận `read` và `write` đều đủ, một bài giữ `gh pr checks` ở scope `pull-requests` để không ép khai thừa quyền, và một bài **neo thẳng vào `ops/workflows/automerge.yml` trên cây**. Phá thử: xoá dòng `checks: read` khỏi file thật thì **2 bài đỏ**, khôi phục thì xanh (56/56 sau vòng soát). **Vòng soát của `P-029` bịt thêm một lỗ của chính luật này:** mọi luật khớp trong phạm vi một dòng, còn bash cho trải lệnh ra nhiều dòng bằng `\`. Đo 14 ca: `gh api \` rồi URL ở dòng sau — và `gh api \` rồi `-H "Accept: …"` rồi URL — **lọt hết**. `automerge.yml` đang dùng đúng dấu `\` đó và chỉ tình cờ để URL ở dòng đầu, nên một lần rewrap cho dễ đọc là luật tắt tiếng và lỗi này quay lại y nguyên. `joinContinuations` nối các dòng bị `\` cắt thành một dòng logic **trước khi** khớp; `declaredPermissions` vẫn đọc nguồn gốc vì nó phân tích theo thụt lề. **Còn sót, đã khai chứ không giấu:** `gh api graphql` và `curl` tới `api.github.com` chưa có luật nào.

---

## KF-018 · Một lớp chặn mới, đúng luật, sẽ làm đỏ **13 trên 29** PR đang mở — và cách sửa duy nhất trong nhánh thì máy cấm agent làm

> Số **KF-018**: `KF-014` thuộc PR `#142`, `KF-016` thuộc PR `#154`, `KF-017` thuộc PR `#162` — cả ba đang mở. Nhận mã trước khi viết (KF-005).
>
> ⚠️ Mục này **đã lấy nhầm `KF-017`** ở lần viết đầu, vì chỉ dò mã trên `main` và trên hai nhánh nhớ được, không dò **mọi** nhánh PR đang mở. Đúng chữ ký `KF-005`, và đúng chỗ mà `KF-005` nói là hay sai. Cách dò đúng, chạy chứ đừng nhớ:
>
> ```bash
> for b in $(git branch -r | grep -v HEAD | grep origin/claude/ | sed 's/ *origin\///'); do
>   git grep -h -oE "^## KF-[0-9]+" "origin/$b" -- ops/known-failures.md 2>/dev/null
> done | sort -u -V | tail -1
> ```

- **Lần gặp:** 3 trên PR `#65` — 15:55Z, 17:45Z, rồi lượt `crux-worker-1` ~21:38Z. Hai lượt đầu ghi nó ra như một va chạm **giữa hai PR** (`#142` vào `main` trước `#65` thì `#65` đỏ). Lượt thứ ba đo trên **toàn bộ** PR đang mở và thấy nó không phải chuyện của một PR.
- **Chữ ký:** `node ops/scripts/check-commit-trailers.ts "origin/main..origin/<nhánh>"` (bản trên nhánh của `#142`) thoát **1** với `tên model trong khối trailer — Co-Authored-By: Claude <Opus|Sonnet> … <noreply@anthropic.com>`, trên một PR mà **không ai vừa đụng vào** và `pnpm check` tại máy vẫn xanh.
- **Đo, không suy (2026-09-22 ~21:45Z → ~22:0xZ, `origin/main = 5ded395`, chạy bản checker của nhánh `#142` trên từng nhánh PR đang mở):**

  > ⚠️ Lần đo đầu của lượt này ra **28 / 11 / 21** và **sai**: nó lặng lẽ bỏ 8 PR log-only của làn `integration` ra khỏi mẫu số. Đo lại đủ **29** PR thì hai trong 8 PR đó (`#153`, `#164`) cũng dính. Số đúng là **30 / 13 / 29**. Ghi cả con số sai ra đây vì đó chính là chữ ký của lỗi này: một mẫu số thu hẹp không cố ý, và không gì đỏ.

  | PR | commit vi phạm / tổng commit ngoài `main` |
  |---|---|
  | `#42` | **9 / 10** |
  | `#112` | 4 / 7 |
  | `#39` · `#49` · `#79` | 3 / 28 · 3 / 25 · 3 / 22 |
  | `#56` · `#65` · `#81` · `#84` · `#89` | 1 mỗi PR |
  | `#153` · `#157` · `#164` | **1 / 1** mỗi PR — commit vi phạm là commit **duy nhất** của PR |

  Tổng: **30 commit vi phạm, trải trên 13 / 29 PR đang mở**. Sạch: `#66` `#109` `#117` `#120` `#129` `#142` `#149` `#150` `#151` `#154` `#155` `#156` `#159` `#160` `#161` `#162`.

- **Nguyên nhân gốc:** không phải checker sai, và cũng không phải `#142` sai — `CLAUDE.md` mục 6 cấm tên model trong mọi thứ đẩy lên repo, `automerge.yml` merge bằng **squash** nên thân mọi commit của nhánh **có** tới `main`, vậy quét cả dải `origin/main..HEAD` là đúng thiết kế. Nguyên nhân là **thứ tự**: luật được viết ra *sau* khi 30 commit vi phạm đã nằm sẵn trong lịch sử của các nhánh đang mở, và không lớp nào dọn chúng trước khi lớp chặn bật.
- **Vì sao nó đắt hơn vẻ ngoài:** `#142` mang nhãn `automerge-delayed` — **máy tự merge** sau 12 giờ CI xanh, không ai phải bấm gì. Khi nó vào `main` và `sync-workflows` chạy, 13 PR kia đỏ ở lượt CI kế tiếp và **không PR nào trong số đó merge được nữa**, trên một hàng đợi vốn đã tuần tự và vốn đã đứng vì `automerge` 403 (issue `#152`). Không có gì đỏ **lúc này**: CI xanh trên cả 13 PR, nhãn đúng, `#142` đúng luật. Đúng nhóm **Z** một lần nữa — lần này nhóm Z ở **thì tương lai**.
- **Vì sao hai lượt trước không sửa, và vì sao lượt này cũng không:** cách sửa duy nhất nằm trong nhánh là viết lại thông điệp commit (`filter-branch --msg-filter` hoặc rebase) rồi **force-push**. `.claude/settings.json` chặn đúng hai lệnh đó trong `deny`: `Bash(git push --force:*)` và `Bash(git push -f:*)`. Theo `CLAUDE.md` mục 3, bị chặn **không phải lỗi cần lách**. Vậy đây không phải việc agent chọn không làm — đây là việc agent **không có quyền** làm, và ba lượt liên tiếp ghi lại cùng một chữ ký mà không ai gỡ được là đúng điều kiện `CLAUDE.md` mục 13 (lần thứ ba → mở `🤖 [QĐ]`).
- **Đã sửa ở đâu:** *chưa sửa cơ chế* — mục `platform/P-030` nhận việc, và lựa chọn giữa các phương án là quyết định `reversible` ở issue `🤖 [QĐ] #165`. Ba đường đang cân: (a) chủ dự án force-push 13 nhánh; (b) `#142` thêm mốc ân hạn, chỉ quét commit tạo **sau** khi luật bật; (c) `automerge.yml` truyền `commit_message` tường minh lúc squash, để thân commit cũ không bao giờ tới `main` — nhưng file đó là vùng `owner-merge`.
- **Hai lỗi của chính lượt viết mục này, giữ lại vì cùng một hình dạng.** Cả hai do vòng soát ngữ cảnh sạch bắt, `pnpm check` **không** bắt được cái nào — không lớp máy nào soát nội dung tài liệu:
  1. **Mẫu số thu hẹp không cố ý** (đã nói ở trên): 28 / 11 / 21 thay vì 30 / 13 / 29.
  2. **Thay thế toàn cục làm hỏng bản ghi của mục khác.** Lần sửa số `11 → 13` chạy bằng `sed` trên cả file đã đổi luôn dòng cấp mã của mục **`P-023`** — *"`P-022` là mã cao nhất … trên cả **11** nhánh PR đang mở tại lúc nhận"* — một phép đo **lịch sử** lúc ~04:1x, không liên quan gì tới lượt này. Đã hoàn nguyên. Luật rút ra: sửa một con số đo được thì sửa **đúng chỗ đã viết nó ra**, đừng `sed` cả file — con số giống nhau ở hai chỗ không có nghĩa là cùng một phép đo.
- **Máy chặn từ nay:** chưa có, và **cố ý chưa có**: thêm một lớp chặn nữa lúc này chỉ nhân đôi đúng vấn đề mà mục này mô tả. Tới khi `P-030` xong, lớp chặn là dòng này: **trước khi một lớp chặn mới quét `origin/main..HEAD` được bật, chạy nó trên MỌI nhánh PR đang mở trước** — nếu nó đỏ ở một PR mà không ai vừa đụng vào, thì lớp chặn đó cần một mốc ân hạn, không phải 13 lần viết lại lịch sử.

---

## KF-016 · `integrator-resolve.ts` trả `outcome: "resolved"` cho một cây **không parse được** — `merge=union` nối hai phía thành mã hỏng cú pháp

> Số **KF-016**: `KF-014` do PR `#142` giữ, `KF-015` đã dùng. Nhận mã trước khi viết, để hai worker không lấy trùng số.

- **Lần gặp:** 1 — PR `#71` (`claude/platform/P-010`), phát hiện ở lượt `crux-worker-1` ~16:45Z ngày 2026-09-22. Hai lượt bước 0 trước đó (`15:40Z` worker-1, `16:20Z` worker-2) gộp **cùng** cây này mà không thấy, vì `pnpm check` đỏ sớm hơn ở `lint:workflows` nên chưa chạy tới `typecheck`.
- **Chữ ký:** `node ops/scripts/integrator-resolve.ts origin/main` in `{"outcome":"resolved","files":["<file>.ts"]}` và thoát `0`, nhưng `tsc --noEmit` trên cây vừa gộp báo lỗi cú pháp (`error TS1005: '}' expected`) ở **cuối** file đó. Ở `#71`: `ops/test/check-workflows.test.ts(747,1)`.
- **Nguyên nhân gốc:** `merge=union` làm việc theo **dòng**, không theo cú pháp. Hai phía cùng kết thúc một khối bằng dòng `});` giống hệt nhau, rồi `main` viết tiếp các test mới **sau** dòng đó. Union giữ dòng chung **một lần** và đặt phần thêm của `main` vào **trước** nó, nên `});` đóng test cuối của nhánh biến mất và thân test của nhánh nuốt luôn khối mới của `main`. Không bên nào mất chữ — số dòng vẫn cộng đúng — nên phép đối chiếu bằng **số dòng xoá** mà `integrator-resolve.ts` dùng để quyết `resolved` hay `aborted-ineligible` không thấy gì bất thường: **không bên nào xoá dòng nào.**
- **Vì sao nó đắt:** đây là ca "mọi chỉ báo đều xanh" (nhóm Z) ở đúng công cụ mà cả hàng đợi merge dựa vào. Phụ lục P3 bước 0b chỉ bắt buộc chạy `pnpm check` **trước khi push**; ca này qua được nếu `check` dừng ở một lỗi khác, hoặc nếu có ai nới thứ tự các bước. Union `ops/logs/**/*.jsonl` (ca nó sinh ra để phục vụ) an toàn vì JSONL không có cú pháp lồng nhau; file `.ts`, `.json` và `.yml` thì **không**.
- **Đã sửa ở đâu:** mục `integration/I-018`. `ops/scripts/merge-syntax.ts` (mới) kiểm **cây sau khi union còn đọc được**, và `ops/scripts/integrator-resolve.ts` gọi nó ngay sau vòng `merge-file --union`, **trước** khi tạo lại lockfile và trước commit: không đọc được thì trả `aborted-ineligible` kèm `reason` nói rõ file nào và lỗi gì. Phạm vi: `.ts`/`.tsx`/`.mts`/`.cts`/`.js`/`.jsx`/`.mjs`/`.cjs` parse bằng `typescript` (`transpileModule` với `reportDiagnostics` — `node --check` KHÔNG dùng được vì nó không bỏ chú thích kiểu, đã đo), `.json` bằng `JSON.parse`, `.yml`/`.yaml` bằng một phép kiểm cấu trúc khối hẹp có chủ đích (repo không có thư viện YAML). Chỉ những file tool vừa union, không quét cả cây — bước 0 chạy ở đầu **mọi** lượt worker. Lần chữa bằng tay trên nhánh `#71` (trả lại `});`, giữ nguyên test của cả hai phía) vẫn là vá sản phẩm, không phải sửa cơ chế — `CLAUDE.md` mục 13; dòng này là phần sửa cơ chế.
- **Máy chặn từ nay:** `ops/test/merge-syntax.test.ts` — bài tái hiện lỗi (bất biến I2, job `check` của CI) dựng hai nhánh git **thật** đúng hình dạng `#71` (cả hai bên thêm sau một dòng `});` chung) và đòi `resolveAdditiveMerge` trả `aborted-ineligible`. Đo bằng chạy thật cả hai chiều: **đỏ** trên bản trước khi sửa (`{"outcome":"resolved","files":["suite.test.ts"]}`), **xanh** sau bản sửa. Cùng hình dạng ở `.json` (hai khối lồng kết thúc bằng dòng `  },` giống hệt nhau) có bài riêng. Ba bài còn lại canh chiều ngược: cây lành phải đi qua, `.jsonl` và `.md` không bị kiểm, và những cấu trúc YAML ngoài mô hình (`|`, `---`, anchor, flow collection nhiều dòng) phải **cho qua** chứ không phán.
- **Vòng soát ngữ cảnh sạch bắt ba lỗi BÁO SAI trên bản nháp đầu** (phụ lục P1 bước 6), cả ba đều là "chặn một cây lành" — đúng loại hỏng đắt nhất của cổng này, và không ca nào nổ trên kho hiện tại nên không có gì đỏ để cảnh báo:
  1. `.json` parse bằng `JSON.parse` một mình gọi **chính `tsconfig.json` của repo** là hỏng, vì file đó mang hai dòng chú thích `//`. Chữa: hai phép parse, chỉ báo lỗi khi **cả hai** đỏ — phép thứ hai là `parseConfigFileTextToJson` của `typescript`, chịu được JSONC mà vẫn bắt hình dạng `KF-016`.
  2. Phép kiểm YAML không biết **mức thụt lề ẩn** mà `- ` tạo ra: khoá đầu của một item nằm ở `indent + 2`, nên `- with:` rồi `uses:` ở dòng sau ra "dedent lạc mức". Ba ca đã đo (`- with:`/`uses:`, `- env:` trong matrix, `- env:`/`run:`) đều là hình dạng thường gặp của GitHub Actions; tám workflow hiện có chỉ đi qua vì **tình cờ** viết `- name:`/`- uses:` trước `with:`. Chữa: đẩy mọi mức ẩn của chuỗi `- ` vào ngăn xếp, kể cả mức trung gian của `- - 1`.
  3. Vô hướng viết tiếp xuống dòng với thụt lề **giảm dần** (`a: foo` / `bar` / `baz` ở ba mức khác nhau) là YAML hợp lệ, nhưng "sâu hơn thì luôn hợp lệ" biến dòng tiếp đầu tiên thành một mức thật. Chữa: một dòng không phải khoá và không phải gạch đầu dòng là vô hướng viết tiếp → cho qua cả file.
  Cùng vòng soát còn bắt hai chỗ **bỏ sót**, đã sửa: mốc của khối vô hướng `|` lấy thụt lề dấu gạch thay vì của khoá (nuốt luôn mọi khoá anh em của item), và một dấu đóng lẻ trong vô hướng (`b: echo }`) tắt cổng cho cả file. Cả ba ca báo sai cộng năm ca nữa nay là test đích danh `A`–`H` trong `ops/test/merge-syntax.test.ts`.
- **Thiên lệch, khai trước:** một lần báo sai (`aborted-ineligible` cho cây lành) làm đứng hàng đợi merge và đòi người giải tay; một lần bỏ sót chỉ trả về đúng hành vi trước mục này. Nên cổng chỉ báo khi cú pháp **chắc chắn** hỏng. Lỗ hổng còn lại, ghi ra để không im lặng: đường gộp **`clean`** (git tự ghép, không union) KHÔNG qua cổng này — ở đó thứ đã có cổng riêng là lockfile (`I-006`, `KF-007`); và phép kiểm YAML hẹp hơn một trình nạp thật, nên nó bắt tab và thụt lề lệch mức, không bắt mọi cách YAML hỏng. Với hai chỗ đó, lớp chặn vẫn là dòng cũ: **bước 0 chạy `pnpm check` ĐỦ tới `typecheck` trước khi push, và một cây gộp `resolved` mà `tsc` đỏ ở lỗi cú pháp thì phải coi là `aborted-ineligible`, không phải một PR đỏ.**

---

## KF-019 · `main` đỏ vì một workflow vào được `main` mà không luật nào soi nó ở `node --test`

- **Lần gặp:** 1
- **Chữ ký:** `pnpm check` dừng ngay ở `pnpm lint:workflows` **trên chính `origin/main`**, in `spike-canvas.yml:47/69/84 — khối `run: |` thiếu `set -euo pipefail` (Z10)` cộng `spike-canvas.yml:63 — `|| true` … không có chú thích (Z9)`. Mọi PR đang mở kế thừa đúng bốn dòng đó ngay khi gộp `main`, nên chúng đỏ mà không ai đụng vào chúng.
- **Nguyên nhân gốc:** Không phải luật thiếu — Z9 và Z10 đã nằm trong `ops/scripts/check-workflows.ts` từ mục `P-011`, và `pnpm lint:workflows` bắt đúng cả bốn chỗ. Chỗ thủng là **thời điểm**: `lint:workflows` chỉ soi cây khi ai đó chạy `pnpm check`, còn `node --test` — thứ chạy trong mọi lần CI và mọi lượt worker — **không có bài nào soi cây thật bằng Z9/Z10**. Hai bài "cây hiện tại phải sạch" ở `ops/test/check-workflows.test.ts` chỉ soi quyền và action Node 20. Nên `spike-canvas.yml` (mục `visual/V-002`, PR #42) merge vào `main` lúc `23:05:06Z` với đủ bốn vi phạm, và `main` đỏ từ đó. Đây là **KF-013 lần thứ tư trong ngày** ở một hình dạng mới: bất biến có sẵn, vi phạm mới, và không lần chạy nào đặt hai thứ cạnh nhau **trước** lúc merge.
- **Đo được, 2026-09-22 23:38Z:** `origin/main` tại `cf5c7f9`, `node ops/scripts/check-workflows.ts` trên cây sạch → **EXIT=1**, đúng bốn dòng trên. 17 PR đang mở, **CI xanh cả 17** — vì lần chạy CI gần nhất của mọi PR đều **trước** `23:05:06Z`. Bốn PR xung đột của lượt (#120, #39, #84, #89) có mốc kẹt `23:02–23:05Z`, và mốc của #89 đúng bằng `7dfdfeb` — cùng một lần merge.
- **Đã sửa ở đâu:** `ops/workflows/spike-canvas.yml` — thêm `set -euo pipefail` vào ba khối `run: |` (dòng 47, 69, 84) và một chú thích tại chỗ cho `"$found" --version || true` nói vì sao nuốt lỗi ở đúng dòng đó là an toàn. **Không** nới luật, **không** thêm ngoại lệ cho file này: luật đúng, file sai.
- **Máy chặn từ nay:** bài `cây hiện tại sạch với Z10 (set -euo pipefail) và Z9 (nuốt lỗi có chú thích)` ở `ops/test/check-workflows.test.ts`, chạy `blocksMissingPipefail(runBlocks(...))` và `undocumentedSwallows(...)` trên **mọi** `ops/workflows/*.yml` của cây thật. Nó chạy trong `node --test`, tức trong `pnpm test` của `pnpm check` **và** trong mọi lần CI — không còn phụ thuộc việc ai đó chạy tới bước `lint:workflows`. Phá thử: bỏ bản sửa `spike-canvas.yml` ra khỏi cây thì bài này **đỏ** với đúng bốn chuỗi (`:47`, `:69`, `:84` Z10 và `:63` Z9), khôi phục thì **57/57 xanh**.

---

## KF-021 · Ba số bắt buộc của bước 0 chỉ nằm trong văn xuôi, nên chuỗi kẹt đếm bằng mắt — ba lượt ghi ba con số khác nhau cho cùng một PR

> Số **KF-021**: `KF-019` thuộc PR `#167`, `KF-020` thuộc PR `#168` — cả hai đang mở. Nhận mã trước khi viết bằng cách dò trên `main` **và mọi** nhánh PR đang mở (KF-005, và cảnh báo ở đầu `KF-018`):
>
> ```bash
> for b in $(git branch -r | grep -v HEAD | sed 's/^ *//'); do
>   git show "$b:ops/known-failures.md" 2>/dev/null | grep -o "^## KF-[0-9]*"
> done | sort -u -V | tail -1
> ```

- **Lần gặp:** 1 — bản ghi đầu tiên của chữ ký này. Phát hiện ở lượt `crux-worker-1` ~02:51Z ngày 2026-09-23, khi đếm lại chuỗi của `#120` bằng cách đọc **mọi** dòng bước 0 chứ không chỉ những dòng đã vào `main`.
- **Chữ ký:** hai dòng log bước 0 kề nhau ghi **chuỗi giảm đi** cho cùng một PR với cùng một chữ ký xung đột — ví dụ `streak=2` ở `00:46Z` rồi `streak=1` ở `01:20Z`. Không có gì đỏ: cả hai dòng đều đúng định dạng, `pnpm check` xanh, CI xanh.
- **Đo được, 2026-09-23 (PR `#120`, chữ ký `ops/scripts/digest-metrics.ts` + `ops/test/digest-metrics.test.ts` không đổi suốt bảy lượt):**

  | lượt bước 0 | routine | chuỗi mà lượt đó **ghi ra** | chuỗi **thật** | lượt đó có bật cảnh báo ngưỡng? |
  |---|---|---|---|---|
  | `23:33Z` | `crux-worker-2` | 1 | 1 | — (chưa tới ngưỡng) |
  | `23:38Z` | `crux-worker-1` | 1 | 2 | — (chưa tới ngưỡng) |
  | `00:46Z` | `crux-worker-1` | **2** | **3** | **không** |
  | `01:20Z` | `crux-worker-2` | **1** | **4** | **không** |
  | `01:39Z` | `crux-worker-1` | **3** | **5** | **có** |
  | `02:24Z` | `crux-worker-2` | **2** | **6** | **không** |
  | `02:51Z` | `crux-worker-1` | 7 | 7 | có |

  Chuỗi thật tăng đều `1 → 7`; **chuỗi ghi ra không đơn điệu tăng** — `1 · 1 · 2 · 1 · 3 · 2 · 7`. Hai worker ghi hai con số khác nhau cho **cùng một PR** ở hai lượt cách nhau 19 phút (`01:20Z` ghi 1, `01:39Z` ghi 3).

  `shouldAlertStreak(streak) = streak >= ABORTED_INELIGIBLE_ALERT_THRESHOLD`, và ngưỡng là **3** (chạy thật: `shouldAlertStreak(2) === false`, `shouldAlertStreak(3) === true`). Theo chuỗi thật, ngưỡng chạm từ lượt **`00:46Z`**. Trong năm lượt từ `00:46Z` trở đi, chỉ **một** lượt (`01:39Z`) nói ra rằng bản tin phải mang dòng cảnh báo; ba lượt không.

  > ⚠️ **Bản đầu của mục này viết "không lượt nào bật nó" và "bản tin im lặng bốn lượt liên tiếp". SAI**, và vòng soát ngữ cảnh sạch bắt được bằng cách đọc dòng log thật trên nhánh chưa merge. Lượt `01:39Z` **có** bật: dòng log của nó ghi nguyên văn *"CẢNH BÁO NGƯỠNG — #120 CHẠM `shouldAlertStreak`: streak 3 ≥ `ABORTED_INELIGIBLE_ALERT_THRESHOLD` (3)"*. Giữ lỗi này trong mục vì nó đúng chữ ký `KF-005`: một câu kết luận mạnh hơn phép đo đỡ được nó, viết ra trong chính mục đang cảnh báo về chuyện đó.

  Và chi tiết đắt nhất nằm ngay trong dòng log `01:39Z`: nó **tự khai chỗ lệch** — *"lượt `01:20Z` của `crux-worker-2` đếm 1 vì nó chỉ thấy phần streak sau `21:38Z`"*. Lỗi đã được **quan sát tại chỗ** rồi đi tiếp, vì không có chỗ nào để sửa nó ở mức cơ chế. Lượt `01:39Z` cũng bật cảnh báo ở con số **3** trong khi chuỗi thật lúc đó là **5**.

  Sáu PR (`#39` `#84` `#89` `#112` `#120` `#160`) đều mang nhãn `automerge-delayed`, tức đúng ca mà phụ lục P3 bước 0b bắt bản tin phải nói ra ngay trong dòng "Đang chờ merge".

- **Nguyên nhân gốc — hai lớp, lớp thứ hai mới là gốc:**
  1. *Lớp nhìn thấy trước:* hàng đợi merge đứng (`main` đỏ, `KF-020`), nên mọi dòng bước 0 từ `21:38Z` trở đi nằm trong PR **chưa merge**. Một lượt chỉ nhìn `ops/logs/` của cây làm việc thì không thấy chúng, và đếm lại từ đầu.
  2. *Lớp gốc:* phụ lục P3 bước 0b đòi ba số (giờ kẹt · làn sở hữu · chuỗi liên tiếp) với đúng lý do *"thiếu chúng thì `pickPrToHandle` ở phụ lục P1 bước 2 không có nguồn để đếm"* — nhưng nó **không nói ghi vào đâu**, nên mọi lượt ghi vào `note`, tức **văn xuôi tiếng Việt**. Nguồn để đếm vì thế chưa bao giờ tồn tại ở dạng máy đọc được: mỗi lượt phải đọc lại note của lượt trước bằng mắt. Lớp 1 chỉ làm lỗi này lộ ra; kể cả khi hàng đợi chạy bình thường, hai worker song song vẫn đếm lệch nhau.
- **Vì sao nó đắt hơn vẻ ngoài:** ba số đó không phải ghi chép cho người đọc. `abortedIneligibleStreak` và `redAfterMergeStreak` là **đầu vào của `pickPrToHandle`** (phụ lục P1 bước 2), và `shouldAlertStreak` là cổng duy nhất bắt bản tin lên tiếng về một PR kẹt lâu. Đếm thiếu thì PR kẹt lâu nhất không bao giờ chạm ngưỡng, không bao giờ vào bản tin, và chủ dự án không bao giờ thấy nó — trong khi mọi chỉ báo đều xanh.
- **Đã sửa ở đâu:** `kernel/src/log.ts`. `RunLogLine` có thêm trường tuỳ chọn `step0?: readonly Step0Stuck[]` — mỗi PR bỏ lại là **một bản ghi có cấu trúc** (`pr`, `outcome`, `signature`, `hoursStuck`, `lane`), và `formatLogLine` ghi nó ra. `step0Streaks(lines)` đếm chuỗi đang chạy từ những bản ghi đó. Sửa ở chỗ **hình dạng dữ liệu**, không vá bằng cách dặn worker đọc kỹ hơn — dặn người đọc kỹ hơn là vá sản phẩm (`CLAUDE.md` mục 13).
- **Ba chỗ cố ý bảo thủ trong cách đếm**, vì một con số quá cao còn tệ hơn một con số thiếu ở đây:
  1. Chữ ký phải **khớp qua từng lượt**; đổi file vướng (hay đổi cổng đỏ) là một chỗ kẹt khác, đếm lại từ 1 — cùng luật mà CHARTER mục 13 dùng cho "một chữ ký lỗi ba lần".
  2. Gặp một dòng bước 0 **không có** trường `step0` thì phép đếm **dừng** chứ không đọc nó thành "PR này không kẹt". `readableRunsFromNewest` và `proseOnlyRuns` nói thẳng phép đếm đi được bao xa, nên bên gọi biết khi nào con số của mình là **cận dưới**. Đây là chỗ dễ tái phát nhất: mọi dòng bước 0 hiện có đều là văn xuôi, nên ở lượt kế tiếp `readableRunsFromNewest` bằng **1**.
  3. **Một lượt đếm một lần cho mỗi chữ ký.** `merge=union` không khử trùng lặp (xem `.gitattributes`), nên một lượt có thể mang hai dòng y hệt nhau; cộng chúng thành 2 là làm chuỗi phồng lên, mà một con số quá cao còn tệ hơn một con số thiếu ở đây.

- **Hai chữ ký có HAI luật trở về 0, và trộn chúng là cách lỗi `P-025` quay lại.** Vòng soát ngữ cảnh sạch bắt được điều này ở bản đầu của `step0Streaks`, vốn áp luật "vắng mặt là hết chuỗi" cho cả hai:
  - `aborted-ineligible` — bước 0a đo lại PR này ở **mọi** lượt, nên **vắng mặt LÀ bằng chứng**, chuỗi về 0.
  - `red-after-merge` — CHARTER phụ lục P3 bước 0b nói thẳng: PR kiểu này đã gộp sạch, mà 0a chỉ liệt kê PR *đang xung đột*, nên *"nó không bao giờ được đo lại ở đây"*. **Vắng mặt KHÔNG phải bằng chứng**; luật trở về 0 của nó là *"PR có commit mới sau dòng log đó"*, tức dữ liệu commit mà `step0Streaks` không có. Hàm trả `redAfterMergeLastSeenAt` để bên gọi tự áp luật đó bằng phép đo nó đã có (`hoursSinceLastCommit`).

  Áp nhầm một luật cho cả hai làm mọi chuỗi `red-after-merge` tụt về 0 sau **đúng một lượt**, tức xoá sạch ca "gộp sạch rồi đỏ" mà `P-025` (issue `#107`, PR `#109`) vừa thêm vào `pickPrToHandle` — và lại không gì đỏ. Đúng nhóm Z mà mục này đang chữa, lần này do chính bản vá sinh ra.
- **Máy chặn từ nay:** `kernel/test/step0-streak.test.ts`, chạy trong `pnpm test`. **16 bài**, trong đó bài tái hiện dựng lại đúng bảy lượt thật của `#120` và đòi ra **7**, cộng một bài đối chứng cho thấy phép đếm cũ (chỉ nhìn lượt mới nhất) ra **1** — tức đúng con số đã bị ghi sai. Phá thử ba lần, mỗi lần khôi phục rồi chạy lại: bắt `aborted-ineligible` chỉ đọc lượt mới nhất → **7 bài đỏ**; áp luật "vắng mặt là hết chuỗi" cho `red-after-merge` → **1 bài đỏ**; bỏ khử trùng lặp trong một lượt → **4 bài đỏ**. Khôi phục → **16/16 xanh**.

  **Còn thiếu, khai chứ không giấu:** chưa có lớp máy nào bắt một lượt bước 0 **quên** ghi trường `step0` — dòng đó vẫn hợp lệ và `misfiledLogLines` không đỏ. Tới khi có, lớp chặn là dòng này: **một dòng bước 0 báo có PR bị bỏ lại mà không mang trường `step0` là một dòng chưa viết xong.**

## KF-023 · Luật đọc "dấu treo" bắt theo **chuỗi chữ**, nên cùng một ý viết khác chữ thì lọt — lần thứ hai, và lần này nó mở khoá một `deps`

> Số **KF-023**: `KF-022` thuộc PR `#194` (nhánh `claude/dreamy-ride-t9gnbd`), đang mở. Dò trên `main` **và mọi** nhánh PR đang mở trước khi nhận mã, đúng cách `KF-021` dặn.

- **Lần gặp:** 2. Lần một: vòng soát chéo của mục `I-010` bắt bốn mục (`P-011`, `P-013`, `P-016`, `I-002`) bị lật sang `done` trong khi thân mục chặn bằng lời; cách chữa lúc đó là **thêm chuỗi** vào `HOLD_MARKERS`. Lần hai: lượt `crux-worker-1` ~21:48Z ngày 2026-09-23 chạy `pnpm backlog:status -- --fix` trên `main` ở `402444b` và lật thêm **ba** mục cùng kiểu — `editorial/E-001`, `platform/P-010`, `platform/P-007`. Vòng soát ngữ cảnh sạch bắt lại trước khi PR rời nháp.
- **Chữ ký:** `pnpm backlog:status` xếp một mục vào nhóm `stale` trong khi thân mục nói bằng lời rằng nó chưa được đóng. Không gì đỏ: tiêu đề commit đúng dạng, không có `Revert`, `pnpm check` xanh, CI xanh. Mục lặng lẽ thành `done` và một `deps` mở khoá theo.
- **Đo được, 2026-09-23** — ba câu lọt lưới, và vì sao:

  | Mục | Câu trong thân mục | Chuỗi đã có | Vì sao không khớp |
  |---|---|---|---|
  | `editorial/E-001` | "mục này vẫn **không** tự chuyển `done`" | `chỉ chuyển \`done\`` | "tự chuyển" thay cho "chỉ chuyển" |
  | `platform/P-010` | "phải đọc đúng lần chạy thật đó **trước khi coi mục này `done`**" | — | không chuỗi nào phủ |
  | `platform/P-007` | "mục này **chỉ `done` khi** bản tin thật in ra…" | `chỉ đóng khi` | `done` thay cho `đóng` |

- **Vì sao nó đắt hơn vẻ ngoài:** `E-001` là `deps` **trực tiếp** của `E-003` và `E-004`, và **bắc cầu** của `E-005`. Lật nhầm nó mở khoá cả một nhánh việc của làn `editorial` — và đây **không phải một chiếu**: bản nháp đầu của chính lượt này **đã** khai ra rằng `E-003`/`E-004` được mở khoá và lượt sau sẽ nhận `E-003`, rồi phải đính chính. Lỗi này không nằm yên; nó đã sinh ra một kết luận sai trong vòng đúng một lượt. `P-010` và `P-007` không phải `deps` của mục nào, nhưng cả hai **hẹn một bằng chứng chưa tồn tại** (một lần `ops/workflows/**` đổi kế tiếp; một lượt `crux-digest` chạy thật). Lật sang `done` là xoá mốc hẹn, và không ai quay lại.
- **Nguyên nhân gốc:** `HOLD_MARKERS` là một danh sách **chuỗi con**, tức nó bắt *cách viết* chứ không bắt *ý*. Tiếng Việt có nhiều cách nói cùng một ý ("không tự chuyển `done`", "chỉ `done` khi", "trước khi coi mục này `done`"), nên mọi danh sách chuỗi đều thủng ở đúng câu chưa ai nghĩ tới. Đây là **giới hạn còn lại của thiết kế**, không phải một lỗi đã hết: xem phần dưới.
- **Đã sửa ở đâu:** `ops/scripts/backlog-status.ts` — ba chuỗi đo từ ba ca thật được thêm vào `HOLD_MARKERS`: `tự chuyển \`done\``, `chỉ \`done\` khi`, `coi mục này \`done\``. Chuỗi thứ ba cố ý **bỏ hai chữ "trước khi"** của câu gốc — phần mang nghĩa nằm ở đoạn sau, và giữ nguyên cả câu là vá đúng một ca (vòng soát ngữ cảnh sạch nêu đúng chỗ này). Sửa ở tầng luật, **không** sửa tay ba dòng `status` của ba mục: vá sản phẩm ở lần gặp thứ hai là đúng thứ `CLAUDE.md` mục 13 cấm. Sau khi sửa, `--fix` trên cùng một nền lật **16** mục thay vì 19, và ba mục kia nằm đúng nhóm `held`.
- **Máy chặn từ nay:** hai tầng, cả hai ở `ops/scripts/backlog-status.ts` với test ở `ops/test/backlog-status.test.ts` (chạy trong `pnpm test`):
  - **Tầng nguồn (mục `I-020`):** trường `- hold: <lý do>` mà tool đọc như `- status:`/`- deps:` (`HOLD_FIELD`, `holdField`, `heldReason`). Có trường thì mục KHÔNG bao giờ bị lật — `classify` và `applyFix` đều chặn. Đây là **nguồn quyết định**; nó bắt *ý* (mục tự khai) chứ không đoán lời văn, nên không còn lỗ để câu-thứ-N chui qua. Test: `classify … trường`, `heldReason`, `parseBacklog … - hold:`, `applyFix … không bao giờ bị lật`.
  - **Tầng lưới dự phòng:** `HOLD_MARKERS` giữ nguyên cho mục chưa kịp khai trường; ba biến thể lần ba (`coi mục này`, `chỉ done khi`, `chưa đóng`) nay nằm trong lưới — bài `HOLD_MARKERS: ba biến thể lần ba nay đã vào lưới dự phòng` đổi ba `assert` từ `false` sang `true`. `pnpm backlog:status` in `heldByProse` = số mục còn dựa vào lưới, tức **nợ nhìn thấy được**; sau `I-020` con số đó = 0 (đã khai trường cho 35 mục nhóm `held`).
  - **Lưới đó nay là MẪU, không phải chuỗi con** (PR `#222`, bổ sung sau `#221`): `HOLD_MARKERS` là mẫu RegExp chạy trên văn bản đã chuẩn hoá bằng `normalizeForHold` (bỏ dấu nhấn Markdown, gộp khoảng trắng, hạ hoa thường). Lý do đổi cơ chế thay vì thêm chuỗi lần thứ ba: `CLAUDE.md` mục 13 cấm vá sản phẩm ở lần gặp thứ hai, và chuẩn hoá làm tan cả một **lớp** biến thể thay vì đúng một câu — `done` viết trần và `done` bọc dấu nháy ngược thành một chữ (ca `P-007` lọt lưới chỉ vì hai dấu nháy ngược), một câu bị ngắt dòng giữa hai chữ vẫn bắt được. Đo được: lưới rộng hơn lật thêm **0** mục trên dữ liệu thật (`held` 36/36 và `stale` 6/6 giống hệt `main`). Phá thử: gỡ bước bỏ dấu nhấn Markdown → 4 bài đỏ.
  - **Phần nợ nay CÓ MÁY CANH, không chỉ được in ra** (PR `#222`): bài `nợ lời văn của backlog THẬT phải ở 0` đọc `ops/lanes/**/backlog.md` thật (chỉ mục ở `review`) và đỏ **kèm tên mục**. Trước nó, gỡ một dòng khai trường khỏi backlog thật thì **0 bài đỏ** — `heldByProse` chỉ là một con số in ra, tức đúng nhóm **Z**. Bài này bắt được một ca thật ngay lần chạy đầu: `platform/P-034` (merge `#198`, SAU `#221`) ở `review` và chỉ được giữ bởi lời văn; chữa bằng cách khai trường cho nó, nên `heldByProse` về 0 lần nữa.
- **Đã thoát (mục `I-020`), không còn "còn thiếu":** trước `I-020`, danh sách chuỗi con là nguồn DUY NHẤT và không bao giờ hội tụ — câu thứ N viết khác chữ vẫn lọt. Nay nguồn là **trường**, lưới chuỗi chỉ là dự phòng, nên được phép nới rộng về hướng an toàn mà không phải gánh trọng trách hội tụ. Lớp chặn thành một câu: **một mục không muốn bị lật phải nói ra bằng một trường `- hold:`, không bằng một câu văn** — và `heldByProse` canh phần nợ chưa khai trường.

## KF-016 · Hai khoá `env:` trong một step làm cả `smoke-workflows.yml` thành YAML không hợp lệ — đỏ ở mọi lần push, `pnpm lint:workflows` không bắt

> Số **KF-016** chứ không phải KF-015: `KF-015` đã có chủ (mục `I-017`), `KF-014` đang ở PR `#142`. Nhận mã trước khi viết là cách hai worker không cùng lấy một số.

- **Lần gặp:** 1 — phát hiện ở lượt `crux-worker-2` ~2026-09-22T19:18Z. `smoke-workflows.yml` chạy 8 lần (run #1–#8, từ 16:55Z tới 18:53Z, mọi lần `event: push`) đều `conclusion: failure`. Sáu PR đang mở mang một check đỏ vì nó: `#65`, `#154`, `#155`, `#156`, `#157`, `#159` — trong đó `#154`–`#159` chỉ là PR dòng-log, diff của chúng không đụng workflow nào.
- **Chữ ký:** một lần chạy workflow ra `failure` với **0 job** (`get_job_logs` trả `total_jobs: 0`, `startup_failure`). File có hai khoá `env:` liền nhau trong cùng một step (step `Xác định commit và workflow vừa đổi`: một `env:` cho `EVENT_SHA`/`INPUT_SHA`, một `env:` thứ hai cho `EVENT_BEFORE`).
- **Nguyên nhân gốc:** một mapping YAML không được có hai khoá cùng tên. GitHub từ chối **cả workflow** ở mức khởi động, nên nó đỏ ở **mọi** lần push mà không chạy tới một job nào. Lỗi chỉ hiện ra **sau khi merge** — agent không ghi được `.github/`, nên bản trong `ops/workflows/` không bao giờ chạy trước khi merge (đúng lý do `smoke-workflows.yml` tồn tại, mà chính nó lại dính). `pnpm lint:workflows` cũ không bắt: nó chạy `bash -n` trên khối `run:` và soát `permissions`, nhưng **không dựng cây YAML** nên không thấy khoá trùng — xanh ở chỗ rẻ, đỏ ở chỗ đắt (nhóm Z).
- **Đã sửa ở đâu:** gộp hai khoá `env:` thành một trong `ops/workflows/smoke-workflows.yml` (sửa file cấu hình, không vá sản phẩm). Không đụng cơ chế nào của workflow — ba biến môi trường giữ nguyên, chỉ nằm chung một khối.
- **Máy chặn từ nay:** `ops/scripts/check-workflows.ts` — hàm mới `duplicateMappingKeys(source, file)` dò khoá trùng trong cùng một mapping theo thụt lề (bỏ qua thân khối scalar `|`/`>`; mỗi phần tử `- ` là một mapping riêng nên hai `- name:` liền nhau không tính). Chạy trong `pnpm lint:workflows` (cổng `pnpm check`, job `check` của CI). Test ở `ops/test/check-workflows.test.ts`: ca âm hai `env:` trong một step phải đỏ, ca âm hai `on:` gốc phải đỏ, và ba ca dương (hai `- name:` liền nhau, nội dung trong `run: |`, cả cây `ops/workflows/` thật) phải sạch. Đo được là đỏ thật khi chạy trên bản `smoke-workflows.yml` trước khi sửa (dòng 98, lần đầu ở dòng 93).

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

---

## KF-022 · `digest-metrics.ts` đếm 0 lượt routine sau khi P-023 vào `main` — `isStep0Line` chỉ khớp file phẳng cũ

> Số **KF-022**: dò `## KF-` trên `main` **và mọi** nhánh PR đang mở (KF-005), cao nhất là `KF-021`, nên `KF-022` không đụng ai.

- **Lần gặp:** 1 — bản ghi đầu tiên. Quan sát trên bản tin `#193` (2026-09-23): mục "Tiến độ" in `Lượt chạy routine 24h: 0` kèm ⚠️ tự khai lỗi; chủ dự án nhắc lại trong câu trả lời bản tin (`14:18Z`) và giao một worker sửa.
- **Chữ ký:** `renderDigestMetrics` in `Lượt chạy routine 24h: 0` trong khi `ops/logs/integration/step0-*.jsonl` có hàng chục dòng bước 0 trong 24 giờ. Không gì đỏ: `pnpm check` xanh, CI xanh, số chỉ **sai**.
- **Nguyên nhân gốc:** `routineRuns24h` lọc dòng bước 0 bằng `isStep0Line`, mà hàm đó so `ref === 'platform/P-016'` — hình dạng file phẳng **trước** `P-023`. Mục `platform/P-023` chuyển dòng bước 0 sang một file mỗi lượt, `ref` do `step0LogRef` sinh (`integration/step0-<mốc>-<routine>`), nên không dòng mới nào khớp. Comment doc của chính `isStep0Line` đã **khai trước** đúng lỗ này ("khi P-023 vào `main`, mở rộng cho khớp — nếu không số lượt tụt về 0 một cách im lặng") nhưng việc mở rộng chưa ai làm. Cùng hình dạng nhóm **Z**: một luật đã biết trước, một thay đổi làm nó sai, không lần chạy nào đặt hai thứ cạnh nhau.
- **Đã sửa ở đâu:** `ops/scripts/digest-metrics.ts` — `isStep0Line` nay nhận cả hai hình dạng `ref`: file phẳng cũ (`platform/P-016`) và hình dạng P-023 (`isStep0LogId(logIdFromRef(ref))`). Lọc theo **phần mã** `step0-…`, không neo vào một `ref` cứng — cùng lẽ với `readRunLogs` quét cả thư mục.
- **Máy chặn từ nay:** `ops/test/digest-metrics.test.ts` — bài `P-036` dựng dòng bước 0 bằng chính `step0LogRef` và đòi `routineRuns24h` đếm cả chúng (bất biến I2). Phá thử: khôi phục `isStep0Line` cũ → bài đỏ (đếm 1 thay vì 3). Còn hở, ghi rõ: bài này khoá phép **đếm**; nó không khoá được việc một hình dạng `ref` bước 0 **thứ ba** trong tương lai lại rơi khỏi phép lọc — nhưng nay phép lọc dựa trên `isStep0LogId` của kernel (một chỗ sinh mã), nên một hình dạng mới chỉ cần đi qua `step0LogId` là tự khớp.

## KF-027 · Tiền tố 🤖 mà `CLAUDE.md` mục 5 bắt buộc làm mù mọi bộ đọc tiêu đề neo `^` — hai luật đúng riêng lẻ, cắn nhau khi gặp

> Số **KF-027**: dò `## KF-` trên `main` **và** trên `refs/pull/N/head` của cả 9 PR đang mở (KF-005), cao nhất là `KF-026` (`#226`), nên `KF-027` không đụng ai.

- **Lần gặp:** 5 — và mọi lần trước đều đã được nhìn thấy mà chưa ai chữa gốc. Hai lần cuối do **vòng soát ngữ cảnh sạch của chính PR sửa lỗi này** tìm ra, sau khi bản đầu của nó khai nhầm là "chỉ hai chỗ".

  | # | Chỗ | Ai thấy | Kết cục |
  |---|---|---|---|
  | 1 | `claimKeyFromTitle` (`ops/scripts/claim-collision.ts`) | vòng soát ngữ cảnh sạch của `#225`, điểm **C2** | vá **tại chỗ** trong chính PR đó |
  | 2 | `hasCompletionCommit` (`ops/scripts/backlog-status.ts`) | cùng vòng soát `#225` | khai "đáng một mục backlog riêng", **không ai nhận** |
  | 3 | `laneFromTitle` (`ops/scripts/digest-metrics.ts`) | lượt `crux-worker-1` ~07:4xZ 2026-09-24, khi nhận mục `P-042` | chữa cùng lần này |
| 4 | `hasRevertCommit` (`ops/scripts/backlog-status.ts`) — phép nhận diện chữ `Revert` neo vị trí 0, dù phép tìm mã mục thì không | vòng soát ngữ cảnh sạch của `#228`, mức **CHẶN** | chữa cùng lần này |
| 5 | `isToolCommit` (`ops/scripts/recheck-assumptions.ts`) — cả bốn luật danh sách trắng đều neo `^` | cùng vòng soát `#228` | chữa cùng lần này |

  **Lần 4 là lần đáng sợ nhất, và nó do chính bản sửa mở ra.** Trước `P-042`, `hasCompletionCommit` trả `false` cho tiêu đề có tiền tố, nên một mục bị revert không bao giờ tới được phép kiểm `hasRevertCommit`. Sau `P-042`, nó tới — và nếu `hasRevertCommit` còn mù thì mục **đã bị revert khỏi `main`** được lật sang `done`, mở khoá mọi `deps` trỏ vào code không còn tồn tại. Một bản sửa nhóm Z mở ra một lỗ nhóm Z sâu hơn là hình dạng đáng ghi riêng; nó chỉ lộ ra vì vòng soát tự phá thử thay vì đọc lời khai của PR (bản đầu khai ở **ba** chỗ rằng `hasRevertCommit` miễn nhiễm — cả ba đều sai).

- **Chữ ký:** một bộ đọc tiêu đề trả `false`/`null` cho một tiêu đề đúng quy ước. Không gì đỏ — `pnpm check` xanh, CI xanh, `git log` vẫn có commit, backlog vẫn hợp lệ; chỉ **kết luận** là sai. Nhóm **Z**.
- **Nguyên nhân gốc:** hai luật của repo đều đúng, và chúng cắn nhau ở đúng ký tự đầu tiên.
  - `CLAUDE.md` mục 5: mọi thứ agent viết **bắt đầu bằng 🤖**, không ngoại lệ — đó là dấu vết duy nhất phân biệt người với máy khi agent dùng danh tính chủ dự án (CHARTER 3.1, mặc định M6).
  - Phụ lục P1 bước 4: tiêu đề PR dạng `[<lane>] <id> — …`, và mọi bộ đọc neo `^\[`.

  Squash-merge giữ nguyên tiêu đề PR, nên tiền tố đi thẳng vào commit subject trên `main`. Đo được (`e4a5931`, 2026-09-24): **30 / 213** commit subject mang tiền tố 🤖. Ca thật: `🤖 [platform] P-038 — … (#212)` — `hasCompletionCommit('platform','P-038',…)` trả `false`, mục không bao giờ được nhận là đã xong.
- **Cái giá, đo được chứ không suy:** vế `laneFromTitle` gửi một **con số sai tới chủ dự án**. PR không được tính vào "số mục done 24 giờ" thì mục **Tiến độ** của bản tin (`platform/P-019`) báo thông lượng thấp hơn thật và ngày dự kiến xong muộn hơn thật — đúng thứ bất biến **I6** ("mọi con số hiển thị có nguồn") tồn tại để chặn.
- **Đã sửa ở đâu:** `ops/scripts/agent-prefix.ts` (mới) — `stripAgentPrefix` là **một** chỗ giữ luật, và **bốn** bộ đọc gọi nó: `hasCompletionCommit`, `hasRevertCommit`, `laneFromTitle`, `isToolCommit`. Vá tại chỗ lần thứ ba là mời lần thứ tư (`CLAUDE.md` mục 13: lỗi cùng loại lần thứ hai thì sửa cơ chế, không vá sản phẩm).
- **Máy chặn từ nay:** ba bài **tái hiện lỗi** (bất biến I2) dựng trên tiêu đề PR **thật** đã merge — `ops/test/backlog-status.test.ts` (`#212`), `ops/test/digest-metrics.test.ts` (`#212`, `#227`, cộng một phép đếm đầu-cuối) — và `ops/test/agent-prefix.test.ts` khoá chiều ngược lại: bỏ tiền tố **quá tay** cũng phải đỏ. Phá thử, mỗi phép đỏ đúng chỗ rồi khôi phục: gỡ `stripAgentPrefix` khỏi hai bộ đọc → 4 bài đỏ; bỏ 🤖 ở mọi chỗ trong chuỗi → 3 bài đỏ; bỏ lặp lại nhiều lần → 1 bài đỏ; thêm `trim()` hộ bên gọi → 1 bài đỏ.
- **Bài học về cách soát, không chỉ về cách sửa:** bản đầu của `#228` tự khai "hai chỗ, đã quét hết" và khai `hasRevertCommit` miễn nhiễm. Cả hai lời khai đều sai, và **không lời khai nào đỏ** — chỉ phá thử mới bắt được. Bốn phép phá mà vòng soát dựng ra đều cho **0 bài đỏ** trên bản đầu: gỡ bản sửa `hasRevertCommit`, gỡ bản sửa `isToolCommit`, bỏ neo `^` ở cả hai bộ đọc, và cho `computeProgress` tự neo `^` lại. Nay cả bốn đều có bài khoá. Đây là lý do CHARTER 6.4 đòi vòng soát **ngữ cảnh sạch** chứ không phải một lượt đọc lại của chính người viết.
- **Còn hở, ghi rõ:** `claimKeyFromTitle` của `P-041` (`#225`, đang mở) vẫn mang bản vá tại chỗ của riêng nó. Không gộp ở đây vì file đó chưa trên `main` và sửa nó sẽ chồng lên một PR đang mở — đã khai thành tiêu chí còn lại `⬜` của mục `P-042`.
