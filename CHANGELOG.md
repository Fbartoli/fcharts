# Changelog

All notable changes to `fcharts-js`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/).

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
