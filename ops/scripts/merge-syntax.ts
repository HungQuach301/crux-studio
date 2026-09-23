/**
 * Cổng cú pháp cho cây vừa gộp bằng union — mục `integration/I-018`,
 * `ops/known-failures.md` `KF-016`.
 *
 * `integrator-resolve.ts` quyết định "giải được hay không" bằng cách **đếm
 * dòng xoá** ở mỗi bên so với tổ tiên chung. Phép đếm đó đúng với ý định của
 * nó — gộp thuần cộng thêm thì không bên nào mất nội dung — nhưng nó đo
 * **dòng**, còn thứ phải còn nguyên là **cú pháp**.
 *
 * Ca đã xảy ra thật (PR `#71`, 2026-09-22): hai phía cùng kết thúc một khối
 * bằng dòng `});` giống hệt nhau, `main` viết thêm test **sau** dòng đó.
 * `merge=union` giữ dòng chung **một lần** và đặt phần thêm của `main` vào
 * **trước** nó, nên `});` đóng test cuối của nhánh biến mất. Không bên nào
 * xoá dòng nào; phép đếm không thấy gì; tool in `resolved` và thoát `0`.
 *
 * Vì sao cổng phải nằm ở đây chứ không dựa vào `pnpm check` phía sau: `check`
 * chạy các cổng theo thứ tự và **dừng ở lỗi đầu tiên**. Hai lượt bước 0 đã
 * gộp đúng cây hỏng đó mà không thấy, vì `lint:workflows` đỏ trước nên chưa
 * chạy tới `typecheck`. Lớp chặn duy nhất đang đứng giữa một cây hỏng và
 * `main` là **thứ tự các bước trong `pnpm check`**, không phải một phép kiểm
 * có chủ đích.
 *
 * **Thiên lệch của module này, khai trước:** một lần báo sai (`aborted-
 * ineligible` cho cây lành) làm đứng hàng đợi merge và đòi người vào giải
 * tay; một lần bỏ sót chỉ trả về đúng hành vi trước mục này (`pnpm check`
 * phía sau bắt). Nên mọi phép kiểm ở đây chỉ báo lỗi khi cú pháp **chắc
 * chắn** hỏng, và gặp cấu trúc nó chưa mô hình hoá thì **cho qua** chứ không
 * đoán. Chỗ nào cho qua đều ghi rõ ngay tại chỗ.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** File hỏng cú pháp sau khi gộp: tên file cộng lỗi nguyên văn. */
export interface SyntaxProblem {
  file: string;
  detail: string;
}

/**
 * Đuôi file có cú pháp kiểm được, theo ba nhóm ở tiêu chí xong của `I-018`.
 * Đuôi không nằm trong đây (`.md`, `.jsonl`, `.txt`, `.snap`, …) **không**
 * được coi là lỗi — chúng không có cú pháp lồng nhau để mà hỏng, và `.jsonl`
 * là chính chỗ union được bật cố ý (KF-005).
 */
type SyntaxKind = 'script' | 'json' | 'yaml';

const SCRIPT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;
const YAML_EXTENSIONS = ['.yml', '.yaml'] as const;

/** Nhóm cú pháp của một đường dẫn, hoặc `null` nếu không có gì để kiểm. */
export function syntaxKind(file: string): SyntaxKind | null {
  const lower = file.toLowerCase();
  if (SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'script';
  if (lower.endsWith('.json')) return 'json';
  if (YAML_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'yaml';
  return null;
}

/**
 * `typescript` nạp **lười**, và nạp một lần cho cả lượt.
 *
 * Bước 0 chạy ở đầu **mọi** lượt worker (phụ lục P1), nên một `import` ở
 * đỉnh module sẽ trả tiền nạp compiler cho cả những lượt không có PR nào
 * xung đột — tức gần hết các lượt. `createRequire` neo vào `package.json`
 * của gốc repo để phân giải không phụ thuộc thư mục đang chạy.
 */
let compiler: unknown;
function typescriptCompiler(): {
  transpileModule: (
    input: string,
    options: { reportDiagnostics: boolean; fileName?: string },
  ) => { diagnostics?: ReadonlyArray<unknown> };
  flattenDiagnosticMessageText: (text: unknown, newLine: string) => string;
  getLineAndCharacterOfPosition: (file: unknown, pos: number) => { line: number };
} {
  if (compiler === undefined) {
    const require = createRequire(import.meta.url);
    compiler = require('typescript');
  }
  return compiler as ReturnType<typeof typescriptCompiler>;
}

/**
 * Lỗi cú pháp của một file script, hoặc `null` nếu parse được.
 *
 * `transpileModule` với `reportDiagnostics` chỉ báo lỗi **cú pháp** (cộng
 * lỗi tuỳ chọn compiler, không phát sinh ở đây) — đúng phạm vi cần: một
 * biến chưa khai hay một kiểu sai là việc của `tsc --noEmit` trong `pnpm
 * check`, không phải của cổng này. `node --check` KHÔNG dùng được: nó không
 * bỏ chú thích kiểu, nên `const a: number = 1` ra `SyntaxError` — đã đo.
 */
function scriptProblem(content: string, file: string): string | null {
  const ts = typescriptCompiler();
  const out = ts.transpileModule(content, { reportDiagnostics: true, fileName: file });
  const diagnostics = out.diagnostics ?? [];
  if (diagnostics.length === 0) return null;
  const first = diagnostics[0] as {
    messageText: unknown;
    start?: number;
    file?: { getLineAndCharacterOfPosition?: (pos: number) => { line: number } };
  };
  const message = ts.flattenDiagnosticMessageText(first.messageText, ' ');
  const where =
    first.start !== undefined && first.file?.getLineAndCharacterOfPosition !== undefined
      ? `dòng ${first.file.getLineAndCharacterOfPosition(first.start).line + 1}: `
      : '';
  return `không parse được — ${where}${message}`;
}

/** Lỗi nạp JSON, hoặc `null`. `JSON.parse` đã nói đủ, không diễn giải thêm. */
function jsonProblem(content: string): string | null {
  try {
    JSON.parse(content);
    return null;
  } catch (error) {
    return `không nạp được JSON — ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Dấu mở khối vô hướng nhiều dòng: `|`, `>`, kèm các biến thể `-`, `+`, số. */
const BLOCK_SCALAR = /:\s*[|>][-+]?\d*\s*(#.*)?$/;

/** Dòng chỉ có khoảng trắng, hoặc chỉ có chú thích. */
function isSkippableYamlLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

/**
 * Lỗi nạp YAML, hoặc `null`.
 *
 * Repo không có thư viện YAML (chỉ `typescript` và `@types/node` ở
 * `devDependencies`), và thêm một phụ thuộc chỉ để chạy cổng này ở đầu mọi
 * lượt worker là đắt hơn phần nó cứu. Nên đây là phép kiểm **cấu trúc khối**,
 * hẹp có chủ đích, chỉ bắt hai thứ mà YAML **chắc chắn** không nhận:
 *
 * 1. Tab trong phần thụt lề — YAML cấm, và `check-workflows.ts` đã có cùng
 *    luật cho `ops/workflows/**`; ở đây nó áp cho mọi file YAML vừa gộp.
 * 2. Một dòng dedent về mức thụt lề **chưa từng mở** trong khối đang mở. Đây
 *    là hình dạng union để lại khi nó chèn phần thêm của một bên vào giữa
 *    một khối của bên kia.
 *
 * **Chỗ cố ý cho qua** (trả `null`, không đoán):
 * - khối vô hướng `|`/`>`: mọi dòng thụt sâu hơn dòng khoá là nội dung, bỏ qua;
 * - vô hướng thường nhiều dòng: một dòng thụt **sâu hơn** mức hiện tại luôn
 *   được coi là hợp lệ, vì YAML cho phép viết tiếp một giá trị xuống dòng;
 * - flow collection mở mà chưa đóng trong cùng dòng (`[`, `{`), nhiều tài
 *   liệu (`---` sau dòng đầu), anchor/alias, khoá phức `? `: gặp là **thoát
 *   và cho qua** — ngoài mô hình, không phán.
 */
export function yamlProblem(content: string): string | null {
  const lines = content.split('\n');
  // Mức thụt lề đang mở, từ ngoài vào trong. `0` luôn mở.
  const open: number[] = [0];
  let blockScalarIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;

    if (blockScalarIndent !== null) {
      // Nội dung khối vô hướng: dòng trống, hoặc thụt sâu hơn dòng khoá.
      if (line.trim() === '') continue;
      const indent = line.length - line.trimStart().length;
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }

    if (isSkippableYamlLine(line)) continue;

    const indentText = line.slice(0, line.length - line.trimStart().length);
    if (indentText.includes('\t')) {
      return `dòng ${lineNo}: dùng tab để thụt lề — YAML không nhận tab`;
    }
    const indent = indentText.length;
    const body = line.trim();

    // Ngoài mô hình: thoát và cho qua, không phán.
    if (i > 0 && (body === '---' || body.startsWith('--- '))) return null;
    if (body.startsWith('? ') || body.startsWith('&') || body.startsWith('*')) return null;
    if (countUnclosed(body) !== 0) return null;

    const top = open[open.length - 1]!;
    if (indent > top) {
      // Sâu hơn: một khối mới mở, hoặc một vô hướng viết tiếp xuống dòng.
      // Hai ca không phân biệt được mà không parse thật, nên nhận cả hai.
      open.push(indent);
    } else if (indent < top) {
      while (open.length > 1 && open[open.length - 1]! > indent) open.pop();
      if (open[open.length - 1]! !== indent) {
        return (
          `dòng ${lineNo}: thụt lề ${indent} không khớp mức nào đang mở ` +
          `(${open.join(', ')}) — khối YAML ở đây không nạp được`
        );
      }
    }

    if (BLOCK_SCALAR.test(body)) blockScalarIndent = indent;
  }

  return null;
}

/**
 * Số dấu mở flow collection còn treo ở cuối một dòng. Bỏ qua phần trong
 * nháy, vì `run: echo "]"` không mở gì cả.
 */
function countUnclosed(body: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (const char of body) {
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[' || char === '{') depth++;
    else if (char === ']' || char === '}') depth--;
    else if (char === '#' && depth === 0) break;
  }
  return depth;
}

/** Lỗi cú pháp của một file, hoặc `null`. `file` chỉ dùng cho thông điệp. */
export function fileSyntaxProblem(file: string, content: string): string | null {
  switch (syntaxKind(file)) {
    case 'script':
      return scriptProblem(content, file);
    case 'json':
      return jsonProblem(content);
    case 'yaml':
      return yamlProblem(content);
    default:
      return null;
  }
}

/**
 * File đầu tiên trong `files` không còn đọc được sau khi gộp, hoặc `null`.
 *
 * Chỉ đọc đúng những file được truyền vào — tiêu chí xong của `I-018` cấm
 * quét cả cây, vì bước 0 chạy ở đầu mọi lượt worker. Đọc từ cây làm việc
 * tại `cwd` (bản vừa ghi ra bởi `merge-file --union`), không từ git index.
 *
 * File đọc không được (vừa bị xoá, mất quyền) **không** tính là lỗi cú pháp:
 * ca đó đã có đường đi riêng ở `resolveAdditiveMerge`, và nuốt nó vào đây sẽ
 * nói sai nguyên nhân cho người đọc bản tin.
 */
export function mergedSyntaxProblem(
  cwd: string,
  files: readonly string[],
): SyntaxProblem | null {
  for (const file of files) {
    if (syntaxKind(file) === null) continue;
    let content: string;
    try {
      content = readFileSync(join(cwd, file), 'utf8');
    } catch {
      continue;
    }
    const detail = fileSyntaxProblem(file, content);
    if (detail !== null) return { file, detail };
  }
  return null;
}
