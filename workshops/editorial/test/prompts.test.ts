import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cassette, fixedClock, readInputFile, runWorkshop, validateArtifact } from '@crux/kernel';
import { definition, generationOf } from '../src/index.ts';
import { formatPromptVersion, loadPromptVersions, parsePromptVersion } from '../src/prompts.ts';

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

// ── `generation.promptVersion` trong artifact (vế còn lại của tiêu chí xong E-001) ──

const root = fileURLToPath(new URL('../../../', import.meta.url));
// Danh sách xưởng cần nạp suy từ `definition.consumes`, không khai tay trong
// fixture — khai tay là bản chép thứ hai của `consumes` (mục integration/I-011).
const { episode, input: fixture } = readInputFile(
  root,
  fileURLToPath(new URL('../fixtures/input.json', import.meta.url)),
  definition.consumes,
);

function ctx(cassette: Cassette, impl: 'stub' | 'v1' = 'stub') {
  return { ...episode, clock: fixedClock('2026-09-20T00:00:00.000Z'), cassette, impl };
}

test('formatPromptVersion sắp theo id, không theo thứ tự khai trong PROMPT_FILES', () => {
  assert.equal(
    formatPromptVersion({
      researcher: 'v1',
      factChecker: 'v2',
      outliner: 'v1',
      scriptwriter: 'v3',
    }),
    'fact-checker@v2+outliner@v1+researcher@v1+scriptwriter@v3',
  );
});

test('lượt chạy CÓ gọi mô hình thì generation.promptVersion là phiên bản của prompt pack thật', async () => {
  const cassette = new Cassette('record');
  await cassette.call('openai', 'chat', { a: 1 }, async () => ({ response: 'x', costUsd: 0.25 }));
  const generation = generationOf(ctx(cassette, 'v1'), 0, 0);

  assert.equal(generation?.promptVersion, 'fact-checker@v1+outliner@v1+researcher@v1+scriptwriter@v1');
  assert.equal(generation?.promptVersion, formatPromptVersion(loadPromptVersions()));
  assert.equal(generation?.costUsd, 0.25);
});

test('gác bằng SỐ LỜI GỌI chứ không bằng cờ impl — impl v1 mà không gọi gì thì vẫn không có generation', () => {
  const cassette = new Cassette('replay');
  assert.equal(generationOf(ctx(cassette, 'v1'), 0, 0), undefined);
  assert.equal(generationOf(ctx(cassette, 'stub'), 0, 0), undefined);
});

test('một lời gọi lấy lại từ băng VẪN tính là có gọi — costUsd 0 không có nghĩa là không gọi', async () => {
  const entry = {
    key: Cassette.keyOf('openai', 'chat', { a: 1 }),
    provider: 'openai',
    operation: 'chat',
    requestHash: 'x',
    response: 'x',
    costUsd: 0,
  };
  const cassette = new Cassette('replay', [entry]);
  await cassette.call('openai', 'chat', { a: 1 }, async () => {
    throw new Error('không được gọi thật ở chế độ replay');
  });
  const generation = generationOf(ctx(cassette, 'stub'), 0, 0);
  assert.equal(generation?.promptVersion, formatPromptVersion(loadPromptVersions()));
  assert.equal(generation?.costUsd, 0);
});

test('xưởng ở Đợt 0 không gọi mô hình nào, nên artifact KHÔNG mang generation — tập vàng nhờ đó không đổi', async () => {
  for (const impl of ['stub', 'v1'] as const) {
    const artifact = await runWorkshop(definition, fixture, ctx(new Cassette('replay'), impl));
    assert.equal(artifact.payload.generation, undefined, `impl ${impl} không được khai generation`);
    assert.equal(validateArtifact('editorial', artifact).valid, true);
  }
});

test('contract chặn generation thiếu promptVersion', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx(new Cassette('replay')));
  const bad = { ...artifact, payload: { ...artifact.payload, generation: { costUsd: 0 } } };
  assert.equal(validateArtifact('editorial', bad).valid, false);
});

test('contract nhận generation đầy đủ', async () => {
  const artifact = await runWorkshop(definition, fixture, ctx(new Cassette('replay')));
  const good = {
    ...artifact,
    payload: {
      ...artifact.payload,
      generation: { promptVersion: formatPromptVersion(loadPromptVersions()), costUsd: 0.25 },
    },
  };
  assert.equal(validateArtifact('editorial', good).valid, true);
});
