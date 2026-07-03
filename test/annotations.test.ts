import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ChartData,
  resolveSeries,
  resolveAnnotations,
  annotationSample,
} from '../src/core/model.ts';
import { buildSummary, describeSummary } from '../src/a11y/summary.ts';
import { buildSVG, type SvgScene } from '../src/renderers/svg-export.ts';
import { renderSVG } from '../src/renderers/render-svg.ts';
import { linearScale } from '../src/core/scales.ts';

test('resolveAnnotations: fills defaults; color falls back to the target series color', () => {
  const series = resolveSeries([{ name: 'A', color: '#abcdef' }, { name: 'B', color: '#123456' }]);
  const [a, b, c] = resolveAnnotations(
    [
      { x: 5, label: 'e1' },
      { x: 7, label: 'e2', kind: 'rule', color: '#ff0000' },
      { x: 9, label: 'e3', seriesIndex: 1 },
    ],
    series,
  );
  assert.deepEqual(a, { x: 5, label: 'e1', kind: 'point', seriesIndex: 0, color: '#abcdef', showLabel: true });
  assert.equal(b.kind, 'rule');
  assert.equal(b.color, '#ff0000');
  assert.equal(c.color, '#123456'); // series 1's color
});

test('resolveAnnotations: showLabel defaults true and honours an explicit false', () => {
  const series = resolveSeries([{ name: 'A', color: '#abcdef' }]);
  const [on, off] = resolveAnnotations([{ x: 1, label: 'a' }, { x: 2, label: 'b', showLabel: false }], series);
  assert.equal(on.showLabel, true);
  assert.equal(off.showLabel, false);
});

test('annotationSample: snaps to the nearest sample of the target series', () => {
  const data = new ChartData({ x: [0, 10, 20, 30], y: [[1, 2, 3, 4]] });
  const series = resolveSeries([{ name: 'A' }]);
  const [a] = resolveAnnotations([{ x: 12, label: 'e' }], series);
  const pt = annotationSample(data, series, a);
  assert.deepEqual(pt, { index: 1, x: 10, y: 2 }); // 12 is closer to 10 than 20
  // Empty data → null.
  assert.equal(annotationSample(new ChartData({ x: [], y: [[]] }), series, a), null);
});

test('annotationSample: candle series snaps the marker to the close', () => {
  const data = new ChartData({ x: [0, 1, 2], y: [[10, 11, 12], [12, 13, 14], [9, 10, 11], [20, 21, 22]] });
  const series = resolveSeries([{ name: 'P', type: 'candle' }]);
  const [a] = resolveAnnotations([{ x: 2, label: 'e' }], series);
  assert.deepEqual(annotationSample(data, series, a), { index: 2, x: 2, y: 22 }); // close slot
});

test('buildSummary + describeSummary: annotations land in the JSON and the one-line desc', () => {
  const data = new ChartData({ x: [0, 1, 2, 3], y: [[10, 12, 11, 18]] });
  const series = resolveSeries([{ name: 'NAV' }]);
  const anns = resolveAnnotations([{ x: 3, label: 'GSR +$2.0M' }, { x: 1, label: 'closure', kind: 'rule' }], series);
  const sum = buildSummary(data, series, 'Book', anns);
  assert.equal(sum.annotations?.length, 2);
  assert.deepEqual(sum.annotations?.[0], { x: 3, label: 'GSR +$2.0M', kind: 'point' });
  const desc = describeSummary(sum, String, String);
  assert.match(desc, /2 events: GSR \+\$2\.0M; closure\.$/);
  // No annotations → no events clause.
  assert.doesNotMatch(describeSummary(buildSummary(data, series, 'Book'), String, String), /events/);
});

function scene(over: Partial<SvgScene> = {}): SvgScene {
  const data = new ChartData({ x: [0, 1, 2, 3, 4], y: [[0, 2, 1, 3, 2]] });
  const series = resolveSeries([{ name: 'A' }]);
  const W = 200;
  const H = 100;
  const margins = { left: 40, right: 10, top: 10, bottom: 20 };
  return {
    width: W, height: H, margins, series, data,
    xScale: linearScale([0, 4], [margins.left, W - margins.right]),
    yScale: linearScale([0, 5], [H - margins.bottom, margins.top]),
    domain: [0, 4], xTicks: [0, 2, 4], yTicks: [0, 2.5, 5],
    formatX: String, formatY: String, title: 'Demo', desc: 'd',
    ...over,
  };
}

test('buildSVG: point annotation draws a diamond + label; rule draws a dashed line + label', () => {
  const series = resolveSeries([{ name: 'A' }]);
  const anns = resolveAnnotations(
    [{ x: 2, label: 'GSR', color: '#ff8800' }, { x: 3, label: 'cut', kind: 'rule', color: '#0088ff' }],
    series,
  );
  const svg = buildSVG(scene({ annotations: anns }));
  // Diamond = a 4-point closed path in the annotation color.
  assert.match(svg, /<path d="M[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+Z" fill="#ff8800"/);
  assert.ok(svg.includes('>GSR</text>'));
  assert.match(svg, /stroke="#0088ff" stroke-width="1" stroke-dasharray="4 3"/); // rule
  assert.ok(svg.includes('>cut</text>'));
});

test('buildSVG: showLabel:false draws the marker but suppresses the static label', () => {
  const series = resolveSeries([{ name: 'A' }]);
  const anns = resolveAnnotations(
    [
      { x: 2, label: 'GSR', color: '#ff8800', showLabel: false },
      { x: 3, label: 'cut', kind: 'rule', color: '#0088ff', showLabel: false },
    ],
    series,
  );
  const svg = buildSVG(scene({ annotations: anns }));
  // Marker geometry still present...
  assert.match(svg, /<path d="M[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+L[\d.]+,[\d.]+Z" fill="#ff8800"/);
  assert.match(svg, /stroke="#0088ff" stroke-width="1" stroke-dasharray="4 3"/);
  // ...but neither label is drawn.
  assert.ok(!svg.includes('>GSR</text>'), 'point label suppressed');
  assert.ok(!svg.includes('>cut</text>'), 'rule label suppressed');
});

test('buildSVG: a point annotation on a hidden series is dropped; a rule survives', () => {
  const series = resolveSeries([{ name: 'A' }]);
  series[0].visible = false;
  const anns = resolveAnnotations([{ x: 2, label: 'pt' }, { x: 3, label: 'rl', kind: 'rule' }], series);
  const svg = buildSVG(scene({ series, annotations: anns }));
  assert.ok(!svg.includes('>pt</text>'), 'point marker hides with its series');
  assert.ok(svg.includes('>rl</text>'), 'series-independent rule still draws');
});

test('buildSVG: annotation labels are XML-escaped', () => {
  const series = resolveSeries([{ name: 'A' }]);
  const anns = resolveAnnotations([{ x: 2, label: 'A & <B>' }], series);
  const svg = buildSVG(scene({ annotations: anns }));
  assert.ok(!svg.includes('<B>'));
  assert.match(svg, /A &amp; &lt;B&gt;/);
});

test('renderSVG: annotations flow through to both the markers and the embedded summary', () => {
  const svg = renderSVG(
    { series: [{ name: 'NAV', type: 'area' }], options: { ariaLabel: 'Book' }, annotations: [{ x: 3, label: 'GSR +$2.0M' }] },
    { x: [0, 1, 2, 3], y: [[10, 12, 11, 18]] },
    { width: 480, height: 200 },
  );
  const m = svg.match(/<script type="application\/json" data-fcharts="summary">(.*?)<\/script>/s);
  const sum = JSON.parse(m![1]);
  assert.equal(sum.annotations[0].label, 'GSR +$2.0M');
  assert.match(svg, /<desc>[^<]*1 events: GSR \+\$2\.0M\.<\/desc>/);
  assert.ok(svg.includes('>GSR +$2.0M</text>'), 'marker label drawn');
});
