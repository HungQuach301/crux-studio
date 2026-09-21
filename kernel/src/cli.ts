/**
 * CLI chung của một xưởng (CHARTER 5.4): `run --episode <id>` và
 * `run --input <file>`. Viết một lần ở kernel để sáu xưởng không chép lại
 * sáu bản khác nhau.
 *
 * File `--input` KHÔNG mang bản sao pack. Nó khai `channel`, còn pack thật
 * được nạp từ `packs/` — một nguồn duy nhất cho cả hai chế độ chạy (mục
 * `integration/I-008`). Trước đó sáu fixture nhúng mỗi file một bản sao,
 * và bản sao lệch bản thật mà mọi chỉ báo vẫn xanh: fixture chạy độc lập
 * nên không có gì so nó với `packs/`, và tập vàng không băm pack
 * (`inputsHashOf` chỉ băm con trỏ artifact đầu vào). Đúng nhóm **Z** của
 * `ops/known-failures.md` — hỏng mà mọi chỉ báo đều xanh.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Envelope, WorkshopName } from './envelope.ts';
import { fixedClock, systemClock } from './clock.ts';
import { Cassette } from './cassette.ts';
import { readArtifact } from './artifact-store.ts';
import { loadChannelPack, loadGenrePack } from './packs.ts';
import {
  runWorkshop,
  type EpisodeContext,
  type WorkshopDefinition,
  type WorkshopInput,
} from './workshop.ts';

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
 * Hình dạng của một file `--input`: bối cảnh tập, và artifact của các xưởng
 * trước. `genre` và `locale` không bắt buộc — khai thì phải khớp channel
 * pack, vì channel pack là nguồn duy nhất của hai trường đó.
 *
 * `packs` KHÔNG phải một khoá hợp lệ ở đây; xem `readInputFile`.
 */
export interface InputFile {
  episodeId: string;
  channel: string;
  genre?: string;
  locale?: string;
  upstream?: Partial<Record<WorkshopName, Envelope>>;
}

/**
 * Đọc một file `--input` và dựng đầu vào của xưởng, với pack nạp từ
 * `packs/`.
 *
 * Ném lỗi khi file nhúng bản sao pack. Đó là điểm chặn chính của mục
 * `integration/I-008`: một bản sao nằm im trong fixture sẽ lệch bản thật
 * mà không gì đỏ, nên cách duy nhất giữ được là không cho phép nó tồn tại.
 * Fixture cần một pack khác pack thật thì thêm một kênh vào `packs/channels/`,
 * chứ không sửa riêng bản sao của mình.
 */
export function readInputFile(
  root: string,
  path: string,
): { episode: EpisodeContext; input: WorkshopInput } {
  const raw: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`File --input ${path} không phải một object JSON.`);
  }
  const file = raw as InputFile & Record<string, unknown>;

  if ('packs' in file) {
    throw new Error(
      `File --input ${path} nhúng khoá "packs". Pack được nạp từ packs/ theo trường ` +
        `"channel", không chép vào fixture: bản sao lệch bản thật mà không gì đỏ ` +
        `(mục integration/I-008).`,
    );
  }
  if (typeof file.episodeId !== 'string' || file.episodeId.length === 0) {
    throw new Error(`File --input ${path} thiếu trường "episodeId".`);
  }
  if (typeof file.channel !== 'string' || file.channel.length === 0) {
    throw new Error(`File --input ${path} thiếu trường "channel".`);
  }

  const channelPack = loadChannelPack(root, file.channel);
  const genrePack = loadGenrePack(root, channelPack.genre);

  for (const field of ['genre', 'locale'] as const) {
    const declared = file[field];
    if (declared !== undefined && declared !== channelPack[field]) {
      throw new Error(
        `File --input ${path} khai ${field} "${String(declared)}" nhưng channel pack ` +
          `"${file.channel}" khai "${String(channelPack[field])}".`,
      );
    }
  }

  return {
    episode: {
      episodeId: file.episodeId,
      channel: file.channel,
      genre: channelPack.genre,
      locale: channelPack.locale,
    },
    input: {
      upstream: file.upstream ?? {},
      packs: { channel: channelPack, genre: genrePack },
    },
  };
}

/**
 * Chạy một xưởng từ dòng lệnh. Hai chế độ:
 * - `--episode <id>`: đọc artifact của các xưởng trước trong `episodes/`.
 * - `--input <file>`: đọc một file khai `{ episodeId, channel, upstream }` —
 *   dùng cho fixture và cho việc chạy một xưởng độc lập, không cần tập nào
 *   tồn tại. Pack nạp từ `packs/`, giống chế độ `--episode`.
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
    const fixture = readInputFile(args.root, args.input);
    ({ episodeId, channel, genre, locale } = fixture.episode);
    input = fixture.input;
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
