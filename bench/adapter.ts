import type { Dataset } from './dataset.ts';

/** Uniform interface so the harness can drive all three renderers identically. */
export interface ChartAdapter {
  readonly id: string;
  readonly label: string;
  /** Category, for the results narrative. */
  readonly kind: 'sightline' | 'fast-inaccessible' | 'accessible-slow';
  /** The DOM subtree to scope axe-core and functional a11y checks to. */
  readonly el: HTMLElement;
  /** Render synchronously to the x-domain [d0, d1]. The hot path under measurement. */
  draw(d0: number, d1: number): void;
  /** Number of DOM nodes in the chart subtree (drives the heap story). */
  nodeCount(): number;
  destroy(): void;
}

export type AdapterFactory = (container: HTMLElement, data: Dataset) => ChartAdapter;
