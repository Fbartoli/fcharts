/**
 * attachReadout — a styled DOM hover tooltip for STATIC-SVG charts (the donut / scatter / bars
 * primitives), giving them the same instant `.fc-readout` box the interactive `FChart` shows.
 *
 * The pure-SVG builders stay string-in / string-out; this is an opt-in progressive enhancement
 * attached client-side (the same shape as `injectStyles()` / `FChart` upgrading an SSR fallback).
 * A native `<svg><title>` yields only the slow, unstyled OS tooltip; this finds the labelled
 * hit-targets (`.fc-hit`, e.g. `buildScatterSVG`'s hover halo), lifts their `<title>` text so the
 * native tooltip can't also fire, and shows a viewport-fixed, edge-clamped box that reuses the
 * shared `buildReadout` markup + CSS — so static and interactive tooltips look identical.
 *
 * Accessibility is unchanged: the box is decorative (`aria-hidden`); the SVG keeps `role="img"` +
 * `<title>`/`<desc>` + the embedded `data-fcharts` summary as the real text alternative. With JS
 * off, the `<title>` survives and the (delayed) native tooltip is the graceful fallback.
 */
import { injectStyles } from './styles.ts';
import { buildReadout } from './readout.ts';

export interface AttachReadoutOptions {
  /** CSS selector for hit-targets inside `root`. Default `.fc-hit`. */
  hitSelector?: string;
}

const NOOP = (): void => {};

/**
 * Attach a styled hover readout to every `.fc-hit` target inside `root`.
 *
 * @param root Element containing one or more static-SVG charts.
 * @param opts.hitSelector Override the hit-target selector (default `.fc-hit`).
 * @returns A disposer that removes the listeners + box and restores the lifted `<title>` nodes.
 */
export function attachReadout(root: Element, opts: AttachReadoutOptions = {}): () => void {
  const doc = root.ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) return NOOP;
  injectStyles(doc);

  const hitSelector = opts.hitSelector ?? '.fc-hit';
  const readout = buildReadout(doc);
  readout.el.classList.add('fc-readout-fixed');
  (doc.body ?? doc.documentElement).append(readout.el);

  // Lift each target's <title> into a data attribute and drop the node, so the slow native OS
  // tooltip never also appears (the disposer restores it; JS-off keeps it as the fallback).
  const lifted: { target: Element; title: Element }[] = [];
  root.querySelectorAll(hitSelector).forEach((target) => {
    const title = target.querySelector('title');
    if (!title) return;
    target.setAttribute('data-fc-label', title.textContent ?? '');
    title.remove();
    lifted.push({ target, title });
  });

  const hide = (): void => readout.el.classList.remove('fc-show');
  const showAt = (target: Element, clientX: number, clientY: number): void => {
    readout.name.textContent = target.getAttribute('data-fc-label') ?? '';
    readout.value.textContent = '';
    readout.value.style.display = 'none';
    // Swatch color: an explicit data attribute wins; else the visible dot is the previous sibling.
    const swatch =
      target.getAttribute('data-fc-swatch') ?? target.previousElementSibling?.getAttribute('fill') ?? '';
    readout.swatch.style.background = swatch;
    readout.swatch.style.visibility = swatch ? 'visible' : 'hidden';
    place(readout.el, clientX, clientY, win);
    readout.el.classList.add('fc-show');
  };

  const onMove = (e: Event): void => {
    const pe = e as PointerEvent;
    const from = pe.target;
    const target = from instanceof Element ? from.closest(hitSelector) : null;
    if (target && root.contains(target)) showAt(target, pe.clientX, pe.clientY);
    else hide();
  };

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', hide);

  return () => {
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', hide);
    readout.el.remove();
    for (const { target, title } of lifted) {
      target.append(title);
      target.removeAttribute('data-fc-label');
    }
  };
}

/**
 * Place `el` (a viewport-fixed box) near the cursor: above by default, flipped below when it would
 * clip the top, and clamped into the viewport so a narrow panel never cuts it off.
 */
function place(el: HTMLElement, clientX: number, clientY: number, win: Window): void {
  const rect = el.getBoundingClientRect();
  const margin = 8;
  const gap = 14;
  let top = clientY - rect.height - gap;
  if (top < margin) top = clientY + gap;
  const maxLeft = Math.max(margin, win.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, win.innerHeight - rect.height - margin);
  const left = Math.min(Math.max(clientX - rect.width / 2, margin), maxLeft);
  top = Math.min(Math.max(top, margin), maxTop);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
