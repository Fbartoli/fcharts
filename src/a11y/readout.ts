/**
 * The hover readout box — the dark, rounded tooltip with a color swatch and a tabular value.
 *
 * Factored out of `fchart.ts` so the interactive canvas chart and the static-SVG {@link
 * attachReadout} helper build the SAME markup and share the `.fc-readout*` CSS (`a11y/styles.ts`):
 * one look, styled by the same `--fc-readout-*` custom properties, instead of every static-SVG
 * consumer re-rolling its own tooltip.
 */

export interface ReadoutEls {
  el: HTMLElement;
  swatch: HTMLElement;
  name: HTMLElement;
  value: HTMLElement;
}

/** Build the readout DOM (detached). The caller appends it and toggles the `.fc-show` class. */
export function buildReadout(doc: Document): ReadoutEls {
  const el = doc.createElement('div');
  el.className = 'fc-readout';
  el.setAttribute('aria-hidden', 'true');
  const series = doc.createElement('div');
  series.className = 'fc-readout-series';
  const swatch = doc.createElement('span');
  swatch.className = 'fc-readout-swatch';
  const name = doc.createElement('span');
  series.append(swatch, name);
  const value = doc.createElement('div');
  value.className = 'fc-readout-val';
  el.append(series, value);
  return { el, swatch, name, value };
}
