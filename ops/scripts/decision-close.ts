#!/usr/bin/env node
/**
 * Mục `platform/P-050` — **một `[QĐ]` tự đóng khi việc gắn với nó đã xong.**
 *
 * ## Chỉ dẫn sinh ra file này
 *
 * Chủ dự án, nguyên văn trên `#131` lúc `2026-09-24T23:54:32Z` (mục 3, sao
 * sang `#251` làm **D3**):
 *
 * > Đóng #234, #175, #169, #88, #70, #73; kèm link PR hoặc commit chứng minh
 * > đã xử lý. Từ nay [QĐ] tự đóng khi việc gắn với nó đã xong.
 *
 * Vế đầu là sáu lần đóng bằng tay, làm một lần rồi hết. Vế sau — *"từ nay"* —
 * là một luật, và luật thì phải có máy giữ: chính chủ dự án đặt ra chuẩn đó
 * trong câu trả lời `#169` (*"tất cả thành bài kiểm máy khoá được, không phải
 * lời dặn"*). File này là phần quyết định của vế sau.
 *
 * ## Vì sao chỗ hỏng này thuộc nhóm Z
 *
 * Một `[QĐ]` đã được xử lý mà vẫn mở **không làm gì đỏ**. `pnpm check` xanh,
 * CI xanh, `main` xanh. Nó chỉ làm một chuyện: nằm trong danh sách "cần anh
 * quyết" của bản tin sáng (CHARTER 2.5) như thể còn chờ người, nên con số
 * *"nút thắt là máy hay người"* ra sai và thước đo *"thời gian của anh"*
 * (CHARTER 1.3) đếm thừa. Đúng hình dạng mục **C4** của `#251`: *"bản tin báo
 * nút thắt người = 2 trong khi thực tế nhiều hơn"*, chỉ ngược dấu.
 *
 * Số đo lúc nhận mục (2026-09-25 ~02:4xZ): **21 issue nhãn `decision` đang
 * mở**, trong đó ít nhất 5 đã xử lý xong từ 1–4 ngày trước — `#88` có câu
 * *"Đóng issue"* của chính chủ dự án nằm đó **10 giờ** mà không ai đóng.
 *
 * ## Luật: mặc định là GIỮ, chỉ đóng khi có bằng chứng máy đọc được
 *
 * Hướng lệch ở đây không đối xứng, nên luật cũng không:
 *
 * - Đóng thừa một `[QĐ]` còn đang chờ người = **xoá một câu hỏi chặn đường**.
 *   Chủ dự án không bao giờ thấy nó nữa, vì bản tin chỉ đọc issue đang mở.
 * - Giữ thừa một `[QĐ]` đã xong = một dòng rác trong bản tin, thấy ngay và
 *   sửa được ở lượt sau.
 *
 * Nên `keep` là mặc định, và mỗi `close` **phải** mang `evidence` không rỗng.
 * `evidence` rỗng mà `verdict: 'close'` là trạng thái không tồn tại được —
 * `assertEvidence` ném, và bài kiểm khoá đúng điều đó.
 *
 * ## Ba nguồn bằng chứng, và thứ tự của chúng
 *
 * 1. **Chủ dự án nói xong** — comment KHÔNG mở đầu 🤖 của chính chủ dự án
 *    trên issue nhãn `decision`, mang một trong các câu ở `OWNER_DONE_PHRASES`.
 *    Đây là nguồn mạnh nhất: `CLAUDE.md` mục 5 xếp đúng loại comment này vào
 *    hàng **lệnh**, không phải dữ liệu.
 * 2. **PR mà issue nêu đã merge hết** — `linkedPrNumbers` đọc tên PR ra khỏi
 *    tiêu đề và thân issue, bên gọi đo trạng thái từng PR, và chỉ khi **mọi**
 *    PR được nêu đều `merged` thì mới tính là xong.
 * 3. **Có `docs/decisions/D-Cxx.md` ghi issue này là nguồn** — `CLAUDE.md`
 *    mục 14 đòi *"ghi quyết định lâu dài vào `docs/decisions/D-Cxx.md` rồi
 *    đóng issue"*, nên sự tồn tại của file đó **là** vế trước của câu ấy.
 *
 * ## Một PR bị đóng mà KHÔNG merge chặn nguồn 2 và 3
 *
 * `closed && !merged` nghĩa là bản thực hiện bị bác. Quyết định chưa xong, nó
 * vừa quay về vạch xuất phát — đóng issue lúc đó là mất đúng câu hỏi đang cần
 * hỏi lại. Chặn này **không** đè được nguồn 1: chủ dự án nói xong thì xong,
 * kể cả khi đường đi tới đó đã đổi.
 */

import { AGENT_PREFIX } from './agent-prefix.ts';

/** Nhãn đánh dấu một issue là `[QĐ]` (CHARTER 2.3, `CLAUDE.md` mục 14). */
export const DECISION_LABEL = 'decision';

/**
 * Các câu của chủ dự án được đọc thành *"việc này xong rồi"*.
 *
 * Danh sách này **cố ý hẹp**, và đó là tính năng chứ không phải thiếu sót: mở
 * rộng nó bằng cách đoán (`/xong/`, `/ok/`, `/rồi/`) sẽ bắt cả những câu nói
 * về một phần việc khác trong cùng comment, và hướng lệch đó là hướng đắt
 * (xem docblock đầu file). Ba câu dưới đây lấy từ **ca thật** đo được trên
 * repo, không phải từ tưởng tượng:
 *
 * | Câu | Issue | Nguyên văn |
 * |---|---|---|
 * | `đóng issue` | `#88` | *"C: xác nhận, không hoàn tác. Đóng issue."* |
 * | `đã thực hiện qua` | `#169`, `#175` | *"Đã thực hiện qua #168"* |
 * | `đã xử lý xong` | — | dạng chủ dự án đã dùng ở các bản tin trước |
 *
 * Thêm câu mới thì thêm **kèm một ca thật**, đúng luật `A10` của `#251`:
 * chỉ thêm luật khi có một lỗi đã thật sự xảy ra.
 */
export const OWNER_DONE_PHRASES: readonly RegExp[] = [
  /đóng\s+issue/i,
  /đã\s+thực\s+hiện\s+qua/i,
  /đã\s+xử\s+lý\s+xong/i,
];

/** Một thân issue hoặc comment, đúng hình dạng `gh issue view --json` trả về. */
export interface DecisionComment {
  author: string;
  body: string;
  createdAt: string;
}

/**
 * Trạng thái **đã đo** của một PR mà issue nêu tên.
 *
 * Bên gọi đo và truyền vào; file này không bao giờ tự gọi API. Cùng lẽ với
 * `ops/scripts/alert-escalation.ts`: tách phần quyết định ra khỏi phần gom dữ
 * liệu thì `pnpm test` kiểm được nó ở chỗ rẻ nhất, còn workflow chỉ còn việc
 * gom và đăng.
 */
export interface LinkedPr {
  number: number;
  merged: boolean;
  /** `true` khi PR đã đóng — kể cả khi `merged` cũng `true`. */
  closed: boolean;
}

export interface DecisionIssue {
  number: number;
  title: string;
  body: string;
  labels: readonly string[];
  /** Thân issue KHÔNG nằm trong đây; truyền riêng qua `body`. */
  comments: readonly DecisionComment[];
  /** Trạng thái các PR mà `linkedPrNumbers` tìm ra, đã đo bởi bên gọi. */
  linkedPrs: readonly LinkedPr[];
  /**
   * `true` khi trên `main` có một `docs/decisions/D-Cxx.md` ghi issue này là
   * nguồn. Bên gọi dò; file này không đọc đĩa.
   */
  hasDecisionDoc: boolean;
}

export type CloseVerdict = 'close' | 'keep';

export interface CloseDecision {
  issue: number;
  verdict: CloseVerdict;
  reason: string;
  /**
   * Bằng chứng máy đọc được, mỗi phần tử một dòng cho comment đóng issue.
   * **Rỗng khi và chỉ khi `verdict` là `keep`** — chỉ dẫn của chủ dự án đòi
   * *"kèm link PR hoặc commit chứng minh đã xử lý"*, nên một lần đóng không
   * có bằng chứng là một lần đóng không được phép.
   */
  evidence: readonly string[];
}

/**
 * Các số PR mà issue nêu tên, theo thứ tự gặp, không trùng.
 *
 * Chỉ bắt `#N` đi **ngay sau** chữ `PR`, chấp cả dạng liên kết Markdown
 * (`PR [#233](…)`). Bắt mọi `#N` trong thân issue sẽ nuốt cả những issue được
 * trích dẫn làm bối cảnh — thân `[QĐ]` nào cũng dẫn vài issue khác — và một
 * issue không bao giờ `merged`, nên nguồn 2 sẽ không bao giờ đủ điều kiện.
 * Đo được trên ca thật: `#234` dẫn `#233`, `#232`, `#226`, `#229`, `#39`,
 * `#84` và `#112`, mà chỉ `#233` là PR nó đang chờ.
 */
export function linkedPrNumbers(...sources: readonly string[]): number[] {
  const found: number[] = [];
  for (const source of sources) {
    for (const match of source.matchAll(/\bPR\s*\[?#(\d+)/gi)) {
      const number = Number(match[1]);
      if (!found.includes(number)) found.push(number);
    }
  }
  return found;
}

/**
 * Comment này có phải lời *"xong rồi"* của chủ dự án không?
 *
 * Cùng phép phân biệt người/máy với `isStopComment` của
 * `ops/invariants.merge-gate.ts`, và cùng lý do: agent dùng chính danh tính
 * GitHub của chủ dự án (CHARTER 3.1), nên tác giả một mình không phân biệt
 * được. Quy ước 🤖 (`CLAUDE.md` mục 5) là dấu vết duy nhất.
 */
export function isOwnerDoneComment(comment: DecisionComment, owner: string): boolean {
  if (comment.author.toLowerCase() !== owner.toLowerCase()) return false;
  const body = comment.body.trim();
  if (body.startsWith(AGENT_PREFIX)) return false;
  return OWNER_DONE_PHRASES.some((phrase) => phrase.test(body));
}

/**
 * Ném khi một phán quyết `close` không mang bằng chứng, hoặc một `keep` lại
 * mang bằng chứng.
 *
 * Đây không phải phòng xa: bất biến *"close ⇒ có bằng chứng"* là toàn bộ chỗ
 * an toàn của mục này, và một bất biến chỉ được nhắc trong docblock là một
 * bất biến sẽ bị phá ở lần sửa thứ ba. Ném ngay tại chỗ dựng ra phán quyết
 * thì bên gọi không bao giờ nhận được một phán quyết sai hình dạng.
 */
export function assertEvidence(decision: CloseDecision): CloseDecision {
  if (decision.verdict === 'close' && decision.evidence.length === 0) {
    throw new Error(
      `Phán quyết \`close\` cho #${decision.issue} không mang bằng chứng — ` +
        'chỉ dẫn của chủ dự án đòi kèm link PR hoặc commit chứng minh đã xử lý.',
    );
  }
  if (decision.verdict === 'keep' && decision.evidence.length > 0) {
    throw new Error(
      `Phán quyết \`keep\` cho #${decision.issue} lại mang bằng chứng — ` +
        'hai trường nói ngược nhau thì bên đọc không biết tin trường nào.',
    );
  }
  return decision;
}

/** Một `[QĐ]` có tự đóng được chưa, và bằng chứng nào cho phép. */
export function decideDecisionClose(issue: DecisionIssue, owner: string): CloseDecision {
  const keep = (reason: string): CloseDecision =>
    assertEvidence({ issue: issue.number, verdict: 'keep', reason, evidence: [] });
  const close = (reason: string, evidence: readonly string[]): CloseDecision =>
    assertEvidence({ issue: issue.number, verdict: 'close', reason, evidence });

  const labels = issue.labels.map((label) => label.toLowerCase());
  if (!labels.includes(DECISION_LABEL)) {
    return keep(`Không mang nhãn \`${DECISION_LABEL}\` — mục này chỉ xét issue \`[QĐ]\`.`);
  }

  // ── Nguồn 1 · chủ dự án nói xong. Mạnh nhất, và KHÔNG bị chặn bởi một PR
  //    bị bác: chủ dự án nói xong thì xong, kể cả khi đường đi đã đổi.
  const ownerSaysDone = issue.comments.find((comment) => isOwnerDoneComment(comment, owner));
  if (ownerSaysDone !== undefined) {
    return close('Chủ dự án đã trả lời là xong (comment không mở đầu 🤖, `CLAUDE.md` mục 5).', [
      `câu trả lời của chủ dự án lúc \`${ownerSaysDone.createdAt}\`: ${JSON.stringify(ownerSaysDone.body.trim())}`,
    ]);
  }

  // ── Chặn nguồn 2 và 3: một bản thực hiện bị BÁC thì quyết định chưa xong.
  const rejected = issue.linkedPrs.filter((pr) => pr.closed && !pr.merged);
  if (rejected.length > 0) {
    return keep(
      `PR ${rejected.map((pr) => `#${pr.number}`).join(', ')} đã đóng mà KHÔNG merge — ` +
        'bản thực hiện bị bác, nên quyết định chưa xong.',
    );
  }

  // ── Nguồn 2 · mọi PR được nêu đều đã merge.
  if (issue.linkedPrs.length > 0 && issue.linkedPrs.every((pr) => pr.merged)) {
    return close('Mọi PR mà issue nêu tên đều đã merge vào `main`.', issue.linkedPrs.map((pr) => `PR #${pr.number} đã merge`));
  }

  // ── Nguồn 3 · quyết định đã thành `docs/decisions/D-Cxx.md`.
  if (issue.hasDecisionDoc) {
    return close('Quyết định đã ghi vào `docs/decisions/` (`CLAUDE.md` mục 14).', [
      'có `docs/decisions/D-Cxx.md` ghi issue này là nguồn',
    ]);
  }

  const pending = issue.linkedPrs.filter((pr) => !pr.merged);
  if (pending.length > 0) {
    return keep(`PR ${pending.map((pr) => `#${pr.number}`).join(', ')} chưa merge.`);
  }
  return keep('Chưa có bằng chứng máy đọc được nào nói việc gắn với issue này đã xong.');
}

/**
 * Gắn trạng thái PR **đã đo** vào từng issue, khớp theo `linkedPrNumbers`.
 *
 * Tồn tại để luật đọc tên PR chỉ có **một** bản. Bên gọi (workflow) chạy hai
 * lượt — lấy issue, đo PR — và nếu lượt ghép lại tự tìm số PR bằng một biểu
 * thức `jq` chép tay thì repo có hai bản của cùng một luật, ở hai ngôn ngữ.
 * Mục `P-043` đã trả giá đúng một lần cho hình dạng đó: hằng
 * `STEP0_REF_PATTERN` có một bản chép trong YAML, bản chép lệch thật (thiếu
 * hai tiền tố), và không gì đỏ.
 *
 * PR **không đo được** thì vắng mặt trong `measured`, và nó vắng mặt luôn
 * trong `linkedPrs` — *"chưa biết"* không được biến thành *"đã đo và chưa
 * merge"*. Hai thứ đó dẫn tới hai phán quyết khác nhau (`keep` vì chưa merge
 * so với `close` vì mọi PR đo được đều merge), nên gộp chúng là cách giữ mãi
 * một issue đã xong mà không ai biết vì sao.
 */
export function attachLinkedPrs(
  issues: readonly DecisionIssue[],
  measured: readonly LinkedPr[],
): DecisionIssue[] {
  const byNumber = new Map(measured.map((pr) => [pr.number, pr]));
  return issues.map((one) => ({
    ...one,
    linkedPrs: linkedPrNumbers(one.title ?? '', one.body ?? '')
      .map((number) => byNumber.get(number))
      .filter((pr): pr is LinkedPr => pr !== undefined),
  }));
}

/**
 * Phán quyết cho cả danh sách, giữ nguyên thứ tự đầu vào.
 *
 * Không sắp lại: bên gọi truyền theo thứ tự nào thì đó là thứ tự nó muốn đọc,
 * và một hàm thuần sắp lại ngầm là chỗ bản tin và workflow đọc ra hai thứ tự
 * khác nhau từ cùng một dữ liệu.
 */
export function planDecisionCloses(
  issues: readonly DecisionIssue[],
  owner: string,
): CloseDecision[] {
  return issues.map((issue) => decideDecisionClose(issue, owner));
}

/** Thân comment đăng lên issue trước khi đóng nó. */
export function closeComment(decision: CloseDecision): string {
  if (decision.verdict !== 'close') {
    throw new Error(`#${decision.issue} mang phán quyết \`keep\` — không dựng comment đóng cho nó.`);
  }
  return [
    `${AGENT_PREFIX} **Tự đóng: việc gắn với \`[QĐ]\` này đã xong.**`,
    '',
    decision.reason,
    '',
    '**Bằng chứng:**',
    ...decision.evidence.map((line) => `- ${line}`),
    '',
    'Luật *"từ nay `[QĐ]` tự đóng khi việc gắn với nó đã xong"* là chỉ dẫn **D3** của chủ dự án',
    '(`#131` lúc `2026-09-24T23:54:32Z`, sao sang `#251`); phần quyết định nằm ở',
    '`ops/scripts/decision-close.ts` (mục `platform/P-050`), nên nó là bài kiểm máy khoá được',
    'chứ không phải lời dặn. Đóng sai thì mở lại — phán quyết dựng lại được từ cùng dữ liệu.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: đọc một ảnh chụp JSON trên stdin hoặc từ đường dẫn, in phán quyết.
// Workflow gom dữ liệu, file này quyết định, và hai việc đó không trộn vào
// nhau — cùng khuôn với `alert-escalation.ts`.
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith('decision-close.ts') === true;

if (isMain) {
  const { readFileSync } = await import('node:fs');
  const args = process.argv.slice(2);
  const linkedOnly = args[0] === '--linked-prs';
  const attachFrom = args[0] === '--attach-prs' ? args[1] : undefined;
  const rest = args[0]?.startsWith('--') === true ? args.slice(attachFrom === undefined ? 1 : 2) : args;
  const path = rest[0];
  const owner = rest[1] ?? 'HungQuach301';
  if (path === undefined) {
    console.error(
      'Dùng: node ops/scripts/decision-close.ts [--linked-prs] <ảnh-chụp.json> [owner]\n' +
        'Ảnh chụp: { "issues": [ { number, title, body, labels, comments, linkedPrs, hasDecisionDoc } ] }\n' +
        'Mặc định in: { "close": [...], "keep": [...] } — mỗi phán quyết kèm `reason` và `evidence`.\n' +
        '`--linked-prs <ảnh-chụp>`: in các số PR cần ĐO trạng thái, mỗi số một dòng.\n' +
        '`--attach-prs <pr-state.json> <ảnh-chụp>`: in lại ảnh chụp với `linkedPrs` đã ghép.\n' +
        'Bên gọi đi ba lượt — lấy issue → đo PR → ghép rồi quyết định — và luật đọc tên PR chỉ\n' +
        'có MỘT bản (`linkedPrNumbers`). Chép nó sang `jq` là cách hai bản lệch nhau mà không gì\n' +
        'đỏ, đúng chỗ `STEP0_REF_PATTERN` của mục `P-043` đã sập một lần.',
    );
    process.exit(2);
  }
  const snapshot = JSON.parse(readFileSync(path === '-' ? 0 : path, 'utf8')) as {
    issues?: readonly DecisionIssue[];
  };
  const issues = snapshot.issues ?? [];

  if (linkedOnly) {
    const numbers = new Set<number>();
    for (const one of issues) {
      for (const pr of linkedPrNumbers(one.title ?? '', one.body ?? '')) numbers.add(pr);
    }
    for (const pr of [...numbers].sort((a, b) => a - b)) console.log(pr);
    process.exit(0);
  }

  if (attachFrom !== undefined) {
    const measured = JSON.parse(readFileSync(attachFrom, 'utf8')) as readonly LinkedPr[];
    console.log(JSON.stringify({ issues: attachLinkedPrs(issues, measured) }, null, 2));
    process.exit(0);
  }

  const decisions = planDecisionCloses(issues, owner);
  console.log(
    JSON.stringify(
      {
        owner,
        total: decisions.length,
        // `comment` đi kèm ngay tại đây để `decision-close.yml` KHÔNG phải
        // dựng lại thân comment bằng `jq`. Cùng lẽ với `--attach-prs`: luật
        // nào có hai bản ở hai ngôn ngữ thì bản chép sẽ lệch, và nó lệch im
        // lặng (mục `P-043`, hằng `STEP0_REF_PATTERN`).
        close: decisions
          .filter((d) => d.verdict === 'close')
          .map((d) => ({ ...d, comment: closeComment(d) })),
        keep: decisions.filter((d) => d.verdict === 'keep'),
      },
      null,
      2,
    ),
  );
}
