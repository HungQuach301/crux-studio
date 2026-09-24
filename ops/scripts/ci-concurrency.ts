#!/usr/bin/env node
/**
 * Mục `platform/P-047` · `ops/known-failures.md` **KF-031**.
 *
 * ## Chỗ hỏng, đo bằng chạy thật
 *
 * `ops/workflows/ci.yml` khai:
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
 * 3. `cancel-in-progress: true` huỷ lượt #1 — và để lại trên `head.sha` đang
 *    sống một loạt check run `conclusion: cancelled` **mang đúng tên các check
 *    mà ruleset `protect-main` đòi**.
 *
 * Ruleset đọc chúng thành *"chưa báo cáo"*, PR đứng `mergeable_state: blocked`
 * vĩnh viễn — GitHub không sinh lượt mới cho một `sha` đã có lượt — và
 * `automerge.yml` trả `HTTP 405` khi thử merge. Không gì đỏ ở chỗ ai nhìn:
 * lượt CI mới nhất xanh đủ 8/8 job, `pnpm check` xanh, `main` xanh. Nhóm **Z**.
 *
 * ## Luật file này thực thi
 *
 * Một workflow sinh ra ít nhất một tên trong `REQUIRED_CHECKS` thì **không
 * được** `cancel-in-progress: true`.
 *
 * Đó là vế **đúng/sai**, không phải vế nhanh/chậm: không huỷ lượt nào thì
 * không có check run `cancelled` nào để ruleset đọc nhầm, bất kể nhóm khoá
 * theo gì. Nhóm khoá theo `head.sha` là chuyện **chi phí** — nó giữ cho hai
 * commit khác nhau chạy song song thay vì xếp hàng — nên nó nằm ở `ci.yml`
 * kèm lời giải thích, KHÔNG nằm trong luật này. Trộn hai vế vào một luật là
 * cách lượt sau nới nhầm vế đúng/sai vì tưởng mình đang chỉnh vế chi phí.
 *
 * ⚠️ Vì sao không phải `group` mang `head.sha` + `cancel-in-progress: true`:
 * nhóm mang `sha` thì hai lượt trên cùng commit **vẫn chung nhóm**, nên
 * `cancel-in-progress: true` vẫn huỷ đúng lượt ấy — cùng một lỗi, chỉ đổi chỗ
 * đứng. Đo được một lần rồi thì viết ra đây, để lượt sau không phải đo lại.
 */

import { readFileSync } from 'node:fs';

import { REQUIRED_CHECKS, ciJobNames } from './required-checks.ts';

/** Một khối `concurrency:` đọc được từ nguồn YAML. */
export interface ConcurrencyBlock {
  /** Dòng của chính khoá `concurrency:` (1-based), để lời báo lỗi trỏ đúng chỗ. */
  line: number;
  /** Giá trị `group:`; `null` khi khối dùng dạng rút gọn `concurrency: <chuỗi>`. */
  group: string | null;
  /** `true` chỉ khi khối khai tường minh `cancel-in-progress: true`. Mặc định của GitHub là `false`. */
  cancelInProgress: boolean;
}

/**
 * Đọc mọi khối `concurrency:` của một workflow — cả mức workflow (thụt 0) lẫn
 * mức job (thụt 4). Đọc cả hai chứ không chỉ mức workflow: một khối mức job
 * huỷ đúng cái job sinh ra check bắt buộc thì hậu quả y hệt, và một luật chỉ
 * soát nửa trên là một luật mời người ta đi vòng qua nửa dưới.
 *
 * Parser hẹp có chủ đích, cùng lý do `ciJobNames` đã khai: nó đọc đúng hình
 * dạng mà `ops/workflows/**` đang dùng (khoá con thụt thêm 2 dấu cách, giá trị
 * nằm cùng dòng). Hình dạng hợp lệ mà nó không đọc được sẽ làm `group` ra
 * `null` hoặc `cancelInProgress` ra `false` — tức nghiêng về **không báo lỗi**.
 * Hướng đó an toàn ở đây vì luật này chỉ cấm một giá trị *tường minh*
 * (`cancel-in-progress: true`); muốn bật nó thì phải viết ra, và viết ra thì
 * parser đọc được.
 */
export function concurrencyBlocks(source: string): ConcurrencyBlock[] {
  const lines = source.split('\n');
  const blocks: ConcurrencyBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const match = /^(\s*)concurrency:\s*(.*)$/.exec(raw);
    if (match === null) continue;

    const indent = match[1]!.length;
    const inline = match[2]!.replace(/\s+#.*$/, '').trim();

    // Dạng rút gọn `concurrency: <chuỗi>` — chỉ có nhóm, `cancel-in-progress`
    // lấy mặc định `false` của GitHub, nên nó không bao giờ vi phạm luật này.
    if (inline !== '') {
      blocks.push({ line: i + 1, group: unquote(inline), cancelInProgress: false });
      continue;
    }

    const block: ConcurrencyBlock = { line: i + 1, group: null, cancelInProgress: false };
    for (let j = i + 1; j < lines.length; j += 1) {
      const child = lines[j]!;
      if (child.trim() === '' || child.trimStart().startsWith('#')) continue;
      const childIndent = child.length - child.trimStart().length;
      if (childIndent <= indent) break;

      const group = /^\s*group:\s*(.+?)\s*$/.exec(child);
      if (group !== null) block.group = unquote(group[1]!);

      const cancel = /^\s*cancel-in-progress:\s*(.+?)\s*$/.exec(child);
      if (cancel !== null) block.cancelInProgress = unquote(cancel[1]!) === 'true';
    }
    blocks.push(block);
  }

  return blocks;
}

/** Bỏ nháy bao quanh nếu có; ngoài nháy thì cắt chú thích `#` phía sau. */
function unquote(value: string): string {
  const quoted = /^(['"])(.*?)\1/.exec(value);
  return quoted !== null ? quoted[2]! : value.replace(/\s+#.*$/, '').trim();
}

/**
 * Lời báo lỗi cho một workflow, hoặc mảng rỗng nếu lành.
 *
 * Chỉ soát workflow **sinh ra check bắt buộc**. `gpt-review.yml` cũng đang
 * `cancel-in-progress: true` và điều đó vẫn đúng: lượt bị huỷ của nó để lại
 * check run tên `gpt-review`, mà ruleset không đòi tên đó, nên không khoá gì.
 * Cấm luôn cả nó là đổi một luật có lý do lấy một luật rộng hơn lý do của nó.
 */
export function concurrencyProblems(source: string): string[] {
  const produced = new Set(ciJobNames(source));
  const required = REQUIRED_CHECKS.filter((check) => produced.has(check));
  if (required.length === 0) return [];

  return concurrencyBlocks(source)
    .filter((block) => block.cancelInProgress)
    .map(
      (block) =>
        `dòng ${block.line}: \`cancel-in-progress: true\` trong một workflow sinh ra check BẮT BUỘC ` +
        `(${required.join(', ')}). Một lượt bị huỷ để lại check run \`cancelled\` mang đúng những tên đó ` +
        'trên `head.sha` đang sống, ruleset `protect-main` đọc thành "chưa báo cáo", và PR kẹt ' +
        '`blocked` vĩnh viễn trong khi lượt CI mới nhất vẫn xanh (KF-031, nhóm Z).\n' +
        '      Xử lý: `cancel-in-progress: false`. Muốn hai commit khác nhau vẫn chạy song song thì ' +
        'cho `head.sha` vào `group:` — đó là chuyện chi phí, không thay được dòng trên.',
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
 */
export const NON_VERDICT_CONCLUSIONS: readonly string[] = ['cancelled', 'skipped', 'stale', 'timed_out'];

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
        '  file.json = mảng check run của MỘT head sha, dạng [{"name":"check","conclusion":"cancelled"}, …]\n' +
        '  (lấy bằng `pull_request_read` phương thức `get_check_runs`)\n',
    );
    process.exit(2);
  }

  const runs = JSON.parse(readFileSync(file, 'utf8')) as CheckRunSummary[];
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
