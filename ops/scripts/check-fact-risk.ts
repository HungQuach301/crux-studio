#!/usr/bin/env node
/**
 * Fact & Risk Pass (spec S05) — nơi bất biến **I6** được thực thi ở tầng biên
 * tập: *mọi con số hiển thị đều có nguồn hoặc có mô hình* (mục `editorial/E-002`).
 *
 * File này chỉ chứa **logic thuần**, trung tính thể loại và kênh: ngưỡng
 * (`counterClaimsMin`) đến từ genre pack và được truyền vào, đúng cùng lẽ với
 * Preflight của xưởng Dựng ("file này chỉ biết cách đo, ngưỡng nằm trong pack").
 * `ops/scripts/check-contracts.ts` là nơi nạp artifact và genre pack rồi gọi
 * xuống đây.
 *
 * Hai tiêu chí xong của `E-002`, mỗi tiêu chí một hàm kiểm:
 *
 *  1. **Con số không truy được về claimId thì CHẶN, không cảnh báo.** Một con
 *     số xuất hiện trong lời thoại (`script.text`) chỉ hợp lệ khi nó cũng xuất
 *     hiện trong `statement` của một claim mà kịch bản có trích (`script.claimIds`),
 *     và claim đó thật sự tồn tại trong vũ trụ claim của tập (artifact `topic`)
 *     kèm bằng chứng dạng `source` hoặc `model`. Không có lựa chọn thứ ba (I6).
 *  2. **Số phản biện đạt ngưỡng genre pack**, kiểm bằng máy: `counterClaims`
 *     của tập ≥ `limits.counterClaimsMin`.
 *
 * ## Thiên lệch khai trước (cùng khuôn với các cổng stub-aware khác)
 *
 * Một lần **báo sai** làm đứng cả pipeline; một lần **bỏ sót** chỉ trả về hành
 * vi trước mục này (payload v0 để lỏng nên con số không claimId vốn lọt qua
 * contract). Vì vậy bên gọi (`check-contracts.ts`) **chỉ chặn khi
 * `producer.impl !== 'stub'`** — tức khi có dữ liệu thật; ở `impl: stub` nó
 * **ghi nhận** ra stdout chứ không chặn, để tập vàng stub giữ nguyên và mục này
 * không phải chạy `pnpm replay -- --update` (CHARTER 6.1). Chính cổng này thành
 * chặn ngay khi xưởng biên tập lên `v1`, không ai phải nhớ quay lại bật.
 */

/** Một claim trong vũ trụ claim của tập — trích từ payload của artifact `topic`. */
export interface FactRiskClaim {
  id: string;
  statement: string;
  evidence?: { kind?: string; ref?: string };
}

/** Phần kịch bản mà Fact & Risk Pass soi: lời thoại và các claim nó trích. */
export interface FactRiskScript {
  text: string;
  claimIds: readonly string[];
}

export interface FactRiskInput {
  script: FactRiskScript;
  /** Toàn bộ claim của tập (payload `topic`) — vũ trụ claim hợp lệ. */
  claims: readonly FactRiskClaim[];
  /** Số phản biện đã có, đếm từ `topic.payload.counterClaims`. */
  counterClaimCount: number;
  /** Ngưỡng tối thiểu theo genre pack (`limits.counterClaimsMin`). */
  counterClaimsMin: number;
}

export type FactRiskCode =
  | 'untraceable-number'
  | 'counterclaims-short'
  | 'dangling-claim'
  | 'claim-missing-evidence';

export interface FactRiskProblem {
  code: FactRiskCode;
  detail: string;
}

/**
 * Bắt token số trong văn bản: tuỳ chọn `$` mở đầu, chuỗi chữ số có thể mang
 * dấu phẩy ngăn nghìn, phần thập phân, và `%` cuối. `\d[\d,]*` đòi ký tự đầu
 * là chữ số nên không nuốt dấu phẩy hay `$` đứng lẻ.
 */
const NUMBER_RE = /\$?\d[\d,]*(?:\.\d+)?%?/g;

/**
 * Chuẩn hoá một token số để so bằng: bỏ `$` mở đầu và mọi dấu phẩy ngăn nghìn,
 * GIỮ phần thập phân và dấu `%`. Nhờ đó `"$4,300"` trong lời thoại truy được về
 * `"4300"` trong claim, còn `"12%"` không lẫn với `"12"`.
 */
export function normalizeNumber(token: string): string {
  return token.replace(/^\$/, '').replace(/,/g, '');
}

/** Mọi token số trong một đoạn văn, đã chuẩn hoá, giữ nguyên thứ tự và lặp. */
export function numericTokens(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map(normalizeNumber);
}

/**
 * Chạy Fact & Risk Pass trên một cặp (kịch bản, vũ trụ claim). Trả về danh
 * sách vấn đề — rỗng nghĩa là đạt. KHÔNG tự quyết chặn hay ghi nhận: đó là
 * việc của bên gọi, tuỳ `producer.impl` (xem docs đầu file).
 */
export function factRiskProblems(input: FactRiskInput): FactRiskProblem[] {
  const problems: FactRiskProblem[] = [];
  const byId = new Map(input.claims.map((c) => [c.id, c]));

  // (a) Mỗi claim kịch bản trích phải tồn tại và có bằng chứng source|model + ref.
  const citedStatements: string[] = [];
  for (const id of input.script.claimIds) {
    const claim = byId.get(id);
    if (!claim) {
      problems.push({
        code: 'dangling-claim',
        detail: `kịch bản trích claimId "${id}" nhưng không claim nào của tập mang id đó`,
      });
      continue;
    }
    const kind = claim.evidence?.kind;
    const ref = claim.evidence?.ref;
    if ((kind !== 'source' && kind !== 'model') || !ref) {
      problems.push({
        code: 'claim-missing-evidence',
        detail: `claim "${id}" thiếu bằng chứng dạng source|model kèm ref (I6: có nguồn HOẶC có mô hình)`,
      });
    }
    citedStatements.push(claim.statement);
  }

  // (b) Mọi con số trong lời thoại phải truy được về một claim ĐƯỢC TRÍCH.
  const traceable = new Set<string>();
  for (const statement of citedStatements) {
    for (const n of numericTokens(statement)) traceable.add(n);
  }
  const reported = new Set<string>();
  for (const n of numericTokens(input.script.text)) {
    if (traceable.has(n) || reported.has(n)) continue;
    reported.add(n);
    problems.push({
      code: 'untraceable-number',
      detail: `con số "${n}" trong lời thoại không truy được về claimId nào kịch bản trích`,
    });
  }

  // (c) Số phản biện đạt ngưỡng genre pack.
  if (input.counterClaimCount < input.counterClaimsMin) {
    problems.push({
      code: 'counterclaims-short',
      detail: `số phản biện ${input.counterClaimCount} < counterClaimsMin ${input.counterClaimsMin} của genre pack`,
    });
  }

  return problems;
}

/** Hình dạng tối thiểu của một artifact mà Fact & Risk Pass cần đọc. */
interface ArtifactLike {
  genre?: string;
  producer?: { impl?: string };
  payload?: {
    script?: { text?: unknown; claimIds?: unknown };
    claims?: unknown;
    counterClaims?: unknown;
  };
}

/**
 * Ghép một cặp artifact (`editorial` + `topic` cùng tập) và ngưỡng genre pack
 * thành `FactRiskInput` rồi chạy `factRiskProblems`. Tách khỏi phần I/O để
 * test được mà không cần file trên đĩa.
 */
export function episodeFactRiskProblems(
  editorial: ArtifactLike,
  topic: ArtifactLike,
  counterClaimsMin: number,
): FactRiskProblem[] {
  const script = editorial.payload?.script ?? {};
  const text = typeof script.text === 'string' ? script.text : '';
  const claimIds = Array.isArray(script.claimIds) ? (script.claimIds as string[]) : [];
  const claims = Array.isArray(topic.payload?.claims) ? (topic.payload!.claims as FactRiskClaim[]) : [];
  const counterClaims = topic.payload?.counterClaims;
  const counterClaimCount = Array.isArray(counterClaims) ? counterClaims.length : 0;
  return factRiskProblems({ script: { text, claimIds }, claims, counterClaimCount, counterClaimsMin });
}

/** `true` khi artifact do một lượt chạy `impl: stub` sinh ra (chưa có dữ liệu thật). */
export function isStubArtifact(artifact: ArtifactLike): boolean {
  return artifact.producer?.impl === 'stub';
}
