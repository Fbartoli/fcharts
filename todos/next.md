# Next backlog (post-0.2.0)

What's left after the 0.2.0 feature release, ranked by strategic fit: items that serve
**distribution or the compliance wedge** first, chart features **on pull** second. The binding
constraint is still demand validation — resist building tier C without a design partner asking.

> **Reconciliation (2026-07-03, evening):** ACR diffing (`--compare`), the Intl `locale` option,
> and the `fcharts-audit` lazy-peer fix shipped (see CHANGELOG "Unreleased"). The NVDA CI job is
> in flight on its own branch. VoiceOver-on-the-macOS-runner is demoted from active work to
> passive monitoring: the weekly harness self-skips at zero cost, and NVDA-on-Windows is the
> better path to real spoken-phrase assertions in CI.

## A — finish what 0.2.0 started (small, high leverage)

| Item | Why / state |
|---|---|
| **NVDA job on a Windows runner** | *(in flight)* guidepup drives NVDA, Windows runners have a real interactive desktop, and guidepup's own CI runs NVDA on `windows-latest` — the fastest path to *real* spoken-phrase assertions in CI. `test/at/nvda.test.ts` mirrors the VoiceOver suite; job in `at.yml`, off the PR gate. |
| **Trusted-publisher setup** (human) | One-time npmjs.com config — see `RELEASING.md`. Unblocks hands-free tag publishing with provenance. |
| **Marketplace listing** (human) | Next release: tick "Publish this Action to the Marketplace" (`action.yml` is in every ref after 0.2.0). |
| **VoiceOver on the macOS runner** | Demoted to monitoring: `at.yml` stays weekly + on-main and self-skips cleanly; if a future macOS image lets `voiceOver.start()` come up, it lights up on its own. Don't burn CI round-trips iterating images/timeouts while NVDA covers the "real AT in CI" claim. |

## Launch — demand-validation assets (next increment)

The GTM motion (months 1–3: OSS adoption at self-identified-gap targets) has no backlog items
behind it. Agent-buildable, human-launched:

| Item | Sketch |
|---|---|
| **Sample-ACR lead magnet** | `compliance/samples/` already ships on the landing origin (`/acr-en301549.html`); link it prominently from the landing page as "see a real chart-layer ACR" + a one-line "generate yours" CTA. |
| **README quickstart + demo GIF** | 60-second install→chart→audit path at the top of the README; a short GIF of keyboard/SR navigation (the unmatched demo, in motion). |
| **HN launch post draft** | Around the side-by-side demo + the honest FINDINGS story; owner edits and picks the moment. |
| **StackBlitz per-adapter examples** | `examples/` with React/Vue/Svelte/web-component minimal projects + "Open in StackBlitz" links — cuts design-partner onboarding to one click. |

## B — compliance-wedge products (differentiators, mostly small)

| Item | Sketch |
|---|---|
| **Perf budget gate in CI** | Next in line. `bench/` exists; assert flat frame cost per commit like the size gate. Design first: relative thresholds (the 250k/10k scaling ratio, not absolute FPS) so shared-runner noise can't flake it, and start as a scheduled monitor (like `at.yml`) before ever gating PRs. |
| **Guided attestation** | `--attest` takes a JSON file; a small static form generating it would let an auditor sign an ACR without reading docs. |
| **Tactile-graphic export profile** | The SVG export exists; a profile per tactile-printing guidelines (simplified marks, thick strokes, no gradients) turns "export a tactile graphic" into a button. |
| **`--compare` in the Action** | The GitHub Action could post the ACR diff as a PR comment ("conformance delta vs main") — do it when someone uses the Action beyond us. |

## C — chart features: build when a design partner pulls

Threshold/band fills + error bands (cheapest, most-asked) · stacked areas/bars · secondary
y-axis · accessible brush/minimap range selector (two `role=slider` handles; `syncCharts`
provides the plumbing) · treemap · WebGL backend · OffscreenCanvas/worker rendering ·
React Native. The renderer-agnostic `core/` was designed for the last three; none has a puller.

## D — DX

Generated API reference (typedoc from existing TSDoc) · examples gallery on the landing site
(StackBlitz links above are the first slice).

## Known limitations to keep visible

- `xType`/`formatX` pairing is resolved at construction: changing `xType` via `update()` keeps
  the old formatter unless `formatX` is patched too (documented in the option docs). Same for
  `locale`.
- The features browser suite needs `--test-concurrency=1` (four Vite+Chromium pairs starve
  small CI runners); don't "simplify" it back.
