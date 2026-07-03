// Browser-side streaming benchmark: append() throughput (with its per-sample DOM work) and
// streaming frame cost (tick rebuild + prune). Run: node bench/append-bench.mjs
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ENTRY = resolve(process.cwd(), '.fc-append-bench.html');
writeFileSync(
  ENTRY,
  `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0}#root{width:900px;height:420px}</style></head>
<body><div id="root"></div>
<script type="module">
import { FChart } from '/src/index.ts';

function mount(n) {
  const root = document.getElementById('root');
  root.replaceChildren();
  const x = Float64Array.from({ length: n }, (_, i) => i);
  const a = Float64Array.from(x, (i) => 50 + Math.sin(i / 40) * 25);
  const b = Float64Array.from(x, (i) => 10 + i * 0.01);
  const chart = new FChart(root, {
    series: [{ name: 'A' }, { name: 'B' }],
    data: { x, y: [a, b] },
    options: { ariaLabel: 'bench', xLabel: 'time', yLabel: 'value' },
  });
  chart.renderSync();
  return { chart, n };
}

window.__bench = {
  // Throughput of bare append() calls (state + scheduled render + per-sample DOM work).
  appends(count) {
    const { chart, n } = mount(5000);
    const t0 = performance.now();
    for (let i = 0; i < count; i++) chart.append(n + i, [50 + (i % 70) * 0.3, 20 + (i % 50) * 0.2]);
    const ms = performance.now() - t0;
    chart.destroy();
    return { totalMs: ms, perAppendUs: (ms / count) * 1000 };
  },
  // Streaming frame cost: one append + one renderSync per iteration (the live-demo loop).
  streamingFrames(count) {
    const { chart, n } = mount(5000);
    const t0 = performance.now();
    for (let i = 0; i < count; i++) {
      chart.append(n + i, [50 + (i % 70) * 0.3, 20 + (i % 50) * 0.2]);
      chart.renderSync();
    }
    const ms = performance.now() - t0;
    chart.destroy();
    return { totalMs: ms, perFrameMs: ms / count };
  },
};
window.__ready = true;
</script></body></html>`,
);

const server = await createServer({ root: process.cwd(), logLevel: 'silent' });
await server.listen();
const url = server.resolvedUrls?.local?.[0];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${url}.fc-append-bench.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true);

for (const round of [1, 2]) {
  const appends = await page.evaluate(() => window.__bench.appends(20_000));
  const frames = await page.evaluate(() => window.__bench.streamingFrames(2_000));
  console.log(
    `round ${round}: append ${appends.perAppendUs.toFixed(1)} µs/op · ` +
      `streaming frame ${frames.perFrameMs.toFixed(3)} ms/frame`,
  );
}
await browser.close();
await server.close();
rmSync(ENTRY, { force: true });
