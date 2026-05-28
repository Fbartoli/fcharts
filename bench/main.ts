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
  peakHeapMB: number | null;
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
    let peakHeap = 0;
    let start: number | undefined;
    const step = (now: number): void => {
      if (start === undefined) start = now;
      const t = (now - start) / durationMs;
      if (t >= 1) {
        resolve(summarize(frames, peakHeap, now - start));
        return;
      }
      adapter.draw(...viewportAt(t, lo, hi));
      frames++;
      const h = heapBytes();
      if (h !== null && h > peakHeap) peakHeap = h;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function summarize(frames: number, peakHeap: number, elapsedMs: number): PerfResult {
  return {
    frames,
    fps: frames / (elapsedMs / 1000),
    peakHeapMB: peakHeap > 0 ? peakHeap / 1048576 : null,
  };
}

/**
 * Mean synchronous per-frame draw cost. Runs draws across the pan/zoom path in a tight
 * loop for a time budget, then divides total elapsed by the iteration count — so the
 * measurement spans many ms and is immune to the browser's ~100µs timer clamp that pins
 * single-frame samples to the floor.
 */
function measureDrawCostMs(adapter: ChartAdapter, n: number, budgetMs = 600, maxIters = 4000): number {
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
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  return { serious: serious.length, ids: serious.map((v) => `${v.id} (${v.impact})`) };
}

function functionalA11y(adapter: ChartAdapter): A11yResult {
  const el = adapter.el;
  const surface = el.querySelector('[role="application"]');
  // A real data text-alternative — not, e.g., uPlot's 1-row legend, which is also a <table>.
  const dataTable = [...el.querySelectorAll('table')].some((t) => t.querySelectorAll('tr').length >= 10);
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
  const headline: HeadlineRow[] = [];
  for (const adapter of adapters) {
    const perf = await measureRun(adapter, dataset.n, durationMs);
    const frameMs = measureDrawCostMs(adapter, dataset.n);
    const axeResult = await runAxe(adapter.el);
    headline.push({
      id: adapter.id,
      label: adapter.label,
      kind: adapter.kind,
      nodeCount: adapter.nodeCount(),
      ...perf,
      frameMs,
      axe: axeResult,
      a11y: functionalA11y(adapter),
    });
  }
  const scaling = await sightlineScaling([10_000, 100_000, 250_000], 3000);
  const results: BenchResults = {
    datasetN: dataset.n,
    durationMs,
    headline,
    scaling,
    preciseHeap: heapBytes() !== null,
  };
  renderTable(results);
  return results;
}

// --- on-page table ---

function smooth(fps: number, frameMs: number): boolean {
  return fps >= 50 && frameMs < 16;
}
function accessible(row: HeadlineRow): boolean {
  return row.axe.serious === 0 && row.a11y.liveRegion && row.a11y.keyboardCursor && row.a11y.textAlternative;
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
      return `<tr${cls}><td>${row.label}</td>
        <td class="mono">${row.fps.toFixed(0)}</td>
        <td class="mono">${row.frameMs.toFixed(3)} ms</td>
        <td class="mono">${row.peakHeapMB === null ? 'n/a' : `${row.peakHeapMB.toFixed(1)} MB`}</td>
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
  const ratio =
    r.scaling.length >= 2
      ? (r.scaling[r.scaling.length - 1].frameMs / Math.max(1e-6, r.scaling[0].frameMs)).toFixed(2)
      : '—';

  const el = document.getElementById('results');
  if (el) {
    el.innerHTML = `
      <h2>Headline — 100k points × 3 series, 5s pan/zoom</h2>
      <table>${head}${rows}</table>
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
