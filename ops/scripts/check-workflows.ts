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
 * 5. Chuỗi sự kiện đứt (KF-004): workflow A tạo ra một sự kiện bằng
 *    `GITHUB_TOKEN` mà workflow B đang lắng nghe — kể cả khi B nằm ngoài
 *    `ops/workflows/` (xem `EXTERNAL_CONSUMERS`). GitHub cố ý KHÔNG kích
 *    hoạt workflow từ sự kiện do `GITHUB_TOKEN` tạo ra, nên B không bao
 *    giờ chạy — và không có gì đỏ để báo điều đó.
 */

import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { externalSideEffects, hasDryRunInput, hasWorkflowDispatch } from './smoke-workflows.ts';

const dir = join(process.cwd(), 'ops', 'workflows');
const problems: string[] = [];
/** Luật mềm (CHARTER mục 4): in ra, không làm đỏ. */
const warnings: string[] = [];

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
interface Grant {
  scope: string;
  need: 'read' | 'write';
}

interface PermissionRule {
  /** Dấu hiệu nhận ra thao tác trong nội dung workflow. */
  match: RegExp;
  /**
   * Các quyền chấp nhận được. Thoả **một** trong số đó là đủ — vài endpoint
   * của GitHub nằm dưới nhiều scope cùng lúc, và ép chọn một scope sẽ buộc
   * workflow khai thừa quyền.
   */
  accepts: readonly Grant[];
  /** Vì sao thao tác đó cần quyền này — in ra cùng lỗi, để người đọc không phải tra. */
  why: string;
}

const PERMISSION_RULES: readonly PermissionRule[] = [
  {
    match: /uses:\s*actions\/checkout@/,
    accepts: [{ scope: 'contents', need: 'read' }],
    why: 'actions/checkout phải đọc được repo. Trên repo private, thiếu quyền này cho ra "Repository not found" (404) chứ không phải lỗi quyền.',
  },
  {
    match: /\bgh\s+label\s+(create|delete|edit|clone)\b/,
    // Nhãn của repo nằm dưới CẢ HAI scope Issues và Pull requests. Đã kiểm
    // bằng chạy thật: ci run #1 tạo được nhãn `automerge` và `cross-lane`
    // chỉ với `pull-requests: write`, không có quyền `issues` nào (KF-003).
    accepts: [
      { scope: 'issues', need: 'write' },
      { scope: 'pull-requests', need: 'write' },
    ],
    why: 'tạo hoặc sửa nhãn của repo. Một trong hai quyền là đủ.',
  },
  {
    match: /\bgh\s+issue\s+(create|comment|edit|close|reopen|delete|lock|unlock|pin|unpin|transfer)\b/,
    accepts: [{ scope: 'issues', need: 'write' }],
    why: 'mở hoặc sửa issue.',
  },
  {
    match: /\bgh\s+issue\s+(list|view|status)\b/,
    accepts: [{ scope: 'issues', need: 'read' }],
    why: 'đọc issue.',
  },
  {
    match: /\bgh\s+pr\s+(create|edit|comment|close|reopen|ready|review|merge)\b/,
    accepts: [{ scope: 'pull-requests', need: 'write' }],
    why: 'sửa hoặc bình luận pull request.',
  },
  {
    match: /\bgh\s+pr\s+(list|view|status|diff|checks)\b/,
    accepts: [{ scope: 'pull-requests', need: 'read' }],
    why: 'đọc pull request. Quyền này KHÔNG nằm trong `contents: read`.',
  },
  {
    match: /\bgh\s+(workflow\s+run|run\s+rerun|run\s+cancel)\b/,
    accepts: [{ scope: 'actions', need: 'write' }],
    why: 'kích hoạt hoặc huỷ một lần chạy workflow.',
  },
  {
    match: /\bgh\s+(run|workflow)\s+(list|view)\b/,
    accepts: [{ scope: 'actions', need: 'read' }],
    why: 'đọc lịch sử chạy workflow.',
  },
  {
    match: /\bgh\s+api\s+-X\s+PUT[^\n]*\/pulls\/[^\n]*\/merge/,
    accepts: [{ scope: 'contents', need: 'write' }],
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
    const ok = rule.accepts.some((grant) =>
      satisfies(declared.get(grant.scope) ?? declared.get('*'), grant.need),
    );
    if (ok) continue;
    const wanted = rule.accepts.map((g) => `\`${g.scope}: ${g.need}\``).join(' hoặc ');
    const actual = rule.accepts
      .map((g) => `${g.scope}=${declared.get(g.scope) ?? declared.get('*') ?? 'none'}`)
      .join(', ');
    missing.push(`thiếu ${wanted} (đang là ${actual}) — ${rule.why}`);
  }
  return [...new Set(missing)];
}

/**
 * KF-004 — chuỗi sự kiện đứt vì `GITHUB_TOKEN`.
 *
 * GitHub cố ý không kích hoạt workflow từ sự kiện do `GITHUB_TOKEN` tạo ra,
 * để tránh vòng lặp vô hạn. Hệ quả: nếu workflow A mở issue / gắn nhãn /
 * đẩy commit bằng `GITHUB_TOKEN`, và workflow B đăng ký lắng nghe đúng sự
 * kiện đó, thì **B không bao giờ chạy**.
 *
 * Đây là loại hỏng tệ nhất vì nó KHÔNG CÓ CHỮ KÝ: A vẫn xanh, thứ A tạo ra
 * vẫn đúng, B chỉ đơn giản là không tồn tại trong lịch sử chạy. Không job
 * nào đỏ, không dòng lỗi nào được in.
 *
 * Luật này bắt cặp A–B đó. Nó KHÔNG tự đoán được cách xử lý đúng, vì có hai
 * cách hợp lệ và chúng khác nhau về bản chất:
 *   1. Gọi thẳng workflow kia bằng `gh workflow run` (`workflow_dispatch`).
 *   2. Không dựa vào workflow kia nữa — làm luôn việc đó trong chính A.
 *
 * Vì vậy luật đòi một **khai báo tường minh có lý do** trong file A:
 *
 *     # KF-004 <tên sự kiện>: <vì sao chuỗi này không đứt>
 *
 * Bắt người viết gõ ra lý do là chủ ý. Một cờ `true` thì ai cũng bật được
 * mà không nghĩ; một câu lý do thì không.
 */
interface EventProducer {
  match: RegExp;
  /** Sự kiện mà thao tác này sinh ra, theo tên GitHub dùng trong khối `on:`. */
  event: string;
  what: string;
}

const EVENT_PRODUCERS: readonly EventProducer[] = [
  { match: /\bgh\s+issue\s+create\b/, event: 'issues', what: 'mở issue' },
  {
    match: /\bgh\s+issue\s+edit\b[^\n]*--(add|remove)-label/,
    event: 'issues',
    what: 'gắn hoặc gỡ nhãn trên issue',
  },
  { match: /\bgh\s+(issue|pr)\s+comment\b/, event: 'issue_comment', what: 'bình luận' },
  {
    match: /\bgh\s+pr\s+edit\b[^\n]*--(add|remove)-label/,
    event: 'pull_request',
    what: 'gắn hoặc gỡ nhãn trên PR',
  },
  { match: /\bgh\s+pr\s+create\b/, event: 'pull_request', what: 'mở PR' },
  {
    match: /\bgh\s+api\b[^\n]*-X\s+PUT[^\n]*\/merge/,
    event: 'push',
    what: 'merge PR, tức là đẩy commit lên nhánh đích',
  },
];

/** Tên các sự kiện mà một workflow đăng ký trong khối `on:`. */
export function subscribedEvents(source: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^on:/.test(l));
  if (start === -1) return [];

  // `on: [push, pull_request]` hoặc `on: push`
  const inline = /^on:\s*(.+)$/.exec(lines[start]!);
  if (inline && inline[1]!.trim() !== '') {
    return inline[1]!
      .replace(/[[\]]/g, '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e !== '');
  }

  const events: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    const entry = /^\s{1,2}([a-z_]+):/.exec(line);
    if (entry) events.push(entry[1]!);
  }
  return events;
}

/**
 * Workflow đăng ký nghe sự kiện nhưng KHÔNG nằm trong `ops/workflows/`, nên
 * vòng lặp bên dưới không thấy chúng.
 *
 * Hiện có đúng một: `.github/workflows/sync-workflows.yml` do chủ dự án tạo
 * một lần (CHARTER 3.2). Nó nghe `push` vào `main` với `paths: ops/workflows/**`.
 *
 * Bỏ sót nó từng vô hại: `ops/workflows/**` nằm trong vùng `owner-merge`,
 * nên chỉ NGƯỜI mới đưa được PR chạm tới đó vào `main`, và thao tác của
 * người sinh sự kiện thật. D-C06 chuyển thư mục đó sang `automerge-delayed`
 * — máy tự đưa vào `main` được — nên chỗ đó thành một chuỗi đứt thật. Khai
 * ở đây để luật KF-004 nhìn thấy nó như mọi workflow khác.
 */
export const EXTERNAL_CONSUMERS: ReadonlyMap<string, readonly string[]> = new Map([
  ['push', ['.github/workflows/sync-workflows.yml']],
]);

/**
 * Mục `P-010` — workflow có tác dụng phụ ra ngoài mà không có `inputs.dry_run`.
 *
 * Luật **mềm** (CHARTER mục 4): cảnh báo, KHÔNG chặn. Lý do nó không chặn:
 * `.github/workflows/sync-workflows.yml` nằm ngoài tầm agent (CHARTER 3.2,
 * giả định G10), nên có ít nhất một workflow trong hệ thống mà luật này
 * không bao giờ sửa được. Một luật cứng mà biết trước là có ngoại lệ không
 * sửa được thì hoặc phải khai ngoại lệ, hoặc phải chặn toàn bộ công việc —
 * cả hai đều tệ hơn một cảnh báo được đọc.
 *
 * Hệ quả của việc thiếu `dry_run`: `smoke-workflows.yml` phải chọn giữa gọi
 * THẬT (gây tác dụng phụ thật mỗi lần workflow đó đổi) hoặc không gọi. Với
 * workflow merge thì nó từ chối gọi — xem `planSmokeRuns` nhánh `refused` —
 * nên thiếu `dry_run` ở đó nghĩa là workflow ấy KHÔNG được chạy thử lần nào.
 */
export function missingDryRun(file: string, source: string): string | null {
  if (file === 'sync-workflows.yml') return null;
  const effects = externalSideEffects(source);
  if (effects.length === 0) return null;
  // Miễn trừ phải VIẾT RA LÝ DO, cùng khuôn với `# KF-004 <sự kiện>: …` ở
  // trên và vì cùng một lẽ: một cờ `true` thì ai cũng bật được mà không
  // nghĩ, một câu lý do thì không. `[^\S\n]` chứ không phải `\s` — `\s`
  // nuốt cả xuống dòng, nên một khai báo RỖNG sẽ khớp ký tự đầu của dòng kế
  // tiếp và coi như đã có lý do.
  if (/#[^\S\n]*P-010[^\S\n]+dry-run[^\S\n]*:[^\S\n]*\S/.test(source)) return null;
  if (!hasWorkflowDispatch(source)) {
    return (
      `có tác dụng phụ ra ngoài (${effects.join(', ')}) và KHÔNG có \`workflow_dispatch\` — ` +
      'không cách nào chạy thử được sau khi merge (mục `P-010`). Thêm `workflow_dispatch` kèm `inputs.dry_run`.'
    );
  }
  if (hasDryRunInput(source)) return null;
  return (
    `có tác dụng phụ ra ngoài (${effects.join(', ')}) nhưng không khai \`inputs.dry_run\` — ` +
    '`smoke-workflows.yml` sẽ phải gọi nó ở chế độ THẬT, hoặc từ chối gọi hẳn (mục `P-010`).\n' +
    '      Xử lý: thêm `inputs.dry_run`, HOẶC khai lý do:  # P-010 dry-run: <vì sao gọi thật vẫn vô hại>'
  );
}

export interface BrokenChain {
  event: string;
  what: string;
  consumers: string[];
}

/**
 * Cặp sản-xuất / tiêu-thụ chưa được khai báo trong `source`.
 * `consumersByEvent` gom từ TẤT CẢ workflow, kể cả chính file đang xét —
 * một workflow tự kích hoạt lại mình cũng đứt y hệt.
 */
export function brokenEventChains(
  source: string,
  consumersByEvent: ReadonlyMap<string, readonly string[]>,
): BrokenChain[] {
  const found: BrokenChain[] = [];
  for (const producer of EVENT_PRODUCERS) {
    if (!producer.match.test(source)) continue;
    const consumers = consumersByEvent.get(producer.event);
    if (!consumers || consumers.length === 0) continue;
    // `[^\S\n]*\S` chứ không phải `\s*\S`: `\s` nuốt cả xuống dòng, nên một
    // khai báo RỖNG sẽ khớp với ký tự đầu của dòng kế tiếp và coi như đã có
    // lý do. Lý do phải nằm trên CÙNG một dòng với khai báo.
    const declared = new RegExp(
      `#[^\\S\\n]*KF-004[^\\S\\n]+${producer.event}[^\\S\\n]*:[^\\S\\n]*\\S`,
    ).test(source);
    if (declared) continue;
    if (found.some((f) => f.event === producer.event)) continue;
    found.push({ event: producer.event, what: producer.what, consumers: [...consumers] });
  }
  return found;
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

  // Bản đồ "sự kiện → workflow đang lắng nghe nó", gom từ TẤT CẢ workflow.
  // Phải gom trước vòng lặp: luật KF-004 xét một file dựa trên những gì các
  // file KHÁC đăng ký nghe.
  const consumersByEvent = new Map<string, string[]>();
  for (const [event, consumers] of EXTERNAL_CONSUMERS) {
    consumersByEvent.set(event, [...consumers]);
  }
  for (const file of files) {
    if (file === 'sync-workflows.yml') continue;
    for (const event of subscribedEvents(readFileSync(join(dir, file), 'utf8'))) {
      const bucket = consumersByEvent.get(event) ?? [];
      bucket.push(file);
      consumersByEvent.set(event, bucket);
    }
  }

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

      const dryRun = missingDryRun(file, source);
      if (dryRun !== null) warnings.push(`${file} — ${dryRun}`);

      for (const chain of brokenEventChains(source, consumersByEvent)) {
        problems.push(
          `${file} — ${chain.what} bằng GITHUB_TOKEN sinh ra sự kiện \`${chain.event}\`, ` +
            `mà ${chain.consumers.join(', ')} đang lắng nghe sự kiện đó. ` +
            'GitHub KHÔNG kích hoạt workflow từ sự kiện do GITHUB_TOKEN tạo ra, nên workflow kia ' +
            'sẽ không bao giờ chạy — và không có gì đỏ để báo điều đó (KF-004).\n' +
            `      Xử lý: gọi thẳng bằng \`gh workflow run\`, HOẶC làm luôn việc đó trong ${file}.\n` +
            `      Rồi khai báo trong ${file}:  # KF-004 ${chain.event}: <vì sao chuỗi này không đứt>`,
        );
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

  // Cảnh báo in TRƯỚC lỗi, và in cả khi có lỗi: một luật mềm bị nuốt mất
  // vì có luật cứng đỏ cùng lúc là một luật mềm không tồn tại.
  if (warnings.length > 0) {
    process.stderr.write(
      `Cảnh báo (luật mềm, KHÔNG chặn — CHARTER mục 4):\n${warnings.map((w) => `  - ${w}`).join('\n')}\n`,
    );
  }

  if (problems.length > 0) {
    process.stderr.write(`Workflow có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `Workflow ok: ${files.length} file, ${blockCount} khối run được kiểm bằng bash -n` +
      `${warnings.length > 0 ? `, ${warnings.length} cảnh báo` : ''}.\n`,
  );
}
