/**
 * Audit fixture — the chart `fcharts-audit` builds and tests. An integrator points the gate at
 * their own real configured chart (their colors, labels, data); this is FChart's demo fixture.
 *
 * Contract: export `mountChart(el) => teardown`. The audit harness mounts it, runs the
 * conformance engine against it, and tears it down.
 */
import { FChart } from '../src/index.ts';

export function mountChart(el: HTMLElement): () => void {
  const N = 2000;
  const x = Float64Array.from({ length: N }, (_, i) => i);
  const pressure = Float64Array.from(x, (i) => 40 + Math.sin(i * 9e-4) * 26);
  const temperature = Float64Array.from(x, (i) => 5 + Math.sin(i * 2.1e-3) * 18);
  // Colors and dashes are omitted on purpose so the gate exercises FChart's defaults: the
  // contrast-checked DEFAULT_PALETTE (1.4.11) and the auto-assigned per-series dash (1.4.1).
  const chart = new FChart(el, {
    series: [{ name: 'Pressure' }, { name: 'Temperature' }],
    options: { ariaLabel: 'Sensor telemetry', xLabel: 'sample', yLabel: 'value' },
  });
  chart.setData({ x, y: [pressure, temperature] });
  return () => chart.destroy();
}
