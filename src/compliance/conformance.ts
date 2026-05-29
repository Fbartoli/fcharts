/**
 * Conformance engine — the live-page check battery (conformance-test-plan.md §3).
 *
 * Drives a real Sightline instance in a browser (Playwright) and re-proves each automatable
 * WCAG claim from the evidence map — the functional layer axe cannot see. Returns a structured
 * `CheckReport` that `reduceToVerdicts` (mapping.ts) folds against the committed baseline.
 *
 * Playwright is a DEV/PEER dependency of the Compliance Pack — never imported by the core
 * renderer. Pure helpers (contrast, mapping) live in sibling modules and need no browser.
 */
import type { Page } from 'playwright';
import type { AxeViolation, CheckReport, CheckResult, CheckStatus } from './types.ts';
import { ratioOf, AA_NORMAL } from './contrast.ts';

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

/** Map axe wcag tags ("wcag143") to SC numbers ("1.4.3"). Best-effort; ignores version tags. */
function scFromAxeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const m = t.match(/^wcag(\d)(\d)(\d{1,2})$/);
    if (m) out.push(`${m[1]}.${m[2]}.${Number(m[3])}`);
  }
  return out;
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

  // --- axe (necessary baseline) ---
  if (opts.axeSource) {
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
  } else {
    results.push(na('axe-serious', [], 'no axe source supplied'));
  }

  // --- DOM-structure checks (one page.evaluate, returns a bag of facts) ---
  const dom = await page.evaluate((s) => {
    const root = document.querySelector(s);
    const q = (sub: string): Element | null => root?.querySelector(sub) ?? null;
    const surface = q('[role="application"]');
    const canvas = q('canvas');
    const legendButtons = [...(root?.querySelectorAll('.sl-legend button') ?? [])];
    const tables = [...(root?.querySelectorAll('table') ?? [])];
    const dataTable = tables.find((t) => t.querySelectorAll('tr').length >= 10) ?? null;
    const firstTh = dataTable?.querySelector('thead th')?.textContent?.trim() ?? null;
    const axisTitleX = q('.sl-axis-title-x')?.textContent?.trim() ?? null;
    const live = q('[aria-live="polite"][aria-atomic="true"]');
    const styleEl = document.getElementById('sl-styles');
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
        stateHidden: [...(root?.querySelectorAll('.sl-legend-state') ?? [])].every(
          (e) => e.getAttribute('aria-hidden') === 'true',
        ),
        noAriaLabel: legendButtons.every((b) => !b.hasAttribute('aria-label') && !b.hasAttribute('aria-labelledby')),
        sizes: legendButtons.map((b) => {
          const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }),
      },
      hasLive: !!live,
      css,
    };
  }, sel);

  results.push(status(dom.canvasHidden, 'canvas-hidden', ['1.1.1', '4.1.2'], 'canvas missing aria-hidden=true'));
  results.push(
    status(dom.hasDataTable && dom.tableHasCaption && dom.tableHasScopedHeaders, 'text-alternative',
      ['1.1.1', '1.3.1'], 'no data <table> with caption + scoped headers (>=10 rows)'),
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
      'surface-semantics', ['1.1.1', '4.1.2'], 'surface missing role/roledescription/label/details/describedby'),
  );
  results.push(
    dom.legend.count === 0
      ? na('legend-semantics', ['1.3.1', '4.1.2'], 'no legend rendered')
      : status(dom.legend.allButtons && dom.legend.allPressed && dom.legend.stateHidden,
          'legend-semantics', ['1.3.1', '4.1.2'], 'legend buttons missing type=button / aria-pressed / aria-hidden state'),
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
    ['2.4.7', 'forced-colors'], 'no forced-colors rule in injected CSS'));
  results.push(status(dom.css.includes(':focus-visible'), 'focus-visible', ['2.4.7'],
    'no :focus-visible indicator in injected CSS'));

  // --- functional keyboard checks ---
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
  const xTicks = async (): Promise<string[]> =>
    page.$$eval(`${sel} .sl-tick-x`, (els) => els.map((e) => e.textContent ?? ''));
  const ticksBefore = await xTicks();
  await page.keyboard.press('+');
  await page.waitForTimeout(80);
  const ticksAfter = await xTicks();
  results.push(status(JSON.stringify(ticksBefore) !== JSON.stringify(ticksAfter), 'keyboard-zoom', ['2.1.1'],
    'pressing "+" did not change the visible domain'));

  // escape-dismiss (R3): Escape hides the readout, keeps focus, clears the value target.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  const afterEsc = await page.evaluate((s) => {
    const readout = document.querySelector(`${s} .sl-readout`);
    const surface = document.querySelector(`${s} [role="application"]`);
    const ids = (surface?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    const active = ids.length >= 2 ? (document.getElementById(ids[1])?.textContent ?? '') : '';
    return {
      readoutHidden: !readout?.classList.contains('sl-show'),
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

  // tick-findable (1.4.5/1.3.1): real find-in-page locates a tick label (Chromium).
  const tickFind = await page.evaluate((s) => {
    const tick = document.querySelector(`${s} .sl-tick`)?.textContent?.trim() ?? '';
    const w = window as unknown as { find?: (q: string) => boolean; getSelection?: () => Selection | null };
    w.getSelection?.()?.removeAllRanges?.();
    return tick.length > 0 && typeof w.find === 'function' ? w.find(tick) : null;
  }, sel);
  results.push(
    tickFind === null
      ? na('tick-findable', ['1.4.5', '1.3.1'], 'window.find unavailable (non-Chromium)')
      : status(tickFind, 'tick-findable', ['1.4.5', '1.3.1'], 'tick label not findable via window.find'),
  );

  // contrast checks (computed colors).
  const colors = await page.evaluate((s) => {
    const cs = (sub: string, prop: string): string => {
      const el = document.querySelector(`${s} ${sub}`);
      return el ? getComputedStyle(el).getPropertyValue(prop) : '';
    };
    return {
      readoutBg: cs('.sl-readout', 'background-color'),
      readoutInk: cs('.sl-readout-val', 'color') || cs('.sl-readout', 'color'),
      tick: cs('.sl-tick', 'color'),
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
