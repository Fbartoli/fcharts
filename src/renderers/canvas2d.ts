/**
 * Canvas2D renderer — draws the data marks (the fast part). It reads a `RenderScene` and
 * paints grid, plot border, per-series min/max envelopes, and the cursor crosshair.
 *
 * It never iterates raw points directly: it asks the core downsampler for a per-column
 * envelope, so its cost tracks plot width, not N. Envelope buffers are reused across
 * series and frames (zero per-frame allocation in the hot path).
 *
 * Theme colors for grid/axis/cursor come from CSS custom properties on the canvas
 * (`--fc-grid`, `--fc-axis`, `--fc-cursor`, `--fc-ring`) with neutral gray fallbacks that
 * read acceptably on both light and dark backgrounds. Series colors come from config.
 */
import { downsampleColumns, type ColumnEnvelope } from '../core/downsample.ts';
import type { Margins, ResolvedSeries } from '../core/model.ts';
import type { Renderer, RenderScene } from './renderer.ts';

interface ThemeColors {
  grid: string;
  axis: string;
  cursor: string;
  ring: string;
}

/** System colors for Windows High Contrast / forced-colors mode (the bitmap can't auto-adapt). */
interface SystemColors {
  text: string;
  grid: string;
  accent: string;
  bg: string;
}

/**
 * Read forced-colors system colors via a connected probe, or null when forced-colors is inactive.
 * A `<canvas>` bitmap does not participate in forced-colors, so we repaint the marks with these
 * (all series in the system text color, distinguished by their dash patterns — see R5).
 */
function readForcedColors(canvas: HTMLCanvasElement): SystemColors | null {
  const view = canvas.ownerDocument.defaultView;
  if (!view?.matchMedia('(forced-colors: active)').matches) return null;
  const probe = canvas.ownerDocument.createElement('span');
  probe.style.cssText =
    'position:absolute;width:0;height:0;color:CanvasText;' +
    'background-color:Canvas;border-color:GrayText;outline-color:Highlight';
  (canvas.parentElement ?? canvas.ownerDocument.body).append(probe);
  const cs = getComputedStyle(probe);
  const sys: SystemColors = {
    text: cs.color,
    grid: cs.borderColor,
    bg: cs.backgroundColor,
    accent: cs.outlineColor,
  };
  probe.remove();
  return sys;
}

function readTheme(canvas: HTMLCanvasElement): ThemeColors {
  const cs = getComputedStyle(canvas);
  const v = (name: string, fallback: string): string =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    // Grid/axis are decorative aids (not the "graphical object required to understand" that
    // 1.4.11 governs — that's the series marks, see DEFAULT_PALETTE). Raised from 0.13/0.30 for
    // legible defaults; a translucent gray line can't reach 3:1 on white and isn't required to.
    grid: v('--fc-grid', 'rgba(128,128,128,0.20)'),
    axis: v('--fc-axis', 'rgba(128,128,128,0.40)'),
    cursor: v('--fc-cursor', 'rgba(128,128,128,0.55)'),
    ring: v('--fc-ring', 'rgba(255,255,255,0.85)'),
  };
}

export function createCanvas2DRenderer(canvas: HTMLCanvasElement): Renderer {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('fcharts: could not acquire a 2D canvas context.');
  const ctx: CanvasRenderingContext2D = context;

  let cssW = 0;
  let cssH = 0;
  let dpr = 0;
  let theme = readTheme(canvas);
  // System colors, read only when forced-colors *toggles* (reading forces layout, so not per-frame).
  let forced: SystemColors | null = null;
  let forcedActive = false;
  let forcedRead = false; // whether we've already probed for the current forcedActive value
  const buf = { min: new Float32Array(0), max: new Float32Array(0) };

  function syncSize(scene: RenderScene): void {
    if (scene.width === cssW && scene.height === cssH && scene.dpr === dpr) return;
    cssW = scene.width;
    cssH = scene.height;
    dpr = scene.dpr;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    theme = readTheme(canvas);
  }

  function render(scene: RenderScene): void {
    syncSize(scene);
    // Probe only on a genuine toggle. Keying off `!forced` would re-probe every frame when the
    // option is pinned true but the OS media query is inactive (readForcedColors returns null),
    // forcing a layout reflow in the render hot path.
    if (scene.forcedColors !== forcedActive || !forcedRead) {
      forced = scene.forcedColors ? readForcedColors(canvas) : null;
      forcedActive = scene.forcedColors;
      forcedRead = true;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const m = scene.margins;
    const plotW = Math.max(1, cssW - m.left - m.right);
    const plotH = Math.max(1, cssH - m.top - m.bottom);

    drawGrid(scene, plotW, plotH);

    const cols = Math.max(1, Math.floor(plotW));
    if (buf.min.length !== cols) {
      buf.min = new Float32Array(cols);
      buf.max = new Float32Array(cols);
    }
    for (const s of scene.series) {
      if (!s.visible) continue;
      const env = downsampleColumns(
        scene.data.x,
        scene.data.y[s.index],
        scene.data.pyramids[s.index],
        scene.domain,
        cols,
        buf,
      );
      if (env.first < 0) continue;
      if (s.type === 'area') drawArea(scene, s, env, m, plotH);
      drawEnvelope(scene, s, env, m);
    }

    if (scene.cursor) drawCursor(scene, m, plotH);
  }

  function drawGrid(scene: RenderScene, plotW: number, plotH: number): void {
    const m = scene.margins;
    const left = m.left;
    const right = m.left + plotW;
    const top = m.top;
    const bottom = m.top + plotH;

    ctx.lineWidth = 1;
    ctx.strokeStyle = forced ? forced.grid : scene.highContrast ? theme.axis : theme.grid;
    ctx.beginPath();
    for (const value of scene.yTicks) {
      const py = Math.round(scene.yScale(value)) + 0.5;
      if (py < top - 1 || py > bottom + 1) continue;
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
    }
    for (const tick of scene.xTicks) {
      const px = Math.round(scene.xScale(tick)) + 0.5;
      if (px < left - 1 || px > right + 1) continue;
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
    }
    ctx.stroke();

    ctx.strokeStyle = forced ? forced.text : theme.axis;
    ctx.strokeRect(left + 0.5, top + 0.5, plotW - 1, plotH - 1);
  }

  function drawEnvelope(
    scene: RenderScene,
    s: ResolvedSeries,
    env: ColumnEnvelope,
    m: Margins,
  ): void {
    const y = scene.yScale;
    ctx.beginPath();
    let started = false;
    for (let c = env.first; c <= env.last; c++) {
      if (env.min[c] === Infinity) continue;
      const x = m.left + c + 0.5;
      const pMax = y(env.max[c]);
      const pMin = y(env.min[c]);
      if (!started) {
        ctx.moveTo(x, pMax);
        started = true;
      } else {
        ctx.lineTo(x, pMax);
      }
      ctx.lineTo(x, pMin);
    }
    // Under forced-colors every series uses the system text color; the dash distinguishes them.
    ctx.strokeStyle = forced ? forced.text : s.color;
    ctx.lineWidth = scene.highContrast ? s.width + 0.75 : s.width;
    ctx.lineJoin = 'round';
    // Per-series dash so colour isn't the only channel (WCAG 1.4.1). [] = solid.
    ctx.setLineDash(s.dash);
    ctx.globalAlpha = 0.95;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawArea(
    scene: RenderScene,
    s: ResolvedSeries,
    env: ColumnEnvelope,
    m: Margins,
    plotH: number,
  ): void {
    const y = scene.yScale;
    const top = m.top;
    const bottom = m.top + plotH;
    const zero = y(0);
    const baseline = zero < top ? top : zero > bottom ? bottom : zero;

    ctx.beginPath();
    let started = false;
    let lastX = m.left;
    for (let c = env.first; c <= env.last; c++) {
      if (env.min[c] === Infinity) continue;
      const x = m.left + c + 0.5;
      const pMax = y(env.max[c]);
      if (!started) {
        ctx.moveTo(x, baseline);
        ctx.lineTo(x, pMax);
        started = true;
      } else {
        ctx.lineTo(x, pMax);
      }
      lastX = x;
    }
    ctx.lineTo(lastX, baseline);
    ctx.closePath();
    ctx.fillStyle = forced ? forced.text : s.color;
    ctx.globalAlpha = s.fillAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCursor(scene: RenderScene, m: Margins, plotH: number): void {
    const cur = scene.cursor!;
    const s = scene.series[cur.series];
    if (!s || !s.visible) return;
    const xv = scene.data.x[cur.index];
    const v = scene.data.y[s.index][cur.index];
    const px = scene.xScale(xv);
    const py = scene.yScale(v);
    const left = m.left;
    const right = scene.width - m.right;
    if (px < left - 2 || px > right + 2) return;

    ctx.save();
    ctx.strokeStyle = forced ? forced.text : theme.cursor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, m.top);
    ctx.lineTo(px, m.top + plotH);
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = forced ? forced.accent : s.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = forced ? forced.bg : theme.ring;
    ctx.stroke();
    ctx.restore();
  }

  return {
    render,
    destroy(): void {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      buf.min = new Float32Array(0);
      buf.max = new Float32Array(0);
    },
  };
}
