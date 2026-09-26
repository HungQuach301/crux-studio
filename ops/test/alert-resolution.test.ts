import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideMention, type AlertComment } from '../scripts/alert-escalation.ts';
import {
  MAIN_RED_TITLE_MARKER,
  decideClosure,
  incidentSha,
  type Ancestry,
} from '../scripts/alert-resolution.ts';

const MARKER = '<!-- crux-escalate-main-do -->';

/** Khối máy đọc mà `main-ci.yml` nhúng vào thân cảnh báo (`D-C07`). */
const scopeBlock = (sha: string, files: readonly string[]): string =>
  `<!-- crux-hotfix-scope -->\n\`\`\`json\n${JSON.stringify({ sha, files })}\n\`\`\``;

const title = (shortSha: string): string => `[CẢNH BÁO] main đỏ tại ${shortSha}`;

const at = (base: string, hours: number): string =>
  new Date(Date.parse(base) + hours * 3_600_000).toISOString();

// ── Bài TÁI HIỆN LỖI (bất biến I2) ───────────────────────────────────────
//
// Dựng đúng cảnh mục `P-044` mô tả, bằng hàm THẬT chứ không bằng lời: sự cố
// A được @nhắc, `main` xanh lại, sự cố B đỏ vì một commit KHÁC trong vòng 4
// giờ, và vì cảnh báo A chưa bao giờ đóng thì B rơi vào đúng issue đó.
//
// ⚠️ **Giới hạn đã khai, vòng soát ngữ cảnh sạch chỉ ra:** bài đầu tiên chỉ
// gọi `decideMention` — hàm mà PR này KHÔNG đụng — nên nó đúng cả trước lẫn
// sau bản sửa. Nó là bài *dựng hiện trường*, không phải bài đỏ-khi-lỗi-quay-
// lại; tên cũ của nó nói quá. Bài đỏ khi cơ chế mất là bài `BẢN SỬA` ngay
// dưới (ép `decideClosure` luôn `keep` → đỏ) và
// `ops/test/alert-resolution-workflow.test.ts` (xoá job `resolve-alert` → đỏ).
//
// Mắt xích "đóng issue → sự cố sau thấy danh sách RỖNG → `mention`" nằm
// trong `gh issue list --state open` của bash, KHÔNG trong code TypeScript.
// Không dòng nào nối `decideClosure` với `decideMention`, nên hai bài dưới
// đây đặt danh sách rỗng bằng tay. Đó là giới hạn thật của mặt bằng, khai ra
// chứ không để nó trông như đã che.

test('HIỆN TRƯỜNG · cảnh báo không đóng → sự cố đỏ MỚI trong 4 giờ ra `quiet`, không ai được gọi', () => {
  const aRed = '2026-09-24T10:00:00Z';
  const bRed = at(aRed, 1); // đỏ lại sau 1 giờ, commit khác

  // Issue của sự cố A, dùng lại cho B vì không ai đóng nó.
  const reused: AlertComment[] = [
    // thân issue — từ `P-034`, lần @nhắc đầu tiên nằm ở đây
    { body: `🤖 \`main\` đang đỏ.\n${scopeBlock('aaaaaaa1', ['ops/x.ts'])}\n${MARKER}\n@HungQuach301`, createdAt: aRed },
    // comment của sự cố B, cùng issue, KHÔNG mang mốc vì `decideMention` ra `quiet`
    { body: `🤖 \`main\` lại đỏ.\n${scopeBlock('bbbbbbb2', ['ops/y.ts'])}`, createdAt: bRed },
  ];

  const decision = decideMention(reused, MARKER, bRed);
  assert.equal(decision.verdict, 'quiet');
  assert.equal(decision.lastMentionAt, aRed);
  assert.ok(decision.hoursSinceLastMention !== null && decision.hoursSinceLastMention < 4);
});

test('BẢN SỬA · `main` xanh giữa hai sự cố → đóng cảnh báo A, nên B có issue MỚI và ra `mention` ngay', () => {
  const aRed = '2026-09-24T10:00:00Z';
  const greenAt = at(aRed, 0.5);
  const bRed = at(aRed, 1);

  const alertA = {
    title: title('aaaaaaa1'),
    body: `🤖 \`main\` đang đỏ.\n${scopeBlock('aaaaaaa1', ['ops/x.ts'])}\n${MARKER}\n@HungQuach301`,
  };

  // Lượt `check` xanh lúc `greenAt`: `aaaaaaa1` là tổ tiên của commit xanh.
  const closure = decideClosure({
    title: alertA.title,
    incident: incidentSha(alertA.title, alertA.body),
    ancestry: 'ancestor',
  });
  assert.equal(closure.verdict, 'close');
  assert.ok(closure.reason.includes('xanh lại'), 'lý do phải nói ra, cấm im lặng');
  assert.ok(Date.parse(greenAt) < Date.parse(bRed));

  // A đã đóng → `gh issue list --state open` không còn thấy nó, nên sự cố B
  // đi nhánh TẠO issue của `main-ci.yml`, và thân issue mới mang sẵn @nhắc
  // (`P-034`). Danh sách mục mà `decideMention` nhìn thấy lúc đó là RỖNG —
  // đó là hình dạng thật, không phải một issue đã có sẵn thân.
  assert.equal(decideMention([], MARKER, bRed).verdict, 'mention');

  // Và chỉ cần A còn mở thì cùng một sự cố B ra `quiet` — hai dòng này
  // cạnh nhau là toàn bộ chỗ khác nhau mà bản sửa tạo ra.
  const stillOpen: AlertComment[] = [{ body: `${MARKER}\n@HungQuach301`, createdAt: aRed }];
  assert.equal(decideMention(stillOpen, MARKER, bRed).verdict, 'quiet');
});

// ── `incidentSha` ────────────────────────────────────────────────────────

test('`sha` lấy từ khối máy đọc khi có', () => {
  const body = `🤖 \`main\` đang đỏ.\n${scopeBlock('abcdef1234567', ['ops/x.ts'])}`;
  assert.deepEqual(incidentSha(title('zzzzzzz'), body), {
    sha: 'abcdef1234567',
    source: 'scope-block',
  });
});

test('issue đã bị DÙNG LẠI: khối CUỐI thắng, tức `sha` của sự cố mới nhất', () => {
  const body = [
    `🤖 \`main\` đang đỏ.\n${scopeBlock('aaaaaaa1', ['ops/x.ts'])}`,
    `🤖 \`main\` vẫn đỏ.\n${scopeBlock('bbbbbbb2', ['ops/y.ts'])}`,
  ].join('\n\n');
  assert.equal(incidentSha(title('aaaaaaa1'), body)?.sha, 'bbbbbbb2');
});

test('cảnh báo mở TRƯỚC `D-C07` không có khối nào → lấy `sha` từ tiêu đề (ca thật `#131`)', () => {
  const body =
    '🤖 `main` đang đỏ.\n\n`pnpm check` đỏ trên `main` tại commit `a44d26589927f9fa9063420a6d857abf06d95972`.';
  assert.deepEqual(incidentSha('[CẢNH BÁO] main đỏ tại a44d265', body), {
    sha: 'a44d265',
    source: 'title',
  });
});

test('không nguồn nào đọc được → `null`, KHÔNG đoán', () => {
  assert.equal(incidentSha('[CẢNH BÁO] nhà máy im lặng', 'không có gì ở đây'), null);
});

test('khối có `files` nhưng `sha` rỗng hoặc không phải hex → rơi về tiêu đề, không nhận bừa', () => {
  const body = `🤖\n${scopeBlock('', ['ops/x.ts'])}`;
  assert.deepEqual(incidentSha(title('a44d265'), body), { sha: 'a44d265', source: 'title' });

  const junk = `🤖\n${scopeBlock('KHÔNG-PHẢI-SHA', ['ops/x.ts'])}`;
  assert.deepEqual(incidentSha(title('a44d265'), junk), { sha: 'a44d265', source: 'title' });
});

// ── `decideClosure` · hướng an toàn luôn là `keep` ───────────────────────

test('chỉ cảnh báo `main` đỏ mới đóng được — ba loại cảnh báo khẩn khác giữ nguyên', () => {
  for (const other of [
    '[CẢNH BÁO] Nhà máy im lặng',
    '[CẢNH BÁO] chi phí vượt 80% ngân sách học',
    '[CẢNH BÁO] sự cố bảo mật',
  ]) {
    const decision = decideClosure({
      title: other,
      incident: { sha: 'aaaaaaa1', source: 'scope-block' },
      ancestry: 'ancestor',
    });
    assert.equal(decision.verdict, 'keep', other);
    assert.ok(decision.reason.includes(MAIN_RED_TITLE_MARKER));
  }
});

test('không đọc được `sha` → `keep`, không đóng bừa', () => {
  const decision = decideClosure({ title: title('a44d265'), incident: null, ancestry: 'ancestor' });
  assert.equal(decision.verdict, 'keep');
  assert.ok(decision.reason.includes('sha'));
});

test('`sha` sự cố KHÔNG nằm trong lịch sử commit xanh → `keep`', () => {
  const decision = decideClosure({
    title: title('a44d265'),
    incident: { sha: 'a44d265', source: 'title' },
    ancestry: 'not-ancestor',
  });
  assert.equal(decision.verdict, 'keep');
});

test('`git` không trả lời được → `unknown` → `keep`, không phải `close`', () => {
  const decision = decideClosure({
    title: title('a44d265'),
    incident: { sha: 'a44d265', source: 'title' },
    ancestry: 'unknown',
  });
  assert.equal(decision.verdict, 'keep');
});

test('đủ ba điều kiện → `close`, và lý do luôn có một câu', () => {
  for (const source of ['scope-block', 'title'] as const) {
    const decision = decideClosure({
      title: title('a44d265'),
      incident: { sha: 'a44d265', source },
      ancestry: 'ancestor',
    });
    assert.equal(decision.verdict, 'close');
    assert.ok(decision.reason.length > 0);
    assert.ok(decision.reason.includes(source));
  }
});

test('mọi `ancestry` hợp lệ đều có một nhánh, và chỉ MỘT nhánh ra `close`', () => {
  const verdicts = (['ancestor', 'not-ancestor', 'unknown'] as const satisfies readonly Ancestry[]).map(
    (ancestry) =>
      decideClosure({
        title: title('a44d265'),
        incident: { sha: 'a44d265', source: 'title' },
        ancestry,
      }).verdict,
  );
  assert.deepEqual(verdicts, ['close', 'keep', 'keep']);
});
