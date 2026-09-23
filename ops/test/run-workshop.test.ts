/**
 * Mục `platform/P-004` — sáu xưởng gọi được độc lập bằng `workflow_dispatch`
 * (CHARTER 5.4, quyết định D-12).
 *
 * Hai thứ được kiểm ở đây, và cả hai đều là loại hỏng mà không gì đỏ:
 *
 * 1. `parseRunWorkshopArgs` — mã tập đi THẲNG vào tên file log, nên một mã
 *    dạng `../../etc/x` lọt qua sẽ ghi ra ngoài `ops/logs/`. Kiểm tham số
 *    phải xảy ra TRƯỚC khi xưởng chạy, không phải sau.
 * 2. Sáu file workflow — chúng gần như giống hệt nhau, nên chúng trôi khỏi
 *    nhau rất dễ: một file gọi nhầm `--workshop`, hay thiếu một tham số, và
 *    không có gì báo cho tới khi ai đó bấm chạy nó trên GitHub. Workflow chỉ
 *    có hiệu lực sau khi merge vào `main`, nên đây là chỗ rẻ nhất để kiểm.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WORKSHOPS, parseRunLogs, type RunLogLine } from '@crux/kernel';
import { parseRunWorkshopArgs, missingUpstream } from '../scripts/run-workshop.ts';
import { definitionFor } from '../scripts/pipeline.ts';

// ── Tham số ──────────────────────────────────────────────────────────────

test('P-004 · tham số đủ thì ra đúng giá trị, và mặc định là stub', () => {
  const args = parseRunWorkshopArgs(
    ['--workshop', 'editorial', '--episode', 'ep-0001-stub'],
    '/work',
  );
  assert.equal(args.workshop, 'editorial');
  assert.equal(args.episode, 'ep-0001-stub');
  assert.equal(args.impl, 'stub');
  assert.equal(args.channel, 'us-personal-finance');
  assert.equal(args.root, '/work');
});

test('P-004 · `--` của pnpm không làm lệch tham số', () => {
  const args = parseRunWorkshopArgs(
    ['--', '--workshop', 'visual', '--episode', 'ep-0001-stub', '--impl', 'v1'],
    '/work',
  );
  assert.equal(args.workshop, 'visual');
  assert.equal(args.impl, 'v1');
});

test('P-004 · mã tập dạng đường dẫn thì ĐỎ, trước khi xưởng chạy', () => {
  assert.throws(
    () => parseRunWorkshopArgs(['--workshop', 'topic', '--episode', '../../etc/x'], '/work'),
    /Mã tập không hợp lệ/,
  );
});

test('P-004 · tên xưởng lạ thì đỏ, và câu lỗi liệt kê tên hợp lệ', () => {
  assert.throws(
    () => parseRunWorkshopArgs(['--workshop', 'thumbnail', '--episode', 'ep-1'], '/work'),
    (error: Error) => /thumbnail/.test(error.message) && /topic/.test(error.message),
  );
});

test('P-004 · thiếu --workshop hoặc --episode thì đỏ', () => {
  assert.throws(() => parseRunWorkshopArgs(['--episode', 'ep-1'], '/work'), /--workshop/);
  assert.throws(() => parseRunWorkshopArgs(['--workshop', 'topic'], '/work'), /--episode/);
});

test('P-004 · --impl chỉ nhận stub hoặc v1', () => {
  assert.throws(
    () => parseRunWorkshopArgs(['--workshop', 'topic', '--episode', 'ep-1', '--impl', 'real'], '/work'),
    /--impl không hợp lệ/,
  );
});

// ── Đầu vào thiếu ────────────────────────────────────────────────────────

test('P-004 · thiếu artifact đầu vào thì gọi tên đúng xưởng còn thiếu', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-p004-'));
  try {
    const { upstream, missing } = missingUpstream(root, 'us-personal-finance', 'ep-x', [
      'editorial',
      'visual',
    ]);
    assert.deepEqual(missing, ['editorial', 'visual']);
    assert.deepEqual(upstream, {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Sáu workflow ─────────────────────────────────────────────────────────

const workflowsDir = join(process.cwd(), 'ops', 'workflows');

test('P-004 · mỗi xưởng có đúng một workflow, và nó gọi đúng xưởng của mình', () => {
  for (const name of WORKSHOPS) {
    const file = join(workflowsDir, `workshop-${name}.yml`);
    const source = readFileSync(file, 'utf8');

    assert.match(source, new RegExp(`^name: workshop-${name}$`, 'm'), `${name}: sai tên workflow`);
    assert.match(
      source,
      new RegExp(`--workshop ${name}\\b`),
      `${name}: workflow không gọi \`--workshop ${name}\``,
    );
    for (const other of WORKSHOPS) {
      if (other === name) continue;
      assert.doesNotMatch(
        source,
        new RegExp(`--workshop ${other}\\b`),
        `${name}: workflow gọi nhầm xưởng ${other}`,
      );
    }
  }
});

test('P-004 · mỗi workflow nhận đúng hai tham số episode và impl', () => {
  for (const name of WORKSHOPS) {
    const source = readFileSync(join(workflowsDir, `workshop-${name}.yml`), 'utf8');
    assert.match(source, /^ {2}workflow_dispatch:$/m, `${name}: thiếu workflow_dispatch`);
    assert.match(source, /^ {6}episode:$/m, `${name}: thiếu tham số episode`);
    assert.match(source, /^ {6}impl:$/m, `${name}: thiếu tham số impl`);
    assert.match(source, /^ {8}default: stub$/m, `${name}: impl phải mặc định stub`);
  }
});

test('P-004 · mỗi workflow trỏ tới đúng vùng log của xưởng mình (bất biến I8)', () => {
  for (const name of WORKSHOPS) {
    const source = readFileSync(join(workflowsDir, `workshop-${name}.yml`), 'utf8');
    assert.match(source, new RegExp(`ops/logs/${name}/`), `${name}: không nhắc tới vùng log của nó`);
  }
});

/**
 * Thân của mọi khối `run: |` trong một workflow. Cùng cách đọc mà
 * `ops/scripts/check-workflows.ts` dùng: khối kết thúc ở dòng đầu tiên thụt
 * lề không sâu hơn dòng `run:`. Phải tách bằng khối chứ không bằng số khoảng
 * trắng — dòng của `env:` cũng thụt 10 cột, nên đếm cột sẽ bắt nhầm nó.
 */
function runBlockLines(source: string): string[] {
  const lines = source.split('\n');
  const body: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const opener = /^(\s*)(?:- )?run:\s*\|-?\s*$/.exec(lines[i]!);
    if (!opener) continue;
    const outer = opener[1]!.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j]!;
      if (line.trim() === '') continue;
      if (line.length - line.trimStart().length <= outer) {
        i = j - 1;
        break;
      }
      body.push(line);
    }
  }
  return body;
}

test('P-004 · tham số tập đi qua biến môi trường, không nội suy thẳng vào bash', () => {
  for (const name of WORKSHOPS) {
    const source = readFileSync(join(workflowsDir, `workshop-${name}.yml`), 'utf8');
    for (const line of runBlockLines(source)) {
      // Một `${{ inputs.episode }}` trong khối `run:` ghép thẳng giá trị
      // người dùng nhập vào lệnh bash — đường tiêm lệnh kinh điển. Giá trị
      // phải đi qua `env:` rồi mới được đọc bằng `"$EPISODE"`.
      assert.doesNotMatch(
        line,
        /\$\{\{/,
        `${name}: biểu thức \`\${{ … }}\` nằm trong khối run — phải đi qua env. Dòng: ${line.trim()}`,
      );
    }
  }
});

test('P-004 · runBlockLines thật sự đọc được thân khối run', () => {
  const source = readFileSync(join(workflowsDir, 'workshop-topic.yml'), 'utf8');
  const body = runBlockLines(source);
  assert.ok(
    body.some((l) => l.includes('--workshop topic')),
    'không tìm thấy lệnh chạy xưởng trong khối run — phép kiểm tiêm lệnh ở trên sẽ rỗng mà vẫn xanh',
  );
});

// ── Chuỗi dispatch ───────────────────────────────────────────────────────

test('P-004 · chú thích đầu file khai đúng đầu vào mà xưởng đó tiêu thụ', () => {
  for (const name of WORKSHOPS) {
    const source = readFileSync(join(workflowsDir, `workshop-${name}.yml`), 'utf8');
    const declared = /^# Đầu vào xưởng này cần: (.+)$/m.exec(source);
    assert.ok(declared, `${name}: thiếu dòng "Đầu vào xưởng này cần:"`);
    const consumes = definitionFor(name).consumes;
    if (consumes.length === 0) {
      assert.match(declared![1]!, /không có/, `${name}: khai thừa đầu vào`);
      continue;
    }
    for (const upstream of consumes) {
      assert.match(
        declared![1]!,
        new RegExp(`\\b${upstream}\\b`),
        `${name}: chú thích thiếu đầu vào ${upstream}`,
      );
    }
  }
});

// ── Bất biến I8, kiểm bằng CHẠY THẬT ─────────────────────────────────────
//
// Vòng soát của chính mục này tìm ra khoảng trống: mọi bài kiểm ở trên đều
// đọc *văn bản* (tham số, file YAML), nên tắt hẳn lời gọi `appendRunLog`
// trong `run-workshop.ts` vẫn cho `pnpm check` xanh. Một bất biến mà không
// bài kiểm nào chạm vào thì nó là lời hứa, không phải luật — và đó đúng là
// nhóm lỗi Z mà mục này nói nó đi sửa.
//
// Vì vậy bốn bài dưới đây gọi script như GitHub Actions gọi nó: một tiến
// trình con, một `--root` riêng, rồi ĐẾM dòng trong file log.

const SCRIPT = join(process.cwd(), 'ops', 'scripts', 'run-workshop.ts');

function sandbox(): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-i8-'));
  cpSync(join(process.cwd(), 'packs'), join(root, 'packs'), { recursive: true });
  return root;
}

function run(root: string, argv: readonly string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...argv], {
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function logLines(root: string, workshop: string, episode: string): RunLogLine[] {
  const path = join(root, 'ops', 'logs', workshop, `${episode}.jsonl`);
  if (!existsSync(path)) return [];
  return parseRunLogs([readFileSync(path, 'utf8')]);
}

test('I8 · lần chạy THÀNH CÔNG để lại đúng một dòng có costUsd', () => {
  const root = sandbox();
  try {
    const result = run(root, ['--workshop', 'topic', '--episode', 'ep-i8']);
    assert.equal(result.status, 0, result.stderr);

    const lines = logLines(root, 'topic', 'ep-i8');
    assert.equal(lines.length, 1, `phải đúng 1 dòng, đang có ${lines.length}`);
    assert.equal(lines[0]!.status, 'ok');
    assert.equal(lines[0]!.ref, 'ep-i8/topic');
    assert.equal(typeof lines[0]!.costUsd, 'number');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I8 · lần chạy HỎNG vì thiếu artifact đầu vào vẫn để lại một dòng', () => {
  const root = sandbox();
  try {
    const result = run(root, ['--workshop', 'editorial', '--episode', 'ep-i8']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Chạy trước: pnpm run:workshop -- --workshop topic/);

    const lines = logLines(root, 'editorial', 'ep-i8');
    assert.equal(lines.length, 1, `phải đúng 1 dòng, đang có ${lines.length}`);
    assert.equal(lines[0]!.status, 'failed');
    assert.equal(typeof lines[0]!.costUsd, 'number');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I8 · lần chạy hỏng vì nạp pack cũng để lại một dòng, không rơi ra ngoài', () => {
  const root = sandbox();
  try {
    const result = run(root, [
      '--workshop',
      'topic',
      '--episode',
      'ep-i8',
      '--channel',
      'khong-co-that',
    ]);
    assert.equal(result.status, 1);

    const lines = logLines(root, 'topic', 'ep-i8');
    assert.equal(lines.length, 1, `phải đúng 1 dòng, đang có ${lines.length}`);
    assert.equal(lines[0]!.status, 'failed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('I8 · mã tập dạng đường dẫn thì dừng ở cửa, không ghi ra ngoài ops/logs', () => {
  const root = sandbox();
  try {
    const result = run(root, ['--workshop', 'topic', '--episode', '../../escaped']);
    // Thoát 2 = lỗi tham số: chưa chạy gì nên chưa có gì để ghi. Khác hẳn
    // thoát 1 ở ba bài trên, nơi lần chạy đã bắt đầu.
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Mã tập không hợp lệ/);
    assert.equal(existsSync(join(root, 'ops', 'logs')), false, 'không được tạo vùng log nào');
    assert.equal(existsSync(join(root, '..', 'escaped.jsonl')), false, 'ghi lọt ra ngoài --root');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
