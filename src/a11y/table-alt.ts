/**
 * Visually-hidden data table — the text alternative for the chart.
 *
 * A `<canvas>` is opaque to assistive tech, so we mirror the (downsampled) visible data as
 * a real `<table>` in the accessibility tree: caption, column headers, row headers. This
 * gives screen-reader users a structured read of the data and satisfies "non-text content
 * has a text alternative". Rebuilt on data/visibility/domain change, never per frame.
 */
import { lowerBound } from '../core/downsample.ts';
import type { ChartData, ResolvedSeries } from '../core/model.ts';

export interface TableUpdate {
  data: ChartData;
  series: readonly ResolvedSeries[];
  domain: readonly [number, number];
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  caption: string;
  /** Max sampled rows (the table summarizes, it does not dump all N). Default 40. */
  maxRows?: number;
}

/** Evenly spaced sample indices spanning the visible range [i0, i1] inclusive. */
function sampleIndices(i0: number, i1: number, maxRows: number): number[] {
  const count = i1 - i0 + 1;
  if (count <= 0) return [];
  if (count <= maxRows) {
    const out: number[] = [];
    for (let i = i0; i <= i1; i++) out.push(i);
    return out;
  }
  const out: number[] = [];
  for (let r = 0; r < maxRows; r++) {
    out.push(i0 + Math.round((r / (maxRows - 1)) * (count - 1)));
  }
  return out;
}

export class TableAlt {
  readonly el: HTMLElement;
  private readonly table: HTMLTableElement;
  private readonly doc: Document;

  constructor(doc: Document = document) {
    this.doc = doc;
    this.el = doc.createElement('div');
    this.el.className = 'sl-sr-only sl-table-alt';
    this.table = doc.createElement('table');
    this.el.append(this.table);
  }

  update(u: TableUpdate): void {
    const maxRows = u.maxRows ?? 40;
    const visible = u.series.filter((s) => s.visible);
    const [d0, d1] = u.domain;
    const i0 = u.data.n === 0 ? 0 : Math.max(0, lowerBound(u.data.x, d0) - 1);
    const i1 = u.data.n === 0 ? -1 : Math.min(u.data.n - 1, lowerBound(u.data.x, d1));
    const rows = sampleIndices(i0, i1, maxRows);

    const frag = this.doc.createDocumentFragment();
    frag.append(this.buildCaption(u, visible.length, rows.length));
    frag.append(this.buildHead(visible));
    frag.append(this.buildBody(u, visible, rows));

    this.table.replaceChildren(frag);
  }

  private buildCaption(u: TableUpdate, seriesCount: number, rowCount: number): HTMLElement {
    const caption = this.doc.createElement('caption');
    caption.textContent =
      `${u.caption} — ${seriesCount} series, ${rowCount} sampled rows across the visible range.`;
    return caption;
  }

  private buildHead(visible: readonly ResolvedSeries[]): HTMLElement {
    const thead = this.doc.createElement('thead');
    const tr = this.doc.createElement('tr');
    tr.append(this.th('x'));
    for (const s of visible) tr.append(this.th(s.name));
    thead.append(tr);
    return thead;
  }

  private buildBody(
    u: TableUpdate,
    visible: readonly ResolvedSeries[],
    rows: readonly number[],
  ): HTMLElement {
    const tbody = this.doc.createElement('tbody');
    for (const i of rows) {
      const tr = this.doc.createElement('tr');
      const rowHeader = this.th(u.formatX(u.data.x[i]));
      rowHeader.scope = 'row';
      tr.append(rowHeader);
      for (const s of visible) {
        const td = this.doc.createElement('td');
        td.textContent = u.formatY(u.data.y[s.index][i]);
        tr.append(td);
      }
      tbody.append(tr);
    }
    return tbody;
  }

  private th(text: string): HTMLTableCellElement {
    const th = this.doc.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    return th;
  }

  destroy(): void {
    this.el.remove();
  }
}
