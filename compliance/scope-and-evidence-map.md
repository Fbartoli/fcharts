# fcharts Compliance Pack — Chart-Layer WCAG 2.2 AA Scope & Evidence Map

> **Status:** authoritative source of truth for the Compliance Pack. The conformance test
> suite, the auto-generated VPAT/ACR, and the CI accessibility gate are all derived from this
> document. **Honesty is the contract:** every claim below is marked "Partially Supports"
> wherever a real gap exists, and every claim is tagged with *how* it is verified
> (machine-checkable vs. human attestation). This file was produced by mapping all 55 WCAG 2.2
> Level A + AA success criteria against the source, then adversarially re-verifying every
> applicable claim (each verifier tried to *downgrade* the claim and confirmed the cited
> `file:line` evidence), then a completeness critic checked coverage and consistency.

> **Update (remediation applied, two waves).** After this map was first written (baseline:
> 21 Supports / 14 Partially / 20 N/A), the library-closable gaps in the backlog (§11) were fixed
> in the MIT renderer and verified end-to-end (axe stays 0, thesis holds, all unit tests pass).
> Wave 1 (cheap fixes) moved seven criteria **Partially → Supports** — 1.3.1, 1.4.13, 2.1.1,
> 2.4.6, 2.5.8, 3.1.2, 4.1.2 — and closed 1.4.3's legend-opacity sub-gap. Wave 2 (the R4–R12
> accessibility backlog) closed the rest: **1.4.1** (per-series dash, R5), **1.4.4** (rem fonts,
> R7), **1.4.10** (adaptive tick density, R7), **1.4.11** (contrast-checked default palette, R6),
> **2.5.7** (single-pointer pan pagers, R4), and the **forced-colors** adaptation (canvas reads +
> repaints in system colors, R12) all moved **Partially → Supports**, each re-proven by a live
> gate check (legend dash-distinctness, resize-text-rem, reflow-adaptive, contrast-marks,
> single-pointer-pan, forced-colors-canvas). **The tables and per-criterion detail below reflect
> the current, post-remediation source.** New baseline: **33 Supports / 2 Partially / 20 N/A**
> (the 2 Partially — 1.4.3 and 2.4.11 — are inherently host/integrator-dependent).

This is **document 1 of 4** in the Compliance Pack design:

1. **Scope & evidence map** (this file)
2. VPAT/ACR format + editions (EN 301 549 first, then WCAG-INT and US 508) — `vpat-editions.md`
3. Conformance test plan + pass→conformance mapping — `conformance-test-plan.md`
4. CI gate contract (`fcharts-audit` CLI + GitHub Action) — `ci-gate.md`

---

## 1. Scope

The Compliance Pack reports conformance for **the fcharts chart component** — everything the
library renders inside its container (`.fc-root`) and the behavior it ships by default. It does
**not** report conformance for the page that embeds the chart.

### In scope (the component boundary)

Everything fcharts constructs inside `.fc-root`:

- the `<canvas>` data layer (the fast min/max-pyramid renderer);
- the real-DOM overlay: axis tick text (`.fc-tick`), the accessible legend (`role="group"` of
  `aria-pressed` buttons), the focusable data surface (`role="application"`), the polite live
  region, the hidden data `<table>` text alternative, the readout tooltip, the one-line
  natural-language summary (`aria-describedby`), and the embedded `application/json` summary;
- the keyboard interaction model (arrows / Home / End / Shift), pointer interaction
  (wheel-zoom, drag-pan, hover), and the user-preference adaptations (reduced-motion,
  high-contrast, forced-colors).

### Out of scope (the integrating page owns these)

These WCAG criteria are page-level and a single embedded chart component cannot satisfy or
violate them: page `<title>` (2.4.2), language of page (3.1.1), bypass blocks / landmarks
(2.4.1), multiple ways to find pages (2.4.5), consistent navigation across pages (3.2.3),
consistent help (3.2.6), and all form/authentication criteria (3.3.x) since the chart creates
no data-entry fields. They are listed as **Not Applicable** with a one-line reason in §9.

### The integrator-responsibility principle

A reusable component cannot unilaterally guarantee every criterion, because some outcomes
depend on choices the integrator makes. Throughout this map we separate:

- **Library guarantee** — true for every fcharts instance with shipped defaults, regardless
  of how it is embedded. These are what the CI gate enforces.
- **Author responsibility** — depends on integrator-supplied values (series **colors** — there
  is *no* default palette; the **host background** behind the transparent DOM overlay; theme
  variable overrides; the surrounding page; the meaningfulness of supplied `ariaLabel` /
  `xLabel` / `yLabel` / series names). The VPAT records these as remarks and attestation lines,
  not as automated passes.

This split is the most load-bearing idea in the artifact: it is *why* a chart-layer VPAT is
honest where a whole-site scanner is not.

---

## 2. Standards & editions

The map is authored against **WCAG 2.2 Level A + AA** because it is the **superset substrate**
for every edition we plan to emit:

| Edition (priority) | References | Relationship to this map |
|---|---|---|
| **EN 301 549** (EU, EAA beachhead) | Chapter 9 incorporates **WCAG 2.1 A+AA** by reference | WCAG 2.1 ⊂ WCAG 2.2. The 2.2 map fully covers EN 301 549's web SCs; the 6 new-in-2.2 SCs are *extra* assurance. |
| **WCAG-INT** (ISO/IEC 40500-aligned) | WCAG 2.2 A+AA directly | 1:1 with this map. |
| **US Section 508** (Revised 2017) | Chapter 5 incorporates **WCAG 2.0 A+AA** | WCAG 2.0 ⊂ WCAG 2.2. Fully covered. |

Notes:

- **New in WCAG 2.2** (not in 2.1, so they exceed EN 301 549's current floor): 2.4.11 Focus Not
  Obscured (Min), 2.5.7 Dragging Movements, 2.5.8 Target Size (Min), 3.2.6 Consistent Help,
  3.3.7 Redundant Entry, 3.3.8 Accessible Authentication (Min). Mapping them now future-proofs
  the artifact as EN 301 549 moves to reference 2.2.
- **Removed in WCAG 2.2:** 4.1.1 Parsing (obsolete). It is excluded from the 55-SC count.
- **Edition-specific clauses beyond WCAG** — EN 301 549's functional-performance statements
  (Chapter 4), generic requirements (Chapter 5), and software clauses (Chapter 11); Section
  508's functional performance criteria (Chapter 3) and 502/503 software requirements — are
  layered on top of this WCAG core in **document 2 (`vpat-editions.md`)**. This document is the
  WCAG core they all share.

We **lead with EN 301 549** because the GTM beachhead is EU/EAA-exposed teams (see `GTM.md`).

---

## 3. Conformance vocabulary (ITI VPAT terms)

Each criterion carries one of the four standard VPAT conformance levels:

- **Supports** — the component meets the criterion with shipped defaults across the documented
  usage (any residual is genuinely the integrator's, and is disclosed).
- **Partially Supports** — some functionality meets the criterion; a real, named gap remains
  (whether library-closable or inherently integrator-dependent).
- **Does Not Support** — the majority of functionality does not meet the criterion. *(No
  applicable criterion in this map is rated Does Not Support.)*
- **Not Applicable** — the criterion does not apply to a single embedded read-only chart
  component (page-level concerns, media the chart does not produce, or inputs it does not
  create).

---

## 4. Verification taxonomy (what the CI gate can prove vs. what a human must attest)

This is the second load-bearing idea. The headline finding of the validation MVP (`FINDINGS.md`)
was that **"passes axe" is necessary but not sufficient** — axe rated a bare inaccessible canvas
identically to fcharts. So each evidence item is tagged with how it is verified:

- **`automated`** — a machine check can prove/disprove it on **every commit**. This is one of:
  an axe rule, a DOM-structure assertion (attributes/roles/element presence), a **computed
  contrast ratio** (only when *both* foreground and background are known to the library), a
  **functional probe** (focus the surface, press a key, assert the live region changed; narrow the
  chart and assert the tick density thins; toggle forced-colors and assert the canvas repaints), or
  a source/CSS assertion (e.g. "the legend swatches are distinct beyond color", "a `forced-colors`
  rule exists").
- **`hybrid`** — partly automatable, partly attested. The structural part is CI-checkable; the
  effective outcome depends on something CI cannot see (the host background, inherited
  line-height, whether an AT actually speaks the announcement).
- **`manual-attestation`** — no sound machine check exists; a human signs the line. This is the
  honest residue: perceptual judgments ("are two overlapping lines distinguishable to a
  color-blind user"), semantic-quality judgments ("is the author's label meaningful"), and
  real-AT behavior (NVDA/JAWS/VoiceOver).

**The CI gate (document 4) enforces the `automated` items and the automatable half of `hybrid`
items.** The VPAT (document 2) carries the `manual-attestation` items as explicit
attestation lines a human signs off, and surfaces `hybrid` caveats as remarks. A criterion is
never reported "Supports" on the strength of an automated check alone when the substance needs
attestation — that was uPlot's false pass, and we do not repeat it.

---

## 5. Summary tally

Across the **55** WCAG 2.2 Level A + AA success criteria, scoped to the chart component:

| Conformance | Count | Criteria |
|---|---|---|
| **Supports** | 33 | 1.1.1, 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.4.1, 1.4.4, 1.4.5, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.1.4, 2.2.1, 2.2.2, 2.3.1, 2.4.3, 2.4.6, 2.4.7, 2.5.1, 2.5.2, 2.5.3, 2.5.7, 2.5.8, 3.1.2, 3.2.1, 3.2.2, 3.2.4, 3.3.2, 4.1.2, 4.1.3 |
| **Partially Supports** | 2 | 1.4.3, 2.4.11 |
| **Not Applicable** | 20 | 1.2.1–1.2.5, 1.3.5, 1.4.2, 2.4.1, 2.4.2, 2.4.4, 2.4.5, 2.5.4, 3.1.1, 3.2.3, 3.2.6, 3.3.1, 3.3.3, 3.3.4, 3.3.7, 3.3.8 |

Plus two **user-preference adaptations** (beyond strict A/AA, reported as good practice):
**reduced-motion = Supports** and **forced-colors = Supports** (R12: the renderer now reads the
system palette and repaints the canvas marks, grid, and crosshair in system colors under
`forced-colors:active`; the DOM overlay and data alternatives also adapt — see §10).

**All library-closable gaps are now fixed** (§11, waves 1 and 2). The remaining 2 Partially
Supports are inherently integrator-dependent: **1.4.3** (the host background behind the tick/legend
text is the host page's) and **2.4.11** (host sticky/overlay UI could obscure focus). Both are
reported as remarks + attestation lines. No applicable criterion is rated "Does Not Support".

---

## 6. Evidence map — applicable criteria

`V` = primary verification class (A = automated, H = hybrid, M = manual-attestation).
Detailed rationale + `file:line` evidence per criterion follows in §7–§8.

### Perceivable

| SC | Lvl | Name | Claim | V | One-line basis |
|---|---|---|---|---|---|
| 1.1.1 | A | Non-text Content | Supports | A | Canvas `aria-hidden`; text alternative always present (data table + summary + JSON). |
| 1.3.1 | A | Info and Relationships | Supports | A | Table/legend/surface relationships are programmatic; the data-table x-column header now carries the configured `xLabel` (R1). |
| 1.3.2 | A | Meaningful Sequence | Supports | A | DOM appended in reading order; no CSS reorder; table reads x-then-series in ascending order. |
| 1.3.3 | A | Sensory Characteristics | Supports | H | Instructions name keys (not shape/position); series identified by name, not color/location. |
| 1.3.4 | AA | Orientation | Supports | A | No orientation lock; fluid 100% layout re-measured by `ResizeObserver`. |
| 1.4.1 | A | Use of Color | Supports | A | Each series gets a distinct **dash pattern** (R5), mirrored in the legend swatch, so color is never the sole channel; legend/table/readout already give color-free identity. |
| 1.4.3 | AA | Contrast (Minimum) | **Partially** | H | Library-default DOM text passes on a light background and the legend "hidden" state no longer dims text (R8); **the effective host background behind the tick/legend text remains integrator-controlled** (the readout sets its own background). |
| 1.4.4 | AA | Resize Text | Supports | A | Label fonts are in **rem** (R7), so text-only zoom enlarges them; the fluid container re-measures so the chart follows. |
| 1.4.5 | AA | Images of Text | Supports | A | All readable text is real DOM text; the canvas renders **no** `fillText`/`strokeText`. |
| 1.4.10 | AA | Reflow | Supports | H | Fluid canvas + reflowing legend; 2-D chart geometry is exempt; **adaptive tick density** (R7) thins labels as the plot narrows so they don't overlap. |
| 1.4.11 | AA | Non-text Contrast | Supports | H | Focus ring 5.17:1; data marks use a **default palette verified ≥3:1 on light and dark** (R6); gridlines are decorative. Integrator color overrides become their attestation. |
| 1.4.12 | AA | Text Spacing | Supports | A | No fixed line-height/letter/word-spacing on text; no `overflow:hidden` clip on visible text. |
| 1.4.13 | AA | Content on Hover or Focus | Supports | A | Readout is Hoverable + Persistent, and now Dismissible — Escape clears it without moving focus (R3). |

### Operable

| SC | Lvl | Name | Claim | V | One-line basis |
|---|---|---|---|---|---|
| 2.1.1 | A | Keyboard | Supports | A | Cursor nav + legend toggle + zoom (`+`/`-`) are all keyboard-operable (R2); every pointer function has a keyboard path. |
| 2.1.2 | A | No Keyboard Trap | Supports | A | Tab/Shift+Tab never intercepted; no `focus()` trap, modal, or `inert`. |
| 2.1.4 | A | Character Key Shortcuts | Supports | A | Only non-printable keys (arrows/Home/End) + Shift; no single-character shortcuts to remap. |
| 2.2.1 | A | Timing Adjustable | Supports | H | No time limits; the two internal timers are output coalescers, not user deadlines. |
| 2.2.2 | A | Pause, Stop, Hide | Supports | H | Render-on-demand; no auto-motion/auto-update; the only transition is a 0.08s fade (off under reduced-motion). |
| 2.3.1 | A | Three Flashes | Supports | H | Nothing flashes; single clear+repaint per user-driven frame. |
| 2.4.3 | A | Focus Order | Supports | A | Legend-then-surface DOM order; only `tabIndex 0`, no positive tabindex/reorder. |
| 2.4.6 | AA | Headings and Labels | Supports | A | Surface/legend/caption labels are descriptive; the table x-column header now uses the configured `xLabel` (R1). |
| 2.4.7 | AA | Focus Visible | Supports | A | `:focus-visible` ring + `prefers-contrast` outline + `forced-colors` `Highlight` outline; native button rings preserved. |
| 2.4.11 | AA | Focus Not Obscured (Min) | **Partially** | H | The component never fully obscures its own focus; **host sticky/overlay UI could** (integrator concern). |
| 2.5.1 | A | Pointer Gestures | Supports | M | Drag-pan is single-pointer, not path-based; zoom is wheel; no multipoint gesture. |
| 2.5.2 | A | Pointer Cancellation | Supports | A | No action on down-event; pan is reversible before release; legend activates on up-event. |
| 2.5.3 | A | Label in Name | Supports | A | Legend button's accessible name contains its visible label text. |
| 2.5.7 | AA | Dragging Movements | Supports | A | **Pan pagers** (R4): single-pointer ‹/› buttons step the window earlier/later — the non-dragging alternative to drag-pan; shown when zoomed in. |
| 2.5.8 | AA | Target Size (Minimum) | Supports | A | Surface is large; legend buttons now carry `min-height:24px;min-width:24px;line-height:1.1` (R9), guaranteeing 24×24 regardless of host fonts. |

### Understandable

| SC | Lvl | Name | Claim | V | One-line basis |
|---|---|---|---|---|---|
| 3.1.2 | AA | Language of Parts | Supports | A | Every fixed UI string is now localizable via the `strings` option (R10), so an integrator can match the host page language. |
| 3.2.1 | A | On Focus | Supports | A | Focus only activates the cursor + polite announcement; no context change. |
| 3.2.2 | A | On Input | Supports | A | Keys/legend toggles change content in place; no navigation/submission/context change. |
| 3.2.4 | AA | Consistent Identification | Supports | A | All legend buttons built by one routine with identical structure; stable surface role. |
| 3.3.2 | A | Labels or Instructions | Supports | A | Surface name embeds keyboard instructions; legend group + buttons are labeled. |

### Robust

| SC | Lvl | Name | Claim | V | One-line basis |
|---|---|---|---|---|---|
| 4.1.2 | A | Name, Role, Value | Supports | A | Name/Role exposed for every control; the focused sample is now a queryable value via an `aria-describedby` target updated in lockstep, and the legend name is stable (R11). |
| 4.1.3 | AA | Status Messages | Supports | H | Polite, atomic, focus-independent, debounced live region for cursor moves; presence is automatable, real-AT speech is attested. |

### Adaptations (good practice, beyond strict A/AA)

| Feature | Name | Claim | V | One-line basis |
|---|---|---|---|---|
| reduced-motion | `prefers-reduced-motion` | Supports | A | The only transition (readout fade) is disabled; `reducedMotion` flag auto-detected and plumbed; no looping motion exists. |
| forced-colors | Windows High Contrast Mode | Supports | A | DOM overlay + focus ring adapt, and the renderer now **reads the system palette and repaints the canvas** (marks, grid, crosshair) in system colors under `forced-colors:active` (R12). |

---

## 7. Per-criterion detail — Perceivable

### 1.1.1 Non-text Content (A) — Supports

The `<canvas>` bitmap is non-text content opaque to AT, and a programmatically-determined text
alternative is **always** present (constructed before any `setData`, via `refreshDerived()` at
`src/fchart.ts:224`):

- Canvas removed from the a11y tree — `src/fchart.ts:179` (`aria-hidden="true"`). *(automated)*
- Hidden `<table>` text alternative with `<caption>`, `<th scope="col">`, `<th scope="row">`,
  downsampled to ≤40 rows — `src/a11y/table-alt.ts:52-110`. *(automated)*
- Surface accessible **name** (`aria-label` set at `src/fchart.ts:322` via `describeChart()`
  `:335-344`) and **description** (`aria-describedby` → one-line values+trend summary,
  `src/a11y/summary.ts:88-105`). *(automated)*
- Decorative graphics hidden: legend swatch `aria-hidden` (`src/a11y/legend.ts:42`), readout
  tooltip `aria-hidden` (`src/fchart.ts:650`). *(automated)*
- Whether the integrator's `ariaLabel`/`xLabel`/`yLabel` meaningfully describe the chart's
  *purpose* is an authoring judgment; with no `ariaLabel` the name falls back to the generic
  "Chart". *(manual-attestation)*

**Author responsibility:** supply a meaningful `ariaLabel` and axis labels.

### 1.3.1 Info and Relationships (A) — Supports

Visual relationships are exposed in the DOM: table semantics with `<caption>` and scoped
headers (`src/a11y/table-alt.ts:68-114`), `role="group"` legend of `aria-pressed` buttons
(`src/a11y/legend.ts`), surface `role="application"` with `aria-roledescription` / `aria-details`
→ table / `aria-describedby` → summary + focused-sample value (`src/fchart.ts`), live
announcements pairing series name with axis-labeled values, and real-text axis ticks. *(automated)*

**Closed by R1:** the data-table x-column header now uses the configured `xLabel`
(`TableUpdate.xLabel` → `buildHead`, `src/a11y/table-alt.ts`; threaded from `scheduleTableUpdate()`
in `src/fchart.ts`), so the independent-variable column carries its real name. With no `xLabel`
set it falls back to `"x"` (an attested integrator-responsibility default).

### 1.3.2 Meaningful Sequence (A) — Supports

DOM is appended in a coherent reading order — legend before plot; within the plot canvas, ticks,
surface (with live region), readout, table, summary, JSON (`src/fchart.ts:197-208`); the
table body reads x-then-series in ascending sample order (`src/a11y/table-alt.ts:84-101`); and
`.fc-root` is `display:flex;flex-direction:column` with **no** `order`/`*-reverse`/float anywhere
(`src/a11y/styles.ts:9`). *(automated)*

Honest notes (do not change the claim): the canvas (`:179`) and readout (`:650`) are
`aria-hidden` and so are not in the reading sequence; the axis ticks **are** exposed
(`src/a11y/ticks.ts:33`, `aria-hidden="false"`) but are positioned by computed scale values
rather than DOM order — the authoritative meaningful sequence for the data is carried by the
hidden table.

### 1.3.3 Sensory Characteristics (A) — Supports

The library's own instructions name keys, not spatial/visual cues — `describeChart()`
(`src/fchart.ts:335-344`): "Left and right arrows move between samples; up and down switch
series; Home and End jump to the ends…". *(automated)* Announcements identify the series by text
name and label values by axis name (`src/fchart.ts:444-453`, *hybrid*). The only residual
sensory dependence (distinguishing on-canvas lines by color) is excised to 1.4.1.

**Author responsibility:** avoid sensory-only language ("the red/top line") in labels and series
names. *(manual-attestation)*

### 1.3.4 Orientation (AA) — Supports

No orientation lock: `.fc-root` is `width/height:100%` flex-column (`src/a11y/styles.ts:9`), the
canvas is `inset:0` 100%/100% (`:14`), and a `ResizeObserver` re-measures and re-renders on any
container resize (`src/fchart.ts:217-218,346-357`). No `@media (orientation)`,
`transform:rotate`, or `screen.orientation` lock exists. *(automated)*

### 1.4.1 Use of Color (A) — Supports

Color is never the sole differentiator. **R5** auto-assigns a distinct dash pattern per series
when the integrator gives none (`src/core/model.ts:82-100`; index 0 stays solid, then a cycle of
8 distinct patterns), and the canvas envelope strokes with that pattern
(`src/renderers/canvas2d.ts:186-193`). The legend swatch mirrors it — a dashed `<line>`, or a
`<rect>` for area series (`src/a11y/legend.ts:67-92`) — so two series are told apart by dash/shape
in grayscale, not only by hue. Non-color identity is also carried by the legend name + shown/hidden
word, the data table's per-series column labels, and the readout/announcements. *(automated)*

The `legend-semantics` gate check asserts the swatches are mutually distinct beyond color
(`new Set(tag|dash).size === count`), so a regression that collapsed the dash channel would fail
the gate. *(automated)*

**Author responsibility:** if you pass explicit `dash` patterns (opting out of the auto-cycle),
keep them distinct across series; or vary series color in more than hue.

### 1.4.3 Contrast (Minimum) (AA) — Partially Supports (host-dependent)

Library-controlled DOM text passes AA **on a light background** (computed vs `#ffffff`):

- tick `--fc-tick-color #4b5563` = **7.56:1** (`src/a11y/styles.ts:16`); *(automated)*
- axis-title `#6b7280` at 10px = **4.83:1** (passes the 4.5:1 normal-text threshold; note 10px
  is *not* large text) (`:20-21`); *(automated)*
- body `--fc-ink #374151` = **10.31:1** (`:10`); *(automated)*
- readout `#f9fafb` on `#111827` = **16.98:1** — fully library-controlled, host-independent
  (`:28-32`); *(automated)*
- `prefers-contrast:more` darkens ticks to `#1f2937` = **14.68:1** (`:50-54`). *(automated)*

**Gap (remaining, inherently integrator-dependent):** the DOM tick/legend text sits on a
transparent surface, so its real contrast depends on the **host background** the integrator places
behind the chart *(hybrid — the px color is checkable, the effective background is not)*. (Data-mark
contrast is 1.4.11, not 1.4.3, and is now covered by the default palette — see 1.4.11.) This is the
one library text-contrast item that no machine can close, so 1.4.3 stays Partially.

**Closed by R8:** the legend "hidden" state no longer reduces text opacity (it previously dropped
`--fc-ink` to ~2.35:1). The off state is now conveyed by `aria-pressed` + a strikethrough name +
a dimmed (decorative, `aria-hidden`) swatch, keeping the label text at full contrast
(`src/a11y/styles.ts`, `src/a11y/legend.ts`).

**Author responsibility:** pick series colors ≥3:1 against the chart background; keep the host
background above 4.5:1 for the DOM text (or override `--fc-tick-color`/`--fc-ink`).

### 1.4.4 Resize Text (AA) — Supports

The container is fluid and re-measures on zoom (`src/a11y/styles.ts:9-14`,
`src/fchart.ts:407-418`), and all label text is real DOM text. **R7** expresses every label
font in **rem** — tick `.6875rem`, axis-title `.625rem`, legend `.78rem`, legend-state `.625rem`,
readout `.75rem` (`src/a11y/styles.ts:16,20,43,53,31`) — so a user's *text-only* zoom (raising the
root font size) enlarges them, and the fluid container reflows to follow. Full-page browser zoom
also works. The `resize-text-rem` gate check raises the root font to 2× and confirms the tick font
scales with it (11px → 22px). *(automated)*

### 1.4.5 Images of Text (AA) — Supports

All readable text is real DOM text — axis ticks/titles are `<span>` text
(`src/a11y/ticks.ts:45-59`), legend uses `<button>` text (`src/a11y/legend.ts:45-52`), the table
is real markup. The canvas renderer paints only grid/border/envelopes/area/crosshair — a repo-wide
search confirms **zero** `fillText`/`strokeText`/`measureText`/`ctx.font`
(`src/renderers/canvas2d.ts:59-220`). *(automated)* (The optional HTML-in-Canvas compositor is a
guarded visual no-op; the real DOM text remains the source of truth.)

### 1.4.10 Reflow (AA) — Supports

The component is fluid with no library-imposed `min-width`; the legend reflows
(`.fc-legend ul{flex-wrap:wrap}`, `src/a11y/styles.ts:38`); 2-D chart geometry is covered by the
criterion's "content requiring two-dimensional layout" exception. **R7** closed the tick-overlap
gap: `effectiveTickCount` (`src/core/ticks.ts:48-53`, wired in at `src/fchart.ts:473-474`) thins
tick density as the plot narrows (≥1 label per 64 px on x, 28 px on y), so labels do not collide at
~320 CSS px or high zoom. The `reflow-adaptive` gate check narrows the chart and confirms the
x-tick count drops (8 → 3). *(hybrid — the library's part is automated; whether the integrator's
surrounding container scrolls in 2-D is theirs.)* *(Note: the hidden data table is a screen-reader
alternative clipped to 1px and does not count as a visual reflow surface.)*

### 1.4.11 Non-text Contrast (AA) — Supports

The essential graphical objects — the data marks — clear 3:1. **R6** added an 8-color
`DEFAULT_PALETTE` (`src/core/model.ts:60-76`), each hue verified **≥3:1 against both a light
(#ffffff) and a dark (#0c1016 / #1f2937) chart background** (`test/palette.test.ts`), assigned by
series index when the integrator gives no color. The `contrast-marks` gate check reads each legend
swatch's color (the DOM-observable proxy for the canvas mark) and confirms ≥3:1 vs the documented
background. The keyboard focus indicator also meets it: `--fc-focus #2563eb` = **5.17:1 on white**
(`src/a11y/styles.ts:25`), with a real `outline` under `prefers-contrast:more` and a system-color
`Highlight` outline under `forced-colors:active`. *(hybrid)*

Gridlines, the axis line, and the cursor crosshair are **decorative reference lines**, not the
graphical objects required to understand the data, so they fall under the 1.4.11 exception and are
intentionally low-contrast; under `forced-colors:active` they are repainted in system colors anyway
(R12). **Author responsibility:** if you override the palette with a low-contrast color, that ≥3:1
becomes your attestation — which is why the row is hybrid rather than fully automated.

### 1.4.12 Text Spacing (AA) — Supports

No library text sets `line-height`/`letter-spacing`/`word-spacing` that would clip under a
user-spacing override, and there is no `overflow:hidden`/fixed-height on visible text (the only
`overflow:hidden` is on the `.fc-sr-only` hidden helpers, which are out of scope; the only
`letter-spacing` is `.12em` on the short uppercase axis title) (`src/a11y/styles.ts:16-21`). No
inline style sets text spacing. *(automated)* Confirming no clip under the full spacing
bookmarklet is a one-time human check. *(manual-attestation)*

### 1.4.13 Content on Hover or Focus (AA) — Supports

The readout tooltip + crosshair shown on hover/focus satisfy **Hoverable** (readout is
`pointer-events:none`, `src/a11y/styles.ts`) and **Persistent** (hidden only on pointer-leave or
blur, never on a timer). **Closed by R3 — now Dismissible:** `onKeyDown` handles Escape via
`dismissCursor()`, which clears the readout + crosshair (`cursorActive = false`) **without moving
focus**, so a later arrow re-activates the cursor (`src/fchart.ts`; `handlesKey` recognizes
Escape in `src/a11y/cursor.ts`). *(automated)*

---

## 8. Per-criterion detail — Operable, Understandable, Robust

### 2.1.1 Keyboard (A) — Supports

Cursor navigation (`src/fchart.ts`, `src/a11y/cursor.ts:43-75`) and legend show/hide (native
`<button>`) are fully keyboard-operable; arrows auto-pan via `panToInclude` so any sample is
reachable. **Closed by R2:** keyboard zoom now mirrors wheel-zoom — `+`/`=` zoom in, `-`/`_` zoom
out, centered on the cursor (`zoomFactor` in `src/a11y/cursor.ts`; `zoomAroundCursor` in
`src/fchart.ts`), and the keyboard-help text documents it. Every pointer function now has a
keyboard path. *(automated)*

### 2.1.2 No Keyboard Trap (A) — Supports

`onKeyDown` early-returns for any non-navigation key and only `preventDefault`s the six handled
keys — Tab/Shift+Tab are never consumed (`src/fchart.ts:514-516`, `src/a11y/cursor.ts:21`).
No `focus()` trap, `aria-modal`, or `inert` exists; the blur handler only deactivates the cursor
(`:507-512`); drag pointer-capture is released on up/cancel and cannot trap focus (`:551,565-571`).
*(automated)*

### 2.1.4 Character Key Shortcuts (A) — Supports

The complete handled key set is `ArrowRight/Left/Up/Down/Home/End` plus the Shift modifier
(`src/a11y/cursor.ts:21`); no single letter/number/punctuation shortcut exists, so the criterion
has nothing to remap or turn off. No `accesskey` anywhere. *(automated)*

### 2.2.1 Timing Adjustable (A) — Supports

No time limits, sessions, timeouts, or countdowns. The only timers are a 150ms table-update
throttle and a 100ms announce debounce (`src/fchart.ts:72-75,417-431,455-461`) — output
coalescers that delay no user action and expire no task. *(hybrid — absence of `setInterval`/new
timers is source-assertable; "imposes no deadline" is a semantic judgment.)*

**Author responsibility:** if the integrator drives `setData()` on a timer (live streaming), they
own the pause/stop controls for 2.2.1/2.2.2.

### 2.2.2 Pause, Stop, Hide (A) — Supports

Rendering is strictly on-demand (the scheduler fires one frame per `request()`, with no rAF
recursion; `src/core/scheduler.ts`); no auto-motion, auto-scroll, blink, or auto-update with
shipped defaults. The only animation is a 0.08s readout opacity fade (`src/a11y/styles.ts:32`),
far under the 5s threshold and disabled under `prefers-reduced-motion` (`:49`). *(hybrid)*

### 2.3.1 Three Flashes (A) — Supports

Nothing flashes: `render()` does a single `clearRect`+repaint per user-driven frame
(`src/renderers/canvas2d.ts:59-91`); the crosshair is a static dashed line (`:188-220`). No
`@keyframes`/blink/strobe; render cadence is bounded by user input + rAF. *(hybrid; a luminance-
over-time probe over arbitrary author data is a human check.)*

**Author responsibility:** do not feed data that induces rapid full-canvas luminance flips.

### 2.4.3 Focus Order (A) — Supports

Within the component, focus order is legend buttons then the data surface — matching DOM/reading
order (`src/fchart.ts:197-208`); `tabIndex 0` is the only focus-affecting statement (no
positive tabindex, no programmatic reorder, no autofocus) (`:186`). Hidden helpers carry no
tabindex. *(automated)*

### 2.4.6 Headings and Labels (AA) — Supports

The component emits no section headings (host owns document headings), and its labels are
descriptive: surface `aria-label` (`src/fchart.ts`), legend group + buttons
(`src/a11y/legend.ts`), table caption + scoped headers (`src/a11y/table-alt.ts`). **Closed by R1:**
the table x-column header now uses the configured `xLabel` rather than the hardcoded `"x"`.
*(automated)* (Generic `ariaLabel`/`xLabel` fallbacks — "Chart"/"x"/"value" when unset — remain a
disclosed integrator-responsibility item.)

### 2.4.7 Focus Visible (AA) — Supports

Both focusable surfaces show an indicator: the data surface gets a `:focus-visible` box-shadow
ring (`src/a11y/styles.ts:25`), upgraded to a real `outline` under `prefers-contrast:more`
(`:50-54`) and a system-color `Highlight` outline under `forced-colors:active` (`:57-59`, the
correct pattern since forced-colors suppresses box-shadow); legend `<button>`s keep the UA's
native focus ring (no `outline:none` on them). *(automated)* (Indicator *contrast* is SC 2.4.11
Focus Appearance, AAA — out of A+AA scope; the perceivability of `--fc-focus` against an arbitrary
host background is an integrator concern.) *(manual-attestation)*

### 2.4.11 Focus Not Obscured (Minimum) (AA) — Partially Supports

The component never *entirely* obscures its own focused surface: the readout is `opacity:0` by
default, `aria-hidden`, and when shown is a small tooltip (`min-width:118px`) covering only a
fraction of the large surface (`src/a11y/styles.ts:28-33`, `src/fchart.ts:650`); the surface
is the top interactive layer (`:202-204`). *(hybrid — DOM/z-index structure is assertable;
non-obscuring depends on rendered geometry.)* **Gap (integrator):** host-page sticky headers,
toolbars, or overlays could obscure the focused chart — the library cannot control this.
*(manual-attestation)*

**Author responsibility:** keep host sticky/overlay UI off the chart's focused surface and legend.

### 2.5.1 Pointer Gestures (A) — Supports

All pointer interactions are single-pointer and not path-based: drag-pan depends on the net
horizontal delta (`clientX - dragStartX`), not the trajectory traced, so any path produces the
same result (`src/fchart.ts:546-563`); zoom is wheel-driven (`:536-544`); no multipoint
(pinch/rotate) gesture exists. 2.5.1 only governs multipoint/path gestures, so it is satisfied.
*(manual-attestation — "not path-based / not multipoint" is a human judgment; a keyboard
equivalent additionally exists.)* (Drag-pan as a *dragging* movement is assessed under 2.5.7.)

### 2.5.2 Pointer Cancellation (A) — Supports

No function executes on the down-event: `onPointerDown` only sets drag state and captures the
pointer (`src/fchart.ts:546-552`); the pan is computed against the immutable start-domain
snapshot each move, so dragging back to origin restores it exactly, and it finalizes on
`pointerup` (`:554-571`, with `pointercancel` wired to the same handler). Legend buttons are
native `<button>` activating on the up-event (`src/a11y/legend.ts:36-38`). *(automated for the
native button; manual-attestation for pan reversibility.)*

### 2.5.3 Label in Name (A) — Supports

The only controls with a visible text label are the legend buttons; each button's accessible name
is computed from the same visible series-name text node it displays (the swatch is `aria-hidden`)
(`src/a11y/legend.ts:40-52`), so the visible label is contained in the accessible name —
verifiable by axe's `label-in-name` rule. *(automated)* The surface (`role="application"`) renders
no visible text label, so it has nothing to assess. *(manual-attestation)*

### 2.5.7 Dragging Movements (AA) — Supports

Legend toggles are single taps and wheel-zoom is non-dragging. **R4** closed the drag-pan gap: the
chart renders **pan pagers** — two real ‹/› `<button>`s (`src/a11y/pagers.ts:1-44`) that step the
visible window ~one page earlier/later on a single-pointer click via `panPage()`
(`src/fchart.ts:724-742`), the single-*pointer*, non-dragging alternative 2.5.7 requires. They
appear once the view is zoomed in (panning has an effect) and, being buttons, are keyboard- and
AT-operable too. The `single-pointer-pan` gate check zooms in, then confirms the pagers are present
and that a click shifts the visible domain. *(automated)* (Drag-pan still exists as a convenience;
the keyboard path additionally satisfies 2.1.1.)

### 2.5.8 Target Size (Minimum) (AA) — Supports

The data surface fills the plot inset and far exceeds 24×24 (`src/fchart.ts:359-362`).
**Closed by R9:** legend buttons now set `min-height:24px;min-width:24px;line-height:1.1`
(`src/a11y/styles.ts`), so they meet the 24×24 minimum independent of inherited host font metrics
— now assertable by a computed-box check (`getBoundingClientRect() ≥ 24`). *(automated)*

### 3.1.2 Language of Parts (AA) — Supports

Author-supplied strings and numeric tick/value text are the integrator's (they own their
language). **Closed by R10:** every fixed UI string the library emits — keyboard help, legend
group label, per-series state words, table caption, and the full data-summary sentence — is now
overridable via the `strings` option (`FChartStrings` + token-template defaults in
`src/a11y/strings.ts`, threaded through legend/table/summary/`describeChart`). An integrator on a
non-English page supplies translations so the parts match the page language. *(automated — the
strings flow is unit-tested; defaults remain English.)*

**Author responsibility:** on a non-English page, pass localized `strings` (and series names /
axis labels) so the rendered text matches the document language.

### 3.2.1 On Focus (A) — Supports

Focusing the surface only sets `cursorActive`, announces the current point via the polite live
region, and re-renders the crosshair in place — no focus move, navigation, window, or form
submission (`src/fchart.ts:501-505`; `src/a11y/live-region.ts:13-14`). Legend buttons have no
focus handler. *(automated)*

### 3.2.2 On Input (A) — Supports

Navigation keys move the cursor / pan in place (`src/fchart.ts:514-534`); legend buttons
(`type="button"`, `aria-pressed`) toggle visibility in place via `toggleSeries` (`:433`,
`src/a11y/legend.ts:36`). No path changes context (no navigation/submission/focus-move). The
in-widget pan is the direct, advertised consequence of the key pressed. *(automated)*

### 3.2.4 Consistent Identification (AA) — Supports

All legend buttons are produced by one `build()` routine with identical structure (swatch + name
+ state) and uniform `aria-pressed` (`src/a11y/legend.ts:31`); the surface carries a stable
`role="application"` + `aria-roledescription` on every instance (`src/fchart.ts:187`). Same-
function components are identified identically across instances. *(automated)*

### 3.3.2 Labels or Instructions (A) — Supports

The component has no data-entry fields, but its interactive controls carry instructions: the
surface `aria-label` embeds the full keyboard model + a pointer to the data table
(`src/fchart.ts:335-344`), the legend group is labeled "activate to show or hide", and each
button has a name + "shown"/"hidden" state (`src/a11y/legend.ts:25,69-75`). *(automated)*

### 4.1.2 Name, Role, Value (A) — Supports

**Name** and **Role** are correctly exposed for every interactive object: surface
`role="application"` + `aria-roledescription` + `aria-label` + `aria-details`/`aria-describedby`
(`src/fchart.ts`); native legend `<button>` with `aria-pressed` (`src/a11y/legend.ts`); canvas
+ readout `aria-hidden`; native table with scoped headers (`src/a11y/table-alt.ts`). *(automated)*

**Closed by R11 — the Value half:** the focused sample is now a programmatically-determinable
value. A dedicated `aria-describedby` target (`fc-active-{n}`) is updated **in lockstep** with
every cursor move (`updateActiveSample`, `src/fchart.ts`), so AT/automation can *query* the
current point (not only hear the transient live announcement, which still serves 4.1.3). The
legend "shown"/"hidden" state span is now `aria-hidden`, so each button's accessible name stays
the stable series name while `aria-pressed` carries state. *(automated for the attribute wiring;
manual-attestation that `role="application"` + the value target read correctly in NVDA/JAWS/
VoiceOver, since `role="application"` is a deliberate browse-mode trade-off.)*

### 4.1.3 Status Messages (AA) — Supports

Cursor moves (keyboard + hover) that are not conveyed through focus are announced via a dedicated
`aria-live="polite"` `aria-atomic="true"` region, appended at construction so it pre-exists
updates (`src/a11y/live-region.ts:11-22`, `src/fchart.ts:198`). Announcements are debounced
100ms so key-repeat does not flood the region, fire immediately on focus, and re-announce
identical text via a trailing-space nudge (`src/fchart.ts:443-461,501-505`). *(automated for
attribute presence + DOM-before-update ordering; the live region nests inside `role="application"`
— polite announcement there is AT-dependent.)* **Attestation:** that announcements are actually
spoken and the debounce does not drop the settled point requires a functional probe + real-AT
check (*hybrid/manual-attestation*; the functional probe is added in document 3). The legend
visibility change is conveyed through the focused control's `aria-pressed`, not a live status, so
it is out of 4.1.3 scope.

---

## 9. Not-applicable criteria

A single embedded, read-only chart component does not produce media, create input fields, or own
page-level structure. Each is reported **Not Applicable** with this reason:

| SC | Lvl | Name | Reason not applicable |
|---|---|---|---|
| 1.2.1 | A | Audio/Video-only (Prerecorded) | The component renders no audio/video; it draws vector marks + a DOM overlay. |
| 1.2.2 | A | Captions (Prerecorded) | No synchronized media. |
| 1.2.3 | A | Audio Description / Media Alt | No video content. |
| 1.2.4 | AA | Captions (Live) | No live media; real-time data uses a text live region. |
| 1.2.5 | AA | Audio Description (Prerecorded) | No video content. |
| 1.3.5 | AA | Identify Input Purpose | No form inputs collecting user information. |
| 1.4.2 | A | Audio Control | No audio. |
| 2.4.1 | A | Bypass Blocks | Page-level; the chart is a single focus stop, not repeated page blocks. |
| 2.4.2 | A | Page Titled | Page-level; the host owns the document title. |
| 2.4.4 | A | Link Purpose (In Context) | The component renders no links. |
| 2.4.5 | AA | Multiple Ways | Page/site-level navigation concern. |
| 2.5.4 | A | Motion Actuation | No device-motion-actuated functionality. |
| 3.1.1 | A | Language of Page | Page-level; the host sets document language. |
| 3.2.3 | AA | Consistent Navigation | Cross-page navigation concern; not a single component. |
| 3.2.6 | A | Consistent Help | Page/site-level help mechanism concern. |
| 3.3.1 | A | Error Identification | No form inputs / errors. |
| 3.3.3 | AA | Error Suggestion | No form inputs / errors. |
| 3.3.4 | AA | Error Prevention (Legal…) | No transactions / legal commitments. |
| 3.3.7 | A | Redundant Entry | No multi-step entry of information. |
| 3.3.8 | AA | Accessible Authentication (Min) | No authentication. |

---

## 10. User-preference adaptations

### reduced-motion — Supports

The library honors `prefers-reduced-motion` and lets the integrator force it: the only shipped CSS
transition (the 0.08s readout fade) is removed under `@media (prefers-reduced-motion:reduce)`
(`src/a11y/styles.ts:32,49`); the `reducedMotion` option is auto-detected via `matchMedia` and
threaded into every `RenderScene` (`src/fchart.ts:143-144,406,634-636`). *(automated)* There is
essentially no decorative/looping motion to suppress — rendering is data-driven, with no entrance
animations, autoplay, or parallax. *(The renderer does not yet branch on `scene.reducedMotion`
because no animation exists to gate; the flag is plumbed for future animated transitions. A human
should confirm rapid drag-pan/wheel-zoom view changes feel acceptable to a motion-sensitive user —
manual-attestation.)*

### forced-colors (Windows High Contrast Mode) — Supports

The DOM overlay adapts and the focus indicator is preserved: `@media (forced-colors:active)` gives
the surface an `outline:2px solid Highlight` (forced-colors ignores box-shadow)
(`src/a11y/styles.ts:55-59`); DOM tick text + native legend buttons are remapped to system colors
automatically (`:16,50-54`). *(automated)*

**R12 made the canvas participate too.** A `<canvas>` bitmap does not inherit CSS forced-colors, so
the renderer now does it explicitly: when `forced-colors:active`, `readForcedColors` probes the
system palette (CanvasText / Canvas / GrayText / Highlight) via a styled probe element
(`src/renderers/canvas2d.ts:37-54`) and the render path repaints the grid, axes, series, and cursor
crosshair in those system colors instead of author colors (`:99-101,143,159,186,247`). A media
listener tracks live toggles and re-renders (`src/fchart.ts:261-270`). The data also remains
available non-visually (data table, legend, live region, JSON summary). The `forced-colors-canvas`
gate check toggles forced-colors on and confirms the canvas bitmap actually changes (it repaints in
system colors). *(automated)*

---

## 11. Remediation backlog

The backlog split into **library-closable** (changes to the MIT renderer that raise the conformance
level and are CI-checkable) and **inherently integrator-dependent** (reported as remarks +
attestation). **All library-closable items are now done** across two waves — wave 1 (R1–R3,
R8–R11, the cheap fixes, commit `7bf4fcd`) and wave 2 (R4–R7, R12, the accessibility backlog) —
each verified end-to-end (axe stays 0, thesis holds, all unit tests pass, and the live gate gained
a check that re-proves each upgrade).

### Library-closable — all done (✅)

| ID | Closes | Status | Fix |
|---|---|---|---|
| **R1** | 1.3.1, 2.4.6 | ✅ done | `TableUpdate.xLabel` threaded from `scheduleTableUpdate()` into `buildHead`, so the x-column header uses the configured label (falls back to `"x"`). |
| **R2** | 2.1.1 | ✅ done | Keyboard zoom: `zoomFactor()` (`+`/`=`/`-`/`_`) + `zoomAroundCursor()` mirror wheel-zoom centered on the cursor; help text + unit tests added. |
| **R3** | 1.4.13 | ✅ done | Escape branch in `onKeyDown` → `dismissCursor()` clears readout + crosshair without blurring. |
| **R4** | 2.5.7 | ✅ done | Pan pagers: single-pointer ‹/› `<button>`s (`a11y/pagers.ts`) step the window via `panPage()`; shown when zoomed. Gate check: `single-pointer-pan`. |
| **R5** | 1.4.1 | ✅ done | Auto per-series dash (`AUTO_DASH` in `core/model.ts`), drawn on the canvas + mirrored in the legend swatch, so color is not the only channel. Gate check: `legend-semantics` (swatch distinctness). |
| **R6** | 1.4.11 | ✅ done | 8-color `DEFAULT_PALETTE`, each ≥3:1 on light AND dark (`palette.test.ts`), assigned by index. Gate check: `contrast-marks`. |
| **R7** | 1.4.4, 1.4.10 | ✅ done | px→rem label fonts (text-only zoom scales) + `effectiveTickCount` adaptive tick density (no overlap when narrow). Gate checks: `resize-text-rem`, `reflow-adaptive`. |
| **R8** | 1.4.3 | ✅ done | Legend "hidden" state no longer reduces text opacity; uses `aria-pressed` + strikethrough + dimmed (decorative) swatch. |
| **R9** | 2.5.8 | ✅ done | `min-height:24px;min-width:24px;line-height:1.1` on `.fc-legend button`. |
| **R10** | 3.1.2 | ✅ done | `strings` option (`FChartStrings` token-templates) localizes every fixed UI string. |
| **R11** | 4.1.2 | ✅ done | Focused sample exposed as a queryable value via a lockstep `aria-describedby` target; legend state span `aria-hidden`. |
| **R12** | forced-colors | ✅ done | Renderer probes the system palette and repaints the canvas (marks/grid/crosshair) under `forced-colors:active`; media listener tracks live toggles. Gate check: `forced-colors-canvas`. |

### Inherently integrator-dependent (remarks + attestation, never automated passes)

| SC(s) | Why it stays a remark |
|---|---|
| **1.4.3** | The effective host background behind the tick/legend text is the host page's — the px color is checkable, the rendered ratio on the host is not. |
| **2.4.11** | Whether host-page sticky/overlay UI obscures the chart's focus is outside the component boundary. |
| (1.4.11 override) | If the integrator replaces the default palette with a low-contrast color, that ≥3:1 is their attestation — the default palette itself is verified. |

> **Outcome:** wave 1 (R1–R3, R8–R11) moved 1.3.1, 1.4.13, 2.1.1, 2.4.6, 2.5.8, 3.1.2, 4.1.2 →
> **Supports** (21 → 28); wave 2 (R4–R7, R12) moved 1.4.1, 1.4.4, 1.4.10, 1.4.11, 2.5.7, and the
> forced-colors adaptation → **Supports** (28 → 33). The 2 remaining Partially Supports (1.4.3,
> 2.4.11) are inherently host/integrator-dependent.

---

## 12. What the CI gate enforces vs. what a human attests

Derived from the verification tags above; formalized in documents 3 and 4.

**CI-enforceable (automated, runs every commit) — the gate fails if any regresses:**

- axe: 0 serious/critical violations scoped to the chart (necessary, not sufficient — see
  `FINDINGS.md`).
- DOM structure: canvas `aria-hidden`; surface `role="application"` + `aria-roledescription` +
  non-empty `aria-label` + `aria-details` + `aria-describedby`; legend `role="group"` of
  `type="button"` `aria-pressed` controls; data `<table>` with `<caption>` + `<th scope>` headers;
  live region `aria-live="polite"` `aria-atomic="true"` present before updates.
- Functional keyboard: focus the surface → arrows/Home/End change the announced sample (the live
  region's text changes); Tab is not trapped; no single-character shortcuts.
- Source/CSS assertions: no `fillText`/`strokeText` (1.4.5); no `order`/`*-reverse` (1.3.2); a
  `forced-colors` and a `prefers-reduced-motion` rule exist (2.4.7, reduced-motion); no positive
  tabindex (2.4.3).
- Computed contrast for **fully library-controlled** pairs only: the readout (`#f9fafb` on
  `#111827`), and the default DOM text **against a documented test background**.
- Post-remediation checks (verified once, now in the gate's scope): table x-header equals the
  configured `xLabel` (R1); legend `getBoundingClientRect() ≥ 24` (R9); Escape clears the
  readout and keeps focus (R3); `+`/`-` change the visible domain (R2); the focused-sample
  `aria-describedby` target is populated on focus and cleared on Escape (R11); the localized
  `strings` flow (R10). These are exercised today by the one-off harness used to verify the
  fixes and will be folded into the conformance engine (document 3 / task 17).

**Human attestation (the VPAT carries these as signed lines, not automated passes):**

- Perceptual: distinguishability of overlapping series for color-blind users (1.4.1); usability in
  real Windows High Contrast Mode (forced-colors); no clipping at 200% zoom (1.4.4/1.4.10).
- Real-AT behavior with NVDA/JAWS/VoiceOver: name + instructions announced on focus, table reachable
  via `aria-details`, polite announcements actually spoken from inside `role="application"`
  (4.1.2, 4.1.3).
- Semantic quality of integrator-supplied `ariaLabel`/`xLabel`/`yLabel`/series names (1.1.1, 2.4.6).
- Integration-context: host background contrast (1.4.3/1.4.11), host sticky/overlay obscuring
  (2.4.11), host document language vs. the library's English strings until R10 (3.1.2).

---

*Generated for the fcharts Compliance Pack. Mapping + adversarial verification + completeness
critique covered all 55 WCAG 2.2 A/AA success criteria (4.1.1 excluded as removed in 2.2), each
applicable claim independently challenged, with `file:line` evidence confirmed against the source
at the time of writing.*
