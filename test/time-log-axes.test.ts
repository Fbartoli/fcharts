// Set before any Date use: local-time tick math must be deterministic in CI and on dev machines.
process.env.TZ = 'UTC';

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimeTick, logTicks, niceTimeTicks } from '../src/core/ticks.ts';
import { logScale } from '../src/core/scales.ts';
import { renderSVG } from '../src/renderers/render-svg.ts';

const T0 = Date.UTC(2026, 5, 15, 12, 0, 0); // 2026-06-15T12:00Z, a plain mid-year anchor

test('niceTimeTicks: minute-scale spans land on whole minutes', () => {
  const ticks = niceTimeTicks(T0, T0 + 10 * 60_000, 6);
  assert.ok(ticks.length >= 3 && ticks.length <= 8, `got ${ticks.length}`);
  for (const t of ticks) {
    assert.equal(t % 60_000, 0, `tick ${new Date(t).toISOString()} on a minute boundary`);
  }
});

test('niceTimeTicks: multi-day spans land on local midnights', () => {
  const ticks = niceTimeTicks(T0, T0 + 9 * 86_400_000, 8);
  assert.ok(ticks.length >= 3, `got ${ticks.length}`);
  for (const t of ticks) {
    const d = new Date(t);
    assert.equal(d.getHours() + d.getMinutes() + d.getSeconds(), 0, 'midnight-aligned');
  }
});

test('niceTimeTicks: week steps align to Monday; month spans to month starts', () => {
  const weeks = niceTimeTicks(T0, T0 + 60 * 86_400_000, 8);
  for (const t of weeks) assert.equal(new Date(t).getDay(), 1, 'Monday');
  const months = niceTimeTicks(T0, T0 + 300 * 86_400_000, 8);
  for (const t of months) assert.equal(new Date(t).getDate(), 1, 'first of month');
});

test('niceTimeTicks: year-scale spans tick on Jan 1; degenerate span returns the point', () => {
  const years = niceTimeTicks(T0, T0 + 5 * 365 * 86_400_000, 6);
  for (const t of years) {
    const d = new Date(t);
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 1);
  }
  assert.deepEqual(niceTimeTicks(T0, T0, 5), [T0]);
});

test('formatTimeTick: labels by the boundary the tick sits on', () => {
  assert.equal(formatTimeTick(Date.UTC(2026, 0, 1)), '2026');
  assert.equal(formatTimeTick(Date.UTC(2026, 2, 1)), 'Mar');
  assert.equal(formatTimeTick(Date.UTC(2026, 5, 15)), 'Jun 15');
  assert.equal(formatTimeTick(Date.UTC(2026, 5, 15, 9, 30)), '09:30');
  assert.equal(formatTimeTick(Date.UTC(2026, 5, 15, 9, 30, 5)), '09:30:05');
  assert.equal(formatTimeTick(Date.UTC(2026, 5, 15, 9, 30, 5, 250)), '09:30:05.250');
});

test('logTicks: decade boundaries, thinned over wide domains, densified under two decades', () => {
  assert.deepEqual(logTicks(1, 1000, 6), [1, 10, 100, 1000]);
  const wide = logTicks(1, 1e12, 5);
  assert.ok(wide.length <= 7, `thinned to ${wide.length}`);
  const narrow = logTicks(1, 40, 6);
  assert.ok(narrow.includes(2) && narrow.includes(5) && narrow.includes(20), `mantissas in ${narrow}`);
  // Sub-decade domain falls back to linear ticks rather than returning nothing.
  assert.ok(logTicks(3, 7, 5).length >= 2);
  assert.deepEqual(logTicks(-5, 10, 5), [-5], 'non-positive min degrades to the point');
});

test('logScale: decade positions are equidistant; invert round-trips; v<=0 clamps to range start', () => {
  const s = logScale([1, 100], [200, 0]);
  assert.equal(s(1), 200);
  assert.equal(s(10), 100);
  assert.equal(s(100), 0);
  assert.ok(Math.abs(s.invert(s(37)) - 37) < 1e-9);
  assert.equal(s(0), 200);
  assert.equal(s(-4), 200);
});

test('renderSVG: xType time + yScale log produce calendar labels and decade ticks', () => {
  const N = 48;
  const x = Float64Array.from({ length: N }, (_, i) => T0 + i * 3_600_000); // hourly, 2 days
  const y = Float64Array.from({ length: N }, (_, i) => Math.pow(10, 1 + (i / N) * 2)); // 10 → ~1000
  const svg = renderSVG(
    { series: [{ name: 'Load', color: '#16a34a' }], options: { ariaLabel: 'Load', xType: 'time', yScale: 'log' } },
    { x, y: [y] },
    { width: 640, height: 320 },
  );
  assert.match(svg, />(\d{2}:\d{2}|Jun \d{1,2})</, 'time-formatted x labels');
  assert.match(svg, />100</, 'decade y tick');
  assert.ok(!svg.includes('NaN'), 'no NaN coordinates');
});
