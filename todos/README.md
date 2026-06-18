# fcharts — TODO backlog

Outstanding work surfaced across the build + the GTM/accessibility discussions. **Honest
sequencing (from `GTM.md`): validate demand before polishing the renderer.** The binding
constraint is willingness-to-pay, not features — the engineering substrate (renderer + Compliance
Pack: auto-VPAT generator, `fcharts-audit` CI gate, conformance engine) is already built.

Priority key: **P0** = do now / unblocks validation or credibility · **P1** = soon / needed for a
real design-partner trial · **P2** = build-on-demand (only when a converting partner requires it).

Status key: **✅ done** (in code + tested) · **⚠ partial** · **☐ open — human-gated** (needs
interviews, credentials, or real assistive-tech — not code an agent can write).

> **Reconciliation (2026-06-17):** every *library-closable* engineering item is now done. The
> accessibility backlog (R4–R12, sonification, SVG export), the React adapter, and the compliance
> build wiring shipped earlier (see `compliance/scope-and-evidence-map.md` §"Library-closable —
> all done"); this pass added the server-side SVG render path + dark theme, the four categorical
> SVG primitives (donut / scatter / sparkline / bars), an automated SR-readiness regression test,
> **event/point annotations** (live canvas + `renderSVG`, accessible + agent-readable), and fixed
> the **zero-height-collapse** mounting bug. **What remains is genuinely human-gated:** demand
> validation (interviews, design partners, launch, outreach), `npm publish` (needs a public repo +
> npm credentials), and *real* screen-reader / blind-user testing (needs NVDA/JAWS/VoiceOver and
> ideally a user).
>
> **Update (2026-06-18):** the last two open *code* items closed — **linkable labels** (drill-down
> `href` on donut slices + bar rows) and the **inline progress / gauge bar** (`buildProgressSVG`).
> With those, **every agent-closable engineering item in this backlog is done**; the only remaining
> rows are the human-gated ones above.

| Area | Item | Priority | Status |
|---|---|---|---|
| GTM | [Price-discovery interviews (falsify WTP)](./gtm.md#price-discovery) | **P0** | ☐ human-gated |
| GTM | [Recruit 3–5 design partners → day-90 LOI](./gtm.md#design-partners) | **P0** | ☐ human-gated |
| Product | [Publish OSS renderer to npm + public repo](./productize.md#npm-publish) | **P0** | ☐ human-gated |
| Product | [Wire `fcharts-js/compliance` entry + `fcharts-audit` bin into the build](./productize.md#compliance-build) | **P0** | ✅ done |
| Charts | [Server-side SVG render API + dark theme (SSR / agent-readable)](./chart-types.md#server-svg) | P1 | ✅ done |
| Charts | [Donut / pie (categorical share)](./chart-types.md#donut) | P2 | ✅ done |
| Charts | [Scatter / dot-strip (numeric x, categorical rows)](./chart-types.md#scatter) | P2 | ✅ done |
| Charts | [Sparkline (inline micro-trend)](./chart-types.md#sparkline) | P2 | ✅ done |
| Charts | [Horizontal bar / progress-with-target](./chart-types.md#bars) | P2 | ✅ done |
| Charts | [Event / point annotations on the time series (allocation/closure dots)](./chart-types.md#annotations) | P1 | ✅ done |
| Charts | [Linkable labels (drill-down filter) on donut/bars — last 2 hand-rolled charts in Hecate](./chart-types.md#linkable-labels) | P1 | ✅ done |
| Charts | [Thin inline progress / gauge bar (KPI cap bars)](./chart-types.md#progress-gauge) | P2 | ✅ done |
| Bug | [Chart renders at 0 height when container height is indefinite (flash-then-disappear)](./bugs.md#zero-height-collapse) | P1 | ✅ fixed |
| A11y | [Real screen-reader testing (NVDA/JAWS/VoiceOver) — to claim "blind-friendly"](./accessibility.md#sr-testing) | **P0** | ⚠ partial (automated SR-readiness test done; real-AT ☐ human-gated) |
| GTM | [Launch post (HN/Lobsters) — lead with "axe can't see the gap"](./gtm.md#launch) | P1 | ☐ human-gated |
| GTM | [GitHub-issue outreach (Grafana / Metabase / Superset)](./gtm.md#outreach) | P1 | ☐ human-gated |
| Product | [React adapter `<FChart>`](./productize.md#react-adapter) | P1 | ✅ done |
| Product | [Hero demo: side-by-side vs Highcharts+Boost](./productize.md#hero-demo) | P1 | ✅ done |
| A11y | [R5 — per-series dash/marker channel (EU "double encoding"; closes 1.4.1)](./accessibility.md#r5) | P1 | ✅ done |
| A11y | [R6 — default contrast-checked palette + grid alpha (EU "contrast engine"; 1.4.3/1.4.11)](./accessibility.md#r6) | P1 | ✅ done |
| A11y | [Sonification (audio charts, EU-named non-visual modality)](./accessibility.md#sonification) | P2 | ✅ done |
| A11y | [R4 — single-pointer non-dragging pan (closes 2.5.7)](./accessibility.md#r4) | P2 | ✅ done |
| A11y | [R7 — adaptive tick thinning / rem fonts (1.4.4/1.4.10)](./accessibility.md#r7) | P2 | ✅ done |
| A11y | [R12 — forced-colors canvas remap (Windows HCM)](./accessibility.md#r12) | P2 | ✅ done |
| A11y | [SVG / tactile-graphic export (EU blind-specific item)](./accessibility.md#svg-export) | P2 | ✅ done (subsumed by server-SVG) |

See [`GTM.md`](../GTM.md), [`compliance/scope-and-evidence-map.md`](../compliance/scope-and-evidence-map.md)
(§11 remediation backlog), and [`FINDINGS.md`](../FINDINGS.md) for the full context.
