# Accessibility backlog

The renderer's honest partials (from `compliance/scope-and-evidence-map.md` §11) plus the
non-visual techniques the EU data-visualisation guide names
(<https://data.europa.eu/apps/data-visualisation-guide/accessibility-in-highcharts>). Baseline
today: 28 Supports / 7 Partially / 20 N/A across WCAG 2.2 A/AA.

> Build-on-demand (P2) unless a converting partner needs it — **except SR testing (P0)**, which
> is the gate to legitimately claim "blind-friendly".
>
> **Status (2026-06-17):** every R-item below (R4–R12, sonification, SVG export) is **✅ done** —
> implemented in code and re-proven in `compliance/scope-and-evidence-map.md` (§"Library-closable
> — all done"). SR testing is **⚠ partial**: the automated structural pass is done; the real-AT
> validation remains human-gated.

---

## <a id="sr-testing"></a>Real screen-reader testing + blind-user validation — **P0** — ⚠ PARTIAL

We are blind-friendly *by design* (keyboard cursor + live announcements + full data table +
programmatic current value via R11 + agent-readable JSON). `compliance/scope-and-evidence-map.md`
flags real-AT confirmation as manual-attestation on 1.1.1, 4.1.2, 4.1.3.

- [x] **Automated structural SR-readiness pass** — `test/browser/fchart.browser.test.ts` asserts
      the SR-relevant DOM/ARIA (role=application, roledescription, keyboard-help in the accessible
      name, `aria-details`→table, `aria-describedby`→summary+active-sample, the polite live region
      inside the application subtree, the data table's caption + headers, the embedded agent JSON)
      **and** the keyboard→announce loop (focus populates the queryable value; ArrowRight moves it;
      Escape clears it). This is the regression guard, not a substitute for real AT.
- [ ] **(human-gated)** Run NVDA + JAWS (Windows) and VoiceOver (macOS/iOS) against the playground
      + a real chart; confirm announcements, `aria-details` reachability, live-region speech from
      inside the application subtree, and the `role="application"` browse-mode hand-off.
- [ ] **(human-gated)** Ideally a session with an actual blind/SR user.

**Acceptance:** a signed attestation in the ACR (`--attest`) backed by real-AT evidence; the
`manual-attestation` rows for 1.1.1/4.1.2/4.1.3 become confirmed. **Then** "blind-friendly" is a
defensible claim. Remaining effort: S–M (needs real AT + ideally a user) — not codeable by an agent.

## <a id="r5"></a>R5 — Per-series dash/marker channel (double encoding) — **P1** — ✅ DONE

Closes **1.4.1 Use of Color** (canvas series are color-only today) and ticks the EU guide's
**"double encoding … different fill and dot patterns"** box — a compliance-buyer checklist item.

- [x] Optional per-series dash pattern + point-marker (`SeriesConfig.dash`/`marker`, `src/core/model.ts`).
- [x] Applied on the canvas and reflected in the legend swatch so the channel is visible there too.
- [x] 1.4.1 evidence moved Partially → Supports + check added.

Effort: M.

## <a id="r6"></a>R6 — Default contrast-checked palette + grid/axis alpha — **P1** — ✅ DONE

Tightens **1.4.3 / 1.4.11** and answers the EU guide's **"algorithmic colour & contrast"** ask
(3:1 graphical / 4.5:1 text). Today there is **no default palette** (`src/core/model.ts`) and the
grid/axis defaults are below 3:1 (`canvas2d.ts` grid 0.13 = 1.16:1, axis 0.30 = 1.41:1).

- [x] Opinionated default series palette pre-checked for ≥3:1 against the documented bg.
- [x] Default `--fc-grid`/`--fc-axis` raised to clear 3:1.
- [x] Author colors below 3:1 caught by the audit gate (reuses `src/compliance/contrast.ts`).

Effort: M.

## <a id="sonification"></a>Sonification (audio charts) — **P2** — ✅ DONE

EU-named non-visual modality ("turns data into sound"); Highcharts ships it, we have nothing. A
genuine differentiator for blind access.

- [x] Web Audio maps the focused series to pitch as the keyboard cursor steps across x, with a
      "play across" of the whole series (`src/a11y/sonify.ts`); opt-in.

Effort: M–L.

## <a id="r4"></a>R4 — Single-pointer non-dragging pan — **P2** — ✅ DONE

Closes **2.5.7 Dragging Movements** (pan is drag-only today; keyboard doesn't satisfy 2.5.7).

- [x] Single-pointer non-drag affordance: prev/next-page overlay buttons (`src/a11y/pagers.ts`)
      that translate (not zoom) the domain.

Effort: S–M.

## <a id="r7"></a>R7 — Adaptive tick thinning + rem fonts — **P2** — ✅ DONE

Closes the **1.4.4 / 1.4.10** residual (fixed-px `white-space:nowrap` ticks overlap at ~320px / high
zoom).

- [x] Tick counts thinned at narrow widths (`effectiveTickCount`, `src/a11y/ticks.ts`).
- [x] Tick/legend/readout font sizes moved px → rem so text-only zoom enlarges them.

Effort: M.

## <a id="r12"></a>R12 — forced-colors canvas remap (Windows HCM) — **P2** — ✅ DONE

The canvas bitmap doesn't participate in forced-colors, so series/grid aren't remapped to system
colors (`forced-colors` is Partially Supports; the DOM overlay + data table already adapt).

- [x] Detects `forced-colors: active` and repaints canvas marks using system colors via a probe
      element (`src/fchart.ts` + `src/renderers/canvas2d.ts`).

Effort: M–L.

## <a id="svg-export"></a>SVG / tactile-graphic export — **P2** — ✅ DONE (see [server-SVG](./chart-types.md#server-svg))

EU guide's blind-specific item ("export an SVG … turned into a tactile graphic"). We're canvas +
DOM, so we can't emit SVG natively today.

- [x] Standalone SVG export (`renderSVG` / `buildSVG`, `src/renderers/`) — subsumes this; the
      pure-SVG string is the tactile/embossing substrate.

Effort: M. Priority: niche — only if a partner needs tactile output.
