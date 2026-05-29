#!/usr/bin/env node
/**
 * `sightline-audit` — the CI accessibility gate (ci-gate.md).
 *
 * Mounts a fixture chart in headless Chromium, runs the conformance engine, reduces the checks
 * against the committed baseline, regenerates the ACR(s), and exits non-zero on any regression.
 * Uses Vite + Playwright as dev/peer dependencies — never the shipped renderer.
 *
 *   node src/compliance/cli.ts --fixture ./a11y/fixture.ts --edition en301549 --out ./compliance-out
 *
 * Exit: 0 no regressions · 1 regression(s) · 2 setup/harness error.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { runConformance, countStatuses } from './conformance.ts';
import { reduceToVerdicts, hasRegression } from './mapping.ts';
import { CRITERIA } from './criteria.ts';
import { buildModel, renderAcr, type AcrFormat } from './acr.ts';
import type { EditionKey, EvaluationInfo, ProductInfo } from './types.ts';

const SEL = '#sl-audit-root';
const COMPONENT_SCOPE =
  'Everything the library renders inside its container (.sl-root): the <canvas> data layer, the ' +
  'DOM axis ticks, the legend, the focusable data surface, the live region, the hidden data table, ' +
  'the readout, and the embedded JSON summary. Page-level criteria are the host application’s.';

interface Args {
  fixture: string;
  editions: EditionKey[];
  out: string;
  background: string;
  formats: AcrFormat[];
  stamp: string;
  attest?: string;
  json: boolean;
  quiet: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    fixture: './a11y/fixture.ts',
    editions: [],
    out: './compliance-out',
    background: '#ffffff',
    formats: [],
    stamp: new Date().toISOString().slice(0, 10),
    json: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = (): string => argv[++i];
    if (v === '--fixture') a.fixture = next();
    else if (v === '--edition') a.editions.push(next() as EditionKey);
    else if (v === '--out') a.out = next();
    else if (v === '--background') a.background = next();
    else if (v === '--format') a.formats.push(...(next().split(',') as AcrFormat[]));
    else if (v === '--stamp') a.stamp = next();
    else if (v === '--attest') a.attest = next();
    else if (v === '--json') a.json = true;
    else if (v === '--quiet') a.quiet = true;
    else if (v === '--help' || v === '-h') {
      console.log('Usage: sightline-audit [--fixture p] [--edition k]* [--out d] [--background css]' +
        ' [--format md,html,json] [--stamp iso] [--attest p] [--json] [--quiet]');
      process.exit(0);
    }
  }
  if (a.editions.length === 0) a.editions = ['en301549'];
  if (a.formats.length === 0) a.formats = ['md', 'html', 'json'];
  return a;
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
    name: 'Sightline',
    version: pkg.version ?? '0.0.0',
    description: pkg.description ?? 'Fast, accessible charts.',
    url: pkg.homepage,
    componentScope: COMPONENT_SCOPE,
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
    '<style>html,body{margin:0}#sl-audit-root{width:900px;height:480px}</style></head>' +
    '<body><div id="sl-audit-root"></div>' +
    `<script type="module">import { mountChart } from '${fixturePath}';` +
    `mountChart(document.getElementById('sl-audit-root'));` +
    `requestAnimationFrame(() => requestAnimationFrame(() => { window.__auditReady = true; }));` +
    '</script></body></html>'
  );
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const product = readProduct();
  const evaluation: EvaluationInfo = {
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
    evaluator: 'sightline-audit (automated)' + (commitSha() ? ` @ ${commitSha()}` : ''),
  };

  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  const entryFile = resolve(process.cwd(), '.sl-audit-entry.html');
  try {
    if (!existsSync(resolve(args.fixture))) {
      console.error(`sightline-audit: fixture not found: ${args.fixture}`);
      return 2;
    }
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
    await page.goto(`${url}.sl-audit-entry.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as unknown as { __auditReady?: boolean }).__auditReady === true, undefined, { timeout: 30_000 });

    const report = await runConformance(page, SEL, { background: args.background, axeSource: loadAxe() });
    const verdicts = reduceToVerdicts(report, CRITERIA);
    const regressed = verdicts.filter((v) => v.regression);
    const counts = countStatuses(report);

    // Generate + write the ACR(s).
    mkdirSync(resolve(args.out), { recursive: true });
    let signed: { signer: string; date: string } | undefined;
    if (args.attest) {
      try {
        signed = JSON.parse(readFileSync(resolve(args.attest), 'utf8'));
      } catch {
        console.error(`sightline-audit: could not read --attest file ${args.attest}`);
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
      pass: !hasRegression(verdicts),
      report,
    };
    writeFileSync(resolve(args.out, 'audit-report.json'), JSON.stringify(auditReport, null, 2));

    if (args.json) console.log(JSON.stringify(auditReport, null, 2));
    else if (!args.quiet) printSummary(verdicts, regressed, counts, args.out);

    return regressed.length === 0 ? 0 : 1;
  } catch (err) {
    console.error('sightline-audit: harness error —', err instanceof Error ? err.message : err);
    return 2;
  } finally {
    await browser?.close();
    await server?.close();
    rmSync(entryFile, { force: true });
  }
}

function printSummary(
  verdicts: ReturnType<typeof reduceToVerdicts>,
  regressed: ReturnType<typeof reduceToVerdicts>,
  counts: Record<string, number>,
  out: string,
): void {
  const t: Record<string, number> = {};
  for (const v of verdicts) t[v.observed] = (t[v.observed] ?? 0) + 1;
  const wcag = verdicts.filter((v) => /^\d/.test(v.num));
  const tw: Record<string, number> = {};
  for (const v of wcag) tw[v.observed] = (tw[v.observed] ?? 0) + 1;
  console.log(
    `\nsightline-audit — ${tw['Supports'] ?? 0} Supports / ${tw['Partially Supports'] ?? 0} Partially / ` +
      `${tw['Not Applicable'] ?? 0} Not Applicable (55 WCAG 2.2 A/AA criteria)`,
  );
  console.log(`checks: ${counts.pass} pass · ${counts.fail} fail · ${counts.na} n/a → ACR written to ${out}`);
  if (regressed.length === 0) {
    console.log('✓ no regressions — gate passes');
    return;
  }
  console.log(`\n✗ ${regressed.length} REGRESSION(S) — gate fails:`);
  for (const v of regressed) {
    console.log(`  ${v.num}: ${v.expected} → ${v.observed}`);
    for (const c of v.checks.filter((c) => c.status === 'fail')) console.log(`     ✗ ${c.id}: ${c.detail}`);
  }
}

main().then((code) => process.exit(code));
