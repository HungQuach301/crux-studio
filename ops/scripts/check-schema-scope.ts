#!/usr/bin/env node
/**
 * Phạm vi quét contract vẫn buộc bằng quy ước thư mục, không bằng phép kiểm
 * — cơ chế của mục `integration/I-014`.
 *
 * Mục `I-013` đưa `workshops/<tên>/contracts/**\/*.schema.json` vào
 * `pnpm contracts` (việc số 6, `ops/scripts/check-workshop-contracts.ts`).
 * Nhưng phạm vi đó dừng ở **quy ước thư mục**: một `*.schema.json` đặt ở
 * `workshops/<tên>/src/`, ở `packs/**`, hay bất cứ đâu khác dưới hai cây đó
 * vẫn ngoài tầm quét, và **không gì buộc** file mà `src/*.ts` nạp phải nằm
 * trong tập được quét. Hôm nay hai bên trùng nhau vì quy ước, không vì một
 * phép kiểm — đúng hình dạng nhóm **Z** một tầng nữa: đổi chỗ một file là
 * phép kiểm biến mất mà mọi chỉ báo vẫn xanh.
 *
 * File này đóng lỗ đó bằng cách **không dựa vào vị trí**: MỌI `*.schema.json`
 * dưới `workshops/` và `packs/` đều chịu phép kiểm từ khoá, dù nằm ở thư mục
 * nào. Các schema đã nằm trong `workshops/<tên>/contracts/` do việc số 6 lo
 * (nó còn soát thêm hố tên file, thư mục con, quét rỗng, xưởng lạ) — file
 * này lo phần CÒN LẠI, để không kiểm hai lần cùng một file và không giẫm lên
 * các dòng vấn đề của việc số 6.
 *
 * Vì sao KHÔNG chỉ "đòi mọi schema phải nằm trong contracts/": `packs/` là
 * chỗ hợp lệ cho schema của genre pack và channel pack, mà `packs/**` không
 * có phép quét `contracts/` riêng. Đòi dời chúng vào một `contracts/` của
 * xưởng là vô nghĩa. Lớp chặn thật là kiểm từ khoá ngay tại chỗ — nên đó là
 * thứ file này làm, cho cả hai cây.
 *
 * ## Chỗ mà file này KHÔNG tự chặn được
 *
 * Một schema mang **tên khác** `*.schema.json` (ví dụ `corpus.v1.json`) mà
 * `src/*.ts` vẫn nạp thì file này không thấy — cùng "hố tên file" của việc
 * số 6, chỉ khác là ngoài `contracts/` ta không có danh sách trắng
 * `ALLOWED_NON_SCHEMA` để đối chiếu, nên không đoán được file nào là schema
 * trá hình. I-014 khoanh vào đúng phần đo được: mọi file THEO tên
 * `*.schema.json`, dù nằm ở đâu, đều qua phép kiểm.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unsupportedKeywords } from '@crux/kernel';

/** Hậu tố nhận diện một file schema — cùng quy ước với việc số 6. */
export const SCHEMA_SUFFIX = '.schema.json';

/**
 * Hai cây phải phủ hết: sản phẩm của xưởng và cấu hình theo thể loại/kênh.
 * `kernel/contracts/` do việc số 2 của `check-contracts.ts` lo, không nằm
 * đây.
 */
export const SCOPE_ROOTS = ['workshops', 'packs'] as const;

export interface SchemaScopeScan {
  /** Đường dẫn tương đối gốc repo (dấu `/`) của các schema file này đã kiểm. */
  files: string[];
  /** Vấn đề gặp trên đường, rỗng là ok. */
  problems: string[];
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thư mục mà việc số 6 (`check-workshop-contracts.ts`) **độc quyền** quét:
 * `workshops/<tên>/contracts` (rồi đệ quy bên trong). `walk` cắt ở đúng ranh
 * giới thư mục này, KHÔNG đi vào — nên cả file thường LẪN dòng vấn đề
 * (symlink trá hình chẳng hạn) trong đó đều thuộc về một mình việc số 6,
 * không bị báo hai lần. Cắt ở thư mục, không lọc ở danh sách file cuối, vì
 * dòng vấn đề symlink phát ngay trong lúc `walk` — lọc sau không gỡ được nó.
 *
 * So khớp bằng đường dẫn tương đối dùng dấu `/`, đúng thứ `walk` dựng ra.
 */
function isWorkshopContractsDir(relPosix: string): boolean {
  return /^workshops\/[^/]+\/contracts$/.test(relPosix);
}

/**
 * Mọi file `*.schema.json` dưới `scopeRoot`, đệ quy, chỉ file thường.
 *
 * Không ném: một symlink gãy hay một entry lạ sẽ làm `check-contracts.ts`
 * chết giữa chừng, và vấn đề của các việc kia không bao giờ được in ra —
 * cùng lý do việc số 6 tránh ném (`walkFiles`). Một entry KHÔNG phải file
 * thường mà lại mang tên `*.schema.json` là một dòng vấn đề: lọc nó im lặng
 * nghĩa là một schema trá hình bằng symlink không bao giờ được kiểm.
 */
function walk(root: string, rel: string, out: string[], problems: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(join(root, rel), { encoding: 'utf8' });
  } catch (error) {
    problems.push(`${rel}: không đọc được thư mục — ${describe(error)}`);
    return;
  }

  for (const name of entries.sort()) {
    const childRel = `${rel}/${name}`;
    let stat;
    try {
      // `lstatSync`, không `statSync`: `statSync` đi theo symlink nên một
      // symlink gãy ném `ENOENT` ngay tại đây.
      stat = lstatSync(join(root, childRel));
    } catch (error) {
      problems.push(`${childRel}: không đọc được — ${describe(error)}`);
      continue;
    }
    if (stat.isDirectory()) {
      // Việc số 6 độc quyền cây `workshops/<tên>/contracts/` — không đi vào,
      // để một file (hay symlink) trong đó không bị hai việc cùng báo.
      if (isWorkshopContractsDir(childRel)) continue;
      walk(root, childRel, out, problems);
    } else if (stat.isFile()) {
      if (childRel.endsWith(SCHEMA_SUFFIX)) out.push(childRel);
    } else if (childRel.endsWith(SCHEMA_SUFFIX)) {
      problems.push(
        `${childRel}: không phải file thường (symlink?) nên nằm ngoài phép kiểm từ khoá. ` +
          `Thay bằng file thật.`,
      );
    }
  }
}

/**
 * Một lượt quét cho cả hai cây: gom mọi `*.schema.json` ngoài tầm việc số 6,
 * rồi chạy `unsupportedKeywords` trên từng file. Không ném (xem `walk`).
 */
export function scanSchemaScope(root: string): SchemaScopeScan {
  const problems: string[] = [];
  const found: string[] = [];

  for (const scopeRoot of SCOPE_ROOTS) {
    // Thư mục không tồn tại thì bỏ qua — `packs/` hay `workshops/` vắng mặt
    // ở một gốc con là hợp lệ. Thư mục có mặt mà không đọc được thì `walk`
    // ghi một dòng vấn đề, không phải một tập rỗng im lặng.
    if (!existsSync(join(root, scopeRoot))) continue;
    walk(root, scopeRoot, found, problems);
  }

  // `walk` đã cắt cây `workshops/<tên>/contracts/` ở ranh giới thư mục, nên
  // `found` không bao giờ chứa file thuộc việc số 6 — chỉ cần sắp cho ổn định.
  const files = found.sort();

  for (const rel of files) {
    let schema: unknown;
    try {
      schema = JSON.parse(readFileSync(join(root, rel), 'utf8'));
    } catch (error) {
      problems.push(`${rel}: không đọc được JSON — ${describe(error)}`);
      continue;
    }
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      problems.push(`${rel}: contract phải là một object JSON.`);
      continue;
    }
    const unknown = unsupportedKeywords(schema);
    if (unknown.length > 0) {
      problems.push(
        `${rel}: dùng từ khoá validator chưa hỗ trợ: ${unknown.join(', ')} ` +
          `(nằm ngoài contracts/ nhưng vẫn phải qua phép kiểm từ khoá — I-014).`,
      );
    }
  }

  return { files, problems };
}

/** Các schema ngoài tầm việc số 6 mà lượt này đã kiểm từ khoá. */
export function schemaScopeFiles(root: string): string[] {
  return scanSchemaScope(root).files;
}

/** Danh sách vấn đề, rỗng là ok. */
export function schemaScopeProblems(root: string): string[] {
  return scanSchemaScope(root).problems;
}
