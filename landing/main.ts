/**
 * Landing-page demo: a live, interactive Sightline chart rendering ~120k intraday price
 * ticks — the product showing its own thesis (fast + accessible) on the marketing page.
 */
import { Sightline } from '../src/index.ts';

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

function mount(): void {
  const el = document.getElementById('hero-chart');
  if (!el) return;
  const { x, price, vwap } = buildSession();
  const chart = new Sightline(el, {
    series: [
      { name: 'NDX price', color: '#6ee7a8', type: 'area', fillAlpha: 0.12 },
      { name: 'VWAP', color: '#fbbf24' },
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
