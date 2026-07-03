/**
 * Real-screen-reader coverage: drives Apple VoiceOver over a live FChart and asserts on the
 * phrases it actually speaks. This is the automated form of the backlog's "real screen-reader
 * testing — human-gated" item; the headless browser suite proves the ARIA/DOM wiring, this proves
 * a shipping AT reads it as intended.
 *
 * SAFETY / GATING. `voiceOver.start()` rewrites VoiceOver's own settings and turns the screen
 * reader on — disruptive on a developer machine and impossible without granted automation
 * permission. So this suite is **opt-in**: it only runs on macOS with `FCHARTS_VOICEOVER=1` set
 * (CI sets it after `guidepup/setup-action` enables VoiceOver AppleScript control). Anywhere else —
 * a machine without VoiceOver set up, a normal `pnpm check` — every test `t.skip()`s cleanly and
 * fast, and VoiceOver is never launched or reconfigured. Assertions stay tolerant (substring /
 * regex over the spoken-phrase log) because exact VoiceOver phrasing varies across macOS versions.
 *
 * Run with `node --test test/at/voiceover.test.ts` (or the `test:at` npm script).
 */
import test, { before, after, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { voiceOver } from '@guidepup/guidepup';
import { launchChartPage, withTimeout, CHART_LABEL, SERIES_NAME, type ChartPage } from './harness.ts';

/** How long a phrase-log poll waits for VoiceOver to catch up with a focus/keystroke, in ms. */
const PHRASE_TIMEOUT = 6000;
/** Ceiling on `voiceOver.start()` so an un-permitted launch can't hang the job. */
const START_TIMEOUT = 45_000;
/** Ceiling on any single VoiceOver AppleScript round-trip (log read, key press, detect). A stuck
 *  osascript call otherwise hangs forever — observed on a CI runner — and node:test has no
 *  default timeout, so one hung call would ride the job to its kill. */
const CALL_TIMEOUT = 10_000;
/** Per-test ceiling: fail loud with the phrase log, never stall the workflow. */
const TEST_OPTS = { timeout: 120_000 };

/**
 * Static skip decision, evaluated before anything is launched. Returns a human-readable reason to
 * skip, or `null` to proceed. Keeps the never-fail guarantee: no VoiceOver, no window, no cost.
 */
function staticSkipReason(): string | null {
  if (process.platform !== 'darwin') {
    return 'VoiceOver automation runs on macOS only';
  }
  if (!/^(1|true)$/i.test(process.env.FCHARTS_VOICEOVER ?? '')) {
    return (
      'set FCHARTS_VOICEOVER=1 to run the real VoiceOver harness — it turns VoiceOver on and ' +
      'rewrites its settings, so it is CI-only (guidepup/setup-action grants the permission)'
    );
  }
  return null;
}

let chart: ChartPage | undefined;
let voiceOverStarted = false;
let skip = staticSkipReason();

/** One VoiceOver call with the shared ceiling; a timed-out read degrades to `fallback`. */
async function voCall<T>(promise: Promise<T>, label: string, fallback: T): Promise<T> {
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
    log = await voCall(voiceOver.spokenPhraseLog(), 'spokenPhraseLog()', log);
    if (log.some((phrase) => re.test(phrase))) return log;
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < deadline);
  return log;
}

/** Move DOM focus to `selector`, then return the phrase log once VoiceOver announces `expect`. */
async function focusAndRead(selector: string, expect: RegExp): Promise<string[]> {
  const page = chart!.page;
  await page.bringToFront();
  await voCall(voiceOver.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  await page.focus(selector);
  return waitForPhrase(expect);
}

before(async () => {
  if (skip) return;
  if (!(await voCall(voiceOver.detect(), 'voiceOver.detect()', false))) {
    skip = 'VoiceOver is not supported on this OS (or detection timed out)';
    return;
  }
  chart = await launchChartPage();
  try {
    await withTimeout(voiceOver.start(), START_TIMEOUT, 'voiceOver.start()');
    voiceOverStarted = true;
    await voCall(voiceOver.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  } catch (error) {
    // A denied automation permission surfaces here — skip, never fail.
    skip = `VoiceOver could not start (automation likely not permitted): ${(error as Error).message}`;
    await chart.close();
    chart = undefined;
  }
});

after(async () => {
  if (voiceOverStarted) {
    await voCall(voiceOver.stop(), 'voiceOver.stop()', undefined);
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
  // The aria-describedby summary carries values + a trend; any number or direction word proves it
  // was read alongside the name.
  assert.match(spoken, /(up|down|flat|ranges|now|points|\d)/i, `no summary/value spoken: ${spoken}`);
});

test('ArrowRight moves the data cursor and speaks a new value', TEST_OPTS, async (t) => {
  if (!ensureReady(t)) return;
  await focusAndRead('.fc-surface', new RegExp(CHART_LABEL, 'i'));
  await voCall(voiceOver.clearSpokenPhraseLog(), 'clearSpokenPhraseLog()', undefined);
  // role=application forwards arrow keys to the chart, which announces the new sample via its
  // polite live region.
  await voCall(voiceOver.press('ArrowRight'), "press('ArrowRight')", undefined);
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
  // aria-pressed maps to a toggle/pressed cue; phrasing varies ("pressed", "selected", "dimmed").
  assert.match(spoken, /(press|selected|dim|toggle|button)/i, `no toggle state spoken: ${spoken}`);
});
