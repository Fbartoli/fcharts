#!/usr/bin/env node
/**
 * `fcharts-audit` — the accessibility auditor, in two modes.
 *
 * Fixture mode (the CI gate, ci-gate.md): mounts a fixture chart in headless Chromium, runs the
 * conformance engine, reduces the checks against the committed baseline, regenerates the ACR(s),
 * and exits non-zero on any regression. Uses Vite + Playwright as dev/peer dependencies.
 *
 *   node src/compliance/cli.ts --fixture ./a11y/fixture.ts --edition en301549 --out ./compliance-out
 *
 * Target mode (audit ANY live chart on any page): navigates to a URL, waits for a selector, and
 * runs the same functional checks against it. Report-only — no committed baseline, no ACR — so it
 * always exits 0 (a diagnostic, not a gate). Checks that assume fcharts DOM report `not-applicable`.
 *
 *   node src/compliance/cli.ts --target https://example.com/dash --selector "#chart" --out ./out
 *
 * Compare mode (diff two generated ACRs — "what changed in conformance between versions"):
 * pure JSON-in, text-out; needs neither Playwright nor Vite.
 *
 *   node src/compliance/cli.ts --compare old/acr-en301549.json new/acr-en301549.json
 *
 * Playwright and Vite are OPTIONAL peers, imported lazily per mode — `--help`, argument
 * errors, and --compare all work without them, and a missing peer produces an install hint
 * instead of a module-resolution stack trace.
 *
 * Exit: 0 no regressions (or target-mode report written) · 1 regression(s) · 2 setup/harness error.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright';
import type { ViteDevServer } from 'vite';
import { runConformance, countStatuses } from './conformance.ts';
import { compareAcrs, describeNonAcr, isAcrModel, renderComparison } from './compare.ts';
import { reduceToVerdicts } from './mapping.ts';
import { CRITERIA } from './criteria.ts';
import { buildModel, renderAcr, type AcrFormat } from './acr.ts';
import type { AcrModel, CheckReport, EditionKey, EvaluationInfo, ProductInfo } from './types.ts';

const SEL = '#fc-audit-root';
const COMPONENT_SCOPE =
  'Everything the library renders inside its container (.fc-root): the <canvas> data layer, the ' +
  'DOM axis ticks, the legend, the focusable data surface, the live region, the hidden data table, ' +
  'the readout, and the embedded JSON summary. Page-level criteria are the host application’s.';

export interface Args {
  fixture: string;
  /** Whether --fixture was passed explicitly (drives the mutually-exclusive mode check). */
  fixtureExplicit: boolean;
  /** Target mode: the page URL to audit. */
  target?: string;
  /** Target mode: the CSS selector for the chart root element (required with --target). */
  selector?: string;
  /** Compare mode: two ACR JSON paths (old, new). */
  compare?: [string, string];
  editions: EditionKey[];
  out: string;
  background: string;
  /** Whether --background was passed explicitly (target mode auto-detects when it wasn't). */
  backgroundExplicit: boolean;
  formats: AcrFormat[];
  stamp: string;
  attest?: string;
  json: boolean;
  quiet: boolean;
}

/** The target-mode diagnostic report (report-only: no baseline gate, no ACR, no `pass`/`product`). */
export interface TargetReport {
  mode: 'target';
  target: string;
  selector: string;
  generatedAt: string;
  background: string;
  checkCounts: Record<string, number>;
  failingChecks: string[];
  axeSeriousFailed: boolean;
  report: CheckReport;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = {
    fixture: './a11y/fixture.ts',
    fixtureExplicit: false,
    editions: [],
    out: './compliance-out',
    background: '#ffffff',
    backgroundExplicit: false,
    formats: [],
    stamp: new Date().toISOString().slice(0, 10),
    json: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = (): string => argv[++i];
    if (v === '--fixture') { a.fixture = next(); a.fixtureExplicit = true; }
    else if (v === '--target') a.target = next();
    else if (v === '--selector') a.selector = next();
    else if (v === '--compare') a.compare = [next(), next()];
    else if (v === '--edition') a.editions.push(next() as EditionKey);
    else if (v === '--out') a.out = next();
    else if (v === '--background') { a.background = next(); a.backgroundExplicit = true; }
    else if (v === '--format') a.formats.push(...(next().split(',') as AcrFormat[]));
    else if (v === '--stamp') a.stamp = next();
    else if (v === '--attest') a.attest = next();
    else if (v === '--json') a.json = true;
    else if (v === '--quiet') a.quiet = true;
    else if (v === '--help' || v === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  if (a.editions.length === 0) a.editions = ['en301549'];
  if (a.formats.length === 0) a.formats = ['md', 'html', 'json'];
  return a;
}

/** Validate the mode selection. Returns an actionable error string, or undefined when usable. */
export function validateArgs(a: Args): string | undefined {
  const modes = [a.fixtureExplicit, !!a.target, !!a.compare].filter(Boolean).length;
  if (modes > 1) {
    return 'choose one mode: --fixture <path> (baseline gate), --target <url> (audit any page), or --compare <old.json> <new.json>';
  }
  if (modes === 0) {
    return 'specify a mode: --fixture <path> (baseline gate), --target <url> --selector <css> (audit any page), or --compare <old.json> <new.json>';
  }
  if (a.compare && !(a.compare[0] && a.compare[1])) {
    return '--compare needs two files: --compare <old.json> <new.json> (the acr-<edition>.json outputs)';
  }
  if (a.target && !a.selector) {
    return '--target <url> requires --selector <css> (the chart root element to audit)';
  }
  if (a.selector && !a.target) {
    return '--selector applies only with --target <url>';
  }
  return undefined;
}

function printHelp(): void {
  console.log(
    'fcharts-audit — WCAG 2.2 AA conformance for chart components.\n\n' +
      'Fixture mode (CI gate against the committed baseline):\n' +
      '  fcharts-audit --fixture <path> [--edition en301549|wcag|section508]*\n' +
      '                [--out <dir>] [--background <css>] [--format md,html,json]\n' +
      '                [--stamp <iso>] [--attest <path>] [--json] [--quiet]\n\n' +
      'Target mode (audit ANY live chart on any page — report-only, no baseline):\n' +
      '  fcharts-audit --target <url> --selector <css>\n' +
      '                [--out <dir>] [--background <css>] [--json] [--quiet]\n' +
      '  In target mode --edition/--format/--attest are ignored (no ACR is generated) and the\n' +
      '  exit code is 0 (a diagnostic, not a CI gate). fcharts-specific checks report n/a.\n' +
      '  Contrast background: auto-detected from the target element unless --background is given.\n\n' +
      'Compare mode (diff two generated ACRs — what changed in conformance between versions):\n' +
      '  fcharts-audit --compare <old.json> <new.json>   [--json]\n' +
      '  Takes the acr-<edition>.json files two runs wrote. Exit 1 when a claim weakened.\n' +
      '  Pure JSON diff — needs neither playwright nor vite.\n\n' +
      '--fixture, --target, and --compare are mutually exclusive; exactly one is required.',
  );
}

function readProduct(): ProductInfo {
  const cwd = process.cwd();
  let pkg: { name?: string; version?: string; description?: string; homepage?: string } = {};
  try {
    pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8'));
  } catch {
    /* fall back to defaults */
  }
  return {
    name: 'fcharts',
    version: pkg.version ?? '0.0.0',
    description: pkg.description ?? 'Fast, accessible charts.',
    url: pkg.homepage,
    componentScope: COMPONENT_SCOPE,
  };
}

function buildEvaluation(): EvaluationInfo {
  return {
    methods: [
      'Automated axe-core scan (scoped to the chart)',
      'Functional probes: keyboard navigation, zoom, Escape-dismiss, live-region announcement',
      'Computed contrast on library-controlled pairs',
      'DOM-semantics assertions (roles, names, table, target size)',
      'Manual attestation for perceptual + real-AT + integration-context criteria',
    ],
    notes:
      'Automated/hybrid rows are re-proven on every run by this gate; manual-attestation rows ' +
      'are listed for human sign-off. axe-clean alone is necessary, not sufficient.',
    evaluator: 'fcharts-audit (automated)' + (commitSha() ? ` @ ${commitSha()}` : ''),
  };
}

function commitSha(): string | undefined {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

function loadAxe(): string | undefined {
  const p = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return undefined;
  }
}

function fixtureWebPath(fixture: string): string {
  const rel = relative(process.cwd(), resolve(fixture)).split('\\').join('/');
  return '/' + rel.replace(/^\/+/, '');
}

function auditHtml(fixturePath: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<style>html,body{margin:0}#fc-audit-root{width:900px;height:480px}</style></head>' +
    '<body><div id="fc-audit-root"></div>' +
    `<script type="module">import { mountChart } from '${fixturePath}';` +
    `mountChart(document.getElementById('fc-audit-root'));` +
    `requestAnimationFrame(() => requestAnimationFrame(() => { window.__auditReady = true; }));` +
    '</script></body></html>'
  );
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const modeError = validateArgs(args);
  if (modeError) {
    console.error(`fcharts-audit: ${modeError}`);
    return 2;
  }
  if (args.compare) return runCompareMode(args.compare, args.json);
  return args.target ? runTargetMode(args) : runFixtureMode(args);
}

/** Raised when an optional peer (playwright, vite) is missing — rendered as an install hint. */
class PeerMissingError extends Error {}

/**
 * Import an optional peer lazily. Absence becomes a {@link PeerMissingError} with the install
 * command; any other load failure propagates untouched.
 */
async function importPeer<T>(load: () => Promise<T>, name: string, hint: string): Promise<T> {
  try {
    return await load();
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') {
      throw new PeerMissingError(
        `the optional peer "${name}" is required for this mode — install it with: ${hint}`,
      );
    }
    throw e;
  }
}

const loadPlaywright = (): Promise<typeof import('playwright')> =>
  importPeer(
    () => import('playwright'),
    'playwright',
    'npm i -D playwright && npx playwright install chromium',
  );
const loadVite = (): Promise<typeof import('vite')> =>
  importPeer(() => import('vite'), 'vite', 'npm i -D vite');

/** Compare mode — pure: read, guard, diff, print. Exit 1 when a conformance claim weakened. */
function runCompareMode(paths: [string, string], json: boolean): number {
  const models: AcrModel[] = [];
  for (const path of paths) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(resolve(path), 'utf8'));
    } catch (e) {
      console.error(`fcharts-audit: could not read ${path} — ${e instanceof Error ? e.message : e}`);
      return 2;
    }
    if (!isAcrModel(parsed)) {
      const why = describeNonAcr(parsed) ?? 'not an ACR model (expected the acr-<edition>.json output)';
      console.error(`fcharts-audit: ${path}: ${why}`);
      return 2;
    }
    models.push(parsed);
  }
  const comparison = compareAcrs(models[0], models[1]);
  if (json) console.log(JSON.stringify(comparison, null, 2));
  else console.log(renderComparison(comparison, models[0], models[1]));
  return comparison.regression ? 1 : 0;
}

/** Fixture mode — the CI gate. Output is byte-stable against the committed baseline. */
async function runFixtureMode(args: Args): Promise<number> {
  const product = readProduct();
  const evaluation = buildEvaluation();
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  const entryFile = resolve(process.cwd(), '.fc-audit-entry.html');
  try {
    if (!existsSync(resolve(args.fixture))) {
      console.error(`fcharts-audit: fixture not found: ${args.fixture}`);
      return 2;
    }
    const { createServer } = await loadVite();
    const { chromium } = await loadPlaywright();
    // A real HTML entry at the project root, so Vite transforms the inline module + its imports.
    writeFileSync(entryFile, auditHtml(fixtureWebPath(args.fixture)));
    server = await createServer({ root: process.cwd(), logLevel: 'silent' });
    await server.listen();
    const url = server.resolvedUrls?.local?.[0];
    if (!url) throw new Error('Vite did not report a local URL');

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    page.on('pageerror', (e) => console.error('fixture error:', e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('page console:', m.text());
    });
    await page.goto(`${url}.fc-audit-entry.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as unknown as { __auditReady?: boolean }).__auditReady === true, undefined, { timeout: 30_000 });

    const report = await runConformance(page, SEL, { background: args.background, axeSource: loadAxe() });
    const verdicts = reduceToVerdicts(report, CRITERIA);
    const regressed = verdicts.filter((v) => v.regression);
    const counts = countStatuses(report);
    // A serious/critical axe violation fails the gate even if its tags don't map to a baseline SC
    // (so it never downgrades a criterion) — otherwise a brand-new violation could slip through.
    const axeFailed = report.results.some((r) => r.id === 'axe-serious' && r.status === 'fail');
    const failed = regressed.length > 0 || axeFailed;

    // Generate + write the ACR(s).
    mkdirSync(resolve(args.out), { recursive: true });
    let signed: { signer: string; date: string } | undefined;
    if (args.attest) {
      try {
        signed = JSON.parse(readFileSync(resolve(args.attest), 'utf8'));
      } catch {
        console.error(`fcharts-audit: could not read --attest file ${args.attest}`);
      }
    }
    const ext: Record<AcrFormat, string> = { md: 'md', html: 'html', json: 'json' };
    for (const edition of args.editions) {
      const model = buildModel({ criteria: CRITERIA, edition, product, evaluation, generatedAt: args.stamp, signed });
      for (const fmt of args.formats) {
        writeFileSync(resolve(args.out, `acr-${edition}.${ext[fmt]}`), renderAcr(model, fmt));
      }
    }
    const auditReport = {
      product,
      commit: commitSha(),
      generatedAt: args.stamp,
      background: args.background,
      editions: args.editions,
      checkCounts: counts,
      regressions: regressed.map((v) => ({
        num: v.num,
        expected: v.expected,
        observed: v.observed,
        failingChecks: v.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.detail}`),
      })),
      pass: !failed,
      axeSeriousFailed: axeFailed,
      report,
    };
    writeFileSync(resolve(args.out, 'audit-report.json'), JSON.stringify(auditReport, null, 2));

    if (args.json) console.log(JSON.stringify(auditReport, null, 2));
    else if (!args.quiet) printSummary(verdicts, regressed, counts, args.out, axeFailed);

    return failed ? 1 : 0;
  } catch (err) {
    if (err instanceof PeerMissingError) {
      console.error(`fcharts-audit: ${err.message}`);
      return 2;
    }
    console.error('fcharts-audit: harness error —', err instanceof Error ? err.message : err);
    return 2;
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(entryFile, { force: true });
  }
}

/** Target mode — audit any live chart on any page. Report-only, so it always exits 0 on success. */
async function runTargetMode(args: Args): Promise<number> {
  const target = args.target ?? '';
  const selector = args.selector ?? '';
  let browser: Browser | undefined;
  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    try {
      await page.goto(target, { waitUntil: 'load', timeout: 30_000 });
    } catch (e) {
      console.error(`fcharts-audit: could not load ${target} — ${e instanceof Error ? e.message : e}`);
      return 2;
    }
    try {
      await page.waitForSelector(selector, { timeout: 15_000 });
    } catch {
      console.error(`fcharts-audit: selector not found on ${target}: ${selector}`);
      return 2;
    }

    // Contrast is judged against a background. Grading a dark page against the old #ffffff
    // default produced false failures, so without an explicit --background the effective
    // background is read from the target element's ancestry (first non-transparent).
    if (!args.backgroundExplicit) {
      args.background = await page.evaluate((sel) => {
        let el: Element | null = document.querySelector(sel);
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          el = el.parentElement;
        }
        return '#ffffff';
      }, selector);
      if (!args.quiet) console.log(`background auto-detected: ${args.background} (override with --background)`);
    }

    const report = await runConformance(page, selector, { background: args.background, axeSource: loadAxe() });
    const counts = countStatuses(report);
    const axeFailed = report.results.some((r) => r.id === 'axe-serious' && r.status === 'fail');
    const auditReport = shapeTargetReport(args, counts, axeFailed, report);

    mkdirSync(resolve(args.out), { recursive: true });
    writeFileSync(resolve(args.out, 'audit-report.json'), JSON.stringify(auditReport, null, 2));

    if (args.json) console.log(JSON.stringify(auditReport, null, 2));
    else if (!args.quiet) printTargetSummary(args, report, counts, axeFailed);

    return 0;
  } catch (err) {
    if (err instanceof PeerMissingError) {
      console.error(`fcharts-audit: ${err.message}`);
      return 2;
    }
    console.error('fcharts-audit: harness error —', err instanceof Error ? err.message : err);
    return 2;
  } finally {
    await browser?.close();
  }
}

/** Shape the target-mode report (pure): no baseline verdicts, no ACR — just the observed checks. */
export function shapeTargetReport(
  args: Args,
  counts: Record<string, number>,
  axeFailed: boolean,
  report: CheckReport,
): TargetReport {
  return {
    mode: 'target',
    target: args.target ?? '',
    selector: args.selector ?? '',
    generatedAt: args.stamp,
    background: args.background,
    checkCounts: counts,
    failingChecks: report.results.filter((r) => r.status === 'fail').map((r) => `${r.id}: ${r.detail}`),
    axeSeriousFailed: axeFailed,
    report,
  };
}

function printSummary(
  verdicts: ReturnType<typeof reduceToVerdicts>,
  regressed: ReturnType<typeof reduceToVerdicts>,
  counts: Record<string, number>,
  out: string,
  axeFailed: boolean,
): void {
  const wcag = verdicts.filter((v) => /^\d/.test(v.num));
  const tw: Record<string, number> = {};
  for (const v of wcag) tw[v.observed] = (tw[v.observed] ?? 0) + 1;
  console.log(
    `\nfcharts-audit — ${tw['Supports'] ?? 0} Supports / ${tw['Partially Supports'] ?? 0} Partially / ` +
      `${tw['Not Applicable'] ?? 0} Not Applicable (55 WCAG 2.2 A/AA criteria)`,
  );
  console.log(`checks: ${counts.pass} pass · ${counts.fail} fail · ${counts.na} n/a → ACR written to ${out}`);
  if (regressed.length === 0 && !axeFailed) {
    console.log('✓ no regressions — gate passes');
    return;
  }
  if (axeFailed) console.log('\n✗ axe-core reported serious/critical violations — gate fails');
  if (regressed.length > 0) {
    console.log(`\n✗ ${regressed.length} REGRESSION(S) — gate fails:`);
    for (const v of regressed) {
      console.log(`  ${v.num}: ${v.expected} → ${v.observed}`);
      for (const c of v.checks.filter((chk) => chk.status === 'fail')) {
        console.log(`     ✗ ${c.id}: ${c.detail}`);
      }
    }
  }
}

function printTargetSummary(
  args: Args,
  report: CheckReport,
  counts: Record<string, number>,
  axeFailed: boolean,
): void {
  console.log(`\nfcharts-audit — external target "${args.selector}" @ ${args.target}`);
  console.log(`checks: ${counts.pass} pass · ${counts.fail} fail · ${counts.na} n/a → report written to ${args.out}`);
  const fails = report.results.filter((r) => r.status === 'fail');
  if (fails.length === 0) {
    console.log('✓ no functional accessibility failures detected on this target');
  } else {
    console.log(`\n✗ ${fails.length} functional check(s) failed on this target:`);
    for (const r of fails) console.log(`     ✗ ${r.id}: ${r.detail}`);
  }
  if (axeFailed) console.log('✗ axe-core reported serious/critical violations');
  console.log('\n(report-only: no committed baseline for an external chart — a diagnostic, not a gate)');
}

/** True when this module is the process entry, so importing it (e.g. for tests) never runs a scan. */
function isEntryPoint(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(arg)).href;
  } catch {
    return false;
  }
}

if (isEntryPoint()) main().then((code) => process.exit(code));
