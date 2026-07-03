# fcharts examples

Two kinds: **zero-build HTML files** you can open directly, and **per-adapter starter apps**
that run in the browser via StackBlitz (or locally with `npm install && npm run dev`).

## Zero build — open the file

| File | What |
|---|---|
| [`quickstart.html`](./quickstart.html) | The README quickstart as a single file (UMD bundle, no server). |
| [`hyperliquid-live.html`](./hyperliquid-live.html) | Live OHLC candles from a real exchange feed — `append` per bucket, `amendLast` on the forming candle, volume pane, range presets. |

## Adapter starters — one click in StackBlitz

Each is a minimal, standalone Vite app showing the idiomatic integration for its framework —
same chart, same keyboard/screen-reader behavior, one engine underneath.

| Adapter | Open | Integration surface |
|---|---|---|
| React | [StackBlitz ⚡](https://stackblitz.com/github/Fbartoli/fcharts/tree/main/examples/react) | `<FChart series data options style>` from `fcharts-js/react` |
| Vue 3 | [StackBlitz ⚡](https://stackblitz.com/github/Fbartoli/fcharts/tree/main/examples/vue) | `<FChart :series :data :options>` from `fcharts-js/vue` |
| Svelte | [StackBlitz ⚡](https://stackblitz.com/github/Fbartoli/fcharts/tree/main/examples/svelte) | `<div use:fchart={config}>` from `fcharts-js/svelte` |
| Web component | [StackBlitz ⚡](https://stackblitz.com/github/Fbartoli/fcharts/tree/main/examples/web-component) | `defineFChart()` → `<f-chart>` `.config` |

Locally: `cd examples/<name> && npm install && npm run dev`.
