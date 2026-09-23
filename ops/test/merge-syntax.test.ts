/**
 * Cổng cú pháp sau khi gộp bằng union — mục `integration/I-018`, `KF-016`.
 *
 * Bài đầu tiên là **bài tái hiện lỗi** (bất biến I2): nó dựng đúng hình dạng
 * của PR `#71` bằng hai nhánh git thật và gộp thật, không mô phỏng. Trên bản
 * `main` trước bản sửa nó ĐỎ, vì `resolveAdditiveMerge` trả
 * `{"outcome":"resolved"}` cho một cây mà `tsc` không parse được.
 *
 * Các bài còn lại canh hai chiều của thiên lệch đã khai ở `merge-syntax.ts`:
 * cây lành phải đi qua (không báo sai, vì báo sai làm đứng hàng đợi merge),
 * và những cấu trúc ngoài mô hình phải **cho qua** chứ không phán.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAdditiveMerge } from '../scripts/integrator-resolve.ts';
import { fileSyntaxProblem, syntaxKind, yamlProblem } from '../scripts/merge-syntax.ts';

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} thất bại: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/**
 * Repo với `suite.test.ts` ở trạng thái gốc, nhánh `main` và `feature` cùng
 * rẽ từ đó. File gốc kết thúc bằng đúng dòng `});` — dòng mà cả hai bên sẽ
 * còn giữ, và là dòng union giữ **một lần**.
 */
const BASE_SUITE = ["test('a', () => {", '  ok();', '});', ''].join('\n');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'merge-syntax-repo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  writeFileSync(join(dir, 'suite.test.ts'), BASE_SUITE, 'utf8');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'gốc']);
  git(dir, ['branch', 'feature']);
  return dir;
}

test('KF-016: hai bên cùng thêm sau một dòng `});` chung — union nuốt dòng đóng khối, cổng phải chặn', () => {
  const dir = initRepo();
  try {
    // `main` viết thêm một test SAU dòng `});` của bản gốc.
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(
      join(dir, 'suite.test.ts'),
      [BASE_SUITE.trimEnd(), "test('main-thêm', () => {", '  ok();', '});', ''].join('\n'),
      'utf8',
    );
    git(dir, ['commit', '-q', '-am', 'main thêm một test']);

    // Nhánh viết thêm một test cũng sau dòng `});` của bản gốc.
    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(
      join(dir, 'suite.test.ts'),
      [BASE_SUITE.trimEnd(), "test('feature-thêm', () => {", '  ok();', '});', ''].join('\n'),
      'utf8',
    );
    git(dir, ['commit', '-q', '-am', 'feature thêm một test']);

    // Fixture phải tái hiện xung đột THẬT — nếu dòng này fail thì fixture
    // sai, không phải script sai.
    const probe = spawnSync('git', ['merge', '--no-commit', '--no-ff', 'main'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.notEqual(probe.status, 0, 'fixture phải tái hiện xung đột thật');
    git(dir, ['merge', '--abort']);

    // Và union phải thật sự để lại một cây hỏng — đây là điều kiện đầu vào
    // của lỗi, kiểm trước khi kiểm hành vi của tool.
    const before = git(dir, ['rev-parse', 'HEAD']).trim();
    const unioned = spawnSync(
      'git',
      ['merge-file', '--union', '-p', 'suite.test.ts', '/dev/null', '/dev/null'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(unioned.status !== null, true, 'git merge-file phải chạy được');

    const result = resolveAdditiveMerge(dir, 'main');

    assert.equal(
      result.outcome,
      'aborted-ineligible',
      `cây sau union không parse được thì KHÔNG được là resolved (nhận ${JSON.stringify(result)})`,
    );
    assert.deepEqual(result.files, ['suite.test.ts']);
    assert.match(result.reason ?? '', /không parse được/);
    assert.match(result.reason ?? '', /cần người/);
    assert.equal(
      git(dir, ['rev-parse', 'HEAD']).trim(),
      before,
      'merge phải được huỷ, HEAD không đổi',
    );
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '', 'cây làm việc phải sạch lại');
    assert.equal(
      readFileSync(join(dir, 'suite.test.ts'), 'utf8'),
      [BASE_SUITE.trimEnd(), "test('feature-thêm', () => {", '  ok();', '});', ''].join('\n'),
      'nội dung nhánh phải nguyên vẹn sau khi huỷ',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cây sau union vẫn parse được thì đi tiếp như trước — cổng không báo sai', () => {
  const dir = initRepo();
  try {
    // Hai bên cùng thêm một dòng vào một file `.ts` mà kết quả union vẫn
    // hợp cú pháp: hai khai báo độc lập, không lồng nhau.
    writeFileSync(join(dir, 'consts.ts'), 'export const base = 0;\n', 'utf8');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'thêm consts.ts']);
    git(dir, ['branch', '-f', 'feature', 'HEAD']);

    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'consts.ts'), 'export const base = 0;\nexport const fromMain = 1;\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm một hằng']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'consts.ts'), 'export const base = 0;\nexport const fromFeature = 2;\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm một hằng']);

    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'resolved', JSON.stringify(result));
    const merged = readFileSync(join(dir, 'consts.ts'), 'utf8');
    assert.match(merged, /fromMain/);
    assert.match(merged, /fromFeature/, 'union phải giữ cả hai bên');
    assert.equal(fileSyntaxProblem('consts.ts', merged), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON hỏng sau khi gộp cũng là `aborted-ineligible`, không phải `resolved`', () => {
  const dir = initRepo();
  try {
    writeFileSync(join(dir, 'data.json'), '{\n  "a": 1,\n  "z": 0\n}\n', 'utf8');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-q', '-m', 'thêm data.json']);
    git(dir, ['branch', '-f', 'feature', 'HEAD']);

    // Cùng hình dạng KF-016, ở JSON: hai bên cùng THÊM một khối lồng, và hai
    // khối kết thúc bằng dòng `  },` giống hệt nhau. Không bên nào xoá dòng
    // nào, nhưng union giữ dòng `  },` đúng một lần nên khối của một bên mất
    // dấu đóng. Đã đo bằng chạy thật trước khi viết bài này.
    git(dir, ['checkout', '-q', 'main']);
    writeFileSync(join(dir, 'data.json'), '{\n  "a": 1,\n  "m": {\n    "k": 1\n  },\n  "z": 0\n}\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'main thêm khối m']);

    git(dir, ['checkout', '-q', 'feature']);
    writeFileSync(join(dir, 'data.json'), '{\n  "a": 1,\n  "f": {\n    "k": 2\n  },\n  "z": 0\n}\n', 'utf8');
    git(dir, ['commit', '-q', '-am', 'feature thêm khối f']);

    const result = resolveAdditiveMerge(dir, 'main');
    assert.equal(result.outcome, 'aborted-ineligible', JSON.stringify(result));
    assert.match(result.reason ?? '', /không nạp được JSON/);
    assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('đuôi file không có cú pháp lồng nhau thì không bị kiểm — `.jsonl` là chỗ union được bật cố ý', () => {
  assert.equal(syntaxKind('ops/logs/integration/step0-x.jsonl'), null);
  assert.equal(syntaxKind('ops/known-failures.md'), null);
  assert.equal(syntaxKind('ops/workflows/ci.yml'), 'yaml');
  assert.equal(syntaxKind('kernel/src/log.ts'), 'script');
  assert.equal(syntaxKind('package.json'), 'json');
  // Một dòng JSONL không phải JSON hợp lệ khi đọc cả file — đúng lý do
  // `.jsonl` phải nằm ngoài phạm vi, không phải một ngoại lệ tiện tay.
  assert.equal(fileSyntaxProblem('a.jsonl', '{"a":1}\n{"a":2}\n'), null);
});

test('YAML: tab trong thụt lề bị chặn, thụt lề lệch mức bị chặn, cây lành đi qua', () => {
  assert.equal(yamlProblem('on:\n  push:\n    branches: [main]\n'), null);
  assert.equal(yamlProblem('jobs:\n  a:\n    steps:\n      - name: x\n        run: y\n'), null);
  assert.match(yamlProblem('jobs:\n\ta:\n') ?? '', /tab/);
  assert.match(yamlProblem('jobs:\n    a: 1\n  b: 2\n') ?? '', /không khớp mức nào đang mở/);
});

test('YAML: khối vô hướng `|` và những cấu trúc ngoài mô hình đều được cho qua', () => {
  // Thân `run: |` thụt lề tuỳ ý, kể cả dedent về mức lẻ — là nội dung, không
  // phải cấu trúc.
  assert.equal(
    yamlProblem('steps:\n  - run: |\n      set -euo pipefail\n   echo lech\n  - run: x\n'),
    null,
  );
  // Nhiều tài liệu, anchor, flow collection mở nhiều dòng: cho qua.
  assert.equal(yamlProblem('a: 1\n---\n    b: 2\n  c: 3\n'), null);
  assert.equal(yamlProblem('a: &anchor\n  b: 1\n'), null);
  assert.equal(yamlProblem('a: [\n      1,\n  2 ]\n'), null);
  // Dấu ngoặc trong nháy không mở flow collection.
  assert.equal(yamlProblem('run: echo "]"\nnext: 1\n'), null);
  // Chú thích ở mức thụt lề tuỳ ý: YAML cho phép.
  assert.equal(yamlProblem('a:\n  b: 1\n      # ghi chú thụt sâu\n  c: 2\n'), null);
});
