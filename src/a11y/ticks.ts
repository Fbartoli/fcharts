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

    if (yLabel) this.el.append(this.axisTitle('y', yLabel));
    if (xLabel) this.el.append(this.axisTitle('x', xLabel));
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
  }

  destroy(): void {
    this.el.remove();
  }
}
