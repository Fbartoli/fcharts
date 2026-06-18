/**
 * HTML-in-Canvas compositor — progressive enhancement (Chrome dev-trial only).
 *
 * When the browser exposes the HTML-in-Canvas API (`ctx.drawElementImage`), fcharts can draw
 * its real-DOM text layer *into* the canvas so the chart is one composited surface, while the
 * element stays the live, accessible, hit-testable, find-in-page-able source of truth.
 *
 * Contract (per the WICG explainer, verified empirically in Chrome 148 and 149):
 *  - the layer MUST be an *immediate child* of the `<canvas>`;
 *  - the canvas must carry the boolean `layoutsubtree` attribute (which opts its children into
 *    layout + hit-testing — note they are NOT painted to screen on their own, only via a draw);
 *  - the layer cannot size itself against the canvas box: `inset:0` resolves to 0×0 in
 *    Chrome 149, silently snapshotting nothing — the caller must give it an explicit size;
 *  - a paint snapshot of the children must already exist. Before one does, Chrome 148 throws
 *    "no cached paint record" on every draw, Chrome 149 throws InvalidStateError on the first
 *    frame and then "succeeds" while painting nothing — callers must verify pixels landed and
 *    treat all of these as warm-up misses (see `fcharts`' `compositeTicks`);
 *  - `drawElementImage(el, dx, dy)` returns the `DOMMatrix` mapping the live element onto the
 *    drawn pixels; assigning it to `el.style.transform` keeps hit-testing/focus aligned with
 *    what's painted.
 *
 * No browser ships this un-flagged, so `composite()` is a no-op in production today. Because a
 * `layoutsubtree` child only becomes visible via `drawElementImage`, the caller MUST keep a
 * fallback (re-show the layer as a normal overlay) if `composite()` never succeeds — see
 * `fcharts`' html-in-canvas handling.
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
   * Draw a canvas-child `layer` into the bitmap at (dx, dy) — device pixels — and sync its
   * transform.
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
      // The element snapshot is already at device-pixel resolution (verified at dpr 2 on
      // Chrome 149), so it must be drawn under an identity transform. The renderer leaves a
      // scale(dpr) on the context — drawing under it compounds to dpr²: labels twice their
      // size and the bottom of the layer pushed off the bitmap.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      try {
        const matrix = (ctx as HtmlInCanvasContext).drawElementImage(layer, dx, dy);
        // Keep the live (canvas-placed) element aligned with the drawn pixels so focus and
        // hit-testing land where the text appears.
        layer.style.transform = matrix.toString();
        return true;
      } catch {
        // No paint snapshot yet (first frame) or a transient failure — retry next frame.
        return false;
      } finally {
        ctx.restore();
      }
    },
  };
}
