/**
 * HTML-in-Canvas feature detection.
 *
 * The (experimental, flag-gated) HTML-in-Canvas proposal would let us composite the real
 * DOM accessibility layer *into* the canvas. We feature-detect it but never depend on it:
 * the library is fully functional and fully accessible via the DOM overlay regardless.
 * `activePath` reports which path is in use; the overlay path is the one under test.
 */

export type RenderPath = 'dom-overlay' | 'html-in-canvas';

export interface HtmlInCanvasSupport {
  supported: boolean;
  /** Which specific API surfaced the capability (for diagnostics). */
  via: string | null;
}

/**
 * Detect whether any HTML-in-Canvas API is present. Pure detection — touches no global
 * state and never throws.
 */
export function detectHtmlInCanvas(): HtmlInCanvasSupport {
  try {
    const ctxProto =
      typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;
    if (ctxProto && 'drawElement' in ctxProto) return { supported: true, via: 'drawElement' };

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      if ('layoutsubtree' in canvas) return { supported: true, via: 'layoutsubtree' };
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      if (gl && 'texElementImage2D' in gl) return { supported: true, via: 'texElementImage2D' };
    }
  } catch {
    // Any detection error → treat as unsupported and fall back to the DOM overlay.
  }
  return { supported: false, via: null };
}

/** The render path the library will use given current support. */
export function resolveRenderPath(support: HtmlInCanvasSupport): RenderPath {
  return support.supported ? 'html-in-canvas' : 'dom-overlay';
}
