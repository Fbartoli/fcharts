<script setup>
import { FChart } from 'fcharts-js/vue';

// A deterministic random walk, so every load shows the same believable series.
const N = 2000;
const x = Float64Array.from({ length: N }, (_, i) => i);
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
let v = 120;
const price = Float64Array.from(x, () => (v += (rand() - 0.49) * 0.8));

const series = [{ name: 'Price', color: '#16a34a', type: 'area' }];
const data = { x, y: [price] };
const options = { ariaLabel: 'Price over time', xLabel: 'tick', yLabel: 'price' };
</script>

<template>
  <h1>fcharts × Vue</h1>
  <p>
    Tab to the chart, then use arrow keys — every value is announced to screen readers and
    shown in the readout. <kbd>+</kbd>/<kbd>-</kbd> zoom, <kbd>Home</kbd>/<kbd>End</kbd> jump.
  </p>
  <FChart :series="series" :data="data" :options="options" style="height: 360px" />
</template>
