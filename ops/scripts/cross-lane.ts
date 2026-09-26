#!/usr/bin/env node
/**
 * Luật mềm **`cross-lane`** (CHARTER mục 4), tách khỏi `ops/workflows/ci.yml`
 * ra một script có test — mục `platform/P-057`.
 *
 * ## Vì sao tách ra
 *
 * `ci.yml` chạy theo định nghĩa **trong nhánh PR**, nên một luật viết thẳng
 * vào YAML không phải chỗ đặt được test — cùng lý do đã ghi ở
 * `check-golden-pr.ts`. Trước mục này, bộ dò `cross-lane` là đúng một dòng
 * `grep` trong workflow:
 *
 *     grep -Eo '^(workshops|ops/lanes)/[a-z]+' … | sort -u | wc -l
 *
 * Hai chỗ sai, cả hai thuộc nhóm **Z** (hỏng mà không gì đỏ, vì luật mềm
 * không chặn):
 *
 * 1. **Không thấy `ops/logs/<làn>/`.** Từ `D-C04` mỗi mục có một file log
 *    riêng dưới đúng tên làn của nó, và bước 0 của phụ lục P3 ghi vào
 *    `ops/logs/integration/` ở **mọi** lượt worker — kể cả lượt nhận một mục
 *    của làn khác. Nên ca "một PR chạm hai làn" phổ biến nhất hiện nay
 *    (việc của làn X + dòng log bước 0 của `integration`) lại đúng là ca bộ
 *    dò cũ **không thấy**.
 * 2. **Đếm theo chuỗi tiền tố, không theo danh tính làn.** `grep` giữ nguyên
 *    `workshops/topic` và `ops/lanes/topic` là **hai** chuỗi khác nhau, nên
 *    một PR chỉ ở trong làn `topic` (code xưởng + backlog của chính nó) vẫn
 *    bị đếm là 2 làn — báo động giả. Ở đây một đường dẫn được quy về **tên
 *    làn**, rồi đếm số làn **khác nhau**: `ops/lanes/x` cộng `ops/logs/x`
 *    (cùng làn `x`) ra **1**, không phải 2.
 *
 * ## Mô hình: đường dẫn → làn
 *
 * Ba tiền tố mang danh tính làn, mỗi cái có đoạn tên làn ngay sau nó:
 *
 *     workshops/<làn>/…     ops/lanes/<làn>/…     ops/logs/<làn>/…
 *
 * `WORKSHOPS ⊂ LANES` (một xưởng cũng là một làn), nên `workshops/topic`
 * quy về làn `topic` như `ops/lanes/topic`. Đoạn tên phải khớp đúng một tên
 * trong `LANES` của kernel — một đoạn lạ (`ops/logs/tmp/…`, thư mục gõ sai)
 * quy về `null` và **không** được đếm, để bộ dò không dựng ra một "làn"
 * không tồn tại. File nằm **thẳng** dưới `ops/lanes/` (như `priority.md`,
 * `README.md`) hay `ops/logs/` (file log phẳng cũ) không có đoạn làn đứng
 * giữa hai dấu `/`, nên cũng quy về `null` — đúng chủ đích: chúng không
 * thuộc vùng của một làn cụ thể nào.
 */

import { LANES, type LaneName } from '../../kernel/src/envelope.ts';

const LANE_SET: ReadonlySet<string> = new Set<string>(LANES);

/** Ba gốc thư mục mang danh tính làn ở đoạn ngay sau chúng. */
const LANE_PATH = /^(?:workshops|ops\/lanes|ops\/logs)\/([^/]+)\//;

/**
 * `git diff --name-only` **không** in đường dẫn trần khi tên file có ký tự
 * ngoài ASCII: `core.quotePath` mặc định `true`, nên nó in
 * `"ops/logs/tập.jsonl"` — có dấu ngoặc kép bao ngoài. Bỏ dấu ngoặc ở đây
 * để một đường dẫn có dấu vẫn quy đúng về làn của nó (repo này đặt tên file
 * tiếng Việt được). Cùng một `unquote` với `check-golden-pr.ts`, giữ riêng
 * mỗi file một bản để hai luật độc lập nhau.
 */
export function unquote(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
    ? trimmed.slice(1, -1)
    : trimmed;
}

/**
 * Làn mà một đường dẫn thuộc về, hoặc `null` nếu đường dẫn không nằm trong
 * vùng của một làn nào. Đường dẫn vào đây là đường dẫn tương đối gốc repo,
 * đúng dạng `git diff --name-only` in ra.
 */
export function laneOfPath(path: string): LaneName | null {
  const match = LANE_PATH.exec(unquote(path));
  if (match === null) return null;
  const segment = match[1]!;
  return LANE_SET.has(segment) ? (segment as LaneName) : null;
}

/**
 * Tập các làn **khác nhau** mà một tập file đã đổi chạm tới. Quy mỗi đường
 * dẫn về tên làn rồi gom vào `Set`, nên hai đường dẫn cùng một làn (ví dụ
 * `ops/lanes/x` và `ops/logs/x`) chỉ tính một lần.
 */
export function lanesTouched(changedFiles: readonly string[]): Set<LaneName> {
  const lanes = new Set<LaneName>();
  for (const path of changedFiles) {
    const lane = laneOfPath(path);
    if (lane !== null) lanes.add(lane);
  }
  return lanes;
}

/**
 * Số làn khác nhau bị chạm — chính con số mà `ci.yml` so với 1 để gắn nhãn
 * `cross-lane`. Cửa: `> 1` là chạm nhiều làn.
 */
export function countLanesTouched(changedFiles: readonly string[]): number {
  return lanesTouched(changedFiles).size;
}

// ── CLI ──────────────────────────────────────────────────────────────────
// Nhận danh sách file đã đổi qua stdin, một đường dẫn mỗi dòng — đúng thứ
// `git diff --name-only <base>...HEAD` in ra. Không tự gọi `git` ở đây: bên
// gọi (CI) đã biết base branch của PR, còn file này chỉ giữ LUẬT.
//
// Kết quả máy đọc: SỐ LÀN in ra **stdout**, một số nguyên duy nhất, để
// `ci.yml` bắt bằng `LANES=$(node … < changed.txt)`. Phần người đọc (danh
// sách làn) in ra **stderr** — không bao giờ im lặng (rà soát Z2/Z9: một
// bước không nói gì trông y hệt một bước đã kiểm và đã qua).
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
  const lanes = [...lanesTouched(changed)].sort();

  if (lanes.length === 0) {
    process.stderr.write('không có file nào nằm trong vùng của một làn — không phải cross-lane.\n');
  } else {
    process.stderr.write(`làn bị chạm (${lanes.length}): ${lanes.join(', ')}\n`);
  }

  // Số nguyên trần trên stdout — luật mềm, không bao giờ đỏ vì đây là chỗ
  // đếm, không phải chỗ chặn.
  process.stdout.write(`${lanes.length}\n`);
}
