/**
 * React adapter — a thin, declarative `<FChart>` wrapper around the imperative
 * {@link FChart} class. Mounts the chart into a container `<div>` on first render, applies
 * prop changes with `chart.update()`, and tears it down on unmount.
 *
 * React is an *optional peer dependency*: this module is shipped as the separate `fcharts-js/react`
 * entry and `react` is externalized from the build, so the core renderer never pulls React in.
 * Authored with `createElement` (no JSX) to avoid imposing a JSX toolchain on the core build.
 *
 * @example
 * ```tsx
 * import { FChart } from 'fcharts-js/react';
 * <FChart series={[{ name: 'Price' }]} data={{ x, y: [price] }} style={{ height: 320 }} />
 * ```
 */
import { createElement, useEffect, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { FChart as FChartCore, sameConstructionOptions, type FChartOptions } from './fchart.ts';
import type { AnnotationSpec, SeriesConfig, FChartData } from './core/model.ts';

export interface FChartProps {
  /** Series definitions (same shape as the imperative API). */
  series: SeriesConfig[];
  /** Columnar dataset. Changing its identity replaces the data (and resets the view). */
  data?: FChartData;
  /** Chart options (accessibility, formatting, ticks, …). */
  options?: FChartOptions;
  /** Event markers on the series. Changing its identity re-applies them. */
  annotations?: AnnotationSpec[];
  className?: string;
  /** The container must have a height for the chart to size itself (e.g. `{ height: 320 }`). */
  style?: CSSProperties;
}

/**
 * Declarative fcharts chart. Re-renders update the underlying chart in place; only the props
 * whose identity actually changed are forwarded, so passing a *stable* `data` reference avoids
 * an unnecessary view reset. Memoize `data`/`series`/`options` if they're built inline.
 */
export function FChart(props: FChartProps): ReactElement {
  const { series, data, options, annotations, className, style } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<FChartCore | null>(null);
  // Last-applied prop identities, seeded with the mount values so the first update effect is a
  // no-op (the mount effect already applied them).
  const applied = useRef({ series, data, options, annotations });

  // Mount / unmount. Empty deps: create once, destroy on unmount (handles StrictMode remount).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    chartRef.current = new FChartCore(el, { series, data, options, annotations });
    applied.current = { series, data, options, annotations };
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Mount-only: subsequent prop changes are handled by the update effect below.
  }, []);

  // Apply prop changes to the live chart, forwarding only what changed by reference.
  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el) return;
    // Construction-time options (legend, sonify, strings) can't be patched onto a live chart —
    // update() would throw — so a change to any of them remounts, the declarative equivalent.
    if (!sameConstructionOptions(applied.current.options, options)) {
      chart.destroy();
      chartRef.current = new FChartCore(el, { series, data, options, annotations });
      applied.current = { series, data, options, annotations };
      return;
    }
    const patch: {
      series?: SeriesConfig[];
      data?: FChartData;
      options?: FChartOptions;
      annotations?: AnnotationSpec[];
    } = {};
    if (series !== applied.current.series) patch.series = series;
    if (data !== applied.current.data) patch.data = data;
    if (options !== applied.current.options) patch.options = options;
    if (annotations !== applied.current.annotations) patch.annotations = annotations;
    if (patch.series || patch.data || patch.options || patch.annotations) {
      chart.update(patch);
      applied.current = { series, data, options, annotations };
    }
  }, [series, data, options, annotations]);

  return createElement('div', { ref: containerRef, className, style });
}
