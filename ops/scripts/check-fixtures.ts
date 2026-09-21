#!/usr/bin/env node
/**
 * Fixture của xưởng không được mang bản sao cấu hình (mục `integration/I-008`).
 *
 * Lỗi đã đo được: sáu file `workshops/<tên>/fixtures/input.json` nhúng mỗi
 * file một bản sao channel pack và một bản sao genre pack. Bản sao channel
 * còn là bản Đợt 0, bản sao genre thiếu năm khoá `limits` mà bản thật đã có.
 * Không có gì đỏ — fixture chạy độc lập nên không ai so nó với `packs/`, và
 * tập vàng không băm pack (`inputsHashOf` chỉ băm con trỏ artifact đầu vào).
 * Đúng nhóm **Z** của `ops/known-failures.md`: lệch mà mọi chỉ báo vẫn xanh.
 *
 * Cách chặn: `readInputFile` của kernel nạp pack từ `packs/` và ném lỗi khi
 * file fixture nhúng khoá `packs`. Kiểm ở đây là phần còn lại — chạy thật
 * `readInputFile` trên cả sáu fixture trong `pnpm contracts`, và so các
 * trường bối cảnh của từng artifact đầu vào với channel pack. Bốn trường đó
 * (`episodeId`, `channel`, `genre`, `locale`) cũng là bản sao, chỉ là bản sao
 * nằm trong phong bì artifact, nên chúng lệch được theo đúng cách cũ.
 *
 * Thiếu fixture cũng là một vấn đề, không phải một lần bỏ qua im lặng: một
 * xưởng không có `input.json` thì mọi kiểm ở đây thành rỗng mà vẫn xanh
 * (`ops/known-failures.md` nhóm Z, cách 3).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSHOPS, readInputFile } from '@crux/kernel';

/** Các trường bối cảnh mà phong bì artifact chép lại từ tập và từ pack. */
const CONTEXT_FIELDS = ['episodeId', 'channel', 'genre', 'locale'] as const;

export function fixtureInputPath(root: string, workshop: string): string {
  return join(root, 'workshops', workshop, 'fixtures', 'input.json');
}

/**
 * Soát một file `--input`. Trả về danh sách vấn đề, rỗng là ok.
 *
 * `label` đi vào mọi dòng vấn đề để người đọc biết file nào, không phải
 * đoán từ đường dẫn tuyệt đối trong thư mục tạm.
 */
export function inputFileProblems(root: string, path: string, label: string): string[] {
  let episode: Record<(typeof CONTEXT_FIELDS)[number], string>;
  try {
    episode = readInputFile(root, path).episode;
  } catch (error) {
    return [`${label}: ${error instanceof Error ? error.message : String(error)}`];
  }

  const problems: string[] = [];
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    upstream?: Record<string, Record<string, unknown>>;
  };

  for (const [workshop, artifact] of Object.entries(file.upstream ?? {})) {
    for (const field of CONTEXT_FIELDS) {
      const actual = artifact[field];
      if (actual !== episode[field]) {
        problems.push(
          `${label}: artifact đầu vào của xưởng ${workshop} khai ${field} ` +
            `"${String(actual)}" nhưng tập khai "${episode[field]}".`,
        );
      }
    }
  }

  return problems;
}

/** Soát fixture `input.json` của cả sáu xưởng. */
export function fixtureInputProblems(root: string): string[] {
  const problems: string[] = [];
  for (const workshop of WORKSHOPS) {
    const path = fixtureInputPath(root, workshop);
    if (!existsSync(path)) {
      problems.push(
        `Xưởng ${workshop} không có fixtures/input.json, nên không kiểm được gì ` +
          `(CHARTER 5.4: mỗi xưởng có bộ fixture riêng).`,
      );
      continue;
    }
    problems.push(...inputFileProblems(root, path, `Fixture ${workshop}/input.json`));
  }
  return problems;
}

const isMain = process.argv[1]?.endsWith('check-fixtures.ts') === true;
if (isMain) {
  const problems = fixtureInputProblems(process.cwd());
  if (problems.length > 0) {
    process.stderr.write(`Fixture có vấn đề:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Fixture ok: ${WORKSHOPS.length} file input.json nạp pack từ packs/.\n`);
}
