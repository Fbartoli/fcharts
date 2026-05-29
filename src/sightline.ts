/**
 * Sightline — the public chart class. Wires the renderer-agnostic core, the Canvas2D
 * renderer, the render scheduler, the interaction handlers (wheel-zoom, drag-pan,
 * keyboard cursor, hover), and the always-on accessibility layer into one component.
 *
 * Accessibility is load-bearing, not a flag: the DOM tick text, accessible legend,
 * keyboard-navigable data surface with live-region announcements, and the hidden data
 * table are all constructed by default and updated as part of the render lifecycle.
 */
import {
  ChartData,
  resolveSeries,
  DEFAULT_MARGINS,
  type CursorState,
  type Margins,
  type ResolvedSeries,
  type SeriesConfig,
  type SightlineData,
} from './core/model.ts';
import { linearScale, type LinearScale } from './core/scales.ts';
import { niceTicks, formatTick } from './core/ticks.ts';
import { lowerBound } from './core/downsample.ts';
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
import { injectStyles } from './a11y/styles.ts';
import { LiveRegion } from './a11y/live-region.ts';
import { AxisTicks } from './a11y/ticks.ts';
import { Legend } from './a11y/legend.ts';
import { TableAlt } from './a11y/table-alt.ts';
import { buildSummary, describeSummary, type ChartSummary } from './a11y/summary.ts';
import { handlesKey, panToInclude, stepCursor, zoomFactor } from './a11y/cursor.ts';
import { format, resolveStrings, type SightlineStrings } from './a11y/strings.ts';

type Formatter = (value: number) => string;

export interface SightlineOptions {
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
  /** Treat x as integer indices (ticks step >= 1). Default false. */
  xInteger?: boolean;
  xTickCount?: number;
  yTickCount?: number;
  formatX?: Formatter;
  formatY?: Formatter;
  /** Force reduced-motion behavior (otherwise auto-detected). */
  reducedMotion?: boolean;
  /** Force high-contrast behavior (otherwise auto-detected). */
  highContrast?: boolean;
  /** Localize the library's fixed UI strings (legend, keyboard help, summary, caption). */
  strings?: Partial<SightlineStrings>;
}

export interface SightlineConfig {
  series: SeriesConfig[];
  data?: SightlineData;
  options?: SightlineOptions;
}

const TABLE_THROTTLE_MS = 150;
// Coalesce live-region announcements: holding an arrow key fires keydowns at the OS repeat
// rate, which would flood a polite live region. Announce only the settled position.
const ANNOUNCE_DEBOUNCE_MS = 100;

let instanceSeq = 0;

interface ReadoutEls {
  el: HTMLElement;
  swatch: HTMLElement;
  name: HTMLElement;
  value: HTMLElement;
}

export class Sightline {
  private readonly root: HTMLElement;
  private readonly doc: Document;
  private readonly options: Required<
    Omit<SightlineOptions, 'ariaLabel' | 'xLabel' | 'yLabel' | 'strings'>
  > &
    Pick<SightlineOptions, 'ariaLabel' | 'xLabel' | 'yLabel'>;
  private readonly strings: SightlineStrings;

  private series: ResolvedSeries[];
  private data: ChartData;
  private domain: [number, number] = [0, 1];
  private yDomain: [number, number] = [0, 1];
  private cursor: CursorState = { series: 0, index: 0 };
  private cursorActive = false;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly margins: Margins = { ...DEFAULT_MARGINS };

  private ticksDirty = true;
  private tableTimer = 0;
  private announceTimer = 0;
  /** Consecutive HTML-in-Canvas composite misses before falling back to the visible overlay. */
  private hicMisses = 0;

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
  private readonly tableAlt: TableAlt;
  private readonly summaryEl: HTMLElement;
  private readonly activeSample: HTMLElement;
  private readonly dataScript: HTMLElement;
  private readonly readout: ReadoutEls;
  private readonly resizeObserver: ResizeObserver;
  private readonly listeners = new AbortController();

  private dragging = false;
  private dragStartX = 0;
  private dragStartDomain: [number, number] = [0, 1];

  constructor(el: HTMLElement, config: SightlineConfig) {
    this.root = el;
    this.doc = el.ownerDocument;
    this.options = {
      legend: config.options?.legend ?? true,
      maxDpr: config.options?.maxDpr ?? 2,
      yPadding: config.options?.yPadding ?? 0.06,
      xInteger: config.options?.xInteger ?? false,
      xTickCount: config.options?.xTickCount ?? 8,
      yTickCount: config.options?.yTickCount ?? 6,
      formatX: config.options?.formatX ?? formatTick,
      formatY: config.options?.formatY ?? formatTick,
      reducedMotion:
        config.options?.reducedMotion ?? prefers(this.doc, '(prefers-reduced-motion: reduce)'),
      highContrast: config.options?.highContrast ?? prefers(this.doc, '(prefers-contrast: more)'),
      ariaLabel: config.options?.ariaLabel,
      xLabel: config.options?.xLabel,
      yLabel: config.options?.yLabel,
    };
    this.strings = resolveStrings(config.options?.strings);

    injectStyles(this.doc);
    this.series = resolveSeries(config.series);
    this.data = new ChartData(config.data ?? { x: [], y: config.series.map(() => []) });

    // --- DOM ---
    const seq = ++instanceSeq;
    const tableId = `sl-data-${seq}`;
    const summaryId = `sl-summary-${seq}`;
    const activeId = `sl-active-${seq}`;
    this.root.classList.add('sl-root');
    this.liveRegion = new LiveRegion(this.doc);
    this.axisTicks = new AxisTicks(this.doc, this.options.xLabel, this.options.yLabel);
    this.tableAlt = new TableAlt(this.doc);
    this.tableAlt.el.id = tableId;

    // Machine-readable layer: a one-line natural-language summary (aria-describedby, so it
    // is announced and agent-readable) plus a structured JSON block for DOM scrapers.
    this.summaryEl = this.doc.createElement('p');
    this.summaryEl.className = 'sl-sr-only';
    this.summaryEl.id = summaryId;
    // The focused sample as a programmatically-determinable value: an aria-describedby target
    // updated in lockstep with the cursor (vs. the live region, which is a transient
    // announcement). Lets AT/automation *query* the current point, not just hear it announced.
    this.activeSample = this.doc.createElement('span');
    this.activeSample.className = 'sl-sr-only';
    this.activeSample.id = activeId;
    this.dataScript = this.doc.createElement('script');
    this.dataScript.setAttribute('type', 'application/json');
    this.dataScript.setAttribute('data-sightline', 'summary');
    this.legend = this.options.legend
      ? new Legend(this.series, (i) => this.toggleSeries(i), this.strings, this.doc)
      : null;

    this.canvas = this.doc.createElement('canvas');
    this.canvas.className = 'sl-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    this.plot = this.doc.createElement('div');
    this.plot.className = 'sl-plot';

    this.surface = this.doc.createElement('div');
    this.surface.className = 'sl-surface';
    this.surface.tabIndex = 0;
    this.surface.setAttribute('role', 'application');
    this.surface.setAttribute('aria-roledescription', 'interactive chart');
    // Point the focused widget at its data table so screen-reader users can reach it
    // without leaving application mode and blindly browsing.
    this.surface.setAttribute('aria-details', tableId);
    // Describe the data (values + trend) plus the focused sample (updated live) so SR users
    // and AI agents get the overview on focus and can query the current point.
    this.surface.setAttribute('aria-describedby', `${summaryId} ${activeId}`);

    this.readout = buildReadout(this.doc);

    this.renderer = createCanvas2DRenderer(this.canvas);
    this.compositor = createCompositor(this.canvas);
    this.support = detectHtmlInCanvas();
    this.path = resolveRenderPath(this.support);

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
      this.readout.el,
      this.tableAlt.el,
      this.summaryEl,
      this.dataScript,
    );
    this.root.append(this.plot);

    this.scheduler = new RenderScheduler(() => this.frame());

    this.attachEvents();
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.plot);

    this.measure();
    this.resetView();
    // Always run, even without initial data, so the surface has an accessible name and a
    // populated (non-empty) aria-describedby target before any setData().
    this.refreshDerived();
    this.requestRender();
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
    return buildSummary(this.data, this.series, this.options.ariaLabel ?? 'Chart');
  }

  /** Replace the dataset. Resets the view to the full x-domain. */
  setData(data: SightlineData): Sightline {
    this.data = new ChartData(data);
    this.resetView();
    this.refreshDerived();
    this.requestRender();
    return this;
  }

  /**
   * Render immediately and synchronously, optionally to a given x-domain. Bypasses the
   * rAF scheduler — useful for programmatic zoom, print/offscreen capture, and
   * deterministic benchmarking.
   */
  renderSync(domain?: readonly [number, number]): Sightline {
    if (domain) this.applyDomain(domain);
    this.scheduler.cancel(); // honor "bypasses the scheduler": drop any frame already queued
    this.frame();
    return this;
  }

  /** Patch series and/or options. Series visibility/colors update in place. */
  update(patch: Partial<SightlineConfig>): Sightline {
    if (patch.series) this.series = resolveSeries(patch.series);
    if (patch.options) Object.assign(this.options, patch.options);
    if (patch.data) {
      this.data = new ChartData(patch.data);
      this.resetView();
    }
    this.legend?.update(this.series);
    this.refreshDerived();
    this.requestRender();
    return this;
  }

  destroy(): void {
    this.listeners.abort();
    this.resizeObserver.disconnect();
    this.scheduler.destroy();
    this.renderer.destroy();
    const view = this.doc.defaultView;
    if (this.tableTimer) view?.clearTimeout(this.tableTimer);
    if (this.announceTimer) view?.clearTimeout(this.announceTimer);
    this.axisTicks.destroy();
    this.tableAlt.destroy();
    this.legend?.destroy();
    this.liveRegion.destroy();
    this.plot.remove();
    this.root.classList.remove('sl-root');
  }

  // --- internals ---

  private requestRender(): void {
    this.scheduler.request();
  }

  private resetView(): void {
    this.domain = this.data.xExtent();
    this.cursor = { series: this.firstVisibleSeries(), index: Math.floor(this.data.n / 2) };
    this.ticksDirty = true;
  }

  private firstVisibleSeries(): number {
    const i = this.series.findIndex((s) => s.visible);
    return i < 0 ? 0 : i;
  }

  /** Recompute the (fixed) y-domain and refresh the surface label, ticks, and table. */
  private refreshDerived(): void {
    const visible = this.series.map((s) => s.visible);
    const [yMin, yMax] = this.data.yExtent(visible);
    const pad = (yMax - yMin) * this.options.yPadding;
    this.yDomain = [yMin - pad, yMax + pad];
    this.surface.setAttribute('aria-label', this.describeChart());
    this.updateSummary();
    this.updateActiveSample();
    this.ticksDirty = true;
    this.scheduleTableUpdate();
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
    return format(this.strings.chartName, {
      name: this.options.ariaLabel ?? 'Chart',
      series: this.series.length,
      points: this.data.n.toLocaleString(),
      help: this.strings.keyboardHelp,
    });
  }

  private measure(): void {
    const rect = this.plot.getBoundingClientRect();
    const w = Math.max(0, Math.round(rect.width));
    const h = Math.max(0, Math.round(rect.height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.dpr = Math.min(this.options.maxDpr, this.doc.defaultView?.devicePixelRatio ?? 1);
    this.ticksDirty = true;
    this.positionSurface();
    this.requestRender();
  }

  private positionSurface(): void {
    const m = this.margins;
    this.surface.style.inset = `${m.top}px ${m.right}px ${m.bottom}px ${m.left}px`;
  }

  private scales(): { xScale: LinearScale; yScale: LinearScale } {
    const m = this.margins;
    const xScale = linearScale(this.domain, [m.left, this.width - m.right]);
    const yScale = linearScale(this.yDomain, [this.height - m.bottom, m.top]);
    return { xScale, yScale };
  }

  private frame(): void {
    if (this.width <= 0 || this.height <= 0) return;
    const { xScale, yScale } = this.scales();
    const xMinStep = this.options.xInteger ? 1 : 0;
    const xTicks = niceTicks(this.domain[0], this.domain[1], this.options.xTickCount, xMinStep);
    const yTicks = niceTicks(this.yDomain[0], this.yDomain[1], this.options.yTickCount);

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
      cursor: this.cursorActive ? this.cursor : null,
      reducedMotion: this.options.reducedMotion,
      highContrast: this.options.highContrast,
    };
    this.renderer.render(scene);
    if (this.path === 'html-in-canvas') this.compositeTicks();

    if (this.cursorActive) this.updateReadout(xScale, yScale);
  }

  /**
   * Draw the canvas-placed tick layer into the bitmap via HTML-in-Canvas. The first frames
   * legitimately miss (no paint snapshot exists yet); if compositing never succeeds we fall
   * back to a visible DOM overlay so the ticks can never vanish on an unexpected API change.
   */
  private compositeTicks(): void {
    if (this.compositor.composite(this.axisTicks.el)) {
      this.hicMisses = 0;
    } else if (++this.hicMisses > 8) {
      this.fallbackToOverlay();
    } else {
      // The paint snapshot for the canvas-placed children isn't ready until the browser has
      // painted them at least once. Under render-on-demand the loop would otherwise stop before
      // that happens, so nudge another frame until the first draw lands (then it's cached).
      this.requestRender();
    }
  }

  /** Re-show the tick layer as a normal CSS overlay and stop using the HTML-in-Canvas path. */
  private fallbackToOverlay(): void {
    this.path = 'dom-overlay';
    this.canvas.removeAttribute('layoutsubtree');
    this.axisTicks.el.style.transform = '';
    this.plot.insertBefore(this.axisTicks.el, this.surface);
    this.ticksDirty = true;
    this.requestRender();
  }

  // --- accessibility-driven updates ---

  private scheduleTableUpdate(): void {
    const view = this.doc.defaultView;
    if (this.tableTimer) view?.clearTimeout(this.tableTimer);
    const run = (): void => {
      this.tableAlt.update({
        data: this.data,
        series: this.series,
        domain: this.domain,
        formatX: this.options.formatX,
        formatY: this.options.formatY,
        caption: this.options.ariaLabel ?? 'Chart data',
        captionTemplate: this.strings.tableCaption,
        xLabel: this.options.xLabel,
      });
    };
    this.tableTimer = view ? view.setTimeout(run, TABLE_THROTTLE_MS) : (run(), 0);
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

  /** Announce the current cursor position immediately (used on focus — a single event). */
  /** Natural-language text for the focused sample, or null when there's nothing to describe. */
  private currentSampleText(): string | null {
    const s = this.series[this.cursor.series];
    // Guard visibility too: when every series is hidden, the cursor falls back to series 0
    // (which is hidden), and neither the announcement nor the value target should leak it.
    if (!s || !s.visible || this.data.n === 0) return null;
    const x = this.data.x[this.cursor.index];
    const v = this.data.y[s.index][this.cursor.index];
    const lx = this.options.xLabel ?? 'x';
    const ly = this.options.yLabel ?? 'value';
    return `${s.name} — ${lx} ${this.options.formatX(x)}, ${ly} ${this.options.formatY(v)}`;
  }

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

  /** Coalesce announcements during rapid movement (key-repeat, hover) to the settled point. */
  private queueAnnounce(): void {
    const view = this.doc.defaultView;
    if (this.announceTimer) view?.clearTimeout(this.announceTimer);
    const run = (): void => this.announceNow();
    this.announceTimer = view ? view.setTimeout(run, ANNOUNCE_DEBOUNCE_MS) : (run(), 0);
  }

  private updateReadout(xScale: LinearScale, yScale: LinearScale): void {
    const s = this.series[this.cursor.series];
    if (!s || !s.visible || this.data.n === 0) {
      this.readout.el.classList.remove('sl-show');
      return;
    }
    const x = this.data.x[this.cursor.index];
    const v = this.data.y[s.index][this.cursor.index];
    const px = xScale(x);
    const py = yScale(v);
    if (px < this.margins.left - 2 || px > this.width - this.margins.right + 2) {
      this.readout.el.classList.remove('sl-show');
      return;
    }
    this.readout.swatch.style.background = s.color;
    this.readout.name.textContent = s.name;
    this.readout.value.textContent = `${this.options.formatX(x)} · ${this.options.formatY(v)}`;
    this.readout.el.style.left = `${px}px`;
    this.readout.el.style.top = `${py - 8}px`;
    this.readout.el.classList.add('sl-show');
  }

  // --- interaction ---

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
    this.requestRender();
  }

  private onBlur(): void {
    if (this.dragging) return;
    this.cursorActive = false;
    this.updateActiveSample();
    this.readout.el.classList.remove('sl-show');
    this.requestRender();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!handlesKey(e.key)) return;
    e.preventDefault();
    if (e.key === 'Escape') {
      this.dismissCursor();
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
    this.cursorActive = true;
    this.updateActiveSample();
    const [b0, b1] = this.domain;
    this.domain = panToInclude(this.domain, this.data.x[this.cursor.index]);
    if (this.domain[0] !== b0 || this.domain[1] !== b1) {
      this.ticksDirty = true;
      this.scheduleTableUpdate();
    }
    this.queueAnnounce();
    this.requestRender();
  }

  /** Dismiss the cursor/readout (Escape) without moving focus, so a later arrow re-activates it. */
  private dismissCursor(): void {
    this.cursorActive = false;
    this.updateActiveSample();
    this.readout.el.classList.remove('sl-show');
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
    this.cursorActive = false;
    this.updateActiveSample();
    this.readout.el.classList.remove('sl-show');
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
    const [lo, hi] = this.data.xExtent();
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
    return true;
  }

  /** Apply a new x-domain with clamping and request an async render. */
  private setDomain(next: readonly [number, number]): void {
    if (this.applyDomain(next)) this.requestRender();
  }
}

function prefers(doc: Document, query: string): boolean {
  return doc.defaultView?.matchMedia?.(query).matches ?? false;
}

function nearestIndex(x: Float64Array, target: number): number {
  const n = x.length;
  if (n === 0) return 0;
  const hi = lowerBound(x, target);
  if (hi <= 0) return 0;
  if (hi >= n) return n - 1;
  return target - x[hi - 1] <= x[hi] - target ? hi - 1 : hi;
}

function buildReadout(doc: Document): ReadoutEls {
  const el = doc.createElement('div');
  el.className = 'sl-readout';
  el.setAttribute('aria-hidden', 'true');
  const series = doc.createElement('div');
  series.className = 'sl-readout-series';
  const swatch = doc.createElement('span');
  swatch.className = 'sl-readout-swatch';
  const name = doc.createElement('span');
  series.append(swatch, name);
  const value = doc.createElement('div');
  value.className = 'sl-readout-val';
  el.append(series, value);
  return { el, swatch, name, value };
}
