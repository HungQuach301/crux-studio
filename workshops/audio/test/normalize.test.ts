/**
 * Bộ chuẩn hoá cho giọng đọc (mục `audio/AU-007`, kiến trúc (a)).
 *
 * Hai điều mục này phải chứng minh, và cả hai kiểm bằng VĂN BẢN THẬT của tập
 * vàng, không bằng ví dụ tự bịa (tiêu chí xong của AU-007):
 *  1. Mỗi luật trong bảng đọc có một ca kiểm, và ca kiểm đó ĐẠT — nếu không,
 *     một luật sai nằm im mà không gì đỏ.
 *  2. Bộ chuẩn hoá KHÔNG cần nhà cung cấp: nó chạy khi `providers.tts` còn
 *     `null` (Đợt 0).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readingRulesFor, loadChannelPack } from '@crux/kernel';
import { normalizeForSpeech } from '../src/normalize.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHANNEL = 'us-personal-finance';
const rules = readingRulesFor(ROOT, CHANNEL);

/** Lời thoại thật của tập vàng — không bịa ví dụ. */
function goldenScript(): string {
  const path = join(ROOT, 'ops', 'golden', 'ep-0001-stub', 'snapshots', 'editorial.json');
  const artifact = JSON.parse(readFileSync(path, 'utf8')) as { payload: { script: { text: string } } };
  return artifact.payload.script.text;
}

test('mỗi luật trong bảng đọc có ca kiểm và ca kiểm đó đạt', () => {
  assert.ok(rules.length > 0, 'bảng đọc rỗng');
  for (const rule of rules) {
    assert.ok(rule.test && typeof rule.test.input === 'string', `luật ${rule.id} thiếu test.input`);
    assert.equal(
      normalizeForSpeech(rule.test.input, [rule]),
      rule.test.expected,
      `luật ${rule.id}: "${rule.test.input}" phải ra "${rule.test.expected}"`,
    );
  }
});

test('chuẩn hoá lời thoại thật của tập vàng — "US" thành "U.S.", "United States" giữ nguyên', () => {
  const original = goldenScript();
  assert.match(original, /\bUS\b/, 'tiền đề: lời thoại tập vàng phải có "US" đứng riêng để có gì mà chuẩn hoá');

  const spoken = normalizeForSpeech(original, rules);

  assert.notEqual(spoken, original, 'bộ chuẩn hoá phải biến đổi lời thoại thật, không để nguyên');
  assert.ok(spoken.includes('U.S. household'), `"US household" phải thành "U.S. household" — ${spoken}`);
  assert.ok(spoken.includes('U.S. federal filers'), `"US federal filers" phải thành "U.S. federal filers"`);
  assert.ok(spoken.includes('In the United States'), '"United States" không được đụng tới');
  assert.ok(!/\bUS\b/.test(spoken), 'không còn "US" đứng riêng sau khi chuẩn hoá');
});

test('bộ chuẩn hoá chạy được khi providers.tts còn null', () => {
  const pack = loadChannelPack(ROOT, CHANNEL) as { providers?: { tts?: unknown } };
  assert.equal(pack.providers?.tts ?? null, null, 'tiền đề Đợt 0: providers.tts phải là null');
  // Không truyền provider nào; bộ chuẩn hoá chỉ nhận văn bản và luật.
  const out = normalizeForSpeech('save into your 401(k) now', rules);
  assert.equal(out, 'save into your four oh one k now');
});
