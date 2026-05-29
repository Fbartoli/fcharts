/**
 * Compliance Pack — shared types.
 *
 * The chart-layer WCAG 2.2 AA conformance model. `CriterionRow[]` is the committed baseline
 * (see `criteria.ts`, transcribed from `compliance/scope-and-evidence-map.md`); the ACR model
 * and engine report types build on it. Pure data + types — no DOM, no Playwright.
 */

/** ITI VPAT conformance vocabulary, plus an honest "Not Evaluated" for out-of-scope clauses. */
export type Conformance =
  | 'Supports'
  | 'Partially Supports'
  | 'Does Not Support'
  | 'Not Applicable'
  | 'Not Evaluated';

/** How a claim is verified — drives the CI-gate-vs-attestation split. */
export type Verification = 'automated' | 'hybrid' | 'manual-attestation';

export interface EvidenceRef {
  /** What the evidence shows. */
  detail: string;
  /** `file:line` reference, when code-backed. */
  ref?: string;
}

/** One WCAG success criterion (or adaptation feature) scoped to the chart component. */
export interface CriterionRow {
  /** e.g. "1.4.11", or "reduced-motion" / "forced-colors" for the adaptations. */
  num: string;
  name: string;
  level: 'A' | 'AA';
  /** True for the two non-WCAG good-practice adaptation rows. */
  adaptation?: boolean;
  applicability: 'applicable' | 'not-applicable';
  conformance: Conformance;
  /** The VPAT "Remarks and Explanations" cell. */
  remarks: string;
  verification: Verification;
  /** Whether a human attestation line is required before the report is "signed". */
  attestationRequired: boolean;
  evidence: EvidenceRef[];
}

// --- ACR model (consumed by the generator, document 2) ---

export interface ProductInfo {
  name: string;
  version: string;
  description: string;
  url?: string;
  /** The component-boundary statement (scope-and-evidence-map.md §1). */
  componentScope: string;
}

export type EditionKey = 'en301549' | 'wcag' | 'section508';

export interface EditionInfo {
  key: EditionKey;
  title: string;
  standards: string[];
  wcagVersion: '2.2';
  wcagSubset: 'A+AA';
}

export interface EvaluationInfo {
  methods: string[];
  notes: string;
  evaluator?: string;
}

export interface SectionRow {
  id: string;
  name: string;
  conformance: Conformance;
  remarks: string;
  /** SC numbers this verdict is derived from (auditable). */
  derivedFrom?: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  intro?: string;
  rows: SectionRow[];
}

export interface ConformanceTally {
  byLevel: Record<'A' | 'AA', Partial<Record<Conformance, number>>>;
  total: Partial<Record<Conformance, number>>;
}

export interface AcrModel {
  product: ProductInfo;
  edition: EditionInfo;
  evaluation: EvaluationInfo;
  criteria: CriterionRow[];
  sections: ReportSection[];
  summary: ConformanceTally;
  legal: string;
  /** ISO timestamp, injected by the caller (the pure generator never reads the clock). */
  generatedAt: string;
  /** Set when an attestation file was supplied; otherwise the report is a DRAFT. */
  signed?: { signer: string; date: string };
}

// --- engine report (document 3) ---

export type CheckStatus = 'pass' | 'fail' | 'na';

export interface CheckResult {
  id: string;
  status: CheckStatus;
  detail: string;
  /** SC numbers this check serves. */
  sc: string[];
}

export interface AxeViolation {
  id: string;
  impact: string;
  sc: string[];
}

export interface CheckReport {
  results: CheckResult[];
  axeViolations: AxeViolation[];
}

export interface CriterionVerdict {
  num: string;
  expected: Conformance;
  observed: Conformance;
  /** True when `observed` is weaker than `expected`. */
  regression: boolean;
  checks: CheckResult[];
}
