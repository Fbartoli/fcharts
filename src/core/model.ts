/**
 * Data model — normalizes user input and precomputes everything the render loop needs:
 * typed-array copies, per-series y extents, and a min/max pyramid per series.
 *
 * All of this is computed once per `setData`, never per frame.
 */
import { nearestIndex, StreamingPyramid } from './downsample.ts';

export type NumberArray = Float64Array | readonly number[];

/** Declarative description of one plotted series. */
export interface SeriesConfig {
  /** Human-readable name (announced to screen readers, shown in legend/tooltip). */
  name: string;
  /** CSS color for the line/area (wick/outline for `candle`). Optional — falls back to the
   *  contrast-checked {@link DEFAULT_PALETTE} by series index. */
  color?: string;
  /** `line` (stroked envelope), `area` (filled to baseline), or `candle` (OHLC candlesticks —
   *  consumes four y arrays: open, high, low, close). Default `line`. */
  type?: 'line' | 'area' | 'candle';
  /** Whether the series starts visible. Default true. */
  visible?: boolean;
  /** Stroke width in CSS px. Default 1.25. */
  width?: number;
  /** Fill opacity for `area` series, 0..1. Default 0.15. */
  fillAlpha?: number;
  /** Dash pattern for the stroke (canvas `setLineDash`). Omit to auto-assign a distinct pattern
   *  per series so colour is not the only differentiator (WCAG 1.4.1). `[]` forces solid. */
  dash?: number[];
  /** Candle body color when close >= open. Default green from the contrast-checked palette.
   *  Up candles are drawn hollow (outline only) so direction never relies on colour alone. */
  upColor?: string;
  /** Candle body color when close < open. Default red from the contrast-checked palette.
   *  Down candles are drawn filled. */
  downColor?: string;
}

/**
 * Columnar dataset: one shared, non-decreasing x array and one y array per series *slot*.
 * `line`/`area` series consume one slot; a `candle` series consumes four consecutive slots
 * in the order open, high, low, close. Slots follow series declaration order.
 */
export interface FChartData {
  x: NumberArray;
  y: NumberArray[];
}

/** Y-array slots a series consumes: 4 for `candle` (open/high/low/close), 1 otherwise. */
export function seriesSlots(type: 'line' | 'area' | 'candle' | undefined): number {
  return type === 'candle' ? 4 : 1;
}

/**
 * An event marker on the time series — a dot on the nearest sample of a series, or a vertical
 * rule, at an x position, with a label (e.g. "GSR +$2.0M"). Events are half the story on a
 * portfolio chart: a climbing line without the allocation markers hides that a jump was new
 * capital, not yield.
 */
export interface AnnotationSpec {
  /** x position (data units) the annotation marks. */
  x: number;
  /** Short description of the event (announced, shown in the readout, listed in the summary). */
  label: string;
  /** Mark color; defaults to the target series' color, else a neutral. Shape + label carry the
   *  meaning too, so the mark is never color-only (WCAG 1.4.1). */
  color?: string;
  /** `point` = a diamond on the nearest sample of `seriesIndex`; `rule` = a vertical line. Default `point`. */
  kind?: 'point' | 'rule';
  /** Which series' nearest sample a `point` marker sits on. Default 0. */
  seriesIndex?: number;
  /** Draw the always-on text label beside the marker. Default `true`. Set `false` for dense event
   *  sets (many markers on one chart): the marker still renders and the cursor readout +
   *  screen-reader announcement still surface the label on hover or keyboard select, but the static
   *  label is suppressed so a cluster of events doesn't collapse into overlapping text. */
  showLabel?: boolean;
}

/** An {@link AnnotationSpec} with defaults resolved. */
export interface ResolvedAnnotation {
  x: number;
  label: string;
  color: string;
  kind: 'point' | 'rule';
  seriesIndex: number;
  showLabel: boolean;
}

/** Apply defaults to annotation specs; color falls back to the target series' color. Pure. */
export function resolveAnnotations(
  specs: readonly AnnotationSpec[],
  series: readonly ResolvedSeries[],
): ResolvedAnnotation[] {
  return specs.map((a) => {
    const seriesIndex = a.seriesIndex ?? 0;
    return {
      x: a.x,
      label: a.label,
      kind: a.kind ?? 'point',
      seriesIndex,
      color: a.color || series[seriesIndex]?.color || '#64748b',
      showLabel: a.showLabel ?? true,
    };
  });
}

/**
 * The on-line data coordinates a `point` annotation snaps to: the nearest sample of its target
 * series (the close, for a candle), so the marker lands exactly on the drawn line. Returns the
 * sample index too, so callers can attach the annotation to the keyboard cursor. Null when there's
 * no data or the target series doesn't exist.
 */
export function annotationSample(
  data: ChartData,
  series: readonly ResolvedSeries[],
  a: ResolvedAnnotation,
): { index: number; x: number; y: number } | null {
  if (data.n === 0) return null;
  const s = series[a.seriesIndex];
  if (!s) return null;
  const index = nearestIndex(data.x, a.x);
  const slot = s.type === 'candle' ? s.index + 3 : s.index;
  return { index, x: data.x[index], y: data.y[slot][index] };
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
  /** First y-slot in `ChartData.y` / `.pyramids` (candles span `index..index+3`: OHLC). */
  index: number;
  /** Y-slots consumed: 4 for `candle`, 1 otherwise. */
  slots: number;
  name: string;
  color: string;
  type: 'line' | 'area' | 'candle';
  visible: boolean;
  width: number;
  fillAlpha: number;
  /** Resolved dash pattern; `[]` = solid. */
  dash: number[];
  /** Candle body colors (unused for line/area). */
  upColor: string;
  downColor: string;
}

/**
 * Default series palette — 8 hues each verified at >= 3:1 non-text contrast (WCAG 1.4.11)
 * against BOTH a white (#ffffff) and a dark (#0c1016 / #1f2937) chart background, so the marks
 * are distinguishable on either theme without the integrator choosing colors. Assigned by
 * series index when `SeriesConfig.color` is omitted. (Color alone is never the sole channel —
 * see the per-series dash/marker option.)
 */
export const DEFAULT_PALETTE = [
  '#0284c7', // blue
  '#ea580c', // orange
  '#16a34a', // green
  '#dc2626', // red
  '#c026d3', // magenta
  '#0d9488', // teal
  '#db2777', // pink
  '#65a30d', // lime
] as const;

/**
 * Distinct dash patterns auto-assigned by series index when no explicit dash is given and there
 * is more than one series, so colour is never the only channel (WCAG 1.4.1). Index 0 stays solid.
 */
const AUTO_DASH: readonly (readonly number[])[] = [
  [], [6, 4], [2, 3], [9, 4, 2, 4], [4, 4], [1, 3], [7, 3, 1, 3], [3, 7],
];

/** Apply defaults to user series configs. Pure; safe to call per update. */
export function resolveSeries(configs: readonly SeriesConfig[]): ResolvedSeries[] {
  // All-or-nothing: auto-assign dashes only when the integrator specified none (an explicit dash
  // on any series opts out of the auto-cycle).
  const auto = configs.length > 1 && !configs.some((c) => c.dash !== undefined);
  let slot = 0;
  return configs.map((c, i) => {
    const index = slot;
    const slots = seriesSlots(c.type);
    slot += slots;
    return {
      index,
      slots,
      name: c.name,
      color: c.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      type: c.type ?? 'line',
      visible: c.visible ?? true,
      width: c.width ?? 1.25,
      fillAlpha: c.fillAlpha ?? 0.15,
      dash: c.dash ?? (auto ? [...AUTO_DASH[i % AUTO_DASH.length]] : []),
      upColor: c.upColor ?? '#16a34a', // palette green/red — both contrast-checked (1.4.11)
      downColor: c.downColor ?? '#dc2626',
    };
  });
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

/** Copy `src` into a fresh buffer of length `cap` (cap >= src.length). Never aliases caller
 *  data. NOTE (measured): this two-step convert-then-memcpy ctor pipeline, with stats and
 *  pyramids reading the flat exact-length arrays, beats every "single-copy" restructure tried
 *  — reading subarray views in the O(n) passes costs ~15% on plain-array input. */
function toCapacity(src: Float64Array, cap: number): Float64Array {
  const out = new Float64Array(cap);
  out.set(src);
  return out;
}

/**
 * Per-series stats over the finite samples, plus the running sum/count needed to keep the mean
 * correct under incremental `push`. Non-finite values (NaN/±Infinity) are skipped so the stats —
 * and the machine-readable JSON built from them — are always real numbers, not the `null` that
 * `JSON.stringify` emits for NaN/Infinity.
 */
function initStats(y: Float64Array): { stats: SeriesStats; sum: number; count: number } {
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
  if (count === 0) return { stats: { min: 0, max: 0, first: 0, last: 0, mean: 0 }, sum: 0, count: 0 };
  return { stats: { min, max, first, last, mean: sum / count }, sum, count };
}

/**
 * Render-ready view of a dataset, with O(log n) `push` for streaming/real-time appends.
 *
 * `x`/`y[i]` are exact-length (`=== n`) views over doubling-capacity backing buffers, so
 * `x.length === n` holds for the binary search while appends stay amortized O(1). `x` must be
 * non-decreasing; `push` enforces it, the batch constructor trusts the caller (perf).
 */
export class ChartData {
  x: Float64Array;
  y: Float64Array[];
  n: number;
  readonly pyramids: StreamingPyramid[];
  readonly stats: SeriesStats[];

  private xBuf: Float64Array;
  private yBuf: Float64Array[];
  private cap: number;
  private readonly sums: Float64Array; // per-series running sum of finite values
  private readonly counts: Int32Array; // per-series finite-value count

  constructor(data: FChartData) {
    const x = toF64(data.x);
    const n = x.length;
    const yArrs = data.y.map((series, i) => {
      const arr = toF64(series);
      if (arr.length !== n) {
        throw new Error(
          `fcharts: series ${i} has ${arr.length} points but x has ${n}. ` +
            'Every y array must match the length of x.',
        );
      }
      return arr;
    });
    this.cap = Math.max(n, 1);
    this.xBuf = toCapacity(x, this.cap);
    this.yBuf = yArrs.map((a) => toCapacity(a, this.cap));
    this.n = n;
    this.x = this.xBuf.subarray(0, n);
    this.y = this.yBuf.map((b) => b.subarray(0, n));
    this.sums = new Float64Array(yArrs.length);
    this.counts = new Int32Array(yArrs.length);
    this.stats = yArrs.map((a, i) => {
      const r = initStats(a);
      this.sums[i] = r.sum;
      this.counts[i] = r.count;
      return r.stats;
    });
    this.pyramids = yArrs.map((a) => new StreamingPyramid(a));
  }

  /**
   * Append one sample. `x` must be >= the current last x (non-decreasing). Updates the data,
   * the per-series min/max pyramids (O(log n) each), and the stats — never an O(n) rebuild.
   */
  push(xv: number, ys: readonly number[]): void {
    if (ys.length !== this.yBuf.length) {
      throw new Error(
        `fcharts: append got ${ys.length} y-values but the chart has ${this.yBuf.length} series slots.`,
      );
    }
    // Reject non-finite x explicitly: NaN passes every `<` ordering check, so it would land in
    // the array silently and corrupt the binary searches that assume x is non-decreasing.
    if (!Number.isFinite(xv)) {
      throw new Error(`fcharts: append x must be a finite number (got ${xv}).`);
    }
    if (this.n > 0 && xv < this.xBuf[this.n - 1]) {
      throw new Error('fcharts: append x must be >= the current last x (x is non-decreasing).');
    }
    if (this.n === this.cap) this.grow();
    const i = this.n;
    this.xBuf[i] = xv;
    for (let s = 0; s < this.yBuf.length; s++) {
      const v = ys[s];
      this.yBuf[s][i] = v;
      this.pyramids[s].push(v);
      this.accumStat(s, v);
    }
    this.n = i + 1;
    this.x = this.xBuf.subarray(0, this.n);
    for (let s = 0; s < this.yBuf.length; s++) this.y[s] = this.yBuf[s].subarray(0, this.n);
  }

  /**
   * Replace the y-values of the LAST sample (x unchanged) — O(log n), for in-flight samples
   * that keep changing, e.g. a forming candle or a ticking last price. Values must be finite.
   *
   * Stats caveat: `min`/`max` only widen under amends. If the amended value was the sole
   * extreme and retreats, the recorded extreme stays until the next `setData`. For the
   * intended use this never happens (a forming candle's high/low only extend), and a
   * one-amend-wide extreme is the conservative direction for axis fitting.
   */
  amendLast(ys: readonly number[]): void {
    if (this.n === 0) {
      throw new Error('fcharts: amendLast called on an empty chart — append a sample first.');
    }
    if (ys.length !== this.yBuf.length) {
      throw new Error(
        `fcharts: amendLast got ${ys.length} y-values but the chart has ${this.yBuf.length} series slots.`,
      );
    }
    const i = this.n - 1;
    for (let s = 0; s < this.yBuf.length; s++) {
      const v = ys[s];
      if (!Number.isFinite(v)) {
        throw new Error(`fcharts: amendLast values must be finite numbers (slot ${s} got ${v}).`);
      }
      const old = this.yBuf[s][i];
      this.yBuf[s][i] = v;
      this.pyramids[s].amendLast(v, i > 0 ? this.yBuf[s][i - 1] : v);
      this.amendStat(s, old, v);
    }
  }

  private amendStat(s: number, old: number, v: number): void {
    const st = this.stats[s];
    if (Number.isFinite(old)) {
      this.sums[s] += v - old;
    } else {
      // The previous last value was a gap (appended as NaN) now becoming real data.
      this.sums[s] += v;
      this.counts[s] += 1;
      if (this.counts[s] === 1) {
        // First finite value ever: seed the extremes rather than widening the empty-state zeros.
        st.first = v;
        st.min = v;
        st.max = v;
      }
    }
    if (v < st.min) st.min = v;
    if (v > st.max) st.max = v;
    st.last = v;
    st.mean = this.sums[s] / this.counts[s];
  }

  private grow(): void {
    this.cap = Math.max(this.cap * 2, 8);
    this.xBuf = toCapacity(this.xBuf.subarray(0, this.n), this.cap);
    this.yBuf = this.yBuf.map((b) => toCapacity(b.subarray(0, this.n), this.cap));
  }

  private accumStat(s: number, v: number): void {
    if (!Number.isFinite(v)) return;
    const st = this.stats[s];
    if (this.counts[s] === 0) {
      st.first = v;
      st.min = v;
      st.max = v;
    } else {
      if (v < st.min) st.min = v;
      if (v > st.max) st.max = v;
    }
    st.last = v;
    this.sums[s] += v;
    this.counts[s] += 1;
    st.mean = this.sums[s] / this.counts[s];
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
