/**
 * Renderer abstraction — the seam between the renderer-agnostic core and a concrete
 * drawing backend (Canvas2D today; WebGL/HTML-in-Canvas can implement the same
 * interface without changing the core or the public API).
 *
 * A `RenderScene` is a plain-data snapshot of everything needed to draw one frame. The
 * core/`Sightline` builds it; the renderer only reads it.
 */
import type { LinearScale } from '../core/scales.ts';
import type { ChartData, CursorState, Margins, ResolvedSeries } from '../core/model.ts';

export interface RenderScene {
  /** Plot size in CSS px. */
  width: number;
  height: number;
  /** Device pixel ratio the backing store should use (capped by the caller). */
  dpr: number;
  margins: Margins;
  data: ChartData;
  series: readonly ResolvedSeries[];
  /** value → px (range inverted: top pixel = max value). */
  yScale: LinearScale;
  /** x-value → px. */
  xScale: LinearScale;
  /** Visible x-domain [d0, d1] used for downsampling. */
  domain: readonly [number, number];
  /** Tick *values* (single source of truth shared with the DOM tick layer). */
  xTicks: readonly number[];
  yTicks: readonly number[];
  /** Active cursor sample, or null when the cursor is inactive. */
  cursor: CursorState | null;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Windows High Contrast / forced-colors active — repaint marks in system colors. */
  forcedColors: boolean;
}

export interface Renderer {
  /** Draw a single frame. Must be cheap to call every animation frame. */
  render(scene: RenderScene): void;
  /** Release GPU/canvas resources. */
  destroy(): void;
}
