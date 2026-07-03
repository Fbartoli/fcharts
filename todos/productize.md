# Productize backlog

The minimum to make fcharts installable + demoable to a design partner. Resist feature-building
beyond this (line+area only; no streaming, candlestick, or extra adapters on spec).

---

## <a id="npm-publish"></a>Publish OSS renderer to npm + public repo — **P0** — ☐ HUMAN-GATED

Nothing downstream works until `npm install fcharts-js` does. The SDK tarball already builds
(`pnpm pack:sdk` → `fcharts-js-0.1.0.tgz`) and `package.json` already declares the right `exports`
(`.`, `./compliance`, `./react`), `bin`, and `files`. What's left needs **credentials + a decision
an agent can't make**: there is no git remote, and publishing requires an npm account.

- [ ] Make the repo public on GitHub (needs the owner).
- [ ] `npm publish` the renderer (MIT) — needs npm credentials. Verify UMD + ESM + `.d.ts` resolve.
- [ ] Link README quickstart + embedded demo + sample ACR lead magnet from the repo.

Effort: S (mostly process/decisions) — **not codeable by an agent.**

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
