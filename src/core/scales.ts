/**
 * Linear scales — map a data domain onto a pixel range and back.
 *
 * Renderer-agnostic: a scale is plain arithmetic over numbers. The y-scale's range is
 * inverted (top pixel = max value) because canvas/DOM y grows downward.
 */

/** Maps values from `domain` (data units) to `range` (pixels) and back. */
export interface LinearScale {
  /** data value → pixel. */
  (value: number): number;
  /** pixel → data value. */
  invert(px: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
}

/**
 * Build a linear scale. A zero-width domain is treated as spanning [d0, d0+1] so the
 * scale never divides by zero (it collapses to the range start).
 *
 * @param domain - [d0, d1] in data units.
 * @param range - [r0, r1] in pixels.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const dspan = d1 - d0 || 1;
  const rspan = r1 - r0;
  const m = rspan / dspan;

  const scale = ((value: number): number => r0 + (value - d0) * m) as LinearScale;
  Object.defineProperties(scale, {
    invert: { value: (px: number): number => d0 + (px - r0) / m },
    domain: { value: domain },
    range: { value: range },
  });
  return scale;
}

/**
 * Build a base-10 log scale (same {@link LinearScale} shape, so renderers are agnostic).
 * The domain must be positive — the caller derives it from positive data (see `rescaleY`).
 * Non-positive values can still reach the scale at render time (a gap sample's neighbors,
 * an area baseline of 0); they clamp to the range start instead of producing NaN, which
 * would break an entire canvas path.
 */
export function logScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const l0 = Math.log10(d0);
  const lspan = Math.log10(d1) - l0 || 1;
  const m = (r1 - r0) / lspan;

  const scale = ((value: number): number =>
    value > 0 ? r0 + (Math.log10(value) - l0) * m : r0) as LinearScale;
  Object.defineProperties(scale, {
    invert: { value: (px: number): number => Math.pow(10, l0 + (px - r0) / m) },
    domain: { value: domain },
    range: { value: range },
  });
  return scale;
}
