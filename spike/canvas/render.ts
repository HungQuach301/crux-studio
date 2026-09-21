#!/usr/bin/env node
/**
 * 🤖 Bộ đo của spike canvas liên tục (mục `visual/V-002`, spec WP-003, quyết định D-04).
 *
 * Không thêm phụ thuộc npm nào. Trình duyệt được lái thẳng qua giao thức
 * DevTools bằng `WebSocket` có sẵn của Node 22, và khung hình được đẩy
 * vào `ffmpeg` qua ống. Vì sao không dùng thư viện dựng hình React như
 * spec WP-003 mục 5 nêu: chọn thư viện đó là CHỌN NHÀ CUNG CẤP kèm điều
 * khoản thương mại, tức nhóm `irreversible` số 3 của CHARTER 2.3 — và
 * `RESULT.md` mục 7c còn đòi ghi lại điều khoản giấy phép, mà bức tường
 * mạng (issue #36) không cho đọc trang giấy phép nào. Câu hỏi của spike
 * này là câu hỏi KIẾN TRÚC ("canvas lớn + máy quay di chuyển có chạy nổi
 * trên runner tiêu chuẩn không"), không phải câu hỏi thư viện; đo bằng
 * canvas 2D trần cho ra **cận dưới** đúng nghĩa cho mọi thư viện dựng
 * trên cùng nền trình duyệt. Việc chốt thư viện thuộc mục `A-001`.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { AddressInfo } from 'node:net';

export interface RenderConfig {
  /** Tên cấu hình, dùng cho tên file và cho bảng trong RESULT.md. */
  name: string;
  fps: 30 | 60;
  /** 1 = không mờ chuyển động. >1 = số mẫu phụ mỗi khung. */
  blurSamples: number;
  /**
   * Máy quay đứng yên — phép đối chứng của chỉ số 3. Mọi khung vẽ ở cùng
   * một thời điểm của cảnh, nên số khung và đường ra không đổi, chỉ có
   * chuyển động biến mất.
   */
  staticCamera: boolean;
  /** Số khung. Mặc định 3 phút nhân fps. */
  frames: number;
  /**
   * Bước thời gian mỗi khung, giây. Bỏ trống thì dùng `1 / fps` — tức là
   * dựng thời gian thật. Đặt giá trị lớn để lấy ảnh rời rạc rải đều cảnh
   * (bảng ảnh kiểm khuôn hình), thay vì dựng cả clip.
   */
  secondsPerFrame?: number;
}

export interface RenderResult {
  config: RenderConfig;
  frames: number;
  wallMs: number;
  msPerFrame: number;
  /** Đỉnh tổng RSS của cả cây tiến trình trình duyệt, byte. */
  peakRssBytes: number;
  /** Đỉnh RSS do chính nhân hệ điều hành ghi (VmHWM), cộng theo cây. */
  hwmSumBytes: number;
  /** Thời gian nằm trong `renderFrame` của cảnh, mili giây, cộng dồn. */
  sceneMs: number;
  /** Thời gian nằm trong `Page.captureScreenshot`, mili giây, cộng dồn. */
  captureMs: number;
  clipPath: string;
  clipBytes: number;
}

const CHROME_CANDIDATES = [
  process.env.CRUX_CHROME,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

export function findChrome(): string {
  for (const c of CHROME_CANDIDATES) {
    if (c && existsSync(c)) return c;
  }
  // Trình duyệt do Playwright cài, tên thư mục có số bản dựng thay đổi.
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(root)) {
    for (const dir of readdirSync(root)) {
      for (const leaf of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
        const p = join(root, dir, leaf);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('không tìm thấy Chromium — đặt biến CRUX_CHROME trỏ tới nhị phân');
}

/** Đọc RSS và VmHWM của một tiến trình, byte. Trả 0 nếu tiến trình đã chết. */
function procMem(pid: number): { rss: number; hwm: number } {
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const rss = /VmRSS:\s+(\d+) kB/.exec(status);
    const hwm = /VmHWM:\s+(\d+) kB/.exec(status);
    return {
      rss: rss?.[1] ? Number(rss[1]) * 1024 : 0,
      hwm: hwm?.[1] ? Number(hwm[1]) * 1024 : 0,
    };
  } catch {
    return { rss: 0, hwm: 0 };
  }
}

/** Mọi tiến trình con cháu của `root`, kể cả chính nó. */
function processTree(root: number): number[] {
  const kids = new Map<number, number[]>();
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      // Trường 4 là PPID, nhưng tên lệnh (trường 2) có thể chứa dấu cách.
      const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const ppid = Number(after[1]);
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid)!.push(Number(entry));
    } catch { /* tiến trình vừa chết giữa chừng */ }
  }
  const out: number[] = [];
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop()!;
    out.push(pid);
    for (const k of kids.get(pid) ?? []) stack.push(k);
  }
  return out;
}

/** Máy khách DevTools tối giản: một WebSocket, đếm id, khớp câu trả lời. */
class Cdp {
  #ws: WebSocket;
  #id = 0;
  #pending = new Map<number, { ok: (v: unknown) => void; bad: (e: Error) => void }>();

  private constructor(ws: WebSocket) {
    this.#ws = ws;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String((ev as MessageEvent).data)) as {
        id?: number; result?: unknown; error?: { message: string };
      };
      if (msg.id === undefined) return; // sự kiện, spike này không dùng
      const slot = this.#pending.get(msg.id);
      if (!slot) return;
      this.#pending.delete(msg.id);
      if (msg.error) slot.bad(new Error(msg.error.message));
      else slot.ok(msg.result);
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise<void>((ok, bad) => {
      ws.addEventListener('open', () => ok(), { once: true });
      ws.addEventListener('error', () => bad(new Error(`không mở được ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.#id;
    return new Promise<T>((ok, bad) => {
      this.#pending.set(id, { ok: ok as (v: unknown) => void, bad });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void { this.#ws.close(); }
}

async function httpJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} trả ${res.status}`);
  return (await res.json()) as T;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/**
 * Máy phục vụ tĩnh cho thư mục cảnh, chỉ nghe ở 127.0.0.1.
 *
 * Vì sao không nạp thẳng bằng `file://`: `scene.html` nạp `camera.js` bằng
 * `<script type="module">`, và trình duyệt chặn import module giữa hai
 * nguồn `file://` theo luật CORS. Một máy phục vụ HTTP tại chỗ vừa gỡ được
 * chỗ đó, vừa giống đường chạy thật hơn.
 */
function serveScene(dir: string): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').split('?')[0]!.replace(/^\/+/, '') || 'scene.html';
    // Chỉ phục vụ file nằm ngay trong thư mục cảnh.
    if (name.includes('/') || name.includes('..')) {
      res.writeHead(403).end('không phục vụ đường dẫn con');
      return;
    }
    const file = join(dir, name);
    if (!existsSync(file)) {
      res.writeHead(404).end('không có');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(name)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      ok({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

export async function renderOne(cfg: RenderConfig, outDir: string): Promise<RenderResult> {
  const chrome = findChrome();
  const userDataDir = mkdtempSync(join(tmpdir(), 'crux-spike-'));
  const { server, port: scenePort } = await serveScene(import.meta.dirname);
  const sceneUrl = `http://127.0.0.1:${scenePort}/scene.html`;

  const browser: ChildProcess = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--window-size=1920,1080',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    sceneUrl,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';
  browser.stderr?.on('data', (b: Buffer) => { stderr += b.toString(); });

  // Cổng thật được ghi vào DevToolsActivePort sau khi trình duyệt sẵn sàng.
  const portFile = join(userDataDir, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 200 && !port; i++) {
    await sleep(100);
    if (existsSync(portFile)) {
      const first = readFileSync(portFile, 'utf8').split('\n')[0];
      if (first) port = Number(first);
    }
    if (browser.exitCode !== null) {
      throw new Error(`trình duyệt thoát sớm (${browser.exitCode}): ${stderr.slice(-800)}`);
    }
  }
  if (!port) throw new Error(`không đọc được cổng DevTools: ${stderr.slice(-800)}`);

  let cdp: Cdp | undefined;
  let ffmpeg: ChildProcess | undefined;
  const clipPath = join(outDir, `${cfg.name}.mp4`);

  try {
    const targets = await httpJson<Array<{ type: string; webSocketDebuggerUrl?: string }>>(
      `http://127.0.0.1:${port}/json/list`,
    );
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) throw new Error('không thấy target trang nào');
    cdp = await Cdp.connect(page.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false,
    });

    // Chờ cảnh vẽ xong. `sceneReady` chỉ bật SAU khi canvas 6000x3400 đã
    // được vẽ một lần — nên bộ nhớ đo từ đây trở đi là bộ nhớ thật.
    let ready = false;
    for (let i = 0; i < 300 && !ready; i++) {
      const r = await cdp.send<{ result?: { value?: boolean } }>('Runtime.evaluate', {
        expression: 'window.sceneReady === true', returnByValue: true,
      });
      ready = r.result?.value === true;
      if (!ready) await sleep(100);
    }
    if (!ready) throw new Error('cảnh không báo sẵn sàng trong 30 giây');

    ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(cfg.fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-r', String(cfg.fps), clipPath,
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ffmpeg.stderr?.on('data', (b: Buffer) => { ffErr += b.toString(); });
    const ffDone = new Promise<void>((ok, bad) => {
      ffmpeg!.on('close', (code) => code === 0 ? ok() : bad(new Error(`ffmpeg ${code}: ${ffErr.slice(-600)}`)));
    });

    // Lấy mẫu bộ nhớ nền, 4 lần mỗi giây.
    let peakRss = 0;
    const pid = browser.pid!;
    const sampler = setInterval(() => {
      let total = 0;
      for (const p of processTree(pid)) total += procMem(p).rss;
      if (total > peakRss) peakRss = total;
    }, 250);

    const started = process.hrtime.bigint();
    let sceneNs = 0n;
    let captureNs = 0n;
    for (let frame = 0; frame < cfg.frames; frame++) {
      const step = cfg.secondsPerFrame ?? 1 / cfg.fps;
      const tSec = cfg.staticCamera ? 0 : frame * step;
      const t0 = process.hrtime.bigint();
      await cdp.send('Runtime.evaluate', {
        expression: `renderFrame(${tSec},${cfg.fps},${cfg.blurSamples})`,
        returnByValue: true,
      });
      const t1 = process.hrtime.bigint();
      const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
        format: 'jpeg', quality: 85, captureBeyondViewport: false,
      });
      const t2 = process.hrtime.bigint();
      sceneNs += t1 - t0;
      captureNs += t2 - t1;
      const buf = Buffer.from(shot.data, 'base64');
      if (!ffmpeg.stdin!.write(buf)) {
        await new Promise<void>((ok) => ffmpeg!.stdin!.once('drain', () => ok()));
      }
    }
    const wallMs = Number(process.hrtime.bigint() - started) / 1e6;

    clearInterval(sampler);
    let hwmSum = 0;
    for (const p of processTree(pid)) hwmSum += procMem(p).hwm;

    ffmpeg.stdin!.end();
    await ffDone;

    const clipBytes = readFileSync(clipPath).byteLength;
    return {
      config: cfg,
      frames: cfg.frames,
      wallMs,
      msPerFrame: wallMs / cfg.frames,
      peakRssBytes: peakRss,
      hwmSumBytes: hwmSum,
      sceneMs: Number(sceneNs) / 1e6,
      captureMs: Number(captureNs) / 1e6,
      clipPath,
      clipBytes,
    };
  } finally {
    cdp?.close();
    server.close();
    browser.kill('SIGKILL');
    if (ffmpeg && ffmpeg.exitCode === null) ffmpeg.kill('SIGKILL');
    rmSync(userDataDir, { recursive: true, force: true });
  }
}
