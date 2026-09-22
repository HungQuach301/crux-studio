/**
 * `ops/scripts/check-workshop-contracts.ts` — cơ chế của mục
 * `integration/I-013`.
 *
 * Bài kiểm quan trọng nhất là bài **âm**, và nó phải đi hết đường: mục này
 * tồn tại vì một contract xưởng dùng từ khoá validator chưa hiểu nằm im mà
 * **không gì đỏ**. Một phép quét đúng nhưng không được nối vào
 * `pnpm contracts` thì vẫn là không gì đỏ, nên có một bài chạy thật
 * `ops/scripts/check-contracts.ts` trên một gốc tạm và đọc mã thoát.
 *
 * Ba bài còn lại ghim ba hố mà chính phép quét thư mục mở ra: tên file
 * không khớp hậu tố, thư mục con, và quét trúng rỗng. Cả ba đều là "vẫn là
 * Z, chỉ lùi một bước".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_NON_SCHEMA,
  SCHEMA_SUFFIX,
  workshopContractFiles,
  workshopContractProblems,
} from '../scripts/check-workshop-contracts.ts';

/** Gốc repo, không phải cwd: `node --test` chạy được từ thư mục nào cũng đúng. */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Đúng hình dạng contract mà `T-008` viết, chỉ khác một từ khoá. */
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

/** Dựng một gốc tạm với các file cho trước dưới `workshops/<tên>/contracts/`. */
function makeRoot(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'crux-wcontracts-'));
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
    return workshopContractProblems(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('contract xưởng dùng từ khoá validator chưa hiểu thì ĐỎ', () => {
  const problems = problemsFor({ 'workshops/topic/contracts/novel.v0.schema.json': BAD_SCHEMA });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /novel\.v0\.schema\.json/);
  assert.match(problems[0]!, /oneOf/);
});

test('contract xưởng sạch thì KHÔNG đỏ — kiểm đỏ nhầm cũng vô dụng như kiểm không đỏ', () => {
  assert.deepEqual(problemsFor({ 'workshops/topic/contracts/ok.v0.schema.json': GOOD_SCHEMA }), []);
});

test('hố 1 · file trong contracts/ không theo hậu tố thì bị bắt, README.md thì không', () => {
  const withStray = problemsFor({
    'workshops/topic/contracts/ok.v0.schema.json': GOOD_SCHEMA,
    // Đúng cách Z quay lại: file là contract thật, chỉ đặt tên khác đi.
    'workshops/topic/contracts/corpus.v1.json': BAD_SCHEMA,
  });
  assert.equal(withStray.length, 1, withStray.join('\n'));
  assert.match(withStray[0]!, /corpus\.v1\.json/);
  assert.match(withStray[0]!, new RegExp(SCHEMA_SUFFIX.replace(/\./g, '\\.')));

  assert.ok(ALLOWED_NON_SCHEMA.has('README.md'));
  assert.deepEqual(
    problemsFor({
      'workshops/topic/contracts/ok.v0.schema.json': GOOD_SCHEMA,
      'workshops/topic/contracts/README.md': '# ghi chú',
    }),
    [],
  );
});

test('hố 2 · thư mục con vẫn bị quét', () => {
  const root = makeRoot({ 'workshops/topic/contracts/v1/novel.v1.schema.json': BAD_SCHEMA });
  try {
    assert.deepEqual(
      workshopContractFiles(root).map((f) => f.label),
      [join('workshops', 'topic', 'contracts', 'v1', 'novel.v1.schema.json')],
    );
    const problems = workshopContractProblems(root);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0]!, /oneOf/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hố 3 · contracts/ có mặt mà không nhặt được schema nào là VẤN ĐỀ, không phải "sạch"', () => {
  const problems = problemsFor({ 'workshops/topic/contracts/README.md': '# chỉ có ghi chú' });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /trúng rỗng/);
});

test('xưởng không có thư mục contracts/ thì không phải vấn đề', () => {
  assert.deepEqual(problemsFor({ 'workshops/topic/fixtures/input.json': {} }), []);
});

test('JSON hỏng được báo ra, không ném', () => {
  const problems = problemsFor({ 'workshops/topic/contracts/broken.v0.schema.json': '{ "type": ' });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /không đọc được JSON/);
});

test('repo thật sạch, và ba contract của `T-008` nằm TRONG tầm quét', () => {
  assert.deepEqual(workshopContractProblems(REPO_ROOT), []);
  const labels = workshopContractFiles(REPO_ROOT).map((f) => f.label);
  for (const name of ['corpus.v0.schema.json', 'demand-signal.v0.schema.json', 'novelty-check.v0.schema.json']) {
    assert.ok(
      labels.includes(join('workshops', 'topic', 'contracts', name)),
      `${name} phải nằm trong tầm quét — ${labels.join(', ')}`,
    );
  }
});

test('nối thật vào `pnpm contracts`: script thoát KHÁC 0 và nói đúng tên file', () => {
  // Phép quét đúng mà không ai gọi thì vẫn là "không gì đỏ". Bài này chạy
  // chính `ops/scripts/check-contracts.ts` với `cwd` là gốc tạm — nó sẽ
  // than phiền nhiều thứ khác (gốc tạm không có fixture nào), nên bài kiểm
  // đọc ĐÚNG dòng của mình, và bài đối chứng bên dưới đòi dòng đó biến mất.
  const script = join(REPO_ROOT, 'ops', 'scripts', 'check-contracts.ts');

  const bad = makeRoot({ 'workshops/topic/contracts/novel.v0.schema.json': BAD_SCHEMA });
  const good = makeRoot({ 'workshops/topic/contracts/ok.v0.schema.json': GOOD_SCHEMA });
  try {
    const red = spawnSync(process.execPath, [script], { cwd: bad, encoding: 'utf8' });
    assert.notEqual(red.status, 0);
    assert.match(red.stderr, /novel\.v0\.schema\.json: dùng từ khoá validator chưa hỗ trợ: oneOf/);

    const control = spawnSync(process.execPath, [script], { cwd: good, encoding: 'utf8' });
    assert.doesNotMatch(control.stderr, /dùng từ khoá validator chưa hỗ trợ/);
  } finally {
    rmSync(bad, { recursive: true, force: true });
    rmSync(good, { recursive: true, force: true });
  }
});
