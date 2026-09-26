/**
 * Mục `platform/P-061` (`KF-045`) — `pnpmEnv` và cổng quét phòng xa.
 *
 * Bài tái hiện lỗi bằng `pnpm` THẬT nằm ở
 * `ops/test/integrator-clean-merge-lockfile.test.ts` (fixture lệch manifest
 * sẵn có ở đó) và `ops/test/integrator-lockfile.test.ts` (vế `SEED_DISCARDED`).
 * File này canh hai thứ còn lại: `pnpmEnv` xoá ĐÚNG một biến, và không lời
 * gọi `pnpm` mới nào trong kho quên dùng nó.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findUnguardedPnpmSpawns, pnpmEnv } from '../scripts/pnpm-env.ts';

const ROOT = join(import.meta.dirname, '..', '..');

test('pnpmEnv: xoá `npm_config_reporter` ở mọi dạng hoa thường', () => {
  const env = pnpmEnv({ npm_config_reporter: 'silent', NPM_CONFIG_REPORTER: 'silent', Npm_Config_Reporter: 'silent' });
  assert.deepEqual(env, {});
});

test('pnpmEnv (ca âm): mọi biến KHÁC của người gọi đi qua nguyên vẹn, kể cả `CI` và cấu hình npm khác', () => {
  const base = {
    PATH: '/usr/bin',
    CI: 'true',
    HTTPS_PROXY: 'http://proxy:8080',
    npm_config_registry: 'https://registry.example/',
    npm_config_reporter_extra: 'x',
    npm_config_reporter: 'silent',
  };
  assert.deepEqual(pnpmEnv(base), {
    PATH: '/usr/bin',
    CI: 'true',
    HTTPS_PROXY: 'http://proxy:8080',
    npm_config_registry: 'https://registry.example/',
    npm_config_reporter_extra: 'x',
  });
});

test('pnpmEnv (ca âm): biến không có mặt thì env ra bằng đúng env vào, và không sửa bản gốc', () => {
  const base = { PATH: '/usr/bin', HOME: '/root' };
  const env = pnpmEnv(base);
  assert.deepEqual(env, base);
  assert.notEqual(env, base, 'phải là bản sao');
  const withVar = { npm_config_reporter: 'silent' };
  pnpmEnv(withVar);
  assert.deepEqual(withVar, { npm_config_reporter: 'silent' }, 'không được sửa env của người gọi');
});

test('pnpmEnv: mặc định đọc `process.env`', () => {
  const saved = process.env.npm_config_reporter;
  try {
    process.env.npm_config_reporter = 'silent';
    const env = pnpmEnv();
    assert.equal(env.npm_config_reporter, undefined);
    assert.equal(env.PATH, process.env.PATH);
  } finally {
    if (saved === undefined) delete process.env.npm_config_reporter;
    else process.env.npm_config_reporter = saved;
  }
});

test('findUnguardedPnpmSpawns: bắt lời gọi `pnpm` thiếu `env: pnpmEnv(…)`, qua chuỗi lẫn qua biến', () => {
  const source = [
    "const a = spawnSync('pnpm', ['install'], { cwd });",
    "const pnpm = options.pnpmCommand ?? 'pnpm';",
    'const b = spawnSync(',
    '  pnpm,',
    "  ['install', '--lockfile-only'],",
    "  { cwd: root, encoding: 'utf8' },",
    ');',
    "execFileSync(\"pnpm\", ['-v']);",
    "spawnSync('pnpm', ['-v'], { cwd, // TODO env: pnpmEnv() sau",
    '});',
    "execSync('pnpm install --frozen-lockfile', { cwd });",
  ].join('\n');
  assert.deepEqual(
    findUnguardedPnpmSpawns(source).map((f) => f.line),
    [1, 3, 8, 9, 11],
  );
});

test('findUnguardedPnpmSpawns (ca âm): có `env: pnpmEnv(…)` thì qua, lệnh không phải pnpm thì không đụng', () => {
  const source = [
    "const pnpm = options.pnpmCommand ?? 'pnpm';",
    "spawnSync(pnpm, ['install', '--frozen-lockfile'], { cwd, env: pnpmEnv() });",
    "spawnSync('pnpm', ['install'], {",
    '  cwd,',
    '  // một dấu ) trong chú thích không làm cắt sớm: "(x)"',
    "  maxBuffer: 1, env: pnpmEnv({ ...process.env, X: ')' }),",
    '});',
    "spawnSync('git', ['status'], { cwd });",
    "const tool = 'node';",
    "spawnSync(tool, ['-v']);",
    "spawnSync('pnpmx', ['-v']);",
  ].join('\n');
  assert.deepEqual(findUnguardedPnpmSpawns(source), []);
});

/** Mọi file `.ts` dưới `dir`, trừ thư mục `test/` và `node_modules/`. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'test') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts')) out.push(path);
  }
  return out;
}

test('cổng phòng xa: không lời gọi `pnpm` nào trong kernel/ops/workshops/spike thiếu `pnpmEnv`', () => {
  const files = ['kernel', 'ops', 'workshops', 'spike'].flatMap((d) => sourceFiles(join(ROOT, d)));
  assert.ok(files.length > 50, `quét được quá ít file (${files.length}) — đường dẫn gốc sai thì cổng này xanh giả`);

  const problems: string[] = [];
  let guarded = 0;
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    for (const f of findUnguardedPnpmSpawns(source)) {
      problems.push(`${relative(ROOT, path)}:${f.line} ${f.snippet}`);
    }
    // Chỉ đếm ở bên dùng: `pnpm-env.ts` tự nhắc chữ này trong chú thích và
    // regex, nên đếm cả nó thì con số không bao giờ tụt (vòng soát bước 6).
    if (!path.endsWith('pnpm-env.ts')) guarded += (source.match(/\benv\s*:\s*pnpmEnv\(/g) ?? []).length;
  }
  assert.deepEqual(
    problems,
    [],
    'lời gọi `pnpm` không vô hiệu hoá `npm_config_reporter` — thêm `env: pnpmEnv()` (KF-045):\n' + problems.join('\n'),
  );
  // Neo phép đo lúc làm mục: đúng ba lời gọi, cả ba ở `integrator-lockfile.ts`.
  // Số này tụt về 0 nghĩa là bộ quét hoặc bản sửa đã bị gỡ mà bài trên vẫn xanh.
  assert.ok(guarded >= 3, `chỉ thấy ${guarded} lời gọi mang \`env: pnpmEnv(\` — bản sửa của P-061 đã bị gỡ?`);
});
