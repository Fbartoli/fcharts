/**
 * Keyboard-cursor logic — pure, framework-free, and unit-tested.
 *
 * The data surface is keyboard-navigable: arrows move between samples and switch series,
 * Home/End jump to the edges. This module computes the *next* cursor position from a key
 * press; `Sightline` owns the events, the live-region announcement, and the panning.
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

/** True if this key is one the cursor handles (so callers know to preventDefault). */
export function handlesKey(key: string): boolean {
  return KEYS.has(key);
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
