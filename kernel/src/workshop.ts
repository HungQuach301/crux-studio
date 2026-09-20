/**
 * Khung chạy chung của một xưởng (CHARTER 5.4).
 *
 * Mỗi xưởng chỉ khai bốn thứ: tên, phiên bản, `kind` nó tiêu thụ, và hàm
 * sinh payload. Phần còn lại — validate đầu vào, dựng phong bì, tính
 * `inputsHash`, validate đầu ra, ghi log có `costUsd` — do kernel làm, một
 * lần, giống nhau cho cả sáu xưởng.
 */

import {
  ENVELOPE_SCHEMA_VERSION,
  type ArtifactRef,
  type Envelope,
  type Impl,
  type WorkshopName,
} from './envelope.ts';
import { ARTIFACT_KIND, assertArtifact, isSupportedSchemaVersion } from './contracts.ts';
import { inputsHashOf, stableHash } from './hash.ts';
import { systemClock, type Clock } from './clock.ts';
import { Cassette } from './cassette.ts';

export interface EpisodeContext {
  episodeId: string;
  channel: string;
  genre: string;
  locale: string;
}

export interface RunContext extends EpisodeContext {
  clock: Clock;
  cassette: Cassette;
  impl: Impl;
}

export interface WorkshopInput {
  /** Artifact của các xưởng trước, theo tên xưởng. */
  upstream: Partial<Record<WorkshopName, Envelope>>;
  /** Cấu hình theo thể loại và theo kênh (packs/). */
  packs: Record<string, unknown>;
}

export interface WorkshopDefinition<P> {
  name: WorkshopName;
  version: string;
  /** Xưởng nào phải chạy xong trước. Đây là ranh giới, không phải gợi ý. */
  consumes: readonly WorkshopName[];
  produce(input: WorkshopInput, ctx: RunContext): Promise<P>;
}

function refOf(artifact: Envelope): ArtifactRef {
  return {
    kind: artifact.kind,
    path: `episodes/${artifact.channel}/${artifact.episodeId}/${artifact.producer.workshop}/artifact.json`,
    hash: stableHash(artifact.payload),
  };
}

/**
 * Chạy một xưởng: kiểm đầu vào, gọi `produce`, đóng phong bì, kiểm đầu ra.
 * Ném lỗi nếu thiếu đầu vào hoặc nếu đầu ra không khớp contract — contract
 * đi trước, không có stage nào được chạy ngoài contract của nó.
 */
export async function runWorkshop<P extends object>(
  definition: WorkshopDefinition<P>,
  input: WorkshopInput,
  ctx: RunContext,
): Promise<Envelope<P>> {
  for (const required of definition.consumes) {
    const upstream = input.upstream[required];
    if (!upstream) {
      throw new Error(
        `Xưởng ${definition.name} cần artifact của xưởng ${required} nhưng không có.`,
      );
    }
    if (!isSupportedSchemaVersion(upstream.schemaVersion)) {
      throw new Error(
        `Xưởng ${definition.name} không đọc được schemaVersion ${upstream.schemaVersion} ` +
          `của xưởng ${required}. Bên tiêu thụ hỗ trợ N và N-1 (CHARTER 5.2).`,
      );
    }
    if (upstream.status !== 'ok') {
      throw new Error(
        `Artifact của xưởng ${required} có status "${upstream.status}"; xưởng ${definition.name} không chạy tiếp.`,
      );
    }
  }

  const inputs = definition.consumes
    .map((name) => input.upstream[name])
    .filter((a): a is Envelope => a !== undefined)
    .map(refOf);

  const costBefore = ctx.cassette.costUsd;
  const payload = await definition.produce(input, ctx);
  const costUsd = Number((ctx.cassette.costUsd - costBefore).toFixed(6));

  const artifact: Envelope<P> = {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    kind: ARTIFACT_KIND[definition.name],
    producer: { workshop: definition.name, version: definition.version, impl: ctx.impl },
    episodeId: ctx.episodeId,
    channel: ctx.channel,
    genre: ctx.genre,
    locale: ctx.locale,
    inputsHash: inputsHashOf(inputs),
    inputs,
    createdAt: ctx.clock.now(),
    costUsd,
    status: 'ok',
    payload,
  };

  assertArtifact(definition.name, artifact);
  return artifact;
}

export function makeRunContext(
  episode: EpisodeContext,
  options: { clock?: Clock; cassette?: Cassette; impl?: Impl } = {},
): RunContext {
  return {
    ...episode,
    clock: options.clock ?? systemClock,
    cassette: options.cassette ?? new Cassette('live'),
    impl: options.impl ?? 'stub',
  };
}
