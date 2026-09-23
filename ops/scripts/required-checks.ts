/**
 * Năm status check mà **ruleset `protect-main`** đòi trước khi cho vào `main`.
 *
 * Vì sao file này tồn tại (mục `VF-G12`, giả định **G12**):
 *
 * Ruleset nằm ở **Settings của GitHub**, ngoài repo. Không có gì trong repo
 * nối nó với `ops/workflows/ci.yml`. Đổi tên một job trong `ci.yml` — hoặc
 * gộp hai job, hoặc xoá một job — là một thay đổi mà **`pnpm check` vẫn
 * xanh, CI của chính PR đó vẫn xanh**, rồi `main` khoá lại vĩnh viễn: ruleset
 * chờ một tên check không còn ai sinh ra nữa, nên mọi PR đứng ở
 * `mergeable_state: "blocked"` và `automerge.yml` không merge được gì. Đúng
 * nhóm lỗi **Z** trong `ops/known-failures.md` — hỏng mà mọi chỉ báo đều xanh,
 * và lần này nó khoá cả nhà máy.
 *
 * Nên danh sách dưới đây là **bản sao trong repo của cấu hình ngoài repo**,
 * và `ops/test/required-checks.test.ts` bắt hai chiều lệch nhau. Nó không
 * thay được ruleset; nó chỉ bảo đảm rằng khi ai đó sắp làm `main` tắc, bài
 * kiểm đỏ **trước** khi PR đó merge.
 *
 * **Đổi danh sách này là quyết định `irreversible`** (CHARTER 2.3 nhóm 8):
 * phải mở `🤖 [QĐ]` để chủ dự án cập nhật ruleset **trước**, vì chỉ chủ dự án
 * vào được trang Settings. Sửa file này mà không sửa ruleset là tự khoá `main`.
 *
 * Cố ý **không** đặt ở `ops/invariants.*`: vùng đó là `owner-merge`, mà file
 * này cần sửa được cùng nhịp với `ci.yml` khi chủ dự án đã đổi ruleset xong.
 * Lớp chặn thật của nó là nhóm 8 ở trên, không phải cửa merge.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Đúng năm tên check mà chủ dự án đã bật trong ruleset `protect-main`
 * (câu trả lời trên issue bản tin `#50`, 2026-09-21 14:01Z). Thứ tự giữ
 * nguyên thứ tự chủ dự án liệt kê, để đối chiếu bằng mắt với trang Settings.
 */
export const REQUIRED_CHECKS: readonly string[] = [
  'check',
  'secret-scan',
  'fix-has-test',
  'protected-area',
  'trailer-warn',
];

/** Đường dẫn workflow sinh ra năm check đó. */
export const CI_WORKFLOW = join('ops', 'workflows', 'ci.yml');

/**
 * Tên status check mà một workflow sinh ra, theo đúng luật của GitHub: tên
 * check là trường `name:` của job nếu có, nếu không thì là khoá của job.
 *
 * Parser hẹp có chủ đích — nó chỉ đọc đúng hình dạng mà `ci.yml` đang dùng
 * (khoá job thụt 2 dấu cách, `name:` của job thụt 4 dấu cách) và **không**
 * nhận `- name:` của step, vốn thụt sâu hơn và mở đầu bằng gạch đầu dòng.
 * Một parser đoán mò ở đây nguy hiểm hơn là không có: nó sẽ trả về một tập
 * tên nghe hợp lý mà sai, và bài kiểm sẽ xanh nhầm.
 *
 * Hình dạng YAML hợp lệ mà nó **không** đọc được (block scalar `name: >-`,
 * khối `jobs:` thụt khác 2 dấu cách) đều làm bài kiểm **đỏ oan** — chặn một
 * PR vô hại. Đó là hướng hỏng đã chọn: đỏ oan tốn một vòng sửa, còn xanh oan
 * khoá `main`.
 *
 * ⚠️ Một lối **xanh oan** chưa với tới, ghi ra thay vì để tự phát hiện: thêm
 * `strategy.matrix` vào một trong năm job thì GitHub đổi tên check thành
 * `check (…)` trong khi hàm này vẫn trả `check`. `ci.yml` hiện không có
 * `strategy:`/`matrix:` nào, nên chưa phải việc phải làm ngay.
 */
export function ciJobNames(source: string): string[] {
  const lines = source.split('\n');
  const names: string[] = [];

  let inJobs = false;
  let currentJob: string | null = null;
  let currentName: string | null = null;

  const flush = (): void => {
    if (currentJob !== null) names.push(currentName ?? currentJob);
    currentJob = null;
    currentName = null;
  };

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;

    // Một khoá ở cột 0 kết thúc khối `jobs:`.
    if (/^\S/.test(line)) {
      flush();
      inJobs = false;
      continue;
    }

    const job = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (job !== null) {
      flush();
      currentJob = job[1]!;
      continue;
    }

    const name = /^ {4}name:\s*(.+?)\s*$/.exec(line);
    if (name !== null && currentJob !== null && currentName === null) {
      const raw = name[1]!;
      // Giá trị có nháy: lấy nguyên phần trong nháy, vì chú thích chỉ bắt đầu
      // SAU nháy đóng và bên trong nháy thì `#` là ký tự thường.
      const quoted = /^(['"])(.*?)\1/.exec(raw);
      currentName =
        quoted !== null ? quoted[2]! : raw.replace(/\s+#.*$/, '').trim();
    }
  }
  flush();

  return names;
}

/**
 * Check nào ruleset đòi mà `ci.yml` không còn sinh ra. Mảng rỗng là lành.
 *
 * Chỉ kiểm **một chiều**: thiếu một tên là khoá `main`, còn thừa một job mới
 * thì vô hại (nó chỉ không nằm trong ruleset). Bắt luôn chiều thừa sẽ biến
 * mọi job CI mới thành một lần sửa ruleset — đổi một lỗi chết người lấy một
 * phiền toái thường trực, không đáng.
 */
export function missingRequiredChecks(source: string): string[] {
  const produced = new Set(ciJobNames(source));
  return REQUIRED_CHECKS.filter((check) => !produced.has(check));
}

/** Đọc `ci.yml` từ gốc repo. Tách riêng để bài kiểm nạp được nguồn dựng sẵn. */
export function readCiWorkflow(root: string = process.cwd()): string {
  return readFileSync(join(root, CI_WORKFLOW), 'utf8');
}
