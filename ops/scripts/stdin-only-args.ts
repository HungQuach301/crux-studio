/**
 * Mục `platform/P-062` — một script **chỉ đọc stdin** phải ném khi nhận một
 * đối số nó không hiểu, không được lặng lẽ bỏ qua.
 *
 * ## Chỗ hỏng
 *
 * `node ops/scripts/cross-lane.ts --changed /tmp/changed.txt` trả **"0 làn"**
 * với mã thoát 0: script không đọc `argv`, nên cờ `--changed` rơi mất, stdin
 * rỗng (hoặc là TTY đã đóng) và bộ đếm kết luận "không phải cross-lane". Hình
 * dạng đó giống hệt `node ops/invariants.protected-area.ts --changed …` — thứ
 * **có** cờ ấy — nên gõ nhầm là chuyện sẽ xảy ra, và kết luận sai thì không gì
 * đỏ (luật mềm, nhóm **Z**).
 *
 * ## Mục này KHÔNG làm gì
 *
 * Không thêm cờ `--changed` cho script nào. Thêm cờ bằng cách đoán ý bên gọi
 * là đúng thứ luật `A10` cấm; mục này chỉ cấm **cái im lặng**.
 */

/**
 * Các đối số không được nhận: mọi thứ bắt đầu bằng `-` (một cờ — script chỉ
 * đọc stdin không có cờ nào), cộng mọi đối số vị trí vượt quá `maxPositional`.
 *
 * Trả danh sách rỗng khi `argv` hợp lệ. Hàm thuần: bên gọi quyết định in gì
 * và thoát mã nào, để bài kiểm không phải chạy một tiến trình con cho mỗi ca.
 */
export function unexpectedArgs(argv: readonly string[], maxPositional = 0): string[] {
  const bad: string[] = [];
  let positional = 0;
  for (const arg of argv) {
    if (arg.startsWith('-')) {
      bad.push(arg);
    } else if ((positional += 1) > maxPositional) {
      bad.push(arg);
    }
  }
  return bad;
}

/**
 * Chặn ở đầu CLI: có đối số lạ thì in lý do ra stderr và thoát **2** (lỗi
 * cách dùng — cùng mã `pick-ci-run.ts` và `step0-pending-branches.ts` đã dùng),
 * trước khi đọc stdin. Đọc stdin trước rồi mới kiểm thì một stdin TTY sẽ treo
 * và lỗi cách dùng không bao giờ được in.
 */
export function rejectUnexpectedArgs(
  script: string,
  argv: readonly string[],
  usage: string,
  maxPositional = 0,
): void {
  const bad = unexpectedArgs(argv, maxPositional);
  if (bad.length === 0) return;
  process.stderr.write(
    `${script}: đối số không nhận: ${bad.map((arg) => JSON.stringify(arg)).join(' ')}. ` +
      'Script này đọc danh sách từ STDIN, không có cờ nào — bỏ qua cờ rồi trả kết quả ' +
      'là kết luận "không có gì" cho một lần gọi sai (mục P-062).\n' +
      `cách dùng: ${usage}\n`,
  );
  process.exit(2);
}
