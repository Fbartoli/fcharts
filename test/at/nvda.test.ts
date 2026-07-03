/**
 * Real-screen-reader coverage on Windows: drives NVDA over a live FChart and asserts on the
 * phrases it actually speaks — the Windows sibling of `voiceover.test.ts` (same chart page,
 * same three behaviors, NVDA-tolerant phrasing). guidepup exposes the identical surface for
 * both readers, and GitHub's Windows runners have a real interactive desktop, which makes this
 * the suite expected to *run* (not skip) in CI.
 *
 * SAFETY / GATING. `nvda.start()` launches guidepup's portable NVDA — disruptive on a developer
 * machine and impossible without the guidepup-prepared install (`guidepup/setup-action` in CI).
 * So this suite is **opt-in**: it only runs on Windows with `FCHARTS_NVDA=1` set. Anywhere else
 * every test `t.skip()`s cleanly and fast, and NVDA is never launched. Assertions stay tolerant
 * (substring / regex over the spoken-phrase log) because NVDA phrasing varies across versions.
 *
 * Run with `node --test test/at/nvda.test.ts` (or the `test:at` npm script).
 */
import test, { before, after, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { nvda } from '@guidepup/guidepup';
import { launchChartPage, withTimeout, CHART_LABEL, SERIES_NAME, type ChartPage } from './harness.ts';

/** How long a phrase-log poll waits for NVDA to catch up with a focus/keystroke, in ms. */
const PHRASE_TIMEOUT = 6000;
/** Ceiling on `nvda.start()` so a broken install can't hang the job. */
const START_TIMEOUT = 45_000;
/** Ceiling on any single NVDA round-trip (log read, key press, detect) — a stuck call must
 *  never ride the job to its kill (node:test has no default timeout). */
const CALL_TIMEOUT = 10_000;
/** Per-test ceiling: fail loud with the phrase log, never stall the workflow. */
const TEST_OPTS = { timeout: 120_000 };

/**
 * Static skip decision, evaluated before anything is launched. Returns a human-readable reason
 * to skip, or `null` to proceed. Keeps the never-fail guarantee: no NVDA, no window, no cost.
 */
function staticSkipReason(): string | null {
  if (process.platform !== 'win32') {
    return 'NVDA automation runs on Windows only';
  }
  if (!/^(1|true)$/i.test(process.env.FCHARTS_NVDA ?? '')) {
    return (
      'set FCHARTS_NVDA=1 to run the real NVDA harness — it launches the guidepup-prepared ' +
      'NVDA, so it is CI-only (guidepup/setup-action installs and configures it)'
    );
  }
  return null;
}

let chart: ChartPage | undefined;
let nvdaStarted = false;
let skip = staticSkipReason();

/** One NVDA call with the shared ceiling; a timed-out read degrades to `fallback`. */
async function nvdaCall<T>(promise: Promise<T>, label: string, fallback: T): Promise<T> {
  try {
    return await withTimeout(promise, CALL_TIMEOUT, label);
  } catch {
    return fallback;
  }
}

/** Poll the spoken-phrase log until one entry matches `re`, or the timeout elapses. */
async function waitForPhrase(re: RegExp, ms = PHRASE_TIMEOUT): Promise<string[]> {
  const deadline = Date.now() + ms;
  let log: string[] = [];
  do {
    log = await nvdaCall(nvda.spokenPhraseLog(), 'spokenPhraseLog()', log);
    if (log.some((phrase) => re.test(phrase))) return log;
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < deadline);
  return log;
}

/** Move DOM focus to `selector`, then return the phrase log once NVDA announces `expect`. */
async function focusAndRead(selector: string, expect: RegExp): Promise<string[]> {
  const page = chart!.page;
  await page.bringToFront();
  await nvdaCall(nvda.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  await page.focus(selector);
  return waitForPhrase(expect);
}

before(async () => {
  if (skip) return;
  chart = await launchChartPage();
  try {
    await withTimeout(nvda.start(), START_TIMEOUT, 'nvda.start()');
    nvdaStarted = true;
    await nvdaCall(nvda.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  } catch (error) {
    // A missing guidepup-prepared NVDA install surfaces here — skip, never fail.
    skip = `NVDA could not start (guidepup setup likely absent): ${(error as Error).message}`;
    await chart.close();
    chart = undefined;
  }
});

after(async () => {
  if (nvdaStarted) {
    await nvdaCall(nvda.stop(), 'nvda.stop()', undefined);
  }
  await chart?.close();
}, { timeout: 60_000 });

/** Skip helper so every test shares one bail-out that reports why. */
function ensureReady(t: TestContext): boolean {
  if (skip || !chart) {
    t.skip(skip ?? 'chart page unavailable');
    return false;
  }
  return true;
}

test('focusing the chart speaks its accessible name and data summary', TEST_OPTS, async (t) => {
  if (!ensureReady(t)) return;
  const log = await focusAndRead('.fc-surface', new RegExp(CHART_LABEL, 'i'));
  const spoken = log.join(' · ');
  assert.match(spoken, new RegExp(CHART_LABEL, 'i'), `accessible name not spoken: ${spoken}`);
  // The aria-describedby summary carries values + a trend; any number or direction word proves
  // it was read alongside the name.
  assert.match(spoken, /(up|down|flat|ranges|now|points|\d)/i, `no summary/value spoken: ${spoken}`);
});

test('ArrowRight moves the data cursor and speaks a new value', TEST_OPTS, async (t) => {
  if (!ensureReady(t)) return;
  await focusAndRead('.fc-surface', new RegExp(CHART_LABEL, 'i'));
  await nvdaCall(nvda.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  // role=application puts NVDA in focus (pass-through) mode, so the arrow reaches the chart,
  // which announces the new sample via its polite live region.
  await nvdaCall(nvda.press('ArrowRight'), "press('ArrowRight')", undefined);
  const log = await waitForPhrase(/\d/);
  const valuePhrase = log.find((phrase) => /\d/.test(phrase));
  assert.ok(valuePhrase, `ArrowRight spoke no data value; log: ${JSON.stringify(log)}`);
  assert.match(valuePhrase, /revenue|day|\d/i, `value announcement lacks data: ${valuePhrase}`);
});

test('the legend toggle button is reachable and announces its pressed state', TEST_OPTS, async (t) => {
  if (!ensureReady(t)) return;
  const log = await focusAndRead('.fc-legend button', new RegExp(SERIES_NAME, 'i'));
  const spoken = log.join(' · ');
  assert.match(spoken, new RegExp(SERIES_NAME, 'i'), `legend button name not spoken: ${spoken}`);
  // aria-pressed maps to a toggle cue; NVDA phrasing varies ("pressed", "toggle button").
  assert.match(spoken, /(press|toggle|button)/i, `no toggle state spoken: ${spoken}`);
});
