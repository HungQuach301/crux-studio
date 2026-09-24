/**
 * Mục `audio/AU-006` — spec giọng đọc của chủ dự án nằm trong Channel Pack và
 * không được trôi đi trong im lặng.
 *
 * Vì sao cần bài kiểm chứ không chỉ cần file: spec này tới từ **một comment**
 * trên issue bản tin (#193, `2026-09-23T14:18:09Z`). Comment không phải nguồn
 * mà `pnpm check` đọc được, nên nếu một lượt sau sửa lệch một con số trong
 * `channel.json` thì không gì đỏ — đúng nhóm **Z** của `ops/known-failures.md`.
 * Bài này là chỗ duy nhất buộc `channel.json` khớp đúng chữ của chủ dự án.
 *
 * Bài cũng khoá **chiều ngược**: `ttsVoiceId` và `providers.tts` phải còn
 * `null`. Lưu spec KHÔNG phải chọn giọng — chọn là quyết định `irreversible`
 * (CHARTER 2.3 nhóm 3) và phụ thuộc giả định **G7**. Thiếu vế này thì một lượt
 * sau có thể đọc "spec đã có" thành "được phép điền giọng vào".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const slug = 'us-personal-finance';
const packDir = join(root, 'packs', 'channels', slug);

interface VoiceSpec {
  character: string;
  mustNot: string[];
  accent: string;
  perceivedAgeRange: string;
  genderCandidates: string[];
  paceWpm: { default: [number, number]; keyFigures: [number, number] };
  prosody: string[];
  originPreference: string;
  changeIsIrreversible: boolean;
}

function channelPack(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(packDir, 'channel.json'), 'utf8')) as Record<string, unknown>;
}

function voiceSpec(): VoiceSpec {
  const spec = channelPack()['voiceSpec'];
  assert.ok(spec !== undefined, '`channel.json` phải có khoá `voiceSpec` (mục AU-006).');
  return spec as VoiceSpec;
}

test('AU-006 · `voiceSpec` khớp đúng chữ của chủ dự án trên #193', () => {
  const v = voiceSpec();
  assert.equal(v.accent, 'General American');
  assert.equal(v.perceivedAgeRange, '30-45');
  assert.deepEqual([...v.genderCandidates].sort(), ['female', 'male']);
  assert.deepEqual(v.paceWpm.default, [150, 160]);
  assert.deepEqual(v.paceWpm.keyFigures, [130, 140]);
  assert.equal(v.originPreference, 'designed');
  assert.equal(v.changeIsIrreversible, true);
});

test('AU-006 · ba điều cấm của nhân vật có đủ, không rút bớt điều nào', () => {
  const v = voiceSpec();
  assert.equal(v.mustNot.length, 3, 'Chủ dự án nêu đúng ba điều cấm.');
  for (const needle of ['hype', 'certified expertise', 'impersonation']) {
    assert.ok(
      v.mustNot.some((line) => line.includes(needle)),
      `Thiếu điều cấm chứa "${needle}".`,
    );
  }
});

test('AU-006 · ba luật ngữ điệu có đủ', () => {
  const v = voiceSpec();
  assert.equal(v.prosody.length, 3);
  for (const needle of ['falling intonation', 'stress the numbers', 'pause before']) {
    assert.ok(
      v.prosody.some((line) => line.includes(needle)),
      `Thiếu luật ngữ điệu chứa "${needle}".`,
    );
  }
});

test('AU-006 · tốc độ ở số liệu chính CHẬM hơn tốc độ mặc định', () => {
  const v = voiceSpec();
  assert.ok(
    v.paceWpm.keyFigures[1] < v.paceWpm.default[0],
    'Hai dải phải tách hẳn nhau: 130–140 nằm trọn dưới 150–160.',
  );
});

test('AU-006 · lưu spec KHÔNG lấp `ttsVoiceId` hay `providers.tts` (G7, CHARTER 2.3 nhóm 3)', () => {
  const pack = channelPack();
  assert.equal(pack['ttsVoiceId'], null, 'Chọn giọng là quyết định `irreversible` của chủ dự án.');
  const providers = pack['providers'] as Record<string, unknown>;
  assert.equal(providers['tts'], null, 'Chọn nhà cung cấp là quyết định `irreversible`.');
});

test('AU-006 · `voice-spec.md` dẫn đúng nguồn, và nói ai giữ phần còn lại của chỉ dẫn', () => {
  const doc = readFileSync(join(packDir, 'voice-spec.md'), 'utf8');
  assert.ok(doc.startsWith('# 🤖 '), 'Tài liệu agent viết mở đầu bằng 🤖 (CLAUDE.md mục 5).');
  assert.ok(doc.includes('2026-09-23T14:18:09Z'), 'Phải dẫn đúng comment nguồn, không dẫn chung chung.');
  assert.ok(doc.includes('issues/193'), 'Phải dẫn link issue bản tin #193.');
  for (const item of ['AU-007', 'AU-008', 'T-013']) {
    assert.ok(doc.includes(item), `Phần còn lại của chỉ dẫn phải có mục giữ: thiếu ${item}.`);
  }
});
