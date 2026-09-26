/**
 * Bài kiểm của mục `platform/P-059` — `KF-043` vế đo lại.
 *
 * Bài **tái hiện lỗi** (nhãn `fix`, bất biến **I2**) là
 * `'tái hiện KF-043 · 12 tên ở đầu nhánh, 45 trong lịch sử → 33 thiếu'`: nó
 * dựng lại **đúng** hình dạng đo được lúc mở mục, bằng **tên thật** đọc từ
 * nhánh `claude/telemetry` ở commit `03e1314` (`2026-09-26T07:25:52Z`), chứ
 * không bằng tên bịa — nên nó hỏng nếu `parseStep0LogId` đổi cách đọc.
 */

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

/** Đường dẫn CLI, để các bài dưới chạy `main()` thật chứ không chỉ hàm thuần. */
const SCRIPT = new URL('../scripts/telemetry-gaps.ts', import.meta.url).pathname;
import {
  TELEMETRY_BRANCH,
  TELEMETRY_DIR,
  TelemetryGapsInputError,
  refHistoryTruncated,
  renderRestoreCommands,
  renderTelemetryGaps,
  scanTelemetryBranch,
  telemetryTipGaps,
} from '../scripts/telemetry-gaps.ts';

/**
 * Đầu nhánh lúc mở mục — 12 tên, đọc bằng
 * `git ls-tree --name-only 03e1314:heartbeat`.
 */
const TIP_AT_ONSET = [
  'step0-2026-09-26T032023Z-crux-worker-2.jsonl',
  'step0-2026-09-26T033800Z-crux-worker-1.jsonl',
  'step0-2026-09-26T042451Z-crux-worker-2.jsonl',
  'step0-2026-09-26T044001Z-crux-worker-1.jsonl',
  'step0-2026-09-26T044853Z-crux-worker-3.jsonl',
  'step0-2026-09-26T053412Z-crux-worker-3.jsonl',
  'step0-2026-09-26T053424Z-crux-worker-2.jsonl',
  'step0-2026-09-26T054003Z-crux-worker-1.jsonl',
  'step0-2026-09-26T062951Z-crux-worker-2.jsonl',
  'step0-2026-09-26T063352Z-crux-worker-3.jsonl',
  'step0-2026-09-26T064003Z-crux-worker-1.jsonl',
  'step0-2026-09-26T072525Z-crux-worker-2.jsonl',
];

/** 33 tên đã biến mất khỏi đầu nhánh, cũ nhất trước. */
const MISSING_AT_ONSET = [
  'step0-2026-09-24T083916Z-crux-worker-1.jsonl',
  'step0-2026-09-24T224216Z-crux-worker-1.jsonl',
  'step0-2026-09-24T232116Z-crux-worker-2.jsonl',
  'step0-2026-09-24T234503Z-crux-worker-1.jsonl',
  'step0-2026-09-25T002357Z-crux-worker-2.jsonl',
  'step0-2026-09-25T003923Z-crux-worker-1.jsonl',
  'step0-2026-09-25T011656Z-crux-worker-2.jsonl',
  'step0-2026-09-25T015210Z-crux-worker-1.jsonl',
  'step0-2026-09-25T023359Z-crux-worker-2.jsonl',
  'step0-2026-09-25T024400Z-crux-worker-1.jsonl',
  'step0-2026-09-25T033116Z-crux-worker-2.jsonl',
  'step0-2026-09-25T034032Z-crux-worker-1.jsonl',
  'step0-2026-09-25T042106Z-crux-worker-2.jsonl',
  'step0-2026-09-25T044153Z-crux-worker-1.jsonl',
  'step0-2026-09-25T052653Z-crux-worker-2.jsonl',
  'step0-2026-09-25T054536Z-crux-worker-1.jsonl',
  'step0-2026-09-25T064057Z-crux-worker-1.jsonl',
  'step0-2026-09-25T074711Z-crux-worker-1.jsonl',
  'step0-2026-09-25T084133Z-crux-worker-1.jsonl',
  'step0-2026-09-25T095200Z-crux-worker-1.jsonl',
  'step0-2026-09-25T105542Z-crux-worker-1.jsonl',
  'step0-2026-09-25T113923Z-crux-worker-1.jsonl',
  'step0-2026-09-25T123842Z-crux-worker-1.jsonl',
  'step0-2026-09-25T124725Z-crux-integrator.jsonl',
  'step0-2026-09-25T134339Z-crux-worker-1.jsonl',
  'step0-2026-09-26T004100Z-crux-worker-1.jsonl',
  'step0-2026-09-26T011905Z-crux-worker-2.jsonl',
  'step0-2026-09-26T012714Z-crux-worker-3.jsonl',
  'step0-2026-09-26T013917Z-crux-worker-1.jsonl',
  'step0-2026-09-26T021912Z-crux-worker-2.jsonl',
  'step0-2026-09-26T023000Z-crux-worker-1.jsonl',
  'step0-2026-09-26T023350Z-crux-worker-3.jsonl',
  'step0-2026-09-26T033126Z-crux-worker-3.jsonl',
];

/** Hợp của hai danh sách trên — 45 tên, đúng số `ever` đo được. */
const EVER_AT_ONSET = [...MISSING_AT_ONSET, ...TIP_AT_ONSET];

/** Số commit trên nhánh lúc mở mục (`git rev-list --count 03e1314`). */
const HISTORY_AT_ONSET = 64;

const onset = () => ({
  tip: TIP_AT_ONSET,
  ever: EVER_AT_ONSET,
  historyCommits: HISTORY_AT_ONSET,
  historyTruncated: false,
});

test('tái hiện KF-043 · 12 tên ở đầu nhánh, 45 trong lịch sử → 33 thiếu', () => {
  const report = telemetryTipGaps(onset());

  assert.equal(report.tipCount, 12);
  assert.equal(report.everCount, 45);
  assert.equal(report.gaps.length, 33);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(
    report.gaps.map((row) => row.name),
    MISSING_AT_ONSET,
  );
});

test('hai mốc BIÊN của 33 bản ghi thiếu, đọc bằng parseStep0LogId', () => {
  const { gaps } = telemetryTipGaps(onset());

  // Cũ nhất trước: đây là thứ tự mà bên đọc cần, và nó khoá luôn phép sắp.
  assert.deepEqual(gaps.at(0), {
    name: 'step0-2026-09-24T083916Z-crux-worker-1.jsonl',
    logId: 'step0-2026-09-24T083916Z-crux-worker-1',
    at: '2026-09-24T08:39:16Z',
    runner: 'crux-worker-1',
  });
  assert.deepEqual(gaps.at(-1), {
    name: 'step0-2026-09-26T033126Z-crux-worker-3.jsonl',
    logId: 'step0-2026-09-26T033126Z-crux-worker-3',
    at: '2026-09-26T03:31:26Z',
    runner: 'crux-worker-3',
  });
});

test('routine không phải `crux-worker-*` vẫn đọc được — `crux-integrator` có trong tập thiếu', () => {
  const { gaps } = telemetryTipGaps(onset());
  const integrator = gaps.filter((row) => row.runner === 'crux-integrator');
  assert.equal(integrator.length, 1);
  assert.equal(integrator[0]!.at, '2026-09-25T12:47:25Z');
});

test('ca âm · hai danh sách bằng nhau → rỗng, và render nói ra chứ không im', () => {
  const report = telemetryTipGaps({
    tip: TIP_AT_ONSET,
    ever: [...TIP_AT_ONSET],
    historyCommits: HISTORY_AT_ONSET,
    historyTruncated: false,
  });

  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.problems, []);

  // `Z7`: ca rỗng phải in một dòng tường minh, không phải một chuỗi rỗng.
  const render = renderTelemetryGaps(report);
  assert.match(render, /giữ đủ mọi bản ghi/);
  assert.match(render, /đầu nhánh 12 file · lịch sử 12 file qua 64 commit/);
});

test('ca âm sau khi khôi phục · ever là HỢP và tip bằng nó → rỗng', () => {
  // Đây là ca phải chạy được sau khi tiêu chí 3 xong. Nếu nó không rỗng thì
  // mục tự sinh một báo động vĩnh viễn.
  const restored = [...EVER_AT_ONSET];
  const report = telemetryTipGaps({
    tip: restored,
    ever: EVER_AT_ONSET,
    historyCommits: HISTORY_AT_ONSET,
    historyTruncated: false,
  });
  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.problems, []);
  assert.equal(report.tipCount, 45);
});

test('ca biên 1 · một tên không đúng hình dạng step0LogId → một câu trong problems, KHÔNG im lặng', () => {
  const report = telemetryTipGaps({
    tip: TIP_AT_ONSET,
    ever: [...EVER_AT_ONSET, 'README.md', 'step0-hôm-qua-crux-worker-9.jsonl'],
    historyCommits: HISTORY_AT_ONSET,
    historyTruncated: false,
  });

  // 33 tên đọc được vẫn ra đủ — một tên lạ không được kéo cả phép đo xuống.
  assert.equal(report.gaps.length, 33);
  assert.equal(report.problems.length, 2);
  assert.match(report.problems.join('\n'), /README\.md.*đuôi/s);
  assert.match(report.problems.join('\n'), /parseStep0LogId/);
  // Và nó phải tới được thân cảnh báo, không chỉ nằm trong đối tượng.
  assert.match(renderTelemetryGaps(report), /README\.md/);
});

test('ca biên 2 · lịch sử chỉ thấy MỘT commit trong khi đầu nhánh nhiều file → NÉM', () => {
  // Ca đắt nhất: `ever == tip` với một danh sách KHÔNG rỗng, nên một lưới chỉ
  // bắt "lịch sử rỗng" không thấy gì. Đo thật: `--depth=1` cho rev-list 1,
  // ever = tip = 18, sự thật 33 thiếu.
  assert.throws(
    () =>
      telemetryTipGaps({
        tip: TIP_AT_ONSET,
        ever: [...TIP_AT_ONSET],
        historyCommits: 1,
        historyTruncated: false,
      }),
    (error: unknown) => {
      assert.ok(error instanceof TelemetryGapsInputError);
      assert.match(error.message, /1 commit/);
      assert.match(error.message, /NÔNG|--depth=1/);
      assert.match(error.message, /KHÔNG được đọc thành "0 bản ghi thiếu"/);
      return true;
    },
  );
});

test('ca biên 2b · một nhánh vừa sinh THẬT (1 commit, 1 file) là ca LÀNH, không ném', () => {
  // Nếu điều kiện là `> 0` thay vì `> 1` thì lượt đẩy đầu tiên của một nhánh
  // mới tự sinh một lỗi — và cách chữa duy nhất khi đó là nới cái lưới.
  const report = telemetryTipGaps({
    tip: ['step0-2026-09-24T083916Z-crux-worker-1.jsonl'],
    ever: ['step0-2026-09-24T083916Z-crux-worker-1.jsonl'],
    historyCommits: 1,
    historyTruncated: false,
  });
  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.problems, []);
});

test('ca biên 2c · historyCommits không đo được (0, âm, không nguyên, NaN) → NÉM', () => {
  for (const value of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () =>
        telemetryTipGaps({
          tip: TIP_AT_ONSET,
          ever: EVER_AT_ONSET,
          historyCommits: value,
          historyTruncated: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof TelemetryGapsInputError);
        assert.match(error.message, /số nguyên ≥ 1/);
        return true;
      },
      `historyCommits ${value} phải ném`,
    );
  }
});

test('ca biên 3 · tên có ở đầu nhánh mà không có trong lịch sử → problems, và lý do là ĐẦU VÀO SAI', () => {
  const report = telemetryTipGaps({
    tip: [...TIP_AT_ONSET, 'step0-2026-09-27T000000Z-crux-worker-1.jsonl'],
    ever: EVER_AT_ONSET,
    historyCommits: HISTORY_AT_ONSET,
    historyTruncated: false,
  });

  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /ĐẦU VÀO KHÔNG NHẤT QUÁN/);
  // Lý do phải là "bên gọi dựng sai", KHÔNG phải "lịch sử bị viết lại": với
  // hai danh sách cùng dựng từ một `rev-list` thì `tip ⊆ ever` đúng theo cấu
  // tạo, kể cả sau một `--force`.
  assert.match(report.problems[0]!, /không phải dấu hiệu lịch sử bị viết lại/);
  // Và phần đo được vẫn đo được — một đầu vào lệch không xoá 33 bản ghi thiếu.
  assert.equal(report.gaps.length, 33);
});

test('ngưỡng là 0 — không hằng số GIỜ nào trong file, và render nói ra vì sao', () => {
  // Khoá chính câu của tiêu chí xong thứ 5, để lượt sau không "nới cho đỡ ồn":
  // mọi ngưỡng khác trong kho đo ĐỘ TRỄ (có ca lành); cái này đo MẤT DỮ LIỆU
  // trên một nhánh append-only (không có ca lành). Một hằng số giờ ở đây là
  // một cửa sổ cho phép xoá.
  const source = readFileSync(new URL('../scripts/telemetry-gaps.ts', import.meta.url), 'utf8');
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');

  assert.doesNotMatch(code, /_HOURS\b/, 'không được có hằng số giờ nào trong mã');
  assert.doesNotMatch(code, /TOLERANCE/, 'không dung sai nào — 0 là 0');

  // Một bản ghi thiếu là đủ để báo động: không có "thiếu ít thì bỏ qua".
  const one = telemetryTipGaps({
    tip: TIP_AT_ONSET.slice(1),
    ever: TIP_AT_ONSET,
    historyCommits: HISTORY_AT_ONSET,
    historyTruncated: false,
  });
  assert.equal(one.gaps.length, 1);
  assert.match(renderTelemetryGaps(one), /Ngưỡng là 0/);
});

test('render chỉ tới đúng MỘT lệnh gỡ, không một câu văn bảo chủ dự án làm gì', () => {
  // Tiêu chí xong thứ 7: một cảnh báo gọi CHỦ DỰ ÁN cho một việc chỉ MÁY làm
  // được là ngược thước đo CHARTER 1.3 — đúng lỗi `P-056` đã mắc một lần.
  const render = renderTelemetryGaps(telemetryTipGaps(onset()));
  assert.match(render, /pnpm telemetry:restore/);
  assert.doesNotMatch(render, /\banh\b/, 'không dòng nào đẩy việc sang chủ dự án');
});

test('lệnh khôi phục thuần CỘNG THÊM — không --force, không xoá entry nào', () => {
  const commands = renderRestoreCommands(onset(), 'refs/crux/telemetry');

  // Chỉ soi các dòng LỆNH: khối chú thích có nhắc `--force` để nói rằng nó
  // không được dùng, và một phép so trên cả chuỗi sẽ đỏ vì đúng câu ấy.
  const runnable = commands
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  assert.doesNotMatch(runnable, /--force|-f\b/);
  // `git push` phải đẩy vào một ref THƯỜNG, không `+` (không ép ghi đè).
  assert.match(runnable, /git push origin "\$COMMIT:refs\/heads\/claude\/telemetry"/);
  assert.doesNotMatch(runnable, /\+refs\/heads/);
  // Cây GỐC cũng phải dựng thêm: một `mktree` chỉ mang entry `heartbeat` xoá
  // mọi thứ khác ở gốc nhánh — đúng một trong ba chỗ hỏng cùng họ mà vòng
  // soát của `#281` tìm ra.
  assert.match(commands, /OLD_ROOT=\$\(git ls-tree "\$REF"\)/);
  assert.match(commands, /\$2 != n/);
  // Cây không đổi thì không commit: một commit rỗng làm nhịp tim trông như
  // vừa đập, tức nó động vào dấu hiệu số 5.
  assert.match(commands, /không có gì để khôi phục/);
  // Trailer bắt buộc, và nó không sửa được về sau (`CLAUDE.md` mục 6).
  assert.match(commands, /Co-Authored-By: Claude <noreply@anthropic\.com>/);
  assert.match(commands, /Claude-Session:/);
  // Và không tên model nào (`KF-014`).
  assert.doesNotMatch(commands, /Opus|Sonnet|Haiku|claude-[a-z0-9-]*\d/);
});

test('hằng số nhánh và thư mục khai MỘT chỗ, khớp chỗ telemetry-beat.ts ghi vào', () => {
  assert.equal(TELEMETRY_BRANCH, 'claude/telemetry');
  assert.equal(TELEMETRY_DIR, 'heartbeat');

  // Một bản chép thứ hai của hai cái tên này sẽ lệch im lặng: `telemetry-beat.ts`
  // ghi vào `heartbeat/` trên `claude/telemetry`, và phép đo ở đây đọc đúng
  // chỗ đó. Đối chiếu với chính file kia thay vì tin lời.
  const beat = readFileSync(new URL('../scripts/telemetry-beat.ts', import.meta.url), 'utf8');
  assert.ok(
    beat.includes(`'${TELEMETRY_BRANCH}'`) || beat.includes(`"${TELEMETRY_BRANCH}"`),
    'telemetry-beat.ts phải ghi vào đúng nhánh mà phép đo này đọc',
  );
  assert.ok(
    beat.includes(`'${TELEMETRY_DIR}'`) || beat.includes(`"${TELEMETRY_DIR}"`),
    'telemetry-beat.ts phải ghi vào đúng thư mục mà phép đo này đọc',
  );
});

test('watchdog.yml KHÔNG fetch nhánh telemetry bằng --depth=1 nữa', () => {
  // Tiêu chí xong thứ 4, và nó là chỗ hỏng BÁO YÊN đã đo được: với
  // `--depth=1` thì `rev-list --count` = 1, `ever` = `tip`, phép đo trả
  // "0 thiếu" trong khi sự thật là 33. Bài này khoá chiều đó ở đúng file mà
  // một lượt sau sẽ sửa "cho rẻ".
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  // `watchdog.yml` trỏ tới nhánh qua biến môi trường `TELEMETRY_BRANCH`, và
  // giá trị của biến đó được so với hằng của kho ở bài dưới — nên ở đây bắt
  // CẢ hai cách viết, để bài không im lặng nếu một lượt sau đổi sang tên thẳng.
  const fetches = yaml
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .filter(
      (line) =>
        line.includes('git fetch') &&
        (line.includes('$TELEMETRY_BRANCH') || line.includes(TELEMETRY_BRANCH)),
    );

  assert.ok(fetches.length > 0, 'watchdog.yml phải còn fetch nhánh telemetry');
  for (const line of fetches) {
    assert.doesNotMatch(
      line,
      /--depth=/,
      `lần fetch nhánh telemetry không được có trần độ sâu: ${line.trim()}`,
    );
  }
});

test('watchdog.yml khai TELEMETRY_BRANCH đúng bằng hằng của kho', () => {
  // Nếu hai bản lệch nhau thì bài ở trên soi một lần fetch của nhánh khác, và
  // lần fetch thật lại có thể mang `--depth` mà không gì đỏ.
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  assert.match(yaml, new RegExp(`TELEMETRY_BRANCH: '${TELEMETRY_BRANCH}'`));
});

test('watchdog.yml có dấu hiệu số 8 và nó gọi đúng script này', () => {
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  assert.match(yaml, /telemetry-gaps\.ts/);
  assert.match(yaml, /dấu hiệu số 8/);
  // Ngưỡng 0 nằm ở YAML dạng "có bản ghi thiếu nào không", không phải một
  // hằng số giờ chép tay — cùng luật dấu hiệu số 7 đã dùng cho ngưỡng của nó.
  assert.match(yaml, /GAPS_MISSING/);
  // Tên trường JSON phải là `gaps`, KHÔNG phải `missing`: `heartbeat-source.ts`
  // dùng `.missing` cho một nghĩa khác, và một bài của nó canh rằng không dòng
  // nào của `watchdog.yml` đọc `.missing` ngoài chỗ của nó.
  assert.match(yaml, /has\("gaps"\)/);
});

// ---------------------------------------------------------------------------
// Các bài dưới đây do **vòng soát bước 6** của `P-059` đòi: nó đo được rằng
// lưới `historyCommits === 1` chỉ phủ `--depth=1`, và rằng tầng CLI cùng hai
// dòng YAML sống sót qua mọi bài kiểm của kho.
// ---------------------------------------------------------------------------

test('lưới THẬT của lịch sử bị cắt đúng với MỌI N, không chỉ N = 1', () => {
  // Đây là phần ĐÚNG và chịu tải của CHẶN mà vòng soát báo: với `--depth=5`
  // thì `historyCommits` = 5 > 1, `ever` = `tip`, và lưới ca 2 không bật. Tái
  // lập được: N = 2, 5, 30 đều từng cho "giữ đủ".
  for (const historyCommits of [2, 5, 30, 1000]) {
    const report = telemetryTipGaps({
      tip: TIP_AT_ONSET,
      ever: [...TIP_AT_ONSET],
      historyCommits,
      historyTruncated: true,
    });
    assert.equal(report.gaps.length, 0, 'không đo được thì không bịa ra bản ghi thiếu');
    assert.equal(report.problems.length, 1, `N=${historyCommits} phải ra một câu problems`);
    assert.match(report.problems[0]!, /CẬN DƯỚI/);
    assert.match(report.problems[0]!, /không phải "đầu nhánh giữ đủ"/);
    // Và nó phải tới được thân cảnh báo, không chỉ nằm trong đối tượng.
    const render = renderTelemetryGaps(report);
    assert.match(render, /CẬN DƯỚI/);
    // Dòng tiêu đề KHÔNG được khẳng định ca lành trong khi `ever` là cận dưới:
    // bản đầu in đúng câu "giữ đủ" cộng một dòng problems mâu thuẫn với nó.
    assert.match(render, /KHÔNG kết luận được/);
    assert.doesNotMatch(render.split('\n')[0]!, /giữ đủ/);
  }
});

test('`historyTruncated` là trường BẮT BUỘC — thiếu thì NÉM, không mặc định `false`', () => {
  // Mặc định duy nhất nghe hợp lý (`false`) là đúng chiều BÁO YÊN, nên nó
  // không được tồn tại.
  assert.throws(
    () =>
      telemetryTipGaps({
        tip: TIP_AT_ONSET,
        ever: EVER_AT_ONSET,
        historyCommits: HISTORY_AT_ONSET,
      } as unknown as Parameters<typeof telemetryTipGaps>[0]),
    (error: unknown) => {
      assert.ok(error instanceof TelemetryGapsInputError);
      assert.match(error.message, /`historyTruncated` phải là boolean/);
      assert.match(error.message, /BÁO YÊN/);
      return true;
    },
  );
});

test('`refHistoryTruncated` KHÔNG dùng cờ nông của cả kho', () => {
  // Cờ `--is-shallow-repository` nói về cả kho và cho `true` trong khi ref này
  // đầy đủ — nhánh telemetry có gốc riêng nên biên nông của `main` không cắt
  // được nó. Đo thật ở đầu `telemetry-gaps.ts`. Một bản sửa "cho gọn" quay về
  // cờ đó sẽ làm watchdog báo "không đo được" mỗi giờ cho một nhánh lành.
  const source = readFileSync(new URL('../scripts/telemetry-gaps.ts', import.meta.url), 'utf8');
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');

  assert.doesNotMatch(code, /is-shallow-repository/, 'phép đo phải hẹp theo REF, không theo kho');
  assert.match(code, /--git-path', 'shallow'/, 'phải đọc danh sách biên nông');
});

/** Chạy CLI thật và trả về mã thoát cùng hai luồng. */
function runCli(args: readonly string[]): { status: number; stdout: string; stderr: string } {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: run.status ?? -1, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

test('CLI · hợp đồng mã thoát 0/1/2 — đây là thứ CHARTER P1 0e và CLAUDE.md mục 1 khai', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-gaps-'));
  const tip = join(dir, 'tip.txt');
  const ever = join(dir, 'ever.txt');

  // Thoát 0: đầu nhánh giữ đủ.
  writeFileSync(tip, `${TIP_AT_ONSET.join('\n')}\n`);
  writeFileSync(ever, `${TIP_AT_ONSET.join('\n')}\n`);
  const ok = runCli(['--tip', tip, '--ever', ever, '--history-commits', '64', '--history-truncated', 'false']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /giữ đủ mọi bản ghi/);

  // Thoát 1: CÓ bản ghi thiếu. Đây là một phán quyết, không phải lỗi.
  writeFileSync(ever, `${EVER_AT_ONSET.join('\n')}\n`);
  const missing = runCli(['--tip', tip, '--ever', ever, '--history-commits', '64', '--history-truncated', 'false']);
  assert.equal(missing.status, 1, missing.stderr);
  assert.match(missing.stdout, /THIẾU ở đầu nhánh .*: 33/);

  // Thoát 1 với `--json`: bên gọi máy đọc được, và `gaps` là tên trường.
  const asJson = runCli(['--json', '--tip', tip, '--ever', ever, '--history-commits', '64', '--history-truncated', 'false']);
  assert.equal(asJson.status, 1);
  const parsed = JSON.parse(asJson.stdout) as { gaps: unknown[]; problems: unknown[]; render: string };
  assert.equal(parsed.gaps.length, 33);
  assert.deepEqual(parsed.problems, []);
  assert.match(parsed.render, /THIẾU ở đầu nhánh/);

  // Thoát 2: KHÔNG ĐO ĐƯỢC. Khác hẳn thoát 1, và hai ca đi hai đường ở YAML.
  const cannot = runCli(['--tip', tip, '--ever', ever, '--history-commits', '1', '--history-truncated', 'false']);
  assert.equal(cannot.status, 2, cannot.stdout);
  assert.match(cannot.stderr, /KHÔNG ĐO ĐƯỢC/);
  assert.equal(cannot.stdout, '', 'ca không đo được KHÔNG được in một báo cáo ra stdout');

  // Thoát 2: thiếu `--history-truncated`.
  const noFlag = runCli(['--tip', tip, '--ever', ever, '--history-commits', '64']);
  assert.equal(noFlag.status, 2);
  assert.match(noFlag.stderr, /--history-truncated/);

  // Thoát 2: `--history-truncated` giá trị lạ — KHÔNG đọc thành `false`.
  const badFlag = runCli(['--tip', tip, '--ever', ever, '--history-commits', '64', '--history-truncated', 'maybe']);
  assert.equal(badFlag.status, 2);

  rmSync(dir, { recursive: true, force: true });
});

test('CLI · lần fetch của CHÍNH script không mang trần độ sâu', () => {
  // `pnpm telemetry:gaps` và `pnpm telemetry:restore` fetch lấy ref. Một
  // `--depth` ở đó dựng lại đúng chỗ hỏng mà mục này bỏ, và tầng CLI trước
  // vòng soát không có bài nào canh.
  const source = readFileSync(new URL('../scripts/telemetry-gaps.ts', import.meta.url), 'utf8');
  const fetchCall = /git\(\[\s*'fetch'[^\]]*\]\)/s.exec(source);
  assert.ok(fetchCall, 'script phải còn tự fetch ref ở chế độ --from-remote');
  assert.doesNotMatch(fetchCall[0], /depth/, `lần fetch không được có trần độ sâu: ${fetchCall[0]}`);
});

test('watchdog.yml · `$GAPS_REPORT` thật sự đi vào THÂN cảnh báo', () => {
  // Đột biến sống sót qua mọi bài kiểm của kho trước vòng soát: xoá
  // `"$GAPS_REPORT" \` khỏi `BODY`. Chi tiết dấu hiệu 8 khi đó không bao giờ
  // tới tay chủ dự án — cùng chỗ hỏng mà `heartbeat-source.test.ts` đã canh
  // cho `$BEAT_REPORT`.
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  const body = /BODY=\$\(printf[\s\S]*?\)\n\n/.exec(yaml);
  assert.ok(body, 'không tìm thấy khối `BODY=$(printf …)`');
  assert.match(body[0], /\$GAPS_REPORT/);
});

test('watchdog.yml · dấu hiệu 8 thật sự GỌI `add`, không chỉ in ra log', () => {
  // Đột biến sống sót: đổi `if [ "$GAPS_MISSING" -gt 0 ]` thành `if false`.
  // Bài cũ chỉ đòi chuỗi `GAPS_MISSING` xuất hiện, mà sau đột biến nó vẫn còn —
  // tức script chạy mỗi giờ nhưng không còn là một DẤU HIỆU.
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  const exec = yaml.split('\n').filter((line) => !line.trimStart().startsWith('#'));

  const guard = exec.findIndex((line) => /if \[ "\$GAPS_MISSING" -gt 0 \]/.test(line));
  assert.ok(guard >= 0, 'phải còn phép so số bản ghi thiếu với 0');
  assert.match(exec.slice(guard, guard + 4).join('\n'), /\badd "/, 'ngưỡng vượt phải GỌI `add`');

  const problemGuard = exec.findIndex((line) => /if \[ "\$GAPS_PROBLEMS" -gt 0 \]/.test(line));
  assert.ok(problemGuard >= 0, 'phải còn phép so số chỗ không đo được với 0');
  assert.match(exec.slice(problemGuard, problemGuard + 4).join('\n'), /\badd "/);

  // Và ca "chưa có ref" cũng không được im khi nhánh CÓ trên remote: một lần
  // fetch trượt là "không đo được", không phải "chưa tồn tại".
  //
  // Soi DÒNG THỰC THI, không soi cả file: khối chú thích ngay trên phép kiểm
  // cũng nhắc `ls-remote --exit-code --heads`, nên một phép so trên cả `yaml`
  // vẫn xanh sau khi xoá đúng dòng lệnh — đo được bằng phá thử.
  const lsRemote = exec.findIndex((line) =>
    /git ls-remote --exit-code --heads origin/.test(line),
  );
  assert.ok(lsRemote >= 0, 'phải còn phép phân biệt "nhánh chưa sinh" với "fetch trượt"');
  assert.match(exec.slice(lsRemote, lsRemote + 4).join('\n'), /GAPS_PROBLEMS=1/);
});

test('watchdog.yml · truyền `--history-truncated` cho script, không để nó đoán', () => {
  const yaml = readFileSync(new URL('../workflows/watchdog.yml', import.meta.url), 'utf8');
  assert.match(yaml, /--history-truncated "\$GAPS_TRUNCATED"/);
  // Và YAML phải tự đo nó bằng giao của biên nông với lịch sử ref, không bằng
  // cờ nông của cả kho.
  assert.match(yaml, /--git-path shallow/);
  assert.doesNotMatch(
    yaml.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n'),
    /is-shallow-repository/,
  );
});

test('CLI · `--restore` in KHỐI LỆNH ra stdout, báo cáo ra stderr, thoát 0', () => {
  // Tiêu chí xong thứ 6 đòi đường gỡ là MỘT lệnh, nên nó phải DÙNG ĐƯỢC:
  // `… > r.sh && bash r.sh`. Bản đầu in cả hai luồng ra stdout rồi thoát 1, nên
  // `&&` không bao giờ chạy và `| bash` thì chạy cả các dòng báo cáo.
  const source = readFileSync(new URL('../scripts/telemetry-gaps.ts', import.meta.url), 'utf8');
  const restoreBlock = /if \(restore\) \{[\s\S]*?\n  \}/.exec(source);
  assert.ok(restoreBlock, 'không tìm thấy nhánh `--restore` của `main()`');

  assert.match(restoreBlock[0], /stderr\.write\(`\$\{renderTelemetryGaps/, 'báo cáo phải ra stderr');
  assert.match(restoreBlock[0], /stdout\.write\(`\$\{renderRestoreCommands/, 'lệnh phải ra stdout');
  assert.doesNotMatch(restoreBlock[0], /process\.exit/, 'in được lệnh thì thoát 0');

  // Và `-s` phải được khai ở cả hai nguồn thẩm quyền: không có nó, `pnpm` in hai
  // dòng nhãn của chính nó vào stdout và `bash` chạy chúng thành lỗi (đo được).
  for (const doc of ['../../CLAUDE.md', '../../CHARTER.md']) {
    const text = readFileSync(new URL(doc, import.meta.url), 'utf8');
    assert.match(text, /pnpm -s telemetry:restore/, `${doc} phải khai dạng \`pnpm -s\``);
  }
});

// ---------------------------------------------------------------------------
// Hai bài dưới đây chạy **git thật** trên một kho tạm, vì hai chỗ chúng canh
// không dựng lại được bằng hàm thuần — và phá thử đo được là không bài nào
// trong file này bắt chúng: `refHistoryTruncated` luôn trả `false`, và
// `cat-file -e` mất phép tách "không có thư mục" khỏi "lỗi thật", đều sống sót.
// Cùng cách `ops/test/telemetry-beat.test.ts` làm: kho tạm, remote bare, không
// mạng, dọn sau khi xong.
// ---------------------------------------------------------------------------

/** Chạy `git` trong `cwd`, ném khi thoát khác 0. */
function g(cwd: string, ...args: string[]): string {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr}`);
  return (run.stdout ?? '').trim();
}

/** Một remote bare mang nhánh `claude/telemetry` gồm `count` commit. */
function makeRemote(count: number): { dir: string; bare: string; work: string } {
  const dir = mkdtempSync(join(tmpdir(), 'crux-gaps-git-'));
  const bare = join(dir, 'remote.git');
  const work = join(dir, 'work');
  g(dir, 'init', '-q', '--bare', bare);
  g(dir, 'init', '-q', work);
  for (const [k, v] of [
    ['user.email', 'noreply@anthropic.com'],
    ['user.name', 'Claude'],
    ['commit.gpgsign', 'false'],
  ]) {
    g(work, 'config', k!, v!);
  }
  mkdirSync(join(work, TELEMETRY_DIR), { recursive: true });
  for (let i = 0; i < count; i += 1) {
    const name = `step0-2026-09-2${(i % 5) + 1}T0${i}0000Z-crux-worker-1.jsonl`;
    writeFileSync(join(work, TELEMETRY_DIR, name), '{}\n');
    g(work, 'add', '-A');
    g(work, 'commit', '-q', '-m', `nhịp tim ${i}`);
  }
  g(work, 'branch', '-M', 'claude/telemetry');
  g(work, 'remote', 'add', 'origin', bare);
  g(work, 'push', '-q', 'origin', 'claude/telemetry');

  // Nhánh thứ hai, GỐC RIÊNG, mô phỏng `main`: nó là nhánh mà
  // `actions/checkout` fetch NÔNG. Phải là một nhánh khác và không chung lịch
  // sử — đúng quan hệ thật giữa `main` và `claude/telemetry` (đo được:
  // `git merge-base` không trả gì). Fetch LẠI cùng một nhánh vào một ref khác
  // KHÔNG mô phỏng được ca này, vì git đã có sẵn các object nông nên lần fetch
  // sau không đào sâu thêm — chính chỗ một phép mô phỏng dễ đi sai.
  g(work, 'checkout', '-q', '--orphan', 'mainsim');
  g(work, 'rm', '-r', '-q', '--cached', '.');
  rmSync(join(work, TELEMETRY_DIR), { recursive: true, force: true });
  for (let i = 0; i < 3; i += 1) {
    writeFileSync(join(work, `f${i}.txt`), `${i}\n`);
    g(work, 'add', '-A');
    g(work, 'commit', '-q', '-m', `mainsim ${i}`);
  }
  g(work, 'push', '-q', 'origin', 'mainsim');
  g(work, 'checkout', '-q', 'claude/telemetry');
  return { dir, bare, work };
}

test('refHistoryTruncated · phép đo HẸP theo ref — biên nông của nhánh KHÁC không tính', () => {
  const { dir, bare } = makeRemote(6);
  const cwd = process.cwd();

  // HAI kho riêng, không phải hai ref trong một kho: fetch NÔNG cùng một nhánh
  // vào một ref thứ hai làm git cắt LẠI chính các object đã có, nên ref "đầy
  // đủ" tụt xuống theo. Đo được khi dựng bài này, và nó cũng là lý do một phép
  // mô phỏng trong MỘT kho dễ kết luận sai về chỗ hỏng.
  const healthy = join(dir, 'healthy');
  const truncated = join(dir, 'truncated');
  g(dir, 'init', '-q', healthy);
  g(dir, 'init', '-q', truncated);
  g(healthy, 'remote', 'add', 'origin', bare);
  g(truncated, 'remote', 'add', 'origin', bare);

  try {
    // Kho LÀNH — đúng thứ tự `watchdog.yml` làm: `actions/checkout` fetch NÔNG
    // nhánh mô phỏng `main` (gốc riêng, không chung lịch sử với telemetry), rồi
    // lượt chạy fetch nhánh telemetry KHÔNG `--depth`.
    g(healthy, 'fetch', '--no-tags', '--depth=1', 'origin', '+refs/heads/mainsim:refs/mainsim');
    g(healthy, 'fetch', '--no-tags', 'origin', '+refs/heads/claude/telemetry:refs/crux/telemetry');

    process.chdir(healthy);
    assert.equal(g(healthy, 'rev-parse', '--is-shallow-repository'), 'true', 'kho PHẢI đang nông');
    // Cờ của CẢ KHO nói `true`, nhưng ref telemetry lấy đủ 6 commit — nên dùng
    // cờ đó làm phép đo sẽ báo động mỗi giờ cho một nhánh đang lành.
    assert.equal(g(healthy, 'rev-list', '--count', 'refs/crux/telemetry'), '6');
    assert.equal(
      refHistoryTruncated('refs/crux/telemetry'),
      false,
      'ref đầy đủ KHÔNG được báo là bị cắt, dù cả kho đang nông',
    );
    assert.equal(refHistoryTruncated('refs/mainsim'), true, 'ref fetch nông thì bị cắt thật');

    // Kho BỊ CẮT — `--depth=2`, tức N = 2, đúng chỗ lưới `historyCommits === 1`
    // không bắt được.
    g(truncated, 'fetch', '--no-tags', '--depth=2', 'origin', '+refs/heads/claude/telemetry:refs/crux/telemetry');
    process.chdir(truncated);
    assert.equal(g(truncated, 'rev-list', '--count', 'refs/crux/telemetry'), '2');
    assert.equal(refHistoryTruncated('refs/crux/telemetry'), true);
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scanTelemetryBranch · "không có heartbeat/" là ca LÀNH, một lỗi THẬT thì NÉM', () => {
  const { dir, bare, work } = makeRemote(3);
  // Thêm một commit KHÔNG có `heartbeat/` làm gốc mới, để có ca "thư mục vắng".
  g(work, 'rm', '-r', '-q', TELEMETRY_DIR);
  g(work, 'commit', '-q', '-m', 'bỏ heartbeat');
  writeFileSync(join(work, 'README.md'), 'x\n');
  mkdirSync(join(work, TELEMETRY_DIR), { recursive: true });
  writeFileSync(join(work, TELEMETRY_DIR, 'step0-2026-09-26T090000Z-crux-worker-2.jsonl'), '{}\n');
  g(work, 'add', '-A');
  g(work, 'commit', '-q', '-m', 'có lại heartbeat');
  g(work, 'push', '-q', 'origin', 'claude/telemetry');

  const clone = join(dir, 'clone2');
  g(dir, 'init', '-q', clone);
  g(clone, 'remote', 'add', 'origin', bare);
  g(clone, 'fetch', '--no-tags', 'origin', '+refs/heads/claude/telemetry:refs/crux/telemetry');

  const cwd = process.cwd();
  try {
    process.chdir(clone);
    const scan = scanTelemetryBranch('refs/crux/telemetry');
    // Commit giữa KHÔNG có `heartbeat/` — ca lành, không ném, và không làm mất
    // bản ghi của các commit khác.
    assert.equal(scan.historyCommits, 5);
    assert.equal(scan.historyTruncated, false);
    assert.equal(scan.tip.length, 1);
    assert.equal(new Set(scan.ever).size, 4, 'ba bản ghi cũ cộng một bản mới');

    // Một revision KHÔNG tồn tại là lỗi THẬT: phải ném, không được trả rỗng —
    // trả rỗng làm `ever` nhỏ đi, tức số bản ghi thiếu nhỏ đi (BÁO YÊN).
    assert.throws(
      () => scanTelemetryBranch('refs/crux/khong-co-ref-nay'),
      (error: unknown) => {
        assert.ok(error instanceof TelemetryGapsInputError);
        assert.match(error.message, /KHÔNG đo được/);
        return true;
      },
    );
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
