/**
 * Sightline — fast, accessible charts.
 *
 * Renders 100k+ points at 60fps on a canvas while remaining keyboard-navigable,
 * screen-reader-announced, and find-in-page-able through a real-DOM accessibility layer.
 */
export { Sightline } from './sightline.ts';
export type { SightlineConfig, SightlineOptions } from './sightline.ts';
export type { SeriesConfig, SightlineData, NumberArray } from './core/model.ts';
export type { RenderPath, HtmlInCanvasSupport } from './renderers/detect.ts';
export type { ChartSummary, SeriesSummary, Trend } from './a11y/summary.ts';
