/**
 * "Nice" axis ticks — round numbers (1/2/5 × 10^k) covering a domain.
 *
 * Ported and generalized from the POC. Renderer-agnostic: returns tick *values*; the
 * a11y layer turns them into positioned DOM text.
 */

/** The nice step size that yields roughly `target` ticks across [min, max]. */
export function tickStep(min: number, max: number, target: number): number {
  const span = max - min;
  if (span <= 0 || !Number.isFinite(span)) return 1;
  const rough = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const factor = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return factor * mag;
}

/**
 * Nice tick values within [min, max].
 *
 * @param min - Domain lower bound.
 * @param max - Domain upper bound.
 * @param target - Desired tick count (a hint; the actual count varies with rounding).
 * @param minStep - Optional floor on the step (e.g. 1 for integer index axes).
 */
export function niceTicks(min: number, max: number, target: number, minStep = 0): number[] {
  if (!(max > min)) return [min];
  const step = Math.max(minStep, tickStep(min, max, target));
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  // Index-based loop avoids floating-point drift from repeated += step.
  for (let k = 0; ; k++) {
    const v = start + k * step;
    if (v > max + step * 1e-9) break;
    // Snap away -0 and tiny FP residue near zero.
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    if (out.length > 1000) break; // safety valve
  }
  return out;
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Sub-day steps use epoch-aligned multiples (deterministic, DST-immune); day+ steps use the
 *  local calendar below so tick boundaries land on real midnights/month starts. */
const TIME_STEPS = [
  SEC, 2 * SEC, 5 * SEC, 10 * SEC, 15 * SEC, 30 * SEC,
  MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
];

/** Local-midnight ticks every `days` days (7/14-day steps align to Monday). */
function dayTicks(min: number, max: number, days: number): number[] {
  const start = new Date(min);
  start.setHours(0, 0, 0, 0);
  if (days % 7 === 0) {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
  }
  const out: number[] = [];
  for (const d = start; d.getTime() <= max; d.setDate(d.getDate() + days)) {
    const t = d.getTime();
    if (t >= min) out.push(t);
    if (out.length > 1000) break;
  }
  return out;
}

/** First-of-month ticks every `months` months, aligned to month-number multiples (Jan/Apr/Jul…). */
function monthTicks(min: number, max: number, months: number): number[] {
  const start = new Date(min);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(Math.floor(start.getMonth() / months) * months);
  const out: number[] = [];
  for (const d = start; d.getTime() <= max; d.setMonth(d.getMonth() + months)) {
    const t = d.getTime();
    if (t >= min) out.push(t);
    if (out.length > 1000) break;
  }
  return out;
}

/**
 * Calendar-aware "nice" ticks for a time x-axis (values = epoch milliseconds, local time).
 * Picks the smallest step from a seconds→minutes→hours→days→months→years ladder that yields
 * at most ~`target` ticks; sub-second spans fall back to plain numeric ticks.
 */
export function niceTimeTicks(min: number, max: number, target: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const per = span / Math.max(1, target);
  if (per < SEC) return niceTicks(min, max, target);
  const step = TIME_STEPS.find((s) => s >= per);
  if (step !== undefined) {
    const out: number[] = [];
    for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
    return out;
  }
  const days = [1, 2, 7, 14].find((d) => d * DAY >= per);
  if (days !== undefined) return dayTicks(min, max, days);
  const months = [1, 2, 3, 6].find((m) => m * 30 * DAY >= per);
  if (months !== undefined) return monthTicks(min, max, months);
  // Years: reuse the 1/2/5 ladder on year counts (>= 1).
  const years = Math.max(1, Math.round(tickStep(0, span / (365 * DAY), target)));
  return monthTicks(min, max, years * 12);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (v: number): string => String(v).padStart(2, '0');

/**
 * Label a time tick by the finest local-calendar boundary it does NOT sit on — midnight ticks
 * read as dates, hour/minute ticks as clock times, month starts as month names, Jan 1 as the
 * year. Pairs with {@link niceTimeTicks}, whose boundary-aligned ticks make this deterministic.
 * English month abbreviations; pass an explicit `formatX` to localize.
 */
export function formatTimeTick(value: number): string {
  const d = new Date(value);
  if (d.getMilliseconds()) {
    return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }
  if (d.getSeconds()) return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  if (d.getMinutes() || d.getHours()) return `${two(d.getHours())}:${two(d.getMinutes())}`;
  if (d.getDate() !== 1) return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  if (d.getMonth() !== 0) return MONTH_NAMES[d.getMonth()];
  return String(d.getFullYear());
}

/**
 * Ticks for a log y-axis: decade boundaries (powers of 10), thinned to every k-th decade when
 * the domain spans more than `target` of them, densified with 2× and 5× mantissas when it spans
 * fewer than two. Sub-decade domains (e.g. [3, 7]) fall back to linear nice ticks.
 */
export function logTicks(min: number, max: number, target: number): number[] {
  if (!(min > 0) || !(max > min)) return [min];
  const lo = Math.ceil(Math.log10(min) - 1e-9);
  const hi = Math.floor(Math.log10(max) + 1e-9);
  if (hi < lo) return niceTicks(min, max, target);
  const decades = hi - lo + 1;
  const stride = Math.max(1, Math.ceil(decades / Math.max(1, target)));
  const out: number[] = [];
  for (let e = lo; e <= hi; e += stride) out.push(Math.pow(10, e));
  if (out.length >= 3 || stride > 1) return out;
  // Few decades: add 2/5 mantissa ticks so a narrow log axis still has structure.
  const dense: number[] = [];
  for (let e = lo - 1; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= min - 1e-12 && v <= max + 1e-12) dense.push(v);
    }
  }
  return dense.length >= 2 ? dense : out;
}

/**
 * Reduce the desired tick count so labels don't overlap at narrow sizes (WCAG 1.4.10 reflow).
 * Reduction-only: never returns more than `base` (so wide plots keep their requested density),
 * clamped to >= 2. `available` is the plot extent in px, `minPx` the minimum spacing per label.
 */
export function effectiveTickCount(base: number, available: number, minPx: number): number {
  const fit = Math.floor(Math.max(0, available) / Math.max(1, minPx));
  return Math.max(2, Math.min(base, fit));
}

/**
 * Default tick label formatter: compact thousands (`12.5k`), otherwise trimmed decimals.
 * The a11y layer can override this for time/category axes.
 */
export function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  if (abs !== 0 && abs < 1) return value.toFixed(2);
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/**
 * Locale-aware {@link formatTick}: the same three branches (compact thousands, two-decimal
 * sub-unit values, trimmed decimals) rendered by `Intl.NumberFormat`. An invalid BCP-47 tag
 * throws a RangeError here, at construction — fail fast, not once per tick.
 */
export function localeNumberFormatter(locale: string): (value: number) => string {
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const small = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return compact.format(value);
    if (abs !== 0 && abs < 1) return small.format(value);
    return plain.format(value);
  };
}

/**
 * Locale-aware {@link formatTimeTick}: the identical finest-boundary cascade, labeled by
 * `Intl.DateTimeFormat` (local time, matching {@link niceTimeTicks}). Formatters are built
 * once here, so per-tick formatting stays allocation-free.
 */
export function localeTimeFormatter(locale: string): (value: number) => string {
  const dtf = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat(locale, opts);
  const clock = { hour: '2-digit', minute: '2-digit' } as const;
  const millisecond = dtf({ ...clock, second: '2-digit', fractionalSecondDigits: 3 });
  const second = dtf({ ...clock, second: '2-digit' });
  const minute = dtf(clock);
  const day = dtf({ month: 'short', day: 'numeric' });
  const month = dtf({ month: 'short' });
  const year = dtf({ year: 'numeric' });
  return (value) => {
    const d = new Date(value);
    if (d.getMilliseconds()) return millisecond.format(d);
    if (d.getSeconds()) return second.format(d);
    if (d.getMinutes() || d.getHours()) return minute.format(d);
    if (d.getDate() !== 1) return day.format(d);
    if (d.getMonth() !== 0) return month.format(d);
    return year.format(d);
  };
}

/**
 * The default x/y tick formatters for an axis pair. Without a `locale` these are the exact
 * hand-rolled English defaults ({@link formatTick} / {@link formatTimeTick}) — same function
 * references, so existing output is untouched byte-for-byte. With a `locale` they become the
 * Intl-based equivalents.
 */
export function defaultFormatters(
  xType: 'linear' | 'time' | undefined,
  locale: string | undefined,
): { x: (v: number) => string; y: (v: number) => string } {
  const num = locale ? localeNumberFormatter(locale) : formatTick;
  const time = locale ? localeTimeFormatter(locale) : formatTimeTick;
  return { x: xType === 'time' ? time : num, y: num };
}
