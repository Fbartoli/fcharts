/**
 * Pass → conformance mapping (document 3 §5).
 *
 * Pure: the check catalog (which checks serve which SC) as data, and the reducer that folds a
 * `CheckReport` into per-criterion verdicts and flags regressions below the committed baseline.
 * No DOM / Playwright — unit-tested under node:test.
 */
import type {
  CheckReport,
  Conformance,
  CriterionRow,
  CriterionVerdict,
  Verification,
} from './types.ts';

export interface CheckSpec {
  id: string;
  /** SC numbers this check serves. */
  sc: string[];
  verification: Verification;
}

/** The check catalog (conformance-test-plan.md §3) as pure data. `conformance.ts` implements each. */
export const CHECK_CATALOG: readonly CheckSpec[] = [
  { id: 'axe-serious', sc: [], verification: 'automated' },
  { id: 'canvas-hidden', sc: ['1.1.1', '4.1.2'], verification: 'automated' },
  { id: 'text-alternative', sc: ['1.1.1', '1.3.1', '1.4.1'], verification: 'automated' },
  { id: 'table-x-header', sc: ['1.3.1', '2.4.6'], verification: 'automated' },
  { id: 'surface-semantics', sc: ['1.1.1', '4.1.2', '3.3.2'], verification: 'automated' },
  { id: 'legend-semantics', sc: ['1.3.1', '4.1.2', '1.4.1', '3.2.4', '2.5.2'], verification: 'automated' },
  { id: 'live-region-present', sc: ['4.1.3'], verification: 'automated' },
  { id: 'keyboard-announce', sc: ['2.1.1', '4.1.3'], verification: 'automated' },
  { id: 'keyboard-zoom', sc: ['2.1.1'], verification: 'automated' },
  { id: 'escape-dismiss', sc: ['1.4.13'], verification: 'automated' },
  { id: 'active-value', sc: ['4.1.2'], verification: 'automated' },
  { id: 'no-keyboard-trap', sc: ['2.1.2'], verification: 'automated' },
  { id: 'label-in-name', sc: ['2.5.3'], verification: 'automated' },
  { id: 'target-size', sc: ['2.5.8'], verification: 'automated' },
  { id: 'tick-findable', sc: ['1.4.5', '1.3.1'], verification: 'automated' },
  { id: 'no-canvas-text', sc: ['1.4.5'], verification: 'automated' },
  { id: 'contrast-readout', sc: ['1.4.3'], verification: 'automated' },
  { id: 'contrast-default-text', sc: ['1.4.3'], verification: 'hybrid' },
  { id: 'meaningful-sequence', sc: ['1.3.2'], verification: 'automated' },
  { id: 'orientation', sc: ['1.3.4'], verification: 'automated' },
  { id: 'resize-text', sc: ['1.4.4'], verification: 'automated' },
  { id: 'reflow', sc: ['1.4.10'], verification: 'automated' },
  { id: 'text-spacing', sc: ['1.4.12'], verification: 'automated' },
  { id: 'focus-order', sc: ['2.4.3'], verification: 'automated' },
  { id: 'context-stability', sc: ['3.2.1', '3.2.2'], verification: 'automated' },
  { id: 'instructions-named-keys', sc: ['1.3.3', '3.3.2'], verification: 'hybrid' },
  { id: 'reduced-motion-rule', sc: ['2.2.2', 'reduced-motion'], verification: 'automated' },
  { id: 'forced-colors-rule', sc: ['2.4.7', 'forced-colors', '1.4.11'], verification: 'automated' },
  { id: 'focus-visible', sc: ['2.4.7', '1.4.11'], verification: 'automated' },
  { id: 'i18n-strings', sc: ['3.1.2'], verification: 'automated' },
];

/** SC number → ids of the checks that serve it. */
export const SC_CHECKS: Readonly<Record<string, string[]>> = (() => {
  const m: Record<string, string[]> = {};
  for (const c of CHECK_CATALOG) {
    for (const sc of c.sc) (m[sc] ??= []).push(c.id);
  }
  return m;
})();

const RANK: Record<Conformance, number> = {
  Supports: 3,
  'Partially Supports': 2,
  'Does Not Support': 1,
  'Not Applicable': 0,
  'Not Evaluated': 0,
};

/** One conformance level weaker (a failed check downgrades the claim). */
function weaken(c: Conformance): Conformance {
  if (c === 'Supports') return 'Partially Supports';
  if (c === 'Partially Supports') return 'Does Not Support';
  return c;
}

/**
 * Fold a check report into per-criterion verdicts, comparing observed conformance to the
 * committed baseline. The reducer only ever *confirms or downgrades* — it never upgrades a
 * baseline (no engine can prove a manual-attestation item); raising a baseline is a reviewed
 * human edit. A `regression: true` is exactly what the CI gate blocks.
 */
export function reduceToVerdicts(
  report: CheckReport,
  baseline: readonly CriterionRow[],
): CriterionVerdict[] {
  const axeFailSc = new Set<string>();
  for (const v of report.axeViolations) for (const sc of v.sc) axeFailSc.add(sc);

  return baseline.map((row) => {
    const checks = report.results.filter((r) => r.sc.includes(row.num) && r.status !== 'na');
    const failed = checks.some((r) => r.status === 'fail') || axeFailSc.has(row.num);
    const expected = row.conformance;
    const observed = failed && row.applicability === 'applicable' ? weaken(expected) : expected;
    return {
      num: row.num,
      expected,
      observed,
      regression: RANK[observed] < RANK[expected],
      checks,
    };
  });
}

/** Did any criterion regress? (The gate's pass/fail.) */
export function hasRegression(verdicts: readonly CriterionVerdict[]): boolean {
  return verdicts.some((v) => v.regression);
}
