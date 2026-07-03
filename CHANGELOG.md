# Changelog

All notable changes to `fcharts-js`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Generated API reference** at [fcharts.dev/api](https://fcharts.dev/api/) — typedoc over the
  existing TSDoc for all five public entries (core, react, vue, svelte, compliance), built into
  the site on every deploy, zero typedoc warnings. Types referenced by public signatures
  (`Formatter`, `Margins`, `ChartData`, `LinearScale`, `SeriesStats`, resolved series/annotation
  shapes, `DEFAULT_MARGINS`) are now exported from the barrel — they were always part of the
  de-facto API surface.
- **Perf-budget CI monitor** (`.github/workflows/perf.yml`): the committed benchmark runs on
  every push to main + weekly, failing on a flake-resistant subset of its acceptance criteria
  — frame cost < 16 ms, the relative 250k/10k scaling ratio, and the deterministic a11y
  assertions (`FCHARTS_BENCH_CI=1`). The competitor-comparison criterion is reported but never
  gated: other libraries' numbers under headless rAF throttling are environmental. Like the
  assistive-tech workflow, it monitors main — it is not a PR gate.

## [0.3.0] — 2026-07-03

### Added
- **Reusable GitHub Action** (`action.yml`): run `fcharts-audit` in any repo — audit-any
  (`target`/`selector`) or baseline-gated fixture mode — with the report uploaded as a build
  artifact and all installs isolated from the consumer's workspace.
- **Release automation** (`.github/workflows/release.yml`): pushing a `v*` tag publishes to npm
  via trusted publishing (OIDC, no token), with the tag/version match asserted and the full
  `prepublishOnly` gauntlet re-run; provenance attaches automatically once the repo is public.
- **ACR diffing**: `fcharts-audit --compare old.json new.json` reports what changed in
  conformance between two generated ACRs — per-criterion improved / regressed / scope-changed /
  remarks-only, `--json` for machines — and exits non-zero when a claim weakened. Pure JSON
  diff; also exported from `fcharts-js/compliance` (`compareAcrs`, `renderComparison`).
- **`locale` option** (`FChart` and `renderSVG`/`fcharts-render`): any BCP-47 tag localizes the
  *default* tick/value formatters via `Intl.DateTimeFormat`/`Intl.NumberFormat` — month names,
  date order, decimal separators — completing what the de/fr/es string packs started. Explicit
  `formatX`/`formatY` still win; without `locale`, output is byte-identical to before.
- **NVDA in CI, actually speaking** (`test/at/nvda.test.ts`): a real NVDA drives a live chart on
  the Windows runner and the suite asserts on the spoken phrases — accessible name + data
  summary via focus report, per-sample arrow-key value announcements through the live region,
  legend toggle state. Runs green on every push to main (`at.yml`); the VoiceOver sibling stays
  as macOS monitoring (`continue-on-error`) until Apple's images capture speech.

### Changed
- Landing page: npm install path surfaced (the MIT renderer is live on npm), 0.2.0 capabilities
  added (adapters, SSR hydration, real-VoiceOver CI), an "audit your current charts" one-liner,
  and the last stale bundle-size claim fixed. Then updated for this cycle: the screen-reader
  card now carries the NVDA-green-in-CI claim, and the ACR block mentions `--compare` + the
  machine-readable JSON.
- Docs & examples: a keyboard-navigation demo GIF at the top of the README (recorded
  deterministically by `scripts/record-demo.ts`), an audit step in the quickstart, and
  standalone StackBlitz-ready starter apps for React / Vue / Svelte / `<f-chart>` under
  `examples/` (each verified to install and build against the published package).

### Fixed
- `fcharts-audit` no longer crashes with a module-resolution error when its optional peers are
  absent: `playwright`/`vite` load lazily per mode, so `--help` and `--compare` work in a bare
  install and `--fixture`/`--target` print an actionable install hint instead of a stack trace.

## [0.2.0] — 2026-07-03

### Added
- **Time x-axis** (`xType: 'time'`): calendar-boundary ticks (minutes → hours → local
  midnights → Monday weeks → month starts → years) with an adaptive date/clock label default.
- **Log y-scale** (`yScale: 'log'`): base-10 decade ticks with 2×/5× mantissa densification;
  positive-domain fitting, non-positive samples clamp to the plot bottom.
- **Linked panes**: public `chart.onDomainChange(cb)` subscription and `syncCharts([...])` —
  zoom/pan any pane and the others follow, feedback-safe.
- **CSV export**: `chart.toCSV()` (candles expand to four localized OHLC columns) and an
  opt-in visible download button (`exportControl: true`, localized via `strings.exportCsv`).
- **SSR hydration**: `hydrate(container, config)` swaps a server-rendered `renderSVG` for the
  live chart synchronously with no layout shift.
- **`<f-chart>` web component**: `defineFChart()` — light-DOM custom element configured via
  its `config` property.
- **Vue 3 adapter** (`fcharts-js/vue`) and **Svelte action** (`fcharts-js/svelte`, imports
  nothing from Svelte) with the same update/remount contract as the React adapter.
- **Matrix heatmap**: `buildHeatmapSVG` — sequential two-stop ramp, outlined missing cells,
  ramp legend, agent-readable summary.
- **`fcharts-render` CLI**: chart spec JSON (file or stdin) → standalone accessible SVG.
- **Locale packs**: complete German/French/Spanish UI-string translations
  (`stringsDE`/`stringsFR`/`stringsES`).
- **Audit any chart**: `fcharts-audit --target <url> --selector <css>` runs the functional
  a11y checks report-only against charts you don't own.
- **Real screen-reader CI**: a guidepup VoiceOver harness (`pnpm test:at`) asserting on
  actual spoken phrases, wired to a weekly + on-main macOS workflow.

### Changed
- Bundle size: the tree-shaken canvas core is now ~21 KB gzip and the full barrel ~39 KB
  (budget raised to 45 KB, still enforced in CI); claims updated everywhere.

### Fixed
- Honest bundle-size claims everywhere: ~19 KB min+gzip for the tree-shaken canvas core,
  ~33 KB for the full barrel (README, landing page, `llms.txt`, FINDINGS). The size budget
  (`pnpm size`) is raised to 35 KB and now enforced in CI and `prepublishOnly`.
- `llms.txt` rewritten against the current API — it still documented the pre-rename
  "Sightline" package (wrong install name, class name, UMD global, CSS variables).
- Remaining pre-rename remnants cleaned up: `FCHARTS_ENTRY`/`FCHARTS_ROOT` build env vars,
  a11y-gate workflow naming, sample-ACR README, and the old proof-of-concept page removed.

### Changed
- Internal refactors to meet the ≤100-lines-per-function limit (`runConformance`,
  `renderHtml`, `buildScatterSVG`, the `FChart` constructor) and shared SVG helpers
  (`text`, `bgRect`, `svgRoot`, `markColor`) replacing per-renderer boilerplate.
  No public API changes.

## [0.1.0] — 2026-07-03

Initial public release.

- Canvas time-series renderer (line / area / candle) with a min/max downsample pyramid —
  O(viewport width) frame cost, flat from 10k to 250k+ points; O(1) streaming `append`
  and `amendLast`.
- Real-DOM accessibility layer: keyboard data cursor, `aria-live` announcements, visible
  text ticks, accessible legend, hidden data-table alternative, localizable strings.
- Server-safe SVG primitives: `renderSVG` (line/area/candle) plus donut, scatter,
  sparkline, bars, and progress builders with light/dark themes and an opt-in hover
  readout (`attachReadout`).
- Event/point annotations (canvas + SVG), agent-readable `summary()` + embedded JSON.
- React adapter (`fcharts-js/react`).
- Compliance Pack (`fcharts-js/compliance` + `fcharts-audit` CLI): WCAG 2.2 AA conformance
  engine, auto-generated VPAT/ACR (EN 301 549, WCAG, Section 508), CI regression gate.
