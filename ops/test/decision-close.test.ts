import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AUTOCLOSE_MARKER,
  DECISION_LABEL,
  assertEvidence,
  attachLinkedPrs,
  closeComment,
  decideDecisionClose,
  isOwnerDoneComment,
  linkedPrNumbers,
  markDecisionDocs,
  planDecisionCloses,
  wasAutoClosedBefore,
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

test('comment đóng mang 🤖 và chứa mọi dòng bằng chứng (`CLAUDE.md` mục 5)', () => {
  const decision = decideDecisionClose(
    issue({ number: 234, linkedPrs: [{ number: 233, merged: true, closed: true }] }),
    OWNER,
  );
  const body = closeComment(decision);
  // Mốc ẩn đi trước 🤖, đúng khuôn `<!-- crux-escalate-main-do -->` của
  // `alert-escalation`: mốc là HTML comment nên người đọc vẫn thấy 🤖 đầu tiên.
  assert.ok(body.replace(/<!--[\s\S]*?-->/g, '').trim().startsWith('🤖'));
  for (const line of decision.evidence) assert.ok(body.includes(line));
});

test('`closeComment` ném trên phán quyết keep — không dựng comment đóng cho nó', () => {
  assert.throws(() => closeComment(decideDecisionClose(issue(), OWNER)), /keep/);
});

test('`isOwnerDoneComment` không nhận câu rỗng hay câu nói chuyện khác', () => {
  assert.equal(isOwnerDoneComment(comment(''), OWNER), false);
  assert.equal(isOwnerDoneComment(comment('A, và nhớ giãn nhịp worker lại.'), OWNER), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Các bài dưới đây đều lấy từ **vòng soát ngữ cảnh sạch** (bước 6 phụ lục P1)
// của chính mục `P-050`. Cả bảy ca C1 và bốn ca N1 đã tái hiện được là SAI trên
// bản đầu, và cả chín đều nghiêng về **chiều đắt**: đóng một `[QĐ]` còn đang
// chờ người, kèm một dòng "bằng chứng" đọc như thật.
// ─────────────────────────────────────────────────────────────────────────────

test('C1 · câu phủ định và câu có điều kiện KHÔNG được đọc thành "xong"', () => {
  const blocked = [
    'Chưa đóng issue được, để tôi kiểm lại đã.',
    'Đừng đóng issue này, tôi còn muốn theo dõi.',
    'Không đóng issue nhé, chờ tôi.',
    'Làm xong A rồi hãy đóng issue.',
    'B. Sau khi có số đo thì đóng issue.',
    'Trước khi đóng issue thì cho tôi xem số đã.',
    'Nếu CI xanh thì đóng issue.',
    'Khi nào có kết quả thì đóng issue.',
    'Việc kia đã xử lý xong, nhưng câu hỏi ở issue này thì tôi chưa quyết.',
  ];
  for (const body of blocked) {
    assert.equal(
      decideDecisionClose(issue({ comments: [comment(body)] }), OWNER).verdict,
      'keep',
      body,
    );
  }
});

test('C1 · ranh giới từ phải hiểu chữ có dấu — `\\b` của JS chỉ biết ASCII', () => {
  // Bản đầu dùng `/\bđừng\b/` và `/\bchớ\b/`: `đ` ở đầu và `ớ` ở cuối không
  // phải ký tự từ theo ASCII, nên hai luật đó IM LẶNG không khớp trong khi
  // `chưa`/`không` (viền ASCII) vẫn khớp — hỏng một phần, kiểu khó thấy nhất.
  for (const body of ['Đừng đóng issue.', 'Chớ đóng issue.', 'đừng đóng issue nha']) {
    assert.equal(isOwnerDoneComment(comment(body), OWNER), false, body);
  }
});

test('C1 · comment TRÍCH DẪN lại lời 🤖 của agent không phải lệnh của người', () => {
  // `isStopComment` của `merge-gate.ts` không cần bước bỏ trích dẫn vì ở đó
  // hướng lệch ngược lại (trích chữ `dừng` → KHÔNG merge, tức an toàn). Ở đây
  // cùng phép so cho hậu quả trái dấu, nên không chép nguyên sang được.
  const quoted = '> 🤖 Đã thực hiện qua #168\n\nChưa đúng, làm lại.';
  assert.equal(decideDecisionClose(issue({ comments: [comment(quoted)] }), OWNER).verdict, 'keep');
});

test('C1 · mốc ẩn HTML không được làm comment của MÁY trông như của người', () => {
  const machine = `${AUTOCLOSE_MARKER}\n🤖 Tự đóng: đã thực hiện qua #168.`;
  assert.equal(isOwnerDoneComment(comment(machine), OWNER), false);
});

test('C1 · hai ca thật vẫn phải đi qua được', () => {
  // `#88`: `không` nằm ở câu MỘT, cụm khớp ở câu HAI — nên phép chặn phải ở
  // mức câu, không mức comment.
  assert.equal(isOwnerDoneComment(comment('C: xác nhận, không hoàn tác. Đóng issue.'), OWNER), true);
  assert.equal(isOwnerDoneComment(comment('Đã thực hiện qua #168'), OWNER), true);
});

test('N1 · `linkedPrNumbers` bắt đủ mọi cách viết mà repo này dùng thật', () => {
  assert.deepEqual(linkedPrNumbers('Cần anh merge PR #233 và #234.'), [233, 234]);
  assert.deepEqual(linkedPrNumbers('Cần anh merge hai PR: #233, #234.'), [233, 234]);
  assert.deepEqual(linkedPrNumbers('Xem PRs #233 và #234'), [233, 234]);
  assert.deepEqual(linkedPrNumbers('Cần anh merge PR `#120` — …'), [120]);
  assert.deepEqual(linkedPrNumbers('Bản thực hiện: [#168](https://x/pull/168) đã merge.'), [168]);
});

test('N1 · bỏ sót một PR là ĐÓNG NON, nên ca "PR #233 và #234" có bài riêng', () => {
  // Bản đầu trả `[233]`, nên `#234` không bao giờ được đo và `every(merged)`
  // ra `close` dù `#234` còn mở.
  const one = attachLinkedPrs(
    [issue({ number: 900, body: 'Cần anh merge PR #233 và #234.' })],
    [
      { number: 233, merged: true, closed: true },
      { number: 234, merged: false, closed: false },
    ],
  )[0]!;
  assert.deepEqual(one.linkedPrs.map((pr) => pr.number), [233, 234]);
  assert.equal(decideDecisionClose(one, OWNER).verdict, 'keep');
});

test('N1 · vẫn KHÔNG nuốt issue trích dẫn làm bối cảnh', () => {
  assert.deepEqual(
    linkedPrNumbers('Cần anh **merge PR [#233](https://x/pull/233)**. Bối cảnh: #232, #226, #39.'),
    [233],
  );
  assert.deepEqual(linkedPrNumbers('Chỉ dẫn của anh ở #131 và #251, xem thêm #5.'), []);
});

test('N3 · PR KHÔNG đo được → keep, và nó chặn cả nguồn 3', () => {
  // `gh api …/pulls/N` trả 403 vì thiếu quyền trông y hệt "`#N` không phải
  // PR". Gộp hai ca đó làm nguồn 2 và chốt `closed && !merged` im lặng tắt,
  // rồi nguồn 3 đóng issue phía sau lưng — nhóm Z.
  const one = attachLinkedPrs([issue({ body: 'Cần anh merge PR #233.', hasDecisionDoc: true })], [])[0]!;
  assert.deepEqual(one.unmeasuredPrs, [233]);
  const decision = decideDecisionClose(one, OWNER);
  assert.equal(decision.verdict, 'keep');
  assert.match(decision.reason, /Không đo được/);
});

test('N4 · issue đã từng bị máy đóng mà nay đang mở → KHÔNG đóng lại', () => {
  const reopened = issue({
    comments: [comment(`${AUTOCLOSE_MARKER}\n🤖 Tự đóng…`), comment('Đóng issue.')],
    linkedPrs: [{ number: 233, merged: true, closed: true }],
    hasDecisionDoc: true,
  });
  assert.equal(wasAutoClosedBefore(reopened), true);
  const decision = decideDecisionClose(reopened, OWNER);
  assert.equal(decision.verdict, 'keep');
  assert.match(decision.reason, /mở lại/);
});

test('N4 · mốc tự đóng thắng CẢ nguồn 1 — mở lại là hành động cố ý của người', () => {
  // Đặt phép chặn này sau nguồn 1 thì chính câu "xong" đã đóng issue lần đầu
  // sẽ đóng lại nó mỗi ngày, và đường thoát duy nhất là bỏ nhãn `decision` —
  // mà bỏ nhãn cũng đẩy issue ra khỏi bản tin.
  const reopened = issue({
    comments: [comment('Đã thực hiện qua #168'), comment(`${AUTOCLOSE_MARKER}\n🤖 Tự đóng…`)],
  });
  assert.equal(decideDecisionClose(reopened, OWNER).verdict, 'keep');
});

test('`closeComment` mang mốc tự đóng, và 🤖 ngay sau nó', () => {
  const decision = decideDecisionClose(
    issue({ number: 234, linkedPrs: [{ number: 233, merged: true, closed: true }] }),
    OWNER,
  );
  const body = closeComment(decision);
  assert.ok(body.startsWith(AUTOCLOSE_MARKER), 'phải mở đầu bằng mốc để lượt sau đọc được');
  assert.ok(body.includes(`\n🤖`), 'comment của agent vẫn phải mang 🤖 (CLAUDE.md mục 5)');
  // Và chính comment đó không được đọc thành lệnh của người ở lượt sau.
  assert.equal(isOwnerDoneComment({ author: OWNER, body, createdAt: 'x' }, OWNER), false);
});

// ─── C2 · `hasDecisionDoc` chỉ đọc dòng `- **Nguồn:**` ──────────────────────

const DOCS = [
  '# D-C07 · lối đi nhanh',
  '',
  '- **Ngày:** 2026-09-23',
  '- **Nguồn:** issue `🤖 [QĐ] #169`, chủ dự án chọn phương án **A**',
  '',
  'Bối cảnh: đang có PR `#120` mở trên chính file đó, và `#167` đã xanh.',
  '- Chủ dự án trả lời tất cả trong MỘT comment, dạng `#19 A, #14 B`.',
].join('\n');

test('C2 · chỉ issue được ghi ở dòng `Nguồn:` mới tính là có doc', () => {
  const marked = markDecisionDocs([issue({ number: 169 })], DOCS);
  assert.equal(marked[0]!.hasDecisionDoc, true);
});

test('C2 · issue chỉ được DẪN LÀM BỐI CẢNH thì KHÔNG tính — 7/7 số từng khớp oan', () => {
  // Đo được trên `main`: `#19` khớp chỉ vì `D-C06.md` in ví dụ ĐỊNH DẠNG trả
  // lời `#19 A, #14 B`; `#120`/`#167` khớp vì `D-C07.md` dẫn chúng làm bối
  // cảnh. Mỗi ca là một issue bị đóng kèm dòng bằng chứng NÓI SAI SỰ THẬT.
  for (const number of [19, 14, 120, 167]) {
    assert.equal(markDecisionDocs([issue({ number })], DOCS)[0]!.hasDecisionDoc, false, `#${number}`);
  }
});

test('C2 · không neo cuối số thì `#16` khớp oan `#169`', () => {
  assert.equal(markDecisionDocs([issue({ number: 16 })], DOCS)[0]!.hasDecisionDoc, false);
});

test('C2 · không có file quyết định nào → mọi issue false (hướng an toàn)', () => {
  assert.equal(markDecisionDocs([issue({ number: 169 })], '')[0]!.hasDecisionDoc, false);
});
