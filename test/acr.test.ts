import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, renderAcr, tally } from '../src/compliance/acr.ts';
import { CRITERIA } from '../src/compliance/criteria.ts';
import type { BuildModelInput, EditionKey } from '../src/compliance/index.ts';

const base = (edition: EditionKey, signed?: { signer: string; date: string }): BuildModelInput => ({
  criteria: CRITERIA,
  edition,
  product: {
    name: 'Sightline',
    version: '0.1.0',
    description: 'Fast, accessible charts.',
    componentScope: 'The chart component inside .sl-root.',
  },
  evaluation: { methods: ['axe', 'keyboard', 'contrast'], notes: 'Automated vs attested split.' },
  generatedAt: '2026-05-29',
  signed,
});

test('tally: WCAG rows count to 28 Supports / 7 Partially / 20 Not Applicable', () => {
  const wcag = CRITERIA.filter((c) => !c.adaptation);
  const t = tally(wcag);
  assert.equal(t.total['Supports'], 28);
  assert.equal(t.total['Partially Supports'], 7);
  assert.equal(t.total['Not Applicable'], 20);
  // by-level columns sum back to the totals
  const sum = (k: 'Supports' | 'Partially Supports' | 'Not Applicable'): number =>
    (t.byLevel.A[k] ?? 0) + (t.byLevel.AA[k] ?? 0);
  assert.equal(sum('Supports'), 28);
  assert.equal(sum('Not Applicable'), 20);
});

test('buildModel: edition framing + sections (EN/508 get extra tables, WCAG does not)', () => {
  assert.equal(buildModel(base('wcag')).sections.length, 0);
  const en = buildModel(base('en301549'));
  assert.deepEqual(en.sections.map((s) => s.id), ['fp', 'software', 'docs']);
  assert.match(en.edition.title, /EN 301 549/);
});

test('functional performance is DERIVED and never contradicts the SCs', () => {
  const fp = buildModel(base('en301549')).sections.find((s) => s.id === 'fp')!.rows;
  const by = Object.fromEntries(fp.map((r) => [r.name, r.conformance]));
  assert.equal(by['Usage without vision'], 'Supports'); // 1.1.1/1.3.1/2.1.1/4.1.2/4.1.3 all Support
  assert.equal(by['Usage without perception of color'], 'Partially Supports'); // 1.4.1 is Partially
  assert.equal(by['Usage with limited manipulation or strength'], 'Partially Supports'); // 2.5.7
  assert.equal(by['Usage without hearing'], 'Supports'); // no audio
});

test('Section 508 FP omits the statements 508 lacks (photosensitive, privacy)', () => {
  const fp = buildModel(base('section508')).sections.find((s) => s.id === 'fp')!.rows;
  assert.equal(fp.length, 9);
  assert.ok(!fp.some((r) => /photosensitive|Privacy/.test(r.name)));
});

test('renderAcr json round-trips and carries the full model', () => {
  const m = buildModel(base('en301549'));
  const parsed = JSON.parse(renderAcr(m, 'json'));
  assert.equal(parsed.summary.total['Supports'], 28);
  assert.equal(parsed.criteria.length, CRITERIA.length);
});

test('renderAcr markdown has principle tables, summary, and the legal block', () => {
  const md = renderAcr(buildModel(base('en301549')), 'md');
  for (const h of ['## Perceivable', '## Operable', '## Understandable', '## Robust', '## Summary', '## Legal']) {
    assert.ok(md.includes(h), `missing ${h}`);
  }
  assert.ok(md.includes('28 Supports'));
  assert.ok(md.includes('1.4.11 Non-text Contrast'));
});

test('renderAcr html is a self-contained doc with an embedded machine-readable model', () => {
  const html = renderAcr(buildModel(base('en301549')), 'html');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<style>') && html.includes('data-acr'));
  assert.ok(!html.includes('<script>alert')); // escaping sanity
});

test('DRAFT vs signed: unsigned shows DRAFT, signed shows the signer', () => {
  const draft = renderAcr(buildModel(base('en301549')), 'md');
  assert.match(draft, /DRAFT — not signed/);
  const signed = renderAcr(buildModel(base('en301549', { signer: 'A. Auditor', date: '2026-05-29' })), 'md');
  assert.match(signed, /Signed by \*\*A\. Auditor\*\*/);
  assert.doesNotMatch(signed, /DRAFT — not signed/);
});

test('HTML escaping: a malicious product name cannot break out of a cell', () => {
  const input = base('wcag');
  input.product.name = '<img src=x onerror=alert(1)>';
  const html = renderAcr(buildModel(input), 'html');
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
});
