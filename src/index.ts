/**
 * fcharts — fast, accessible charts.
 *
 * Renders 100k+ points at 60fps on a canvas while remaining keyboard-navigable,
 * screen-reader-announced, and find-in-page-able through a real-DOM accessibility layer.
 */
export { FChart, sameConstructionOptions } from './fchart.ts';
export type { FChartConfig, FChartOptions } from './fchart.ts';
export { DEFAULT_PALETTE, seriesSlots } from './core/model.ts';
export type { SeriesConfig, FChartData, NumberArray, AnnotationSpec } from './core/model.ts';
export type { RenderPath, HtmlInCanvasSupport } from './renderers/detect.ts';
export type { ChartSummary, SeriesSummary, AnnotationSummary, Trend } from './a11y/summary.ts';
export type { FChartStrings } from './a11y/strings.ts';

// Server-side SVG rendering (pure, Node-safe, no DOM) — line/area/candle plus the categorical
// primitives. `buildSVG` is the low-level scene primitive; `renderSVG` is the config+data entry.
export { renderSVG } from './renderers/render-svg.ts';
export type { RenderSVGOptions, RenderSVGChartOptions } from './renderers/render-svg.ts';
export { buildSVG } from './renderers/svg-export.ts';
export type { SvgScene } from './renderers/svg-export.ts';
export { lightTheme, darkTheme, resolveTheme, STATUS_COLORS } from './renderers/svg-theme.ts';
export type { SvgTheme, Status } from './renderers/svg-theme.ts';
export { buildDonutSVG } from './renderers/donut.ts';
export type { DonutSlice, DonutOptions } from './renderers/donut.ts';
export { buildScatterSVG } from './renderers/scatter.ts';
export type { ScatterPoint, ScatterRefLine, ScatterOptions } from './renderers/scatter.ts';
export { buildSparklineSVG } from './renderers/sparkline.ts';
export type { SparklineOptions } from './renderers/sparkline.ts';
export { buildBarsSVG } from './renderers/bars.ts';
export type { BarRow, BarsOptions } from './renderers/bars.ts';
export { buildProgressSVG } from './renderers/progress.ts';
export type { ProgressOptions } from './renderers/progress.ts';
