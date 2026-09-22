/**
 * Cắt `docs/assumptions.md` thành từng mục `G<n>` — **một chỗ duy nhất**,
 * dùng chung cho `check-assumptions.ts` và `recheck-assumptions.ts`.
 *
 * ## Vì sao file này tồn tại: rà soát Z12 (`ops/known-failures.md`)
 *
 * Cả hai bên đọc sổ trước đây cắt mục **cuối** tới **hết file**:
 *
 * ```ts
 * const end = index + 1 < headings.length ? headings[index + 1]!.index! : ledger.length;
 * ```
 *
 * Sổ không chỉ có các mục `## G<n>`. Nó còn có phần "Cách thêm một giả
 * định" — một heading `## ` bình thường — và các dấu `---` ngăn nhóm. Mọi
 * chữ nằm sau mục cuối cùng của một đoạn **trôi vào thân mục đó**, mang
 * theo chữ khoá của nó. Phần "Cách thêm một giả định" chứa nguyên câu
 * *"Nếu giả định chưa có dự phòng viết sẵn thì không được xây gì lên trên
 * nó"*, nên một mục **thiếu hẳn** phần dự phòng vẫn xanh chỉ vì nó đứng
 * ngay trước đoạn văn ấy.
 *
 * Đây là nhóm **Z**: hỏng mà mọi chỉ báo đều xanh. `pnpm assumptions` vẫn
 * thoát 0, sổ vẫn trông đủ phần, và chỗ đáng lẽ phải đỏ thì không có gì để
 * đỏ. **Đã xảy ra thật với `G15`** — chỉ lộ ra khi `G16` được thêm vào và
 * đẩy `G15` khỏi vị trí cuối.
 *
 * ## Vì sao gộp về một file thay vì sửa hai chỗ
 *
 * Hai bên đọc sổ mang **hai bản chép của cùng một phép cắt**. Sửa hai chỗ
 * thì lần sau ranh giới đổi lần nữa, một bên sẽ được sửa và một bên không —
 * đúng hình dạng Z16 ("bỏ bản chép thì không cần so"). Một chỗ sinh ra
 * ranh giới thì hai bên không trôi khỏi nhau được.
 */

/** Ranh giới kết thúc một mục: heading `## ` bất kỳ, hoặc một dòng `---`. */
const BOUNDARY = /^(?:## .*|-{3,}\s*)$/gm;

/** Heading của một mục giả định: `## G<n> · <tên>`. */
const HEADING = /^## (G\d+) · (.+)$/gm;

export interface LedgerSection {
  /** Mã giả định, ví dụ `G17`. */
  code: string;
  /** Phần chữ sau dấu `·` trên dòng heading. */
  title: string;
  /** Thân mục — KHÔNG gồm dòng heading, và dừng ở ranh giới kế tiếp. */
  body: string;
}

/**
 * Tách sổ thành các mục. Thuần, không đụng đĩa — để test được.
 *
 * Mục kết thúc ở **ranh giới đầu tiên sau nó**, không phải ở heading `G`
 * kế tiếp: một heading `## ` khác hay một dấu `---` cũng kết thúc mục. Mục
 * cuối cùng của file kết thúc ở hết file chỉ khi không còn ranh giới nào.
 */
export function sliceLedgerSections(ledger: string): LedgerSection[] {
  const boundaries = [...ledger.matchAll(BOUNDARY)].map((match) => match.index!);
  const headings = [...ledger.matchAll(HEADING)];

  return headings.map((heading) => {
    const start = heading.index! + heading[0].length;
    const end = boundaries.find((offset) => offset > heading.index!) ?? ledger.length;
    return { code: heading[1]!, title: heading[2]!, body: ledger.slice(start, end) };
  });
}
