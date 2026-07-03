/**
 * Records the README demo GIF: a dark-themed 100k-point chart driven entirely by keyboard,
 * with the live-region announcement (what a screen reader speaks) mirrored visibly below the
 * plot. Deterministic frame capture — one screenshot per scripted step, assembled by ffmpeg
 * with per-frame durations — so re-recording after a visual change reproduces the same GIF.
 *
 * Run: `node scripts/record-demo.ts` (needs `npx playwright install chromium` + ffmpeg on PATH).
 * Output: media/keyboard-nav.gif (~800px wide). Frames + ffmpeg inputs land in a temp dir.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const ENTRY_FILE = '.fc-demo-entry.html';
const OUT = resolve('media/keyboard-nav.gif');

/** The demo page: landing-style dark theme, 100k points, spoken-phrase mirror under the plot. */
const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>fcharts demo</title>
<style>
  body{margin:0;background:#06080c;color:#e8eef4;font:14px system-ui,-apple-system,sans-serif}
  .stage{width:800px;padding:14px 16px 12px;box-sizing:border-box}
  .head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
  .head b{font-size:15px;letter-spacing:-.01em}.head b i{color:#6ee7a8;font-style:normal}
  .pill{font-size:11px;color:#8794a3;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:2px 8px}
  #chart{height:340px;--fc-ink:#cfd8e3;--fc-tick-color:#8794a3;--fc-grid:rgba(110,231,168,.06);
    --fc-axis:rgba(255,255,255,.12);--fc-cursor:rgba(255,255,255,.4);--fc-focus:#6ee7a8;
    --fc-ring:#06080c;--fc-readout-bg:#10151d;--fc-readout-ink:#e8eef4;
    --fc-readout-border:rgba(255,255,255,.16);--fc-legend-border:rgba(255,255,255,.45)}
  .spoken{margin-top:10px;min-height:20px;font:12.5px ui-monospace,Menlo,monospace;color:#6ee7a8}
  .spoken:before{content:"screen reader hears: ";color:#5a6675}
</style></head><body><div class="stage">
  <div class="head"><b>f<i>charts</i></b>
    <span class="pill">100,000 points</span><span class="pill">keyboard only</span></div>
  <div id="chart"></div>
  <div class="spoken" id="spoken" aria-hidden="true"></div>
</div>
<script type="module">
import { FChart } from '/src/index.ts';
const N = 100_000;
const x = Float64Array.from({ length: N }, (_, i) => i);
// Seeded LCG random walk — looks like a market series and re-records identically.
const walk = (seed, base) => {
  let s = seed >>> 0, v = base;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return Float64Array.from(x, (i) => {
    v += (rand() - 0.492) * 0.55 + Math.sin(i * 1.1e-4 + seed) * 0.012;
    return Math.max(base * 0.4, v);
  });
};
new FChart(document.getElementById('chart'), {
  series: [
    { name: 'Price', color: '#6ee7a8', type: 'area' },
    { name: 'VWAP', color: '#38bdf8' },
  ],
  data: { x, y: [walk(7, 210), walk(1301, 195)] },
  options: { ariaLabel: 'NDX intraday', xLabel: 'tick', yLabel: 'price' },
}).renderSync();
const live = document.querySelector('#chart [aria-live]');
new MutationObserver(() => {
  const t = live.textContent.trim();
  if (t) document.getElementById('spoken').textContent = t;
}).observe(live, { childList: true, characterData: true, subtree: true });
requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
</script></body></html>`;

interface Frame {
  file: string;
  /** Seconds this frame is held in the GIF. */
  hold: number;
}

async function tabToSurface(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const onSurface = await page.evaluate(
      () => document.activeElement?.classList.contains('fc-surface') ?? false,
    );
    if (onSurface) return;
  }
  throw new Error('Tab never reached .fc-surface — did the DOM order change?');
}

/** Drive the scripted interaction, snapping one frame per step. */
async function capture(page: Page, dir: string): Promise<Frame[]> {
  const stage = page.locator('.stage');
  const frames: Frame[] = [];
  let n = 0;
  const snap = async (hold: number): Promise<void> => {
    const file = join(dir, `f${String(n++).padStart(3, '0')}.png`);
    await stage.screenshot({ path: file });
    frames.push({ file, hold });
  };
  const press = async (key: string, times: number, hold: number, settle = 60): Promise<void> => {
    for (let i = 0; i < times; i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(settle);
      await snap(hold);
    }
  };

  await snap(1.0); // establish the scene
  await tabToSurface(page);
  await page.waitForTimeout(200);
  await snap(0.9); // focus ring visible
  await press('End', 1, 0.8, 300); // jump to the newest sample, announced
  await press('ArrowLeft', 22, 0.14); // walk back through the data, readout + speech updating
  await press('+', 4, 0.35, 140); // keyboard zoom in
  await press('ArrowRight', 14, 0.14);
  await snap(1.6); // hold the final state
  return frames;
}

function assembleGif(frames: Frame[], dir: string): void {
  // concat demuxer with per-frame durations; palette pass keeps the dark theme banding-free.
  const list = frames.map((f) => `file '${f.file}'\nduration ${f.hold}`).join('\n');
  const listFile = join(dir, 'frames.txt');
  // concat quirk: the last frame's duration is ignored unless the file is listed once more.
  writeFileSync(listFile, `${list}\nfile '${frames[frames.length - 1].file}'\n`);
  mkdirSync(resolve('media'), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf',
    'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
    OUT,
  ], { stdio: 'inherit' });
}

async function main(): Promise<void> {
  const entry = resolve(ENTRY_FILE);
  writeFileSync(entry, PAGE_HTML);
  const dir = mkdtempSync(join(tmpdir(), 'fc-demo-'));
  let server: ViteDevServer | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    server = await createServer({ root: process.cwd(), logLevel: 'silent' });
    await server.listen();
    const url = server.resolvedUrls?.local?.[0];
    if (!url) throw new Error('Vite did not report a local URL');
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 470 }, locale: 'en-US' });
    await page.goto(`${url}${ENTRY_FILE}`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true, undefined, {
      timeout: 30_000,
    });
    const frames = await capture(page, dir);
    assembleGif(frames, dir);
    console.log(`wrote ${OUT} (${frames.length} frames)`);
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(entry, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
