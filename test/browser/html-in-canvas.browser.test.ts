/**
 * HTML-in-Canvas path regression test. Launches Chromium with the CanvasDrawElement feature
 * (the engine behind chrome://flags/#canvas-draw-element) and proves the chart keeps the
 * html-in-canvas render path AND composites real tick pixels into the bitmap.
 *
 * Pins two Chrome behavior shifts the warm-up logic must absorb (probed on 148/149):
 *  - pre-snapshot draws may throw (148: "no cached paint record", 149: InvalidStateError on
 *    the first frame) or "succeed" while painting nothing (149) — both are warm-up misses;
 *  - a layoutsubtree child can't size itself via `inset:0` (0×0 in 149) — the chart must give
 *    the canvas-child tick layer an explicit size or every snapshot is silently empty.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

interface ChartProbe {
  renderPath: string;
  htmlInCanvas: { supported: boolean; via: string | null };
}

declare global {
  interface Window {
    __hic: { chart: ChartProbe; paths: string[] };
    __ready?: boolean;
  }
}

const ENTRY = resolve(process.cwd(), '.fc-hic-entry.html');

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>html,body{margin:0}#root{width:800px;height:400px}</style></head>
<body><div id="root"></div>
<script type="module">
import { FChart } from '/src/index.ts';
const paths = [];
const chart = new FChart(document.getElementById('root'), {
  series: [{ name: 'A' }],
  data: { x: [0, 1, 2, 3], y: [[1, 3, 2, 4]] },
  options: { ariaLabel: 'hic probe', xLabel: 'time', yLabel: 'value', onRenderPath: (p) => paths.push(p) },
});
window.__hic = { chart, paths };
// Let the warm-up retry loop (miss budget = 8 frames) fully settle before reporting ready.
let n = 0;
const tick = () => (++n > 12 ? (window.__ready = true) : requestAnimationFrame(tick));
requestAnimationFrame(tick);
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;

before(async () => {
  writeFileSync(ENTRY, PAGE_HTML);
  server = await createServer({ root: process.cwd(), logLevel: 'silent' });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a local URL');
  browser = await chromium.launch({ args: ['--enable-features=CanvasDrawElement'] });
  // dpr 2: the element snapshot is device-pixel resolution, so a wrong composite transform
  // shows up as dpr²-scaled ticks (invisible at dpr 1) — see the compositor's identity reset.
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}.fc-hic-entry.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 30_000 });
});

after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(ENTRY, { force: true });
});

test('with CanvasDrawElement enabled, the chart keeps the html-in-canvas path', async () => {
  const probe = await page.evaluate(() => ({
    detect: window.__hic.chart.htmlInCanvas,
    renderPath: window.__hic.chart.renderPath,
    pathChanges: window.__hic.paths,
  }));
  assert.equal(probe.detect.supported, true, 'feature should be detected');
  assert.equal(probe.detect.via, 'drawElementImage');
  assert.equal(probe.renderPath, 'html-in-canvas', 'path must survive warm-up without self-heal');
  assert.deepEqual(probe.pathChanges, [], 'no fallback was reported');
});

test('the canvas-child tick layer has real size and composites pixels into the bitmap', async () => {
  const probe = await page.evaluate(() => {
    const ticks = document.querySelector('.fc-ticks');
    const rect = ticks?.getBoundingClientRect();
    const canvas = document.querySelector<HTMLCanvasElement>('#root canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !rect) return null;
    // The y-axis gutter only gets pixels from the composited tick layer (labels/titles) —
    // the canvas renderer itself never draws there.
    const gutter = ctx.getImageData(0, 0, Math.round(53 * window.devicePixelRatio), canvas.height);
    let opaque = 0;
    for (let i = 3; i < gutter.data.length; i += 4) if (gutter.data[i] > 8) opaque++;
    // Bottom band (the 32px x-axis margin): x tick labels + title must land here — under a
    // dpr²-scaled composite they're drawn past the bitmap's bottom edge and vanish.
    const dpr = window.devicePixelRatio;
    const bandTop = canvas.height - Math.round(32 * dpr);
    const band = ctx.getImageData(0, bandTop, canvas.width, canvas.height - bandTop);
    let bandOpaque = 0;
    for (let i = 3; i < band.data.length; i += 4) if (band.data[i] > 8) bandOpaque++;
    return {
      parent: ticks?.parentElement?.tagName,
      rect: { width: rect.width, height: rect.height },
      gutterOpaque: opaque,
      bandOpaque,
    };
  });
  assert.ok(probe, 'probe found the chart DOM');
  assert.equal(probe.parent, 'CANVAS', 'tick layer stays a canvas child on this path');
  assert.ok(probe.rect.width > 0 && probe.rect.height > 0, 'tick layer must not collapse to 0×0');
  assert.ok(probe.gutterOpaque > 50, `composited tick pixels in the gutter (got ${probe.gutterOpaque})`);
  assert.ok(probe.bandOpaque > 50, `x labels land inside the bitmap (got ${probe.bandOpaque})`);
});

test('tick labels never overlap the axis titles', async () => {
  const probe = await page.evaluate(() => {
    const titles: [string, DOMRect | null][] = ['x', 'y'].map((axis) => [
      axis,
      document.querySelector(`.fc-axis-title-${axis}`)?.getBoundingClientRect() ?? null,
    ]);
    const collisions: string[] = [];
    for (const tick of document.querySelectorAll('.fc-tick')) {
      const r = tick.getBoundingClientRect();
      for (const [axis, t] of titles) {
        if (t && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top) {
          collisions.push(`${axis}:${tick.textContent}`);
        }
      }
    }
    return {
      hasTitles: titles.every(([, t]) => t !== null),
      tickCount: document.querySelectorAll('.fc-tick').length,
      collisions,
    };
  });
  assert.ok(probe.hasTitles, 'both axis titles render');
  assert.ok(probe.tickCount > 4, `ticks survive pruning (got ${probe.tickCount})`);
  assert.deepEqual(probe.collisions, [], 'no tick label intersects a title');
});
