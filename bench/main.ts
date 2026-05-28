/**
 * Benchmark page logic. Builds the same dataset into three renderers, drives a 5-second
 * automated pan/zoom while measuring sustained FPS / median frame time / peak heap, runs
 * axe-core scoped to each chart, and probes functional accessibility (live region,
 * keyboard data surface, text alternative). Renders an on-page table and exposes a
 * `window.__bench` API the Playwright harness drives headlessly.
 */
import axe from 'axe-core';
import { makeDataset, type Dataset } from './dataset.ts';
import type { ChartAdapter, AdapterFactory } from './adapter.ts';
import { createSightline } from './baselines/sightline-chart.ts';
import { createUplot } from './baselines/uplot-chart.ts';
import { createNaiveSvg } from './baselines/naive-svg.ts';

interface PerfResult {
  frames: number;
  fps: number;
}
interface AxeResult {
  serious: number;
  ids: string[];
}
interface A11yResult {
  liveRegion: boolean;
  keyboardCursor: boolean;
  textAlternative: boolean;
}
interface HeadlineRow extends PerfResult {
  id: string;
  label: string;
  kind: string;
  nodeCount: number;
  /** Mean synchronous per-frame cost (ms), measured by batched timing to beat the
   *  ~100µs performance.now() clamp. */
  frameMs: number;
  /** Whether `draw()` defers its real paint to rAF (so frameMs under-reads — see uPlot). */
  deferredDraw: boolean;
  /** JS heap (MB) measured with the renderer ALONE in the page, after GC. */
  peakHeapMB: number | null;
  axe: AxeResult;
  a11y: A11yResult;
}
interface ScalingRow {
  n: number;
  frameMs: number;
}
export interface BenchResults {
  datasetN: number;
  durationMs: number;
  headline: HeadlineRow[];
  scaling: ScalingRow[];
  preciseHeap: boolean;
}

const FACTORIES: { factory: AdapterFactory; cell: string }[] = [
  { factory: createSightline, cell: 'cell-sightline' },
  { factory: createUplot, cell: 'cell-uplot' },
  { factory: createNaiveSvg, cell: 'cell-svg' },
];

let dataset: Dataset;
let adapters: ChartAdapter[] = [];

function heapBytes(): number | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? m.usedJSHeapSize : null;
}

/** Force GC if exposed (Chromium launched with --js-flags=--expose-gc). No-op otherwise. */
function forceGc(): void {
  (globalThis as unknown as { gc?: () => void }).gc?.();
}

/**
 * Heap is only meaningful with forced GC. Without `--js-flags=--expose-gc`, `gc()` is a
 * no-op and `usedJSHeapSize` reflects uncollected garbage (a process-wide high-water mark
 * that looks the same for every renderer), so we report n/a rather than a misleading number.
 */
function gcAvailable(): boolean {
  return typeof (globalThis as { gc?: () => void }).gc === 'function';
}

/** Resolve after two animation frames — lets layout/paint settle before sampling. */
function settle(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/** Pan + zoom path over t in [0, 1]: a 6–12%-wide window whose center sweeps the domain. */
function viewportAt(t: number, lo: number, hi: number): [number, number] {
  const span = hi - lo;
  const windowFrac = 0.06 + 0.06 * (1 + Math.cos(t * Math.PI * 4)) / 2;
  const w = span * windowFrac;
  const sweep = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0→1→0 ease
  const center = lo + (0.08 + 0.84 * sweep) * span;
  let d0 = center - w / 2;
  let d1 = center + w / 2;
  if (d0 < lo) {
    d1 += lo - d0;
    d0 = lo;
  }
  if (d1 > hi) {
    d0 -= d1 - hi;
    d1 = hi;
  }
  return [Math.max(lo, d0), Math.min(hi, d1)];
}

function measureRun(adapter: ChartAdapter, n: number, durationMs: number): Promise<PerfResult> {
  const lo = 0;
  const hi = Math.max(1, n - 1);
  // Warm up (let the JIT settle) before timing.
  for (let i = 0; i < 3; i++) adapter.draw(...viewportAt(i / 3, lo, hi));

  return new Promise((resolve) => {
    let frames = 0;
    let start: number | undefined;
    const step = (now: number): void => {
      if (start === undefined) start = now;
      const t = (now - start) / durationMs;
      if (t >= 1) {
        resolve({ frames, fps: frames / ((now - start) / 1000) });
        return;
      }
      adapter.draw(...viewportAt(t, lo, hi));
      frames++;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * Per-renderer heap, measured honestly: build ONLY this renderer in the page, warm it,
 * force GC, and sample usedJSHeapSize. Measuring all three together (as a process-global
 * running max in factory order) would just report a monotonically growing number that
 * reflects measurement order, not each renderer's footprint.
 */
async function measureHeapIsolated(n: number): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  // Without forced GC the number is meaningless (see gcAvailable). Return {} → every row
  // falls back to n/a in runAll rather than showing a misleading process-wide figure.
  if (!gcAvailable()) return out;
  for (const { factory, cell } of FACTORIES) {
    teardown();
    forceGc();
    const container = document.getElementById(cell);
    if (!container) continue;
    const adapter = factory(container, makeDataset(n));
    for (let i = 0; i < 5; i++) adapter.draw(...viewportAt(i / 5, 0, n - 1));
    await settle();
    forceGc();
    forceGc();
    await settle();
    const h = heapBytes();
    out[adapter.id] = h === null ? null : h / 1048576;
    adapter.destroy();
  }
  return out;
}

/**
 * Mean synchronous per-frame draw cost. Runs draws across the pan/zoom path in a tight
 * loop for a time budget, then divides total elapsed by the iteration count — so the
 * measurement spans many ms and is immune to the browser's ~100µs timer clamp that pins
 * single-frame samples to the floor.
 */
function measureDrawCostMs(
  adapter: ChartAdapter,
  n: number,
  budgetMs = 600,
  maxIters = 4000,
): number {
  const lo = 0;
  const hi = Math.max(1, n - 1);
  for (let i = 0; i < 3; i++) adapter.draw(...viewportAt(i / 3, lo, hi)); // warm up
  let iters = 0;
  const start = performance.now();
  while (iters < maxIters) {
    const [d0, d1] = viewportAt((iters % 240) / 240, lo, hi);
    adapter.draw(d0, d1);
    iters++;
    if (performance.now() - start >= budgetMs) break;
  }
  return (performance.now() - start) / iters;
}

async function runAxe(el: HTMLElement): Promise<AxeResult> {
  const results = await axe.run(el, { resultTypes: ['violations'] });
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  return { serious: serious.length, ids: serious.map((v) => `${v.id} (${v.impact})`) };
}

function functionalA11y(adapter: ChartAdapter): A11yResult {
  const el = adapter.el;
  const surface = el.querySelector('[role="application"]');
  // A real data text-alternative — not, e.g., uPlot's 1-row legend, which is also a <table>.
  const dataTable = [...el.querySelectorAll('table')].some(
    (t) => t.querySelectorAll('tr').length >= 10,
  );
  return {
    liveRegion: !!el.querySelector('[aria-live]'),
    keyboardCursor: !!surface && surface.getAttribute('tabindex') === '0',
    textAlternative: dataTable,
  };
}

function buildAdapters(n: number): void {
  teardown();
  dataset = makeDataset(n);
  adapters = FACTORIES.map(({ factory, cell }) => {
    const container = document.getElementById(cell);
    if (!container) throw new Error(`missing cell ${cell}`);
    return factory(container, dataset);
  });
}

function teardown(): void {
  for (const a of adapters) a.destroy();
  adapters = [];
}

async function sightlineScaling(ns: number[], durationMs: number): Promise<ScalingRow[]> {
  const host = document.getElementById('scaling-host');
  if (!host) return [];
  const rows: ScalingRow[] = [];
  for (const n of ns) {
    const cell = document.createElement('div');
    cell.className = 'bench-chart';
    cell.style.cssText = 'width:640px;height:340px';
    host.append(cell);
    const adapter = createSightline(cell, makeDataset(n));
    await measureRun(adapter, n, durationMs); // warm caches / settle layout
    rows.push({ n, frameMs: measureDrawCostMs(adapter, n) });
    adapter.destroy();
    cell.remove();
  }
  return rows;
}

async function runAll(durationMs = 5000): Promise<BenchResults> {
  if (adapters.length === 0) buildAdapters(100_000);
  const n = dataset.n;
  const headline: HeadlineRow[] = [];
  for (const adapter of adapters) {
    const perf = await measureRun(adapter, n, durationMs);
    const frameMs = measureDrawCostMs(adapter, n);
    const axeResult = await runAxe(adapter.el);
    headline.push({
      id: adapter.id,
      label: adapter.label,
      kind: adapter.kind,
      nodeCount: adapter.nodeCount(),
      ...perf,
      frameMs,
      // A near-zero synchronous cost while clearly rendering means the draw deferred its
      // real paint to rAF (uPlot); FPS is the honest speed metric for that renderer.
      deferredDraw: frameMs < 0.005,
      peakHeapMB: null,
      axe: axeResult,
      a11y: functionalA11y(adapter),
    });
  }

  // Heap, measured per-renderer in isolation (rebuilds the page charts afterwards).
  const heap = await measureHeapIsolated(n);
  buildAdapters(n);
  for (const row of headline) row.peakHeapMB = heap[row.id] ?? null;

  const scaling = await sightlineScaling([10_000, 100_000, 250_000], 3000);
  const results: BenchResults = {
    datasetN: n,
    durationMs,
    headline,
    scaling,
    preciseHeap: gcAvailable() && heapBytes() !== null,
  };
  renderTable(results);
  return results;
}

// --- on-page table ---

// "Smooth" = can render within the 60fps frame budget. Sustained FPS alone is unreliable
// (headless browsers throttle rAF; deferred-redraw libs report an inflated loop rate), so
// frame cost < 16ms is primary, with a high sustained FPS as an alternative witness.
function smooth(fps: number, frameMs: number): boolean {
  return frameMs < 16 || fps >= 55;
}
function accessible(row: HeadlineRow): boolean {
  const a = row.a11y;
  return row.axe.serious === 0 && a.liveRegion && a.keyboardCursor && a.textAlternative;
}
function mark(ok: boolean): string {
  return ok ? '<span class="yes">✓</span>' : '<span class="no">✗</span>';
}

function renderTable(r: BenchResults): void {
  const head = `<tr><th>Renderer</th><th>FPS</th><th>Frame cost (avg)</th>
    <th>Peak heap</th><th>DOM nodes</th><th>axe serious</th><th>Keyboard</th><th>Live region</th>
    <th>Text alt</th><th>Fast + accessible</th></tr>`;
  const rows = r.headline
    .map((row) => {
      const both = smooth(row.fps, row.frameMs) && accessible(row);
      const cls = row.id === 'sightline' ? ' class="me"' : '';
      const frameCell = row.deferredDraw ? '~0 (deferred)†' : `${row.frameMs.toFixed(3)} ms`;
      const heapCell = row.peakHeapMB === null ? 'n/a' : `${row.peakHeapMB.toFixed(1)} MB`;
      return `<tr${cls}><td>${row.label}</td>
        <td class="mono">${row.fps.toFixed(0)}</td>
        <td class="mono">${frameCell}</td>
        <td class="mono">${heapCell}</td>
        <td class="mono">${row.nodeCount.toLocaleString()}</td>
        <td class="mono">${row.axe.serious}</td>
        <td>${mark(row.a11y.keyboardCursor)}</td>
        <td>${mark(row.a11y.liveRegion)}</td>
        <td>${mark(row.a11y.textAlternative)}</td>
        <td>${mark(both)}</td></tr>`;
    })
    .join('');
  const scaling = r.scaling
    .map((s) => `<tr><td class="mono">${s.n.toLocaleString()}</td>
      <td class="mono">${s.frameMs.toFixed(3)} ms</td></tr>`)
    .join('');
  const first = r.scaling[0]?.frameMs ?? 0;
  const last = r.scaling[r.scaling.length - 1]?.frameMs ?? 0;
  const ratio = r.scaling.length >= 2 ? (last / Math.max(1e-6, first)).toFixed(2) : '—';

  const el = document.getElementById('results');
  if (el) {
    el.innerHTML = `
      <h2>Headline — 100k points × 3 series, 5s pan/zoom</h2>
      <table>${head}${rows}</table>
      <p class="note">† uPlot defers its redraw to requestAnimationFrame, so the synchronous
        frame-cost timer reads ~0; its sustained FPS is the honest speed metric. Heap is
        measured per renderer in isolation and only when the browser exposes GC
        (run with <span class="mono">--js-flags=--expose-gc</span>); otherwise it shows n/a,
        because <span class="mono">usedJSHeapSize</span> without forced GC is process-wide
        noise (and never captures the SVG's native DOM nodes anyway).</p>
      <h2>Sightline frame-cost vs N (proves cost is decoupled from point count)</h2>
      <table><tr><th>Points/series</th><th>Frame cost (avg)</th></tr>${scaling}</table>
      <p class="note">250k / 10k frame-cost ratio: <b>${ratio}×</b> (target &lt; 1.5×).</p>`;
  }
}

declare global {
  interface Window {
    __bench?: {
      ready: boolean;
      setup: (n: number) => void;
      runAll: (ms?: number) => Promise<BenchResults>;
      adapterIds: () => string[];
    };
  }
}

function init(): void {
  buildAdapters(100_000);
  const draw0 = (): void => adapters.forEach((a) => a.draw(0, dataset.n - 1));
  draw0();
  window.addEventListener('resize', () => {
    // rebuild on resize so uPlot/SVG pick up the new size
    buildAdapters(dataset.n);
    draw0();
  });
  const btn = document.getElementById('run');
  btn?.addEventListener('click', () => {
    btn.setAttribute('disabled', 'true');
    btn.textContent = 'Running…';
    void runAll(5000).finally(() => {
      btn.removeAttribute('disabled');
      btn.textContent = 'Re-run benchmark';
    });
  });
  window.__bench = {
    ready: true,
    setup: (n) => buildAdapters(n),
    runAll,
    adapterIds: () => adapters.map((a) => a.id),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
