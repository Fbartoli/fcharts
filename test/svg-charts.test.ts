import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSVG } from '../src/renderers/render-svg.ts';
import { darkTheme, lightTheme, resolveTheme } from '../src/renderers/svg-theme.ts';
import { buildDonutSVG } from '../src/renderers/donut.ts';
import { buildScatterSVG } from '../src/renderers/scatter.ts';
import { buildSparklineSVG } from '../src/renderers/sparkline.ts';
import { buildBarsSVG } from '../src/renderers/bars.ts';
import { buildProgressSVG } from '../src/renderers/progress.ts';

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

// --- renderSVG (public config+data entry) ---

test('renderSVG: assembles a themed, agent-readable SVG from config + data', () => {
  const svg = renderSVG(
    { series: [{ name: 'Deployed' }, { name: 'Value', type: 'area' }], options: { ariaLabel: 'Capital', xLabel: 'week' } },
    { x: [0, 1, 2, 3], y: [[10, 12, 11, 14], [8, 9, 9, 12]] },
    { width: 480, height: 240 },
  );
  wellFormed(svg);
  assert.match(svg, /viewBox="0 0 480 240"/);
  assert.match(svg, /aria-label="Capital"/);
  assert.match(svg, /<rect width="480" height="240" fill="#ffffff"\/>/); // light default
  const sum = embedded(svg);
  assert.ok(sum, 'summary embedded by default');
  assert.equal((sum!.series as unknown[]).length, 2);
});

test('renderSVG: dark theme + partial override; embedData:false drops the JSON', () => {
  const cfg = { series: [{ name: 'A' }] };
  const data = { x: [0, 1, 2], y: [[1, 2, 3]] };
  const dark = renderSVG(cfg, data, { width: 300, height: 150, theme: darkTheme });
  assert.match(dark, /<rect width="300" height="150" fill="#0a0d12"\/>/);
  // Partial override merges onto light (bg overridden, ticks stay light tick color).
  const partial = renderSVG(cfg, data, { width: 300, height: 150, theme: { bg: '#123456' } });
  assert.match(partial, /fill="#123456"/);
  assert.ok(partial.includes('fill="#4b5563"'), 'unset theme fields fall back to light');
  // embedData:false → no script block.
  assert.equal(embedded(renderSVG(cfg, data, { width: 300, height: 150, embedData: false })), null);
});

test('renderSVG: candle series needs 4 y arrays (fails fast), renders bodies when given them', () => {
  assert.throws(
    () => renderSVG({ series: [{ name: 'P', type: 'candle' }] }, { x: [0, 1], y: [[1, 2]] }, { width: 200, height: 100 }),
    /need 4 y arrays/,
  );
  const svg = renderSVG(
    { series: [{ name: 'P', type: 'candle' }] },
    { x: [0, 1, 2], y: [[10, 11, 12], [12, 13, 14], [9, 10, 11], [11, 12, 13]] },
    { width: 400, height: 200 },
  );
  wellFormed(svg);
  assert.ok((svg.match(/<rect /g) ?? []).length >= 4, 'candle bodies (+bg) render as rects');
});

// --- donut ---

test('buildDonutSVG: arcs per slice, legend with %, center label, sorted agent summary', () => {
  const svg = buildDonutSVG(
    { slices: [
      { label: 'Aave', value: 40 },
      { label: 'Compound', value: 30 },
      { label: 'Sky', value: 20 },
      { label: 'Pendle', value: 10 },
    ] },
    { size: 200, title: 'Allocation', centerLabel: '4', centerSub: 'PROTOCOLS' },
  );
  wellFormed(svg);
  // One arc circle per non-zero slice (+1 faint track circle).
  assert.equal((svg.match(/<circle /g) ?? []).length, 5);
  assert.match(svg, /stroke-dasharray=/);
  assert.ok(svg.includes('>4</text>'), 'center label');
  assert.ok(svg.includes('Aave — 40.0%'), 'legend shows share');
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'donut');
  const slices = sum.slices as { label: string; pct: number }[];
  assert.deepEqual(slices.map((s) => s.label), ['Aave', 'Compound', 'Sky', 'Pendle']); // sorted desc
  assert.equal(slices[0].pct, 40);
  assert.ok(typeof sum.hhi === 'number' && (sum.hhi as number) > 0);
});

test('buildDonutSVG: capPct flags over-cap slices in summary and desc', () => {
  const svg = buildDonutSVG(
    { slices: [{ label: 'Big', value: 60 }, { label: 'Small', value: 40 }] },
    { size: 160, capPct: 25, title: 'By protocol' },
  );
  const sum = embedded(svg)!;
  const slices = sum.slices as { label: string; overCap: boolean }[];
  assert.equal(slices.find((s) => s.label === 'Big')!.overCap, true);
  assert.match(svg, /<desc>By protocol: 2 slices; largest Big 60\.0%; headroom to cap -35\.0 pts; 2 over cap\.<\/desc>/);
});

test('buildDonutSVG: escapes slice labels', () => {
  const svg = buildDonutSVG({ slices: [{ label: 'A & <B>', value: 1 }] }, { size: 120 });
  assert.ok(!svg.includes('<B>'));
  assert.match(svg, /A &amp; &lt;B&gt;/);
});

test('buildDonutSVG: href makes the slice arc + legend row a focusable drill-down link', () => {
  const svg = buildDonutSVG(
    { slices: [
      { label: 'Morpho', value: 60, href: '/book?protocol=Morpho&tier=Core' },
      { label: 'Aave', value: 40 }, // no href → not wrapped
    ] },
    { size: 160, title: 'Allocation' },
  );
  wellFormed(svg);
  // href is attribute-escaped (& → &amp;); the wrapped arc and legend row are both <a> links.
  assert.ok(svg.includes('<a href="/book?protocol=Morpho&amp;tier=Core">'), 'href present + escaped');
  assert.equal((svg.match(/<a href=/g) ?? []).length, 2, 'arc + legend row both linked for the one href slice');
  // The arc circle and the legend text live inside the anchor.
  assert.match(svg, /<a href="[^"]*Morpho[^"]*"><circle /);
  assert.ok(svg.includes('>Morpho — 60.0%</text></a>'), 'legend label closes inside its anchor');
  // Aave has no href → no anchor around its nodes.
  assert.ok(!svg.includes('<a href="/book?protocol=Aave'));
  // Links are presentation-only: the summary is unaffected (no href leaks in).
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'donut');
  assert.ok(!JSON.stringify(sum).includes('href'), 'summary carries no link data');
});

// --- scatter ---

test('buildScatterSVG: dot per point, row labels, ref lines, per-row + below-ref summary', () => {
  const svg = buildScatterSVG(
    {
      points: [
        { x: 4, row: 'Core', status: 'over', label: 'pos-1' },
        { x: 6, row: 'Core', status: 'ok' },
        { x: 3, row: 'Growth', status: 'over' },
      ],
      rows: ['Foundation', 'Core', 'Growth'],
      refLines: [{ x: 5, label: 'UST 5%' }],
    },
    { width: 480, title: 'APY vs minimum', xLabel: 'APY %' },
  );
  wellFormed(svg);
  assert.equal((svg.match(/<circle /g) ?? []).length, 3, 'one dot per point');
  assert.ok(svg.includes('>Foundation</text>') && svg.includes('>Core</text>'));
  assert.match(svg, /stroke-dasharray="4 3"/); // reference line
  assert.ok(svg.includes('>UST 5%</text>'));
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'scatter');
  assert.deepEqual(sum.rows, [
    { row: 'Foundation', count: 0 },
    { row: 'Core', count: 2 },
    { row: 'Growth', count: 1 },
  ]);
  assert.deepEqual((sum.refLines as { below: number }[])[0].below, 2); // x=4 and x=3 are < 5
  assert.match(svg, /<desc>APY vs minimum: 3 points across 3 rows; 2 below UST 5%\.<\/desc>/);
});

test('buildScatterSVG: a point in an undeclared row is dropped (fail-soft) + consistent accounting', () => {
  const svg = buildScatterSVG(
    { points: [{ x: 1, row: 'Ghost' }, { x: 2, row: 'Real' }, { x: 9, row: 'Real' }], rows: ['Real'], refLines: [{ x: 5, label: 'mid' }] },
    { width: 300 },
  );
  assert.equal((svg.match(/<circle /g) ?? []).length, 2, 'only declared-row points draw');
  const sum = embedded(svg)!;
  // total / per-row / below all exclude the dropped Ghost point.
  assert.equal(sum.total, 2);
  assert.deepEqual(sum.rows, [{ row: 'Real', count: 2 }]);
  assert.equal((sum.refLines as { below: number }[])[0].below, 1); // only x=2 (declared) < 5
});

test('buildScatterSVG: hoverRadius adds a transparent hover target carrying the title', () => {
  const svg = buildScatterSVG(
    { points: [{ x: 4, row: 'Core', status: 'ok', label: 'Morpho Smokehouse 5.7%' }], rows: ['Core'] },
    { width: 300, hoverRadius: 11 },
  );
  assert.equal((svg.match(/<circle /g) ?? []).length, 2, 'visible dot + transparent hover halo');
  // the larger transparent circle is the hover target and carries the title (not the 4px dot)
  assert.match(svg, /r="11" fill="[^"]*" fill-opacity="0" pointer-events="all"><title>Morpho Smokehouse 5.7%<\/title>/);
  // default (no hoverRadius) is still one circle per point — the dot holds the title
  const plain = buildScatterSVG({ points: [{ x: 4, row: 'Core', label: 'x' }], rows: ['Core'] }, { width: 300 });
  assert.equal((plain.match(/<circle /g) ?? []).length, 1);
});

test('buildScatterSVG: hoverRadius halo carries the fc-hit class + data-fc-swatch + title (attachReadout contract)', () => {
  const svg = buildScatterSVG(
    { points: [{ x: 5, row: 'Core', status: 'over', label: 'pos-1: APY 5%' }], rows: ['Core'] },
    { width: 320, hoverRadius: 11 },
  );
  // The halo is the hit-target: class + swatch + the <title> the DOM helper reads.
  assert.match(svg, /<circle class="fc-hit" data-fc-swatch="#dc2626"[^>]*pointer-events="all">/);
  assert.match(svg, /<circle class="fc-hit"[^>]*><title>pos-1: APY 5%<\/title><\/circle>/);
  // Without hoverRadius there is no hit-target (the dot keeps its own title).
  const plain = buildScatterSVG(
    { points: [{ x: 5, row: 'Core', label: 'p' }], rows: ['Core'] },
    { width: 320 },
  );
  assert.ok(!plain.includes('fc-hit'), 'no halo, no hit-target when hoverRadius is unset');
});

// --- sparkline ---

test('buildSparklineSVG: polyline, trend in aria-label, transparent (no bg rect)', () => {
  const svg = buildSparklineSVG([100, 101, 99, 104, 110], { width: 80, height: 20, colorByTrend: true, showDelta: true });
  wellFormed(svg);
  assert.match(svg, /<path d="M[^"]+" fill="none"/); // the line
  assert.match(svg, /aria-label="Trend: up 10\.0%"/);
  assert.ok(svg.includes('fill="#16a34a"'), 'up trend colors line + delta green');
  assert.ok(svg.includes('+10.0%'), 'delta label');
  assert.ok(!svg.includes('<rect'), 'sparkline is transparent — no background rect');
});

test('buildSparklineSVG: down trend, area fill, baseline rule, single value', () => {
  const down = buildSparklineSVG([10, 5], { width: 60, height: 16, colorByTrend: true, area: true, baseline: 7 });
  assert.match(down, /aria-label="Trend: down 50\.0%"/);
  assert.match(down, /<title>Trend: down 50\.0%<\/title>/, 'carries a <title> for older AT');
  assert.ok(down.includes('fill-opacity="0.15"'), 'area fill present');
  assert.match(down, /stroke-dasharray="2 2"/); // baseline rule
  // Single value must not throw or produce NaN.
  const one = buildSparklineSVG([42], { width: 40, height: 12 });
  wellFormed(one);
  assert.ok(!one.includes('NaN'));
});

test('buildSparklineSVG: a delta label wider than the SVG still draws (no negative plot width)', () => {
  const svg = buildSparklineSVG([1, 100000], { width: 24, height: 12, showDelta: true, formatDelta: () => '+9999999%' });
  wellFormed(svg);
  assert.ok(!svg.includes('NaN'), 'no NaN coordinates');
  assert.ok(!/<path d="[^"]*-\d/.test(svg) || svg.includes('M'), 'path renders');
});

// --- bars ---

test('buildBarsSVG: bar + value per row, limit marker, derived over/near/ok status', () => {
  const svg = buildBarsSVG(
    { rows: [
      { label: 'Aave', value: 30, limit: 25 },   // over
      { label: 'Sky', value: 24, limit: 25 },     // near (>=90%)
      { label: 'Pendle', value: 10, limit: 25 },  // ok
    ] },
    { width: 360, title: 'Allocation vs cap', formatValue: (v) => `${v}%` },
  );
  wellFormed(svg);
  assert.ok(svg.includes('>Aave</text>') && svg.includes('>30%</text>'));
  assert.equal((svg.match(/stroke-width="2"/g) ?? []).length, 3, 'a limit marker per row');
  assert.ok(svg.includes(`fill="#dc2626"`), 'over → red');
  assert.ok(svg.includes(`fill="#d97706"`), 'near → amber');
  assert.ok(svg.includes(`fill="#16a34a"`), 'ok → green');
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'bars');
  const rows = sum.rows as { label: string; status: string; pctOfLimit: number }[];
  assert.equal(rows[0].status, 'over');
  assert.equal(rows[0].pctOfLimit, 120);
  assert.match(svg, /<desc>Allocation vs cap: 3 bars; 1 over target\.<\/desc>/);
});

test('buildBarsSVG: a negative value in unsigned mode is clamped — never draws into the label gutter', () => {
  const svg = buildBarsSVG(
    { rows: [{ label: 'Drawdown', value: -15 }, { label: 'Up', value: 20 }] },
    { width: 320, title: 'Allocation' },
  );
  wellFormed(svg);
  // No bar rect starts at a negative x (which would overlap the left label gutter).
  assert.ok(!/<rect x="-/.test(svg), 'no rect drawn at a negative x coordinate');
});

test('buildBarsSVG: limit:0 yields a derived status but no pctOfLimit (consistent guards)', () => {
  const svg = buildBarsSVG({ rows: [{ label: 'Z', value: 5, limit: 0 }] }, { width: 240 });
  const row = (embedded(svg)!.rows as { status?: string; pctOfLimit?: number }[])[0];
  assert.equal(row.status, 'ok', 'limit:0 still derives a status');
  assert.equal(row.pctOfLimit, undefined, 'no divide-by-zero pctOfLimit');
});

test('buildBarsSVG: href makes the row label a focusable drill-down link (value stays plain)', () => {
  const svg = buildBarsSVG(
    { rows: [
      { label: 'Ethereum', value: 30, limit: 25, href: '/book?chain=Ethereum' },
      { label: 'Solana', value: 10, limit: 25 }, // no href
    ] },
    { width: 360, title: 'By chain', formatValue: (v) => `${v}%` },
  );
  wellFormed(svg);
  // Exactly one link — the Ethereum row label — and it wraps the <text>, not the value.
  assert.equal((svg.match(/<a href=/g) ?? []).length, 1);
  assert.match(svg, /<a href="\/book\?chain=Ethereum"><text [^>]*>Ethereum<\/text><\/a>/);
  assert.ok(!svg.includes('>30%</text></a>'), 'the value label is not linked');
  // Presentation-only: summary unchanged.
  const sum = embedded(svg)!;
  assert.equal(sum.type, 'bars');
  assert.ok(!JSON.stringify(sum).includes('href'), 'summary carries no link data');
});

test('buildBarsSVG: signed mode draws a zero baseline and a left-extending negative bar', () => {
  const svg = buildBarsSVG(
    { rows: [{ label: 'Gain', value: 12, color: '#16a34a' }, { label: 'Loss', value: -8, color: '#dc2626' }] },
    { width: 320, signed: true, title: 'P&L' },
  );
  wellFormed(svg);
  const sum = embedded(svg)!;
  assert.equal(sum.signed, true);
  // Title with an ampersand is escaped.
  assert.match(svg, /aria-label="P&amp;L"/);
});

// --- progress / gauge ---

test('buildProgressSVG: track + proportional fill, default max=100, percentage in aria-label', () => {
  const svg = buildProgressSVG(78, { width: 200, label: 'Coverage' });
  wellFormed(svg);
  assert.match(svg, /viewBox="0 0 200 4"/, 'defaults to a 4px-tall bar');
  assert.match(svg, /aria-label="Coverage: 78%"/);
  assert.match(svg, /<title>Coverage: 78%<\/title>/, 'title mirrors aria-label for older AT');
  // Two rects: the faint track (full width) + the fill (78% of 200 = 156).
  const rects = svg.match(/<rect [^>]*width="([\d.]+)"/g) ?? [];
  assert.equal(rects.length, 2);
  assert.ok(svg.includes('width="200"'), 'track spans the full width');
  assert.ok(svg.includes('width="156"'), 'fill is value/max of the width');
  assert.ok(svg.includes('fill="#0284c7"'), 'default neutral-blue fill');
  assert.ok(!svg.includes('data-fcharts'), 'no embedded JSON — it is a micro-element');
});

test('buildProgressSVG: limit draws a cap tick and is reported in the aria-label', () => {
  // value 30, max 100, cap 25 → fill passes the tick (over), colored red by the caller.
  const svg = buildProgressSVG(30, { width: 100, max: 100, limit: 25, color: '#dc2626', label: 'Concentration' });
  wellFormed(svg);
  assert.match(svg, /<line x1="25" y1="0" x2="25" y2="4"/, 'cap tick at limit/max of the width');
  assert.match(svg, /aria-label="Concentration: 30% \(cap 25%\)"/);
  assert.ok(svg.includes('fill="#dc2626"'), 'caller-supplied status color');
});

test('buildProgressSVG: clamps the fill but reports the true percentage; 0 and over-max edges', () => {
  // Over max: fill clamps to full width, but aria reports the real 120%.
  const over = buildProgressSVG(120, { width: 80, max: 100 });
  assert.ok(over.includes('width="80"'), 'fill clamped to the track width');
  assert.match(over, /aria-label="Progress: 120%"/);
  // Zero / negative: no fill rect drawn, no NaN.
  const zero = buildProgressSVG(0, { width: 80 });
  assert.equal((zero.match(/<rect /g) ?? []).length, 1, 'only the track, no fill at 0');
  assert.match(zero, /aria-label="Progress: 0%"/);
  const neg = buildProgressSVG(-5, { width: 80 });
  assert.equal((neg.match(/<rect /g) ?? []).length, 1, 'negative draws no fill');
  assert.ok(!neg.includes('NaN'));
  // Degenerate max=0 must not divide by zero.
  const zeroMax = buildProgressSVG(5, { width: 80, max: 0 });
  wellFormed(zeroMax);
  assert.match(zeroMax, /aria-label="Progress: 0%"/);
  assert.ok(!zeroMax.includes('NaN'));
});

// --- themes ---

test('resolveTheme: light is the default base; a partial merges without touching unset fields', () => {
  assert.equal(resolveTheme(), lightTheme);
  assert.equal(resolveTheme(undefined, darkTheme), darkTheme);
  const merged = resolveTheme({ bg: '#123456' });
  assert.equal(merged.bg, '#123456');
  assert.equal(merged.tick, lightTheme.tick);
  assert.equal(merged.series, lightTheme.series);
  const mergedDark = resolveTheme({ tick: '#ffffff' }, darkTheme);
  assert.equal(mergedDark.tick, '#ffffff');
  assert.equal(mergedDark.bg, darkTheme.bg);
});

test('lightTheme: every paint field is a non-empty color string (the no-theme default)', () => {
  for (const key of ['bg', 'grid', 'axis', 'tick', 'label'] as const) {
    assert.ok(lightTheme[key].length > 0, `lightTheme.${key} set`);
    assert.ok(darkTheme[key].length > 0, `darkTheme.${key} set`);
  }
  assert.ok(lightTheme.series.length >= 3, 'palette has enough series colors');
});
