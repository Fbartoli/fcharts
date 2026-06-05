import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PALETTE, resolveSeries } from '../src/core/model.ts';
import { ratioOf } from '../src/compliance/contrast.ts';

test('DEFAULT_PALETTE: 8 distinct colors', () => {
  assert.equal(DEFAULT_PALETTE.length, 8);
  assert.equal(new Set(DEFAULT_PALETTE).size, 8);
});

test('DEFAULT_PALETTE: every color clears 3:1 non-text contrast on light AND dark', () => {
  for (const c of DEFAULT_PALETTE) {
    assert.ok(ratioOf(c, '#ffffff')! >= 3, `${c} vs white = ${ratioOf(c, '#ffffff')!.toFixed(2)}`);
    assert.ok(ratioOf(c, '#0c1016')! >= 3, `${c} vs dark = ${ratioOf(c, '#0c1016')!.toFixed(2)}`);
    assert.ok(ratioOf(c, '#1f2937')! >= 3, `${c} vs #1f2937 = ${ratioOf(c, '#1f2937')!.toFixed(2)}`);
  }
});

test('resolveSeries: omitted color falls back to the palette by index, wraps past 8', () => {
  const r = resolveSeries([{ name: 'A' }, { name: 'B', color: '#123456' }, { name: 'C' }]);
  assert.equal(r[0].color, DEFAULT_PALETTE[0]);
  assert.equal(r[1].color, '#123456'); // explicit color wins
  assert.equal(r[2].color, DEFAULT_PALETTE[2]);
  const many = resolveSeries(Array.from({ length: 9 }, (_, i) => ({ name: `S${i}` })));
  assert.equal(many[8].color, DEFAULT_PALETTE[0]); // wraps
});
