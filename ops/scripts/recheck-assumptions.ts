#!/usr/bin/env node
/**
 * Chạy lại **bài kiểm** của những giả định có cách kiểm tự động — mục
 * `I-003` (`ops/lanes/integration/backlog.md`), nguồn CHARTER 11.1 và phụ
 * lục P3 bước 4. Routine `crux-integrator` gọi đúng một lệnh:
 *
 *     pnpm recheck:assumptions
 *
 * Khác với `pnpm assumptions`, và hai thứ này không thay được cho nhau:
 *
 * - `pnpm assumptions` kiểm **truy vết** — sổ có đủ mục không, file liệt kê
 *   ở cột *Phần phụ thuộc* có thật sự nhắc tới mã giả định không. Nó chạy
 *   trong `pnpm check`, ở mọi PR, và đỏ là chặn.
 * - Lệnh này kiểm **nội dung** — điều sổ đang khẳng định về nền tảng còn
 *   đúng không. Nó chạy mỗi thứ Hai, và đỏ ở đây nghĩa là *thế giới đã
 *   đổi*, không phải PR này sai. Vì thế nó KHÔNG nằm trong `pnpm check`:
 *   một giả định hoá ra sai không được phép chặn mọi làn (CHARTER mục 4).
 *
 * Chỉ giả định nào tự khai `**Kiểm tự động:**` trong sổ mới được chạy ở
 * đây. Giả định cần người (mở trang cấu hình tài khoản, đọc điều khoản nhà
 * cung cấp) được liệt kê ra là "cần người", không im lặng bỏ qua — im lặng
 * đúng là nhóm lỗi Z trong `ops/known-failures.md`: hỏng mà mọi chỉ báo
 * đều xanh.
 *
 * Hai kết luận cho mỗi bài kiểm, cố ý không nhiều hơn:
 *
 * - `khớp` — quan sát đúng như sổ ghi. Không phải làm gì.
 * - `sai`  — quan sát ngược với sổ. Đây là "đổi trạng thái" theo CHARTER
 *            11.1: lệnh in sẵn thân issue `🤖 [QĐ]` **kèm danh sách phần bị
 *            ảnh hưởng lấy từ cột *Phần phụ thuộc*** của chính giả định đó,
 *            để routine mở issue mà không phải tự soạn lại.
 *
 * Từng có kết luận thứ ba, `nâng`, cho trường hợp "quan sát cho thêm bằng
 * chứng so với sổ". Nó bị bỏ vì nó kêu **mãi mãi**: một giả định
 * `đã kiểm một phần` mà phần chưa kiểm không tự đóng lại được thì lượt chạy
 * nào cũng báo "có thêm bằng chứng", và một cảnh báo kêu mọi lượt là một
 * cảnh báo không ai đọc. Ghi bằng chứng mới vào sổ là việc của người đọc
 * kết quả, làm một lần, không phải việc của một dòng cảnh báo hằng tuần.
 *
 * Lệnh này KHÔNG tự mở issue và KHÔNG tự sửa sổ. Mở issue là việc của
 * routine (CHARTER 11.1), và một script chạy hằng tuần tự viết lại sổ giả
 * định là đúng thứ không ai soát được.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Verdict = 'khớp' | 'sai';

export interface LedgerEntry {
  code: string;
  confidence: string;
  /** Nguyên văn các mục trong cột *Phần phụ thuộc* — nguồn của "danh sách phần bị ảnh hưởng". */
  dependencies: string[];
  /** Mã bài kiểm tự động mà mục này tự khai, nếu có. */
  autoCheck?: string;
}

export interface CheckOutcome {
  verdict: Verdict;
  /** Một câu: quan sát được gì. */
  observed: string;
  /** Bằng chứng thô, mỗi dòng một ý. Đi vào issue nên phải đọc được. */
  evidence: string[];
  /**
   * Bài kiểm chạy được nhưng KHÔNG có gì để quan sát (cửa sổ quét rỗng).
   * Phải phân biệt với "đã quan sát và thấy đúng": hai thứ này in ra giống
   * nhau thì một bài kiểm không bao giờ chạy trông y hệt một bài kiểm luôn
   * xanh — hỏng mà mọi chỉ báo đều xanh.
   */
  observedNothing?: boolean;
}

export interface CheckReport extends CheckOutcome {
  code: string;
  checkId: string;
}

// ───────────────────────────────────────────────────────────── đọc sổ ──

/** Tách sổ giả định thành từng mục. Thuần, không đụng đĩa — để test được. */
export function parseLedger(ledger: string): LedgerEntry[] {
  const headings = [...ledger.matchAll(/^## (G\d+) · (.+)$/gm)];
  return headings.map((heading, index) => {
    const start = heading.index! + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1]!.index! : ledger.length;
    const body = ledger.slice(start, end);

    const confidence =
      /\*\*Độ tin cậy:\*\*\s*\*?\*?`?([^`*\n]+)`?/.exec(body)?.[1]?.trim() ?? 'không khai';

    const depLine = /\*\*Phần phụ thuộc:\*\*(.+)/.exec(body)?.[1] ?? '';
    // Giữ NGUYÊN VĂN từng mục, kể cả backtick và phần chú trong ngoặc: danh
    // sách này đi thẳng vào issue `🤖 [QĐ]`, nên nó phải đọc được đúng như
    // sổ viết. Cắt bớt ký tự ở đây chỉ tạo ra `ci.yml` (job `x`)` lệch dấu.
    const dependencies = depLine
      .split('·')
      .map((part) => part.trim().replace(/\.$/, '').trim())
      .filter((part) => part.length > 0);

    const autoCheck = /\*\*Kiểm tự động:\*\*\s*`([^`]+)`/.exec(body)?.[1]?.trim();

    return { code: heading[1]!, confidence, dependencies, autoCheck };
  });
}

// ─────────────────────────────────────────────── soạn thân issue [QĐ] ──

/**
 * Thân issue `🤖 [QĐ]` đúng năm phần của CLAUDE.md mục 14. Danh sách phần bị
 * ảnh hưởng lấy nguyên từ cột *Phần phụ thuộc* — đó là lý do cột ấy tồn tại
 * và là lý do `pnpm assumptions` giữ nó khỏi trôi khỏi thực tế.
 */
export function formatDecisionIssue(entry: LedgerEntry, report: CheckReport): { title: string; body: string } {
  const affected =
    entry.dependencies.length > 0
      ? entry.dependencies.map((dep) => `- ${dep}`).join('\n')
      : '- (sổ không liệt kê phần phụ thuộc nào — tự nó đã là một lỗi cần sửa)';

  const body = [
    '🤖 Một giả định trong `docs/assumptions.md` vừa đổi trạng thái khi chạy lại bài kiểm tự động',
    '(`pnpm recheck:assumptions`, mục `I-003`).',
    '',
    '## Bối cảnh',
    '',
    `- Giả định **${entry.code}**, sổ đang ghi độ tin cậy \`${entry.confidence}\`.`,
    `- Bài kiểm \`${report.checkId}\` chạy lại và cho kết quả **ngược với sổ**.`,
    `- Quan sát: ${report.observed}`,
    '',
    '### Bằng chứng',
    '',
    ...report.evidence.map((line) => `- ${line}`),
    '',
    '### Phần bị ảnh hưởng',
    '',
    affected,
    '',
    '## Phương án',
    '',
    `- **A.** Ghi \`sai\` vào sổ và chuyển sang dự phòng đã viết sẵn của ${entry.code}, rồi rà lại từng phần ở trên.`,
    '- **B.** Giữ nguyên sổ, coi kết quả này là nhiễu một lần, và chạy lại bài kiểm ở nhịp sau trước khi kết luận.',
    '',
    '## Khuyến nghị',
    '',
    '**A.** Luật 4 của CHARTER 11.1 nói ghi `sai` trước, chuyển dự phòng ngay; giữ nguyên sổ trong khi quan sát',
    'đã ngược lại chính là cách một giả định hỏng đi tiếp mà không chỉ báo nào đỏ.',
    '',
    '## Nếu anh chưa trả lời thì điều gì xảy ra',
    '',
    'Không có gì dừng lại. Đây là quyết định `reversible`: agent làm theo khuyến nghị ngay ở lượt chạy này và ghi',
    'vào bản tin sáng. Anh phủ quyết trong 24 giờ bằng `hoàn tác #N` trên issue bản tin.',
    '',
    '## Cách trả lời',
    '',
    'Trả lời `A` hoặc `B` trong MỘT comment trên issue bản tin, dạng `#N A`.',
  ].join('\n');

  return { title: `🤖 [QĐ] Giả định ${entry.code} đổi trạng thái khi chạy lại bài kiểm`, body };
}

// ─────────────────────────────────────── G14 · trailer Claude-Session ──

export interface CommitTrailerInfo {
  sha: string;
  subject: string;
  hasSessionTrailer: boolean;
}

/**
 * Commit do **công cụ** tạo, nhận diện bằng một danh sách trắng HẸP: message
 * của chúng do máy sinh, không đi qua agent, nên chúng không mang và không
 * thể mang trailer.
 *
 * Danh sách trắng chứ không phải danh sách đen, và đó là điểm mấu chốt.
 * Bản đầu làm ngược: "commit nào không có `Co-Authored-By: Claude` thì là
 * commit công cụ". Luật đó **fail-open đúng vào kịch bản G14 phải bắt** —
 * hôm nền tảng tắt `attribution`, cả `Co-Authored-By` lẫn `Claude-Session`
 * biến mất cùng lúc, mọi commit của agent bị xếp vào nhóm "công cụ", phép
 * đếm còn 0 phần tử, và bài kiểm kết luận `khớp`. Tức là nó xanh bằng cách
 * gọi commit của agent là commit của công cụ — đúng nhóm lỗi Z mà chính
 * file này lên án ở đầu.
 *
 * Với danh sách trắng thì chiều hỏng đảo lại: một commit lạ mà không nhận
 * ra là do công cụ sẽ bị tính vào phép đếm, và thiếu trailer thành **bằng
 * chứng ngược với G14** thay vì thành lý do loại khỏi phép đếm.
 */
export function isToolCommit(subject: string): boolean {
  // `integrator-resolve.ts` sinh đúng hai dạng message này.
  if (/^Gộp .*\(integrator[,)]/.test(subject)) return true;
  // Message mặc định do chính git sinh khi gộp.
  if (/^Merge (branch|remote-tracking branch|commit) /.test(subject)) return true;
  return false;
}

/**
 * G14 nói: commit do routine và thread tạo mang trailer `Claude-Session`.
 * Bài kiểm này đọc chính lịch sử git của repo, nên mỗi lượt routine chạy lại
 * là một lần quan sát thật, miễn phí.
 *
 * Nó canh **hồi quy**: "trailer còn được ghi không". Nó KHÔNG phân biệt được
 * commit của routine với commit của thread — git không có trường nào cho
 * việc đó — nên phần phân biệt ấy vẫn nằm ở mục `VF-G14`, không được coi là
 * đã xong nhờ bài kiểm này.
 *
 * Phạm vi quét là **commit chưa vào `main`**, tức commit đang nằm trên nhánh
 * PR. Đây không phải chi tiết kỹ thuật vụn: repo merge bằng **squash**, và
 * commit squash do GitHub tạo giữ lại `Co-Authored-By` nhưng **mất**
 * `Claude-Session` — trailer nằm giữa message ghép chứ không còn ở khối
 * trailer cuối. Quét cả `main` thì mọi commit lịch sử hiện ra như "thiếu
 * trailer" và bài kiểm kêu `sai` vì một lý do chẳng liên quan gì tới G14.
 * Lần chạy đầu của chính bài kiểm này đã mắc đúng lỗi đó.
 */
export function judgeTrailerEvidence(commits: CommitTrailerInfo[]): CheckOutcome {
  const byTool = commits.filter((c) => isToolCommit(c.subject));
  const byAgent = commits.filter((c) => !isToolCommit(c.subject));
  const missing = byAgent.filter((c) => !c.hasSessionTrailer);

  const note =
    byTool.length > 0
      ? `${byTool.length} commit do công cụ tạo (merge của integrator) không mang trailer — đúng như dự kiến, ` +
        'message của chúng do máy sinh, không đi qua agent.'
      : 'Không có commit do công cụ tạo trong phạm vi quét.';

  if (commits.length === 0) {
    return {
      verdict: 'khớp',
      observedNothing: true,
      observed: 'không có commit nào trên nhánh `claude/*` chưa vào `main` — không có gì để quan sát.',
      evidence: [
        'Không quan sát được gì KHÁC với quan sát được và thấy đúng. Thứ Hai không có PR nào đang mở là ' +
          'chuyện bình thường (nhánh merge xong thì bị xoá), nên trạng thái này sẽ xuất hiện thật.',
      ],
    };
  }

  if (missing.length > 0) {
    return {
      verdict: 'sai',
      observed: `${missing.length}/${byAgent.length} commit KHÔNG mang trailer Claude-Session.`,
      evidence: [
        ...missing.map((c) => `\`${c.sha}\` ${c.subject} — thiếu trailer`),
        note,
        'Trailer là dấu vết duy nhất phân biệt người với máy khi chưa tách danh tính (CHARTER 3.1, mặc định M6).',
      ],
    };
  }

  if (byAgent.length === 0) {
    return {
      verdict: 'khớp',
      observedNothing: true,
      observed: `${byTool.length} commit trong phạm vi quét đều do công cụ tạo — không có commit của agent để quan sát.`,
      evidence: [note],
    };
  }

  return {
    verdict: 'khớp',
    observed: `cả ${byAgent.length} commit do agent soạn đều mang trailer Claude-Session.`,
    evidence: [
      ...byAgent.slice(0, 5).map((c) => `\`${c.sha}\` ${c.subject} — có trailer`),
      note,
    ],
  };
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

const RECORD = '\u001e';
const FIELD = '\u001f';

/**
 * Commit trên các nhánh `origin/claude/*` mà **chưa vào `main`**, trong
 * `days` ngày gần nhất. Xem chú thích của `judgeTrailerEvidence` về lý do
 * loại `main` ra: squash làm mất trailer, không phải agent làm mất.
 */
export function collectCommits(root: string, days = 14): CommitTrailerInfo[] {
  const refs = git(root, ['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/claude/'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (refs.length === 0) return [];

  const format = ['%H', '%s', '%(trailers:key=Claude-Session,valueonly=true)'].join(FIELD);
  const raw = git(root, [
    'log',
    `--since=${days}.days.ago`,
    `--format=${format}${RECORD}`,
    ...refs,
    '^refs/remotes/origin/main',
  ]);

  return raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [sha = '', subject = '', session = ''] = record.split(FIELD);
      return { sha: sha.slice(0, 7), subject, hasSessionTrailer: session.trim().length > 0 };
    });
}

// ───────────────────────────────────────── G17 · merge=union và thứ tự ──

export interface UnionRuns {
  /** Nhánh rẽ ra TRƯỚC khi `.gitattributes` tồn tại; `main` mang luật vào cùng lần gộp. */
  ruleArrivesWithMerge: 'sạch' | 'xung đột';
  /** Nhánh đã mang sẵn `.gitattributes` trước khi gộp. */
  ruleAlreadyOnBranch: 'sạch' | 'xung đột';
}

/**
 * G17 đã được ghi `sai` và đã chuyển dự phòng (`P-016`). Bài kiểm này không
 * đi tìm lại kết luận đó — nó canh **hai điều kiện mà dự phòng đang đứng
 * lên trên**, để biết ngay khi một trong hai đổi:
 *
 * 1. Luật merge do `main` mang tới KHÔNG áp cho chính lần gộp mang nó tới.
 *    Nếu git đổi hành vi này, G17 hết `sai` và `P-016` bớt cần thiết.
 * 2. Union VẪN cứu được lần gộp sau khi nhánh đã mang luật. Sổ khẳng định
 *    "không mất gì" dựa vào đúng điều này; nếu nó hỏng thì `.gitattributes`
 *    thành đồ trang trí và KF-005 phải viết lại.
 */
export function judgeUnionRuns(runs: UnionRuns): CheckOutcome {
  const evidence = [
    `Lần 1 — nhánh rẽ trước khi có \`.gitattributes\`, \`main\` mang luật vào cùng lần gộp: **${runs.ruleArrivesWithMerge}**.`,
    `Lần 2 — nhánh đã mang sẵn \`.gitattributes\` rồi mới gộp: **${runs.ruleAlreadyOnBranch}**.`,
  ];

  if (runs.ruleArrivesWithMerge === 'sạch') {
    return {
      verdict: 'sai',
      observed: 'luật merge do `main` mang tới nay ÁP được cho chính lần gộp mang nó tới — ngược với điều sổ ghi.',
      evidence: [...evidence, 'G17 không còn `sai` theo nghĩa sổ đang ghi; cơ chế `P-016` cần được xem lại chứ không bỏ.'],
    };
  }

  if (runs.ruleAlreadyOnBranch === 'xung đột') {
    return {
      verdict: 'sai',
      observed: 'union KHÔNG còn cứu được cả lần gộp mà nhánh đã mang sẵn luật.',
      evidence: [...evidence, '`.gitattributes` mất tác dụng hoàn toàn: KF-005 và phần "không mất gì" của G17 phải viết lại.'],
    };
  }

  return {
    verdict: 'khớp',
    observed: 'đúng như sổ ghi: luật tới cùng lần gộp thì xung đột, nhánh mang sẵn luật thì union giữ cả hai dòng.',
    evidence,
  };
}

/**
 * Một lần thử. `withRuleOnBranch` là **điều kiện khác biệt duy nhất** giữa
 * hai lần: nhánh đã mang `.gitattributes` trước lần gộp hay chưa.
 *
 * Hướng gộp là `git merge origin/main` **khi đang đứng trên nhánh PR** —
 * đúng việc worker và `integrator-resolve.ts` làm. Hướng ngược lại (đứng
 * trên `main` gộp nhánh vào) cho kết quả KHÁC và kết quả đó vô nghĩa ở đây:
 * git đọc `.gitattributes` của cây đang checkout, nên đứng trên `main` thì
 * luật luôn áp và cả hai lần đều sạch. Lần viết đầu của bài kiểm này gộp
 * sai hướng và vì thế báo G17 "đổi trạng thái" — một kết luận sai hoàn
 * toàn. Đó chính là bài học của G17: bài thử phải tái hiện đúng điều kiện
 * đầu vào của lần chạy thật, và ở đây điều kiện đó gồm cả *ai đang đứng ở
 * nhánh nào*.
 */
function runUnionCase(withRuleOnBranch: boolean): 'sạch' | 'xung đột' {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-g17-'));
  const rule = 'shared.jsonl merge=union\n';
  try {
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.invalid']);
    git(dir, ['config', 'user.name', 'Test']);
    // Repo tạm vẫn đọc cấu hình toàn cục của máy: máy nào bật
    // `commit.gpgsign` thì mọi `git commit` dưới đây fail và bài kiểm sập.
    git(dir, ['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(dir, 'shared.jsonl'), '{"at":"goc"}\n', 'utf8');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'goc']);

    git(dir, ['checkout', '-q', '-b', 'feature']);
    if (withRuleOnBranch) {
      writeFileSync(join(dir, '.gitattributes'), rule, 'utf8');
      git(dir, ['add', '.']);
      git(dir, ['commit', '-q', '-m', 'nhanh mang luat truoc']);
    }
    writeFileSync(join(dir, 'shared.jsonl'), '{"at":"goc"}\n{"at":"nhanh"}\n', 'utf8');
    git(dir, ['commit', '-qam', 'nhanh them dong']);

    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, '.gitattributes'), rule, 'utf8');
    writeFileSync(join(dir, 'shared.jsonl'), '{"at":"goc"}\n{"at":"main"}\n', 'utf8');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'main mang luat va them dong']);

    git(dir, ['checkout', '-q', 'feature']);
    const merge = spawnSync('git', ['merge', '--no-edit', 'main'], { cwd: dir, encoding: 'utf8' });
    return merge.status === 0 ? 'sạch' : 'xung đột';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function runUnionExperiment(): UnionRuns {
  return {
    ruleArrivesWithMerge: runUnionCase(false),
    ruleAlreadyOnBranch: runUnionCase(true),
  };
}

// ───────────────────────────────────────────────────────── sổ bài kiểm ──

export interface AutoCheck {
  id: string;
  code: string;
  run: (root: string) => CheckOutcome;
}

export const AUTO_CHECKS: AutoCheck[] = [
  {
    id: 'session-trailer-on-branch',
    code: 'G14',
    run: (root) => judgeTrailerEvidence(collectCommits(root)),
  },
  {
    id: 'union-merge-order',
    code: 'G17',
    run: () => judgeUnionRuns(runUnionExperiment()),
  },
];

export const AUTO_CHECK_IDS: string[] = AUTO_CHECKS.map((check) => check.id);

// ──────────────────────────────────────────────────────────────── main ──

function main(): void {
  const root = process.cwd();
  const ledgerPath = join(root, 'docs', 'assumptions.md');
  if (!existsSync(ledgerPath)) {
    process.stderr.write('Thiếu docs/assumptions.md (CHARTER mục 11).\n');
    process.exit(1);
  }

  const entries = parseLedger(readFileSync(ledgerPath, 'utf8'));
  const byCode = new Map(entries.map((entry) => [entry.code, entry]));
  const declared = entries.filter((entry) => entry.autoCheck);
  const needsHuman = entries.filter((entry) => !entry.autoCheck);

  const reports: CheckReport[] = [];
  const broken: string[] = [];

  for (const entry of declared) {
    const check = AUTO_CHECKS.find((candidate) => candidate.id === entry.autoCheck);
    if (!check) {
      // Sổ khai một bài kiểm không tồn tại. `pnpm assumptions` cũng bắt lỗi
      // này, nên tới được đây là bất thường — báo, không đoán.
      broken.push(`⚠ ${entry.code} · KHAI SAI — sổ khai \`${entry.autoCheck}\` nhưng không có bài kiểm nào tên thế.`);
      process.exitCode = 1;
      continue;
    }
    try {
      reports.push({ code: entry.code, checkId: check.id, ...check.run(root) });
    } catch (error) {
      // Một bài kiểm hỏng KHÔNG được nuốt cả báo cáo. Ví dụ thật: clone nông
      // không có `refs/remotes/origin/main` thì bài kiểm G14 ném lỗi, và nếu
      // lỗi thoát ra khỏi đây thì mất luôn kết quả G17 lẫn danh sách "cần
      // người" — cả lượt chạy thứ Hai im lặng vì một bài kiểm.
      broken.push(
        `⚠ ${entry.code} · \`${check.id}\` · KHÔNG CHẠY ĐƯỢC — ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  }

  const out: string[] = ['# Chạy lại bài kiểm của sổ giả định', ''];
  for (const report of reports) {
    const mark = report.observedNothing ? '◦' : report.verdict === 'khớp' ? '✓' : '✗';
    const verdict = report.observedNothing ? 'chưa quan sát được' : `**${report.verdict}**`;
    out.push(`${mark} ${report.code} · \`${report.checkId}\` · ${verdict} — ${report.observed}`);
    for (const line of report.evidence) out.push(`    ${line}`);
    out.push('');
  }
  if (broken.length > 0) out.push(...broken, '');

  out.push(
    `Cần người, không tự kiểm được: ${needsHuman.map((entry) => entry.code).join(', ') || '(không có)'}.`,
    '',
  );

  const changed = reports.filter((report) => report.verdict === 'sai');

  for (const report of changed) {
    const entry = byCode.get(report.code)!;
    const issue = formatDecisionIssue(entry, report);
    out.push(
      '─'.repeat(72),
      `✗ ${report.code} ĐỔI TRẠNG THÁI. Mở issue dưới đây, nhãn \`decision\` + \`reversible\` (CHARTER 11.1):`,
      '',
      `Tiêu đề: ${issue.title}`,
      '',
      issue.body,
      '',
      '─'.repeat(72),
      '',
    );
  }

  process.stdout.write(`${out.join('\n')}\n`);
  if (changed.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
