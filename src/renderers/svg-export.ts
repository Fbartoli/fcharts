/**
 * SVG export — a standalone `<svg>` string mirroring the current view (the EU data-viz guide
 * lists "export an SVG that can be turned into a tactile graphic" as a non-visual technique;
 * it's also handy for print/embedding and zero-client-JS server rendering). Pure: string in,
 * string out, no DOM — unit-testable and Node-safe.
 *
 * It draws the same downsampled min/max envelope the canvas does (so cost tracks plot width,
 * not N), reproduces per-series dash patterns, themes via {@link SvgTheme} (light by default),
 * and embeds the axis ticks as real `<text>` plus a `<title>`/`<desc>` — and optionally the
 * machine-readable `ChartSummary` JSON — so the SVG itself stays accessible and agent-readable.
 */
import { downsampleColumns, lowerBound } from '../core/downsample.ts';
import {
  annotationSample,
  type ChartData,
  type Margins,
  type ResolvedAnnotation,
  type ResolvedSeries,
} from '../core/model.ts';
import type { LinearScale } from '../core/scales.ts';
import { MIN_CANDLE_PX } from './renderer.ts';
import { lightTheme, type SvgTheme } from './svg-theme.ts';
import { embedSummary, esc, n, svgDocument } from './svg-util.ts';

export interface SvgScene {
  width: number;
  height: number;
  margins: Margins;
  series: readonly ResolvedSeries[];
  data: ChartData;
  xScale: LinearScale;
  yScale: LinearScale;
  domain: readonly [number, number];
  xTicks: readonly number[];
  yTicks: readonly number[];
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  title: string;
  /** One-line natural-language summary (for <desc>). */
  desc: string;
  xLabel?: string;
  yLabel?: string;
  /** Event markers on the series (dots / vertical rules). */
  annotations?: readonly ResolvedAnnotation[];
  /** Render colors. Defaults to {@link lightTheme} so existing exports are byte-unchanged. */
  theme?: SvgTheme;
  /** When set, embedded as `<script type="application/json" data-fcharts>` so a static SVG
   *  stays machine-readable with no JS running. Pass the `ChartSummary`. */
  summary?: unknown;
}

interface Envelope {
  min: Float32Array;
  max: Float32Array;
  first: number;
  last: number;
}

/** The min/max envelope as a zigzag stroke path — matches the canvas line drawing. */
function strokePath(env: Envelope, left: number, yScale: LinearScale): string {
  let d = '';
  let started = false;
  for (let c = env.first; c <= env.last; c++) {
    if (env.min[c] === Infinity) continue;
    const x = n(left + c + 0.5);
    d += `${started ? 'L' : 'M'}${x},${n(yScale(env.max[c]))}L${x},${n(yScale(env.min[c]))}`;
    started = true;
  }
  return d;
}

/** A closed polygon: the max edge left→right, then back along the baseline — for area fills. */
function areaPath(env: Envelope, left: number, yScale: LinearScale, baseY: number): string {
  let top = '';
  let firstX = 0;
  let lastX = 0;
  let started = false;
  for (let c = env.first; c <= env.last; c++) {
    if (env.min[c] === Infinity) continue;
    const px = left + c + 0.5;
    top += `${started ? 'L' : 'M'}${n(px)},${n(yScale(env.max[c]))}`;
    if (!started) firstX = px;
    lastX = px;
    started = true;
  }
  if (!started) return '';
  return `${top}L${n(lastX)},${n(baseY)}L${n(firstX)},${n(baseY)}Z`;
}

/**
 * Candle series → SVG elements, mirroring the canvas: individual wick lines + body rects
 * (up = hollow against the theme background, down = filled) while each candle has >=
 * MIN_CANDLE_PX of width, else the per-column high/low envelope as a single bar path.
 */
function candleParts(
  scene: SvgScene,
  s: ResolvedSeries,
  cols: number,
  buf: { min: Float32Array; max: Float32Array },
  theme: SvgTheme,
): string[] {
  const { data, xScale, yScale, domain } = scene;
  const x = data.x;
  const i0 = Math.max(0, lowerBound(x, domain[0]) - 1);
  const i1 = Math.min(x.length - 1, lowerBound(x, domain[1]));
  if (i1 < i0) return [];
  const count = i1 - i0 + 1;
  const left = scene.margins.left;

  if (cols / count < MIN_CANDLE_PX) {
    const hi = downsampleColumns(x, data.y[s.index + 1], data.pyramids[s.index + 1], domain, cols, buf);
    const hiMax = hi.max.slice();
    const first = hi.first;
    const last = hi.last;
    const lo = downsampleColumns(x, data.y[s.index + 2], data.pyramids[s.index + 2], domain, cols, buf);
    if (first < 0) return [];
    let d = '';
    for (let c = first; c <= last; c++) {
      if (hiMax[c] === -Infinity || lo.min[c] === Infinity) continue;
      const px = n(left + c + 0.5);
      d += `M${px},${n(yScale(hiMax[c]))}L${px},${n(yScale(lo.min[c]))}`;
    }
    return d ? [`<path d="${d}" stroke="${esc(s.color)}" stroke-width="1" fill="none"/>`] : [];
  }

  const [yo, yh, yl, yc] = [data.y[s.index], data.y[s.index + 1], data.y[s.index + 2], data.y[s.index + 3]];
  const spacing = count > 1 ? (xScale(x[i1]) - xScale(x[i0])) / (count - 1) : cols;
  const bodyW = Math.max(1, Math.min(spacing * 0.7, 13));
  const out: string[] = [];
  for (let i = i0; i <= i1; i++) {
    const o = yo[i];
    const c = yc[i];
    if (!Number.isFinite(o) || !Number.isFinite(c)) continue; // gap candle
    const up = c >= o;
    const color = esc(up ? s.upColor : s.downColor);
    const px = xScale(x[i]);
    const pTop = yScale(Math.max(o, c));
    const h = Math.max(1, yScale(Math.min(o, c)) - pTop);
    out.push(
      `<line x1="${n(px)}" y1="${n(yScale(yh[i]))}" x2="${n(px)}" y2="${n(yScale(yl[i]))}" ` +
        `stroke="${color}" stroke-width="1"/>`,
      `<rect x="${n(px - bodyW / 2)}" y="${n(pTop)}" width="${n(bodyW)}" height="${n(h)}" ` +
        `fill="${up ? esc(theme.bg) : color}" stroke="${color}" stroke-width="1"/>`,
    );
  }
  return out;
}

/** Build a complete, standalone SVG document string for the scene. */
export function buildSVG(scene: SvgScene): string {
  const { width: w, height: h, margins: m, xScale, yScale } = scene;
  const theme = scene.theme ?? lightTheme;
  const left = m.left;
  const right = w - m.right;
  const top = m.top;
  const bottom = h - m.bottom;
  const cols = Math.max(1, Math.floor(right - left));
  const buf = { min: new Float32Array(cols), max: new Float32Array(cols) };
  const parts: string[] = [];

  parts.push(`<rect width="${n(w)}" height="${n(h)}" fill="${esc(theme.bg)}"/>`);

  // Grid.
  let grid = '';
  for (const v of scene.yTicks) {
    const py = yScale(v);
    if (py >= top - 1 && py <= bottom + 1) grid += `M${n(left)},${n(py)}H${n(right)}`;
  }
  for (const t of scene.xTicks) {
    const px = xScale(t);
    if (px >= left - 1 && px <= right + 1) grid += `M${n(px)},${n(top)}V${n(bottom)}`;
  }
  if (grid) parts.push(`<path d="${grid}" stroke="${esc(theme.grid)}" stroke-width="1" fill="none"/>`);
  parts.push(
    `<rect x="${n(left)}" y="${n(top)}" width="${n(right - left)}" height="${n(bottom - top)}" ` +
      `fill="none" stroke="${esc(theme.axis)}" stroke-width="1"/>`,
  );

  // Series envelopes (+ area fill); candles as marks or their dense envelope.
  for (const s of scene.series) {
    if (!s.visible) continue;
    if (s.type === 'candle') {
      parts.push(...candleParts(scene, s, cols, buf, theme));
      continue;
    }
    const env = downsampleColumns(
      scene.data.x, scene.data.y[s.index], scene.data.pyramids[s.index], scene.domain, cols, buf,
    );
    if (env.first < 0) continue;
    if (s.type === 'area') {
      const baseY = Math.max(top, Math.min(bottom, yScale(0)));
      const a = areaPath(env, left, yScale, baseY);
      if (a) parts.push(`<path d="${a}" fill="${esc(s.color)}" fill-opacity="${s.fillAlpha}" stroke="none"/>`);
    }
    const d = strokePath(env, left, yScale);
    if (!d) continue;
    const dash = s.dash.length ? ` stroke-dasharray="${s.dash.join(' ')}"` : '';
    parts.push(`<path d="${d}" fill="none" stroke="${esc(s.color)}" stroke-width="${s.width}"${dash}/>`);
  }

  // Tick labels + axis titles.
  for (const v of scene.yTicks) {
    const py = yScale(v);
    if (py < top - 1 || py > bottom + 1) continue;
    parts.push(`<text x="${n(left - 6)}" y="${n(py + 3)}" text-anchor="end" ` +
      `font-family="system-ui,sans-serif" font-size="11" fill="${esc(theme.tick)}">${esc(scene.formatY(v))}</text>`);
  }
  for (const t of scene.xTicks) {
    const px = xScale(t);
    if (px < left - 1 || px > right + 1) continue;
    parts.push(`<text x="${n(px)}" y="${n(bottom + 16)}" text-anchor="middle" ` +
      `font-family="system-ui,sans-serif" font-size="11" fill="${esc(theme.tick)}">${esc(scene.formatX(t))}</text>`);
  }
  if (scene.yLabel) {
    parts.push(`<text x="${n(left)}" y="${n(top - 6)}" font-family="system-ui,sans-serif" ` +
      `font-size="10" fill="${esc(theme.label)}">${esc(scene.yLabel)}</text>`);
  }
  if (scene.xLabel) {
    parts.push(`<text x="${n(right)}" y="${n(bottom + 16)}" text-anchor="end" ` +
      `font-family="system-ui,sans-serif" font-size="10" fill="${esc(theme.label)}">${esc(scene.xLabel)}</text>`);
  }

  // Event markers (dots / rules), clipped to the plot, drawn over the series.
  if (scene.annotations?.length) {
    parts.push(...annotationParts(scene, theme));
  }

  return svgDocument({
    width: w,
    height: h,
    title: scene.title,
    desc: scene.desc,
    body: parts.join(''),
    extra: scene.summary === undefined ? undefined : embedSummary(scene.summary),
  });
}

/** Event markers → SVG: a diamond on the nearest sample of a series, or a vertical rule. The
 *  diamond shape + label carry meaning beyond color (WCAG 1.4.1). */
function annotationParts(scene: SvgScene, theme: SvgTheme): string[] {
  const { margins: m, width: w, height: h, xScale } = scene;
  const left = m.left;
  const right = w - m.right;
  const top = m.top;
  const bottom = h - m.bottom;
  const out: string[] = [];
  for (const a of scene.annotations ?? []) {
    const px = xScale(a.x);
    if (px < left - 1 || px > right + 1) continue;
    const color = esc(a.color);
    if (a.kind === 'rule') {
      out.push(
        `<line x1="${n(px)}" y1="${n(top)}" x2="${n(px)}" y2="${n(bottom)}" stroke="${color}" ` +
          `stroke-width="1" stroke-dasharray="4 3"/>`,
      );
      if (a.showLabel) {
        out.push(
          `<text x="${n(px)}" y="${n(top + 9)}" text-anchor="middle" font-family="system-ui,sans-serif" ` +
            `font-size="10" fill="${color}">${esc(a.label)}</text>`,
        );
      }
      continue;
    }
    // A point marker hides when its series is toggled off (parity with the live chart + announce).
    const target = scene.series[a.seriesIndex];
    if (target && !target.visible) continue;
    const pt = annotationSample(scene.data, scene.series, a);
    if (!pt) continue;
    const py = scene.yScale(pt.y);
    out.push(
      `<path d="M${n(px)},${n(py - 5)}L${n(px + 5)},${n(py)}L${n(px)},${n(py + 5)}L${n(px - 5)},${n(py)}Z" ` +
        `fill="${color}" stroke="${esc(theme.bg)}" stroke-width="1.5"/>`,
    );
    if (a.showLabel) {
      out.push(
        `<text x="${n(px)}" y="${n(py - 9)}" text-anchor="middle" font-family="system-ui,sans-serif" ` +
          `font-size="10" fill="${color}">${esc(a.label)}</text>`,
      );
    }
  }
  return out;
}
