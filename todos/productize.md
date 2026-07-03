# Productize backlog

The minimum to make fcharts installable + demoable to a design partner. Resist feature-building
beyond this (line+area only; no streaming, candlestick, or extra adapters on spec).

---

## <a id="npm-publish"></a>Publish OSS renderer to npm + public repo — **P0** — ✅ DONE (2026-07-03)

- [x] Repo public: <https://github.com/Fbartoli/fcharts> (history recreated clean; business docs
      never entered it).
- [x] `fcharts-js@0.1.0` then `0.2.0` published; ESM + UMD + `.d.ts` + all subpaths verified from
      a fresh consumer install (`.`, `./compliance`, `./react`, `./vue`, `./svelte`, both bins).
- [x] GitHub Release `v0.2.0` with notes; README/landing link npm and the sample ACR.
- [x] Release automation: `v*` tag → CI publish via npm trusted publishing
      (`.github/workflows/release.yml`, see `RELEASING.md`). **One human step remains:** configure
      the Trusted Publisher on npmjs.com (see RELEASING.md) — until then tags fail at the publish
      step and manual `pnpm publish` (interactive 2FA) is the fallback.

## <a id="compliance-build"></a>Wire the `fcharts-js/compliance` entry + `fcharts-audit` bin into the build — **P0** — ✅ DONE

The *paid layer* is consumable from the built package.

- [x] Multi-entry build (`vite build && FCHARTS_ENTRY=react vite build && FCHARTS_ENTRY=compliance
      vite build && tsc -p tsconfig.build.json`) emits `dist/compliance/index.js` + `dist/compliance/cli.js`
      (with shebang).
- [x] `package.json`: `exports["./compliance"]`, `bin: { "fcharts-audit": "./dist/compliance/cli.js" }`,
      and `files: ["dist"]`.
- [x] Playwright + axe-core are optional **peer/dev** deps (never in core); `import { … } from
      'fcharts-js/compliance'` and `npx fcharts-audit` resolve from the built package.

## <a id="react-adapter"></a>React adapter `<FChart>` — **P1** — ✅ DONE

- [x] `src/react.ts` — thin `<FChart series data options />` wrapper (construct on mount,
      `update`/`setData` on prop change via `sameConstructionOptions`, remount when a
      construction-time option changes, `destroy` on unmount). Shipped as the `./react` entry, no
      React in core (peer dep). Covered by the React adapter browser test.

## <a id="hero-demo"></a>Hero demo: side-by-side vs Highcharts+Boost — **P1** — ✅ DONE

- [x] `bench/baselines/highcharts-chart.ts` runs Highcharts with the **boost** module *and* the
      accessibility module (the fairest "just use Highcharts" config); `bench/main.ts` wires it as
      a `cell-highcharts` column and `bench/results.json` records it as "Highcharts + Boost". The
      landing comparison (`landing/index.html`) lists the Highcharts Stock row alongside fcharts.
