import { createRoot } from 'react-dom/client';
import { FChart } from 'fcharts-js/react';

// A deterministic random walk, so every load shows the same believable series.
const N = 2000;
const x = Float64Array.from({ length: N }, (_, i) => i);
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
let v = 120;
const price = Float64Array.from(x, () => (v += (rand() - 0.49) * 0.8));

createRoot(document.getElementById('root')).render(
  <FChart
    series={[{ name: 'Price', color: '#16a34a', type: 'area' }]}
    data={{ x, y: [price] }}
    options={{ ariaLabel: 'Price over time', xLabel: 'tick', yLabel: 'price' }}
    style={{ height: 360 }}
  />,
);
