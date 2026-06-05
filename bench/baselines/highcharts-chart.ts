// Highcharts via its ESM "masters" so the boost + accessibility modules auto-register against
// the same Highcharts singleton (the bundler-friendly path; the package's `modules/*.js` files
// are UMD and don't compose cleanly under Vite).
import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/modules/boost.src.js';
// boost-canvas gives boost a 2D-canvas path when WebGL is unavailable (e.g. headless CI), so the
// comparison is fair there too — boost engages instead of silently falling back to slow SVG paths.
import 'highcharts/es-modules/masters/modules/boost-canvas.src.js';
import 'highcharts/es-modules/masters/modules/accessibility.src.js';
import { SERIES, type Dataset } from '../dataset.ts';
import type { ChartAdapter } from '../adapter.ts';

/**
 * The market-leader baseline: Highcharts with the **boost** module (WebGL/canvas), given its
 * *best fast-and-accessible* configuration — the accessibility module is enabled too.
 *
 * This is the fairest version of the "just use Highcharts" rebuttal: boost keeps the 300k points
 * off the DOM (so it's fast and the node count stays small, like Sightline), and the a11y module
 * adds an info region + keyboard chart navigation. But the per-point data still lives only in the
 * WebGL canvas: there is no DOM data table unless you add the export-data module with
 * `showTable`, which re-introduces the 100k-row DOM that makes the naive-SVG column slow. So
 * Highcharts is fast OR fully data-table-accessible — the bench's columns show which.
 */
export function createHighcharts(container: HTMLElement, data: Dataset): ChartAdapter {
  const el = document.createElement('div');
  el.className = 'bench-chart';
  container.append(el);

  const chart = Highcharts.chart(el, {
    chart: { animation: false, backgroundColor: 'transparent', spacing: [8, 8, 8, 8] },
    title: { text: undefined },
    credits: { enabled: false },
    boost: { enabled: true, seriesThreshold: 1, useGPUTranslations: true },
    accessibility: {
      enabled: true,
      description: 'Benchmark chart: three sensor series over 100,000 samples.',
    },
    legend: {
      enabled: true,
      itemStyle: { color: '#cfd8e3', fontWeight: '600' },
      itemHoverStyle: { color: '#ffffff' },
    },
    xAxis: {
      lineColor: 'rgba(255,255,255,.14)',
      tickColor: 'rgba(255,255,255,.14)',
      gridLineColor: 'rgba(255,255,255,.06)',
      labels: { style: { color: '#8b97a5' } },
    },
    yAxis: {
      gridLineColor: 'rgba(255,255,255,.06)',
      title: { text: undefined },
      labels: { style: { color: '#8b97a5' } },
    },
    plotOptions: {
      series: { animation: false, marker: { enabled: false }, boostThreshold: 1, lineWidth: 1.25 },
    },
    series: SERIES.map((s, i) => ({
      type: 'line',
      name: s.name,
      color: s.color,
      // x is uniform (0,1,2,…) so we feed y-only with pointStart/pointInterval — boost's fast path.
      pointStart: 0,
      pointInterval: 1,
      data: Array.from(data.y[i]),
    })),
  });

  return {
    id: 'highcharts',
    label: 'Highcharts + Boost',
    kind: 'fast-inaccessible',
    el,
    draw: (d0, d1) => chart.xAxis[0].setExtremes(d0, d1, true, false),
    nodeCount: () => el.querySelectorAll('*').length,
    destroy: () => {
      chart.destroy();
      el.remove();
    },
  };
}
