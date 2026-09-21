#!/usr/bin/env node
/**
 * 🤖 Chạy các cấu hình của spike canvas và ghi số đo (mục `visual/V-002`).
 *
 * Mỗi cấu hình ghi kết quả vào `measurements.json` NGAY khi xong, nên lần
 * chạy bị cắt ngang vẫn giữ được phần đã đo, và chạy lại chỉ làm phần còn
 * thiếu. Lượt chạy routine có thể dừng bất cứ lúc nào (CLAUDE.md mục 2).
 *
 * Dùng:
 *   node spike/canvas/run.ts --out <thư mục> [--config <tên>] [--frames <n>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureMeanLuma, renderOne, type RenderConfig, type RenderResult } from './render.ts';

/** 3 phút nội dung, theo WP-003 mục 3b. */
const DURATION_S = 180;

export const CONFIGS: RenderConfig[] = [
  // Chỉ số 2 và 4: 30fps, không mờ chuyển động, máy quay di chuyển.
  { name: 'base-30-noblur', fps: 30, blurSamples: 1, staticCamera: false, frames: 30 * DURATION_S },
  // Chỉ số 3: đối chứng tĩnh, CÙNG số khung, máy quay đứng yên.
  { name: 'static-30', fps: 30, blurSamples: 1, staticCamera: true, frames: 30 * DURATION_S },
  // Chỉ số 5: 30fps có mờ chuyển động, 4 mẫu phụ mỗi khung.
  { name: 'blur-30', fps: 30, blurSamples: 4, staticCamera: false, frames: 30 * DURATION_S },
  // Chỉ số 6: 60fps, không mờ chuyển động — số khung gấp đôi.
  { name: 'hi-60-noblur', fps: 60, blurSamples: 1, staticCamera: false, frames: 60 * DURATION_S },
];

interface Stored extends Omit<RenderResult, 'config'> {
  config: RenderConfig;
  at: string;
  host: { cores: number; totalMemBytes: number; node: string; platform: string };
}

function parseArgs(argv: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a?.startsWith('--')) out.set(a.slice(2), argv[i + 1] ?? 'true');
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.get('out') ?? join(process.cwd(), 'spike-out');
  mkdirSync(outDir, { recursive: true });
  const store = join(outDir, 'measurements.json');

  const only = args.get('config');
  const frameOverride = args.get('frames') ? Number(args.get('frames')) : undefined;

  const os = await import('node:os');
  const host = {
    cores: os.availableParallelism(),
    totalMemBytes: os.totalmem(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };

  const done: Stored[] = existsSync(store)
    ? (JSON.parse(readFileSync(store, 'utf8')) as Stored[])
    : [];

  for (const base of CONFIGS) {
    if (only && only !== base.name) continue;
    if (done.some((d) => d.config.name === base.name) && !frameOverride) {
      console.log(`[bỏ qua] ${base.name} — đã có số đo trong ${store}`);
      continue;
    }
    const cfg: RenderConfig = frameOverride ? { ...base, frames: frameOverride } : base;
    console.log(`[chạy] ${cfg.name} — ${cfg.frames} khung @ ${cfg.fps}fps, ${cfg.blurSamples} mẫu/khung`);
    const started = Date.now();
    const r = await renderOne(cfg, outDir);
    const row: Stored = { ...r, config: cfg, at: new Date(started).toISOString(), host };
    const idx = done.findIndex((d) => d.config.name === cfg.name);
    if (idx >= 0) done[idx] = row; else done.push(row);
    writeFileSync(store, JSON.stringify(done, null, 2) + '\n');
    console.log(
      `[xong] ${cfg.name} — ${(r.wallMs / 60000).toFixed(2)} phút · ` +
      `${r.msPerFrame.toFixed(1)} ms/khung (cảnh ${(r.sceneMs / r.frames).toFixed(1)}, ` +
      `chụp ${(r.captureMs / r.frames).toFixed(1)}) · đỉnh RSS ` +
      `${(r.peakRssBytes / 1048576).toFixed(0)} MB · clip ${(r.clipBytes / 1048576).toFixed(1)} MB`,
    );
  }

  // Bù `meanLuma` cho các dòng đo trước khi phép kiểm này tồn tại, miễn là
  // clip còn đó — rẻ hơn hẳn dựng lại, và không đụng vào số đo thời gian.
  let filled = 0;
  for (const row of done) {
    if (Number.isFinite(row.meanLuma)) continue;
    if (!existsSync(row.clipPath)) continue;
    row.meanLuma = measureMeanLuma(row.clipPath);
    filled += 1;
  }
  if (filled > 0) {
    writeFileSync(store, JSON.stringify(done, null, 2) + '\n');
    console.log(`[bù] đã đo độ sáng trung bình cho ${filled} cấu hình đo từ trước`);
  }

  console.log(`\nSố đo ở ${store}`);
}

await main();
