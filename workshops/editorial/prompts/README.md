# Prompt pack — xưởng `editorial`

<!-- $note: chép từ docs/spec/CRUX-REFERENCE-SPEC.md, khối `engine/library/prompts/README.md`
     (dòng ~6984), không có dấu ⚠️ Crux nên còn hiệu lực. Bảng chuyển đường dẫn của spec
     (mục "Bảng chuyển đường dẫn") xếp `engine/library/` vào "Thư mục của xưởng dùng nó" —
     bốn nghề dưới đây (researcher, fact-checker, outliner, scriptwriter) thuộc S04–S08,
     tức xưởng editorial (CHARTER 5.1). `visual-director.md` của cùng thư mục spec thuộc
     xưởng visual, không chép vào đây (mục `E-001` chỉ ghi bốn nghề của xưởng này). -->

Mỗi prompt là một file có phiên bản. Thay đổi prompt phải thêm phiên bản, không ghi đè.

Mỗi prompt phải kết thúc bằng một mục **Tự kiểm** — mô hình tự khai các chỉ số đo được của
đầu ra. Stage sau tính lại và đối chiếu.

Prompt **không được** chứa hằng số nội dung. Chúng đọc từ Genre Pack và Channel Pack.

## Quy ước phiên bản

Dòng tiêu đề đầu tiên của mỗi file mang dạng `# <Tên nghề> · v<N>`. `ops/scripts` không đọc
mục này — bộ nạp thật nằm ở `workshops/editorial/src/prompts.ts` (`loadPromptVersions`), vì
đây là dữ liệu riêng của xưởng `editorial` (bất biến I3: một xưởng chỉ import `kernel`,
không có "thư viện prompt dùng chung" ở tầng kernel).
