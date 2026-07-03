/**
 * Scatter / dot-strip — numeric x against categorical rows, as a pure SVG string (no DOM).
 *
 * One dot per position (e.g. realized APY per book position), grouped into labelled rows (tiers),
 * with optional vertical reference lines (a benchmark, per-row minimums). Dots carry a status color
 * (ok / near / over) so the encoding isn't position-only. Agent-readable: per-row counts plus, for
 * each reference line, how many points fall below it — the outliers a reviewer actually wants.
 */
import { formatTick, niceTicks } from '../core/ticks.ts';
import { linearScale, type LinearScale } from '../core/scales.ts';
import { markColor, resolveTheme, type Status, type SvgTheme } from './svg-theme.ts';
import { bgRect, embedSummary, esc, n, svgDocument, text } from './svg-util.ts';

export interface ScatterPoint {
  x: number;
  /** Row (category) this point belongs to; must match one of `rows`. */
  row: string;
  status?: Status;
  /** Explicit dot color (overrides `status`). */
  color?: string;
  /** Tooltip / accessible label for the point. */
  label?: string;
}

export interface ScatterRefLine {
  x: number;
  label: string;
  color?: string;
}

export interface ScatterOptions {
  width: number;
  theme?: Partial<SvgTheme>;
  title?: string;
  xLabel?: string;
  formatX?: (v: number) => string;
  /** Height of each row band, px. Default 34. */
  rowHeight?: number;
  /** Radius (px) of a transparent hover target placed over each dot so the `<title>` tooltip is
   *  easy to trigger (the visible dot is only ~4px). Off by default; set e.g. 11 for fat fingers /
   *  dense dot-strips. The visible dot is unchanged. */
  hoverRadius?: number;
  embedData?: boolean;
}

const M = { left: 96, right: 16, top: 22, bottom: 28 };

/** Geometry + paint shared by the part builders below. */
interface ScatterCtx {
  theme: SvgTheme;
  xScale: LinearScale;
  width: number;
  height: number;
  rowH: number;
}

const rowCenter = (ctx: ScatterCtx, i: number): number => M.top + i * ctx.rowH + ctx.rowH / 2;

/** Build a scatter / dot-strip chart as a standalone SVG string. */
export function buildScatterSVG(
  spec: { points: readonly ScatterPoint[]; rows: readonly string[]; refLines?: readonly ScatterRefLine[] },
  opts: ScatterOptions,
): string {
  const theme = resolveTheme(opts.theme);
  const title = opts.title ?? 'Scatter';
  const rowH = opts.rowHeight ?? 34;
  const refLines = spec.refLines ?? [];
  const width = opts.width;
  const height = M.top + Math.max(1, spec.rows.length) * rowH + M.bottom;

  // X-domain across points + reference lines, padded 6%.
  const xs = [...spec.points.map((p) => p.x), ...refLines.map((r) => r.x)];
  let lo = xs.length ? Math.min(...xs) : 0;
  let hi = xs.length ? Math.max(...xs) : 1;
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.06;
  const domain: [number, number] = [lo - pad, hi + pad];
  const xScale = linearScale(domain, [M.left, width - M.right]);
  const ctx: ScatterCtx = { theme, xScale, width, height, rowH };
  const rowIndex = new Map(spec.rows.map((r, i) => [r, i]));

  // Points for an undeclared row are dropped (fail-soft); `valid` is the single rendered set the
  // summary also accounts over, so total / per-row counts / below-ref counts stay consistent.
  const valid = spec.points.filter((p) => rowIndex.has(p.row));

  const parts: string[] = [
    bgRect(width, height, theme.bg),
    ...axisParts(ctx, domain, opts.formatX ?? formatTick, opts.xLabel),
    ...rowParts(ctx, spec.rows),
    ...refLineParts(ctx, refLines),
    ...dotParts(ctx, valid, rowIndex, opts.hoverRadius),
  ];

  const summary = scatterSummary(title, valid, spec.rows, refLines);
  return svgDocument({
    width,
    height,
    title,
    desc: scatterDesc(title, summary.total, spec.rows.length, summary.refLines),
    body: parts.join(''),
    extra: opts.embedData === false ? undefined : embedSummary(summary),
  });
}

/** Vertical gridlines at the x ticks, tick labels, and the optional x-axis title. */
function axisParts(
  ctx: ScatterCtx,
  domain: [number, number],
  formatX: (v: number) => string,
  xLabel?: string,
): string[] {
  const { theme, xScale, width, height } = ctx;
  const out: string[] = [];
  const ticks = niceTicks(domain[0], domain[1], 6);
  let grid = '';
  for (const t of ticks) {
    grid += `M${n(xScale(t))},${n(M.top)}V${n(height - M.bottom)}`;
  }
  out.push(`<path d="${grid}" stroke="${esc(theme.grid)}" stroke-width="1" fill="none"/>`);
  for (const t of ticks) {
    out.push(text(xScale(t), height - M.bottom + 16, esc(formatX(t)), { fill: theme.tick, anchor: 'middle' }));
  }
  if (xLabel) {
    out.push(text(width - M.right, height - M.bottom + 16, esc(xLabel), { fill: theme.label, size: 10, anchor: 'end' }));
  }
  return out;
}

/** Row labels (left gutter) + faint separators between row bands. */
function rowParts(ctx: ScatterCtx, rows: readonly string[]): string[] {
  const { theme, width } = ctx;
  const out: string[] = [];
  rows.forEach((row, i) => {
    out.push(text(M.left - 8, rowCenter(ctx, i) + 4, esc(row), { fill: theme.tick, anchor: 'end' }));
    if (i > 0) {
      const y = M.top + i * ctx.rowH;
      out.push(
        `<line x1="${n(M.left)}" y1="${n(y)}" x2="${n(width - M.right)}" ` +
          `y2="${n(y)}" stroke="${esc(theme.grid)}" stroke-width="1"/>`,
      );
    }
  });
  return out;
}

/** Vertical reference lines + their labels above the plot. */
function refLineParts(ctx: ScatterCtx, refLines: readonly ScatterRefLine[]): string[] {
  const { theme, xScale, height } = ctx;
  const out: string[] = [];
  for (const ref of refLines) {
    const px = xScale(ref.x);
    const color = ref.color || theme.label;
    out.push(
      `<line x1="${n(px)}" y1="${n(M.top)}" x2="${n(px)}" y2="${n(height - M.bottom)}" ` +
        `stroke="${esc(color)}" stroke-width="1" stroke-dasharray="4 3"/>`,
      text(px, M.top - 6, esc(ref.label), { fill: color, size: 10, anchor: 'middle' }),
    );
  }
  return out;
}

/** Dots, with small deterministic vertical jitter so co-located points in a row don't fully stack. */
function dotParts(
  ctx: ScatterCtx,
  points: readonly ScatterPoint[],
  rowIndex: Map<string, number>,
  hoverRadius?: number,
): string[] {
  const { theme, xScale } = ctx;
  const out: string[] = [];
  const perRow = new Map<string, number>();
  for (const p of points) {
    const ri = rowIndex.get(p.row) ?? 0;
    const seen = perRow.get(p.row) ?? 0;
    perRow.set(p.row, seen + 1);
    const jitter = ((seen % 5) - 2) * 4;
    const cx = xScale(p.x);
    const cy = rowCenter(ctx, ri) + jitter;
    const color = markColor(p.color, p.status);
    const tip = p.label ? `<title>${esc(p.label)}</title>` : '';
    const hoverR = hoverRadius && hoverRadius > 4 ? hoverRadius : 0;
    // With a hover target: the visible dot keeps its size; a transparent circle on top carries the
    // <title> over a larger, easy-to-hit area. Without one: the dot itself holds the <title> (default).
    out.push(
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="4" fill="${esc(color)}" ` +
        `fill-opacity="0.85" stroke="${esc(theme.bg)}" stroke-width="0.75">${hoverR ? '' : tip}</circle>`,
    );
    if (hoverR) {
      // `fc-hit` + `data-fc-swatch` are the contract `attachReadout()` reads to show a styled DOM
      // tooltip (the dot's color + the `<title>` text); the `<title>` stays as the no-JS fallback.
      out.push(
        `<circle class="fc-hit" data-fc-swatch="${esc(color)}" cx="${n(cx)}" cy="${n(cy)}" ` +
          `r="${n(hoverR)}" fill="${esc(theme.bg)}" fill-opacity="0" pointer-events="all">${tip}</circle>`,
      );
    }
  }
  return out;
}

interface RefSummary {
  label: string;
  x: number;
  below: number;
}

function scatterSummary(
  label: string,
  points: readonly ScatterPoint[],
  rows: readonly string[],
  refLines: readonly ScatterRefLine[],
): { type: 'scatter'; label: string; total: number; rows: { row: string; count: number }[]; refLines: RefSummary[] } {
  // `points` is already filtered to declared rows, so every count below is over the same set.
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.row, (counts.get(p.row) ?? 0) + 1);
  return {
    type: 'scatter',
    label,
    total: points.length,
    rows: rows.map((row) => ({ row, count: counts.get(row) ?? 0 })),
    refLines: refLines.map((ref) => ({
      label: ref.label,
      x: ref.x,
      below: points.filter((p) => p.x < ref.x).length,
    })),
  };
}

function scatterDesc(
  label: string,
  total: number,
  rowCount: number,
  refs: readonly RefSummary[],
): string {
  const base = `${label}: ${total} points across ${rowCount} rows`;
  if (refs.length === 0) return `${base}.`;
  // toSorted() isn't in the ES2020 lib target; this sorts a fresh copy, so nothing is mutated.
  // oxlint-disable-next-line unicorn/no-array-sort
  const worst = [...refs].sort((a, b) => b.below - a.below)[0];
  return `${base}; ${worst.below} below ${worst.label}.`;
}
