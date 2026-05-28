import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTick, niceTicks, tickStep } from '../src/core/ticks.ts';

test('niceTicks: produces round values inside the domain', () => {
  const t = niceTicks(0, 100, 5);
  assert.deepEqual(t, [0, 20, 40, 60, 80, 100]);
});

test('niceTicks: handles negative domains and snaps zero cleanly', () => {
  const t = niceTicks(-30, 30, 6);
  assert.ok(t.includes(0));
  // no -0
  assert.ok(!Object.is(t[t.indexOf(0)], -0));
  for (const v of t) assert.ok(v >= -30 && v <= 30);
});

test('niceTicks: degenerate domain returns a single value', () => {
  assert.deepEqual(niceTicks(5, 5, 5), [5]);
  assert.deepEqual(niceTicks(10, 0, 5), [10]);
});

test('niceTicks: minStep floors the step (integer index axis)', () => {
  const t = niceTicks(0, 8, 50, 1); // wants 50 ticks but step floored to 1
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 1);
});

test('niceTicks: no floating-point drift across many steps', () => {
  const t = niceTicks(0, 1, 10); // step 0.1
  // Each value should be a clean multiple of 0.1 within tolerance.
  for (const v of t) assert.ok(Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);
});

test('tickStep: returns a 1/2/5 × 10^k step', () => {
  assert.equal(tickStep(0, 100, 5), 20);
  assert.equal(tickStep(0, 1, 10), 0.1);
  assert.equal(tickStep(0, 50, 5), 10);
});

test('formatTick: compact thousands and trimmed decimals', () => {
  assert.equal(formatTick(12500), '12.5k');
  assert.equal(formatTick(2000), '2k');
  assert.equal(formatTick(42), '42');
  assert.equal(formatTick(3.14159), '3.1');
  assert.equal(formatTick(0), '0');
});
