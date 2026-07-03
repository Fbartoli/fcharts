# Next backlog (post-0.2.0)

What's left after the 0.2.0 feature release, ranked by strategic fit: items that serve
**distribution or the compliance wedge** first, chart features **on pull** second. The binding
constraint is still demand validation — resist building tier C without a design partner asking.

## A — finish what 0.2.0 started (small, high leverage)

| Item | Why / state |
|---|---|
| **VoiceOver actually speaking in CI** | `at.yml` is green but skip-only: `voiceOver.start()` times out on GitHub's macos-14 runner (guidepup setup-action ran; VO never came up). Iterate via `workflow_dispatch`: try macos-13/15 images, longer `START_TIMEOUT`, guidepup setup-action versions. Harness itself is verified (bounded calls, loud failures, clean local skip). |
| **NVDA job on a Windows runner** | guidepup drives NVDA too, and Windows runners are historically friendlier to AT automation than macOS. Likely the fastest path to *real* spoken-phrase assertions in CI. Mirror `test/at/voiceover.test.ts`. |
| **Trusted-publisher setup** (human) | One-time npmjs.com config — see `RELEASING.md`. Unblocks hands-free tag publishing with provenance. |
| **Marketplace listing** (human) | Next release: tick "Publish this Action to the Marketplace" (`action.yml` is in every ref after 0.2.0). |
| **Intl default formatters** | `formatTimeTick` uses English month names; a `locale` option feeding `Intl.DateTimeFormat`/`NumberFormat` completes what the de/fr/es string packs started. |

## B — compliance-wedge products (differentiators, mostly small)

| Item | Sketch |
|---|---|
| **ACR diffing** | `fcharts-audit --compare old.json new.json` → "what changed in conformance between versions". The JSON model already carries everything; procurement loves this. |
| **Guided attestation** | `--attest` takes a JSON file; a small static form generating it would let an auditor sign an ACR without reading docs. |
| **Tactile-graphic export profile** | The SVG export exists; a profile per tactile-printing guidelines (simplified marks, thick strokes, no gradients) turns "export a tactile graphic" into a button. |
| **Perf budget gate in CI** | `bench/` exists; assert flat frame cost per commit like the size gate, keeping the headline claim honest forever. |

## C — chart features: build when a design partner pulls

Threshold/band fills + error bands (cheapest, most-asked) · stacked areas/bars · secondary
y-axis · accessible brush/minimap range selector (two `role=slider` handles; `syncCharts`
provides the plumbing) · treemap · WebGL backend · OffscreenCanvas/worker rendering ·
React Native. The renderer-agnostic `core/` was designed for the last three; none has a puller.

## D — DX

Generated API reference (typedoc from existing TSDoc) · StackBlitz/CodeSandbox examples per
adapter · examples gallery on the landing site.

## Known limitations to keep visible

- `fcharts-audit` requires `playwright` (peer) even for `--help` — module-level import; a lazy
  import would give a friendlier no-playwright error.
- `xType`/`formatX` pairing is resolved at construction: changing `xType` via `update()` keeps
  the old formatter unless `formatX` is patched too (documented in the option docs).
- The features browser suite needs `--test-concurrency=1` (four Vite+Chromium pairs starve
  small CI runners); don't "simplify" it back.
