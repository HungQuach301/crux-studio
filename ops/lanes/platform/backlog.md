# 🤖 Backlog làn `platform` — Đợt 1

Làn nền. Hạ tầng đã đủ dùng sau Đợt 0; phần còn lại là tăng tốc, không phải mở đường.

---

### P-002 · `decision-relay.yml` và routine `crux-decision`
Rút độ trễ trả lời quyết định từ một nhịp worker xuống vài phút.

- deps: VF-G13
- risk: low
- status: ready
- nguồn: CHARTER 2.3, mục 9 (hoãn tới Đợt 1); giả định G13
- tiêu chí xong:
  - Workflow chỉ kích hoạt khi comment **không** bắt đầu bằng 🤖 trên issue có nhãn `decision` — comment của agent không được tự gọi lại chính agent.
  - G13 sai thì mục này `parked`, không tìm cách khác.

### P-003 · Soát chéo bằng GPT trong CI
- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 6.4 (từ Đợt 1)
- tiêu chí xong:
  - Cần secret `OPENAI_API_KEY`; thiếu thì **DỪNG và báo tên secret thiếu**, không tự tạo.
  - Nội dung gửi đi không chứa secret và không chứa nội dung không đáng tin chưa cô lập (bất biến I7).
  - Chi phí mỗi lần soát ghi vào `ops/logs/platform.jsonl`.

### P-004 · Workflow `workshop-<name>.yml` cho sáu xưởng
Mỗi xưởng gọi được độc lập bằng `workflow_dispatch` (CHARTER 5.4, D-12: nối bằng dispatch, không nối bằng sự kiện push).

- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 5.4; quyết định D-12
- tiêu chí xong:
  - Sáu file trong `ops/workflows/`, mỗi file nhận `episode` và `impl`.
  - Mỗi lần chạy ghi một dòng vào `ops/logs/<xưởng>.jsonl` có `costUsd` (bất biến I8).

### P-005 · Script gom số liệu cho bản tin ngày
Routine `crux-digest` không nên tự tính số — nó nên đọc số đã tính.

- deps: —
- risk: low
- status: ready
- nguồn: CHARTER 2.5, phụ lục P2
- tiêu chí xong:
  - Một lệnh in ra: PR merged 24h theo làn, PR đang mở và trạng thái CI, mục `parked`, issue `[QĐ]` đang mở tách theo `reversible`/`irreversible`, chi phí 24h và tích luỹ so với ngân sách.
  - Dòng đầu luôn là `Cần anh quyết: N việc`.

### P-008 · Sửa quyền thiếu trong workflow, và đưa luật quyền vào linter
Workflow `labels` chạy tay thất bại ở bước checkout với `Repository not found` (run #1, commit `32ba4cd`). Nguyên nhân là khối `permissions` thiếu `contents: read`. Rà cả bộ tìm ra một chỗ nữa cùng loại (`watchdog.yml`), và một nghi ngờ thứ ba đã bị chính lần chạy CI bác bỏ — xem KF-003.

- deps: —
- risk: low
- status: review
- nguồn: `ops/known-failures.md` KF-003; CHARTER 3.2, bất biến I4
- tiêu chí xong:
  - ✅ `labels.yml` thêm `contents: read`; `watchdog.yml` thêm `pull-requests: read`. `ci.yml` **không** đổi: `ci` run #1 chứng minh `pull-requests: write` đã đủ để tạo nhãn.
  - ✅ `pnpm lint:workflows` có bảng thao tác → quyền tối thiểu, một luật nhận được nhiều quyền thay thế, kèm test âm tái hiện đúng các lỗi thật.
  - ✅ Nâng action lên bản chạy Node 24: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`. Phiên bản kiểm bằng `git ls-remote` cộng đọc `runs.using` trong `action.yml`, không lấy từ trí nhớ.
  - Còn lại sau khi merge: chạy lại workflow `labels` một lần và xác nhận nó xanh. Đó mới là bằng chứng chạy thật; những dấu ✅ trên chỉ là bằng chứng ở chỗ rẻ.

### P-007 · Xung đột merge phải nhìn thấy được, và không được chặn hàng đợi
Hàng đợi merge là tuần tự (CHARTER mục 7). Một PR xung đột với `main` nằm giữa hàng đợi chặn mọi PR sau nó, và hiện **không có gì báo** — CI vẫn xanh, nhãn `automerge` vẫn còn, PR chỉ đơn giản là không bao giờ được merge. Đây là rủi ro **B7** ở quy mô một PR.

- deps: —
- risk: low
- status: ready
- nguồn: `ops/known-failures.md` KF-002; CHARTER 3.3, mục 7, 2.5
- tiêu chí xong:
  - `automerge.yml` đọc `mergeable` và `mergeable_state` của PR trước khi thử merge. Đang xung đột thì **bỏ qua và ghi lý do vào log của lần chạy**, không thử merge rồi để API báo lỗi — một job đỏ vì lý do đó trông giống hệt một job đỏ vì lỗi thật.
  - GitHub tính `mergeable` bất đồng bộ và trả `null` khi chưa tính xong. Workflow phải xử lý `null` bằng cách **chờ rồi hỏi lại** (vài lần, có giới hạn), không coi `null` là "merge được".
  - Script gom số liệu bản tin (`P-005`) thêm một mục: **PR đang xung đột với `main`**, kèm số giờ đã xung đột. Bản tin có mục này thì một PR bị kẹt không thể nằm im quá một ngày.
  - Routine `crux-integrator` gộp `main` vào các PR xung đột mà nó tự giải quyết được, và gắn `parked` cộng mở `🤖 [QĐ]` cho những PR cần người quyết (hai bên cùng sửa một logic).
  - Có test cho phần quyết định của `automerge.yml`: `mergeable: false` → bỏ qua; `mergeable: null` → hỏi lại; `mergeable: true` cộng đủ bốn điều kiện → merge.

### P-006 · Bảo vệ nhánh bằng ruleset
- deps: VF-G12
- risk: low
- status: ready
- nguồn: CHARTER mục 10 (việc của chủ dự án); giả định G12
- tiêu chí xong:
  - Danh sách status check bắt buộc được ghi vào `docs/decisions/` sau khi chủ dự án bật.
  - Không bật được (gói không cho) thì ghi rõ và dựa vào `automerge.yml` cộng hook.
