/**
 * `ops/scripts/check-schema-scope.ts` — cơ chế của mục `integration/I-014`.
 *
 * Bài quan trọng nhất là bài **âm đi hết đường**: một `*.schema.json` dùng
 * từ khoá validator chưa hiểu, đặt **ngoài** `contracts/`, phải làm
 * `pnpm contracts` đỏ. Mục này tồn tại vì trước nó phạm vi quét dừng ở quy
 * ước thư mục, nên một schema đổi chỗ là thoát mà không gì đỏ.
 *
 * Các bài còn lại ghim: schema dưới `packs/` cũng bị kiểm; schema đã nằm
 * trong `workshops/<tên>/contracts/` KHÔNG bị kiểm hai lần ở đây; symlink
 * trá hình; và các gốc thiếu thư mục là hợp lệ, không phải tập rỗng che lỗi.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_SUFFIX,
  SCOPE_ROOTS,
  scanSchemaScope,
  schemaScopeFiles,
  schemaScopeProblems,
} from '../scripts/check-schema-scope.ts';

/** Gốc repo, không phải cwd: `node --test` chạy được từ thư mục nào cũng đúng. */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const GOOD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
};

/** `oneOf` nằm ngoài `SUPPORTED_KEYWORDS` — validator của kernel bỏ qua nó. */
const BAD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } },
};

function makeRoot(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-schema-scope-'));
  for (const [relPath, content] of Object.entries(files)) {
    const path = join(root, relPath);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}

function problemsFor(files: Record<string, unknown>): string[] {
  const root = makeRoot(files);
  try {
    return schemaScopeProblems(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('hậu tố và hai cây quét là hằng khai công khai', () => {
  assert.equal(SCHEMA_SUFFIX, '.schema.json');
  assert.deepEqual([...SCOPE_ROOTS], ['workshops', 'packs']);
});

test('schema từ khoá lạ NGOÀI contracts/ dưới workshops/ thì ĐỎ', () => {
  const problems = problemsFor({ 'workshops/topic/src/inline.schema.json': BAD_SCHEMA });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /workshops\/topic\/src\/inline\.schema\.json/);
  assert.match(problems[0]!, /oneOf/);
});

test('schema từ khoá lạ dưới packs/ thì ĐỎ — packs không có phép quét contracts/ riêng', () => {
  const problems = problemsFor({
    'packs/genres/data-explainer/layout.schema.json': BAD_SCHEMA,
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /packs\/genres\/data-explainer\/layout\.schema\.json/);
  assert.match(problems[0]!, /oneOf/);
});

test('schema sạch ngoài contracts/ thì KHÔNG đỏ — kiểm đỏ nhầm cũng vô dụng', () => {
  assert.deepEqual(problemsFor({ 'workshops/topic/src/inline.schema.json': GOOD_SCHEMA }), []);
});

test('quét đệ quy: schema chôn sâu trong src/ vẫn bị kiểm', () => {
  const problems = problemsFor({ 'workshops/visual/src/deep/nested/x.schema.json': BAD_SCHEMA });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /deep\/nested\/x\.schema\.json/);
});

test('schema TRONG workshops/<tên>/contracts/ KHÔNG bị việc số 7 kiểm hai lần', () => {
  // Việc số 6 đã lo thư mục này. Việc số 7 phải bỏ qua để không nhân đôi
  // dòng vấn đề và số đếm.
  const root = makeRoot({
    'workshops/topic/contracts/ok.v0.schema.json': GOOD_SCHEMA,
    'workshops/topic/contracts/bad.v0.schema.json': BAD_SCHEMA,
  });
  try {
    const scan = scanSchemaScope(root);
    assert.deepEqual(scan.files, [], `không file nào thuộc việc số 7: ${scan.files.join(', ')}`);
    assert.deepEqual(scan.problems, [], scan.problems.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('symlink trong workshops/<tên>/contracts/ KHÔNG bị việc số 7 báo (việc số 6 độc quyền cây đó)', () => {
  // Regression: trước khi cắt cây ở ranh giới thư mục, `walk` đệ quy vào
  // contracts/ và phát dòng vấn đề symlink NGAY tại đó, nên một symlink trá
  // hình bị BÁO HAI LẦN (việc 6 và việc 7). Việc 7 phải im lặng cho cây này.
  const root = makeRoot({ 'thật.json': BAD_SCHEMA });
  try {
    mkdirSync(join(root, 'workshops/topic/contracts'), { recursive: true });
    symlinkSync(join(root, 'thật.json'), join(root, 'workshops/topic/contracts/link.v0.schema.json'));
    const scan = scanSchemaScope(root);
    assert.deepEqual(scan.files, [], scan.files.join(', '));
    assert.deepEqual(scan.problems, [], scan.problems.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('nối thật vào `pnpm contracts`: script thoát KHÁC 0 và nói đúng tên file', () => {
  // Phép quét đúng mà không ai gọi thì vẫn là "không gì đỏ". Bài này chạy
  // chính `ops/scripts/check-contracts.ts` với `cwd` là gốc tạm. Nó than
  // phiền nhiều thứ khác (gốc tạm không có payload), nên bài đọc ĐÚNG dòng
  // của mình, và bài đối chứng đòi dòng đó biến mất.
  const script = join(REPO_ROOT, 'ops', 'scripts', 'check-contracts.ts');

  const bad = makeRoot({ 'workshops/topic/src/inline.schema.json': BAD_SCHEMA });
  const good = makeRoot({ 'workshops/topic/src/inline.schema.json': GOOD_SCHEMA });
  try {
    const red = spawnSync(process.execPath, [script], { cwd: bad, encoding: 'utf8' });
    assert.notEqual(red.status, 0);
    assert.match(
      red.stderr,
      /workshops\/topic\/src\/inline\.schema\.json: dùng từ khoá validator chưa hỗ trợ: oneOf/,
    );

    const control = spawnSync(process.execPath, [script], { cwd: good, encoding: 'utf8' });
    assert.doesNotMatch(
      control.stderr,
      /workshops\/topic\/src\/inline\.schema\.json: dùng từ khoá validator chưa hỗ trợ/,
    );
  } finally {
    rmSync(bad, { recursive: true, force: true });
    rmSync(good, { recursive: true, force: true });
  }
});

test('symlink tên *.schema.json ngoài contracts/ thành dòng vấn đề, KHÔNG lọc im lặng và KHÔNG ném', () => {
  for (const [label, target] of [
    ['gãy', 'không-có-thật.json'],
    ['trỏ tới file thật', 'thật.json'],
  ] as const) {
    const root = makeRoot({ 'thật.json': BAD_SCHEMA });
    try {
      mkdirSync(join(root, 'packs/genres/data-explainer'), { recursive: true });
      symlinkSync(
        join(root, target),
        join(root, 'packs/genres/data-explainer/layout.schema.json'),
      );
      const problems = schemaScopeProblems(root);
      assert.equal(problems.length, 1, `${label}: ${problems.join('\n')}`);
      assert.match(problems[0]!, /layout\.schema\.json/);
      assert.match(problems[0]!, /không phải file thường/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('gốc thiếu cả workshops/ lẫn packs/ là hợp lệ — tập rỗng, không vấn đề', () => {
  const root = mkdtempSync(join(tmpdir(), 'crux-schema-scope-'));
  try {
    const scan = scanSchemaScope(root);
    assert.deepEqual(scan.files, []);
    assert.deepEqual(scan.problems, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('JSON hỏng và schema không phải object đều thành dòng vấn đề, không ném', () => {
  assert.match(
    problemsFor({ 'packs/genres/data-explainer/broken.schema.json': '{ khong-phai-json' })[0]!,
    /không đọc được JSON/,
  );
  assert.match(
    problemsFor({ 'packs/genres/data-explainer/arr.schema.json': [1, 2, 3] })[0]!,
    /phải là một object JSON/,
  );
});

test('một lượt quét trả cả danh sách file lẫn vấn đề — hai hàm công khai đọc từ đó ra', () => {
  const root = makeRoot({
    'workshops/topic/src/a.schema.json': GOOD_SCHEMA,
    'packs/genres/data-explainer/b.schema.json': BAD_SCHEMA,
  });
  try {
    const scan = scanSchemaScope(root);
    assert.deepEqual(scan.files, schemaScopeFiles(root));
    assert.deepEqual(scan.problems, schemaScopeProblems(root));
    // Cả hai file đều được nhặt lên (một sạch, một bẩn), một dòng vấn đề.
    assert.equal(scan.files.length, 2, scan.files.join(', '));
    assert.equal(scan.problems.length, 1, scan.problems.join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
