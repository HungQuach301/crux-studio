import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GRACE_CUTOFF,
  MODEL_NAME_PATTERN,
  isInScanScope,
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

    // Commit của ca này do `git commit` tạo lúc chạy test, tức LUÔN sau mốc ân
    // hạn (một mốc cố định trong quá khứ) — nên ca này không đổi nghĩa.
    const { offenders, graced } = scanRange(dir, `${base}..HEAD`);
    assert.equal(offenders.length, 1, 'đúng một commit vi phạm');
    assert.equal(offenders[0]!.sha, bad);
    assert.equal(offenders[0]!.line, REAL_BAD_TRAILER);
    assert.equal(graced, 0, 'commit tạo lúc chạy test không được ân hạn');

    // Và range chỉ chứa commit sạch thì không nêu gì.
    assert.deepEqual(scanRange(dir, `${base}..${base}`).offenders, []);
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

// ── Mốc ân hạn (`🤖 [QĐ] #165`, phương án B) ─────────────────────────────

test('KF-014 · mốc ân hạn là hằng số trong QUÁ KHỨ, không phải giờ chạy', () => {
  // Mốc lấy theo giờ chạy sẽ ân xá mọi commit và luật thành vô nghĩa — nhóm Z.
  // Ca này đỏ ngay nếu ai đó đổi `GRACE_CUTOFF` thành `new Date().toISOString()`.
  const cutoff = Date.parse(GRACE_CUTOFF);
  assert.ok(!Number.isNaN(cutoff), 'GRACE_CUTOFF phải đọc được');
  assert.ok(cutoff < Date.now(), 'GRACE_CUTOFF phải nằm ở quá khứ');

  // Và nó phải nằm SAU commit vi phạm muộn nhất đo được (80d65f0 của PR #164,
  // 2026-09-22T21:26:04Z) — nếu không thì 13 PR đang mở vẫn đỏ.
  assert.ok(
    cutoff > Date.parse('2026-09-22T21:26:04Z'),
    'mốc phải sau commit vi phạm muộn nhất đã đo, xem KF-014',
  );
});

test('KF-014 · isInScanScope: trước mốc thì bỏ qua, từ mốc trở đi thì quét', () => {
  assert.equal(isInScanScope('2026-09-22T21:59:59Z'), false);
  assert.equal(isInScanScope('2026-09-22T22:00:00Z'), true, 'đúng giây của mốc thì QUÉT');
  assert.equal(isInScanScope('2026-09-22T22:00:01Z'), true);

  // Mốc mang offset khác UTC vẫn so đúng — `git log --format=%cI` in dạng này.
  assert.equal(isInScanScope('2026-09-23T04:30:00+07:00'), false, '= 21:30Z, trước mốc');
  assert.equal(isInScanScope('2026-09-23T05:30:00+07:00'), true, '= 22:30Z, sau mốc');
});

test('KF-014 · isInScanScope ném lỗi khi mốc không đọc được, không đoán', () => {
  assert.throws(() => isInScanScope('hôm qua'), /Mốc thời gian không đọc được/);
  assert.throws(() => isInScanScope('2026-09-22T22:00:00Z', 'không-phải-mốc'), /Mốc thời gian không đọc được/);
});

test('KF-014 · HAI CHIỀU trên lịch sử git thật: commit CŨ không đỏ, commit MỚI vẫn đỏ', () => {
  // Đây là ca khoá của phương án B ở `🤖 [QĐ] #165`. Một chiều thôi là không
  // đủ: chỉ kiểm "commit cũ xanh" thì một bản vá tắt hẳn phép quét cũng xanh.
  const dir = mkdtempSync(join(tmpdir(), 'kf014-grace-'));
  const cutoff = '2026-09-22T22:00:00Z';
  try {
    const git = (args: string[], at?: string) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        env: at === undefined ? process.env : { ...process.env, GIT_COMMITTER_DATE: at, GIT_AUTHOR_DATE: at },
      });
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);

    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'nền: commit gốc', '-m', GOOD_TRAILER], '2026-09-20T00:00:00Z');
    const base = git(['rev-parse', 'HEAD']).trim();

    // CŨ — vi phạm y hệt, nhưng tạo TRƯỚC mốc: được ân hạn.
    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'cũ: trailer mang tên model', '-m', REAL_BAD_TRAILER], '2026-09-22T21:26:04Z');
    const old = git(['rev-parse', 'HEAD']).trim();

    const beforeOnly = scanRange(dir, `${base}..HEAD`, cutoff);
    assert.deepEqual(beforeOnly.offenders, [], 'commit tạo trước mốc KHÔNG được đỏ');
    assert.equal(beforeOnly.graced, 1);
    assert.equal(beforeOnly.scanned, 0);

    // MỚI — cùng vi phạm, tạo SAU mốc: vẫn phải đỏ.
    writeFileSync(join(dir, 'c.txt'), 'c\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'mới: trailer mang tên model', '-m', REAL_BAD_TRAILER], '2026-09-22T22:00:01Z');
    const fresh = git(['rev-parse', 'HEAD']).trim();

    const both = scanRange(dir, `${base}..HEAD`, cutoff);
    assert.equal(both.offenders.length, 1, 'đúng một commit bị nêu — commit MỚI');
    assert.equal(both.offenders[0]!.sha, fresh);
    assert.notEqual(both.offenders[0]!.sha, old, 'commit cũ không được nêu');
    assert.equal(both.graced, 1);
    assert.equal(both.scanned, 1);

    // Và commit MỚI viết trailer đúng luật thì sạch — ân hạn không nới cho ca sạch.
    writeFileSync(join(dir, 'd.txt'), 'd\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'mới: trailer đúng luật', '-m', GOOD_TRAILER], '2026-09-22T22:00:02Z');
    assert.equal(scanRange(dir, `${base}..HEAD`, cutoff).offenders.length, 1, 'không sinh thêm ca đỏ');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('KF-014 · viết lại một commit cũ làm nó MẤT ân hạn (mốc theo %cI, không phải %aI)', () => {
  // `%aI` giữ nguyên qua amend/rebase, nên chọn `%aI` là để ân hạn theo được vô
  // hạn. Ca này khoá lựa chọn `%cI`: giữ nguyên giờ AUTHOR cũ, chỉ đổi giờ
  // COMMITTER sang sau mốc → commit phải đỏ trở lại.
  const dir = mkdtempSync(join(tmpdir(), 'kf014-amend-'));
  const cutoff = '2026-09-22T22:00:00Z';
  try {
    const git = (args: string[], env: Record<string, string> = {}) =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);

    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'nền', '-m', GOOD_TRAILER], {
      GIT_COMMITTER_DATE: '2026-09-20T00:00:00Z',
      GIT_AUTHOR_DATE: '2026-09-20T00:00:00Z',
    });
    const base = git(['rev-parse', 'HEAD']).trim();

    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git(['add', '.']);
    git(['commit', '-q', '-m', 'cũ: trailer mang tên model', '-m', REAL_BAD_TRAILER], {
      GIT_COMMITTER_DATE: '2026-09-21T10:00:00Z',
      GIT_AUTHOR_DATE: '2026-09-21T10:00:00Z',
    });
    assert.deepEqual(scanRange(dir, `${base}..HEAD`, cutoff).offenders, [], 'ân hạn khi chưa viết lại');

    // Viết lại: giờ author giữ nguyên (2026-09-21), giờ committer nhảy sang sau mốc.
    git(['commit', '-q', '--amend', '--no-edit'], {
      GIT_COMMITTER_DATE: '2026-09-22T23:00:00Z',
    });
    assert.equal(git(['log', '-1', '--format=%aI']).trim().startsWith('2026-09-21'), true, 'giờ author giữ nguyên');

    const after = scanRange(dir, `${base}..HEAD`, cutoff);
    assert.equal(after.offenders.length, 1, 'commit đã viết lại thì MẤT ân hạn và đỏ trở lại');
    assert.equal(after.graced, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
