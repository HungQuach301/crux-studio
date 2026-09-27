/**
 * `D-C04` · hình dạng của `ops/logs/` — **không còn file `.jsonl` phẳng nào**.
 *
 * `D-C04` (mục `P-018`) chuyển bất biến **I8** từ `ops/logs/<lane>.jsonl`
 * sang `ops/logs/<lane>/<id>.jsonl`. Nhưng một PR xoá hết file phẳng vẫn
 * chưa khoá được hình dạng đó, vì file phẳng **quay lại được mà không gì đỏ**:
 *
 * - Một làn mới ghi dòng log đầu tiên của nó vào `ops/logs/<lane>.jsonl` —
 *   `readRunLogs` vẫn đọc, `pnpm check` vẫn xanh, không ai thấy.
 * - Và ca đã xảy ra **thật** lúc giải xung đột PR #26: `ops/logs/verify.jsonl`
 *   sinh ra trên `main` **sau** khi nhánh `P-018` rẽ ra (PR #29). Nhánh chưa
 *   từng thấy file đó, nên git coi đó là "thêm ở một bên" và **gộp vào êm ru,
 *   không một dấu xung đột nào**. Hai file `kernel.jsonl` và `visual.jsonl`
 *   không dính vì nhánh đã xoá chúng tường minh; `verify.jsonl` thì không ai
 *   xoá được vì lúc đó nó chưa tồn tại.
 *
 * Cả hai đường đều cho ra cùng một kết cục: PR xanh, merge được, mà hình dạng
 * `D-C04` vừa xoá vẫn nằm đó. Đúng nhóm Z (`ops/known-failures.md`) — hỏng mà
 * mọi chỉ báo đều xanh. Cách phát hiện phải là **một thứ ở ngoài đếm và so**,
 * và đó là bài kiểm này.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import {
  flatLogFiles,
  listLogFiles,
  misfiledLogLines,
  isStep0LogId,
  step0LogId,
  parseRunLogs,
  STEP0_LOG_LANE,
} from '@crux/kernel';
import { readFileSync } from 'node:fs';

const LOGS_DIR = join(process.cwd(), 'ops', 'logs');

test('D-C04 · KHÔNG còn file `.jsonl` phẳng nào trong `ops/logs/`', () => {
  const nested = listLogFiles(LOGS_DIR);

  // Chặn xanh giả: thư mục rỗng hay đường dẫn sai cũng cho `flatLogFiles`
  // trả rỗng, và lúc đó bài kiểm này xanh mà chưa nhìn gì.
  assert.ok(
    nested.length > 0,
    'không thấy file log nào dưới ops/logs/ — bài kiểm này sẽ xanh giả',
  );

  const flat = flatLogFiles(LOGS_DIR).map((path) => relative(process.cwd(), path).split(sep).join('/'));
  assert.deepEqual(
    flat,
    [],
    `còn file log phẳng sau D-C04: ${flat.join(', ')}. ` +
      'Mang từng dòng sang ops/logs/<lane>/<id>.jsonl theo trường `ref` ' +
      '(logIdFromRef + runLogPath của kernel), rồi xoá file phẳng.',
  );
});

test('D-C04 · mọi file log đều nằm ở đúng `ops/logs/<lane>/<id>.jsonl`', () => {
  // Không chỉ "không phẳng": cũng không được sâu hơn hai tầng, vì một
  // `ops/logs/platform/2026-09/P-018.jsonl` cũng là một hình dạng khác mà
  // `readRunLogs` vẫn đọc được — lại là nhóm Z.
  for (const path of listLogFiles(LOGS_DIR)) {
    const parts = relative(LOGS_DIR, path).split(sep);
    assert.equal(
      parts.length,
      2,
      `\`${relative(process.cwd(), path)}\` không đúng hình dạng ops/logs/<lane>/<id>.jsonl`,
    );
  }
});

/**
 * Test âm. Không có nó thì bài kiểm trên có thể xanh vì `flatLogFiles` hỏng
 * chứ không vì repo sạch — một bộ kiểm không chạy thì cũng không báo là nó
 * không chạy.
 */
test('D-C04 · test âm — một file phẳng PHẢI bị bắt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-logs-layout-'));
  try {
    // Hình dạng đúng: không được bị báo nhầm.
    mkdirSync(join(dir, 'platform'), { recursive: true });
    writeFileSync(join(dir, 'platform', 'P-018.jsonl'), '{"costUsd":0}\n', 'utf8');
    mkdirSync(join(dir, 'integration'), { recursive: true });
    writeFileSync(join(dir, 'integration', 'I-001.jsonl'), '{"costUsd":0}\n', 'utf8');
    assert.deepEqual(flatLogFiles(dir), [], 'hình dạng đúng mà bị báo là phẳng');

    // Hình dạng cũ quay lại: phải bị bắt.
    writeFileSync(join(dir, 'platform.jsonl'), '{"costUsd":0}\n', 'utf8');
    assert.deepEqual(flatLogFiles(dir), [join(dir, 'platform.jsonl')]);

    // Đúng ca của PR #26: một làn mới, file phẳng chưa từng có ở nhánh nào.
    writeFileSync(join(dir, 'verify.jsonl'), '{"costUsd":0}\n', 'utf8');
    assert.deepEqual(flatLogFiles(dir), [join(dir, 'platform.jsonl'), join(dir, 'verify.jsonl')]);

    // `ops/logs/` có dấu gạch chéo cuối vẫn phải ra cùng kết quả — nếu
    // không, bên gọi nào viết thế sẽ nhận "sạch" cho một thư mục bẩn.
    assert.equal(flatLogFiles(`${dir}${sep}`).length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D-C04 · test âm — thư mục chưa tồn tại thì rỗng, không ném', () => {
  assert.deepEqual(flatLogFiles(join(tmpdir(), 'crux-logs-khong-co-that-0f3a')), []);
});

/**
 * Hình dạng đúng **chưa đủ**: một dòng vẫn có thể nằm trong một file lồng thư
 * mục, đúng hai tầng, mà **sai file**.
 *
 * Đã xảy ra thật ở lần gộp thứ hai của PR #26, và **không một dấu xung đột nào**:
 * nhánh xoá `ops/logs/verify.jsonl` rồi tạo `ops/logs/verify/VF-G2.jsonl` với
 * đúng nội dung đó, nên git **nhận ra một lần đổi tên**. `main` thêm một dòng
 * `ref: "verify/VF-G11"` vào file phẳng cũ ⇒ git áp thay đổi ấy lên đường dẫn
 * đã đổi tên, `merge=union` gộp êm, và dòng `VF-G11` nằm gọn trong `VF-G2.jsonl`.
 *
 * Không dòng nào mất, `flatLogFiles` xanh, `pnpm check` xanh — chỉ là chi phí
 * của `VF-G11` từ nay tính cho `VF-G2`. Đúng nhóm Z, và đúng loại lỗi mà
 * `D-C04` sinh ra để xoá (mỗi mục một file thì mới đếm tiền theo mục được).
 */
test('D-C04 · mỗi dòng log nằm ĐÚNG file của nó (`lane` và `ref` khớp đường dẫn)', () => {
  const misfiled = misfiledLogLines(LOGS_DIR).map(
    (m) => `${relative(process.cwd(), m.file)} chứa ref=${m.ref} (đúng ra ở ${relative(process.cwd(), m.expected)})`,
  );
  assert.deepEqual(
    misfiled,
    [],
    `dòng log nằm sai file: ${misfiled.join(' · ')}. ` +
      'Không gì đỏ khi việc này xảy ra, nhưng chi phí của mục này bị tính cho mục kia.',
  );
});

test('D-C04 · test âm — dòng nằm sai file PHẢI bị bắt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-logs-misfiled-'));
  const line = (lane: string, ref: string) =>
    `${JSON.stringify({ at: '2026-09-21T08:00:00.000Z', lane, kind: 'lane', ref, status: 'ok', durationMs: 0, costUsd: 0 })}\n`;
  try {
    mkdirSync(join(dir, 'verify'), { recursive: true });
    writeFileSync(join(dir, 'verify', 'VF-G2.jsonl'), line('verify', 'verify/VF-G2'), 'utf8');
    assert.deepEqual(misfiledLogLines(dir), [], 'dòng đúng chỗ mà bị báo là sai');

    // Đúng ca của PR #26: dòng VF-G11 bị git đổi-tên-rồi-union vào file VF-G2.
    writeFileSync(
      join(dir, 'verify', 'VF-G2.jsonl'),
      line('verify', 'verify/VF-G2') + line('verify', 'verify/VF-G11'),
      'utf8',
    );
    const misfiled = misfiledLogLines(dir);
    assert.equal(misfiled.length, 1);
    assert.equal(misfiled[0]!.ref, 'verify/VF-G11');
    assert.equal(misfiled[0]!.expected, join(dir, 'verify', 'VF-G11.jsonl'));

    // Sai `lane` cũng phải bị bắt: integrator ghi hộ mà bỏ nhầm vào thư mục làn mình.
    mkdirSync(join(dir, 'integration'), { recursive: true });
    writeFileSync(join(dir, 'integration', 'P-016.jsonl'), line('platform', 'platform/P-016'), 'utf8');
    assert.equal(misfiledLogLines(dir).length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Mục `P-023` · **mốc trong tên file phải khớp `at` của dòng bên trong.**
 *
 * `misfiledLogLines` chỉ hỏi `lane` và `logIdFromRef(ref)` có khớp đường dẫn
 * không. Với file bước 0 thì chưa đủ: `ref` khớp tên file là chuyện dễ —
 * bên ghi ghép cả hai từ cùng một chuỗi — nhưng **mốc** trong tên file có
 * đúng là mốc của lượt chạy đó không thì không ai hỏi. Lệch mốc là hai lượt
 * khác nhau mang tên trùng, hoặc một lượt mang tên khai sai giờ, mà không
 * gì đỏ: nhóm Z.
 *
 * Bài kiểm này quan trọng hơn bình thường vì **chưa routine nào gọi
 * `step0LogPath` từ trong code** — dòng bước 0 do routine viết theo văn xuôi
 * của CHARTER phụ lục P3 bước 0d. Chừng nào còn vậy, chỗ duy nhất bắt được
 * một tên file ghép tay sai là ở đây.
 */
test('P-023 · file log bước 0: mốc trong tên file khớp `at` của từng dòng', () => {
  const step0Files = listLogFiles(LOGS_DIR).filter((path) => {
    const parts = relative(LOGS_DIR, path).split(sep);
    return parts.length === 2 && isStep0LogId(parts[1]!.replace(/\.jsonl$/, ''));
  });

  assert.ok(
    step0Files.length > 0,
    'không thấy file log bước 0 nào — bài kiểm này sẽ xanh giả. ' +
      'Nếu đúng là chưa có, đó là dấu hiệu CHARTER P3 bước 0d không được làm theo.',
  );

  for (const path of step0Files) {
    const id = relative(LOGS_DIR, path).split(sep)[1]!.replace(/\.jsonl$/, '');
    const lines = parseRunLogs([readFileSync(path, 'utf8')]);
    assert.ok(lines.length > 0, `${id}: file log bước 0 rỗng`);

    for (const line of lines) {
      assert.equal(line.lane, STEP0_LOG_LANE, `${id}: dòng bước 0 phải mang lane ${STEP0_LOG_LANE}`);
      // Tên routine là phần sau mốc; lấy lại nó từ chính tên file rồi dựng
      // lại mã từ `at`. Khớp thì mốc đúng, không khớp thì tên file nói dối.
      const runner = id.slice('step0-'.length).split('-').slice(3).join('-');
      assert.equal(
        step0LogId(line.at, runner),
        id,
        `${id}: mốc trong tên file không khớp \`at\` của dòng (${line.at}). ` +
          'Dùng step0LogPath/step0LogRef của kernel, đừng ghép tên file bằng tay.',
      );
    }
  }
});

// ── Mục `integration/I-023` — sáu phép phá SỐNG SÓT của `KF-050` ────────────

/**
 * Mốc bắt đầu áp ba luật **chặt** (`kind`/`status` thuộc tập hợp lệ,
 * `durationMs > 0`, dòng bước 0 mang `step0` và `note`) lên log THẬT.
 *
 * Vì sao có mốc: log append-only (`D-C04`) nên dòng cũ **không** sửa được, và
 * đo trên `main` lúc viết mục này thì dòng cũ vi phạm thật — 423/515 dòng
 * `durationMs: 0` (mới nhất `step0-2026-09-27T102833Z-crux-worker-3`), 6 dòng
 * `kind: "item"` (`P-050`, `P-061`, `P-062`, mới nhất `2026-09-26T23:48Z`), 45
 * dòng bước 0 thiếu `step0` (mới nhất `2026-09-24T03:41Z`, trước `P-033`).
 * Mốc đặt ngay sau dòng vi phạm mới nhất; mọi dòng từ đó trở đi đo được là
 * sạch. Cùng hình dạng mốc ân hạn của job `no-model-name` (`🤖 [QĐ] #165`).
 *
 * Chỗ chưa che, khai ra: mốc đọc từ `at` do chính bên ghi khai, nên một dòng
 * ghi lùi `at` về trước mốc thì lọt. Bài `P-023` ở trên buộc `at` khớp mốc
 * trong tên file **bước 0**; dòng thường thì chưa có gì buộc.
 */
const LOG_SHAPE_STRICT_FROM = '2026-09-27T10:30:00.000Z';

const VALID_KINDS: readonly string[] = ['stage', 'lane'];
const VALID_STATUSES: readonly string[] = ['ok', 'failed', 'skipped'];

/**
 * Mọi chỗ sai hình dạng trong một tập file log, mỗi chỗ một câu. Đọc **thô**
 * từng file chứ không qua `readRunLogs`: phép đếm trùng phải thấy hai dòng
 * y hệt trong **một** file — đúng ca `.gitattributes` cảnh báo *"Union không
 * khử trùng lặp"*.
 */
function logShapeProblems(files: readonly string[], strictFrom: string): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const path of files) {
    const name = relative(process.cwd(), path);
    for (const line of parseRunLogs([readFileSync(path, 'utf8')])) {
      const raw = line as unknown as Record<string, unknown>;
      const key = `${line.at}|${line.ref}`;
      const where = `${name} (${line.ref} @ ${line.at})`;
      if (seen.has(key)) problems.push(`${where}: cặp (at, ref) TRÙNG với ${seen.get(key)}`);
      else seen.set(key, name);
      if (!(line.costUsd >= 0)) problems.push(`${where}: costUsd âm (${line.costUsd})`);
      if (line.at < strictFrom) continue;
      if (!VALID_KINDS.includes(raw.kind as string)) problems.push(`${where}: kind ${JSON.stringify(raw.kind)} ngoài tập hợp lệ`);
      if (!VALID_STATUSES.includes(raw.status as string)) problems.push(`${where}: status ${JSON.stringify(raw.status)} ngoài tập hợp lệ`);
      if (!(typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs > 0)) {
        problems.push(`${where}: durationMs ${JSON.stringify(raw.durationMs)} — một lượt chạy không tốn 0 ms`);
      }
      const id = typeof line.ref === 'string' ? line.ref.slice(line.ref.indexOf('/') + 1) : '';
      if (isStep0LogId(id)) {
        if (!Array.isArray(raw.step0)) problems.push(`${where}: dòng bước 0 thiếu mảng step0 (P-033)`);
        if (!(typeof raw.note === 'string' && raw.note.trim().length > 0)) problems.push(`${where}: dòng bước 0 thiếu note`);
      }
    }
  }
  return problems;
}

test('KF-050 · trên ops/logs THẬT: không cặp (at, ref) trùng, và dòng từ mốc chặt đúng hình dạng', () => {
  const files = listLogFiles(LOGS_DIR);
  assert.ok(files.length > 0, 'không thấy file log nào — bài kiểm này sẽ xanh giả');
  assert.ok(
    parseRunLogs(files.map((path) => readFileSync(path, 'utf8'))).some((line) => line.at >= LOG_SHAPE_STRICT_FROM),
    'không dòng nào từ mốc chặt trở đi — ba luật chặt đang không kiểm gì',
  );
  assert.deepEqual(logShapeProblems(files, LOG_SHAPE_STRICT_FROM), []);
});

/**
 * Ca âm cho từng phép phá (bài học `KF-003`): mỗi phép dưới đây đã **sống sót**
 * `pnpm check` ở vòng soát của `#309`. Dòng sạch ở đầu phải ra rỗng, rồi mỗi
 * phép áp riêng phải ra đúng một câu.
 */
test('KF-050 · ca âm — từng phép phá trong sáu phép PHẢI bị bắt, dòng sạch thì không', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crux-logs-shape-'));
  const at = '2026-09-27T12:00:00.000Z';
  const id = step0LogId(at, 'crux-worker-1');
  const clean = {
    at,
    lane: STEP0_LOG_LANE,
    kind: 'lane',
    ref: `${STEP0_LOG_LANE}/${id}`,
    status: 'ok',
    durationMs: 300000,
    costUsd: 0,
    step0: [],
    note: 'Bước 0 lượt thử.',
  };
  const check = (lines: readonly object[]): string[] => {
    const file = join(dir, `${id}.jsonl`);
    writeFileSync(file, lines.map((line) => `${JSON.stringify(line)}\n`).join(''), 'utf8');
    return logShapeProblems([file], LOG_SHAPE_STRICT_FROM);
  };
  const { step0: _step0, ...noStep0 } = clean;
  const { note: _note, ...noNote } = clean;
  try {
    assert.deepEqual(check([clean]), [], 'dòng sạch mà bị báo sai');
    const mutations: [string, object[], RegExp][] = [
      ['hai dòng y hệt trong một file', [clean, clean], /TRÙNG/],
      ['costUsd âm', [{ ...clean, costUsd: -1 }], /costUsd âm/],
      ['status ngoài tập', [{ ...clean, status: 'xanh' }], /status "xanh"/],
      ['kind ngoài tập', [{ ...clean, kind: 'item' }], /kind "item"/],
      ['durationMs 0', [{ ...clean, durationMs: 0 }], /durationMs 0/],
      ['thiếu step0', [noStep0], /thiếu mảng step0/],
      ['xoá note', [noNote], /thiếu note/],
      ['note rỗng', [{ ...clean, note: '  ' }], /thiếu note/],
    ];
    for (const [label, lines, expected] of mutations) {
      const problems = check(lines);
      assert.equal(problems.length, 1, `${label}: ${problems.join(' · ')}`);
      assert.match(problems[0]!, expected, label);
    }
    // Mốc ân hạn: cùng phép phá trên dòng TRƯỚC mốc thì không bị bắt (trừ trùng
    // và costUsd âm, hai luật áp cho mọi dòng) — dòng cũ append-only không sửa được.
    const old = { ...clean, at: '2026-09-27T10:28:33.495Z', durationMs: 0, kind: 'item', ref: 'platform/P-062', lane: 'platform' };
    assert.deepEqual(check([old]), []);
    assert.equal(check([old, old]).length, 1, 'trùng (at, ref) phải bị bắt cả trước mốc');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
