/**
 * Public server-side SVG render — `config + data → <svg>` in one call, no DOM, no canvas.
 *
 * `buildSVG` is the low-level primitive (the caller hand-assembles scales, ticks, pyramids, and
 * resolved series). `renderSVG` is the high-level entry an SSR app actually wants: hand it the
 * same `{ series, options }` config and `{ x, y }` data the live `FChart` takes, plus a size and
 * optional theme, and it assembles the scene and returns a standalone, themed, agent-readable SVG
 * string. Pure and Node-safe — it mirrors what `FChart.toSVG()` does, without constructing a chart.
 */
import {
  ChartData,
  DEFAULT_MARGINS,
  resolveAnnotations,
  resolveSeries,
  type AnnotationSpec,
  type FChartData,
  type Margins,
  type SeriesConfig,
} from '../core/model.ts';
import { linearScale } from '../core/scales.ts';
import { effectiveTickCount, formatTick, niceTicks } from '../core/ticks.ts';
import { buildSummary, describeSummary } from '../a11y/summary.ts';
import { buildSVG } from './svg-export.ts';
import { resolveTheme, type SvgTheme } from './svg-theme.ts';

/** Chart-level options that affect a static SVG (the SVG-relevant subset of `FChartOptions`). */
export interface RenderSVGChartOptions {
  ariaLabel?: string;
  xLabel?: string;
  yLabel?: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  xTickCount?: number;
  yTickCount?: number;
  /** Treat x as integer indices (ticks step >= 1). Default false. */
  xInteger?: boolean;
  /** Fractional y-extent padding. Default 0.06 (matches the live chart). */
  yPadding?: number;
}

export interface RenderSVGOptions {
  width: number;
  height: number;
  /** Color overrides merged onto {@link lightTheme}. Pass `darkTheme` for dark dashboards. */
  theme?: Partial<SvgTheme>;
  /** Embed the `ChartSummary` JSON so the static SVG stays machine-readable. Default true. */
  embedData?: boolean;
  /** Plot insets in px. Defaults to {@link DEFAULT_MARGINS}. */
  margins?: Partial<Margins>;
}

/** Total y-array slots the resolved series consume (a candle takes 4: open/high/low/close). */
function totalSlots(series: readonly { index: number; slots: number }[]): number {
  const last = series[series.length - 1];
  return last ? last.index + last.slots : 0;
}

/**
 * Render a line/area/candle chart to a standalone SVG string.
 *
 * @throws if `data.y` does not provide one array per series slot (candles need four).
 */
export function renderSVG(
  config: { series: SeriesConfig[]; options?: RenderSVGChartOptions; annotations?: AnnotationSpec[] },
  data: FChartData,
  opts: RenderSVGOptions,
): string {
  const o = config.options ?? {};
  const series = resolveSeries(config.series);
  const annotations = resolveAnnotations(config.annotations ?? [], series);

  const want = totalSlots(series);
  if (data.y.length !== want) {
    const candles = series.filter((s) => s.type === 'candle').length;
    const hint = candles ? ` (${candles} candle series need 4 arrays each: open, high, low, close)` : '';
    throw new Error(`fcharts: renderSVG — ${series.length} series need ${want} y arrays${hint}, got ${data.y.length}.`);
  }

  const cd = new ChartData(data);
  const m: Margins = { ...DEFAULT_MARGINS, ...opts.margins };
  const { width, height } = opts;

  // X-domain: full extent, padded half a step when a candle is shown so edge candles render
  // whole (parity with the live chart's auto xPad).
  const [lo, hi] = cd.xExtent();
  const hasCandle = series.some((s) => s.type === 'candle' && s.visible);
  const xPad = hasCandle && cd.n >= 2 ? (hi - lo) / (cd.n - 1) / 2 : 0;
  const domain: [number, number] = [lo - xPad, hi + xPad];

  // Y-domain: slot-aware visibility mask (a candle spans 4 slots that share its visibility).
  const visible: boolean[] = [];
  for (const s of series) for (let k = 0; k < s.slots; k++) visible.push(s.visible);
  const [yMin, yMax] = cd.yExtent(visible);
  const yPad = (yMax - yMin) * (o.yPadding ?? 0.06);
  const yDomain: [number, number] = [yMin - yPad, yMax + yPad];

  const xScale = linearScale(domain, [m.left, width - m.right]);
  const yScale = linearScale(yDomain, [height - m.bottom, m.top]);
  const xCount = effectiveTickCount(o.xTickCount ?? 8, width - m.left - m.right, 64);
  const yCount = effectiveTickCount(o.yTickCount ?? 6, height - m.top - m.bottom, 28);
  const formatX = o.formatX ?? formatTick;
  const formatY = o.formatY ?? formatTick;
  const title = o.ariaLabel ?? 'Chart';
  const summary = buildSummary(cd, series, title, annotations);

  return buildSVG({
    width,
    height,
    margins: m,
    series,
    data: cd,
    xScale,
    yScale,
    domain,
    xTicks: niceTicks(domain[0], domain[1], xCount, o.xInteger ? 1 : 0),
    yTicks: niceTicks(yDomain[0], yDomain[1], yCount),
    formatX,
    formatY,
    title,
    desc: describeSummary(summary, formatX, formatY),
    xLabel: o.xLabel,
    yLabel: o.yLabel,
    annotations,
    theme: resolveTheme(opts.theme),
    summary: opts.embedData === false ? undefined : summary,
  });
}
