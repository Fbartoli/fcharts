/**
 * SVG export — a standalone `<svg>` string mirroring the current view (the EU data-viz guide
 * lists "export an SVG that can be turned into a tactile graphic" as a non-visual technique;
 * it's also handy for print/embedding). Pure: string in, string out, no DOM — unit-testable.
 *
 * It draws the same downsampled min/max envelope the canvas does (so cost tracks plot width,
 * not N), reproduces per-series dash patterns, and embeds the axis ticks as real `<text>` plus a
 * `<title>`/`<desc>` so the SVG itself is accessible.
 */
import { downsampleColumns } from '../core/downsample.ts';
import type { ChartData, Margins, ResolvedSeries } from '../core/model.ts';
import type { LinearScale } from '../core/scales.ts';

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
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n = (v: number): string => (Math.round(v * 10) / 10).toString();

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

/** Build a complete, standalone SVG document string for the scene. */
export function buildSVG(scene: SvgScene): string {
  const { width: w, height: h, margins: m, xScale, yScale } = scene;
  const left = m.left;
  const right = w - m.right;
  const top = m.top;
  const bottom = h - m.bottom;
  const cols = Math.max(1, Math.floor(right - left));
  const buf = { min: new Float32Array(cols), max: new Float32Array(cols) };
  const parts: string[] = [];

  parts.push(`<rect width="${n(w)}" height="${n(h)}" fill="#ffffff"/>`);

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
  if (grid) parts.push(`<path d="${grid}" stroke="#e5e7eb" stroke-width="1" fill="none"/>`);
  parts.push(
    `<rect x="${n(left)}" y="${n(top)}" width="${n(right - left)}" height="${n(bottom - top)}" ` +
      `fill="none" stroke="#9ca3af" stroke-width="1"/>`,
  );

  // Series envelopes (+ area fill).
  for (const s of scene.series) {
    if (!s.visible) continue;
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
      `font-family="system-ui,sans-serif" font-size="11" fill="#4b5563">${esc(scene.formatY(v))}</text>`);
  }
  for (const t of scene.xTicks) {
    const px = xScale(t);
    if (px < left - 1 || px > right + 1) continue;
    parts.push(`<text x="${n(px)}" y="${n(bottom + 16)}" text-anchor="middle" ` +
      `font-family="system-ui,sans-serif" font-size="11" fill="#4b5563">${esc(scene.formatX(t))}</text>`);
  }
  if (scene.yLabel) {
    parts.push(`<text x="${n(left)}" y="${n(top - 6)}" font-family="system-ui,sans-serif" ` +
      `font-size="10" fill="#6b7280">${esc(scene.yLabel)}</text>`);
  }
  if (scene.xLabel) {
    parts.push(`<text x="${n(right)}" y="${n(bottom + 16)}" text-anchor="end" ` +
      `font-family="system-ui,sans-serif" font-size="10" fill="#6b7280">${esc(scene.xLabel)}</text>`);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" ` +
    `width="${n(w)}" height="${n(h)}" role="img" aria-label="${esc(scene.title)}">` +
    `<title>${esc(scene.title)}</title><desc>${esc(scene.desc)}</desc>${parts.join('')}</svg>`
  );
}
