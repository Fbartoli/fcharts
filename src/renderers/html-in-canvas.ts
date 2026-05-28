/**
 * HTML-in-Canvas compositor — progressive enhancement only.
 *
 * When (and only when) the browser exposes the experimental `drawElement` API, we can
 * paint the real DOM accessibility layer into the canvas so it visually composites with
 * the marks. This is never required: the DOM overlay remains the source of truth for
 * accessibility and visual layout. No browser ships `drawElement` un-flagged today, so in
 * practice `composite()` is a guarded no-op and the overlay path is what runs.
 */

interface DrawElementContext extends CanvasRenderingContext2D {
  drawElement(element: Element, x: number, y: number): void;
}

function hasDrawElement(ctx: CanvasRenderingContext2D): ctx is DrawElementContext {
  return typeof (ctx as { drawElement?: unknown }).drawElement === 'function';
}

export interface Compositor {
  /** Paint the DOM layer into the canvas if the API is available. Returns true if it did. */
  composite(domLayer: Element): boolean;
}

export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  const ctx = canvas.getContext('2d');
  return {
    composite(domLayer: Element): boolean {
      if (!ctx || !hasDrawElement(ctx)) return false;
      try {
        ctx.drawElement(domLayer, 0, 0);
        return true;
      } catch {
        return false;
      }
    },
  };
}
