/**
 * `ops/scripts/integrator-resolve.ts` — cơ chế của mục `P-016`.
 *
 * Test này dựng git repo thật trong thư mục tạm và gộp thật, không mô
 * phỏng — đúng bài học của G17 (KF-005 "Cập nhật 2026-09-21"): một bài kiểm
 * chỉ đáng tin khi nó tái hiện đúng điều kiện đầu vào của lỗi thật, và với
 * xung đột merge thì điều kiện đó chính là git tự phân xử `add/add`, không
 * phải một chuỗi được dựng sẵn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAdditiveMerge } from '../scripts/integrator-resolve.ts';

const script = join(process.cwd(), 'ops', 'scripts', 'integrator-resolve.ts');

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Repo với một file `shared.log`, nhánh `main` và nhánh `feature` cùng rẽ từ một commit gốc. */
function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-resolve-repo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\n', 'utf8');
  writeFileSync(join(dir, 'other.txt'), 'khong-lien-quan\n', 'utf8');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'gốc']);
  git(dir, ['branch', 'feature']);
  return dir;
}

test('không có xung đột: merge sạch và tự commit', () => {
  const dir = initRepo();
  try {
    // main tiến thêm ở file KHÔNG liên quan tới nhánh feature.
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'other.txt'), 'khong-lien-quan\nmain-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm dòng ở other.txt']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm dòng ở shared.log']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'clean');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
    assert.notEqual(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'phải có commit merge mới');
    assert.match(readFileSync(join(dir, 'other.txt'), 'utf8'), /main-them/);
    assert.match(readFileSync(join(dir, 'shared.log'), 'utf8'), /feature-them/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xung đột thuần cộng thêm: giải bằng union, giữ cả hai dòng', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nmain-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm dòng ở shared.log']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm dòng ở shared.log']);

    // Xác nhận git THẬT SỰ báo xung đột ở kịch bản này trước khi tin vào
    // phần còn lại của test — nếu dòng dưới đây fail thì fixture sai, không
    // phải script sai.
    const probe = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(probe.status, 0, 'fixture phải tái hiện xung đột thật, không giả định');
    git(dir, ['merge', '--abort']);

    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'resolved');
    assert.deepEqual(result.files, ['shared.log']);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'cây làm việc phải sạch sau khi commit merge');

    const merged = readFileSync(join(dir, 'shared.log'), 'utf8');
    assert.match(merged, /main-them/, 'mất dòng của main');
    assert.match(merged, /feature-them/, 'mất dòng của feature');
    assert.ok(!merged.includes('<<<<<<<'), 'còn sót dấu xung đột');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('một bên xoá/sửa dòng: huỷ toàn bộ, không đoán, trả cây về sạch', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'main']);
    // main SỬA dòng gốc — không còn thuần cộng thêm.
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2-DA-SUA\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main sửa một dòng gốc']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm dòng']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible');
    assert.match(result.reason ?? '', /shared\.log/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'HEAD không được đổi khi huỷ');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'không được để lại dấu vết merge dở dang');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('file RỖNG ở tổ tiên chung, một bên xoá hẳn, bên kia sửa: numstat "0 0" không được đánh lừa', () => {
  // Đây là ca đã lộ ra khi soát lại tool: nếu chỉ dựa vào `numstat`, xoá một
  // file đang RỖNG cho ra "0 dòng thêm, 0 dòng xoá" — trông giống hệt "không
  // đổi gì" — dù đó vẫn là một xung đột xoá/sửa thật, không được tự giải.
  const dir = initRepo();
  try {
    writeFileSync(join(dir, 'empty.txt'), '', 'utf8');
    git(dir, ['add', 'empty.txt']);
    git(dir, ['commit', '-q', '-m', 'thêm empty.txt rỗng']);
    git(dir, ['branch', '-f', 'feature']); // rẽ nhánh feature lại từ đúng chỗ có empty.txt

    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['rm', '-q', 'empty.txt']);
    git(dir, ['commit', '-q', '-m', 'main xoá hẳn empty.txt']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'empty.txt'), 'feature-them-noi-dung\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm nội dung vào empty.txt']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible', JSON.stringify(result));
    assert.match(result.reason ?? '', /empty\.txt/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'HEAD không được đổi khi huỷ');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'không được để lại merge dở dang (MERGE_HEAD, index chưa gộp)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ontoRef đã là tổ tiên của HEAD: không có gì để gộp, không tạo commit rỗng', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'feature']);
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main'); // main chưa đổi gì kể từ gốc
    assert.equal(result.outcome, 'clean');
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'không có gì để gộp thì HEAD không được đổi');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cây làm việc bẩn: từ chối thử gộp', () => {
  const dir = initRepo();
  try {
    writeFileSync(join(dir, 'other.txt'), 'chua-commit\n', 'utf8');
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-error');
    assert.match(result.reason ?? '', /không sạch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: exit code 0 khi giải được, in JSON ra stdout', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'other.txt'), 'khong-lien-quan\nmain-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm']);
    git(dir, ['checkout', '-q', 'feature']);

    const result = spawnSync(process.execPath, [script, 'main', dir], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.outcome, 'clean');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: exit code 2 khi không tự giải được', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2-DA-SUA\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main sửa']);
    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm']);

    const result = spawnSync(process.execPath, [script, 'main', dir], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.outcome, 'aborted-ineligible');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────── Mục `P-024` · trailer commit gộp ──
//
// KF-010: commit gộp do tool tạo ra đời không mang trailer, và bước bù bằng
// tay đã hụt một lượt (9 commit thiếu `Claude-Session`). Việc ghi trailer
// nay nằm TRONG tool. Test này gọi tool trên cây dựng sẵn rồi đọc
// `git log -1 --format=%B` — và phải ĐỎ THẬT khi gỡ phần ghi trailer.

/** Đặt `CLAUDE_SESSION_URL` cho một lần chạy rồi trả lại giá trị cũ. */
function withSessionUrl<T>(value: string | undefined, fn: () => T): T {
  const key = 'CLAUDE_SESSION_URL';
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

/** main tiến ở file không liên quan, feature thêm dòng — gộp sạch, tạo commit. */
function cleanMergeFixture(dir: string): void {
  git(dir, ['checkout', '-q', 'main']);
  writeFileSync(join(dir, 'other.txt'), 'khong-lien-quan\nmain-them\n', 'utf8');
  git(dir, ['commit', '-q', '-am', 'main thêm dòng ở other.txt']);
  git(dir, ['checkout', '-q', 'feature']);
  writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
  git(dir, ['commit', '-q', '-am', 'feature thêm dòng ở shared.log']);
}

test('commit gộp SẠCH mang Co-Authored-By trung tính model, và Claude-Session khi có URL phiên', () => {
  const dir = initRepo();
  try {
    cleanMergeFixture(dir);
    const result = withSessionUrl('https://claude.ai/code/session_01TEST', () =>
      resolveAdditiveMerge(dir, 'main'),
    );
    assert.equal(result.outcome, 'clean');
    assert.equal(result.sessionTrailerMissing, undefined, 'có URL phiên thì không được báo thiếu');

    const body = git(dir, ['log', '-1', '--format=%B']);
    assert.match(body, /Co-Authored-By: Claude <noreply@anthropic\.com>/, 'thiếu Co-Authored-By');
    assert.match(body, /Claude-Session: https:\/\/claude\.ai\/code\/session_01TEST/, 'thiếu Claude-Session');
    // Tên model KHÔNG được lọt vào trailer (CLAUDE.md mục 6; ca đã sai thật
    // trên main là `Co-Authored-By` có kèm tên model).
    assert.ok(!/Opus|Sonnet|Haiku/i.test(body), `tên model lọt vào commit: ${body}`);

    // git đọc lại được như một khối trailer thật, đúng thứ recheck-assumptions
    // (G14) dựa vào — không chỉ là chuỗi nằm trong thân.
    const session = git(dir, ['log', '-1', '--format=%(trailers:key=Claude-Session,valueonly=true)']).trim();
    assert.equal(session, 'https://claude.ai/code/session_01TEST');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commit gộp UNION (resolved) cũng mang đủ hai trailer', () => {
  const dir = initRepo();
  try {
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nmain-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm dòng ở shared.log']);
    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\ndong-goc-2\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm dòng ở shared.log']);

    const result = withSessionUrl('https://claude.ai/code/session_01UNION', () =>
      resolveAdditiveMerge(dir, 'main'),
    );
    assert.equal(result.outcome, 'resolved');

    const body = git(dir, ['log', '-1', '--format=%B']);
    assert.match(body, /Co-Authored-By: Claude <noreply@anthropic\.com>/, 'thiếu Co-Authored-By');
    assert.match(body, /Claude-Session: https:\/\/claude\.ai\/code\/session_01UNION/, 'thiếu Claude-Session');
    assert.ok(!/Opus|Sonnet|Haiku/i.test(body), `tên model lọt vào commit: ${body}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('thiếu URL phiên: commit vẫn mang Co-Authored-By, và kết quả NÓI RA chỗ thiếu', () => {
  const dir = initRepo();
  try {
    cleanMergeFixture(dir);
    const result = withSessionUrl(undefined, () => resolveAdditiveMerge(dir, 'main'));
    assert.equal(result.outcome, 'clean');
    assert.equal(result.sessionTrailerMissing, true, 'thiếu mã phiên phải nói ra, không nuốt im');

    const body = git(dir, ['log', '-1', '--format=%B']);
    assert.match(body, /Co-Authored-By: Claude <noreply@anthropic\.com>/, 'Co-Authored-By phải luôn có');
    assert.ok(!/Claude-Session:/.test(body), 'không có URL thì không được bịa ra trailer Claude-Session');
    assert.ok(!/Opus|Sonnet|Haiku/i.test(body), `tên model lọt vào commit: ${body}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
