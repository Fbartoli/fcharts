#!/usr/bin/env node
/**
 * `fcharts-render` — chart spec JSON in, standalone accessible SVG out. Makes the server-side
 * renderer usable from shells, report pipelines, and agents with no browser and no code:
 *
 *   fcharts-render spec.json > chart.svg
 *   echo '{"config":{...},"data":{...},"svg":{"width":640,"height":320}}' | fcharts-render
 *
 * Spec shape: `{ config, data, svg }` — `config`/`data` exactly as `renderSVG` takes them
 * (series, options, annotations; columnar x/y), `svg` its size/theme options where `theme`
 * may also be the string `"light"` or `"dark"`.
 */
import { readFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { darkTheme, lightTheme, renderSVG } from './index.ts';
import type { RenderSVGChartOptions, RenderSVGOptions, SvgTheme } from './index.ts';
import type { AnnotationSpec, FChartData, SeriesConfig } from './core/model.ts';

const HELP = `fcharts-render — render a chart spec (JSON) to a standalone SVG on stdout.

Usage:
  fcharts-render <spec.json>     read the spec from a file
  fcharts-render                 read the spec from stdin (also: fcharts-render -)

Spec: {
  "config": { "series": [{ "name": "Price", "color": "#16a34a" }], "options": { ... } },
  "data":   { "x": [0, 1, 2], "y": [[10, 12, 11]] },
  "svg":    { "width": 640, "height": 320, "theme": "dark" }
}
"theme" is "light" (default), "dark", or a partial theme object of color overrides.
`;

function fail(message: string): never {
  stderr.write(`fcharts-render: ${message}\n`);
  exit(1);
}

interface Spec {
  config: { series: SeriesConfig[]; options?: RenderSVGChartOptions; annotations?: AnnotationSpec[] };
  data: FChartData;
  svg: Omit<RenderSVGOptions, 'theme'> & { theme?: 'light' | 'dark' | Partial<SvgTheme> };
}

/** Structural validation with actionable messages — a CLI's type guard. */
function parseSpec(raw: string): Spec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`spec is not valid JSON — ${(e as Error).message}`);
  }
  const spec = parsed as Partial<Spec>;
  if (!spec || typeof spec !== 'object') fail('spec must be a JSON object (see --help)');
  if (!Array.isArray(spec.config?.series) || spec.config.series.length === 0) {
    fail('spec.config.series must be a non-empty array of { name, color?, type? }');
  }
  if (!Array.isArray(spec.data?.x) || !Array.isArray(spec.data?.y)) {
    fail('spec.data must be columnar: { x: number[], y: number[][] }');
  }
  const { width, height } = spec.svg ?? {};
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    fail('spec.svg.width and spec.svg.height must be positive numbers');
  }
  return spec as Spec;
}

function resolveThemeArg(theme: Spec['svg']['theme']): RenderSVGOptions['theme'] {
  if (theme === undefined || theme === 'light') return undefined;
  if (theme === 'dark') return darkTheme;
  if (typeof theme === 'object') return { ...lightTheme, ...theme };
  fail(`spec.svg.theme must be "light", "dark", or a color-override object, got ${JSON.stringify(theme)}`);
}

const arg = argv[2];
if (arg === '--help' || arg === '-h') {
  stdout.write(HELP);
  exit(0);
}
let raw: string;
try {
  raw = readFileSync(arg && arg !== '-' ? arg : 0, 'utf8');
} catch (e) {
  fail(`cannot read spec ${arg && arg !== '-' ? `file "${arg}"` : 'from stdin'} — ${(e as Error).message}`);
}
const spec = parseSpec(raw);
try {
  stdout.write(`${renderSVG(spec.config, spec.data, { ...spec.svg, theme: resolveThemeArg(spec.svg.theme) })}\n`);
} catch (e) {
  fail((e as Error).message);
}
