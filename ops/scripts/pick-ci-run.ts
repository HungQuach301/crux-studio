#!/usr/bin/env node
/**
 * Mục `platform/P-039`: chọn **đúng** lần chạy `ci.yml` nói lên kết quả CI
 * của một đầu nhánh, khi cùng một SHA có NHIỀU lần chạy.
 *
 * ## Chỗ hỏng mà file này chữa (nhóm Z, `KF-024`)
 *
 * `ops/workflows/automerge.yml` trước đây hỏi GitHub đúng một lần chạy:
 *
 * ```
 * gh api "…/workflows/ci.yml/runs?head_sha=$HEAD&status=completed&per_page=1"
 * ```
 *
 * `per_page=1` lấy phần tử ĐẦU của danh sách, mà danh sách ấy xếp theo
 * `created_at` giảm dần — không phải theo "lần chạy nào có thẩm quyền".
 * `ci.yml` có `concurrency` huỷ lần chạy cũ, nên một SHA thường có vài lần
 * chạy, và **hai lần chạy có thể cùng `created_at` tới từng giây**. Lúc đó
 * thứ tự giữa chúng do GitHub quyết, và nó có thể trả lần `cancelled` trước.
 *
 * Đo được trên PR `#194` (`head_sha` `ed56e10f`), ba lần chạy đều `completed`:
 *
 * | run | `created_at` | `run_number` | kết luận |
 * |---|---|---|---|
 * | `35875888124` | `14:40:17Z` | 609 | `cancelled` |
 * | `35875939060` | `14:40:41Z` | 610 | `cancelled` |
 * | `35875939096` | `14:40:41Z` | 611 | `success` |
 *
 * `per_page=1` trả `35875939060`, nên cổng đọc `ciConclusion: "cancelled"` và
 * in `skip — CI chưa xanh (cancelled)`. PR `#194` mang nhãn `automerge`, cả
 * sáu job xanh, không gì đỏ ở đâu — và nó nằm im **11 giờ**. `#208` kẹt cùng
 * chữ ký, 3 giờ. `created_at` không bao giờ đổi, nên chỗ kẹt này là VĨNH VIỄN,
 * không phải chậm một nhịp.
 *
 * Lần chạy `35875939060` bị huỷ 7 giây sau khi tạo, trước khi có job nào —
 * nên nó **không sinh check run nào**. Đó là lý do nhìn bằng Checks API (thứ
 * mà mắt người và job `fix-has-test` dùng) thấy 12/12 xanh, còn cổng lại thấy
 * `cancelled`. Hai lớp nhìn hai nguồn, và không lớp nào đỏ.
 *
 * ## Luật chọn, và vì sao nó không nuốt đỏ
 *
 * 1. Chỉ xét lần chạy `status === "completed"` — lần đang chạy chưa có kết
 *    luận, và chờ là đúng.
 * 2. Bỏ các kết luận **không mang phán quyết**: `cancelled`, `skipped`,
 *    `stale`. Một lần chạy bị huỷ không nói gì về cây mã; nó bị huỷ CHÍNH VÌ
 *    một lần chạy khác đã thay nó.
 * 3. Trong số còn lại, lấy lần **mới nhất theo `run_number`** — số này tăng
 *    đơn điệu theo repo, nên nó không hoà như `created_at`.
 * 4. Không còn lần nào mang phán quyết thì trả lần `completed` mới nhất (dù
 *    `cancelled`). Bên gọi vẫn thấy `ciConclusion !== "success"` và vẫn
 *    `skip`, đúng như hôm nay — file này KHÔNG mở thêm cửa nào.
 *
 * Luật 2 cộng luật 3 giữ nguyên chiều an toàn: một lần `failure` mới hơn một
 * lần `success` vẫn được chọn, nên đỏ không bị nuốt. Điều duy nhất đổi là một
 * lần chạy BỊ HUỶ không còn giả làm phán quyết của cây mã.
 *
 * Vì sao chấp nhận một lần `success` cũ hơn: `success` đó chạy trên ĐÚNG
 * `head_sha` này. Cây mã không đổi giữa hai lần chạy cùng SHA, nên phán quyết
 * của nó vẫn đúng.
 */

/** Các trường của một lần chạy workflow mà luật chọn cần tới. */
export interface CiRun {
  readonly id?: number;
  readonly run_number?: number;
  readonly head_sha?: string;
  readonly status?: string;
  readonly conclusion?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

/**
 * Kết luận **không mang phán quyết** về cây mã. Đọc một trong ba thứ này
 * thành "CI không xanh" là đọc sai: chúng nói lần chạy đã bị thay, không nói
 * cây mã hỏng.
 */
export const VERDICTLESS_CONCLUSIONS: readonly string[] = ['cancelled', 'skipped', 'stale'];

/**
 * Sắp xếp theo "mới nhất trước": `run_number` trước, rồi `updated_at`, rồi
 * `id`. Ba mức vì mỗi mức đều có thể vắng trong dữ liệu API thật, và hoà ở
 * mức trên chính là chỗ `KF-024` chui qua.
 */
function newestFirst(a: CiRun, b: CiRun): number {
  const byNumber = (b.run_number ?? -1) - (a.run_number ?? -1);
  if (byNumber !== 0) return byNumber;
  const byUpdated = Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? '');
  if (Number.isFinite(byUpdated) && byUpdated !== 0) return byUpdated;
  return (b.id ?? -1) - (a.id ?? -1);
}

/**
 * Lần chạy `ci.yml` có thẩm quyền cho một đầu nhánh, hoặc `null` khi không
 * có lần chạy `completed` nào.
 *
 * `headSha` là tuỳ chọn và chỉ để chắc thêm một lớp: API đã lọc theo
 * `head_sha`, nhưng bên gọi lọc lại thì một thay đổi ở câu hỏi API không thể
 * lặng lẽ đưa lần chạy của SHA khác vào đây.
 */
export function pickCiRun(runs: readonly CiRun[], headSha?: string): CiRun | null {
  const completed = runs
    .filter((run) => run.status === 'completed')
    .filter((run) => headSha === undefined || run.head_sha === headSha);
  if (completed.length === 0) return null;

  const withVerdict = completed.filter(
    (run) => run.conclusion !== null && !VERDICTLESS_CONCLUSIONS.includes(run.conclusion ?? ''),
  );
  const pool = withVerdict.length > 0 ? withVerdict : completed;
  return [...pool].sort(newestFirst)[0] ?? null;
}

const isMain = process.argv[1]?.endsWith('pick-ci-run.ts') === true;

if (isMain) {
  // Đọc từ stdin để bên gọi nối thẳng `gh api … | node ops/scripts/pick-ci-run.ts`
  // mà không cần file tạm. Đầu vào là `.workflow_runs` của API, đầu ra là
  // MỘT object (hoặc `{}`) — đúng hình dạng mà `--argjson ci` của
  // `automerge.yml` chờ, nên chỗ gọi không phải tự bóc mảng.
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();

  let runs: CiRun[] = [];
  if (raw !== '') {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      process.stderr.write('pick-ci-run: đầu vào phải là MẢNG workflow run (JSON).\n');
      process.exit(2);
    }
    runs = parsed as CiRun[];
  }

  const headSha = process.argv[2];
  process.stdout.write(`${JSON.stringify(pickCiRun(runs, headSha) ?? {})}\n`);
}
