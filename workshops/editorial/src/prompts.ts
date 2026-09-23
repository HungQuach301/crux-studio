/**
 * Nạp phiên bản của prompt pack (mục `E-001`). Prompt là file dữ liệu trong
 * `workshops/editorial/prompts/`, không phải chuỗi ghép trong code — mỗi file
 * mở bằng một dòng tiêu đề dạng `# <Tên nghề> · v<N>`.
 *
 * Bất biến I3: đây là dữ liệu riêng của xưởng `editorial`, không đặt trong
 * `kernel` (kernel trung tính thể loại/kênh, không phải nơi cho "nghề" của
 * một xưởng) và không xưởng nào khác import file này.
 *
 * Đợt 0: mọi xưởng `impl: stub` (CHARTER mục 10), nên hàm này chỉ đọc VÀ đọc
 * phiên bản — chưa gọi lời gọi LLM thật với nội dung prompt.
 *
 * Kết quả ĐÃ được nối vào `produce()` của `index.ts`, nhưng chỉ ghi vào
 * payload khi lượt chạy THẬT SỰ gọi mô hình (xem `generationOf`). Bản ghi
 * trước đó cho rằng nối vào bắt buộc phải đổi
 * `ops/golden/ep-0001-stub/snapshots/editorial.json` và vì thế phải hoãn:
 * điều đó chỉ đúng khi `generation` được ghi ở MỌI lượt chạy. Gác bằng số lời
 * gọi thật thì stub (không gọi gì) giữ nguyên output, snapshot nguyên vẹn,
 * không cần `pnpm replay -- --update`, nên không vướng CHARTER 6.1 — và khi
 * `E-005` nối prompt vào thật thì `generation` tự xuất hiện, không ai phải
 * nhớ quay lại sửa.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface PromptVersions {
  researcher: string;
  factChecker: string;
  outliner: string;
  scriptwriter: string;
}

const PROMPT_FILES: Record<keyof PromptVersions, string> = {
  researcher: 'researcher.md',
  factChecker: 'fact-checker.md',
  outliner: 'outliner.md',
  scriptwriter: 'scriptwriter.md',
};

/** Dòng tiêu đề đầu, dạng "# <Tên nghề> · v<N>" — không cần nằm ở dòng đầu file (có thể có ghi chú $note trước). */
const VERSION_HEADING = /^#\s+.+·\s*v(\d+)\s*$/m;

export function parsePromptVersion(fileName: string, content: string): string {
  const match = VERSION_HEADING.exec(content);
  if (match === null) {
    throw new Error(
      `${fileName}: không tìm thấy dòng tiêu đề "# <Tên nghề> · v<N>" — prompt phải khai phiên bản.`,
    );
  }
  return `v${match[1]}`;
}

/**
 * Chuỗi phiên bản đi vào `payload.generation.promptVersion`: `<id>@<version>`
 * ghép bằng `+`, trong đó `<id>` là tên file bỏ đuôi `.md`.
 *
 * Sắp theo `<id>` chứ không theo thứ tự khai trong `PROMPT_FILES`, để thêm
 * một nghề vào giữa bảng không âm thầm đổi chuỗi của các nghề đã có — tập
 * vàng so từng byte (CHARTER 6.1).
 */
export function formatPromptVersion(versions: PromptVersions): string {
  return (Object.entries(PROMPT_FILES) as [keyof PromptVersions, string][])
    .map(([role, fileName]) => `${fileName.replace(/\.md$/, '')}@${versions[role]}`)
    .sort()
    .join('+');
}

/**
 * `promptsDir` mặc định là `workshops/editorial/prompts/` cạnh file này —
 * truyền tay trong test để trỏ vào fixture dựng riêng, không đọc prompt thật.
 */
export function loadPromptVersions(promptsDir?: string): PromptVersions {
  const dir = promptsDir ?? fileURLToPath(new URL('../prompts/', import.meta.url));
  const entries = Object.entries(PROMPT_FILES) as [keyof PromptVersions, string][];
  const result = {} as PromptVersions;
  for (const [role, fileName] of entries) {
    const path = `${dir.replace(/\/?$/, '/')}${fileName}`;
    const content = readFileSync(path, 'utf8');
    result[role] = parsePromptVersion(fileName, content);
  }
  return result;
}
