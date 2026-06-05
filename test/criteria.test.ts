import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITERIA } from '../src/compliance/criteria.ts';
import type { Conformance } from '../src/compliance/types.ts';

// The canonical WCAG 2.2 Level A + AA success criteria (4.1.1 removed in 2.2). 55 total.
const CANON = [
  '1.1.1', '1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.3.1', '1.3.2', '1.3.3', '1.3.4', '1.3.5',
  '1.4.1', '1.4.2', '1.4.3', '1.4.4', '1.4.5', '1.4.10', '1.4.11', '1.4.12', '1.4.13',
  '2.1.1', '2.1.2', '2.1.4', '2.2.1', '2.2.2', '2.3.1', '2.4.1', '2.4.2', '2.4.3', '2.4.4', '2.4.5',
  '2.4.6', '2.4.7', '2.4.11', '2.5.1', '2.5.2', '2.5.3', '2.5.4', '2.5.7', '2.5.8',
  '3.1.1', '3.1.2', '3.2.1', '3.2.2', '3.2.3', '3.2.4', '3.2.6', '3.3.1', '3.3.2', '3.3.3', '3.3.4',
  '3.3.7', '3.3.8', '4.1.2', '4.1.3',
];

const wcag = CRITERIA.filter((c) => !c.adaptation);

test('baseline: every canonical WCAG 2.2 A/AA SC present exactly once, no extras', () => {
  const nums = wcag.map((c) => c.num);
  assert.equal(new Set(nums).size, nums.length, 'duplicate SC');
  assert.deepEqual([...nums].sort(), [...CANON].sort());
});

test('baseline: WCAG tally is the committed 33 / 2 / 20', () => {
  const t: Partial<Record<Conformance, number>> = {};
  for (const c of wcag) t[c.conformance] = (t[c.conformance] ?? 0) + 1;
  assert.equal(t['Supports'], 33);
  assert.equal(t['Partially Supports'], 2);
  assert.equal(t['Not Applicable'], 20);
  assert.equal(t['Does Not Support'] ?? 0, 0);
});

test('baseline: the 2 remaining Partially Supports are the host-dependent pair', () => {
  const partial = wcag.filter((c) => c.conformance === 'Partially Supports').map((c) => c.num).sort();
  assert.deepEqual(partial, ['1.4.3', '2.4.11']); // text-on-host-bg, focus-not-obscured
});

test('baseline: two adaptation rows (reduced-motion + forced-colors, both Supports)', () => {
  const adapt = CRITERIA.filter((c) => c.adaptation);
  assert.equal(adapt.length, 2);
  assert.equal(adapt.find((c) => c.num === 'reduced-motion')?.conformance, 'Supports');
  assert.equal(adapt.find((c) => c.num === 'forced-colors')?.conformance, 'Supports');
});

test('baseline: applicability and conformance agree', () => {
  for (const c of CRITERIA) {
    if (c.applicability === 'not-applicable') {
      assert.equal(c.conformance, 'Not Applicable', `${c.num} N/A mismatch`);
    } else {
      assert.notEqual(c.conformance, 'Not Applicable', `${c.num} applicable but marked N/A`);
    }
  }
});

test('baseline: attestationRequired iff verification is not "automated"', () => {
  for (const c of CRITERIA) {
    assert.equal(c.attestationRequired, c.verification !== 'automated', `${c.num} attestation mismatch`);
  }
});

test('baseline: every remark ends with a verification tag matching its class', () => {
  for (const c of CRITERIA) {
    const m = c.remarks.match(/\(verified: (automated|hybrid|manual-attestation)\)\s*$/);
    assert.ok(m, `${c.num} remark missing verification tag`);
    assert.equal(m![1], c.verification, `${c.num} tag != verification field`);
  }
});

test('baseline: levels valid, names non-empty, evidence present', () => {
  for (const c of CRITERIA) {
    assert.ok(c.level === 'A' || c.level === 'AA', `${c.num} bad level`);
    assert.ok(c.name.length > 0, `${c.num} empty name`);
    assert.ok(c.evidence.length >= 1, `${c.num} no evidence`);
  }
});

test('baseline: known level spot-checks (incl. new-in-2.2 criteria)', () => {
  const lv = Object.fromEntries(CRITERIA.map((c) => [c.num, c.level]));
  for (const [num, level] of [['1.1.1', 'A'], ['1.3.5', 'AA'], ['2.4.11', 'AA'], ['2.5.7', 'AA'],
    ['2.5.8', 'AA'], ['3.2.6', 'A'], ['3.3.7', 'A'], ['3.3.8', 'AA'], ['4.1.2', 'A'], ['4.1.3', 'AA']]) {
    assert.equal(lv[num], level, `${num} expected level ${level}`);
  }
});
