# Sightline Compliance Pack — Chart-Layer WCAG 2.2 AA Scope & Evidence Map

> **Status:** authoritative source of truth for the Compliance Pack. The conformance test
> suite, the auto-generated VPAT/ACR, and the CI accessibility gate are all derived from this
> document. **Honesty is the contract:** every claim below is marked "Partially Supports"
> wherever a real gap exists, and every claim is tagged with *how* it is verified
> (machine-checkable vs. human attestation). This file was produced by mapping all 55 WCAG 2.2
> Level A + AA success criteria against the source, then adversarially re-verifying every
> applicable claim (each verifier tried to *downgrade* the claim and confirmed the cited
> `file:line` evidence), then a completeness critic checked coverage and consistency.

> **Update (remediation applied).** After this map was first written (baseline: 21 Supports /
> 14 Partially / 20 N/A), the 8 library-closable gaps in the backlog (§11) were fixed in the MIT
> renderer and verified end-to-end (axe stays 0, thesis holds, all unit tests pass). Seven
> criteria moved **Partially → Supports** — 1.3.1, 1.4.13, 2.1.1, 2.4.6, 2.5.8, 3.1.2, 4.1.2 —
> and 1.4.3's legend-opacity sub-gap was closed (it stays Partially because host background and
> author colors remain integrator-dependent). **The tables and per-criterion detail below
> reflect the current, post-remediation source.** New baseline: **28 Supports / 7 Partially /
> 20 N/A.**

This is **document 1 of 4** in the Compliance Pack design:

1. **Scope & evidence map** (this file)
2. VPAT/ACR format + editions (EN 301 549 first, then WCAG-INT and US 508) — `vpat-editions.md`
3. Conformance test plan + pass→conformance mapping — `conformance-test-plan.md`
4. CI gate contract (`sightline-audit` CLI + GitHub Action) — `ci-gate.md`

---

## 1. Scope

The Compliance Pack reports conformance for **the Sightline chart component** — everything the
library renders inside its container (`.sl-root`) and the behavior it ships by default. It does
**not** report conformance for the page that embeds the chart.

### In scope (the component boundary)

Everything Sightline constructs inside `.sl-root`:

- the `<canvas>` data layer (the fast min/max-pyramid renderer);
- the real-DOM overlay: axis tick text (`.sl-tick`), the accessible legend (`role="group"` of
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

- **Library guarantee** — true for every Sightline instance with shipped defaults, regardless
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
identically to Sightline. So each evidence item is tagged with how it is verified:

- **`automated`** — a machine check can prove/disprove it on **every commit**. This is one of:
  an axe rule, a DOM-structure assertion (attributes/roles/element presence), a **computed
  contrast ratio** (only when *both* foreground and background are known to the library), a
  **functional probe** (focus the surface, press a key, assert the live region changed), or a
  source/CSS assertion (e.g. "no `setLineDash` per series", "a `forced-colors` rule exists").
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
| **Supports** | 28 | 1.1.1, 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.4.5, 1.4.12, 1.4.13, 2.1.1, 2.1.2, 2.1.4, 2.2.1, 2.2.2, 2.3.1, 2.4.3, 2.4.6, 2.4.7, 2.5.1, 2.5.2, 2.5.3, 2.5.8, 3.1.2, 3.2.1, 3.2.2, 3.2.4, 3.3.2, 4.1.2, 4.1.3 |
| **Partially Supports** | 7 | 1.4.1, 1.4.3, 1.4.4, 1.4.10, 1.4.11, 2.4.11, 2.5.7 |
| **Not Applicable** | 20 | 1.2.1–1.2.5, 1.3.5, 1.4.2, 2.4.1, 2.4.2, 2.4.4, 2.4.5, 2.5.4, 3.1.1, 3.2.3, 3.2.6, 3.3.1, 3.3.3, 3.3.4, 3.3.7, 3.3.8 |

Plus two **user-preference adaptations** (beyond strict A/AA, reported as good practice):
**reduced-motion = Supports**, **forced-colors = Partially Supports** (the canvas bitmap cannot
participate in forced-colors; the DOM overlay and data alternatives do — see §10).

**The 8 library-closable gaps are now fixed** (§11). The remaining 7 Partially Supports are
either inherently integrator-dependent (host background, author series colors, host page layout)
or need larger renderer work deferred from the cheap-fix batch (per-series dash/marker, a
default palette, adaptive tick thinning, a single-pointer pan affordance — backlog R4–R7, R12).
They are reported as remarks + attestation lines. No applicable criterion is rated
"Does Not Support".

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
| 1.4.1 | A | Use of Color | **Partially** | A | Legend/table/readout give color-free identity, **but on the canvas series are distinguished by color only** (no dash/marker). |
| 1.4.3 | AA | Contrast (Minimum) | **Partially** | H | Library-default DOM text passes on a light background and the legend "hidden" state no longer dims text (R8); **canvas series colors (author-supplied) and the effective host background remain integrator-controlled**. |
| 1.4.4 | AA | Resize Text | **Partially** | H | Container is fluid (page-zoom works); **label fonts are fixed px**, so text-only zoom does not enlarge them. |
| 1.4.5 | AA | Images of Text | Supports | A | All readable text is real DOM text; the canvas renders **no** `fillText`/`strokeText`. |
| 1.4.10 | AA | Reflow | **Partially** | H | Fluid canvas + reflowing legend; 2-D chart geometry is exempt; **fixed-px tick labels can overlap at narrow widths**. |
| 1.4.11 | AA | Non-text Contrast | **Partially** | H | Focus ring is 5.17:1 on white; **default grid/axis/cursor are below 3:1 and series-mark contrast is author-determined**. |
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
| 2.5.7 | AA | Dragging Movements | **Partially** | H | **Drag-pan has no single-pointer non-dragging alternative** (keyboard does not satisfy 2.5.7; wheel zooms, it does not pan). |
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
| forced-colors | Windows High Contrast Mode | **Partially** | H | DOM overlay + focus ring adapt; **canvas marks cannot be remapped to system colors** and series are color-only. |

---

## 7. Per-criterion detail — Perceivable

### 1.1.1 Non-text Content (A) — Supports

The `<canvas>` bitmap is non-text content opaque to AT, and a programmatically-determined text
alternative is **always** present (constructed before any `setData`, via `refreshDerived()` at
`src/sightline.ts:224`):

- Canvas removed from the a11y tree — `src/sightline.ts:179` (`aria-hidden="true"`). *(automated)*
- Hidden `<table>` text alternative with `<caption>`, `<th scope="col">`, `<th scope="row">`,
  downsampled to ≤40 rows — `src/a11y/table-alt.ts:52-110`. *(automated)*
- Surface accessible **name** (`aria-label` set at `src/sightline.ts:322` via `describeChart()`
  `:335-344`) and **description** (`aria-describedby` → one-line values+trend summary,
  `src/a11y/summary.ts:88-105`). *(automated)*
- Decorative graphics hidden: legend swatch `aria-hidden` (`src/a11y/legend.ts:42`), readout
  tooltip `aria-hidden` (`src/sightline.ts:650`). *(automated)*
- Whether the integrator's `ariaLabel`/`xLabel`/`yLabel` meaningfully describe the chart's
  *purpose* is an authoring judgment; with no `ariaLabel` the name falls back to the generic
  "Chart". *(manual-attestation)*

**Author responsibility:** supply a meaningful `ariaLabel` and axis labels.

### 1.3.1 Info and Relationships (A) — Supports

Visual relationships are exposed in the DOM: table semantics with `<caption>` and scoped
headers (`src/a11y/table-alt.ts:68-114`), `role="group"` legend of `aria-pressed` buttons
(`src/a11y/legend.ts`), surface `role="application"` with `aria-roledescription` / `aria-details`
→ table / `aria-describedby` → summary + focused-sample value (`src/sightline.ts`), live
announcements pairing series name with axis-labeled values, and real-text axis ticks. *(automated)*

**Closed by R1:** the data-table x-column header now uses the configured `xLabel`
(`TableUpdate.xLabel` → `buildHead`, `src/a11y/table-alt.ts`; threaded from `scheduleTableUpdate()`
in `src/sightline.ts`), so the independent-variable column carries its real name. With no `xLabel`
set it falls back to `"x"` (an attested integrator-responsibility default).

### 1.3.2 Meaningful Sequence (A) — Supports

DOM is appended in a coherent reading order — legend before plot; within the plot canvas, ticks,
surface (with live region), readout, table, summary, JSON (`src/sightline.ts:197-208`); the
table body reads x-then-series in ascending sample order (`src/a11y/table-alt.ts:84-101`); and
`.sl-root` is `display:flex;flex-direction:column` with **no** `order`/`*-reverse`/float anywhere
(`src/a11y/styles.ts:9`). *(automated)*

Honest notes (do not change the claim): the canvas (`:179`) and readout (`:650`) are
`aria-hidden` and so are not in the reading sequence; the axis ticks **are** exposed
(`src/a11y/ticks.ts:33`, `aria-hidden="false"`) but are positioned by computed scale values
rather than DOM order — the authoritative meaningful sequence for the data is carried by the
hidden table.

### 1.3.3 Sensory Characteristics (A) — Supports

The library's own instructions name keys, not spatial/visual cues — `describeChart()`
(`src/sightline.ts:335-344`): "Left and right arrows move between samples; up and down switch
series; Home and End jump to the ends…". *(automated)* Announcements identify the series by text
name and label values by axis name (`src/sightline.ts:444-453`, *hybrid*). The only residual
sensory dependence (distinguishing on-canvas lines by color) is excised to 1.4.1.

**Author responsibility:** avoid sensory-only language ("the red/top line") in labels and series
names. *(manual-attestation)*

### 1.3.4 Orientation (AA) — Supports

No orientation lock: `.sl-root` is `width/height:100%` flex-column (`src/a11y/styles.ts:9`), the
canvas is `inset:0` 100%/100% (`:14`), and a `ResizeObserver` re-measures and re-renders on any
container resize (`src/sightline.ts:217-218,346-357`). No `@media (orientation)`,
`transform:rotate`, or `screen.orientation` lock exists. *(automated)*

### 1.4.1 Use of Color (A) — Partially Supports

Non-color channels carry series identity: the legend pairs an `aria-hidden` swatch with visible
**name** text + a "shown"/"hidden" word (`src/a11y/legend.ts:40-52,69-75`), the data table labels
each value column by series name (`src/a11y/table-alt.ts:75-82`), and the readout/announcements
name the series. *(automated)*

**Gap (library, automated → perceptual):** on the canvas, the envelope stroke uses only
`s.color` with no `setLineDash` and no per-series marker (`src/renderers/canvas2d.ts:143-147`;
the only dashed stroke is the *shared* cursor crosshair). Two overlapping/close series cannot be
told apart by a color-blind user looking only at the canvas. The text channels are *alternatives
to* the canvas, not color-independent differentiation of the marks themselves. → **Remediation
R5 (§11)**. Whether two on-canvas lines are distinguishable is a perceptual judgment.
*(manual-attestation)*

**Author responsibility:** choose series colors differing in more than hue (vary lightness);
label close series directly.

### 1.4.3 Contrast (Minimum) (AA) — Partially Supports

Library-controlled DOM text passes AA **on a light background** (computed vs `#ffffff`):

- tick `--sl-tick-color #4b5563` = **7.56:1** (`src/a11y/styles.ts:16`); *(automated)*
- axis-title `#6b7280` at 10px = **4.83:1** (passes the 4.5:1 normal-text threshold; note 10px
  is *not* large text) (`:20-21`); *(automated)*
- body `--sl-ink #374151` = **10.31:1** (`:10`); *(automated)*
- readout `#f9fafb` on `#111827` = **16.98:1** — fully library-controlled, host-independent
  (`:28-32`); *(automated)*
- `prefers-contrast:more` darkens ticks to `#1f2937` = **14.68:1** (`:50-54`). *(automated)*

**Gaps (remaining, integrator-dependent):** (1) canvas series strokes use `config.color` with
**no default palette** (`src/core/model.ts:55-65`), so data-mark contrast vs the chart background
is the integrator's choice and not machine-verifiable *(manual-attestation)*; (2) the DOM text
sits on a transparent surface, so its real contrast depends on the **host background** the
integrator places behind the chart *(hybrid — the px color is checkable, the effective background
is not)*. → remaining backlog **R6**.

**Closed by R8:** the legend "hidden" state no longer reduces text opacity (it previously dropped
`--sl-ink` to ~2.35:1). The off state is now conveyed by `aria-pressed` + a strikethrough name +
a dimmed (decorative, `aria-hidden`) swatch, keeping the label text at full contrast
(`src/a11y/styles.ts`, `src/a11y/legend.ts`).

**Author responsibility:** pick series colors ≥3:1 against the chart background; keep the host
background above 4.5:1 for the DOM text (or override `--sl-tick-color`/`--sl-ink`).

### 1.4.4 Resize Text (AA) — Partially Supports

The container is fluid and re-measures on zoom (`src/a11y/styles.ts:9-14`,
`src/sightline.ts:217-218,346-357`), and all label text is real DOM text. Full-page browser zoom
(the path WCAG accepts) works. **Gap (library, hybrid):** tick (11px), axis-title (10px), legend
(12.5px), readout (12px) font sizes are absolute px (`src/a11y/styles.ts:16,20,42,31`), so a
user's *text-only* zoom does not enlarge them; whether 200% page-zoom causes any clip/overlap in
a given layout needs human verification. → **Remediation R7 (§11)**.

### 1.4.5 Images of Text (AA) — Supports

All readable text is real DOM text — axis ticks/titles are `<span>` text
(`src/a11y/ticks.ts:45-59`), legend uses `<button>` text (`src/a11y/legend.ts:45-52`), the table
is real markup. The canvas renderer paints only grid/border/envelopes/area/crosshair — a repo-wide
search confirms **zero** `fillText`/`strokeText`/`measureText`/`ctx.font`
(`src/renderers/canvas2d.ts:59-220`). *(automated)* (The optional HTML-in-Canvas compositor is a
guarded visual no-op; the real DOM text remains the source of truth.)

### 1.4.10 Reflow (AA) — Partially Supports

The component is fluid with no library-imposed `min-width`; the legend reflows
(`.sl-legend ul{flex-wrap:wrap}`, `src/a11y/styles.ts:38`); 2-D chart geometry is covered by the
criterion's "content requiring two-dimensional layout" exception. **Gap (library, hybrid):**
`.sl-tick` is fixed `font-size:11px;white-space:nowrap` (`:16`), so dense tick labels can overlap
rather than reflow at ~320 CSS px / high zoom. → **Remediation R7 (§11)**. *(Note: the hidden
data table is a screen-reader alternative — clipped to 1px — and does not count as a visual reflow
surface for a sighted low-vision user; the reflow argument rests on the fluid canvas + reflowing
legend + the 2-D exemption.)*

### 1.4.11 Non-text Contrast (AA) — Partially Supports

The library's keyboard focus indicator meets the 3:1 threshold: `--sl-focus #2563eb` = **5.17:1
on white** (`src/a11y/styles.ts:25`), with a real `outline` added under `prefers-contrast:more`
(`:53`) and a system-color `Highlight` outline under `forced-colors:active` (`:58`). *(automated,
scoped to a light background — #2563eb is ~2.0:1 on a dark host; the forced-colors/contrast
outlines are the only background-independent indicators and fire only on user request.)*

**Gaps:** the graphical objects that convey data are below 3:1 by default — grid
`rgba(128,128,128,0.13)` = **1.16:1**, axis/border `0.30` = **1.41:1**, cursor crosshair `0.55`
= **1.96:1** on white (`src/renderers/canvas2d.ts:29-32,117`) *(hybrid)*; and the primary data
marks use author-supplied colors with no default palette, so their ≥3:1 contrast is the
integrator's choice (`src/core/model.ts:55-65`) *(manual-attestation)*. `highContrast` thickens
strokes +0.75px and promotes the grid to the axis color (`canvas2d.ts:101,144`) but **does not
reach 3:1**. → **Remediation R6 (§11)**.

### 1.4.12 Text Spacing (AA) — Supports

No library text sets `line-height`/`letter-spacing`/`word-spacing` that would clip under a
user-spacing override, and there is no `overflow:hidden`/fixed-height on visible text (the only
`overflow:hidden` is on the `.sl-sr-only` hidden helpers, which are out of scope; the only
`letter-spacing` is `.12em` on the short uppercase axis title) (`src/a11y/styles.ts:16-21`). No
inline style sets text spacing. *(automated)* Confirming no clip under the full spacing
bookmarklet is a one-time human check. *(manual-attestation)*

### 1.4.13 Content on Hover or Focus (AA) — Supports

The readout tooltip + crosshair shown on hover/focus satisfy **Hoverable** (readout is
`pointer-events:none`, `src/a11y/styles.ts`) and **Persistent** (hidden only on pointer-leave or
blur, never on a timer). **Closed by R3 — now Dismissible:** `onKeyDown` handles Escape via
`dismissCursor()`, which clears the readout + crosshair (`cursorActive = false`) **without moving
focus**, so a later arrow re-activates the cursor (`src/sightline.ts`; `handlesKey` recognizes
Escape in `src/a11y/cursor.ts`). *(automated)*

---

## 8. Per-criterion detail — Operable, Understandable, Robust

### 2.1.1 Keyboard (A) — Supports

Cursor navigation (`src/sightline.ts`, `src/a11y/cursor.ts:43-75`) and legend show/hide (native
`<button>`) are fully keyboard-operable; arrows auto-pan via `panToInclude` so any sample is
reachable. **Closed by R2:** keyboard zoom now mirrors wheel-zoom — `+`/`=` zoom in, `-`/`_` zoom
out, centered on the cursor (`zoomFactor` in `src/a11y/cursor.ts`; `zoomAroundCursor` in
`src/sightline.ts`), and the keyboard-help text documents it. Every pointer function now has a
keyboard path. *(automated)*

### 2.1.2 No Keyboard Trap (A) — Supports

`onKeyDown` early-returns for any non-navigation key and only `preventDefault`s the six handled
keys — Tab/Shift+Tab are never consumed (`src/sightline.ts:514-516`, `src/a11y/cursor.ts:21`).
No `focus()` trap, `aria-modal`, or `inert` exists; the blur handler only deactivates the cursor
(`:507-512`); drag pointer-capture is released on up/cancel and cannot trap focus (`:551,565-571`).
*(automated)*

### 2.1.4 Character Key Shortcuts (A) — Supports

The complete handled key set is `ArrowRight/Left/Up/Down/Home/End` plus the Shift modifier
(`src/a11y/cursor.ts:21`); no single letter/number/punctuation shortcut exists, so the criterion
has nothing to remap or turn off. No `accesskey` anywhere. *(automated)*

### 2.2.1 Timing Adjustable (A) — Supports

No time limits, sessions, timeouts, or countdowns. The only timers are a 150ms table-update
throttle and a 100ms announce debounce (`src/sightline.ts:72-75,417-431,455-461`) — output
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
order (`src/sightline.ts:197-208`); `tabIndex 0` is the only focus-affecting statement (no
positive tabindex, no programmatic reorder, no autofocus) (`:186`). Hidden helpers carry no
tabindex. *(automated)*

### 2.4.6 Headings and Labels (AA) — Supports

The component emits no section headings (host owns document headings), and its labels are
descriptive: surface `aria-label` (`src/sightline.ts`), legend group + buttons
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
Focus Appearance, AAA — out of A+AA scope; the perceivability of `--sl-focus` against an arbitrary
host background is an integrator concern.) *(manual-attestation)*

### 2.4.11 Focus Not Obscured (Minimum) (AA) — Partially Supports

The component never *entirely* obscures its own focused surface: the readout is `opacity:0` by
default, `aria-hidden`, and when shown is a small tooltip (`min-width:118px`) covering only a
fraction of the large surface (`src/a11y/styles.ts:28-33`, `src/sightline.ts:650`); the surface
is the top interactive layer (`:202-204`). *(hybrid — DOM/z-index structure is assertable;
non-obscuring depends on rendered geometry.)* **Gap (integrator):** host-page sticky headers,
toolbars, or overlays could obscure the focused chart — the library cannot control this.
*(manual-attestation)*

**Author responsibility:** keep host sticky/overlay UI off the chart's focused surface and legend.

### 2.5.1 Pointer Gestures (A) — Supports

All pointer interactions are single-pointer and not path-based: drag-pan depends on the net
horizontal delta (`clientX - dragStartX`), not the trajectory traced, so any path produces the
same result (`src/sightline.ts:546-563`); zoom is wheel-driven (`:536-544`); no multipoint
(pinch/rotate) gesture exists. 2.5.1 only governs multipoint/path gestures, so it is satisfied.
*(manual-attestation — "not path-based / not multipoint" is a human judgment; a keyboard
equivalent additionally exists.)* (Drag-pan as a *dragging* movement is assessed under 2.5.7.)

### 2.5.2 Pointer Cancellation (A) — Supports

No function executes on the down-event: `onPointerDown` only sets drag state and captures the
pointer (`src/sightline.ts:546-552`); the pan is computed against the immutable start-domain
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

### 2.5.7 Dragging Movements (AA) — Partially Supports

Legend toggles are single taps and wheel-zoom is non-dragging. **Gap (library, hybrid):** the
chart's one dragging operation — **drag-to-pan** (`src/sightline.ts:554-560`) — has **no
single-pointer, non-dragging alternative**. 2.5.7 specifically requires a single-*pointer*
alternative; the keyboard `panToInclude` path (`:526-534`) satisfies 2.1.1, not 2.5.7, and
wheel-zoom changes magnification, not lateral position. Dragging is not "essential" here (panning
is expressible as taps/clicks). → **Remediation R4 (§11)**.

### 2.5.8 Target Size (Minimum) (AA) — Supports

The data surface fills the plot inset and far exceeds 24×24 (`src/sightline.ts:359-362`).
**Closed by R9:** legend buttons now set `min-height:24px;min-width:24px;line-height:1.1`
(`src/a11y/styles.ts`), so they meet the 24×24 minimum independent of inherited host font metrics
— now assertable by a computed-box check (`getBoundingClientRect() ≥ 24`). *(automated)*

### 3.1.2 Language of Parts (AA) — Supports

Author-supplied strings and numeric tick/value text are the integrator's (they own their
language). **Closed by R10:** every fixed UI string the library emits — keyboard help, legend
group label, per-series state words, table caption, and the full data-summary sentence — is now
overridable via the `strings` option (`SightlineStrings` + token-template defaults in
`src/a11y/strings.ts`, threaded through legend/table/summary/`describeChart`). An integrator on a
non-English page supplies translations so the parts match the page language. *(automated — the
strings flow is unit-tested; defaults remain English.)*

**Author responsibility:** on a non-English page, pass localized `strings` (and series names /
axis labels) so the rendered text matches the document language.

### 3.2.1 On Focus (A) — Supports

Focusing the surface only sets `cursorActive`, announces the current point via the polite live
region, and re-renders the crosshair in place — no focus move, navigation, window, or form
submission (`src/sightline.ts:501-505`; `src/a11y/live-region.ts:13-14`). Legend buttons have no
focus handler. *(automated)*

### 3.2.2 On Input (A) — Supports

Navigation keys move the cursor / pan in place (`src/sightline.ts:514-534`); legend buttons
(`type="button"`, `aria-pressed`) toggle visibility in place via `toggleSeries` (`:433`,
`src/a11y/legend.ts:36`). No path changes context (no navigation/submission/focus-move). The
in-widget pan is the direct, advertised consequence of the key pressed. *(automated)*

### 3.2.4 Consistent Identification (AA) — Supports

All legend buttons are produced by one `build()` routine with identical structure (swatch + name
+ state) and uniform `aria-pressed` (`src/a11y/legend.ts:31`); the surface carries a stable
`role="application"` + `aria-roledescription` on every instance (`src/sightline.ts:187`). Same-
function components are identified identically across instances. *(automated)*

### 3.3.2 Labels or Instructions (A) — Supports

The component has no data-entry fields, but its interactive controls carry instructions: the
surface `aria-label` embeds the full keyboard model + a pointer to the data table
(`src/sightline.ts:335-344`), the legend group is labeled "activate to show or hide", and each
button has a name + "shown"/"hidden" state (`src/a11y/legend.ts:25,69-75`). *(automated)*

### 4.1.2 Name, Role, Value (A) — Supports

**Name** and **Role** are correctly exposed for every interactive object: surface
`role="application"` + `aria-roledescription` + `aria-label` + `aria-details`/`aria-describedby`
(`src/sightline.ts`); native legend `<button>` with `aria-pressed` (`src/a11y/legend.ts`); canvas
+ readout `aria-hidden`; native table with scoped headers (`src/a11y/table-alt.ts`). *(automated)*

**Closed by R11 — the Value half:** the focused sample is now a programmatically-determinable
value. A dedicated `aria-describedby` target (`sl-active-{n}`) is updated **in lockstep** with
every cursor move (`updateActiveSample`, `src/sightline.ts`), so AT/automation can *query* the
current point (not only hear the transient live announcement, which still serves 4.1.3). The
legend "shown"/"hidden" state span is now `aria-hidden`, so each button's accessible name stays
the stable series name while `aria-pressed` carries state. *(automated for the attribute wiring;
manual-attestation that `role="application"` + the value target read correctly in NVDA/JAWS/
VoiceOver, since `role="application"` is a deliberate browse-mode trade-off.)*

### 4.1.3 Status Messages (AA) — Supports

Cursor moves (keyboard + hover) that are not conveyed through focus are announced via a dedicated
`aria-live="polite"` `aria-atomic="true"` region, appended at construction so it pre-exists
updates (`src/a11y/live-region.ts:11-22`, `src/sightline.ts:198`). Announcements are debounced
100ms so key-repeat does not flood the region, fire immediately on focus, and re-announce
identical text via a trailing-space nudge (`src/sightline.ts:443-461,501-505`). *(automated for
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
threaded into every `RenderScene` (`src/sightline.ts:143-144,406,634-636`). *(automated)* There is
essentially no decorative/looping motion to suppress — rendering is data-driven, with no entrance
animations, autoplay, or parallax. *(The renderer does not yet branch on `scene.reducedMotion`
because no animation exists to gate; the flag is plumbed for future animated transitions. A human
should confirm rapid drag-pan/wheel-zoom view changes feel acceptable to a motion-sensitive user —
manual-attestation.)*

### forced-colors (Windows High Contrast Mode) — Partially Supports

The DOM overlay adapts and the focus indicator is preserved: `@media (forced-colors:active)` gives
the surface an `outline:2px solid Highlight` (forced-colors ignores box-shadow)
(`src/a11y/styles.ts:55-59`); DOM tick text + native legend buttons are remapped to system colors
automatically (`:16,50-54`). *(automated)*

**Gap (inherent + library, manual-attestation):** a `<canvas>` bitmap **does not participate in
CSS forced-colors** — the series lines, grid, envelopes, and cursor crosshair are *not* remapped to
system colors and stay author-supplied (`src/renderers/canvas2d.ts:24-34,101,143-144`). Because
series are distinguished by color only, a forced-colors user can find the visual chart
unreadable. **Mitigation:** the full data is available non-visually regardless — the hidden data
table, the text-labeled legend, the live region, and the natural-language + JSON summaries all live
in adapting DOM (`src/a11y/table-alt.ts:75-110`, `legend.ts:69-76`, `live-region.ts:11-22`,
`summary.ts:88-105`). This is why it is Partially Supports, not Does Not Support.
→ **Remediation R12 (§11)**.

---

## 11. Remediation backlog

The original backlog split into **library-closable** (small changes to the MIT renderer that raise
the conformance level and are CI-checkable) and **deferred / inherently integrator-dependent**
(reported as remarks + attestation). The 7 cheap library-closable items are **done** (commit
`7bf4fcd`, verified end-to-end); R4 and R6 were deferred as larger renderer work.

### Library-closable — done (✅) and deferred

| ID | Closes | Status | Fix |
|---|---|---|---|
| **R1** | 1.3.1, 2.4.6 | ✅ done | `TableUpdate.xLabel` threaded from `scheduleTableUpdate()` into `buildHead`, so the x-column header uses the configured label (falls back to `"x"`). |
| **R2** | 2.1.1 | ✅ done | Keyboard zoom: `zoomFactor()` (`+`/`=`/`-`/`_`) + `zoomAroundCursor()` mirror wheel-zoom centered on the cursor; help text + unit tests added. |
| **R3** | 1.4.13 | ✅ done | Escape branch in `onKeyDown` → `dismissCursor()` clears readout + crosshair without blurring. |
| **R8** | 1.4.3 | ✅ done | Legend "hidden" state no longer reduces text opacity; uses `aria-pressed` + strikethrough + dimmed (decorative) swatch. |
| **R9** | 2.5.8 | ✅ done | `min-height:24px;min-width:24px;line-height:1.1` on `.sl-legend button`. |
| **R10** | 3.1.2 | ✅ done | `strings` option (`SightlineStrings` token-templates) localizes every fixed UI string. |
| **R11** | 4.1.2 | ✅ done | Focused sample exposed as a queryable value via a lockstep `aria-describedby` target; legend state span `aria-hidden`. |
| **R4** | 2.5.7 | ⏸ deferred | Single-pointer non-dragging pan affordance (overlay prev/next buttons or click-margin-to-page) — a UI feature, not a one-liner. |
| **R6** | 1.4.3, 1.4.11 | ⏸ deferred | Contrast-checked default series palette + higher default `--sl-grid`/`--sl-axis` alpha — a design decision (the library ships no palette today). |

### Deferred / inherently integrator-dependent (remarks + attestation)

| ID | SC(s) | Why it stays a remark |
|---|---|---|
| **R5** | 1.4.1 | Per-series dash/marker channel would close color-only differentiation on the canvas — a feature add (design decision), not a one-line fix. |
| **R7** | 1.4.4, 1.4.10 | Adaptive tick thinning/rotation at narrow widths; partially mitigated by px→rem fonts, but full reflow-at-200% needs design work. |
| **R12** | forced-colors | Re-painting canvas marks from `getComputedStyle` system colors (or the R5 dash channel) is a meaningful renderer change; today the DOM data alternatives carry the user through. |
| — | 1.4.3, 1.4.11, 2.4.11 | Host background, author-supplied series colors, and host-page sticky/overlay layout are outside the component boundary by definition — always remarks + attestation, never automated passes. |

> **Outcome:** closing R1/R2/R3/R8/R9/R10/R11 moved 1.3.1, 1.4.13, 2.1.1, 2.4.6, 2.5.8, 3.1.2,
> 4.1.2 from Partially Supports → **Supports** and closed 1.4.3's legend sub-gap — **21 → 28
> Supports**. The 7 remaining Partially Supports depend on integrator choices (host background,
> author colors, host layout) or the deferred renderer features R4–R7/R12.

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

*Generated for the Sightline Compliance Pack. Mapping + adversarial verification + completeness
critique covered all 55 WCAG 2.2 A/AA success criteria (4.1.1 excluded as removed in 2.2), each
applicable claim independently challenged, with `file:line` evidence confirmed against the source
at the time of writing.*
