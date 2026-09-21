/**
 * `ops/scripts/integrator-lockfile.ts` và đường lockfile của
 * `ops/scripts/integrator-resolve.ts` — cơ chế của mục `I-004`.
 *
 * Như test của `P-016`: dựng git repo THẬT trong thư mục tạm, gộp THẬT, và
 * gọi `pnpm` THẬT. Không mô phỏng lockfile bằng chuỗi dựng sẵn — một bài
 * kiểm về lockfile mà không có `pnpm` trong đó thì chỉ kiểm được chính nó.
 *
 * Fixture không gọi mạng: mọi phụ thuộc đều là `workspace:*` giữa các gói
 * trong cùng workspace, nên `pnpm install --lockfile-only` phân giải tại
 * chỗ. Nhờ vậy test chạy được cả khi runner không ra được internet.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAdditiveMerge } from '../scripts/integrator-resolve.ts';
import { isLockfile, isManifest, regenerateLockfile } from '../scripts/integrator-lockfile.ts';

function git(cwd: string, args: string[]): string {
  // `maxBuffer` lớn vì cùng lý do với bản trong `integrator-resolve.ts`:
  // bài kiểm lockfile > 1 MiB dưới đây làm chính helper này đứt trước, và
  // khi đó test đỏ vì fixture chứ không vì code — đã gặp thật.
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function pnpmLockOnly(cwd: string): void {
  const result = spawnSync(
    'pnpm',
    ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts'],
    { cwd, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`pnpm install --lockfile-only thất bại: ${result.stderr || result.stdout}`);
  }
}

function writeManifest(dir: string, name: string, dependency?: string): void {
  const manifest: Record<string, unknown> = { name, version: '0.0.0', private: true };
  if (dependency !== undefined) manifest.dependencies = { [dependency]: 'workspace:*' };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * Workspace pnpm thật: gốc cộng bốn gói `pkg-a`…`pkg-d`, lockfile do `pnpm`
 * sinh và đã commit. Nhánh `main` và `feature` cùng rẽ từ đó.
 */
function initWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-repo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  writeManifest(dir, 'root');
  // `node_modules/` phải được bỏ qua như ở repo thật: từ mục `I-006`, cổng
  // lockfile sau khi gộp là một lần CÀI THẬT, nên nó để lại `node_modules/`
  // trong cây. Thiếu dòng này, bài kiểm "cây sạch sau khi gộp" dưới đây đỏ
  // vì fixture, không vì code.
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n', 'utf8');
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8');
  writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\n', 'utf8');
  for (const name of ['a', 'b', 'c', 'd']) {
    const packageDir = join(dir, 'packages', name);
    mkdirSync(packageDir, { recursive: true });
    writeManifest(packageDir, `pkg-${name}`);
  }
  pnpmLockOnly(dir);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'gốc']);
  git(dir, ['branch', 'feature']);
  return dir;
}

/**
 * Sửa một dòng của khối `settings:` trong lockfile. Dùng để ÉP hai bên đụng
 * đúng một chỗ trong lockfile — hai dòng cạnh nhau, mỗi bên sửa một dòng —
 * nên git chắc chắn báo xung đột, và numstat chắc chắn có xoá ở cả hai bên.
 *
 * Vì sao phải ép: xung đột lockfile thật gần như luôn nằm ở khối `packages:`
 * của gói tải từ registry, mà dựng được khối đó thì test phải gọi mạng. Nội
 * dung ép ở đây bị bước tạo lại vứt đi hoàn toàn, nên nó không làm kết quả
 * dễ dãi hơn: nó chỉ dựng đúng HÌNH DẠNG xung đột (sửa dòng ở cả hai bên)
 * mà luật "thuần cộng thêm" luôn từ chối.
 */
function touchLockSetting(dir: string, from: string, to: string): void {
  const path = join(dir, 'pnpm-lock.yaml');
  const before = readFileSync(path, 'utf8');
  assert.ok(before.includes(from), `fixture sai: lockfile không có "${from}"`);
  writeFileSync(path, before.replace(from, to), 'utf8');
}

/** Dựng đúng ca I-004: lockfile xung đột, manifest thì không. */
function makeLockfileConflict(dir: string): void {
  // main: pkg-a phụ thuộc pkg-c.
  git(dir, ['checkout', '-q', 'main']);
  writeManifest(join(dir, 'packages', 'a'), 'pkg-a', 'pkg-c');
  pnpmLockOnly(dir);
  touchLockSetting(dir, '  autoInstallPeers: true', '  autoInstallPeers: false');
  git(dir, ['commit', '-q', '-am', 'main: pkg-a phụ thuộc pkg-c']);

  // feature: pkg-b phụ thuộc pkg-d. Khác file manifest, nên manifest KHÔNG
  // xung đột — chỉ lockfile xung đột.
  git(dir, ['checkout', '-q', 'feature']);
  writeManifest(join(dir, 'packages', 'b'), 'pkg-b', 'pkg-d');
  pnpmLockOnly(dir);
  touchLockSetting(
    dir,
    '  excludeLinksFromLockfile: false',
    '  excludeLinksFromLockfile: true',
  );
  git(dir, ['commit', '-q', '-am', 'feature: pkg-b phụ thuộc pkg-d']);
}

/** Xác nhận fixture THẬT SỰ sinh xung đột ở đúng các file mong đợi. */
function assertConflicts(dir: string, expected: string[]): void {
  const merge = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.notEqual(merge.status, 0, 'fixture sai: git gộp sạch, không có xung đột nào để giải');
  const conflicted = git(dir, ['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .sort();
  assert.deepEqual(conflicted, [...expected].sort());
  spawnSync('git', ['merge', '--abort'], { cwd: dir, encoding: 'utf8' });
}

/** Một `pnpm` giả: chạy đúng `body` rồi thoát. Dùng để dựng ca hỏng. */
function fakePnpm(dir: string, body: string): string {
  const path = join(dir, 'fake-pnpm.sh');
  writeFileSync(path, `#!/bin/sh\n${body}\n`, 'utf8');
  chmodSync(path, 0o755);
  return path;
}

test('nhận diện lockfile và manifest theo tên file, ở mọi độ sâu', () => {
  assert.equal(isLockfile('pnpm-lock.yaml'), true);
  assert.equal(isLockfile('packages/x/pnpm-lock.yaml'), true);
  assert.equal(isLockfile('ops/logs/platform.jsonl'), false);
  assert.equal(isLockfile('pnpm-lock.yaml.bak'), false);
  assert.equal(isManifest('package.json'), true);
  assert.equal(isManifest('packages/a/package.json'), true);
  assert.equal(isManifest('pnpm-workspace.yaml'), true);
  assert.equal(isManifest('kernel/contracts/envelope.schema.json'), false);
});

test('lockfile xung đột có SỬA DÒNG ở cả hai bên: tạo lại, không bỏ cuộc', () => {
  const dir = initWorkspace();
  try {
    makeLockfileConflict(dir);
    assertConflicts(dir, ['pnpm-lock.yaml']);

    // Đúng hình dạng mà luật "thuần cộng thêm" luôn từ chối: cả hai bên đều
    // có dòng bị xoá. Nếu con số này về 0 thì test không còn kiểm điều nó
    // nói là đang kiểm.
    const base = git(dir, ['merge-base', 'HEAD', 'main']).trim();
    for (const side of ['HEAD', 'main']) {
      const numstat = git(dir, ['diff', '--numstat', base, side, '--', 'pnpm-lock.yaml']).trim();
      assert.ok(Number(numstat.split('\t')[1]) > 0, `fixture sai: ${side} không xoá dòng nào`);
    }

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'resolved', result.reason);
    assert.deepEqual(result.files, ['pnpm-lock.yaml']);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
    assert.notEqual(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'phải có commit merge mới');

    // Lockfile mang CẢ HAI bên: đây là điều union không bao giờ bảo đảm
    // được, vì nó ghép dòng chứ không đọc manifest.
    const lock = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
    assert.match(lock, /link:\.\.\/c/, 'thiếu phụ thuộc pkg-a → pkg-c của main');
    assert.match(lock, /link:\.\.\/d/, 'thiếu phụ thuộc pkg-b → pkg-d của feature');
    assert.doesNotMatch(lock, /^(<{7}|={7}|>{7})/m, 'còn dấu xung đột trong lockfile');

    // Và nó là bản CHÍNH TẮC của pnpm, không phải một bản ghép lại gần
    // giống: sinh lại lần nữa trên cùng cây phải ra y hệt từng byte.
    pnpmLockOnly(dir);
    assert.equal(readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8'), lock);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lockfile đi cùng file append-only: log union, lockfile tạo lại, một commit', () => {
  const dir = initWorkspace();
  try {
    makeLockfileConflict(dir);

    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\nmain-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm dòng log']);
    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'shared.log'), 'dong-goc-1\nfeature-them\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm dòng log']);

    assertConflicts(dir, ['pnpm-lock.yaml', 'shared.log']);

    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'resolved', result.reason);
    assert.deepEqual([...result.files].sort(), ['pnpm-lock.yaml', 'shared.log']);

    const log = readFileSync(join(dir, 'shared.log'), 'utf8');
    assert.match(log, /main-them/);
    assert.match(log, /feature-them/);
    const lock = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
    assert.match(lock, /link:\.\.\/c/);
    assert.match(lock, /link:\.\.\/d/);

    const message = git(dir, ['log', '-1', '--pretty=%B']);
    assert.match(message, /union thuần cộng thêm: shared\.log/);
    assert.match(message, /lockfile tạo lại: pnpm-lock\.yaml/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest xung đột cùng lúc với lockfile: dừng lại, không sinh từ nguồn hỏng', () => {
  const dir = initWorkspace();
  try {
    // Cả hai bên cùng sửa MỘT manifest → package.json xung đột theo.
    git(dir, ['checkout', '-q', 'main']);
    writeManifest(join(dir, 'packages', 'a'), 'pkg-a', 'pkg-c');
    pnpmLockOnly(dir);
    git(dir, ['commit', '-q', '-am', 'main: pkg-a phụ thuộc pkg-c']);
    git(dir, ['checkout', '-q', 'feature']);
    writeManifest(join(dir, 'packages', 'a'), 'pkg-a', 'pkg-d');
    pnpmLockOnly(dir);
    git(dir, ['commit', '-q', '-am', 'feature: pkg-a phụ thuộc pkg-d']);

    assertConflicts(dir, ['packages/a/package.json', 'pnpm-lock.yaml']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible');
    assert.match(result.reason ?? '', /manifest xung đột cùng lúc với lockfile/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'HEAD không được đổi');
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'cây phải sạch sau khi huỷ');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lockfile bị xoá ở một bên: dừng lại, không hồi sinh file vừa bị bỏ', () => {
  const dir = initWorkspace();
  try {
    git(dir, ['checkout', '-q', 'main']);
    touchLockSetting(dir, '  autoInstallPeers: true', '  autoInstallPeers: false');
    git(dir, ['commit', '-q', '-am', 'main: sửa lockfile']);
    git(dir, ['checkout', '-q', 'feature']);
    git(dir, ['rm', '-q', 'pnpm-lock.yaml']);
    git(dir, ['commit', '-q', '-m', 'feature: bỏ lockfile']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible');
    assert.match(result.reason ?? '', /bị xoá ở một bên/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pnpm đỏ khi tạo lại: huỷ lần gộp, cây quay về nguyên trạng', () => {
  const dir = initWorkspace();
  try {
    makeLockfileConflict(dir);
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    // File pnpm giả để NGOÀI repo: `resolveAdditiveMerge` từ chối cây bẩn,
    // nên một file lạ trong repo sẽ chặn ngay ở cửa và test hoá ra kiểm
    // nhầm thứ (đúng điều đã xảy ra ở bản nháp đầu của test này).
    const binDir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-bin-'));
    try {
      const pnpmCommand = fakePnpm(binDir, 'echo "ERR_PNPM_GIA" >&2; exit 1');

      const result = resolveAdditiveMerge(dir, 'main', { pnpmCommand });
      assert.equal(result.outcome, 'aborted-error');
      assert.match(result.reason ?? '', /pnpm install --lockfile-only thất bại/);
      assert.match(result.reason ?? '', /ERR_PNPM_GIA/);
      assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before, 'HEAD không được đổi');
      assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'cây phải sạch sau khi huỷ');
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pnpm xanh nhưng lockfile SINH RA còn dấu xung đột: coi là hỏng', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    // Bản mồi sạch — chỗ đang kiểm là ĐẦU RA, không phải đầu vào.
    const pnpmCommand = fakePnpm(
      dir,
      'printf "<<<<<<< HEAD\\nours\\n=======\\ntheirs\\n>>>>>>> main\\n" > pnpm-lock.yaml\nexit 0',
    );
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n", { pnpmCommand });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /VẪN còn dấu xung đột/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pnpm xanh nhưng không sinh ra lockfile nào: coi là hỏng', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    const pnpmCommand = fakePnpm(dir, 'rm -f pnpm-lock.yaml; exit 0');
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', 'noi-dung-cu\n', { pnpmCommand });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /không có lockfile nào được sinh ra/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cổng --frozen-lockfile đỏ sau khi sinh: coi là hỏng, không nuốt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    // pnpm giả: lần sinh thì xanh, lần kiểm bằng --frozen-lockfile thì đỏ.
    const pnpmCommand = fakePnpm(
      dir,
      'case "$*" in *--frozen-lockfile*) echo "lech manifest" >&2; exit 1;; esac\nexit 0',
    );
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', 'lockfileVersion: \'9.0\'\n', {
      pnpmCommand,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /không khớp manifest/);
    assert.match(result.reason ?? '', /lech manifest/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bản mồi pnpm thấy ĐÚNG LÀ bản của MERGE_HEAD, không phải của HEAD', () => {
  // Bài kiểm này đi qua `resolveAdditiveMerge` và chụp lại nội dung
  // `pnpm-lock.yaml` ĐÚNG LÚC pnpm được gọi. Bản trước chỉ gọi thẳng
  // `regenerateLockfile` với `seed` do chính nó dựng rồi khẳng định file
  // bằng `seed` — tức là tự khẳng định thứ nó dựng sẵn. Kiểm bằng đột biến
  // cho thấy bản đó xanh giả: đổi `MERGE_HEAD:` thành `HEAD:`, hoặc bỏ hẳn
  // bản mồi (`seed = null`), đều KHÔNG làm test nào đỏ. Bảo đảm "không trôi
  // phiên bản" vì thế chưa từng được kiểm. Đây là chỗ kiểm nó.
  const dir = initWorkspace();
  const binDir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-bin-'));
  try {
    makeLockfileConflict(dir);
    const captured = join(binDir, 'seed-pnpm-nhin-thay.yaml');
    // pnpm giả: chụp bản mồi ở lần gọi đầu, rồi để nguyên file (coi như
    // không có gì phải đổi) để cổng --frozen-lockfile giả cũng xanh.
    const pnpmCommand = fakePnpm(binDir, `[ -f "${captured}" ] || cp pnpm-lock.yaml "${captured}"\nexit 0`);

    const result = resolveAdditiveMerge(dir, 'main', { pnpmCommand });
    assert.equal(result.outcome, 'resolved', result.reason);

    const seedSeen = readFileSync(captured, 'utf8');
    const mergeHeadVersion = git(dir, ['show', 'main:pnpm-lock.yaml']);
    const headVersion = git(dir, ['show', 'HEAD~1:pnpm-lock.yaml']);
    assert.equal(seedSeen, mergeHeadVersion, 'pnpm phải thấy bản lockfile của MERGE_HEAD');
    assert.notEqual(seedSeen, headVersion, 'fixture sai: hai bên có lockfile giống nhau');
    assert.notEqual(seedSeen, '', 'bản mồi rỗng nghĩa là cơ chế chống trôi phiên bản đã mất');
  } finally {
    rmSync(binDir, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lockfile lớn hơn 1 MiB: không bị cắt cụt, không thành aborted-error', () => {
  // `spawnSync` mặc định cho stdout 1 MiB; vượt ngưỡng thì Node GIẾT tiến
  // trình (`ENOBUFS`, `signal: SIGTERM`) và trả về stdout ĐÃ CẮT CỤT. Với
  // `git show MERGE_HEAD:pnpm-lock.yaml` thì 1 MiB là ngưỡng mà mọi repo có
  // phụ thuộc thật vượt qua — repo này mới 2,4 KB nên chưa lộ. Nếu không
  // chặn, mọi xung đột lockfile thật sẽ ra `aborted-error` và PR nằm chờ
  // người, tức là đúng thứ I-004 sinh ra để xoá.
  const dir = initWorkspace();
  const binDir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-bin-'));
  try {
    const filler = `# ${'x'.repeat(78)}\n`.repeat(24_000); // ~1,9 MiB
    for (const [branch, marker] of [
      ['main', 'main'],
      ['feature', 'feature'],
    ] as const) {
      git(dir, ['checkout', '-q', branch]);
      writeFileSync(join(dir, 'pnpm-lock.yaml'), `# ${marker}\n${filler}`, 'utf8');
      git(dir, ['commit', '-q', '-am', `${branch}: lockfile lớn`]);
    }
    assertConflicts(dir, ['pnpm-lock.yaml']);

    // pnpm giả để nguyên file: chỗ đang kiểm là đường ống git, không phải pnpm.
    const pnpmCommand = fakePnpm(binDir, 'exit 0');
    const result = resolveAdditiveMerge(dir, 'main', { pnpmCommand });
    assert.equal(result.outcome, 'resolved', result.reason);

    const committed = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8');
    const fromMergeHead = git(dir, ['show', 'main:pnpm-lock.yaml']);
    assert.ok(committed.length > 1024 * 1024, 'fixture sai: lockfile chưa vượt 1 MiB');
    assert.equal(committed.length, fromMergeHead.length, 'bản mồi bị cắt cụt');
  } finally {
    rmSync(binDir, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lockfile KHÔNG ở gốc repo: dừng lại, vì pnpm chạy ở thư mục con không sinh lại nó', () => {
  const dir = initWorkspace();
  try {
    // Cả hai bên cùng thêm một lockfile lồng, nội dung khác nhau → add/add.
    for (const [branch, content] of [
      ['main', 'noi-dung-cua-main\n'],
      ['feature', 'noi-dung-cua-feature\n'],
    ] as const) {
      git(dir, ['checkout', '-q', branch]);
      writeFileSync(join(dir, 'packages', 'a', 'pnpm-lock.yaml'), content, 'utf8');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-q', '-m', `${branch}: thêm lockfile lồng`]);
    }

    assertConflicts(dir, ['packages/a/pnpm-lock.yaml']);

    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible');
    assert.match(result.reason ?? '', /không nằm ở gốc repo/);
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bản mồi còn dấu xung đột: dừng lại, vì pnpm sẽ lặng lẽ sinh lại từ số không', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    const pnpmCommand = fakePnpm(dir, 'exit 0');
    const seed = "<<<<<<< HEAD\nlockfileVersion: '9.0'\n=======\nlockfileVersion: '9.0'\n>>>>>>> main\n";
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', seed, { pnpmCommand });
    assert.equal(result.ok, false);
    assert.equal(result.ineligible, true, 'ca này cần người, không phải lỗi kỹ thuật');
    assert.match(result.reason ?? '', /bản mồi ở MERGE_HEAD còn dấu xung đột/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pnpm nói nó đã vứt bản mồi: coi là thất bại, dù thoát 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    // Đúng câu pnpm thật in ra khi nó bỏ bản mồi — đã đo bằng chạy thật.
    const pnpmCommand = fakePnpm(dir, 'echo "WARN  Ignoring broken lockfile at /repo: khong phan giai duoc"\nexit 0');
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\n", { pnpmCommand });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /đã VỨT bản mồi/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lệnh sinh mang đúng --no-frozen-lockfile, rồi mới tới lượt kiểm lại', () => {
  const dir = mkdtempSync(join(tmpdir(), 'integrator-lockfile-unit-'));
  try {
    // pnpm giả chỉ ghi lại đối số của lần gọi đầu, rồi để nguyên file.
    const pnpmCommand = fakePnpm(dir, 'echo "$@" >> args.txt\nexit 0');
    const seed = "lockfileVersion: '9.0'\n";
    const result = regenerateLockfile(dir, 'pnpm-lock.yaml', seed, { pnpmCommand });
    assert.equal(result.ok, true, result.reason);
    assert.equal(readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8'), seed, 'bản mồi phải được ghi');
    const calls = readFileSync(join(dir, 'args.txt'), 'utf8').trim().split('\n');
    assert.equal(calls.length, 2, 'phải gọi hai lần: sinh, rồi kiểm lại');
    const [generateCall = '', verifyCall = ''] = calls;
    assert.match(generateCall, /--lockfile-only/);
    assert.match(generateCall, /--no-frozen-lockfile/);
    assert.match(verifyCall, /--frozen-lockfile/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
