#!/usr/bin/env node
/**
 * Hook chặn của Crux Studio (CHARTER mục 3, bất biến I4).
 *
 * Chạy trước mỗi lần agent dùng công cụ. Nhận sự kiện JSON ở stdin; thoát
 * mã 2 để CHẶN và in lý do ra stderr cho agent đọc.
 *
 * Ba việc nó chặn, không có ngoại lệ:
 * 1. Merge PR dưới mọi hình thức — agent chỉ được gắn nhãn (CHARTER 3.3).
 * 2. Ghi vào `.github/` — agent viết workflow vào `ops/workflows/` (CHARTER 3.2, giả định G10).
 * 3. Push thẳng vào `main`, và tắt trailer `Claude-Session` (CHARTER 3.1).
 *
 * File này nằm trong vùng bảo vệ `.claude/**`. Sửa nó là một PR `owner-merge`.
 * Nó cố ý KHÔNG phụ thuộc gói nào, để không hỏng khi node_modules chưa cài.
 */

const DENY = [
  {
    // Merge: gh, hub, API, và auto-merge. Kể cả nút "Merge it" của Projects
    // cũng đi qua một trong các đường này.
    test: (c) =>
      /\bgh\s+pr\s+merge\b/.test(c) ||
      /\bhub\s+merge\b/.test(c) ||
      /\bgh\s+api\b[^\n]*\/pulls\/\d+\/merge/.test(c) ||
      /\bgh\s+pr\s+(review[^\n]*--approve|ready[^\n]*--auto)/.test(c),
    why:
      'Agent không bao giờ merge PR (CHARTER 3.3). Việc cần làm: gắn nhãn `automerge` ' +
      '(PR không chạm vùng bảo vệ) hoặc `owner-merge` (PR có chạm), rồi kết thúc.',
  },
  {
    test: (c) => /\bgit\s+push\b[^\n]*\b(origin\s+)?(HEAD:)?main\b/.test(c) || /\bgit\s+push\b[^\n]*:main\b/.test(c),
    why: 'Không thay đổi nào vào main ngoài PR đã có CI xanh (bất biến I2). Push vào nhánh claude/<lane>/<id>.',
  },
  {
    test: (c) => /(^|\s)(rm|mv|cp|sed|tee|cat)\b[^\n]*\.github\//.test(c) || />\s*\.github\//.test(c),
    why: 'Agent không ghi vào .github/ (CHARTER 3.2, giả định G10). Workflow viết vào ops/workflows/.',
  },
  {
    test: (c) => /attribution\.sessionUrl/.test(c) && /(false|off|disable|unset)/i.test(c),
    why: 'Không được tắt trailer Claude-Session (CHARTER 3.1). Đó là dấu vết duy nhất phân biệt người với máy lúc này.',
  },
  {
    test: (c) => /\bgit\s+(commit|rebase|merge)\b[^\n]*--no-verify\b/.test(c),
    why: 'Không bỏ qua hook. Hook bị chặn là hệ thống đang chạy đúng, không phải một trở ngại cần lách.',
  },
];

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const DENIED_MCP = /^mcp__github__(merge_pull_request|enable_pr_auto_merge)$/;

function block(reason) {
  process.stderr.write(`CHẶN — ${reason}\n`);
  process.exit(2);
}

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event;
try {
  event = JSON.parse(raw || '{}');
} catch {
  process.exit(0); // Không đọc được sự kiện thì không chặn nhầm.
}

const tool = event.tool_name ?? '';
const input = event.tool_input ?? {};

if (DENIED_MCP.test(tool)) {
  block(`Công cụ ${tool} bị cấm: agent không merge và không bật auto-merge (CHARTER 3.3).`);
}

if (tool === 'Bash') {
  const command = String(input.command ?? '');
  for (const rule of DENY) {
    if (rule.test(command)) block(rule.why);
  }
}

if (WRITE_TOOLS.has(tool)) {
  const path = String(input.file_path ?? input.notebook_path ?? '');
  if (/(^|\/)\.github\//.test(path)) {
    block('Agent không ghi vào .github/ (CHARTER 3.2, giả định G10). Workflow viết vào ops/workflows/.');
  }
}

process.exit(0);
