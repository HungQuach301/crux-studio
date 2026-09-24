#!/usr/bin/env node
/**
 * Luật mềm `cross-lane` (CHARTER mục 4), tách khỏi YAML sang một script có
 * test — mục `platform/P-040` (đổi mã từ `P-028` trùng, xem backlog).
 *
 * ## Vì sao mục này tồn tại
 *
 * `ops/workflows/ci.yml` từng gắn nhãn `cross-lane` bằng
 * `grep -Eo '^(workshops|ops/lanes)/[a-z]+'` trên danh sách file đã đổi rồi
 * đếm số chuỗi phân biệt. Hai chỗ sai, cả hai đúng nhóm **Z** (hỏng mà
 * không gì đỏ, vì luật mềm không chặn):
 *
 * 1. **Không thấy `ops/logs/<làn>/`.** Từ `D-C04` mỗi mục có một file log
 *    riêng dưới đúng tên làn của nó, và bước 0 của phụ lục P3 ghi vào
 *    `ops/logs/integration/` ở **mọi** lượt worker — kể cả lượt nhận một
 *    mục của làn khác. Nên ca "một PR chạm hai làn" phổ biến nhất hiện nay
 *    (việc của làn X cộng dòng bước 0 của `integration`) lại đúng là ca bộ
 *    dò cũ không thấy.
 * 2. **Đếm trùng cùng một làn.** `grep` đếm CHUỖI, nên một PR chạm cả
 *    `ops/lanes/topic/` lẫn `workshops/topic/` (cùng làn `topic`) ra **hai**
 *    chuỗi phân biệt → `cross-lane` sai. Đúng cách là suy ra **tên làn** rồi
 *    đếm tập làn phân biệt.
 *
 * ## Ba gốc mang lãnh thổ của một làn
 *
 * Đoạn ngay sau mỗi gốc là tên làn. Suy ra tên làn (không phải chuỗi
 * đường dẫn) rồi bỏ vào một `Set<LaneName>` là chỗ khử trùng: hai gốc khác
 * nhau cùng trỏ một làn thì đếm một lần.
 *
 *   workshops/<làn>/   sáu xưởng
 *   ops/lanes/<làn>/   backlog của làn
 *   ops/logs/<làn>/    log của làn (D-C04)
 *
 * **Không suy luận gần đúng** — cùng luật `laneFromBranch` dùng: đoạn không
 * khớp đúng một tên trong `LANES` thì coi như không thuộc làn nào, để một
 * thư mục lạ (`workshops/README`, `ops/logs/tmp`) không bị đếm thành làn.
 *
 * ## Phạm vi cố ý hẹp
 *
 * Chỉ ba gốc trên, đúng bằng tiêu chí xong của mục. `kernel/` là một làn
 * nhưng file của nó nằm thẳng dưới `kernel/` chứ không dưới `ops/lanes/kernel/`;
 * `packs/` không phải làn. Mở rộng sang chúng là một câu hỏi thiết kế
 * riêng (nhãn `cross-lane` là luật mềm, không chặn gì) — để lại cho một
 * mục sau, không nống phạm vi ở đây.
 */

import { LANES, type LaneName } from '@crux/kernel';

/** Ba gốc mà đoạn ngay sau đánh dấu lãnh thổ của một làn. */
export const LANE_ROOTS = ['workshops/', 'ops/lanes/', 'ops/logs/'] as const;

/**
 * `git diff --name-only` bọc ngoặc kép quanh đường dẫn có ký tự ngoài ASCII
 * (`core.quotePath` mặc định `true`), ví dụ `"ops/logs/tập.jsonl"`. Repo này
 * viết tài liệu tiếng Việt nên đó là ca xảy ra được, không phải giả tưởng.
 * Bỏ qua thì luật fail-open lệch — cùng lý do `check-golden-pr.ts` ghi.
 */
function unquote(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
    ? trimmed.slice(1, -1)
    : trimmed;
}

/**
 * Tên làn mà một đường dẫn thuộc về, hoặc `null` nếu nó không nằm dưới một
 * gốc làn nào — hoặc đoạn sau gốc không đúng một tên làn hợp lệ.
 */
export function laneOfPath(path: string): LaneName | null {
  const clean = unquote(path);
  for (const root of LANE_ROOTS) {
    if (!clean.startsWith(root)) continue;
    const segment = clean.slice(root.length).split('/')[0] ?? '';
    return (LANES as readonly string[]).includes(segment) ? (segment as LaneName) : null;
  }
  return null;
}

/**
 * Tập làn mà một danh sách file đã đổi chạm tới. Khử trùng qua `Set`: hai
 * gốc khác nhau cùng trỏ một làn chỉ đếm một lần.
 */
export function lanesTouched(changedFiles: readonly string[]): Set<LaneName> {
  const lanes = new Set<LaneName>();
  for (const file of changedFiles) {
    const lane = laneOfPath(file);
    if (lane !== null) lanes.add(lane);
  }
  return lanes;
}

/** `true` khi PR chạm nhiều hơn một làn — điều kiện gắn nhãn `cross-lane`. */
export function isCrossLane(changedFiles: readonly string[]): boolean {
  return lanesTouched(changedFiles).size > 1;
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Nhận danh sách file đã đổi qua stdin, một đường dẫn mỗi dòng — đúng thứ
// `git diff --name-only <base>...HEAD` in ra. In SỐ LÀN ra stdout (để CI
// bắt bằng `$(...)`) và danh sách làn ra stderr (để đọc trong log). Không
// tự gọi `git`: bên gọi (CI) biết base branch, file này chỉ giữ LUẬT.
const isMain = process.argv[1]?.endsWith('cross-lane.ts') === true;

if (isMain) {
  const input = await new Promise<string>((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (buffer += chunk));
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });

  const changed = input.split('\n').filter((path) => path.trim().length > 0);

  // "Chưa nhìn thấy gì" KHÁC "đã nhìn và không thấy làn nào" — bài học Z15.
  // Một PR luôn có ít nhất một file đổi, nên đầu vào rỗng nghĩa là bên gọi
  // đưa nhầm phạm vi (base ref lệch), và cái đó phải ĐỎ, không xanh im lặng.
  if (changed.length === 0) {
    process.stderr.write(
      'Không nhận được đường dẫn nào qua stdin. Một PR luôn có ít nhất một file đổi, nên đây là ' +
        'phạm vi so sai (base ref lệch?), KHÔNG phải "PR không chạm làn nào". Đỏ thay vì xanh im lặng (Z15).\n',
    );
    process.exit(1);
  }

  const lanes = [...lanesTouched(changed)].sort();
  process.stderr.write(
    lanes.length === 0
      ? 'làn bị chạm: (không làn nào)\n'
      : `làn bị chạm: ${lanes.join(', ')} (${lanes.length})\n`,
  );
  process.stdout.write(`${lanes.length}\n`);
}
