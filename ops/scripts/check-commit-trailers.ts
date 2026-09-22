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

/**
 * Quét mọi commit trong `range` (dạng `origin/main..HEAD`). Đọc từng commit
 * một qua `--format=%B` thay vì một lần `git log` rồi tự cắt: thân commit có
 * thể chứa bất cứ ký tự phân cách nào ta chọn, và tự cắt là chỗ hỏng im lặng.
 */
export function scanRange(cwd: string, range: string): OffendingCommit[] {
  const list = spawnSync('git', ['rev-list', range], { cwd, encoding: 'utf8' });
  if (list.status !== 0) {
    throw new Error(`git rev-list ${range} lỗi: ${(list.stderr || '').trim()}`);
  }

  const offenders: OffendingCommit[] = [];
  for (const sha of list.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) {
    const show = spawnSync('git', ['log', '-1', '--format=%B', sha], { cwd, encoding: 'utf8' });
    if (show.status !== 0) {
      throw new Error(`git log ${sha} lỗi: ${(show.stderr || '').trim()}`);
    }
    const line = modelNameInTrailers(show.stdout);
    if (line !== null) offenders.push({ sha, line: line.trim() });
  }
  return offenders;
}

function main(): void {
  const [, , range, cwdArg] = process.argv;
  if (!range) {
    process.stderr.write('cách dùng: node ops/scripts/check-commit-trailers.ts <range> [cwd]\n');
    process.exit(1);
  }
  const offenders = scanRange(cwdArg ?? process.cwd(), range);
  if (offenders.length === 0) {
    process.stdout.write(`Khối trailer sạch trên mọi commit của ${range}.\n`);
    return;
  }
  for (const { sha, line } of offenders) {
    process.stderr.write(`${sha}: tên model trong khối trailer — ${line}\n`);
  }
  process.stderr.write(
    `\n${offenders.length} commit vi phạm CLAUDE.md mục 6 (xem KF-014).\n` +
      'Sửa: bỏ tên model khỏi trailer — `Co-Authored-By: Claude <noreply@anthropic.com>`.\n',
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
