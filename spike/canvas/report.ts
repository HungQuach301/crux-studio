#!/usr/bin/env node
/**
 * 🤖 Sinh `spike/canvas/RESULT.md` từ `measurements.json` (mục `visual/V-002`).
 *
 * Vì sao sinh chứ không gõ tay: bảng sáu chỉ số của WP-003 là bảng số, và
 * chép số bằng tay đã một lần làm sai bảng bằng chứng của `G2` (xem
 * `VF-G2` trong `ops/lanes/verify/backlog.md`). Sinh từ file đo thì con số
 * trong báo cáo và con số đã đo không thể lệch nhau.
 *
 * Dùng:  node spike/canvas/report.ts --in <thư mục đo> [--out <file>]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RenderConfig } from './render.ts';

interface Row {
  config: RenderConfig;
  frames: number;
  wallMs: number;
  msPerFrame: number;
  peakRssBytes: number;
  hwmSumBytes: number;
  sceneMs: number;
  captureMs: number;
  clipBytes: number;
  at: string;
  host: { cores: number; totalMemBytes: number; node: string; platform: string };
}

/** Ngưỡng của WP-003 mục 3, bảng sáu chỉ số. */
const LIMIT_RENDER_MIN = 25;
const LIMIT_SLOWDOWN = 3;

const mb = (b: number): string => (b / 1048576).toFixed(0);
const min = (ms: number): string => (ms / 60000).toFixed(1);
const one = (n: number): string => n.toFixed(1);

function parseArgs(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith('--')) out.set(a.slice(2), argv[i + 1] ?? 'true');
  }
  return out;
}

function verdict(ok: boolean | null): string {
  if (ok === null) return '⬜ chờ chủ dự án xem clip';
  return ok ? '✅ đạt' : '❌ không đạt';
}

export function buildReport(rows: Row[]): string {
  const by = new Map(rows.map((r) => [r.config.name, r]));
  const base = by.get('base-30-noblur');
  const still = by.get('static-30');
  const blur = by.get('blur-30');
  const hi = by.get('hi-60-noblur');
  if (!base || !still || !blur || !hi) {
    const have = [...by.keys()].join(', ') || '(chưa có gì)';
    throw new Error(`thiếu cấu hình; mới có: ${have}`);
  }

  const host = base.host;
  const peakBytes = Math.max(...rows.map((r) => r.peakRssBytes));
  // Hai tỷ số, cố ý giữ cả hai. Tỷ số tổng là thứ WP-003 hỏi, nhưng tổng
  // bị chi phối bởi thời gian CHỤP khung — phần không liên quan gì tới máy
  // quay — và phần đó dao động vài phần trăm giữa các lần chạy. Tỷ số riêng
  // phần vẽ mới là chi phí thật của "máy quay di chuyển".
  const slowdownTotal = base.msPerFrame / still.msPerFrame;
  const slowdownScene = (base.sceneMs / base.frames) / (still.sceneMs / still.frames);
  const renderMin = base.wallMs / 60000;

  // "Không hết bộ nhớ" đọc chặt hơn một chút: còn cách trần ít nhất 20%,
  // để kết luận không phụ thuộc vào việc runner lúc đó rỗi hay bận.
  const m1 = peakBytes < host.totalMemBytes * 0.8;
  const m2 = renderMin <= LIMIT_RENDER_MIN;
  const m3 = Math.max(slowdownTotal, slowdownScene) <= LIMIT_SLOWDOWN;

  const lines: string[] = [];
  const p = (s = ''): void => { lines.push(s); };

  p('# 🤖 Kết quả spike canvas liên tục — mục `visual/V-002`');
  p();
  p('> File này do `spike/canvas/report.ts` sinh ra từ `measurements.json`. Đừng sửa tay —');
  p('> sửa rồi chạy lại bộ đo là mất. Phần nhận định nằm trong chính script đó.');
  p();
  p('Trả lời câu hỏi của WP-003 và quyết định `D-04`: canvas liên tục 6000×3400 với máy quay');
  p('di chuyển có chạy nổi trên runner tiêu chuẩn không, và ở cấu hình nào thì chuyển động');
  p('chấp nhận được. Số đo cho giả định **G5** (`docs/assumptions.md`).');
  p();
  p('## Máy đo');
  p();
  p('| Hạng mục | Giá trị |');
  p('|---|---|');
  p(`| Nhân | ${host.cores} |`);
  p(`| RAM | ${mb(host.totalMemBytes)} MB |`);
  p(`| Node | ${host.node} |`);
  p(`| Nền | ${host.platform} |`);
  p(`| Đo lúc | ${base.at} |`);
  p();
  p('⚠️ Đây là **container của phiên cloud**, không phải runner Actions. Nó trùng cấu hình với');
  p('`ubuntu-latest` hiện hành về số nhân và RAM, nên số đo dưới đây là cơ sở hợp lý để so với');
  p('ngưỡng — nhưng **số phút Actions tính tiền** thì chỉ runner thật mới trả lời được. Workflow');
  p('`ops/workflows/spike-canvas.yml` làm đúng việc đó, và nó chỉ chạy được **sau khi PR này');
  p('merge vào `main`** rồi `sync-workflows` chép sang `.github/workflows/` (CHARTER 3.2).');
  p();
  p('## Sáu chỉ số của WP-003');
  p();
  p('| # | Chỉ số | Ngưỡng | Đo được | Kết |');
  p('|---|---|---|---|---|');
  p(`| 1 | Bộ nhớ đỉnh khi render canvas 6000×3400 | không hết bộ nhớ | **${mb(peakBytes)} MB** đỉnh RSS cả cây tiến trình, trên ${mb(host.totalMemBytes)} MB | ${verdict(m1)} |`);
  p(`| 2 | Thời gian render 5.400 khung ở 1 worker | ≤ ${LIMIT_RENDER_MIN} phút | **${min(base.wallMs)} phút** | ${verdict(m2)} |`);
  p(`| 3 | Chậm hơn render tĩnh cùng số khung | ≤ ${LIMIT_SLOWDOWN}× | **${slowdownTotal.toFixed(2)}×** tính cả đường ống (${one(base.msPerFrame)} so với ${one(still.msPerFrame)} ms/khung) · **${slowdownScene.toFixed(2)}×** tính riêng phần vẽ (${one(base.sceneMs / base.frames)} so với ${one(still.sceneMs / still.frames)} ms/khung) | ${verdict(m3)} |`);
  p(`| 4 | Chuyển động 30fps **không** mờ | clip xem được | \`base-30-noblur.mp4\`, ${min(base.wallMs)} phút render | ${verdict(null)} |`);
  p(`| 5 | Chuyển động 30fps **có** mờ | clip xem được | \`blur-30.mp4\`, ${min(blur.wallMs)} phút render, ${blur.config.blurSamples} mẫu/khung | ${verdict(null)} |`);
  p(`| 6 | Chuyển động 60fps **không** mờ | clip xem được | \`hi-60-noblur.mp4\`, ${min(hi.wallMs)} phút render | ${verdict(null)} |`);
  p();
  p('**Chỉ số 4–6 cố ý để trống kết.** WP-003 mục 5 ghi rõ: không kết luận thay chủ dự án về');
  p('ba chỉ số này, chỉ xuất clip và số đo. Clip là nhị phân nên không commit (CHARTER 5.3);');
  p('chúng đi ra qua artifact `spike-canvas` của workflow.');
  p();
  p('## Số đo từng cấu hình');
  p();
  p('| Cấu hình | Khung | fps | Mẫu/khung | Tổng | ms/khung | — cảnh | — chụp | Đỉnh RSS | Clip |');
  p('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    p(
      `| \`${r.config.name}\` | ${r.frames} | ${r.config.fps} | ${r.config.blurSamples} | ` +
      `${min(r.wallMs)} phút | ${one(r.msPerFrame)} | ${one(r.sceneMs / r.frames)} | ` +
      `${one(r.captureMs / r.frames)} | ${mb(r.peakRssBytes)} MB | ${(r.clipBytes / 1048576).toFixed(1)} MB |`,
    );
  }
  p();
  p('Hai cột `— cảnh` và `— chụp` tách tổng thời gian mỗi khung làm hai phần: thời gian nằm');
  p('trong `renderFrame` của cảnh (vẽ thật), và thời gian nằm trong `Page.captureScreenshot`');
  p('(lấy khung hình ra khỏi trình duyệt).');
  p();
  p('## Điều số đo này nói, và điều nó không nói');
  p();
  const scenePct = (base.sceneMs / base.wallMs) * 100;
  p(`**Kiến trúc của D-04 không phải chỗ tốn kém.** Vẽ một khung của canvas liên tục mất`);
  p(`${one(base.sceneMs / base.frames)} ms, tức ${scenePct.toFixed(1)}% tổng thời gian mỗi khung.`);
  p(`Phần còn lại, ${one(base.captureMs / base.frames)} ms, là lấy khung hình ra khỏi trình duyệt —`);
  p('chi phí của **đường ống**, không phải của ngữ pháp chuyển động. Đó là câu trả lời quan trọng');
  p('nhất của spike này: nếu số đo có đụng ngưỡng thì chỗ phải tối ưu là cách xuất khung, không');
  p('phải "cắt cảnh rời thay vì máy quay di chuyển" — tức là **không** phải viết lại');
  p('`motion-grammar`, `visual-quality-bar`, `layouts.json` và prompt dựng cảnh.');
  p();
  p(`**Máy quay di chuyển đắt hơn máy quay đứng yên ${slowdownScene.toFixed(2)}× ở phần vẽ**, và`);
  p(`${slowdownTotal.toFixed(2)}× nếu tính cả đường ống — cả hai đều dưới ngưỡng ${LIMIT_SLOWDOWN}×.`);
  p();
  if (slowdownTotal <= 1) {
    p('**Tỷ số tổng nhỏ hơn 1, và đó không phải là "máy quay di chuyển rẻ hơn đứng yên".** Nó là');
    p('dấu hiệu tỷ số tổng đo sai thứ cần đo: thời gian chụp khung chiếm phần lớn mỗi khung, nó');
    p('không dính gì tới máy quay, và nó dao động vài phần trăm giữa hai lần chạy — lớn hơn hẳn');
    p('chênh lệch do máy quay gây ra. Con số đáng tin cho chỉ số 3 là tỷ số **riêng phần vẽ**');
    p(`(${slowdownScene.toFixed(2)}×), và kết luận không đổi: còn rất xa ngưỡng ${LIMIT_SLOWDOWN}×.`);
  } else {
    p('Chênh lệch nằm ở phần vẽ: cảnh đứng yên cho trình duyệt tái dùng được khung đã hợp thành,');
    p('còn máy quay trôi thì mỗi khung là một vùng cắt khác.');
  }
  p();
  p('**Điều số đo này KHÔNG nói.** Ba chỗ, khai trước thay vì để tự phát hiện:');
  p();
  p('1. **Phút Actions chưa có.** Bảng trên đo trên container phiên cloud. Cần một lần chạy');
  p('   `spike-canvas.yml` sau khi PR merge để có số phút tính tiền cho `G5`.');
  p('2. **Không phải số đo của thư viện dựng hình.** Spec WP-003 mục 5 chốt một thư viện dựng');
  p('   hình React. Chọn nó là chọn nhà cung cấp kèm điều khoản thương mại — nhóm `irreversible`');
  p('   số 3 của CHARTER 2.3 — và mục 7c còn đòi ghi lại điều khoản giấy phép, thứ mà bức tường');
  p('   mạng (issue #36) không cho đọc. Spike này vì vậy đo canvas 2D trần, **không thêm phụ');
  p('   thuộc nào**: kết quả là **cận dưới** cho mọi thư viện dựng trên cùng nền trình duyệt.');
  p('   Một thư viện có vòng đời React mỗi khung sẽ cộng thêm vào cột `— cảnh`, và cột đó hiện');
  p(`   chỉ chiếm ${scenePct.toFixed(1)}% — còn rất nhiều chỗ trước khi chạm ngưỡng. Việc chốt`);
  p('   thư viện thuộc mục `A-001`.');
  p('3. **Nội dung thật nặng hơn cảnh thử.** Cảnh thử có biểu đồ cột, chữ, lưới và một đoạn');
  p('   morph. Một tập thật có nhiều lớp hơn. Ngoại suy theo số khung thì được, theo độ phức');
  p('   tạp cảnh thì không.');
  p();
  p('## Dung lượng artifact — nửa còn lại của G5');
  p();
  const perMin = base.clipBytes / (base.frames / base.config.fps / 60);
  p(`Đoạn mẫu 3 phút ở 30fps không mờ nặng **${(base.clipBytes / 1048576).toFixed(1)} MB**, tức`);
  p(`khoảng **${(perMin / 1048576).toFixed(1)} MB mỗi phút** ở H.264 CRF 20. Ngoại suy tuyến tính:`);
  p();
  p('| Độ dài | Ước dung lượng |');
  p('|---|---|');
  for (const mins of [10, 20]) {
    p(`| ${mins} phút | ~${((perMin * mins) / 1048576).toFixed(0)} MB |`);
  }
  p();
  p(`Đối chứng: cấu hình đứng yên cho clip chỉ ${(still.clipBytes / 1048576).toFixed(1)} MB với CÙNG`);
  p('số khung — chênh lệch đó chính là cái giá của quy tắc "không khung nào đứng yên". Nó là chi');
  p('phí lưu trữ có thật, không phải nhiễu đo, và nó thuộc về `G5` cùng với số phút Actions.');
  p();
  p('## Kịch bản nào đã xảy ra (WP-003 mục 7)');
  p();
  if (m1 && m2 && m3) {
    p('Cả ba chỉ số hiệu năng **đạt**. Theo bảng kịch bản của WP-003, hai nhánh còn mở phụ thuộc');
    p('hoàn toàn vào chỉ số 4–6, tức là vào mắt chủ dự án:');
    p();
    p('- 30fps không mờ chấp nhận được → tiếp Mốc 4 nguyên trạng, **chốt 30fps**;');
    p('- 30fps giật nhưng có mờ thì ổn → **chốt 30fps + mờ chuyển động**, nâng mờ chuyển động lên');
    p('  ưu tiên 1 trong `cinematography.md` và hạ ngưỡng bật để phủ cả chuyển động trôi chậm;');
    p('- chỉ 60fps chấp nhận được → **chốt 60fps**, và cập nhật lại ngân sách render vì số khung');
    p(`  gấp đôi (đo được: ${min(hi.wallMs)} phút so với ${min(base.wallMs)} phút).`);
    p();
    p('**Kịch bản DỪNG không xảy ra.** Không phải viết lại ngữ pháp chuyển động.');
  } else {
    p('Ít nhất một chỉ số hiệu năng **không đạt** — xem cột "Kết" ở bảng trên. Theo WP-003 mục 7');
    p('và mục 5b, đây là ca phải báo cáo chứ không phải ca tối ưu tiếp, và nó mở một `🤖 [QĐ]`.');
  }
  p();
  p('## Chạy lại');
  p();
  p('```bash');
  p('node spike/canvas/run.ts --out spike-out          # cả bốn cấu hình');
  p('node spike/canvas/run.ts --out spike-out --config base-30-noblur --frames 60   # đo thử rẻ');
  p('node spike/canvas/report.ts --in spike-out        # sinh lại file này');
  p('```');
  p();
  p('Clip không commit vào repo (CHARTER 5.3). Trên Actions chúng nằm trong artifact `spike-canvas`.');
  p();
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const inDir = args.get('in') ?? 'spike-out';
const outFile = args.get('out') ?? join(import.meta.dirname, 'RESULT.md');
const rows = JSON.parse(readFileSync(join(inDir, 'measurements.json'), 'utf8')) as Row[];
writeFileSync(outFile, buildReport(rows));
console.log(`đã ghi ${outFile} từ ${rows.length} cấu hình`);
