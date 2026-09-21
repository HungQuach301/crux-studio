/**
 * Bất biến I8 sau quyết định `D-C04`: log phân vùng tới mức mục,
 * `ops/logs/<lane>/<id>.jsonl`, và bên đọc gom nhiều file rồi sắp theo `at`.
 *
 * Hai thứ được khoá ở đây, và cái thứ hai mới là cái đắt:
 *
 * 1. **Đường dẫn** — mã mục đi thẳng vào tên file, nên một `ref` bậy phải
 *    bị chặn chứ không được ghi ra ngoài `ops/logs/`.
 * 2. **Sắp theo `at`** — `merge=union` giữ cả hai bên nhưng KHÔNG xếp theo
 *    thời gian (đã đo, `KF-005`). Nếu `readRunLogs` trả về theo thứ tự
 *    dòng trong file thì chi phí 24 giờ tính sai mà không gì đỏ: nhóm Z.
 *    Bài kiểm dưới đây dựng đúng hình dạng union sinh ra — dòng mới nằm
 *    TRƯỚC dòng cũ trong cùng một file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendRunLog,
  formatLogLine,
  isSafeLogId,
  listLogFiles,
  logIdFromRef,
  normalizeAt,
  parseRunLogs,
  readRunLogs,
  runLogPath,
  sortByAt,
  type RunLogLine,
} from '../src/log.ts';

function line(at: string, overrides: Partial<RunLogLine> = {}): RunLogLine {
  return {
    at,
    lane: 'platform',
    kind: 'lane',
    ref: 'platform/P-018',
    status: 'ok',
    durationMs: 0,
    costUsd: 0,
    ...overrides,
  };
}

test('runLogPath · một file cho mỗi mục, dưới thư mục của làn', () => {
  assert.equal(
    runLogPath('/repo', 'platform', 'P-018'),
    join('/repo', 'ops', 'logs', 'platform', 'P-018.jsonl'),
  );
  assert.equal(
    runLogPath('/repo', 'topic', 'ep-0001-stub'),
    join('/repo', 'ops', 'logs', 'topic', 'ep-0001-stub.jsonl'),
  );
});

test('runLogPath · mã mục bậy bị chặn, không ghi ra ngoài ops/logs', () => {
  for (const bad of ['../etc', 'a/b', '', '.', '..', 'x/../../y', 'a b']) {
    assert.throws(() => runLogPath('/repo', 'platform', bad), /Mã mục không hợp lệ/, `\`${bad}\` lẽ ra phải bị chặn`);
  }
  assert.ok(isSafeLogId('P-018'));
  assert.ok(isSafeLogId('ep-0001-stub'));
  assert.ok(isSafeLogId('P3-daily-2026-09-21'));
  assert.ok(!isSafeLogId('-P-018'));
});

test('logIdFromRef · đoạn đầu được so với MỌI tên làn, không riêng lane truyền vào', () => {
  // Integrator ghi hộ một mục của làn khác: `lane` là `integration` nhưng
  // `ref` mang tiền tố `platform`. So với mỗi `lane` thì id ra `platform`,
  // và P-018, P-019, P-020… dồn hết vào ops/logs/integration/platform.jsonl
  // — đúng thứ xung đột một-file-dùng-chung mà D-C04 sinh ra để xoá.
  assert.equal(logIdFromRef('platform/P-018', 'integration'), 'P-018');
  assert.equal(logIdFromRef('verify/VF-G17', 'platform'), 'VF-G17');
  // Ref một đoạn và đoạn đó là tên làn: không có mã mục nào để lấy.
  assert.equal(logIdFromRef('platform', 'platform'), 'unknown');
});

test('logIdFromRef · cả hai dạng ref đang dùng', () => {
  // Mục backlog: `<lane>/<id>` — đơn vị công việc là đoạn SAU.
  assert.equal(logIdFromRef('platform/P-018', 'platform'), 'P-018');
  assert.equal(logIdFromRef('integration/P3-daily-2026-09-21', 'integration'), 'P3-daily-2026-09-21');
  // Lần chạy tập: `<episodeId>/<workshop>` — đơn vị công việc là đoạn TRƯỚC.
  assert.equal(logIdFromRef('ep-0001-stub/topic', 'topic'), 'ep-0001-stub');
  assert.equal(logIdFromRef('ep-0001-stub/full-chain', 'integration'), 'ep-0001-stub');
  // Không suy được thì trả `unknown`, không ném và không đoán bừa một
  // đường dẫn — bên gọi migration bắt `unknown` để dừng lại.
  assert.equal(logIdFromRef('../../etc/passwd', 'platform'), 'unknown');
  assert.equal(logIdFromRef('', 'platform'), 'unknown');
});

test('sortByAt · sắp tăng dần và giữ thứ tự tương đối của dòng cùng `at`', () => {
  const a = line('2026-09-21T03:00:00.000Z', { ref: 'a' });
  const b = line('2026-09-21T02:00:00.000Z', { ref: 'b' });
  const c = line('2026-09-21T02:00:00.000Z', { ref: 'c' });
  assert.deepEqual(
    sortByAt([a, b, c]).map((l) => l.ref),
    ['b', 'c', 'a'],
  );
});

test('parseRunLogs · gom nhiều file, bỏ dòng rỗng, sắp theo `at`', () => {
  const fileA = [formatLogLine(line('2026-09-21T05:00:00.000Z', { ref: 'a' })), ''].join('\n');
  const fileB = [
    // Đúng hình dạng `merge=union` sinh ra: dòng MỚI nằm trước dòng CŨ.
    formatLogLine(line('2026-09-21T06:00:00.000Z', { ref: 'b2' })),
    formatLogLine(line('2026-09-21T01:00:00.000Z', { ref: 'b1' })),
    '',
  ].join('\n');
  assert.deepEqual(
    parseRunLogs([fileA, fileB]).map((l) => l.ref),
    ['b1', 'a', 'b2'],
  );
});

test('parseRunLogs · dòng hỏng thì ném, không nuốt', () => {
  // Log là nguồn tính tiền. Bỏ qua một dòng không đọc được ở đây là làm
  // tổng chi phí nhỏ đi mà không gì đỏ.
  assert.throws(() => parseRunLogs(['{ không phải json }']));
});

test('readRunLogs · đọc cả file trong thư mục làn lẫn file phẳng còn sót, sắp theo `at`', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-log-'));
  const logsDir = join(root, 'ops', 'logs');
  mkdirSync(join(logsDir, 'platform'), { recursive: true });

  // Tên file được chọn để thứ tự ĐỌC (theo tên) NGƯỢC với thứ tự thời
  // gian. Nếu fixture nào cũng tình cờ đã đúng thứ tự thì bài kiểm này
  // xanh cả khi `readRunLogs` quên sắp — xanh giả, đúng thứ nó phải bắt.
  // Theo tên: kernel.jsonl (05:00) → platform/A-001 (09:00) → platform/Z-999 (01:00).
  writeFileSync(
    join(logsDir, 'platform', 'A-001.jsonl'),
    `${formatLogLine(line('2026-09-21T09:00:00.000Z', { ref: 'moi', costUsd: 1.5 }))}\n`,
    'utf8',
  );
  writeFileSync(
    join(logsDir, 'platform', 'Z-999.jsonl'),
    `${formatLogLine(line('2026-09-21T01:00:00.000Z', { ref: 'cu' }))}\n`,
    'utf8',
  );
  // Hình dạng cũ: nếu còn sót một file phẳng thì chi phí của nó KHÔNG
  // được biến mất khỏi tổng.
  writeFileSync(
    join(logsDir, 'kernel.jsonl'),
    `${formatLogLine(line('2026-09-21T05:00:00.000Z', { lane: 'kernel', ref: 'giua', costUsd: 0.5 }))}\n`,
    'utf8',
  );

  const lines = readRunLogs(logsDir);
  assert.deepEqual(
    lines.map((l) => l.ref),
    ['cu', 'giua', 'moi'],
  );
  assert.equal(
    lines.reduce((sum, l) => sum + l.costUsd, 0),
    2,
  );
});

test('readRunLogs · thư mục không tồn tại thì trả mảng rỗng, không ném', () => {
  assert.deepEqual(readRunLogs(join(tmpdir(), 'crux-khong-co-thu-muc-nay')), []);
  assert.deepEqual(listLogFiles(join(tmpdir(), 'crux-khong-co-thu-muc-nay')), []);
});

test('appendRunLog · tự tạo thư mục làn và nối thêm dòng', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-log-'));
  const path = runLogPath(root, 'visual', 'V-003');
  appendRunLog(path, line('2026-09-21T01:00:00.000Z', { lane: 'visual', ref: 'visual/V-003' }));
  appendRunLog(path, line('2026-09-21T02:00:00.000Z', { lane: 'visual', ref: 'visual/V-003' }));
  assert.equal(readFileSync(path, 'utf8').trim().split('\n').length, 2);
  assert.equal(readRunLogs(join(root, 'ops', 'logs')).length, 2);
});


test('normalizeAt · đưa mọi mốc về UTC so sánh được', () => {
  // Cùng một thời điểm, hai cách viết. So CHUỖI thì '17:00+07:00' đứng sau
  // '12:00Z' dù nó xảy ra TRƯỚC — sắp sai và rơi khỏi cửa sổ 24 giờ.
  assert.equal(normalizeAt('2026-09-21T17:00:00+07:00'), '2026-09-21T10:00:00.000Z');
  assert.equal(normalizeAt('2026-09-21T10:00:00.000Z'), '2026-09-21T10:00:00.000Z');
  assert.throws(() => normalizeAt('hôm qua'), /không đọc được/);
});

test('parseRunLogs · chuẩn hoá `at` và từ chối `costUsd` không phải số', () => {
  const lech = JSON.stringify({
    at: '2026-09-21T17:00:00+07:00',
    lane: 'platform',
    kind: 'lane',
    ref: 'platform/P-018',
    status: 'ok',
    durationMs: 0,
    costUsd: 1,
  });
  const sau = formatLogLine(line('2026-09-21T11:00:00.000Z', { ref: 'sau' }));
  // Dòng +07:00 = 10:00Z, phải đứng TRƯỚC dòng 11:00Z.
  assert.deepEqual(parseRunLogs([`${sau}\n${lech}`]).map((l) => l.ref), ['platform/P-018', 'sau']);

  const chuoi = lech.replace('"costUsd":1', '"costUsd":"1"');
  assert.throws(() => parseRunLogs([chuoi]), /costUsd` không phải số/);
});

test('rollup · dòng tổng hợp giữ được cờ qua một vòng ghi–đọc', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-log-'));
  const path = runLogPath(root, 'integration', 'ep-0001-stub');
  appendRunLog(path, line('2026-09-21T01:00:00.000Z', { lane: 'integration', ref: 'ep-0001-stub/full-chain', costUsd: 3, rollup: true }));
  appendRunLog(path, line('2026-09-21T02:00:00.000Z', { lane: 'integration', ref: 'integration/I-004', costUsd: 1 }));

  const lines = readRunLogs(join(root, 'ops', 'logs'));
  assert.equal(lines.filter((l) => l.rollup === true).length, 1);
  assert.equal(lines.filter((l) => l.rollup !== true).length, 1);
});
