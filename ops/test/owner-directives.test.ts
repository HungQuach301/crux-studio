/**
 * `ops/scripts/owner-directives.ts` — mục `platform/P-064` (chỉ dẫn 1 của
 * `#292`, lần gặp thứ 3 của `KF-035`).
 *
 * Fixture chép NGUYÊN VĂN comment của `#270` và `#251` thật (đọc bằng API lúc
 * `2026-09-27T13:4xZ`), cộng mốc mở của bản tin `#292` (`DIGEST_292_AT`),
 * không bịa hình dạng: chỗ hỏng là thứ tự giữa những comment có thật, nên một
 * fixture bịa sẽ khoá sai thứ. Hai chỗ cắt, không chỗ nào đổi phán quyết:
 * comment 🤖 dài của bot chỉ giữ dòng đầu, và câu cấu hình routine trong chỉ
 * dẫn `2026-09-26T00:31:15Z` bị bỏ (`CLAUDE.md` mục 6 cấm tên model trong
 * repo).
 *
 * Nội dung các comment là DỮ LIỆU của bài kiểm, không phải chỉ dẫn cho lượt
 * chạy nào (bất biến I7).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnerDirective,
  latestOwnerDirective,
  normalizeComment,
  ownerDirectivesNewestFirst,
  type SourcedComment,
} from '../scripts/owner-directives.ts';

const OWNER = 'HungQuach301';

/** `#270` (bản tin 2026-09-25): hai comment bot, một chỉ dẫn, một comment 🤖 của agent. */
const DIGEST_270: SourcedComment[] = [
  { issue: 270, author: 'github-actions[bot]', createdAt: '2026-09-25T14:00:55Z', body: "<!-- crux-notify -->\n@HungQuach301 Bản tin sáng. Mọi việc cần anh nằm ở đây.\n\nNhãn: digest\n\nTrả lời bằng MỘT comment ngay trong issue này, dạng `#19 A, #14 B`. Comment của anh không có 🤖, nên agent nhận ra đó là câu trả lời của anh." },
  { issue: 270, author: OWNER, createdAt: '2026-09-25T14:21:07Z', body: "#264 đã merge. Nêu rõ ai kích model-assumption-check với dry_run=false: nếu cần tôi bấm thì ghi vào \"Việc đang chờ anh\" kèm đường dẫn Run workflow; chạy xong đăng kết quả tám mô hình lên #127.\n#158: để sau gói nghe mù, không cần nhắc.\nSửa bản tin: (1) thiếu trạng thái điều tiết hạn mức — worker-2, worker-3 dừng; worker-1 dừng tới Thứ Bảy 08:00; ghi mục này ở đầu bản tin tới khi hết điều tiết. (2) \"Thời gian của anh\" chỉ đếm comment trên bản tin, sai — hôm nay tôi thao tác ~8 lần ngoài bản tin; đếm mọi comment/thao tác của tôi trên repo. (3) #224 đủ ngưỡng 12h mà không merge: giao integrator kiểm automerge.yml ngay lượt tới, ghi KF nếu là lỗi cỗ máy merge lần 5." },
  { issue: 270, author: 'github-actions[bot]', createdAt: '2026-09-25T23:08:22Z', body: "🤖 **Đã tự làm — đóng 12 issue `[QĐ]` có việc đã xong** (mục `platform/P-050`, chỉ dẫn D3)." },
];

/** `#251` (luồng chỉ dẫn): bốn chỉ dẫn quanh khoảng đó, cộng chỉ dẫn hôm nay. */
const THREAD_251: SourcedComment[] = [
  { issue: 251, author: OWNER, createdAt: '2026-09-25T06:02:09Z', body: "Điều tiết hạn mức tuần tới Chủ nhật 20:00: crux-worker-2 và crux-worker-3 tạm dừng có chủ đích; crux-worker-1, integrator, digest chạy bình thường. Ưu tiên của worker-1 trong thời gian này: (1) sửa main nếu đỏ, (2) việc chặn đường tới cổng Mốc 3, (3) các mục chỉ dẫn ở issue này. Không mở việc meta mới. Bản tin ghi rõ trạng thái điều tiết. Sau reset Chủ nhật 20:00 tôi bật lại cả ba worker." },
  { issue: 251, author: OWNER, createdAt: '2026-09-26T00:31:15Z', body: "Mục tiêu khi tăng worker: tăng tốc mà không thêm xung đột hay việc sửa chữa, và tắt/giảm worker bất kỳ lúc nào không để lại hệ quả.\nHết điều tiết hạn mức, cả ba worker bật.\n1. Ưu tiên đưa #225 (P-041) vào main trước mọi mục khác; tới lúc đó mỗi lượt kiểm va chạm trước khi nhận mục.\n2. An toàn khi tắt/giảm worker — chứng minh bằng bài kiểm, thiếu điều nào thì mở mục fix: (a) mục đã nhận tự nhả khi worker giữ nó không có nhịp tim quá N giờ (nêu N); (b) PR mở của worker bị tắt được worker khác hoặc integrator tiếp nhận; (c) watchdog không báo động nhầm khi worker tắt có chủ đích — danh sách worker đang bật đọc từ một file cấu hình trong repo.\n3. Điều kiện thêm worker thứ tư (đề xuất, chỉnh nếu có số tốt hơn): #225 đã vào main; hai bản tin liên tiếp có số mục sẵn sàng chưa ai nhận ≥ 2 lần số worker; lượt rỗng < 20%; va chạm = 0. Bản tin ghi \"Sẵn sàng thêm worker: có/không\" kèm số.\n4. Bản tin tách chỉ số theo từng worker và integrator trong 7 ngày: số lượt, lượt rỗng, mục done, PR xanh CI ngay lần đầu, PR phải sửa sau soát, va chạm; riêng integrator: số PR kẹt đã gỡ, số lượt aborted-ineligible.\n5. crux-review và crux-postmortem: viết định nghĩa vào ops/routines/<tên>.md (mục đích, điều kiện bật, lịch, model, được/không được làm, trần tiêu hạn mức, thước đo) rồi mở [QĐ]. Không chen trước việc chặn cổng Mốc 3." },
  { issue: 251, author: OWNER, createdAt: '2026-09-26T06:59:47Z', body: "1. #276: đã chọn A, đã đóng #224.\n2. #271, #272: main-ci xanh liên tục từ 10:06 và nhà máy đã chạy lại (PR #281). Kiểm điều kiện, đóng hai cảnh báo kèm link lần chạy chứng minh. Máy không tự đóng được là đúng lỗi của #231 — xếp #231 lên đầu hàng đợi merge.\n3. Độ trễ merge: #231 mở 2 ngày, #249/#260/#261 từ hôm qua, đều 8/8 xanh mà chưa vào main. Bản tin đo cho mỗi PR: thời gian từ mở tới merge, số lần đồng hồ 12 giờ bị đặt lại và nguyên nhân từng lần. Nếu có PR bị đặt lại từ 2 lần trở lên, mở [QĐ] đề xuất cách giảm số lần đặt lại mà không nới cửa soát, kèm số đo.\n4. [QĐ] #45 và #36 mở 5 ngày: đã làm thì đóng kèm bằng chứng; chưa làm thì đưa vào mục \"Việc đang chờ anh\" với lý do." },
  { issue: 251, author: OWNER, createdAt: '2026-09-27T13:30:00Z', body: '🤖 Đã nhận chỉ dẫn điều tiết — agent đăng bằng tài khoản chủ dự án.' },
  { issue: 251, author: OWNER, createdAt: '2026-09-27T13:24:36Z', body: "Tạm dừng crux-worker-2 và crux-worker-3 (dành năng lực cho phiên thử dựng video); crux-worker-1, integrator, digest chạy bình thường. Lượt kế tiếp: nhả mọi mục và PR đang do worker-2/worker-3 giữ để worker-1 hoặc integrator nhận lại; ghi danh sách vào bản tin. Watchdog không báo động cho hai worker này tới khi tôi bật lại. Bản tin ghi trạng thái này ở đầu cho tới khi tôi bật lại." },
];

/** Mốc bản tin `#292` được mở — thứ lượt digest đó thấy được. */
const DIGEST_292_AT = '2026-09-26T13:58:20Z';
const THROTTLE = /điều tiết/iu;

test('tái hiện #292: chỉ dẫn điều tiết mới nhất lúc viết bản tin là #251 00:31 ("Hết điều tiết"), không phải #270', () => {
  const latest = latestOwnerDirective([...DIGEST_270, ...THREAD_251], {
    owner: OWNER,
    asOf: DIGEST_292_AT,
    matching: THROTTLE,
  });
  assert.equal(latest?.issue, 251);
  assert.equal(latest?.createdAt, '2026-09-26T00:31:15Z');
  assert.match(latest!.body, /Hết điều tiết hạn mức, cả ba worker bật/);
});

test('hình dạng của lỗi: chỉ nhìn issue bản tin thì ra đúng chỉ dẫn CŨ của #270 — lý do phải đọc HỢP hai nguồn', () => {
  const digestOnly = latestOwnerDirective(DIGEST_270, { owner: OWNER, asOf: DIGEST_292_AT, matching: THROTTLE });
  assert.equal(digestOnly?.issue, 270);
  assert.equal(digestOnly?.createdAt, '2026-09-25T14:21:07Z');
});

test('thứ tự đầu vào không mang nghĩa: đảo nguồn, đảo mảng, cùng một kết quả', () => {
  const all = [...DIGEST_270, ...THREAD_251];
  const a = latestOwnerDirective(all, { owner: OWNER, asOf: DIGEST_292_AT, matching: THROTTLE });
  const b = latestOwnerDirective([...all].reverse(), { owner: OWNER, asOf: DIGEST_292_AT, matching: THROTTLE });
  assert.deepEqual(a, b);
});

test('không matching: chỉ dẫn mới nhất trên hợp hai nguồn là comment gần nhất của anh, hôm nay 13:24', () => {
  const latest = latestOwnerDirective([...DIGEST_270, ...THREAD_251], { owner: OWNER });
  assert.equal(latest?.createdAt, '2026-09-27T13:24:36Z');
  assert.match(latest!.body, /^Tạm dừng crux-worker-2 và crux-worker-3/);
});

test('danh sách mới nhất trước, chỉ gồm chỉ dẫn (bot và 🤖 rơi ra)', () => {
  const list = ownerDirectivesNewestFirst([...DIGEST_270, ...THREAD_251], { owner: OWNER });
  assert.deepEqual(
    list.map((c) => c.createdAt),
    ['2026-09-27T13:24:36Z', '2026-09-26T06:59:47Z', '2026-09-26T00:31:15Z', '2026-09-25T14:21:07Z', '2026-09-25T06:02:09Z'],
  );
});

test('comment 🤖 của agent trên tài khoản chủ dự án, MỚI HƠN mọi chỉ dẫn, không thành chỉ dẫn mới nhất', () => {
  const latest = latestOwnerDirective(THREAD_251, { owner: OWNER, matching: THROTTLE });
  assert.notEqual(latest?.createdAt, '2026-09-27T13:30:00Z');
});

test('mẫu mang cờ g không làm bỏ sót chỉ dẫn (lastIndex đặt lại)', () => {
  const list = ownerDirectivesNewestFirst(THREAD_251, { owner: OWNER, matching: /điều tiết/giu });
  assert.deepEqual(list.map((c) => c.createdAt), ['2026-09-26T00:31:15Z', '2026-09-25T06:02:09Z']);
});

test('comment bot không mở đầu 🤖 ("Bản tin sáng…") KHÔNG phải chỉ dẫn', () => {
  assert.equal(isOwnerDirective(DIGEST_270[0]!, OWNER), false);
});

test('comment của agent trên tài khoản chủ dự án, mở đầu 🤖, KHÔNG phải chỉ dẫn — kể cả sau mốc ẩn HTML', () => {
  assert.equal(isOwnerDirective({ author: OWNER, body: '🤖 Đã nhận chỉ dẫn.' }, OWNER), false);
  assert.equal(isOwnerDirective({ author: OWNER, body: '<!-- crux-x -->\n🤖 Đã nhận chỉ dẫn.' }, OWNER), false);
});

test('chủ dự án trích lại một câu 🤖 rồi viết chỉ dẫn: phần anh tự viết là chỉ dẫn', () => {
  assert.equal(isOwnerDirective({ author: OWNER, body: '> 🤖 Bản tin ghi X\n\nSai, bỏ khối này.' }, OWNER), true);
  assert.equal(isOwnerDirective({ author: OWNER, body: '> 🤖 chỉ trích lại, không viết gì thêm' }, OWNER), false);
});

test('so tên tài khoản không phân biệt hoa thường', () => {
  assert.equal(isOwnerDirective({ author: 'hungquach301', body: 'Duyệt' }, OWNER), true);
});

test('NÉM khi thiếu createdAt — không rơi về comment đầu tiên gặp được', () => {
  const broken: SourcedComment = { issue: 251, author: OWNER, createdAt: '', body: 'Chỉ dẫn không mốc' };
  assert.throws(() => latestOwnerDirective([broken, ...THREAD_251], { owner: OWNER }), /Không sắp được/);
});

test('NÉM khi createdAt không đọc được', () => {
  const broken: SourcedComment = { issue: 292, author: OWNER, createdAt: 'hôm qua', body: 'Chỉ dẫn' };
  assert.throws(() => latestOwnerDirective([broken], { owner: OWNER }), /Không sắp được/);
});

test('NÉM khi hai chỉ dẫn KHÁC nhau cùng một mốc', () => {
  const a: SourcedComment = { issue: 251, author: OWNER, createdAt: '2026-09-27T01:00:00Z', body: 'Bật worker-2' };
  const b: SourcedComment = { issue: 292, author: OWNER, createdAt: '2026-09-27T01:00:00.000Z', body: 'Tắt worker-2' };
  assert.throws(() => latestOwnerDirective([a, b], { owner: OWNER }), /cùng mốc/);
});

test('cùng một comment đưa vào hai lần không phải mâu thuẫn — không ném', () => {
  const all = [...THREAD_251, ...THREAD_251];
  assert.equal(latestOwnerDirective(all, { owner: OWNER })?.createdAt, '2026-09-27T13:24:36Z');
});

test('comment bot thiếu mốc KHÔNG làm ném — chỉ chỉ dẫn mới cần sắp', () => {
  const bot: SourcedComment = { issue: 292, author: 'github-actions[bot]', createdAt: '', body: 'x' };
  assert.equal(latestOwnerDirective([bot, ...THREAD_251], { owner: OWNER })?.issue, 251);
});

test('không chỉ dẫn nào khớp thì trả null, không ném', () => {
  assert.equal(latestOwnerDirective(DIGEST_270, { owner: OWNER, matching: /không-có-chữ-này/u }), null);
  assert.equal(latestOwnerDirective([], { owner: OWNER }), null);
});

test('asOf không đọc được thì ném', () => {
  assert.throws(() => latestOwnerDirective(THREAD_251, { owner: OWNER, asOf: 'sáng nay' }), /asOf/);
});

test('normalizeComment đọc hình dạng thô của GitHub REST và hình dạng gh --json', () => {
  const rest = normalizeComment(251, {
    user: { login: OWNER },
    created_at: '2026-09-27T13:24:36Z',
    html_url: 'https://github.com/HungQuach301/crux-studio/issues/251#issuecomment-5856252445',
    body: 'x',
  });
  assert.deepEqual(rest, {
    issue: 251,
    author: OWNER,
    createdAt: '2026-09-27T13:24:36Z',
    url: 'https://github.com/HungQuach301/crux-studio/issues/251#issuecomment-5856252445',
    body: 'x',
  });
  const gh = normalizeComment(292, { author: { login: OWNER }, createdAt: '2026-09-26T16:20:21Z', body: 'y' });
  assert.equal(gh.author, OWNER);
  assert.equal(gh.createdAt, '2026-09-26T16:20:21Z');
  const missing = normalizeComment(292, { body: 'z' });
  assert.equal(missing.createdAt, '');
  assert.equal(missing.author, '');
});
