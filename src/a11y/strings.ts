/**
 * Localizable UI strings — every fixed phrase the accessibility layer emits.
 *
 * The library's own prose (keyboard help, legend label, data-summary sentence, table caption)
 * is English by default. In a non-English host document those would be untagged
 * different-language passages (WCAG 3.1.2 Language of Parts). Because each phrase interleaves
 * author content (series names, axis labels, formatted numbers) with connective prose, the
 * correct fix is to let the integrator supply translations that match their page — not to wrap
 * mixed subtrees in a `lang` attribute. Strings are `{token}` templates filled by `format`.
 */

export interface FChartStrings {
  /** Accessible name for the legend button group. No tokens. */
  legendGroup: string;
  /** Per-series visibility state words (visible-only; aria-pressed carries state for AT). */
  shown: string;
  hidden: string;
  /** Keyboard operating instructions woven into the chart's accessible name. No tokens. */
  keyboardHelp: string;
  /** Event-marker key instructions, appended to the accessible name only when the chart has
   *  annotations. No tokens. */
  eventKeysHelp: string;
  /** Word appended to an event-marker announcement when it becomes pinned/selected. No tokens. */
  selected: string;
  /** Chart accessible name. Tokens: `{name}` `{series}` `{points}` `{help}`. */
  chartName: string;
  /** Data-table caption. Tokens: `{caption}` `{series}` `{rows}`. */
  tableCaption: string;
  /** One-line summary, empty dataset. Tokens: `{label}`. */
  summaryNoData: string;
  /** One-line summary, all series hidden. Tokens: `{label}` `{points}`. */
  summaryAllHidden: string;
  /** One-line summary sentence. Tokens: `{label}` `{points}` `{span}` `{parts}`. */
  summaryLine: string;
  /** Per-series clause within the summary. Tokens: `{name}` `{min}` `{max}` `{last}` `{dir}`. */
  summaryPart: string;
  /** Event-annotations clause appended to the summary. Tokens: `{count}` `{labels}`. */
  summaryEvents: string;
  /** x-range phrase within the summary. Tokens: `{start}` `{end}`. */
  summarySpan: string;
  /** Direction phrases. `{pct}` for up/down; flat has no token. */
  trendUp: string;
  trendDown: string;
  trendFlat: string;
  /** Accessible labels for the single-pointer pan buttons. No tokens. */
  pagerPrev: string;
  pagerNext: string;
  /** OHLC value words for candle series (announcements, table headers). No tokens. */
  open: string;
  high: string;
  low: string;
  close: string;
  /** Accessible label for the opt-in CSV download control. No tokens. */
  exportCsv: string;
}

export const DEFAULT_STRINGS: FChartStrings = {
  legendGroup: 'Series — activate to show or hide',
  shown: 'shown',
  hidden: 'hidden',
  keyboardHelp:
    'Left and right arrows move between samples; up and down switch series; ' +
    'Home and End jump to the ends; hold Shift for fine steps. ' +
    'Plus and minus zoom; Escape clears the cursor. ' +
    'A sampled data table follows for screen-reader review.',
  eventKeysHelp:
    'Right and left bracket keys step between event markers; Enter selects the focused marker.',
  selected: 'selected',
  chartName: '{name}. {series} series, {points} points each. {help}',
  tableCaption: '{caption} — {series} series, {rows} sampled rows across the visible range.',
  summaryNoData: '{label}: no data.',
  summaryAllHidden: '{label}: {points} points per series, all series hidden.',
  summaryLine: '{label}: {points} points per series from {span}. {parts}.',
  summaryPart: '{name} ranges {min} to {max}, now {last} ({dir})',
  summaryEvents: '{count} events: {labels}',
  summarySpan: '{start} to {end}',
  trendUp: 'up {pct}%',
  trendDown: 'down {pct}%',
  trendFlat: 'flat',
  pagerPrev: 'Pan to earlier data',
  pagerNext: 'Pan to later data',
  open: 'open',
  high: 'high',
  low: 'low',
  close: 'close',
  exportCsv: 'Download data (CSV)',
};

/** Fill `{token}` placeholders from `vars`. Unknown tokens are left intact (so typos are visible). */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** Merge user overrides onto the English defaults. */
export function resolveStrings(overrides?: Partial<FChartStrings>): FChartStrings {
  return overrides ? { ...DEFAULT_STRINGS, ...overrides } : DEFAULT_STRINGS;
}
