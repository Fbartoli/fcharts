/**
 * Thin inline progress / gauge bar — a pure SVG string (no DOM), the single-row cousin of
 * `buildBarsSVG` for a KPI card's 4px "% of cap" / "coverage %" meter.
 *
 * Deliberately minimal: one track, one fill, an optional cap/target tick — no labels, legend, or
 * axis (those belong on `buildBarsSVG`, a multi-row bar *chart*). Like the sparkline it keeps just
 * enough to not be invisible to assistive tech: a `role="img"` + `aria-label` + `<title>` stating
 * the percentage (and the cap, when set). It does not embed the JSON summary — at 4px tall it's a
 * micro-element, not a queryable chart.
 */
import { resolveTheme, type SvgTheme } from './svg-theme.ts';
import { esc, n, svgRoot } from './svg-util.ts';

export interface ProgressOptions {
  width: number;
  /** Track height in px. Default 4 (the thin inline KPI bar). */
  height?: number;
  /** The full-track value (the 100% denominator). Default 100. */
  max?: number;
  /** Optional cap/target, drawn as a vertical tick at this value (same units as `value`/`max`). */
  limit?: number;
  /**
   * Fill color. Default a neutral blue. Pass a `STATUS_COLORS` value (or your own) for over/near/ok
   * semantics — this primitive stays minimal and does not derive status itself.
   */
  color?: string;
  theme?: Partial<SvgTheme>;
  /** Accessible-label prefix. Default 'Progress'. */
  label?: string;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Round a percentage to at most 1 decimal (a trailing `.0` is dropped by `Number`). */
const pctStr = (p: number): string => String(Math.round(p * 10) / 10);

/** Build a thin inline progress / gauge bar as a standalone SVG string. */
export function buildProgressSVG(value: number, opts: ProgressOptions): string {
  const theme = resolveTheme(opts.theme);
  const width = opts.width;
  const height = opts.height ?? 4;
  const max = opts.max ?? 100;
  const color = opts.color ?? '#0284c7';
  const frac = max > 0 ? clamp01(value / max) : 0;
  const rx = Math.min(height / 2, width / 2);

  const parts: string[] = [
    // Track (the unfilled remainder).
    `<rect x="0" y="0" width="${n(width)}" height="${n(height)}" rx="${n(rx)}" ` +
      `fill="${esc(theme.grid)}" fill-opacity="0.5"/>`,
  ];
  // Fill from the left, true width (no min-cap inflation — a 0 value draws nothing, a tiny value a
  // tiny sliver, so the bar never over-reports). The renderer clamps `rx` to half the fill width,
  // so a partial fill reads as a rounded pill.
  if (frac > 0) {
    parts.push(
      `<rect x="0" y="0" width="${n(frac * width)}" height="${n(height)}" rx="${n(rx)}" ` +
        `fill="${esc(color)}"/>`,
    );
  }
  // Cap / target tick.
  if (opts.limit !== undefined) {
    const lx = clamp01(max > 0 ? opts.limit / max : 0) * width;
    parts.push(
      `<line x1="${n(lx)}" y1="0" x2="${n(lx)}" y2="${n(height)}" ` +
        `stroke="${esc(theme.tick)}" stroke-width="1.5"/>`,
    );
  }

  // aria-label reports the TRUE percentage (may exceed 100% even though the fill is clamped), so an
  // over-cap meter is announced as over.
  const pct = max > 0 ? (value / max) * 100 : 0;
  const cap =
    opts.limit !== undefined && max > 0 ? ` (cap ${pctStr((opts.limit / max) * 100)}%)` : '';
  // svgRoot mirrors the aria-label into a <title> so older AT that ignores aria-label on inline
  // SVG still reads the value (matches the title contract of the sparkline).
  const ariaLabel = `${opts.label ?? 'Progress'}: ${pctStr(pct)}%${cap}`;
  return svgRoot({ width, height, label: ariaLabel, body: parts.join('') });
}
