# Productize backlog

The minimum to make fcharts installable + demoable to a design partner. Resist feature-building
beyond this (per `GTM.md`: line+area only, no streaming/candlestick/extra adapters on spec).

---

## <a id="npm-publish"></a>Publish OSS renderer to npm + public repo — **P0**

Nothing in the GTM funnel works until `npm install fcharts` does. The SDK tarball already builds
(`pnpm pack:sdk` → `fcharts-0.1.0.tgz`), it just isn't published and the repo isn't public.

- [ ] Make the repo public on GitHub.
- [ ] `npm publish` the renderer (MIT). Verify the UMD + ESM + `.d.ts` resolve for a consumer.
- [ ] README quickstart + the embedded demo + the sample ACR lead magnet are linked from the repo.

Effort: S (mostly process/decisions).

## <a id="compliance-build"></a>Wire the `fcharts-js/compliance` entry + `fcharts-audit` bin into the build — **P0**

Makes the *paid layer* actually consumable. Today `src/compliance/` runs from source
(`node src/compliance/cli.ts`, `pnpm a11y-audit`); the published-package paths don't exist yet.

- [ ] Vite multi-entry (or a second build step) to emit `dist/compliance/index.js` + a
      `dist/compliance/cli.js` with the shebang.
- [ ] `package.json`: add `exports["./compliance"]`, a `bin: { "fcharts-audit": ... }`, and
      include the compliance dist in `files`.
- [ ] Confirm `npx fcharts-audit` and `import { buildModel } from 'fcharts-js/compliance'` work
      from an installed package; keep Playwright/axe as **peer/dev** deps (never in core).

Effort: ~½ day.

## <a id="react-adapter"></a>React adapter `<FChart>` — **P1**

The likely *true* product gap for a real trial: the Tier-1 targets (Grafana, Metabase, Superset)
are React. GTM cut framework adapters, but a drop-in wrapper is what a partner needs.

- [ ] Thin `<FChart series data options />` wrapper (construct on mount, `update`/`setData`
      on prop change, `destroy` on unmount). Ship as a separate entry, no React in core.

Effort: S–M.

## <a id="hero-demo"></a>Hero demo: side-by-side vs Highcharts+Boost — **P1**

GTM Days 1–15 wants the side-by-side against **Highcharts+Boost** (the "accessible incumbent" a
prospect will name), not just uPlot + naive SVG. Highcharts+Boost disables per-point a11y
(`exposeAsGroupOnly`), which is exactly the wedge.

- [ ] Add a Highcharts+Boost column to the benchmark/landing comparison (fast but per-point
      inaccessible at scale), same data, same size (mind the fair-layout fix already in place).

Effort: M.
