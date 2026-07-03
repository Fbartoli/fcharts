/**
 * Base styles, injected once per document on first chart construction. Kept tiny and
 * self-contained so consumers don't need a separate CSS import. Theming is via a handful
 * of CSS custom properties (`--fc-*`); everything else is layout and the screen-reader
 * visually-hidden pattern.
 */

const CSS = `
.fc-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;
  font-family:var(--fc-font,system-ui,-apple-system,sans-serif);color:var(--fc-ink,#374151);
  box-sizing:border-box}
.fc-root *{box-sizing:border-box}
.fc-plot{position:relative;flex:1 1 auto;min-height:0}
.fc-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fc-ticks{position:absolute;inset:0;pointer-events:none}
.fc-tick{position:absolute;font-size:.6875rem;color:var(--fc-tick-color,#4b5563);white-space:nowrap;
  font-variant-numeric:tabular-nums}
.fc-tick-x{transform:translateX(-50%);bottom:8px}
.fc-tick-y{transform:translateY(-50%);left:8px}
.fc-axis-title{position:absolute;font-size:.625rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--fc-axis-title,#6b7280)}
.fc-axis-title-x{bottom:8px;right:12px}
.fc-axis-title-y{top:8px;left:8px}
.fc-surface{position:absolute;outline:none;border-radius:6px;background:transparent}
.fc-surface:focus-visible{box-shadow:0 0 0 2px var(--fc-focus,#2563eb)}
.fc-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.fc-readout{position:absolute;z-index:5;pointer-events:none;transform:translate(-50%,-120%);
  background:var(--fc-readout-bg,#111827);color:var(--fc-readout-ink,#f9fafb);
  border:1px solid var(--fc-readout-border,rgba(255,255,255,.15));border-radius:8px;padding:6px 9px;
  font-size:.75rem;min-width:118px;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;
  transition:opacity .08s}
.fc-readout.fc-show{opacity:1}
/* attachReadout() variant for static-SVG charts: fixed to the viewport and positioned by JS
   (left/top are the top-left corner, so no centering transform), clamped + edge-flipped there. */
.fc-readout-fixed{position:fixed;transform:none}
.fc-readout-series{display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:2px}
.fc-readout-swatch{width:9px;height:9px;border-radius:2px;flex:none}
.fc-readout-val{opacity:.85;font-variant-numeric:tabular-nums}
.fc-legend{padding:8px 4px}
.fc-legend ul{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.fc-legend li{margin:0}
.fc-legend button{display:inline-flex;align-items:center;gap:7px;cursor:pointer;padding:5px 10px;
  min-height:24px;min-width:24px;line-height:1.1;
  border-radius:7px;border:1px solid var(--fc-legend-border,rgba(0,0,0,.15));
  background:var(--fc-legend-bg,transparent);color:inherit;font:inherit;font-size:.78rem;
  font-weight:600}
.fc-legend button:hover{border-color:var(--fc-legend-border-hover,rgba(0,0,0,.4))}
/* "Hidden" state is conveyed by aria-pressed (to AT), a strikethrough name and a dimmed
   swatch (to sighted users) — never by reducing text opacity, which would drop the label
   below the 4.5:1 contrast minimum (WCAG 1.4.3). */
.fc-legend button[aria-pressed="false"] .fc-swatch{opacity:.35}
.fc-legend button[aria-pressed="false"] .fc-legend-name{text-decoration:line-through}
.fc-swatch{width:18px;height:10px;flex:none;overflow:visible}
.fc-legend-name{white-space:nowrap}
.fc-legend-state{font-size:.625rem;font-weight:500}
/* Single-pointer pan affordance (WCAG 2.5.7) — real buttons, >=24x24 target (2.5.8). */
.fc-pagers{position:absolute;right:10px;bottom:8px;display:flex;gap:6px;z-index:6}
.fc-pager{min-width:28px;min-height:28px;display:inline-flex;align-items:center;justify-content:center;
  cursor:pointer;border:1px solid var(--fc-legend-border,rgba(0,0,0,.15));border-radius:7px;
  background:var(--fc-legend-bg,rgba(127,127,127,.10));color:inherit;font:inherit;font-size:1rem;
  line-height:1;opacity:.55;transition:opacity .1s}
.fc-pager:hover,.fc-pager:focus-visible{opacity:1}
.fc-pager:disabled{opacity:.2;cursor:default}
@media (prefers-reduced-motion:reduce){.fc-readout{transition:none}}
@media (prefers-contrast:more){
  .fc-tick{color:var(--fc-tick-color,#1f2937)}
  .fc-legend button{border-color:var(--fc-legend-border-hover,#000)}
  .fc-surface:focus-visible{outline:2px solid var(--fc-focus,#2563eb);outline-offset:1px}
}
/* Windows High Contrast / forced-colors ignores box-shadow, so the box-shadow focus ring
   vanishes there. Provide a real outline (which forced-colors honors) using a system color. */
@media (forced-colors:active){
  .fc-surface:focus-visible{outline:2px solid Highlight;outline-offset:1px}
}
`;

/** Inject the stylesheet once per document. Idempotent. */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById('fc-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fc-styles';
  style.textContent = CSS;
  (doc.head ?? doc.documentElement).append(style);
}
