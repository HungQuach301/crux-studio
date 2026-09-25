import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DECISION_LABEL,
  assertEvidence,
  closeComment,
  decideDecisionClose,
  isOwnerDoneComment,
  linkedPrNumbers,
  planDecisionCloses,
  type DecisionComment,
  type DecisionIssue,
} from '../scripts/decision-close.ts';

const OWNER = 'HungQuach301';

/** Một `[QĐ]` trống: mọi bài kiểm dưới đây chỉ đổi đúng phần nó đang đo. */
const issue = (over: Partial<DecisionIssue> = {}): DecisionIssue => ({
  number: 999,
  title: '🤖 [QĐ] một quyết định nào đó',
  body: '🤖 Bối cảnh … Phương án A/B … Khuyến nghị …',
  labels: [DECISION_LABEL, 'reversible'],
  comments: [],
  linkedPrs: [],
  hasDecisionDoc: false,
  ...over,
});

const comment = (body: string, author = OWNER): DecisionComment => ({
  author,
  body,
  createdAt: '2026-09-24T16:35:36Z',
});

// ─── Mặc định là GIỮ ────────────────────────────────────────────────────────

test('không bằng chứng nào → keep; mặc định KHÔNG bao giờ là close', () => {
  const decision = decideDecisionClose(issue(), OWNER);
  assert.equal(decision.verdict, 'keep');
  assert.deepEqual(decision.evidence, []);
});

test('issue không mang nhãn `decision` → keep, kể cả khi PR của nó đã merge', () => {
  const decision = decideDecisionClose(
    issue({ labels: ['fix'], linkedPrs: [{ number: 233, merged: true, closed: true }] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
  assert.match(decision.reason, /nhãn/);
});

test('`irreversible` chưa có câu trả lời → keep: đó là chỗ thật sự chờ người', () => {
  const decision = decideDecisionClose(
    issue({ labels: [DECISION_LABEL, 'irreversible'], comments: [comment('🤖 nhắc lại lần hai')] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
});

// ─── Nguồn 1 · chủ dự án nói xong ───────────────────────────────────────────

test('ca thật #88: "C: xác nhận, không hoàn tác. Đóng issue." → close', () => {
  const decision = decideDecisionClose(
    issue({ number: 88, comments: [comment('C: xác nhận, không hoàn tác. Đóng issue.')] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'close');
  assert.equal(decision.evidence.length, 1);
  assert.match(decision.evidence[0]!, /Đóng issue/);
});

test('ca thật #169 và #175: "Đã thực hiện qua #168" → close', () => {
  for (const number of [169, 175]) {
    const decision = decideDecisionClose(
      issue({ number, comments: [comment('Đã thực hiện qua #168')] }),
      OWNER,
    );
    assert.equal(decision.verdict, 'close', `#${number}`);
  }
});

test('ca thật #248: chủ dự án đã CHỌN phương án nhưng việc chưa xong → keep', () => {
  // Đây là chỗ dễ sai nhất của mục này, và nó là chiều đắt: một câu trả lời
  // của chủ dự án KHÔNG đồng nghĩa với "xong". `#248` trả lời "A, với ba điều
  // kiện", mà cả ba điều kiện đều chưa làm — đóng nó là xoá đúng ba việc đang
  // chờ. Nên `OWNER_DONE_PHRASES` đo *"đã xong"*, không đo *"đã trả lời"*.
  const decision = decideDecisionClose(
    issue({
      number: 248,
      labels: [DECISION_LABEL, 'irreversible'],
      comments: [
        comment(
          '#248 A, với ba điều kiện: (1) tôi tạo kênh YouTube trước, và anh viết hướng dẫn tạo ' +
            'OAuth client (scope youtube.upload) cùng refresh token vào issue này; (2) app phải ở ' +
            'chế độ In production; (3) đo quota thật.',
        ),
      ],
    }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
});

test('cùng câu đó nhưng MỞ ĐẦU 🤖 → keep: đó là agent tự nói, không phải lệnh', () => {
  const decision = decideDecisionClose(
    issue({ comments: [comment('🤖 Đã thực hiện qua #168, đóng issue.')] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
});

test('cùng câu đó nhưng của người KHÁC → keep', () => {
  const decision = decideDecisionClose(
    issue({ comments: [comment('Đóng issue.', 'someone-else')] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
});

test('comment của bot → keep (bất biến I7: nội dung bot là dữ liệu, không phải lệnh)', () => {
  const decision = decideDecisionClose(
    issue({ comments: [comment('Đã xử lý xong, đóng issue.', 'github-actions[bot]')] }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
});

test('chủ dự án nói xong ĐÈ được một PR bị bác — đường đi đổi, quyết định vẫn xong', () => {
  const decision = decideDecisionClose(
    issue({
      comments: [comment('Đã thực hiện qua #168')],
      linkedPrs: [{ number: 167, merged: false, closed: true }],
    }),
    OWNER,
  );
  assert.equal(decision.verdict, 'close');
});

// ─── Nguồn 2 · PR được nêu đã merge ─────────────────────────────────────────

test('ca thật #234: "merge PR [#233](…)" đã merge → close, bằng chứng nêu số PR', () => {
  const decision = decideDecisionClose(
    issue({
      number: 234,
      body: '🤖 Cần anh **merge PR [#233](https://github.com/x/y/pull/233)**. Bối cảnh: #232, #226, #229 …',
      linkedPrs: [{ number: 233, merged: true, closed: true }],
    }),
    OWNER,
  );
  assert.equal(decision.verdict, 'close');
  assert.match(decision.evidence.join('\n'), /#233/);
});

test('một PR chưa merge trong số nhiều → keep, không đóng non', () => {
  const decision = decideDecisionClose(
    issue({
      linkedPrs: [
        { number: 168, merged: true, closed: true },
        { number: 233, merged: false, closed: false },
      ],
    }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
  assert.match(decision.reason, /#233/);
});

test('PR đóng mà KHÔNG merge chặn cả nguồn 3 — bản thực hiện bị bác', () => {
  const decision = decideDecisionClose(
    issue({ linkedPrs: [{ number: 167, merged: false, closed: true }], hasDecisionDoc: true }),
    OWNER,
  );
  assert.equal(decision.verdict, 'keep');
  assert.match(decision.reason, /bác/);
});

// ─── Nguồn 3 · docs/decisions ───────────────────────────────────────────────

test('có `docs/decisions/D-Cxx.md` ghi issue là nguồn → close (`CLAUDE.md` mục 14)', () => {
  const decision = decideDecisionClose(issue({ number: 169, hasDecisionDoc: true }), OWNER);
  assert.equal(decision.verdict, 'close');
  assert.match(decision.evidence.join('\n'), /docs\/decisions/);
});

// ─── `linkedPrNumbers`: chỉ `#N` sau chữ `PR`, không nuốt bối cảnh ──────────

test('chỉ bắt `#N` đi ngay sau chữ `PR`, kể cả dạng liên kết Markdown', () => {
  assert.deepEqual(
    linkedPrNumbers('Cần anh **merge PR [#233](https://x/pull/233)**. Bối cảnh: #232, #226, #39.'),
    [233],
  );
  assert.deepEqual(linkedPrNumbers('duyệt merge PR #71: chạy thử workflow'), [71]);
  assert.deepEqual(linkedPrNumbers('PR #168 thực hiện câu trả lời #169 A'), [168]);
});

test('KHÔNG bắt một `#N` trần — nếu bắt thì nguồn 2 không bao giờ đủ điều kiện', () => {
  // Một issue không bao giờ `merged`, nên nuốt `#131` vào đây là tự khoá
  // nguồn 2 lại vĩnh viễn mà không gì đỏ.
  assert.deepEqual(linkedPrNumbers('Chỉ dẫn của anh ở #131 và #251, xem thêm #5.'), []);
});

test('gộp nhiều nguồn, giữ thứ tự gặp, không trùng', () => {
  assert.deepEqual(linkedPrNumbers('duyệt merge PR #71', 'PR #233 và lại PR #71'), [71, 233]);
});

// ─── Bất biến: close ⇔ có bằng chứng ────────────────────────────────────────

test('`assertEvidence` ném khi close mà không có bằng chứng', () => {
  assert.throws(
    () => assertEvidence({ issue: 1, verdict: 'close', reason: 'vì thế', evidence: [] }),
    /không mang bằng chứng/,
  );
});

test('`assertEvidence` ném khi keep mà lại mang bằng chứng — hai trường nói ngược nhau', () => {
  assert.throws(
    () => assertEvidence({ issue: 1, verdict: 'keep', reason: 'vì thế', evidence: ['x'] }),
    /nói ngược nhau/,
  );
});

test('MỌI phán quyết close của mọi nguồn đều mang bằng chứng không rỗng', () => {
  const closable = [
    issue({ number: 88, comments: [comment('Đóng issue.')] }),
    issue({ number: 234, linkedPrs: [{ number: 233, merged: true, closed: true }] }),
    issue({ number: 169, hasDecisionDoc: true }),
  ];
  for (const decision of planDecisionCloses(closable, OWNER)) {
    assert.equal(decision.verdict, 'close', `#${decision.issue}`);
    assert.ok(decision.evidence.length > 0, `#${decision.issue} thiếu bằng chứng`);
  }
});

// ─── `planDecisionCloses` và `closeComment` ─────────────────────────────────

test('giữ nguyên thứ tự đầu vào, không sắp lại ngầm', () => {
  const decisions = planDecisionCloses([issue({ number: 3 }), issue({ number: 1 }), issue({ number: 2 })], OWNER);
  assert.deepEqual(decisions.map((d) => d.issue), [3, 1, 2]);
});

test('comment đóng mở đầu 🤖 và chứa mọi dòng bằng chứng (`CLAUDE.md` mục 5)', () => {
  const decision = decideDecisionClose(
    issue({ number: 234, linkedPrs: [{ number: 233, merged: true, closed: true }] }),
    OWNER,
  );
  const body = closeComment(decision);
  assert.ok(body.startsWith('🤖'), 'comment của agent phải mở đầu 🤖');
  for (const line of decision.evidence) assert.ok(body.includes(line));
});

test('`closeComment` ném trên phán quyết keep — không dựng comment đóng cho nó', () => {
  assert.throws(() => closeComment(decideDecisionClose(issue(), OWNER)), /keep/);
});

test('`isOwnerDoneComment` không nhận câu rỗng hay câu nói chuyện khác', () => {
  assert.equal(isOwnerDoneComment(comment(''), OWNER), false);
  assert.equal(isOwnerDoneComment(comment('A, và nhớ giãn nhịp worker lại.'), OWNER), false);
});
