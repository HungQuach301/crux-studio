# 🤖 `ops/eval/` — bộ mẫu chấm điểm cho prompt

Mục `editorial/E-003` (CHARTER 6.3 mục 3). Đây là **bộ eval** cho prompt: một
tập mẫu cố định, chạy trong CI, chặn PR đổi prompt nếu chỉ số output tụt quá
dung sai khai trong genre pack.

## Vì sao để ngoài `ops/golden/`

Tập vàng (`ops/golden/`) so **từng byte** và mọi thay đổi snapshot phải đi PR
riêng (CHARTER 6.1, luật golden-solo `ops/scripts/check-golden-pr.ts`). Eval so
**chỉ số máy theo dung sai** (spec tham chiếu §3), không so byte — nên baseline
eval đổi được cùng PR đổi prompt mà không vướng luật golden-solo.

## Bố cục

```
ops/eval/editorial/<id>/
  brief.json             # một tập mẫu: payload topic (câu hỏi + claim + thời lượng)
  expected-metrics.json  # baseline: bộ chỉ số máy đã ghi lại của output stub
```

Quy tắc ba tập (spec §2): cần **ít nhất `minSampleSets` tập** (khai trong genre
pack `limits.promptEval.minSampleSets`, mặc định 3). Đổi prompt phải chứng minh
trên cả ba tập, không phải một.

## Chạy

```bash
pnpm eval:prompt              # cổng: chạy mỗi tập qua xưởng editorial, so baseline
pnpm eval:prompt -- --update  # ghi lại baseline — CHỈ trong PR đổi baseline có chủ đích
```

`pnpm eval:prompt` nằm trong `pnpm check`, nên chạy trong job status check `check`
của `ci.yml` — không thêm job CI mới (đổi tên/thêm job là `irreversible` nhóm 8,
CHARTER 2.3).

## Giới hạn Đợt 0 (ghi thẳng, không giả vờ)

Đợt 0 mọi xưởng ở `impl: stub` và không gọi API. Stub dựng output từ genre pack
chứ chưa để prompt lái, nên **đổi phiên bản prompt hôm nay chưa làm chỉ số đổi** —
baseline = output stub tất định, và eval bắt **hồi quy chỉ số**. Khi `editorial`
lên `v1` (mục `E-005`) và prompt thật lái output, đúng cổng này thành cổng chặn
thật cho PR đổi prompt, không ai phải viết lại.

Ngưỡng/dung sai: `packs/genres/data-explainer/format-spec.json` →
`limits.promptEval`. Logic đo: `ops/scripts/prompt-eval.ts` (thuần, trung tính
thể loại). Runner: `ops/scripts/check-prompt-eval.ts`. Test:
`ops/test/check-prompt-eval.test.ts`.
