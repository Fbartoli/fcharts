/**
 * Landing-page demo: a live, interactive Sightline chart rendering ~120k intraday price
 * ticks — the product showing its own thesis (fast + accessible) on the marketing page.
 */
import { Sightline, type ChartSummary, type SeriesSummary } from '../src/index.ts';

const TICKS = 120_000;
const SESSION_OPEN = Date.UTC(2026, 0, 5, 14, 30); // 09:30 ET as UTC ms
const SESSION_MS = 6.5 * 3600 * 1000; // 6.5-hour trading session

function buildSession(): { x: Float64Array; price: Float64Array; vwap: Float64Array } {
  const x = new Float64Array(TICKS);
  const price = new Float64Array(TICKS);
  const vwap = new Float64Array(TICKS);
  const dt = SESSION_MS / TICKS;
  let p = 182.4;
  let v = p;
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < TICKS; i++) {
    x[i] = SESSION_OPEN + i * dt;
    // Intraday drift + mean-reverting noise + occasional jumps.
    const drift = Math.sin(i / TICKS * Math.PI * 1.3) * 0.0009;
    const shock = Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.9 : 0;
    p += drift + (Math.random() - 0.5) * 0.06 + shock;
    const vol = 0.5 + Math.random();
    cumPV += p * vol;
    cumV += vol;
    v = cumPV / cumV; // running VWAP
    price[i] = p;
    vwap[i] = v;
  }
  return { x, price, vwap };
}

function fmtTime(t: number): string {
  const d = new Date(t);
  const h = d.getUTCHours() - 5; // back to ET for display
  const hh = ((h + 24) % 24).toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

const fmtPrice = (v: number): string => `$${v.toFixed(2)}`;
const COLORS = ['#6ee7a8', '#fbbf24'];
const ARROW: Record<string, string> = { up: '▲', down: '▼', flat: '■' };

function mount(): void {
  const el = document.getElementById('hero-chart');
  if (!el) return;
  const { x, price, vwap } = buildSession();
  const chart = new Sightline(el, {
    series: [
      { name: 'NDX price', color: COLORS[0], type: 'area', fillAlpha: 0.12 },
      { name: 'VWAP', color: COLORS[1] },
    ],
    data: { x, y: [price, vwap] },
    options: {
      ariaLabel: 'NDX intraday price, 120,000 ticks',
      xLabel: 'time',
      yLabel: 'price',
      formatX: fmtTime,
      formatY: fmtPrice,
    },
  });
  const badge = document.getElementById('path-badge');
  if (badge) {
    badge.textContent =
      chart.renderPath === 'dom-overlay' ? 'DOM-overlay · no flags' : 'HTML-in-Canvas';
  }
  populateAgentPanel(el);
}

/**
 * Fill the "what the agent reads" panel from the chart's OWN DOM — proving the section's
 * thesis. The sentence comes from the aria-describedby element and the rows + JSON from the
 * embedded `<script data-sightline>`. If those nodes are missing (a library regression),
 * fail loudly rather than silently recomputing and still claiming "read from the DOM".
 */
function populateAgentPanel(host: HTMLElement): void {
  const summaryNode = host.querySelector('[id^="sl-summary-"]');
  const scriptNode = host.querySelector('script[data-sightline]');
  if (!summaryNode || !scriptNode?.textContent) {
    console.warn('Sightline demo: accessible summary nodes not found in the chart DOM.');
    return;
  }
  const summary = JSON.parse(scriptNode.textContent) as ChartSummary;

  const sentenceEl = document.getElementById('agent-sentence');
  if (sentenceEl) sentenceEl.textContent = summaryNode.textContent ?? '';

  const rows = document.getElementById('agent-series');
  if (rows) rows.replaceChildren(...summary.series.map((s, i) => agentRow(s, COLORS[i] ?? '#888')));

  const jsonEl = document.getElementById('agent-json');
  if (jsonEl) {
    const round = (_k: string, v: unknown): unknown =>
      typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    jsonEl.textContent = JSON.stringify(summary, round, 2);
  }
}

/** Build one series row with DOM APIs (textContent — no innerHTML sink for the name). */
function agentRow(s: SeriesSummary, color: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'as-row';
  const swatch = document.createElement('span');
  swatch.className = 'sw';
  swatch.style.background = color;
  const name = document.createElement('span');
  name.className = 'nm';
  name.textContent = s.name;
  const range = document.createElement('span');
  range.className = 'rng';
  range.textContent = `${fmtPrice(s.min)} – ${fmtPrice(s.max)} · now ${fmtPrice(s.last)}`;
  const trend = document.createElement('span');
  trend.className = `tr ${s.trend}`;
  trend.textContent = `${ARROW[s.trend]} ${Math.abs(s.changePct).toFixed(1)}%`;
  row.append(swatch, name, range, trend);
  return row;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
