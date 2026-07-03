/**
 * Sparkline — an inline micro-trend as a pure SVG string (no DOM, transparent background).
 *
 * Deliberately minimal: no axes, legend, or interactive a11y chrome (the full `FChart` is the
 * wrong tool for a 56×18 thumbnail). It keeps just enough to not be invisible to assistive tech —
 * a `role="img"` with an `aria-label` stating the direction and delta — and colors the optional
 * delta label by the SAME up/down/flat classifier the chart summary uses, so a wall of KPI
 * sparklines reads consistently.
 */
import { trendOf } from '../a11y/summary.ts';
import { STATUS_COLORS, resolveTheme, type SvgTheme } from './svg-theme.ts';
import { esc, n, svgRoot, text } from './svg-util.ts';

export interface SparklineOptions {
  width: number;
  height: number;
  /** Line color. Default: a neutral blue (use `colorByTrend` to color by direction instead). */
  color?: string;
  /** Color the line green/red/gray by overall direction (last vs first). Default false. */
  colorByTrend?: boolean;
  /** Fill the area under the line. Default false. */
  area?: boolean;
  /** Draw a horizontal reference rule at this value. */
  baseline?: number;
  /** Append the last-vs-first delta as a colored label to the right. Default false. */
  showDelta?: boolean;
  /** Format the delta label value. Default: signed, 1 decimal. */
  formatDelta?: (deltaPct: number) => string;
  theme?: Partial<SvgTheme>;
  /** Accessible-label prefix. Default 'Trend'. */
  label?: string;
}

const INSET = 2;
const TREND_COLOR = { up: STATUS_COLORS.ok, down: STATUS_COLORS.over, flat: '#64748b' } as const;

/** Build an inline sparkline as a standalone SVG string. */
export function buildSparklineSVG(values: readonly number[], opts: SparklineOptions): string {
  const theme = resolveTheme(opts.theme);
  const { width, height } = opts;
  const finite = values.filter((v) => Number.isFinite(v));
  const first = finite[0] ?? 0;
  const last = finite[finite.length - 1] ?? 0;
  const deltaPct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const trend = trendOf(deltaPct);
  const lineColor = opts.color ?? (opts.colorByTrend ? TREND_COLOR[trend] : '#0284c7');

  // Reserve room on the right for the delta label when shown.
  const deltaText = opts.showDelta
    ? (opts.formatDelta ?? defaultDelta)(deltaPct)
    : '';
  const labelW = deltaText ? deltaText.length * 6.5 + 6 : 0;
  // Keep a usable drawing region even if the delta label is wide relative to the SVG.
  const plotW = Math.max(8, width - labelW);

  const parts: string[] = [];
  if (values.length >= 1) {
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === Infinity) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const xAt = (i: number): number =>
      values.length === 1 ? plotW / 2 : INSET + (i / (values.length - 1)) * (plotW - 2 * INSET);
    const yAt = (v: number): number => INSET + (1 - (v - min) / span) * (height - 2 * INSET);

    if (opts.baseline !== undefined && opts.baseline >= min && opts.baseline <= max) {
      const by = yAt(opts.baseline);
      parts.push(
        `<line x1="${n(INSET)}" y1="${n(by)}" x2="${n(plotW - INSET)}" y2="${n(by)}" ` +
          `stroke="${esc(theme.grid)}" stroke-width="1" stroke-dasharray="2 2"/>`,
      );
    }

    let d = '';
    let firstFinite = -1;
    let lastFinite = -1;
    values.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      if (firstFinite < 0) firstFinite = i;
      lastFinite = i;
      d += `${d ? 'L' : 'M'}${n(xAt(i))},${n(yAt(v))}`;
    });
    if (opts.area && d) {
      // Close under the drawn line (first/last FINITE vertex), not index 0/last, so a non-finite
      // endpoint doesn't stretch the fill baseline past the actual data.
      const base = yAt(min);
      parts.push(
        `<path d="${d}L${n(xAt(lastFinite))},${n(base)}L${n(xAt(firstFinite))},${n(base)}Z" ` +
          `fill="${esc(lineColor)}" fill-opacity="0.15" stroke="none"/>`,
      );
    }
    if (d) {
      parts.push(`<path d="${d}" fill="none" stroke="${esc(lineColor)}" stroke-width="1.5" stroke-linejoin="round"/>`);
    }
  }

  if (deltaText) {
    parts.push(
      text(width - 2, height / 2 + 4, esc(deltaText), {
        fill: TREND_COLOR[trend], anchor: 'end', weight: 600,
      }),
    );
  }

  // svgRoot mirrors the aria-label into a <title> so older AT that ignores aria-label on inline
  // SVG still gets the trend (matches the title/desc contract of the other primitives).
  const ariaLabel = `${opts.label ?? 'Trend'}: ${trend} ${Math.abs(deltaPct).toFixed(1)}%`;
  return svgRoot({ width, height, label: ariaLabel, body: parts.join('') });
}

function defaultDelta(deltaPct: number): string {
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`;
}
