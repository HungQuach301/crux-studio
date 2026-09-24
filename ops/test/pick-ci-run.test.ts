/**
 * Bài tái hiện lỗi cho mục `platform/P-039` (bất biến **I2**: PR `fix` phải
 * có test tái hiện lỗi) và `KF-024`.
 *
 * Lối hỏng được khoá ở đây là nhóm **Z** thuần: PR mang nhãn `automerge`, cả
 * sáu check xanh, `main` xanh, không job nào đỏ — và `automerge.yml` vẫn in
 * `skip — CI chưa xanh (cancelled)` mãi mãi, vì nó đọc nhầm một lần chạy
 * `ci.yml` đã bị huỷ thành phán quyết của cây mã.
 *
 * Dữ liệu của bài đầu tiên là ba lần chạy THẬT trên `head_sha` `ed56e10f` của
 * PR `#194`, chép nguyên từ `actions/workflows/ci.yml/runs`, kể cả chỗ hai
 * lần chạy trùng `created_at` tới từng giây — đó chính là chỗ `per_page=1`
 * chui qua.
 *
 * Phá thử **thật**, mỗi lần một chỗ rồi khôi phục — số đỏ là số đo, không phải
 * số mong đợi:
 *
 * | chỗ phá | bài đỏ |
 * |---|---|
 * | bỏ luật "bỏ kết luận không mang phán quyết" | 2 |
 * | luôn ưu tiên `success` (nuốt đỏ) | 1 |
 * | `automerge.yml` quay về `per_page=1` | 1 |
 * | sắp theo `created_at` thay vì `run_number` | 1 |
 *
 * ⚠️ Lần phá thứ tư lúc đầu ra **0 bài đỏ**: luật `run_number` chưa được bài
 * nào khoá, vì mọi ca đều có `updated_at` lệch nhau nên mức dự phòng thứ hai
 * cứu bàn thua. Đó đúng là hình dạng nhóm **Z** mà file này tồn tại để chặn —
 * một luật có mà không ai canh. Bài cuối (`chỉ còn run_number phân định
 * được`) được thêm vào để bịt chỗ đó, và sau khi thêm thì phép phá ấy đỏ.
 */

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { VERDICTLESS_CONCLUSIONS, pickCiRun, type CiRun } from '../scripts/pick-ci-run.ts';

const HEAD_194 = 'ed56e10f96ee4d661c29a9da26bd5469501928e7';

/** Ba lần chạy thật của PR #194, xếp đúng thứ tự API trả về (mới nhất trước). */
const RUNS_194: readonly CiRun[] = [
  {
    id: 35875939060,
    run_number: 610,
    head_sha: HEAD_194,
    status: 'completed',
    conclusion: 'cancelled',
    created_at: '2026-09-23T14:40:41Z',
    updated_at: '2026-09-23T14:40:48Z',
  },
  {
    id: 35875939096,
    run_number: 611,
    head_sha: HEAD_194,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-09-23T14:40:41Z',
    updated_at: '2026-09-23T14:42:37Z',
  },
  {
    id: 35875888124,
    run_number: 609,
    head_sha: HEAD_194,
    status: 'completed',
    conclusion: 'cancelled',
    created_at: '2026-09-23T14:40:17Z',
    updated_at: '2026-09-23T14:41:29Z',
  },
];

test('PR #194: ba lần chạy thật, chọn lần success chứ không phải lần cancelled đứng đầu danh sách', () => {
  const picked = pickCiRun(RUNS_194, HEAD_194);
  assert.equal(picked?.id, 35875939096);
  assert.equal(picked?.conclusion, 'success');
  assert.equal(
    picked?.updated_at,
    '2026-09-23T14:42:37Z',
    'đồng hồ chờ 12 giờ phải đếm từ lần chạy có phán quyết, không phải lần bị huỷ',
  );
});

test('phép chọn cũ (phần tử đầu của danh sách) là thứ đã làm #194 kẹt — đối chứng', () => {
  // Không gọi `pickCiRun`: bài này chỉ ghi lại rằng dữ liệu đầu vào THẬT SỰ
  // bẫy được cách đọc cũ, nếu không thì bài trên xanh vì lý do khác.
  assert.equal(RUNS_194[0]?.conclusion, 'cancelled');
});

test('lần cancelled mới hơn không che được lần success cũ hơn trên cùng SHA', () => {
  const runs: CiRun[] = [
    { id: 2, run_number: 20, head_sha: 'a', status: 'completed', conclusion: 'cancelled', updated_at: '2026-01-01T02:00:00Z' },
    { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'success', updated_at: '2026-01-01T01:00:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.conclusion, 'success');
});

test('KHÔNG nuốt đỏ: lần failure mới hơn thắng lần success cũ hơn', () => {
  const runs: CiRun[] = [
    { id: 2, run_number: 20, head_sha: 'a', status: 'completed', conclusion: 'failure', updated_at: '2026-01-01T02:00:00Z' },
    { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'success', updated_at: '2026-01-01T01:00:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.conclusion, 'failure');
});

test('mọi lần chạy đều bị huỷ: trả lần mới nhất, nên bên gọi vẫn skip đúng như trước', () => {
  const runs: CiRun[] = [
    { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'cancelled', updated_at: '2026-01-01T01:00:00Z' },
    { id: 2, run_number: 20, head_sha: 'a', status: 'completed', conclusion: 'cancelled', updated_at: '2026-01-01T02:00:00Z' },
  ];
  const picked = pickCiRun(runs, 'a');
  assert.equal(picked?.id, 2);
  assert.notEqual(picked?.conclusion, 'success');
});

test('lần đang chạy chưa có phán quyết, không được chọn', () => {
  const runs: CiRun[] = [
    { id: 2, run_number: 20, head_sha: 'a', status: 'in_progress', conclusion: null },
    { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'success', updated_at: '2026-01-01T01:00:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.id, 1);
});

test('không có lần chạy completed nào thì trả null — bên gọi in "chưa có lần chạy nào"', () => {
  assert.equal(pickCiRun([], 'a'), null);
  assert.equal(pickCiRun([{ id: 1, status: 'queued', head_sha: 'a' }], 'a'), null);
});

test('lọc theo headSha: lần chạy của SHA khác không lọt vào', () => {
  const runs: CiRun[] = [
    { id: 2, run_number: 20, head_sha: 'b', status: 'completed', conclusion: 'success', updated_at: '2026-01-01T02:00:00Z' },
    { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'failure', updated_at: '2026-01-01T01:00:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.id, 1);
});

test('hoà `created_at` tới từng giây thì `run_number` quyết định', () => {
  const runs: CiRun[] = [
    { id: 1, run_number: 610, head_sha: 'a', status: 'completed', conclusion: 'failure', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:10Z' },
    { id: 2, run_number: 611, head_sha: 'a', status: 'completed', conclusion: 'success', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:02:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.run_number, 611);
});

test('ba kết luận không mang phán quyết đều bị bỏ qua', () => {
  for (const conclusion of VERDICTLESS_CONCLUSIONS) {
    const runs: CiRun[] = [
      { id: 2, run_number: 20, head_sha: 'a', status: 'completed', conclusion, updated_at: '2026-01-01T02:00:00Z' },
      { id: 1, run_number: 10, head_sha: 'a', status: 'completed', conclusion: 'success', updated_at: '2026-01-01T01:00:00Z' },
    ];
    assert.equal(pickCiRun(runs, 'a')?.conclusion, 'success', `kết luận "${conclusion}" vẫn che mất lần success`);
  }
});

test('`automerge.yml` hỏi cả danh sách chứ không còn `per_page=1`, và đi qua pick-ci-run', () => {
  // Khoá chiều lệch YAML ↔ TS: cơ chế ở trên vô nghĩa nếu chỗ gọi vẫn chỉ
  // lấy một phần tử. Đọc chính file workflow, đúng cách
  // `ops/test/required-checks.test.ts` khoá ruleset.
  const yaml = readFileSync('ops/workflows/automerge.yml', 'utf8');
  const ciQuery = yaml.split('\n').filter((line) => line.includes('workflows/ci.yml/runs'));
  assert.ok(ciQuery.length > 0, 'không còn dòng nào hỏi ci.yml/runs — chỗ gọi đã đổi hình dạng, sửa bài này');
  for (const line of ciQuery) {
    assert.ok(!line.includes('per_page=1&') && !/per_page=1\b/.test(line), `vẫn còn per_page=1: ${line.trim()}`);
  }
  assert.ok(
    yaml.includes('ops/scripts/pick-ci-run.ts'),
    'automerge.yml không gọi pick-ci-run.ts — cơ chế có mà không ai dùng',
  );
});

test('chỉ còn `run_number` phân định được: `created_at` và `updated_at` đều vắng', () => {
  // Ca này khoá `run_number` là mức SO SÁNH ĐẦU TIÊN, không phải mức dự phòng.
  // `id` được đặt ngược chiều `run_number` có chủ ý: nếu ai bỏ mức `run_number`
  // thì mức `id` phía sau sẽ chọn lần `failure`, và bài này đỏ.
  const runs: CiRun[] = [
    { id: 2, run_number: 610, head_sha: 'a', status: 'completed', conclusion: 'failure', created_at: '2026-01-01T00:00:00Z' },
    { id: 1, run_number: 611, head_sha: 'a', status: 'completed', conclusion: 'success', created_at: '2026-01-01T00:00:00Z' },
  ];
  assert.equal(pickCiRun(runs, 'a')?.run_number, 611);
});
