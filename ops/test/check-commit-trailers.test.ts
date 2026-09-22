import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MODEL_NAME_PATTERN,
  modelNameInTrailers,
  scanRange,
  trailerLines,
} from '../scripts/check-commit-trailers.ts';

/**
 * Ca sai THẬT, cả hai lần, dán nguyên văn — đây là chữ ký của `KF-014` và là
 * lý do file này tồn tại. Lần hai (`Opus 5`) đã vào `main` ở commit `024c29d`.
 */
const REAL_BAD_TRAILER = 'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>';
const REAL_BAD_TRAILER_FIRST = 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>';
const GOOD_TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>';
const SESSION = 'Claude-Session: https://claude.ai/code/session_01TEST';

test('KF-014 · ca sai thật: tên model trong Co-Authored-By thì bắt được', () => {
  for (const bad of [REAL_BAD_TRAILER, REAL_BAD_TRAILER_FIRST]) {
    const body = `topic: một thay đổi nào đó\n\nThân commit.\n\n${bad}\n${SESSION}\n`;
    assert.equal(modelNameInTrailers(body), bad, `phải bắt được: ${bad}`);
  }
});

test('KF-014 · trailer đúng luật thì sạch', () => {
  const body = `integration: sửa gì đó\n\nThân commit nhiều dòng.\n\n${GOOD_TRAILER}\n${SESSION}\n`;
  assert.equal(modelNameInTrailers(body), null);
});

test('KF-014 · văn xuôi ở THÂN commit nhắc tên model thì KHÔNG đỏ', () => {
  // Đây là ca phải xanh để bản vá của chính KF-014 viết được: commit thêm mục
  // KF-014 vào ops/known-failures.md buộc phải trích dòng sai làm chữ ký.
  const body = [
    'ops: thêm KF-014 — tên model lọt vào khối trailer',
    '',
    `Chữ ký: \`${REAL_BAD_TRAILER}\`. Lần đầu là \`Sonnet 5\`, lần hai \`Opus 5\`.`,
    '',
    GOOD_TRAILER,
    SESSION,
    '',
  ].join('\n');
  assert.equal(modelNameInTrailers(body), null, 'văn xuôi ở thân không được tính là trailer');
});

test('KF-014 · commit không có dòng trailer nào thì danh sách rỗng', () => {
  assert.deepEqual(trailerLines('chỉ một dòng tiêu đề\n'), []);
  assert.deepEqual(trailerLines('tiêu đề\n\nmột đoạn văn xuôi kết thúc commit.\n'), []);
});

test('KF-014 · văn xuôi tiếng Việt dạng `Khoá: giá trị` KHÔNG bị coi là trailer', () => {
  // Danh sách khoá đóng chính là để ca này xanh: `Còn treo:` không phải trailer.
  const body = `tiêu đề\n\nCòn treo: chưa đo được gì, xem Opus 5 ở dòng dưới.\n\n${GOOD_TRAILER}\n`;
  assert.deepEqual(trailerLines(body), [GOOD_TRAILER]);
  assert.equal(modelNameInTrailers(body), null);
});

test('KF-014 · HỒI QUY ca 024c29d: dòng sai ở đoạn GIỮA vẫn phải bắt được', () => {
  // Đây là ca mà bản đầu của phép quét (chỉ đọc đoạn cuối) ĐỂ LỌT. Hình dạng
  // dán theo đúng commit squash thật: GitHub nối thêm một Co-authored-by của
  // chính nó ở đoạn cuối, cách dòng sai bởi một dòng `---------`.
  const body = [
    'topic: T-007 — gộp main để gỡ CI đỏ (#133)',
    '',
    'Thân commit nhiều đoạn.',
    '',
    REAL_BAD_TRAILER,
    SESSION,
    '',
    '---------',
    '',
    'Co-authored-by: Claude <noreply@anthropic.com>',
    '',
  ].join('\n');
  assert.equal(
    modelNameInTrailers(body),
    REAL_BAD_TRAILER,
    'dòng sai nằm ở đoạn giữa — phép quét không được lọc theo vị trí',
  );
});

test('KF-014 · dòng nối tiếp thụt lề vẫn thuộc trailer', () => {
  const body = `tiêu đề\n\nthân\n\nCo-Authored-By: Claude\n    Opus 5 <noreply@anthropic.com>\n${SESSION}\n`;
  assert.equal(
    modelNameInTrailers(body),
    '    Opus 5 <noreply@anthropic.com>',
    'tên model ở dòng nối tiếp cũng phải bắt được',
  );
});

test('KF-014 · mẫu tên model khớp theo TỪ, không khớp một phần từ dài hơn', () => {
  assert.ok(MODEL_NAME_PATTERN.test('Claude Opus 5'));
  assert.ok(MODEL_NAME_PATTERN.test('claude-sonnet-5'));
  assert.ok(MODEL_NAME_PATTERN.test('HAIKU'));
  assert.ok(!MODEL_NAME_PATTERN.test('opuscule'), 'không được bắt nhầm từ dài hơn');
  assert.ok(!MODEL_NAME_PATTERN.test('Claude <noreply@anthropic.com>'));
});

test('KF-014 · scanRange đọc lịch sử git thật: chỉ commit vi phạm bị nêu', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kf014-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');

    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git('add', '.');
    git('commit', '-q', '-m', 'nền: commit gốc', '-m', GOOD_TRAILER);
    const base = git('rev-parse', 'HEAD').trim();

    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git('add', '.');
    git('commit', '-q', '-m', 'sạch: trailer đúng luật', '-m', GOOD_TRAILER);

    writeFileSync(join(dir, 'c.txt'), 'c\n');
    git('add', '.');
    git('commit', '-q', '-m', 'bẩn: trailer mang tên model', '-m', REAL_BAD_TRAILER);
    const bad = git('rev-parse', 'HEAD').trim();

    const offenders = scanRange(dir, `${base}..HEAD`);
    assert.equal(offenders.length, 1, 'đúng một commit vi phạm');
    assert.equal(offenders[0]!.sha, bad);
    assert.equal(offenders[0]!.line, REAL_BAD_TRAILER);

    // Và range chỉ chứa commit sạch thì không nêu gì.
    assert.deepEqual(scanRange(dir, `${base}..${base}`), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('KF-014 · scanRange ném lỗi rõ khi range không hợp lệ, không trả rỗng im lặng', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kf014-bad-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    assert.throws(() => scanRange(dir, 'khong-ton-tai..HEAD'), /git rev-list/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
