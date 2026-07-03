import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmapSVG } from '../src/renderers/heatmap.ts';

/** Pull the embedded agent-readable JSON summary out of an SVG, or null. */
function embedded(svg: string): Record<string, unknown> | null {
  const m = svg.match(/<script type="application\/json" data-fcharts="summary">(.*?)<\/script>/s);
  return m ? (JSON.parse(m[1]) as Record<string, unknown>) : null;
}

function wellFormed(svg: string): void {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.trim().endsWith('</svg>'));
  assert.equal(svg.split('<svg').length, 2);
  assert.equal(svg.split('</svg>').length, 2);
}

test('buildHeatmapSVG: cells + labels + peak desc + agent summary, well-formed', () => {
  const svg = buildHeatmapSVG(
    {
      rows: ['Mon', 'Tue'],
      cols: ['EU', 'US'],
      cells: [
        { row: 'Mon', col: 'EU', value: 10 },
        { row: 'Mon', col: 'US', value: 40 },
        { row: 'Tue', col: 'EU', value: 25 },
      ],
    },
    { width: 320, title: 'Latency', formatValue: (v) => `${v}ms` },
  );
  wellFormed(svg);
  // Row + column labels render.
  assert.ok(svg.includes('>Mon</text>') && svg.includes('>Tue</text>'));
  assert.ok(svg.includes('>EU</text>') && svg.includes('>US</text>'));
  // Each present cell carries a value <title>; the empty Tue×US slot does not.
  assert.ok(svg.includes('<title>Mon × US: 40ms</title>'));
  assert.equal((svg.match(/<title>/g) ?? []).length, 4, '3 cell titles + the document title');
  // desc names the peak cell with the formatted value; legend shows the formatted domain.
  assert.match(svg, /<desc>Latency: 2×2 grid; peak Mon\/US 40ms\.<\/desc>/);
  assert.ok(svg.includes('>10ms</text>') && svg.includes('>40ms</text>'), 'legend min/max labels');
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'heatmap');
  assert.equal(sum.label, 'Latency');
  assert.deepEqual(sum.rows, ['Mon', 'Tue']);
  assert.deepEqual(sum.cols, ['EU', 'US']);
  assert.equal(sum.min, 10);
  assert.equal(sum.max, 40);
  assert.deepEqual(sum.cells, [
    { row: 'Mon', col: 'EU', value: 10 },
    { row: 'Mon', col: 'US', value: 40 },
    { row: 'Tue', col: 'EU', value: 25 },
  ]);
});

test('buildHeatmapSVG: min cell → colors[0], max → colors[1], mid interpolates', () => {
  const svg = buildHeatmapSVG(
    {
      rows: ['r1', 'r2'],
      cols: ['c1', 'c2'],
      cells: [
        { row: 'r1', col: 'c1', value: 0 },   // min
        { row: 'r1', col: 'c2', value: 50 },  // exact midpoint of [0,100]
        { row: 'r2', col: 'c2', value: 100 }, // max
      ],
    },
    { width: 300, colors: ['#000000', '#ffffff'] },
  );
  // Endpoints are exact; the fill is tied to its cell's own <title>.
  assert.match(svg, /fill="#000000"[^>]*><title>r1 × c1: 0<\/title>/);
  assert.match(svg, /fill="#ffffff"[^>]*><title>r2 × c2: 100<\/title>/);
  assert.match(svg, /fill="#808080"[^>]*><title>r1 × c2: 50<\/title>/, 't=0.5 → mid-gray');
});

test('buildHeatmapSVG: a single-value domain (min===max) maps every cell to the ramp midpoint', () => {
  const svg = buildHeatmapSVG(
    { rows: ['a'], cols: ['x', 'y'], cells: [
      { row: 'a', col: 'x', value: 5 },
      { row: 'a', col: 'y', value: 5 },
    ] },
    { width: 240, colors: ['#000000', '#ffffff'] },
  );
  assert.match(svg, /fill="#808080"[^>]*><title>a × x: 5<\/title>/);
  assert.match(svg, /fill="#808080"[^>]*><title>a × y: 5<\/title>/);
});

test('buildHeatmapSVG: a missing cell renders as a faint outline, not a zero fill', () => {
  const svg = buildHeatmapSVG(
    { rows: ['r1', 'r2'], cols: ['c1', 'c2'], cells: [
      { row: 'r1', col: 'c1', value: 1 },
      { row: 'r2', col: 'c2', value: 2 },
    ] },
    { width: 240 },
  );
  // The two absent cells (r1×c2, r2×c1) are the only fill="none" rects; present cells are filled.
  assert.equal((svg.match(/fill="none"/g) ?? []).length, 2, 'two outline-only slots');
});

test('buildHeatmapSVG: a cell in an undeclared row/col is dropped (fail-soft) + consistent domain', () => {
  const svg = buildHeatmapSVG(
    { rows: ['r1'], cols: ['c1'], cells: [
      { row: 'r1', col: 'c1', value: 1 },
      { row: 'ghost', col: 'c1', value: 9 }, // unknown row
      { row: 'r1', col: 'ghost', value: 9 }, // unknown col
    ] },
    { width: 220 },
  );
  assert.ok(!svg.includes('ghost'), 'dropped cells never render');
  const sum = embedded(svg)!;
  assert.equal((sum.cells as unknown[]).length, 1, 'only the declared cell survives');
  assert.equal(sum.max, 1, 'dropped values excluded from the domain');
});

test('buildHeatmapSVG: href wraps the cell in a focusable drill-down link (summary unchanged)', () => {
  const svg = buildHeatmapSVG(
    { rows: ['r1'], cols: ['c1', 'c2'], cells: [
      { row: 'r1', col: 'c1', value: 3, href: '/book?cell=r1-c1' },
      { row: 'r1', col: 'c2', value: 4 }, // no href
    ] },
    { width: 260 },
  );
  wellFormed(svg);
  assert.equal((svg.match(/<a href=/g) ?? []).length, 1, 'only the href cell is linked');
  assert.match(svg, /<a href="\/book\?cell=r1-c1"><rect [^>]*><title>r1 × c1: 3<\/title><\/rect><\/a>/);
  const sum = embedded(svg)!;
  assert.ok(!JSON.stringify(sum).includes('href'), 'links are presentation-only');
});

test('buildHeatmapSVG: embedData:false drops the JSON summary', () => {
  const svg = buildHeatmapSVG(
    { rows: ['a'], cols: ['b'], cells: [{ row: 'a', col: 'b', value: 1 }] },
    { width: 200, embedData: false },
  );
  wellFormed(svg);
  assert.equal(embedded(svg), null);
});

test('buildHeatmapSVG: an empty spec renders without crashing (null domain, no-data desc)', () => {
  const svg = buildHeatmapSVG({ rows: [], cols: [], cells: [] }, { width: 300 });
  wellFormed(svg);
  assert.ok(!svg.includes('NaN'));
  assert.match(svg, /<desc>Heatmap: 0×0 grid; no data\.<\/desc>/);
  const sum = embedded(svg)!;
  assert.equal(sum.min, null);
  assert.equal(sum.max, null);
  assert.deepEqual(sum.cells, []);
});

test('buildHeatmapSVG: hostile labels are escaped everywhere they surface', () => {
  const svg = buildHeatmapSVG(
    { rows: ['<b>&"'], cols: ['ok'], cells: [{ row: '<b>&"', col: 'ok', value: 1, label: '<script>&"' }] },
    { width: 220, title: '<t>&"' },
  );
  wellFormed(svg);
  assert.ok(!svg.includes('<b>'), 'raw row label never emitted');
  assert.ok(!svg.includes('<script>&'), 'raw cell label never emitted');
  assert.ok(svg.includes('&lt;b&gt;&amp;&quot;'), 'row label escaped in the gutter text');
  assert.ok(svg.includes('<title>&lt;script&gt;&amp;&quot;</title>'), 'cell label escaped in the title');
  // The embedded JSON escapes every `<` so hostile text cannot close the <script> element early.
  const raw = svg.match(/data-fcharts="summary">(.*?)<\/script>/s)![1];
  assert.ok(!raw.includes('<'), 'summary JSON carries no raw <');
  const sum = embedded(svg)!;
  assert.deepEqual(sum.rows, ['<b>&"'], 'round-trips back to the original label');
});
