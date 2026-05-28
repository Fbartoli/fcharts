import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartData, resolveSeries } from '../src/core/model.ts';
import { buildSummary, describeSummary } from '../src/a11y/summary.ts';

function summaryOf(x: number[], ys: number[][], names: string[], visible?: boolean[]) {
  const data = new ChartData({ x, y: ys });
  const series = resolveSeries(
    names.map((name, i) => ({ name, color: '#000', visible: visible ? visible[i] : true })),
  );
  return buildSummary(data, series, 'Test');
}

test('buildSummary: per-series stats, change, and upward trend', () => {
  const s = summaryOf([0, 1, 2, 3], [[100, 110, 120, 132]], ['A']);
  assert.equal(s.points, 4);
  assert.deepEqual([s.xStart, s.xEnd], [0, 3]);
  const a = s.series[0];
  assert.equal(a.min, 100);
  assert.equal(a.max, 132);
  assert.equal(a.first, 100);
  assert.equal(a.last, 132);
  assert.equal(a.mean, 115.5);
  assert.equal(a.changeAbs, 32);
  assert.ok(Math.abs(a.changePct - 32) < 1e-9);
  assert.equal(a.trend, 'up');
});

test('buildSummary: downward and flat trends', () => {
  const s = summaryOf([0, 1, 2, 3], [
    [80, 70, 60, 40],
    [50, 50, 50, 50],
  ], ['Down', 'Flat']);
  assert.equal(s.series[0].trend, 'down');
  assert.ok(s.series[0].changeAbs < 0);
  assert.equal(s.series[1].trend, 'flat');
  assert.equal(s.series[1].changePct, 0); // flat series, first != 0
});

test('buildSummary: trend never contradicts changePct (spike inflates range)', () => {
  // A huge interior spike inflates the range; trend must still follow the +8% end-to-end move.
  const s = summaryOf([0, 1, 2, 3, 4], [[100, 10000, 100, 105, 108]], ['Spike']);
  const a = s.series[0];
  assert.ok(Math.abs(a.changePct - 8) < 1e-9);
  assert.equal(a.trend, 'up'); // not 'flat' — consistent with the reported +8%
});

test('describeSummary: states "all series hidden" when nothing is visible', () => {
  const s = summaryOf([0, 1], [[1, 2], [3, 4]], ['A', 'B'], [false, false]);
  const text = describeSummary(s, String, String);
  assert.match(text, /all series hidden/);
  assert.doesNotMatch(text, /ranges/);
});

test('buildSummary: changePct is range-relative when first is 0', () => {
  const s = summaryOf([0, 1, 2], [[0, 5, 10]], ['Z']);
  // first=0 → fall back to change/range*100 = 10/10*100 = 100
  assert.ok(Math.abs(s.series[0].changePct - 100) < 1e-9);
});

test('buildSummary: carries per-series visibility', () => {
  const s = summaryOf([0, 1], [[1, 2], [3, 4]], ['A', 'B'], [true, false]);
  assert.equal(s.series[0].visible, true);
  assert.equal(s.series[1].visible, false);
});

test('describeSummary: one-line sentence with values and trend', () => {
  const s = summaryOf([0, 1, 2, 3], [[100, 110, 120, 132]], ['A']);
  const text = describeSummary(s, (x) => String(x), (y) => y.toFixed(0));
  assert.match(text, /Test: 4 points per series from 0 to 3\./);
  assert.match(text, /A ranges 100 to 132, now 132 \(up 32\.0%\)/);
});

test('describeSummary: only visible series are described', () => {
  const s = summaryOf([0, 1], [[1, 2], [3, 4]], ['Shown', 'Hidden'], [true, false]);
  const text = describeSummary(s, (x) => String(x), (y) => y.toFixed(0));
  assert.match(text, /Shown ranges/);
  assert.doesNotMatch(text, /Hidden ranges/);
});

test('describeSummary: handles empty data', () => {
  const s = summaryOf([], [[]], ['A']);
  assert.equal(describeSummary(s, String, String), 'Test: no data.');
});
