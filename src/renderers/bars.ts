/**
 * Horizontal bars / progress-with-target — a pure SVG string (no DOM).
 *
 * One primitive covers the three dashboard flavors the Hecate desk hand-rolls: allocation
 * breakdown bars (value + cap/target marker + over/near/ok status), P&L attribution bars (signed
 * magnitude about a zero baseline, via `signed`), and a KPI cap bar (value vs a limit marker).
 * Status color comes from the contrast-checked ok/near/over palette and, when omitted, is derived
 * from the value's position against its `limit`, so the bar reads without a legend. Agent-readable:
 * a rows table (value, limit, % of limit, status) + a one-line `<desc>`.
 */
import { markColor, resolveTheme, type Status, type SvgTheme } from './svg-theme.ts';
import { anchor, bgRect, embedSummary, esc, n, svgDocument, text } from './svg-util.ts';

export interface BarRow {
  label: string;
  value: number;
  /** Cap / target marker, drawn as a vertical tick on the bar. */
  limit?: number;
  /** Explicit status; when omitted and `limit` is set, derived from value vs limit. */
  status?: Status;
  /** Explicit bar color (overrides status). */
  color?: string;
  /**
   * Drill-down target. When set, the row label becomes a focusable `<a href>` (e.g. a `?chain=…`
   * filter link) — presentation only, the summary/`<desc>` are unchanged.
   */
  href?: string;
}

export interface BarsOptions {
  width: number;
  theme?: Partial<SvgTheme>;
  title?: string;
  /** Format bar values for the right-hand label. Default: `String`. */
  formatValue?: (v: number) => string;
  /** Bars extend left/right from a zero baseline (P&L attribution). Default false. */
  signed?: boolean;
  /** Row band height, px. Default 28. */
  rowHeight?: number;
  embedData?: boolean;
}

const M = { left: 132, right: 60, top: 8, bottom: 8 };

/** Status from a value's position against its limit (>=100% over, >=90% near, else ok). */
function deriveStatus(value: number, limit: number): Status {
  if (limit <= 0) return 'ok';
  const ratio = value / limit;
  if (ratio > 1) return 'over';
  if (ratio >= 0.9) return 'near';
  return 'ok';
}

/** Build a horizontal bar / progress chart as a standalone SVG string. */
export function buildBarsSVG(spec: { rows: readonly BarRow[] }, opts: BarsOptions): string {
  const theme = resolveTheme(opts.theme);
  const title = opts.title ?? 'Bars';
  const fmt = opts.formatValue ?? ((v: number) => String(v));
  const rowH = opts.rowHeight ?? 28;
  const width = opts.width;
  const height = M.top + Math.max(1, spec.rows.length) * rowH + M.bottom;

  // Domain across values + limits.
  const all: number[] = [];
  for (const r of spec.rows) {
    all.push(r.value);
    if (r.limit !== undefined) all.push(r.limit);
  }
  const dataMax = all.length ? Math.max(...all) : 1;
  const dataMin = all.length ? Math.min(...all) : 0;
  const domMax = opts.signed ? Math.max(0, dataMax) : Math.max(dataMax, 0);
  const domMin = opts.signed ? Math.min(0, dataMin) : 0;
  const span = domMax - domMin || 1;
  const plotL = M.left;
  const plotR = width - M.right;
  const xAt = (v: number): number => plotL + ((v - domMin) / span) * (plotR - plotL);
  const xZero = xAt(0);

  const parts: string[] = [bgRect(width, height, theme.bg)];

  // Zero baseline for signed mode.
  if (opts.signed) {
    parts.push(
      `<line x1="${n(xZero)}" y1="${n(M.top)}" x2="${n(xZero)}" y2="${n(height - M.bottom)}" ` +
        `stroke="${esc(theme.axis)}" stroke-width="1"/>`,
    );
  }

  spec.rows.forEach((row, i) => {
    const cy = M.top + i * rowH + rowH / 2;
    const bh = rowH * 0.55;
    const status = row.status ?? (row.limit !== undefined ? deriveStatus(row.value, row.limit) : undefined);
    const color = markColor(row.color, status);

    // Track.
    parts.push(
      `<rect x="${n(plotL)}" y="${n(cy - bh / 2)}" width="${n(plotR - plotL)}" height="${n(bh)}" ` +
        `rx="2" fill="${esc(theme.grid)}" fill-opacity="0.5"/>`,
    );
    // Bar (from zero to value; handles negatives in signed mode). Clamp to the track so an
    // out-of-domain value — e.g. a negative in unsigned mode, where domMin is 0 — never paints
    // into the label gutter; it just renders as an empty/full bar.
    const x0 = Math.max(plotL, Math.min(xZero, xAt(row.value)));
    const x1 = Math.min(plotR, Math.max(xZero, xAt(row.value)));
    parts.push(
      `<rect x="${n(x0)}" y="${n(cy - bh / 2)}" width="${n(Math.max(0, x1 - x0))}" height="${n(bh)}" ` +
        `rx="2" fill="${esc(color)}"/>`,
    );
    // Limit / target marker.
    if (row.limit !== undefined) {
      const lx = xAt(row.limit);
      parts.push(
        `<line x1="${n(lx)}" y1="${n(cy - bh / 2 - 2)}" x2="${n(lx)}" y2="${n(cy + bh / 2 + 2)}" ` +
          `stroke="${esc(theme.tick)}" stroke-width="2"/>`,
      );
    }
    // Row label (left, drill-down link when href set) + value (right margin). The value text
    // carries the full row story as its accessible name — status must never be color-only
    // (WCAG 1.4.1): "EU desk: 84% of 100% — ok".
    const valueLabel = status
      ? `${row.label}: ${fmt(row.value)}${row.limit !== undefined ? ` of ${fmt(row.limit)}` : ''} — ${status}`
      : undefined;
    parts.push(
      anchor(row.href, text(4, cy + 4, esc(row.label), { fill: theme.tick })),
      text(width - 4, cy + 4, esc(fmt(row.value)), {
        fill: theme.tick,
        anchor: 'end',
        weight: 600,
        label: valueLabel,
      }),
    );
  });

  const summary = barsSummary(title, spec.rows, opts.signed ?? false);
  return svgDocument({
    width,
    height,
    title,
    desc: barsDesc(title, summary.rows),
    body: parts.join(''),
    extra: opts.embedData === false ? undefined : embedSummary(summary),
  });
}

interface BarSummaryRow {
  label: string;
  value: number;
  limit?: number;
  pctOfLimit?: number;
  status?: Status;
}

function barsSummary(
  label: string,
  rows: readonly BarRow[],
  signed: boolean,
): { type: 'bars'; label: string; signed: boolean; rows: BarSummaryRow[] } {
  return {
    type: 'bars',
    label,
    signed,
    rows: rows.map((r) => {
      const status = r.status ?? (r.limit !== undefined ? deriveStatus(r.value, r.limit) : undefined);
      return {
        label: r.label,
        value: r.value,
        limit: r.limit,
        // Keyed on the same `limit !== undefined` guard as `status`, but skip the degenerate
        // zero limit (a 0% target) to avoid a divide-by-zero Infinity in the agent-readable JSON.
        pctOfLimit: r.limit !== undefined && r.limit !== 0 ? (r.value / r.limit) * 100 : undefined,
        status,
      };
    }),
  };
}

function barsDesc(label: string, rows: readonly BarSummaryRow[]): string {
  if (rows.length === 0) return `${label}: no rows.`;
  const over = rows.filter((r) => r.status === 'over').length;
  const overNote = over > 0 ? `; ${over} over target` : '';
  return `${label}: ${rows.length} bars${overNote}.`;
}
