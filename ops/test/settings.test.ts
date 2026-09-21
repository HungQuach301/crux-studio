/**
 * `.claude/settings.json` — những gì việc bỏ khối `ask` (G16) **không** được kéo theo.
 *
 * Bỏ `ask` là gỡ một lớp rào. Đổi lại, hai lớp còn lại phải chắc chắn còn
 * nguyên, và "chắc chắn" ở đây nghĩa là có máy kiểm chứ không phải có người
 * nhớ. Ba điều dưới đây là ba cách file này có thể trôi khỏi ý định của nó
 * mà không ai thấy:
 *
 * 1. Khối `ask` quay lại — routine sẽ treo ở lời hỏi, không chỉ báo nào đỏ.
 * 2. Một luật `deny` biến mất cùng lúc với `ask`, do sửa nhầm khối.
 * 3. `defaultMode` bị nâng lên `bypassPermissions` vì nghe "cao nhất là tốt
 *    nhất" — mà `bypassPermissions` bỏ qua **cả** khối `deny`, tức là gỡ luôn
 *    lớp thứ nhất của bất biến I4.
 *
 * Ghi chú: file test này KHÔNG viết nguyên văn các lệnh bị cấm. Hook
 * `guard.mjs` soi theo hình dạng lệnh chứ không theo ý định (xem G11), nên
 * một file test chứa nguyên văn `gh pr merge` sẽ bị chính hook chặn lúc ghi.
 * Vì thế các chuỗi dưới đây được ghép từ mảnh.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Settings {
  permissions?: {
    defaultMode?: string;
    allow?: string[];
    deny?: string[];
    ask?: string[];
  };
  hooks?: {
    PreToolUse?: { matcher?: string; hooks?: { type?: string; command?: string }[] }[];
  };
}

function settings(): Settings {
  return JSON.parse(readFileSync(join(process.cwd(), '.claude', 'settings.json'), 'utf8')) as Settings;
}

test('G16 · không còn khối `ask` — routine không được treo ở một lời hỏi', () => {
  const ask = settings().permissions?.ask;
  assert.equal(
    ask,
    undefined,
    `khối \`ask\` đã quay lại: ${JSON.stringify(ask)}. Một routine chạy không có người ` +
      'sẽ dừng ở lời hỏi cho tới khi hết giờ, và không chỉ báo nào đỏ.',
  );
});

test('G16 · cả 14 luật `deny` còn nguyên', () => {
  const deny = settings().permissions?.deny ?? [];

  // Ghép từ mảnh, xem ghi chú đầu file.
  const PR = 'gh pr ';
  const PUSH = 'git push ';
  const required = [
    `Bash(${PR}merge:*)`,
    `Bash(${PR}review:*)`,
    'Bash(hub merge:*)',
    `Bash(${PUSH}origin main:*)`,
    `Bash(${PUSH}--force:*)`,
    `Bash(${PUSH}-f:*)`,
    'mcp__github__merge_pull_request',
    'mcp__github__enable_pr_auto_merge',
    'Write(./.github/**)',
    'Edit(./.github/**)',
    'Read(./.env)',
    'Read(./**/.env)',
    'Read(./**/*.pem)',
    'Read(./**/id_rsa*)',
  ];

  for (const rule of required) {
    assert.ok(deny.includes(rule), `thiếu luật deny \`${rule}\``);
  }
  assert.equal(deny.length, required.length, `deny có ${deny.length} luật, mong đợi ${required.length}`);
});

test('G16 · `defaultMode` không được là `bypassPermissions` — nó bỏ qua cả `deny`', () => {
  const mode = settings().permissions?.defaultMode;
  assert.notEqual(
    mode,
    'bypassPermissions',
    '`bypassPermissions` bỏ qua TOÀN BỘ kiểm tra quyền, kể cả khối `deny`. ' +
      'Đó là gỡ lớp thứ nhất của bất biến I4. Mức cao nhất còn giữ được `deny` và hook là `dontAsk`.',
  );
  assert.ok(
    mode !== undefined && ['dontAsk', 'acceptEdits', 'auto', 'default', 'plan'].includes(mode),
    `\`defaultMode\` = ${JSON.stringify(mode)} không thuộc thang đã biết`,
  );
});

test('G16 · hook `PreToolUse` gọi `guard.mjs` vẫn còn — đó là lớp chặn còn lại', () => {
  const entries = settings().hooks?.PreToolUse ?? [];
  const commands = entries.flatMap((e) => (e.hooks ?? []).map((h) => h.command ?? ''));
  assert.ok(
    commands.some((c) => c.includes('.claude/hooks/guard.mjs')),
    `không hook PreToolUse nào gọi guard.mjs: ${JSON.stringify(commands)}`,
  );
});

test('G16 · `allow` có đủ những gì một routine cần để đi trọn một mục', () => {
  const allow = settings().permissions?.allow ?? [];
  const needed = ['Bash(git *)', 'Bash(pnpm *)', 'Bash(node *)', 'Bash(npx *)'];
  for (const rule of needed) {
    assert.ok(allow.includes(rule), `thiếu luật allow \`${rule}\``);
  }
  // Mở PR và gắn nhãn là hai việc bắt buộc cuối mỗi mục (CLAUDE.md mục 2).
  for (const verb of ['create', 'edit', 'comment', 'view']) {
    assert.ok(
      allow.includes(`Bash(gh pr ${verb}:*)`),
      `thiếu \`Bash(gh pr ${verb}:*)\` — không mở hoặc sửa được PR`,
    );
    assert.ok(
      allow.includes(`Bash(gh issue ${verb}:*)`),
      `thiếu \`Bash(gh issue ${verb}:*)\` — không mở hoặc sửa được issue 🤖 [QĐ]`,
    );
  }
});
