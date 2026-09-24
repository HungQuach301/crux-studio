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
  assert.equal(v.character, 'Calm, precise, warm analyst');
  assert.equal(v.accent, 'General American');
  assert.equal(v.perceivedAgeRange, '30-45');
  assert.deepEqual([...v.genderCandidates].sort(), ['female', 'male']);
  assert.deepEqual(v.paceWpm.default, [150, 160]);
  assert.deepEqual(v.paceWpm.keyFigures, [130, 140]);
  assert.equal(v.originPreference, 'designed');
  assert.equal(v.changeIsIrreversible, true);
});

test('AU-006 · ba điều cấm của nhân vật khớp NGUYÊN chuỗi, không khớp chuỗi con', () => {
  // Khớp chuỗi con là chữ ký `KF-023`: "hype is fine, embrace hype" vẫn chứa
  // chữ `hype`, nên một phủ định lật ngược vẫn lọt qua. `deepEqual` đóng lỗ đó.
  assert.deepEqual(voiceSpec().mustNot, [
    'no hype',
    'no claim of certified expertise',
    'no impersonation of a real person',
  ]);
});

test('AU-006 · ba luật ngữ điệu khớp NGUYÊN chuỗi, cùng lý do `KF-023`', () => {
  assert.deepEqual(voiceSpec().prosody, [
    'falling intonation at sentence end',
    'stress the numbers',
    'pause before the reveal number',
  ]);
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
  assert.ok(doc.includes('158'), 'Phải dẫn `[QĐ]` #158 — spec này là câu trả lời thay cho nó.');
});

test('AU-006 · bảng trong `voice-spec.md` KHÔNG trôi khỏi `voiceSpec` của `channel.json`', () => {
  // File đó tự khai là "bản người đọc" của giá trị máy. Người đọc một bảng sai
  // trong khi máy đọc giá trị đúng là đúng nhóm Z: hỏng mà không gì đỏ.
  const doc = readFileSync(join(packDir, 'voice-spec.md'), 'utf8');
  const v = voiceSpec();
  const mustAppear = [
    v.character,
    v.accent,
    v.perceivedAgeRange.replace('-', '–'),
    v.originPreference,
    `${v.paceWpm.default[0]}–${v.paceWpm.default[1]}`,
    `${v.paceWpm.keyFigures[0]}–${v.paceWpm.keyFigures[1]}`,
  ];
  for (const value of mustAppear) {
    assert.ok(doc.includes(value), `Bảng người đọc thiếu giá trị máy "${value}".`);
  }
});
