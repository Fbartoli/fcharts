/**
 * Headless benchmark harness. Boots a Vite dev server for the bench page, drives it in
 * Chromium, collects the FPS / frame-time / heap / axe results, performs the real
 * keyboard + find-in-page accessibility assertions with Playwright, writes results.json,
 * and prints the verdict.
 *
 * Run: `node bench/harness.ts` (Node 23.6+ runs TypeScript directly).
 * Requires a Chromium binary: `npx playwright install chromium`.
 *
 * CI mode (`FCHARTS_BENCH_CI=1`, perf.yml): exits non-zero when a flake-resistant subset of
 * the acceptance criteria fails — the frame-cost budget (<16 ms, ~200× headroom over the
 * measured cost, so runner speed can't flake it), the 250k/10k scaling ratio (relative, so
 * machine-speed independent), and the deterministic a11y assertions. The one criterion that
 * depends on OTHER libraries' behavior under headless rAF throttling
 * (`fchartUniquelyFastAndAccessible`) is reported but never gates CI.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { runConformance, countStatuses } from '../src/compliance/conformance.ts';

const here = dirname(fileURLToPath(import.meta.url));
const FCHART = '#cell-fchart';

const BROWSERS: Record<string, BrowserType> = { chromium, firefox, webkit };
const browserName = process.argv[2] ?? 'chromium';

interface Acceptance {
  liveRegionChangesOnArrow: boolean;
  tickLabelFindable: boolean;
  dataValueFindable: boolean;
  fchartFrameUnder16ms: boolean;
  scalingRatioUnder1_5x: boolean;
  fchartUniquelyFastAndAccessible: boolean;
}

async function startServer(): Promise<ViteDevServer> {
  const server = await createServer({ configFile: resolve(here, '..', 'vite.config.ts') });
  await server.listen();
  return server;
}

async function keyboardAccessibility(page: Page): Promise<{ changed: boolean }> {
  const liveSel = `${FCHART} [aria-live]`;
  await page.focus(`${FCHART} [role="application"]`);
  await page.waitForTimeout(60);
  const before = (await page.locator(liveSel).textContent()) ?? '';
  await page.keyboard.press('End'); // jump — guaranteed to change the announced sample
  await page.waitForTimeout(60);
  await page.keyboard.press('ArrowLeft');
  // Announcements are debounced (~100ms) to avoid flooding; wait past the window.
  await page.waitForTimeout(260);
  const after = (await page.locator(liveSel).textContent()) ?? '';
  return { changed: before !== after && after.trim().length > 0 };
}

/** Test REAL find-in-page (window.find) for a tick label and a data value, not DOM presence. */
async function findability(page: Page): Promise<{ tick: boolean; value: boolean }> {
  const targets = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const tick = root?.querySelector('.fc-tick')?.textContent?.trim() ?? '';
    const value = root?.querySelector('.fc-table-alt td')?.textContent?.trim() ?? '';
    return { tick, value };
  }, FCHART);
  const find = (q: string): Promise<boolean> =>
    page.evaluate((s) => {
      if (!s) return false;
      const w = window as unknown as {
        find?: (s: string) => boolean;
        getSelection?: () => Selection | null;
      };
      w.getSelection?.()?.removeAllRanges?.();
      return typeof w.find === 'function' ? w.find(s) : false;
    }, q);
  return { tick: await find(targets.tick), value: await find(targets.value) };
}

// Smooth = renders within the 60fps frame budget (frame cost < 16ms; the spec's criterion).
// Sustained FPS is environment-dependent (headless rAF throttling), so it's only a
// secondary witness — a deferred-redraw lib like uPlot reports an inflated loop rate.
function smooth(fps: number, frameMs: number): boolean {
  return frameMs < 16 || fps >= 55;
}

// Re-derived here (kept in sync with main.ts) so the harness can judge without importing DOM code.
interface Row {
  id: string;
  label: string;
  fps: number;
  frameMs: number;
  axe: { serious: number };
  a11y: { liveRegion: boolean; keyboardCursor: boolean; textAlternative: boolean };
}
function accessible(r: Row): boolean {
  const a = r.a11y;
  return r.axe.serious === 0 && a.liveRegion && a.keyboardCursor && a.textAlternative;
}

async function main(): Promise<void> {
  const browserType = BROWSERS[browserName];
  if (!browserType) throw new Error(`Unknown browser "${browserName}" (chromium|firefox|webkit)`);

  const server = await startServer();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a local URL');
  console.log(`bench: serving ${url} — browser: ${browserName}`);

  let browser: Browser | undefined;
  try {
    // Heap precision flags are Chromium-only; other engines report heap as n/a.
    const launchOpts =
      browserName === 'chromium'
        ? { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] }
        : {};
    browser = await browserType.launch(launchOpts);
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      // Headless Firefox leaves navigator.language unset, which makes uPlot build an
      // Intl formatter from the string "undefined" and throw. A real locale fixes it.
      locale: 'en-US',
    });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench?.ready === true, undefined, {
      timeout: 30_000,
    });

    console.log('bench: running measurements (this takes ~30s)…');
    const results = await page.evaluate(() => window.__bench!.runAll(5000));

    const kbd = await keyboardAccessibility(page);
    const find = await findability(page);

    // Run the extracted conformance engine against the live fcharts cell — the same checks the
    // audit CLI uses (no drift between "the benchmark says accessible" and "the ACR says so").
    // Informational here (axe runs per-renderer above); contrast uses the cell's effective bg.
    const pageBg = await page.evaluate((sel) => {
      let el: Element | null = document.querySelector(sel);
      while (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        el = el.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }, FCHART);
    const conformance = await runConformance(page, FCHART, { background: pageBg });
    const conf = countStatuses(conformance);
    console.log(`\n=== Conformance engine (fcharts @ bg ${pageBg}) ===`);
    console.log(`  ${conf.pass} pass · ${conf.fail} fail · ${conf.na} n/a`);
    for (const r of conformance.results.filter((res) => res.status === 'fail')) {
      console.log(`  ✗ ${r.id}: ${r.detail}`);
    }

    const rows = results.headline as Row[];
    const sl = rows.find((r) => r.id === 'fchart');
    const ratio =
      results.scaling.length >= 2
        ? results.scaling[results.scaling.length - 1].frameMs /
          Math.max(1e-6, results.scaling[0].frameMs)
        : Infinity;

    const slBoth = !!sl && smooth(sl.fps, sl.frameMs) && accessible(sl);
    const othersBoth = rows.filter(
      (r) => r.id !== 'fchart' && smooth(r.fps, r.frameMs) && accessible(r),
    );

    const acceptance: Acceptance = {
      liveRegionChangesOnArrow: kbd.changed,
      tickLabelFindable: find.tick,
      dataValueFindable: find.value,
      fchartFrameUnder16ms: !!sl && sl.frameMs < 16,
      scalingRatioUnder1_5x: ratio < 1.5,
      fchartUniquelyFastAndAccessible: slBoth && othersBoth.length === 0,
    };

    const stamp = new Date().toISOString();
    const full = { generatedAt: stamp, browser: browserName, ...results, acceptance, conformance };
    const fileName = browserName === 'chromium' ? 'results.json' : `results-${browserName}.json`;
    const outPath = resolve(here, fileName);
    writeFileSync(outPath, JSON.stringify(full, null, 2));

    printSummary(rows, results.scaling, ratio, acceptance, outPath);
    gateForCi(acceptance);
  } finally {
    await browser?.close();
    await server.close();
  }
}

function printSummary(
  rows: Row[],
  scaling: { n: number; frameMs: number }[],
  ratio: number,
  a: Acceptance,
  outPath: string,
): void {
  console.log(`\n=== Headline — ${browserName} (100k × 3, 5s pan/zoom) ===`);
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(22)} ${r.fps.toFixed(0).padStart(3)}fps  ` +
        `${r.frameMs.toFixed(3).padStart(8)}ms/frame  axe-serious=${r.axe.serious}  ` +
        `kbd=${yn(r.a11y.keyboardCursor)} live=${yn(r.a11y.liveRegion)} ` +
        `table=${yn(r.a11y.textAlternative)}  ` +
        `${smooth(r.fps, r.frameMs) && accessible(r) ? '✓ BOTH' : ''}`,
    );
  }
  console.log('\n=== fcharts frame cost vs N ===');
  for (const s of scaling) {
    console.log(`  ${String(s.n).padStart(7)} pts  ${s.frameMs.toFixed(3)}ms/frame`);
  }
  console.log(`  250k/10k ratio: ${ratio.toFixed(2)}× (target < 1.5×)`);

  console.log('\n=== Acceptance ===');
  for (const [k, v] of Object.entries(a)) console.log(`  ${yn(v)} ${k}`);
  const verdict = a.fchartUniquelyFastAndAccessible && a.liveRegionChangesOnArrow;
  const tag = verdict ? '✓ THESIS HELD' : '✗ THESIS NOT FULLY MET';
  console.log(`\n${tag} — results written to ${outPath}\n`);
}

const yn = (b: boolean): string => (b ? '✓' : '✗');

/** The perf-budget criteria CI gates on: robust to shared-runner speed, not to regressions. */
const CI_GATED: readonly (keyof Acceptance)[] = [
  'fchartFrameUnder16ms',
  'scalingRatioUnder1_5x',
  'liveRegionChangesOnArrow',
  'tickLabelFindable',
  'dataValueFindable',
];

/** In CI mode, fail the process when a gated criterion regressed; a no-op otherwise. */
function gateForCi(a: Acceptance): void {
  if (!/^(1|true)$/i.test(process.env.FCHARTS_BENCH_CI ?? '')) return;
  const failed = CI_GATED.filter((k) => !a[k]);
  if (failed.length === 0) {
    console.log('✓ perf budget holds (CI-gated criteria all pass)');
    return;
  }
  console.error(`\n✗ PERF BUDGET REGRESSION — failed: ${failed.join(', ')}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
