/**
 * Mục `platform/P-045` — `KF-029`.
 *
 * Ba tầng, vì hai tầng đầu đo được là KHÔNG đủ (bài học của `P-044`):
 *
 * 1. **Hàm thuần** — `summarizeQueue`. Mở đầu bằng bài TÁI HIỆN LỖI (bất
 *    biến **I2**) dựng lại đúng lượt `automerge` số 737.
 * 2. **Hình dạng YAML** — `ops/workflows/automerge.yml` trên cây. Một hàm
 *    đúng không cứu được gì nếu bash không gọi nó, hoặc gọi sai chỗ.
 * 3. **Hợp đồng bash↔TS** — chạy thật khối bash đã được rút ra, với một
 *    lệnh merge giả LUÔN HỎNG, để chứng minh `continue` thật sự xảy ra dưới
 *    `set -euo pipefail`. Tầng này tồn tại vì chỗ hỏng gốc nằm trọn trong
 *    ngữ nghĩa của `set -e`, thứ mà không bài TypeScript nào chạm tới.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeQueue, QueueReportError, type QueueReport } from '../scripts/merge-queue.ts';

const WORKFLOW = readFileSync(join(process.cwd(), 'ops', 'workflows', 'automerge.yml'), 'utf8');

/** Bỏ dòng chú thích: một luật khớp nhầm chữ trong chú thích là một luật chết (`P-044`). */
const WORKFLOW_CODE = WORKFLOW.split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

// ── Tầng 1 · hàm thuần ───────────────────────────────────────────────────

test('TÁI HIỆN LỖI · lượt automerge 737: #226 lỗi 405 rồi bước chết, 6 PR sau không ai xét', () => {
  // Đúng dữ liệu của lần chạy thật `2026-09-24T10:26Z`: hàng đợi 10 PR,
  // #232 merge, #231 và #229 chờ đủ 12 giờ, #226 trả HTTP 405 — rồi hết.
  const report: QueueReport = {
    queue: [232, 231, 229, 226, 225, 224, 214, 112, 84, 39],
    attempts: [
      { number: 232, ok: true, reason: 'squash merge tại a92df04' },
      { number: 226, ok: false, reason: 'Repository rule violations found 5 of 5 required status checks are expected. (HTTP 405)' },
    ],
    skipped: [
      { number: 231, outcome: 'wait', reason: 'CI xanh được 0.3 giờ, ngưỡng 12 giờ.' },
      { number: 229, outcome: 'wait', reason: 'CI xanh được 1.0 giờ, ngưỡng 12 giờ.' },
    ],
  };

  const outcome = summarizeQueue(report);

  assert.deepEqual(outcome.uncovered, [225, 224, 214, 112, 84, 39]);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0]!.number, 226);
  assert.deepEqual(outcome.merged, [232]);
  assert.equal(outcome.exitCode, 1);
  assert.match(outcome.render, /ĐÓI HÀNG ĐỢI — 6 PR/);
  // #84 và #39 đã quá khoảng chờ 12 giờ ở lượt đó; bản in phải gọi tên
  // chúng, vì "không ai xét tới" là chỗ im lặng mà mục này tồn tại để phá.
  assert.match(outcome.render, /#84/);
  assert.match(outcome.render, /#39/);
});

test('đi tiếp KHÔNG phải tha thứ · mọi PR được xét nhưng một PR lỗi thì lượt chạy vẫn ĐỎ', () => {
  const outcome = summarizeQueue({
    queue: [232, 226, 84],
    attempts: [
      { number: 232, ok: true, reason: 'squash merge tại a92df04' },
      { number: 226, ok: false, reason: 'HTTP 405' },
      { number: 84, ok: true, reason: 'squash merge tại 564c1c4' },
    ],
    skipped: [],
  });

  assert.deepEqual(outcome.uncovered, []);
  assert.deepEqual(outcome.merged, [232, 84]);
  assert.equal(outcome.exitCode, 1, 'một lời gọi merge hỏng phải làm lượt chạy đỏ');
  assert.match(outcome.render, /LỖI MERGE/);
});

test('lượt xanh vẫn in đủ MỌI PR của hàng đợi — cấm im lặng (Z2)', () => {
  const outcome = summarizeQueue({
    queue: [232, 231, 39],
    attempts: [{ number: 232, ok: true, reason: 'squash merge tại a92df04' }],
    skipped: [
      { number: 231, outcome: 'wait', reason: 'CI xanh được 0.3 giờ, ngưỡng 12 giờ.' },
      { number: 39, outcome: 'skip', reason: 'PR đang xung đột.' },
    ],
  });

  assert.equal(outcome.exitCode, 0);
  for (const number of [232, 231, 39]) {
    assert.match(outcome.render, new RegExp(`#${number}:`), `thiếu dòng cho #${number}`);
  }
  assert.match(outcome.render, /KHÔNG XÉT TỚI 0/);
});

test('`dry-run` là một kết luận, không phải một chỗ trống', () => {
  const outcome = summarizeQueue({
    queue: [232],
    attempts: [],
    skipped: [{ number: 232, outcome: 'dry-run', reason: 'định merge squash tại a92df04' }],
  });
  assert.deepEqual(outcome.uncovered, []);
  assert.equal(outcome.exitCode, 0);
});

test('hàng đợi rỗng là một câu trả lời hợp lệ', () => {
  const outcome = summarizeQueue({ queue: [], attempts: [], skipped: [] });
  assert.equal(outcome.exitCode, 0);
  assert.match(outcome.render, /Hàng đợi 0 PR/);
});

test('đầu vào hỏng thì NÉM — "không đọc được" khác "không có gì sai"', () => {
  assert.throws(() => summarizeQueue(null as unknown as QueueReport), QueueReportError);
  assert.throws(
    () => summarizeQueue({ queue: ['232'], attempts: [], skipped: [] } as unknown as QueueReport),
    QueueReportError,
  );
  assert.throws(
    () => summarizeQueue({ queue: [232], attempts: [] } as unknown as QueueReport),
    QueueReportError,
  );
  assert.throws(
    () => summarizeQueue({ queue: [232], attempts: [{ number: 232 }], skipped: [] } as unknown as QueueReport),
    QueueReportError,
  );
  // `reason` thiếu cũng phải ném, không phải in ra `undefined`: sổ sinh ra để
  // lượt sau khỏi mở log Actions, nên một dòng không nói được lý do là một
  // dòng hỏng — không phải một dòng hợp lệ có chỗ trống.
  assert.throws(
    () => summarizeQueue({ queue: [232], attempts: [{ number: 232, ok: false }], skipped: [] } as unknown as QueueReport),
    QueueReportError,
  );
  assert.throws(
    () => summarizeQueue({ queue: [232], attempts: [], skipped: [{ number: 232, outcome: 'wait' }] } as unknown as QueueReport),
    QueueReportError,
  );
});

// ── Tầng 2 · hình dạng YAML ──────────────────────────────────────────────

test('KF-029 · lời gọi merge trong `automerge.yml` KHÔNG được để trần', () => {
  assert.match(
    WORKFLOW_CODE,
    /if MERGE_OUT=\$\(gh api -X PUT "repos\/\$REPO\/pulls\/\$NUM\/merge"/,
    'lời gọi merge phải nằm trong `if MERGE_OUT=$( … )` — để trần thì `set -e` giết cả hàng đợi',
  );
  // Ca âm của chính nó: không được còn một dòng `gh api -X PUT … /merge`
  // nào ĐỨNG ĐẦU dòng lệnh (tức không có `if` phía trước).
  const bare = WORKFLOW_CODE.split('\n').filter((line) => /^\s*gh api -X PUT .*\/merge/.test(line));
  assert.deepEqual(bare, [], 'còn một lời gọi merge để trần');
});

test('KF-029 · mọi nhánh thoát của vòng lặp đều ghi sổ', () => {
  // Mỗi mẫu phải neo vào thứ RIÊNG của nhánh đó. Vòng soát ngữ cảnh sạch đo
  // được: mẫu `>> "$SKIPPED"` trần cũng khớp nhánh `dry-run`, nên khẳng định
  // cho nhánh "cổng merge cho qua" KHÔNG BAO GIỜ đỏ riêng — bỏ hẳn dòng ghi
  // sổ của nhánh đó mà 1105/1105 vẫn xanh. Một mẫu chết đúng nghĩa.
  for (const [what, pattern] of [
    ['cổng merge cho qua', /--arg outcome "\$OUTCOME"[\s\S]{0,200}?>> "\$SKIPPED"/],
    ['chạy thử', /outcome: "dry-run"[\s\S]{0,200}?>> "\$SKIPPED"/],
    ['merge xong', /ok: true[\s\S]{0,200}?>> "\$ATTEMPTS"/],
    ['merge lỗi', /ok: false[\s\S]{0,200}?>> "\$ATTEMPTS"/],
    ['hàng đợi rỗng', /\{"queue":\[\],"attempts":\[\],"skipped":\[\]\}' > "\$WORK\/report\.json"/],
  ] as const) {
    assert.match(WORKFLOW_CODE, pattern, `nhánh "${what}" không ghi sổ — PR đó thành chỗ trống`);
  }
});

test('KF-029 · sổ phải mang ĐẦU VÀO thật của hàng đợi, không phải một chuỗi rỗng', () => {
  // Hai phép phá mà vòng soát đo được là 0 bài đỏ, nay cả hai có bài khoá:
  // `--arg queue ""` làm `uncovered` vĩnh viễn rỗng (bộ dò đói hàng đợi thành
  // vô hình), và xoá hẳn dòng ghi `report.json` làm bước cuối không có sổ.
  assert.match(
    WORKFLOW_CODE,
    /jq -cn --arg queue "\$NUMS"[\s\S]{0,400}?> "\$WORK\/report\.json"/,
    'dòng dựng sổ sau vòng lặp phải lấy `queue` từ chính `$NUMS` — một chuỗi rỗng làm `uncovered` không bao giờ bật',
  );
  assert.match(
    WORKFLOW_CODE,
    /--slurpfile attempts "\$ATTEMPTS"[\s\S]{0,200}?--slurpfile skipped "\$SKIPPED"/,
    'sổ phải gom cả hai phía đầu ra',
  );
});

test('KF-029 · lời gọi merge phải giữ lại THÔNG ĐIỆP lỗi của API', () => {
  // Bỏ `2>&1` thì `MERGE_OUT` rỗng và sổ chỉ còn "có lỗi" mà không nói lỗi gì
  // — lượt sau phải mở log Actions mới biết, tức mất đúng thứ sổ sinh ra để giữ.
  assert.match(
    WORKFLOW_CODE,
    /if MERGE_OUT=\$\(gh api -X PUT[\s\S]{0,200}?2>&1\)/,
    'lời gọi merge phải gộp stderr vào `$MERGE_OUT`',
  );
});

test('KF-029 · bước kết luận tồn tại, gọi `merge-queue.ts`, và đứng SAU bước gọi workflow hậu merge', () => {
  // Cả hai mốc đo trên CÙNG một chuỗi (`WORKFLOW_CODE`): đo một mốc trên
  // bản đầy đủ rồi cắt bản đã bỏ chú thích là so hai hệ toạ độ khác nhau.
  const verdict = WORKFLOW_CODE.indexOf('- name: Kết luận hàng đợi merge');
  const dispatch = WORKFLOW_CODE.indexOf('- name: Gọi tay các workflow lẽ ra chạy theo sự kiện push');
  assert.notEqual(verdict, -1, 'mất bước kết luận — không còn gì làm lượt chạy đỏ');
  assert.notEqual(dispatch, -1, 'mất bước gọi workflow hậu merge');
  assert.ok(
    verdict > dispatch,
    'bước kết luận phải đứng SAU: đứng trước là dựng lại đúng hậu quả thứ hai của KF-029 — merge xong mà không ai gọi main-ci/sync-workflows',
  );
  assert.match(WORKFLOW_CODE.slice(verdict), /node ops\/scripts\/merge-queue\.ts "\$REPORT"/);
  assert.match(WORKFLOW_CODE.slice(verdict), /!cancelled\(\)/);
  // Sổ thiếu phải ĐỎ, không phải bỏ qua im lặng.
  assert.match(WORKFLOW_CODE.slice(verdict), /KHÔNG TRẢ LỜI ĐƯỢC[\s\S]*?exit 1/);
});

// ── Tầng 3 · hợp đồng bash↔TS ────────────────────────────────────────────

test('HIỆN TRƯỜNG · dưới `set -euo pipefail`, dạng cũ giết vòng lặp còn dạng mới thì không', () => {
  // Hai khối bash dưới đây là hai hình dạng của ĐÚNG một lời gọi: dạng cũ
  // để trần (chỗ hỏng), dạng mới bọc trong `if`. Không bài TypeScript nào
  // phân biệt được hai dạng đó — chỉ chạy thật mới phân biệt được.
  const run = (body: string): string =>
    execFileSync('bash', ['-c', `set -euo pipefail\nfor NUM in 1 2 3; do\n${body}\ndone\necho XONG`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

  const failingMerge = '[ "$NUM" != 2 ]'; // đứng thay cho `gh api … /merge` hỏng ở PR #2

  // Dạng CŨ: PR #2 hỏng → cả vòng lặp chết, #3 không bao giờ được xét.
  assert.throws(
    () => run(`  echo "xét $NUM"\n  ${failingMerge}\n  echo "  merge $NUM"`),
    /Command failed/,
  );

  // Dạng MỚI: #2 hỏng được ghi lại, #3 vẫn được xét, khối chạy tới cùng.
  const after = run(
    `  echo "xét $NUM"\n  if ${failingMerge}; then\n    echo "  merge $NUM"\n  else\n    echo "  LỖI MERGE $NUM"\n    continue\n  fi`,
  );
  assert.match(after, /xét 3/, 'PR sau PR hỏng vẫn phải được xét');
  assert.match(after, /LỖI MERGE 2/);
  assert.match(after, /XONG/);
});

test('HIỆN TRƯỜNG · CLI thoát 1 khi đói hàng đợi và 2 khi không đọc được sổ', () => {
  const cli = (input: string): { code: number; out: string } => {
    try {
      const out = execFileSync('bash', ['-c', `printf '%s' ${JSON.stringify(input)} > "$0" && node ops/scripts/merge-queue.ts "$0"`, `${process.env.RUNNER_TEMP ?? '/tmp'}/crux-merge-queue-test.json`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  };

  const starved = cli(JSON.stringify({ queue: [1, 2, 3], attempts: [{ number: 1, ok: true, reason: 'x' }], skipped: [] }));
  assert.equal(starved.code, 1);
  assert.match(starved.out, /ĐÓI HÀNG ĐỢI — 2 PR/);

  const green = cli(JSON.stringify({ queue: [], attempts: [], skipped: [] }));
  assert.equal(green.code, 0);

  const broken = cli('{ đây không phải JSON');
  assert.equal(broken.code, 2, 'không đọc được sổ phải khác cả 0 lẫn 1');
  assert.match(broken.out, /KHÔNG TRẢ LỜI ĐƯỢC/);
});
