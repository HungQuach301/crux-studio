#!/usr/bin/env node
/**
 * Mục `P-010` — chạy thử workflow vừa đổi, sau khi nó đã vào `main`.
 *
 * Vì sao cần (KF-003, KF-004, rủi ro B7): workflow chạy trên một PR là bản
 * nằm trong `.github/workflows/` của **nhánh PR**, mà nhánh PR thừa hưởng
 * bản đó từ `main`. Agent không ghi được `.github/` (CHARTER 3.2, giả định
 * G10), nên bản mới trong `ops/workflows/` **không bao giờ** được chạy
 * trước khi merge. `pnpm lint:workflows` kiểm được cú pháp và khối
 * `permissions`, nhưng không kiểm được quyền thật, secret thật, hay một
 * lệnh `gh` gọi sai — những thứ chỉ lộ ra khi chạy.
 *
 * Đã xảy ra thật hai lần: `labels` run #1 hỏng vì thiếu `contents: read`,
 * và hai workflow nữa mang lỗi cùng loại nằm im vì **chưa từng chạy**. Cả
 * hai lần đều chỉ lộ ra khi có người bấm tay.
 *
 * File này là phần **quyết định** của cơ chế đó: nhận nội dung các workflow
 * vừa đổi, trả về kế hoạch gọi. Phần chạy nằm ở
 * `ops/workflows/smoke-workflows.yml`. Tách làm hai để phần quyết định kiểm
 * được bằng `node --test` — bash trong một workflow không chạy thử ở đây thì
 * không ai kiểm được nó, và đó đúng là cái vòng luẩn quẩn mục này đi gỡ.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Đọc khối `on:` ───────────────────────────────────────────────────────

/** Các dòng thuộc một khối YAML mở đầu bằng `key` ở mức thụt lề `indent`. */
function blockLines(lines: readonly string[], startIndex: number): string[] {
  const opener = lines[startIndex]!;
  const openerIndent = opener.length - opener.trimStart().length;
  const body: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= openerIndent) break;
    body.push(line);
  }
  return body;
}

/**
 * Workflow có `workflow_dispatch` không — tức có gọi tay được không.
 *
 * Nhận cả ba dạng GitHub chấp nhận: `on: workflow_dispatch`,
 * `on: [push, workflow_dispatch]`, và khối `on:` nhiều dòng.
 */
export function hasWorkflowDispatch(source: string): boolean {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /^on:/.test(l));
  if (start === -1) return false;

  const inline = /^on:\s*(.+)$/.exec(lines[start]!);
  if (inline && inline[1]!.trim() !== '') {
    return inline[1]!
      .replace(/[[\]]/g, '')
      .split(',')
      .map((e) => e.trim())
      .includes('workflow_dispatch');
  }

  return blockLines(lines, start).some((l) => /^\s+workflow_dispatch:/.test(l));
}

/**
 * Tên các `inputs` khai dưới `workflow_dispatch`.
 *
 * Trả mảng rỗng khi không có `workflow_dispatch`, khi nó không có `inputs`,
 * hoặc khi `on:` viết ở dạng một dòng (dạng đó không mang inputs được).
 */
export function dispatchInputs(source: string): string[] {
  const lines = source.split('\n');
  const onStart = lines.findIndex((l) => /^on:/.test(l));
  if (onStart === -1) return [];

  const onBody = blockLines(lines, onStart);
  const wdIndex = onBody.findIndex((l) => /^\s+workflow_dispatch:/.test(l));
  if (wdIndex === -1) return [];

  const wdBody = blockLines(onBody, wdIndex);
  const inputsIndex = wdBody.findIndex((l) => /^\s+inputs:/.test(l));
  if (inputsIndex === -1) return [];

  const inputsBody = blockLines(wdBody, inputsIndex);
  if (inputsBody.length === 0) return [];
  const keyIndent = inputsBody[0]!.length - inputsBody[0]!.trimStart().length;

  const names: string[] = [];
  for (const line of inputsBody) {
    const indent = line.length - line.trimStart().length;
    if (indent !== keyIndent) continue;
    if (line.trimStart().startsWith('#')) continue;
    const key = /^\s*([A-Za-z_][A-Za-z0-9_-]*):/.exec(line);
    if (key) names.push(key[1]!);
  }
  return names;
}

/** Workflow khai `inputs.dry_run` — tức chạy thử được mà không gây tác dụng phụ. */
export function hasDryRunInput(source: string): boolean {
  return dispatchInputs(source).includes('dry_run');
}

// ── Tác dụng phụ ra bên ngoài ────────────────────────────────────────────

/**
 * Thao tác đổi trạng thái **bên ngoài** lần chạy: repo, issue, PR, nhãn,
 * lần chạy workflow khác. Đây là tập thao tác mà một lần chạy thử **không**
 * được phép làm thật.
 *
 * Nhận diện bằng CHỮ trong nội dung workflow, cùng cách `check-workflows.ts`
 * làm cho `PERMISSION_RULES` và `EVENT_PRODUCERS` — không phân tích bash.
 * Giới hạn đó có thật và ghi ở đây thay vì để người sau tự phát hiện: một
 * lệnh `gh` lắp từ biến (`$CMD issue create`) sẽ lọt.
 */
export interface SideEffect {
  match: RegExp;
  what: string;
}

export const SIDE_EFFECTS: readonly SideEffect[] = [
  { match: /\bgh\s+label\s+(create|delete|edit|clone)\b/, what: 'tạo hoặc sửa nhãn của repo' },
  {
    match: /\bgh\s+issue\s+(create|comment|edit|close|reopen|delete|lock|unlock|pin|unpin|transfer)\b/,
    what: 'mở hoặc sửa issue',
  },
  {
    match: /\bgh\s+pr\s+(create|edit|comment|close|reopen|ready|review|merge)\b/,
    what: 'sửa hoặc bình luận pull request',
  },
  { match: /\bgh\s+workflow\s+run\b/, what: 'kích hoạt một workflow khác' },
  { match: /\bgh\s+run\s+(rerun|cancel)\b/, what: 'chạy lại hoặc huỷ một lần chạy workflow' },
  { match: /\bgh\s+api\s+-X\s+(POST|PUT|PATCH|DELETE)\b/, what: 'gọi API GitHub ở chế độ ghi' },
  { match: /\bgit\s+push\b/, what: 'đẩy commit lên repo' },
];

/** Các tác dụng phụ ra ngoài mà `source` có. Rỗng nghĩa là chạy thử vô hại. */
export function externalSideEffects(source: string): string[] {
  return [...new Set(SIDE_EFFECTS.filter((rule) => rule.match.test(source)).map((r) => r.what))];
}

/**
 * Thao tác **không bao giờ** được chạy thật trong một lần chạy thử, dù
 * hoàn cảnh nào.
 *
 * Merge là thao tác duy nhất trong repo không hoàn tác được bằng một lần
 * chạy khác: nó đưa code vào `main` và làm `automerge` bỏ qua cửa 12 giờ
 * của `automerge-delayed` (CHARTER 3.3). Vì vậy nó được canh bằng MỘT luật
 * riêng, không gộp vào `SIDE_EFFECTS` ở trên.
 */
export const MERGE_PATTERNS: readonly RegExp[] = [
  /\bgh\s+api\b[^\n]*-X\s+PUT[^\n]*\/merge\b/,
  /\bgh\s+pr\s+merge\b/,
];

/**
 * Tên file **không bao giờ** được gọi ở chế độ thật, kể cả khi cách nhận
 * diện bằng chữ ở trên trượt.
 *
 * Hai lớp cho cùng một luật là cố ý: `MERGE_PATTERNS` bắt theo nội dung nên
 * phủ được cả workflow merge trong tương lai mà hôm nay chưa tồn tại; danh
 * sách này bắt theo tên nên vẫn đúng khi nội dung đổi cách viết. Bỏ lớp nào
 * cũng để hở một đường.
 */
export const NEVER_REAL_DISPATCH: readonly string[] = ['automerge.yml'];

/** Workflow này có bị cấm gọi ở chế độ thật không, và vì sao. */
export function realDispatchBan(file: string, source: string): string | null {
  if (NEVER_REAL_DISPATCH.includes(file)) {
    return `\`${file}\` nằm trong danh sách cấm gọi thật (\`NEVER_REAL_DISPATCH\`): một lần merge không hoàn tác được bằng lần chạy khác.`;
  }
  if (MERGE_PATTERNS.some((re) => re.test(source))) {
    return `\`${file}\` có lệnh merge pull request: một lần merge không hoàn tác được bằng lần chạy khác.`;
  }
  return null;
}

// ── Kế hoạch chạy thử ────────────────────────────────────────────────────

export interface WorkflowSource {
  /** Tên file, không kèm thư mục — ví dụ `labels.yml`. */
  file: string;
  source: string;
}

export interface SmokeDispatch {
  file: string;
  /** Gọi kèm `-f dry_run=true` hay gọi thường. */
  dryRun: boolean;
}

export interface SmokeSkip {
  file: string;
  why: string;
}

export interface SmokePlan {
  /** Workflow sẽ được gọi, theo thứ tự gọi. */
  dispatch: SmokeDispatch[];
  /** Không có `workflow_dispatch` nên không tự thử được — phải liệt kê cho người biết. */
  notDispatchable: SmokeSkip[];
  /** Có `workflow_dispatch` nhưng bị cấm gọi thật vì thiếu `dry_run`. */
  refused: SmokeSkip[];
}

/**
 * Tên file của chính workflow chạy thử. Nó phải tự loại mình ra khỏi kế
 * hoạch, và lý do là một chỗ kẹt thật chứ không phải sự gọn gàng:
 * `smoke-workflows.yml` khai `concurrency: smoke-workflows` để hai lần chạy
 * thử không giẫm chân nhau. Nếu nó tự gọi mình rồi `gh run watch` chờ, lần
 * chạy mới sẽ nằm trong hàng đợi của CHÍNH nhóm mà lần chạy đang chờ đang
 * giữ — hai bên chờ nhau tới khi hết giờ.
 */
export const SELF_FILE = 'smoke-workflows.yml';

/**
 * Quyết định gọi workflow nào, ở chế độ nào.
 *
 * Bốn nhánh, theo đúng thứ tự xét:
 *
 * 1. Không có `workflow_dispatch` → `notDispatchable`. Không im lặng: tiêu
 *    chí xong của `P-010` đòi liệt kê những file này ra cho người biết, vì
 *    chúng là phần **không** được cơ chế này phủ.
 * 2. Có `inputs.dry_run` → gọi kèm `-f dry_run=true`. Đây là đường mong muốn.
 * 3. Không có `dry_run` mà bị `realDispatchBan` chặn → `refused`. Đây là
 *    hàng rào cứng của tiêu chí "chạy thử KHÔNG được đụng tới `automerge` ở
 *    chế độ thật trong bất kỳ hoàn cảnh nào".
 * 4. Không có `dry_run`, không bị cấm → gọi thường. `pnpm lint:workflows`
 *    đã cảnh báo về trường hợp này ở chỗ rẻ hơn (luật `dry-run`), nên tới
 *    đây là một lựa chọn có ý thức, không phải một chỗ sót.
 *
 * Trước cả bốn nhánh: chính `smoke-workflows.yml` bị loại — xem `SELF_FILE`.
 */
export function planSmokeRuns(entries: readonly WorkflowSource[]): SmokePlan {
  const plan: SmokePlan = { dispatch: [], notDispatchable: [], refused: [] };

  for (const entry of entries) {
    if (entry.file === SELF_FILE) {
      plan.notDispatchable.push({
        file: entry.file,
        why: 'là chính workflow chạy thử, và nó đang chạy — tự gọi mình sẽ kẹt ở `concurrency` của chính nó. Lần chạy đang đọc dòng này CHÍNH LÀ phép thử của nó.',
      });
      continue;
    }

    if (!hasWorkflowDispatch(entry.source)) {
      plan.notDispatchable.push({
        file: entry.file,
        why: 'không khai `workflow_dispatch` nên không gọi tay được. Thêm `workflow_dispatch` vào khối `on:` thì lần đổi sau sẽ tự thử được.',
      });
      continue;
    }

    if (hasDryRunInput(entry.source)) {
      plan.dispatch.push({ file: entry.file, dryRun: true });
      continue;
    }

    const ban = realDispatchBan(entry.file, entry.source);
    if (ban !== null) {
      plan.refused.push({
        file: entry.file,
        why: `${ban} Mà nó không khai \`inputs.dry_run\`, nên không có chế độ nào an toàn để gọi. KHÔNG gọi.`,
      });
      continue;
    }

    plan.dispatch.push({ file: entry.file, dryRun: false });
  }

  return plan;
}

// ── Thân issue cảnh báo ──────────────────────────────────────────────────

export interface SmokeResult {
  file: string;
  dryRun: boolean;
  /** `success`, `failure`, `cancelled`, `timed_out`… như GitHub trả về. */
  conclusion: string;
  runUrl: string;
  /** Dòng lỗi đầu tiên đọc được từ log, hoặc chuỗi rỗng nếu không lấy được. */
  firstError: string;
}

export function isRed(conclusion: string): boolean {
  return conclusion !== 'success' && conclusion !== 'skipped';
}

/**
 * MỘT issue cho cả lần push, không phải một issue mỗi workflow (tiêu chí
 * xong của `P-010`). Lý do: một lần sync hỏng thường làm nhiều workflow đỏ
 * cùng lúc, và mỗi issue là một lần gọi chủ dự án (CHARTER 2.4).
 *
 * @nhắc nằm NGAY TRONG thân issue, không chờ `notify.yml` — issue này do
 * `GITHUB_TOKEN` mở, mà GitHub không kích hoạt workflow từ sự kiện do
 * `GITHUB_TOKEN` tạo ra, nên `notify.yml` sẽ không bao giờ chạy cho nó (KF-004).
 */
export function alertIssueBody(options: {
  sha: string;
  runUrl: string;
  owner: string;
  results: readonly SmokeResult[];
  notDispatchable: readonly SmokeSkip[];
  refused: readonly SmokeSkip[];
}): string {
  const red = options.results.filter((r) => isRed(r.conclusion));
  const lines: string[] = [
    `@${options.owner} workflow vừa merge vào \`main\` chạy thử KHÔNG xanh.`,
    '',
    `Commit: \`${options.sha}\` · lần chạy thử: ${options.runUrl}`,
    '',
    `## Đỏ: ${red.length} workflow`,
    '',
  ];

  for (const r of red) {
    lines.push(
      `- \`${r.file}\` — \`${r.conclusion}\`${r.dryRun ? ' (chế độ chạy thử)' : ' (chế độ thật)'} · ${r.runUrl}`,
    );
    lines.push(`  - dòng lỗi đầu tiên: ${r.firstError === '' ? '_không đọc được log_' : `\`${r.firstError}\``}`);
  }

  if (options.refused.length > 0) {
    lines.push('', '## Không gọi, vì không có chế độ an toàn', '');
    for (const s of options.refused) lines.push(`- \`${s.file}\` — ${s.why}`);
  }

  if (options.notDispatchable.length > 0) {
    lines.push('', '## Không tự thử được', '');
    for (const s of options.notDispatchable) lines.push(`- \`${s.file}\` — ${s.why}`);
  }

  lines.push(
    '',
    'Workflow trong `ops/workflows/` chỉ có hiệu lực sau khi merge vào `main` và `sync-workflows` chép sang `.github/workflows/` (KF-003, giả định G10).',
    'Một workflow đỏ ở đây nghĩa là bản đang có hiệu lực trên `main` đang hỏng, không phải bản trên một nhánh nào đó.',
  );

  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/scripts/smoke-workflows.ts plan  <thư-mục-workflow> <file-danh-sách>
//   node ops/scripts/smoke-workflows.ts alert <plan.json> <results.json> <sha> <runUrl> <owner>
//
// `<file-danh-sách>` là đầu ra của `git diff --name-only`, đường dẫn tính từ
// gốc repo. Chỉ những dòng dưới `ops/workflows/` và có đuôi `.yml`/`.yaml`
// mới được xét; `README.md` trong cùng thư mục vì thế bị bỏ qua.
//
// `plan` in ra JSON của `SmokePlan`; `alert` in ra thân issue cảnh báo.
// Hai lệnh, không phải một `node -e` trong YAML: bash trong workflow là
// đúng thứ không kiểm được ở đây, nên càng ít logic nằm trong đó càng tốt.

/** Lọc danh sách `git diff --name-only` xuống các workflow thật sự vừa đổi. */
export function changedWorkflowFiles(changed: readonly string[]): string[] {
  const names = changed
    .map((line) => line.trim())
    .filter((line) => /^ops\/workflows\/[^/]+\.(yml|yaml)$/.test(line))
    .map((line) => line.slice('ops/workflows/'.length));
  return [...new Set(names)].sort();
}

const isMain = process.argv[1]?.endsWith('smoke-workflows.ts') === true;

const USAGE =
  'Dùng:\n' +
  '  node ops/scripts/smoke-workflows.ts plan  <thư-mục-workflow> <file-danh-sách-đã-đổi>\n' +
  '  node ops/scripts/smoke-workflows.ts alert <plan.json> <results.json> <sha> <runUrl> <owner>\n';

if (isMain && process.argv[2] === 'alert') {
  const [planPath, resultsPath, sha, runUrl, owner] = process.argv.slice(3);
  if (
    planPath === undefined ||
    resultsPath === undefined ||
    sha === undefined ||
    runUrl === undefined ||
    owner === undefined
  ) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as SmokePlan;
  const results = JSON.parse(readFileSync(resultsPath, 'utf8')) as SmokeResult[];
  process.stdout.write(
    alertIssueBody({
      sha,
      runUrl,
      owner,
      results,
      notDispatchable: plan.notDispatchable,
      refused: plan.refused,
    }),
  );
} else if (isMain) {
  const [command, dir, changedPath] = process.argv.slice(2);
  if (command !== 'plan' || dir === undefined || changedPath === undefined) {
    process.stderr.write(USAGE);
    process.exit(2);
  }

  const present = new Set(readdirSync(dir));
  const entries: WorkflowSource[] = [];
  const gone: string[] = [];

  for (const file of changedWorkflowFiles(readFileSync(changedPath, 'utf8').split('\n'))) {
    // Workflow bị XOÁ trong chính lần push đó vẫn nằm trong `git diff`, mà
    // gọi nó thì chỉ nhận 404. Tách ra thay vì để lệnh gọi đỏ vì lý do sai.
    if (!present.has(file)) {
      gone.push(file);
      continue;
    }
    entries.push({ file, source: readFileSync(join(dir, file), 'utf8') });
  }

  const plan = planSmokeRuns(entries);
  for (const file of gone) {
    plan.notDispatchable.push({ file, why: 'đã bị xoá trong chính lần push này — không còn gì để chạy thử.' });
  }
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}
