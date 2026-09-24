#!/usr/bin/env node
/**
 * Bất biến **I5** — máy không công khai video (mục `release/R-002`, tiêu chí
 * xong số 2): *"Không có đường nào trong code đặt `visibility` khác
 * `private`. Contract đã khoá; test phải chứng minh code cũng không thử."*
 *
 * ## Vì sao contract khoá rồi mà vẫn cần cổng này
 *
 * `kernel/contracts/release.payload.v0.schema.json` khoá
 * `publication.visibility` bằng `const: "private"`, và
 * `workshops/release/test/stub.test.ts` chứng minh contract chặn một
 * artifact bị sửa thành công khai. Cả hai đều đúng, và cả hai đều đo **kết
 * quả của một đường chạy** — đường chạy stub, với một fixture.
 *
 * Hai lỗ còn lại, cùng một hình dạng nhóm **Z** (hỏng mà mọi chỉ báo đều
 * xanh):
 *
 * 1. **Đường code chưa ai gọi.** Khi xưởng `release` lên `impl: v1`, lệnh
 *    tải lên thật nói chuyện với YouTube Data API, và khoá của API **không
 *    mang tên `visibility`** — nó là `status.privacyStatus`. Contract của
 *    repo không nhìn thấy khoá đó, nên một dòng đặt `privacyStatus` thành
 *    `public` đi qua `validateArtifact` sạch sẽ. Không phép kiểm nào hôm
 *    nay đỏ.
 * 2. **Nới chính chỗ khoá, bằng một giá trị không ai nghĩ tới.** Hai bài
 *    `tampered` đang có (`workshops/release/test/stub.test.ts` và
 *    `kernel/test/contracts.test.ts`) giữ chiều ngược, nhưng chúng khẳng
 *    định đúng **một** câu: *"contract từ chối `public`"*. Câu đó không
 *    phải *"contract khoá ở đúng một giá trị"*.
 *
 *    Đo được, không phải suy luận: đổi `const: "private"` thành
 *    `enum: ["private", "public"]` thì **cả hai bài đều đỏ** — chúng bắt
 *    được ca đó. Nhưng đổi thành `enum: ["private", "unlisted"]` thì
 *    **11/11 bài xanh**, trong khi I5 đã mất: `unlisted` là một video ai có
 *    link cũng xem được. Lỗ không nằm ở chỗ bài kiểm yếu, mà ở chỗ nó khoá
 *    một giá trị cấm thay vì khoá giá trị được phép — và danh sách giá trị
 *    cấm thì không bao giờ đủ.
 *
 * Nên phép bắt ở đây đúng công thức nhóm Z mà dự án đã dùng nhiều lần:
 * **một thứ ở ngoài đếm và so**, không tự khai. Hai phần độc lập:
 *
 * - `visibilityValueProblems` — quét **nguồn** (không phải output): mọi chỗ
 *   gán một giá trị cho khoá `visibility` hay `privacyStatus` phải là đúng
 *   chữ `private`.
 * - `contractLockProblems` — mọi contract trong `kernel/contracts/` khai
 *   `visibility`/`privacyStatus` phải khoá nó ở đúng một giá trị `private`.
 *
 * ## Giá trị không phải hằng số cũng là vi phạm
 *
 * `visibility: mode` không chứng minh được gì — cổng này trả lời câu hỏi
 * *"có đường nào đặt khác `private` không"*, và một biến là câu trả lời
 * "không biết". Hướng an toàn của một bất biến là **chặn**, không phải cho
 * qua: I5 nằm trong CHARTER mục 3, và nới nó cần một quyết định
 * `irreversible`, chứ không cần một lượt chạy quên mất.
 *
 * ## Lối thoát có kiểm soát, và cấm im lặng
 *
 * Một dòng cố ý đặt giá trị khác khai bằng dấu `I5-allow: <lý do>` ngay
 * trên dòng đó. Hôm nay có **ba**, tất cả đều là bài kiểm chứng minh
 * contract **chặn** một giá trị sai — chiều ngược, không phải đường tải
 * lên: `kernel/test/contracts.test.ts:48` và `:49`, cộng
 * `workshops/release/test/stub.test.ts:30`.
 *
 * Cổng **đếm và in ra** mọi dòng như vậy ở mọi lần chạy, kể cả khi không có
 * vấn đề nào: một lối thoát không ai đếm là một lối thoát sẽ lặng lẽ thành
 * thường lệ. Lý do bắt buộc phải có chữ — `I5-allow:` trống bị coi là vi
 * phạm. Nhưng in ra thôi thì **không đủ**: không ai đọc stdout của một job
 * xanh, nên dòng thứ tư sẽ trôi qua im lặng. Vì vậy ba vị trí trên bị một
 * bài kiểm khoá lại (`ops/test/check-visibility.test.ts`), đúng cách
 * `SCAN_EXCLUDED` bị khoá: thêm một lối thoát là phải sửa một bài kiểm, tức
 * là phải nói ra.
 *
 * ## Giới hạn, khai ra thay vì để ngầm
 *
 * - Quét theo **dòng**, không phải theo cú pháp. Một biểu thức trải nhiều
 *   dòng, hay một giá trị dựng bằng `JSON.parse` của chuỗi ghép, nằm ngoài
 *   tầm. Đây là cổng chặn lối vào hay gặp, không phải một chứng minh.
 * - Chỉ quét nguồn trong repo (`ops/workflows/**`, không phải `.github/**`
 *   — bản chép do `sync-workflows.yml` sinh ra, và agent không ghi vào đó,
 *   `CLAUDE.md` mục 4).
 * - `docs/` đứng ngoài: `docs/spec/CRUX-REFERENCE-SPEC.md` chép nguyên
 *   `enum` ba giá trị của YouTube API. Đó là tài liệu mô tả API của người
 *   khác, không phải đường code của dự án.
 *
 * Giả định **G6** (app chưa qua kiểm tuân thủ thì video bị khoá riêng tư)
 * đi **cùng hướng** với cổng này nhưng cổng **không dựa vào nó**: G6 sai
 * theo hướng "API công khai được" thì cổng này vẫn chặn y nguyên. Nên file
 * này cố ý KHÔNG đăng ký là phần phụ thuộc của G6 trong
 * `docs/assumptions.md`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Khoá nào mang nghĩa "ai xem được video này". */
export const VISIBILITY_KEYS = ['visibility', 'privacyStatus'] as const;

/** Giá trị duy nhất máy được phép đặt (bất biến I5). */
export const ALLOWED_VALUE = 'private';

/** Dấu khai một dòng cố ý đặt giá trị khác. Phải kèm lý do. */
export const ALLOW_MARKER = 'I5-allow:';

/** Gốc được quét. `docs/` đứng ngoài — xem docblock. */
export const SCANNED_ROOTS = ['kernel', 'workshops', 'ops', 'packs', 'spike'] as const;

const SCANNED_EXTENSIONS = ['.ts', '.mts', '.mjs', '.js', '.json', '.yml', '.yaml'];
const IGNORED_DIRS = new Set(['node_modules', '.git']);

/**
 * File duy nhất đứng ngoài phép quét, và lý do nó phải đứng ngoài: bộ kiểm
 * của chính cổng này **buộc** phải dựng các mẫu vi phạm (`visibility` đặt
 * thành `public`, đặt bằng biến, khai kiểu rộng) để chứng minh cổng chặn
 * thật. Quét chính nó thì mọi mẫu thử thành một vi phạm, và cách duy nhất
 * để xanh lại là làm bộ kiểm yếu đi — tức cổng tự ăn bộ kiểm của mình.
 *
 * Danh sách này cố ý là **một tên cụ thể**, không phải một hình mẫu như
 * `*.test.ts`: loại cả họ test ra sẽ làm ba dấu `I5-allow:` đang có trong
 * `kernel/test/` và `workshops/release/test/` mất nghĩa, và mở đúng chỗ để
 * một đường tải lên thật nấp trong một file tên `*.test.ts`. Có một bài
 * kiểm khoá danh sách này ở đúng một phần tử.
 */
export const SCAN_EXCLUDED = ['ops/test/check-visibility.test.ts'] as const;

/** Một chỗ trong nguồn gán giá trị cho khoá tầm nhìn. */
export interface VisibilitySite {
  /** Đường dẫn tương đối gốc repo, luôn dùng `/`. */
  file: string;
  /** Số dòng, đếm từ 1. */
  line: number;
  key: string;
  /** Phần văn bản sau dấu `:` hoặc `=`, đã cắt khoảng trắng. */
  value: string;
  /** Lý do khai sau `I5-allow:`, hoặc `null` nếu dòng không khai. */
  allowReason: string | null;
}

/**
 * Khoá tầm nhìn ở **vị trí khoá** — có `:` hoặc `=` ngay sau, cho phép khoá
 * được bọc nháy (JSON) hay trần (YAML, object literal của TS).
 *
 * `"visibility",` trong mảng `required` của JSON Schema KHÔNG khớp: không có
 * dấu gán nào sau nó. Đó là chủ đích — dòng ấy nói "trường này bắt buộc",
 * không đặt giá trị nào.
 */
const KEY_PATTERN = new RegExp(
  String.raw`["'\`]?\b(${VISIBILITY_KEYS.join('|')})\b["'\`]?\s*\]?\s*[:=]\s*`,
  'g',
);

/** Dòng chỉ có chú thích — không phải đường code. */
const isCommentOnly = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('#')
  );
};

const allowReasonOf = (line: string): string | null => {
  const at = line.indexOf(ALLOW_MARKER);
  return at === -1 ? null : line.slice(at + ALLOW_MARKER.length).trim();
};

/**
 * Mọi chỗ gán khoá tầm nhìn trong một nội dung — **tất cả** chỗ khớp trên
 * một dòng, không phải chỗ đầu tiên.
 *
 * Lấy một chỗ mỗi dòng nghe như đủ, và không đủ: một body gửi YouTube Data
 * API mang khoá của repo và khoá của API **trên cùng một dòng** là hình
 * dạng tự nhiên nhất của thứ cổng này sinh ra để chặn —
 *
 *     { visibility: 'private', privacyStatus: 'public' }
 *
 * — và chỗ khớp đầu tiên là chỗ ĐẠT, nên cả dòng đi qua sạch sẽ. Đo được ở
 * vòng soát ngữ cảnh sạch của chính mục này: cổng ra `EXIT=0` và cả 22 bài
 * vẫn xanh. Có một bài ÂM khoá đúng ca đó.
 */
export function findVisibilitySites(file: string, content: string): VisibilitySite[] {
  const sites: VisibilitySite[] = [];
  content.split('\n').forEach((line, index) => {
    if (isCommentOnly(line)) return;
    const allowReason = allowReasonOf(line);
    // `lastIndex` của một regex có cờ `g` sống qua các lần gọi, nên đặt lại
    // trước mỗi dòng: quên là bỏ sót chỗ khớp một cách ngẫu nhiên.
    KEY_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = KEY_PATTERN.exec(line)) !== null) {
      sites.push({
        file,
        line: index + 1,
        key: match[1]!,
        value: line.slice(match.index + match[0].length).trim(),
        allowReason,
      });
      if (match[0].length === 0) KEY_PATTERN.lastIndex += 1;
    }
  });
  return sites;
}

/**
 * Giá trị này có chứng minh được là `private` không.
 *
 * - `'private'`, `"private"`, `private` (YAML trần) → **đạt**.
 * - `{` → đây là **vị trí schema**, không phải gán giá trị: phần khoá của
 *   contract do `contractLockProblems` lo, và trộn hai chuyện vào một phép
 *   đo sẽ làm cả hai khó đọc.
 * - mọi thứ còn lại → **không đạt**, gồm cả biến và biểu thức (xem docblock
 *   đầu file: "không biết" không phải "đạt").
 */
export function valueVerdict(
  value: string,
  file = '',
): 'private' | 'schema' | 'other-literal' | 'type-widening' | 'dynamic' {
  if (value.startsWith('{')) return 'schema';

  const quoted = /^(['"`])(.*?)\1/.exec(value);
  if (quoted !== null) return quoted[2] === ALLOWED_VALUE ? 'private' : 'other-literal';

  const bare = bareToken(value);
  if (bare === ALLOWED_VALUE) return 'private';
  if (bare.length === 0) return 'dynamic';
  if (WIDE_TYPE_NAMES.has(bare)) return 'type-widening';
  if (!/^[A-Za-z0-9_-]+$/.test(bare)) return 'dynamic';

  // Một chữ trần mang hai nghĩa khác nhau tuỳ ngôn ngữ, và gọi sai tên thì
  // thông báo dẫn người đọc đi nhầm chỗ: trong YAML nó là **hằng số** viết
  // không nháy; trong TS/JS nó là một **biến**. Cả hai đều bị chặn — chỉ
  // khác câu giải thích.
  return isYaml(file) ? 'other-literal' : 'dynamic';
}

const isYaml = (file: string): boolean => file.endsWith('.yml') || file.endsWith('.yaml');

/**
 * Kiểu TypeScript nhận **mọi** chuỗi. Ở vị trí kiểu, `visibility: string`
 * không đặt giá trị nào — nhưng nó tháo đúng lớp mà
 * `workshops/release/src/index.ts` đang dùng để giữ I5 ở tầng kiểu
 * (`visibility: 'private'`, một kiểu hằng). Nới kiểu là một cách nới I5 mà
 * không dòng nào mang chữ `public`, nên cổng vẫn hỏi, và chỗ nào cố ý thì
 * khai bằng `I5-allow:`.
 */
const WIDE_TYPE_NAMES = new Set(['string', 'any', 'unknown']);

/** Phần giá trị đọc được của một dòng, cắt đuôi cú pháp để thông báo không dính rác. */
export function bareToken(value: string): string {
  return value.split('#')[0]!.split(',')[0]!.split('}')[0]!.trim().replace(/;$/, '').trim();
}

/** Mọi file được quét dưới `root`, đường dẫn tương đối dùng `/`. */
export function scannedFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        const rel = relative(root, full).split(sep).join('/');
        if (!(SCAN_EXCLUDED as readonly string[]).includes(rel)) found.push(rel);
      }
    }
  };
  for (const name of SCANNED_ROOTS) {
    const dir = join(root, name);
    if (existsSync(dir)) walk(dir);
  }
  return found.sort();
}

export interface VisibilityScan {
  problems: string[];
  /** Dòng khai `I5-allow:` hợp lệ — in ra ở MỌI lần chạy, không bao giờ im. */
  allowed: string[];
  /** Số chỗ gán đã soát, để phép đo không bao giờ "xanh vì chẳng đọc gì". */
  sites: number;
  filesScanned: number;
}

/** Soát một tập chỗ gán đã tìm được. Tách khỏi phần chạm đĩa để có test độc lập. */
export function visibilityValueProblems(sites: readonly VisibilitySite[]): Omit<VisibilityScan, 'filesScanned'> {
  const problems: string[] = [];
  const allowed: string[] = [];

  for (const site of sites) {
    const where = `${site.file}:${site.line}`;
    const verdict = valueVerdict(site.value, site.file);
    if (verdict === 'schema') continue;

    if (site.allowReason !== null) {
      if (site.allowReason.length === 0) {
        problems.push(`${where}: \`${ALLOW_MARKER}\` không có lý do — một lối thoát không giải thích được là một lối thoát bị cấm.`);
      } else {
        allowed.push(`${where} (${site.key}) — ${site.allowReason}`);
      }
      continue;
    }

    if (verdict === 'private') continue;
    const shown = bareToken(site.value) || site.value;
    if (verdict === 'other-literal') {
      problems.push(
        `${where}: \`${site.key}\` đặt thành \`${shown}\`, không phải \`${ALLOWED_VALUE}\` — bất biến I5 cấm máy công khai video.`,
      );
    } else if (verdict === 'type-widening') {
      problems.push(
        `${where}: \`${site.key}\` khai kiểu rộng \`${shown}\` thay cho kiểu hằng \`'${ALLOWED_VALUE}'\` — ` +
          `kiểu rộng nhận mọi chuỗi, nên I5 không còn được tầng kiểu giữ.`,
      );
    } else {
      problems.push(
        `${where}: \`${site.key}\` đặt bằng một giá trị không phải hằng số (\`${shown}\`) — ` +
          `không chứng minh được là \`${ALLOWED_VALUE}\`, nên I5 chặn.`,
      );
    }
  }

  return { problems, allowed, sites: sites.length };
}

/** Quét nguồn dưới `root` — phần chạm đĩa của `visibilityValueProblems`. */
export function scanVisibility(root: string): VisibilityScan {
  const files = scannedFiles(root);
  const sites: VisibilitySite[] = [];
  for (const file of files) {
    sites.push(...findVisibilitySites(file, readFileSync(join(root, file), 'utf8')));
  }
  return { ...visibilityValueProblems(sites), filesScanned: files.length };
}

/**
 * Khoá tầm nhìn trong một schema phải bị ghim ở đúng một giá trị `private`.
 *
 * Chấp nhận `const: "private"` hoặc `enum: ["private"]` — hai cách viết
 * cùng một ràng buộc. `enum` có từ hai giá trị trở lên là **đã nới**, đúng
 * cái lỗ mà bài kiểm `tampered` không bắt được.
 */
export function lockedToPrivate(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false;
  const schema = node as { const?: unknown; enum?: unknown };
  if (schema.const === ALLOWED_VALUE) return true;
  return Array.isArray(schema.enum) && schema.enum.length === 1 && schema.enum[0] === ALLOWED_VALUE;
}

/**
 * Mọi khoá tầm nhìn khai trong một schema đã nạp, tìm bằng cách đi hết cây
 * `properties` — không hardcode đường dẫn `publication.visibility`, để một
 * contract mới đặt khoá ở chỗ khác cũng chịu cùng luật.
 */
export function contractLockProblems(label: string, schema: unknown): string[] {
  const problems: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${path}[${index}]`));
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    const record = node as Record<string, unknown>;

    const properties = record['properties'];
    if (typeof properties === 'object' && properties !== null) {
      for (const [name, child] of Object.entries(properties as Record<string, unknown>)) {
        if ((VISIBILITY_KEYS as readonly string[]).includes(name) && !lockedToPrivate(child)) {
          problems.push(
            `${label} ${path}.properties.${name}: không còn khoá ở \`"${ALLOWED_VALUE}"\` ` +
              `(cần \`const: "${ALLOWED_VALUE}"\` hoặc \`enum: ["${ALLOWED_VALUE}"]\`) — ` +
              `nới bất biến I5 cần một quyết định \`irreversible\` (CHARTER 2.3 nhóm 4) VÀ sửa CHARTER mục 3, ` +
              `tức một PR \`owner-merge\`. Đừng đọc cửa merge của chính PR này thay cho điều đó: ` +
              `một PR chỉ sửa \`kernel/contracts/**\` ra \`automerge-delayed\`, nên máy sẽ merge nó sau 12 giờ ` +
              `mà không ai duyệt việc nới một bất biến.`,
          );
        }
      }
    }

    for (const [key, child] of Object.entries(record)) walk(child, `${path}.${key}`);
  };
  walk(schema, '');
  return problems;
}

/** Soát mọi contract dưới `kernel/contracts/`. */
export function allContractLockProblems(root: string): { problems: string[]; locked: number } {
  const problems: string[] = [];
  let locked = 0;
  const dir = join(root, 'kernel', 'contracts');
  if (!existsSync(dir)) return { problems, locked };
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.schema.json')) continue;
    const schema: unknown = JSON.parse(readFileSync(join(dir, entry), 'utf8'));
    const found = contractLockProblems(`kernel/contracts/${entry}`, schema);
    problems.push(...found);
    if (found.length === 0 && JSON.stringify(schema).includes(`"${VISIBILITY_KEYS[0]}"`)) locked += 1;
  }
  return { problems, locked };
}

const isMain = process.argv[1] !== undefined && process.argv[1].endsWith('check-visibility.ts');

if (isMain) {
  const root = process.cwd();
  const scan = scanVisibility(root);
  const contracts = allContractLockProblems(root);
  const problems = [...contracts.problems, ...scan.problems];

  if (problems.length > 0) {
    process.stderr.write(
      `Bất biến I5 có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`,
    );
    process.exit(1);
  }

  // In ở MỌI lần chạy, kể cả khi `allowed` rỗng — im lặng ở đây đúng là thứ nhóm Z cấm.
  process.stdout.write(
    `I5 ok: ${scan.sites} chỗ đặt visibility/privacyStatus trong ${scan.filesScanned} file nguồn đều là "${ALLOWED_VALUE}", ` +
      `${contracts.locked} contract khoá bằng const/enum một giá trị, ` +
      `${SCAN_EXCLUDED.length} file đứng ngoài phép quét (${SCAN_EXCLUDED.join(', ')}). ` +
      `Dòng khai ${ALLOW_MARKER} ${scan.allowed.length}${scan.allowed.length === 0 ? '.' : `:\n${scan.allowed.map((a) => `  - ${a}`).join('\n')}`}\n`,
  );
}
