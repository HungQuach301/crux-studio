/**
 * D-C06 — vùng bảo vệ hai mức (bất biến I4).
 *
 * Luật này quyết định PR nào chờ người và PR nào máy tự merge được, nên sai
 * về phía nào cũng đắt: sai lỏng thì một thay đổi không đảo ngược được vào
 * `main` mà không ai biết; sai chặt thì chủ dự án lại phải bấm từng nút,
 * đúng thứ D-C06 sinh ra để bỏ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classify,
  sections,
  sectionsForLines,
  touchedLines,
  charterSectionsTouched,
  workflowNeedsOwner,
  type ClassifyInput,
} from '../invariants.protected-area.ts';

const noWorkflow = (): string | null => null;

function verdict(changed: string[], patch: Partial<ClassifyInput> = {}) {
  return classify({ changed, charterSections: null, workflowSource: noWorkflow, ...patch });
}

// ── owner-merge: ba nhóm còn lại ─────────────────────────────────────────

test('`.claude/settings.json` và hook là owner-merge — đó là lớp chặn của agent', () => {
  assert.equal(verdict(['.claude/settings.json']).gate, 'owner-merge');
  assert.equal(verdict(['.claude/hooks/guard.mjs']).gate, 'owner-merge');
});

test('`ops/invariants.*` là owner-merge — một PR không tự nới được lớp chặn của mình', () => {
  assert.equal(verdict(['ops/invariants.protected-area.ts']).gate, 'owner-merge');
  assert.equal(verdict(['ops/invariants.delayed-merge.ts']).gate, 'owner-merge');
});

test('`automerge.yml` và `.github/**` là owner-merge', () => {
  assert.equal(verdict(['ops/workflows/automerge.yml']).gate, 'owner-merge');
  assert.equal(verdict(['.github/workflows/sync-workflows.yml']).gate, 'owner-merge');
});

test('workflow dùng secret là owner-merge', () => {
  const source = 'name: x\njobs:\n  j:\n    steps:\n      - run: echo "${{ secrets.PUBLISH_REPO_TOKEN }}"\n';
  const result = verdict(['ops/workflows/publish.yml'], { workflowSource: () => source });
  assert.equal(result.gate, 'owner-merge');
  assert.match(result.owner.join(' '), /PUBLISH_REPO_TOKEN/);
});

test('workflow phát hành là owner-merge', () => {
  const source = 'name: x\njobs:\n  j:\n    steps:\n      - run: gh release create v1\n';
  const result = verdict(['ops/workflows/release.yml'], { workflowSource: () => source });
  assert.equal(result.gate, 'owner-merge');
  assert.match(result.owner.join(' '), /phát hành/);
});

test('xoá một workflow là owner-merge — không đọc được bản head thì nghiêng về người', () => {
  assert.equal(verdict(['ops/workflows/watchdog.yml'], { workflowSource: noWorkflow }).gate, 'owner-merge');
});

test('KF-003 · đọc release của repo NGƯỜI KHÁC không phải phát hành', () => {
  // ci.yml tải gitleaks từ bản phát hành của chính dự án gitleaks. Nhận nhầm
  // chỗ này sẽ đẩy ci.yml vào owner-merge vĩnh viễn.
  const ci = readFileSync('ops/workflows/ci.yml', 'utf8');
  assert.equal(workflowNeedsOwner(ci), null);
  assert.equal(verdict(['ops/workflows/ci.yml'], { workflowSource: () => ci }).gate, 'automerge-delayed');
});

test('`secrets.GITHUB_TOKEN` không tính là secret — mọi workflow đều có nó', () => {
  const source = 'jobs:\n  j:\n    steps:\n      - run: gh pr list\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n';
  assert.equal(workflowNeedsOwner(source), null);
});

test('bốn workflow còn lại trong repo hôm nay đều KHÔNG cần chủ dự án', () => {
  for (const name of ['ci.yml', 'main-ci.yml', 'notify.yml', 'labels.yml']) {
    const source = readFileSync(`ops/workflows/${name}`, 'utf8');
    assert.equal(workflowNeedsOwner(source), null, name);
  }
});

// ── automerge-delayed: phần vùng bảo vệ cũ còn lại ───────────────────────

test('CLAUDE.md, docs/decisions, docs/spec, kernel/contracts là automerge-delayed', () => {
  for (const path of [
    'CLAUDE.md',
    'docs/decisions/D-C06.md',
    'docs/spec/CRUX-REFERENCE-SPEC.md',
    'kernel/contracts/envelope.schema.json',
  ]) {
    assert.equal(verdict([path]).gate, 'automerge-delayed', path);
  }
});

test('`.claude/**` ngoài settings.json và hooks là automerge-delayed', () => {
  assert.equal(verdict(['.claude/README.md']).gate, 'automerge-delayed');
});

// ── CHARTER: cắt theo mục, không theo file ───────────────────────────────

test('CHARTER mục 1 hoặc 3 là owner-merge', () => {
  assert.equal(verdict(['CHARTER.md'], { charterSections: ['1'] }).gate, 'owner-merge');
  assert.equal(verdict(['CHARTER.md'], { charterSections: ['3'] }).gate, 'owner-merge');
  assert.equal(verdict(['CHARTER.md'], { charterSections: ['2', '3', '12'] }).gate, 'owner-merge');
});

test('CHARTER mục khác là automerge-delayed', () => {
  const result = verdict(['CHARTER.md'], { charterSections: ['2', '12', '14'] });
  assert.equal(result.gate, 'automerge-delayed');
  assert.match(result.delayed.join(' '), /mục 2, 12, 14/);
});

test('không đọc được diff của CHARTER thì nghiêng về người', () => {
  const result = verdict(['CHARTER.md'], { charterSections: null });
  assert.equal(result.gate, 'owner-merge');
  assert.match(result.owner.join(' '), /không đọc được diff/);
});

// ── open: không chạm gì cả ───────────────────────────────────────────────

test('PR thường không rơi vào cửa nào', () => {
  const result = verdict(['kernel/src/index.ts', 'ops/lanes/topic/backlog.md', 'ops/logs/topic.jsonl']);
  assert.equal(result.gate, 'open');
  assert.deepEqual(result.owner, []);
  assert.deepEqual(result.delayed, []);
});

test('`ops/scripts/**` và `ops/test/**` là PR thường — chỉ `ops/invariants.*` mới chặn', () => {
  assert.equal(verdict(['ops/scripts/check-workflows.ts', 'ops/test/guard.test.ts']).gate, 'open');
});

test('một file owner-merge thắng mọi file automerge-delayed trong cùng PR', () => {
  const result = verdict(['CLAUDE.md', '.claude/settings.json']);
  assert.equal(result.gate, 'owner-merge');
  assert.equal(result.delayed.length, 1);
});

// ── Cắt mục CHARTER ──────────────────────────────────────────────────────

const CHARTER = readFileSync('CHARTER.md', 'utf8');

test('cắt được CHARTER thật thành các mục cấp một, có cả phụ lục', () => {
  const ids = sections(CHARTER).map((section) => section.id);
  assert.ok(ids.includes('đầu file'));
  for (const id of ['0', '1', '2', '3', '12', '14', 'PL']) {
    assert.ok(ids.includes(id), `thiếu mục ${id}`);
  }
});

test('các mục không chồng lên nhau và phủ kín file', () => {
  const all = sections(CHARTER);
  all.forEach((section, index) => {
    const next = all[index + 1];
    if (next) assert.equal(section.end + 1, next.start, `mục ${section.id} và ${next.id} hở hoặc chồng nhau`);
  });
  assert.equal(all[0]!.start, 1);
  assert.equal(all[all.length - 1]!.end, CHARTER.split('\n').length);
});

test('mục con 3.1 thuộc về mục 3, không thành mục riêng', () => {
  const heading = CHARTER.split('\n').findIndex((line) => line.startsWith('### 3.1 ')) + 1;
  assert.ok(heading > 0);
  assert.deepEqual(sectionsForLines(CHARTER, [heading]), ['3']);
});

test('đọc đúng số dòng đã chạm từ hunk header', () => {
  const diff = '@@ -10,3 +10,2 @@\n@@ -40 +39 @@\n';
  const lines = touchedLines(diff);
  assert.deepEqual(lines.base, [10, 11, 12, 40]);
  assert.deepEqual(lines.head, [10, 11, 39]);
});

test('thuần thêm (`-a,0`) vẫn neo được vào một dòng của bản cũ', () => {
  const lines = touchedLines('@@ -25,0 +26,4 @@\n');
  assert.deepEqual(lines.base, [25]);
  assert.deepEqual(lines.head, [26, 27, 28, 29]);
});

test('sửa ở hai mục xa nhau thì trả về cả hai, lấy hợp của hai phía', () => {
  const base = ['# t', '', '## 1. A', 'a', '', '## 2. B', 'b', '', '## 3. C', 'c'].join('\n');
  const head = ['# t', '', '## 1. A', 'a2', '', '## 2. B', 'b', '', '## 3. C', 'c2'].join('\n');
  const diff = '@@ -4 +4 @@\n@@ -10 +10 @@\n';
  assert.deepEqual(charterSectionsTouched(base, head, diff), ['1', '3']);
});

test('thêm một mục MỚI ở giữa làm lệch số dòng — vẫn phải bắt đúng cả hai phía', () => {
  // Bản cũ: mục 3 bắt đầu ở dòng 9. Bản mới chèn một khối vào mục 2, đẩy
  // mục 3 xuống. Nếu chỉ soi một phía thì sẽ quy nhầm mục.
  const base = ['# t', '', '## 1. A', 'a', '', '## 2. B', 'b', '', '## 3. C', 'c'].join('\n');
  const head = ['# t', '', '## 1. A', 'a', '', '## 2. B', 'b', 'b2', 'b3', '', '## 3. C', 'c'].join('\n');
  assert.deepEqual(charterSectionsTouched(base, head, '@@ -7,0 +8,2 @@\n'), ['2']);
});
