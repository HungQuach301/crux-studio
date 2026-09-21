#!/usr/bin/env node
/**
 * Tự cập nhật `ops/metrics.md` — cơ chế của mục `I-002`
 * (`ops/lanes/integration/backlog.md`), dùng bởi routine `crux-integrator`
 * (CHARTER Phụ lục P3 bước 3).
 *
 * Trước mục này, ba con số — file code / mục `done`, số lần merge và
 * revert, tỷ lệ `main` xanh — được tính TAY mỗi lần chạy (xem PR cập nhật
 * `ops/metrics.md` ngày 2026-09-21). Mục này biến việc đó thành một lệnh.
 *
 * Cùng triết lý tách lớp với `integrator-resolve.ts` và
 * `reap-abandoned-drafts.ts`: mọi phép tính và mọi thao tác chỉnh bảng
 * markdown là hàm thuần, kiểm bằng dữ liệu giả lập, không gọi mạng và không
 * đụng đĩa. `main()` chỉ là lớp vỏ mỏng: đọc file thật, gọi `gh`, ghi file
 * thật.
 *
 * "Tỷ lệ `main` xanh" suy ra từ bất biến I2 (vào `main` chỉ qua PR có CI
 * xanh): mỗi lần merge tự nó đã xanh lúc merge, nên chỉ có revert mới là
 * dấu vết của một lần `main` từng đỏ sau đó. Tỷ lệ xanh = (số merge − số
 * revert) / số merge. Revert nhận diện bằng đúng quy ước nhánh mà phụ lục
 * P3 bước 1 dùng khi mở PR revert: `claude/integration/revert-<sha>`.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

// --- Đếm file code / mục `done` — thuần, không gọi mạng ---

/** File code: đuôi `.ts`, không tính test (`*.test.ts`). */
export function isCodeFile(path: string): boolean {
  return path.endsWith('.ts') && !path.endsWith('.test.ts');
}

export function countCodeFiles(paths: string[]): number {
  return paths.filter(isCodeFile).length;
}

const DONE_STATUS_RE = /^-\s*status:\s*done\s*$/;

/** Đếm số mục `- status: done` trong nội dung một file backlog. */
export function countDoneItems(backlogContent: string): number {
  return backlogContent.split('\n').filter((line) => DONE_STATUS_RE.test(line)).length;
}

export function totalDoneItems(backlogContents: string[]): number {
  return backlogContents.reduce((sum, content) => sum + countDoneItems(content), 0);
}

/** `codeFiles / doneItems`, làm tròn; `doneItems === 0` thì không chia được — trả `null`. */
export function architectureRatio(codeFiles: number, doneItems: number): number | null {
  if (doneItems <= 0) return null;
  return Math.round(codeFiles / doneItems);
}

/** `(merged - reverts) / merged * 100`, làm tròn; `merged === 0` thì trả `null`. */
export function greenRatioPercent(merged: number, reverts: number): number | null {
  if (merged <= 0) return null;
  return Math.round(((merged - reverts) / merged) * 100);
}

// --- Chỉnh bảng markdown — thuần, hoạt động trên chuỗi ---

interface MarkdownTable {
  /** Chỉ số dòng (trong `lines` gốc) của dòng tiêu đề bảng (`| a | b |`). */
  headerIndex: number;
  /** Chỉ số dòng của dòng phân cách (`|---|---|`). */
  separatorIndex: number;
  /** Các dòng dữ liệu, mỗi dòng đã tách thành mảng ô (không gồm `|` hai đầu). */
  rows: string[][];
  /** Chỉ số dòng ngay sau dòng dữ liệu cuối cùng (chỗ chèn thêm dòng mới). */
  endIndex: number;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function serializeRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/**
 * Tìm bảng markdown đầu tiên xuất hiện SAU dòng heading khớp `headingLine`
 * (so khớp nguyên văn, đã trim). Không thấy heading hoặc không thấy bảng
 * ngay sau đó (bỏ qua các dòng trống/mô tả xen giữa) thì trả `null`.
 */
function findTableAfterHeading(lines: string[], headingLine: string): MarkdownTable | null {
  const headingIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (headingIndex === -1) return null;

  let headerIndex = -1;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith('|')) {
      headerIndex = i;
      break;
    }
    // Một heading khác trước khi thấy bảng nào — không có bảng cho heading này.
    if (line.trim().startsWith('#')) return null;
  }
  if (headerIndex === -1) return null;

  const separatorIndex = headerIndex + 1;
  if (!lines[separatorIndex]?.trim().startsWith('|')) return null;

  const rows: string[][] = [];
  let endIndex = separatorIndex + 1;
  while (endIndex < lines.length && lines[endIndex]!.trim().startsWith('|')) {
    rows.push(splitRow(lines[endIndex]!));
    endIndex++;
  }

  return { headerIndex, separatorIndex, rows, endIndex };
}

/**
 * Thay hoặc thêm một dòng dữ liệu trong bảng ngay sau `headingLine` của
 * `content`. Khớp theo cột `keyIndex` (thường là cột đầu — ngày): trùng
 * `keyValue` thì THAY dòng đó, không trùng thì thêm dòng mới vào cuối
 * bảng. Không thấy heading hoặc bảng thì trả về `content` nguyên văn —
 * không đoán, không tự tạo bảng mới.
 *
 * Dùng cho bảng dạng **nhật ký** — mỗi khoá (vd. mỗi ngày) một dòng, dòng
 * cũ vẫn giữ để thấy xu hướng. Bảng dạng **trạng thái hiện tại, không
 * phải nhật ký** (chỉ một dòng duy nhất, luôn ghi đè) thì dùng
 * `replaceOnlyRow` — xem đó để biết vì sao hai việc này KHÔNG dùng chung
 * một hàm.
 */
export function upsertTableRow(
  content: string,
  headingLine: string,
  keyIndex: number,
  keyValue: string,
  newRow: string[],
): string {
  const lines = content.split('\n');
  const table = findTableAfterHeading(lines, headingLine);
  if (!table) return content;

  const existingIndex = table.rows.findIndex((row) => row[keyIndex] === keyValue);
  const newLine = serializeRow(newRow);

  if (existingIndex !== -1) {
    const lineIndex = table.separatorIndex + 1 + existingIndex;
    lines[lineIndex] = newLine;
  } else {
    lines.splice(table.endIndex, 0, newLine);
  }

  return lines.join('\n');
}

/**
 * Thay DÒNG DUY NHẤT của bảng ngay sau `headingLine` bằng `newRow`, bất kể
 * nội dung dòng cũ là gì; bảng chưa có dòng nào thì thêm `newRow`. Có hơn
 * một dòng (dữ liệu cũ để lại, hoặc lỗi trước đó) thì gộp về còn đúng một
 * — dòng đầu bị thay, các dòng sau bị xoá.
 *
 * Bảng "Độ ổn định của `main`" là số **cộng dồn từ khi bắt đầu tới hôm
 * nay**, không phải một lần đo của riêng ngày hôm đó — cột đầu (nhãn
 * khoảng ngày) đổi mỗi ngày dù số liệu cộng dồn không đổi. Dùng
 * `upsertTableRow` khớp theo cột đó sẽ không bao giờ trùng khoá cũ, nên
 * mỗi lần chạy lại thêm một dòng gần như trùng dòng trước — bảng phình vô
 * hạn, đúng thứ rủi ro R12 mà chính số liệu này đo. `replaceOnlyRow` giữ
 * bảng luôn đúng một dòng "trạng thái hiện tại".
 */
export function replaceOnlyRow(content: string, headingLine: string, newRow: string[]): string {
  const lines = content.split('\n');
  const table = findTableAfterHeading(lines, headingLine);
  if (!table) return content;

  const newLine = serializeRow(newRow);
  const firstRowLineIndex = table.separatorIndex + 1;

  if (table.rows.length === 0) {
    lines.splice(table.endIndex, 0, newLine);
  } else {
    lines[firstRowLineIndex] = newLine;
    const extraRows = table.rows.length - 1;
    if (extraRows > 0) lines.splice(firstRowLineIndex + 1, extraRows);
  }

  return lines.join('\n');
}

// --- Định dạng dòng cho từng bảng cụ thể của `ops/metrics.md` ---

export function formatArchitectureRow(
  date: string,
  codeFiles: number,
  doneItems: number,
  note: string,
): string[] {
  const ratio = architectureRatio(codeFiles, doneItems);
  return [date, String(codeFiles), String(doneItems), ratio === null ? '—' : String(ratio), note];
}

export function formatStabilityRow(rangeLabel: string, merged: number, reverts: number, note: string): string[] {
  const green = greenRatioPercent(merged, reverts);
  return [rangeLabel, String(merged), String(reverts), green === null ? `— ${note}` : `${green}% (${note})`];
}

export function updateArchitectureTable(
  content: string,
  date: string,
  codeFiles: number,
  doneItems: number,
  note: string,
): string {
  return upsertTableRow(
    content,
    '## Sức khoẻ kiến trúc',
    0,
    date,
    formatArchitectureRow(date, codeFiles, doneItems, note),
  );
}

export function updateStabilityTable(
  content: string,
  rangeLabel: string,
  merged: number,
  reverts: number,
  note: string,
): string {
  return replaceOnlyRow(content, '## Độ ổn định của `main`', formatStabilityRow(rangeLabel, merged, reverts, note));
}

// --- Lớp vỏ đọc đĩa / gọi `gh` — không kiểm bằng test đơn vị, cùng lý do
// với `reap-abandoned-drafts.ts`: không có PR/lịch sử merge thật ở đây. ---

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function listBacklogFiles(root: string): string[] {
  const lanesDir = join(root, 'ops', 'lanes');
  return readdirSync(lanesDir)
    .map((lane) => join(lanesDir, lane, 'backlog.md'))
    .filter((path) => existsSync(path));
}

interface GhMergedPr {
  number: number;
  headRefName: string;
  mergedAt: string;
}

function fetchMergedPrs(): GhMergedPr[] {
  // `--limit 500`: không phân trang. Đủ cho quy mô hiện tại (một nhà máy
  // mới bắt đầu); vượt ngưỡng này thì số liệu bị cắt âm thầm — thêm phân
  // trang khi số PR merged thật sự tới gần đó.
  const result = spawnSync(
    'gh',
    ['pr', 'list', '--state', 'merged', '--json', 'number,headRefName,mergedAt', '--limit', '500'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`gh pr list thất bại: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as GhMergedPr[];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function main(): void {
  const root = process.cwd();

  const codeFiles = countCodeFiles(walk(root).map((path) => relative(root, path)));
  const doneItems = totalDoneItems(listBacklogFiles(root).map((path) => readFileSync(path, 'utf8')));

  const merged = fetchMergedPrs();
  const totalMerged = merged.length;
  const totalReverts = merged.filter((pr) => /^claude\/integration\/revert-/.test(pr.headRefName)).length;
  const startDate =
    totalMerged > 0
      ? formatDate(new Date(Math.min(...merged.map((pr) => new Date(pr.mergedAt).getTime()))))
      : formatDate(new Date());

  const today = formatDate(new Date());
  const rangeLabel = `${startDate} → ${today}`;

  const metricsPath = join(root, 'ops', 'metrics.md');
  let content = readFileSync(metricsPath, 'utf8');

  content = updateArchitectureTable(
    content,
    today,
    codeFiles,
    doneItems,
    'Đếm tự động bằng `ops/scripts/update-metrics.ts` (mục `I-002`).',
  );
  content = updateStabilityTable(
    content,
    rangeLabel,
    totalMerged,
    totalReverts,
    totalMerged > 0 && totalReverts === 0
      ? 'không lần nào phải revert'
      : `${totalReverts} lần revert trên ${totalMerged} lần merge`,
  );

  writeFileSync(metricsPath, content, 'utf8');

  process.stdout.write(
    `${JSON.stringify({ date: today, codeFiles, doneItems, totalMerged, totalReverts, rangeLabel }, null, 2)}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
