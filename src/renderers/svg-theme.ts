/**
 * SVG render themes — the color palette a server-side SVG is painted with.
 *
 * The canvas renderer reads CSS custom properties off the live `<canvas>`, but a pure
 * server-side SVG string has no document to inherit from, so its colors must be passed in.
 * `lightTheme` reproduces the values `buildSVG` hardcoded before themes existed, so it stays
 * the default and nothing rendered today changes. `darkTheme` is the dashboard preset (dark
 * panels, brighter ink) for SSR apps like the Hecate desk.
 */
import { DEFAULT_PALETTE } from '../core/model.ts';

export interface SvgTheme {
  /** Page/background rect fill. */
  bg: string;
  /** Gridlines. */
  grid: string;
  /** Plot border + axis lines. */
  axis: string;
  /** Tick-label text. */
  tick: string;
  /** Axis-title text. */
  label: string;
  /** Series palette for series that don't set an explicit color. Index-aligned, cycled.
   *  Both presets reuse {@link DEFAULT_PALETTE} (verified >= 3:1 on light AND dark, R6). */
  series: readonly string[];
}

/** The original hardcoded light values — the default, so existing exports are unchanged. */
export const lightTheme: SvgTheme = {
  bg: '#ffffff',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  tick: '#4b5563',
  label: '#6b7280',
  series: DEFAULT_PALETTE,
};

/** Dark dashboard preset (SSR panels). Ink/grid verified >= 3:1 on the `bg`. */
export const darkTheme: SvgTheme = {
  bg: '#0a0d12',
  grid: 'rgba(148,163,184,0.16)',
  axis: 'rgba(148,163,184,0.45)',
  tick: '#94a3b8',
  label: '#64748b',
  series: DEFAULT_PALETTE,
};

/**
 * Status palette for progress/threshold marks (bars, scatter dots) — `ok`/`near`/`over`.
 * Reuses the contrast-checked green/amber/red verified >= 3:1 on both light and dark
 * backgrounds (R6), so status reads without relying on a legend.
 */
export type Status = 'ok' | 'near' | 'over';

export const STATUS_COLORS: Record<Status, string> = {
  ok: '#16a34a',
  near: '#d97706',
  over: '#dc2626',
};

/** Resolve an optional partial theme onto a base preset (light by default). */
export function resolveTheme(theme?: Partial<SvgTheme>, base: SvgTheme = lightTheme): SvgTheme {
  return theme ? { ...base, ...theme } : base;
}

/**
 * A mark's paint: explicit color wins, then its status color, then the palette default —
 * the shared fallback chain for status-bearing marks (bar rows, scatter dots).
 */
export function markColor(color: string | undefined, status: Status | undefined): string {
  return color || (status ? STATUS_COLORS[status] : DEFAULT_PALETTE[0]);
}
