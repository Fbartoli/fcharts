/**
 * Sightline Playground — interactively configure a chart and watch it rebuild live, with the
 * generated config and the agent-readable summary() shown alongside. Imports the library straight
 * from source (Vite serves `../src/index.ts`).
 */
import { Sightline } from '../src/index.ts';
import type { SightlineOptions, SightlineStrings } from '../src/index.ts';

type SeriesType = 'line' | 'area';
interface SeriesState {
  name: string;
  color: string;
  type: SeriesType;
  width: number;
  fillAlpha: number;
  visible: boolean;
}

const PALETTE = ['#6ee7a8', '#38bdf8', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c', '#22d3ee'];

const FR: Partial<SightlineStrings> = {
  legendGroup: 'Séries — activer pour afficher ou masquer',
  shown: 'affichée',
  hidden: 'masquée',
  keyboardHelp:
    'Flèches gauche et droite pour parcourir les échantillons ; haut et bas pour changer de série ; ' +
    'Début et Fin pour aller aux extrémités ; maintenir Maj pour un pas fin. Plus et moins pour ' +
    'zoomer ; Échap efface le curseur. Un tableau de données échantillonné suit.',
  chartName: '{name}. {series} séries, {points} points chacune. {help}',
  tableCaption: '{caption} — {series} séries, {rows} lignes échantillonnées sur la plage visible.',
  summaryNoData: '{label} : aucune donnée.',
  summaryAllHidden: '{label} : {points} points par série, toutes les séries masquées.',
  summaryLine: '{label} : {points} points par série de {span}. {parts}.',
  summaryPart: '{name} varie de {min} à {max}, maintenant {last} ({dir})',
  summarySpan: '{start} à {end}',
  trendUp: 'hausse {pct} %',
  trendDown: 'baisse {pct} %',
  trendFlat: 'stable',
};

// --- state ---
let series: SeriesState[] = [
  { name: 'Pressure', color: PALETTE[0], type: 'line', width: 1.5, fillAlpha: 0.15, visible: true },
  { name: 'Temperature', color: PALETTE[1], type: 'area', width: 1.5, fillAlpha: 0.18, visible: true },
  { name: 'Vibration', color: PALETTE[2], type: 'line', width: 1.5, fillAlpha: 0.15, visible: true },
];
let gen = 'waves';
let points = 20000;
let locale: 'en' | 'fr' = 'en';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const chartEl = $('chart');
let chart: Sightline | null = null;

// --- data generators (cached; regenerated only when shape / point-count / series-count change) ---
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genSeries(shape: string, n: number, k: number): Float64Array {
  const y = new Float64Array(n);
  const rnd = mulberry32(1337 + k * 101);
  if (shape === 'walk') {
    let v = 50 + k * 8;
    for (let i = 0; i < n; i++) {
      v += (rnd() - 0.5) * 2.2;
      y[i] = v;
    }
  } else if (shape === 'trend') {
    const slope = (k % 2 ? 1 : -1) * (30 + k * 6);
    for (let i = 0; i < n; i++) y[i] = 30 + (i / n) * slope + (rnd() - 0.5) * 6 + Math.sin(i * 2e-3) * 3;
  } else if (shape === 'steps') {
    const plateau = Math.max(1, Math.floor(n / 14));
    for (let i = 0; i < n; i++) y[i] = ((Math.floor(i / plateau) + k) % 6) * 12 + 8 + (rnd() - 0.5);
  } else {
    // waves
    for (let i = 0; i < n; i++) {
      y[i] = 40 + Math.sin(i * 8e-4 * (k + 1)) * (26 - k * 3) + Math.sin(i * 3e-3 + k) * 5;
    }
  }
  return y;
}

let cacheKey = '';
let cached: { x: Float64Array; y: Float64Array[] } = { x: new Float64Array(0), y: [] };
function data(): { x: Float64Array; y: Float64Array[] } {
  const key = `${gen}:${points}:${series.length}`;
  if (key !== cacheKey) {
    const x = Float64Array.from({ length: points }, (_, i) => i);
    cached = { x, y: series.map((_, k) => genSeries(gen, points, k)) };
    cacheKey = key;
  }
  return cached;
}

// --- read options from the DOM ---
function readOptions(): SightlineOptions {
  return {
    ariaLabel: ($('opt-title') as HTMLInputElement).value || 'Chart',
    xLabel: ($('opt-xlabel') as HTMLInputElement).value || undefined,
    yLabel: ($('opt-ylabel') as HTMLInputElement).value || undefined,
    legend: ($('opt-legend') as HTMLInputElement).checked,
    xInteger: ($('opt-xinteger') as HTMLInputElement).checked,
    xTickCount: clampInt(($('opt-xticks') as HTMLInputElement).value, 2, 16, 8),
    yTickCount: clampInt(($('opt-yticks') as HTMLInputElement).value, 2, 12, 6),
    reducedMotion: ($('opt-reduced') as HTMLInputElement).checked,
    highContrast: ($('opt-contrast') as HTMLInputElement).checked,
  };
}
function clampInt(v: string, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

// --- build / rebuild the chart ---
let raf = 0;
function scheduleRebuild(): void {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(rebuild);
}

function rebuild(): void {
  chart?.destroy();
  const options: SightlineOptions = { ...readOptions(), strings: locale === 'fr' ? FR : undefined };
  chart = new Sightline(chartEl, {
    series: series.map((s) => ({
      name: s.name,
      color: s.color,
      type: s.type,
      width: s.width,
      fillAlpha: s.fillAlpha,
      visible: s.visible,
    })),
    options,
  });
  chart.setData(data());
  refreshPanels();
}

function refreshPanels(): void {
  if (!chart) return;
  $('badge-points').innerHTML =
    `<b>${points.toLocaleString()}</b> points × <b>${series.length}</b> series`;
  $('badge-path').innerHTML = `render: <b>${chart.renderPath}</b>`;
  $('code').textContent = buildSnippet();
  $('summary').textContent = JSON.stringify(chart.summary(), null, 2);
}

// --- generated config snippet (omits default-valued fields for clean copy/paste) ---
function buildSnippet(): string {
  const o = readOptions();
  const seriesLines = series
    .map((s) => {
      const parts = [`name: ${JSON.stringify(s.name)}`, `color: ${JSON.stringify(s.color)}`];
      if (s.type !== 'line') parts.push(`type: '${s.type}'`);
      if (s.width !== 1.25) parts.push(`width: ${s.width}`);
      if (s.type === 'area' && s.fillAlpha !== 0.15) parts.push(`fillAlpha: ${s.fillAlpha}`);
      if (!s.visible) parts.push('visible: false');
      return `    { ${parts.join(', ')} },`;
    })
    .join('\n');

  const opt: string[] = [`ariaLabel: ${JSON.stringify(o.ariaLabel)}`];
  if (o.xLabel) opt.push(`xLabel: ${JSON.stringify(o.xLabel)}`);
  if (o.yLabel) opt.push(`yLabel: ${JSON.stringify(o.yLabel)}`);
  if (o.legend === false) opt.push('legend: false');
  if (o.xInteger) opt.push('xInteger: true');
  if (o.xTickCount !== 8) opt.push(`xTickCount: ${o.xTickCount}`);
  if (o.yTickCount !== 6) opt.push(`yTickCount: ${o.yTickCount}`);
  if (o.reducedMotion) opt.push('reducedMotion: true');
  if (o.highContrast) opt.push('highContrast: true');
  if (locale === 'fr') opt.push('strings: fr /* localized UI strings */');

  return (
    `import { Sightline } from 'sightline';\n\n` +
    `const chart = new Sightline(el, {\n` +
    `  series: [\n${seriesLines}\n  ],\n` +
    `  options: { ${opt.join(', ')} },\n` +
    `});\n\n` +
    `// x is shared & non-decreasing; one y array per series, each length ${points.toLocaleString()}\n` +
    `chart.setData({ x, y: [/* ${series.length} Float64Array(s) */] });`
  );
}

// --- series control cards (rebuilt only on add/remove, so inputs keep focus while typing) ---
function renderSeriesCards(): void {
  const list = $('series-list');
  list.replaceChildren();
  series.forEach((s, i) => list.append(seriesCard(s, i)));
}

function seriesCard(s: SeriesState, i: number): HTMLElement {
  const card = el('div', 'series-card');

  const top = el('div', 'top');
  const color = input('color', s.color);
  color.oninput = () => { s.color = color.value; scheduleRebuild(); };
  const name = input('text', s.name);
  name.oninput = () => { s.name = name.value; scheduleRebuild(); };
  const remove = el('button', 'iconbtn');
  remove.textContent = '✕';
  remove.title = 'Remove series';
  remove.onclick = () => {
    if (series.length <= 1) return;
    series.splice(i, 1);
    renderSeriesCards();
    scheduleRebuild();
  };
  top.append(color, name, remove);

  const typeSel = document.createElement('select');
  for (const t of ['line', 'area']) {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    if (t === s.type) o.selected = true;
    typeSel.append(o);
  }
  typeSel.onchange = () => { s.type = typeSel.value as SeriesType; scheduleRebuild(); };

  const widthRow = rangeField(`Width ${s.width}`, 'range', String(s.width), 0.5, 4, 0.25, (v, lbl) => {
    s.width = Number(v);
    lbl.textContent = `Width ${s.width}`;
    scheduleRebuild();
  });
  const fillRow = rangeField(`Fill ${s.fillAlpha}`, 'range', String(s.fillAlpha), 0, 0.6, 0.01, (v, lbl) => {
    s.fillAlpha = Number(v);
    lbl.textContent = `Fill ${s.fillAlpha.toFixed(2)}`;
    scheduleRebuild();
  });

  const vis = el('label', 'check');
  const visBox = input('checkbox');
  visBox.checked = s.visible;
  visBox.onchange = () => { s.visible = visBox.checked; scheduleRebuild(); };
  vis.append(visBox, text(' visible'));

  const typeField = el('div', 'field');
  const typeLabel = el('label');
  typeLabel.textContent = 'Type';
  typeField.append(typeLabel, typeSel);

  card.append(top, typeField, widthRow, fillRow, vis);
  return card;
}

// --- DOM helpers ---
function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function text(t: string): Text {
  return document.createTextNode(t);
}
function input(type: string, value?: string): HTMLInputElement {
  const e = document.createElement('input');
  e.type = type;
  if (value !== undefined) e.value = value;
  return e;
}
function rangeField(
  label: string,
  _type: string,
  value: string,
  min: number,
  max: number,
  step: number,
  on: (v: string, lbl: HTMLElement) => void,
): HTMLElement {
  const f = el('div', 'field');
  const lbl = el('label');
  lbl.textContent = label;
  const r = input('range', value);
  r.min = String(min);
  r.max = String(max);
  r.step = String(step);
  r.oninput = () => on(r.value, lbl);
  f.append(lbl, r);
  return f;
}

// --- wire static controls ---
function wire(): void {
  for (const id of ['opt-title', 'opt-xlabel', 'opt-ylabel']) {
    $(id).addEventListener('input', scheduleRebuild);
  }
  for (const id of ['opt-legend', 'opt-xinteger', 'opt-xticks', 'opt-yticks', 'opt-reduced', 'opt-contrast']) {
    $(id).addEventListener('change', scheduleRebuild);
  }

  const genSel = $('opt-gen') as HTMLSelectElement;
  genSel.onchange = () => { gen = genSel.value; scheduleRebuild(); };

  const pts = $('opt-points') as HTMLInputElement;
  pts.oninput = () => {
    points = Number(pts.value);
    $('points-val').textContent = points.toLocaleString();
    scheduleRebuild();
  };

  const loc = $('opt-locale') as HTMLSelectElement;
  loc.onchange = () => { locale = loc.value as 'en' | 'fr'; scheduleRebuild(); };

  $('add-series').onclick = () => {
    const k = series.length;
    series.push({
      name: `Series ${k + 1}`,
      color: PALETTE[k % PALETTE.length],
      type: 'line',
      width: 1.5,
      fillAlpha: 0.15,
      visible: true,
    });
    renderSeriesCards();
    scheduleRebuild();
  };

  $('copy-config').addEventListener('click', () => copy($('code').textContent ?? '', $('copy-config')));
  $('copy-summary').addEventListener('click', () => copy($('summary').textContent ?? '', $('copy-summary')));
}

function copy(textToCopy: string, btn: HTMLElement): void {
  void navigator.clipboard?.writeText(textToCopy);
  const prev = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => (btn.textContent = prev), 1100);
}

renderSeriesCards();
wire();
rebuild();
