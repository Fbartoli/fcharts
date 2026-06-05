import { FChart } from '../../src/index.ts';
import { SERIES, type Dataset } from '../dataset.ts';
import type { ChartAdapter } from '../adapter.ts';

/** The library under test. Driven via renderSync for deterministic, synchronous frames. */
export function createFChart(container: HTMLElement, data: Dataset): ChartAdapter {
  const el = document.createElement('div');
  el.className = 'bench-chart';
  container.append(el);

  const chart = new FChart(el, {
    series: SERIES.map((s) => ({ name: s.name, color: s.color })),
    data: { x: data.x, y: data.y },
    options: {
      ariaLabel: 'fcharts — sensor telemetry',
      xLabel: 'sample',
      yLabel: 'value',
      xInteger: true,
    },
  });

  return {
    id: 'fchart',
    label: 'fcharts',
    kind: 'fchart',
    el,
    draw: (d0, d1) => chart.renderSync([d0, d1]),
    nodeCount: () => el.querySelectorAll('*').length,
    destroy: () => {
      chart.destroy();
      el.remove();
    },
  };
}
