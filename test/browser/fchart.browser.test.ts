/**
 * Browser-level tests for the FChart interactive layer — the keyboard cursor, wheel-zoom,
 * drag-pan, hover readout, pagers, legend toggling, streaming follow semantics, update()
 * patch rules, and destroy() teardown that the node unit tests can't reach.
 *
 * Same harness pattern as `fcharts-audit` (src/compliance/cli.ts): a temp HTML entry at the
 * project root so Vite transforms `/src/index.ts`, headless Chromium via Playwright, and a
 * `window.__ready` handshake. Run with `pnpm test:browser`.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/** Runtime probe into one FChart instance. Private fields are compile-time-only, so the
 *  browser-side tests may read them; this type spells out exactly what they touch. */
interface ChartProbe {
  domain: [number, number];
  yDomain: [number, number];
  activeSample: { textContent: string | null };
  renderPath: string;
  append(x: number, ys: number[]): unknown;
  renderSync(domain?: [number, number]): unknown;
  update(patch: {
    options?: Record<string, unknown>;
    series?: { name: string }[];
  }): unknown;
  destroy(): void;
}

declare global {
  interface Window {
    __test: {
      chart: ChartProbe;
      mount(opts?: Record<string, unknown>): boolean;
      mountCandle(): boolean;
      mountAnnotated(): boolean;
      mountZeroHeight(): { w: number; h: number; canvasH: number; warnings: string[] };
      sameConstructionOptions(a?: object, b?: object): boolean;
      renderReact(options: Record<string, unknown>): void;
      unmountReact(): void;
    };
    __ready?: boolean;
  }
}

const ENTRY = resolve(process.cwd(), '.fc-test-entry.html');

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>html,body{margin:0}#root{width:800px;height:400px}</style></head>
<body><div id="root"></div>
<script type="module">
import { FChart, sameConstructionOptions } from '/src/index.ts';
import { FChart as FChartReact } from '/src/react.ts';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
const root = document.getElementById('root');
const N = 1000;
function makeData() {
  const x = Float64Array.from({ length: N }, (_, i) => i);
  const a = Float64Array.from(x, (i) => 50 + Math.sin(i / 40) * 25);
  const b = Float64Array.from(x, (i) => 10 + i * 0.05);
  return { x, y: [a, b] };
}
// React adapter probe: one host + root reused across renders, stable data identity so a
// re-render with unchanged data doesn't reset the view.
const reactHost = document.createElement('div');
reactHost.id = 'react-host';
reactHost.style.cssText = 'width:600px;height:300px';
document.body.append(reactHost);
const reactRoot = createRoot(reactHost);
const reactData = makeData();
window.__test = {
  chart: null,
  sameConstructionOptions,
  renderReact(options) {
    reactRoot.render(createElement(FChartReact, {
      series: [{ name: 'Alpha' }, { name: 'Beta' }],
      data: reactData,
      options,
      style: { height: 300 },
    }));
  },
  unmountReact() {
    reactRoot.unmount();
  },
  mount(opts = {}) {
    if (window.__test.chart) window.__test.chart.destroy();
    const chart = new FChart(root, {
      series: [{ name: 'Alpha' }, { name: 'Beta' }],
      data: makeData(),
      options: Object.assign({ ariaLabel: 'Test chart', xLabel: 'time', yLabel: 'value' }, opts),
    });
    chart.renderSync();
    window.__test.chart = chart;
    return true;
  },
  mountCandle() {
    if (window.__test.chart) window.__test.chart.destroy();
    const count = 20; // candles at x = 0, 10, …, 190
    const x = Float64Array.from({ length: count }, (_, i) => i * 10);
    const o = Float64Array.from(x, (_, i) => 100 + (i % 3));
    const c = Float64Array.from(x, (_, i) => 99 + ((i + 1) % 4));
    const h = Float64Array.from(x, (_, i) => Math.max(o[i], c[i]) + 1);
    const l = Float64Array.from(x, (_, i) => Math.min(o[i], c[i]) - 1);
    const chart = new FChart(root, {
      series: [{ name: 'Price', type: 'candle' }],
      data: { x, y: [o, h, l, c] },
      options: { ariaLabel: 'Candle chart' },
    });
    chart.renderSync();
    window.__test.chart = chart;
    return true;
  },
  mountAnnotated() {
    if (window.__test.chart) window.__test.chart.destroy();
    // makeData() has n=1000, so the initial cursor lands at index 500 (x=500); annotate there.
    const chart = new FChart(root, {
      series: [{ name: 'Alpha' }, { name: 'Beta' }],
      data: makeData(),
      options: { ariaLabel: 'Annotated', xLabel: 'time', yLabel: 'value' },
      annotations: [{ x: 500, label: 'EVENT-X' }],
    });
    chart.renderSync();
    window.__test.chart = chart;
    return true;
  },
  mountZeroHeight() {
    // A real width but indefinite (auto) height → .fc-root height:100% collapses to 0.
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      const parent = document.createElement('div');
      parent.style.width = '600px'; // definite width, auto height
      const host = document.createElement('div');
      host.style.height = '100%';
      parent.append(host);
      document.body.append(parent);
      // legend:false so the flex root has no intrinsic-height children — it collapses to 0 with
      // the plot (the legend would otherwise give the root ~40px while the plot itself is still 0).
      const chart = new FChart(host, { series: [{ name: 'A' }, { name: 'B' }], data: makeData(), options: { ariaLabel: 'ZH', legend: false } });
      const canvas = host.querySelector('canvas');
      const r = host.getBoundingClientRect();
      chart.destroy();
      parent.remove();
      return { w: Math.round(r.width), h: Math.round(r.height), canvasH: canvas ? canvas.height : -1, warnings };
    } finally {
      console.warn = orig;
    }
  },
};
window.__test.mount();
requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
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
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${url}.fc-test-entry.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 30_000 });
});

after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(ENTRY, { force: true });
});

/** Fresh chart for every test so cursor/domain state can't leak between them. */
async function mount(opts: Record<string, unknown> = {}): Promise<void> {
  await page.evaluate((o) => window.__test.mount(o), opts);
}

function domain(): Promise<[number, number]> {
  return page.evaluate(() => [...window.__test.chart.domain] as [number, number]);
}

function activeSample(): Promise<string> {
  return page.evaluate(() => window.__test.chart.activeSample.textContent ?? '');
}

async function frame(): Promise<void> {
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

test('mounts an accessible surface: name, role, table alternative, JSON summary', async () => {
  await mount();
  const probe = await page.evaluate(() => {
    const surface = document.querySelector('.fc-surface');
    const json = document.querySelector('script[data-fcharts="summary"]');
    return {
      role: surface?.getAttribute('role'),
      label: surface?.getAttribute('aria-label') ?? '',
      hasTable: document.querySelector('.fc-root table') !== null,
      summary: JSON.parse(json?.textContent ?? '{}') as { series?: { name: string }[] },
    };
  });
  assert.equal(probe.role, 'application');
  assert.ok(probe.label.includes('Test chart'), probe.label);
  assert.ok(probe.hasTable, 'hidden data table should exist');
  assert.deepEqual(probe.summary.series?.map((s) => s.name), ['Alpha', 'Beta']);
});

test('keyboard cursor: focus announces, arrows move/switch, Home jumps, Escape dismisses', async () => {
  await mount();
  await page.focus('.fc-surface');
  const onFocus = await activeSample();
  assert.match(onFocus, /^Alpha — time 500, /, 'focus starts at the middle sample');

  await page.keyboard.press('ArrowRight');
  const afterRight = await activeSample();
  assert.notEqual(afterRight, onFocus);
  assert.match(afterRight, /^Alpha — /);

  await page.keyboard.press('ArrowDown');
  assert.match(await activeSample(), /^Beta — /, 'ArrowDown switches series');

  await page.keyboard.press('Home');
  assert.match(await activeSample(), /time 0,/, 'Home jumps to the first sample');

  await page.keyboard.press('Escape');
  assert.equal(await activeSample(), '', 'Escape clears the queryable active sample');
});

test('keyboard zoom: + narrows the domain around the cursor, - widens it back', async () => {
  await mount();
  await page.focus('.fc-surface');
  const [d0, d1] = await domain();
  await page.keyboard.press('+');
  const [z0, z1] = await domain();
  assert.ok(z1 - z0 < d1 - d0, `zoomed width ${z1 - z0} should shrink from ${d1 - d0}`);
  assert.ok(z0 >= d0 && z1 <= d1, 'zoomed view stays inside the data');
  await page.keyboard.press('-');
  const [w0, w1] = await domain();
  assert.ok(w1 - w0 > z1 - z0, 'minus widens the view again');
});

test('wheel zoom-in narrows the domain', async () => {
  await mount();
  const box = await page.locator('.fc-surface').boundingBox();
  assert.ok(box, 'surface has a bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const [d0, d1] = await domain();
  await page.mouse.wheel(0, -240);
  const [z0, z1] = await domain();
  assert.ok(z1 - z0 < d1 - d0, `wheel-up should zoom in (${z1 - z0} < ${d1 - d0})`);
});

test('drag pans a zoomed view earlier, preserving the window width', async () => {
  await mount();
  await page.evaluate(() => window.__test.chart.renderSync([400, 600]));
  const box = await page.locator('.fc-surface').boundingBox();
  assert.ok(box);
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, cy, { steps: 5 });
  await page.mouse.up();
  const [p0, p1] = await domain();
  assert.ok(p0 < 400, `dragging right pans to earlier data (domain[0]=${p0})`);
  assert.ok(Math.abs(p1 - p0 - 200) < 1, `window width preserved (${p1 - p0})`);
});

test('hover shows the readout pinned to the nearest sample', async () => {
  await mount();
  const box = await page.locator('.fc-surface').boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await frame();
  const readout = await page.evaluate(() => {
    const el = document.querySelector('.fc-readout');
    return { shown: el?.classList.contains('fc-show') ?? false, text: el?.textContent ?? '' };
  });
  assert.ok(readout.shown, 'readout becomes visible on hover');
  assert.match(readout.text, /Alpha/, 'readout names the series');
});

test('pagers: shown when zoomed, disabled at the data edge, click pans ~one page', async () => {
  await mount();
  await page.evaluate(() => window.__test.chart.renderSync([0, 200]));
  const state = await page.evaluate(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('.fc-pagers button');
    return { prevDisabled: buttons[0].disabled, nextDisabled: buttons[1].disabled };
  });
  assert.equal(state.prevDisabled, true, 'at the left edge the prev pager is disabled');
  assert.equal(state.nextDisabled, false);
  await page.locator('.fc-pagers button').nth(1).click();
  const [p0, p1] = await domain();
  assert.ok(Math.abs(p0 - 180) < 1 && Math.abs(p1 - 380) < 1, `panned one page (got [${p0}, ${p1}])`);
});

test('legend toggle hides a series and moves the cursor to the first visible one', async () => {
  await mount();
  await page.locator('.fc-legend button').first().click();
  const pressed = await page
    .locator('.fc-legend button')
    .first()
    .getAttribute('aria-pressed');
  assert.equal(pressed, 'false', 'toggled series reports hidden');
  await page.focus('.fc-surface');
  assert.match(await activeSample(), /^Beta — /, 'cursor abandons the hidden series');
});

test('append while following: full view grows, zoomed tail window slides, cursor snaps back', async () => {
  // Full-history view → the right edge grows to the new sample.
  await mount();
  await page.evaluate(() => window.__test.chart.append(1000, [50, 60]));
  assert.deepEqual(await domain(), [0, 1000]);

  // Zoomed onto the live tail → the window slides and keeps its width.
  await mount();
  await page.evaluate(() => {
    window.__test.chart.renderSync([799, 999]);
    window.__test.chart.append(1000, [50, 60]);
  });
  const [s0, s1] = await domain();
  assert.equal(s1, 1000, 'window tracks the new last sample');
  assert.ok(Math.abs(s1 - s0 - 200) < 1, `window width preserved (${s1 - s0})`);

  // A focused cursor that slides out of view snaps back in and stays queryable.
  await mount();
  await page.focus('.fc-surface');
  await page.evaluate(() => {
    window.__test.chart.renderSync([799, 999]);
    window.__test.chart.append(1000, [50, 60]);
  });
  const sample = await activeSample();
  const match = sample.match(/time (\d+),/);
  assert.ok(match, `active sample still describes a point (${sample})`);
  assert.ok(Number(match[1]) >= 799, 'cursor snapped into the visible window');
});

test('append while panned into history leaves the view and y-axis untouched', async () => {
  await mount();
  const yBefore = await page.evaluate(() => {
    window.__test.chart.renderSync([100, 300]);
    return [...window.__test.chart.yDomain];
  });
  // An extreme value: would rescale the y-axis if the paused view wrongly followed.
  await page.evaluate(() => window.__test.chart.append(1000, [500, 500]));
  assert.deepEqual(await domain(), [100, 300], 'paused view keeps its x-window');
  const yAfter = await page.evaluate(() => [...window.__test.chart.yDomain]);
  assert.deepEqual(yAfter, yBefore, 'paused view keeps its y-axis');
});

test('candle series: the view pads half a step so edge candles render whole', async () => {
  await page.evaluate(() => window.__test.mountCandle());
  // 20 candles at x = 0..190, step 10 → auto xPad 5 beyond each end.
  assert.deepEqual(await domain(), [-5, 195]);
  // A programmatic trailing window (what range-preset buttons do) narrows the domain…
  await page.evaluate(() => window.__test.chart.renderSync([95, 195]));
  assert.deepEqual(await domain(), [95, 195]);
  // …and appending then slides it, keeping the width and the padded right edge.
  await page.evaluate(() => window.__test.chart.append(200, [101, 102, 99, 100]));
  const d = await domain();
  assert.equal(d[1], 205, 'right edge tracks the new candle plus the pad');
  assert.equal(Math.round(d[1] - d[0]), 100, 'window width preserved');
});

test('update() applies live options: formatters, axis labels, aria-label', async () => {
  await mount();
  await page.evaluate(() => {
    window.__test.chart.update({
      options: { formatY: (v: number) => `Y${v}`, xLabel: 'epoch', ariaLabel: 'Patched' },
    });
    window.__test.chart.renderSync();
  });
  const probe = await page.evaluate(() => ({
    yTick: document.querySelector('.fc-tick-y')?.textContent ?? '',
    xTitle: document.querySelector('.fc-axis-title-x')?.textContent ?? '',
    yTitle: document.querySelector('.fc-axis-title-y')?.textContent ?? '',
    label: document.querySelector('.fc-surface')?.getAttribute('aria-label') ?? '',
  }));
  assert.match(probe.yTick, /^Y/, 'patched formatY reaches the tick text');
  assert.equal(probe.xTitle, 'epoch', 'patched xLabel reaches the axis title');
  assert.equal(probe.yTitle, 'value', 'unpatched yLabel title survives');
  assert.ok(probe.label.includes('Patched'), probe.label);
});

test('update() fails fast on construction-time options, accepts unchanged values', async () => {
  await mount();
  const attempt = (patch: Record<string, unknown>): Promise<string | null> =>
    page.evaluate((p) => {
      try {
        window.__test.chart.update({ options: p });
        return null;
      } catch (e) {
        return String(e);
      }
    }, patch);

  assert.match((await attempt({ legend: false })) ?? '', /"legend" is fixed at construction/);
  assert.match((await attempt({ sonify: true })) ?? '', /"sonify" is fixed at construction/);
  assert.match(
    (await attempt({ strings: { shown: 'changed!' } })) ?? '',
    /"strings" is fixed at construction/,
  );
  assert.equal(await attempt({ legend: true }), null, 'passing the current value is a no-op');
  assert.equal(await attempt({ strings: {} }), null, 'an empty strings patch is a no-op');
});

test('sameConstructionOptions matches the update() rules (adapter remount contract)', async () => {
  const results = await page.evaluate(() => {
    const same = window.__test.sameConstructionOptions;
    return [
      same({}, { legend: true }),
      same({}, { legend: false }),
      same({}, { sonify: true }),
      same({ strings: { shown: 'x' } }, { strings: { shown: 'x' } }),
      same({ strings: { shown: 'x' } }, { strings: { shown: 'y' } }),
      same(undefined, {}),
    ];
  });
  assert.deepEqual(results, [true, false, false, true, false, true]);
});

test('React adapter: updatable options patch in place, construction-time options remount', async () => {
  const settle = async (): Promise<void> => {
    await frame();
    await frame();
  };

  await page.evaluate(() => window.__test.renderReact({ ariaLabel: 'React chart' }));
  await settle();
  const first = await page.evaluate(() => ({
    hasLegend: document.querySelector('#react-host .fc-legend') !== null,
    label: document.querySelector('#react-host .fc-surface')?.getAttribute('aria-label') ?? '',
  }));
  assert.ok(first.hasLegend, 'mounts with the default legend');
  assert.ok(first.label.includes('React chart'), first.label);

  // Same construction options, new updatable option → the same chart is patched in place.
  await page.evaluate(() => {
    const plot = document.querySelector('#react-host .fc-plot');
    if (plot) plot.id = 'plot-before';
    window.__test.renderReact({ ariaLabel: 'Patched label' });
  });
  await settle();
  const patched = await page.evaluate(() => ({
    samePlot: document.querySelector('#react-host .fc-plot')?.id === 'plot-before',
    label: document.querySelector('#react-host .fc-surface')?.getAttribute('aria-label') ?? '',
  }));
  assert.ok(patched.samePlot, 'updatable change keeps the same chart instance');
  assert.ok(patched.label.includes('Patched label'), patched.label);

  // Changing a construction-time option (legend) → the adapter remounts a fresh chart.
  await page.evaluate(() => window.__test.renderReact({ ariaLabel: 'Patched label', legend: false }));
  await settle();
  const remounted = await page.evaluate(() => ({
    samePlot: document.querySelector('#react-host .fc-plot')?.id === 'plot-before',
    hasLegend: document.querySelector('#react-host .fc-legend') !== null,
  }));
  assert.equal(remounted.samePlot, false, 'construction-time change replaces the chart');
  assert.equal(remounted.hasLegend, false, 'the remounted chart honors legend: false');

  await page.evaluate(() => window.__test.unmountReact());
  await settle();
  const empty = await page.evaluate(
    () => document.getElementById('react-host')?.childElementCount ?? -1,
  );
  assert.equal(empty, 0, 'unmount tears the chart down');
});

test('destroy() removes everything it mounted', async () => {
  await mount();
  await page.evaluate(() => window.__test.chart.destroy());
  const probe = await page.evaluate(() => ({
    plot: document.querySelector('#root .fc-plot') !== null,
    rootClass: document.getElementById('root')?.classList.contains('fc-root') ?? true,
  }));
  assert.equal(probe.plot, false, 'plot subtree removed');
  assert.equal(probe.rootClass, false, 'root class removed');
  await mount(); // leave a live chart for any test added after this one
});

// --- SR-readiness regression guard (the automated precursor to real-AT testing, per
// todos/accessibility.md). Asserts the SR-relevant DOM/ARIA wiring and the keyboard→announce
// loop survive future changes. It does NOT replace real NVDA/JAWS/VoiceOver validation. ---

test('annotations: the marked sample is reachable in the keyboard walk and announced', async () => {
  await page.evaluate(() => window.__test.mountAnnotated());
  // Initial cursor sits on index 500 (x=500) where the annotation is — focus announces it.
  const onFocus = await page.evaluate(() => {
    const s = document.querySelector('#root .fc-surface') as HTMLElement;
    s.focus();
    return (document.querySelector('#root [id^="fc-active"]') as HTMLElement)?.textContent ?? '';
  });
  assert.match(onFocus, /EVENT-X/, 'the annotated sample announces its label');
  // Stepping away drops the label from the announcement.
  const afterStep = await page.evaluate(() => {
    const s = document.querySelector('#root .fc-surface') as HTMLElement;
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return (document.querySelector('#root [id^="fc-active"]') as HTMLElement)?.textContent ?? '';
  });
  assert.doesNotMatch(afterStep, /EVENT-X/, 'a non-annotated sample does not carry the label');
  await mount();
});

test('zero-height container: warns once with a fix and does not paint at 0 height', async () => {
  const r = await page.evaluate(() => window.__test.mountZeroHeight());
  assert.ok(r.w > 0 && r.h === 0, `host should have a real width but 0 height, got ${JSON.stringify({ w: r.w, h: r.h })}`);
  // frame() declines to paint at height <= 0, so the canvas backing store stays at the 300×150
  // default (syncSize never ran with real dims) — no flash-then-collapse of a real paint.
  assert.equal(r.canvasH, 150, 'canvas is not resized/painted at zero height');
  const zeroWarns = r.warnings.filter((w) => /0 height/.test(w));
  assert.equal(zeroWarns.length, 1, `exactly one zero-height warning, got ${r.warnings.length}`);
  assert.match(zeroWarns[0], /height:100%|definite-height|explicit height/);
});

test('SR-readiness: the focusable surface exposes name, role, help, details, and description', async () => {
  await mount();
  // The data table (the SR text alternative) is built on a throttle; wait for it to settle.
  await page.waitForFunction(
    () => (document.querySelectorAll('#root .fc-table-alt thead th').length ?? 0) >= 2,
    undefined,
    { timeout: 5000 },
  );
  const a = await page.evaluate(() => {
    const s = document.querySelector('#root .fc-surface') as HTMLElement;
    const details = s.getAttribute('aria-details');
    const table = details ? document.getElementById(details) : null;
    const describedby = (s.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    return {
      role: s.getAttribute('role'),
      roledesc: s.getAttribute('aria-roledescription'),
      label: s.getAttribute('aria-label') ?? '',
      tabindex: s.getAttribute('tabindex'),
      detailsResolves: !!table && table.querySelector('table') !== null,
      describedTargetsExist: describedby.length >= 2 && describedby.every((id) => document.getElementById(id) !== null),
      liveRegion: !!s.querySelector('[aria-live="polite"]'),
      tableHasCaptionAndHeaders:
        !!table?.querySelector('caption') && (table?.querySelectorAll('thead th').length ?? 0) >= 2,
    };
  });
  assert.equal(a.role, 'application', 'surface is an application widget');
  assert.equal(a.roledesc, 'interactive chart');
  assert.equal(a.tabindex, '0', 'surface is keyboard-focusable');
  assert.match(a.label, /Left and right arrows|arrow/i, 'accessible name carries keyboard help');
  assert.ok(a.detailsResolves, 'aria-details resolves to the data table');
  assert.ok(a.describedTargetsExist, 'aria-describedby targets (summary + active sample) exist');
  assert.ok(a.liveRegion, 'a polite live region lives inside the application subtree');
  assert.ok(a.tableHasCaptionAndHeaders, 'the data table has a caption and column headers');
});

test('SR-readiness: embedded data-fcharts JSON mirrors the chart for crawlers/agents', async () => {
  await mount();
  const sum = await page.evaluate(() => {
    const node = document.querySelector('#root script[data-fcharts]');
    return node ? JSON.parse(node.textContent ?? 'null') : null;
  });
  assert.ok(sum, 'embedded summary script present');
  assert.equal(sum.series.length, 2);
  assert.ok(typeof sum.series[0].last === 'number', 'series carry queryable stats');
});

test('SR-readiness: the keyboard→announce loop populates and updates the queryable value', async () => {
  await mount();
  const seq = await page.evaluate(() => {
    const s = document.querySelector('#root .fc-surface') as HTMLElement;
    const activeEl = document.querySelector('#root [id^="fc-active"]') as HTMLElement;
    const key = (k: string): void => {
      s.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    };
    s.focus();
    const onFocus = activeEl?.textContent ?? '';
    key('ArrowRight');
    const afterArrow = activeEl?.textContent ?? '';
    key('Escape');
    return { onFocus, afterArrow };
  });
  // On focus the current sample is announced with the configured x/y labels + a series name.
  assert.match(seq.onFocus, /Alpha/, 'announces the focused series');
  assert.match(seq.onFocus, /time/, 'includes the x label');
  assert.match(seq.onFocus, /value/, 'includes the y label');
  // Arrow movement changes the queried value (the loop is live, not static).
  assert.notEqual(seq.afterArrow, seq.onFocus, 'ArrowRight moves the announced sample');
  // Escape clears the cursor → the queryable value empties.
  const cleared = await page.evaluate(
    () => (document.querySelector('#root [id^="fc-active"]') as HTMLElement)?.textContent ?? 'x',
  );
  assert.equal(cleared, '', 'Escape dismisses the cursor and empties the queryable value');
});
