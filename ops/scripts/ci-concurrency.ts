#!/usr/bin/env node
/**
 * Mục `platform/P-047` · `ops/known-failures.md` **KF-031**.
 *
 * ## Chỗ hỏng, đo bằng chạy thật
 *
 * `ops/workflows/ci.yml` từng khai:
 *
 * ```yaml
 * concurrency:
 *   group: ci-${{ github.event.pull_request.number || github.ref }}
 *   cancel-in-progress: true
 * ```
 *
 * Nhóm khoá theo **số PR**, nên hai lượt của CÙNG một `head.sha` nằm chung
 * nhóm và lượt sau **huỷ** lượt trước. Đường đi thường gặp nhất không phải
 * hai lần push, mà là chính nhịp làm việc của worker:
 *
 * 1. worker mở PR → sự kiện `opened` → lượt CI #1 chạy;
 * 2. vài chục giây sau, worker gắn nhãn cửa merge bằng danh tính riêng (KHÔNG
 *    phải `GITHUB_TOKEN`, nên GitHub CÓ kích hoạt lại) → `ci.yml` đăng ký
 *    `labeled` trong `types` (mục `P-009`) → lượt CI #2 trên **đúng cùng một
 *    commit**;
 * 3. huỷ lượt #1 để lại trên `head.sha` đang sống một loạt check run
 *    `conclusion: cancelled` **mang đúng tên các check mà ruleset
 *    `protect-main` đòi**.
 *
 * Ruleset đọc chúng thành *"chưa báo cáo"*, PR đứng `mergeable_state: blocked`
 * vĩnh viễn — GitHub không sinh lượt mới cho một `sha` đã có lượt — và
 * `automerge.yml` trả `HTTP 405` khi thử merge. Không gì đỏ ở chỗ ai nhìn:
 * lượt CI mới nhất xanh đủ 8/8 job, `pnpm check` xanh, `main` xanh. Nhóm **Z**.
 *
 * ## Luật file này thực thi
 *
 * Một workflow chạy trên `pull_request` và sinh ra ít nhất một tên trong
 * `REQUIRED_CHECKS` thì **không được khai khối `concurrency` nào cả**.
 *
 * Luật cấm cả khối, không chỉ cấm `cancel-in-progress: true`. Hai lý do, cả
 * hai đều do vòng soát ngữ cảnh sạch của chính mục này đo được:
 *
 * - **`cancel-in-progress: false` KHÔNG bỏ hẳn đường huỷ.** Ngữ nghĩa
 *   `concurrency` của GitHub: khi một lượt vào một nhóm đang có lượt chạy, nó
 *   nằm **pending**; và *"any previously pending job or workflow in the
 *   concurrency group will be cancelled"*. `cancel-in-progress` chỉ chi phối
 *   lượt **đang chạy**, không chi phối lượt **đang xếp hàng**. `ci.yml` đăng
 *   ký năm loại sự kiện (`opened`, `synchronize`, `reopened`, `labeled`,
 *   `unlabeled`), nên ba sự kiện trên cùng một commit là chuyện thường —
 *   và lượt thứ hai bị huỷ khi lượt thứ ba tới, đúng chữ ký `KF-031`.
 * - **Một luật cấm một GIÁ TRỊ thì phải đọc đúng giá trị đó, và bản đầu của
 *   mục này đọc sai bốn dạng** — `{group: x, cancel-in-progress: true}` (flow
 *   mapping), `${{ true }}` (biểu thức, đúng dạng GitHub tài liệu hoá), `True`
 *   (viết hoa), và giá trị nằm ở dòng sau. Cả bốn đều bật huỷ thật mà
 *   `pnpm lint:workflows` vẫn `EXIT=0`. Một luật cấm cả **khối** không có
 *   mặt đó để đọc sai: nó chỉ hỏi khoá `concurrency:` có xuất hiện không.
 *
 * Giá phải trả: lượt CI của một commit đã bị commit sau vượt qua sẽ chạy hết
 * thay vì bị huỷ. Đó là ngân sách runner đổi lấy việc bỏ hẳn một lớp lỗi đã
 * tốn của chủ dự án một lần merge tay và hơn một giờ hàng đợi tắc.
 *
 * Luật **không** áp cho workflow khác: `gpt-review.yml` vẫn được
 * `cancel-in-progress: true` (lượt bị huỷ của nó để lại check run tên
 * `gpt-review`, mà ruleset không đòi tên đó), và `main-ci.yml` cũng có một
 * job tên `check` nhưng chạy trên `push`/`schedule` chứ không trên
 * `pull_request`, nên check run của nó gắn vào SHA trên `main` chứ không vào
 * `head.sha` của PR nào.
 */

import { readFileSync } from 'node:fs';

import { REQUIRED_CHECKS, ciJobNames } from './required-checks.ts';

/** Một khối `concurrency:` đọc được từ nguồn YAML. */
export interface ConcurrencyBlock {
  /** Dòng của chính khoá `concurrency:` (1-based), để lời báo lỗi trỏ đúng chỗ. */
  line: number;
  /** Giá trị `group:`; `null` khi không đọc được. */
  group: string | null;
  /**
   * `false` chỉ khi khối **chứng minh được** là không huỷ: khoá vắng mặt, hoặc
   * giá trị đúng là `false` viết thường/hoa/có nháy. Mọi thứ khác — kể cả một
   * biểu thức `${{ … }}` không tính được lúc lint — ra `true`.
   *
   * Hướng an toàn ngược với bản đầu của mục này, và đó là chủ đích: bản đầu
   * coi "không đọc được" là "không bật", nên bốn dạng viết hợp lệ đi lọt.
   */
  cancelInProgress: boolean;
}

/** Bỏ nháy bao quanh nếu có; ngoài nháy thì cắt chú thích `#` phía sau. */
function unquote(value: string): string {
  const quoted = /^(['"])(.*?)\1/.exec(value);
  return quoted !== null ? quoted[2]! : value.replace(/\s+#.*$/, '').trim();
}

/** `false` chỉ khi giá trị chứng minh được là tắt. Xem `cancelInProgress`. */
function cancelsFromValue(raw: string): boolean {
  return unquote(raw).toLowerCase() !== 'false';
}

/**
 * Đọc mọi khối `concurrency:` của một workflow — cả mức workflow (thụt 0) lẫn
 * mức job (thụt 4). Đọc cả hai chứ không chỉ mức workflow: một khối mức job
 * huỷ đúng cái job sinh ra check bắt buộc thì hậu quả y hệt, và một luật chỉ
 * soát nửa trên là một luật mời người ta đi vòng qua nửa dưới.
 *
 * Phần **phát hiện có khối hay không** là phần luật dựa vào, và nó chỉ cần
 * tìm khoá `concurrency:` — không phụ thuộc vào việc đọc đúng giá trị bên
 * trong. Phần đọc giá trị chỉ để lời báo lỗi nói rõ hơn.
 */
export function concurrencyBlocks(source: string): ConcurrencyBlock[] {
  const lines = source.split('\n');
  const blocks: ConcurrencyBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const match = /^(\s*)concurrency:\s*(.*)$/.exec(raw);
    if (match === null) continue;

    const indent = match[1]!.length;
    const inline = match[2]!.trim();

    // Flow mapping một dòng: `concurrency: {group: x, cancel-in-progress: true}`.
    const flow = /^\{(.*)\}\s*(#.*)?$/.exec(inline);
    if (flow !== null) {
      const body = flow[1]!;
      const group = /(?:^|,)\s*group\s*:\s*([^,]+)/.exec(body);
      const cancel = /(?:^|,)\s*cancel-in-progress\s*:\s*([^,]+)/.exec(body);
      blocks.push({
        line: i + 1,
        group: group !== null ? unquote(group[1]!.trim()) : null,
        cancelInProgress: cancel !== null && cancelsFromValue(cancel[1]!.trim()),
      });
      continue;
    }

    // Dạng rút gọn `concurrency: <chuỗi>` — chỉ có nhóm, `cancel-in-progress`
    // lấy mặc định `false` của GitHub.
    if (inline !== '' && !inline.startsWith('#')) {
      blocks.push({ line: i + 1, group: unquote(inline), cancelInProgress: false });
      continue;
    }

    const block: ConcurrencyBlock = { line: i + 1, group: null, cancelInProgress: false };
    let pendingCancelKey = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const child = lines[j]!;
      if (child.trim() === '' || child.trimStart().startsWith('#')) continue;
      const childIndent = child.length - child.trimStart().length;
      if (childIndent <= indent) break;

      // Giá trị của `cancel-in-progress:` nằm ở DÒNG SAU (YAML cho phép).
      if (pendingCancelKey) {
        block.cancelInProgress = cancelsFromValue(child.trim());
        pendingCancelKey = false;
        continue;
      }

      const group = /^\s*group:\s*(.+?)\s*$/.exec(child);
      if (group !== null) block.group = unquote(group[1]!);

      const cancel = /^\s*cancel-in-progress:\s*(.*?)\s*$/.exec(child);
      if (cancel !== null) {
        const value = cancel[1]!;
        if (value === '') pendingCancelKey = true;
        else block.cancelInProgress = cancelsFromValue(value);
      }
    }
    blocks.push(block);
  }

  return blocks;
}

/**
 * Có đăng ký sự kiện `pull_request` (hoặc `pull_request_target`) không —
 * tức check run của nó có gắn vào `head.sha` của một PR không.
 *
 * Chỉ nhận khoá thụt đúng 2 dấu cách dưới `on:`, để không nhầm với một chữ
 * `pull_request` nằm trong chú thích hay trong một khối `run:`.
 */
export function hasPullRequestTrigger(source: string): boolean {
  let inOn = false;
  for (const line of source.split('\n')) {
    if (/^on:/.test(line)) {
      inOn = true;
      continue;
    }
    if (inOn && /^\S/.test(line)) inOn = false;
    if (inOn && /^ {2}pull_request(_target)?:/.test(line)) return true;
  }
  return false;
}

/** Tên check bắt buộc mà workflow này sinh ra TRÊN một PR. Rỗng nghĩa là luật không áp. */
export function requiredChecksOnPr(source: string): string[] {
  if (!hasPullRequestTrigger(source)) return [];
  const produced = new Set(ciJobNames(source));
  return REQUIRED_CHECKS.filter((check) => produced.has(check));
}

/** Lời báo lỗi cho một workflow, hoặc mảng rỗng nếu lành. */
export function concurrencyProblems(source: string): string[] {
  const required = requiredChecksOnPr(source);
  if (required.length === 0) return [];

  return concurrencyBlocks(source).map(
    (block) =>
      `dòng ${block.line}: khối \`concurrency\` trong một workflow chạy trên \`pull_request\` và sinh ra ` +
      `check BẮT BUỘC (${required.join(', ')}). Một lượt bị huỷ — dù bởi \`cancel-in-progress\` hay bởi ` +
      'luật "lượt đang xếp hàng bị huỷ khi lượt sau tới" — để lại check run `cancelled` mang đúng những ' +
      'tên đó trên `head.sha` đang sống, ruleset `protect-main` đọc thành "chưa báo cáo", và PR kẹt ' +
      '`blocked` vĩnh viễn trong khi lượt CI mới nhất vẫn xanh (KF-031, nhóm Z).\n' +
      '      Xử lý: BỎ HẲN khối `concurrency` khỏi workflow này. `cancel-in-progress: false` không đủ — ' +
      'nó chỉ chi phối lượt đang chạy, không chi phối lượt đang xếp hàng.',
  );
}

// ── Bộ dò: PR nào ĐANG kẹt theo đúng chữ ký này ──────────────────────────
//
// Luật trên chặn lần sau. Nó KHÔNG gỡ được một PR đã dính: check run
// `cancelled` nằm sẵn trên `head.sha` đó, và GitHub không sinh lượt mới cho
// một `sha` đã có lượt — chỉ một commit mới mới gỡ được. Nên phải có đường
// NHÌN THẤY các PR đang dính, nếu không chúng lại nằm im đúng như #224 đã nằm
// im 15 giờ với mọi chỉ báo xanh.

/** Kết luận của một check run, rút gọn về đúng phần bộ dò cần. */
export interface CheckRunSummary {
  name: string;
  /** `null` khi lượt chưa xong — chưa xong KHÔNG phải một phán quyết. */
  conclusion: string | null;
}

/**
 * Kết luận **không mang phán quyết**: ruleset không đọc chúng thành "đã qua",
 * nhưng chúng cũng không đỏ ở đâu cho ai thấy.
 *
 * `failure` cố ý KHÔNG nằm ở đây: một check đỏ thật thì PR đỏ thật, ai nhìn
 * cũng thấy, và `pickPrToHandle` đã có lý do `ci-red` cho nó. Chữ ký của
 * `KF-031` là *xanh mà kẹt*, không phải *đỏ*.
 *
 * `skipped` cũng KHÔNG nằm ở đây, và đây là chỗ vòng soát ngữ cảnh sạch sửa
 * bản đầu: GitHub coi một required check `skipped` là **đã qua**. Hai job
 * `fix-has-test` và `protected-area` mang `if: github.event_name ==
 * 'pull_request'` nên ra `skipped` ở mọi lượt `workflow_dispatch` — để
 * `skipped` trong danh sách là chuốc dương tính giả cho một bộ dò mà cả giá
 * trị lẫn lý do tồn tại đều nằm ở chỗ nó không kêu oan.
 */
export const NON_VERDICT_CONCLUSIONS: readonly string[] = ['cancelled', 'stale', 'timed_out'];

/** Một tên check bắt buộc đang bị một kết luận không-phán-quyết giữ lại. */
export interface BlockedCheck {
  name: string;
  /** Các kết luận không-phán-quyết đo được cho tên này, theo thứ tự gặp. */
  conclusions: string[];
  /**
   * `true` khi cùng tên đó CŨNG có một lượt `success` trên cùng `head.sha` —
   * tức PR trông xanh đủ mọi chỗ mà vẫn kẹt. Đây là ca nhóm **Z** thuần và là
   * ca `#224`/`#226` đã gặp thật.
   */
  silent: boolean;
}

/**
 * Các check bắt buộc đang giữ một PR lại, đọc từ check run trên **đúng
 * `head.sha` hiện tại** của PR đó. Mảng rỗng là lành.
 *
 * Không tự gọi GitHub: bên gọi đưa dữ liệu vào. Nhờ vậy hàm này kiểm được
 * bằng dữ liệu đo thật mà không cần mạng, và bài kiểm không phụ thuộc trạng
 * thái hôm nay của repo.
 */
export function blockedRequiredChecks(runs: readonly CheckRunSummary[]): BlockedCheck[] {
  const blocked: BlockedCheck[] = [];

  for (const name of REQUIRED_CHECKS) {
    const forName = runs.filter((run) => run.name === name);
    const conclusions = forName
      .map((run) => run.conclusion)
      .filter((c): c is string => c !== null && NON_VERDICT_CONCLUSIONS.includes(c));
    if (conclusions.length === 0) continue;
    blocked.push({
      name,
      conclusions,
      silent: forName.some((run) => run.conclusion === 'success'),
    });
  }

  return blocked;
}

/**
 * Bóc mảng check run ra khỏi hai hình dạng JSON đang có thật: mảng trần, và
 * `{"check_runs": [...]}` — đúng thứ `pull_request_read` phương thức
 * `get_check_runs` trả về, tức đúng thứ dòng hướng dẫn của CLI bảo đi lấy.
 * Bản đầu chỉ nhận mảng trần và vỡ bằng stack trace thô với dạng kia; vòng
 * soát ngữ cảnh sạch đo được điều đó.
 */
export function parseCheckRuns(text: string): CheckRunSummary[] {
  const parsed: unknown = JSON.parse(text);
  const runs = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { check_runs?: unknown }).check_runs)
      ? (parsed as { check_runs: unknown[] }).check_runs
      : null;
  if (runs === null) {
    throw new Error('JSON phải là một mảng check run, hoặc một object có khoá `check_runs` là mảng.');
  }
  return runs as CheckRunSummary[];
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// Tách sau `isMain` cùng lý do `check-workflows.ts` đã tách: bài kiểm import
// được các hàm trên mà không bị `process.exit` giết giữa chừng.
const isMain = process.argv[1]?.endsWith('ci-concurrency.ts') === true;

if (isMain) {
  const file = process.argv[2];
  if (file === undefined) {
    process.stderr.write(
      'Dùng: node ops/scripts/ci-concurrency.ts <file.json>\n' +
        '  file.json = check run của MỘT head sha — mảng trần, hoặc nguyên object\n' +
        '  `{"check_runs": […]}` mà `pull_request_read` phương thức `get_check_runs` trả về.\n',
    );
    process.exit(2);
  }

  let runs: CheckRunSummary[];
  try {
    runs = parseCheckRuns(readFileSync(file, 'utf8'));
  } catch (error) {
    // Bọc để in một câu đọc được thay vì stack Node thô — công cụ chẩn đoán
    // mà vỡ khó hiểu thì lượt sau không dùng nó nữa.
    process.stderr.write(`Không đọc được \`${file}\`: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  const blocked = blockedRequiredChecks(runs);

  if (blocked.length === 0) {
    process.stdout.write('Không check bắt buộc nào bị kết luận không-phán-quyết giữ lại.\n');
  } else {
    process.stdout.write(`${JSON.stringify({ blocked }, null, 2)}\n`);
    process.stderr.write(
      `${blocked.length} check bắt buộc đang giữ PR này lại (KF-031)` +
        `${blocked.some((b) => b.silent) ? ' — và ít nhất một cái CÓ lượt `success` cùng tên, tức PR trông xanh mà vẫn kẹt' : ''}.\n` +
        'Chỉ một commit mới mới gỡ được: GitHub không sinh lượt mới cho một sha đã có lượt.\n',
    );
    process.exit(1);
  }
}
