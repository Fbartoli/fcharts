/**
 * Data model — normalizes user input and precomputes everything the render loop needs:
 * typed-array copies, per-series y extents, and a min/max pyramid per series.
 *
 * All of this is computed once per `setData`, never per frame.
 */
import { buildPyramid, type MinMaxPyramid } from './downsample.ts';

export type NumberArray = Float64Array | readonly number[];

/** Declarative description of one plotted series. */
export interface SeriesConfig {
  /** Human-readable name (announced to screen readers, shown in legend/tooltip). */
  name: string;
  /** CSS color for the line/area. */
  color: string;
  /** `line` (stroked envelope) or `area` (filled to baseline). Default `line`. */
  type?: 'line' | 'area';
  /** Whether the series starts visible. Default true. */
  visible?: boolean;
  /** Stroke width in CSS px. Default 1.25. */
  width?: number;
  /** Fill opacity for `area` series, 0..1. Default 0.15. */
  fillAlpha?: number;
}

/** Columnar dataset: one shared, non-decreasing x array and one y array per series. */
export interface SightlineData {
  x: NumberArray;
  y: NumberArray[];
}

/** Per-series summary statistics over the full dataset (computed once at setData). */
export interface SeriesStats {
  min: number;
  max: number;
  first: number;
  last: number;
  mean: number;
}

/** A series with all optional fields resolved to concrete defaults. */
export interface ResolvedSeries {
  /** Index into `ChartData.y` / `.pyramids`. */
  index: number;
  name: string;
  color: string;
  type: 'line' | 'area';
  visible: boolean;
  width: number;
  fillAlpha: number;
}

/** Apply defaults to user series configs. Pure; safe to call per update. */
export function resolveSeries(configs: readonly SeriesConfig[]): ResolvedSeries[] {
  return configs.map((c, index) => ({
    index,
    name: c.name,
    color: c.color,
    type: c.type ?? 'line',
    visible: c.visible ?? true,
    width: c.width ?? 1.25,
    fillAlpha: c.fillAlpha ?? 0.15,
  }));
}

/** Which sample the keyboard/hover cursor currently points at. */
export interface CursorState {
  /** Resolved series index. */
  series: number;
  /** Sample index within the series. */
  index: number;
}

/** Plot insets in CSS px (space reserved for axes/ticks around the plotting area). */
export interface Margins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const DEFAULT_MARGINS: Margins = { left: 56, right: 16, top: 20, bottom: 32 };

function toF64(a: NumberArray): Float64Array {
  return a instanceof Float64Array ? a : Float64Array.from(a);
}

/**
 * Per-series stats over the finite samples. Non-finite values (NaN/±Infinity) are skipped
 * so the stats — and the machine-readable JSON built from them — are always real numbers
 * rather than the `null` that `JSON.stringify` would emit for NaN/Infinity.
 */
function statsOf(y: Float64Array): SeriesStats {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let first = 0;
  let last = 0;
  for (let i = 0; i < y.length; i++) {
    const v = y[i];
    if (!Number.isFinite(v)) continue;
    if (count === 0) first = v;
    last = v;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count++;
  }
  if (count === 0) return { min: 0, max: 0, first: 0, last: 0, mean: 0 };
  return { min, max, first, last, mean: sum / count };
}

/**
 * Immutable, render-ready view of a dataset.
 *
 * Note: `x` must be non-decreasing (the downsampler binary-searches it). This is the
 * caller's contract and is not re-validated per `setData` for performance.
 */
export class ChartData {
  readonly x: Float64Array;
  readonly y: readonly Float64Array[];
  readonly n: number;
  readonly pyramids: readonly MinMaxPyramid[];
  readonly stats: readonly SeriesStats[];

  constructor(data: SightlineData) {
    this.x = toF64(data.x);
    this.n = this.x.length;
    this.y = data.y.map((series, i) => {
      const arr = toF64(series);
      if (arr.length !== this.n) {
        throw new Error(
          `Sightline: series ${i} has ${arr.length} points but x has ${this.n}. ` +
            'Every y array must match the length of x.',
        );
      }
      return arr;
    });
    this.stats = this.y.map(statsOf);
    this.pyramids = this.y.map(buildPyramid);
  }

  /** Full x-domain [first, last]; falls back to [0, 1] when empty. */
  xExtent(): [number, number] {
    if (this.n === 0) return [0, 1];
    return [this.x[0], this.x[this.n - 1]];
  }

  /**
   * Combined y-extent across the series flagged visible.
   *
   * @param visible - Per-series visibility (index-aligned with the series). Missing or
   *   `true` entries count as visible.
   * @returns [min, max], widened to a unit span when degenerate so scales never collapse.
   */
  yExtent(visible: readonly boolean[]): [number, number] {
    if (this.n === 0) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (let s = 0; s < this.stats.length; s++) {
      if (visible[s] === false) continue;
      const e = this.stats[s];
      if (e.min < min) min = e.min;
      if (e.max > max) max = e.max;
    }
    if (min === Infinity) return [0, 1];
    if (min === max) return [min - 1, max + 1];
    return [min, max];
  }
}
