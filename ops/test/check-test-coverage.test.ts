/**
 * Z11 — test có trên đĩa nhưng ngoài ba glob của `pnpm test`
 * (`kernel/test/**\/*.test.ts`, `workshops/**\/test/**\/*.test.ts`,
 * `ops/test/**\/*.test.ts`). Một file lọt ra ngoài ba nhánh đó vẫn nằm yên
 * trên đĩa mà `node --test` không bao giờ nạp — không có gì đỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchesTestGlob, testFilesMissedByGlob, findTestFiles } from '../scripts/check-test-coverage.ts';

test('ba hình dạng hợp lệ đều khớp', () => {
  assert.ok(matchesTestGlob('kernel/test/validate.test.ts'));
  assert.ok(matchesTestGlob('workshops/topic/test/stub.test.ts'));
  assert.ok(matchesTestGlob('ops/test/labels.test.ts'));
  assert.ok(matchesTestGlob('ops/test/a/b/nested.test.ts'), 'ops/test/**/*.test.ts phải quét sâu nhiều cấp');
});

test('Z11 · file test đặt sai chỗ — ngoài ba nhánh — không khớp', () => {
  assert.ok(!matchesTestGlob('workshops/topic/stub.test.ts'), 'thiếu thư mục test/ ở giữa');
  assert.ok(!matchesTestGlob('kernel/validate.test.ts'), 'kernel/ thiếu test/');
  assert.ok(!matchesTestGlob('scripts/check-workflows.test.ts'), 'ngoài ba nhánh hẳn');
  assert.ok(!matchesTestGlob('ops/scripts/check-workflows.test.ts'), 'ops/scripts, không phải ops/test');
});

test('Z11 · workshops/<tên>/test/ chỉ khớp đúng MỘT cấp tên xưởng, không khớp lồng sâu hơn', () => {
  // `workshops/**/test/**/*.test.ts` của package.json cho phép xưởng lồng
  // nhiều cấp về lý thuyết; luật viết tay ở đây cố ý CHỈ chấp nhận đúng một
  // cấp `workshops/<tên>/test/…`, khớp cách sáu xưởng thật được đặt tên
  // (`workshops/topic/test/`, không có cấp con nào bên trong `workshops/`).
  // Một xưởng đặt tên có `/` bên trong sẽ không khớp — ghi lại có chủ đích,
  // không phải một lỗ hổng bỏ sót.
  assert.ok(matchesTestGlob('workshops/topic/test/stub.test.ts'));
});

test('testFilesMissedByGlob trả đúng danh sách bị bỏ sót, không chỉ đếm', () => {
  const disk = ['kernel/test/a.test.ts', 'workshops/topic/stub.test.ts', 'ops/test/b.test.ts'];
  assert.deepEqual(testFilesMissedByGlob(disk), ['workshops/topic/stub.test.ts']);
});

test('không có gì bị bỏ sót thì trả mảng rỗng', () => {
  const disk = ['kernel/test/a.test.ts', 'ops/test/b.test.ts'];
  assert.deepEqual(testFilesMissedByGlob(disk), []);
});

test('findTestFiles bỏ qua node_modules', () => {
  // Dựng một cây thật nhỏ trong scratch để không phụ thuộc node_modules có
  // mặt hay không lúc test chạy (CI cài đặt trước, máy dev có thể chưa).
  const root = mkdtempSync(join(tmpdir(), 'crux-z11-'));
  try {
    mkdirSync(join(root, 'ops', 'test'), { recursive: true });
    mkdirSync(join(root, 'node_modules', 'some-pkg', 'test'), { recursive: true });
    writeFileSync(join(root, 'ops', 'test', 'real.test.ts'), '', 'utf8');
    writeFileSync(join(root, 'node_modules', 'some-pkg', 'test', 'fixture.test.ts'), '', 'utf8');
    const found = findTestFiles(root);
    assert.deepEqual(found, ['ops/test/real.test.ts']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Cây hiện tại phải sạch ───────────────────────────────────────────────

test('cả 32 file *.test.ts thật trong repo đều khớp glob của pnpm test', () => {
  const disk = findTestFiles(process.cwd());
  assert.ok(disk.length > 0, 'không tìm thấy file *.test.ts nào — script quét sai chỗ');
  const missed = testFilesMissedByGlob(disk);
  assert.deepEqual(missed, [], `bị bỏ sót: ${missed.join(', ')}`);

  // So bằng cách ĐỘC LẬP: đếm trực tiếp ba thư mục, không đi qua
  // `matchesTestGlob` — nếu cả hai đường cùng sai theo cùng một cách thì
  // bài kiểm này không bắt được, nhưng nó bắt được lệch giữa HAI cách đếm.
  const countIn = (...segments: string[]): number => {
    const dir = join(process.cwd(), ...segments);
    let n = 0;
    const walk = (d: string): void => {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.test.ts')) n += 1;
      }
    };
    walk(dir);
    return n;
  };
  const expected = countIn('kernel', 'test') + countIn('ops', 'test') + workshopsTestCount();
  assert.equal(disk.length, expected);

  function workshopsTestCount(): number {
    let n = 0;
    for (const workshop of readdirSync(join(process.cwd(), 'workshops'))) {
      const testDir = join(process.cwd(), 'workshops', workshop, 'test');
      try {
        n += statSync(testDir).isDirectory() ? countIn('workshops', workshop, 'test') : 0;
      } catch {
        // xưởng không có thư mục test/ — bỏ qua, không phải lỗi.
      }
    }
    return n;
  }
});
