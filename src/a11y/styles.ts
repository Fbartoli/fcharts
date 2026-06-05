/**
 * Base styles, injected once per document on first chart construction. Kept tiny and
 * self-contained so consumers don't need a separate CSS import. Theming is via a handful
 * of CSS custom properties (`--sl-*`); everything else is layout and the screen-reader
 * visually-hidden pattern.
 */

const CSS = `
.sl-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;
  font-family:var(--sl-font,system-ui,-apple-system,sans-serif);color:var(--sl-ink,#374151);
  box-sizing:border-box}
.sl-root *{box-sizing:border-box}
.sl-plot{position:relative;flex:1 1 auto;min-height:0}
.sl-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sl-ticks{position:absolute;inset:0;pointer-events:none}
.sl-tick{position:absolute;font-size:11px;color:var(--sl-tick-color,#4b5563);white-space:nowrap;
  font-variant-numeric:tabular-nums}
.sl-tick-x{transform:translateX(-50%);bottom:8px}
.sl-tick-y{transform:translateY(-50%);left:8px}
.sl-axis-title{position:absolute;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--sl-axis-title,#6b7280)}
.sl-axis-title-x{bottom:8px;right:12px}
.sl-axis-title-y{top:8px;left:8px}
.sl-surface{position:absolute;outline:none;border-radius:6px;background:transparent}
.sl-surface:focus-visible{box-shadow:0 0 0 2px var(--sl-focus,#2563eb)}
.sl-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.sl-readout{position:absolute;z-index:5;pointer-events:none;transform:translate(-50%,-120%);
  background:var(--sl-readout-bg,#111827);color:var(--sl-readout-ink,#f9fafb);
  border:1px solid var(--sl-readout-border,rgba(255,255,255,.15));border-radius:8px;padding:6px 9px;
  font-size:12px;min-width:118px;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;
  transition:opacity .08s}
.sl-readout.sl-show{opacity:1}
.sl-readout-series{display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:2px}
.sl-readout-swatch{width:9px;height:9px;border-radius:2px;flex:none}
.sl-readout-val{opacity:.85;font-variant-numeric:tabular-nums}
.sl-legend{padding:8px 4px}
.sl-legend ul{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.sl-legend li{margin:0}
.sl-legend button{display:inline-flex;align-items:center;gap:7px;cursor:pointer;padding:5px 10px;
  min-height:24px;min-width:24px;line-height:1.1;
  border-radius:7px;border:1px solid var(--sl-legend-border,rgba(0,0,0,.15));
  background:var(--sl-legend-bg,transparent);color:inherit;font:inherit;font-size:12.5px;
  font-weight:600}
.sl-legend button:hover{border-color:var(--sl-legend-border-hover,rgba(0,0,0,.4))}
/* "Hidden" state is conveyed by aria-pressed (to AT), a strikethrough name and a dimmed
   swatch (to sighted users) — never by reducing text opacity, which would drop the label
   below the 4.5:1 contrast minimum (WCAG 1.4.3). */
.sl-legend button[aria-pressed="false"] .sl-swatch{opacity:.35}
.sl-legend button[aria-pressed="false"] .sl-legend-name{text-decoration:line-through}
.sl-swatch{width:18px;height:10px;flex:none;overflow:visible}
.sl-legend-name{white-space:nowrap}
.sl-legend-state{font-size:10px;font-weight:500}
@media (prefers-reduced-motion:reduce){.sl-readout{transition:none}}
@media (prefers-contrast:more){
  .sl-tick{color:var(--sl-tick-color,#1f2937)}
  .sl-legend button{border-color:var(--sl-legend-border-hover,#000)}
  .sl-surface:focus-visible{outline:2px solid var(--sl-focus,#2563eb);outline-offset:1px}
}
/* Windows High Contrast / forced-colors ignores box-shadow, so the box-shadow focus ring
   vanishes there. Provide a real outline (which forced-colors honors) using a system color. */
@media (forced-colors:active){
  .sl-surface:focus-visible{outline:2px solid Highlight;outline-offset:1px}
}
`;

/** Inject the stylesheet once per document. Idempotent. */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById('sl-styles')) return;
  const style = doc.createElement('style');
  style.id = 'sl-styles';
  style.textContent = CSS;
  (doc.head ?? doc.documentElement).append(style);
}
