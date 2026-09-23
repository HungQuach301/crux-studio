#!/usr/bin/env node
/**
 * KF-004 / giả định G2 — workflow nào phải được gọi TAY sau một lần merge.
 *
 * GitHub cố ý không kích hoạt workflow từ sự kiện do `GITHUB_TOKEN` tạo ra.
 * `automerge.yml` merge bằng `GITHUB_TOKEN`, nên sự kiện `push` vào `main`
 * mà lần merge đó sinh ra KHÔNG TỒN TẠI đối với mọi workflow đang nghe nó.
 * Thiếu một lời gọi ở đây là một bước im lặng không chạy — và không có gì
 * đỏ để báo (nhóm Z trong `ops/known-failures.md`).
 *
 * Bốn workflow nghe `push` vào `main`:
 *
 * | Workflow | Quan tâm | Gọi khi nào |
 * |---|---|---|
 * | `main-ci.yml` | mọi thay đổi trên `main` | luôn luôn |
 * | `labels.yml` | `ops/labels.json` | khi file đó đổi |
 * | `.github/workflows/sync-workflows.yml` | `ops/workflows/**` | khi thư mục đó đổi |
 * | `smoke-workflows.yml` | `ops/workflows/**` | khi thư mục đó đổi, SAU sync |
 *
 * **Dòng thứ ba là cái D-C06 vừa mở ra.** Trước D-C06, `ops/workflows/**`
 * nằm trọn trong vùng `owner-merge`, nên `automerge` không bao giờ merge PR
 * chạm tới nó: merge của NGƯỜI sinh sự kiện `push` thật, và `sync-workflows`
 * chạy bình thường. Chỗ đó an toàn NHỜ phạm vi vùng bảo vệ, không nhờ thiết
 * kế — và `automerge.yml` đã ghi sẵn câu cảnh báo đó.
 *
 * D-C06 rút `ops/workflows/**` khỏi `owner-merge` và đưa sang
 * `automerge-delayed`. Máy bắt đầu merge được những PR đó, nên đường đứt đã
 * mở. `sync-workflows` phải được gọi tường minh từ đây — nếu không, workflow
 * mới merge vào `main` sẽ KHÔNG BAO GIỜ được chép sang `.github/workflows/`,
 * và mọi thứ vẫn xanh (rà soát Z3).
 *
 * File này nằm dưới `ops/invariants.*` nên chính nó là `owner-merge`.
 */

import { readFileSync } from 'node:fs';

export interface Dispatch {
  workflow: string;
  why: string;
}

/**
 * Danh sách workflow phải gọi bằng `workflow_dispatch` sau khi merge PR có
 * những file này. Thứ tự là thứ tự gọi.
 */
export function workflowsToDispatch(changed: readonly string[]): Dispatch[] {
  const files = changed.map((file) => file.trim()).filter((file) => file !== '');
  const out: Dispatch[] = [
    { workflow: 'main-ci.yml', why: '`main` vừa đổi thì phải kiểm lại `main` (CHARTER 6.5).' },
  ];

  if (files.includes('ops/labels.json')) {
    out.push({ workflow: 'labels.yml', why: '`ops/labels.json` đổi — đồng bộ hệ thống nhãn lên repo.' });
  }

  if (files.some((file) => file.startsWith('ops/workflows/'))) {
    out.push({
      workflow: 'sync-workflows.yml',
      why: '`ops/workflows/**` đổi — chép sang `.github/workflows/`, nếu không workflow mới không bao giờ có hiệu lực (KF-004, rà soát Z3).',
    });
    // Sau `sync-workflows.yml`, và thứ tự đó là bắt buộc: chạy thử một
    // workflow trước khi bản mới được chép sang `.github/workflows/` là
    // chạy thử BẢN CŨ, và nó sẽ xanh — đúng loại "xanh sai" tệ nhất.
    // `smoke-workflows.yml` tự bảo vệ thêm bằng cách đối chiếu nội dung hai
    // thư mục trước khi gọi gì, nên thứ tự ở đây là lớp thứ nhất, không
    // phải lớp duy nhất.
    out.push({
      workflow: 'smoke-workflows.yml',
      why: '`ops/workflows/**` đổi — chạy thử workflow vừa đổi. Bản mới chưa bao giờ chạy trước khi merge, vì agent không ghi được `.github/` (KF-003, mục `P-010`).',
    });
  }

  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/invariants.post-merge-dispatch.ts <file chứa danh sách đường dẫn>
//
// In mỗi dòng một `<workflow>\t<lý do>`. Không bao giờ in rỗng: `main-ci.yml`
// luôn có mặt, nên một đầu ra rỗng là dấu hiệu chính script này hỏng.

const isMain = process.argv[1]?.endsWith('invariants.post-merge-dispatch.ts') === true;

if (isMain) {
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write('Thiếu đường dẫn file chứa danh sách file đã đổi.\n');
    process.exit(2);
  }
  const changed = readFileSync(path, 'utf8').split('\n');
  for (const dispatch of workflowsToDispatch(changed)) {
    process.stdout.write(`${dispatch.workflow}\t${dispatch.why}\n`);
  }
}
