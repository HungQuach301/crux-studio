/**
 * Luật mềm `cross-lane` (CHARTER mục 4), mục `platform/P-057`.
 *
 * Luật chỉ có giá trị khi nó đếm **đúng** — nên mỗi ca "gộp về 1" đi kèm
 * một ca "phải ra 2", đúng như tiêu chí xong của mục đòi (bài học KF-003:
 * một luật không có test âm là một luật không ai biết đã hỏng).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  countLanesTouched,
  lanesTouched,
  laneOfPath,
  unquote,
} from '../scripts/cross-lane.ts';

test('P-057 · gộp về 1: cùng một làn ở ops/lanes/x và ops/logs/x', () => {
  // Tiêu chí xong: chạm `ops/lanes/platform/` và `ops/logs/platform/` → 1.
  const changed = ['ops/lanes/platform/backlog.md', 'ops/logs/platform/P-057.jsonl'];
  assert.equal(countLanesTouched(changed), 1);
  assert.deepEqual([...lanesTouched(changed)], ['platform']);
});

test('P-057 · TEST ÂM: hai làn khác nhau ở ops/lanes/x và ops/logs/y → 2', () => {
  // Tiêu chí xong: chạm `ops/lanes/platform/` và `ops/logs/integration/` → 2.
  // Đây đúng là ca hay gặp nhất: việc của một làn cộng dòng log bước 0 của
  // `integration` — thứ bộ dò `grep` cũ không thấy.
  const changed = ['ops/lanes/platform/backlog.md', 'ops/logs/integration/step0-x-crux-worker-3.jsonl'];
  assert.equal(countLanesTouched(changed), 2);
  assert.deepEqual([...lanesTouched(changed)].sort(), ['integration', 'platform']);
});

test('P-057 · ca hay gặp: PR làn platform kèm dòng log bước 0 → cross-lane', () => {
  // Chính là hình dạng của mọi PR worker từ D-C04: một mục platform, cộng
  // một dòng bước 0 ghi vào ops/logs/integration/. Bộ dò cũ chỉ đếm
  // ops/lanes → 1 → im lặng. Nay ra 2.
  const changed = [
    'ops/scripts/cross-lane.ts',
    'ops/test/cross-lane.test.ts',
    'ops/lanes/platform/backlog.md',
    'ops/logs/platform/P-057.jsonl',
    'ops/logs/integration/step0-x-crux-worker-3.jsonl',
  ];
  assert.equal(countLanesTouched(changed), 2);
  assert.deepEqual([...lanesTouched(changed)].sort(), ['integration', 'platform']);
});

test('P-057 · workshops/x và ops/lanes/x cùng làn → 1 (không còn báo động giả)', () => {
  // Bộ dò `grep` cũ giữ `workshops/topic` và `ops/lanes/topic` là hai chuỗi
  // → đếm 2. Cùng một làn `topic` thì đúng phải là 1.
  const changed = ['workshops/topic/src/index.ts', 'ops/lanes/topic/backlog.md'];
  assert.equal(countLanesTouched(changed), 1);
  assert.deepEqual([...lanesTouched(changed)], ['topic']);
});

test('P-057 · thật sự nhiều làn: workshops/visual + ops/lanes/audio → 2', () => {
  const changed = ['workshops/visual/src/render.ts', 'ops/lanes/audio/backlog.md'];
  assert.equal(countLanesTouched(changed), 2);
  assert.deepEqual([...lanesTouched(changed)].sort(), ['audio', 'visual']);
});

test('P-057 · file NGOÀI vùng làn không đếm; PR một làn không phải cross-lane', () => {
  const changed = [
    'kernel/src/log.ts',
    'ops/workflows/ci.yml',
    'docs/assumptions.md',
    'CHARTER.md',
    'ops/lanes/priority.md', // thẳng dưới ops/lanes/, không có đoạn làn
    'ops/logs/P-016.jsonl', // file log phẳng cũ, không có đoạn làn
    'ops/lanes/platform/backlog.md', // làn duy nhất
  ];
  assert.equal(countLanesTouched(changed), 1);
  assert.deepEqual([...lanesTouched(changed)], ['platform']);
});

test('P-057 · đoạn lạ (không phải tên làn) quy về null, không dựng làn ma', () => {
  assert.equal(laneOfPath('ops/logs/tmp/scratch.jsonl'), null);
  assert.equal(laneOfPath('workshops/khong-phai-lan/x.ts'), null);
  assert.equal(laneOfPath('ops/lanes/priority.md'), null);
  assert.equal(laneOfPath('ops/logs/P-016.jsonl'), null);
  assert.equal(laneOfPath('kernel/src/log.ts'), null);
});

test('P-057 · laneOfPath quy đúng cả ba gốc thư mục về tên làn', () => {
  assert.equal(laneOfPath('workshops/audio/tts.ts'), 'audio');
  assert.equal(laneOfPath('ops/lanes/verify/backlog.md'), 'verify');
  assert.equal(laneOfPath('ops/logs/integration/step0-x.jsonl'), 'integration');
});

test('P-057 · đầu vào rỗng → 0 làn, không phải cross-lane', () => {
  assert.equal(countLanesTouched([]), 0);
});

test('P-057 · đường dẫn có dấu ngoặc của core.quotePath vẫn quy đúng về làn', () => {
  // git diff bọc đường dẫn phi-ASCII trong dấu ngoặc kép. Bỏ qua chi tiết đó
  // thì một file log tên tiếng Việt biến mất khỏi phép đếm — fail-open, im
  // lặng, đúng nhóm Z.
  assert.equal(laneOfPath('"ops/logs/topic/tập-vàng.jsonl"'), 'topic');
  assert.equal(unquote('"ops/logs/topic/x.jsonl"'), 'ops/logs/topic/x.jsonl');
  assert.equal(unquote('ops/logs/topic/x.jsonl'), 'ops/logs/topic/x.jsonl');
});
