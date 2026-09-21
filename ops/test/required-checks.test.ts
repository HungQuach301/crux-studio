/**
 * Khoá năm status check của ruleset `protect-main` (mục `VF-G12`, giả định **G12**).
 *
 * Bài kiểm này canh đúng một lối hỏng, và lối đó đã được dựng lại bằng chạy
 * thật trước khi viết: đổi tên một job trong `ops/workflows/ci.yml` thì
 * `pnpm check` vẫn xanh, CI của chính PR đó vẫn xanh, PR merge đẹp — rồi
 * ruleset đứng chờ một tên check không còn ai sinh ra, và **mọi** PR sau đó
 * kẹt ở `blocked`. Nhóm Z, và là ca nhóm Z khoá được cả nhà máy.
 *
 * Ba ca âm dưới đây (đổi tên, xoá, gộp) đều đã đo là **đỏ** khi phá, và xanh
 * trở lại khi khôi phục.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_CHECKS,
  ciJobNames,
  missingRequiredChecks,
  readCiWorkflow,
} from '../scripts/required-checks.ts';

test('ci.yml sinh ra đủ năm check mà ruleset protect-main đòi', () => {
  const missing = missingRequiredChecks(readCiWorkflow());
  assert.deepEqual(
    missing,
    [],
    `ci.yml không còn sinh ra: ${missing.join(', ')}. ` +
      'Ruleset sẽ chờ mãi một tên check không tồn tại và mọi PR kẹt ở "blocked". ' +
      'Đổi tên một check là quyết định irreversible (CHARTER 2.3 nhóm 8): ' +
      'mở 🤖 [QĐ] để chủ dự án cập nhật ruleset TRƯỚC.',
  );
});

test('danh sách REQUIRED_CHECKS không có tên trùng và không rỗng', () => {
  assert.equal(REQUIRED_CHECKS.length, 5, 'ruleset protect-main bật đúng 5 check');
  assert.equal(new Set(REQUIRED_CHECKS).size, REQUIRED_CHECKS.length);
});

test('ciJobNames lấy tên check theo đúng luật của GitHub', () => {
  const source = [
    'name: ci',
    'on:',
    '  pull_request:',
    'jobs:',
    '  alpha:',
    '    name: check',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: một step, KHÔNG phải tên check',
    '        run: echo hi',
    '  beta:',
    '    runs-on: ubuntu-latest',
    '',
  ].join('\n');

  // `alpha` khai `name:` nên tên check là `check`; `beta` không khai nên tên
  // check là chính khoá job. Tên của step không bao giờ là tên check.
  assert.deepEqual(ciJobNames(source), ['check', 'beta']);
});

test('ciJobNames dừng đúng ở cuối khối jobs', () => {
  const source = ['jobs:', '  alpha:', '    name: check', 'permissions:', '  contents: read', ''].join('\n');
  assert.deepEqual(ciJobNames(source), ['check']);
});

// Ba ca âm dưới đây so **chênh lệch** so với bản `ci.yml` thật, chứ không so
// danh sách tuyệt đối: nếu so tuyệt đối thì một hỏng hóc bất kỳ ở nơi khác
// cũng làm cả ba đỏ, và lời báo lỗi chỉ tới đúng một chỗ.
function newlyMissing(broken: string): string[] {
  const before = new Set(missingRequiredChecks(readCiWorkflow()));
  return missingRequiredChecks(broken).filter((check) => !before.has(check));
}

test('ca âm: đổi tên một job thì bài kiểm đỏ', () => {
  const broken = readCiWorkflow().replace(/^ {4}name: secret-scan$/m, '    name: secrets');
  assert.notEqual(broken, readCiWorkflow(), 'phép phá phải thật sự đổi nội dung');
  assert.deepEqual(newlyMissing(broken), ['secret-scan']);
});

test('ca âm: xoá hẳn một job thì bài kiểm đỏ', () => {
  const source = readCiWorkflow();
  const start = source.indexOf('\n  trailer-warn:');
  assert.ok(start > 0, 'job trailer-warn phải còn trong ci.yml');
  assert.deepEqual(newlyMissing(source.slice(0, start)), ['trailer-warn']);
});

test('ca âm: gộp hai job thành một thì bài kiểm đỏ ở cả hai tên', () => {
  // Gộp = giữ một job, và tên của nó không còn khớp tên nào trong ruleset.
  const broken = readCiWorkflow()
    .replace(/^ {4}name: check$/m, '    name: check-and-scan')
    .replace(/^ {4}name: secret-scan$/m, '    name: check-and-scan');
  assert.deepEqual(newlyMissing(broken).sort(), ['check', 'secret-scan']);
});
