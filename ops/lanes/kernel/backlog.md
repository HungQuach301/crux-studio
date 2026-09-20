# 🤖 Backlog làn `kernel` — Đợt 1

Làn nền. **Contract v0 cố ý để lỏng. Siết lại sau tập thật đầu tiên, không phải trước** (CHARTER 5.2, rủi ro B2).

---

### K-002 · Contract cho artifact của lõi định lượng
`snapshot`, `model`, `thesis` — ba artifact mà xưởng `topic` cần khi lên `v1`.

- deps: T-003
- risk: low
- status: ready
- nguồn: spec `snapshot.schema.json`, `model.schema.json`, `thesis.schema.json`
- tiêu chí xong:
  - `model` có `verification` với đủ bốn cấp, và agent **không** đặt được `verified` (D-C02).
  - Mở mục này khi làn `topic` cần, không mở trước — contract không có người tiêu thụ là contract sẽ sai.

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
