/**
 * Machine-readable chart summary — the bridge from "accessible" to "agent-readable".
 *
 * The same data that powers the screen-reader layer is distilled into a structured
 * `ChartSummary` (exposed via the public API and embedded as JSON in the DOM) and a
 * one-line natural-language `describeSummary` (used for `aria-describedby`). Where a canvas
 * chart is opaque pixels, this gives assistive tech, AI agents, and crawlers the actual
 * values and trend — pure functions, no DOM, unit-tested.
 */
import type { ChartData, ResolvedAnnotation, ResolvedSeries } from '../core/model.ts';
import { DEFAULT_STRINGS, format, type FChartStrings } from './strings.ts';

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

/** One event marker, in the machine-readable summary. */
export interface AnnotationSummary {
  x: number;
  label: string;
  kind: 'point' | 'rule';
}

export interface ChartSummary {
  label: string;
  /** Points per series. */
  points: number;
  xStart: number;
  xEnd: number;
  series: SeriesSummary[];
  /** Event markers on the series, when any are configured. */
  annotations?: AnnotationSummary[];
}

const EMPTY_STAT = { min: 0, max: 0, first: 0, last: 0, mean: 0 };

/**
 * Direction of travel, derived from the SAME percentage that `changePct` reports (a <1%
 * move counts as flat) so the structured `trend` field and the reported `changePct` can
 * never contradict each other. Exported so other renderers (e.g. the sparkline) classify
 * direction identically.
 */
export function trendOf(changePct: number): Trend {
  if (changePct > 1) return 'up';
  if (changePct < -1) return 'down';
  return 'flat';
}

/** Distill a dataset + its resolved series into a structured summary. Pure. */
export function buildSummary(
  data: ChartData,
  series: readonly ResolvedSeries[],
  label: string,
  annotations: readonly ResolvedAnnotation[] = [],
): ChartSummary {
  const [xStart, xEnd] = data.xExtent();
  return {
    label,
    points: data.n,
    xStart,
    xEnd,
    annotations:
      annotations.length > 0
        ? annotations.map((a) => ({ x: a.x, label: a.label, kind: a.kind }))
        : undefined,
    series: series.map((s) => {
      // A candle series spans 4 stat slots (OHLC): range comes from the true traded extremes
      // (low.min / high.max); first/last/mean/trend follow the close.
      const st =
        s.type === 'candle'
          ? {
              ...(data.stats[s.index + 3] ?? EMPTY_STAT),
              min: (data.stats[s.index + 2] ?? EMPTY_STAT).min,
              max: (data.stats[s.index + 1] ?? EMPTY_STAT).max,
            }
          : (data.stats[s.index] ?? EMPTY_STAT);
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
  strings: FChartStrings = DEFAULT_STRINGS,
): string {
  const label = summary.label;
  if (summary.points === 0 || summary.series.length === 0) {
    return format(strings.summaryNoData, { label });
  }
  const shown = summary.series.filter((s) => s.visible);
  const points = summary.points.toLocaleString();
  if (shown.length === 0) return format(strings.summaryAllHidden, { label, points });
  const parts = shown.map((s) => {
    const dir =
      s.trend === 'flat'
        ? strings.trendFlat
        : format(s.trend === 'up' ? strings.trendUp : strings.trendDown, {
            pct: Math.abs(s.changePct).toFixed(1),
          });
    return format(strings.summaryPart, {
      name: s.name,
      min: fmtY(s.min),
      max: fmtY(s.max),
      last: fmtY(s.last),
      dir,
    });
  });
  const span = format(strings.summarySpan, { start: fmtX(summary.xStart), end: fmtX(summary.xEnd) });
  const line = format(strings.summaryLine, { label, points, span, parts: parts.join('; ') });
  if (!summary.annotations || summary.annotations.length === 0) return line;
  const events = format(strings.summaryEvents, {
    count: summary.annotations.length,
    labels: summary.annotations.map((a) => a.label).join('; '),
  });
  return `${line} ${events}.`;
}
