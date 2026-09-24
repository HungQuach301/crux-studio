import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_VALUE,
  SCAN_EXCLUDED,
  ALLOW_MARKER,
  allContractLockProblems,
  bareToken,
  contractLockProblems,
  findVisibilitySites,
  lockedToPrivate,
  scanVisibility,
  valueVerdict,
  visibilityValueProblems,
} from '../scripts/check-visibility.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Soát một đoạn nguồn giả như thể nó là một file trong repo. */
const scan = (content: string, file = 'workshops/release/src/upload.ts'): ReturnType<typeof visibilityValueProblems> =>
  visibilityValueProblems(findVisibilitySites(file, content));

// ── TIÊU CHÍ XONG số 2 của release/R-002 ─────────────────────────────────
// "Không có đường nào trong code đặt `visibility` khác `private`."

test('TIÊU CHÍ: một dòng đặt visibility thành giá trị khác → CHẶN', () => {
  const { problems } = scan(`  publication: { visibility: 'public' },`);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /visibility.*public/);
  assert.match(problems[0]!, /I5/);
});

test('TIÊU CHÍ: khoá của YouTube API (privacyStatus) cũng bị chặn — contract không nhìn thấy khoá này', () => {
  const { problems } = scan(`    status: { privacyStatus: 'unlisted' },`);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /privacyStatus/);
});

test('TIÊU CHÍ: giá trị không phải hằng số là "không biết", và "không biết" bị chặn', () => {
  const { problems } = scan('  const body = { privacyStatus: mode };');
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /không phải hằng số/);
});

test('một chữ trần: trong YAML là HẰNG SỐ, trong TS là BIẾN — chặn cả hai, gọi đúng tên', () => {
  assert.equal(valueVerdict('unlisted', 'ops/workflows/publish.yml'), 'other-literal');
  assert.equal(valueVerdict('mode', 'workshops/release/src/upload.ts'), 'dynamic');
  assert.equal(valueVerdict(ALLOWED_VALUE, 'ops/workflows/publish.yml'), 'private');
});

test('TIÊU CHÍ: nới KIỂU thành string cũng bị chặn — không dòng nào mang chữ public', () => {
  const { problems } = scan(`  publication: { visibility: string };`);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /kiểu rộng/);
});

test('đường đúng đi qua sạch, ở cả ba cách viết', () => {
  assert.deepEqual(scan(`      visibility: 'private',`).problems, []);
  assert.deepEqual(scan(`      "visibility": "private",`, 'packs/channels/x/channel.json').problems, []);
  assert.deepEqual(scan(`  visibility: private`, 'ops/workflows/publish.yml').problems, []);
});

// ── Chỗ KHÔNG được kêu (một bộ dò kêu sai vài lần là một bộ dò bị tắt) ───

test('"visibility" trong mảng required KHÔNG phải một chỗ gán', () => {
  const sites = findVisibilitySites('kernel/contracts/release.payload.v0.schema.json', `      "required": ["visibility", "quotaUnitsUsed"],`);
  assert.deepEqual(sites, []);
});

test('vị trí schema ("visibility": {) để phần khoá contract lo, không kêu hai lần', () => {
  assert.equal(valueVerdict('{'), 'schema');
  assert.deepEqual(scan(`        "visibility": {`, 'kernel/contracts/release.payload.v0.schema.json').problems, []);
});

test('dòng chỉ có chú thích không phải đường code', () => {
  assert.deepEqual(findVisibilitySites('a.ts', `  // visibility: 'public' — ví dụ trong tài liệu`), []);
  assert.deepEqual(findVisibilitySites('a.ts', ` * visibility: 'public'`), []);
  assert.deepEqual(findVisibilitySites('a.yml', `# visibility: public`), []);
});

test('bareToken cắt đuôi cú pháp nên thông báo không dính rác', () => {
  assert.equal(bareToken(`string } } };`), 'string');
  assert.equal(bareToken(`private # ghi chú`), 'private');
  assert.equal(bareToken(`private,`), 'private');
});

// ── Lối thoát có kiểm soát ───────────────────────────────────────────────

test(`${ALLOW_MARKER} kèm lý do: cho qua, nhưng ĐƯỢC ĐẾM và in ra`, () => {
  const { problems, allowed } = scan(`  x.visibility = 'public'; // ${ALLOW_MARKER} bài kiểm chứng minh contract chặn`);
  assert.deepEqual(problems, []);
  assert.equal(allowed.length, 1);
  assert.match(allowed[0]!, /bài kiểm chứng minh contract chặn/);
});

test(`ÂM: ${ALLOW_MARKER} TRỐNG là vi phạm — một lối thoát không giải thích được là một lối thoát bị cấm`, () => {
  const { problems, allowed } = scan(`  x.visibility = 'public'; // ${ALLOW_MARKER}`);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /không có lý do/);
  assert.deepEqual(allowed, []);
});

// ── Phần hai: contract phải còn khoá ─────────────────────────────────────
// Đây là lỗ mà bài `tampered` của workshops/release/test/stub.test.ts KHÔNG
// bắt được: nó chứng minh contract từ chối `public`, không chứng minh
// contract chỉ nhận đúng MỘT giá trị.

test('const: "private" và enum một giá trị đều là khoá hợp lệ', () => {
  assert.equal(lockedToPrivate({ const: ALLOWED_VALUE }), true);
  assert.equal(lockedToPrivate({ enum: [ALLOWED_VALUE] }), true);
});

test('ÂM: nới const thành enum hai giá trị → CHẶN', () => {
  const schema = { properties: { publication: { properties: { visibility: { type: 'string', enum: ['private', 'public'] } } } } };
  const problems = contractLockProblems('c.json', schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /không còn khoá/);
  assert.match(problems[0]!, /irreversible/);
});

test('ÂM: nới sang enum ["private","unlisted"] → CHẶN — đúng ca 11/11 bài cũ bỏ lọt', () => {
  // Đo được chứ không suy luận: với enum ["private","public"] thì hai bài
  // `tampered` đang có ĐỎ, nhưng với "unlisted" chúng XANH cả — vì chúng
  // khoá một giá trị CẤM (`public`) thay vì khoá giá trị ĐƯỢC PHÉP, và
  // danh sách giá trị cấm không bao giờ đủ. `unlisted` là video ai có link
  // cũng xem được, tức I5 đã mất.
  const schema = { properties: { publication: { properties: { visibility: { enum: [ALLOWED_VALUE, 'unlisted'] } } } } };
  assert.equal(contractLockProblems('c.json', schema).length, 1);
});

test('ÂM: bỏ hẳn const, để trơ type: string → CHẶN', () => {
  const schema = { properties: { publication: { properties: { visibility: { type: 'string' } } } } };
  assert.equal(contractLockProblems('c.json', schema).length, 1);
});

test('tìm khoá ở BẤT KỲ độ sâu nào — không hardcode publication.visibility', () => {
  const schema = { properties: { a: { properties: { b: { properties: { privacyStatus: { type: 'string' } } } } } } };
  const problems = contractLockProblems('c.json', schema);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /privacyStatus/);
});

test('schema đúng thì im — không báo giả', () => {
  const schema = { properties: { publication: { properties: { visibility: { const: ALLOWED_VALUE } } } } };
  assert.deepEqual(contractLockProblems('c.json', schema), []);
});

// ── Đầu-cuối trên repo thật ──────────────────────────────────────────────

test('ĐẦU-CUỐI: repo thật đạt cả hai phần', () => {
  assert.deepEqual(allContractLockProblems(ROOT).problems, []);
  assert.deepEqual(scanVisibility(ROOT).problems, []);
});

test('ÂM: phép đo không được xanh vì chẳng đọc gì — phải thật sự quét được nguồn', () => {
  const result = scanVisibility(ROOT);
  assert.ok(result.filesScanned > 100, `mới quét ${result.filesScanned} file`);
  assert.ok(result.sites > 0, 'không tìm thấy chỗ đặt visibility nào — bộ quét đang mù');
  assert.ok(allContractLockProblems(ROOT).locked > 0, 'không contract nào được soát khoá');
});

test('ÂM: danh sách đứng ngoài phép quét bị khoá ở ĐÚNG file test của chính cổng này', () => {
  // Nới danh sách này là cách rẻ nhất để làm cổng im mà không gì đỏ — một
  // file `*.test.ts` thêm vào đây đủ để giấu một đường tải lên thật.
  assert.deepEqual([...SCAN_EXCLUDED], ['ops/test/check-visibility.test.ts']);
});

test('contract release thật khoá visibility, đọc từ đĩa chứ không từ lời khai', () => {
  const { problems, locked } = allContractLockProblems(ROOT);
  assert.deepEqual(problems, []);
  assert.equal(locked, 1);
});
