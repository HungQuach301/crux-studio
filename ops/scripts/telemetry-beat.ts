#!/usr/bin/env node
/**
 * Mục `platform/P-043`, vế **ghi** — bản sao nhịp tim đi lên một nhánh
 * riêng, không đi qua `main`.
 *
 * Đọc khối đầu của `ops/scripts/heartbeat-source.ts` trước: ở đó là lý do
 * mục này tồn tại và nguyên văn câu trả lời của chủ dự án trên `🤖 [QĐ]`
 * **#213**. File này là phần trả lời cho chữ *"nhánh claude/telemetry của R2
 * hoặc tương đương"*.
 *
 * ## Một nhánh, append-only, không bao giờ có PR
 *
 * Nhánh `claude/telemetry` chỉ chứa **bản sao** của các dòng log bước 0.
 * Nguồn thật vẫn là file mà `step0LogPath()` của kernel sinh ra, nằm trong PR
 * của lượt chạy (bất biến **I8** không đổi chỗ). File này **không** viết đường
 * dẫn đó ra, kể cả trong chú thích: `ops/test/step0-log-path.test.ts` (mục
 * `P-023`) đỏ khi một file code neo vào một đường dẫn log bước 0 cố định, và
 * nó đỏ đúng chỗ — neo vào tên file là cách bên đọc hỏng im lặng ở lượt đầu
 * tiên tên file đổi. Nhánh này là nơi `watchdog.yml` đọc
 * được nhịp tim **trước** khi PR đó merge — và kể cả khi nó không bao giờ
 * merge.
 *
 * Ba tính chất, mỗi cái đổi lấy một chỗ hỏng đã biết:
 *
 * - **Không PR, nên không CI.** `ops/workflows/ci.yml` chỉ kích bằng
 *   `pull_request` và `workflow_dispatch`, nên push vào một nhánh không có
 *   PR không tốn job nào. Đó là toàn bộ khoản tiết kiệm mà `#213` nhắm tới,
 *   giữ được mà không phải tắt dấu hiệu nào.
 * - **Một file cho mỗi lượt chạy**, tên lấy nguyên từ file log gốc
 *   (`step0LogPath` của kernel sinh ra nó). Hai worker chạy chồng nhau
 *   (CHARTER 2.1) không bao giờ chạm cùng một file, nên không có gì để
 *   xung đột — cùng lập luận `D-C04`, áp cho một nhánh dùng chung.
 *
 *   ⚠️ **"Không xung đột" KHÔNG có nghĩa là "không mất dữ liệu", và bản đầu
 *   của khối lệnh dưới đây trộn hai điều đó.** Nó dựng cây `heartbeat/` lại
 *   **từ đầu** bằng một `git mktree` chỉ mang **một** entry, rồi commit cây
 *   đó với `-p $PARENT`. Không lần push nào bị từ chối — nhưng mỗi commit
 *   **xoá** nhịp tim của mọi lượt trước. Git không báo gì: một cây hợp lệ
 *   trỏ tới đúng một file vẫn là một cây hợp lệ.
 *
 *   **Đo trên chính nhánh này (2026-09-26T06:4xZ, 58 commit không kể commit
 *   của lượt này):** **37** commit có `-1` file hoặc hơn. Nhánh đứng ở **đúng
 *   một** file **27,7 giờ liền** — từ `a6f071c` (`2026-09-24T08:54:58Z`, commit
 *   gốc) tới `1bb6594` (`2026-09-25T12:38:27Z`), lần đầu tiên nó có hơn một
 *   file — rồi `715aab9` đạp về một file và nó ở đó thêm **15,0 giờ** nữa tới
 *   `c74534b`. Hai commit phải đi chữa bằng tay, tên chúng nói ra chỗ
 *   hỏng: `1bb6594` *"khôi phục nhịp tim 11:39:23Z bị lần đẩy trước ghi đè"*
 *   và `c74534b` *"khôi phục dòng của crux-worker-1 03:38Z bị lần đẩy trước
 *   ghi đè"*. Một commit còn xoá **hai** file một lúc (`715aab9`).
 *
 *   Chiều hỏng là nhóm **Z**: `watchdog.yml` dấu hiệu 5 chỉ đọc nhịp tim
 *   **mới nhất** nên nó vẫn đúng, `pnpm check` xanh, `main` xanh — trong khi
 *   bản ghi ở đầu nhánh bị xoá dần.
 *
 *   ⚠️ **Một lời khai của bản đầu bị bác, sửa tại chỗ thay vì để nó truyền
 *   tiếp** (mục `platform/P-059`; tiền lệ sửa tại chỗ nằm trong chính docblock
 *   này, vòng soát `#229`). Câu cũ ghi *"bản ghi lịch sử mà `step0Streaks` đọc
 *   từ nhánh này bị xoá dần"*. Đo được: **không script nào gọi
 *   `step0Streaks`**, và `step0Streaks` là hàm **thuần** (`kernel/src/log.ts`,
 *   nhận một mảng dòng — nó không đọc đường dẫn nào, nên nó không "đọc từ
 *   nhánh này"). Bên duy nhất đọc `heartbeat/` là `heartbeat-source.ts`, và nó
 *   lấy `max` của `at` nên **một** file cũng đủ làm nó xanh.
 *
 *   Nên hậu quả thật hẹp hơn câu cũ, và cũng tệ hơn nó: **không bên đọc nào**
 *   bị sai số — vì không bên nào đọc lịch sử — nên **không gì đỏ** khi bản ghi
 *   mất. Phép đo cho đúng chỗ đó là `ops/scripts/telemetry-gaps.ts`
 *   (`watchdog.yml` dấu hiệu số 8), và đường gỡ là `pnpm telemetry:restore`.
 *   Còn `KF-021`/`KF-041` nói về chuỗi kẹt là **cận dưới** vì một lý do
 *   **khác**: dòng log chưa tới nhánh chính, không phải nhánh telemetry.
 *
 *   Nên khối lệnh nay dựng cây **THÊM**: `git ls-tree` liệt kê entry đang có,
 *   `awk` bỏ đúng entry cùng tên, `printf` thêm nhịp tim của lượt này. Bài
 *   kiểm `ops/test/telemetry-beat.test.ts` chạy thật hai lần đẩy nối nhau
 *   trên một kho tạm và đòi **cả hai** file còn sống; file này trước đó
 *   **không có bài kiểm nào**, và đó là lý do chỗ hỏng sống được 33 lần.
 * - **Chỉ dòng bước 0 được vào.** `beatFileProblems` chặn mọi dòng khác.
 *
 *   ⚠️ Đây là **lớp phòng thủ thứ hai, không phải lớp duy nhất** — bản đầu của
 *   khối này viết rằng một dòng lạ *"giả mạo nhịp tim theo hướng mới hơn sự
 *   thật"*, và vòng soát ngữ cảnh sạch của PR #229 đo được là **sai**:
 *   `readHeartbeatSource` đã lọc bằng `isStep0Ref` ở phía **đọc**, nên một
 *   dòng `ref: "platform/P-999"`, `at: "2027-01-01"` nhét vào nhánh này
 *   **không** nhấc nổi nhịp tim.
 *
 *   Ghi đúng mức là quan trọng, không phải hình thức: lời khai cũ mời lượt sau
 *   nới bộ lọc của **bên đọc** vì tin rằng bên ghi đã canh — tức tháo đúng lớp
 *   đang thật sự giữ. Bên ghi chặn ở đây vì một dòng lạ trên nhánh này là một
 *   bản ghi sai chỗ mà không ai sẽ đi dọn, và vì hai lớp cùng một luật
 *   (`isStep0Ref`) thì lớp nào chết cũng còn lớp kia.
 *
 * ## Vì sao không dùng `ops/logs/` làm tên thư mục trên nhánh đó
 *
 * Thư mục là `heartbeat/`, không phải `ops/logs/`. Nếu trùng đường dẫn thì
 * một lần `git merge` hay `cherry-pick` nhầm giữa nhánh telemetry và một
 * nhánh việc sẽ trộn hai cây log vào nhau, và `misfiledLogLines` của kernel
 * không bắt được (đường dẫn vẫn đúng hình dạng). Tên khác làm phép trộn đó
 * lộ ra ngay.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { isStep0LogId } from '../../kernel/src/log.ts';
import { isStep0Ref } from './lane-heartbeat.ts';

/** Nhánh giữ bản sao nhịp tim. Không bao giờ mở PR cho nhánh này. */
export const TELEMETRY_BRANCH = 'claude/telemetry';

/** Thư mục trên nhánh đó — xem khối đầu file về việc vì sao KHÔNG phải `ops/logs`. */
export const TELEMETRY_DIR = 'heartbeat';

/**
 * Đường dẫn đích trên nhánh telemetry của một file log bước 0.
 *
 * Chỉ lấy **tên file**, không giữ cây thư mục nguồn: tên file do
 * `step0LogId` của kernel sinh ra và đã mang cả mốc thời gian tới giây lẫn
 * tên routine, nên nó đã là danh tính đầy đủ của lượt chạy. Giữ thêm cây thư
 * mục nguồn chỉ là dựng lại đúng đường dẫn mà khối đầu file nói là phải
 * tránh.
 */
export function telemetryTargetPath(logPath: string): string {
  const name = basename(logPath);
  if (!name.endsWith('.jsonl') || name.length <= '.jsonl'.length) {
    throw new Error(`File log bước 0 phải là một file \`.jsonl\`, nhận ${JSON.stringify(logPath)}.`);
  }
  // Tên này đi thẳng vào **shell** và vào phép so trường của `awk` trong
  // `telemetryPushCommands`, nên hình dạng của nó là chỗ chịu tải, không phải
  // hình thức. `isStep0LogId` của kernel đã chặn `/`, `..` và mọi ký tự ngoài
  // `[A-Za-z0-9._-]`, tức chặn luôn khoảng trắng, TAB, `$`, backtick và ký tự
  // ngoài ASCII — ba thứ lần lượt làm `git ls-tree` **quote** tên (nên `$2`
  // của `awk` không còn bằng tên), làm shell nội suy, và làm `git mktree`
  // nhận HAI entry cùng tên rồi trả `exit 0` cho một cây hỏng (đo được).
  // Không suy đoán "chắc không ai gọi sai": ném ở đây rẻ hơn một cây hỏng.
  const id = name.slice(0, -'.jsonl'.length);
  if (!isStep0LogId(id)) {
    throw new Error(
      `Tên file log bước 0 không đúng hình dạng \`step0LogId\`: ${JSON.stringify(name)}. ` +
        'Tên phải do `step0LogPath`/`step0LogId` của kernel sinh ra.',
    );
  }
  return `${TELEMETRY_DIR}/${name}`;
}

/**
 * Những gì sai trong một file định đẩy lên nhánh telemetry. Mảng rỗng =
 * hợp lệ.
 *
 * Trả về danh sách chứ không ném ở dòng đầu tiên: bên gọi cần thấy **mọi**
 * dòng sai trong một lần, không phải sửa một dòng rồi chạy lại để biết dòng
 * sau cũng sai.
 */
export function beatFileProblems(content: string): string[] {
  const problems: string[] = [];
  const rows = content.split('\n').filter((row) => row.trim().length > 0);

  if (rows.length === 0) {
    problems.push('File rỗng — không có dòng nhịp tim nào để đẩy lên.');
    return problems;
  }

  rows.forEach((row, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row);
    } catch {
      problems.push(`dòng ${index + 1}: không parse được JSON.`);
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      problems.push(`dòng ${index + 1}: không phải một đối tượng JSON.`);
      return;
    }
    const line = parsed as Record<string, unknown>;
    if (typeof line.ref !== 'string') {
      problems.push(`dòng ${index + 1}: thiếu trường \`ref\`.`);
      return;
    }
    if (!isStep0Ref(line.ref)) {
      problems.push(
        `dòng ${index + 1}: \`ref\` = ${JSON.stringify(line.ref)} KHÔNG phải dòng bước 0. ` +
          'Nhánh telemetry chỉ giữ nhịp tim; một dòng khác lọt vào là nhịp tim giả, mới hơn sự thật.',
      );
    }
    if (typeof line.at !== 'string' || !Number.isFinite(Date.parse(line.at))) {
      problems.push(`dòng ${index + 1}: \`at\` = ${JSON.stringify(line.at)} không đọc được thành một mốc thời gian.`);
    }
  });

  return problems;
}

/**
 * Nội dung sẽ nằm trên nhánh telemetry cho một file log bước 0 — **nguyên
 * văn** file gốc, chuẩn hoá đúng một dấu xuống dòng cuối.
 *
 * Không lọc bớt trường, không rút gọn: một bản sao khác bản gốc là một bản
 * sao phải bảo trì riêng, và phép so hai bản để phát hiện lệch sẽ mất chỗ
 * neo. `watchdog.yml` chỉ đọc `at` và `ref`, nhưng bên đọc sau này thì chưa
 * biết là ai.
 */
export function beatContent(raw: string): string {
  return `${raw.replace(/\n+$/, '')}\n`;
}

/**
 * Số **byte** UTF-8 của nội dung sẽ nằm trên nhánh telemetry.
 *
 * Tồn tại vì bản đầu in `beatContent(raw).length` — `String.length`, tức số
 * đơn vị mã **UTF-16**, không phải byte. Dòng log bước 0 là tiếng Việt có
 * dấu cộng ký tự 🤖, nên hai con số không bao giờ bằng nhau và chênh lệch
 * lệch theo hướng **báo nhỏ hơn thật**. Cặp số minh hoạ **cố ý không** lấy
 * từ một file log: một dòng log là **tự tham chiếu** — sửa `note` là đổi
 * chính số byte của nó, nên mọi cặp số trích từ đó hết đúng ở lần sửa
 * `note` kế tiếp (đã xảy ra thật trong lượt thêm hàm này, và trước đó là
 * cặp `6763`/`8214` không còn tái lập được ở đâu trong kho). Cặp ổn định,
 * tái lập được bằng một dòng `node` ở bất cứ lúc nào:
 *
 *     beatContent('🤖 nhịp tim bước 0').length   // 19  (đơn vị mã UTF-16)
 *     beatBytes('🤖 nhịp tim bước 0')            // 26  (byte UTF-8)
 *
 * 🤖 là một cặp surrogate (2 đơn vị UTF-16, 4 byte), và mỗi nguyên âm có dấu
 * là 1 đơn vị UTF-16 nhưng 2–3 byte. Một trường tên `bytes` mang một
 * đại lượng khác là đúng họ **I6** (mọi con số hiển thị phải có nguồn), và
 * đây là con số duy nhất mà bước 0e in ra cho người đọc bản ghi lượt chạy.
 */
export function beatBytes(raw: string): number {
  return Buffer.byteLength(beatContent(raw), 'utf8');
}

/**
 * Các lệnh git mà bên gọi chạy để đẩy bản sao lên nhánh telemetry.
 *
 * Script **in** chúng ra thay vì tự chạy, và đó là chủ đích: mọi thao tác ghi
 * lên remote nằm ở chỗ người đọc bản ghi lượt chạy thấy được, thay vì chôn
 * trong một script. Nhưng "in ra" phải là in **thật** — vòng soát ngữ cảnh
 * sạch của PR #229 bắt được rằng bản đầu *hứa* điều này trong chú thích rồi
 * chỉ in `{branch, target, bytes}`, tức CHARTER phụ lục P3 bước 0e dặn một
 * việc mà không lệnh nào tồn tại để làm.
 *
 * Dùng `git commit-tree` chứ không `git worktree`: nhánh này **mồ côi**
 * (không tổ tiên chung với `main`), và một worktree mồ côi cần `checkout
 * --orphan` cộng một lần dọn cây — hai bước nữa để hỏng, trong một việc chạy
 * ở mọi lượt worker. Plumbing không chạm cây làm việc chút nào.
 *
 * `--force-with-lease` vắng mặt có chủ ý: không có `--force` nào ở đây cả.
 * Hai worker chạy chồng nhau ghi hai **file khác nhau** (tên mang mốc tới giây
 * cộng tên routine), nên không ai phải thua: lần push bị từ chối chỉ cần
 * `git fetch` lại rồi **dựng lại** cây trên đầu mới và push lại.
 *
 * ⚠️ Vòng thử lại đó **phải tồn tại thật**, và một thời gian nó không: khối
 * này từng khai *"vòng `while` dưới đây làm đúng việc đó"* trong khi
 * `grep -n while` trên chính file chỉ ra đúng dòng chú thích ấy. Vòng soát
 * ngữ cảnh sạch của PR #281 dựng ca thật — worker B push xen vào giữa lúc A
 * đã dựng commit — và đo được `! [rejected] (fetch first)`, khối lệnh thoát
 * `1`, **nhịp tim của A mất**. Cùng họ với chỗ hỏng mà docblock này kể là
 * vòng soát PR #229 đã bắt: *hứa trong chú thích rồi không có lệnh nào làm*.
 * Nay vòng `while` có thật, có **trần 4 lần**, và không `--force` nào.
 *
 * ## Vì sao KHÔNG nuốt mã thoát của `git ls-tree`
 *
 * Bản đầu của phép "dựng thêm" viết `git ls-tree … 2>/dev/null | awk …`. Dưới
 * `sh -e`, mã thoát của pipeline là mã thoát của `awk` (0), nên ca *"nhánh
 * chưa tồn tại"* chạy được — **nhờ một tác dụng phụ không dòng nào nói ra**.
 * Cùng cơ chế đó giấu chiều ngược lại: `ls-tree` lỗi trong khi nhánh **có**
 * dữ liệu (thư mục `heartbeat` là blob chứ không phải tree, ref hỏng) cũng
 * thành "danh sách entry rỗng" ⇒ cây một entry ⇒ đúng chỗ hỏng ở trên, `exit
 * 0`, không ai biết. Nên nay: `PARENT` tính **trước**, ca "nhánh chưa có"
 * phân nhánh **tường minh**, và mọi lỗi `ls-tree` khác **ném**.
 */
export function telemetryPushCommands(logPath: string, sessionUrl: string): string[] {
  const target = telemetryTargetPath(logPath);
  const name = basename(target);
  const q = (value: string): string => JSON.stringify(value);
  return [
    `# Đẩy nhịp tim lên nhánh ${TELEMETRY_BRANCH} — KHÔNG mở PR, nên không chạy CI.`,
    `BLOB=$(git hash-object -w ${q(logPath)})`,
    '# Trailer BẮT BUỘC, và nó không có PR nào để sửa về sau: commit trên nhánh này',
    '# không bao giờ vào `main`, nên `no-model-name`/`check-commit-trailers` không',
    '# quét nó, mà bài kiểm giả định G14 của `recheck-assumptions.ts` CÓ quét mọi',
    '# nhánh `claude/*`. Một lần đẩy thiếu trailer là một giả định báo `sai` vì một',
    '# commit không ai sửa được nữa.',
    'MSG=$(printf \'%s\\n\' "🤖 [integration] nhịp tim bước 0" "" \\',
    '  "Co-Authored-By: Claude <noreply@anthropic.com>" \\',
    `  "Claude-Session: ${sessionUrl}")`,
    '# Vòng thử lại có TRẦN: hai worker chạy chồng nhau thì lần push sau bị từ chối',
    '# (`fetch first`), và cách chữa đúng là dựng LẠI cây trên đầu mới rồi push lại.',
    '# Không `--force` nào — hai lượt ghi hai file khác nhau nên không ai phải thua.',
    'ATTEMPT=0',
    'while :; do',
    '  ATTEMPT=$((ATTEMPT + 1))',
    `  git fetch --no-tags origin "+refs/heads/${TELEMETRY_BRANCH}:refs/crux/telemetry" || true`,
    '  PARENT=$(git rev-parse --verify --quiet refs/crux/telemetry || true)',
    '  # Nhánh CHƯA có: hai danh sách entry rỗng. Nhánh CÓ: lỗi `ls-tree` phải NÉM,',
    '  # không được nuốt thành "rỗng" — nuốt nó là dựng lại đúng cây một entry.',
    '  if [ -n "$PARENT" ]; then',
    '    OLD_ROOT=$(git ls-tree "$PARENT") || exit 1',
    `    HB_TYPE=$(printf '%s\\n' "$OLD_ROOT" | awk -F'\\t' '$2 == ${q(TELEMETRY_DIR)} { split($1, f, " "); print f[2] }')`,
    '    if [ -z "$HB_TYPE" ]; then',
    '      OLD_INNER=""',
    '    elif [ "$HB_TYPE" != "tree" ]; then',
    `      printf '⚠ %s trên %s là %s, không phải tree — DỪNG thay vì dựng lại cây.\\n' ${q(TELEMETRY_DIR)} "$PARENT" "$HB_TYPE" >&2`,
    '      exit 1',
    '    else',
    `      OLD_INNER=$(git ls-tree "$PARENT:${TELEMETRY_DIR}") || exit 1`,
    '    fi',
    '  else',
    '    OLD_ROOT=""',
    '    OLD_INNER=""',
    '  fi',
    `  # Cây \`${TELEMETRY_DIR}/\`: giữ MỌI entry đang có, bỏ đúng entry cùng tên (để lần`,
    '  # đẩy lại của cùng một lượt ghi đè chính nó), rồi thêm nhịp tim của lượt này.',
    '  # KHÔNG được rút về một `git mktree` chỉ mang một entry — xem khối đầu file.',
    `  INNER=$({ printf '%s\\n' "$OLD_INNER" | awk -F'\\t' -v n=${q(name)} 'NF && $2 != n'; printf '100644 blob %s\\t%s\\n' "$BLOB" ${q(name)}; } | git mktree)`,
    `  # Cây GỐC cũng dựng THÊM, cùng một lý do: một \`mktree\` chỉ mang entry`,
    `  # \`${TELEMETRY_DIR}\` sẽ xoá mọi thứ khác ở gốc nhánh (một \`README\` giải thích`,
    '  # nhánh là ca dễ xảy ra nhất, vì nhánh này không bao giờ có PR để ai soát).',
    `  ROOT=$({ printf '%s\\n' "$OLD_ROOT" | awk -F'\\t' -v n=${q(TELEMETRY_DIR)} 'NF && $2 != n'; printf '040000 tree %s\\t%s\\n' "$INNER" ${q(TELEMETRY_DIR)}; } | git mktree)`,
    '  if [ -n "$PARENT" ]; then',
    '    COMMIT=$(echo "$MSG" | git commit-tree "$ROOT" -p "$PARENT")',
    '  else',
    '    COMMIT=$(echo "$MSG" | git commit-tree "$ROOT")',
    '  fi',
    `  if git push origin "$COMMIT:refs/heads/${TELEMETRY_BRANCH}"; then break; fi`,
    '  if [ "$ATTEMPT" -ge 4 ]; then',
    '    printf \'⚠ push nhịp tim bị từ chối %s lần — DỪNG.\\n\' "$ATTEMPT" >&2',
    '    exit 1',
    '  fi',
    'done',
  ];
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
// `node ops/scripts/telemetry-beat.ts <file log bước 0> [--commands]`
//
// Không cờ: kiểm file và in `{branch, target, bytes}`.
// `--commands`: in thêm các lệnh git bên gọi phải chạy (xem
// `telemetryPushCommands`). Cờ nào cũng KHÔNG chạm git — script này không bao
// giờ tự ghi lên remote.
const isMain = process.argv[1]?.endsWith('telemetry-beat.ts') === true;

if (isMain) {
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => !a.startsWith('--'));
  const logPath = args[0];
  if (logPath === undefined) {
    process.stderr.write('⚠ Thiếu đường dẫn file log bước 0.\nDùng: node ops/scripts/telemetry-beat.ts <file.jsonl>\n');
    process.exit(2);
  }

  let raw: string;
  try {
    raw = readFileSync(logPath, 'utf8');
  } catch (error) {
    process.stderr.write(`⚠ Không đọc được ${logPath}: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }

  const problems = beatFileProblems(raw);
  if (problems.length > 0) {
    process.stderr.write(`⚠ ${logPath} không đủ điều kiện lên nhánh ${TELEMETRY_BRANCH}:\n`);
    for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
    process.exit(1);
  }

  const target = telemetryTargetPath(logPath);
  process.stdout.write(
    `${JSON.stringify({ branch: TELEMETRY_BRANCH, target, bytes: beatBytes(raw) }, null, 2)}\n`,
  );

  if (argv.includes('--commands')) {
    const sessionUrl = process.env.CLAUDE_SESSION_URL ?? '<url phiên làm việc>';
    process.stdout.write(`\n${telemetryPushCommands(logPath, sessionUrl).join('\n')}\n`);
  }
}
