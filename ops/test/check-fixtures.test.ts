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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureInputProblems, inputFileProblems } from '../scripts/check-fixtures.ts';

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
    upstream: {
      topic: { episodeId: 'ep-0001-stub', channel: SLUG, genre: 'essay', locale: 'en-GB' },
    },
  });
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((p) => /genre/.test(p) && /essay/.test(p)));
  assert.ok(problems.some((p) => /locale/.test(p) && /en-GB/.test(p)));
});

test('fixture khai channel không có trong packs/ thì ĐỎ', () => {
  const problems = problemsFor({ episodeId: 'ep-0001-stub', channel: 'khong-co', upstream: {} });
  assert.equal(problems.length, 1, problems.join('\n'));
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
    upstream: {
      topic: { episodeId: 'ep-0001-stub', channel: SLUG, genre: GENRE, locale: 'en-US' },
    },
  });
  assert.deepEqual(problems, []);
});

test('sáu fixture trong repo này XANH', () => {
  assert.deepEqual(fixtureInputProblems(process.cwd()), []);
});
