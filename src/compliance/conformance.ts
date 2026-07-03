/**
 * Conformance engine — the live-page check battery (conformance-test-plan.md §3).
 *
 * Drives a real fcharts instance in a browser (Playwright) and re-proves each automatable
 * WCAG claim from the evidence map — the functional layer axe cannot see. Returns a structured
 * `CheckReport` that `reduceToVerdicts` (mapping.ts) folds against the committed baseline.
 *
 * Playwright is a DEV/PEER dependency of the Compliance Pack — never imported by the core
 * renderer. Pure helpers (contrast, mapping) live in sibling modules and need no browser.
 */
import type { Page } from 'playwright';
import type { AxeViolation, CheckReport, CheckResult, CheckStatus } from './types.ts';
import { ratioOf, AA_NORMAL, AA_NON_TEXT } from './contrast.ts';

export interface ConformanceOptions {
  /** Documented host background for hybrid contrast checks. Default '#ffffff'. */
  background?: string;
  /** axe-core source (e.g. read from node_modules/axe-core/axe.min.js) to inject + run. */
  axeSource?: string;
  /** Debounce window for the live-region announcement (ms). Default 260. */
  announceWaitMs?: number;
}

const ok = (id: string, sc: string[], detail = ''): CheckResult => ({ id, status: 'pass', sc, detail });
const no = (id: string, sc: string[], detail: string): CheckResult => ({ id, status: 'fail', sc, detail });
const na = (id: string, sc: string[], detail: string): CheckResult => ({ id, status: 'na', sc, detail });

const status = (cond: boolean, id: string, sc: string[], failDetail: string, passDetail = ''): CheckResult =>
  cond ? ok(id, sc, passDetail) : no(id, sc, failDetail);

/** The keyboard/live-region checks as (id, sc) — used to fail-soft when no focusable surface
 * exists (a bare external chart has nothing to receive keyboard focus, so every claim fails). */
const KEYBOARD_CHECKS: ReadonlyArray<readonly [string, string[]]> = [
  ['keyboard-announce', ['2.1.1', '4.1.3']],
  ['context-stability', ['3.2.1', '3.2.2']],
  ['active-value', ['4.1.2']],
  ['keyboard-zoom', ['2.1.1']],
  ['escape-dismiss', ['1.4.13']],
  ['no-keyboard-trap', ['2.1.2']],
];

/** Map axe wcag tags ("wcag143") to SC numbers ("1.4.3"). Best-effort; ignores version tags. */
function scFromAxeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const m = t.match(/^wcag(\d)(\d)(\d{1,2})$/);
    if (m) out.push(`${m[1]}.${m[2]}.${Number(m[3])}`);
  }
  // A serious/critical violation whose tags don't resolve to a numeric SC still fails the
  // `axe-serious` check (which the gate honors directly) — but warn so per-SC attribution gaps
  // are visible rather than silent.
  if (out.length === 0 && tags.length > 0) {
    console.warn(`fcharts-audit: axe violation tags did not map to an SC: ${tags.join(', ')}`);
  }
  return out;
}

/** The visible x-tick label texts, in DOM order (shared by the zoom/reflow/pan checks). */
const xTicks = (page: Page, sel: string): Promise<string[]> =>
  page.$$eval(`${sel} .fc-tick-x`, (els) => els.map((e) => e.textContent ?? ''));

/** --- axe (necessary baseline) --- */
async function checkAxe(
  page: Page,
  sel: string,
  opts: ConformanceOptions,
  results: CheckResult[],
  axeViolations: AxeViolation[],
): Promise<void> {
  if (opts.axeSource) {
    try {
      await page.addScriptTag({ content: opts.axeSource });
      const violations = await page.evaluate(async (s) => {
        const axe = (window as unknown as { axe: { run: (ctx: Element | null, o: unknown) => Promise<{ violations: { id: string; impact: string; tags: string[] }[] }> } }).axe;
        const r = await axe.run(document.querySelector(s), { resultTypes: ['violations'] });
        return r.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, impact: v.impact, tags: v.tags }));
      }, sel);
      for (const v of violations) axeViolations.push({ id: v.id, impact: v.impact, sc: scFromAxeTags(v.tags) });
      results.push(
        status(violations.length === 0, 'axe-serious', [],
          `${violations.length} serious/critical: ${violations.map((v) => v.id).join(', ')}`,
          '0 serious/critical violations'),
      );
    } catch (e) {
      // A page whose CSP blocks injected scripts (common on real third-party dashboards) cannot
      // run axe — record n/a rather than crashing the whole audit.
      results.push(na('axe-serious', [], `axe could not run on the page: ${e instanceof Error ? e.message : 'injection blocked'}`));
    }
  } else {
    results.push(na('axe-serious', [], 'no axe source supplied'));
  }
}

/** --- DOM-structure facts gathered in one page.evaluate (a bag of facts) --- */
async function evaluateDomFacts(page: Page, sel: string) {
  return page.evaluate((s) => {
    const root = document.querySelector(s);
    const q = (sub: string): Element | null => root?.querySelector(sub) ?? null;
    const surface = q('[role="application"]');
    const canvas = q('canvas');
    const legendButtons = [...(root?.querySelectorAll('.fc-legend button') ?? [])];
    const tables = [...(root?.querySelectorAll('table') ?? [])];
    const dataTable = tables.find((t) => t.querySelectorAll('tr').length >= 10) ?? null;
    const firstTh = dataTable?.querySelector('thead th')?.textContent?.trim() ?? null;
    const axisTitleX = q('.fc-axis-title-x')?.textContent?.trim() ?? null;
    const live = q('[aria-live="polite"][aria-atomic="true"]');
    const styleEl = document.getElementById('fc-styles');
    const css = styleEl?.textContent ?? '';
    return {
      canvasHidden: canvas?.getAttribute('aria-hidden') === 'true',
      surface: surface
        ? {
            role: surface.getAttribute('role'),
            roledesc: surface.getAttribute('aria-roledescription') ?? '',
            label: surface.getAttribute('aria-label') ?? '',
            details: surface.getAttribute('aria-details') ?? '',
            describedby: surface.getAttribute('aria-describedby') ?? '',
            tabindex: surface.getAttribute('tabindex'),
          }
        : null,
      hasDataTable: !!dataTable,
      tableHasCaption: !!dataTable?.querySelector('caption'),
      tableHasScopedHeaders:
        !!dataTable?.querySelector('th[scope="col"]') && !!dataTable?.querySelector('th[scope="row"]'),
      firstTh,
      axisTitleX,
      legend: {
        count: legendButtons.length,
        allButtons: legendButtons.every((b) => b.tagName === 'BUTTON' && b.getAttribute('type') === 'button'),
        allPressed: legendButtons.every((b) => b.hasAttribute('aria-pressed')),
        stateHidden: [...(root?.querySelectorAll('.fc-legend-state') ?? [])].every(
          (e) => e.getAttribute('aria-hidden') === 'true',
        ),
        noAriaLabel: legendButtons.every((b) => !b.hasAttribute('aria-label') && !b.hasAttribute('aria-labelledby')),
        sizes: legendButtons.map((b) => {
          const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
        // Each swatch's non-colour encoding (the dashed <line> / area <rect>) + its colour, so the
        // gate can prove (a) colour is not the only channel (1.4.1) and (b) mark contrast (1.4.11).
        swatches: legendButtons.map((b) => {
          const g = b.querySelector('.fc-swatch')?.firstElementChild ?? null;
          return {
            tag: g?.tagName.toLowerCase() ?? '',
            dash: g?.getAttribute('stroke-dasharray') ?? '',
            color: g?.getAttribute('stroke') || g?.getAttribute('fill') || '',
          };
        }),
      },
      hasLive: !!live,
      css,
      noPositiveTabindex: ![...(root?.querySelectorAll('[tabindex]') ?? [])].some(
        (e) => Number(e.getAttribute('tabindex')) > 0,
      ),
      legendBeforeSurface: (() => {
        const lg = root?.querySelector('.fc-legend');
        if (!lg || !surface) return true;
        return (lg.compareDocumentPosition(surface) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      })(),
    };
  }, sel);
}

/** --- DOM-structure checks (assertions over the fact bag) --- */
function checkDomStructure(
  dom: Awaited<ReturnType<typeof evaluateDomFacts>>,
  bg: string,
  results: CheckResult[],
): void {
  results.push(status(dom.canvasHidden, 'canvas-hidden', ['1.1.1', '4.1.2'], 'canvas missing aria-hidden=true'));
  results.push(
    status(dom.hasDataTable && dom.tableHasCaption && dom.tableHasScopedHeaders, 'text-alternative',
      ['1.1.1', '1.3.1', '1.4.1'], 'no data <table> with caption + scoped headers (>=10 rows)'),
  );
  // R1: the x-column header reflects the configured xLabel (its axis title), else is non-empty.
  results.push(
    dom.axisTitleX
      ? status(dom.firstTh === dom.axisTitleX, 'table-x-header', ['1.3.1', '2.4.6'],
          `x-header "${dom.firstTh}" != xLabel "${dom.axisTitleX}"`, `x-header = "${dom.firstTh}"`)
      : status(!!dom.firstTh, 'table-x-header', ['1.3.1', '2.4.6'], 'x-column header is empty'),
  );
  const sf = dom.surface;
  results.push(
    status(
      !!sf && sf.role === 'application' && sf.roledesc.length > 0 && sf.label.length > 0 &&
        sf.details.length > 0 && sf.describedby.length > 0,
      'surface-semantics', ['1.1.1', '4.1.2', '3.3.2'], 'surface missing role/roledescription/label/details/describedby'),
  );
  // 1.3.3 / 3.3.2: the surface's accessible name names navigation keys (not sensory cues).
  results.push(status(/arrow/i.test(sf?.label ?? ''), 'instructions-named-keys', ['1.3.3', '3.3.2'],
    'surface aria-label does not name the navigation keys'));
  // 2.4.3: no positive tabindex, and the legend precedes the surface in DOM (meaningful order).
  results.push(status(dom.noPositiveTabindex && dom.legendBeforeSurface, 'focus-order', ['2.4.3'],
    'positive tabindex present, or legend is not before the surface in DOM order'));
  // 1.4.1 folded in: with >=2 series each swatch must be distinct beyond colour (dash pattern for
  // lines, or the area <rect> shape) — i.e. mutually unique by (tag|dash), so a colour-blind or
  // grayscale user can still map legend → mark. A single series needs no differentiator.
  const swEnc = dom.legend.swatches.map((s) => `${s.tag}|${s.dash}`);
  const colourNotSoleChannel =
    dom.legend.count < 2 || new Set(swEnc).size === dom.legend.count;
  results.push(
    dom.legend.count === 0
      ? na('legend-semantics', ['1.3.1', '4.1.2', '1.4.1', '3.2.4', '2.5.2'], 'no legend rendered')
      : status(dom.legend.allButtons && dom.legend.allPressed && dom.legend.stateHidden && colourNotSoleChannel,
          'legend-semantics', ['1.3.1', '4.1.2', '1.4.1', '3.2.4', '2.5.2'],
          `legend buttons missing type=button / aria-pressed / aria-hidden state, or swatches not distinct beyond colour (${swEnc.join(', ')})`),
  );
  // contrast-marks (1.4.11): each series mark clears 3:1 vs the documented background. The legend
  // swatch uses the series colour, so we read it as a DOM-observable proxy for the canvas mark.
  const markRatios = dom.legend.swatches
    .map((s) => s.color)
    .filter(Boolean)
    .map((c) => ({ c, r: ratioOf(c, bg) }));
  const markBad = markRatios.filter((m) => m.r !== null && m.r < AA_NON_TEXT);
  results.push(
    markRatios.length === 0
      ? na('contrast-marks', ['1.4.11'], 'no coloured swatches to measure')
      : status(markBad.length === 0, 'contrast-marks', ['1.4.11'],
          `series mark below ${AA_NON_TEXT}:1 vs ${bg}: ${markBad.map((m) => `${m.c} ${m.r?.toFixed(2)}:1`).join(', ')}`,
          `all ${markRatios.length} marks >= ${AA_NON_TEXT}:1 vs ${bg}`),
  );
  results.push(status(dom.hasLive, 'live-region-present', ['4.1.3'], 'no aria-live=polite aria-atomic region'));
  results.push(
    dom.legend.count === 0
      ? na('target-size', ['2.5.8'], 'no legend targets')
      : status(dom.legend.sizes.every((z) => z.w >= 24 && z.h >= 24), 'target-size', ['2.5.8'],
          `legend target < 24px: ${JSON.stringify(dom.legend.sizes)}`),
  );
  results.push(
    dom.legend.count === 0
      ? na('label-in-name', ['2.5.3'], 'no labeled controls')
      : status(dom.legend.noAriaLabel, 'label-in-name', ['2.5.3'],
          'legend button has aria-label/labelledby that may omit its visible text'),
  );
  results.push(status(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(dom.css), 'reduced-motion-rule',
    ['2.2.2', 'reduced-motion'], 'no prefers-reduced-motion rule in injected CSS'));
  results.push(status(/@media\s*\(forced-colors:\s*active\)/.test(dom.css), 'forced-colors-rule',
    ['2.4.7', 'forced-colors', '1.4.11'], 'no forced-colors rule in injected CSS'));
  results.push(status(dom.css.includes(':focus-visible'), 'focus-visible', ['2.4.7', '1.4.11'],
    'no :focus-visible indicator in injected CSS'));
  // Structural CSS-source checks (serve the criteria whose automatable portion is "the library
  // ships no anti-pattern"). Author/host-dependent aspects remain attestation in the ACR.
  results.push(status(!/[\s;{]order\s*:|row-reverse|column-reverse|[\s;{]float\s*:/.test(dom.css),
    'meaningful-sequence', ['1.3.2'], 'injected CSS reorders content (order / *-reverse / float)'));
  results.push(status(!/@media[^{]*orientation/i.test(dom.css) && !/transform:\s*rotate/i.test(dom.css),
    'orientation', ['1.3.4'], 'injected CSS locks orientation (orientation media query or rotate)'));
  results.push(status(/\.fc-root\{[^}]*width:\s*100%[^}]*height:\s*100%/.test(dom.css),
    'resize-text', ['1.4.4'], 'chart container is not fluid (100% width/height)'));
  results.push(status(/\.fc-legend ul\{[^}]*flex-wrap:\s*wrap/.test(dom.css),
    'reflow', ['1.4.10'], 'legend does not wrap (flex-wrap:wrap) — reflow at narrow widths at risk'));
  results.push(status(
    dom.css.split('}').filter((r) => /overflow:\s*hidden/.test(r)).every((r) => /\.fc-sr-only/.test(r)),
    'text-spacing', ['1.4.12'], 'visible text may be clipped (overflow:hidden outside .fc-sr-only)'));
}

/** --- functional keyboard checks --- */
async function checkKeyboard(
  page: Page,
  sel: string,
  announceWait: number,
  results: CheckResult[],
): Promise<void> {
  const startUrl = page.url();
  // Fail-soft for external targets: with no focusable data surface every keyboard/live-region
  // claim fails outright (and page.focus would otherwise time out and crash the audit).
  if ((await page.locator(`${sel} [role="application"]`).count()) === 0) {
    for (const [id, sc] of KEYBOARD_CHECKS) {
      results.push(no(id, sc, 'no [role="application"] surface to receive keyboard focus'));
    }
    return;
  }
  await page.focus(`${sel} [role="application"]`);
  await page.waitForTimeout(80);
  const liveSel = `${sel} [aria-live]`;
  const liveText = async (): Promise<string> => (await page.locator(liveSel).textContent()) ?? '';
  const before = await liveText();
  await page.keyboard.press('End');
  await page.waitForTimeout(60);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(announceWait);
  const after = await liveText();
  results.push(status(before !== after && after.trim().length > 0, 'keyboard-announce', ['2.1.1', '4.1.3'],
    'live region did not change on End/ArrowLeft'));

  // 3.2.1 / 3.2.2: focusing + key input must not change context (focus stays put, no navigation).
  const focusStable = await page.evaluate(
    (s) => document.activeElement === document.querySelector(`${s} [role="application"]`),
    sel,
  );
  results.push(status(focusStable && page.url() === startUrl, 'context-stability', ['3.2.1', '3.2.2'],
    'focus moved off the surface or the page navigated after focus/key input'));

  // active-value (R11): the focused sample is a queryable value (2nd describedby target populated).
  const activeText = async (): Promise<string> =>
    page.evaluate((s) => {
      const surface = document.querySelector(`${s} [role="application"]`);
      const ids = (surface?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return ids.length >= 2 ? (document.getElementById(ids[1])?.textContent ?? '') : '';
    }, sel);
  const activePopulated = (await activeText()).trim().length > 0;
  results.push(status(activePopulated, 'active-value', ['4.1.2'], 'focused-sample value target not populated'));

  // keyboard-zoom (R2): '+' changes the visible x-ticks.
  const ticksBefore = await xTicks(page, sel);
  await page.keyboard.press('+');
  await page.waitForTimeout(80);
  const ticksAfter = await xTicks(page, sel);
  results.push(status(JSON.stringify(ticksBefore) !== JSON.stringify(ticksAfter), 'keyboard-zoom', ['2.1.1'],
    'pressing "+" did not change the visible domain'));

  // escape-dismiss (R3): Escape hides the readout, keeps focus, clears the value target.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  const afterEsc = await page.evaluate((s) => {
    const readout = document.querySelector(`${s} .fc-readout`);
    const surface = document.querySelector(`${s} [role="application"]`);
    const ids = (surface?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const active = ids.length >= 2 ? (document.getElementById(ids[1])?.textContent ?? '') : '';
    return {
      readoutHidden: !readout?.classList.contains('fc-show'),
      stillFocused: document.activeElement === surface,
      activeCleared: active === '',
    };
  }, sel);
  results.push(status(afterEsc.readoutHidden && afterEsc.stillFocused && afterEsc.activeCleared,
    'escape-dismiss', ['1.4.13'], `Escape: hidden=${afterEsc.readoutHidden} focused=${afterEsc.stillFocused} cleared=${afterEsc.activeCleared}`));

  // no-keyboard-trap (2.1.2): Tab from the surface moves focus off it.
  await page.focus(`${sel} [role="application"]`);
  await page.keyboard.press('Tab');
  const leftSurface = await page.evaluate((s) =>
    document.activeElement !== document.querySelector(`${s} [role="application"]`), sel);
  results.push(status(leftSurface, 'no-keyboard-trap', ['2.1.2'], 'Tab did not move focus off the surface'));
}

/** tick-findable (1.4.5/1.3.1): real find-in-page locates a tick label (Chromium). */
async function checkTickFindable(page: Page, sel: string, results: CheckResult[]): Promise<void> {
  const tickFind = await page.evaluate((s) => {
    const tick = document.querySelector(`${s} .fc-tick`)?.textContent?.trim() ?? '';
    const w = window as unknown as { find?: (q: string) => boolean; getSelection?: () => Selection | null };
    w.getSelection?.()?.removeAllRanges?.();
    return tick.length > 0 && typeof w.find === 'function' ? w.find(tick) : null;
  }, sel);
  results.push(
    tickFind === null
      ? na('tick-findable', ['1.4.5', '1.3.1'], 'window.find unavailable (non-Chromium)')
      : status(tickFind, 'tick-findable', ['1.4.5', '1.3.1'], 'tick label not findable via window.find'),
  );
}

/** contrast checks (computed colors). */
async function checkContrast(page: Page, sel: string, bg: string, results: CheckResult[]): Promise<void> {
  const colors = await page.evaluate((s) => {
    const cs = (sub: string, prop: string): string => {
      const el = document.querySelector(`${s} ${sub}`);
      return el ? getComputedStyle(el).getPropertyValue(prop) : '';
    };
    return {
      readoutBg: cs('.fc-readout', 'background-color'),
      readoutInk: cs('.fc-readout-val', 'color') || cs('.fc-readout', 'color'),
      tick: cs('.fc-tick', 'color'),
    };
  }, sel);
  const readoutRatio = ratioOf(colors.readoutInk, colors.readoutBg);
  results.push(
    readoutRatio === null
      ? na('contrast-readout', ['1.4.3'], `could not read readout colors (${colors.readoutInk}/${colors.readoutBg})`)
      : status(readoutRatio >= AA_NORMAL, 'contrast-readout', ['1.4.3'],
          `readout contrast ${readoutRatio.toFixed(2)}:1 < ${AA_NORMAL}:1`, `${readoutRatio.toFixed(2)}:1`),
  );
  const tickRatio = ratioOf(colors.tick, bg);
  results.push(
    tickRatio === null
      ? na('contrast-default-text', ['1.4.3'], `could not read tick color (${colors.tick})`)
      : status(tickRatio >= AA_NORMAL, 'contrast-default-text', ['1.4.3'],
          `tick contrast ${tickRatio.toFixed(2)}:1 vs ${bg} < ${AA_NORMAL}:1`, `${tickRatio.toFixed(2)}:1 vs ${bg}`),
  );
}

/** reflow-adaptive (1.4.10, R7): narrowing the chart thins the x-tick density so labels do not
 * collide (effectiveTickCount). Narrow RELATIVE to the current width (so it works whatever size
 * the host gives the chart — a 336px bench cell or a 900px fixture), then restore. */
async function checkReflowAdaptive(page: Page, sel: string, results: CheckResult[]): Promise<void> {
  const tickXCount = async (): Promise<number> => (await xTicks(page, sel)).length;
  const setRootWidth = (w: string): Promise<void> =>
    page.evaluate(({ s, w: width }) => {
      const r = document.querySelector(s) as HTMLElement | null;
      if (r) r.style.width = width;
    }, { s: sel, w });
  const curWidth = await page.evaluate(
    (s) => (document.querySelector(s) as HTMLElement | null)?.getBoundingClientRect().width ?? 0, sel);
  const wideTicks = await tickXCount();
  if (wideTicks === 0) {
    // No fcharts x-ticks (.fc-tick-x) means this is not our adaptive-density mechanism to measure.
    results.push(na('reflow-adaptive', ['1.4.10'], 'no fcharts x-ticks (.fc-tick-x) to measure reflow density'));
    return;
  }
  const narrowPx = Math.max(160, Math.round(curWidth * 0.4));
  if (curWidth < 240) {
    results.push(na('reflow-adaptive', ['1.4.10'], `container already narrow (${Math.round(curWidth)}px) — cannot narrow further`));
  } else {
    await setRootWidth(`${narrowPx}px`);
    await page.waitForTimeout(260); // ResizeObserver + table debounce + frame
    const narrowTicks = await tickXCount();
    await setRootWidth(''); // restore the host/stylesheet width
    await page.waitForTimeout(240);
    results.push(status(wideTicks > 0 && narrowTicks > 0 && narrowTicks < wideTicks, 'reflow-adaptive', ['1.4.10'],
      `x-tick density did not thin when narrowed (${Math.round(curWidth)}px→${narrowPx}px: wide=${wideTicks}, narrow=${narrowTicks})`,
      `${Math.round(curWidth)}px→${narrowPx}px: ticks ${wideTicks}→${narrowTicks}`));
  }
}

/** resize-text-rem (1.4.4, R7): the tick font is in rem, so doubling the root font-size doubles
 * it (a px font would not move). Read, scale the root, re-read, restore. */
async function checkResizeTextRem(page: Page, sel: string, results: CheckResult[]): Promise<void> {
  const tickFontPx = async (): Promise<number> =>
    page.evaluate((s) => {
      const t = document.querySelector(`${s} .fc-tick`);
      return t ? parseFloat(getComputedStyle(t).fontSize) : 0;
    }, sel);
  const fontBefore = await tickFontPx();
  if (fontBefore === 0) {
    // No fcharts tick text (.fc-tick) to measure — the rem-scaling probe does not apply here.
    results.push(na('resize-text-rem', ['1.4.4'], 'no fcharts tick text (.fc-tick) to measure rem scaling'));
    return;
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.waitForTimeout(60);
  const fontAfter = await tickFontPx();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.waitForTimeout(40);
  results.push(status(fontBefore > 0 && fontAfter >= fontBefore * 1.8, 'resize-text-rem', ['1.4.4'],
    `tick font did not scale with root font size (${fontBefore}px -> ${fontAfter}px); fonts may be px not rem`,
    `${fontBefore}px -> ${fontAfter}px @ 2x root`));
}

/** single-pointer-pan (2.5.7, R4): once zoomed in, the pan pagers appear and a single click
 * shifts the visible window (no dragging required). */
async function checkSinglePointerPan(page: Page, sel: string, results: CheckResult[]): Promise<void> {
  // The pan pagers are an fcharts affordance reached by zooming the surface; without our surface
  // there is nothing to drive, so the criterion cannot be assessed on an external target.
  if ((await page.locator(`${sel} [role="application"]`).count()) === 0) {
    results.push(na('single-pointer-pan', ['2.5.7'], 'no [role="application"] surface to drive the pan pagers'));
    return;
  }
  await page.focus(`${sel} [role="application"]`);
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  await page.waitForTimeout(80);
  const ticksPrePan = await xTicks(page, sel);
  const pan = await page.evaluate((s) => {
    const pagers = [...document.querySelectorAll(`${s} .fc-pager`)] as HTMLButtonElement[];
    const visible = pagers.filter((b) => b.offsetParent !== null);
    return {
      count: pagers.length,
      allButtons: pagers.every((b) => b.tagName === 'BUTTON' && b.getAttribute('type') === 'button'),
      visible: visible.length,
      enabled: visible.filter((b) => !b.disabled).length,
    };
  }, sel);
  if (pan.enabled > 0) await page.click(`${sel} .fc-pager:not(:disabled)`);
  await page.waitForTimeout(80);
  const ticksPostPan = await xTicks(page, sel);
  results.push(status(
    pan.count === 2 && pan.allButtons && pan.visible >= 1 && pan.enabled >= 1 &&
      JSON.stringify(ticksPrePan) !== JSON.stringify(ticksPostPan),
    'single-pointer-pan', ['2.5.7'],
    `pagers count=${pan.count} buttons=${pan.allButtons} visible=${pan.visible} enabled=${pan.enabled}; click ${JSON.stringify(ticksPrePan) !== JSON.stringify(ticksPostPan) ? 'panned' : 'did NOT pan'}`));
}

/** forced-colors-canvas (forced-colors / 1.4.11, R12): turning forced-colors on must change the
 * canvas bitmap (it repaints in system colors) — proving the canvas participates, not just the DOM. */
async function checkForcedColorsCanvas(page: Page, sel: string, results: CheckResult[]): Promise<void> {
  const canvasSig = async (): Promise<string> =>
    page.evaluate((s) => {
      const c = document.querySelector(`${s} canvas.fc-canvas`) as HTMLCanvasElement | null;
      try {
        return c ? c.toDataURL() : '';
      } catch {
        return '';
      }
    }, sel);
  const sigBefore = await canvasSig();
  if (sigBefore === '') {
    // No fcharts canvas (canvas.fc-canvas) to read — cannot prove a forced-colors repaint here.
    results.push(na('forced-colors-canvas', ['forced-colors', '1.4.11'],
      'no fcharts canvas (canvas.fc-canvas) to measure forced-colors repaint'));
    return;
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await page.waitForTimeout(160);
  const sigAfter = await canvasSig();
  await page.emulateMedia({ forcedColors: 'none' });
  await page.waitForTimeout(80);
  results.push(status(sigBefore.length > 0 && sigAfter.length > 0 && sigBefore !== sigAfter,
    'forced-colors-canvas', ['forced-colors', '1.4.11'],
    'canvas bitmap did not change under forced-colors:active (did not participate)',
    'canvas repainted in system colors under forced-colors'));
}

/** Run the full check catalog against the chart at `sel`. */
export async function runConformance(
  page: Page,
  sel: string,
  opts: ConformanceOptions = {},
): Promise<CheckReport> {
  const bg = opts.background ?? '#ffffff';
  const announceWait = opts.announceWaitMs ?? 260;
  const results: CheckResult[] = [];
  const axeViolations: AxeViolation[] = [];

  // Let the first render + the (debounced, ~150ms) data-table build settle before asserting,
  // so steady-state DOM is checked regardless of how soon the caller invokes the engine.
  await page
    .waitForFunction((s) => !!document.querySelector(`${s} .fc-table-alt caption`), sel, { timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(60);

  await checkAxe(page, sel, opts, results, axeViolations);
  checkDomStructure(await evaluateDomFacts(page, sel), bg, results);
  await checkKeyboard(page, sel, announceWait, results);
  await checkTickFindable(page, sel, results);
  await checkContrast(page, sel, bg, results);
  await checkReflowAdaptive(page, sel, results);
  await checkResizeTextRem(page, sel, results);
  await checkSinglePointerPan(page, sel, results);
  await checkForcedColorsCanvas(page, sel, results);

  // Static / unit-covered checks the live page cannot prove (recorded as n/a, see baseline).
  results.push(na('no-canvas-text', ['1.4.5'], 'static source check (no fillText/strokeText); covered by baseline'));
  results.push(na('i18n-strings', ['3.1.2'], 'localization flow covered by unit tests (strings.test.ts)'));

  return { results, axeViolations };
}

/** Count check statuses (for CLI summaries). */
export function countStatuses(report: CheckReport): Record<CheckStatus, number> {
  const c: Record<CheckStatus, number> = { pass: 0, fail: 0, na: 0 };
  for (const r of report.results) c[r.status]++;
  return c;
}
