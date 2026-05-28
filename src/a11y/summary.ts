/**
 * Machine-readable chart summary — the bridge from "accessible" to "agent-readable".
 *
 * The same data that powers the screen-reader layer is distilled into a structured
 * `ChartSummary` (exposed via the public API and embedded as JSON in the DOM) and a
 * one-line natural-language `describeSummary` (used for `aria-describedby`). Where a canvas
 * chart is opaque pixels, this gives assistive tech, AI agents, and crawlers the actual
 * values and trend — pure functions, no DOM, unit-tested.
 */
import type { ChartData, ResolvedSeries } from '../core/model.ts';

export type Trend = 'up' | 'down' | 'flat';

export interface SeriesSummary {
  name: string;
  visible: boolean;
  min: number;
  max: number;
  first: number;
  last: number;
  mean: number;
  /** last − first. */
  changeAbs: number;
  /** Percent change of last vs first (range-relative when first is 0). */
  changePct: number;
  trend: Trend;
}

export interface ChartSummary {
  label: string;
  /** Points per series. */
  points: number;
  xStart: number;
  xEnd: number;
  series: SeriesSummary[];
}

const EMPTY_STAT = { min: 0, max: 0, first: 0, last: 0, mean: 0 };

/**
 * Direction of travel, derived from the SAME percentage that `changePct` reports (a <1%
 * move counts as flat) so the structured `trend` field and the reported `changePct` can
 * never contradict each other.
 */
function trendOf(changePct: number): Trend {
  if (changePct > 1) return 'up';
  if (changePct < -1) return 'down';
  return 'flat';
}

/** Distill a dataset + its resolved series into a structured summary. Pure. */
export function buildSummary(
  data: ChartData,
  series: readonly ResolvedSeries[],
  label: string,
): ChartSummary {
  const [xStart, xEnd] = data.xExtent();
  return {
    label,
    points: data.n,
    xStart,
    xEnd,
    series: series.map((s) => {
      const st = data.stats[s.index] ?? EMPTY_STAT;
      const range = st.max - st.min;
      const changeAbs = st.last - st.first;
      // Percent change vs the starting value; fall back to range-relative when first is 0.
      let changePct = 0;
      if (st.first !== 0) changePct = (changeAbs / Math.abs(st.first)) * 100;
      else if (range > 0) changePct = (changeAbs / range) * 100;
      return {
        name: s.name,
        visible: s.visible,
        min: st.min,
        max: st.max,
        first: st.first,
        last: st.last,
        mean: st.mean,
        changeAbs,
        changePct,
        trend: trendOf(changePct),
      };
    }),
  };
}

/** One-line natural-language summary for `aria-describedby` and "what the agent reads" UIs. */
export function describeSummary(
  summary: ChartSummary,
  fmtX: (v: number) => string,
  fmtY: (v: number) => string,
): string {
  if (summary.points === 0 || summary.series.length === 0) return `${summary.label}: no data.`;
  const shown = summary.series.filter((s) => s.visible);
  const points = summary.points.toLocaleString();
  if (shown.length === 0) {
    return `${summary.label}: ${points} points per series, all series hidden.`;
  }
  const parts = shown.map((s) => {
    const dir = s.trend === 'flat' ? 'flat' : `${s.trend} ${Math.abs(s.changePct).toFixed(1)}%`;
    return `${s.name} ranges ${fmtY(s.min)} to ${fmtY(s.max)}, now ${fmtY(s.last)} (${dir})`;
  });
  const span = `${fmtX(summary.xStart)} to ${fmtX(summary.xEnd)}`;
  return `${summary.label}: ${points} points per series from ${span}. ${parts.join('; ')}.`;
}
