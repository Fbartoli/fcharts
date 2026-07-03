# Show HN — final copy-paste kit

Everything below is verifiable from the repo as of 2026-07-03: `fcharts-js@0.3.0` live on npm
with provenance, NVDA green in CI, landing + playground deployed at fcharts.pages.dev.
Each fenced block is one paste target.

## Title — pick one (both ≤ 80 chars)

```text
Show HN: Fcharts – 100k-point canvas charts a screen reader can actually read
```

```text
Show HN: Charts that do 60fps at 100k points and pass a real NVDA in CI (MIT)
```

## URL field

```text
https://github.com/Fbartoli/fcharts
```

## Text field (the post body)

```text
Every fast JS charting library throws accessibility away: canvas or WebGL pixels with no keyboard path, nothing for a screen reader, nothing Ctrl+F can find. The accessible ones render a DOM node per point and fall over at market-data scale. I wanted to know whether that trade-off is fundamental. It isn't.

fcharts renders to canvas through a min/max downsample pyramid, so per-frame cost scales with viewport width, not point count — about 0.07 ms/frame at 100k points in the committed benchmark. On top of that sits a real-DOM accessibility layer: a keyboard data cursor announced through a live region, real-text axis ticks, an accessible legend, and a hidden data table. The same chart does 60fps pan/zoom AND arrow-key navigation with spoken values. Zero runtime dependencies, ~21 KB gzip core, MIT.

Two things I learned building it that might interest HN:

1. A bare, completely inaccessible canvas scores zero axe-core violations — the standard scanner literally cannot see the problem. So the repo ships a functional audit CLI instead (keyboard, live region, contrast, target size), and you can point it at any chart on any page, including ones you don't own:

    npx -p fcharts-js -p playwright fcharts-audit --target <url> --selector '#chart'

2. Most "screen-reader accessible" claims are ARIA-attribute claims. CI here drives a real NVDA on a Windows runner and asserts on the phrases it actually speaks — the chart's name, the values as you arrow through, legend toggle state — green on every push. (The VoiceOver sibling suite exists, but Apple's CI images still can't capture speech.)

Live playground: https://fcharts.pages.dev/playground.html

Honest scope: this is a validation MVP — line/area/candle time series plus server-safe SVG primitives (donut, scatter, sparkline, heatmap), React/Vue/Svelte adapters, a web component, SSR hydration. No WebGL, no stacked bars, browser-only. Benchmark methodology and an honest verdict on the thesis are in FINDINGS.md.

If your team has hit the "the price chart is the failing line item in the accessibility audit" problem, I'd genuinely like to hear how you handled it.
```

## First comment — post immediately after submitting

```text
Receipts, before anyone asks:

- NVDA spoken-phrase assertions running in CI: https://github.com/Fbartoli/fcharts/actions/workflows/at.yml
- The generated chart-layer conformance report (EN 301 549 edition): https://fcharts.pages.dev/acr-en301549.html
- One-click adapter starters (React/Vue/Svelte/web component): https://github.com/Fbartoli/fcharts/tree/main/examples
- npm package with provenance: https://www.npmjs.com/package/fcharts-js
```

## Post-submit notes (not for pasting)

- Best windows historically: Tue–Thu, 8–10am ET. Stay at the keyboard for the first two
  hours; answer everything, especially skeptical benchmark questions — FINDINGS.md has the
  honest caveats, use them verbatim.
- Do NOT lead with EAA fines or compliance fear — HN reacts badly. The procurement-gate
  angle lives in comments only if someone asks "who pays for this".
- If someone posts a chart their team can't make accessible, run the audit-any one-liner on
  it and reply with the actual failing checks — the best possible demo, live in the thread.
