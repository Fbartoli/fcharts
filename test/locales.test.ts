import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STRINGS, format, resolveStrings } from '../src/a11y/strings.ts';
import { stringsDE, stringsES, stringsFR } from '../src/a11y/locales.ts';

const LOCALES = { de: stringsDE, fr: stringsFR, es: stringsES } as const;

test('locales: every pack covers every key with a non-empty translation', () => {
  const keys = Object.keys(DEFAULT_STRINGS) as (keyof typeof DEFAULT_STRINGS)[];
  for (const [name, pack] of Object.entries(LOCALES)) {
    for (const key of keys) {
      assert.ok(key in pack, `${name}.${key} present`);
      assert.ok(pack[key].length > 0, `${name}.${key} non-empty`);
    }
    assert.equal(Object.keys(pack).length, keys.length, `${name} has no extra keys`);
  }
});

// The library fills these tokens; a translation that drops or typos one silently degrades.
const tokensOf = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

test('locales: templated strings keep the exact tokens the code fills', () => {
  const templated = [
    'chartName', 'tableCaption', 'summaryNoData', 'summaryAllHidden', 'summaryLine',
    'summaryPart', 'summaryEvents', 'summarySpan', 'trendUp', 'trendDown',
  ] as const;
  for (const [name, pack] of Object.entries(LOCALES)) {
    for (const key of templated) {
      assert.deepEqual(tokensOf(pack[key]), tokensOf(DEFAULT_STRINGS[key]), `${name}.${key} tokens`);
    }
  }
});

test('locales: a pack drops in through resolveStrings and formats cleanly', () => {
  const s = resolveStrings(stringsFR);
  assert.equal(s.trendFlat, 'stable');
  const line = format(s.summaryPart, { name: 'Prix', min: 1, max: 9, last: 5, dir: 'stable' });
  assert.equal(line, 'Prix varie de 1 à 9, actuellement 5 (stable)');
});
