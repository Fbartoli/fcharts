import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  parseColor,
  ratioOf,
  relativeLuminance,
  isLargeText,
  composite,
} from '../src/compliance/contrast.ts';

const near = (a: number, b: number, eps = 0.02): boolean => Math.abs(a - b) <= eps;

test('parseColor: hex (3/6), rgb, rgba, percentages', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#4b5563'), { r: 75, g: 85, b: 99, a: 1 });
  assert.deepEqual(parseColor('rgb(0, 0, 0)'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseColor('rgba(255,255,255,0.15)'), { r: 255, g: 255, b: 255, a: 0.15 });
  assert.equal(parseColor('not-a-color'), null);
});

test('relativeLuminance: black 0, white 1', () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 }), 0);
  assert.ok(near(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 }), 1));
});

test('contrastRatio: black/white is the maximal 21:1', () => {
  assert.ok(near(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }), 21, 0.1));
});

test('ratioOf: documented FChart pairs match the evidence map', () => {
  // tick #4b5563 on white ≈ 7.56:1; body #374151 ≈ 10.31:1; readout #f9fafb on #111827 ≈ 16.98:1
  assert.ok(near(ratioOf('#4b5563', '#ffffff')!, 7.56, 0.1));
  assert.ok(near(ratioOf('#374151', '#ffffff')!, 10.31, 0.1));
  assert.ok(near(ratioOf('#f9fafb', '#111827')!, 16.98, 0.2));
  // legend "hidden" at opacity .45 (the old R8 bug) composited on white ≈ 2.35:1 — below AA.
  assert.ok(ratioOf('rgba(55,65,81,0.45)', '#ffffff')! < 4.5);
});

test('contrastRatio: faint canvas grid default is below the 3:1 non-text floor', () => {
  // grid rgba(128,128,128,0.13) on white ≈ 1.16:1 (the 1.4.11 gap)
  assert.ok(contrastRatio(parseColor('rgba(128,128,128,0.13)')!, parseColor('#fff')!) < 3);
});

test('composite: alpha blends toward the background', () => {
  const c = composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
  assert.ok(near(c.r, 127.5, 0.1) && c.a === 1);
});

test('isLargeText: 24px, or 18.66px bold', () => {
  assert.equal(isLargeText(24, false), true);
  assert.equal(isLargeText(19, true), true);
  assert.equal(isLargeText(19, false), false);
});
