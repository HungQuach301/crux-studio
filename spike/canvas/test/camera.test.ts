/**
 * 🤖 Bài kiểm đường đi máy quay của spike canvas (mục `visual/V-002`).
 *
 * Ba bất biến dưới đây đều thuộc nhóm "hỏng mà mọi chỉ báo đều xanh"
 * (nhóm Z trong `ops/known-failures.md`): vi phạm cái nào thì clip vẫn dựng
 * xong, vẫn mở xem được, và số đo hiệu năng vẫn ra một con số — chỉ có điều
 * con số đó không còn trả lời câu hỏi của WP-003 nữa.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANVAS_W, CANVAS_H, VIEW_W, VIEW_H, DURATION_S,
  KEYS, MORPH_FROM, MORPH_TO,
  cameraAt, morphMixAt, rawViewportFor, viewportFor,
} from '../camera.js';

/** Mức chia đủ mịn để bắt cả chỗ trượt ngắn giữa hai mốc. */
const STEP = 0.005;

test('kẹp mép canvas không bao giờ phải làm gì — khuôn hình đúng ý đồ ở mọi thời điểm', () => {
  let worst = 0;
  let worstAt = 0;
  for (let t = 0; t <= DURATION_S; t += STEP) {
    const raw = rawViewportFor(t);
    const clamped = viewportFor(t);
    const drift = Math.max(Math.abs(raw.sx - clamped.sx), Math.abs(raw.sy - clamped.sy));
    if (drift > worst) { worst = drift; worstAt = t; }
  }
  assert.equal(
    worst, 0,
    `máy quay trượt ra ngoài canvas ${worst.toFixed(1)} px tại giây ${worstAt.toFixed(2)} — ` +
    'khung hình sẽ có viền đen, và vùng blit nhỏ hơn làm số đo hiệu năng đẹp giả',
  );
});

test('kiểm âm: một mốc máy quay trượt mép PHẢI bị bắt', () => {
  // Cùng phép đo như bài trên, nhưng trên một đường đi cố tình sai: zoom
  // rộng tới mức khung nhìn to hơn cả canvas. Nếu phép đo không bắt được
  // ca này thì bài kiểm trên là bài kiểm rỗng.
  const badZoom = 0.20;
  const sw = VIEW_W / badZoom;
  const sx = CANVAS_W / 2 - sw / 2;
  const clampedSx = Math.max(0, Math.min(CANVAS_W - sw, sx));
  assert.ok(
    Math.abs(sx - clampedSx) > 0,
    'phép so raw/clamped không phát hiện được khuôn hình rộng hơn canvas',
  );
  assert.ok(badZoom < Math.max(VIEW_W / CANVAS_W, VIEW_H / CANVAS_H));
});

test('không khung nào đứng yên — quy tắc máy quay trôi liên tục của D-04', () => {
  for (const fps of [30, 60]) {
    let frozen = 0;
    let firstFrozenFrame = -1;
    let prev = viewportFor(0);
    for (let f = 1; f <= DURATION_S * fps; f++) {
      const v = viewportFor(f / fps);
      if (v.sx === prev.sx && v.sy === prev.sy && v.sw === prev.sw) {
        frozen++;
        if (firstFrozenFrame < 0) firstFrozenFrame = f;
      }
      prev = v;
    }
    assert.equal(
      frozen, 0,
      `${frozen} khung đứng yên ở ${fps}fps (khung đầu tiên: ${firstFrozenFrame}). ` +
      'Chỉ số 4-6 đo giật hình khi máy quay trôi chậm; khung đứng yên không giật, ' +
      'nên nó làm kết quả đẹp lên mà không đo đúng thứ cần đo',
    );
  }
});

test('mọi mốc giữ zoom trên cận dưới của khung nhìn', () => {
  const floor = Math.max(VIEW_W / CANVAS_W, VIEW_H / CANVAS_H);
  for (const k of KEYS) {
    assert.ok(
      k.zoom >= floor,
      `mốc ở giây ${k.t} có zoom ${k.zoom} < cận dưới ${floor.toFixed(4)}`,
    );
  }
});

test('các mốc xếp tăng dần theo thời gian và phủ trọn 3 phút', () => {
  for (let i = 1; i < KEYS.length; i++) {
    assert.ok(KEYS[i]!.t > KEYS[i - 1]!.t, `mốc ${i} không đứng sau mốc ${i - 1}`);
  }
  assert.equal(KEYS[0]!.t, 0);
  assert.equal(KEYS[KEYS.length - 1]!.t, DURATION_S);
});

test('cameraAt kẹp thời gian ngoài khoảng, không ngoại suy', () => {
  assert.deepEqual(cameraAt(-10), cameraAt(0));
  assert.deepEqual(cameraAt(DURATION_S + 10), cameraAt(DURATION_S));
});

test('morphMixAt nằm trong [0,1], bằng 0 ngoài đoạn morph, và khép lại', () => {
  for (let t = 0; t <= DURATION_S; t += STEP) {
    const mix = morphMixAt(t);
    assert.ok(mix >= 0 && mix <= 1, `mix ${mix} ngoài [0,1] tại giây ${t}`);
    if (t <= MORPH_FROM || t >= MORPH_TO) {
      assert.equal(mix, 0, `mix phải bằng 0 ngoài đoạn morph, tại giây ${t}`);
    }
  }
  // Đoạn morph phải thật sự đi hết sang trạng thái kia rồi quay về, nếu
  // không thì "morph giữa hai trạng thái" (WP-003 mục 3b) chỉ có trên giấy.
  const middle = morphMixAt((MORPH_FROM + MORPH_TO) / 2);
  assert.ok(middle > 0.99, `giữa đoạn morph mix mới đạt ${middle}, chưa sang hẳn trạng thái B`);
});

test('đoạn morph nằm trọn trong 3 phút và sau đoạn zoom', () => {
  assert.ok(MORPH_FROM > 0 && MORPH_TO <= DURATION_S);
  assert.ok(MORPH_FROM < MORPH_TO);
});
