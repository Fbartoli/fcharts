import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartData } from '../src/core/model.ts';

test('ChartData: normalizes arrays and exposes n, extents, pyramids', () => {
  const d = new ChartData({
    x: [0, 1, 2, 3],
    y: [
      [10, 20, 30, 40],
      [-5, 0, 5, 2],
    ],
  });
  assert.equal(d.n, 4);
  assert.equal(d.y.length, 2);
  assert.ok(d.x instanceof Float64Array);
  assert.deepEqual(d.stats[0], { min: 10, max: 40, first: 10, last: 40, mean: 25 });
  assert.deepEqual(d.stats[1], { min: -5, max: 5, first: -5, last: 2, mean: 0.5 });
  assert.equal(d.pyramids.length, 2);
});

test('ChartData: stats skip non-finite y (NaN/Infinity) so summaries stay real numbers', () => {
  const d = new ChartData({ x: [0, 1, 2, 3], y: [[10, NaN, 30, Infinity]] });
  // Only the finite samples (10, 30) count.
  assert.deepEqual(d.stats[0], { min: 10, max: 30, first: 10, last: 30, mean: 20 });
  for (const v of Object.values(d.stats[0])) assert.ok(Number.isFinite(v));
});

test('ChartData: keeps a Float64Array x without copying', () => {
  const x = Float64Array.from([0, 1, 2]);
  const d = new ChartData({ x, y: [[1, 2, 3]] });
  assert.equal(d.x, x); // same reference — no defensive copy for typed arrays
});

test('ChartData: throws on mismatched series length (fail fast, clear message)', () => {
  assert.throws(
    () => new ChartData({ x: [0, 1, 2], y: [[1, 2]] }),
    /series 0 has 2 points but x has 3/,
  );
});

test('ChartData: xExtent returns [first, last]', () => {
  const d = new ChartData({ x: [100, 200, 350], y: [[1, 2, 3]] });
  assert.deepEqual(d.xExtent(), [100, 350]);
});

test('ChartData: yExtent combines visible series only', () => {
  const d = new ChartData({
    x: [0, 1, 2],
    y: [
      [0, 0, 100],
      [-50, -50, -50],
    ],
  });
  assert.deepEqual(d.yExtent([true, true]), [-50, 100]);
  assert.deepEqual(d.yExtent([true, false]), [0, 100]);
  // Only the flat series visible → degenerate extent widened to a unit span.
  assert.deepEqual(d.yExtent([false, true]), [-51, -49]);
});

test('ChartData: yExtent widens a degenerate (flat) extent to a unit span', () => {
  const d = new ChartData({ x: [0, 1, 2], y: [[7, 7, 7]] });
  assert.deepEqual(d.yExtent([true]), [6, 8]);
});

test('ChartData: empty dataset is handled', () => {
  const d = new ChartData({ x: [], y: [[]] });
  assert.equal(d.n, 0);
  assert.deepEqual(d.xExtent(), [0, 1]);
  assert.deepEqual(d.yExtent([true]), [0, 1]);
});
