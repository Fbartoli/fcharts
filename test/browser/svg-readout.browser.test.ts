/**
 * Browser-level tests for `attachReadout` — the styled DOM hover tooltip that upgrades the static
 * pure-SVG charts to `FChart`-quality readouts. DOM-only behavior (pointer events, fixed-box
 * placement, `<title>` lifting) the node unit tests can't reach.
 *
 * Same harness as `fchart.browser.test.ts`: a temp HTML entry at the project root so Vite
 * transforms `/src/index.ts`, headless Chromium via Playwright, a `window.__ready` handshake.
 * Run with `pnpm test:browser`.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

interface ReadoutState {
  inDom: boolean;
  shown: boolean;
  name: string;
  swatch: string;
}
interface HitState {
  hasTitle: boolean;
  label: string | null;
  role: string | null;
  ariaLabel: string | null;
}

declare global {
  interface Window {
    __readout: {
      setup(): boolean;
      hitCenter(): { x: number; y: number };
      readout(): ReadoutState;
      hit(): HitState;
      teardown(): {
        readoutInDom: boolean;
        titleRestored: boolean;
        labelAttr: string | null;
        roleAttr: string | null;
        ariaLabelAttr: string | null;
      };
      dispose?: () => void;
    };
    __ready?: boolean;
  }
}

const ENTRY = resolve(process.cwd(), '.fc-readout-test-entry.html');

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}</style></head>
<body>
<script type="module">
import { buildScatterSVG, attachReadout } from '/src/index.ts';
window.__readout = {
  setup() {
    const wrap = document.createElement('div');
    wrap.id = 'charts';
    wrap.style.cssText = 'position:absolute;left:60px;top:60px;width:360px';
    // An 'over' point → STATUS_COLORS.over (#dc2626); hoverRadius gives it a fat .fc-hit halo.
    wrap.innerHTML = buildScatterSVG(
      { points: [{ x: 5, row: 'Core', status: 'over', label: 'pos-1 · APY 5%' }], rows: ['Core'] },
      { width: 320, hoverRadius: 18 },
    );
    document.body.append(wrap);
    window.__readout.dispose = attachReadout(wrap);
    return true;
  },
  hitCenter() {
    const hit = document.querySelector('#charts .fc-hit');
    const r = hit.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  },
  readout() {
    const el = document.querySelector('.fc-readout');
    return {
      inDom: !!el,
      shown: !!el && el.classList.contains('fc-show'),
      name: el ? (el.querySelector('.fc-readout-series span:last-child')?.textContent ?? '') : '',
      swatch: el ? (el.querySelector('.fc-readout-swatch')?.style.background ?? '') : '',
    };
  },
  hit() {
    const hit = document.querySelector('#charts .fc-hit');
    return {
      hasTitle: !!hit.querySelector('title'),
      label: hit.getAttribute('data-fc-label'),
      role: hit.getAttribute('role'),
      ariaLabel: hit.getAttribute('aria-label'),
    };
  },
  teardown() {
    window.__readout.dispose();
    const hit = document.querySelector('#charts .fc-hit');
    return {
      readoutInDom: !!document.querySelector('.fc-readout'),
      titleRestored: !!hit.querySelector('title'),
      labelAttr: hit.getAttribute('data-fc-label'),
      roleAttr: hit.getAttribute('role'),
      ariaLabelAttr: hit.getAttribute('aria-label'),
    };
  },
};
window.__ready = true;
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
  await page.goto(`${url}.fc-readout-test-entry.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 30_000 });
});

after(async () => {
  await browser?.close();
  await server?.close();
  rmSync(ENTRY, { force: true });
});

test('attachReadout: lifts the <title> on attach so the native tooltip cannot also fire', async () => {
  await page.evaluate(() => window.__readout.setup());
  const hit = await page.evaluate(() => window.__readout.hit());
  assert.equal(hit.hasTitle, false, '<title> removed from the hit-target on attach');
  assert.equal(hit.label, 'pos-1 · APY 5%', 'label lifted into data-fc-label');
  // Removing <title> must not strip the accessible name — it moves to role=img + aria-label.
  assert.equal(hit.role, 'img', 'hit-target stays exposed to AT');
  assert.equal(hit.ariaLabel, 'pos-1 · APY 5%', 'accessible name preserved through the lift');
});

test('attachReadout: hovering a hit-target shows the styled box with its label + swatch', async () => {
  const c = await page.evaluate(() => window.__readout.hitCenter());
  await page.mouse.move(c.x, c.y);
  const r = await page.evaluate(() => window.__readout.readout());
  assert.equal(r.inDom, true, 'a single shared .fc-readout box exists');
  assert.equal(r.shown, true, 'box is shown on hover');
  assert.equal(r.name, 'pos-1 · APY 5%', 'label comes from the lifted <title>');
  assert.match(r.swatch, /220,\s*38,\s*38/, 'swatch background is the dot color (#dc2626 → rgb)');
});

test('attachReadout: moving off the chart hides the box', async () => {
  await page.mouse.move(5, 5); // outside #charts → pointerleave
  const r = await page.evaluate(() => window.__readout.readout());
  assert.equal(r.shown, false, 'box hidden after leaving the chart');
  assert.equal(r.inDom, true, 'box stays in the DOM (just hidden) for reuse');
});

test('attachReadout: disposer removes the box, listeners, and restores the <title>', async () => {
  const state = await page.evaluate(() => window.__readout.teardown());
  assert.equal(state.readoutInDom, false, 'box removed on dispose');
  assert.equal(state.titleRestored, true, '<title> restored to the hit-target');
  assert.equal(state.labelAttr, null, 'data-fc-label cleaned up');
  assert.equal(state.roleAttr, null, 'role removed once the <title> is back');
  assert.equal(state.ariaLabelAttr, null, 'aria-label removed once the <title> is back');
});
