/**
 * Điều phối một tập: chạy sáu xưởng theo đúng thứ tự và trả về artifact của
 * từng xưởng.
 *
 * Đây là NƠI DUY NHẤT trong repo import cả sáu xưởng. Bản thân các xưởng
 * không biết nhau (bất biến I3), nên thứ tự chạy là một quyết định của lớp
 * điều phối, không phải một phụ thuộc gắn cứng trong code xưởng.
 */

import {
  WORKSHOPS,
  runWorkshop,
  Cassette,
  fixedClock,
  systemClock,
  loadChannelPack,
  loadGenrePack,
  type Clock,
  type Envelope,
  type Impl,
  type WorkshopDefinition,
  type WorkshopName,
} from '@crux/kernel';
import { definition as topic } from '@crux/workshop-topic';
import { definition as editorial } from '@crux/workshop-editorial';
import { definition as visual } from '@crux/workshop-visual';
import { definition as audio } from '@crux/workshop-audio';
import { definition as assembly } from '@crux/workshop-assembly';
import { definition as release } from '@crux/workshop-release';

/**
 * Payload của mỗi xưởng có kiểu riêng. Ở đây chỉ cần biết "một object nào
 * đó" — ranh giới thật do contract giữ, và `runWorkshop` validate đầu ra
 * theo đúng contract của xưởng trước khi trả về.
 */
const DEFINITIONS: Record<WorkshopName, WorkshopDefinition<object>> = {
  topic,
  editorial,
  visual,
  audio,
  assembly,
  release,
};

/**
 * Định nghĩa của một xưởng theo tên. Để `ops/scripts/run-workshop.ts` chạy
 * một xưởng độc lập (mục `P-004`, quyết định `D-12`) mà KHÔNG phải mở thêm
 * một chỗ thứ hai import cả sáu xưởng — tính chất "nơi duy nhất" ghi ở đầu
 * file này là thứ giữ cho bất biến I3 đọc được bằng mắt.
 */
export function definitionFor(name: WorkshopName): WorkshopDefinition<object> {
  return DEFINITIONS[name];
}

export interface PipelineOptions {
  root: string;
  episodeId: string;
  channel: string;
  /** Mốc thời gian cố định. Bắt buộc khi replay: tập vàng phải cho ra byte giống hệt. */
  at?: string;
  impl?: Impl;
  cassette?: Cassette;
  only?: readonly WorkshopName[];
}

export interface PipelineResult {
  artifacts: Record<WorkshopName, Envelope>;
  order: readonly WorkshopName[];
  costUsd: number;
  durationMs: number;
}

export async function runEpisode(options: PipelineOptions): Promise<PipelineResult> {
  const started = Date.now();
  const channelPack = loadChannelPack(options.root, options.channel);
  const genrePack = loadGenrePack(options.root, channelPack.genre);
  const packs = { channel: channelPack, genre: genrePack };

  const clock: Clock = options.at ? fixedClock(options.at) : systemClock;
  const cassette = options.cassette ?? new Cassette('replay');
  const order = options.only ?? WORKSHOPS;

  const artifacts: Partial<Record<WorkshopName, Envelope>> = {};
  for (const name of order) {
    const definition = DEFINITIONS[name];
    artifacts[name] = await runWorkshop(
      definition,
      { upstream: artifacts, packs },
      {
        episodeId: options.episodeId,
        channel: channelPack.slug,
        genre: channelPack.genre,
        locale: channelPack.locale,
        clock,
        cassette,
        impl: options.impl ?? 'stub',
      },
    );
  }

  return {
    artifacts: artifacts as Record<WorkshopName, Envelope>,
    order,
    costUsd: cassette.costUsd,
    durationMs: Date.now() - started,
  };
}
