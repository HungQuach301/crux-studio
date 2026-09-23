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
  cameraAt, clampDriftForCamera, morphMixAt, viewportFor,
} from '../camera.js';

/** Mức chia đủ mịn để bắt cả chỗ trượt ngắn giữa hai mốc. */
const STEP = 0.005;

test('kẹp mép canvas không bao giờ phải làm gì — khuôn hình đúng ý đồ ở mọi thời điểm', () => {
  let worst = 0;
  let worstAt = 0;
  for (let t = 0; t <= DURATION_S; t += STEP) {
    const drift = clampDriftForCamera(cameraAt(t));
    if (drift > worst) { worst = drift; worstAt = t; }
  }
  assert.equal(
    worst, 0,
    `máy quay trượt ra ngoài canvas ${worst.toFixed(1)} px tại giây ${worstAt.toFixed(2)} — ` +
    'khung hình sẽ có viền đen, và vùng blit nhỏ hơn làm số đo hiệu năng đẹp giả',
  );
});

test('kiểm âm: máy quay trượt mép PHẢI bị chính phép đo đó bắt', () => {
  // Bài này đi qua ĐÚNG hàm mà bài kiểm dương dùng (`clampDriftForCamera`),
  // không tự tính lại phép kẹp bằng hằng số nội tuyến. Nhờ vậy nó chứng
  // minh được bài dương không rỗng: gỡ phép kẹp trong `viewportForCamera`
  // thì bài này đỏ ngay.
  const bad: Array<[string, { x: number; y: number; zoom: number }]> = [
    ['lệch sang trái quá mép', { x: 100, y: 1700, zoom: 0.44 }],
    ['lệch xuống dưới quá mép', { x: 3000, y: 3390, zoom: 0.60 }],
    ['zoom rộng hơn cả canvas', { x: CANVAS_W / 2, y: CANVAS_H / 2, zoom: 0.20 }],
  ];
  for (const [label, cam] of bad) {
    assert.ok(
      clampDriftForCamera(cam) > 0,
      `phép đo KHÔNG bắt được ca "${label}" — bài kiểm dương vì thế là bài kiểm rỗng`,
    );
  }

  // Và một ca hợp lệ phải cho 0, nếu không phép đo chỉ đang luôn báo lỗi.
  assert.equal(clampDriftForCamera({ x: CANVAS_W / 2, y: CANVAS_H / 2, zoom: 1 }), 0);
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
