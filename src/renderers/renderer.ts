/**
 * Renderer abstraction — the seam between the renderer-agnostic core and a concrete
 * drawing backend (Canvas2D today; WebGL/HTML-in-Canvas can implement the same
 * interface without changing the core or the public API).
 *
 * A `RenderScene` is a plain-data snapshot of everything needed to draw one frame. The
 * core/`FChart` builds it; the renderer only reads it.
 */
import type { LinearScale } from '../core/scales.ts';
import type {
  ChartData,
  CursorState,
  Margins,
  ResolvedAnnotation,
  ResolvedSeries,
} from '../core/model.ts';

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
  /** Event markers on the series (dots / vertical rules). */
  annotations: readonly ResolvedAnnotation[];
  /** Index (into `annotations`) of the marker under pointer/keyboard focus — drawn emphasized
   *  with its label forced on — or null. */
  hoveredAnnotation: number | null;
  /** Index (into `annotations`) of the pinned/selected marker — emphasized and persistent — or
   *  null. */
  selectedAnnotation: number | null;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Windows High Contrast / forced-colors active — repaint marks in system colors. */
  forcedColors: boolean;
}

/** Minimum px per candle to draw individual bodies; below this, renderers fall back to the
 *  per-column high/low envelope. Shared by the canvas renderer and the SVG export so both
 *  modes switch at the same density. */
export const MIN_CANDLE_PX = 3;

export interface Renderer {
  /** Draw a single frame. Must be cheap to call every animation frame. */
  render(scene: RenderScene): void;
  /** Release GPU/canvas resources. */
  destroy(): void;
}
