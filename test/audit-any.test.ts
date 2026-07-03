import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, validateArgs, shapeTargetReport } from '../src/compliance/cli.ts';
import type { Args } from '../src/compliance/cli.ts';
import type { CheckReport } from '../src/compliance/types.ts';

// --- parseArgs: the two modes and their flags ---

test('parseArgs: --target/--selector are captured and fixtureExplicit stays false', () => {
  const a = parseArgs(['--target', 'https://x.test/dash', '--selector', '#chart']);
  assert.equal(a.target, 'https://x.test/dash');
  assert.equal(a.selector, '#chart');
  assert.equal(a.fixtureExplicit, false);
});

test('parseArgs: --fixture flips fixtureExplicit and keeps the value', () => {
  const a = parseArgs(['--fixture', './a11y/fixture.ts']);
  assert.equal(a.fixture, './a11y/fixture.ts');
  assert.equal(a.fixtureExplicit, true);
  assert.equal(a.target, undefined);
});

test('parseArgs: no --fixture leaves fixtureExplicit false but keeps the default path', () => {
  const a = parseArgs([]);
  assert.equal(a.fixtureExplicit, false);
  assert.equal(a.fixture, './a11y/fixture.ts');
});

test('parseArgs: edition/format defaults are still applied for the fixture path', () => {
  const a = parseArgs(['--fixture', './a11y/fixture.ts']);
  assert.deepEqual(a.editions, ['en301549']);
  assert.deepEqual(a.formats, ['md', 'html', 'json']);
});

// --- validateArgs: mutual exclusion + selector requirement ---

const argsWith = (over: Partial<Args>): Args => ({
  fixture: './a11y/fixture.ts',
  fixtureExplicit: false,
  editions: ['en301549'],
  out: './out',
  background: '#ffffff',
  formats: ['json'],
  stamp: '2026-07-03',
  json: false,
  quiet: false,
  ...over,
});

test('validateArgs: --fixture and --target together is an error', () => {
  const err = validateArgs(argsWith({ fixtureExplicit: true, target: 'https://x.test', selector: '#c' }));
  assert.match(err ?? '', /not both/);
});

test('validateArgs: neither mode is an error', () => {
  const err = validateArgs(argsWith({ fixtureExplicit: false }));
  assert.match(err ?? '', /specify a mode/);
});

test('validateArgs: --target without --selector is an error naming --selector', () => {
  const err = validateArgs(argsWith({ target: 'https://x.test' }));
  assert.match(err ?? '', /--selector/);
});

test('validateArgs: --selector in fixture mode (no --target) is a misuse error', () => {
  const err = validateArgs(argsWith({ fixtureExplicit: true, selector: '#c' }));
  assert.match(err ?? '', /only with --target/);
});

test('validateArgs: a valid fixture run and a valid target run both pass', () => {
  assert.equal(validateArgs(argsWith({ fixtureExplicit: true })), undefined);
  assert.equal(validateArgs(argsWith({ target: 'https://x.test', selector: '#c' })), undefined);
});

// --- shapeTargetReport: report-only shape (no baseline verdicts, no ACR) ---

const fakeReport = (): CheckReport => ({
  results: [
    { id: 'canvas-hidden', status: 'pass', detail: '', sc: ['1.1.1'] },
    { id: 'keyboard-announce', status: 'fail', detail: 'no [role="application"] surface', sc: ['2.1.1'] },
    { id: 'reflow-adaptive', status: 'na', detail: 'no fcharts x-ticks', sc: ['1.4.10'] },
  ],
  axeViolations: [],
});

test('shapeTargetReport: carries target/selector and derives failingChecks from fails only', () => {
  const shaped = shapeTargetReport(
    argsWith({ target: 'https://x.test/dash', selector: '#chart' }),
    { pass: 1, fail: 1, na: 1 },
    false,
    fakeReport(),
  );
  assert.equal(shaped.mode, 'target');
  assert.equal(shaped.target, 'https://x.test/dash');
  assert.equal(shaped.selector, '#chart');
  assert.deepEqual(shaped.failingChecks, ['keyboard-announce: no [role="application"] surface']);
  assert.equal(shaped.axeSeriousFailed, false);
  assert.deepEqual(shaped.checkCounts, { pass: 1, fail: 1, na: 1 });
});

test('shapeTargetReport: omits the fixture-only gate fields (pass/product/regressions)', () => {
  const shaped = shapeTargetReport(
    argsWith({ target: 'https://x.test', selector: '#c' }),
    { pass: 0, fail: 3, na: 0 },
    true,
    fakeReport(),
  ) as unknown as Record<string, unknown>;
  assert.ok(!('pass' in shaped), 'target report must not carry a baseline pass/fail verdict');
  assert.ok(!('product' in shaped), 'target report must not claim to be the fcharts product');
  assert.ok(!('regressions' in shaped), 'target report has no baseline to regress against');
  assert.ok(!('editions' in shaped), 'target report generates no ACR editions');
});

test('shapeTargetReport: axeSeriousFailed is passed through', () => {
  const shaped = shapeTargetReport(
    argsWith({ target: 'https://x.test', selector: '#c' }),
    { pass: 0, fail: 0, na: 3 },
    true,
    fakeReport(),
  );
  assert.equal(shaped.axeSeriousFailed, true);
});
