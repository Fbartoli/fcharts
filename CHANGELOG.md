# Changelog

All notable changes to `fcharts-js`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
