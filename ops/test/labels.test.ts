/**
 * `ops/labels.json` là nguồn sự thật của hệ thống nhãn (CHARTER mục 9).
 *
 * Bài kiểm này tồn tại vì một lỗi thật: `ci` run trên PR #20 đỏ với
 * `HTTP 422 · description is too long (maximum is 100 characters)`. GitHub
 * chặn mô tả nhãn dài quá 100 ký tự, và chỗ duy nhất phát hiện ra điều đó
 * trước đây là **sau khi** PR đã mở và CI đã chạy.
 *
 * Nó đắt hơn vẻ ngoài: bước tạo nhãn là bước ĐẦU của job `protected-area`,
 * nên một mô tả dài làm job gắn nhãn `owner-merge` đỏ ngay từ dòng đầu —
 * và một PR chạm vùng bảo vệ sẽ không được gắn nhãn (rà soát Z8). Một ký tự
 * thừa trong file JSON làm thủng đường thực thi bất biến I4.
 *
 * Kiểm ở chỗ rẻ nhất nghĩa là kiểm ở đây, không phải ở GitHub.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface Label {
  name: string;
  color: string;
  description: string;
}

const ledger = JSON.parse(readFileSync('ops/labels.json', 'utf8')) as { labels: Label[] };

/** Giới hạn của GitHub, đã gặp thật bằng HTTP 422. */
const MAX_DESCRIPTION = 100;

test('mô tả mỗi nhãn không quá 100 ký tự — GitHub trả 422 nếu dài hơn', () => {
  for (const label of ledger.labels) {
    assert.ok(
      label.description.length <= MAX_DESCRIPTION,
      `nhãn \`${label.name}\`: mô tả dài ${label.description.length} ký tự, tối đa ${MAX_DESCRIPTION}.`,
    );
  }
});

test('mỗi nhãn có đủ name, color hợp lệ và mô tả không rỗng', () => {
  for (const label of ledger.labels) {
    assert.match(label.name, /^[a-z][a-z-]*$/, `tên nhãn \`${label.name}\` không hợp lệ`);
    assert.match(label.color, /^[0-9A-F]{6}$/, `màu của \`${label.name}\` phải là 6 chữ số hex viết hoa`);
    assert.ok(label.description.trim().length > 0, `\`${label.name}\` thiếu mô tả`);
  }
});

test('tên nhãn không trùng nhau', () => {
  const names = ledger.labels.map((label) => label.name);
  assert.equal(new Set(names).size, names.length, names.join(', '));
});

test('năm nhãn mà ci.yml tự tạo đều có mặt trong sổ', () => {
  // `protected-area` đọc đúng năm dòng này từ `ops/labels.json`. Thiếu một
  // dòng thì `jq` trả rỗng và job đỏ vì một lý do không liên quan tới PR.
  const names = new Set(ledger.labels.map((label) => label.name));
  for (const needed of ['owner-merge', 'automerge-delayed', 'automerge', 'cross-lane', 'fix']) {
    assert.ok(names.has(needed), `thiếu nhãn \`${needed}\``);
  }
});

test('ci.yml tạo đúng những nhãn nó gắn, không thiếu cái nào', () => {
  const ci = readFileSync('ops/workflows/ci.yml', 'utf8');
  const declared = /for NAME in ([a-z- ]+); do/.exec(ci)?.[1]?.trim().split(/\s+/) ?? [];
  assert.ok(declared.length > 0, 'không đọc được danh sách nhãn trong ci.yml');
  for (const label of ['owner-merge', 'automerge-delayed', 'cross-lane']) {
    assert.ok(declared.includes(label), `ci.yml gắn \`${label}\` nhưng không bảo đảm nó tồn tại`);
  }
});
