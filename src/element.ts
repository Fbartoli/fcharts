/**
 * Web-component wrapper — `<f-chart>` for zero-framework embeds (CMS blocks, dashboards).
 *
 * Registration is explicit (`defineFChart()`), and the element class is created lazily inside
 * it, so importing the barrel stays Node-safe (no `HTMLElement` at module scope) and
 * tree-shakeable. Light DOM, deliberately: the accessibility layer (live region, hidden table,
 * find-in-page ticks) must sit in the page's accessibility tree, not behind a shadow root.
 * Configuration is a property, not an attribute — configs carry functions (formatters), which
 * JSON attributes can't: `document.querySelector('f-chart').config = { series, data }`.
 */
import { FChart, sameConstructionOptions, type FChartConfig } from './fchart.ts';

/** The `<f-chart>` element's public surface (the class itself is created in `defineFChart`). */
export interface FChartElement extends HTMLElement {
  /** Assigning (re)configures the chart: in-place `update()` when construction options allow,
   *  else a clean remount. Reading returns the last assigned config. */
  config: FChartConfig | null;
  /** The live chart instance while connected and configured, else null. */
  readonly chart: FChart | null;
}

/**
 * Register the element (idempotent; default tag `f-chart`) and return its class.
 * Give the element a height (`f-chart { display:block; height:320px }`) like any chart mount.
 */
export function defineFChart(tag = 'f-chart'): CustomElementConstructor {
  const existing = customElements.get(tag);
  if (existing) return existing;

  class FChartHTMLElement extends HTMLElement implements FChartElement {
    private liveChart: FChart | null = null;
    private current: FChartConfig | null = null;

    get chart(): FChart | null {
      return this.liveChart;
    }

    get config(): FChartConfig | null {
      return this.current;
    }

    set config(next: FChartConfig | null) {
      const prev = this.current;
      this.current = next;
      if (!this.isConnected || !next) {
        this.teardown();
        return;
      }
      if (this.liveChart && prev && sameConstructionOptions(prev.options, next.options)) {
        this.liveChart.update(next);
        return;
      }
      this.teardown();
      this.mount();
    }

    connectedCallback(): void {
      if (!this.style.display) this.style.display = 'block';
      if (this.current) this.mount();
    }

    disconnectedCallback(): void {
      this.teardown();
    }

    private mount(): void {
      if (this.current) this.liveChart = new FChart(this, this.current);
    }

    private teardown(): void {
      this.liveChart?.destroy();
      this.liveChart = null;
    }
  }

  customElements.define(tag, FChartHTMLElement);
  return FChartHTMLElement;
}
