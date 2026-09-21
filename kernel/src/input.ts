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
 *
 * ## `upstreamFrom` — nửa còn lại của Z16 (mục `integration/I-009`)
 *
 * `I-008` bỏ được bản sao **pack**, nhưng khối `upstream` của fixture vẫn là
 * bản **chép** của `ops/golden/<tập>/snapshots/*.json`, và bản chép đó đã
 * trôi thật: `assembly←visual` lệch 14 đường dẫn, `release←assembly` lệch 28
 * và thiếu hẳn `payload.preflight.antiSlide`. `I-008` thêm được hai lớp bắt
 * (validate theo contract, so bối cảnh với channel pack), nhưng **nội dung
 * payload không bị buộc vào nguồn nào** — một bản sao hợp contract mà lệch
 * snapshot vẫn xanh, nên nó trôi lại được.
 *
 * Cách chặn giữ đúng hình dạng của `I-008`: **bỏ bản sao thì không cần so**.
 * File `--input` khai `upstreamFrom` — tên tập vàng và danh sách xưởng — và
 * artifact tới từ `ops/golden/<tập>/snapshots/` lúc chạy. Không còn bản chép
 * nào để trôi.
 *
 * Điều này cũng **hoà giải với CHARTER 6.1** (PR cập nhật snapshot không kèm
 * thay đổi nào khác): fixture tự đi theo snapshot, nên một PR
 * `pnpm replay -- --update` chỉ chạm `ops/golden/**` và không phải sửa file
 * nào khác. Phương án "giữ bản sao cộng một phép so" thì ngược lại — nó ép
 * mỗi PR cập nhật snapshot phải sửa kèm fixture, đúng thứ 6.1 cấm.
 *
 * Khối `upstream` khai thẳng **vẫn được giữ**, vì chạy độc lập một xưởng với
 * một artifact viết tay là chế độ CHARTER 5.4 nói tới, và nó không phải lúc
 * nào cũng là bản sao của tập vàng. Luật chặt hơn — fixture **trong repo**
 * không được chép — nằm ở `ops/scripts/check-fixtures.ts`, nơi biết file nào
 * là fixture của repo. Kernel trung tính, không đoán ý người gọi.
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
  upstreamFrom?: UpstreamFrom;
}

/**
 * Trỏ tới artifact đầu vào trong một tập vàng, thay cho việc chép chúng vào
 * file (mục `integration/I-009`).
 *
 * `workshops` khai **đúng** những xưởng mà xưởng này tiêu thụ, không phải cả
 * sáu: `inputsHashOf` băm con trỏ artifact đầu vào, nên thừa một artifact là
 * đổi `inputsHash` của output.
 */
export interface UpstreamFrom {
  /** Tên thư mục tập vàng trong `ops/golden/`. */
  golden: string;
  /** Tên các xưởng cần nạp snapshot. */
  workshops: readonly WorkshopName[];
}

/** Khoá cấp một được phép có trong một file `--input`. */
export const INPUT_FILE_KEYS = [
  '$note',
  'episodeId',
  'channel',
  'genre',
  'locale',
  'upstream',
  'upstreamFrom',
] as const;

/** Đường dẫn snapshot của một xưởng trong một tập vàng. */
export function goldenSnapshotPath(root: string, golden: string, workshop: string): string {
  return resolve(root, 'ops', 'golden', golden, 'snapshots', `${workshop}.json`);
}

/**
 * Nạp khối `upstream` từ snapshot tập vàng. Ném lỗi ở mọi chỗ khai sai —
 * KHÔNG có nhánh nào trả về rỗng rồi chạy tiếp: "nạp được 0 artifact" và
 * "xưởng này không tiêu thụ gì" trông giống hệt nhau lúc chạy, và đó đúng là
 * cách nhóm Z của `ops/known-failures.md` sống. Xưởng không tiêu thụ gì thì
 * khai `upstream: {}`, không khai `upstreamFrom` với danh sách rỗng.
 */
function readUpstreamFromGolden(root: string, full: string, raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`File --input ${full} khai "upstreamFrom" không phải một object JSON.`);
  }
  const { golden, workshops } = raw as { golden?: unknown; workshops?: unknown };

  if (typeof golden !== 'string' || golden.length === 0) {
    throw new Error(`File --input ${full} khai "upstreamFrom" thiếu trường "golden" (tên tập vàng).`);
  }
  if (!Array.isArray(workshops) || workshops.length === 0) {
    throw new Error(
      `File --input ${full} khai "upstreamFrom.workshops" không phải một mảng không rỗng. ` +
        `Xưởng không tiêu thụ artifact nào thì khai "upstream": {} — một danh sách rỗng ở đây ` +
        `không phân biệt được với "quên khai" (mục integration/I-009).`,
    );
  }

  const upstream: Record<string, unknown> = {};
  for (const name of workshops as readonly unknown[]) {
    if (typeof name !== 'string' || !(WORKSHOPS as readonly string[]).includes(name)) {
      throw new Error(
        `File --input ${full} khai "upstreamFrom.workshops" có "${String(name)}", ` +
          `không phải tên xưởng nào. Sáu xưởng: ${WORKSHOPS.join(', ')}.`,
      );
    }
    if (name in upstream) {
      throw new Error(`File --input ${full} khai xưởng "${name}" hai lần trong "upstreamFrom.workshops".`);
    }
    const path = goldenSnapshotPath(root, golden, name);
    if (!existsSync(path)) {
      throw new Error(
        `File --input ${full} trỏ tới snapshot không có: ${path}. ` +
          `Tập vàng "${golden}" không có output của xưởng ${name}.`,
      );
    }
    upstream[name] = JSON.parse(readFileSync(path, 'utf8'));
  }
  return upstream;
}

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

  // Hai cách khai artifact đầu vào loại trừ nhau. Khai cả hai thì bên nào
  // thắng cũng là một luật ngầm, và bên thua nằm im trong file trông như
  // đang có tác dụng — đúng nhóm Z.
  if ('upstream' in file && 'upstreamFrom' in file) {
    throw new Error(
      `File --input ${full} khai cả "upstream" lẫn "upstreamFrom". Chọn một: ` +
        `"upstreamFrom" trỏ tới snapshot tập vàng (không có bản sao nào để trôi), ` +
        `"upstream" khai thẳng artifact cho một lần chạy độc lập (mục integration/I-009).`,
    );
  }

  let upstream: Record<string, unknown>;
  if ('upstreamFrom' in file) {
    upstream = readUpstreamFromGolden(root, full, file.upstreamFrom);
  } else {
    // `null` là một giá trị JSON hợp lệ, nên `?? {}` sẽ nuốt nó thành "không
    // có artifact đầu vào" — im lặng đúng kiểu nhóm Z. Khai `upstream` thì
    // phải khai một object.
    const upstreamRaw: unknown = 'upstream' in file ? file.upstream : {};
    if (typeof upstreamRaw !== 'object' || upstreamRaw === null || Array.isArray(upstreamRaw)) {
      throw new Error(`File --input ${full} khai "upstream" không phải một object JSON.`);
    }
    upstream = upstreamRaw as Record<string, unknown>;
  }
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
