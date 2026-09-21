#!/usr/bin/env node
/**
 * BẤT BIẾN I4 — vùng bảo vệ, từ D-C06 chia làm HAI mức.
 *
 * Trước D-C06 vùng bảo vệ chỉ có một mức: chạm là `owner-merge`, và chủ dự
 * án phải tự merge từng PR một. Tám thư mục nằm trong đó, nên gần như mọi
 * PR hạ tầng đều rơi vào tay người. Đó là lý do chế độ vận hành cũ ngốn
 * nhiều hơn 15 phút mỗi ngày.
 *
 * D-C06 giữ nguyên bất biến, đổi cách chặn:
 *
 * - `owner-merge` — chỉ còn ba nhóm, đều là chỗ mà một lần sai KHÔNG revert
 *   lại được bằng một PR revert bình thường:
 *     (a) CHARTER mục 1 (mục tiêu) và mục 3 (bất biến), `ops/invariants.*`;
 *     (b) `.claude/settings.json`, `.claude/hooks/**` — lớp chặn của agent;
 *     (c) `ops/workflows/automerge.yml`, `.github/**` (gồm `sync-workflows.yml`),
 *         và mọi workflow dùng secret hoặc phát hành.
 *
 * - `automerge-delayed` — phần vùng bảo vệ cũ còn lại. Tự merge sau một
 *   khoảng chờ nếu CI xanh và chủ dự án không nói `dừng`. Xem
 *   `ops/invariants.delayed-merge.ts`.
 *
 * File này nằm dưới `ops/invariants.*`, nên chính nó là `owner-merge`: một
 * PR không tự nới được lớp chặn của mình.
 *
 * ⚠️ `automerge.yml` chạy file này theo bản trên `main`, KHÔNG theo bản
 * trong nhánh PR. `ci.yml` chạy bản trong nhánh PR, và kết quả của nó chỉ
 * là cái nhãn — nhãn là để người đọc, không phải để máy tin. Lớp chặn thật
 * nằm ở `automerge.yml` (rà soát Z8 trong `ops/known-failures.md`).
 */

import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Gate = 'owner-merge' | 'automerge-delayed' | 'open';

export interface Verdict {
  gate: Gate;
  /** Lý do phải để chủ dự án merge. Rỗng khi không có. */
  owner: string[];
  /** Lý do phải chờ trước khi tự merge. Rỗng khi không có. */
  delayed: string[];
}

/** CHARTER mục nào chạm vào là `owner-merge` (D-C06 điểm 1). */
export const OWNER_CHARTER_SECTIONS: readonly string[] = ['1', '3'];

interface PathRule {
  re: RegExp;
  why: string;
}

const OWNER_PATHS: readonly PathRule[] = [
  { re: /^\.github\//, why: '`.github/**` — định nghĩa workflow đang chạy thật, gồm `sync-workflows.yml`' },
  { re: /^ops\/invariants\./, why: '`ops/invariants.*` — chính lớp chặn này' },
  { re: /^\.claude\/settings\.json$/, why: '`.claude/settings.json` — luật deny của agent' },
  { re: /^\.claude\/hooks\//, why: '`.claude/hooks/**` — hook chặn lệnh của agent' },
  { re: /^ops\/workflows\/automerge\.yml$/, why: '`ops/workflows/automerge.yml` — workflow tự merge' },
];

const DELAYED_PATHS: readonly PathRule[] = [
  { re: /^CLAUDE\.md$/, why: '`CLAUDE.md` — luật làm việc của agent' },
  { re: /^docs\/decisions\//, why: '`docs/decisions/**` — quyết định đã chốt' },
  { re: /^docs\/spec\//, why: '`docs/spec/**` — spec tham chiếu' },
  { re: /^kernel\/contracts\//, why: '`kernel/contracts/**` — phong bì và ranh giới xưởng' },
  { re: /^\.claude\//, why: '`.claude/**` — cấu hình agent ngoài lớp chặn' },
  { re: /^ops\/workflows\//, why: '`ops/workflows/**` — workflow (bản nháp, chưa có hiệu lực tới khi sync)' },
];

/**
 * Một workflow có phải loại chỉ chủ dự án merge không (D-C06 điểm 2c)?
 *
 * Hai dấu hiệu, cả hai đều đọc được từ chính nội dung file:
 * 1. Dùng một secret KHÁC `GITHUB_TOKEN`. Secret là thứ duy nhất trong repo
 *    mà một PR không thể tự kiểm — và là thứ rò ra ngoài được (bất biến I1).
 * 2. Phát hành: tạo release, hoặc đẩy sang repo khác. Mọi thứ ra công chúng
 *    là `irreversible` (CHARTER 2.3).
 *
 * KHÔNG nhận nhầm `gh api repos/.../releases/latest` (ci.yml đọc bản phát
 * hành của gitleaks): đọc release của repo NGƯỜI KHÁC không phải phát hành.
 */
export function workflowNeedsOwner(source: string): string | null {
  for (const match of source.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (match[1] !== 'GITHUB_TOKEN') return `dùng secret \`${match[1]}\``;
  }
  const publishes =
    /\bgh\s+release\s+(create|upload|edit|delete)\b/.test(source) ||
    /-X\s+POST[^\n]*\/releases\b/.test(source) ||
    /softprops\/action-gh-release|actions\/upload-release-asset/.test(source) ||
    /\bgh\s+repo\s+create\b/.test(source);
  return publishes ? 'phát hành ra ngoài repo' : null;
}

export interface Section {
  id: string;
  start: number;
  end: number;
}

/** Cắt CHARTER.md thành các mục cấp một. `PL` là phụ lục, `đầu file` là phần trước mục 0. */
export function sections(source: string): Section[] {
  const lines = source.split('\n');
  const marks: { id: string; line: number }[] = [];
  lines.forEach((line, index) => {
    const numbered = /^## (\d+)\./.exec(line);
    if (numbered) {
      marks.push({ id: numbered[1]!, line: index + 1 });
      return;
    }
    if (/^## PHỤ LỤC/.test(line)) marks.push({ id: 'PL', line: index + 1 });
  });

  const out: Section[] = [];
  marks.forEach((mark, index) => {
    const next = marks[index + 1];
    out.push({ id: mark.id, start: mark.line, end: next ? next.line - 1 : lines.length });
  });
  const first = out[0];
  if (first && first.start > 1) out.unshift({ id: 'đầu file', start: 1, end: first.start - 1 });
  return out;
}

/** Số dòng đã chạm, ở cả hai phía của một diff `-U0`. */
export function touchedLines(diff: string): { base: number[]; head: number[] } {
  const base: number[] = [];
  const head: number[] = [];
  for (const hunk of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const baseStart = Number(hunk[1]);
    const baseCount = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const headStart = Number(hunk[3]);
    const headCount = hunk[4] === undefined ? 1 : Number(hunk[4]);
    // Thuần thêm (`-a,0`) hoặc thuần xoá (`+c,0`): neo vào dòng ngay trước
    // chỗ chèn, nếu không phía đó không có dòng nào để quy về một mục.
    if (baseCount === 0) base.push(baseStart);
    for (let i = 0; i < baseCount; i += 1) base.push(baseStart + i);
    if (headCount === 0) head.push(headStart);
    for (let i = 0; i < headCount; i += 1) head.push(headStart + i);
  }
  return { base, head };
}

/** Các mục cấp một mà những dòng này rơi vào. */
export function sectionsForLines(source: string, touched: readonly number[]): string[] {
  const all = sections(source);
  const hit = new Set<string>();
  for (const line of touched) {
    const found = all.find((section) => line >= section.start && line <= section.end);
    hit.add(found ? found.id : 'đầu file');
  }
  return [...hit];
}

/** Hợp của hai phía: mục bị chạm ở bản cũ và mục bị chạm ở bản mới. */
export function charterSectionsTouched(baseSource: string, headSource: string, diff: string): string[] {
  const lines = touchedLines(diff);
  return [
    ...new Set([
      ...sectionsForLines(baseSource, lines.base),
      ...sectionsForLines(headSource, lines.head),
    ]),
  ].sort();
}

export interface ClassifyInput {
  changed: readonly string[];
  /**
   * Các mục CHARTER bị chạm. `null` nghĩa là KHÔNG đọc được diff — và khi
   * không đọc được thì kết luận là `owner-merge`. Hướng an toàn của lớp
   * chặn này luôn là về phía người.
   */
  charterSections: readonly string[] | null;
  /** Nội dung bản head của một workflow, hoặc `null` nếu không đọc được (đã xoá, không lấy được). */
  workflowSource: (path: string) => string | null;
}

export function classify(input: ClassifyInput): Verdict {
  const owner: string[] = [];
  const delayed: string[] = [];

  for (const path of input.changed) {
    const file = path.trim();
    if (file === '') continue;

    const ownerPath = OWNER_PATHS.find((rule) => rule.re.test(file));
    if (ownerPath) {
      owner.push(ownerPath.why);
      continue;
    }

    if (file === 'CHARTER.md') {
      if (input.charterSections === null) {
        owner.push('`CHARTER.md` — không đọc được diff, nên coi như chạm mục 1 hoặc 3');
      } else {
        const hit = input.charterSections.filter((id) => OWNER_CHARTER_SECTIONS.includes(id));
        if (hit.length > 0) owner.push(`\`CHARTER.md\` mục ${hit.join(', ')} — mục tiêu và bất biến`);
        else delayed.push(`\`CHARTER.md\` mục ${input.charterSections.join(', ')} — ngoài mục 1 và 3`);
      }
      continue;
    }

    if (/^ops\/workflows\/.+\.ya?ml$/.test(file)) {
      const source = input.workflowSource(file);
      if (source === null) {
        owner.push(`\`${file}\` — không đọc được bản head (đã xoá?), nên coi như dùng secret`);
      } else {
        const why = workflowNeedsOwner(source);
        if (why !== null) owner.push(`\`${file}\` — ${why}`);
        else delayed.push(`\`${file}\` — workflow không dùng secret, không phát hành`);
      }
      continue;
    }

    const delayedPath = DELAYED_PATHS.find((rule) => rule.re.test(file));
    if (delayedPath) delayed.push(delayedPath.why);
  }

  const gate: Gate = owner.length > 0 ? 'owner-merge' : delayed.length > 0 ? 'automerge-delayed' : 'open';
  return { gate, owner: [...new Set(owner)], delayed: [...new Set(delayed)] };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/invariants.protected-area.ts --changed <file> [--head <dir>] [--base-charter <file>]
//
// `--changed` là file văn bản, mỗi dòng một đường dẫn (đầu ra của
// `git diff --name-only`). `--head` là gốc của cây bản head — mặc định thư
// mục hiện tại. In ra JSON `{gate, owner, delayed}`.

function argOf(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const isMain = process.argv[1]?.endsWith('invariants.protected-area.ts') === true;

if (isMain) {
  const changedPath = argOf('changed');
  if (changedPath === undefined || !existsSync(changedPath)) {
    process.stderr.write('Thiếu --changed <file chứa danh sách đường dẫn>.\n');
    process.exit(2);
  }

  const headDir = argOf('head') ?? '.';
  const baseCharter = argOf('base-charter');
  const changed = readFileSync(changedPath, 'utf8').split('\n').filter((line) => line.trim() !== '');

  let charterSections: string[] | null = null;
  if (changed.includes('CHARTER.md')) {
    const headCharter = join(headDir, 'CHARTER.md');
    if (baseCharter !== undefined && existsSync(baseCharter) && existsSync(headCharter)) {
      const scratch = mkdtempSync(join(tmpdir(), 'crux-charter-'));
      try {
        const left = join(scratch, 'base.md');
        const right = join(scratch, 'head.md');
        writeFileSync(left, readFileSync(baseCharter, 'utf8'), 'utf8');
        writeFileSync(right, readFileSync(headCharter, 'utf8'), 'utf8');
        // `git diff --no-index` trả 1 khi CÓ khác biệt. Chỉ >1 mới là lỗi thật.
        const result = spawnSync('git', ['diff', '--no-index', '-U0', left, right], { encoding: 'utf8' });
        if (result.status !== null && result.status <= 1) {
          charterSections = charterSectionsTouched(
            readFileSync(left, 'utf8'),
            readFileSync(right, 'utf8'),
            result.stdout,
          );
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  }

  const verdict = classify({
    changed,
    charterSections,
    workflowSource: (path) => {
      const full = join(headDir, path);
      return existsSync(full) ? readFileSync(full, 'utf8') : null;
    },
  });

  process.stdout.write(`${JSON.stringify(verdict)}\n`);
}
