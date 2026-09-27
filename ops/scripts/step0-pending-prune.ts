#!/usr/bin/env node
/**
 * Mục `integration/I-022` — dọn nhánh `claude/integration/step0-pending/*`
 * mà dòng log của nó **đã có trên `main`**.
 *
 * ## Vì sao mục này tồn tại
 *
 * Vế hai của `platform/P-038` là *"xoá nhánh đã gộp"*. Phiên cloud của agent
 * **không** làm được: `git push origin --delete <nhánh chờ>` trả **HTTP 403**
 * (đo thật ở lượt `crux-worker-2` `2026-09-27T09:1xZ` và các lượt `#293`,
 * `#260`, `#305`). Nên ref rác chỉ tăng — 63 nhánh lúc mở mục, mỗi lượt
 * log-only thêm một.
 *
 * Đường đi ở đây nằm trong luật hiện có, không xin quyền mới cho agent: một
 * workflow trong `ops/workflows/**` (`step0-pending-prune.yml`) chạy bằng
 * `GITHUB_TOKEN` của Actions — thứ **có** quyền xoá nhánh. File này là phần
 * **quyết định** (xoá nhánh nào), tách khỏi YAML để kiểm được bằng
 * `node --test`, cùng cách `ops/scripts/smoke-workflows.ts` làm.
 *
 * ## Luật xoá — một câu, dùng lại hàm của `P-062`
 *
 * Xoá một nhánh chờ **khi và chỉ khi** mã log của nó có trên nhánh chính, đo
 * bằng `mergedStep0LogIdsFromRef("origin/main")`. **Không** viết bản thứ hai
 * của luật đó, và **không bao giờ** xoá theo tuổi nhánh: một nhánh 25 giờ mà
 * dòng log chưa tới `main` là đúng thứ dấu hiệu số 7 của `watchdog.yml` phải
 * báo, và xoá nó là mất dòng log duy nhất của lượt ấy (bất biến **I8**).
 *
 * ## Hướng lệch: không đo được thì KHÔNG xoá gì
 *
 * - `git ls-remote` hỏng, ref nhánh chính không có, hay ref đó không có file
 *   log nào → hai hàm đọc của `step0-pending-branches.ts` **ném**, CLI thoát
 *   **2** và không in danh sách nào. Workflow đỏ và không xoá gì.
 * - Một nhánh tên lạ (sai tiền tố, mã log không đọc được) → vào `problems`,
 *   **không bao giờ** vào `prune`. Nhánh đó có thể đang giữ dòng log duy nhất
 *   của một lượt; phải có người xem.
 *
 * ## Cái KHÔNG sửa ở đây
 *
 * Mục này **không** bỏ nhánh chờ. Nhánh chờ là vế một của `P-038` và nó đang
 * làm đúng việc của nó: giữ dòng log của lượt log-only cho tới khi một lượt có
 * PR `cherry-pick` nó vào (phụ lục P3 bước 0f). Mục này chỉ dọn phần đuôi —
 * nhánh đã hết việc.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseStep0LogId } from '../../kernel/src/log.ts';
import {
  STEP0_PENDING_BRANCH_PREFIX,
  isStep0PendingBranch,
  step0LogIdFromPendingBranch,
} from './step0-pr-gate.ts';
import {
  STEP0_LOG_DIR,
  listPendingBranchesFromRemote,
  mergedStep0LogIdsFromRef,
} from './step0-pending-branches.ts';

export interface Step0PruneInput {
  /** Tên nhánh remote, đã cắt `refs/heads/`. */
  branches: readonly string[];
  /** Mã log bước 0 đã có trên nhánh chính — từ `mergedStep0LogIdsFromRef`. */
  mergedLogIds: readonly string[];
}

export interface Step0PruneKeep {
  branch: string;
  logId: string;
  /** Câu tiếng Việt: vì sao nhánh này ở lại. */
  why: string;
}

export interface Step0PrunePlan {
  /** Nhánh xoá được: mã log của nó ĐÃ có trên nhánh chính. Sắp theo tên. */
  prune: string[];
  /** Nhánh ở lại vì dòng log của nó CHƯA tới nhánh chính — nói ra, không im. */
  keep: Step0PruneKeep[];
  /** Nhánh không hiểu được — không bao giờ xoá, phải có người xem. */
  problems: string[];
}

/**
 * Nhánh chờ nào xoá được. Hàm thuần: không mạng, không đĩa.
 *
 * `mergedLogIds` rỗng **không** được đọc thành "không xoá gì cho an toàn rồi
 * im": nhánh chính luôn có dòng log bước 0 từ `P-023`, nên rỗng là một phép
 * đo hỏng — hàm trả một `problems` và không xoá gì. (Bên gọi thật đã bị
 * `mergedStep0LogIdsFromRef` chặn trước; đây là lớp thứ hai cho bên gọi khác.)
 */
export function planStep0PendingPrune(input: Step0PruneInput): Step0PrunePlan {
  if (input.mergedLogIds.length === 0) {
    return {
      prune: [],
      keep: [],
      problems: [
        'Danh sách mã log trên nhánh chính RỖNG — nhánh chính luôn có dòng log bước 0 từ `P-023`, ' +
          'nên đây là một phép đo hỏng. KHÔNG xoá nhánh nào.',
      ],
    };
  }

  const merged = new Set(input.mergedLogIds);
  const prune: string[] = [];
  const keep: Step0PruneKeep[] = [];
  const problems: string[] = [];

  for (const branch of new Set(input.branches)) {
    if (!isStep0PendingBranch(branch)) {
      problems.push(
        `Nhánh \`${branch}\` không mang tiền tố \`${STEP0_PENDING_BRANCH_PREFIX}/\` — KHÔNG xoá. ` +
          'Phép liệt kê của bên gọi đang quét rộng hơn chỗ cần quét.',
      );
      continue;
    }
    const logId = step0LogIdFromPendingBranch(branch);
    if (logId === null || parseStep0LogId(logId) === null) {
      problems.push(
        `Nhánh chờ \`${branch}\` mang mã log không đọc được (\`${logId ?? branch}\`) — KHÔNG xoá. ` +
          'Nó có thể đang giữ dòng log duy nhất của một lượt; phải xem bằng tay.',
      );
      continue;
    }
    if (merged.has(logId)) {
      prune.push(branch);
    } else {
      keep.push({
        branch,
        logId,
        why: 'dòng log CHƯA có trên nhánh chính — nhánh này là chỗ duy nhất giữ nó (bước 0f gộp nó, không phải phép dọn này)',
      });
    }
  }

  prune.sort();
  keep.sort((a, b) => a.branch.localeCompare(b.branch));
  return { prune, keep, problems };
}

/** Báo cáo cho log của workflow và cho một lượt worker gõ tay. */
export function renderStep0PrunePlan(plan: Step0PrunePlan, source: string): string {
  const lines = [
    `Dọn nhánh chờ \`step0-pending\` (I-022): ${plan.prune.length} xoá được · ` +
      `${plan.keep.length} ở lại · ${plan.problems.length} không hiểu được.`,
    `  (đối chiếu với: ${source})`,
  ];
  for (const branch of plan.prune) lines.push(`  ✂ ${branch}`);
  for (const row of plan.keep) lines.push(`  ⏸ ${row.branch} — ${row.why}`);
  for (const problem of plan.problems) lines.push(`  ⚠ ${problem}`);
  return lines.join('\n');
}

function usage(): never {
  process.stderr.write(
    'Dùng: node ops/scripts/step0-pending-prune.ts (--from-remote | --branches <file>) ' +
      '[--main-ref <ref>] [--json]\n' +
      '  --from-remote  hỏi `git ls-remote` danh sách nhánh chờ.\n' +
      '  --branches     file văn bản, mỗi dòng một tên nhánh (nhận cả dạng `<sha>\\trefs/heads/<nhánh>`).\n' +
      '  --main-ref     ref của nhánh chính, mặc định `origin/main`. Ném khi ref không tồn tại.\n' +
      '  --json         in {prune, keep, problems, source} ra stdout; báo cáo người đọc ra stderr.\n' +
      'Không --json: stdout là danh sách nhánh xoá được, mỗi dòng một nhánh.\n' +
      'Thoát 2 khi KHÔNG ĐO ĐƯỢC — khi đó stdout rỗng, và bên gọi không được xoá gì.\n',
  );
  process.exit(2);
}

function main(argv: readonly string[]): void {
  let branchesFile: string | undefined;
  let fromRemote = false;
  let mainRef = 'origin/main';
  let asJson = false;

  const valueOf = (index: number): string => {
    const value = argv[index];
    if (value === undefined || value.startsWith('--')) usage();
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json') asJson = true;
    else if (arg === '--from-remote') fromRemote = true;
    else if (arg === '--branches') branchesFile = valueOf((index += 1));
    else if (arg === '--main-ref') mainRef = valueOf((index += 1));
    else usage();
  }
  if (fromRemote === (branchesFile !== undefined)) usage();

  let branches: string[];
  let mergedLogIds: string[];
  try {
    branches = fromRemote
      ? listPendingBranchesFromRemote()
      : readFileSync(branchesFile!, 'utf8')
          .split('\n')
          .map((line) => line.trim().replace(/^[0-9a-f]{7,40}\s+refs\/heads\//, ''))
          .filter((line) => line.length > 0);
    mergedLogIds = mergedStep0LogIdsFromRef(mainRef);
  } catch (error) {
    process.stderr.write(
      `⚠ KHÔNG ĐO ĐƯỢC — không xoá nhánh nào. ${(error as Error).message}\n`,
    );
    process.exit(2);
  }

  const sha = spawnSync('git', ['rev-parse', '--short', mainRef], { encoding: 'utf8' });
  const source = `ref \`${mainRef}\` (${sha.status === 0 ? sha.stdout.trim() : '?'}), thư mục \`${STEP0_LOG_DIR}/\``;
  const plan = planStep0PendingPrune({ branches, mergedLogIds });
  process.stderr.write(`${renderStep0PrunePlan(plan, source)}\n`);
  process.stdout.write(
    asJson
      ? `${JSON.stringify({ ...plan, source })}\n`
      : plan.prune.map((branch) => `${branch}\n`).join(''),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
