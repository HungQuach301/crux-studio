#!/usr/bin/env node
/**
 * Kiểm các workflow trong `ops/workflows/` TRƯỚC khi chúng tới GitHub.
 *
 * Vì sao cần: workflow ở đây chỉ có hiệu lực SAU khi PR merge vào `main` và
 * `sync-workflows` chép sang `.github/workflows/`. Một lỗi cú pháp vì thế
 * không hiện ra trên PR — nó hiện ra trên `main`, sau khi đã merge. Kiểm ở
 * chỗ rẻ nhất nghĩa là kiểm ở đây.
 *
 * Ba lỗi nó bắt, cả ba đều đã xảy ra thật khi soạn bộ workflow này:
 * 1. Dòng ở cột 0 bên trong khối `run: |` — heredoc kết thúc ở cột 0 làm vỡ
 *    khối YAML, và thông báo lỗi của GitHub không chỉ tới chỗ đó.
 * 2. Cú pháp bash sai trong khối `run:` — bắt bằng `bash -n`.
 * 3. Trùng tên với `sync-workflows.yml`, tức là agent ghi đè chính cơ chế
 *    sync (CHARTER 3.2).
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
