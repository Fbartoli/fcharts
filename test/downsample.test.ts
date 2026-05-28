import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPyramid,
  downsampleColumns,
  lowerBound,
  planDownsample,
} from '../src/core/downsample.ts';

function ramp(n: number): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = i;
  return y;
}
function indices(n: number): Float64Array {
  return ramp(n);
}

test('buildPyramid: bucket sizes double and coarsest level captures global extremes', () => {
  const y = ramp(10); // 0..9
  const p = buildPyramid(y);
  assert.deepEqual(
    p.levels.map((l) => l.bucketSize),
    [2, 4, 8, 16],
  );
  const coarsest = p.levels[p.levels.length - 1];
  assert.equal(coarsest.min.length, 1);
  assert.equal(coarsest.min[0], 0);
  assert.equal(coarsest.max[0], 9);
});

test('buildPyramid: level 0 aggregates consecutive pairs (odd tail handled)', () => {
  const p = buildPyramid(Float64Array.from([5, 1, 9, 2, 7])); // n=5 → 3 buckets
  const l0 = p.levels[0];
  assert.equal(l0.bucketSize, 2);
  assert.deepEqual([...l0.min], [1, 2, 7]);
  assert.deepEqual([...l0.max], [5, 9, 7]); // last bucket duplicates the lone element
});

test('buildPyramid: empty series yields no levels', () => {
  const p = buildPyramid(new Float64Array(0));
  assert.equal(p.n, 0);
  assert.equal(p.levels.length, 0);
});

test('lowerBound: first index >= target', () => {
  const x = Float64Array.from([0, 10, 20, 30, 40]);
  assert.equal(lowerBound(x, -5), 0);
  assert.equal(lowerBound(x, 0), 0);
  assert.equal(lowerBound(x, 11), 2);
  assert.equal(lowerBound(x, 40), 4);
  assert.equal(lowerBound(x, 100), 5);
});

test('planDownsample: iterations stay ~O(width) regardless of N (the thesis invariant)', () => {
  const cols = 500;
  const budget = 2 * cols + 4; // see pickLevel: <= ~2 buckets per column
  for (const n of [10_000, 100_000, 250_000, 1_000_000]) {
    const x = indices(n);
    const p = buildPyramid(ramp(n));
    const plan = planDownsample(x, p, [0, n - 1], cols); // fully zoomed out
    assert.equal(plan.mode, 'level');
    assert.ok(
      plan.iterations <= budget,
      `n=${n}: iterated ${plan.iterations}, budget ${budget}`,
    );
    // And it must cover every column (>= width buckets), so no gaps in the envelope.
    assert.ok(plan.iterations >= cols - 2, `n=${n}: too few iterations (${plan.iterations})`);
  }
});

test('planDownsample: cost grows with N at most ~constant factor between 10k and 250k', () => {
  const cols = 800;
  const small = planDownsample(indices(10_000), buildPyramid(ramp(10_000)), [0, 9_999], cols);
  const large = planDownsample(indices(250_000), buildPyramid(ramp(250_000)), [0, 249_999], cols);
  assert.ok(large.iterations / small.iterations < 1.5, `ratio ${large.iterations / small.iterations}`);
});

test('planDownsample: zoomed-in view uses raw mode and iterates ~visible count', () => {
  const n = 100_000;
  const x = indices(n);
  const p = buildPyramid(ramp(n));
  const plan = planDownsample(x, p, [1000, 1100], 500); // 100-wide window, 500 cols
  assert.equal(plan.mode, 'raw');
  assert.ok(plan.iterations <= 110, `iterated ${plan.iterations}`);
});

test('planDownsample: empty for inverted/zero-width domain or empty data', () => {
  const x = indices(100);
  const p = buildPyramid(ramp(100));
  assert.equal(planDownsample(x, p, [50, 50], 400).mode, 'empty');
  assert.equal(planDownsample(x, p, [80, 20], 400).mode, 'empty');
  assert.equal(planDownsample(new Float64Array(0), buildPyramid(new Float64Array(0)), [0, 1], 400).mode, 'empty');
});

test('downsampleColumns (raw mode): exact per-column min/max', () => {
  // 6 points over 3 columns → 2 points per column, but pointsPerCol < 2 path needs <2.
  const x = Float64Array.from([0, 1, 2, 3]);
  const y = Float64Array.from([10, -5, 3, 8]);
  const p = buildPyramid(y);
  // domain [0,3], 4 cols → pointsPerCol = 4/4 = 1 → raw
  const env = downsampleColumns(x, y, p, [0, 3], 4);
  // col mapping: c = floor((xv-0)/3 * 4); x=0→0, 1→1.33→1, 2→2.66→2, 3→clamp 3
  assert.equal(env.min[0], 10);
  assert.equal(env.min[1], -5);
  assert.equal(env.min[2], 3);
  assert.equal(env.min[3], 8);
  assert.equal(env.first, 0);
  assert.equal(env.last, 3);
});

test('downsampleColumns (level mode): envelope preserves the visible global extremes', () => {
  const n = 50_000;
  const x = indices(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = Math.sin(i * 0.01) * 100;
  // Plant unmistakable spikes well inside the domain.
  y[12_345] = 999;
  y[40_000] = -999;
  const p = buildPyramid(y);
  const env = downsampleColumns(x, y, p, [0, n - 1], 600);

  let emax = -Infinity;
  let emin = Infinity;
  for (let c = 0; c < env.max.length; c++) {
    if (env.max[c] > emax) emax = env.max[c];
    if (env.min[c] < emin) emin = env.min[c];
  }
  assert.ok(emax >= 999 - 0.5, `lost the +999 spike (got ${emax})`);
  assert.ok(emin <= -999 + 0.5, `lost the -999 spike (got ${emin})`);
});

test('downsampleColumns: no gaps with non-uniform (clustered) x', () => {
  // First half packed into x∈[0,1), second half stretched over [1,1000) — the shape that
  // left ~half the columns empty before bucket spans were filled.
  const n = 20_000;
  const x = new Float64Array(n);
  for (let i = 0; i < n / 2; i++) x[i] = (i / (n / 2)) * 1;
  for (let i = n / 2; i < n; i++) x[i] = 1 + ((i - n / 2) / (n / 2)) * 999;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = Math.sin(i * 0.01) * 50;
  const p = buildPyramid(y);
  const env = downsampleColumns(x, y, p, [x[0], x[n - 1]], 600);

  let gaps = 0;
  for (let c = env.first; c <= env.last; c++) if (env.min[c] === Infinity) gaps++;
  assert.equal(gaps, 0, `expected a gap-free envelope, found ${gaps} empty interior columns`);
});

test('downsampleColumns: reuses provided output buffers (no per-frame allocation)', () => {
  const n = 1000;
  const x = indices(n);
  const y = ramp(n);
  const p = buildPyramid(y);
  const out = { min: new Float32Array(300), max: new Float32Array(300) };
  const env = downsampleColumns(x, y, p, [0, n - 1], 300, out);
  assert.equal(env.min, out.min);
  assert.equal(env.max, out.max);
});
