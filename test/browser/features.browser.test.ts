/**
 * Browser-level tests for the integration features — linked panes (`syncCharts`), the CSV
 * export control, SSR hydration (`hydrate`), the `<f-chart>` web component, and the Vue and
 * Svelte adapters. Same harness as `fchart.browser.test.ts`: a temp Vite entry, headless
 * Chromium, and a `window.__ready` handshake. Run with `pnpm test:browser`.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

interface SyncReport {
  aDomain: [number, number];
  bDomain: [number, number];
  matched: boolean;
}

declare global {
  interface Window {
    __feat: {
      syncProgrammatic(): SyncReport;
      syncWheel(): SyncReport;
      syncUnlinked(): SyncReport;
      csv(): { text: string; buttonLabel: string | null; defaultHasButton: boolean };
      csvCandle(): string;
      hydrateRun(): {
        hadSvg: boolean;
        svgGone: boolean;
        hasCanvas: boolean;
        heightPinned: boolean;
        ariaLabel: string | null;
      };
      elementRun(): {
        mounted: boolean;
        updatedLabel: string | null;
        remounted: boolean;
        detachedClean: boolean;
      };
      vueRun(): Promise<{ mounted: boolean; unmounted: boolean }>;
      svelteRun(): { mounted: boolean; updatedDomainReset: boolean; destroyed: boolean };
    };
    __ready?: boolean;
  }
}

const ENTRY = resolve(process.cwd(), '.fc-features-entry.html');

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>html,body{margin:0}.pane{width:700px;height:260px}</style></head>
<body>
<script type="module">
import { FChart, syncCharts, hydrate, defineFChart, renderSVG } from '/src/index.ts';
import { fchart as fchartAction } from '/src/svelte.ts';
import { FChart as FChartVue } from '/src/vue.ts';
import { createApp, h } from 'vue';

const N = 500;
function makeData() {
  const x = Float64Array.from({ length: N }, (_, i) => i);
  const y = Float64Array.from(x, (i) => 50 + Math.sin(i / 30) * 20);
  return { x, y: [y] };
}
function pane() {
  const el = document.createElement('div');
  el.className = 'pane';
  document.body.append(el);
  return el;
}
const round2 = (d) => [Math.round(d[0] * 100) / 100, Math.round(d[1] * 100) / 100];
const report = (a, b) => {
  const ad = round2(a.domain);
  const bd = round2(b.domain);
  return { aDomain: ad, bDomain: bd, matched: ad[0] === bd[0] && ad[1] === bd[1] };
};

window.__feat = {
  syncProgrammatic() {
    const a = new FChart(pane(), { series: [{ name: 'P' }], data: makeData(), options: { ariaLabel: 'A' } });
    const b = new FChart(pane(), { series: [{ name: 'V' }], data: makeData(), options: { ariaLabel: 'B' } });
    const unlink = syncCharts([a, b]);
    a.renderSync([100, 300]);
    const r = report(a, b);
    unlink(); a.destroy(); b.destroy();
    return r;
  },
  syncWheel() {
    const a = new FChart(pane(), { series: [{ name: 'P' }], data: makeData(), options: { ariaLabel: 'A' } });
    const b = new FChart(pane(), { series: [{ name: 'V' }], data: makeData(), options: { ariaLabel: 'B' } });
    a.renderSync(); b.renderSync();
    const unlink = syncCharts([a, b]);
    const surface = a.root ?? null; // private; go through the DOM instead
    const el = document.querySelectorAll('.fc-surface')[document.querySelectorAll('.fc-surface').length - 2];
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + 10,
      bubbles: true, cancelable: true,
    }));
    const r = report(a, b);
    unlink(); a.destroy(); b.destroy();
    return r;
  },
  syncUnlinked() {
    const a = new FChart(pane(), { series: [{ name: 'P' }], data: makeData(), options: { ariaLabel: 'A' } });
    const b = new FChart(pane(), { series: [{ name: 'V' }], data: makeData(), options: { ariaLabel: 'B' } });
    syncCharts([a, b])(); // link then immediately unlink
    a.renderSync([100, 300]);
    const r = report(a, b);
    a.destroy(); b.destroy();
    return r;
  },
  csv() {
    const host = pane();
    const chart = new FChart(host, {
      series: [{ name: 'Pressure, "abs"' }],
      data: { x: [0, 1, 2], y: [[10, 11.5, 12]] },
      options: { ariaLabel: 'CSV chart', xLabel: 'tick', exportControl: true },
    });
    const btn = host.querySelector('.fc-export');
    const text = chart.toCSV();
    chart.destroy();
    const plain = new FChart(host, { series: [{ name: 'S' }], data: { x: [0], y: [[1]] }, options: { ariaLabel: 'plain' } });
    const defaultHasButton = host.querySelector('.fc-export') !== null;
    plain.destroy();
    return { text, buttonLabel: btn ? btn.textContent : null, defaultHasButton };
  },
  csvCandle() {
    const host = pane();
    const chart = new FChart(host, {
      series: [{ name: 'BTC', type: 'candle' }],
      data: { x: [0, 1], y: [[10, 11], [12, 13], [9, 10], [11, 12]] },
      options: { ariaLabel: 'candle csv' },
    });
    const text = chart.toCSV();
    chart.destroy();
    return text;
  },
  hydrateRun() {
    const host = document.createElement('div');
    document.body.append(host);
    const data = makeData();
    const config = { series: [{ name: 'P', color: '#16a34a' }], options: { ariaLabel: 'Hydrated' } };
    host.innerHTML = renderSVG(config, data, { width: 700, height: 240 });
    const hadSvg = host.querySelector(':scope > svg') !== null;
    const heightBefore = host.getBoundingClientRect().height;
    const chart = hydrate(host, { ...config, data });
    const out = {
      hadSvg,
      // :scope > svg — the live legend contains small <svg> swatches; only the static
      // chart document was a *direct* child.
      svgGone: host.querySelector(':scope > svg') === null,
      hasCanvas: host.querySelector('canvas') !== null,
      // The invariant is *no layout shift*: the box after hydration equals the box the
      // static SVG defined (inline-svg baseline gap included).
      heightPinned: Math.abs(host.getBoundingClientRect().height - heightBefore) < 1,
      ariaLabel: host.querySelector('.fc-surface')?.getAttribute('aria-label') ?? null,
    };
    chart.destroy();
    return out;
  },
  elementRun() {
    defineFChart();
    defineFChart(); // idempotent — must not throw on re-registration
    const el = document.createElement('f-chart');
    el.style.height = '220px';
    document.body.append(el);
    const data = makeData();
    el.config = { series: [{ name: 'E' }], data, options: { ariaLabel: 'Element chart' } };
    const mounted = el.querySelector('canvas') !== null;
    el.config = { series: [{ name: 'E' }], data, options: { ariaLabel: 'Renamed chart' } };
    const updatedLabel = el.querySelector('.fc-surface')?.getAttribute('aria-label') ?? null;
    const before = el.querySelector('canvas');
    el.config = { series: [{ name: 'E' }], data, options: { ariaLabel: 'Renamed chart', legend: false } };
    const remounted = el.querySelector('canvas') !== before && el.querySelector('canvas') !== null;
    el.remove();
    const detachedClean = el.querySelector('canvas') === null;
    return { mounted, updatedLabel, remounted, detachedClean };
  },
  async vueRun() {
    const host = pane();
    const data = makeData();
    const app = createApp({
      render: () => h(FChartVue, {
        series: [{ name: 'VueSeries' }], data,
        options: { ariaLabel: 'Vue chart' }, style: 'height:220px',
      }),
    });
    app.mount(host);
    await new Promise((r) => requestAnimationFrame(r));
    const mounted = host.querySelector('canvas') !== null;
    app.unmount();
    return { mounted, unmounted: host.querySelector('canvas') === null };
  },
  svelteRun() {
    const host = pane();
    const data = makeData();
    const action = fchartAction(host, {
      series: [{ name: 'Sv' }], data, options: { ariaLabel: 'Svelte chart' },
    });
    const mounted = host.querySelector('canvas') !== null;
    action.update({ series: [{ name: 'Sv' }], data: makeData(), options: { ariaLabel: 'Svelte chart' } });
    const updatedDomainReset = host.querySelector('.fc-surface') !== null;
    action.destroy();
    return { mounted, updatedDomainReset, destroyed: host.querySelector('canvas') === null };
  },
};
window.__ready = true;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;

before(async () => {
  writeFileSync(ENTRY, PAGE_HTML);
  // Pre-bundle vue: without it, Vite discovers the dep on first visit and triggers a full page
  // reload mid-run — the page re-initializes and the first evaluate times out (flaked in CI).
  server = await createServer({
    root: process.cwd(),
    logLevel: 'silent',
    optimizeDeps: { include: ['vue'] },
  });
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a local URL');
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}.fc-features-entry.html`, { waitUntil: 'load' });
  // 120s: cold CI runners transform the whole module graph on first visit; 30s flaked there.
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 120_000 });
});

after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(ENTRY, { force: true });
});

test('syncCharts: a programmatic renderSync(domain) on one pane moves the other', async () => {
  const r = await page.evaluate(() => window.__feat.syncProgrammatic());
  assert.ok(r.matched, `domains match: ${JSON.stringify(r)}`);
  assert.ok(Math.abs(r.aDomain[0] - 100) < 1 && Math.abs(r.aDomain[1] - 300) < 1);
});

test('syncCharts: a real wheel zoom on pane A moves pane B; unlink stops following', async () => {
  const wheel = await page.evaluate(() => window.__feat.syncWheel());
  assert.ok(wheel.matched, `wheel-synced: ${JSON.stringify(wheel)}`);
  assert.ok(wheel.aDomain[1] - wheel.aDomain[0] < 500, 'wheel actually zoomed in');
  const un = await page.evaluate(() => window.__feat.syncUnlinked());
  assert.ok(!un.matched, `unlinked panes diverge: ${JSON.stringify(un)}`);
});

test('toCSV: header quoting, x column from xLabel, raw values; button is opt-in + localized', async () => {
  const r = await page.evaluate(() => window.__feat.csv());
  const lines = r.text.split('\n');
  assert.equal(lines[0], 'tick,"Pressure, ""abs"""');
  assert.equal(lines[1], '0,10');
  assert.equal(lines[2], '1,11.5');
  assert.equal(lines.length, 4);
  assert.equal(r.buttonLabel, 'Download data (CSV)');
  assert.equal(r.defaultHasButton, false, 'no button unless exportControl: true');
});

test('toCSV: candle series expand to four localized OHLC columns', async () => {
  const text = await page.evaluate(() => window.__feat.csvCandle());
  const lines = text.split('\n');
  assert.equal(lines[0], 'x,BTC open,BTC high,BTC low,BTC close');
  assert.equal(lines[1], '0,10,12,9,11');
});

test('hydrate: static SVG swaps to a live chart with no leftover SVG and a pinned height', async () => {
  const r = await page.evaluate(() => window.__feat.hydrateRun());
  assert.ok(r.hadSvg, 'server SVG was present before hydration');
  assert.ok(r.svgGone, 'static SVG removed after first live frame');
  assert.ok(r.hasCanvas, 'live canvas mounted');
  assert.ok(r.heightPinned, 'container kept the SVG-defined height');
  assert.match(r.ariaLabel ?? '', /Hydrated/);
});

test('<f-chart>: mounts on config, updates in place, remounts on fixed-option change, cleans up', async () => {
  const r = await page.evaluate(() => window.__feat.elementRun());
  assert.ok(r.mounted, 'canvas after first config');
  assert.match(r.updatedLabel ?? '', /Renamed chart/, 'in-place update applied');
  assert.ok(r.remounted, 'legend change forced a clean remount');
  assert.ok(r.detachedClean, 'disconnect destroyed the chart');
});

test('Vue adapter: mounts a live chart and destroys it on unmount', async () => {
  const r = await page.evaluate(() => window.__feat.vueRun());
  assert.ok(r.mounted, 'canvas under the Vue host');
  assert.ok(r.unmounted, 'canvas gone after app.unmount()');
});

test('Svelte action: mounts, absorbs updates, and destroys', async () => {
  const r = await page.evaluate(() => window.__feat.svelteRun());
  assert.ok(r.mounted && r.updatedDomainReset && r.destroyed, JSON.stringify(r));
});
