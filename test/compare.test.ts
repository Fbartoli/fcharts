/**
 * ACR comparison — the pure diff behind `fcharts-audit --compare` (compare.ts), plus the real
 * process boundary (exit codes, install-free operation) by spawning node on the CLI entry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  compareAcrs,
  describeNonAcr,
  isAcrModel,
  renderComparison,
} from '../src/compliance/compare.ts';
import type { AcrModel, Conformance, CriterionRow, EditionKey } from '../src/compliance/types.ts';
import { EDITIONS } from '../src/compliance/editions.ts';

function row(num: string, conformance: Conformance, over: Partial<CriterionRow> = {}): CriterionRow {
  return {
    num,
    name: `SC ${num}`,
    level: 'AA',
    applicability: 'applicable',
    conformance,
    remarks: 'baseline remarks',
    verification: 'automated',
    attestationRequired: false,
    evidence: [],
    ...over,
  };
}

function model(
  version: string,
  criteria: CriterionRow[],
  edition: EditionKey = 'en301549',
): AcrModel {
  return {
    product: { name: 'fcharts', version, description: 'test', componentScope: 'chart' },
    edition: EDITIONS[edition],
    evaluation: { methods: ['test'], notes: '' },
    criteria,
    sections: [],
    summary: { byLevel: { A: {}, AA: {} }, total: {} },
    legal: '',
    generatedAt: '2026-07-01',
  };
}

// --- compareAcrs: classification ---

test('compareAcrs: identical reports — everything unchanged, no regression', () => {
  const rows = [row('1.1.1', 'Supports'), row('1.4.3', 'Partially Supports')];
  const cmp = compareAcrs(model('0.1.0', rows), model('0.2.0', rows));
  assert.equal(cmp.unchanged, 2);
  assert.equal(cmp.regression, false);
  for (const bucket of [cmp.improved, cmp.regressed, cmp.scopeChanged, cmp.added, cmp.removed]) {
    assert.deepEqual(bucket, []);
  }
});

test('compareAcrs: a weakened claim is a regression (the exit-1 condition)', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('2.1.1', 'Supports')]),
    model('0.2.0', [row('2.1.1', 'Partially Supports')]),
  );
  assert.equal(cmp.regressed.length, 1);
  assert.deepEqual(
    { from: cmp.regressed[0].from, to: cmp.regressed[0].to, kind: cmp.regressed[0].kind },
    { from: 'Supports', to: 'Partially Supports', kind: 'regressed' },
  );
  assert.equal(cmp.regression, true);
});

test('compareAcrs: a strengthened claim is an improvement, not a regression', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.4.3', 'Partially Supports')]),
    model('0.2.0', [row('1.4.3', 'Supports')]),
  );
  assert.equal(cmp.improved.length, 1);
  assert.equal(cmp.regression, false);
});

test('compareAcrs: transitions across Not Applicable are scope changes, not rank moves', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.2.1', 'Not Applicable'), row('1.4.5', 'Supports')]),
    model('0.2.0', [row('1.2.1', 'Supports'), row('1.4.5', 'Not Applicable')]),
  );
  assert.equal(cmp.scopeChanged.length, 2);
  assert.equal(cmp.improved.length, 0);
  assert.equal(cmp.regressed.length, 0);
  assert.equal(cmp.regression, false);
});

test('compareAcrs: newly-in-scope-and-failing counts as a regression', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.2.1', 'Not Applicable')]),
    model('0.2.0', [row('1.2.1', 'Does Not Support')]),
  );
  assert.equal(cmp.scopeChanged.length, 1);
  assert.equal(cmp.regression, true);
});

test('compareAcrs: criteria present on one side only land in added/removed', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.1.1', 'Supports'), row('9.9.9', 'Supports')]),
    model('0.2.0', [row('1.1.1', 'Supports'), row('8.8.8', 'Partially Supports')]),
  );
  assert.deepEqual(cmp.added.map((r) => r.num), ['8.8.8']);
  assert.deepEqual(cmp.removed.map((r) => r.num), ['9.9.9']);
  assert.equal(cmp.regression, false);
});

test('compareAcrs: same conformance with reworded remarks is remarks-only', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.1.1', 'Supports')]),
    model('0.2.0', [row('1.1.1', 'Supports', { remarks: 'new evidence wording' })]),
  );
  assert.deepEqual(cmp.remarksOnly.map((r) => r.num), ['1.1.1']);
  assert.equal(cmp.unchanged, 0);
});

test('compareAcrs: a verdict change carries the new remarks when they changed too', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('2.1.1', 'Supports')]),
    model('0.2.0', [row('2.1.1', 'Partially Supports', { remarks: 'keyboard gap found' })]),
  );
  assert.equal(cmp.regressed[0].newRemarks, 'keyboard gap found');
});

test('compareAcrs: differing editions are flagged, comparison still runs', () => {
  const cmp = compareAcrs(
    model('0.1.0', [row('1.1.1', 'Supports')], 'en301549'),
    model('0.2.0', [row('1.1.1', 'Supports')], 'section508'),
  );
  assert.equal(cmp.editionMismatch, true);
  assert.equal(cmp.unchanged, 1);
});

// --- renderComparison: the stdout view ---

test('renderComparison: verdict line and change lines are present and readable', () => {
  const oldM = model('0.1.0', [row('2.1.1', 'Supports')]);
  const newM = model('0.2.0', [row('2.1.1', 'Partially Supports')]);
  const text = renderComparison(compareAcrs(oldM, newM), oldM, newM);
  assert.match(text, /old: 0\.1\.0/);
  assert.match(text, /new: 0\.2\.0/);
  assert.match(text, /1 regressed:/);
  assert.match(text, /2\.1\.1 SC 2\.1\.1: Supports → Partially Supports/);
  assert.match(text, /✗ conformance regressed/);

  const clean = renderComparison(compareAcrs(oldM, oldM), oldM, oldM);
  assert.match(clean, /✓ no conformance regression/);
});

// --- isAcrModel / describeNonAcr: input guarding ---

test('isAcrModel: accepts a real model, rejects wrong shapes', () => {
  assert.equal(isAcrModel(model('0.1.0', [row('1.1.1', 'Supports')])), true);
  assert.equal(isAcrModel({}), false);
  assert.equal(isAcrModel(null), false);
  assert.equal(isAcrModel('[]'), false);
  const bogusConformance = model('0.1.0', [row('1.1.1', 'Sorta' as Conformance)]);
  assert.equal(isAcrModel(bogusConformance), false);
});

test('describeNonAcr: points an audit-report.json at the right file', () => {
  const msg = describeNonAcr({ pass: true, checkCounts: {}, report: {} });
  assert.match(msg ?? '', /audit-report\.json/);
  assert.equal(describeNonAcr({ some: 'thing' }), undefined);
});

// --- the real CLI boundary (fast: compare mode never launches a browser) ---

const CLI = 'src/compliance/cli.ts';
function runCli(args: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('cli --compare: exit 0 on no regression, 1 on regression, 2 on bad input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fc-compare-'));
  try {
    const oldPath = join(dir, 'old.json');
    const newPath = join(dir, 'new.json');
    const worse = join(dir, 'worse.json');
    writeFileSync(oldPath, JSON.stringify(model('0.1.0', [row('1.1.1', 'Supports')])));
    writeFileSync(newPath, JSON.stringify(model('0.2.0', [row('1.1.1', 'Supports')])));
    writeFileSync(worse, JSON.stringify(model('0.2.0', [row('1.1.1', 'Does Not Support')])));

    const ok = runCli(['--compare', oldPath, newPath]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /✓ no conformance regression/);

    const bad = runCli(['--compare', oldPath, worse]);
    assert.equal(bad.status, 1, bad.stderr);
    assert.match(bad.stdout, /✗ conformance regressed/);

    const missing = runCli(['--compare', oldPath, join(dir, 'nope.json')]);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /could not read/);

    writeFileSync(newPath, JSON.stringify({ pass: true, checkCounts: {} }));
    const wrongShape = runCli(['--compare', oldPath, newPath]);
    assert.equal(wrongShape.status, 2);
    assert.match(wrongShape.stderr, /audit-report\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli --compare: --json emits the machine-readable comparison', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fc-compare-json-'));
  try {
    const a = join(dir, 'a.json');
    const b = join(dir, 'b.json');
    writeFileSync(a, JSON.stringify(model('0.1.0', [row('1.1.1', 'Supports')])));
    writeFileSync(b, JSON.stringify(model('0.2.0', [row('1.1.1', 'Partially Supports')])));
    const r = runCli(['--compare', a, b, '--json']);
    assert.equal(r.status, 1);
    const parsed = JSON.parse(r.stdout) as { regressed: unknown[]; regression: boolean };
    assert.equal(parsed.regression, true);
    assert.equal(parsed.regressed.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
