# Bugs

Defects found by real integrations. Each has a repro and a consumer workaround so the bug is
actionable without re-deriving it.

---

## <a id="zero-height-collapse"></a>Chart silently renders at 0 height (flash-then-disappear) when the container height is indefinite — **P1** — ✅ FIXED

> **Fixed (2026-06-17):** `FChart.measure()` now warns once (with the fix) when it reads a real
> width but zero height — no more silent failure (`src/fchart.ts`). `frame()` already declines to
> paint at height <= 0, so there's no paint-then-collapse from a zero-height construction, and the
> chart renders correctly on the first non-zero `ResizeObserver` measurement. The README gained a
> "Sizing" note covering `height:100%` needing a definite-height ancestor and the
> `display:none`-at-construction pitfall, plus the position:absolute escape pattern. Regression
> test: `test/browser/fchart.browser.test.ts` ("zero-height container: warns once …"). The explicit
> `height`/`width` option escape-hatch was intentionally **not** added (speculative API surface; the
> warning + docs steer integrators to the correct CSS fix).

Found by the **Hecate Portfolio Desk** integration (server-rendered dashboard; fcharts mounted
client-side as a progressive-enhancement island over an SSR `renderSVG` fallback).

**Symptom.** `new FChart(el, …)` mounts, the canvas paints once, then collapses — the integrator's
words: *"it appears for a millisecond and then disappears."* `canvas.getBoundingClientRect()` reports
a real width but **height 0**; `canvas.width`/`height` stay at the `300×150` default (the resize path
never ran with a real height). No error, no warning.

**Repro.** A container whose height resolves to 0 at measure time:
- `<div class="chart" style="height:100%">` inside an **auto-height** parent, or
- a container toggled from `display:none` to `block` immediately before `new FChart()`.

**Root cause.** `.fc-root{…height:100%}` (`src/a11y/styles.ts:9`) is applied to the container, and
`.fc-plot{flex:1 1 auto;min-height:0}` flexes inside it. So the chart is only as tall as the
container's parent allows. If the parent is auto-height, `100%` → `0`, the plot collapses, and the
canvas paints at ~0px. Worse than never rendering: the constructor's `measure()` paints once at a
transient non-zero height, then the `ResizeObserver` re-measures to 0 and collapses it — hence the
**flash**. The consumer gets no signal about what's wrong.

**Fix options** (shipped warn + no-flash + docs; escape-hatch deliberately declined):
- [x] **Warn on zero height.** `measure()` warns once when it reads a real width but height ≤ 0
      (`src/fchart.ts:689`), pointing at the definite-height-ancestor fix.
- [x] **Don't flash.** `frame()` declines to paint at height ≤ 0 (`src/fchart.ts:728`), so a
      zero-height construction renders correctly on the first non-zero `ResizeObserver` measurement
      instead of paint-then-collapse.
- [ ] **Escape hatch.** *Intentionally not added* — an explicit `height`/`width` option is
      speculative API surface; the warning + docs steer integrators to the correct CSS fix.
- [x] **Docs.** README "Sizing" note covers `height:100%` needing a definite-height ancestor, the
      `display:none`-at-construction pitfall, and the `position:absolute` escape pattern.

**Consumer workaround** (what Hecate shipped): give the mount a guaranteed box via a definite-height
parent + absolute positioning, so its height can't collapse no matter what `.fc-root` resolves to:

```html
<figure style="position:relative;height:250px">
  <div class="fchart" style="position:absolute;inset:0"></div>
</figure>
```

Effort: ~½ day (warn + no-flash + docs).
