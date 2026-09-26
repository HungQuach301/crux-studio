/**
 * Mục `platform/P-061` — **một `pnpm` lồng bên trong script không được im
 * theo người gọi.** `KF-045`.
 *
 * `pnpm -s run <script>` (và `pnpm -s <script>`) xuất
 * **`npm_config_reporter=silent`** vào môi trường của script. Mọi `pnpm` mà
 * script đó spawn ra kế thừa biến ấy và in **0 byte** ra cả `stdout` lẫn
 * `stderr`, dù mã thoát vẫn đúng. Đo được, trong một gói rỗng:
 *
 * ```
 * npm_config_reporter=silent pnpm install --frozen-lockfile → rc=0, stdout 0B
 *                            pnpm install --frozen-lockfile → rc=0, stdout KHÁC RỖNG
 * ```
 *
 * Với phần lớn lệnh thì mất chữ chỉ là mất chữ. Với `verifyLockfileInstall`
 * (`integrator-lockfile.ts`) thì không: nó **cài thật** rồi gói nguyên văn
 * đầu ra vào `reason`, và `reason` là bằng chứng **duy nhất** để lượt sau
 * phân biệt *"lockfile lệch manifest"* với *"không ra được mạng"* — integrator
 * dựa vào đó ở bước 0b của phụ lục P3 để quyết `aborted-ineligible`.
 *
 * **Vì sao xoá biến, không đặt tường minh một mức in khác:** mức mặc định
 * của `pnpm` là mức mà `ERR_PNPM_*` đã được đo là có mặt (bài `TÁI HIỆN
 * I-006`). Đặt một giá trị cụ thể là chọn thay cho `pnpm` một mức mà chưa
 * lần chạy nào đo — và `append-only`/`ndjson` đổi cả hình dạng đầu ra. Xoá
 * thì về đúng mức đã đo.
 *
 * **Vì sao chặn ở tầng hàm, không cấm `-s` ở tầng luật:** `pnpm -s check`
 * vẫn là một cách gọi hợp lệ và vẫn xanh sau bản sửa. Một luật trong
 * `CLAUDE.md` không chặn được một chữ `-s` gõ tay; một hàm dựng `env` thì
 * chặn được mọi người gọi, kể cả người gọi chưa tồn tại.
 *
 * **Chỉ xoá đúng biến đó.** Mọi biến khác của người gọi — `PATH`, `CI`
 * (quyết `frozen-lockfile` mặc định, xem `regenerateLockfile`), cấu hình
 * registry, proxy — đi qua nguyên vẹn. Bài âm trong
 * `ops/test/pnpm-env.test.ts` canh chiều này, để bản sửa không rút thành
 * "bỏ qua env của người gọi" một cách vô điều kiện.
 */

/**
 * Tên biến bị xoá, so **không phân biệt hoa thường**: `pnpm` đọc cấu hình
 * `npm_config_*` theo cả hai dạng (cùng quy ước với `npm`), nên chỉ xoá dạng
 * thường là để lọt `NPM_CONFIG_REPORTER`.
 */
const INHERITED_REPORTER = /^npm_config_reporter$/i;

/**
 * Bản sao của `base` (mặc định `process.env`) **không** có
 * `npm_config_reporter` ở bất kỳ dạng hoa thường nào. Không sửa `base`.
 */
export function pnpmEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(base)) {
    if (!INHERITED_REPORTER.test(key)) env[key] = value;
  }
  return env;
}

export interface UnguardedSpawn {
  /** Dòng (đánh số từ 1) của lời gọi spawn. */
  line: number;
  /** Đoạn đầu lời gọi, để người đọc tìm thấy ngay. */
  snippet: string;
}

/** Các hàm của `node:child_process` chạy được một lệnh ngoài. */
const SPAWN_CALL = /\b(spawnSync|spawn|execFileSync|execFile)\(\s*/g;

/**
 * Cắt đoạn lời gọi bắt đầu ở `open` (ngay sau dấu `(`) tới dấu `)` khớp
 * với nó. Bỏ qua ngoặc nằm trong chuỗi `'…'`, `"…"`, `` `…` `` và trong chú
 * thích `//…` / `/* … *\/` — chú thích thật trong `integrator-lockfile.ts`
 * mang cả `(` lẫn backtick ngay giữa khối tuỳ chọn của lời gọi. Đủ cho mã
 * của kho này, không nhận là một bộ phân tích cú pháp TypeScript.
 */
function callText(source: string, open: number): string {
  let depth = 1;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i);
    }
  }
  return source.slice(open);
}

/**
 * Mọi lời gọi spawn **chạy `pnpm`** trong `source` mà **không** truyền
 * `env: pnpmEnv(…)`. "Chạy `pnpm`" nghĩa là đối số đầu là chuỗi `'pnpm'`
 * hoặc một định danh mà file gán từ một biểu thức chứa `'pnpm'`
 * (`const pnpm = options.pnpmCommand ?? 'pnpm'`).
 *
 * Phép quét là **văn bản**, nên nó có hai giới hạn khai trước: một lệnh
 * `pnpm` dựng qua nhiều bước gán (hoặc qua `shell: true` với chuỗi lệnh)
 * thì lọt; và một lời gọi có chữ `env: pnpmEnv(` trong một chuỗi thì được
 * cho qua. Cả hai chưa có ca thật trong kho — hôm nay cổng này
 * tìm ra đúng **ba** lời gọi, cả ba ở `integrator-lockfile.ts` (mục khai
 * hai — phép `grep` một dòng lúc mở mục không thấy lời gọi viết trên nhiều
 * dòng ở bước kiểm lại của `regenerateLockfile`), nên nó là cổng **phòng
 * xa**, không phải cổng dọn nợ.
 */
export function findUnguardedPnpmSpawns(source: string): UnguardedSpawn[] {
  const pnpmNames = new Set<string>();
  for (const m of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*[^;\n]*['"`]pnpm['"`]/g)) {
    pnpmNames.add(m[1]!);
  }

  const found: UnguardedSpawn[] = [];
  for (const m of source.matchAll(SPAWN_CALL)) {
    const open = m.index! + m[0].length;
    const text = callText(source, open);
    const first = /^(?:(['"`])pnpm\1|(\w+))\s*[,)]?/.exec(text);
    if (first === null) continue;
    const runsPnpm = first[1] !== undefined || (first[2] !== undefined && pnpmNames.has(first[2]));
    if (!runsPnpm) continue;
    // Chữ `env: pnpmEnv(` trong một chú thích không phải bản sửa.
    const code = text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    if (/\benv\s*:\s*pnpmEnv\(/.test(code)) continue;
    found.push({
      line: source.slice(0, m.index).split('\n').length,
      snippet: `${m[1]}(${text.split('\n')[0]!.slice(0, 80)}`,
    });
  }
  return found;
}
