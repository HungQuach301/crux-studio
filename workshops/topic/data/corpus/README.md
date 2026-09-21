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

Corpus **mẫu**, 36 video, dựng bằng tay để ba module của `T-008` có dữ liệu chạy thật khi chưa có khoá API
(xem `T-011`). Nó không phải dữ liệu thu được từ nền tảng, và `quota.limits.source` ghi `vendor-docs` —
đúng như mọi corpus khác cho tới khi có người đọc Cloud Console (giả định **G19**).
