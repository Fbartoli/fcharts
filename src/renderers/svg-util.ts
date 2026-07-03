/**
 * Shared SVG-building primitives — escaping, number formatting, the document envelope, and the
 * machine-readable JSON embed. Used by every pure-SVG renderer (`svg-export` time-series plus the
 * donut / scatter / sparkline / bars primitives) so escaping and the agent-readable contract are
 * defined once, not re-derived per chart type.
 */

/** Escape a string for inclusion in SVG text / attribute values. */
export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Round to 0.1px — small, stable SVG numbers (sub-pixel precision is noise at render time). */
export const n = (v: number): string => (Math.round(v * 10) / 10).toString();

/**
 * An embedded `<script type="application/json" data-fcharts>` block carrying a structured summary.
 * This is the same agent-readable contract the live DOM chart exposes, so a static server-rendered
 * SVG stays machine-readable to crawlers and AI agents with no JS running. Returns '' when omitted.
 */
export function embedSummary(summary: unknown): string {
  return (
    `<script type="application/json" data-fcharts="summary">` +
    // `]]>`/`</` can't appear in JSON.stringify output except inside strings; escape `<` so the
    // script element can never be closed early by hostile label text.
    `${JSON.stringify(summary).replace(/</g, '\\u003c')}</script>`
  );
}

/**
 * Wrap inner SVG markup in a focusable hyperlink when `href` is set, else return it unchanged.
 *
 * Uses the SVG2 plain `href` attribute (not the legacy `xlink:href`), so the document needs no
 * extra `xmlns:xlink` declaration to stay well-formed standalone, and the `<a>` is keyboard-
 * focusable — the drill-down affordance a donut slice / bar row needs. Presentation only: the
 * embedded JSON summary and `<desc>` are unaffected by links.
 */
export function anchor(href: string | undefined, inner: string): string {
  return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
}

/**
 * Wrap body parts in a complete, standalone SVG document with an accessible name + description.
 * `extra` is appended after `<desc>` (e.g. the embedded JSON summary).
 */
export function svgDocument(opts: {
  width: number;
  height: number;
  title: string;
  desc: string;
  body: string;
  extra?: string;
}): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(opts.width)} ${n(opts.height)}" ` +
    `width="${n(opts.width)}" height="${n(opts.height)}" role="img" aria-label="${esc(opts.title)}">` +
    `<title>${esc(opts.title)}</title><desc>${esc(opts.desc)}</desc>` +
    `${opts.extra ?? ''}${opts.body}</svg>`
  );
}
