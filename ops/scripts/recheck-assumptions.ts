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
import { readRunLogs, type RunLogLine } from '@crux/kernel';

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
  // Mục `I-012`: commit của workflow `sync-workflows` (chép `ops/workflows/**`
  // sang `.github/workflows/`, CLAUDE.md mục 4) — máy sinh, không đi qua agent.
  if (/^chore: sync workflows from ops\/workflows\b/.test(subject)) return true;
  // Mục `I-012`: merge tay "Gộp main vào <nhánh>" / "Gộp origin/main vào
  // <nhánh>" (agent tự gõ message thay vì để git sinh mặc định, ví dụ khi
  // nhận PR ở phụ lục P1 bước 2 ca `aborted-ineligible`). Cùng bản chất cơ
  // học với hai luật trên — chỉ nối lịch sử, không phải nội dung — nhưng mốc
  // neo là "main"/"origin/main" đứng NGAY sau "Gộp", không phải chữ
  // "Gộp … vào" nói chung: nới rộng hơn thế biến danh sách trắng thành danh
  // sách đen trá hình, và trật đúng ca `isToolCommit(!"Gộp hai mô hình định
  // lượng vào một bảng")` ở test bên dưới.
  if (/^Gộp (origin\/)?main(\s*\([0-9a-f]{4,40}\))? vào /.test(subject)) return true;
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
 *
 * Nhánh "không có gì để quan sát" ở đây gộp **hai** ca (mục `I-007`): đã có
 * ref `origin/claude/*` nhưng không commit nào của chúng nằm ngoài `main`
 * trong cửa sổ ngày, HOẶC kho thật sự không còn nhánh `claude/*` nào —
 * `collectCommits` đã hỏi thẳng remote bằng `listRemoteClaudeBranches` và
 * xác nhận rỗng trước khi trả `[]`. Trường hợp "chưa quét được" (fetch hoặc
 * chính `ls-remote` lỗi) không đi qua đây — `collectCommits` ném, và
 * `main()` xếp nó vào `broken` (mục `I-005`, `I-007`).
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
        'Không quan sát được gì KHÁC với quan sát được và thấy đúng.',
        'Hai lý do có thể: đã có ref `origin/claude/*` để quét nhưng mọi commit của chúng đã vào `main` ' +
          'hoặc đã quá cửa sổ ngày, HOẶC kho thật sự không còn nhánh `claude/*` nào (mọi PR đã merge và ' +
          'nhánh đã xoá) — `git ls-remote` xác nhận rỗng (mục `I-007`). `collectCommits` ném khi chưa quét ' +
          'được gì, không phải khi quan sát thấy rỗng thật (mục `I-005`, `I-007`).',
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
 * Kéo về **cả hai** đầu vào của phép quét trước khi quét — mục `I-005`:
 * `refs/remotes/origin/claude/*` (tập cần quét) và `refs/remotes/origin/main`
 * (phép loại `^main`). Thiếu một trong hai là một lỗi khác nhau, và cả hai
 * đều đã xảy ra thật.
 *
 * **Thiếu `claude/*`:** cả ba routine chạy trong một clone mới của phiên
 * cloud, và clone đó chỉ `git fetch origin main`. Không có ref
 * `origin/claude/*` nào, nên bài kiểm quét một tập rỗng và kết luận "không
 * có gì để quan sát" — trong khi thật ra nó **chưa quét được gì**. Đó là
 * chế độ chạy mặc định, không phải trường hợp hiếm.
 *
 * **Thiếu `main` mới:** nguy hiểm hơn, vì nó cho ra **số sai** chứ không
 * phải im lặng. `origin/main` của clone đứng yên ở lúc clone, còn các nhánh
 * `claude/*` được kéo về **tại thời điểm chạy** — mà bước 0 của phụ lục P3
 * thường xuyên gộp `main` mới vào các nhánh PR rồi push. Những commit
 * **squash** của `main` nằm trong nhánh PR nhưng chưa có trong `origin/main`
 * cũ thì lọt qua phép loại `^refs/remotes/origin/main`, và commit squash
 * của GitHub **mất** trailer `Claude-Session` (xem chú thích của
 * `judgeTrailerEvidence`). Kết quả: G14 ra `sai` giả, và `main()` in sẵn
 * thân issue `🤖 [QĐ]` cho một giả định chẳng hề đổi trạng thái — tức là
 * gọi chủ dự án vì một con số sai. Tái hiện được bằng một clone
 * `--single-branch --branch main` của chính repo này.
 *
 * Phụ lục P3 bước 4 không ghi "phải fetch trước", nên chỗ sửa là ở đây —
 * bài kiểm tự lo lấy đầu vào của mình, thay vì để một luật chỉ nằm trong
 * tài liệu mà không ai chạy.
 *
 * Fetch hỏng thì **ném**, không nuốt: `main()` bắt lỗi và xếp bài kiểm vào
 * nhánh `broken` (`⚠ … KHÔNG CHẠY ĐƯỢC`). "Chưa quét được" phải kêu, vì nó
 * là nhóm lỗi Z — hỏng mà mọi chỉ báo đều xanh.
 */
function fetchScanInputs(root: string): void {
  git(root, [
    'fetch',
    '--quiet',
    '--prune',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/claude/*:refs/remotes/origin/claude/*',
  ]);
}

/**
 * Hỏi thẳng **remote** (không qua fetch cục bộ) xem `origin` có nhánh nào
 * khớp `refs/heads/claude/*` không. Mục `I-007`: khi `for-each-ref` cục bộ
 * sau fetch rỗng, rỗng đó có hai nghĩa khác nhau — "chưa quét được" (fetch
 * hỏng, thiếu quyền đọc nhánh) hay "kho thật sự không còn nhánh nào" (mọi PR
 * đã merge và nhánh đã xoá) — và chỉ cách hỏi thẳng remote mới tách được hai
 * ca đó. `ls-remote` không phụ thuộc trạng thái fetch cục bộ, nên nó là
 * nguồn sự thật độc lập.
 *
 * Ném khi chính `ls-remote` lỗi (mạng, quyền đọc) — đó mới là "chưa quét
 * được" thật. Trả mảng rỗng khi `ls-remote` CHẠY ĐƯỢC và không thấy nhánh
 * nào — đó là một quan sát hợp lệ, không phải lỗi.
 */
export function listRemoteClaudeBranches(root: string): string[] {
  const result = spawnSync('git', ['ls-remote', '--heads', 'origin', 'refs/heads/claude/*'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `git ls-remote --heads origin refs/heads/claude/* thất bại: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export interface GhOpenPr {
  headRefName: string;
}

/**
 * Tên nhánh (`headRefName`) của mọi PR đang **mở** — không phải `merged`,
 * không phải `closed`. Mục `I-012`: đây là "câu hỏi trả lời được" mà
 * `collectCommits` dùng để tách nhánh còn sống khỏi nhánh đã squash-merge
 * còn sót trên remote (xem chú thích của `collectCommits`).
 *
 * Dùng `gh` như `ops/scripts/update-metrics.ts` (`fetchMergedPrs`) đã dùng —
 * cùng một quy ước gọi lệnh trong repo, không phải cách mới. `gh` hỏng
 * (thiếu quyền, chưa đăng nhập) thì NÉM, không nuốt: bên gọi (`collectCommits`
 * rồi `main()`) đã có đường xếp lỗi này vào `broken`, và một danh sách nhánh
 * sống sai (vì im lặng coi như rỗng) sẽ làm G14 báo nhầm cả hai chiều.
 */
export function fetchOpenPrBranches(): Set<string> {
  const result = spawnSync(
    'gh',
    ['pr', 'list', '--state', 'open', '--json', 'headRefName', '--limit', '500'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`gh pr list thất bại: ${result.stderr || result.stdout}`);
  }
  const prs = JSON.parse(result.stdout) as GhOpenPr[];
  return new Set(prs.map((pr) => pr.headRefName));
}

/**
 * Commit trên các nhánh `origin/claude/*` **còn sống** mà **chưa vào
 * `main`**, trong `days` ngày gần nhất. Xem chú thích của
 * `judgeTrailerEvidence` về lý do loại `main` ra: squash làm mất trailer,
 * không phải agent làm mất.
 *
 * Rỗng ở `for-each-ref` cục bộ sau fetch không tự nó là một quan sát — nó có
 * thể là "kho không có nhánh nào" hoặc "clone chưa kéo nhánh nào về", và
 * đoán bừa một trong hai chính là lỗi của mục `I-005`. Mục `I-007` tách hai
 * ca đó bằng `listRemoteClaudeBranches` (hỏi thẳng remote, không qua fetch
 * cục bộ): remote cũng rỗng thì đây là quan sát hợp lệ, trả `[]`; remote
 * KHÔNG rỗng (fetch cục bộ lệch với remote) hoặc chính `ls-remote` lỗi thì
 * ném, để `main()` xếp vào `broken` và làm `process.exitCode = 1` — chưa
 * quét được phải kêu, không được im lặng thành `◦ chưa quan sát được`.
 *
 * Mục `I-012`: một ref `refs/remotes/origin/claude/*` tồn tại KHÔNG có
 * nghĩa nhánh đó còn sống. GitHub merge kiểu **squash** (đã quan sát thật ở
 * `judgeTrailerEvidence`) để lại nguyên xi lịch sử của nhánh đã merge đứng
 * mãi mãi ngoài `main` — commit squash mang nội dung, không mang SHA cũ.
 * Quan sát thật (lượt `crux-integrator` 2026-09-22 02:05): 10/14 commit
 * "thiếu trailer" nằm trên đúng MỘT nhánh vậy, `claude/platform/P-009`
 * (PR `#9` đã merge, nhánh chưa xoá) — kể cả ba commit của CHÍNH chủ dự án
 * từ trước khi CLAUDE.md tồn tại. Phạm vi quét vì thế phải bớt lại còn
 * nhánh có PR **mở**: phụ lục P1 bước 4 luôn mở PR nháp ngay lúc tạo nhánh,
 * nên một nhánh không còn PR mở là nhánh đã xong việc (PR đã merge/đóng)
 * hoặc chưa từng qua bước 4 — cả hai đều ngoài phạm vi G14.
 *
 * Đây KHÔNG phải nới `isToolCommit` cho tới khi hết đỏ (CLAUDE.md mục 13,
 * "vá sản phẩm"): `isToolCommit` xét TỪNG COMMIT theo message, còn phép lọc
 * này xét TỪNG NHÁNH theo trạng thái PR — thu hẹp đúng phạm vi "commit của
 * agent, trên nhánh còn sống" mà tiêu chí xong `I-012` đòi, không phải thêm
 * chữ ký để nhận diện commit đã có.
 */
export function collectCommits(
  root: string,
  days = 14,
  openPrBranches: () => Set<string> = fetchOpenPrBranches,
): CommitTrailerInfo[] {
  fetchScanInputs(root);

  const refs = git(root, ['for-each-ref', '--format=%(refname)', 'refs/remotes/origin/claude/'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (refs.length === 0) {
    const remoteBranches = listRemoteClaudeBranches(root);
    if (remoteBranches.length === 0) {
      // Kho thật sự không còn nhánh claude/* nào — quan sát hợp lệ.
      return [];
    }
    throw new Error(
      'origin CÓ nhánh khớp `refs/heads/claude/*` nhưng fetch cục bộ không thấy ref nào sau khi fetch — ' +
        'CHƯA QUÉT ĐƯỢC, không phải "kho không còn nhánh nào". Kiểm remote `origin` và quyền đọc nhánh.',
    );
  }

  // I-012: giữ lại đúng nhánh còn PR mở. `ref` có dạng
  // `refs/remotes/origin/claude/<lane>/<id>`; `headRefName` của `gh pr list`
  // là `claude/<lane>/<id>` — bỏ đúng tiền tố remote, không đoán phần còn lại.
  const openBranches = openPrBranches();
  const liveRefs = refs.filter((ref) => openBranches.has(ref.replace(/^refs\/remotes\/origin\//, '')));

  if (liveRefs.length === 0) {
    // Mọi nhánh khớp đều đã hết PR mở (merge hoặc đóng) — quan sát hợp lệ,
    // không phải lỗi: không còn gì của agent, trên nhánh còn sống, để quét.
    return [];
  }

  const format = ['%H', '%s', '%(trailers:key=Claude-Session,valueonly=true)'].join(FIELD);
  const raw = git(root, [
    'log',
    `--since=${days}.days.ago`,
    `--format=${format}${RECORD}`,
    ...liveRefs,
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

// ───────────────────────────────── G1 · đội worker đang chạy thật ──

/** Hai dòng log cách nhau quá ngần này thì thuộc hai lượt chạy khác nhau. */
export const RUN_CLUSTER_MINUTES = 50;

/** Cửa sổ quét, tính lùi từ dòng log MỚI NHẤT (không phải từ `now` — xem `collectRoutineRuns`). */
export const FLEET_WINDOW_DAYS = 7;

/**
 * Số worker của phương án dự phòng Plan B trong sổ G1 và trong phụ lục P1
 * ("Mặc định: 2 worker"). Quan sát được ≤ ngần này tức là đội đã tụt về
 * dự phòng, và đó là điều bài kiểm phải kêu.
 */
export const PLAN_B_WORKERS = 2;

/** `crux-worker-2`, `crux-integrator`, `crux-digest` — tên routine của phụ lục P1/P2/P3. */
const ROUTINE_MENTION = /crux-(?:worker-\d+|digest|integrator)/g;

export interface RoutineRuns {
  /** Tên routine → mốc bắt đầu của từng lượt, đã sắp tăng dần. */
  runs: Map<string, number[]>;
  /** Số dòng log có nhắc tên routine trong cửa sổ. 0 nghĩa là không có gì để quan sát. */
  mentions: number;
  /**
   * Số dòng log bị loại vì `at` không đọc được. Bỏ im lặng thì số lượt tụt
   * mà không dòng nào nói vì sao — bỏ **hết** ra `◦` (không xanh giả), nhưng
   * bỏ **một phần** là đúng nhóm lỗi Z. Nên nó được đếm và in vào `evidence`.
   */
  unparsedAt: number;
}

/**
 * Đếm các lượt routine quan sát được từ chính `ops/logs/**`, nguồn mà bất
 * biến I8 buộc mọi lượt chạy phải ghi vào.
 *
 * **Giới hạn khai trước, vì nó quyết định chiều hỏng của bài kiểm:**
 *
 * 1. **Log đếm THIẾU, không bao giờ đếm THỪA.** Phụ lục P1 bước 3 bảo worker
 *    không nhận được mục nào thì in `idle` và kết thúc **không commit gì** —
 *    lượt đó không để lại dòng log nào. Nên mọi con số ở đây là **cận dưới**:
 *    "đo được N worker" nghĩa là "ít nhất N", không phải "đúng N". Kết luận
 *    duy nhất rút ra được vì thế là kết luận theo chiều ≥, và đó đúng là
 *    chiều mà G1 cần (2 worker hay 3 worker).
 * 2. Tên routine nằm trong **`note`** dạng văn xuôi, không có trường riêng.
 *    Nếu quy ước ghi `note` đổi, phép đếm về 0 và bài kiểm ra
 *    `observedNothing` (dấu `◦`), **không** ra `khớp` — tức là nó im lặng
 *    thành "chưa quan sát được", không im lặng thành "vẫn ổn". Đây là cùng
 *    bài học fail-open của `isToolCommit` ở trên.
 * 3. **Một dòng log tính cho ĐÚNG MỘT routine: tên xuất hiện đầu tiên.**
 *    Đây không phải chi tiết vụn — bản đầu đếm *mọi* tên nhắc tới trong
 *    `note`, và nó sai ngay ở dòng log đầu tiên mà chính mục `VF-G1` ghi:
 *    dòng đó **kể lại** số lượt của cả bốn routine, nên nó tự tính thành
 *    một lượt cho từng routine và thổi cả bốn con số lên. Báo cáo của
 *    worker nhắc tên routine khác là chuyện bình thường (bước 0 của phụ
 *    lục P3 luôn nhắc `crux-integrator`), nên lỗi này sẽ lặp lại mãi.
 *
 *    Luật "tên đầu tiên" khớp quy ước `note` đang dùng thật — dòng log mở
 *    bằng chính routine viết nó (`Lượt worker crux-worker-1 …`,
 *    `… (phụ lục P1 bước 3-4, routine crux-worker-3)`) — và nó sai theo
 *    chiều **an toàn**: nó chỉ có thể làm phép đếm NHỎ đi, tức là chỉ có
 *    thể đẩy bài kiểm về phía `sai`, không bao giờ che được một đội đã tụt
 *    về Plan B.
 *
 * Cửa sổ neo vào dòng log **mới nhất** chứ không vào `now`: một lần chạy lại
 * trên bản clone cũ phải cho đúng kết quả như lúc nó được ghi, nếu không thì
 * bài kiểm tự chuyển sang `sai` chỉ vì repo nằm yên vài ngày — một kết luận
 * không dính gì tới G1.
 */
export function collectRoutineRuns(lines: readonly RunLogLine[]): RoutineRuns {
  const parsed = lines.map((line) => ({ at: Date.parse(line.at), note: line.note ?? '' }));
  const stamped = parsed.filter((row) => Number.isFinite(row.at));
  const unparsedAt = parsed.length - stamped.length;

  const newest = stamped.reduce((max, row) => (row.at > max ? row.at : max), Number.NEGATIVE_INFINITY);
  const floor = newest - FLEET_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const seen = new Map<string, Set<number>>();
  let mentions = 0;
  for (const row of stamped) {
    if (row.at < floor) continue;
    // CHỈ tên routine ĐẦU TIÊN trong `note` — xem `authorOfLine` dưới đây.
    const author = row.note.match(ROUTINE_MENTION)?.[0];
    if (author === undefined) continue;
    mentions += 1;
    let bucket = seen.get(author);
    if (bucket === undefined) seen.set(author, (bucket = new Set()));
    bucket.add(row.at);
  }

  const gap = RUN_CLUSTER_MINUTES * 60 * 1000;
  const runs = new Map<string, number[]>();
  for (const [name, stamps] of seen) {
    const sorted = [...stamps].sort((a, b) => a - b);
    const starts: number[] = [];
    for (const at of sorted) {
      if (starts.length === 0 || at - starts[starts.length - 1]! > gap) starts.push(at);
    }
    runs.set(name, starts);
  }

  return { runs, mentions, unparsedAt };
}

/**
 * Đọc log cho bài kiểm G1, và **phân biệt "chưa quét được" với "quét rồi
 * không thấy gì"** (mục `I-005`).
 *
 * `listRunLogs`/`listLogFiles` của kernel trả mảng rỗng khi `ops/logs/`
 * không tồn tại — đúng cho bên gọi bình thường, sai cho một bài kiểm: thiếu
 * cả thư mục log và có thư mục log rỗng sẽ in ra y hệt nhau (dấu `◦`), tức
 * là bài kiểm không chạy được trông như bài kiểm đã chạy và không thấy gì.
 * Ném lỗi ở đây để `main()` xếp nó vào `⚠ … KHÔNG CHẠY ĐƯỢC` và thoát khác 0.
 */
export function readFleetLogs(root: string): RunLogLine[] {
  const logsDir = join(root, 'ops', 'logs');
  if (!existsSync(logsDir)) {
    throw new Error(`không có thư mục ${logsDir} — không quét được lượt routine nào (bất biến I8 đòi thư mục này tồn tại)`);
  }
  return readRunLogs(logsDir);
}

/** Khoảng cách giữa các lượt, theo giờ, đã sắp tăng dần. */
function gapsInHours(starts: readonly number[]): number[] {
  return starts.slice(1).map((at, index) => (at - starts[index]!) / 3600000).sort((a, b) => a - b);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
}

/**
 * G1 nói: tài khoản có Claude Code Projects, nên chạy được cấu hình 3 worker
 * của phụ lục P1 thay vì Plan B 2 worker.
 *
 * Bài kiểm này **không** kiểm được vế "có Projects hay không" — đó là trang
 * cấu hình tài khoản, chỉ chủ dự án thấy (mục `VF-G1`, issue #5). Nó canh
 * đúng **hệ quả vận hành** mà phụ lục P1 treo lên G1, và là thứ duy nhất
 * quan sát được từ trong repo: **đội worker đang chạy thật có mấy con.**
 *
 * Vì thế chiều kết luận hẹp và có chủ đích:
 * - ≥ 3 worker quan sát được → `khớp`: cấu hình 3 worker đang chạy, dự phòng
 *   Plan B chưa phải dùng tới. (Không suy ra "có Projects": ba routine
 *   hourly rời nhau cũng cho đúng quan sát này.)
 * - 1–2 worker, mà cửa sổ CÓ dòng nhắc routine → `sai`: đội đã tụt về Plan B.
 *   Lúc đó phụ lục P1 và sổ G1 đang ghi một cấu hình không còn tồn tại, và
 *   `main()` in sẵn thân issue `🤖 [QĐ]`.
 * - Không dòng nào nhắc routine → `observedNothing`, không phải `khớp`.
 */
export function judgeWorkerFleet(collected: RoutineRuns): CheckOutcome {
  const workers = [...collected.runs.keys()].filter((name) => name.startsWith('crux-worker-')).sort();
  const evidence: string[] = [];

  for (const name of [...collected.runs.keys()].sort()) {
    const starts = collected.runs.get(name)!;
    const mid = median(gapsInHours(starts));
    const cadence = mid === null ? 'một lượt, chưa đo được nhịp' : `nhịp giữa các lượt (trung vị) ${mid.toFixed(1)} giờ`;
    evidence.push(`\`${name}\`: ${starts.length} lượt quan sát được, ${cadence}.`);
  }
  evidence.push(
    `Cửa sổ ${FLEET_WINDOW_DAYS} ngày tính lùi từ dòng log mới nhất; ${collected.mentions} dòng log có nhắc tên routine.`,
    'Con số là **cận dưới**: lượt worker ra `idle` không commit gì (phụ lục P1 bước 3) nên không để lại dòng log nào.',
  );
  if (collected.unparsedAt > 0) {
    evidence.push(`⚠ ${collected.unparsedAt} dòng log bị loại vì \`at\` không đọc được — số lượt ở trên đã tụt đi vì lý do KHÔNG dính gì tới G1.`);
  }

  if (collected.mentions === 0) {
    return {
      verdict: 'khớp',
      observed: 'Không dòng log nào trong cửa sổ nhắc tên routine — chưa quan sát được đội worker.',
      evidence,
      observedNothing: true,
    };
  }

  if (workers.length <= PLAN_B_WORKERS) {
    return {
      verdict: 'sai',
      observed: `Chỉ quan sát được ${workers.length} worker (${workers.join(', ') || 'không có'}) — đội đã tụt về mức dự phòng Plan B.`,
      evidence: [
        ...evidence,
        `Sổ G1 và phụ lục P1 đang ghi cấu hình ≥ ${PLAN_B_WORKERS + 1} worker; quan sát không còn đỡ được con số đó.`,
      ],
    };
  }

  return {
    verdict: 'khớp',
    observed: `Quan sát được ${workers.length} worker đang chạy thật (${workers.join(', ')}) — cấu hình ≥ ${PLAN_B_WORKERS + 1} worker, không phải dự phòng Plan B.`,
    evidence,
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
    id: 'worker-fleet-cadence',
    code: 'G1',
    run: (root) => judgeWorkerFleet(collectRoutineRuns(readFleetLogs(root))),
  },
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
