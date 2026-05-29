/**
 * HTML-in-Canvas feature detection.
 *
 * The experimental "HTML-in-Canvas" API (Chrome dev-trial; Origin Trial M148–M150, behind
 * `chrome://flags/#canvas-draw-element`) lets a `<canvas>` draw its own element children into
 * the bitmap while they stay the live, accessible, hit-testable source of truth. We feature-
 * detect the shipped 2D entry point and fall back to the DOM-overlay path everywhere else —
 * the library is fully functional and fully accessible via the overlay regardless.
 *
 * The 2D method was renamed `drawElement` → `drawHTMLElement` → `drawHTML` → `drawElementImage`,
 * and the older aliases were removed at Chrome M145. We detect the current name only; detecting
 * a removed alias (or the incidental WebGL `texElementImage2D`) would falsely report support.
 */

export type RenderPath = 'dom-overlay' | 'html-in-canvas';

export interface HtmlInCanvasSupport {
  supported: boolean;
  /** Which specific API surfaced the capability (for diagnostics). */
  via: string | null;
}

/**
 * Detect the HTML-in-Canvas 2D drawing entry point. Pure detection — touches no global state
 * and never throws.
 */
export function detectHtmlInCanvas(): HtmlInCanvasSupport {
  try {
    const ctxProto =
      typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;
    if (ctxProto && 'drawElementImage' in ctxProto) return { supported: true, via: 'drawElementImage' };
  } catch {
    // Any detection error → treat as unsupported and fall back to the DOM overlay.
  }
  return { supported: false, via: null };
}

/** The render path the library will use given current support. */
export function resolveRenderPath(support: HtmlInCanvasSupport): RenderPath {
  return support.supported ? 'html-in-canvas' : 'dom-overlay';
}
