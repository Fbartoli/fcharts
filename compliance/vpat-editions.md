# Compliance Pack — VPAT/ACR Format & Editions

> **Document 2 of 4.** Defines the single JSON model the generator consumes, the three output
> formats (Markdown + HTML + JSON, all dependency-free), and the three VPAT **editions**
> (EN 301 549 first, then WCAG-INT, then US 508). The conformance data itself comes from
> [`scope-and-evidence-map.md`](./scope-and-evidence-map.md) (document 1); this document is about
> *packaging* that data into a recognized **Accessibility Conformance Report (ACR)**.

## 1. VPAT vs. ACR — what we generate

- A **VPAT®** (Voluntary Product Accessibility Template, ITI) is the *blank* template.
- An **ACR** (Accessibility Conformance Report) is a *completed* VPAT — a VPAT filled in for a
  specific product version. Procurement asks for "a VPAT" but means an ACR.

The generator emits **ACRs**: a completed report for a stated fcharts version, per edition. We
follow the structure and vocabulary of **VPAT® 2.5** so the output is recognizable to a
procurement/legal reviewer without explanation.

## 2. Editions (priority order)

ITI publishes the VPAT in four editions; we generate three, leading with the EU one (GTM
beachhead — see `GTM.md`). Every edition shares the **WCAG core** (document 1); they differ in
which *additional* standard tables and functional-performance sections they carry.

| Edition key | Title | Referenced standard | Extra tables beyond WCAG |
|---|---|---|---|
| `en301549` | **VPAT 2.5 EU** | EN 301 549 (the EAA harmonized standard) | Ch. 4 Functional Performance Statements; Ch. 5 Generic; Ch. 9 Web (= WCAG); Ch. 11 Software (where applicable); Ch. 12 Documentation & Support |
| `wcag` | **VPAT 2.5 WCAG** (a.k.a. WCAG-INT) | WCAG 2.2 A + AA | none — WCAG tables only |
| `section508` | **VPAT 2.5 508** | Revised Section 508 | Ch. 3 Functional Performance Criteria; 502/503/504 Software (where applicable) |

A fourth combined **INT** edition (all three at once) is trivial to add later by unioning the
tables; not built first.

### What "applicable" means for a chart **component**

fcharts is a web UI component, not a whole product or a piece of authoring/OS software. So:

- **WCAG / EN 301 549 Ch. 9 / 508 web** — the substance (document 1). Always present.
- **Functional Performance** (EN 301 549 Ch. 4 / 508 Ch. 3) — *derived*, not independently
  re-tested: each functional statement (without vision, without perception of color, without
  hearing, with limited manipulation, etc.) is answered by cross-referencing the WCAG criteria
  that serve it, plus the honest caveats (e.g. "without perception of color" cites 1.4.1's
  Partially Supports + the data-table alternative). The generator computes these from the WCAG
  rows so they can never silently contradict the per-criterion claims.
- **Software (EN 301 549 Ch. 11 / 508 502–503)** — *mostly Not Applicable* for a chart component
  embedded in a host page (closed functionality, AT interoperability, platform accessibility
  services are the host/runtime's domain). The few that touch the component (e.g. 11.5.2.x
  name/role/value, keyboard) are already covered by the WCAG 4.1.2 / 2.1.1 rows; the generator
  marks the rest "Not Applicable — component does not implement platform software features."
- **Documentation & Support (EN 301 549 Ch. 12 / 508 602–603)** — the ACR itself plus the
  README/llms.txt accessibility section satisfy "accessibility documentation available"; marked
  Supports with a pointer, or Not Evaluated where it's the vendor's process (support channels).

The generator never *invents* a pass for a non-WCAG clause: each is either derived from WCAG
rows, marked Not Applicable with a reason, or marked **Not Evaluated** (an honest fourth state
for clauses outside an automatable component scope) — see §4.

## 3. The JSON model (the single source the generator reads)

One typed object drives all three formats and all three editions. It is dependency-free JSON;
the generator is pure string templating over it. (Implemented in `src/compliance/` in task 17–18;
this is the contract.)

```ts
/** A completed ACR, ready to render to MD / HTML / JSON. */
interface AcrModel {
  product: ProductInfo;
  edition: EditionInfo;              // which edition this report is for
  evaluation: EvaluationInfo;        // methods, date, evaluator
  /** The WCAG core, in SC order — sourced verbatim from the evidence map. */
  criteria: CriterionRow[];
  /** Edition-specific extra tables (functional performance, software, docs). Derived. */
  sections: ReportSection[];
  summary: ConformanceTally;         // counts per level, computed (not hand-entered)
  legal: string;                     // standard disclaimer text
  generatedAt: string;               // ISO; injected by the caller (scripts can't read the clock)
}

interface ProductInfo {
  name: string;            // "fcharts"
  version: string;         // from package.json
  description: string;     // one line
  url?: string;            // repo / docs
  componentScope: string;  // the §1 boundary statement from document 1
}

interface EditionInfo {
  key: 'en301549' | 'wcag' | 'section508';
  title: string;                 // "VPAT® 2.5 EU"
  standards: string[];           // human-readable list of referenced standards
  wcagVersion: '2.2';            // the map is 2.2; editions referencing 2.0/2.1 use the subset
  wcagSubset: 'A+AA';
}

interface EvaluationInfo {
  methods: string[];     // e.g. ["automated axe-core scan", "functional keyboard/live-region
                         //       probes", "computed contrast", "manual screen-reader attestation"]
  notes: string;         // how automated vs. attested map to the columns
  evaluator?: string;    // org/person; optional
}

type Conformance = 'Supports' | 'Partially Supports' | 'Does Not Support' | 'Not Applicable'
                 | 'Not Evaluated';

type Verification = 'automated' | 'hybrid' | 'manual-attestation';

interface CriterionRow {
  num: string;                 // "1.4.11"
  name: string;                // "Non-text Contrast"
  level: 'A' | 'AA';
  conformance: Conformance;
  /** The VPAT "Remarks and Explanations" cell — prose, honest, integrator-responsibility split. */
  remarks: string;
  /** Drives the CI-gate-vs-attestation split; surfaced as a tag in the remarks. */
  verification: Verification;
  /** Whether a human attestation line is required before this report is "signed". */
  attestationRequired: boolean;
  evidence: EvidenceRef[];     // file:line refs + what they show (from the map)
}

interface EvidenceRef { detail: string; ref?: string; }

interface ReportSection {        // an edition-specific table (functional perf, software, docs)
  id: string;                    // "fp" | "software" | "docs"
  title: string;                 // "Chapter 4: Functional Performance Statements (EN 301 549)"
  intro?: string;
  rows: SectionRow[];
}
interface SectionRow {
  id: string;                    // clause id, e.g. "4.2.1" or "FPC-without-vision"
  name: string;
  conformance: Conformance;
  remarks: string;
  derivedFrom?: string[];        // SC numbers this row's verdict is computed from (auditable)
}

interface ConformanceTally {
  byLevel: Record<'A' | 'AA', Record<Conformance, number>>;
  total: Record<Conformance, number>;
}
```

### Building the model

1. Load the **criteria** from the evidence-map data (task 17 transcribes document 1 into a typed
   array — that array *is* `CriterionRow[]` minus the edition framing).
2. Filter to the edition's WCAG subset (all three editions use A+AA; 508/EN-301-549 historically
   reference 2.0/2.1, which are subsets of our 2.2 map — the extra 2.2-only SCs are reported as
   additional assurance, clearly labelled).
3. Compute `sections` per edition (functional-performance & software & docs) by **deriving** from
   the WCAG rows (never re-stating a verdict that contradicts them).
4. Compute `summary` by counting — never hand-entered.
5. Inject `generatedAt` from the caller (workflow scripts and the CLI pass a timestamp; the pure
   generator does not read the clock, so output is deterministic for a fixed input + stamp).

### Functional-Performance derivation (the honest cross-reference)

Each functional-performance statement maps to a set of WCAG SCs; its conformance is the
**weakest** of those (so a Partially-Supports SC can't hide behind a Supports sibling), with the
remark naming the contributing SCs and any alternative:

| FP statement (EN 301 549 Ch. 4 / 508 Ch. 3) | Derived from | Typical result |
|---|---|---|
| Usage without vision | 1.1.1, 1.3.1, 2.1.1, 4.1.2, 4.1.3 | Supports (keyboard + SR + data table) |
| Usage with limited vision | 1.4.4, 1.4.10, 1.4.11, 1.4.3 | Partially Supports (zoom/contrast caveats) |
| Usage without perception of color | 1.4.1 | Partially Supports (canvas color-only; data table is the alt) |
| Usage without hearing / with limited hearing | (no audio) | Supports / Not Applicable |
| Usage with limited manipulation | 2.1.1, 2.5.1, 2.5.7, 2.5.8 | Partially Supports (drag-pan single-pointer alt deferred — R4) |
| Usage with limited reach/strength | 2.5.8 | Supports |
| Minimize photosensitive triggers | 2.3.1 | Supports |
| Usage with limited cognition | 3.2.x, 3.3.2, 2.2.x | Supports |
| Privacy | (no PII handling) | Not Applicable |

The generator computes these rows from the live criteria array, so they always agree with the
per-SC claims (a regression that downgrades 1.4.1 automatically downgrades "without perception of
color"). The mapping table itself lives in `src/compliance/` and is unit-tested (task 20).

## 4. Honesty mechanics

- **Five conformance states.** The four ITI states plus **Not Evaluated** for clauses genuinely
  outside an automatable component scope (e.g. some Ch. 11 software clauses, vendor support
  process). "Not Evaluated" is never used for a WCAG SC — every WCAG SC gets a real verdict.
- **Verification tag in every remark.** Each `remarks` string ends with a parenthetical
  `(verified: automated | hybrid | manual-attestation)` so a reader sees, per row, whether the
  claim is machine-proven on every commit or rests on a human attestation.
- **Attestation block.** Rows with `attestationRequired: true` (every `manual-attestation` and the
  attested half of `hybrid`) are collected into a signature section the report cannot be marked
  "final/signed" without — the generator emits an unsigned **DRAFT** watermark until a
  `--attest` input supplies the signer + date. This is what stops the artifact from quietly
  overclaiming (the uPlot-passes-axe failure mode).
- **Provenance.** The report embeds the fcharts version, the commit SHA, the evaluation date,
  the tool versions (axe-core), and a line stating which rows are automated vs. attested — so a
  buyer can see the ACR was generated from a specific, re-runnable state.

## 5. Output formats (all from the one model, zero deps)

| Format | File | Purpose |
|---|---|---|
| **Markdown** | `acr-<edition>.md` | Human-readable, diffable, pastes into GitHub/Notion; the lead-magnet artifact. |
| **HTML** | `acr-<edition>.html` | Self-contained (inline CSS, no assets), printable to PDF, emailable to procurement. |
| **JSON** | `acr-<edition>.json` | The machine-readable model itself — agent-readable, and the input a buyer's GRC tool or our CI gate can diff between versions. |

Implementation constraints (standing decisions): **dependency-free** — the generator is pure TS
string building (a tiny `escapeHtml`, a Markdown-table writer, an HTML shell with inline styles).
No Markdown/HTML library. The HTML embeds the same data as a `<script type="application/json">`
block (consistent with fcharts's own agent-readable ethos), so the HTML is also machine-parsable.

### Rendering rules

- **Tables mirror VPAT 2.5 columns:** `Criteria | Conformance Level | Remarks and Explanations`.
- **Grouped by WCAG principle** (Perceivable/Operable/Understandable/Robust), then edition
  sections (functional performance, software, docs).
- **Summary tally** up top (counts per level) — computed, with a one-line headline.
- **Not-Applicable rows are kept** (with their reason) — omitting them reads as hiding gaps.
- **Stable ordering** (SC numeric order) so diffs between versions are clean — the CI gate (doc 4)
  diffs two JSON models to detect a conformance regression.

## 6. What this unblocks

- **Task 17** transcribes document 1 into the typed `CriterionRow[]` + the FP-derivation map.
- **Task 18** implements `renderAcr(model, format)` for MD/HTML/JSON and `buildModel(criteria,
  edition, product, evaluation, stamp)`.
- **Task 21** runs `buildModel(..., 'en301549')` → commits a sample ACR as the procurement lead
  magnet.

The deliverable boundary: the **MIT renderer stays free**; the ACR generator + the CI gate are the
**paid Compliance Pack**, shipped as a separate entry point (`src/compliance/`, its own export),
never bundled into the core chart bundle.
