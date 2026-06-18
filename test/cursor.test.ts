import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annotationIndexByX,
  annotationStep,
  handlesKey,
  panToInclude,
  selectsAnnotation,
  stepCursor,
  zoomFactor,
} from '../src/a11y/cursor.ts';

const ALL_VISIBLE = [true, true, true];

test('handlesKey: recognizes navigation, zoom, event-marker, and Escape keys', () => {
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
                   '+', '=', '-', '_', '[', ']', 'Enter', 'Escape']) {
    assert.equal(handlesKey(k), true, k);
  }
  for (const k of ['a', 'Tab', ' ', 'PageUp']) {
    assert.equal(handlesKey(k), false, k);
  }
});

test('annotationStep / selectsAnnotation: bracket keys step, Enter selects', () => {
  assert.equal(annotationStep(']'), 1);
  assert.equal(annotationStep('['), -1);
  assert.equal(annotationStep('Enter'), null);
  assert.equal(annotationStep('ArrowRight'), null);
  assert.equal(selectsAnnotation('Enter'), true);
  assert.equal(selectsAnnotation(']'), false);
});

test('annotationIndexByX: steps to the next/previous marker by x, no wrap', () => {
  const xs = [30, 10, 20]; // unsorted: indices 0,1,2 at x 30,10,20
  // null start: first marker forward (x=10 → index 1), last marker backward (x=30 → index 0)
  assert.equal(annotationIndexByX(xs, null, 1), 1);
  assert.equal(annotationIndexByX(xs, null, -1), 0);
  // forward from x=10 → x=20 (index 2); from x=20 → x=30 (index 0)
  assert.equal(annotationIndexByX(xs, 10, 1), 2);
  assert.equal(annotationIndexByX(xs, 20, 1), 0);
  // at the last marker, forward stays on it (no wrap)
  assert.equal(annotationIndexByX(xs, 30, 1), 0);
  // backward from x=20 → x=10 (index 1); at the first, backward stays put
  assert.equal(annotationIndexByX(xs, 20, -1), 1);
  assert.equal(annotationIndexByX(xs, 10, -1), 1);
  // empty set → null
  assert.equal(annotationIndexByX([], null, 1), null);
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
