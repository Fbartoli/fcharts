/**
 * Shared plumbing for the real-screen-reader harnesses (VoiceOver on macOS, NVDA on Windows).
 *
 * Serves one small FChart from a Vite dev server into a **headed** Chromium window — a screen
 * reader can only read a real, on-screen window, so unlike the headless browser suite this page
 * must be visible. The chart uses a distinctive accessible name and a clear upward trend so the
 * spoken phrases are easy to assert on tolerantly (substrings / regexes, never exact strings).
 *
 * Kept separate from `voiceover.test.ts` so the test file is just the gate + the three
 * assertions; everything environment-shaped (server, browser, timeouts) lives here.
 */
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

/** Accessible-name text set on the chart; asserted verbatim in the focus announcement. */
export const CHART_LABEL = 'Revenue over time';
/** Series name; asserted in both the data-cursor and legend-button announcements. */
export const SERIES_NAME = 'Revenue';

const ENTRY_FILE = '.fc-at-entry.html';

/** A single line chart with a monotonic upward trend, so the summary carries a clear direction. */
const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>fcharts AT harness</title>
<style>html,body{margin:0;background:#fff}#root{width:720px;height:360px;margin:24px}</style></head>
<body><div id="root"></div>
<script type="module">
import { FChart } from '/src/index.ts';
const N = 40;
const x = Float64Array.from({ length: N }, (_, i) => i);
const y = Float64Array.from(x, (i) => 100 + i * 3 + Math.sin(i / 5) * 4);
new FChart(document.getElementById('root'), {
  series: [{ name: ${JSON.stringify(SERIES_NAME)} }],
  data: { x, y: [y] },
  options: { ariaLabel: ${JSON.stringify(CHART_LABEL)}, xLabel: 'day', yLabel: 'revenue' },
}).renderSync();
requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
</script></body></html>`;

export interface ChartPage {
  page: Page;
  /** Tear down the browser, the dev server, and the temp entry file. */
  close(): Promise<void>;
}

/**
 * Boot a headed Chromium showing the harness chart and wait for it to finish its first paint.
 *
 * @returns The Playwright page plus a `close()` that releases every resource it opened.
 */
export async function launchChartPage(): Promise<ChartPage> {
  const entry = resolve(process.cwd(), ENTRY_FILE);
  writeFileSync(entry, PAGE_HTML);

  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  const close = async (): Promise<void> => {
    await browser?.close();
    await server?.close();
    rmSync(entry, { force: true });
  };

  try {
    server = await createServer({ root: process.cwd(), logLevel: 'silent' });
    await server.listen();
    const url = server.resolvedUrls?.local?.[0];
    if (!url) throw new Error('Vite did not report a local URL');

    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, locale: 'en-US' });
    await page.goto(`${url}${ENTRY_FILE}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 30_000 });
    await page.bringToFront();
    return { page, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Reject if `promise` has not settled within `ms`, so a hung VoiceOver launch can't stall CI. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

declare global {
  interface Window {
    __ready?: boolean;
  }
}
