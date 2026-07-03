/**
 * Matrix heatmap — a rows × cols grid of value-colored cells, as a pure SVG string (no DOM).
 *
 * One cell per (row, col); the fill is a linear-interpolated point on a two-stop sequential ramp
 * spanning the min/max of the cell values, so magnitude reads as color intensity. A cell absent
 * from the data is drawn as a faint outlined slot, not a zero — missing data and a low value stay
 * distinct. Every cell keeps its outline so a pale low cell still reads on either theme, and the
 * value lives in the cell `<title>` + the embedded JSON, so nothing is color-only. Agent-readable:
 * the full cell table with the domain min/max + a one-line `<desc>` naming the peak cell.
 */
import { resolveTheme, type SvgTheme } from './svg-theme.ts';
import { anchor, bgRect, embedSummary, esc, n, svgDocument, text } from './svg-util.ts';

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  /** Overrides the default "row × col: value" cell tooltip. */
  label?: string;
  /** Drill-down target; wraps the cell in a focusable `<a href>` (presentation only). */
  href?: string;
}

export interface HeatmapOptions {
  width: number;
  theme?: Partial<SvgTheme>;
  /** Accessible name / title. Default 'Heatmap'. */
  title?: string;
  /** Height of each cell row, px. Default 22. */
  cellHeight?: number;
  /** Format cell values for the cell `<title>` + the legend. Default `String`. */
  formatValue?: (v: number) => string;
  /** Two-stop sequential ramp [lowColor, highColor]; cells interpolate linearly in sRGB.
   *  Default a light-blue → dark-blue pair readable on both themes (paired with the cell outline). */
  colors?: readonly [string, string];
  embedData?: boolean;
}

/** Default sequential ramp: pale blue → dark blue. The per-cell grid outline keeps a faint low
 *  cell legible on a white background; the saturated high end reads on the dark theme. */
const DEFAULT_COLORS: readonly [string, string] = ['#dbeafe', '#1d4ed8'];

const M = { left: 120, right: 16, top: 30, bottom: 10 };
const LEGEND = { gap: 18, barW: 160, barH: 10, labelH: 16, steps: 24 };

/** Map key for the (row, col) cell lookup; NUL-separated so no label pair can collide. */
const cellKey = (row: string, col: string): string => `${row}\u0000${col}`;

interface Domain {
  min: number;
  max: number;
  peak: HeatmapCell | null;
  hasData: boolean;
}

/** Geometry + paint shared by the part builders. */
interface HeatCtx {
  theme: SvgTheme;
  plotL: number;
  plotR: number;
  cellW: number;
  cellH: number;
  colors: readonly [string, string];
}

/** The declared axes + the rendered-cell lookup + the value domain — the one set every part reads. */
interface Grid {
  rows: readonly string[];
  cols: readonly string[];
  lookup: Map<string, HeatmapCell>;
  dom: Domain;
}

/** Parse an `#rgb` / `#rrggbb` color to [r,g,b] 0–255, or null when it isn't a hex literal. */
function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (d) => d + d) : m[1];
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

/** Linear sRGB interpolation between two hex colors. Falls back to the nearer endpoint for a
 *  non-hex ramp (interpolation needs channel values a plain color string can't provide). */
function lerpColor(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  const hex = (i: number): string =>
    Math.round(ca[i] + (cb[i] - ca[i]) * t).toString(16).padStart(2, '0');
  return `#${hex(0)}${hex(1)}${hex(2)}`;
}

/** A value's fill on the ramp. The endpoints return the exact ramp colors (so the min cell is
 *  colors[0], the max colors[1]); a degenerate single-value domain maps to the ramp midpoint. */
function cellFill(value: number, dom: Domain, colors: readonly [string, string]): string {
  if (dom.min === dom.max) return lerpColor(colors[0], colors[1], 0.5);
  const t = (value - dom.min) / (dom.max - dom.min);
  if (t <= 0) return colors[0];
  if (t >= 1) return colors[1];
  return lerpColor(colors[0], colors[1], t);
}

/** Min/max/peak over the rendered cells (empty → a zero domain flagged `hasData: false`). */
function domainOf(valid: readonly HeatmapCell[]): Domain {
  if (valid.length === 0) return { min: 0, max: 0, peak: null, hasData: false };
  let min = Infinity;
  let max = -Infinity;
  let peak = valid[0];
  for (const c of valid) {
    if (c.value < min) min = c.value;
    if (c.value > max) max = c.value;
    if (c.value > peak.value) peak = c;
  }
  return { min, max, peak, hasData: true };
}

/** Cell width, document height, and the legend's top edge for the given axes counts. */
function layout(width: number, rows: number, cols: number, cellH: number, hasData: boolean): {
  cellW: number;
  height: number;
  legendTop: number;
} {
  const cellW = cols > 0 ? Math.max(0, width - M.left - M.right) / cols : 0;
  const gridBottom = M.top + rows * cellH;
  const legendTop = gridBottom + LEGEND.gap;
  const height = hasData ? legendTop + LEGEND.barH + LEGEND.labelH : gridBottom + M.bottom;
  return { cellW, height, legendTop };
}

/** Grid cells: a filled, outlined rect where a value exists, else a faint outline-only slot. */
function gridParts(ctx: HeatCtx, grid: Grid, fmt: (v: number) => string): string[] {
  const { theme, plotL, cellW, cellH, colors } = ctx;
  const out: string[] = [];
  grid.rows.forEach((row, ri) => {
    const y = M.top + ri * cellH;
    grid.cols.forEach((col, ci) => {
      const geom = `x="${n(plotL + ci * cellW)}" y="${n(y)}" width="${n(cellW)}" height="${n(cellH)}"`;
      const cell = grid.lookup.get(cellKey(row, col));
      if (!cell) {
        // Missing data is not zero — an unfilled, faintly outlined slot.
        out.push(`<rect ${geom} fill="none" stroke="${esc(theme.grid)}" stroke-width="1"/>`);
        return;
      }
      const tip = cell.label ?? `${row} × ${col}: ${fmt(cell.value)}`;
      const rect =
        `<rect ${geom} fill="${esc(cellFill(cell.value, grid.dom, colors))}" ` +
        `stroke="${esc(theme.grid)}" stroke-width="1"><title>${esc(tip)}</title></rect>`;
      out.push(anchor(cell.href, rect));
    });
  });
  return out;
}

/** Column labels along the top (centered, may overlap for many columns) + row labels in the gutter. */
function labelParts(ctx: HeatCtx, grid: Grid): string[] {
  const { theme, plotL, cellW, cellH } = ctx;
  const out: string[] = [];
  grid.cols.forEach((col, ci) => {
    out.push(text(plotL + (ci + 0.5) * cellW, M.top - 8, esc(col), { fill: theme.tick, anchor: 'middle' }));
  });
  grid.rows.forEach((row, ri) => {
    out.push(text(M.left - 8, M.top + (ri + 0.5) * cellH + 4, esc(row), { fill: theme.tick, anchor: 'end' }));
  });
  return out;
}

/** A stepped color ramp (same interpolation as the cells) with min/max value labels beneath it. */
function legendParts(ctx: HeatCtx, top: number, dom: Domain, fmt: (v: number) => string): string[] {
  const { theme, plotL, plotR, colors } = ctx;
  const barW = Math.min(LEGEND.barW, Math.max(0, plotR - plotL));
  const step = barW / LEGEND.steps;
  const out: string[] = [];
  for (let i = 0; i < LEGEND.steps; i++) {
    const t = LEGEND.steps > 1 ? i / (LEGEND.steps - 1) : 0;
    // Overlap each step by 0.5px so the ramp reads seamless instead of hairline-gapped.
    out.push(
      `<rect x="${n(plotL + i * step)}" y="${n(top)}" width="${n(step + 0.5)}" ` +
        `height="${n(LEGEND.barH)}" fill="${esc(lerpColor(colors[0], colors[1], t))}"/>`,
    );
  }
  const labelY = top + LEGEND.barH + 12;
  out.push(
    text(plotL, labelY, esc(fmt(dom.min)), { fill: theme.tick }),
    text(plotL + barW, labelY, esc(fmt(dom.max)), { fill: theme.tick, anchor: 'end' }),
  );
  return out;
}

interface HeatSummary {
  type: 'heatmap';
  label: string;
  rows: string[];
  cols: string[];
  min: number | null;
  max: number | null;
  cells: { row: string; col: string; value: number }[];
}

function heatmapSummary(
  label: string,
  rows: readonly string[],
  cols: readonly string[],
  valid: readonly HeatmapCell[],
): HeatSummary {
  return {
    type: 'heatmap',
    label,
    rows: [...rows],
    cols: [...cols],
    min: valid.length ? Math.min(...valid.map((c) => c.value)) : null,
    max: valid.length ? Math.max(...valid.map((c) => c.value)) : null,
    cells: valid.map((c) => ({ row: c.row, col: c.col, value: c.value })),
  };
}

function heatmapDesc(
  label: string,
  rows: readonly string[],
  cols: readonly string[],
  peak: HeatmapCell | null,
  fmt: (v: number) => string,
): string {
  const grid = `${rows.length}×${cols.length} grid`;
  if (!peak) return `${label}: ${grid}; no data.`;
  return `${label}: ${grid}; peak ${peak.row}/${peak.col} ${fmt(peak.value)}.`;
}

/** Build a matrix heatmap as a standalone SVG string. */
export function buildHeatmapSVG(
  spec: { rows: readonly string[]; cols: readonly string[]; cells: readonly HeatmapCell[] },
  opts: HeatmapOptions,
): string {
  const theme = resolveTheme(opts.theme);
  const title = opts.title ?? 'Heatmap';
  const fmt = opts.formatValue ?? ((v: number) => String(v));
  const colors = opts.colors ?? DEFAULT_COLORS;
  const cellH = opts.cellHeight ?? 22;

  // Cells for an undeclared row/col are dropped (fail-soft); `valid` is the single set the grid,
  // domain, summary, and desc all read, so cell counts / min / max / peak stay consistent.
  const rowSet = new Set(spec.rows);
  const colSet = new Set(spec.cols);
  const valid = spec.cells.filter((c) => rowSet.has(c.row) && colSet.has(c.col));
  const grid: Grid = {
    rows: spec.rows,
    cols: spec.cols,
    lookup: new Map(valid.map((c) => [cellKey(c.row, c.col), c])),
    dom: domainOf(valid),
  };

  const { cellW, height, legendTop } =
    layout(opts.width, spec.rows.length, spec.cols.length, cellH, grid.dom.hasData);
  const ctx: HeatCtx = { theme, plotL: M.left, plotR: opts.width - M.right, cellW, cellH, colors };

  const parts: string[] = [
    bgRect(opts.width, height, theme.bg),
    ...gridParts(ctx, grid, fmt),
    ...labelParts(ctx, grid),
  ];
  if (grid.dom.hasData) parts.push(...legendParts(ctx, legendTop, grid.dom, fmt));

  const extra = opts.embedData === false
    ? undefined
    : embedSummary(heatmapSummary(title, spec.rows, spec.cols, valid));
  return svgDocument({
    width: opts.width,
    height,
    title,
    desc: heatmapDesc(title, spec.rows, spec.cols, grid.dom.peak, fmt),
    body: parts.join(''),
    extra,
  });
}
