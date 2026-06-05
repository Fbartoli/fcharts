/**
 * "Nice" axis ticks — round numbers (1/2/5 × 10^k) covering a domain.
 *
 * Ported and generalized from the POC. Renderer-agnostic: returns tick *values*; the
 * a11y layer turns them into positioned DOM text.
 */

/** The nice step size that yields roughly `target` ticks across [min, max]. */
export function tickStep(min: number, max: number, target: number): number {
  const span = max - min;
  if (span <= 0 || !Number.isFinite(span)) return 1;
  const rough = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const factor = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return factor * mag;
}

/**
 * Nice tick values within [min, max].
 *
 * @param min - Domain lower bound.
 * @param max - Domain upper bound.
 * @param target - Desired tick count (a hint; the actual count varies with rounding).
 * @param minStep - Optional floor on the step (e.g. 1 for integer index axes).
 */
export function niceTicks(min: number, max: number, target: number, minStep = 0): number[] {
  if (!(max > min)) return [min];
  const step = Math.max(minStep, tickStep(min, max, target));
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  // Index-based loop avoids floating-point drift from repeated += step.
  for (let k = 0; ; k++) {
    const v = start + k * step;
    if (v > max + step * 1e-9) break;
    // Snap away -0 and tiny FP residue near zero.
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    if (out.length > 1000) break; // safety valve
  }
  return out;
}

/**
 * Reduce the desired tick count so labels don't overlap at narrow sizes (WCAG 1.4.10 reflow).
 * Reduction-only: never returns more than `base` (so wide plots keep their requested density),
 * clamped to >= 2. `available` is the plot extent in px, `minPx` the minimum spacing per label.
 */
export function effectiveTickCount(base: number, available: number, minPx: number): number {
  const fit = Math.floor(Math.max(0, available) / Math.max(1, minPx));
  return Math.max(2, Math.min(base, fit));
}

/**
 * Default tick label formatter: compact thousands (`12.5k`), otherwise trimmed decimals.
 * The a11y layer can override this for time/category axes.
 */
export function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  if (abs !== 0 && abs < 1) return value.toFixed(2);
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
