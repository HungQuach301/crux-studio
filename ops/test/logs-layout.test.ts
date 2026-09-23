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
