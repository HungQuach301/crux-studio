/**
 * Mục `platform/P-043` — nhịp tim của routine đọc được mà **không** cần một
 * PR nào merge.
 *
 * Bài kiểm ở đây khoá hai chiều hỏng, và chiều thứ hai mới là chiều đắt:
 *
 * 1. **Chiều gọi người oan** (đã xảy ra thật, `🤖 [QĐ] #213`): nhịp tim chỉ
 *    đọc từ `main`, nên một khoảng yên làm người canh `@nhắc` chủ dự án vì
 *    một nhà máy đang chạy đúng.
 * 2. **Chiều làm người canh câm** (nhóm **Z**, chưa xảy ra và phải không bao
 *    giờ xảy ra): nguồn mới **thay** nguồn cũ, nên trong khoảng nguồn mới còn
 *    rỗng thì không nguồn nào trả lời, `@nhắc` biến mất, và không gì đỏ. Đó
 *    đúng điều kiện chủ dự án đặt ra — *"Không có khoảng thời gian nào
 *    watchdog mất tín hiệu"*.
 *
 * Mỗi ca cho qua đi kèm ca âm của nó (bài học `KF-003`): một luật không bao
 * giờ đỏ là một luật vô giá trị.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { step0LogRef } from '../../kernel/src/log.ts';
import {
  heartbeat,
  heartbeatProblems,
  parseSourceArgs,
  readHeartbeatSource,
  renderHeartbeat,
} from '../scripts/heartbeat-source.ts';
import {
  TELEMETRY_BRANCH,
  TELEMETRY_DIR,
  beatContent,
  beatFileProblems,
  telemetryPushCommands,
  telemetryTargetPath,
} from '../scripts/telemetry-beat.ts';

const WATCHDOG = 'ops/workflows/watchdog.yml';

/** Một dòng log bước 0 thật, `ref` do chính kernel sinh ra (không ghép tay). */
function beat(at: string, runner = 'crux-worker-1'): string {
  return `${JSON.stringify({
    at,
    lane: 'integration',
    kind: 'lane',
    ref: step0LogRef(at, runner),
    status: 'ok',
    durationMs: 0,
    costUsd: 0,
    note: 'không có PR xung đột',
  })}\n`;
}

/** Một dòng log KHÔNG phải bước 0 — dùng làm ca âm ở nhiều bài dưới. */
function work(at: string): string {
  return `${JSON.stringify({
    at,
    lane: 'platform',
    kind: 'lane',
    ref: 'platform/P-043',
    status: 'ok',
    durationMs: 0,
    costUsd: 0,
  })}\n`;
}

/** Thư mục tạm, tự dọn — không chạm cây làm việc. */
function scratch(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-heartbeat-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

// ── Phép `max` trên nhiều nguồn ───────────────────────────────────────────

test('nhịp tim là `max` trên hai nguồn, và `winner` nói nguồn nào trả lời', () => {
  const main = scratch({ 'integration/step0-a.jsonl': beat('2026-09-24T06:00:00Z') });
  const tele = scratch({ 'step0-b.jsonl': beat('2026-09-24T08:00:00Z', 'crux-worker-2') });
  try {
    const report = heartbeat([
      { name: 'main', dir: main },
      { name: 'telemetry', dir: tele },
    ]);
    assert.equal(report.at, '2026-09-24T08:00:00.000Z');
    assert.equal(report.winner, 'telemetry');
    assert.deepEqual(report.problems, []);
  } finally {
    rmSync(main, { recursive: true, force: true });
    rmSync(tele, { recursive: true, force: true });
  }
});

test('thứ tự khai nguồn KHÔNG đổi `at` — phép `max` giao hoán', () => {
  // Ca âm của một bản cài đặt "lấy nguồn đầu tiên trả lời được": nó cho hai
  // kết quả khác nhau cho cùng một dữ liệu, tuỳ thứ tự đối số.
  const older = scratch({ 'a.jsonl': beat('2026-09-24T06:00:00Z') });
  const newer = scratch({ 'b.jsonl': beat('2026-09-24T08:00:00Z', 'crux-worker-2') });
  try {
    const forward = heartbeat([
      { name: 'older', dir: older },
      { name: 'newer', dir: newer },
    ]);
    const backward = heartbeat([
      { name: 'newer', dir: newer },
      { name: 'older', dir: older },
    ]);
    assert.equal(forward.at, backward.at);
    assert.equal(forward.winner, 'newer');
    assert.equal(backward.winner, 'newer');
  } finally {
    rmSync(older, { recursive: true, force: true });
    rmSync(newer, { recursive: true, force: true });
  }
});

test('TÁI HIỆN chiều làm người canh câm: THAY nguồn thì nhịp tim mất, CỘNG nguồn thì không', () => {
  // Đây là bài chính của mục này. Dựng đúng khoảng chuyển tiếp: workflow mới
  // đã lên `main`, nhánh telemetry đã tồn tại, nhưng chưa lượt routine nào
  // ghi vào nó. `main` vẫn còn nhịp tim mới.
  const main = scratch({ 'integration/step0-a.jsonl': beat('2026-09-24T08:00:00Z') });
  const teleEmpty = scratch({ '.keep': '' });
  try {
    // Bản THAY nguồn — chỉ đọc telemetry:
    const replaced = heartbeat([{ name: 'telemetry', dir: teleEmpty }]);
    assert.equal(replaced.at, null, 'bản THAY nguồn phải mất nhịp tim — đó là chỗ hỏng cần tái hiện');

    // Bản CỘNG nguồn — đọc cả hai:
    const added = heartbeat([
      { name: 'main', dir: main },
      { name: 'telemetry', dir: teleEmpty },
    ]);
    assert.equal(added.at, '2026-09-24T08:00:00.000Z');
    assert.equal(added.winner, 'main', 'trong khoảng chuyển tiếp, `main` phải là nguồn giữ nhịp tim');
  } finally {
    rmSync(main, { recursive: true, force: true });
    rmSync(teleEmpty, { recursive: true, force: true });
  }
});

// ── Cấm im lặng: ba trạng thái, không phải hai ────────────────────────────

test('nguồn KHÔNG TỒN TẠI khác nguồn RỖNG, và cả hai đều nói ra', () => {
  const empty = scratch({ '.keep': '' });
  try {
    const missing = readHeartbeatSource({ name: 'telemetry', dir: join(empty, 'không-có-thư-mục-này') });
    assert.equal(missing.missing, true);
    assert.equal(missing.at, null);

    const present = readHeartbeatSource({ name: 'telemetry', dir: empty });
    assert.equal(present.missing, false, 'thư mục CÓ mà bị gọi là `missing` thì "fetch hỏng" và "chưa ai ghi" lẫn nhau');
    assert.equal(present.at, null);

    // Ca âm: nếu hai trạng thái bị gộp thì hai câu báo cáo sẽ giống nhau.
    const a = heartbeatProblems([missing]);
    const b = heartbeatProblems([present]);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.notEqual(a[0], b[0]);
    assert.match(a[0]!, /KHÔNG TỒN TẠI/);
    assert.match(b[0]!, /KHÔNG dòng nào là dòng bước 0/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('nguồn có dòng log mà KHÔNG dòng nào là bước 0 vẫn phải báo ra', () => {
  // Đây là hình dạng `ref` đã đổi mà không ai sửa bộ lọc: file có, dòng có,
  // và nhịp tim là `null`. Im lặng ở đây là đúng thứ nhóm Z cấm.
  const dir = scratch({ 'platform/P-043.jsonl': work('2026-09-24T08:00:00Z') });
  try {
    const reading = readHeartbeatSource({ name: 'main', dir });
    assert.equal(reading.lines, 1);
    assert.equal(reading.step0Lines, 0);
    assert.equal(reading.at, null);
    assert.match(heartbeatProblems([reading])[0]!, /KHÔNG dòng nào là dòng bước 0/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('một nguồn hỏng thành MỘT DÒNG báo cáo, không thành ngoại lệ giết cả phép đo', () => {
  // `parseRunLogs` của kernel NÉM khi `costUsd` không phải số. Dấu hiệu số 5
  // là một trong sáu dấu hiệu của người canh; để ngoại lệ đó nổi lên là nuốt
  // năm dấu hiệu kia (đúng luật Z9 mà `watchdog.yml` ghi cho từng chỗ nuốt lỗi).
  const broken = scratch({ 'x.jsonl': '{"at":"2026-09-24T08:00:00Z","ref":"integration/step0-x","costUsd":"0"}\n' });
  const main = scratch({ 'integration/step0-a.jsonl': beat('2026-09-24T07:00:00Z') });
  try {
    const report = heartbeat([
      { name: 'main', dir: main },
      { name: 'telemetry', dir: broken },
    ]);
    assert.equal(report.at, '2026-09-24T07:00:00.000Z', 'nguồn hỏng không được làm mất nhịp tim của nguồn lành');
    const reading = report.readings.find((r) => r.name === 'telemetry');
    assert.notEqual(reading?.error, null);
    assert.equal(report.problems.length, 1);
    assert.match(report.problems[0]!, /không đọc được/);
  } finally {
    rmSync(broken, { recursive: true, force: true });
    rmSync(main, { recursive: true, force: true });
  }
});

test('danh sách nguồn RỖNG là một lỗi cấu hình được nói ra, không phải "nhịp tim null"', () => {
  const report = heartbeat([]);
  assert.equal(report.at, null);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /Không nguồn nhịp tim nào được khai/);
});

test('`--source` viết sai NÉM, không bị bỏ qua', () => {
  // Một nguồn bị bỏ qua vì gõ sai cờ là một nguồn biến mất mà không gì đỏ.
  assert.throws(() => parseSourceArgs(['--source', 'telemetry']), /tên.*thư mục/s);
  assert.throws(() => parseSourceArgs(['--source', '=ops/logs']), /tên.*thư mục/s);
  assert.throws(() => parseSourceArgs(['--source', 'telemetry=']), /tên.*thư mục/s);
  assert.throws(() => parseSourceArgs(['--source']), /thiếu giá trị/);
  assert.deepEqual(parseSourceArgs(['--json', '--source', 'main=ops/logs']), [{ name: 'main', dir: 'ops/logs' }]);
});

test('bảng người đọc đánh dấu nguồn thắng và không bao giờ in `NaN`', () => {
  const main = scratch({ 'integration/step0-a.jsonl': beat('2026-09-24T08:00:00Z') });
  const gone = join(main, 'không-có');
  try {
    const text = renderHeartbeat(
      heartbeat([
        { name: 'main', dir: main },
        { name: 'telemetry', dir: gone },
      ]),
    );
    assert.match(text, /→ main/);
    assert.match(text, /telemetry\s+KHÔNG TỒN TẠI/);
    assert.doesNotMatch(text, /NaN|undefined|null/);
  } finally {
    rmSync(main, { recursive: true, force: true });
  }
});

// ── Khoá chiều lệch TS ↔ YAML ─────────────────────────────────────────────

test('tên nhánh telemetry trong `watchdog.yml` KHỚP hằng `TELEMETRY_BRANCH`', () => {
  // Ca âm của một phép so hằng-với-hằng: `assert.equal(TELEMETRY_BRANCH,
  // 'claude/telemetry')` vẫn xanh nguyên khi ai đó đổi YAML sang một nhánh
  // khác — và lúc đó watchdog đọc một nhánh không ai ghi vào, tức nguồn mới
  // chết mà không gì đỏ. Nên đọc chính file YAML.
  const yml = readFileSync(WATCHDOG, 'utf8');
  const match = /^\s*TELEMETRY_BRANCH:\s*'([^']+)'/m.exec(yml);
  assert.ok(match, '`watchdog.yml` không còn khai `TELEMETRY_BRANCH` trong `env:`');
  assert.equal(match[1], TELEMETRY_BRANCH);
});

test('`watchdog.yml` khai ĐỦ HAI nguồn — điều kiện "không mất tín hiệu" do máy canh, không do lời văn', () => {
  // Bài này là chỗ duy nhất giữ đúng chữ của chủ dự án trên `#213`. Bỏ
  // `--source "main=…"` ra khỏi YAML là tạo lại đúng khoảng câm mà `#213`
  // cấm, và không bài kiểm nào khác thấy được.
  const yml = readFileSync(WATCHDOG, 'utf8');
  const sources = [...yml.matchAll(/--source\s+"([a-z]+)=([^"]+)"/g)].map((m) => ({ name: m[1]!, dir: m[2]! }));
  assert.deepEqual(
    sources.map((s) => s.name).sort(),
    ['main', 'telemetry'],
    'dấu hiệu số 5 phải đọc CẢ `main` và nhánh telemetry — một nguồn thôi là một chiều hỏng đã biết',
  );
  assert.equal(sources.find((s) => s.name === 'main')?.dir, 'ops/logs');
  assert.ok(
    sources.find((s) => s.name === 'telemetry')?.dir.endsWith(`/${TELEMETRY_DIR}`),
    `nguồn telemetry phải trỏ vào thư mục \`${TELEMETRY_DIR}\` của nhánh đã lấy về`,
  );
});

test('`LAST_BEAT` PHẢI đến từ output của script — không phải chỉ "script được gọi ở đâu đó"', () => {
  // ## Bài này do vòng soát ngữ cảnh sạch của PR #229 đòi, và nó bịt một lỗ đo
  // được
  //
  // Bản đầu chỉ khẳng định `heartbeat-source.ts` **xuất hiện** trong một dòng
  // thực thi. Reviewer phá hai cách, cả hai giữ 35/35 xanh:
  //
  // - giữ nguyên dòng gọi script (nên guard xanh), nhưng gán `LAST_BEAT` bằng
  //   một `jq` chép tay quét lại `ops/logs` — tức quay về **một** nguồn, đúng
  //   hành vi trước `P-043`;
  // - giữ cả hai `--source`, nhưng đổi `jq` thành
  //   `.readings[] | select(.name == "main") | .at`, loại nguồn telemetry khỏi
  //   phép `max` hoàn toàn.
  //
  // Cả hai tái hiện đúng khoảng câm mà `🤖 [QĐ] #213` cấm, và cả hai vô hình
  // với mọi bài kiểm khác. Nên bài này neo vào **chính dòng gán `LAST_BEAT`**.
  const yml = readFileSync(WATCHDOG, 'utf8');
  const execLines = yml.split('\n').filter((raw) => !raw.trimStart().startsWith('#'));

  const assigns = execLines.filter((raw) => /^\s*LAST_BEAT=/.test(raw));
  assert.ok(assigns.length > 0, '`watchdog.yml` không còn dòng nào gán `LAST_BEAT` — dấu hiệu số 5 đã biến mất?');

  for (const raw of assigns) {
    // Gán chuỗi rỗng là nhánh hướng an toàn (`$BEAT` rỗng), được phép.
    if (/^\s*LAST_BEAT=""\s*$/.test(raw)) continue;
    assert.match(
      raw,
      /\$BEAT/,
      `\`LAST_BEAT\` phải lấy từ \`$BEAT\` — output của heartbeat-source.ts — chứ không đo lại bằng cách khác:\n${raw}`,
    );
    assert.match(
      raw,
      /\.at\b/,
      `\`LAST_BEAT\` phải là trường \`at\` của báo cáo, tức phép \`max\` trên MỌI nguồn, không phải một nguồn:\n${raw}`,
    );
    assert.doesNotMatch(
      raw,
      /readings/,
      `\`LAST_BEAT\` không được chọn MỘT nguồn trong \`readings\` — đó là bỏ phép \`max\`, tức tái hiện khoảng câm của #213:\n${raw}`,
    );
  }

  // Và không dòng thực thi nào được tự quét `ops/logs` để đo nhịp tim: đó là
  // con đường quay về một nguồn mà `assigns` ở trên không thấy nếu ai đó dựng
  // một biến trung gian.
  //
  // Hai ngoại lệ, cả hai hẹp và có lý do: dấu hiệu số **4** (chi phí tích luỹ)
  // đọc cùng thư mục cho một việc khác hẳn — nhận ra bằng `costUsd`, không phải
  // bằng tên biến; và văn xuôi truyền cho `add` được phép **nhắc tên** thư mục
  // để câu cảnh báo nói được nó đã tìm ở đâu.
  const rescan = execLines.filter(
    (raw) =>
      raw.includes('ops/logs') &&
      !raw.includes('--source') &&
      !raw.includes('costUsd') &&
      !/\badd "/.test(raw),
  );
  assert.deepEqual(
    rescan,
    [],
    'Một dòng thực thi của `watchdog.yml` đọc `ops/logs` ngoài đường `--source`. ' +
      'Nhịp tim chỉ được đến từ `heartbeat-source.ts`, nếu không phép `max` trên hai nguồn mất tác dụng.',
  );
});

test('`BEAT_REPORT` lấy `.render` của script và CÓ MẶT trong thân cảnh báo', () => {
  // Hai chỗ vòng soát đo được là không bài nào giữ:
  //
  // - `watchdog.yml` tự render ba trạng thái bằng `jq` — bản chép thứ hai của
  //   đúng luật mà mục này vừa bỏ bản chép. Bỏ nhánh `.missing` khỏi nó thì
  //   35/35 vẫn xanh.
  // - bỏ hẳn `"$BEAT_REPORT"` khỏi `BODY` thì 770/770 `ops/test` vẫn xanh, tức
  //   báo cáo theo từng nguồn **không bao giờ tới tay chủ dự án** mà không gì đỏ.
  const yml = readFileSync(WATCHDOG, 'utf8');
  const execLines = yml.split('\n').filter((raw) => !raw.trimStart().startsWith('#'));

  const assigns = execLines.filter((raw) => /^\s*BEAT_REPORT=/.test(raw));
  assert.ok(assigns.length > 0, '`watchdog.yml` không còn dựng `BEAT_REPORT`');
  assert.ok(
    assigns.some((raw) => raw.includes('.render')),
    'phải có một dòng lấy `.render` từ output của `heartbeat-source.ts`',
  );

  // Ca âm: không dòng nào được dựng lại luật ba trạng thái bằng `jq`.
  const rerender = execLines.filter((raw) => /\.missing|step0Lines/.test(raw));
  assert.deepEqual(
    rerender,
    [],
    'Một dòng thực thi của `watchdog.yml` đang tự render trạng thái nguồn từ JSON. ' +
      'Luật đó chỉ được tồn tại ở `renderHeartbeat`; bản chép thứ hai không có bài kiểm nào so.',
  );

  // Và nó phải thật sự đi vào thân cảnh báo, cạnh `$LANE_REPORT`.
  const body = /BODY=\$\(printf[\s\S]*?\)\n\n/.exec(yml);
  assert.ok(body, 'không tìm thấy khối dựng `BODY` của `watchdog.yml`');
  assert.ok(
    body[0].includes('"$BEAT_REPORT"'),
    'thân cảnh báo phải mang `$BEAT_REPORT` — nếu không thì báo cáo theo từng nguồn không tới tay ai',
  );
});

// ── Vế GHI: nhánh telemetry chỉ nhận dòng bước 0 ──────────────────────────

test('đường dẫn đích giữ NGUYÊN tên file log, không giữ cây `ops/logs`', () => {
  const at = '2026-09-24T08:39:16Z';
  const path = `ops/logs/integration/${step0LogRef(at, 'crux-worker-1').split('/')[1]}.jsonl`;
  const target = telemetryTargetPath(path);
  assert.ok(target.startsWith(`${TELEMETRY_DIR}/`));
  assert.ok(!target.includes('ops/logs'), 'trùng đường dẫn với `ops/logs` làm một lần gộp nhầm hai cây log vô hình');
  assert.ok(target.endsWith('.jsonl'));
  assert.throws(() => telemetryTargetPath('ops/logs/integration/step0-x.json'), /\.jsonl/);
  assert.throws(() => telemetryTargetPath('.jsonl'), /\.jsonl/);
});

test('chỉ dòng bước 0 được lên nhánh telemetry — một dòng khác là nhịp tim GIẢ', () => {
  const at = '2026-09-24T08:00:00Z';
  assert.deepEqual(beatFileProblems(beat(at)), []);

  // Ca âm: một dòng việc thật lọt vào sẽ giả mạo nhịp tim theo hướng MỚI HƠN
  // sự thật, tức hướng làm người canh câm.
  const mixed = beatFileProblems(beat(at) + work('2026-09-24T09:00:00Z'));
  assert.equal(mixed.length, 1);
  assert.match(mixed[0]!, /dòng 2/);
  assert.match(mixed[0]!, /nhịp tim giả/);

  // Mọi dòng sai được kể trong MỘT lần, không phải sửa một dòng rồi chạy lại.
  const twoBad = beatFileProblems(work(at) + work('2026-09-24T09:00:00Z'));
  assert.equal(twoBad.length, 2);

  assert.match(beatFileProblems('không phải json\n')[0]!, /không parse được JSON/);
  assert.match(beatFileProblems('{"at":"2026-09-24T08:00:00Z"}\n')[0]!, /thiếu trường `ref`/);
  assert.match(beatFileProblems(`{"ref":${JSON.stringify(step0LogRef(at, 'r'))}}\n`)[0]!, /`at`/);
  assert.match(beatFileProblems('\n  \n')[0]!, /File rỗng/);
});

test('các lệnh git mà script IN RA phải chạy được, và phải mang trailer', () => {
  // Vòng soát ngữ cảnh sạch của PR #229 bắt được: docblock **hứa** bên gọi "tự
  // làm phần git bằng các lệnh script in ra", mà script chỉ in
  // `{branch, target, bytes}` — CHARTER phụ lục P3 bước 0e dặn một việc không
  // lệnh nào tồn tại để làm. Bài này khoá cả hai nửa của lời hứa đó.
  const commands = telemetryPushCommands('ops/logs/integration/step0-x-crux-worker-1.jsonl', 'https://ví.dụ/phiên');
  const script = commands.join('\n');

  // Chạy được thật, không chỉ "trông giống bash".
  const check = spawnSync('bash', ['-n'], { input: script, encoding: 'utf8' });
  assert.equal(check.status, 0, `các lệnh in ra không phải bash hợp lệ:\n${check.stderr}`);

  // Trailer là phần KHÔNG có PR nào sửa được về sau (commit trên nhánh này
  // không bao giờ vào `main`), nên nó phải có ngay từ lệnh in ra.
  assert.match(script, /Co-Authored-By: Claude <noreply@anthropic\.com>/);
  assert.match(script, /Claude-Session: https:\/\/ví\.dụ\/phiên/);
  // Ca âm của `KF-014`: không tên/mã model trong trailer.
  assert.doesNotMatch(script, /Opus|Sonnet|Haiku|Fable|claude-[a-z]+-\d/i);

  // Và nó phải đẩy lên đúng nhánh, đúng thư mục, không `--force` dưới bất kỳ hình dạng nào.
  assert.ok(script.includes(`refs/heads/${TELEMETRY_BRANCH}`));
  // Tên thư mục nay là **tham số** của `printf` chứ không nằm trong chuỗi định
  // dạng (`…%s\\t%s\\n` … "$INNER" "heartbeat"), vì cây gốc đã đổi sang dựng
  // THÊM — xem `telemetry-beat.ts`. Nên phép kiểm đổi HÌNH DẠNG chứ không đổi
  // độ mạnh: vẫn đòi đúng một entry `040000 tree` mang đúng tên thư mục đó.
  assert.match(script, /printf '040000 tree %s\\t%s\\n'/);
  assert.ok(script.includes(`"$INNER" ${JSON.stringify(TELEMETRY_DIR)}`));
  // Chỉ soi các dòng LỆNH: một dòng chú thích nói "không `--force` nào" là lời
  // khai, không phải một cờ — soi cả chú thích thì phép kiểm bắt chính nó.
  assert.doesNotMatch(
    commands.filter((line) => !line.trimStart().startsWith('#')).join('\n'),
    /--force/,
  );
});

test('bản sao lên nhánh telemetry là NGUYÊN VĂN file gốc, chỉ chuẩn hoá dấu xuống dòng cuối', () => {
  // Một bản sao rút gọn là một bản sao phải bảo trì riêng, và phép so hai bản
  // để phát hiện lệch mất chỗ neo.
  const raw = beat('2026-09-24T08:00:00Z');
  assert.equal(beatContent(raw), raw);
  assert.equal(beatContent(`${raw}\n\n`), raw);
  assert.equal(beatContent(raw.trimEnd()), raw);
});
