/**
 * `ops/scripts/check-fact-risk.ts` — Fact & Risk Pass (spec S05), nơi bất biến
 * **I6** được thực thi ở tầng biên tập (mục `editorial/E-002`).
 *
 * Bài quan trọng nhất là bài **tái hiện lỗi (bất biến I2)**: trước mục này,
 * payload v0 để lỏng (CHARTER 5.2) nên một kịch bản mang con số KHÔNG truy được
 * về claimId nào vẫn hợp contract và lọt `pnpm contracts`. Bài `I6 …` dưới đây
 * dựng đúng ca đó và đòi cổng mới bắt được.
 *
 * Bài nghiệm thu của spec S05 ("gieo 3 claim/con số sai cố ý, phải bắt được cả
 * 3") ở bài `gieo ba con số sai`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  factRiskProblems,
  episodeFactRiskProblems,
  numericTokens,
  normalizeNumber,
  isStubArtifact,
  type FactRiskClaim,
} from '../scripts/check-fact-risk.ts';

const claim = (id: string, statement: string, kind = 'model', ref = 'M-1'): FactRiskClaim => ({
  id,
  statement,
  evidence: { kind, ref },
});

test('normalizeNumber bỏ $ và dấu phẩy ngăn nghìn, giữ thập phân và %', () => {
  assert.equal(normalizeNumber('$4,300'), '4300');
  assert.equal(normalizeNumber('1,250.5'), '1250.5');
  assert.equal(normalizeNumber('12%'), '12%');
  assert.equal(normalizeNumber('7'), '7');
});

test('numericTokens bắt số có $, phẩy, thập phân, %, không nuốt dấu lẻ', () => {
  assert.deepEqual(numericTokens('Trả $4,300 mỗi năm, tăng 12% so với 3.5 lần.'), [
    '4300',
    '12%',
    '3.5',
  ]);
  assert.deepEqual(numericTokens('Không có số nào ở đây.'), []);
});

test('con số truy được về claim ĐƯỢC TRÍCH thì không báo', () => {
  const problems = factRiskProblems({
    script: { text: 'The crossover sits at $4,300 for a US household.', claimIds: ['C1'] },
    claims: [claim('C1', 'The crossover point is $4,300 under the model.')],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  assert.deepEqual(problems, []);
});

test('I6: con số không truy được về claimId thì báo untraceable-number', () => {
  // Payload v0 để lỏng nên artifact này vốn HỢP contract — chỉ cổng này bắt được.
  const problems = factRiskProblems({
    script: { text: 'The crossover sits at $4,300.', claimIds: ['C1'] },
    claims: [claim('C1', 'The crossover point moves with the first parameter.')],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  assert.deepEqual(
    problems.map((p) => p.code),
    ['untraceable-number'],
  );
  assert.match(problems[0]!.detail, /4300/);
});

test('S05 nghiệm thu: gieo ba con số sai cố ý, bắt được cả ba', () => {
  const problems = factRiskProblems({
    script: {
      text: 'Fees run $4,300, rates hit 12%, and the cutoff is 2031.',
      claimIds: ['C1'],
    },
    claims: [claim('C1', 'The model has one parameter with no numbers cited here.')],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  const untraceable = problems.filter((p) => p.code === 'untraceable-number');
  assert.equal(untraceable.length, 3);
  const detail = untraceable.map((p) => p.detail).join(' ');
  for (const n of ['4300', '12%', '2031']) assert.match(detail, new RegExp(n.replace('%', '%')));
});

test('mỗi con số untraceable chỉ báo MỘT lần dù lặp trong lời thoại', () => {
  const problems = factRiskProblems({
    script: { text: 'It is 2031. Again in 2031. Still 2031.', claimIds: [] },
    claims: [],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  assert.equal(problems.filter((p) => p.code === 'untraceable-number').length, 1);
});

test('claim được trích nhưng không tồn tại trong vũ trụ claim thì báo dangling-claim', () => {
  const problems = factRiskProblems({
    script: { text: 'No numbers.', claimIds: ['C9'] },
    claims: [claim('C1', 'Present.')],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  assert.deepEqual(
    problems.map((p) => p.code),
    ['dangling-claim'],
  );
});

test('claim thiếu bằng chứng source|model + ref thì báo claim-missing-evidence (I6)', () => {
  const noKind: FactRiskClaim = { id: 'C1', statement: 'x', evidence: { ref: 'R' } };
  const noRef: FactRiskClaim = { id: 'C2', statement: 'y', evidence: { kind: 'model' } };
  const badKind: FactRiskClaim = { id: 'C3', statement: 'z', evidence: { kind: 'vibes', ref: 'R' } };
  const problems = factRiskProblems({
    script: { text: 'No numbers.', claimIds: ['C1', 'C2', 'C3'] },
    claims: [noKind, noRef, badKind],
    counterClaimCount: 2,
    counterClaimsMin: 2,
  });
  assert.equal(problems.filter((p) => p.code === 'claim-missing-evidence').length, 3);
});

test('số phản biện dưới ngưỡng genre pack thì báo counterclaims-short, đủ thì không', () => {
  const base = {
    script: { text: 'No numbers.', claimIds: [] as string[] },
    claims: [] as FactRiskClaim[],
    counterClaimsMin: 2,
  };
  assert.deepEqual(
    factRiskProblems({ ...base, counterClaimCount: 1 }).map((p) => p.code),
    ['counterclaims-short'],
  );
  assert.deepEqual(factRiskProblems({ ...base, counterClaimCount: 2 }), []);
});

test('episodeFactRiskProblems: artifact stub tập vàng chỉ thiếu phản biện, không có số lạc', () => {
  const editorial = {
    genre: 'data-explainer',
    producer: { impl: 'stub' },
    payload: {
      script: {
        text: 'In the US, the crossover moves with parameter 1 and parameter 2.',
        claimIds: ['C1', 'C2'],
      },
    },
  };
  const topic = {
    producer: { impl: 'stub' },
    payload: {
      claims: [
        claim('C1', 'the crossover point moves with parameter 1'),
        claim('C2', 'the crossover point moves with parameter 2'),
      ],
      // không có counterClaims — đúng hình dạng stub hiện tại
    },
  };
  const problems = episodeFactRiskProblems(editorial, topic, 2);
  assert.deepEqual(
    problems.map((p) => p.code),
    ['counterclaims-short'],
  );
  assert.equal(isStubArtifact(editorial), true);
  assert.equal(isStubArtifact({ producer: { impl: 'v1' } }), false);
});

test('episodeFactRiskProblems đếm counterClaims thật từ topic.payload.counterClaims', () => {
  const editorial = {
    genre: 'data-explainer',
    producer: { impl: 'v1' },
    payload: { script: { text: 'No numbers.', claimIds: [] } },
  };
  const topic = {
    producer: { impl: 'v1' },
    payload: { claims: [], counterClaims: [{ id: 'X1' }, { id: 'X2' }] },
  };
  assert.deepEqual(episodeFactRiskProblems(editorial, topic, 2), []);
});
