#!/usr/bin/env node
/**
 * Contract của xưởng nằm ngoài tầm quét của `pnpm contracts` — cơ chế của
 * mục `integration/I-013`.
 *
 * `ops/scripts/check-contracts.ts` việc số 2 chạy `unsupportedKeywords`
 * trên phong bì cộng sáu payload v0 của `kernel/contracts/`, và chỉ thế.
 * Mục `topic/T-008` thêm ba contract ở `workshops/topic/contracts/` — đúng
 * luật phân định của `CLAUDE.md` mục 12, vì corpus và kiểm mới lạ không
 * trung tính với thể loại lẫn kênh nên chúng không thuộc `kernel/`. Nhưng
 * thư mục đó **không ai quét**.
 *
 * `T-008` tự bù bằng ba test gọi `unsupportedKeywords` cho ba schema của
 * nó. Cơ chế bù đó là **opt-in**: contract thứ tư thả vào
 * `workshops/<tên>/contracts/` mà tác giả quên viết test tương ứng thì nó
 * dùng từ khoá validator chưa hiểu, ràng buộc im lặng không được kiểm, và
 * **không gì đỏ**. Đúng nhóm **Z** của `ops/known-failures.md` — và đúng
 * cái mà `pnpm contracts` tồn tại để chặn.
 *
 * ## Ba chỗ mà một phép quét thư mục tự mở ra, và cách bịt
 *
 * 1. **Tên file không khớp.** Quét theo hậu tố `.schema.json` thì một file
 *    đặt tên `corpus.v1.json` rơi ra ngoài mà không ai thấy — vẫn là Z, chỉ
 *    lùi một bước. Nên mọi file trong `contracts/` phải hoặc là schema,
 *    hoặc nằm trong `ALLOWED_NON_SCHEMA`; file thứ ba là một vấn đề.
 * 2. **Thư mục con.** Quét một tầng thì `contracts/v1/*.schema.json` thoát.
 *    Nên quét **đệ quy**.
 * 3. **Quét trúng rỗng.** `contracts/` có mặt mà không schema nào được nhặt
 *    lên là tín hiệu phép quét đang hỏng, không phải tín hiệu "sạch". Git
 *    không giữ thư mục rỗng, nên thư mục có mặt nghĩa là có người đặt gì đó
 *    vào đó.
 *
 * Số file quét được đi ra dòng kết của `pnpm contracts`: "0 contract xưởng"
 * in ra màn hình là thứ người đọc bắt được, còn một phép quét im lặng trả
 * rỗng thì không.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { WORKSHOPS, unsupportedKeywords } from '@crux/kernel';

/** Hậu tố bắt buộc của một file contract trong `workshops/<tên>/contracts/`. */
export const SCHEMA_SUFFIX = '.schema.json';

/** File được phép nằm cạnh các schema mà không phải schema. */
export const ALLOWED_NON_SCHEMA = new Set(['README.md']);

export interface WorkshopContractFile {
  workshop: string;
  /** Đường dẫn tương đối gốc repo — đi thẳng vào dòng vấn đề, đọc được. */
  label: string;
  path: string;
}

function contractsDir(root: string, workshop: string): string {
  return join(root, 'workshops', workshop, 'contracts');
}

/**
 * Mọi đường dẫn tương đối bên trong `dir`, đệ quy, chỉ các file thường.
 * `readdirSync(recursive)` trả cả thư mục con, nên lọc lại bằng `statSync`.
 */
function walkFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => statSync(join(dir, entry)).isFile())
    .sort();
}

/**
 * Các file contract của mọi xưởng, xếp theo thứ tự `WORKSHOPS` rồi theo
 * tên file — thứ tự ổn định để dòng vấn đề không đổi chỗ giữa hai lần chạy.
 */
export function workshopContractFiles(root: string): WorkshopContractFile[] {
  const found: WorkshopContractFile[] = [];
  for (const workshop of WORKSHOPS) {
    const dir = contractsDir(root, workshop);
    if (!existsSync(dir)) continue;
    for (const entry of walkFiles(dir)) {
      if (!entry.endsWith(SCHEMA_SUFFIX)) continue;
      const path = join(dir, entry);
      found.push({ workshop, label: relative(root, path), path });
    }
  }
  return found;
}

/**
 * Danh sách vấn đề, rỗng là ok. Không ném: `check-contracts.ts` gom vấn đề
 * của cả năm việc rồi in một lần, nên một ngoại lệ ở đây sẽ giấu mất phần
 * còn lại.
 */
export function workshopContractProblems(root: string): string[] {
  const problems: string[] = [];

  for (const workshop of WORKSHOPS) {
    const dir = contractsDir(root, workshop);
    if (!existsSync(dir)) continue;

    const entries = walkFiles(dir);
    const schemas = entries.filter((entry) => entry.endsWith(SCHEMA_SUFFIX));

    // Hố 3: thư mục có mặt mà không nhặt được schema nào.
    if (schemas.length === 0) {
      problems.push(
        `workshops/${workshop}/contracts/ có mặt nhưng không file nào khớp \`*${SCHEMA_SUFFIX}\` — ` +
          `phép quét trúng rỗng, không phải sạch.`,
      );
    }

    // Hố 1: file nằm trong thư mục contract mà ngoài tầm quét.
    for (const entry of entries) {
      if (entry.endsWith(SCHEMA_SUFFIX)) continue;
      if (ALLOWED_NON_SCHEMA.has(entry)) continue;
      problems.push(
        `workshops/${workshop}/contracts/${entry}: không theo tên \`*${SCHEMA_SUFFIX}\` nên nằm ngoài ` +
          `tầm quét. Đổi tên, hoặc chuyển ra khỏi thư mục contract.`,
      );
    }
  }

  for (const { label, path } of workshopContractFiles(root)) {
    let schema: unknown;
    try {
      schema = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      problems.push(`${label}: không đọc được JSON — ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      problems.push(`${label}: contract phải là một object JSON.`);
      continue;
    }
    const unknown = unsupportedKeywords(schema);
    if (unknown.length > 0) {
      problems.push(`${label}: dùng từ khoá validator chưa hỗ trợ: ${unknown.join(', ')}`);
    }
  }

  return problems;
}
