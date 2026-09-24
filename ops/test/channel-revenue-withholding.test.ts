/**
 * Mục `topic/T-013` — hệ số khấu trừ doanh thu của kênh nằm trong Channel Pack
 * và khớp đúng chữ của chủ dự án.
 *
 * Vì sao cần bài này ngoài cổng `check-revenue-withholding`: cổng đó canh
 * *hình dạng* (rate trong (0,1), có nguồn) trên mọi kênh; bài này khoá đúng
 * *giá trị* mà chủ dự án ra lệnh — 30% cho thị trường Mỹ — tới từ **một comment**
 * trên issue bản tin (#193, `2026-09-23T14:18:09Z`). Comment không phải nguồn
 * `pnpm check` đọc được; nếu một lượt sau sửa lệch con số thì không gì đỏ nếu
 * thiếu bài này (đúng nhóm **Z** của `ops/known-failures.md`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChannelPack, readRevenueWithholding, applyRevenueWithholding } from '@crux/kernel';

const root = join(import.meta.dirname, '..', '..');
const slug = 'us-personal-finance';

test('T-013 · `revenueWithholding` khớp chỉ dẫn chủ dự án: 30%, thị trường Mỹ', () => {
  const pack = loadChannelPack(root, slug);
  const w = readRevenueWithholding(pack);
  assert.equal(w.rate, 0.3, 'Khấu trừ 30% — chữ của chủ dự án trên #193.');
  assert.equal(w.market, 'US');
});

test('T-013 · lý do ghi ngay tại chỗ khai hệ số, kèm ngày và nguồn', () => {
  const pack = loadChannelPack(root, slug) as Record<string, unknown>;
  const block = pack['revenueWithholding'] as Record<string, unknown>;
  assert.match(block['$reason'] as string, /hiệp định thuế/, 'Phải nói lý do: chưa có hiệp định thuế.');
  assert.match(block['$asOf'] as string, /^\d{4}-\d{2}-\d{2}$/, 'Ngày ISO để lúc hiệp định đổi thì tìm ra.');
  assert.match(block['$source'] as string, /193/, 'Phải dẫn issue bản tin #193 — nguồn của con số.');
});

test('T-013 · một ước tính gộp $1000 hiển thị ra $700 sau khấu trừ', () => {
  const w = readRevenueWithholding(loadChannelPack(root, slug));
  const r = applyRevenueWithholding(1000, w);
  assert.equal(r.grossUsd, 1000);
  assert.ok(Math.abs(r.netUsd - 700) < 1e-9);
});

test('T-013 · bảng người đọc trong `voice-spec.md` không trôi khỏi giá trị máy', () => {
  // voice-spec.md đã có một dòng chỉ T-013 giữ việc khấu trừ; giữ nó khớp con số.
  const doc = readFileSync(join(root, 'packs', 'channels', slug, 'voice-spec.md'), 'utf8');
  assert.ok(doc.includes('30%'), 'Bảng người đọc phải nói đúng con số 30%.');
  assert.ok(doc.includes('T-013'), 'Phải chỉ mục giữ việc khấu trừ.');
});
