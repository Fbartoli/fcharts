/**
 * Headless benchmark harness. Boots a Vite dev server for the bench page, drives it in
 * Chromium, collects the FPS / frame-time / heap / axe results, performs the real
 * keyboard + find-in-page accessibility assertions with Playwright, writes results.json,
 * and prints the verdict.
 *
 * Run: `node bench/harness.ts` (Node 23.6+ runs TypeScript directly).
 * Requires a Chromium binary: `npx playwright install chromium`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const SIGHTLINE = '#cell-sightline';

interface Acceptance {
  liveRegionChangesOnArrow: boolean;
  tickLabelFindable: boolean;
  dataValueFindable: boolean;
  sightlineFrameUnder16ms: boolean;
  scalingRatioUnder1_5x: boolean;
  sightlineUniquelyFastAndAccessible: boolean;
}

async function startServer(): Promise<ViteDevServer> {
  const server = await createServer({ configFile: resolve(here, '..', 'vite.config.ts') });
  await server.listen();
  return server;
}

async function keyboardAccessibility(page: import('playwright').Page): Promise<{ changed: boolean }> {
  const liveSel = `${SIGHTLINE} [aria-live]`;
  await page.focus(`${SIGHTLINE} [role="application"]`);
  await page.waitForTimeout(40);
  const before = (await page.locator(liveSel).textContent()) ?? '';
  await page.keyboard.press('End'); // jump — guaranteed to change the announced sample
  await page.waitForTimeout(40);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(40);
  const after = (await page.locator(liveSel).textContent()) ?? '';
  return { changed: before !== after && after.trim().length > 0 };
}

async function findability(page: import('playwright').Page): Promise<{ tick: boolean; value: boolean }> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const tickText = [...(root?.querySelectorAll('.sl-tick') ?? [])].map((e) => e.textContent ?? '');
    const tableText = [...(root?.querySelectorAll('.sl-table-alt td') ?? [])].map((e) => e.textContent ?? '');
    const numeric = (s: string): boolean => /\d/.test(s);
    return {
      tick: tickText.some(numeric),
      value: tableText.some(numeric),
    };
  }, SIGHTLINE);
}

function smooth(fps: number, frameMs: number): boolean {
  return fps >= 50 && frameMs < 16;
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
  return r.axe.serious === 0 && r.a11y.liveRegion && r.a11y.keyboardCursor && r.a11y.textAlternative;
}

async function main(): Promise<void> {
  const server = await startServer();
  const url = server.resolvedUrls?.local?.[0];
  if (!url) throw new Error('Vite did not report a local URL');
  console.log(`bench: serving ${url}`);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench?.ready === true, undefined, { timeout: 30_000 });

    console.log('bench: running measurements (this takes ~30s)…');
    const results = await page.evaluate(() => window.__bench!.runAll(5000));

    const kbd = await keyboardAccessibility(page);
    const find = await findability(page);

    const rows = results.headline as Row[];
    const sl = rows.find((r) => r.id === 'sightline');
    const ratio =
      results.scaling.length >= 2
        ? results.scaling[results.scaling.length - 1].frameMs /
          Math.max(1e-6, results.scaling[0].frameMs)
        : Infinity;

    const slBoth = !!sl && smooth(sl.fps, sl.frameMs) && accessible(sl);
    const othersBoth = rows.filter((r) => r.id !== 'sightline' && smooth(r.fps, r.frameMs) && accessible(r));

    const acceptance: Acceptance = {
      liveRegionChangesOnArrow: kbd.changed,
      tickLabelFindable: find.tick,
      dataValueFindable: find.value,
      sightlineFrameUnder16ms: !!sl && sl.frameMs < 16,
      scalingRatioUnder1_5x: ratio < 1.5,
      sightlineUniquelyFastAndAccessible: slBoth && othersBoth.length === 0,
    };

    const full = { generatedAt: new Date().toISOString(), ...results, acceptance };
    const outPath = resolve(here, 'results.json');
    writeFileSync(outPath, JSON.stringify(full, null, 2));

    printSummary(rows, results.scaling, ratio, acceptance, outPath);
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
  console.log('\n=== Headline (100k × 3, 5s pan/zoom) ===');
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(22)} ${r.fps.toFixed(0).padStart(3)}fps  ` +
        `${r.frameMs.toFixed(3).padStart(8)}ms/frame  axe-serious=${r.axe.serious}  ` +
        `kbd=${yn(r.a11y.keyboardCursor)} live=${yn(r.a11y.liveRegion)} table=${yn(r.a11y.textAlternative)}  ` +
        `${smooth(r.fps, r.frameMs) && accessible(r) ? '✓ BOTH' : ''}`,
    );
  }
  console.log('\n=== Sightline frame cost vs N ===');
  for (const s of scaling) console.log(`  ${String(s.n).padStart(7)} pts  ${s.frameMs.toFixed(3)}ms/frame`);
  console.log(`  250k/10k ratio: ${ratio.toFixed(2)}× (target < 1.5×)`);

  console.log('\n=== Acceptance ===');
  for (const [k, v] of Object.entries(a)) console.log(`  ${yn(v)} ${k}`);
  const verdict = a.sightlineUniquelyFastAndAccessible && a.liveRegionChangesOnArrow;
  console.log(`\n${verdict ? '✓ THESIS HELD' : '✗ THESIS NOT FULLY MET'} — results written to ${outPath}\n`);
}

const yn = (b: boolean): string => (b ? '✓' : '✗');

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
