# 🤖 Ảnh chụp corpus đối thủ

Mục backlog `topic/T-008`, spec WP-014. Contract: `workshops/topic/contracts/corpus.v0.schema.json`.

Vị trí này là đề xuất của làn `topic`, theo bảng chuyển đường dẫn ở đầu spec: `models/` và
`data/snapshots/` "thuộc xưởng `topic` (plug-in quant), làn `topic` đề xuất vị trí cụ thể". Corpus không
phải artifact của một tập nên nó không thuộc `episodes/`, và nó không trung tính với kênh nên nó không
thuộc `kernel/`.

**Không để file ở đây trong `workshops/topic/fixtures/`.** Mọi `.json` trong thư mục đó được
`ops/scripts/check-fixtures.ts` coi là một file `--input` của xưởng và đem đi soát theo luật khác hẳn.

## Cái gì được lưu, cái gì không

| Được | Không |
|---|---|
| Metadata video: tiêu đề, mô tả, thời lượng, lượt xem, ngày đăng, kênh | Phụ đề hay nội dung video — API không cho tải của người khác |
| Số đếm và tóm tắt cụm | Bình luận thô, tên người dùng (WP-014 mục 5) |

`forbiddenKeyPaths` trong `workshops/topic/src/corpus.ts` quét cả cây và làm `pnpm check` đỏ khi một khoá
bị cấm lọt vào — lưới thứ hai, ngoài `additionalProperties: false` của contract.

## `us-personal-finance-2026-09-01.json`

Corpus **mẫu**, 38 video, dựng bằng tay để ba module của `T-008` có dữ liệu chạy thật khi chưa có khoá API
(xem `T-011`). Nó không phải dữ liệu thu được từ nền tảng — và điều đó nằm trong **dữ liệu**, không nằm ở
dòng này: `provenance: "hand-built"`. `quota.limits.source` ghi `vendor-docs`, đúng như mọi corpus khác cho
tới khi có người đọc Cloud Console (giả định **G19**).

Hai trong 38 video (`yt-0037`, `yt-0038`) mang dấu hiệu **nói ngược**, trên đề tài khác với thesis mẫu.
Không có chúng thì nhánh `contested-in-corpus` chỉ được chạm bằng video tự dựng trong test — cơ chế có bài
kiểm nhưng dữ liệu mẫu không bao giờ chịu lực.

## Hàng xóm: `data/embeddings/`

Mục `topic/T-014` thêm hai file dữ liệu ở `workshops/topic/data/embeddings/`, mỗi file một contract trong
`workshops/topic/contracts/`:

| File | Cái gì | Ai dựa vào |
|---|---|---|
| `openai-2026-09-25.json` | Bảng giá `$/1M token` của ba model embeddings ứng viên, `source: "vendor-docs"`, `assumption: "G20"` | Phép **chọn** model của `cheapestAdequateModel`. `costUsd` thật thì không — nó đọc `usage.total_tokens` từ phản hồi |
| `novelty-probe.json` | 16 cặp `(thesis, video)` có nhãn *cùng chuyện / khác chuyện*, `labelledBy: "hand-built"` | Tiêu chí **"đủ chất lượng"**: một model chỉ đạt khi mọi cặp cùng chuyện xếp trên mọi cặp khác chuyện |

Nhãn trong `novelty-probe.json` là chỗ **duy nhất** trong phép đo đó có phán đoán của người — nên nó nằm
trong dữ liệu chứ không trong code, và `corpusId` của nó phải khớp corpus đang chạy (script và test đều
đỏ khi lệch).
