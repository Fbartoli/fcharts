# FINDINGS — fcharts validation MVP

**Thesis:** a single chart can render 100k+ points at smooth frame rates **and** be fully
accessible (keyboard-navigable, screen-reader-announced, find-in-page-able) at the same
time — something no existing JS chart library does.

## Verdict: **the thesis held.**

fcharts is the only renderer that is both fast and accessible. uPlot is fast but
inaccessible; the naive SVG chart is accessible but far too slow. The min/max pyramid kept
fcharts's per-frame cost essentially flat from 10k to 250k points, and the DOM-overlay
accessibility layer passed every automated check while staying ~0.07 ms/frame.

> **One important caveat, stated up front:** the spec's literal success metric — "zero
> serious axe-core violations" — turned out to be **necessary but not sufficient**. All
> three renderers scored **0 serious axe violations**, including the bare-canvas uPlot.
> axe-core inspects DOM semantics; it does not (and cannot) detect that a `<canvas>` chart
> has no keyboard cursor, no live region, and no text alternative. The real accessibility
> gap was only visible through **functional checks** (keyboard data surface, `aria-live`
> announcements, data-table alternative). So the thesis is proven by the *combined*
> criteria, and "passes axe" alone would have falsely rated uPlot as accessible. That is
> itself a useful result about the limits of automated a11y testing.

## Headline results

Same 100k-point × 3-series dataset fed to all three renderers; 5-second automated
pan/zoom; measured headless in Chromium 148 on an Apple-Silicon Mac (120 Hz display).

| Renderer | Sustained FPS | Frame cost (avg) | JS heap² | DOM nodes | axe serious | Keyboard cursor | Live region | Data text-alt | **Fast + accessible** |
|---|---|---|---|---|---|---|---|---|---|
| **fcharts** | **120** | **0.065 ms** | 17.0 MB | 257 | **0** | ✓ | ✓ | ✓ | **✓ only one** |
| uPlot | 120 | ~0 (deferred)¹ | 14.8 MB | 35 | 0 | ✗ | ✗ | ✗ | ✗ (inaccessible) |
| Naive SVG (50k nodes) | 16 | 51.5 ms | 15.8 MB² | 50,213 | 0 | ✗ | ✗ | ✓ | ✗ (too slow) |

¹ uPlot defers its redraw to `requestAnimationFrame`, so a synchronous batched timer reads
~0 ms for `setScale`; its true throughput is captured by the **sustained FPS (120)**,
which is the honest cross-renderer speed metric.

² JS heap is measured **per renderer in isolation, after GC** (`--expose-gc`). The numbers
are comparable across all three and are *not* a differentiator — see caveat #3. Critically,
`usedJSHeapSize` measures only the JS heap; the SVG baseline's 50k DOM nodes live in the
browser's native memory and are **not** reflected here, so this column understates the SVG's
true footprint.

### Frame cost is decoupled from point count (the core trick)

fcharts only, same pan/zoom, average per-frame draw cost:

| Points / series | Frame cost (avg) |
|---|---|
| 10,000 | 0.067 ms |
| 100,000 | 0.087 ms |
| 250,000 | 0.082 ms |

**250k / 10k ratio: 1.23×** (target < 1.5×). A naive renderer that touches every visible
sample would be ~25× costlier at 250k than 10k; the precomputed min/max pyramid keeps it
flat because per-frame work tracks viewport width, not N. (Run-to-run the ratio sits ~1.1–1.3×.)

### Cross-browser (Chromium, Firefox, WebKit/Safari — DOM-overlay path, no flags)

The thesis held in all three engines: FChart was the only renderer that was both fast
(frame cost well under the 16 ms / 60 fps budget) and fully accessible (axe-clean + keyboard
cursor + live region + data table), with the scaling ratio under 1.5×.

| Browser | fcharts frame cost | fcharts FPS | 250k/10k | axe | kbd/live/table | Uniquely fast + accessible |
|---|---|---|---|---|---|---|
| Chromium 148 | 0.067 ms | 120 | 1.23× | 0 | ✓✓✓ | ✓ |
| Firefox | 1.96 ms | 42¹ | 1.40× | 0 | ✓✓✓ | ✓ |
| WebKit / Safari | 0.157 ms | 60 | 1.16× | 0 | ✓✓✓ | ✓ |

¹ **Sustained FPS is environment-dependent, not a renderer-speed metric.** Headless Firefox
throttles `requestAnimationFrame` to ~42 Hz, so fcharts shows 42 fps there despite a
1.96 ms frame cost (≈500 fps of headroom) — on a real Firefox with normal vsync it renders
at 60. uPlot's "118 fps" on Firefox is also misleading: it's our drive loop calling its
deferred `setScale`, not 118 real redraws. So the honest "is it smooth" criterion is **frame
cost < 16 ms** (the spec's own criterion), with FPS reported for context. Per-renderer JS
heap is omitted from this table because `performance.memory` is Chromium-only.

Each engine's raw output is committed: `bench/results.json` (Chromium),
`bench/results-firefox.json`, `bench/results-webkit.json`.

## Acceptance criteria

| Criterion | Result |
|---|---|
| `pnpm bench` produces a results table; fcharts uniquely green on both axes | ✓ |
| Median/avg frame time < 16 ms at 100k × 3 | ✓ 0.065 ms |
| Frame time at 250k within ~1.5× of 10k | ✓ 1.23× |
| axe-core: 0 critical + 0 serious on fcharts | ✓ (uPlot's gap shown via functional checks, see caveat) |
| Keyboard: arrows traverse samples + switch series; every move announced via live region | ✓ asserted in Playwright (`liveRegionChangesOnArrow`) |
| Ctrl+F finds an axis tick label and a data value | ✓ verified via real `window.find()` (Chromium); browser-dependent for clipped text |
| Core bundle < 30 KB min+gzip, zero runtime deps | ✓ 10.34 KB gzip, 0 deps |
| Works in Chrome, Firefox, Safari with no flags (DOM-overlay) | ✓ thesis held in Chromium, Firefox, and WebKit (see cross-browser table) |

## What surprised us / honest caveats

1. **axe-core can't see the gap.** See the boxed caveat above — the single most important
   finding. Automated DOM-semantics auditing rates an unlabeled-but-inaccessible canvas
   chart identically to a fully keyboard/SR-accessible one. Real accessibility validation
   needs interaction-level checks.
2. **The browser's `performance.now()` is clamped to ~100 µs.** Single-frame samples for
   the fast renderers pinned to the timer floor, which made an early run report a perfectly
   flat "1.00×" scaling ratio — a false-flat artifact. We switched the frame-cost metric to
   **batched timing** (many draws ÷ total elapsed) so it spans many ms and beats the clamp.
   The real ratio is 1.14×, not a measurement artifact.
3. **Heap is *not* a differentiator — and an earlier draft of this file got it wrong.** A
   first run reported "fcharts 14 MB, uPlot 131 MB, SVG 235 MB" and concluded fcharts
   used the least memory. That was **false by construction**: `usedJSHeapSize` is the
   *whole-process* JS heap, all three charts coexisted, and we sampled a running max in
   factory order — so the numbers only reflected measurement order, not footprint. Measuring
   each renderer **alone, after a forced GC**, the JS heaps are comparable (fcharts 17.0,
   uPlot 14.8, SVG 15.8 MB) and dominated by the shared dataset. Worse, `usedJSHeapSize`
   doesn't even capture the SVG's 50k DOM nodes (native memory), so it can't fairly compare
   memory here at all. The thesis never rested on heap; we keep the column only with these
   caveats. (This correction came out of the adversarial review — see below.)
4. **uPlot is genuinely fast** (120 fps) — this is a fair, strong baseline, not a strawman.
   Its only failing is accessibility, which is exactly the gap the thesis targets.
5. **Cross-browser verified in all three engines** (Chromium, Firefox, WebKit) — see the
   table above; the thesis held in each. Two engine quirks surfaced: (a) headless Firefox
   throttles rAF (hence fcharts's 42 fps there despite a 1.96 ms frame cost — smoothness is
   judged on frame cost, not the throttled fps); (b) uPlot threw at init in headless Firefox
   because it built an `Intl` formatter from an unset `navigator.language` (the string
   `"undefined"`, which Firefox rejects strictly and Chromium tolerates) — fixed by giving
   the test context a real `locale`. fcharts itself ran cleanly in every engine.
6. **HTML-in-Canvas** was correctly detected as **unsupported** in stock Chromium, so the
   DOM-overlay path (the one under test) is what ran — confirming the library is fully fast
   and fully accessible with no flags.
7. **Find-in-page over the hidden table is browser-dependent.** The harness now exercises
   *real* `window.find()` (not DOM presence). Chromium **does** locate the clipped
   screen-reader-only table values, so Ctrl+F finds both an axis tick and a data value
   today. But find-in-page over `clip`-hidden text is not guaranteed across engines; on a
   browser that skips it, the values remain in the accessibility tree (screen-reader
   reachable) but may not be Ctrl+F-able. The tick labels — real visible text — are findable
   everywhere.
8. **Non-uniform x needed a real fix.** The first downsampler mapped each pyramid bucket to
   its center column, which left ~half the columns empty for clustered/irregular x (e.g.
   time series with overnight gaps). The reviewer reproduced 287/600 empty columns. Fixed by
   writing each bucket across the full column span its x-range covers — gap-free for any
   monotonic x, still O(viewport-width). Covered by a new test.

## Adversarial review

After the build, an automated multi-dimension review (downsample correctness, accessibility,
type/quality standards, performance/lifecycle, benchmark validity) ran with every finding
independently verified by a skeptic agent. **11 issues were confirmed and all fixed**,
including the non-uniform-x gap (#8), the false heap claim (#3), live-region flooding under
key-repeat (now debounced), a `role="application"` discoverability gap (now linked via
`aria-details`), a missing forced-colors focus ring, a `renderSync` double-render, and a
cross-realm timer-cancel bug. The two most valuable were the heap correction and the gap fix
— both cases where the original numbers/behavior looked fine but were wrong.

## WCAG 2.2 AA conformance scope (Compliance Pack)

A full per-criterion scoping of the chart layer against all 55 WCAG 2.2 Level A + AA success
criteria — adversarially verified, with `file:line` evidence — lives in
[`compliance/scope-and-evidence-map.md`](./compliance/scope-and-evidence-map.md). It is a sharper
test of "fully accessible" than the benchmark's axe + functional checks, and it **reinforces
caveat #1 directly**: even with axe at 0 *and* the keyboard/live-region/data-table checks passing,
the criterion-level pass found **real gaps those checks don't catch** — no keyboard zoom (2.1.1),
no Escape-to-dismiss (1.4.13), a hardcoded data-table `x` column header (1.3.1/2.4.6), legend
targets under 24px (2.5.8), the focused cursor value exposed only as a transient announcement and
not a queryable property (4.1.2), and untagged/un-localizable English UI strings (3.1.2). All
eight library-closable gaps were then fixed in the MIT renderer (each verified end-to-end; axe
still 0, thesis still held). Honest baseline after remediation: **28 Supports / 7 Partially
Supports / 20 Not Applicable** — the 7 partials are integrator-dependent (host background, author
colors, host layout) or deferred renderer features, and are reported as remarks + attestation
lines rather than overclaimed. The lesson is the project's recurring one: automated a11y signals
are necessary, not sufficient.

## Profiling (Chrome DevTools / CDP)

A Playwright + CDP pass (Chromium with `--expose-gc`) profiled the hot paths. Verdict: at the
target scale there is nothing to optimize — and the allocation sample refuted an earlier
hypothesis (per-frame object churn) outright.

| Measurement | Result | Read |
|---|---|---|
| Per-frame draw cost (batched, 100k & 250k × 3) | ~0.12 ms/frame | ~130× under the 16 ms budget; flat with N |
| rAF-paced 300-frame pan/zoom @ 250k | max frame 0.50 ms, **0 long tasks** | no jank |
| Allocation sampling over 300 frames @ 250k | **~0.1 KB/frame** | negligible GC pressure — caching scales/ticks is *not* worth it (hypothesis refuted) |
| Leak: create + destroy ×100 (50k each) | +0.44 MB, **DOM-node delta 0** | GC-noise level; listeners/observers/nodes fully released |
| Leak: setData ×100 on one chart | ~0 MB | old data/pyramids collected on replace |
| `setData` one-time build (synchronous) | 100k×3 **5.4 ms** · 250k×3 **5.5 ms** · 1M×3 **31 ms** · 10M **52 ms** | ~5 ms/M points |

**The one real scaling lever:** `setData` is O(N) and synchronous (it builds the min/max
pyramid + stats once). It's negligible to ~1M total points, crosses a 16 ms frame at ~3M, and
is a ~52 ms jank at 10M. Rendering never pays this — only the initial load does. If a use case
needs multi-million-point datasets on load, move the pyramid build to a Web Worker (transfer
the typed arrays) or chunk it. Deliberately **not** built now: it's beyond the validated
100k–250k target, and the profile shows zero benefit at that scale (no render bottleneck, no
leaks, no GC pressure).

## How to reproduce

```sh
pnpm install
npx playwright install chromium
pnpm bench          # writes bench/results.json and prints the table above
pnpm dev            # open the page and run it by hand; try keyboard + Ctrl+F
```

Raw machine output is committed at [`bench/results.json`](./bench/results.json).

## Bottom line

The hard part of the thesis was never "can canvas be fast" (uPlot proves that) or "can DOM
be accessible" (the SVG proves that) — it was doing **both at once**. fcharts does:
O(viewport-width) canvas rendering for speed, a real-DOM overlay for accessibility, one
render scheduler coordinating them. The validation succeeded, with the important asterisk
that proving the accessibility half required looking past axe-core to actual keyboard and
screen-reader behavior.
