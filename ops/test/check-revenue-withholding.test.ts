/**
 * Mục `topic/T-013` — cổng khấu trừ doanh thu.
 *
 * Ba tiêu chí xong được canh ở đây bằng logic thuần:
 *  1. Khối `revenueWithholding` đúng hình dạng (rate/market + lý do/ngày/nguồn).
 *  2. Đường áp hệ số trả về CẢ trước lẫn sau khấu trừ, đúng số học.
 *  3. **Bài đỏ khi có chỗ ước tính doanh thu bỏ qua hệ số** — bằng chứng cái
 *     bẫy thật sự bắt được, không phải một cổng luôn xanh.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanRevenueSites,
  withholdingBlockProblems,
  type ScanFile,
} from '../scripts/check-revenue-withholding.ts';
import { readRevenueWithholding, applyRevenueWithholding } from '@crux/kernel';

const goodBlock = (): Record<string, unknown> => ({
  revenueWithholding: {
    $reason: 'Mỹ–Việt Nam chưa có hiệp định thuế có hiệu lực.',
    $asOf: '2026-09-24',
    $source: 'Chỉ dẫn chủ dự án #193; topic/T-013.',
    market: 'US',
    usSourcedRate: 0.3,
  },
});

test('T-013 · khối `revenueWithholding` đúng hình dạng thì không có vấn đề', () => {
  assert.deepEqual(withholdingBlockProblems('pack', goodBlock()), []);
});

test('T-013 · thiếu khối → đỏ', () => {
  const problems = withholdingBlockProblems('pack', {});
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /thiếu khối `revenueWithholding`/);
});

test('T-013 · rate ngoài (0,1) → đỏ, mỗi giá trị biên', () => {
  for (const rate of [0, 1, -0.1, 1.5, Number.NaN, '0.3']) {
    const pack = goodBlock();
    (pack['revenueWithholding'] as Record<string, unknown>)['usSourcedRate'] = rate;
    assert.ok(
      withholdingBlockProblems('pack', pack).some((p) => /usSourcedRate/.test(p)),
      `rate ${JSON.stringify(rate)} phải bị bắt`,
    );
  }
});

test('T-013 · thiếu lý do/ngày/nguồn → đỏ (bất biến I6: có nguồn)', () => {
  for (const key of ['$reason', '$asOf', '$source']) {
    const pack = goodBlock();
    delete (pack['revenueWithholding'] as Record<string, unknown>)[key];
    assert.ok(
      withholdingBlockProblems('pack', pack).some((p) => p.includes(key)),
      `thiếu ${key} phải bị bắt`,
    );
  }
});

test('T-013 · `$asOf` không phải ngày ISO → đỏ', () => {
  const pack = goodBlock();
  (pack['revenueWithholding'] as Record<string, unknown>)['$asOf'] = '24/09/2026';
  assert.ok(withholdingBlockProblems('pack', pack).some((p) => /\$asOf/.test(p)));
});

test('T-013 · market rỗng → đỏ', () => {
  const pack = goodBlock();
  (pack['revenueWithholding'] as Record<string, unknown>)['market'] = '   ';
  assert.ok(withholdingBlockProblems('pack', pack).some((p) => /market/.test(p)));
});

test('T-013 · dò bẫy: file ước tính doanh thu KHÔNG qua hệ số → đỏ', () => {
  const files: ScanFile[] = [
    { path: 'workshops/x/src/estimate.ts', content: 'const monthlyRevenueUsd = rpm * views;\n' },
  ];
  const problems = scanRevenueSites(files);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /monthlyRevenueUsd/);
  assert.match(problems[0]!, /workshops\/x\/src\/estimate\.ts:1/);
});

test('T-013 · dò bẫy: cùng file NHƯNG có đi qua hệ số → xanh', () => {
  const files: ScanFile[] = [
    {
      path: 'workshops/x/src/estimate.ts',
      content:
        "import { applyRevenueWithholding } from '@crux/kernel';\n" +
        'const grossRevenueUsd = rpm * views;\n' +
        'const net = applyRevenueWithholding(grossRevenueUsd, w);\n',
    },
  ];
  assert.deepEqual(scanRevenueSites(files), []);
});

test('T-013 · dò bẫy: định danh không phải doanh thu (…Usd khác) KHÔNG bị bắt', () => {
  const files: ScanFile[] = [
    { path: 'workshops/topic/src/models.ts', content: 'const endingBalanceUsd = x;\nconst monthlyBenefitUsd = y;\n' },
  ];
  assert.deepEqual(scanRevenueSites(files), []);
});

test('T-013 · nhiều chỗ ước tính trong một file đều bị liệt kê', () => {
  const files: ScanFile[] = [
    {
      path: 'a.ts',
      content: 'const adRevenueUsd = 1;\nconst affiliateRevenueUsd = 2;\n',
    },
  ];
  assert.equal(scanRevenueSites(files).length, 2);
});

test('T-013 · helper áp hệ số trả về CẢ trước lẫn sau khấu trừ', () => {
  const w = readRevenueWithholding({ slug: 's', genre: 'g', locale: 'en-US', ...goodBlock() });
  assert.equal(w.rate, 0.3);
  assert.equal(w.market, 'US');
  const r = applyRevenueWithholding(1000, w);
  assert.equal(r.grossUsd, 1000);
  assert.equal(r.withholdingRate, 0.3);
  assert.ok(Math.abs(r.netUsd - 700) < 1e-9, 'net = gross × (1 − 0,30)');
  assert.equal(r.market, 'US');
});

test('T-013 · gross âm hoặc không hữu hạn → ném, không trả số rác', () => {
  const w = { rate: 0.3, market: 'US' };
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => applyRevenueWithholding(bad, w), /grossUsd/);
  }
});

test('T-013 · readRevenueWithholding ném khi thiếu khối hoặc rate sai', () => {
  assert.throws(() => readRevenueWithholding({ slug: 's', genre: 'g', locale: 'en-US' }), /thiếu khối/);
  assert.throws(
    () =>
      readRevenueWithholding({
        slug: 's',
        genre: 'g',
        locale: 'en-US',
        revenueWithholding: { market: 'US', usSourcedRate: 1.2 },
      }),
    /usSourcedRate/,
  );
});
