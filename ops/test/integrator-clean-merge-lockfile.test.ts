/**
 * Mục `I-006` — **lockfile gộp SẠCH mà vẫn lệch manifest.**
 *
 * `I-004` phủ ca lockfile *xung đột*. Ca này khác hẳn: git gộp
 * `pnpm-lock.yaml` **không một dấu xung đột nào**, và kết quả vẫn sai. Lý
 * do là git ghép theo dòng và không hiểu YAML — hai nhánh sửa hai vùng cách
 * xa nhau trong cùng một file thì cả hai hunk đều được áp, dù về nghĩa
 * chúng loại trừ nhau.
 *
 * Tiêu chí xong của mục bắt **kiểm trước, dựa vào sau** (CHARTER 11.1):
 * dựng ca hỏng bằng chạy thật trước khi viết bất cứ cơ chế nào. Bài kiểm
 * đầu tiên dưới đây chính là ca đó, và nó dựng bằng `git` thật cộng `pnpm`
 * thật — nếu ngày nào git hoặc pnpm đổi hành vi tới mức ca này không còn
 * tái hiện được, bài kiểm sẽ đỏ và cơ chế trong `integrator-resolve.ts`
 * nên được gỡ, không phải giữ vì quán tính.
 *
 * Hình dạng của ca hỏng:
 *
 * | Nhánh | Đổi gì | Lockfile đổi ở đâu |
 * |---|---|---|
 * | `main` | `pkg-z` bỏ phụ thuộc `vend` — không còn ai dùng gói đó | khối `importers` của `packages/z`, và khối `packages:`/`snapshots:` của `vend` biến mất |
 * | `feature` | `pkg-a` thêm phụ thuộc `vend` | chỉ khối `importers` của `packages/a` |
 *
 * Hai vùng cách nhau đủ xa, nên git áp cả hai hunk và gộp sạch. Kết quả:
 * `importers` trỏ tới `vend@file:…` mà khối `packages:` không còn entry nào
 * cho nó. `pnpm install --frozen-lockfile` — lệnh CI chạy ở bước cài đặt —
 * đỏ với `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`; chính pnpm cũng nói
 * "probably caused by a badly resolved merge conflict". Còn `pnpm check` ở
 * máy thì xanh, vì nó không chạy lệnh đó. Đúng nhóm lỗi Z
 * (`ops/known-failures.md`): hỏng mà mọi chỉ báo đều xanh.
 *
 * **Fixture không gọi mạng** — cùng luật với `integrator-lockfile.test.ts`.
 * Phụ thuộc `vend` là một tarball dựng tại chỗ bằng `tar` và tham chiếu
 * bằng `file:`, nên nó có khối `packages:` thật (thứ mà `workspace:*` không
 * có) mà vẫn phân giải được khi runner không ra được internet.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAdditiveMerge } from '../scripts/integrator-resolve.ts';
import { verifyLockfileInstall } from '../scripts/integrator-lockfile.ts';

const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function pnpm(cwd: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync('pnpm', args, { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

function pnpmLockOnly(cwd: string): void {
  const result = pnpm(cwd, ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts']);
  if (result.status !== 0) {
    throw new Error(`pnpm install --lockfile-only thất bại: ${result.stderr || result.stdout}`);
  }
}

/** `pnpm` giả: chạy `body` rồi thoát. Dùng khi chỗ cần kiểm là đường ống, không phải pnpm. */
function fakePnpm(dir: string, body: string): string {
  const path = join(dir, 'fake-pnpm.sh');
  writeFileSync(path, `#!/bin/sh\n${body}\n`, 'utf8');
  chmodSync(path, 0o755);
  return path;
}

function writeManifest(dir: string, name: string, withVend: boolean): void {
  const manifest: Record<string, unknown> = { name, version: '0.0.0', private: true };
  if (withVend) manifest.dependencies = { vend: 'file:../../vendor/vend-1.0.0.tgz' };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * Workspace thật: gốc + bốn gói `pkg-a`, `pkg-m`, `pkg-n`, `pkg-z`, cộng
 * một tarball `vend` nằm trong repo.
 *
 * Hai gói đệm `pkg-m`/`pkg-n` không phải trang trí: chúng đẩy khối
 * `importers` của `packages/a` và của `packages/z` ra xa nhau hơn ba dòng
 * ngữ cảnh mà git dùng, và đó chính là điều kiện để git gộp **sạch** thay
 * vì báo xung đột. Bỏ chúng đi thì ca hỏng không còn tái hiện được — nên
 * bài kiểm khẳng định tường minh "gộp sạch" ở dưới, chứ không tin ngầm.
 */
function initWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'clean-merge-lockfile-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);

  // Tarball phụ thuộc, dựng tại chỗ — không gọi mạng.
  const src = join(dir, 'vendor', 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(
    join(src, 'package.json'),
    `${JSON.stringify({ name: 'vend', version: '1.0.0' }, null, 2)}\n`,
    'utf8',
  );
  const tar = spawnSync('tar', ['-czf', join(dir, 'vendor', 'vend-1.0.0.tgz'), '-C', src, '.'], {
    encoding: 'utf8',
  });
  if (tar.status !== 0) throw new Error(`tar thất bại: ${tar.stderr}`);
  rmSync(src, { recursive: true, force: true });

  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n', 'utf8');
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n", 'utf8');
  // File append-only kiểu `ops/logs/**`: bài kiểm đường union dưới đây cần
  // một file có tổ tiên chung thật, để đây là ca sửa/sửa chứ không phải
  // thêm/thêm với base rỗng.
  writeFileSync(join(dir, 'shared.log'), 'goc\n', 'utf8');
  writeManifest(dir, 'root', false);
  for (const name of ['a', 'm', 'n', 'z']) {
    const pkg = join(dir, 'packages', name);
    mkdirSync(pkg, { recursive: true });
    writeManifest(pkg, `pkg-${name}`, name === 'z');
  }
  pnpmLockOnly(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  return dir;
}

/** Dựng hai nhánh của ca hỏng và trả về thư mục, đang đứng ở `feature`. */
function initDivergence(): string {
  const dir = initWorkspace();

  git(dir, ['checkout', '-qb', 'feature']);
  writeManifest(join(dir, 'packages', 'a'), 'pkg-a', true);
  pnpmLockOnly(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'feature: pkg-a thêm phụ thuộc vend']);

  git(dir, ['checkout', '-q', 'main']);
  writeManifest(join(dir, 'packages', 'z'), 'pkg-z', false);
  pnpmLockOnly(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'main: pkg-z bỏ phụ thuộc vend']);

  git(dir, ['checkout', '-q', 'feature']);
  return dir;
}

test('TÁI HIỆN `I-006`: git gộp lockfile SẠCH mà kết quả lệch manifest', () => {
  const dir = initDivergence();
  try {
    const merge = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], {
      cwd: dir,
      encoding: 'utf8',
    });

    // 1. Gộp SẠCH — đây là cả vấn đề. Không có gì cho integrator "giải".
    assert.equal(merge.status, 0, `fixture sai: git báo xung đột, ca cần kiểm là ca gộp sạch:\n${merge.stdout}${merge.stderr}`);
    assert.equal(
      git(dir, ['diff', '--name-only', '--diff-filter=U']).trim(),
      '',
      'fixture sai: còn file xung đột',
    );

    // 2. Lockfile đã gộp: `importers` còn trỏ tới `vend`, `packages:` thì không.
    const merged = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
    assert.match(merged, /packages\/a:\n\s+dependencies:\n\s+vend:/, 'fixture sai: importers không trỏ tới vend');
    assert.doesNotMatch(
      merged,
      /^ {2}vend@file:/m,
      'fixture sai: khối packages: vẫn còn entry cho vend, chưa dựng được ca lệch',
    );

    // 3. Cổng rẻ nói XANH — đây là lý do cổng của `I-004` không đủ cho mục này.
    const cheap = pnpm(dir, ['install', '--lockfile-only', '--frozen-lockfile', '--ignore-scripts']);
    assert.equal(
      cheap.status,
      0,
      'giả định của I-006 đã đổi: cổng --lockfile-only nay BẮT được ca này, xem lại verifyLockfileInstall',
    );

    // 4. Cổng thật — lệnh CI chạy — thì ĐỎ.
    const real = verifyLockfileInstall(dir);
    assert.equal(real.ok, false, 'không tái hiện được: pnpm install --frozen-lockfile vẫn xanh');
    assert.equal(real.ineligible, true);
    assert.match(String(real.reason), /ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('`I-006`: gộp sạch có chạm lockfile thì tạo lại và kiểm lại, rồi mới commit', () => {
  const dir = initDivergence();
  try {
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');

    assert.equal(result.outcome, 'clean', `mong đợi clean, nhận: ${JSON.stringify(result)}`);
    assert.deepEqual(result.lockfileRegenerated, ['pnpm-lock.yaml']);

    // Có commit gộp mới, và thông điệp nói rõ lockfile đã phải tạo lại —
    // phụ lục P3 bước 0b đọc `git log -1` để biết có gì để push hay không.
    const after = git(dir, ['rev-parse', 'HEAD']).trim();
    assert.notEqual(after, before);
    assert.match(git(dir, ['log', '-1', '--format=%s']).trim(), /lockfile tạo lại: pnpm-lock\.yaml/);

    // Cây sạch, không còn merge dở dang, và lockfile đã commit là bản qua cổng.
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
    assert.equal(verifyLockfileInstall(dir).ok, true);

    // Không trôi phiên bản: `vend` quay lại đúng phép phân giải cũ.
    const fixed = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
    assert.match(fixed, /^ {2}vend@file:vendor\/vend-1\.0\.0\.tgz:/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('`I-006`: cổng vẫn đỏ sau khi tạo lại thì huỷ gộp, không commit gì', () => {
  const dir = initDivergence();
  // `pnpm` giả để NGOÀI repo: `resolveAdditiveMerge` từ chối cây bẩn.
  const binDir = mkdtempSync(join(tmpdir(), 'clean-merge-fake-pnpm-'));
  try {
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    // Sinh thì xanh và để nguyên lockfile (coi như không sửa được gì), kiểm thì đỏ.
    const pnpmCommand = fakePnpm(
      binDir,
      'case "$*" in *--lockfile-only*) exit 0 ;; esac\necho "ERR_PNPM_OUTDATED_LOCKFILE gia" >&2; exit 1',
    );

    const result = resolveAdditiveMerge(dir, 'main', { pnpmCommand });

    assert.equal(result.outcome, 'aborted-ineligible', JSON.stringify(result));
    assert.match(String(result.reason), /SAU KHI đã tạo lại/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'đã commit dù cổng đỏ');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'cây làm việc còn dở dang sau khi huỷ');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(binDir, { recursive: true, force: true });
  }
});

test('`I-006`: cổng cũng chạy ở đường union, khi lockfile gộp sạch mà file khác vướng', () => {
  const dir = initWorkspace();
  try {
    // Một file append-only (kiểu `ops/logs/**`) xung đột thuần cộng thêm ở
    // cả hai bên — đúng ca mà đường union sinh ra để giải. Lockfile thì
    // gộp SẠCH và lệch, y như bài tái hiện ở trên. Trước mục `I-006`,
    // đường union chỉ kiểm lockfile khi CHÍNH NÓ xung đột, nên ca này —
    // lockfile không nằm trong danh sách xung đột — đi thẳng qua.
    git(dir, ['checkout', '-qb', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'goc\nfeature\n', 'utf8');
    writeManifest(join(dir, 'packages', 'a'), 'pkg-a', true);
    pnpmLockOnly(dir);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-qm', 'feature: log + pkg-a thêm vend']);

    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'shared.log'), 'goc\nmain\n', 'utf8');
    writeManifest(join(dir, 'packages', 'z'), 'pkg-z', false);
    pnpmLockOnly(dir);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-qm', 'main: log + pkg-z bỏ vend']);

    git(dir, ['checkout', '-q', 'feature']);
    const result = resolveAdditiveMerge(dir, 'main');

    assert.equal(result.outcome, 'resolved', `mong đợi resolved, nhận: ${JSON.stringify(result)}`);
    assert.deepEqual(result.files, ['shared.log'], 'ca cần kiểm là ca lockfile KHÔNG nằm trong danh sách xung đột');
    assert.deepEqual(result.lockfileRegenerated, ['pnpm-lock.yaml']);

    // Union giữ cả hai bên của file append-only, và lockfile đã qua cổng.
    const log = readFileSync(join(dir, 'shared.log'), 'utf8');
    assert.match(log, /feature/);
    assert.match(log, /main/);
    assert.equal(verifyLockfileInstall(dir).ok, true);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('`I-006`: lần gộp XOÁ lockfile thì không cài thật, và cây vẫn sạch', () => {
  // Hồi quy tìm ra ở vòng soát chéo: `pnpm install` không thấy lockfile sẽ
  // TỰ SINH một bản mới rồi thoát 0. Chạy cổng ở ca này tức là hồi sinh
  // đúng file mà một bên vừa cố ý xoá, và để lại một cây bẩn — lượt gộp
  // kế tiếp sẽ ra `aborted-error` "cây làm việc không sạch".
  const dir = initWorkspace();
  try {
    git(dir, ['checkout', '-qb', 'feature']);
    writeFileSync(join(dir, 'README.md'), 'feature\n', 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-qm', 'feature: README']);

    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['rm', '-q', 'pnpm-lock.yaml']);
    git(dir, ['commit', '-qm', 'main: bỏ pnpm-lock.yaml']);

    git(dir, ['checkout', '-q', 'feature']);
    const result = resolveAdditiveMerge(dir, 'main');

    assert.equal(result.outcome, 'clean', JSON.stringify(result));
    assert.equal(result.lockfileRegenerated, undefined);
    assert.equal(
      git(dir, ['status', '--porcelain']).trim(),
      '',
      'cổng đã cài thật và sinh lại lockfile mà một bên vừa xoá',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('`I-006`: gộp sạch KHÔNG chạm lockfile thì không gọi pnpm lần nào', () => {
  const dir = initWorkspace();
  const binDir = mkdtempSync(join(tmpdir(), 'clean-merge-fake-pnpm-'));
  try {
    // Nhánh main đổi một file thường; lockfile không dính gì.
    git(dir, ['checkout', '-qb', 'feature']);
    writeFileSync(join(dir, 'README.md'), 'feature\n', 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-qm', 'feature: README']);
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'NOTES.md'), 'main\n', 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-qm', 'main: NOTES']);
    git(dir, ['checkout', '-q', 'feature']);

    // `pnpm` giả ghi lại mọi lần bị gọi. Cổng đắt (cài thật) không được
    // chạy ở mọi lần gộp — chỉ khi lockfile thật sự đổi.
    const marker = join(binDir, 'called.txt');
    const pnpmCommand = fakePnpm(binDir, `echo "$@" >> "${marker}"\nexit 0`);

    const result = resolveAdditiveMerge(dir, 'main', { pnpmCommand });

    assert.equal(result.outcome, 'clean');
    assert.equal(result.lockfileRegenerated, undefined);
    assert.equal(
      spawnSync('cat', [marker], { encoding: 'utf8' }).stdout ?? '',
      '',
      'cổng lockfile đã chạy dù lần gộp không chạm pnpm-lock.yaml',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(binDir, { recursive: true, force: true });
  }
});

/**
 * Mục `platform/P-061` (`KF-045`): `pnpm -s run …` xuất
 * `npm_config_reporter=silent` vào môi trường, và `pnpm` lồng trong
 * `verifyLockfileInstall` kế thừa nó thì in **0 byte** — `reason` còn đúng
 * `(mã 1): ` rồi hết câu, mất bằng chứng phân biệt *lockfile lệch* với
 * *không ra được mạng*. Hai bài dưới đây là CÙNG MỘT bài, chỉ đổi đúng một
 * biến: bài đặt biến là bài tái hiện lỗi (đỏ trước bản sửa), bài không đặt
 * là ca âm canh để bản sửa không rút thành "bỏ qua env của người gọi".
 *
 * Neo vào **rỗng ↔ khác rỗng** của phần sau dấu hai chấm, không vào số
 * byte: đầu ra của `pnpm` mang `Done in <ms>` nên số byte đổi theo lần chạy.
 */
for (const reporter of ['silent', undefined] as const) {
  const label = reporter === undefined ? 'KHÔNG đặt `npm_config_reporter` (ca âm)' : `\`npm_config_reporter=${reporter}\` từ người gọi`;
  test(`${reporter === undefined ? '' : 'TÁI HIỆN '}\`P-061\`: ${label} — \`reason\` vẫn mang nguyên văn lỗi của pnpm`, () => {
    const saved = { lower: process.env.npm_config_reporter, upper: process.env.NPM_CONFIG_REPORTER };
    delete process.env.NPM_CONFIG_REPORTER;
    if (reporter === undefined) delete process.env.npm_config_reporter;
    else process.env.npm_config_reporter = reporter;
    const dir = initDivergence();
    try {
      const merge = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], { cwd: dir, encoding: 'utf8' });
      assert.equal(merge.status, 0, `fixture sai: git báo xung đột:\n${merge.stdout}${merge.stderr}`);

      const real = verifyLockfileInstall(dir);
      assert.equal(real.ok, false, 'không tái hiện được: pnpm install --frozen-lockfile vẫn xanh');
      assert.equal(real.ineligible, true);
      const text = String(real.reason).replace(/^[^:]*\(mã \d+\):/, '').trim();
      assert.notEqual(text, '', `reason mất hết đầu ra của pnpm: ${JSON.stringify(real.reason)}`);
      assert.match(text, /ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      for (const [key, value] of [['npm_config_reporter', saved.lower], ['NPM_CONFIG_REPORTER', saved.upper]] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
}
