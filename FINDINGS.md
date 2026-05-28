# FINDINGS — Sightline validation MVP

**Thesis:** a single chart can render 100k+ points at smooth frame rates **and** be fully
accessible (keyboard-navigable, screen-reader-announced, find-in-page-able) at the same
time — something no existing JS chart library does.

## Verdict: **the thesis held.**

Sightline is the only renderer that is both fast and accessible. uPlot is fast but
inaccessible; the naive SVG chart is accessible but far too slow. The min/max pyramid kept
Sightline's per-frame cost essentially flat from 10k to 250k points, and the DOM-overlay
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

| Renderer | Sustained FPS | Frame cost (avg) | Peak JS heap | DOM nodes | axe serious | Keyboard cursor | Live region | Data text-alt | **Fast + accessible** |
|---|---|---|---|---|---|---|---|---|---|
| **Sightline** | **120** | **0.062 ms** | **14.1 MB** | 257 | **0** | ✓ | ✓ | ✓ | **✓ only one** |
| uPlot | 120 | ~0 (deferred)¹ | 130.9 MB | 35 | 0 | ✗ | ✗ | ✗ | ✗ (inaccessible) |
| Naive SVG (50k nodes) | 17 | 48.8 ms | 234.5 MB | 50,213 | 0 | ✗ | ✗ | ✓ | ✗ (too slow) |

¹ uPlot defers its redraw to `requestAnimationFrame`, so a synchronous batched timer reads
~0 ms for `setScale`; its true throughput is captured by the **sustained FPS (120)**,
which is the honest cross-renderer speed metric.

### Frame cost is decoupled from point count (the core trick)

Sightline only, same pan/zoom, average per-frame draw cost:

| Points / series | Frame cost (avg) |
|---|---|
| 10,000 | 0.062 ms |
| 100,000 | 0.072 ms |
| 250,000 | 0.070 ms |

**250k / 10k ratio: 1.14×** (target < 1.5×). A naive renderer that touches every visible
sample would be ~25× costlier at 250k than 10k; the precomputed min/max pyramid keeps it
flat because per-frame work tracks viewport width, not N.

## Acceptance criteria

| Criterion | Result |
|---|---|
| `pnpm bench` produces a results table; Sightline uniquely green on both axes | ✓ |
| Median/avg frame time < 16 ms at 100k × 3 | ✓ 0.062 ms |
| Frame time at 250k within ~1.5× of 10k | ✓ 1.14× |
| axe-core: 0 critical + 0 serious on Sightline | ✓ (uPlot's gap shown via functional checks, see caveat) |
| Keyboard: arrows traverse samples + switch series; every move announced via live region | ✓ asserted in Playwright (`liveRegionChangesOnArrow`) |
| Ctrl+F finds an axis tick label and a data value | ✓ both present as real DOM text |
| Core bundle < 30 KB min+gzip, zero runtime deps | ✓ 10.34 KB gzip, 0 deps |
| Works in Chrome, Firefox, Safari with no flags (DOM-overlay) | ◑ verified in Chromium; see caveats |

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
3. **Sightline used the *least* memory (14 MB)** despite carrying a full min/max pyramid —
   lower than uPlot (131 MB) and far below the 50k-node SVG (235 MB). uPlot's heap was
   higher than expected at this point count.
4. **uPlot is genuinely fast** (120 fps) — this is a fair, strong baseline, not a strawman.
   Its only failing is accessibility, which is exactly the gap the thesis targets.
5. **Cross-browser is verified only in Chromium in this run.** The DOM-overlay path uses
   only broadly-supported APIs (Canvas2D, `ResizeObserver`, Pointer Events, `aria-live`,
   `prefers-reduced-motion`/`-contrast`), and HTML-in-Canvas is feature-detected with the
   overlay as the default path — but Firefox and WebKit were not exercised automatically
   here. Running the harness against Playwright's `firefox` and `webkit` is the obvious
   next step to close that box.
6. **HTML-in-Canvas** was correctly detected as **unsupported** in stock Chromium, so the
   DOM-overlay path (the one under test) is what ran — confirming the library is fully fast
   and fully accessible with no flags.

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
be accessible" (the SVG proves that) — it was doing **both at once**. Sightline does:
O(viewport-width) canvas rendering for speed, a real-DOM overlay for accessibility, one
render scheduler coordinating them. The validation succeeded, with the important asterisk
that proving the accessibility half required looking past axe-core to actual keyboard and
screen-reader behavior.
