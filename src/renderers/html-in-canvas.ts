/**
 * HTML-in-Canvas compositor — progressive enhancement (Chrome dev-trial only).
 *
 * When the browser exposes the HTML-in-Canvas API (`ctx.drawElementImage`), Sightline can draw
 * its real-DOM text layer *into* the canvas so the chart is one composited surface, while the
 * element stays the live, accessible, hit-testable, find-in-page-able source of truth.
 *
 * Contract (per the WICG explainer, verified empirically in Chrome 148):
 *  - the layer MUST be an *immediate child* of the `<canvas>`;
 *  - the canvas must carry the boolean `layoutsubtree` attribute (which opts its children into
 *    layout + hit-testing — note they are NOT painted to screen on their own, only via a draw);
 *  - a paint snapshot of the children must already exist, so the very first draw (before any
 *    paint) throws "no cached paint record" — we treat that as a miss and retry next frame;
 *  - `drawElementImage(el, dx, dy)` returns the `DOMMatrix` mapping the live element onto the
 *    drawn pixels; assigning it to `el.style.transform` keeps hit-testing/focus aligned with
 *    what's painted.
 *
 * No browser ships this un-flagged, so `composite()` is a no-op in production today. Because a
 * `layoutsubtree` child only becomes visible via `drawElementImage`, the caller MUST keep a
 * fallback (re-show the layer as a normal overlay) if `composite()` never succeeds — see
 * `Sightline`'s html-in-canvas handling.
 */

interface HtmlInCanvasContext extends CanvasRenderingContext2D {
  drawElementImage(element: Element, dx: number, dy: number): DOMMatrix;
}

function hasDrawElementImage(ctx: CanvasRenderingContext2D): ctx is HtmlInCanvasContext {
  return typeof (ctx as { drawElementImage?: unknown }).drawElementImage === 'function';
}

export interface Compositor {
  /** Whether this browser actually exposes the API (so callers can branch DOM structure). */
  readonly supported: boolean;
  /** Opt the canvas into laying out its element children. Idempotent; no-op if unsupported. */
  enable(): void;
  /**
   * Draw a canvas-child `layer` into the bitmap at (dx, dy) and sync its transform.
   * @returns true if it composited this frame; false if unsupported or no snapshot yet.
   */
  composite(layer: HTMLElement, dx?: number, dy?: number): boolean;
}

export function createCompositor(canvas: HTMLCanvasElement): Compositor {
  const ctx = canvas.getContext('2d');
  const supported = !!ctx && hasDrawElementImage(ctx);
  return {
    supported,
    enable(): void {
      if (supported && !canvas.hasAttribute('layoutsubtree')) canvas.setAttribute('layoutsubtree', '');
    },
    composite(layer: HTMLElement, dx = 0, dy = 0): boolean {
      if (!supported || !ctx) return false;
      try {
        const matrix = (ctx as HtmlInCanvasContext).drawElementImage(layer, dx, dy);
        // Keep the live (canvas-placed) element aligned with the drawn pixels so focus and
        // hit-testing land where the text appears.
        layer.style.transform = matrix.toString();
        return true;
      } catch {
        // No paint snapshot yet (first frame) or a transient failure — retry next frame.
        return false;
      }
    },
  };
}
