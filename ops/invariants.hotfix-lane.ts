#!/usr/bin/env node
/**
 * BẤT BIẾN I4 — **lối đi nhanh `hotfix`**, cửa thứ tư của việc tự merge.
 *
 * Quyết định `D-C07` (issue `🤖 [QĐ] #169`, chủ dự án chọn phương án **A**
 * lúc `2026-09-23T01:19:54Z`). Sáu điều kiện kèm theo câu trả lời đó không
 * được để ở dạng lời dặn — câu trả lời đòi chúng thành bài kiểm máy khoá
 * được. File này là chỗ sáu điều kiện ấy thành sáu phép kiểm.
 *
 * ## Chỗ thủng mà nó bịt (`KF-020`, mục `platform/P-032`)
 *
 * `main` đỏ **vì một workflow** thì mọi bản sửa của nó — sửa tại chỗ hay
 * revert — đều chạm `ops/workflows/**`, tức vùng bảo vệ mức
 * `automerge-delayed` (CHARTER mục 3, `D-C06`). Cửa 12 giờ vì thế áp lên
 * đúng thứ đáng lẽ đi nhanh nhất, trong khi `CLAUDE.md` mục 13 và CHARTER
 * phụ lục P3 bước 1 đòi sửa **ngay**. Đo được ngày 2026-09-23: `main` đỏ từ
 * `23:05Z`, bản sửa `#167` CI xanh 5/5 từ `00:03Z`, mốc tự merge ~`12:03Z`
 * — trong khoảng đó, 9 PR xung đột, 0 giải, 0 push, bốn lượt worker liên
 * tiếp không đẩy được gì.
 *
 * ## Sáu điều kiện, sáu phép kiểm
 *
 * | # | Điều kiện | Kiểm ở đâu |
 * |---|---|---|
 * | 1 | chỉ mở khi `main-ci` đang đỏ VÀ có cảnh báo khẩn tương ứng đang mở | `mainCiRed` + `scope` (khối máy đọc trong thân issue `alert`) |
 * | 2 | chỉ chạm đúng file nêu trong cảnh báo, không nới cả thư mục | `changed ⊆ scope.files`, so từng đường dẫn đầy đủ |
 * | 3 | không xoá, nới hay tắt chính luật đang bắt lỗi | `RULE_PATHS` → `needs-decision`, không phải `hotfix` |
 * | 4 | vẫn xanh đủ 5 check | `ops/invariants.merge-gate.ts` (CI xanh trên đúng đầu nhánh) |
 * | 5 | không áp dụng cho `automerge.yml` và hạ tầng merge | `MERGE_INFRA_PATHS` |
 * | 6 | nhãn `hotfix`, tối đa 1 PR mỗi sự cố | `labels` + `otherHotfixPrs` |
 *
 * ## Vì sao điều kiện 3 là "chạm là dừng" chứ không phải "đếm dòng xoá"
 *
 * Câu trả lời đòi bài kiểm **phân biệt được hai ca**: (a) sửa tối thiểu chỗ
 * hỏng, (b) lùi chính luật đang bắt lỗi. Phân biệt bằng **hướng** của diff
 * (thêm là siết, xoá là nới) sai ngay ở ca một PR *thêm* một dòng ngoại lệ
 * vào danh sách bỏ qua — thuần thêm, mà nới. Nên phép kiểm chọn hướng an
 * toàn: một PR chạm tầng luật (`ops/invariants.*`, `ops/scripts/check-*.ts`,
 * `ops/scripts/lint-*.ts`, `.claude/hooks/**`, `.claude/settings.json`)
 * KHÔNG đi lối nhanh, mà ra `needs-decision` — đúng chỗ câu trả lời nói:
 * lùi luật thì mở `🤖 [QĐ]`, không dùng lối nhanh.
 *
 * ⚠️ **Chỗ chưa che, khai ra thay vì giả vờ đã che.** Một bản sửa vừa sửa
 * chỗ hỏng vừa SIẾT thêm luật — `#167` là ví dụ thật: nó sửa
 * `ops/workflows/spike-canvas.yml` và thêm glob thứ tư vào
 * `ops/scripts/check-test-coverage.ts` — sẽ ra `needs-decision`, tức vẫn
 * chờ 12 giờ. Cách đi đúng cho lần sau là **tách hai PR**: PR sửa tối thiểu
 * đi lối `hotfix`, PR siết luật đi cửa thường. Đó là một câu hướng dẫn,
 * không phải một lỗ: lối nhanh cố ý hẹp — hẹp quá thì mất một nhịp, rộng
 * quá thì mất lớp chặn.
 *
 * File này nằm dưới `ops/invariants.*` nên chính nó là `owner-merge`: lối
 * nhanh không tự nới được chính nó, và `RULE_PATHS` khoá thêm một lần nữa.
 */

/** Nhãn mà một PR phải mang để được xét lối nhanh (điều kiện 6). */
export const HOTFIX_LABEL = 'hotfix';

/**
 * Mốc của khối máy đọc trong thân issue `alert`.
 * `ops/workflows/main-ci.yml` ghi nó, file này đọc nó.
 *
 * KHÔNG đọc đường dẫn ra khỏi văn xuôi tiếng Việt của cảnh báo: đó là thứ
 * hỏng im lặng ngay lần đầu ai viết khác một chữ — cùng lý do
 * `ops/scripts/conflict-watch.ts` không đọc số giờ kẹt từ trường `note`.
 */
export const SCOPE_MARKER = 'crux-hotfix-scope';

/** Tầng luật — chạm là KHÔNG đi lối nhanh (điều kiện 3). */
export const RULE_PATHS: readonly RegExp[] = [
  /^ops\/invariants\./,
  /^ops\/scripts\/check-.+\.ts$/,
  /^ops\/scripts\/lint-.+\.ts$/,
  /^\.claude\/hooks\//,
  /^\.claude\/settings\.json$/,
];

/** Hạ tầng merge — lối nhanh không bao giờ áp dụng (điều kiện 5). */
export const MERGE_INFRA_PATHS: readonly RegExp[] = [
  /^ops\/workflows\/automerge\.yml$/,
  /^\.github\//,
];

/** Phạm vi sự cố, đọc từ khối máy đọc trong thân issue cảnh báo. */
export interface HotfixScope {
  /** Commit `main` mà cảnh báo được mở trên. Giữ để truy nguồn, không dùng để so. */
  sha: string;
  /** Các đường dẫn mà cổng đỏ NÊU TÊN. Rỗng thì không dựng được phạm vi → không có lối nhanh. */
  files: readonly string[];
}

export interface HotfixInput {
  /** Nhãn của PR, nguyên văn. */
  labels: readonly string[];
  /** Đường dẫn PR đổi, so với tổ tiên chung với `main`. */
  changed: readonly string[];
  /** Phạm vi từ cảnh báo đang mở. `null` = không có cảnh báo, hoặc cảnh báo không có khối máy đọc. */
  scope: HotfixScope | null;
  /** Lần chạy `main-ci` gần nhất trên `main` có đỏ không (điều kiện 1). */
  mainCiRed: boolean;
  /** Số hiệu các PR đang mở KHÁC cũng mang nhãn `hotfix` (điều kiện 6). */
  otherHotfixPrs: readonly number[];
  /** Số hiệu PR đang xét — để điều kiện 6 chọn được một PR duy nhất, xác định. */
  number: number;
}

export type HotfixLane = 'hotfix' | 'normal' | 'needs-decision';

export interface HotfixDecision {
  lane: HotfixLane;
  /** Vì sao, một câu, in ra được trong log của `automerge.yml`. Cấm im lặng (rà soát Z2). */
  reason: string;
}

/**
 * Đọc khối máy đọc của cảnh báo. Hình dạng bắt buộc: một dòng
 * `<!-- crux-hotfix-scope -->`, ngay dưới là một khối ```json chứa
 * `{"sha": "...", "files": [...]}`.
 *
 * Hướng an toàn là `null`: thiếu mốc, JSON hỏng, `files` không phải mảng
 * chuỗi, hay `files` rỗng đều trả `null` — và `null` nghĩa là không có lối
 * nhanh. Một cảnh báo viết sai làm mất một nhịp, không làm thủng lớp chặn.
 */
export function parseScope(issueBody: string): HotfixScope | null {
  // Mốc CUỐI CÙNG thắng. `main-ci.yml` mở issue ở lần đỏ đầu, rồi BÌNH LUẬN
  // ở mỗi lần đỏ sau — bên gọi nối thân issue với mọi comment lại rồi truyền
  // vào đây, nên khối mới nhất là khối đúng: một sự cố kéo dài có thể đổi tập
  // cổng đỏ, và lấy khối cũ sẽ cho phép sửa một file đã không còn trong phạm vi.
  const marker = issueBody.lastIndexOf(`<!-- ${SCOPE_MARKER} -->`);
  if (marker === -1) return null;
  const fence = /```json\s*\n([\s\S]*?)\n```/.exec(issueBody.slice(marker));
  if (fence === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fence[1]!);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;

  const record = raw as Record<string, unknown>;
  const files = record['files'];
  if (!Array.isArray(files)) return null;
  if (!files.every((file): file is string => typeof file === 'string' && file.trim() !== '')) return null;
  if (files.length === 0) return null;

  const sha = typeof record['sha'] === 'string' ? record['sha'] : '';
  return { sha, files: files.map((file) => file.trim()) };
}

const matches = (path: string, rules: readonly RegExp[]): boolean => rules.some((rule) => rule.test(path));

/**
 * Sáu điều kiện của `D-C07`, xếp theo đúng thứ tự đọc được thành một câu.
 *
 * `normal` nghĩa là "cửa thường, không có gì sai" — đa số PR rơi vào đây.
 * `needs-decision` nghĩa là "đúng hình dạng lối nhanh, nhưng chạm tầng
 * luật hoặc hạ tầng merge": bên gọi mở `🤖 [QĐ]`, và KHÔNG tự đi lối nhanh.
 */
export function classifyHotfix(input: HotfixInput): HotfixDecision {
  const labels = input.labels.map((label) => label.toLowerCase());
  const changed = input.changed.map((path) => path.trim()).filter((path) => path !== '');

  // Điều kiện 6, vế nhãn. Đây là đường ra của gần như mọi PR nên nó đứng đầu.
  if (!labels.includes(HOTFIX_LABEL)) {
    return { lane: 'normal', reason: `PR không mang nhãn \`${HOTFIX_LABEL}\` — cửa thường.` };
  }

  // Điều kiện 5 đứng TRƯỚC điều kiện 1: hạ tầng merge không bao giờ đi lối
  // nhanh, kể cả giữa một sự cố thật. Xét nó sau sẽ để một PR sửa
  // `automerge.yml` lọt qua đúng lúc lớp chặn yếu nhất.
  const infra = changed.filter((path) => matches(path, MERGE_INFRA_PATHS));
  if (infra.length > 0) {
    return {
      lane: 'needs-decision',
      reason: `Chạm hạ tầng merge (${infra.join(', ')}) — điều kiện 5 của \`D-C07\` loại trừ hẳn, mở \`🤖 [QĐ]\`.`,
    };
  }

  // Điều kiện 3.
  const rules = changed.filter((path) => matches(path, RULE_PATHS));
  if (rules.length > 0) {
    return {
      lane: 'needs-decision',
      reason: `Chạm chính tầng luật đang bắt lỗi (${rules.join(', ')}) — điều kiện 3 của \`D-C07\`: mở \`🤖 [QĐ]\`, không dùng lối nhanh. Tách bản sửa tối thiểu thành một PR riêng thì PR đó đi được.`,
    };
  }

  // Điều kiện 1.
  if (!input.mainCiRed) {
    return {
      lane: 'normal',
      reason: 'Lần chạy `main-ci` gần nhất trên `main` không đỏ — điều kiện 1 của `D-C07` không đạt.',
    };
  }
  if (input.scope === null) {
    return {
      lane: 'normal',
      reason: `Không có cảnh báo khẩn đang mở kèm khối \`${SCOPE_MARKER}\` đọc được — điều kiện 1 của \`D-C07\` không đạt.`,
    };
  }

  if (changed.length === 0) {
    return { lane: 'normal', reason: 'PR không đổi file nào — không có gì để đi lối nhanh.' };
  }

  // Điều kiện 2. So đường dẫn ĐẦY ĐỦ, không so tiền tố: "không nới cả thư mục".
  const allowed = new Set(input.scope.files);
  const outside = changed.filter((path) => !allowed.has(path));
  if (outside.length > 0) {
    return {
      lane: 'normal',
      reason: `Chạm file ngoài phạm vi cảnh báo (${outside.join(', ')}) — điều kiện 2 của \`D-C07\` đòi chỉ chạm đúng file được nêu.`,
    };
  }

  // Điều kiện 6, vế "tối đa 1 PR mỗi sự cố". Chọn PR số NHỎ NHẤT: sự cố chỉ
  // có một bản sửa, và "nhỏ nhất" là phép chọn xác định, không phụ thuộc thứ
  // tự API trả về.
  const earlier = input.otherHotfixPrs.filter((number) => number < input.number);
  if (earlier.length > 0) {
    return {
      lane: 'normal',
      reason: `Đã có PR \`hotfix\` mở trước cho cùng sự cố (#${[...earlier].sort((a, b) => a - b).join(', #')}) — điều kiện 6 của \`D-C07\` cho tối đa một PR, và PR số nhỏ nhất đi trước.`,
    };
  }

  return {
    lane: 'hotfix',
    reason: `Lối nhanh \`D-C07\`: \`main-ci\` đỏ, cảnh báo đang mở nêu đúng ${changed.length} file này, không chạm tầng luật hay hạ tầng merge. Merge ngay khi đủ 5 check xanh, không chờ 12 giờ.`,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────
//
//   node ops/invariants.hotfix-lane.ts <file JSON>
//
// File JSON: `{labels, changed, alertBody, mainCiRed, otherHotfixPrs, number}`.
// `alertBody` là thân issue cảnh báo NỐI với mọi comment của nó — bash không
// tự đọc khối phạm vi, `parseScope` làm việc đó. In ra JSON `{lane, reason}`.
// Mã thoát luôn 0: "không đi lối nhanh" không phải lỗi.

interface CliInput {
  labels?: readonly string[];
  changed?: readonly string[];
  alertBody?: string | null;
  mainCiRed?: boolean;
  otherHotfixPrs?: readonly number[];
  number?: number;
}

const isMain = process.argv[1]?.endsWith('invariants.hotfix-lane.ts') === true;

if (isMain) {
  const { readFileSync } = await import('node:fs');
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write('Thiếu đường dẫn file JSON mô tả PR.\n');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CliInput;
  const body = raw.alertBody ?? '';
  const decision = classifyHotfix({
    labels: raw.labels ?? [],
    changed: raw.changed ?? [],
    scope: body === '' ? null : parseScope(body),
    mainCiRed: raw.mainCiRed ?? false,
    otherHotfixPrs: raw.otherHotfixPrs ?? [],
    number: raw.number ?? 0,
  });
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}
