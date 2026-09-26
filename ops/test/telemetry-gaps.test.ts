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
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  TELEMETRY_BRANCH,
  TELEMETRY_DIR,
  TelemetryGapsInputError,
  renderRestoreCommands,
  renderTelemetryGaps,
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
  });
  assert.deepEqual(report.gaps, []);
  assert.deepEqual(report.problems, []);
});

test('ca biên 2c · historyCommits không đo được (0, âm, không nguyên, NaN) → NÉM', () => {
  for (const value of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () => telemetryTipGaps({ tip: TIP_AT_ONSET, ever: EVER_AT_ONSET, historyCommits: value }),
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
  const commands = renderRestoreCommands(
    { ...onset(), shallow: false },
    'refs/crux/telemetry',
  );

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
  assert.match(yaml, /jq -r '\.gaps \| length'/);
});
