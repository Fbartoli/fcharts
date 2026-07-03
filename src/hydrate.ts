/**
 * SSR → live upgrade: swap a server-rendered fcharts SVG (from `renderSVG`) for the
 * interactive `FChart`, with no layout shift and no blank frame.
 *
 * Progressive enhancement in the a11y sense: the static SVG is real content (titled,
 * described, agent-readable) before any JS runs; hydration only *adds* interactivity.
 * The swap is synchronous — the container's box is pinned to its current height, the SVG is
 * lifted out of flow, the chart renders its first frame via `renderSync()`, and only then is
 * the SVG removed — all inside one task, so nothing ever paints half-swapped.
 */
import { FChart, type FChartConfig } from './fchart.ts';

/**
 * Mount a live `FChart` over the static SVG inside `container` and return it.
 * `config` is the same `{ series, data, options, annotations }` the server rendered from —
 * pass the same data so the first live frame matches the static image.
 * Works on a container with no SVG too (it simply mounts the chart).
 */
export function hydrate(container: HTMLElement, config: FChartConfig): FChart {
  const svg = container.querySelector(':scope > svg');
  // The static SVG's box is the only thing giving the container its height; pin it before the
  // SVG leaves the flow, or the chart would measure a zero-height mount (and warn).
  if (!container.style.height) {
    const h = container.getBoundingClientRect().height;
    if (h > 0) container.style.height = `${h}px`;
  }
  if (svg instanceof Element) {
    const s = (svg as SVGElement).style;
    s.position = 'absolute';
    s.inset = '0';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  }
  const chart = new FChart(container, config);
  chart.renderSync();
  svg?.remove();
  return chart;
}
