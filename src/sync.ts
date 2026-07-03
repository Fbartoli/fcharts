/**
 * Linked multi-pane charts — one x-domain across panes (price + volume, sensor stacks).
 *
 * Built on {@link FChart.onDomainChange}: when the user zooms/pans any pane, every other pane
 * follows synchronously via `renderSync(domain)`. The follower's own change notification is
 * suppressed while the group is applying, so panes can't feed back. Panes keep their own
 * y-domains, cursors, and a11y layers — only the x-window is shared. For identical hard
 * bounds across panes, construct them with the same explicit `options.xPad`.
 */
import type { FChart } from './fchart.ts';

/** Link the charts' x-domains. Returns an unlink function (charts themselves are untouched). */
export function syncCharts(charts: readonly FChart[]): () => void {
  let applying = false;
  const unsubs = charts.map((chart) =>
    chart.onDomainChange((domain) => {
      if (applying) return;
      applying = true;
      try {
        for (const other of charts) {
          if (other !== chart) other.renderSync(domain);
        }
      } finally {
        applying = false;
      }
    }),
  );
  return () => {
    for (const u of unsubs) u();
  };
}
