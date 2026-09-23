#!/usr/bin/env node
/**
 * `pnpm run:workshop -- --workshop <tên> --episode <id> [--impl stub|v1]` —
 * chạy ĐÚNG MỘT xưởng, ghi artifact vào vùng của nó trong `episodes/`, và
 * ghi **một** dòng log có `costUsd` vào `ops/logs/<xưởng>/<id>.jsonl`
 * (bất biến I8, quyết định `D-C04`). Sáu xưởng đều là tên làn, nên vùng log
 * của một xưởng chính là vùng làn của nó.
 *
 * Vì sao cần script này, khi đã có `runWorkshopCli` của kernel (mục `P-004`,
 * CHARTER 5.4, quyết định `D-12` — sáu xưởng nối bằng `workflow_dispatch`,
 * không nối bằng sự kiện `push`): `runWorkshopCli` chạy xưởng rồi **in ra**,
 * nó không ghi artifact và **không ghi dòng log nào**. Một workflow gọi nó
 * sẽ chạy xong mà không để lại `costUsd` ở đâu cả — đúng thứ bất biến I8
 * cấm, và đúng nhóm lỗi **Z**: chạy được, xanh, mà tiền biến mất khỏi
 * `ops/metrics.md` không dấu vết. Script này là chỗ nối còn thiếu đó.
 *
 * Khác `ops/scripts/run-episode.ts` ở đúng một điểm: chạy một xưởng, không
 * chạy cả sáu. Artifact của các xưởng trước đọc từ đĩa, như chế độ
 * `--episode` của `runWorkshopCli`.
 */

import {
  WORKSHOPS,
  runWorkshop,
  writeArtifact,
  readArtifact,
  appendRunLog,
  runLogPath,
  isSafeLogId,
  loadChannelPack,
  loadGenrePack,
  fixedClock,
  systemClock,
  Cassette,
  type Envelope,
  type Impl,
  type WorkshopName,
} from '@crux/kernel';
import { definitionFor } from './pipeline.ts';

export interface RunWorkshopArgs {
  workshop: WorkshopName;
  episode: string;
  channel: string;
  impl: Impl;
  root: string;
  at?: string;
}

const IMPLS: readonly Impl[] = ['stub', 'v1'];

/**
 * Đọc và KIỂM tham số, trước khi chạy gì. Hàm thuần, tách riêng để kiểm
 * được bằng unit test — và để mọi lỗi tham số hiện ra ở một chỗ, bằng một
 * câu nói rõ giá trị nào sai và giá trị nào hợp lệ.
 *
 * Mã tập được kiểm **ở đây**, không để `runLogPath` ném sau khi xưởng đã
 * chạy xong: cùng lý do đã ghi trong `run-episode.ts` — một lần chạy trả
 * tiền thật mà không để lại dòng `costUsd` nào là vi phạm bất biến I8, và
 * không gì đỏ để báo.
 */
export function parseRunWorkshopArgs(
  argv: readonly string[],
  cwd: string = process.cwd(),
): RunWorkshopArgs {
  const raw = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    if (!flag.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags.add(flag.slice(2));
      continue;
    }
    raw.set(flag.slice(2), next);
    i += 1;
  }
  void flags;

  const workshop = raw.get('workshop');
  if (workshop === undefined) {
    throw new Error(`Cần --workshop <tên>. Hợp lệ: ${WORKSHOPS.join(', ')}.`);
  }
  if (!(WORKSHOPS as readonly string[]).includes(workshop)) {
    throw new Error(
      `Xưởng không hợp lệ: ${JSON.stringify(workshop)}. Hợp lệ: ${WORKSHOPS.join(', ')}.`,
    );
  }

  const episode = raw.get('episode');
  if (episode === undefined) throw new Error('Cần --episode <id>.');
  if (!isSafeLogId(episode)) {
    throw new Error(
      `Mã tập không hợp lệ: ${JSON.stringify(episode)}. Chỉ chữ, số, \`.\`, \`-\`, \`_\`, và không có \`..\`.`,
    );
  }

  const impl = raw.get('impl') ?? 'stub';
  if (!(IMPLS as readonly string[]).includes(impl)) {
    throw new Error(`--impl không hợp lệ: ${JSON.stringify(impl)}. Hợp lệ: ${IMPLS.join(', ')}.`);
  }

  const at = raw.get('at');
  return {
    workshop: workshop as WorkshopName,
    episode,
    channel: raw.get('channel') ?? 'us-personal-finance',
    impl: impl as Impl,
    root: raw.get('root') ?? cwd,
    ...(at === undefined ? {} : { at }),
  };
}

/**
 * Artifact của các xưởng mà xưởng này tiêu thụ, đọc từ `episodes/`. Thiếu
 * một cái thì `runWorkshop` sẽ ném — nhưng câu nó ném không nói **phải làm
 * gì tiếp**, mà đây là lỗi thường gặp nhất khi nối sáu workflow bằng
 * dispatch (chạy `visual` trước khi `editorial` xong). Nên kiểm ở đây và
 * nói thẳng lệnh phải chạy trước.
 */
export function missingUpstream(
  root: string,
  channel: string,
  episode: string,
  consumes: readonly WorkshopName[],
): { upstream: Partial<Record<WorkshopName, Envelope>>; missing: WorkshopName[] } {
  const upstream: Partial<Record<WorkshopName, Envelope>> = {};
  const missing: WorkshopName[] = [];
  for (const name of consumes) {
    const artifact = readArtifact(root, channel, episode, name);
    if (artifact === undefined) missing.push(name);
    else upstream[name] = artifact;
  }
  return { upstream, missing };
}

async function main(): Promise<void> {
  let args: RunWorkshopArgs;
  try {
    args = parseRunWorkshopArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(2);
  }

  const definition = definitionFor(args.workshop);
  const clock = args.at ? fixedClock(args.at) : systemClock;
  const cassette = new Cassette('replay');
  const started = Date.now();

  // ⚠️ `--impl v1` đi THẲNG vào `producer.impl` của phong bì. Sáu xưởng hiện
  // đều là stub (CLAUDE.md mục 1), nên `v1` hôm nay chỉ đổi NHÃN và làm
  // Preflight của `assembly` cứng lên — nội dung payload vẫn là stub. Nói ra
  // ở đây vì một artifact mang nhãn `v1` mà ruột là stub là đúng nhóm lỗi Z.
  // Không chặn: cờ này tồn tại để sáu xưởng lên `impl: v1` dùng, và xưởng nào
  // đã lên thì tự đọc `ctx.impl`.
  if (args.impl === 'v1') {
    process.stderr.write(
      `⚠️  --impl v1: xưởng ${args.workshop} sẽ mang producer.impl=v1. ` +
        'Xưởng nào còn ở stub thì nhãn này KHÔNG đổi nội dung payload.\n',
    );
  }

  const logLine = (status: 'ok' | 'failed', at: string, costUsd: number, note?: string) => {
    appendRunLog(runLogPath(args.root, args.workshop, args.episode), {
      at,
      lane: args.workshop,
      kind: 'stage',
      ref: `${args.episode}/${args.workshop}`,
      status,
      durationMs: Date.now() - started,
      costUsd,
      ...(note === undefined ? {} : { note }),
    });
  };

  // Bất biến I8 nói "MỌI lần chạy", không nói "mọi lần chạy thành công".
  // Một lần chạy hỏng vẫn tốn tiền và vẫn phải để lại dòng của nó — nên
  // TOÀN BỘ phần còn lại nằm trong một `try`, không chỉ riêng lời gọi xưởng.
  // Nạp pack hỏng, hay `writeArtifact` hỏng SAU khi xưởng đã chạy xong, đều
  // là "chạy mà không để lại dòng nào" nếu để chúng ngoài `try`.
  try {
    const { upstream, missing } = missingUpstream(
      args.root,
      args.channel,
      args.episode,
      definition.consumes,
    );

    if (missing.length > 0) {
      const first = missing[0]!;
      logLine(
        'failed',
        clock.now(),
        cassette.costUsd,
        `thiếu artifact đầu vào: ${missing.join(', ')}`,
      );
      process.stderr.write(
        `Xưởng ${args.workshop} cần artifact của ${missing.join(', ')} nhưng chưa có trong ` +
          `episodes/${args.channel}/${args.episode}/.\n` +
          `Chạy trước: pnpm run:workshop -- --workshop ${first} --episode ${args.episode}\n`,
      );
      process.exit(1);
    }

    const channelPack = loadChannelPack(args.root, args.channel);
    const genrePack = loadGenrePack(args.root, channelPack.genre);

    const artifact = await runWorkshop(
      definition,
      { upstream, packs: { channel: channelPack, genre: genrePack } },
      {
        episodeId: args.episode,
        channel: channelPack.slug,
        genre: channelPack.genre,
        locale: channelPack.locale,
        clock,
        cassette,
        impl: args.impl,
      },
    );

    const path = writeArtifact(args.root, artifact);
    logLine(artifact.status === 'ok' ? 'ok' : 'failed', artifact.createdAt, artifact.costUsd);

    process.stdout.write(
      `${args.workshop} (impl ${args.impl}) → ${path}\n` +
        `status ${artifact.status} · costUsd ${artifact.costUsd} · log ${runLogPath('.', args.workshop, args.episode)}\n`,
    );
    if (artifact.status !== 'ok') process.exit(1);
  } catch (error) {
    logLine('failed', clock.now(), cassette.costUsd, (error as Error).message.slice(0, 300));
    process.stderr.write(`Xưởng ${args.workshop} hỏng: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
