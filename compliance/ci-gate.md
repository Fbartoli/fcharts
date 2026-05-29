# Compliance Pack — CI Accessibility Gate Contract

> **Document 4 of 4.** Defines the `sightline-audit` CLI and the GitHub Action that run the
> conformance engine (document 3) on every commit, **fail the build on any regression** below the
> committed baseline (document 1), and (re)generate the ACR (document 2). This is the durable moat
> the free renderer deliberately omits: proof that charts *stay* accessible.

## 1. What the gate does

On each run it:

1. Builds the chart under test from a **fixture** (the integrator's real configured chart, or the
   bundled demo fixture).
2. Runs `runConformance` (document 3) against it in headless Chromium.
3. Reduces checks to `CriterionVerdict[]` and compares `observed` vs. the committed **baseline**
   (the evidence-map data shipped with the version).
4. **Exits non-zero if any `regression: true`** — a criterion dropped below its asserted level, or
   a new axe-serious violation appeared.
5. Writes/refreshes the ACR (`acr-<edition>.{md,html,json}`) and a machine-readable
   `audit-report.json`.

The gate enforces only the **automated** + automatable-half-of-**hybrid** rows (document 3 §5).
Manual-attestation rows are never failed by CI — they live in the ACR's signature block.

## 2. `sightline-audit` CLI

Shipped from the Compliance Pack entry (`src/compliance/`), **not** the core chart bundle. Run via
`npx sightline-audit` or a `bin` entry.

```
sightline-audit [options]

  --fixture <path>      Module exporting `mountChart(el) => () => void` (build + teardown).
                        Default: the bundled demo fixture (Sightline with sample data).
  --edition <key>       en301549 | wcag | section508   (repeatable). Default: en301549.
  --baseline <path>     Committed evidence-map JSON to diff against.
                        Default: the version's bundled baseline.
  --out <dir>           Output directory for ACR + audit-report.json. Default: ./compliance-out.
  --background <css>    Documented host background for hybrid contrast checks. Default: #ffffff.
  --attest <path>       Attestation file (signer, date, per-row sign-off) → marks the ACR "signed";
                        without it the ACR carries a DRAFT watermark (document 2 §4).
  --format <list>       md,html,json (comma-sep). Default: all three.
  --stamp <iso>         Timestamp to embed (CI passes ${GITHUB_RUN}'s commit date) — keeps output
                        deterministic; the pure generator never reads the clock.
  --update-baseline     Write observed verdicts back to the baseline (deliberate, reviewed change;
                        never used by the gate job — only by a human raising the baseline).
  --json                Print the audit-report JSON to stdout (for piping).
  --quiet               Suppress the table; exit code only.

Exit codes:
  0  no regressions (gate passes)
  1  one or more regressions (gate fails) — the offending criteria + checks are printed
  2  harness/setup error (could not build fixture, browser missing, etc.) — distinct from a
     conformance failure so CI can tell "broken" from "regressed"
```

Console output: the per-edition tally, then a table of any regressions
(`SC | expected | observed | failing check | detail`), then the path to the written ACR. On
success, a one-line green summary (`✓ 28 Supports / 7 Partially / 20 N/A — no regressions`).

### Fixture contract

```ts
// fixture.ts
import { Sightline } from 'sightline';
export function mountChart(el: HTMLElement): () => void {
  const chart = new Sightline(el, { /* the integrator's real config + representative data */ });
  return () => chart.destroy();
}
```

Auditing the integrator's *own* configured chart (their colors, labels, locale, data shape) is the
point — it catches *their* regressions (a teammate hardcodes a low-contrast series color, removes
`xLabel`, drops the legend), not just the library's.

## 3. GitHub Action

A reusable workflow + a worked example committed in task 21. Sketch:

```yaml
# .github/workflows/a11y-gate.yml
name: Accessibility gate
on: [pull_request, push]
jobs:
  sightline-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium   # dev/peer dep, CI-only
      - run: npx sightline-audit --fixture ./a11y/fixture.ts --edition en301549 --out ./compliance-out
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: accessibility-conformance-report, path: ./compliance-out }
      # Step fails the job (exit 1) on any regression → the PR is blocked.
```

Properties:

- **Blocks the PR** on a conformance regression (exit 1), exactly like a failing test — turning
  "charts stay accessible" into an enforced invariant, not a hope.
- **Publishes the ACR** as a build artifact every run, so the always-current VPAT is a click away
  (the GTM "always-current VPAT" promise — `GTM.md`).
- **Playwright/Chromium are installed in CI only** — never a runtime dependency of the shipped
  renderer.
- Optional: a PR-comment step posting the tally + any regression diff (kept optional to avoid a
  token/permissions dependency; the artifact + the failing check are sufficient).

## 4. The injected-regression demo (task 19 acceptance)

To prove the gate works, task 19 demonstrates it **catching a planted regression** end-to-end:

1. Baseline run on the real renderer → exit 0, ACR shows 28 Supports.
2. Inject a regression on a branch — e.g. revert one remediation: drop `xLabel` threading (R1) so
   the table x-header is `"x"` again, **or** remove the legend `min-height` (R9), **or** re-add the
   `opacity:.45` legend dim (R8).
3. Re-run `sightline-audit` → the corresponding check (`table-x-header` / `target-size` /
   `contrast-default-text`) goes `fail`, the reducer flags `regression: true`, the CLI exits 1,
   and the printed table names the SC (1.3.1/2.4.6, 2.5.8, or 1.4.3) and the failing check.
4. Revert the injection → exit 0 again.

This is the concrete artifact the design-partner conversation needs: *"here is the gate failing the
moment a chart stops being accessible, and the VPAT it regenerates."*

## 5. Configuration & provenance

- Config may come from CLI flags or a `sightline-audit.config.{js,json}` (flags win). Keep it
  minimal — no config framework dependency.
- Every `audit-report.json` and ACR records: Sightline version, commit SHA (from `GITHUB_SHA` or
  `git rev-parse`), edition, evaluation date (`--stamp`), tool versions (axe-core, Playwright),
  background used for hybrid contrast, and which rows were automated vs. attested.
- The gate is **deterministic** for a fixed (fixture, baseline, stamp): same input → byte-identical
  ACR, so the artifact diffs cleanly between versions and a buyer's GRC tool can track changes.

## 6. Boundaries & non-goals

- The gate **never auto-raises** the baseline (document 3 §5 rule 5). Closing a partial (e.g. R4)
  is a reviewed human change to the evidence-map data, not a CI side effect.
- The gate enforces the **chart-layer** scope only (document 1 §1). It is not a whole-page scanner;
  it deliberately does the one thing a whole-page scanner does badly — prove a *complex interactive
  component* stays per-point accessible.
- No new runtime dependencies: Playwright and axe-core are **dev/peer** deps used by the audit
  tooling; the shipped `sightline` renderer remains zero-runtime-dependency.

## 7. What this unblocks

- **Task 17** extracts `runConformance` + the pure helpers into `src/compliance/`.
- **Task 19** implements the `sightline-audit` CLI + the Action and runs the §4 injected-regression
  demo.
- **Task 21** commits the worked `a11y-gate.yml` example + a fixture + the generated sample ACR.
