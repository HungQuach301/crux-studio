#!/usr/bin/env node
/**
 * Mục `platform/P-058`, **vế nguyên nhân kích** — mã mục hoặc mã chỗ hỏng
 * xuất hiện **hai lần** trong cùng một file mà không cổng nào đỏ.
 *
 * ## Chỗ hỏng, đo được chứ không suy
 *
 * `ops/known-failures.md` trên `main` `3ecec2d` giữ **hai** khối `## KF-016`
 * (dòng 1301 và 1408) và **hai** khối `## KF-041` (dòng 392 và 1596). Cả hai
 * cặp sống trên `main` nhiều ngày trong khi `pnpm check` xanh, CI xanh,
 * `main` xanh — nhóm **Z** thuần. `backlog-status.ts` **đã** thấy cặp thứ ba
 * (`### P-028` × 2) và in ra `duplicateIds`, nhưng **không cổng nào đỏ vì
 * nó**, nên mã trùng sống được, và mỗi lần sống nó buộc một lượt phải **đổi
 * mã đang bay** — chính thao tác sinh ra vế cơ chế của `KF-042`.
 *
 * ## Vì sao bắt theo TIÊU ĐỀ đầu dòng, không `grep` cả file
 *
 * Mã mục được nhắc lại khắp nơi: trong câu văn (*"cùng chữ ký `KF-016`"*),
 * trong khối ``` của một lệnh mẫu, trong dòng trích lại `> ## KF-041` của
 * một ghi chú. Một phép `grep` cả file sẽ làm đỏ **chính mục này** và
 * `KF-042`, vì cả hai kể lại các cặp trùng bằng tên. Nên luật hẹp:
 *
 * - khớp **đầu dòng**, đúng số dấu `#` được hỏi — `##` không được khớp `###`;
 * - **bỏ qua mọi dòng trong khối ```**, kể cả khi khối đó chứa một dòng
 *   trông y hệt một tiêu đề;
 * - dòng trích lại (`> ## …`) không khớp, vì nó không bắt đầu bằng `#`.
 *
 * Hướng lệch cố ý là **bỏ sót**, không phải **báo nhầm** — ngược hướng của
 * `claim-collision.ts`, và có lý do: cổng này **chặn merge** trên một file
 * mà **mọi** làn đều ghi vào (`ops/known-failures.md`, `ops/lanes/<làn>/backlog.md`),
 * nên một luật quá rộng chặn oan mọi PR; còn `claimCheck` chỉ **đo**.
 */

/** Một mã xuất hiện hơn một lần trong cùng một file. */
export interface DuplicateHeading {
  id: string;
  /** Số dòng (1-based) của **từng** lần xuất hiện, tăng dần. */
  lines: number[];
}

/**
 * Mã lấy từ tiêu đề: đoạn ngay sau dấu `#`, cắt ở khoảng trắng đầu tiên.
 *
 * `### P-058 · claimCheck …` → `P-058`. Dấu phân cách đứng sau (`·`, `—`)
 * không bao giờ lọt vào mã vì phép cắt dừng ở khoảng trắng.
 */
const ID = /^([A-Za-z0-9][A-Za-z0-9._-]*)/;

/** Mở hoặc đóng một khối ``` — ba dấu huyền trở lên, cho phép thụt lề. */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

export class DuplicateHeadingInputError extends Error {}

/**
 * Mọi mã xuất hiện **hơn một lần** ở tiêu đề cấp `level` của `content`.
 *
 * Hàm **thuần**: không đọc đĩa, không gọi mạng. Bên gọi đưa nội dung file
 * vào, nên bài kiểm dựng được ca `### P-028` × 2 từ fixture chứ không phải
 * neo vào một cây sẽ đổi.
 *
 * `lines` **không tuỳ chọn**: một danh sách chỉ có mã không nói được nên
 * đổi cái nào, mà "đổi cái nào" chính là việc người đọc cổng này phải làm.
 */
export function duplicateHeadings(content: string, level: number): DuplicateHeading[] {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new DuplicateHeadingInputError(`Cấp tiêu đề phải là số nguyên 1..6, nhận: ${String(level)}`);
  }
  const hashes = '#'.repeat(level);
  const seen = new Map<string, number[]>();
  let fence: string | null = null;

  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;

    const opener = FENCE.exec(line);
    if (opener !== null) {
      const marker = opener[1]![0]!;
      // Một khối chỉ đóng được bằng CÙNG loại dấu — ``` không đóng ~~~.
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;

    if (!line.startsWith(`${hashes} `)) continue;
    // `##` không được khớp `###`: ký tự ngay sau khối dấu phải KHÔNG là `#`,
    // mà `startsWith("## ")` đã bảo đảm điều đó (ký tự kế là khoảng trắng).
    const rest = line.slice(hashes.length + 1).trimStart();
    const match = ID.exec(rest);
    if (match === null) continue;
    const id = match[1]!;
    seen.set(id, [...(seen.get(id) ?? []), index + 1]);
  }

  return [...seen]
    .filter(([, at]) => at.length > 1)
    .map(([id, at]) => ({ id, lines: at }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Một file đã soát, kèm cấp tiêu đề mà nó được soát ở. */
export interface HeadingScan {
  file: string;
  level: number;
  duplicates: DuplicateHeading[];
}

/** Bảng người đọc. **In cả khi sạch** — im lặng ở đây đúng là thứ `Z15` cấm. */
export function renderHeadingScans(scans: readonly HeadingScan[]): string {
  const bad = scans.filter((scan) => scan.duplicates.length > 0);
  if (bad.length === 0) {
    return `Mã trùng: 0 — đã soát ${scans.length} file, không mã nào xuất hiện hai lần ở tiêu đề.`;
  }
  const total = bad.reduce((sum, scan) => sum + scan.duplicates.length, 0);
  const rows = bad.flatMap((scan) =>
    scan.duplicates.map(
      (dup) =>
        `  ✗ ${scan.file}: "${dup.id}" xuất hiện ${dup.lines.length} lần ở tiêu đề cấp ${scan.level} — dòng ${dup.lines.join(', ')}`,
    ),
  );
  return [
    `Mã trùng: ${total} mã, trong ${bad.length} file. Đổi mã của lần xuất hiện SAU sang một mã trống, và sửa mọi chỗ trỏ tới nó:`,
    ...rows,
  ].join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Cổng này nằm trong `pnpm check` **trước** `typecheck`, cạnh các cổng rẻ:
// `check` dừng ở lỗi ĐẦU TIÊN, nên một cổng rẻ đặt sau một cổng đắt là một
// cổng có thể không bao giờ chạy (cùng lập luận `I-018` dùng cho
// `mergedSyntaxProblem`).
const isMain = process.argv[1]?.endsWith('duplicate-headings.ts') === true;

if (isMain) {
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join, relative } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const root = fileURLToPath(new URL('../..', import.meta.url));
  const lanesDir = join(root, 'ops', 'lanes');
  const targets: { file: string; level: number }[] = [{ file: join(root, 'ops', 'known-failures.md'), level: 2 }];
  for (const entry of readdirSync(lanesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) targets.push({ file: join(lanesDir, entry.name, 'backlog.md'), level: 3 });
  }

  const scans: HeadingScan[] = [];
  for (const target of targets) {
    let content: string;
    try {
      content = readFileSync(target.file, 'utf8');
    } catch (error) {
      // "Không đọc được" KHÁC "sạch", và phải khác cả ở mã thoát: một file
      // biến mất mà cổng vẫn xanh là đúng thứ nhóm Z mà mục này sinh ra để chặn.
      process.stderr.write(
        `⚠ KHÔNG SOÁT ĐƯỢC ${relative(root, target.file)} — ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(2);
    }
    scans.push({
      file: relative(root, target.file),
      level: target.level,
      duplicates: duplicateHeadings(content, target.level),
    });
  }

  const report = renderHeadingScans(scans);
  if (scans.some((scan) => scan.duplicates.length > 0)) {
    process.stderr.write(`${report}\n`);
    process.exit(1);
  }
  process.stdout.write(`${report}\n`);
}
