/**
 * fcharts — the public chart class. Wires the renderer-agnostic core, the Canvas2D
 * renderer, the render scheduler, the interaction handlers (wheel-zoom, drag-pan,
 * keyboard cursor, hover), and the always-on accessibility layer into one component.
 *
 * Accessibility is load-bearing, not a flag: the DOM tick text, accessible legend,
 * keyboard-navigable data surface with live-region announcements, and the hidden data
 * table are all constructed by default and updated as part of the render lifecycle.
 */
import {
  ChartData,
  annotationSample,
  resolveAnnotations,
  resolveSeries,
  DEFAULT_MARGINS,
  type AnnotationSpec,
  type CursorState,
  type Margins,
  type ResolvedAnnotation,
  type ResolvedSeries,
  type SeriesConfig,
  type FChartData,
} from './core/model.ts';
import { linearScale, logScale, type LinearScale } from './core/scales.ts';
import {
  effectiveTickCount,
  formatTick,
  formatTimeTick,
  logTicks,
  niceTicks,
  niceTimeTicks,
} from './core/ticks.ts';
import { lowerBound, nearestIndex } from './core/downsample.ts';
import { RenderScheduler } from './core/scheduler.ts';
import { createCanvas2DRenderer } from './renderers/canvas2d.ts';
import {
  detectHtmlInCanvas,
  resolveRenderPath,
  type HtmlInCanvasSupport,
  type RenderPath,
} from './renderers/detect.ts';
import { createCompositor, type Compositor } from './renderers/html-in-canvas.ts';
import type { Renderer, RenderScene } from './renderers/renderer.ts';
import { buildSVG } from './renderers/svg-export.ts';
import { injectStyles } from './a11y/styles.ts';
import { buildReadout, type ReadoutEls } from './a11y/readout.ts';
import { LiveRegion } from './a11y/live-region.ts';
import { AxisTicks } from './a11y/ticks.ts';
import { Legend } from './a11y/legend.ts';
import { Pagers } from './a11y/pagers.ts';
import { Sonifier } from './a11y/sonify.ts';
import { TableAlt } from './a11y/table-alt.ts';
import { buildSummary, describeSummary, type ChartSummary } from './a11y/summary.ts';
import {
  annotationIndexByX,
  annotationStep,
  handlesKey,
  panToInclude,
  selectsAnnotation,
  stepCursor,
  zoomFactor,
} from './a11y/cursor.ts';
import { format, resolveStrings, type FChartStrings } from './a11y/strings.ts';

type Formatter = (value: number) => string;

export interface FChartOptions {
  /** Accessible name for the whole chart. */
  ariaLabel?: string;
  xLabel?: string;
  yLabel?: string;
  /** Render the accessible legend. Default true. */
  legend?: boolean;
  /** Cap on device pixel ratio (perf). Default 2. */
  maxDpr?: number;
  /** Fractional y-extent padding. Default 0.06. */
  yPadding?: number;
  /** X-domain padding in x data units beyond the first/last sample (it widens the view's hard
   *  bounds). Candle bodies have width in x, so charts with a visible candle series default to
   *  half the average sample step — edge candles render whole instead of clipping to slivers at
   *  the plot border. Other charts default to 0. Set it explicitly to keep multi-panel layouts
   *  (e.g. price + volume) on identical domains. */
  xPad?: number;
  /** Treat x as integer indices (ticks step >= 1). Default false. */
  xInteger?: boolean;
  /** X-axis flavor. `'time'` treats x as epoch milliseconds: ticks land on calendar boundaries
   *  (midnights, month starts) and `formatX` defaults to an adaptive date/clock formatter.
   *  Default `'linear'`. The `formatX` default is resolved at construction — patch `formatX`
   *  explicitly if you change `xType` via `update()`. */
  xType?: 'linear' | 'time';
  /** Y-axis scale. `'log'` (base 10) needs positive data: the domain is fitted to the positive
   *  values and non-positive samples clamp to the plot bottom. Default `'linear'`. */
  yScale?: 'linear' | 'log';
  xTickCount?: number;
  yTickCount?: number;
  formatX?: Formatter;
  formatY?: Formatter;
  /** Force reduced-motion behavior (otherwise auto-detected). */
  reducedMotion?: boolean;
  /** Force high-contrast behavior (otherwise auto-detected). */
  highContrast?: boolean;
  /** Force forced-colors (Windows High Contrast) behavior (otherwise auto-detected + live). */
  forcedColors?: boolean;
  /** Play an audible tone for the focused value as the keyboard cursor moves (audio charts).
   *  Off by default. */
  sonify?: boolean;
  /** Render a small "Download data (CSV)" button (localizable via `strings.exportCsv`) in the
   *  plot's lower-left — a visible alternative-format affordance backing the hidden data table.
   *  Off by default; fixed at construction. The data is always available via `toCSV()`. */
  exportControl?: boolean;
  /** Notified when the live render path changes after construction — e.g. when the
   *  HTML-in-Canvas path self-heals to the DOM overlay because the experimental composite painted
   *  nothing. Read `chart.renderPath` for the initial value; this fires only on a change.
   *  Lets a host reflect the live path (a status badge, diagnostics). */
  onRenderPath?: (path: RenderPath) => void;
  /** Localize the library's fixed UI strings (legend, keyboard help, summary, caption). */
  strings?: Partial<FChartStrings>;
}

export interface FChartConfig {
  series: SeriesConfig[];
  data?: FChartData;
  options?: FChartOptions;
  /** Event markers on the series (allocation/closure dots, vertical rules). */
  annotations?: AnnotationSpec[];
}

/** Throttle for the DOM-heavy derived updates (hidden table, summary, pagers, label). */
const DERIVED_THROTTLE_MS = 150;
// Coalesce live-region announcements: holding an arrow key fires keydowns at the OS repeat
// rate, which would flood a polite live region. Announce only the settled position.
const ANNOUNCE_DEBOUNCE_MS = 100;
// Pointer pick radius (px) for grabbing an individual event marker: the diamond's ~5px half-width
// plus slack, so a near-miss still selects the intended marker.
const ANNOTATION_HIT_PX = 11;

let instanceSeq = 0;

/** Constructor options resolved onto their defaults (media-query autodetects included). */
type ResolvedOptions = Required<
  Omit<FChartOptions, 'ariaLabel' | 'xLabel' | 'yLabel' | 'strings' | 'onRenderPath' | 'xPad'>
> &
  Pick<FChartOptions, 'ariaLabel' | 'xLabel' | 'yLabel' | 'onRenderPath' | 'xPad'>;

function resolveOptions(config: FChartConfig, doc: Document): ResolvedOptions {
  return {
    legend: config.options?.legend ?? true,
    maxDpr: config.options?.maxDpr ?? 2,
    yPadding: config.options?.yPadding ?? 0.06,
    xInteger: config.options?.xInteger ?? false,
    xType: config.options?.xType ?? 'linear',
    yScale: config.options?.yScale ?? 'linear',
    xTickCount: config.options?.xTickCount ?? 8,
    yTickCount: config.options?.yTickCount ?? 6,
    formatX:
      config.options?.formatX ?? (config.options?.xType === 'time' ? formatTimeTick : formatTick),
    formatY: config.options?.formatY ?? formatTick,
    reducedMotion:
      config.options?.reducedMotion ?? prefers(doc, '(prefers-reduced-motion: reduce)'),
    highContrast: config.options?.highContrast ?? prefers(doc, '(prefers-contrast: more)'),
    forcedColors: config.options?.forcedColors ?? prefers(doc, '(forced-colors: active)'),
    sonify: config.options?.sonify ?? false,
    exportControl: config.options?.exportControl ?? false,
    onRenderPath: config.options?.onRenderPath,
    ariaLabel: config.options?.ariaLabel,
    xLabel: config.options?.xLabel,
    yLabel: config.options?.yLabel,
    xPad: config.options?.xPad,
  };
}

/**
 * Machine-readable layer: a one-line natural-language summary (aria-describedby, so it is
 * announced and agent-readable), the focused sample as a programmatically-determinable value
 * (an aria-describedby target updated in lockstep with the cursor — vs. the live region, which
 * is a transient announcement; lets AT/automation *query* the current point, not just hear it),
 * and a structured JSON block for DOM scrapers.
 */
function buildA11yEls(
  doc: Document,
  summaryId: string,
  activeId: string,
): { summaryEl: HTMLElement; activeSample: HTMLElement; dataScript: HTMLElement } {
  const summaryEl = doc.createElement('p');
  summaryEl.className = 'fc-sr-only';
  summaryEl.id = summaryId;
  const activeSample = doc.createElement('span');
  activeSample.className = 'fc-sr-only';
  activeSample.id = activeId;
  const dataScript = doc.createElement('script');
  dataScript.setAttribute('type', 'application/json');
  dataScript.setAttribute('data-fcharts', 'summary');
  return { summaryEl, activeSample, dataScript };
}

function buildSurface(
  doc: Document,
  ids: { tableId: string; summaryId: string; activeId: string },
): HTMLElement {
  const surface = doc.createElement('div');
  surface.className = 'fc-surface';
  surface.tabIndex = 0;
  surface.setAttribute('role', 'application');
  surface.setAttribute('aria-roledescription', 'interactive chart');
  // Point the focused widget at its data table so screen-reader users can reach it
  // without leaving application mode and blindly browsing.
  surface.setAttribute('aria-details', ids.tableId);
  // Describe the data (values + trend) plus the focused sample (updated live) so SR users
  // and AI agents get the overview on focus and can query the current point.
  surface.setAttribute('aria-describedby', `${ids.summaryId} ${ids.activeId}`);
  return surface;
}

export class FChart {
  private readonly root: HTMLElement;
  private readonly doc: Document;
  private readonly options: ResolvedOptions;
  private readonly strings: FChartStrings;

  private series: ResolvedSeries[];
  /** Raw annotation specs, kept so a series change can re-resolve their default colors. */
  private annotationSpecs: AnnotationSpec[] = [];
  private annotations: ResolvedAnnotation[] = [];
  private data: ChartData;
  private domain: [number, number] = [0, 1];
  private yDomain: [number, number] = [0, 1];
  private cursor: CursorState = { series: 0, index: 0 };
  private cursorActive = false;
  /** Event marker under the pointer or keyboard focus (transient highlight), or null. */
  private hoveredAnn: number | null = null;
  /** Pinned/selected event marker (persists until cleared or re-clicked), or null. */
  private selectedAnn: number | null = null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly margins: Margins = { ...DEFAULT_MARGINS };

  private ticksDirty = true;
  private tableTimer = 0;
  private a11yTimer = 0;
  private announceTimer = 0;
  /** One-shot guard so the zero-height diagnostic warns at most once per chart. */
  private warnedZeroHeight = false;
  /** Consecutive HTML-in-Canvas composite misses before falling back to the visible overlay. */
  private hicMisses = 0;
  /** Whether we've verified a composite actually painted tick pixels into the bitmap. */
  private hicVerified = false;
  /** Last render path handed to `options.onRenderPath` (only re-notify on a real change). */
  private reportedPath: RenderPath;

  private readonly renderer: Renderer;
  private readonly scheduler: RenderScheduler;
  private readonly compositor: Compositor;
  private readonly support: HtmlInCanvasSupport;
  /** Mutable: the html-in-canvas path can fall back to 'dom-overlay' if compositing fails. */
  private path: RenderPath;

  private readonly canvas: HTMLCanvasElement;
  private readonly plot: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly liveRegion: LiveRegion;
  private readonly axisTicks: AxisTicks;
  private readonly legend: Legend | null;
  private readonly pagers: Pagers;
  private readonly sonifier: Sonifier | null;
  private readonly tableAlt: TableAlt;
  private readonly summaryEl: HTMLElement;
  private readonly exportBtn: HTMLButtonElement | null;
  private readonly activeSample: HTMLElement;
  private readonly dataScript: HTMLElement;
  private readonly readout: ReadoutEls;
  private readonly resizeObserver: ResizeObserver;
  private readonly listeners = new AbortController();
  private readonly domainListeners = new Set<(domain: readonly [number, number]) => void>();

  private dragging = false;
  private dragStartX = 0;
  private dragStartDomain: [number, number] = [0, 1];

  constructor(el: HTMLElement, config: FChartConfig) {
    this.root = el;
    this.doc = el.ownerDocument;
    this.options = resolveOptions(config, this.doc);
    this.strings = resolveStrings(config.options?.strings);

    injectStyles(this.doc);
    this.series = resolveSeries(config.series);
    this.annotationSpecs = config.annotations ?? [];
    this.annotations = resolveAnnotations(this.annotationSpecs, this.series);
    if (config.data) this.assertSlotCount(config.data.y.length);
    this.data = new ChartData(
      config.data ?? { x: [], y: Array.from({ length: this.totalSlots() }, () => []) },
    );

    // --- DOM ---
    const seq = ++instanceSeq;
    const tableId = `fc-data-${seq}`;
    const summaryId = `fc-summary-${seq}`;
    const activeId = `fc-active-${seq}`;
    this.root.classList.add('fc-root');
    this.liveRegion = new LiveRegion(this.doc);
    this.axisTicks = new AxisTicks(this.doc, this.options.xLabel, this.options.yLabel);
    this.tableAlt = new TableAlt(this.doc);
    this.tableAlt.el.id = tableId;

    const a11y = buildA11yEls(this.doc, summaryId, activeId);
    this.summaryEl = a11y.summaryEl;
    this.activeSample = a11y.activeSample;
    this.dataScript = a11y.dataScript;
    this.legend = this.options.legend
      ? new Legend(this.series, (i) => this.toggleSeries(i), this.strings, this.doc)
      : null;
    this.pagers = new Pagers((dir) => this.panPage(dir), this.strings, this.doc);
    this.exportBtn = this.options.exportControl ? this.buildExportButton() : null;
    const view = this.doc.defaultView;
    this.sonifier = this.options.sonify && view ? new Sonifier(view) : null;

    this.canvas = this.doc.createElement('canvas');
    this.canvas.className = 'fc-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    this.plot = this.doc.createElement('div');
    this.plot.className = 'fc-plot';
    this.surface = buildSurface(this.doc, { tableId, summaryId, activeId });
    this.readout = buildReadout(this.doc);

    this.renderer = createCanvas2DRenderer(this.canvas);
    this.compositor = createCompositor(this.canvas);
    this.support = detectHtmlInCanvas();
    this.path = resolveRenderPath(this.support);
    this.reportedPath = this.path;

    this.assembleDom();

    this.scheduler = new RenderScheduler(() => this.frame());

    this.attachEvents();
    this.trackForcedColors(config.options?.forcedColors !== undefined);
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.plot);

    this.measure();
    this.resetView();
    // Always run, even without initial data, so the surface has an accessible name and a
    // populated (non-empty) aria-describedby target before any setData().
    this.refreshDerived();
    this.requestRender();
  }

  /** Attach the built pieces to the document (legend, plot stack, a11y layer). */
  private assembleDom(): void {
    if (this.legend) this.root.append(this.legend.el);
    this.surface.append(this.liveRegion.el, this.activeSample);
    // The axis-tick text layer is a plot sibling (a visible CSS overlay) on the DOM-overlay
    // path; on the HTML-in-Canvas path it becomes an immediate <canvas> child that is drawn
    // into the bitmap each frame (frame() → compositeTicks) while staying accessible.
    const ticksAsCanvasChild = this.path === 'html-in-canvas';
    if (ticksAsCanvasChild) {
      this.compositor.enable();
      this.canvas.append(this.axisTicks.el);
    }
    this.plot.append(
      this.canvas,
      ...(ticksAsCanvasChild ? [] : [this.axisTicks.el]),
      this.surface,
      this.pagers.el,
      this.readout.el,
      this.tableAlt.el,
      this.summaryEl,
      this.dataScript,
    );
    if (this.exportBtn) this.plot.append(this.exportBtn);
    this.root.append(this.plot);
  }

  /** Live forced-colors (Windows High Contrast) tracking, unless the integrator pinned it. */
  private trackForcedColors(pinned: boolean): void {
    if (pinned) return;
    this.doc.defaultView?.matchMedia?.('(forced-colors: active)').addEventListener?.(
      'change',
      (e) => {
        this.options.forcedColors = e.matches;
        this.requestRender();
      },
      { signal: this.listeners.signal },
    );
  }

  /** The render path actually in use. The DOM-overlay path is fully accessible on its own. */
  get renderPath(): RenderPath {
    return this.path;
  }

  /** HTML-in-Canvas support details (for diagnostics/badges). */
  get htmlInCanvas(): HtmlInCanvasSupport {
    return this.support;
  }

  /**
   * Structured, machine-readable summary of the current data — per-series min/max/first/
   * last/mean, change, and trend. The same object is embedded as JSON in the DOM and
   * distilled into the chart's accessible description, so screen readers and AI agents get
   * the values a bare `<canvas>` chart hides.
   */
  summary(): ChartSummary {
    return buildSummary(this.data, this.series, this.options.ariaLabel ?? 'Chart', this.annotations);
  }

  /**
   * Serialize the current view to a standalone, accessible `<svg>` string — the same
   * downsampled envelope the canvas draws, plus real `<text>` ticks and a `<title>`/`<desc>`.
   * Useful for print, embedding, or feeding a tactile-graphics pipeline (a non-visual export
   * the EU data-viz guide recommends). Falls back to the configured size if not yet measured.
   */
  toSVG(): string {
    const width = this.width || 640;
    const height = this.height || 360;
    const m = this.margins;
    const xScale = linearScale(this.domain, [m.left, width - m.right]);
    const makeY = this.options.yScale === 'log' ? logScale : linearScale;
    const yScale = makeY(this.yDomain, [height - m.bottom, m.top]);
    const xCount = effectiveTickCount(this.options.xTickCount, width - m.left - m.right, 64);
    const yCount = effectiveTickCount(this.options.yTickCount, height - m.top - m.bottom, 28);
    return buildSVG({
      width,
      height,
      margins: m,
      series: this.series,
      data: this.data,
      xScale,
      yScale,
      domain: this.domain,
      xTicks: this.xAxisTicks(xCount),
      yTicks: this.yAxisTicks(yCount),
      formatX: this.options.formatX,
      formatY: this.options.formatY,
      title: this.options.ariaLabel ?? 'Chart',
      desc: describeSummary(this.summary(), this.options.formatX, this.options.formatY, this.strings),
      xLabel: this.options.xLabel,
      yLabel: this.options.yLabel,
      annotations: this.annotations,
    });
  }

  /**
   * The full current dataset as CSV (RFC 4180 quoting): an x column (named after `xLabel`),
   * then one column per line/area series and four (`open`/`high`/`low`/`close`, localized via
   * `strings`) per candle series. Values are raw — not run through `formatX`/`formatY` — so the
   * export round-trips; hidden series are included. The same data the hidden table samples,
   * but complete.
   */
  toCSV(): string {
    const header = [this.options.xLabel ?? 'x'];
    for (const s of this.series) {
      if (s.type === 'candle') {
        const words = [this.strings.open, this.strings.high, this.strings.low, this.strings.close];
        header.push(...words.map((w) => `${s.name} ${w}`));
      } else {
        header.push(s.name);
      }
    }
    const lines = [header.map(csvQuote).join(',')];
    for (let i = 0; i < this.data.n; i++) {
      const row = [String(this.data.x[i])];
      for (const s of this.series) {
        for (let k = 0; k < s.slots; k++) row.push(String(this.data.y[s.index + k][i]));
      }
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  private buildExportButton(): HTMLButtonElement {
    const b = this.doc.createElement('button');
    b.type = 'button';
    b.className = 'fc-export';
    b.textContent = this.strings.exportCsv;
    b.addEventListener('click', () => this.downloadCsv(), { signal: this.listeners.signal });
    return b;
  }

  private downloadCsv(): void {
    const url = URL.createObjectURL(new Blob([this.toCSV()], { type: 'text/csv' }));
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = `${(this.options.ariaLabel ?? 'chart').replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Replace the dataset. Resets the view to the full x-domain. */
  setData(data: FChartData): FChart {
    this.assertSlotCount(data.y.length);
    this.data = new ChartData(data);
    this.resetView();
    this.refreshDerived();
    this.requestRender();
    return this;
  }

  /** Total y-array slots the configured series consume (candles take 4: open/high/low/close). */
  private totalSlots(): number {
    const last = this.series[this.series.length - 1];
    return last ? last.index + last.slots : 0;
  }

  /** Fail fast when the y-array count doesn't match the series' slot layout. */
  private assertSlotCount(got: number): void {
    const want = this.totalSlots();
    if (got === want) return;
    const candles = this.series.filter((s) => s.type === 'candle').length;
    const hint = candles
      ? ` (${candles} candle series × 4 arrays each — open, high, low, close — plus 1 per line/area series)`
      : '';
    throw new Error(`fcharts: ${this.series.length} series need ${want} y arrays${hint}, got ${got}.`);
  }

  /**
   * Append one sample for real-time/streaming data — amortized O(1) (only the tail pyramid
   * buckets update), never an O(n) rebuild. `x` must be >= the current last x; `ys` must have one
   * value per series.
   *
   * When the view is following the live tail, the y-domain auto-fits the new data and the view
   * tracks it — a zoomed window slides (keeping its width), a full-history view expands. If you've
   * panned back into history it stays put — same view, same axis — so you can keep reading the past.
   *
   * Accessibility: `append` updates content on its own, so if you drive it on a timer you are
   * creating auto-updating content — provide a Pause/Stop control (WCAG 2.2.2). The library never
   * auto-updates by itself, so the cadence and its controls are yours.
   */
  append(xv: number, ys: readonly number[]): FChart {
    const prevN = this.data.n;
    const prevLast = prevN > 0 ? this.data.x[prevN - 1] : xv;
    const prevLo = prevN > 0 ? this.viewExtent()[0] : xv;
    const following = prevN === 0 || this.domain[1] >= prevLast - 1e-9;
    const atLeftEdge = this.domain[0] <= prevLo + 1e-9;

    this.data.push(xv, ys);

    if (following) {
      // Rescale the y-axis only when following the tail; a paused historical view keeps its axis.
      this.rescaleY();
      this.ticksDirty = true;
      const [vlo, vhi] = this.viewExtent(); // padded bounds, so an edge candle stays whole
      if (atLeftEdge) {
        this.applyDomain([vlo, vhi]); // a full-history view → grow the right edge
      } else {
        const w = this.domain[1] - this.domain[0]; // a zoomed window → slide, keep its width
        this.applyDomain([vhi - w, vhi]);
        this.keepCursorInView();
      }
    }
    // The DOM-facing derived state (summary JSON, accessible name, pagers, table) coalesces at
    // streaming rates instead of rebuilding per sample — measured at ~99% of append cost.
    this.scheduleA11yRefresh();
    this.scheduleTableUpdate();
    this.requestRender();
    return this;
  }

  /**
   * Replace the y-values of the LAST sample in place (x unchanged) — O(log n). The streaming
   * companion to `append` for samples that keep changing while they form: amend the forming
   * candle (or ticking last price) on every update, then `append` the next one when its bucket
   * opens. Values must be finite; throws on an empty chart.
   *
   * The y-axis refits when the view is following the live tail, exactly like `append`.
   */
  amendLast(ys: readonly number[]): FChart {
    const following = this.data.n > 0 && this.domain[1] >= this.data.x[this.data.n - 1] - 1e-9;
    this.data.amendLast(ys);
    if (following) {
      this.rescaleY();
      this.ticksDirty = true;
    }
    this.scheduleA11yRefresh();
    this.scheduleTableUpdate();
    this.requestRender();
    return this;
  }

  /** If the cursor scrolled out of view (follow-slide, page-pan), snap it back + announce. */
  private keepCursorInView(): void {
    if (!this.cursorActive || this.data.n === 0) return;
    const cx = this.data.x[this.cursor.index];
    if (cx < this.domain[0] || cx > this.domain[1]) {
      const mid = (this.domain[0] + this.domain[1]) / 2;
      this.cursor = { series: this.cursor.series, index: nearestIndex(this.data.x, mid) };
      this.updateActiveSample();
      this.queueAnnounce();
      this.requestRender();
    }
  }

  /**
   * Render immediately and synchronously, optionally to a given x-domain. Bypasses the
   * rAF scheduler — useful for programmatic zoom, print/offscreen capture, and
   * deterministic benchmarking.
   */
  renderSync(domain?: readonly [number, number]): FChart {
    if (domain) this.applyDomain(domain);
    this.scheduler.cancel(); // honor "bypasses the scheduler": drop any frame already queued
    this.frame();
    return this;
  }

  /**
   * Subscribe to x-domain changes — wheel/keyboard zoom, drag pan, pager pans, cursor
   * follow-pans, and programmatic `renderSync(domain)` all notify (after clamping, only when
   * the domain actually changed). `setData`'s full-extent reset does not. Returns an
   * unsubscribe function. See {@link syncCharts} for the linked multi-pane helper built on it.
   */
  onDomainChange(cb: (domain: readonly [number, number]) => void): () => void {
    this.domainListeners.add(cb);
    return () => this.domainListeners.delete(cb);
  }

  private emitDomain(): void {
    for (const cb of this.domainListeners) cb([this.domain[0], this.domain[1]]);
  }

  /**
   * Patch series, options, and/or data in place. Updatable options take effect immediately
   * (labels, formatters, tick counts, modes, callbacks). `legend`, `sonify`, `exportControl`,
   * and `strings` wire subsystems at construction and cannot change here: a patch that would *change* one throws
   * (passing the current value is a no-op). Recreate the chart to change them — the React
   * adapter remounts automatically.
   */
  update(patch: Partial<FChartConfig>): FChart {
    if (patch.series) this.series = resolveSeries(patch.series);
    if (patch.options) {
      this.assertUpdatable(patch.options);
      // `strings` was already resolved at construction; don't let the raw partial shadow it.
      const { strings: _fixed, ...updatable } = patch.options;
      Object.assign(this.options, updatable);
      this.dpr = Math.min(this.options.maxDpr, this.doc.defaultView?.devicePixelRatio ?? 1);
      if ('xLabel' in patch.options || 'yLabel' in patch.options) {
        this.axisTicks.setLabels(this.options.xLabel, this.options.yLabel);
      }
    }
    if (patch.data) {
      this.assertSlotCount(patch.data.y.length);
      this.data = new ChartData(patch.data);
      this.resetView();
    } else if (patch.series) {
      this.assertSlotCount(this.data.y.length); // new series layout must fit the existing data
    }
    if (patch.annotations !== undefined) this.annotationSpecs = patch.annotations;
    // Re-resolve when the specs change or when series change (annotation colors default off series).
    if (patch.annotations !== undefined || patch.series) {
      this.annotations = resolveAnnotations(this.annotationSpecs, this.series);
      // Drop focus/selection: the indices referred to the old annotation set.
      this.hoveredAnn = null;
      this.selectedAnn = null;
    }
    this.legend?.update(this.series);
    this.refreshDerived();
    this.requestRender();
    return this;
  }

  /** Fail fast when a patch tries to change an option only the constructor can wire. */
  private assertUpdatable(patch: FChartOptions): void {
    if (patch.legend !== undefined && patch.legend !== this.options.legend) failFixed('legend');
    if (patch.sonify !== undefined && patch.sonify !== this.options.sonify) failFixed('sonify');
    if (patch.exportControl !== undefined && patch.exportControl !== this.options.exportControl) {
      failFixed('exportControl');
    }
    for (const [key, value] of Object.entries(patch.strings ?? {})) {
      if (value !== undefined && value !== this.strings[key as keyof FChartStrings]) {
        failFixed('strings');
      }
    }
  }

  destroy(): void {
    this.listeners.abort();
    this.resizeObserver.disconnect();
    this.scheduler.destroy();
    this.renderer.destroy();
    const view = this.doc.defaultView;
    if (this.tableTimer) view?.clearTimeout(this.tableTimer);
    if (this.a11yTimer) view?.clearTimeout(this.a11yTimer);
    if (this.announceTimer) view?.clearTimeout(this.announceTimer);
    this.axisTicks.destroy();
    this.tableAlt.destroy();
    this.legend?.destroy();
    this.pagers.destroy();
    this.sonifier?.destroy();
    this.liveRegion.destroy();
    this.plot.remove();
    this.root.classList.remove('fc-root');
  }

  // --- internals ---

  private requestRender(): void {
    this.scheduler.request();
  }

  private resetView(): void {
    this.domain = this.viewExtent();
    this.cursor = { series: this.firstVisibleSeries(), index: Math.floor(this.data.n / 2) };
    this.ticksDirty = true;
  }

  /**
   * The view's hard x-bounds: the data extent widened by `options.xPad` — which defaults to
   * half the average sample step when a candle series is visible (candle bodies have width in
   * x; without the pad the first and last candles clip to slivers at the plot border).
   */
  private viewExtent(): [number, number] {
    const [lo, hi] = this.data.xExtent();
    const pad = this.options.xPad ?? this.autoXPad(lo, hi);
    return [lo - pad, hi + pad];
  }

  private autoXPad(lo: number, hi: number): number {
    if (this.data.n < 2 || !this.series.some((s) => s.type === 'candle' && s.visible)) return 0;
    return (hi - lo) / (this.data.n - 1) / 2;
  }

  private firstVisibleSeries(): number {
    const i = this.series.findIndex((s) => s.visible);
    return i < 0 ? 0 : i;
  }

  /**
   * Recompute the y-domain and refresh the surface label, ticks, and table — synchronously.
   * Used by the single-event paths (construction, setData, update, toggleSeries); `append`
   * instead pairs `rescaleY()` with the throttled `scheduleA11yRefresh()`.
   */
  private refreshDerived(rescaleY = true): void {
    if (rescaleY) this.rescaleY();
    this.refreshA11y();
    this.ticksDirty = true;
    this.scheduleTableUpdate();
  }

  /** Fit the y-domain (plus padding) to the visible series. */
  private rescaleY(): void {
    // Per-slot visibility mask (a candle series spans 4 y slots, all sharing its visibility).
    const visible: boolean[] = [];
    for (const s of this.series) for (let k = 0; k < s.slots; k++) visible.push(s.visible);
    const [yMin, yMax] = this.data.yExtent(visible);
    if (this.options.yScale === 'log') {
      // Log needs a positive domain; pad in log space so the visual margin matches linear's.
      // Non-positive extents fall back to a decade below the max (samples <= 0 clamp to the
      // plot bottom at render time — see logScale).
      const hi = yMax > 0 ? yMax : 1;
      const lo = yMin > 0 ? yMin : hi / 10;
      const pad = (Math.log10(hi) - Math.log10(lo) || 1) * this.options.yPadding;
      this.yDomain = [Math.pow(10, Math.log10(lo) - pad), Math.pow(10, Math.log10(hi) + pad)];
      return;
    }
    const pad = (yMax - yMin) * this.options.yPadding;
    this.yDomain = [yMin - pad, yMax + pad];
  }

  /** The DOM-facing derived state: accessible name, summary, current value, pagers. */
  private refreshA11y(): void {
    this.surface.setAttribute('aria-label', this.describeChart());
    this.updateSummary();
    this.updateActiveSample();
    this.updatePagers();
  }

  /**
   * Throttled `refreshA11y` for streaming appends. Fires at the throttle interval rather than
   * debouncing: a continuous feed must not starve the refresh forever, just coalesce it.
   */
  private scheduleA11yRefresh(): void {
    if (this.a11yTimer) return;
    const view = this.doc.defaultView;
    const run = (): void => {
      this.a11yTimer = 0;
      this.refreshA11y();
    };
    this.a11yTimer = view ? view.setTimeout(run, DERIVED_THROTTLE_MS) : (run(), 0);
  }

  /** Refresh the natural-language description and embedded JSON. Off the frame path. */
  private updateSummary(): void {
    const s = this.summary();
    this.summaryEl.textContent = describeSummary(
      s,
      this.options.formatX,
      this.options.formatY,
      this.strings,
    );
    this.dataScript.textContent = JSON.stringify(s);
  }

  private describeChart(): string {
    const help = this.annotations.length
      ? `${this.strings.keyboardHelp} ${this.strings.eventKeysHelp}`
      : this.strings.keyboardHelp;
    return format(this.strings.chartName, {
      name: this.options.ariaLabel ?? 'Chart',
      series: this.series.length,
      points: this.data.n.toLocaleString(),
      help,
    });
  }

  private measure(): void {
    const rect = this.plot.getBoundingClientRect();
    const w = Math.max(0, Math.round(rect.width));
    const h = Math.max(0, Math.round(rect.height));
    if (w === this.width && h === this.height) return;
    // A laid-out-but-zero-height container (a real width, no height) renders nothing — the
    // commonest mount mistake (`.fc-root` is height:100%, so an auto-height ancestor collapses
    // it to 0). `frame()` already declines to paint at height <= 0 — no flash-then-collapse —
    // but the integrator gets no signal, so warn once with the fix. See README "Sizing".
    if (w > 0 && h <= 0 && !this.warnedZeroHeight) {
      this.warnedZeroHeight = true;
      console.warn(
        'fcharts: chart container has 0 height — nothing will render. Set an explicit height on ' +
          'the container or a definite-height ancestor (the root is height:100%), e.g. ' +
          'style="height:320px", or wrap it in position:relative;height:Npx + the mount at ' +
          'position:absolute;inset:0. See the README "Sizing" note.',
      );
    }
    this.width = w;
    this.height = h;
    this.dpr = Math.min(this.options.maxDpr, this.doc.defaultView?.devicePixelRatio ?? 1);
    this.ticksDirty = true;
    this.positionSurface();
    if (this.path === 'html-in-canvas') this.sizeCanvasChildTicks();
    this.requestRender();
  }

  /**
   * Give the canvas-child tick layer an explicit size. A `layoutsubtree` child cannot size
   * itself against the canvas box — `position:absolute; inset:0` resolves to 0×0 (Chrome 149),
   * so every composite would snapshot an empty layer and the path would self-heal away even
   * though the API works. Explicit px sizing keeps its geometry identical to the overlay case.
   */
  private sizeCanvasChildTicks(): void {
    this.axisTicks.el.style.width = `${this.width}px`;
    this.axisTicks.el.style.height = `${this.height}px`;
  }

  private positionSurface(): void {
    const m = this.margins;
    this.surface.style.inset = `${m.top}px ${m.right}px ${m.bottom}px ${m.left}px`;
  }

  private scales(): { xScale: LinearScale; yScale: LinearScale } {
    const m = this.margins;
    const xScale = linearScale(this.domain, [m.left, this.width - m.right]);
    const makeY = this.options.yScale === 'log' ? logScale : linearScale;
    const yScale = makeY(this.yDomain, [this.height - m.bottom, m.top]);
    return { xScale, yScale };
  }

  /** Axis tick values for the current domains, honoring `xType`/`xInteger` and `yScale`. */
  private xAxisTicks(count: number): number[] {
    const [d0, d1] = this.domain;
    if (this.options.xType === 'time') return niceTimeTicks(d0, d1, count);
    return niceTicks(d0, d1, count, this.options.xInteger ? 1 : 0);
  }

  private yAxisTicks(count: number): number[] {
    const [d0, d1] = this.yDomain;
    return this.options.yScale === 'log' ? logTicks(d0, d1, count) : niceTicks(d0, d1, count);
  }

  private frame(): void {
    if (this.width <= 0 || this.height <= 0) return;
    const { xScale, yScale } = this.scales();
    const m = this.margins;
    // Thin tick density at narrow sizes so fixed-size labels don't overlap (1.4.10 reflow).
    const xCount = effectiveTickCount(this.options.xTickCount, this.width - m.left - m.right, 64);
    const yCount = effectiveTickCount(this.options.yTickCount, this.height - m.top - m.bottom, 28);
    const xTicks = this.xAxisTicks(xCount);
    const yTicks = this.yAxisTicks(yCount);

    if (this.ticksDirty) {
      this.axisTicks.update({
        xTicks,
        yTicks,
        xScale,
        yScale,
        formatX: this.options.formatX,
        formatY: this.options.formatY,
        margins: this.margins,
        width: this.width,
        height: this.height,
      });
      this.ticksDirty = false;
    }

    const scene: RenderScene = {
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      margins: this.margins,
      data: this.data,
      series: this.series,
      xScale,
      yScale,
      domain: this.domain,
      xTicks,
      yTicks,
      // Suppress the sample crosshair while a marker is focused, so hovering a diamond reads as
      // "this event" rather than "this sample" — the highlighted marker carries the position.
      cursor: this.cursorActive && this.hoveredAnn === null ? this.cursor : null,
      annotations: this.annotations,
      hoveredAnnotation: this.hoveredAnn,
      selectedAnnotation: this.selectedAnn,
      reducedMotion: this.options.reducedMotion,
      highContrast: this.options.highContrast,
      forcedColors: this.options.forcedColors,
    };
    this.renderer.render(scene);
    if (this.path === 'html-in-canvas') this.compositeTicks();

    if (this.cursorActive || this.hoveredAnn !== null || this.selectedAnn !== null) {
      this.updateReadout(xScale, yScale);
    }
  }

  /**
   * Draw the canvas-placed tick layer into the bitmap via HTML-in-Canvas. The first frames
   * legitimately miss (no paint snapshot exists yet); if compositing never succeeds we fall
   * back to a visible DOM overlay so the ticks can never vanish on an unexpected API change.
   */
  private compositeTicks(): void {
    // The paint snapshot for the canvas-placed children isn't ready until the browser has
    // painted them at least once. How that surfaces changed across Chrome: M148 throws ("no
    // cached paint record" → composite() returns false), M149+ "succeeds" but paints no pixels.
    // Treat both as the same warm-up miss: nudge another frame (render-on-demand would otherwise
    // stop before the snapshot exists) and retry. If the gutter never gains pixels within the
    // miss budget the API is lying (observed on some dev builds) — self-heal to the visible DOM
    // overlay so the axes can never vanish. Once verified, skip the per-frame readback.
    const painted =
      this.compositor.composite(this.axisTicks.el) &&
      (this.hicVerified || this.compositePaintedTicks());
    if (!painted) {
      if (++this.hicMisses > 8) this.fallbackToOverlay();
      else this.requestRender();
      return;
    }
    this.hicMisses = 0;
    this.hicVerified = true;
  }

  /**
   * Read back the left y-axis gutter and report whether the composite actually painted there. The
   * canvas renderer draws no text and keeps grid + axis lines inside `margins.left`, so the gutter
   * is transparent unless the composited tick layer (labels + axis titles) painted into it.
   */
  private compositePaintedTicks(): boolean {
    const ctx = this.canvas.getContext('2d');
    const gutter = Math.round((this.margins.left - 3) * this.dpr);
    const h = Math.round(this.height * this.dpr);
    if (!ctx || gutter < 1 || h < 1) return false;
    try {
      const { data } = ctx.getImageData(0, 0, gutter, h);
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return true; // any opaque pixel
      return false;
    } catch {
      return false; // an unreadable bitmap (tainted/unsupported) → fall back; axes stay visible
    }
  }

  /** Re-show the tick layer as a normal CSS overlay and stop using the HTML-in-Canvas path. */
  private fallbackToOverlay(): void {
    this.path = 'dom-overlay';
    this.canvas.removeAttribute('layoutsubtree');
    this.axisTicks.el.style.transform = '';
    // Back to the stylesheet's inset:0 sizing — the overlay tracks the plot on resize by itself.
    this.axisTicks.el.style.width = '';
    this.axisTicks.el.style.height = '';
    this.plot.insertBefore(this.axisTicks.el, this.surface);
    this.ticksDirty = true;
    this.reportPath();
    this.requestRender();
  }

  /** Notify `options.onRenderPath` when the live render path changes (e.g. on self-heal). */
  private reportPath(): void {
    if (this.path === this.reportedPath) return;
    this.reportedPath = this.path;
    this.options.onRenderPath?.(this.path);
  }

  // --- accessibility-driven updates ---

  private scheduleTableUpdate(): void {
    // Throttle, don't debounce: resetting the timer per call would postpone the table forever
    // under a continuous append stream — it must go at most one interval stale.
    if (this.tableTimer) return;
    const view = this.doc.defaultView;
    const run = (): void => {
      this.tableTimer = 0;
      this.tableAlt.update({
        data: this.data,
        series: this.series,
        domain: this.domain,
        formatX: this.options.formatX,
        formatY: this.options.formatY,
        caption: this.options.ariaLabel ?? 'Chart data',
        captionTemplate: this.strings.tableCaption,
        xLabel: this.options.xLabel,
        ohlc: this.strings,
      });
    };
    this.tableTimer = view ? view.setTimeout(run, DERIVED_THROTTLE_MS) : (run(), 0);
  }

  private toggleSeries(index: number): void {
    const s = this.series[index];
    if (!s) return;
    s.visible = !s.visible;
    this.legend?.update(this.series);
    if (!this.series[this.cursor.series]?.visible) this.cursor.series = this.firstVisibleSeries();
    this.refreshDerived();
    this.requestRender();
  }

  /** Natural-language text for the focused sample, or null when there's nothing to describe. */
  private currentSampleText(): string | null {
    const s = this.series[this.cursor.series];
    // Guard visibility too: when every series is hidden, the cursor falls back to series 0
    // (which is hidden), and neither the announcement nor the value target should leak it.
    if (!s || !s.visible || this.data.n === 0) return null;
    const x = this.data.x[this.cursor.index];
    const lx = this.options.xLabel ?? 'x';
    let base: string;
    if (s.type === 'candle') {
      const [o, h, l, c] = this.candleAt(s, this.cursor.index);
      const fy = this.options.formatY;
      const w = this.strings;
      base =
        `${s.name} — ${lx} ${this.options.formatX(x)}, ${w.open} ${fy(o)}, ` +
        `${w.high} ${fy(h)}, ${w.low} ${fy(l)}, ${w.close} ${fy(c)}`;
    } else {
      const v = this.data.y[s.index][this.cursor.index];
      const ly = this.options.yLabel ?? 'value';
      base = `${s.name} — ${lx} ${this.options.formatX(x)}, ${ly} ${this.options.formatY(v)}`;
    }
    // Surface any event markers on this sample so they're reachable in the keyboard walk.
    const labels = this.annotationLabelsAt(this.cursor.series, this.cursor.index);
    return labels.length ? `${base} · ${labels.join('; ')}` : base;
  }

  /** Labels of annotations attached to the sample at (series position, sample index): point
   *  markers on that series whose nearest sample is `idx`, plus any rule nearest to `idx`. */
  private annotationLabelsAt(seriesPos: number, idx: number): string[] {
    if (this.annotations.length === 0) return [];
    const out: string[] = [];
    for (const a of this.annotations) {
      if (a.kind === 'rule') {
        if (nearestIndex(this.data.x, a.x) === idx) out.push(a.label);
      } else if (a.seriesIndex === seriesPos) {
        const pt = annotationSample(this.data, this.series, a);
        if (pt && pt.index === idx) out.push(a.label);
      }
    }
    return out;
  }

  /** The [open, high, low, close] of a candle series at a sample index. */
  private candleAt(s: ResolvedSeries, i: number): [number, number, number, number] {
    const y = this.data.y;
    return [y[s.index][i], y[s.index + 1][i], y[s.index + 2][i], y[s.index + 3][i]];
  }

  /** Announce the current cursor position immediately (used on focus — a single event). */
  private announceNow(): void {
    const text = this.currentSampleText();
    if (text) this.liveRegion.announce(text);
  }

  /**
   * Mirror the focused sample into the aria-describedby target so it is a programmatically
   * queryable value (4.1.2), not only a transient live announcement. Updated synchronously
   * with the cursor (unlike the debounced live region); cleared when the cursor is inactive.
   */
  private updateActiveSample(): void {
    this.activeSample.textContent = this.cursorActive ? (this.currentSampleText() ?? '') : '';
  }

  /** Sound the focused value (pitch maps the value within its series range), if sonify is on. */
  private sonifyCursor(): void {
    const s = this.series[this.cursor.series];
    if (!this.sonifier || !s || !s.visible || this.data.n === 0) return;
    if (s.type === 'candle') {
      // Pitch the close within the full traded range (low stats → high stats).
      const lo = this.data.stats[s.index + 2].min;
      const hi = this.data.stats[s.index + 1].max;
      this.sonifier.play(this.data.y[s.index + 3][this.cursor.index], lo, hi);
      return;
    }
    const st = this.data.stats[s.index];
    this.sonifier.play(this.data.y[s.index][this.cursor.index], st.min, st.max);
  }

  /** Coalesce announcements during rapid movement (key-repeat, hover) to the settled point. */
  private queueAnnounce(): void {
    const view = this.doc.defaultView;
    if (this.announceTimer) view?.clearTimeout(this.announceTimer);
    const run = (): void => this.announceNow();
    this.announceTimer = view ? view.setTimeout(run, ANNOUNCE_DEBOUNCE_MS) : (run(), 0);
  }

  /** The marker that owns the readout/highlight: a live hover wins over a standing selection. */
  private focusAnn(): number | null {
    return this.hoveredAnn ?? this.selectedAnn;
  }

  /** Position the readout on a focused event marker and show its label. Hides if the marker is
   *  off-screen or its series is toggled off. */
  private annotationReadout(i: number, xScale: LinearScale, yScale: LinearScale): void {
    const a = this.annotations[i];
    const hide = (): void => this.readout.el.classList.remove('fc-show');
    if (!a) return hide();
    const px = xScale(a.x);
    if (px < this.margins.left - 2 || px > this.width - this.margins.right + 2) return hide();
    let py = this.margins.top + 14;
    if (a.kind !== 'rule') {
      const s = this.series[a.seriesIndex];
      if (s && !s.visible) return hide();
      const pt = annotationSample(this.data, this.series, a);
      if (!pt) return hide();
      py = yScale(pt.y);
    }
    this.readout.swatch.style.background = a.color;
    this.readout.name.textContent = a.label;
    this.readout.value.textContent = this.options.formatX(a.x);
    this.readout.el.style.left = `${px}px`;
    this.readout.el.style.top = `${py - 8}px`;
    this.readout.el.classList.add('fc-show');
  }

  private updateReadout(xScale: LinearScale, yScale: LinearScale): void {
    const fa = this.focusAnn();
    if (fa !== null) {
      this.annotationReadout(fa, xScale, yScale);
      return;
    }
    const s = this.series[this.cursor.series];
    if (!s || !s.visible || this.data.n === 0) {
      this.readout.el.classList.remove('fc-show');
      return;
    }
    const x = this.data.x[this.cursor.index];
    const candle = s.type === 'candle' ? this.candleAt(s, this.cursor.index) : null;
    const v = candle ? candle[3] : this.data.y[s.index][this.cursor.index];
    const px = xScale(x);
    const py = yScale(v);
    if (px < this.margins.left - 2 || px > this.width - this.margins.right + 2) {
      this.readout.el.classList.remove('fc-show');
      return;
    }
    this.readout.swatch.style.background = candle
      ? (candle[3] >= candle[0] ? s.upColor : s.downColor)
      : s.color;
    this.readout.name.textContent = s.name;
    const fy = this.options.formatY;
    // The readout is aria-hidden (the live region speaks full words); abbreviations are visual-only.
    const valueText = candle
      ? `${this.options.formatX(x)} · O ${fy(candle[0])} H ${fy(candle[1])} L ${fy(candle[2])} C ${fy(candle[3])}`
      : `${this.options.formatX(x)} · ${fy(v)}`;
    const labels = this.annotationLabelsAt(this.cursor.series, this.cursor.index);
    this.readout.value.textContent = labels.length ? `${valueText} · ${labels.join('; ')}` : valueText;
    this.readout.el.style.left = `${px}px`;
    this.readout.el.style.top = `${py - 8}px`;
    this.readout.el.classList.add('fc-show');
  }

  // --- interaction ---

  /**
   * Index of the event marker within {@link ANNOTATION_HIT_PX} of the pointer, or null. Point
   * markers use 2-D distance to their diamond; rules use horizontal distance to the line. The
   * nearest qualifying marker wins, so clustered events stay individually selectable.
   */
  private annotationAt(clientX: number, clientY: number): number | null {
    if (this.annotations.length === 0) return null;
    const rect = this.plot.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const { xScale, yScale } = this.scales();
    const r2 = ANNOTATION_HIT_PX * ANNOTATION_HIT_PX;
    let best: number | null = null;
    let bestD = r2;
    for (let i = 0; i < this.annotations.length; i++) {
      const a = this.annotations[i];
      const dx = lx - xScale(a.x);
      let d = dx * dx;
      if (a.kind !== 'rule') {
        const s = this.series[a.seriesIndex];
        if (s && !s.visible) continue;
        const pt = annotationSample(this.data, this.series, a);
        if (!pt) continue;
        const dy = ly - yScale(pt.y);
        d += dy * dy;
      }
      if (d <= r2 && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  /** Move keyboard focus to an event marker: align the sample cursor (for the SR announcement),
   *  bring it into view, and announce it. */
  private focusAnnotation(i: number): void {
    const a = this.annotations[i];
    if (!a) return;
    this.hoveredAnn = i;
    this.cursorActive = true;
    const pt = a.kind === 'rule' ? null : annotationSample(this.data, this.series, a);
    this.cursor = {
      series: a.kind === 'rule' ? this.cursor.series : a.seriesIndex,
      index: pt ? pt.index : nearestIndex(this.data.x, a.x),
    };
    const [b0, b1] = this.domain;
    this.domain = panToInclude(this.domain, a.x);
    if (this.domain[0] !== b0 || this.domain[1] !== b1) this.emitDomain();
    this.ticksDirty = true;
    this.scheduleTableUpdate();
    this.updateActiveSample();
    this.announceAnnotation(i);
    this.requestRender();
  }

  /** Step keyboard focus to the next/previous event marker by date. */
  private stepAnnotation(dir: 1 | -1): void {
    const fromX = this.hoveredAnn !== null ? this.annotations[this.hoveredAnn]?.x ?? null : null;
    const idx = annotationIndexByX(this.annotations.map((a) => a.x), fromX, dir);
    if (idx !== null) this.focusAnnotation(idx);
  }

  /** Toggle the pinned selection on the currently focused marker (Enter, or a marker click). */
  private toggleSelectAnnotation(i: number): void {
    this.selectedAnn = this.selectedAnn === i ? null : i;
    this.hoveredAnn = i;
    this.announceAnnotation(i);
    this.requestRender();
  }

  private announceAnnotation(i: number): void {
    const a = this.annotations[i];
    if (!a) return;
    const suffix = this.selectedAnn === i ? `, ${this.strings.selected}` : '';
    this.liveRegion.announce(`${a.label}, ${this.options.formatX(a.x)}${suffix}`);
  }

  private attachEvents(): void {
    const signal = this.listeners.signal;
    const s = this.surface;
    s.addEventListener('focus', () => this.onFocus(), { signal });
    s.addEventListener('blur', () => this.onBlur(), { signal });
    s.addEventListener('keydown', (e) => this.onKeyDown(e), { signal });
    s.addEventListener('wheel', (e) => this.onWheel(e), { signal, passive: false });
    s.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
    s.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
    s.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
    s.addEventListener('pointercancel', (e) => this.onPointerUp(e), { signal });
    s.addEventListener('pointerleave', () => this.onPointerLeave(), { signal });
  }

  private onFocus(): void {
    this.cursorActive = true;
    this.updateActiveSample();
    this.announceNow();
    this.sonifyCursor();
    this.requestRender();
  }

  private onBlur(): void {
    if (this.dragging) return;
    this.cursorActive = false;
    this.updateActiveSample();
    this.readout.el.classList.remove('fc-show');
    this.requestRender();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!handlesKey(e.key)) return;
    e.preventDefault();
    if (e.key === 'Escape') {
      this.selectedAnn = null;
      this.hoveredAnn = null;
      this.dismissCursor();
      return;
    }
    const annDir = annotationStep(e.key);
    if (annDir !== null) {
      this.stepAnnotation(annDir);
      return;
    }
    if (selectsAnnotation(e.key)) {
      if (this.hoveredAnn !== null) this.toggleSelectAnnotation(this.hoveredAnn);
      return;
    }
    const factor = zoomFactor(e.key);
    if (factor !== null) {
      this.zoomAroundCursor(factor);
      return;
    }
    const next = stepCursor(this.cursor, e.key, {
      n: this.data.n,
      visibleCount: this.visibleCount(),
      seriesVisible: this.series.map((sr) => sr.visible),
      fine: e.shiftKey,
    });
    if (!next) return;
    this.cursor = next;
    this.hoveredAnn = null; // an arrow press returns to sample navigation
    this.cursorActive = true;
    this.updateActiveSample();
    this.sonifyCursor();
    const [b0, b1] = this.domain;
    this.domain = panToInclude(this.domain, this.data.x[this.cursor.index]);
    if (this.domain[0] !== b0 || this.domain[1] !== b1) {
      this.ticksDirty = true;
      this.scheduleTableUpdate();
      this.emitDomain();
    }
    this.queueAnnounce();
    this.requestRender();
  }

  /** Dismiss the cursor/readout (Escape) without moving focus, so a later arrow re-activates it. */
  private dismissCursor(): void {
    this.cursorActive = false;
    this.updateActiveSample();
    this.readout.el.classList.remove('fc-show');
    this.requestRender();
  }

  /** Zoom the x-domain around the current cursor sample (keyboard equivalent of wheel-zoom). */
  private zoomAroundCursor(factor: number): void {
    const [d0, d1] = this.domain;
    const cx = this.data.n > 0 ? this.data.x[this.cursor.index] : (d0 + d1) / 2;
    this.cursorActive = true;
    this.updateActiveSample();
    this.setDomain([cx - (cx - d0) * factor, cx + (d1 - cx) * factor]);
  }

  /** Single-pointer pan: shift the visible window ~one page earlier/later (WCAG 2.5.7). */
  private panPage(dir: -1 | 1): void {
    const [d0, d1] = this.domain;
    const shift = dir * (d1 - d0) * 0.9;
    this.setDomain([d0 + shift, d1 + shift]);
    this.keepCursorInView();
  }

  /** Show/disable the pan pagers based on whether (and which way) the view can pan. */
  private updatePagers(): void {
    const [lo, hi] = this.viewExtent();
    this.pagers.update(this.domain[0] <= lo, this.domain[1] >= hi);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const px = e.clientX - this.plot.getBoundingClientRect().left;
    const { xScale } = this.scales();
    const cx = xScale.invert(px);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const [d0, d1] = this.domain;
    this.setDomain([cx - (cx - d0) * factor, cx + (d1 - cx) * factor]);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const hit = this.annotationAt(e.clientX, e.clientY);
    if (hit !== null) {
      this.toggleSelectAnnotation(hit); // click a marker to pin/unpin it, not to start a pan
      return;
    }
    if (this.selectedAnn !== null) {
      this.selectedAnn = null; // a click on empty space clears the pinned selection
      this.requestRender();
    }
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartDomain = [...this.domain];
    this.surface.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.dragging) {
      const plotW = Math.max(1, this.width - this.margins.left - this.margins.right);
      const span = this.dragStartDomain[1] - this.dragStartDomain[0];
      const shift = ((e.clientX - this.dragStartX) / plotW) * span;
      this.setDomain([this.dragStartDomain[0] - shift, this.dragStartDomain[1] - shift]);
      return;
    }
    const hit = this.annotationAt(e.clientX, e.clientY);
    if (hit !== null) {
      if (hit !== this.hoveredAnn) {
        this.hoveredAnn = hit;
        this.requestRender();
      }
      return;
    }
    if (this.hoveredAnn !== null) {
      this.hoveredAnn = null;
      this.requestRender();
    }
    this.hoverAt(e.clientX);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.surface.hasPointerCapture(e.pointerId)) {
      this.surface.releasePointerCapture(e.pointerId);
    }
  }

  private onPointerLeave(): void {
    if (this.dragging || this.doc.activeElement === this.surface) return;
    this.hoveredAnn = null;
    this.cursorActive = false;
    this.updateActiveSample();
    // Keep a pinned selection's readout up; the next frame repaints it from selectedAnn.
    if (this.selectedAnn === null) this.readout.el.classList.remove('fc-show');
    this.requestRender();
  }

  private hoverAt(clientX: number): void {
    if (this.data.n === 0) return;
    const px = clientX - this.plot.getBoundingClientRect().left;
    const { xScale } = this.scales();
    const xv = xScale.invert(px);
    const idx = nearestIndex(this.data.x, xv);
    this.cursor = { series: this.cursor.series, index: idx };
    if (!this.series[this.cursor.series]?.visible) this.cursor.series = this.firstVisibleSeries();
    this.cursorActive = true;
    this.updateActiveSample();
    this.queueAnnounce();
    this.requestRender();
  }

  private visibleCount(): number {
    if (this.data.n === 0) return 1;
    const i0 = Math.max(0, lowerBound(this.data.x, this.domain[0]) - 1);
    const i1 = Math.min(this.data.n - 1, lowerBound(this.data.x, this.domain[1]));
    return Math.max(1, i1 - i0 + 1);
  }

  /** Clamp + apply a new x-domain (no render). Returns whether the domain changed. */
  private applyDomain(next: readonly [number, number]): boolean {
    const [lo, hi] = this.viewExtent();
    const minSpan = ((hi - lo) / Math.max(1, this.data.n - 1)) * 4 || 1e-9;
    let a = next[0];
    let b = next[1];
    if (b - a < minSpan) {
      const mid = (a + b) / 2;
      a = mid - minSpan / 2;
      b = mid + minSpan / 2;
    }
    if (a < lo) {
      b += lo - a;
      a = lo;
    }
    if (b > hi) {
      a -= b - hi;
      b = hi;
    }
    a = Math.max(lo, a);
    b = Math.min(hi, b);
    if (a === this.domain[0] && b === this.domain[1]) return false;
    this.domain = [a, b];
    this.ticksDirty = true;
    this.scheduleTableUpdate();
    this.updatePagers();
    this.emitDomain();
    return true;
  }

  /** Apply a new x-domain with clamping and request an async render. */
  private setDomain(next: readonly [number, number]): void {
    if (this.applyDomain(next)) this.requestRender();
  }
}

/**
 * True when two option objects agree on every construction-time option (`legend`, `sonify`,
 * `strings`) — i.e. an existing chart built with `a` can absorb `b` via `update()`. Adapters
 * use this to decide between updating in place and remounting (see the React wrapper).
 */
export function sameConstructionOptions(a: FChartOptions = {}, b: FChartOptions = {}): boolean {
  if ((a.legend ?? true) !== (b.legend ?? true)) return false;
  if ((a.sonify ?? false) !== (b.sonify ?? false)) return false;
  if ((a.exportControl ?? false) !== (b.exportControl ?? false)) return false;
  const sa = a.strings ?? {};
  const sb = b.strings ?? {};
  const keys = Object.keys({ ...sa, ...sb }) as (keyof FChartStrings)[];
  return keys.every((k) => sa[k] === sb[k]);
}

function failFixed(name: string): never {
  throw new Error(
    `fcharts: option "${name}" is fixed at construction; update() cannot rewire it. ` +
      'Recreate the chart to change it (the React adapter remounts automatically).',
  );
}

function prefers(doc: Document, query: string): boolean {
  return doc.defaultView?.matchMedia?.(query).matches ?? false;
}

/** RFC 4180 field quoting (only header cells can need it; data cells are numbers). */
function csvQuote(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

