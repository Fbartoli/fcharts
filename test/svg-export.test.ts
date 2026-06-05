import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSVG, type SvgScene } from '../src/renderers/svg-export.ts';
import { ChartData, resolveSeries } from '../src/core/model.ts';
import { linearScale } from '../src/core/scales.ts';

function scene(over: Partial<SvgScene> = {}): SvgScene {
  const data = new ChartData({
    x: [0, 1, 2, 3, 4],
    y: [
      [0, 2, 1, 3, 2],
      [1, 1, 4, 2, 5],
    ],
  });
  const series = resolveSeries([
    { name: 'Alpha' },
    { name: 'Beta', type: 'area' },
  ]).map((s) => ({ ...s, index: s.index }));
  const W = 200;
  const H = 100;
  const margins = { left: 40, right: 10, top: 10, bottom: 20 };
  return {
    width: W,
    height: H,
    margins,
    series,
    data,
    xScale: linearScale([0, 4], [margins.left, W - margins.right]),
    yScale: linearScale([0, 5], [H - margins.bottom, margins.top]),
    domain: [0, 4],
    xTicks: [0, 2, 4],
    yTicks: [0, 2.5, 5],
    formatX: (v) => String(v),
    formatY: (v) => String(v),
    title: 'Demo',
    desc: 'Two series over five points.',
    xLabel: 'time',
    yLabel: 'value',
    ...over,
  };
}

test('buildSVG: produces a well-formed standalone svg with namespace and viewBox', () => {
  const svg = buildSVG(scene());
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 200 100"/);
  assert.ok(svg.trim().endsWith('</svg>'));
  // Balanced <svg> tags.
  assert.equal(svg.split('<svg').length, 2);
  assert.equal(svg.split('</svg>').length, 2);
});

test('buildSVG: embeds accessible name, title and desc', () => {
  const svg = buildSVG(scene());
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="Demo"/);
  assert.match(svg, /<title>Demo<\/title>/);
  assert.match(svg, /<desc>Two series over five points\.<\/desc>/);
});

test('buildSVG: draws a stroke path per visible series and an area fill for area series', () => {
  const svg = buildSVG(scene());
  const strokes = svg.match(/stroke="#[0-9a-f]{6}"/g) ?? [];
  assert.ok(strokes.length >= 2, `expected >=2 series strokes, got ${strokes.length}`);
  // The area series contributes a closed (Z) filled polygon.
  assert.match(svg, /fill-opacity="0\.15"[^>]*\/>|<path d="[^"]*Z" fill="#[0-9a-f]{6}" fill-opacity/);
  assert.match(svg, /Z"/); // a closed path exists
});

test('buildSVG: renders auto-assigned dash patterns as stroke-dasharray', () => {
  // Two line series → series index 1 gets a non-empty AUTO_DASH pattern.
  const lines = resolveSeries([{ name: 'A' }, { name: 'B' }]);
  const svg = buildSVG(scene({ series: lines }));
  assert.match(svg, /stroke-dasharray="6 4"/);
});

test('buildSVG: hidden series are skipped', () => {
  const series = resolveSeries([{ name: 'A' }, { name: 'B' }]).map((s, i) => ({
    ...s,
    visible: i === 0,
  }));
  const svg = buildSVG(scene({ series }));
  // Series strokes carry the default width 1.25 (grid/border are width 1).
  assert.equal((svg.match(/stroke-width="1\.25"/g) ?? []).length, 1);
});

test('buildSVG: emits tick labels and axis titles as real text', () => {
  const svg = buildSVG(scene());
  for (const label of ['0', '2', '4', '2.5', '5']) {
    assert.ok(svg.includes(`>${label}</text>`), `missing tick label ${label}`);
  }
  assert.ok(svg.includes('>time</text>'));
  assert.ok(svg.includes('>value</text>'));
});

test('buildSVG: escapes XML metacharacters in labels and titles', () => {
  const svg = buildSVG(
    scene({ title: 'A & B <chart>', formatX: () => '<x>', xLabel: '"q"' }),
  );
  assert.match(svg, /<title>A &amp; B &lt;chart&gt;<\/title>/);
  assert.ok(!svg.includes('<x>')); // raw angle brackets from formatter never leak
  assert.match(svg, /&quot;q&quot;/);
});

test('buildSVG: empty dataset yields a valid svg with no series paths', () => {
  const empty = new ChartData({ x: [], y: [[], []] });
  const svg = buildSVG(scene({ data: empty }));
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/stroke-width="1\.25"/g) ?? []).length, 0);
});
