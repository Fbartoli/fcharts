# Next backlog (post-0.2.0)

What's left after the 0.2.0 feature release, ranked by strategic fit: items that serve
**distribution or the compliance wedge** first, chart features **on pull** second. The binding
constraint is still demand validation — resist building tier C without a design partner asking.

> **Reconciliation (2026-07-03, evening):** ACR diffing (`--compare`), the Intl `locale` option,
> the `fcharts-audit` lazy-peer fix, **and the NVDA CI job** shipped (see CHANGELOG
> "Unreleased"). NVDA runs green on `windows-latest` asserting real spoken phrases — the
> "real screen reader in CI" claim is now substantiated by a job that *runs*, not skips.

## A — finish what 0.2.0 started (small, high leverage)

| Item | Why / state |
|---|---|
| **Trusted-publisher setup** (human) | One-time npmjs.com config — see `RELEASING.md`. Unblocks hands-free tag publishing with provenance. |
| **Marketplace listing** (human) | Next release: tick "Publish this Action to the Marketplace" (`action.yml` is in every ref after 0.2.0). |
| **VoiceOver on the macOS runner** | Monitoring-only (`continue-on-error` in `at.yml`). New observation (2026-07-03): `voiceOver.start()` now **succeeds** on macos-14 but the spoken-phrase log stays empty — same class of issue NVDA had with focus events. First thing to try when picked up: assert via a VO describe/report command (the fix that made NVDA green) instead of event announcements. Not worth CI round-trips while NVDA carries the claim. |

## Launch — demand-validation assets

The agent-buildable assets shipped 2026-07-03: README **keyboard-nav demo GIF**
(`media/keyboard-nav.gif`, re-recordable via `scripts/record-demo.ts`) + quickstart→audit
path; **StackBlitz starters** for all four integrations (`examples/README.md`, each verified
to install+build against the npm package); landing **ACR lead-magnet block** upgraded
(`--compare`, machine-readable JSON) and the AT card upgraded to the NVDA-green claim; **HN
post draft** at `todos/launch/hn-post.md`. What remains is human-gated:

| Item | Who / what |
|---|---|
| **Redeploy the landing** (human-ish) | `pnpm build:site` + Cloudflare Pages per `landing/DEPLOY.md` — the NVDA/`--compare` copy isn't live until then. |
| **Post the HN launch** (human) | Edit `todos/launch/hn-post.md`, pick the moment, stay for the comments. |

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
