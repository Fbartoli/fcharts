/**
 * fcharts — fast, accessible charts.
 *
 * Renders 100k+ points at 60fps on a canvas while remaining keyboard-navigable,
 * screen-reader-announced, and find-in-page-able through a real-DOM accessibility layer.
 */
export { FChart } from './fchart.ts';
export type { FChartConfig, FChartOptions } from './fchart.ts';
export { DEFAULT_PALETTE } from './core/model.ts';
export type { SeriesConfig, FChartData, NumberArray } from './core/model.ts';
export type { RenderPath, HtmlInCanvasSupport } from './renderers/detect.ts';
export type { ChartSummary, SeriesSummary, Trend } from './a11y/summary.ts';
export type { FChartStrings } from './a11y/strings.ts';
