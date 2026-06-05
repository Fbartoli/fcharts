import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { SERIES, type Dataset } from '../dataset.ts';
import type { ChartAdapter } from '../adapter.ts';

/**
 * The fast/inaccessible baseline: uPlot, the leading high-performance canvas chart.
 * Renders 100k points effortlessly — but its axes and data live on the canvas, so there
 * is no keyboard data cursor, no screen-reader output, and nothing to find with Ctrl+F.
 */
export function createUplot(container: HTMLElement, data: Dataset): ChartAdapter {
  const el = document.createElement('div');
  el.className = 'bench-chart';
  container.append(el);
  const rect = el.getBoundingClientRect();

  const opts: uPlot.Options = {
    width: Math.max(160, Math.round(rect.width)),
    // Reserve ~34px for uPlot's below-plot legend so it's visible inside the frame (not clipped)
    // — and so uPlot's plotting area matches fcharts', which likewise gives up top space to
    // its own legend. A fair, same-sized comparison.
    height: Math.max(120, Math.round(rect.height) - 34),
    scales: { x: { time: false } },
    legend: { show: true },
    cursor: { show: true, drag: { x: false, y: false } },
    series: [
      {},
      ...SERIES.map((s) => ({
        label: s.name,
        stroke: s.color,
        width: 1.25,
        points: { show: false },
      })),
    ],
    axes: [{}, {}],
  };

  const aligned = [data.x, ...data.y] as unknown as uPlot.AlignedData;
  const u = new uPlot(opts, aligned, el);

  return {
    id: 'uplot',
    label: 'uPlot',
    kind: 'fast-inaccessible',
    el,
    draw: (d0, d1) => u.setScale('x', { min: d0, max: d1 }),
    nodeCount: () => el.querySelectorAll('*').length,
    destroy: () => {
      u.destroy();
      el.remove();
    },
  };
}
