/**
 * `readInputFile` — phần `upstreamFrom` của mục `integration/I-009`.
 *
 * Mục này tồn tại vì khối `upstream` của fixture là bản **chép** snapshot tập
 * vàng, và bản chép đó trôi mà vẫn hợp contract nên không gì đỏ (hàng `Z16`
 * của `ops/known-failures.md`). Cách chặn là bỏ bản chép: fixture trỏ tới tập
 * vàng, artifact tới từ `ops/golden/<tập>/snapshots/` lúc chạy.
 *
 * Bài kiểm nặng nhất ở đây là bài đầu tiên: đổi snapshot thì artifact xưởng
 * nhận được đổi theo. Nếu nó không đổi thì đâu đó vẫn còn một bản chép, và cả
 * mục này chỉ là đổi tên khoá.
 *
 * Phần còn lại đều là **test âm**, và chúng đo đúng một thứ: mọi cách khai
 * sai đều NÉM, không cách nào trả về `upstream` rỗng rồi chạy tiếp. "Nạp được
 * 0 artifact" trông giống hệt "xưởng này không tiêu thụ gì" lúc chạy — đó là
 * cách nhóm Z sống, nên nó phải là lỗi to tiếng.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInputFile, goldenSnapshotPath, type Envelope } from '../src/index.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SLUG = 'us-personal-finance';
const GENRE = 'data-explainer';
const GOLDEN = 'ep-0001-stub';

/** Artifact THẬT từ tập vàng: `readInputFile` validate theo contract, nên object rút gọn sẽ đỏ vì lý do khác. */
function goldenArtifact(workshop: string): Envelope {
  return JSON.parse(readFileSync(goldenSnapshotPath(REPO_ROOT, GOLDEN, workshop), 'utf8')) as Envelope;
}

/** Gốc repo tối thiểu: hai pack thật, một tập vàng thật, và một file `--input`. */
function makeRoot(file: unknown, snapshots: readonly string[] = ['topic']): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'crux-input-'));
  mkdirSync(join(root, 'packs', 'channels', SLUG), { recursive: true });
  mkdirSync(join(root, 'packs', 'genres', GENRE), { recursive: true });
  writeFileSync(
    join(root, 'packs', 'channels', SLUG, 'channel.json'),
    JSON.stringify({ slug: SLUG, genre: GENRE, locale: 'en-US', pillars: ['housing'] }),
  );
  writeFileSync(
    join(root, 'packs', 'genres', GENRE, 'format-spec.json'),
    JSON.stringify({ genre: GENRE, limits: { targetDurationMs: 1_260_000 } }),
  );
  mkdirSync(join(root, 'ops', 'golden', GOLDEN, 'snapshots'), { recursive: true });
  for (const workshop of snapshots) {
    writeFileSync(goldenSnapshotPath(root, GOLDEN, workshop), JSON.stringify(goldenArtifact(workshop)));
  }
  const path = join(root, 'input.json');
  writeFileSync(path, JSON.stringify(file));
  return { root, path };
}

function withRoot<T>(file: unknown, fn: (root: string, path: string) => T, snapshots?: readonly string[]): T {
  const { root, path } = makeRoot(file, snapshots);
  try {
    return fn(root, path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const base = { episodeId: GOLDEN, channel: SLUG };
const pointer = { ...base, upstreamFrom: { golden: GOLDEN, workshops: ['topic'] } };

// ── Bài kiểm chính: đọc thật, không chép ─────────────────────────────────

test('I-009 · `upstreamFrom` nạp artifact TỪ snapshot — đổi snapshot thì đầu vào đổi theo', () => {
  withRoot(pointer, (root, path) => {
    const before = readInputFile(root, path).input.upstream['topic'];
    assert.deepEqual(before, goldenArtifact('topic'));

    // Đổi MỘT trường của snapshot, không đụng file --input.
    const drifted = goldenArtifact('topic');
    (drifted.payload as { selected: { question: string } }).selected.question = 'Câu hỏi mới của tập vàng.';
    writeFileSync(goldenSnapshotPath(root, GOLDEN, 'topic'), JSON.stringify(drifted));

    const after = readInputFile(root, path).input.upstream['topic'];
    assert.equal(
      (after?.payload as { selected: { question: string } }).selected.question,
      'Câu hỏi mới của tập vàng.',
    );
  });
});

test('I-009 · fixture đi theo snapshot, nên PR cập nhật snapshot không phải sửa fixture (CHARTER 6.1)', () => {
  withRoot(pointer, (root, path) => {
    const fileBefore = readFileSync(path, 'utf8');
    const drifted = goldenArtifact('topic');
    (drifted.payload as { selected: { question: string } }).selected.question = 'Một câu hỏi khác hẳn câu trong bản chép cũ.';
    writeFileSync(goldenSnapshotPath(root, GOLDEN, 'topic'), JSON.stringify(drifted));

    assert.deepEqual(readInputFile(root, path).input.upstream['topic'], drifted);
    assert.equal(readFileSync(path, 'utf8'), fileBefore, 'file --input không được đổi một byte nào');
  });
});

// ── Test âm: mọi cách khai sai đều NÉM, không cái nào rỗng-mà-xanh ───────

test('I-009 · khai cả `upstream` lẫn `upstreamFrom` thì NÉM — không có luật ngầm bên nào thắng', () => {
  withRoot({ ...pointer, upstream: { topic: goldenArtifact('topic') } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /upstreamFrom/);
  });
});

test('I-009 · `upstreamFrom.workshops` rỗng thì NÉM, không phải "không có đầu vào"', () => {
  withRoot({ ...base, upstreamFrom: { golden: GOLDEN, workshops: [] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /không rỗng/);
  });
});

test('I-009 · thiếu `upstreamFrom.golden` thì NÉM', () => {
  withRoot({ ...base, upstreamFrom: { workshops: ['topic'] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /golden/);
  });
});

test('I-009 · tên xưởng viết sai trong `upstreamFrom.workshops` thì NÉM', () => {
  withRoot({ ...base, upstreamFrom: { golden: GOLDEN, workshops: ['editoral'] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /editoral/);
  });
});

test('I-009 · trỏ tới xưởng mà tập vàng không có snapshot thì NÉM, không bỏ qua im lặng', () => {
  withRoot({ ...base, upstreamFrom: { golden: GOLDEN, workshops: ['topic', 'visual'] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /snapshot không có/);
  });
});

test('I-009 · trỏ tới tập vàng không tồn tại thì NÉM', () => {
  withRoot({ ...base, upstreamFrom: { golden: 'ep-khong-co', workshops: ['topic'] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /snapshot không có/);
  });
});

test('I-009 · khai một xưởng hai lần thì NÉM — `inputsHash` không được phụ thuộc chuyện đó', () => {
  withRoot({ ...base, upstreamFrom: { golden: GOLDEN, workshops: ['topic', 'topic'] } }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /hai lần/);
  });
});

test('I-009 · `upstreamFrom` không phải object thì NÉM', () => {
  withRoot({ ...base, upstreamFrom: 'ep-0001-stub' }, (root, path) => {
    assert.throws(() => readInputFile(root, path), /upstreamFrom/);
  });
});

test('I-009 · snapshot trong tập vàng không hợp contract thì NÉM — nạp từ nguồn không miễn validate', () => {
  withRoot(pointer, (root, path) => {
    const broken = goldenArtifact('topic') as unknown as Record<string, unknown>;
    delete broken['inputsHash'];
    writeFileSync(goldenSnapshotPath(root, GOLDEN, 'topic'), JSON.stringify(broken));
    assert.throws(() => readInputFile(root, path), /không hợp contract/);
  });
});

// ── Test dương: chế độ `upstream` khai thẳng vẫn còn (CHARTER 5.4) ───────

test('I-009 · `upstream` khai thẳng vẫn chạy — chạy độc lập với artifact viết tay là chế độ hợp lệ', () => {
  withRoot({ ...base, upstream: { topic: goldenArtifact('topic') } }, (root, path) => {
    assert.deepEqual(readInputFile(root, path).input.upstream['topic'], goldenArtifact('topic'));
  });
});

test('I-009 · sáu fixture trong repo này nạp được, và khớp ĐÚNG snapshot tập vàng', () => {
  for (const [workshop, consumes] of [
    ['topic', []],
    ['editorial', ['topic']],
    ['visual', ['editorial']],
    ['audio', ['editorial']],
    ['assembly', ['editorial', 'visual', 'audio']],
    ['release', ['topic', 'editorial', 'assembly']],
  ] as const) {
    const { input } = readInputFile(REPO_ROOT, `workshops/${workshop}/fixtures/input.json`);
    assert.deepEqual(Object.keys(input.upstream).sort(), [...consumes].sort(), `xưởng ${workshop}`);
    for (const name of consumes) {
      assert.deepEqual(input.upstream[name], goldenArtifact(name), `${workshop} ← ${name}`);
    }
  }
});
