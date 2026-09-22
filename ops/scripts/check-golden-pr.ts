#!/usr/bin/env node
/**
 * Rà soát **Z13** (`ops/known-failures.md`): một PR vừa cập nhật snapshot
 * tập vàng vừa đổi thứ khác thì `pnpm replay` mất hết giá trị, và **không
 * gì đỏ**.
 *
 * CHARTER 6.1 đã đòi điều này bằng lời từ đầu — *"cập nhật snapshot tập
 * vàng phải đi trong PR riêng, không kèm thay đổi nào khác"* — nhưng lời
 * không chặn được gì. `pnpm replay` so output với snapshot; nếu cùng một PR
 * sửa code sinh ra output **và** ghi lại snapshot, thì snapshot mới khớp
 * output mới, phép so xanh, và không ai biết hành vi vừa đổi. Đúng nhóm
 * **Z**: hỏng mà mọi chỉ báo đều xanh.
 *
 * ## Vì sao luật này mãi tới nay mới khả thi
 *
 * Trước mục `I-009`, fixture của sáu xưởng mang **bản chép** của snapshot,
 * nên mọi PR `--update` **buộc** phải sửa kèm sáu file fixture — một luật
 * "chỉ được chạm `ops/golden/**`" sẽ đỏ với chính những PR nó phải cho qua.
 * Từ `I-009`, fixture trỏ tập vàng bằng `upstreamFrom` và tự đi theo
 * snapshot, nên một PR `--update` đúng luật chỉ chạm `ops/golden/**`.
 *
 * ## Ngoại lệ, và vì sao đúng hai thư mục này
 *
 * "Không kèm thay đổi nào khác" đọc theo mặt chữ thì **không PR nào hợp lệ
 * được**: bất biến I8 đòi mọi lần chạy ghi một dòng `ops/logs/<lane>/<id>.jsonl`,
 * và CLAUDE.md mục 2 đòi cập nhật backlog trong **cùng PR đó**. Một luật
 * mà không PR nào qua được là một luật sẽ bị tắt ở lần đầu tiên nó chạy.
 *
 * Nên ngoại lệ chỉ gồm những chỗ **không thể đổi output của `pnpm replay`**.
 * Đó là một tính chất kiểm được, không phải một sự châm chước: `replay.ts`
 * đọc `ops/golden/**` rồi chạy các xưởng, và các xưởng đọc `kernel/`,
 * `workshops/`, `packs/`. Nó không đọc dòng log nào, không đọc backlog nào.
 *
 *   ops/logs/**   · append-only, bất biến I8, không bên nào đọc lúc replay
 *   ops/lanes/**  · backlog và thứ tự ưu tiên, chỉ người và routine đọc
 *
 * Tài liệu (`docs/**`) KHÔNG nằm trong danh sách, dù nó cũng không đổi
 * output: mô tả vì sao snapshot đổi thuộc về **mô tả PR**, không thuộc một
 * file đi kèm — và một ngoại lệ rộng là chỗ mà "PR riêng" bắt đầu rò.
 */

const GOLDEN_PREFIX = 'ops/golden/';

/**
 * `git diff --name-only` **không** in đường dẫn trần khi tên file có ký tự
 * ngoài ASCII: `core.quotePath` mặc định `true`, nên nó in
 * `"ops/golden/t\341\272\255p.json"` — có dấu ngoặc kép bao ngoài.
 *
 * Bỏ qua chi tiết đó thì luật này **fail-open**, đúng chiều nguy hiểm nhất:
 * `isGoldenFile` thấy ký tự đầu là `"` nên kết luận PR không chạm tập vàng,
 * và một PR `--update` kèm code đi qua **im lặng**. Đúng nhóm Z mà chính
 * file này sinh ra để chống — nên gỡ dấu ngoặc ở đây, và bên gọi (CI) còn
 * truyền thêm `-c core.quotePath=false` làm lớp thứ hai.
 *
 * Repo này viết tài liệu tiếng Việt, nên một file `ops/golden/**` đặt tên
 * có dấu là chuyện xảy ra được, không phải ca giả tưởng.
 */
function unquote(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
    ? trimmed.slice(1, -1)
    : trimmed;
}

/**
 * Những tiền tố được phép đi cùng một PR cập nhật tập vàng. Xem lý do ở
 * khối chú thích đầu file — mỗi dòng ở đây phải là một chỗ mà `pnpm replay`
 * chứng minh được là nó không đọc.
 */
export const ALLOWED_ALONGSIDE_GOLDEN = ['ops/logs/', 'ops/lanes/'] as const;

/** `true` nếu đường dẫn nằm trong tập vàng. */
export function isGoldenFile(path: string): boolean {
  return unquote(path).startsWith(GOLDEN_PREFIX);
}

/**
 * Danh sách vi phạm cho một tập file đã đổi của PR. Rỗng nghĩa là qua.
 *
 * PR **không** chạm `ops/golden/**` thì luật này không nói gì — nó chỉ
 * canh chiều "vừa cập nhật snapshot vừa đổi thứ khác", không canh chiều
 * ngược lại.
 *
 * Đường dẫn vào đây là đường dẫn tương đối gốc repo, đúng dạng
 * `git diff --name-only` in ra.
 */
export function goldenOnlyProblems(changedFiles: readonly string[]): string[] {
  const changed = changedFiles.map(unquote).filter((path) => path.length > 0);
  if (!changed.some(isGoldenFile)) return [];

  return changed
    .filter(
      (path) =>
        !isGoldenFile(path) && !ALLOWED_ALONGSIDE_GOLDEN.some((prefix) => path.startsWith(prefix)),
    )
    .sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Nhận danh sách file đã đổi qua stdin, một đường dẫn mỗi dòng — đúng thứ
// `git diff --name-only <base>...HEAD` in ra. Không tự gọi `git` ở đây: bên
// gọi (CI) đã biết base branch của PR, còn file này chỉ giữ LUẬT.
const isMain = process.argv[1]?.endsWith('check-golden-pr.ts') === true;

if (isMain) {
  const input = await new Promise<string>((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buffer += chunk));
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });

  const changed = input.split('\n').filter((path) => path.trim().length > 0);

  // "Chưa nhìn thấy gì" KHÁC "đã nhìn và không thấy tập vàng" — bài học Z15
  // của chính sổ này: một bài kiểm không được tự khai "không có gì để xem"
  // khi nó chưa nhìn. Một PR luôn có ít nhất một file đổi, nên đầu vào rỗng
  // nghĩa là bên gọi đưa nhầm phạm vi (base ref lệch, `git diff` chạy xong
  // mà không so gì) — và cái đó phải ĐỎ, không được xanh im lặng.
  if (changed.length === 0) {
    process.stderr.write(
      'Không nhận được đường dẫn nào qua stdin. Một PR luôn có ít nhất một file đổi, nên đây là ' +
        'phạm vi so sai (base ref lệch?), KHÔNG phải "PR không chạm tập vàng". Đỏ thay vì xanh im lặng (Z15).\n',
    );
    process.exit(1);
  }

  const touchesGolden = changed.some(isGoldenFile);

  // Không bao giờ im lặng: mọi nhánh đều in ra kết luận của nó (rà soát Z2
  // và Z9 — một bước không nói gì trông y hệt một bước đã kiểm và đã qua).
  if (!touchesGolden) {
    process.stdout.write('PR không chạm ops/golden/ — luật Z13 không áp dụng, bỏ qua.\n');
    process.exit(0);
  }

  const problems = goldenOnlyProblems(changed);
  if (problems.length === 0) {
    process.stdout.write('PR chạm ops/golden/ và không kèm thay đổi nào khác — qua (CHARTER 6.1).\n');
    process.exit(0);
  }

  process.stderr.write(
    'PR này cập nhật snapshot tập vàng (ops/golden/) VÀ đổi thứ khác. CHARTER 6.1 đòi ' +
      '`pnpm replay -- --update` đi trong PR RIÊNG: snapshot mới luôn khớp output mới, nên ' +
      'gộp chung thì phép so tập vàng xanh mà không kiểm gì (rà soát Z13).\n' +
      `Các file phải tách sang PR khác:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`,
  );
  process.exit(1);
}
