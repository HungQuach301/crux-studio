/**
 * Xưởng Phát hành và đo lường (S15b–S19) — bản STUB của Đợt 0.
 *
 * BẤT BIẾN I5 nằm ngay trong contract: `publication.visibility` bị khoá ở
 * `"private"`. Máy không công khai video. Muốn nới phải sửa chính dòng đó
 * trong `kernel/contracts/release.payload.v0.schema.json`, tức là một PR
 * `owner-merge` cộng một quyết định `irreversible`.
 *
 * Bất biến I3: file này chỉ được import `@crux/kernel`.
 */

import type { WorkshopDefinition, WorkshopInput, RunContext, Envelope } from '@crux/kernel';

export interface ReleasePayload {
  package: {
    titles: { text: string; formula: string }[];
    thumbnails: { ref: string; accentWord: string; visualKind: string }[];
    description: string;
    sourceList: string[];
    modelSheetUrl: string;
    adBreaks: number[];
  };
  publication: {
    visibility: 'private';
    videoId: string | null;
    publishedAt: string | null;
    captionsUploaded: boolean;
    modelSheetPublished: boolean;
    quotaUnitsUsed: number;
  };
  disclosure: true;
  metricsPlan: ('48h' | '7d' | '28d')[];
}

interface TopicShape {
  selected: { question: string };
  claims: { id: string; evidence: { kind: string; ref: string } }[];
  modelRefs: string[];
}

interface EditorialShape {
  outline: { adBreaks: { atMs: number }[] };
}

interface AssemblyShape {
  qa: { verdict: 'pass' | 'fail' };
}

async function produce(input: WorkshopInput, ctx: RunContext): Promise<ReleasePayload> {
  const topic = (input.upstream.topic as Envelope<TopicShape>).payload;
  const editorial = (input.upstream.editorial as Envelope<EditorialShape>).payload;
  const assembly = (input.upstream.assembly as Envelope<AssemblyShape>).payload;

  const question = topic.selected.question.replace(/\?$/, '');
  const titles = [
    { text: `${question}?`.slice(0, 100), formula: 'question' },
    { text: `The point where the usual answer stops working`.slice(0, 100), formula: 'flip-point' },
    { text: `We ran the numbers across the whole range`.slice(0, 100), formula: 'method' },
  ];

  const description = [
    `${question}?`,
    '',
    'This episode maps the answer across the full parameter range instead of giving one number.',
    'Every figure on screen comes from a published source or from the model linked below, and the model sheet is public so you can change the inputs and check the result yourself.',
    '',
    'Scope: United States, federal filers. State rules move the crossover point.',
    '',
    'This video was produced with AI assistance.',
  ].join('\n');

  return {
    package: {
      titles,
      thumbnails: [
        { ref: `artifact://${ctx.channel}/${ctx.episodeId}/release/thumb-a.png`, accentWord: 'CROSSOVER', visualKind: 'chart' },
        { ref: `artifact://${ctx.channel}/${ctx.episodeId}/release/thumb-b.png`, accentWord: 'THRESHOLD', visualKind: 'matrix' },
      ],
      description,
      sourceList: topic.claims.map((c) => `${c.id}: ${c.evidence.kind}=${c.evidence.ref}`),
      modelSheetUrl: `https://github.com/HungQuach301/crux-models/blob/main/${ctx.genre}/${topic.modelRefs[0] ?? 'M-STUB-1'}.md`,
      adBreaks: editorial.outline.adBreaks.map((b) => b.atMs),
    },
    publication: {
      // I5 — máy chỉ tải lên riêng tư, kể cả khi QA đã xanh.
      visibility: 'private',
      videoId: null,
      publishedAt: null,
      captionsUploaded: assembly.qa.verdict === 'pass',
      modelSheetPublished: false,
      quotaUnitsUsed: 0,
    },
    // Rủi ro A3: nội dung tổng hợp phải được gắn nhãn.
    disclosure: true,
    metricsPlan: ['48h', '7d', '28d'],
  };
}

export const definition: WorkshopDefinition<ReleasePayload> = {
  name: 'release',
  version: '0.0.0-stub',
  consumes: ['topic', 'editorial', 'assembly'],
  produce,
};
