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
 * ## Bốn chỗ mà một phép quét thư mục tự mở ra, và cách bịt
 *
 * 1. **Tên file không khớp.** Quét theo hậu tố `.schema.json` thì một file
 *    đặt tên `corpus.v1.json` rơi ra ngoài mà không ai thấy — vẫn là Z, chỉ
 *    lùi một bước. Nên mọi file trong `contracts/` phải hoặc là schema,
 *    hoặc mang **tên** nằm trong `ALLOWED_NON_SCHEMA`; file thứ ba là một
 *    vấn đề. Cùng lý do, một entry không phải file thường — symlink, gãy
 *    hay không — cũng là một vấn đề chứ không phải một lần lọc im lặng.
 * 2. **Thư mục con.** Quét một tầng thì `contracts/v1/*.schema.json` thoát.
 *    Nên quét **đệ quy**.
 * 3. **Quét trúng rỗng.** `contracts/` có mặt mà không schema nào được nhặt
 *    lên là tín hiệu phép quét đang hỏng, không phải tín hiệu "sạch". Git
 *    không giữ thư mục rỗng, nên thư mục có mặt nghĩa là có người đặt gì đó
 *    vào đó.
 * 4. **Xưởng lạ.** Ba hố trên đều nằm *bên trong* một xưởng mà
 *    `kernel/src/envelope.ts` đã liệt kê. Một thư mục `workshops/<tên>/` có
 *    mặt trên đĩa mà `WORKSHOPS` chưa biết thì contract của nó ngoài tầm
 *    quét — cùng hình dạng Z, chỉ lùi thêm một tầng. Nên tập xưởng là
 *    **phép hợp** của `WORKSHOPS` với những gì có thật dưới `workshops/`, và
 *    thư mục lạ là một vấn đề chứ không phải một lần bỏ qua im lặng.
 *
 * ## Chỗ mà file này KHÔNG tự chặn được
 *
 * Tổng số contract bằng 0 trên toàn repo vẫn cho `[]`: không có cách nào ở
 * đây phân biệt "phép quét hỏng" với "chưa xưởng nào có contract", mà hôm
 * nay năm trên sáu xưởng đúng là chưa có. Lớp chặn thật nằm ở
 * `ops/test/check-workshop-contracts.test.ts`, bài *repo thật sạch, và ba
 * contract của `T-008` nằm TRONG tầm quét* — nó ghim đủ ba tên file, nên
 * đổi tên hay xoá `workshops/topic/contracts/` là `pnpm test` đỏ. Số file
 * quét được vẫn đi ra dòng kết của `pnpm contracts`, nhưng đó là thứ để
 * người đọc thấy, **không** phải lớp chặn.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
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

/** Kết quả một lượt quét: contract nhặt được, cộng mọi vấn đề gặp trên đường. */
export interface ContractScan {
  files: WorkshopContractFile[];
  problems: string[];
}

function contractsDir(root: string, workshop: string): string {
  return join(root, 'workshops', workshop, 'contracts');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Tên các xưởng cần soát: **phép hợp** của `WORKSHOPS` với các thư mục có
 * thật dưới `workshops/`. Thư mục lạ đi kèm một dòng vấn đề (hố 4).
 *
 * `workshops/` không đọc được — kể cả khi không tồn tại — cũng là một dòng
 * vấn đề, không phải một tập rỗng im lặng: một gốc không có `workshops/`
 * thì mọi phép kiểm dưới đây thành rỗng mà vẫn xanh.
 */
function workshopNames(root: string): { names: string[]; problems: string[] } {
  const known = new Set<string>(WORKSHOPS);
  const problems: string[] = [];
  let onDisk: string[];
  try {
    onDisk = readdirSync(join(root, 'workshops'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    return { names: [...known], problems: [`Không đọc được workshops/ — ${describe(error)}`] };
  }

  for (const name of onDisk) {
    if (known.has(name)) continue;
    problems.push(
      `workshops/${name}/ là xưởng lạ: không có trong WORKSHOPS (kernel/src/envelope.ts), nên contract ` +
        `của nó nằm ngoài mọi phép kiểm khác. Khai nó vào kernel, hoặc bỏ thư mục.`,
    );
  }
  return { names: [...new Set([...known, ...onDisk])].sort(), problems };
}

/**
 * Mọi đường dẫn tương đối bên trong `dir`, đệ quy, chỉ các file thường.
 * `readdirSync(recursive)` trả cả thư mục con, nên lọc lại bằng `lstatSync`.
 *
 * Không ném: một symlink gãy hay một `contracts` là file chứ không phải thư
 * mục sẽ làm `check-contracts.ts` chết giữa chừng, và vấn đề của **năm việc
 * kia** không bao giờ được in ra. Mã thoát vẫn khác 0, nhưng báo lỗi thì
 * hỏng.
 */
function walkFiles(dir: string, label: string): { files: string[]; problems: string[] } {
  let entries: string[];
  try {
    entries = readdirSync(dir, { recursive: true, encoding: 'utf8' });
  } catch (error) {
    return { files: [], problems: [`${label}: không đọc được thư mục contract — ${describe(error)}`] };
  }

  const files: string[] = [];
  const problems: string[] = [];
  for (const entry of entries.sort()) {
    let stat;
    try {
      // `lstatSync`, không `statSync`: `statSync` đi theo symlink nên một
      // symlink gãy ném `ENOENT` ngay tại đây.
      stat = lstatSync(join(dir, entry));
    } catch (error) {
      problems.push(`${label}/${entry}: không đọc được — ${describe(error)}`);
      continue;
    }
    if (stat.isFile()) {
      files.push(entry);
    } else if (!stat.isDirectory()) {
      // Symlink (gãy hay không), fifo, socket… Lọc im lặng là đúng hình
      // dạng Z: một symlink tên `corpus.v0.schema.json` trỏ tới contract
      // thật sẽ không bao giờ được kiểm, và không gì đỏ.
      problems.push(
        `${label}/${entry}: không phải file thường (symlink?) nên nằm ngoài tầm quét. ` +
          `Thay bằng file thật, hoặc chuyển ra khỏi thư mục contract.`,
      );
    }
  }
  return { files, problems };
}

/**
 * Một lượt quét duy nhất cho cả số đếm lẫn danh sách vấn đề — đi hai lượt
 * trên cùng cây thư mục chỉ là thừa.
 *
 * Không ném: `check-contracts.ts` gom vấn đề của cả sáu việc rồi in một
 * lần, nên một ngoại lệ ở đây sẽ giấu mất phần còn lại.
 */
export function scanWorkshopContracts(root: string): ContractScan {
  const { names, problems } = workshopNames(root);
  const scan: ContractScan = { files: [], problems: [...problems] };

  for (const workshop of names) {
    const dir = contractsDir(root, workshop);
    if (!existsSync(dir)) continue;
    const dirLabel = `workshops/${workshop}/contracts`;

    const walked = walkFiles(dir, dirLabel);
    scan.problems.push(...walked.problems);

    const schemas = walked.files.filter((entry) => entry.endsWith(SCHEMA_SUFFIX));

    // Hố 3: thư mục có mặt mà không nhặt được schema nào.
    if (schemas.length === 0 && walked.problems.length === 0) {
      scan.problems.push(
        `${dirLabel}/ có mặt nhưng không file nào khớp \`*${SCHEMA_SUFFIX}\` — ` +
          `phép quét trúng rỗng, không phải sạch.`,
      );
    }

    // Hố 1: file nằm trong thư mục contract mà ngoài tầm quét. So theo TÊN
    // file, không theo đường dẫn — `v1/README.md` cũng là một README.
    for (const entry of walked.files) {
      if (entry.endsWith(SCHEMA_SUFFIX)) continue;
      if (ALLOWED_NON_SCHEMA.has(basename(entry))) continue;
      scan.problems.push(
        `${dirLabel}/${entry}: không theo tên \`*${SCHEMA_SUFFIX}\` nên nằm ngoài tầm quét. ` +
          `Đổi tên, hoặc chuyển ra khỏi thư mục contract.`,
      );
    }

    for (const entry of schemas) {
      const path = join(dir, entry);
      scan.files.push({ workshop, label: relative(root, path), path });
    }
  }

  for (const { label, path } of scan.files) {
    let schema: unknown;
    try {
      schema = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      scan.problems.push(`${label}: không đọc được JSON — ${describe(error)}`);
      continue;
    }
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      scan.problems.push(`${label}: contract phải là một object JSON.`);
      continue;
    }
    const unknown = unsupportedKeywords(schema);
    if (unknown.length > 0) {
      scan.problems.push(`${label}: dùng từ khoá validator chưa hỗ trợ: ${unknown.join(', ')}`);
    }
  }

  return scan;
}

/**
 * Các file contract của mọi xưởng, xếp theo tên xưởng rồi theo tên file —
 * thứ tự ổn định để dòng vấn đề không đổi chỗ giữa hai lần chạy.
 */
export function workshopContractFiles(root: string): WorkshopContractFile[] {
  return scanWorkshopContracts(root).files;
}

/** Danh sách vấn đề, rỗng là ok. */
export function workshopContractProblems(root: string): string[] {
  return scanWorkshopContracts(root).problems;
}
