# Chart types & server-side SVG — backlog

Surfaced by the first real consumer: **Hecate Portfolio Desk** — a server-rendered,
zero-client-JS, dark-themed, agent-readable financial dashboard (institutional stablecoin
DeFi book). It wants charts as **pure server-side `<svg>` strings** (no canvas, no DOM,
rendered in Node) and needs chart types beyond today's line+area. This is fcharts'
"machine-readable to AI agents" thesis meeting a real SSR dashboard — a good validation
surface, not a spec to gold-plate.

**Honest sequencing (per `GTM.md`): these are all pulled by ONE consumer.** Ship the
server-side SVG path (P1) so the line+area Hecate already needs works end-to-end and proves
the SSR + agent-readable story; treat donut/scatter/sparkline/bars as **P2 build-on-demand** —
implement each only when Hecate (or the next consumer) actually wires it. Do not pre-build all
five. Every item below is **pure SVG-export** (consistent with `src/renderers/svg-export.ts`);
canvas + the a11y DOM-overlay parity only follows if an *interactive* consumer needs it.

Why Hecate doesn't just keep inline SVG: it already hand-rolls these as one-off SVG in
`packages/server/src/render.ts`. Folding them into fcharts buys the agent-readable summary +
table-alt, a contrast-checked status palette, and one tested implementation instead of five
bespoke ones — the same argument fcharts makes to every dashboard team.

---

## <a id="server-svg"></a>Server-side SVG render API + dark theme — **P1** — ✅ DONE

`buildSVG()` (`src/renderers/svg-export.ts`) is already **pure — string in, string out, no DOM**,
which is exactly what an SSR app needs. Two gaps stopped a consumer from using it (both closed):

1. It was low-level: the caller had to hand-assemble `xScale`/`yScale`, `xTicks`/`yTicks`, the
   downsample pyramids, and `ResolvedSeries`. No public "config + data → svg".
2. It hardcoded a **light** theme. Hecate is dark.

- [x] Public `renderSVG(config, data, { width, height, theme?, embedData?, margins? }): string`
      (`src/renderers/render-svg.ts`) assembles the scene (via `core/scales`, `core/ticks`,
      `core/downsample`, `core/model`) and calls `buildSVG`. Pure, runs in Node, no DOM. Fails
      fast on a candle series given the wrong y-array count.
- [x] `SvgTheme` (`bg`, `grid`, `axis`, `tick`, `label`, `series`) threaded through `buildSVG`;
      **defaults to the light values** so existing exports are byte-unchanged. `lightTheme` +
      `darkTheme` presets exported (`src/renderers/svg-theme.ts`); candle hollow bodies now fill
      with `theme.bg` instead of hardcoded white.
- [x] Agent-readable: `<desc>` one-liner via `a11y/summary` + an embedded
      `<script type="application/json" data-fcharts>{ChartSummary}</script>` (on by default, via
      `embedData`) so a static server-rendered SVG stays machine-readable with no JS.
- [x] Tests: `test/svg-charts.test.ts` + `test/svg-export.test.ts` (light back-compat, dark
      theme, summary embed, candle hollow vs theme bg).

> **Accessibility boundary (important).** A static SVG is an accessible *image*, not a
> replacement for the interactive chart's accessibility. It carries `role="img"` + `aria-label`
> + `<title>`/`<desc>` (the natural-language summary) and the machine-readable JSON, which covers
> **1.1.1** (text alternative), **1.4.1** (dash/hollow encoding, never color-only), and **1.4.11**
> (contrast-checked palette). What it inherently **cannot** provide with no JS running: keyboard
> navigation, live-region announcements, and a focusable data table. Consumers who need
> *interactive* accessibility mount the live `FChart`; the SVG path is for SSR / print / email /
> agent-readability. This is documented in the `renderSVG` JSDoc.

Unblocks: Hecate's "Capital Deployed vs Value" (line + area, 2 series, weekly) ships with **zero
client JS**. Also covers email/PDF/print embedding and **subsumes** the P2
[SVG / tactile-graphic export](./accessibility.md#svg-export) item.

## <a id="donut"></a>Donut / pie (categorical share) — **P2** — ✅ DONE

Hecate "Allocation by Protocol": share-of-NAV per protocol, a center count label, a per-slice
cap, legend with %.

- [x] `buildDonutSVG({ slices: [{ label, value, color? }] }, { size, theme?, centerLabel?,
      centerSub?, capPct?, legend?, embedData? })` (`src/renderers/donut.ts`) — pure SVG, arcs via
      `stroke-dasharray` on concentric circles.
- [x] Agent-readable: shares sorted desc + one-line summary (largest slice, headroom to cap, HHI
      concentration index) in the embedded JSON; over-cap slices flagged in summary + legend.
- [x] Canvas parity skipped (SVG is the right substrate for a donut).

Effort: done (SVG only).

## <a id="scatter"></a>Scatter / dot-strip (numeric x, categorical rows) — **P2** — ✅ DONE

Hecate "Realized APY vs Tier Minimum": one dot per position, `x = APY`, `y = tier row`
(Foundation/Core/Growth), vertical **reference lines** (UST benchmark, per-tier minimums), dot
color by status (below-benchmark / yield-compressed / ok).

- [x] `buildScatterSVG({ points: [{ x, row, status?, color?, label? }], rows, refLines? }, { width,
      theme?, xLabel?, formatX?, rowHeight?, embedData? })` (`src/renderers/scatter.ts`) — pure
      SVG; dots carry an ok/near/over status color; deterministic jitter de-stacks co-located dots;
      points for undeclared rows are dropped fail-soft.
- [x] Agent-readable: per-row counts + per-reference-line "how many points fall below it" outliers,
      surfaced in both the embedded JSON and the `<desc>`.

Effort: done (SVG only).

## <a id="sparkline"></a>Sparkline (inline micro-trend) — **P2** — ✅ DONE

Tiny line/area, optional baseline rule + delta label, **no** axes/legend chrome. Hecate KPI cards.
The full `FChart` is the wrong tool for a thumbnail; a pure-SVG micro primitive is correct.

- [x] `buildSparklineSVG(values, { width, height, color?, colorByTrend?, area?, baseline?,
      showDelta?, formatDelta?, theme?, label? }): string` (`src/renderers/sparkline.ts`) — pure
      SVG polyline, transparent background, handles single/empty values without NaN.
- [x] Reuses the exported `trendOf` helper from `a11y/summary` (up/down/flat) for the delta color
      and a minimal `role="img"` + `aria-label` stating the direction (not fully invisible to AT).

Effort: done.

## <a id="bars"></a>Horizontal bar / progress-with-target — **P2** — ✅ DONE

Hecate uses three flavors of the same primitive: allocation **breakdown bars** (value + cap/target
marker + over/near/ok status), **P&L attribution bars** (signed magnitude about zero), and a **KPI
cap bar** (value vs a cap marker). One primitive covers all three.

- [x] `buildBarsSVG({ rows: [{ label, value, limit?, status?, color? }] }, { width, theme?,
      formatValue?, signed?, rowHeight?, embedData? })` (`src/renderers/bars.ts`) — pure SVG;
      `signed` draws a zero baseline with bars extending left/right; a `limit` draws a target
      marker; status auto-derives from value-vs-limit (>=100% over, >=90% near, else ok) when not
      given.
- [x] `status` palette (`ok`/`near`/`over`) is contrast-checked, shared with scatter via
      `STATUS_COLORS` — ties into [R6](./accessibility.md#r6).
- [x] Agent-readable: rows table (value, limit, % of limit, status) + `<desc>` over-target count.

Effort: done.

---

**Net (2026-06-17):** all five shipped. The server-side SVG path + dark theme make fcharts usable
by an SSR dashboard at all and render Hecate's time-series chart with zero client JS; the four
categorical primitives are the menu Hecate (and the next consumer) pull from. Each is pure-SVG,
agent-readable, and themed — no canvas work. Exports are in `src/index.ts`.

---

## <a id="annotations"></a>Event / point annotations on the time series — **P1 (pulled by Hecate)** — ✅ DONE

Hecate's "Capital Deployed vs Value" chart marks **capital-allocation events** as dots on the NAV
line (e.g. "GSR +$2.0M") and position closures — events are half the story on a portfolio chart (a
climbing NAV without the markers hides that a jump was *new capital*, not yield).

- [x] `annotations: [{ x, label, color?, kind?: 'point' | 'rule', seriesIndex? }]` on the live chart
      (`FChartConfig`, updatable via `update()`), the React adapter prop, **and** `renderSVG`
      (`AnnotationSpec` in `src/core/model.ts`; `resolveAnnotations`/`annotationSample`). A `point`
      snaps a diamond to the nearest sample of its series (the close, for candles); a `rule` is a
      vertical dashed line.
- [x] **Accessible, not color-only:** the marker is a **diamond** (distinct from the round cursor
      dot) plus a label, so shape + text carry the meaning (1.4.1). Annotations on the focused sample
      are announced in the keyboard walk and shown in the readout (`annotationLabelsAt`), and listed
      in the agent-readable `ChartSummary.annotations` + the `<desc>` events clause (localizable
      `summaryEvents` string).
- [x] **Static parity in `renderSVG`** — markers render in the pure-SVG path (`annotationParts` in
      `svg-export.ts`), theme-aware (diamond knockout uses `theme.bg`).
- [x] Readout integration: cursoring/hovering an annotated point appends its label to the existing
      readout, not a separate layer.
- [x] Tests: `test/annotations.test.ts` (model/summary/SVG) + browser test (announced in the walk).

Effort: done (point + rule markers, a11y, SVG + canvas).

## <a id="linkable-labels"></a>Linkable labels (drill-down) on `buildDonutSVG` + `buildBarsSVG` — **P1 (pulled by Hecate)** — ✅ DONE

Surfaced 2026-06-18 migrating **all** of Hecate's View A charts onto the SVG primitives (donut,
scatter, KPI + row sparklines, P&L attribution bars — all now fcharts). Two charts could **not**
fully migrate because their labels are **drill-down filters**: clicking a donut slice ("Morpho") or a
breakdown row ("Ethereum") sets a `?protocol=`/`?chain=` query param that filters the master table.
The primitives render labels as plain `<text>`, so Hecate had to:
- keep a **hand-rolled clickable legend** beside `buildDonutSVG` (called with `legend:false`), and
- keep its **allocation breakdown bars custom** instead of `buildBarsSVG` — even though `buildBarsSVG`
  otherwise fits exactly (it already has the `limit` cap/target tick + over/near/ok status the
  breakdowns need). The *only* blocker is the non-linkable label.

- [x] Optional `href?: string` on `DonutSlice` and `BarRow` (`donut.ts`, `bars.ts`). When present, the
      node is wrapped in an `<a href="…">` via the shared `anchor()` helper (`svg-util.ts`) — pure-SVG,
      works inline, keyboard-focusable. Uses the **SVG2 plain `href`** (not `xlink:href`) so the
      standalone document needs no `xmlns:xlink` declaration; modern browsers focus/activate it
      identically. `target?` intentionally omitted (drill-down is same-page; no consumer needs it).
- [x] Donut: with `legend:true` + slices carrying `href`, both the **slice arc** and the **legend row**
      (swatch + label) become links → removes Hecate's parallel hand-rolled legend, and the arc itself
      is clickable (matches the "clicking a donut slice" affordance).
- [x] Bars: the **row label** becomes a link (the value label stays plain) → Hecate's chain / issuer /
      curator / tier / strategy breakdown bars migrate to `buildBarsSVG` (which already has the `limit`
      tick they want).
- [x] Embedded `data-fcharts` summary + `<desc>` unchanged — links are presentation only (regression-
      asserted: no `href` leaks into the JSON). `href` is attribute-escaped (`&` → `&amp;`).
- [x] Tests: `test/svg-charts.test.ts` (arc+legend linked for donut, label-only for bars, escaping,
      summary-unaffected, no-href rows stay unwrapped).

Effort: small — done. Unblocks the last two hand-rolled charts in Hecate's View A.

## <a id="progress-gauge"></a>Thin inline progress / gauge bar — **P2 (build-on-demand)** — ✅ DONE

Hecate's KPI cards have **4px-tall inline progress bars** (binding-concentration % of cap, monitoring
coverage %) with an optional cap/target tick — too lightweight for `buildBarsSVG` (a labeled,
multi-row bar *chart*). Previously a one-off CSS `<div>` bar.

- [x] `buildProgressSVG(value, { width, height?, max?, limit?, color?, theme?, label? })`
      (`src/renderers/progress.ts`) → single track + proportional fill + optional cap tick, no
      labels/legend. `max` defaults to 100 (the `% of cap` / `coverage %` case); `height` defaults to
      4px. Pure SVG, Node-safe.
- [x] **Honest fill:** true `value/max` width (no min-cap inflation) — a 0 draws nothing, a tiny value
      a tiny sliver; the fill clamps to the track on over-max while the **aria-label reports the true
      percentage** (e.g. `120%`), so an over-cap meter still announces as over. Degenerate `max<=0`
      can't divide by zero.
- [x] **Minimal a11y** like the sparkline: `role="img"` + `aria-label` + `<title>` stating the
      percentage (and `(cap N%)` when `limit` set). No embedded JSON — at 4px it's a micro-element,
      not a queryable chart. Status color is the caller's (`STATUS_COLORS.over` etc.); the primitive
      stays minimal and doesn't derive status.
- [x] Exported from `src/index.ts`; tests in `test/svg-charts.test.ts` (fill fraction, cap tick,
      over-max/zero/negative/`max=0` edges, no-JSON-embed).

Effort: tiny — done. The second consumer arrived (this repo's owner pulled it), so it's no longer a
speculative build.

## <a id="hover-readout"></a>Styled hover readout for static SVG charts (tooltip parity with `FChart`) — **P2 (pulled by Hecate — stopgap shipped in consumer)** — ✅ DONE

Surfaced 2026-06-18 giving Hecate's "Realized APY vs Tier Minimum" dot-strip an **instant, styled**
hover tooltip. The static SVG builders only emit a native `<title>` on hover (`buildScatterSVG` adds an
opt-in `hoverRadius` halo to carry it). That gives the **slow, ugly OS tooltip**: browsers delay it
~0.5s and render it as a tiny system label. The good readout — `.fc-readout`, a dark rounded DOM box
with a color swatch + mono tabular numerics, shown instantly at the cursor — lives **only** on the
interactive canvas `FChart` (`a11y/styles.ts` `.fc-readout*`; `fchart.ts` `buildReadout` /
`updateReadout`). A consumer of the *static* path can't get that feel.

So Hecate wrote it itself: ~20 lines of module-script JS + a `.hx-readout` CSS block in
`packages/server/src/render.ts` that finds each scatter hover-halo (`circle[pointer-events="all"]`
under `#apy-scatter`), reads its `<title>` + the dot's `fill`, removes the `<title>` so the native
tooltip doesn't *also* fire, and shows a `position:fixed` styled box on `pointerenter` (clamped to the
viewport, flips below for a top dot). It works and is validated in-browser — but it's exactly the
"every dashboard re-implements the same glue" anti-pattern this file's intro warns about. The next
static-SVG consumer will rewrite it. **All chart UI should come from fcharts**, so fold it back in.

**Design (validated in the Hecate stopgap):** a small opt-in **DOM helper**, not a change to the
pure-SVG builders. The builders stay string-in / string-out (no DOM); the readout is a progressive
enhancement attached client-side — the same shape `injectStyles()` / `FChart` already have, and it
mirrors how `FChart` upgrades a server-rendered fallback.

- [x] `attachReadout(root, opts?): () => void` (`src/a11y/svg-readout.ts`, exported from
      `src/index.ts`). `root` holds one or more static-SVG charts; on `pointermove` over a hit-target it
      shows a styled box at the cursor, hides on `pointerleave` (and when the move isn't over a target).
      Returns a disposer that removes the listeners + box and restores the lifted `<title>` nodes.
      No-ops safely on a detached root (no `defaultView`).
- [x] **Reuse the look, don't duplicate it.** `buildReadout` + `ReadoutEls` factored out of `fchart.ts`
      into `src/a11y/readout.ts`; both the canvas chart and `attachReadout` build the same markup and
      share the `.fc-readout*` CSS / `--fc-readout-*` vars, so the tooltips are pixel-identical.
- [x] **Hit-target contract.** `buildScatterSVG`'s `hoverRadius` halo now carries `class="fc-hit"` +
      `data-fc-swatch` and keeps its `<title>` (no-JS fallback). The helper reads the label from the
      target's `<title>` (lifted to `data-fc-label`) and the swatch from `data-fc-swatch` (preferred) or
      the sibling dot's `fill`. `attachReadout` is selector-driven (`.fc-hit`, overridable), not
      scatter-specific, so donut slices / bar rows can opt in later by emitting the same hook.
- [x] **Suppress the double tooltip.** On attach each target's `<title>` text is lifted into
      `data-fc-label` and the `<title>` node removed, so the slow native OS tooltip never also fires;
      the disposer restores it. JS-off keeps the `<title>` as the graceful fallback.
- [x] **No clipping.** Box is `position:fixed` (`.fc-readout-fixed` modifier — no centering transform),
      appended to `body`, placed above the cursor and **flipped below near the top**, then clamped into
      the viewport on both axes. The rejected pure-CSS in-SVG path is documented in the file header.
- [x] **a11y unchanged.** The box is decorative (`aria-hidden`, set by `buildReadout`); the SVG keeps
      `role="img"` + `<title>`/`<desc>` + the `data-fcharts` summary as the real text alternative.
- [x] **Tests:** `test/svg-charts.test.ts` (scatter halo carries `fc-hit` + `data-fc-swatch` + `<title>`;
      none when `hoverRadius` is unset) + `test/browser/svg-readout.browser.test.ts` (Playwright:
      `<title>` lifted on attach, hover shows the box with the right label + swatch, leaving hides it,
      disposer removes the box and restores the `<title>`).
- [x] **Migrate the consumer (replace, don't deprecate).** *Done in the Hecate repo (2026-06-18):*
      deleted the `.hx-readout` CSS + the ~25-line module-script readout block in `render.ts`; the
      fcharts import now calls `attachReadout(document.getElementById('apy-scatter'))`, and the readout
      colours moved to `:root` (`--fc-readout-*`) so the body-appended box matches the NAV chart. Net:
      −1 bespoke implementation. Verified live (themed box, swatch, no clip; `<title>` no-JS fallback
      intact).

Related consumer finding (same session, separate fix, tracked here for the theming-parity link):
Hecate themes the interactive `FChart` with `--sl-*` CSS vars (`render.ts` `.fchart{…}`), but fcharts
reads `--fc-*` (the sightline → fcharts rename). None of Hecate's `--sl-readout-bg` / `--sl-tick-color`
/ `--sl-grid` etc. are read, so the NAV chart silently runs on fcharts' defaults. Lesson for fcharts: a
token rename with no migration shim or dev-time warning silently downgrades every consumer's theme.
Worth a one-release dual-prefix read, or a `console.warn` when a legacy `--sl-*` var is detected on a
mounted root.

Effort: small-to-medium — **done** (library side). Every static-SVG consumer now gets `FChart`-quality
hover with one `attachReadout()` call; the only remaining step is Hecate deleting its hand-rolled
readout, which lives in the consumer repo. The `--sl-*`/`--fc-*` theming-parity note below is a
separate finding, deliberately **not** acted on here: fcharts reads `--fc-*` and shouldn't grow a
`--sl-*` shim (the repo's "replace, don't deprecate" rule), and a legacy-var `console.warn` would be a
deprecation aid for a *consumer's* old prefix, not fcharts' concern.

