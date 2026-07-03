<script>
  import { fchart } from 'fcharts-js/svelte';

  // A deterministic random walk, so every load shows the same believable series.
  const N = 2000;
  const x = Float64Array.from({ length: N }, (_, i) => i);
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let v = 120;
  const price = Float64Array.from(x, () => (v += (rand() - 0.49) * 0.8));

  const config = {
    series: [{ name: 'Price', color: '#16a34a', type: 'area' }],
    data: { x, y: [price] },
    options: { ariaLabel: 'Price over time', xLabel: 'tick', yLabel: 'price' },
  };
</script>

<h1>fcharts × Svelte</h1>
<p>
  Tab to the chart, then use arrow keys — every value is announced to screen readers and
  shown in the readout. <kbd>+</kbd>/<kbd>-</kbd> zoom, <kbd>Home</kbd>/<kbd>End</kbd> jump.
</p>
<div style="height: 360px" use:fchart={config}></div>
