/**
 * The gallery's examples — imported twice by gallery.ts: executed as a normal module, and
 * loaded as text (`?raw`) so the page displays the EXACT unminified source that ran. The
 * `// snip:` markers delimit what the page shows for each example; keep them wrapping the
 * whole `run` body so source and render can never drift.
 */
import {
  FChart,
  buildBarsSVG,
  buildDonutSVG,
  buildHeatmapSVG,
  buildProgressSVG,
  buildScatterSVG,
  buildSparklineSVG,
  renderSVG,
  darkTheme,
} from '../src/index.ts';

export interface Example {
  title: string;
  note: string;
  /** Marker id — the page slices this example's displayed source out of the raw module text. */
  snip: string;
  run: (host: HTMLElement) => void;
}

/** Deterministic walk so every visit renders the same believable series. */
function walk(seed: number, n: number, base: number, spread: number): Float64Array {
  let s = seed >>> 0;
  let v = base;
  const rand = (): number => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return Float64Array.from({ length: n }, () => (v += (rand() - 0.492) * spread));
}

export const EXAMPLES: Example[] = [
  {
    title: 'Live line + area — keyboard-navigable canvas',
    note: '5,000 points on canvas. Tab to the chart, then ← → walk samples (announced via a ' +
      'live region), ↑ ↓ switch series, +/- zoom, Home/End jump. Drag pans, wheel zooms.',
    snip: 'live-line',
    run: (host) => {
      // snip:live-line
      host.style.height = '320px';
      const n = 5000;
      const x = Float64Array.from({ length: n }, (_, i) => i);
      new FChart(host, {
        series: [
          { name: 'Price', color: '#6ee7a8', type: 'area' },
          { name: 'VWAP', color: '#38bdf8' },
        ],
        data: { x, y: [walk(7, n, 210, 0.9), walk(1301, n, 196, 0.8)] },
        options: { ariaLabel: 'Price vs VWAP', xLabel: 'tick', yLabel: 'price' },
      }).renderSync();
      // endsnip
    },
  },
  {
    title: 'Candles + event annotation',
    note: 'A candle series takes four y arrays (open, high, low, close). The annotation is ' +
      'keyboard-reachable with [ and ], and announced.',
    snip: 'candles',
    run: (host) => {
      // snip:candles
      host.style.height = '300px';
      const n = 180;
      const x = Float64Array.from({ length: n }, (_, i) => i);
      const close = walk(42, n, 120, 1.6);
      const open = Float64Array.from(close, (c, i) => (i === 0 ? c : close[i - 1]));
      const high = Float64Array.from(close, (c, i) => Math.max(c, open[i]) + 0.8);
      const low = Float64Array.from(close, (c, i) => Math.min(c, open[i]) - 0.8);
      new FChart(host, {
        series: [{ name: 'Session', color: '#6ee7a8', type: 'candle' }],
        data: { x, y: [open, high, low, close] },
        options: { ariaLabel: 'Session candles', xLabel: 'bar', yLabel: 'price' },
        annotations: [{ x: 120, label: 'Halt lifted', kind: 'rule' }],
      }).renderSync();
      // endsnip
    },
  },
  {
    title: 'Server-side SVG — same chart, no browser',
    note: 'renderSVG is pure and Node-safe: this exact call runs in SSR, the render CLI, or ' +
      'right here. The SVG embeds a machine-readable summary and hydrates into the live chart.',
    snip: 'render-svg',
    run: (host) => {
      // snip:render-svg
      const n = 240;
      const x = Float64Array.from({ length: n }, (_, i) => i);
      host.innerHTML = renderSVG(
        {
          series: [{ name: 'Throughput', color: '#38bdf8', type: 'area' }],
          options: { ariaLabel: 'Throughput', xLabel: 'minute', yLabel: 'req/s' },
        },
        { x, y: [walk(9, n, 840, 14)] },
        { width: 680, height: 260, theme: darkTheme },
      );
      // endsnip
    },
  },
  {
    title: 'Donut with drill-down legend',
    note: 'Slices and legend rows are real links when href is set — focusable, announced, ' +
      'and the summary sentence is embedded for agents.',
    snip: 'donut',
    run: (host) => {
      // snip:donut
      host.innerHTML = buildDonutSVG(
        {
          slices: [
            { label: 'Equities', value: 46 },
            { label: 'Bonds', value: 31 },
            { label: 'Commodities', value: 14 },
            { label: 'Cash', value: 9 },
          ],
        },
        { size: 190, title: 'Allocation', centerLabel: '4', theme: darkTheme },
      );
      // endsnip
    },
  },
  {
    title: 'Horizontal bars with caps',
    note: 'A limit draws the target tick and derives an ok / near / over status — encoded by ' +
      'position, color, AND the accessible label (never color alone).',
    snip: 'bars',
    run: (host) => {
      // snip:bars
      host.innerHTML = buildBarsSVG(
        {
          rows: [
            { label: 'EU desk', value: 84, limit: 100 },
            { label: 'US desk', value: 97, limit: 100 },
            { label: 'APAC desk', value: 112, limit: 100 },
          ],
        },
        { width: 560, title: 'Risk budget usage', formatValue: (v) => `${v}%`, theme: darkTheme },
      );
      // endsnip
    },
  },
  {
    title: 'Sparklines with trend + delta',
    note: 'Inline micro-trends; the accessible label carries range, current value, and ' +
      'direction. colorByTrend keeps direction readable at a glance.',
    snip: 'sparklines',
    run: (host) => {
      // snip:sparklines
      for (const [seed, label] of [[3, 'Latency'], [77, 'Errors'], [21, 'Sign-ups']] as const) {
        const el = document.createElement('div');
        el.style.marginBottom = '8px';
        el.innerHTML = buildSparklineSVG([...walk(seed, 40, 50, 3)], {
          width: 220,
          height: 36,
          colorByTrend: true,
          showDelta: true,
          label,
          theme: darkTheme,
        });
        host.append(el);
      }
      // endsnip
    },
  },
  {
    title: 'Progress / gauge bars',
    note: 'The thin KPI bar: value, max, and an optional cap tick, all in the accessible name.',
    snip: 'progress',
    run: (host) => {
      // snip:progress
      for (const [value, label] of [[64, 'Storage'], [91, 'Rate limit'], [38, 'Budget']] as const) {
        const el = document.createElement('div');
        el.style.marginBottom = '14px';
        el.innerHTML = buildProgressSVG(value, { width: 420, limit: 90, label, theme: darkTheme });
        host.append(el);
      }
      // endsnip
    },
  },
  {
    title: 'Dot-strip scatter with reference line',
    note: 'Numeric x on categorical rows — deploy durations, latencies per service, reviews ' +
      'per repo. Points carry per-dot accessible labels.',
    snip: 'scatter',
    run: (host) => {
      // snip:scatter
      host.innerHTML = buildScatterSVG(
        {
          rows: ['api', 'web', 'worker'],
          points: [
            { row: 'api', x: 42, label: 'api deploy 42s' },
            { row: 'api', x: 58, label: 'api deploy 58s' },
            { row: 'web', x: 31, label: 'web deploy 31s' },
            { row: 'web', x: 95, label: 'web deploy 95s', status: 'over' },
            { row: 'worker', x: 47, label: 'worker deploy 47s' },
          ],
          refLines: [{ x: 60, label: 'SLO 60s' }],
        },
        { width: 560, title: 'Deploy durations', xLabel: 'seconds', theme: darkTheme },
      );
      // endsnip
    },
  },
  {
    title: 'Matrix heatmap',
    note: 'Sequential two-stop ramp, outlined missing cells, a ramp legend, and the peak ' +
      'called out in the embedded summary.',
    snip: 'heatmap',
    run: (host) => {
      // snip:heatmap
      const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const cols = ['00', '04', '08', '12', '16', '20'];
      const cells = rows.flatMap((row, r) =>
        cols.map((col, c) => ({ row, col, value: Math.round(20 + 60 * Math.abs(Math.sin(r + c * 1.7))) })),
      );
      host.innerHTML = buildHeatmapSVG({ rows, cols, cells }, {
        width: 560,
        title: 'Alerts by hour',
        theme: darkTheme,
      });
      // endsnip
    },
  },
];
