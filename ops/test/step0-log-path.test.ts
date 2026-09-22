/**
 * Mục `P-023` · **bằng chứng bằng chạy thật, không bằng lập luận.**
 *
 * Tiêu chí xong của mục đòi đúng phép đo này: dựng lại hình dạng đã gây tắc
 * — hai nhánh cùng mang một dòng bước 0, một bên vào `main` trước — rồi đo
 * `git merge-tree --write-tree` ở chế độ **tắt** `merge=union`. Trước khi
 * sửa: `EXIT=1`. Sau khi sửa: `EXIT=0`.
 *
 * ## Vì sao phải tắt `merge=union`, và vì sao đó không phải gian lận
 *
 * `KF-009`, đo được hai lần độc lập: **GitHub không áp `.gitattributes`**
 * khi nó tự tính `mergeable` trên trang PR, còn `automerge.yml` thì nghe
 * phía GitHub. Nên phép đo có union bật trả lời câu hỏi *"git ở máy có gộp
 * được không"* — một câu hỏi khác. Câu hỏi thật là *"PR này có tự merge
 * được không"*, và cách mô phỏng nó là ghi `-merge` vào
 * `.git/info/attributes`, vốn thắng `.gitattributes` trong cây.
 *
 * Bài kiểm chạy CẢ HAI phép đo cho CẢ HAI hình dạng. Chỉ đo một phía là
 * đúng lỗi mà `P-015` đã mắc hai lần (`ops/known-failures.md`): bài thử
 * dựng ở trạng thái mà lỗi thật không xảy ra được.
 *
 * ## Ca âm bắt buộc
 *
 * Nếu bỏ hẳn phần "trước khi sửa" thì bài kiểm chỉ còn nói "hai file khác
 * nhau thì không xung đột" — đúng nhưng rỗng, và nó xanh cả khi ai đó lặng
 * lẽ đưa dòng bước 0 quay về file dùng chung. Ca "trước" chính là ca âm:
 * nó phải ĐỎ (EXIT=1), và nếu một ngày nào đó nó hết đỏ thì giả định của
 * mục này đã đổi và phải đọc lại, chứ không phải xoá bài kiểm.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { formatLogLine, step0LogPath, step0LogRef, STEP0_LOG_LANE, type RunLogLine } from '@crux/kernel';

const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(cwd: string, args: readonly string[]) {
  return spawnSync('git', [...args], { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

/** Dòng bước 0 của một lượt chạy, đúng hình dạng bất biến I8 đòi. */
function step0Line(at: string, runner: string): string {
  const line: RunLogLine = {
    at,
    lane: STEP0_LOG_LANE,
    kind: 'lane',
    ref: step0LogRef(at, runner),
    status: 'ok',
    durationMs: 0,
    costUsd: 0,
    note: `bước 0 của lượt ${runner}`,
  };
  return `${formatLogLine(line)}\n`;
}

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  appendFileSync(full, content, 'utf8');
}

/**
 * Repo thật, mang sẵn `.gitattributes` với luật union — tức là điều kiện
 * **thuận lợi nhất** cho hình dạng cũ. Lỗ hổng `G17` (luật không áp cho
 * chính lần gộp mang nó tới) vì thế không dính vào phép đo này.
 */
function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'step0-log-repo-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'Test']);
  writeFileSync(
    join(dir, '.gitattributes'),
    'ops/logs/*.jsonl              merge=union\nops/logs/**/*.jsonl           merge=union\n',
    'utf8',
  );
  // File dùng chung đã có sẵn dòng của các lượt trước — đúng trạng thái
  // `main` đang có (`ops/logs/platform/P-016.jsonl`).
  write(dir, 'ops/logs/platform/P-016.jsonl', step0Line('2026-09-21T20:12:00Z', 'crux-integrator'));
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'gốc']);
  git(dir, ['branch', 'feature']);
  return dir;
}

/** Ghi `-merge` vào `.git/info/attributes` — cách KF-009 mô phỏng phía GitHub. */
function disableUnion(dir: string): void {
  const path = join(dir, '.git', 'info', 'attributes');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'ops/logs/*.jsonl -merge\nops/logs/**/*.jsonl -merge\n', 'utf8');
}

function enableUnion(dir: string): void {
  rmSync(join(dir, '.git', 'info', 'attributes'), { force: true });
}

/** `true` nghĩa là gộp thử XUNG ĐỘT — đúng thứ làm PR không tự merge được. */
function mergeConflicts(dir: string): boolean {
  return git(dir, ['merge-tree', '--write-tree', 'feature', 'main']).status !== 0;
}

/**
 * Dựng đúng hình dạng đã gây tắc: hai lượt bước 0 chạy gần nhau, lượt của
 * `main` vào trước, lượt của nhánh nằm trong PR đang mở.
 */
function twoStep0Runs(dir: string, pathFor: (root: string, at: string, runner: string) => string): void {
  const onMain = { at: '2026-09-21T21:22:51Z', runner: 'crux-integrator' };
  const onBranch = { at: '2026-09-21T21:39:22Z', runner: 'crux-worker-1' };

  git(dir, ['checkout', '-q', 'main']);
  write(dir, relTo(dir, pathFor(dir, onMain.at, onMain.runner)), step0Line(onMain.at, onMain.runner));
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'main: dòng bước 0 của lượt integrator']);

  git(dir, ['checkout', '-q', 'feature']);
  write(dir, relTo(dir, pathFor(dir, onBranch.at, onBranch.runner)), step0Line(onBranch.at, onBranch.runner));
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'nhánh: dòng bước 0 của lượt worker']);
}

function relTo(root: string, full: string): string {
  return full.slice(root.length + 1);
}

/** Hình dạng **trước** `P-023`: mọi lượt dồn vào một file mang mã mục. */
function sharedItemPath(root: string): string {
  return join(root, 'ops', 'logs', 'platform', 'P-016.jsonl');
}

test('P-023 · TRƯỚC — file dùng chung: hai lượt bước 0 XUNG ĐỘT ở phép đo mô phỏng GitHub', () => {
  const dir = initRepo();
  try {
    twoStep0Runs(dir, sharedItemPath);

    // (A) union BẬT — `git` ở máy gộp sạch. Đây chính là chỗ đánh lừa: mọi
    // phép đo ở phía worker nói "không sao".
    enableUnion(dir);
    assert.equal(mergeConflicts(dir), false, 'với union bật, git ở máy gộp sạch — đúng như KF-009 mô tả');

    // (B) union TẮT — phía GitHub. ĐỎ. Đây là EXIT=1 mà tiêu chí xong đòi.
    disableUnion(dir);
    assert.equal(
      mergeConflicts(dir),
      true,
      'hình dạng cũ PHẢI xung đột ở phép đo mô phỏng GitHub — nếu ca này hết đỏ thì ' +
        'giả định của P-023 đã đổi, đọc lại KF-009 chứ đừng xoá bài kiểm',
    );

    // Và xung đột đúng ở file dùng chung, không phải ở thứ gì khác.
    const out = git(dir, ['merge-tree', '--write-tree', 'feature', 'main']).stdout;
    assert.match(out, /ops\/logs\/platform\/P-016\.jsonl/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P-023 · SAU — một lượt một file: gộp SẠCH ở cả hai phép đo', () => {
  const dir = initRepo();
  try {
    twoStep0Runs(dir, step0LogPath);

    disableUnion(dir);
    assert.equal(mergeConflicts(dir), false, 'phép đo mô phỏng GitHub: EXIT=0 — đây là điều mục này đi lấy');

    enableUnion(dir);
    assert.equal(mergeConflicts(dir), false, 'và union bật cũng sạch — không đánh đổi gì');

    // Hai lượt nằm ở hai file, cùng thư mục làn. Không phải "xung đột đã
    // được giải" — là "không còn gì để xung đột".
    git(dir, ['checkout', '-q', 'main']);
    const mainFiles = git(dir, ['ls-tree', '--name-only', 'main', `ops/logs/${STEP0_LOG_LANE}/`]).stdout.trim();
    const branchFiles = git(dir, ['ls-tree', '--name-only', 'feature', `ops/logs/${STEP0_LOG_LANE}/`]).stdout.trim();
    assert.notEqual(mainFiles, '');
    assert.notEqual(branchFiles, '');
    assert.notEqual(mainFiles, branchFiles);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('P-023 · dòng CŨ trong `P-016.jsonl` không bị chuyển đi và không bị xoá', () => {
  // Log append-only (`ops/logs/README.md`). Mục này thêm một chỗ ghi mới,
  // nó KHÔNG dọn chỗ cũ — bên đọc phải hiểu cả hai chỗ cho tới khi các dòng
  // cũ rơi khỏi mọi cửa sổ thời gian đang dùng.
  const shared = join(process.cwd(), 'ops', 'logs', 'platform', 'P-016.jsonl');
  const content = readFileSync(shared, 'utf8');
  const count = content.split('\n').filter((l) => l.trim().length > 0).length;
  assert.ok(count > 0, 'ops/logs/platform/P-016.jsonl phải còn nguyên các dòng bước 0 cũ');
});

/**
 * ## Bên đọc không được neo vào MỘT tên file
 *
 * Tiêu chí xong của `P-023` nói `ops/scripts/digest-metrics.ts` và
 * `ops/scripts/conflict-watch.ts` "đang đọc đích danh
 * `ops/logs/platform/P-016.jsonl`". **Đo lại thì không phải vậy** —
 * `digest-metrics.ts` gọi `readRunLogs(ops/logs)` trên cả thư mục, còn
 * `conflict-watch.ts` không đọc log bước 0 chút nào: nó **đo lại** mốc kẹt
 * bằng cách gộp thử với từng commit của `main`. Chỗ duy nhất neo vào tên
 * file là **văn xuôi** — một chú thích trong `conflict-watch.ts` và hai chỗ
 * trong `CHARTER.md`. Sửa ba chỗ đó là đủ; không có sửa code bên đọc nào
 * để làm, và bịa ra một bản sửa để khớp mô tả thì tệ hơn là nói sai lệch.
 *
 * Thứ đáng khoá bằng máy là chính luật đó: **không file code nào được
 * nhắc tới một đường dẫn log bước 0 cố định.** Neo vào tên file là cách
 * bên đọc hỏng im lặng ở lượt đầu tiên tên file đổi.
 */
test('P-023 · không file code nào neo vào một đường dẫn log bước 0 cố định', async () => {
  const { readdirSync } = await import('node:fs');
  // Phạm vi quét phải trùng với lời bài kiểm tự khai. Vòng soát chéo bắt
  // đúng ba chỗ lọt ở bản đầu: quét không đệ quy (`ops/scripts/sub/x.ts`
  // lọt), thiếu `ops/*.ts` và `ops/workflows/` (`ops/invariants.*` lọt),
  // và regex chỉ khớp tên file CŨ (neo vào tên file MỚI lọt — đúng chiều
  // hỏng mà mục này lo nhất).
  const roots = [
    join(process.cwd(), 'ops', 'scripts'),
    join(process.cwd(), 'ops', 'workflows'),
    join(process.cwd(), 'ops'),
    join(process.cwd(), 'kernel', 'src'),
  ];
  const CODE = /\.(ts|mjs|js|yml|yaml)$/;
  // Bất kỳ đường dẫn log bước 0 cố định nào — cũ (`P-016`) hoặc mới (`step0`).
  const HARDCODED = /ops\/logs\/[^'"`\s]*(step0|P-016)[^'"`\s]*\.jsonl/;

  const offenders: string[] = [];
  const seen = new Set<string>();
  let scanned = 0;

  for (const root of roots) {
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !CODE.test(entry.name)) continue;
      const full = join(entry.parentPath ?? root, entry.name);
      // `node_modules` là phụ thuộc, không phải code của repo — và workspace
      // này nối `@crux/kernel` vào đó bằng symlink, nên quét nó là quét lại
      // chính mình dưới bảy đường dẫn khác nhau.
      if (full.includes(`${sep}node_modules${sep}`)) continue;
      // Bài kiểm ĐƯỢC PHÉP nhắc tên file: đó là việc của chúng (ca âm của
      // chính bài này dựng đúng hình dạng cũ).
      if (full.includes(`${sep}ops${sep}test${sep}`)) continue;
      if (seen.has(full)) continue; // `ops/` lồng `ops/scripts/` — đừng đếm hai lần
      seen.add(full);
      scanned += 1;
      // `kernel/src/log.ts` được phép nhắc tên file trong phần giải thích:
      // nó LÀ chỗ định nghĩa luật, và nó không đọc file nào.
      if (full.endsWith(join('kernel', 'src', 'log.ts'))) continue;
      if (HARDCODED.test(readFileSync(full, 'utf8'))) offenders.push(full);
    }
  }

  assert.ok(scanned > 30, `chỉ quét được ${scanned} file — bài kiểm này sẽ xanh giả`);
  assert.deepEqual(
    offenders,
    [],
    `file code còn neo vào một đường dẫn log bước 0 cố định: ${offenders.join(', ')}. ` +
      'Dùng readRunLogs trên cả ops/logs, hoặc step0LogPath của kernel.',
  );
});

/**
 * ## `KF-013` · hai PR xanh, gộp vào nhau thì `main` đỏ (ca âm đích danh)
 *
 * Bất biến trên đã có từ `P-023`, nhưng nó quét **cả kho** một lần — khi đỏ,
 * lời báo chỉ liệt kê file, không nói *vì sao* file đó có mặt. Ca này ghim
 * đích danh chỗ đã làm `main` đỏ thật lúc 2026-09-22T10:12Z: `P-023` thêm
 * bất biến, `P-027` thêm `ops/scripts/gate-flow.ts` với một chú thích nhắc
 * đích danh một đường dẫn log bước 0. Hai PR **xanh riêng lẻ** (mỗi bên chỉ
 * có một trong hai file), gộp vào `main` mới đỏ — không PR nào một mình bắt
 * được. Nhóm **Z**. Đây là bài kiểm TÁI HIỆN của bản sửa (bất biến I2):
 * chạy trên `gate-flow.ts` trước khi sửa thì ĐỎ, sau khi sửa thì xanh.
 */
test('KF-013 · gate-flow.ts không neo vào một đường dẫn log bước 0 cố định', () => {
  const HARDCODED = /ops\/logs\/[^'"`\s]*(step0|P-016)[^'"`\s]*\.jsonl/;
  const gateFlow = join(process.cwd(), 'ops', 'scripts', 'gate-flow.ts');
  const body = readFileSync(gateFlow, 'utf8');
  assert.equal(
    HARDCODED.test(body),
    false,
    'ops/scripts/gate-flow.ts nhắc đích danh một đường dẫn log bước 0 (P-016/step0 .jsonl) — ' +
      'đúng chỗ đã làm main đỏ ở KF-013. Dùng lời chung ("các dòng log bước 0") thay vì tên file.',
  );
});
