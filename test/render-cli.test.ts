/**
 * `fcharts-render` CLI — spec JSON in, SVG out. Exercises the real process boundary
 * (argv, stdin, exit codes, stderr) by spawning node on the source entry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = 'src/render-cli.ts';
const SPEC = {
  config: {
    series: [{ name: 'Price', color: '#16a34a' }],
    options: { ariaLabel: 'CLI chart', xLabel: 't' },
  },
  data: { x: [0, 1, 2, 3], y: [[10, 12, 11, 14]] },
  svg: { width: 480, height: 240 },
};

function run(args: string[], input?: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8' });
}

test('render-cli: renders a spec file to a standalone SVG on stdout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fc-cli-'));
  const file = join(dir, 'spec.json');
  writeFileSync(file, JSON.stringify(SPEC));
  try {
    const svg = execFileSync(process.execPath, [CLI, file], { encoding: 'utf8' });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /aria-label="CLI chart"/);
    assert.match(svg, /viewBox="0 0 480 240"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('render-cli: reads stdin, honors the dark theme keyword', () => {
  const dark = { ...SPEC, svg: { ...SPEC.svg, theme: 'dark' } };
  const r = run([], JSON.stringify(dark));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fill="#0a0d12"/); // darkTheme.bg
});

test('render-cli: --help prints usage and exits 0', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /fcharts-render/);
  assert.match(r.stdout, /"config"/);
});

test('render-cli: fails fast with actionable messages on bad input', () => {
  const noSeries = run([], JSON.stringify({ ...SPEC, config: { series: [] } }));
  assert.equal(noSeries.status, 1);
  assert.match(noSeries.stderr, /config\.series/);

  const badJson = run([], '{nope');
  assert.equal(badJson.status, 1);
  assert.match(badJson.stderr, /not valid JSON/);

  const noSize = run([], JSON.stringify({ ...SPEC, svg: { width: 480 } }));
  assert.equal(noSize.status, 1);
  assert.match(noSize.stderr, /svg\.width and spec\.svg\.height/);

  const missingFile = run(['/definitely/not/here.json']);
  assert.equal(missingFile.status, 1);
  assert.match(missingFile.stderr, /cannot read spec file/);

  // Slot mismatch propagates renderSVG's actionable error.
  const badSlots = run([], JSON.stringify({ ...SPEC, data: { x: [0], y: [[1], [2]] } }));
  assert.equal(badSlots.status, 1);
  assert.match(badSlots.stderr, /y arrays/);
});
