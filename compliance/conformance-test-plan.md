# Compliance Pack — Conformance Test Plan & Pass→Conformance Mapping

> **Document 3 of 4.** Specifies the **conformance engine**: the battery of automated checks run
> against a live Sightline instance, the dependency-free contrast math, and the rules mapping each
> check result to a WCAG criterion verdict from [`scope-and-evidence-map.md`](./scope-and-evidence-map.md).
> The engine is extracted from `bench/harness.ts` into `src/compliance/` (task 17); this document
> is its contract. It is the machinery that keeps the ACR (document 2) and the CI gate (document 4)
> honest and current.

## 1. Principle: checks attest to claims, claims drive the ACR

The validation MVP's headline lesson (`FINDINGS.md` caveat #1): **axe-clean ≠ accessible**. So the
engine does not ask "are there axe violations?" and stop. For every WCAG criterion the evidence
map marks **automated** or **hybrid**, the engine runs a concrete check that *re-proves the
specific claim* on a live chart. The map says what's true; the engine proves it stays true; the
ACR reports it; the CI gate fails if a proof breaks.

Three outcomes per check: **pass** (claim holds), **fail** (regression — the gate fails, the ACR
would change), **n/a** (the check doesn't apply to the configured chart).

## 2. Execution model

- The engine drives a **live Sightline instance** in a real browser via **Playwright** (a
  **dev/peer dependency only — never in the shipped core**, per the standing decision). This is
  the only way to test *functional* a11y (focus, keypress, computed styles, find-in-page) — the
  exact gap axe can't see.
- It reuses the existing `bench/harness.ts` plumbing: Vite dev server + Playwright page + scoped
  `axe.run`, the `liveRegionChangesOnArrow` keyboard probe, and the real `window.find()`
  find-in-page checks.
- **Pure helpers** (contrast math, the SC→check mapping table, the conformance reducer) live in
  `src/compliance/` with **no browser dependency** and are unit-tested under `node:test` (task 20).
  Only the page-driving layer needs Playwright.
- The engine takes a **chart factory** (how to build the Sightline instance under test) so it can
  audit *any* integrator's configured chart, not just the bench fixture. The CLI (document 4)
  accepts a user-supplied fixture.

## 3. Check catalog

Each check declares the SC(s) it serves and the verification class. `R*` ids reference the
remediations already landed (document 1, §11).

| Check id | Asserts | Serves SC | Class | Source |
|---|---|---|---|---|
| `axe-serious` | 0 serious/critical axe violations scoped to `.sl-root` | (necessary baseline) | automated | harness |
| `canvas-hidden` | the `<canvas>` has `aria-hidden="true"` | 1.1.1, 4.1.2 | automated | new |
| `text-alternative` | a `<table>` with `<caption>`, `<th scope=col/row>`, ≥10 rows exists | 1.1.1, 1.3.1 | automated | harness (extended) |
| `table-x-header` | first `<th>` text === configured `xLabel` (R1) | 1.3.1, 2.4.6 | automated | new |
| `surface-semantics` | surface has `role=application` + `aria-roledescription` + non-empty `aria-label` + `aria-details` + `aria-describedby` | 1.1.1, 4.1.2 | automated | new |
| `legend-semantics` | legend is `role=group`; each control `<button type=button>` with `aria-pressed`; state span `aria-hidden` (R11) | 1.3.1, 4.1.2 | automated | new |
| `live-region-present` | `[aria-live=polite][aria-atomic=true]` exists inside the surface before updates | 4.1.3 | automated | new |
| `keyboard-announce` | focus → `End`/`ArrowLeft` changes the live-region text (`liveRegionChangesOnArrow`) | 2.1.1, 4.1.3 | automated | harness |
| `keyboard-zoom` | `+` / `-` change the visible domain (ticks change) (R2) | 2.1.1 | automated | new |
| `escape-dismiss` | after focus, `Escape` removes `.sl-show` and keeps focus on the surface (R3) | 1.4.13 | automated | new |
| `active-value` | the 2nd `aria-describedby` target is populated on focus, cleared on Escape (R11) | 4.1.2 | automated | new |
| `no-keyboard-trap` | focus enters, `Tab`/`Shift+Tab` leave the surface and legend | 2.1.2 | automated | new |
| `label-in-name` | each legend button's accessible name contains its visible label (axe `label-in-name`) | 2.5.3 | automated | axe rule |
| `target-size` | every `.sl-legend button` `getBoundingClientRect()` ≥ 24×24 (R9) | 2.5.8 | automated | new |
| `tick-findable` | `window.find()` locates a visible axis tick label | 1.4.5, 1.3.1 | automated | harness |
| `no-canvas-text` | source assertion: no `fillText`/`strokeText` in the renderer | 1.4.5 | automated | new (static) |
| `contrast-readout` | readout fg/bg computed ratio ≥ 4.5:1 (library-controlled pair) | 1.4.3 | automated | new |
| `contrast-default-text` | tick/axis/body text ≥ 4.5:1 (≥3:1 large) against a **documented test background** | 1.4.3 | hybrid | new |
| `reduced-motion-rule` | a `@media (prefers-reduced-motion:reduce)` rule exists and the only transition is gated by it | 2.2.2, reduced-motion | automated | new |
| `forced-colors-rule` | a `@media (forced-colors:active)` focus-outline rule exists | 2.4.7, forced-colors | automated | new |
| `focus-visible` | a `:focus-visible` indicator exists; no `outline:none` on legend buttons | 2.4.7 | automated | new |
| `i18n-strings` | a non-default `strings` option propagates into legend/caption/summary text (R10) | 3.1.2 | automated | new |

### New checks vs. reused

Reused verbatim from the harness: `axe-serious`, `keyboard-announce`, `tick-findable` (and the
text-alternative shape). Everything else is new in the engine, but most are simple DOM/computed-
style assertions of the kind already proven feasible by the one-off remediation verifier (which
exercised `table-x-header`, `target-size`, `escape-dismiss`, `keyboard-zoom`, `active-value`).

## 4. Contrast math (dependency-free)

WCAG contrast is a tiny, well-specified computation — hand-rolled, no dependency (consistent with
the project's minimal-deps stance). Implemented in `src/compliance/contrast.ts`, unit-tested:

```
relativeLuminance(rgb):                       # WCAG 2.x definition
  for each channel c in [r,g,b], cs = c/255
  lin = cs <= 0.03928 ? cs/12.92 : ((cs+0.055)/1.055) ** 2.4
  L = 0.2126*lin_r + 0.7152*lin_g + 0.0722*lin_b

contrastRatio(fg, bg):
  (max(Lfg,Lbg) + 0.05) / (min(Lfg,Lbg) + 0.05)     # 1..21

# Alpha compositing for low-opacity colors (grid lines, faded text) over a known background:
composite(fgRGBA, bgRGB) = fg.rgb*fg.a + bg.rgb*(1-fg.a)
```

Inputs: parse `#rgb`/`#rrggbb`/`rgb()`/`rgba()` → `{r,g,b,a}` (a small hand-written parser; the
engine also reads **computed** colors from the live page via `getComputedStyle`, which returns
`rgb()/rgba()`). Thresholds: **4.5:1** normal text, **3:1** large text (≥18.66px bold or ≥24px) and
non-text/UI. The engine knows each measured element's font-size to pick the threshold.

Honesty boundary (from document 1): contrast is only an **automated** pass for **fully
library-controlled** pairs (the readout, `#f9fafb` on `#111827`). For DOM text on a transparent
surface it is **hybrid** — checked against a *documented test background* the gate configures, with
the remark stating the result is conditional on the host background. Author series-color contrast
is **manual-attestation** (the library ships no palette).

## 5. Pass → conformance mapping

The engine produces a `CheckReport`; a pure reducer folds checks into per-criterion verdicts and
compares them to the **expected** verdicts from the evidence map. The gate's contract:

```ts
interface CheckResult { id: string; status: 'pass' | 'fail' | 'na'; detail: string; sc: string[]; }
interface CheckReport { results: CheckResult[]; axeViolations: AxeViolation[]; }

interface CriterionVerdict {
  num: string;
  expected: Conformance;     // from the evidence map (the committed baseline)
  observed: Conformance;     // derived from this run's checks
  regression: boolean;       // observed is weaker than expected
  checks: CheckResult[];
}
```

Mapping rules (the reducer):

1. **A criterion marked `Supports`+`automated`** must have **all** its serving checks `pass`.
   Any `fail` ⇒ `observed = 'Partially Supports'` (or worse) ⇒ **regression = true**.
2. **A criterion marked `Partially Supports`** must keep its *automated portion* passing (e.g.
   1.4.3's `contrast-readout` must stay ≥4.5:1). A fail there is a regression *below* the baseline.
   Its attested portion is unaffected by the engine.
3. **A criterion marked `manual-attestation`** has no engine check; `observed = expected`, never a
   regression source. It surfaces only in the ACR attestation block.
4. **`axe-serious` failing** is always a regression (it can introduce a brand-new violation on any
   SC); the violating rule ids are reported and mapped to their SCs where axe provides the mapping.
5. The reducer **never upgrades** a baseline (an engine can't prove "manual" items); it only
   confirms or flags regressions. Improving a baseline is a deliberate edit to the evidence-map
   data + this plan, not an automatic side effect.

This makes the relationship precise: **the evidence map is the asserted baseline; the engine is the
proof the code still meets it; a `regression: true` is exactly what the CI gate blocks** (document
4). An *improvement* (e.g. closing R4) is a human change to the baseline, reviewed like any code.

## 6. Engine API (contract for task 17)

```ts
// Pure (node:test-unit-tested, no browser):
relativeLuminance(rgb): number
contrastRatio(fg, bg): number
parseColor(css: string): Rgba
reduceToVerdicts(report: CheckReport, baseline: CriterionRow[]): CriterionVerdict[]
SC_CHECKS: Record<string, string[]>     // SC → check ids that serve it (the map in §3)

// Browser-driving (Playwright; dev/peer dep):
runConformance(page, sel, opts): Promise<CheckReport>   // runs the §3 catalog against `sel`
```

`runConformance` is what `bench/harness.ts` becomes a thin caller of (task 17 extracts the shared
checks so the bench and the audit CLI share one implementation — no drift between "the benchmark
says accessible" and "the ACR says accessible").

## 7. Test strategy (task 20)

- **Unit (node:test, no deps):** `contrastRatio`/`relativeLuminance` against the WCAG reference
  pairs (black/white = 21:1, the documented Sightline pairs); `parseColor` for hex/rgb/rgba;
  `reduceToVerdicts` for each mapping rule (a failing check downgrades; a passing set confirms; a
  manual item never regresses; axe-serious always regresses).
- **Integration (Playwright):** `runConformance` against (a) the real Sightline (expect every
  automated check `pass`, 0 regressions vs. baseline) and (b) an **intentionally broken** chart —
  the injected-regression demo of document 4 (expect the specific check to `fail` and the gate to
  exit non-zero).

This is the substrate the CI gate (`sightline-audit`) and the ACR generator both build on.
