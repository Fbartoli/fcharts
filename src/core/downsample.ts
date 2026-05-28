/**
 * Min/max downsampling — the core trick that decouples frame cost from point count.
 *
 * A naive renderer iterates every visible sample each frame, so cost grows with N.
 * Instead we precompute a multi-resolution min/max pyramid once (O(N), in `setData`),
 * then each frame pick the pyramid level whose buckets are ~1 per pixel column and
 * iterate only those. Per-frame work is therefore O(viewport width), independent of N
 * and of zoom level — see `planDownsample`, which is unit-tested to prove this.
 *
 * This module is renderer-agnostic: it returns per-column min/max envelopes in *data*
 * units. Mapping those to pixels is the renderer's job.
 */

/** A pre-aggregated level of the pyramid. `bucketSize` source samples per bucket. */
export interface PyramidLevel {
  readonly bucketSize: number;
  readonly min: Float32Array;
  readonly max: Float32Array;
}

/** Multi-resolution min/max aggregate over one series' y-values, indexed 0..n-1. */
export interface MinMaxPyramid {
  readonly n: number;
  /** levels[k].bucketSize === 2^(k+1); level 0 aggregates pairs. */
  readonly levels: readonly PyramidLevel[];
}

/** Per-column envelope. Columns with no samples carry the sentinels (min=+Inf, max=-Inf). */
export interface ColumnEnvelope {
  readonly min: Float32Array;
  readonly max: Float32Array;
  /** Pixel column of the leftmost / rightmost filled sample, or -1 if empty. */
  readonly first: number;
  readonly last: number;
}

/**
 * Build the min/max pyramid for a series. O(n) time and ~2n extra Float32 storage.
 *
 * @param y - Series y-values, length n.
 * @returns A pyramid whose coarsest level has at most one bucket.
 */
export function buildPyramid(y: Float64Array): MinMaxPyramid {
  const n = y.length;
  const levels: PyramidLevel[] = [];
  if (n === 0) return { n, levels };

  let prev = buildLevel0(y);
  levels.push(prev);
  while (prev.min.length > 1) {
    prev = combineLevel(prev);
    levels.push(prev);
  }
  return { n, levels };
}

function buildLevel0(y: Float64Array): PyramidLevel {
  const n = y.length;
  const count = Math.ceil(n / 2);
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  for (let b = 0; b < count; b++) {
    const i = b * 2;
    const a = y[i];
    const c = i + 1 < n ? y[i + 1] : a;
    min[b] = a < c ? a : c;
    max[b] = a > c ? a : c;
  }
  return { bucketSize: 2, min, max };
}

function combineLevel(prev: PyramidLevel): PyramidLevel {
  const len = prev.min.length;
  const count = Math.ceil(len / 2);
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  for (let b = 0; b < count; b++) {
    const i = b * 2;
    const j = i + 1 < len ? i + 1 : i;
    min[b] = Math.min(prev.min[i], prev.min[j]);
    max[b] = Math.max(prev.max[i], prev.max[j]);
  }
  return { bucketSize: prev.bucketSize * 2, min, max };
}

/** First index i with x[i] >= target (binary search; x must be non-decreasing). */
export function lowerBound(x: Float64Array, target: number): number {
  let lo = 0;
  let hi = x.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (x[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pickLevel(pyramid: MinMaxPyramid, pointsPerCol: number): PyramidLevel {
  // Largest bucketSize <= pointsPerCol → buckets-per-column >= 1 (no gaps),
  // and within a factor of 2 of pointsPerCol → iterations <= ~2w.
  const idx = Math.floor(Math.log2(pointsPerCol)) - 1;
  const last = pyramid.levels.length - 1;
  const clamped = idx < 0 ? 0 : idx > last ? last : idx;
  return pyramid.levels[clamped];
}

/** How `downsampleColumns` will traverse the data for a given domain + width. */
export interface DownsamplePlan {
  readonly mode: 'empty' | 'raw' | 'level';
  /** Inclusive visible index range (raw samples), expanded one sample past each edge. */
  readonly i0: number;
  readonly i1: number;
  /** Chosen pyramid level for `level` mode, else null. */
  readonly level: PyramidLevel | null;
  /** Source units (raw samples or buckets) iterated this frame. The O(width) witness. */
  readonly iterations: number;
}

/**
 * Decide how to traverse the data without touching y-values. Exposed so tests can assert
 * the central invariant: `iterations` stays ~O(width) no matter how large n is.
 */
export function planDownsample(
  x: Float64Array,
  pyramid: MinMaxPyramid,
  domain: readonly [number, number],
  cols: number,
): DownsamplePlan {
  const w = Math.max(1, Math.floor(cols));
  const span = domain[1] - domain[0];
  const empty: DownsamplePlan = { mode: 'empty', i0: 0, i1: -1, level: null, iterations: 0 };
  if (span <= 0 || x.length === 0) return empty;

  const i0 = Math.max(0, lowerBound(x, domain[0]) - 1);
  const i1 = Math.min(x.length - 1, lowerBound(x, domain[1]));
  if (i1 < i0) return { ...empty, i0, i1 };

  const visible = i1 - i0 + 1;
  const pointsPerCol = visible / w;
  if (pointsPerCol < 2) return { mode: 'raw', i0, i1, level: null, iterations: visible };

  const level = pickLevel(pyramid, pointsPerCol);
  const b0 = Math.floor(i0 / level.bucketSize);
  const b1 = Math.min(level.min.length - 1, Math.floor(i1 / level.bucketSize));
  return { mode: 'level', i0, i1, level, iterations: Math.max(0, b1 - b0 + 1) };
}

/**
 * Compute the per-pixel-column min/max envelope for the visible x-domain.
 *
 * @param x - Shared x-values (non-decreasing), length n.
 * @param rawY - Series y-values, length n.
 * @param pyramid - Pyramid for `rawY`.
 * @param domain - Visible x-range [d0, d1], d0 < d1.
 * @param cols - Number of pixel columns (plot width in CSS px, >= 1).
 * @param out - Optional reusable buffers (length === cols) to avoid per-frame allocation.
 */
export function downsampleColumns(
  x: Float64Array,
  rawY: Float64Array,
  pyramid: MinMaxPyramid,
  domain: readonly [number, number],
  cols: number,
  out?: { min: Float32Array; max: Float32Array },
): ColumnEnvelope {
  const w = Math.max(1, Math.floor(cols));
  const min = out && out.min.length === w ? out.min : new Float32Array(w);
  const max = out && out.max.length === w ? out.max : new Float32Array(w);
  min.fill(Infinity);
  max.fill(-Infinity);

  const plan = planDownsample(x, pyramid, domain, w);
  if (plan.mode === 'empty') return { min, max, first: -1, last: -1 };

  const d0 = domain[0];
  const invSpan = w / (domain[1] - domain[0]);
  const colOf = (xv: number): number => {
    const c = (xv - d0) * invSpan;
    return c < 0 ? 0 : c >= w ? w - 1 : c | 0;
  };

  if (plan.mode === 'raw') {
    for (let i = plan.i0; i <= plan.i1; i++) {
      const c = colOf(x[i]);
      const v = rawY[i];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  } else {
    accumulateLevel(x, plan.level!, plan.i0, plan.i1, colOf, min, max);
  }
  return finalize(min, max, w);
}

function accumulateLevel(
  x: Float64Array,
  level: PyramidLevel,
  i0: number,
  i1: number,
  colOf: (xv: number) => number,
  min: Float32Array,
  max: Float32Array,
): void {
  const bs = level.bucketSize;
  const half = bs >> 1;
  const b0 = Math.floor(i0 / bs);
  const b1 = Math.min(level.min.length - 1, Math.floor(i1 / bs));
  const lastX = x.length - 1;
  for (let b = b0; b <= b1; b++) {
    const center = b * bs + half;
    const c = colOf(x[center < x.length ? center : lastX]);
    if (level.min[b] < min[c]) min[c] = level.min[b];
    if (level.max[b] > max[c]) max[c] = level.max[b];
  }
}

function finalize(min: Float32Array, max: Float32Array, w: number): ColumnEnvelope {
  let first = -1;
  let last = -1;
  for (let c = 0; c < w; c++) {
    if (min[c] !== Infinity) {
      if (first === -1) first = c;
      last = c;
    }
  }
  return { min, max, first, last };
}
