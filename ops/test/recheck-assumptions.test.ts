/**
 * `ops/scripts/recheck-assumptions.ts` — mục `I-003`.
 *
 * Bài kiểm của G17 chạy git thật trong thư mục tạm, không mô phỏng: cùng lý
 * do đã ghi ở `integrator-resolve.test.ts`, và lý do đó do chính G17 dạy ra.
 * Phần còn lại là hàm thuần, kiểm bằng dữ liệu dựng sẵn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUTO_CHECKS,
  AUTO_CHECK_IDS,
  formatDecisionIssue,
  judgeTrailerEvidence,
  judgeUnionRuns,
  parseLedger,
  runUnionExperiment,
  type CheckReport,
  type CommitTrailerInfo,
} from '../scripts/recheck-assumptions.ts';

const LEDGER_MAU = `# Sổ

## G14 · Trailer

- **Nội dung:** commit mang trailer.
- **Độ tin cậy:** **\`đã kiểm một phần\`**
- **Phần phụ thuộc:** \`ops/workflows/ci.yml\` (job \`trailer-warn\`) · \`CLAUDE.md\` mục 6 · CHARTER 3.1
- **Kiểm tự động:** \`trailer-commit-routine\` — quét lịch sử git.
- **Trạng thái:** giao làn verify.

## G99 · Không kiểm được bằng máy

- **Nội dung:** cần người đọc điều khoản.
- **Độ tin cậy:** \`suy luận\`
- **Phần phụ thuộc:** \`ops/license-ledger.md\`
- **Cách kiểm:** đọc điều khoản.
`;

test('parseLedger đọc được độ tin cậy, phần phụ thuộc và mã bài kiểm', () => {
  const entries = parseLedger(LEDGER_MAU);
  assert.equal(entries.length, 2);

  const g14 = entries[0]!;
  assert.equal(g14.code, 'G14');
  assert.equal(g14.confidence, 'đã kiểm một phần');
  assert.equal(g14.autoCheck, 'trailer-commit-routine');
  // Nguyên văn, kể cả phần chú trong ngoặc — danh sách này đi thẳng vào issue.
  assert.deepEqual(g14.dependencies, [
    '`ops/workflows/ci.yml` (job `trailer-warn`)',
    '`CLAUDE.md` mục 6',
    'CHARTER 3.1',
  ]);
});

test('parseLedger để trống mã bài kiểm khi mục không khai — đó là câu trả lời đúng, không phải ô bỏ trống', () => {
  const g99 = parseLedger(LEDGER_MAU)[1]!;
  assert.equal(g99.code, 'G99');
  assert.equal(g99.autoCheck, undefined);
});

test('formatDecisionIssue có đủ năm phần của CLAUDE.md mục 14 và chép nguyên danh sách phần bị ảnh hưởng', () => {
  const entry = parseLedger(LEDGER_MAU)[0]!;
  const report: CheckReport = {
    code: 'G14',
    checkId: 'trailer-commit-routine',
    verdict: 'sai',
    observed: '2/3 commit thiếu trailer.',
    evidence: ['`abc1234` một commit — thiếu trailer'],
  };

  const { title, body } = formatDecisionIssue(entry, report);

  assert.match(title, /^🤖 \[QĐ\] /, 'tiêu đề issue phải bắt đầu bằng 🤖 (CLAUDE.md mục 5)');
  assert.match(body, /^🤖 /, 'thân issue phải bắt đầu bằng 🤖');
  for (const part of ['## Bối cảnh', '## Phương án', '## Khuyến nghị', '## Nếu anh chưa trả lời', '## Cách trả lời']) {
    assert.ok(body.includes(part), `thiếu phần ${part}`);
  }
  for (const dep of entry.dependencies) {
    assert.ok(body.includes(`- ${dep}`), `thiếu phần bị ảnh hưởng: ${dep}`);
  }
  assert.ok(body.includes('`đã kiểm một phần`'), 'phải nói sổ đang ghi độ tin cậy nào');
  assert.ok(body.includes(report.evidence[0]!), 'phải chép bằng chứng vào issue');
});

const COMMIT_CO_TRAILER: CommitTrailerInfo = {
  sha: 'aaaaaaa',
  subject: 'mục A',
  byAgent: true,
  hasSessionTrailer: true,
};

test('G14 khớp khi mọi commit do agent soạn đều mang trailer', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'bbbbbbb', subject: 'mục B', byAgent: true, hasSessionTrailer: true },
  ]);
  assert.equal(outcome.verdict, 'khớp');
});

test('G14 sai khi một commit do agent soạn thiếu trailer, và nêu đích danh commit đó', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'ccccccc', subject: 'mục C', byAgent: true, hasSessionTrailer: false },
  ]);
  assert.equal(outcome.verdict, 'sai');
  assert.ok(outcome.evidence.some((line) => line.includes('ccccccc')), 'phải nêu sha của commit thiếu trailer');
  assert.ok(!outcome.evidence.some((line) => line.includes('aaaaaaa')), 'không kể tên commit không có vấn đề');
});

test('G14 KHÔNG tính commit do công cụ tạo — message của chúng không đi qua agent', () => {
  const outcome = judgeTrailerEvidence([
    COMMIT_CO_TRAILER,
    { sha: 'ddddddd', subject: 'Gộp origin/main (integrator)', byAgent: false, hasSessionTrailer: false },
  ]);
  assert.equal(outcome.verdict, 'khớp', 'merge commit của integrator không được làm G14 thành sai');
  assert.ok(
    outcome.evidence.some((line) => line.includes('công cụ')),
    'nhưng vẫn phải báo ra thành ghi chú, không im lặng bỏ qua',
  );
});

test('G14 không kết luận gì khi chưa có commit nào để quan sát', () => {
  const outcome = judgeTrailerEvidence([]);
  assert.equal(outcome.verdict, 'khớp');
  assert.match(outcome.observed, /chưa quan sát được gì/);
});

test('G17 khớp khi luật tới cùng lần gộp thì xung đột, còn nhánh mang sẵn luật thì sạch', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'xung đột', ruleAlreadyOnBranch: 'sạch' });
  assert.equal(outcome.verdict, 'khớp');
});

test('G17 sai khi git bắt đầu áp luật cho chính lần gộp mang nó tới', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'sạch', ruleAlreadyOnBranch: 'sạch' });
  assert.equal(outcome.verdict, 'sai');
  assert.ok(outcome.evidence.some((line) => line.includes('Lần 1')));
});

test('G17 sai khi union hết cứu được cả lần nhánh đã mang sẵn luật', () => {
  const outcome = judgeUnionRuns({ ruleArrivesWithMerge: 'xung đột', ruleAlreadyOnBranch: 'xung đột' });
  assert.equal(outcome.verdict, 'sai');
  assert.match(outcome.observed, /union KHÔNG còn cứu được/);
});

test('thí nghiệm G17 chạy git thật: đổi đúng một điều kiện thì kết quả gộp đổi theo', () => {
  const runs = runUnionExperiment();
  assert.equal(
    runs.ruleArrivesWithMerge,
    'xung đột',
    'luật merge do main mang tới không áp cho chính lần gộp mang nó tới (bài học G17)',
  );
  assert.equal(runs.ruleAlreadyOnBranch, 'sạch', 'nhánh đã mang sẵn luật thì union giữ cả hai dòng');
});

test('mỗi bài kiểm có mã riêng, không trùng', () => {
  assert.equal(new Set(AUTO_CHECK_IDS).size, AUTO_CHECK_IDS.length);
  for (const check of AUTO_CHECKS) {
    assert.match(check.code, /^G\d+$/);
    assert.ok(check.what.length > 0, `${check.id} phải nói nó quan sát cái gì`);
  }
});

test('mọi mã bài kiểm mà sổ thật đang khai đều có bài kiểm thật', () => {
  const ledger = readFileSync(join(process.cwd(), 'docs', 'assumptions.md'), 'utf8');
  const declared = parseLedger(ledger)
    .map((entry) => entry.autoCheck)
    .filter((id): id is string => id !== undefined);

  assert.ok(declared.length > 0, 'sổ phải khai ít nhất một bài kiểm tự động, nếu không mục I-003 vô nghĩa');
  for (const id of declared) {
    assert.ok(AUTO_CHECK_IDS.includes(id), `sổ khai \`${id}\` nhưng không có bài kiểm nào tên thế`);
  }
});
