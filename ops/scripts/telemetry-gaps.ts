#!/usr/bin/env node
/**
 * Mục `platform/P-059` — `KF-043`, **vế đo lại**. *Đầu nhánh
 * `claude/telemetry` có còn giữ đủ mọi bản ghi nhịp tim mà nhánh đã từng
 * giữ, hay không.*
 *
 * ## Chỗ hỏng mục này canh, và vì sao nó KHÁC vế đã sửa
 *
 * `KF-043` có hai vế, và `#281` chỉ sửa vế thứ nhất:
 *
 * - **Vế ghi (ĐÃ sửa).** Khối lệnh `--commands` của `telemetry-beat.ts` dựng
 *   cây `heartbeat/` **thêm vào** thay vì dựng lại từ một entry, cộng 9 bài
 *   kiểm khoá hành vi đó.
 * - **Vế đo lại (file này).** Không bên đọc nào hỏi *"đầu nhánh còn giữ đủ
 *   chưa"*. `heartbeat-source.ts` lấy `max` của `at` nên **một** file cũng đủ
 *   làm nó xanh; `pnpm step0:pending` đo *"dòng log đã tới nhánh chính
 *   chưa"* — một câu hỏi khác; và `step0Streaks` là hàm thuần trên một mảng
 *   dòng, **không script nào gọi nó**. Nên vế ghi hỏng lần nữa vì bất cứ lý
 *   do nào thì không gì đỏ, y như 37 lần trước.
 *
 * ## Bất biến, phát biểu được thành một câu
 *
 * Đầu nhánh `claude/telemetry` phải là **tập cha** của mọi file `heartbeat/`
 * mà nhánh đã từng giữ. Nhánh này append-only — mỗi lượt một file, tên sinh
 * từ `step0LogPath` của kernel — nên **một** lần vi phạm nghĩa là **một** lần
 * đẩy đã xoá. Không có ca lành nào.
 *
 * ## Vì sao ngưỡng là 0, và vì sao nó khác mọi ngưỡng khác trong kho
 *
 * `STEP0_PENDING_STALE_HOURS` (24), `LANE_HEARTBEAT_STALE_HOURS`,
 * `DEFAULT_DELAY_HOURS` (12) — mọi hằng số giờ trong kho đo **độ trễ**, một
 * đại lượng **có** ca lành: một dòng log chưa gộp sau 3 giờ là một hàng đợi
 * đang chạy, không phải một chỗ hỏng. Phép đo ở đây đo **mất dữ liệu trên
 * một nhánh append-only**, và đại lượng đó không có ca lành: một bản ghi
 * biến mất khỏi đầu nhánh là một lần đẩy đã xoá, dù nó xảy ra một giây hay
 * một tuần trước.
 *
 * Nên `> 0` là ngưỡng đúng, và một hằng số giờ ở đây sẽ là **một cửa sổ cho
 * phép xoá**: "thiếu dưới N giờ thì im" nghĩa là mọi lần đẩy hỏng đều được
 * tha nếu lượt sau chữa kịp — mà "lượt sau chữa kịp" là đúng hai commit chữa
 * **bằng tay** mà `KF-043` đã ghi. `ops/test/telemetry-gaps.test.ts` khoá
 * chính câu này, để lượt sau không "nới cho đỡ ồn".
 *
 * ## Nơi chạy định kỳ, và chi phí thật của nó
 *
 * `ops/workflows/watchdog.yml`, dấu hiệu số **8**. Nhưng **không** vì lý do
 * dấu hiệu số 7 dùng, và chỗ này là khác biệt chịu tải:
 *
 * - Dấu hiệu số 7 gọi `git ls-remote --heads` — **không cần lịch sử**, nên
 *   nó thật sự không thêm gì vào một lượt đã fetch nhánh telemetry.
 * - Phép đo ở đây **cần lịch sử**: `ever` chỉ dựng được bằng cách đọc cây
 *   `heartbeat/` của **mọi** commit trên nhánh.
 *
 * Và `watchdog.yml` trước mục này fetch nhánh telemetry bằng **`--depth=1`**.
 * Đo thật, trên một kho trắng chạy đúng lệnh đó (`2026-09-26T09:3xZ`):
 *
 * ```
 * git fetch --no-tags --depth=1 origin +refs/heads/claude/telemetry:refs/crux/telemetry
 * git rev-list --count refs/crux/telemetry   → 1      (lịch sử thật: 70)
 * ever = tip = 18  ⇒  phép đo trả "0 thiếu"  (sự thật: 33)
 * git rev-parse --is-shallow-repository      → true   ← tín hiệu dò được
 * ```
 *
 * Đó đúng ca **BÁO YÊN** mà `KF-041` cấm — *"không im lặng, nó KHẲNG ĐỊNH LÀ
 * LÀNH, và cái đó tệ hơn im lặng"*. Nên mục này bỏ `--depth=1` cho nhánh
 * telemetry, và khai thẳng rằng **đó là một thay đổi chi phí**:
 *
 * | Lựa chọn | Chi phí | Vì sao không chọn |
 * |---|---|---|
 * | `--depth=1` (bản cũ) | rẻ nhất | **báo yên**, đo được ở trên |
 * | `--depth=N` đủ lớn | bị chặn | "đủ lớn" hết đúng một cách im lặng; nhánh mọc ~1 commit mỗi 20 phút (70 commit sau hai ngày) nên mọi N đều hết hạn |
 * | **lịch sử đầy đủ** (đã chọn) | ~70 commit lúc chọn, mỗi commit một blob nhỏ cộng hai tree; mọi giờ một lần | tăng theo thời gian, khai ở dòng dưới |
 * | chuyển sang một nơi chạy thưa hơn | rẻ hơn | phát hiện muộn hơn cho một chỗ hỏng **mất dữ liệu**; đáng cân nhắc lại khi lịch sử vượt ~5000 commit |
 *
 * **Lối thoát đã cài sẵn cho lượt sau:** nếu một lượt sau phải đặt lại một
 * trần độ sâu, `historyCommits` cộng ca 2 của hàm dưới biến việc đó thành
 * một câu trong `problems` — **không** thành *"0 thiếu"*. Tức chi phí giảm
 * được mà không mua lại chỗ hỏng.
 *
 * **`pnpm check` KHÔNG phải chỗ đặt**, khai ra để lượt sau không "tiện tay"
 * thêm vào: cổng đó chạy trên **mọi** PR và không có remote trong CI nếu
 * không thêm một lần fetch cho mỗi lượt chạy — tức trả tiền ở chỗ đắt nhất
 * để canh một thứ đổi vài giờ một lần. Cùng lý lẽ `P-056` đã ghi, và ở đây
 * nó **mạnh hơn**: phép đo này còn cần cả lịch sử nhánh.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseStep0LogId } from '../../kernel/src/log.ts';

/** Nhánh giữ bản sao nhịp tim (`P-043`). Một chỗ khai, không chép tay. */
export const TELEMETRY_BRANCH = 'claude/telemetry';

/** Thư mục trong nhánh đó. `telemetry-beat.ts` ghi vào đúng chỗ này. */
export const TELEMETRY_DIR = 'heartbeat';

/** Đuôi file của một dòng log (`D-C04`). */
const LOG_EXTENSION = '.jsonl';

/**
 * Đầu vào hỏng thì **NÉM**, cùng luật `claimCheck` và
 * `listPendingBranchesFromRemote`: một báo cáo *"0 thiếu"* trông y hệt một
 * câu trả lời, nên nó không bao giờ được là cách một phép đo trượt kết thúc.
 */
export class TelemetryGapsInputError extends Error {}

export interface TelemetryGapsInput {
  /**
   * Tên file trong `heartbeat/` ở **đầu nhánh** — đúng thứ
   * `git ls-tree --name-only <ref>:heartbeat` trả về.
   */
  tip: readonly string[];
  /**
   * Tên file trong `heartbeat/` thấy trên **mọi** commit của nhánh, hợp lại.
   * Bên gọi dựng bằng một vòng `git ls-tree` trên `git rev-list`.
   */
  ever: readonly string[];
  /**
   * Số commit mà phép đo `ever` **thật sự** đọc được
   * (`git rev-list --count`).
   *
   * Trường này **không tuỳ chọn**, và nó là lưới duy nhất cho ca đắt nhất:
   * một lần fetch nông cho `ever == tip` với một danh sách **không rỗng**,
   * nên một lưới chỉ bắt *"danh sách lịch sử rỗng"* không thấy gì. Xem bảng
   * chi phí ở đầu file.
   */
  historyCommits: number;
}

export interface TelemetryGapRow {
  /** Tên file, nguyên văn như nó nằm trong `heartbeat/`. */
  name: string;
  /** Tên file bỏ đuôi `.jsonl` — mã log bước 0 (`P-023`). */
  logId: string;
  /** `at` đọc ngược từ mã log bằng `parseStep0LogId`. */
  at: string;
  /** Routine đã ghi dòng đó. */
  runner: string;
}

export interface TelemetryGapsReport {
  /**
   * Bản ghi **thiếu ở đầu nhánh** (tên trường là `gaps`, KHÔNG phải `missing`:
   * `heartbeat-source.ts` đã dùng `.missing` cho một nghĩa khác — nguồn nhịp
   * tim nào VẮNG MẶT — và `ops/test/heartbeat-source.test.ts` canh rằng không
   * dòng nào của `watchdog.yml` đọc `.missing` ngoài chỗ của nó). Cũ nhất trước — mỗi lần đẩy xoá thì bản
   * cũ nhất là bản mất lâu nhất, và đó là thứ bên đọc cần thấy đầu tiên.
   */
  gaps: TelemetryGapRow[];
  tipCount: number;
  everCount: number;
  historyCommits: number;
  /**
   * Mọi thứ **không đo được**, khai riêng từng câu — cùng hình dạng
   * `problems` của `step0-pending-branches.ts` và `heartbeat-source.ts`.
   *
   * `problems` khác rỗng **không** làm `gaps` rỗng đi, và ngược lại: hai
   * câu trả lời độc lập. Bên gọi phải báo động vì cả hai.
   */
  problems: string[];
}

/**
 * Bản ghi nào thiếu ở đầu nhánh.
 *
 * Hàm **thuần**: không đụng mạng, không đọc đĩa, không đọc đồng hồ. Ba danh
 * sách/số đầu vào là tất cả những gì nó cần — nhờ vậy hình dạng đo được ở
 * `KF-043` (12 tên ở đầu nhánh, 45 trong lịch sử, 33 thiếu) dựng lại được
 * trong một bài kiểm mà không cần một kho git.
 *
 * Mốc tách khỏi tên bằng `parseStep0LogId` của kernel — **phép đảo** của
 * `step0LogId` — chứ không phải một `slice` tự cắt ở đây. Cùng luật `P-056`
 * đã dùng: một chỗ ghép tên thì một chỗ đọc ngược lại.
 *
 * @throws TelemetryGapsInputError khi phép đo lịch sử **không đo được**
 *   (`historyCommits` không phải số nguyên ≥ 1, hoặc nó bằng 1 trong khi đầu
 *   nhánh có nhiều hơn một file). Ném chứ không trả *"0 thiếu"*.
 */
export function telemetryTipGaps(input: TelemetryGapsInput): TelemetryGapsReport {
  const problems: string[] = [];

  if (!Number.isInteger(input.historyCommits) || input.historyCommits < 1) {
    throw new TelemetryGapsInputError(
      `\`historyCommits\` phải là số nguyên ≥ 1, nhận ${JSON.stringify(input.historyCommits)}. ` +
        'Nhánh `' +
        TELEMETRY_BRANCH +
        '` luôn có ít nhất một commit khi nó tồn tại, nên giá trị này nghĩa là phép đo ' +
        'lịch sử đã trượt — KHÔNG phải "0 bản ghi thiếu".',
    );
  }

  const tipNames = new Set(input.tip);
  const everNames = new Set(input.ever);

  // Ca đắt nhất, và nó KHÔNG phải giả thuyết: một `git fetch --depth=1` cho
  // `rev-list --count` = 1 và `ever` = `tip` với một danh sách KHÔNG rỗng, nên
  // phép trừ trả rỗng và mọi thứ trông lành. Đo thật ở bảng chi phí đầu file:
  // 1 commit, ever = tip = 18, sự thật 33 thiếu.
  //
  // Điều kiện là `tipNames.size > 1`, không phải `> 0`: một nhánh vừa sinh
  // THẬT có đúng một commit và đúng một file, và ca đó lành.
  if (input.historyCommits === 1 && tipNames.size > 1) {
    throw new TelemetryGapsInputError(
      `Phép đo lịch sử chỉ thấy 1 commit trong khi đầu nhánh mang ${tipNames.size} file — ` +
        'một nhánh append-only ghi mỗi lượt một file nên hai số đó không đi cùng nhau. ' +
        'Gần như chắc chắn là một lần `git fetch` NÔNG (`--depth=1`): xem bảng chi phí ở ' +
        '`ops/scripts/telemetry-gaps.ts`. KHÔNG được đọc thành "0 bản ghi thiếu".',
    );
  }

  // Đầu nhánh là commit CUỐI của `rev-list`, nên `tip ⊆ ever` đúng theo cấu
  // tạo khi hai danh sách cùng dựng từ một lần `rev-list` — kể cả sau một
  // `--force`, vì `--force` chỉ đổi `rev-list` là gì, không làm đầu nhánh rơi
  // ra khỏi nó. Nên lý do đúng của ca này là **bên gọi dựng sai đầu vào**,
  // không phải "lịch sử bị viết lại". Giữ làm bài phòng thủ cho một hàm thuần.
  const strayTip = [...tipNames].filter((name) => !everNames.has(name)).sort();
  if (strayTip.length > 0) {
    problems.push(
      `${strayTip.length} tên có ở đầu nhánh mà KHÔNG có trong lịch sử ` +
        `(${strayTip.join(', ')}). Với hai danh sách cùng dựng từ một lần \`git rev-list\` thì ` +
        'chuyện này không xảy ra được — đầu nhánh là commit cuối của chính danh sách đó. Nên ' +
        'đây là ĐẦU VÀO KHÔNG NHẤT QUÁN do bên gọi dựng sai, không phải dấu hiệu lịch sử bị ' +
        'viết lại. Phần `missing` dưới đây vẫn đo được, nhưng đừng tin `everCount`.',
    );
  }

  const gaps: TelemetryGapRow[] = [];
  for (const name of [...everNames].sort()) {
    if (tipNames.has(name)) continue;

    if (!name.endsWith(LOG_EXTENSION)) {
      problems.push(
        `Tên \`${name}\` trong \`${TELEMETRY_DIR}/\` không có đuôi \`${LOG_EXTENSION}\` — không ` +
          'phải một dòng log bước 0 (`P-023`), nên không suy ra được mốc. Nó vẫn là một entry ' +
          'đã biến mất khỏi đầu nhánh; phải xem bằng tay.',
      );
      continue;
    }

    const logId = name.slice(0, -LOG_EXTENSION.length);
    const parsed = parseStep0LogId(logId);
    if (parsed === null) {
      problems.push(
        `Tên \`${name}\` mang mã log không đọc được (\`${logId}\`) — \`parseStep0LogId\` trả ` +
          '`null`, nên không suy ra được mốc lượt chạy. Entry này vẫn đã biến mất khỏi đầu ' +
          'nhánh; phải xem bằng tay.',
      );
      continue;
    }

    gaps.push({ name, logId, at: parsed.at, runner: parsed.runner });
  }

  // Cũ nhất trước. `at` là chuỗi ISO có cùng độ dài nên so chuỗi đủ, nhưng so
  // bằng mốc để không phụ thuộc vào hình dạng chuỗi của `step0LogId`.
  gaps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.name.localeCompare(b.name));

  return {
    gaps,
    tipCount: tipNames.size,
    everCount: everNames.size,
    historyCommits: input.historyCommits,
    problems,
  };
}

/**
 * Một dòng tiêu đề cộng một dòng cho mỗi bản ghi thiếu — để dán vào thân
 * cảnh báo của `watchdog.yml`.
 *
 * Ca rỗng in một dòng **tường minh**, không im lặng: `Z7` cấm đúng chỗ này.
 */
export function renderTelemetryGaps(report: TelemetryGapsReport): string {
  const lines: string[] = [];
  const scope =
    `đầu nhánh ${report.tipCount} file · lịch sử ${report.everCount} file ` +
    `qua ${report.historyCommits} commit`;

  if (report.gaps.length === 0) {
    lines.push(
      `Nhịp tim \`${TELEMETRY_BRANCH}\`: đầu nhánh giữ đủ mọi bản ghi nhánh đã từng có (${scope}).`,
    );
  } else {
    lines.push(
      `Bản ghi nhịp tim THIẾU ở đầu nhánh \`${TELEMETRY_BRANCH}\`: ${report.gaps.length} ` +
        `(${scope}). Ngưỡng là 0 — nhánh này append-only nên không có ca lành.`,
    );
    for (const row of report.gaps) {
      lines.push(`  ⚠ ${row.name} — mốc ${row.at} · ${row.runner}`);
    }
    lines.push(`  Cách gỡ, MỘT lệnh: \`pnpm telemetry:restore\` (mục \`platform/P-059\`).`);
  }
  for (const problem of report.problems) lines.push(`  ⚠ ${problem}`);
  return lines.join('\n');
}

/** Kết quả một lần đọc nhánh telemetry từ một kho git đã fetch sẵn. */
export interface TelemetryBranchScan extends TelemetryGapsInput {
  /** `true` khi kho git đang nông — lịch sử **không** đầy đủ. */
  shallow: boolean;
}

function git(args: readonly string[]): string {
  const run = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (run.status !== 0) {
    throw new TelemetryGapsInputError(
      `git ${args.join(' ')} thoát ${run.status ?? 'không rõ'} — KHÔNG đo được. ` +
        `Đây không phải "0 bản ghi thiếu". ${(run.stderr ?? '').trim()}`,
    );
  }
  return run.stdout ?? '';
}

/**
 * Đọc đầu nhánh và lịch sử của một ref đã fetch sẵn.
 *
 * **Ném** khi `git` thoát khác 0, cùng lý do `listPendingBranchesFromRemote`
 * ném: một danh sách rỗng đi vào `telemetryTipGaps` cho ra đúng từng byte
 * câu của ca lành.
 *
 * Kho nông bị bắt ở **hai** tầng, có chủ đích: `shallow` ở đây (dò được
 * trực tiếp) và ca 2 của `telemetryTipGaps` (suy từ `historyCommits`). Tầng
 * thứ hai là tầng chịu tải, vì nó còn sống khi bên gọi không phải một kho
 * git — ví dụ một bài kiểm, hay một lượt đã có sẵn hai danh sách.
 */
export function scanTelemetryBranch(ref: string): TelemetryBranchScan {
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true';
  const commits = git(['rev-list', ref])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const listDir = (rev: string): string[] => {
    // `ls-tree` trên một revision KHÔNG có thư mục đó thoát khác 0 — đó là ca
    // thường (commit gốc của nhánh có thể chưa có `heartbeat/`), nên nó không
    // đi qua `git()` ở trên. Lỗi khác vẫn im ở đây; bù lại `historyCommits`
    // đếm từ `rev-list` chứ không từ số lần `ls-tree` thành công, nên một lần
    // trượt không làm phép đo trông đầy đủ hơn nó thật.
    const run = spawnSync('git', ['ls-tree', '--name-only', `${rev}:${TELEMETRY_DIR}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
    if (run.status !== 0) return [];
    return (run.stdout ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const ever = new Set<string>();
  for (const commit of commits) for (const name of listDir(commit)) ever.add(name);

  return {
    tip: listDir(ref),
    ever: [...ever],
    historyCommits: commits.length,
    shallow,
  };
}

/**
 * Các lệnh git khôi phục đầu nhánh về **hợp** của mọi bản ghi.
 *
 * Script **không bao giờ tự ghi lên remote**, cùng luật `telemetry-beat.ts`
 * đã chốt (CHARTER phụ lục P3 bước 0e): *"thao tác ghi nằm ở chỗ người đọc
 * bản ghi lượt chạy thấy được, không chôn trong một script"*. Nên `pnpm
 * telemetry:restore` in ra **đúng** các lệnh phải chạy, và chúng thuần cộng
 * thêm — không `--force`, không xoá entry nào.
 *
 * Cây dựng bằng `git mktree` từ **hợp** của `tip` và `ever`: mọi entry lấy
 * blob của lần cuối nó xuất hiện trong lịch sử, nên dữ liệu không phải đi
 * tìm ở đâu khác (`KF-043`: dữ liệu **chưa mất**, nó còn trong lịch sử
 * nhánh).
 */
export function renderRestoreCommands(scan: TelemetryBranchScan, ref: string): string {
  const sessionUrl = process.env.CLAUDE_SESSION_URL ?? '<url phiên>';
  return [
    `# Khôi phục đầu nhánh ${TELEMETRY_BRANCH} về HỢP của mọi bản ghi (mục platform/P-059).`,
    '# Thuần cộng thêm: không --force, không xoá entry nào. Nhánh này KHÔNG bao giờ có PR',
    '# nên lần đẩy này không chạy CI (P-043).',
    'set -euo pipefail',
    `REF=${JSON.stringify(ref)}`,
    `DIR=${JSON.stringify(TELEMETRY_DIR)}`,
    '# Blob của mỗi tên: lần CUỐI nó xuất hiện trong lịch sử. `rev-list` đi từ mới về cũ nên',
    '# `awk` giữ bản ghi đầu tiên gặp được cho mỗi tên, tức bản mới nhất.',
    'INNER=$(for C in $(git rev-list "$REF"); do',
    '  git ls-tree "$C:$DIR" 2>/dev/null || true',
    `done | awk -F'\\t' '!seen[$2]++' | git mktree)`,
    '# Cây GỐC cũng dựng THÊM — cùng lý do khối lệnh của telemetry-beat.ts dùng: một mktree',
    '# chỉ mang entry `heartbeat` sẽ xoá mọi thứ khác ở gốc nhánh.',
    'OLD_ROOT=$(git ls-tree "$REF")',
    `ROOT=$({ printf '%s\\n' "$OLD_ROOT" | awk -F'\\t' -v n="$DIR" 'NF && $2 != n'; \\`,
    `  printf '040000 tree %s\\t%s\\n' "$INNER" "$DIR"; } | git mktree)`,
    '# Cây không đổi thì KHÔNG commit: một commit rỗng làm nhịp tim trông như vừa đập.',
    'if [ "$ROOT" = "$(git rev-parse "$REF^{tree}")" ]; then',
    `  printf 'Đầu nhánh đã giữ đủ — không có gì để khôi phục.\\n'; exit 0`,
    'fi',
    '# Trailer BẮT BUỘC và không sửa được về sau (CLAUDE.md mục 6): commit trên nhánh này',
    '# không bao giờ vào nhánh chính nên CI không quét nó, mà bài kiểm G14 của',
    '# recheck-assumptions.ts CÓ quét mọi nhánh claude/*.',
    `MSG=$(printf '%s\\n' "🤖 [integration] khôi phục ${scan.ever.length - scan.tip.length} bản ghi nhịp tim thiếu ở đầu nhánh (P-059)" "" \\`,
    '  "Co-Authored-By: Claude <noreply@anthropic.com>" \\',
    `  "Claude-Session: ${sessionUrl}")`,
    'COMMIT=$(echo "$MSG" | git commit-tree "$ROOT" -p "$(git rev-parse "$REF")")',
    `git push origin "$COMMIT:refs/heads/${TELEMETRY_BRANCH}"`,
  ].join('\n');
}

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/telemetry-gaps.ts (--from-remote | --tip <file> --ever <file> ' +
      '--history-commits <N>) [--ref <ref>] [--restore] [--json]\n' +
      '  --from-remote      fetch nhánh telemetry với LỊCH SỬ ĐẦY ĐỦ rồi đo (dạng `pnpm telemetry:gaps`).\n' +
      '  --tip/--ever       file văn bản, mỗi dòng một tên file trong `heartbeat/`.\n' +
      '  --history-commits  số commit mà phép đo `ever` đọc được. BẮT BUỘC khi khai --tip/--ever.\n' +
      '  --restore          in ra các lệnh git khôi phục (dạng `pnpm telemetry:restore`), cần --from-remote.\n' +
      'Thoát 1 khi có bản ghi thiếu HOẶC có `problems`; thoát 2 khi tham số sai hoặc không đo được.\n',
  );
  process.exit(2);
}

function readNames(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main(argv: readonly string[]): void {
  let fromRemote = false;
  let tipFile: string | undefined;
  let everFile: string | undefined;
  let historyCommits: number | undefined;
  let ref = 'refs/crux/telemetry';
  let restore = false;
  let asJson = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') asJson = true;
    else if (arg === '--restore') restore = true;
    else if (arg === '--from-remote') fromRemote = true;
    else if (arg === '--tip') tipFile = argv[(index += 1)];
    else if (arg === '--ever') everFile = argv[(index += 1)];
    else if (arg === '--ref') {
      const value = argv[(index += 1)];
      if (value === undefined) usage();
      ref = value;
    } else if (arg === '--history-commits') {
      const value = argv[(index += 1)];
      // `--history-commits` thiếu giá trị KHÔNG được rơi im lặng về một mặc
      // định: đó chính là trường làm nên lưới của ca 2.
      if (value === undefined) usage();
      historyCommits = Number(value);
    } else usage();
  }

  if (fromRemote === (tipFile !== undefined || everFile !== undefined)) usage();
  if (restore && !fromRemote) usage();

  let scan: TelemetryBranchScan;
  try {
    if (fromRemote) {
      // KHÔNG `--depth`: phép đo này cần lịch sử. Xem bảng chi phí đầu file.
      git(['fetch', '--no-tags', 'origin', `+refs/heads/${TELEMETRY_BRANCH}:${ref}`]);
      scan = scanTelemetryBranch(ref);
    } else {
      if (tipFile === undefined || everFile === undefined || historyCommits === undefined) usage();
      scan = {
        tip: readNames(tipFile),
        ever: readNames(everFile),
        historyCommits,
        shallow: false,
      };
    }
  } catch (error) {
    process.stderr.write(
      `⚠ KHÔNG ĐO ĐƯỢC — ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }

  let report: TelemetryGapsReport;
  try {
    report = telemetryTipGaps(scan);
  } catch (error) {
    process.stderr.write(
      `⚠ KHÔNG ĐO ĐƯỢC — ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }

  if (scan.shallow) {
    report.problems.push(
      'Kho git đang NÔNG (`git rev-parse --is-shallow-repository` → `true`), nên lịch sử nhánh ' +
        'KHÔNG đầy đủ và `everCount` là CẬN DƯỚI. Đây không phải "0 bản ghi thiếu" — xem bảng ' +
        'chi phí ở `ops/scripts/telemetry-gaps.ts`.',
    );
  }

  if (restore) {
    process.stdout.write(`${renderTelemetryGaps(report)}\n\n`);
    process.stdout.write(`${renderRestoreCommands(scan, ref)}\n`);
  } else {
    process.stdout.write(
      asJson
        ? `${JSON.stringify({ ...report, shallow: scan.shallow, render: renderTelemetryGaps(report) })}\n`
        : `${renderTelemetryGaps(report)}\n`,
    );
  }

  // Thoát 1 khi có bản ghi thiếu HOẶC có `problems` — một phép đo không đo
  // được thì KHÔNG báo xanh. Cùng luật `merge-queue-orphans.ts` (`P-060`).
  if (report.gaps.length > 0 || report.problems.length > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
