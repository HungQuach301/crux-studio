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
import { flatLogFiles, listLogFiles } from '@crux/kernel';

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
