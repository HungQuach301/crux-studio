/**
 * `ops/scripts/claim-collision.ts` — cơ chế của mục `platform/P-040`,
 * chữ ký `KF-025`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECENT_MERGE_MINUTES,
  claimCheck,
  claimKeyFromTitle,
  duplicateClaims,
  renderDuplicateClaims,
  unreadableTitles,
  type PrSnapshot,
} from '../scripts/claim-collision.ts';

function pr(overrides: Partial<PrSnapshot> & { number: number; title: string }): PrSnapshot {
  return { closedAt: null, merged: false, createdAt: '2026-09-24T00:00:00Z', ...overrides };
}

// ── Ca TÁI HIỆN LỖI: #221 và #222 (2026-09-24), cách nhau 89 giây ───────

const I020_COLLISION: PrSnapshot[] = [
  pr({
    number: 221,
    title: '[integration] I-020 — "dấu treo" là một trường `- hold:`, không còn dò chuỗi con',
    createdAt: '2026-09-24T03:40:00Z',
    closedAt: '2026-09-24T03:44:45Z',
    merged: true,
  }),
  pr({
    number: 222,
    title: '[integration] I-020 — "còn treo" là một trường, không phải một câu văn',
    createdAt: '2026-09-24T03:41:29Z',
  }),
];

test('tái hiện lỗi: hai PR cùng mục I-020 sống chồng nhau thì bị bắt', () => {
  const found = duplicateClaims(I020_COLLISION);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], {
    claim: 'integration/I-020',
    first: 221,
    second: 222,
    minutesApart: 1.48,
    firstMerged: true,
  });
});

test('tái hiện lỗi: lượt worker thứ hai hỏi claimCheck lúc 03:41 thì thấy #221 đang mở', () => {
  // Ảnh chụp đúng lúc lượt sau sắp push: #221 còn mở.
  const atPushTime = I020_COLLISION.map((p) =>
    p.number === 221 ? { ...p, closedAt: null, merged: false } : p,
  ).filter((p) => p.number === 221);
  const verdict = claimCheck(atPushTime, 'integration', 'I-020', '2026-09-24T03:41:29Z');
  assert.deepEqual(verdict, { claim: 'integration/I-020', verdict: 'open-pr', prs: [221] });
});

test('tái hiện lỗi: sau khi #221 merge, mục vẫn không "free" trong cửa sổ ân hạn', () => {
  const merged = I020_COLLISION.filter((p) => p.number === 221);
  const verdict = claimCheck(merged, 'integration', 'I-020', '2026-09-24T03:50:00Z');
  assert.deepEqual(verdict, { claim: 'integration/I-020', verdict: 'recently-merged', prs: [221] });
});

// ── Sóng nối tiếp KHÔNG phải va chạm ────────────────────────────────────

test('sóng nối tiếp của P-014 không bị báo: PR sau ra đời khi PR trước đã đóng', () => {
  const waves = [
    pr({
      number: 196,
      title: '[platform] P-014 — sóng 3 nhóm Z: nhịp tim theo từng làn (Z7)',
      createdAt: '2026-09-23T14:00:00Z',
      closedAt: '2026-09-24T03:41:38Z',
      merged: true,
    }),
    pr({
      number: 223,
      title: '[platform] P-014 — sóng 3 nhóm Z: cân đối log/merge theo làn (Z14)',
      createdAt: '2026-09-24T04:38:39Z',
    }),
  ];
  assert.deepEqual(duplicateClaims(waves), []);
});

test('sóng nối tiếp: mục đã merge lâu rồi thì claimCheck trả free', () => {
  const old = [
    pr({
      number: 196,
      title: '[platform] P-014 — sóng 3',
      createdAt: '2026-09-23T14:00:00Z',
      closedAt: '2026-09-24T03:41:38Z',
      merged: true,
    }),
  ];
  const justInside = claimCheck(old, 'platform', 'P-014', '2026-09-24T04:00:00Z');
  assert.equal(justInside.verdict, 'recently-merged');
  const wellAfter = claimCheck(old, 'platform', 'P-014', '2026-09-24T06:00:00Z');
  assert.deepEqual(wellAfter, { claim: 'platform/P-014', verdict: 'free', prs: [] });
});

test('cửa sổ ân hạn đo bằng RECENT_MERGE_MINUTES, không phải một số viết cứng', () => {
  const closedAt = '2026-09-24T03:00:00Z';
  const merged = [pr({ number: 9, title: '[kernel] K-009 — x', closedAt, merged: true })];
  const edge = new Date(Date.parse(closedAt) + RECENT_MERGE_MINUTES * 60_000).toISOString();
  assert.equal(claimCheck(merged, 'kernel', 'K-009', edge).verdict, 'recently-merged');
  const past = new Date(Date.parse(edge) + 60_000).toISOString();
  assert.equal(claimCheck(merged, 'kernel', 'K-009', past).verdict, 'free');
});

// ── Chữ ký lấy từ tiêu đề, không lấy từ tên nhánh ───────────────────────

test('claimKeyFromTitle: đọc được tiêu đề đúng quy ước, mọi kiểu gạch ngang', () => {
  assert.deepEqual(claimKeyFromTitle('[visual] V-001 — Genre pack phần hình'), {
    lane: 'visual',
    id: 'V-001',
  });
  assert.deepEqual(claimKeyFromTitle('[verify] VF-G12 – Ruleset'), { lane: 'verify', id: 'VF-G12' });
  assert.deepEqual(claimKeyFromTitle('  [release] R-001 - Chuyển phần phát hành  '), {
    lane: 'release',
    id: 'R-001',
  });
});

test('claimKeyFromTitle: làn lạ, thiếu dấu gạch, hay không có ngoặc vuông thì trả null', () => {
  assert.equal(claimKeyFromTitle('[platfrom] P-001 — sai chính tả tên làn'), null);
  assert.equal(claimKeyFromTitle('[platform] P-001 sửa gì đó'), null);
  assert.equal(claimKeyFromTitle('chore: sync workflows from ops/workflows'), null);
  assert.equal(claimKeyFromTitle(''), null);
});

test('mã mục phải đứng trọn: P-01 không khớp tiêu đề của P-014', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-014 — sóng 3', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 2, title: '[platform] P-01 — mục khác', createdAt: '2026-09-24T01:01:00Z' }),
  ];
  assert.deepEqual(duplicateClaims(prs), []);
});

test('cùng mã mục ở HAI làn khác nhau không phải va chạm', () => {
  const prs = [
    pr({ number: 1, title: '[kernel] K-002 — a', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 2, title: '[topic] K-002 — b', createdAt: '2026-09-24T01:01:00Z' }),
  ];
  assert.deepEqual(duplicateClaims(prs), []);
});

// ── Không bỏ qua im lặng ────────────────────────────────────────────────

test('tiêu đề không đọc được thì được ĐẾM và in ra, không biến mất', () => {
  const prs = [
    pr({ number: 1, title: '[platform] P-014 — sóng 3' }),
    pr({ number: 7, title: 'chore: sync workflows' }),
    pr({ number: 9, title: 'Mốc ân hạn của no-model-name dời sang lúc luật lên main' }),
  ];
  assert.deepEqual(unreadableTitles(prs), [7, 9]);
  assert.match(renderDuplicateClaims([], unreadableTitles(prs)), /#7 #9/);
});

test('mốc thời gian không đọc được thì thiên về BÁO, không về im lặng', () => {
  const prs = [
    pr({ number: 1, title: '[audio] AU-002 — a', createdAt: '2026-09-24T01:00:00Z', closedAt: 'hỏng', merged: true }),
    pr({ number: 2, title: '[audio] AU-002 — b', createdAt: '2026-09-24T09:00:00Z' }),
  ];
  assert.equal(duplicateClaims(prs).length, 1);
});

test('renderDuplicateClaims in cả khi 0 va chạm', () => {
  assert.match(renderDuplicateClaims([]), /Va chạm nhận mục: 0/);
});

test('renderDuplicateClaims nói rõ khi PR trước đã merge — đó là ca kẹt vĩnh viễn', () => {
  const text = renderDuplicateClaims(duplicateClaims(I020_COLLISION));
  assert.match(text, /integration\/I-020/);
  assert.match(text, /#221 ĐÃ MERGE/);
  assert.match(text, /#222/);
});

// ── Đầu vào rỗng và ca ba PR ────────────────────────────────────────────

test('đầu vào rỗng trả mảng rỗng, không ném', () => {
  assert.deepEqual(duplicateClaims([]), []);
  assert.deepEqual(unreadableTitles([]), []);
  assert.deepEqual(claimCheck([], 'topic', 'T-009', '2026-09-24T00:00:00Z'), {
    claim: 'topic/T-009',
    verdict: 'free',
    prs: [],
  });
});

test('ba PR cùng mục cùng sống chồng nhau cho ba cặp, sắp ổn định', () => {
  const prs = [
    pr({ number: 5, title: '[editorial] E-003 — a', createdAt: '2026-09-24T01:00:00Z' }),
    pr({ number: 6, title: '[editorial] E-003 — b', createdAt: '2026-09-24T01:05:00Z' }),
    pr({ number: 7, title: '[editorial] E-003 — c', createdAt: '2026-09-24T01:10:00Z' }),
  ];
  assert.deepEqual(
    duplicateClaims(prs).map((d) => [d.first, d.second]),
    [
      [5, 6],
      [5, 7],
      [6, 7],
    ],
  );
});

test('claimCheck: PR đang mở thắng PR vừa merge — không nhận là không nhận', () => {
  const prs = [
    pr({ number: 5, title: '[editorial] E-003 — a', closedAt: '2026-09-24T03:00:00Z', merged: true }),
    pr({ number: 6, title: '[editorial] E-003 — b' }),
  ];
  assert.deepEqual(claimCheck(prs, 'editorial', 'E-003', '2026-09-24T03:10:00Z'), {
    claim: 'editorial/E-003',
    verdict: 'open-pr',
    prs: [6],
  });
});
