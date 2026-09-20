# 🤖 Tập vàng `ep-0001-stub`

Cổng chống trôi chất lượng của nhà máy (CHARTER 6.1).

- `manifest.json` — tập, kênh, mốc thời gian cố định, cờ `impl`.
- `cassette.json` — băng ghi phản hồi của LLM, TTS và sinh ảnh. **Rỗng ở Đợt 0**, vì sáu xưởng đều là stub và chưa gọi ra ngoài. Ranh giới đã có sẵn: khi một xưởng lên `v1`, phản hồi của nó được ghi vào đây, và mọi lời gọi chưa có trong băng sẽ ném lỗi ở chế độ replay. Nhờ vậy CI không bao giờ vô tình gọi API trả tiền.
- `snapshots/<xưởng>.json` — output đã đông cứng của từng xưởng.

```bash
pnpm replay              # so với snapshot; lệch một byte là đỏ
pnpm replay -- --update  # ghi lại snapshot — CHỈ trong PR riêng, có giải thích
```

Snapshot đổi mà không có giải thích là một PR bị từ chối, không phải một PR cần sửa nhỏ.
