/**
 * DoD Đợt 0: "Một vi phạm I3 cố ý bị CI chặn."
 *
 * Test này TẠO một vi phạm thật trong cây làm việc, chạy đúng cái linter mà
 * CI chạy, và đòi nó đỏ. Đọc tài liệu không tính; phải chạy thật.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const linter = join(root, 'ops', 'scripts', 'lint-deps.ts');

function runLinter() {
  return spawnSync(process.execPath, [linter], { cwd: root, encoding: 'utf8' });
}

test('cây hiện tại không vi phạm I3', () => {
  const result = runLinter();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /I3 ok/);
});

test('một vi phạm I3 cố ý bị chặn', () => {
  const dir = join(root, 'workshops', 'visual', 'src', '__i3_probe__');
  const file = join(dir, 'violation.ts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    file,
    "import { definition } from '@crux/workshop-audio';\nexport const probe = definition;\n",
    'utf8',
  );
  try {
    const result = runLinter();
    assert.equal(result.status, 1, 'linter phải đỏ khi xưởng visual import xưởng audio');
    assert.match(result.stderr, /xưởng visual import xưởng audio/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('import kernel qua đường dẫn tương đối cũng bị chặn', () => {
  const dir = join(root, 'workshops', 'topic', 'src', '__i3_probe__');
  const file = join(dir, 'violation.ts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, "export * from '../../../../kernel/src/index.ts';\n", 'utf8');
  try {
    const result = runLinter();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dùng @crux\/kernel/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
