/**
 * Cửa nạp một file `--input`: bối cảnh tập, artifact của các xưởng trước, và
 * pack nạp từ `packs/` (mục `integration/I-008`).
 *
 * Trước mục này, sáu file `workshops/<tên>/fixtures/input.json` mỗi file
 * nhúng một bản sao channel pack và một bản sao genre pack. Bản sao lệch bản
 * thật mà mọi chỉ báo vẫn xanh: fixture chạy độc lập nên không có gì so nó
 * với `packs/`, và tập vàng không băm pack (`inputsHashOf` chỉ băm con trỏ
 * artifact đầu vào). Đúng nhóm **Z** của `ops/known-failures.md`.
 *
 * Nên file `--input` khai `channel`, và pack tới từ `packs/`. Không phải chỉ
 * CLI đi qua đây: test stub của các xưởng cũng nạp fixture bằng hàm này, nên
 * nó nằm ở module riêng chứ không nằm trong `cli.ts`.
 *
 * Luật khoá là **danh sách cho phép**, không phải danh sách cấm. Chặn đúng
 * tên `packs` thì một bản sao đặt tên `channelPack` hay `limits` đi qua im
 * lặng, và Z16 tái hiện nguyên vẹn dưới một cái tên khác.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { WORKSHOPS, type Envelope, type WorkshopName } from './envelope.ts';
import { validateArtifact } from './contracts.ts';
import { loadChannelPack, loadGenrePack } from './packs.ts';
import type { EpisodeContext, WorkshopInput } from './workshop.ts';

/**
 * Hình dạng của một file `--input`: bối cảnh tập, và artifact của các xưởng
 * trước. `genre` và `locale` không bắt buộc — khai thì phải khớp channel
 * pack, vì channel pack là nguồn duy nhất của hai trường đó.
 */
export interface InputFile {
  $note?: string;
  episodeId: string;
  channel: string;
  genre?: string;
  locale?: string;
  upstream?: Partial<Record<WorkshopName, Envelope>>;
}

/** Khoá cấp một được phép có trong một file `--input`. */
export const INPUT_FILE_KEYS = [
  '$note',
  'episodeId',
  'channel',
  'genre',
  'locale',
  'upstream',
] as const;

/**
 * Đọc một file `--input` và dựng đầu vào của xưởng, với pack nạp từ `packs/`.
 *
 * Ném lỗi ở mọi chỗ file tự mang cấu hình thay vì trỏ tới `packs/`: khoá cấp
 * một ngoài `INPUT_FILE_KEYS`, `genre`/`locale` lệch channel pack, tên xưởng
 * lạ trong `upstream`, hay một artifact đầu vào không hợp contract. Fixture
 * cần một pack khác pack thật thì thêm một kênh vào `packs/channels/`, chứ
 * không sửa riêng bản sao của mình.
 *
 * `path` tương đối được giải theo `root`, không theo cwd: hai đầu vào của
 * hàm này phải cùng một gốc, nếu không fixture của gốc này chạy với pack của
 * gốc kia mà không ai biết.
 */
export function readInputFile(
  root: string,
  path: string,
): { episode: EpisodeContext; input: WorkshopInput } {
  const full = isAbsolute(path) ? path : resolve(root, path);
  if (!existsSync(full)) throw new Error(`Không có file --input ${full}.`);

  const raw: unknown = JSON.parse(readFileSync(full, 'utf8'));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`File --input ${full} không phải một object JSON.`);
  }
  const file = raw as InputFile & Record<string, unknown>;

  const unknownKeys = Object.keys(file).filter(
    (key) => !(INPUT_FILE_KEYS as readonly string[]).includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `File --input ${full} có khoá lạ ở cấp một: ${unknownKeys.join(', ')}. ` +
        `Chỉ ${INPUT_FILE_KEYS.join(', ')} được phép — cấu hình tới từ packs/ theo trường ` +
        `"channel", không chép vào fixture: bản sao lệch bản thật mà không gì đỏ ` +
        `(mục integration/I-008).`,
    );
  }
  if (typeof file.episodeId !== 'string' || file.episodeId.length === 0) {
    throw new Error(`File --input ${full} thiếu trường "episodeId".`);
  }
  if (typeof file.channel !== 'string' || file.channel.length === 0) {
    throw new Error(`File --input ${full} thiếu trường "channel".`);
  }

  const channelPack = loadChannelPack(root, file.channel);
  const genrePack = loadGenrePack(root, channelPack.genre);

  for (const field of ['genre', 'locale'] as const) {
    const declared = file[field];
    if (declared !== undefined && declared !== channelPack[field]) {
      throw new Error(
        `File --input ${full} khai ${field} "${String(declared)}" nhưng channel pack ` +
          `"${file.channel}" khai "${String(channelPack[field])}".`,
      );
    }
  }

  // `null` là một giá trị JSON hợp lệ, nên `?? {}` sẽ nuốt nó thành "không có
  // artifact đầu vào" — im lặng đúng kiểu nhóm Z. Khai `upstream` thì phải
  // khai một object.
  const upstreamRaw: unknown = 'upstream' in file ? file.upstream : {};
  if (typeof upstreamRaw !== 'object' || upstreamRaw === null || Array.isArray(upstreamRaw)) {
    throw new Error(`File --input ${full} khai "upstream" không phải một object JSON.`);
  }

  const upstream = upstreamRaw as Record<string, unknown>;
  for (const name of Object.keys(upstream)) {
    if (!(WORKSHOPS as readonly string[]).includes(name)) {
      throw new Error(
        `File --input ${full} khai artifact đầu vào của "${name}", không phải tên xưởng nào. ` +
          `Sáu xưởng: ${WORKSHOPS.join(', ')}.`,
      );
    }
    const result = validateArtifact(name as WorkshopName, upstream[name]);
    if (!result.valid) {
      throw new Error(
        `File --input ${full}: artifact đầu vào của xưởng ${name} không hợp contract:\n` +
          result.errors.map((e) => `    ${e.path}: ${e.message}`).join('\n'),
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
      upstream: upstream as Partial<Record<WorkshopName, Envelope>>,
      packs: { channel: channelPack, genre: genrePack },
    },
  };
}
