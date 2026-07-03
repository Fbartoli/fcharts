# Show HN draft — edit voice, pick the moment, post

Owner-edited before posting; this is a starting point, not copy to paste blind. Everything
claimed here is verifiable from the repo (benchmark, CI runs, sample ACR) — keep it that way
when editing.

## Title options (pick one, ≤ 80 chars)

1. `Show HN: Fcharts – 100k-point canvas charts a screen reader can actually read`
2. `Show HN: Charts that do 60fps at 100k points and pass a real NVDA in CI (MIT)`
3. `Show HN: Fcharts – fast canvas charts with a real-DOM accessibility layer`

URL: the GitHub repo (HN convention for Show HN of an OSS library).

## Body

Every fast JS charting library throws accessibility away: canvas/WebGL pixels with no
keyboard path, nothing for a screen reader, nothing find-in-page can reach. The accessible
ones render a DOM node per point and fall over at market-data scale. I wanted to know if
that trade-off is fundamental. It isn't.

fcharts renders to canvas through a min/max downsample pyramid (per-frame cost scales with
viewport width, not point count — 100k points ≈ 0.07 ms/frame in the committed benchmark),
and overlays a real-DOM accessibility layer: a keyboard data cursor announced through a
live region, real-text axis ticks, an accessible legend, and a hidden data table. So the
same chart does 60fps pan/zoom AND arrow-key navigation with spoken values, Ctrl+F over
tick labels and data, and per-point screen-reader output. Zero runtime dependencies,
~21 KB gzip core, MIT.

Two things I learned building it that might interest HN:

- A bare, completely inaccessible `<canvas>` scores **zero axe-core violations** — the
  standard scanner literally cannot see the problem. So the repo ships a functional audit
  CLI instead (keyboard, live region, contrast, target size), and you can point it at any
  chart on any page: `npx -p fcharts-js -p playwright fcharts-audit --target <url>
  --selector '#chart'`.
- "Screen-reader accessible" claims are usually ARIA-attribute claims. CI here drives a
  real NVDA on a Windows runner and asserts on the phrases it actually speaks (name,
  values as you arrow through, legend state) — green on every push. The VoiceOver sibling
  suite exists but Apple's CI images still can't capture speech.

Honest scope: it's a validation MVP — line/area/candle time series plus server-safe SVG
primitives (donut, scatter, sparkline, heatmap), React/Vue/Svelte adapters, a web
component, SSR hydration. No WebGL, no stacked bars, browser-only. The benchmark
methodology and an honest verdict on the thesis are in FINDINGS.md.

If your team has hit the "the price chart is the failing line item in the audit" problem,
I'd genuinely like to hear how you handled it.

## Post-submit notes

- First comment: link the playground, the sample chart-layer ACR, and the NVDA workflow
  run — the receipts, before anyone asks.
- Best windows historically: Tue–Thu, 8–10am ET. Stay at the keyboard for the first two
  hours; answer everything, especially the skeptical benchmark questions (FINDINGS.md has
  the honest caveats — use them).
- Do NOT lead with EAA fines or compliance fear — HN reacts badly; the procurement-gate
  angle can live in comments if asked "who pays for this".
