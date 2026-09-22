// 🤖 Đường đi máy quay của spike canvas liên tục (mục `visual/V-002`, quyết định D-04).
//
// Tách khỏi `scene.html` để kiểm được bằng `node --test` mà không cần mở
// trình duyệt. Viết bằng JavaScript thuần, không phải TypeScript, vì
// `scene.html` nạp thẳng file này qua `<script type="module">` và trình
// duyệt không bóc kiểu.
//
// Vì sao phần này đáng có bài kiểm riêng: nếu khung nhìn trượt ra ngoài mép
// canvas lớn, khung hình sẽ có viền đen mà KHÔNG có gì đỏ — đúng nhóm lỗi Z
// trong `ops/known-failures.md`, hỏng mà mọi chỉ báo đều xanh. Ở một spike
// đo hiệu năng thì lỗi đó còn làm sai luôn số đo, vì blit một vùng nhỏ hơn
// thì rẻ hơn.

export const CANVAS_W = 6000;
export const CANVAS_H = 3400;
export const VIEW_W = 1920;
export const VIEW_H = 1080;
export const DURATION_S = 180;

/**
 * Bốn đoạn của WP-003 mục 3b. Mỗi mốc là một trạng thái máy quay
 * `{t, x, y, zoom}`; giữa hai mốc nội suy mượt.
 *
 * Không mốc nào để máy quay đứng yên hoàn toàn: quy tắc "không khung nào
 * đứng yên, máy quay trôi chậm liên tục" của D-04 chính là điều kiện sinh
 * ra nguy cơ giật hình mà chỉ số 4-6 đo.
 *
 * `zoom` nhỏ nhất bị chặn dưới bởi khung nhìn: `VIEW_W / zoom <= CANVAS_W`
 * và `VIEW_H / zoom <= CANVAS_H`, nghĩa là `zoom >= 0.32`. Bài kiểm khoá
 * điều đó, và khoá thêm một điều kiện nội dung: mọi mốc phải nhìn thấy chữ
 * hoặc cạnh sắc, vì chỉ số 4-6 chấm giật hình đúng trên hai thứ đó — một
 * cảnh chỉ có mảng màu trơn sẽ cho điểm đẹp mà không nói lên gì.
 *
 * @type {ReadonlyArray<{t: number, x: number, y: number, zoom: number}>}
 */
export const KEYS = [
  { t: 0, x: 2200, y: 1700, zoom: 0.44 },    // mở, nhìn rộng: tiêu đề + biểu đồ
  { t: 52, x: 3250, y: 1900, zoom: 0.52 },   // 1. trôi ngang chậm qua biểu đồ cột
  { t: 62, x: 4000, y: 1300, zoom: 0.50 },   // bắt sang con số lớn
  { t: 88, x: 4820, y: 760, zoom: 1.05 },    // 2. zoom vào một con số
  { t: 100, x: 4650, y: 1500, zoom: 0.75 },  // lùi ra, hướng về vùng morph
  { t: 108, x: 4820, y: 1950, zoom: 0.85 },  // vào vùng morph
  { t: 140, x: 4800, y: 1930, zoom: 0.82 },  // 3. morph, máy quay vẫn trôi
  { t: 162, x: 2600, y: 1800, zoom: 0.52 },  // 4. quay lại vùng đã xem
  { t: 180, x: 2200, y: 1750, zoom: 0.46 },  // về gần điểm mở
];

/** Đoạn morph: `mix` chạy 0 -> 1 -> 0 trong khoảng này. */
export const MORPH_FROM = 108;
export const MORPH_TO = 150;

/**
 * @param {number} p
 * @returns {number}
 */
export function smoothstep(p) {
  return p * p * (3 - 2 * p);
}

/**
 * Trạng thái máy quay tại giây `tSec`.
 * @param {number} tSec
 * @returns {{x: number, y: number, zoom: number}}
 */
export function cameraAt(tSec) {
  const t = Math.max(0, Math.min(DURATION_S, tSec));
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = b.t - a.t;
  const p = span <= 0 ? 0 : smoothstep((t - a.t) / span);
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    zoom: a.zoom + (b.zoom - a.zoom) * p,
  };
}

/**
 * Mức trộn giữa hai trạng thái dữ liệu tại giây `tSec`, trong [0, 1].
 * @param {number} tSec
 * @returns {number}
 */
export function morphMixAt(tSec) {
  if (tSec <= MORPH_FROM || tSec >= MORPH_TO) return 0;
  const p = (tSec - MORPH_FROM) / (MORPH_TO - MORPH_FROM);
  return smoothstep(p < 0.5 ? p * 2 : (1 - p) * 2);
}

/**
 * Vùng cắt CHƯA kẹp cho một trạng thái máy quay — tức đúng ý đồ khuôn hình
 * mà trạng thái đó mô tả.
 * @param {{x: number, y: number, zoom: number}} cam
 * @returns {{sx: number, sy: number, sw: number, sh: number}}
 */
export function rawViewportForCamera(cam) {
  const sw = VIEW_W / cam.zoom;
  const sh = VIEW_H / cam.zoom;
  return { sx: cam.x - sw / 2, sy: cam.y - sh / 2, sw, sh };
}

/**
 * Vùng cắt đã kẹp vào trong mép canvas, cho một trạng thái máy quay.
 * @param {{x: number, y: number, zoom: number}} cam
 * @returns {{sx: number, sy: number, sw: number, sh: number}}
 */
export function viewportForCamera(cam) {
  const { sx, sy, sw, sh } = rawViewportForCamera(cam);
  return {
    sx: Math.max(0, Math.min(CANVAS_W - sw, sx)),
    sy: Math.max(0, Math.min(CANVAS_H - sh, sy)),
    sw,
    sh,
  };
}

/**
 * Phép kẹp đã phải dịch khuôn hình đi bao nhiêu pixel.
 *
 * Kẹp là lưới an toàn, KHÔNG phải cách dựng khuôn hình: một đường đi máy
 * quay đúng thì hàm này luôn trả 0. Khác 0 nghĩa là khuôn hình đã trượt
 * khỏi ý đồ mà khung hình vẫn kín — hỏng mà không gì đỏ. Tệ hơn: vùng blit
 * khi đó nhỏ hơn thật, nên số đo hiệu năng đẹp giả.
 *
 * Cả bài kiểm dương lẫn bài kiểm âm đều đi qua đúng hàm này, nên bài âm
 * chứng minh được bài dương không rỗng.
 * @param {{x: number, y: number, zoom: number}} cam
 * @returns {number}
 */
export function clampDriftForCamera(cam) {
  const raw = rawViewportForCamera(cam);
  const clamped = viewportForCamera(cam);
  return Math.max(Math.abs(raw.sx - clamped.sx), Math.abs(raw.sy - clamped.sy));
}

/**
 * Vùng cắt CHƯA kẹp cho khung hình tại giây `tSec`.
 * @param {number} tSec
 * @returns {{sx: number, sy: number, sw: number, sh: number}}
 */
export function rawViewportFor(tSec) {
  return rawViewportForCamera(cameraAt(tSec));
}

/**
 * Vùng cắt đã kẹp cho khung hình tại giây `tSec`. Đây là thứ `scene.html` dùng.
 * @param {number} tSec
 * @returns {{sx: number, sy: number, sw: number, sh: number}}
 */
export function viewportFor(tSec) {
  return viewportForCamera(cameraAt(tSec));
}
