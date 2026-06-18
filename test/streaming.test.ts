import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPyramid, StreamingPyramid, downsampleColumns } from '../src/core/downsample.ts';
import { ChartData } from '../src/core/model.ts';

/** Assert a streaming pyramid is identical to a batch build over the same n values. */
function assertSamePyramid(stream: StreamingPyramid, full: Float64Array, label: string): void {
  const batch = buildPyramid(full);
  assert.equal(stream.n, batch.n, `${label}: n`);
  assert.equal(stream.levels.length, batch.levels.length, `${label}: level count`);
  for (let k = 0; k < batch.levels.length; k++) {
    const bs = batch.levels[k].bucketSize;
    assert.equal(stream.levels[k].bucketSize, bs, `${label}: L${k} bucketSize`);
    const count = Math.ceil(full.length / bs); // real buckets (stream array may have spare capacity)
    for (let b = 0; b < count; b++) {
      assert.equal(stream.levels[k].min[b], batch.levels[k].min[b], `${label}: L${k} min[${b}]`);
      assert.equal(stream.levels[k].max[b], batch.levels[k].max[b], `${label}: L${k} max[${b}]`);
    }
  }
}

test('StreamingPyramid: push-from-empty equals a batch build, for every length 1..40', () => {
  // Deterministic but varied values (negatives, repeats, a spike).
  const vals = Array.from({ length: 40 }, (_, i) =>
    i === 17 ? 1000 : Math.sin(i * 1.3) * 50 - (i % 5) * 7,
  );
  for (let n = 1; n <= 40; n++) {
    const full = Float64Array.from(vals.slice(0, n));
    const stream = new StreamingPyramid(new Float64Array(0));
    for (const v of full) stream.push(v);
    assertSamePyramid(stream, full, `n=${n}`);
  }
});

test('StreamingPyramid: batch-build-then-push equals a full batch build', () => {
  const vals = Array.from({ length: 33 }, (_, i) => Math.cos(i) * 12 + i);
  for (let split = 0; split <= 33; split++) {
    const full = Float64Array.from(vals);
    const stream = new StreamingPyramid(Float64Array.from(vals.slice(0, split)));
    for (let i = split; i < vals.length; i++) stream.push(vals[i]);
    assertSamePyramid(stream, full, `split=${split}`);
  }
});

test('StreamingPyramid: handles NaN like the batch build (NaN propagates into min/max)', () => {
  const vals = [3, NaN, 7, 2, 9];
  const full = Float64Array.from(vals);
  const stream = new StreamingPyramid(new Float64Array(0));
  for (const v of vals) stream.push(v);
  // Compare bucket-for-bucket; Number-equality via Object.is so NaN===NaN here.
  const batch = buildPyramid(full);
  for (let k = 0; k < batch.levels.length; k++) {
    const count = Math.ceil(full.length / batch.levels[k].bucketSize);
    for (let b = 0; b < count; b++) {
      assert.ok(Object.is(stream.levels[k].min[b], batch.levels[k].min[b]), `L${k} min[${b}]`);
      assert.ok(Object.is(stream.levels[k].max[b], batch.levels[k].max[b]), `L${k} max[${b}]`);
    }
  }
});

test('ChartData.push: a streamed dataset matches a batch dataset (views, stats, downsample)', () => {
  const N = 500;
  const x = Array.from({ length: N }, (_, i) => i);
  const y0 = Array.from({ length: N }, (_, i) => Math.sin(i / 9) * 30 + (i % 7));
  const y1 = Array.from({ length: N }, (_, i) => -Math.cos(i / 5) * 20 + i / 10);

  const batch = new ChartData({ x, y: [y0, y1] });
  // Stream: seed with the first 3 points, append the rest one at a time (forces grows + pyramid push).
  const stream = new ChartData({ x: x.slice(0, 3), y: [y0.slice(0, 3), y1.slice(0, 3)] });
  for (let i = 3; i < N; i++) stream.push(x[i], [y0[i], y1[i]]);

  assert.equal(stream.n, N);
  assert.equal(stream.x.length, N, 'x view is exact length n');
  assert.equal(stream.y[0].length, N);
  assert.deepEqual([...stream.x], [...batch.x]);
  assert.deepEqual([...stream.y[0]], [...batch.y[0]]);

  for (let s = 0; s < 2; s++) {
    assert.deepEqual(stream.stats[s], batch.stats[s], `series ${s} stats`);
  }

  // Same rendered envelope over a zoomed-out domain (exercises a coarse pyramid level).
  for (const dom of [[0, N - 1], [100, 260], [N - 50, N - 1]] as [number, number][]) {
    for (let s = 0; s < 2; s++) {
      const a = downsampleColumns(batch.x, batch.y[s], batch.pyramids[s], dom, 120);
      const b = downsampleColumns(stream.x, stream.y[s], stream.pyramids[s], dom, 120);
      assert.deepEqual([...b.min], [...a.min], `dom ${dom} series ${s} min`);
      assert.deepEqual([...b.max], [...a.max], `dom ${dom} series ${s} max`);
      assert.equal(b.first, a.first);
      assert.equal(b.last, a.last);
    }
  }
});

test('ChartData.push: validates series count and non-decreasing x', () => {
  const d = new ChartData({ x: [0, 1], y: [[1, 2]] });
  assert.throws(() => d.push(2, [1, 2]), /got 2 y-values but the chart has 1 series/);
  assert.throws(() => d.push(0.5, [3]), /x must be >= the current last x/);
  d.push(2, [3]); // ok
  assert.equal(d.n, 3);
  assert.deepEqual([...d.x], [0, 1, 2]);
});

test('ChartData.push: rejects non-finite x (NaN passes ordering checks but breaks search)', () => {
  const d = new ChartData({ x: [0, 1], y: [[1, 2]] });
  assert.throws(() => d.push(NaN, [3]), /x must be a finite number \(got NaN\)/);
  assert.throws(() => d.push(Infinity, [3]), /x must be a finite number/);
  assert.equal(d.n, 2); // nothing was written
});
