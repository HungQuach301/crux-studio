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
 * phiên bản — chưa gọi lời gọi LLM thật với nội dung prompt. Kết quả CHƯA
 * được nối vào `produce()` của `index.ts`: nối vào sẽ đổi payload mà mọi tập
 * đi qua xưởng này sinh ra, tức đổi `ops/golden/ep-0001-stub/snapshots/editorial.json`
 * — và cập nhật snapshot tập vàng phải đi PR riêng, không kèm thay đổi nào
 * khác (CHARTER 6.1, CLAUDE.md mục 1). Nối dây thật là việc của mục kế tiếp
 * chạm `produce()` và đã phải cập nhật snapshot vì lý do khác (ví dụ `E-004`).
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
