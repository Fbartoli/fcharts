# Sightline

**Charts that render 100k+ points at 60fps *and* pass the accessibility audit — at the same time.**

Every fast JS chart library throws away accessibility (canvas/WebGL with no keyboard nav,
no screen-reader output, no find-in-page). Every accessible one (SVG/DOM-per-point) falls
over at scale. Sightline is a validation MVP built to prove you can have both: a
**min/max downsample renderer** on `<canvas>` (frame cost ≈ O(viewport width),
independent of point count) plus a **real-DOM accessibility layer** overlaid on top.

- **Zero runtime dependencies.** ~10 KB min+gzip.
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
npm install sightline          # ESM, for bundlers (Vite, webpack, esbuild…)
```

```html
<!-- Zero build: drop in the UMD bundle (global namespace `Sightline`) -->
<script src="https://unpkg.com/sightline/dist/sightline.umd.cjs"></script>
<script>const { Sightline } = window.Sightline;</script>
```

Evaluating without publishing? Build a local, installable tarball: `pnpm pack:sdk` →
`sightline-0.1.0.tgz`, then `npm install ./sightline-0.1.0.tgz`. Or open
[`examples/quickstart.html`](./examples/quickstart.html) directly (no server, no build).

## Quickstart

```ts
import { Sightline } from 'sightline';

const el = document.getElementById('chart')!; // a sized container

const chart = new Sightline(el, {
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

The container just needs a size (e.g. `#chart { width: 100%; height: 420px }`). Styles are
injected automatically — no CSS import required.

## Interaction

| Input | Action |
| --- | --- |
| Scroll / wheel | Zoom the x-axis around the pointer |
| Drag | Pan |
| Tab to chart, then `←` `→` | Move the cursor between samples |
| `↑` `↓` | Switch series |
| `Home` / `End` | Jump to the first / last sample |
| `Shift` + arrow | Fine (single-sample) step |
| Legend buttons | Toggle series visibility |

Every cursor move is announced through a polite live region (coalesced so holding a key
doesn't flood it). Axis ticks are real visible text — always Ctrl+F-findable — and the
hidden data table is in the accessibility tree (and find-in-page-able in Chromium).

## API

```ts
new Sightline(el: HTMLElement, config: SightlineConfig)

chart.setData({ x, y })          // replace data, reset the view
chart.update({ series, options }) // patch series/options in place
chart.renderSync(domain?)         // synchronous render (programmatic zoom / capture)
chart.summary()                   // structured ChartSummary (see "Agent-readable")
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
- an embedded `<script type="application/json" data-sightline>` block any DOM scraper can
  parse — where a `<canvas>` chart is an opaque bitmap.

### Config

```ts
interface SeriesConfig {
  name: string;
  color: string;
  type?: 'line' | 'area';   // default 'line'
  visible?: boolean;        // default true
  width?: number;           // line width px, default 1.25
  fillAlpha?: number;       // area fill, default 0.15
}

interface SightlineOptions {
  ariaLabel?: string;
  xLabel?: string; yLabel?: string;
  legend?: boolean;         // default true
  maxDpr?: number;          // device-pixel-ratio cap, default 2
  yPadding?: number;        // y-extent padding fraction, default 0.06
  xInteger?: boolean;       // integer index ticks, default false
  xTickCount?: number; yTickCount?: number;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  reducedMotion?: boolean;  // auto-detected from prefers-reduced-motion
  highContrast?: boolean;   // auto-detected from prefers-contrast
}
```

### Theming

A handful of CSS custom properties on the container (or `:root`) cover theming:

```css
.sl-root {
  --sl-ink: #e7edf3;            /* DOM text */
  --sl-tick-color: #7d8b99;     /* axis tick labels */
  --sl-grid: rgba(255,255,255,.07);   /* canvas grid lines */
  --sl-axis: rgba(255,255,255,.14);   /* canvas axis/border */
  --sl-cursor: rgba(255,255,255,.4);  /* canvas crosshair */
  --sl-focus: #6ee7a8;          /* keyboard focus ring */
}
```

## Architecture

```
src/
  core/        scales · ticks · downsample (min/max pyramid) · scheduler · model
  a11y/        cursor · live-region · legend · table-alt · ticks · styles
  renderers/   canvas2d · html-in-canvas · detect · renderer (interface)
  sightline.ts public class — wires core + renderer + a11y
```

The `core/` modules never import a rendering API, so a WebGL backend can implement the
same `Renderer` interface later without touching the public API.

## Develop

```sh
pnpm install          # pnpm 11+ (cooldown + script-blocking for supply-chain safety)
pnpm test             # unit tests on Node's built-in test runner (no test framework dep)
pnpm typecheck
pnpm build            # dist/sightline.js (ESM) + .d.ts
pnpm dev              # serve the benchmark page
pnpm bench            # headless FPS + axe-core run (Chromium) → bench/results.json
node bench/harness.ts firefox   # or `webkit` — cross-browser run → results-<engine>.json
pnpm size             # assert the bundle stays under 30 KB gzip
```
