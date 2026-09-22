# 🤖 Tám mô hình định lượng đầu tiên

Mục backlog `topic/T-006`, spec WP-008. Contract: `workshops/topic/contracts/model.v0.schema.json`.
Công thức và bộ nạp: `workshops/topic/src/models.ts`. Bằng chứng chạy được: `workshops/topic/test/models.test.ts`.

`T-005` xây **công cụ** (`model-runner.ts`, `model-verify.ts`). Thư mục này là **nội dung**.

## Luật của thư mục này

`CHARTER.md` mặc định **M7** (`D-C02`, điều chỉnh `D-18`) điểm a:

> Ca kiểm cấp 1 lấy từ **nguồn độc lập bên ngoài** … **Không bao giờ để máy tự sinh.**

Cho nên: **không con số kỳ vọng nào trong `cases/` được agent nghĩ ra.** Mỗi ca mang `computedBy` trích
thẳng câu văn công bố con số đó. Một mô hình ngôn ngữ tự sinh ca kiểm rồi tự khớp với chính nó không
chứng minh gì — nó lặp lại cùng một hiểu sai hai lần (`D-18`, phần bối cảnh). Có một bài test canh đúng
luật này: `computedBy` nhắc tới chính máy thì `pnpm test` đỏ.

`D-18` điểm 3 chỉ đích danh hai mô hình đầu tiên, chọn theo tiêu chí **dễ kiểm nhất** chứ không theo tiềm
năng lượt xem: tỷ lệ chi phí quỹ (`M-001`) và mortgage points (`M-002`).

## Tám mô hình và nguồn ca kiểm cấp 1

| | Mô hình | Nguồn (cơ quan nhà nước Mỹ) | Số ca |
|---|---|---|---|
| `M-001` | Tỷ lệ chi phí quỹ ăn mòn danh mục | SEC, *How Fees and Expenses Affect Your Investment Portfolio* | 3 |
| `M-002` | Điểm hoà vốn của mortgage discount points | CFPB, Ask CFPB #136 | 2 |
| `M-003` | APY của một khoản tiền gửi | 12 CFR phần 1030 (Reg DD), Phụ lục A | 8 |
| `M-004` | Giảm trừ khi nhận trợ cấp an sinh sớm | 20 CFR 404.410 | 2 |
| `M-005` | Khoản rút tối thiểu bắt buộc (RMD) | IRS Pub 590-B | 3 |
| `M-006` | Lãi suất tổng hợp I bond | TreasuryDirect | 1 |
| `M-007` | Phần trợ cấp an sinh chịu thuế | IRS Pub 915, Worksheet 1 điền sẵn | 1 |
| `M-008` | Khấu trừ IRA truyền thống bị giảm | IRS Pub 590-A, Worksheet 1-2 điền sẵn | 2 |

Tổng **22 ca kiểm**, tất cả đều chạy thật trong `pnpm test`.

## Bố cục

```
M-00N.json              mô tả mô hình theo contract model.v0 (đóng, additionalProperties: false)
cases/M-00N.cases.json  ca kiểm cấp 1 — params, expected, và computedBy là trích dẫn nguồn
```

Thư mục này **không** nằm trong `workshops/topic/fixtures/`: mọi `.json` ở đó bị `ops/scripts/check-fixtures.ts`
coi là file `--input` của xưởng và soát theo luật khác hẳn (cùng lý do với `data/corpus/`).

## Hai mâu thuẫn trong chính nguồn — đã ghi, chưa giải

Đây là phần quan trọng nhất của README này. Cả hai đều nằm trong `assumptions` của file mô hình tương ứng,
nên khi một tập dùng tới con số đó thì Fact & Risk Pass đọc được.

1. **`M-006` · TreasuryDirect.** Trang *I bonds interest rates* mở đầu bằng "The composite rate for I bonds
   issued from November 2025 through April 2026 is **4.03%**", nhưng khối "An example" ngay dưới lấy 0,90%
   và 1,67% rồi tự tính ra **4,26%**. Ca kiểm dùng phép tính của khối ví dụ — nó tự đủ và kiểm được từng
   bước. Con số 4,03% **không** được dùng và cần nguồn thứ hai trước khi bất cứ tập nào phát ngôn về đợt
   phát hành đó.

2. **`M-008` · IRS Pub 590-A.** Câu hướng dẫn dòng 4 và ví dụ điền sẵn của chính tài liệu đó không cùng
   thoả một cách đọc nào: theo mặt chữ thì $6.825 phải thành $6.830, nhưng worksheet in $6.825. Cài đặt
   dùng **một** quy tắc tái hiện được cả ba con số đã công bố — không phải cách đọc duy nhất khớp, và
   `iraPhaseoutRounding` trong `src/models.ts` nêu thẳng cách đọc thay thế. Chênh lệch tối đa $5 ở trần
   khấu trừ.

## Còn thiếu, có chủ đích

`D-C02` điểm b đòi một mô hình **khác họ, không phải Claude** tính lại công thức độc lập; cấp kiểm 4
(`llm-assumption-check`) đòi bằng chứng kiểm giả định và đơn vị từ một nhà cung cấp khác. Cơ chế cho việc
đó là mục `platform/P-003`, và mục đó cần secret `OPENAI_API_KEY` — **chưa có trên repo**.

Vì vậy mọi mô hình ở đây mang `verification.status: "pending"` và cấp 4 ghi `pass: false` kèm lý do.
`verified` chỉ đến từ một issue `irreversible` được chủ dự án duyệt (`D-C02` điểm c) và agent **không**
đặt được nó bằng code — điều đó khoá ở tầng kiểu trong `model-verify.ts`, không phải bằng quy ước.
