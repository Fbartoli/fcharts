import test from 'node:test';
import assert from 'node:assert/strict';
import { linearScale } from '../src/core/scales.ts';

test('linearScale: maps domain endpoints to range endpoints', () => {
  const s = linearScale([0, 100], [0, 500]);
  assert.equal(s(0), 0);
  assert.equal(s(100), 500);
  assert.equal(s(50), 250);
});

test('linearScale: invert is the inverse of the forward map', () => {
  const s = linearScale([-10, 30], [40, 760]);
  for (const v of [-10, 0, 12.5, 30]) {
    assert.ok(Math.abs(s.invert(s(v)) - v) < 1e-9);
  }
});

test('linearScale: inverted range (y axis, top = max) works', () => {
  const s = linearScale([0, 10], [400, 0]); // value 0 at bottom (px 400), 10 at top (px 0)
  assert.equal(s(0), 400);
  assert.equal(s(10), 0);
  assert.equal(s(5), 200);
});

test('linearScale: zero-width domain does not divide by zero', () => {
  const s = linearScale([5, 5], [0, 100]);
  assert.ok(Number.isFinite(s(5)));
  assert.equal(s(5), 0);
});

test('linearScale: exposes domain and range', () => {
  const s = linearScale([1, 2], [3, 4]);
  assert.deepEqual([...s.domain], [1, 2]);
  assert.deepEqual([...s.range], [3, 4]);
});
