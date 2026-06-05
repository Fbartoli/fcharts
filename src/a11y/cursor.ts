/**
 * Keyboard-cursor logic — pure, framework-free, and unit-tested.
 *
 * The data surface is keyboard-navigable: arrows move between samples and switch series,
 * Home/End jump to the edges. This module computes the *next* cursor position from a key
 * press; `FChart` owns the events, the live-region announcement, and the panning.
 */
import type { CursorState } from '../core/model.ts';

export interface CursorStepOptions {
  /** Number of samples in the series. */
  n: number;
  /** Samples currently visible in the viewport (drives the coarse step size). */
  visibleCount: number;
  /** Per-series visibility (index-aligned with the resolved series). */
  seriesVisible: readonly boolean[];
  /** Shift held → fine (single-sample) movement instead of the coarse jump. */
  fine: boolean;
}

const KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

// Keyboard zoom so a pointer-free user can change magnification, not just pan (WCAG 2.1.1):
// '+'/'=' zoom in, '-'/'_' zoom out.
const ZOOM_IN = new Set(['+', '=']);
const ZOOM_OUT = new Set(['-', '_']);

/**
 * True if this key is one the data surface handles (navigation, zoom, or Escape-to-dismiss),
 * so callers know to call preventDefault.
 */
export function handlesKey(key: string): boolean {
  return KEYS.has(key) || ZOOM_IN.has(key) || ZOOM_OUT.has(key) || key === 'Escape';
}

/**
 * Domain-scaling factor for a zoom key: `<1` zooms in (narrows the view), `>1` zooms out, or
 * `null` if the key is not a zoom key. Mirrors the wheel step (1.15×) so keyboard and pointer
 * zoom behave identically.
 */
export function zoomFactor(key: string): number | null {
  if (ZOOM_IN.has(key)) return 1 / 1.15;
  if (ZOOM_OUT.has(key)) return 1.15;
  return null;
}

function findVisible(start: number, dir: 1 | -1, visible: readonly boolean[]): number {
  const len = visible.length;
  if (len === 0) return start;
  for (let step = 1; step <= len; step++) {
    const idx = (start + dir * step + len * step) % len;
    if (visible[idx]) return idx;
  }
  return start; // none visible — stay put
}

/**
 * Compute the cursor position after a key press.
 *
 * @returns The next cursor state, or `null` if the key is not a navigation key.
 */
export function stepCursor(
  cur: CursorState,
  key: string,
  opts: CursorStepOptions,
): CursorState | null {
  if (!KEYS.has(key)) return null;
  const max = Math.max(0, opts.n - 1);
  const coarse = Math.max(1, Math.round(opts.visibleCount / 120));
  const step = opts.fine ? 1 : coarse;

  let { index, series } = cur;
  switch (key) {
    case 'ArrowRight':
      index = Math.min(max, index + step);
      break;
    case 'ArrowLeft':
      index = Math.max(0, index - step);
      break;
    case 'ArrowUp':
      series = findVisible(series, -1, opts.seriesVisible);
      break;
    case 'ArrowDown':
      series = findVisible(series, 1, opts.seriesVisible);
      break;
    case 'Home':
      index = 0;
      break;
    case 'End':
      index = max;
      break;
  }
  return { index, series };
}

/**
 * Pan a domain so it contains the given x-value, preserving its width. Pure: always
 * returns a fresh tuple (equal in value to the input when `x` is already inside).
 */
export function panToInclude(
  domain: readonly [number, number],
  x: number,
): [number, number] {
  const [d0, d1] = domain;
  const span = d1 - d0;
  if (x < d0) return [x, x + span];
  if (x > d1) return [x - span, x];
  return [d0, d1];
}
