# 🤖 Backlog làn `kernel` — Đợt 1

Làn nền. **Contract v0 cố ý để lỏng. Siết lại sau tập thật đầu tiên, không phải trước** (CHARTER 5.2, rủi ro B2).

---

### K-002 · Contract cho artifact của lõi định lượng
`snapshot`, `model`, `thesis` — ba artifact mà xưởng `topic` cần khi lên `v1`.

- deps: T-003
- risk: low
- status: review
- hold: còn treo có chủ đích — snapshot.schema.json và thesis.schema.json chưa mở
- nguồn: spec `snapshot.schema.json`, `model.schema.json`, `thesis.schema.json`
- tiêu chí xong:
  - ✅ `model` có `verification` với đủ bốn cấp, và agent **không** đặt được `verified` (D-C02). `kernel/contracts/model.schema.json` (chuyển từ `workshops/topic/contracts/model.v0.schema.json`, `topic/T-005` đã xây `verification.tiers` bốn cấp và khoá `verified` ở tầng kiểu của `model-verify.ts` — không đổi khi chuyển chỗ). `pnpm contracts` việc số 8 nay validate cả 8 file `workshops/topic/data/models/*.json` của `T-006` theo contract này — trước đó chỉ có test riêng của xưởng `topic` canh.
  - ✅ Mở mục này khi làn `topic` cần, không mở trước. `model` đã có người tiêu thụ thật (`T-005`/`T-006`, 8 file đã persist) nên được chuyển. `snapshot` và `thesis` **chưa** — `snapshot` chưa có file nào persist ngoài dữ liệu test tổng hợp (`T-003` gọi API qua `transport` tiêm vào, Đợt 0 không gọi API trả tiền), và `thesis` chưa được xây (`topic/T-009` Thesis Engine còn `ready`, chưa nhận). Đưa hai schema đó vào kernel bây giờ đúng là "contract không có người tiêu thụ" mà tiêu chí này cấm — để lại cho lượt khi `T-003` có nơi ghi snapshot thật hoặc `T-009` bắt đầu.
- **Còn treo, có chủ đích (chưa `done`):** `kernel/contracts/snapshot.schema.json` và `kernel/contracts/thesis.schema.json` chưa mở, đúng lý do ở trên.

### K-003 · Hỗ trợ đồng thời `schemaVersion` N và N-1
Hiện `isSupportedSchemaVersion` mới có N = 0 nên chưa có gì để chứng minh. Mục này làm cho luật đó có thật.

- deps: K-002
- risk: high
- status: ready
- nguồn: CHARTER 5.2
- tiêu chí xong:
  - Có ít nhất một xưởng đọc được artifact phiên bản N-1 và test chứng minh điều đó.
  - Tăng `schemaVersion` là quyết định `irreversible` nếu nó đổi phong bì.

### K-004 · Lưu nhị phân qua Actions artifact hoặc Releases
Audio, video, ảnh không commit (CHARTER 5.3). Hiện các trường `*Ref` mới là con trỏ dạng chuỗi.

- deps: A-001
- risk: low
- status: ready
- nguồn: CHARTER 5.3
- tiêu chí xong:
  - `artifact://` giải được thành một địa chỉ tải thật.
  - Chuyển sang object storage là một quyết định riêng, không nằm trong mục này.

### K-005 · Siết contract v0 sau tập thật đầu tiên
- deps: T-010, E-005, V-006, AU-005, A-006, R-005
- risk: high
- status: parked
- nguồn: CHARTER 5.2
- tiêu chí xong: `parked` cho tới khi có tập thật đầu tiên. Siết trước đó là chốt contract quá sớm (rủi ro B2).
