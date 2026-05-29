import test from 'node:test';
import assert from 'node:assert/strict';
import { handlesKey, panToInclude, stepCursor, zoomFactor } from '../src/a11y/cursor.ts';

const ALL_VISIBLE = [true, true, true];

test('handlesKey: recognizes navigation, zoom, and Escape keys', () => {
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
                   '+', '=', '-', '_', 'Escape']) {
    assert.equal(handlesKey(k), true, k);
  }
  for (const k of ['a', 'Enter', 'Tab', ' ', 'PageUp']) {
    assert.equal(handlesKey(k), false, k);
  }
});

test('zoomFactor: + zooms in (<1), - zooms out (>1), other keys null', () => {
  assert.ok((zoomFactor('+') ?? 0) < 1);
  assert.equal(zoomFactor('='), zoomFactor('+')); // unshifted + on most layouts
  assert.ok((zoomFactor('-') ?? 0) > 1);
  assert.equal(zoomFactor('_'), zoomFactor('-'));
  // zoom-in then zoom-out is an exact round trip
  assert.ok(Math.abs(zoomFactor('+')! * zoomFactor('-')! - 1) < 1e-12);
  for (const k of ['ArrowLeft', 'Home', 'Escape', 'a']) assert.equal(zoomFactor(k), null, k);
});

test('stepCursor: returns null for unhandled keys', () => {
  assert.equal(stepCursor({ series: 0, index: 5 }, 'x', { n: 10, visibleCount: 10, seriesVisible: ALL_VISIBLE, fine: false }), null);
});

test('stepCursor: coarse vs fine horizontal step', () => {
  const opts = { n: 100_000, visibleCount: 1200, seriesVisible: ALL_VISIBLE, fine: false };
  // coarse = round(1200/120) = 10
  assert.deepEqual(stepCursor({ series: 0, index: 0 }, 'ArrowRight', opts), { series: 0, index: 10 });
  assert.deepEqual(
    stepCursor({ series: 0, index: 50 }, 'ArrowRight', { ...opts, fine: true }),
    { series: 0, index: 51 },
  );
});

test('stepCursor: clamps at both ends', () => {
  const opts = { n: 10, visibleCount: 10, seriesVisible: ALL_VISIBLE, fine: true };
  assert.deepEqual(stepCursor({ series: 0, index: 0 }, 'ArrowLeft', opts), { series: 0, index: 0 });
  assert.deepEqual(stepCursor({ series: 0, index: 9 }, 'ArrowRight', opts), { series: 0, index: 9 });
  assert.deepEqual(stepCursor({ series: 0, index: 5 }, 'Home', opts), { series: 0, index: 0 });
  assert.deepEqual(stepCursor({ series: 0, index: 5 }, 'End', opts), { series: 0, index: 9 });
});

test('stepCursor: ArrowDown/Up cycle and skip hidden series', () => {
  const opts = { n: 10, visibleCount: 10, seriesVisible: [true, false, true], fine: false };
  // from 0, down skips hidden 1 → 2
  assert.equal(stepCursor({ series: 0, index: 0 }, 'ArrowDown', opts)?.series, 2);
  // from 2, down wraps to 0
  assert.equal(stepCursor({ series: 2, index: 0 }, 'ArrowDown', opts)?.series, 0);
  // from 0, up wraps skipping hidden 1 → 2
  assert.equal(stepCursor({ series: 0, index: 0 }, 'ArrowUp', opts)?.series, 2);
});

test('stepCursor: stays put when no series are visible', () => {
  const opts = { n: 10, visibleCount: 10, seriesVisible: [false, false], fine: false };
  assert.equal(stepCursor({ series: 0, index: 0 }, 'ArrowDown', opts)?.series, 0);
});

test('panToInclude: shifts to contain x, preserving width', () => {
  assert.deepEqual(panToInclude([100, 200], 50), [50, 150]);
  assert.deepEqual(panToInclude([100, 200], 250), [150, 250]);
});

test('panToInclude: unchanged in value when x already inside', () => {
  assert.deepEqual(panToInclude([100, 200], 150), [100, 200]);
});
