/**
 * CLI chung của một xưởng (CHARTER 5.4): `run --episode <id>` và
 * `run --input <file>`. Viết một lần ở kernel để sáu xưởng không chép lại
 * sáu bản khác nhau.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Envelope, WorkshopName } from './envelope.ts';
import { fixedClock, systemClock } from './clock.ts';
import { Cassette } from './cassette.ts';
import { readArtifact } from './artifact-store.ts';
import { loadChannelPack, loadGenrePack } from './packs.ts';
import { runWorkshop, type WorkshopDefinition, type WorkshopInput } from './workshop.ts';

export interface CliArgs {
  episode?: string;
  input?: string;
  channel?: string;
  root: string;
  at?: string;
  json: boolean;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--episode':
        args.episode = value;
        i += 1;
        break;
      case '--input':
        args.input = value;
        i += 1;
        break;
      case '--channel':
        args.channel = value;
        i += 1;
        break;
      case '--root':
        args.root = resolve(value ?? '.');
        i += 1;
        break;
      case '--at':
        args.at = value;
        i += 1;
        break;
      case '--json':
        args.json = true;
        break;
      default:
        break;
    }
  }
  return args;
}

/**
 * Chạy một xưởng từ dòng lệnh. Hai chế độ:
 * - `--episode <id>`: đọc artifact của các xưởng trước trong `episodes/`.
 * - `--input <file>`: đọc một file gom sẵn `{ upstream, packs }` — dùng cho
 *   fixture và cho việc chạy một xưởng độc lập, không cần tập nào tồn tại.
 */
export async function runWorkshopCli<P extends object>(
  definition: WorkshopDefinition<P>,
  argv: readonly string[] = process.argv.slice(2),
): Promise<Envelope<P>> {
  const args = parseArgs(argv);

  let input: WorkshopInput;
  let episodeId: string;
  let channel: string;
  let genre: string;
  let locale: string;

  if (args.input) {
    const file = JSON.parse(readFileSync(resolve(args.input), 'utf8')) as {
      episodeId: string;
      channel: string;
      genre: string;
      locale: string;
      upstream?: Partial<Record<WorkshopName, Envelope>>;
      packs?: Record<string, unknown>;
    };
    ({ episodeId, channel, genre, locale } = file);
    input = { upstream: file.upstream ?? {}, packs: file.packs ?? {} };
  } else if (args.episode) {
    episodeId = args.episode;
    channel = args.channel ?? 'us-personal-finance';
    const channelPack = loadChannelPack(args.root, channel);
    genre = channelPack.genre;
    locale = channelPack.locale;
    const genrePack = loadGenrePack(args.root, genre);
    const upstream: Partial<Record<WorkshopName, Envelope>> = {};
    for (const name of definition.consumes) {
      const artifact = readArtifact(args.root, channel, episodeId, name);
      if (artifact) upstream[name] = artifact;
    }
    input = { upstream, packs: { channel: channelPack, genre: genrePack } };
  } else {
    throw new Error('Cần --episode <id> hoặc --input <file>.');
  }

  const artifact = await runWorkshop(definition, input, {
    episodeId,
    channel,
    genre,
    locale,
    clock: args.at ? fixedClock(args.at) : systemClock,
    cassette: new Cassette('replay'),
    impl: 'stub',
  });

  if (args.json) process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}
