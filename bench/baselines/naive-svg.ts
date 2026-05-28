import { SERIES, type Dataset } from '../dataset.ts';
import type { ChartAdapter } from '../adapter.ts';

/**
 * The accessible/slow baseline: a hand-rolled DOM-node-per-point SVG chart (~50k nodes).
 * It is genuinely accessible (labeled image + a real visually-hidden data table that is
 * screen-reader-readable and find-in-page-able) — representing the "accessible SVG" class
 * (e.g. Highcharts). But repositioning ~50k DOM nodes every frame is the performance wall
 * this column exists to demonstrate.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const NODES_TOTAL = 50_000;
const MARGIN = { left: 44, right: 12, top: 12, bottom: 26 };
const TABLE_ROWS = 40;

export function createNaiveSvg(container: HTMLElement, data: Dataset): ChartAdapter {
  const el = document.createElement('div');
  el.className = 'bench-chart';
  container.append(el);
  const rect = el.getBoundingClientRect();
  const width = Math.max(160, Math.round(rect.width));
  const height = Math.max(120, Math.round(rect.height));

  const { yMin, yMax } = extent(data);
  const perSeries = Math.max(1, Math.floor(NODES_TOTAL / data.y.length));
  const sampled = sampleIndices(data.n, perSeries);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Naive SVG — sensor telemetry. 3 series rendered as DOM nodes.');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const title = document.createElementNS(SVG_NS, 'title');
  title.textContent = 'Sensor telemetry (SVG node-per-point)';
  svg.append(title);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const yToPx = (v: number): number => MARGIN.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  // One <circle> per sampled point — the DOM weight that makes this slow.
  const groups = data.y.map((_, s) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('fill', SERIES[s]?.color ?? '#888');
    const circles: SVGCircleElement[] = sampled.map(() => {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('r', '1');
      g.append(c);
      return c;
    });
    svg.append(g);
    return circles;
  });
  el.append(svg);

  // Accessible text alternative: a real, screen-reader-readable, find-in-page-able table.
  el.append(buildTable(data, yMin, yMax));

  function draw(d0: number, d1: number): void {
    const span = d1 - d0 || 1;
    for (let s = 0; s < groups.length; s++) {
      const circles = groups[s];
      const ys = data.y[s];
      for (let k = 0; k < sampled.length; k++) {
        const idx = sampled[k];
        const px = MARGIN.left + ((data.x[idx] - d0) / span) * plotW;
        circles[k].setAttribute('cx', px.toFixed(1));
        circles[k].setAttribute('cy', yToPx(ys[idx]).toFixed(1));
      }
    }
    // Force synchronous layout so the per-frame cost is captured by the caller's timer.
    void svg.getBoundingClientRect().width;
  }

  return {
    id: 'svg',
    label: 'Naive SVG (50k nodes)',
    kind: 'accessible-slow',
    el,
    draw,
    nodeCount: () => el.querySelectorAll('*').length,
    destroy: () => el.remove(),
  };
}

function extent(data: Dataset): { yMin: number; yMax: number } {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const ys of data.y) {
    for (let i = 0; i < ys.length; i++) {
      if (ys[i] < yMin) yMin = ys[i];
      if (ys[i] > yMax) yMax = ys[i];
    }
  }
  return { yMin, yMax };
}

function sampleIndices(n: number, count: number): number[] {
  if (n <= 0) return [];
  const c = Math.min(n, count);
  const out: number[] = [];
  for (let i = 0; i < c; i++) out.push(Math.round((i / Math.max(1, c - 1)) * (n - 1)));
  return out;
}

function buildTable(data: Dataset, _yMin: number, _yMax: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'sr-only';
  const table = document.createElement('table');
  const caption = document.createElement('caption');
  caption.textContent = `Sensor telemetry data — ${data.y.length} series, ${TABLE_ROWS} sampled rows.`;
  table.append(caption);

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.append(th('sample'));
  for (const s of SERIES) hr.append(th(s.name));
  thead.append(hr);
  table.append(thead);

  const tbody = document.createElement('tbody');
  const idxs = sampleIndices(data.n, TABLE_ROWS);
  for (const i of idxs) {
    const tr = document.createElement('tr');
    const rowH = th(String(data.x[i]));
    rowH.scope = 'row';
    tr.append(rowH);
    for (const ys of data.y) {
      const td = document.createElement('td');
      td.textContent = ys[i].toFixed(2);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

function th(text: string): HTMLTableCellElement {
  const cell = document.createElement('th');
  cell.scope = 'col';
  cell.textContent = text;
  return cell;
}
