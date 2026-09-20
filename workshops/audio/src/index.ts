/**
 * Xưởng Âm thanh (S11–S11b) — bản STUB của Đợt 0.
 *
 * Sinh mốc thời gian từng từ và con trỏ tới file âm thanh, phụ đề. File nhị
 * phân KHÔNG commit (CHARTER 5.3): `audioRef` và `captionsRef` là con trỏ,
 * không phải đường dẫn trong repo.
 *
 * `commercialLicenseVerified: false` ở stub là đúng và cố ý: giả định G7 về
 * điều khoản thương mại của nhà cung cấp giọng đọc CHƯA được kiểm. Làn
 * `audio` phải kiểm rồi mới được đặt true, kèm một dòng trong license ledger.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';

export interface AudioPayload {
  audioRef: string;
  captionsRef: string;
  totalMs: number;
  loudnessLufs: number;
  captionDriftMaxMs: number;
  words: { text: string; startMs: number; endMs: number }[];
  voice: { provider: string; voiceId: string; commercialLicenseVerified: boolean };
}

interface EditorialShape {
  script: { text: string; wordCount: number };
  outline: { beats: { estimatedMs: number }[] };
}

const MS_PER_WORD = 380;

async function produce(input: WorkshopInput, ctx: RunContext): Promise<AudioPayload> {
  const editorial = (input.upstream.editorial as Envelope<EditorialShape>).payload;
  const tokens = editorial.script.text.split(/\s+/).filter(Boolean);

  let cursor = 0;
  const words = tokens.map((text) => {
    const startMs = cursor;
    // Từ dài đọc lâu hơn — đủ để mốc thời gian không đều một cách máy móc.
    const endMs = startMs + MS_PER_WORD + Math.min(text.length, 12) * 12;
    cursor = endMs + 40;
    return { text, startMs, endMs };
  });

  const totalMs = Math.max(cursor, 1000);

  return {
    audioRef: `artifact://${ctx.channel}/${ctx.episodeId}/audio/voice.wav`,
    captionsRef: `artifact://${ctx.channel}/${ctx.episodeId}/audio/captions.srt`,
    totalMs,
    loudnessLufs: -14,
    captionDriftMaxMs: 0,
    words,
    voice: {
      provider: 'stub',
      voiceId: 'stub-neutral-us',
      commercialLicenseVerified: false,
    },
  };
}

export const definition: WorkshopDefinition<AudioPayload> = {
  name: 'audio',
  version: '0.0.0-stub',
  consumes: ['editorial'],
  produce,
};
