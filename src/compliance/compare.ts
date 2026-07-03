/**
 * ACR comparison — the pure core of `fcharts-audit --compare old.json new.json`: what changed
 * in conformance between two generated ACRs (procurement's "did the new version get better or
 * worse?"). Takes two parsed ACR JSON models (`acr-<edition>.json`, the `renderAcr(…, 'json')`
 * output), returns a structured diff. No DOM, no Playwright — unit-tested under node:test.
 */
import type { AcrModel, Conformance, CriterionRow } from './types.ts';
import { RANK } from './mapping.ts';

/**
 * How a criterion's claim moved. `scope-changed` covers any transition into or out of
 * "no claim" (Not Applicable / Not Evaluated) — rank arithmetic is meaningless across that
 * boundary, so those are reported as scope changes rather than improvements/regressions.
 */
export type ChangeKind = 'improved' | 'regressed' | 'scope-changed';

export interface CriterionChange {
  num: string;
  name: string;
  from: Conformance;
  to: Conformance;
  kind: ChangeKind;
  /** The new report's remarks, when they differ from the old (context for the change). */
  newRemarks?: string;
}

/** A criterion present in only one of the two reports (criteria-set drift between versions). */
export interface CriterionPresence {
  num: string;
  name: string;
  conformance: Conformance;
}

export interface AcrComparison {
  old: { version: string; generatedAt: string; edition: string };
  new: { version: string; generatedAt: string; edition: string };
  /** The two reports target different editions — comparable, but flagged loudly. */
  editionMismatch: boolean;
  improved: CriterionChange[];
  regressed: CriterionChange[];
  scopeChanged: CriterionChange[];
  /** In the new report only / in the old report only. */
  added: CriterionPresence[];
  removed: CriterionPresence[];
  /** Same conformance, reworded remarks — evidence drift worth a skim, not a verdict change. */
  remarksOnly: { num: string; name: string }[];
  unchanged: number;
  /**
   * The exit-1 condition: a claim weakened, or a criterion newly entered scope failing
   * (scope change landing on "Does Not Support").
   */
  regression: boolean;
}

const CONFORMANCE_VALUES: ReadonlySet<Conformance> = new Set([
  'Supports',
  'Partially Supports',
  'Does Not Support',
  'Not Applicable',
  'Not Evaluated',
]);

/** Structural guard for a parsed ACR JSON — enough shape to compare, with no `any`. */
export function isAcrModel(x: unknown): x is AcrModel {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as Partial<AcrModel>;
  return (
    typeof m.product?.version === 'string' &&
    typeof m.edition?.title === 'string' &&
    typeof m.generatedAt === 'string' &&
    Array.isArray(m.criteria) &&
    m.criteria.every(
      (c: Partial<CriterionRow>) =>
        typeof c?.num === 'string' &&
        typeof c.name === 'string' &&
        CONFORMANCE_VALUES.has(c.conformance as Conformance),
    )
  );
}

/**
 * Explain what a non-ACR JSON value looks like, so the CLI error can point at the right file.
 * Returns undefined for values with no recognizable shape.
 */
export function describeNonAcr(x: unknown): string | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const o = x as Record<string, unknown>;
  if (o.mode === 'target' || 'checkCounts' in o || 'regressions' in o) {
    return 'this looks like an audit-report.json — --compare takes the ACR model JSON (acr-<edition>.json)';
  }
  return undefined;
}

function classify(from: Conformance, to: Conformance): ChangeKind {
  if (RANK[from] === 0 || RANK[to] === 0) return 'scope-changed';
  return RANK[to] > RANK[from] ? 'improved' : 'regressed';
}

const header = (m: AcrModel): AcrComparison['old'] => ({
  version: m.product.version,
  generatedAt: m.generatedAt,
  edition: m.edition.title,
});

/** Diff two ACR models criterion-by-criterion. Pure; ordering follows the new report. */
export function compareAcrs(oldModel: AcrModel, newModel: AcrModel): AcrComparison {
  const oldByNum = new Map(oldModel.criteria.map((c) => [c.num, c]));
  const newNums = new Set(newModel.criteria.map((c) => c.num));

  const cmp: AcrComparison = {
    old: header(oldModel),
    new: header(newModel),
    editionMismatch: oldModel.edition.key !== newModel.edition.key,
    improved: [],
    regressed: [],
    scopeChanged: [],
    added: [],
    removed: [],
    remarksOnly: [],
    unchanged: 0,
    regression: false,
  };

  for (const row of newModel.criteria) {
    const prev = oldByNum.get(row.num);
    if (!prev) {
      cmp.added.push({ num: row.num, name: row.name, conformance: row.conformance });
      continue;
    }
    if (prev.conformance === row.conformance) {
      if (prev.remarks === row.remarks) cmp.unchanged++;
      else cmp.remarksOnly.push({ num: row.num, name: row.name });
      continue;
    }
    const change: CriterionChange = {
      num: row.num,
      name: row.name,
      from: prev.conformance,
      to: row.conformance,
      kind: classify(prev.conformance, row.conformance),
      ...(prev.remarks !== row.remarks ? { newRemarks: row.remarks } : {}),
    };
    if (change.kind === 'improved') cmp.improved.push(change);
    else if (change.kind === 'regressed') cmp.regressed.push(change);
    else cmp.scopeChanged.push(change);
  }
  for (const row of oldModel.criteria) {
    if (!newNums.has(row.num)) {
      cmp.removed.push({ num: row.num, name: row.name, conformance: row.conformance });
    }
  }

  cmp.regression =
    cmp.regressed.length > 0 ||
    cmp.scopeChanged.some((c) => c.to === 'Does Not Support');
  return cmp;
}

/** WCAG-row conformance tallies for the one-line "totals" trend. */
function totals(m: AcrModel): Partial<Record<Conformance, number>> {
  const t: Partial<Record<Conformance, number>> = {};
  for (const c of m.criteria) {
    if (!c.adaptation) t[c.conformance] = (t[c.conformance] ?? 0) + 1;
  }
  return t;
}

function changeLines(label: string, changes: readonly CriterionChange[]): string[] {
  if (!changes.length) return [];
  const out = [`${changes.length} ${label}:`];
  for (const c of changes) {
    out.push(`  ${c.num} ${c.name}: ${c.from} → ${c.to}`);
    if (c.newRemarks) out.push(`     remarks: ${c.newRemarks}`);
  }
  return out;
}

/** Human-readable comparison for stdout (the `--json` flag prints the model instead). */
export function renderComparison(cmp: AcrComparison, oldModel: AcrModel, newModel: AcrModel): string {
  const out: string[] = [
    'fcharts-audit — ACR comparison',
    `  old: ${cmp.old.version} (${cmp.old.generatedAt}) — ${cmp.old.edition}`,
    `  new: ${cmp.new.version} (${cmp.new.generatedAt}) — ${cmp.new.edition}`,
  ];
  if (cmp.editionMismatch) {
    out.push('⚠ the two reports target different editions — criterion sets may not align');
  }
  out.push('');
  out.push(...changeLines('improved', cmp.improved));
  out.push(...changeLines('regressed', cmp.regressed));
  out.push(...changeLines('scope changed', cmp.scopeChanged));
  const presence = (label: string, rows: readonly CriterionPresence[]): void => {
    if (rows.length) {
      out.push(`${rows.length} ${label}: ${rows.map((r) => `${r.num} (${r.conformance})`).join(', ')}`);
    }
  };
  presence('added (new report only)', cmp.added);
  presence('removed (old report only)', cmp.removed);
  if (cmp.remarksOnly.length) {
    out.push(`${cmp.remarksOnly.length} remarks-only update(s): ${cmp.remarksOnly.map((r) => r.num).join(', ')}`);
  }

  const tOld = totals(oldModel);
  const tNew = totals(newModel);
  const part = (c: Conformance): string => `${c} ${tOld[c] ?? 0} → ${tNew[c] ?? 0}`;
  out.push(`${cmp.unchanged} unchanged · ${part('Supports')} · ${part('Partially Supports')} · ${part('Not Applicable')}`);
  out.push('');
  out.push(
    cmp.regression
      ? '✗ conformance regressed against the old report'
      : '✓ no conformance regression against the old report',
  );
  return out.join('\n');
}
