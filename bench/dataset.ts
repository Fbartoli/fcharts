/**
 * Shared benchmark dataset. Generated once and fed identically to all three renderers so
 * the comparison is apples-to-apples. Uses a seeded PRNG (no dependency, reproducible).
 */

export interface SeriesSpec {
  name: string;
  color: string;
  base: number;
  amp: number;
  freq: number;
  drift: number;
}

export const SERIES: SeriesSpec[] = [
  { name: 'Pressure', color: '#6ee7a8', base: 40, amp: 26, freq: 0.0009, drift: 0.06 },
  { name: 'Temperature', color: '#fbbf24', base: 5, amp: 18, freq: 0.0021, drift: 0.05 },
  { name: 'Vibration', color: '#38bdf8', base: -32, amp: 22, freq: 0.004, drift: 0.08 },
];

/** mulberry32 — tiny deterministic PRNG so every run uses the same data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Dataset {
  x: Float64Array;
  y: Float64Array[];
  n: number;
}

/** Build the x array and one bounded-random-walk y array per series. */
export function makeDataset(n: number, seed = 0x5117): Dataset {
  const rng = mulberry32(seed);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = i;

  const y = SERIES.map((s) => {
    const arr = new Float64Array(n);
    let walk = 0;
    for (let i = 0; i < n; i++) {
      walk = walk * 0.999 + (rng() - 0.5) * s.drift;
      arr[i] =
        s.base +
        Math.sin(i * s.freq) * s.amp +
        Math.cos(i * s.freq * 2.7) * s.amp * 0.25 +
        walk * 14 +
        (rng() - 0.5) * 2.2;
    }
    return arr;
  });

  return { x, y, n };
}
