/**
 * Accessible legend — one real `<button aria-pressed>` per series. Toggling a button
 * shows/hides its series. Real buttons mean keyboard focus, Enter/Space activation, and
 * correct screen-reader state come for free.
 */
import type { ResolvedSeries } from '../core/model.ts';
import type { SightlineStrings } from './strings.ts';

type LegendStrings = Pick<SightlineStrings, 'legendGroup' | 'shown' | 'hidden'>;

export class Legend {
  readonly el: HTMLElement;
  private readonly list: HTMLUListElement;
  private readonly doc: Document;
  private readonly onToggle: (index: number) => void;
  private readonly strings: LegendStrings;
  private buttons: HTMLButtonElement[] = [];

  constructor(
    series: readonly ResolvedSeries[],
    onToggle: (index: number) => void,
    strings: LegendStrings,
    doc: Document = document,
  ) {
    this.doc = doc;
    this.onToggle = onToggle;
    this.strings = strings;
    this.el = doc.createElement('div');
    this.el.className = 'sl-legend';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', strings.legendGroup);
    this.list = doc.createElement('ul');
    this.el.append(this.list);
    this.build(series);
  }

  private build(series: readonly ResolvedSeries[]): void {
    this.list.replaceChildren();
    this.buttons = series.map((s) => {
      const li = this.doc.createElement('li');
      const button = this.doc.createElement('button');
      button.type = 'button';
      button.dataset.series = String(s.index);
      button.addEventListener('click', () => this.onToggle(s.index));

      const swatch = this.swatch(s);

      const name = this.doc.createElement('span');
      name.className = 'sl-legend-name';
      name.textContent = s.name;

      const state = this.doc.createElement('span');
      state.className = 'sl-legend-state';
      // Visible-only state cue: aria-pressed already conveys shown/hidden to AT, so keeping
      // this out of the accessible name leaves the button's name as the stable series name.
      state.setAttribute('aria-hidden', 'true');

      button.append(swatch, name, state);
      li.append(button);
      this.list.append(li);
      return button;
    });
    this.sync(series);
  }

  /**
   * Inline-SVG swatch that mirrors the mark: a line with the series' dash pattern (or a filled
   * rect for area). This makes the legend a colour-free mapping too — series differ by dash, not
   * only hue (WCAG 1.4.1) — and exactly matches what the canvas draws.
   */
  private swatch(s: ResolvedSeries): SVGElement {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = this.doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sl-swatch');
    svg.setAttribute('viewBox', '0 0 18 10');
    svg.setAttribute('aria-hidden', 'true');
    if (s.type === 'area') {
      const rect = this.doc.createElementNS(NS, 'rect');
      for (const [k, v] of [['x', '1'], ['y', '2'], ['width', '16'], ['height', '7'], ['rx', '1']]) {
        rect.setAttribute(k, v);
      }
      rect.setAttribute('fill', s.color);
      rect.setAttribute('fill-opacity', String(Math.max(0.35, s.fillAlpha)));
      rect.setAttribute('stroke', s.color);
      svg.append(rect);
    } else {
      const line = this.doc.createElementNS(NS, 'line');
      for (const [k, v] of [['x1', '1'], ['y1', '5'], ['x2', '17'], ['y2', '5']]) line.setAttribute(k, v);
      line.setAttribute('stroke', s.color);
      line.setAttribute('stroke-width', '2');
      if (s.dash.length) line.setAttribute('stroke-dasharray', s.dash.join(' '));
      svg.append(line);
    }
    return svg;
  }

  /** Reflect current visibility into aria-pressed and the visible state label. */
  update(series: readonly ResolvedSeries[]): void {
    if (series.length !== this.buttons.length) {
      this.build(series);
      return;
    }
    this.sync(series);
  }

  private sync(series: readonly ResolvedSeries[]): void {
    series.forEach((s, i) => {
      const button = this.buttons[i];
      button.setAttribute('aria-pressed', String(s.visible));
      const state = button.querySelector('.sl-legend-state');
      if (state) state.textContent = s.visible ? this.strings.shown : this.strings.hidden;
    });
  }

  destroy(): void {
    this.el.remove();
  }
}
