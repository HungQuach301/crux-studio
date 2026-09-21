#!/usr/bin/env node
/**
 * Thử nghiệm engine dựng — cơ chế của mục `assembly/A-001`
 * (`ops/lanes/assembly/backlog.md`), số đo cho giả định **G5**
 * (`docs/assumptions.md`).
 *
 * Câu hỏi phải trả lời bằng số, không bằng sở thích: **30fps hay 60fps**, và
 * một tập đầy đủ tốn bao nhiêu thời gian dựng, bao nhiêu dung lượng, bao
 * nhiêu phút Actions.
 *
 * ## Hai giai đoạn tách nhau, và vì sao
 *
 * Đường ống thật có hai phần tách bạch: xưởng `visual` **sinh khung**, xưởng
 * `assembly` **dựng** — đọc khung, mã hoá, đóng gói. Mục `visual/V-002` đo
 * phần sinh khung. Mục này đo phần dựng, nên bộ đo cũng tách làm hai:
 *
 * 1. **Sinh nguồn** (`--source`): dựng một clip mẫu 20 giây ở 60fps bằng bộ
 *    lọc ffmpeg. Chạy MỘT lần, và thời gian của nó **không** tính vào số đo —
 *    nó đứng thay cho phần việc của xưởng `visual`.
 * 2. **Dựng** (`--measure`): lặp clip nguồn cho đủ thời lượng một tập rồi mã
 *    hoá. Đây là thứ được đo.
 *
 * Trộn hai phần vào một phép đo là cách dễ nhất để ra một con số vô nghĩa:
 * đồ thị lọc ở giai đoạn 1 đắt hơn hẳn bộ mã hoá, nên số đo sẽ nói về chi phí
 * vẽ cảnh chứ không nói về chi phí dựng. Đã đo thật: giai đoạn 1 chạy ~20
 * khung/giây, giai đoạn 2 chạy ~63 khung/giây trên cùng máy.
 *
 * ## 30fps lấy mẫu thưa, KHÔNG nhân đôi khung
 *
 * Clip nguồn ở **60fps**. Cấu hình 30fps lấy `-r 30` trên chính nguồn đó, tức
 * là bỏ bớt khung — đúng thứ mà một tập 30fps thật sẽ có. Nếu làm ngược lại
 * (nguồn 30fps, nhân đôi lên 60fps) thì cấu hình 60fps rẻ giả tạo: khung lặp
 * nén gần như bằng không, và kết luận sẽ nghiêng về 60fps vì một lý do không
 * tồn tại ngoài đời.
 *
 * ## Chi phí giải mã được đo riêng rồi trừ ra
 *
 * Lặp clip nguồn nghĩa là mỗi lượt dựng phải giải mã lại nó. Cấu hình
 * `decode-*` chạy đúng đường ống đó với `-f null -` (không mã hoá), nên phần
 * giải mã tách được ra khỏi phần mã hoá thay vì nằm lẫn trong tổng.
 *
 * ## Điều bộ đo này KHÔNG trả lời
 *
 * **Phút Actions tính tiền** chỉ runner thật mới trả lời được. Container của
 * phiên cloud trùng cấu hình `ubuntu-latest` về số nhân và RAM, nên số giây
 * tường ở đây là cơ sở hợp lý — nhưng con số hoá đơn thì do
 * `ops/workflows/render-trial.yml` lấy, và workflow đó chỉ chạy được **sau
 * khi** PR của mục này merge vào `main` rồi `sync-workflows` chép sang
 * `.github/workflows/` (CHARTER 3.2, giả định **G10**).
 *
 * **Nội dung mẫu là proxy, không phải khung thật.** Xưởng `visual` còn ở
 * `impl: stub`, nên chưa có khung thật để dựng. Clip nguồn mô phỏng đúng hình
 * dạng đắt nhất của thể loại `data-explainer` — nền chuyển sắc, lưới mảnh,
 * biểu đồ cột đổi liên tục, chữ cạnh sắc, máy quay trôi chậm không khung nào
 * đứng yên — nhưng bitrate thật của tập thật sẽ khác. Vì vậy mọi số dưới đây
 * đi kèm **tốc độ** (khung/giây, MB/phút) chứ không chỉ tổng: khi xưởng
 * `visual` lên `v1`, chạy lại bộ đo này với khung thật là ra số mới, không
 * phải viết lại gì.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cpus, totalmem } from 'node:os';
import { loadGenrePack } from '@crux/kernel';

// ── Phần thuần ───────────────────────────────────────────────────────────

/** Thể loại và kênh tham chiếu đầu tiên (CHARTER 1.1). */
export const GENRE = 'data-explainer';

/** Khung làm việc lớn hơn khung ra, để máy quay còn chỗ trôi (D-04). */
export const CANVAS = { width: 2560, height: 1440 } as const;

/** Clip nguồn: 20 giây ở 60fps = 1.200 khung. Đủ dài để một chu kỳ GOP không
 *  nhìn thấy mối nối, đủ ngắn để sinh xong trong khoảng một phút. */
export const SOURCE_SECONDS = 20;
export const SOURCE_FPS = 60;

export interface TrialConfig {
  id: string;
  /** `master` là bản giao; `proof` là bản xem thử rẻ tiền; `decode` là nền để trừ ra. */
  kind: 'master' | 'proof' | 'decode';
  fps: number;
  width: number;
  height: number;
  /** `null` ở `kind: 'decode'` — lượt đó không mã hoá. */
  crf: number | null;
  preset: string | null;
}

/**
 * Bốn cấu hình đo cộng hai cấu hình nền.
 *
 * `proof` dùng nửa độ phân giải và `crf` cao: bản xem thử chỉ để người soát
 * xem nhịp và bố cục, không phải bản giao. Tách nó ra vì ngân sách phút
 * Actions của Đợt 3 sẽ chi cho **nhiều** bản proof và **một** bản master mỗi
 * tập, nên trộn hai thứ thành một con số là tính sai ngân sách.
 */
export const CONFIGS: readonly TrialConfig[] = [
  { id: 'decode-30', kind: 'decode', fps: 30, width: 1920, height: 1080, crf: null, preset: null },
  { id: 'decode-60', kind: 'decode', fps: 60, width: 1920, height: 1080, crf: null, preset: null },
  { id: 'master-30', kind: 'master', fps: 30, width: 1920, height: 1080, crf: 18, preset: 'medium' },
  { id: 'master-60', kind: 'master', fps: 60, width: 1920, height: 1080, crf: 18, preset: 'medium' },
  { id: 'proof-30', kind: 'proof', fps: 30, width: 960, height: 540, crf: 28, preset: 'veryfast' },
  { id: 'proof-60', kind: 'proof', fps: 60, width: 960, height: 540, crf: 28, preset: 'veryfast' },
];

export function configById(id: string): TrialConfig {
  const found = CONFIGS.find((c) => c.id === id);
  if (found === undefined) {
    throw new Error(`Không có cấu hình "${id}". Có: ${CONFIGS.map((c) => c.id).join(', ')}.`);
  }
  return found;
}

/** Số khung của một tập ở một tần số khung. Làm tròn lên: khung cuối vẫn phải dựng. */
export function frameCount(durationMs: number, fps: number): number {
  if (durationMs <= 0 || fps <= 0) throw new Error('durationMs và fps phải dương.');
  return Math.ceil((durationMs / 1000) * fps);
}

/**
 * Số lần lặp clip nguồn để phủ hết thời lượng.
 *
 * `-stream_loop N` phát clip **N+1** lần, nên trả về đúng giá trị truyền cho
 * cờ đó, không phải số lần phát. Đây là chỗ lệch một đơn vị dễ nhất trong cả
 * file: thiếu một lần lặp thì ffmpeg dừng sớm và lượt đo ra một tập ngắn hơn
 * tập thật mà không có gì báo.
 */
export function streamLoopFlag(durationMs: number, sourceSeconds: number): number {
  if (sourceSeconds <= 0) throw new Error('sourceSeconds phải dương.');
  return Math.max(0, Math.ceil(durationMs / 1000 / sourceSeconds) - 1);
}

/**
 * Đồ thị lọc sinh cảnh mẫu.
 *
 * Bốn thứ ở đây đều có lý do, và bỏ thứ nào cũng làm số đo lệch về phía rẻ:
 * - **nền chuyển sắc động** — vùng màu phẳng nén gần như bằng không;
 * - **lưới mảnh 1px** — cạnh sắc là chỗ bộ mã hoá tốn bit nhất;
 * - **cột đổi chiều cao liên tục** — có chuyển động thật, không phải ảnh tĩnh;
 * - **máy quay trôi chậm** (`crop` theo `t`) — không khung nào đứng yên, đúng
 *   quy tắc của `D-04`, và đó là thứ xoá sạch macroblock `skip`.
 *
 * Đã đo thật: bỏ nền chuyển sắc và lưới thì bitrate rơi từ ~1,7 Mbit/s xuống
 * ~0,12 Mbit/s trên cùng cảnh — sai một bậc độ lớn.
 */
export function sceneFilter(fps: number, width: number, height: number): string {
  const bars = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9].map((phase, i) => {
    const x = 200 + i * 220;
    const color = ['0x4c9aff', '0x4c9aff', '0x66d9a8', '0x66d9a8', '0xffd166', '0xffd166', '0xef6461', '0xef6461'][i];
    const h = `380*abs(sin(t/7+${phase}))`;
    return `drawbox=x=${x}:y='1100-${h}':w=180:h='${h}':color=${color}:t=fill`;
  });
  const font = (name: string) => `/usr/share/fonts/truetype/dejavu/${name}.ttf`;
  return [
    `gradients=s=${CANVAS.width}x${CANVAS.height}:r=${fps}:c0=0x0d1117:c1=0x1b2a3a:c2=0x101826:n=3:speed=0.012:x0=300:y0=200:x1=2300:y1=1300`,
    `drawgrid=w=80:h=80:t=1:color=0xffffff@0.05`,
    ...bars,
    `drawbox=x=180:y=1100:w=2000:h=4:color=0x8b949e:t=fill`,
    `drawtext=fontfile=${font('DejaVuSans-Bold')}:text='Break-even months':fontsize=84:fontcolor=0xe6edf3:x=200:y=200`,
    `drawtext=fontfile=${font('DejaVuSans')}:text='Household savings rate vs. payoff horizon':fontsize=44:fontcolor=0x8b949e:x=200:y=310`,
    `drawtext=fontfile=${font('DejaVuSansMono-Bold')}:text='%{eif\\:36+28*sin(t/5)\\:d\\:2} mo':fontsize=180:fontcolor=0xffd166:x=1700:y=260`,
    `drawtext=fontfile=${font('DejaVuSansMono')}:text='3.2  3.9  4.8  5.4  6.1  6.8  7.5  8.2':fontsize=34:fontcolor=0x8b949e:x=200:y=1130`,
    `drawtext=fontfile=${font('DejaVuSans')}:text='tier 2 of 3 - flip point at 4.8 - US, 2026':fontsize=38:fontcolor=0x8b949e:x=200:y=1200`,
    `crop=${width}:${height}:x='(iw-ow)/2+((iw-ow)/2)*sin(t/11)':y='(ih-oh)/2+((ih-oh)/2)*sin(t/17)'`,
  ].join(',');
}

/** Tham số ffmpeg cho giai đoạn 1 — sinh clip nguồn. Không nằm trong phép đo. */
export function sourceArgs(out: string): string[] {
  return [
    '-nostdin', '-y',
    '-f', 'lavfi', '-i', sceneFilter(SOURCE_FPS, 1920, 1080),
    '-t', String(SOURCE_SECONDS),
    // `crf 12` để clip nguồn gần như không mất chi tiết: mọi lượt dựng đều
    // giải mã từ đây, nên thứ gì mất ở bước này sẽ làm MỌI cấu hình rẻ đi.
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', '-an',
    out,
  ];
}

/** Tham số ffmpeg cho giai đoạn 2 — lượt được đo. */
export function encodeArgs(
  config: TrialConfig,
  source: string,
  durationMs: number,
  out: string,
): string[] {
  const args = [
    '-nostdin', '-y',
    '-stream_loop', String(streamLoopFlag(durationMs, SOURCE_SECONDS)),
    '-i', source,
    '-t', (durationMs / 1000).toFixed(3),
    '-r', String(config.fps),
  ];
  if (config.width !== 1920 || config.height !== 1080) {
    args.push('-vf', `scale=${config.width}:${config.height}:flags=lanczos`);
  }
  if (config.kind === 'decode') {
    args.push('-f', 'null', '-');
    return args;
  }
  args.push(
    '-c:v', 'libx264',
    '-preset', String(config.preset),
    '-crf', String(config.crf),
    '-pix_fmt', 'yuv420p', '-an',
    '-movflags', '+faststart',
    out,
  );
  return args;
}

/**
 * Phút Actions tính tiền cho một quãng giây tường.
 *
 * Actions làm tròn **lên** theo từng phút, cho từng job. `ubuntu-latest` có
 * hệ số 1×, nên một phút chạy là một phút hoá đơn. Làm tròn xuống ở đây là
 * cách tính ra một ngân sách nhỏ hơn thật mà không có gì đỏ.
 */
export function actionsMinutes(seconds: number): number {
  if (seconds < 0) throw new Error('seconds không âm.');
  return Math.ceil(seconds / 60);
}

export interface Measurement {
  config: string;
  kind: TrialConfig['kind'];
  fps: number;
  resolution: string;
  frames: number;
  durationMs: number;
  wallSeconds: number;
  peakRssMb: number;
  bytes: number;
  /** Khung dựng được mỗi giây tường. */
  framesPerSecond: number;
  /** Nhanh hay chậm hơn thời gian thực. >1 nghĩa là dựng nhanh hơn xem. */
  realtimeFactor: number;
}

/**
 * Chi phí mã hoá thuần, sau khi trừ nền giải mã của cùng tần số khung.
 *
 * Trả `null` khi thiếu lượt nền: đoán bằng 0 sẽ gán toàn bộ chi phí giải mã
 * cho bộ mã hoá và làm mọi kết luận sau đó lệch về phía đắt.
 */
export function encodeOnlySeconds(
  measurements: readonly Measurement[],
  configId: string,
): number | null {
  const row = measurements.find((m) => m.config === configId);
  if (row === undefined) return null;
  const base = measurements.find((m) => m.kind === 'decode' && m.fps === row.fps);
  if (base === undefined) return null;
  return Math.max(0, row.wallSeconds - base.wallSeconds);
}

/** Quy một số đo về một tập đầy đủ, khi lượt đo chỉ chạy một phần thời lượng. */
export function scaleToEpisode(value: number, measuredMs: number, episodeMs: number): number {
  if (measuredMs <= 0) throw new Error('measuredMs phải dương.');
  return (value * episodeMs) / measuredMs;
}

/** Tỷ lệ giữa hai cấu hình — con số mà quyết định 30fps/60fps thật sự nằm trên. */
export function ratio(a: number, b: number): number {
  if (b === 0) throw new Error('Không chia cho 0.');
  return a / b;
}

export function mb(bytes: number): number {
  return bytes / (1024 * 1024);
}

// ── Phần chạy thật ───────────────────────────────────────────────────────

const FFMPEG_TIMEOUT_MS = 4 * 60 * 60 * 1000;

/** Đỉnh RSS lấy bằng cách lấy mẫu `/proc/<pid>/status`, 200ms một lần. */
function peakRss(pid: number, stop: { done: boolean }, out: { peakKb: number }): void {
  const tick = (): void => {
    if (stop.done) return;
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      const match = /^VmRSS:\s+(\d+) kB$/m.exec(status);
      if (match?.[1] !== undefined) out.peakKb = Math.max(out.peakKb, Number(match[1]));
    } catch {
      // Tiến trình đã thoát giữa hai lần lấy mẫu — không phải lỗi.
    }
    setTimeout(tick, 200).unref();
  };
  tick();
}

/**
 * Chạy một lượt ffmpeg và đo giây tường cộng đỉnh RSS.
 *
 * `spawnSync` không dùng được ở đây: nó chặn luồng nên không lấy mẫu RSS được
 * trong lúc tiến trình con còn sống — mà đỉnh RSS là một trong những con số
 * G5 hỏi. Vì vậy `spawn` cộng `await`, và các lượt đo chạy **tuần tự**: hai
 * lượt chồng nhau là hai số đo sai, vì chúng tranh nhau bốn nhân của runner.
 */
function runFfmpeg(args: readonly string[]): Promise<{ wallSeconds: number; peakRssMb: number }> {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const child = spawn('ffmpeg', [...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    const stop = { done: false };
    const rss = { peakKb: 0 };
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // ffmpeg in tiến độ ra stderr; chỉ giữ phần đuôi để báo lỗi cho tử tế.
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    if (child.pid !== undefined) peakRss(child.pid, stop, rss);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg quá hạn.'));
    }, FFMPEG_TIMEOUT_MS);
    timer.unref();

    child.on('error', (err) => {
      stop.done = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      stop.done = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffmpeg thoát mã ${code}. Đuôi stderr:\n${stderr}`));
        return;
      }
      resolve({
        wallSeconds: Number(process.hrtime.bigint() - started) / 1e9,
        peakRssMb: rss.peakKb / 1024,
      });
    });
  });
}

function ffmpegVersion(): string {
  const out = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return (out.stdout ?? '').split('\n')[0] ?? 'không đọc được';
}

async function measureOne(
  config: TrialConfig,
  source: string,
  durationMs: number,
  outDir: string,
): Promise<Measurement> {
  const out = join(outDir, `${config.id}.mp4`);
  const args = encodeArgs(config, source, durationMs, out);
  const { wallSeconds, peakRssMb } = await runFfmpeg(args);
  const bytes = config.kind === 'decode' ? 0 : statSync(out).size;
  const frames = frameCount(durationMs, config.fps);
  return {
    config: config.id,
    kind: config.kind,
    fps: config.fps,
    resolution: `${config.width}x${config.height}`,
    frames,
    durationMs,
    wallSeconds: Number(wallSeconds.toFixed(2)),
    peakRssMb: Number(peakRssMb.toFixed(1)),
    bytes,
    framesPerSecond: Number((frames / wallSeconds).toFixed(2)),
    realtimeFactor: Number((durationMs / 1000 / wallSeconds).toFixed(3)),
  };
}

export interface MeasurementFile {
  at: string;
  host: { cores: number; ramMb: number; node: string; platform: string; ffmpeg: string };
  episodeDurationMs: number;
  measuredDurationMs: number;
  source: { seconds: number; fps: number; bytes: number; wallSeconds: number };
  measurements: Measurement[];
}

function episodeDurationMs(root: string): number {
  const pack = loadGenrePack(root, GENRE);
  const value = (pack.limits as Record<string, unknown>)['targetDurationMs'];
  if (typeof value !== 'number' || value <= 0) {
    throw new Error(`packs/genres/${GENRE}/format-spec.json thiếu limits.targetDurationMs.`);
  }
  return value;
}

// ── Báo cáo ──────────────────────────────────────────────────────────────

function fixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

function minutes(seconds: number): string {
  return `${(seconds / 60).toFixed(1)} phút`;
}

function row(m: Measurement, file: MeasurementFile): string {
  const encodeOnly = encodeOnlySeconds(file.measurements, m.config);
  return [
    `\`${m.config}\``,
    m.resolution,
    `${m.fps}`,
    m.frames.toLocaleString('vi-VN'),
    minutes(m.wallSeconds),
    encodeOnly === null ? '—' : minutes(encodeOnly),
    `${m.framesPerSecond}`,
    `${fixed(m.realtimeFactor, 2)}×`,
    m.bytes === 0 ? '—' : `${fixed(mb(m.bytes), 0)} MB`,
    `${fixed(m.peakRssMb, 0)} MB`,
  ].join(' | ');
}

/**
 * Sinh `docs/assembly/render-trial.md` từ `measurements.json`.
 *
 * Hàm thuần, và đó là chủ ý: phần nhận định nằm trong code chứ không nằm
 * trong file Markdown, nên chạy lại bộ đo là báo cáo tự đúng theo số mới.
 * Sửa tay file Markdown thì lần chạy sau mất.
 */
export function renderReport(file: MeasurementFile): string {
  const byId = (id: string): Measurement | undefined => file.measurements.find((m) => m.config === id);
  const m30 = byId('master-30');
  const m60 = byId('master-60');
  const p30 = byId('proof-30');
  const p60 = byId('proof-60');
  const partial = file.measuredDurationMs !== file.episodeDurationMs;

  const lines: string[] = [
    '# 🤖 Thử nghiệm engine dựng — mục `assembly/A-001`',
    '',
    '> File này do `node ops/scripts/render-trial.ts --report` sinh ra từ',
    '> `measurements.json`. Đừng sửa tay — phần nhận định nằm trong chính script đó.',
    '',
    'Trả lời câu hỏi của `A-001`: **30fps hay 60fps**, và một tập đầy đủ tốn bao nhiêu',
    'thời gian dựng, dung lượng, phút Actions. Số đo cho giả định **G5**',
    '(`docs/assumptions.md`).',
    '',
    '## Máy đo',
    '',
    '| Hạng mục | Giá trị |',
    '|---|---|',
    `| Nhân | ${file.host.cores} |`,
    `| RAM | ${file.host.ramMb} MB |`,
    `| Node | ${file.host.node} |`,
    `| Nền | ${file.host.platform} |`,
    `| ffmpeg | ${file.host.ffmpeg} |`,
    `| Đo lúc | ${file.at} |`,
    `| Thời lượng tập (genre pack \`${GENRE}\`) | ${file.episodeDurationMs.toLocaleString('vi-VN')} ms = ${(file.episodeDurationMs / 60000).toFixed(0)} phút |`,
    `| Thời lượng đã dựng mỗi lượt | ${(file.measuredDurationMs / 60000).toFixed(1)} phút${partial ? ' ⚠️ **một phần**, không phải tập đầy đủ' : ' — **tập đầy đủ**'} |`,
    '',
    '⚠️ Đây là **container của phiên cloud**, không phải runner Actions. Nó trùng cấu hình',
    '`ubuntu-latest` hiện hành về số nhân và RAM, nên số giây tường dưới đây là cơ sở hợp lý —',
    'nhưng **phút Actions tính tiền** thì chỉ runner thật mới trả lời được.',
    '`ops/workflows/render-trial.yml` làm đúng việc đó, và nó chỉ chạy được **sau khi** PR này',
    'merge vào `main` rồi `sync-workflows` chép sang `.github/workflows/` (CHARTER 3.2, **G10**).',
    '',
    '## Số đo',
    '',
    '| Cấu hình | Độ phân giải | fps | Khung | Tường | Mã hoá thuần | Khung/s | So thời gian thực | Dung lượng | Đỉnh RSS |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...file.measurements.map((m) => `| ${row(m, file)} |`),
    '',
    'Cột **mã hoá thuần** là giây tường trừ đi lượt `decode-*` cùng tần số khung. Bộ đo lặp một',
    'clip nguồn 20 giây cho đủ thời lượng, nên mỗi lượt phải giải mã lại clip đó; cột này tách',
    'phần giải mã ra thay vì để nó nằm lẫn trong tổng.',
    '',
  ];

  if (m30 !== undefined && m60 !== undefined) {
    const timeRatio = ratio(m60.wallSeconds, m30.wallSeconds);
    const sizeRatio = ratio(m60.bytes, m30.bytes);
    const e30 = encodeOnlySeconds(file.measurements, 'master-30');
    const e60 = encodeOnlySeconds(file.measurements, 'master-60');
    const encodeRatio = e30 !== null && e60 !== null && e30 > 0 ? ratio(e60, e30) : null;
    lines.push(
      '## 60fps đắt hơn 30fps bao nhiêu — con số mà quyết định nằm trên',
      '',
      '| Phép so | 30fps | 60fps | Tỷ lệ |',
      '|---|---|---|---|',
      `| Giây tường | ${minutes(m30.wallSeconds)} | ${minutes(m60.wallSeconds)} | **${fixed(timeRatio, 2)}×** |`,
      ...(encodeRatio === null
        ? []
        : [`| Mã hoá thuần | ${minutes(e30 as number)} | ${minutes(e60 as number)} | **${fixed(encodeRatio, 2)}×** |`]),
      `| Dung lượng bản master | ${fixed(mb(m30.bytes), 0)} MB | ${fixed(mb(m60.bytes), 0)} MB | **${fixed(sizeRatio, 2)}×** |`,
      `| Số khung phải sinh (việc của xưởng \`visual\`) | ${m30.frames.toLocaleString('vi-VN')} | ${m60.frames.toLocaleString('vi-VN')} | **2,00×** |`,
      '',
      `**Gấp đôi số khung KHÔNG làm gấp đôi chi phí dựng: tỷ lệ đo được là ${fixed(timeRatio, 2)}×.**`,
      'Lý do nằm trong chính số đo: ở 30fps mỗi khung đắt hơn' +
        ` (${m30.framesPerSecond} khung/s so với ${m60.framesPerSecond} khung/s),` +
        ' vì bỏ bớt khung làm chuyển động giữa hai khung liền nhau lớn hơn, và bộ dự đoán',
      'chuyển động phải tìm xa hơn. Hai hiệu ứng ngược chiều nhau và triệt tiêu một phần.',
      '',
      '⚠️ **Tỷ lệ này chỉ nói về phần dựng.** Phần **sinh khung** — việc của xưởng `visual`,',
      'đo ở mục `V-002` — đúng là tuyến tính theo số khung, tức là **2,00×**. Tổng chi phí một',
      'tập là tổng hai phần, nên đừng lấy một mình tỷ lệ ở đây làm tỷ lệ của cả tập.',
      '',
    );
  }

  if (m30 !== undefined && m60 !== undefined && p30 !== undefined && p60 !== undefined) {
    const per = (master: Measurement, proof: Measurement): number =>
      scaleToEpisode(master.wallSeconds + proof.wallSeconds, file.measuredDurationMs, file.episodeDurationMs);
    const s30 = per(m30, p30);
    const s60 = per(m60, p60);
    lines.push(
      '## Ngân sách phút Actions cho phần dựng',
      '',
      'Một tập giao gồm **một** bản master cộng **một** bản proof. Actions làm tròn **lên**',
      'theo từng phút cho mỗi job, và `ubuntu-latest` có hệ số 1×.',
      '',
      '| | 30fps | 60fps |',
      '|---|---|---|',
      `| Giây tường, master + proof | ${fixed(s30, 0)} s | ${fixed(s60, 0)} s |`,
      `| Phút Actions mỗi tập | **${actionsMinutes(s30)}** | **${actionsMinutes(s60)}** |`,
      `| Phút Actions cho 4 tập mỗi tháng | ${actionsMinutes(s30) * 4} | ${actionsMinutes(s60) * 4} |`,
      `| Dung lượng master mỗi tập | ${fixed(scaleToEpisode(mb(m30.bytes), file.measuredDurationMs, file.episodeDurationMs), 0)} MB | ${fixed(scaleToEpisode(mb(m60.bytes), file.measuredDurationMs, file.episodeDurationMs), 0)} MB |`,
      '',
      'Chỉ là **phần dựng**. Phần sinh khung của xưởng `visual` (mục `V-002`) cộng thêm vào,',
      'và đó mới là phần lớn: số đo của `V-002` cho ~70 ms mỗi khung, tức là hàng giờ runner',
      'cho một tập đầy đủ. Ngân sách G5 phải cộng cả hai.',
      '',
    );
  }

  lines.push(
    '## Điều số đo này không nói',
    '',
    '- **Không phải khung thật.** Xưởng `visual` còn ở `impl: stub`, nên clip nguồn là một',
    '  cảnh mô phỏng: nền chuyển sắc động, lưới mảnh, biểu đồ cột đổi liên tục, chữ cạnh sắc,',
    '  máy quay trôi chậm không khung nào đứng yên. Nó dựng đúng **hình dạng đắt** của thể loại',
    '  `data-explainer`, nhưng bitrate của tập thật sẽ khác. Vì vậy báo cáo ghi cả **tốc độ**',
    '  (khung/s, MB) chứ không chỉ tổng: chạy lại bộ đo với khung thật là ra số mới.',
    '- **Clip nguồn được lặp.** Nội dung lặp lại mỗi 20 giây. Bộ mã hoá không tham chiếu xa',
    '  tới thế nên chi phí mỗi GOP vẫn đúng, nhưng một tập thật không lặp — con số dung lượng',
    '  là cận dưới lỏng, không phải cận trên.',
    '- **Không đo chất lượng nhìn được.** `A-001` hỏi chi phí; câu hỏi "30fps có giật không"',
    '  thuộc mục `visual/V-002` (chỉ số 4–6 của WP-003), và nó là việc của mắt người, không',
    '  phải của bộ đo.',
    '- **Chưa có phút Actions thật.** Xem cảnh báo ở đầu file.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

// ── CLI ──────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const outDir = arg('out') ?? 'render-trial-out';

  if (has('report')) {
    const src = arg('from') ?? join(outDir, 'measurements.json');
    const dst = arg('to') ?? join(root, 'docs', 'assembly', 'render-trial.md');
    const parsed = JSON.parse(readFileSync(src, 'utf8')) as MeasurementFile;
    writeFileSync(dst, renderReport(parsed));
    process.stdout.write(`Ghi ${dst} từ ${src}\n`);
    process.exit(0);
  }

  mkdirSync(outDir, { recursive: true });
  const episodeMs = episodeDurationMs(root);
  const measuredMs = arg('duration-ms') === undefined ? episodeMs : Number(arg('duration-ms'));
  if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
    process.stderr.write('--duration-ms phải là số dương.\n');
    process.exit(2);
  }

  const source = join(outDir, 'source.mp4');
  const only = arg('config');
  const wanted = only === undefined || only === 'all' ? CONFIGS : [configById(only)];

  let sourceWall = 0;
  if (!has('skip-source')) {
    process.stdout.write(`Giai đoạn 1 — sinh clip nguồn ${SOURCE_SECONDS}s @${SOURCE_FPS}fps…\n`);
    sourceWall = (await runFfmpeg(sourceArgs(source))).wallSeconds;
    process.stdout.write(`  xong sau ${sourceWall.toFixed(1)}s\n`);
  }

  const measurements: Measurement[] = [];
  for (const config of wanted) {
    process.stdout.write(
      `Giai đoạn 2 — ${config.id}: ${frameCount(measuredMs, config.fps)} khung @${config.fps}fps…\n`,
    );
    const row = await measureOne(config, source, measuredMs, outDir);
    measurements.push(row);
    process.stdout.write(
      `  ${row.wallSeconds}s · ${row.framesPerSecond} khung/s · ${mb(row.bytes).toFixed(1)} MB · đỉnh RSS ${row.peakRssMb} MB\n`,
    );
  }

  const file: MeasurementFile = {
    at: new Date().toISOString(),
    host: {
      cores: cpus().length,
      ramMb: Math.round(totalmem() / (1024 * 1024)),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      ffmpeg: ffmpegVersion(),
    },
    episodeDurationMs: episodeMs,
    measuredDurationMs: measuredMs,
    source: {
      seconds: SOURCE_SECONDS,
      fps: SOURCE_FPS,
      bytes: has('skip-source') ? 0 : statSync(source).size,
      wallSeconds: Number(sourceWall.toFixed(2)),
    },
    measurements,
  };
  const jsonPath = join(outDir, 'measurements.json');
  writeFileSync(jsonPath, `${JSON.stringify(file, null, 2)}\n`);
  process.stdout.write(`\nGhi ${jsonPath}\n`);
}
