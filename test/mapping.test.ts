import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceToVerdicts, hasRegression, SC_CHECKS, CHECK_CATALOG } from '../src/compliance/mapping.ts';
import { CRITERIA } from '../src/compliance/criteria.ts';
import type { CheckReport, CriterionRow } from '../src/compliance/types.ts';

const row = (over: Partial<CriterionRow>): CriterionRow => ({
  num: '1.3.1',
  name: 'X',
  level: 'A',
  applicability: 'applicable',
  conformance: 'Supports',
  remarks: '',
  verification: 'automated',
  attestationRequired: false,
  evidence: [],
  ...over,
});

const report = (results: CheckReport['results'], axe: CheckReport['axeViolations'] = []): CheckReport => ({
  results,
  axeViolations: axe,
});

test('reducer: a passing check confirms a Supports baseline (no regression)', () => {
  const v = reduceToVerdicts(report([{ id: 'table-x-header', status: 'pass', detail: '', sc: ['1.3.1'] }]), [row({})]);
  assert.equal(v[0].observed, 'Supports');
  assert.equal(v[0].regression, false);
});

test('reducer: a failing check downgrades Supports -> Partially (regression)', () => {
  const v = reduceToVerdicts(report([{ id: 'table-x-header', status: 'fail', detail: 'x', sc: ['1.3.1'] }]), [row({})]);
  assert.equal(v[0].observed, 'Partially Supports');
  assert.equal(v[0].regression, true);
  assert.equal(hasRegression(v), true);
});

test('reducer: a failing check downgrades Partially -> Does Not Support', () => {
  const base = [row({ num: '1.4.3', conformance: 'Partially Supports', verification: 'hybrid', attestationRequired: true })];
  const v = reduceToVerdicts(report([{ id: 'contrast-default-text', status: 'fail', detail: '', sc: ['1.4.3'] }]), base);
  assert.equal(v[0].observed, 'Does Not Support');
  assert.equal(v[0].regression, true);
});

test('reducer: na checks do not affect the verdict', () => {
  const v = reduceToVerdicts(report([{ id: 'tick-findable', status: 'na', detail: '', sc: ['1.4.5'] }]),
    [row({ num: '1.4.5', conformance: 'Supports' })]);
  assert.equal(v[0].observed, 'Supports');
  assert.equal(v[0].regression, false);
});

test('reducer: a manual-attestation criterion with no checks never regresses', () => {
  const v = reduceToVerdicts(report([]), [row({ num: '2.5.1', verification: 'manual-attestation', attestationRequired: true })]);
  assert.equal(v[0].observed, 'Supports');
  assert.equal(v[0].regression, false);
});

test('reducer: an axe violation regresses the SC it maps to', () => {
  const v = reduceToVerdicts(
    report([], [{ id: 'color-contrast', impact: 'serious', sc: ['1.4.3'] }]),
    [row({ num: '1.4.3', conformance: 'Supports' })],
  );
  assert.equal(v[0].regression, true);
});

test('reducer: a Not Applicable criterion never regresses', () => {
  const v = reduceToVerdicts(report([{ id: 'x', status: 'fail', detail: '', sc: ['1.2.1'] }]),
    [row({ num: '1.2.1', applicability: 'not-applicable', conformance: 'Not Applicable' })]);
  assert.equal(v[0].observed, 'Not Applicable');
  assert.equal(v[0].regression, false);
});

test('full baseline reduces with zero checks to no regressions (observed = expected)', () => {
  const v = reduceToVerdicts(report([]), CRITERIA);
  assert.equal(v.length, CRITERIA.length);
  assert.equal(hasRegression(v), false);
});

test('SC_CHECKS / CHECK_CATALOG: every catalog SC is indexed and ids are unique', () => {
  const ids = CHECK_CATALOG.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate check ids');
  for (const c of CHECK_CATALOG) for (const sc of c.sc) assert.ok(SC_CHECKS[sc].includes(c.id));
});

// Applicable automated/hybrid criteria NOT covered by a live-gate check — each is instead
// verified by a unit test or source review, or is an inherent host-dependent attestation.
// Anything else automated/hybrid MUST have a serving check (review finding #1: a "Supports"
// row with no check can silently regress, since the reducer only ever downgrades on a fail).
const GATE_EXEMPT: Record<string, string> = {
  '2.1.4': 'unit-tested: cursor.test.ts asserts handlesKey accepts only non-character keys',
  '2.2.1': 'source: no time limits — the only timers are output coalescers (no setInterval/deadline)',
  '2.3.1': 'source: no flashing/animation mechanism (render-on-demand, single clear+repaint)',
  '2.4.11': 'hybrid/host: not entirely obscuring its own focus is geometry/host-dependent (attested)',
  '2.5.7': 'hybrid: the deferred single-pointer non-drag pan gap (R4) — no positive auto-check',
};

test('coverage: every applicable automated/hybrid criterion has a serving check or is exempt', () => {
  const uncovered = CRITERIA.filter(
    (c) =>
      c.applicability === 'applicable' &&
      c.verification !== 'manual-attestation' &&
      !(SC_CHECKS[c.num] && SC_CHECKS[c.num].length > 0) &&
      !(c.num in GATE_EXEMPT),
  ).map((c) => c.num);
  assert.deepEqual(uncovered, [], `automated/hybrid criteria with neither a serving check nor an exemption: ${uncovered.join(', ')}`);
});

test('coverage: the gate-exempt list has no stale entries (all still uncovered + applicable)', () => {
  for (const num of Object.keys(GATE_EXEMPT)) {
    const c = CRITERIA.find((x) => x.num === num);
    assert.ok(c && c.applicability === 'applicable', `exempt ${num} missing/not-applicable`);
    assert.ok(!(SC_CHECKS[num] && SC_CHECKS[num].length), `exempt ${num} now HAS a check — remove from exempt list`);
  }
});
