# 🤖 Thesis Bank — `us-personal-finance`

> Chuyển từ `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `channels/us-personal-finance/thesis-bank.md`
> (mục `T-002`). Nội dung nghiệp vụ giữ nguyên văn; chỉ tham chiếu được chuyển:
>
> | Trong spec | Ở đây |
> |---|---|
> | `thesis.schema.json` | `kernel/contracts/` — **chưa có**, contract của lõi định lượng là mục `kernel/K-002` |
> | `thesis-bank/` | `packs/channels/us-personal-finance/thesis-bank/` — **chưa có**, do mục `topic/T-009` (Thesis Engine) tạo |
> | `engine/docs/14-quantitative-core.md` mục 4 | `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `engine/docs/14-quantitative-core.md` (PHẦN D), mục 4 |

## Bank là gì

Kho luận điểm đã đạt chuẩn, chờ được chọn ở Gate 1. Mỗi mục theo contract của thesis, nằm
trong thư mục `thesis-bank/`.

**Bank phải luôn có ≥15 mục ở trạng thái khả dụng.** Dưới ngưỡng thì ngừng nhận tập mới và
mở issue. Đây là ràng buộc cứng, không phải mục tiêu.

## Bank được nạp bằng máy, không bằng nghi thức

Phép tính đơn giản cho thấy vì sao: một nghi thức nạp thủ công tốt cho khoảng 12–20 thesis
mỗi tháng. Nhịp mục tiêu cần 30 mỗi tháng cho một kênh. Với mô hình người chỉ phê duyệt, cung
thủ công bằng 0.

**Nút thắt thật của nhà máy là thesis** — không phải render, không phải chi phí, không phải
thời gian gate. Nhịp bền vững bằng tốc độ Thesis Engine sinh thesis đạt chuẩn.

Đặc tả engine: `docs/spec/CRUX-REFERENCE-SPEC.md`, khối `engine/docs/14-quantitative-core.md`
mục 4.

## Thế nào là một thesis đạt chuẩn

Bốn điều kiện, thiếu một là loại:

1. **Có điều bị phản bác.** Trường `contradicts` không rỗng. Một quan sát đúng nhưng không
   thách thức gì thì không phải thesis.
2. **Kiểm được bằng số.** Phải dựng được thành ma trận ngưỡng ba tầng.
3. **Mới lạ.** Kiểm tự động với corpus đối thủ, không khai tay.
4. **Có nguồn gốc rõ.** Trường `origin.source` là một trong năm nguồn, kèm bằng chứng.

## Vòng phản hồi

Mọi thesis bị bác ở Gate 1 phải ghi `rejectionReason`. Đây là đầu vào duy nhất để cải thiện
engine — thiếu nó thì engine sẽ lặp lại cùng loại thesis kém mãi mãi.

Rà `rejectionReason` hằng tháng, tìm điểm chung, sửa tiêu chí chấm trong Genre Pack.
