# 🤖 Spike canvas liên tục — mục `visual/V-002`

Trả lời **bằng số đo thật** câu hỏi của quyết định `D-04` và spec WP-003: canvas liên tục
6000×3400 với máy quay di chuyển có chạy nổi trên runner tiêu chuẩn không, và ở cấu hình nào
thì chuyển động chấp nhận được. Kết quả là số đo cho giả định **G5** trong `docs/assumptions.md`.

**Kết quả nằm ở [`RESULT.md`](./RESULT.md)** — file đó do `report.ts` sinh ra, đừng sửa tay.

## File nào làm gì

| File | Việc |
|---|---|
| `scene.html` | Cảnh thử 3 phút. Một canvas lớn 6000×3400 vẽ một lần; mỗi khung là một lần `drawImage` cắt vùng máy quay ra 1920×1080 — đúng kiến trúc `D-04`. |
| `camera.js` | Đường đi máy quay, mức trộn morph, vùng cắt. Tách riêng và viết bằng JavaScript thuần để vừa nạp được từ `scene.html` bằng `<script type="module">`, vừa kiểm được bằng `node --test`. |
| `render.ts` | Lái Chromium qua giao thức DevTools và đẩy khung hình vào `ffmpeg`. Đo tách thời gian vẽ cảnh và thời gian lấy khung ra khỏi trình duyệt. |
| `run.ts` | Chạy bốn cấu hình, ghi `measurements.json` ngay sau mỗi cấu hình. |
| `report.ts` | Sinh `RESULT.md` từ `measurements.json`. |
| `test/camera.test.ts` | Khoá các bất biến của đường đi máy quay. |

## Chạy

```bash
node spike/canvas/run.ts --out spike-out                                      # cả bốn cấu hình
node spike/canvas/run.ts --out spike-out --config base-30-noblur --frames 60  # đo thử rẻ
node spike/canvas/report.ts --in spike-out                                    # sinh lại RESULT.md
```

Trên Actions: workflow `spike-canvas` (`workflow_dispatch`), xem `ops/workflows/spike-canvas.yml`.
Clip là nhị phân nên **không commit** (CHARTER 5.3) — chúng ra theo artifact `spike-canvas`.

## Không thêm phụ thuộc nào

Spec WP-003 mục 5 nêu một thư viện dựng hình React. Spike này **không** dùng nó: chọn thư viện
đó là **chọn nhà cung cấp** kèm điều khoản thương mại, tức nhóm `irreversible` số 3 của
CHARTER 2.3, và mục 7c của chính WP-003 còn đòi ghi lại điều khoản giấy phép — thứ mà bức
tường mạng (issue #36) không cho đọc.

Câu hỏi của spike là câu hỏi **kiến trúc**, không phải câu hỏi thư viện. Đo bằng canvas 2D
trần cho ra **cận dưới** đúng nghĩa cho mọi thư viện dựng trên cùng nền trình duyệt, và tách
được chi phí của ngữ pháp chuyển động khỏi chi phí của thư viện. Việc chốt thư viện thuộc mục
`A-001` (làn `assembly`).
