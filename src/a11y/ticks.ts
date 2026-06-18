/**
 * DOM axis ticks — real positioned text over the canvas.
 *
 * Because these are real text nodes (not canvas pixels), they are in the accessibility
 * tree, findable with Ctrl+F, selectable, and translatable. They are rebuilt only when the
 * domain or size changes (coalesced), never every frame.
 */
import type { LinearScale } from '../core/scales.ts';
import type { Margins } from '../core/model.ts';

export interface TickUpdate {
  xTicks: readonly number[];
  yTicks: readonly number[];
  xScale: LinearScale;
  yScale: LinearScale;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  margins: Margins;
  width: number;
  height: number;
}

export class AxisTicks {
  readonly el: HTMLElement;
  private readonly xLayer: HTMLElement;
  private readonly yLayer: HTMLElement;
  private readonly doc: Document;
  private xTitle: HTMLElement | null = null;
  private yTitle: HTMLElement | null = null;

  constructor(doc: Document = document, xLabel?: string, yLabel?: string) {
    this.doc = doc;
    this.el = doc.createElement('div');
    this.el.className = 'fc-ticks';
    this.el.setAttribute('aria-hidden', 'false');

    this.yLayer = doc.createElement('div');
    this.yLayer.className = 'fc-ticks-y';
    this.xLayer = doc.createElement('div');
    this.xLayer.className = 'fc-ticks-x';
    this.el.append(this.yLayer, this.xLayer);

    this.setLabels(xLabel, yLabel);
  }

  /** Replace the axis titles (FChart.update() calls this when xLabel/yLabel change). */
  setLabels(xLabel?: string, yLabel?: string): void {
    for (const title of this.el.querySelectorAll('.fc-axis-title')) title.remove();
    this.yTitle = yLabel ? this.axisTitle('y', yLabel) : null;
    this.xTitle = xLabel ? this.axisTitle('x', xLabel) : null;
    if (this.yTitle) this.el.append(this.yTitle);
    if (this.xTitle) this.el.append(this.xTitle);
  }

  private axisTitle(axis: 'x' | 'y', text: string): HTMLElement {
    const span = this.doc.createElement('span');
    span.className = `fc-axis-title fc-axis-title-${axis}`;
    span.textContent = text;
    return span;
  }

  private tick(axis: 'x' | 'y', text: string, pos: number): HTMLElement {
    const span = this.doc.createElement('span');
    span.className = `fc-tick fc-tick-${axis}`;
    span.textContent = text;
    if (axis === 'x') span.style.left = `${pos}px`;
    else span.style.top = `${pos}px`;
    return span;
  }

  /** Rebuild tick labels. Cheap (a dozen nodes); call only on domain/size change. */
  update(u: TickUpdate): void {
    const m = u.margins;
    const left = m.left;
    const right = u.width - m.right;
    const top = m.top;
    const bottom = u.height - m.bottom;

    this.yLayer.replaceChildren(
      ...u.yTicks
        .filter((v) => {
          const py = u.yScale(v);
          return py >= top - 1 && py <= bottom + 1;
        })
        .map((v) => this.tick('y', u.formatY(v), u.yScale(v))),
    );
    this.xLayer.replaceChildren(
      ...u.xTicks
        .filter((t) => {
          const px = u.xScale(t);
          return px >= left - 1 && px <= right + 1;
        })
        .map((t) => this.tick('x', u.formatX(t), u.xScale(t))),
    );
    this.pruneTitleCollisions();
  }

  /**
   * Drop tick labels that would run into an axis title — the x title shares the bottom row
   * with the x labels (and the y title the left gutter), so a tick landing at the plot edge
   * would otherwise overlap it. Measured, not estimated, so it holds for localized titles.
   * Runs only on tick rebuilds (domain/size change), never per frame.
   */
  private pruneTitleCollisions(): void {
    const xTitle = this.xTitle?.isConnected ? this.xTitle : null;
    const yTitle = this.yTitle?.isConnected ? this.yTitle : null;
    if (!xTitle && !yTitle) return;
    // Make titles measurable first (they may be hidden from a previous cramped layout), then
    // do all layout reads before any removal: interleaving a removal between offset reads
    // would force one reflow per pruned label, and this runs every streamed frame while the
    // view follows the live tail. One write phase + one read pass + one write phase.
    if (xTitle) xTitle.style.display = '';
    if (yTitle) yTitle.style.display = '';
    const doomed: HTMLElement[] = [];
    if (xTitle) this.collectCollisions(xTitle, 'x', doomed);
    if (yTitle) this.collectCollisions(yTitle, 'y', doomed);
    for (const span of doomed) span.remove();
  }

  /**
   * Collect tick labels colliding with `title` into `doomed` — unless that would leave fewer
   * than two labels on the axis. In that cramped case the data labels win: hide the title
   * instead (values are what 1.4.10 reflow must keep usable; the axis name stays available
   * programmatically via the chart's accessible description and table headers).
   */
  private collectCollisions(title: HTMLElement, axis: 'x' | 'y', doomed: HTMLElement[]): void {
    const layer = axis === 'x' ? this.xLayer : this.yLayer;
    // Tick spans are centered via translate(-50%): offsetLeft/offsetTop is the center.
    const limit =
      axis === 'x' ? title.offsetLeft - 6 : title.offsetTop + title.offsetHeight + 4;
    const colliding: HTMLElement[] = [];
    for (const span of layer.children as HTMLCollectionOf<HTMLElement>) {
      const hits =
        axis === 'x'
          ? span.offsetLeft + span.offsetWidth / 2 > limit
          : span.offsetTop - span.offsetHeight / 2 < limit;
      if (hits) colliding.push(span);
    }
    if (layer.children.length - colliding.length >= 2) doomed.push(...colliding);
    else title.style.display = 'none';
  }

  destroy(): void {
    this.el.remove();
  }
}
