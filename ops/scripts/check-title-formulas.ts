#!/usr/bin/env node
/**
 * Kiểm `title-formulas.json` của mỗi kênh, và đối chiếu `titles[].formula`
 * của artifact xưởng `release` với đúng danh sách đó (mục `release/R-001`).
 *
 * `title-formulas.md` (chép từ spec) chỉ có tên khuôn bằng tiếng Việt trong
 * một bảng — không phải khoá dữ liệu. `title-formulas.json` là phần THÊM,
 * không có trong spec gốc, gán mỗi khuôn một `id` tiếng Anh (CLAUDE.md mục
 * 9: định danh trong code dùng tiếng Anh) để máy đối chiếu được — tiêu chí
 * xong của `R-001` đọc đúng nghĩa đen: "thay vì chấp nhận mọi chuỗi".
 *
 * Đợt 0: MỌI xưởng đều `impl: stub` (CHARTER mục 10), và `formula` của
 * xưởng `release` stub (`workshops/release/src/index.ts`) chưa khớp danh
 * sách thật — cùng hình dạng với `layout-id-known` của mục `visual/V-001`.
 * Nối chặt (hard-fail) ngay bây giờ sẽ đổi `ops/golden/**` snapshot mà
 * không đi qua PR riêng (CHARTER 6.1, CLAUDE.md mục 1), nên lệch ở
 * `impl: stub` chỉ được GHI NHẬN (`notes`), không chặn `pnpm contracts`.
 * Nối chặt là việc tự nhiên của `release/R-005` (`impl: v1`).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validate,
  titleFormulasSchema,
  loadChannelTitleFormulas,
  titleFormulaIdsFor,
  type TitleFormulasPack,
} from '@crux/kernel';

export interface ReleaseArtifactForFormulaCheck {
  channel: string;
  producer: { impl: string };
  payload: { package?: { titles?: { formula: string }[] } };
}

/** Soát một `title-formulas.json` đã nạp. Rỗng là ok. */
export function titleFormulasPackProblems(slug: string, value: unknown): string[] {
  const result = validate(value, titleFormulasSchema);
  if (!result.valid) {
    return result.errors.map(
      (e) => `packs/channels/${slug}/title-formulas.json ${e.path}: ${e.message}`,
    );
  }
  const ids = (value as TitleFormulasPack).formulas.map((f) => f.id);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  return dup.length > 0
    ? [`packs/channels/${slug}/title-formulas.json có id trùng: ${dup.join(', ')}`]
    : [];
}

/** Quét mọi `title-formulas.json` dưới `packs/channels/` — kênh nào cũng soát, không hardcode tên. */
export function allTitleFormulasPackProblems(root: string): { problems: string[]; checked: number } {
  const problems: string[] = [];
  let checked = 0;
  const channelsRoot = join(root, 'packs', 'channels');
  if (!existsSync(channelsRoot)) return { problems, checked };
  for (const slug of readdirSync(channelsRoot)) {
    const path = join(channelsRoot, slug, 'title-formulas.json');
    if (!existsSync(path)) continue;
    checked += 1;
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    problems.push(...titleFormulasPackProblems(slug, value));
  }
  return { problems, checked };
}

/**
 * Đối chiếu `titles[].formula` của một artifact `release` với danh sách
 * thật của đúng kênh nó khai. `impl: stub` chỉ ghi nhận (`notes`), `impl`
 * khác `stub` thì chặn (`problems`).
 */
export function releaseFormulaProblems(
  root: string,
  label: string,
  artifact: ReleaseArtifactForFormulaCheck,
): { problems: string[]; notes: string[] } {
  const titles = artifact.payload?.package?.titles ?? [];
  if (titles.length === 0) return { problems: [], notes: [] };

  let pack: TitleFormulasPack;
  try {
    pack = loadChannelTitleFormulas(root, artifact.channel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      problems: [`${label}: không đọc được title-formulas.json của kênh "${artifact.channel}": ${message}`],
      notes: [],
    };
  }

  const validIds = titleFormulaIdsFor(pack);
  const invalid = [...new Set(titles.map((t) => t.formula).filter((f) => !validIds.has(f)))];
  if (invalid.length === 0) return { problems: [], notes: [] };

  const message =
    `${label}: titles[].formula ngoài packs/channels/${artifact.channel}/title-formulas.json — ${invalid.join(', ')}`;
  return artifact.producer.impl === 'stub' ? { problems: [], notes: [message] } : { problems: [message], notes: [] };
}
