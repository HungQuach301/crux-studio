#!/usr/bin/env node
/**
 * Phạm vi của một sự cố `main` đỏ, ở dạng **máy đọc được** — nguồn duy nhất
 * cho điều kiện 2 của `D-C07` ("chỉ chạm đúng file nêu trong cảnh báo").
 *
 * `ops/workflows/main-ci.yml` giữ lại đầu ra của `pnpm check` khi nó đỏ, gọi
 * file này, rồi dán khối JSON kết quả vào thân issue cảnh báo dưới mốc
 * `<!-- crux-hotfix-scope -->`. `ops/invariants.hotfix-lane.ts` đọc đúng
 * khối đó và KHÔNG đọc gì khác trong thân issue.
 *
 * ## Vì sao dò theo tên file rồi đối chiếu với đĩa
 *
 * Bảy cổng của `pnpm check` in ra bảy kiểu thông báo khác nhau, và không
 * cổng nào hứa một hình dạng máy đọc được: `check-workflows.ts` in
 * `spike-canvas.yml:47` (tên trần, không có thư mục), `check-test-coverage.ts`
 * in đường dẫn đầy đủ `spike/canvas/test/camera.test.ts`, `node --test` in
 * tên bài test. Bắt từng cổng trả JSON là bảy lần sửa và bảy chỗ có thể lệch
 * nhau về sau.
 *
 * Nên phép dò ở đây làm đúng hai bước, cả hai đều kiểm được:
 *
 * 1. **Dò ứng viên** bằng hình dạng đường dẫn (đuôi file đã biết).
 * 2. **Đối chiếu với đĩa**: chỉ giữ ứng viên ứng với một file THẬT. Tên trần
 *    được nâng thành đường dẫn đầy đủ chỉ khi **đúng một** file trong repo
 *    mang tên đó — hai file trùng tên là hai chỗ sửa khác nhau, và đoán một
 *    trong hai sẽ nới phạm vi ra khỏi chỗ thật hỏng.
 *
 * Hướng an toàn là **rỗng**: không dò được gì thì `files: []`, và
 * `parseScope` coi đó là "không có lối nhanh". Một phép dò trượt làm mất một
 * nhịp, không làm thủng lớp chặn — mọi điều kiện còn lại của `D-C07` vẫn
 * phải đạt, và PR vẫn phải xanh đủ 5 check.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * `.github/` bị bỏ khỏi chỉ mục vì nó là **bản chép** của `ops/workflows/`
 * do `.github/workflows/sync-workflows.yml` sinh ra. Đo được lúc viết file
 * này: để nó trong chỉ mục thì `spike-canvas.yml` — tên trần mà
 * `check-workflows.ts` in ra — có HAI file mang tên đó, nên luật "chỉ nâng
 * tên trần khi nó duy nhất" bỏ luôn chỗ thật hỏng, và phạm vi thiếu đúng
 * file cần sửa. Bỏ bản chép ra là đúng cả về nghĩa: chỗ sửa được nằm ở
 * `ops/workflows/`, và `.github/**` không bao giờ đi lối nhanh (điều kiện 5
 * của `D-C07`).
 */
const IGNORED_DIRS = new Set(['node_modules', '.git', '.github', 'episodes']);

/** Đuôi file mà một sự cố `main` đỏ có thể nêu tên. */
const EXTENSIONS = ['ts', 'tsx', 'js', 'mjs', 'cjs', 'yml', 'yaml', 'json', 'md'] as const;

const CANDIDATE = new RegExp(`(?:[A-Za-z0-9_.@-]+/)*[A-Za-z0-9_.@-]+\\.(?:${EXTENSIONS.join('|')})`, 'g');

/**
 * Dòng do pnpm in ra để NHẮC LẠI lệnh nó sắp chạy, không phải dòng lỗi:
 *
 *     > crux-studio@0.0.0 contracts /home/user/crux-studio
 *     > node ops/scripts/check-contracts.ts
 *
 * **Đo được lúc viết file này, và đây là lý do luật này tồn tại:** không bỏ
 * hai dòng đó thì phạm vi của sự cố thật ngày 2026-09-23 ra **bốn** file —
 * `spike-canvas.yml` (thật) cộng `check-contracts.ts`, `check-workflows.ts`,
 * `lint-deps.ts` (chỉ vì tên chúng nằm trong dòng nhắc lệnh). Phạm vi là thứ
 * điều kiện 2 của `D-C07` cho phép chạm, nên nới nó bằng một dòng nhắc lệnh
 * là nới lối nhanh ra đúng tầng luật. Điều kiện 3 vẫn chặn hẳn ba file kia,
 * nên chỗ này không phải một lỗ — nhưng một phạm vi nói sai vẫn là một phạm
 * vi nói sai, và nó nói sai theo hướng rộng ra.
 */
const PNPM_ECHO = /^\s*>/;

/**
 * Dòng của `node --test` **không** phải thông báo lỗi, và đây là chỗ phình
 * phạm vi lớn nhất đã đo được.
 *
 * TAP in một dòng `ok <n> - <tên bài>` cho MỌI bài đã qua, cộng
 * `# Subtest: <tên bài>` cho từng bài, cộng một khối YAML (`location:`,
 * `stack:`, `expected:`, …). Tên bài trong repo này thường chứa nguyên
 * đường dẫn ("`ops/labels.json` đổi thì gọi labels"), nên 790 bài **xanh**
 * kéo theo tên của gần hết repo.
 *
 * **Đo được, và đây là lý do luật này tồn tại:** trên đầu ra thật của
 * `pnpm test` (5094 dòng, 3 bài đỏ) phạm vi ra **15** file — trong đó có
 * `CLAUDE.md`, `ops/workflows/ci.yml`, `ops/workflows/automerge.yml` và
 * chính `ops/scripts/main-red-scope.ts`. Bỏ hai loại dòng này: còn **2**
 * file, đúng hai chỗ hỏng thật (`spike-canvas.yml`, `camera.test.ts`).
 *
 * Giữ lại `not ok` và phần chữ của thông báo lỗi — đó là chỗ cổng đỏ nói
 * tên file thật.
 */
const TAP_NOISE =
  /^\s*(?:ok\s+\d|#|(?:location|stack|file|at|code|name|expected|actual|operator|duration_ms|type|failureType)\s*:|---\s*$|\.\.\.\s*$)/;

/**
 * Mọi chuỗi trông như một đường dẫn file trong đầu ra. Giữ nguyên thứ tự gặp,
 * bỏ trùng — thứ tự gặp là thứ tự cổng đỏ, đọc được hơn thứ tự chữ cái.
 */
export function extractCandidates(output: string): string[] {
  const seen = new Set<string>();
  for (const line of output.split('\n')) {
    if (PNPM_ECHO.test(line) || TAP_NOISE.test(line)) continue;
    for (const match of line.matchAll(CANDIDATE)) {
      const raw = match[0].replace(/^[./]+/, '');
      if (raw !== '') seen.add(raw);
    }
  }
  return [...seen];
}

/** Chỉ mục file thật của repo: đường dẫn đầy đủ, và tên trần khi nó là duy nhất. */
export interface RepoIndex {
  /** Mọi đường dẫn tương đối, dùng `/`. */
  paths: Set<string>;
  /** Tên trần → đường dẫn đầy đủ. Chỉ có mặt khi tên đó là DUY NHẤT trong repo. */
  uniqueByName: Map<string, string>;
}

export function indexRepo(root: string): RepoIndex {
  const paths = new Set<string>();
  const byName = new Map<string, string[]>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const rel = relative(root, full).split(sep).join('/');
      paths.add(rel);
      const existing = byName.get(entry);
      if (existing === undefined) byName.set(entry, [rel]);
      else existing.push(rel);
    }
  };
  walk(root);

  const uniqueByName = new Map<string, string>();
  for (const [name, hits] of byName) {
    if (hits.length === 1) uniqueByName.set(name, hits[0]!);
  }
  return { paths, uniqueByName };
}

/**
 * Ứng viên → đường dẫn thật. Bỏ ứng viên không ứng với file nào, và bỏ tên
 * trần trùng ở hai chỗ (xem chú thích đầu file). Kết quả sắp theo chữ cái để
 * hai lần chạy trên cùng một sự cố cho cùng một khối JSON.
 */
export function resolveScope(candidates: readonly string[], index: RepoIndex): string[] {
  const out = new Set<string>();
  for (const candidate of candidates) {
    if (index.paths.has(candidate)) {
      out.add(candidate);
      continue;
    }
    if (!candidate.includes('/')) {
      const unique = index.uniqueByName.get(candidate);
      if (unique !== undefined) out.add(unique);
    }
  }
  return [...out].sort();
}

/** Khối máy đọc mà `main-ci.yml` dán vào thân issue cảnh báo. */
export function renderScopeBlock(marker: string, sha: string, files: readonly string[]): string {
  return [`<!-- ${marker} -->`, '```json', JSON.stringify({ sha, files }), '```'].join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/scripts/main-red-scope.ts <file chứa đầu ra pnpm check> [sha]
//
// In ra đúng khối máy đọc, sẵn sàng dán vào thân issue cảnh báo.

const isMain = process.argv[1]?.endsWith('main-red-scope.ts') === true;

if (isMain) {
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write('cách dùng: node ops/scripts/main-red-scope.ts <file đầu ra pnpm check> [sha]\n');
    process.exit(2);
  }
  const sha = process.argv[3] ?? '';
  // Đầu ra của `pnpm check` có thể vắng (bước trước chết trước khi ghi) —
  // đọc không được thì coi như không dò được gì, không phải lỗi cần chặn:
  // cảnh báo vẫn phải mở, chỉ là không có lối nhanh cho sự cố này.
  let output = '';
  try {
    output = readFileSync(path, 'utf8');
  } catch {
    process.stderr.write(`Không đọc được ${path} — phạm vi rỗng, sự cố này không có lối nhanh.\n`);
  }
  const files = resolveScope(extractCandidates(output), indexRepo(process.cwd()));

  // `SCOPE_MARKER` nằm ở `ops/invariants.hotfix-lane.ts` (bên ĐỌC khối này),
  // nên hai bên không thể lệch mốc mà không có gì đỏ.
  const { SCOPE_MARKER } = await import('../invariants.hotfix-lane.ts');
  process.stdout.write(`${renderScopeBlock(SCOPE_MARKER, sha, files)}\n`);
}
