/**
 * Accessible legend — one real `<button aria-pressed>` per series. Toggling a button
 * shows/hides its series. Real buttons mean keyboard focus, Enter/Space activation, and
 * correct screen-reader state come for free.
 */
import type { ResolvedSeries } from '../core/model.ts';

export class Legend {
  readonly el: HTMLElement;
  private readonly list: HTMLUListElement;
  private readonly doc: Document;
  private readonly onToggle: (index: number) => void;
  private buttons: HTMLButtonElement[] = [];

  constructor(series: readonly ResolvedSeries[], onToggle: (index: number) => void, doc: Document = document) {
    this.doc = doc;
    this.onToggle = onToggle;
    this.el = doc.createElement('div');
    this.el.className = 'sl-legend';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Series — activate to show or hide');
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

      const swatch = this.doc.createElement('span');
      swatch.className = 'sl-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.background = s.color;

      const name = this.doc.createElement('span');
      name.className = 'sl-legend-name';
      name.textContent = s.name;

      const state = this.doc.createElement('span');
      state.className = 'sl-legend-state';

      button.append(swatch, name, state);
      li.append(button);
      this.list.append(li);
      return button;
    });
    this.sync(series);
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
      if (state) state.textContent = s.visible ? 'shown' : 'hidden';
    });
  }

  destroy(): void {
    this.el.remove();
  }
}
