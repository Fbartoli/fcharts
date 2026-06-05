# Accessibility backlog

The renderer's honest partials (from `compliance/scope-and-evidence-map.md` §11) plus the
non-visual techniques the EU data-visualisation guide names
(<https://data.europa.eu/apps/data-visualisation-guide/accessibility-in-highcharts>). Baseline
today: 28 Supports / 7 Partially / 20 N/A across WCAG 2.2 A/AA.

> Build-on-demand (P2) unless a converting partner needs it — **except SR testing (P0)**, which
> is the gate to legitimately claim "blind-friendly".

---

## <a id="sr-testing"></a>Real screen-reader testing + blind-user validation — **P0**

We are blind-friendly *by design* (keyboard cursor + live announcements + full data table +
programmatic current value via R11 + agent-readable JSON) but **never verified with a real
screen reader or a blind user**. `compliance/scope-and-evidence-map.md` flags this as
manual-attestation on 1.1.1, 4.1.2, 4.1.3.

- [ ] Run NVDA + JAWS (Windows) and VoiceOver (macOS/iOS) against the playground + a real chart.
- [ ] Confirm: focusing the `role="application"` surface announces the name + keyboard help;
      arrows/Home/End/±/Esc are announced; `aria-details` → data table is reachable; the polite
      live region is actually spoken from inside the application-role subtree (a known AT-dependent
      risk).
- [ ] Validate the `role="application"` keyboard trade-off doesn't strand SR users (browse-mode
      hand-off). Adjust if a major AT misbehaves.
- [ ] Add an automated structural SR-readiness pass (assert the SR-relevant DOM/ARIA + the
      keyboard→announce loop) as the precursor + regression guard.
- [ ] Ideally: a session with an actual blind/SR user.

**Acceptance:** a signed attestation in the ACR (`--attest`) backed by real-AT evidence; the
`manual-attestation` rows for 1.1.1/4.1.2/4.1.3 become confirmed. **Then** "blind-friendly" is a
defensible claim. Effort: S–M (needs real AT + ideally a user).

## <a id="r5"></a>R5 — Per-series dash/marker channel (double encoding) — **P1**

Closes **1.4.1 Use of Color** (canvas series are color-only today) and ticks the EU guide's
**"double encoding … different fill and dot patterns"** box — a compliance-buyer checklist item.

- `src/renderers/canvas2d.ts` `drawEnvelope` strokes with `s.color` only; no `setLineDash`/markers.
- [ ] Add an optional per-series dash pattern and/or point-marker (`SeriesConfig.dash`/`marker`).
- [ ] Apply on the canvas; reflect in the legend swatch so the channel is visible there too.
- [ ] Update the 1.4.1 evidence (Partially → Supports) + add a check.

Effort: M.

## <a id="r6"></a>R6 — Default contrast-checked palette + grid/axis alpha — **P1**

Tightens **1.4.3 / 1.4.11** and answers the EU guide's **"algorithmic colour & contrast"** ask
(3:1 graphical / 4.5:1 text). Today there is **no default palette** (`src/core/model.ts`) and the
grid/axis defaults are below 3:1 (`canvas2d.ts` grid 0.13 = 1.16:1, axis 0.30 = 1.41:1).

- [ ] Ship an opinionated default series palette pre-checked for ≥3:1 against the documented bg.
- [ ] Raise default `--fc-grid`/`--fc-axis` alpha (or use solid contrast-checked colors) to clear 3:1.
- [ ] Optional: a dev-time `console.warn` (or the audit gate) when author colors fall below 3:1
      — reuse `src/compliance/contrast.ts`.

Effort: M.

## <a id="sonification"></a>Sonification (audio charts) — **P2**

EU-named non-visual modality ("turns data into sound"); Highcharts ships it, we have nothing. A
genuine differentiator for blind access.

- [ ] Web Audio: map the focused series to pitch as the keyboard cursor steps across x; optional
      "play across" of the whole series. Respect `prefers-reduced-motion`/an opt-in.

Effort: M–L.

## <a id="r4"></a>R4 — Single-pointer non-dragging pan — **P2**

Closes **2.5.7 Dragging Movements** (pan is drag-only today; keyboard doesn't satisfy 2.5.7).

- `src/fchart.ts` `onPointerMove` is the only pan path.
- [ ] Add a single-pointer non-drag affordance: prev/next-page overlay buttons, or click/tap a
      plot margin to advance the window. Must translate (not zoom) the domain.

Effort: S–M.

## <a id="r7"></a>R7 — Adaptive tick thinning + rem fonts — **P2**

Closes the **1.4.4 / 1.4.10** residual (fixed-px `white-space:nowrap` ticks overlap at ~320px / high
zoom).

- [ ] Reduce `xTickCount`/`yTickCount` or rotate/thin labels at narrow widths.
- [ ] Move tick/legend/readout font sizes from px → rem so text-only zoom enlarges them.

Effort: M.

## <a id="r12"></a>R12 — forced-colors canvas remap (Windows HCM) — **P2**

The canvas bitmap doesn't participate in forced-colors, so series/grid aren't remapped to system
colors (`forced-colors` is Partially Supports; the DOM overlay + data table already adapt).

- [ ] Detect `forced-colors: active` and repaint canvas marks using system colors
      (`CanvasText`/`Canvas`/`Highlight` via a probe element), and/or lean on R5 dash patterns.

Effort: M–L.

## <a id="svg-export"></a>SVG / tactile-graphic export — **P2**

EU guide's blind-specific item ("export an SVG … turned into a tactile graphic"). We're canvas +
DOM, so we can't emit SVG natively today.

- [ ] Add an export that renders the current view as a standalone SVG (for tactile/embossing).

Effort: M. Priority: niche — only if a partner needs tactile output.
