/**
 * Landing-page demo: a live, interactive fcharts chart rendering ~120k intraday price
 * ticks — the product showing its own thesis (fast + accessible) on the marketing page.
 */
import { FChart, type ChartSummary, type SeriesSummary } from '../src/index.ts';

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

/** Seconds-granularity time for the live trailing window (where HH:MM would repeat). */
function fmtTimeSec(t: number): string {
  const d = new Date(t);
  const hh = (((d.getUTCHours() - 5) + 24) % 24).toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const fmtPrice = (v: number): string => `$${v.toFixed(2)}`;
const COLORS = ['#6ee7a8', '#fbbf24'];
const ARROW: Record<string, string> = { up: '▲', down: '▼', flat: '■' };

function mount(): void {
  const el = document.getElementById('hero-chart');
  if (!el) return;
  const { x, price, vwap } = buildSession();
  const chart = new FChart(el, {
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
  wireLiveStream(chart, el, x, price, vwap);
}

/**
 * Demo of the streaming `append` API. "Go live" continues the price walk and the chart follows the
 * live tail. Accessibility: user-initiated + pausable (WCAG 2.2.2), pauses when the tab is hidden,
 * and — because this is auto-updating motion — a `prefers-reduced-motion` user gets a discrete
 * "add a batch on click" affordance instead of a continuous animation. The agent panel is re-read
 * from the chart's DOM (~1×/s) while live so it doesn't go stale.
 */
function wireLiveStream(
  chart: FChart,
  el: HTMLElement,
  x: Float64Array,
  price: Float64Array,
  vwap: Float64Array,
): void {
  const btn = document.getElementById('go-live');
  const label = document.getElementById('live-label');
  const count = document.getElementById('tick-count');
  if (!btn || !label) return;
  const dt = SESSION_MS / TICKS;
  const window_ = dt * 600; // show ~the last 600 ticks, so the motion is visible
  let t = x[x.length - 1];
  let p = price[price.length - 1];
  let v = vwap[vwap.length - 1];
  let n = TICKS;
  let timer = 0;
  let sinceRefresh = 0;
  let seeded = false;
  const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reset to a recent slice (once) so the y-axis fits the live price range instead of the whole
  // 6.5h session, and switch the x-axis to seconds — a ~2-min window collapses to one HH:MM label.
  const seed = (): void => {
    if (seeded) return;
    seeded = true;
    const s = TICKS - 600;
    chart.update({
      options: { formatX: fmtTimeSec },
      data: { x: x.slice(s), y: [price.slice(s), vwap.slice(s)] },
    });
  };

  const step = (): void => {
    t += dt;
    p += (Math.random() - 0.5) * 0.06 + Math.sin(t / 7e6) * 0.0015; // bounded random walk + drift
    v += (p - v) * 0.02; // a smooth running average (demo VWAP)
    chart.append(t, [p, v]);
    n += 1;
    if (count) count.textContent = n.toLocaleString();
  };

  const stop = (): void => {
    if (!timer) return;
    clearInterval(timer);
    timer = 0;
    label.textContent = 'Go live';
    btn.setAttribute('aria-pressed', 'false');
    populateAgentPanel(el); // settle the panel to the final state
  };
  const start = (): void => {
    seed();
    chart.renderSync([t - window_ * 0.85, t]); // a trailing window narrower than the data → slides
    timer = window.setInterval(() => {
      step();
      if (++sinceRefresh >= 6) {
        sinceRefresh = 0;
        populateAgentPanel(el); // keep the "read live from the DOM" panel actually live (~1×/s)
      }
    }, 160);
    label.textContent = 'Pause';
    btn.setAttribute('aria-pressed', 'true');
  };
  // Reduced motion: no continuous animation — each click appends a batch in a single discrete update.
  const batch = (): void => {
    seed();
    chart.renderSync([t - window_ * 0.85, t]);
    for (let i = 0; i < 40; i++) step();
    populateAgentPanel(el);
    label.textContent = 'Add more';
  };

  btn.addEventListener('click', () => {
    if (reduced()) {
      batch();
      return;
    }
    if (timer) stop();
    else start();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); // don't stream an offscreen tab
  });
}

/**
 * Fill the "what the agent reads" panel from the chart's OWN DOM — proving the section's
 * thesis. The sentence comes from the aria-describedby element and the rows + JSON from the
 * embedded `<script data-fcharts>`. If those nodes are missing (a library regression),
 * fail loudly rather than silently recomputing and still claiming "read from the DOM".
 */
function populateAgentPanel(host: HTMLElement): void {
  const summaryNode = host.querySelector('[id^="fc-summary-"]');
  const scriptNode = host.querySelector('script[data-fcharts]');
  if (!summaryNode || !scriptNode?.textContent) {
    console.warn('fcharts demo: accessible summary nodes not found in the chart DOM.');
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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function setStatus(el: HTMLElement, msg: string, ok: boolean): void {
  el.textContent = msg;
  el.classList.toggle('ok', ok);
  el.classList.toggle('err', !ok);
}

/** Wire the waitlist form to POST /api/waitlist (Cloudflare Pages Function + D1). */
function wireWaitlist(): void {
  const form = document.getElementById('waitlist-form') as HTMLFormElement | null;
  const status = document.getElementById('wl-status');
  const submit = document.getElementById('wl-submit') as HTMLButtonElement | null;
  if (!form || !status) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitWaitlist(form, status, submit);
  });
}

async function submitWaitlist(
  form: HTMLFormElement,
  status: HTMLElement,
  submit: HTMLButtonElement | null,
): Promise<void> {
  const email = (document.getElementById('wl-email') as HTMLInputElement).value.trim();
  const consent = (document.getElementById('wl-consent') as HTMLInputElement).checked;
  const company = (document.getElementById('wl-hp') as HTMLInputElement).value;
  if (!EMAIL_RE.test(email)) return setStatus(status, 'Enter a valid email address.', false);
  if (!consent) return setStatus(status, 'Please tick the box to continue.', false);
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Sending…';
  }
  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, consent, company, source: 'cta' }),
    });
    if (res.ok) {
      setStatus(status, "You're on the list — we'll be in touch.", true);
      form.reset();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus(status, j.error ?? 'Something went wrong. Please try again.', false);
    }
  } catch {
    setStatus(status, 'Network error — please try again.', false);
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Request access';
    }
  }
}

function init(): void {
  mount();
  wireWaitlist();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
