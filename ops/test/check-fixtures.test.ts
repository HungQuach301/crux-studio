/**
 * `ops/scripts/check-fixtures.ts` — cơ chế của mục `integration/I-008`.
 *
 * Test âm là phần quan trọng nhất: mục này tồn tại vì một bản sao pack nằm
 * im trong fixture mà **không gì đỏ**. Một kiểm không đỏ đúng lúc phải đỏ
 * thì không thay được gì cho tình trạng cũ, nên bài kiểm đầu tiên dưới đây
 * tái hiện đúng bản sao đã lệch thật: channel pack bản Đợt 0 với
 * `pillars: ["thresholds","tradeoffs","timing"]`, chép nguyên từ
 * `workshops/topic/fixtures/input.json` trước PR này.
 *
 * Phần dương cũng không thừa: một kiểm đỏ nhầm sẽ ép fixture phải chép lại
 * đúng cái nó vừa bỏ đi.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKSHOPS, type Envelope } from '@crux/kernel';
import { fixtureInputProblems, inputFileProblems } from '../scripts/check-fixtures.ts';

/** Gốc repo, không phải cwd: `node --test` chạy được từ thư mục nào cũng đúng. */
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Một artifact đầu vào THẬT, lấy từ tập vàng. Không dựng bằng object rút gọn:
 * `readInputFile` validate artifact đầu vào theo contract, nên một object rút
 * gọn sẽ đỏ vì thiếu trường chứ vì lý do bài kiểm muốn đo.
 */
function goldenArtifact(workshop: string): Envelope {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, 'ops', 'golden', 'ep-0001-stub', 'snapshots', `${workshop}.json`), 'utf8'),
  ) as Envelope;
}

const SLUG = 'us-personal-finance';
const GENRE = 'data-explainer';

/** Bản sao channel pack Đợt 0 — đúng nội dung đã lệch thật. */
const STALE_CHANNEL_COPY = {
  slug: SLUG,
  genre: GENRE,
  locale: 'en-US',
  geoScope: 'United States, federal tax filers',
  pillars: ['thresholds', 'tradeoffs', 'timing'],
  publish: { visibility: 'private' },
};

/**
 * Dựng một gốc repo tối thiểu: hai pack thật và một fixture. Không mô phỏng
 * việc đọc pack bằng stub — `readInputFile` đọc file thật, nên test cũng
 * phải đưa cho nó file thật.
 */
function makeRoot(fixture: unknown | undefined): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'crux-fixtures-'));
  mkdirSync(join(root, 'packs', 'channels', SLUG), { recursive: true });
  mkdirSync(join(root, 'packs', 'genres', GENRE), { recursive: true });
  writeFileSync(
    join(root, 'packs', 'channels', SLUG, 'channel.json'),
    JSON.stringify({
      slug: SLUG,
      genre: GENRE,
      locale: 'en-US',
      pillars: ['housing', 'debt', 'investing', 'career-income', 'retirement'],
    }),
  );
  writeFileSync(
    join(root, 'packs', 'genres', GENRE, 'format-spec.json'),
    JSON.stringify({ genre: GENRE, limits: { targetDurationMs: 1_260_000 } }),
  );

  const path = join(root, 'input.json');
  if (fixture !== undefined) writeFileSync(path, JSON.stringify(fixture));
  return { root, path };
}

function problemsFor(fixture: unknown): string[] {
  const { root, path } = makeRoot(fixture);
  try {
    return inputFileProblems(root, path, 'Fixture thử');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ── Test âm ──────────────────────────────────────────────────────────────

test('I-008 · fixture nhúng lại bản sao channel pack thì ĐỎ', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    upstream: {},
    packs: { channel: STALE_CHANNEL_COPY },
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /packs/);
  assert.match(problems[0]!, /I-008/);
});

test('I-008 · bản sao nằm ở khoá `packs.genre` cũng ĐỎ — luật là không chép, không phải chép ít', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    upstream: {},
    packs: { genre: { genre: GENRE, limits: {} } },
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /packs/);
});

test('làm lệch MỘT trường — locale khai khác channel pack — thì ĐỎ', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    genre: GENRE,
    locale: 'en-GB',
    upstream: {},
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /locale/);
  assert.match(problems[0]!, /en-GB/);
});

test('làm lệch MỘT trường — genre khai khác channel pack — thì ĐỎ', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    genre: 'essay',
    upstream: {},
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /genre/);
});

test('artifact đầu vào khai bối cảnh lệch pack thì ĐỎ — bản sao trong phong bì cũng là bản sao', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    upstream: { topic: { ...goldenArtifact('topic'), genre: 'essay', locale: 'en-GB' } },
  });
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((p) => /genre/.test(p) && /essay/.test(p)));
  assert.ok(problems.some((p) => /locale/.test(p) && /en-GB/.test(p)));
});

test('artifact đầu vào KHÔNG hợp contract thì ĐỎ — trước PR này không ai validate nó', () => {
  const artifact = goldenArtifact('topic') as unknown as Record<string, unknown>;
  delete artifact['inputsHash'];
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    upstream: { topic: artifact },
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /không hợp contract/);
});

test('tên xưởng viết sai trong `upstream` thì ĐỎ, không phải upstream rỗng lúc chạy', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    upstream: { editoral: goldenArtifact('editorial') },
  });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /editoral/);
});

test('bản sao đặt tên KHÁC `packs` cũng ĐỎ — luật khoá là danh sách cho phép', () => {
  for (const extra of [
    { channelPack: { slug: SLUG, pillars: ['thresholds'] } },
    { limits: { targetDurationMs: 1 } },
    { context: { packs: { channel: STALE_CHANNEL_COPY } } },
  ]) {
    const problems = problemsFor({
      episodeId: 'ep-0001-stub',
      channel: SLUG,
      upstream: {},
      ...extra,
    });
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0]!, /khoá lạ/);
  }
});

test('`upstream: null` thì ĐỎ — `?? {}` sẽ nuốt nó thành "không có đầu vào"', () => {
  const problems = problemsFor({ episodeId: 'ep-0001-stub', channel: SLUG, upstream: null });
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, /upstream/);
});

test('fixture khai channel không có trong packs/ thì ĐỎ', () => {
  const problems = problemsFor({ episodeId: 'ep-0001-stub', channel: 'khong-co', upstream: {} });
  assert.equal(problems.length, 1, problems.join('\n'));
});

test('fixture THỨ HAI trong cùng thư mục cũng bị quét — không có file nào lọt', () => {
  const { root } = makeRoot(undefined);
  try {
    const clean = {
      episodeId: 'ep-0001-stub',
      channel: SLUG,
      genre: GENRE,
      locale: 'en-US',
      upstream: {},
    };
    for (const workshop of WORKSHOPS) {
      const dir = join(root, 'workshops', workshop, 'fixtures');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'input.json'), JSON.stringify(clean));
    }
    assert.deepEqual(fixtureInputProblems(root), []);

    // Một file `--input` thứ hai, mang bản sao pack. Kiểm chỉ nhìn
    // `input.json` sẽ XANH ở đây, và đó đúng là nhóm Z.
    writeFileSync(
      join(root, 'workshops', 'topic', 'fixtures', 'input-second.json'),
      JSON.stringify({ ...clean, packs: { channel: STALE_CHANNEL_COPY } }),
    );
    const problems = fixtureInputProblems(root);
    assert.equal(problems.length, 1, problems.join('\n'));
    assert.match(problems[0]!, /input-second\.json/);

    // `*.artifact.json` không phải file `--input`: check-contracts.ts
    // validate chúng theo contract, nên kiểm này phải bỏ qua.
    writeFileSync(
      join(root, 'workshops', 'topic', 'fixtures', 'brief.artifact.json'),
      JSON.stringify({ khong: 'phai input' }),
    );
    assert.equal(fixtureInputProblems(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('xưởng thiếu fixtures/input.json thì ĐỎ, không phải bỏ qua im lặng (nhóm Z)', () => {
  const { root } = makeRoot(undefined);
  try {
    const problems = fixtureInputProblems(root);
    assert.equal(problems.length, 6, problems.join('\n'));
    for (const problem of problems) assert.match(problem, /input\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Test dương ───────────────────────────────────────────────────────────

test('fixture chỉ khai bối cảnh và artifact đầu vào thì XANH', () => {
  const problems = problemsFor({
    episodeId: 'ep-0001-stub',
    channel: SLUG,
    genre: GENRE,
    locale: 'en-US',
    upstream: { topic: goldenArtifact('topic') },
  });
  assert.deepEqual(problems, []);
});

test('sáu fixture trong repo này XANH', () => {
  assert.deepEqual(fixtureInputProblems(REPO_ROOT), []);
});
