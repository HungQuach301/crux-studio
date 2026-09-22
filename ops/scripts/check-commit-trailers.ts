#!/usr/bin/env node
/**
 * Mục `KF-014`: **tên model lọt vào commit message qua khối trailer**.
 *
 * `CLAUDE.md` mục 6: "Không ghi tên hay mã model vào commit message, mô tả PR,
 * comment code hay bất cứ thứ gì đẩy lên repo." Chỗ luật này bị vi phạm thật,
 * hai lần, là cùng một chỗ: dòng `Co-Authored-By` mang thêm tên model —
 * `Co-Authored-By: Claude Sonnet 5 <…>` (bắt được trước khi merge, ghi trong
 * thân PR #133) rồi `Co-Authored-By: Claude Opus 5 <…>` (KHÔNG bắt được, đã
 * vào `main` qua squash của #133, commit `024c29d`).
 *
 * Vì sao lần thứ hai lọt: lớp chặn duy nhất đang có —
 * `ops/test/integrator-resolve.test.ts` — chỉ phủ commit do
 * `ops/scripts/integrator-resolve.ts` **sinh ra**. Commit người/agent **viết
 * tay** không đi qua tool đó nên không có gì kiểm. Và job `trailer-warn` của
 * `ops/workflows/ci.yml` chỉ đếm commit **thiếu** `Claude-Session`, không đọc
 * **nội dung** trailer. Đúng nhóm **Z**: hỏng mà không gì đỏ.
 *
 * ## Vì sao quét theo KHOÁ TRAILER, không quét cả thân commit
 *
 * Quét cả thân sẽ đỏ ngay ở chính những commit **nói về** lỗi này — ví dụ
 * commit thêm mục `KF-014` vào `ops/known-failures.md`, vốn phải trích đúng
 * dòng sai làm chữ ký. Một luật cứng mà không viết nổi bản vá cho chính nó là
 * luật sẽ bị tắt, không phải luật được tuân thủ.
 *
 * Nên phép quét bám vào **khoá trailer đã biết** ở đầu dòng (`Co-Authored-By:`
 * và họ hàng). Văn xuôi không mở đầu bằng những khoá đó, còn cả hai lần sai
 * thật thì có.
 *
 * ## Vì sao KHÔNG chỉ quét đoạn cuối
 *
 * Bản đầu của file này chỉ đọc "khối trailer" theo nghĩa git — đoạn cuối cùng
 * mà mọi dòng đều đúng dạng trailer — và **để lọt đúng ca sai thật**. Lý do đo
 * được ở commit `024c29d`: GitHub squash ghép mô tả PR vào thân, rồi tự nối
 * thêm một `Co-authored-by` của chính nó ở đoạn cuối. Dòng sai
 * (`Co-Authored-By: Claude Opus 5`) nằm ở một đoạn **giữa**, cách đoạn cuối bởi
 * một dòng `---------`. Phép đo hẹp theo vị trí ra `EXIT=0` trên đúng commit nó
 * phải bắt — nên vị trí bị bỏ, khoá được giữ.
 *
 * ## Mốc ân hạn: chỉ quét commit tạo SAU khi luật bật (`🤖 [QĐ] #165`, phương án B)
 *
 * Luật này viết ra **sau** khi các commit vi phạm đã nằm sẵn trong lịch sử các
 * nhánh đang mở. Đo thật ngày 2026-09-22: **30 commit vi phạm, trải trên 13
 * trên 29 PR đang mở** (#39 #42 #49 #56 #65 #79 #81 #84 #89 #112 #153 #157
 * #164; nặng nhất #42 với 9/10 commit). Không có mốc ân hạn thì job
 * `no-model-name` vào `main` là 13 PR kia đỏ cùng lúc, vì lỗi của lượt khác.
 *
 * Và chúng **không sửa được từ phía agent**: cách sửa duy nhất nằm trong nhánh
 * là viết lại thông điệp commit rồi `git push --force`, mà `.claude/settings.json`
 * chặn ở `deny`. Một luật mà không lượt nào vá nổi là luật sẽ bị tắt — cùng lý
 * do đã viết ở phần "quét theo khoá trailer" phía trên.
 *
 * Nên phép quét bỏ qua commit **tạo trước** `GRACE_CUTOFF`. Vết cũ còn lại
 * nguyên và đã khai ở `KF-014`; luật vẫn chặn mọi vi phạm **mới**, tức đúng cái
 * nó sinh ra để chặn.
 */

import { spawnSync } from 'node:child_process';

/**
 * Tên model cần chặn. Cùng danh sách với ca kiểm đã có trong
 * `ops/test/integrator-resolve.test.ts`, để hai lớp chặn không lệch nhau.
 *
 * `\b` hai đầu: không bắt nhầm một từ dài hơn có chứa các chữ này.
 */
export const MODEL_NAME_PATTERN = /\b(opus|sonnet|haiku)\b/i;

/**
 * Mốc ân hạn: commit **tạo trước** thời điểm này không bị quét.
 *
 * Con số chọn bằng đo, không bằng cảm tính: commit vi phạm **muộn nhất** trong
 * 30 commit đo được ngày 2026-09-22 là `80d65f0` của PR #164, `2026-09-22T21:26:04Z`.
 * Mốc đặt ở `22:00Z` — sau commit đó, và **trước** chính các commit của bản vá
 * này, nên bản vá phải tự tuân thủ luật nó cài. Đó là ràng buộc có chủ đích:
 * một mốc đặt ở tương lai sẽ ân xá luôn cho lượt viết ra nó.
 *
 * Mốc là một **hằng số**, không phải "lúc chạy": lấy giờ chạy làm mốc thì mọi
 * commit đều được ân hạn và luật thành vô nghĩa — hỏng mà không gì đỏ, đúng
 * nhóm **Z**.
 */
export const GRACE_CUTOFF = '2026-09-22T22:00:00Z';

/**
 * Commit này có nằm trong phạm vi quét không — tức **tạo từ mốc ân hạn trở đi**.
 *
 * Ném khi một trong hai mốc không đọc được, thay vì trả `false` (bỏ qua commit,
 * luật thủng im lặng) hay `true` (đỏ oan). Cả hai mốc **phải mang offset múi
 * giờ**: `Date.parse` đọc chuỗi không có offset là **giờ địa phương**, nên cùng
 * đầu vào ra hai kết quả tuỳ `TZ` của runner. Đường đang dùng an toàn —
 * `git log --format=%cI` luôn kèm offset — nhưng đó là ràng buộc ngầm, nên khai
 * ra ở đây. Cùng lý do đã viết ở `hoursBetween` của `ops/scripts/conflict-watch.ts`.
 *
 * So sánh **không nghiêm ngặt** (`>=`): commit đúng vào giây của mốc bị quét.
 * Nghi ngờ thì nghiêng về phía quét — bỏ sót một vi phạm đắt hơn đỏ một commit.
 */
export function isInScanScope(committedAt: string, cutoff: string = GRACE_CUTOFF): boolean {
  const at = Date.parse(committedAt);
  const limit = Date.parse(cutoff);
  if (Number.isNaN(at) || Number.isNaN(limit)) {
    throw new Error(`Mốc thời gian không đọc được: ${JSON.stringify([committedAt, cutoff])}`);
  }
  return at >= limit;
}

/**
 * Khoá trailer được quét. `Co-Authored-By` là chỗ cả hai lần sai đã xảy ra;
 * các khoá còn lại cùng họ "trailer mang danh tính" nên cùng rủi ro.
 *
 * Khoá mới xuất hiện thì thêm vào đây — danh sách đóng là có chủ đích, vì mở
 * sang "mọi dòng dạng `Khoá: giá trị`" sẽ bắt nhầm văn xuôi tiếng Việt
 * (`Chữ ký: …`, `Còn treo: …`).
 */
export const TRAILER_KEYS = [
  'Co-Authored-By',
  'Signed-off-by',
  'Claude-Session',
  'Reviewed-by',
  'Acked-by',
  'Tested-by',
] as const;

const TRAILER_LINE = new RegExp(`^(${TRAILER_KEYS.join('|')}):\\s`, 'i');

/** Dòng nối tiếp của trailer phía trên (git cho phép thụt lề). */
const TRAILER_CONTINUATION = /^\s+\S/;

/**
 * Mọi dòng trailer trong commit message, ở **bất cứ đoạn nào** của thân — cộng
 * các dòng nối tiếp thụt lề ngay sau một dòng trailer.
 *
 * Không lọc theo vị trí: xem khối chú thích đầu file, ca `024c29d` có dòng sai
 * ở một đoạn giữa.
 */
export function trailerLines(body: string): string[] {
  const found: string[] = [];
  let inTrailer = false;
  for (const line of body.split('\n')) {
    if (TRAILER_LINE.test(line)) {
      found.push(line);
      inTrailer = true;
      continue;
    }
    if (inTrailer && TRAILER_CONTINUATION.test(line)) {
      found.push(line);
      continue;
    }
    inTrailer = false;
  }
  return found;
}

/**
 * Dòng trailer đầu tiên mang tên model, hoặc `null` nếu mọi trailer đều sạch.
 * Trả chính dòng sai (không phải `true`) để thông điệp lỗi chỉ thẳng chỗ sửa.
 */
export function modelNameInTrailers(body: string): string | null {
  return trailerLines(body).find((line) => MODEL_NAME_PATTERN.test(line)) ?? null;
}

export interface OffendingCommit {
  sha: string;
  line: string;
}

export interface ScanResult {
  /** Commit vi phạm, chỉ trong phạm vi quét. */
  offenders: OffendingCommit[];
  /** Số commit bị bỏ qua vì tạo **trước** mốc ân hạn. */
  graced: number;
  /** Số commit thật sự được quét. */
  scanned: number;
}

/**
 * Quét mọi commit trong `range` (dạng `origin/main..HEAD`) **tạo từ `cutoff`
 * trở đi**. Đọc từng commit một qua `--format=%cI%n%B` thay vì một lần
 * `git log` rồi tự cắt: thân commit có thể chứa bất cứ ký tự phân cách nào ta
 * chọn, và tự cắt là chỗ hỏng im lặng. `%cI` thì an toàn để làm dòng đầu —
 * nó không bao giờ chứa xuống dòng.
 *
 * ## Vì sao mốc so theo giờ **committer** (`%cI`), không phải giờ author (`%aI`)
 *
 * Hai mốc lệch nhau thật: commit `bb146e6` của PR #157 có `%aI 18:40:15Z`
 * nhưng `%cI 18:41:20Z`. Chọn `%cI` vì nó là lúc **commit object hiện tại**
 * ra đời, nên nó nghiêng về phía **quét**: một commit cũ bị viết lại
 * (amend/rebase/cherry-pick) nhận `%cI` mới và mất ân hạn — đúng điều ta
 * muốn, vì lượt viết lại nó có thể sửa trailer luôn. `%aI` thì giữ nguyên qua
 * mọi lần viết lại, tức ân hạn theo được vô hạn. Nghi ngờ thì nghiêng về phía
 * quét, cùng luật với `isInScanScope`.
 */
export function scanRange(cwd: string, range: string, cutoff: string = GRACE_CUTOFF): ScanResult {
  const list = spawnSync('git', ['rev-list', range], { cwd, encoding: 'utf8' });
  if (list.status !== 0) {
    throw new Error(`git rev-list ${range} lỗi: ${(list.stderr || '').trim()}`);
  }

  const offenders: OffendingCommit[] = [];
  let graced = 0;
  let scanned = 0;
  for (const sha of list.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) {
    const show = spawnSync('git', ['log', '-1', '--format=%cI%n%B', sha], { cwd, encoding: 'utf8' });
    if (show.status !== 0) {
      throw new Error(`git log ${sha} lỗi: ${(show.stderr || '').trim()}`);
    }
    const newline = show.stdout.indexOf('\n');
    if (newline === -1) {
      throw new Error(`git log ${sha}: không đọc được mốc %cI — đầu ra ${JSON.stringify(show.stdout)}`);
    }
    const committedAt = show.stdout.slice(0, newline).trim();
    if (!isInScanScope(committedAt, cutoff)) {
      graced += 1;
      continue;
    }
    scanned += 1;
    const line = modelNameInTrailers(show.stdout.slice(newline + 1));
    if (line !== null) offenders.push({ sha, line: line.trim() });
  }
  return { offenders, graced, scanned };
}

function main(): void {
  const [, , range, cwdArg] = process.argv;
  if (!range) {
    process.stderr.write('cách dùng: node ops/scripts/check-commit-trailers.ts <range> [cwd]\n');
    process.exit(1);
  }
  const { offenders, graced, scanned } = scanRange(cwdArg ?? process.cwd(), range);
  // Số commit được ân hạn luôn in ra, kể cả khi sạch: một mốc ân hạn im lặng
  // là một mốc không ai kiểm lại được. Xem `GRACE_CUTOFF`.
  const scope = `${scanned} commit quét, ${graced} ân hạn (tạo trước ${GRACE_CUTOFF}, xem KF-014)`;
  if (offenders.length === 0) {
    process.stdout.write(`Khối trailer sạch trên mọi commit của ${range} — ${scope}.\n`);
    return;
  }
  for (const { sha, line } of offenders) {
    process.stderr.write(`${sha}: tên model trong khối trailer — ${line}\n`);
  }
  process.stderr.write(
    `\n${offenders.length} commit vi phạm CLAUDE.md mục 6 (xem KF-014) — ${scope}.\n` +
      'Sửa: bỏ tên model khỏi trailer — `Co-Authored-By: Claude <noreply@anthropic.com>`.\n',
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
