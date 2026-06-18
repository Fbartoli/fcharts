import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSVG, type SvgScene } from '../src/renderers/svg-export.ts';
import { darkTheme } from '../src/renderers/svg-theme.ts';
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
  ]);
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
  // resolveSeries returns fresh objects, so flipping visibility in place is safe here.
  const series = resolveSeries([{ name: 'A' }, { name: 'B' }]);
  series[1].visible = false;
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

test('buildSVG: defaults to the light theme (back-compat — bg white, grid #e5e7eb)', () => {
  const svg = buildSVG(scene());
  assert.match(svg, /<rect width="200" height="100" fill="#ffffff"\/>/);
  assert.match(svg, /stroke="#e5e7eb"/); // gridlines
  assert.match(svg, /stroke="#9ca3af"/); // plot border
});

test('buildSVG: applies a dark theme to bg, grid, axis, tick, and label', () => {
  const svg = buildSVG(scene({ theme: darkTheme }));
  assert.match(svg, /<rect width="200" height="100" fill="#0a0d12"\/>/);
  assert.match(svg, new RegExp(`stroke="${darkTheme.grid.replace(/[().]/g, '\\$&')}"`));
  assert.ok(svg.includes(`fill="${darkTheme.tick}"`), 'tick labels use the theme tick color');
  assert.ok(!svg.includes('fill="#ffffff"'), 'no light background leaks through');
});

test('buildSVG: embeds the ChartSummary JSON only when scene.summary is set', () => {
  assert.ok(!buildSVG(scene()).includes('data-fcharts'), 'omitted by default');
  const svg = buildSVG(scene({ summary: { label: 'Demo', points: 5, series: [{ name: 'Alpha' }] } }));
  const m = svg.match(/<script type="application\/json" data-fcharts="summary">(.*?)<\/script>/s);
  assert.ok(m, 'embedded summary script present');
  const parsed = JSON.parse(m![1]);
  assert.equal(parsed.label, 'Demo');
  assert.equal(parsed.series[0].name, 'Alpha');
});

test('buildSVG: candle bodies render hollow against the theme background', () => {
  const data = new ChartData({
    x: [0, 1, 2],
    y: [[10, 11, 12], [12, 13, 14], [9, 10, 11], [11, 12, 13]], // O,H,L,C — all up (close>open)
  });
  const series = resolveSeries([{ name: 'P', type: 'candle' }]);
  const svg = buildSVG(scene({ data, series, theme: darkTheme, domain: [0, 2], xTicks: [0, 1, 2] }));
  // Up candles are hollow: body rects filled with the dark theme bg, not white.
  assert.ok(svg.includes(`fill="#0a0d12" stroke="#16a34a"`), 'hollow up-candle uses theme bg');
  assert.ok(!svg.includes('fill="#ffffff" stroke="#16a34a"'), 'no hardcoded white hollow');
});
