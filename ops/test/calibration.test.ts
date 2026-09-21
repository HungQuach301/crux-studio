import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAllPairs,
  issueBody,
  issueTitle,
  tally,
  effectiveLines,
  readLog,
  GATE_MIN_PAIRS,
  GATE_MIN_AGREEMENT,
  type LogLine,
} from '../scripts/calibration.ts';

const AT = '2026-09-20T00:00:00.000Z';

function line(pairId: string, axis: string, choice: 'A' | 'B' | '=', auto?: 'A' | 'B' | '='): LogLine {
  return { at: AT, pairId, axis, choice, ...(auto ? { auto } : {}) };
}

test('mỗi cặp chỉ đổi ĐÚNG MỘT tham số — nếu không, lựa chọn không nói được gì', () => {
  const pairs = loadAllPairs();
  assert.ok(pairs.length >= 8, `mới có ${pairs.length} cặp`);
  for (const pair of pairs) {
    const a = Object.keys(pair.variantA.params);
    const b = Object.keys(pair.variantB.params);
    assert.equal(a.length, 1, `${pair.id}: variantA đổi ${a.length} tham số`);
    assert.deepEqual(a, b, `${pair.id}: A và B không đổi cùng một tham số`);
    assert.notEqual(
      pair.variantA.params[a[0]!],
      pair.variantB.params[b[0]!],
      `${pair.id}: A và B có cùng giá trị, không có gì để chọn`,
    );
  }
});

test('mỗi cặp thuộc một trục có trong khung tham chiếu', async () => {
  const { readFileSync } = await import('node:fs');
  const frame = readFileSync('docs/visual/reference-frame.md', 'utf8');
  for (const pair of loadAllPairs()) {
    assert.ok(frame.includes(`\`${pair.axis}\``), `trục "${pair.axis}" không có trong khung tham chiếu`);
  }
});

test('thân issue trả lời được trong 60 giây: ngắn, có đủ A, B và cách trả lời', () => {
  for (const pair of loadAllPairs()) {
    const body = issueBody(pair);
    assert.ok(body.startsWith('🤖'), `${pair.id}: thân issue phải bắt đầu bằng 🤖`);
    assert.match(body, /\*\*A\*\*/);
    assert.match(body, /\*\*B\*\*/);
    assert.match(body, /comment một chữ/);
    assert.ok(issueTitle(pair).startsWith('🤖 [Gu hình]'));

    // Phần trên <details> là phần chủ dự án phải đọc. Giữ nó ngắn.
    const visible = body.split('<details>')[0]!;
    assert.ok(visible.split('\n').length <= 20, `${pair.id}: phần hiển thị dài ${visible.split('\n').length} dòng`);
  }
});

test('chưa có ảnh thì issue nói thẳng ra, không giả vờ có', () => {
  for (const pair of loadAllPairs().filter((p) => p.renderRef === null)) {
    assert.match(issueBody(pair), /Chưa có ảnh/);
  }
});

test('độ nhất quán: gu rõ cho gần 1.0', () => {
  const rows = tally([
    line('m-1', 'motion', 'A'),
    line('m-2', 'motion', 'A'),
    line('m-3', 'motion', 'A'),
    line('m-4', 'motion', 'B'),
  ]);
  assert.equal(rows[0]?.consistency, 0.75);
  assert.equal(rows[0]?.answered, 4);
});

test('độ nhất quán gần 0.5 là một kết quả: trục đó không đáng làm cổng', () => {
  const rows = tally([
    line('h-1', 'hierarchy', 'A'),
    line('h-2', 'hierarchy', 'B'),
    line('h-3', 'hierarchy', 'A'),
    line('h-4', 'hierarchy', 'B'),
  ]);
  assert.equal(rows[0]?.consistency, 0.5);
  assert.equal(rows[0]?.gateReady, false);
});

test('"=" được đếm riêng, không kéo lệch độ nhất quán', () => {
  const rows = tally([
    line('t-1', 'text-density', 'A'),
    line('t-2', 'text-density', 'A'),
    line('t-3', 'text-density', '='),
  ]);
  assert.equal(rows[0]?.ties, 1);
  assert.equal(rows[0]?.consistency, 1);
});

test('cổng bộ chấm tự động cần ĐỦ CẢ hai: ≥90% trên ≥20 cặp (CHARTER 6.8c)', () => {
  const twentyAgreeing = Array.from({ length: GATE_MIN_PAIRS }, (_, i) =>
    line(`m-${i}`, 'motion', 'A', 'A'),
  );
  assert.equal(tally(twentyAgreeing)[0]?.gateReady, true);

  // Đủ số cặp nhưng trùng khớp thấp → chưa mở cổng.
  const twentyMixed = twentyAgreeing.map((l, i) =>
    i < 4 ? { ...l, auto: 'B' as const } : l,
  );
  const mixed = tally(twentyMixed)[0]!;
  assert.ok(mixed.autoAgreement! < GATE_MIN_AGREEMENT);
  assert.equal(mixed.gateReady, false);

  // Trùng khớp hoàn hảo nhưng mới 10 cặp → vẫn chưa mở cổng.
  assert.equal(tally(twentyAgreeing.slice(0, 10))[0]?.gateReady, false);
});

test('log append-only: dòng đính chính thay dòng cũ, không xoá dòng nào', () => {
  const lines: LogLine[] = [
    line('m-1', 'motion', 'A'),
    { at: AT, pairId: 'm-1', axis: 'motion', choice: 'B', supersedes: 'm-1' },
  ];
  const effective = effectiveLines(lines);
  assert.equal(effective.length, 1);
  assert.equal(effective[0]?.choice, 'B');
  assert.equal(lines.length, 2, 'dòng cũ vẫn còn trong log');
});

test('đọc được log dạng JSONL', () => {
  const parsed = readLog(
    `${JSON.stringify(line('m-1', 'motion', 'A'))}\n\n${JSON.stringify(line('m-2', 'motion', 'B'))}\n`,
  );
  assert.equal(parsed.length, 2);
});
