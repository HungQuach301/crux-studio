#!/usr/bin/env node
/**
 * Kiểm các workflow trong `ops/workflows/` TRƯỚC khi chúng tới GitHub.
 *
 * Vì sao cần: workflow ở đây chỉ có hiệu lực SAU khi PR merge vào `main` và
 * `sync-workflows` chép sang `.github/workflows/`. Một lỗi cú pháp vì thế
 * không hiện ra trên PR — nó hiện ra trên `main`, sau khi đã merge. Kiểm ở
 * chỗ rẻ nhất nghĩa là kiểm ở đây.
 *
 * Bốn lỗi nó bắt, cả bốn đều đã xảy ra thật:
 * 1. Dòng ở cột 0 bên trong khối `run: |` — heredoc kết thúc ở cột 0 làm vỡ
 *    khối YAML, và thông báo lỗi của GitHub không chỉ tới chỗ đó.
 * 2. Cú pháp bash sai trong khối `run:` — bắt bằng `bash -n`.
 * 3. Trùng tên với `sync-workflows.yml`, tức là agent ghi đè chính cơ chế
 *    sync (CHARTER 3.2).
 * 4. Khối `permissions` thiếu quyền mà chính workflow đó cần (KF-003). Khai
 *    `permissions` thì mọi quyền KHÔNG liệt kê thành `none`, nên thiếu một
 *    dòng là mất hẳn một quyền — và trên repo private, lỗi hiện ra dưới
 *    dạng 404 "Repository not found", không phải 403.
 */

import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = join(process.cwd(), 'ops', 'workflows');
const problems: string[] = [];

interface RunBlock {
  startLine: number;
  indent: number;
  lines: string[];
}

function runBlocks(source: string, file: string): RunBlock[] {
  const lines = source.split('\n');
  const blocks: RunBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const opener = /^(\s*)(?:- )?run:\s*\|-?\s*$/.exec(line);
    if (!opener) continue;
    const outerIndent = opener[1]!.length;
    const body: string[] = [];
    let j = i + 1;
    let bodyIndent = -1;
    for (; j < lines.length; j += 1) {
      const candidate = lines[j]!;
      if (candidate.trim() === '') {
        body.push('');
        continue;
      }
      const indent = candidate.length - candidate.trimStart().length;
      if (bodyIndent === -1) bodyIndent = indent;
      if (indent <= outerIndent) break;
      if (indent === 0) {
        problems.push(
          `${file}:${j + 1} — dòng ở cột 0 bên trong khối \`run: |\`. ` +
            'Khối YAML kết thúc ở đây, phần còn lại bị đọc sai. ' +
            'Thường là do heredoc đóng ở cột 0; dùng printf thay heredoc.',
        );
      }
      body.push(candidate.slice(bodyIndent));
    }
    blocks.push({ startLine: i + 1, indent: bodyIndent, lines: body });
    i = j - 1;
  }
  return blocks;
}

/**
 * Quyền tối thiểu cho từng thao tác (KF-003).
 *
 * Nguyên tắc: **mỗi workflow chỉ khai đúng quyền nó cần**. Bảng này là mặt
 * kia của nguyên tắc đó — nó bắt trường hợp khai THIẾU, còn việc khai THỪA
 * thì người soát bắt khi đọc diff.
 *
 * `need` ghi mức tối thiểu; `write` bao hàm `read`, nên khai `contents: write`
 * là đủ cho một luật đòi `contents: read`.
 */
interface PermissionRule {
  /** Dấu hiệu nhận ra thao tác trong nội dung workflow. */
  match: RegExp;
  scope: string;
  need: 'read' | 'write';
  /** Vì sao thao tác đó cần quyền này — in ra cùng lỗi, để người đọc không phải tra. */
  why: string;
}

const PERMISSION_RULES: readonly PermissionRule[] = [
  {
    match: /uses:\s*actions\/checkout@/,
    scope: 'contents',
    need: 'read',
    why: 'actions/checkout phải đọc được repo. Trên repo private, thiếu quyền này cho ra "Repository not found" (404) chứ không phải lỗi quyền.',
  },
  {
    match: /\bgh\s+label\s+(create|delete|edit|clone)\b/,
    scope: 'issues',
    need: 'write',
    why: 'nhãn của repo nằm dưới quyền Issues. `pull-requests: write` chỉ đủ để GẮN nhãn đã tồn tại lên PR, không đủ để TẠO nhãn.',
  },
  {
    match: /\bgh\s+issue\s+(create|comment|edit|close|reopen|delete|lock|unlock|pin|unpin|transfer)\b/,
    scope: 'issues',
    need: 'write',
    why: 'mở hoặc sửa issue.',
  },
  {
    match: /\bgh\s+issue\s+(list|view|status)\b/,
    scope: 'issues',
    need: 'read',
    why: 'đọc issue.',
  },
  {
    match: /\bgh\s+pr\s+(create|edit|comment|close|reopen|ready|review|merge)\b/,
    scope: 'pull-requests',
    need: 'write',
    why: 'sửa hoặc bình luận pull request.',
  },
  {
    match: /\bgh\s+pr\s+(list|view|status|diff|checks)\b/,
    scope: 'pull-requests',
    need: 'read',
    why: 'đọc pull request. Quyền này KHÔNG nằm trong `contents: read`.',
  },
  {
    match: /\bgh\s+(workflow\s+run|run\s+rerun|run\s+cancel)\b/,
    scope: 'actions',
    need: 'write',
    why: 'kích hoạt hoặc huỷ một lần chạy workflow.',
  },
  {
    match: /\bgh\s+(run|workflow)\s+(list|view)\b/,
    scope: 'actions',
    need: 'read',
    why: 'đọc lịch sử chạy workflow.',
  },
  {
    match: /\bgh\s+api\s+-X\s+PUT[^\n]*\/pulls\/[^\n]*\/merge/,
    scope: 'contents',
    need: 'write',
    why: 'merge một pull request ghi vào nhánh đích.',
  },
];

/** Đọc khối `permissions:` ở mức gốc của workflow. */
function declaredPermissions(source: string): Map<string, string> | null {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^permissions:/.test(l));
  if (start === -1) return null;

  // `permissions: read-all` / `write-all` ở dạng một dòng.
  const inline = /^permissions:\s*(\S+)\s*$/.exec(lines[start]!);
  if (inline) {
    const all = inline[1] === 'write-all' ? 'write' : inline[1] === 'read-all' ? 'read' : null;
    return all === null ? new Map() : new Map([['*', all]]);
  }

  const found = new Map<string, string>();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    const entry = /^\s+([a-z-]+):\s*([a-z-]+)\s*$/.exec(line);
    if (entry) found.set(entry[1]!, entry[2]!);
  }
  return found;
}

function satisfies(granted: string | undefined, need: 'read' | 'write'): boolean {
  if (granted === undefined || granted === 'none') return false;
  if (granted === 'write') return true;
  return need === 'read' && granted === 'read';
}

export function missingPermissions(source: string): string[] {
  const declared = declaredPermissions(source);
  // Không khai `permissions` thì workflow nhận quyền mặc định của repo.
  // Đó là một lựa chọn khác, không phải lỗi — luật này không nói gì về nó.
  if (declared === null) return [];
  if (declared.get('*') === 'write') return [];

  const missing: string[] = [];
  for (const rule of PERMISSION_RULES) {
    if (!rule.match.test(source)) continue;
    const granted = declared.get(rule.scope) ?? declared.get('*');
    if (satisfies(granted, rule.need)) continue;
    missing.push(
      `thiếu \`${rule.scope}: ${rule.need}\` (đang là \`${granted ?? 'không khai → none'}\`) — ${rule.why}`,
    );
  }
  return [...new Set(missing)];
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// Phần dưới chỉ chạy khi gọi trực tiếp. Nhờ vậy test import được
// `missingPermissions` mà không kích hoạt cả bộ linter — và không bị
// `process.exit` của nó giết giữa chừng.
const isMain = process.argv[1]?.endsWith('check-workflows.ts') === true;

if (isMain) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (files.length === 0) problems.push('ops/workflows/ rỗng.');

  const scratch = mkdtempSync(join(tmpdir(), 'crux-wf-'));
  let blockCount = 0;

  try {
    for (const file of files) {
      if (file === 'sync-workflows.yml') {
        problems.push(
          'ops/workflows/sync-workflows.yml — agent không được ghi đè cơ chế sync. ' +
            'File đó do chủ dự án tạo một lần trong .github/workflows/ (CHARTER 3.2).',
        );
        continue;
      }

      const source = readFileSync(join(dir, file), 'utf8');

      if (source.includes('\t')) problems.push(`${file} — chứa ký tự tab; YAML không chấp nhận tab để thụt lề.`);
      for (const key of ['name:', 'on:', 'jobs:']) {
        if (!source.split('\n').some((l) => l.startsWith(key))) {
          problems.push(`${file} — thiếu khoá gốc \`${key}\`.`);
        }
      }

      for (const missing of missingPermissions(source)) {
        problems.push(`${file} — khối \`permissions\` ${missing}`);
      }

      for (const block of runBlocks(source, file)) {
        blockCount += 1;
        const script = join(scratch, `${file}-${block.startLine}.sh`);
        writeFileSync(script, block.lines.join('\n'), 'utf8');
        const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
        if (result.status !== 0) {
          problems.push(
            `${file}:${block.startLine} — cú pháp bash sai trong khối run:\n      ${result.stderr.trim().split('\n').join('\n      ')}`,
          );
        }
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  if (problems.length > 0) {
    process.stderr.write(`Workflow có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }

  process.stdout.write(`Workflow ok: ${files.length} file, ${blockCount} khối run được kiểm bằng bash -n.\n`);
}
