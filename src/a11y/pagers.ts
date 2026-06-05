/**
 * Pan pagers — two real `<button>`s that step the visible window earlier/later with a single
 * pointer click (no dragging). This is the single-pointer, non-dragging alternative to drag-pan
 * that WCAG 2.5.7 requires; being real buttons, they are keyboard- and screen-reader-operable
 * too. Shown only when the view is zoomed in (panning has an effect).
 */
import type { FChartStrings } from './strings.ts';

type PagerStrings = Pick<FChartStrings, 'pagerPrev' | 'pagerNext'>;

export class Pagers {
  readonly el: HTMLElement;
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;

  constructor(onPan: (dir: -1 | 1) => void, strings: PagerStrings, doc: Document = document) {
    this.el = doc.createElement('div');
    this.el.className = 'fc-pagers';
    this.el.style.display = 'none'; // hidden until there's something to pan to
    const mk = (glyph: string, label: string, dir: -1 | 1): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'fc-pager';
      b.textContent = glyph;
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => onPan(dir));
      return b;
    };
    this.prev = mk('‹', strings.pagerPrev, -1); // ‹
    this.next = mk('›', strings.pagerNext, 1); // ›
    this.el.append(this.prev, this.next);
  }

  /** Reflect pannability: hide when the full domain is shown; disable the end you're already at. */
  update(atStart: boolean, atEnd: boolean): void {
    this.el.style.display = atStart && atEnd ? 'none' : 'flex';
    this.prev.disabled = atStart;
    this.next.disabled = atEnd;
  }

  destroy(): void {
    this.el.remove();
  }
}
