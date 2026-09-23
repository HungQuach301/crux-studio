import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HOTFIX_LABEL,
  SCOPE_MARKER,
  classifyHotfix,
  parseScope,
  type HotfixInput,
} from '../invariants.hotfix-lane.ts';
import { renderScopeBlock } from '../scripts/main-red-scope.ts';

/**
 * Bài tái hiện của `D-C07` (bất biến I2). Chữ ký lỗi được tái hiện ở bài đầu
 * tiên: một PR sửa đúng file mà cảnh báo nêu, CI xanh, mà vẫn phải chờ 12 giờ
 * vì `ops/workflows/**` nằm trong vùng bảo vệ — đó là `KF-020`.
 */

const SCOPE_FILES = ['ops/workflows/spike-canvas.yml'];

const base: HotfixInput = {
  labels: [HOTFIX_LABEL, 'automerge-delayed'],
  changed: SCOPE_FILES,
  scope: { sha: '00f2f84', files: SCOPE_FILES },
  mainCiRed: true,
  otherHotfixPrs: [],
  number: 200,
};

test('KF-020 tái hiện · PR sửa tối thiểu đúng file cảnh báo nêu đi được lối nhanh', () => {
  const decision = classifyHotfix(base);
  assert.equal(decision.lane, 'hotfix');
  assert.match(decision.reason, /D-C07/);
});

test('điều kiện 6 · không có nhãn `hotfix` thì đi cửa thường, dù mọi thứ khác khớp', () => {
  const decision = classifyHotfix({ ...base, labels: ['automerge-delayed'] });
  assert.equal(decision.lane, 'normal');
});

test('điều kiện 1 · `main-ci` không đỏ thì không có lối nhanh', () => {
  assert.equal(classifyHotfix({ ...base, mainCiRed: false }).lane, 'normal');
});

test('điều kiện 1 · không có cảnh báo đang mở (phạm vi `null`) thì không có lối nhanh', () => {
  assert.equal(classifyHotfix({ ...base, scope: null }).lane, 'normal');
});

test('điều kiện 2 · chạm thêm một file ngoài phạm vi cảnh báo là mất lối nhanh', () => {
  const decision = classifyHotfix({
    ...base,
    changed: [...SCOPE_FILES, 'ops/workflows/ci.yml'],
  });
  assert.equal(decision.lane, 'normal');
  assert.match(decision.reason, /ops\/workflows\/ci\.yml/);
});

test('điều kiện 2 · phạm vi KHÔNG nới theo thư mục — cùng thư mục vẫn là ngoài phạm vi', () => {
  const decision = classifyHotfix({
    ...base,
    changed: ['ops/workflows/watchdog.yml'],
  });
  assert.equal(decision.lane, 'normal');
});

test('điều kiện 3 · hai ca phân biệt được: sửa tối thiểu đi lối nhanh, lùi luật thì mở [QĐ]', () => {
  // Ca (a) — sửa đúng chỗ hỏng.
  assert.equal(classifyHotfix(base).lane, 'hotfix');

  // Ca (b) — cùng sự cố, nhưng bản sửa chạm chính cổng đang bắt lỗi. Kể cả
  // khi cảnh báo có nêu tên file đó, lối nhanh vẫn KHÔNG mở.
  const loosen = classifyHotfix({
    ...base,
    changed: ['ops/scripts/check-workflows.ts'],
    scope: { sha: '00f2f84', files: ['ops/scripts/check-workflows.ts'] },
  });
  assert.equal(loosen.lane, 'needs-decision');
  assert.match(loosen.reason, /QĐ/);
});

test('điều kiện 3 · tầng luật gồm cả `ops/invariants.*` và hook của agent', () => {
  for (const path of ['ops/invariants.merge-gate.ts', '.claude/hooks/guard.mjs', '.claude/settings.json']) {
    const decision = classifyHotfix({
      ...base,
      changed: [path],
      scope: { sha: '00f2f84', files: [path] },
    });
    assert.equal(decision.lane, 'needs-decision', path);
  }
});

test('điều kiện 5 · `automerge.yml` và `.github/**` bị loại trừ hẳn, không phụ thuộc phạm vi', () => {
  for (const path of ['ops/workflows/automerge.yml', '.github/workflows/sync-workflows.yml']) {
    const decision = classifyHotfix({
      ...base,
      changed: [path],
      scope: { sha: '00f2f84', files: [path] },
      // Ngay cả khi điều kiện 1 KHÔNG đạt, hai đường này vẫn phải ra
      // `needs-decision` chứ không im lặng rơi về `normal`: loại trừ của
      // điều kiện 5 là loại trừ hẳn.
      mainCiRed: false,
    });
    assert.equal(decision.lane, 'needs-decision', path);
    assert.match(decision.reason, /điều kiện 5/);
  }
});

test('điều kiện 6 · tối đa một PR mỗi sự cố, PR số nhỏ nhất đi trước', () => {
  const later = classifyHotfix({ ...base, number: 210, otherHotfixPrs: [200] });
  assert.equal(later.lane, 'normal');
  assert.match(later.reason, /#200/);

  const earliest = classifyHotfix({ ...base, number: 200, otherHotfixPrs: [210] });
  assert.equal(earliest.lane, 'hotfix');
});

test('`parseScope` đọc đúng khối mà `main-red-scope.ts` sinh ra — hai bên khớp mốc', () => {
  const body = ['🤖 `main` đang đỏ.', '', renderScopeBlock(SCOPE_MARKER, 'abc1234', SCOPE_FILES), ''].join('\n');
  const scope = parseScope(body);
  assert.deepEqual(scope, { sha: 'abc1234', files: SCOPE_FILES });
});

test('`parseScope` hướng an toàn là `null`: thiếu mốc, JSON hỏng, hay `files` rỗng', () => {
  assert.equal(parseScope('🤖 `main` đang đỏ, không có khối nào.'), null);
  assert.equal(parseScope(`<!-- ${SCOPE_MARKER} -->\n\`\`\`json\n{không phải json}\n\`\`\``), null);
  assert.equal(parseScope(renderScopeBlock(SCOPE_MARKER, 'abc1234', [])), null);
  assert.equal(parseScope(`<!-- ${SCOPE_MARKER} -->\n\`\`\`json\n{"sha":"a"}\n\`\`\``), null);
  assert.equal(parseScope(`<!-- ${SCOPE_MARKER} -->\n\`\`\`json\n{"files":[1,2]}\n\`\`\``), null);
});

test('`parseScope` bỏ qua khối json KHÁC nằm TRƯỚC mốc', () => {
  const body = ['```json', '{"files":["một/file/lạ.ts"]}', '```', '', renderScopeBlock(SCOPE_MARKER, 'abc1234', SCOPE_FILES)].join('\n');
  assert.deepEqual(parseScope(body)?.files, SCOPE_FILES);
});

test('khối phạm vi MỚI NHẤT thắng — một sự cố kéo dài đổi tập cổng đỏ', () => {
  const body = [
    renderScopeBlock(SCOPE_MARKER, 'cũ0000', ['ops/workflows/ci.yml']),
    '',
    '🤖 `main` vẫn đỏ, lần kiểm sau:',
    '',
    renderScopeBlock(SCOPE_MARKER, 'abc1234', SCOPE_FILES),
  ].join('\n');
  assert.deepEqual(parseScope(body)?.files, SCOPE_FILES);

  // Và hệ quả ở cửa: sửa file của khối CŨ không còn đi lối nhanh được.
  const stale = classifyHotfix({ ...base, changed: ['ops/workflows/ci.yml'], scope: parseScope(body) });
  assert.equal(stale.lane, 'normal');
});
