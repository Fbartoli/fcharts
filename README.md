# fcharts

**Charts that render 100k+ points at 60fps *and* pass the accessibility audit — at the same time.**

Every fast JS chart library throws away accessibility (canvas/WebGL with no keyboard nav,
no screen-reader output, no find-in-page). Every accessible one (SVG/DOM-per-point) falls
over at scale. fcharts is a validation MVP built to prove you can have both: a
**min/max downsample renderer** on `<canvas>` (frame cost ≈ O(viewport width),
independent of point count) plus a **real-DOM accessibility layer** overlaid on top.

- **Zero runtime dependencies.** ~21 KB min+gzip for the canvas core (tree-shaken);
  ~39 KB with every SVG primitive, locale pack, and integration helper included.
- **Fast.** A precomputed min/max pyramid keeps per-frame cost flat from 10k to 250k+ points.
- **Accessible by default — not a flag.** Keyboard-navigable data cursor with `aria-live`
  announcements, real-text axis ticks, an accessible legend, and a hidden data `<table>`
  alternative. All find-in-page-able and translatable.
- **Works today, no browser flags.** HTML-in-Canvas is feature-detected and used if present;
  otherwise the DOM-overlay path runs in stock Chrome/Firefox/Safari.

> This is a **validation MVP**, not a product. See [`FINDINGS.md`](./FINDINGS.md) for the
> benchmark numbers and an honest verdict on the thesis.

## Install

```sh
npm install fcharts-js       # ESM, for bundlers (Vite, webpack, esbuild…)
```

```html
<!-- Zero build: drop in the UMD bundle (global namespace `fcharts`) -->
<script src="https://unpkg.com/fcharts-js/dist/fcharts.umd.cjs"></script>
<script>const { FChart } = window.fcharts;</script>
```

Evaluating without publishing? Build a local, installable tarball: `pnpm pack:sdk` →
`fcharts-js-0.1.0.tgz`, then `npm install ./fcharts-js-0.1.0.tgz`. Or open
[`examples/quickstart.html`](./examples/quickstart.html) directly (no server, no build).

## Quickstart

```ts
import { FChart } from 'fcharts-js';

const el = document.getElementById('chart')!; // a sized container

const chart = new FChart(el, {
  series: [
    { name: 'Pressure', color: '#16a34a' },
    { name: 'Temperature', color: '#d97706', type: 'area' },
    { name: 'Vibration', color: '#0ea5e9' },
  ],
  options: { ariaLabel: 'Sensor telemetry', xLabel: 'sample', yLabel: 'value' },
});

// x is shared and non-decreasing; one y array per series, all the same length as x.
const N = 100_000;
const x = Float64Array.from({ length: N }, (_, i) => i);
const pressure = Float64Array.from(x, (i) => 40 + Math.sin(i * 9e-4) * 26);
const temperature = Float64Array.from(x, (i) => 5 + Math.sin(i * 2.1e-3) * 18);
const vibration = Float64Array.from(x, (i) => -32 + Math.sin(i * 4e-3) * 22);
chart.setData({ x, y: [pressure, temperature, vibration] });
```

### Sizing

The container just needs a size (e.g. `#chart { width: 100%; height: 420px }`). Styles are
injected automatically — no CSS import required.

The chart fills its container (`.fc-root` is `height: 100%`), so **`height: 100%` needs a
definite-height ancestor** — inside an auto-height parent it resolves to `0` and nothing renders
(the chart warns once in the console when it measures a zero height). Two pitfalls: a `height:100%`
mount with no fixed-height ancestor, and constructing the chart while the container is
`display:none`. The safe pattern for an indefinite container is a definite-height box the mount
fills absolutely:

```html
<figure style="position:relative; height:250px">
  <div id="chart" style="position:absolute; inset:0"></div>
</figure>
```

## Real-time / streaming

For live data, `append` adds one sample without rebuilding anything — amortized **O(1)** (only
the tail of the min/max pyramid updates), so cost stays flat as the series grows to 100k+ points.

```ts
// x must be >= the current last x (non-decreasing); one y per series.
setInterval(() => {
  lastX += 1;
  lastPrice += (Math.random() - 0.5) * 0.5;
  chart.append(lastX, [lastPrice]);
}, 100);
```

The y-domain auto-fits new highs/lows, and the view **follows the live tail** when it's already
showing it — a zoomed window slides (keeping its width), a full-history view expands. If the user
has panned back into history, the view stays put so they can keep reading the past.

> **Accessibility:** the library never auto-updates on its own, so driving `append` on a timer
> makes *auto-updating content* — give users a **Pause/Stop control** and respect
> `prefers-reduced-motion` (WCAG 2.2.2). The landing-page hero demonstrates this.

For a worked example against a real exchange feed — Hyperliquid trades aggregated into live
OHLC candles (`append` per bucket + `amendLast` for the forming one) with a volume panel,
interval switching, and range presets — open
[`examples/hyperliquid-live.html`](./examples/hyperliquid-live.html) (no server, no build).

## Interaction

| Input | Action |
| --- | --- |
| Scroll / wheel | Zoom the x-axis around the pointer |
| Drag | Pan |
| Tab to chart, then `←` `→` | Move the cursor between samples |
| `↑` `↓` | Switch series |
| `Home` / `End` | Jump to the first / last sample |
| `Shift` + arrow | Fine (single-sample) step |
| `+` / `-` | Zoom in / out (keyboard equivalent of the wheel) |
| `Esc` | Dismiss the cursor / readout (keeps focus on the chart) |
| Legend buttons | Toggle series visibility |

Every cursor move is announced through a polite live region (coalesced so holding a key
doesn't flood it). Axis ticks are real visible text — always Ctrl+F-findable — and the
hidden data table is in the accessibility tree (and find-in-page-able in Chromium).

## API

```ts
new FChart(el: HTMLElement, config: FChartConfig)

chart.setData({ x, y })          // replace data, reset the view
chart.append(x, [y0, y1, …])      // append one sample, O(1) — real-time/streaming
chart.amendLast([y0, y1, …])      // rewrite the last sample in place, O(log n) — forming candles
chart.update({ series, options }) // patch series/options in place
chart.renderSync(domain?)         // synchronous render (programmatic zoom / capture)
chart.summary()                   // structured ChartSummary (see "Agent-readable")
chart.toCSV()                     // full dataset as CSV (candles → four OHLC columns)
chart.onDomainChange(cb)          // x-domain subscription (zoom/pan); returns unsubscribe
chart.destroy()                   // remove DOM, listeners, observers
chart.renderPath                  // 'dom-overlay' | 'html-in-canvas'
chart.htmlInCanvas                // { supported, via }
```

### Agent-readable

The accessibility layer is the same substrate AI agents and crawlers read. Beyond the live
region and data table, each chart distills its data into a structured summary — exposed
three ways:

- `chart.summary()` → `ChartSummary` (per-series min/max/first/last/mean, change, trend).
- a one-line natural-language description on the focusable surface (`aria-describedby`), so
  screen readers and agents get the values and trend on focus.
- an embedded `<script type="application/json" data-fcharts>` block any DOM scraper can
  parse — where a `<canvas>` chart is an opaque bitmap.

### Config

```ts
interface SeriesConfig {
  name: string;
  color: string;
  type?: 'line' | 'area' | 'candle'; // default 'line'
  visible?: boolean;        // default true
  width?: number;           // line width px, default 1.25
  fillAlpha?: number;       // area fill, default 0.15
  upColor?: string;         // candle body, close >= open (default palette green)
  downColor?: string;       // candle body, close < open (default palette red)
}
```

A `candle` series consumes **four** y arrays — open, high, low, close — at its position in
`data.y` (`line`/`area` take one each). Up candles draw hollow, down candles filled, so
direction never relies on colour alone; past ~1 candle per 3px the series degrades to the
exact per-column high/low envelope. The cursor, live region, hidden table, and `summary()`
all speak OHLC. Stream live candles with `append` (new bucket) + `amendLast` (forming bucket)
— see the Hyperliquid example.

```ts

interface FChartOptions {
  ariaLabel?: string;
  xLabel?: string; yLabel?: string;
  legend?: boolean;         // default true
  maxDpr?: number;          // device-pixel-ratio cap, default 2
  yPadding?: number;        // y-extent padding fraction, default 0.06
  xInteger?: boolean;       // integer index ticks, default false
  xType?: 'linear' | 'time';  // 'time': x = epoch ms → calendar ticks + date labels
  yScale?: 'linear' | 'log';  // 'log': base 10, needs positive data
  exportControl?: boolean;  // visible "Download data (CSV)" button, default false
  xTickCount?: number; yTickCount?: number;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  reducedMotion?: boolean;  // auto-detected from prefers-reduced-motion
  highContrast?: boolean;   // auto-detected from prefers-contrast
  strings?: Partial<FChartStrings>;  // localize the fixed UI text (legend, keyboard help,
                                        // data summary, table caption) for non-English pages
}
```

### Theming

A handful of CSS custom properties on the container (or `:root`) cover theming:

```css
.fc-root {
  --fc-ink: #e7edf3;            /* DOM text */
  --fc-tick-color: #7d8b99;     /* axis tick labels */
  --fc-grid: rgba(255,255,255,.07);   /* canvas grid lines */
  --fc-axis: rgba(255,255,255,.14);   /* canvas axis/border */
  --fc-cursor: rgba(255,255,255,.4);  /* canvas crosshair */
  --fc-focus: #6ee7a8;          /* keyboard focus ring */
}
```

## Adapters & integrations

Everything below is a thin layer over the same imperative class — one engine, one a11y layer.

- **React / Vue / Svelte** — `fcharts-js/react` and `fcharts-js/vue` export a declarative
  `<FChart>` component; `fcharts-js/svelte` exports a dependency-free action
  (`<div use:fchart={{ series, data }} />`). Same contract everywhere: identity-changed props
  forward via `update()`, a change to a construction-fixed option remounts cleanly. React/Vue
  are optional peer deps on separate entries — the core never pulls a framework in.
- **Web component** — `defineFChart()` registers `<f-chart>` (light DOM, so the a11y layer
  stays in the page's accessibility tree); configure via the element's `config` property.
- **SSR + hydration** — render on the server with `renderSVG(config, data, { width, height })`
  (pure, Node-safe; donut/scatter/sparkline/bars/progress/heatmap builders included), then
  upgrade in place with `hydrate(container, config)` — synchronous, no layout shift; the static
  SVG is real, agent-readable content before any JS runs.
- **Linked panes** — `syncCharts([price, volume])` shares the x-window across charts (zoom/pan
  any pane, the others follow); built on the public `chart.onDomainChange()`.
- **Time & log axes** — `xType: 'time'` puts ticks on calendar boundaries with adaptive date
  labels; `yScale: 'log'` gives decade ticks (positive data).
- **Localized UI strings** — complete `stringsDE`/`stringsFR`/`stringsES` packs for
  `options.strings` (the a11y layer's fixed prose; WCAG 3.1.2).
- **`fcharts-render` CLI** — `fcharts-render spec.json > chart.svg` (or stdin): charts from
  shells, report pipelines, and agents with no browser and no code.

## Accessibility & the Compliance Pack

The MIT renderer is accessible by construction. The **Compliance Pack** is the paid layer on top —
the *proof*, kept current automatically. (Both live in this repo; the Pack is a separate entry,
`src/compliance/`, never bundled into the core chart.)

- **A per-criterion WCAG 2.2 AA evidence map** for the chart layer, adversarially verified, with
  `file:line` evidence: **33 Supports / 2 Partially Supports / 20 Not Applicable** across the 55
  Level A + AA success criteria. The honest 2 partials are inherently integrator-dependent (1.4.3
  text on the host background, 2.4.11 focus not obscured by host UI). See [`compliance/scope-and-evidence-map.md`](./compliance/scope-and-evidence-map.md).
- **An auto-generated VPAT/ACR** (Accessibility Conformance Report) — EN 301 549 (EU/EAA), WCAG,
  and Section 508 editions, as Markdown + HTML + JSON, from one dependency-free generator. Sample:
  [`compliance/samples/`](./compliance/samples/). Editions, the functional-performance derivation,
  and the DRAFT/attestation model are in [`compliance/vpat-editions.md`](./compliance/vpat-editions.md).
- **A CI accessibility gate** (`fcharts-audit`) that runs the conformance engine against your
  real configured chart on every commit and **fails the build on any regression** below the
  baseline — the thing a whole-site scanner does badly: prove a complex interactive component stays
  per-point accessible. See [`compliance/conformance-test-plan.md`](./compliance/conformance-test-plan.md)
  and [`compliance/ci-gate.md`](./compliance/ci-gate.md).
- **Audit a chart you don't own**: `npx fcharts-audit --target https://your.app/dashboard
  --selector '#chart'` points the same functional checks (keyboard, live region, contrast,
  target size) at any existing chart — Highcharts, ECharts, a bare canvas — and reports exactly
  which ones fail. Report-only, no baseline needed.
- **Real screen-reader testing in CI**: `pnpm test:at` drives actual **VoiceOver** over a live
  chart (via guidepup) and asserts on the spoken phrases — focus announcement, per-sample
  arrow-key announcements, legend state. Runs weekly + on main in
  [`.github/workflows/at.yml`](./.github/workflows/at.yml) (macOS runner); skips cleanly on
  machines without VoiceOver automation permission.

> Why a gate and not just a scan? The benchmark's own finding (see [`FINDINGS.md`](./FINDINGS.md)):
> a bare inaccessible `<canvas>` scores **0 axe violations** too. Real conformance needs functional
> checks — keyboard, live region, focus, computed contrast, target size — which is what the engine
> runs.

### Worked CI example

Point the gate at a fixture that builds your real chart (`export mountChart(el) => teardown`):

```yaml
# .github/workflows/a11y-gate.yml
name: a11y gate
on: [pull_request, push]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium   # dev/peer dep, CI-only
      - run: npx fcharts-audit --fixture ./a11y/fixture.ts --edition en301549 --out ./compliance-out
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: accessibility-conformance-report, path: ./compliance-out }
```

This repo dogfoods its own gate in [`.github/workflows/a11y-gate.yml`](./.github/workflows/a11y-gate.yml)
(invoking `node src/compliance/cli.ts` directly). Run it locally with `pnpm a11y-audit`.

## Architecture

```
src/
  core/        scales · ticks · downsample (min/max pyramid) · scheduler · model
  a11y/        cursor · live-region · legend · table-alt · ticks · summary · strings · styles
  renderers/   canvas2d · html-in-canvas · detect · renderer (interface)
  compliance/  WCAG baseline · conformance engine · contrast · ACR generator · fcharts-audit CLI
  fchart.ts public class — wires core + renderer + a11y
```

`core/` and `compliance/` import no rendering API; `compliance/` (the paid Pack) imports Playwright
as a dev/peer dependency only — the shipped renderer stays zero-runtime-dependency.

The `core/` modules never import a rendering API, so a WebGL backend can implement the
same `Renderer` interface later without touching the public API.

## Develop

```sh
pnpm install          # pnpm 11+ (cooldown + script-blocking for supply-chain safety)
pnpm test             # unit tests on Node's built-in test runner (no test framework dep)
pnpm test:browser     # interaction tests (keyboard/wheel/drag/streaming) in headless Chromium
pnpm test:at          # real VoiceOver assertions via guidepup (macOS; skips elsewhere)
pnpm typecheck
pnpm lint             # oxlint: correctness + suspicious + perf, zero findings allowed
pnpm check            # typecheck + lint + unit + browser tests (what CI runs)
pnpm build            # dist/fcharts.js (ESM) + .d.ts
pnpm dev              # serve the benchmark page
pnpm bench            # headless FPS + axe-core run (Chromium) → bench/results.json
node bench/harness.ts firefox   # or `webkit` — cross-browser run → results-<engine>.json
pnpm a11y-audit       # run the WCAG 2.2 AA conformance gate → ACR in ./compliance-out
pnpm size             # assert the bundle stays under 45 KB gzip
```
