import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPyramid, StreamingPyramid } from '../src/core/downsample.ts';
import { ChartData, resolveSeries, seriesSlots } from '../src/core/model.ts';
import { buildSummary } from '../src/a11y/summary.ts';
import { buildSVG, type SvgScene } from '../src/renderers/svg-export.ts';
import { linearScale } from '../src/core/scales.ts';

/** Assert a streaming pyramid is identical to a batch build over the same n values. */
function assertSamePyramid(stream: StreamingPyramid, full: Float64Array, label: string): void {
  const batch = buildPyramid(full);
  assert.equal(stream.n, batch.n, `${label}: n`);
  for (let k = 0; k < batch.levels.length; k++) {
    const bs = batch.levels[k].bucketSize;
    const count = Math.ceil(full.length / bs);
    for (let b = 0; b < count; b++) {
      assert.equal(stream.levels[k].min[b], batch.levels[k].min[b], `${label}: L${k} min[${b}]`);
      assert.equal(stream.levels[k].max[b], batch.levels[k].max[b], `${label}: L${k} max[${b}]`);
    }
  }
}

test('seriesSlots: candle consumes 4 y arrays, line/area 1', () => {
  assert.equal(seriesSlots('candle'), 4);
  assert.equal(seriesSlots('line'), 1);
  assert.equal(seriesSlots('area'), 1);
  assert.equal(seriesSlots(undefined), 1);
});

test('resolveSeries: slot offsets account for candle series', () => {
  const r = resolveSeries([
    { name: 'Volume', type: 'area' },
    { name: 'Price', type: 'candle' },
    { name: 'VWAP' },
  ]);
  assert.deepEqual(r.map((s) => [s.index, s.slots]), [[0, 1], [1, 4], [5, 1]]);
});

test('resolveSeries: candle up/down colors default and override', () => {
  const [dflt] = resolveSeries([{ name: 'P', type: 'candle' }]);
  assert.equal(dflt.upColor, '#16a34a');
  assert.equal(dflt.downColor, '#dc2626');
  const [own] = resolveSeries([{ name: 'P', type: 'candle', upColor: '#0f0', downColor: '#f00' }]);
  assert.equal(own.upColor, '#0f0');
  assert.equal(own.downColor, '#f00');
});

test('ChartData.amendLast: replaces the last sample and keeps stats exact', () => {
  const d = new ChartData({ x: [0, 1, 2], y: [[10, 20, 30]] });
  d.amendLast([36]);
  assert.equal(d.y[0][2], 36);
  assert.deepEqual(d.stats[0], { min: 10, max: 36, first: 10, last: 36, mean: 22 });
  // x untouched; a follow-up append still works.
  d.push(3, [40]);
  assert.deepEqual([...d.y[0]], [10, 20, 36, 40]);
});

test('ChartData.amendLast: pyramid matches a batch rebuild after repeated amends', () => {
  // Stream like a forming candle: push a sample, amend it several times, push the next.
  const d = new ChartData({ x: [], y: [[]] });
  const truth: number[] = [];
  for (let i = 0; i < 23; i++) {
    d.push(i, [i * 3]);
    truth.push(i * 3);
    for (let a = 1; a <= 3; a++) {
      const v = i * 3 + Math.sin(i * 7 + a) * 5;
      d.amendLast([v]);
      truth[truth.length - 1] = v;
    }
    assertSamePyramid(d.pyramids[0], Float64Array.from(truth), `after sample ${i}`);
  }
});

test('ChartData.amendLast: a NaN gap amended to a real value enters the stats', () => {
  const d = new ChartData({ x: [0, 1], y: [[5, NaN]] });
  assert.deepEqual(d.stats[0], { min: 5, max: 5, first: 5, last: 5, mean: 5 });
  d.amendLast([9]);
  assert.deepEqual(d.stats[0], { min: 5, max: 9, first: 5, last: 9, mean: 7 });
});

test('ChartData.amendLast: fails fast on empty data, wrong arity, non-finite values', () => {
  assert.throws(() => new ChartData({ x: [], y: [[]] }).amendLast([1]), /empty chart/);
  assert.throws(() => new ChartData({ x: [0], y: [[1]] }).amendLast([1, 2]), /1 series slots/);
  assert.throws(() => new ChartData({ x: [0], y: [[1]] }).amendLast([NaN]), /finite/);
});

test('buildSummary: candle series ranges over low/high, trends on the close', () => {
  // open, high, low, close — close goes 100 → 110 (up >1%); low dips to 90, high tops at 120.
  const d = new ChartData({
    x: [0, 1, 2],
    y: [
      [100, 104, 108],
      [105, 120, 112],
      [99, 90, 107],
      [104, 100, 110],
    ],
  });
  const [s] = buildSummary(d, resolveSeries([{ name: 'BTC', type: 'candle' }]), 'Chart').series;
  assert.equal(s.min, 90);
  assert.equal(s.max, 120);
  assert.equal(s.first, 104);
  assert.equal(s.last, 110);
  assert.equal(s.trend, 'up');
});

function candleScene(points: number, width: number): SvgScene {
  const x = Array.from({ length: points }, (_, i) => i);
  const o = x.map((i) => 100 + (i % 5));
  const c = x.map((i) => 100 + ((i + 2) % 7) - 2);
  const h = x.map((i) => Math.max(o[i], c[i]) + 2);
  const l = x.map((i) => Math.min(o[i], c[i]) - 2);
  const data = new ChartData({ x, y: [o, h, l, c] });
  const margins = { left: 40, right: 10, top: 10, bottom: 20 };
  const H = 100;
  return {
    width,
    height: H,
    margins,
    series: resolveSeries([{ name: 'Price', type: 'candle' }]),
    data,
    xScale: linearScale([0, points - 1], [margins.left, width - margins.right]),
    yScale: linearScale([90, 130], [H - margins.bottom, margins.top]),
    domain: [0, points - 1],
    xTicks: [0, points - 1],
    yTicks: [100, 120],
    formatX: String,
    formatY: String,
    title: 'Candles',
    desc: 'test',
  };
}

test('buildSVG: sparse candles export individual wicks and bodies (up hollow, down filled)', () => {
  const svg = buildSVG(candleScene(10, 400));
  const rects = svg.match(/<rect [^>]*stroke="#16a34a"|<rect [^>]*stroke="#dc2626"/g) ?? [];
  assert.equal(rects.length, 10, 'one body per candle');
  assert.match(svg, /fill="#ffffff" stroke="#16a34a"/); // up = hollow
  assert.match(svg, /fill="#dc2626" stroke="#dc2626"/); // down = filled
  assert.match(svg, /<line [^>]*stroke="#16a34a"/); // wicks carry the direction color too
});

test('buildSVG: dense candles fall back to a single high/low envelope path', () => {
  const svg = buildSVG(candleScene(5000, 400));
  assert.doesNotMatch(svg, /<rect [^>]*stroke="#16a34a"/, 'no individual bodies at this density');
  // One stroked path in the series (wick/outline) color spanning the columns.
  assert.match(svg, /<path d="M[^"]+" stroke="#0284c7" stroke-width="1" fill="none"\/>/);
});
