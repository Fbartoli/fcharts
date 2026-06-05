# fcharts — TODO backlog

Outstanding work surfaced across the build + the GTM/accessibility discussions. **Honest
sequencing (from `GTM.md`): validate demand before polishing the renderer.** The binding
constraint is willingness-to-pay, not features — the engineering substrate (renderer + Compliance
Pack: auto-VPAT generator, `fcharts-audit` CI gate, conformance engine) is already built.

Priority key: **P0** = do now / unblocks validation or credibility · **P1** = soon / needed for a
real design-partner trial · **P2** = build-on-demand (only when a converting partner requires it).

| Area | Item | Priority | Status |
|---|---|---|---|
| GTM | [Price-discovery interviews (falsify WTP)](./gtm.md#price-discovery) | **P0** | ☐ |
| GTM | [Recruit 3–5 design partners → day-90 LOI](./gtm.md#design-partners) | **P0** | ☐ |
| Product | [Publish OSS renderer to npm + public repo](./productize.md#npm-publish) | **P0** | ☐ |
| Product | [Wire `fcharts-js/compliance` entry + `fcharts-audit` bin into the build](./productize.md#compliance-build) | **P0** | ☐ |
| A11y | [Real screen-reader testing (NVDA/JAWS/VoiceOver) — to claim "blind-friendly"](./accessibility.md#sr-testing) | **P0** | ☐ |
| GTM | [Launch post (HN/Lobsters) — lead with "axe can't see the gap"](./gtm.md#launch) | P1 | ☐ |
| GTM | [GitHub-issue outreach (Grafana / Metabase / Superset)](./gtm.md#outreach) | P1 | ☐ |
| Product | [React adapter `<FChart>`](./productize.md#react-adapter) | P1 | ☐ |
| Product | [Hero demo: side-by-side vs Highcharts+Boost](./productize.md#hero-demo) | P1 | ☐ |
| A11y | [R5 — per-series dash/marker channel (EU "double encoding"; closes 1.4.1)](./accessibility.md#r5) | P1 | ☐ |
| A11y | [R6 — default contrast-checked palette + grid alpha (EU "contrast engine"; 1.4.3/1.4.11)](./accessibility.md#r6) | P1 | ☐ |
| A11y | [Sonification (audio charts, EU-named non-visual modality)](./accessibility.md#sonification) | P2 | ☐ |
| A11y | [R4 — single-pointer non-dragging pan (closes 2.5.7)](./accessibility.md#r4) | P2 | ☐ |
| A11y | [R7 — adaptive tick thinning / rem fonts (1.4.4/1.4.10)](./accessibility.md#r7) | P2 | ☐ |
| A11y | [R12 — forced-colors canvas remap (Windows HCM)](./accessibility.md#r12) | P2 | ☐ |
| A11y | [SVG / tactile-graphic export (EU blind-specific item)](./accessibility.md#svg-export) | P2 | ☐ |

See [`GTM.md`](../GTM.md), [`compliance/scope-and-evidence-map.md`](../compliance/scope-and-evidence-map.md)
(§11 remediation backlog), and [`FINDINGS.md`](../FINDINGS.md) for the full context.
