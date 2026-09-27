#!/usr/bin/env node
/**
 * Rà soát **Z2** (`ops/known-failures.md`, nhóm Z) — mục `platform/P-014`.
 *
 * ## Chỗ hỏng
 *
 * `if:` sai trên một bước hoặc một job làm nó ra `skipped`, và `skipped`
 * **không phải** `failure`: job vẫn `success`, check bắt buộc vẫn xanh. Nhìn
 * từ ngoài giống hệt đã kiểm và đã qua. Đã xảy ra thật một lần — `KF-008`,
 * mục `P-009`: bước kiểm của `fix-has-test` mang
 * `if: contains(github.event.pull_request.labels.*.name, 'fix')`, ảnh chụp
 * nhãn cũ làm điều kiện sai, bước bị bỏ qua, và bất biến I2 vế hai thủng
 * trên hai lượt CI xanh.
 *
 * `P-009` sửa **cơ chế** (bước kiểm luôn chạy và tự in kết luận). File này
 * là phần còn lại: một **luật** để lần sau không ai đưa hình dạng đó trở lại
 * mà không gì đỏ.
 *
 * ## Luật — chỉ áp cho job sinh CHECK BẮT BUỘC trên PR
 *
 * Tập job lấy từ `REQUIRED_CHECKS` (`required-checks.ts`), cùng một nguồn với
 * luật `P-047` (`ci-concurrency.ts`). Job không bắt buộc bị bỏ qua cũng không
 * làm PR nào qua cửa sai, nên luật không áp — áp rộng hơn chỉ tạo tiếng ồn.
 *
 * 1. **`if:` mức step** chỉ được mang hàm trạng thái: `always()`,
 *    `!cancelled()`, `failure()`, `cancelled()`. Bốn hàm đó không bao giờ bỏ
 *    qua một bước trong khi job đang xanh — `always()`/`!cancelled()` chạy
 *    NHIỀU hơn mặc định, còn `failure()`/`cancelled()` chỉ bỏ qua khi job
 *    vốn đã không xanh. Mọi điều kiện khác đều có thể sai trong khi job
 *    xanh, tức đúng hình dạng `KF-008`. Muốn rẽ nhánh thì làm như `P-009`:
 *    bước luôn chạy, đọc điều kiện trong `run:`, **in kết luận**, tự chọn
 *    thoát 0 hay 1.
 *
 * 2. **`if:` mức job** chỉ được đúng một dạng: cổng sự kiện
 *    `github.event_name == 'pull_request'`, và chỉ trong workflow có trigger
 *    `pull_request:`. Lý do nó an toàn là tính chất kiểm được chứ không phải
 *    châm chước: trên mọi lượt chạy do một PR kích hoạt, `event_name` là
 *    `pull_request`, nên cổng này **không bao giờ đúng-sai trên một PR** —
 *    nó chỉ bỏ qua job ở `workflow_dispatch`, nơi không có PR để kiểm. Một
 *    workflow nghe `pull_request_target` thì `event_name` lại là
 *    `pull_request_target`, và cùng cổng đó bỏ qua job trên MỌI PR — nên cổng
 *    chỉ được chấp nhận khi trigger `pull_request:` có thật trong file.
 *
 * ## Chỗ chưa che, khai ra thay vì giả vờ đã che
 *
 * Cổng sự kiện ở luật 2 vẫn sinh ra một check `skipped` **mang tên check
 * bắt buộc** mỗi khi ai đó chạy `ci.yml` bằng `workflow_dispatch` trên nhánh
 * của một PR — cùng SHA đầu nhánh. GitHub có lấy check `skipped` đó thay cho
 * check `failure` của lượt `pull_request` hay không thì **chưa đo** (cùng họ
 * với `KF-031`, nơi một check `cancelled` mang tên check bắt buộc làm PR kẹt).
 * Đo nó cần chạy thật một `workflow_dispatch` trên một PR đỏ; tới khi có số
 * đo, luật này giữ cổng đó là ngoại lệ **duy nhất** — thêm dạng thứ hai là
 * phải sửa file này và bài kiểm của nó.
 *
 * Bộ đọc YAML ở đây là bộ đọc theo dòng, cùng giả định với `ciJobNames`:
 * job thụt 2 dấu cách dưới `jobs:`, khoá của job thụt 4. Một job viết khác
 * khuôn đó thì `ciJobNames` cũng không thấy nó, và `pnpm test`
 * (`required-checks.test.ts`) đỏ trước — không có đường nào để một job bắt
 * buộc vô hình với luật này mà vẫn xanh ở đó.
 */

import { readFileSync } from 'node:fs';

import { REQUIRED_CHECKS } from './required-checks.ts';

/** Một `if:` đọc được từ nguồn YAML. */
export interface Condition {
  /** Dòng của khoá `if:` (1-based). */
  line: number;
  /** Biểu thức đã bỏ `${{ }}`, bỏ nháy bao ngoài và gộp khoảng trắng. */
  expression: string;
}

/** Một job đọc được, kèm mọi `if:` của nó. */
export interface JobConditions {
  /** Khoá của job dưới `jobs:`. */
  id: string;
  /** Tên check job sinh ra: `name:` nếu có, không thì `id` — như GitHub. */
  checkName: string;
  /** `if:` mức job, hoặc `null`. */
  jobIf: Condition | null;
  /** `if:` của từng bước. */
  stepIfs: Condition[];
}

/** Hàm trạng thái không bao giờ bỏ qua một bước khi job đang xanh. Xem luật 1. */
export const STATUS_ONLY_STEP_CONDITIONS: readonly string[] = [
  'always()',
  '!cancelled()',
  'failure()',
  'cancelled()',
];

/** Dạng DUY NHẤT được phép ở `if:` mức job của một job bắt buộc. Xem luật 2. */
export const PR_EVENT_GATE = "github.event_name == 'pull_request'";

/** Bỏ nháy bao ngoài (nếu có) và chú thích `#` đứng sau giá trị không nháy. */
function unquote(value: string): string {
  const quoted = /^(['"])(.*)\1\s*(#.*)?$/.exec(value);
  return quoted !== null ? quoted[2]! : value.replace(/\s+#.*$/, '').trim();
}

/**
 * Đưa một biểu thức về dạng so được: bỏ `${{ … }}`, gộp khoảng trắng, và
 * đổi nháy kép quanh chuỗi thành nháy đơn — `"pull_request"` và
 * `'pull_request'` là cùng một điều kiện.
 */
export function normalizeExpression(raw: string): string {
  let text = raw.trim();
  const wrapped = /^\$\{\{([\s\S]*)\}\}$/.exec(text);
  if (wrapped !== null) text = wrapped[1]!;
  return text.replace(/\s+/g, ' ').replace(/"([^"']*)"/g, "'$1'").trim();
}

/**
 * Đọc giá trị của một khoá `if:` bắt đầu ở dòng `index`, kể cả dạng khối
 * (`if: >-` rồi các dòng thụt sâu hơn) — `automerge.yml` và `notify.yml` đang
 * dùng dạng đó, nên bỏ qua nó là để một điều kiện nhiều dòng lọt luật.
 */
function readIfValue(lines: readonly string[], index: number, keyIndent: number, inline: string): string {
  const value = inline.trim();
  if (!/^[|>][+-]?\d*\s*(#.*)?$/.test(value)) return unquote(value);
  const parts: string[] = [];
  for (let j = index + 1; j < lines.length; j += 1) {
    const line = lines[j]!;
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= keyIndent) break;
    parts.push(line.trim());
  }
  return parts.join(' ');
}

/** Đọc mọi job dưới `jobs:` cùng các `if:` của chúng. */
export function jobConditions(source: string): JobConditions[] {
  const lines = source.split('\n');
  const jobs: JobConditions[] = [];

  let inJobs = false;
  let current: JobConditions | null = null;
  let hasName = false;
  let inSteps = false;
  let dashIndent = -1;

  const flush = (): void => {
    if (current !== null) jobs.push(current);
    current = null;
    hasName = false;
    inSteps = false;
    dashIndent = -1;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;

    // Một khoá ở cột 0 kết thúc khối `jobs:`.
    if (/^\S/.test(line)) {
      flush();
      inJobs = false;
      continue;
    }

    const job = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (job !== null) {
      flush();
      current = { id: job[1]!, checkName: job[1]!, jobIf: null, stepIfs: [] };
      continue;
    }
    if (current === null) continue;

    const indent = line.length - line.trimStart().length;

    // Khoá mức job (thụt 4) — cũng là chỗ khối `steps:` kết thúc.
    const jobKey = /^ {4}([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (jobKey !== null) {
      inSteps = jobKey[1] === 'steps';
      dashIndent = -1;
      if (jobKey[1] === 'name' && !hasName) {
        current.checkName = unquote(jobKey[2]!);
        hasName = true;
      }
      if (jobKey[1] === 'if') {
        current.jobIf = { line: i + 1, expression: normalizeExpression(readIfValue(lines, i, 4, jobKey[2]!)) };
      }
      continue;
    }

    if (!inSteps) continue;

    // Bước đầu tiên định ra độ thụt của dấu `-`; khoá của bước nằm trên cùng
    // dòng với `-` hoặc thụt đúng `dashIndent + 2`. So ĐÚNG độ thụt để một
    // chữ `if:` bên trong khối `run: |` (thụt sâu hơn) không bị đọc nhầm.
    const dash = /^(\s*)-\s+(.*)$/.exec(line);
    if (dash !== null && (dashIndent === -1 || dash[1]!.length === dashIndent)) {
      dashIndent = dash[1]!.length;
      const onDash = /^if:\s*(.*)$/.exec(dash[2]!);
      if (onDash !== null) {
        current.stepIfs.push({
          line: i + 1,
          expression: normalizeExpression(readIfValue(lines, i, dashIndent, onDash[1]!)),
        });
      }
      continue;
    }
    if (dashIndent !== -1 && indent === dashIndent + 2) {
      const stepIf = /^\s*if:\s*(.*)$/.exec(line);
      if (stepIf !== null) {
        current.stepIfs.push({
          line: i + 1,
          expression: normalizeExpression(readIfValue(lines, i, indent, stepIf[1]!)),
        });
      }
    }
  }
  flush();

  return jobs;
}

/** Workflow có trigger `pull_request:` thật (không tính `pull_request_target`). */
export function hasPlainPullRequestTrigger(source: string): boolean {
  let inOn = false;
  for (const line of source.split('\n')) {
    if (/^on:/.test(line)) {
      inOn = true;
      if (/^on:\s*\[?[^#]*\bpull_request\b(?!_)/.test(line)) return true;
      continue;
    }
    if (inOn && /^\S/.test(line)) inOn = false;
    if (inOn && /^ {2}pull_request:/.test(line)) return true;
  }
  return false;
}

/** Workflow có nghe PR theo bất kỳ cách nào — tức luật có chỗ để áp. */
function listensToPullRequests(source: string): boolean {
  let inOn = false;
  for (const line of source.split('\n')) {
    if (/^on:/.test(line)) {
      inOn = true;
      if (/\bpull_request(_target)?\b/.test(line)) return true;
      continue;
    }
    if (inOn && /^\S/.test(line)) inOn = false;
    if (inOn && /^ {2}pull_request(_target)?:/.test(line)) return true;
  }
  return false;
}

/** Lời báo lỗi cho một workflow, hoặc mảng rỗng nếu lành. */
export function requiredCheckConditionProblems(source: string): string[] {
  if (!listensToPullRequests(source)) return [];
  const required = new Set(REQUIRED_CHECKS);
  const plainPr = hasPlainPullRequestTrigger(source);
  const problems: string[] = [];

  for (const job of jobConditions(source)) {
    if (!required.has(job.checkName)) continue;

    if (job.jobIf !== null && !(plainPr && job.jobIf.expression === PR_EVENT_GATE)) {
      problems.push(
        `dòng ${job.jobIf.line}: job \`${job.id}\` sinh check BẮT BUỘC \`${job.checkName}\` mà có ` +
          `\`if: ${job.jobIf.expression}\` mức job (Z2). Job bị bỏ qua ra \`skipped\`, và check bắt buộc ` +
          `\`skipped\` KHÔNG đỏ. Dạng duy nhất được phép là \`if: ${PR_EVENT_GATE}\` trong workflow có ` +
          'trigger `pull_request:` — xem `ops/scripts/ci-conditionals.ts`.',
      );
    }

    for (const step of job.stepIfs) {
      if (STATUS_ONLY_STEP_CONDITIONS.includes(step.expression)) continue;
      problems.push(
        `dòng ${step.line}: một bước của job bắt buộc \`${job.checkName}\` có \`if: ${step.expression}\` (Z2). ` +
          'Điều kiện sai thì bước ra `skipped` trong khi job vẫn xanh — đúng hình dạng KF-008. ' +
          'Cho bước luôn chạy, đọc điều kiện trong `run:`, IN kết luận rồi tự thoát 0 hay 1 (như `P-009`). ' +
          `Chỉ hàm trạng thái được phép: ${STATUS_ONLY_STEP_CONDITIONS.join(', ')}.`,
      );
    }
  }

  return problems;
}

const isMain = process.argv[1]?.endsWith('ci-conditionals.ts') === true;

if (isMain) {
  const file = process.argv[2];
  if (file === undefined) {
    process.stderr.write('Cách dùng: node ops/scripts/ci-conditionals.ts <workflow.yml>\n');
    process.exit(2);
  }
  const problems = requiredCheckConditionProblems(readFileSync(file, 'utf8'));
  for (const problem of problems) process.stderr.write(`${file} — ${problem}\n`);
  process.exit(problems.length > 0 ? 1 : 0);
}
