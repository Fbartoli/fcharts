/**
 * Micro-benchmarks for the renderer-agnostic core hot paths. Run: node bench/micro.ts
 *
 * Three numbers matter:
 *  - downsampleColumns: the per-frame cost (called once per series per frame);
 *  - ChartData construction: time-to-first-frame for large datasets;
 *  - ChartData.push: streaming append throughput (pyramid + stats, no DOM).
 */
import { buildPyramid, downsampleColumns } from '../src/core/downsample.ts';
import { ChartData } from '../src/core/model.ts';

function bench(name: string, iters: number, fn: () => void): void {
  fn(); // warm-up + JIT
  fn();
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const ms = (performance.now() - t0) / iters;
  console.log(`${name.padEnd(46)} ${ms >= 1 ? ms.toFixed(3) + ' ms' : (ms * 1000).toFixed(2) + ' µs'}/op`);
}

const N = 1_000_000;
const x = new Float64Array(N);
const y = new Float64Array(N);
for (let i = 0; i < N; i++) {
  x[i] = i;
  y[i] = Math.sin(i * 1e-3) * 50 + (i % 977) * 0.01;
}
const pyramid = buildPyramid(y);
const out = { min: new Float32Array(800), max: new Float32Array(800) };

// Level mode: fully zoomed out over 1M points, 800 columns (the headline frame cost).
bench('downsampleColumns level (1M pts, 800 cols)', 2000, () => {
  downsampleColumns(x, y, pyramid, [0, N - 1], 800, out);
});

// Raw mode: zoomed in to ~1.2 samples/col.
bench('downsampleColumns raw (1k visible, 800 cols)', 2000, () => {
  downsampleColumns(x, y, pyramid, [500_000, 501_000], 800, out);
});

// Construction: typed-array input (no conversion) and plain-array input (conversion path).
const yPlain = Array.from(y);
bench('ChartData ctor (1M pts, Float64Array)', 60, () => {
  void new ChartData({ x, y: [y] });
});
bench('ChartData ctor (1M pts, number[])', 60, () => {
  void new ChartData({ x, y: [yPlain] });
});

// Streaming push throughput (fresh instance per run so growth cost is included).
bench('ChartData.push ×10k (1 series)', 50, () => {
  const d = new ChartData({ x: [0], y: [[0]] });
  for (let i = 1; i <= 10_000; i++) d.push(i, [i * 0.5]);
});
