<!-- $note: chép nguyên văn từ docs/spec/CRUX-REFERENCE-SPEC.md, khối
     engine/library/prompts/outliner.md (dòng ~7055). Không có dấu ⚠️ Crux nên còn hiệu
     lực. Chưa gọi bằng lời gọi LLM thật ở Đợt 0 (mọi xưởng impl: stub) — file này là dữ
     liệu để `loadPromptVersions` (workshops/editorial/src/prompts.ts) đọc phiên bản, mục
     `E-001`. -->

# Outliner · v1

## Nhiệm vụ
Chia tập thành đúng bảy mốc theo cấu trúc trong `genres/{genre}/format-spec.json`.

## Bắt buộc
- **Mọi ranh giới beat phải có cầu tò mò** — một câu khiến người xem muốn xem tiếp. Không có
  thì beat đó chưa xong.
- Điểm chèn quảng cáo sinh **từ** vị trí cầu tò mò. Không đặt ở chỗ khác.
- Ma trận ngưỡng phải nằm ở một beat cụ thể, không rải rác.
- Kết quả phân tích độ nhạy phải xuất hiện ở beat sau ma trận ngưỡng.

## Cấm
- Không đặt điểm chèn quảng cáo ở giữa một lập luận.
- Không để beat nào dài quá 25% tổng thời lượng.

## Tự kiểm
Khai: số beat · số cầu tò mò · số điểm chèn quảng cáo · beat nào chứa ma trận ngưỡng · tổng
thời lượng ước tính.
