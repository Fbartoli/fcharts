// Set before any Date use: local-time tick math must be deterministic in CI and on dev machines.
process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultFormatters,
  formatTick,
  formatTimeTick,
  localeNumberFormatter,
  localeTimeFormatter,
} from '../src/core/ticks.ts';
import { renderSVG } from '../src/renderers/render-svg.ts';

// Assertions on Intl output are tolerant (substrings, not exact strings): CLDR phrasing can
// shift between ICU versions, but a German "März" or a French decimal comma cannot become
// English without the locale being ignored — which is what these tests guard.

test('localeTimeFormatter: same boundary cascade as formatTimeTick, localized labels', () => {
  const de = localeTimeFormatter('de');
  assert.match(de(Date.UTC(2026, 0, 1)), /2026/); // Jan 1 → year
  assert.match(de(Date.UTC(2026, 2, 1)), /Mär/); // month start → month name
  assert.match(de(Date.UTC(2026, 4, 15)), /15\.?\s*Mai|Mai\s*15/); // mid-month → day + month
  assert.match(de(Date.UTC(2026, 4, 15, 9, 30)), /09:30/); // clock time
  assert.match(de(Date.UTC(2026, 4, 15, 9, 30, 5)), /09:30:05/);

  const fr = localeTimeFormatter('fr');
  assert.match(fr(Date.UTC(2026, 3, 1)), /avr/i); // avril
});

test('localeNumberFormatter: locale digits and separators on all three branches', () => {
  const fr = localeNumberFormatter('fr');
  assert.match(fr(12500), /12,5/); // compact thousands, French decimal comma
  assert.match(fr(0.5), /0,50/); // sub-unit values keep two decimals
  assert.equal(fr(42), '42');

  const en = localeNumberFormatter('en');
  assert.equal(en(12500), '12.5K');
  assert.equal(en(0.5), '0.50');
  assert.equal(en(2.25), '2.3');
});

test('locale formatters: an invalid BCP-47 tag fails fast at construction', () => {
  assert.throws(() => localeNumberFormatter('not a locale'), RangeError);
  assert.throws(() => localeTimeFormatter('not a locale'), RangeError);
});

test('defaultFormatters: without a locale the defaults ARE the hand-rolled functions', () => {
  // Reference equality — the strongest byte-identity guarantee for the no-locale path.
  const linear = defaultFormatters('linear', undefined);
  assert.equal(linear.x, formatTick);
  assert.equal(linear.y, formatTick);
  const time = defaultFormatters('time', undefined);
  assert.equal(time.x, formatTimeTick);
  assert.equal(time.y, formatTick);
  assert.equal(defaultFormatters(undefined, undefined).x, formatTick);
});

test('renderSVG: the locale option localizes default tick labels; explicit formatX wins', () => {
  const config = {
    series: [{ name: 'Umsatz' }],
    options: { xType: 'time' as const, ariaLabel: 'Umsatz', locale: 'de' },
  };
  // Month-start ticks across H1 2026 (UTC): the German SVG must label March in German.
  const x = [0, 1, 2, 3, 4, 5].map((m) => Date.UTC(2026, m, 1));
  const data = { x, y: [[1200, 3400, 800, 15000, 9800, 12500]] };
  const svg = renderSVG(config, data, { width: 640, height: 320 });
  assert.match(svg, /Mär/);
  assert.doesNotMatch(svg, />Mar</);

  const overridden = renderSVG(
    { ...config, options: { ...config.options, formatX: () => 'X' } },
    data,
    { width: 640, height: 320 },
  );
  assert.doesNotMatch(overridden, /Mär/);
});
