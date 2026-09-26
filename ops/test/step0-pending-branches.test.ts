/**
 * Mục `platform/P-056` — `KF-048`: nhánh chờ `step0-pending` không ai gộp
 * lại, nên bốn lượt worker không có dòng log nào trên nhánh chính.
 *
 * **Bài tái hiện lỗi** (nhãn `fix`, bất biến **I2**) là bài đầu tiên dưới
 * đây: nó dựng lại đúng bốn nhánh quan sát được ở `KF-048` cộng danh sách mã
 * log của nhánh chính tại `0926b38`, và đòi hàm trả đủ **bốn**. Chạy bài này
 * trên luật cũ là không chạy được gì cả — luật cũ là một ô gạch đầu dòng
 * chưa tick trong một mục backlog đang treo, đúng chỗ hỏng mà mục này gỡ.
 *
 * Mỗi ca cho qua đi kèm ca âm của nó (bài học `KF-003`): một luật không bao
 * giờ đỏ là một luật vô giá trị.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseStep0LogId, step0LogId } from '../../kernel/src/log.ts';
import { DEFAULT_DELAY_HOURS } from '../invariants.merge-gate.ts';
import {
  STEP0_PENDING_BRANCH_PREFIX,
  step0LogIdFromPendingBranch,
  step0PendingBranch,
} from '../scripts/step0-pr-gate.ts';
import {
  STEP0_PENDING_FUTURE_TOLERANCE_MINUTES,
  STEP0_PENDING_MARGIN_HOURS,
  STEP0_PENDING_STALE_HOURS,
  renderStep0PendingReport,
  step0PendingBranches,
} from '../scripts/step0-pending-branches.ts';

/** Mốc đo của `KF-048` — chính `at` của dòng log lượt phát hiện, nên số kiểm lại được. */
const KF041_NOW = '2026-09-25T11:39:23Z';

/** Bốn mã log quan sát được trên remote lúc `KF041_NOW`, không mã nào có trên nhánh chính. */
const KF041_LOG_IDS = [
  'step0-2026-09-24T004410Z-crux-worker-1',
  'step0-2026-09-24T214301Z-crux-worker-1',
  'step0-2026-09-25T002357Z-crux-worker-2',
  'step0-2026-09-25T003923Z-crux-worker-1',
] as const;

const KF041_BRANCHES = KF041_LOG_IDS.map(step0PendingBranch);

/**
 * Mã log CÓ trên nhánh chính tại `0926b38` — lấy vài mã thật làm nền, để ca
 * dương không phải là "danh sách rỗng nên mọi thứ đều kẹt".
 */
const MERGED_AT_0926B38 = [
  'step0-2026-09-25T042106Z-crux-worker-2',
  'step0-2026-09-25T064057Z-crux-worker-1',
  'step0-2026-09-25T074711Z-crux-worker-1',
  'step0-2026-09-25T084133Z-crux-worker-1',
];

// ── Bài tái hiện lỗi (I2) ──────────────────────────────────────────────────

test('KF-048: bốn nhánh chờ có thật, không mã nào trên nhánh chính → trả đủ BỐN', () => {
  const report = step0PendingBranches({
    branches: KF041_BRANCHES,
    mergedLogIds: MERGED_AT_0926B38,
    now: KF041_NOW,
  });

  assert.equal(report.problems.length, 0, 'bốn nhánh này đều đọc được, không được có problem nào');
  assert.equal(report.pending.length, 4);
  assert.deepEqual(
    report.pending.map((row) => row.logId).sort(),
    [...KF041_LOG_IDS].sort(),
  );

  // Kẹt lâu nhất trước — cùng luật bước 0a của phụ lục P3.
  assert.equal(report.pending[0]!.logId, KF041_LOG_IDS[0]);
  // Con số của `KF-048`: ~34,9 · ~13,9 · ~11,3 · ~11,0 giờ.
  assert.deepEqual(
    report.pending.map((row) => Number(row.ageHours.toFixed(1))),
    [34.9, 13.9, 11.3, 11.0],
  );
});

test('KF-048: nhánh cũ nhất quá ngưỡng, ba nhánh kia thì chưa', () => {
  const report = step0PendingBranches({
    branches: KF041_BRANCHES,
    mergedLogIds: MERGED_AT_0926B38,
    now: KF041_NOW,
  });
  // 34,9 > 18 ≥ 13,9 — nếu ngưỡng trôi lên quá 34,9 hay xuống dưới 13,9 thì
  // bài này đỏ, và đó là chủ đích: ngưỡng phải nằm GIỮA hai mốc đo được.
  assert.deepEqual(report.stale.map((row) => row.logId), [KF041_LOG_IDS[0]]);
});

// ── Ca âm: cùng bốn nhánh, nhưng mã đã có trên nhánh chính ────────────────

test('ca âm: cùng bốn nhánh mà mã log ĐÃ có trên nhánh chính → rỗng', () => {
  const report = step0PendingBranches({
    branches: KF041_BRANCHES,
    mergedLogIds: [...MERGED_AT_0926B38, ...KF041_LOG_IDS],
    now: KF041_NOW,
  });
  assert.deepEqual(report.pending, []);
  assert.deepEqual(report.stale, []);
  assert.deepEqual(report.problems, []);
});

test('ca âm từng phần: gộp ba trong bốn thì còn đúng một', () => {
  const report = step0PendingBranches({
    branches: KF041_BRANCHES,
    mergedLogIds: [...MERGED_AT_0926B38, ...KF041_LOG_IDS.slice(1)],
    now: KF041_NOW,
  });
  assert.deepEqual(report.pending.map((row) => row.logId), [KF041_LOG_IDS[0]]);
});

// ── Ca biên: phải NÊU VẤN ĐỀ, không im lặng bỏ qua ────────────────────────

test('ca biên: nhánh KHÔNG phải nhánh chờ → nêu vấn đề, không nuốt', () => {
  const report = step0PendingBranches({
    branches: ['claude/platform/P-056', ...KF041_BRANCHES],
    mergedLogIds: MERGED_AT_0926B38,
    now: KF041_NOW,
  });
  assert.equal(report.pending.length, 4, 'bốn nhánh chờ thật vẫn phải được đếm');
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /claude\/platform\/P-056/);
  assert.match(report.problems[0]!, new RegExp(STEP0_PENDING_BRANCH_PREFIX.replace(/\//g, '\\/')));
});

test('ca biên: tên nhánh chờ mang mã log KHÔNG đọc được → nêu vấn đề', () => {
  const broken = `${STEP0_PENDING_BRANCH_PREFIX}/step0-khong-phai-moc-crux-worker-1`;
  const report = step0PendingBranches({
    branches: [broken],
    mergedLogIds: MERGED_AT_0926B38,
    now: KF041_NOW,
  });
  assert.deepEqual(report.pending, []);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /không đọc được/);
  // Phải nói rõ nhánh vẫn có thể đang giữ một dòng log — im lặng ở đây là
  // đúng thứ `KF-048` ghi lại.
  assert.match(report.problems[0]!, /xem bằng tay/);
});

test('ca biên: mốc ở TƯƠNG LAI không được tính là "còn mới"', () => {
  const future = step0PendingBranch(step0LogId('2026-09-25T13:00:00Z', 'crux-worker-1'));
  const report = step0PendingBranches({
    branches: [future],
    mergedLogIds: [],
    now: KF041_NOW, // 11:39Z — nhánh khai 13:00Z, tức lệch 81 phút về tương lai
  });
  assert.deepEqual(report.pending, []);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /TƯƠNG LAI/);
});

test('ca âm của dung sai: lệch vài giây về tương lai vẫn được tính, tuổi kẹp về 0', () => {
  const nearby = step0PendingBranch(step0LogId('2026-09-25T11:40:00Z', 'crux-worker-1'));
  const report = step0PendingBranches({
    branches: [nearby],
    mergedLogIds: [],
    now: KF041_NOW, // lệch 37 giây, dưới dung sai 5 phút
  });
  assert.equal(report.problems.length, 0);
  assert.equal(report.pending.length, 1);
  assert.equal(report.pending[0]!.ageHours, 0);
  assert.equal(report.pending[0]!.stale, false);
});

test('ca biên: `now` không đọc được thì KHÔNG trả "không có nhánh nào kẹt"', () => {
  const report = step0PendingBranches({
    branches: KF041_BRANCHES,
    mergedLogIds: [],
    now: 'hôm nay',
  });
  assert.deepEqual(report.pending, []);
  assert.equal(report.problems.length, 1);
  assert.match(report.problems[0]!, /now/);
});

// ── Hằng số ngưỡng: khoá cả hai chiều lệch ────────────────────────────────

/** Hàng đợi merge đã từng đứng bao lâu — CHARTER 3.3, phép đo 2026-09-23, `KF-020`. */
const MEASURED_QUEUE_STALL_HOURS = 8.6;
/** Nhánh chờ cũ nhất đã từng kẹt bao lâu — `KF-048`, phép đo 2026-09-25. */
const MEASURED_WORST_STUCK_HOURS = 34.9;

test('ngưỡng nằm GIỮA hai mốc đo được, và suy ra chứ không phải số trần', () => {
  assert.equal(STEP0_PENDING_STALE_HOURS, DEFAULT_DELAY_HOURS + STEP0_PENDING_MARGIN_HOURS);
  assert.ok(STEP0_PENDING_MARGIN_HOURS > 0, 'khoảng trừ thêm phải lớn hơn 0');

  // CẬN DƯỚI — và đây là chỗ bản đầu sai, nên bài này ghim nó bằng số của
  // chính kho chứ không bằng lời. Bản đầu để margin 6 (ngưỡng 18) với lý do
  // "một lượt worker nhận, cộng hàng đợi chạy trơn". Nhưng CHARTER 3.3 ghi
  // hàng đợi merge đã từng đứng ~8,6 giờ (`KF-020`), nên 12 + 8,6 = 20,6 >
  // 18: một hàng đợi tắc đúng như đã xảy ra sẽ tự sinh cảnh báo dù không có
  // gì hỏng — gọi chủ dự án cho một hàng đợi đang chạy đúng (CHARTER 1.3).
  assert.ok(
    STEP0_PENDING_STALE_HOURS > DEFAULT_DELAY_HOURS + MEASURED_QUEUE_STALL_HOURS,
    `ngưỡng phải nằm TRÊN ${DEFAULT_DELAY_HOURS} + ${MEASURED_QUEUE_STALL_HOURS} giờ ` +
      '(khoảng chờ merge cộng ca tắc hàng đợi đã đo được ở KF-020), nếu không nó báo động ' +
      'cho một hàng đợi đang chạy đúng',
  );

  // CẬN TRÊN — trên mốc này thì nó im ở đúng ca nó được viết ra để bắt.
  assert.ok(
    STEP0_PENDING_STALE_HOURS < MEASURED_WORST_STUCK_HOURS,
    `ngưỡng phải bắt được ca ${MEASURED_WORST_STUCK_HOURS} giờ của KF-048`,
  );
  assert.ok(STEP0_PENDING_FUTURE_TOLERANCE_MINUTES > 0);
});

test('step0LogIdFromPendingBranch: phép đảo của step0PendingBranch', () => {
  for (const id of KF041_LOG_IDS) {
    assert.equal(step0LogIdFromPendingBranch(step0PendingBranch(id)), id);
  }
  // Không phải nhánh chờ, và phần đuôi rỗng — cả hai trả `null` để bên gọi
  // nói ra, chứ không trả chuỗi rỗng rồi trôi tiếp.
  assert.equal(step0LogIdFromPendingBranch('claude/platform/P-056'), null);
  assert.equal(step0LogIdFromPendingBranch(`${STEP0_PENDING_BRANCH_PREFIX}/`), null);
  assert.equal(step0LogIdFromPendingBranch(STEP0_PENDING_BRANCH_PREFIX), null);
});

test('ngưỡng KHỚP con số thật trong ops/workflows/watchdog.yml', () => {
  // Không so hằng-với-hằng: bản đầu của một bài cùng hình dạng ở
  // `ops/test/step0-pr-gate.test.ts` làm vậy và vẫn xanh nguyên khi ai đó
  // đổi YAML. Đọc chính file YAML, cùng cách `required-checks.test.ts` khoá
  // chiều lệch TS ↔ YAML.
  const yaml = readFileSync('ops/workflows/watchdog.yml', 'utf8');
  const matches = [...yaml.matchAll(/"\$PENDING_STALE"\s+-gt\s+(\d+)/g)];
  assert.equal(matches.length, 1, 'phải có đúng một phép so ngưỡng nhánh chờ trong watchdog.yml');
  assert.equal(
    Number(matches[0]![1]),
    0,
    'watchdog so số nhánh quá ngưỡng với 0; ngưỡng GIỜ do script quyết, không lặp lại trong YAML',
  );
  // Ngưỡng giờ không được viết lại trong YAML — chỉ script giữ nó. Nếu ai
  // chép con số vào YAML thì có hai bản luật, và hai bản lệch nhau im lặng.
  assert.ok(
    !new RegExp(`STEP0_PENDING_STALE_HOURS\\s*[:=]\\s*\\d`).test(yaml),
    'ngưỡng giờ phải ở đúng một chỗ: ops/scripts/step0-pending-branches.ts',
  );
});

test('tiền tố nhánh chờ KHỚP con số thật trong ops/workflows/watchdog.yml', () => {
  // Cùng chiều lệch mà `TELEMETRY_BRANCH` của `P-043` đã phải khoá: một bản
  // trong TS, một bản trong YAML, và hai bản lệch nhau thì `git ls-remote`
  // quét một tiền tố không ai đẩy lên — dấu hiệu số 7 im vĩnh viễn mà không
  // gì đỏ. Đúng nhóm Z mà chính mục này đang gỡ.
  const yaml = readFileSync('ops/workflows/watchdog.yml', 'utf8');
  const matches = [...yaml.matchAll(/STEP0_PENDING_PREFIX:\s*'([^']+)'/g)];
  assert.equal(matches.length, 1, 'phải có đúng một khai báo tiền tố nhánh chờ trong watchdog.yml');
  assert.equal(matches[0]![1], STEP0_PENDING_BRANCH_PREFIX);
});

// ── Dấu hiệu số 7 của watchdog: hai chỗ CHẶN mà vòng soát bắt được ───────

test('dấu hiệu 7 KHÔNG được nuốt lỗi `git ls-remote` bằng `|| true`', () => {
  // Đây là chỗ CHẶN thứ nhất của vòng soát `P-056`, và nó đáng một bài kiểm
  // chứ không chỉ một lần sửa: bản đầu viết
  //   git ls-remote … | sed … > "$PENDING_LIST" || true
  // Dưới `set -euo pipefail`, `git` hỏng → cả pipeline thoát khác 0 → `||
  // true` nuốt → file RỖNG → script in ra ĐÚNG TỪNG BYTE câu của ca lành.
  // Tức một lần fetch trượt KHẲNG ĐỊNH LÀ LÀNH, tệ hơn im lặng — nhóm Z
  // nằm trong chính bản sửa viết ra để giết nhóm Z.
  // Quét MÃ, không quét lời văn: chú thích ngay trên chỗ sửa có trích lại
  // nguyên văn bản hỏng (`… || true`) để lượt sau biết vì sao, và một bài
  // kiểm quét cả chú thích sẽ đỏ vì đúng câu giải thích cách nó không được
  // hỏng. Bản đầu của bài này mắc đúng lỗi đó.
  const code = readFileSync('ops/workflows/watchdog.yml', 'utf8')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  const lsRemote = code.split('\n').filter((line) => line.includes('git ls-remote --heads origin'));
  assert.equal(lsRemote.length, 1, 'phải có đúng một lời gọi `git ls-remote` cho nhánh chờ');
  assert.ok(
    lsRemote[0]!.includes('if !'),
    'lời gọi `git ls-remote` phải bắt mã thoát tường minh bằng `if !`',
  );
  assert.ok(
    !/git ls-remote[\s\S]{0,200}?\|\| true/.test(code),
    '`|| true` quanh `git ls-remote` biến một lần fetch trượt thành một câu báo yên',
  );
});

test('dấu hiệu 7 phân biệt "không đo được" với "không có nhánh nào kẹt"', () => {
  // Ca lành và ca không đo được phải ra HAI câu khác nhau. Nếu chúng trùng
  // nhau thì bên đọc không phân biệt được, và đó đúng là chỗ hỏng trên.
  const yaml = readFileSync('ops/workflows/watchdog.yml', 'utf8');
  const healthy = renderStep0PendingReport({ pending: [], stale: [], problems: [] });
  const notMeasured = [...yaml.matchAll(/PENDING_REPORT="(⚠[^"]*)"/g)].map((m) => m[1]!);
  assert.ok(notMeasured.length >= 3, 'phải có câu "không đo được" cho mọi nhánh lỗi của dấu hiệu 7');
  for (const line of notMeasured) {
    assert.notEqual(line, healthy);
    assert.ok(line.startsWith('⚠'), `câu không đo được phải mở đầu bằng ⚠: ${line}`);
  }
});

test('dấu hiệu 7: `problems` cũng phải tới được chỗ có người đọc', () => {
  // Chỗ CHẶN/NÊN SỬA thứ hai: một nhánh chờ mang mã log không đọc được sinh
  // một câu trong `problems` nói "phải xem bằng tay" — nhưng nếu chỉ
  // `PENDING_STALE` dẫn tới `add` thì câu đó chỉ nằm trong log lượt chạy,
  // rồi workflow in "Nhà máy vẫn thở" và thoát. Im lặng ở đúng chỗ `KF-048`
  // ghi lại.
  const yaml = readFileSync('ops/workflows/watchdog.yml', 'utf8');
  assert.ok(
    /\[ "\$PENDING_PROBLEMS" -gt 0 \]/.test(yaml),
    '`problems` khác rỗng phải dẫn tới `add`, không chỉ nằm trong log lượt chạy',
  );
});

// ── `parseStep0LogId` — phép đảo của `step0LogId` ─────────────────────────

test('parseStep0LogId: đi một vòng rồi về đúng chỗ cũ', () => {
  for (const runner of ['crux-worker-1', 'crux-integrator', 'crux-worker-12']) {
    const at = '2026-09-25T13:43:39Z';
    assert.deepEqual(parseStep0LogId(step0LogId(at, runner)), { at, runner });
  }
});

test('parseStep0LogId: trả null cho mọi mã không phải mã bước 0 hợp lệ', () => {
  for (const bad of [
    'step0-2026-09-25T134339Z', // thiếu tên routine
    'step0-2026-09-25T1343Z-crux-worker-1', // mốc thiếu giây
    'step0-2026-09-25T134339-crux-worker-1', // thiếu `Z`
    'step0-2026-02-31T134339Z-crux-worker-1', // ngày không tồn tại
    'step0-2026-09-25T253199Z-crux-worker-1', // giờ/phút/giây không tồn tại
    'step0-2026-09-25T134339Z-crux worker', // tên routine không qua SAFE_RUNNER
    'step0-2026-09-25T134339Z-../../etc/x', // tên routine đi ra ngoài ops/logs
    'P-056', // mã mục, không phải mã bước 0
    '', // rỗng
  ]) {
    assert.equal(parseStep0LogId(bad), null, `phải là null: ${JSON.stringify(bad)}`);
  }
});

test('parseStep0LogId: mốc KHÔNG TỒN TẠI chỉ bị bắt bởi vòng ghép-lại', () => {
  // Ca này là lý do phép so `rebuilt !== id` tồn tại, và nó đi một đường
  // KHÁC hai ca trên: `step0LogId` **không** ném lỗi cho `2026-02-31` —
  // `Date` lặng lẽ cuộn sang `2026-03-03` — nên chỉ phép so từng byte bắt
  // được. Bỏ phép so đi thì bài này đỏ; đo được.
  assert.equal(step0LogId('2026-02-31T13:43:39Z', 'crux-worker-1'), 'step0-2026-03-03T134339Z-crux-worker-1');
  assert.equal(parseStep0LogId('step0-2026-02-31T134339Z-crux-worker-1'), null);
});

// ── Báo cáo dán vào thân cảnh báo ─────────────────────────────────────────

test('renderStep0PendingReport: nói ra cả khi KHÔNG có nhánh nào kẹt', () => {
  // Im lặng khi mọi thứ ổn là đúng thứ `Z7` cấm: bên đọc không phân biệt
  // được "đã đo, không có gì" với "chưa đo".
  const text = renderStep0PendingReport({ pending: [], stale: [], problems: [] });
  assert.match(text, /không nhánh nào/);
});

test('renderStep0PendingReport: đánh dấu nhánh quá ngưỡng và in cả problems', () => {
  const report = step0PendingBranches({
    branches: [...KF041_BRANCHES, 'claude/visual/V-001'],
    mergedLogIds: [],
    now: KF041_NOW,
  });
  const text = renderStep0PendingReport(report);
  assert.match(text, new RegExp(`4 \\(quá ngưỡng ${STEP0_PENDING_STALE_HOURS} giờ: 1\\)`));
  assert.match(text, /⚠ claude\/integration\/step0-pending\/step0-2026-09-24T004410Z-crux-worker-1 — kẹt 34\.9 giờ/);
  assert.match(text, /claude\/visual\/V-001/);
});
