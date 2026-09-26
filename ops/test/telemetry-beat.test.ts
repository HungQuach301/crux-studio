/**
 * Mục `platform/P-043`, vế **ghi** — và bài kiểm mà file
 * `ops/scripts/telemetry-beat.ts` **chưa từng có**.
 *
 * Vì sao đó là chỗ đau chứ không phải một thiếu sót hình thức: khối lệnh mà
 * `telemetryPushCommands` in ra được **mọi** lượt worker chạy (CHARTER phụ
 * lục P3 bước 0e), và bản đầu của nó dựng cây `heartbeat/` lại từ đầu bằng
 * một `git mktree` chỉ mang một entry. Mỗi lần đẩy vì thế **xoá** nhịp tim
 * của mọi lượt trước, không lần push nào bị từ chối, và không chỉ báo nào
 * đỏ — nhóm **Z**. Đo được trên nhánh thật: **37/58** commit xoá file, nhánh
 * đứng ở đúng một file **27,7 giờ liền** (`a6f071c` 2026-09-24T08:54:58Z →
 * `1bb6594` 2026-09-25T12:38:27Z, lần đầu nhánh có hơn một file), rồi **15,0
 * giờ nữa** sau khi `715aab9` đạp nó về một file; và hai commit phải đi chữa
 * bằng tay.
 *
 * Nên bài kiểm chính ở đây **không** đọc chuỗi lệnh bằng mắt mà **chạy thật**
 * hai lần đẩy nối nhau trên một kho tạm có remote bare, rồi đếm file còn
 * sống. Đó là phép duy nhất phân biệt được "không xung đột" với "không mất
 * dữ liệu" — đúng hai thứ mà bản đầu trộn vào nhau.
 *
 * Mỗi ca cho qua đi kèm ca âm của nó (bài học `KF-003`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

import { step0LogId, step0LogRef } from '../../kernel/src/log.ts';
import {
  TELEMETRY_BRANCH,
  TELEMETRY_DIR,
  beatBytes,
  beatContent,
  beatFileProblems,
  telemetryPushCommands,
  telemetryTargetPath,
} from '../scripts/telemetry-beat.ts';

/** Một dòng log bước 0 hợp lệ cho mốc và routine đã cho. */
const step0Line = (at: string, runner: string): string =>
  `${JSON.stringify({
    at,
    lane: 'integration',
    kind: 'lane',
    ref: step0LogRef(at, runner),
    status: 'ok',
    durationMs: 1,
    costUsd: 0,
    step0: [],
    note: 'nhịp tim 🤖 — dòng dựng trong bài kiểm',
  })}\n`;

/**
 * Đường dẫn file log tạm mang **đúng** hình dạng `step0LogId` của kernel.
 *
 * Không đặt tên tuỳ ý (`a.jsonl`): `telemetryTargetPath` nay đòi hình dạng đó,
 * và một bài kiểm dùng tên tuỳ ý sẽ kiểm một đường mà chỗ thật không đi.
 */
const step0File = (dir: string, at: string, runner: string): string =>
  join(dir, `${step0LogId(at, runner)}.jsonl`);

const git = (cwd: string, ...args: string[]): string => {
  const out = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(out.status, 0, `git ${args.join(' ')} → ${out.status}\n${out.stderr}`);
  return out.stdout;
};

/**
 * Chạy khối lệnh của `telemetryPushCommands` **y như bên gọi chạy nó** — qua
 * `sh`, không diễn giải lại bằng lời. Diễn giải lại là cách một bài kiểm xanh
 * trong khi chỗ thật vẫn hỏng.
 */
const runPushCommands = (cwd: string, logPath: string): void => {
  const script = telemetryPushCommands(logPath, 'https://claude.ai/code/session_test').join('\n');
  const out = spawnSync('sh', ['-e', '-c', script], { cwd, encoding: 'utf8' });
  assert.equal(out.status, 0, `khối lệnh thoát ${out.status}\n${out.stderr}`);
};

/** Kho tạm: một remote bare tên `origin`, cộng một kho làm việc. */
const makeRepo = (): { dir: string; work: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-telemetry-'));
  const bare = join(dir, 'remote.git');
  const work = join(dir, 'work');
  mkdirSync(work, { recursive: true });
  git(dir, 'init', '--bare', '--initial-branch=main', bare);
  git(work, 'init', '--initial-branch=main');
  git(work, 'config', 'user.email', 'test@example.com');
  git(work, 'config', 'user.name', 'Test');
  git(work, 'remote', 'add', 'origin', bare);
  return { dir, work, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

/** Tên các file đang có trong `heartbeat/` trên nhánh telemetry của remote. */
const heartbeatFiles = (work: string): string[] => {
  git(work, 'fetch', '--no-tags', 'origin', `+refs/heads/${TELEMETRY_BRANCH}:refs/crux/telemetry`);
  return git(work, 'ls-tree', '--name-only', `refs/crux/telemetry:${TELEMETRY_DIR}`)
    .split('\n')
    .filter((row) => row.trim().length > 0)
    .sort();
};

test('bước 0e: lần đẩy thứ hai GIỮ nhịp tim của lượt trước (chỗ hỏng 37/58 commit)', () => {
  const { work, cleanup } = makeRepo();
  try {
    const atA = '2026-09-26T05:00:00.111Z';
    const atB = '2026-09-26T05:00:12.222Z';

    const fileA = step0File(work, atA, 'crux-worker-1');
    const fileB = step0File(work, atB, 'crux-worker-3');
    writeFileSync(fileA, step0Line(atA, 'crux-worker-1'), 'utf8');
    writeFileSync(fileB, step0Line(atB, 'crux-worker-3'), 'utf8');

    // Lượt thứ nhất: nhánh chưa tồn tại, nên khối lệnh phải tự dựng nó.
    runPushCommands(work, fileA);
    const afterA = heartbeatFiles(work);
    assert.deepEqual(afterA, [telemetryTargetPath(fileA).slice(`${TELEMETRY_DIR}/`.length)]);

    // Lượt thứ hai, 12 giây sau — đúng khoảng cách đã quan sát được thật
    // giữa hai lượt worker song song.
    runPushCommands(work, fileB);
    const afterB = heartbeatFiles(work);

    assert.equal(afterB.length, 2, `phải còn CẢ HAI nhịp tim, đang có: ${afterB.join(', ')}`);
    for (const expected of [fileA, fileB]) {
      const name = telemetryTargetPath(expected).slice(`${TELEMETRY_DIR}/`.length);
      assert.ok(afterB.includes(name), `nhịp tim ${name} bị lần đẩy sau xoá`);
    }
  } finally {
    cleanup();
  }
});

test('bước 0e: đẩy lại CÙNG một lượt thì ghi đè chính nó, không nhân đôi', () => {
  const { work, cleanup } = makeRepo();
  try {
    const at = '2026-09-26T05:10:00.333Z';
    const file = step0File(work, at, 'crux-worker-2');
    writeFileSync(file, step0Line(at, 'crux-worker-2'), 'utf8');
    runPushCommands(work, file);
    const first = heartbeatFiles(work);

    // `note` sửa sau vòng soát bước 6 — ca thật, đã xảy ra nhiều lượt.
    writeFileSync(file, step0Line(at, 'crux-worker-2').replace('dựng trong bài kiểm', 'đã sửa sau soát'), 'utf8');
    runPushCommands(work, file);
    const second = heartbeatFiles(work);

    assert.deepEqual(second, first, 'đẩy lại cùng một lượt không được thêm entry thứ hai');
    assert.equal(second.length, 1);
    const blob = git(work, 'show', `refs/crux/telemetry:${second[0]!.startsWith(TELEMETRY_DIR) ? second[0]! : `${TELEMETRY_DIR}/${second[0]!}`}`);
    assert.match(blob, /đã sửa sau soát/, 'nội dung mới phải thay nội dung cũ');
  } finally {
    cleanup();
  }
});

test('`bytes` là BYTE UTF-8, không phải đơn vị mã UTF-16', () => {
  // Ca dương: chuỗi ASCII thuần — hai phép đo trùng nhau, nên một bài kiểm
  // chỉ dùng ASCII sẽ KHÔNG bắt được chỗ hỏng. Khai ra để lượt sau không
  // "đơn giản hoá" bài kiểm về đúng ca mù đó.
  assert.equal(beatBytes('abc'), 4);
  assert.equal(beatContent('abc').length, 4);

  // Ca âm: 🤖 là một cặp surrogate (2 đơn vị UTF-16, 4 byte UTF-8), và mỗi
  // nguyên âm có dấu tiếng Việt là 1 đơn vị UTF-16 nhưng 2–3 byte.
  const raw = '🤖 nhịp tim bước 0';
  assert.equal(beatBytes(raw), Buffer.byteLength(`${raw}\n`, 'utf8'));
  // Hai số này là cặp minh hoạ mà docblock của `beatBytes` trích. Khoá chúng
  // ở đây để lời khai trong chú thích có máy canh: cặp trước đó (`6763`/`8214`)
  // trích từ một dòng log — thứ TỰ THAM CHIẾU, vì sửa `note` là đổi chính số
  // byte — nên nó hết đúng và không tái lập được ở đâu trong kho.
  assert.equal(beatContent(raw).length, 19);
  assert.equal(beatBytes(raw), 26);
  assert.ok(
    beatBytes(raw) > beatContent(raw).length,
    'với nội dung tiếng Việt có 🤖, số byte phải LỚN HƠN số đơn vị UTF-16 — ' +
      'bằng nhau nghĩa là phép đo đã tụt về `String.length`',
  );
});

test('khối lệnh KHÔNG được dựng lại cây heartbeat từ một entry duy nhất', () => {
  const commands = telemetryPushCommands('ops/logs/integration/step0-2026-09-26T050000Z-crux-worker-2.jsonl', 'u');
  const script = commands.join('\n');
  // Chỗ hỏng gốc đọc được bằng máy: entry mới được thêm vào danh sách entry
  // đang có, nên `git ls-tree` của thư mục heartbeat PHẢI có mặt trong khối.
  assert.match(script, new RegExp(`git ls-tree "\\$PARENT:${TELEMETRY_DIR}"`));
  assert.match(script, /git mktree/);
  // Và không được có `--force` nào: hai lượt song song ghi hai file khác nhau.
  // Chỉ soi các dòng LỆNH — một dòng chú thích nói "không `--force` nào" là
  // lời khai, không phải một cờ, và soi cả chú thích thì phép kiểm bắt chính
  // lời khai của mình (đã xảy ra thật trong lượt thêm bài kiểm này).
  const executable = commands.filter((line) => !line.trimStart().startsWith('#'));
  assert.doesNotMatch(executable.join('\n'), /--force/);
});

test('beatFileProblems vẫn chặn dòng không phải bước 0 (ca âm của lớp phòng thủ thứ hai)', () => {
  assert.deepEqual(beatFileProblems(step0Line('2026-09-26T05:00:00.000Z', 'crux-worker-2')), []);
  const strange = `${JSON.stringify({ at: '2027-01-01T00:00:00.000Z', ref: 'platform/P-999' })}\n`;
  assert.equal(beatFileProblems(strange).length, 1);
});

test('bước 0e: file ở GỐC nhánh (ví dụ README) KHÔNG bị lần đẩy xoá', () => {
  const { work, cleanup } = makeRepo();
  try {
    // Seed một nhánh telemetry mồ côi có `README` ở gốc và CHƯA có `heartbeat/`.
    // Ca này rất dễ xảy ra thật: nhánh không bao giờ có PR nên không ai soát,
    // và một dòng giải thích nhánh là thứ đầu tiên người ta đặt vào đó.
    writeFileSync(join(work, 'README.md'), 'nhánh giữ bản sao nhịp tim\n', 'utf8');
    const blob = git(work, 'hash-object', '-w', join(work, 'README.md')).trim();
    const root = spawnSync('git', ['mktree'], {
      cwd: work,
      input: `100644 blob ${blob}\tREADME.md\n`,
      encoding: 'utf8',
    });
    assert.equal(root.status, 0, root.stderr);
    const commit = spawnSync('git', ['commit-tree', root.stdout.trim()], {
      cwd: work,
      input: 'seed\n',
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e.com' },
    });
    assert.equal(commit.status, 0, commit.stderr);
    git(work, 'push', 'origin', `${commit.stdout.trim()}:refs/heads/${TELEMETRY_BRANCH}`);

    const file = step0File(work, '2026-09-26T05:20:00.444Z', 'crux-worker-2');
    writeFileSync(file, step0Line('2026-09-26T05:20:00.444Z', 'crux-worker-2'), 'utf8');
    runPushCommands(work, file);

    git(work, 'fetch', '--no-tags', 'origin', `+refs/heads/${TELEMETRY_BRANCH}:refs/crux/telemetry`);
    const rootEntries = git(work, 'ls-tree', '--name-only', 'refs/crux/telemetry')
      .split('\n')
      .filter((r) => r.trim().length > 0)
      .sort();
    assert.deepEqual(rootEntries, ['README.md', TELEMETRY_DIR], `gốc nhánh còn: ${rootEntries.join(', ')}`);
    assert.equal(heartbeatFiles(work).length, 1);
  } finally {
    cleanup();
  }
});

test('bước 0e: `heartbeat` là BLOB chứ không phải tree thì khối lệnh PHẢI đỏ, không im lặng dựng lại', () => {
  const { work, cleanup } = makeRepo();
  try {
    // Chiều hỏng ngược: nhánh CÓ dữ liệu nhưng `ls-tree <sha>:heartbeat` lỗi.
    // Nuốt lỗi đó thành "danh sách rỗng" là dựng lại đúng cây một entry mà cả
    // file này đi chữa — nên ở đây nó phải THOÁT KHÁC 0.
    writeFileSync(join(work, 'x'), 'không phải tree\n', 'utf8');
    const blob = git(work, 'hash-object', '-w', join(work, 'x')).trim();
    const root = spawnSync('git', ['mktree'], {
      cwd: work,
      input: `100644 blob ${blob}\t${TELEMETRY_DIR}\n`,
      encoding: 'utf8',
    });
    assert.equal(root.status, 0, root.stderr);
    const commit = spawnSync('git', ['commit-tree', root.stdout.trim()], {
      cwd: work,
      input: 'seed blob\n',
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@e.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@e.com' },
    });
    assert.equal(commit.status, 0, commit.stderr);
    git(work, 'push', 'origin', `${commit.stdout.trim()}:refs/heads/${TELEMETRY_BRANCH}`);

    const file = step0File(work, '2026-09-26T05:30:00.555Z', 'crux-worker-2');
    writeFileSync(file, step0Line('2026-09-26T05:30:00.555Z', 'crux-worker-2'), 'utf8');
    const script = telemetryPushCommands(file, 'https://claude.ai/code/session_test').join('\n');
    const out = spawnSync('sh', ['-e', '-c', script], { cwd: work, encoding: 'utf8' });
    assert.notEqual(out.status, 0, 'khối lệnh phải THOÁT KHÁC 0 khi heartbeat không phải tree');
    assert.match(out.stderr, /không phải tree/);
  } finally {
    cleanup();
  }
});

test('telemetryTargetPath NÉM với tên file không đúng hình dạng step0LogId', () => {
  // Tên này đi vào shell và vào phép so trường của `awk`; `git mktree` nhận
  // HAI entry cùng tên im lặng, nên một tên lệch dạng là một cây hỏng `exit 0`.
  for (const bad of ['a b$(echo x).jsonl', 'nhịp-tim.jsonl', 'step0-\tx.jsonl', 'log.jsonl', '../escape.jsonl']) {
    assert.throws(() => telemetryTargetPath(bad), /hình dạng|\.jsonl/, `phải ném với ${JSON.stringify(bad)}`);
  }
  // Ca dương: tên do `step0LogPath` của kernel sinh ra thì đi qua.
  const good = 'ops/logs/integration/step0-2026-09-26T062951Z-crux-worker-2.jsonl';
  assert.equal(telemetryTargetPath(good), `${TELEMETRY_DIR}/step0-2026-09-26T062951Z-crux-worker-2.jsonl`);
});

test('khối lệnh có vòng thử lại CÓ TRẦN, và không nuốt mã thoát của ls-tree', () => {
  const script = telemetryPushCommands('ops/logs/integration/step0-2026-09-26T050000Z-crux-worker-2.jsonl', 'u').join('\n');
  // Vòng `while` phải TỒN TẠI THẬT — docblock từng hứa nó mà không có lệnh nào.
  assert.match(script, /while :; do/);
  assert.match(script, /ATTEMPT/);
  assert.match(script, /-ge 4/, 'vòng thử lại phải có trần, không lặp vô hạn');
  // `ls-tree` KHÔNG được chạy dưới dạng `… 2>/dev/null | awk` — pipeline đó
  // nuốt mã thoát và biến một ref hỏng thành "danh sách rỗng".
  assert.doesNotMatch(script, /git ls-tree[^\n]*2>\/dev\/null[^\n]*\|/);
  assert.match(script, /OLD_ROOT=\$\(git ls-tree "\$PARENT"\) \|\| exit 1/);
});
