# Sample Accessibility Conformance Report (ACR)

These files are an **auto-generated chart-layer ACR** for fcharts, produced by the
`fcharts-audit` CI gate from a real passing run against [`a11y/fixture.ts`](../../a11y/fixture.ts):

| File | What |
|---|---|
| [`acr-en301549.md`](./acr-en301549.md) | EN 301 549 (EU / EAA) edition — readable Markdown. |
| [`acr-en301549.html`](./acr-en301549.html) | Self-contained HTML (printable to PDF, emailable to procurement; embeds the JSON model). |
| [`acr-en301549.json`](./acr-en301549.json) | The machine-readable model (for GRC tools, diffing between versions, agents). |

**This is the procurement lead magnet:** a geography-correct, per-criterion conformance report for
the chart layer, generated — not hand-written — from the committed evidence map
([`../scope-and-evidence-map.md`](../scope-and-evidence-map.md)). Baseline: **33 Supports / 2
Partially Supports / 20 Not Applicable** across the 55 WCAG 2.2 Level A + AA success criteria.

## Why it says "DRAFT"

The report is intentionally **unsigned (DRAFT)**. The generator refuses to fabricate the human
attestations — real screen-reader behavior (NVDA/JAWS/VoiceOver) and integration-context checks
(host background behind the text, host page layout/scroll) — that no machine can soundly prove. Those rows are listed under *Attestation*; a real auditor signs them
with `--attest`, which lifts the DRAFT watermark. Honest by construction: the same reason the
validation MVP refused to call "passes axe" the same thing as "accessible"
([`../../FINDINGS.md`](../../FINDINGS.md) caveat #1).

## Regenerate

```sh
npx playwright install chromium
node src/compliance/cli.ts --fixture ./a11y/fixture.ts --edition en301549 --out ./compliance/samples
# add --edition wcag --edition section508 for the other editions
# add --attest ./attestation.json (e.g. {"signer":"A. Auditor, CPACC","date":"2026-06-01"}) to sign
```

The gate exits non-zero if the chart ever drops below the baseline — see
[`../ci-gate.md`](../ci-gate.md) and [`.github/workflows/a11y-gate.yml`](../../.github/workflows/a11y-gate.yml).
