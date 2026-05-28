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
