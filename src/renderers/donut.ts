/**
 * Donut / pie — categorical share-of-total as a pure SVG string (no DOM, Node-safe).
 *
 * Arcs are drawn the cheap way: concentric `<circle>` strokes sharing a center, each given a
 * `stroke-dasharray` of (arc, gap) and a `stroke-dashoffset` to place it — O(slices), fine for the
 * N <= ~30 a donut is legible at. Like every fcharts renderer it stays agent-readable: a sorted
 * shares table + a one-line `<desc>` (largest slice, headroom to an optional per-slice cap, HHI
 * concentration) and an embedded `ChartSummary`-shaped JSON block.
 */
import { DEFAULT_PALETTE } from '../core/model.ts';
import { resolveTheme, STATUS_COLORS, type SvgTheme } from './svg-theme.ts';
import { anchor, embedSummary, esc, n, svgDocument } from './svg-util.ts';

export interface DonutSlice {
  label: string;
  value: number;
  /** Slice color; falls back to the contrast-checked {@link DEFAULT_PALETTE} by order. */
  color?: string;
  /**
   * Drill-down target. When set, the slice arc and its legend row become a focusable `<a href>`
   * (e.g. a `?protocol=…` filter link) — presentation only, the summary/`<desc>` are unchanged.
   */
  href?: string;
}

export interface DonutOptions {
  /** Square diameter of the donut, in px. The legend extends to its right. */
  size: number;
  theme?: Partial<SvgTheme>;
  /** Accessible name / title. Default 'Share'. */
  title?: string;
  /** Big text in the hole (e.g. a count). */
  centerLabel?: string;
  /** Smaller text under `centerLabel`. */
  centerSub?: string;
  /** Per-slice cap as a percentage (e.g. 25 = 25%); over-cap slices are flagged. */
  capPct?: number;
  /** Render the legend column. Default true. */
  legend?: boolean;
  /** Embed the machine-readable JSON summary. Default true. */
  embedData?: boolean;
}

interface ResolvedSlice {
  label: string;
  value: number;
  color: string;
  pct: number;
  overCap: boolean;
  href?: string;
}

const LEGEND_W = 184;
const ROW_H = 18;
const PAD = 8;

/** Build a donut/pie chart as a standalone SVG string. */
export function buildDonutSVG(spec: { slices: readonly DonutSlice[] }, opts: DonutOptions): string {
  const theme = resolveTheme(opts.theme);
  const size = opts.size;
  const title = opts.title ?? 'Share';
  const total = spec.slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  const resolved: ResolvedSlice[] = spec.slices.map((s, i) => {
    const pct = total > 0 ? (Math.max(0, s.value) / total) * 100 : 0;
    return {
      label: s.label,
      value: s.value,
      color: s.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      pct,
      overCap: opts.capPct !== undefined && pct > opts.capPct + 1e-9,
      href: s.href,
    };
  });

  const cx = size / 2;
  const cy = size / 2;
  const ring = size * 0.18;
  const r = size / 2 - PAD - ring / 2;
  const circ = 2 * Math.PI * r;

  const parts: string[] = [];
  // Faint full-ring track so an empty/partial donut still reads as a ring.
  parts.push(
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" ` +
      `stroke="${esc(theme.grid)}" stroke-width="${n(ring)}"/>`,
  );

  // Arc segments, clockwise from 12 o'clock (rotate the group -90°). The dash length and the
  // running offset are accumulated from the SAME rounded arc value, so consecutive slices abut
  // exactly instead of drifting into a sub-pixel seam after many slices.
  let acc = 0;
  const arcs: string[] = [];
  for (const s of resolved) {
    if (s.pct <= 0) continue;
    const arc = Math.round((s.pct / 100) * circ * 10) / 10;
    arcs.push(
      anchor(
        s.href,
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${esc(s.color)}" ` +
          `stroke-width="${n(ring)}" stroke-dasharray="${n(arc)} ${n(circ - arc)}" ` +
          `stroke-dashoffset="${n(-acc)}"><title>${esc(s.label)}: ${s.pct.toFixed(1)}%</title></circle>`,
      ),
    );
    acc += arc;
  }
  if (arcs.length) parts.push(`<g transform="rotate(-90 ${n(cx)} ${n(cy)})">${arcs.join('')}</g>`);

  if (opts.centerLabel) {
    parts.push(
      `<text x="${n(cx)}" y="${n(cy + (opts.centerSub ? -2 : 4))}" text-anchor="middle" ` +
        `font-family="system-ui,sans-serif" font-size="${n(size * 0.13)}" font-weight="600" ` +
        `fill="${esc(theme.tick)}">${esc(opts.centerLabel)}</text>`,
    );
  }
  if (opts.centerSub) {
    parts.push(
      `<text x="${n(cx)}" y="${n(cy + size * 0.085)}" text-anchor="middle" ` +
        `font-family="system-ui,sans-serif" font-size="${n(size * 0.055)}" ` +
        `fill="${esc(theme.label)}">${esc(opts.centerSub)}</text>`,
    );
  }

  const legend = opts.legend !== false;
  if (legend) parts.push(...legendRows(resolved, size, theme));

  const width = legend ? size + LEGEND_W : size;
  const height = legend ? Math.max(size, resolved.length * ROW_H + 2 * PAD) : size;

  // toSorted() isn't in the ES2020 lib target; this sorts a fresh copy, so nothing is mutated.
  // oxlint-disable-next-line unicorn/no-array-sort
  const ordered = [...resolved].sort((a, b) => b.value - a.value);
  const summary = donutSummary(title, total, ordered, opts.capPct);

  return svgDocument({
    width,
    height,
    title,
    desc: donutDesc(title, ordered, opts.capPct),
    body: parts.join(''),
    extra: opts.embedData === false ? undefined : embedSummary(summary),
  });
}

function legendRows(slices: readonly ResolvedSlice[], size: number, theme: SvgTheme): string[] {
  const x = size + PAD;
  return slices.map((s, i) => {
    const y = PAD + i * ROW_H + 12;
    const flag = s.overCap ? `<tspan fill="${esc(STATUS_COLORS.over)}"> ⚑</tspan>` : '';
    const row =
      `<rect x="${n(x)}" y="${n(y - 9)}" width="10" height="10" rx="2" fill="${esc(s.color)}"/>` +
      `<text x="${n(x + 16)}" y="${n(y)}" font-family="system-ui,sans-serif" font-size="11" ` +
      `fill="${esc(theme.tick)}">${esc(s.label)} — ${s.pct.toFixed(1)}%${flag}</text>`;
    return anchor(s.href, row);
  });
}

function donutSummary(
  label: string,
  total: number,
  ordered: readonly ResolvedSlice[],
  capPct?: number,
): object {
  // Herfindahl–Hirschman concentration index over percentage shares (0–10000).
  const hhi = ordered.reduce((sum, s) => sum + s.pct * s.pct, 0);
  return {
    type: 'donut',
    label,
    total,
    capPct,
    hhi: Math.round(hhi),
    slices: ordered.map((s) => ({
      label: s.label,
      value: s.value,
      pct: s.pct,
      overCap: s.overCap,
    })),
  };
}

function donutDesc(label: string, ordered: readonly ResolvedSlice[], capPct?: number): string {
  if (ordered.length === 0) return `${label}: no slices.`;
  const top = ordered[0];
  const headroom =
    capPct !== undefined ? `; headroom to cap ${(capPct - top.pct).toFixed(1)} pts` : '';
  const over = ordered.filter((s) => s.overCap).length;
  const overNote = over > 0 ? `; ${over} over cap` : '';
  return `${label}: ${ordered.length} slices; largest ${top.label} ${top.pct.toFixed(1)}%${headroom}${overNote}.`;
}
