import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STRINGS, format, resolveStrings } from '../src/a11y/strings.ts';
import { ChartData, resolveSeries } from '../src/core/model.ts';
import { buildSummary, describeSummary } from '../src/a11y/summary.ts';

test('format: fills known tokens and leaves unknown ones intact', () => {
  assert.equal(format('{a} and {b}', { a: 'x', b: 2 }), 'x and 2');
  assert.equal(format('{missing}', {}), '{missing}'); // typos stay visible, not blanked
  assert.equal(format('no tokens', { a: 1 }), 'no tokens');
});

test('resolveStrings: overrides merge onto English defaults', () => {
  const s = resolveStrings({ shown: 'visible' });
  assert.equal(s.shown, 'visible');
  assert.equal(s.hidden, DEFAULT_STRINGS.hidden); // untouched keys keep defaults
  // no overrides → the shared default object
  assert.equal(resolveStrings(), DEFAULT_STRINGS);
});

test('describeSummary: localized strings replace every fixed phrase', () => {
  const data = new ChartData({ x: [0, 1, 2, 3], y: [[100, 110, 120, 132]] });
  const series = resolveSeries([{ name: 'Série', color: '#000' }]);
  const summary = buildSummary(data, series, 'Test');
  const fr = resolveStrings({
    summaryLine: '{label} : {points} points par série de {span}. {parts}.',
    summaryPart: '{name} va de {min} à {max}, maintenant {last} ({dir})',
    summarySpan: '{start} à {end}',
    trendUp: 'hausse {pct}%',
  });
  const text = describeSummary(summary, String, (y) => y.toFixed(0), fr);
  assert.match(text, /Test : 4 points par série de 0 à 3\./);
  assert.match(text, /Série va de 100 à 132, maintenant 132 \(hausse 32\.0%\)/);
  assert.doesNotMatch(text, /ranges|now|up /); // no English leaked through
});

test('describeSummary: default (no strings arg) keeps the English output', () => {
  const data = new ChartData({ x: [0, 1], y: [[1, 2]] });
  const series = resolveSeries([{ name: 'A', color: '#000' }]);
  const summary = buildSummary(data, series, 'T');
  assert.match(describeSummary(summary, String, (y) => y.toFixed(0)), /T: 2 points per series/);
});
