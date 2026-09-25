/**
 * Bài kiểm của `ops/scripts/novelty-embeddings-trial.ts` (mục `topic/T-014`).
 *
 * Chạy **trọn** phép đo — 38 video, 3 thesis, 16 cặp có nhãn, cả hai phép so
 * — bằng một nhà cung cấp **giả tất định**. Không một lời gọi mạng nào, nên
 * `pnpm check` không bao giờ tốn một đồng nào ở đây.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRIAL_SEMANTIC_THRESHOLD,
  embedTextFor,
  scoresFor,
  trialOneModel,
} from '../scripts/novelty-embeddings-trial.ts';
import type { EmbeddingModel, EmbeddingProvider, ProbePair } from '../../workshops/topic/src/embeddings.ts';
import type { Corpus, CorpusVideo } from '../../workshops/topic/src/corpus.ts';

const CORPUS_PATH = 'workshops/topic/data/corpus/us-personal-finance-2026-09-01.json';
const PROBE_PATH = 'workshops/topic/data/embeddings/novelty-probe.json';

const corpus = JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as Corpus;
const probe = JSON.parse(readFileSync(PROBE_PATH, 'utf8')) as {
  probeId: string;
  corpusId: string;
  theses: { id: string; statement: string }[];
  pairs: ProbePair[];
};

const MODEL: EmbeddingModel = { model: 'fake-small', usdPerMillionTokens: 0.02, dimensions: 3 };

/**
 * Nhà cung cấp giả: gán mỗi đoạn văn bản vào một trong ba cụm đề tài rồi trả
 * vector one-hot. Tất định, không mạng, và đủ để phép tách có hai nhóm thật.
 *
 * Nó KHÔNG mô phỏng chất lượng của một model thật — nó chỉ giữ cho đường đi
 * của `trialOneModel` chạy trọn. Số thật là việc của lần chạy có secret.
 */
function fakeProvider(usdPerMillionTokens = MODEL.usdPerMillionTokens): EmbeddingProvider {
  const bucketOf = (text: string): number => {
    const t = text.toLowerCase();
    if (/emergency fund|credit card debt|revolving balances|crossover/.test(t)) return 0;
    if (/high-yield|savings account|advertised rate|rate chase|savings between banks/.test(t)) return 1;
    return 2;
  };
  return {
    vendor: 'fake',
    model: MODEL.model,
    async embed(texts) {
      const vectors = texts.map((text) => {
        const v = [0, 0, 0];
        v[bucketOf(text)] = 1;
        return v;
      });
      const totalTokens = texts.length * 1000;
      return {
        model: MODEL.model,
        vectors,
        usage: { totalTokens, costUsd: (totalTokens / 1_000_000) * usdPerMillionTokens },
      };
    },
  };
}

test('tập thăm dò gắn nhãn cho ĐÚNG corpus đang chạy, và mọi videoId có thật', () => {
  assert.equal(probe.corpusId, corpus.corpusId);
  const ids = new Set(corpus.videos.map((v) => v.videoId));
  const thesisIds = new Set(probe.theses.map((t) => t.id));
  for (const pair of probe.pairs) {
    assert.ok(ids.has(pair.videoId), `cặp trỏ tới video ngoài corpus: ${pair.videoId}`);
    assert.ok(thesisIds.has(pair.thesisId), `cặp trỏ tới thesis lạ: ${pair.thesisId}`);
  }
  assert.ok(probe.pairs.some((p) => p.sameTopic), 'phải có nhóm cùng chuyện');
  assert.ok(probe.pairs.some((p) => !p.sameTopic), 'phải có nhóm khác chuyện');
});

test('embedTextFor ghép tiêu đề với mô tả, và không để lại khoảng trắng thừa khi thiếu mô tả', () => {
  const video = corpus.videos[0];
  assert.ok(video, 'corpus mẫu phải có ít nhất một video');
  assert.match(embedTextFor(video), new RegExp(video.title.slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const noDescription = { ...video, description: undefined } as CorpusVideo;
  assert.equal(embedTextFor(noDescription), video.title);
});

test('scoresFor: số video và số vector lệch nhau thì NÉM, không ghép cặp mù', () => {
  assert.throws(() => scoresFor([1, 0, 0], corpus.videos, [[1, 0, 0]]), /không ghép cặp được/);
});

test('trialOneModel chạy trọn 38 video ngoại tuyến: có biên tách, có costUsd, có dòng so sánh', async () => {
  const result = await trialOneModel(
    fakeProvider(),
    MODEL,
    corpus,
    probe,
    '2026-09-25T02:00:00.000Z',
  );

  // Nhà cung cấp giả tách sạch ba cụm, nên biên phải là 1 (cùng cụm cos=1, khác cụm cos=0).
  assert.equal(result.candidate.separation.adequate, true);
  assert.ok(Math.abs(result.candidate.separation.margin - 1) < 1e-9);

  // Hai lần nhúng: 38 video + 3 thesis, 1000 token mỗi đoạn theo nhà cung cấp giả.
  assert.equal(result.totalTokens, (corpus.videos.length + probe.theses.length) * 1000);
  assert.ok(Math.abs(result.costUsd - (result.totalTokens / 1_000_000) * MODEL.usdPerMillionTokens) < 1e-12);

  assert.equal(result.lines.length, probe.theses.length);
  for (const line of result.lines) {
    assert.match(line, /từ vựng/);
    assert.match(line, /ngữ nghĩa/);
  }
});

test('phép đo bày ra được chỗ hỏng mà T-014 sinh ra để chữa: thesis viết khác chữ', async () => {
  const result = await trialOneModel(
    fakeProvider(),
    MODEL,
    corpus,
    probe,
    '2026-09-25T02:00:00.000Z',
  );
  const paraphrase = result.lines.find((l) => l.includes('th-paraphrase'));
  assert.ok(paraphrase, 'tập thăm dò phải còn thesis viết khác chữ');
  // So từ vựng không thấy video nào; so ngữ nghĩa thấy ba. Verdict KHÔNG đổi
  // (3 vẫn dưới ngưỡng đông 8), nên dấu đúng là `±` chứ không phải `≠` — và
  // dòng vẫn phải nói ra chỗ lệch, không được im như hai phép so bằng nhau.
  assert.match(paraphrase, /±/);
  assert.match(paraphrase, /từ vựng\s+novel-in-corpus\s+similar= 0/);
  assert.match(paraphrase, /ngữ nghĩa\s+novel-in-corpus\s+similar= 3/);
});

test('ngưỡng cosine của lần chạy thử là một hằng số KHAI RA, không nằm rải trong code', () => {
  assert.ok(TRIAL_SEMANTIC_THRESHOLD > 0 && TRIAL_SEMANTIC_THRESHOLD < 1);
});
