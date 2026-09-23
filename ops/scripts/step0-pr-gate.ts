#!/usr/bin/env node
/**
 * Mục `platform/P-038` — **một lượt bước 0 không gỡ được gì thì không tốn
 * một lần CI.**
 *
 * ## Vì sao mục này tồn tại
 *
 * Chủ dự án dặn trong câu trả lời trên issue bản tin `#193`
 * (`2026-09-23T14:18:09Z`, khối `CHI PHÍ GITHUB ACTIONS`), nguyên văn hai
 * câu quyết định hình dạng của file này:
 *
 * > giảm số lượt CI thừa — bước 0 chỉ push vào PR có xung đột thật, PR log
 * > của bước 0 không chạy CI đầy đủ
 *
 * > Lượt bước 0 không gỡ được PR nào thì không mở PR log riêng; ghi gộp vào
 * > lượt kế tiếp.
 *
 * Đây là **chỉ dẫn của chủ dự án trên issue bản tin**, tức một trong ba chỗ
 * mà `CLAUDE.md` mục 5 coi là lệnh chứ không phải dữ liệu. Số đo kèm theo
 * của anh: Actions đã ăn `$31,37/$100`.
 *
 * Mỗi PR log của bước 0 tốn **6 job `ci.yml`** cộng **một lượt `main-ci`**
 * sau khi merge. Nhịp worker thật là 2–3 lượt mỗi giờ (`VF-G1`), và khi
 * hàng đợi xung đột trống cùng mọi mục `ready` đã có PR — đúng trạng thái
 * các lượt 22:43Z, 23:25Z và 23:42Z ngày 2026-09-23 — thì **mọi** lượt là
 * một PR log. Đó là tiền trả cho một dòng văn bản.
 *
 * ## Chỗ luật cắn nhau, và vì sao hàm này không trả `false` trần
 *
 * Đọc trần trụi thì luật trên nói: lượt log-only **không bao giờ** mở PR.
 * Nhưng `CHARTER` mục 2.4 dấu hiệu số 5 giao cho `watchdog.yml` một việc
 * ngược chiều: mở cảnh báo `@nhắc` chủ dự án khi **không routine nào ghi
 * nhịp tim quá 3 giờ**. Và `watchdog.yml` đọc nhịp tim bằng cách quét
 * `ops/logs` của **bản đã checkout**, tức bản trên `main` (xem
 * `ops/workflows/watchdog.yml`, biến `LAST_BEAT`).
 *
 * Nối hai luật lại thì ra một chỗ hỏng nhóm **Z**: bỏ hẳn PR log nghĩa là
 * trong một khoảng yên — không PR nào xung đột, mọi mục `ready` đều đã có
 * PR — **không gì vào `main` cả**, nên nhịp tim trên `main` đứng lại và
 * watchdog gọi chủ dự án vì một nhà máy đang chạy đúng. Tức là tiết kiệm
 * tiền CI bằng cách tiêu thời gian của anh — ngược đúng thước đo CHARTER
 * 1.3, và ngược đúng lý do `D-C06` thu hẹp phạm vi @nhắc.
 *
 * Nên hàm này giữ **cả hai** luật: lượt log-only không mở PR, **trừ** khi
 * nhịp tim trên `main` sắp quá hạn. Hệ quả đo được: PR log tụt từ *mỗi
 * lượt* (2–3 lần/giờ) xuống **nhiều nhất một lần mỗi 2,5 giờ**.
 *
 * ## Dòng log không bị mất — I8 vẫn nguyên
 *
 * Không mở PR **không** phải là không ghi. Bất biến **I8** đòi mọi lượt
 * chạy có một dòng log mang `costUsd`, và bỏ dòng đi thì số tiền của cả dự
 * án ra sai mà không gì đỏ. Lượt log-only vẫn ghi dòng, vẫn commit, và vẫn
 * `git push` — chỉ **không mở PR**. Push vào một nhánh không có PR **không**
 * chạy CI: `ops/workflows/ci.yml` chỉ kích bằng `pull_request` và
 * `workflow_dispatch`, không có `push`.
 *
 * Lượt kế tiếp nào mở PR sẽ **gộp** các nhánh chờ đó vào PR của nó (phụ lục
 * P3 bước 0d) — đúng chữ "ghi gộp vào lượt kế tiếp" của chủ dự án.
 *
 * Quyết định này là `reversible` (CHARTER 2.3): nó nằm trong git nên revert
 * được. Ghi ở `🤖 [QĐ]` kèm trong bản tin; chủ dự án phủ quyết bằng
 * `hoàn tác #N` trong 24 giờ.
 */

/** Ngưỡng nhịp tim của `watchdog.yml`, CHARTER 2.4 dấu hiệu số 5. */
export const HEARTBEAT_STALE_MINUTES = 180;

/**
 * Khoảng an toàn trừ trước ngưỡng. Nhịp worker thật là 2–3 lượt mỗi giờ
 * (`VF-G1`), nên 30 phút là hơn một lượt: nếu lượt này nhường thì vẫn còn
 * ít nhất một lượt nữa kịp mở PR trước khi watchdog nổ. Lấy sát ngưỡng hơn
 * sẽ đặt cược vào việc lượt sau chạy đúng giờ, mà nhịp routine chưa chốt
 * được (`VF-G1` chỉ chốt "ít nhất ba worker", không chốt nhịp).
 */
export const HEARTBEAT_SAFETY_MARGIN_MINUTES = 30;

/** Quá mốc này thì lượt log-only vẫn phải mở PR để nuôi nhịp tim. */
export const HEARTBEAT_OPEN_AT_MINUTES = HEARTBEAT_STALE_MINUTES - HEARTBEAT_SAFETY_MARGIN_MINUTES;

export interface Step0PrGateInput {
  /**
   * Số PR mà bước 0 **đã push** ở lượt này (`resolved`, hoặc `clean` có
   * commit merge mới). PR bị bỏ lại vì `aborted-ineligible` **không** tính:
   * bỏ lại không tạo commit nào nên PR log vẫn là PR log.
   */
  pushedPrs: number;
  /**
   * Lượt này có đổi gì **ngoài** chính dòng log bước 0 của nó không — bước 2
   * nhận một PR, hay bước 3 nhận một mục backlog. `true` thì PR không còn là
   * "PR log riêng" theo nghĩa của chủ dự án, nên câu hỏi không đặt ra nữa.
   */
  changedBeyondOwnLogLine: boolean;
  /**
   * `at` của dòng bước 0 mới nhất **đã có trên `main`** — đúng thứ
   * `watchdog.yml` đọc. `null` khi không đọc được dòng nào: hướng an toàn
   * là mở PR, vì không đọc được nghĩa là không chứng minh được watchdog an
   * toàn (cấm im lặng).
   */
  lastHeartbeatOnMainAt: string | null;
  /** Mốc bây giờ, ISO 8601 có múi giờ. */
  now: string;
}

export type Step0PrGateReason =
  | 'work-done'
  | 'no-heartbeat-on-main'
  | 'heartbeat-unreadable'
  | 'heartbeat-due'
  | 'log-only-run';

export interface Step0PrGateDecision {
  /** `true` = mở PR như cũ. `false` = commit và push, KHÔNG mở PR. */
  openPr: boolean;
  reason: Step0PrGateReason;
  /**
   * Tuổi của nhịp tim trên `main`, tính bằng phút. `null` khi không đo
   * được — và khi `null` thì `openPr` luôn `true`.
   */
  heartbeatAgeMinutes: number | null;
  /** Câu tiếng Việt cho ghi chú lượt chạy và cho mô tả PR. */
  note: string;
}

/**
 * Tuổi nhịp tim tính bằng phút, hoặc `null` nếu một trong hai mốc không đọc
 * được. Mốc ở **tương lai** kẹp về `0` thay vì trả số âm: một dòng log ghi
 * `at` lệch giờ từng xảy ra thật (PR `#89`, `ops/logs/assembly/A-001.jsonl`),
 * và số âm ở đây sẽ lặng lẽ thành "nhịp tim còn mới" mãi mãi.
 */
export function heartbeatAgeMinutes(lastAt: string | null, now: string): number | null {
  if (lastAt === null) return null;
  const last = Date.parse(lastAt);
  const current = Date.parse(now);
  if (Number.isNaN(last) || Number.isNaN(current)) return null;
  return Math.max(0, (current - last) / 60_000);
}

/**
 * Lượt bước 0 này có được mở PR riêng không.
 *
 * Thứ tự xét cố ý: việc thật trước, rồi mới tới nhịp tim. Một lượt có việc
 * thật thì câu hỏi "PR log riêng" không đặt ra, nên không cần đo nhịp tim —
 * và không cần đo nghĩa là không phụ thuộc vào một phép đo có thể hỏng.
 */
export function step0PrGate(input: Step0PrGateInput): Step0PrGateDecision {
  if (input.changedBeyondOwnLogLine || input.pushedPrs > 0) {
    const what =
      input.pushedPrs > 0
        ? `bước 0 đã push ${input.pushedPrs} PR`
        : 'lượt này đổi thứ khác ngoài dòng log';
    return {
      openPr: true,
      reason: 'work-done',
      heartbeatAgeMinutes: heartbeatAgeMinutes(input.lastHeartbeatOnMainAt, input.now),
      note: `Mở PR: ${what}, nên đây không phải "PR log riêng" theo chỉ dẫn của chủ dự án trên #193.`,
    };
  }

  if (input.lastHeartbeatOnMainAt === null) {
    return {
      openPr: true,
      reason: 'no-heartbeat-on-main',
      heartbeatAgeMinutes: null,
      note:
        'Mở PR: không đọc được dòng bước 0 nào trên `main`, nên không chứng minh được ' +
        '`watchdog.yml` còn thấy nhịp tim (CHARTER 2.4 dấu hiệu số 5). Hướng an toàn là mở.',
    };
  }

  const age = heartbeatAgeMinutes(input.lastHeartbeatOnMainAt, input.now);
  if (age === null) {
    return {
      openPr: true,
      reason: 'heartbeat-unreadable',
      heartbeatAgeMinutes: null,
      note:
        'Mở PR: mốc nhịp tim trên `main` hoặc mốc hiện tại không đọc được, nên tuổi nhịp tim ' +
        'không đo được. Hướng an toàn là mở, không đoán.',
    };
  }

  if (age >= HEARTBEAT_OPEN_AT_MINUTES) {
    return {
      openPr: true,
      reason: 'heartbeat-due',
      heartbeatAgeMinutes: age,
      note:
        `Mở PR: nhịp tim trên \`main\` đã ${age.toFixed(0)} phút, tới hoặc quá mốc ` +
        `${HEARTBEAT_OPEN_AT_MINUTES} phút (ngưỡng ${HEARTBEAT_STALE_MINUTES} của CHARTER 2.4 ` +
        `trừ ${HEARTBEAT_SAFETY_MARGIN_MINUTES} phút an toàn). Nhường thêm một lượt là để ` +
        'watchdog gọi chủ dự án cho một nhà máy đang chạy đúng.',
    };
  }

  return {
    openPr: false,
    reason: 'log-only-run',
    heartbeatAgeMinutes: age,
    note:
      'KHÔNG mở PR: lượt này không gỡ được PR nào và không đổi gì ngoài dòng log của chính nó — ' +
      'chỉ dẫn của chủ dự án trên #193 ("Lượt bước 0 không gỡ được PR nào thì không mở PR log ' +
      `riêng; ghi gộp vào lượt kế tiếp"). Nhịp tim trên \`main\` mới ${age.toFixed(0)} phút, còn ` +
      `dưới mốc ${HEARTBEAT_OPEN_AT_MINUTES} phút, nên watchdog chưa bị đe doạ. Dòng log VẪN được ` +
      'ghi, commit và push lên nhánh chờ (bất biến I8) — chỉ không mở PR, và push vào nhánh không ' +
      'có PR thì không chạy CI (`ci.yml` chỉ kích bằng `pull_request`).',
  };
}

/** Tiền tố nhánh chờ của các lượt log-only, để lượt sau tìm được bằng máy. */
export const STEP0_PENDING_BRANCH_PREFIX = 'claude/integration/step0-pending';

/**
 * Tên nhánh chờ của một lượt log-only. Một nhánh cho **mỗi lượt**, không
 * phải một nhánh dùng chung: hai worker chạy chồng nhau (CHARTER 2.1) sẽ
 * đua nhau trên một nhánh dùng chung, và cái giá của việc đó là đúng thứ
 * `D-C04` đã bỏ tiền ra tránh ở tầng file log.
 *
 * Dùng lại `step0LogId` của kernel làm phần đuôi để tên nhánh và tên file
 * log không bao giờ lệch nhau — một chỗ sinh ra cả hai.
 */
export function step0PendingBranch(step0LogId: string): string {
  return `${STEP0_PENDING_BRANCH_PREFIX}/${step0LogId}`;
}

/** Một nhánh có phải nhánh chờ của lượt log-only không. */
export function isStep0PendingBranch(branch: string): boolean {
  return branch.startsWith(`${STEP0_PENDING_BRANCH_PREFIX}/`);
}
