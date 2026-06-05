/**
 * React adapter — a thin, declarative `<SightlineChart>` wrapper around the imperative
 * {@link Sightline} class. Mounts the chart into a container `<div>` on first render, applies
 * prop changes with `chart.update()`, and tears it down on unmount.
 *
 * React is an *optional peer dependency*: this module is shipped as the separate `sightline/react`
 * entry and `react` is externalized from the build, so the core renderer never pulls React in.
 * Authored with `createElement` (no JSX) to avoid imposing a JSX toolchain on the core build.
 *
 * @example
 * ```tsx
 * import { SightlineChart } from 'sightline/react';
 * <SightlineChart series={[{ name: 'Price' }]} data={{ x, y: [price] }} style={{ height: 320 }} />
 * ```
 */
import { createElement, useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { Sightline, type SightlineOptions } from './sightline.ts';
import type { SeriesConfig, SightlineData } from './core/model.ts';

export interface SightlineChartProps {
  /** Series definitions (same shape as the imperative API). */
  series: SeriesConfig[];
  /** Columnar dataset. Changing its identity replaces the data (and resets the view). */
  data?: SightlineData;
  /** Chart options (accessibility, formatting, ticks, …). */
  options?: SightlineOptions;
  className?: string;
  /** The container must have a height for the chart to size itself (e.g. `{ height: 320 }`). */
  style?: CSSProperties;
}

/**
 * Declarative Sightline chart. Re-renders update the underlying chart in place; only the props
 * whose identity actually changed are forwarded, so passing a *stable* `data` reference avoids
 * an unnecessary view reset. Memoize `data`/`series`/`options` if they're built inline.
 */
export function SightlineChart(props: SightlineChartProps): ReactElement {
  const { series, data, options, className, style } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Sightline | null>(null);
  // Last-applied prop identities, seeded with the mount values so the first update effect is a
  // no-op (the mount effect already applied them).
  const applied = useRef({ series, data, options });

  // Mount / unmount. Empty deps: create once, destroy on unmount (handles StrictMode remount).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    chartRef.current = new Sightline(el, { series, data, options });
    applied.current = { series, data, options };
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Mount-only: subsequent prop changes are handled by the update effect below.
  }, []);

  // Apply prop changes to the live chart, forwarding only what changed by reference.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const patch: { series?: SeriesConfig[]; data?: SightlineData; options?: SightlineOptions } = {};
    if (series !== applied.current.series) patch.series = series;
    if (data !== applied.current.data) patch.data = data;
    if (options !== applied.current.options) patch.options = options;
    if (patch.series || patch.data || patch.options) {
      chart.update(patch);
      applied.current = { series, data, options };
    }
  }, [series, data, options]);

  return createElement('div', { ref: containerRef, className, style });
}
