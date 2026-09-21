import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPromptVersions, parsePromptVersion } from '../src/prompts.ts';

test('loadPromptVersions đọc đúng bốn nghề từ prompt thật của xưởng', () => {
  const versions = loadPromptVersions();
  assert.deepEqual(versions, {
    researcher: 'v1',
    factChecker: 'v1',
    outliner: 'v1',
    scriptwriter: 'v1',
  });
});

test('parsePromptVersion đọc dòng tiêu đề "# <Tên nghề> · v<N>" dù có ghi chú $note đứng trước', () => {
  const content = '<!-- $note: chép từ spec -->\n\n# Researcher · v1\n\n## Nhiệm vụ\n...';
  assert.equal(parsePromptVersion('researcher.md', content), 'v1');
});

test('parsePromptVersion đọc đúng số phiên bản nhiều chữ số', () => {
  assert.equal(parsePromptVersion('x.md', '# X · v12'), 'v12');
});

test('parsePromptVersion NÉM lỗi rõ ràng khi prompt không khai phiên bản — không im lặng trả rỗng', () => {
  assert.throws(
    () => parsePromptVersion('outliner.md', '# Outliner\n\n## Nhiệm vụ\n...'),
    /outliner\.md.*phiên bản/,
  );
});

test('loadPromptVersions NÉM lỗi khi một prompt trong thư mục thiếu phiên bản — không bỏ qua lặng lẽ', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-prompts-'));
  try {
    writeFileSync(join(dir, 'researcher.md'), '# Researcher · v1\n');
    writeFileSync(join(dir, 'fact-checker.md'), '# Fact & Risk Checker · v1\n');
    writeFileSync(join(dir, 'outliner.md'), '# Outliner (chưa có phiên bản)\n');
    writeFileSync(join(dir, 'scriptwriter.md'), '# Scriptwriter · v1\n');
    assert.throws(() => loadPromptVersions(dir), /outliner\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mỗi prompt thật kết thúc bằng mục Tự kiểm, và không chứa hằng số nội dung của genre/channel pack', () => {
  const dir = new URL('../prompts/', import.meta.url);
  for (const file of ['researcher.md', 'fact-checker.md', 'outliner.md', 'scriptwriter.md']) {
    const content = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(content.includes('## Tự kiểm'), `${file} thiếu mục Tự kiểm`);
    assert.doesNotMatch(content, /data-explainer|us-personal-finance/, `${file} không được chứa hằng số nội dung`);
  }
});
