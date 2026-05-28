/**
 * Polite ARIA live region — the channel through which cursor moves and hover are
 * announced to screen readers. Visually hidden, but present in the accessibility tree.
 */

export class LiveRegion {
  readonly el: HTMLElement;
  private last = '';

  constructor(doc: Document = document) {
    this.el = doc.createElement('span');
    this.el.className = 'sl-sr-only';
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
  }

  /** Announce `text`. Re-announces even when unchanged by nudging the content. */
  announce(text: string): void {
    // Screen readers ignore identical successive text; toggle a trailing space to force it.
    this.el.textContent = text === this.last ? `${text} ` : text;
    this.last = text;
  }

  clear(): void {
    this.el.textContent = '';
    this.last = '';
  }

  destroy(): void {
    this.el.remove();
  }
}
