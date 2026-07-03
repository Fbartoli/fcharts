/**
 * Svelte adapter — an action, because that's all a Svelte integration needs:
 *
 *   <div style="height:320px" use:fchart={{ series, data, options }} />
 *
 * Dependency-free by construction: a Svelte action is a plain function returning
 * `{ update, destroy }`, so this module imports nothing from Svelte and works with every
 * Svelte version (3/4/5, runes or not). Same update contract as the React and Vue adapters —
 * identity-changed config fields forward via `chart.update()`; a change to a
 * construction-fixed option (`legend`, `sonify`, `exportControl`, `strings`) remounts.
 */
import { FChart, sameConstructionOptions, type FChartConfig } from './fchart.ts';

/** What the action hands back to Svelte (structurally `ActionReturn<FChartConfig>`). */
export interface FChartActionReturn {
  update(config: FChartConfig): void;
  destroy(): void;
}

/** Mount an fcharts chart on the node. The node needs a height, like any chart mount. */
export function fchart(node: HTMLElement, config: FChartConfig): FChartActionReturn {
  let chart = new FChart(node, config);
  let prev = config;
  return {
    update(next: FChartConfig): void {
      if (sameConstructionOptions(prev.options, next.options)) {
        const patch: Partial<FChartConfig> = {};
        if (next.series !== prev.series) patch.series = next.series;
        if (next.data !== prev.data && next.data) patch.data = next.data;
        if (next.options !== prev.options) patch.options = next.options;
        if (next.annotations !== prev.annotations) patch.annotations = next.annotations ?? [];
        if (Object.keys(patch).length > 0) chart.update(patch);
      } else {
        chart.destroy();
        chart = new FChart(node, next);
      }
      prev = next;
    },
    destroy(): void {
      chart.destroy();
    },
  };
}
